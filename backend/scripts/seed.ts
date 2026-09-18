import { pool, checkDatabaseConnection } from '../src/infrastructure/database.js';

export async function seedDatabase() {
  console.log('----------------------------------------------------');
  console.log('🌱 ReferralOS: Seeding Regional Network Dataset...');
  console.log('----------------------------------------------------');

  const health = await checkDatabaseConnection();
  if (!health.ok) {
    console.error('❌ Could not connect to database for seeding.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clean existing records (in reverse dependency order)
    console.log('🧹 Cleaning previous seed data...');
    await client.query('DELETE FROM tracking_events');
    await client.query('DELETE FROM transport_assignments');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM referrals');
    await client.query('DELETE FROM patients');
    await client.query('DELETE FROM capacity_resources');
    await client.query('DELETE FROM facilities');

    // 2. Insert Facilities
    console.log('🏥 Inserting Regional Facilities...');
    const facilities = [
      {
        id: 'fac_phc_st_marys',
        name: "St. Mary's Primary Health Centre",
        code: 'SMPHC-RUR-01',
        tier: 'PRIMARY',
        lat: 6.5244,
        lng: 3.3792,
        address: '14 Rural District Road, St. Mary Community',
        phone: '+2348030000001',
        status: 'OPERATIONAL',
        totalBeds: 20,
        occupiedBeds: 8,
        handoverAvg: 10.0,
      },
      {
        id: 'fac_hosp_a_district',
        name: 'Hospital A (District General)',
        code: 'DGH-METRO-01',
        tier: 'SECONDARY',
        lat: 6.545,
        lng: 3.36,
        address: '102 Metro Expressway, District North',
        phone: '+2348030000002',
        status: 'OPERATIONAL',
        totalBeds: 120,
        occupiedBeds: 78,
        handoverAvg: 28.0,
      },
      {
        id: 'fac_hosp_b_specialist',
        name: 'Hospital B (Regional Specialist)',
        code: 'RSH-REG-02',
        tier: 'TERTIARY',
        lat: 6.6,
        lng: 3.34,
        address: '45 Apex Avenue, Central Medical City',
        phone: '+2348030000003',
        status: 'OPERATIONAL',
        totalBeds: 250,
        occupiedBeds: 142,
        handoverAvg: 16.0,
      },
      {
        id: 'fac_hosp_c_teaching',
        name: 'Hospital C (University Teaching Hospital)',
        code: 'UTH-TERT-03',
        tier: 'QUATERNARY',
        lat: 6.518,
        lng: 3.45,
        address: '1 University Teaching Way, Victoria Island',
        phone: '+2348030000004',
        status: 'OPERATIONAL',
        totalBeds: 500,
        occupiedBeds: 310,
        handoverAvg: 22.0,
      },
    ];

    for (const f of facilities) {
      await client.query(
        `INSERT INTO facilities 
        (id, name, facility_code, tier, latitude, longitude, address, contact_emergency_phone, operational_status, total_beds, occupied_beds, handover_avg_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          f.id,
          f.name,
          f.code,
          f.tier,
          f.lat,
          f.lng,
          f.address,
          f.phone,
          f.status,
          f.totalBeds,
          f.occupiedBeds,
          f.handoverAvg,
        ]
      );
    }

    // 3. Insert Capacity Resources
    console.log('🩺 Inserting Clinical Resources & Operating States...');
    const resources = [
      // Hospital A resources (NOTE: Theatre is intentionally OFFLINE to trigger hard constraint rejection in PPH demo)
      {
        id: 'res_hosp_a_theatre_01',
        facility_id: 'fac_hosp_a_district',
        type: 'OPERATING_THEATRE',
        sub_type: 'EMERGENCY_LAPAROTOMY',
        code: 'THEATRE-01',
        status: 'OFFLINE', // Out of service for decontamination
        stock: 1,
        metadata: { reason: 'Decontamination following septic peritonitis case' },
      },
      {
        id: 'res_hosp_a_theatre_02',
        facility_id: 'fac_hosp_a_district',
        type: 'OPERATING_THEATRE',
        sub_type: 'GENERAL_SURGERY',
        code: 'THEATRE-02',
        status: 'OFFLINE',
        stock: 1,
        metadata: { reason: 'HVAC repair' },
      },
      {
        id: 'res_hosp_a_bed_01',
        facility_id: 'fac_hosp_a_district',
        type: 'BED',
        sub_type: 'RESUSCITATION',
        code: 'BAY-A1',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_a_spec_01',
        facility_id: 'fac_hosp_a_district',
        type: 'SPECIALIST',
        sub_type: 'OBSTETRICIAN_GYNAECOLOGIST',
        code: 'DR-IDRIS',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_a_blood_oneg',
        facility_id: 'fac_hosp_a_district',
        type: 'BLOOD_STOCK',
        sub_type: 'O_NEGATIVE_PRBC',
        code: 'BLOOD-ONEG',
        status: 'AVAILABLE',
        stock: 4,
      },

      // Hospital B resources (Primary ideal match: all clinical resources available)
      {
        id: 'res_hosp_b_resus_02',
        facility_id: 'fac_hosp_b_specialist',
        type: 'BED',
        sub_type: 'RESUSCITATION',
        code: 'RESUS-02',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_b_theatre_03',
        facility_id: 'fac_hosp_b_specialist',
        type: 'OPERATING_THEATRE',
        sub_type: 'EMERGENCY_LAPAROTOMY',
        code: 'THEATRE-03',
        status: 'AVAILABLE', // Sterile and open
        stock: 1,
        metadata: { positive_pressure: true, sterile: true },
      },
      {
        id: 'res_hosp_b_spec_alabi',
        facility_id: 'fac_hosp_b_specialist',
        type: 'SPECIALIST',
        sub_type: 'OBSTETRICIAN_GYNAECOLOGIST',
        code: 'DR-ALABI',
        status: 'AVAILABLE',
        stock: 1,
        metadata: { on_site: true },
      },
      {
        id: 'res_hosp_b_blood_oneg',
        facility_id: 'fac_hosp_b_specialist',
        type: 'BLOOD_STOCK',
        sub_type: 'O_NEGATIVE_PRBC',
        code: 'BLOOD-ONEG',
        status: 'AVAILABLE',
        stock: 4,
      },
      {
        id: 'res_hosp_b_o2_central',
        facility_id: 'fac_hosp_b_specialist',
        type: 'OXYGEN_SUPPLY',
        sub_type: 'HIGH_FLOW',
        code: 'O2-CENTRAL',
        status: 'AVAILABLE',
        stock: 20,
      },

      // Hospital C resources (Tertiary standby / failover target)
      {
        id: 'res_hosp_c_resus_04',
        facility_id: 'fac_hosp_c_teaching',
        type: 'BED',
        sub_type: 'RESUSCITATION',
        code: 'RESUS-04',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_c_theatre_05',
        facility_id: 'fac_hosp_c_teaching',
        type: 'OPERATING_THEATRE',
        sub_type: 'EMERGENCY_LAPAROTOMY',
        code: 'THEATRE-05',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_c_spec_adeyemi',
        facility_id: 'fac_hosp_c_teaching',
        type: 'SPECIALIST',
        sub_type: 'OBSTETRICIAN_GYNAECOLOGIST',
        code: 'DR-ADEYEMI',
        status: 'AVAILABLE',
        stock: 1,
      },
      {
        id: 'res_hosp_c_blood_oneg',
        facility_id: 'fac_hosp_c_teaching',
        type: 'BLOOD_STOCK',
        sub_type: 'O_NEGATIVE_PRBC',
        code: 'BLOOD-ONEG',
        status: 'AVAILABLE',
        stock: 8,
      },
      {
        id: 'res_hosp_c_o2_central',
        facility_id: 'fac_hosp_c_teaching',
        type: 'OXYGEN_SUPPLY',
        sub_type: 'HIGH_FLOW',
        code: 'O2-CENTRAL',
        status: 'AVAILABLE',
        stock: 40,
      },
    ];

    for (const r of resources) {
      await client.query(
        `INSERT INTO capacity_resources 
        (id, facility_id, resource_type, sub_type, identifier_code, status, units_in_stock, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          r.id,
          r.facility_id,
          r.type,
          r.sub_type,
          r.code,
          r.status,
          r.stock,
          JSON.stringify(r.metadata || {}),
        ]
      );
    }

    // 4. Insert Standardized Patient: Amara Okoro (PPH)
    console.log('👤 Inserting Patient Profile (Amara Okoro)...');
    await client.query(
      `INSERT INTO patients 
      (id, national_health_id, full_name, date_of_birth, gender, blood_group, known_allergies, emergency_contact)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'pat_pph_amara_okoro',
        'NIN-7829103821',
        'Amara Okoro',
        '1998-05-14',
        'FEMALE',
        'O_NEGATIVE',
        ['PENICILLIN'],
        JSON.stringify({
          name: 'Chinedu Okoro',
          relationship: 'Husband',
          phone: '+2348012345678',
        }),
      ]
    );

    await client.query('COMMIT');

    console.log('----------------------------------------------------');
    console.log('✅ Seed complete: 4 Facilities, 15 Capacity Resources, 1 Patient.');
    console.log('----------------------------------------------------');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDatabase().then(() => pool.end());
}
