import Image from "next/image";

import { BAND_STYLES } from "@/lib/band-style";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "User Manual — KPI Scorecard" };

const TOC = [
  { href: "#account", label: "Account basics" },
  { href: "#nav", label: "Site navigation" },
  { href: "#scoring", label: "How scoring works" },
  { href: "#calc", label: "How each metric type is calculated" },
  { href: "#coverage", label: "Reading coverage & provisional scores" },
  { href: "#entering", label: "Entering KPI data" },
  { href: "#closing", label: "Closing a KPI" },
  { href: "#explainer", label: "Score breakdown & overrides" },
  { href: "#proposals", label: "Proposing changes" },
  { href: "#excel", label: "Excel export & import" },
  { href: "#glossary", label: "Glossary" },
] as const;

const NAV_PAGES = [
  { src: "dashboard", route: "/", title: "Dashboard", body: "The scorecard at a glance: overall score, strategic goals, and how each one is trending this period." },
  { src: "kpis", route: "/kpis", title: "KPIs", body: "Browse every KPI, grouped by level or as a flat master list. Click any KPI to see its full detail page." },
  { src: "deadlines", route: "/milestones", title: "Deadlines", body: "A running list of milestones across all KPIs, so nothing that's due soon gets missed." },
  { src: "entry", route: "/entry", title: "Enter Data", body: "The fastest way to log this month's figures for every KPI you're responsible for, in one grid." },
  { src: "simulate", route: "/simulate", title: "Simulate", body: "Try out “what if” values before you commit them, and see how they'd move the overall score." },
  { src: "insights", route: "/insights", title: "Insights", body: "Trends and comparisons across periods, to spot what's improving and what needs attention." },
] as const;

const ADMIN_PAGES = [
  { src: "manage-hierarchy", route: "/manage/hierarchy", title: "Hierarchy", body: "Add, rename, reorder, or remove Strategic Goals and KPIs, and set each one's metric type and target." },
  { src: "manage-weights", route: "/manage/hierarchy/weights", title: "Weights", body: "Set how much each KPI counts toward its parent's rollup score. Every group's weights must add up to 100%." },
  { src: "manage-users", route: "/manage/users", title: "Users", body: "Create accounts, assign departments, and grant or remove admin access." },
  { src: "manage-approvals", route: "/manage/approvals", title: "Approvals", body: "Review pending proposals from other departments and approve or reject each one." },
  { src: "manage-backups", route: "/manage/backups", title: "Backups & fiscal years", body: "Download a full backup, restore from one, and start, close, or reopen a fiscal year." },
] as const;

const GLOSSARY: [string, string][] = [
  ["Actual", "A confirmed, final figure for a period — what the score is based on whenever one exists."],
  ["Band", "One of six score ranges — Poor, Improvement Needed, Meet, Good, Very Good, Excellent — each with its own color."],
  ["Basis", "Whether a reported figure is an Actual or an Estimate."],
  ["Completed / Completion date", "Marking a KPI complete freezes its figure; the completion date is when that happened, used to score Month completion KPIs."],
  ["Deadline", "A cutoff month after which a late KPI's score is capped, even if it's later achieved."],
  ["Direction", "Whether a higher or a lower value is considered better for a KPI."],
  ["Estimate", "A provisional figure used when the confirmed number isn't available yet — scores from it are marked provisional."],
  ["Fixed target", "A target style with one number per band; reaching a band's number scores the top of that band."],
  ["Phasing", "Pro-rating an annual target down to what's expected by a given month, for KPIs set up that way."],
  ["Proposal", "A pending edit to a KPI outside your department, awaiting an admin's approval."],
  ["Range target", "A target style where each band owns a value window; landing in it slides your score across that band."],
  ["Rollup", "A KPI (usually a Strategic Goal) whose score is the weighted average of its children, rather than its own reported figure."],
  ["Score override", "A manual score set by an admin for a specific period, replacing the formula's result."],
  ["Variance", "A metric type comparing an actual figure to a planned/budgeted one, as a percentage difference."],
  ["Weight", "How much a KPI counts toward its parent's rollup score; every group's weights add up to 100%."],
];

export default async function ManualPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">User Manual</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          A short guide to finding your way around, understanding how scores are calculated, and entering your
          monthly KPI data.
        </p>
      </div>

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {TOC.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
          >
            {item.label}
          </a>
        ))}
        {isAdmin && (
          <a
            href="#admin"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:border-amber-300"
          >
            Admin tools
          </a>
        )}
      </nav>

      <Section id="account" title="Account basics" lede="No email address is needed — accounts are just a username, a password, and a department.">
        <div className="grid gap-4 sm:grid-cols-2">
          <PageCard src="register" title="Creating an account" route="/register" body="Pick a username and password, and choose the department you belong to — that determines which KPIs you can edit directly." />
          <PageCard src="login" title="Signing in" route="/login" body="As you type your username, a status icon shows whether the account exists and is approved yet." />
        </div>
        <Callout>
          <strong>New accounts need approval.</strong> After registering, an admin has to approve the account before
          it can sign in — you&apos;ll see a pending (⏱) icon on the login page until then.
        </Callout>
        <Callout>
          <strong>Forgot your password?</strong> There&apos;s no self-service reset — ask an admin to reset it for
          you from the Users page.
        </Callout>
      </Section>

      <Section id="nav" title="Site navigation" lede="The menu at the top of every page has six sections. Here's what each one is for.">
        <div className="grid gap-4 sm:grid-cols-2">
          {NAV_PAGES.map((p) => (
            <PageCard key={p.src} {...p} />
          ))}
        </div>
        <Callout>
          <strong>Admins only:</strong> a &quot;Manage KPIs&quot; menu also appears, covering Hierarchy, Weights,
          Users, Approvals and Backups — for setting up and maintaining the scorecard itself.
        </Callout>
      </Section>

      <Section id="scoring" title="How scoring works" lede="Every KPI is scored on the same 0–5 scale, which is then translated into one of six color bands.">
        <BandTable />
        <p className="text-sm text-gray-700">
          <strong>Where the score comes from.</strong> Each KPI compares its actual figure to its target, using
          whichever type of metric fits it best:
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricTile label="Percentage" example="78% vs 85%" />
          <MetricTile label="Dollar" example="$1.2M vs $1.5M" />
          <MetricTile label="Quantity" example="42 vs 50 units" />
          <MetricTile label="Days" example="12 vs 10 days" />
          <MetricTile label="Month completion" example="Done by Aug vs Jul" />
          <MetricTile label="Variance" example="±3% vs ±5%" />
        </div>
        <p className="text-sm text-gray-700">
          Every KPI is also marked <strong>higher is better</strong> or <strong>lower is better</strong> — a rising
          cost is bad, a rising revenue is good — and its target can be a single fixed number or a range. The
          screenshot below shows where these live on a KPI&apos;s own page.
        </p>
        <Screenshot src="kpi-detail-target" alt="KPI detail page showing the target and band definitions" caption="A KPI's detail page — target, direction, and the band definitions for that specific KPI." height={900} />
        <Callout>
          <strong>Rollups.</strong> A Strategic Goal or grouping KPI doesn&apos;t have its own figure to enter — its
          score is simply the weighted average of the KPIs beneath it. Improve a child KPI&apos;s score, and every
          level above it moves too.
        </Callout>
      </Section>

      <Section id="calc" title="How each metric type is calculated" lede="Every KPI uses one of six calculation styles, chosen when the KPI was set up. Here's the plain-language logic behind each one.">
        <CalcCard tag="Fixed target" title="Percentage · Dollar · Quantity · Days">
          <p>
            Each band (Poor through Excellent) has its own target number. You get the top score of the best band
            whose target you&apos;ve reached. Fall short of even the Poor target, and you still get partial credit
            for how close you got — you&apos;re not dropped straight to zero.
          </p>
          <Example>Poor target: 70% · Meet target: 85% → hitting 85% scores 3.4 (top of Meet). Hitting only 50% scores partial credit toward the Poor band.</Example>
        </CalcCard>
        <CalcCard tag="Range target" title="Percentage · Dollar · Quantity · Days">
          <p>
            Instead of one number per band, each band owns a window (e.g. &quot;90%–94% = Good&quot;). Landing inside
            a window slides your score smoothly across that band&apos;s range — closer to the good edge of the
            window scores higher within the band.
          </p>
          <Example>Good window: 90%–94% (scores 3.5–3.9) → landing at 92% (the midpoint) scores about 3.7.</Example>
        </CalcCard>
        <CalcCard tag="Milestone" title="Month completion">
          <p>
            Set up with one target month. Finishing exactly on time scores a Meet. Every month early moves up a
            band; every month late moves down. Within your finishing month, the score slides by the day — finishing
            on the 1st scores near the top of that band, finishing on the last day scores near the bottom.
          </p>
          <Example>Target: October 2026 → complete Sep 2026 (1 month early) = Good band. Complete Nov 2026 (1 month late) = Improvement Needed band.</Example>
          <p>
            <strong>Still not finished two or more months later?</strong> The score doesn&apos;t just drop into Poor
            and sit there — it keeps decaying every day, all the way down to 0 by the end of the fiscal year (31
            March). A milestone that keeps slipping keeps losing ground, right up to year end, rather than resetting
            each month.
          </p>
        </CalcCard>
        <CalcCard tag="Budget/plan comparison" title="Variance">
          <p>
            Compares an actual figure to a planned or budgeted figure, as a percentage difference — it doesn&apos;t
            matter whether you&apos;re over or under, only how far off you are. That percentage is then scored
            against a range target, the same way as above.
          </p>
          <Example>Planned: $100K · Actual: $112K → 12% variance, scored against the variance bands.</Example>
        </CalcCard>

        <p className="text-sm text-gray-700">
          <strong>Deadlines.</strong> Some KPIs also carry a deadline month. Miss it, and the score that would
          otherwise be earned gets capped by how late the KPI is — later achievement still counts, but only up to
          the cap below.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <th className="px-3 py-2">How late</th>
              <th className="px-3 py-2">Best possible score</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr className="border-b border-gray-50"><td className="px-3 py-2 font-medium">On time</td><td className="px-3 py-2">No cap — scores normally</td></tr>
            <tr className="border-b border-gray-50"><td className="px-3 py-2 font-medium">1 month late</td><td className="px-3 py-2">2.9 (top of Improvement Needed)</td></tr>
            <tr className="border-b border-gray-50"><td className="px-3 py-2 font-medium">2 months late</td><td className="px-3 py-2">2.4 (top of Poor)</td></tr>
            <tr><td className="px-3 py-2 font-medium">3+ months late</td><td className="px-3 py-2">0</td></tr>
          </tbody>
        </table>
        <Callout>
          <strong>Frozen at deadline.</strong> A KPI can instead be set to simply freeze at whatever it scored in
          its deadline month — later changes then have no effect on the score at all, capped or otherwise.
        </Callout>
        <Callout>
          <strong>Phasing.</strong> An annual target can also be pro-rated down to what&apos;s expected so far this
          year, for KPIs set up that way — so a KPI due to hit 1,200 units for the year isn&apos;t scored as though
          300 units by June is a failure. Neither a deadline nor phasing applies unless the KPI was specifically
          configured for it.
        </Callout>
      </Section>

      <Section id="coverage" title="Reading coverage & provisional scores" lede="A Strategic Goal's score is only ever as complete as the data behind it — these signals show how much of it is solid.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Scored count</h3>
            <p className="mt-1 text-sm text-gray-600">
              Next to a rollup&apos;s score you&apos;ll see a count like &quot;12/15&quot; — how many of its leaf
              KPIs have a figure recorded this period, out of how many exist.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">est</span>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">Provisional (&quot;est&quot;)</h3>
            <p className="mt-1 text-sm text-gray-600">
              A small &quot;est&quot; marker on a score means some or all of it rests on an Estimate rather than a
              confirmed Actual — treat it as provisional until the Actual comes in.
            </p>
          </div>
        </div>
        <Callout>
          <strong>Not yet due</strong> shows as a dash or &quot;n/d&quot; rather than a gap — it means the
          KPI&apos;s reporting frequency (e.g. quarterly) simply doesn&apos;t call for a figure this month, so it
          isn&apos;t counted as missing data.
        </Callout>
      </Section>

      <Section id="entering" title="Entering KPI data" lede="Two ways to log a month's figures — the fast grid for many KPIs at once, or a single KPI's own page for more detail.">
        <ol className="space-y-6">
          <Step n={1} title="Open Enter Data and pick the period">
            Go to <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/entry</code> and choose the month
            you&apos;re reporting for. Every KPI you own appears as a row.
          </Step>
          <Step n={2} title="Fill in the value and mark it Actual or Estimate">
            Type the figure into the YTD field. Use the Basis dropdown to say whether it&apos;s a confirmed Actual
            or a working Estimate — scores update live as you type.
            <Screenshot src="entry" alt="Enter Data grid with values, basis dropdowns and score chips" caption="The Enter Data grid — KPI code, YTD value, Basis, and the resulting score chip, all in one row." height={900} />
          </Step>
          <Step n={3} title="Need more detail? Open the KPI's own page">
            Click through to a KPI to use its &quot;Report for month&quot; panel — set a completion date, tick Mark
            complete, and add a note alongside the figure.
          </Step>
          <Step n={4} title="Post a Progress Update">
            Below the report panel, add a Progress Update to explain what happened this month — pick Simple for a
            quick note, or Detailed for a fuller write-up.
            <Screenshot src="kpi-detail-report" alt="KPI detail page report panel with progress updates" caption="The Report for month panel, with the Progress Updates feed and Simple / Detailed toggle below it." height={900} />
          </Step>
        </ol>
      </Section>

      <Section id="closing" title="Closing a KPI" lede="&quot;Closing&quot; a KPI means locking in its final figure so it stops changing — here's how Actual/Estimate and Mark complete work together to do that.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Actual</span>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">Reporting as Actual</h3>
            <p className="mt-1 text-sm text-gray-600">A confirmed, final figure for the period. Actual figures are what the score is based on whenever one exists.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Estimate</span>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">Reporting as Estimate</h3>
            <p className="mt-1 text-sm text-gray-600">A provisional figure, used when the real number isn&apos;t confirmed yet. The score still shows, but is marked provisional until it&apos;s replaced by an Actual.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          <strong>Marking a KPI complete</strong> freezes its value — the figure on record stops changing for the
          rest of the fiscal year, even if you&apos;d otherwise report a new one later. It&apos;s meant for KPIs
          that reach a finish line (a project, a milestone) rather than ones that get reported every month
          indefinitely.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <span className="inline-block rounded-full bg-blue-900 px-2 py-0.5 text-[11px] font-semibold text-white">Marked complete</span>
          <p className="mt-2 text-sm text-gray-600">
            Once ticked, the KPI&apos;s fields lock and its score carries forward unchanged. To make further
            changes, someone with access first unchecks &quot;Mark complete&quot; to reopen it.
          </p>
        </div>
        <Callout>
          <strong>The app will offer to do this for you.</strong> If you report a completion date and set the
          figure to Actual, a prompt appears asking whether to mark the KPI complete right there — since reporting
          an actual completion date usually means the work is genuinely done.
        </Callout>
        <Callout>
          <strong>Marked incomplete</strong> simply means &quot;Mark complete&quot; is unchecked — the default
          state. The KPI keeps being reported normally, period after period, with no figure frozen.
        </Callout>
      </Section>

      <Section id="explainer" title="Score breakdown & overrides" lede="Every KPI's page has a &quot;How was this score calculated?&quot; panel that shows the exact numbers behind its score.">
        <Screenshot src="score-explainer" alt="Score breakdown panel expanded on a KPI detail page" caption="Click &quot;How was this score calculated?&quot; to expand the formula actually used for that KPI's score this period." height={900} />
        <p className="text-sm text-gray-700">
          For a rollup KPI, this panel instead lists every child KPI and its share of the parent&apos;s score — so
          you can see exactly which one is dragging a Strategic Goal down.
        </p>
        <Callout>
          <strong>Overrides.</strong> Occasionally an admin will manually calibrate a score — for a one-off
          situation the formula doesn&apos;t capture well. When that&apos;s happened, this panel shows a note naming
          who made the change, when, and why, alongside what the formula alone would have produced.
        </Callout>
      </Section>

      <Section id="proposals" title="Proposing changes" lede="What happens when you edit a KPI outside your own department.">
        <p className="text-sm text-gray-700">
          You can freely enter data for KPIs your department owns — changes save immediately, as shown earlier.
          Edit a KPI that belongs to a different department, though, and the save button instead sends it in as a{" "}
          <strong>proposal</strong>: nothing changes yet.
        </p>
        <Callout>
          <strong>What happens next.</strong> An admin reviews pending proposals on the Approvals page and either
          approves it (the change applies exactly as you entered it) or rejects it. Either way, you&apos;re not left
          wondering — the KPI&apos;s page shows your proposal as pending until it&apos;s actioned.
        </Callout>
      </Section>

      <Section id="excel" title="Excel export & import" lede="The whole scorecard can be downloaded as a spreadsheet, edited offline, and brought back in.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Export to Excel</h3>
            <p className="mt-1 text-sm text-gray-600">
              A link on the Dashboard downloads the current fiscal year as a workbook — every KPI, its monthly
              figures, and its Progress Updates, laid out on separate sheets with a Readme explaining each column.
            </p>
          </div>
          <PageCard src="import-preview" title="Import preview" route="/import" body="Upload that file back (edited or not) and the Import page shows exactly what would change before anything is saved." />
        </div>
        <Callout>
          <strong>Nothing changes until you confirm.</strong> The preview step flags any problems in the file and
          totals up what would be added, updated, or removed. Only after you click through to confirm does the
          import actually write to the scorecard.
        </Callout>
      </Section>

      {isAdmin && (
        <Section id="admin" title="Admin tools" badge="Admin only" lede="These pages only appear in the &quot;Manage KPIs&quot; menu for admin accounts.">
          <div className="grid gap-4 sm:grid-cols-2">
            {ADMIN_PAGES.map((p) => (
              <PageCard key={p.src} {...p} />
            ))}
          </div>
        </Section>
      )}

      <Section id="glossary" title="Glossary" lede="Quick reference for terms used throughout this guide.">
        <dl className="divide-y divide-gray-100">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="font-mono text-sm font-semibold text-gray-900">{term}</dt>
              <dd className="text-sm text-gray-600">{def}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  lede,
  badge,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="border-b-2 border-blue-900/80 pb-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          {title}
          {badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {badge}
            </span>
          )}
        </h2>
        {lede && <p className="mt-1 max-w-2xl text-sm text-gray-600">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

const IMAGE_HEIGHTS: Record<string, number> = { "import-preview": 1377 };

function PageCard({ src, route, title, body }: { src: string; route: string; title: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <Image
        src={`/manual/${src}.png`}
        alt={`${title} page screenshot`}
        width={1280}
        height={IMAGE_HEIGHTS[src] ?? 900}
        loading="eager"
        className="w-full border-b border-gray-200"
      />
      <div className="p-3">
        <code className="mb-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-blue-700">{route}</code>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-0.5 text-sm text-gray-600">{body}</p>
      </div>
    </div>
  );
}

function Screenshot({
  src,
  alt,
  caption,
  height,
}: {
  src: string;
  alt: string;
  caption: string;
  height: number;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <Image src={`/manual/${src}.png`} alt={alt} width={1280} height={height} loading="eager" className="w-full" />
      <figcaption className="border-t border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">{caption}</figcaption>
    </figure>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-r border-l-4 border-blue-600 bg-blue-50/60 px-4 py-2.5 text-sm text-gray-700">
      {children}
    </div>
  );
}

function BandTable() {
  return (
    <table className="w-full overflow-hidden rounded-lg text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
          <th className="px-3 py-2">Band</th>
          <th className="px-3 py-2">Score range</th>
        </tr>
      </thead>
      <tbody>
        <BandRow band="POOR" range="0.0 – 2.4" />
        <BandRow band="IMPROVEMENT_NEEDED" range="2.5 – 2.9" />
        <BandRow band="MEET" range="3.0 – 3.4" />
        <BandRow band="GOOD" range="3.5 – 3.9" />
        <BandRow band="VERY_GOOD" range="4.0 – 4.5" />
        <BandRow band="EXCELLENT" range="4.6 – 5.0" last />
      </tbody>
    </table>
  );
}

function BandRow({ band, range, last }: { band: keyof typeof BAND_STYLES; range: string; last?: boolean }) {
  const style = BAND_STYLES[band];
  return (
    <tr className={last ? "" : "border-b border-gray-50"}>
      <td className="px-3 py-2 font-medium text-gray-900">{style.label}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2 text-gray-700">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: style.hex }} />
          {range}
        </span>
      </td>
    </tr>
  );
}

function MetricTile({ label, example }: { label: string; example: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="tabular mt-0.5 text-xs text-gray-700">{example}</div>
    </div>
  );
}

function CalcCard({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        {title}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase">{tag}</span>
      </h3>
      <div className="space-y-2 text-sm text-gray-600">{children}</div>
    </div>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return <p className="tabular rounded bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-700">{children}</p>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[34px_1fr] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white">{n}</span>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="max-w-2xl text-sm text-gray-600">{children}</div>
      </div>
    </li>
  );
}
