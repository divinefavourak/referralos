# ReferralOS Documentation Hub

Welcome to the complete technical and product documentation for **ReferralOS**, the real-time healthcare referral and capacity-routing system.

---

## Document Directory

| Document | Description | Target Audience |
|---|---|---|
| **[Product Overview & Problem Statement](./PRODUCT_OVERVIEW.md)** | Core premise, strategic vision, paradigm shift, and why current referral systems fail | Product Managers, Health Authorities, Executives |
| **[System Architecture & Workflow](./ARCHITECTURE.md)** | 7-step operational lifecycle, microservice topology, and component blueprints | Architects, Systems Engineers, Tech Leads |
| **[User Roles & Key User Flows](./USER_ROLES_AND_FLOWS.md)** | RBAC profiles and the end-to-end Postpartum Haemorrhage (PPH) demo walkthrough | Clinicians, UX Designers, Operations Teams |
| **[Data Model & Schema Specification](./DATA_MODEL.md)** | Complete Entity-Relationship diagrams and JSON schemas for all core entities | Backend Engineers, Database Administrators |
| **[Real-Time Capacity Matching Logic](./MATCHING_LOGIC.md)** | Constraint satisfaction algorithms, multi-criteria scoring models, and mathematical formulas | Algorithm Engineers, Data Scientists |
| **[Edge Cases & Failover Protocols](./FAILOVER_AND_EDGE_CASES.md)** | Mid-transit rerouting, distributed locks, TTL auto-extension, and offline SMS fallback | Reliability Engineers, Paramedics, Triage Nurses |
| **[API Specification](./API_SPECIFICATION.md)** | REST endpoints, WebSocket/SSE streams, request/response payloads, and error codes | Frontend/Backend Developers, Integrators |
| **[Hackathon Roadmap & Demo Plan](./ROADMAP.md)** | 5-day hackathon sprint deliverables, live demo checklist for judges, and scaling plan | Judges, Hackathon Teams, Product Leads |

---

## Quick Navigation by Role

- **Software Engineers & Integrators:** Start with [Architecture](./ARCHITECTURE.md) -> [Data Model](./DATA_MODEL.md) -> [API Specification](./API_SPECIFICATION.md).
- **Clinical Directors & EMS Leads:** Read [Product Overview](./PRODUCT_OVERVIEW.md) -> [User Roles & Flows](./USER_ROLES_AND_FLOWS.md) -> [Failover Protocols](./FAILOVER_AND_EDGE_CASES.md).
- **Data & Algorithmic Engineers:** Review [Matching Logic](./MATCHING_LOGIC.md) -> [Data Model](./DATA_MODEL.md).
