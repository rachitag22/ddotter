# Implementation Checklist

## Foundation

- [ ] Scaffold Next.js app.
- [ ] Add TypeScript config.
- [ ] Add lint and format commands.
- [ ] Add environment validation.
- [ ] Add Supabase server client helper.
- [ ] Add shared app types for `Feature`, `Feedback`, and `SyncLog`.

## Database

- [ ] Create Supabase migration for `features`.
- [ ] Create Supabase migration for `feedback`.
- [ ] Create Supabase migration for `sync_log`.
- [ ] Add indexes and constraints.
- [ ] Add local seed or fixture data for UI development.

## Sync

- [ ] Implement ArcGIS request helper.
- [ ] Implement Capital Projects adapter.
- [ ] Implement Trail Projects adapter.
- [ ] Implement Art Installations stub adapter.
- [ ] Implement status normalization.
- [ ] Implement geometry conversion to GeoJSON.
- [ ] Implement upsert logic.
- [ ] Implement sync logging.
- [ ] Protect sync route with `SYNC_SECRET`.

## API

- [ ] Implement `GET /api/features`.
- [ ] Implement `GET /api/features/:id`.
- [ ] Implement `GET /api/features.geojson`.
- [ ] Implement `POST /api/features/:id/feedback`.
- [ ] Implement `GET /api/features/:id/feedback`.
- [ ] Add API validation tests.

## Frontend

- [ ] Build app shell.
- [ ] Build filter controls.
- [ ] Build list view.
- [ ] Build map view.
- [ ] Build project popup.
- [ ] Build project detail page.
- [ ] Build feedback form.
- [ ] Build feedback aggregate display.
- [ ] Add loading, empty, and error states.

## Launch

- [ ] Deploy to Vercel.
- [ ] Configure Supabase environment variables.
- [ ] Run first sync manually.
- [ ] Configure scheduled sync.
- [ ] Verify production map, list, detail, and feedback flows.
- [ ] Document known data gaps.
