import { query } from '../infrastructure/database.js';
import { randomUUID } from 'node:crypto';

export interface AuditLogEntry {
  entityType: 'REFERRAL' | 'RESERVATION' | 'RESOURCE' | 'FACILITY' | 'TRANSPORT';
  entityId: string;
  action: string;
  payload?: Record<string, any>;
  performedBy?: string;
}

export class AuditService {
  async logEvent(entry: AuditLogEntry): Promise<void> {
    const id = `aud_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    try {
      await query(
        `INSERT INTO audit_logs (id, entity_type, entity_id, action, payload, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          entry.entityType,
          entry.entityId,
          entry.action,
          JSON.stringify(entry.payload || {}),
          entry.performedBy || 'SYSTEM',
        ]
      );
    } catch (err: any) {
      console.error('[AUDIT LOG ERROR] Failed to record audit entry:', err.message);
    }
  }

  async getAuditTrail(entityType: string, entityId: string): Promise<any[]> {
    const res = await query(
      `SELECT * FROM audit_logs 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at ASC`,
      [entityType, entityId]
    );
    return res.rows;
  }
}

export const auditService = new AuditService();
