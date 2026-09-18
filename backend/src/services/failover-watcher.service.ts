import { query } from '../infrastructure/database.js';
import { getSubClient } from '../infrastructure/redis.js';
import { lockService } from './lock.service.js';
import { matchingEngine } from './matching/engine.js';
import { notificationService } from './notification.service.js';
import { GeoCoordinates } from '../utils/geo.js';

export class FailoverWatcherService {
  private subClient = getSubClient();
  private isListening = false;

  async start(): Promise<void> {
    if (this.isListening) return;

    try {
      if (this.subClient.status !== 'ready') {
        await this.subClient.connect().catch(() => {});
      }

      await this.subClient.subscribe('capacity.events');
      this.isListening = true;
      console.log('[FAILOVER WATCHER] Subscribed to capacity.events stream.');

      this.subClient.on('message', async (channel, message) => {
        if (channel === 'capacity.events') {
          try {
            const event = JSON.parse(message);
            await this.handleCapacityEvent(event);
          } catch (err: any) {
            console.error('[FAILOVER WATCHER ERROR] Processing event:', err.message);
          }
        }
      });
    } catch (err: any) {
      console.warn('[FAILOVER WATCHER] Redis subscription warning:', err.message);
    }
  }

  async stop(): Promise<void> {
    if (!this.isListening) return;
    try {
      await this.subClient.unsubscribe('capacity.events').catch(() => {});
      this.isListening = false;
    } catch {}
  }

  /**
   * Handle capacity status change and trigger automated reroute if in-transit referral is compromised.
   */
  async handleCapacityEvent(event: {
    eventType: string;
    resourceId: string;
    facilityId: string;
    newStatus: string;
    metadata?: any;
  }): Promise<void> {
    const isCompromised =
      event.newStatus === 'OFFLINE' ||
      event.newStatus === 'MAINTENANCE' ||
      (event.newStatus === 'OCCUPIED' && event.metadata?.preempted_by);

    if (!isCompromised) {
      return;
    }

    console.log(
      `[FAILOVER WATCHER] Capacity Drop Detected: Resource ${event.resourceId} at Facility ${event.facilityId} is now ${event.newStatus}.`
    );

    // 1. Query for any ACTIVE reservations holding this compromised resource
    const resvRes = await query<any>(
      `SELECT r.*, ref.status as referral_status, ref.patient_id, ref.chief_complaint, ref.required_resources, ref.triage_priority, ref.referring_facility_id
       FROM reservations r
       JOIN referrals ref ON r.referral_id = ref.id
       WHERE r.status = 'ACTIVE' 
         AND $1::text = ANY(r.locked_resource_ids)`,
      [event.resourceId]
    );

    if (resvRes.rows.length === 0) {
      console.log(`[FAILOVER WATCHER] No active reservations affected by resource ${event.resourceId}.`);
      return;
    }

    for (const compromisedReservation of resvRes.rows) {
      console.log(
        `[FAILOVER ALERT] In-transit referral ${compromisedReservation.referral_id} compromised! Initiating automated reroute...`
      );

      // Invalidate current reservation & release remaining non-failed resources
      await lockService.invalidateReservation(
        compromisedReservation.id,
        event.resourceId
      );

      // Retrieve the latest vehicle GPS telemetry for this referral
      let liveCoordinates: GeoCoordinates | undefined;
      const trackingRes = await query<{ latitude: number; longitude: number }>(
        `SELECT latitude, longitude 
         FROM tracking_events 
         WHERE referral_id = $1 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [compromisedReservation.referral_id]
      );

      if (trackingRes.rows.length > 0) {
        liveCoordinates = {
          latitude: trackingRes.rows[0].latitude,
          longitude: trackingRes.rows[0].longitude,
        };
        console.log(
          `[FAILOVER WATCHER] Live ambulance GPS acquired: [${liveCoordinates.latitude}, ${liveCoordinates.longitude}]`
        );
      }

      // Re-evaluate regional facilities from vehicle's live GPS coordinates
      const referralObj = {
        id: compromisedReservation.referral_id,
        patient_id: compromisedReservation.patient_id,
        referring_facility_id: compromisedReservation.referring_facility_id,
        triage_priority: compromisedReservation.triage_priority,
        chief_complaint: compromisedReservation.chief_complaint,
        required_resources: compromisedReservation.required_resources,
        status: compromisedReservation.referral_status,
        created_at: compromisedReservation.created_at,
      };

      const matches = await matchingEngine.evaluateMatches(
        referralObj as any,
        liveCoordinates
      );

      // Filter out the failed facility and find top viable candidate
      const viableMatches = matches.filter(
        (m) => m.hardConstraintsPassed && m.facility.id !== event.facilityId
      );

      if (viableMatches.length === 0) {
        console.error(
          `[CRITICAL FAILOVER ESCALATION] No alternative facility satisfies hard constraints for referral ${compromisedReservation.referral_id}!`
        );
        notificationService.broadcast('referral.escalation', {
          referralId: compromisedReservation.referral_id,
          priority: 'CRITICAL',
          message:
            'No viable hospital found with available resources. Immediate Regional Medical Command intervention required.',
        });
        return;
      }

      const bestAlternative = viableMatches[0];
      console.log(
        `[FAILOVER MATCH] Selected Alternative: ${bestAlternative.facility.name} (Score: ${bestAlternative.compositeScore}, ETA: ${bestAlternative.travelTimeMinutes} min)`
      );

      // Acquire atomic multi-resource locks at the backup hospital
      const newReservation = await lockService.createReservation({
        referralId: compromisedReservation.referral_id,
        facilityId: bestAlternative.facility.id,
        resourceIds: bestAlternative.matchedResourceIds,
        ttlMinutes: 45,
      });

      // Update referral state to REROUTED
      await query(
        `UPDATE referrals 
         SET status = 'REROUTED', assigned_facility_id = $1 
         WHERE id = $2`,
        [bestAlternative.facility.id, compromisedReservation.referral_id]
      );

      // Broadcast Reroute Alert to all connected clients & ambulance terminal
      const reroutePayload = {
        referralId: compromisedReservation.referral_id,
        previousFacilityId: event.facilityId,
        newFacilityId: bestAlternative.facility.id,
        newFacilityName: bestAlternative.facility.name,
        newEtaMinutes: bestAlternative.travelTimeMinutes,
        distanceKm: bestAlternative.distanceKm,
        reservationId: newReservation.id,
        audioAlert: `ATTENTION: Primary facility compromised. Automatically rerouting to ${bestAlternative.facility.name} (${bestAlternative.travelTimeMinutes} min ETA). Turn right on Western Expressway.`,
        reason: `Resource ${event.resourceId} dropped offline at original destination.`,
        timestamp: new Date().toISOString(),
      };

      notificationService.broadcast('referral.rerouted', reroutePayload);

      // Send high-priority pre-arrival alert to the new receiving hospital's ER
      notificationService.sendToFacility(bestAlternative.facility.id, 'referral.pre_arrival', {
        referralId: compromisedReservation.referral_id,
        priority: compromisedReservation.triage_priority,
        chiefComplaint: compromisedReservation.chief_complaint,
        etaMinutes: bestAlternative.travelTimeMinutes,
        isReroute: true,
        lockedResources: bestAlternative.matchedResourceIds,
      });

      console.log(
        `[FAILOVER COMPLETE] Reroute to ${bestAlternative.facility.name} locked and dispatched.`
      );
    }
  }
}

export const failoverWatcherService = new FailoverWatcherService();
