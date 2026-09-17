# ReferralOS: System Architecture & Operational Workflow

## 1. How ReferralOS Works: The 7-Step Workflow

ReferralOS treats an emergency referral as an active, stateful transaction rather than a phone call or paper form.

`mermaid
sequenceDiagram
    autonumber
    actor Clinician as Referring Clinician (PHC)
    participant Engine as ReferralOS Core Engine
    participant Registry as Live Capacity Registry
    participant Hospital as Receiving Hospital ER
    participant Transport as Ambulance Unit

    Clinician->>Engine: 1. Submit Referral (Clinical Profile & Resource Bundle)
    Engine->>Registry: 2. Query Facilities within Travel Isochrone
    Registry-->>Engine: 3. Return Real-Time Capacity & Telemetry States
    Engine->>Engine: 4. Filter Hard Constraints & Score Viability
    Engine->>Clinician: 5. Present Ranked Matches with Rationale
    Clinician->>Engine: 6. Confirm Selected Destination
    Engine->>Registry: 7. Atomic Multi-Resource Reservation (TTL Lock)
    Engine->>Hospital: 8. Push e-PRP Pre-Arrival Alert (Audio Siren + Vitals)
    Engine->>Transport: 9. Dispatch Assignment & Route Navigation
    Transport->>Engine: 10. Stream Live GPS Telematics & En-Route Vitals
    Hospital->>Engine: 11. Confirm Bed & Surgical Team Ready
    Transport->>Hospital: 12. Physical Arrival & QR Handover Verification
    Hospital->>Engine: 13. Complete Handover (Commit Locked Resources)
`

### Detailed Workflow Steps

1. **Clinical Intake & Constraint Profiling:**  
   The referring clinician enters the patient's triage presentation and required clinical bundle (bed tier, specialty, surgical facilities, blood products, oxygen, transport type).
2. **Dynamic Capability & Isochrone Filtering:**  
   The engine computes realistic road travel times from the patient's location and filters facilities against non-negotiable **Hard Constraints** (e.g., active operating theatre, compatible blood in stock).
3. **Multi-Criteria Suitability Ranking:**  
   Surviving facilities are scored using a composite scoring function balancing travel time, resource buffer depth, historical handover speed, and current facility congestion.
4. **Atomic Multi-Resource Reservation:**  
   Upon confirming destination selection, ReferralOS establishes an atomic, distributed lock with a Time-to-Live (TTL, e.g., 45 minutes) over the required assets (theatre slot, resuscitation bay, blood units), preventing concurrent booking.
5. **Electronic Pre-Arrival Referral Packet (e-PRP) Handshake:**  
   A digital clinical dossier containing baseline vitals, triage level, administered drugs, and live ETA is pushed to the receiving hospital's triage screen, triggering an audible alarm.
6. **Ambulance Dispatch & Live Telematics Tracking:**  
   The ambulance terminal receives turn-by-turn routing. Vehicle GPS coordinates and en-route vitals are streamed back to the engine; ETAs are recalculated dynamically based on live traffic.
7. **Continuous Invalidation Watcher & Arrival Handover:**  
   The engine monitors the destination hospital's capacity throughout transit. At arrival, the receiving triage team scans a verification QR code, committing the locked resources to Occupied and closing the transfer loop.

---

## 2. High-Level Architectural Topology

ReferralOS is built as an event-driven microservices architecture designed for sub-150ms constraint matching, distributed consistency, and offline resilience.

`
                                      ┌─────────────────────────────────────────┐
                                      │              Client Layer               │
                                      │                                         │
                                      │  ┌──────────┐ ┌───────────┐ ┌────────┐  │
                                      │  │ PHC App  │ │ Hospital  │ │ Medic  │  │
                                      │  │  (PWA)   │ │ Dashboard │ │ Mobile │  │
                                      │  └────┬─────┘ └─────┬─────┘ └───┬────┘  │
                                      └───────┼─────────────┼───────────┼───────┘
                                              │ HTTPS / WSS │           │
                                              ▼             ▼           ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       API Gateway & Security Layer                                     │
│  - Reverse Proxy (Envoy / Kong)                                                                        │
│  - Authentication & RBAC (OAuth2 / JWT / mTLS)                                                        │
│  - Rate Limiting & DoS Protection (Token Bucket)                                                       │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           Core Microservices                                           │
│                                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────────────────────┐  │
│  │   Referral Service    │   │  Capacity Registry Engine │   │      Transport & Tracking Engine     │  │
│  │ - Intake validation   │   │ - Real-time state store   │   │ - GPS telemetry ingestion (MQTT/WSS) │  │
│  │ - e-PRP generator     │   │ - Heartbeat monitors      │   │ - OSRM traffic isochrone solver      │  │
│  │ - FHIR R4 converter   │   │ - IoT equipment adapters  │   │ - Dynamic ETA calculator             │  │
│  └───────────┬───────────┘   └─────────────┬─────────────┘   └──────────────────┬───────────────────┘  │
│              │                             │                                    │                      │
│              └───────────────────────┬─────┴────────────────────────────────────┘                      │
│                                      ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                               Dynamic Matching & Reservation Engine                              │  │
│  │ - Spatial constraint solver (PostGIS geography indexes)                                         │  │
│  │ - Clinical suitability multi-criteria scoring algorithm                                          │  │
│  │ - Atomic multi-resource lock manager (Redis Redlock & TTL lease monitor)                         │  │
│  │ - Event-driven Failover Watcher (Listens for capacity changes, triggers auto-reroute)            │  │
│  └───────────────────────────────────┬──────────────────────────────────────────────────────────────┘  │
│                                      │                                                                 │
│                                      ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                 Notification & Dispatch Hub                                      │  │
│  │ - WebSockets / SSE connection pools (Real-time dashboard updates)                                │  │
│  │ - Push Notification Service (FCM / APNs)                                                         │  │
│  │ - Resilient Fallback Gateway (Twilio SMS / USSD / Automated Voice alerts)                        │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      Storage & Message Infrastructure                                  │
│                                                                                                        │
│  ┌───────────────────────────────┐ ┌─────────────────────────────────┐ ┌────────────────────────────┐  │
│  │   PostgreSQL 16 + PostGIS     │ │          Redis Cluster          │ │      Apache Kafka /        │  │
│  │ - Primary relational store    │ │ - Live capacity cache           │ │        RabbitMQ            │  │
│  │ - Geospatial facility index   │ │ - Distributed locks (Redlock)   │ │ - Capacity update stream   │  │
│  │ - Audit trail & e-PRP records │ │ - Ephemeral telemetry state     │ │ - Telemetry event bus      │  │
│  └───────────────────────────────┘ └─────────────────────────────────┘ └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
`

---

## 3. Core Architectural Subsystems

### 3.1 Capacity Registry Engine
- **In-Memory Live Cache:** Maintains sub-millisecond capacity state in Redis with write-through persistence to PostgreSQL.
- **Bi-Directional Telemetry Ingestion:**
  - *Manual Toggles:* Clinicians and unit managers can update resource states (e.g., marking a theatre as Decontaminating).
  - *IoT Equipment Heartbeats:* Direct telemetry ingestion from hospital utility sensors (oxygen manifold pressure, generator load status, refrigeration temperatures).
- **Stale State Detection:** Resources lacking an active heartbeat or human verification within a configurable window (e.g., 6 hours) are flagged with reduced confidence scores in the matching solver.

### 3.2 Matching & Routing Engine
- **Spatial Indexing:** Employs PostGIS R-tree geospatial indexing to query facilities within travel isochrone boundaries.
- **Routing Integration:** Integrates with routing engines (OSRM / Valhalla) with live and historical traffic layers to compute accurate travel durations rather than straight-line Euclidean distance.
- **Constraint Solver:** Evaluates binary hard constraints and calculates composite MCDA suitability scores in under 120ms.

### 3.3 Atomic Multi-Resource Reservation System
- **Distributed Locking:** Implements the Redis Redlock algorithm to coordinate locks across clustered Redis nodes.
- **Multi-Resource Atomicity:** All required resources (bed + theatre + blood units + specialist) are claimed within a single atomic transaction. If any resource in the bundle cannot be secured, all partial locks are released immediately.
- **Lease Manager:** Background cron service monitors TTL leases, issues pre-expiration warnings, executes automated extensions for delayed ambulances, and cleans up expired locks.

### 3.4 Transport & Telematics Engine
- **High-Throughput Ingestion:** Ingests GPS telemetry via MQTT and WebSockets.
- **Geofenced Milestones:** Triggers automated events when the ambulance crosses predefined geographic zones (e.g., Ambulance within 2 km of destination).
- **En-Route Vitals Stream:** Relays updated patient vital signs from the ambulance tablet directly to the destination hospital's resuscitation monitor.

### 3.5 Failover & Invalidation Watcher
- **Event Bus Subscription:** Subscribes to the Kafka/RabbitMQ capacity.events topic.
- **Correlation Engine:** When a resource status changes to OFFLINE or OCCUPIED, the watcher correlates the resource ID against all active reservations.
- **Automated Reroute Dispatch:** If an active in-transit referral is compromised, the watcher invalidates the current match, executes a live reroute search from the ambulance's current location, secures new locks, and alerts all stakeholders.

### 3.6 Notification & Dispatch Hub
- **Multi-Transport Notification:** Delivers events through WebSockets, Web Push (FCM), SMS (Twilio/local telco gateways), and automated IVR phone alerts.
- **Fallback Hierarchy:** If WebSocket acknowledgement is not received within 30 seconds for critical alerts, the system automatically falls back to SMS and high-priority voice calls.
