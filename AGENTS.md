<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project context

Read [`docs/PROJECT_INTENT.md`](./docs/PROJECT_INTENT.md) before modifying features, connecting a backend, changing session/auth handling, editing brand/UI layouts, or changing scoring/evaluation models.

### Non-negotiable invariants

- **Read-only frontend boundary**: All page data flows through typed async functions in `src/services/`. Render precomputed scores, ranks, and grades from services; keep formulas, HR admin forms, and sheet logic out of the frontend.
- **Privacy and isolation**: Filter out unpublished leaderboard months, omit member IDs (`displayId`) from public and portal UI, expose only `visibility === "published"` HR feedback, keep attendee views free of member-only metrics, and enforce member/attendee route separation in `src/proxy.ts`.
- **Opaque sessions**: Store only opaque session metadata in the `HttpOnly` `embs_portal_session` cookie (never the raw access key) and use `navigateHard` for auth transitions so Next.js 16 client state never stalls.
- **Next.js 16 + Base UI**: Keep `getServerSession()` and `searchParams` reads inside `<Suspense>` boundaries, keep `usePathname()` out of Suspense fallbacks, use `src/proxy.ts` (`proxy` export), and use `@base-ui/react` `render` props / `buttonVariants` instead of `asChild`.
- **Brand discipline**: Use the solid IEEE EMBS CUSB palette (solid `#772583` header bar with flush-left reverse-white `EmbsMark` at `h-9`, no CSS gradients, no ECG waveforms).
- **Verification**: Write failing tests first (red then green), then pass `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
