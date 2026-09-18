import { query } from '../../infrastructure/database.js';
import { CapacityResource, Facility, Match, Referral, RequiredResources } from '../../models/types.js';
import { estimateRoadTravel, GeoCoordinates } from '../../utils/geo.js';
import { v4 as uuidv4 } from 'uuid';

export interface MatchingEvaluationResult {
  facility: Facility;
  hardConstraintsPassed: boolean;
  disqualificationReason?: string;
  travelTimeMinutes: number;
  distanceKm: number;
  compositeScore: number;
  breakdown: {
    travel_time_minutes: number;
    distance_km: number;
    travel_score: number;
    capacity_score: number;
    handover_score: number;
    congestion_penalty: number;
  };
  matchedResourceIds: string[];
  rationale: string;
}

export class MatchingEngine {
  /**
   * Evaluates all regional facilities against an active referral.
   * Can evaluate from referring facility location OR from a live vehicle coordinate.
   */
  async evaluateMatches(
    referral: Referral,
    originCoords?: GeoCoordinates
  ): Promise<MatchingEvaluationResult[]> {
    // 1. Determine origin coordinates (either supplied live vehicle GPS or referring facility)
    let origin = originCoords;
    if (!origin) {
      const origRes = await query<{ latitude: number; longitude: number }>(
        'SELECT latitude, longitude FROM facilities WHERE id = $1',
        [referral.referring_facility_id]
      );
      if (origRes.rows.length === 0) {
        throw new Error('Referring facility coordinates not found');
      }
      origin = {
        latitude: origRes.rows[0].latitude,
        longitude: origRes.rows[0].longitude,
      };
    }

    // 2. Fetch all operational destination facilities (excluding the origin referring facility)
    const facRes = await query<any>(
      `SELECT * FROM facilities 
       WHERE is_active = true 
         AND id != $1 
         AND operational_status = 'OPERATIONAL'`,
      [referral.referring_facility_id]
    );

    // 3. Fetch all active capacity resources across facilities
    const resRes = await query<CapacityResource>(
      `SELECT * FROM capacity_resources WHERE status = 'AVAILABLE'`
    );
    const resourcesByFacility = new Map<string, CapacityResource[]>();
    for (const r of resRes.rows) {
      const list = resourcesByFacility.get(r.facility_id) || [];
      list.push(r);
      resourcesByFacility.set(r.facility_id, list);
    }

    const maxTriageMinutes = this.getMaxTravelTimeMinutes(referral.triage_priority);
    const results: MatchingEvaluationResult[] = [];

    // 4. Evaluate each candidate facility
    for (const row of facRes.rows) {
      const facility: Facility = {
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
        total_beds: row.total_beds || 100,
        occupied_beds: row.occupied_beds || 50,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      const availableResources = resourcesByFacility.get(facility.id) || [];
      const travel = estimateRoadTravel(origin, facility.location);

      // --- PHASE 1: HARD CONSTRAINT FILTER ---
      const hardCheck = this.checkHardConstraints(
        referral.required_resources,
        availableResources,
        travel.durationMinutes,
        maxTriageMinutes
      );

      if (!hardCheck.passed) {
        results.push({
          facility,
          hardConstraintsPassed: false,
          disqualificationReason: hardCheck.reason,
          travelTimeMinutes: travel.durationMinutes,
          distanceKm: travel.distanceKm,
          compositeScore: 0,
          breakdown: {
            travel_time_minutes: travel.durationMinutes,
            distance_km: travel.distanceKm,
            travel_score: 0,
            capacity_score: 0,
            handover_score: 0,
            congestion_penalty: 0,
          },
          matchedResourceIds: [],
          rationale: `Disqualified: ${hardCheck.reason}`,
        });
        continue;
      }

      // --- PHASE 2: MCDA COMPOSITE SCORING ---
      const scoring = this.calculateMCDAScore(
        travel.durationMinutes,
        maxTriageMinutes,
        travel.distanceKm,
        referral.required_resources,
        availableResources,
        row.handover_avg_minutes || 20.0,
        facility.total_beds,
        facility.occupied_beds
      );

      const rationaleParts: string[] = [];
      if (hardCheck.matchedResourceCodes.length > 0) {
        rationaleParts.push(`Secured bundle: ${hardCheck.matchedResourceCodes.join(', ')}`);
      }
      rationaleParts.push(`Travel time: ${travel.durationMinutes} min (${travel.distanceKm} km)`);
      rationaleParts.push(`Occupancy: ${Math.round((facility.occupied_beds / facility.total_beds) * 100)}%`);

      results.push({
        facility,
        hardConstraintsPassed: true,
        travelTimeMinutes: travel.durationMinutes,
        distanceKm: travel.distanceKm,
        compositeScore: scoring.compositeScore,
        breakdown: scoring.breakdown,
        matchedResourceIds: hardCheck.matchedResourceIds,
        rationale: rationaleParts.join(' | '),
      });
    }

    // Sort by composite score descending (viable first, then highest scoring)
    results.sort((a, b) => b.compositeScore - a.compositeScore);
    return results;
  }

  /**
   * Phase 1 Binary Hard Constraint Evaluator
   */
  private checkHardConstraints(
    req: RequiredResources,
    availableResources: CapacityResource[],
    travelMinutes: number,
    maxPermissibleMinutes: number
  ): { passed: boolean; reason?: string; matchedResourceIds: string[]; matchedResourceCodes: string[] } {
    const matchedResourceIds: string[] = [];
    const matchedResourceCodes: string[] = [];

    // 1. Isochrone threshold
    if (travelMinutes > maxPermissibleMinutes) {
      return {
        passed: false,
        reason: `Exceeds max travel threshold (${travelMinutes} min > ${maxPermissibleMinutes} min)`,
        matchedResourceIds: [],
        matchedResourceCodes: [],
      };
    }

    // 2. Bed Tier requirement (e.g. RESUSCITATION)
    if (req.bed_tier) {
      const bed = availableResources.find(
        (r) => r.resource_type === 'BED' && r.sub_type === req.bed_tier
      );
      if (!bed) {
        return {
          passed: false,
          reason: `Required bed tier '${req.bed_tier}' unavailable or occupied`,
          matchedResourceIds: [],
          matchedResourceCodes: [],
        };
      }
      matchedResourceIds.push(bed.id);
      matchedResourceCodes.push(bed.identifier_code);
    }

    // 3. Operating Theatre requirement
    if (req.facilities?.includes('OPERATING_THEATRE')) {
      const theatre = availableResources.find((r) => r.resource_type === 'OPERATING_THEATRE');
      if (!theatre) {
        return {
          passed: false,
          reason: 'Operating theatre is OFFLINE or occupied',
          matchedResourceIds: [],
          matchedResourceCodes: [],
        };
      }
      matchedResourceIds.push(theatre.id);
      matchedResourceCodes.push(theatre.identifier_code);
    }

    // 4. Specialist requirement
    if (req.specialties && req.specialties.length > 0) {
      for (const spec of req.specialties) {
        const doc = availableResources.find(
          (r) => r.resource_type === 'SPECIALIST' && r.sub_type === spec
        );
        if (!doc) {
          return {
            passed: false,
            reason: `Mandatory specialist '${spec}' not on-site/available`,
            matchedResourceIds: [],
            matchedResourceCodes: [],
          };
        }
        matchedResourceIds.push(doc.id);
        matchedResourceCodes.push(doc.identifier_code);
      }
    }

    // 5. Blood stock requirement
    if (req.blood_units && req.blood_units.length > 0) {
      for (const bu of req.blood_units) {
        const blood = availableResources.find(
          (r) =>
            r.resource_type === 'BLOOD_STOCK' &&
            r.sub_type.includes(bu.blood_group) &&
            r.units_in_stock >= bu.quantity
        );
        if (!blood) {
          return {
            passed: false,
            reason: `Insufficient blood stock for '${bu.blood_group}' (${bu.quantity} units requested)`,
            matchedResourceIds: [],
            matchedResourceCodes: [],
          };
        }
        matchedResourceIds.push(blood.id);
        matchedResourceCodes.push(`${bu.quantity}x ${blood.identifier_code}`);
      }
    }

    // 6. Oxygen requirement
    if (req.high_flow_oxygen) {
      const o2 = availableResources.find(
        (r) => r.resource_type === 'OXYGEN_SUPPLY' && r.status === 'AVAILABLE'
      );
      if (!o2) {
        return {
          passed: false,
          reason: 'High-flow oxygen supply unavailable',
          matchedResourceIds: [],
          matchedResourceCodes: [],
        };
      }
      matchedResourceIds.push(o2.id);
      matchedResourceCodes.push(o2.identifier_code);
    }

    return {
      passed: true,
      matchedResourceIds,
      matchedResourceCodes,
    };
  }

  /**
   * Phase 2 Multi-Criteria Decision Analysis (MCDA) Scoring
   * Score = 0.45 * S_travel + 0.30 * S_cap + 0.15 * S_handover - P_congestion
   */
  private calculateMCDAScore(
    travelMinutes: number,
    maxTriageMinutes: number,
    distanceKm: number,
    req: RequiredResources,
    availableResources: CapacityResource[],
    avgHandoverMinutes: number,
    totalBeds: number,
    occupiedBeds: number
  ): { compositeScore: number; breakdown: any } {
    // Travel score (w_t = 0.45)
    const travelScore = Math.max(0, 100 * (1 - travelMinutes / maxTriageMinutes));

    // Capacity redundancy buffer score (w_c = 0.30)
    // Reward having multiple backup beds and blood units
    let totalStockBuffer = 0;
    for (const r of availableResources) {
      totalStockBuffer += r.units_in_stock || 1;
    }
    const capacityScore = Math.min(100, Math.max(20, totalStockBuffer * 8));

    // Handover velocity score (w_h = 0.15, max 45 min)
    const hMax = 45.0;
    const handoverScore = Math.max(0, 100 * (1 - avgHandoverMinutes / hMax));

    // Overcrowding congestion penalty (lambda = 10.0, quadratic)
    const occupancyRatio = Math.min(1.0, Math.max(0, occupiedBeds / (totalBeds || 1)));
    const congestionPenalty = Math.round(10.0 * Math.pow(occupancyRatio, 2) * 10) / 10;

    const rawComposite =
      0.45 * travelScore +
      0.30 * capacityScore +
      0.15 * handoverScore -
      congestionPenalty;

    const compositeScore = Math.round(Math.max(0, Math.min(100, rawComposite)) * 10) / 10;

    return {
      compositeScore,
      breakdown: {
        travel_time_minutes: travelMinutes,
        distance_km: distanceKm,
        travel_score: Math.round(travelScore * 10) / 10,
        capacity_score: Math.round(capacityScore * 10) / 10,
        handover_score: Math.round(handoverScore * 10) / 10,
        congestion_penalty: congestionPenalty,
      },
    };
  }

  private getMaxTravelTimeMinutes(priority: string): number {
    switch (priority) {
      case 'CRITICAL':
        return 60; // 1 Golden hour
      case 'EMERGENT':
        return 90;
      case 'URGENT':
        return 120;
      default:
        return 180;
    }
  }
}

export const matchingEngine = new MatchingEngine();
