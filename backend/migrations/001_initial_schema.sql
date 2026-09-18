-- ReferralOS Core Relational & Geospatial Schema
-- Supports PostgreSQL 16 + PostGIS

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Facilities Table
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    facility_code VARCHAR(64) UNIQUE NOT NULL,
    tier VARCHAR(32) NOT NULL CHECK (tier IN ('PRIMARY', 'SECONDARY', 'TERTIARY', 'QUATERNARY')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    district VARCHAR(100),
    state_province VARCHAR(100),
    contact_general_phone VARCHAR(50),
    contact_emergency_phone VARCHAR(50) NOT NULL,
    contact_emergency_email VARCHAR(100),
    operational_status VARCHAR(32) NOT NULL DEFAULT 'OPERATIONAL' CHECK (operational_status IN ('OPERATIONAL', 'DIVERTING', 'CLOSED', 'EMERGENCY_ONLY')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    total_beds INTEGER NOT NULL DEFAULT 50,
    occupied_beds INTEGER NOT NULL DEFAULT 0,
    handover_avg_minutes DOUBLE PRECISION DEFAULT 20.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on facility operational status and spatial point
CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(operational_status, is_active);
CREATE INDEX IF NOT EXISTS idx_facilities_coords ON facilities(latitude, longitude);

-- 3. Capacity Resources Table
CREATE TABLE IF NOT EXISTS capacity_resources (
    id VARCHAR(64) PRIMARY KEY,
    facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    resource_type VARCHAR(64) NOT NULL CHECK (resource_type IN ('BED', 'SPECIALIST', 'OPERATING_THEATRE', 'BLOOD_STOCK', 'OXYGEN_SUPPLY', 'EQUIPMENT')),
    sub_type VARCHAR(100) NOT NULL,
    identifier_code VARCHAR(100) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'OFFLINE')),
    units_in_stock INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_facility ON capacity_resources(facility_id);
CREATE INDEX IF NOT EXISTS idx_resources_type_status ON capacity_resources(resource_type, status);
CREATE INDEX IF NOT EXISTS idx_resources_sub_type ON capacity_resources(sub_type);

-- 4. Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    national_health_id VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(20),
    known_allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    emergency_contact JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL REFERENCES patients(id),
    referring_facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id),
    assigned_facility_id VARCHAR(64) REFERENCES facilities(id),
    triage_priority VARCHAR(32) NOT NULL CHECK (triage_priority IN ('CRITICAL', 'EMERGENT', 'URGENT', 'SEMI_URGENT', 'NON_URGENT')),
    chief_complaint TEXT NOT NULL,
    clinical_summary TEXT,
    required_resources JSONB NOT NULL,
    initial_vitals JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'MATCHING', 'MATCHED', 'RESERVED', 'DISPATCHED', 'IN_TRANSIT', 'REROUTED', 'HANDOVER_COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_assigned ON referrals(assigned_facility_id);

-- 6. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY,
    referral_id VARCHAR(64) NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id),
    composite_score DOUBLE PRECISION NOT NULL,
    hard_constraints_satisfied BOOLEAN NOT NULL,
    breakdown JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'INVALIDATED', 'EXPIRED')),
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_referral ON matches(referral_id);

-- 7. Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR(64) PRIMARY KEY,
    referral_id VARCHAR(64) NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    match_id VARCHAR(64) REFERENCES matches(id),
    facility_id VARCHAR(64) NOT NULL REFERENCES facilities(id),
    locked_resource_ids TEXT[] NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMMITTED', 'EXPIRED', 'RELEASED', 'INVALIDATED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reservations_referral ON reservations(referral_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- 8. Transport Assignments Table
CREATE TABLE IF NOT EXISTS transport_assignments (
    id VARCHAR(64) PRIMARY KEY,
    referral_id VARCHAR(64) NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    vehicle_id VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(32) NOT NULL,
    driver_name VARCHAR(100),
    paramedic_name VARCHAR(100),
    crew_contact_phone VARCHAR(50),
    dispatch_status VARCHAR(64) NOT NULL DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_referral ON transport_assignments(referral_id);

-- 9. Tracking Events Table
CREATE TABLE IF NOT EXISTS tracking_events (
    id VARCHAR(64) PRIMARY KEY,
    transport_assignment_id VARCHAR(64) NOT NULL REFERENCES transport_assignments(id) ON DELETE CASCADE,
    referral_id VARCHAR(64) NOT NULL REFERENCES referrals(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed_kmh DOUBLE PRECISION,
    heading_degrees DOUBLE PRECISION,
    estimated_time_remaining_seconds INTEGER,
    patient_vitals JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_referral ON tracking_events(referral_id, timestamp DESC);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    payload JSONB,
    performed_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
