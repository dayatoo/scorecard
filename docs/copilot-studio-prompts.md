# Rebuilding the KPI Scorecard in Microsoft Copilot Studio

This file holds copy-paste prompts for rebuilding the scorecard in the Microsoft
stack. The target is a **Copilot Studio agent** working on **Dataverse tables**,
with **Power Automate (agent) flows** doing the scoring, imports, approvals and
fiscal-year lifecycle. The web app's screens become chat turns and adaptive cards.

Every rule here comes from this repository's code, mainly `src/lib/scoring.ts`,
`src/lib/scoring-modes.ts`, `src/lib/insights.ts`, `prisma/schema.prisma` and
`src/app/actions/*`. When this file and the README disagree, the code wins and
this file follows the code. For example, a milestone two or more months late
decays to 0 at fiscal year end. It doesn't drop to 0 straight after month two.

---

## How to use this file

Build in the order of the sections below. Each prompt is in a fenced block and
says where to paste it:

| Where | What you paste |
| --- | --- |
| **Power Apps → Tables → "Start with Copilot" / "Describe the new tables"** | Table prompts (section 2) |
| **Power Platform admin center / Power Apps → Security roles** | Built by hand from the spec in section 3 (Copilot can't create roles) |
| **Copilot Studio → Create → "Describe your agent"**, then **Overview → Instructions** | Agent prompt (section 4) |
| **Copilot Studio → Knowledge → upload file** | The rulebook (section 1.3), saved as `scorecard-rulebook.md` |
| **Copilot Studio → Topics → Add → "Create from description with Copilot"** | Topic prompts (section 6) |
| **Copilot Studio → Tools/Flows → New agent flow → "Describe it to design it"**, or **Power Automate → Create → "Describe it to design it"** | Flow prompts (sections 5 and 7) |
| **Adaptive Card Designer (adaptivecards.io/designer)**, or ask Copilot Studio's "Ask with adaptive card" node to generate the JSON | Card prompts (section 8) |

Copilot generates a first draft every time. Review each table, flow and topic
against the spec before moving on. **Generated flows almost always need the
arithmetic expressions checked by hand.** Section 9 has the test cases to
check them against.

Conventions used throughout:

- Publisher prefix `sc_`. Every artifact goes in one solution called **KPI Scorecard**.
- A **period** is text in the form `YYYY-MM`, e.g. `2026-10`.
- The fiscal year runs **1 April → 31 March**. Fiscal month 1 is April and fiscal month 12 is March.
- Dates are shown as **dd/mm/yyyy**. Months on their own are shown by name, e.g. "October 2026".
- Weights are shown to **2 decimals**, e.g. "25.00%". Scores are shown to **1 decimal**.

---

## 1. Architecture

### 1.1 What maps to what

| Web app | Copilot Studio rebuild |
| --- | --- |
| Postgres + Prisma models | Dataverse tables (section 2) |
| Username/password, sessions, lockout, password reset | **Microsoft Entra ID** sign-in on the agent. Lockout, password change and reset all move to Entra. The app keeps its own *approval* and *role* in `sc_AppUser`. |
| Roles MEMBER / ADMIN, department-scoped writes | Dataverse security roles, plus checks inside each flow (section 3) |
| `src/lib/scoring.ts` (pure engine) | Flow **F-01 Score leaf** and **F-02 Roll up** (section 5), with results cached in `sc_KpiScore` |
| Dashboard, KPI list, KPI detail | Topics T-01 to T-03, which read `sc_KpiScore` and render cards |
| Enter Data grid, KPI report form | Topic T-04 with an entry card, then flow F-10 Save entries |
| Settings edit and proposals | Topic T-06, then flows F-11 (direct save) and F-12 (propose), with F-13 to approve or reject |
| Hierarchy editor, Weights editor | Topics T-07 and T-08, then flows F-14 to F-17 |
| Insights, Simulate, Deadlines, Board report | Topics T-09 to T-12, then flows F-03, F-04, F-05 and F-20 |
| Fiscal years, Close/Reopen, Holding | Topic T-13, then flows F-30 to F-35 |
| Checkpoints (backup/restore JSON) | Topic T-14, then flows F-36 to F-39 |
| Excel import/export | Topic T-15, then flows F-40 to F-42 |
| Users, approvals, departments | Topics T-16 and T-17, then flows F-50 to F-53 |
| Change log, audit export | Topic T-18, then flow F-42 |
| Calibration (score override) | Topic T-19, then flow F-18 |

### 1.2 Scoring architecture choice (decide before section 5)

The scoring engine is about 900 lines of exact arithmetic. You have two options:

- **Option A (recommended for exact fidelity):** host `src/lib/scoring.ts`,
  `scoring-modes.ts` and `insights.ts` as an Azure Function (Node.js). They are
  pure TypeScript with no dependencies. Wrap the function in a **custom
  connector** and call it from flows. Every score then matches the web app to
  the decimal. The prompts in section 5 still describe *what* the flow sends and
  receives. Swap the "compute" steps for one connector call.
- **Option B (no custom code):** build the engine as Power Automate flows using
  the prompts in section 5 as written. This works, but each formula needs
  checking against section 9.

Either way, results are written to **`sc_KpiScore`** (one row per KPI per
period). The agent reads that cache instead of recomputing a whole tree on
every chat turn. Flow **F-06 Recalculate** refreshes it whenever data changes.

### 1.3 The rulebook (upload as agent knowledge **and** paste into flow prompts)

Save the block below as `scorecard-rulebook.md`. Upload it under
**Knowledge** so the agent can explain scores. Paste it into any flow prompt
marked "include the rulebook".

```text
KPI SCORECARD RULEBOOK

YEAR AND PERIODS
- Fiscal year runs 1 April to 31 March. Label "FY2026/27" = start year 2026.
- Period = "YYYY-MM". Fiscal month: April=1 ... March=12, i.e. ((month - 4 + 12) mod 12) + 1.
- monthsBetween(a, b) = (b.year - a.year)*12 + (b.month - a.month).

HIERARCHY AND WEIGHTS
- Up to 5 levels: Strategic Goal > KPI > sub-KPI > sub-sub-KPI > sub-sub-sub-KPI.
- Only leaves (KPIs with no children) carry a metric, targets and data.
- Local weight = share of its siblings; each sibling group should sum to 100.
  Not summing to 100 is a WARNING, never blocked; shares are applied proportionally.
- Global weight = parent global weight x (own local weight / sum of sibling local weights).
  Strategic Goals: global = local / sum of all Goal weights x 100. Read-only, shown to 2 dp.

BANDS (score ranges, inclusive, 1 dp)
- Poor 0.0-2.4 | Improvement Needed 2.5-2.9 | Meet 3.0-3.4 | Good 3.5-3.9 | Very Good 4.0-4.5 | Excellent 4.6-5.0
- Band order (worst to best): POOR, IMPROVEMENT_NEEDED, MEET, GOOD, VERY_GOOD, EXCELLENT.
- roundScore(x) = round(clamp(x, 0, 5) x 10) / 10, half rounds up. Every displayed score passes through it.

METRIC TYPES: PERCENTAGE, DOLLAR (unit default "BND"), QUANTITY, DAYS, MONTH_COMPLETION, VARIANCE.
DIRECTION: HIGHER_BETTER or LOWER_BETTER. TARGET MODE: FIXED or RANGE (not used by MONTH_COMPLETION).

FIXED TARGETS (one number per band)
- Walk from EXCELLENT down to IMPROVEMENT_NEEDED; the first band whose target the value reaches
  scores the TOP of that band (Meet hit = 3.4, Good hit = 3.9, Excellent hit = 5.0).
  "Reaches" = actual >= target (higher better) or actual <= target (lower better).
- Reaching POOR target but nothing better = 2.4.
- Short of Poor, higher-better: 2.4 x clamp(actual / poorTarget, 0, 1); if poorTarget <= 0: 2.4 when actual >= poorTarget else 0.
- Short of Poor, lower-better: if actual <= 0 then 2.4; if poorTarget < 0 then 0; else 2.4 x clamp(poorTarget / actual, 0, 1).
- Targets must get strictly harder from Poor to Excellent (validation error otherwise).

RANGE TARGETS (a [min, max] window per band)
- Order windows by value: higher-better = POOR..EXCELLENT; lower-better = EXCELLENT..POOR.
- The lowest-value window is open below; the highest-value window is open above.
- Inside a band's window, position = clamp((actual - lo) / (hi - lo), 0, 1);
  higher-better score = bandLo + position x (bandHi - bandLo);
  lower-better score  = bandHi - position x (bandHi - bandLo). If lo == hi, score = bandHi.
- A value in a gap between windows: 0 if it is on the worse side, 5 if on the better side.

VARIANCE
- Each month records Value (actual) and Planned Value. Scored value = |actual - planned| / planned x 100.
- If planned is missing or 0: no score (NO_DATA). Scored as LOWER_BETTER RANGE.

MONTH_COMPLETION (milestones)
- targetConfig = { targetMonth: "YYYY-MM" } = the Meet month. delta = monthsBetween(targetMonth, completionMonth).
- delta < -3 : 5.0
- delta -3 / -2 / -1 / 0 / +1 : Excellent / Very Good / Good / Meet / Improvement Needed band,
  scaled by day in the completion month: position = (day - 1) / (daysInMonth - 1);
  score = bandHi - position x (bandHi - bandLo). Example (target Oct 2026): 1 Oct = 3.4, 31 Oct = 3.0.
- delta >= +2 : Poor, decaying linearly from 2.4 at the 1st of (targetMonth + 2) down to 0 on
  31 March (fiscal year end of the target month). score = 2.4 x (1 - clamp(elapsedDays / totalDays, 0, 1)).
- Use the EARLIEST entry (by period, at or before the reporting period) that has a completion date.
- No completion date and reporting period <= target month: NOT_YET_DUE (excluded from rollup).
- No completion date and past target month: score as if completed on the LAST day of the reporting month.
- Phasing never applies to milestones.

ENTRY SELECTION (non-milestone leaf, for reporting period P)
1. If the KPI is Completed and completedPeriod <= P: use the latest ACTUAL with a value at or before completedPeriod (frozen and carried forward). If none, fall through.
2. Else the ACTUAL entry for P.
3. Else any entry for P (i.e. an estimate for P).
4. Else the most recent ESTIMATE before P. Older ACTUALs are NOT carried forward.
5. Nothing found: NOT_YET_DUE if frequency is QUARTERLY/ANNUAL and P's fiscal month is not a due month; otherwise NO_DATA.
- An estimate-based score is "provisional" (tagged "est"). Actual and Estimate score identically.

FREQUENCY: MONTHLY (all months due), QUARTERLY (fiscal months 3, 6, 9, 12 = Jun, Sep, Dec, Mar), ANNUAL (fiscal month 12 = Mar).

PHASING (scales targets before scoring; FIXED and RANGE only)
- NONE: fraction 1. EVEN: fiscalMonth / 12. CUSTOM: sum of the first fiscalMonth shares / 100
  (12 shares, April first, each 0-100, must total 100).
- Every band target (and both ends of every range window) is multiplied by the fraction.
- fraction < 1 means the score is "prorated" (tagged "Pro-rated").

DEADLINES (non-milestone KPIs with deadlineMonth; the deadline is the last day of that month)
- monthsLate = max(0, monthsBetween(deadlineMonth, P)). 0 means the raw score stands.
- scoreFinalAfterDeadline = true: score frozen at the score computed for the deadline month
  (no entry by then = 0).
- Otherwise (partial credit, default): cap = 2.9 if 1 month late, 2.4 if 2, 0 if 3 or more; score = min(raw, cap).

SCORE OVERRIDE (admin calibration): a leaf/period override (0-5, with reason) replaces the computed score
for display AND for every rollup above it.

ROLLUP (any parent, and the company total)
- Leaf: weight = its global weight; scoredWeight = weight if scored else 0; provisionalWeight = weight if
  provisional; notYetDueWeight = weight if NOT_YET_DUE; proratedWeight = weight if prorated.
- Parent: sums those from children. exactScore = sum(child exactScore x child scoredWeight) / sum(scoredWeight),
  over children with a score. Use UNROUNDED child scores; round only the result.
- Missing data is EXCLUDED, not zero. coverage = scoredWeight / (totalWeight - notYetDueWeight).
- provisionalShare, notYetDueShare, proratedShare = each weight / totalWeight. Track leafCount and scoredLeafCount.

DASHBOARD TOGGLES (applied after scoring, before rollup)
- Unreported: "Excluded" (default) | "Assume Meet, decaying" | "Score as 0".
  Assume Meet, decaying: an unscored numeric leaf gets 3.4 if 0 months late, 2.9 if 1, 2.4 if 2, 0 if 3+.
  monthsLate = months past deadlineMonth if set; else MONTHLY = months since its latest entry (or FY start);
  QUARTERLY/ANNUAL = months since its most recent due month if nothing reported since. A milestone that is
  NOT_YET_DUE gets 3.4.
- Estimates: "Count at face value" (default) | "Exclude" (ignore estimate entries entirely) | "Score as 0".

DISPLAY: dates dd/mm/yyyy; months by name ("October 2026"); weights 2 dp; scores 1 dp.
```

---

## 2. Dataverse tables

Create these in one solution. Paste each block into **Power Apps → Tables →
Describe the new tables** (or "Start with Copilot"). Review the proposed
columns before you click **Create**.

### 2.1 Choices (global option sets) — create first

```text
Create these global choices in the KPI Scorecard solution, publisher prefix sc_:
1. sc_MetricType: Percentage, Dollar, Quantity, Days, Month completion, Variance.
2. sc_Direction: Higher is better, Lower is better.
3. sc_TargetMode: Fixed, Range.
4. sc_Frequency: Monthly, Quarterly, Annual. Default Monthly.
5. sc_Phasing: None, Even, Custom. Default None.
6. sc_ValueBasis: Actual, Estimate. Default Actual.
7. sc_UserRole: Member, Admin. Default Member.
8. sc_UserStatus: Pending, Approved. Default Pending.
9. sc_ProposalStatus: Pending, Approved, Rejected. Default Pending.
10. sc_UpdateMode: Simple, Detailed. Default Detailed.
11. sc_Band: Poor, Improvement needed, Meet, Good, Very good, Excellent.
12. sc_PendingReason: No data, Not yet due.
13. sc_FiscalYearAction: Closed, Reopened, Restored from checkpoint, Moved to holding, Restored from holding, Permanently deleted.
```

### 2.2 Departments, users, status options, dictionary

```text
Create these Dataverse tables (prefix sc_):

1. Department (sc_Department)
   - Name (primary, text 100, required, unique — add an alternate key on it)
   - Is active (yes/no, default yes)

2. App user (sc_AppUser) — one row per person allowed to use the scorecard.
   - Username (primary, text 100, unique alternate key)
   - User (lookup to the built-in User / systemuser table, unique) — links to the Entra sign-in
   - Company ID number (text 50, required, unique alternate key)
   - Department (lookup to sc_Department, required)
   - Role (choice sc_UserRole, default Member)
   - Status (choice sc_UserStatus, default Pending)
   Business rule: the first App user ever created gets Role = Admin and Status = Approved.

3. KPI status option (sc_KpiStatusOption) — a company-wide suggestion list for the free-text KPI Status.
   - Name (primary, text 200, unique alternate key)

4. KPI dictionary entry (sc_KpiDictionaryEntry) — reusable KPI definitions.
   - Name (primary, text 200, unique alternate key)
   - Metric type (choice sc_MetricType, optional)
   - Direction (choice sc_Direction, optional)
   - Target mode (choice sc_TargetMode, optional)
   - Unit (text 50, optional)
   - Target config (multiline text 4000, JSON, optional)
```

### 2.3 Fiscal years

```text
Create these Dataverse tables (prefix sc_):

1. Fiscal year (sc_FiscalYear)
   - Label (primary, text 20, e.g. "FY2026/27")
   - Start year (whole number, required, unique alternate key, e.g. 2026)
   - Is active (yes/no, default no). Only one row may be active.
   - Closed on (date and time, optional), Closed by (lookup sc_AppUser, optional)
   - Held on (date and time, optional), Held by (lookup sc_AppUser, optional)
   - Purge on (date and time, optional) — set to Held on + 30 days when moved to holding
   Add a view "Visible fiscal years" filtered to Held on = empty, sorted by Start year descending.

2. Fiscal year snapshot (sc_FiscalYearSnapshot) — frozen computed scores, written when a year is closed.
   - Name (primary, text)
   - Fiscal year (lookup sc_FiscalYear, required, one per year, cascade delete)
   - Data (multiline text, max length, JSON: every KPI's score for all 12 periods)

3. Fiscal year checkpoint (sc_FiscalYearCheckpoint) — full backups of one year.
   - Name (primary, text 200)
   - Fiscal year (lookup sc_FiscalYear, required, cascade delete)
   - Automatic (yes/no, default no). Automatic checkpoints can't be deleted.
   - Data (file column, max 32 MB, the backup JSON)
   - KPI count (whole number), Value count (whole number)
   - Created by (lookup sc_AppUser, optional)

4. Fiscal year event (sc_FiscalYearAudit)
   - Name (primary, autonumber)
   - Fiscal year (lookup sc_FiscalYear, optional; relationship behavior "Remove link" so rows survive a purge)
   - Fiscal year label (text 20, required — copied at write time)
   - Action (choice sc_FiscalYearAction, required)
   - Reason (multiline text, optional)
   - Author (text 100, required — the username)
```

### 2.4 KPIs and their data

```text
Create these Dataverse tables (prefix sc_):

1. KPI (sc_Kpi)
   - Name (primary, text 300, required)
   - Code (text 50, required), e.g. "1.2.3". Alternate key on (Fiscal year, Code).
   - Fiscal year (lookup sc_FiscalYear, required, cascade delete)
   - Parent (self-lookup to sc_Kpi, optional; cascade delete). Empty parent = Strategic Goal.
   - Sub-group (text 100, optional) — a label clustering siblings under one parent
   - Sort order (whole number, default 0)
   - Weight (decimal, 4 dp, default 0) — LOCAL share of its siblings, out of 100
   - Global weight (decimal, 4 dp, read-only, written by a flow)
   - Level (whole number 1-5, written by a flow)
   - Is leaf (yes/no, written by a flow)
   - Status (text 200, optional — free text, suggestions come from sc_KpiStatusOption)
   - Frequency (choice sc_Frequency, default Monthly)
   - Phasing (choice sc_Phasing, default None)
   - Phase shares (text 200, optional, JSON array of 12 numbers, April first, totalling 100)
   - Metric type (choice sc_MetricType, optional)
   - Direction (choice sc_Direction, optional)
   - Target mode (choice sc_TargetMode, optional)
   - Unit (text 50, optional). Suggestions: %, BND, days, score, units, months.
   - Target config (multiline text 4000, JSON). FIXED: {"POOR":n,"IMPROVEMENT_NEEDED":n,"MEET":n,"GOOD":n,"VERY_GOOD":n,"EXCELLENT":n}.
     RANGE: same keys, each [min,max]. MONTH_COMPLETION: {"targetMonth":"YYYY-MM"}.
   - Deadline month (text 7, "YYYY-MM", optional)
   - Score final after deadline (yes/no, default no)
   - Completed (yes/no, default no), Completed period (text 7, optional)
   Many-to-many relationship sc_Kpi_Department between sc_Kpi and sc_Department ("Owning departments").

2. KPI value (sc_KpiValue) — one row per KPI per month.
   - Name (primary, text, e.g. "1.2.3 2026-10")
   - KPI (lookup sc_Kpi, required, cascade delete)
   - Period (text 7, "YYYY-MM", required). Alternate key on (KPI, Period).
   - Value (decimal, optional) — cumulative year-to-date figure
   - Basis (choice sc_ValueBasis, default Actual)
   - Planned value (decimal, optional) — VARIANCE only
   - Completion date (date only, optional) — MONTH_COMPLETION only
   - Note (multiline text, optional)

3. KPI value change (sc_KpiValueAudit) — one row per changed field.
   - Name (primary, autonumber)
   - KPI (lookup sc_Kpi, cascade delete), Period (text 7)
   - Field (text 30: value, basis, plannedValue, completionDate, note)
   - From (text 4000, optional), To (text 4000, optional)
   - Author username (text 100), Author company ID (text 50)

4. KPI definition change (sc_KpiAudit)
   - Name (primary, autonumber)
   - KPI (lookup sc_Kpi, cascade delete)
   - Field (text 50, e.g. targets, metricType, weight, code, parentId, departments, deleted)
   - Label (text 200, the human label), From (text 4000), To (text 4000)
   - Author (text 100) — department changes store department NAMES, not IDs

5. KPI progress update (sc_KpiUpdate)
   - Name (primary, autonumber)
   - KPI (lookup sc_Kpi, cascade delete), Period (text 7)
   - Mode (choice sc_UpdateMode, default Detailed)
   - Body (multiline text, Simple mode)
   - Current progress, Next progress, Time/Cost, Issues (multiline text each, Detailed mode)
   - Author (text 100)

6. KPI change proposal (sc_ChangeProposal)
   - Name (primary, autonumber)
   - KPI (lookup sc_Kpi, cascade delete)
   - Proposed by (lookup sc_AppUser, required)
   - Payload (multiline text, max length, JSON of the settings to apply)
   - Summary (multiline text, max length, JSON list of {label, from, to})
   - Base modified on (date and time) — the KPI's Modified On when the proposal was made
   - Status (choice sc_ProposalStatus, default Pending)
   - Reviewed by (lookup sc_AppUser, optional), Review note (multiline text), Reviewed on (date and time)

7. Score override (sc_ScoreOverride) — admin calibration.
   - Name (primary, autonumber)
   - KPI (lookup sc_Kpi, cascade delete), Period (text 7). Alternate key on (KPI, Period).
   - Score (decimal, 1 dp, 0 to 5, required)
   - Reason (multiline text, required)
   - By (lookup sc_AppUser, required)

8. KPI score (sc_KpiScore) — the computed score cache, written only by flows.
   - Name (primary, text)
   - KPI (lookup sc_Kpi, cascade delete), Fiscal year (lookup sc_FiscalYear), Period (text 7). Alternate key on (KPI, Period).
   - Score (decimal, 1 dp, optional), Exact score (decimal, 6 dp, optional)
   - Band (choice sc_Band, optional), Pending reason (choice sc_PendingReason, optional)
   - Basis (choice sc_ValueBasis, optional), Provisional (yes/no), Prorated (yes/no), Overridden (yes/no)
   - Value used (decimal), Planned value used (decimal), Completion date used (date only)
   - Raw score before deadline (decimal), Deadline cap (decimal), Months late (whole number), Frozen at deadline (yes/no)
   - Coverage, Provisional share, Not-yet-due share, Prorated share (decimal 0-1 each)
   - Total weight, Scored weight, Provisional weight, Not-yet-due weight, Prorated weight (decimal each)
   - Leaf count, Scored leaf count (whole number each)
   Also add a "Company total" table sc_TotalScore with Fiscal year, Period and the same rollup columns.
```

### 2.5 Validation rules (business rules / Power Fx on the KPI form)

```text
On the sc_Kpi table, add validation that runs when a KPI is saved (Power Fx formula columns or a
synchronous "When a row is added or modified" flow that blocks with an error message):
ERRORS (block the save):
- A leaf with no Metric type, no Direction (non-milestone) or no Target mode (non-milestone): "Missing metric type / direction / target mode."
- A leaf with no Target config: "No targets set."
- FIXED targets not strictly harder from Poor to Excellent (ascending for Higher is better,
  descending for Lower is better): "Targets must get harder from Poor through Excellent."
- Parent chain that loops back to itself: "This would create a loop."
- Phase shares that aren't 12 numbers totalling 100 when Phasing = Custom.
WARNINGS (allow the save, show a message):
- A sibling group whose Weights don't sum to 100: "Weights in this group sum to X%, not 100%. They'll be applied proportionally."
- A KPI with weight 0: "This KPI has no weight."
- Deeper than 5 levels: "Deeper than 5 levels."
- A parent that has its own metric set: "This KPI has children, so its own metric is ignored."
```

---

## 3. Security

Copilot can't build these for you. Create them by hand from this spec.

| Role | Dataverse privileges | Flow-enforced rules |
| --- | --- | --- |
| **Scorecard Reader** (every approved user) | Organization-level **Read** on all `sc_` tables, except checkpoint *Data* (column security) | Pending users see only "Your account is waiting for approval." |
| **Scorecard Member** | Reader, plus **Create** on `sc_KpiValue`, `sc_KpiUpdate`, `sc_ChangeProposal` and `sc_KpiValueAudit` | Writes are allowed only to KPIs whose owning departments include the member's department. Settings changes become **proposals**, never direct saves. KPIs with no department (all parents) can't be written by members. |
| **Scorecard Admin** | Full CRUD on all `sc_` tables | Structure, fiscal years, departments, import, restore, calibration, user approval |

- Run every write flow **as the flow owner (a service account)**, never as the
  invoking user. Have each flow check `sc_AppUser.Role` and `Status` and the
  department rule first. This mirrors how the web app checks inside every server action.
- **A closed fiscal year freezes every write.** Every write flow must refuse
  when the KPI's fiscal year has *Closed on* set. Calibration and data entry
  also need the year to be open.
- Column security on `sc_FiscalYearCheckpoint.Data`: Admins only.

---

## 4. The agent

### 4.1 "Describe your agent" prompt

```text
Create an agent called "Scorecard" for our company KPI scorecard. Staff use it to see how the company
is performing against its KPIs for the fiscal year (1 April to 31 March), enter monthly figures,
post progress updates, propose changes to KPI settings, and — for admins — manage the KPI hierarchy,
weights, fiscal years, backups, imports and user approvals. All data lives in Dataverse tables with the
sc_ prefix. Users sign in with Microsoft. Scores run from 0 to 5 in six bands
(Poor, Improvement Needed, Meet, Good, Very Good, Excellent). Be concise and businesslike.
```

### 4.2 Agent instructions (paste into Overview → Instructions)

```text
You are Scorecard, the assistant for our company KPI scorecard.

WHO YOU'RE TALKING TO
- At the start of every conversation, call the "Get current user" flow. If the user has no App user
  row, offer the "Register" topic. If their Status is Pending, say "Your account is waiting for an
  admin to approve it" and do nothing else. Remember their Role (Member or Admin) and Department.
- Members may: read everything; enter figures and post progress updates for KPIs their department
  owns; propose settings changes for those KPIs. Admins may do everything. Never call an admin-only
  flow for a Member — say that it needs an admin instead.

WHICH YEAR AND MONTH
- Default to the active fiscal year and the latest month that has ended (the reporting month).
  Let the user name another year or month ("show me August", "FY2025/26"). Always say which
  year and month a figure is for.
- If the year is closed, say so and refuse every change: "FY… is closed. An admin must reopen it first."

HOW TO TALK ABOUT SCORES
- Scores are 0-5 to one decimal; always give the band with the score ("3.4 · Meet").
- Weights are percentages with two decimals ("25.00%").
- Dates are dd/mm/yyyy; months by name ("October 2026"). Never use mm/dd/yyyy.
- Tag a score "est" when it rests on an estimate, "pro-rated" when it rests on a phased target,
  and "calibrated" when an admin overrode it. Always mention coverage when it is under 100%
  ("3.6 on 72% of the weight reported").
- Missing data is left out, not counted as zero. Say so when asked why a total moved.
- To explain a score, use the rulebook in your knowledge and the KPI's own targets. Show the arithmetic.
  Never invent a figure; if the flow returned nothing, say there's no data.

SAVING
- Never write anything as soon as the user asks. First show a confirmation card listing every change
  as "field: old → new", then save only after the user presses Confirm. The one exception is progress
  updates, which post immediately because they only ever add.
- After a save, say exactly what was saved ("Saved 3 changes to 1.2.3 for October 2026.").
- If a flow returns an error, show its message as-is and say how to fix it. Don't apologise.

SAFETY
- Destructive actions (delete KPI, delete fiscal year, replace-mode import, restore) always need
  the specific confirmation their topic asks for. Never skip it, even if the user insists.
- Don't reveal checkpoint contents, other users' company ID numbers or temporary passwords
  except to an Admin in the topic that produces them.
```

### 4.3 Agent settings

```text
Settings to configure in Copilot Studio (manual):
- Authentication: "Authenticate with Microsoft"; require users to sign in.
- Orchestration: Generative orchestration ON, so the agent can choose topics and tools from their descriptions.
- Knowledge: upload scorecard-rulebook.md; turn OFF "Use general knowledge" and web search, so scores are only explained from the rulebook.
- Channels: Microsoft Teams + Microsoft 365 Copilot.
- Add every flow in sections 5 and 7 as a Tool, with a one-line description of when to use it.
```

---

## 5. Scoring engine flows

These are the core of the rebuild. If you chose **Option A** in section 1.2,
build F-01 to F-05 as single calls to the custom connector instead. Keep the
same inputs and outputs.

### F-01 Score leaf

```text
Create an instant agent flow "Score leaf" (include the rulebook).
Inputs: KpiId (text), Period (text "YYYY-MM"), UnreportedMode (text: exclude | assume-meet-decay | zero,
default exclude), EstimateMode (text: count | exclude | zero, default count).
Steps:
1. Get the sc_Kpi row. Get all its sc_KpiValue rows with Period <= Period, sorted by Period ascending.
   If EstimateMode = exclude, drop rows with Basis = Estimate.
2. If Metric type = Month completion:
   a. Read targetMonth from Target config JSON. If missing: return Score null, PendingReason "No data".
   b. Find the earliest value row that has a Completion date. If found: compute delta and the day-scaled
      score per the MONTH_COMPLETION rules; Basis = that row's basis; Provisional = (Basis = Estimate).
   c. Else if monthsBetween(targetMonth, Period) <= 0: return PendingReason "Not yet due".
   d. Else score as if completed on the last day of Period.
3. Otherwise:
   a. Select the entry using the ENTRY SELECTION rules (Completed / Completed period first).
   b. No entry or null Value: return PendingReason "Not yet due" if Frequency is Quarterly/Annual and the
      period's fiscal month is not a due month, else "No data".
   c. VARIANCE: scored value = abs(Value - Planned value) / Planned value x 100; no Planned value or 0 = "No data".
   d. Compute the phasing fraction; multiply every target (and range edge) by it; Prorated = fraction < 1.
   e. Score with the FIXED or RANGE rules. Round it (roundScore) = RawScore.
   f. If Deadline month is set and Period is after it, apply the DEADLINE rules. For "Score final after
      deadline", run steps 3a-3e for the deadline month itself (0 if nothing by then).
   g. Score = roundScore(result). Band from the band table. Provisional = (Basis = Estimate).
4. Apply the dashboard toggles to the result (DASHBOARD TOGGLES rules).
5. If a sc_ScoreOverride exists for (KpiId, Period): Score = override score, Overridden = true.
Outputs: Score, ExactScore (same as Score for a leaf), Band, PendingReason, Basis, Provisional, Prorated,
Overridden, ValueUsed, PlannedValueUsed, CompletionDateUsed, RawScore, DeadlineCap, MonthsLate, Frozen.
```

### F-02 Roll up

```text
Create an instant agent flow "Roll up scorecard" (include the rulebook).
Inputs: FiscalYearId, Period, UnreportedMode, EstimateMode, WriteCache (yes/no).
Steps:
1. Load every sc_Kpi in the fiscal year. Build the tree by Parent. Compute Level (Goal = 1) and Is leaf.
2. Compute Global weight top-down: Goals = local / sum(Goal locals) x 100; children = parent global x
   local / sum(sibling locals). A sibling group summing to 0 gives every child 0.
3. For every leaf, call "Score leaf". Leaf rollup inputs: weight = global weight; scoredWeight = weight
   if Score is not null else 0; provisionalWeight = weight if Provisional; notYetDueWeight = weight if
   PendingReason = Not yet due; proratedWeight = weight if Prorated; leafCount 1; scoredLeafCount 1 if scored.
4. Walk up from the deepest level. For each parent, sum its children's weights and counts. ExactScore =
   sum(child ExactScore x child scoredWeight) / sum(scoredWeight) over scored children (null if none).
   Score = roundScore(ExactScore). coverage = scoredWeight / (totalWeight - notYetDueWeight).
   Shares = each weight / totalWeight.
5. The company total is the same rollup over the Strategic Goals.
6. If WriteCache = yes: upsert every node into sc_KpiScore (alternate key KPI + Period) and the total into
   sc_TotalScore. Also write each KPI's Global weight, Level and Is leaf back to sc_Kpi.
Outputs: TotalScore, TotalBand, Coverage, ProvisionalShare, NotYetDueShare, ProratedShare, a JSON array of
every node {id, code, name, level, parentId, localWeight, globalWeight, score, exactScore, band,
coverage, flags}.
```

### F-03 Insights

```text
Create an instant agent flow "Compute insights" (include the rulebook).
Inputs: FiscalYearId, Period. Run "Roll up scorecard" for Period and for the three previous periods.
BIGGEST OPPORTUNITIES — for each scored leaf that isn't Month completion and isn't Excellent:
- nextBand = the band above. Target score = top of nextBand if Target mode is Fixed, bottom of nextBand if Range.
- Skip if Target score <= its exact score.
- Impact on total = (Target score - exact score) x global weight / total scoredWeight.
- "What it takes" = the nextBand target from the KPI's targets in its unit (Fixed: the number; Range: the window).
- Sort by impact, largest first.
AT RISK OF DROPPING — for each scored leaf (skip completed milestones; skip Poor unless it's a slipping milestone):
- Slipping milestone = Month completion with no completion date (already decaying).
- Floor = top of the band below (0 if already Poor). Drop impact = (floor - exact score) x global weight / total scoredWeight.
- Headroom = exact score - bottom of its current band. Also give headroom in the KPI's own units.
- Trend from the trailing scores: slope = (last non-null - first non-null) / periods between them.
  slope <= -0.05 = DECLINING (months to drop = headroom / |slope|); slope >= 0.05 = IMPROVING;
  otherwise STABLE; fewer than two scores = UNKNOWN; slipping milestone = SLIPPING_MILESTONE.
- Sort: SLIPPING_MILESTONE and DECLINING first, then by drop impact (most negative first).
Outputs: Opportunities JSON, Risks JSON.
```

### F-04 Simulate

```text
Create an instant agent flow "Simulate scorecard". Inputs: FiscalYearId, Period, Overrides (JSON array of
{kpiId, simulatedValue}). Run the same logic as "Roll up scorecard" with WriteCache = no, but for each
overridden leaf treat simulatedValue as an ACTUAL for Period (for Month completion it is a completion date).
Never write anything to Dataverse. Outputs: simulated total, its change from the real total, and the
changed nodes with before → after scores.
```

### F-05 Deadlines

```text
Create an instant agent flow "List deadlines". Inputs: FiscalYearId, Today (date).
For every leaf: due month = Month completion → targetMonth; otherwise Deadline month, defaulting to the
fiscal year's last month (March) when blank.
- OVERDUE: due month before this month and not done (milestone without a completion date; other KPI not Completed).
- DUE SOON: due month from this month to three months ahead.
Outputs two lists, sorted by due month, each with code, name, owning departments, due month as "October 2026",
months overdue or months remaining, and current score.
```

### F-06 Recalculate (keeps the cache fresh)

```text
Create an automated cloud flow "Recalculate scores" triggered when a row is added, modified or deleted in
sc_KpiValue, sc_Kpi, sc_ScoreOverride or the sc_Kpi_Department relationship. Debounce: use concurrency
control 1 and skip if another run for the same fiscal year started in the last 60 seconds.
Find the fiscal year of the changed row; if it is closed, stop. For each of its 12 periods up to the
current reporting month, call "Roll up scorecard" with default toggles and WriteCache = yes.
```

---

## 6. Topics

Create each in **Topics → Add → From description with Copilot**. Every
topic that writes must end with the confirmation card (C-08) before calling
the save flow.

### T-01 Dashboard

```text
Topic "Dashboard". Triggers: "how are we doing", "show the scorecard", "dashboard", "company score",
"total score for October". Ask (or infer) the period; default to the latest ended month.
Optional slots: unreported handling (Excluded / Assume Meet, decaying / Score as 0) and estimate handling
(Count at face value / Exclude / Score as 0). Default toggles: read sc_TotalScore and Goal-level
sc_KpiScore. Non-default toggles: call "Roll up scorecard" with WriteCache = no.
Show card C-01: total score + band, coverage, est/pro-rated share, then one row per Strategic Goal with
score, band, weight (2 dp) and the same score for the three previous months. Offer buttons
"Drill into a goal", "Insights", "Deadlines", "Board report".
```

### T-02 KPI list

```text
Topic "KPI list". Triggers: "list KPIs", "show all KPIs", "which KPIs are Poor", "KPIs owned by Finance".
Filters (optional): band, department, level, metric type, "estimates only", "no data".
Read sc_KpiScore joined to sc_Kpi for the period. Show card C-02: a table of code, name, score + band,
global weight (2 dp), departments, flags (est / pro-rated / calibrated / not yet due / no data).
Max 25 rows; offer "Show more". Sort by code by default; allow "sort by score" or "sort by weight".
```

### T-03 KPI detail

```text
Topic "KPI detail". Triggers: "show KPI 1.2.3", "tell me about Existing customer revenue",
"why is 2.1 scoring 2.4". Identify the KPI by code or name (ask to disambiguate if several match).
Show card C-03: code, name, path of parents, owning departments, status, metric type, unit, direction,
target mode, targets per band, frequency, phasing, deadline; local and global weight (2 dp);
the score history for every period of the year so far (score, band, value, basis, flags);
and for a parent, its children with weight, share and score.
If the user asks "why", explain the score step by step from the rulebook using Score leaf's outputs
(value used, phased target, raw score, deadline cap, override and its reason).
Offer buttons "Enter figure", "Post update", "Edit settings", "Progress updates", "Change history".
```

### T-04 Enter figures

```text
Topic "Enter figures". Triggers: "enter October figures", "report actuals", "update value for 1.2.3",
"enter data". Ask the period (default latest ended month). List the leaves the user may write (Admin: all
leaves; Member: leaves owned by their department) for the open fiscal year. Show card C-04 with one block per
KPI: Value, Basis (Actual/Estimate), Planned value (VARIANCE only), Completion date dd/mm/yyyy
(Month completion only), Note — prefilled with existing values. On submit, compare with existing values,
build one change line PER CHANGED FIELD ("1.2.3 Revenue — Reported value: 120 → 135"), show card C-08,
and on Confirm call "Save entries". Report how many fields were saved.
```

### T-05 Progress updates

```text
Topic "Progress update". Triggers: "post an update", "progress update for 1.2.3", "what's the latest on X".
Reading: show the KPI's sc_KpiUpdate rows newest first (period, author, date dd/mm/yyyy, text).
Posting: only a user whose department owns the KPI (or an Admin). Show card C-05, defaulting to Detailed
(Current progress, Next progress, Time/Cost, Issues), with a toggle to Simple (one text box). Post
immediately with "Add progress update" (no confirmation). Also offer to set the KPI Status: suggest values
from sc_KpiStatusOption; a new value is added to that list.
```

### T-06 Edit KPI settings / propose a change

```text
Topic "Edit KPI settings". Triggers: "change the target for 1.2.3", "set the weight", "change metric type",
"set a deadline", "mark as completed". Show card C-06 prefilled with the KPI's current settings: name,
owning departments, weight, metric type, unit, direction, target mode, targets per band (fixed numbers or
[min,max] windows, or target month for milestones), frequency, phasing (+12 custom shares), deadline month,
score final after deadline, completed + completed period, status. Validate with section 2.5 rules.
Show C-08 with every changed field old → new. On Confirm: Admin → "Save KPI settings";
Member → "Propose KPI change" and say "Sent to the admins for approval."
Also offer "Load from dictionary" (sc_KpiDictionaryEntry) and, for admins, "Save to dictionary".
```

### T-07 Hierarchy

```text
Topic "Manage hierarchy" (Admin only). Triggers: "add a KPI", "move KPI", "reorder", "delete KPI",
"restructure". Sub-intents:
- Add: ask parent (or none = Strategic Goal), name, optional code. If no code, auto-code as parent code
  + "." + next number (Goals: next whole number). Call "Create KPI".
- Move: ask the KPI and the new parent; refuse if it would create a loop or exceed 5 levels; call "Move KPI".
- Reorder: show siblings in the same sub-group in order; ask the new position; call "Reorder KPI".
- Delete: show how many descendants and figures will go with it; require the user to type the KPI code
  to confirm; call "Delete KPI".
- Infer parents from codes: call "Preview parent inference", show the proposed parent for each KPI, then
  "Apply parent inference" on confirm.
After any change remind the admin to check weights (T-08).
```

### T-08 Weights

```text
Topic "Weights" (Admin only). Triggers: "check weights", "set weights for goal 1", "weights don't add up".
First list every sibling group with its sum, flagging groups not at 100.00%. For a chosen group, show card
C-07 in Percent mode (each child's local weight %, total) or Ratio mode (relative numbers converted to %).
Show the global weight each child would get. Warn — don't block — if the total isn't 100.
Confirm with C-08, then call "Set group weights".
```

### T-09 Insights

```text
Topic "Insights". Triggers: "where can we improve", "biggest opportunities", "what's at risk",
"what could drop". Call "Compute insights" for the period. Show card C-09: top 10 opportunities (KPI,
current → next band, what it takes in the KPI's unit, impact on the total to 2 dp) and top 10 risks
(KPI, current band, headroom, drop impact, trend, months to drop when DECLINING).
```

### T-10 Simulate

```text
Topic "Simulate". Triggers: "what if", "simulate revenue at 150", "what would the total be if".
Collect one or more KPI + simulated actual pairs (a completion date for milestones). Call "Simulate scorecard".
Show the simulated total vs actual total and each changed KPI and goal (before → after). Say clearly that
nothing was saved.
```

### T-11 Deadlines

```text
Topic "Deadlines". Triggers: "what's overdue", "what's due soon", "upcoming deadlines", "milestones".
Call "List deadlines". Show card C-10 with Overdue (red) and Due within three months, each with KPI,
departments, due month by name, months overdue/remaining and score.
```

### T-12 Board report

```text
Topic "Board report". Triggers: "board report", "generate the report for October", "PDF report".
Call "Generate board report" for the period. Return the PDF link. Summarise in chat: total score + band,
coverage, the three highlights and three lowlights.
```

### T-13 Fiscal years (Admin only)

```text
Topic "Fiscal years". Triggers: "new fiscal year", "set active year", "close the year", "reopen FY",
"delete fiscal year", "holding", "restore a deleted year".
- List years (excluding held ones) with active/closed status.
- Create: ask the start year; label "FY{start}/{start+1 last two digits}"; optionally copy the hierarchy from
  another year (months shift by the year difference). Call "Create fiscal year".
- Set active: call "Set active fiscal year".
- Close: explain that it freezes scores for all 12 months and blocks every change; confirm; call "Close fiscal year".
- Reopen: require a reason; call "Reopen fiscal year".
- Delete: refuse if closed. Card C-11 asks for the admin's own username and the exact phrase
  "confirm delete {label} scorecard". The agent can't take a password in chat, so the flow re-checks
  identity through the signed-in Entra account instead (see gaps). Explain that the year moves to Holding
  for 30 days. Call "Move fiscal year to holding".
- Holding: list held years with held by/on and days until purge; "Restore" calls "Restore from holding".
```

### T-14 Checkpoints (Admin only)

```text
Topic "Checkpoints". Triggers: "save a checkpoint", "backup", "restore", "list checkpoints", "undo the import".
- List checkpoints for the year: name, date, automatic or manual, KPI and value counts.
- Save: ask a name; call "Create checkpoint".
- Delete: manual only (refuse automatic); confirm; call "Delete checkpoint".
- Download: return the file link from the Data column.
- Restore: pick a checkpoint or ask for an uploaded .json file; ask "over {year}" or "into a new fiscal year";
  call "Preview restore", show what will change (KPIs, values, updates, overrides added/removed), require
  Confirm, then call "Restore checkpoint". Say an automatic checkpoint of the current state was taken first,
  and that the restored year comes back open.
```

### T-15 Import / export (Admin only for import)

```text
Topic "Import and export". Triggers: "export to Excel", "download template", "import KPIs", "upload spreadsheet".
- Export: call "Export workbook" for the year; return the file link.
- Template: return the blank template and filled example files.
- Import: ask the user to upload the .xlsx (file upload in chat). Ask the mode: Update only (default) or
  Replace (KPIs missing from the sheet are removed with their figures). Call "Preview import" and show
  card C-12: KPIs added / updated / removed, values added / changed, errors and warnings per row. If there
  are errors, stop. On Confirm call "Apply import" and report the counts.
```

### T-16 Users and departments (Admin only)

```text
Topic "Manage users". Triggers: "pending users", "approve user", "make admin", "remove user",
"reset password", "departments". List users with username, company ID, department, role, status.
- Approve, set role (Member/Admin), remove (blocked while they own proposals/overrides/checkpoints/audit
  links — show why) via "Manage user".
- Reset password: in Entra; tell the admin to use the Entra admin center (see gaps).
- Departments: list, add, rename, deactivate. Removing one is blocked while users or KPIs use it.
```

### T-17 Approvals (Admin only)

```text
Topic "Approvals". Triggers: "pending approvals", "proposals", "approve change". List pending
sc_ChangeProposal rows: KPI, proposer, date, every change label: old → new. Approve calls
"Approve proposal" (which refuses if the KPI changed since the proposal — tell the admin to ask for
a fresh proposal). Reject asks for an optional note and calls "Reject proposal".
```

### T-18 Change log (Admin only)

```text
Topic "Change log". Triggers: "change log", "audit trail", "who changed", "history of 1.2.3".
For a KPI: show sc_KpiAudit (definition changes) and sc_KpiValueAudit (figure changes), newest first, with
date/time dd/mm/yyyy HH:mm, field label, from → to, author. For the company: show sc_FiscalYearAudit events.
Offer "Export full audit trail (Excel)" which calls "Export audit trail".
```

### T-19 Calibrate a score (Admin only)

```text
Topic "Calibrate score". Triggers: "override the score", "calibrate 1.2.3", "set score manually",
"clear calibration". Leaf KPIs only. Ask period (must be in the KPI's fiscal year), score 0-5 (1 dp) and a
required reason. The year must be open. Show C-08 (computed score → calibrated score) and call "Override
score". "Clear calibration" calls "Clear override".
```

### T-20 Register / my account

```text
Topic "My account". Triggers: "register", "sign up", "my account", "who am I", "change password".
- Register (no App user row yet): ask username, company ID number, department (list active departments).
  Call "Register user". If they're the first user ever, they become an approved Admin; otherwise tell them
  an admin must approve them.
- My account: show username, company ID, department, role, status.
- Change password: explain it's their Microsoft account password and link to the Microsoft account page.
```

### T-21 Help

```text
Topic "Help / manual". Triggers: "help", "how does scoring work", "what is Meet", "what does est mean".
Answer from the rulebook knowledge source. Show the band table. Explain actuals vs estimates, missing data,
phasing, deadlines, milestones, coverage and calibration in plain language with one worked example each.
```

---

## 7. Data-changing flows

Every write flow begins with the same guard. Paste this paragraph at the top
of each prompt in this section:

```text
GUARD: Look up the caller's sc_AppUser by their Entra user. Fail with "Your account isn't approved yet."
if Status ≠ Approved. If this flow is admin-only, fail with "This needs an admin." when Role ≠ Admin.
For KPI-scoped member writes, fail with "Only {departments} can change this KPI." unless the KPI's owning
departments include the caller's department. Fail with "FY… is closed." if the fiscal year has Closed on set.
```

| ID | Flow | Prompt |
| --- | --- | --- |
| F-10 | **Save entries** | `Instant agent flow "Save entries". Input Entries: JSON array of {kpiId, period, value, basis, plannedValue, completionDate, note}. GUARD (member write). For each entry: get the existing sc_KpiValue (KPI + Period); compare each of the 5 fields; for every changed field create one sc_KpiValueAudit row (field, from, to, author username, author company ID); upsert the sc_KpiValue. Return the number of changed fields.` |
| F-11 | **Save KPI settings** | `Instant agent flow "Save KPI settings". Inputs KpiId, Settings JSON. GUARD (admin). Validate with the section 2.5 rules. For each changed field write a sc_KpiAudit row with a human label and old → new text (department changes as sorted department NAMES; targets as readable text). Update sc_Kpi and its owning-departments relationship.` |
| F-12 | **Propose KPI change** | `Instant agent flow "Propose KPI change". Inputs KpiId, Settings JSON, Summary JSON. GUARD (member write). Create sc_ChangeProposal with Payload, Summary, Base modified on = the KPI's Modified On, Status Pending. Notify admins in Teams with an approval card.` |
| F-13 | **Approve / reject proposal** | `Two instant agent flows. "Approve proposal" (admin): refuse with "This KPI has changed since the proposal was made. Ask for a fresh proposal." if the KPI's Modified On ≠ Base modified on; otherwise run "Save KPI settings" with the Payload, set Status Approved, Reviewed by/on, and tell the proposer in Teams. "Reject proposal" (admin): set Status Rejected with the optional note and tell the proposer.` |
| F-14 | **Create KPI** | `Admin. Inputs FiscalYearId, ParentId (optional), Name, Code (optional), SubGroup. Auto-code if blank. Refuse duplicates in the year and depth > 5. Sort order = last among siblings. Write sc_KpiAudit "created".` |
| F-15 | **Move / reorder KPI** | `Admin. "Move KPI": new ParentId; refuse loops and depth > 5; write sc_KpiAudit parentId change. "Reorder KPI": Direction up/down; swap Sort order with the neighbouring sibling in the same Sub-group.` |
| F-16 | **Delete KPI** | `Admin. Write a sc_KpiAudit "deleted" row on the parent (if any) naming the code and name, then delete the KPI (descendants and data cascade).` |
| F-17 | **Weights** | `Admin. "List weight groups": every parent (and the Goal level) with its children's local weight sum. "Set group weights": inputs ParentId (blank = Goals), JSON of {kpiId, weight}; write sc_KpiAudit for each changed weight; update; warn if the sum ≠ 100.` |
| F-18 | **Override / clear score** | `Admin. "Override score": KpiId (leaf), Period (must be inside the KPI's fiscal year), Score 0-5, Reason (required); open year; upsert sc_ScoreOverride. "Clear override": delete it. Both write sc_KpiAudit.` |
| F-19 | **Add progress update** | `GUARD (member write). Create sc_KpiUpdate with Mode, Period, Body or the four detailed fields, Author. If a Status was given, update sc_Kpi.Status and add it to sc_KpiStatusOption if new.` |
| F-20 | **Generate board report** | `Instant agent flow. Inputs FiscalYearId, Period. Run "Roll up scorecard" and "Compute insights". Populate the Word template "Board report.docx" (Populate a Microsoft Word template): title, period by name, total score + band + coverage; a table of each Strategic Goal with weight, score, band and weighted contribution to the total (exact score × global weight / total scored weight); Highlights = top 3 goals/KPIs by score; Lowlights = bottom 3; Appendix A = every KPI with code, name, weight, value, target, score, band, flags. Footer "Confidential — board distribution only". Convert to PDF, save to the Scorecard SharePoint library, return the link.` |
| F-30 | **Create fiscal year** | `Admin. Inputs StartYear, CopyFromFiscalYearId (optional). Refuse if a year (held or not) has that start year. Label "FY2026/27". If copying: copy every KPI with its parent links, weights, departments and settings; shift every month field (target month, deadline month, completed period) by the year difference; don't copy values, updates, overrides or audits.` |
| F-31 | **Set active fiscal year** | `Admin. Set Is active = yes on the chosen (non-held) year and no on all others.` |
| F-32 | **Close fiscal year** | `Admin. Run "Roll up scorecard" for all 12 periods; save the JSON to sc_FiscalYearSnapshot; set Closed on/by; write sc_FiscalYearAudit "Closed". From then on the agent reads a closed year's scores from the snapshot.` |
| F-33 | **Reopen fiscal year** | `Admin. Reason required. Clear Closed on/by; delete the snapshot; write sc_FiscalYearAudit "Reopened" with the reason.` |
| F-34 | **Move fiscal year to holding** | `Admin. Inputs FiscalYearId, Username, ConfirmationText. Refuse if closed. Refuse unless Username matches the caller's own username (case-insensitive) and ConfirmationText is exactly "confirm delete {label} scorecard". Set Held on = now, Held by, Purge on = now + 30 days, Is active = no. Write sc_FiscalYearAudit "Moved to holding".` |
| F-35 | **Restore from holding** | `Admin. Year must be held. Clear Held on/by and Purge on. Write sc_FiscalYearAudit "Restored from holding".` |
| F-36 | **Create / delete checkpoint** | `Admin. "Create checkpoint": serialise the year (KPIs with parent codes, departments by name, values, updates, overrides, KPI and value audits) to JSON; save it in the Data file column with KPI and value counts. "Delete checkpoint": refuse if Automatic.` |
| F-37 | **Preview restore** | `Admin. Input a checkpoint id OR an uploaded JSON file, and a target (existing FiscalYearId or "new" + StartYear). Parse and validate the JSON; return counts to be removed and added. Write nothing.` |
| F-38 | **Restore checkpoint** | `Admin. Same inputs. First create an AUTOMATIC checkpoint of the target year (if it exists). Then delete the target year's KPIs (cascade) and rebuild them from the JSON, mapping departments by name (create missing ones). The restored year is always open (clear Closed on, delete the snapshot). Write sc_FiscalYearAudit "Restored from checkpoint". Run "Recalculate scores".` |
| F-40 | **Export workbook** | `Instant flow. Build an .xlsx (Excel Online "Create table"/"Add a row" into a copy of the template file) with sheets Readme, Departments, KPIs, Values, Updates, Scores. KPIs columns: Code, Name, Parent Code, Weight, Departments (semicolon-separated), Metric Type, Unit, Direction, Target Mode, Poor, Improvement Needed, Meet, Good, Very Good, Excellent (Fixed number, Range "min-max", or month for milestones), Deadline Month, Score Final After Deadline, Frequency, Phasing, Phase Shares, Status. Values: Code, Period, Value, Basis, Planned Value, Completion Date (dd/mm/yyyy), Note. Return the file link.` |
| F-41 | **Preview / apply import** | `Admin. Input an uploaded .xlsx and Mode (UPDATE or REPLACE). Read the KPIs and Values sheets. Match KPIs on Code; resolve Parent Code; validate every row (section 2.5 rules, unknown departments, bad periods, bad dates). Preview returns adds/updates/removals (removals only in REPLACE) and per-row errors without writing. Apply: refuse if there are errors; create an AUTOMATIC checkpoint first; upsert KPIs then values, writing sc_KpiAudit and sc_KpiValueAudit rows for every changed field; in REPLACE delete KPIs not in the sheet. Run "Recalculate scores".` |
| F-42 | **Export audit trail** | `Admin. Build an .xlsx with three sheets: "Fiscal year events" (Date/time, Fiscal year, Action, Reason, Author), "KPI definition changes" (Date/time, Fiscal year, KPI code, KPI name, Field, From, To, Author), "KPI value changes" (Date/time, Fiscal year, KPI code, KPI name, Period, Field, From, To, Author, Company ID). Return the link.` |
| F-50 | **Get current user** | `Instant agent flow, no guard. Find sc_AppUser whose User = the caller. Return Username, Role, Status, Department name, Department id, or "not registered".` |
| F-51 | **Register user** | `No guard. Inputs Username, CompanyId, DepartmentId. Refuse duplicates. If no sc_AppUser exists yet, create as Admin + Approved; otherwise Member + Pending, and notify admins in Teams.` |
| F-52 | **Manage user** | `Admin. Actions approve, setRole, remove. Refuse removing yourself or the last admin. Refuse removal while the user is referenced by proposals, overrides, checkpoints or fiscal-year close/hold fields — name what blocks it.` |
| F-53 | **Save departments** | `Admin. Add, rename, activate/deactivate. Refuse removing a department still used by users or KPIs.` |

### 7.1 Scheduled flows

```text
Create a scheduled cloud flow "Purge held fiscal years", daily at 02:00 (Asia/Brunei).
List sc_FiscalYear where Held on is not empty and Purge on <= now. For each: create sc_FiscalYearAudit
(Action "Permanently deleted", Fiscal year label = the label, Author "system"), then delete the fiscal year
(KPIs, values, updates, audits, proposals, overrides and checkpoints cascade).
```

```text
Create a scheduled cloud flow "Monthly reminder", on the 3rd of each month at 09:00 (Asia/Brunei).
For each department, list leaf KPIs it owns in the active open fiscal year that are due for last month
(by Frequency) and have no sc_KpiValue for that period. Post a Teams message to the department's members
listing them, with a button that opens the Scorecard agent on "Enter figures".
```

---

## 8. Adaptive cards

Paste each prompt into the **"Ask with adaptive card"** node's Copilot JSON
generator, or into the Adaptive Card Designer's Copilot. Target schema 1.5.
Use Teams-safe colours (`good`, `warning`, `attention`, `accent`). Band
colours: Poor = attention, Improvement Needed = warning, Meet = default,
Good = accent, Very Good = good, Excellent = good + bold.

| Card | Prompt |
| --- | --- |
| C-01 Dashboard | `Adaptive card 1.5: header "Company scorecard · {periodName}"; big text "{total} · {band}"; a fact line "Coverage {coverage}% · Estimates {est}% · Pro-rated {pr}%"; a table (ColumnSet rows) with columns Goal, Weight, Score, and three narrower columns for the previous three months; band text coloured by band. Action.Submit buttons: Drill into a goal, Insights, Deadlines, Board report.` |
| C-02 KPI list | `Adaptive card 1.5: a Table element with columns Code, KPI, Score, Band, Weight (2 dp %), Departments, Flags; one row per item of a ${kpis} array using templating ($data); a "Show more" Action.Submit.` |
| C-03 KPI detail | `Adaptive card 1.5: title "{code} {name}", subtitle breadcrumb of parents; FactSet of Department, Status, Metric, Unit, Direction, Target mode, Frequency, Phasing, Deadline (month name), Local weight, Global weight; a targets table with six band rows; a history table (Month, Value, Basis, Score, Band, Flags); buttons Enter figure, Post update, Edit settings, Progress updates, Change history.` |
| C-04 Entry | `Adaptive card 1.5 form for monthly figures. Repeat per KPI (templated): a TextBlock "{code} {name} · {unit}"; Input.Number id "value_{id}"; Input.ChoiceSet "basis_{id}" (Actual, Estimate), compact; Input.Number "planned_{id}" shown only for Variance; Input.Text "completion_{id}" with placeholder "dd/mm/yyyy" and regex ^\d{2}/\d{2}/\d{4}$ shown only for milestones; Input.Text multiline "note_{id}". Prefill with existing values. Submit "Review changes".` |
| C-05 Progress update | `Adaptive card 1.5: Input.ChoiceSet "mode" (Detailed default, Simple) and two Containers toggled with Action.ToggleVisibility: Detailed has four multiline inputs (Current progress, Next progress, Time/Cost, Issues); Simple has one multiline "Update". Optional Input.Text "status" with suggestions from ${statusOptions} (ChoiceSet with style filtered). Submit "Post update".` |
| C-06 KPI settings | `Adaptive card 1.5 settings form prefilled from ${kpi}: name, departments (multi-select ChoiceSet), weight (number), metric type, unit (ChoiceSet with %, BND, days, score, units, months, and free text), direction, target mode, six band rows each with a single number (Fixed) or min/max pair (Range), target month for milestones (month ChoiceSet), frequency, phasing with 12 share inputs (April–March) shown only for Custom, deadline month, toggle "Score final after deadline", toggle "Completed" + completed period, status. Submit "Review changes".` |
| C-07 Weights | `Adaptive card 1.5: title "Weights · {parentName}"; Input.ChoiceSet mode (Percent, Ratio); one row per child with name and Input.Number; a footer TextBlock "Total {sum}%" coloured attention if not 100.00; Submit "Review changes".` |
| C-08 Confirm | `Adaptive card 1.5: title "{n} field(s) will be updated"; a Table with columns What, From, To from ${changes}; buttons Confirm (style positive) and Cancel.` |
| C-09 Insights | `Adaptive card 1.5 with two sections: "Biggest opportunities" table (KPI, Current, Next band, What it takes, Impact on total) and "At risk of dropping" table (KPI, Band, Headroom, Drop impact, Trend, Months to drop).` |
| C-10 Deadlines | `Adaptive card 1.5: "Overdue" container (attention style) and "Due within three months" container, each a table of KPI, Departments, Due (month name), Months over/left, Score.` |
| C-11 Delete year | `Adaptive card 1.5, attention style: warning text "FY{label} moves to Holding for 30 days, then is permanently deleted."; Input.Text "username" (required); Input.Text "phrase" (required, placeholder "confirm delete {label} scorecard"); buttons "Move to holding" (destructive) and Cancel.` |
| C-12 Import preview | `Adaptive card 1.5: FactSet Mode, KPIs added, KPIs updated, KPIs removed, Values added, Values changed; an "Errors" table (Sheet, Row, Problem) in attention style and a "Warnings" table; Confirm only when there are no errors.` |

---

## 9. Test checklist (worked examples from the web app's engine)

Run each against F-01 and F-02. Every expected value below comes from
`src/lib/scoring.ts`.

**Fixed, higher is better.** Targets: Poor 60, IN 70, Meet 80, Good 90, VG 95, Exc 100.

| Actual | Expected |
| --- | --- |
| 80 | 3.4 Meet |
| 92 | 3.9 Good |
| 100 | 5.0 Excellent |
| 65 | 2.4 Poor (reached Poor only) |
| 30 | 1.2 Poor (2.4 × 30 ÷ 60) |

**Fixed, lower is better (days).** Targets: Poor 10, IN 8, Meet 6, Good 4, VG 3, Exc 2.

| Actual | Expected |
| --- | --- |
| 5 | 3.4 Meet |
| 20 | 1.2 Poor (2.4 × 10 ÷ 20) |

**Range, higher is better.** The Good window is 90–94.

| Actual | Expected |
| --- | --- |
| 92 | 3.7 (3.5 + 0.5 × 0.4) |

**Variance.** Planned 100, actual 108 → the scored value is 8 (%), and it is
scored as a lower-is-better range.

**Milestone, target October 2026:**

| Completed | Expected |
| --- | --- |
| 01/10/2026 | 3.4 |
| 31/10/2026 | 3.0 |
| 15/09/2026 | 3.7 (Good: 3.9 − 14/29 × 0.4) |
| 01/11/2026 | 2.9 |
| 01/12/2026 | 2.4 |
| 14/02/2027 | 0.9 (Dec 1 → Mar 31 is 120 days; 75 elapsed; 2.4 × 45/120) |
| 15/05/2026 | 5.0 (more than 3 months early) |
| Not completed, reporting 2026-10 | Not yet due |
| Not completed, reporting 2026-11 | 2.5 (as if done 30/11/2026, the last day of the month: 2.9 − 29/29 × 0.4) |

**Deadline, partial credit, deadline 2026-09:**

| Raw score | Reporting period | Expected |
| --- | --- | --- |
| 3.9 | 2026-10 | 2.9 |
| 3.9 | 2026-11 | 2.4 |
| 3.9 | 2026-12 | 0 |
| 2.0 | 2026-10 | 2.0 |

With "Score final after deadline" turned on: the score stays at its September
2026 value in every later month.

**Phasing, EVEN.** Meet target 120, reporting September (fiscal month 6):
the phased Meet target is 60, so an actual of 60 scores 3.4 (pro-rated).

**Entry selection:**

| Entries | Reporting | Expected |
| --- | --- | --- |
| Actual for 2026-08 only | 2026-09 | No data (old actuals aren't carried) |
| Estimate for 2026-08 only | 2026-09 | Uses the estimate (tagged est) |

**Frequency.** A quarterly KPI with no data in 2026-07 (fiscal month 4) is
*Not yet due* and excluded from coverage.

**Rollup.** Goal A (global 80) has leaf X (global 50, score 3.4) and leaf Y
(global 30, no data). Goal B (global 20) has leaf Z (global 20, score 2.0).

- Goal A = 3.4, with 62.5% coverage (50 ÷ 80).
- The total = (3.4 × 50 + 2.0 × 20) ÷ 70 = **3.0**, with 70% coverage.
- Y is left out, not counted as 0. Use unrounded child scores and round only at the end.

**Toggles:**

| Toggle | Case | Expected |
| --- | --- | --- |
| Assume Meet, decaying | Monthly KPI, last entry 2 months ago | 2.4 |
| Assume Meet, decaying | Milestone not yet due | 3.4 |
| Estimates: score as 0 | Estimate-based leaf | 0 |

**Insights.** A Fixed leaf at 3.4 (Meet) with global weight 10, where the
total scored weight is 100 → the opportunity is Good at 3.9, and the impact is
(3.9 − 3.4) × 10 ÷ 100 = **0.05**.

**Permissions:**

- A member can't enter a figure for another department's KPI.
- A member's settings change becomes a proposal.
- Approving a stale proposal is refused.
- Every write in a closed year is refused.
- A wrong phrase on delete is refused.

---

## 10. Gaps and differences from the web app

| Web app | In the Copilot Studio rebuild |
| --- | --- |
| Own username/password, 5-failure lockout, password change signs out other sessions, admin reset shows a one-time temporary password | Replaced by **Entra ID**. Lockout, MFA, password change and reset are configured in Entra. The scorecard keeps only approval, role and department. |
| Delete fiscal year asks for the admin's own **password** | An agent must never collect passwords in chat. The flow relies on the signed-in Entra identity plus the typed username and phrase. For a stronger gate, require a Teams **Approvals** response from a second admin. |
| Spreadsheet-style Enter Data grid and hierarchy drag-and-drop | Chat cards handle a few KPIs at a time. For bulk entry, use the Excel import, or add a **model-driven Power App** over the same tables (an editable grid view of `sc_KpiValue`). |
| Charts on the KPI page and dashboard | Adaptive cards have no charts. Use a Power BI report on `sc_KpiScore` / `sc_TotalScore` and link to it from cards, or embed it as a Teams tab next to the agent. |
| Live recomputation on every page view | Scores come from the `sc_KpiScore` cache, refreshed by F-06. Expect a short delay after a save. Non-default toggles and Simulate compute live. |
| Exact floating-point engine | Option B flows can drift on rounding edge cases (e.g. x.x5). Option A (the Azure Function running the original TypeScript) avoids this. |
| Closed-year snapshot is read in place of live scores | The topics must check *Closed on* and read `sc_FiscalYearSnapshot` for closed years. Add this check to T-01, T-02, T-03 and T-12. |
| Board report page with print styling | A Word template turned into a PDF. The layout must be designed once in Word. |
| Saved links to KPI pages break after a restore | The same applies here: restore rebuilds KPI rows, so stored KPI ids change. Refer to KPIs by **code** in chat. |
| Holding purge on the next admin page view | The scheduled daily flow is more accurate. |
| Premium connectors | Dataverse, HTTP/custom connectors and "Populate a Microsoft Word template" need **Power Automate Premium** / Copilot Studio licensing. Check before you build. |
