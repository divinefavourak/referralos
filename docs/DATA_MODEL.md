# ReferralOS: Data Model & Schema Specification

## 1. Entity-Relationship Overview

`mermaid
erDiagram
    FACILITY ||--o{ CAPACITY_RESOURCE : hosts
    FACILITY ||--o{ REFERRAL : refers_out
    FACILITY ||--o{ REFERRAL : receives_in
    PATIENT ||--o{ REFERRAL : subject_of
    REFERRAL ||--o{ MATCH : evaluates
    MATCH ||--o| RESERVATION : secures
    REFERRAL ||--o| TRANSPORT_ASSIGNMENT : transported_by
    TRANSPORT_ASSIGNMENT ||--o{ TRACKING_EVENT : generates
`

The ReferralOS domain model revolves around treating a medical transfer as an active, stateful transaction that links patients, clinical requirements, regional facilities, distributed resource locks, and real-time vehicle telematics.

---

## 2. Core Entities & JSON Schema Definitions

### 2.1 Facility
Represents an individual clinical node in the regional health network.

- **Primary Key:** id (UUIDv7 string)
- **Relationships:**
  - One-to-Many with CapacityResource
  - One-to-Many with Referral (as referring or receiving facility)

`json
{
  ": https://json-schema.org/draft/2020-12/schema,
 title: Facility,
 type: object,
 properties: {
 id: { type: string, description: Prefixed UUIDv7 (e.g., fac_01HJ8...) },
 name: { type: string, example: Apex Specialist Hospital },
 facility_code: { type: string, example: ASH-REG-04 },
 tier: {
 type: string,
 enum: [PRIMARY, SECONDARY, TERTIARY, QUATERNARY]
 },
 location: {
 type: object,
 properties: {
 latitude: { type: number, minimum: -90, maximum: 90 },
 longitude: { type: number, minimum: -180, maximum: 180 },
 address: { type: string },
 district: { type: string },
 state_province: { type: string }
 },
 required: [latitude, longitude, address]
 },
 contact: {
 type: object,
 properties: {
 general_phone: { type: string },
 emergency_desk_phone: { type: string },
 emergency_desk_email: { type: string, format: email }
 },
 required: [emergency_desk_phone]
 },
 operational_status: {
 type: string,
 enum: [OPERATIONAL, DIVERTING, CLOSED, EMERGENCY_ONLY],
 default: OPERATIONAL
 },
 is_active: { type: boolean, default: true },
 created_at: { type: string, format: date-time },
 updated_at: { type: string, format: date-time }
 },
 required: [id, name, facility_code, tier, location, contact, operational_status]
}
`

---

### 2.2 Capacity Resource
Represents discrete operational assets (beds, theatres, blood, oxygen, or specialists) hosted at a facility.

- **Primary Key:** id (UUIDv7 string)
- **Foreign Key:** acility_id -> Facility.id

`json
{
 : https://json-schema.org/draft/2020-12/schema,
 title: CapacityResource,
 type: object,
 properties: {
 id: { type: string, description: Prefixed UUIDv7 (e.g., res_01HJ8...) },
 facility_id: { type: string },
 resource_type: {
 type: string,
 enum: [
 BED,
 SPECIALIST,
 OPERATING_THEATRE,
 BLOOD_STOCK,
 OXYGEN_SUPPLY,
 EQUIPMENT
 ]
 },
 sub_type: {
 type: string,
 description: Specific taxonomy (e.g., RESUSCITATION_BAY, OBSTETRICIAN_GYNAECOLOGIST, O_NEGATIVE_PRBC, CT_SCANNER)
 },
 identifier_code: { type: string, example: THEATRE-03 },
 status: {
 type: string,
 enum: [AVAILABLE, RESERVED, OCCUPIED, MAINTENANCE, OFFLINE]
 },
 units_in_stock: { type: integer, description: Applicable for blood units or oxygen cylinders, default: 1 },
 metadata: {
 type: object,
 additionalProperties: true
 },
 last_heartbeat: { type: string, format: date-time },
 updated_at: { type: string, format: date-time }
 },
 required: [id, facility_id, resource_type, sub_type, status]
}
`

---

### 2.3 Patient
Represents the individual receiving medical care.

- **Primary Key:** id (UUIDv7 string)

`json
{
 : https://json-schema.org/draft/2020-12/schema,
 title: Patient,
 type: object,
 properties: {
 id: { type: string },
 national_health_id: { type: string },
 full_name: { type: string },
 date_of_birth: { type: string, format: date },
 gender: { type: string, enum: [MALE, FEMALE, OTHER, UNKNOWN] },
 blood_group: {
 type: string,
 enum: [A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE, UNKNOWN]
 },
 known_allergies: {
 type: array,
 items: { type: string }
 },
 emergency_contact: {
 type: object,
 properties: {
 name: { type: string },
 relationship: { type: string },
 phone: { type: string }
 }
 }
 },
 required: [id, full_name, gender]
}
`

---

### 2.4 Referral
Represents the active referral ticket, its clinical constraints, and its progression through the system.

- **Primary Key:** id (UUIDv7 string)
- **Foreign Keys:**
 - patient_id -> Patient.id
 - eferring_facility_id -> Facility.id
 - ssigned_facility_id -> Facility.id (nullable until matched/confirmed)

`json
{
 : https://json-schema.org/draft/2020-12/schema,
 title: Referral,
 type: object,
 properties: {
 id: { type: string },
 patient_id: { type: string },
 referring_facility_id: { type: string },
 assigned_facility_id: { type: [string, null] },
 triage_priority: {
 type: string,
 enum: [CRITICAL, EMERGENT, URGENT, SEMI_URGENT, NON_URGENT]
 },
 chief_complaint: { type: string },
 clinical_summary: { type: string },
 required_resources: {
 type: object,
 properties: {
 bed_tier: { type: string, enum: [GENERAL, HDU, ICU, RESUSCITATION, NICU, ISOLATION] },
 specialties: { type: array, items: { type: string } },
 facilities: { type: array, items: { type: string } },
 blood_units: {
 type: array,
 items: {
 type: object,
 properties: {
 blood_group: { type: string },
 component: { type: string, enum: [PRBC, FFP, PLATELETS, WHOLE_BLOOD] },
 quantity: { type: integer, minimum: 1 }
 },
 required: [blood_group, component, quantity]
 }
 },
 high_flow_oxygen: { type: boolean },
 transport_type: { type: string, enum: [BLS, ALS, MOBILE_ICU, NEONATAL] }
 },
 required: [bed_tier, transport_type]
 },
 initial_vitals: {
 type: object,
 properties: {
 bp_systolic: { type: integer },
 bp_diastolic: { type: integer },
 heart_rate: { type: integer },
 respiratory_rate: { type: integer },
 spo2: { type: integer },
 temperature_c: { type: number },
 gcs: { type: integer, minimum: 3, maximum: 15 },
 measured_at: { type: string, format: date-time }
 }
 },
 status: {
 type: string,
 enum: [
 DRAFT,
 MATCHING,
 MATCHED,
 RESERVED,
 DISPATCHED,
 IN_TRANSIT,
 REROUTED,
 HANDOVER_COMPLETED,
 CANCELLED
 ]
 },
 created_at: { type: string, format: date-time },
 completed_at: { type: [string, null], format: date-time }
 },
 required: [id, patient_id, referring_facility_id, triage_priority, required_resources, status]
}
`

---

### 2.5 Match
Represents a scored evaluation of a facility against an open referral.

- **Primary Key:** id (UUIDv7 string)
- **Foreign Keys:**
 - eferral_id -> Referral.id
 - acility_id -> Facility.id

`json
{
 : https://json-schema.org/draft/2020-12/schema,
 title: Match,
 type: object,
 properties: {
 id: { type: string },
 referral_id: { type: string },
 facility_id: { type: string },
 composite_score: { type: number, minimum: 0, maximum: 100 },
 hard_constraints_satisfied: { type: boolean },
 breakdown: {
 type: object,
 properties: {
 travel_time_minutes: { type: number },
 distance_km: { type: number },
 capacity_confidence_score: { type: number },
 facility_load_factor: { type: number },
 handover_velocity_score: { type: number }
 }
 },
 status: {
 type: string,
 enum: [PROPOSED, ACCEPTED, REJECTED, INVALIDATED, EXPIRED]
 },
 created_at: { type: string, format: date-time }
 },
 required: [id, referral_id, facility_id, composite_score, hard_constraints_satisfied, status]
}
`

---

### 2.6 Reservation
Represents an atomic distributed lock on clinical resources at the destination facility.

- **Primary Key:** id (UUIDv7 string)
- **Foreign Keys:**
 - eferral_id -> Referral.id
 - match_id -> Match.id
 - acility_id -> Facility.id

`json
{
 : https://json-schema.org/draft/2020-12/schema,
 title: Reservation,
 type: object,
 properties: {
 id: { type: string },
 referral_id: { type: string },
 match_id: { type: string },
 facility_id: { type: string },
 locked_resource_ids: {
 type: array,
 items: { type: string }
 },
 status: {
 type: string,
 enum: [ACTIVE, COMMITTED, EXPIRED, RELEASED, INVALIDATED]
 },
 expires_at: { type: string, format: date-time },
 created_at: { type: string, format: date-time },
 released_at: { type: [string, null], format: date-time }
 },
 required: [id, referral_id, facility_id, locked_resource_ids, status, expires_at]
}
`

---

### 2.7 Transport Assignment & Tracking Event
Represents the assigned vehicle, telemetry stream, and en-route vitals.

#### Transport Assignment
`json
{
 id: ta_01HJ8QWE6655443322110099,
 referral_id: ref_01HJ8PQR9988776655443322,
 vehicle_id: amb_unit_04,
 vehicle_type: ALS,
 driver_name: Samuel Ojo,
 paramedic_name: Kelechi Nwosu,
 crew_contact_phone: +2348033221100,
 dispatch_status: IN_TRANSIT_TO_DESTINATION,
 assigned_at: 2026-09-18T00:10:00Z
}
`

#### Tracking Event
`json
{
 id: trk_01HJ8VBN1133557799224466,
 transport_assignment_id: ta_01HJ8QWE6655443322110099,
 referral_id: ref_01HJ8PQR9988776655443322,
 latitude: 6.5180,
 longitude: 3.3820,
 speed_kmh: 68.4,
 heading_degrees: 142.0,
 estimated_time_remaining_seconds: 960,
 patient_vitals: {
 bp_systolic: 80,
 bp_diastolic: 48,
 heart_rate: 128,
 spo2: 95
 },
 timestamp: 2026-09-18T00:54:10Z
}
`
