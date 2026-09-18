import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchingEngine } from '../../src/services/matching/engine.js';
import { CapacityResource, Referral } from '../../src/models/types.js';

test('Matching Logic: Binary filter rejects facility when Operating Theatre is OFFLINE', () => {
  const engine = new MatchingEngine();

  const mockReferral: Partial<Referral> = {
    id: 'ref_test_01',
    triage_priority: 'CRITICAL',
    required_resources: {
      bed_tier: 'RESUSCITATION',
      facilities: ['OPERATING_THEATRE'],
      transport_type: 'ALS',
    },
  };

  const availableResources: CapacityResource[] = [
    {
      id: 'res_bed_01',
      facility_id: 'fac_a',
      resource_type: 'BED',
      sub_type: 'RESUSCITATION',
      identifier_code: 'BED-01',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
    // No operating theatre
  ];

  const check = (engine as any).checkHardConstraints(
    mockReferral.required_resources,
    availableResources,
    25, // 25 min travel
    60  // 60 min max
  );

  assert.equal(check.passed, false);
  assert.match(check.reason, /Operating theatre is OFFLINE/);
});

test('Matching Logic: Binary filter rejects facility when Blood Stock is insufficient', () => {
  const engine = new MatchingEngine();

  const req = {
    bed_tier: 'RESUSCITATION' as const,
    facilities: ['OPERATING_THEATRE'],
    blood_units: [{ blood_group: 'O_NEGATIVE', component: 'PRBC' as const, quantity: 4 }],
    transport_type: 'ALS' as const,
  };

  const availableResources: CapacityResource[] = [
    {
      id: 'res_bed_01',
      facility_id: 'fac_a',
      resource_type: 'BED',
      sub_type: 'RESUSCITATION',
      identifier_code: 'BED-01',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res_th_01',
      facility_id: 'fac_a',
      resource_type: 'OPERATING_THEATRE',
      sub_type: 'EMERGENCY',
      identifier_code: 'THEATRE-01',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res_blood_01',
      facility_id: 'fac_a',
      resource_type: 'BLOOD_STOCK',
      sub_type: 'O_NEGATIVE_PRBC',
      identifier_code: 'BLOOD-ONEG',
      status: 'AVAILABLE',
      units_in_stock: 1, // Only 1 in stock, but 4 requested!
      updated_at: new Date().toISOString(),
    },
  ];

  const check = (engine as any).checkHardConstraints(req, availableResources, 20, 60);

  assert.equal(check.passed, false);
  assert.match(check.reason, /Insufficient blood stock/);
});

test('Matching Logic: Binary filter passes when all clinical requirements are satisfied', () => {
  const engine = new MatchingEngine();

  const req = {
    bed_tier: 'RESUSCITATION' as const,
    facilities: ['OPERATING_THEATRE'],
    blood_units: [{ blood_group: 'O_NEGATIVE', component: 'PRBC' as const, quantity: 2 }],
    specialties: ['OBSTETRICIAN_GYNAECOLOGIST'],
    transport_type: 'ALS' as const,
  };

  const availableResources: CapacityResource[] = [
    {
      id: 'res_bed_01',
      facility_id: 'fac_b',
      resource_type: 'BED',
      sub_type: 'RESUSCITATION',
      identifier_code: 'BED-01',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res_th_01',
      facility_id: 'fac_b',
      resource_type: 'OPERATING_THEATRE',
      sub_type: 'EMERGENCY',
      identifier_code: 'THEATRE-01',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res_blood_01',
      facility_id: 'fac_b',
      resource_type: 'BLOOD_STOCK',
      sub_type: 'O_NEGATIVE_PRBC',
      identifier_code: 'BLOOD-ONEG',
      status: 'AVAILABLE',
      units_in_stock: 4, // 4 available, 2 requested -> Satisfied
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res_spec_01',
      facility_id: 'fac_b',
      resource_type: 'SPECIALIST',
      sub_type: 'OBSTETRICIAN_GYNAECOLOGIST',
      identifier_code: 'DR-SMITH',
      status: 'AVAILABLE',
      units_in_stock: 1,
      updated_at: new Date().toISOString(),
    },
  ];

  const check = (engine as any).checkHardConstraints(req, availableResources, 35, 60);

  assert.equal(check.passed, true);
  assert.equal(check.matchedResourceIds.length, 4);
});

test('Matching Logic: MCDA score correctly computes multi-factor formula', () => {
  const engine = new MatchingEngine();

  const scoreResult = (engine as any).calculateMCDAScore(
    30,  // travel minutes
    60,  // max minutes
    25,  // distance km
    {} as any,
    [
      { units_in_stock: 4 },
      { units_in_stock: 2 },
    ],
    15.0, // handover minutes
    200,  // total beds
    100   // occupied beds (50% occupancy)
  );

  assert.ok(scoreResult.compositeScore > 0 && scoreResult.compositeScore <= 100);
  assert.ok(scoreResult.breakdown.travel_score > 0);
  assert.ok(scoreResult.breakdown.congestion_penalty >= 0);
});
