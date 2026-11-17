# IEEE EMBS CUSB Portal

Frontend portal for the IEEE Engineering in Medicine and Biology Society (EMBS) Cairo University Student Branch. It provides public monthly leaderboards alongside private, passwordless dashboards for branch members and event/track attendees.

## Quick start

Requires Node.js 20+ and `pnpm` (`pnpm@12.16.1`).

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start Next.js 16 development server |
| `pnpm build` | Production build and type verification |
| `pnpm test` | Run Vitest + React Testing Library suite |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run `tsc --noEmit` |

## Routes

- **Public**: `/` (Home and Committee Leaders), `/leaderboards` (Monthly Top 10), `/leaderboards/committees/[slug]` (12 committee boards), `/leaderboards/history` (previous published months).
- **Access**: `/access`, `/member/access`, `/attendee/access`.
- **Member portal**: `/member`, `/member/performance`, `/member/attendance`, `/member/tasks`, `/member/activities`, `/member/evaluations`, `/member/feedback`.
- **Attendee portal**: `/attendee`, `/attendee/attendance`, `/attendee/assignments`.

## Prototype demo access keys

The current prototype runs on typed mock services in `src/services/` with simulated `HttpOnly` cookie sessions (`POST /api/session` and `DELETE /api/session`). Use any of these keys on `/access`:

| Access key | Role | Behavior |
| --- | --- | --- |
| `EMBS-MEM-2026-SALMA` | Member (AI & ML Head) | Opens `/member` |
| `EMBS-MEM-2026-OMAR` | Member (Robotics) | Opens `/member` |
| `EMBS-MEM-2026-NOUR` | Member (Graphic Design) | Opens `/member` |
| `EMBS-ATT-2026-MARIAM` | Attendee | Opens `/attendee` |
| `EMBS-ATT-2026-YOUSSEF` | Attendee | Opens `/attendee` |
| `EMBS-MEM-2026-REVOKED` | Revoked member key | Rejected with error state |

## Architecture and project intent

All UI components read through `src/services/` so a future backend API can replace the mock data layer without changing page components. See [`AGENTS.md`](./AGENTS.md) and [`docs/PROJECT_INTENT.md`](./docs/PROJECT_INTENT.md) for the full design decisions, product boundaries, visual identity rules, and Next.js 16 conventions.
