import { FastifyInstance } from 'fastify';
import { capacityService } from '../services/capacity.service.js';

export async function facilityRoutes(fastify: FastifyInstance) {
  // GET /api/v1/facilities
  fastify.get('/facilities', async (request, reply) => {
    const query = request.query as any;
    const facilities = await capacityService.getFacilities({
      tier: query?.tier,
      operationalStatus: query?.operational_status,
    });
    return reply.send({
      success: true,
      data: facilities,
      meta: { count: facilities.length, timestamp: new Date().toISOString() },
    });
  });

  // GET /api/v1/facilities/:id
  fastify.get('/facilities/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const facility = await capacityService.getFacilityById(id);
    if (!facility) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Facility '${id}' not found` },
      });
    }
    return reply.send({ success: true, data: facility });
  });

  // GET /api/v1/facilities/:id/capacity
  fastify.get('/facilities/:id/capacity', async (request, reply) => {
    const { id } = request.params as { id: string };
    const resources = await capacityService.getFacilityCapacity(id);
    return reply.send({
      success: true,
      data: {
        facility_id: id,
        resources,
      },
    });
  });

  // PUT /api/v1/facilities/:id/capacity/:resource_id
  fastify.put('/facilities/:id/capacity/:resource_id', async (request, reply) => {
    const { id, resource_id } = request.params as { id: string; resource_id: string };
    const body = request.body as { status: any; reason?: string; estimated_restoration_at?: string };

    if (!body?.status) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Status field is required' },
      });
    }

    const updated = await capacityService.updateResourceStatus(resource_id, body.status, {
      reason: body.reason,
      estimated_restoration_at: body.estimated_restoration_at,
    });

    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Resource '${resource_id}' not found` },
      });
    }

    return reply.send({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // POST /api/v1/facilities/:id/capacity/:resource_id/override (Local walk-in preemption)
  fastify.post('/facilities/:id/capacity/:resource_id/override', async (request, reply) => {
    const { id, resource_id } = request.params as { id: string; resource_id: string };
    const body = request.body as { reason?: string };

    const reason = body?.reason || 'Critical walk-in resuscitation required immediately on-site';
    const updated = await capacityService.overrideResourceForWalkIn(id, resource_id, reason);

    if (!updated) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Resource '${resource_id}' not found` },
      });
    }

    return reply.send({
      success: true,
      data: updated,
      meta: {
        preempted: true,
        action: 'EMERGENCY_LOCAL_PREEMPTION_TRIGGERED',
        timestamp: new Date().toISOString(),
      },
    });
  });
}
