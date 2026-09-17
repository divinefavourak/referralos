# ReferralOS: Real-Time Capacity Matching Logic

## 1. Algorithmic Overview

The ReferralOS Matching Engine is a multi-phase constraint satisfaction and optimization solver. It evaluates patient clinical requirements against the live, dynamic capacity of surrounding healthcare facilities within a viable travel time window.

```
[ All Facilities in Regional Network ]
                    ?
                    ?
  [ Phase 1: Hard Constraint Filtering ]
  - Travel Isochrone (Travel Time <= T_max)
  - Operating Theatre Ready? (Boolean)
  - Mandatory Specialist On-Site/On-Call? (Boolean)
  - Blood Products in Stock? (Stock >= Required)
  - Target Bed Tier Available? (Count >= 1)
  - Facility Operational Status == "OPERATIONAL"
                    ?
                    ? (Eliminates non-viable facilities)
                    ?
       [ Viable Candidate Subset ]
                    ?
                    ?
  [ Phase 2: Multi-Criteria Decision Analysis (MCDA) Scoring ]
  - Travel Time Score (Inverse linear function)
  - Capacity Redundancy Buffer Score
  - Historical Handover Efficiency Score
  - Emergency Room Overcrowding Penalty
                    ?
                    ?
 [ Ranked Facility Recommendation Set with Clinical Rationale ]
```

---

## 2. Phase 1: Hard Constraint Filtering

Hard constraints are non-negotiable binary filters. A candidate facility must satisfy all hard constraints simultaneously to be considered viable.

Let:
- $R$ be the referral requirement bundle.
- $F_i$ be candidate facility $i$.
- $L_{\text{origin}}$ be the coordinates of the patient or transport unit.
- $T(L_{\text{origin}}, F_i)$ be the dynamic road-network travel duration (in minutes) computed via OSRM/Valhalla.
- $T_{\max}$ be the maximum permissible transport duration for the patient's triage acuity (e.g., 60 minutes for `CRITICAL`, 120 minutes for `URGENT`).

The binary viability indicator $\mathbb{V}(F_i) \in \{0, 1\}$ is defined as:

$$\mathbb{V}(F_i) = \mathbb{I}\Big(T(L_{\text{origin}}, F_i) \le T_{\max}\Big) \times \mathbb{I}\Big(\text{Status}(F_i) = \text{"OPERATIONAL"}\Big) \times \prod_{c \in \text{Resources}(R)} \mathbb{I}\Big(\text{Avail}(F_i, c) \ge \text{Req}(R, c)\Big)$$

Where:
- $\mathbb{I}(E) = 1$ if condition $E$ is true, and $0$ otherwise.
- $\text{Avail}(F_i, c)$ represents the currently unreserved, operational quantity of resource $c$ at facility $F_i$.

**If $\mathbb{V}(F_i) = 0$, facility $F_i$ is immediately eliminated from the ranking phase.**

---

## 3. Phase 2: Multi-Criteria Decision Analysis (MCDA) Scoring

Facilities in the viable candidate subset are scored on a scale of $0$ to $100$ using a calibrated multi-factor utility function:

$$\text{Score}(F_i) = w_t \cdot S_{\text{travel}}(F_i) + w_c \cdot S_{\text{cap}}(F_i) + w_h \cdot S_{\text{handover}}(F_i) - P_{\text{congestion}}(F_i)$$

### 3.1 Travel Duration Score ($S_{\text{travel}}$)
Penalizes longer travel times linearly with respect to the maximum threshold $T_{\max}$:

$$S_{\text{travel}}(F_i) = \max\left(0, 100 \cdot \left(1 - \frac{T(L_{\text{origin}}, F_i)}{T_{\max}}\right)\right)$$

### 3.2 Capacity Redundancy Buffer Score ($S_{\text{cap}}$)
Rewards facilities with deeper reserve capacity. A hospital with three open operating theatres and 10 units of blood offers a lower risk of concurrent lock collisions than a hospital with exactly one unit remaining:

$$S_{\text{cap}}(F_i) = 100 \cdot \min\left(1.0, \frac{1}{|R|} \sum_{c \in R} \frac{\text{Avail}(F_i, c)}{2 \times \text{Req}(R, c)}\right)$$

### 3.3 Handover Efficiency Score ($S_{\text{handover}}$)
Reflects historical facility performance, measured as the rolling 30-day average duration between ambulance bay arrival and completed clinical triage:

$$S_{\text{handover}}(F_i) = \max\left(0, 100 \cdot \left(1 - \frac{\bar{H}(F_i)}{H_{\max}}\right)\right)$$
*(Where $H_{\max} = 45\text{ minutes}$, and $\bar{H}$ is average handover minutes).*

### 3.4 Congestion & Overcrowding Penalty ($P_{\text{congestion}}$)
Dampens the score of facilities experiencing severe emergency department gridlock, preventing referral pile-ups:

$$P_{\text{congestion}}(F_i) = \lambda \cdot \left(\frac{\text{OccupiedBeds}(F_i)}{\text{TotalBeds}(F_i)}\right)^2$$
*(Default $\lambda = 15.0$, scaling exponentially as occupancy approaches 100%).*

---

## 4. Calibrated Model Weights

The default weights prioritize minimizing transit time while ensuring high capacity confidence and operational stability:

| Parameter | Symbol | Default Value | Clinical Rationale |
|---|---|---|---|
| **Travel Duration Weight** | $w_t$ | `0.45` | Preserves the golden hour in acute emergencies |
| **Capacity Buffer Weight** | $w_c$ | `0.30` | Minimizes lock failure probability and handles patient surges |
| **Handover Speed Weight** | $w_h$ | `0.15` | Rewards facilities that process pre-arrival admissions quickly |
| **Congestion Factor** | $\lambda$ | `10.0` | Prevents routing patients into overcapacity ER waiting rooms |

$$\sum w = w_t + w_c + w_h = 0.45 + 0.30 + 0.15 = 0.90$$
*(The remaining 0.10 margin accounts for the variable congestion penalty).*

---

## 5. Performance SLAs & Execution Architecture

- **Sub-120ms Latency Target:** The matching engine executes within 120ms for a regional cluster of 500 facilities.
- **In-Memory Bitmaps:** Active resource availability states are maintained in Redis bitsets (`facility:<id>:resources`), allowing microsecond-level binary constraint evaluation.
- **Pre-Computed Isochrones:** Spatial travel matrices between major primary clinics and receiving hospitals are cached in Redis and refreshed every 5 minutes using real-time traffic inputs.
