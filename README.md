# IEEE EMBS CUSB Platform

Operations, member recognition, and portal system for the IEEE Engineering in Medicine and Biology Society (EMBS) Cairo University Student Branch (CUSB).

The platform is a database-backed Next.js 16 application running on PostgreSQL via Drizzle ORM. All chapter management (seasons, committee tracks, committees, scoring rubrics, roster memberships, live attendance check-ins, task and assignment delegation, grading, ledger overrides, member feedback, and monthly leaderboard publishing) runs through the `/hr` web UI without manual database edits.

---

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions, `src/proxy.ts`)
- **Database**: PostgreSQL 16 (Neon serverless WebSocket Pool in production, Postgres.js for local Docker) with Drizzle ORM
- **UI**: Base UI (`@base-ui/react`), Lucide React, Tailwind CSS v4, Recharts
- **Auth & security**: Whitelist-only email + scrypt password login, HMAC-SHA256 signed `HttpOnly` cookies, live DB session revocation, Postgres-backed brute-force rate limiting, HTTP security headers, and SQL-layer privacy filtering for hidden HR notes
- **Testing**: Vitest, React Testing Library, jsdom against an isolated local Postgres test database (`embs_portal_test`)

---

## Local development quick start

### Prerequisites

- Node.js 22+
- `pnpm`
- Docker & Docker Compose (for local PostgreSQL)

### 1. Start local Postgres, migrate, and seed demo data

```bash
pnpm install
pnpm db:local:setup
```

Point `.env.local` to `postgresql://postgres:postgrespassword@localhost:5432/embs_portal` for local development.

### 2. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Production launch & database transfer

See [docs/PRODUCTION_LAUNCH_RUNBOOK.md](./docs/PRODUCTION_LAUNCH_RUNBOOK.md) for preserving your current Neon showcase DB locally (`scripts/copy-remote-to-local.sh`), migrating a fresh production DB (`pnpm db:migrate`), and initializing the real chapter season + 12 committees + Master Admin (`pnpm db:bootstrap`).

---

## Demo seed accounts (local showcase only)

Local demo seed accounts (`pnpm db:seed`, blocked in production and on remote databases by default) use temporary password `EMBS2026!` on `/login` and require changing password on first login:

| Email | Role | Operational scope | Default landing |
| --- | --- | --- | --- |
| `master@cu.edu.eg` | `master_admin` | Full chapter (seasons, tracks, committees, roster whitelist) | `/hr` |
| `director@cu.edu.eg` | `director` | Track or chapter leadership (assignments, read-only ledger audit) | `/hr` |
| `hr.lead@cu.edu.eg` | `hr_admin` | Chapter operations (season settings, HR assignments, tasks, publishing) | `/hr` |
| `hr.member@cu.edu.eg` | `hr_member` | Committee-scoped HR (tracks AI and Machine Learning) | `/hr` |
| `salma.elsayed@cu.edu.eg` | `committee_head` | Head of AI and Machine Learning | `/hr` |
| `ziad.hany@cu.edu.eg` | `committee_head` | Head of Web Development | `/hr` |
| `omar.tarek@cu.edu.eg` | `member` | Active member (Robotics and Automation) | `/member` |
| `mariam.yassin@gmail.com` | `attendee` | Workshop attendee | `/attendee` |

---

## Verification commands

```bash
# Prepare isolated local test DB (embs_portal_test)
pnpm db:test:reset

# Run all automated unit, component, and Postgres integration tests
pnpm test

# Lint, build, and typecheck
pnpm lint
pnpm build
pnpm typecheck
```

---

## Route map

- **Public**:
  - `/`: Chapter home page with live committee #1 leaders showcase
  - `/leaderboards`: Monthly committee leaders across all active committees
  - `/leaderboards/committees/[slug]`: Per-committee monthly standings
  - `/leaderboards/history`: Published monthly leaderboard archive
- **Authentication & check-in**:
  - `/login`: Whitelist-guarded credentials sign-in with mandatory first-login password setup
  - `/checkin`: QR deep-link check-in handler
- **Operational portal (`/hr`)**:
  - `/hr`: Role-scoped operational overview
  - `/hr/seasons`: Season lifecycle and scoring/operational settings
  - `/hr/committees`: Committee tracks, committees, and scoring rubrics
  - `/hr/roster`: Whitelist management, CSV bulk import, role/committee assignment, and password resets
  - `/hr/attendance`: Session creation, timed check-in windows, projector QR modal, and attendance sheets
  - `/hr/tasks`: Assignment & task delegation (individual and group) and keyboard-first bulk grading
  - `/hr/ledger`: Deterministic points ledger and manual adjustments
  - `/hr/feedback`: Member recognitions, excused absences, official warnings, and hidden internal HR notes
  - `/hr/publishing`: Monthly snapshot preview and immutable publish action
- **Member portal (`/member`)**:
  - `/member`: Live monthly standing, engagement tier, and recent deliverables/feedback
  - `/member/performance`: Score breakdown and monthly trend history
  - `/member/attendance`: Attendance history and live 6-digit check-in card
  - `/member/assignments`: Deliverable link submission and rubric grades
  - `/member/tasks`: HR task checklist
  - `/member/feedback`: Published recognitions, notes, and official warnings
- **Attendee portal (`/attendee`)**:
  - `/attendee`, `/attendee/attendance`, `/attendee/assignments`: Isolated workshop/track view without member rankings or HR notes
