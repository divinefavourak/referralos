export type FacilityTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'QUATERNARY';

export type OperationalStatus = 'OPERATIONAL' | 'DIVERTING' | 'CLOSED' | 'EMERGENCY_ONLY';

export type ResourceType =
  | 'BED'
  | 'SPECIALIST'
  | 'OPERATING_THEATRE'
  | 'BLOOD_STOCK'
  | 'OXYGEN_SUPPLY'
  | 'EQUIPMENT';

export type ResourceStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'OFFLINE';

export type TriagePriority = 'CRITICAL' | 'EMERGENT' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT';

export type ReferralStatus =
  | 'DRAFT'
  | 'MATCHING'
  | 'MATCHED'
  | 'RESERVED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'REROUTED'
  | 'HANDOVER_COMPLETED'
  | 'CANCELLED';

export type MatchStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'INVALIDATED' | 'EXPIRED';

export type ReservationStatus = 'ACTIVE' | 'COMMITTED' | 'EXPIRED' | 'RELEASED' | 'INVALIDATED';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address?: string;
  district?: string;
  state_province?: string;
}

export interface FacilityContact {
  general_phone?: string;
  emergency_desk_phone: string;
  emergency_desk_email?: string;
}

export interface Facility {
  id: string;
  name: string;
  facility_code: string;
  tier: FacilityTier;
  location: LocationPoint;
  contact: FacilityContact;
  operational_status: OperationalStatus;
  is_active: boolean;
  total_beds: number;
  occupied_beds: number;
  created_at: string;
  updated_at: string;
}

export interface CapacityResource {
  id: string;
  facility_id: string;
  resource_type: ResourceType;
  sub_type: string;
  identifier_code: string;
  status: ResourceStatus;
  units_in_stock: number;
  metadata?: Record<string, any>;
  last_heartbeat?: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  national_health_id?: string;
  full_name: string;
  date_of_birth?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  blood_group?: string;
  known_allergies?: string[];
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface RequiredBloodUnit {
  blood_group: string;
  component: 'PRBC' | 'FFP' | 'PLATELETS' | 'WHOLE_BLOOD';
  quantity: number;
}

export interface RequiredResources {
  bed_tier: 'GENERAL' | 'HDU' | 'ICU' | 'RESUSCITATION' | 'NICU' | 'ISOLATION';
  specialties?: string[];
  facilities?: string[];
  blood_units?: RequiredBloodUnit[];
  high_flow_oxygen?: boolean;
  transport_type: 'BLS' | 'ALS' | 'MOBILE_ICU' | 'NEONATAL';
}

export interface PatientVitals {
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  spo2?: number;
  temperature_c?: number;
  gcs?: number;
  measured_at?: string;
}

export interface Referral {
  id: string;
  patient_id: string;
  referring_facility_id: string;
  assigned_facility_id?: string | null;
  triage_priority: TriagePriority;
  chief_complaint: string;
  clinical_summary?: string;
  required_resources: RequiredResources;
  initial_vitals?: PatientVitals;
  status: ReferralStatus;
  created_at: string;
  completed_at?: string | null;
}

export interface MatchScoreBreakdown {
  travel_time_minutes: number;
  distance_km: number;
  travel_score: number;
  capacity_score: number;
  handover_score: number;
  congestion_penalty: number;
}

export interface Match {
  id: string;
  referral_id: string;
  facility_id: string;
  facility_name?: string;
  composite_score: number;
  hard_constraints_satisfied: boolean;
  breakdown: MatchScoreBreakdown;
  status: MatchStatus;
  rationale?: string;
  created_at: string;
}

export interface Reservation {
  id: string;
  referral_id: string;
  match_id?: string;
  facility_id: string;
  locked_resource_ids: string[];
  status: ReservationStatus;
  expires_at: string;
  created_at: string;
  released_at?: string | null;
}

export interface TransportAssignment {
  id: string;
  referral_id: string;
  vehicle_id: string;
  vehicle_type: string;
  driver_name?: string;
  paramedic_name?: string;
  crew_contact_phone?: string;
  dispatch_status: string;
  assigned_at: string;
}

export interface TrackingEvent {
  id: string;
  transport_assignment_id: string;
  referral_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading_degrees?: number;
  estimated_time_remaining_seconds?: number;
  patient_vitals?: PatientVitals;
  timestamp: string;
}
