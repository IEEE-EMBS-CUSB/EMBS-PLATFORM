# EMBS Platform: Design Spec

Draft v4, November 22, 2026. Captures the design discussion for the IEEE EMBS CUSB HR platform. Every item is tagged:

- **[decided]**: Sheref's call, treat as requirement
- **[proposed]**: suggested during discussion. Anything that affects behavior or data shape needs Sheref's approval before implementation.
- **[open]**: unresolved product choice. Do not silently pick one.

Repo: https://github.com/IEEE-EMBS-CUSB/EMBS-PLATFORM · Live: https://embs-platform.vercel.app/hr

---

## 1. Goal **[decided]**

An HR system for IEEE EMBS CUSB where members see and track their progress, and HR can do their job easily. **Keep and improve the existing codebase. No rewrite.**

## 2. Current state (verified against repo @ 9587fba)

Stack: Next.js 16 (App Router, Server Actions), React 19, PostgreSQL + Drizzle ORM, Tailwind v4 + Base UI, whitelist email + scrypt password auth, ~216 Vitest cases.

### Already solid: keep

- **Season scoping**: every operational table FKs to `seasons`; unique constraints are season-qualified; archived seasons are read-only.
- **Score ledger**: `score_ledger` records points with `sourceType` + `sourceId`, signed values, and a partial unique index. On edits it **upserts**: re-grading a task or toggling attendance updates the existing row for that source instead of adding a duplicate. So the ledger is *deduplicated mutable postings keyed by source*, not a strictly immutable event log. Published `monthly_snapshots` are the immutable layer: once a month is published it never changes.
- **Leaderboards derived, then frozen**: boards are computed from the ledger; snapshots freeze published months deliberately.
- **Permissions as capabilities with committee scope** (`src/lib/permissions.ts`), not an inheritance chain. Directors have `managedTrackId`.

### Weak: fix list

1. **One role per person per season**: `roster_memberships` is unique on (season, email) with single `role` + `committeeId`. Blocks multi-role people.
2. **Auth on the seasonal roster row**: `passwordHash` lives on `roster_memberships`, gluing identity to a season and duplicating credentials every season.
3. **Track scoping half-wired**: enforced in tasks/feedback/ledger services, but `permissions.ts` still gives directors chapter-wide powers; sessions/attendance/roster don't track-scope.
4. **Attendees hard-blocked from `score_ledger`** even though attendees should have a leaderboard. Their points only exist in `attendance_records.pointsAwarded`.
5. **Heads-only leaderboard doesn't exist**: the `leadersOnly` rubric flag is settable in admin UI but consumed by no computation.
6. **Dual point storage**: `attendance_records.pointsAwarded` duplicates the ledger posting.
7. **Leftover parallel model**: `member_activities` and `seasonal_evaluations` overlap ledger/feedback. **[open: confirm whether to delete, migrate, or keep]**
8. **`hr_member` has no switch to a personal-work view**: only `committee_head` does.
9. **`tasks.targetType` / `targetGroup` are free text**: should be enums. **[proposed]**
10. **No notification or reminder mechanism exists** (checked at 9587fba: no notification table, no email/push sender dependency, no web app manifest or service worker). Tasks have a `dueAt`; members only learn about work by opening the site. See section 8.

## 3. Identity, people, roles

- **[decided]** Separate **people** from **season memberships**. A person keeps their password and identity across seasons; their role is per-season. S1 PR member → S2 PR head: same account, new membership. Historical work stays attached to the old season's membership; a new role never rewrites past scores or grants access to old seasons.
- **[proposed]** Admission to a new season: the master grants an existing person their new membership rather than the person re-registering or being admitted automatically. Needs Sheref's approval.
- **[decided direction]** One person can hold multiple roles in the same season (e.g. HR member tracking one committee + regular member of another; head who attends other committees' events as an attendee). Exact mechanics below are proposed.

### Target model **[proposed: approve before implementing]**

- `persons`: id, fullName, email, passwordHash, mustChangePassword, isActive.
- `roster_memberships`: one row per hat (seasonId, personId, role, committeeId nullable for master/director, managedTrackId for directors).
- Everything that touches a member (`attendance_records`, `task_submissions`, `score_ledger`, `hr_feedback`) keeps referencing `membershipId`, which then carries person + season + role + committee.
- **Uniqueness needs deliberate design, not one composite index**: Postgres treats NULLs as distinct, so a naive unique on (season, person, role, committee) would allow duplicate master/director rows (committee NULL) and duplicate director rows across tracks. Likely needs partial unique indexes per role class (global roles, committee roles, track-managing directors). Design this explicitly before writing the migration.
- **Migration validation work** (do not promise lossless up front; prove it): duplicate/normalized emails collapsing to one person, historical password conflicts when two roster rows share an email, FK retention for existing attendance/submissions/ledger rows, session revocation and safe cutover, before/after row counts. All on a branch, reversible.

## 4. Scoring & leaderboards

### Rules

- **[decided]** Per-committee boards must not inflate from work in other committees: "if I do 1 AI task and 10 PR tasks I should top PR but not AI, and could possibly use the sum in global leaderboard."
- **[decided]** HR-awarded points and global scores count toward per-committee leaderboards: "if both members do their assignment, one that also did extra HR tasks deserves higher points."
- **[decided]** Global tasks should show up on every leaderboard. **[open: eligibility. Does "every leaderboard" mean every board the person appears on, every board regardless of role, attendee boards too? Needs clarification before computation rules are final.]**
- **[proposed mechanism: approve before implementing]** Every ledger row stamps the membership that earned it. Two row kinds:
  - **Committee-scoped** (attendance, committee assignments): feeds that committee's board + global.
  - **Open** (global tasks, org-wide HR awards): feeds global + every committee board where the person holds an eligible membership.
- **[proposed invariant]** Counting discipline: globally, a person's points count **once per person** (sum across their memberships, within one season). Per board, open points count **once per eligible board** even when the person holds multiple memberships. No board ever sums another board.
- **[proposed]** A multi-role person doing a global task earns it once, stamped to one membership (the context they submitted under, defaulting to their main committee).
- **[proposed]** Changing the active view/hat never hides or reattributes score history: the personal dashboard aggregates across all of the person's memberships in the season.
- **[proposed]** Edge case: open points earned earlier in the season appear on a committee board even if the person joins that committee later. Leave as-is; revisit only if it feels wrong in practice.
- **[open]** HR member distinction: an HR member **tracks** a committee (assigned by HR admin) vs. their **home membership** committee. Which membership do their HR-task points stamp, and which board(s) do they feed? Needs explicit decision.
- **[open]** Complete list of point sources. Current candidate list: attendance, committee assignments, global tasks, event participation, HR manual awards. Sheref has not confirmed this list is complete. Schema enum today: `attendance | task | event | manual_override`.
- **[open: design choice]** Ledger mutability: today's upsert model (mutable postings per source) vs. a strictly append-only event log with reversal rows when grades/attendance change. The current model works with the unique index; the append-only model gives a fuller audit trail. Decide before building more on it.

### Boards to build

Per-committee, global, **heads-only**, and **attendee** leaderboards, all filters over the same ledger rows (heads board = rows from head memberships; attendee board = rows from attendee memberships, requires removing the hard block in §2.4). **[open: whether and how `leadersOnly` rubrics and rubric weights participate in board computation; they currently don't]**

## 5. Context switcher (multi-role UX)

- **[decided]** Never label a head's personal-work view "Member." A head stays "Head"; the view name describes the activity, not the role.
- **[under consideration: latest direction]** Sheref's current leaning: **always a popover/picker**, so the button can always show the active selected role/context. (His earlier two-option-direct-switch idea is superseded unless he says otherwise.) Confirm before building.
- **[proposed]** Button shows current context, e.g. `PR · Head · My work ▾`. Inside, group views under role headings, active view checked:

  ```
  PR · Head
    ✓ My work
      Manage committee
  AI · Member
    My work
  ```

  Single-context users see a plain, non-interactive label. Popover on desktop, bottom sheet on mobile (the Sheet component already exists in both shells). View labels ("My work" / "Manage committee") are proposals, not settled.
- **[proposed]** Default to the last-used context; persist in a cookie.
- **Implementation requirement** (verified in code): the session currently pins exactly one `roster_memberships` row (`session-cookie.ts`). Multi-role needs an active-membership selector (cookie or query param) **validated server-side** against memberships the person actually owns. The picker UI is the easy half; this session change is the real work.
- Current state for reference: the "switcher" today is cross-route links (`/hr` ↔ `/member`), no stored view state, and only heads get the return link (§2.8).

## 6. Non-goals this release **[decided]**

- Members managing attendees ("not implemented or planned in this release"). **[open: his role description also says attendees "can be assigned assignments and attendance by members". If members don't manage attendees this release, who executes attendee assignments/attendance in the meantime? Needs an explicit owner, not an invented one.]**

## 7. Permission model reference (Sheref's original description)

- **master**: core admin. Admits/removes people, starts/ends seasons, all admin tools.
- **director**: under master, scoped to a track (multiple committees). Full admin within their track's committees; no season setup; can add/remove people in their track.
- **head**: receives assignments from director and HR head; submits attendance; assigns committee members assignments/attendance; heads get their own leaderboard.
- **hr admin**: extends head for the HR members under them; assigns each HR member to a committee to track; reviews attendance scoring and assignment scoring; sets tasks for members separate from heads' assignments.
- **member**: no admin access. Checks scores, attends, does tasks and assignments. Leaderboards: global + per committee.
- **hr member**: extends member; assigns tasks and does attendance over their committee.
- **attendee**: own leaderboard; can be assigned assignments and attendance by members (future), no HR.

## 8. Notifications and due-task indicators

Sheref's request (his words, paraphrased): the site should not be forgotten; at minimum show indicators on the page when you have due tasks; possible push notifications; and HR will notify the team when they add an assignment or similar.

### What he asked for vs. what we suggested

- **[decided]** The platform needs a way to keep people from forgetting it. On-page indicators for due tasks are the minimum he named.
- **[decided direction]** HR notifies the team when adding an assignment "or smth". **[open: what this means.]** Options: (a) the system notifies automatically when a task is created or changed; (b) HR writes and sends a manual announcement; (c) both. Also open: which channel (in-app only, email, push, or an external app like WhatsApp). Nothing may be sent to anyone outside the platform until he picks.
- **[open]** Push notifications: he said "possible". Whether to build them at all, and in which release, is his call.
- **[proposed]** Suggested layering: (1) due-task indicators, (2) in-app notification inbox for assignment events, (3) optional push on top. Push is not required for the feature to work. This is a suggestion, not an approved plan.

### Indicators vs. notifications (proposed principle, approve before building)

- **Indicators show live state.** "You have N tasks due" is computed from current tasks and submissions each time the page loads. It is never a stored message that can go stale. The indicator changes by itself when the task's actual completion rules say it is done (or the task is deleted or revised). **[open]** Completion rules: does submitting clear it, or only grading? Does a revision request or a resubmission make it due again? Neon should read the current submission and grading flow and propose rules; grading must not be assumed to always clear a task.
- **Notifications are events.** "HR assigned you X" is a record of something that happened. It can be read or dismissed, but it is not the source of truth about what is due. Opening it should lead to the live task.
- A push or inbox item must never be the only place a due task is visible.

### Multi-role relevance and deduplication

- **[proposed]** Notifications and indicators belong to the **person**, not to one membership, so they follow someone across roles and seasons without re-subscribing.
- **[proposed]** One event produces at most one notification per person (dedupe key: event id + person), even if several of that person's memberships are eligible. The notification may reference **all** eligible contexts (e.g. PR Head and AI Member) instead of forcing one membership and hiding another. The person sees one combined bell/count, and the picker (section 5) can show per-context counts. Switching view must not hide a due task from another hat. Retries and edits must not create duplicates; whether a changed deadline updates the existing item or adds a follow-up is **[open]**.
- **[proposed]** Live permission checks: recipients are re-derived when sending, and access is revalidated when a notification or its linked task is opened. A membership that was removed or deactivated gives no access, even if the notification already exists. Stored notifications are history, not authorization.
- **[proposed]** A push subscription belongs to the person and may persist across seasons, but it does not imply eligibility. Next-season notifications go only to people who hold an eligible membership in that season.
- **[proposed]** Only the current season's tasks count by default. Archived seasons are read-only and generate no indicators.
- **[open]** Task targeting today is resolved from `targetGroup` (everyone, all_heads, committee_members, and so on), and submissions are per membership. Neon should verify how "assigned to me" is derived before designing the due-task query, including whether a member with no submission row yet counts as due.
- **[open]** What counts as "due": overdue only, due within N days, or both? The threshold is a product choice.

### Permissions and privacy

- **[proposed]** Recipients are computed server-side from the task's own targeting rules. Clients never choose recipients, and a user can read only their own notifications.
- **[proposed]** Who may trigger a notification follows the existing capability model (`src/lib/permissions.ts`): HR and heads notify within their scope, directors within their track, master anywhere. Needs a capability and a service-layer check, not a UI-only check.
- **[decided, existing invariant]** Internal HR notes, feedback, and warnings never reach member or attendee payloads. Notification text must not include grades, feedback, or notes. "A new assignment was posted" is fine; "you scored low" is not, unless Sheref decides otherwise.
- **[open]** Do attendees get notifications? They have no HR access and are tied to the member-management non-goal (section 6).
- **[open]** Do heads and HR members receive notifications for the work they must grade or review, not just work assigned to them?

### Push notes (verify at build time)

- **[decided direction]** No native app, and the in-page indicators and inbox work with no push at all. Plain version: with Web Push the person taps an enable button (a deliberate gesture), the browser asks permission, and the site stores a subscription for that device. A service worker then shows the notification even when the site is closed. On iPhone the site must first be added to the Home Screen and opened from that icon. He asked how to do this "without an app"; the web-only direction is Web Push, which needs the user's permission, a stored push subscription per device, and a service worker. Apple's description: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers.md (on iPhone the site must be added to the Home Screen and opened from that icon, and permission requested from a user gesture, not in an ordinary browser tab). Whether to build push at all stays **[open]**.
- **[proposed]** Human fallback: HR can post in the team chat for people who have not enabled push. This is a possible manual practice only, not an automated channel and not a decided one. The platform must not send to external chat apps.
- Current repo has no push infrastructure, so push would be new: browser subscriptions stored per person/device, a sender, a web app manifest, and a service worker. **[open: provider and approach]**
- iPhone support exists for Home Screen web apps starting with iOS and iPadOS 16.4 (source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Users generally must add the site to their Home Screen first. Neon must re-check current browser support and requirements from vendor docs before promising behavior, and push must ask for permission explicitly rather than prompting on page load.
- Users must be able to opt out per person, and unsubscribe/invalid devices must be cleaned up.
- Since many members may be on phones without push, the on-page indicators are the dependable layer.

### Scope guardrails

- This section is design only. Nothing here is approved for implementation; Neon starts with inspection, a plan, and questions.
- No automatic sending to real people (email, push, or external messages) until Sheref approves channel, trigger events, and wording. Development uses test data and the branch only.
- Not requested, so not included unless he asks: reminders on a schedule, digest emails, per-event preference screens, chat, read receipts.
