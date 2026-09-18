import test from 'node:test';
import assert from 'node:assert/strict';
import { referralService } from '../../src/services/referral.service.js';
import { lockService } from '../../src/services/lock.service.js';
import { transportService } from '../../src/services/transport.service.js';
import { capacityService } from '../../src/services/capacity.service.js';
import { failoverWatcherService } from '../../src/services/failover-watcher.service.js';
import { query, pool } from '../../src/infrastructure/database.js';
import { closeRedisClients } from '../../src/infrastructure/redis.js';
import { seedDatabase } from '../../scripts/seed.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('Integration Test: Automated Mid-Transit Failover & Rerouting', async () => {
  await seedDatabase();
  await failoverWatcherService.start();

  // 1. Create active referral
  const referral = await referralService.createReferral({
    patientId: 'pat_pph_amara_okoro',
    referringFacilityId: 'fac_phc_st_marys',
    triagePriority: 'CRITICAL',
    chiefComplaint: 'Severe Acute Obstetric Hemorrhage',
    requiredResources: {
      bed_tier: 'RESUSCITATION',
      specialties: ['OBSTETRICIAN_GYNAECOLOGIST'],
      facilities: ['OPERATING_THEATRE'],
      blood_units: [{ blood_group: 'O_NEGATIVE', component: 'PRBC', quantity: 2 }],
      high_flow_oxygen: true,
      transport_type: 'ALS',
    },
    initialVitals: { bp_systolic: 75, bp_diastolic: 45, heart_rate: 135, spo2: 92 },
  });

  // Make sure Theatre 3 is AVAILABLE initially
  await capacityService.updateResourceStatus('res_hosp_b_theatre_03', 'AVAILABLE');

  // 2. Lock Hospital B resources
  const resv = await lockService.createReservation({
    referralId: referral.id,
    facilityId: 'fac_hosp_b_specialist',
    resourceIds: [
      'res_hosp_b_resus_02',
      'res_hosp_b_theatre_03',
      'res_hosp_b_blood_oneg',
      'res_hosp_b_spec_alabi',
    ],
    ttlMinutes: 45,
  });
  assert.equal(resv.status, 'ACTIVE');

  // 3. Dispatch transport and stream live GPS
  const transport = await transportService.assignTransport({
    referralId: referral.id,
    vehicleId: 'AMB_TEST_09',
    vehicleType: 'ALS',
  });

  await transportService.recordTelemetry({
    transportAssignmentId: transport.id,
    referralId: referral.id,
    latitude: 6.535,
    longitude: 3.37,
    speedKmh: 65.0,
    patientVitals: { bp_systolic: 80, bp_diastolic: 50, heart_rate: 125, spo2: 95 },
  });

  // 4. Trigger sudden mid-transit capacity outage at Hospital B (Theatre drops offline)
  await capacityService.updateResourceStatus('res_hosp_b_theatre_03', 'OFFLINE', {
    reason: 'Sterilizer power fault',
  });

  // Wait for failover watcher event loop processing
  await sleep(4000);

  // 5. Verify the failover watcher invalidated Hospital B and locked Hospital C
  const updatedReferral = await referralService.getReferralById(referral.id);

  assert.equal(
    updatedReferral.status,
    'REROUTED',
    'Referral status must transition to REROUTED'
  );
  assert.equal(
    updatedReferral.assigned_facility_id,
    'fac_hosp_c_teaching',
    'Referral must be automatically reassigned to Hospital C'
  );

  // Verify previous reservation is marked INVALIDATED
  const oldResv = await query('SELECT status FROM reservations WHERE id = $1', [resv.id]);
  assert.equal(
    oldResv.rows[0].status,
    'INVALIDATED',
    'Original compromised reservation must be marked INVALIDATED'
  );

  // Verify a new active reservation exists at Hospital C
  const newResv = await query(
    `SELECT * FROM reservations 
     WHERE referral_id = $1 AND facility_id = 'fac_hosp_c_teaching' AND status = 'ACTIVE'`,
    [referral.id]
  );
  assert.equal(newResv.rows.length, 1, 'A new active reservation must be secured at Hospital C');

  // Clean up: commit the new reservation and close listeners
  await lockService.commitReservation(newResv.rows[0].id);
  await failoverWatcherService.stop();
  await closeRedisClients();
  await pool.end();
  process.exit(0);
});
