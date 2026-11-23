# Production Launch & Database Transfer Runbook

This runbook explains how to:
1. Keep your current Neon testing/showcase database safe while moving a local copy onto Docker Postgres so you can keep testing locally.
2. Provision and initialize a clean production PostgreSQL database with all 12 official IEEE EMBS CUSB committees, 3 tracks, default rubrics, and your initial `master_admin` account (zero fake demo data).
3. Upload your real chapter committee roster via CSV or the `/hr/roster` UI.

---

## 1. Preserve your current testing/showcase database

Do this **before** pointing production or overwriting anything on Neon.

### Option A: Copy your exact current Neon testing database into local Docker Postgres

This dumps everything you already entered on Neon into your local `embs_portal` database on `localhost:5432`:

```bash
chmod +x scripts/copy-remote-to-local.sh
./scripts/copy-remote-to-local.sh embs_portal
```

You can also keep a separate branch in Neon Console named `showcase` or `testing` (branched off your current testing branch) if you want a hosted demo URL alongside local Docker.

### Option B: Rebuild a clean demo testing database locally anytime

If you ever want a fresh local demo database populated with sample data:

```bash
pnpm db:local:setup
```

Automated tests (`pnpm test`) always run against a completely separate local database (`embs_portal_test`) and refuse to connect to any remote `neon.tech` URL by default.

---

## 2. Configure production environment variables

Create a brand-new Neon database or Neon project for **production** (separate from your showcase/testing branch).

Set these environment variables on your hosting provider (Vercel, Netlify, etc.) or in a temporary shell session during bootstrap:

| Variable | Requirement | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Required | Pooled Neon connection string (`-pooler` hostname, `?sslmode=require`) |
| `DATABASE_URL_UNPOOLED` | Required | Direct Neon connection string (no `-pooler`, used by `pnpm db:migrate`) |
| `SESSION_SECRET` | Required | At least 32 random characters: `openssl rand -base64 32` |
| `DEFAULT_MEMBER_PASSWORD` | **Leave unset in production** | When unset, every newly added member or password reset gets a unique random temporary password (`EMBS-2026-XXXXXXXX`) instead of a shared cohort password |

Do **not** commit `.env.local` or any production credentials to git.

---

## 3. Run migrations on the fresh production database

Apply all Drizzle SQL migrations (`0000` through `0014`, including `auth_rate_limits`):

```bash
DATABASE_URL_UNPOOLED="postgresql://...direct-prod-url..." \
  pnpm db:migrate
```

`pnpm db:migrate` runs each migration file in its own transaction, so PostgreSQL enum additions (`0001`, `0003`) commit cleanly before partial unique indexes (`0010`) reference them on an empty database.

---

## 4. Bootstrap the production database (zero demo data)

Run `pnpm db:bootstrap` against the production database. This creates:
- One active season (e.g. `2026-2027`)
- The 3 default committee tracks (`Technical`, `Creative`, `Operations`)
- All 12 official IEEE EMBS CUSB committees assigned to their tracks
- The 7 official scoring rubrics
- Your initial real `master_admin` account (`mustChangePassword = true`)
- Zero demo accounts and zero mock leaderboard snapshots

```bash
DATABASE_URL="postgresql://...prod-url..." \
BOOTSTRAP_SEASON_NAME="2026-2027" \
BOOTSTRAP_SEASON_START="2026-09-01" \
BOOTSTRAP_SEASON_END="2027-06-30" \
BOOTSTRAP_MASTER_NAME="Your Full Name" \
BOOTSTRAP_MASTER_EMAIL="your.email@cu.edu.eg" \
  pnpm db:bootstrap
```

If you omit `BOOTSTRAP_MASTER_PASSWORD`, the script generates a random one-time temporary password and prints it once in the terminal. Sign in at `/login` immediately and set your permanent password.

### Optional: Import your full committee roster during bootstrap

You can pass a CSV file path to `BOOTSTRAP_ROSTER_CSV_PATH` during bootstrap, or skip it and import the CSV inside `/hr/roster` after signing in.

CSV format:

```csv
full_name,email,committee_slug,role
Salma Ahmed,salma.ahmed@cu.edu.eg,ai-and-machine-learning,committee_head
Omar Hassan,omar.hassan@cu.edu.eg,web-development,member
Laila Tarek,laila.tarek@cu.edu.eg,ai-and-machine-learning,hr_member
```

Valid `committee_slug` values (all 12 pre-created by `db:bootstrap`):
- Technical: `ai-and-machine-learning`, `web-development`, `robotics-and-automation`, `medical-equipment-and-planning`, `r-and-d`, `game-development`
- Creative: `marketing-and-content-creation`, `graphic-design`, `photography-videography-editing`
- Operations: `human-resources`, `public-relations-and-fund-raising`, `organizing-and-logistics`

Valid `role` values: `master_admin`, `director`, `hr_admin`, `hr_member`, `committee_head`, `member`, `attendee`.

---

## 5. Continue testing locally after production transfer

After deploying production:
1. Point your local `.env.local` `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to local Docker Postgres:
   ```env
   DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/embs_portal
   DATABASE_URL_UNPOOLED=postgresql://postgres:postgrespassword@localhost:5432/embs_portal
   SESSION_SECRET=local-dev-secret-embs-cusb-platform-key-32chars
   ```
2. Your copied showcase data lives in `embs_portal` for manual UI testing (`pnpm dev`).
3. Automated tests (`pnpm test`) run against `embs_portal_test` and can be reset anytime with `pnpm db:test:reset`.
4. Demo seeding (`pnpm db:seed`) refuses to run when `NODE_ENV=production` or against any non-local host unless `ALLOW_REMOTE_SEED=true` is explicitly passed.
