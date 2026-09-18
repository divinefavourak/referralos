import { FastifyInstance } from 'fastify';
import { transportService } from '../services/transport.service.js';

export async function transportRoutes(fastify: FastifyInstance) {
  // POST /api/v1/transport/assign
  fastify.post('/transport/assign', async (request, reply) => {
    const body = request.body as {
      referral_id: string;
      vehicle_id: string;
      vehicle_type: string;
      driver_name?: string;
      paramedic_name?: string;
      crew_contact_phone?: string;
    };

    if (!body?.referral_id || !body?.vehicle_id || !body?.vehicle_type) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'referral_id, vehicle_id, and vehicle_type are required' },
      });
    }

    const assignment = await transportService.assignTransport({
      referralId: body.referral_id,
      vehicleId: body.vehicle_id,
      vehicleType: body.vehicle_type,
      driverName: body.driver_name,
      paramedicName: body.paramedic_name,
      crewContactPhone: body.crew_contact_phone,
    });
    return reply.code(201).send({
      success: true,
      data: assignment,
    });
  });

  // POST /api/v1/transport/:id/telemetry
  fastify.post('/transport/:id/telemetry', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      referral_id: string;
      latitude: number;
      longitude: number;
      speed_kmh?: number;
      heading?: number;
      patient_vitals?: any;
    };

    if (!body?.referral_id || body?.latitude === undefined || body?.longitude === undefined) {
      return reply.code(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'referral_id, latitude, and longitude are required' },
      });
    }

    const event = await transportService.recordTelemetry({
      transportAssignmentId: id,
      referralId: body.referral_id,
      latitude: body.latitude,
      longitude: body.longitude,
      speedKmh: body.speed_kmh,
      headingDegrees: body.heading,
      patientVitals: body.patient_vitals,
    });

    return reply.send({
      success: true,
      data: event,
    });
  });
}
