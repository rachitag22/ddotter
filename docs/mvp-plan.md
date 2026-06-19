# MVP Plan

## MVP Definition

Ship a public Next.js app backed by Supabase that lets users browse DDOT projects on a map and in a list, view project details, and submit feedback.

## Phase 0: Project Setup

- Create Next.js app structure.
- Add TypeScript, linting, formatting, and basic test tooling.
- Configure Supabase client helpers.
- Add environment variable validation.
- Pick map library: Leaflet for fastest MVP, MapLibre GL if vector styling becomes important.

## Phase 1: Database And Sync

- Create Supabase tables:
  - `features`
  - `feedback`
  - `sync_log`
- Add indexes for source type, ward, status, synced time, and feedback feature id.
- Implement source adapters:
  - `capitalProjects`
  - `trailProjects`
  - `artInstallations`, returning an empty array until the endpoint is confirmed
- Normalize ArcGIS responses into canonical feature records.
- Implement deterministic IDs:
  - `capital-project-{OBJECTID}`
  - `trail-project-{OBJECTID}`
  - `art-installation-{OBJECTID}`
- Implement `POST /api/sync`, protected by `SYNC_SECRET`.
- Add a first manual sync workflow.

## Phase 2: Read API

- Implement `GET /api/features`.
- Support filters:
  - `type`
  - `ward`
  - `status`
  - `q`
  - `bbox`
- Implement `GET /api/features/:id`.
- Implement `GET /api/features.geojson` for map rendering.
- Include feedback aggregates in feature responses:
  - `feedback_count`
  - `support_count`
  - `support_percent`

## Phase 3: Feedback

- Implement `POST /api/features/:id/feedback`.
- Implement `GET /api/features/:id/feedback`.
- Validate feedback payloads.
- Store optional name and email.
- Add basic abuse protections:
  - maximum comment length
  - server-side validation
  - optional rate limiting before public launch
- Decide whether public project pages show raw comments, aggregate counts only, or both.

## Phase 4: Frontend

- Build shared project filter state.
- Build map view:
  - type toggles
  - color-coded layers
  - point and line geometry support
  - popups with feedback CTA
- Build list view:
  - cards
  - filters
  - sort by ward and timeline
- Build project detail view:
  - status
  - ward
  - mode
  - description
  - timeline
  - cost
  - official source link when available
  - feedback form
  - feedback aggregate
- Add empty, loading, and error states.

## Phase 5: Deployment

- Deploy to Vercel.
- Add Supabase environment variables.
- Run first sync manually.
- Configure cron:
  - hourly with Vercel Pro
  - daily or external cron on free tier
- Verify all public routes and API routes in production.

## MVP Acceptance Criteria

- A public user can browse all synced features in map and list views.
- Filters work consistently across both views.
- Project detail pages are shareable by URL.
- Feedback can be submitted and counted.
- Sync can be run manually and logs success or failure.
- App reads continue to work if ArcGIS is unavailable.

## Suggested First Sprint

1. Scaffold Next.js app.
2. Create Supabase schema and seed script.
3. Implement capital projects sync.
4. Implement trails sync.
5. Build minimal features API.
6. Render a basic list view from the DB.
7. Add map rendering after the API shape is stable.
