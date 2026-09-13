# Company KPI Scorecard

Tracks a company's KPIs for a financial year and scores them 0–5.

KPIs form a hierarchy up to five levels deep — Strategic Goal → KPI → sub-KPI →
sub-sub-KPI → sub-sub-sub-KPI. Only the lowest-level KPIs carry a metric,
targets and a weight; everything above is the weighted average of what sits
beneath it, up to a single combined score for the company.

Weight is a share of a KPI's own siblings, not of the whole company — the
company-wide ("global") share is derived and shown read-only. Every group
(Strategic Goals included) should sum to 100; a group that doesn't is warned
about, never blocked, and its shares are applied proportionally.

- **Dashboard** — the hierarchy for the current month and the three before it,
  with the total combined score.
- **KPIs** — every lowest-level KPI in one sortable, filterable table, or one
  hierarchy level at a time.
- **KPI pages** — score history, charts, targets, status updates, editing
  every attribute (including metric type, target mode and direction), and a
  record of past changes.
- **Hierarchy** — add, move, re-order or delete KPIs directly, without
  needing to import a spreadsheet.
- **Deadlines** — what is due in the next three months, and what is overdue.
- **Enter Data** — the month's figures for every KPI in one screen.
- **Import / Export** — the whole scorecard as an Excel workbook, with an
  Update-only mode so an import can't silently remove what was built in the app.

## How scoring works

### Bands

| Band | Score |
| --- | --- |
| Poor | 0 – 2.4 |
| Improvement Needed | 2.5 – 2.9 |
| Meet | 3.0 – 3.4 |
| Good | 3.5 – 3.9 |
| Very Good | 4.0 – 4.5 |
| Excellent | 4.6 – 5.0 |

Every score is rounded to one decimal place. The gaps between bands are exactly
one decimal step, so a rounded score always falls inside a band and never
between two.

### The year

The financial year runs **1 April to 31 March**. Figures entered each month are
**cumulative year-to-date** and are compared against the **full-year** target,
so scores climb through the year as the company works towards its targets.

Each year is a separate scorecard with its own hierarchy, weights and targets —
so changing next year's targets never rewrites last year's scores. A new year
can be started as a copy of the previous one.

### Targets

The target for every KPI is set at **Meet**. Doing better earns Good, Very Good
or Excellent; doing worse earns Improvement Needed or Poor.

**Fixed targets** — one number per band. Reaching a band's target scores the
**top** of that band: hit the Meet target and you score 3.4, reach the Good
target and you score 3.9. Targets normally step by one unit and must get harder
from Poor through to Excellent. Falling short of even the Poor target scores
proportionally within the Poor band (`2.4 × actual ÷ Poor target`), and going
beyond the Excellent target earns nothing further — 5.0 is the cap.

**Range targets** — a window of values per band, e.g. `70-79` for Meet. The
score scales across that window between the band's lowest and highest score, so
a figure halfway through the Good window scores halfway between 3.5 and 3.9.

Either kind can be **higher is better** (revenue, completion) or **lower is
better** (cost, days taken, turnover).

Money KPIs use the `DOLLAR` metric type, with the currency as the unit —
**BND** by default. Change `DEFAULT_CURRENCY` in `src/lib/config.ts` to use a
different one; existing KPIs keep whatever unit they were given.

### Month of completion

For a milestone, the target month is the Meet target. Finishing one, two or
three months early scores Good, Very Good or Excellent; one or two months late
scores Improvement Needed or Poor; later than that scores 0. Within a month the
score scales by the day — with a target of October 2026, finishing on 1 October
scores 3.4 and 31 October scores 3.0.

A milestone with no completion date sits out of the scorecard until its target
month has passed. After that it scores as though it were completed on the last
day of the month being reported, so a slipping milestone pulls the score down
without anyone having to enter anything.

### Deadlines on other KPIs

A KPI that is time-bound even though its metric is not can carry a **deadline
month**, meaning the last day of that month. Once the deadline passes there are
two behaviours, chosen per KPI:

- **Award partial credit** (the default) — later achievement still counts, but
  is capped by how late it is: **2.9** one month late, **2.4** two months late,
  and **0** after that. These are the tops of exactly the bands the
  month-of-completion rule gives to being one and two months late, so lateness
  means the same thing throughout. Being a cap, it only ever lowers a score — a
  KPI already below the cap is left alone.
- **Freeze the score** — the score is fixed at whatever it was in the deadline
  month. Anything achieved afterwards is recorded, but does not change it.

### Actuals and estimates

Each monthly figure is marked as an **actual** or an **estimate**. They score
identically; the difference is which figure gets used and how it is presented.
A KPI with no actual yet falls back to its most recent estimate, and any score
resting on one is marked `est` so a provisional total is never mistaken for a
settled one.

### Missing data

A KPI with no figure for a month is **left out** of its parent's average rather
than counted as zero, and the remaining KPIs are reweighted. Every score is
shown alongside the share of its weight that actually has a figure behind it,
so a score resting on half the data is visible as such. That figure aggregates
all the way up — a branch that is only half reported carries only half its
weight into the total.

### Weights

Every lowest-level KPI carries a weight as a percentage of the whole company,
and they should add up to 100. A parent's weight is the sum of the KPIs beneath
it. The app warns when the weights do not add up, but keeps working.

## Running it locally

Requires Node.js 20.9+ and a Postgres database.

```bash
npm install
cp .env.example .env      # fill in your database strings and a password
npx prisma migrate deploy # create the tables
npm run seed              # optional: a small sample scorecard
npm run dev
```

Open http://localhost:3000 and sign in with the `APP_PASSWORD` you set.

## Importing your KPIs

Build the hierarchy in a spreadsheet rather than clicking through a hundred
forms. On the **Import** page, download the blank template (or the filled
example), fill it in, and upload it back.

Each row is one KPI. Put a parent's `Code` in a child's `Parent Code` column to
build the hierarchy; leave `Parent Code` blank for a Strategic Goal. The
workbook's Readme sheet explains every column.

KPIs are matched on their `Code`, so re-importing an edited sheet updates them
in place and keeps the figures already recorded. A KPI whose code has
disappeared from the sheet is removed along with its figures, which is why the
import shows you what it is about to do and asks you to confirm.

Exporting produces the same format plus a Scores sheet, so you can export,
edit in Excel, and import straight back.

## Dates

Dates are written and read as **dd/mm/yyyy** throughout — typed that way,
displayed that way, and summarised that way when you confirm a save. The app
deliberately does not use the browser's own date control, which renders in each
viewer's OS language and would show mm/dd/yyyy to some colleagues and
dd/mm/yyyy to others.

Months, where a day would be meaningless — a milestone's target month, a
deadline — are shown by name, e.g. "October 2026".

## Access

There are no user accounts — a single shared password (`APP_PASSWORD`) opens
the app. The session cookie holds a signed token rather than the password
itself. Departments are labels for filtering and ownership, not logins.

## Saving

Nothing is written as you type. Edits are held until you press **Save** and
confirm a summary of exactly what is changing, old value to new. This is true
of the KPI pages, the data-entry grid and the management screens alike. Status
updates are the one exception: they post immediately, since they only ever add.

## Development

```bash
npm test          # scoring engine, auth, and workbook round-trip
npm run lint
npx tsc --noEmit
npm run build
npm run verify    # all of the above

npx tsx scripts/check-scorecard.ts 2026-08   # print a scored tree to the console
```

End-to-end tests drive a real browser against a running app:

```bash
npm run build && npm run start    # terminal 1
npx playwright test               # terminal 2
```

The scoring rules live in `src/lib/scoring.ts` as a pure module, with
`src/lib/scoring.test.ts` covering every rule above — the worked examples in
this README are assertions in that file.

## Deploying

See [docs/deploy.md](docs/deploy.md) for a step-by-step walkthrough of putting
this on the web with Supabase and Vercel, without writing any code.
