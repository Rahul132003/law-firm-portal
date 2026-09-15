# Legal Case Management Portal

Internal case management for firm staff. There is deliberately **no
client-facing portal** — every account belongs to someone at the firm.

Branding comes from `NEXT_PUBLIC_FIRM_NAME`; change it in `.env` rather than
editing components.

## Stack

| Concern     | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Framework   | Next.js 16.3 (App Router, Turbopack) + React 19.2             |
| Language    | TypeScript 5, strict                                          |
| Database    | PostgreSQL via Prisma 7 (`prisma-client` generator)           |
| Auth        | NextAuth v5 (Auth.js), credentials provider, JWT sessions     |
| Files       | Vercel Blob                                                   |
| Styling     | Tailwind CSS v4 (light theme only — see `globals.css`)        |
| Charts      | Recharts                                                      |
| PDF export  | jsPDF + jspdf-autotable                                       |

### Notes on this Next.js / Prisma version

These differ from older tutorials and from most training data:

- **`middleware.ts` is now `proxy.ts`** (`src/proxy.ts`), and the exported
  function must be named `proxy`. It runs on the Node.js runtime; `edge` is
  not supported there.
- **`cookies()`, `headers()`, `params` and `searchParams` are async.**
  Synchronous access was removed in Next 16.
- **Prisma 7 forbids `url` / `directUrl` in `schema.prisma`.** Connection
  strings live in `prisma.config.ts` (for the CLI) and are handed to
  `PrismaClient` through a **driver adapter** at runtime.
- `experimental.authInterrupts` is enabled so the data access layer can call
  `forbidden()` and render a real 403.

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in every value. `.env.example` documents what each one is and how to
generate the secrets.

| Variable                | Used by                                          |
| ----------------------- | ------------------------------------------------ |
| `DB_PRISMA_URL`         | The running app — **pooled** connection           |
| `DB_URL_NON_POOLING`    | `prisma migrate` — **direct** connection          |
| `AUTH_SECRET`           | Signs the session JWT                             |
| `FIELD_ENCRYPTION_KEY`  | AES-256-GCM for notes at rest                     |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage. **Unset in dev = files go to `.uploads/`** |
| `CRON_SECRET`           | Guards the hearing-reminder endpoint              |
| `NEXT_PUBLIC_FIRM_NAME` | Portal branding                                   |

### 3. Database

For local development you can run a throwaway Postgres with:

```bash
npx prisma dev
```

It prints a `postgres://…` URL — use it for both `DB_PRISMA_URL` and
`DB_URL_NON_POOLING` locally. Then:

```bash
npm run db:migrate     # create/apply migrations
npm run db:seed        # placeholder staff accounts (dev only)
```

### 4. Run

```bash
npm run dev
```

## Seeded accounts

`npm run db:seed` creates four placeholder staff accounts on the reserved
`example.com` domain and **generates a random password for each at run time**,
printing them once. No credential is hardcoded anywhere in the repository.

Re-running the seed **does not** rotate existing passwords — it only creates
accounts that are missing, and reports the rest as unchanged. (Rotating on
every run silently invalidates a password you are already using.)

To set a password deliberately — this is also how you recover an account until
the admin console lands in build step 6:

```bash
npm run user:password -- partner@example.com "a password you choose"
```

> Deploying to production? Follow [DEPLOY.md](DEPLOY.md).
>
> **These accounts must be deleted or rotated before deploy.** The seed script
> refuses to run when `NODE_ENV=production` or `VERCEL_ENV=production` unless
> `ALLOW_PRODUCTION_SEED=yes-i-am-sure` is set.

## Roles

| Role              | Case visibility                          | Notable limits                       |
| ----------------- | ---------------------------------------- | ------------------------------------ |
| `ADMIN_PARTNER`   | Every case in the firm                    | —                                    |
| `SENIOR_ADVOCATE` | Own cases + direct reports' cases         | No user management                   |
| `ASSOCIATE`       | Only cases they are assigned to           | Cannot create cases                  |
| `PARALEGAL`       | Only cases they are assigned to           | **Strategy notes hidden**; no edits  |

Team visibility uses `User.supervisorId`, a self-relation: a senior advocate
sees cases assigned to anyone reporting to them.

## Security model

Authorization is enforced in **two layers**, and the second is the real one.

1. **`src/proxy.ts` — optimistic.** Decodes the session cookie only, no
   database access, because it runs on every request including prefetches.
   Bounces anonymous users to `/login` and role-denied routes to `/no-access`.
2. **`src/lib/dal.ts` — authoritative.** Every case-scoped read goes through
   `caseScopeFilter()` / `requireCaseAccess()`, which re-check against the
   database. `requireUser()` also re-reads `isActive` and `role` per request,
   so deactivating or demoting someone takes effect immediately rather than
   when their token expires.

Other measures:

- **Field encryption at rest.** `CaseNote.body` and `Hearing.notes` are sealed
  with AES-256-GCM (`src/lib/crypto.ts`) before they reach Postgres, so a
  database dump does not expose case strategy. Encrypted columns are not
  SQL-searchable — document search operates on titles and filenames instead.
- **Audit log.** `AuditLog` is append-only and records document uploads,
  views, downloads and deletions, keeping a denormalised title so the trail
  survives deletion. Partners see it on each document's history page.
- **Document bytes are never served directly.** Blobs are written with
  `access: "private"` and read back server-side; a storage ref (blob URL or
  local path) is never sent to the browser. Every read goes through
  `/api/documents/[id]/download`, which authorises against the case
  assignment and writes an audit entry before streaming a byte.
- **No user enumeration.** Bad email, wrong password and deactivated account
  all return the same message, and `authorize()` runs a bcrypt comparison even
  when the user does not exist so timing does not leak.
- **Sign-in throttling.** 5 failures on one email within 15 minutes locks
  it for 15 minutes, doubling on each repeat up to 24 hours; 50 failures
  from one IP blocks that address. Counters live in Postgres
  (`LoginThrottle`, so they hold across serverless instances), are checked
  inside `authorize()` so direct POSTs to the NextAuth endpoint are covered,
  and unknown emails lock identically so the lockout cannot enumerate staff.
  Partners can lift a lock from Settings → Team; resetting a password also
  clears it. The daily task-deadline cron prunes stale rows.
- **Not indexable.** The root layout sets `robots: noindex, nofollow`.
- **The reminder cron is secret-gated.** `/api/cron/hearing-reminders` has no
  session; it compares `CRON_SECRET` in constant time and refuses to run at
  all if the secret is unset.

## Notice board

Firm-wide announcements, posted by partners only.

**Read receipts are an explicit acknowledgement, not an auto-mark on view.**
A receipt that only proves a page rendered is worthless as evidence that
someone actually read a firm announcement, so the reader has to press
"I have read this". Acknowledgement is idempotent — clicking twice keeps the
original timestamp — and editing a notice afterwards does **not** clear
receipts already given, because that would misrepresent who saw what. A
materially different announcement warrants a new notice.

Partners get a per-notice receipts view at `/notices/[id]/receipts` showing
who has acknowledged and who is outstanding. Deactivated staff are excluded
from the outstanding list.

## Clients and conflict checks

Each case links to a `Client` record (contact details, all matters for that
client) at `/clients`. Typing a client name on the case form suggests existing
clients; a name that matches none creates a new record. Clients are visible to
the same people who can see at least one of their matters.

**Conflict of interest check.** While the case form is filled in, and again
authoritatively on save, the client and opposing party are matched against
**every** case in the firm — including closed matters and matters the user is
not staffed on:

| Finding | Meaning | Effect |
| --- | --- | --- |
| Adverse | New client was an opposing party elsewhere, or new opposing party is/was a client | Save is held until the user ticks a confirmation and writes a reason (min. 20 chars) |
| Related | Same party, same side | Shown for information |

- Matching ignores honorifics, corporate suffixes and punctuation, and treats a
  name contained in a longer one as a match — tuned to over-report.
- For matters outside the user's access, only the reason and status are shown;
  case number and title are withheld.
- A confirmation is bound to the exact set of matches shown. If the parties are
  changed and different conflicts appear, it must be given again.
- Every check is stored in `ConflictCheck` (who, when, what matched, outcome,
  reason) and the latest one is shown on the case overview. Editing a case
  re-checks only when its parties change.

Cases created before this existed have no client link; `npm run
clients:backfill` (dry run, then `-- --apply`) groups them by normalised name
and links them.

## Time tracking

`/time` records hours against a case or as firm work, and each case has a
**Time** tab with totals by person and activity.

- **Entries**: date, duration (typed as `1:30`, `1.5`, `45m` …), activity and
  a description. No future dates, at most 24 hours per person per day, and
  only on cases the person can access. Only the author edits an entry; a
  partner may delete one to correct a mistake.
- **Timer**: one per person, stored server-side so it survives closing the
  browser. A running timer shows in the top bar on every page. Starting a new
  timer records the previous one. A timer left running over 12 hours is not
  recorded automatically — it was almost certainly forgotten.
- **Visibility** follows case scope: your own timesheet; senior advocates also
  see their direct reports; partners see everyone, including a weekly team
  grid.
- **Days** belong to the firm's time zone (`NEXT_PUBLIC_FIRM_TIME_ZONE`,
  default `Asia/Kolkata`), so a timer started at 1 a.m. is not filed under the
  previous day because the server runs in UTC.
- Deleting a case keeps its time entries (they become firm work).

There is deliberately no billing: no rates, amounts or invoices.

## Notifications

In-app, through the bell (which refreshes itself every minute) and the full
history at `/notifications`.

| Kind | Sent to | Can be muted |
| --- | --- | --- |
| Hearing reminders (7/3/1 days) | Case team | No |
| Deadline alerts | Assignee | No |
| Firm notices | Everyone | No |
| Conflict waived | Partners | No |
| Task assigned to you | Assignee | Yes |
| Task you raised is done | Task creator | Yes |
| Added to a case | New team members | Yes |
| Hearing listed or moved | Case team | Yes |
| Document uploaded | Case team | Yes |

| New case note | Case team (strategy notes skip paralegals) | Yes |
| Case status changed | Case team | Yes |

Nobody is notified about their own actions. Preferences live in **Settings →
Notifications**.

### Phone and desktop alerts (Web Push)

Every notification above is also pushed to the person's registered devices,
including when the portal is closed — the same way native apps notify.

- **Asking permission.** A banner offers "Turn on"; the browser's permission
  dialog appears only after that click (browsers ignore unprompted requests,
  and asking before explaining invites "Block"). "Not now" snoozes it for a
  week. Settings → Notifications shows each device, a **Send test** button and
  **Turn off**.
- **iPhone / iPad**: Apple only allows web push for sites added to the Home
  Screen (iOS 16.4+). The banner explains how. Android, Windows, macOS and
  Linux work straight from the browser.
- **Installable**: the portal ships a web app manifest and generated icons, so
  it can be installed as an app on any platform.
- **Privacy**: note text is never included. Each person can **hide case
  details on lock screens**, in which case alerts name only the kind of update.
  Signing out removes that browser's registration, so a shared computer does
  not keep receiving the previous user's alerts. Deactivated staff receive
  nothing. Expired subscriptions are removed automatically.
- **Security**: the server only sends to the real push services (Google,
  Mozilla, Apple, Microsoft), so a crafted subscription cannot make it call
  arbitrary URLs.
- **Setup**: generate keys once with `npx web-push generate-vapid-keys` and set
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
  Without them, push is off and everything else works. Push requires HTTPS
  (localhost is exempt for development). Read notifications are deleted after 90 days and all after a
year (by the daily task-deadline cron).

## Task deadlines

Tasks carry a *kind*, and the kind sets how early alerting starts — missing a
limitation period is not curable by noticing it the day before:

| Kind                  | Alert lead time |
| --------------------- | --------------- |
| `GENERAL`             | 3 days          |
| `FILING_DEADLINE`     | 14 days         |
| `LIMITATION_DEADLINE` | 30 days         |

Past-due items get one `OVERDUE` escalation rather than repeating. The sweep
uses the same bucketing and idempotency contract as hearing reminders, backed
by `TaskAlert` (unique on task + offset).

**Task visibility:** a task is visible if it is assigned to you, or it hangs
off a case you can reach. Partners see everything. Personal tasks with no case
attached stay private to their assignee. Paralegals can keep their own to-do
list but cannot direct other people.

## Hearing reminders

A daily sweep (`vercel.json` schedules 07:00 UTC) notifies everyone assigned
to a case when a hearing enters the 7-, 3- and 1-day windows.

- **Bucketed, not exact-day.** A reminder fires for the most urgent window a
  hearing has *entered*, so a sweep that fails to run for a day catches up
  instead of skipping a court date silently.
- **Less urgent windows are marked handled, not fired**, so a hearing booked
  two days out never sends a stale "in 7 days" reminder afterwards.
- **Idempotent.** `HearingReminder` is unique on (hearing, offset); re-running
  the sweep sends nothing twice.

Delivery is in-app (the sidebar bell). `src/lib/notifications/deliver.ts`
splits channels into a primary in-app record and best-effort outbound ones;
adding email means implementing `emailChannel.send` and setting
`NOTIFY_EMAIL_ENABLED=true`, with no change to any caller.

Run the sweeps by hand with:

```bash
curl -H "Authorization: Bearer $CRON_SECRET"   http://localhost:3000/api/cron/hearing-reminders
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/task-deadlines
```

## Scripts

| Script                | Does                                        |
| --------------------- | ------------------------------------------- |
| `npm run dev`         | Dev server                                  |
| `npm run build`       | Production build                            |
| `npm run typecheck`   | `tsc --noEmit`                              |
| `npm run lint`        | ESLint                                      |
| `npm test`            | Vitest unit tests (no database needed)      |
| `npm run db:migrate`  | Create + apply a migration                  |
| `npm run db:deploy`   | Apply migrations (production)               |
| `npm run db:seed`     | Placeholder staff accounts + sample matters |
| `npm run db:studio`   | Prisma Studio                               |
| `npm run user:password -- <email> "<pw>"` | Set an account's password |
| `npm run admin:create`  | Create or reset the administrator (see DEPLOY.md) |
| `npm run clients:backfill` | Link pre-existing cases to client records |
| `npm run crypto:rotate` | Re-encrypt notes under a new key (see DEPLOY.md) |

## Build status

1. ✅ Auth, roles, layout
2. ✅ Case CRUD, list and detail views (list-first, Kanban toggle)
3. ✅ Documents: upload, download, versioning, search, audit trail
4. ✅ Hearing diary, calendar + 7/3/1-day reminders
5. ✅ Tasks, personal dashboard + deadline alerts
6. ✅ Admin console + firm reports with PDF export
7. ✅ Notice board with explicit read receipts

All seven modules are delivered.
