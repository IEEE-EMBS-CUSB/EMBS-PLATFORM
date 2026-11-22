<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context

Read [`docs/PROJECT_INTENT.md`](./docs/PROJECT_INTENT.md) before modifying features, altering database schemas, changing session/auth handling, editing brand/UI layouts, or adding HR operational workflows.

### Non-negotiable invariants

- **HR-first, zero direct database editing**: All operations (seasons, committees, rubrics, rosters, sessions, attendance, tasks, grading, point overrides, feedback, and leaderboard publishing) must be controllable through the `/hr` web UI.
- **Multi-season scoping**: Every operational database record must be foreign-keyed to a `season_id`. Historical seasons are archived permanently and never mutated.
- **Whitelist-only authentication**: Access is guarded by email presence in `roster_memberships` for the active season. No open signups; members authenticate using credentials stored in `roster_memberships` (zero external email delivery dependencies).
- **Data-layer privacy**: Hidden HR notes (`is_published === false`) must be filtered at the query layer and never returned to members, attendees, committee heads, or the target person across any of their hats. Member-visible Official Warnings (`category === "warning"`, `is_published === true`) are delivered to the warned member.
- **Deterministic score derivation**: Member scores flow through `score_ledger` and are derived deterministically. Historical monthly rankings are permanently locked via `monthly_snapshots`.
- **Next.js 16 + Base UI**: Keep `usePathname()` out of Suspense fallbacks, use `src/proxy.ts` (`proxy` export), and use `@base-ui/react` `render` props / `buttonVariants` instead of `asChild`.
- **Brand discipline**: Use the solid IEEE EMBS CUSB palette (solid `#772583` header bar with flush-left reverse-white `EmbsMark` at `h-9`, no CSS gradients, no ECG waveforms).
- **Verification**: Write failing tests first (red then green), then pass `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
