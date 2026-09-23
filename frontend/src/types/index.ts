export type FacilityTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'QUATERNARY';
export type OperationalStatus = 'OPERATIONAL' | 'DEGRADED' | 'DIVERT_ALL' | 'OFFLINE';
export type ResourceType = 'BED' | 'OPERATING_THEATRE' | 'SPECIALIST' | 'BLOOD_STOCK' | 'OXYGEN_SUPPLY';
export type ResourceStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'OFFLINE' | 'MAINTENANCE';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  district?: string | null;
  state_province?: string | null;
}

export interface FacilityContact {
  general_phone?: string | null;
  emergency_desk_phone?: string | null;
  emergency_desk_email?: string | null;
}

export interface Facility {
  id: string;
  name: string;
  facility_code: string;
  tier: FacilityTier;
  location: Location;
  contact?: FacilityContact;
  operational_status: OperationalStatus;
  is_active?: boolean;
  total_beds: number;
  occupied_beds: number;
  handover_avg_minutes?: number;
  distance_km?: number;
  estimated_travel_minutes?: number;
}

export interface CapacityResource {
  id: string;
  facility_id: string;
  resource_type: ResourceType;
  sub_type: string;
  identifier_code: string;
  status: ResourceStatus;
  units_in_stock: number;
  metadata?: Record<string, unknown>;
  last_heartbeat?: string;
  updated_at?: string;
}

export interface PatientVitals {
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  respiratory_rate: number;
  spo2: number;
  temperature_celsius?: number;
  gcs_score?: number;
}

export interface BloodRequirement {
  blood_group: string;
  component: string;
  quantity: number;
}

export interface RequiredResources {
  bed_tier: string;
  specialties: string[];
  facilities: string[];
  blood_units?: BloodRequirement[];
  high_flow_oxygen?: boolean;
  transport_type?: 'BLS' | 'ALS' | 'CRITICAL_CARE';
}

export type ReferralStatus =
  | 'DRAFT'
  | 'MATCHING'
  | 'PENDING_ACCEPTANCE'
  | 'RESERVATION_LOCKED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'ARRIVED_BAY'
  | 'HANDOVER_COMPLETED'
  | 'REROUTED'
  | 'CANCELLED';

export type TriagePriority = 'CRITICAL' | 'EMERGENT' | 'URGENT' | 'NON_URGENT';

export interface Referral {
  id: string;
  patient_id: string;
  patient_name?: string;
  referring_facility_id: string;
  assigned_facility_id?: string;
  assigned_facility_name?: string;
  triage_priority: TriagePriority;
  chief_complaint: string;
  clinical_summary?: string;
  required_resources: RequiredResources;
  initial_vitals: PatientVitals;
  status: ReferralStatus;
  active_reservation_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  facility_id: string;
  facility_name: string;
  composite_score: number;
  hard_constraints_satisfied: boolean;
  disqualification_reason?: string | null;
  travel_time_minutes: number;
  distance_km: number;
  matched_resource_ids: string[];
  breakdown?: {
    travel_time_score?: number;
    resource_depth_score?: number;
    congestion_penalty?: number;
  };
  rationale: string;
}

export interface Reservation {
  reservation_id?: string;
  id?: string;
  referral_id: string;
  facility_id: string;
  locked_resources: string[];
  expires_at: string;
  status: 'ACTIVE' | 'COMMITTED' | 'INVALIDATED' | 'EXPIRED' | 'RELEASED';
}

export interface TransportAssignment {
  id: string;
  referral_id: string;
  vehicle_id: string;
  vehicle_type: string;
  driver_name?: string;
  paramedic_name?: string;
  crew_contact_phone?: string;
  status: string;
}

export interface TelemetryEvent {
  id: string;
  transport_assignment_id: string;
  referral_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading_degrees?: number;
  patient_vitals?: PatientVitals;
  recorded_at: string;
}

export interface NotificationPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

export interface ClinicalTemplate {
  id: string;
  title: string;
  subtitle: string;
  priority: TriagePriority;
  chiefComplaint: string;
  clinicalSummary: string;
  patient: {
    name: string;
    age: number;
    gender: 'FEMALE' | 'MALE';
    id: string;
    bloodGroup: string;
    allergies: string[];
  };
  vitals: PatientVitals;
  requiredResources: RequiredResources;
}
