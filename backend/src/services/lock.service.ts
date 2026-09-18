import { query, withTransaction } from '../infrastructure/database.js';
import { RedisLockManager } from '../infrastructure/redis.js';
import { Reservation, ReservationStatus } from '../models/types.js';
import { auditService } from './audit.service.js';
import { randomUUID } from 'node:crypto';

export class LockService {
  private lockManager = new RedisLockManager();

  /**
   * Atomically reserve resources across Redis and PostgreSQL.
   */
  async createReservation(params: {
    referralId: string;
    matchId?: string;
    facilityId: string;
    resourceIds: string[];
    ttlMinutes?: number;
  }): Promise<Reservation> {
    const ttlMinutes = params.ttlMinutes || 45;
    const reservationId = `resv_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    // 1. First, verify and acquire distributed lock in Redis atomically
    const acquired = await this.lockManager.acquireMultiLock(
      params.resourceIds,
      reservationId,
      ttlMinutes * 60
    );

    if (!acquired) {
      throw new Error(
        `CAPACITY_LOCK_FAILED: One or more requested resources are already locked by a concurrent reservation.`
      );
    }

    try {
      // 2. Persist reservation in PostgreSQL inside an atomic transaction
      const reservation = await withTransaction<Reservation>(async (client) => {
        // Double check in DB that resources are not marked OFFLINE or OCCUPIED
        const checkRes = await client.query(
          `SELECT id, status FROM capacity_resources WHERE id = ANY($1::text[])`,
          [params.resourceIds]
        );

        for (const row of checkRes.rows) {
          if (row.status !== 'AVAILABLE') {
            throw new Error(`Resource ${row.id} is not AVAILABLE (Current status: ${row.status})`);
          }
        }

        // Mark resources as RESERVED in DB
        await client.query(
          `UPDATE capacity_resources SET status = 'RESERVED', updated_at = NOW() WHERE id = ANY($1::text[])`,
          [params.resourceIds]
        );

        // Insert reservation
        const insRes = await client.query(
          `INSERT INTO reservations 
          (id, referral_id, match_id, facility_id, locked_resource_ids, status, expires_at)
          VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
          RETURNING *`,
          [
            reservationId,
            params.referralId,
            params.matchId || null,
            params.facilityId,
            params.resourceIds,
            expiresAt,
          ]
        );

        // Update referral state
        await client.query(
          `UPDATE referrals 
           SET status = 'RESERVED', assigned_facility_id = $1 
           WHERE id = $2`,
          [params.facilityId, params.referralId]
        );

        const r = insRes.rows[0];
        return {
          id: r.id,
          referral_id: r.referral_id,
          match_id: r.match_id,
          facility_id: r.facility_id,
          locked_resource_ids: r.locked_resource_ids,
          status: r.status,
          expires_at: r.expires_at,
          created_at: r.created_at,
        };
      });

      await auditService.logEvent({
        entityType: 'RESERVATION',
        entityId: reservation.id,
        action: 'LOCKED',
        payload: {
          referralId: params.referralId,
          facilityId: params.facilityId,
          resourceIds: params.resourceIds,
          ttlMinutes,
        },
      });

      return reservation;
    } catch (err: any) {
      // Rollback Redis lock if DB operation failed
      await this.lockManager.releaseMultiLock(params.resourceIds, reservationId);
      throw err;
    }
  }

  /**
   * Commit reservation upon physical arrival and QR scan verification.
   * Converts locked resources to OCCUPIED.
   */
  async commitReservation(reservationId: string): Promise<Reservation> {
    const res = await query<any>('SELECT * FROM reservations WHERE id = $1', [reservationId]);
    if (res.rows.length === 0) throw new Error('Reservation not found');
    const r = res.rows[0];

    await withTransaction(async (client) => {
      // Commit resources to OCCUPIED
      await client.query(
        `UPDATE capacity_resources SET status = 'OCCUPIED', updated_at = NOW() WHERE id = ANY($1::text[])`,
        [r.locked_resource_ids]
      );

      await client.query(
        `UPDATE reservations SET status = 'COMMITTED', released_at = NOW() WHERE id = $1`,
        [reservationId]
      );

      await client.query(
        `UPDATE referrals SET status = 'HANDOVER_COMPLETED', completed_at = NOW() WHERE id = $1`,
        [r.referral_id]
      );
    });

    // Release Redis lock key
    await this.lockManager.releaseMultiLock(r.locked_resource_ids, reservationId);

    await auditService.logEvent({
      entityType: 'RESERVATION',
      entityId: reservationId,
      action: 'COMMITTED_HANDOVER',
      payload: { referralId: r.referral_id, facilityId: r.facility_id },
    });

    return {
      ...r,
      status: 'COMMITTED',
      released_at: new Date().toISOString(),
    };
  }

  /**
   * Invalidate reservation if a resource fails mid-transit.
   * Other non-failed resources in the bundle are freed back to AVAILABLE.
   */
  async invalidateReservation(reservationId: string, failedResourceId: string): Promise<void> {
    const res = await query<any>('SELECT * FROM reservations WHERE id = $1', [reservationId]);
    if (res.rows.length === 0) return;
    const r = res.rows[0];

    const nonFailedResourceIds = (r.locked_resource_ids as string[]).filter(
      (id) => id !== failedResourceId
    );

    await withTransaction(async (client) => {
      // Free other resources back to AVAILABLE
      if (nonFailedResourceIds.length > 0) {
        await client.query(
          `UPDATE capacity_resources SET status = 'AVAILABLE', updated_at = NOW() WHERE id = ANY($1::text[])`,
          [nonFailedResourceIds]
        );
      }

      await client.query(
        `UPDATE reservations SET status = 'INVALIDATED', released_at = NOW() WHERE id = $1`,
        [reservationId]
      );
    });

    // Release Redis locks
    await this.lockManager.releaseMultiLock(r.locked_resource_ids, reservationId);

    await auditService.logEvent({
      entityType: 'RESERVATION',
      entityId: reservationId,
      action: 'INVALIDATED_MID_TRANSIT',
      payload: { failedResourceId, referralId: r.referral_id },
    });
  }

  /**
   * Extend reservation TTL for delayed ambulances.
   */
  async extendReservation(reservationId: string, additionalMinutes: number = 20): Promise<boolean> {
    const res = await query<any>('SELECT * FROM reservations WHERE id = $1', [reservationId]);
    if (res.rows.length === 0) return false;
    const r = res.rows[0];

    const redisExtended = await this.lockManager.extendMultiLock(
      r.locked_resource_ids,
      reservationId,
      additionalMinutes * 60
    );

    if (redisExtended) {
      await query(
        `UPDATE reservations 
         SET expires_at = expires_at + interval '${additionalMinutes} minutes' 
         WHERE id = $1`,
        [reservationId]
      );
      return true;
    }
    return false;
  }
}

export const lockService = new LockService();
