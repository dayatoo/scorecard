# Putting the scorecard on the web

A walkthrough for getting this running at a URL your colleagues can open. No
coding. Budget about half an hour the first time.

You will create two free accounts:

- **Supabase** holds the database — the KPIs and every figure entered.
- **Vercel** runs the app itself.

---

## 1. Create the database

1. Go to [supabase.com](https://supabase.com) and sign up.
2. Click **New project**.
   - **Name**: anything, e.g. `kpi-scorecard`.
   - **Database Password**: click *Generate a password* and **save it
     somewhere safe** — you cannot see it again, and you need it in step 3.
   - **Region**: pick the one closest to your office.
3. Click **Create new project** and wait a couple of minutes while it builds.

## 2. Copy the two connection strings

1. In your Supabase project, open **Project Settings** (the cog) → **Database**.
2. Find **Connection string**. There's a selector near the top with three
   options — you need two of them, and it is easy to pick the wrong one:
   - **Transaction pooler** — the one on port `6543`. This is `DATABASE_URL`.
   - **Session pooler** — the one on port `5432`. This is `DIRECT_URL`.

   Do **not** use the option literally labelled **"Direct connection"**
   (`db.<your-project>.supabase.co:5432`). It looks like the obvious choice
   for `DIRECT_URL`, but that host only accepts IPv6 connections, and most
   home and office networks can't reach it — you'll get `P1001: Can't reach
   database server` when you try to run migrations in step 5. **Session
   pooler** is the IPv4-friendly equivalent and works the same way for our
   purposes.
3. Copy each into a scratch file and replace `[YOUR-PASSWORD]` with the
   password you saved in step 1.
4. To the **transaction pooler** string only (the one for `DATABASE_URL`), add
   `?pgbouncer=true` at the very end — Supabase's own copy-paste string does
   **not** include this; you have to type it on yourself. Without it, the
   running app will intermittently fail with errors like `prepared statement
   "s0" already exists`, because Prisma expects to reuse one connection for a
   prepared statement and the transaction pooler hands out a different one
   per query. This flag tells Prisma to send plain queries instead. The
   session pooler string (`DIRECT_URL`) does not need it.

Both pooler strings share the same host (something like
`aws-0-<region>.pooler.supabase.com`) and differ only in port.

## 3. Choose your session secret

You need one more value, kept with the connection strings.

- **`SESSION_SECRET`** — a long random string the app uses to sign the "you are
  signed in" cookie. Nobody ever types this. Any 40+ random characters will do;
  mash the keyboard or use a password generator.

Keep it private. Changing it later simply signs everyone out. There's no
shared app password to set up — everyone registers their own account once
the app is live (see step 6).

## 4. Deploy the app

1. Push this repository to your own GitHub account, if it is not there already.
2. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
3. Click **Add New → Project**, and pick this repository.
4. Before clicking Deploy, open **Environment Variables** and add all three:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the port-`6543` transaction pooler string from step 2 |
   | `DIRECT_URL` | the port-`5432` session pooler string from step 2 |
   | `SESSION_SECRET` | your long random string from step 3 |

5. Click **Deploy** and wait for it to finish.

If a variable is wrong you can fix it later under **Settings → Environment
Variables**, but you must then **Redeploy** for the change to take effect.

## 5. Create the tables

The database is still empty. From your own computer, in a terminal, in this
project's folder:

```bash
npm install
cp .env.example .env
```

Open the new `.env` file in a text editor and paste in the same four values you
gave Vercel. Then:

```bash
npx prisma migrate deploy
```

That creates the tables. You only ever do this again when the app's data model
changes.

Optionally, load a small sample scorecard so there is something to look at:

```bash
npm run seed
```

## 6. Open it

Vercel shows you a URL like `https://kpi-scorecard-xxxx.vercel.app`. Open
`<that URL>/register` and create the first account — it's automatically
approved and made an admin, since there's nobody else yet to approve it.

Share the URL with everyone else and have them register too. Their accounts
sit **pending** until you (the admin) approve them from **Manage → Users** —
that's the gate that stops a stranger with the URL from getting in on their
own.

---

## Getting your own KPIs in

1. Go to **Manage** and create a fiscal year (e.g. starting year `2026` for
   April 2026 – March 2027). Make it the active one.
2. Add your departments on the same page.
3. Go to **Import**, download the blank template, and fill it in — one row per
   KPI, with a parent's `Code` in each child's `Parent Code`. The workbook's
   Readme sheet explains each column.
4. Upload it. The app checks it and shows you what it will do before anything
   is written.

## Each month

Go to **Enter Data**, pick the month, and fill in the year-to-date figure for
each KPI. Mark anything not yet final as an *estimate*. Press **Save** and
confirm.

## Next year

On **Manage**, create the new fiscal year and choose to copy the KPIs from the
current one. You get the same hierarchy and weights with no figures, ready to
adjust the targets.

---

## If something goes wrong

**"SESSION_SECRET is not set"** — the variable is missing in Vercel. Add it
under Settings → Environment Variables, then redeploy.

**"Your account is pending admin approval"** — expected for everyone but the
first account. Have an admin approve it from **Manage → Users**.

**Pages error with a database message, e.g. "table does not exist"** — the
connection strings are wrong, or you have not run `npx prisma migrate deploy`
(step 5). Check that `DATABASE_URL` uses port 6543 and `DIRECT_URL` uses 5432,
and that both have the real password in place of `[YOUR-PASSWORD]`.

**`P1001: Can't reach database server at db.<project>.supabase.co:5432`** when
running `npx prisma migrate deploy` — `DIRECT_URL` is set to the option
literally labelled "Direct connection" on Supabase's page, which needs IPv6.
Go back to step 2 and use the **Session pooler** string instead (same port,
`5432`, but a different, IPv4-friendly host).

**`prepared statement "sN" already exists`** (any number in place of N),
usually right after the app has been running for a bit — `DATABASE_URL` in
Vercel is missing `?pgbouncer=true` on the end. Add it (see step 2) and
redeploy. This only affects the deployed app's `DATABASE_URL`; your local
`.env` doesn't need it for running migrations.

**Everyone was signed out** — `SESSION_SECRET` changed. Signing in again is all
that is needed.

**A Supabase project on the free tier pauses after a period of inactivity.**
Open the Supabase dashboard and resume it.

## Keeping it safe

- New registrations need an admin to approve them — check **Manage → Users**
  after telling someone the URL.
- Remove someone's account from **Manage → Users** when they leave; there
  must always be at least one admin, so promote a second person before
  removing the first.
- Supabase takes daily backups on the free tier. You can also press **Export to
  Excel** any time for a copy you can keep yourself.
