# ReferralOS: API Specification

## 1. Overview & Architecture

The ReferralOS API is a RESTful and event-driven interface designed for high concurrency, sub-100ms response times, and strict audit compliance across healthcare facilities.

- **Base URL (Production):** `https://api.referralos.org/v1`
- **Base URL (Staging):** `https://staging-api.referralos.org/v1`
- **Protocol:** HTTPS / TLS 1.3 (WSS for real-time streams)
- **Data Format:** JSON (`application/json; charset=utf-8`)

---

## 2. Authentication & Authorization

All API calls require authentication via JSON Web Tokens (JWT) or Scoped API Keys.

### 2.1 Request Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Request-ID: req_01HJ8ZABC11223344
Content-Type: application/json
```

### 2.2 Scopes Matrix
- `referrals:read`, `referrals:write` ? Referring clinicians & triage staff.
- `capacity:read`, `capacity:write` ? Hospital bed managers & unit charge nurses.
- `transport:telemetry` ? Vehicle tracking units and paramedic terminals.
- `admin:all` ? Regional health authorities and system administrators.

---

## 3. Standard Response Formats

### 3.1 Success Response Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "req_01HJ8ZABC11223344",
    "timestamp": "2026-09-18T00:39:21Z",
    "api_version": "v1.0"
  }
}
```

### 3.2 Error Response Envelope (RFC 7807)
```json
{
  "success": false,
  "error": {
    "code": "CAPACITY_LOCK_FAILED",
    "message": "The requested resource could not be locked due to a concurrent reservation.",
    "details": [
      {
        "field": "resource_ids",
        "issue": "Resource 'res_theatre_03' is held by lock 'resv_01HJ8TYU7788990011223344'"
      }
    ]
  },
  "meta": {
    "request_id": "req_01HJ8ZABC11223344",
    "timestamp": "2026-09-18T00:39:21Z"
  }
}
```

---

## 4. Endpoints

### 4.1 Facilities

#### `GET /api/v1/facilities`
List facilities filtered by location and tier.

- **Query Parameters:**
  - `lat` (float, required): Origin latitude.
  - `lng` (float, required): Origin longitude.
  - `radius_km` (float, optional, default: 50.0): Search radius.
  - `tier` (string, optional): `PRIMARY`, `SECONDARY`, `TERTIARY`.

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "fac_01HJ8WXYZ1234567890ABCDEF",
      "name": "Apex Specialist Hospital",
      "tier": "TERTIARY",
      "distance_km": 31.2,
      "estimated_travel_minutes": 38.0,
      "operational_status": "OPERATIONAL"
    }
  ]
}
```

#### `GET /api/v1/facilities/{id}`
Retrieve a facility's profile and contact endpoints.

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "fac_01HJ8WXYZ1234567890ABCDEF",
    "name": "Apex Specialist Hospital",
    "facility_code": "ASH-REG-04",
    "tier": "TERTIARY",
    "location": { "latitude": 6.5244, "longitude": 3.3792 },
    "operational_status": "OPERATIONAL"
  }
}
```

---

### 4.2 Capacity & Resources

#### `GET /api/v1/facilities/{id}/capacity`
Retrieve live operational resource counts and states.

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "facility_id": "fac_01HJ8WXYZ1234567890ABCDEF",
    "resources": [
      {
        "id": "res_theatre_03",
        "resource_type": "OPERATING_THEATRE",
        "identifier_code": "THEATRE-03",
        "status": "AVAILABLE",
        "last_verified_at": "2026-09-18T00:30:00Z"
      },
      {
        "id": "res_blood_oneg",
        "resource_type": "BLOOD_STOCK",
        "sub_type": "O_NEGATIVE_PRBC",
        "status": "AVAILABLE",
        "units_in_stock": 4
      }
    ]
  }
}
```

#### `PUT /api/v1/facilities/{id}/capacity/{resource_id}`
Update the status of a specific hospital asset.

- **Request Body:**
```json
{
  "status": "OFFLINE",
  "reason": "HVAC positive-pressure ventilation failure",
  "estimated_restoration_at": "2026-09-18T04:00:00Z"
}
```

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "resource_id": "res_theatre_03",
    "status": "OFFLINE",
    "updated_at": "2026-09-18T00:39:21Z"
  }
}
```

#### `POST /api/v1/capacity/heartbeat`
IoT gateway telemetry ingestion for equipment uptime and medical gas pressure.

- **Request Body:**
```json
{
  "facility_id": "fac_01HJ8WXYZ1234567890ABCDEF",
  "heartbeats": [
    { "resource_id": "res_o2_central", "status": "AVAILABLE", "metric_value": 55.4, "metric_unit": "PSI" }
  ]
}
```

---

### 4.3 Referrals

#### `POST /api/v1/referrals`
Submit a new referral and trigger matching.

- **Request Body:**
```json
{
  "patient_id": "pat_01HJ8MNO1122334455667788",
  "referring_facility_id": "fac_01HJ8PHC0000000000000001",
  "triage_priority": "CRITICAL",
  "chief_complaint": "Severe Postpartum Haemorrhage",
  "clinical_summary": "PPH unresponsive to oxytocin. EBL 1200ml.",
  "required_resources": {
    "bed_tier": "RESUSCITATION",
    "specialties": ["OBSTETRICIAN_GYNAECOLOGIST"],
    "facilities": ["OPERATING_THEATRE"],
    "blood_units": [{ "blood_group": "O_NEGATIVE", "component": "PRBC", "quantity": 2 }],
    "high_flow_oxygen": true,
    "transport_type": "ALS"
  },
  "initial_vitals": {
    "bp_systolic": 74,
    "bp_diastolic": 42,
    "heart_rate": 138,
    "respiratory_rate": 28,
    "spo2": 91
  }
}
```

- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "referral_id": "ref_01HJ8PQR9988776655443322",
    "status": "MATCHING",
    "created_at": "2026-09-18T00:39:21Z"
  }
}
```

#### `GET /api/v1/referrals/{id}`
Retrieve full referral dossier, active matches, and tracking telemetry.

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "ref_01HJ8PQR9988776655443322",
    "status": "IN_TRANSIT",
    "assigned_facility_id": "fac_01HJ8WXYZ1234567890ABCDEF",
    "active_reservation_id": "resv_01HJ8TYU7788990011223344"
  }
}
```

#### `PATCH /api/v1/referrals/{id}/status`
Update the state of a referral (e.g., verifying arrival and handover).

- **Request Body:**
```json
{
  "status": "HANDOVER_COMPLETED",
  "verification_code": "489201",
  "receiving_clinician_notes": "Patient received in Resus 02. Surgery scheduled."
}
```

---

### 4.4 Matches & Routing

#### `POST /api/v1/referrals/{id}/matches`
Calculates and returns ranked viable facilities.

- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "referral_id": "ref_01HJ8PQR9988776655443322",
    "matches": [
      {
        "match_id": "mat_01HJ8SDF4455667788990011",
        "facility_id": "fac_01HJ8WXYZ1234567890ABCDEF",
        "facility_name": "Apex Specialist Hospital",
        "composite_score": 94.2,
        "travel_time_minutes": 38.0,
        "distance_km": 31.2,
        "rationale": "Theatre 3 ready; 4x O- PRBC units in cold store; on-site Obstetrician."
      }
    ]
  }
}
```

---

### 4.5 Reservations

#### `POST /api/v1/reservations`
Acquire an atomic distributed lock on the specified resources.

- **Request Body:**
```json
{
  "match_id": "mat_01HJ8SDF4455667788990011",
  "referral_id": "ref_01HJ8PQR9988776655443322",
  "ttl_minutes": 45
}
```

- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "reservation_id": "resv_01HJ8TYU7788990011223344",
    "facility_id": "fac_01HJ8WXYZ1234567890ABCDEF",
    "locked_resources": [
      "res_bed_resus_02",
      "res_theatre_03",
      "res_blood_oneg_01",
      "res_blood_oneg_02"
    ],
    "expires_at": "2026-09-18T01:24:21Z",
    "status": "ACTIVE"
  }
}
```

#### `POST /api/v1/reservations/{id}/extend`
Extend an active lock if transit is delayed.

#### `DELETE /api/v1/reservations/{id}`
Manually release locked resources.

---

### 4.6 Transport & Tracking

#### `POST /api/v1/transport/assign`
Assign an ambulance unit to an active referral.

#### `POST /api/v1/transport/{id}/telemetry`
Vehicle GPS and en-route patient vitals telemetry stream.

- **Request Body:**
```json
{
  "latitude": 6.5180,
  "longitude": 3.3820,
  "speed_kmh": 68.4,
  "heading": 142.0,
  "patient_vitals": {
    "bp_systolic": 80,
    "bp_diastolic": 48,
    "heart_rate": 128,
    "spo2": 95
  }
}
```

---

### 4.7 Notifications

#### `GET /api/v1/notifications/stream` (SSE)
Real-time Server-Sent Events stream for hospital pre-arrival screens.

- **Headers:** `Accept: text/event-stream`
- **Output:**
```
event: referral.pre_arrival
data: {"referral_id":"ref_01HJ8PQR9988776655443322","eta_minutes":38,"priority":"CRITICAL"}
```

---

## 5. Webhooks & Event Catalog

Consumers can register HTTP webhooks signed with HMAC-SHA256 (`X-ReferralOS-Signature`).

| Event Name | Trigger Description |
|---|---|
| `referral.created` | New referral ticket initialized |
| `referral.matched` | Scored options generated |
| `reservation.locked` | Resources held under active TTL |
| `capacity.invalidated` | Destination resource dropped offline; reroute triggered |
| `referral.rerouted` | Destination changed to secondary facility |
| `transport.milestone` | Vehicle departed origin or crossed geofence |
| `handover.completed` | Destination triage confirmed physical receipt |
