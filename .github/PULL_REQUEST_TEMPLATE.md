## 🚑 ReferralOS Core Engine: Production-Grade Day 1–5 Backend MVP

### 📌 Overview & Strategic Context
This Pull Request delivers the complete, production-grade **Day 1–5 Backend MVP** for **ReferralOS**—an intelligent, real-time healthcare referral and capacity-routing engine engineered to eliminate the fatal "ping-pong" phenomenon in acute clinical emergencies.

The codebase has been refactored into a scalable monorepo workspace (`backend/`), leaving the root clean and ready for the upcoming frontend presentation layer (`frontend/`).

---

### 🏗️ Key Architecture & Subsystems Implemented

#### 1. Relational & Geospatial Infrastructure (PostgreSQL 16 + PostGIS)
- **Migration & Schema (`backend/migrations/001_initial_schema.sql`):** 9 normalized relational tables (`facilities`, `capacity_resources`, `patients`, `referrals`, `matches`, `reservations`, `transport_assignments`, `tracking_events`, `audit_logs`).
- **PostGIS Spatial Modeling:** Integrated geography indexing for regional facility coordinates, road detour compensation factor ($1.32\times$), and emergency ambulance speed models.
- **Connection Resilience:** `backend/src/infrastructure/database.ts` configured with 30s connection timeouts and SSL modes for serverless cold starts on Neon.

#### 2. Two-Phase Constraint Matching Engine (`backend/src/services/matching/engine.ts`)
- **Phase 1 (Binary Hard Constraints):** Enforces $\mathbb{V}(F_i) \in \{0, 1\}$. Evaluates operating theatre sterilization states, blood bank inventory levels (e.g. O- PRBC units), and required clinical specialties. Facilities failing any hard requirement (such as Hospital A's offline theatre) are rejected immediately.
- **Phase 2 (MCDA Composite Scoring):** Computes multi-criteria score $\mathcal{S}(F_i) = w_t \cdot \mathcal{S}_{\text{travel}} + w_b \cdot \mathcal{S}_{\text{buffer}} + w_h \cdot \mathcal{S}_{\text{handover}} - \mathcal{P}_{\text{congestion}}^2$.

#### 3. Atomic Multi-Resource Distributed Locking (`backend/src/infrastructure/redis.ts`, `backend/src/services/lock.service.ts`)
- **All-or-Nothing Atomicity:** Custom Redis Lua scripts execute atomic bundle acquisition across multiple keys (`lock:resource:<id>`). If any single asset is unavailable, all partially acquired locks are aborted without leaking state.
- **Time-to-Live (TTL) Leases:** Reservations default to 45-minute leases with automatic extensions based on dynamic ambulance GPS updates.

#### 4. Event-Driven Mid-Transit Failover Watcher (`backend/src/services/failover-watcher.service.ts`)
- **Pub/Sub Telemetry:** Subscribes to Redis `capacity.events`.
- **Automated Rerouting:** If an active in-transit destination experiences a sudden outage (e.g., Theatre transformer failure at Hospital B), the watcher invalidates compromised locks, re-evaluates candidate hospitals from the **live GPS coordinates of the moving ambulance**, locks backup facilities (Hospital C), and broadcasts audio siren reroute alerts to the vehicle terminal.

#### 5. Local Walk-In Preemption (`backend/src/routes/facility.routes.ts`)
- Supports immediate clinical preemption (`POST /api/v1/facilities/:id/capacity/:resource_id/override`) for unexpected walk-in resuscitation cases, ensuring local patient safety while triggering automated failovers for inbound ambulances.

#### 6. Real-Time Telematics & Clinical Handshake
- **Server-Sent Events (SSE):** `GET /api/v1/notifications/stream` pushes instant siren audio cues, e-PRP pre-arrival packets, and reroute notifications.
- **QR Handover Verification:** Closes the referral lifecycle via secure verification codes, transitioning reservations to `OCCUPIED` and archiving encounters into clinical audit logs.

---

### 🧪 Comprehensive Test & Simulation Coverage

| Suite | Tests | Result | Execution Time |
|---|---|---|---|
| **Unit Tests (`geo.test.ts`)** | Haversine distance, zero-distance, road travel winding models | ✅ Passed (3/3) | ~1.1s |
| **Unit Tests (`matching.test.ts`)** | Hard constraint theatre rejection, blood deficit filtering, MCDA scoring | ✅ Passed (4/4) | ~1.2s |
| **Unit Tests (`lock-manager.test.ts`)** | Multi-resource Lua atomicity, collision rollbacks, lock release | ✅ Passed (2/2) | ~1.1s |
| **Integration Suite (`api.test.ts`)** | 10 end-to-end API tests (intake, matching, 409 conflict, dispatch, telemetry, handover) | ✅ Passed (10/10) | ~26s |
| **Integration Suite (`failover.test.ts`)** | Automated mid-transit capacity drop, watcher trigger, and reroute assertion | ✅ Passed (1/1) | ~25s |
| **Flagship Demo (`demo:pph-scenario`)** | 7-step acute Postpartum Haemorrhage (PPH) transfer scenario | ✅ Passed (7/7 steps) | Complete |

---

### 🚀 Cloud Deployment Ready (Render Blueprint)
- Added [`render.yaml`](./render.yaml) for 1-click cloud deployment on Render.
- Fastify configured to bind to `0.0.0.0` on `process.env.PORT` with CORS enabled (`origin: '*'`).
- Compatible with live Neon PostgreSQL and Upstash Redis.

---

### 📝 Documentation & Hygiene
- Removed duplicate `LICENSE.md`; preserved canonical `LICENSE` (Apache 2.0).
- Updated [`docs/API_SPECIFICATION.md`](./docs/API_SPECIFICATION.md) with the emergency walk-in override endpoint.
- Updated [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) with monorepo workspace and runtime details.
- Updated [`README.md`](./README.md) with comprehensive quickstart commands and scenario demo scripts.
- Clean 25-commit conventional history with zero monolithic blobs.
