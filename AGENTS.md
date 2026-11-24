<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context

Read [`docs/PROJECT_INTENT.md`](./docs/PROJECT_INTENT.md) before modifying features, altering database schemas, changing session/auth handling, editing brand/UI layouts, or adding HR operational workflows.

### Non-negotiable invariants

- **Live production database protection**: The Neon PostgreSQL database now holds **real live chapter data** (`2026/2027` season, real members, emails, phone numbers, credentials, attendance, tasks, and scores).
  - **NEVER** wipe, truncate, reset, or run `pnpm db:seed` against Neon or any remote database.
  - All schema changes must be **strictly forward-only** (additive/nullable Drizzle migrations in `drizzle/00XX_*.sql`, expand -> migrate -> contract). Never drop columns, drop tables, or rewrite existing live rows destructively.
  - Automated tests (`pnpm test`) run exclusively against local Docker Postgres (`embs_portal_test`). Manual local testing uses local Docker Postgres (`embs_portal`), never the live Neon database.
  - Never run `pnpm db:migrate` against Neon without explicit user confirmation.
  - Never commit member roster CSV exports or PII files (`*.csv` is gitignored).
- **HR-first, zero direct database editing**: All operations (seasons, committees, rubrics, rosters, sessions, attendance, tasks, grading, point overrides, feedback, and leaderboard publishing) must be controllable through the `/hr` web UI.
- **Multi-season scoping**: Every operational database record must be foreign-keyed to a `season_id`. Archived seasons are read-only while archived; the active season cannot be archived without activating another season (preventing a zero-active-season state), and `master_admin` may re-activate an archived season (atomically archiving the previously active season while published `monthly_snapshots` remain permanently frozen).
- **Whitelist-only authentication**: Access is guarded by active membership in `roster_memberships` for the active season. No open signups; members authenticate with their email address or phone number and scrypt-hashed password stored on `persons` (zero external email delivery dependencies).
- **Data-layer privacy**: Hidden HR notes (`is_published === false`) must be filtered at the query layer and never returned to members, attendees, committee heads, or the target person across any of their hats. Member-visible Official Warnings (`category === "warning"`, `is_published === true`) are delivered to the warned member.
- **Deterministic score derivation**: Member scores flow through `score_ledger` and are derived deterministically. Historical monthly rankings are permanently locked via `monthly_snapshots`.
- **Next.js 16 + Base UI**: Keep `usePathname()` out of Suspense fallbacks, use `src/proxy.ts` (`proxy` export), and use `@base-ui/react` `render` props / `buttonVariants` instead of `asChild`.
- **Mobile-first responsive layout**: Every portal page, card, filter bar, and modal must fit cleanly down to `360px` mobile viewports with zero horizontal clipping. Always put `min-w-0` on grid/flex containers holding truncated text or `<select>` controls, stack `<select>` controls full-width below labels inside narrow cards, and give modal panels `max-h-[90vh] overflow-y-auto`.
- **Brand discipline**: Use the solid IEEE EMBS CUSB palette (solid `#772583` header bar with flush-left reverse-white `EmbsMark` at `h-9`, no CSS gradients, no ECG waveforms).
- **Verification**: Write failing tests first (red then green), then pass `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
