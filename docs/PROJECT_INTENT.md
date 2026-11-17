# Project Intent: IEEE EMBS CUSB Portal

Authoritative record of the original product goals, scope boundaries, visual decisions, and architectural constraints for this repository.

## 1. Product purpose and scope

This repository is the frontend portal for the IEEE EMBS Cairo University Student Branch (CUSB). It serves three audiences:

1. **Public visitors**: Home spotlight of the latest monthly Top 5 and the 12 committee #1 leaders (`/`), Monthly Top 10 overall leaderboard (`/leaderboards`), 12 committee-specific Top 10 leaderboards (`/leaderboards/committees/[slug]`), and previous published months (`/leaderboards/history`, accessed inside Leaderboard navigation rather than the top bar).
2. **Members**: Passwordless access via a single HR-issued access key opening a private dashboard (`/member/*`) showing monthly score breakdowns, overall and committee rank history, session attendance with bonus points, tasks (effort, quality, timeliness, task points), chapter activities, seasonal HR evaluations, and published HR review notes.
3. **Attendees**: Passwordless access via a single access key opening a intentionally simpler dashboard (`/attendee/*`) showing track progress, session attendance, and assignment marks/remarks.

### Deliberate scope boundaries

Keep these out of this frontend unless requirements explicitly change:

- **Read-only portal**: HR editing, admin panels, data entry forms, and scoring tools live outside this app.
- **Precomputed scores only**: Render scores, totals, ranks, and grades returned by services. Keep scoring formulas and weight calculations on the data/backend side.
- **Spreadsheet-agnostic service layer**: UI reads only from typed contracts in `src/types/` and async functions in `src/services/`. Backend or Google Sheets sync logic sits behind the API boundary, never in React components or client bundles.
- **Simplified passwordless entry**: Access keys replace email/password auth and self-registration.
- **Monthly cadence**: Leaderboards are monthly (Top 10 overall and Top 10 per committee), not weekly. No notification system.

## 2. Domain model and privacy rules

Data models in `src/types/` and mock fixtures in `src/data/mock/` align with the branch HR evaluation system while staying decoupled from sheet layout:

- **12 official committees**:
  - Technical (6): AI and Machine Learning, Web Development, Robotics and Automation, Medical Equipment and Planning, R&D, Game Development.
  - Non-Technical (6): Marketing and Content Creation, Graphic Design, Photography, Videography & Editing, Human Resources, Public Relations and Fund Raising, Organizing and Logistics.
- **Monthly scores vs seasonal evaluations**: Keep monthly performance scores (which drive monthly leaderboards) separate from seasonal HR evaluations (rubric categories such as Attendance & Punctuality `/20`, Task Contribution `/25`, Workshops `/5`, Hands-on & Events `/20`, Communication & Teamwork `/10`, Initiative & Ownership `/10`, Leadership `/10` for leaders, bonus points, final score, and grade).
- **Published-only leaderboards**: Draft months (`status !== "published"`) are filtered out in `src/services/leaderboard.service.ts` and never rendered publicly. Committee leaderboards compute trend movement from committee-local `previousCommitteeRank`, not overall rank.
- **Public and portal privacy**:
  - Exclude member IDs (`displayId`) from leaderboard responses and portal chrome.
  - Show only HR feedback entries with `visibility === "published"`. Internal HR flags (such as `HR Warned?`) remain private.
  - Keep attendee views strictly free of member-only concepts (no rankings, monthly score cards, seasonal evaluations, or HR feedback).

## 3. Access-key session contract

- Entry routes: `/access` (shared), `/member/access`, and `/attendee/access` post the key to `POST /api/session`; logout calls `DELETE /api/session`.
- Session cookie (`embs_portal_session`): `HttpOnly`, `SameSite=Lax`, `Secure` in production, 30-day sliding window renewed in `src/proxy.ts`.
- **Opaque session metadata**: The cookie stores `participantId`, `participantType`, `keyVersion`, and expiry metadata. Never store or return the raw bearer access key in cookies, URLs, logs, or client state.
- **Revocation and rotation**: `src/proxy.ts` and `src/lib/session-cookie.ts` validate `keyVersion` against active key state so revoking or rotating a key invalidates existing sessions immediately.
- **Strict role isolation**: Member sessions are redirected away from `/attendee/*`; attendee sessions are redirected away from `/member/*`.
- **Hard navigation on auth transitions**: `AccessKeyForm` and `LogoutButton` use `navigateHard` (`window.location.assign` in `src/lib/navigation.ts`) plus `pageshow` state resets so sign-out/sign-in roundtrips under Next.js 16 never leave submit buttons stuck in a pending or verified state.

## 4. Visual identity and UX rules

Grounded in the official IEEE EMBS Visual Identity Guidelines and CUSB branding:

- **Official solid palette** (`src/app/globals.css`):
  - EMBS Purple `#772583`, Deep Purple `#5a1b63`, Soft Lavender `#f5edf7`
  - IEEE Blue `#00629b`, Deep Navy `#002855`, Pale Blue `#ebf3f8`
  - EMBS Deep Teal `#007377`, Bright Teal `#009ca6`
  - EMBS Green `#78be20`, CUBES Gold `#ffc627`
- **Solid colors, clean visuals**: Use solid brand fills rather than CSS gradients. Keep graphics clean and functional (no decorative ECG waveform traces).
- **Locked header geometry**: Every page shares a solid `#772583` top bar (`h-16 max-w-6xl px-4 sm:px-6`) with the reverse-white official logo (`EmbsMark` at `h-9`, sourced from `public/ieee-embs-logo.png`) pinned flush-left so logo size and position stay identical across routes and breakpoints.
- **Login navigation**: Access screens use minimal copy and link back to Home (`/`), not `/leaderboards`.
- **Home committee leaders**: Open, card-free crowned user emblems (`CommitteeLeadersShowcase`) arranged 6x2 on desktop (`lg:grid-cols-6`) with fixed-height crown (`h-7`), score (`h-5`), and committee (`min-h-8`) slots so every row aligns on the same horizontal baselines.
- **Mobile-first layout**: 44px minimum touch targets, `16px` mobile inputs to avoid iOS zoom, fixed bottom navigation bar in authenticated portals with safe-area padding, compact above-the-fold leaderboard controls, and stacked mobile row views (`md:hidden`) for data tables.
- **Favicons**: `src/app/icon.png`, `src/app/favicon.ico`, and `src/app/apple-icon.png` render the white IEEE EMBS DNA helix inside a solid `#772583` rounded-square badge (full-bleed square for iOS) so the icon remains legible on both light and dark browser tabs.

## 5. Next.js 16 and UI stack constraints

- **Cache Components (`cacheComponents: true`)**: Wrap any Server Component that calls `getServerSession()` (which invokes `connection()`, `cookies()`, and `new Date()`) or awaits `searchParams` inside a `<Suspense>` boundary.
- **Suspense fallbacks**: Never render a Client Component that calls `usePathname()` inside a `<Suspense fallback={...}>` (use static `PublicHeaderFallback`).
- **Proxy convention**: Request interception lives in `src/proxy.ts` exporting `proxy(request: NextRequest)` (Next.js 16 replacement for `middleware.ts`).
- **shadcn/ui v4 (`@base-ui/react`)**: Use `render={<Button ... />}` on triggers and `buttonVariants(...)` on `<Link>`; `asChild` does not exist in Base UI primitives.

## 6. Swapping mock services for a real backend

When connecting a production backend:

1. Preserve the TypeScript contracts in `src/types/` and function signatures in `src/services/` (`leaderboard.service.ts`, `member.service.ts`, `attendee.service.ts`, `session.service.ts`).
2. Replace `src/lib/session-cookie.ts` encoding with cryptographically signed tokens or server-backed session IDs (keep `HttpOnly`, `SameSite=Lax`, `Secure`, sliding expiry, and `keyVersion` revocation checks).
3. Remove the collapsed demo-key helper from `src/components/auth/access-key-form.tsx` and delete `src/data/mock/` once live endpoints are wired.
4. Keep test coverage through real wired entry points (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`).
