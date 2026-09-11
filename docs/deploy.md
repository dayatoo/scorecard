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
2. Find **Connection string**. You need two of them:
   - **Transaction pooler** — the one on port `6543`. This is `DATABASE_URL`.
   - **Direct connection** — the one on port `5432`. This is `DIRECT_URL`.
3. Copy each into a scratch file and replace `[YOUR-PASSWORD]` with the
   password you saved in step 1.

The pooler string usually ends in `?pgbouncer=true`. Keep that on the end.

## 3. Choose your two secrets

You need two more values. Make them up now and keep them with the connection
strings.

- **`APP_PASSWORD`** — the shared password everyone will type to open the app.
  Choose something long that you are happy to share with your team.
- **`SESSION_SECRET`** — a long random string the app uses to sign the "you are
  signed in" cookie. Nobody ever types this. Any 40+ random characters will do;
  mash the keyboard or use a password generator.

Keep `SESSION_SECRET` private. Changing it later simply signs everyone out.

## 4. Deploy the app

1. Push this repository to your own GitHub account, if it is not there already.
2. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
3. Click **Add New → Project**, and pick this repository.
4. Before clicking Deploy, open **Environment Variables** and add all four:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the port-`6543` pooler string from step 2 |
   | `DIRECT_URL` | the port-`5432` direct string from step 2 |
   | `APP_PASSWORD` | your shared password from step 3 |
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

Vercel shows you a URL like `https://kpi-scorecard-xxxx.vercel.app`. Open it,
enter your `APP_PASSWORD`, and you are in.

Share that URL and the password with whoever needs it. Anyone with both can
view and edit everything.

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

**"SESSION_SECRET is not set" or "APP_PASSWORD is not set"** — the variable is
missing in Vercel. Add it under Settings → Environment Variables, then
redeploy.

**The password is not accepted** — check `APP_PASSWORD` in Vercel for stray
spaces or quote marks, then redeploy.

**Pages error with a database message** — the connection strings are wrong, or
you have not run `npx prisma migrate deploy`. Check that `DATABASE_URL` uses
port 6543 and `DIRECT_URL` uses 5432, and that both have the real password in
place of `[YOUR-PASSWORD]`.

**Everyone was signed out** — `SESSION_SECRET` changed. Signing in again is all
that is needed.

**A Supabase project on the free tier pauses after a period of inactivity.**
Open the Supabase dashboard and resume it.

## Keeping it safe

- The URL plus the password is all anyone needs, so share them deliberately.
- Change `APP_PASSWORD` in Vercel whenever someone leaves; redeploy after.
- Supabase takes daily backups on the free tier. You can also press **Export to
  Excel** any time for a copy you can keep yourself.
