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
```

## First Build Notes

ArcGIS should only be called from the sync job. All app reads should come from Supabase through API routes. Run the sync manually once after deployment to seed the database, then rely on the scheduled job.
