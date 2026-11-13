# Endurance Series Reliability & Pace Metrics

_Proposal for gathering race results and scoring teams/drivers on finishing reliability and competitive pace across target series. Intended to support seat-rental and team decisions on GridSeat / Renegade Paddock._

**Targets:** Lucky Dog Racing League (LDRL), ChampCar Endurance Series, IMSA, Zenith Racing Series (ZRS), American Endurance Racing (AER), World Racing League (WRL).

**Related:** Phase 2 race-data work in [`ROADMAP.md`](./ROADMAP.md); GridSeat series relationships in [`VALUATION-COMPARISON.md`](./VALUATION-COMPARISON.md).

---

## Why this exists

Seat buyers and team principals need answers like:

- Which teams actually **finish** endurance races in this class?
- Is a team’s podium rate luck, pace, or reliability?
- Is a driver competitive **in-class**, or only fast relative to slower fields?

Raw overall finish position is misleading across these series because **class models differ**. Reliability and pace must be computed **within series + class + race duration**, then rolled up carefully.

---

## Series data map

| Series | Class model | Primary results source | Secondary / live | Ingest difficulty |
|--------|-------------|------------------------|------------------|-------------------|
| **LDRL** | Performance buckets A / B / C (+ Super Dog) | League results pages + MyLaps / Speedhive | Race Monitor, Red Mist | Medium — event pages link results; class can change mid-event |
| **ChampCar** | Spec/EC-style amateur enduro; class awards | **MYLAPS Speedhive** (split archives: pre/post Mar 2025) | Race Monitor at many events | Low–medium — strong Speedhive archive; Race Monitor often present |
| **IMSA** | Fixed pro classes (GTP, LMP2, GTD Pro, GTD, …) | **Al Kamel** results portal (`imsa.results.alkamelcloud.com`) — JSON/CSV | Al Kamel live protocols; IMSA site | Low for official session files; higher if live feed needed |
| **Zenith** | PWR classes (ZR2–ZR4, ZP2; ZR1/ZP1 expanding) | **Al Kamel** scoring noticeboard / live timing | FloRacing / series app | Medium — Al Kamel like IMSA; confirm third-party export access |
| **AER** | Qualifying-based performance classing (“run what ya brung”) | Custom portal [`race.americanenduranceracing.com/results`](https://race.americanenduranceracing.com/results) | Series custom T&S monitoring | Medium–high — not Speedhive-first; may need scrape/API ask |
| **WRL** | Fixed PWR classes: GTO, GTU, GP1, GP2, GP3 | **Speedhive** (linked from event pages) | Race Monitor when relayed | Low–medium — same Speedhive pattern as ChampCar |

### Practical takeaway

Do **not** rely on a single feed:

1. **Race Monitor API** — best first mile where events use Race Monitor relaying (ChampCar, LDRL, many WRL/club events). Matches existing Phase 2 plan. Coverage is incomplete; series can restrict third-party access.
2. **Speedhive / MyLaps** — ChampCar, WRL, much of LDRL historical depth. Event-level HTML/JSON scraping or official partner access.
3. **Al Kamel** — IMSA (structured, excellent) and Zenith. Prefer official session JSON/CSV over live sockets for v1 analytics.
4. **Series-owned portals** — AER results site; LDRL event result links; ChampCar contingency/winners pages as enrichment.

---

## Recommended solution architecture

### Goal

A **normalized race-results warehouse** keyed by `(series, event, session, car/entry, class)` with lap-level data when available, plus **derived reliability and pace metrics** for teams and drivers.

### Components

```text
┌─────────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│ Race Monitor API│  │ Speedhive    │  │ Al Kamel    │  │ Series sites │
│ (live + results)│  │ (Champ/WRL/  │  │ (IMSA/ZRS)  │  │ (AER, LDRL)  │
└────────┬────────┘  │  LDRL)       │  └──────┬──────┘  └──────┬───────┘
         │           └──────┬───────┘         │                 │
         └──────────────────┴─────────┬───────┴─────────────────┘
                                      ▼
                         Ingest adapters (per source)
                                      ▼
                         Canonical race results store
                         (events, entries, classes, laps,
                          status, penalties, stints)
                                      ▼
                         Metrics jobs (class-normalized)
                                      ▼
                         Team / driver scorecards → seat UX
```

### Implementation plan (fits current stack)

| Phase | Work | Notes |
|-------|------|--------|
| **A — Foundations** | Separate **results** tables from seat-calendar `raceEvents` (naming collision already noted in ROADMAP). Propose: `seriesCatalog`, `timingEvents`, `timingSessions`, `entryResults`, `lapTimes`, `stints`, `entityAliases`. | Avoid overloading seat-offering schema. |
| **B — Race Monitor path** | Keep Phase 2 `raceMonitor.ts` + daily cron; claim flow by competitor ID. | Fastest path for ChampCar/LDRL/WRL overlap. |
| **C — Speedhive backfill** | Adapter that resolves series org → events → sessions → classifications + lap charts. Seed ChampCar + WRL first (richest archives). | Historical finishing-rate needs years of data, not just live. |
| **D — Al Kamel path** | IMSA session JSON/CSV importer; Zenith noticeboard once access confirmed. | Highest-quality class labels and stint analysis. |
| **E — AER / LDRL fillers** | AER portal scraper or partner CSV dump; LDRL event-page + Speedhive hybrid. | Manual/admin result upload as fallback (already in ROADMAP risks). |
| **F — Identity resolution** | Map external entry IDs → `teams` / `driverProfiles` / `teamCars` via aliases, car numbers, and claim verification. | Critical for decision UX; expect messy amateur naming. |

### Data contracts (minimum fields per entry-result)

- Series, event id, track, race date, scheduled duration (hours)
- Session type (`endurance_race` | `qualifying` | `sprint` — Zenith Sprint Cup vs enduro)
- Car number, team name, vehicle description
- **Class at start** and **class at finish** (LDRL/AER mid-race moves)
- Laps completed, race laps (leader), finish position overall + in-class
- Status: `finished` | `DNF` | `DNS` | `DSQ` | `NC` (not classified)
- Best lap, average green-flag lap (if computable), pit/stop count
- Driver roster / stint times when Driver ID exists (IMSA, Zenith, some MyLaps)

**Classified finish rule (endurance):** treat as finished only if the series classified the car (typically % of winner’s laps — IMSA/WEC-style — or series-specific). Store both raw status and our normalized `classifiedFinish` boolean so finishing rate isn’t inflated by “still rolling at checker but NC.”

### Compliance / ops

- Prefer licensed APIs (Race Monitor subscription, Al Kamel partner access) over brittle scrapers where possible.
- Respect robots/ToS; cache aggressively; store provenance (`source`, `sourceEventId`, `fetchedAt`).
- Do not publish live timing as a product feature in v1 (already out of scope for this year in ROADMAP); use post-race official results for metrics.

---

## Metrics that indicate good reliability

All rates below should be computed **per series × class**, with optional filters for race length buckets (e.g. ≤6h, 7–12h, ≥14h / “double” weekends).

### Primary reliability metrics

| Metric | Definition | Why it matters |
|--------|------------|----------------|
| **Classified finish rate** | `# classified finishes / # starts` | Core “do they finish?” signal for seat buyers |
| **Mechanical DNF rate** | Mechanical/engine/gearbox/suspension DNFs / starts | Separates car prep from driver incidents when status text allows |
| **Incident DNF rate** | Contact / off / crash DNFs / starts | Driver/team risk profile |
| **Laps completed %** | Mean `laps / race_laps` for starts | Softer than binary finish; catches “retired with 1 hour left” |
| **Time-in-car %** | Sum green-flag time on track / scheduled race duration | Captures long repairs that still “finish” |
| **Early-exit rate** | DNF or last lap before 50% distance / starts | Flags chronic early failures |
| **Double-header survival** | Both races classified finish on dual weekends (ChampCar, AER, WRL, Zenith Dual) | Endurance ops stress test |

### Secondary reliability / ops metrics

- **Unscheduled stop count** (pit stops beyond expected fuel/driver cadence) — when stint data exists
- **Penalty laps / time** — reliability of procedure, not just the car
- **Same-car consecutive finishes** streak — prep consistency
- **Driver stint completion** — % of assigned stints completed without car retirement mid-stint (driver-level)

### How to score “low finishing rate” teams

Flag teams in a class with:

1. ≥ **N starts** (recommend N≥4 in rolling 24 months) **and**
2. Classified finish rate **≤ series-class median − 1σ** (or absolute &lt; 70% as a simple v1 threshold), **or**
3. Early-exit rate in the top quartile of that class.

Publish both the rate and sample size — never rank a team with 1 DNF as “unreliable.”

---

## Metrics that indicate competitive pace

Pace must be **class-relative**. Never compare LDRL Class C lap times to WRL GTO or IMSA GTD.

### Primary pace metrics

| Metric | Definition | Notes |
|--------|------------|-------|
| **In-class median lap gap** | Entry median green lap − class median green lap | Robust to one hero lap |
| **In-class best-lap percentile** | Percentile of best lap within class | Qualifying-ish speed |
| **Race pace index** | Entry mean of laps within 102–107% of own best (or of class best) | Stable race pace vs one-lap pace |
| **% laps within X% of class leader best** | Share of green laps ≤ 105% (tune X by series) of class best that session | Consistency under traffic |
| **Stint degradation** | Slope of lap time vs stint lap # | Tire/fuel/driver fade |
| **Class finishing position avg** | Mean in-class position among classified finishers | Outcome, not pure pace |
| **Expected vs actual position** | Rank by race-pace index vs actual class finish | Strategy/reliability gap |

### Class-model caveats (do not ignore)

| Series | Caveat for pace/reliability |
|--------|-----------------------------|
| **LDRL / AER** | Class can be assigned from qualifying and **moved mid-race**. Store start/finish class; attribute DNFs to finish class; for pace, use the class the car spent most green laps in. |
| **ChampCar** | Large fields; overall P1 ≠ class win. Always segment by class / EC. Amateur driver pools vary wildly week to week — prefer **percentile within event-class**, not absolute lap times across weekends. |
| **WRL / Zenith** | PWR classes are comparable week to week if rules stable; still normalize by track. Zenith: separate Sprint Cup sessions from endurance. |
| **IMSA** | Cleanest fixed classes; BoP and weather still matter — normalize by event. Pro/Am splits in GTD matter for driver metrics. |

### Composite scorecards (recommended UX)

For each **team-car in a series-class** (rolling 12–24 months):

1. **Reliability score (0–100)** — weighted: classified finish rate (50%), laps completed % (25%), early-exit inverted (15%), penalties (10%).
2. **Pace score (0–100)** — weighted: race pace index percentile (40%), in-class finish avg percentile (30%), consistency (% laps in window) (20%), best-lap percentile (10%).
3. **Seat decision badge** — e.g. `Reliable & midpack`, `Fast but fragile`, `Finishes but slow`, `Elite` — based on score quadrants.

For **drivers**, prefer stint-level pace and incident rates when Driver ID exists; otherwise only team-level reliability is honest.

---

## MVP recommendation (what to build first)

1. **ChampCar + WRL via Speedhive + Race Monitor** — densest amateur enduro overlap with GridSeat relationships; enough history for finish rates.
2. **IMSA via Al Kamel JSON** — proves fixed-class metrics; high brand value; cleaner ground truth for metric design.
3. **LDRL + AER** next — performance classing needs the start/finish class fields from day one.
4. **Zenith** once Al Kamel access is confirmed (same adapter family as IMSA).

Ship a **Team Reliability** page and seat-offering callouts (“Class B finish rate 92% over 8 starts”) before live timing or fancy telemetry.

### Explicit non-goals for v1

- Cross-series absolute lap-time rankings
- Live race strategy tools
- MoTeC/AiM telemetry
- Betting / gambling products

---

## Decision checklist for buyers

When evaluating a team for a seat in a given series/class:

1. Starts sample size adequate?
2. Classified finish rate vs class peers?
3. Mechanical vs incident DNF mix?
4. Race-pace percentile in-class (not overall)?
5. Dual-weekend / long-race survival if the event is 14h+ or double 8h?
6. Same chassis and class as the seat being sold?

If (2) or (3) fail, treat as **low finishing / reliability risk** regardless of marketing or one-off podiums.

---

## Open actions

- [ ] Confirm Race Monitor third-party coverage for ChampCar, LDRL, WRL event sample (2024–2026).
- [ ] Request Al Kamel / series data access for Zenith (and formalize IMSA historical pull).
- [ ] Ask AER for bulk results export or feed (portal scrape is fallback).
- [ ] Define `classifiedFinish` rules per series from current rulebooks.
- [ ] Extend ROADMAP Phase 2 schema names to avoid collision with seat `raceEvents`.
