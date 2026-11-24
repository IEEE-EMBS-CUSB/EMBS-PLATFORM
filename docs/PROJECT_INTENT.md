# Project Intent: IEEE EMBS CUSB Platform

Authoritative record of the product architecture, operational workflows, data layer, security model, and visual identity for the IEEE EMBS Cairo University Student Branch (CUSB) platform.

---

## 1. Product Purpose and Operational Invariants

The platform is a database-backed management, recognition, and portal system for IEEE EMBS CUSB. It unifies member tracking, committee deliverables, attendance logging, and monthly leaderboards into a single database-driven application with six non-negotiable operational invariants:

1. **Live production data safety (forward-only schema evolution)**:
   - The Neon PostgreSQL database holds **real live chapter data** starting with the `2026/2027` season (real members, emails, phone numbers, credentials, attendance, tasks, and scores).
   - Never wipe, truncate, reset, or run `pnpm db:seed` against Neon or any remote database.
   - All database migrations must be forward-only (additive/nullable columns and indexes; expand -> migrate -> contract). Never drop columns/tables or destructively rewrite live user records.
   - Automated tests (`pnpm test`) run exclusively against local Docker Postgres (`embs_portal_test`), and local manual testing uses local Docker Postgres (`embs_portal`).
2. **HR-first, zero direct database editing**:
   - All chapter administration (seasons, committees, scoring rubrics, roster memberships, sessions, attendance, tasks, grading, point overrides, member feedback, statistics, and monthly leaderboard publishing) is controllable through the `/hr` web UI.
   - No developer intervention or raw SQL scripts are required for standard operations.
3. **Multi-season scoping**:
   - Every operational database record is foreign-keyed to a `season_id`.
   - Archived seasons are read-only while archived; the active season cannot be archived directly (seasons transition to archived only when another season is activated, preventing a zero-active-season state). `master_admin` can re-activate an archived season, atomically archiving the previously active season while published `monthly_snapshots` remain permanently frozen.
4. **Whitelist-only authentication**:
   - Access is strictly guarded by active presence in `roster_memberships` for the active season.
   - There are no public sign-ups or self-registrations.
   - Authentication uses email address or E.164 phone number plus password (stored on `persons` with scrypt hashing and enforced password changes on first login), eliminating reliance on external email delivery services.
5. **Data-layer privacy**:
   - Hidden HR notes (`is_published === false`, `category === "internal_note"`) are filtered at the database query layer and are never returned to members, attendees, committee heads, or the subject person across any of their hats.
   - Official Warnings (`category === "warning"`, `is_published === true`) are delivered directly to the warned member's portal alongside Public Recognitions, Excused Absences, and General Notes.
   - Feedback entries may optionally carry a signed `points_delta` bonus/deduction (default `0`, capped by `seasons.settings_json.feedback`), which posts atomically to `score_ledger`.
6. **Deterministic score derivation**:
   - Member scores flow through `score_ledger` and are derived deterministically.
   - Published monthly rankings are permanently frozen into immutable records in `monthly_snapshots`.

---

## 2. Database Architecture (PostgreSQL + Drizzle ORM)

Persistence runs on PostgreSQL via Drizzle ORM, defined in [`src/db/schema.ts`](../src/db/schema.ts).

### Tables

1. **`seasons`**: Master season record (`id`, `name`, `status: draft | active | archived`, `startDate`, `endDate`, timestamps).
2. **`committees`**: Season-scoped committees (`id`, `seasonId`, `name`, `slug`, `category: technical | non_technical`, `isActive`, timestamps).
3. **`roster_memberships`**: Chapter roster, role assignment, and authentication credentials (`id`, `seasonId`, `email` [indexed lowercase], `fullName`, `committeeId` [nullable], `role: master_admin | director | hr_admin | hr_member | committee_head | member | attendee`, `passwordHash`, `mustChangePassword`, `isActive`, timestamps).
4. **`scoring_rubrics`**: Seasonal scoring weights and categories (`id`, `seasonId`, `name`, `maxPoints`, `weight`, `leadersOnly: boolean`, `sortOrder`).
5. **`branch_sessions`**: Meetings, workshops, and events (`id`, `seasonId`, `committeeId` [nullable = branch-wide], `title`, `startsAt`, `checkinCode` [6-digit numeric check-in code], `checkinExpiresAt`, `checkinOpen: boolean`, `punctualityCutoffMinutes`, `basePoints`, `punctualityBonus`, timestamps).
6. **`attendance_records`**: Session check-in records (`id`, `sessionId`, `membershipId`, `checkedInAt`, `isPunctual`, `pointsAwarded`, `overrideReason`). Unique on `(sessionId, membershipId)`.
7. **`tasks`**: Assigned committee or branch deliverables (`id`, `seasonId`, `committeeId` [nullable = branch-wide], `title`, `description`, `dueAt`, `maxPoints`, timestamps).
8. **`task_submissions`**: Member deliverables and grades (`id`, `taskId`, `membershipId`, `effortScore: 1-5`, `qualityScore: 1-5`, `timelinessScore: 1-5`, `totalPoints`, `notes`, `gradedBy`, `gradedAt`, timestamps). Unique on `(taskId, membershipId)`.
9. **`score_ledger`**: Append-only deterministic ledger (`id`, `seasonId`, `membershipId`, `month: YYYY-MM`, `sourceType: attendance | task | bonus | penalty | manual_override`, `sourceId`, `points: integer signed`, `reason`, `createdBy`, timestamps). Partial unique index prevents duplicate point awards.
10. **`monthly_snapshots`**: Immutable historical leaderboards (`id`, `seasonId`, `month: YYYY-MM`, `status: draft | published`, `publishedAt`, `publishedBy`, `snapshotJson`). Freezes overall Top 10 and committee Top 10 standings.
11. **`hr_feedback`**: Performance notes and warnings (`id`, `seasonId`, `membershipId`, `content`, `isPublished: boolean`, `isWarning: boolean`, `createdBy`, timestamps).
12. **Auth Tables** (`users`, `accounts`, `sessions_auth`, `verifications`): Session management tables.

---

## 3. Role Hierarchy & Operational Boundaries

The platform enforces a 7-tier role model implemented in [`src/lib/permissions.ts`](../src/lib/permissions.ts):

| Role | Operational Scope | Key Permissions |
| --- | --- | --- |
| **`master_admin`** | Full Chapter | Exclusive control over season lifecycle, adding/removing committees, roster whitelist management (add/remove), assigning all roles, and global task/assignment creation. |
| **`director`** | Track or Chapter Leadership | Supervises managed track (or chapter if executive). Delegates **Assignments** to Committee Heads, HR Admin, and Members (does not grade HR tasks). Views track-scoped Points Ledger in **read-only** audit mode; logs feedback/warnings without point edits. |
| **`hr_admin`** | Chapter Operations | Configures active season scoring & operational settings (`/hr/seasons`), assigns HR members to committees, assigns **Assignments** to HR committee (`hr_member`) and **Tasks** to everyone (including heads-only), manages attendance, points ledger, feedback/warnings, and publishes monthly leaderboards. |
| **`hr_member`** | Committee-Scoped HR | Embedded within a tracked committee (`trackedCommitteeId`). Manages attendance sessions & per-session attendance sheets, creates/verifies committee HR tasks (`self_report` or `hr_only`), manages committee ledger overrides, and logs feedback, official warnings, and hidden HR notes for their tracked committee. |
| **`committee_head`** | Single Committee | Creates committee sessions with auto-closing check-in windows and attendance sheets, delegates and grades committee member **Assignments**, awards committee bonuses, and submits member-visible feedback. Receives assignments from Director. |
| **`member`** | Member Portal | Accesses personal dashboard (`/member`), tracks real-time points from `score_ledger`, views meeting attendance streaks, submits deliverables, and checks in to live sessions via 6-digit codes. |
| **`attendee`** | Attendee Portal | Accesses workshop/track dashboard (`/attendee`), tracking session attendance and assignments without exposure to internal member rankings or HR notes. |

---

## 4. Implemented Operational Workflows

### Roster Management (`/hr/roster`)
- **Master Admin Exclusive**: Only `master_admin` can add new members to the active roster or remove existing memberships.
- **Role Assignment**: `master_admin` assigns roles (`director`, `hr_admin`, `committee_head`, etc.) and attaches members to committees.
- **Password Reset**: Master can issue password resets that enforce a change upon subsequent login.

### Committee Management (`/hr/committees`)
- **Master Admin Exclusive**: Only `master_admin` can create new committees or delete committees for the active season.
- **Metadata**: Committees belong to technical or non-technical tracks with slug-based routing for committee leaderboards.

### Task Assignment Engine (`/hr/tasks`)
- **Individual Targeting**: Assign a specific deliverable to an individual member.
- **Group Broadcast**: Assign tasks to pre-defined groups:
  - `everyone`: Broadcast to all active chapter members.
  - `all_heads`: Broadcast to all committee heads across the chapter.
  - `all_members`: Broadcast to all regular members across the chapter.
  - `committee_all`: Broadcast to everyone in a selected committee (heads + members).
  - `committee_heads`: Broadcast to heads of a selected committee.
  - `committee_members`: Broadcast to members of a selected committee.
- **Automated Join**: When a group task is created, matching membership records are resolved from `roster_memberships` and bulk-inserted into `task_submissions`. Tasks immediately appear in `/member/tasks` for all recipients.

### Live Session Check-In & Attendance (`/hr/attendance` & `/member/attendance`)
- **Session Creation**: Committee heads (scoped to their committee) and HR admins (branch-wide or committee-specific) create sessions with defined dates, base points (default 10), and punctuality bonuses (default 5).
- **Time-Bounded Window**: Creators set a check-in validity window (e.g., 15, 30, 45, 60, or 120 minutes) and a punctuality cutoff.
- **6-Digit Nonce & QR Code**: Opening check-in generates a unique 6-digit numeric code and timestamped `checkinExpiresAt`. A high-contrast projector modal displays both QR and numeric codes.
- **Member Self-Check-in**: Members enter the code via the `LiveCheckinCard` on `/member/attendance`. The action verifies active season, committee authorization, duplicate prevention, and window expiration. On success, attendance is recorded and points are posted directly to `score_ledger`.

### Leaderboard Publishing (`/hr/publishing` & `/leaderboards`)
- **Monthly Aggregation**: Per-committee ranks are computed deterministically from `score_ledger` entries for the specified month (members and HR members only; HR members appear exclusively on the Human Resources board).
- **Snapshot Freezing**: Clicking "Publish Month" stores the per-committee rankings in `monthly_snapshots`. Once frozen, rankings never shift even if past data is reviewed.
- **Public Showcase**: `/` and `/leaderboards` showcase each committee's #1 Committee Leader, with per-committee full monthly standings at `/leaderboards/committees/[slug]` and historical month archives at `/leaderboards/history`.

---

## 5. Portal Navigation and Route Isolation

Access is enforced server-side via `src/proxy.ts` and portal layout guards:

- `/login`: Unified credentials authentication with automated landing destination resolution (`/hr`, `/member`, or `/attendee` based on role).
- `/hr/*`: Accessible to operational roles (`master_admin`, `director`, `hr_admin`, `hr_member`, `committee_head`). Sub-navigation tabs are filtered by role permissions.
- `/member/*`: Accessible to all active roster members. Includes performance metrics, attendance log with live check-in, task deliverables, and published feedback.
- `/attendee/*`: Accessible to attendees. Isolated from member ranking ladders, points, and HR notes.
- `/leaderboards/*`: Public view of frozen monthly rankings and committee standings.

---

## 6. Visual Identity & Brand Discipline

- **Color Palette**: Solid IEEE EMBS CUSB palette:
  - Primary Purple: `#772583`
  - Deep Purple: `#5a1b63`
  - Soft Lavender: `#f5edf7`
  - Deep Navy: `#002855`
  - IEEE Blue: `#00629b`
  - EMBS Green: `#78be20`
  - Dark Green: `#1e6b0a`
  - CUBES Gold: `#ffc627`
- **Discipline**: Solid fills, clean geometric cards, and high-contrast typography. No CSS gradients or decorative ECG waveforms.
- **Header Geometry**: Solid `#772583` header bar with flush-left white `EmbsMark` (`h-9`) from `public/ieee-embs-logo.png`.
- **Mobile-First Responsiveness**: All portals, cards, filter controls, and modal dialogs must remain usable without horizontal clipping down to `360px` mobile viewports (`min-w-0` on grid/flex containers holding truncated text or `<select>` elements, stacked full-width `<select>` inputs in narrow cards, and `max-h-[90vh] overflow-y-auto` on dialogs).
- **Component Architecture**: Built on Next.js 16 and `@base-ui/react` with `buttonVariants` and `render` props (no `asChild`).
