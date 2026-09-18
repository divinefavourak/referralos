import { query } from '../infrastructure/database.js';
import { TrackingEvent, TransportAssignment } from '../models/types.js';
import { estimateRoadTravel } from '../utils/geo.js';
import { notificationService } from './notification.service.js';
import { v4 as uuidv4 } from 'uuid';

export class TransportService {
  async assignTransport(params: {
    referralId: string;
    vehicleId: string;
    vehicleType: string;
    driverName?: string;
    paramedicName?: string;
    crewContactPhone?: string;
  }): Promise<TransportAssignment> {
    const referralId = params.referralId || (params as any).referral_id;
    const vehicleId = params.vehicleId || (params as any).vehicle_id;
    const vehicleType = params.vehicleType || (params as any).vehicle_type;
    const driverName = params.driverName || (params as any).driver_name || 'Samuel Ojo';
    const paramedicName = params.paramedicName || (params as any).paramedic_name || 'Kelechi Nwosu';
    const crewContactPhone = params.crewContactPhone || (params as any).crew_contact_phone || '+2348033221100';

    const id = `ta_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

    const res = await query<any>(
      `INSERT INTO transport_assignments 
      (id, referral_id, vehicle_id, vehicle_type, driver_name, paramedic_name, crew_contact_phone, dispatch_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'DISPATCHED_TO_ORIGIN')
      RETURNING *`,
      [
        id,
        referralId,
        vehicleId,
        vehicleType,
        driverName,
        paramedicName,
        crewContactPhone,
      ]
    );

    // Update referral status to DISPATCHED
    await query(`UPDATE referrals SET status = 'DISPATCHED' WHERE id = $1`, [referralId]);

    const row = res.rows[0];
    return {
      id: row.id,
      referral_id: row.referral_id,
      vehicle_id: row.vehicle_id,
      vehicle_type: row.vehicle_type,
      driver_name: row.driver_name,
      paramedic_name: row.paramedic_name,
      crew_contact_phone: row.crew_contact_phone,
      dispatch_status: row.dispatch_status,
      assigned_at: row.assigned_at,
    };
  }

  async recordTelemetry(params: {
    transportAssignmentId: string;
    referralId: string;
    latitude: number;
    longitude: number;
    speedKmh?: number;
    headingDegrees?: number;
    patientVitals?: any;
  }): Promise<TrackingEvent> {
    const id = `trk_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const transportAssignmentId = params.transportAssignmentId || (params as any).transport_assignment_id;
    const referralId = params.referralId || (params as any).referral_id;
    const speedKmh = params.speedKmh ?? (params as any).speed_kmh ?? 55.0;
    const headingDegrees = params.headingDegrees ?? (params as any).heading_degrees ?? (params as any).heading ?? 0;
    const patientVitals = params.patientVitals || (params as any).patient_vitals || {};

    // Compute dynamic ETA to assigned destination hospital
    let estimatedSeconds = 1200;
    const destRes = await query<{ latitude: number; longitude: number }>(
      `SELECT f.latitude, f.longitude 
       FROM referrals r
       JOIN facilities f ON r.assigned_facility_id = f.id
       WHERE r.id = $1`,
      [referralId]
    );

    if (destRes.rows.length > 0) {
      const dest = destRes.rows[0];
      const travel = estimateRoadTravel(
        { latitude: params.latitude, longitude: params.longitude },
        { latitude: dest.latitude, longitude: dest.longitude }
      );
      estimatedSeconds = Math.round(travel.durationMinutes * 60);
    }

    const res = await query<any>(
      `INSERT INTO tracking_events 
      (id, transport_assignment_id, referral_id, latitude, longitude, speed_kmh, heading_degrees, estimated_time_remaining_seconds, patient_vitals)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        transportAssignmentId,
        referralId,
        params.latitude,
        params.longitude,
        speedKmh,
        headingDegrees,
        estimatedSeconds,
        JSON.stringify(patientVitals),
      ]
    );

    // Ensure referral is in IN_TRANSIT status if not already rerouted
    await query(
      `UPDATE referrals 
       SET status = CASE WHEN status = 'REROUTED' THEN 'REROUTED' ELSE 'IN_TRANSIT' END 
       WHERE id = $1`,
      [params.referralId]
    );

    const row = res.rows[0];
    const event: TrackingEvent = {
      id: row.id,
      transport_assignment_id: row.transport_assignment_id,
      referral_id: row.referral_id,
      latitude: row.latitude,
      longitude: row.longitude,
      speed_kmh: row.speed_kmh,
      heading_degrees: row.heading_degrees,
      estimated_time_remaining_seconds: row.estimated_time_remaining_seconds,
      patient_vitals: row.patient_vitals,
      timestamp: row.timestamp,
    };

    // Broadcast telemetry update via SSE
    notificationService.broadcast('transport.telemetry', {
      referralId: params.referralId,
      latitude: params.latitude,
      longitude: params.longitude,
      speedKmh: params.speedKmh,
      etaMinutes: Math.round(estimatedSeconds / 60),
      vitals: params.patientVitals,
      timestamp: row.timestamp,
    });

    return event;
  }
}

export const transportService = new TransportService();
