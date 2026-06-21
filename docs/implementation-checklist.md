# Implementation Status

MVP is shipped and live on Vercel. This is the current state, not a to-do list.

## Done

### Infrastructure
- [x] Next.js 16 (App Router), TypeScript, Vercel deployment
- [x] Supabase schema: `features`, `feedback`, `sync_log`, `features_with_feedback` view
- [x] RLS: public read on features, public feedback insert, sync-secret-gated write/delete
- [x] `private.sync_secrets` table + `sync_request_authorized()` function
- [x] Vercel cron: daily sync at `0 5 * * *`
- [x] Sample data fallback for local dev without Supabase credentials
- [x] Composite DB indexes on `(source_type, status)` and `(source_type, ward)`

### Sync (`/api/sync`)
- [x] Capital projects adapter (DDOT/PTP/FeatureServer/0)
- [x] Bike lane adapter with segment merging into MultiLineString (grouped by Project/RouteName)
- [x] Trail adapter: existing (MapServer/4) + planned (MapServer/1)
- [x] Art installation adapter (Cultural_and_Society/MapServer/18)
- [x] Status normalization to `active` / `planned` / `complete` / `unknown`
- [x] Deterministic IDs per source type
- [x] Upsert + stale-record delete by `synced_at` timestamp
- [x] Per-source error isolation; all sources logged to `sync_log`
- [x] All 4 sources run in parallel (`Promise.all`)
- [x] Claude Haiku label cleaning for bike lane segment labels (`LABEL_CLEAN_LIMIT`)
- [x] Cache invalidation via `revalidateTag("features")` after each successful sync

### Enrich (`/api/enrich`)
- [x] `bike_lane`: scrape `official_url` → LLM extract
- [x] `capital_project`: LLM synthesize from structured fields
- [x] `trail_project`: LLM synthesize from structured fields
- [x] Concurrent processing (batches of 10)
- [x] `?source_type=` and `?limit=` query params; `ENRICH_LIMIT` env var

### Read API
- [x] `GET /api/features` — filters: `type`, `ward`, `status` (comma-separated), `q`
- [x] `GET /api/features/:id`
- [x] `GET /api/features.geojson`
- [x] `GET /api/features/:id/feedback`
- [x] `POST /api/features/:id/feedback` (Zod validation)
- [x] `features_with_feedback` view: `feedback_count`, `support_count`, `support_percent`
- [x] Next.js `unstable_cache` on `getFeatures()` (TTL 300s, tag `"features"`)

### Frontend
- [x] Leaflet map with CartoDB Positron tiles
- [x] Point (CircleMarker) and line (Polyline) rendering per source type
- [x] Per-segment facility colors and street labels for bike lanes
- [x] Feature selection with URL state (`?selected=`)
- [x] Filter state in URL params (type, ward, status, q)
- [x] BottomDrawer list with inline project details
- [x] Feature modal (status, ward, mode, description, timeline, cost, feedback form, DDOT link)
- [x] SegmentList component for bike lane segment breakdown
- [x] `/features/:id` detail page
- [x] Feedback form (support/oppose + comment + optional name/email)
- [x] Vercel Web Analytics

## Remaining

### Blocking first real data run
- [ ] Apply pending Supabase migrations to production (`20260620222100`, `20260621000001`)
- [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables
- [ ] Trigger `/api/sync` manually after migrations land
- [ ] Trigger `/api/enrich` to backfill descriptions (start with `?source_type=bike_lane`)

### Data quality
- [ ] Evaluate capital_project LLM synthesis quality after first enrich run
- [ ] Decide on ward derivation from geometry for bike lanes

### Reliability
- [ ] Sync failure alerting (currently visible in `sync_log` only)
- [ ] Rate limiting on feedback submission

### Deferred
- [ ] `bbox` map bounds filter on `GET /api/features`
- [ ] DDOT-facing export (CSV or dashboard)
- [ ] PostGIS migration for spatial queries
- [ ] Promote `raw._segments` to its own column (unblocks stripping `raw` from list queries)
- [ ] Moderation queue for feedback comments
