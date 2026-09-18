import { query } from '../infrastructure/database.js';
import { getPubClient, getRedisClient } from '../infrastructure/redis.js';
import { CapacityResource, Facility, ResourceStatus } from '../models/types.js';

export class CapacityService {
  private pubClient = getPubClient();
  private redis = getRedisClient();

  /**
   * Get all active facilities with optional spatial or tier filters
   */
  async getFacilities(options?: {
    tier?: string;
    operationalStatus?: string;
  }): Promise<Facility[]> {
    let sql = 'SELECT * FROM facilities WHERE is_active = true';
    const params: any[] = [];

    if (options?.tier) {
      params.push(options.tier);
      sql += ` AND tier = $${params.length}`;
    }
    if (options?.operationalStatus) {
      params.push(options.operationalStatus);
      sql += ` AND operational_status = $${params.length}`;
    }

    sql += ' ORDER BY name ASC';
    const res = await query<any>(sql, params);

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      facility_code: row.facility_code,
      tier: row.tier,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
        district: row.district,
        state_province: row.state_province,
      },
      contact: {
        general_phone: row.contact_general_phone,
        emergency_desk_phone: row.contact_emergency_phone,
        emergency_desk_email: row.contact_emergency_email,
      },
      operational_status: row.operational_status,
      is_active: row.is_active,
      total_beds: row.total_beds,
      occupied_beds: row.occupied_beds,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Get single facility by ID
   */
  async getFacilityById(id: string): Promise<Facility | null> {
    const res = await query<any>('SELECT * FROM facilities WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      facility_code: row.facility_code,
      tier: row.tier,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        address: row.address,
      },
      contact: {
        emergency_desk_phone: row.contact_emergency_phone,
      },
      operational_status: row.operational_status,
      is_active: row.is_active,
      total_beds: row.total_beds,
      occupied_beds: row.occupied_beds,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get live capacity resources for a given facility
   */
  async getFacilityCapacity(facilityId: string): Promise<CapacityResource[]> {
    const res = await query<CapacityResource>(
      `SELECT * FROM capacity_resources WHERE facility_id = $1 ORDER BY resource_type ASC, identifier_code ASC`,
      [facilityId]
    );
    return res.rows;
  }

  /**
   * Update the status of a specific hospital asset (e.g. theatre going offline).
   * Emits `capacity.resource.status_changed` event on the Redis Pub/Sub bus.
   */
  async updateResourceStatus(
    resourceId: string,
    newStatus: ResourceStatus,
    metadataPatch?: Record<string, any>
  ): Promise<CapacityResource | null> {
    const existingRes = await query<CapacityResource>(
      'SELECT * FROM capacity_resources WHERE id = $1',
      [resourceId]
    );
    if (existingRes.rows.length === 0) return null;
    const current = existingRes.rows[0];

    const mergedMetadata = { ...current.metadata, ...metadataPatch };

    const updateRes = await query<CapacityResource>(
      `UPDATE capacity_resources 
       SET status = $1, metadata = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [newStatus, JSON.stringify(mergedMetadata), resourceId]
    );

    const updated = updateRes.rows[0];

    // Publish event for Failover Watcher and real-time subscribers
    const eventPayload = {
      eventType: 'capacity.resource.status_changed',
      resourceId: updated.id,
      facilityId: updated.facility_id,
      resourceType: updated.resource_type,
      subType: updated.sub_type,
      previousStatus: current.status,
      newStatus: updated.status,
      timestamp: new Date().toISOString(),
      metadata: updated.metadata,
    };

    try {
      if (this.pubClient.status !== 'ready' && this.pubClient.status !== 'connecting') {
        await this.pubClient.connect().catch(() => {});
      }
      await this.pubClient.publish('capacity.events', JSON.stringify(eventPayload));
    } catch (e: any) {
      console.warn('[CAPACITY EVENT PUB] Redis publish error:', e.message);
    }

    return updated;
  }

  /**
   * Emergency Local Preemption: Clinician on-site reclaims a reserved resource
   * for an immediate, dying walk-in patient. Triggers automated reroute for incoming referral.
   */
  async overrideResourceForWalkIn(
    facilityId: string,
    resourceId: string,
    reason: string
  ): Promise<CapacityResource | null> {
    return this.updateResourceStatus(resourceId, 'OCCUPIED', {
      preemption_reason: reason,
      preempted_by: 'LOCAL_WALK_IN_CRITICAL_EMERGENCY',
      preempted_at: new Date().toISOString(),
    });
  }
}

export const capacityService = new CapacityService();
