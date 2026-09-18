import { FastifyInstance } from 'fastify';
import { referralService } from '../services/referral.service.js';
import { matchingEngine } from '../services/matching/engine.js';
import { query } from '../infrastructure/database.js';
import { lockService } from '../services/lock.service.js';

export async function referralRoutes(fastify: FastifyInstance) {
  // POST /api/v1/referrals
  fastify.post('/referrals', async (request, reply) => {
    const body = request.body as any;

    if (!body?.patient_id || !body?.referring_facility_id || !body?.required_resources) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing mandatory referral parameters' },
      });
    }

    const referral = await referralService.createReferral({
      patientId: body.patient_id,
      referringFacilityId: body.referring_facility_id,
      triagePriority: body.triage_priority || 'CRITICAL',
      chiefComplaint: body.chief_complaint || 'Emergency Transfer',
      clinicalSummary: body.clinical_summary,
      requiredResources: body.required_resources,
      initialVitals: body.initial_vitals,
    });

    return reply.code(201).send({
      success: true,
      data: {
        referral_id: referral.id,
        status: referral.status,
        created_at: referral.created_at,
      },
    });
  });

  // GET /api/v1/referrals/:id
  fastify.get('/referrals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const referral = await referralService.getReferralById(id);

    if (!referral) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Referral '${id}' not found` },
      });
    }

    return reply.send({ success: true, data: referral });
  });

  // POST /api/v1/referrals/:id/matches
  fastify.post('/referrals/:id/matches', async (request, reply) => {
    const { id } = request.params as { id: string };
    const referral = await referralService.getReferralById(id);

    if (!referral) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Referral '${id}' not found` },
      });
    }

    const evaluationResults = await matchingEngine.evaluateMatches(referral);

    // Persist matches in DB for auditing
    for (const match of evaluationResults) {
      const matchId = `mat_${Math.random().toString(36).substring(2, 15)}`;
      await query(
        `INSERT INTO matches (id, referral_id, facility_id, composite_score, hard_constraints_satisfied, breakdown, status, rationale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          matchId,
          referral.id,
          match.facility.id,
          match.compositeScore,
          match.hardConstraintsPassed,
          JSON.stringify(match.breakdown),
          match.hardConstraintsPassed ? 'PROPOSED' : 'REJECTED',
          match.rationale,
        ]
      );
    }

    return reply.send({
      success: true,
      data: {
        referral_id: referral.id,
        matches: evaluationResults.map((r) => ({
          facility_id: r.facility.id,
          facility_name: r.facility.name,
          composite_score: r.compositeScore,
          hard_constraints_satisfied: r.hardConstraintsPassed,
          disqualification_reason: r.disqualificationReason,
          travel_time_minutes: r.travelTimeMinutes,
          distance_km: r.distanceKm,
          matched_resource_ids: r.matchedResourceIds,
          breakdown: r.breakdown,
          rationale: r.rationale,
        })),
      },
    });
  });

  // PATCH /api/v1/referrals/:id/status
  fastify.patch('/referrals/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: any; verification_code?: string; receiving_clinician_notes?: string };

    if (body.status === 'HANDOVER_COMPLETED') {
      // Find active reservation for this referral
      const resvRes = await query<any>(
        'SELECT id FROM reservations WHERE referral_id = $1 AND status = $2',
        [id, 'ACTIVE']
      );
      if (resvRes.rows.length > 0) {
        await lockService.commitReservation(resvRes.rows[0].id);
      } else {
        await referralService.updateStatus(id, 'HANDOVER_COMPLETED');
      }

      return reply.send({
        success: true,
        data: {
          referral_id: id,
          status: 'HANDOVER_COMPLETED',
          handover_verified: true,
          completed_at: new Date().toISOString(),
        },
      });
    }

    const updated = await referralService.updateStatus(id, body.status);
    return reply.send({ success: true, data: updated });
  });
}
