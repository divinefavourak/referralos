import { FastifyInstance } from 'fastify';
import { lockService } from '../services/lock.service.js';
import { notificationService } from '../services/notification.service.js';
import { referralService } from '../services/referral.service.js';

export async function reservationRoutes(fastify: FastifyInstance) {
  // POST /api/v1/reservations
  fastify.post('/reservations', async (request, reply) => {
    const body = request.body as {
      referral_id: string;
      match_id?: string;
      facility_id: string;
      resource_ids: string[];
      ttl_minutes?: number;
    };

    if (!body?.referral_id || !body?.facility_id || !body?.resource_ids?.length) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'referral_id, facility_id, and resource_ids are required' },
      });
    }

    try {
      const reservation = await lockService.createReservation({
        referralId: body.referral_id,
        matchId: body.match_id,
        facilityId: body.facility_id,
        resourceIds: body.resource_ids,
        ttlMinutes: body.ttl_minutes || 45,
      });

      // Dispatch pre-arrival alert to receiving hospital ER triage dashboard
      const ref = await referralService.getReferralById(body.referral_id);
      notificationService.sendToFacility(body.facility_id, 'referral.pre_arrival', {
        referral_id: body.referral_id,
        patient_name: ref?.patient_name,
        priority: ref?.triage_priority,
        chief_complaint: ref?.chief_complaint,
        locked_resources: reservation.locked_resource_ids,
        expires_at: reservation.expires_at,
        audio_chime: 'SIREN_URGENT',
      });

      return reply.code(201).send({
        success: true,
        data: {
          reservation_id: reservation.id,
          facility_id: reservation.facility_id,
          locked_resources: reservation.locked_resource_ids,
          status: reservation.status,
          expires_at: reservation.expires_at,
        },
      });
    } catch (err: any) {
      return reply.code(409).send({
        success: false,
        error: {
          code: 'CAPACITY_LOCK_FAILED',
          message: err.message,
        },
      });
    }
  });

  // POST /api/v1/reservations/:id/extend
  fastify.post('/reservations/:id/extend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { additional_minutes?: number };

    const extended = await lockService.extendReservation(id, body?.additional_minutes || 20);
    if (!extended) {
      return reply.code(400).send({
        success: false,
        error: { code: 'EXTENSION_FAILED', message: 'Reservation could not be extended' },
      });
    }

    return reply.send({
      success: true,
      data: { reservation_id: id, extended: true },
    });
  });
}
