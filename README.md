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

## Database

Migrations live in `supabase/migrations` and run in filename order. The runner
records what it has applied in `_migrations` and refuses to silently re-run an
edited migration — write a new one instead.

## Security notes

- `.env.local` and `supabase.txt` are gitignored. Never commit either.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Server-side only, never in a client component.
- Storage buckets are private; files are served through signed URLs.
