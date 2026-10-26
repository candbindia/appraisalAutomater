# C&B Employee Performance Management

Monthly appraisals for Consulting & Beyond. Next.js (App Router, TypeScript), Tailwind, Recharts.
Runs serverless on Vercel; data lives in Google Sheets (server-side only). Without credentials it runs on built-in sample data.

## Who uses what

| Who | Where | What they do |
| --- | --- | --- |
| **HR** | App | Sets parameters every cycle (edit any time — every change is logged), assigns projects, deducts HR points with a reason, tracks who has finished and reminds defaulters, opens any appraisal |
| **MD** | App | Overview, any appraisal, approves appraisals once every item has a valid score |
| Employees, Admin, PC, Reporting Managers | Google Sheet | Type their points into the `points` column of the `Scores YYYY-MM` tab (their rows are marked in `scoredBy`) |

HR items need nothing in the sheet: a blank HR row counts as **full marks**. HR deducts in the app.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 — sample data until .env.local is filled in
```

The **Viewing as (demo)** switcher (HR or MD) is **not** authentication — add Google sign-in before using real data.

## Monthly flow

1. **Cycles & Parameters → New cycle** copies last month's parameters into `Params YYYY-MM`.
2. HR reviews each department × designation: item text, section, everyone vs. a specific project/client,
   **who scores it** and **min/max points**.
3. **Open cycle** creates every employee's rows in `Scores YYYY-MM`. Projects carry over from last month.
4. People fill their points in the sheet. The **Tracker** shows who has completed their self-assessment,
   who is overdue, entries that aren't valid numbers, and Admin/PC/Manager scores still pending — with
   **Send email** (Resend) and **Open in my email** reminders.
5. HR can change parameters while the cycle is open: new items get rows, removed items are marked `removed`,
   points already entered are kept.
6. When every item has a valid score the appraisal is **Ready for approval**; the MD approves and the score is
   snapshotted (later sheet edits are flagged but don't change it).

Total = points earned ÷ maximum points. A blank (non-HR) or invalid entry keeps the total *pending* — never zero.

## Change log

Every change made in the app is appended to the **`ChangeLog`** tab: parameter changes (field, before, after),
HR deductions and their reasons, project changes, reminders, cycle changes and approvals.
View and filter it on the **Change Log** page, or download it as CSV.

## Google Sheets setup

1. Google Cloud: create a project, enable the **Google Sheets API**, create a **service account**, add a JSON key.
2. Share your Google Sheet with the service account email as **Editor**.
3. Copy `.env.example` to `.env.local` and fill in `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
4. `npm run sheets:setup` creates Employees, Cycles, Appraisals, ChangeLog. (`-- --seed` also loads the sample data.)
5. Fill the Employees tab (`role` = `employee`, `hr`, `admin`, `pc` or `md`; department/designation spelled as in the parameters).
6. In the app, as HR: Cycles & Parameters → New cycle → copy from the Appraisal.xlsx template.
7. On Vercel, add the same variables (plus `RESEND_API_KEY` / `NOTIFY_FROM` for emails).

**Privacy note:** everyone who fills the sheet can see the whole `Scores` tab, including other people's points.
If that's a concern, the next step is per-person sheets or employee logins.

## Where things are

| Path | What |
| --- | --- |
| `src/lib/model.ts` | Rules: which items apply, reading sheet entries, totals, status |
| `src/lib/repo.ts` | Reads, permissions, every action, sheet sync, change log |
| `src/lib/notify.ts` | Reminder emails (Resend) and mailto drafts |
| `src/app/tracker` | HR tracker and reminders |
| `src/app/admin/cycles` | Cycle setup and parameter editor |
| `src/app/appraisals/[id]` | Any employee's appraisal, HR deductions, MD approval |
| `src/app/changelog` | Change log + CSV |
