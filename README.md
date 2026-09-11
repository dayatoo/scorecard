# Company KPI Scorecard

A KPI tracking and scoring app for a hierarchy of Strategic Goals → KPIs →
sub-KPIs → sub-sub-KPIs. Each leaf KPI is scored 0–5 against configurable
targets; parent nodes roll up as the weighted average of their children.

## Score bands

| Band | Range |
| --- | --- |
| Poor | 0 – 2.4 |
| Improvement Needed | 2.5 – 2.9 |
| Meet | 3.0 – 3.4 |
| Good | 3.5 – 3.9 |
| Very Good | 4.0 – 4.5 |
| Excellent | 4.6 – 5.0 |

## Metric types

- **Percentage / Dollar / Quantity / Days**, each with a direction (higher or
  lower is better) and a target mode:
  - **Fixed target**: enter a Poor threshold, the Meet target, and Good/Very
    Good/Excellent thresholds. Hitting the Meet target scores 3.4. Values
    between the Poor threshold and Meet target flat-score 2.9 (Improvement
    Needed). Below the Poor threshold, score is proportional
    (`actual / poorThreshold × 2.4`). Above Meet, the value snaps to the top
    of whichever band (Good/Very Good/Excellent) it falls into; beyond the
    Excellent threshold the score is capped at 5.0.
  - **Range target**: enter an explicit `[min, max]` for every band. The
    score interpolates linearly within whichever band's range contains the
    actual value.
- **Month of completion**: set a target month (Meet). Completing 1/2/3
  months early lands in Good/Very Good/Excellent; up to 1/2 months late
  lands in Improvement Needed/Poor; later than that scores 0. Within a
  month, the score scales linearly by day (day 1 = top of that band, last
  day = bottom).

Scoring logic lives in `src/lib/scoring.ts`, with a standalone sanity check
at `src/lib/scoring.check.ts` (run via `npm run check:scoring`).

## Getting started

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed      # optional: loads sample KPIs across all metric types
npm run dev
```

Open http://localhost:3000:

- **Dashboard** (`/`) — current month + trailing 3 months, per KPI and
  total combined score.
- **Manage KPIs** (`/manage`) — build the Strategic Goal → KPI → sub-KPI
  hierarchy, set weights and target configuration.
- **Enter Data** (`/entry`) — monthly data-entry form for leaf KPIs.

Data is stored locally in SQLite (`prisma/dev.db`); there is no
authentication — this is intended for single-user/internal use.
