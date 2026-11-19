# IEEE EMBS CUSB Platform

Operations, member recognition, and portal system for the IEEE Engineering in Medicine and Biology Society (EMBS) Cairo University Student Branch (CUSB).

The platform is a database-backed Next.js 16 application running on PostgreSQL via Drizzle ORM. All chapter management—including seasons, committees, roster memberships, live attendance check-ins, task delegation, grading, and leaderboard publishing—is executed directly through the web UI without manual database interventions.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL 16 with Drizzle ORM
- **UI Components**: Base UI (`@base-ui/react`), Lucide React, Tailwind CSS v4
- **Authentication**: Whitelist-based session authentication with scrypt password hashing
- **Testing**: Vitest, React Testing Library, jsdom (167 automated tests)

---

## Quick Start

### Prerequisites

- Node.js 20+
- `pnpm` (v9+)
- Docker & Docker Compose (for local PostgreSQL)

### 1. Start the Database

```bash
docker compose up -d
```

The database container runs on `localhost:5432` (`embs_portal`).

### 2. Install Dependencies & Seed

```bash
pnpm install
pnpm db:seed
```

### 3. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Seed Accounts for Testing

All seeded accounts use default password **`EMBS2026!`** on [`/login`](http://localhost:3000/login):

| Email | Role | Operational Scope | Default Landing |
| --- | --- | --- | --- |
| `master@cu.edu.eg` | `master_admin` | Full Chapter (Seasons, Committees, Roster Whitelist) | `/hr` |
| `director@cu.edu.eg` | `director` | High Leadership (Delegates to Heads & HR Admins) | `/hr` |
| `hr.lead@cu.edu.eg` | `hr_admin` | Chapter Operations (Rubrics, Publishing, HR Delegation) | `/hr` |
| `hr.member@cu.edu.eg` | `hr_member` | Committee-Scoped HR (AI and Machine Learning) | `/hr` |
| `salma.elsayed@cu.edu.eg` | `committee_head` | Head of AI and Machine Learning | `/hr` |
| `ziad.hany@cu.edu.eg` | `committee_head` | Head of Web Development | `/hr` |
| `omar.tarek@cu.edu.eg` | `member` | Active Member (Robotics and Automation) | `/member` |
| `mariam.yassin@gmail.com` | `attendee` | Workshop / Event Attendee | `/attendee` |

---

## Verification & Quality Gates

Run the verification suite:

```bash
# Run all 44 test suites (167 unit & integration tests)
pnpm test

# Verify TypeScript compilation (0 errors)
pnpm typecheck

# Check linting rules (0 warnings, 0 errors)
pnpm lint

# Production build verification
pnpm build
```

---

## Core Implemented Systems

### 1. Master Administration (`/hr/roster` & `/hr/committees`)
- **Roster Whitelist**: Master Admin can add new members to the active season roster or remove memberships. Controls email whitelist access and system role assignments.
- **Committee Lifecycle**: Master Admin can create new technical/non-technical committees or delete committees for the active season.

### 2. Task Delegation Engine (`/hr/tasks`)
- **Individual Targeting**: Delegate tasks to a specific member with due dates and maximum point values.
- **Group Broadcast**: Broadcast deliverables to target groups (`everyone`, `all_heads`, `all_members`, `committee_all`, `committee_heads`, or `committee_members`).
- **Automatic Joins**: Bulk-generates rows in `task_submissions` so deliverables immediately appear in `/member/tasks` for assigned members.

### 3. Live Timed Check-In Sessions (`/hr/attendance` & `/member/attendance`)
- **Head Session Creation**: Committee heads create sessions scoped to their committee with custom check-in duration windows (15, 30, 45, 60, 120 minutes), punctuality cutoffs, base points, and punctuality bonuses.
- **6-Digit Nonce & Projector Mode**: Starting check-in generates a rotating 6-digit numeric code with timestamped expiration and a high-contrast QR display.
- **Member Check-In**: Members enter the active code on `/member/attendance`. The action validates season, committee restriction, expiration, and duplicate check-in, posting verified points into `score_ledger`.

### 4. Deterministic Scoring & Leaderboard Snapshots
- **Score Ledger**: Append-only log of attendance, task grades, and bonus points. All member point totals are derived deterministically.
- **Monthly Snapshots**: One-click publishing freezes overall Top 10 and 12 committee leaderboards permanently into `monthly_snapshots`.

---

## Route Map

- **Public**:
  - `/`: Home page with Top 5 leaders and committee showcase
  - `/leaderboards`: Monthly overall rankings and 12 committee leaderboards
  - `/leaderboards/committees/[slug]`: Dedicated committee leaderboards
  - `/leaderboards/history`: Historical season and monthly archive viewer
- **Authentication**:
  - `/login`: Unified credentials authentication with role-based routing
- **Operational Portal (`/hr`)**:
  - `/hr`: Overview dashboard
  - `/hr/seasons`: Season lifecycle management (Master Admin)
  - `/hr/committees`: Committee management and scoring rubrics
  - `/hr/roster`: Roster whitelist, role assignments, and password resets
  - `/hr/attendance`: Sessions creation, timed check-in windows, and projector view
  - `/hr/tasks`: Task delegation (individual & group) and bulk grading
  - `/hr/ledger`: Point adjustments and bonus overrides
  - `/hr/feedback`: Member evaluations and private HR notes
  - `/hr/publishing`: Monthly snapshot preview and publish actions
- **Member Portal (`/member`)**:
  - `/member`: Live point total, rank tier, streak tracker, and committee milestones
  - `/member/attendance`: Meeting attendance history and live code check-in widget
  - `/member/tasks`: Assigned deliverables and grading feedback
  - `/member/feedback`: Published leadership recognition and notes
- **Attendee Portal (`/attendee`)**:
  - `/attendee`: Event and workshop tracking, isolated from internal member rankings
