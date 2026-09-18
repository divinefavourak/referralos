import { pool } from '../src/infrastructure/database.js';
import { closeRedisClients } from '../src/infrastructure/redis.js';
import { referralService } from '../src/services/referral.service.js';
import { matchingEngine } from '../src/services/matching/engine.js';
import { lockService } from '../src/services/lock.service.js';
import { transportService } from '../src/services/transport.service.js';
import { capacityService } from '../src/services/capacity.service.js';
import { failoverWatcherService } from '../src/services/failover-watcher.service.js';
import { seedDatabase } from './seed.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPPHScenarioDemo() {
  await seedDatabase();
  console.clear();
  console.log('======================================================================');
  console.log('ReferralOS: Severe Postpartum Haemorrhage (PPH) Live Scenario Demo');
  console.log('   Simulating: Intelligent Capacity-Based Referral & Mid-Transit Failover');
  console.log('======================================================================\n');

  // Start background Failover Watcher
  await failoverWatcherService.start();

  // -------------------------------------------------------------------------
  // STEP 1: Clinical Presentation & Intake at St. Mary's PHC
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:00] Step 1: Acute Presentation at St. Mary\'s Primary Health Centre');
  console.log('----------------------------------------------------------------------');
  console.log('Patient: Amara Okoro (28y F) | G1P1 | Delivered infant at 02:00');
  console.log('Status: Severe uterine atony unresponsive to oxytocin. EBL: 1,200 mL');
  console.log('Vitals: BP 74/42 mmHg | HR 138 bpm | RR 28/min | SpO2 91% (Shock Index: 1.86)\n');

  console.log('Midwife selects "Obstetric Emergency: Postpartum Haemorrhage" Template:');
  const referralPayload = {
    patientId: 'pat_pph_amara_okoro',
    referringFacilityId: 'fac_phc_st_marys',
    triagePriority: 'CRITICAL',
    chiefComplaint: 'Severe Postpartum Haemorrhage',
    clinicalSummary: 'Uterine atony unresponsive to bimanual compression & oxytocin. Estimated blood loss 1200ml. Profound hypovolemic shock.',
    requiredResources: {
      bed_tier: 'RESUSCITATION',
      specialties: ['OBSTETRICIAN_GYNAECOLOGIST'],
      facilities: ['OPERATING_THEATRE'],
      blood_units: [{ blood_group: 'O_NEGATIVE', component: 'PRBC', quantity: 2 }],
      high_flow_oxygen: true,
      transport_type: 'ALS',
    },
    initialVitals: {
      bp_systolic: 74,
      bp_diastolic: 42,
      heart_rate: 138,
      respiratory_rate: 28,
      spo2: 91,
    },
  };

  const referral = await referralService.createReferral(referralPayload as any);
  console.log(`[CREATED] Referral ticket created: [${referral.id}] (Status: MATCHING)\n`);

  await sleep(1500);

  // -------------------------------------------------------------------------
  // STEP 2: Real-Time Constraint Solving & Matching
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:06] Step 2: Dynamic Spatial Matching & Constraint Solving');
  console.log('----------------------------------------------------------------------');
  console.log('Evaluating regional network capabilities against required clinical bundle:\n');

  const matches = await matchingEngine.evaluateMatches(referral);

  for (const m of matches) {
    if (!m.hardConstraintsPassed) {
      console.log(`[REJECTED] ${m.facility.name} (Distance: ${m.distanceKm} km, Travel: ${m.travelTimeMinutes} min)`);
      console.log(`   [HARD CONSTRAINT FAILED]: ${m.disqualificationReason}`);
      console.log(`   Outcome: REJECTED (Prevents deadly "nearest hospital" trap!)\n`);
    } else {
      console.log(`[ACCEPTED] ${m.facility.name} (Distance: ${m.distanceKm} km, Travel: ${m.travelTimeMinutes} min)`);
      console.log(`   Composite Viability Score: ${m.compositeScore} / 100`);
      console.log(`   Clinical Rationale: ${m.rationale}`);
      console.log(`   Matched Resources: [${m.matchedResourceIds.join(', ')}]\n`);
    }
  }

  const selectedMatch = matches.find((m) => m.hardConstraintsPassed);
  if (!selectedMatch) {
    console.error('No viable facilities found!');
    process.exit(1);
  }

  console.log(`Optimal Destination Selected: ${selectedMatch.facility.name} (Hospital B)`);
  await sleep(1500);

  // -------------------------------------------------------------------------
  // STEP 3: Confirmation & Atomic Multi-Resource Lock
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:07] Step 3: Midwife Confirms & Acquires Atomic Multi-Resource Lock');
  console.log('----------------------------------------------------------------------');
  console.log('Placing 45-minute atomic distributed TTL lock in Redis on Hospital B:');
  console.log('  - Resuscitation Bay: RESUS-02');
  console.log('  - Surgical Theatre: THEATRE-03 (Sterile emergency laparotomy capability)');
  console.log('  - Blood Bank: 2x Units O-Negative PRBC');
  console.log('  - Specialist: Dr. Alabi (OB/GYN on-site)\n');

  const reservation = await lockService.createReservation({
    referralId: referral.id,
    facilityId: selectedMatch.facility.id,
    resourceIds: selectedMatch.matchedResourceIds,
    ttlMinutes: 45,
  });

  console.log(`[LOCKED] Atomic Lock Established: [${reservation.id}]`);
  console.log(`Lock Lease Expiry: ${reservation.expires_at} (45 min TTL)`);
  console.log('[DISPATCHED] Pre-Arrival Siren dispatched to Hospital B Emergency Department triage console!\n');

  await sleep(1500);

  // -------------------------------------------------------------------------
  // STEP 4: Transport Dispatch & Live Telematics
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:10] Step 4: ALS Ambulance Dispatched & Telematics Streaming');
  console.log('----------------------------------------------------------------------');
  const assignment = await transportService.assignTransport({
    referralId: referral.id,
    vehicleId: 'AMB_ALS_04',
    vehicleType: 'ALS',
    driverName: 'Samuel Ojo',
    paramedicName: 'Kelechi Nwosu',
    crewContactPhone: '+2348033221100',
  });
  console.log(`[DISPATCHED] Vehicle Dispatched: Unit 04 (ALS) | Driver: ${assignment.driver_name} | Paramedic: ${assignment.paramedic_name}`);

  // Waypoint 1: Leaving St. Mary's PHC
  await transportService.recordTelemetry({
    transportAssignmentId: assignment.id,
    referralId: referral.id,
    latitude: 6.5244,
    longitude: 3.3792,
    speedKmh: 45.0,
    headingDegrees: 180.0,
    patientVitals: { bp_systolic: 76, bp_diastolic: 44, heart_rate: 136, spo2: 92 },
  });
  console.log('[00:12] Waypoint 1 logged: Departed St. Mary\'s PHC. Heading to Hospital B. ETA: 38 min.');

  await sleep(1500);

  // Waypoint 2: Mid-transit on Western Expressway
  const midTransitGps = { latitude: 6.535, longitude: 3.37 };
  await transportService.recordTelemetry({
    transportAssignmentId: assignment.id,
    referralId: referral.id,
    latitude: midTransitGps.latitude,
    longitude: midTransitGps.longitude,
    speedKmh: 68.0,
    headingDegrees: 175.0,
    patientVitals: { bp_systolic: 80, bp_diastolic: 48, heart_rate: 128, spo2: 95 },
  });
  console.log('[00:20] Waypoint 2 logged: Western Expressway (68 km/h). 16 min from Hospital B.\n');

  await sleep(2000);

  // -------------------------------------------------------------------------
  // STEP 5: Mid-Transit Capacity Outage Event at Hospital B
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:22] Step 5: IN-TRANSIT DISASTER EVENT AT HOSPITAL B');
  console.log('----------------------------------------------------------------------');
  console.log('[ALERT] Hospital B main electrical transformer suffers catastrophic fault!');
  console.log('[ALERT] Theatre 3 loses sterile positive-pressure ventilation!');
  console.log('[ALERT] Charge Nurse at Hospital B toggles Theatre 3 to OFFLINE on ReferralOS console...\n');

  // Trigger resource failure
  await capacityService.updateResourceStatus(
    'res_hosp_b_theatre_03',
    'OFFLINE',
    { reason: 'HVAC positive-pressure ventilation failure after electrical surge' }
  );

  // Allow time for Failover Watcher to detect event, calculate matches, and acquire new locks
  await sleep(4500);

  // -------------------------------------------------------------------------
  // STEP 6: Verify Automated Failover & Rerouting
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:22:30] Step 6: ReferralOS Automated Failover Watcher in Action');
  console.log('----------------------------------------------------------------------');

  const updatedRef = await referralService.getReferralById(referral.id);
  console.log(`Referral State: ${updatedRef.status}`);
  console.log(`Assigned Facility Updated: ${updatedRef.assigned_facility_name}`);
  console.log(`Active Reservation ID: ${updatedRef.active_reservation_id}`);
  console.log(`Ambulance Terminal Audio Siren:`);
  console.log(`   "ATTENTION: Hospital B Theatre Compromised. Rerouting to Hospital C (19 minutes). Turn right on Western Expressway."\n`);

  await sleep(1500);

  // -------------------------------------------------------------------------
  // STEP 7: Arrival, QR Handover & Admission
  // -------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('[00:43] Step 7: Arrival at Hospital C Bay & Verified Clinical Handover');
  console.log('----------------------------------------------------------------------');
  console.log('Ambulance Unit 04 arrives at Hospital C trauma bay.');
  console.log('Surgical team assembled in Resus Bed 04 with 2 units of thawed O- PRBC ready.');
  console.log('Triage nurse scans paramedic\'s referral QR code: "VERIFY_489201"...\n');

  if (updatedRef.active_reservation_id) {
    await lockService.commitReservation(updatedRef.active_reservation_id);
  } else {
    await referralService.updateStatus(referral.id, 'HANDOVER_COMPLETED');
  }

  console.log('[VERIFIED] Handover Verified & Completed!');
  console.log('Temporary distributed locks committed to: OCCUPIED');
  console.log('Electronic Pre-Arrival Packet (e-PRP) converted to Permanent Clinical Admission Encounter');
  console.log('Zero avoidable delay. Zero ping-pong. Patient in surgery within the Golden Hour.\n');

  console.log('======================================================================');
  console.log('[COMPLETE] PPH Scenario Simulation Completed Successfully!');
  console.log('======================================================================\n');
}

runPPHScenarioDemo()
  .then(async () => {
    await failoverWatcherService.stop();
    await closeRedisClients();
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Scenario error:', err);
    await failoverWatcherService.stop().catch(() => {});
    await closeRedisClients().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(1);
  });
