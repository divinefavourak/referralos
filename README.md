# ReferralOS

> **Don?t send the patient to the nearest hospital. Send them to the nearest hospital that can actually help.**

ReferralOS is an intelligent, real-time healthcare referral and capacity-routing coordination engine. It eliminates the deadly "ping-pong" phenomenon in emergency and acute medical referrals by dynamically matching patient clinical requirements against the live, verified operational capacity of regional healthcare facilities.

---

## The Problem

In traditional healthcare systems?particularly in low- and middle-income regions as well as fragmented regional networks?referrals are blind, static, and manual:

1. **Distance-Biased Routing:** Patients are routinely transported to the geographically closest facility, regardless of whether that facility has an open ICU bed, active surgical theatre, blood, or appropriate specialists.
2. **The "Bouncing" Dilemma:** A patient arrives in critical condition only to be turned away because the only on-duty surgeon is in emergency surgery, the sterilizer broke down, or the blood bank is dry.
3. **Fragmented Communication:** Referrals rely on paper transfer forms and ad-hoc phone calls that frequently go unanswered.
4. **Transit Blind Spots:** Once an ambulance departs, neither the referring facility nor the destination hospital has visibility into transit telemetry, changing patient vitals, or changing receiving capacity.

**Result:** Preventable morbidity and mortality during the critical "Golden Hour," secondary complications, and overwhelmed tertiary facilities.

---

## The Solution: ReferralOS

ReferralOS operates as an active, stateful coordination layer across regional healthcare networks:

```
+----------------------------------------------------------------------------------------+
|                               Client Layer (PHC, Hospital, Medic)                      |
+----------------------------------------------------------------------------------------+
                                           | HTTPS / WSS
                                           v
+----------------------------------------------------------------------------------------+
|                               API Gateway (Kong / Envoy)                               |
+-------------------+----------------------------------+---------------------------------+
                    |                                  |                                 |
                    v                                  v                                 v
+-----------------------+          +-----------------------+          +------------------+
| Referral Service      |          | Capacity Engine       |          | Transport Engine |
| - Triage intake       |          | - Live telemetry      |          | - GPS ingestion  |
| - e-PRP generator     |          | - Resource states     |          | - Dynamic ETAs   |
+-----------+-----------+          +-----------+-----------+          +--------+---------+
            |                                  |                               |
            +----------------------------------+-------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------------+
|                         Dynamic Matching & Reservation Engine                          |
| - Spatial Filtering (PostGIS)                                                          |
| - Hard & Soft Constraint Solver                                                        |
| - Atomic Distributed Locks (Redis TTL)                                                 |
| - Mid-Transit Failover Watcher                                                         |
+------------------------------------------+---------------------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------------+
|                           Persistence & Message Bus Layer                              |
| - PostgreSQL 16 + PostGIS (Persistent Records, Spatial Data)                           |
| - Redis Cluster (Live Capacity State, Distributed Locks, Pub/Sub)                      |
| - Apache Kafka / RabbitMQ (Event-Driven Pipeline, Capacity Invalidation Bus)           |
+----------------------------------------------------------------------------------------+
```

---

## Tech Stack (Recommended Defaults)

- **Backend / Core Engine:** Go (Golang) or TypeScript / Node.js (Fastify) for high-concurrency microservices; Python (FastAPI) for matching heuristic services.
- **Data Persistence:**
  - PostgreSQL 16 with **PostGIS** extension for spatial queries and spatial isochrones.
  - **Redis 7.x** (Cluster mode) for sub-millisecond capacity state caching and distributed locks.
- **Real-Time Communication:** WebSockets, Server-Sent Events (SSE), and MQTT (for vehicle telematics).
- **Frontend / Dashboards:** Next.js (React 19), Tailwind CSS, TanStack Query, Mapbox GL / Leaflet for geospatial tracking.
- **Mobile / Ambulance Terminal:** React Native / Expo or offline-first Progressive Web App (PWA).
- **Infrastructure & Containerization:** Docker, Kubernetes, NGINX / Envoy Gateway.

---

## Repository Architecture & Layout

ReferralOS is structured as a clean monorepo:

```text
referralos/
├── backend/                  # High-performance Core Engine (Node.js/Fastify/TypeScript)
│   ├── src/                  # Application source code
│   │   ├── config/           # Environment and runtime configuration
│   │   ├── infrastructure/   # PostgreSQL (PostGIS) pool & Redis distributed lock clients
│   │   ├── models/           # TypeScript domain types and schemas
│   │   ├── routes/           # Fastify REST & SSE controllers
│   │   ├── services/         # Matching engine, capacity store, failover watcher, audit logs
│   │   └── utils/            # Geospatial Haversine and road travel calculations
│   ├── migrations/           # SQL schema migrations (PostGIS enabled)
│   ├── scripts/              # Seeders and PPH scenario simulation runner
│   ├── tests/                # Full Unit & Integration Test Suites
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Web Dashboard & Ambulance Terminal (Next.js / Tailwind)
├── docs/                     # Comprehensive architectural and clinical documentation
├── README.md
└── package.json              # Root workspace delegation scripts
```

---

## Live Cloud Deployment (For Frontend Integration)

The ReferralOS backend core engine is actively deployed and running on Render with live cloud database and cache connectivity:

| Service | Live URL | Description |
|---|---|---|
| **API Base URL** | `https://referralos.onrender.com/api/v1` | All REST endpoints (referrals, capacity, transport, locks) |
| **Health Check** | `https://referralos.onrender.com/health` | Health status and database/Redis connectivity verification |
| **Real-Time Stream** | `https://referralos.onrender.com/api/v1/notifications/stream` | Server-Sent Events (SSE) live siren audio & reroute events |

### Frontend `.env.local` Configuration
Frontend engineers can immediately connect their local or deployed app by setting:

```bash
NEXT_PUBLIC_API_URL="https://referralos.onrender.com/api/v1"
NEXT_PUBLIC_HEALTH_URL="https://referralos.onrender.com/health"
NEXT_PUBLIC_SSE_URL="https://referralos.onrender.com/api/v1/notifications/stream"
```

*CORS is enabled globally (`*`), allowing the frontend to call the API from `localhost:3000`, Vercel, Netlify, or mobile clients.*

---

## Quickstart & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ or v20+
- PostgreSQL 16 with PostGIS extension (e.g., [Neon](https://neon.tech) or local)
- Redis 7+ (e.g., [Upstash](https://upstash.com) or local)

### 1. Clone & Configure
```bash
git clone https://github.com/divinefavourak/referralos.git
cd referralos
cp backend/.env.example backend/.env
# Configure your DATABASE_URL and REDIS_URL in backend/.env
```

### 2. Install Dependencies
```bash
npm install
# Or: cd backend && npm install
```

### 3. Run Database Migrations & Seed Dataset
```bash
npm run db:migrate
npm run db:seed
```
This enables the `postgis` extension, creates all relational tables, and seeds the regional network: St. Mary's PHC, Hospital A (theatres offline), Hospital B (all available), and Hospital C (standby).

### 4. Run Full Test Suite (Unit & Integration)
```bash
npm run test
# Or unit tests only:
npm --prefix backend run test:unit
# Or integration tests:
npm --prefix backend run test:integration
```
All tests verify geospatial calculations, two-phase constraint satisfaction, Redis atomic multi-resource locking, conflict rejection (409 Conflict), and automated failover rerouting.

### 5. Start the Backend API Gateway
```bash
npm run dev
# The API gateway runs on http://localhost:8080
# Health check: http://localhost:8080/health
```

### 6. Simulate the Postpartum Haemorrhage (PPH) Live Demo
```bash
npm run demo:pph-scenario
```
This script initializes a simulated referral, performs matching, establishes locks, simulates an in-transit theatre failure at Hospital B, demonstrates automated rerouting to Hospital C from the ambulance's live GPS coordinate, and completes QR clinical handover.

---

## Project Documentation Directory

The complete documentation suite is available in the [`docs/`](./docs/INDEX.md) folder:

| Document | Description |
|---|---|
| **[Documentation Hub / Index](./docs/INDEX.md)** | Navigation index and reading guides by role |
| **[Product Overview & Vision](./docs/PRODUCT_OVERVIEW.md)** | Mission statement, strategic paradigm shift, and healthcare outcomes |
| **[System Architecture & Workflow](./docs/ARCHITECTURE.md)** | 7-step operational lifecycle, microservice blueprints, and lock managers |
| **[User Roles & Key User Flows](./docs/USER_ROLES_AND_FLOWS.md)** | RBAC specifications and full PPH demo scenario narrative |
| **[Data Model & Schema](./docs/DATA_MODEL.md)** | Complete Entity-Relationship models and JSON schemas for all entities |
| **[Capacity Matching Logic](./docs/MATCHING_LOGIC.md)** | Constraint satisfaction solver algorithms and scoring functions |
| **[Failover & Edge Cases](./docs/FAILOVER_AND_EDGE_CASES.md)** | Mid-transit capacity invalidation and offline resilience protocols |
| **[API Specification](./docs/API_SPECIFICATION.md)** | Comprehensive REST and WebSocket API contracts |
| **[Hackathon Roadmap & Demo Plan](./docs/ROADMAP.md)** | 5-day hackathon sprint deliverables, live demo checklist, and scaling plan |

---

## License

This project is licensed under the [Apache 2.0 License](LICENSE).
