import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/infrastructure/database.js';
import { seedDatabase } from '../../scripts/seed.js';

test('Integration Test: Fastify API End-to-End Suite', async (t) => {
  await seedDatabase();
  const app = await buildApp();
  await app.ready();

  let createdReferralId: string;
  let matchedResourceIds: string[];
  let createdReservationId: string;
  let transportAssignmentId: string;

  await t.test('GET /health returns 200 and HEALTHY state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'HEALTHY');
    assert.equal(body.database.ok, true);
  });

  await t.test('GET /api/v1/facilities returns list of regional facilities', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/facilities',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);
  });

  await t.test('GET /api/v1/facilities/:id/capacity returns live clinical assets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/facilities/fac_hosp_b_specialist/capacity',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.facility_id, 'fac_hosp_b_specialist');
    assert.ok(Array.isArray(body.data.resources));
  });

  await t.test('POST /api/v1/referrals creates new acute referral ticket', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/referrals',
      payload: {
        patient_id: 'pat_pph_amara_okoro',
        referring_facility_id: 'fac_phc_st_marys',
        triage_priority: 'CRITICAL',
        chief_complaint: 'Severe Primary Postpartum Haemorrhage',
        clinical_summary: 'Blood loss >1000ml post-delivery. Immediate surgical exploration required.',
        required_resources: {
          bed_tier: 'RESUSCITATION',
          specialties: ['OBSTETRICIAN_GYNAECOLOGIST'],
          facilities: ['OPERATING_THEATRE'],
          blood_units: [{ blood_group: 'O_NEGATIVE', component: 'PRBC', quantity: 2 }],
          high_flow_oxygen: true,
          transport_type: 'ALS',
        },
        initial_vitals: {
          bp_systolic: 74,
          bp_diastolic: 42,
          heart_rate: 138,
          spo2: 91,
        },
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.referral_id);
    assert.equal(body.data.status, 'MATCHING');
    createdReferralId = body.data.referral_id;
  });

  await t.test('POST /api/v1/referrals/:id/matches returns ranked facilities', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/referrals/${createdReferralId}/matches`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.matches));

    // Hospital A must be rejected due to offline theatre
    const hospA = body.data.matches.find((m: any) => m.facility_id === 'fac_hosp_a_district');
    assert.ok(hospA);
    assert.equal(hospA.hard_constraints_satisfied, false);

    // Hospital B must be viable
    const hospB = body.data.matches.find((m: any) => m.facility_id === 'fac_hosp_b_specialist');
    assert.ok(hospB);
    assert.equal(hospB.hard_constraints_satisfied, true);
    assert.ok(hospB.composite_score > 50, `Composite score ${hospB.composite_score} must exceed 50`);
    matchedResourceIds = hospB.matched_resource_ids;
  });

  await t.test('POST /api/v1/reservations establishes atomic multi-resource distributed lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reservations',
      payload: {
        referral_id: createdReferralId,
        facility_id: 'fac_hosp_b_specialist',
        resource_ids: matchedResourceIds,
        ttl_minutes: 45,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.reservation_id);
    assert.equal(body.data.status, 'ACTIVE');
    createdReservationId = body.data.reservation_id;
  });

  await t.test('POST /api/v1/reservations rejects duplicate concurrent booking (409 Conflict)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reservations',
      payload: {
        referral_id: createdReferralId,
        facility_id: 'fac_hosp_b_specialist',
        resource_ids: matchedResourceIds, // Already locked!
        ttl_minutes: 45,
      },
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CAPACITY_LOCK_FAILED');
  });

  await t.test('POST /api/v1/transport/assign assigns ambulance unit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/assign',
      payload: {
        referral_id: createdReferralId,
        vehicle_id: 'AMB_04',
        vehicle_type: 'ALS',
        driver_name: 'Samuel Ojo',
        paramedic_name: 'Kelechi Nwosu',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    transportAssignmentId = body.data.id;
  });

  await t.test('POST /api/v1/transport/:id/telemetry records live GPS and vitals', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/transport/${transportAssignmentId}/telemetry`,
      payload: {
        referral_id: createdReferralId,
        latitude: 6.535,
        longitude: 3.37,
        speed_kmh: 65.0,
        patient_vitals: {
          bp_systolic: 80,
          bp_diastolic: 48,
          heart_rate: 130,
          spo2: 94,
        },
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.ok(body.data.estimated_time_remaining_seconds > 0);
  });

  await t.test('PATCH /api/v1/referrals/:id/status verifies clinical arrival and completes handover', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/referrals/${createdReferralId}/status`,
      payload: {
        status: 'HANDOVER_COMPLETED',
        verification_code: 'VERIFY_489201',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'HANDOVER_COMPLETED');
    assert.equal(body.data.handover_verified, true);
  });

  await app.close();
  await pool.end();
  process.exit(0);
});
