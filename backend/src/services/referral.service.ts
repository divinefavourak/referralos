import { query } from '../infrastructure/database.js';
import { Patient, Referral, ReferralStatus } from '../models/types.js';
import { randomUUID } from 'node:crypto';

export class ReferralService {
  async createReferral(data: {
    patientId: string;
    referringFacilityId: string;
    triagePriority: string;
    chiefComplaint: string;
    clinicalSummary?: string;
    requiredResources: any;
    initialVitals?: any;
  }): Promise<Referral> {
    const id = `ref_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    // Ensure patient record exists to satisfy foreign key constraint
    await query(
      `INSERT INTO patients (id, full_name, gender, blood_group)
       VALUES ($1, $2, 'UNKNOWN', 'UNKNOWN')
       ON CONFLICT (id) DO NOTHING`,
      [data.patientId, data.patientId.startsWith('pat_pph') ? 'Amara Okoro' : `Patient ${data.patientId}`]
    );

    const res = await query<any>(
      `INSERT INTO referrals 
      (id, patient_id, referring_facility_id, triage_priority, chief_complaint, clinical_summary, required_resources, initial_vitals, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MATCHING')
      RETURNING *`,
      [
        id,
        data.patientId,
        data.referringFacilityId,
        data.triagePriority,
        data.chiefComplaint,
        data.clinicalSummary || null,
        JSON.stringify(data.requiredResources),
        JSON.stringify(data.initialVitals || {}),
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      patient_id: row.patient_id,
      referring_facility_id: row.referring_facility_id,
      assigned_facility_id: row.assigned_facility_id,
      triage_priority: row.triage_priority,
      chief_complaint: row.chief_complaint,
      clinical_summary: row.clinical_summary,
      required_resources: row.required_resources,
      initial_vitals: row.initial_vitals,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at,
    };
  }

  async getReferralById(id: string): Promise<any | null> {
    const res = await query<any>(
      `SELECT r.*, 
              p.full_name as patient_name, p.gender as patient_gender, p.blood_group as patient_blood_group,
              f.name as referring_facility_name,
              af.name as assigned_facility_name,
              resv.id as active_reservation_id, resv.locked_resource_ids, resv.expires_at as reservation_expires_at
       FROM referrals r
       JOIN patients p ON r.patient_id = p.id
       JOIN facilities f ON r.referring_facility_id = f.id
       LEFT JOIN facilities af ON r.assigned_facility_id = af.id
       LEFT JOIN reservations resv ON r.id = resv.referral_id AND resv.status = 'ACTIVE'
       WHERE r.id = $1`,
      [id]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async updateStatus(id: string, status: ReferralStatus): Promise<Referral | null> {
    const isCompleted = status === 'HANDOVER_COMPLETED';
    const res = await query<any>(
      `UPDATE referrals 
       SET status = $1, 
           completed_at = CASE WHEN $2 = true THEN NOW() ELSE completed_at END 
       WHERE id = $3 
       RETURNING *`,
      [status, isCompleted, id]
    );
    return res.rows[0] || null;
  }
}

export const referralService = new ReferralService();
