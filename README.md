# DDOT Advocacy Map

A public web app for DC transportation advocates to discover active DDOT projects, understand their status and timeline, and submit feedback that can be surfaced to decision-makers.

## Goal

Build a unified, accessible map and list of DDOT projects such as bike lanes, trail work, capital projects, and art installations. The app should make it easier for community members to find projects they care about, see what is happening near them, and leave useful feedback.

## MVP

The MVP is a two-view app:

- Map view with toggleable project layers
- List view with filters for project type, ward, status, and search
- Project detail pages with timeline, description, cost, source metadata, and feedback
- Supabase-backed API so the frontend never depends on live ArcGIS availability
- Scheduled sync from public ArcGIS Feature Services into Postgres

## Stack

- Next.js on Vercel
- Supabase Postgres
- Vercel API routes
- Leaflet or MapLibre GL for the map
- Vercel Cron, or an external cron trigger on free-tier deployments

## Docs

- [Project brief](docs/project-brief.md)
- [MVP plan](docs/mvp-plan.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [API contract](docs/api.md)
- [Implementation checklist](docs/implementation-checklist.md)
- [Open questions](docs/open-questions.md)

## Environment

Copy `.env.example` to `.env.local` when the app scaffold exists.

```bash
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SYNC_SECRET=
CRON_SECRET=
```

## Local Development

```bash
pnpm install
pnpm dev
```

The app renders sample DDOT project data when Supabase environment variables are missing. Once Supabase is configured, API routes read from the database through the server client.

## Supabase

The initial schema lives in `supabase/migrations/202606190001_initial_schema.sql`.

It creates:

- `features`
- `feedback`
- `sync_log`
- `features_with_feedback`

The linked Supabase project is `ddotter` at `https://kbcnqovbzwixdxzpaday.supabase.co`.

The first migration has been applied to project ref `kbcnqovbzwixdxzpaday`. `supabase/seed.sql` contains demo records for local development and first-run verification.

## Vercel

`vercel.json` defines a daily cron trigger for `/api/sync`, which works on Vercel Hobby. Upgrade to Pro or use an external cron trigger for hourly syncs.

The connected Vercel account has a `ddotter` project. Production deploys should set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SYNC_SECRET`
- `CRON_SECRET`, optional; if set, Vercel Cron sends it as a bearer token

## First Build Notes

ArcGIS should only be called from the sync job. All app reads should come from Supabase through API routes. Run the sync manually once after deployment to seed the database, then rely on the scheduled job.
