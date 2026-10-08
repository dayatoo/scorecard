# Rebuilding the KPI Scorecard in Microsoft Copilot Studio

This is a step-by-step guide to rebuilding the KPI Scorecard web app in the
Microsoft Power Platform. It assumes you have **never built anything there
before**. Every step says where to click, what to paste and how to check that
it worked.

When you finish, your company will have two ways into the same scorecard:

- **The Scorecard app**: a Power Apps app with the same screens as the web
  app. It has a dashboard with coloured bands, the KPI list, KPI pages with
  charts, the Enter Data grid, Insights, Simulate, Deadlines, and the Manage
  screens for admins. It runs in a web browser, in Teams and on phones.
- **The Scorecard agent**: a chat assistant in Microsoft Teams. People can
  ask it "How are we doing this month?", tell it a figure in plain English,
  post a progress update or ask why a KPI scored what it did.

Both read the same data and use the same flows to save changes, so anything
done in one shows up straight away in the other.

---

## Contents

- [Before you begin](#before-you-begin)
- [Part 1. Get access](#part-1-get-access)
- [Part 2. Set up your workspace](#part-2-set-up-your-workspace)
- [Part 3. Build the database](#part-3-build-the-database)
- [Part 4. Set up security](#part-4-set-up-security)
- [Part 5. Build the scoring engine](#part-5-build-the-scoring-engine)
- [Part 6. Build the action flows](#part-6-build-the-action-flows)
- [Part 7. Build the app](#part-7-build-the-app)
- [Part 8. Build the chat agent](#part-8-build-the-chat-agent)
- [Part 9. Excel import and export](#part-9-excel-import-and-export)
- [Part 10. The board report](#part-10-the-board-report)
- [Part 11. Background jobs](#part-11-background-jobs)
- [Part 12. Move your existing data across](#part-12-move-your-existing-data-across)
- [Part 13. Publish and roll out](#part-13-publish-and-roll-out)
- [Part 14. Final testing checklist](#part-14-final-testing-checklist)
- [Part 15. Troubleshooting](#part-15-troubleshooting)
- [Part 16. Differences from the web app](#part-16-differences-from-the-web-app)
- [Appendix A. Developer handover: exact scoring with an Azure Function](#appendix-a-developer-handover-exact-scoring-with-an-azure-function)
- [Appendix B. The scoring rulebook](#appendix-b-the-scoring-rulebook)
- [Appendix C. Sample data for testing](#appendix-c-sample-data-for-testing)

---

## Before you begin

### What you're building

The web app has three layers. Each one gets a Microsoft equivalent:

| Layer | In the web app | In the new version |
| --- | --- | --- |
| Where the data lives | A Postgres database | **Dataverse**: Microsoft's database, built into the Power Platform |
| Where the work gets done (scoring, saving, imports) | Server code | **Flows**: automations built in Power Automate, mostly by describing them to Copilot |
| What people see | Web pages | **A canvas app** built in Power Apps, with the same screens as the web app, plus **an agent**: a chat assistant built in Copilot Studio, used inside Microsoft Teams |

### How long it takes

Plan for several weeks of part-time work:

- Parts 1 to 5 (access, database, security, scoring) take a few days.
- Part 6 (the flows that save changes) takes a few days more.
- Part 7, building the app's screens, takes the most time: plan on a day or two per screen at first, getting faster as you go.
- Part 8, the chat agent, takes a few days once the flows exist.

You can stop after any screen or feature and pick up again later. The app is
usable as soon as its first screens work.

### How to follow this guide

- **Work in order.** Later parts depend on earlier ones. For example, the flows in Part 5 need the tables from Part 3.
- **Test after every step.** Each step ends with a **Check it worked** box. Don't move on until it passes. A mistake found early takes minutes to fix; found late, it takes hours.
- **Copilot makes first drafts, not finished work.** Wherever this guide asks you to paste a prompt into Copilot, Copilot builds something *close* to what you need. The **Check it worked** list tells you what to compare.
- **Microsoft's screens change often.** The button and menu names here were correct in 2026. If a button isn't where the guide says, look for one with a similar name nearby, or search [Microsoft Learn](https://learn.microsoft.com) for the step's title.

Each step uses the same labels:

> **Do this:** the clicks to make.
>
> **Copy this prompt:** a grey box. Copy the whole box (most viewers show a copy button in its corner) and paste it where the step says.
>
> **Check it worked:** what you should see.
>
> **If something goes wrong:** the usual causes and fixes.

### Words you'll meet

| Word | What it means |
| --- | --- |
| **Environment** | Your own private space in the Power Platform, like a separate office building. Everything for the scorecard lives in one environment. |
| **Dataverse** | The database inside an environment. |
| **Table** | One kind of record in Dataverse, like one sheet in a spreadsheet. For example, there is one table of KPIs and one table of monthly values. |
| **Column** | One field in a table, like a spreadsheet column (for example "Name" or "Weight"). |
| **Row** | One record in a table (for example one KPI). |
| **Choice** | A column where you pick from a fixed list (for example Monthly / Quarterly / Annual). |
| **Lookup** | A column that points at a row in another table (for example a KPI value points at its KPI). |
| **Logical name** | The name Microsoft uses for a table or column behind the scenes, in lower case with the prefix, for example `sc_kpiscore`. Shown on each table's **Columns** page. |
| **Solution** | A folder that holds everything you build, so it can be moved or backed up as one piece. |
| **Publisher prefix** | A short code (here `sc`) that Microsoft puts in front of every name you create, so yours never clash with anyone else's. |
| **Flow** | An automation built in Power Automate: a list of steps that runs when something starts it. |
| **Child flow** | A flow that other flows call, like a reusable calculator. |
| **Agent flow** | A flow the agent can call during a chat. |
| **Expression** | A small formula inside a flow, like a spreadsheet formula. This guide gives you the ones you need, ready to paste. |
| **Canvas app** | An app you design screen by screen in Power Apps, placing buttons, lists and boxes where you want them, like a slide in PowerPoint. |
| **Screen** | One page of the app, for example the Dashboard. |
| **Control** | One thing placed on a screen: a label, a button, a text box, a drop-down, a chart. |
| **Gallery** | A control that repeats a layout once per row of data, for example one line per KPI. |
| **Power Fx** | The formula language of Power Apps. It works like Excel formulas. This guide gives you the formulas, ready to paste. |
| **Variable / collection** | A value (variable) or a small table (collection) the app remembers while it's open, for example the selected month. |
| **Agent** | The chat assistant, built in Copilot Studio. |
| **Topic** | One conversation the agent knows how to have (for example "enter figures"). |
| **Tool** | Something the agent can use: usually a flow, or an AI prompt. |
| **Adaptive card** | A small form shown in the chat, with boxes and buttons. |
| **Security role** | A set of permissions saying what someone may see or change. |
| **Entra ID** | Microsoft's sign-in system: the same work account people use for Outlook and Teams. |
| **Period** | A month written as `YYYY-MM`, for example `2026-10` for October 2026. |
| **Fiscal year** | 1 April to 31 March. "FY2026/27" runs from 1 April 2026 to 31 March 2027. |
| **Leaf KPI** | A KPI with no KPIs beneath it. Only leaf KPIs have targets and monthly figures; every KPI above them gets its score from the leaves beneath it. |

### Choose how the scores are calculated

The scoring rules are the hardest part of the app to rebuild. You have two routes:

| | Route A: developer | Route B: no code |
| --- | --- | --- |
| **Who builds it** | A developer, in about a day, using Appendix A | You, by following Part 5 |
| **How it works** | The web app's existing scoring code runs in Microsoft Azure, and your flows call it | The scoring rules are rebuilt as flows |
| **Accuracy** | Scores match the web app exactly | Matches in almost every case; rare rounding differences of 0.1 are possible |
| **Speed** | Fast | Slower: a full recalculation of a large scorecard can take several minutes |
| **Extra cost** | A small Azure bill | None beyond the Power Platform licences |

This guide follows **Route B** throughout, so you can build everything yourself.
If you have a developer, hand them Appendix A. When they finish, skip steps
5.5, 5.6, 5.7 and 5.10, build step 5.11 the shorter way Appendix A, step A.6
describes, and build the Simulate flow (A31, in 6.13) the way step A.7
describes. Everything else in the guide stays the same. The app and the
agent never call the scoring flows directly, so they don't care which route
you chose.

### Progress checklist

Copy this list somewhere and tick each step off as you go:

- [ ] Part 1: access and licences confirmed
- [ ] Part 2: environment, solution and SharePoint site created
- [ ] Part 3: all choices and tables created, sample data entered
- [ ] Part 4: security roles created and assigned
- [ ] Part 5: scoring flows built and tested against the examples
- [ ] Part 6: action flows built and tested
- [ ] Part 7: app screens built (tick each screen in 7.4 to 7.17)
- [ ] Part 8: chat agent built (tick each feature in 8.1)
- [ ] Part 9: Excel import and export working
- [ ] Part 10: board report working
- [ ] Part 11: background jobs running
- [ ] Part 12: real data moved across from the web app
- [ ] Part 13: app and agent published to Teams and shared
- [ ] Part 14: final tests passed

---

## Part 1. Get access

### 1.1 Check what you already have

> **Do this:**
>
> 1. Open [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com) and sign in with your work account.
> 2. Open [make.powerapps.com](https://make.powerapps.com) and [make.powerautomate.com](https://make.powerautomate.com) the same way.
>
> **Check it worked:** all three open without asking you to buy anything or start a trial.
>
> **If something goes wrong:** if any of them asks for a licence or offers a trial, don't start a trial for real work: trials expire and can take your work with them. Ask IT using the email in 1.2.

### 1.2 Ask IT for what you need

Most of this needs an IT administrator. You can send them this email (edit
the parts in square brackets):

> **Subject:** Power Platform access for the KPI Scorecard rebuild
>
> Hi [name],
>
> I'm rebuilding our KPI Scorecard as a Copilot Studio agent. Could you please set up the following?
>
> 1. **A Copilot Studio licence** for me (to build the agent), and message capacity so staff can use the agent in Teams.
> 2. **Power Apps Premium** (or a per-app licence) for me and for **every member of staff who will use the Scorecard app**. The app stores its data in Dataverse, which needs a premium licence for each user.
> 3. **Power Automate Premium** for me and for a service account (see 5). The flows use premium connectors: Dataverse, Excel Online (Business) and Word Online (Business).
> 4. **A new Power Platform environment** named "KPI Scorecard", with a Dataverse database, in our usual region. Please make me a System Administrator of it.
> 5. **A service account**, for example `scorecard.service@[company].com`, with the licences in 1 to 3 and System Administrator on the new environment. The flows will run as this account, so they keep working when staff change.
> 6. **A SharePoint site** named "KPI Scorecard" with me as an owner.
> 7. **A Microsoft Entra security group** named "KPI Scorecard Users" containing everyone who should be able to use the scorecard.
> 8. **AI prompts (AI Builder) enabled** in the environment. The agent uses them to understand figures typed in plain English.
> 9. **Permission to publish a Copilot Studio agent and a Power Apps app to Microsoft Teams** for our organisation, or let me know the approval process.
>
> Thank you!

### 1.3 Optional: practise first in a free environment

If IT will take a while, you can practise Parts 2 to 8 in a free personal
**Developer environment** while you wait:

> **Do this:**
>
> 1. Search the web for "Power Apps Developer Plan" and sign up with your work account.
> 2. It creates an environment named after you. Select it in step 2.2.
>
> **Note:** a Developer environment is for practice. Only you can use it, and it can't be shared with staff. Build the real thing in the environment from 1.2. (The solution from 2.3 can be exported from one environment and imported into another, so your practice work isn't wasted.)

---

## Part 2. Set up your workspace

### 2.1 Create the environment (skip if IT created it)

> **Do this:**
>
> 1. Open [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com).
> 2. In the left menu choose **Manage**, then **Environments**, then **+ New**.
> 3. **Name:** `KPI Scorecard`. **Type:** Production, or Sandbox for testing. **Region:** your usual region.
> 4. Turn on **Add a Dataverse data store**. Click **Next**.
> 5. **Language:** English. **Currency:** BND, or your company's currency. Click **Save**.
>
> **Check it worked:** after a few minutes the environment's state shows **Ready**.

### 2.2 Select the environment in every tool

Copilot Studio, Power Apps and Power Automate each have an **environment
picker** in the top-right corner. It shows the name of the environment you're
working in.

> **Do this:** in each of the three tools, click the picker and choose **KPI Scorecard**.
>
> **If something goes wrong:** if you build something in the wrong environment, it's simply not there when you look in the right one. Always check the picker before you start a session.

### 2.3 Create the solution and publisher

> **Do this:**
>
> 1. In [make.powerapps.com](https://make.powerapps.com), click **Solutions** in the left menu, then **+ New solution**.
> 2. **Display name:** `KPI Scorecard`.
> 3. Next to **Publisher**, click **+ New publisher**:
>    - **Display name:** `Scorecard`
>    - **Name:** `scorecard`
>    - **Prefix:** `sc`
>    - Click **Save**.
> 4. Select the new **Scorecard** publisher and click **Create**.
>
> **Check it worked:** "KPI Scorecard" appears in the Solutions list. Open it and you'll see it's empty.

> **Important rule for the rest of this guide:** always create tables,
> choices, flows and the agent **from inside this solution**. Open
> **Solutions → KPI Scorecard**, then click **+ New**. Anything created
> elsewhere ends up outside the solution. If that happens, open the solution
> and click **Add existing** to pull it in.

### 2.4 Create the SharePoint libraries

The flows need somewhere to keep files: templates, imports, exports and board
reports.

> **Do this:**
>
> 1. Open the "KPI Scorecard" SharePoint site IT created.
> 2. Click **+ New → Document library** four times, creating:
>    - `Scorecard Templates`: the Excel and Word templates
>    - `Scorecard Imports`: where admins drop spreadsheets to import
>    - `Scorecard Exports`: where exports and audit trails are saved
>    - `Board Reports`: generated PDF reports
>
> **Check it worked:** all four libraries appear under **Site contents**.

### 2.5 Know your time zone

Flows run on UTC, which is 8 hours behind Brunei. Wherever this guide needs
"today", it converts to local time with:

```text
convertFromUtc(utcNow(), 'Singapore Standard Time')
```

`Singapore Standard Time` is Microsoft's name for UTC+8, which is the same as
Brunei time. Use your own time zone's name if you're elsewhere.

---

## Part 3. Build the database

### 3.1 How this part works

You'll create:

1. **13 choices**: the fixed lists, created first because the tables use them.
2. **18 tables and 1 relationship**, in a set order, because some tables point at others.
3. **Keys and delete rules**: rules that stop duplicates and link tables.
4. **Sample data** for testing.

For each table, you paste a prompt into Copilot, compare what it proposes
against the **Check it worked** list, and fix anything missing by hand.
Procedures A to E below explain the hand fixes. You'll use them many times,
so read them once now.

### 3.2 Procedure A: create a choice

> **Do this:**
>
> 1. Open **Solutions → KPI Scorecard**.
> 2. Click **+ New → More → Choice**.
> 3. Enter the **Display name** (for example `Metric type`). The name gets the prefix automatically (`sc_metrictype`).
> 4. Under **Items**, type the first label. Click **+ New choice** for each further label.
> 5. Click **Save**.

### 3.3 Procedure B: create a table with Copilot

> **Do this:**
>
> 1. Open **Solutions → KPI Scorecard**.
> 2. Click **+ New → Table**. If you see a **Start with Copilot** or **Describe the new table** option, choose it. If you only see **Table (advanced properties)**, choose that and add the columns by hand using Procedure C.
> 3. Paste the table's prompt and press Enter.
> 4. Copilot shows a preview of the table. Compare its columns with the **Check it worked** list under the prompt. You can ask Copilot to fix things in plain English, for example "Make Weight a decimal with 4 decimal places".
> 5. Click **Save and exit** (or **Create**).
>
> **If something goes wrong:**
>
> - **Copilot made its own list instead of using your choice.** Delete that column and re-add it with Procedure C, choosing **Choice** and then **Sync with global choice**.
> - **The table didn't appear in the solution.** Click **Add existing → Table** inside the solution.
> - **A column is the wrong type.** Most column types can't be changed after creation. Delete the column and recreate it.
> - **Copilot added extra columns you didn't ask for.** They do no harm, but you can delete them to keep things tidy.

### 3.4 Procedure C: add or fix a column by hand

> **Do this:**
>
> 1. Open the table, then **Columns**, then **+ New column**.
> 2. Fill in **Display name**, **Data type** and **Required** using this table:
>
> | The guide says | Choose this Data type |
> | --- | --- |
> | text | **Single line of text**. Set **Maximum character count** where the guide gives one. |
> | long text | **Multiple lines of text**. Set **Maximum character count** to the largest value allowed. |
> | whole number | **Whole number** |
> | decimal (N places) | **Decimal**. Set **Decimal places** to N. |
> | yes/no | **Yes/no**. Set the **Default value**. |
> | date | **Date only** |
> | date and time | **Date and time** |
> | choice X | **Choice**, then **Sync with global choice**, then pick X |
> | lookup to X | **Lookup**, then **Related table** X |
> | file | **File**. Set **Maximum file size** (in KB). |
> | autonumber | **Autonumber** |
>
> 3. Click **Save**.

### 3.5 Procedure D: add a key (stops duplicates)

A key tells Dataverse "never allow two rows with the same value in these
columns". For example, no two KPIs in the same fiscal year may share a code.

> **Do this:**
>
> 1. Open the table, then **Keys**, then **+ New key**.
> 2. Name it (for example `Year and code`) and tick the columns listed in the guide.
> 3. Click **Save**. Dataverse takes a minute or two to build the key; refresh until its status says **Active**.

### 3.6 Procedure E: set what happens when a linked row is deleted

Every lookup has a **relationship behaviour**. This guide uses three:

- **Parental (cascade delete):** deleting the row being looked up also deletes this row. For example, deleting a fiscal year deletes its KPIs.
- **Referential, remove link:** deleting the row being looked up just empties this row's lookup. The row itself stays.
- **Referential, restrict delete:** the row being looked up can't be deleted while this row points at it.

> **Do this:**
>
> 1. Open the table that holds the lookup, then **Relationships**.
> 2. Open the relationship, then **Advanced options**, then **Type of behaviour**.
> 3. Choose the behaviour the guide names, then **Done** and **Save**.

### 3.7 Create the choices

Use Procedure A for each row below. Type the items exactly as shown: the flows
compare against these exact words.

| Display name | Items, in this order |
| --- | --- |
| Metric type | Percentage, Dollar, Quantity, Days, Month completion, Variance |
| Direction | Higher is better, Lower is better |
| Target mode | Fixed, Range |
| Frequency | Monthly, Quarterly, Annual |
| Phasing | None, Even, Custom |
| Value basis | Actual, Estimate |
| User role | Member, Admin |
| User status | Pending, Approved |
| Proposal status | Pending, Approved, Rejected |
| Update mode | Detailed, Simple |
| Band | Poor, Improvement needed, Meet, Good, Very good, Excellent |
| Pending reason | No data, Not yet due |
| Fiscal year action | Closed, Reopened, Restored from checkpoint, Moved to holding, Restored from holding, Permanently deleted |

> **Check it worked:** the solution lists 13 choices, each with the right number of items.

**Write down each item's number.** Behind every choice item is a number, for
example `100000000` for the first item and `100000001` for the second. Flows
must use these numbers when they save a choice. Open each choice, click an
item, open **Advanced options** and note its **Value**. Usually the first item
is `100000000` and each next item adds 1, but check: it depends on your
publisher. The rest of this guide assumes that pattern. If yours differs, use
your numbers wherever the guide gives one.

### 3.8 Create the tables

Create them **in this order**: a table can only look up a table that already
exists. Each prompt goes into Procedure B.

#### Table 1: Department

```text
Create a table called "Department" (plural "Departments") to hold the company's departments.
Columns:
- Name: the primary column, single line of text, 100 characters, required.
- Is active: yes/no, default Yes.
```

> **Check it worked:** the table has **Name** (primary) and **Is active**.
>
> **Then:** add a key on **Name** (Procedure D).

#### Table 2: KPI status option

```text
Create a table called "KPI status option" (plural "KPI status options"). It holds the company-wide list of
suggested values for a KPI's free-text Status, such as "On track" or "Delayed".
Columns:
- Name: the primary column, single line of text, 200 characters, required.
```

> **Then:** add a key on **Name**.

#### Table 3: KPI dictionary entry

```text
Create a table called "KPI dictionary entry" (plural "KPI dictionary entries"). It stores reusable KPI
definitions that can be copied onto a new KPI.
Columns:
- Name: the primary column, single line of text, 200 characters, required.
- Metric type: choice, using the existing global choice "Metric type". Optional.
- Direction: choice, using the existing global choice "Direction". Optional.
- Target mode: choice, using the existing global choice "Target mode". Optional.
- Unit: single line of text, 50 characters. Optional.
- Target config: multiple lines of text, 4000 characters. Optional. Holds JSON.
```

> **Then:** add a key on **Name**.

#### Table 4: App user

```text
Create a table called "App user" (plural "App users"). It has one row for every person allowed to use the
KPI scorecard, with their role and department.
Columns:
- Username: the primary column, single line of text, 100 characters, required.
- Email: single line of text (format Email), 200 characters, required. This is their Microsoft work sign-in address.
- Company ID number: single line of text, 50 characters, required.
- Department: lookup to the "Department" table, required.
- Role: choice, using the existing global choice "User role", default Member.
- Status: choice, using the existing global choice "User status", default Pending.
```

> **Check it worked:** 6 columns, with **Department** as a lookup and **Role** and **Status** using the global choices.
>
> **Then:** add three keys: one on **Username**, one on **Email** and one on **Company ID number**.

#### Table 5: Fiscal year

```text
Create a table called "Fiscal year" (plural "Fiscal years").
Columns:
- Label: the primary column, single line of text, 20 characters, required. Example "FY2026/27".
- Start year: whole number, required. Example 2026 for the year 1 April 2026 to 31 March 2027.
- Is active: yes/no, default No. Only one fiscal year is active at a time.
- Closed on: date and time, optional.
- Closed by: lookup to the "App user" table, optional.
- Held on: date and time, optional. Set when the year is moved to Holding before deletion.
- Held by: lookup to the "App user" table, optional.
- Purge on: date and time, optional. The date the held year is permanently deleted.
```

> **Then:** add a key on **Start year**.
>
> **Also add a view:** open the table, then **Views → + New view**. Name it `Visible fiscal years`. Add the filter **Held on** *does not contain data*, sort by **Start year** descending, and click **Save and publish**.

#### Table 6: KPI

This is the most important table.

```text
Create a table called "KPI" (plural "KPIs"). Each row is one KPI in one fiscal year's hierarchy.
The hierarchy is: Strategic Goal > KPI > sub-KPI > sub-sub-KPI > sub-sub-sub-KPI (at most 5 levels).
Columns:
- Name: the primary column, single line of text, 300 characters, required.
- Code: single line of text, 50 characters, required. Example "1.2.3".
- Fiscal year: lookup to the "Fiscal year" table, required.
- Parent: lookup to this same "KPI" table, optional. Empty means it is a Strategic Goal.
- Sub-group: single line of text, 100 characters, optional. A label that groups siblings together.
- Sort order: whole number, default 0.
- Weight: decimal with 4 decimal places, default 0. Its share of its siblings, out of 100.
- Global weight: decimal with 4 decimal places. Its share of the whole company. Filled in by a flow.
- Level: whole number. 1 for a Strategic Goal, up to 5. Filled in by a flow.
- Path: single line of text, 500 characters. Filled in by a flow.
- Sort key: single line of text, 400 characters. Filled in by a flow. Used to list the hierarchy in order.
- Is leaf: yes/no, default Yes. Filled in by a flow. Yes means it has no children.
- Status: single line of text, 200 characters, optional.
- Frequency: choice, using the existing global choice "Frequency", default Monthly.
- Phasing: choice, using the existing global choice "Phasing", default None.
- Phase shares: single line of text, 200 characters, optional. A JSON list of 12 numbers, April first, totalling 100.
- Metric type: choice, using the existing global choice "Metric type", optional.
- Direction: choice, using the existing global choice "Direction", optional.
- Target mode: choice, using the existing global choice "Target mode", optional.
- Unit: single line of text, 50 characters, optional.
- Target config: multiple lines of text, 4000 characters, optional. Holds JSON.
- Deadline month: single line of text, 7 characters, optional. Format YYYY-MM.
- Score final after deadline: yes/no, default No.
- Completed: yes/no, default No.
- Completed period: single line of text, 7 characters, optional. Format YYYY-MM.
- Settings changed on: date and time, optional. Set by the flows whenever this KPI's settings change.
```

> **Check it worked:** 26 columns. Check these in particular:
>
> - **Parent** looks up the KPI table itself.
> - **Weight** and **Global weight** have 4 decimal places.
> - All five choice columns use the global choices.
>
> **Then:**
>
> 1. Add a key on **Fiscal year** + **Code** together (Procedure D).
> 2. Set **Fiscal year** to **Parental** (Procedure E), so deleting a year deletes its KPIs.
> 3. Set **Parent** to **Referential, restrict delete**. The "Delete KPI" flow in Part 6 deletes child KPIs itself, in the right order.

**What goes in Target config.** The flows read and write this for you, but you
need to recognise it when you test:

| Kind of KPI | Example Target config |
| --- | --- |
| Fixed targets (one number per band) | `{"POOR":60,"IMPROVEMENT_NEEDED":70,"MEET":80,"GOOD":90,"VERY_GOOD":95,"EXCELLENT":100}` |
| Range targets (a window per band) | `{"POOR":[0,59],"IMPROVEMENT_NEEDED":[60,69],"MEET":[70,79],"GOOD":[80,89],"VERY_GOOD":[90,94],"EXCELLENT":[95,100]}` |
| Month of completion | `{"targetMonth":"2026-10"}` |

#### Table 7: link KPIs to their owning departments

A KPI can be owned by several departments, and a department can own many KPIs.
This is a relationship rather than a table you fill in.

> **Do this:**
>
> 1. Open the **KPI** table, then **Relationships**, then **+ New relationship → Many-to-many**.
> 2. **Related table:** Department. Click **Done**, then **Save**.
>
> **Check it worked:** the KPI table's relationships list shows a many-to-many relationship with Department.

#### Table 8: KPI value

```text
Create a table called "KPI value" (plural "KPI values"). Each row is one KPI's reported figure for one month.
Columns:
- Name: the primary column, single line of text, 100 characters. Example "1.2.3 2026-10".
- KPI: lookup to the "KPI" table, required.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Period: single line of text, 7 characters, required. Format YYYY-MM.
- Value: decimal with 6 decimal places, optional. The cumulative year-to-date figure.
- Basis: choice, using the existing global choice "Value basis", default Actual.
- Planned value: decimal with 6 decimal places, optional. Only used by Variance KPIs.
- Completion date: date only, optional. Only used by Month completion KPIs.
- Note: multiple lines of text, optional.
```

> **Then:**
>
> 1. Add a key on **KPI** + **Period**.
> 2. Set **KPI** and **Fiscal year** to **Parental**.

#### Table 9: KPI score (the score store)

The flows save every calculated score here, so the app and the agent can show
scores instantly instead of recalculating while someone waits. Its band and
basis columns are plain text rather than choices, which keeps the flows that
write them simpler.

```text
Create a table called "KPI score" (plural "KPI scores"). It stores calculated scores, written only by flows.
Columns:
- Name: the primary column, single line of text, 200 characters.
- KPI: lookup to the "KPI" table, required.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Period: single line of text, 7 characters, required.
- Scenario: single line of text, 100 characters, required. "standard" for normal scores.
- Code: single line of text, 50 characters. Copied from the KPI.
- KPI name: single line of text, 300 characters. Copied from the KPI.
- Level: whole number. Copied from the KPI.
- Global weight: decimal with 4 decimal places. Copied from the KPI.
- Local weight: decimal with 4 decimal places. Copied from the KPI's Weight.
- Path: single line of text, 500 characters. Copied from the KPI.
- Sort key: single line of text, 400 characters. Copied from the KPI.
- Parent id: single line of text, 100 characters. The id of the KPI's parent, empty for a Strategic Goal.
- Is leaf: yes/no.
- Has score: yes/no.
- Score: decimal with 1 decimal place, optional.
- Exact score: decimal with 6 decimal places, optional.
- Band: single line of text, 30 characters, optional. One of the band names, e.g. "Very good".
- Pending reason: single line of text, 30 characters, optional. "No data" or "Not yet due".
- Basis: single line of text, 20 characters, optional. "Actual" or "Estimate".
- Provisional: yes/no.
- Prorated: yes/no.
- Overridden: yes/no.
- Assumed: yes/no.
- Value used: decimal with 6 decimal places, optional.
- Planned value used: decimal with 6 decimal places, optional.
- Completion date used: date only, optional.
- Raw score: decimal with 1 decimal place, optional. The score before any deadline rule.
- Deadline cap: decimal with 1 decimal place, optional.
- Months late: whole number, optional.
- Frozen at deadline: yes/no.
- Total weight: decimal with 6 decimal places.
- Scored weight: decimal with 6 decimal places.
- Score times weight: decimal with 6 decimal places.
- Provisional weight: decimal with 6 decimal places.
- Not yet due weight: decimal with 6 decimal places.
- Prorated weight: decimal with 6 decimal places.
- Assumed weight: decimal with 6 decimal places.
- Coverage: decimal with 6 decimal places.
- Provisional share: decimal with 6 decimal places.
- Not yet due share: decimal with 6 decimal places.
- Prorated share: decimal with 6 decimal places.
- Leaf count: whole number.
- Scored leaf count: whole number.
```

> **Then:**
>
> 1. Add a key on **KPI** + **Period** + **Scenario**.
> 2. Set **KPI** and **Fiscal year** to **Parental**.
> 3. Check the six weight columns (Total weight to Assumed weight) and Score times weight each have **6** decimal places. The roll-up in Part 5 depends on it.
> 4. Write down the **logical names** of this table and its columns. Open the table and look at the **Logical name** column, for example `sc_kpiscore`, `sc_scoretimesweight`, `sc_path`. Steps 5.8 and 5.11 need them.

#### Table 10: Total score

```text
Create a table called "Total score" (plural "Total scores"). It stores the whole company's score for one
month, written only by flows.
Columns:
- Name: the primary column, single line of text, 200 characters.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Period: single line of text, 7 characters, required.
- Scenario: single line of text, 100 characters, required.
- Has score: yes/no.
- Score: decimal with 1 decimal place, optional.
- Exact score: decimal with 6 decimal places, optional.
- Band: single line of text, 30 characters, optional.
- Coverage, Provisional share, Not yet due share, Prorated share: decimals with 6 decimal places.
- Total weight, Scored weight: decimals with 6 decimal places.
- Leaf count, Scored leaf count: whole numbers.
```

> **Then:** add a key on **Fiscal year** + **Period** + **Scenario**, and set **Fiscal year** to **Parental**.

#### Table 11: Score override

```text
Create a table called "Score override" (plural "Score overrides"). An admin uses it to replace one KPI's
calculated score for one month (calibration).
Columns:
- Name: the primary column, single line of text, 100 characters.
- KPI: lookup to the "KPI" table, required.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Period: single line of text, 7 characters, required.
- Score: decimal with 1 decimal place, required, minimum 0, maximum 5.
- Reason: multiple lines of text, required.
- By: lookup to the "App user" table, required.
```

> **Then:** add a key on **KPI** + **Period**, and set **KPI** and **Fiscal year** to **Parental**.

#### Table 12: Change proposal

```text
Create a table called "Change proposal" (plural "Change proposals"). It holds KPI settings changes proposed
by members, waiting for an admin to approve or reject them.
Columns:
- Name: the primary column, autonumber.
- KPI: lookup to the "KPI" table, required.
- Proposed by: lookup to the "App user" table, required.
- Payload: multiple lines of text, maximum length. JSON of the new settings.
- Summary: multiple lines of text, maximum length. A readable list of changes, old to new.
- Base modified on: date and time. When the KPI was last changed, at the moment of proposing.
- Status: choice, using the existing global choice "Proposal status", default Pending.
- Reviewed by: lookup to the "App user" table, optional.
- Review note: multiple lines of text, optional.
- Reviewed on: date and time, optional.
```

> **Then:** set **KPI** to **Parental**.

#### Table 13: Progress update

```text
Create a table called "Progress update" (plural "Progress updates"). It holds written progress updates on KPIs.
Columns:
- Name: the primary column, autonumber.
- KPI: lookup to the "KPI" table, required.
- Period: single line of text, 7 characters, required.
- Mode: choice, using the existing global choice "Update mode", default Detailed.
- Body: multiple lines of text, optional. Used in Simple mode.
- Current progress: multiple lines of text, optional.
- Next progress: multiple lines of text, optional.
- Time and cost: multiple lines of text, optional.
- Issues: multiple lines of text, optional.
- Author: single line of text, 100 characters.
```

> **Then:** set **KPI** to **Parental**.

#### Table 14: KPI definition change

```text
Create a table called "KPI definition change" (plural "KPI definition changes"). It is the history of changes
to KPI settings.
Columns:
- Name: the primary column, autonumber.
- KPI: lookup to the "KPI" table, required.
- Field: single line of text, 50 characters. Examples: targets, metricType, weight, code, parentId, departments, deleted.
- Label: single line of text, 200 characters. The readable name of the field.
- From: multiple lines of text, 4000 characters.
- To: multiple lines of text, 4000 characters.
- Author: single line of text, 100 characters.
```

> **Then:** set **KPI** to **Parental**.

#### Table 15: KPI value change

```text
Create a table called "KPI value change" (plural "KPI value changes"). It is the history of changes to monthly
figures, one row per changed field.
Columns:
- Name: the primary column, autonumber.
- KPI: lookup to the "KPI" table, required.
- Period: single line of text, 7 characters.
- Field: single line of text, 30 characters. One of: value, basis, plannedValue, completionDate, note.
- From: multiple lines of text, 4000 characters, optional.
- To: multiple lines of text, 4000 characters, optional.
- Author username: single line of text, 100 characters.
- Author company ID: single line of text, 50 characters.
```

> **Then:** set **KPI** to **Parental**.

#### Table 16: Fiscal year snapshot

```text
Create a table called "Fiscal year snapshot" (plural "Fiscal year snapshots"). It holds the frozen scores of a
closed fiscal year.
Columns:
- Name: the primary column, single line of text, 100 characters.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Data: multiple lines of text, maximum length. JSON of every KPI's score for all 12 months.
```

> **Then:** add a key on **Fiscal year**, and set **Fiscal year** to **Parental**.

#### Table 17: Fiscal year checkpoint

```text
Create a table called "Fiscal year checkpoint" (plural "Fiscal year checkpoints"). It holds complete backups of
one fiscal year.
Columns:
- Name: the primary column, single line of text, 200 characters, required.
- Fiscal year: lookup to the "Fiscal year" table, required.
- Automatic: yes/no, default No. Automatic checkpoints are taken before imports and restores and cannot be deleted.
- Data: file, maximum size 32768 KB. The backup as a JSON file.
- KPI count: whole number.
- Value count: whole number.
- Created by: lookup to the "App user" table, optional.
```

> **Then:** set **Fiscal year** to **Parental**.

#### Table 18: Fiscal year event

```text
Create a table called "Fiscal year event" (plural "Fiscal year events"). It is the history of fiscal year
actions: closed, reopened, restored, moved to holding, restored from holding, permanently deleted.
Columns:
- Name: the primary column, autonumber.
- Fiscal year: lookup to the "Fiscal year" table, optional.
- Fiscal year label: single line of text, 20 characters, required. Copied at the time of the event.
- Action: choice, using the existing global choice "Fiscal year action", required.
- Reason: multiple lines of text, optional.
- Author: single line of text, 100 characters, required.
```

> **Then:** set **Fiscal year** to **Referential, remove link**. The event rows must survive when a year is permanently deleted.

#### Table 19: Recalculation request

Each row asks the scoring engine to recalculate. The flows that save changes
add a row here, and the "Recalculate" flow from Part 5 picks it up, so nobody
has to wait for scores to be worked out.

```text
Create a table called "Recalculation request" (plural "Recalculation requests"). Each row asks the scoring
flows to recalculate the scores of one fiscal year.
Columns:
- Name: the primary column, single line of text, 200 characters.
- Fiscal year: lookup to the "Fiscal year" table, required.
- From period: single line of text, 7 characters, optional. Blank means the whole year.
- KPI id: single line of text, 100 characters, optional. Blank means every KPI.
- Refresh hierarchy: yes/no, default No.
- Status: single line of text, 20 characters, default "Waiting". One of Waiting, Running, Done, Failed.
```

> **Then:** set **Fiscal year** to **Parental**.

> **Check the whole of Part 3 worked:** the solution lists 13 choices, 18
> tables and the KPI–Department relationship. Every key shows **Active**.

### 3.9 Enter the sample data

You'll test the flows against known examples, so enter the sample data from
**Appendix C** now.

> **Do this:**
>
> 1. Open a table, then click **Edit** at the top.
> 2. Click **+ New row** and fill in the columns.
> 3. Enter the tables in the order Appendix C lists them.
>
> **Check it worked:** the KPI table shows the sample KPIs. Leave **Level**, **Path**, **Sort key**, **Global weight** and **Is leaf** empty: a flow in Part 5 fills them in.

---

## Part 4. Set up security

### 4.1 How security works in the new version

- **Everyone signs in with their Microsoft work account.** There are no separate usernames and passwords to manage. Lockouts and password resets are handled by Microsoft.
- **The App user table decides what each person may do.** A person must have an App user row with **Status = Approved**. Their **Role** (Member or Admin) and **Department** decide what they can change.
- **The app and the agent read the tables directly**, using each person's own sign-in.
- **The flows do all the writing, as the service account.** Neither the app nor the agent changes a table itself: they ask a flow to. Each flow first runs the permission check from step 6.2 and refuses anything the person isn't allowed to do.
- **Staff get read-only access to the tables**, so nothing can be changed except through the flows. Even someone who opens the tables some other way can't change them.

### 4.2 Create the "Scorecard Reader" role

> **Do this:**
>
> 1. Open [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com), then **Manage → Environments → KPI Scorecard → Settings**.
> 2. Click **Users + permissions → Security roles → + New role**.
> 3. **Role name:** `Scorecard Reader`. Click **Save**.
> 4. In the role's list of tables, search for each scorecard table from Part 3 (Department, KPI, KPI value and so on).
> 5. For every scorecard table **except Fiscal year checkpoint**, set **Read** to **Organization** and leave everything else at **None**.
>    Checkpoints hold complete backups, so only admins see them, through a flow in Part 6.
> 6. Click **Save**.

### 4.3 Create the "Scorecard Admin" role

> **Do this:** repeat 4.2 with the role name `Scorecard Admin`. For every scorecard table, set **Create, Read, Write, Delete, Append and Append To** all to **Organization**.
>
> Nobody needs this role for normal use: the app and the agent save everything through the flows. Give it only to the people who build and
> maintain the scorecard, so they can fix a row by hand in an emergency.

### 4.4 Give the roles to people

> **Do this:**
>
> 1. In the environment's **Settings**, click **Users + permissions → Teams → + Create team**.
> 2. **Team name:** `Scorecard Users`. **Team type:** *Microsoft Entra ID Security Group*. Pick the **KPI Scorecard Users** group IT created. **Membership type:** *Members and guests*. Click **Save**.
> 3. Select the new team, then **Manage security roles**. Tick **Scorecard Reader** and **Basic User**, then click **Save**.
>
> **Check it worked:** ask a colleague in the group to open [make.powerapps.com](https://make.powerapps.com), switch to the KPI Scorecard environment and open **Tables → KPI → Edit**. They should see rows but be unable to change them.

### 4.5 Make the service account own the flows

When you build a flow, its **connections** (its sign-ins to Dataverse,
SharePoint and so on) are yours by default. If you leave the company, the
flows stop working. So:

> **Do this:**
>
> 1. Make sure IT has given the service account **System Administrator** in the KPI Scorecard environment (it was in the email in 1.2).
> 2. Whenever a flow asks you to **sign in to create a connection**, sign in as the **service account** (choose **Sign in with another account**).
> 3. If you've already built flows with your own connections: open **Solutions → KPI Scorecard → Connection references**, open each one and switch it to a connection owned by the service account.

## Part 5. Build the scoring engine

This is the most technical part of the guide. Take it slowly. Every formula
is ready to paste, and every flow has a test that proves it works before you
build the next one.

### 5.1 How scoring works in the new version

The web app works out every score each time someone opens a page. The new
version works them out **once** and saves them in the **KPI score** and
**Total score** tables, so the app and the agent only have to read them.
Whenever a figure or a setting changes, the scores are recalculated in the
background, usually within a few minutes.

Seven flows do the work. Each one is small and does one job:

| Flow | What it does | What starts it |
| --- | --- | --- |
| **S1 Score a fixed target** | Turns one figure and six fixed targets into a score | S5 |
| **S2 Score a range target** | Turns one figure and six target windows into a score | S5 |
| **S3 Score a milestone** | Turns a completion date and a target month into a score | S5 |
| **S4 Refresh hierarchy** | Works out each KPI's level, global weight and place in the list | S7 |
| **S5 Score one KPI** | Picks the right figure for the month, applies phasing, deadlines and the dashboard options, and calls S1, S2 or S3 | S6, and the Simulate flow in Part 6 |
| **S6 Score a month** | Scores every leaf KPI for one month, adds the scores up through their parents to the company total, and saves them all | S7, and the "Get scores with options" flow in Part 6 |
| **S7 Recalculate** | Watches the Recalculation request table and runs S4 and S6 for the months that need it | A new row in Recalculation request |

S1 to S6 are **child flows**: flows that other flows call, like a calculator
you press buttons on. S7 starts by itself whenever a row appears in the
**Recalculation request** table.

**Scenarios.** The dashboard has two options that change how scores are
worked out: what to do about KPIs with no figure, and what to do about
estimates. Normal scores are saved with the Scenario `standard`. When someone
picks other options, S6 saves a second set of scores under a scenario name
such as `count|assume`, so the two sets sit side by side.

**How the formulas were checked.** Every formula in this part was run in a
simulator of Power Automate's formula language and compared with the web
app's own scoring code:

- 1,204 fixed-target cases, 2,084 range cases and 3,040 milestone dates;
- 6,000 random KPIs, covering every combination of settings;
- 800 random hierarchies and 24,305 roll-ups.

All of them matched, apart from 3 roll-ups out of 24,305. Those 3 differ by
0.1 because their exact score fell on a rounding tie such as 3.45. If a test
in this part fails for you, the cause is almost certainly a typing slip or a
step done in the wrong order, not the formula.

### 5.2 Procedure F: create a child flow

You'll use this for S1 to S6.

> **Do this:**
>
> 1. Open [make.powerautomate.com](https://make.powerautomate.com) and check the environment picker shows **KPI Scorecard**.
> 2. Go to **Solutions → KPI Scorecard → + New → Automation → Cloud flow → Instant**.
> 3. **Flow name:** the name the guide gives, for example `S1 Score a fixed target`.
> 4. **Choose how to trigger this flow:** pick **Manually trigger a flow**, then click **Create**.
> 5. The flow opens in the designer with one box, **Manually trigger a flow**. Click it, then click **+ Add an input** once for each input the guide lists. Pick the type (**Text**, **Yes/No** or **Number**) and replace the suggested name with the input's name, exactly as shown.
> 6. Click **Save** (top right) often. A flow can't be saved until every box is filled in, so save after each finished step.
>
> **About the designer:** these steps use the **new designer**. If yours shows white boxes joined by arrows, with a **+ New step** button at the bottom, you're in the classic designer. Either works. In the classic designer, **+ Add an action** is called **+ New step**, and formulas go in an **Expression** tab instead of behind the **fx** button.

**Every child flow ends the same way:**

> **Do this:**
>
> 1. Click **+** below the last box, then **Add an action**. Search for **Respond to a Power App or flow** and pick it.
> 2. Click **+ Add an output** for each output the guide lists, pick its type and type its name.
> 3. Fill in each output's value as the guide says.

**Child flows that read or write tables (S4 and S6) need one extra
setting.** Without it, other flows can't call them:

> **Do this:**
>
> 1. Save the flow and click **← Back** to open its details page.
> 2. Find the **Run only users** box and click **Edit**.
> 3. Under **Connections used**, change every connection from *Provided by run-only user* to the service account's connection.
> 4. Click **Save**.

### 5.3 Procedure G: give an action its name

Formulas refer to earlier steps by name, so names matter.

> **Do this:** after adding an action, click its title (for example **Compose**), or click **...** on the action and choose **Rename**. Type the name the guide gives **exactly**, including capitals. Names in this guide never contain spaces.
>
> **Why:** a formula such as `outputs('PoorScore')` means "the result of the step called PoorScore". If the step is called `Poor score` or `PoorScore 2`, the flow stops with an error like *"The action 'PoorScore' doesn't exist"*.

### 5.4 Procedure H: paste a formula

> **Do this:**
>
> 1. Click inside the box where the formula goes (for example a Compose action's **Inputs** box).
> 2. Click the **fx** button that appears next to it. In the classic designer, click **Expression**.
> 3. Paste the formula into the formula box at the top. **Don't** add an `@` sign or quotes around it.
> 4. Click **Add** (or **OK**). The box now shows a coloured token holding the start of the formula.
>
> **Check it worked:** hover over the token to see the whole formula. If the box shows the formula as plain text with no coloured token, you pasted it as text. Delete it and repeat from step 2.
>
> **If something goes wrong:** *"The expression is invalid"* when you click Add means part of the formula didn't copy. Copy the whole grey box again, using the copy button in its corner rather than selecting by hand.

**Four kinds of action** come up again and again:

| Action | How to add it | What it's for |
| --- | --- | --- |
| **Initialize variable** | Search for *Initialize variable* | Creates a named value. Give it a **Name**, a **Type** (Boolean = yes/no, Integer = whole number, Float = decimal, String = text, Object, Array) and a starting **Value** |
| **Set variable** | Search for *Set variable* | Changes a variable's value. Pick the variable's **Name** and paste the new **Value** |
| **Compose** | Search for *Compose* (under Data Operation) | Works out one formula. Rename it, then paste the formula into **Inputs** |
| **Filter array** | Search for *Filter array* | Keeps only the items of a list that match a rule. Fill **From**, click **Edit in advanced mode**, and paste the rule. The rule **does** start with `@` |

**Reading the formulas.** You don't need to understand the formulas to paste
them, but this key helps when something goes wrong:

| You'll see | It means |
| --- | --- |
| `variables('Actual')` | the value of the variable called Actual |
| `outputs('PoorScore')` | the result of the Compose step called PoorScore |
| `body('Score_fixed')?['rawscore']` | the RawScore output of the step called Score_fixed |
| `item()?['period']` | inside a Filter array: the period of the item being checked |
| `items('Each_leaf')?['sc_code']` | inside the loop called Each_leaf: the code of the current row |
| `if(test, a, b)` | a if the test is true, otherwise b |
| `float(x)` | x as a decimal number |
| `mul`, `div`, `add`, `sub` | multiply, divide, add, subtract |
| `-1` | this guide's code for "no value" in number fields |

---

### 5.5 S1 Score a fixed target

**What it does:** given a figure and the six fixed targets, it returns the
unrounded score. Reaching a band's target scores the top of that band. Below
the Poor target, the score shrinks in proportion. Beyond Excellent it stays
at 5.0.

> **Do this:**
>
> 1. Create a child flow called `S1 Score a fixed target` (Procedure F) with these inputs:
>
>    | Input | Type |
>    | --- | --- |
>    | Actual | Number |
>    | HigherIsBetter | Yes/No |
>    | Poor | Number |
>    | ImprovementNeeded | Number |
>    | Meet | Number |
>    | Good | Number |
>    | VeryGood | Number |
>    | Excellent | Number |
>
> 2. Add 8 **Initialize variable** actions, one per input, each named after its input. Use type **Float** for the numbers and **Boolean** for HigherIsBetter. For each **Value**, click the box and pick the matching input from **Dynamic content**.
> 3. Add one more **Initialize variable**: name `Sign`, type **Float**, and this value (Procedure H):
>
>    ```text
>    if(variables('HigherIsBetter'),1.0,-1.0)
>    ```
>
> 4. Add a **Compose** named `PoorScore` (Procedure G) with the formula below. It works out the score for a figure that misses even the Poor target.
>
>    ```text
>    if(variables('HigherIsBetter'),if(lessOrEquals(float(variables('Poor')),0.0),if(greaterOrEquals(float(variables('Actual')),float(variables('Poor'))),2.4,0.0),mul(2.4,min(max(div(float(variables('Actual')),max(float(variables('Poor')),0.000001)),0.0),1.0))),if(lessOrEquals(float(variables('Actual')),0.0),2.4,if(less(float(variables('Poor')),0.0),0.0,mul(2.4,min(max(div(float(variables('Poor')),max(float(variables('Actual')),0.000001)),0.0),1.0)))))
>    ```
>
> 5. Add a **Compose** named `RawScore`:
>
>    ```text
>    if(greaterOrEquals(mul(float(variables('Actual')),variables('Sign')),mul(float(variables('Excellent')),variables('Sign'))),5.0,if(greaterOrEquals(mul(float(variables('Actual')),variables('Sign')),mul(float(variables('VeryGood')),variables('Sign'))),4.5,if(greaterOrEquals(mul(float(variables('Actual')),variables('Sign')),mul(float(variables('Good')),variables('Sign'))),3.9,if(greaterOrEquals(mul(float(variables('Actual')),variables('Sign')),mul(float(variables('Meet')),variables('Sign'))),3.4,if(greaterOrEquals(mul(float(variables('Actual')),variables('Sign')),mul(float(variables('ImprovementNeeded')),variables('Sign'))),2.9,outputs('PoorScore'))))))
>    ```
>
> 6. Add **Respond to a Power App or flow** with one **Number** output named `RawScore`. Set its value to `outputs('RawScore')` (Procedure H).
> 7. Save.
>
> **Tip:** the six band variables differ only by name. In the new designer, click **...** on a finished Initialize variable and choose **Copy action**. Then click **+ → Paste an action** and change the copy's name and value.

**Test it.** You'll test every child flow the same way:

> **Procedure I: test a child flow**
>
> 1. Click **Test** (top right), choose **Manually**, then **Test**, then **Run flow**.
> 2. Fill in the inputs from the first row of the test table, click **Run flow**, then **Done**.
> 3. When it shows *Your flow ran successfully*, click the **Respond to a Power App or flow** box and look at **Outputs**. `rawscore` should match the table.
> 4. Click **Test → Manually** again for the next row. Once you have one run, you can choose **Automatically → With a recently used trigger** and just edit the inputs.

Every row uses one of two sets of targets:

- **Higher is better:** Poor 60, Improvement needed 70, Meet 80, Good 90, Very good 95, Excellent 100.
- **Lower is better:** Poor 10, Improvement needed 8, Meet 6, Good 4, Very good 3, Excellent 2.

| Actual | HigherIsBetter | Expected RawScore | Why |
| --- | --- | --- | --- |
| 80 | Yes | 3.4 | Hit Meet exactly: top of Meet |
| 92 | Yes | 3.9 | Passed Good, not Very good |
| 100 | Yes | 5 | Hit Excellent |
| 120 | Yes | 5 | Going beyond Excellent earns nothing more |
| 65 | Yes | 2.4 | Reached Poor only |
| 30 | Yes | 1.2 | Short of Poor: 2.4 × 30 ÷ 60 |
| 0 | Yes | 0 | |
| 5 | No | 3.4 | Lower is better: 5 days beats Meet (6) |
| 2 | No | 5 | |
| 9 | No | 2.4 | |
| 20 | No | 1.2 | Overran Poor: 2.4 × 10 ÷ 20 |

> **If something goes wrong:**
>
> - Every result is 0 or 5: HigherIsBetter is probably a Float instead of a Boolean variable. Delete it and recreate it.
> - *"InvalidTemplate. Unable to process template language expressions"*: open the failed step to see which name it couldn't find, then check that step's name (Procedure G).

### 5.6 S2 Score a range target

**What it does:** each band has a window of values, for example Meet 70–79.
As the figure moves through a band's window, the score slides through that
band's score range.

> **A known quirk, copied on purpose.** Suppose the windows leave a gap (Meet
> 70–79, Good 80–89) and the figure lands in it (79.5). The web app then
> scores it **5.0** when higher is better and **0** when lower is better.
> This flow does the same, so both versions agree. To avoid the problem,
> leave no gaps: write Meet as 70–80 and Good as 80–90.

> **Do this:**
>
> 1. Create a child flow called `S2 Score a range target` with 14 inputs:
>    - **Actual** (Number) and **HigherIsBetter** (Yes/No);
>    - 12 Numbers: **PoorMin**, **PoorMax**, **ImprovementNeededMin**, **ImprovementNeededMax**, **MeetMin**, **MeetMax**, **GoodMin**, **GoodMax**, **VeryGoodMin**, **VeryGoodMax**, **ExcellentMin**, **ExcellentMax**.
> 2. Add 14 **Initialize variable** actions, one per input, each named after its input and set to it. Use Float, and Boolean for HigherIsBetter.
> 3. Add 12 more **Initialize variable** actions, all **Float**, from this table. They put each window's two ends the right way round, in case someone typed 79–70:
>
>    | Name | Value |
>    | --- | --- |
>    | `PoorLo` | `min(float(variables('PoorMin')),float(variables('PoorMax')))` |
>    | `PoorHi` | `max(float(variables('PoorMin')),float(variables('PoorMax')))` |
>    | `ImprovementNeededLo` | `min(float(variables('ImprovementNeededMin')),float(variables('ImprovementNeededMax')))` |
>    | `ImprovementNeededHi` | `max(float(variables('ImprovementNeededMin')),float(variables('ImprovementNeededMax')))` |
>    | `MeetLo` | `min(float(variables('MeetMin')),float(variables('MeetMax')))` |
>    | `MeetHi` | `max(float(variables('MeetMin')),float(variables('MeetMax')))` |
>    | `GoodLo` | `min(float(variables('GoodMin')),float(variables('GoodMax')))` |
>    | `GoodHi` | `max(float(variables('GoodMin')),float(variables('GoodMax')))` |
>    | `VeryGoodLo` | `min(float(variables('VeryGoodMin')),float(variables('VeryGoodMax')))` |
>    | `VeryGoodHi` | `max(float(variables('VeryGoodMin')),float(variables('VeryGoodMax')))` |
>    | `ExcellentLo` | `min(float(variables('ExcellentMin')),float(variables('ExcellentMax')))` |
>    | `ExcellentHi` | `max(float(variables('ExcellentMin')),float(variables('ExcellentMax')))` |
>
> 4. Add these 6 **Compose** actions. Each works out the score if the figure is inside that band's window, or -1 if it isn't:
>
>    1. **Compose** named `PoorResult`:
>
>       ```text
>       if(or(and(variables('HigherIsBetter'),lessOrEquals(float(variables('Actual')),variables('PoorHi'))),and(not(variables('HigherIsBetter')),greaterOrEquals(float(variables('Actual')),variables('PoorLo'))),and(greaterOrEquals(float(variables('Actual')),variables('PoorLo')),lessOrEquals(float(variables('Actual')),variables('PoorHi')))),if(equals(variables('PoorLo'),variables('PoorHi')),2.4,if(variables('HigherIsBetter'),add(0.0,mul(min(max(div(sub(float(variables('Actual')),variables('PoorLo')),max(sub(variables('PoorHi'),variables('PoorLo')),0.000001)),0.0),1.0),2.4)),sub(2.4,mul(min(max(div(sub(float(variables('Actual')),variables('PoorLo')),max(sub(variables('PoorHi'),variables('PoorLo')),0.000001)),0.0),1.0),2.4)))),-1.0)
>       ```
>
>    2. **Compose** named `ImprovementNeededResult`:
>
>       ```text
>       if(and(greaterOrEquals(float(variables('Actual')),variables('ImprovementNeededLo')),lessOrEquals(float(variables('Actual')),variables('ImprovementNeededHi'))),if(equals(variables('ImprovementNeededLo'),variables('ImprovementNeededHi')),2.9,if(variables('HigherIsBetter'),add(2.5,mul(min(max(div(sub(float(variables('Actual')),variables('ImprovementNeededLo')),max(sub(variables('ImprovementNeededHi'),variables('ImprovementNeededLo')),0.000001)),0.0),1.0),0.4)),sub(2.9,mul(min(max(div(sub(float(variables('Actual')),variables('ImprovementNeededLo')),max(sub(variables('ImprovementNeededHi'),variables('ImprovementNeededLo')),0.000001)),0.0),1.0),0.4)))),-1.0)
>       ```
>
>    3. **Compose** named `MeetResult`:
>
>       ```text
>       if(and(greaterOrEquals(float(variables('Actual')),variables('MeetLo')),lessOrEquals(float(variables('Actual')),variables('MeetHi'))),if(equals(variables('MeetLo'),variables('MeetHi')),3.4,if(variables('HigherIsBetter'),add(3.0,mul(min(max(div(sub(float(variables('Actual')),variables('MeetLo')),max(sub(variables('MeetHi'),variables('MeetLo')),0.000001)),0.0),1.0),0.4)),sub(3.4,mul(min(max(div(sub(float(variables('Actual')),variables('MeetLo')),max(sub(variables('MeetHi'),variables('MeetLo')),0.000001)),0.0),1.0),0.4)))),-1.0)
>       ```
>
>    4. **Compose** named `GoodResult`:
>
>       ```text
>       if(and(greaterOrEquals(float(variables('Actual')),variables('GoodLo')),lessOrEquals(float(variables('Actual')),variables('GoodHi'))),if(equals(variables('GoodLo'),variables('GoodHi')),3.9,if(variables('HigherIsBetter'),add(3.5,mul(min(max(div(sub(float(variables('Actual')),variables('GoodLo')),max(sub(variables('GoodHi'),variables('GoodLo')),0.000001)),0.0),1.0),0.4)),sub(3.9,mul(min(max(div(sub(float(variables('Actual')),variables('GoodLo')),max(sub(variables('GoodHi'),variables('GoodLo')),0.000001)),0.0),1.0),0.4)))),-1.0)
>       ```
>
>    5. **Compose** named `VeryGoodResult`:
>
>       ```text
>       if(and(greaterOrEquals(float(variables('Actual')),variables('VeryGoodLo')),lessOrEquals(float(variables('Actual')),variables('VeryGoodHi'))),if(equals(variables('VeryGoodLo'),variables('VeryGoodHi')),4.5,if(variables('HigherIsBetter'),add(4.0,mul(min(max(div(sub(float(variables('Actual')),variables('VeryGoodLo')),max(sub(variables('VeryGoodHi'),variables('VeryGoodLo')),0.000001)),0.0),1.0),0.5)),sub(4.5,mul(min(max(div(sub(float(variables('Actual')),variables('VeryGoodLo')),max(sub(variables('VeryGoodHi'),variables('VeryGoodLo')),0.000001)),0.0),1.0),0.5)))),-1.0)
>       ```
>
>    6. **Compose** named `ExcellentResult`:
>
>       ```text
>       if(or(and(variables('HigherIsBetter'),greaterOrEquals(float(variables('Actual')),variables('ExcellentLo'))),and(not(variables('HigherIsBetter')),lessOrEquals(float(variables('Actual')),variables('ExcellentHi'))),and(greaterOrEquals(float(variables('Actual')),variables('ExcellentLo')),lessOrEquals(float(variables('Actual')),variables('ExcellentHi')))),if(equals(variables('ExcellentLo'),variables('ExcellentHi')),5.0,if(variables('HigherIsBetter'),add(4.6,mul(min(max(div(sub(float(variables('Actual')),variables('ExcellentLo')),max(sub(variables('ExcellentHi'),variables('ExcellentLo')),0.000001)),0.0),1.0),0.4)),sub(5.0,mul(min(max(div(sub(float(variables('Actual')),variables('ExcellentLo')),max(sub(variables('ExcellentHi'),variables('ExcellentLo')),0.000001)),0.0),1.0),0.4)))),-1.0)
>       ```
>
> 5. Add a **Compose** named `RawScore`, which picks the first band that matched:
>
>    ```text
>    if(variables('HigherIsBetter'),if(greaterOrEquals(outputs('PoorResult'),0.0),outputs('PoorResult'),if(greaterOrEquals(outputs('ImprovementNeededResult'),0.0),outputs('ImprovementNeededResult'),if(greaterOrEquals(outputs('MeetResult'),0.0),outputs('MeetResult'),if(greaterOrEquals(outputs('GoodResult'),0.0),outputs('GoodResult'),if(greaterOrEquals(outputs('VeryGoodResult'),0.0),outputs('VeryGoodResult'),if(greaterOrEquals(outputs('ExcellentResult'),0.0),outputs('ExcellentResult'),5.0)))))),if(greaterOrEquals(outputs('ExcellentResult'),0.0),outputs('ExcellentResult'),if(greaterOrEquals(outputs('VeryGoodResult'),0.0),outputs('VeryGoodResult'),if(greaterOrEquals(outputs('GoodResult'),0.0),outputs('GoodResult'),if(greaterOrEquals(outputs('MeetResult'),0.0),outputs('MeetResult'),if(greaterOrEquals(outputs('ImprovementNeededResult'),0.0),outputs('ImprovementNeededResult'),if(greaterOrEquals(outputs('PoorResult'),0.0),outputs('PoorResult'),0.0)))))))
>    ```
>
> 6. Add **Respond to a Power App or flow** with a **Number** output `RawScore` set to `outputs('RawScore')`. Save.

**Test it** (Procedure I). The flow returns the unrounded score; S5 rounds it
later, so the table shows both.

The rows use two sets of windows:

- **Higher is better:** Poor 0–59, Improvement needed 60–69, Meet 70–79, Good 80–89, Very good 90–94, Excellent 95–100.
- **Lower is better:** Excellent 0–5, Very good 6–10, Good 11–15, Meet 16–20, Improvement needed 21–25, Poor 26–40.

| Actual | HigherIsBetter | Expected RawScore | Rounded | Why |
| --- | --- | --- | --- | --- |
| 92 | Yes | 4.25 | 4.3 | Halfway through Very good (4.0 to 4.5) |
| 75 | Yes | 3.2222… | 3.2 | 5/9 of the way through Meet |
| 70 | Yes | 3 | 3.0 | Bottom of Meet |
| 30 | Yes | 1.2203… | 1.2 | Inside Poor |
| 130 | Yes | 5 | 5.0 | Above every window, so Excellent |
| 79.5 | Yes | 5 | 5.0 | The gap quirk |
| 3 | No | 4.76 | 4.8 | Inside Excellent |
| 18 | No | 3.2 | 3.2 | Halfway through Meet |
| 50 | No | 0 | 0.0 | Far past Poor |
| 15.5 | No | 0 | 0.0 | The gap quirk |

### 5.7 S3 Score a milestone

**What it does:** scores a completion date against the target month, which
counts as Meet.

- Each month early climbs one band; one month late drops one band.
- Within a month, the score slides with the day.
- Two or more months late, the score falls steadily from 2.4 down to 0 at the end of the fiscal year.

> **Do this:**
>
> 1. Create a child flow called `S3 Score a milestone` with two **Text** inputs: **CompletionDate** (written like `2026-10-15`) and **TargetMonth** (written like `2026-10`).
> 2. Add two **Initialize variable** actions (type **String**) named `CompletionDate` and `TargetMonth`, set to the inputs.
> 3. Add these **Compose** actions **in this order**, each named as shown:
>
>    1. **Compose** named `Delta`:
>
>       ```text
>       sub(add(mul(int(substring(variables('CompletionDate'),0,4)),12),int(substring(variables('CompletionDate'),5,2))),add(mul(int(substring(variables('TargetMonth'),0,4)),12),int(substring(variables('TargetMonth'),5,2))))
>       ```
>
>    2. **Compose** named `LateStart`:
>
>       ```text
>       formatDateTime(addToTime(concat(variables('TargetMonth'),'-01T00:00:00Z'),2,'Month'),'yyyy-MM-dd')
>       ```
>
>    3. **Compose** named `FyEnd`:
>
>       ```text
>       concat(string(if(greaterOrEquals(int(substring(variables('TargetMonth'),5,2)),4),add(int(substring(variables('TargetMonth'),0,4)),1),int(substring(variables('TargetMonth'),0,4)))),'-03-31')
>       ```
>
>    4. **Compose** named `TotalDays`:
>
>       ```text
>       div(float(sub(ticks(concat(outputs('FyEnd'),'T00:00:00Z')),ticks(concat(outputs('LateStart'),'T00:00:00Z')))),864000000000.0)
>       ```
>
>    5. **Compose** named `ElapsedDays`:
>
>       ```text
>       div(float(sub(ticks(concat(variables('CompletionDate'),'T00:00:00Z')),ticks(concat(outputs('LateStart'),'T00:00:00Z')))),864000000000.0)
>       ```
>
>    6. **Compose** named `LateScore`:
>
>       ```text
>       if(lessOrEquals(outputs('TotalDays'),0.0),0.0,mul(2.4,sub(1.0,min(max(div(outputs('ElapsedDays'),max(outputs('TotalDays'),0.000001)),0.0),1.0))))
>       ```
>
>    7. **Compose** named `DaysInMonth`:
>
>       ```text
>       int(formatDateTime(addDays(addToTime(concat(substring(variables('CompletionDate'),0,7),'-01T00:00:00Z'),1,'Month'),-1),'dd'))
>       ```
>
>    8. **Compose** named `Position`:
>
>       ```text
>       min(max(div(float(sub(dayOfMonth(concat(variables('CompletionDate'),'T00:00:00Z')),1)),max(float(sub(outputs('DaysInMonth'),1)),1.0)),0.0),1.0)
>       ```
>
>    9. **Compose** named `BandTop`:
>
>       ```text
>       if(equals(outputs('Delta'),-3),5.0,if(equals(outputs('Delta'),-2),4.5,if(equals(outputs('Delta'),-1),3.9,if(equals(outputs('Delta'),0),3.4,2.9))))
>       ```
>
>    10. **Compose** named `BandBottom`:
>
>       ```text
>       if(equals(outputs('Delta'),-3),4.6,if(equals(outputs('Delta'),-2),4.0,if(equals(outputs('Delta'),-1),3.5,if(equals(outputs('Delta'),0),3.0,2.5))))
>       ```
>
>    11. **Compose** named `RawScore`:
>
>       ```text
>       if(less(outputs('Delta'),-3),5.0,if(greaterOrEquals(outputs('Delta'),2),outputs('LateScore'),sub(outputs('BandTop'),mul(outputs('Position'),sub(outputs('BandTop'),outputs('BandBottom'))))))
>       ```
>
> 4. Add **Respond to a Power App or flow** with a **Number** output `RawScore` set to `outputs('RawScore')`. Save.

**Test it.** Use TargetMonth `2026-10` for every row:

| CompletionDate | Expected RawScore | Rounded | Why |
| --- | --- | --- | --- |
| 2026-10-01 | 3.4 | 3.4 | First day of the target month: top of Meet |
| 2026-10-31 | 3 | 3.0 | Last day: bottom of Meet |
| 2026-09-15 | 3.7068… | 3.7 | One month early (Good), halfway through September |
| 2026-11-01 | 2.9 | 2.9 | One month late: top of Improvement needed |
| 2026-11-30 | 2.5 | 2.5 | |
| 2026-12-01 | 2.4 | 2.4 | Two months late: Poor starts at 2.4… |
| 2027-02-14 | 0.8999… | 0.9 | …and falls to 0 on 31 March |
| 2027-03-31 | 0 | 0.0 | |
| 2026-07-01 | 5 | 5.0 | Three months early: top of Excellent |
| 2026-05-15 | 5 | 5.0 | More than three months early |

### 5.8 Check your tables' internal names

The remaining flows read and write tables, using each table's **logical
names**, the internal names from Part 3. This guide assumes Copilot named
everything the obvious way: the display name in lower case, without spaces,
after `sc_`. For example:

- the column **Score final after deadline** is `sc_scorefinalafterdeadline`;
- the KPI value table's link to its KPI is `_sc_kpi_value`. Lookups get an underscore before the name and `_value` after it.

> **Do this:** open **Tables → KPI → Columns** and compare a few logical names with that rule. If yours differ (for example `sc_scorefinal` instead of `sc_scorefinalafterdeadline`), paste the formulas from this part into a text editor first. Use **Find and replace** there to change the names, then paste the result into the flow.

You also need each table's **set name**, the plural used in links:

> **Do this:** open the table, click **...** (or **Tools**) in the top bar, then **Copy set name**, and paste it somewhere safe. For example, the KPI table's set name is usually `sc_kpis` and the Fiscal year table's is `sc_fiscalyears`.

When a flow fills in a **lookup** column (for example, the KPI a score
belongs to), the value is the set name followed by the row's id in brackets:
`sc_kpis(` id `)`. If your set names differ, change `sc_kpis(` and
`sc_fiscalyears(` in the formulas the same way.

### 5.9 S4 Refresh hierarchy

**What it does:** for every KPI in a fiscal year, it works out four things:

- **Level:** 1 for a Strategic Goal, 2 for a KPI beneath it, and so on.
- **Path:** the ids of all the KPI's ancestors. The app uses it to show and hide branches.
- **Sort key:** text that lists the hierarchy in order when you sort by it.
- **Global weight:** the KPI's share of the whole company.

It saves a KPI only when something actually changed.

It works one level at a time: first the Strategic Goals, then their children,
and so on. The KPIs whose children are being processed are kept in a variable
called `Current`.

> **Do this:**
>
> 1. Create a child flow called `S4 Refresh hierarchy` with one **Text** input, **FiscalYearId**.
> 2. Add **Initialize variable**: name `Current`, type **Array**, value:
>
>    ```text
>    json('[{"id":"","global":100.0,"path":"|","sortKey":"","level":0}]')
>    ```
>
> 3. Add **Initialize variable**: name `Next`, type **Array**, value `createArray()`.
> 4. Add the Dataverse action **List rows** and rename it `List_KPIs`:
>    - **Table name:** KPIs.
>    - **Select columns:** `sc_kpiid,_sc_parent_value,sc_weight,sc_sortorder,sc_code,sc_level,sc_path,sc_sortkey,sc_isleaf,sc_globalweight`
>    - **Filter rows:** `concat('_sc_fiscalyear_value eq ',triggerBody()?['text'])` (Procedure H). If your input isn't the first one, insert **FiscalYearId** from Dynamic content in place of `triggerBody()?['text']`.
>    - Click **...** on the action, then **Settings**. Turn on **Pagination** and set **Threshold** to `5000`.
> 5. Add **Do until** (under Control). In its condition box, paste the formula below, choose **is equal to** and type `true`. Open **Change limits** and set **Count** to `10`.
>
>    ```text
>    equals(length(variables('Current')),0)
>    ```
>
> 6. Inside the Do until, add **Apply to each**, rename it `Each_parent`, and set its list to `variables('Current')`. Leave concurrency off (the default).
> 7. Inside **Each_parent**, add:
>    1. **Filter array** named `Children`. **From:** `outputs('List_KPIs')?['body/value']`. Rule (advanced mode):
>
>       ```text
>       @equals(coalesce(item()?['_sc_parent_value'],''),items('Each_parent')?['id'])
>       ```
>
>    2. **Select** named `ChildWeights`. **From:** `body('Children')`. Click the **T** icon (**Switch to text mode**) next to Map, then paste:
>
>       ```text
>       concat(',',string(max(0.0,float(coalesce(item()?['sc_weight'],0)))))
>       ```
>
>    3. **Compose** named `WeightSum`:
>
>       ```text
>       float(xpath(xml(json(concat('{"root":{"w":[0',join(body('ChildWeights'),''),']}}'))),'sum(/root/w)'))
>       ```
>
>    4. **Compose** named `GroupTotal`:
>
>       ```text
>       if(greater(outputs('WeightSum'),0.0),outputs('WeightSum'),1.0)
>       ```
>
>    5. **Apply to each** named `Each_child`, over `body('Children')`. Leave concurrency off.
> 8. Inside **Each_child**, add:
>    1. **Compose** `ChildGlobal`:
>
>       ```text
>       div(mul(float(items('Each_parent')?['global']),float(coalesce(items('Each_child')?['sc_weight'],0))),outputs('GroupTotal'))
>       ```
>
>    2. **Compose** `ChildPath`: `concat(items('Each_parent')?['path'],items('Each_child')?['sc_kpiid'],'|')`
>    3. **Compose** `ChildLevel`: `add(items('Each_parent')?['level'],1)`
>    4. **Select** named `CodeParts`. **From:** `split(coalesce(items('Each_child')?['sc_code'],''),'.')`. Map, in text mode: `substring(concat('000000',item()),min(length(item()),6),6)`
>    5. **Compose** `SortSegment`:
>
>       ```text
>       concat(substring(concat('000000',string(coalesce(items('Each_child')?['sc_sortorder'],0))),min(length(string(coalesce(items('Each_child')?['sc_sortorder'],0))),6),6),'-',join(body('CodeParts'),'.'),'/')
>       ```
>
>    6. **Compose** `ChildSortKey`: `concat(items('Each_parent')?['sortKey'],outputs('SortSegment'))`
>    7. **Filter array** named `Grandchildren`. **From:** `outputs('List_KPIs')?['body/value']`. Rule: `@equals(item()?['_sc_parent_value'],items('Each_child')?['sc_kpiid'])`
>    8. **Compose** `IsLeaf`: `empty(body('Grandchildren'))`
>    9. **Condition** named `If_changed`. Paste the formula below into the left box, choose **is equal to**, and type `true` in the right box.
>
>       ```text
>       or(not(equals(items('Each_child')?['sc_level'],outputs('ChildLevel'))),not(equals(items('Each_child')?['sc_path'],outputs('ChildPath'))),not(equals(items('Each_child')?['sc_sortkey'],outputs('ChildSortKey'))),not(equals(items('Each_child')?['sc_isleaf'],outputs('IsLeaf'))),greater(max(sub(float(coalesce(items('Each_child')?['sc_globalweight'],-1)),outputs('ChildGlobal')),mul(sub(float(coalesce(items('Each_child')?['sc_globalweight'],-1)),outputs('ChildGlobal')),-1.0)),0.00005))
>       ```
>
>    10. In the condition's **True** branch, add the Dataverse action **Update a row**:
>        - **Table:** KPIs. **Row ID:** `items('Each_child')?['sc_kpiid']`.
>        - Click **Show all** and fill in **Level** = `outputs('ChildLevel')`, **Path** = `outputs('ChildPath')`, **Sort key** = `outputs('ChildSortKey')`, **Is leaf** = `outputs('IsLeaf')` and **Global weight** = `outputs('ChildGlobal')`.
>    11. After the condition (still inside Each_child), add **Append to array variable**. **Name:** Next. **Value:**
>
>        ```text
>        addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'id',items('Each_child')?['sc_kpiid']),'global',outputs('ChildGlobal')),'path',outputs('ChildPath')),'sortKey',outputs('ChildSortKey')),'level',outputs('ChildLevel'))
>        ```
>
> 9. After **Each_parent**, still inside the Do until, add **Set variable**: **Current** = `variables('Next')`. Then add another **Set variable**: **Next** = `createArray()`.
> 10. After the Do until, add **Respond to a Power App or flow** with a **Text** output `Result` set to `done`. Save, then set **Run only users** (Procedure F).

**Test it.**

> **Do this:**
>
> 1. Find the sample fiscal year's id. Open **Tables → Fiscal year**, open the FY2026/27 row and copy the long id at the end of the browser's address, after `id=`.
> 2. Run the flow with that id.
>
> **Check it worked:**
>
> - Open **Tables → KPI**, click **Edit columns**, and add the Level, Path, Sort key, Global weight and Is leaf columns. Sort by **Sort key**.
> - Compare with **Appendix C, section C.3**: the order, levels and global weights must match. (Your Sort keys will match too, because they're built from the codes and sort orders, not the ids.)
> - Run the flow a second time. It should finish faster, because nothing changed and nothing was saved.
>
> **If something goes wrong:**
>
> - Every KPI is level 1: the Parent column's logical name differs from `_sc_parent_value`. Check it (5.8).
> - The flow stops after 10 rounds: your hierarchy has a loop, a KPI that is its own ancestor. The flows in Part 6 prevent this, but sample data entered by hand can contain one. Fix the Parent column.

### 5.10 S5 Score one KPI

**What it does:** works out one leaf KPI's score for one month, exactly as the
web app does. In order, it:

1. picks the figure to score: this month's actual, otherwise this month's estimate, otherwise the latest earlier estimate. For a KPI marked complete, it uses the frozen figure;
2. for a Variance KPI, turns actual and planned into a percentage difference;
3. scales the targets down for phased KPIs;
4. calls S1, S2 or S3;
5. applies the deadline rules (a cap, or a freeze);
6. applies the dashboard options and any admin override.

It's the longest flow in the guide, about 70 actions, but every action is
copy and paste. Build it in the order below and save as you go.

**Inputs** (Procedure F). All are **Text** unless shown otherwise:

| Input | What S6 will send |
| --- | --- |
| KpiJson | The KPI's settings as text, for example `{"id":"…","metricType":"Percentage",…}` |
| EntriesJson | The KPI's figures for the whole year, oldest first |
| Period | The month to score, for example `2026-10` |
| EstimateMode | `count`, `exclude` or `zero` |
| UnreportedMode | `exclude`, `assume` or `zero` |
| ScoreAtDeadline | **Number.** For a KPI whose score freezes at its deadline: the score in the deadline month. `-1` otherwise |
| OverrideScore | **Number.** An admin's override for this month, or `-1` if there isn't one |

**Step 1: variables.** Add these **Initialize variable** actions in this
order. Where the value mentions an input, insert that input from
**Dynamic content**. For example, for `json(` KpiJson `)`: open the formula
box, type `json(`, click the **Dynamic content** tab and pick **KpiJson**,
then type `)` and click **Add**.

| Name | Type | Value |
| --- | --- | --- |
| Kpi | Object | `json(` KpiJson `)` |
| AllEntries | Array | `json(` EntriesJson `)` |
| Period | String | the Period input |
| PeriodNum | Integer | `int(replace(variables('Period'),'-',''))` |
| FiscalMonth | Integer | `add(mod(add(int(substring(variables('Period'),5,2)),8),12),1)` |
| EstimateMode | String | the EstimateMode input |
| UnreportedMode | String | the UnreportedMode input |
| ScoreAtDeadline | Float | `float(` ScoreAtDeadline `)` |
| OverrideScore | Float | `float(` OverrideScore `)` |
| Chosen | Object | `json('{}')` |
| Score | Float | `-1` |
| Pending | String | leave empty |
| Basis | String | leave empty |
| Provisional | Boolean | `false` |
| Prorated | Boolean | `false` |
| Raw | Float | `-1` |
| RawForDeadline | Float | `-1` |

**Step 2: shared steps.**

> **Do this:**
>
> 1. **Filter array** named `Entries`. **From:** `variables('AllEntries')`. Rule (it drops estimates when the "exclude estimates" option is on):
>
>    ```text
>    @or(not(equals(variables('EstimateMode'),'exclude')),not(equals(item()?['basis'],'Estimate')))
>    ```
>
> 2. **Filter array** named `UpToPeriod`. **From:** `body('Entries')`. Rule:
>
>    ```text
>    @lessOrEquals(int(replace(item()?['period'],'-','')),variables('PeriodNum'))
>    ```
>
> 3. **Compose** `Config`: `json(coalesce(variables('Kpi')?['targetConfig'],'{}'))`
> 4. **Compose** `MonthsLate`, which says how many months past its deadline the KPI is (0 if it has none):
>
>    ```text
>    max(0,sub(add(mul(int(substring(variables('Period'),0,4)),12),int(substring(variables('Period'),5,2))),add(mul(int(substring(coalesce(variables('Kpi')?['deadlineMonth'],variables('Period')),0,4)),12),int(substring(coalesce(variables('Kpi')?['deadlineMonth'],variables('Period')),5,2)))))
>    ```
>
> 5. **Compose** `IsMilestone`: `equals(variables('Kpi')?['metricType'],'Month completion')`
> 6. **Condition** named `If_milestone`: left box `outputs('IsMilestone')`, **is equal to**, right box `true`.

**Step 3: the milestone side.** Everything in this step goes on the **True**
side of **If_milestone**.

> **Do this:**
>
> 1. **Filter array** `Completions`. **From:** `body('Entries')`. Rule:
>
>    ```text
>    @and(not(equals(item()?['completionDate'],null)),lessOrEquals(int(replace(item()?['period'],'-','')),variables('PeriodNum')))
>    ```
>
> 2. **Compose** `TargetMonth`: `coalesce(outputs('Config')?['targetMonth'],'')`
> 3. **Set variable** **Chosen**: `coalesce(first(body('Completions')),json('{}'))`
> 4. **Compose** `MilestoneState`. Its result is *completed*, *overdue*, *not yet due* or *no target*:
>
>    ```text
>    if(equals(outputs('TargetMonth'),''),'no target',if(not(equals(first(body('Completions')),null)),'completed',if(greater(sub(add(mul(int(substring(variables('Period'),0,4)),12),int(substring(variables('Period'),5,2))),add(mul(int(substring(if(equals(outputs('TargetMonth'),''),variables('Period'),outputs('TargetMonth')),0,4)),12),int(substring(if(equals(outputs('TargetMonth'),''),variables('Period'),outputs('TargetMonth')),5,2)))),0),'overdue','not yet due')))
>    ```
>
> 5. **Condition** `If_milestone_scores`: left box `or(equals(outputs('MilestoneState'),'completed'),equals(outputs('MilestoneState'),'overdue'))`, **is equal to**, right box `true`.
> 6. On its **True** side:
>    1. **Run a Child Flow** (search for *Run a Child Flow*). Rename it `Score_milestone` and pick **S3 Score a milestone**. Set **TargetMonth** to `outputs('TargetMonth')` and **CompletionDate** to:
>
>       ```text
>       substring(coalesce(variables('Chosen')?['completionDate'],formatDateTime(addDays(addToTime(concat(variables('Period'),'-01T00:00:00Z'),1,'Month'),-1),'yyyy-MM-dd')),0,10)
>       ```
>
>    2. **Set variable** **Score**:
>
>       ```text
>       div(float(int(first(split(string(add(mul(min(max(float(body('Score_milestone')?['rawscore']),0.0),5.0),10.0),0.5)),'.')))),10.0)
>       ```
>
>    3. **Set variable** **Basis**: `coalesce(variables('Chosen')?['basis'],'')`
>    4. **Set variable** **Provisional**: `equals(variables('Chosen')?['basis'],'Estimate')`
> 7. On its **False** side, add **Set variable** **Pending**:
>
>    ```text
>    if(equals(outputs('MilestoneState'),'not yet due'),'Not yet due','No data')
>    ```
>
> **If Power Automate says `rawscore` doesn't exist:** child flow outputs are
> normally read in lower case. If yours differ, delete
> `body('Score_milestone')?['rawscore']` from the formula and insert
> **RawScore** from Dynamic content in its place. The same applies to
> `Score_fixed` and `Score_range` below.

**Step 4: the numeric side.** Everything in this step goes on the **False**
side of **If_milestone**.

> **Do this:**
>
> 1. **Compose** `CompletedNum`. For a completed KPI, it's the month its figure was frozen, as a number; otherwise 999912:
>
>    ```text
>    int(replace(if(equals(variables('Kpi')?['completed'],true),coalesce(variables('Kpi')?['completedPeriod'],'9999-12'),'9999-12'),'-',''))
>    ```
>
> 2. Three **Filter array** actions, each **From** `body('Entries')`:
>    - `FrozenCandidates`, rule: `@and(lessOrEquals(outputs('CompletedNum'),variables('PeriodNum')),lessOrEquals(int(replace(item()?['period'],'-','')),outputs('CompletedNum')),equals(item()?['basis'],'Actual'),not(equals(item()?['value'],null)))`
>    - `ThisMonth`, rule: `@equals(item()?['period'],variables('Period'))`
>    - `EarlierEstimates`, rule: `@and(equals(item()?['basis'],'Estimate'),lessOrEquals(int(replace(item()?['period'],'-','')),variables('PeriodNum')))`
> 3. **Set variable** **Chosen**, which picks the figure: the frozen actual first, then this month's entry, then the latest estimate:
>
>    ```text
>    coalesce(last(body('FrozenCandidates')),first(body('ThisMonth')),last(body('EarlierEstimates')),json('{}'))
>    ```
>
> 4. These **Compose** actions:
>    - `HasValue`: `not(equals(variables('Chosen')?['value'],null))`
>    - `HasConfig`: `and(not(empty(variables('Kpi')?['direction'])),not(empty(variables('Kpi')?['targetMode'])),not(empty(variables('Kpi')?['targetConfig'])))`
>    - `Value`: `float(coalesce(variables('Chosen')?['value'],0))`
>    - `Planned`: `float(coalesce(variables('Chosen')?['plannedValue'],0))`
>    - `ScoredValue`, the figure itself or, for Variance KPIs, the % difference:
>
>      ```text
>      if(not(outputs('HasValue')),null,if(equals(variables('Kpi')?['metricType'],'Variance'),if(equals(outputs('Planned'),0.0),null,mul(max(div(sub(outputs('Value'),outputs('Planned')),if(equals(outputs('Planned'),0.0),1.0,outputs('Planned'))),mul(div(sub(outputs('Value'),outputs('Planned')),if(equals(outputs('Planned'),0.0),1.0,outputs('Planned'))),-1.0)),100.0)),outputs('Value')))
>      ```
>
>    - `Fraction`, the share of the annual target due by this month (1 when the KPI isn't phased):
>
>      ```text
>      if(equals(variables('Kpi')?['phasing'],'Even'),div(float(variables('FiscalMonth')),12.0),if(equals(variables('Kpi')?['phasing'],'Custom'),div(float(xpath(xml(json(concat('{"root":{"w":',string(take(json(coalesce(variables('Kpi')?['phaseShares'],'[0]')),variables('FiscalMonth'))),'}}'))),'sum(/root/w)')),100.0),1.0))
>      ```
>
> 5. **Condition** `If_can_score`: left box `and(outputs('HasValue'),outputs('HasConfig'),not(equals(outputs('ScoredValue'),null)))`, **is equal to**, right box `true`.
> 6. On its **True** side:
>    1. **Condition** `If_fixed`: left box `equals(variables('Kpi')?['targetMode'],'Fixed')`, **is equal to**, right box `true`.
>    2. On **If_fixed**'s **True** side, add **Run a Child Flow**, rename it `Score_fixed` and pick **S1 Score a fixed target**. Set **Actual** to `outputs('ScoredValue')` and **HigherIsBetter** to `equals(variables('Kpi')?['direction'],'Higher is better')`. Fill in the six targets:
>
>       | Input | Value |
>       | --- | --- |
>       | **Poor** | `mul(float(outputs('Config')?['POOR']),outputs('Fraction'))` |
>       | **ImprovementNeeded** | `mul(float(outputs('Config')?['IMPROVEMENT_NEEDED']),outputs('Fraction'))` |
>       | **Meet** | `mul(float(outputs('Config')?['MEET']),outputs('Fraction'))` |
>       | **Good** | `mul(float(outputs('Config')?['GOOD']),outputs('Fraction'))` |
>       | **VeryGood** | `mul(float(outputs('Config')?['VERY_GOOD']),outputs('Fraction'))` |
>       | **Excellent** | `mul(float(outputs('Config')?['EXCELLENT']),outputs('Fraction'))` |
>
>       Then add **Set variable** **Raw**: `div(float(int(first(split(string(add(mul(min(max(float(body('Score_fixed')?['rawscore']),0.0),5.0),10.0),0.5)),'.')))),10.0)`
>    3. On **If_fixed**'s **False** side, add **Run a Child Flow**, rename it `Score_range` and pick **S2 Score a range target**. Set **Actual** and **HigherIsBetter** as above, then the twelve window ends:
>
>       | Input | Value |
>       | --- | --- |
>       | **PoorMin** | `mul(float(outputs('Config')?['POOR'][0]),outputs('Fraction'))` |
>       | **PoorMax** | `mul(float(outputs('Config')?['POOR'][1]),outputs('Fraction'))` |
>       | **ImprovementNeededMin** | `mul(float(outputs('Config')?['IMPROVEMENT_NEEDED'][0]),outputs('Fraction'))` |
>       | **ImprovementNeededMax** | `mul(float(outputs('Config')?['IMPROVEMENT_NEEDED'][1]),outputs('Fraction'))` |
>       | **MeetMin** | `mul(float(outputs('Config')?['MEET'][0]),outputs('Fraction'))` |
>       | **MeetMax** | `mul(float(outputs('Config')?['MEET'][1]),outputs('Fraction'))` |
>       | **GoodMin** | `mul(float(outputs('Config')?['GOOD'][0]),outputs('Fraction'))` |
>       | **GoodMax** | `mul(float(outputs('Config')?['GOOD'][1]),outputs('Fraction'))` |
>       | **VeryGoodMin** | `mul(float(outputs('Config')?['VERY_GOOD'][0]),outputs('Fraction'))` |
>       | **VeryGoodMax** | `mul(float(outputs('Config')?['VERY_GOOD'][1]),outputs('Fraction'))` |
>       | **ExcellentMin** | `mul(float(outputs('Config')?['EXCELLENT'][0]),outputs('Fraction'))` |
>       | **ExcellentMax** | `mul(float(outputs('Config')?['EXCELLENT'][1]),outputs('Fraction'))` |
>
>       Then add **Set variable** **Raw**: `div(float(int(first(split(string(add(mul(min(max(float(body('Score_range')?['rawscore']),0.0),5.0),10.0),0.5)),'.')))),10.0)`
>    4. After **If_fixed**, still on the True side of If_can_score, add **Compose** `DeadlineScore`:
>
>       ```text
>       if(equals(outputs('MonthsLate'),0),variables('Raw'),if(equals(variables('Kpi')?['scoreFinalAfterDeadline'],true),if(less(variables('ScoreAtDeadline'),0.0),variables('Raw'),variables('ScoreAtDeadline')),min(variables('Raw'),if(equals(outputs('MonthsLate'),1),2.9,if(equals(outputs('MonthsLate'),2),2.4,0.0)))))
>       ```
>
>    5. Then add four **Set variable** actions:
>       - **Score**: `div(float(int(first(split(string(add(mul(min(max(float(outputs('DeadlineScore')),0.0),5.0),10.0),0.5)),'.')))),10.0)`
>       - **Basis**: `coalesce(variables('Chosen')?['basis'],'')`
>       - **Provisional**: `equals(variables('Chosen')?['basis'],'Estimate')`
>       - **Prorated**: `less(outputs('Fraction'),1.0)`
> 7. On **If_can_score**'s **False** side, add **Set variable** **Pending**:
>
>    ```text
>    if(and(not(outputs('HasValue')),not(equals(coalesce(variables('Kpi')?['frequency'],'Monthly'),'Monthly')),not(if(equals(variables('Kpi')?['frequency'],'Quarterly'),equals(mod(variables('FiscalMonth'),3),0),equals(variables('FiscalMonth'),12)))),'Not yet due','No data')
>    ```
>
> 8. After **If_can_score**, still on the False side of If_milestone, add **Set variable** **RawForDeadline**:
>
>    ```text
>    if(not(outputs('HasValue')),0.0,if(not(outputs('HasConfig')),-1.0,if(equals(outputs('ScoredValue'),null),0.0,variables('Raw'))))
>    ```

**Step 5: dashboard options and overrides.** These go **after** the
**If_milestone** condition, back at the top level of the flow, not inside
either side.

> **Do this:**
>
> 1. These **Compose** actions. They work out how late an unreported KPI is, for the "assume Meet, decaying" option:
>
>    1. **Compose** named `FyStart`:
>
>       ```text
>       formatDateTime(addToTime(concat(variables('Period'),'-01T00:00:00Z'),sub(1,add(mod(add(int(substring(variables('Period'),5,2)),8),12),1)),'Month'),'yyyy-MM')
>       ```
>
>    2. **Compose** named `SinceMonth`:
>
>       ```text
>       coalesce(last(body('UpToPeriod'))?['period'],outputs('FyStart'))
>       ```
>
>    3. **Compose** named `MonthlyLate`:
>
>       ```text
>       max(0,sub(add(mul(int(substring(variables('Period'),0,4)),12),int(substring(variables('Period'),5,2))),add(mul(int(substring(outputs('SinceMonth'),0,4)),12),int(substring(outputs('SinceMonth'),5,2)))))
>       ```
>
>    4. **Compose** named `DueFiscalMonth`:
>
>       ```text
>       if(equals(variables('Kpi')?['frequency'],'Quarterly'),mul(div(variables('FiscalMonth'),3),3),if(equals(variables('FiscalMonth'),12),12,0))
>       ```
>
>    5. **Compose** named `DuePeriod`:
>
>       ```text
>       formatDateTime(addToTime(concat(outputs('FyStart'),'-01T00:00:00Z'),sub(outputs('DueFiscalMonth'),1),'Month'),'yyyy-MM')
>       ```
>
> 2. **Filter array** `SinceDue`. **From:** `body('UpToPeriod')`. Rule: `@greaterOrEquals(int(replace(item()?['period'],'-','')),int(replace(outputs('DuePeriod'),'-','')))`
> 3. These **Compose** actions, in this order:
>
>    1. **Compose** named `QuarterlyLate`:
>
>       ```text
>       if(equals(outputs('DueFiscalMonth'),0),0,if(greater(length(body('SinceDue')),0),0,max(0,sub(add(mul(int(substring(variables('Period'),0,4)),12),int(substring(variables('Period'),5,2))),add(mul(int(substring(outputs('DuePeriod'),0,4)),12),int(substring(outputs('DuePeriod'),5,2)))))))
>       ```
>
>    2. **Compose** named `NumericLate`:
>
>       ```text
>       if(not(empty(variables('Kpi')?['deadlineMonth'])),outputs('MonthsLate'),if(equals(coalesce(variables('Kpi')?['frequency'],'Monthly'),'Monthly'),outputs('MonthlyLate'),outputs('QuarterlyLate')))
>       ```
>
>    3. **Compose** named `AssumedScore`:
>
>       ```text
>       if(outputs('IsMilestone'),if(equals(variables('Pending'),'Not yet due'),3.4,-1.0),if(lessOrEquals(outputs('NumericLate'),0),3.4,if(equals(outputs('NumericLate'),1),2.9,if(equals(outputs('NumericLate'),2),2.4,0.0))))
>       ```
>
>    4. **Compose** named `EstimateZero`:
>
>       ```text
>       and(equals(variables('EstimateMode'),'zero'),equals(variables('Basis'),'Estimate'))
>       ```
>
>    5. **Compose** named `ModeScore`:
>
>       ```text
>       if(outputs('EstimateZero'),0.0,if(less(variables('Score'),0.0),if(equals(variables('UnreportedMode'),'zero'),0.0,if(equals(variables('UnreportedMode'),'assume'),outputs('AssumedScore'),-1.0)),variables('Score')))
>       ```
>
>    6. **Compose** named `ModeAssumed`:
>
>       ```text
>       and(less(variables('Score'),0.0),or(equals(variables('UnreportedMode'),'zero'),and(equals(variables('UnreportedMode'),'assume'),greaterOrEquals(outputs('AssumedScore'),0.0))))
>       ```
>
>    7. **Compose** named `Overridden`:
>
>       ```text
>       greaterOrEquals(variables('OverrideScore'),0.0)
>       ```
>
>    8. **Compose** named `FinalScore`:
>
>       ```text
>       if(outputs('Overridden'),div(float(int(first(split(string(add(mul(min(max(float(variables('OverrideScore')),0.0),5.0),10.0),0.5)),'.')))),10.0),outputs('ModeScore'))
>       ```
>
>    9. **Compose** named `FinalPending`:
>
>       ```text
>       if(or(outputs('Overridden'),outputs('ModeAssumed')),'',variables('Pending'))
>       ```
>
>    10. **Compose** named `FinalAssumed`:
>
>       ```text
>       and(not(outputs('Overridden')),outputs('ModeAssumed'))
>       ```
>
>    11. **Compose** named `FinalProvisional`:
>
>       ```text
>       and(variables('Provisional'),not(outputs('EstimateZero')))
>       ```
>
>    12. **Compose** named `FinalBand`:
>
>       ```text
>       if(less(outputs('FinalScore'),0.0),'',if(greaterOrEquals(outputs('FinalScore'),4.6),'Excellent',if(greaterOrEquals(outputs('FinalScore'),4.0),'Very good',if(greaterOrEquals(outputs('FinalScore'),3.5),'Good',if(greaterOrEquals(outputs('FinalScore'),3.0),'Meet',if(greaterOrEquals(outputs('FinalScore'),2.5),'Improvement needed','Poor'))))))
>       ```

**Step 6: send the answer back.** Add **Respond to a Power App or flow**
with these outputs:

| Output name | Type | Value |
| --- | --- | --- |
| `HasScore` | Yes/No | `greaterOrEquals(outputs('FinalScore'),0.0)` |
| `Score` | Number | `outputs('FinalScore')` |
| `Band` | Text | `outputs('FinalBand')` |
| `PendingReason` | Text | `outputs('FinalPending')` |
| `Basis` | Text | `variables('Basis')` |
| `Provisional` | Yes/No | `outputs('FinalProvisional')` |
| `Prorated` | Yes/No | `variables('Prorated')` |
| `Assumed` | Yes/No | `outputs('FinalAssumed')` |
| `Overridden` | Yes/No | `outputs('Overridden')` |
| `ValueUsed` | Text | `string(variables('Chosen')?['value'])` |
| `PlannedValueUsed` | Text | `string(variables('Chosen')?['plannedValue'])` |
| `CompletionDateUsed` | Text | `string(variables('Chosen')?['completionDate'])` |
| `RawScore` | Number | `variables('Raw')` |
| `MonthsLate` | Number | `if(outputs('IsMilestone'),0,outputs('MonthsLate'))` |
| `Frozen` | Yes/No | `and(not(outputs('IsMilestone')),greaterOrEquals(variables('Score'),0.0),greater(outputs('MonthsLate'),0),equals(variables('Kpi')?['scoreFinalAfterDeadline'],true))` |
| `Cap` | Number | `if(and(not(outputs('IsMilestone')),greaterOrEquals(variables('Score'),0.0),greater(outputs('MonthsLate'),0),not(equals(variables('Kpi')?['scoreFinalAfterDeadline'],true))),if(equals(outputs('MonthsLate'),1),2.9,if(equals(outputs('MonthsLate'),2),2.4,0.0)),-1.0)` |
| `RawForDeadline` | Number | `variables('RawForDeadline')` |

Save. S5 reads no tables, so it doesn't need the **Run only users** setting.

**Test it.** Each test below gives you the two long inputs to paste and the
other inputs to type. They're all built from the sample data in Appendix C.
After each run, open the **Respond to a Power App or flow** step's outputs
and compare.

**Test A: A figure that reaches Meet** (KPI 1.1.1 Revenue growth)

KpiJson:

```text
{"id":"k111","metricType":"Percentage","direction":"Higher is better","targetMode":"Fixed","targetConfig":"{\"POOR\":60,\"IMPROVEMENT_NEEDED\":70,\"MEET\":80,\"GOOD\":90,\"VERY_GOOD\":95,\"EXCELLENT\":100}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-07","value":78,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-08","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":85,"basis":"Actual","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **3.4**, band **Meet**.

**Test B: No figure yet for October** (KPI 1.1.1 Revenue growth)

KpiJson:

```text
{"id":"k111","metricType":"Percentage","direction":"Higher is better","targetMode":"Fixed","targetConfig":"{\"POOR\":60,\"IMPROVEMENT_NEEDED\":70,\"MEET\":80,\"GOOD\":90,\"VERY_GOOD\":95,\"EXCELLENT\":100}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-07","value":78,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-08","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":85,"basis":"Actual","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-10`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **No**, score **-1**, pendingreason **No data**.

**Test C: Same, with "assume Meet, decaying": one month late** (KPI 1.1.1 Revenue growth)

KpiJson:

```text
{"id":"k111","metricType":"Percentage","direction":"Higher is better","targetMode":"Fixed","targetConfig":"{\"POOR\":60,\"IMPROVEMENT_NEEDED\":70,\"MEET\":80,\"GOOD\":90,\"VERY_GOOD\":95,\"EXCELLENT\":100}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-07","value":78,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-08","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":85,"basis":"Actual","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-10`, EstimateMode `count`, UnreportedMode `assume`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **2.9**, band **Improvement needed**, assumed **Yes**.

**Test D: An admin override of 4.2** (KPI 1.1.1 Revenue growth)

KpiJson:

```text
{"id":"k111","metricType":"Percentage","direction":"Higher is better","targetMode":"Fixed","targetConfig":"{\"POOR\":60,\"IMPROVEMENT_NEEDED\":70,\"MEET\":80,\"GOOD\":90,\"VERY_GOOD\":95,\"EXCELLENT\":100}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-07","value":78,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-08","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":85,"basis":"Actual","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `4.2`.

Expected: hasscore **Yes**, score **4.2**, band **Very good**, overridden **Yes**.

**Test E: Phased evenly: half the annual target is due by September** (KPI 1.2 New customers)

KpiJson:

```text
{"id":"k12","metricType":"Quantity","direction":"Higher is better","targetMode":"Fixed","targetConfig":"{\"POOR\":60,\"IMPROVEMENT_NEEDED\":80,\"MEET\":120,\"GOOD\":150,\"VERY_GOOD\":170,\"EXCELLENT\":200}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"Even","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-09","value":55,"basis":"Actual","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **2.9**, band **Improvement needed**, prorated **Yes**.

**Test F: A range target, estimated figure** (KPI 1.3 Customer satisfaction)

KpiJson:

```text
{"id":"k13","metricType":"Percentage","direction":"Higher is better","targetMode":"Range","targetConfig":"{\"POOR\":[0,59],\"IMPROVEMENT_NEEDED\":[60,69],\"MEET\":[70,79],\"GOOD\":[80,89],\"VERY_GOOD\":[90,94],\"EXCELLENT\":[95,100]}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Quarterly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-06","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":84,"basis":"Estimate","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **3.7**, band **Good**, provisional **Yes**.

**Test G: Same, with "estimates score zero"** (KPI 1.3 Customer satisfaction)

KpiJson:

```text
{"id":"k13","metricType":"Percentage","direction":"Higher is better","targetMode":"Range","targetConfig":"{\"POOR\":[0,59],\"IMPROVEMENT_NEEDED\":[60,69],\"MEET\":[70,79],\"GOOD\":[80,89],\"VERY_GOOD\":[90,94],\"EXCELLENT\":[95,100]}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Quarterly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-06","value":82,"basis":"Actual","plannedValue":null,"completionDate":null},{"period":"2026-09","value":84,"basis":"Estimate","plannedValue":null,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `zero`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **0.0**, band **Poor**.

**Test H: Variance: 6% over budget** (KPI 2.2 Spending against budget)

KpiJson:

```text
{"id":"k22","metricType":"Variance","direction":"Lower is better","targetMode":"Fixed","targetConfig":"{\"POOR\":20,\"IMPROVEMENT_NEEDED\":15,\"MEET\":10,\"GOOD\":5,\"VERY_GOOD\":3,\"EXCELLENT\":1}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-09","value":1060000,"basis":"Actual","plannedValue":1000000,"completionDate":null}]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **3.4**, band **Meet**.

**Test I: Milestone, target October, not finished yet** (KPI 2.3 New finance system live)

KpiJson:

```text
{"id":"k23","metricType":"Month completion","direction":null,"targetMode":null,"targetConfig":"{\"targetMonth\":\"2026-10\"}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[]
```

Other inputs: Period `2026-09`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **No**, score **-1**, pendingreason **Not yet due**.

**Test J: Milestone finished on 1 November, one month late** (KPI 2.3 New finance system live)

KpiJson:

```text
{"id":"k23","metricType":"Month completion","direction":null,"targetMode":null,"targetConfig":"{\"targetMonth\":\"2026-10\"}","deadlineMonth":null,"scoreFinalAfterDeadline":false,"completed":false,"completedPeriod":null,"frequency":"Monthly","phasing":"None","phaseShares":null}
```

EntriesJson:

```text
[{"period":"2026-11","value":null,"basis":"Actual","plannedValue":null,"completionDate":"2026-11-01"}]
```

Other inputs: Period `2026-11`, EstimateMode `count`, UnreportedMode `exclude`, ScoreAtDeadline `-1`, OverrideScore `-1`.

Expected: hasscore **Yes**, score **2.9**, band **Improvement needed**.

> **If something goes wrong:**
>
> - *"Unable to process template language expressions… 'json'… not valid"*: the KpiJson or EntriesJson you pasted isn't complete. Copy it again using the copy button.
> - **pendingreason** is *No data* when you expected a score: in your KPI's settings, check **targetMode** and **direction** are spelled exactly like the choice items in Part 3 (`Fixed`, `Higher is better`).
> - Test E scores higher than 2.9: check `phasing` is spelled `Even`, with a capital E.
> - A *"…of type 'Null'"* error on a Set variable: a formula was pasted into the wrong Set variable. Compare the variable names with the steps above.

### 5.11 S6 Score a month

**What it does:** scores every leaf KPI of a fiscal year for one month by
calling S5. It then works out every parent from its children, level by level
from the bottom, and finally the company total. It saves everything in
**KPI score** and **Total score**.

**Inputs:** six **Text** inputs, **FiscalYearId**, **Period**, **Scenario**,
**EstimateMode**, **UnreportedMode** and **OnlyKpiId**. OnlyKpiId is either
`all`, or one KPI's id. With an id, only that KPI is rescored, but every
parent and the total are still recalculated. This keeps a single save fast.

**Step 1: read everything once.**

> **Do this:**
>
> 1. Add 6 **Initialize variable** actions, type **String**, named `FiscalYearId`, `Period`, `Scenario`, `EstimateMode`, `UnreportedMode` and `OnlyKpiId`, each set to the input of the same name.
> 2. **Initialize variable** `DeadlineScores`, type **Array**, value `createArray()`.
> 3. Add four Dataverse **List rows** actions. In each one, fill **Filter rows** with the formula shown (Procedure H), then open **...** → **Settings** and turn on **Pagination** with threshold `5000`.
>    1. `List_KPIs`: table **KPIs**. **Filter rows:** `concat('_sc_fiscalyear_value eq ',variables('FiscalYearId'))`. **Select columns:**
>
>       ```text
>       sc_kpiid,sc_code,sc_name,sc_level,sc_weight,sc_globalweight,sc_path,sc_sortkey,_sc_parent_value,sc_isleaf,sc_metrictype,sc_direction,sc_targetmode,sc_targetconfig,sc_deadlinemonth,sc_scorefinalafterdeadline,sc_completed,sc_completedperiod,sc_frequency,sc_phasing,sc_phaseshares
>       ```
>
>    2. `List_values`: table **KPI values**. **Filter rows:** `concat('_sc_fiscalyear_value eq ',variables('FiscalYearId'))`. **Sort by:** `sc_period asc`. **Select columns:** `_sc_kpi_value,sc_period,sc_value,sc_basis,sc_plannedvalue,sc_completiondate`
>    3. `List_overrides`: table **Score overrides**. **Filter rows:**
>
>       ```text
>       concat('_sc_fiscalyear_value eq ',variables('FiscalYearId'),' and sc_period eq ''',variables('Period'),'''')
>       ```
>
>    4. `List_existing`: table **KPI scores**. **Select columns:** `sc_kpiscoreid,_sc_kpi_value`. **Filter rows:**
>
>       ```text
>       concat('_sc_fiscalyear_value eq ',variables('FiscalYearId'),' and sc_period eq ''',variables('Period'),''' and sc_scenario eq ''',variables('Scenario'),'''')
>       ```
>
> 4. **Filter array** `Leaves`. **From:** `outputs('List_KPIs')?['body/value']`. Rule:
>
>    ```text
>    @and(equals(item()?['sc_isleaf'],true),or(equals(variables('OnlyKpiId'),'all'),equals(item()?['sc_kpiid'],variables('OnlyKpiId'))))
>    ```
>
> 5. **Filter array** `FrozenLeaves`, the leaves whose score freezes at a deadline that has already passed. **From:** `body('Leaves')`. Rule:
>
>    ```text
>    @and(not(equals(item()?['sc_metrictype@OData.Community.Display.V1.FormattedValue'],'Month completion')),not(empty(item()?['sc_deadlinemonth'])),equals(item()?['sc_scorefinalafterdeadline'],true),less(int(replace(coalesce(item()?['sc_deadlinemonth'],'0000-00'),'-','')),int(replace(variables('Period'),'-',''))))
>    ```

**Two long formulas** used in Steps 2 and 3:

*Entries map*, which turns one figure into the shape S5 expects:

```text
addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'period',item()?['sc_period']),'value',item()?['sc_value']),'basis',item()?['sc_basis@OData.Community.Display.V1.FormattedValue']),'plannedValue',item()?['sc_plannedvalue']),'completionDate',if(empty(item()?['sc_completiondate']),null,substring(coalesce(item()?['sc_completiondate'],'0000-00-00'),0,10)))
```

*KPI JSON*, which turns the KPI's settings into the shape S5 expects:

```text
addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'id',items('Each_leaf')?['sc_kpiid']),'metricType',items('Each_leaf')?['sc_metrictype@OData.Community.Display.V1.FormattedValue']),'direction',items('Each_leaf')?['sc_direction@OData.Community.Display.V1.FormattedValue']),'targetMode',items('Each_leaf')?['sc_targetmode@OData.Community.Display.V1.FormattedValue']),'targetConfig',items('Each_leaf')?['sc_targetconfig']),'deadlineMonth',items('Each_leaf')?['sc_deadlinemonth']),'scoreFinalAfterDeadline',items('Each_leaf')?['sc_scorefinalafterdeadline']),'completed',items('Each_leaf')?['sc_completed']),'completedPeriod',items('Each_leaf')?['sc_completedperiod']),'frequency',items('Each_leaf')?['sc_frequency@OData.Community.Display.V1.FormattedValue']),'phasing',items('Each_leaf')?['sc_phasing@OData.Community.Display.V1.FormattedValue']),'phaseShares',items('Each_leaf')?['sc_phaseshares'])
```

**Step 2: deadline scores for frozen KPIs.**

> **Do this:**
>
> 1. Add **Apply to each** `Each_frozen_leaf` over `body('FrozenLeaves')`. In its **Settings**, turn on **Concurrency control** and set the degree to `20`. Inside it, add:
>    1. **Filter array** `Frozen_values`. **From:** `outputs('List_values')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'],items('Each_frozen_leaf')?['sc_kpiid'])`
>    2. **Select** `Frozen_entries`. **From:** `body('Frozen_values')`. Map, in text mode: the *Entries map* formula.
>    3. **Compose** `Frozen_kpi_json`: the *KPI JSON* formula, with every `Each_leaf` changed to `Each_frozen_leaf`.
>    4. **Run a Child Flow** `Score_at_deadline`, flow **S5 Score one KPI**:
>       - **KpiJson:** `string(outputs('Frozen_kpi_json'))`
>       - **EntriesJson:** `string(body('Frozen_entries'))`
>       - **Period:** `items('Each_frozen_leaf')?['sc_deadlinemonth']`
>       - **EstimateMode:** `variables('EstimateMode')`; **UnreportedMode:** `variables('UnreportedMode')`
>       - **ScoreAtDeadline:** `-1`; **OverrideScore:** `-1`
>    5. **Append to array variable** **DeadlineScores**:
>
>       ```text
>       addProperty(addProperty(json('{}'),'kpiId',items('Each_frozen_leaf')?['sc_kpiid']),'raw',body('Score_at_deadline')?['rawfordeadline'])
>       ```

**Step 3: score every leaf.**

> **Do this:**
>
> 1. Add **Apply to each** `Each_leaf` over `body('Leaves')`, with **Concurrency control** on and degree `20`. Inside it, add:
>    1. **Filter array** `Leaf_values`. **From:** `outputs('List_values')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'],items('Each_leaf')?['sc_kpiid'])`
>    2. **Select** `Entries`. **From:** `body('Leaf_values')`. Map, in text mode: the *Entries map* formula.
>    3. **Compose** `KpiJson`: the *KPI JSON* formula.
>    4. **Filter array** `Leaf_override`. **From:** `outputs('List_overrides')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'],items('Each_leaf')?['sc_kpiid'])`
>    5. **Filter array** `Leaf_deadline`. **From:** `variables('DeadlineScores')`. Rule: `@equals(item()?['kpiId'],items('Each_leaf')?['sc_kpiid'])`
>    6. **Filter array** `Leaf_existing`. **From:** `outputs('List_existing')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'],items('Each_leaf')?['sc_kpiid'])`
>    7. **Run a Child Flow** `Score_one_KPI`, flow **S5 Score one KPI**:
>       - **KpiJson:** `string(outputs('KpiJson'))`
>       - **EntriesJson:** `string(body('Entries'))`
>       - **Period:** `variables('Period')`; **EstimateMode:** `variables('EstimateMode')`; **UnreportedMode:** `variables('UnreportedMode')`
>       - **ScoreAtDeadline:** `coalesce(first(body('Leaf_deadline'))?['raw'],-1)`
>       - **OverrideScore:** `coalesce(first(body('Leaf_override'))?['sc_score'],-1)`
>    8. These **Compose** actions:
>
>       1. **Compose** named `LeafWeight`:
>
>          ```text
>          float(coalesce(items('Each_leaf')?['sc_weight'],0))
>          ```
>
>       2. **Compose** named `LeafScoredWeight`:
>
>          ```text
>          if(body('Score_one_KPI')?['hasscore'],outputs('LeafWeight'),0.0)
>          ```
>
>       3. **Compose** named `LeafScoreTimesWeight`:
>
>          ```text
>          if(body('Score_one_KPI')?['hasscore'],mul(float(body('Score_one_KPI')?['score']),outputs('LeafWeight')),0.0)
>          ```
>
>       4. **Compose** named `LeafProvisionalWeight`:
>
>          ```text
>          if(and(body('Score_one_KPI')?['hasscore'],body('Score_one_KPI')?['provisional']),outputs('LeafWeight'),0.0)
>          ```
>
>       5. **Compose** named `LeafNotYetDueWeight`:
>
>          ```text
>          if(equals(body('Score_one_KPI')?['pendingreason'],'Not yet due'),outputs('LeafWeight'),0.0)
>          ```
>
>       6. **Compose** named `LeafProratedWeight`:
>
>          ```text
>          if(and(body('Score_one_KPI')?['hasscore'],body('Score_one_KPI')?['prorated']),outputs('LeafWeight'),0.0)
>          ```
>
>       7. **Compose** named `LeafAssumedWeight`:
>
>          ```text
>          if(and(body('Score_one_KPI')?['hasscore'],body('Score_one_KPI')?['assumed']),outputs('LeafWeight'),0.0)
>          ```
>
>       8. **Compose** named `LeafCoverage`:
>
>          ```text
>          if(greater(sub(outputs('LeafWeight'),outputs('LeafNotYetDueWeight')),0.0),div(outputs('LeafScoredWeight'),if(greater(sub(outputs('LeafWeight'),outputs('LeafNotYetDueWeight')),0.0),sub(outputs('LeafWeight'),outputs('LeafNotYetDueWeight')),1.0)),0.0)
>          ```
>
>       9. **Compose** named `LeafNotYetDueShare`:
>
>          ```text
>          if(greater(outputs('LeafWeight'),0.0),div(outputs('LeafNotYetDueWeight'),if(greater(outputs('LeafWeight'),0.0),outputs('LeafWeight'),1.0)),0.0)
>          ```
>
>       10. **Compose** named `LeafProratedShare`:
>
>          ```text
>          if(greater(outputs('LeafWeight'),0.0),div(outputs('LeafProratedWeight'),if(greater(outputs('LeafWeight'),0.0),outputs('LeafWeight'),1.0)),0.0)
>          ```
>
>    9. Dataverse **Update a row**, renamed `Save_leaf_score`. **Table:** KPI scores. **Row ID:** `coalesce(first(body('Leaf_existing'))?['sc_kpiscoreid'],guid())`. Click **Show all** and fill in the columns from the table below.

When the Row ID doesn't exist yet, **Update a row** creates the row, so this
one action both adds new scores and replaces old ones:

| Column | Value |
| --- | --- |
| **Name** | `concat(items('Each_leaf')?['sc_code'],' ',variables('Period'),' ',variables('Scenario'))` |
| **KPI** | `concat('sc_kpis(',items('Each_leaf')?['sc_kpiid'],')')` |
| **Fiscal year** | `concat('sc_fiscalyears(',variables('FiscalYearId'),')')` |
| **Period** | `variables('Period')` |
| **Scenario** | `variables('Scenario')` |
| **Code** | `items('Each_leaf')?['sc_code']` |
| **KPI name** | `items('Each_leaf')?['sc_name']` |
| **Level** | `items('Each_leaf')?['sc_level']` |
| **Global weight** | `items('Each_leaf')?['sc_globalweight']` |
| **Local weight** | `outputs('LeafWeight')` |
| **Path** | `items('Each_leaf')?['sc_path']` |
| **Sort key** | `items('Each_leaf')?['sc_sortkey']` |
| **Parent id** | `coalesce(items('Each_leaf')?['_sc_parent_value'],'')` |
| **Is leaf** | `true` |
| **Has score** | `body('Score_one_KPI')?['hasscore']` |
| **Score** | `if(body('Score_one_KPI')?['hasscore'],body('Score_one_KPI')?['score'],null)` |
| **Exact score** | `if(body('Score_one_KPI')?['hasscore'],body('Score_one_KPI')?['score'],null)` |
| **Band** | `if(empty(body('Score_one_KPI')?['band']),null,body('Score_one_KPI')?['band'])` |
| **Pending reason** | `if(empty(body('Score_one_KPI')?['pendingreason']),null,body('Score_one_KPI')?['pendingreason'])` |
| **Basis** | `if(empty(body('Score_one_KPI')?['basis']),null,body('Score_one_KPI')?['basis'])` |
| **Provisional** | `body('Score_one_KPI')?['provisional']` |
| **Prorated** | `body('Score_one_KPI')?['prorated']` |
| **Overridden** | `body('Score_one_KPI')?['overridden']` |
| **Assumed** | `body('Score_one_KPI')?['assumed']` |
| **Value used** | `if(empty(body('Score_one_KPI')?['valueused']),null,float(if(empty(body('Score_one_KPI')?['valueused']),'0',body('Score_one_KPI')?['valueused'])))` |
| **Planned value used** | `if(empty(body('Score_one_KPI')?['plannedvalueused']),null,float(if(empty(body('Score_one_KPI')?['plannedvalueused']),'0',body('Score_one_KPI')?['plannedvalueused'])))` |
| **Completion date used** | `if(empty(body('Score_one_KPI')?['completiondateused']),null,body('Score_one_KPI')?['completiondateused'])` |
| **Raw score** | `if(less(body('Score_one_KPI')?['rawscore'],0),null,body('Score_one_KPI')?['rawscore'])` |
| **Deadline cap** | `if(less(body('Score_one_KPI')?['cap'],0),null,body('Score_one_KPI')?['cap'])` |
| **Months late** | `body('Score_one_KPI')?['monthslate']` |
| **Frozen at deadline** | `body('Score_one_KPI')?['frozen']` |
| **Total weight** | `outputs('LeafWeight')` |
| **Scored weight** | `outputs('LeafScoredWeight')` |
| **Score times weight** | `outputs('LeafScoreTimesWeight')` |
| **Provisional weight** | `outputs('LeafProvisionalWeight')` |
| **Not yet due weight** | `outputs('LeafNotYetDueWeight')` |
| **Prorated weight** | `outputs('LeafProratedWeight')` |
| **Assumed weight** | `outputs('LeafAssumedWeight')` |
| **Coverage** | `outputs('LeafCoverage')` |
| **Provisional share** | `0` |
| **Not yet due share** | `outputs('LeafNotYetDueShare')` |
| **Prorated share** | `outputs('LeafProratedShare')` |
| **Leaf count** | `1` |
| **Scored leaf count** | `if(body('Score_one_KPI')?['hasscore'],1,0)` |

**Step 4: add up the parents, one level at a time.** A parent's score comes
only from its direct children, exactly as in the web app. The level 5 rows
are added up first to give the level 4 parents, and so on up to the
Strategic Goals.

> **Do this:**
>
> 1. After **Each_leaf**, add **Apply to each** `Each_level` over `createArray(4,3,2,1)`. Leave its concurrency **off**: the levels must run in order.
> 2. Inside it, add a Dataverse **List rows** action named `Child_totals`. Set **Table** to **KPI scores**, click **Show all**, and paste this into **Fetch Xml Query**:
>
>    ```xml
>    <fetch aggregate="true">
>      <entity name="sc_kpiscore">
>        <attribute name="sc_parentid" alias="parentid" groupby="true" />
>        <attribute name="sc_localweight" alias="total" aggregate="sum" />
>        <attribute name="sc_scoredweight" alias="scored" aggregate="sum" />
>        <attribute name="sc_scoretimesweight" alias="sxw" aggregate="sum" />
>        <attribute name="sc_provisionalweight" alias="prov" aggregate="sum" />
>        <attribute name="sc_notyetdueweight" alias="nyd" aggregate="sum" />
>        <attribute name="sc_proratedweight" alias="pror" aggregate="sum" />
>        <attribute name="sc_assumedweight" alias="assumed" aggregate="sum" />
>        <attribute name="sc_leafcount" alias="leaves" aggregate="sum" />
>        <attribute name="sc_scoredleafcount" alias="scoredleaves" aggregate="sum" />
>        <filter>
>          <condition attribute="sc_fiscalyear" operator="eq" value="@{variables('FiscalYearId')}" />
>          <condition attribute="sc_period" operator="eq" value="@{variables('Period')}" />
>          <condition attribute="sc_scenario" operator="eq" value="@{variables('Scenario')}" />
>          <condition attribute="sc_level" operator="eq" value="@{add(items('Each_level'),1)}" />
>        </filter>
>      </entity>
>    </fetch>
>    ```
>
>    The four `@{...}` parts fill themselves in when the flow runs. If the designer shows them as plain text and the test run fails on this step, delete each `@{...}` and insert the same formula with **fx** instead.
>
> 3. Still inside **Each_level**, add **Apply to each** `Each_parent` over `outputs('Child_totals')?['body/value']`, with **Concurrency control** on and degree `20`. Parents on the same level don't depend on each other. Inside it, add:
>    1. **Filter array** `Find_parent_KPI`. **From:** `outputs('List_KPIs')?['body/value']`. Rule: `@equals(item()?['sc_kpiid'],items('Each_parent')?['parentid'])`
>    2. **Filter array** `Parent_existing`. **From:** `outputs('List_existing')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'],items('Each_parent')?['parentid'])`
>    3. These **Compose** actions, in order:
>
>       1. **Compose** named `ChildWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['total'],0))
>          ```
>
>       2. **Compose** named `ChildScoredWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['scored'],0))
>          ```
>
>       3. **Compose** named `ChildScoreTimesWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['sxw'],0))
>          ```
>
>       4. **Compose** named `ChildProvisionalWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['prov'],0))
>          ```
>
>       5. **Compose** named `ChildNotYetDueWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['nyd'],0))
>          ```
>
>       6. **Compose** named `ChildProratedWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['pror'],0))
>          ```
>
>       7. **Compose** named `ChildAssumedWeight`:
>
>          ```text
>          float(coalesce(items('Each_parent')?['assumed'],0))
>          ```
>
>       8. **Compose** named `ParentWeight`:
>
>          ```text
>          float(coalesce(first(body('Find_parent_KPI'))?['sc_weight'],0))
>          ```
>
>       9. **Compose** named `ParentHasScore`:
>
>          ```text
>          greater(outputs('ChildScoredWeight'),0.0)
>          ```
>
>       10. **Compose** named `ParentExact`:
>
>          ```text
>          if(outputs('ParentHasScore'),div(outputs('ChildScoreTimesWeight'),if(outputs('ParentHasScore'),outputs('ChildScoredWeight'),1.0)),-1.0)
>          ```
>
>       11. **Compose** named `ParentScore`:
>
>          ```text
>          if(outputs('ParentHasScore'),div(float(int(first(split(string(add(mul(min(max(float(outputs('ParentExact')),0.0),5.0),10.0),0.5)),'.')))),10.0),-1.0)
>          ```
>
>       12. **Compose** named `ParentBand`:
>
>          ```text
>          if(outputs('ParentHasScore'),if(greaterOrEquals(outputs('ParentScore'),4.6),'Excellent',if(greaterOrEquals(outputs('ParentScore'),4.0),'Very good',if(greaterOrEquals(outputs('ParentScore'),3.5),'Good',if(greaterOrEquals(outputs('ParentScore'),3.0),'Meet',if(greaterOrEquals(outputs('ParentScore'),2.5),'Improvement needed','Poor'))))),'')
>          ```
>
>       13. **Compose** named `ParentCoverage`:
>
>          ```text
>          if(and(outputs('ParentHasScore'),greater(max(0.0,sub(outputs('ChildWeight'),outputs('ChildNotYetDueWeight'))),0.0)),div(outputs('ChildScoredWeight'),if(greater(max(0.0,sub(outputs('ChildWeight'),outputs('ChildNotYetDueWeight'))),0.0),max(0.0,sub(outputs('ChildWeight'),outputs('ChildNotYetDueWeight'))),1.0)),0.0)
>          ```
>
>       14. **Compose** named `ParentProvisionalShare`:
>
>          ```text
>          if(and(outputs('ParentHasScore'),greater(outputs('ChildWeight'),0.0)),div(outputs('ChildProvisionalWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),0.0)
>          ```
>
>       15. **Compose** named `ParentNotYetDueShare`:
>
>          ```text
>          if(outputs('ParentHasScore'),if(greater(outputs('ChildWeight'),0.0),div(outputs('ChildNotYetDueWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),0.0),if(or(greater(max(0.0,sub(outputs('ChildWeight'),outputs('ChildNotYetDueWeight'))),0.0),equals(outputs('ChildWeight'),0.0)),0.0,1.0))
>          ```
>
>       16. **Compose** named `ParentProratedShare`:
>
>          ```text
>          if(and(outputs('ParentHasScore'),greater(outputs('ChildWeight'),0.0)),div(outputs('ChildProratedWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),0.0)
>          ```
>
>       17. **Compose** named `OwnScoredWeight`:
>
>          ```text
>          if(greater(outputs('ChildWeight'),0.0),mul(div(outputs('ChildScoredWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),outputs('ParentWeight')),0.0)
>          ```
>
>       18. **Compose** named `OwnScoreTimesWeight`:
>
>          ```text
>          if(outputs('ParentHasScore'),mul(outputs('ParentExact'),outputs('OwnScoredWeight')),0.0)
>          ```
>
>       19. **Compose** named `OwnProvisionalWeight`:
>
>          ```text
>          if(greater(outputs('ChildWeight'),0.0),mul(div(outputs('ChildProvisionalWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),outputs('ParentWeight')),0.0)
>          ```
>
>       20. **Compose** named `OwnNotYetDueWeight`:
>
>          ```text
>          if(greater(outputs('ChildWeight'),0.0),mul(div(outputs('ChildNotYetDueWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),outputs('ParentWeight')),0.0)
>          ```
>
>       21. **Compose** named `OwnProratedWeight`:
>
>          ```text
>          if(greater(outputs('ChildWeight'),0.0),mul(div(outputs('ChildProratedWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),outputs('ParentWeight')),0.0)
>          ```
>
>       22. **Compose** named `OwnAssumedWeight`:
>
>          ```text
>          if(greater(outputs('ChildWeight'),0.0),mul(div(outputs('ChildAssumedWeight'),if(greater(outputs('ChildWeight'),0.0),outputs('ChildWeight'),1.0)),outputs('ParentWeight')),0.0)
>          ```
>
>       23. **Compose** named `ParentProvisional`:
>
>          ```text
>          and(outputs('ParentHasScore'),greater(outputs('ChildProvisionalWeight'),0.0))
>          ```
>
>       24. **Compose** named `ParentProrated`:
>
>          ```text
>          and(outputs('ParentHasScore'),greater(outputs('ChildProratedWeight'),0.0))
>          ```
>
>       25. **Compose** named `ParentAssumed`:
>
>          ```text
>          greater(outputs('OwnAssumedWeight'),0.0)
>          ```
>
>    4. **Update a row** `Save_parent_score`. **Table:** KPI scores. **Row ID:** `coalesce(first(body('Parent_existing'))?['sc_kpiscoreid'],guid())`. Fill in the columns below.

| Column | Value |
| --- | --- |
| **Name** | `concat(first(body('Find_parent_KPI'))?['sc_code'],' ',variables('Period'),' ',variables('Scenario'))` |
| **KPI** | `concat('sc_kpis(',items('Each_parent')?['parentid'],')')` |
| **Fiscal year** | `concat('sc_fiscalyears(',variables('FiscalYearId'),')')` |
| **Period** | `variables('Period')` |
| **Scenario** | `variables('Scenario')` |
| **Code** | `first(body('Find_parent_KPI'))?['sc_code']` |
| **KPI name** | `first(body('Find_parent_KPI'))?['sc_name']` |
| **Level** | `first(body('Find_parent_KPI'))?['sc_level']` |
| **Global weight** | `first(body('Find_parent_KPI'))?['sc_globalweight']` |
| **Local weight** | `outputs('ParentWeight')` |
| **Path** | `first(body('Find_parent_KPI'))?['sc_path']` |
| **Sort key** | `first(body('Find_parent_KPI'))?['sc_sortkey']` |
| **Parent id** | `coalesce(first(body('Find_parent_KPI'))?['_sc_parent_value'],'')` |
| **Is leaf** | `false` |
| **Has score** | `outputs('ParentHasScore')` |
| **Score** | `if(outputs('ParentHasScore'),outputs('ParentScore'),null)` |
| **Exact score** | `if(outputs('ParentHasScore'),outputs('ParentExact'),null)` |
| **Band** | `if(outputs('ParentHasScore'),outputs('ParentBand'),null)` |
| **Pending reason, Basis, Value used, Planned value used, Completion date used, Raw score, Deadline cap, Months late** | `null` |
| **Provisional** | `outputs('ParentProvisional')` |
| **Prorated** | `outputs('ParentProrated')` |
| **Overridden** | `false` |
| **Assumed** | `outputs('ParentAssumed')` |
| **Frozen at deadline** | `false` |
| **Total weight** | `outputs('ChildWeight')` |
| **Scored weight** | `outputs('OwnScoredWeight')` |
| **Score times weight** | `outputs('OwnScoreTimesWeight')` |
| **Provisional weight** | `outputs('OwnProvisionalWeight')` |
| **Not yet due weight** | `outputs('OwnNotYetDueWeight')` |
| **Prorated weight** | `outputs('OwnProratedWeight')` |
| **Assumed weight** | `outputs('OwnAssumedWeight')` |
| **Coverage** | `outputs('ParentCoverage')` |
| **Provisional share** | `outputs('ParentProvisionalShare')` |
| **Not yet due share** | `outputs('ParentNotYetDueShare')` |
| **Prorated share** | `outputs('ParentProratedShare')` |
| **Leaf count** | `int(coalesce(items('Each_parent')?['leaves'],0))` |
| **Scored leaf count** | `int(coalesce(items('Each_parent')?['scoredleaves'],0))` |

**Step 5: the company total.**

> **Do this:**
>
> 1. After **Each_level**, add **List rows** `Goal_totals` on **KPI scores**, with this Fetch Xml Query:
>
>    ```xml
>    <fetch aggregate="true">
>      <entity name="sc_kpiscore">
>        <attribute name="sc_localweight" alias="total" aggregate="sum" />
>        <attribute name="sc_scoredweight" alias="scored" aggregate="sum" />
>        <attribute name="sc_scoretimesweight" alias="sxw" aggregate="sum" />
>        <attribute name="sc_provisionalweight" alias="prov" aggregate="sum" />
>        <attribute name="sc_notyetdueweight" alias="nyd" aggregate="sum" />
>        <attribute name="sc_proratedweight" alias="pror" aggregate="sum" />
>        <attribute name="sc_assumedweight" alias="assumed" aggregate="sum" />
>        <attribute name="sc_leafcount" alias="leaves" aggregate="sum" />
>        <attribute name="sc_scoredleafcount" alias="scoredleaves" aggregate="sum" />
>        <filter>
>          <condition attribute="sc_fiscalyear" operator="eq" value="@{variables('FiscalYearId')}" />
>          <condition attribute="sc_period" operator="eq" value="@{variables('Period')}" />
>          <condition attribute="sc_scenario" operator="eq" value="@{variables('Scenario')}" />
>          <condition attribute="sc_level" operator="eq" value="1" />
>        </filter>
>      </entity>
>    </fetch>
>    ```
>
> 2. **List rows** `Existing_total`. **Table:** Total scores. **Filter rows:**
>
>    ```text
>    concat('_sc_fiscalyear_value eq ',variables('FiscalYearId'),' and sc_period eq ''',variables('Period'),''' and sc_scenario eq ''',variables('Scenario'),'''')
>    ```
>
> 3. These **Compose** actions:
>
>    1. **Compose** named `GoalWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['total'],0))
>       ```
>
>    2. **Compose** named `GoalScoredWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['scored'],0))
>       ```
>
>    3. **Compose** named `GoalScoreTimesWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['sxw'],0))
>       ```
>
>    4. **Compose** named `GoalProvisionalWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['prov'],0))
>       ```
>
>    5. **Compose** named `GoalNotYetDueWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['nyd'],0))
>       ```
>
>    6. **Compose** named `GoalProratedWeight`:
>
>       ```text
>       float(coalesce(first(outputs('Goal_totals')?['body/value'])?['pror'],0))
>       ```
>
>    7. **Compose** named `TotalHasScore`:
>
>       ```text
>       greater(outputs('GoalScoredWeight'),0.0)
>       ```
>
>    8. **Compose** named `TotalExact`:
>
>       ```text
>       if(outputs('TotalHasScore'),div(outputs('GoalScoreTimesWeight'),if(outputs('TotalHasScore'),outputs('GoalScoredWeight'),1.0)),-1.0)
>       ```
>
>    9. **Compose** named `TotalScore`:
>
>       ```text
>       if(outputs('TotalHasScore'),div(float(int(first(split(string(add(mul(min(max(float(outputs('TotalExact')),0.0),5.0),10.0),0.5)),'.')))),10.0),-1.0)
>       ```
>
>    10. **Compose** named `TotalBand`:
>
>       ```text
>       if(outputs('TotalHasScore'),if(greaterOrEquals(outputs('TotalScore'),4.6),'Excellent',if(greaterOrEquals(outputs('TotalScore'),4.0),'Very good',if(greaterOrEquals(outputs('TotalScore'),3.5),'Good',if(greaterOrEquals(outputs('TotalScore'),3.0),'Meet',if(greaterOrEquals(outputs('TotalScore'),2.5),'Improvement needed','Poor'))))),'')
>       ```
>
>    11. **Compose** named `TotalCoverage`:
>
>       ```text
>       if(and(outputs('TotalHasScore'),greater(max(0.0,sub(outputs('GoalWeight'),outputs('GoalNotYetDueWeight'))),0.0)),div(outputs('GoalScoredWeight'),if(greater(max(0.0,sub(outputs('GoalWeight'),outputs('GoalNotYetDueWeight'))),0.0),max(0.0,sub(outputs('GoalWeight'),outputs('GoalNotYetDueWeight'))),1.0)),0.0)
>       ```
>
>    12. **Compose** named `TotalProvisionalShare`:
>
>       ```text
>       if(and(outputs('TotalHasScore'),greater(outputs('GoalWeight'),0.0)),div(outputs('GoalProvisionalWeight'),if(greater(outputs('GoalWeight'),0.0),outputs('GoalWeight'),1.0)),0.0)
>       ```
>
>    13. **Compose** named `TotalNotYetDueShare`:
>
>       ```text
>       if(outputs('TotalHasScore'),if(greater(outputs('GoalWeight'),0.0),div(outputs('GoalNotYetDueWeight'),if(greater(outputs('GoalWeight'),0.0),outputs('GoalWeight'),1.0)),0.0),if(or(greater(max(0.0,sub(outputs('GoalWeight'),outputs('GoalNotYetDueWeight'))),0.0),equals(outputs('GoalWeight'),0.0)),0.0,1.0))
>       ```
>
>    14. **Compose** named `TotalProratedShare`:
>
>       ```text
>       if(and(outputs('TotalHasScore'),greater(outputs('GoalWeight'),0.0)),div(outputs('GoalProratedWeight'),if(greater(outputs('GoalWeight'),0.0),outputs('GoalWeight'),1.0)),0.0)
>       ```
>
> 4. **Update a row** `Save_total`. **Table:** Total scores. **Row ID:** `coalesce(first(outputs('Existing_total')?['body/value'])?['sc_totalscoreid'],guid())`. Fill in the columns below.

| Column | Value |
| --- | --- |
| **Name** | `concat('Total ',variables('Period'),' ',variables('Scenario'))` |
| **Fiscal year** | `concat('sc_fiscalyears(',variables('FiscalYearId'),')')` |
| **Period** | `variables('Period')` |
| **Scenario** | `variables('Scenario')` |
| **Has score** | `outputs('TotalHasScore')` |
| **Score** | `if(outputs('TotalHasScore'),outputs('TotalScore'),null)` |
| **Exact score** | `if(outputs('TotalHasScore'),outputs('TotalExact'),null)` |
| **Band** | `if(outputs('TotalHasScore'),outputs('TotalBand'),null)` |
| **Coverage** | `outputs('TotalCoverage')` |
| **Provisional share** | `outputs('TotalProvisionalShare')` |
| **Not yet due share** | `outputs('TotalNotYetDueShare')` |
| **Prorated share** | `outputs('TotalProratedShare')` |
| **Total weight** | `outputs('GoalWeight')` |
| **Scored weight** | `outputs('GoalScoredWeight')` |
| **Leaf count** | `int(coalesce(first(outputs('Goal_totals')?['body/value'])?['leaves'],0))` |
| **Scored leaf count** | `int(coalesce(first(outputs('Goal_totals')?['body/value'])?['scoredleaves'],0))` |

> 5. Add **Respond to a Power App or flow** with a **Text** output `Result` set to `done`. Save, then set **Run only users** (Procedure F).

**Test it.**

> **Do this:**
>
> 1. Run **S4** for the sample fiscal year first, if you haven't already.
> 2. Run **S6** with these inputs: the sample FiscalYearId, Period `2026-09`, Scenario `standard`, EstimateMode `count`, UnreportedMode `exclude`, OnlyKpiId `all`.
> 3. Open **Tables → KPI score** and compare with **Appendix C, section C.4**. Then open **Total score**: the `standard` row must match section C.5. The total is **3.5 (Good)** with coverage 88.9%.
> 4. Run it again. The number of KPI score rows must stay the same, because scores are replaced, not duplicated.
> 5. Run it with UnreportedMode `zero` and Scenario `count|zero`. New rows appear with that scenario, and the total drops to **2.8 (Improvement needed)**, because the two unscored KPIs now count as 0.
>
> **If something goes wrong:**
>
> - **Update a row** fails with *"Resource not found for the segment"*: a set name is wrong in the KPI or Fiscal year column. Check the set names (5.8).
> - **Child_totals** fails with *"Invalid FetchXML"* or *"attribute … not found"*: a logical name in the query differs from yours (5.8).
> - **Each_leaf** takes many minutes: check concurrency is on, with degree 20. A month of 150 KPIs usually takes 2 to 4 minutes.
> - Parent scores are missing although the leaves have scores: open a leaf's KPI score row and check **Parent id** and **Level** are filled in. If they're empty, run S4, then S6 again.

### 5.12 S7 Recalculate

**What it does:** whenever a flow adds a row to **Recalculation request**,
S7 picks it up. It refreshes the hierarchy if the request asks for that, then
runs S6 for every month from the request's From period up to the current
month. It runs one request at a time, so two saves made at once can't trip
over each other.

At the end, it deletes any scores saved under other scenarios for that year.
They're now out of date, and they're worked out again the next time someone
asks for them.

This flow is **automated**, not a child flow.

> **Do this:**
>
> 1. In **Solutions → KPI Scorecard**, click **+ New → Automation → Cloud flow → Automated**. Name it `S7 Recalculate`, choose the trigger **When a row is added, modified or deleted** (Microsoft Dataverse) and click **Create**.
> 2. Set the trigger's **Change type** to *Added*, **Table name** to *Recalculation requests* and **Scope** to *Organization*.
> 3. On the trigger, click **...** → **Settings**. Turn on **Concurrency control** and set **Degree of parallelism** to `1`. Requests now queue up and run one at a time.
> 4. Add **Update a row** `Mark_running`. **Table:** Recalculation requests. **Row ID:** `triggerOutputs()?['body/sc_recalculationrequestid']`. **Status:** `Running`.
> 5. Add a **Scope** (under Control) and rename it `Recalculate`. Steps 6 to 9 all go **inside** it.
> 6. **Get a row by ID** `Get_year`. **Table:** Fiscal years. **Row ID:** `triggerOutputs()?['body/_sc_fiscalyear_value']`.
> 7. **Condition** `If_year_open`: left box `empty(outputs('Get_year')?['body/sc_closedon'])`, **is equal to**, right box `true`. A closed year's scores never change, so leave its **False** side empty.
> 8. On its **True** side, add:
>    1. **Condition** `If_refresh`: left box `triggerOutputs()?['body/sc_refreshhierarchy']`, **is equal to**, right box `true`. On its True side, add **Run a Child Flow** → **S4 Refresh hierarchy**, with **FiscalYearId** set to `triggerOutputs()?['body/_sc_fiscalyear_value']`.
>    2. **Compose** `StartMonth` (April of the fiscal year): `concat(string(outputs('Get_year')?['body/sc_startyear']),'-04')`
>    3. **Select** `AllMonths`. **From:** `range(0,12)`. Map, in text mode:
>
>       ```text
>       formatDateTime(addToTime(concat(outputs('StartMonth'),'-01T00:00:00Z'),item(),'Month'),'yyyy-MM')
>       ```
>
>    4. **Compose** `FromMonth`:
>
>       ```text
>       if(empty(coalesce(triggerOutputs()?['body/sc_fromperiod'],'')),outputs('StartMonth'),triggerOutputs()?['body/sc_fromperiod'])
>       ```
>
>    5. **Compose** `ThisMonth`: `formatDateTime(convertFromUtc(utcNow(),'Singapore Standard Time'),'yyyy-MM')`
>    6. **Filter array** `MonthsToScore`. **From:** `body('AllMonths')`. Rule:
>
>       ```text
>       @and(greaterOrEquals(int(replace(item(),'-','')),int(replace(outputs('FromMonth'),'-',''))),lessOrEquals(int(replace(item(),'-','')),int(replace(outputs('ThisMonth'),'-',''))))
>       ```
>
>    7. **Apply to each** `Each_month` over `body('MonthsToScore')`, with concurrency **off**. Inside it, add **Run a Child Flow** → **S6 Score a month**:
>       - **FiscalYearId:** `triggerOutputs()?['body/_sc_fiscalyear_value']`
>       - **Period:** `items('Each_month')`
>       - **Scenario:** `standard`; **EstimateMode:** `count`; **UnreportedMode:** `exclude`
>       - **OnlyKpiId:**
>
>         ```text
>         if(empty(coalesce(triggerOutputs()?['body/sc_kpiid'],'')),'all',triggerOutputs()?['body/sc_kpiid'])
>         ```
>
> 9. Still on the True side, after **Each_month**, clear out the old scenario scores:
>    1. **List rows** `Old_scenario_scores`. **Table:** KPI scores. **Select columns:** `sc_kpiscoreid`. Turn on pagination. **Filter rows:**
>
>       ```text
>       concat('_sc_fiscalyear_value eq ',triggerOutputs()?['body/_sc_fiscalyear_value'],' and sc_scenario ne ''standard''')
>       ```
>
>    2. **Apply to each** `Each_old_score` over `outputs('Old_scenario_scores')?['body/value']`, with concurrency `20`. Inside it, add **Delete a row**: **Table** KPI scores, **Row ID** `items('Each_old_score')?['sc_kpiscoreid']`.
>    3. Repeat for the totals. Add **List rows** `Old_scenario_totals` on **Total scores** with the same filter and select column `sc_totalscoreid`. Then add **Apply to each** `Each_old_total` containing **Delete a row** on Total scores, Row ID `items('Each_old_total')?['sc_totalscoreid']`.
> 10. Below the **Recalculate** scope, add **Update a row** `Mark_done`: **Table** Recalculation requests, the same Row ID as Mark_running, **Status** `Done`.
> 11. Now add a second ending for failures. Hover over the arrow between **Recalculate** and **Mark_done**, click **+ → Add a parallel branch**, and add **Update a row** `Mark_failed`, set the same way but with **Status** `Failed`.
> 12. On **Mark_failed**, click **...** → **Configure run after** (in the new designer: **Settings → Run after**). Untick **is successful**, tick **has failed** and **has timed out**, and click **Done**.
> 13. Save.

**Test it.**

> **Do this:**
>
> 1. Open **Tables → Recalculation request → Edit → + New row**. Pick the sample fiscal year, leave **From period** and **KPI id** empty, set **Refresh hierarchy** to **Yes**, and save.
> 2. Open S7's **run history**. A run starts within a minute and takes a few minutes.
>
> **Check it worked:** when the run finishes, the request's **Status** is **Done**, and **KPI score** holds `standard` scores for every KPI for every month from April up to the current month.
>
> **If something goes wrong:** if the status says **Failed**, open the failed run in the run history and click into the **Recalculate** scope. The step with the red mark says what went wrong. Most often, it's a child flow that's missing its **Run only users** setting.

### 5.13 Test the whole engine

Run this once S7 works, and again whenever you change a scoring flow.

> **Do this:**
>
> 1. Add a Recalculation request for the sample year (whole year, Refresh hierarchy **Yes**) and wait for **Done**.
> 2. Open **Tables → KPI score**, filter on **Period** = `2026-09` and **Scenario** = `standard`, and sort by **Sort key**. Compare every row with **Appendix C, section C.4**, then compare the 2026-09 **Total score** with section C.5.
> 3. Now change one figure. In **KPI value**, edit KPI `1.1.1`'s row for 2026-09 from `85` to `95`. Then add a Recalculation request with **From period** `2026-09`, **KPI id** set to KPI 1.1.1's id and **Refresh hierarchy** No.
>
> **Check it worked:** when the request is done, these are the 2026-09 scores:
>
> | KPI | Before | After |
> | --- | --- | --- |
> | 1.1.1 Revenue growth | 3.4 | 4.5 |
> | 1.1 Revenue | 3.7 | 4.5 |
> | 1 Grow the business | 3.5 | 3.8 |
> | Company total | 3.5 | 3.7 |
>
> Change the figure back to 85 and add the same request again. The scores return to the **Before** column.

If every row matches, the scoring engine is finished. The rest of the guide
never touches these flows again. Everything else just adds Recalculation
requests and reads the KPI score and Total score tables.

---

## Part 6. Build the action flows

Every change anyone makes, whether entering a figure, approving a user or
closing a year, goes through a flow in this part. The app and the agent never
write to a table themselves.

### 6.1 How the action flows fit together

Each action is built in two layers:

1. **A core flow** does the real work. It is a child flow (Procedure F) whose
   first input is always **CallerEmail**, the work email of the person asking.
   It checks that person's permission, makes the change, adds a
   Recalculation request if scores need updating, and replies with three
   outputs:

   | Output | Type | Holds |
   | --- | --- | --- |
   | `Ok` | Yes/No | Yes if everything worked |
   | `Message` | Text | A sentence to show the person, such as "Saved 3 figure(s)." or the reason it was refused |
   | `Data` | Text | Anything else the caller needs, as JSON text. Often empty |

2. **A thin wrapper** connects the core flow to the app or the agent. The
   wrapper's only jobs are to find out **who** is asking, in a way that can't
   be faked, and pass the answer on:

   - **App wrappers** (built in this part) start with the Power Apps trigger, which tells the flow the signed-in person's email.
   - **Agent wrappers** (built in Part 8) start with the Copilot Studio trigger and receive the person's email from the agent.

```text
  Scorecard app  ──►  AppSaveFigures   ──┐
                                             ├──►  A01 Save figures  ──►  tables
  Scorecard agent ──► AgentSaveFigures ──┘          │
                                                       └──►  A00 Check permission
```

This way each rule is written once, in the core flow, and the app and the
agent can never disagree about what's allowed.

**Names.** Core flows are numbered `A00`, `A01` and so on. Wrappers are
named after the core flow they call, with no spaces, starting `App` or `Agent`: for example `AppSaveFigures`. Names without spaces are easier to type in the app's formulas.

**Which flows to build.** Steps 6.2 to 6.5 build the first two core flows and
the first wrapper click by click, with tests. They teach you everything the
rest need. Steps 6.6 onwards give each remaining flow as a Copilot prompt,
with a list of what to check. You can build those as you reach the screens
that need them in Part 7: each screen in Part 7 lists the flows it calls.

### 6.2 A00 Check permission

**What it does:** given a person's email and what they want to do, it says
whether they may, and if not, why. Every other core flow calls it first.

It understands three levels of need:

| Need | Who passes |
| --- | --- |
| `signed-in` | Anyone with an **Approved** App user row |
| `member-write` | Admins, and Members whose department owns the KPI given in **KpiId** |
| `admin` | Admins only |

> **Do this:**
>
> 1. Create a child flow called `A00 Check permission` (Procedure F) with three **Text** inputs: `CallerEmail`, `Need` and `KpiId`.
> 2. Add three **Initialize variable** actions, type **String**, named `CallerEmail`, `Need` and `KpiId`, each set to the input of the same name from **Dynamic content**.
> 3. Add a Dataverse **List rows** action and rename it `Find_user` (Procedure G). **Table name:** App users. Click **Show all**, then:
>    - **Select columns:** `sc_appuserid,sc_username,sc_email,sc_companyidnumber,_sc_department_value,sc_role,sc_status`
>    - **Filter rows** (Procedure H). It finds the App user row with this email. The `replace` part stops a name like O'Neil from breaking the filter:
>
>      ```text
>      concat('sc_email eq ''',replace(variables('CallerEmail'),'''',''''''),'''')
>      ```
>
>    - **Row count:** `1`
> 4. Add these **Compose** actions, in this order:
>    1. `User`, the person's row, or an empty record if there isn't one:
>
>       ```text
>       coalesce(first(outputs('Find_user')?['body/value']),json('{}'))
>       ```
>
>    2. `Status`: `coalesce(outputs('User')?['sc_status@OData.Community.Display.V1.FormattedValue'],'')`
>    3. `IsAdmin`:
>
>       ```text
>       and(equals(outputs('Status'),'Approved'),equals(outputs('User')?['sc_role@OData.Community.Display.V1.FormattedValue'],'Admin'))
>       ```
>
> 5. Add a **List rows** action named `Owns_KPI`. It asks "does a department link join this KPI to the person's department?". **Table name:** KPIs. Click **Show all** and paste this into **Fetch Xml Query**:
>
>    ```xml
>    <fetch top="1">
>      <entity name="sc_kpi">
>        <attribute name="sc_kpiid" />
>        <filter>
>          <condition attribute="sc_kpiid" operator="eq" value="@{if(equals(variables('KpiId'),'none'),'00000000-0000-0000-0000-000000000000',variables('KpiId'))}" />
>        </filter>
>        <link-entity name="sc_kpi_sc_department" from="sc_kpiid" to="sc_kpiid" intersect="true">
>          <filter>
>            <condition attribute="sc_departmentid" operator="eq" value="@{coalesce(outputs('User')?['_sc_department_value'],'00000000-0000-0000-0000-000000000000')}" />
>          </filter>
>        </link-entity>
>      </entity>
>    </fetch>
>    ```
>
>    `sc_kpi_sc_department` is the hidden table behind the KPI–Department relationship from Table 7. To check its name, open **Tables → KPI → Relationships**, open the many-to-many relationship and look at **Relationship entity name** (sometimes called the intersect table). If yours is different, change the name in the query. When there's no KPI to check, the formula uses an id of all zeros, which matches nothing.
> 6. Add these **Compose** actions:
>    1. `Owns`: `greater(length(outputs('Owns_KPI')?['body/value']),0)`
>    2. `Allowed`:
>
>       ```text
>       and(equals(outputs('Status'),'Approved'),or(equals(variables('Need'),'signed-in'),outputs('IsAdmin'),and(equals(variables('Need'),'member-write'),outputs('Owns'))))
>       ```
>
>    3. `Message`, the reason when the answer is no:
>
>       ```text
>       if(outputs('Allowed'),'',if(empty(outputs('User')?['sc_email']),'You aren''t registered for the KPI Scorecard yet. Open the Scorecard app to register.',if(not(equals(outputs('Status'),'Approved')),'Your registration is waiting for an admin to approve it.',if(equals(variables('Need'),'admin'),'Only admins can do this.','You can only change KPIs that your own department owns.'))))
>       ```
>
> 7. Add **Respond to a Power App or flow** with these outputs:
>
>    | Output | Type | Value |
>    | --- | --- | --- |
>    | `Allowed` | Yes/No | `outputs('Allowed')` |
>    | `Message` | Text | `outputs('Message')` |
>    | `IsAdmin` | Yes/No | `outputs('IsAdmin')` |
>    | `UserId` | Text | `coalesce(outputs('User')?['sc_appuserid'],'')` |
>    | `Username` | Text | `coalesce(outputs('User')?['sc_username'],'')` |
>    | `CompanyId` | Text | `coalesce(outputs('User')?['sc_companyidnumber'],'')` |
>    | `DepartmentId` | Text | `coalesce(outputs('User')?['_sc_department_value'],'')` |
>
> 8. Save, then set **Run only users** (Procedure F).

**Test it** (Procedure I). First add two App user rows by hand if you
haven't yet (Appendix C, section C.1 lists them): yourself as an **Admin**,
and a colleague, or a made-up email, as a **Member** of the Sales department.

| CallerEmail | Need | KpiId | Expected Allowed | Expected Message |
| --- | --- | --- | --- | --- |
| `nobody@example.com` | `signed-in` | `none` | No | You aren't registered for the KPI Scorecard yet. … |
| your email | `admin` | `none` | Yes | (empty) |
| the Member's email | `admin` | `none` | No | Only admins can do this. |
| the Member's email | `member-write` | id of KPI 1.2 | Yes | (empty) |
| the Member's email | `member-write` | id of KPI 2.1 | No | You can only change KPIs that your own department owns. |

Then change the Member's **Status** to **Pending** and run the fourth row
again: it must now say *Your registration is waiting for an admin to approve
it.* Set the status back to **Approved** afterwards.

> **If something goes wrong:**
>
> - **Owns_KPI** fails with *"entity sc_kpi_sc_department doesn't exist"*: the relationship table has a different name (see step 5).
> - Everyone is refused with "You aren't registered": compare the email in the App user row with the one you typed. Spaces at either end count.
> - **Status** is always empty: the List rows action may have a **Select columns** list missing `sc_status`. The `@OData.Community.Display.V1.FormattedValue` part, which reads a choice's label, only comes back for columns that are selected.

### 6.3 Procedure J: build a core action flow

Every core flow from here on starts and ends the same way.

> **Do this:**
>
> 1. Create a child flow (Procedure F) with the name the guide gives. Its first input is always **Text** `CallerEmail`; then add the inputs the guide lists.
> 2. Add **Run a Child Flow**, pick **A00 Check permission** and rename the action `Check`. Fill in:
>    - **CallerEmail:** the CallerEmail input
>    - **Need:** `signed-in`, `member-write` or `admin`, as the guide says
>    - **KpiId:** the KPI the flow changes, or `none`
> 3. Add a **Condition** named `If_allowed`: left box `body('Check')?['allowed']`, **is equal to**, right box `true`.
> 4. On the **False** side, add **Respond to a Power App or flow** with:
>    - **Yes/No** `Ok`: `false`
>    - **Text** `Message`: `body('Check')?['message']`
>    - **Text** `Data`: leave empty
> 5. Build the flow's own steps on the **True** side, ending with another **Respond to a Power App or flow** with the same three outputs, `Ok`, `Message` and `Data`.
> 6. Save and set **Run only users** (Procedure F).

**Who made the change.** Flows that write a history row or an "Author" column
use `body('Check')?['username']`, and `body('Check')?['companyid']` for the
company ID. For lookups to the App user table, use
`concat('sc_appusers(',body('Check')?['userid'],')')`. If your App user
table's set name differs (5.8), change `sc_appusers` to match.

**Closed years.** Most flows must refuse to change a closed year. Each prompt
below says so where it applies. The message is always the web app's:
*"FY2026/27 is closed. Ask an admin to reopen it before recording changes."*

### 6.4 A01 Save figures

**What it does:** saves one or more monthly figures. It's called by the Enter
Data screen, the KPI page and the agent. It checks every figure separately,
so one bad figure doesn't stop the rest. For each figure it:

1. checks the person may report on that KPI;
2. checks the month is valid, inside the KPI's fiscal year, and that the year is open;
3. for a completion date recorded as **Actual**, checks the date isn't after the month being reported on;
4. writes one **KPI value change** row for every field that changed;
5. saves the figure, or deletes the row if every field was cleared.

Finally, it adds one Recalculation request covering everything it saved.

**Input format.** Besides CallerEmail, A01 has one **Text** input,
`EntriesJson`: a list of figures written as JSON. The app and the agent build
it for you; you only type one by hand when testing. Each figure looks like
this:

```json
{"kpiId": "…", "period": "2026-09", "value": 85, "plannedValue": null, "basis": "Actual", "completionDate": null, "note": "Up on last month"}
```

`basis` is `Actual` or `Estimate`. `completionDate` is a date written
`2026-11-01`, for Month completion KPIs only. `plannedValue` is for Variance
KPIs only. Use `null` for anything not given.

> **Do this:**
>
> 1. Create a child flow called `A01 Save figures` (Procedure F) with two **Text** inputs: `CallerEmail` and `EntriesJson`.
> 2. Add three **Initialize variable** actions:
>
>    | Name | Type | Value |
>    | --- | --- | --- |
>    | Entries | Array | `json(` EntriesJson `)` |
>    | Saved | Array | `createArray()` |
>    | Failed | Array | `createArray()` |
>
> 3. Add **Apply to each** named `Each_entry` over `variables('Entries')`. Leave its concurrency **off**. Steps 4 to 8 all go **inside** it.
> 4. Add **Run a Child Flow** → **A00 Check permission**, renamed `Check`:
>    - **CallerEmail:** the CallerEmail input
>    - **Need:** `member-write`
>    - **KpiId:** `items('Each_entry')?['kpiId']`
> 5. Add two Dataverse **Get a row by ID** actions:
>    1. `Get_kpi`. **Table name:** KPIs. **Row ID:** `items('Each_entry')?['kpiId']`. **Select columns:** `sc_code,_sc_fiscalyear_value`
>    2. `Get_year`. **Table name:** Fiscal years. **Row ID:** `outputs('Get_kpi')?['body/_sc_fiscalyear_value']`. **Select columns:** `sc_startyear,sc_closedon,sc_label`
> 6. Add these **Compose** actions, in order. Together they work out whether anything is wrong with this figure:
>    1. `PeriodOk`, which checks the month is written `YYYY-MM` with a real month number:
>
>       ```text
>       and(equals(length(coalesce(items('Each_entry')?['period'],'')),7),equals(substring(concat(coalesce(items('Each_entry')?['period'],''),'0000000'),4,1),'-'),contains(createArray('01','02','03','04','05','06','07','08','09','10','11','12'),substring(concat(coalesce(items('Each_entry')?['period'],''),'0000000'),5,2)))
>       ```
>
>    2. `StartMonth`: `concat(string(outputs('Get_year')?['body/sc_startyear']),'-04')`
>    3. `EndMonth`: `concat(string(add(outputs('Get_year')?['body/sc_startyear'],1)),'-03')`
>    4. `InYear`:
>
>       ```text
>       and(greaterOrEquals(coalesce(items('Each_entry')?['period'],''),outputs('StartMonth')),lessOrEquals(coalesce(items('Each_entry')?['period'],''),outputs('EndMonth')))
>       ```
>
>    5. `CompletionDay`: `take(coalesce(items('Each_entry')?['completionDate'],''),10)`
>    6. `TooLate`, which is true when an Actual completion date falls after the reported month:
>
>       ```text
>       and(not(equals(items('Each_entry')?['basis'],'Estimate')),not(empty(outputs('CompletionDay'))),greater(outputs('CompletionDay'),formatDateTime(addDays(addToTime(concat(if(outputs('PeriodOk'),coalesce(items('Each_entry')?['period'],''),'2000-01'),'-01T00:00:00Z'),1,'Month'),-1),'yyyy-MM-dd')))
>       ```
>
>    7. `Problem`, the first thing wrong with the figure, or empty if nothing is:
>
>       ```text
>       if(not(body('Check')?['allowed']),body('Check')?['message'],if(not(outputs('PeriodOk')),concat('"',coalesce(items('Each_entry')?['period'],''),'" is not a valid month.'),if(not(outputs('InYear')),concat(coalesce(items('Each_entry')?['period'],''),' is outside the fiscal year this KPI belongs to.'),if(not(empty(outputs('Get_year')?['body/sc_closedon'])),concat(outputs('Get_year')?['body/sc_label'],' is closed. Ask an admin to reopen it before recording changes.'),if(outputs('TooLate'),concat(outputs('CompletionDay'),' is after ',coalesce(items('Each_entry')?['period'],''),', the month being reported on. Record it against the month it was completed in.'),'')))))
>       ```
>
> 7. Add a **Condition** named `If_ok`: left box `empty(outputs('Problem'))`, **is equal to**, right box `true`.
>    - On the **False** side, add **Append to array variable**: **Name** Failed, **Value**:
>
>      ```text
>      concat(coalesce(outputs('Get_kpi')?['body/sc_code'],items('Each_entry')?['kpiId']),' ',coalesce(items('Each_entry')?['period'],''),': ',outputs('Problem'))
>      ```
>
> 8. On the **True** side of **If_ok**, add:
>    1. **List rows** `Existing_value`. **Table name:** KPI values. **Row count:** `1`. **Filter rows:**
>
>       ```text
>       concat('_sc_kpi_value eq ',items('Each_entry')?['kpiId'],' and sc_period eq ''',coalesce(items('Each_entry')?['period'],''),'''')
>       ```
>
>    2. **Compose** `Old`, the figure as it was, or an empty record if this is a new one:
>
>       ```text
>       coalesce(first(outputs('Existing_value')?['body/value']),json('{}'))
>       ```
>
>    3. **Compose** `Fields`. It lists the five fields, each with its old and new value written the same way, so they can be compared:
>
>       ```text
>       createArray(addProperty(addProperty(addProperty(json('{}'),'field','value'),'from',if(equals(outputs('Old')?['sc_value'],null),'',string(float(coalesce(outputs('Old')?['sc_value'],0))))),'to',if(equals(items('Each_entry')?['value'],null),'',string(float(coalesce(items('Each_entry')?['value'],0))))),addProperty(addProperty(addProperty(json('{}'),'field','plannedValue'),'from',if(equals(outputs('Old')?['sc_plannedvalue'],null),'',string(float(coalesce(outputs('Old')?['sc_plannedvalue'],0))))),'to',if(equals(items('Each_entry')?['plannedValue'],null),'',string(float(coalesce(items('Each_entry')?['plannedValue'],0))))),addProperty(addProperty(addProperty(json('{}'),'field','basis'),'from',coalesce(outputs('Old')?['sc_basis@OData.Community.Display.V1.FormattedValue'],'Actual')),'to',if(equals(items('Each_entry')?['basis'],'Estimate'),'Estimate','Actual')),addProperty(addProperty(addProperty(json('{}'),'field','completionDate'),'from',take(coalesce(outputs('Old')?['sc_completiondate'],''),10)),'to',outputs('CompletionDay')),addProperty(addProperty(addProperty(json('{}'),'field','note'),'from',coalesce(outputs('Old')?['sc_note'],'')),'to',trim(coalesce(items('Each_entry')?['note'],''))))
>       ```
>
>    4. **Filter array** `Changed`. **From:** `outputs('Fields')`. Rule: `@not(equals(item()?['from'],item()?['to']))`
>    5. **Compose** `IsEmptyNow`, true when every field has been cleared:
>
>       ```text
>       and(equals(if(equals(items('Each_entry')?['value'],null),'',string(float(coalesce(items('Each_entry')?['value'],0)))),''),equals(if(equals(items('Each_entry')?['plannedValue'],null),'',string(float(coalesce(items('Each_entry')?['plannedValue'],0)))),''),empty(outputs('CompletionDay')),empty(trim(coalesce(items('Each_entry')?['note'],''))))
>       ```
>
>    6. **Compose** `Action`: `if(outputs('IsEmptyNow'),if(empty(coalesce(outputs('Old')?['sc_kpivalueid'],'')),'none','delete'),'save')`. It says `save`, `delete`, or `none` when there's nothing to do.
>    7. **Condition** `If_write`: left box `and(greater(length(body('Changed')),0),not(equals(outputs('Action'),'none')))`, **is equal to**, right box `true`. Steps 8 to 10 go on its **True** side; leave its False side empty.
>    8. **Switch** named `Save_or_delete`, **On:** `outputs('Action')`.
>       - **Case** `delete`: add **Delete a row**. **Table name:** KPI values. **Row ID:** `outputs('Old')?['sc_kpivalueid']`.
>       - **Case** `save`: add **Update a row**, renamed `Save_value`. **Table name:** KPI values. **Row ID:** `coalesce(outputs('Old')?['sc_kpivalueid'],guid())`. Click **Show all** and fill in:
>
>         | Column | Value |
>         | --- | --- |
>         | **Name** | `concat(outputs('Get_kpi')?['body/sc_code'],' ',coalesce(items('Each_entry')?['period'],''))` |
>         | **KPI (KPIs)** | `concat('sc_kpis(',items('Each_entry')?['kpiId'],')')` |
>         | **Fiscal year (Fiscal years)** | `concat('sc_fiscalyears(',outputs('Get_kpi')?['body/_sc_fiscalyear_value'],')')` |
>         | **Period** | `coalesce(items('Each_entry')?['period'],'')` |
>         | **Value** | `if(equals(if(equals(items('Each_entry')?['value'],null),'',string(float(coalesce(items('Each_entry')?['value'],0)))),''),null,float(coalesce(items('Each_entry')?['value'],0)))` |
>         | **Basis** | `if(equals(items('Each_entry')?['basis'],'Estimate'),100000001,100000000)` |
>         | **Planned value** | `if(equals(if(equals(items('Each_entry')?['plannedValue'],null),'',string(float(coalesce(items('Each_entry')?['plannedValue'],0)))),''),null,float(coalesce(items('Each_entry')?['plannedValue'],0)))` |
>         | **Completion date** | `if(empty(outputs('CompletionDay')),null,outputs('CompletionDay'))` |
>         | **Note** | `if(empty(trim(coalesce(items('Each_entry')?['note'],''))),null,trim(coalesce(items('Each_entry')?['note'],'')))` |
>
>         `100000000` and `100000001` are the numbers behind **Actual** and **Estimate** in the Value basis choice (3.7). Use yours if they differ. As in Part 5, **Update a row** creates the row when the Row ID doesn't exist yet.
>    9. After the Switch, add **Apply to each** `Each_change` over `body('Changed')`. Inside it, add **Add a new row**. **Table name:** KPI value changes. Fill in:
>
>       | Column | Value |
>       | --- | --- |
>       | **KPI (KPIs)** | `concat('sc_kpis(',items('Each_entry')?['kpiId'],')')` |
>       | **Period** | `coalesce(items('Each_entry')?['period'],'')` |
>       | **Field** | `items('Each_change')?['field']` |
>       | **From** | `items('Each_change')?['from']` |
>       | **To** | `items('Each_change')?['to']` |
>       | **Author username** | `body('Check')?['username']` |
>       | **Author company ID** | `body('Check')?['companyid']` |
>
>    10. After **Each_change**, add **Append to array variable**: **Name** Saved, **Value**:
>
>        ```text
>        addProperty(addProperty(addProperty(json('{}'),'kpiId',items('Each_entry')?['kpiId']),'period',coalesce(items('Each_entry')?['period'],'')),'yearId',outputs('Get_kpi')?['body/_sc_fiscalyear_value'])
>        ```
>
> 9. **After** the **Each_entry** loop (outside it), add a **Condition** `If_any_saved`: left box `length(variables('Saved'))`, **is greater than**, right box `0`. On its **True** side, add:
>    1. **Select** `SavedNums`. **From:** `variables('Saved')`. Switch the Map to text mode and paste: `int(replace(item()?['period'],'-',''))`
>    2. **Select** `SavedKpis`. **From:** `variables('Saved')`. Map, in text mode: `item()?['kpiId']`
>    3. **Compose** `FromPeriod`, the earliest month saved:
>
>       ```text
>       concat(substring(string(min(body('SavedNums'))),0,4),'-',substring(string(min(body('SavedNums'))),4,2))
>       ```
>
>    4. **Compose** `OneKpi`, the KPI's id when every figure was for the same KPI, otherwise empty:
>
>       ```text
>       if(equals(length(union(body('SavedKpis'),body('SavedKpis'))),1),first(body('SavedKpis')),'')
>       ```
>
>    5. **Add a new row**. **Table name:** Recalculation requests. Fill in:
>       - **Name:** `concat('Figures saved from ',outputs('FromPeriod'))`
>       - **Fiscal year (Fiscal years):** `concat('sc_fiscalyears(',first(variables('Saved'))?['yearId'],')')`
>       - **From period:** `outputs('FromPeriod')`
>       - **KPI id:** `outputs('OneKpi')`
>       - **Refresh hierarchy:** No
>       - **Status:** `Waiting`
> 10. After **If_any_saved**, add **Respond to a Power App or flow**:
>
>     | Output | Type | Value |
>     | --- | --- | --- |
>     | `Ok` | Yes/No | `empty(variables('Failed'))` |
>     | `Message` | Text | `concat('Saved ',string(length(variables('Saved'))),' figure(s).',if(empty(variables('Failed')),'',concat(' Not saved: ',join(variables('Failed'),'; '))))` |
>     | `Data` | Text | `string(variables('Saved'))` |
>
> 11. Save and set **Run only users** (Procedure F).

A01 doesn't follow Procedure J exactly, because it checks permission once per
figure rather than once for the whole flow. Everything else in this part
does follow it.

**Test it** (Procedure I), using the sample data and your own email as
CallerEmail. Replace `K111` below with the id of KPI 1.1.1.

| Test | EntriesJson | Expected |
| --- | --- | --- |
| 1. Change a figure | `[{"kpiId":"K111","period":"2026-09","value":95,"basis":"Actual"}]` | Ok **Yes**, "Saved 1 figure(s)." One new **KPI value change** row: field `value`, from `85` to `95`. A new Recalculation request with From period `2026-09` and KPI id K111 |
| 2. Same figure again | the same as test 1 | Ok **Yes**, "Saved 0 figure(s)." No new change row and no new request, because nothing changed |
| 3. Bad month | `[{"kpiId":"K111","period":"2026-13","value":1}]` | Ok **No**. The message ends `"2026-13" is not a valid month.` |
| 4. Outside the year | `[{"kpiId":"K111","period":"2027-04","value":1}]` | Ok **No**, "… 2027-04 is outside the fiscal year this KPI belongs to." |
| 5. Completion too late | use KPI 2.3's id: `[{"kpiId":"K23","period":"2026-10","completionDate":"2026-11-01","basis":"Actual"}]` | Ok **No**, "… 2026-11-01 is after 2026-10, the month being reported on. Record it against the month it was completed in." |
| 6. Clear it | `[{"kpiId":"K111","period":"2026-09","value":null,"basis":"Actual"}]` | Ok **Yes**. KPI 1.1.1's 2026-09 row is **deleted**, and a change row says `value` from `95` to empty |
| 7. Put it back | `[{"kpiId":"K111","period":"2026-09","value":85,"basis":"Actual"}]` | Ok **Yes**. The row is back with 85 |
| 8. Someone else's KPI | as test 7, but with the Sales Member's email and KPI 2.1's id | Ok **No**, "… You can only change KPIs that your own department owns." |

After test 7, wait for the Recalculation requests to finish (**Status**
**Done**). The 2026-09 scores should be back to Appendix C, section C.4.

> **If something goes wrong:**
>
> - **Save_value** fails with *"Resource not found for the segment"*: check the set names in the KPI and Fiscal year columns (5.8).
> - Test 2 saves again, with a change row from `85` to `85`: the **Fields** formula was pasted as text rather than with **fx**, so the numbers weren't normalised.
> - Test 6 fails on **Delete a row**: check the **Action** compose is above the Switch and the Switch's **On** box holds `outputs('Action')`.
> - Each figure takes a few seconds, because each one runs the permission check. That's expected; 50 figures take about a minute.

### 6.5 Procedure K: build an app wrapper

The app can't call a child flow directly, so each core flow the app uses
gets a small wrapper. Build **AppSaveFigures** now; the others follow the
same pattern when Part 7 asks for them.

> **Do this:**
>
> 1. In **Solutions → KPI Scorecard**, click **+ New → Automation → Cloud flow → Instant**.
> 2. Name it `AppSaveFigures` (no spaces). Choose the trigger **When Power Apps calls a flow (V2)** and click **Create**.
> 3. On the trigger, add the same inputs as the core flow **except CallerEmail**, with the same names and types. For Save figures, that's one **Text** input, `EntriesJson`.
> 4. Add **Run a Child Flow**, pick **A01 Save figures** and rename the action `Core`. Fill in:
>    - **CallerEmail:** `triggerOutputs()?['headers']?['x-ms-user-email']`. This is the email of the person signed in to the app. Power Apps adds it to every call, and the app itself can't change it.
>    - **EntriesJson:** the trigger's EntriesJson input from Dynamic content.
> 5. Add **Respond to a PowerApp or flow** with three outputs:
>    - **Yes/No** `Ok`: `body('Core')?['ok']`
>    - **Text** `Message`: `body('Core')?['message']`
>    - **Text** `Data`: `body('Core')?['data']`
> 6. Save. Open the flow's details page and, under **Run only users**, set every connection to the service account's connection, as in Procedure F.
>
> **Check it worked:** run it with **Test → Manually**, pasting test 7's EntriesJson from 6.4. It returns Ok **Yes**. (In a manual test the email header is yours.)
>
> **If something goes wrong:** if it says you aren't registered although you are, your App user **Email** may differ from your sign-in name. Check the email in the trigger's outputs in the run history: open the run, click the trigger and look under **Headers** for `x-ms-user-email`. Use that exact address in your App user row.

### 6.6 How to build the remaining flows with Copilot

The remaining core flows are given as prompts. For each one:

> **Do this:**
>
> 1. Create the child flow by hand with Procedure F and its inputs, then add the permission check from Procedure J, steps 2 to 4. Doing this part by hand is quicker than correcting Copilot's version.
> 2. Click **Copilot** (top right of the designer) and paste the flow's prompt. Copilot adds the steps on the **True** side of **If_allowed**.
> 3. Compare what it built with the **Check it worked** list under the prompt. Fix anything wrong by asking Copilot in plain English, or by hand.
> 4. Add the final **Respond to a Power App or flow** (Procedure J, step 5) if Copilot didn't.
> 5. Run the flow's tests.
>
> **If Copilot does something odd:** it sometimes uses the wrong table or forgets a step. Undo with **Ctrl+Z**, or delete the actions it added, and paste the prompt again in smaller pieces, one paragraph at a time.

Every prompt starts with the same paragraph, so Copilot knows the ground
rules. Paste it in front of each prompt:

```text
This child flow is part of the KPI Scorecard solution. All tables use the publisher prefix sc_.
The permission check is already built: the action "Check" (a child flow) returns username,
companyid, userid, departmentid and isadmin. Build on the True side of the condition "If_allowed".
Use the Microsoft Dataverse connector for every table. Use "Update a row" with a new guid() as
the Row ID when creating a row whose id you need afterwards. End with "Respond to a Power App or
flow" with three outputs: Ok (Yes/No), Message (Text) and Data (Text). On any refusal, respond
straight away with Ok = false and the message given, and stop.
```

Below, **"Add a recalculation request"** means: add a row to
**Recalculation requests** with the Fiscal year, From period, KPI id and
Refresh hierarchy given, and Status `Waiting`. The scores update a few
minutes later.

### 6.7 KPI settings, proposals and updates

#### A02 Save KPI settings

**Inputs:** CallerEmail, KpiId, SettingsJson. **Need:** `admin`, KpiId the KPI.
**Called by:** the KPI page (7.6), the Hierarchy screen (7.13), A04.

SettingsJson holds every setting the KPI page shows: `name`, `code`,
`weight`, `subGroup`, `status`, `unit`, `metricType`, `direction`,
`targetMode`, `targetConfig` (as text), `deadlineMonth`,
`scoreFinalAfterDeadline`, `completed`, `completedPeriod`, `frequency`,
`phasing`, `phaseShares` (as text), `departmentIds` (a list) and
`clearFigures` (yes/no).

```text
Get the KPI by KpiId with its fiscal year. Refuse with "That KPI no longer exists." if missing, and with
"<label> is closed. Ask an admin to reopen it before recording changes." if the year's Closed on is set.
Parse SettingsJson. Check, in this order, refusing with the message in quotes:
- name not blank: "A KPI needs a name."; code not blank: "A KPI needs a code."
- weight is 0 or more: "Weight must be zero or more."
- deadlineMonth empty or YYYY-MM: "A deadline must be a month in YYYY-MM form."
- completedPeriod empty or YYYY-MM: "A completion period must be a month in YYYY-MM form."
- completed needs completedPeriod: "Marking a KPI complete needs the period it was completed in."
- only a leaf (Is leaf = Yes) may be completed: "Only a leaf KPI (one with no sub-KPIs) can be marked complete."
- a completed KPI that is not Month completion needs an Actual KPI value with a value at or before
  completedPeriod: "This KPI has no actual figure on record yet to freeze — report one first, then mark it complete."
- if the code changed, no other KPI in the same year has it: "Code "<code>" is already used by "<name>" in this year."
- a KPI with sub-KPIs must have no metricType: ""<name>" has sub-KPIs, so it cannot carry its own metric."
- if metricType changes between Month completion and any other type, and the KPI has KPI value rows with a
  Value or Completion date, refuse unless clearFigures is true, with: "<months> have figures recorded against
  this KPI. They cannot be read the new way — tick "Clear these figures" to change the metric anyway."
  If clearFigures is true, delete those KPI value rows.
- targets: for Fixed, all six numbers present and strictly harder from Poor to Excellent (rising when Higher
  is better, falling when Lower is better); for Range, each band has two numbers. Month completion needs a
  targetMonth inside the KPI's fiscal year. Variance KPIs always use Range targets with Lower is better.
- phasing is forced to None for Month completion and Variance KPIs. For Custom phasing, phaseShares must be
  12 numbers, each 0 to 100, totalling 100.
For every setting that changed, add a "KPI definition change" row (KPI, Field, Label, From, To, Author =
Check username) using these fields and labels: name "Name", code "Code", weight "Weight % (of group)",
subGroup "Sub-group", status "Status", unit "Unit", deadlineMonth "Deadline month", completed "Mark complete",
frequency "Reporting frequency", phasing "Phasing", targets "Metric and targets", departments "Owning
departments". Write months as "Oct 2026", empty values as "none", and departments as their NAMES sorted
alphabetically and joined with ", " (never as ids).
Update the KPI row with the new settings and set Settings changed on to utcNow(). Make the KPI's
departments match departmentIds: relate the new ones and unrelate the removed ones.
If anything changed, add a recalculation request: the KPI's fiscal year, From period empty, KPI id empty,
and Refresh hierarchy Yes if the weight or code changed, otherwise KPI id = KpiId and Refresh hierarchy No.
Respond Ok = true and Message "Saved <n> change(s) to <code>." (or "Nothing to save." if none).
```

> **Check it worked:**
>
> - The checks run before anything is written. Look for a **Terminate** or early **Respond** in each refusal branch.
> - Department changes use **Relate rows** and **Unrelate rows** actions (Dataverse), with the relationship from Table 7.
> - One KPI definition change row per changed setting, with names, not ids, for departments.
>
> **Test it:** change KPI 1.2's Meet target from 120 to 110 using your own email: one change row, label **Metric and targets**. Then try setting its Good target below its Meet target: it must be refused with nothing saved. Put 120 back.

#### A03 Propose KPI change

**Inputs:** CallerEmail, KpiId, SettingsJson, SummaryJson. **Need:**
`member-write`, KpiId the KPI. **Called by:** the KPI page, when a Member
saves settings.

```text
Refuse if the KPI's fiscal year is closed (same message as A02). Run the same checks as A02 without saving.
Add a "Change proposal" row: KPI, Proposed by = the App user from Check (userid), Payload = SettingsJson,
Summary = SummaryJson (a list of {label, from, to}), Base modified on = the KPI's Settings changed on (or its
Modified on if that is empty), Status Pending (choice value 100000000).
Post a message in Microsoft Teams (Post message in a chat or channel, as the Flow bot) to every Approved Admin
App user: "<username> proposed a change to <code> <name>. Open the Scorecard app → Approvals to review it."
Respond Ok = true, Message "Your change has been sent to an admin for approval."
```

#### A04 Approve proposal and A05 Reject proposal

**Inputs:** CallerEmail, ProposalId, and for A05 also Note. **Need:**
`admin`, KpiId `none`. **Called by:** the Approvals screen (7.16) and the
agent.

```text
A04: Get the Change proposal and its KPI. Refuse with "That proposal has already been reviewed." if its
Status isn't Pending. Refuse with "This KPI has changed since the proposal was made. Ask for a fresh
proposal." if the KPI's Settings changed on is later than the proposal's Base modified on.
Run the child flow "A02 Save KPI settings" with CallerEmail, the proposal's KPI and its Payload. If it
returns Ok = false, respond with its message and stop. Otherwise set the proposal's Status to Approved,
Reviewed by = the App user from Check, Reviewed on = utcNow(). Post a Teams message to the proposer:
"Your change to <code> was approved." Respond Ok = true, Message "Approved and saved."

A05: Refuse if not Pending (same message). Set Status Rejected, Review note = Note, Reviewed by and Reviewed
on as above. Tell the proposer in Teams: "Your change to <code> was not approved: <note>". Respond Ok = true.
```

> **Check it worked:** propose a change as the Member, approve it as yourself, and check the change rows name **you** as the author of the saved change. Then propose two changes to the same KPI, approve the first and try the second: it must be refused as out of date.

#### A13 Add progress update

**Inputs:** CallerEmail, KpiId, UpdateJson. **Need:** `member-write`.
**Called by:** the KPI page and the agent.

UpdateJson is `{"period":"2026-09","mode":"Detailed","body":null,
"currentProgress":"…","nextProgress":"…","timeAndCost":"…","issues":"…",
"status":"On track"}`.

```text
Refuse if the KPI's fiscal year is closed. Refuse with "Write something before posting." if every text
field is blank. Add a "Progress update" row: KPI, Period, Mode (Detailed = 100000000, Simple = 100000001),
the text fields trimmed, Author = Check username. If status is given and differs from the KPI's Status:
update the KPI's Status, add a KPI definition change row (field "status", label "Status"), and add a
"KPI status option" row with that name if none exists yet. Respond Ok = true, Message "Update posted."
```

Progress updates don't affect scores, so no recalculation request.

### 6.8 The hierarchy and weights

#### A06 Create KPI

**Inputs:** CallerEmail, FiscalYearId, ParentId (or `none`), Name, Code,
SubGroup. **Need:** `admin`. **Called by:** the Hierarchy screen.

```text
Refuse if the fiscal year is closed. If ParentId isn't "none", get the parent; refuse with "KPIs can only
go five levels deep." if the parent's Level is 5. If Code is blank, make one: the parent's code + "." +
(the number of the parent's children + 1), or for a Strategic Goal the number of Goals + 1; if that code
is taken, keep adding 1. Refuse with "Code "<code>" is already used by "<name>" in this year." if taken.
Create the KPI with Weight 0, Sort order = the largest Sort order among its siblings + 1, Is leaf Yes.
Add a KPI definition change row on the new KPI (field "created", label "Created", From "", To code + name).
Add a recalculation request with Refresh hierarchy Yes and KPI id empty.
Respond Ok = true, Data = the new KPI's id.
```

#### A07 Move KPI and A08 Reorder KPI

**Inputs:** A07: CallerEmail, KpiId, NewParentId (or `none`). A08:
CallerEmail, KpiId, Direction (`up` or `down`). **Need:** `admin`.

```text
A07: Refuse if the year is closed. Refuse with "A KPI can't be moved under itself or one of its own sub-KPIs."
if NewParentId is the KPI or any KPI whose Path contains "|<KpiId>|". Refuse with "KPIs can only go five
levels deep." if the new parent's Level plus the depth of the KPI's own branch would exceed 5. Refuse with
"Only a KPI with no metric can have sub-KPIs." if the new parent has a Metric type. Set the KPI's Parent
(empty for "none") and Sort order = last among its new siblings. Add a KPI definition change row (field
"parentId", label "Parent", from old parent code, to new parent code, "none" for a Strategic Goal).
Add a recalculation request with Refresh hierarchy Yes and KPI id empty.

A08: Find the sibling (same Parent and same Sub-group) immediately before (up) or after (down) it by Sort
order. If none, respond Ok = true, Message "Already at the top." or "Already at the bottom.". Otherwise swap
the two Sort order values. Add a recalculation request with Refresh hierarchy Yes and KPI id empty.
```

#### A09 Delete KPI

**Inputs:** CallerEmail, KpiId. **Need:** `admin`.

```text
Refuse if the year is closed. List every KPI whose Path contains "|<KpiId>|" (the KPI and everything under
it), sorted by Level descending. If the KPI has a parent, add a KPI definition change row on the parent
(field "deleted", label "Sub-KPI deleted", From "<code> <name>", To ""). Delete the KPIs one at a time in
that order, deepest first (their values, scores, updates and history go with them). Add a recalculation
request with Refresh hierarchy Yes and KPI id empty. Respond Message "Deleted <code> and <n> sub-KPI(s)."
```

> **Check it worked:** on a copy of the sample data, delete KPI 1.1. KPIs 1.1, 1.1.1 and 1.1.2 disappear, KPI 1 gets a "Sub-KPI deleted" history row, and after the recalculation Goal 1's score comes only from 1.2 and 1.3.

#### A10 Set group weights

**Inputs:** CallerEmail, FiscalYearId, ParentId (or `none` for the Strategic
Goals), WeightsJson (a list of `{"kpiId":"…","weight":25}`). **Need:**
`admin`.

```text
Refuse if the year is closed. Refuse with "Weights must be zero or more." if any weight is negative, and with
"<code> isn't in this group." if a kpiId's parent doesn't match ParentId. For each KPI whose weight changed,
update its Weight and add a KPI definition change row (field "weight", label "Weight % (of group)").
Add a recalculation request with Refresh hierarchy Yes and KPI id empty. If the new weights don't add up to
100, still save them, and respond Ok = true with Message "Saved. The weights add up to <sum>%, not 100%;
they'll be applied in proportion." Otherwise Message "Saved."
```

### 6.9 Overrides

#### A11 Override score and A12 Clear override

**Inputs:** CallerEmail, KpiId, Period, and for A11 Score and Reason.
**Need:** `admin`.

```text
A11: The KPI must be a leaf: "Only a KPI with no sub-KPIs can be overridden." Period must be YYYY-MM inside
the KPI's fiscal year and the year open (same messages as A01). Score must be 0 to 5 with one decimal:
"The score must be between 0 and 5." Reason must not be blank: "Give a reason for the override."
Find the Score override for this KPI and Period: update it or create it (Score, Reason, By = the App user
from Check). Add a KPI definition change row (field "override", label "Score override <Mon YYYY>",
From the old override or "none", To "<score> — <reason>").
A12: Delete the override if there is one and add a change row (To "none").
Both: add a recalculation request with From period = Period and KPI id = KpiId.
```

### 6.10 Fiscal years

These flows are called from the Manage screen (7.12).

#### A14 Create fiscal year

**Inputs:** CallerEmail, StartYear, CopyFromYearId (or `none`). **Need:**
`admin`.

```text
Refuse with "There is already a fiscal year starting in <StartYear>." if any Fiscal year has that Start year
(held years too). Create it with Label "FY<StartYear>/<last two digits of StartYear + 1>" (2026 gives
"FY2026/27") and Is active No.
If CopyFromYearId isn't "none": copy every KPI of that year, in order of Level, keeping each copy's parent
pointing at the copy of its old parent. Copy all settings, weights and owning departments. Shift Deadline
month, Completed period and a Month completion KPI's targetMonth forward by (StartYear − the source year's
start year) years. Set Completed to No. Don't copy values, scores, updates, overrides or history.
Add a recalculation request for the new year with Refresh hierarchy Yes.
Respond Data = the new year's id.
```

#### A15 Set active fiscal year

**Inputs:** CallerEmail, FiscalYearId. **Need:** `admin`.

```text
Refuse with "That year is in Holding. Restore it first." if Held on is set. Set Is active = Yes on it and
No on every other fiscal year.
```

#### A16 Close fiscal year and A17 Reopen fiscal year

**Inputs:** CallerEmail, FiscalYearId, and for A17 Reason. **Need:**
`admin`.

```text
A16: Refuse with "<label> is already closed." if Closed on is set. Run child flow "S4 Refresh hierarchy",
then run child flow "S6 Score a month" for each of the 12 months (April to March) with Scenario "standard",
EstimateMode "count", UnreportedMode "exclude", OnlyKpiId "all", one month at a time. Then list every
KPI score row of the year with Scenario "standard" and save them as JSON text in a "Fiscal year snapshot"
row (create or replace it). Set Closed on = utcNow() and Closed by. Add a "Fiscal year event" row (Action
Closed, Fiscal year label, Author). Respond "<label> is closed. Its scores are now fixed."

A17: Refuse with "Give a reason for reopening." if Reason is blank, and "<label> isn't closed." if not
closed. Clear Closed on and Closed by. Delete the snapshot row. Add a Fiscal year event (Action Reopened,
Reason). Add a recalculation request for the year (From period empty, Refresh hierarchy Yes).
```

The "Fiscal year action" choice numbers are, in order: Closed `100000000`,
Reopened `100000001`, Restored from checkpoint `100000002`, Moved to holding
`100000003`, Restored from holding `100000004`, Permanently deleted
`100000005`.

> **Check it worked:** close the sample year. Every KPI score row for all 12 months exists, and adding a figure through A01 is now refused with "FY2026/27 is closed. …". Reopen it with a reason: the Change log screen later shows both events.

#### A18 Move fiscal year to holding and A19 Restore from holding

This replaces "delete fiscal year". The year disappears from every screen
for 30 days, then a background job (Part 11) deletes it for good.

**Inputs:** A18: CallerEmail, FiscalYearId, Username, ConfirmationText.
A19: CallerEmail, FiscalYearId. **Need:** `admin`.

```text
A18: Refuse with "Reopen <label> before deleting it." if Closed on is set. Refuse with "That isn't your
username." unless Username equals Check's username, ignoring capitals. Refuse with "Type the phrase
exactly as shown." unless ConfirmationText is exactly "confirm delete <label> scorecard". Set Held on =
utcNow(), Held by, Purge on = addDays(utcNow(), 30) and Is active = No. Add a Fiscal year event (Action
Moved to holding). Respond "<label> moved to Holding. It will be permanently deleted on <purge date as
dd/mm/yyyy>."

A19: Refuse with "<label> isn't in Holding." if Held on is empty. Clear Held on, Held by and Purge on. Add a
Fiscal year event (Action Restored from holding).
```

The web app also asks for the admin's password here. Flows can't check a
Microsoft password, and nobody should type one into a chat, so the new
version relies on the person being signed in. Part 16 suggests a stronger
option.

### 6.11 Checkpoints (backups)

#### A20 Create checkpoint and A21 Delete checkpoint

**Inputs:** A20: CallerEmail, FiscalYearId, Name, Automatic (Yes/No). A21:
CallerEmail, CheckpointId. **Need:** `admin`.

```text
A20: Build one JSON object for the fiscal year: {"format":"kpi-scorecard-checkpoint","version":1,
"fiscalYear":{label,startYear}, "kpis":[…], "values":[…], "updates":[…], "overrides":[…],
"kpiChanges":[…], "valueChanges":[…]}. In "kpis", give each KPI its code, its parent's code (not the id),
every setting, and its owning departments by NAME. In every other list, refer to KPIs by code, never by id.
Create a "Fiscal year checkpoint" row (Name, Fiscal year, Automatic, KPI count, Value count, Created by)
and upload the JSON into its Data file column as "<label> <yyyy-MM-dd HHmm>.json" with "Upload a file or
an image". Respond Data = the checkpoint's id.
A21: Refuse with "Automatic checkpoints can't be deleted." if Automatic is Yes. Otherwise delete it.
```

#### A22 Get checkpoint file

**Inputs:** CallerEmail, CheckpointId. **Need:** `admin`.

```text
Download the checkpoint's Data file ("Download a file or an image"), save a copy in the SharePoint library
"Scorecard Exports" as the same file name, create a view-only sharing link, and respond Data = the link.
```

Staff only have read access to tables other than checkpoints (4.2), so this
flow is the only way to download one.

#### A28 List checkpoints

**Inputs:** CallerEmail, FiscalYearId. **Need:** `admin`.

```text
List the year's "Fiscal year checkpoint" rows, newest first, without the Data file column. Respond
Data = a JSON list of {id, name, automatic, kpiCount, valueCount, createdOn, createdBy (the username)}.
```

The app can't read the checkpoint table itself (4.2), so the Backups screen
uses this flow to show the list.

#### A23 Preview restore and A24 Restore checkpoint

**Inputs:** CallerEmail, CheckpointId (or `none`), UploadedJson (or empty),
TargetYearId (or `new`), NewStartYear. **Need:** `admin`.

```text
Read the checkpoint JSON from the checkpoint's Data file, or from UploadedJson if CheckpointId is "none".
Refuse with "That file isn't a KPI Scorecard checkpoint." if format isn't "kpi-scorecard-checkpoint".
Check every KPI's parent code exists in the file and no code repeats; refuse with the first problem found.
A23 (preview, writes nothing): respond Data = {"kpisRemoved": <KPIs in the target year now>, "kpisAdded":
<KPIs in the file>, "valuesRemoved", "valuesAdded", "updatesAdded", "departmentsCreated": [names not found]}.
A24 (restore): run A23's checks. If the target year exists, first run child flow "A20 Create checkpoint" on
it with Automatic Yes and Name "Before restore <date>". If TargetYearId is "new", create a fiscal year for
NewStartYear (refuse if one exists). Delete every KPI of the target year, deepest Level first. Create
departments that don't exist yet. Create the KPIs from the file in Level order, linking parents by code and
departments by name, then the values, updates, overrides and history rows. Clear Closed on and Closed by and
delete any snapshot: a restored year is always open. Add a Fiscal year event (Action Restored from
checkpoint). Add a recalculation request (Refresh hierarchy Yes). Respond with the counts.
```

> **Check it worked:** create a checkpoint of the sample year, change a figure, then restore the checkpoint. The figure is back, an automatic checkpoint called "Before restore …" exists, and the Change log shows the restore. KPI ids change during a restore, so the app must be refreshed afterwards.

### 6.12 Users and departments

#### A25 Register

**Inputs:** CallerEmail, Username, CompanyId, DepartmentId. **Need:** none:
this is the one flow that doesn't call A00, because the person isn't
registered yet. **Called by:** the app's sign-up screen and the agent.

```text
Refuse with "You're already registered." if an App user has Email = CallerEmail. Refuse with "That
username is taken." or "That company ID is already registered." if either is used, ignoring capitals.
Refuse with "Choose your department." if the department doesn't exist or isn't active.
If there are no App user rows at all, create this one with Role Admin and Status Approved, and respond
"You're the first user, so you're an admin." Otherwise create it with Role Member and Status Pending,
post a Teams message to every Approved Admin: "<username> (<email>) has registered and is waiting for
approval.", and respond "Thanks. An admin will approve your account soon."
```

#### A26 Manage user

**Inputs:** CallerEmail, UserId, Action (`approve`, `make-admin`,
`make-member` or `remove`). **Need:** `admin`.

```text
approve: set Status Approved; post a Teams message to the user: "Your KPI Scorecard account is approved."
make-admin / make-member: set Role. Refuse to make the last Approved Admin a Member: "There must always be
at least one admin."
remove: refuse with "You can't remove yourself." if UserId is Check's userid, and with "There must always
be at least one admin." for the last admin. Refuse while other rows point at the user, naming them:
"<username> can't be removed while they're named on <n> change proposal(s), <n> override(s), <n>
checkpoint(s) or a closed or held fiscal year." Otherwise delete the App user row.
```

#### A27 Save departments

**Inputs:** CallerEmail, DepartmentsJson: a list of `{"id":"…" or null,
"name":"…","isActive":true,"remove":false}`. **Need:** `admin`.

```text
For each item: if id is null, create the department (refuse duplicates by name, ignoring capitals); if
remove is true, refuse with "<name> is still used by <n> user(s) and <n> KPI(s)." while any App user or KPI
link points at it, otherwise delete it; else update Name and Is active. Respond with a summary.
```

### 6.13 Scores on demand

#### A30 Get scores with options

The dashboard's two options (what to do about missing figures and about
estimates) change the scores. The standard scores are always ready; this
flow works out the others when someone picks them.

**Inputs:** CallerEmail, FiscalYearId, Period, EstimateMode,
UnreportedMode. **Need:** `signed-in`.

```text
Scenario = "standard" when EstimateMode is "count" and UnreportedMode is "exclude", otherwise
"<EstimateMode>|<UnreportedMode>". If Scenario is "standard", respond Data = "standard" and stop.
Work out the trailing months: Period and the three months before it, keeping only months inside the
fiscal year. Respond Data = Scenario straight away. THEN, after responding, for each of those months that
has no "Total score" row for this fiscal year, Period and Scenario, run child flow "S6 Score a month" with
FiscalYearId, the month, Scenario, EstimateMode, UnreportedMode and OnlyKpiId "all", one month at a time.
```

> **Check it worked:** the **Respond** action comes **before** the S6 loop. Power Apps gets its answer at once, and the flow carries on working. The app then watches the Total score table until the four months appear (7.4). Run it for 2026-09 with UnreportedMode `zero`: after a few minutes there are `count|zero` Total score rows for 2026-06 to 2026-09, and 2026-09's is 2.8.

#### A31 Simulate

**What it does:** scores "what if" figures without saving them, for the
Simulate screen (7.10). It only scores the KPIs whose figures were changed;
the app works out the effect on the total.

**Inputs:** CallerEmail, Period, ChangesJson: a list of
`{"kpiId":"…","value":95,"plannedValue":null,"completionDate":null}`.
**Need:** `signed-in`.

> **Do this:** build it by hand, reusing the formulas from S6:
>
> 1. Procedure J, with Need `signed-in` and KpiId `none`.
> 2. **Above** the Check action (click the **+** between the trigger and Check), add two **Initialize variable** actions: `Period`, type String, set to the Period input; and `Results`, type Array, value `createArray()`. Variables can only be created at the top level of a flow, never inside a condition or loop.
>    Build steps 3 and 4 on the True side of **If_allowed**.
> 3. **Apply to each** `Each_change` over `json(` ChangesJson `)`, concurrency `20`. Inside it:
>    1. **Get a row by ID** `Get_kpi`, table KPIs, Row ID `items('Each_change')?['kpiId']`.
>    2. **List rows** `Kpi_values`, table KPI values, **Sort by** `sc_period asc`. **Filter rows**, which loads the KPI's figures for the months before this one:
>
>       ```text
>       concat('_sc_kpi_value eq ',items('Each_change')?['kpiId'],' and sc_period lt ''',variables('Period'),'''')
>       ```
>
>    3. **Select** `Entries`. **From:** `outputs('Kpi_values')?['body/value']`. Map, in text mode: the *Entries map* formula from 5.11.
>    4. **Compose** `Simulated`, the what-if figure for this month, always an Actual:
>
>       ```text
>       addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'period',variables('Period')),'value',items('Each_change')?['value']),'basis','Actual'),'plannedValue',items('Each_change')?['plannedValue']),'completionDate',items('Each_change')?['completionDate'])
>       ```
>
>    5. **List rows** `Sim_override`, table Score overrides, **Row count** 1, **Filter rows**: `concat('_sc_kpi_value eq ',items('Each_change')?['kpiId'],' and sc_period eq ''',variables('Period'),'''')`
>    6. **Run a Child Flow** `Score_it`, flow **S5 Score one KPI**:
>       - **KpiJson:** the formula below. It's the *KPI JSON* formula from 5.11, reading from Get_kpi:
>
>         ```text
>         string(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'id',outputs('Get_kpi')?['body/sc_kpiid']),'metricType',outputs('Get_kpi')?['body/sc_metrictype@OData.Community.Display.V1.FormattedValue']),'direction',outputs('Get_kpi')?['body/sc_direction@OData.Community.Display.V1.FormattedValue']),'targetMode',outputs('Get_kpi')?['body/sc_targetmode@OData.Community.Display.V1.FormattedValue']),'targetConfig',outputs('Get_kpi')?['body/sc_targetconfig']),'deadlineMonth',outputs('Get_kpi')?['body/sc_deadlinemonth']),'scoreFinalAfterDeadline',outputs('Get_kpi')?['body/sc_scorefinalafterdeadline']),'completed',outputs('Get_kpi')?['body/sc_completed']),'completedPeriod',outputs('Get_kpi')?['body/sc_completedperiod']),'frequency',outputs('Get_kpi')?['body/sc_frequency@OData.Community.Display.V1.FormattedValue']),'phasing',outputs('Get_kpi')?['body/sc_phasing@OData.Community.Display.V1.FormattedValue']),'phaseShares',outputs('Get_kpi')?['body/sc_phaseshares']))
>         ```
>
>       - **EntriesJson:** `string(union(body('Entries'),createArray(outputs('Simulated'))))`
>       - **Period:** `variables('Period')`; **EstimateMode:** `count`; **UnreportedMode:** `exclude`
>       - **ScoreAtDeadline:** `-1`
>       - **OverrideScore:** `coalesce(first(outputs('Sim_override')?['body/value'])?['sc_score'],-1)`
>    7. **Append to array variable** `Results`:
>
>       ```text
>       addProperty(addProperty(addProperty(addProperty(addProperty(addProperty(json('{}'),'kpiId',items('Each_change')?['kpiId']),'hasScore',body('Score_it')?['hasscore']),'score',body('Score_it')?['score']),'band',body('Score_it')?['band']),'provisional',body('Score_it')?['provisional']),'prorated',body('Score_it')?['prorated'])
>       ```
>
> 4. After the loop, **Respond to a Power App or flow**: Ok `true`, Message empty, Data `string(variables('Results'))`.
>
> **Check it worked:** run it with Period `2026-09` and ChangesJson `[{"kpiId":"K111","value":95}]` (K111 = KPI 1.1.1's id). Data contains `"score":4.5` and `"band":"Very good"`, and the KPI value table is unchanged.

KPIs whose score is frozen at a deadline can't be simulated this way. The
Simulate screen locks them (7.10).

### 6.14 The app wrappers to build

Build an app wrapper (Procedure K) for each core flow the app uses. Its
inputs are the core flow's inputs without CallerEmail.

| Wrapper | Core flow | Used on |
| --- | --- | --- |
| AppSaveFigures | A01 | Enter Data, KPI page |
| AppSaveKpiSettings | A02 | KPI page, Hierarchy |
| AppProposeKpiChange | A03 | KPI page |
| AppApproveProposal / AppRejectProposal | A04 / A05 | Approvals |
| AppCreateKpi, AppMoveKpi, AppReorderKpi, AppDeleteKpi | A06 to A09 | Hierarchy |
| AppSetGroupWeights | A10 | Weights |
| AppOverrideScore, AppClearOverride | A11, A12 | KPI page |
| AppAddProgressUpdate | A13 | KPI page |
| AppCreateFiscalYear, AppSetActiveFiscalYear, AppCloseFiscalYear, AppReopenFiscalYear, AppMoveYearToHolding, AppRestoreFromHolding | A14 to A19 | Manage, Holding |
| AppCreateCheckpoint, AppDeleteCheckpoint, AppGetCheckpointFile, AppPreviewRestore, AppRestoreCheckpoint, AppListCheckpoints | A20 to A24, A28 | Backups |
| AppRegister | A25 | Sign-up |
| AppManageUser, AppSaveDepartments | A26, A27 | Users, Manage |
| AppGetScoresWithOptions | A30 | Dashboard, KPIs |
| AppSimulate | A31 | Simulate |

**A closing check for this part.** Open **Solutions → KPI Scorecard** and
filter on **Cloud flows**. Every core flow and wrapper is there, and none
shows a warning about connections. Open two or three wrappers' details pages
and check **Run only users** uses the service account.

---

## Part 7. Build the app

The app has the same screens as the web app. You'll build it in Power Apps
Studio, the drag-and-drop designer, one screen at a time.

### 7.1 How the app is laid out

Every screen has the same **header bar** across the top: the app's name, a
row of buttons for moving between screens, and the signed-in person's name.
Admins see a second row of buttons for the Manage screens.

| Screen | What it shows | Who sees it | Flows it calls | Step |
| --- | --- | --- | --- | --- |
| Welcome | Sign-up form, or "waiting for approval" | People not yet approved | AppRegister | 7.3 |
| Dashboard | The total score, a card per Strategic Goal, and the whole KPI tree with the last four months | Everyone | AppGetScoresWithOptions | 7.4 |
| KPIs | A searchable list of every KPI | Everyone | none | 7.5 |
| KPI page | One KPI: score, how it's made up, targets, month by month, reporting form, progress updates, settings, history | Everyone; editing depends on role | AppSaveFigures, AppAddProgressUpdate, AppSaveKpiSettings, AppProposeKpiChange, AppOverrideScore, AppClearOverride | 7.6 |
| Enter Data | A grid of every KPI you can report on, for one month | Members and admins | AppSaveFigures | 7.7 |
| Deadlines | Overdue and soon-due time-bound KPIs | Everyone | none | 7.8 |
| Insights | Biggest opportunities and KPIs at risk | Everyone | none | 7.9 |
| Simulate | "What if" figures, with their effect on the total | Everyone | AppSimulate | 7.10 |
| Help | How the scorecard works | Everyone | none | 7.11 |
| Manage | Fiscal years and departments | Admins | AppCreateFiscalYear and the other year flows, AppSaveDepartments | 7.12 |
| Hierarchy | Add, move, reorder and delete KPIs | Admins | AppCreateKpi, AppMoveKpi, AppReorderKpi, AppDeleteKpi | 7.13 |
| Weights | Each group's weights | Admins | AppSetGroupWeights | 7.14 |
| Import and export | Excel in and out | Admins (export: everyone) | Part 9 flows | 7.15 |
| Users and approvals | Registrations and proposed changes | Admins | AppManageUser, AppApproveProposal, AppRejectProposal | 7.16 |
| Holding, Change log, Backups | Deleted years, year history, checkpoints | Admins | AppRestoreFromHolding, AppListCheckpoints and the checkpoint flows | 7.17 |

There is one more screen, **Loading**, which nobody notices. It fetches the
scores whenever the year, month or options change, then moves on to the
screen that asked. Keeping all the loading in one place means you only ever
write it once.

**How the app reads and writes.** The app reads tables directly: it's quick,
and staff have read access (Part 4). It never writes to a table. Every
button that changes something calls a wrapper flow from Part 6, shows the
flow's message, and reloads.

### 7.2 Create the app and connect the data

> **Do this:**
>
> 1. In [make.powerapps.com](https://make.powerapps.com), open **Solutions → KPI Scorecard → + New → App → Canvas app**.
> 2. **App name:** `KPI Scorecard`. **Format:** Tablet. Click **Create**. Power Apps Studio opens with one empty screen.
> 3. Open **Settings** (the gear icon, or **...** → **Settings**):
>    - Under **General**, set **Data row limit** to `2000`. This is the most rows the app fetches in one go; the default of 500 is too few for a year of scores.
>    - Under **Display**, turn **Scale to fit** off. The screens then stretch to fill wide monitors.
>    - Under **Updates**, turn on **Named formulas** if it's listed. (In newer versions it's always on and not listed.)
> 4. Close Settings. Click the **Data** icon (a cylinder) in the left bar, then **+ Add data**. Search for **Dataverse**-backed tables by name and add each of these: App users, Departments, Fiscal years, KPIs, KPI values, KPI scores, Total scores, Score overrides, Change proposals, Progress updates, KPI definition changes, KPI value changes, Fiscal year events, KPI status options.
> 5. Click the **Power Automate** icon (or **...** → **Power Automate**) in the left bar, then **+ Add flow**, and add **AppSaveFigures**. Add the other wrappers as each screen asks for them.
> 6. Click **Save** (top right). Save often: Power Apps Studio doesn't save by itself.
>
> **Check it worked:** the Data pane lists 14 tables and the Power Automate pane lists AppSaveFigures.
>
> **If something goes wrong:** if a wrapper flow doesn't appear under **+ Add flow**, check it uses the trigger **When Power Apps calls a flow (V2)** and is saved inside the KPI Scorecard solution.

**About formulas.** Every control has **properties** (Text, Fill, Visible,
OnSelect and so on). To set one, select the control, pick the property in
the drop-down at the top left of the formula bar, and paste the formula into
the bar. Formulas in this part are ready to paste. If a name is underlined
in red, the control or table it refers to has a different name: rename the
control (double-click it in the **Tree view**) to the name the guide uses.

### 7.3 App-wide formulas, the header and the Welcome screen

**Step 1: named formulas.** These are values the whole app shares, such as
"who is signed in" and "the band colours".

> **Do this:** in the **Tree view**, select **App**. Pick **Formulas** in the property drop-down and paste:

```text
Me = LookUp('App users', Email = User().Email);
IsApproved = !IsBlank(Me) && Me.Status = 'User status'.Approved;
IsAdmin = IsApproved && Me.Role = 'User role'.Admin;
Navy = ColorValue("#032853");
Sky = ColorValue("#20B0EC");
Ink = ColorValue("#111827");
Muted = ColorValue("#6b7280");
Line = ColorValue("#e5e7eb");
Ground = ColorValue("#f4f7fb");
NoScore = ColorValue("#d1d5db");
BandStyles = Table(
    {Band: "Poor", Key: "POOR", Rank: 1, Lo: 0, Hi: 2.4, Fill: ColorValue("#ff0000"), Text: Color.White},
    {Band: "Improvement needed", Key: "IMPROVEMENT_NEEDED", Rank: 2, Lo: 2.5, Hi: 2.9, Fill: ColorValue("#ffc000"), Text: ColorValue("#451a03")},
    {Band: "Meet", Key: "MEET", Rank: 3, Lo: 3, Hi: 3.4, Fill: ColorValue("#92d050"), Text: ColorValue("#1a2e05")},
    {Band: "Good", Key: "GOOD", Rank: 4, Lo: 3.5, Hi: 3.9, Fill: ColorValue("#00b050"), Text: Color.White},
    {Band: "Very good", Key: "VERY_GOOD", Rank: 5, Lo: 4, Hi: 4.5, Fill: ColorValue("#00b0f0"), Text: Color.White},
    {Band: "Excellent", Key: "EXCELLENT", Rank: 6, Lo: 4.6, Hi: 5, Fill: ColorValue("#0070c0"), Text: Color.White}
);
```

`'User status'.Approved` means "the Approved item of the User status
choice". These are the same colours as the web app.

**Step 2: what happens when the app opens.** It picks the active fiscal year
and the current month, the same way the web app does.

> **Do this:** select **App**, pick **OnStart**, and paste:

```text
Set(varYear, Coalesce(
    LookUp('Fiscal years', 'Is active' = true && IsBlank('Held on')),
    First(Sort(Filter('Fiscal years', IsBlank('Held on')), 'Start year', SortOrder.Descending))));
Set(varPeriod, With(
    {today: Year(Today()) * 12 + Month(Today()) - 1, first: varYear.'Start year' * 12 + 3},
    With({p: Min(Max(today, first), first + 11)},
        Text(RoundDown(p / 12, 0)) & "-" & Text(Mod(p, 12) + 1, "00"))));
Set(varEstimateMode, "count");
Set(varUnreportedMode, "exclude");
Set(varScenario, "standard");
Set(varLoadedKey, "")
```

Months are turned into a single number (year × 12 + month − 1) so that
"three months earlier" is just "subtract 3". You'll see this trick again.

> Then select **App** and set **StartScreen** to:
>
> ```text
> If(IsApproved, scrDashboard, scrWelcome)
> ```
>
> It shows a red error until those screens exist. That's fine.

**Step 3: the Loading screen.**

> **Do this:**
>
> 1. Rename the first screen `scrLoading` (double-click it in the Tree view). Set its **Fill** to `Ground`.
> 2. Insert a **Label** (Insert → Text label), centred, with **Text** `"Loading the scorecard…"` and **Color** `Muted`.
> 3. Set the screen's **OnVisible** to the formula below. It works out the four months to show, loads the KPIs, their scores and the totals, and then goes back to whichever screen asked.

```text
Set(varMonths, ForAll(Sequence(4, 3, -1) As i,
    With({t: Value(Left(varPeriod, 4)) * 12 + Value(Right(varPeriod, 2)) - 1 - i.Value},
        {Period: If(t < varYear.'Start year' * 12 + 3, "",
            Text(RoundDown(t / 12, 0)) & "-" & Text(Mod(t, 12) + 1, "00"))})));
Set(varYearMonths, ForAll(Sequence(12, 0) As k,
    With({t: varYear.'Start year' * 12 + 3 + k.Value},
        {Period: Text(RoundDown(t / 12, 0)) & "-" & Text(Mod(t, 12) + 1, "00")})));
ClearCollect(colKpis, AddColumns(
    Filter(KPIs, 'Fiscal year'.'Fiscal year' = varYear.'Fiscal year'),
    KpiId, Text(KPI), ParentKpiId, Text(Parent.KPI)));
ClearCollect(colKpiDepts, Ungroup(ForAll(Departments As d,
    ForAll(d.KPIs As k, {KpiId: Text(k.KPI), Dept: d.Name, DeptId: Text(d.Department)})), Value));
ClearCollect(colMyKpiIds, ShowColumns(Filter(colKpiDepts, IsApproved && DeptId = Text(Me.Department.Department)), KpiId));
Clear(colScores);
ForAll(Filter(varMonths, Period <> "") As m,
    Collect(colScores, AddColumns(
        Filter('KPI scores', 'Fiscal year'.'Fiscal year' = varYear.'Fiscal year' && Period = m.Period && Scenario = varScenario),
        KpiId, Text(KPI.KPI))));
ClearCollect(colNow, Filter(colScores, Period = varPeriod));
ClearCollect(colTotals, Filter('Total scores', 'Fiscal year'.'Fiscal year' = varYear.'Fiscal year' && Scenario = varScenario));
Set(varTotal, LookUp(colTotals, Period = varPeriod));
Set(varMissingMonths, CountRows(Filter(varMonths As m, m.Period <> "" && IsBlank(LookUp(colTotals, Period = m.Period)))));
Set(varLoadedKey, Text(varYear.'Fiscal year') & varPeriod & varScenario);
Navigate(Coalesce(varAfterLoad, scrDashboard), ScreenTransition.None)
```

A few things in that formula are worth knowing:

- `'Fiscal year'.'Fiscal year'` reads oddly: it's the **Fiscal year** lookup column, then that year's id, which Dataverse also calls "Fiscal year". Likewise `KPI.KPI` is a score's KPI, then that KPI's id.
- **colKpiDepts** lists which departments own which KPIs. **colMyKpiIds** is the KPIs the signed-in person's department owns: the ones a Member may report on.
- **varMissingMonths** counts months that have no scores yet. It's only above 0 while the dashboard's options are being worked out.

**Step 4: the header and a template screen.** You'll build the header once,
on a template screen, then duplicate that screen for every other screen.

> **Do this:**
>
> 1. Click **+ New screen → Blank**. Rename it `scrTemplate`. Set **Fill** to `Ground`.
> 2. Insert a **Container** (Insert → Layout → Container) named `conHeader`. Set **X** `0`, **Y** `0`, **Width** `Parent.Width`, **Height** `96`, **Fill** `Navy`.
> 3. Inside it, add a **Label** `lblAppName`: **Text** `"KPI Scorecard"`, **Color** `Color.White`, **Size** `16`, **FontWeight** `FontWeight.Semibold`, at X `24`, Y `12`.
> 4. Add a second **Label** `lblMe` at the top right: **Text** `If(IsApproved, Me.Username & If(IsAdmin, " · Admin", ""), "")`, **Color** `Color.White`, **Align** `Align.Right`.
> 5. Insert a **Blank horizontal gallery** inside the container, named `galNav`. Set **X** `16`, **Y** `48`, **Width** `Parent.Width - 32`, **Height** `40`, **TemplateSize** `120`, and **Items**:
>
>    ```text
>    Filter(Table(
>        {Label: "Dashboard", Target: scrDashboard, Admin: false},
>        {Label: "KPIs", Target: scrKpis, Admin: false},
>        {Label: "Deadlines", Target: scrDeadlines, Admin: false},
>        {Label: "Enter Data", Target: scrEntry, Admin: false},
>        {Label: "Simulate", Target: scrSimulate, Admin: false},
>        {Label: "Insights", Target: scrInsights, Admin: false},
>        {Label: "Help", Target: scrHelp, Admin: false},
>        {Label: "Manage", Target: scrManage, Admin: true},
>        {Label: "Hierarchy", Target: scrHierarchy, Admin: true},
>        {Label: "Weights", Target: scrWeights, Admin: true},
>        {Label: "Import", Target: scrImport, Admin: true},
>        {Label: "Users", Target: scrUsers, Admin: true},
>        {Label: "Holding", Target: scrHolding, Admin: true}
>    ), !Admin || IsAdmin)
>    ```
>
> 6. Inside the gallery's template, add a **Button** named `btnNav`: **Text** `ThisItem.Label`, **OnSelect** `Navigate(ThisItem.Target, ScreenTransition.None)`, **Fill** `If(App.ActiveScreen = ThisItem.Target, Sky, Navy)`, **Color** `Color.White`, **BorderThickness** `0`, **Width** `Parent.TemplateWidth - 8`.
>
> The gallery shows red errors until all the screens exist. Leave it; they disappear one by one as you build each screen. If a screen you don't want yet causes trouble, delete its line from the list and add it back later.

**Step 5: the year and month pickers.** Several screens let people choose a
year and month. Build them once on the template:

> **Do this:** on `scrTemplate` (below the header), add:
>
> 1. A **Drop down** `ddYear`. **Items:** `Sort(Filter('Fiscal years', IsBlank('Held on')), 'Start year', SortOrder.Descending)`. **Value** (or **DisplayFields**): `Label`. **Default:** `varYear`. **OnChange:**
>
>    ```text
>    Set(varYear, ddYear.Selected);
>    Set(varPeriod, With({p: Min(Max(Year(Today()) * 12 + Month(Today()) - 1, varYear.'Start year' * 12 + 3), varYear.'Start year' * 12 + 14)},
>        Text(RoundDown(p / 12, 0)) & "-" & Text(Mod(p, 12) + 1, "00")));
>    Set(varAfterLoad, App.ActiveScreen); Navigate(scrLoading, ScreenTransition.None)
>    ```
>
> 2. A **Drop down** `ddMonth`. **Items:** `varYearMonths`. **Value:** `Period`. **Default:** `LookUp(varYearMonths, Period = varPeriod)`. **OnChange:**
>
>    ```text
>    Set(varPeriod, ddMonth.Selected.Period);
>    Set(varAfterLoad, App.ActiveScreen); Navigate(scrLoading, ScreenTransition.None)
>    ```
>
> 3. A **Label** `lblClosed`: **Text** `"Closed"`, **Fill** `NoScore`, **Visible** `!IsBlank(varYear.'Closed on')`. Put it next to the screen title.

**Step 6: two reusable pieces, the confirm box and the flow call.**

> **Procedure L: add a confirm box.** Every save first shows a box listing
> each change as "field: old → new", like the web app. On a screen that needs one:
>
> 1. Insert a **Container** `conConfirm` covering the whole screen, **Fill** `RGBA(0, 0, 0, 0.4)`, **Visible** `varShowConfirm`.
> 2. Inside it, a white **Container** in the middle (Width `640`, Height `480`) holding:
>    - a **Label**: `CountRows(colChanges) & If(CountRows(colChanges) = 1, " field will be updated", " fields will be updated")`;
>    - a **Blank vertical gallery** `galChanges` with **Items** `colChanges`, and three labels in its template: `ThisItem.Label`, `Coalesce(ThisItem.From, "—")` and `Coalesce(ThisItem.To, "—")`;
>    - a **Button** `btnCancel`: **Text** `"Cancel"`, **OnSelect** `Set(varShowConfirm, false)`;
>    - a **Button** `btnConfirm`: **Text** `"Confirm"`. Its **OnSelect** is given by each screen.
> 3. Bring the container to the front: right-click it → **Reorder → Bring to front**.
>
> Each screen fills a collection called **colChanges** with three text
> columns, `Label`, `From` and `To`, then sets `varShowConfirm` to `true`.

> **Procedure M: call a flow and show the result.** Every button that saves follows this shape:
>
> ```text
> Set(varBusy, true);
> Set(varResult, AppSaveFigures.Run( … inputs … ));
> Set(varBusy, false);
> Set(varShowConfirm, false);
> Notify(varResult.message, If(varResult.ok, NotificationType.Success, NotificationType.Error));
> If(varResult.ok, Set(varLoadedKey, ""); Set(varAfterLoad, App.ActiveScreen); Navigate(scrLoading, ScreenTransition.None))
> ```
>
> The flow's outputs come back with lower-case names: `ok`, `message` and `data`. Set the save button's **DisplayMode** to `If(varBusy, DisplayMode.Disabled, DisplayMode.Edit)` so it can't be pressed twice. Scores take a few minutes to catch up after a save; the reload shows the new figures straight away and the new scores once the recalculation finishes.

**Step 7: the Welcome screen** (for people who aren't approved yet).

> **Do this:**
>
> 1. Duplicate `scrTemplate` (right-click it → **Duplicate screen**) and rename the copy `scrWelcome`. Delete its pickers and its navigation gallery.
> 2. Add a **Label**: `If(IsBlank(Me), "Register for the KPI Scorecard", "Your registration is waiting for an admin to approve it.")`
> 3. Add three inputs, all with **Visible** `IsBlank(Me)`: a **Text input** `txtUsername` (hint "Username"), a **Text input** `txtCompanyId` (hint "Company ID number"), and a **Drop down** `ddDept` with **Items** `Filter(Departments, 'Is active' = true)` showing **Name**.
> 4. Add the flow **AppRegister** (7.2, step 5), then a **Button** `btnRegister`, **Visible** `IsBlank(Me)`, **Text** `"Register"`, and **OnSelect**:
>
>    ```text
>    Set(varResult, AppRegister.Run(Trim(txtUsername.Text), Trim(txtCompanyId.Text), Text(ddDept.Selected.Department)));
>    Notify(varResult.message, If(varResult.ok, NotificationType.Success, NotificationType.Error));
>    Refresh('App users')
>    ```
>
> 5. Add a **Button** `btnCheckAgain`: **Text** `"Check again"`, **Visible** `!IsBlank(Me) && !IsApproved`, **OnSelect** `Refresh('App users'); If(IsApproved, Navigate(scrLoading))`.
>
> **Check it worked:** press **F5** (or the ▶ Preview button) while signed in as someone with no App user row: the register form shows. After an admin approves them, **Check again** opens the dashboard.

### 7.4 Dashboard

**What it shows:** the year and month, the total score as a big coloured
tile with coverage and flags, one card per Strategic Goal, and the KPI tree
with a column for each of the last four months. Rows with children can be
opened and closed. Two drop-downs change how missing figures and estimates
are treated.

> **Do this:**
>
> 1. Duplicate `scrTemplate` and rename the copy `scrDashboard`.
> 2. Set the screen's **OnVisible**:
>
>    ```text
>    If(varLoadedKey <> Text(varYear.'Fiscal year') & varPeriod & varScenario,
>        Set(varAfterLoad, scrDashboard); Navigate(scrLoading, ScreenTransition.None));
>    If(!varTreeReady,
>        ClearCollect(colCollapsed, ShowColumns(Filter(colNow, Level = 2 && !'Is leaf'), KpiId));
>        Set(varTreeReady, true))
>    ```
>
>    The second part starts the tree with each Strategic Goal's KPIs showing and everything below them closed.
>
> 3. **Title.** A **Label** `lblTitle` with **Text** `varYear.Label & " scorecard"`, size 20, semibold, and below it a **Label** with **Text**:
>
>    ```text
>    "Reporting " & Text(Date(Value(Left(varPeriod, 4)), Value(Right(varPeriod, 2)), 1), "mmm yyyy") & " · year-to-date figures against full-year targets"
>    ```
>
> 4. **Options.** Two **Drop down** controls next to the month picker:
>    - `ddMissing`, **Items** `["Excluded", "Assume Meet, decaying", "Score as 0"]`
>    - `ddEstimates`, **Items** `["Count at face value", "Exclude", "Score as 0"]`
>
>    Add the flow **AppGetScoresWithOptions**, and give **both** drop-downs this **OnChange**:
>
>    ```text
>    Set(varUnreportedMode, Switch(ddMissing.Selected.Value, "Excluded", "exclude", "Assume Meet, decaying", "assume", "zero"));
>    Set(varEstimateMode, Switch(ddEstimates.Selected.Value, "Count at face value", "count", "Exclude", "exclude", "zero"));
>    Set(varScenario, If(varEstimateMode = "count" && varUnreportedMode = "exclude", "standard", varEstimateMode & "|" & varUnreportedMode));
>    If(varScenario <> "standard",
>        AppGetScoresWithOptions.Run(Text(varYear.'Fiscal year'), varPeriod, varEstimateMode, varUnreportedMode));
>    Set(varAfterLoad, scrDashboard); Navigate(scrLoading, ScreenTransition.None)
>    ```
>
>    Add the same AppGetScoresWithOptions line to the month picker's OnChange too, before its Navigate, so changing month with options on also works.
>
> 5. **Waiting banner.** A **Label** `lblWorking`, full width, **Fill** `ColorValue("#fff7d6")`, **Visible** `varMissingMonths > 0`, **Text** `"Working out scores with these options. This takes a few minutes; the page updates by itself."`. Then a **Timer** `tmrWait` (Insert → Input → Timer): **Duration** `15000`, **Repeat** `true`, **AutoStart** and **Start** both `varMissingMonths > 0`, **Visible** `false`, **OnTimerEnd**:
>
>    ```text
>    Set(varLoadedKey, ""); Set(varAfterLoad, scrDashboard); Navigate(scrLoading, ScreenTransition.None)
>    ```
>
> 6. **The total tile.** A **Container** `conHero`, about 360 × 150, **Fill**:
>
>    ```text
>    If(IsBlank(varTotal) || !varTotal.'Has score', NoScore, LookUp(BandStyles, Band = varTotal.Band).Fill)
>    ```
>
>    Inside it:
>    - a big **Label** (size 44, bold): `If(IsBlank(varTotal) || !varTotal.'Has score', "–", Text(varTotal.Score, "0.0"))`
>    - a **Label**: `Coalesce(varTotal.Band, "No score yet")`
>    - a small **Label** with the coverage and flags:
>
>      ```text
>      If(IsBlank(varTotal), "No scores for this month yet",
>          "Coverage " & Text(varTotal.Coverage, "0.0%") &
>          If(varTotal.'Provisional share' > 0, " · Estimates " & Text(varTotal.'Provisional share', "0%"), "") &
>          If(varTotal.'Prorated share' > 0, " · Pro-rated " & Text(varTotal.'Prorated share', "0%"), "") &
>          If(varTotal.'Not yet due share' > 0, " · Not yet due " & Text(varTotal.'Not yet due share', "0%"), ""))
>      ```
>
>    Set each label's **Color** to `If(IsBlank(varTotal) || !varTotal.'Has score', Ink, LookUp(BandStyles, Band = varTotal.Band).Text)` so it's readable on the band colour.
>
> 7. **Strategic Goal cards.** A **Blank horizontal gallery** `galGoals` beside the tile, **Items** `Sort(Filter(colNow, Level = 1), 'Sort key')`, **TemplateSize** `220`. In its template:
>    - a **Rectangle** filling the card, **Fill** `If(ThisItem.'Has score', LookUp(BandStyles, Band = ThisItem.Band).Fill, NoScore)`;
>    - a **Label** `ThisItem.'KPI name'`;
>    - a big **Label** `If(ThisItem.'Has score', Text(ThisItem.Score, "0.0"), "–")`;
>    - a **Label** `Coalesce(ThisItem.Band, Coalesce(ThisItem.'Pending reason', ""))` plus any flags: `& If(ThisItem.Provisional, " · est", "") & If(ThisItem.Prorated, " · pro-rated", "")`;
>    - a footer **Label**: `ThisItem.'Scored leaf count' & "/" & ThisItem.'Leaf count' & " of " & Text(ThisItem.'Global weight', "0.00") & "% weight"`;
>    - **OnSelect** of the card: `Set(varKpiId, ThisItem.KpiId); Navigate(scrKpi)`.
>
> 8. **The KPI tree.** First, a row of header **Labels** across the screen: `KPI`, `Weight`, `Meet target`, `YTD/LE`, four month headings, and `Scored`. The month headings' **Text** is, for heading *n* (1 to 4):
>
>    ```text
>    With({p: Index(varMonths, n).Period}, If(p = "", "", Text(Date(Value(Left(p, 4)), Value(Right(p, 2)), 1), "mmm yy")))
>    ```
>
>    Type the digit in place of *n*. Then insert a **Blank vertical gallery** `galTree` below the headings, **TemplateSize** `40`, and **Items**:
>
>    ```text
>    Filter(Sort(colNow, 'Sort key') As r,
>        r.Level = 1 || IsEmpty(Filter(colCollapsed, KpiId <> r.KpiId && ("|" & KpiId & "|") in r.Path)))
>    ```
>
>    This hides every row that sits under a closed row. (A row's **Path** lists the ids of all its parents, so "is under X" means "X's id is in its Path".)

Inside the gallery's template, add these controls, lined up under the
headings:

| Control | Property | Formula |
| --- | --- | --- |
| Icon `icoToggle` (Insert → Icons → Chevron down) | Icon | `If(ThisItem.KpiId in colCollapsed.KpiId, Icon.ChevronRight, Icon.ChevronDown)` |
| | X | `(ThisItem.Level - 1) * 20` |
| | Visible | `!ThisItem.'Is leaf'` |
| | OnSelect | `If(ThisItem.KpiId in colCollapsed.KpiId, RemoveIf(colCollapsed, KpiId = ThisItem.KpiId), Collect(colCollapsed, {KpiId: ThisItem.KpiId}))` |
| Label `lblName` | Text | `ThisItem.Code & "  " & ThisItem.'KPI name'` |
| | X | `24 + (ThisItem.Level - 1) * 20` |
| | FontWeight | `If(ThisItem.Level = 1, FontWeight.Semibold, FontWeight.Normal)` |
| Label `lblWeight` | Text | `Text(ThisItem.'Global weight', "0.00") & "%"` |
| Label `lblMeet` | Text | *the Meet target formula below* |
| Label `lblYtd` | Text | *the YTD/LE formula below* |
| Rectangle + Label for each month *n* | see below | |
| Label `lblScored` | Text | `If(ThisItem.'Is leaf', "", ThisItem.'Scored leaf count' & "/" & ThisItem.'Leaf count')` |
| The template itself | OnSelect | `Set(varKpiId, ThisItem.KpiId); Navigate(scrKpi)` |

*Meet target* reads the KPI's targets and shows its Meet target:

```text
With({k: LookUp(colKpis, KpiId = ThisItem.KpiId)},
    If(IsBlank(k.'Target config'), "",
        With({c: ParseJSON(k.'Target config')},
            If(k.'Metric type' = 'Metric type'.'Month completion', Text(c.targetMonth),
               k.'Target mode' = 'Target mode'.Range, Text(Index(Table(c.MEET), 1).Value) & "–" & Text(Index(Table(c.MEET), 2).Value),
               Text(c.MEET) & " " & Coalesce(k.Unit, "")))))
```

*YTD/LE* shows the figure the score was based on:

```text
If(!IsBlank(ThisItem.'Completion date used'), Text(ThisItem.'Completion date used', "dd/mm/yyyy"),
   IsBlank(ThisItem.'Value used'), "",
   Text(ThisItem.'Value used', "#,##0.##") & " " & Coalesce(LookUp(colKpis, KpiId = ThisItem.KpiId).Unit, ""))
```

*Each month's score cell.* For month *n* add a **Rectangle** `recM`*n* and,
on top of it, a **Label** `lblM`*n*:

- Rectangle **Fill**:

  ```text
  With({s: LookUp(colScores, KpiId = ThisItem.KpiId && Period = Index(varMonths, n).Period)},
      If(IsBlank(s), Color.Transparent, !s.'Has score', NoScore, LookUp(BandStyles, Band = s.Band).Fill))
  ```

- Label **Text**:

  ```text
  With({s: LookUp(colScores, KpiId = ThisItem.KpiId && Period = Index(varMonths, n).Period)},
      If(IsBlank(s), "", !s.'Has score', If(s.'Pending reason' = "Not yet due", "n/d", "–"),
         Text(s.Score, "0.0") & If(s.Provisional, " est", "") & If(s.Prorated, " pro", "") & If(s.Overridden, " cal", "")))
  ```

- Label **Color**: `With({s: LookUp(colScores, KpiId = ThisItem.KpiId && Period = Index(varMonths, n).Period)}, If(IsBlank(s) || !s.'Has score', Ink, LookUp(BandStyles, Band = s.Band).Text))`

Build month 1's pair, then copy and paste it three times and change the `1`
to `2`, `3` and `4`. Month 4 is always the selected month.

> 9. **Total row.** Below the gallery, a row of labels with the same columns: `"Total"`, `"100.00%"`, and in each month column the total score from `LookUp(colTotals, Period = Index(varMonths, n).Period)`, coloured the same way.
> 10. **Export button.** A **Button** `"Export to Excel"` that calls the export flow from Part 9 (add it when you get there).
>
> **Check it worked:** with the sample data and **September 2026** selected:
>
> - The total tile shows **3.5**, green (**Good**), "Coverage 88.9% · Estimates 18% · Pro-rated 18% · Not yet due 10%".
> - Two Goal cards: **Grow the business 3.5** and **Run efficiently 3.4**, with footers "4/4 of 60.00% weight" and "2/4 of 40.00% weight".
> - The tree's September column matches Appendix C, section C.4. KPI 2.3 shows **n/d** and 2.4 shows **–**.
> - Closing **Grow the business** hides 1.1 to 1.3; opening it shows them again.
> - Choosing **Score as 0** for missing figures shows the banner; a few minutes later the total becomes **2.8 (Improvement needed)**. Choosing **Excluded** again goes straight back to 3.5.
>
> **If something goes wrong:**
>
> - **Blue underlines and a "delegation" warning** on a Filter: the formula can't be fully worked out by Dataverse, so the app only looks at the first 2000 rows. The formulas in this part avoid it; check you typed `=` comparisons exactly as shown.
> - **Every score cell is empty:** check the scores exist (Part 5) for the selected month and that `Scenario` is `standard` on them.
> - **Nothing happens when choosing an option:** check AppGetScoresWithOptions responds **before** its S6 loop (6.13).

### 7.5 KPIs

**What it shows:** every KPI in a sortable, searchable list, with its
Strategic Goal, owning departments, weight, Meet target, score and status.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrKpis`. **OnVisible:** the first `If(varLoadedKey …)` line from the Dashboard, with `scrKpis` in place of `scrDashboard`.
> 2. Add a **Text input** `txtSearch` (hint "Search code or name"), a **Drop down** `ddGoal` with **Items** `Ungroup(Table({Value: Table({'KPI name': "All goals", KpiId: ""})}, {Value: ShowColumns(Sort(Filter(colNow, Level = 1), 'Sort key'), 'KPI name', KpiId)}), Value)` showing **'KPI name'**, and a **Toggle** `tglLeaves` labelled "Lowest-level KPIs only".
> 3. Add a **Blank vertical gallery** `galKpis` with **Items**:
>
>    ```text
>    Filter(Sort(colNow, 'Sort key') As r,
>        (IsBlank(txtSearch.Text) || txtSearch.Text in r.Code || txtSearch.Text in r.'KPI name') &&
>        (ddGoal.Selected.KpiId = "" || ("|" & ddGoal.Selected.KpiId & "|") in r.Path) &&
>        (!tglLeaves.Value || r.'Is leaf'))
>    ```
>
> 4. In its template, labels for: `ThisItem.Code`, `ThisItem.'KPI name'`, the goal name `LookUp(colNow, Level = 1 && ("|" & KpiId & "|") in ThisItem.Path).'KPI name'`, the departments `Concat(Filter(colKpiDepts, KpiId = ThisItem.KpiId), Dept, ", ")`, the weight `Text(ThisItem.'Global weight', "0.00") & "%"`, the Meet target (same formula as 7.4), a score cell (same as 7.4's month cells, but reading `ThisItem` directly), and the status `LookUp(colKpis, KpiId = ThisItem.KpiId).Status`.
> 5. Template **OnSelect**: `Set(varKpiId, ThisItem.KpiId); Navigate(scrKpi)`.
>
> **Check it worked:** typing `revenue` leaves 1.1, 1.1.1 and 1.1.2. Choosing **Run efficiently** shows 2 and 2.1 to 2.4.

### 7.6 KPI page

**What it shows**, top to bottom, as in the web app:

1. a breadcrumb of its parents, its code and name, owning departments, status and weights;
2. this month's score tile, with its flags;
3. **Report for <month>**: the form for this month's figure (leaf KPIs only, for people who may report on it);
4. **How this score is made up**: for a leaf, the figure used, the targets and any deadline or override; for a parent, its children's contributions;
5. **Month by month**: a chart and a table of all twelve months;
6. **Progress updates**, with a form to post one;
7. **Definition and targets**: the settings, editable by admins and proposable by members, plus any pending proposal;
8. **Score override** (admins);
9. **Changes to this KPI** and **Achievement change log**.

It's the longest screen. Build it in a **vertical container** set to scroll
(Insert → Layout → **Vertical container**, then set **Overflow** to
**Scroll** — called **VerticalOverflow** in some versions), and add one
section container at a time, testing each before the next.

> **Do this: the screen and its data.**
>
> 1. Duplicate `scrTemplate` as `scrKpi`. Delete its year picker (the KPI belongs to one year); keep the month picker.
> 2. **OnVisible:**
>
>    ```text
>    Set(varKpi, LookUp(KPIs, KPI = GUID(varKpiId)));
>    Set(varScore, LookUp(colNow, KpiId = varKpiId));
>    Set(varCanReport, IsBlank(varYear.'Closed on') && varKpi.'Is leaf' && (IsAdmin || varKpiId in colMyKpiIds.KpiId));
>    ClearCollect(colKpiScores, Filter('KPI scores', KPI.KPI = GUID(varKpiId) && Scenario = "standard"));
>    ClearCollect(colKpiValues, Filter('KPI values', KPI.KPI = GUID(varKpiId)));
>    Set(varValue, LookUp(colKpiValues, Period = varPeriod));
>    Set(varTargets, If(IsBlank(varKpi.'Target config'), Blank(), ParseJSON(varKpi.'Target config')))
>    ```
>
> 3. Add the flows **AppSaveFigures**, **AppAddProgressUpdate**, **AppSaveKpiSettings**, **AppProposeKpiChange**, **AppOverrideScore** and **AppClearOverride**.

**Section 1: heading.**

| Control | Formula |
| --- | --- |
| Breadcrumb label | `Concat(Sort(Filter(colKpis, KpiId <> varKpiId && ("|" & KpiId & "|") in LookUp(colNow, KpiId = varKpiId).Path), Level), Code & " " & Name, "  ›  ")` |
| Title label | `varKpi.Code & "  " & varKpi.Name` |
| Facts label | `"Departments: " & Coalesce(Concat(Filter(colKpiDepts, KpiId = varKpiId), Dept, ", "), "none") & " · Weight " & Text(varKpi.Weight, "0.00") & "% of group · " & Text(varKpi.'Global weight', "0.00") & "% overall" & If(IsBlank(varKpi.Status), "", " · Status: " & varKpi.Status)` |
| Score tile | the Dashboard's total tile (7.4, step 6), reading `varScore` in place of `varTotal` |

**Section 2: Report for this month** (leaf KPIs). Put these in a container
with **Visible** `varKpi.'Is leaf'`:

| Control | Shown when | Default |
| --- | --- | --- |
| Text input `txtValue` (Format: Number) | not a Month completion KPI | `If(IsBlank(varValue.Value), "", Text(varValue.Value))` |
| Text input `txtPlanned` (Number) | Variance KPIs: `varKpi.'Metric type' = 'Metric type'.Variance` | `If(IsBlank(varValue.'Planned value'), "", Text(varValue.'Planned value'))` |
| Date picker `dpCompleted` (Format dd/mm/yyyy) | Month completion KPIs | `varValue.'Completion date'` |
| Drop down `ddBasis`, Items `["Actual", "Estimate"]` | always | `If(varValue.Basis = 'Value basis'.Estimate, "Estimate", "Actual")` |
| Text input `txtNote` (Multiline) | always | `Coalesce(varValue.Note, "")` |
| Button `btnReport`, Text `"Save"` | `varCanReport` (otherwise show a label: "You can report on KPIs your department owns.") | |

On the date picker, set **DateTimeZone** to `DateTimeZone.UTC` so the date
isn't shifted by time zones.

**btnReport.OnSelect** collects the changes for the confirm box (Procedure L):

```text
ClearCollect(colChanges, Filter(Table(
    {Label: "Reported value", From: If(IsBlank(varValue.Value), "", Text(varValue.Value)), To: txtValue.Text},
    {Label: "Target value", From: If(IsBlank(varValue.'Planned value'), "", Text(varValue.'Planned value')), To: txtPlanned.Text},
    {Label: "Basis", From: If(IsBlank(varValue), "", If(varValue.Basis = 'Value basis'.Estimate, "Estimate", "Actual")), To: If(IsBlank(varValue) && IsBlank(txtValue.Text) && IsBlank(dpCompleted.SelectedDate), "", ddBasis.Selected.Value)},
    {Label: "Completion date", From: Text(varValue.'Completion date', "dd/mm/yyyy"), To: Text(dpCompleted.SelectedDate, "dd/mm/yyyy")},
    {Label: "Note", From: Coalesce(varValue.Note, ""), To: Trim(txtNote.Text)}
), From <> To));
If(IsEmpty(colChanges), Notify("Nothing has changed.", NotificationType.Information), Set(varShowConfirm, true))
```

Add a confirm box (Procedure L), and set its **btnConfirm.OnSelect**
(Procedure M):

```text
Set(varBusy, true);
Set(varResult, AppSaveFigures.Run(JSON(Table({
    kpiId: varKpiId, period: varPeriod,
    value: If(IsBlank(txtValue.Text), Blank(), Value(txtValue.Text)),
    plannedValue: If(IsBlank(txtPlanned.Text), Blank(), Value(txtPlanned.Text)),
    basis: ddBasis.Selected.Value,
    completionDate: If(IsBlank(dpCompleted.SelectedDate), Blank(), Text(dpCompleted.SelectedDate, "yyyy-mm-dd")),
    note: Trim(txtNote.Text)}), JSONFormat.IgnoreUnsupportedTypes)));
Set(varBusy, false); Set(varShowConfirm, false);
Notify(varResult.message, If(varResult.ok, NotificationType.Success, NotificationType.Error));
If(varResult.ok, Set(varLoadedKey, ""); Set(varAfterLoad, scrKpi); Navigate(scrLoading, ScreenTransition.None))
```

> **Check it worked:** on KPI 1.1.1 for September, change 85 to 95. The confirm box says "1 field will be updated · Reported value 85 → 95". After **Confirm**, a green message says "Saved 1 figure(s).", and within a few minutes the score becomes 4.5. Put 85 back.

**Section 3: How this score is made up.**

For a **leaf**, show a small table of facts from `varScore`:

| Fact | Formula |
| --- | --- |
| Figure used | the YTD/LE formula from 7.4, reading `varScore` |
| Planned value used (Variance) | `Text(varScore.'Planned value used', "#,##0.##")` |
| Score before deadline rules | `Text(varScore.'Raw score', "0.0")` |
| Deadline | `If(IsBlank(varKpi.'Deadline month'), "none", varKpi.'Deadline month' & If(varScore.'Months late' > 0, " · " & varScore.'Months late' & " month(s) late, capped at " & Text(varScore.'Deadline cap', "0.0"), "") & If(varScore.'Frozen at deadline', " · frozen at the deadline score", ""))` |
| Calibrated | `If(varScore.Overridden, "Yes: an admin set this score", "No")` |
| Flags | `If(varScore.Provisional, "Based on an estimate. ", "") & If(varScore.Prorated, "Targets pro-rated for the months so far. ", "") & If(varScore.Assumed, "Assumed: no figure reported. ", "")` |

Then a **targets** gallery, one row per band, **Items** `BandStyles`, with a
coloured rectangle (`ThisItem.Fill`), the band name, its score range
(`Text(ThisItem.Lo, "0.0") & "–" & Text(ThisItem.Hi, "0.0")`) and its target:

```text
If(IsBlank(varTargets), "",
   varKpi.'Metric type' = 'Metric type'.'Month completion',
       If(ThisItem.Key = "MEET", Text(varTargets.targetMonth), ""),
   varKpi.'Target mode' = 'Target mode'.Range,
       IfError(Text(Index(Table(Column(varTargets, ThisItem.Key)), 1).Value) & "–" & Text(Index(Table(Column(varTargets, ThisItem.Key)), 2).Value), ""),
   IfError(Text(Column(varTargets, ThisItem.Key)), ""))
```

`Column(varTargets, "MEET")` reads the band's entry from the targets. Add a
highlight (a thicker border) on the row whose `Band = varScore.Band`.

For a **parent**, show its children instead: a gallery with **Items**
`Sort(Filter(colNow, ParentKpiId = varKpiId), 'Sort key')`. The KPI score
table has the parent's id in **Parent id**, so use
`Filter(colNow, 'Parent id' = varKpiId)` if `ParentKpiId` isn't there. Show
each child's name, score cell, weight, and its **contribution**, the
child's share of the parent's score:

```text
If(ThisItem.'Has score' && varScore.'Scored weight' > 0,
   Text(ThisItem.'Exact score' * ThisItem.'Scored weight' / varScore.'Scored weight', "0.00"), "–")
```

The contributions add up to the parent's score. A child with no score
contributes nothing and doesn't count against the parent: its weight is
left out, not scored as zero.

**Section 4: Month by month.** Insert a **Line chart** (Insert → Charts →
Line chart) and set its **Items**:

```text
ForAll(varYearMonths As m, {
    Month: Text(Date(Value(Left(m.Period, 4)), Value(Right(m.Period, 2)), 1), "mmm"),
    Score: LookUp(colKpiScores, Period = m.Period && 'Has score').Score })
```

Set the chart's Y axis to run from 0 to 5 if your version allows. Below it,
a gallery over `varYearMonths` showing, per month: the month, the value
(`LookUp(colKpiValues, Period = ThisItem.Period).Value`), its basis, and a
score cell reading `LookUp(colKpiScores, Period = ThisItem.Period)`.

**Section 5: Progress updates.**

> **Do this:**
>
> 1. A gallery `galUpdates`, **Items** `Sort(Filter('Progress updates', KPI.KPI = GUID(varKpiId)), 'Created On', SortOrder.Descending)`. In its template: the author and date (`ThisItem.Author & " · " & Text(ThisItem.'Created On', "dd/mm/yyyy")`), the period, and the text: in **Detailed** mode the four headed fields, in **Simple** mode the body:
>
>    ```text
>    If(ThisItem.Mode = 'Update mode'.Simple, ThisItem.Body,
>       "Current progress: " & ThisItem.'Current progress' & Char(10) &
>       "Next steps: " & ThisItem.'Next progress' & Char(10) &
>       "Time and cost: " & ThisItem.'Time and cost' & Char(10) &
>       "Issues: " & ThisItem.Issues)
>    ```
>
> 2. A form container, **Visible** `varCanReport`, with: a **Toggle** or radio `rdMode` (**Items** `["Detailed", "Simple"]`, **Default** `"Detailed"`); four multiline text inputs shown in Detailed mode (`txtCurrent`, `txtNext`, `txtTimeCost`, `txtIssues`); one multiline input `txtBody` shown in Simple mode; and a **Combo box** `cbStatus` for the status, **Items** `'KPI status options'`, with **Allow searching** on so a new status can be typed.
> 3. A **Button** `"Post update"`, **OnSelect** (Procedure M; no confirm box, because updates only ever add):
>
>    ```text
>    Set(varResult, AppAddProgressUpdate.Run(varKpiId, JSON({
>        period: varPeriod, mode: rdMode.Selected.Value,
>        body: If(rdMode.Selected.Value = "Simple", txtBody.Text, Blank()),
>        currentProgress: If(rdMode.Selected.Value = "Detailed", txtCurrent.Text, Blank()),
>        nextProgress: If(rdMode.Selected.Value = "Detailed", txtNext.Text, Blank()),
>        timeAndCost: If(rdMode.Selected.Value = "Detailed", txtTimeCost.Text, Blank()),
>        issues: If(rdMode.Selected.Value = "Detailed", txtIssues.Text, Blank()),
>        status: Coalesce(cbStatus.Selected.Name, cbStatus.SearchText)}, JSONFormat.IgnoreUnsupportedTypes)));
>    Notify(varResult.message, If(varResult.ok, NotificationType.Success, NotificationType.Error));
>    If(varResult.ok, Reset(txtCurrent); Reset(txtNext); Reset(txtTimeCost); Reset(txtIssues); Reset(txtBody); Refresh('Progress updates'))
>    ```

**Section 6: Definition and targets.** This form mirrors the web app's
settings panel. Show it to everyone, but let only admins save; members get
a **Propose change** button instead.

| Field | Control | Default |
| --- | --- | --- |
| Name, Code, Sub-group, Unit, Status | Text inputs | the KPI's columns |
| Weight % (of group) | Text input, Number | `varKpi.Weight` |
| Owning departments | Combo box, multi-select, **Items** `Filter(Departments, 'Is active' = true)` | `Filter(Departments, Text(Department) in Filter(colKpiDepts, KpiId = varKpiId).DeptId)` |
| Metric type, Direction, Target mode, Frequency, Phasing | Drop downs, **Items** `Choices('Metric type')` and so on | the KPI's columns |
| Six band targets | for Fixed: one number each; for Range: two numbers each (min, max). Name them `txtPOOR`, `txtPOOR2`, `txtIMPROVEMENT_NEEDED`, … | read from `varTargets` as in Section 3 |
| Target month (Month completion) | Drop down over `varYearMonths` | `varTargets.targetMonth` |
| Phase shares (Custom phasing) | 12 number inputs, April first | `Index(Table(ParseJSON(varKpi.'Phase shares')), n).Value` |
| Deadline month | Drop down over `varYearMonths`, with a blank first item | `varKpi.'Deadline month'` |
| Score final after deadline, Completed | Toggles | the KPI's columns |
| Completed period | Drop down over `varYearMonths` | `varKpi.'Completed period'` |
| Clear these figures | Checkbox, shown only when the metric type changes between Month completion and anything else | false |

Show the band inputs only on leaf KPIs, and the second (max) input only when
Target mode is Range.

Build the settings as JSON for the flows with this formula. Put it in a
named formula-like label, `lblSettingsJson`, with **Visible** `false`, so
both buttons can use it:

```text
JSON({
    name: Trim(txtName.Text), code: Trim(txtCode.Text), weight: Value(txtWeight.Text),
    subGroup: Trim(txtSubGroup.Text), status: Trim(txtStatus.Text), unit: Trim(txtUnit.Text),
    metricType: ddMetric.Selected.Value, direction: ddDirection.Selected.Value, targetMode: ddTargetMode.Selected.Value,
    targetConfig: If(ddMetric.Selected.Value = 'Metric type'.'Month completion', JSON({targetMonth: ddTargetMonth.Selected.Period}),
        ddTargetMode.Selected.Value = 'Target mode'.Range,
            JSON({POOR: [Value(txtPOOR.Text), Value(txtPOOR2.Text)], IMPROVEMENT_NEEDED: [Value(txtIMPROVEMENT_NEEDED.Text), Value(txtIMPROVEMENT_NEEDED2.Text)],
                  MEET: [Value(txtMEET.Text), Value(txtMEET2.Text)], GOOD: [Value(txtGOOD.Text), Value(txtGOOD2.Text)],
                  VERY_GOOD: [Value(txtVERY_GOOD.Text), Value(txtVERY_GOOD2.Text)], EXCELLENT: [Value(txtEXCELLENT.Text), Value(txtEXCELLENT2.Text)]}),
            JSON({POOR: Value(txtPOOR.Text), IMPROVEMENT_NEEDED: Value(txtIMPROVEMENT_NEEDED.Text), MEET: Value(txtMEET.Text),
                  GOOD: Value(txtGOOD.Text), VERY_GOOD: Value(txtVERY_GOOD.Text), EXCELLENT: Value(txtEXCELLENT.Text)})),
    deadlineMonth: ddDeadline.Selected.Period, scoreFinalAfterDeadline: tglFinal.Value,
    completed: tglCompleted.Value, completedPeriod: ddCompletedPeriod.Selected.Period,
    frequency: ddFrequency.Selected.Value, phasing: ddPhasing.Selected.Value,
    phaseShares: JSON([Value(txtShare1.Text), Value(txtShare2.Text), Value(txtShare3.Text), Value(txtShare4.Text), Value(txtShare5.Text), Value(txtShare6.Text),
                       Value(txtShare7.Text), Value(txtShare8.Text), Value(txtShare9.Text), Value(txtShare10.Text), Value(txtShare11.Text), Value(txtShare12.Text)]),
    departmentIds: ForAll(cbDepts.SelectedItems As d, Text(d.Department)),
    clearFigures: chkClear.Value
}, JSONFormat.IgnoreUnsupportedTypes)
```

Choice values turn into their labels in JSON, which is what A02 expects.
If your version writes them as numbers instead, wrap each one in `Text( )`.

> **Do this:** add two buttons under the form.
>
> - `btnSaveSettings`, **Visible** `IsAdmin`. **OnSelect** fills `colChanges` with one row per changed field (compare each input with `varKpi`, as Section 2 does) and opens the confirm box. The confirm box runs `AppSaveKpiSettings.Run(varKpiId, lblSettingsJson.Text)` with Procedure M.
> - `btnPropose`, **Visible** `!IsAdmin && varKpiId in colMyKpiIds.KpiId`, **Text** `"Propose change"`. Its confirm box runs `AppProposeKpiChange.Run(varKpiId, lblSettingsJson.Text, JSON(colChanges))`.
>
> Above the form, add a yellow **Label** for a waiting proposal: **Visible** `!IsBlank(LookUp('Change proposals', KPI.KPI = GUID(varKpiId) && Status = 'Proposal status'.Pending))`, **Text** `"A settings change is waiting for an admin to approve it."`
>
> **Check it worked:** as the admin, change KPI 1.2's Meet target from 120 to 110 and save: one change row appears under **Changes to this KPI**. Put it back. As the Member, the button says **Propose change**, and saving shows "Your change has been sent to an admin for approval."

**Section 7: Score override** (admins, leaf KPIs). A container, **Visible**
`IsAdmin && varKpi.'Is leaf'`, with a number input `txtOverride` (0 to 5), a
multiline `txtReason`, a **Save override** button running
`AppOverrideScore.Run(varKpiId, varPeriod, Value(txtOverride.Text), txtReason.Text)`,
and a **Clear override** button, **Visible**
`!IsBlank(LookUp('Score overrides', KPI.KPI = GUID(varKpiId) && Period = varPeriod))`,
running `AppClearOverride.Run(varKpiId, varPeriod)`. Both use Procedure M.

**Section 8: history.** Two galleries:

- **Changes to this KPI:** `Sort(Filter('KPI definition changes', KPI.KPI = GUID(varKpiId)), 'Created On', SortOrder.Descending)`, showing `Text(ThisItem.'Created On', "dd/mm/yyyy hh:mm") & " · " & ThisItem.Author & " · " & ThisItem.Label & ": " & Coalesce(ThisItem.From, "—") & " → " & Coalesce(ThisItem.To, "—")`.
- **Achievement change log:** the same over `'KPI value changes'`, showing the period, the field, from and to, and `ThisItem.'Author username'`. Hide the whole section when the gallery is empty, as the web app does.

### 7.7 Enter Data

**What it shows:** a grid of every leaf KPI you can report on for the chosen
month (all of them for admins), with last month's figure as a hint. You
change any cells, press **Save**, check the list of changes, and confirm.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrEntry`. Add the flow **AppSaveFigures**.
> 2. **OnVisible** (it builds the grid's rows, each holding the old and new value of every field as text, so changes are easy to spot):
>
>    ```text
>    If(varLoadedKey <> Text(varYear.'Fiscal year') & varPeriod & varScenario,
>        Set(varAfterLoad, scrEntry); Navigate(scrLoading, ScreenTransition.None));
>    ClearCollect(colMonthValues, Filter('KPI values', 'Fiscal year'.'Fiscal year' = varYear.'Fiscal year' && Period = varPeriod));
>    ClearCollect(colEntry, ForAll(
>        Sort(Filter(colKpis, 'Is leaf' && (IsAdmin || KpiId in colMyKpiIds.KpiId)), 'Sort key') As k,
>        With({v: LookUp(colMonthValues, KPI.KPI = k.KPI)},
>            {KpiId: k.KpiId, Code: k.Code, Name: k.Name, Unit: Coalesce(k.Unit, ""),
>             IsMilestone: k.'Metric type' = 'Metric type'.'Month completion',
>             IsVariance: k.'Metric type' = 'Metric type'.Variance,
>             OldValue: If(IsBlank(v.Value), "", Text(v.Value)), NewValue: If(IsBlank(v.Value), "", Text(v.Value)),
>             OldPlanned: If(IsBlank(v.'Planned value'), "", Text(v.'Planned value')), NewPlanned: If(IsBlank(v.'Planned value'), "", Text(v.'Planned value')),
>             OldBasis: If(IsBlank(v), "", If(v.Basis = 'Value basis'.Estimate, "Estimate", "Actual")),
>             NewBasis: If(IsBlank(v), "", If(v.Basis = 'Value basis'.Estimate, "Estimate", "Actual")),
>             OldDate: Text(v.'Completion date', "yyyy-mm-dd"), NewDate: Text(v.'Completion date', "yyyy-mm-dd"),
>             OldNote: Coalesce(v.Note, ""), NewNote: Coalesce(v.Note, "")})))
>    ```
>
>    If **Enter Data** is slow to open for a big scorecard, this is why: it builds one row per KPI. A few hundred KPIs take a second or two.
>
> 3. Add a **Blank vertical gallery** `galEntry`, **Items** `colEntry`, **TemplateSize** `56`. In its template:
>
>    | Control | Formula |
>    | --- | --- |
>    | Label | `ThisItem.Code & "  " & ThisItem.Name` |
>    | Text input `txtV` (Number) | **Default** `ThisItem.NewValue`, **Visible** `!ThisItem.IsMilestone`, **OnChange** `Patch(colEntry, ThisItem, {NewValue: Self.Text, NewBasis: Coalesce(ThisItem.NewBasis, "Actual")})` |
>    | Label (unit) | `ThisItem.Unit` |
>    | Text input `txtP` (Number) | **Visible** `ThisItem.IsVariance`, **Default** `ThisItem.NewPlanned`, **OnChange** `Patch(colEntry, ThisItem, {NewPlanned: Self.Text, NewBasis: Coalesce(ThisItem.NewBasis, "Actual")})` |
>    | Date picker `dpD` | **Visible** `ThisItem.IsMilestone`, **DefaultDate** `If(ThisItem.NewDate = "", Blank(), DateValue(ThisItem.NewDate))`, **DateTimeZone** UTC, **OnChange** `Patch(colEntry, ThisItem, {NewDate: Text(Self.SelectedDate, "yyyy-mm-dd"), NewBasis: Coalesce(ThisItem.NewBasis, "Actual")})` |
>    | Drop down `ddB`, Items `["Actual", "Estimate"]` | **Default** `Coalesce(ThisItem.NewBasis, "Actual")`, **OnChange** `Patch(colEntry, ThisItem, {NewBasis: Self.Selected.Value})` |
>    | Text input `txtN` | **Default** `ThisItem.NewNote`, **OnChange** `Patch(colEntry, ThisItem, {NewNote: Trim(Self.Text)})` |
>    | Label (last month's figure) | `With({p: Text(Date(Value(Left(varPeriod, 4)), Value(Right(varPeriod, 2)) - 1, 1), "yyyy-mm")}, With({v: LookUp('KPI values', KPI.KPI = GUID(ThisItem.KpiId) && Period = p)}, If(IsBlank(v), "", "Last month: " & Text(v.Value, "#,##0.##"))))` |
>    | A thin **Rectangle** on the left edge | **Fill** `If(ThisItem.NewValue <> ThisItem.OldValue \|\| ThisItem.NewPlanned <> ThisItem.OldPlanned \|\| ThisItem.NewBasis <> ThisItem.OldBasis \|\| ThisItem.NewDate <> ThisItem.OldDate \|\| ThisItem.NewNote <> ThisItem.OldNote, Sky, Color.Transparent)`, so changed rows are marked |
>
>    (In the formula bar, type `||` without the backslashes. They're only there because of how this table is printed.)
>
> 4. A **Button** `btnSaveAll`, **Text** `"Save"`, **DisplayMode** `If(IsBlank(varYear.'Closed on') && !varBusy, DisplayMode.Edit, DisplayMode.Disabled)`, **OnSelect** — one confirm-box line per changed field, as the web app shows:
>
>    ```text
>    ClearCollect(colChanges, Filter(Ungroup(ForAll(colEntry As e, Table(
>        {Label: e.Code & " " & e.Name & " — Reported value", From: e.OldValue, To: e.NewValue},
>        {Label: e.Code & " " & e.Name & " — Target value", From: e.OldPlanned, To: e.NewPlanned},
>        {Label: e.Code & " " & e.Name & " — Basis", From: e.OldBasis, To: e.NewBasis},
>        {Label: e.Code & " " & e.Name & " — Completion date", From: e.OldDate, To: e.NewDate},
>        {Label: e.Code & " " & e.Name & " — Note", From: e.OldNote, To: e.NewNote})), Value), From <> To));
>    If(IsEmpty(colChanges), Notify("Nothing has changed.", NotificationType.Information), Set(varShowConfirm, true))
>    ```
>
> 5. Add a confirm box (Procedure L). **btnConfirm.OnSelect:**
>
>    ```text
>    Set(varBusy, true);
>    Set(varResult, AppSaveFigures.Run(JSON(ForAll(
>        Filter(colEntry, NewValue <> OldValue || NewPlanned <> OldPlanned || NewBasis <> OldBasis || NewDate <> OldDate || NewNote <> OldNote) As e,
>        {kpiId: e.KpiId, period: varPeriod,
>         value: If(e.NewValue = "", Blank(), Value(e.NewValue)),
>         plannedValue: If(e.NewPlanned = "", Blank(), Value(e.NewPlanned)),
>         basis: Coalesce(e.NewBasis, "Actual"),
>         completionDate: If(e.NewDate = "", Blank(), e.NewDate),
>         note: e.NewNote}), JSONFormat.IgnoreUnsupportedTypes)));
>    Set(varBusy, false); Set(varShowConfirm, false);
>    Notify(varResult.message, If(varResult.ok, NotificationType.Success, NotificationType.Error));
>    Set(varAfterLoad, scrEntry); Set(varLoadedKey, ""); Navigate(scrLoading, ScreenTransition.None)
>    ```
>
>    It reloads even when some figures failed, so the grid shows what was really saved. The message lists the ones that weren't.
>
> **Check it worked:**
>
> - As the Sales Member, only KPIs 1.1.1, 1.1.2, 1.2 and 1.3 are listed. As an admin, all eight leaves are.
> - Change KPI 2.2's figure, planned value, basis and note together: the confirm box lists **4** lines, one per field, and after saving the KPI page's Achievement change log shows 4 rows.
> - Clearing every field of a row and saving deletes that month's figure.
> - In a closed year, **Save** is greyed out.

### 7.8 Deadlines

**What it shows:** two lists. **Overdue**: time-bound KPIs past their date
without reaching target, whose scores are being capped or are already
fixed. **Due within three months**: what's coming up, soonest first.

A KPI is time-bound if it's a Month completion KPI (due in its target month)
or any other KPI, due in its **Deadline month**, or in March if it has none.
It drops off the lists once it's settled: a milestone completed with an
Actual date, or any other KPI scoring at least 3.0 by its due month.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrDeadlines`, with the same OnVisible check as the KPIs screen.
> 2. Add a hidden **Label** `lblNowIndex` with **Text** `Value(Left(varPeriod, 4)) * 12 + Value(Right(varPeriod, 2))`.
> 3. Set the screen's **OnVisible** to also build the list (after the first line):
>
>    ```text
>    ClearCollect(colTimeBound, Filter(ForAll(Filter(colKpis, 'Is leaf') As k,
>        With({s: LookUp(colNow, KpiId = k.KpiId),
>              due: If(k.'Metric type' = 'Metric type'.'Month completion',
>                      IfError(Text(ParseJSON(k.'Target config').targetMonth), ""),
>                      Coalesce(k.'Deadline month', Text(varYear.'Start year' + 1) & "-03"))},
>            With({away: If(due = "", 0, Value(Left(due, 4)) * 12 + Value(Right(due, 2)) - Value(lblNowIndex.Text))},
>                {KpiId: k.KpiId, Code: k.Code, Name: k.Name, Due: due, MonthsAway: away,
>                 Milestone: k.'Metric type' = 'Metric type'.'Month completion',
>                 Score: s.Score, Band: s.Band, HasScore: s.'Has score', Cap: s.'Deadline cap', Frozen: s.'Frozen at deadline',
>                 Settled: If(k.'Metric type' = 'Metric type'.'Month completion',
>                             !IsBlank(s.'Completion date used') && s.Basis = "Actual",
>                             Coalesce(s.Score, 0) >= 3 && away >= 0)}))),
>        Due <> "" && !Settled))
>    ```
>
> 4. Two galleries:
>    - **Overdue:** `Sort(Filter(colTimeBound, MonthsAway < 0), MonthsAway)`, red heading, showing code and name, the departments (as in 7.5), the due month as "Sep 2026", `-ThisItem.MonthsAway & " month(s) over"`, a score cell, and for capped KPIs `"capped at " & Text(ThisItem.Cap, "0.0")` or "fixed at deadline score".
>    - **Due within three months:** `Sort(Filter(colTimeBound, MonthsAway >= 0 && MonthsAway <= 3), MonthsAway)`, amber heading, showing `ThisItem.MonthsAway & " month(s) left"`.
>
>    Give each an empty-state label: "Nothing is overdue." and "Nothing falls due in the next three months."
>
> **Check it worked:** with September 2026 selected, **Due within three months** lists **2.3 New finance system live** (due Oct 2026, 1 month left). Nothing is overdue. With November 2026 and no completion date recorded, 2.3 moves to **Overdue**.

### 7.9 Insights

**What it shows:** the ten **biggest opportunities**, the KPIs whose next
band up would add most to the total, and the ten KPIs **at risk of
dropping** a band. The arithmetic matches the web app's:

- The total is the weighted average of every scored leaf's exact score, weighted by global weight. So lifting one leaf from score *s* to *t* adds exactly (*t* − *s*) × its global weight ÷ the total scored weight.
- The next band's target score is the **top** of that band for Fixed targets (they score in steps) and the **bottom** for Range targets (they score smoothly).
- A milestone is never an opportunity: once scored, its better bands are in the past.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrInsights` with the usual OnVisible check, then add to its **OnVisible**:

```text
Set(varW, Coalesce(varTotal.'Scored weight', 0));
ClearCollect(colOpps, Filter(ForAll(
    Filter(colNow As n, n.'Is leaf' && n.'Has score' && LookUp(colKpis, KpiId = n.KpiId).'Metric type' <> 'Metric type'.'Month completion') As r,
    With({k: LookUp(colKpis, KpiId = r.KpiId), b: LookUp(BandStyles, Band = r.Band)},
        With({nb: LookUp(BandStyles, Rank = b.Rank + 1)},
            With({target: If(k.'Target mode' = 'Target mode'.Fixed, nb.Hi, nb.Lo)},
                {KpiId: r.KpiId, Code: r.Code, Name: r.'KPI name', Score: r.Score, Band: r.Band,
                 NextBand: nb.Band, NextKey: nb.Key, Target: target,
                 Impact: If(IsBlank(nb) || varW = 0, 0, (target - r.'Exact score') * r.'Global weight' / varW)})))),
    !IsBlank(NextBand) && Impact > 0));
ClearCollect(colRisks, ForAll(
    Filter(colNow, 'Is leaf' && 'Has score') As r,
    With({k: LookUp(colKpis, KpiId = r.KpiId), b: LookUp(BandStyles, Band = r.Band),
          trail: Filter(ForAll(varMonths As m, {S: LookUp(colScores, KpiId = r.KpiId && Period = m.Period && 'Has score').Score, I: CountRows(Filter(varMonths, Period <= m.Period))}), !IsBlank(S))},
        With({slipping: k.'Metric type' = 'Metric type'.'Month completion' && IsBlank(r.'Completion date used'),
              slope: If(CountRows(trail) < 2, Blank(), (Last(trail).S - First(trail).S) / (Last(trail).I - First(trail).I))},
            {KpiId: r.KpiId, Code: r.Code, Name: r.'KPI name', Score: r.Score, Band: r.Band,
             Skip: (k.'Metric type' = 'Metric type'.'Month completion' && !slipping) || (b.Rank = 1 && !slipping),
             Headroom: r.'Exact score' - b.Lo,
             DropImpact: If(varW = 0, 0, (If(b.Rank = 1, 0, LookUp(BandStyles, Rank = b.Rank - 1).Hi) - r.'Exact score') * r.'Global weight' / varW),
             Trend: If(slipping, "Slipping milestone", IsBlank(slope), "Unknown", slope <= -0.05, "Declining", slope >= 0.05, "Improving", "Stable"),
             MonthsToDrop: If(!slipping && !IsBlank(slope) && slope <= -0.05, (r.'Exact score' - b.Lo) / Abs(slope), Blank()),
             Urgent: slipping || (!IsBlank(slope) && slope <= -0.05)}))));
RemoveIf(colRisks, Skip)
```

`Period <= m.Period` compares two "YYYY-MM" texts. If your version refuses
to compare text with `<=`, use
`Value(Substitute(Period, "-", "")) <= Value(Substitute(m.Period, "-", ""))`
instead. The trend is the change from the first to the last scored month of
the four shown, per month: a heads-up, not a forecast.

> 2. **Biggest opportunities.** A gallery, **Items** `FirstN(Sort(colOpps, Impact, SortOrder.Descending), 10)`, with columns: KPI (`ThisItem.Code & " " & ThisItem.Name`), Band (`ThisItem.Band & " → " & ThisItem.NextBand`), **Needed for next band** (the next band's target, read from the KPI's targets as in 7.6 Section 3, using `ThisItem.NextKey`), and **Impact on total** (`"+" & Text(ThisItem.Impact, "0.00")`).
> 3. Above it, a **Label**: `"If the top 10 each reach their next band, the total would be " & Text(Round(varTotal.'Exact score' + Sum(FirstN(Sort(colOpps, Impact, SortOrder.Descending), 10), Impact), 1), "0.0") & "."`
> 4. **At risk of dropping.** A gallery, **Items** `FirstN(SortByColumns(colRisks, "Urgent", SortOrder.Descending, "DropImpact", SortOrder.Ascending), 10)`, with columns: KPI, Band, **Headroom** (`Text(ThisItem.Headroom, "0.00") & " points"`), **Trend** (`ThisItem.Trend & If(IsBlank(ThisItem.MonthsToDrop), "", " · about " & Text(ThisItem.MonthsToDrop, "0") & " month(s) to drop")`), and **Impact if it drops** (`Text(ThisItem.DropImpact, "0.00")`).
>
> **Check it worked** with the sample data for September 2026. The total scored weight is 80, so:
>
> - **1.2 New customers** (2.9, weight 18, Fixed) is the top opportunity: Meet's top is 3.4, so the impact is (3.4 − 2.9) × 18 ÷ 80 = **+0.11** (0.1125).
> - **1.1.1 Revenue growth** (3.4 Meet, weight 16.8, Fixed) is next: Good's top is 3.9, so (3.9 − 3.4) × 16.8 ÷ 80 = **+0.11** as well (0.105).
> - **1.3 Customer satisfaction** (3.7, Range) needs Very good's **bottom**, 4.0. Its exact score is 3.6778, so (4.0 − 3.6778) × 18 ÷ 80 = **+0.07**.

### 7.10 Simulate

**What it shows:** every leaf KPI with its current figure, which you can
overwrite with a "what if" figure. The scores, the Goal cards and the total
update to show the effect. Nothing is saved.

The app sends only the changed KPIs to the **AppSimulate** flow, which
scores them with S5. It then works out the total and each Goal itself:
because missing figures are left out rather than counted as zero, the total
is exactly the weighted average of every scored leaf's score, weighted by
global weight. So the app can add the new scores up without running S6.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrSimulate` with the usual OnVisible check. Add the flow **AppSimulate**.
> 2. Add to **OnVisible**:
>
>    ```text
>    ClearCollect(colSim, ForAll(Sort(Filter(colNow, 'Is leaf'), 'Sort key') As r,
>        {KpiId: r.KpiId, Code: r.Code, Name: r.'KPI name', Path: r.Path, Weight: r.'Global weight',
>         Base: If(r.'Has score', r.'Exact score', Blank()), BaseBand: r.Band, Frozen: r.'Frozen at deadline',
>         Milestone: LookUp(colKpis, KpiId = r.KpiId).'Metric type' = 'Metric type'.'Month completion',
>         Variance: LookUp(colKpis, KpiId = r.KpiId).'Metric type' = 'Metric type'.Variance,
>         Value: If(IsBlank(r.'Value used'), "", Text(r.'Value used')), Planned: If(IsBlank(r.'Planned value used'), "", Text(r.'Planned value used')),
>         Date: Text(r.'Completion date used', "yyyy-mm-dd"),
>         Changed: false, Sim: If(r.'Has score', r.'Exact score', Blank()), SimBand: r.Band}))
>    ```
>
> 3. A gallery `galSim` over `colSim` with: code and name, weight, inputs for value (and planned for Variance, a date picker for milestones) whose **OnChange** is `Patch(colSim, ThisItem, {Value: Self.Text, Changed: true})` (with `Planned` or `Date` for the others), **DisplayMode** `If(ThisItem.Frozen, DisplayMode.Disabled, DisplayMode.Edit)`, and a score cell coloured from `ThisItem.SimBand` showing `Text(ThisItem.Sim, "0.0")`.
> 4. A **Button** `"Work out the scores"`:
>
>    ```text
>    Set(varBusy, true);
>    Set(varResult, AppSimulate.Run(varPeriod, JSON(ForAll(Filter(colSim, Changed) As c,
>        {kpiId: c.KpiId, value: If(c.Value = "", Blank(), Value(c.Value)),
>         plannedValue: If(c.Planned = "", Blank(), Value(c.Planned)),
>         completionDate: If(c.Date = "", Blank(), c.Date)}), JSONFormat.IgnoreUnsupportedTypes)));
>    Set(varBusy, false);
>    If(!varResult.ok, Notify(varResult.message, NotificationType.Error),
>        ForAll(Table(ParseJSON(varResult.data)) As x,
>            Patch(colSim, LookUp(colSim, KpiId = Text(x.Value.kpiId)),
>                {Sim: If(Boolean(x.Value.hasScore), Value(x.Value.score), Blank()), SimBand: Text(x.Value.band), Changed: false})))
>    ```
>
> 5. A **total tile** like the Dashboard's, with this score:
>
>    ```text
>    With({scored: Filter(colSim, !IsBlank(Sim))},
>        If(Sum(scored, Weight) = 0, Blank(), Round(Sum(scored, Sim * Weight) / Sum(scored, Weight), 1)))
>    ```
>
>    and its band from `LookUp(BandStyles, Lo <= score && score <= Hi)`. Beside it, the current total for comparison.
> 6. Goal cards: a horizontal gallery over `Sort(Filter(colNow, Level = 1), 'Sort key')`, each showing the same formula restricted to that Goal's leaves: `Filter(colSim, !IsBlank(Sim) && ("|" & ThisItem.KpiId & "|") in Path)`.
> 7. A **Reset** button: run the OnVisible formula again (`Select` a hidden button holding it, or navigate away and back).
>
> **Check it worked:** for September 2026, change KPI 1.1.1 to **95** and work out the scores: 1.1.1 becomes **4.5**, Grow the business **3.8**, and the total **3.7**, the same as the real recalculation in 5.13. KPI 1.1.1's real figure is unchanged.

### 7.11 Help

> **Do this:** duplicate `scrTemplate` as `scrHelp` and add an **HTML text** control (Insert → Display → HTML text) filling the screen, with **Overflow** set to scroll. Paste the text of the web app's **Help** page into its **HtmlText** property, inside quotes, with `<h2>` headings and `<p>` paragraphs. Add a short section at the top about the app's own differences: where to find the agent in Teams, and that scores take a few minutes to update after a save.

Appendix B, the scoring rulebook, is a good source for the "How scores
work" part.

### 7.12 Manage

**What it shows (admins):** the fiscal years, with buttons to create one,
make one active, close, reopen and delete it; and the departments.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrManage`. Set its **OnVisible** to `If(!IsAdmin, Navigate(scrDashboard))`.
> 2. Add the flows AppCreateFiscalYear, AppSetActiveFiscalYear, AppCloseFiscalYear, AppReopenFiscalYear, AppMoveYearToHolding and AppSaveDepartments.
> 3. **Fiscal years gallery**, **Items** `Sort(Filter('Fiscal years', IsBlank('Held on')), 'Start year', SortOrder.Descending)`. Show the label, "Active" if `'Is active'`, and "Closed dd/mm/yyyy" if closed. Buttons in the template:
>    - **Make active** (`Visible: !ThisItem.'Is active'`): `AppSetActiveFiscalYear.Run(Text(ThisItem.'Fiscal year'))`
>    - **Close** (`Visible: IsBlank(ThisItem.'Closed on')`): opens a confirm box saying "Close <label>? Its scores are worked out one last time and then fixed." → `AppCloseFiscalYear.Run(Text(ThisItem.'Fiscal year'))`. Closing takes several minutes, so show "Closing… this takes a few minutes" while `varBusy`.
>    - **Reopen** (`Visible: !IsBlank(ThisItem.'Closed on')`): asks for a reason in a text input, then `AppReopenFiscalYear.Run(Text(ThisItem.'Fiscal year'), txtReason.Text)`
>    - **Delete**: opens the delete box below.
> 4. **New fiscal year:** a number input `txtStartYear`, a drop-down `ddCopyFrom` (Items: the same years plus "Start empty"), and a **Create** button: `AppCreateFiscalYear.Run(Value(txtStartYear.Text), If(IsBlank(ddCopyFrom.Selected), "none", Text(ddCopyFrom.Selected.'Fiscal year')))`.
> 5. **The delete box.** Like the web app's, it asks for two things before anything happens: the admin's own username, and a typed phrase. Build a container with:
>    - a red **Label**: `varDeleteYear.Label & " moves to Holding for 30 days, then it is permanently deleted with all its KPIs, figures and history."`
>    - a text input `txtDelUser` (hint "Your username")
>    - a text input `txtDelPhrase`, with a label above it: `"Type: confirm delete " & varDeleteYear.Label & " scorecard"`
>    - a **Move to Holding** button, red, **DisplayMode** `If(txtDelPhrase.Text = "confirm delete " & varDeleteYear.Label & " scorecard", DisplayMode.Edit, DisplayMode.Disabled)`, running `AppMoveYearToHolding.Run(Text(varDeleteYear.'Fiscal year'), txtDelUser.Text, txtDelPhrase.Text)` with Procedure M.
>
>    The Delete button in the gallery sets `varDeleteYear` to `ThisItem` and shows the box.
> 6. **Departments:** a gallery over `Departments` with a name input and an **Active** toggle per row, an **Add department** input, and a **Save** button sending `JSON(ForAll(…, {id, name, isActive, remove}))` to `AppSaveDepartments`.
>
> **Check it worked:** create FY2027/28 copying FY2026/27: it appears with the same KPIs and no figures. Delete it with the wrong phrase: refused. With the right one, it disappears from the list and appears on the Holding screen.

### 7.13 Hierarchy

**What it shows (admins):** the KPI tree, where each row has buttons to add
a sub-KPI, move it up or down, move it under another parent, edit it, or
delete it.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrHierarchy` (admin check as in 7.12). Add AppCreateKpi, AppMoveKpi, AppReorderKpi and AppDeleteKpi.
> 2. A gallery `galHier` with **Items** `Sort(colKpis, 'Sort key')`, indented by level as in the Dashboard tree, showing code, name, sub-group (as a small grey tag), weight, and these icon buttons:
>    - **+** (add sub-KPI; hidden at level 5): sets `varNewParent` to `ThisItem.KpiId` and shows an inline form with **Name**, **Code** (optional; blank picks the next number) and **Sub-group**. Its **Add** button runs `AppCreateKpi.Run(Text(varYear.'Fiscal year'), varNewParent, txtNewName.Text, txtNewCode.Text, txtNewSub.Text)`.
>    - **↑** and **↓**: `AppReorderKpi.Run(ThisItem.KpiId, "up")` (or `"down"`).
>    - **Move**: shows a drop-down of possible parents, **Items** `Filter(colKpis As c, !(("|" & ThisItem.KpiId & "|") in Coalesce(LookUp(colNow, KpiId = c.KpiId).Path, "")) && c.KpiId <> ThisItem.KpiId && c.Level < 5)`, plus "Make it a Strategic Goal". Its **Move** button runs `AppMoveKpi.Run(ThisItem.KpiId, Coalesce(ddNewParent.Selected.KpiId, "none"))`.
>    - **Edit**: `Set(varKpiId, ThisItem.KpiId); Navigate(scrKpi)`, which opens the settings section.
>    - **Delete**: a confirm box listing the KPI and how many sub-KPIs go with it: `CountRows(Filter(colNow, ("|" & ThisItem.KpiId & "|") in Path)) - 1`. Then `AppDeleteKpi.Run(ThisItem.KpiId)`.
> 3. An **Add Strategic Goal** button at the top, running AppCreateKpi with parent `"none"`.
>
> After any change, reload (Procedure M). The hierarchy is refreshed by the recalculation, so new rows get their level and place in the list within a minute or two; until then they appear at the end.
>
> **Check it worked:** add a sub-KPI under 1.2 with a blank code: it gets code **1.2.1**. Move it under 2: it gets level 2 and appears under Run efficiently. Delete it.

### 7.14 Weights

**What it shows (admins):** one group of siblings at a time, with each
one's weight. Weights in a group should add up to 100%; the screen warns,
but still saves, if they don't, and the scores then use them in proportion.

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrWeights`. Add AppSetGroupWeights.
> 2. A drop-down `ddGroup` choosing the group: **Items** `Ungroup(Table({Value: Table({Name: "Strategic Goals", KpiId: "none"})}, {Value: ShowColumns(Sort(Filter(colKpis, !'Is leaf'), 'Sort key'), Name, KpiId)}), Value)`.
> 3. A **radio** `rdWeightMode` with `["Percent", "Ratio"]`. In Ratio mode, people type any numbers (for example 2, 1, 1) and the screen turns them into percentages.
> 4. **OnChange** of the group drop-down (and OnVisible) builds the rows:
>
>    ```text
>    ClearCollect(colWeights, ForAll(
>        Sort(Filter(colKpis, If(ddGroup.Selected.KpiId = "none", IsBlank(ParentKpiId) || ParentKpiId = "", ParentKpiId = ddGroup.Selected.KpiId)), 'Sort order') As k,
>        {KpiId: k.KpiId, Code: k.Code, Name: k.Name, SubGroup: Coalesce(k.'Sub-group', ""), Old: k.Weight, Input: Text(k.Weight)}))
>    ```
>
> 5. A gallery over `colWeights` with an input per row (**OnChange** `Patch(colWeights, ThisItem, {Input: Self.Text})`) and, in Ratio mode, a label with the resulting percentage: `Text(Value(ThisItem.Input) / Sum(colWeights, Value(Input)) * 100, "0.00") & "%"`.
> 6. A total label: `"Total " & Text(If(rdWeightMode.Selected.Value = "Ratio", 100, Sum(colWeights, Value(Input))), "0.00") & "%"`, coloured red when it isn't 100.00. If a group has sub-groups, add a second label per sub-group with its subtotal.
> 7. **Save** builds the list and calls the flow:
>
>    ```text
>    Set(varResult, AppSetGroupWeights.Run(Text(varYear.'Fiscal year'), ddGroup.Selected.KpiId, JSON(ForAll(colWeights As w,
>        {kpiId: w.KpiId, weight: If(rdWeightMode.Selected.Value = "Ratio", Round(Value(w.Input) / Sum(colWeights, Value(Input)) * 100, 4), Value(w.Input))}))))
>    ```
>
>    then shows the message (Procedure M).
>
> **Check it worked:** on the Strategic Goals group, set 50 and 50: the message says "Saved." and a few minutes later Goal 1's global weight is 50.00%. Set 60 and 40 back. Typing 60 and 30 saves with a warning that they add up to 90%.

### 7.15 Import and export

Build this screen in Part 9, once the Excel flows exist. It has:

- **Export to Excel** (everyone): runs the export flow for the selected year and month and opens the file it returns with `Launch(varResult.data)`.
- **Download the template** (everyone): `Launch(` the template file's SharePoint link `)`.
- **Import** (admins): an **Add picture**-style file picker, Update or Replace mode, a **Preview** button showing what would change and any errors, and an **Import** button, enabled only when the preview has no errors.
- **Export the audit trail** (admins).

### 7.16 Users and approvals

> **Do this:**
>
> 1. Duplicate `scrTemplate` as `scrUsers` (admin check). Add AppManageUser, AppApproveProposal and AppRejectProposal.
> 2. **Waiting for approval:** a gallery over `Filter('App users', Status = 'User status'.Pending)` showing username, email, company ID and department, with **Approve** (`AppManageUser.Run(Text(ThisItem.'App user'), "approve")`) and **Remove** (`… "remove"`) buttons.
> 3. **Everyone:** a gallery over `Sort('App users', Username)` with each person's role, a **Make admin** / **Make member** button (`"make-admin"` / `"make-member"`), and **Remove**. Hide both on your own row.
> 4. **Proposed changes:** a gallery over `Filter('Change proposals', Status = 'Proposal status'.Pending)`. Show the KPI (`ThisItem.KPI.Code & " " & ThisItem.KPI.Name`), who proposed it and when, and the list of changes: `Concat(Table(ParseJSON(ThisItem.Summary)), Text(ThisRecord.Value.Label) & ": " & Text(ThisRecord.Value.From) & " → " & Text(ThisRecord.Value.To), Char(10))`. Buttons: **Approve** (`AppApproveProposal.Run(Text(ThisItem.'Change proposal'))`) and **Reject**, which asks for an optional note (`AppRejectProposal.Run(Text(ThisItem.'Change proposal'), txtNote.Text)`).
>
> **Check it worked:** a new registration appears under **Waiting for approval**, and approving it lets that person in. The Member's proposal from 7.6 appears with its changes listed; approving it saves the change.

### 7.17 Holding, change log and backups

Three small admin screens. Duplicate `scrTemplate` for each, and add the
admin check.

**Holding** (`scrHolding`):

- A gallery over `Filter('Fiscal years', !IsBlank('Held on'))` showing the label, "Held by <username> on dd/mm/yyyy", and "Permanently deleted in <n> days": `DateDiff(Today(), DateValue(ThisItem.'Purge on'), TimeUnit.Days)`.
- A **Restore** button with a plain confirm box: `AppRestoreFromHolding.Run(Text(ThisItem.'Fiscal year'))`.
- Buttons at the top linking to the **Change log** and **Backups** screens.

**Change log** (`scrChangeLog`):

- A gallery over `Sort('Fiscal year events', 'Created On', SortOrder.Descending)` showing date and time (dd/mm/yyyy hh:mm), the year's label (`ThisItem.'Fiscal year label'`), the action (`ThisItem.Action`), the author and the reason.
- An **Export full audit trail (Excel)** button calling the audit-trail export flow from Part 9 and opening its link.

**Backups** (`scrBackups`):

- **OnVisible:** `Set(varCp, AppListCheckpoints.Run(Text(varYear.'Fiscal year'))); ClearCollect(colCheckpoints, ForAll(Table(ParseJSON(varCp.data)) As c, {Id: Text(c.Value.id), Name: Text(c.Value.name), Automatic: Boolean(c.Value.automatic), Kpis: Value(c.Value.kpiCount), Values: Value(c.Value.valueCount), CreatedOn: DateTimeValue(Text(c.Value.createdOn)), CreatedBy: Text(c.Value.createdBy)}))`
- A gallery over `colCheckpoints` with **Download** (`Launch(AppGetCheckpointFile.Run(ThisItem.Id).data)`), **Restore** and **Delete** (hidden for automatic ones).
- **Create checkpoint:** a name input and a button running `AppCreateCheckpoint.Run(Text(varYear.'Fiscal year'), txtCpName.Text, false)`.
- **Restore:** first runs **AppPreviewRestore** and shows its counts ("Remove 11 KPIs and 12 figures, add 11 KPIs and 12 figures") in a confirm box; **Confirm** runs **AppRestoreCheckpoint**.
- **Restore from a file:** an attachment control for a `.json` file; read its text and pass it as UploadedJson with CheckpointId `"none"`.

> **Check it worked:** create a checkpoint; it's listed with 11 KPIs and 12 figures. Download it: a `.json` file opens. Restore it: an automatic "Before restore" checkpoint appears too, and the Change log shows **Restored from checkpoint**.

### 7.18 Share the app with a test user

> **Do this:**
>
> 1. **Save** and then **Publish** the app (top right).
> 2. In [make.powerapps.com](https://make.powerapps.com) → **Apps**, select **KPI Scorecard** → **Share**. Add the **KPI Scorecard Users** group from 1.2. Leave **Co-owner** unticked.
> 3. When Power Apps lists the data the app uses, the security role from Part 4 already covers it. Click **Share**.
> 4. Ask your test colleague to open the app's link.
>
> **Check it worked:** they see the Welcome screen, can register, and after you approve them see the Dashboard, but not the Manage buttons.

Part 13 publishes the app to Teams for everyone.

---

## Part 8. Build the chat agent

The agent is a second way into the same scorecard, inside Microsoft Teams.
It's for the quick things people do most often: checking how things stand,
asking why a KPI scored what it did, reporting a figure, posting a progress
update and approving requests. For bigger jobs, such as changing targets or
reorganising the hierarchy, it sends people to the app with a link.

The agent never changes a table itself. It uses the same flows as the app,
so it follows exactly the same rules.

### 8.1 What the agent can do

Tick each line when its test in 8.12 passes.

| | Feature | Someone types… | How it works | Step |
| --- | --- | --- | --- | --- |
| [ ] | Greeting and sign-up | "Hi" / "Register me" | The welcome topic and **R01 Who am I**; the **AgentRegister** tool | 8.8, 8.9 |
| [ ] | Scorecard summary | "How are we doing this month?" / "Show me Grow the business for August" | **R02 Get scorecard** | 8.7 |
| [ ] | Find KPIs | "Which KPIs are about customers?" / "Which KPIs can I report on?" | **R03 Find KPIs** | 8.7 |
| [ ] | KPI detail and "why?" | "Why did 1.2 score 2.9?" | **R04 KPI detail**, plus the rulebook (Appendix B) | 8.7 |
| [ ] | Insights and deadlines | "What should we focus on?" / "What's due soon?" | **R05 Insights and deadlines** | 8.7 |
| [ ] | Report figures | "Revenue growth for September was 85" | The **Enter figures** topic: an AI prompt reads the figures, **R06** checks them, the person confirms, **AgentSaveFigures** saves | 8.10 |
| [ ] | Progress updates | "Post an update on 1.2" | **AgentAddProgressUpdate** | 8.8 |
| [ ] | Approvals (admins) | "Is anything waiting for approval?" / "Approve proposal 1003" | **R07 Waiting approvals**, **AgentApproveUser**, **AgentApproveProposal**, **AgentRejectProposal** | 8.7, 8.8 |
| [ ] | Excel export | "Send me the scorecard in Excel" | **AgentExportWorkbook** | 9.8 |
| [ ] | Board report | "Make the board report for September" | **AgentBoardReport** | 10.5 |
| [ ] | Everything else | "Change 1.2's targets" | The instructions send people to the app | 8.4 |

**New words in this part:**

| Word | What it means |
| --- | --- |
| **Instructions** | A page of plain-English rules the agent follows in every conversation. |
| **Generative orchestration** | The agent decides for itself which tool or topic to use, by reading their descriptions. This is why every tool's **description** matters: it's how the agent knows when to use it. |
| **Knowledge** | Documents the agent can read to answer questions. Here, just the scoring rulebook. |
| **Agent flow** | A flow that starts with the trigger **When an agent calls the flow** and ends with **Respond to the agent**. You build them inside Copilot Studio. |
| **Topic variable** | A value a topic remembers while it runs, written `Topic.Name`. **Global variables**, written `Global.Name`, last for the whole conversation. |
| **System.User.PrincipalName** | The sign-in address of the person chatting. Teams provides it, and nobody in the chat can change it. |

### 8.2 Before you start

> **Do this:**
>
> 1. **Make the KPI Scorecard solution the preferred solution**, so everything you create in Copilot Studio goes into it. In [make.powerapps.com](https://make.powerapps.com), open **Solutions**, select **KPI Scorecard**, and click **Set preferred solution** in the toolbar (it may be under **...**). If you don't see the option, carry on: step 8.12 shows how to add anything missing to the solution afterwards.
> 2. **Find the app's link.** In [make.powerapps.com](https://make.powerapps.com) → **Apps**, click **...** next to **KPI Scorecard** → **Details**. Copy the **Web link**. Paste it into a note: you'll need it in 8.4.
> 3. **Save the rulebook as a document.** Open Word, paste the whole grey box from **Appendix B, section B.9**, and save it as `Scorecard rulebook.docx`.

### 8.3 Create the agent

> **Do this:**
>
> 1. Open [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com). Check the environment picker (top right) says **KPI Scorecard**.
> 2. Click **Agents** in the left menu, then **+ New agent** (or **+ Create → New agent**).
> 3. In the box that asks you to describe your agent, paste:

```text
Create an agent called "Scorecard" for our company KPI scorecard. Staff use it in Microsoft Teams to see how
the company is performing against its KPIs for the fiscal year (1 April to 31 March), to ask why a KPI scored
what it did, to report monthly figures, to post progress updates, and, for admins, to approve registrations
and proposed changes. Everything else is done in the KPI Scorecard app. Users sign in with Microsoft. Scores
run from 0 to 5 in six bands: Poor, Improvement needed, Meet, Good, Very good, Excellent. Be concise and
businesslike.
```

> 4. Copilot fills in a name, a description and some instructions. Click **Create** (top right).
> 5. On the agent's **Overview** page, click **Edit** next to the name and icon. Set **Name** to `Scorecard`. Optionally upload the company logo as the icon (a square PNG under 30 KB works everywhere). Click **Save**.
>
> **Check it worked:** the agent opens on its **Overview** page, with a **Test** pane on the right.

### 8.4 Write the instructions

> **Do this:**
>
> 1. On the **Overview** page, find **Instructions** and click **Edit**.
> 2. Delete what Copilot wrote and paste the block below.
> 3. Replace `[APP LINK]` (it appears twice) with the app's web link from 8.2.
> 4. Click **Save**.

```text
You are Scorecard, the assistant for our company KPI scorecard.

WHO YOU'RE TALKING TO
- The welcome message already checked who the person is. If they ask to register, use the AgentRegister
  tool: it asks for a username, their company ID number and their department.
- If a tool says the person isn't registered or is waiting for approval, say so, and do nothing else.
- Members may read everything, report figures and post progress updates for KPIs their own department owns.
  Admins may do everything. The tools check this; don't guess, and show the tool's message if it refuses.

WHICH YEAR AND MONTH
- Unless the person names another, use the active fiscal year and the current month: pass Year "active" and
  Period "current" to the tools. If they name a month, pass it as YYYY-MM ("August" in FY2026/27 is 2026-08,
  "February" is 2027-02). If they name a year, pass its label, e.g. "FY2025/26".
- Always say which month a figure or score is for, e.g. "September 2026".
- If a tool says the year is closed, tell the person an admin must reopen it before anything can change.

HOW TO TALK ABOUT SCORES
- Scores are 0 to 5 with one decimal. Always give the band with the score: "3.4 (Meet)".
- Weights are percentages with two decimals: "25.00%". Coverage and shares are whole percentages: "89%".
- Dates are dd/mm/yyyy. Months are written by name: "October 2026". Never use mm/dd/yyyy.
- Say "estimate" when a score rests on an estimate (provisional), "pro-rated" when its targets are phased,
  and "calibrated" when an admin overrode it.
- Mention coverage when it's under 100%: "3.5 (Good), on 89% of the weight reported".
- Missing figures are left out, not counted as zero. Say so when someone asks why a total moved.
- "Not yet due" means the KPI isn't due this month (for example a quarterly KPI between quarters).
- To explain a score, use the KPI detail tool and the rulebook in your knowledge, and show the arithmetic
  step by step. Never invent a figure, a target or a score. If a tool returns nothing, say there's no data.
- If a tool says scores aren't ready, explain that they're being recalculated and to try again in a few
  minutes.

REPORTING FIGURES
- When someone gives you monthly figures, actuals, estimates, budgets or completion dates for KPIs, use the
  "Enter figures" topic. Never use AgentSaveFigures any other way.
- Progress updates post straight away. Use AgentAddProgressUpdate. Ask for anything required that's missing.

APPROVALS (ADMINS)
- Use "Waiting approvals" to list what's waiting. Approve or reject only the item the admin names, by its
  username or proposal number.

WHAT YOU DON'T DO
- You can't change KPI settings, targets, weights or the hierarchy; create, close or delete fiscal years;
  restore backups; import spreadsheets; or override scores. For these, say they're done in the KPI Scorecard
  app and give this link: [APP LINK]
- For anything you can't answer from the tools or the rulebook, suggest the app: [APP LINK]
- Never reveal other people's company ID numbers, except to an admin reviewing registrations.
- Show tool messages as they are. Don't apologise. If something failed, say what to do next.
```

### 8.5 Settings and knowledge

> **Do this:**
>
> 1. Click **Settings** (top right of the agent).
> 2. **Generative AI** (sometimes called **Orchestration**): choose **Use generative AI orchestration** (or turn **Generative orchestration** on). Save.
> 3. On the same page, turn **off** **Use general knowledge** and **Use information from the web** (the names vary slightly). The agent should explain scores only from the rulebook and the tools, never from what it knows about KPIs in general. Save.
> 4. **Security → Authentication:** choose **Authenticate with Microsoft**. Save. This is what makes `System.User.PrincipalName` trustworthy.
> 5. Close Settings. Open the **Knowledge** tab and click **+ Add knowledge → Upload file**. Upload `Scorecard rulebook.docx`. When asked for a description, type: `The scorecard's scoring rules: bands, fixed and range targets, milestones, deadlines, phasing, frequency, roll-up and the dashboard options. Use it to explain why a KPI scored what it did.` Click **Add**.
>
> **Check it worked:** wait until the file's status says **Ready** (a few minutes). In the **Test** pane, ask *"What score does a fixed-target KPI get when it just reaches its Meet target?"* The answer is **3.4**, the top of the Meet band, and it cites the rulebook.
>
> **If something goes wrong:** if it answers vaguely without mentioning the rulebook, check general knowledge is off, then click the **refresh** icon at the top of the Test pane to start a new conversation.

### 8.6 Procedure N: build an agent flow and add it as a tool

Every agent flow is built the same way. There are two kinds:

- **Read flows** (R01 to R07) look things up and never change anything. They run the permission check (A00) themselves.
- **Agent wrappers** (`Agent…`) work like the app wrappers from Procedure K: they pass the request to a core flow from Part 6, which checks permission and makes the change. Some also turn a KPI code or a name into an id first.

> **Do this:**
>
> 1. In the agent, open the **Tools** tab and click **+ Add a tool → + New tool → Agent flow**. The flow designer opens with two steps already in place: the trigger **When an agent calls the flow** and the last step **Respond to the agent**.
> 2. Click the flow's name at the top left and type the name the guide gives, for example `R02 Get scorecard`.
> 3. Click the trigger, then **+ Add an input → Text**, and name it `CallerEmail`. Add the other inputs the guide lists, with the types it gives. Inputs are Text unless the guide says otherwise.
> 4. Add **Initialize variable** `CallerEmail`, type **String**, value: the trigger's **CallerEmail** from Dynamic content.
> 5. **For a read flow:**
>    1. Add **Run a Child Flow** → **A00 Check permission**, renamed `Check`: **CallerEmail** `variables('CallerEmail')`, **Need** `signed-in` (or `admin` where the guide says so), **KpiId** `none`.
>    2. Add a **Condition** `If_allowed`: `body('Check')?['allowed']` **is equal to** `true`.
>    3. On the **False** side, add **Respond to the agent** with three outputs: **Yes/No** `Ok` = `false`, **Text** `Message` = `body('Check')?['message']`, **Text** `Data` left empty.
>    4. Drag the original **Respond to the agent** onto the **True** side (or delete it and add a new one there at the end). Give it the same three outputs.
>    5. Build the steps in between. For most flows the guide gives a Copilot prompt: click **Copilot** in the designer and paste the **agent flow ground rules** (below), then the flow's own prompt.
> 6. **For an agent wrapper:** add the steps the guide lists, then **Run a Child Flow** with the core flow, renamed `Core`, and fill its inputs. Set **Respond to the agent**'s outputs to **Yes/No** `Ok` = `body('Core')?['ok']`, **Text** `Message` = `body('Core')?['message']` and **Text** `Data` = `body('Core')?['data']`.
> 7. Click **Save draft**, then **Publish**. When asked to sign in for a connection, use the service account (4.5).
> 8. Go back to the agent (the browser tab with Copilot Studio). The **Add tool** window now lists your flow. Select it and click **Add and configure** (if the window has closed, click **+ Add a tool** again, search for the flow and pick it). On the tool's page:
>    - **Name** and **Description:** type the ones the guide gives. The description is what the agent reads to decide when to use the tool, so copy it exactly.
>    - **Inputs:** click **CallerEmail**, set **Fill using** to **Custom value**, click the **fx** button and type `System.User.PrincipalName`. This fills in the person's sign-in address automatically, so the AI can never make one up. Leave the other inputs on **Dynamically fill with AI**, and paste the input descriptions the guide gives.
>    - **When will this be used?** (under **Additional details** or **Availability**): **Agent may use this tool at any time**, unless the guide says **Only when referenced by topics or agents**.
>    - **Ask the user before running** (also called **User confirmation**): turn it on only where the guide says so, and paste the confirmation message given.
>    - Click **Save**.
>
> **Check it worked:** in the Test pane, type something the tool's description covers. The pane shows the tool being called (click **Show activity** or the activity map icon to see it), with CallerEmail filled with your address.
>
> **If something goes wrong:**
>
> - **Run a Child Flow** doesn't list A00: the agent flow isn't in the KPI Scorecard solution. In **Solutions → KPI Scorecard → Add existing → Automation → Cloud flow**, add it, then try again.
> - The tool keeps asking the person for their email: CallerEmail is still on **Dynamically fill with AI**. Change it to **Custom value**.
> - **A00 says you aren't registered** although you are: your sign-in address differs from your App user **Email**. Open the flow's run history, click the trigger, and use the address shown there. (Some companies sign in with one address and email with another. If so, use `System.User.Email` instead of `System.User.PrincipalName`, here and in the topics.)

**The agent flow ground rules.** Paste this in front of every read flow's prompt:

```text
This agent flow is part of the KPI Scorecard solution. All tables use the publisher prefix sc_. It starts with
"When an agent calls the flow" and ends with "Respond to the agent", which has three outputs: Ok (Yes/No),
Message (Text) and Data (Text, holding JSON). The permission check is already built: the child flow action
"Check" returns allowed, message, isadmin, userid, username, companyid and departmentid. Build on the True side
of the condition "If_allowed". Use the Microsoft Dataverse connector for every table. This flow only reads:
never add, change or delete any row. On any refusal, respond straight away with Ok = false, the Message given
and Data empty, and stop. Otherwise respond with Ok = true, Message empty and Data = the JSON described, built
with Compose and Select actions and passed through string(). Write months as "YYYY-MM", and round decimals to
4 places.
```

**The year-and-month rule.** R02 to R05 take a **Year** and a **Period**. Paste
this paragraph after the ground rules in each of their prompts:

```text
Choose the fiscal year from the Year input. If Year is "active", use the Fiscal year with Is active = Yes and
an empty Held on; if there is none, the one with an empty Held on and the highest Start year. Otherwise use the
Fiscal year whose Label equals Year and whose Held on is empty; if there is none, refuse with "There's no fiscal
year called <Year>." Then choose the month from the Period input. If Period is "current", take today's month in
local time, convertFromUtc(utcNow(),'Singapore Standard Time','yyyy-MM'), and move it to "<Start year>-04" if
it's earlier or to "<Start year + 1>-03" if it's later. Otherwise Period must be a month from "<Start year>-04"
to "<Start year + 1>-03"; if not, refuse with "<Period> isn't in <Label>, which runs from April <Start year>
to March <Start year + 1>." Only ever read scores whose Scenario is "standard".
```

### 8.7 The read tools

Build these with Procedure N. R01 is built by hand, so you see every step
once; the others are built with Copilot.

#### R01 Who am I

**Inputs:** CallerEmail. **No permission check:** it must work for people who
aren't registered yet, so skip step 5.1 to 5.3 of Procedure N and keep the one
**Respond to the agent** at the end.

> **Do this:** after the **CallerEmail** variable, add:
>
> 1. **List rows** `Find_user`. **Table name:** App users. **Select columns:** `sc_username,sc_email,_sc_department_value,sc_role,sc_status`. **Row count:** `1`. **Filter rows:**
>
>    ```text
>    concat('sc_email eq ''',replace(variables('CallerEmail'),'''',''''''),'''')
>    ```
>
> 2. **List rows** `Years`. **Table name:** Fiscal years. **Select columns:** `sc_fiscalyearid,sc_label,sc_startyear,sc_isactive,sc_closedon`. **Filter rows:** `sc_heldon eq null`. **Sort by:** `sc_isactive desc,sc_startyear desc`. **Row count:** `1`. This picks the active year, or failing that the latest one.
> 3. **Compose** `Year`: `first(outputs('Years')?['body/value'])`
> 4. **Compose** `Today`: `convertFromUtc(utcNow(), 'Singapore Standard Time', 'yyyy-MM')`
> 5. **Compose** `ReportingMonth`. It's today's month, kept inside the fiscal year:
>
>    ```text
>    if(empty(outputs('Year')), outputs('Today'),
>      if(less(outputs('Today'), concat(string(outputs('Year')?['sc_startyear']), '-04')),
>        concat(string(outputs('Year')?['sc_startyear']), '-04'),
>        if(greater(outputs('Today'), concat(string(add(outputs('Year')?['sc_startyear'], 1)), '-03')),
>          concat(string(add(outputs('Year')?['sc_startyear'], 1)), '-03'),
>          outputs('Today'))))
>    ```
>
> 6. **List rows** `Departments`. **Table name:** Departments. **Select columns:** `sc_name`. **Filter rows:** `sc_isactive eq true`. **Sort by:** `sc_name asc`.
> 7. **Select** `DepartmentNames`. **From:** `outputs('Departments')?['body/value']`. Switch **Map** to text mode (the **T** icon) and enter `item()?['sc_name']`.
> 8. On **Respond to the agent**, add these outputs:
>
>    | Output | Type | Value |
>    | --- | --- | --- |
>    | `Registered` | Yes/No | `greater(length(outputs('Find_user')?['body/value']), 0)` |
>    | `Status` | Text | `coalesce(first(outputs('Find_user')?['body/value'])?['sc_status@OData.Community.Display.V1.FormattedValue'], '')` |
>    | `Role` | Text | `coalesce(first(outputs('Find_user')?['body/value'])?['sc_role@OData.Community.Display.V1.FormattedValue'], '')` |
>    | `Username` | Text | `coalesce(first(outputs('Find_user')?['body/value'])?['sc_username'], '')` |
>    | `Department` | Text | `coalesce(first(outputs('Find_user')?['body/value'])?['_sc_department_value@OData.Community.Display.V1.FormattedValue'], '')` |
>    | `YearLabel` | Text | `coalesce(outputs('Year')?['sc_label'], '')` |
>    | `YearClosed` | Yes/No | `not(empty(outputs('Year')?['sc_closedon']))` |
>    | `ReportingMonth` | Text | `outputs('ReportingMonth')` |
>    | `Departments` | Text | `join(body('DepartmentNames'), ', ')` |
>
> 9. Save draft, publish, and add it as a tool (Procedure N, step 8):
>    - **Name:** `Who am I`
>    - **Description:** `Finds out who the person chatting is: whether they're registered, approved, their role (Member or Admin) and department, plus the active fiscal year and the current reporting month. Also lists the departments to choose from when registering.`
>
> **Check it worked:** run it from the designer's **Test** button with your own email: Registered **Yes**, Status **Approved**, Role **Admin**, YearLabel **FY2026/27**. With `nobody@example.com`: Registered **No** and Departments **Finance, Sales**.

#### R02 Get scorecard

**Inputs:** CallerEmail, Year, Period, Focus. **Need:** `signed-in`.

**Tool name:** `Get scorecard`. **Description:** `Gets the company's total score
for a month, with each Strategic Goal's score, or one KPI's score with its
sub-KPIs, plus the trend over the last four months. Use it for "how are we
doing" questions and to drill into a goal or KPI.`

**Input descriptions:** Year: `"active", or a fiscal year label such as
FY2025/26.` Period: `"current", or a month as YYYY-MM.` Focus: `"all" for the
whole company, or a KPI code such as 1 or 1.2 to show that KPI and the KPIs
directly beneath it.`

```text
(the ground rules, then the year-and-month rule)
Let Trail be the chosen month and up to three months before it, oldest first, keeping only months from
"<Start year>-04" onwards.
Get the "Total score" rows for the fiscal year with Scenario "standard" and Period in Trail.
If Focus is "all", list the "KPI score" rows for the fiscal year, the chosen Period and Scenario "standard"
with Level = 1. Otherwise find the KPI with Code = Focus in the fiscal year (refuse with "There's no KPI <Focus>
in <Label>." if none), and list the KPI score rows for that KPI and for every KPI whose Parent id is its id.
Sort them by Sort key. For each of those KPIs also get their KPI score rows for the other months in Trail.
Respond with Data:
{"year": <Label>, "closed": <Closed on is set>, "period": <Period>, "scoresReady": <a Total score row exists
for Period>,
 "total": {"score", "band", "coverage", "provisionalShare", "notYetDueShare", "proratedShare",
           "scoredLeafCount", "leafCount"} from Period's Total score row, or null,
 "totalTrend": [{"period", "score", "band"} for each month of Trail],
 "kpis": [{"code", "name", "level", "isLeaf", "localWeight", "globalWeight", "hasScore", "score", "band",
           "pendingReason", "provisional", "prorated", "overridden", "coverage",
           "trend": [{"period", "score"} for each month of Trail]}]}
```

> **Check it worked:** the flow has a **Respond to the agent** on both sides of If_allowed, and the Data JSON is built with **Select** actions rather than a loop with many variables (it's quicker). Test it with Year `active`, Period `2026-09` and Focus `all`: total score **3.5**, band **Good**, coverage **0.8889**, and two KPIs: **1 Grow the business 3.5 Good** (global weight 60) and **2 Run efficiently 3.4 Meet** (40). With Focus `1`: rows for 1, 1.1 (3.7), 1.2 (2.9) and 1.3 (3.7).

#### R03 Find KPIs

**Inputs:** CallerEmail, Search, Year, Period. **Need:** `signed-in`.

**Tool name:** `Find KPIs`. **Description:** `Searches the KPIs by code or name
and returns each one's code, name, place in the hierarchy, owning departments,
current score and whether the person may report on it. Search "mine" to list
the KPIs the person's own department owns.`

**Input description:** Search: `Words from the KPI's name, a KPI code, "mine"
for the person's own KPIs, or "all".`

```text
(the ground rules, then the year-and-month rule)
List every KPI of the fiscal year with its code, name, Level, Is leaf, Path and Sort key. Get each KPI's owning
departments with the FetchXML query given below (aliased "d"), and join their names with ", ".
Keep the KPIs that match Search: if Search is "all", every KPI; if "mine", the leaf KPIs owned by the
department in Check's departmentid; otherwise KPIs whose Code equals Search, or whose Code starts with
Search followed by ".", or whose Name contains Search (ignoring capitals).
Keep at most 25, sorted by Sort key. For each, get its KPI score row for the chosen Period (Scenario "standard").
"canReport" is true when the KPI is a leaf and either Check's isadmin is true or one of its departments is
Check's departmentid.
"path" is the names of its parents from the top down, joined with " › " (look them up through Path, which
holds "|id|id|…|").
Respond with Data: {"year", "period", "count": <matches before the limit>, "kpis": [{"code", "name", "path",
"level", "isLeaf", "departments", "canReport", "score", "band", "pendingReason"}]}
```

The FetchXML for the departments (paste it into the **List rows** action's
**Fetch Xml Query** box; Copilot often can't write this part):

```xml
<fetch>
  <entity name="sc_kpi">
    <attribute name="sc_kpiid" />
    <filter>
      <condition attribute="sc_fiscalyear" operator="eq" value="@{outputs('Year')?['sc_fiscalyearid']}" />
    </filter>
    <link-entity name="sc_kpi_sc_department" from="sc_kpiid" to="sc_kpiid" link-type="outer" intersect="true">
      <link-entity name="sc_department" from="sc_departmentid" to="sc_departmentid" link-type="outer" alias="d">
        <attribute name="sc_departmentid" />
        <attribute name="sc_name" />
      </link-entity>
    </link-entity>
  </entity>
</fetch>
```

It returns one row per KPI and department, with the department in
`d.sc_name`. The `link-type="outer"` parts keep KPIs that have no department yet
(their `d.sc_name` is empty). Change `outputs('Year')?['sc_fiscalyearid']` to however your flow
holds the chosen year's id, and the relationship name if yours differs (6.2,
step 5).

> **Check it worked:** Search `customer` returns **1.2 New customers** and **1.3 Customer satisfaction**, both with departments **Sales**. Search `mine`, run with the Sales Member's email, returns 1.1.1, 1.1.2, 1.2 and 1.3, each with canReport **true**. Search `2.1` with the same email returns 2.1 with canReport **false**.

#### R04 KPI detail

**Inputs:** CallerEmail, KpiCode, Year, Period. **Need:** `signed-in`.

**Tool name:** `KPI detail`. **Description:** `Gets everything about one KPI
for a month: its settings and targets, weights, owning departments, the figure
and the exact score used, deadline effects, any override, its figures and
scores month by month, its sub-KPIs' contributions, and its latest progress
updates. Use it to explain why a KPI scored what it did.`

**Input description:** KpiCode: `The KPI's code, such as 1.2.3. Use Find KPIs
first if the person gave a name.`

```text
(the ground rules, then the year-and-month rule)
Find the KPI with Code = KpiCode in the fiscal year; refuse with "There's no KPI <KpiCode> in <Label>." if
none. Get its owning department names (same FetchXML as R03, filtered to this KPI), its parents' names (from
Path), its KPI value rows for the fiscal year (sorted by Period), its KPI score rows for the fiscal year with
Scenario "standard" (sorted by Period), its Score override for Period if any, the KPI score rows for Period of
every KPI whose Parent id is its id, its 3 newest Progress update rows, and whether it has a Change proposal with
Status Pending.
Respond with Data:
{"year", "closed", "period", "id", "code", "name", "path", "departments", "status", "isLeaf",
 "localWeight", "globalWeight", "metricType", "unit", "direction", "targetMode", "targets": <Target config as
 JSON>, "frequency", "phasing", "phaseShares", "deadlineMonth", "scoreFinalAfterDeadline", "completed",
 "completedPeriod",
 "score": {"hasScore", "score", "exactScore", "band", "pendingReason", "basis", "valueUsed",
           "plannedValueUsed", "completionDateUsed", "rawScore", "deadlineCap", "monthsLate",
           "frozenAtDeadline", "provisional", "prorated", "overridden", "coverage"} for Period, or null,
 "override": {"score", "reason", "by"} or null,
 "figures": [{"period", "value", "basis", "plannedValue", "completionDate" (as dd/mm/yyyy), "note"}],
 "scores": [{"period", "score", "band", "pendingReason"}],
 "children": [{"code", "name", "localWeight", "globalWeight", "score", "exactScore", "scoredWeight",
               "contribution": exactScore x scoredWeight / (the sum of scoredWeight over the children) }],
 "updates": [{"period", "author", "postedOn" (dd/mm/yyyy), "currentProgress", "nextProgress", "timeAndCost",
              "issues", "body"}],
 "pendingProposal": <true or false>}
Write choice columns by their labels (e.g. "Higher is better"), not their numbers.
```

> **Check it worked:** KpiCode `1.2`, Period `2026-09`: score **2.9**, band **Improvement needed**, valueUsed **55**, prorated **true**, phasing **Even**, targets with Meet **120**. KpiCode `1.1`: two children, 1.1.1 (exact score 3.4, scored weight 16.8) and 1.1.2 (4.5, 7.2).

#### R05 Insights and deadlines

**Inputs:** CallerEmail, Year, Period. **Need:** `signed-in`.

**Tool name:** `Insights and deadlines`. **Description:** `Lists the KPIs that
would lift the total score most by reaching their next band, the KPIs at risk
of dropping a band, overdue time-bound KPIs and those due within three months.
Use it for "what should we focus on", "what's at risk" and "what's due"
questions.`

```text
(the ground rules, then the year-and-month rule)
Use the fiscal year's KPIs and their KPI score rows (Scenario "standard") for Period and the three months
before it (Trail, as in R02). W = the Scored weight of Period's Total score row. Bands, worst first, with their
score ranges: Poor 0-2.4, Improvement needed 2.5-2.9, Meet 3.0-3.4, Good 3.5-3.9, Very good 4.0-4.5,
Excellent 4.6-5.0.
OPPORTUNITIES: every leaf with a score for Period that isn't a Month completion KPI and isn't in Excellent.
Target = the next band's top if its Target mode is Fixed, or the next band's bottom if Range.
Impact = (Target - Exact score) x Global weight / W. Keep Impact > 0. Return the 10 largest, with code, name,
score, band, nextBand, impact.
RISKS: every leaf with a score for Period, except Month completion KPIs that have a completion date used, and
except leaves already in Poor unless they're a Month completion KPI without a completion date (a "slipping
milestone"). Headroom = Exact score - the bottom of its band. DropImpact = (the top of the band below, or 0 for
Poor, - Exact score) x Global weight / W. From its scored months in Trail, slope = (last score - first score)
/ (months between them), or none if fewer than two. Trend = "Slipping milestone", or "Unknown" with no slope,
"Declining" if slope <= -0.05, "Improving" if slope >= 0.05, else "Stable". MonthsToDrop = Headroom / |slope|
when Declining. Urgent = slipping or Declining. Return 10, urgent first, then by DropImpact (most negative
first), with code, name, score, band, headroom, dropImpact, trend, monthsToDrop.
DEADLINES: every leaf that is time-bound. Its due month is its targetMonth (from Target config) for a Month
completion KPI, otherwise its Deadline month, or "<Start year + 1>-03" if it has none. MonthsAway = months from
Period to the due month. Leave it out once settled: a Month completion KPI whose score row has a Completion date
used and Basis "Actual", or any other KPI scoring 3.0 or more with MonthsAway >= 0. Overdue = MonthsAway < 0,
soonest-missed first; dueSoon = MonthsAway 0 to 3, soonest first. Return code, name, due, monthsAway, score,
band, deadlineCap and frozenAtDeadline.
Respond with Data: {"year", "period", "totalScore", "opportunities": [...], "risks": [...], "overdue": [...],
"dueSoon": [...]}
```

> **Check it worked** with Period `2026-09` (W is 80): the first three opportunities are **1.1.1** (Meet → Good, impact **0.105**), **1.2** (Improvement needed → Meet, **0.1125**) and **1.3** (Good → Very good, **0.0725**: its exact score is 3.6778). Sorted by impact, 1.2 comes first. **dueSoon** holds **2.3 New finance system live**, due **2026-10**, monthsAway **1**. **overdue** is empty.

#### R07 Waiting approvals

**Inputs:** CallerEmail. **Need:** `admin`.

**Tool name:** `Waiting approvals`. **Description:** `For admins: lists people
waiting for their registration to be approved and KPI changes proposed by
members that are waiting for review.`

```text
(the ground rules)
List App users with Status Pending, with their username, email, company ID number, department name and
Created on (dd/mm/yyyy). List Change proposals with Status Pending, newest first, with Name (the proposal
number), the KPI's code and name, the proposer's username, Created on (dd/mm/yyyy) and the Summary (a JSON list
of {label, from, to}).
Respond with Data: {"users": [{"username", "email", "companyId", "department", "registeredOn"}],
"proposals": [{"number", "kpi", "proposedBy", "proposedOn", "changes": [{"label", "from", "to"}]}]}
```

> **Check it worked:** run it with your email: two empty lists if nothing is waiting. With the Sales Member's email: Ok **No**, "Only admins can do this."

### 8.8 The write tools

These are agent wrappers (Procedure N, step 6). Each one makes a change, so the
core flow checks permission. The agent asks for any input that's missing
before it runs them.

#### AgentRegister

**Inputs:** CallerEmail, Username, CompanyId, Department. **Core flow:** A25
Register.

> **Do this:**
>
> 1. **List rows** `Find_department`: table Departments, **Filter rows** `concat('sc_name eq ''', replace(triggerBody()?['text_3'], '''', ''''''), ''' and sc_isactive eq true')`, **Row count** `1`. (`text_3` is the fourth text input, Department. If the formula complains, delete `triggerBody()?['text_3']` and pick **Department** from Dynamic content instead.)
> 2. **Condition** `If_found`: `length(outputs('Find_department')?['body/value'])` **is greater than** `0`. On the **False** side: **Respond to the agent** with Ok `false`, Message `There's no department called that. Choose one of the departments listed when you asked to register.`, Data empty.
> 3. On the **True** side: **Run a Child Flow** → A25 Register, renamed `Core`: CallerEmail, Username and CompanyId from the trigger, **DepartmentId** `first(outputs('Find_department')?['body/value'])?['sc_departmentid']`. Then **Respond to the agent** as in Procedure N, step 6.
>
> **Tool name:** `Register`. **Description:** `Registers the person for the KPI Scorecard. Use it when someone who isn't registered wants to sign up. Before using it, tell them the department names from Who am I.`
>
> **Inputs:** Username: `The username they want, without spaces.` CompanyId: `Their company ID number.` Department: `The name of their department, exactly as listed.`
>
> **Check it worked:** in the Test pane, sign in as a colleague with no App user row (or test the flow with a made-up email) and say *"Register me"*. The agent asks for a username, company ID and department, and replies "Thanks. An admin will approve your account soon."

#### AgentAddProgressUpdate

**Inputs:** CallerEmail, KpiCode, Period, CurrentProgress, NextProgress,
TimeAndCost, Issues, Status. **Core flow:** A13 Add progress update.

> **Do this:** paste this into Copilot in the flow designer, after the trigger and the variable:

```text
Find the active fiscal year: the Fiscal year with Is active = Yes and an empty Held on, or else the one with
an empty Held on and the highest Start year. Find the KPI with Code = KpiCode in that year; if there's none,
respond to the agent with Ok = false, Message "There's no KPI <KpiCode> in <Label>." and stop.
Work out the month: if Period is empty or "current", today's month in local time
(convertFromUtc(utcNow(),'Singapore Standard Time','yyyy-MM')) kept between "<Start year>-04" and
"<Start year + 1>-03"; otherwise Period.
Build UpdateJson: {"period": <month>, "mode": "Detailed", "body": null, "currentProgress": CurrentProgress,
"nextProgress": NextProgress, "timeAndCost": TimeAndCost, "issues": Issues, "status": Status}, using null for
any input that is empty or "none".
Run the child flow "A13 Add progress update" (action name Core) with CallerEmail, the KPI's id and UpdateJson.
Respond to the agent with Ok, Message and Data from Core.
```

> **Tool name:** `Add progress update`. **Description:** `Posts a written progress update on a KPI: current progress, next steps, time and cost, issues, and optionally a new status such as "On track". Use it when someone wants to give an update, not a figure.`
>
> **Inputs:** KpiCode: `The KPI's code. Use Find KPIs if they gave a name.` Period: `"current", or the month as YYYY-MM.` CurrentProgress: `What has been done so far.` NextProgress: `What happens next.` TimeAndCost: `Any time or cost impact, or "none".` Issues: `Any issues or risks, or "none".` Status: `A short status such as "On track" or "Delayed", or "none".` Mark **KpiCode** and **CurrentProgress** as required (**Should prompt user**: Yes); leave the rest optional.
>
> **Check it worked:** say *"Post an update on 1.2: we signed 12 new customers this month, next we start the October campaign"*. The agent replies "Update posted.", and the update appears on KPI 1.2's page in the app.

#### AgentApproveUser, AgentApproveProposal and AgentRejectProposal

Approvals post straight away, so these three tools ask the admin to confirm
first, using Copilot Studio's own confirmation.

| Wrapper | Inputs | Before calling the core flow | Core flow |
| --- | --- | --- | --- |
| AgentApproveUser | CallerEmail, Username | **List rows** on App users, filter `sc_username eq '<Username>'`, row count 1. If none, respond Ok `false`, "There's no one called <Username> waiting." | A26 Manage user, with **UserId** the row's `sc_appuserid` and **Action** `approve` |
| AgentApproveProposal | CallerEmail, ProposalNumber | **List rows** on Change proposals, filter `sc_name eq '<ProposalNumber>'`, row count 1. If none, respond Ok `false`, "There's no proposal <ProposalNumber>." | A04 Approve proposal, with **ProposalId** the row's `sc_changeproposalid` |
| AgentRejectProposal | CallerEmail, ProposalNumber, Note | The same lookup as AgentApproveProposal | A05 Reject proposal, with **ProposalId** and **Note** |

Build each filter like AgentRegister's, with `replace(…, '''', '''''')` around
the input so a name with an apostrophe can't break it.

| Tool name | Description | Confirmation message |
| --- | --- | --- |
| `Approve registration` | `For admins: approves a person's registration, by username. Use Waiting approvals first to see who is waiting.` | `Approve this registration?` |
| `Approve proposal` | `For admins: approves a member's proposed KPI change, by proposal number, and saves the change.` | `Approve this proposal and save the change?` |
| `Reject proposal` | `For admins: rejects a member's proposed KPI change, by proposal number, with an optional note to the member.` | `Reject this proposal?` |

Turn on **Ask the user before running** for all three.

> **Check it worked:** register a test user, then say *"Is anything waiting for approval?"* The agent lists them. Say *"Approve them"*: the agent asks you to confirm, then replies with A26's message. The person can now use the app.

### 8.9 The welcome

When someone opens the chat, the agent should greet them by name, or tell
them how to register. You'll edit the built-in **Conversation Start** topic.
This is the first topic you edit, so it's explained step by step.

> **Do this:**
>
> 1. Open the **Topics** tab, click **System**, and open **Conversation Start**. The topic opens as a flowchart of **nodes**, each one a step.
> 2. Delete the existing **Message** node: click its **...** → **Delete**.
> 3. Below the trigger, click **+** → **Add a tool**, and choose **Who am I**. In the node, set **CallerEmail** to `System.User.PrincipalName` (click the **>** next to the box, choose **Formula**, and type it). Under **Outputs**, each output becomes a variable such as `Topic.Registered`.
> 4. Add **+** → **Variable management → Set a variable value**. Click **Select a variable → Create new**, rename the new variable `Global.Role` (select it, and in the **Variable properties** pane set its name to `Role` and its **Usage** to **Global**). Set its value to `Topic.Role`. Do the same for `Global.ReportingMonth` (value `Topic.ReportingMonth`) and `Global.YearLabel` (value `Topic.YearLabel`).
> 5. Add **+** → **Add a condition**. In the first branch, choose `Topic.Registered` **is equal to** `false`. Under it, add **+ → Send a message**, click **{x}** to insert variables as you type, and enter:
>
>    *Hello! You aren't registered for the KPI Scorecard yet. Say **register me** to sign up. The departments are: {Topic.Departments}.*
>
> 6. Click **+ New condition** to add a second branch: `Topic.Status` **is equal to** `Pending`. Message: *Hello {Topic.Username}. Your registration is waiting for an admin to approve it.*
> 7. In the **All other conditions** branch, add a message:
>
>    *Hello {Topic.Username} ({Topic.Role}, {Topic.Department}). I can tell you how the scorecard stands for {Topic.YearLabel}, explain any score, take your monthly figures and progress updates, and show what's due. Try "How are we doing this month?"*
>
> 8. Click **Save** (top right).
>
> **Check it worked:** in the Test pane, click the **refresh** icon. The greeting uses your username and says **Admin**.
>
> **If something goes wrong:** if the greeting shows `{Topic.Username}` as text, the variable wasn't inserted. Delete the text and use the **{x}** button to insert it.

### 8.10 Entering figures

This is the agent's most important job, so it gets its own topic. People
type figures however they like; the agent turns them into a list, shows
exactly what will change, and saves only after they press **Confirm**.

```text
  "Revenue growth Sept 85, new customers 55"
        │
        ▼
  R06 Read and check figures ──► the "Read figures" AI prompt turns the words into a list
        │                         then each figure is checked and compared with what's saved
        ▼
  "1.1.1 Revenue growth, September 2026: Reported value 82 → 85 …   Save these changes?"
        │ Confirm
        ▼
  AgentSaveFigures ──► A01 Save figures
```

**Step 1: the "Read figures" prompt.** An AI prompt is a reusable
instruction for the AI, with gaps (inputs) filled in each time.

> **Do this:**
>
> 1. In the agent, open **Tools → + Add a tool → + New tool → Prompt**.
> 2. Name it `Read figures`.
> 3. Paste the instructions below. Where they show an input in square brackets, delete the square-bracket text and insert an input of that name instead: type **/** (or click **+ Add content → Text**), choose **Text**, and name it `Figures`, `KpiList`, `ReportingMonth` or `Today`.
> 4. Click **Settings** (or the **...** next to the model) and set **Output** to **JSON** if it's offered; otherwise leave it as **Text**.
> 5. Fill the test values below the inputs (use the test from the box underneath) and click **Test**. Then **Save**. You don't need to add it to the agent as a tool: R06 uses it.

```text
You turn a message about KPI figures into JSON. Reply with JSON only: no explanation and no code fences.

The person may report on these KPIs, one per line as code | name | metric type | unit:
[KpiList]

Their message:
[Figures]

The current reporting month is [ReportingMonth]. Today's date is [Today]. The fiscal year runs from April to
March.

Reply with {"entries": [...]}, one entry per KPI per month mentioned:
{"kpiCode": "...", "period": "YYYY-MM", "value": number or null, "plannedValue": number or null,
 "basis": "Actual" or "Estimate", "completionDate": "YYYY-MM-DD" or null, "note": text or null}

Rules:
- Match each KPI by its code or by the closest name in the list. If a KPI they mention isn't in the list, use
  "kpiCode": "?" and put the words they used in "note".
- A month named without a year belongs to the fiscal year that contains [ReportingMonth]: April to December
  are in its first calendar year, January to March in the next. If no month is mentioned, use [ReportingMonth].
- Write numbers plainly: no thousands separators, currency or % signs. "1.06m" is 1060000, "85%" is 85,
  "12k" is 12000.
- basis is "Estimate" if they say estimate, forecast, expected, projected, about or roughly; otherwise "Actual".
- For a Variance KPI, the budget, plan or planned figure goes in plannedValue and the actual in value.
- For a Month completion KPI, the date it was finished goes in completionDate and value stays null. Dates are
  written day first: 03/10/2026 is 3 October 2026. "Today" means [Today].
- Copy any comment they add about a figure into note.
- Never invent a figure. If you can't find any figures, reply {"entries": []}.
```

> **Test it** with these inputs:
>
> - **Figures:** `Revenue growth for September was 85, new customers 55 (estimate), finance system went live 03/10/2026`
> - **KpiList:** `1.1.1 | Revenue growth | Percentage | %` and on new lines `1.2 | New customers | Quantity |` and `2.3 | New finance system live | Month completion |`
> - **ReportingMonth:** `2026-10`. **Today:** `2026-10-08`
>
> **Check it worked:** three entries: 1.1.1 for `2026-09` with value **85**, Actual; 1.2 for `2026-09` with **55**, Estimate; 2.3 for `2026-10` with completionDate **2026-10-03**. (The figures for 1.1.1 and 1.2 take "September" from the sentence; 2.3's date has no month word, so it takes the reporting month.)
>
> **If something goes wrong:** if it puts September in 2027, check the "fiscal year" rule was pasted in full. If the answer starts with ```` ```json ````, add "Do not use code fences" to the first line, or rely on R06's clean-up step.

**Step 2: R06 Read and check figures.** A read flow (Procedure N), with
**Need** `signed-in`. **Inputs:** CallerEmail, Figures. Its **Respond to the
agent** has five outputs instead of three: **Yes/No** `Ok`, **Text**
`Message`, **Number** `ChangeCount`, **Text** `Preview` and **Text**
`EntriesJson`. Use the same five on the False side (ChangeCount `0`, the rest
empty).

> **Do this:** build these steps on the True side by hand, then paste the prompt underneath into Copilot for the checking loop.
>
> 1. Find the active year and the reporting month: copy steps 2 to 5 from R01 (**Years**, **Year**, **Today**, **ReportingMonth**). In the designer, you can copy an action with its **...** → **Copy to my clipboard**, then paste it with **+** → **My clipboard**.
> 2. **List rows** `Reportable`: the leaf KPIs of the year the person may report on. **Table name:** KPIs. **Fetch Xml Query:** the R03 FetchXML, with one more condition inside `<filter>`: `<condition attribute="sc_isleaf" operator="eq" value="1" />`, and the attributes `sc_code`, `sc_name`, `sc_unit` and `sc_metrictype` added under `sc_kpiid`.
> 3. **Filter array** `Mine`. **From:** `outputs('Reportable')?['body/value']`. Edit in advanced mode and paste:
>
>    ```text
>    @or(body('Check')?['isadmin'], equals(item()?['d.sc_departmentid'], body('Check')?['departmentid']))
>    ```
>
> 4. **Select** `KpiLines`. **From:** `body('Mine')`. **Map** (text mode):
>
>    ```text
>    concat(item()?['sc_code'], ' | ', item()?['sc_name'], ' | ', coalesce(item()?['sc_metrictype@OData.Community.Display.V1.FormattedValue'], ''), ' | ', coalesce(item()?['sc_unit'], ''))
>    ```
>
> 5. **Run a prompt** (AI Builder), renamed `Read`. **Prompt:** Read figures. **Figures:** the trigger's Figures input. **KpiList:** `join(union(body('KpiLines'), createArray()), decodeUriComponent('%0A'))` (the `union` removes the repeats that appear when a KPI has two departments; `%0A` is a new line). **ReportingMonth:** `outputs('ReportingMonth')`. **Today:** `convertFromUtc(utcNow(), 'Singapore Standard Time', 'yyyy-MM-dd')`.
> 6. **Compose** `Parsed`. It takes the prompt's answer, removes any code fences, and reads it as JSON:
>
> ````text
> json(trim(replace(replace(outputs('Read')?['body/responsev2/predictionOutput/text'], '```json', ''), '```', '')))?['entries']
> ````
>
> 7. Paste into Copilot (after the agent flow ground rules):

```text
For each entry in outputs('Parsed'), one at a time:
- If kpiCode is "?" or isn't found among the year's KPIs, add the problem "I couldn't find a KPI called
  <note or kpiCode>." and skip it.
- Run the child flow "A00 Check permission" with CallerEmail, Need "member-write" and the KPI's id. If not
  allowed, add the problem "<code> <name>: <message>" and skip it.
- If the year's Closed on is set, add the problem "<Label> is closed. Ask an admin to reopen it before
  recording changes." and skip it.
- If period is not between "<Start year>-04" and "<Start year + 1>-03", add the problem "<code>: <period> isn't
  in <Label>." and skip it.
- Get the existing KPI value row for the KPI and period, if any.
- Compare each field with the existing row: value, plannedValue, basis, completionDate, note. Only fields given
  in the entry (not null) count. For each different field add a change line:
  "<code> <name>, <month name and year>: <label>: <old or —> → <new>", where the labels are Reported value,
  Planned value, Basis, Completion date (written dd/mm/yyyy) and Note.
- Add the KPI to EntriesJson as {"kpiId", "period", "value", "plannedValue", "basis", "completionDate", "note"},
  taking any field not given from the existing row so nothing is cleared by accident.
Respond with Ok = true, ChangeCount = the number of change lines, Preview = the change lines, each starting with
"- ", joined with new lines, followed by a blank line and "Not saved:" and the problems, if there are any;
Message empty; EntriesJson = string(<the list>).
```

> **Check it worked:** test R06 with your email and Figures `Revenue growth September 86`: ChangeCount **1**, Preview `- 1.1.1 Revenue growth, September 2026: Reported value: 85 → 86`, and EntriesJson holds one entry with KPI 1.1.1's id. Nothing has changed in the KPI value table. With the Sales Member's email and `Days to close the books September 4`: ChangeCount **0**, and Preview says "Not saved:" and "2.1 Days to close the books: You can only change KPIs that your own department owns."
>
> **Tool:** add R06 with **Name** `Read and check figures`, **Description** `Reads figures typed in plain English and lists what would change. Used only by the Enter figures topic.`, and **When will this be used?** set to **Only when referenced by topics or agents**.

**Step 3: AgentSaveFigures.** An agent wrapper (Procedure N, step 6) with
inputs CallerEmail and EntriesJson, calling **A01 Save figures**. Add it as a
tool named `Save figures` with the description `Saves figures that the person
has already confirmed. Used only by the Enter figures topic.` and **Only when
referenced by topics or agents**.

**Step 4: the Enter figures topic.**

> **Do this:**
>
> 1. Open **Topics → + Add a topic → From blank**. Name it `Enter figures` (click **Untitled** at the top).
> 2. On the trigger node, in **Describe what the topic does**, paste: `The person wants to report, record, enter or update monthly figures for one or more KPIs: actual or estimated values, planned or budget figures, or completion dates.`
> 3. Click **Details** (top) → **Input** tab → **Create a new variable**. Name it `Figures`. **How will the agent fill this input?** Dynamically fill with best option. **Description:** `The figures the person gave, word for word, with KPI names or codes, months and numbers.` **Should prompt user:** Yes, with the question: `Which figures would you like to report? For example: "Revenue growth September 85, new customers 55 estimate".`
> 4. Back on the canvas, below the trigger, add **+ → Add a tool → Read and check figures**. Set **CallerEmail** to the formula `System.User.PrincipalName` and **Figures** to `Topic.Figures`. Its outputs become `Topic.Ok`, `Topic.Message`, `Topic.ChangeCount`, `Topic.Preview` and `Topic.EntriesJson`.
> 5. Add **+ → Add a condition**: `Topic.Ok` **is equal to** `false`. In that branch: a **Message** `{Topic.Message}`, then **+ → Topic management → End current topic**.
> 6. Add another branch (**+ New condition**): `Topic.ChangeCount` **is equal to** `0`. In it: a **Message** `Nothing to save. {Topic.Preview}` and **End current topic**.
> 7. In **All other conditions**:
>    1. **+ → Ask a question.** Question text: `These changes will be saved:` then a new line and `{Topic.Preview}`, then a new line and `Save them?`. **Identify:** Multiple choice options. Options: `Confirm` and `Cancel`. **Save user response as:** rename the variable `Choice`.
>    2. **+ → Add a condition**: `Topic.Choice` **is equal to** `Confirm`. In it, **+ → Add a tool → Save figures**, with **CallerEmail** `System.User.PrincipalName` and **EntriesJson** `Topic.EntriesJson`, then a **Message** `{Topic.Message}`. (If Copilot Studio named the second set of outputs `Topic.Message_1` or similar, use that name.)
>    3. In **All other conditions**: a **Message** `OK, nothing was saved.`
> 8. **Save.**
>
> **Check it worked:** in the Test pane, refresh and type *"Revenue growth for September was 86"*. The agent shows `- 1.1.1 Revenue growth, September 2026: Reported value: 85 → 86` and asks to confirm. Click **Confirm**: "Saved 1 figure(s)." A few minutes later, ask *"What did 1.1.1 score in September?"*: still **3.4 (Meet)**, as 86 is still in Meet. Then put 85 back the same way.
>
> **If something goes wrong:**
>
> - **The agent answers from its own head instead of using the topic:** check the topic's description (step 2) and the instructions' REPORTING FIGURES section, then refresh the Test pane.
> - **"Nothing to save" for a figure that should change:** test the Read figures prompt (step 1) with the same words; the KPI list may not contain that KPI because the person's department doesn't own it.

### 8.11 Make the welcome mention new tools

Each time you add a tool in later parts (the Excel export in Part 9, the board
report in Part 10), add a few words about it to the welcome message (8.9,
step 7) so people know it's there.

### 8.12 Test the whole agent

Run this conversation in the Test pane, signed in as yourself (an Admin),
with the sample data. Refresh the pane first. Tick each feature in 8.1 as it
passes.

| You type | The agent should… |
| --- | --- |
| *Hi* | Greet you by username, as an Admin |
| *How were we doing in September 2026?* | Say **3.5 (Good)** on 89% of the weight, with Grow the business **3.5 (Good)** and Run efficiently **3.4 (Meet)** |
| *Show me Grow the business* | List 1.1 Revenue **3.7**, 1.2 New customers **2.9**, 1.3 Customer satisfaction **3.7 (estimate)** |
| *Why did 1.2 score 2.9 in September 2026?* | Explain: 55 new customers; the targets are phased evenly, so by September (month 6 of 12) Meet's 120 becomes 60 and Improvement needed's 80 becomes 40; 55 reaches 40 but not 60, so it scores the top of Improvement needed, **2.9 (pro-rated)** |
| *What should we focus on?* | Name 1.2, 1.1.1 and 1.3 as the biggest opportunities, each worth about **+0.1** on the total |
| *What's due in the next few months?* | Name **2.3 New finance system live**, due **October 2026** |
| *Which KPIs are about customers?* | List 1.2 and 1.3, owned by Sales |
| *Revenue growth for September was 86* | Show the change from 85 to 86 and ask to confirm. **Cancel** saves nothing |
| *Post an update on 1.2: 12 new customers signed* | Ask for anything required that's missing, then reply "Update posted." |
| *Is anything waiting for approval?* | List waiting registrations and proposals, or say there are none |
| *Change 1.2's Meet target to 110* | Say this is done in the app and give its link |

Then repeat the figures line signed in as the **Sales Member** (ask them, or
use a test account) with *"Days to close the books for September was 4"*:
it must refuse, because Finance owns 2.1.

**Make sure everything is in the solution.** Open **Solutions → KPI Scorecard**.
The agent, the Read figures prompt and every agent flow should be listed. If
something is missing, click **Add existing** and add it (agents are under
**Agent** or **Chatbot**; agent flows under **Automation → Cloud flow**;
prompts under **AI → AI prompt**).

Part 13 publishes the agent to Teams for everyone.

---

## Part 9. Excel import and export

The new version reads and writes **exactly the same workbook** as the web
app: the same sheets (Readme, KPIs, Departments, Values, Updates, Scores), the
same columns and the same rules. So a file exported from the web app can be
imported here (Part 12 uses this to move your data across), and staff who
already know the template don't have to learn anything new.

### 9.1 How it works

Flows can't easily read or write a whole workbook by themselves, so two small
programs called **Office Scripts** do that part. They run inside Excel on the
web, and a flow can start them.

```text
  EXPORT   app or agent ──► A32 Export workbook ──► copies Blank.xlsx ──► "Write scorecard workbook" script fills it
                                     └──► returns a link to the finished file in Scorecard Exports

  IMPORT   admin puts the file in Scorecard Imports
           app ──► A33 Preview import ──► "Read scorecard workbook" script ──► what would change, and any problems
           app ──► A34 Apply import   ──► checkpoint first ──► KPIs, departments, figures, updates ──► recalculation
```

Both scripts were checked against the web app's own Excel code: 513 checks
covering the example workbook, the template, an export round trip and a
deliberately awkward file full of mistakes. They read the same columns, accept
the same formats and report problems in the same words. Two small differences
are listed in Part 16.

**Size limits.** A flow can pass about 5 MB to a script and wait about two
minutes for it. That covers a year of several thousand KPIs and figures. For
anything bigger, split the import into two files.

**New words in this part:**

| Word | What it means |
| --- | --- |
| **Office Script** | A small program saved as a `.osts` file that does things in an Excel workbook, like a macro. You paste it in; you don't need to understand it. |
| **Script parameter** | A value the flow hands to the script, such as the data to write. |

### 9.2 Ask IT to allow Office Scripts

Office Scripts are switched on or off for the whole company. Send IT this:

> **Subject:** Office Scripts for the KPI Scorecard
>
> Hi [name],
>
> The KPI Scorecard uses Office Scripts to read and write Excel files from Power Automate. Could you please check that, in the **Microsoft 365 admin center → Settings → Org settings → Office Scripts**, these are on for me and for the service account `scorecard.service@[company].com`:
>
> - **Let users automate their tasks in Office on the web**
> - **Let users with this permission run scripts in Power Automate**
>
> The service account also needs **Edit** access to the "KPI Scorecard" SharePoint site. Thank you!

> **Check it worked:** open any workbook in Excel on the web. The ribbon has an **Automate** tab.

### 9.3 Create the two scripts

> **Do this:**
>
> 1. Go to [office.com](https://www.office.com), open **Excel** and create a **Blank workbook**. Any workbook will do: the scripts are saved separately.
> 2. Click the **Automate** tab, then **New Script**. A code editor opens on the right with a few lines of sample code.
> 3. Select all the sample code (**Ctrl+A**) and delete it.
> 4. Paste the whole of the **Read scorecard workbook** script below. Copy it with the copy button in the box's corner so you get every line.
> 5. Click the script's name at the top of the editor ("Script 1" or similar) and rename it `Read scorecard workbook`. Click **Save script**.
> 6. Click **New Script** again, delete the sample, paste the **Write scorecard workbook** script, rename it `Write scorecard workbook` and save.
> 7. Excel saved both scripts in your OneDrive, in **My files → Documents → Office Scripts**. Open that folder in [OneDrive](https://onedrive.live.com/) (or from office.com → **OneDrive**). Select both `.osts` files, click **Copy to**, and copy them to the **KPI Scorecard** site → **Scorecard Templates** library.
>
> **Check it worked:** the **Scorecard Templates** library shows `Read scorecard workbook.osts` and `Write scorecard workbook.osts`.
>
> **If something goes wrong:**
>
> - **The editor shows red underlines after pasting:** part of the script is missing. Delete everything and paste again; the first line must start `// Office Script` and the last line is a single `}`.
> - **No Copy to option:** download the two files and upload them to the library instead.

**Choice numbers.** Both scripts start with a list called `CHOICES`, holding the
number of each choice item, as given in step 3.7 (Percentage is `100000000`,
and so on). If any of your choice numbers are different, change them in both
scripts before saving.

**The Read scorecard workbook script:**

```typescript
// Office Script "Read scorecard workbook".
// Reads a KPI Scorecard workbook (the web app's format) and returns what it holds as JSON text.
// mode: "update" or "replace".
// existingJson: the target year's current rows, straight from Dataverse (see Part 9):
//   {"kpis":[...], "values":[...], "departments":[...], "links":[...], "updates":[...]}
// Besides what the file holds, it works out what the import must do: which KPIs are new (with a new id),
// each KPI's parent id and department links, which figures are new, and which KPIs a Replace removes.

// Choice numbers, from step 3.7. Change these if your numbers differ.
const CHOICES: { [list: string]: { [name: string]: number } } = {
  metric: { PERCENTAGE: 100000000, DOLLAR: 100000001, QUANTITY: 100000002, DAYS: 100000003, MONTH_COMPLETION: 100000004, VARIANCE: 100000005 },
  direction: { HIGHER_BETTER: 100000000, LOWER_BETTER: 100000001 },
  mode: { FIXED: 100000000, RANGE: 100000001 },
  frequency: { MONTHLY: 100000000, QUARTERLY: 100000001, ANNUAL: 100000002 },
  phasing: { NONE: 100000000, EVEN: 100000001, CUSTOM: 100000002 },
  basis: { ACTUAL: 100000000, ESTIMATE: 100000001 },
  update: { DETAILED: 100000000, SIMPLE: 100000001 },
};
const BANDS = ["POOR", "IMPROVEMENT_NEEDED", "MEET", "GOOD", "VERY_GOOD", "EXCELLENT"];
const BAND_COLUMNS: { [band: string]: string } = {
  POOR: "Poor", IMPROVEMENT_NEEDED: "Improvement Needed", MEET: "Meet",
  GOOD: "Good", VERY_GOOD: "Very Good", EXCELLENT: "Excellent",
};
const KPI_COLUMNS = ["Code", "Name", "Parent Code", "Weight (of group)", "Departments", "Metric Type", "Unit",
  "Direction", "Target Mode", "Poor", "Improvement Needed", "Meet", "Good", "Very Good", "Excellent",
  "Deadline Month", "Score Final After Deadline", "Frequency", "Phasing", "Phase Shares", "Status"];
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];

type Cell = string | number | boolean;
interface Issue { row: number | null; message: string; }
interface Kpi {
  code: string; name: string; parentCode: string | null; weight: number; departments: string[];
  metricType: number | null; unit: string | null; direction: number | null; targetMode: number | null;
  targetConfig: string | null; deadlineMonth: string | null; scoreFinalAfterDeadline: boolean;
  frequency: number; phasing: number; phaseShares: string | null; status: string | null; sortOrder: number; row: number;
  id?: string; isNew?: boolean; parentId?: string | null; depth?: number;
  linksToAdd?: string[]; linksToRemove?: string[];
}
interface Value {
  code: string; period: string; value: number | null; plannedValue: number | null; basis: number;
  basisLabel: string; completionDate: string | null; note: string; row: number; kpiId?: string;
}
interface Update {
  id: string | null; code: string; period: string; mode: number; author: string | null; body: string | null;
  currentProgress: string | null; nextProgress: string | null; timeAndCost: string | null; issues: string | null; row: number;
  kpiId?: string; skip?: boolean;
}
type Raw = { [column: string]: string | number | boolean | null };
interface Existing { kpis?: Raw[]; values?: Raw[]; departments?: Raw[]; links?: Raw[]; updates?: Raw[]; }
interface Sheet { rows: Cell[][]; col: { [name: string]: number }; }

function main(workbook: ExcelScript.Workbook, mode: string, existingJson: string): string {
  const issues: Issue[] = [];
  const existing = JSON.parse(existingJson || "{}") as Existing;
  const kpiSheet = readSheet(workbook, "KPIs");
  if (!kpiSheet) {
    return JSON.stringify({ kpis: [], departments: [], values: [], updates: [], departmentsToCreate: [],
      issues: [{ row: null, message: 'The workbook has no "KPIs" sheet. Start from the downloadable template.' }], summary: null });
  }
  const missing = KPI_COLUMNS.filter((c) => kpiSheet.col[c.toLowerCase()] === undefined);
  if (missing.length > 0) {
    issues.push({ row: 1, message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` });
  }

  const kpis: Kpi[] = [];
  const seen: { [code: string]: number } = {};
  kpiSheet.rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (column: string): Cell => cellOf(kpiSheet, cells, column);
    const code = text(get("Code"));
    const name = text(get("Name"));
    if (!code && !name) return;
    if (!code) { issues.push({ row: rowNumber, message: `"${name}" has no Code. Every KPI needs one.` }); return; }
    if (!name) { issues.push({ row: rowNumber, message: `${code} has no Name.` }); return; }
    if (seen[code.toLowerCase()]) {
      issues.push({ row: rowNumber, message: `Code "${code}" is already used on row ${seen[code.toLowerCase()]}.` });
      return;
    }
    seen[code.toLowerCase()] = rowNumber;

    const weightCell = get("Weight (of group)");
    const weightFraction = text(weightCell) ? numberOf(weightCell) : 0;
    if (text(weightCell) && weightFraction === null) {
      issues.push({ row: rowNumber, message: `${code}: "${text(weightCell)}" is not a valid weight.` });
    }

    const frequencyText = text(get("Frequency")).toUpperCase().replace(/[\s-]+/g, "_");
    let frequency = CHOICES.frequency.MONTHLY;
    if (frequencyText && CHOICES.frequency[frequencyText] === undefined) {
      issues.push({ row: rowNumber, message: `${code}: "${text(get("Frequency"))}" is not a frequency. Use one of MONTHLY, QUARTERLY, ANNUAL.` });
    } else if (frequencyText) frequency = CHOICES.frequency[frequencyText];

    const phasingText = text(get("Phasing")).toUpperCase();
    let phasing = CHOICES.phasing.NONE;
    if (phasingText && CHOICES.phasing[phasingText] === undefined) {
      issues.push({ row: rowNumber, message: `${code}: "${text(get("Phasing"))}" is not a phasing option. Use one of NONE, EVEN, CUSTOM.` });
    } else if (phasingText) phasing = CHOICES.phasing[phasingText];

    let phaseShares: string | null = null;
    if (phasingText === "CUSTOM") {
      const shares = text(get("Phase Shares")).split(";").map((s) => parseNumber(s.trim()));
      const problem = phaseProblem(shares);
      if (shares.length !== 12 || shares.some((s) => s === null)) {
        issues.push({ row: rowNumber, message: `${code}: Phase Shares needs 12 numbers separated by semicolons when Phasing is Custom.` });
      } else if (problem) {
        issues.push({ row: rowNumber, message: `${code}: ${problem}` });
      } else {
        phaseShares = JSON.stringify(shares);
      }
    }

    const departments = text(get("Departments")).split(";").map((d) => d.trim()).filter((d) => d.length > 0);

    const metricText = text(get("Metric Type")).toUpperCase().replace(/[\s-]+/g, "_");
    const metricKey = CHOICES.metric[metricText] !== undefined ? metricText : null;
    if (metricText && !metricKey) {
      issues.push({ row: rowNumber, message: `${code}: "${text(get("Metric Type"))}" is not a metric type. Use one of PERCENTAGE, DOLLAR, QUANTITY, DAYS, MONTH_COMPLETION, VARIANCE.` });
    }

    const directionText = text(get("Direction")).toUpperCase().replace(/[\s-]+/g, "_");
    const direction = directionText === "HIGHER_BETTER" || directionText === "HIGHER" ? CHOICES.direction.HIGHER_BETTER
      : directionText === "LOWER_BETTER" || directionText === "LOWER" ? CHOICES.direction.LOWER_BETTER : null;

    const modeText = text(get("Target Mode")).toUpperCase();
    const targetMode = modeText === "FIXED" || modeText === "RANGE" ? modeText : null;

    const deadlineCell = get("Deadline Month");
    const deadlineMonth = text(deadlineCell) ? monthOf(deadlineCell) : null;
    if (text(deadlineCell) && !deadlineMonth) {
      issues.push({ row: rowNumber, message: `${code}: "${text(deadlineCell)}" is not a month. Use YYYY-MM, e.g. 2026-10.` });
    }

    const targetConfig = buildTargets(code, rowNumber, metricKey, targetMode, get, issues);
    const unit = text(get("Unit"));
    const status = text(get("Status"));
    const parentCode = text(get("Parent Code"));
    kpis.push({
      code, name, parentCode: parentCode || null,
      weight: weightFraction === null ? 0 : weightFraction * 100,
      departments,
      metricType: metricKey ? CHOICES.metric[metricKey] : null,
      unit: unit || null, direction,
      targetMode: targetMode ? CHOICES.mode[targetMode] : null,
      targetConfig, deadlineMonth,
      scoreFinalAfterDeadline: ["yes", "y", "true", "1"].indexOf(text(get("Score Final After Deadline")).toLowerCase()) >= 0,
      frequency, phasing, phaseShares, status: status || null,
      sortOrder: kpis.length, row: rowNumber,
    });
  });

  const codes: { [code: string]: boolean } = {};
  kpis.forEach((k) => { codes[k.code.toLowerCase()] = true; });
  kpis.forEach((k) => {
    if (k.parentCode && !codes[k.parentCode.toLowerCase()]) {
      issues.push({ row: k.row, message: `${k.code}: parent code "${k.parentCode}" does not match any KPI in this sheet.` });
    }
    if (k.parentCode && k.parentCode.toLowerCase() === k.code.toLowerCase()) {
      issues.push({ row: k.row, message: `${k.code} is listed as its own parent.` });
    }
  });

  const departmentSet: { [lower: string]: string } = {};
  const departmentSheet = readSheet(workbook, "Departments");
  if (departmentSheet) {
    departmentSheet.rows.forEach((cells) => {
      const name = text(cells[0]);
      if (name) departmentSet[name.toLowerCase()] = departmentSet[name.toLowerCase()] || name;
    });
  }
  kpis.forEach((k) => k.departments.forEach((d) => { departmentSet[d.toLowerCase()] = departmentSet[d.toLowerCase()] || d; }));
  const departments = Object.keys(departmentSet).map((key) => departmentSet[key]).sort();

  const values = readValues(workbook, codes, issues);
  const updates = readUpdates(workbook, codes, issues);

  // ---- What the import will do ----
  const current: { [code: string]: Raw } = {};
  (existing.kpis || []).forEach((k) => { current[String(k.sc_code).toLowerCase()] = k; });
  const deptId: { [name: string]: string } = {};
  (existing.departments || []).forEach((d) => { deptId[String(d.sc_name).toLowerCase()] = String(d.sc_departmentid); });
  const linked: { [kpiId: string]: string[] } = {};
  (existing.links || []).forEach((l) => {
    const id = String(l.sc_kpiid);
    (linked[id] = linked[id] || []).push(String(l["d.sc_departmentid"]));
  });

  const idOf: { [code: string]: string } = {};
  kpis.forEach((k) => {
    const match = current[k.code.toLowerCase()];
    k.isNew = !match;
    k.id = match ? String(match.sc_kpiid) : newId();
    idOf[k.code.toLowerCase()] = k.id;
  });
  const byCode: { [code: string]: Kpi } = {};
  kpis.forEach((k) => { byCode[k.code.toLowerCase()] = k; });
  kpis.forEach((k) => {
    k.parentId = k.parentCode ? idOf[k.parentCode.toLowerCase()] || null : null;
    const wanted = k.departments.map((d) => deptId[d.toLowerCase()]).filter((id) => !!id);
    const had = linked[k.id as string] || [];
    k.linksToAdd = wanted.filter((id, i) => had.indexOf(id) < 0 && wanted.indexOf(id) === i);
    k.linksToRemove = had.filter((id) => wanted.indexOf(id) < 0);
    // How deep it sits, so parents are written before their children.
    let depth = 1;
    let at: Kpi | undefined = k;
    while (at && at.parentCode && byCode[at.parentCode.toLowerCase()] && depth <= kpis.length) {
      at = byCode[at.parentCode.toLowerCase()];
      depth++;
    }
    const ownParent = !!k.parentCode && k.parentCode.toLowerCase() === k.code.toLowerCase();
    if (depth > kpis.length && !ownParent) issues.push({ row: k.row, message: `${k.code}: its Parent Code leads round in a circle back to itself.` });
    k.depth = depth;
  });
  values.forEach((v) => { v.kpiId = idOf[v.code.toLowerCase()]; });
  const knownUpdates: { [id: string]: boolean } = {};
  (existing.updates || []).forEach((u) => { knownUpdates[String(u.sc_progressupdateid).toLowerCase()] = true; });
  updates.forEach((u) => {
    u.kpiId = idOf[u.code.toLowerCase()];
    u.skip = !!u.id && !!knownUpdates[u.id.toLowerCase()];
  });

  const valueKeys: { [key: string]: boolean } = {};
  const codeOfId: { [id: string]: string } = {};
  (existing.kpis || []).forEach((k) => { codeOfId[String(k.sc_kpiid)] = String(k.sc_code).toLowerCase(); });
  (existing.values || []).forEach((v) => { valueKeys[`${codeOfId[String(v._sc_kpi_value)]}|${v.sc_period}`] = true; });
  const removed = mode === "replace"
    ? (existing.kpis || []).filter((k) => !codes[String(k.sc_code).toLowerCase()])
      .sort((a, b) => Number(b.sc_level || 0) - Number(a.sc_level || 0))
      .map((k) => ({ id: String(k.sc_kpiid), code: String(k.sc_code) }))
    : [];

  const summary = {
    mode: mode === "replace" ? "replace" : "update",
    kpisAdded: kpis.filter((k) => k.isNew).length,
    kpisUpdated: kpis.filter((k) => !k.isNew).length,
    kpisRemoved: removed.length,
    valuesAdded: values.filter((v) => !valueKeys[`${v.code.toLowerCase()}|${v.period}`]).length,
    valuesReplaced: values.filter((v) => valueKeys[`${v.code.toLowerCase()}|${v.period}`]).length,
    updatesAdded: updates.filter((u) => !u.skip).length,
    errors: issues.length,
  };
  const departmentsToCreate = departments.filter((d) => !deptId[d.toLowerCase()]);
  const kpisParentsFirst = kpis.slice().sort((a, b) => (a.depth as number) - (b.depth as number) || a.sortOrder - b.sortOrder);

  return JSON.stringify({ kpis, departments, values, updates, departmentsToCreate, issues, summary,
    kpisParentsFirst, kpisToRemove: removed });
}

// A random id in the format Dataverse uses.
function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r % 4) + 8).toString(16);
  });
}

function readSheet(workbook: ExcelScript.Workbook, name: string): Sheet | null {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return null;
  const used = sheet.getUsedRange(true);
  if (!used) return { rows: [], col: {} };
  // Start from A1, so column and row positions match what people see.
  const all = sheet.getRange("A1").getResizedRange(
    used.getRowIndex() + used.getRowCount() - 1,
    used.getColumnIndex() + used.getColumnCount() - 1).getValues() as Cell[][];
  const col: { [name: string]: number } = {};
  all[0].forEach((h, i) => { const n = text(h).toLowerCase(); if (n && col[n] === undefined) col[n] = i; });
  return { rows: all.slice(1), col };
}

function cellOf(sheet: Sheet, cells: Cell[], column: string): Cell {
  const i = sheet.col[column.toLowerCase()];
  return i === undefined ? "" : cells[i];
}

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(/[,\s$£€%]/g, ""));
  return isFinite(value) ? value : null;
}

function numberOf(cell: Cell): number | null {
  return typeof cell === "number" ? cell : parseNumber(text(cell));
}

function rangeOf(cell: Cell): number[] | null {
  if (typeof cell === "number") return [cell, cell];
  const cleaned = text(cell).replace(/\s*(?:to|–|—)\s*/gi, "-").trim();
  const match = cleaned.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    return isFinite(lo) && isFinite(hi) ? [lo, hi] : null;
  }
  const single = parseNumber(text(cell));
  return single === null ? null : [single, single];
}

// Excel stores dates as day numbers counted from 30 December 1899.
function serialToIso(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function monthOf(cell: Cell): string | null {
  if (typeof cell === "number") return cell > 59 ? serialToIso(cell).slice(0, 7) : null;
  const trimmed = text(cell);
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const month = Number(iso[2]);
    return month < 1 || month > 12 ? null : `${iso[1]}-${pad(month)}`;
  }
  const words = trimmed.toLowerCase().replace(/[,]/g, " ").split(/\s+/).filter((w) => w.length > 0);
  if (words.length !== 2) return null;
  const a = words[0];
  const b = words[1];
  const yearText = /^\d{4}$/.test(b) ? b : /^\d{4}$/.test(a) ? a : null;
  const monthText = yearText === b ? a : yearText === a ? b : null;
  if (!yearText || !monthText) return null;
  const index = MONTH_NAMES.findIndex((n) => n === monthText || n.slice(0, 3) === monthText);
  return index < 0 ? null : `${yearText}-${pad(index + 1)}`;
}

function dateOf(cell: Cell): string | null {
  if (typeof cell === "number") return cell > 59 ? serialToIso(cell) : null;
  const trimmed = text(cell);
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function phaseProblem(shares: (number | null)[]): string | null {
  if (shares.length !== 12) return "Custom phasing needs exactly 12 monthly shares, one per month of the fiscal year.";
  if (shares.some((s) => s === null || s < 0)) return "Each monthly phase share must be a number of zero or more.";
  const total = shares.reduce((sum: number, s) => sum + (s as number), 0);
  if (Math.abs(total - 100) > 0.01) {
    return `Monthly phase shares must add up to 100 (these add up to ${Number(total.toFixed(2))}).`;
  }
  return null;
}

function buildTargets(code: string, rowNumber: number, metric: string | null, mode: string | null,
  get: (column: string) => Cell, issues: Issue[]): string | null {
  if (!metric) return null;
  if (metric === "MONTH_COMPLETION") {
    const targetMonth = monthOf(get("Meet"));
    if (!targetMonth) {
      issues.push({ row: rowNumber, message: `${code}: a month-of-completion KPI needs its target month in the Meet column, e.g. 2026-10.` });
      return null;
    }
    return JSON.stringify({ targetMonth });
  }
  if (!mode) {
    issues.push({ row: rowNumber, message: `${code}: Target Mode must be FIXED or RANGE.` });
    return null;
  }
  const config: { [band: string]: number | number[] } = {};
  for (const band of BANDS) {
    const cell = get(BAND_COLUMNS[band]);
    if (mode === "FIXED") {
      const value = numberOf(cell);
      if (value === null) {
        issues.push({ row: rowNumber, message: `${code}: the ${BAND_COLUMNS[band]} target is missing or not a number.` });
        return null;
      }
      config[band] = value;
    } else {
      const range = rangeOf(cell);
      if (!range) {
        issues.push({ row: rowNumber, message: `${code}: the ${BAND_COLUMNS[band]} range should look like "50-69".` });
        return null;
      }
      config[band] = range;
    }
  }
  return JSON.stringify(config);
}

function readValues(workbook: ExcelScript.Workbook, codes: { [code: string]: boolean }, issues: Issue[]): Value[] {
  const sheet = readSheet(workbook, "Values");
  if (!sheet) return [];
  const values: Value[] = [];
  const seen: { [key: string]: number } = {};
  sheet.rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (column: string): Cell => cellOf(sheet, cells, column);
    const code = text(get("Code"));
    const periodCell = get("Period");
    if (!code && !text(periodCell)) return;
    if (!codes[code.toLowerCase()]) {
      issues.push({ row: rowNumber, message: `Values sheet: "${code}" does not match any KPI on the KPIs sheet.` });
      return;
    }
    const period = monthOf(periodCell);
    if (!period) {
      issues.push({ row: rowNumber, message: `Values sheet: "${text(periodCell)}" is not a month. Use YYYY-MM, e.g. 2026-08.` });
      return;
    }
    const key = `${code.toLowerCase()}|${period}`;
    if (seen[key]) {
      issues.push({ row: rowNumber, message: `Values sheet: ${code} already has a figure for ${period} on row ${seen[key]}.` });
      return;
    }
    seen[key] = rowNumber;
    const valueCell = get("Value");
    const value = text(valueCell) ? numberOf(valueCell) : null;
    if (text(valueCell) && value === null) {
      issues.push({ row: rowNumber, message: `Values sheet: ${code}: "${text(valueCell)}" is not a number.` });
      return;
    }
    const plannedCell = get("Planned Value");
    const plannedValue = text(plannedCell) ? numberOf(plannedCell) : null;
    if (text(plannedCell) && plannedValue === null) {
      issues.push({ row: rowNumber, message: `Values sheet: ${code}: "${text(plannedCell)}" (Planned Value) is not a number.` });
      return;
    }
    const completionCell = get("Completion Date");
    let completionDate: string | null = null;
    if (text(completionCell)) {
      completionDate = dateOf(completionCell);
      if (!completionDate) {
        issues.push({ row: rowNumber, message: `Values sheet: ${code}: "${text(completionCell)}" is not a date. Use dd/mm/yyyy.` });
        return;
      }
    }
    const estimate = text(get("Basis")).toUpperCase().indexOf("E") === 0;
    values.push({
      code, period, value, plannedValue,
      basis: estimate ? CHOICES.basis.ESTIMATE : CHOICES.basis.ACTUAL,
      basisLabel: estimate ? "Estimate" : "Actual",
      completionDate, note: text(get("Note")), row: rowNumber,
    });
  });
  return values;
}

function readUpdates(workbook: ExcelScript.Workbook, codes: { [code: string]: boolean }, issues: Issue[]): Update[] {
  const sheet = readSheet(workbook, "Updates");
  if (!sheet) return [];
  const updates: Update[] = [];
  sheet.rows.forEach((cells, index) => {
    const rowNumber = index + 2;
    const get = (column: string): string => text(cellOf(sheet, cells, column));
    const code = get("Code");
    const periodCell = cellOf(sheet, cells, "Period");
    if (!code && !text(periodCell)) return;
    if (!codes[code.toLowerCase()]) {
      issues.push({ row: rowNumber, message: `Updates sheet: "${code}" does not match any KPI on the KPIs sheet.` });
      return;
    }
    const period = monthOf(periodCell);
    if (!period) {
      issues.push({ row: rowNumber, message: `Updates sheet: "${text(periodCell)}" is not a month. Use YYYY-MM, e.g. 2026-08.` });
      return;
    }
    updates.push({
      id: get("Id") || null, code, period,
      mode: get("Mode").toUpperCase() === "DETAILED" ? CHOICES.update.DETAILED : CHOICES.update.SIMPLE,
      author: get("Author") || null, body: get("Body") || null,
      currentProgress: get("Current Progress") || null, nextProgress: get("Next Progress") || null,
      timeAndCost: get("Time Cost") || null, issues: get("Issues") || null, row: rowNumber,
    });
  });
  return updates;
}
```

**The Write scorecard workbook script:**

```typescript
// Office Script "Write scorecard workbook".
// Fills an empty workbook with a KPI Scorecard export, template or audit trail, in the web app's format.
// dataJson is built by the flow from Dataverse rows; see Part 9.

const CHOICES: { [list: string]: { [name: string]: number } } = {
  metric: { PERCENTAGE: 100000000, DOLLAR: 100000001, QUANTITY: 100000002, DAYS: 100000003, MONTH_COMPLETION: 100000004, VARIANCE: 100000005 },
  direction: { HIGHER_BETTER: 100000000, LOWER_BETTER: 100000001 },
  mode: { FIXED: 100000000, RANGE: 100000001 },
  frequency: { MONTHLY: 100000000, QUARTERLY: 100000001, ANNUAL: 100000002 },
  phasing: { NONE: 100000000, EVEN: 100000001, CUSTOM: 100000002 },
  basis: { ACTUAL: 100000000, ESTIMATE: 100000001 },
  update: { DETAILED: 100000000, SIMPLE: 100000001 },
};
const CURRENCY = "BND";
const BANDS = ["POOR", "IMPROVEMENT_NEEDED", "MEET", "GOOD", "VERY_GOOD", "EXCELLENT"];
const BAND_FILL: { [band: string]: string } = {
  "Poor": "#FF0000", "Improvement needed": "#FFC000", "Meet": "#92D050",
  "Good": "#00B050", "Very good": "#00B0F0", "Excellent": "#0070C0",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KPI_COLUMNS = ["Code", "Name", "Parent Code", "Weight (of group)", "Departments", "Metric Type", "Unit",
  "Direction", "Target Mode", "Poor", "Improvement Needed", "Meet", "Good", "Very Good", "Excellent",
  "Deadline Month", "Score Final After Deadline", "Frequency", "Phasing", "Phase Shares", "Status"];
const LISTS: { column: string; values: string[]; strict: boolean }[] = [
  { column: "Metric Type", values: Object.keys(CHOICES.metric), strict: true },
  { column: "Unit", values: ["%", CURRENCY, "days", "score", "units", "months"], strict: false },
  { column: "Direction", values: Object.keys(CHOICES.direction), strict: true },
  { column: "Target Mode", values: Object.keys(CHOICES.mode), strict: true },
  { column: "Score Final After Deadline", values: ["Yes", "No"], strict: true },
  { column: "Frequency", values: Object.keys(CHOICES.frequency), strict: true },
  { column: "Phasing", values: Object.keys(CHOICES.phasing), strict: true },
];

type Cell = string | number | boolean | null;
type Row = { [column: string]: string | number | boolean | null | Named[] };
interface Named { [column: string]: string; }
interface Data {
  kind: string; label: string; periods: string[];
  departments: Row[]; kpis: Row[]; kpiDepartments: Row[]; values: Row[]; updates: Row[];
  scores: Row[]; totals: Row[];
  fiscalYears: Row[]; events: Row[]; definitionChanges: Row[]; valueChanges: Row[];
}

function main(workbook: ExcelScript.Workbook, dataJson: string): string {
  const data = JSON.parse(dataJson) as Data;
  const before = workbook.getWorksheets();
  if (data.kind === "audit") {
    writeAudit(workbook, data);
  } else {
    writeReadme(workbook);
    writeKpis(workbook, data);
    writeTable(workbook, "Departments", [{ header: "Department", width: 40, text: true }],
      (data.departments || []).map((d) => [str(d.sc_name)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    if (data.kind === "export") {
      writeValues(workbook, data);
      writeUpdates(workbook, data);
      writeScores(workbook, data);
    }
  }
  before.forEach((s) => s.delete());
  return "ok";
}

// ---------- helpers ----------

function str(v: Cell | Named[] | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

function num(v: Cell | Named[] | undefined): number | null {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

function nameOf(list: { [name: string]: number }, value: Cell | Named[] | undefined): string | null {
  const n = num(value);
  if (n === null) return null;
  const found = Object.keys(list).filter((k) => list[k] === n);
  return found.length > 0 ? found[0] : null;
}

function dmy(iso: string): string {
  const p = iso.slice(0, 10).split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function monthLabel(period: string): string {
  return `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
}

// Date and time in Brunei (UTC+8), as dd/mm/yyyy hh:mm.
function localTime(utc: string): string {
  const d = new Date(new Date(utc).getTime() + 8 * 3600000);
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

interface Column { header: string; width: number; text?: boolean; }

// Writes a sheet with a dark header row. Text columns are formatted as text first, so Excel keeps
// codes like "1.10" and months like "2026-10" exactly as written.
function writeTable(workbook: ExcelScript.Workbook, name: string, columns: Column[], rows: Cell[][]): ExcelScript.Worksheet {
  const sheet = workbook.addWorksheet(name);
  const header = sheet.getRangeByIndexes(0, 0, 1, columns.length);
  header.setValues([columns.map((c) => c.header)]);
  header.getFormat().getFont().setBold(true);
  header.getFormat().getFont().setColor("#FFFFFF");
  header.getFormat().getFill().setColor("#1F2937");
  header.getFormat().setWrapText(true);
  header.getFormat().setRowHeight(30);
  columns.forEach((c, i) => {
    sheet.getRangeByIndexes(0, i, 1, 1).getFormat().setColumnWidth(c.width * 7);
    if (c.text) sheet.getRangeByIndexes(1, i, Math.max(rows.length, 500), 1).setNumberFormat("@");
  });
  if (rows.length > 0) {
    sheet.getRangeByIndexes(1, 0, rows.length, columns.length).setValues(
      rows.map((r) => columns.map((c, i) => (r[i] === undefined || r[i] === null ? "" : r[i]))));
  }
  sheet.getFreezePanes().freezeRows(1);
  return sheet;
}

// ---------- Readme ----------

function writeReadme(workbook: ExcelScript.Workbook) {
  const lines: string[][] = [
    ["How this file works", ""],
    ["", "Each row on the KPIs sheet is one KPI. Build the hierarchy by putting a parent's Code in the child's Parent Code column. Leave Parent Code blank for a Strategic Goal."],
    ["", "Only the lowest-level KPIs carry a weight, a metric and targets. A KPI with children is scored as the weighted average of those children, so its own metric columns are ignored."],
    ["Weights", "Weight is a share of a KPI's own siblings, entered as a fraction of 1 — e.g. 0.4 for 40%, not 40. Every group of siblings' weights should add up to 1 (shown as 100.00% once Excel formats the cell)."],
    ["Values", "Figures entered each month are cumulative year-to-date and are compared against the full-year target. The financial year runs 1 April to 31 March."],
    ["Score bands", "Poor 0-2.4   |   Improvement Needed 2.5-2.9   |   Meet 3-3.4   |   Good 3.5-3.9   |   Very Good 4-4.5   |   Excellent 4.6-5"],
    ["Metric Type", `PERCENTAGE, DOLLAR, QUANTITY, DAYS, MONTH_COMPLETION, VARIANCE. Use DOLLAR for money; put the currency (${CURRENCY}) in the Unit column.`],
    ["Direction", "HIGHER_BETTER when a bigger number is better (revenue, completion %), LOWER_BETTER when a smaller one is (cost, days taken, defects)."],
    ["Target Mode", "FIXED — put a single number in each band column. Reaching a band's target scores the top of that band. Targets normally step by 1 and must get harder from Poor through to Excellent."],
    ["", "RANGE — put a window in each band column, written \"50-69\". The score scales across the window between that band's lowest and highest score. A band can instead hold a single number (e.g. \"100\") for an exact target — reaching or passing it scores the top of that band, same as FIXED."],
    ["Month of completion", "Set Metric Type to MONTH_COMPLETION and put the target month in the Meet column — as YYYY-MM, or as an actual Excel date (the day is ignored, only the month and year count). Leave the other band columns blank — finishing one, two or three months early scores Good, Very Good, Excellent (more than three months early scores 5.0), and one month late scores Improvement Needed. Two or more months late is Poor: the score starts at 2.4 on the first day of the second month late and falls steadily to 0 on 31 March, the end of the fiscal year."],
    ["Variance", "Set Metric Type to VARIANCE for a KPI scored on how far an actual figure deviates from a per-period target, in either direction (e.g. budget utilization). Direction, Target Mode and Phasing are ignored — always scored the same whether over or under. Put a %-deviation window in each band column, written \"10-15\" for ±10-15%. Each month, enter both a Value (the actual) and a Planned Value (the target) on the Values sheet — the variance is computed automatically."],
    ["Deadline Month", "Optional, YYYY-MM. Use it for a KPI that is time-bound even though its metric is not. It means the last day of that month."],
    ["Score Final After Deadline", "Yes — the score freezes at whatever it was in the deadline month; later achievement is recorded but does not change it. No (the default) — later achievement still earns partial credit, capped at 2.9 one month late, 2.4 two months late, and 0 after that."],
    ["Departments", "Who owns the KPI. Separate several with a semicolon, e.g. Finance; Operations. Names should match the Departments sheet."],
    ["Frequency", "How often the KPI is reported: Monthly (the default), Quarterly (due Jun/Sep/Dec/Mar) or Annual (due in March). A KPI not yet due in a month doesn't count as a reporting gap."],
    ["Phasing", "None (the default) scores the year-to-date figure against the full-year target every month. Even divides the annual target evenly across 12 months. Custom uses the Phase Shares column. Only for cumulative measures — never for rates or stocks."],
    ["Phase Shares", "Custom phasing only: 12 monthly shares (April first), summing to 100, separated by semicolons — e.g. \"5;5;10;10;10;10;10;10;10;10;5;5\"."],
    ["Global %", "Export only, derived and read-only: this KPI's share of the whole company. Ignored on import — edit Weight (of group) instead."],
    ["Status", "Optional free-text current-state label for the KPI (e.g. \"On track\", \"At risk\") — separate from the monthly Progress Updates feed below."],
    ["Dropdowns", `Metric Type, Direction, Target Mode, Score Final After Deadline, Frequency and Phasing are dropdowns — pick from the list rather than typing, and Excel will refuse anything else. Unit offers %, ${CURRENCY}, days, score, units, months as a shortcut but accepts any label, so a KPI counted in something else can still be typed in. Every one of them may be left blank on a KPI that has children.`],
    ["Values sheet (optional)", "Add a sheet named \"Values\" to load monthly figures alongside the hierarchy, instead of typing them in. Columns: Code, Period, Value, Planned Value, Basis, Completion Date, Note. Period is YYYY-MM. Basis is Actual or Estimate. Completion Date (dd/mm/yyyy) is only for month-of-completion KPIs. Planned Value is only for VARIANCE KPIs — the period's target figure. A row overwrites whatever is recorded for that KPI and month."],
    ["Updates sheet (optional)", "Add a sheet named \"Updates\" to load Progress Updates (status updates, progress, next steps) alongside the hierarchy. Columns: Id, Code, Period, Mode, Author, Body, Current Progress, Next Progress, Time Cost, Issues, Created At. Mode is Simple (uses Body) or Detailed (uses Current Progress, Next Progress, Time Cost, Issues). Id is exported for reference — leave it blank on a new row, or keep it as exported to re-import the same file without creating duplicates; a row whose Id already exists is skipped."],
  ];
  const sheet = workbook.addWorksheet("Readme");
  const range = sheet.getRangeByIndexes(0, 0, lines.length, 2);
  range.setNumberFormat("@");
  range.setValues(lines);
  range.getFormat().setWrapText(true);
  range.getFormat().setVerticalAlignment(ExcelScript.VerticalAlignment.top);
  sheet.getRange("A:A").getFormat().setColumnWidth(26 * 7);
  sheet.getRange("B:B").getFormat().setColumnWidth(110 * 7);
  sheet.getRange("A:A").getFormat().getFont().setBold(true);
  sheet.getRange("A1").getFormat().getFont().setSize(14);
}

// ---------- KPIs ----------

function byId(rows: Row[], idColumn: string): { [id: string]: Row } {
  const map: { [id: string]: Row } = {};
  rows.forEach((r) => { map[str(r[idColumn])] = r; });
  return map;
}

function departmentsOf(data: Data): { [kpiId: string]: string[] } {
  const map: { [kpiId: string]: string[] } = {};
  (data.kpiDepartments || []).forEach((r) => {
    const id = str(r.sc_kpiid);
    (map[id] = map[id] || []).push(str(r["d.sc_name"]));
  });
  Object.keys(map).forEach((k) => map[k].sort());
  return map;
}

function sortedKpis(data: Data): Row[] {
  return (data.kpis || []).slice().sort((a, b) => str(a.sc_sortkey).localeCompare(str(b.sc_sortkey)));
}

function targetCell(band: string, metric: string | null, mode: string | null, config: string): Cell {
  if (!config || !metric) return null;
  const parsed = JSON.parse(config) as { [key: string]: number | number[] | string };
  // A leading apostrophe keeps "2026-10" or "1-5" as text instead of becoming a date.
  if (metric === "MONTH_COMPLETION") return band === "MEET" && parsed.targetMonth ? `'${parsed.targetMonth}` : null;
  const value = parsed[band];
  if (value === undefined || value === null) return null;
  if (mode === "RANGE" && Array.isArray(value)) return value[0] === value[1] ? value[0] : `'${value[0]}-${value[1]}`;
  return typeof value === "number" ? value : `'${value}`;
}

function writeKpis(workbook: ExcelScript.Workbook, data: Data) {
  const kpis = sortedKpis(data);
  const codeOf: { [id: string]: string } = {};
  kpis.forEach((k) => { codeOf[str(k.sc_kpiid)] = str(k.sc_code); });
  const departments = departmentsOf(data);
  const withGlobal = data.kind === "export";
  const rows: Cell[][] = kpis.map((k) => {
    const metric = nameOf(CHOICES.metric, k.sc_metrictype);
    const mode = nameOf(CHOICES.mode, k.sc_targetmode);
    const frequency = nameOf(CHOICES.frequency, k.sc_frequency) || "MONTHLY";
    const phasing = nameOf(CHOICES.phasing, k.sc_phasing) || "NONE";
    const shares = str(k.sc_phaseshares);
    const row: Cell[] = [
      str(k.sc_code), str(k.sc_name), codeOf[str(k._sc_parent_value)] || null,
      (num(k.sc_weight) || 0) / 100,
      (departments[str(k.sc_kpiid)] || []).join("; ") || null,
      metric, str(k.sc_unit) || null, nameOf(CHOICES.direction, k.sc_direction), mode,
    ];
    BANDS.forEach((b) => row.push(targetCell(b, metric, mode, str(k.sc_targetconfig))));
    row.push(str(k.sc_deadlinemonth) || null, k.sc_scorefinalafterdeadline === true ? "Yes" : "No",
      frequency !== "MONTHLY" ? frequency : null, phasing !== "NONE" ? phasing : null,
      phasing === "CUSTOM" && shares ? (JSON.parse(shares) as number[]).join(";") : null,
      str(k.sc_status) || null);
    if (withGlobal) row.push(Number((num(k.sc_globalweight) || 0).toFixed(2)));
    return row;
  });
  const textColumns = ["Code", "Name", "Parent Code", "Departments", "Unit", "Deadline Month", "Phase Shares", "Status"];
  const columns: Column[] = KPI_COLUMNS.map((h) => ({
    header: h,
    width: h === "Name" ? 42 : h === "Departments" ? 26 : h === "Score Final After Deadline" ? 24 : 16,
    text: textColumns.indexOf(h) >= 0,
  }));
  if (withGlobal) columns.push({ header: "Global %", width: 16 });
  const sheet = writeTable(workbook, "KPIs", columns, rows);
  sheet.getRange("D2:D501").setNumberFormat("0.00%");
  LISTS.forEach((list) => {
    const letter = String.fromCharCode(65 + KPI_COLUMNS.indexOf(list.column));
    const validation = sheet.getRange(`${letter}2:${letter}501`).getDataValidation();
    validation.setRule({ list: { inCellDropDown: true, source: list.values.join(",") } });
    validation.setErrorAlert({
      showAlert: list.strict,
      style: list.strict ? ExcelScript.ErrorAlertStyle.stop : ExcelScript.ErrorAlertStyle.information,
      title: `${list.column} not recognised`,
      message: `${list.column} must be one of: ${list.values.join(", ")}.`,
    });
  });
}

// ---------- Values, Updates ----------

function writeValues(workbook: ExcelScript.Workbook, data: Data) {
  const kpis = byId(data.kpis || [], "sc_kpiid");
  const rows: Cell[][] = (data.values || [])
    .filter((v) => kpis[str(v._sc_kpi_value)])
    .map((v) => {
      const k = kpis[str(v._sc_kpi_value)];
      return {
        key: `${str(k.sc_sortkey)}|${str(v.sc_period)}`,
        cells: [str(k.sc_code), str(v.sc_period), num(v.sc_value), num(v.sc_plannedvalue),
          num(v.sc_basis) === CHOICES.basis.ESTIMATE ? "Estimate" : "Actual",
          str(v.sc_completiondate) ? dmy(str(v.sc_completiondate)) : null, str(v.sc_note) || null] as Cell[],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((x) => x.cells);
  writeTable(workbook, "Values", [
    { header: "Code", width: 14, text: true }, { header: "Period", width: 12, text: true }, { header: "Value", width: 14 },
    { header: "Planned Value", width: 14 }, { header: "Basis", width: 10, text: true },
    { header: "Completion Date", width: 16, text: true }, { header: "Note", width: 32, text: true }], rows);
}

function writeUpdates(workbook: ExcelScript.Workbook, data: Data) {
  const kpis = byId(data.kpis || [], "sc_kpiid");
  const rows: Cell[][] = (data.updates || [])
    .filter((u) => kpis[str(u._sc_kpi_value)])
    .sort((a, b) => str(a.createdon).localeCompare(str(b.createdon)))
    .map((u) => [str(u.sc_progressupdateid), str(kpis[str(u._sc_kpi_value)].sc_code), str(u.sc_period),
      num(u.sc_mode) === CHOICES.update.DETAILED ? "Detailed" : "Simple", str(u.sc_author) || null,
      str(u.sc_body) || null, str(u.sc_currentprogress) || null, str(u.sc_nextprogress) || null,
      str(u.sc_timeandcost) || null, str(u.sc_issues) || null, str(u.createdon).slice(0, 10)]);
  writeTable(workbook, "Updates", ["Id", "Code", "Period", "Mode", "Author", "Body", "Current Progress", "Next Progress",
    "Time Cost", "Issues", "Created At"].map((h, i) => ({ header: h, width: [26, 14, 12, 12, 18, 40, 32, 32, 20, 32, 18][i], text: true })), rows);
}

// ---------- Scores ----------

function writeScores(workbook: ExcelScript.Workbook, data: Data) {
  const periods = data.periods || [];
  const scoreOf: { [key: string]: Row } = {};
  (data.scores || []).forEach((s) => { scoreOf[`${str(s._sc_kpi_value)}|${str(s.sc_period)}`] = s; });
  const totalOf: { [period: string]: Row } = {};
  (data.totals || []).forEach((t) => { totalOf[str(t.sc_period)] = t; });
  const departments = departmentsOf(data);
  const kpis = sortedKpis(data);

  const columns: Column[] = [{ header: "Code", width: 14, text: true }, { header: "KPI", width: 46, text: true },
    { header: "Level", width: 8 }, { header: "Weight %", width: 10 }, { header: "Departments", width: 24, text: true }]
    .concat(periods.map((p) => ({ header: monthLabel(p), width: 13 })));
  const rows: Cell[][] = kpis.map((k) => {
    const level = num(k.sc_level) || 1;
    const row: Cell[] = [str(k.sc_code), `${"    ".repeat(level - 1)}${str(k.sc_name)}`, level,
      Number((num(k.sc_globalweight) || 0).toFixed(2)), (departments[str(k.sc_kpiid)] || []).join("; ")];
    periods.forEach((p) => {
      const s = scoreOf[`${str(k.sc_kpiid)}|${p}`];
      row.push(s && s.sc_hasscore === true ? num(s.sc_score) : null);
    });
    return row;
  });
  rows.push([]);
  rows.push((["TOTAL", `${data.label} combined score`, null, 100, null] as Cell[])
    .concat(periods.map((p) => (totalOf[p] && totalOf[p].sc_hasscore === true ? num(totalOf[p].sc_score) : null))));
  rows.push((["", "Share of weight scored", null, null, null] as Cell[])
    .concat(periods.map((p) => (totalOf[p] ? num(totalOf[p].sc_coverage) : null))));
  const sheet = writeTable(workbook, "Scores", columns, rows);

  if (periods.length > 0) {
    sheet.getRangeByIndexes(1, 5, rows.length, periods.length).setNumberFormat("0.0");
    sheet.getRangeByIndexes(rows.length, 5, 1, periods.length).setNumberFormat("0%");
  }
  kpis.forEach((k, i) => {
    if (k.sc_isleaf !== true) sheet.getRangeByIndexes(i + 1, 0, 1, columns.length).getFormat().getFont().setBold(true);
    periods.forEach((p, j) => {
      const s = scoreOf[`${str(k.sc_kpiid)}|${p}`];
      const fill = s && s.sc_hasscore === true ? BAND_FILL[str(s.sc_band)] : undefined;
      if (fill) {
        const cell = sheet.getRangeByIndexes(i + 1, 5 + j, 1, 1).getFormat();
        cell.getFill().setColor(fill);
        cell.getFont().setColor("#FFFFFF");
      }
    });
  });
  sheet.getRangeByIndexes(rows.length - 1, 0, 1, columns.length).getFormat().getFont().setBold(true);
  sheet.getRangeByIndexes(rows.length, 0, 1, columns.length).getFormat().getFont().setItalic(true);
  sheet.getFreezePanes().freezeColumns(2);
}

// ---------- Audit trail ----------

function writeAudit(workbook: ExcelScript.Workbook, data: Data) {
  const kpis = byId(data.kpis || [], "sc_kpiid");
  const years = byId(data.fiscalYears || [], "sc_fiscalyearid");
  const yearOf = (k: Row | undefined) => (k ? str((years[str(k._sc_fiscalyear_value)] || {}).sc_label) : "");
  const newestFirst = (rows: Row[]) => (rows || []).slice().sort((a, b) => str(b.createdon).localeCompare(str(a.createdon)));
  const valueLabels: { [field: string]: string } = {
    value: "Reported value", plannedValue: "Planned/target value", basis: "Basis",
    completionDate: "Completion date", note: "Note",
  };

  const textColumns = (list: [string, number][]): Column[] => list.map((c) => ({ header: c[0], width: c[1], text: true }));

  writeTable(workbook, "Fiscal year events", textColumns([["Date/time", 20], ["Fiscal year", 16], ["Action", 22],
    ["Reason", 40], ["Author", 18]]),
    newestFirst(data.events).map((e) => [localTime(str(e.createdon)), str(e.sc_fiscalyearlabel),
      str(e["sc_action@OData.Community.Display.V1.FormattedValue"]), str(e.sc_reason) || null, str(e.sc_author)]));

  writeTable(workbook, "KPI definition changes", textColumns([["Date/time", 20], ["Fiscal year", 16], ["KPI code", 14],
    ["KPI name", 40], ["Field", 24], ["From", 30], ["To", 30], ["Author", 18]]),
    newestFirst(data.definitionChanges).map((c) => {
      const k = kpis[str(c._sc_kpi_value)];
      return [localTime(str(c.createdon)), yearOf(k), k ? str(k.sc_code) : "", k ? str(k.sc_name) : "",
        str(c.sc_label), str(c.sc_from), str(c.sc_to), str(c.sc_author) || null];
    }));

  writeTable(workbook, "KPI value changes", textColumns([["Date/time", 20], ["Fiscal year", 16], ["KPI code", 14],
    ["KPI name", 40], ["Period", 12], ["Field", 24], ["From", 24], ["To", 24], ["Author", 18], ["Company ID", 16]]),
    newestFirst(data.valueChanges).map((c) => {
      const k = kpis[str(c._sc_kpi_value)];
      return [localTime(str(c.createdon)), yearOf(k), k ? str(k.sc_code) : "", k ? str(k.sc_name) : "",
        str(c.sc_period) ? monthLabel(str(c.sc_period)) : "", valueLabels[str(c.sc_field)] || str(c.sc_field),
        str(c.sc_from) || null, str(c.sc_to) || null, str(c.sc_authorusername), str(c.sc_authorcompanyid)];
    }));
}
```

### 9.4 The blank workbook

The export flow fills a copy of an empty workbook.

> **Do this:** in the **Scorecard Templates** library, click **+ New → Excel workbook**. When it opens, rename it `Blank` (click the name at the top) and close it. Leave it empty.
>
> **Check it worked:** the library shows `Blank.xlsx` next to the two scripts.

### 9.5 A32 Export workbook

**What it does:** builds a workbook and returns a link to it. It makes three
kinds:

| Kind | Sheets | Who may ask |
| --- | --- | --- |
| `export` | Readme, KPIs, Departments, Values, Updates, Scores: the whole year, ready to edit and re-import | Everyone |
| `template` | Readme, an empty KPIs sheet with drop-down lists, Departments | Everyone |
| `audit` | Fiscal year events, KPI definition changes, KPI value changes, for every year | Admins |

**Inputs:** CallerEmail, Kind, FiscalYearId, PeriodsJson (the months for the
Scores sheet, as a list such as `["2026-06","2026-07","2026-08","2026-09"]`).

> **Do this:**
>
> 1. Build the skeleton with Procedure J. For **Need**, click **fx** and type `if(equals(` then pick **Kind** from Dynamic content, then type `, 'audit'), 'admin', 'signed-in')`. **KpiId:** `none`.
> 2. **Above** the Check action (click the **+** between the trigger and Check), add **Initialize variable** `Data`, type **String**, value left empty. (Variables can only be created at the top level of a flow, never inside a condition.) Then, on the True side of If_allowed, add **Get a row by ID** `Get_year`: table Fiscal years, Row ID the FiscalYearId input, **Select columns** `sc_label`.
> 3. Add a **Switch** `Which_kind`, **On**: the Kind input. Add three cases: `export`, `template` and `audit`.
> 4. In the **export** case, add these Dataverse **List rows** actions. For each one: set the **Select columns** given, turn on **Pagination** (the action's **...** → **Settings → Pagination**, threshold `100000`), and use the filter given, where `<id>` means the FiscalYearId input from Dynamic content.
>
>    | Action name | Table | Select columns | Filter rows |
>    | --- | --- | --- | --- |
>    | `Kpis` | KPIs | `sc_kpiid,sc_code,sc_name,_sc_parent_value,sc_weight,sc_globalweight,sc_level,sc_sortkey,sc_isleaf,sc_metrictype,sc_unit,sc_direction,sc_targetmode,sc_targetconfig,sc_deadlinemonth,sc_scorefinalafterdeadline,sc_frequency,sc_phasing,sc_phaseshares,sc_status` | `_sc_fiscalyear_value eq <id>` |
>    | `Departments` | Departments | `sc_name` | (none) |
>    | `Values` | KPI values | `_sc_kpi_value,sc_period,sc_value,sc_basis,sc_plannedvalue,sc_completiondate,sc_note` | `_sc_fiscalyear_value eq <id>` |
>    | `Scores` | KPI scores | `_sc_kpi_value,sc_period,sc_score,sc_band,sc_hasscore` | `_sc_fiscalyear_value eq <id> and sc_scenario eq 'standard'` |
>    | `Totals` | Total scores | `sc_period,sc_score,sc_hasscore,sc_coverage` | `_sc_fiscalyear_value eq <id> and sc_scenario eq 'standard'` |
>
>    Then two **List rows** with a **Fetch Xml Query** instead of a filter:
>
>    - `KpiDepartments`, table KPIs: the FetchXML from R03 (8.7), with `outputs('Year')?['sc_fiscalyearid']` replaced by the FiscalYearId input.
>    - `Updates`, table Progress updates:
>
>      ```xml
>      <fetch>
>        <entity name="sc_progressupdate">
>          <attribute name="sc_progressupdateid" />
>          <attribute name="sc_kpi" />
>          <attribute name="sc_period" />
>          <attribute name="sc_mode" />
>          <attribute name="sc_author" />
>          <attribute name="sc_body" />
>          <attribute name="sc_currentprogress" />
>          <attribute name="sc_nextprogress" />
>          <attribute name="sc_timeandcost" />
>          <attribute name="sc_issues" />
>          <attribute name="createdon" />
>          <link-entity name="sc_kpi" from="sc_kpiid" to="sc_kpi">
>            <filter>
>              <condition attribute="sc_fiscalyear" operator="eq" value="@{triggerBody()?['text_2']}" />
>            </filter>
>          </link-entity>
>        </entity>
>      </fetch>
>      ```
>
>      (`text_2` is the third text input, FiscalYearId. If the flow complains, replace `@{triggerBody()?['text_2']}` with the FiscalYearId input from Dynamic content.)
>
> 5. Still in the **export** case, add **Set variable**, **Name** `Data`, **Value**:
>
>    ```text
>    {
>      "kind": "export",
>      "label": "@{outputs('Get_year')?['body/sc_label']}",
>      "periods": @{triggerBody()?['text_3']},
>      "departments": @{outputs('Departments')?['body/value']},
>      "kpis": @{outputs('Kpis')?['body/value']},
>      "kpiDepartments": @{outputs('KpiDepartments')?['body/value']},
>      "values": @{outputs('Values')?['body/value']},
>      "updates": @{outputs('Updates')?['body/value']},
>      "scores": @{outputs('Scores')?['body/value']},
>      "totals": @{outputs('Totals')?['body/value']}
>    }
>    ```
>
>    (`text_3` is PeriodsJson. As before, swap in the input from Dynamic content if needed.)
>
> 6. In the **template** case: copy the **Departments** action into it (rename the copy `Departments_t`), then add **Set variable** `Data` with the value:
>
>    ```text
>    {"kind": "template", "label": "", "departments": @{outputs('Departments_t')?['body/value']}, "kpis": [], "kpiDepartments": []}
>    ```
>
> 7. In the **audit** case, add five **List rows** (with pagination, no filter) and a **Set variable**:
>
>    | Action name | Table | Select columns |
>    | --- | --- | --- |
>    | `Audit_years` | Fiscal years | `sc_fiscalyearid,sc_label` |
>    | `Audit_kpis` | KPIs | `sc_kpiid,sc_code,sc_name,_sc_fiscalyear_value` |
>    | `Audit_events` | Fiscal year events | `createdon,sc_fiscalyearlabel,sc_action,sc_reason,sc_author` |
>    | `Audit_definitions` | KPI definition changes | `createdon,_sc_kpi_value,sc_label,sc_from,sc_to,sc_author` |
>    | `Audit_values` | KPI value changes | `createdon,_sc_kpi_value,sc_period,sc_field,sc_from,sc_to,sc_authorusername,sc_authorcompanyid` |
>
>    **Set variable** `Data`, value:
>
>    ```text
>    {
>      "kind": "audit",
>      "label": "",
>      "fiscalYears": @{outputs('Audit_years')?['body/value']},
>      "kpis": @{outputs('Audit_kpis')?['body/value']},
>      "events": @{outputs('Audit_events')?['body/value']},
>      "definitionChanges": @{outputs('Audit_definitions')?['body/value']},
>      "valueChanges": @{outputs('Audit_values')?['body/value']}
>    }
>    ```
>
> 8. Add SharePoint **Get file content using path** `Get_blank`: **Site Address** the KPI Scorecard site, **File Path** `/Scorecard Templates/Blank.xlsx`.
> 9. Add SharePoint **Create file** `Create_file`: the same site, **Folder Path** `/Scorecard Exports`, **File Name**:
>
>     ```text
>     concat(if(equals(triggerBody()?['text_1'], 'audit'), 'Audit trail', outputs('Get_year')?['body/sc_label']), ' ', triggerBody()?['text_1'], ' ', convertFromUtc(utcNow(), 'Singapore Standard Time', 'yyyy-MM-dd HHmmss'), '.xlsx')
>     ```
>
>     (`text_1` is Kind.) **File Content:** `body('Get_blank')`.
> 10. Add Excel Online (Business) **Run script from SharePoint library** `Run_script`:
>     - **Workbook Location:** the KPI Scorecard site; **Workbook Library:** Scorecard Exports
>     - **Workbook:** click the box, choose **Enter custom value**, and pick **Id** from the Create file step in Dynamic content
>     - **Script Location:** the same site; **Script Library:** Scorecard Templates; **Script:** `Write scorecard workbook.osts`
>     - A box named **dataJson** appears: `variables('Data')`
> 11. Add SharePoint **Create sharing link for a file or folder** `Share`: the same site, **Library Name** Scorecard Exports, **Item Id** the **ItemId** from Create file, **Link Type** View, **Link Scope** Organization.
> 12. Finish with **Respond to a Power App or flow**: Ok `true`, Message `Your workbook is ready.`, Data `body('Share')?['link']?['webUrl']`.
> 13. Save and set **Run only users** (Procedure F). Make sure the Excel and SharePoint connections are the service account's.
>
> **Check it worked:** run it with Kind `export`, the sample year's id and PeriodsJson `["2026-06","2026-07","2026-08","2026-09"]`. Open the link in Data:
>
> - **KPIs** has 11 rows in hierarchy order, from `1 Grow the business` to `2.4 Policies reviewed`. 1.1.1's **Weight (of group)** shows `70.00%` and its **Global %** `16.80`.
> - **Values** has 12 rows; **Departments** lists Finance and Sales.
> - **Scores** has four month columns ending **Sep 2026**, with coloured cells, and the **TOTAL** row shows **3.5** for Sep 2026.
>
> Then run it with Kind `template` (an empty KPIs sheet with drop-downs) and with Kind `audit` (three sheets).
>
> **If something goes wrong:**
>
> - **Run_script says the script can't be found or isn't allowed:** check 9.2 with IT, and that the service account can open the Scorecard Templates library.
> - **Run_script says "Bad gateway" or times out:** the data is too large for one run. Check **Select columns** is filled in on every List rows (without it, every column is sent).
> - **Codes such as `1.10` appear as `1.1`:** the Write script wasn't pasted in full (it formats those columns as text first).

### 9.6 A33 Preview import

**What it does:** reads a workbook from the **Scorecard Imports** library and
says what an import would do, without changing anything.

**Inputs:** CallerEmail, FiscalYearId, FileName, Mode (`update` or `replace`).
**Need:** `admin`.

- **Update** adds new KPIs and figures and updates those already there, matching KPIs by code. Nothing is removed.
- **Replace** does the same, then deletes every KPI of the year that isn't in the file.

> **Do this:**
>
> 1. Procedure J, with Need `admin` and KpiId `none`.
> 2. On the True side, **Get a row by ID** `Get_year`: Fiscal years, Row ID the FiscalYearId input, **Select columns** `sc_label,sc_closedon,sc_heldon`.
> 3. A **Condition** `If_open`: `empty(outputs('Get_year')?['body/sc_closedon'])` **is equal to** `true`. On its **False** side, respond Ok `false` with Message `concat(outputs('Get_year')?['body/sc_label'], ' is closed. Ask an admin to reopen it before recording changes.')`. Build the rest on its **True** side.
> 4. Five **List rows**, with pagination, listing what the year holds now:
>
>    | Action name | Table | Select columns | Filter rows |
>    | --- | --- | --- | --- |
>    | `Existing_kpis` | KPIs | `sc_kpiid,sc_code,sc_level` | `_sc_fiscalyear_value eq <id>` |
>    | `Existing_values` | KPI values | `_sc_kpi_value,sc_period` | `_sc_fiscalyear_value eq <id>` |
>    | `Existing_departments` | Departments | `sc_departmentid,sc_name` | (none) |
>
>    plus `Existing_links` (table KPIs, the R03 FetchXML for this year) and `Existing_updates` (table Progress updates, the FetchXML from 9.5 step 4 with only the `sc_progressupdateid` attribute).
> 5. **Compose** `Existing`:
>
>    ```text
>    {
>      "kpis": @{outputs('Existing_kpis')?['body/value']},
>      "values": @{outputs('Existing_values')?['body/value']},
>      "departments": @{outputs('Existing_departments')?['body/value']},
>      "links": @{outputs('Existing_links')?['body/value']},
>      "updates": @{outputs('Existing_updates')?['body/value']}
>    }
>    ```
>
> 6. SharePoint **Get file metadata using path** `Get_file`: **File Path** `concat('/Scorecard Imports/', triggerBody()?['text_2'])` (`text_2` is FileName). If the file isn't there, this step fails; step 9 turns that into a message.
> 7. **Run script from SharePoint library** `Run_script`: workbook library **Scorecard Imports**, **Workbook** (custom value) the **Id** from Get_file, script **Read scorecard workbook.osts**. Its two parameters: **mode** `toLower(triggerBody()?['text_3'])` (Mode) and **existingJson** `string(outputs('Existing'))`.
> 8. **Compose** `Result`: `json(body('Run_script')?['result'])`. Then **Respond to a Power App or flow**:
>    - Ok: `equals(outputs('Result')?['summary']?['errors'], 0)`
>    - Message:
>
>      ```text
>      if(equals(outputs('Result')?['summary']?['errors'], 0), concat('Ready to import: ', outputs('Result')?['summary']?['kpisAdded'], ' KPI(s) added, ', outputs('Result')?['summary']?['kpisUpdated'], ' updated, ', outputs('Result')?['summary']?['kpisRemoved'], ' removed; ', outputs('Result')?['summary']?['valuesAdded'], ' figure(s) added, ', outputs('Result')?['summary']?['valuesReplaced'], ' replaced; ', outputs('Result')?['summary']?['updatesAdded'], ' progress update(s) added.'), concat(length(outputs('Result')?['issues']), ' problem(s) found. Fix them in the file, save it, and preview again.'))
>      ```
>
>    - Data: `body('Run_script')?['result']`
> 9. To give a clear message when the file is missing: add a parallel branch beside **Get_file** (hover over the arrow above it → **+** → **Add a parallel branch**) with a **Respond to a Power App or flow**: Ok `false`, Message `concat('There is no file called ', triggerBody()?['text_2'], ' in Scorecard Imports.')`. Set its **Run after** to **Get_file has failed** only.
> 10. Save and set **Run only users**.
>
> **Check it worked:** put the export from 9.5 into **Scorecard Imports** and run A33 with its file name and Mode `update`. Ok **Yes**, "Ready to import: 0 KPI(s) added, 11 updated, 0 removed; 0 figure(s) added, 12 replaced; …". Then open the file, type `abc` in 1.1.1's **Meet** column, save, and preview again: Ok **No**, and Data's `issues` holds *"1.1.1: the Meet target is missing or not a number."* with its row number. Undo the change.

### 9.7 A34 Apply import

**What it does:** imports the file. It runs the preview again first and
refuses if there's any problem, and it always saves a checkpoint (backup) of
the year before changing anything, so an import can be undone from the
Backups screen.

**Inputs:** CallerEmail, FiscalYearId, FileName, Mode. **Need:** `admin`.

> **Do this:** build it by hand. Each step says what to add on the True side of **If_allowed**.
>
> 1. **Run a Child Flow** `Preview` → **A33 Preview import**, passing all four inputs. Then a **Condition** `If_clean`: `body('Preview')?['ok']` **is equal to** `true`. On its False side, respond Ok `false` with Message `body('Preview')?['message']`. Steps 2 to 11 go on its True side.
> 2. **Run a Child Flow** `Checkpoint` → **A20 Create checkpoint**: FiscalYearId, **Name** `concat('Before import ', convertFromUtc(utcNow(), 'Singapore Standard Time', 'dd/MM/yyyy HH:mm'))`, **Automatic** `true`.
> 3. **Apply to each** `Each_new_department` over `json(body('Preview')?['data'])?['departmentsToCreate']`: **Add a new row** to Departments with **Name** `items('Each_new_department')` and **Is active** Yes.
> 4. **Run a Child Flow** `Plan` → **A33 Preview import** again, with the same inputs. Running it after the new departments exist gives every department link its id. **Compose** `P`: `json(body('Plan')?['data'])`.
> 5. **Apply to each** `Each_kpi` over `outputs('P')?['kpisParentsFirst']`, with concurrency **off** (parents must exist before their children). Inside, **Update a row** on KPIs. **Row ID:** `items('Each_kpi')?['id']`. ("Update a row" creates the row when that id doesn't exist yet, which is how new KPIs are added.) Click **Show all** and fill:
>
>    | Column | Value |
>    | --- | --- |
>    | Name | `items('Each_kpi')?['name']` |
>    | Code | `items('Each_kpi')?['code']` |
>    | Fiscal year (Fiscal years) | `concat('sc_fiscalyears(', triggerBody()?['text_1'], ')')` |
>    | Parent (KPIs) | `if(empty(items('Each_kpi')?['parentId']), null, concat('sc_kpis(', items('Each_kpi')?['parentId'], ')'))` |
>    | Weight | `items('Each_kpi')?['weight']` |
>    | Sort order | `items('Each_kpi')?['sortOrder']` |
>    | Metric type, Direction, Target mode | `items('Each_kpi')?['metricType']`, `…['direction']`, `…['targetMode']` |
>    | Frequency, Phasing | `items('Each_kpi')?['frequency']`, `items('Each_kpi')?['phasing']` |
>    | Unit, Target config, Phase shares, Deadline month, Status | `items('Each_kpi')?['unit']`, `…['targetConfig']`, `…['phaseShares']`, `…['deadlineMonth']`, `…['status']` |
>    | Score final after deadline | `items('Each_kpi')?['scoreFinalAfterDeadline']` |
>    | Settings changed on | `utcNow()` |
>
>    For the choice columns, choose **Enter custom value** in the drop-down before pasting the formula. (`text_1` is FiscalYearId.)
> 6. **Apply to each** `Each_kpi_links` over `outputs('P')?['kpis']`. Inside it, two more loops:
>    - **Apply to each** `Each_link_to_add` over `items('Each_kpi_links')?['linksToAdd']`: **Relate rows**: table KPIs, Row ID `items('Each_kpi_links')?['id']`, relationship the KPI–Department one (`sc_kpi_sc_department`), **Relate with** `concat(outputs('Env'), 'sc_departments(', items('Each_link_to_add'), ')')`.
>    - **Apply to each** `Each_link_to_remove` over `items('Each_kpi_links')?['linksToRemove']`: **Unrelate rows**, set the same way.
>
>    **Relate with** needs the department's full web address. Add a **Compose** `Env` before the loop holding your environment's address followed by `/api/data/v9.2/`, for example `https://yourorg.crm5.dynamics.com/api/data/v9.2/` (copy the first part from the browser's address bar when you open a table in Power Apps, or from **Settings → Session details → Instance url**).
> 7. **Apply to each** `Each_removed` over `outputs('P')?['kpisToRemove']`, concurrency **off**: **Delete a row**, table KPIs, Row ID `items('Each_removed')?['id']`. The list is ordered deepest level first, so children go before their parents. (Empty unless Mode is `replace`.)
> 8. **Select** `Entries`, from `outputs('P')?['values']`, map in text mode:
>
>    ```text
>    {"kpiId": @{item()?['kpiId']}, "period": @{item()?['period']}, "value": @{item()?['value']}, "plannedValue": @{item()?['plannedValue']}, "basis": @{item()?['basisLabel']}, "completionDate": @{item()?['completionDate']}, "note": @{if(empty(item()?['note']), null, item()?['note'])}}
>    ```
>
>    If the designer won't accept that, use the key/value map instead, with the same seven keys and expressions.
> 9. **Run a Child Flow** `Figures` → **A01 Save figures**: CallerEmail, **EntriesJson** `string(body('Entries'))`. A01 checks each figure, writes the figure history and adds a recalculation request. It takes a few seconds per figure.
> 10. **Apply to each** `Each_update` over `outputs('P')?['updates']`. Inside, a **Condition** `items('Each_update')?['skip']` **is equal to** `false`; on its True side, **Update a row** on Progress updates with **Row ID** `coalesce(items('Each_update')?['id'], guid())` (keeping the id from the file means importing the same file twice doesn't post the update twice), and **KPI** `concat('sc_kpis(', items('Each_update')?['kpiId'], ')')`, **Period**, **Mode** (custom value `items('Each_update')?['mode']`), **Body**, **Current progress**, **Next progress**, **Time and cost**, **Issues**, and **Author** `coalesce(items('Each_update')?['author'], body('Check')?['username'])`.
> 11. Add a recalculation request (6.6) for the year: From period empty, KPI id empty, **Refresh hierarchy** Yes. Then respond Ok `true`, Message `concat('Imported. ', body('Preview')?['message'], ' A checkpoint was saved first. Scores update in a few minutes.')`.
> 12. Save and set **Run only users**.
>
> **Check it worked:** import the sample export from 9.6 in **update** mode. Then:
>
> - **Backups** (7.17) lists a new automatic checkpoint "Before import …".
> - The KPIs and figures are unchanged, and no KPI value change rows were added (every figure was the same).
> - After the recalculation, September 2026's total is still **3.5**.
>
> Now test **replace**: delete KPI 2.4's row from the file's KPIs sheet (and its row on the Values sheet), save, preview in `replace` mode ("… 1 removed …") and apply. KPI 2.4 is gone. Restore the "Before import" checkpoint to bring it back.
>
> **If something goes wrong:**
>
> - **Each_kpi fails on Parent with "Resource not found":** a parent wasn't created first. Check concurrency is off on Each_kpi, and that it loops over `kpisParentsFirst`, not `kpis`.
> - **Relate rows fails:** check the **Env** address ends in `/api/data/v9.2/` and the relationship name matches Table 7.
> - **Choice columns fail with "not a valid value":** a choice number in the script's `CHOICES` list differs from yours (9.3).

### 9.8 The wrappers

| Wrapper | Inputs | Notes |
| --- | --- | --- |
| AppExportWorkbook | Kind, FiscalYearId, PeriodsJson | A plain app wrapper (Procedure K) for A32 |
| AppPreviewImport | FiscalYearId, FileName, Mode | A plain app wrapper for A33 |
| AppApplyImport | FiscalYearId, FileName, Mode | Different: see below |

**AppApplyImport answers straight away.** An import of a large file can take
longer than the two minutes Power Apps waits for a flow. So this wrapper
replies first, then carries on, then tells the admin in Teams when it's done:

> **Do this:**
>
> 1. Build it with Procedure K, but put **Respond to a PowerApp or flow** **before** the child flow: Ok `true`, Message `The import has started. You'll get a Teams message when it's finished.`, Data empty.
> 2. After it, add **Run a Child Flow** `Core` → A34 Apply import, with CallerEmail `triggerOutputs()?['headers']?['x-ms-user-email']` and the three inputs.
> 3. Then Microsoft Teams **Post message in a chat or channel**: **Post as** Flow bot, **Post in** Chat with Flow bot, **Recipient** `triggerOutputs()?['headers']?['x-ms-user-email']`, **Message** `body('Core')?['message']`.

**AgentExportWorkbook** is an agent wrapper (Procedure N, step 6) so people can
ask the agent for the workbook. Its only input is CallerEmail. Before calling
A32 with Kind `export`, it works out the year and months itself:

```text
Find the active fiscal year (Is active = Yes and Held on empty, or else the latest year with Held on empty).
Work out the reporting month as in R01 (8.7, step 5). PeriodsJson is the reporting month and the three months
before it, oldest first, keeping only months from "<Start year>-04" onwards, written as a JSON list of
"YYYY-MM" texts. Run the child flow "A32 Export workbook" (action name Core) with CallerEmail, Kind "export",
the year's id and PeriodsJson. Respond to the agent with Ok, Message and Data from Core.
```

Add it as a tool named `Excel export`, with the description `Creates the
scorecard as an Excel workbook (the same format as the import template) and
returns a link to it. Use it when someone asks for the scorecard in Excel or a
spreadsheet.` The agent should reply with the link from Data.

### 9.9 Build the Import and export screen

> **Do this:**
>
> 1. Add the three wrappers to the app (7.2, step 5).
> 2. Add the **Scorecard Imports** library as a data source: **Data → + Add data → SharePoint**, choose the KPI Scorecard site, tick **Scorecard Imports**, **Connect**.
> 3. Duplicate `scrTemplate` as `scrImport`. Its **OnVisible**: `If(!IsAdmin, Navigate(scrDashboard))`.
> 4. **Export section.** A **Button** `"Export to Excel"`:
>
>    ```text
>    Set(varBusy, true);
>    Set(varResult, AppExportWorkbook.Run("export", Text(varYear.'Fiscal year'),
>        "[" & Concat(Filter(varMonths, Period <> ""), """" & Period & """", ",") & "]"));
>    Set(varBusy, false);
>    If(varResult.ok, Launch(varResult.data), Notify(varResult.message, NotificationType.Error))
>    ```
>
>    A second **Button** `"Download the template"`, the same but with `"template"` and `"[]"`.
> 5. **Import section.** Add these controls:
>    1. A **Button** `"Open the Scorecard Imports library"`, **OnSelect** `Launch("<the library's web address>")` (open the library in SharePoint and copy the address from the browser).
>    2. A label: `"1. Put the workbook in the Scorecard Imports library. 2. Choose it below. 3. Preview. 4. Import."`
>    3. A **Drop down** `ddFile`, **Items** `Sort('Scorecard Imports', Modified, SortOrder.Descending)`, showing `'File name with extension'` (in older versions the column is called `{FilenameWithExtension}` or **Name**). Add a small **Refresh** icon next to it with **OnSelect** `Refresh('Scorecard Imports')`.
>    4. A **Radio** `rdMode`, **Items** `["Update", "Replace"]`, **Default** `"Update"`, and under it the label `If(rdMode.Selected.Value = "Replace", "Replace deletes every KPI in this year that isn't in the file.", "Update adds and updates; it never removes anything.")`.
>    5. A **Button** `"Preview"`:
>
>       ```text
>       Set(varBusy, true);
>       Set(varPreview, AppPreviewImport.Run(Text(varYear.'Fiscal year'), ddFile.Selected.'File name with extension', Lower(rdMode.Selected.Value)));
>       Set(varBusy, false);
>       Set(varPlan, IfError(ParseJSON(varPreview.data), Blank()));
>       ClearCollect(colIssues, ForAll(Table(varPlan.issues) As i, {Row: Value(i.Value.row), Message: Text(i.Value.message)}))
>       ```
>
>    6. A label showing `varPreview.message`, red when `!varPreview.ok`, and a gallery `galIssues` over `colIssues` showing `If(IsBlank(ThisItem.Row), "", "Row " & ThisItem.Row & ": ") & ThisItem.Message`.
>    7. A **Button** `"Import"`, **DisplayMode** `If(!IsBlank(varPreview) && varPreview.ok && !varBusy, DisplayMode.Edit, DisplayMode.Disabled)`. Its **OnSelect** fills the confirm box (Procedure L):
>
>       ```text
>       ClearCollect(colChanges,
>           {Label: "File", From: "", To: ddFile.Selected.'File name with extension'},
>           {Label: "Mode", From: "", To: rdMode.Selected.Value},
>           {Label: "What happens", From: "", To: varPreview.message});
>       Set(varShowConfirm, true)
>       ```
>
>       and the confirm box's **btnConfirm.OnSelect** runs `AppApplyImport.Run(Text(varYear.'Fiscal year'), ddFile.Selected.'File name with extension', Lower(rdMode.Selected.Value))` with Procedure M, then `Set(varPreview, Blank())`.
> 6. **Audit trail.** A **Button** `"Export the audit trail"`, **Visible** `IsAdmin`, running `AppExportWorkbook.Run("audit", Text(varYear.'Fiscal year'), "[]")` and launching the link the same way. Put the same button on the **Change log** screen (7.17).
> 7. Go back to the **Dashboard** (7.4, step 10) and set its **Export to Excel** button's **OnSelect** to the formula from step 4.
>
> **Check it worked:** as an admin, **Export to Excel** opens the workbook in a new tab. Put a copy in Scorecard Imports, choose it, **Preview** in Update mode: the message says "Ready to import" and **Import** becomes clickable. Break a cell as in 9.6 and preview again: the problem is listed with its row, and **Import** stays greyed out.
>
> **If something goes wrong:**
>
> - **The file list is empty:** click the refresh icon; the list only updates when asked.
> - **'File name with extension' is underlined in red:** type `ddFile.Selected.` and look at what the list offers; pick the column that holds the file name with `.xlsx`.

---

## Part 10. The board report

The web app has a printable board report. The new version makes the same
report as a PDF, by filling in a Word template you design once.

### 10.1 What the report contains

The same sections as the web app's report, for one fiscal year and month:

- **Page 1, the executive summary**
  - A heading: "Corporate scorecard — September 2026", the fiscal year and the date it was made.
  - The **total score** and its band, with three figures: **KPIs reported** (scored leaf KPIs out of all leaf KPIs), **coverage** and **not yet due** (as whole percentages).
  - **Strategic goals**: for each goal, its code and name, its score, its share of the total score (its global weight, as "60.00% of total score") and each KPI directly beneath it with its score.
  - **Highlights**: every leaf KPI scoring Meet or better this month, best first. **Lowlights**: every leaf KPI scoring Improvement needed or Poor, worst first. Each shows the KPI's name, where it sits ("Grow the business › Revenue"), its score, a short note (its figure against its Meet target, such as "85 % vs. target 80 %", or "Not yet due") and the first lines of its latest progress update.
  - The footer: "Confidential — board distribution only".
- **Page 2, Appendix A**: every goal and KPI in hierarchy order, with its weight in its group, its figure, its score and its band.

### 10.2 Make the Word template

Content controls are boxes in a Word document that a flow can fill in.
You need the **desktop** version of Word for this step; Word on the web can't
insert them.

> **Do this:**
>
> 1. Open Word on your computer and create a blank document.
> 2. Show the **Developer** tab: **File → Options → Customize Ribbon**, tick **Developer**, click **OK**.
> 3. Lay out page 1 the way you like: your logo, a title, headings for "Strategic goals", "Highlights" and "Lowlights", and the footer text "Confidential — board distribution only" in the page footer. Use the company's fonts and colours.
> 4. **Single values.** Wherever a value should go, click there and choose **Developer → Plain Text Content Control** (the **Aa** icon). With the new box selected, click **Properties** and type the **Title** and the **Tag**, both the same, from this list. Add each one once:
>
>    | Title and Tag | What the flow puts there |
>    | --- | --- |
>    | `Year` | FY2026/27 |
>    | `PeriodName` | September 2026 |
>    | `Generated` | the date the report was made, as 08/10/2026 |
>    | `TotalScore` | 3.5 |
>    | `TotalBand` | Good |
>    | `Reported` | 6 / 8 |
>    | `Coverage` | 89% |
>    | `NotYetDue` | 10% |
>
> 5. **Tables that repeat.** Each list in the report is a table with a heading row and **one** data row. Insert a table with the columns below. In each cell of the data row, add a Plain Text Content Control with the Title and Tag shown. Then select the **whole data row** (click just left of it) and choose **Developer → Repeating Section Content Control** (the icon with two boxes and a plus). In its **Properties**, set the Title and Tag to the table's name.
>
>    | Table name | Columns (Title and Tag of each cell's control) |
>    | --- | --- |
>    | `Goals` | `GoalTitle`, `GoalScore`, `GoalShare`, `GoalKpis` |
>    | `Highlights` | `HRank`, `HName`, `HPath`, `HScore`, `HNote`, `HProgress` |
>    | `Lowlights` | `LRank`, `LName`, `LPath`, `LScore`, `LNote`, `LProgress` |
>    | `Appendix` | `AName`, `AWeight`, `AFigure`, `AScore`, `ABand` |
>
>    For `GoalKpis`, tick **Allow carriage returns (multiple paragraphs)** in its Properties: it holds one line per KPI.
> 6. Put the **Appendix** table on page 2, after a page break (**Insert → Page Break**), under the heading "Appendix A · Full KPI detail".
> 7. Save the document as `Board report template.docx` and upload it to the **Scorecard Templates** library.
>
> **Check it worked:** click **Developer → Design Mode**. Every box shows its title in a little tab. There are 8 single boxes and 4 repeating rows.
>
> **If something goes wrong:** if the flow in 10.3 doesn't list a box, its **Title** is probably empty or misspelt. Titles must match the list exactly, including capitals.

### 10.3 A36 Board report

**Inputs:** CallerEmail, FiscalYearId, Period. **Need:** `signed-in`.

> **Do this:**
>
> 1. Build the skeleton with Procedure J.
> 2. Paste this into Copilot after the ground-rules paragraph (6.6). It builds the values for the template:

```text
Get the Fiscal year by FiscalYearId. Read only rows with Scenario "standard" and the given Period.
Get the "Total score" row for the year and Period; refuse with "Scores for <month name and year> aren't ready
yet. Try again in a few minutes." if there isn't one.
Get every "KPI score" row for the year and Period, sorted by Sort key, and every KPI of the year (for its Unit,
Metric type and Target config). For each leaf KPI, also get its newest Progress update (by Created on).
Add these Compose actions:
- Info: an object with Year (the label), PeriodName (the month's name and year, e.g. "September 2026"),
  Generated (today in local time as dd/MM/yyyy), TotalScore (one decimal, e.g. "3.5"), TotalBand, Reported
  ("<Scored leaf count> / <Leaf count>"), Coverage and NotYetDue (Coverage and Not yet due share as whole
  percentages, e.g. "89%").
- Goals: one item per Level 1 row: {"GoalTitle": "<code> — <name>", "GoalScore": <score to one decimal, or "—">,
  "GoalShare": "<Global weight to two decimals>% of total score", "GoalKpis": the KPIs whose Parent id is the
  goal, one per line as "<name>  <score or —>", joined with a new line}.
- Note, for a leaf: "Not yet due" or "No figure reported" when it has no score for those reasons; for a Month
  completion KPI, "Target: <the target month's name and year>"; otherwise "<Value used> <unit> vs. target
  <Meet target> <unit>", where the Meet target is the Target config's MEET number, or "<low>–<high>" for a range.
  Leave out the unit when there is none.
- Progress, for a leaf: its newest update's Current progress (or Body for a Simple update), trimmed, or "".
- Path, for a KPI: the names of its parents from the top down, joined with " › ".
- Highlights: the leaf rows with a score whose Band is Meet, Good, Very good or Excellent, sorted by Score from
  highest to lowest (keep hierarchy order for equal scores), as {"HRank": "01", "02", …, "HName", "HPath",
  "HScore", "HNote", "HProgress"}.
- Lowlights: the leaf rows with a score whose Band is Improvement needed or Poor, sorted by Score from lowest to
  highest, with the same fields starting "L".
- Appendix: every row in Sort key order as {"AName": the name with four spaces per level below 1 in front (a
  goal as "<code> — <name>"), "AWeight": "<Local weight to two decimals>%" (empty for a goal), "AFigure": for
  a leaf, "<Value used> <unit> / <Meet target> <unit>", or for a Month completion KPI "Completed <Mon YYYY>" or
  its target month; "—" for anything else, "AScore": the score to one decimal or "—", "ABand": the band or ""}.
If Highlights is empty, use one item with HName "No KPIs scored Meet or better this period." and the other
fields empty. If Lowlights is empty, use one item with LName "No KPIs scored Improvement Needed or Poor this
period.".
```

> 3. Below Copilot's steps, add **Populate a Microsoft Word template** (Word Online (Business)), renamed `Fill`:
>    - **Location:** the KPI Scorecard site. **Document Library:** Scorecard Templates. **File:** Board report template.docx.
>    - The template's boxes appear as fields. Fill the eight single ones from the **Info** Compose, for example **Year** = `outputs('Info')?['Year']`.
>    - For each repeating table (Goals, Highlights, Lowlights, Appendix), click the small **T** icon next to its name (**Switch to input entire array**) and enter the matching Compose, for example `outputs('Goals')`.
> 4. SharePoint **Create file** `Save_docx`: **Folder Path** `/Board Reports`, **File Name** `concat(outputs('Info')?['Year'], ' ', triggerBody()?['text_2'], ' board report.docx')` (`text_2` is Period), **File Content** `body('Fill')`.
> 5. Word Online (Business) **Convert Word Document to PDF** `To_pdf`: **Location** the site, **Document Library** Board Reports, **File** (custom value) the **Id** from Save_docx.
> 6. SharePoint **Create file** `Save_pdf`: **Folder Path** `/Board Reports`, **File Name** the same as step 4 with `.pdf` in place of `.docx`, **File Content** `body('To_pdf')`.
> 7. SharePoint **Create sharing link for a file or folder**: **Library Name** Board Reports, **Item Id** the **ItemId** from Save_pdf, **Link Type** View, **Link Scope** Organization.
> 8. Respond: Ok `true`, Message `The board report is ready.`, Data the link's `webUrl` (as in A32, 9.5 step 11).
> 9. Save and set **Run only users**.
>
> **Check it worked:** run it for the sample year and `2026-09`, and open the PDF:
>
> - Page 1 says **September 2026**, total **3.5 Good**, **6 / 8** KPIs reported, coverage **89%**, not yet due **10%**.
> - Goals: **1 — Grow the business 3.5**, "60.00% of total score", listing Revenue 3.7, New customers 2.9 and Customer satisfaction 3.7; **2 — Run efficiently 3.4**, "40.00% of total score".
> - Highlights, in this order: 1.1.2 Recurring revenue share **4.5**, 1.3 Customer satisfaction **3.7**, then Revenue growth, Days to close the books and Spending against budget at **3.4**. Revenue growth's note reads "85 % vs. target 80 %".
> - Lowlights: New customers **2.9**, "55 vs. target 120".
> - Page 2 lists all 11 rows, indented by level.
>
> **If something goes wrong:**
>
> - **Fill fails with "the template is invalid":** a repeating section must wrap a whole table row, and each control's Title must be set. Check in Design Mode (10.2).
> - **A table shows only one row:** you entered the array into the first field of the table rather than switching the whole table to array input (step 3).

### 10.4 Add the report to the app

> **Do this:**
>
> 1. Build an app wrapper **AppBoardReport** (Procedure K) for A36, and add it to the app.
> 2. On the Dashboard (7.4), next to **Export to Excel**, add a **Button** `"Board report"`:
>
>    ```text
>    Set(varBusy, true);
>    Set(varResult, AppBoardReport.Run(Text(varYear.'Fiscal year'), varPeriod));
>    Set(varBusy, false);
>    If(varResult.ok, Launch(varResult.data), Notify(varResult.message, NotificationType.Error))
>    ```
>
> **Check it worked:** with September 2026 selected, the button opens the PDF from 10.3 in a new tab after about half a minute.

### 10.5 Add the report to the agent

> **Do this:** build an agent wrapper **AgentBoardReport** (Procedure N, step 6) with inputs CallerEmail, Year and Period. Before calling A36, it works out the fiscal year and month with the year-and-month rule (8.6), so people can say "the board report for August". Add it as a tool:
>
> - **Name:** `Board report`
> - **Description:** `Makes the board report (a PDF with the total score, the Strategic Goals, highlights, lowlights and every KPI) for a month, and returns a link to it.`
> - **Inputs:** Year: `"active", or a fiscal year label such as FY2025/26.` Period: `"current", or a month as YYYY-MM.`
>
> **Check it worked:** in the Test pane, *"Make the board report for September 2026"* replies with a link to the PDF.

---

## Part 11. Background jobs

Some work needs to happen on a schedule rather than when someone clicks a
button. In the Power Platform that's a **scheduled cloud flow**: a flow that
starts by itself at set times, like an alarm clock.

You'll build three, plus one optional clean-up job:

| Flow | When | What it does |
| --- | --- | --- |
| **B1 Score the new month** | Every day at 00:30 | Makes sure the current month has scores, even if nobody has saved anything yet |
| **B2 Purge held years** | Every day at 02:00 | Permanently deletes fiscal years that have been in Holding for 30 days |
| **B3 Monthly reminder** | The 3rd of each month at 09:00 | Reminds each department in Teams about the figures still missing for last month |
| **B4 Clear old files** (optional) | Every Sunday at 03:00 | Deletes exports and board reports older than 90 days |

### 11.1 Procedure O: create a scheduled flow

> **Do this:**
>
> 1. In **Solutions → KPI Scorecard**, click **+ New → Automation → Cloud flow → Scheduled**.
> 2. Type the flow's name, and set **Starting** to tomorrow's date and the time given for the flow.
> 3. Set **Repeat every** as given (for example `1` **Day**) and click **Create**.
> 4. Click the **Recurrence** trigger, then **Show advanced options**, and set **Time zone** to `(UTC+08:00) Kuala Lumpur, Singapore` (or your own time zone, 2.5). Without this, the times are in UTC: 8 hours out for Brunei.
> 5. Build the steps given for the flow.
> 6. Click **Save**. While you're testing, you don't have to wait for the schedule: click **Test → Manually → Test** to run it straight away.

Every connection must belong to the service account (4.5), or the jobs stop
when you leave.

### 11.2 B1 Score the new month

S7 (5.12) scores months only when something asks it to. On the 1st of a
month, nothing has been saved for the new month yet, so the Dashboard would
show it empty. B1 asks for it every night, which also catches up if a run was
ever missed.

**Schedule:** every 1 day at 00:30.

> **Do this:**
>
> 1. Build the flow with Procedure O and name it `B1 Score the new month`.
> 2. Add **Compose** `Today` with `convertFromUtc(utcNow(), 'Singapore Standard Time')`.
> 3. Add **Compose** `ThisMonth` with `formatDateTime(outputs('Today'), 'yyyy-MM')`.
> 4. Add **Compose** `FyStart`, the start year of the fiscal year that today falls in:
>
>    ```text
>    if(greaterOrEquals(int(formatDateTime(outputs('Today'), 'MM')), 4), int(formatDateTime(outputs('Today'), 'yyyy')), sub(int(formatDateTime(outputs('Today'), 'yyyy')), 1))
>    ```
>
> 5. Add Dataverse **List rows** `Years`: **Table** Fiscal years, **Filter rows** `sc_startyear eq @{outputs('FyStart')} and sc_closedon eq null and sc_heldon eq null`.
> 6. Add **Apply to each** over `outputs('Years')?['body/value']`. Inside it, add Dataverse **Add a new row**: **Table** Recalculation requests, with:
>
>    | Column | Value |
>    | --- | --- |
>    | Name | `concat('New month ', outputs('ThisMonth'))` |
>    | Fiscal year (Fiscal years) | `concat('sc_fiscalyears(', items('Apply_to_each')?['sc_fiscalyearid'], ')')` |
>    | From period | `outputs('ThisMonth')` |
>    | Refresh hierarchy | No |
>    | Status | `Waiting` |
>
> 7. Save.
>
> **Check it worked:** click **Test → Manually**. A Recalculation request for this month appears and turns **Done** a few minutes later. In **KPI score**, the current month has a `standard` row for every KPI.
>
> **If something goes wrong:** if **Years** comes back empty, the fiscal year for today hasn't been created yet, or it's closed. That's correct: there is nothing to score. Create the new year on the Manage screen in March, ready for April.

### 11.3 B2 Purge held years

A fiscal year moved to Holding (A18, 6.10) stays recoverable for 30 days.
B2 deletes it for good when its time is up. This replaces the web app's
"purge on the next admin page view".

**Schedule:** every 1 day at 02:00.

> **Do this:**
>
> 1. Build the flow with Procedure O and name it `B2 Purge held years`.
> 2. Add Dataverse **List rows** `Due`: **Table** Fiscal years, **Filter rows** `sc_heldon ne null and sc_purgeon le @{utcNow()}`.
> 3. Add **Apply to each** over `outputs('Due')?['body/value']`. Inside it:
>    1. **Add a new row**: **Table** Fiscal year events. **Fiscal year label** `items('Apply_to_each')?['sc_label']`, **Action** `Permanently deleted`, **Author** `system`, **Reason** `30 days in Holding`. Leave **Fiscal year** empty: the year is about to disappear.
>    2. **Delete a row**: **Table** Fiscal years, **Row ID** `items('Apply_to_each')?['sc_fiscalyearid']`. Every KPI, figure, update, score and checkpoint of the year goes with it, because those tables are set to **Parental** (3.6).
> 4. Save.
>
> **Check it worked:** make a test year: create FY2030/31 on the Manage screen and move it to Holding. Then open **Tables → Fiscal year**, and change its **Purge on** to yesterday. Run B2 with **Test → Manually**: the year is gone from the table, and the Change log screen shows "Permanently deleted" for FY2030/31.
>
> **If something goes wrong:** if the delete fails with a message about a related record, a table that points at Fiscal year isn't set to **Parental**. Fix it with Procedure E, except Fiscal year event, which must stay **Referential, remove link**.

### 11.4 B3 Monthly reminder

On the 3rd of each month, B3 tells each department which of its KPIs are
still missing last month's figure. It only lists KPIs that were due last
month: a quarterly KPI only appears in June, September, December and March.

**Schedule:** every 1 month, starting on the 3rd of next month at 09:00.

> **Do this:**
>
> 1. Build the flow with Procedure O and name it `B3 Monthly reminder`. Set **Repeat every** to `1` **Month**.
> 2. Open **Copilot** in the designer and paste this:

```text
Below the Recurrence trigger, build this. All tables use the publisher prefix sc_; use the Microsoft Dataverse
connector.
- Compose LastMonth: the month before today in local time ('Singapore Standard Time') as yyyy-MM.
- Compose FiscalMonth: April = 1 … March = 12 for LastMonth.
- List the Fiscal year rows that are active (Is active = Yes), not closed and not held. If there are none, stop.
- List rows of KPIs for that year where Is leaf = Yes and Completed = No, with their owning departments (the
  KPI–Department relationship) and Frequency.
- Keep the KPIs that were due in LastMonth: Monthly always; Quarterly when FiscalMonth is 3, 6, 9 or 12;
  Annual when FiscalMonth is 12. A Month completion KPI is due only when LastMonth is on or after its target
  month (the targetMonth in its Target config) and it has no KPI value with a Completion date yet.
- Of those, keep the ones with no KPI value row for LastMonth (for a Month completion KPI: no completion date at all).
- For each Department: take the remaining KPIs it owns. If there are none, skip it. Otherwise list the App users
  in that department with Status Approved, and for each one, post a message in Microsoft Teams ("Post message in
  a chat or channel", Post as Flow bot, Post in Chat with Flow bot) to their Email:
  "Hello <username>. These <department> KPIs still need their <LastMonth as month name and year> figure:
  <one line per KPI: code — name>. Enter them in the Scorecard app (Enter Data) or tell the Scorecard agent."
```

> 3. Check what Copilot built against the prompt, then save.
>
> **Check it worked:** with the sample data, run it with **Test → Manually** on any day in October 2026, so last month is September:
>
> - The **Finance** members get a Teams chat listing *2.4 — Policies reviewed*: it's quarterly, so it was due in September, and it only has a June figure.
> - The **Sales** members get nothing: every Sales KPI has a September figure.
> - *2.3 — New finance system live* isn't listed: its target month is October, so it isn't due yet.
>
> **If something goes wrong:** if nobody gets a message, check that the test users are **Approved** and that their **Email** in App user matches their Teams sign-in.

### 11.5 B4 Clear old files (optional)

Every export and board report is saved in SharePoint, so the libraries grow.
B4 deletes files older than 90 days. Skip it if your company must keep them.

**Schedule:** every 1 week, on Sunday at 03:00.

> **Do this:**
>
> 1. Build the flow with Procedure O and name it `B4 Clear old files`. Set **Repeat every** to `1` **Week** and tick **Sunday**.
> 2. Add SharePoint **Get files (properties only)**: the KPI Scorecard site, **Library Name** Scorecard Exports, **Filter Query** `Modified lt '@{addDays(utcNow(), -90)}'`.
> 3. Add **Apply to each** over its **value**. Inside it, add SharePoint **Delete file**, **File Identifier** the item's **Identifier**.
> 4. Repeat steps 2 and 3 for the **Board Reports** library.
> 5. Save.
>
> **Check it worked:** run it once. Files from the last 90 days are still there.

> **Never** point B4 at **Scorecard Templates**: it would delete your Excel and Word templates.

---

## Part 12. Move your existing data across

Once the new version passes its tests with the sample data, move your real
scorecard across from the web app. You'll use the Excel export and import
from Part 9: the web app exports a workbook, and the new version imports it.

### 12.1 What moves across, and what doesn't

| Moves across in the workbook | Doesn't move across |
| --- | --- |
| Every KPI and Strategic Goal, with its code, name, parent, weight, owning departments, metric, unit, direction, targets, deadline, frequency, phasing and status | **People's accounts.** The web app's usernames and passwords can't be carried over. Everyone signs in with their Microsoft account and registers once (12.5). |
| The departments (created automatically by the import) | **Score overrides.** Re-enter them on each KPI's page (12.4). |
| Every monthly figure, with its basis, planned value, completion date and note | **The change history** (KPI definition changes and figure changes). Keep the web app's Change log export (its **Export full audit trail** button) as a record. |
| Every progress update | **The "Completed" tick and sub-group labels.** Set these again in each KPI's settings (12.4). |
| | **Whether a year was closed.** Close it again after importing (12.3, step 8). |

The web app's **backup files** (from its Backups screen) use a different
layout from the new version's checkpoints, so they can't be restored here.
Use the workbook.

### 12.2 Plan the switch-over day

> **Do this:**
>
> 1. **Finish the final tests first.** Part 14 uses the sample data, which step 5 below removes. Tick every row of Part 14 before going on.
> 2. **Pick a day.** Choose a quiet time, such as just after the monthly figures are in.
> 3. **Tell everyone** the date, and that from that day they enter figures in the new app or agent instead of the web app.
> 4. **On the day, freeze the web app.** Ask staff to stop entering figures before you start exporting. Don't switch the web app off yet: you'll compare against it in 12.6.
> 5. **Remove the sample data** from the new version. On the Manage screen, move FY2026/27 (the sample year) to Holding, and in **Tables → Fiscal year** set its **Purge on** to yesterday, then run **B2 Purge held years** (11.3) with **Test → Manually**. If your real data also has an FY2026/27, this step is essential: there can only be one year per start year.
> 6. **Remove the sample departments** (Finance and Sales) on the Manage screen if your company doesn't use those names. Leave them if it does: the import reuses departments by name. Remove any made-up test users on the Users and approvals screen too.

### 12.3 Bring across each fiscal year

Do this once for every fiscal year you want to keep, **oldest first**.

> **Do this:**
>
> 1. **In the web app**, sign in as an admin, pick the fiscal year at the top, and click **Export to Excel** on the Dashboard. Save the file and give it a clear name, such as `FY2025-26 from web app.xlsx`.
> 2. **Open the file** and glance through the **KPIs** sheet: one row per KPI, in hierarchy order. Don't change anything.
> 3. **In the new app**, open **Manage** and create the fiscal year with the same start year (for FY2025/26, the start year is `2025`).
> 4. **Upload the file** to the **Scorecard Imports** library: open the library in SharePoint and drag the file in.
> 5. **In the new app**, open **Manage → Import and export**. Pick the new year at the top, choose the file, leave the mode on **Update** and click **Preview**.
>
>    **Check it worked:** the message reads "Ready to import: <n> KPI(s) added, 0 updated, 0 removed; <m> figure(s) added …", where *n* is the number of rows on the KPIs sheet and *m* the number of rows on the Values sheet. There are no problems listed.
>
>    **If something goes wrong:** each problem names the sheet and row. Fix it in the web app (not in the file), export again, and repeat from step 4. The new version checks a few things the web app doesn't (Part 16), so a file the web app accepted can occasionally show a problem here.
> 6. Click **Import** and confirm. The import takes a minute or two for a typical year, then the scores are worked out over the next few minutes.
> 7. **Wait for the scores.** Open **Tables → Recalculation request**: the newest request for the year must show **Done**.
> 8. **If the year was closed** in the web app, close it now on the Manage screen, giving the reason "Closed in the web app".
> 9. **Set the active year.** After the last year is imported, make the current year active on the Manage screen.

### 12.4 Re-enter what the workbook doesn't carry

> **Do this:** for each fiscal year still open:
>
> 1. **Score overrides.** In the web app, open each KPI that shows an override (a score marked as calibrated) and note the month, score and reason. In the new app, open the same KPI, pick the month and enter the override with the same reason.
> 2. **Completed KPIs.** For each KPI marked **Completed** in the web app, open its page in the new app, turn on **Completed** in its settings, pick the same completed month and save.
> 3. **Sub-groups.** If you used sub-group labels, type them into each KPI's **Sub-group** setting.
>
> For a **closed** year, do this before step 8 of 12.3, or reopen it, make the changes and close it again.

### 12.5 Bring people across

Nobody's account moves across, so each person registers once:

> **Do this:**
>
> 1. **Tell everyone** to open the Scorecard app (or say "hi" to the Scorecard agent in Teams) and register: they pick their department and type their company ID number.
> 2. **Approve them** on the **Users and approvals** screen. Set each admin's role to **Admin**, matching who was an admin in the web app.
> 3. **Check against the web app.** In the web app, open **Manage → Users** and compare the list. Chase anyone who hasn't registered.
>
> **Tip:** register the admins first, so they can approve everyone else.

### 12.6 Check the move

Compare the two versions side by side for the **latest month with figures**
and at least one older month.

> **Do this:** in both versions, pick the same year and month on the Dashboard, and compare:
>
> - the **total score**, its band and the coverage;
> - every **Strategic Goal's** score;
> - five or six KPIs from different departments, opening each KPI page to compare the figure, the targets and the score.
>
> **Check it worked:** every score matches. With Route B (Part 5), a very rare difference of 0.1 is possible when the exact score is a tie such as 3.45 (Part 16).
>
> **If something goes wrong:**
>
> - **A whole branch differs:** compare the weights on the Weights screen. A missing department or a KPI under the wrong parent shows up there.
> - **One KPI differs:** compare its figure, targets, phasing and deadline. If they match, see "A score looks wrong" in Part 15.
> - **The month shows no scores:** the recalculation hasn't finished (12.3, step 7).

When everything matches, switch the web app to read-only (or off) and keep its
last database backup somewhere safe.

---

## Part 13. Publish and roll out

So far only you and a test colleague can use the app and the agent. This
part makes them available to everyone in the **KPI Scorecard Users** group,
inside Microsoft Teams.

### 13.1 Take a backup of your work first

A **solution export** is a single .zip file holding everything you've built:
tables, flows, the app and the agent (but not the data). Keep one before
every big change.

> **Do this:**
>
> 1. In [make.powerapps.com](https://make.powerapps.com), open **Solutions**, select **KPI Scorecard** and click **Export solution**.
> 2. Click **Publish** when asked (it publishes all customisations), then **Next**.
> 3. Choose **Unmanaged** and click **Export**. After a minute, a **Download** button appears at the top of the page.
> 4. Save the .zip somewhere safe, such as a "Scorecard builds" folder in the team's SharePoint, with the date in its name.
>
> **Check it worked:** the .zip is a few megabytes and its name includes `KPIScorecard`.

### 13.2 Check everyone's licences

The app reads Dataverse directly, so everyone who opens it needs a licence
that includes Dataverse, such as **Power Apps Premium** or a Power Apps
per-app licence. This was in the email to IT in 1.2.

> **Do this:** ask IT to confirm that every member of **KPI Scorecard Users** has one, and that the environment has enough **Copilot Studio** messages and **AI Builder** credits for the agent and the "Read figures" prompt (8.10).
>
> **If something goes wrong:** someone without a licence sees "You need a Power Apps license to use this app" when they open it.

### 13.3 Put the app in Teams

> **Do this:**
>
> 1. Make sure the latest version is published: open the app in Power Apps Studio, then **Save** and **Publish**.
> 2. Check it's shared with the **KPI Scorecard Users** group (7.18).
> 3. In [make.powerapps.com](https://make.powerapps.com) → **Apps**, click **...** next to **KPI Scorecard** → **Add to Teams**.
> 4. Click **Edit details** and give it a short description, such as `Monthly KPI scores, figures and reports`. Pick an icon and colour if you like.
> 5. Click **Download app**. This saves a small .zip file: the Teams version of the app.
> 6. Send the .zip to IT and ask them to:
>    - upload it in the **Teams admin center** under **Teams apps → Manage apps → Upload new app**;
>    - allow it for the **KPI Scorecard Users** group;
>    - optionally, pin it to everyone's Teams sidebar with a **setup policy**.
>
> **Check it worked:** in Teams, click **Apps** (left bar) and search for "KPI Scorecard". It opens the app inside Teams. If IT pinned it, its icon is in the left bar.
>
> **If you can't involve IT:** in step 5, click **Add to Teams** instead. That adds the app for you alone; others can open it through its web link (Power Apps → **Apps** → **...** → **Details** → **Web link**). Put that link in your announcement.

### 13.4 Put the agent in Teams

> **Do this:**
>
> 1. In [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com), open the **Scorecard** agent and click **Publish** (top right). Wait for "Published successfully".
> 2. Open **Channels → Teams and Microsoft 365 Copilot**, tick **Make agent available in Microsoft 365 Copilot** if you want it there too, and click **Add channel**.
> 3. Click **Edit details**: give it a short description (`Ask about KPI scores, enter monthly figures and post updates`), the same icon as the app, and your company's name as the developer.
> 4. Click **Availability options**, then **Show to everyone in my org** → **Submit for admin approval**.
> 5. Ask IT to approve it in the **Teams admin center** under **Teams apps → Manage apps** (it shows as **Submitted**), and to allow it for the **KPI Scorecard Users** group only.
> 6. Back in Copilot Studio, click **Share** (top right), add the **KPI Scorecard Users** group and click **Share**, so its members can chat with the agent.
>
> **Check it worked:** once IT has approved it, ask a colleague to open Teams, click **Apps**, search for "Scorecard" and click **Add**. When they say "hi", the agent greets them by name (or asks them to register).
>
> **If something goes wrong:**
>
> - **"I'm sorry, I can't sign you in":** the agent's authentication isn't **Authenticate with Microsoft** (8.5). Fix it and publish again.
> - **The agent says it can't run a tool:** open the agent flow's run history (Power Automate → **My flows** → the flow → **28-day run history**). A connection may belong to you rather than the service account (4.5).

### 13.5 Tell everyone

> **Copy this:** an announcement for email or a Teams channel. Fill in the bits in square brackets.

```text
The KPI Scorecard is moving into Microsoft Teams from [date].

What's new
- Open the KPI Scorecard app in Teams (Apps → KPI Scorecard), or use this link: [app link].
- Or just chat with the Scorecard agent in Teams: ask "How are we doing this month?", or tell it a figure
  like "New customers for October was 61".

What you need to do
- Open the app or the agent once and register: pick your department and type your company ID number.
  An admin approves you, usually the same day.
- From [date], enter monthly figures in the new app or the agent, not the old website.

There's no separate password: you sign in with your normal work account.
Questions: [contact].
```

### 13.6 Making changes later

> **Do this:** whenever you change something:
>
> - **A flow:** save it. The change applies from the next run.
> - **The app:** **Save** and **Publish** in Power Apps Studio. People get the new version the next time they open it; Teams picks it up automatically.
> - **The agent:** **Publish** in Copilot Studio. Teams picks it up within a few minutes. You only need to repeat 13.4 if you change its name or icon.
> - Before a large change, take a new backup (13.1).
>
> **Tip:** if the scorecard becomes important to the business, ask IT for a second environment for testing. You make changes there, export the solution as **Managed**, and import it into the live environment, so nobody sees a half-finished change.

---

## Part 14. Final testing checklist

Each part already tested its own pieces. This part tests the whole thing from
the outside, the way staff will use it, before you tell everyone it's ready.

**When to run it:** with the **sample data**, after Part 11 and **before** you
move your real data across in Part 12 (which removes the sample year). Run it
again whenever you make a large change.

### 14.1 Get ready

> **Do this:**
>
> 1. Make sure the sample data matches Appendix C. If you changed figures while testing earlier parts, set them back.
> 2. On the **Backups** screen, create a checkpoint of FY2026/27 called `Before final tests`. At the end you'll restore it, which puts back anything the tests change.
> 3. You need two people (or two browsers, one in a private window):
>    - **You**, an **Admin**;
>    - **A Sales Member**: an approved App user in the Sales department with the role **Member** (Appendix C.1).
> 4. Print this part, or copy the tables into a spreadsheet, and tick each row as it passes.

### 14.2 Scores

In the app, pick FY2026/27 and **September 2026** on the Dashboard.

| ✓ | Check | Expected |
| --- | --- | --- |
| [ ] | Total score | **3.5 Good**, coverage **88.9%** (89% where rounded to whole numbers) |
| [ ] | Goal cards | **1 Grow the business 3.5**, **2 Run efficiently 3.4** |
| [ ] | Tree, September column | Matches Appendix C.4 row for row. 2.3 shows **n/d** (not yet due), 2.4 shows **–** (no figure) |
| [ ] | KPI 1.3's score | **3.7**, marked as an estimate |
| [ ] | KPI 1.2's score | **2.9**, marked pro-rated |
| [ ] | KPI 1.2's page, "How this score is made up" | Figure **55**; the phased Meet target is **60** (120 × 6 ÷ 12) |
| [ ] | KPI 1.1's page | Two children: 1.1.1 **3.4** and 1.1.2 **4.5** |
| [ ] | August 2026 | 1.1.1 scores **3.4** from its August figure, 82 (Meet is 80) |

### 14.3 The dashboard options

Change the two drop-downs above the Dashboard tree and wait for the scores to
appear (the first time for each combination, it takes a few minutes; the
banner says so). Set both back to their first choice afterwards.

| ✓ | Missing figures | Estimates | Expected total for September 2026 |
| --- | --- | --- | --- |
| [ ] | Excluded | Count at face value | **3.5 Good** (the normal view) |
| [ ] | Assume Meet, decaying | Count at face value | **3.4 Meet**, coverage 100%; 2.3 and 2.4 both show **3.4** (assumed) |
| [ ] | Score as 0 | Count at face value | **2.8 Improvement needed**; Run efficiently drops to **1.7** |
| [ ] | Excluded | Exclude | **3.4 Meet**, coverage 68.9%; 1.3 has no score, because its only September figure is an estimate |
| [ ] | Excluded | Score as 0 | **2.6 Improvement needed**; 1.3 scores **0** |
| [ ] | Score as 0 | Score as 0 | **2.1 Poor** |

### 14.4 Entering figures and permissions

| ✓ | Who | Do this | Expected |
| --- | --- | --- | --- |
| [ ] | You | Enter Data, September 2026: change 1.1.1 from 85 to **95**, Save, confirm | The confirm box lists one line, "1.1.1 Revenue growth — Reported value", 85 → 95. A few minutes later 1.1.1 is **4.5**, Grow the business **3.8** and the total **3.7** |
| [ ] | You | Change it back to **85** | The scores return to 14.2 |
| [ ] | You | KPI 1.1.1's page → change log | Two entries for September: 85 → 95 and 95 → 85, both by you |
| [ ] | Sales Member | Enter Data | Only the Sales KPIs (1.x) can be edited; the Finance KPIs are greyed out |
| [ ] | Sales Member | Ask the agent: *"Days to close the books for September was 4"* | Refused: Finance owns 2.1 |
| [ ] | Sales Member | KPI 1.2's page: change the Meet target to 110 and save | "Your change has been sent to an admin for approval." You get a Teams message |
| [ ] | You | Users and approvals: approve it | "Approved and saved." 1.2's Meet target is now 110 |
| [ ] | Sales Member + you | Propose two changes to 1.2; approve the first, then the second | The second is refused: "This KPI has changed since the proposal was made. …" |
| [ ] | You | Set 1.2's Meet target back to 120 | |
| [ ] | You | KPI 2.3's page, October 2026: completion date 01/11/2026 | Refused: "… 2026-11-01 is after 2026-10, the month being reported on. …" |
| [ ] | You | KPI 1.3's page: post a progress update | It appears at the top of the updates, with your name and today's date |
| [ ] | A new person | Open the app | The Welcome screen asks them to register. After registering they see "waiting for approval" until you approve them |

### 14.5 Simulate and Insights

| ✓ | Do this | Expected |
| --- | --- | --- |
| [ ] | Simulate, September 2026: 1.1.1 = **95**, work out the scores | 1.1.1 **4.5**, Grow the business **3.8**, total **3.7**. The real figure is still 85 |
| [ ] | Insights, September 2026 | Top opportunity **1.2 New customers** (+0.11), then **1.1.1 Revenue growth** (+0.11) and **1.3 Customer satisfaction** (+0.07). Coming up: **2.3 New finance system live**, due October 2026 |

### 14.6 Files

| ✓ | Do this | Expected |
| --- | --- | --- |
| [ ] | Dashboard → **Export to Excel** | The workbook opens: 11 KPIs, 12 figures, the Scores sheet matching 14.2 (9.5) |
| [ ] | Import the same file in **Update** mode | "Ready to import: 0 KPI(s) added, 11 updated, 0 removed; 0 figure(s) added, 12 replaced …"; importing changes no scores (9.6, 9.7) |
| [ ] | Import a file with `abc` in a Meet target | The problem is listed with its row; **Import** stays greyed out |
| [ ] | Dashboard → **Board report** | The PDF matches 10.3 |
| [ ] | Agent: *"Send me the scorecard in Excel"* | A link to a workbook like the first row's |

### 14.7 The agent

Run the whole conversation in 8.12, in **Teams** this time rather than the
Test pane, as yourself and then as the Sales Member.

| ✓ | Check | Expected |
| --- | --- | --- |
| [ ] | Every row of 8.12 | As listed there |
| [ ] | *"Make the board report for September 2026"* | A link to the PDF |
| [ ] | As someone who isn't registered: *"Hi"* | The agent offers to register them |

### 14.8 Year-end and recovery

| ✓ | Do this | Expected |
| --- | --- | --- |
| [ ] | Manage: **close** FY2026/27 | After a few minutes it shows "Closed". Every screen still shows the scores; **Save** is greyed out everywhere; the agent refuses figures with "FY2026/27 is closed. …" |
| [ ] | **Reopen** it with a reason | Editing works again. The Change log shows "Closed" and "Reopened" with your reason |
| [ ] | Create FY2030/31, move it to Holding with the wrong phrase | Refused: "Type the phrase exactly as shown." |
| [ ] | Move it to Holding with the right phrase | It disappears from every year picker and appears on the Holding screen with 30 days to go |
| [ ] | Restore it from Holding, then move it to Holding again and purge it (11.3) | The Change log shows "Moved to holding", "Restored from holding", "Moved to holding" and "Permanently deleted" |
| [ ] | Backups: restore `Before final tests` | Everything is back as in 14.1. An automatic checkpoint "Before restore …" now exists |

### 14.9 Background jobs

| ✓ | Check | Expected |
| --- | --- | --- |
| [ ] | Power Automate → **My flows** → **B1**, **B2**, **B3** (and **B4**) → run history | Each has run on its schedule without failing |
| [ ] | KPI score table | The current month has `standard` scores for every KPI of the year it belongs to |

When every row is ticked, the new version is ready. Carry on with Part 12
to move your real data across.

---

## Part 15. Troubleshooting

### 15.1 How to find out what went wrong

Almost every problem shows up in one of four places. Look there first.

| Where | How to open it | What it tells you |
| --- | --- | --- |
| **A flow's run history** | Power Automate → **Solutions → KPI Scorecard** → the flow → **28-day run history**. Click a run marked **Failed**. | The step with a red mark failed. Click it to see its inputs, outputs and the error message. |
| **Recalculation requests** | Power Apps → **Tables → Recalculation request**, newest first | **Waiting** for more than a few minutes: S7 isn't running. **Failed**: open S7's run history. |
| **The app's Monitor** | In Power Apps Studio, **Advanced tools → Monitor** (or **Live monitor**) → **Play published app** | Every data request and flow call the app makes, with the error if it fails. |
| **The agent's activity** | In Copilot Studio's **Test** pane, click **Show activity** or the activity map icon | Which topic and tools the agent chose, what it filled in, and what each tool returned. |

### 15.2 Problems and fixes

#### Scores

| What you see | Likely cause | Fix |
| --- | --- | --- |
| Scores don't change after a figure is saved | The Recalculation request is still **Waiting**: S7 is turned off, or its trigger is set up wrongly | Open S7. If it says **Turned off**, click **Turn on**. Check the trigger (5.12, steps 2 and 3). |
| A request is stuck on **Running** for over an hour | S7's run failed in a way that skipped **Mark_failed** | Open S7's run history and cancel the run if it's still going. Set the request's Status to `Failed` by hand, and add a fresh request for the same year. |
| A whole month shows no scores | It's a new month and B1 hasn't run yet, or the month is after today | Run **B1** (11.2) by hand. Months after the current one are never scored. |
| One KPI's score looks wrong | Its figure, targets, phasing, frequency, deadline or an override | Open the KPI's page and read **How this score is made up**. Compare it with the rules in Appendix B. To test the scoring by itself, run S5 (5.10) with the KPI's settings. |
| A parent's score is 0.1 off the web app's | A rounding tie in Route B (Part 16) | Nothing to fix. If it matters, use Route A (Appendix A). |
| The dashboard options take a long time | Each new combination is worked out the first time someone picks it | Expected: a few minutes. They're cleared and worked out again after every save (5.12). |
| A closed year shows no scores | The year was closed before its scores were complete | Reopen it, add a recalculation request for the year, wait for **Done**, then close it again. |

#### Signing in and permissions

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "You aren't registered …" for someone who registered | Their sign-in address differs from the **Email** in their App user row | Open any flow run they started, click the trigger and copy the address shown. Put it in their App user **Email**. (See 8.6 if your company signs in with one address and emails with another.) |
| "Your registration is waiting …" | They're not approved yet | Approve them on **Users and approvals**. |
| A Member can't edit a KPI they should own | Their department doesn't own the KPI | Check the KPI's owning departments on its settings, and their **Department** in App user. |
| "You need a Power Apps license" | No licence that covers Dataverse | Ask IT (13.2). |
| Someone can change table rows directly | They have more than the **Scorecard Reader** role | Remove the extra role (4.2 to 4.4). |

#### Flows

| What you see | Likely cause | Fix |
| --- | --- | --- |
| The app says "… failed" or "The connector returned an error" | The core flow behind the wrapper failed | Open the wrapper's run history, then the core flow's. The red step says why. |
| "… child flow … must use 'Run only users' …" | A child flow's **Run only users** isn't set | Open the child flow → **Details → Run only users → Edit**, and set every connection to the service account (Procedure F). |
| Every flow stops working at once | The connections belonged to someone who left, or their password changed | Switch every connection reference to the service account's connections (4.5). |
| A flow is **Turned off** | Power Automate turns off flows that fail for 14 days, or whose owner's licence ended | Fix the cause, then **Turn on**. |
| "Rate limit exceeded" or "429" | Too many requests in a short time, often during a big import | Wait five minutes and try again. Split very large imports. |
| A Teams message never arrives | The Flow bot is blocked in Teams, or the App user **Email** is wrong | Ask IT to allow the **Power Automate** app in Teams. Check the email. |

#### The app

| What you see | Likely cause | Fix |
| --- | --- | --- |
| A formula is underlined in red | A control or table has a different name from the guide's | Rename the control, or fix the name in the formula (7.2). |
| A yellow triangle mentions "delegation" | The formula can't be worked out by Dataverse | Type the formula exactly as given; check **Data row limit** is 2000 (7.2). |
| A screen is blank after a restore | KPI ids change in a restore | Close and reopen the app. |
| The app is slow to open | Too much is loaded in **App.OnStart** or a screen's **OnVisible** | Check you used the formulas as given, which only load the selected year and month. |

#### The agent

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "I'm not sure how to help with that" | No tool's description matches what was asked | Reword the tool's description (8.6). Use the words people actually type. |
| It uses the wrong tool | Two descriptions overlap | Make each description say what the tool is **not** for, too. |
| It asks the person for their email | **CallerEmail** isn't set to a **Custom value** | Set it to `System.User.PrincipalName` (8.6, step 8). |
| "Something unexpected happened" during a tool | The agent flow failed, or took more than about 100 seconds | Check the flow's run history. For a slow export, use the app instead. |
| Changes don't show in Teams | The agent wasn't published after the change | Click **Publish** again (13.6). |
| It makes up a figure or a score | It answered from general knowledge | Check **general knowledge** and **web search** are off (8.5), and that the instructions tell it to use the tools for every number (8.4). |

#### Excel and the board report

| What you see | Likely cause | Fix |
| --- | --- | --- |
| "Office Scripts are disabled" | Turned off for your organisation | Send IT the email in 9.2. |
| The script takes too long | The workbook is too big for one run | Split it into two files (9.1). |
| "There is no file called …" | The file isn't in **Scorecard Imports**, or its name has changed | Upload it again and pick it from the list. |
| The board report fails with "the template is invalid" | A content control is missing its title, or a repeating section doesn't cover a whole table row | Fix the template (10.2) and upload it again. |

### 15.3 Getting more help

- **Microsoft Learn** ([learn.microsoft.com](https://learn.microsoft.com)) has a page for every action and setting. Search for its exact name.
- The **Power Platform community** forums ([community.powerplatform.com](https://community.powerplatform.com)) answer most questions within a day. Include the error message and the step's name, never your data.
- Your **IT team** can see more than you can: licences, the Teams admin center and the Power Platform admin center.

---

## Part 16. Differences from the web app

The new version does everything the web app does, but a few things work
differently because of how the Power Platform works. Share this list with
your admins.

| Topic | In the web app | In the new version | Why, and what to do |
| --- | --- | --- | --- |
| **Signing in** | Its own usernames and passwords, with a lockout after 5 wrong tries, password changes and admin resets | Everyone signs in with their Microsoft work account | Lockouts, multi-factor sign-in and password resets are handled by Microsoft (Entra ID). The scorecard only keeps each person's approval, role and department. |
| **Deleting a fiscal year** | Asks for the admin's username, password and a typed phrase | Asks for the username and the phrase, not the password | Flows can't check a Microsoft password, and nobody should type one into a chat. For a stronger check, add a Teams **Approvals** step to A18 so a second admin must approve the deletion. |
| **Purging held years** | On the next admin page view after 30 days | Every night at 02:00 (B2, Part 11) | More predictable. |
| **When scores are worked out** | Every time a page opens | In the background after every save, usually within a few minutes, and saved in the KPI score table | Pages open much faster. After saving a figure, wait a few minutes for the scores to catch up. The app and agent never show half-updated scores: each month is replaced in one go. |
| **Which months have scores** | Any month you pick | Months up to the current one | Future months have no figures, so their scores would be empty anyway. B1 (Part 11) adds each new month. |
| **Dashboard options** (missing figures and estimates) | Worked out instantly | Worked out the first time someone picks a combination, which takes a few minutes, then instant until the next save | The banner on the Dashboard says when they're being worked out. |
| **Score accuracy** | Exact | Route A: exact. Route B: identical in almost every case; very rarely 0.1 different on a parent or the total when its exact score falls on a tie such as 3.45 | Measured: 3 in 24,305 roll-ups (5.1). Use Route A (Appendix A) if this matters. |
| **Charts** | On the Dashboard and KPI pages | In the app, using Power Apps' own line and column charts | They look a little different. The agent describes trends in words. |
| **Entering many figures at once** | The Enter Data grid | The same grid in the app, the Excel import, or the agent (a few figures at a time, in plain English) | The agent reads figures with AI and always shows what it understood before saving. Check it before clicking **Confirm**. |
| **Excel import checks** | The workbook rules | The same rules, plus the checks every saved figure goes through (A01): months outside the fiscal year and completion dates after the month being reported are refused | A file the web app accepted can occasionally show a problem here. Fix the figure and import again. |
| **Completion dates in Excel** | Must be text such as `2026-10-15` | Text, or a real Excel date cell | Small improvement. |
| **Parent codes in Excel** | Checked for repeats | Also checked for loops (a KPI that is its own grandparent) | Small improvement. |
| **Board report** | A printable web page | A PDF made from a Word template (Part 10) | You design the layout once in Word, in your company's style. |
| **Restoring a checkpoint** | Keeps links to KPI pages working | KPI ids change, so saved links to a KPI's page stop working | Refer to KPIs by code. Close and reopen the app after a restore. |
| **Web app backup files** | Can be restored | Can't be restored in the new version (a different layout) | Move data across with the Excel workbook (Part 12). |
| **Score overrides and change history** | Kept in backups | Not carried by the Excel workbook | Re-enter overrides after moving (12.4). Keep the web app's audit trail export as a record. |
| **Cost** | Hosting only | Power Apps Premium (or per-app) licences for everyone, Power Automate Premium for the service account, Copilot Studio messages and AI Builder credits | Check with IT before you start (1.2 and 13.2). Route A adds a small Azure bill. |

### 16.1 A quirk carried over from the web app

Both versions score a figure that falls **in a gap between two range
windows** the same way: **5.0** when higher is better and **0** when lower is
better, whichever windows the gap sits between.

Gaps are easy to create by accident. KPI 1.3 in the sample data has the
windows Good 80–89 and Very good 90–94. A satisfaction score of **89.5** falls
between them, so it scores 5.0, the same as a perfect result, instead of about 3.9.
For a lower-is-better KPI, the same kind of figure scores 0.

This is a mistake in the web app's rule, not in this guide. The new version
copies it on purpose, so the two give the same scores while you compare them
(12.6). To avoid it, make each window start exactly where the one below it
ends (Good 80–90, Very good 90–95 and so on); a figure on the shared edge
counts in the window with the lower numbers. Appendix B, section B.3 has the details. If you'd
like the rule itself fixed, ask your developer to change the web app's
`scoreRangeTarget` and the S2 flow (5.6) together.

---

## Appendix A. Developer handover: exact scoring with an Azure Function

This appendix is for a **developer**. It replaces the hardest flows in Part 5
with the web app's own scoring code, running as an Azure Function, so the
scores match the web app exactly and a full recalculation takes seconds
rather than minutes. It's Route A from "Choose how the scores are
calculated". Plan on about a day, including testing.

### A.1 What changes in the guide

| Guide step | With Route A |
| --- | --- |
| 5.5 S1, 5.6 S2, 5.7 S3, 5.10 S5 | **Don't build them.** The function does their work. |
| 5.11 S6 Score a month | Build the **shorter S6** in A.6 instead. Same name, same inputs, same tables. |
| 6.13 A31 Simulate | Build the **shorter A31** in A.7 instead. |
| Everything else (S4, S7, every A-flow, the app, the agent) | **Unchanged.** They only ever call S6 or read the KPI score and Total score tables. |

### A.2 How it works

```text
  S7 Recalculate ──► S6 Score a month (shorter)
                        1. reads the year's KPIs, figures and overrides from Dataverse (as in 5.11, step 1)
                        2. POSTs them to the function ──► scoreMonth: the web app's buildScoredTree()
                        3. writes the returned rows into KPI score and Total score
```

The function is **stateless**: it never touches Dataverse and has no
credentials. It takes the rows that the flow's **List rows** actions return,
converts them to the web app's types, runs `buildScoredTree` from
`src/lib/kpi-tree.ts`, and returns one object per KPI, named after the KPI
score table's columns.

**How it was checked.** The code below was run against the sample data (Appendix C)
in all nine combinations of the dashboard options, plus a later month, an
override and a "what if" figure. It was compared column by column with the
Route B flows (3,860 values). Every score, band, coverage, weight, share and
flag matched. The one difference is cosmetic: for a milestone that is overdue
and not yet completed, the function also fills in **Raw score**, where Route B
leaves it empty.

### A.3 Create the project

You need Node.js 20 or later, the Azure Functions Core Tools v4 (`func`), the
Azure CLI and access to an Azure subscription.

```bash
func init scorecard-scoring --worker-runtime node --language typescript --model V4
cd scorecard-scoring
mkdir -p src/engine
# Copy the web app's engine unchanged. These three files depend only on each other.
cp ../kpi-scorecard/src/lib/scoring.ts ../kpi-scorecard/src/lib/scoring-modes.ts ../kpi-scorecard/src/lib/kpi-tree.ts src/engine/
```

In `tsconfig.json`, set `"target"` to `"ES2022"` (the engine uses `Array.prototype.at`) and `"strict"` to `true`. Then add
the two files in A.4 and build:

```bash
npm install
npm run build
```

### A.4 The code

**`src/engine/scoreMonth.ts`**: converts Dataverse rows, scores, and shapes the result.

```typescript
import { buildScoredTree, type KpiRecord, type ScoredNode, type ScoreOverrideRecord, type ValueRecord } from "./kpi-tree";
import type { ScoringOptions } from "./scoring-modes";

// Turns the rows Dataverse's "List rows" returns into the web app's shapes, scores one month with the
// web app's own engine, and returns one object per KPI named after the KPI score table's columns.

type Row = Record<string, unknown>;
const label = (row: Row, column: string) => row[`${column}@OData.Community.Display.V1.FormattedValue`] as string | undefined;
const fromLabel = (text: string | undefined) => (text ? text.trim().toUpperCase().replace(/ /g, "_") : null);
const DIRECTION: Record<string, string> = { HIGHER_IS_BETTER: "HIGHER_BETTER", LOWER_IS_BETTER: "LOWER_BETTER" };
const BAND_LABEL: Record<string, string> = {
  POOR: "Poor", IMPROVEMENT_NEEDED: "Improvement needed", MEET: "Meet",
  GOOD: "Good", VERY_GOOD: "Very good", EXCELLENT: "Excellent",
};
const UNREPORTED: Record<string, ScoringOptions["dueMode"]> = { exclude: "exclude", assume: "assume-meet-decay", zero: "zero" };

export type ScoreMonthRequest = {
  period: string;
  estimateMode: "count" | "exclude" | "zero";
  unreportedMode: "exclude" | "assume" | "zero";
  kpis: Row[];
  values: Row[];
  overrides: Row[];
  /** Simulate only: "what if" figures for this month, scored as Actuals in place of the KPI's real ones. */
  whatIf?: { kpiId: string; value?: number | null; plannedValue?: number | null; completionDate?: string | null }[];
};

export function scoreMonth(req: ScoreMonthRequest) {
  const kpis: KpiRecord[] = req.kpis.map((r) => {
    const direction = fromLabel(label(r, "sc_direction"));
    return {
      id: r.sc_kpiid as string,
      code: r.sc_code as string,
      name: r.sc_name as string,
      parentId: (r._sc_parent_value as string | null) ?? null,
      sortOrder: Number(r.sc_sortorder ?? 0),
      weight: Number(r.sc_weight ?? 0),
      frequency: (fromLabel(label(r, "sc_frequency")) ?? "MONTHLY") as KpiRecord["frequency"],
      phasing: (fromLabel(label(r, "sc_phasing")) ?? "NONE") as KpiRecord["phasing"],
      phaseConfig: (r.sc_phaseshares as string | null) ?? null,
      metricType: fromLabel(label(r, "sc_metrictype")) as KpiRecord["metricType"],
      direction: (direction ? DIRECTION[direction] : null) as KpiRecord["direction"],
      targetMode: fromLabel(label(r, "sc_targetmode")) as KpiRecord["targetMode"],
      targetConfig: (r.sc_targetconfig as string | null) ?? null,
      unit: (r.sc_unit as string | null) ?? null,
      deadlineMonth: (r.sc_deadlinemonth as string | null) || null,
      scoreFinalAfterDeadline: r.sc_scorefinalafterdeadline === true,
      completed: r.sc_completed === true,
      completedPeriod: (r.sc_completedperiod as string | null) || null,
      departments: [],
    };
  });
  const values: ValueRecord[] = req.values.map((r) => ({
    kpiId: r._sc_kpi_value as string,
    period: r.sc_period as string,
    value: r.sc_value == null ? null : Number(r.sc_value),
    plannedValue: r.sc_plannedvalue == null ? null : Number(r.sc_plannedvalue),
    basis: fromLabel(label(r, "sc_basis")) === "ESTIMATE" ? "ESTIMATE" : "ACTUAL",
    completionDate: r.sc_completiondate ? new Date(`${String(r.sc_completiondate).slice(0, 10)}T00:00:00Z`) : null,
    note: null,
  }));
  for (const w of req.whatIf ?? []) {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i].kpiId === w.kpiId && values[i].period === req.period) values.splice(i, 1);
    }
    values.push({
      kpiId: w.kpiId, period: req.period, value: w.value ?? null, plannedValue: w.plannedValue ?? null, basis: "ACTUAL",
      completionDate: w.completionDate ? new Date(`${w.completionDate.slice(0, 10)}T00:00:00Z`) : null, note: null,
    });
  }
  const overrides = new Map<string, ScoreOverrideRecord[]>();
  for (const r of req.overrides) {
    const id = r._sc_kpi_value as string;
    overrides.set(id, [...(overrides.get(id) ?? []),
      { period: r.sc_period as string, score: Number(r.sc_score), reason: String(r.sc_reason ?? ""), byUsername: "", createdAt: new Date(0) }]);
  }

  const options: ScoringOptions = { estimateMode: req.estimateMode, dueMode: UNREPORTED[req.unreportedMode] ?? "exclude" };
  const { roots, total } = buildScoredTree(kpis, values, req.period, overrides, options);
  // "Raw score" is the figure's own score: before a deadline rule, an override or the dashboard options changed it.
  const plain = buildScoredTree(kpis, values, req.period, undefined, {
    estimateMode: req.estimateMode === "zero" ? "count" : req.estimateMode, dueMode: "exclude",
  }).byId;

  // The weight columns follow the web app's own roll-up: each row's weights are on its parent's scale
  // (its local weight), exactly as S6 in Part 5 stores them.
  const source = new Map(req.kpis.map((r) => [r.sc_kpiid as string, r]));
  const out: Row[] = [];
  const visit = (node: ScoredNode) => {
    const leaf = node.leaf;
    const src = source.get(node.id) ?? {};
    const totalWeight = node.isLeaf ? node.weight : node.children.reduce((sum, c) => sum + c.weight, 0);
    const scored = node.score !== null;
    out.push({
      kpiId: node.id, parentId: node.parentId ?? "", code: node.code, name: node.name, level: node.level,
      globalWeight: node.globalWeight, localWeight: node.weight, path: src.sc_path ?? "", sortKey: src.sc_sortkey ?? "",
      isLeaf: node.isLeaf, hasScore: scored, score: node.score, exactScore: node.exactScore,
      band: node.band ? BAND_LABEL[node.band] : null,
      pendingReason: !leaf || scored ? null : leaf.pendingReason === "NOT_YET_DUE" ? "Not yet due" : "No data",
      basis: leaf?.basis ? (leaf.basis === "ESTIMATE" ? "Estimate" : "Actual") : null,
      provisional: node.provisional, prorated: node.prorated, overridden: !!leaf?.override, assumed: node.assumed,
      valueUsed: leaf?.value ?? null, plannedValueUsed: leaf?.plannedValue ?? null,
      completionDateUsed: leaf?.completionDate ? leaf.completionDate.slice(0, 10) : null,
      rawScore: leaf ? (leaf.deadline?.rawScore ?? plain.get(node.id)?.score ?? null) : null,
      deadlineCap: leaf?.deadline?.cap ?? null, monthsLate: leaf ? (leaf.deadline?.monthsLate ?? 0) : null,
      frozenAtDeadline: leaf?.deadline?.frozen ?? false,
      totalWeight, scoredWeight: node.scoredWeight, scoreTimesWeight: scored ? (node.exactScore ?? 0) * node.scoredWeight : 0,
      provisionalWeight: node.provisionalWeight, notYetDueWeight: node.notYetDueWeight,
      proratedWeight: node.proratedWeight, assumedWeight: node.assumedWeight,
      coverage: node.coverage,
      provisionalShare: !node.isLeaf && scored && totalWeight > 0
        ? node.children.reduce((sum, c) => sum + c.provisionalWeight, 0) / totalWeight : 0,
      notYetDueShare: node.notYetDueShare, proratedShare: node.proratedShare,
      leafCount: node.leafCount, scoredLeafCount: node.scoredLeafCount,
    });
    node.children.forEach(visit);
  };
  roots.forEach(visit);

  return {
    kpiScores: out,
    total: {
      hasScore: total.score !== null, score: total.score, exactScore: total.exactScore,
      band: total.band ? BAND_LABEL[total.band] : null,
      coverage: total.coverage, provisionalShare: total.provisionalShare, notYetDueShare: total.notYetDueShare,
      proratedShare: total.proratedShare, totalWeight: total.totalWeight, scoredWeight: total.scoredWeight,
      leafCount: total.leafCount, scoredLeafCount: total.scoredLeafCount,
    },
  };
}
```

**`src/functions/scoreMonth.ts`**: the HTTP trigger (delete the sample function `func init` created).

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { scoreMonth, type ScoreMonthRequest } from "../engine/scoreMonth";

export async function scoreMonthHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as ScoreMonthRequest;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(body?.period ?? "")) {
      return { status: 400, jsonBody: { error: "period must be YYYY-MM" } };
    }
    return { jsonBody: scoreMonth(body) };
  } catch (err) {
    context.error(err);
    return { status: 400, jsonBody: { error: err instanceof Error ? err.message : String(err) } };
  }
}

app.http("scoreMonth", { methods: ["POST"], authLevel: "function", handler: scoreMonthHandler });
```

**Try it locally.** Run `npm start`, save the request below as
`sample-request.json`, and post it:

```bash
curl -s -X POST http://localhost:7071/api/scoreMonth -H "Content-Type: application/json" -d @sample-request.json
```

```json
{
  "period": "2026-09",
  "estimateMode": "count",
  "unreportedMode": "exclude",
  "kpis": [
    { "sc_kpiid": "g1", "sc_code": "1", "sc_name": "Grow the business", "_sc_parent_value": null, "sc_sortorder": 1, "sc_weight": 100,
      "sc_path": "|g1|", "sc_sortkey": "0001" },
    { "sc_kpiid": "k1", "sc_code": "1.1", "sc_name": "Revenue growth", "_sc_parent_value": "g1", "sc_sortorder": 1, "sc_weight": 100,
      "sc_metrictype@OData.Community.Display.V1.FormattedValue": "Percentage",
      "sc_direction@OData.Community.Display.V1.FormattedValue": "Higher is better",
      "sc_targetmode@OData.Community.Display.V1.FormattedValue": "Fixed",
      "sc_frequency@OData.Community.Display.V1.FormattedValue": "Monthly",
      "sc_phasing@OData.Community.Display.V1.FormattedValue": "None",
      "sc_targetconfig": "{\"POOR\":60,\"IMPROVEMENT_NEEDED\":70,\"MEET\":80,\"GOOD\":90,\"VERY_GOOD\":95,\"EXCELLENT\":100}",
      "sc_path": "|g1|k1|", "sc_sortkey": "0001.0001" }
  ],
  "values": [
    { "_sc_kpi_value": "k1", "sc_period": "2026-09", "sc_value": 85, "sc_basis@OData.Community.Display.V1.FormattedValue": "Actual" }
  ],
  "overrides": []
}
```

Expected: two rows in `kpiScores`, both with `"score": 3.4` and `"band": "Meet"`
(85 reaches the Meet target of 80), and `total.score` 3.4 with `coverage` 1.

### A.5 Deploy it and give the flows its address

> **Do this:**
>
> 1. In the Azure portal, create a **Function App**: runtime **Node.js 20** (or later), operating system **Linux**, hosting plan **Flex Consumption** (or **Consumption**), in the region closest to your Power Platform environment. The cost for a scorecard is usually a few dollars a month or less.
> 2. Publish: `func azure functionapp publish <your function app name>`.
> 3. In the portal, open the function app → **Functions → scoreMonth → Get function URL**, and copy the **default (function key)** URL. Split it into the address (everything before `?code=`) and the key (everything after it).
> 4. In Power Apps, open **Solutions → KPI Scorecard → + New → More → Environment variable** twice:
>    - **Display name** `Scoring URL`, **Data type** Text, **Current value** the address.
>    - **Display name** `Scoring key`, **Data type** Text, **Current value** the key. (If your company uses Azure Key Vault, make this a **Secret** instead.)
> 5. Optionally, in the function app's **Networking**, restrict inbound traffic to the Power Platform's service tag for your region.
>
> **Check it worked:** post `sample-request.json` to the deployed URL (with `?code=<key>`) and get the same answer as locally.

### A.6 The shorter S6 Score a month

Build this in place of 5.11. It has the same name and the same six inputs,
so S7 and A30 call it without any change.

> **Do this:**
>
> 1. Create the child flow `S6 Score a month` (Procedure F) with the six **Text** inputs from 5.11: FiscalYearId, Period, Scenario, EstimateMode, UnreportedMode and OnlyKpiId. (OnlyKpiId is accepted but not needed: the function scores the whole year in well under a second.)
> 2. Build **step 1 of 5.11** exactly as written, **except**:
>    - skip the `DeadlineScores` variable (5.11, step 1.2);
>    - add `sc_sortorder` to `List_KPIs`'s **Select columns**;
>    - skip the **Filter array** actions `Leaves` and `FrozenLeaves`.
> 3. Add an **HTTP** action (premium), renamed `Score`:
>    - **Method:** POST
>    - **URI:** the **Scoring URL** environment variable (from Dynamic content, under **Environment variables**)
>    - **Headers:** `Content-Type` = `application/json`, and `x-functions-key` = the **Scoring key** environment variable
>    - **Body:**
>
>      ```text
>      {
>        "period": "@{variables('Period')}",
>        "estimateMode": "@{variables('EstimateMode')}",
>        "unreportedMode": "@{variables('UnreportedMode')}",
>        "kpis": @{outputs('List_KPIs')?['body/value']},
>        "values": @{outputs('List_values')?['body/value']},
>        "overrides": @{outputs('List_overrides')?['body/value']}
>      }
>      ```
>
>    - In its **Settings**, set the **Retry policy** to **Exponential interval**, count `4`, so a cold start doesn't fail the run.
> 4. Add **Apply to each** `Each_row` over `body('Score')?['kpiScores']`, with **Concurrency control** on and degree `20`. Inside it:
>    1. **Filter array** `Row_existing`. **From:** `outputs('List_existing')?['body/value']`. Rule: `@equals(item()?['_sc_kpi_value'], items('Each_row')?['kpiId'])`
>    2. Dataverse **Update a row** `Save_row`. **Table:** KPI scores. **Row ID:** `coalesce(first(body('Row_existing'))?['sc_kpiscoreid'], guid())`. Click **Show all** and fill in the columns:

| Column | Value |
| --- | --- |
| **Name** | `concat(items('Each_row')?['code'],' ',variables('Period'),' ',variables('Scenario'))` |
| **KPI** | `concat('sc_kpis(',items('Each_row')?['kpiId'],')')` |
| **Fiscal year** | `concat('sc_fiscalyears(',variables('FiscalYearId'),')')` |
| **Period** | `variables('Period')` |
| **Scenario** | `variables('Scenario')` |
| **Code** | `items('Each_row')?['code']` |
| **KPI name** | `items('Each_row')?['name']` |
| **Level** | `items('Each_row')?['level']` |
| **Global weight** | `items('Each_row')?['globalWeight']` |
| **Local weight** | `items('Each_row')?['localWeight']` |
| **Path** | `items('Each_row')?['path']` |
| **Sort key** | `items('Each_row')?['sortKey']` |
| **Parent id** | `items('Each_row')?['parentId']` |
| **Is leaf** | `items('Each_row')?['isLeaf']` |
| **Has score** | `items('Each_row')?['hasScore']` |
| **Score** | `items('Each_row')?['score']` |
| **Exact score** | `items('Each_row')?['exactScore']` |
| **Band** | `items('Each_row')?['band']` |
| **Pending reason** | `items('Each_row')?['pendingReason']` |
| **Basis** | `items('Each_row')?['basis']` |
| **Provisional** | `items('Each_row')?['provisional']` |
| **Prorated** | `items('Each_row')?['prorated']` |
| **Overridden** | `items('Each_row')?['overridden']` |
| **Assumed** | `items('Each_row')?['assumed']` |
| **Value used** | `items('Each_row')?['valueUsed']` |
| **Planned value used** | `items('Each_row')?['plannedValueUsed']` |
| **Completion date used** | `items('Each_row')?['completionDateUsed']` |
| **Raw score** | `items('Each_row')?['rawScore']` |
| **Deadline cap** | `items('Each_row')?['deadlineCap']` |
| **Months late** | `items('Each_row')?['monthsLate']` |
| **Frozen at deadline** | `items('Each_row')?['frozenAtDeadline']` |
| **Total weight** | `items('Each_row')?['totalWeight']` |
| **Scored weight** | `items('Each_row')?['scoredWeight']` |
| **Score times weight** | `items('Each_row')?['scoreTimesWeight']` |
| **Provisional weight** | `items('Each_row')?['provisionalWeight']` |
| **Not yet due weight** | `items('Each_row')?['notYetDueWeight']` |
| **Prorated weight** | `items('Each_row')?['proratedWeight']` |
| **Assumed weight** | `items('Each_row')?['assumedWeight']` |
| **Coverage** | `items('Each_row')?['coverage']` |
| **Provisional share** | `items('Each_row')?['provisionalShare']` |
| **Not yet due share** | `items('Each_row')?['notYetDueShare']` |
| **Prorated share** | `items('Each_row')?['proratedShare']` |
| **Leaf count** | `items('Each_row')?['leafCount']` |
| **Scored leaf count** | `items('Each_row')?['scoredLeafCount']` |

> 5. After **Each_row**, add **List rows** `Existing_total` on **Total scores**, with **Filter rows** exactly as in 5.11, step 5.2.
> 6. Add **Update a row** `Save_total`. **Table:** Total scores. **Row ID:** `coalesce(first(outputs('Existing_total')?['body/value'])?['sc_totalscoreid'], guid())`. Fill in:

| Column | Value |
| --- | --- |
| **Name** | `concat('Total ',variables('Period'),' ',variables('Scenario'))` |
| **Fiscal year** | `concat('sc_fiscalyears(',variables('FiscalYearId'),')')` |
| **Period** | `variables('Period')` |
| **Scenario** | `variables('Scenario')` |
| **Has score** | `body('Score')?['total']?['hasScore']` |
| **Score** | `body('Score')?['total']?['score']` |
| **Exact score** | `body('Score')?['total']?['exactScore']` |
| **Band** | `body('Score')?['total']?['band']` |
| **Coverage** | `body('Score')?['total']?['coverage']` |
| **Provisional share** | `body('Score')?['total']?['provisionalShare']` |
| **Not yet due share** | `body('Score')?['total']?['notYetDueShare']` |
| **Prorated share** | `body('Score')?['total']?['proratedShare']` |
| **Total weight** | `body('Score')?['total']?['totalWeight']` |
| **Scored weight** | `body('Score')?['total']?['scoredWeight']` |
| **Leaf count** | `body('Score')?['total']?['leafCount']` |
| **Scored leaf count** | `body('Score')?['total']?['scoredLeafCount']` |

> 7. Add **Respond to a Power App or flow** with a **Text** output `Result` set to `done`. Save, and set **Run only users** (Procedure F).
>
> **Check it worked:** run the test in 5.11 ("Test it", steps 1 to 5). The results must be identical: Appendix C, sections C.4 and C.5, a total of **3.5 (Good)**, and **2.8** for `count|zero`. Then run 5.13.
>
> **If something goes wrong:**
>
> - **Score** returns **401**: the key is wrong or the header name isn't exactly `x-functions-key`.
> - **Score** returns **400** with "period must be YYYY-MM": the Period input is empty.
> - Every KPI scores **No data**: the choice labels didn't come through. Check `List_KPIs`'s **Select columns** include `sc_metrictype`, `sc_direction`, `sc_targetmode`, `sc_frequency` and `sc_phasing`, and that the choice items are spelt exactly as in 3.7 (the function turns "Higher is better" into `HIGHER_BETTER`).

### A.7 The shorter A31 Simulate

Build this in place of the A31 steps in 6.13. Inputs, permission check and
response are the same, so the Simulate screen (7.10) needs no change.

> **Do this:**
>
> 1. Procedure J, with Need `signed-in` and KpiId `none`. Above the Check action, add **Initialize variable** `Period` (String) set to the Period input, and **Initialize variable** `FiscalYearId` (String), empty.
> 2. On the True side of **If_allowed**:
>    1. **Compose** `Changes`: `json(` ChangesJson `)`.
>    2. **Get a row by ID** `First_kpi`, table KPIs, Row ID `first(outputs('Changes'))?['kpiId']`.
>    3. **Set variable** `FiscalYearId` to `outputs('First_kpi')?['body/_sc_fiscalyear_value']`.
>    4. The same three **List rows** as A.6 step 2 (`List_KPIs`, `List_values`, `List_overrides`), with the same filters and columns.
>    5. The same **HTTP** action `Score` as A.6 step 3, with one more line in the body, after `"overrides": …`:
>
>       ```text
>       ,"whatIf": @{outputs('Changes')}
>       ```
>
>    6. **Filter array** `Changed`. **From:** `body('Score')?['kpiScores']`. Rule: `@contains(string(outputs('Changes')), item()?['kpiId'])`
>    7. **Select** `Results`. **From:** `body('Changed')`. Map: `kpiId` → `item()?['kpiId']`, `hasScore` → `item()?['hasScore']`, `score` → `item()?['score']`, `band` → `item()?['band']`, `provisional` → `item()?['provisional']`, `prorated` → `item()?['prorated']`.
>    8. **Respond to a Power App or flow**: Ok `true`, Message empty, Data `string(body('Results'))`.
>
> **Check it worked:** the same check as 6.13: Period `2026-09`, ChangesJson `[{"kpiId":"K111","value":95}]` returns `"score":4.5` and `"band":"Very good"`, and nothing is saved.

With Route A, a KPI frozen at its deadline is also scored correctly in
Simulate, so you can remove the lock on frozen KPIs in 7.10 if you like.

### A.8 Keeping the engine in step

- The function **is** the web app's scoring code. When the web app's scoring rules change, copy the three files again (A.3), rebuild and publish. Nothing in the Power Platform changes.
- `scoreMonth.ts` relies only on `buildScoredTree`, the `KpiRecord`, `ValueRecord`, `ScoreOverrideRecord` and `ScoredNode` types, and `ScoringOptions`. If any of those are renamed, the build fails rather than producing wrong scores.
- Keep the project in source control next to the web app, with `sample-request.json` and the expected answer as a smoke test.
- If the Power Platform environment moves (for example to a test environment), update the two environment variables there. The function itself doesn't change.

---

## Appendix B. The scoring rulebook

This appendix explains, in plain words, how every score is worked out. It is
exactly what the web app does, and what the flows in Part 5 (or the Azure
Function in Appendix A) do.

You use it in three places:

- **The agent's knowledge.** In 8.2 you paste the grey box in B.9 into Word and
  upload it, so the agent can explain any score.
- **The app's Help screen** (7.11) takes its "How scores work" section from here.
- **You**, when a score looks wrong (15.2). Work through the KPI's figure by
  hand with the rules below, using the examples as a pattern.

Sections B.1 to B.8 explain each rule with an example from the sample data
(Appendix C). B.9 is the same rules in one grey box, ready to copy.

### B.1 The 0 to 5 scale and the six bands

Every score is a number from **0.0 to 5.0**, with one decimal place. The
number decides the **band**:

| Band | Scores | Colour in the app |
| --- | --- | --- |
| Poor | 0.0 to 2.4 | Red |
| Improvement needed | 2.5 to 2.9 | Amber |
| Meet | 3.0 to 3.4 | Light green |
| Good | 3.5 to 3.9 | Green |
| Very good | 4.0 to 4.5 | Light blue |
| Excellent | 4.6 to 5.0 | Dark blue |

Scores are rounded to one decimal place at the very end, with halves going up
(3.45 becomes 3.5). Anything below 0 counts as 0 and anything above 5 as 5.

**The fiscal year** runs from 1 April to 31 March. "FY2026/27" starts on
1 April 2026. Months are written `YYYY-MM` (`2026-09` is September 2026), and
April is month 1 of the fiscal year, September month 6 and March month 12.

### B.2 Fixed targets

A fixed-target KPI has **one number per band**: the figure you must reach to
be in that band. For example, KPI 1.1.1 Revenue growth:

| Poor | Improvement needed | Meet | Good | Very good | Excellent |
| --- | --- | --- | --- | --- | --- |
| 60 | 70 | 80 | 90 | 95 | 100 |

**The rule:** find the best band whose target the figure reaches. The score is
the **top** of that band.

- September's figure is **85**. It reaches Meet (80) but not Good (90), so the
  score is **3.4**, the top of Meet.
- 1.1.2 Recurring revenue share has the same targets. Its figure, **96**,
  reaches Very good (95), so it scores **4.5**.
- Reaching 100 or more scores **5.0**. There's no extra credit above that.

**When lower is better** (days, costs, errors), "reaches" means "is at or
below". KPI 2.1 Days to close the books has the targets 10, 8, 6, 4, 3 and 2.
September's figure of **5** is at or below Meet (6) but above Good (4), so it
scores **3.4**.

**Short of the Poor target**, the score is a share of 2.4:

- Higher is better: 2.4 × figure ÷ Poor target. Revenue growth of 30 scores
  2.4 × 30 ÷ 60 = **1.2**.
- Lower is better: 2.4 × Poor target ÷ figure. Closing the books in 20 days
  scores 2.4 × 10 ÷ 20 = **1.2**.

The targets must get harder from Poor to Excellent. The app refuses targets
that don't.

### B.3 Range targets, and gaps between ranges

A range-target KPI has a **window** (a lowest and highest figure) for each
band. KPI 1.3 Customer satisfaction:

| Poor | Improvement needed | Meet | Good | Very good | Excellent |
| --- | --- | --- | --- | --- | --- |
| 0–59 | 60–69 | 70–79 | 80–89 | 90–94 | 95–100 |

**The rule:** find the window the figure is in. The score slides through that
band's scores in step with how far through the window the figure is.

- September's figure is **84**, in the Good window 80–89. It is
  (84 − 80) ÷ (89 − 80) = 0.44 of the way through. Good runs from 3.5 to 3.9,
  so the score is 3.5 + 0.44 × 0.4 = 3.68, shown as **3.7**.
- A figure of exactly 80 scores 3.5; exactly 89 scores 3.9.
- A figure below the lowest window counts as being in that window (here, below
  0 scores 0). A figure above the highest window counts as being in that one
  (above 100 scores 5.0).

**When lower is better**, the windows run the other way: Excellent has the
smallest figures. Inside a window, the smaller end scores the top of the band.
For example, with an Excellent window of 0–2 days, 0 days scores 5.0 and
2 days scores 4.6.

**A figure on the edge of two windows** (for example 90, if Good were 80–90
and Very good 90–95) counts in the window with the **smaller** figures.

**A figure in a gap between two windows.** The sample's windows leave gaps:
there's nothing between 89 and 90. A figure such as **89.5** is in no window.
The rule for this case is:

- when higher is better, it scores **5.0**;
- when lower is better, it scores **0**;

whichever two windows the gap sits between. So 89.5 scores 5.0, the same as a
perfect result, when you'd expect about 3.9. This is a known quirk of the
web app, copied on purpose so both versions agree (Part 16.1).

**How to avoid it:** make each window start exactly where the one below it
ends, for example `{"POOR":[0,60],"IMPROVEMENT_NEEDED":[60,70],"MEET":[70,80],"GOOD":[80,90],"VERY_GOOD":[90,95],"EXCELLENT":[95,100]}`.
Then there are no gaps, and an edge figure falls in the lower window as
described above.

### B.4 Variance KPIs

A variance KPI measures how far a figure is from its plan, in either
direction. Each month has a **figure** and a **planned value**:

> variance = (figure − planned value) ÷ planned value × 100, ignoring any minus sign

The variance is then scored with the KPI's own targets (usually "lower is
better": a small variance is good). With no planned value, or a planned value
of 0, there's no score.

KPI 2.2 Spending against budget: figure 1,060,000, planned 1,000,000. The
variance is 60,000 ÷ 1,000,000 × 100 = **6%**. Its fixed, lower-is-better
targets are 20, 15, 10, 5, 3 and 1, so 6 reaches Meet (10) but not Good (5):
**3.4**. Spending 940,000 would also be 6% and also score 3.4.

### B.5 Milestones (month of completion)

A milestone KPI has a **target month** instead of band targets. Its "figure"
is the **completion date** someone enters. KPI 2.3 New finance system live has
the target month October 2026.

| Finished in… | Band | Score |
| --- | --- | --- |
| More than 3 months early (June 2026 or before) | Excellent | 5.0 |
| 3 months early (July 2026) | Excellent | 5.0 down to 4.6 |
| 2 months early (August 2026) | Very good | 4.5 down to 4.0 |
| 1 month early (September 2026) | Good | 3.9 down to 3.5 |
| The target month (October 2026) | Meet | 3.4 down to 3.0 |
| 1 month late (November 2026) | Improvement needed | 2.9 down to 2.5 |
| 2 or more months late (December 2026 onwards) | Poor | 2.4 on 1 December, falling steadily to 0 on 31 March 2027 |

Within a month, the 1st scores the top of the band and the last day the
bottom. So finishing on 1 October scores **3.4**, on 15 October **3.2**, and
on 31 October **3.0**. Finishing on 20 September scores **3.6**.

**Not finished yet:**

- Up to and including the target month, it is **not yet due**: it has no
  score and is left out of the averages. That's why 2.3 shows **n/d** in
  September 2026.
- After the target month, it's scored **as if it finished on the last day of
  the month being looked at**, so it keeps losing ground. In November 2026,
  2.3 scores **2.5**; in December **1.8**; in January 2027 **1.2**.

If more than one month has a completion date, the earliest one counts.
Phasing and deadlines (B.7) never apply to milestones.

### B.6 Which figure is used

Figures are **year-to-date**: September's figure is the total or position at
the end of September. For each month, the scorecard picks one figure:

1. The month's **actual** figure, if there is one.
2. Otherwise the month's **estimate**.
3. Otherwise the **latest estimate** from an earlier month.
4. Otherwise nothing. An older **actual** is never carried forward: a missing
   year-to-date figure means "not reported this month".

A score that comes from an estimate is **provisional** and is marked "est".
Estimates and actuals are scored the same way.

**How often a KPI reports** decides whether "nothing" counts against it:

| Frequency | Due in |
| --- | --- |
| Monthly | Every month |
| Quarterly | June, September, December and March |
| Annual | March |

With no figure in a month when it isn't due, the KPI is **not yet due** (left
out). With no figure in a month when it is due, it has **no data** (also left
out, but it lowers the coverage).

In the sample: 1.3 is quarterly, and its September figure is an estimate
(84), so it scores **3.7 est**. 2.4 Policies reviewed is quarterly too. It
reported 3 in June, but nothing in September, which is a due month, so it has
**no data** in September.

**Completed KPIs.** When a KPI is marked **Completed** in a month, from that
month on it keeps using its latest actual figure from on or before that month,
frozen. Earlier months aren't affected.

### B.7 Phasing and deadlines

**Phasing** shrinks the targets earlier in the year, for KPIs whose figure
builds up over the year:

- **None:** the full targets every month.
- **Even:** month number ÷ 12 of the targets (half the targets in September,
  month 6).
- **Custom:** the KPI's own 12 monthly shares (April first, adding up to 100).
  In month 6, the first six shares added together, as a percentage.

Every band target, and both ends of every range window, is multiplied by
that fraction. A score against shrunk targets is marked **pro-rated**.

KPI 1.2 New customers has even phasing and the targets 60, 80, 120, 150, 170
and 200. In September they become 30, 40, **60**, 75, 85 and 100. The figure
**55** reaches Improvement needed (40) but not Meet (60), so it scores
**2.9**, pro-rated.

**Deadlines** (any KPI except milestones can have a **Deadline month**):

- Up to the end of the deadline month, the score stands.
- After it, one of two things happens, depending on **Score final after
  deadline**:
  - **No** (the usual setting): the score is capped by how late it is. One
    month late: at most **2.9**. Two months late: at most **2.4**. Three or more
    months late: **0**. A score already below the cap stays as it is.
  - **Yes:** the score is frozen at what it was in the deadline month. With no
    figure by then, it's 0.

For example, a KPI with the deadline June 2026 that scores 3.9 in August
(two months late) shows **2.4**.

### B.8 Adding scores up

**Weights.** Each KPI's **weight** is its share of its brothers and sisters
(the KPIs with the same parent). They should add up to 100 in each group; if
they don't, they're used in proportion. Its **global weight** is its share of
the whole company: its parent's global weight × its weight ÷ the group's total.
In the sample, Goal 1 is 60% of the company, 1.1 is 40% of Goal 1 (24% of the
company), and 1.1.1 is 70% of 1.1 (16.8% of the company).

**A parent's score** is the weighted average of its children's scores, leaving
out any child with no score. The children's exact (unrounded) scores are used,
and only the result is rounded.

- 1.1 = (3.4 × 70 + 4.5 × 30) ÷ 100 = 3.73, shown as **3.7**.
- Goal 1 = (3.73 × 40 + 2.9 × 30 + 3.7 × 30) ÷ 100 = 3.472, shown as **3.5**.
- Goal 2: 2.1 and 2.2 both score 3.4; 2.3 is not yet due and 2.4 has no data,
  so both are left out. Goal 2 = **3.4**.

A branch that is only partly reported only counts with that part of its
weight. Goal 2 has scores for half its weight, so it counts with 20 of its 40
in the company total:

- Total = (3.472 × 60 + 3.4 × 20) ÷ (60 + 20) = 3.454, shown as **3.5 (Good)**.

This works out the same as a weighted average of every scored KPI at the
bottom of the tree, using their global weights.

**Coverage** is how much of the weight that is due has a score:

> coverage = scored weight ÷ (total weight − not-yet-due weight)

The total's coverage is 80 ÷ (100 − 10) = **88.9%**. (2.3, weight 10, is not
yet due.) Goal 2's is 50 ÷ (100 − 25) = 66.7%.

**Score overrides.** An admin can replace one KPI's score for one month with
a score of their own, with a reason. It replaces the calculated score
everywhere, including in every average above it. Only KPIs at the bottom of
the tree (with no children) can be overridden.

**The Dashboard options** change how missing figures and estimates count.
They're applied to the bottom-level KPIs before adding up.

| Option | Choice | What it does |
| --- | --- | --- |
| Missing figures | **Excluded** (normal) | KPIs with no score are left out, as above. |
| | **Assume Meet, decaying** | A KPI with no score is given 3.4 if it's not late, 2.9 if one month late, 2.4 if two months late, and 0 if three or more months late. For a monthly KPI, "late" counts from its last figure (or the start of the year); for quarterly and annual KPIs, from the last month it was due. A KPI with a deadline counts from the deadline. A milestone that's not yet due gets 3.4. These scores are marked "assumed". |
| | **Score as 0** | Every KPI with no score, including ones not yet due, scores 0. |
| Estimates | **Count at face value** (normal) | Estimates count like actual figures (marked "est"). |
| | **Exclude** | Estimates are ignored, as if they'd never been entered. |
| | **Score as 0** | A score that comes from an estimate becomes 0. |

### B.9 The rulebook, ready to copy

Copy the whole grey box below. In 8.2 you paste it into Word and upload it
as the agent's knowledge.

```text
KPI SCORECARD RULEBOOK

The scorecard's scoring rules. Use them to explain why a KPI scored what it did.
Always show the arithmetic with the KPI's own figure and targets.

YEAR AND MONTHS
- The fiscal year runs 1 April to 31 March. "FY2026/27" starts on 1 April 2026.
- A month is written YYYY-MM. April is month 1 of the fiscal year, September month 6, March month 12.
- Dates are shown as dd/mm/yyyy, months by name ("September 2026"), weights to 2 decimal places,
  scores to 1 decimal place.

THE SCALE AND THE BANDS
- Every score is 0.0 to 5.0, rounded to 1 decimal place at the end (halves go up). Below 0 counts as 0, above 5 as 5.
- Poor 0.0-2.4 | Improvement needed 2.5-2.9 | Meet 3.0-3.4 | Good 3.5-3.9 | Very good 4.0-4.5 | Excellent 4.6-5.0.

THE TREE AND WEIGHTS
- Up to 5 levels: Strategic Goal > KPI > sub-KPI > sub-sub-KPI > sub-sub-sub-KPI.
- Only KPIs with no children have figures and targets. The others are averages of their children.
- Weight = a KPI's share of the KPIs with the same parent. Each group should add up to 100; if not, the weights
  are used in proportion (a warning, not an error).
- Global weight = the parent's global weight x the KPI's weight / the group's total weight. For Strategic Goals:
  the goal's weight / all goals' weights x 100. It is the KPI's share of the whole company.

KINDS OF KPI
- Metric types: Percentage, Dollar, Quantity, Days, Variance (all scored with targets) and Month completion (a milestone).
- Direction: Higher is better, or Lower is better.
- Target mode: Fixed (one number per band) or Range (a window per band). Milestones have neither.

FIXED TARGETS
- Find the best band whose target the figure reaches. The score is the TOP of that band:
  Poor 2.4, Improvement needed 2.9, Meet 3.4, Good 3.9, Very good 4.5, Excellent 5.0.
- "Reaches" means at or above the target when higher is better, at or below it when lower is better.
- Short of the Poor target, higher is better: 2.4 x figure / Poor target (no less than 0).
  If the Poor target is 0 or less: 2.4 if the figure reaches it, otherwise 0.
- Short of the Poor target, lower is better: 2.4 x Poor target / figure.
  If the figure is 0 or less: 2.4. If the Poor target is below 0: 0.
- Example: targets 60/70/80/90/95/100 (Poor to Excellent), figure 85: reaches Meet (80), not Good (90), so 3.4.

RANGE TARGETS
- Each band has a window [lowest, highest]. When higher is better the windows run Poor (smallest figures) to
  Excellent; when lower is better, Excellent (smallest figures) to Poor.
- The window with the smallest figures also takes every figure below it; the window with the largest figures
  also takes every figure above it.
- A figure on the shared edge of two windows counts in the window with the smaller figures.
- Inside a window: position = (figure - lowest) / (highest - lowest).
  Higher is better: score = band bottom + position x (band top - band bottom).
  Lower is better:  score = band top - position x (band top - band bottom).
  If lowest equals highest: the band top.
- A figure in a gap between two windows (in no window at all): 5.0 when higher is better, 0 when lower is
  better, whichever side of the gap it is on. This is a known quirk shared with the web app.
- Example: Good window 80-89, figure 84: position 4/9 = 0.44, score 3.5 + 0.44 x 0.4 = 3.68, shown 3.7.

VARIANCE
- Each month has a figure and a planned value. Variance = |figure - planned| / planned x 100.
- The variance is scored with the KPI's own targets (usually lower is better).
- No planned value, or a planned value of 0: no score (no data).
- Example: 1,060,000 against a plan of 1,000,000 is a variance of 6.

MILESTONES (Month completion)
- The KPI has a target month (the Meet month). Its "figure" is the completion date.
- Months early or late = months from the target month to the completion month.
  More than 3 early: 5.0.
  3 early: Excellent (5.0-4.6). 2 early: Very good (4.5-4.0). 1 early: Good (3.9-3.5).
  In the target month: Meet (3.4-3.0). 1 late: Improvement needed (2.9-2.5).
  Within the month: position = (day - 1) / (days in month - 1); score = band top - position x (band top - band bottom).
  Example, target October 2026: 1 October = 3.4, 15 October = 3.2, 31 October = 3.0.
- 2 or more late: Poor, falling in a straight line from 2.4 on the 1st of the month two months after the target
  to 0 on 31 March (the end of the target month's fiscal year).
- Use the earliest completion date entered in or before the month being looked at.
- No completion date, up to and including the target month: not yet due (no score, left out).
- No completion date, after the target month: scored as if completed on the last day of the month being looked at.
- Phasing and deadlines never apply to milestones.

WHICH FIGURE IS USED (all other KPIs, for the month being looked at)
- Figures are year-to-date.
- If the KPI is Completed, from its completed month onwards: its latest actual figure in or before the completed
  month, frozen. (If there is none, carry on below.)
- Otherwise: the month's actual figure; else the month's estimate; else the latest earlier estimate.
  An older actual is NOT carried forward.
- Nothing found: "not yet due" if the KPI is quarterly or annual and the month is not one it is due in;
  otherwise "no data". Both have no score and are left out of averages.
- A score from an estimate is provisional ("est"). Estimates and actuals are scored the same way.

FREQUENCY
- Monthly: due every month. Quarterly: due in June, September, December and March. Annual: due in March.

PHASING (fixed and range targets only)
- None: the full targets. Even: month number / 12 of the targets.
  Custom: the first (month number) of the KPI's 12 monthly shares added together, / 100 (April first; shares total 100).
- Every band target, and both ends of every range window, is multiplied by that fraction.
- A score against reduced targets is "pro-rated".
- Example: even phasing, September (month 6): targets 60/80/120/150/170/200 become 30/40/60/75/85/100.
  A figure of 55 reaches Improvement needed (40), not Meet (60): 2.9, pro-rated.

DEADLINES (not milestones)
- A KPI may have a deadline month. Months late = months from the deadline month to the month being looked at (never below 0).
- Not late: the score stands.
- Late, "Score final after deadline" = No (usual): the score is capped. 1 month late: at most 2.9.
  2 months late: at most 2.4. 3 or more: 0. A lower score is left as it is.
- Late, "Score final after deadline" = Yes: the score is frozen at its deadline-month score (0 if there was no figure by then).

SCORE OVERRIDES
- An admin can set a KPI's score for one month (0 to 5, with a reason). It replaces the calculated score,
  including in every average above it. Only KPIs with no children can be overridden.

ADDING UP (every parent, and the company total)
- A parent's score = the weighted average of its children's scores, leaving out children with no score.
- Use the children's exact (unrounded) scores; round only the result.
- A child that is only partly scored counts with only that part of its weight. This makes every parent's score
  equal to the global-weighted average of the scored KPIs beneath it.
- Missing figures are LEFT OUT, not counted as 0 (unless the Dashboard options say otherwise).
- Coverage = scored weight / (total weight - not-yet-due weight).
- Provisional share, not-yet-due share and pro-rated share = that weight / total weight.

DASHBOARD OPTIONS (applied to the bottom-level KPIs before adding up)
- Missing figures:
  "Excluded" (normal): left out.
  "Assume Meet, decaying": a KPI with no score gets 3.4 if not late, 2.9 if 1 month late, 2.4 if 2, 0 if 3 or more,
    marked "assumed". Months late: from its deadline month if it has one; otherwise, monthly KPIs from their
    latest figure (or the start of the year); quarterly and annual KPIs from their latest due month, if nothing
    has been reported since. A milestone that is not yet due gets 3.4.
  "Score as 0": every KPI with no score, including not-yet-due ones, scores 0.
- Estimates:
  "Count at face value" (normal): estimates count like actuals.
  "Exclude": estimates are ignored, as if never entered.
  "Score as 0": a score from an estimate becomes 0 (and is no longer provisional).
```

---

## Appendix C. Sample data for testing

This is a small, made-up scorecard: two goals, nine KPIs and twelve monthly
figures. It's small enough to type in by hand in about half an hour, yet it
uses every kind of KPI and every scoring rule: fixed and range targets, lower
is better, a variance, a milestone, even phasing, quarterly reporting, an
estimate and a missing figure.

Every "Check it worked" in this guide compares against the results below, so
type the figures **exactly** as shown. Part 12 removes this sample before
your real data goes in.

**How to type rows in** (from 3.9): open the table in
[make.powerapps.com](https://make.powerapps.com) (**Tables →** the table),
click **Edit** at the top, then **+ New row**. Enter the tables in the order
of the sections below: each one looks up rows from the one before.

### C.1 The fiscal year, departments, people and KPIs

> **Do this:**
>
> 1. **Fiscal year** table, one row:
>
>    | Label | Start year | Is active |
>    | --- | --- | --- |
>    | `FY2026/27` | `2026` | Yes |
>
> 2. **Department** table, two rows: `Finance` and `Sales`, both with **Is active** set to Yes.
> 3. **App user** table, two rows:
>
>    | Username | Email | Company ID number | Department | Role | Status |
>    | --- | --- | --- | --- | --- | --- |
>    | your name, such as `aisha` | **your own** Microsoft sign-in address | `A0001` | Finance | Admin | Approved |
>    | `sales.test` | a colleague's sign-in address, or a made-up one such as `sales.test@example.com` | `S0001` | Sales | Member | Approved |
>
>    Your own row must use exactly the address you sign in with, or the flows won't recognise you. A made-up address is fine for the second row until Part 14, which needs a real second person (or a second test account) to sign in as the Sales Member.
>
> 4. **KPI** table, eleven rows, **top to bottom** (a KPI's parent must exist before the KPI). For every row, set **Fiscal year** to `FY2026/27`. Leave **Level**, **Path**, **Sort key**, **Global weight** and **Is leaf** empty: flow S4 (5.9) fills them in. Copy each **Target config** exactly, including the quotes and brackets: the easiest way is to copy it from this page and paste it.

| Code | Name | Parent | Sort order | Weight | Metric type | Direction | Target mode | Frequency | Phasing | Target config |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Grow the business | (none) | 1 | 60 |  |  |  | Monthly | None |  |
| 1.1 | Revenue | 1 | 1 | 40 |  |  |  | Monthly | None |  |
| 1.1.1 | Revenue growth | 1.1 | 1 | 70 | Percentage | Higher is better | Fixed | Monthly | None | `{"POOR":60,"IMPROVEMENT_NEEDED":70,"MEET":80,"GOOD":90,"VERY_GOOD":95,"EXCELLENT":100}` |
| 1.1.2 | Recurring revenue share | 1.1 | 2 | 30 | Percentage | Higher is better | Fixed | Monthly | None | `{"POOR":60,"IMPROVEMENT_NEEDED":70,"MEET":80,"GOOD":90,"VERY_GOOD":95,"EXCELLENT":100}` |
| 1.2 | New customers | 1 | 2 | 30 | Quantity | Higher is better | Fixed | Monthly | Even | `{"POOR":60,"IMPROVEMENT_NEEDED":80,"MEET":120,"GOOD":150,"VERY_GOOD":170,"EXCELLENT":200}` |
| 1.3 | Customer satisfaction | 1 | 3 | 30 | Percentage | Higher is better | Range | Quarterly | None | `{"POOR":[0,59],"IMPROVEMENT_NEEDED":[60,69],"MEET":[70,79],"GOOD":[80,89],"VERY_GOOD":[90,94],"EXCELLENT":[95,100]}` |
| 2 | Run efficiently | (none) | 2 | 40 |  |  |  | Monthly | None |  |
| 2.1 | Days to close the books | 2 | 1 | 25 | Days | Lower is better | Fixed | Monthly | None | `{"POOR":10,"IMPROVEMENT_NEEDED":8,"MEET":6,"GOOD":4,"VERY_GOOD":3,"EXCELLENT":2}` |
| 2.2 | Spending against budget | 2 | 2 | 25 | Variance | Lower is better | Fixed | Monthly | None | `{"POOR":20,"IMPROVEMENT_NEEDED":15,"MEET":10,"GOOD":5,"VERY_GOOD":3,"EXCELLENT":1}` |
| 2.3 | New finance system live | 2 | 3 | 25 | Month completion |  |  | Monthly | None | `{"targetMonth":"2026-10"}` |
| 2.4 | Policies reviewed | 2 | 4 | 25 | Quantity | Higher is better | Fixed | Quarterly | None | `{"POOR":2,"IMPROVEMENT_NEEDED":4,"MEET":6,"GOOD":8,"VERY_GOOD":9,"EXCELLENT":10}` |

> 5. Fill in these extra columns on the same rows. Leave every other column (Deadline month, Completed and so on) at its default.
>
>    | Code | Unit | Why it's in the sample |
>    | --- | --- | --- |
>    | 1.1.1 | `%` | A plain fixed target: the most common kind |
>    | 1.1.2 | `%` | A fixed target that reaches Very good |
>    | 1.2 | (empty) | **Even** phasing: in September its targets are halved, so its score is pro-rated |
>    | 1.3 | `%` | A **range** target, reported **quarterly**, with an estimate in September |
>    | 2.1 | `days` | **Lower is better** |
>    | 2.2 | `BND` | A **variance**. It uses fixed targets on purpose, to show a variance can use either target mode |
>    | 2.3 | (empty) | A **milestone** due in October 2026, so it is not yet due in September |
>    | 2.4 | (empty) | **Quarterly**, with nothing reported in September, so it has no data |
>
> 6. **Owning departments.** Sales owns the KPIs that start with 1 (1, 1.1, 1.1.1, 1.1.2, 1.2 and 1.3). Finance owns the ones that start with 2 (2, 2.1, 2.2, 2.3 and 2.4). For each KPI:
>    1. In the KPI table's **Edit** view, tick the row and click **Edit row using form** (in the toolbar, or under **...**).
>    2. Open the **Related** tab and pick **Departments**.
>    3. Click **Add Existing Department**, choose the department, and click **Add**.
>
> **Check it worked:**
>
> - The KPI table has 11 rows for FY2026/27.
> - The Department table has 2 rows and the App user table 2.
> - KPI 2.1's form, **Related → Departments**, lists only **Finance**.

### C.2 The monthly figures

> **Do this:** add these twelve rows to the **KPI value** table. For every row:
>
> - set **Fiscal year** to `FY2026/27`;
> - set **Name** to the code and the period, such as `1.1.1 2026-07`;
> - set **KPI** to the KPI with that code.
>
> Type each **Value** without commas (`1060000`, not `1,060,000`). Leave **Planned value**, **Completion date** and **Note** empty unless a value is shown.

| KPI | Period | Value | Basis | Planned value | Completion date |
| --- | --- | --- | --- | --- | --- |
| 1.1.1 | 2026-07 | 78 | Actual |  |  |
| 1.1.1 | 2026-08 | 82 | Actual |  |  |
| 1.1.1 | 2026-09 | 85 | Actual |  |  |
| 1.1.2 | 2026-09 | 96 | Actual |  |  |
| 1.2 | 2026-09 | 55 | Actual |  |  |
| 1.3 | 2026-06 | 82 | Actual |  |  |
| 1.3 | 2026-09 | 84 | Estimate |  |  |
| 2.1 | 2026-08 | 7 | Actual |  |  |
| 2.1 | 2026-09 | 5 | Actual |  |  |
| 2.2 | 2026-09 | 1060000 | Actual | 1000000 |  |
| 2.4 | 2026-06 | 3 | Actual |  |  |

> **Check it worked:** 12 rows. There is no row for 1.3 in July and August, for 2.3 at all, or for 2.4 in September: these gaps are deliberate.

**Why these figures:** the September figures produce one KPI in almost every
band, and the earlier months test the rules about which figure is used
(Appendix B, section B.6). For example, 2.4's June figure is **not** carried
forward to September, and 1.3's September estimate is used because there's no
actual figure.

### C.3 What flow S4 should fill in

You don't type these. Once flow S4 has run (5.9), the KPI table should have
these values. The **Sort key** lists the tree in order: sort by it to see each
goal followed by its KPIs.

| Code | Level | Global weight | Is leaf | Sort key |
| --- | --- | --- | --- | --- |
| 1 | 1 | 60.0000 | No | `000001-000001/` |
| 1.1 | 2 | 24.0000 | No | `000001-000001/000001-000001.000001/` |
| 1.1.1 | 3 | 16.8000 | Yes | `000001-000001/000001-000001.000001/000001-000001.000001.000001/` |
| 1.1.2 | 3 | 7.2000 | Yes | `000001-000001/000001-000001.000001/000002-000001.000001.000002/` |
| 1.2 | 2 | 18.0000 | Yes | `000001-000001/000002-000001.000002/` |
| 1.3 | 2 | 18.0000 | Yes | `000001-000001/000003-000001.000003/` |
| 2 | 1 | 40.0000 | No | `000002-000002/` |
| 2.1 | 2 | 10.0000 | Yes | `000002-000002/000001-000002.000001/` |
| 2.2 | 2 | 10.0000 | Yes | `000002-000002/000002-000002.000002/` |
| 2.3 | 2 | 10.0000 | Yes | `000002-000002/000003-000002.000003/` |
| 2.4 | 2 | 10.0000 | Yes | `000002-000002/000004-000002.000004/` |

**How to read it:** goal 1 has weight 60 out of 60 + 40, so its global weight
is 60. KPI 1.1 has weight 40 out of 1.1 + 1.2 + 1.3 = 100, so its global weight
is 60 × 40 ÷ 100 = 24. KPI 1.1.1 is 24 × 70 ÷ 100 = 16.8. The global weights of
all the KPIs at the bottom of the tree add up to 100.

### C.4 The scores for September 2026

With the normal Dashboard options (missing figures **Excluded**, estimates
**Count at face value**), the scores for **2026-09** are as follows. In the
**KPI score** table these are the rows with **Period** `2026-09` and
**Scenario** `standard`, sorted by **Sort key**.

| Code | Name | Score | Band | Pending reason | Provisional | Prorated | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Grow the business | 3.5 | Good |  | Yes | Yes | 100.0% |
| 1.1 | Revenue | 3.7 | Good |  | No | No | 100.0% |
| 1.1.1 | Revenue growth | 3.4 | Meet |  | No | No | 100.0% |
| 1.1.2 | Recurring revenue share | 4.5 | Very good |  | No | No | 100.0% |
| 1.2 | New customers | 2.9 | Improvement needed |  | No | Yes | 100.0% |
| 1.3 | Customer satisfaction | 3.7 | Good |  | Yes | No | 100.0% |
| 2 | Run efficiently | 3.4 | Meet |  | No | No | 66.7% |
| 2.1 | Days to close the books | 3.4 | Meet |  | No | No | 100.0% |
| 2.2 | Spending against budget | 3.4 | Meet |  | No | No | 100.0% |
| 2.3 | New finance system live | (empty) | (empty) | Not yet due | No | No | 0.0% |
| 2.4 | Policies reviewed | (empty) | (empty) | No data | No | No | 0.0% |

**Where each score comes from** (the rules are in Appendix B):

| Code | Working |
| --- | --- |
| 1.1.1 | 85 reaches Meet (80) but not Good (90): top of Meet, **3.4** |
| 1.1.2 | 96 reaches Very good (95) but not Excellent (100): **4.5** |
| 1.1 | (3.4 × 70 + 4.5 × 30) ÷ 100 = 3.73: **3.7** |
| 1.2 | Even phasing, September is month 6, so the targets are halved: Meet becomes 60 and Improvement needed 40. 55 reaches 40: **2.9**, pro-rated |
| 1.3 | The September estimate, 84, is in the Good window 80–89, 0.44 of the way through: 3.5 + 0.44 × 0.4 = **3.7**, provisional |
| 1 | (3.73 × 40 + 2.9 × 30 + 3.7 × 30) ÷ 100 = 3.472: **3.5** |
| 2.1 | Lower is better: 5 is at or below Meet (6) but above Good (4): **3.4** |
| 2.2 | Variance: (1,060,000 − 1,000,000) ÷ 1,000,000 × 100 = 6, at or below Meet (10) but above Good (5): **3.4** |
| 2.3 | No completion date, and September is before the target month (October): not yet due |
| 2.4 | Quarterly and due in September, but no September figure: no data |
| 2 | Only 2.1 and 2.2 have scores: (3.4 × 25 + 3.4 × 25) ÷ 50 = **3.4**. Coverage 50 ÷ (100 − 25) = 66.7% |

### C.5 The total score for September 2026

The **Total score** table should have these rows for **2026-09**. The
`standard` row is the normal view. The `count|zero` row appears once someone
picks "Score as 0" for missing figures (or once you've run the test in 5.11).

| Scenario | Score | Band | Coverage | Provisional share | Not yet due share | Prorated share | Leaf count | Scored leaf count |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `standard` | 3.5 | Good | 88.9% | 18.0% | 10.0% | 18.0% | 8 | 6 |
| `count|zero` | 2.8 | Improvement needed | 100.0% | 18.0% | 0.0% | 18.0% | 8 | 8 |

**Where the total comes from:** goal 1 (3.472) counts with its full weight of
60. Goal 2 (3.4) only has scores for half of its weight, so it counts with 20 of
its 40. (3.472 × 60 + 3.4 × 20) ÷ 80 = 3.454, shown as **3.5 (Good)**. The
coverage is 80 ÷ (100 − 10) = **88.9%**, because 2.3 (global weight 10) isn't
due yet and 2.4 (10) has no figure.

### C.6 Other results used in this guide

| Test | Where | Expected |
| --- | --- | --- |
| Missing figures **Assume Meet, decaying**, estimates at face value | 14.3 | Total **3.4 Meet**, coverage 100%. 2.3 and 2.4 both get **3.4** (assumed) |
| Missing figures **Score as 0**, estimates at face value | 5.11, 14.3 | Total **2.8 Improvement needed**. Goal 2 drops to **1.7** |
| Missing figures excluded, estimates **Exclude** | 14.3 | Total **3.4 Meet**, coverage 68.9%. 1.3 has no score |
| Missing figures **Assume Meet, decaying**, estimates **Exclude** | 14.3 | Total **3.4** |
| Missing figures **Score as 0**, estimates **Exclude** | 14.3 | Total **2.1 Poor** |
| Missing figures excluded, estimates **Score as 0** | 14.3 | Total **2.6 Improvement needed**. 1.3 scores **0** |
| Missing figures **Assume Meet, decaying**, estimates **Score as 0** | 14.3 | Total **2.8** |
| Both **Score as 0** | 14.3 | Total **2.1 Poor** |
| August 2026, normal options | 14.2 | 1.1.1 scores **3.4** from its August figure, 82 |
| 1.1.1's September figure changed to **95** (for real, or in Simulate) | 5.13, 6.13, 14.4, 14.5 | 1.1.1 **4.5**, goal 1 **3.8**, total **3.7** |
| An override of 1.2's September score to **3.4** | 6.9, 7.6 | Goal 1 **3.6**, total **3.6**. Clearing the override puts both back to **3.5** |
