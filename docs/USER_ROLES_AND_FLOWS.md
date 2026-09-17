# ReferralOS: User Roles & Key User Flows

## 1. User Roles & Access Control

ReferralOS implements role-based access control (RBAC) across four primary user personas to support operational integrity, data privacy, and clinical coordination across independent institutions.

`
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ReferralOS Access Roles                          │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ Role                 │ Primary Facility     │ Key Permissions & Scope       │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ Referring Clinician  │ PHC / Clinic /       │ - Create/Draft Referrals      │
│                      │ Secondary Hospital   │ - View Ranked Matches         │
│                      │                      │ - Confirm Facility Selection  │
│                      │                      │ - Track Referral In-Transit   │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ Receiving Triage /   │ Secondary /          │ - View Live Pre-Arrival Queue │
│ Resource Coordinator │ Tertiary Hospital    │ - Update Live Capacity States │
│                      │                      │ - Acknowledge Incoming Alerts │
│                      │                      │ - Accept & Verify Handover    │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ Transport /          │ EMS / Private        │ - View Dispatch Assignments   │
│ Ambulance Crew       │ Ambulance Fleet      │ - Update Transit Milestones   │
│                      │                      │ - Stream En-Route Vitals      │
│                      │                      │ - Receive Mid-Route Changes   │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ Regional Health      │ Ministry of Health / │ - Network-wide Analytics      │
│ System Administrator │ Health Authority     │ - Facility Onboarding         │
│                      │                      │ - Audit Log & SLA Monitoring  │
│                      │                      │ - Emergency Capacity Override │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
`

### 1.1 Referring Facility Staff (PHC / Rural Clinic)
- **Target Personas:** Community Health Extension Workers (CHEWs), Midwives, Medical Officers, General Practitioners at rural or community clinics.
- **Responsibilities:**
  - Assess clinical acuity and input standardized triage parameters.
  - Specify the required clinical bundle (bed tier, surgical capability, blood requirements).
  - Review ranked facility recommendations and confirm destination selection.
  - Coordinate patient preparation and ambulance handoff.
- **UI Profile:** Optimized for low-bandwidth mobile and tablet screens, featuring high-contrast text, offline-first data entry, and one-tap emergency condition templates.

### 1.2 Receiving Hospital Staff (Emergency Dept & Resource Managers)
- **Target Personas:** ER Triage Nurses, Resuscitation Registrars, Operating Theatre Coordinators, Bed Managers, Blood Bank Technicians.
- **Responsibilities:**
  - Maintain real-time capacity states (e.g., toggling a theatre offline for maintenance).
  - Acknowledge incoming pre-arrival alerts and review the electronic pre-arrival packet (e-PRP).
  - Mobilize clinical teams and prepare reserved assets prior to patient arrival.
  - Complete physical handover verification.
- **UI Profile:** Real-time desktop dashboard with audio siren alerts, color-coded urgency queues, countdown ETA timers, and rapid-toggle switches for facility resources.

### 1.3 Ambulance & Transport Crew
- **Target Personas:** Paramedics, Emergency Medical Technicians (EMTs), Ambulance Drivers.
- **Responsibilities:**
  - Accept dispatch assignments and navigate along optimized routes.
  - Transmit automated GPS telemetry and log transit milestones (Departed Origin, 10-Min Warning, Arrived).
  - Stream en-route vitals and interventions.
  - Receive automated mid-transit rerouting directions if capacity fails.
- **UI Profile:** High-visibility vehicle tablet interface with large touch targets, night-mode display, audio turn-by-turn prompts, and quick-tap vital entry buttons.

### 1.4 System Administrator & Regional Health Regulators
- **Target Personas:** Ministry of Health Officers, Regional Hospital Network Directors, System Engineers.
- **Responsibilities:**
  - Onboard and configure hospitals, clinics, and ambulance fleets.
  - Monitor network health, referral bounce rates, and regional bottleneck metrics.
  - Oversee system audit logs and manage emergency capacity overrides during regional crises.
- **UI Profile:** Comprehensive spatial analytics console featuring real-time heatmaps, referral flow lines, capacity utilization rates, and incident logs.

---

## 2. Key User Flow: Severe Postpartum Haemorrhage (PPH) Demo

This workflow demonstrates how ReferralOS handles an acute obstetric emergency, coordinates multi-resource matching and atomic reservation, and resolves mid-transit capacity failure.

`mermaid
flowchart TD
    A[00:00 - Mother in Severe PPH at St. Mary's PHC] --> B[00:05 - Midwife Submits Referral with Clinical Bundle]
    B --> C[00:06 - ReferralOS Evaluates Regional Network]
    C --> D{Hospital A: 18 min away<br/>Theatre OFFLINE}
    C --> E{Hospital B: 38 min away<br/>All Resources AVAILABLE}
    D -- Rejected: Hard Constraint Failed --> F[Disqualified]
    E -- Matched: Score 94.2 --> G[00:07 - Midwife Confirms Hospital B]
    G --> H[45-min Atomic Lock Placed on Hospital B Theatre, Bed & Blood]
    H --> I[Pre-Arrival Siren & e-PRP Sent to Hospital B ER]
    H --> J[00:10 - ALS Ambulance Dispatched with GPS Telematics]
    J --> K[00:22 - Mid-Transit Outage: Hospital B Theatre Drops Offline]
    K --> L[ReferralOS Failover Watcher Invalidates Lock at Hospital B]
    L --> M[Engine Rescores Network from Live Ambulance GPS Coordinate]
    M --> N[Hospital C Matched: 19 min away; Resources Locked]
    N --> O[Driver Alerted with Audio Alarm; GPS Auto-Reroutes to Hospital C]
    N --> P[Hospital C ER Receives e-PRP & Pre-Arrival Alert]
    O --> Q[00:43 - Arrival & QR Handover at Hospital C]
`

### Timeline & Narrative

#### 00:00 — Clinical Presentation
- At St. Mary’s Primary Health Centre, a 28-year-old patient delivers an infant at 02:00.
- Twenty minutes post-delivery, she develops severe uterine atony that is unresponsive to oxytocin and uterine massage.
- Estimated blood loss exceeds 1,200 mL.
- **Vitals:** BP 74/42 mmHg, Heart Rate 138 bpm, Respiratory Rate 28/min, SpO2 91%, peripheral vasoconstriction (Shock Index: 1.86).

#### 00:05 — Clinical Intake via ReferralOS
- Attending midwife selects the **Obstetric Emergency: Postpartum Haemorrhage** template on the PHC tablet.
- The required resource bundle is populated:
  - Resuscitation Bay (Level 2/3)
  - On-duty Obstetrician / Gynaecologist
  - Active Operating Theatre (Laparatomy/B-Lynch suture capability)
  - 2 Units O-Negative Packed Red Blood Cells (PRBC)
  - High-Flow Oxygen
  - Advanced Life Support (ALS) Ambulance
- Baseline vitals and IV line access notes are entered.

#### 00:06 — Dynamic Spatial Matching & Constraint Solving
ReferralOS scans facilities within the regional transport isochrone:
- **Hospital A (District General Hospital):**
  - Travel Time: 18 minutes (12 km).
  - Status: Has resuscitation beds, blood, and an on-duty OB/GYN.
  - Constraint Check: **Failed.** Both surgical theatres are offline for emergency decontamination following an earlier septic peritonitis case.
  - Result: **Rejected.**
- **Hospital B (Regional Specialist Hospital):**
  - Travel Time: 38 minutes (31 km).
  - Status: Resus Bed 02 available, 4 units of O- PRBC in cold storage, Dr. Alabi (OB/GYN) on-site, Theatre 3 empty and sterile.
  - Constraint Check: **Passed.**
  - Result: **Matched (Score: 94.2 / 100).**
- **Hospital C (University Teaching Hospital):**
  - Travel Time: 54 minutes (48 km).
  - Status: Full capabilities available, but greater travel distance.
  - Result: **Backup Standby (Score: 81.0 / 100).**

#### 00:07 — Confirmation & Atomic Resource Locking
- The midwife confirms Hospital B.
- ReferralOS establishes an atomic, distributed lock for 45 minutes across:
  - Hospital B: Resus Bed 02
  - Hospital B: Theatre 3
  - Hospital B: Blood Bank: 2 units O- PRBC
- Hospital B’s ER triage monitor sounds an urgent pre-arrival chime. The screen displays the patient's vitals, countdown ETA, and an order to transport blood to the resuscitation room.

#### 00:10 — Transport Dispatch & Telemetry Stream
- Paramedics from ALS Ambulance Unit 04 load the patient, apply high-flow oxygen, start IV fluid resuscitation, and depart St. Mary's PHC.
- The ambulance's GPS coordinates stream every 5 seconds to ReferralOS. The dynamic ETA updates based on current road conditions.

#### 00:22 — Mid-Transit Capacity Failure Event
- At minute 22 (ambulance is 16 minutes from Hospital B), Hospital B's main electrical substation experiences a transformer fault.
- Theatre 3 loses positive-pressure sterile ventilation. The theatre charge nurse marks the room as Offline on the ReferralOS console.

#### 00:22:30 — Automated Failover & Dynamic Rerouting
- The ReferralOS **Failover Watcher** detects that a locked resource for an in-transit patient has failed.
- The system marks the match with Hospital B as INVALIDATED and releases the held resuscitation bed and blood units back into the hospital pool.
- The matching engine recalculates viability using the ambulance’s **live GPS coordinate** as the origin.
- **Hospital C** is 19 minutes away from the ambulance's current location and has all required resources available.
- ReferralOS acquires atomic locks on Hospital C’s theatre, bed, and blood stock.
- The ambulance terminal triggers an urgent audio alert:
  > *ATTENTION: Hospital B Theatre Compromised. Rerouting to Hospital C (19 minutes). Turn right on Western Expressway.*
- Navigation updates automatically on the driver’s screen.
- Hospital C's triage desk receives the e-PRP and pre-arrival notification with the updated 19-minute ETA.

#### 00:43 — Arrival, Handshake & Handover
- Ambulance Unit 04 arrives at Hospital C's trauma bay.
- The receiving surgical team is assembled in Resus Bed 04 with two units of thawed PRBC.
- The triage nurse scans the referral QR code on the paramedic's tablet.
- The transfer is logged as complete, the temporary lock converts to an admitted patient record, and the audit trail is preserved for clinical governance.
