# Nexis OS

The internal operating system for the NEXIS School of Business team — events,
marketing, approvals and everyday work in one place, built to be fast on a phone.

It exists to replace the parts of the job that currently live in WhatsApp
threads and people's memory: chasing approvals, remembering the fifteen things
that have to happen before an event, and keeping every department on the same
brand and the same standard.

## Stack

| Layer     | Choice |
| --------- | ------ |
| App       | Next.js 15 (App Router, React 19, TypeScript) |
| Styling   | Tailwind CSS v4, Poppins, Nexis brand palette |
| Data      | Supabase Postgres with row-level security |
| Auth      | Supabase Auth — email + password |
| Files     | Supabase Storage (private buckets, signed URLs) |
| Messaging | MSG91 (WhatsApp + SMS) |
| Hosting   | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate
npm run dev
```

Create the first super admin:

```bash
node scripts/create-user.mjs you@nexisschool.com "Your Name" super_admin
```

The generated password is printed once. Change it after signing in.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:status` | Show applied migrations and tables |
| `node scripts/create-user.mjs <email> "<Name>" <role> [phone]` | Provision a user |

## How it is put together

### Roles

Three org-wide roles — `super_admin`, `manager`, `member` — plus per-department
manager rights, so someone can lead Marketing while being an ordinary member of
Events. Access is enforced in Postgres via row-level security, not just in the
UI, so a stray query cannot leak data.

Reading is deliberately broad (an internal OS is useless if people cannot see
the work around them); writing is scoped to the people responsible.

### One task engine

An event checklist item, a marketing to-do and an ad-hoc board card are all rows
in `tasks`. That means one assignment model, one reminder pipeline and one
"my work" view instead of three parallel systems that drift apart.

### Event playbooks

A playbook is the preset formula for running an event — 38 steps in the default
one, each with a category and an offset in days from the event date. Creating an
event from a playbook materialises every step as a real task with a real due
date, so nothing is rebuilt from memory and nothing quietly gets skipped.

### Approvals

`approval_requests` is a single review pipeline that any entity can plug into —
creatives, scripts, campaigns, expenses. Each carries a version, so a re-upload
after "changes requested" is tracked rather than overwriting history.

### WhatsApp reminders

Delivery goes through MSG91 on the integrated number configured in
`MSG91_WHATSAPP_INTEGRATED_NUMBER`. Everything sends via one adapter
(`src/lib/messaging/msg91.ts`), so swapping providers means replacing one file.

Five UTILITY templates back the notifications. `{{1}}` is always the
recipient's first name; the rest come from the reminder's `payload.variables`.

| Template | Sent when |
| -------- | --------- |
| `nexisos_task_reminder` | A task is due tomorrow |
| `nexisos_task_assigned` | Work is assigned to someone |
| `nexisos_approval_pending` | A creative or script needs a decision |
| `nexisos_approval_decision` | A submission is approved or sent back |
| `nexisos_event_countdown` | An event is approaching with steps still open |

```bash
node scripts/msg91-templates.mjs list     # check approval status
node scripts/msg91-templates.mjs create   # submit any that are missing
```

Templates must be **approved by Meta** before anything can actually send. Until
then keep `MSG91_DRY_RUN=true` — messages are logged to `message_log` and
visible under Admin → Message log, but nothing leaves the building. Set
`MSG91_DRY_RUN=false` once `list` shows them approved.

Approval notifications deliver immediately; due-date reminders are queued by the
cron in `vercel.json`, which runs at 03:30 UTC (09:00 IST). To run it by hand:

```bash
curl "http://localhost:3000/api/cron/reminders?secret=$CRON_SECRET"
```

### Expenses

Reimbursements and vendor payments both live in `expenses` and route through
the same approval engine as creatives and scripts. Approving is agreeing to
spend; marking paid is the money actually leaving, and only Finance can do the
second. Receipts go to a private bucket and are served through signed URLs.

Row-level security is tighter here than elsewhere: a team member sees only
their own claims, managers see their department's, Finance sees everything.

### Loading and performance

Pages render blocking rather than streaming, and navigation feedback comes from
the snake progress bar at the top of the screen (`src/components/shell/snake-loader.tsx`).

This is deliberate. Streaming Suspense boundaries — including route-level
`loading.tsx` — do not resolve on this stack (Next 15.5.21 / React 19.2): the
server emits the full HTML but the boundary stays postponed (`<!--$~-->`) and
the content never appears, leaving a permanently blank page. Verified in both
Chrome and the preview browser, with and without Turbopack, so it is not a
browser or bundler quirk. Blocking renders are ~270-480ms in production, which
is well inside the budget, and the snake bar covers the wait.

**If you reintroduce `loading.tsx` or a `<Suspense>` boundary around server
content, check the page still renders on a hard refresh** — not just on a
client-side navigation, which masks the bug.

Session context (profile, department, managed departments, pending-approval
count) comes back in a single `session_bundle()` call and is deduped with
React's `cache()`, so a full page render costs one database round trip for auth
instead of four.

## Database

Migrations live in `supabase/migrations` and run in filename order. The runner
records what it has applied in `_migrations` and refuses to silently re-run an
edited migration — write a new one instead.

## Security notes

- `.env.local` and `supabase.txt` are gitignored. Never commit either.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Server-side only, never in a client component.
- Storage buckets are private; files are served through signed URLs.
