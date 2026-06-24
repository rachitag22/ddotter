# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # local dev server
pnpm build        # production build (runs next build)
pnpm lint         # ESLint via next lint
npx tsx -e "..."  # run TypeScript snippets without the frontend (tsx is a devDependency)
```

There are no tests. Type-check with `pnpm build` or `tsc --noEmit`.

## What this is

A public advocacy map of DC transportation projects. End users browse bike lanes, capital projects, trails, and public art on a Google Maps Dynamic Map and list, filter by type/ward/status, leave feedback, and share permalinks.

ArcGIS is **only called during sync** — never on page load. The frontend reads exclusively from Supabase.

## Data flow

```
ArcGIS REST APIs → /api/sync → Supabase (features table)
                                        ↓
                   /api/enrich (optional, LLM) → Supabase (description field)
                                        ↓
                   page load → Supabase (read via features_with_feedback view)
```

Sync runs daily via Vercel Cron (`vercel.json`: `0 5 * * *`). Trigger manually:
```bash
curl -X GET "https://ddotter.vercel.app/api/sync" -H "Authorization: Bearer <SYNC_SECRET>"
curl -X GET "https://ddotter.vercel.app/api/enrich?limit=10" -H "Authorization: Bearer <SYNC_SECRET>"
```

## Key source files

| File | Purpose |
|------|---------|
| `src/lib/arcgis.ts` | Fetches and normalizes all 5 ArcGIS sources; merges bike lane segments |
| `src/lib/enrich.ts` | LLM description synthesis + bike lane label cleaning (Claude Haiku) |
| `src/lib/types.ts` | `ProjectRecord`, `SourceType`, `Geometry`, `ProjectFilters`, `BikeSegment` |
| `src/lib/design.ts` | Color tokens, `sourceTypeColor`, `facilityColor`, `mapStyles` |
| `src/app/api/sync/route.ts` | Sync handler: upsert → delete stale records by timestamp |
| `src/app/api/enrich/route.ts` | Enrichment handler: fills null descriptions using LLM |
| `src/app/api/sync-bike-network/route.ts` | Sync handler for `bike_network` table (3 ArcGIS sources) |
| `src/components/AppShell.tsx` | Stable client component; owns filter/project state; prevents Map remounts |
| `src/components/MapView.tsx` | Google Maps render (`@vis.gl/react-google-maps`); `GmPolyline`, `DcGreyOverlay`, `BikeNetworkLayer` |
| `src/components/BikeNetworkLayer.tsx` | Checkbox overlay; lazy-fetches and renders `bike_network` segments |

## ArcGIS sources

| Source type | ArcGIS layer | Notes |
|-------------|-------------|-------|
| `capital_project` | DDOT/PTP FeatureServer/0 | Point geometry |
| `bike_lane` | DDOT/BikeLane FeatureServer/0 | Segments merged by `Project` or `RouteName` into MultiLineString; per-segment metadata stored in `raw._segments` |
| `trail_project` | Transportation_Bikes_Trails MapServer/4 (existing) + /1 (planned) | Both map to same source type; IDs prefixed `trail-existing-` or `trail-planned-` |
| `art_installation` | Cultural_and_Society MapServer/18 | Point geometry |

## Bike lane segment merging

`fetchBikeLanes()` groups raw ArcGIS segments by `Project` (falling back to `RouteName`) and merges them into a single `FeatureRecord` with MultiLineString geometry. Each segment's facility type and label are stored in `raw._segments`:

```typescript
type RawSegment = { facility: string | null; label: string | null; coordinates: [number, number][] }
```

`MapView` renders each segment as its own `<Polyline>` with a facility-specific color. `SegmentList` renders the breakdown in the modal. During sync, Claude Haiku cleans the ALL-CAPS ArcGIS labels into title case (`cleanSegmentLabels` in `enrich.ts`).

## LLM integration (`src/lib/enrich.ts`)

Two distinct LLM operations, both using Claude Haiku (`claude-haiku-4-5-20251001`) via `@ai-sdk/anthropic`:

1. **Label cleaning** (`cleanSegmentLabels`) — called during sync for bike lanes. Batches of 50 labels sent to Claude to convert ALL CAPS ArcGIS street names to readable title case. Fails silently per batch; originals used on error.
2. **Description synthesis** (`enrichRecord`) — called by `/api/enrich`. For `bike_lane`, scrapes `official_url` then summarizes. For `capital_project` and `trail_project`, synthesizes from structured fields (ward, status, cost, etc.).

## Map rendering quirks

`MapView` uses `@vis.gl/react-google-maps` with map ID `13160d4e828befe69b060118` (required for `AdvancedMarker` and Cloud Console map styles).

Overlays (polylines, polygons) are created imperatively via `google.maps.Polyline` / `google.maps.Polygon` inside `useEffect` hooks — the pattern used by `GmPolyline` and `DcGreyOverlay`. Stable mount effect creates, option-update effects call `setOptions()`, cleanup effects call `setMap(null)`.

`AppShell` is the stable client component that owns all data-fetching and filter state. It reads `useSearchParams()` and passes `features`, `filters`, and `selectedId` down as props — the `Map` component never remounts on filter changes.

## Supabase

- **`projects_with_feedback`** view — what the frontend reads; joins `projects` + aggregated feedback counts
- **`bike_network`** table — purpose-built for bike lanes + trails with proper `facility_type` and `status` enums (see below)
- **`sync_log`** table — one row per source per sync run, records `records_seen`, `records_upserted`, `status`, `error_message`
- RLS is enabled; sync writes go through `getSupabaseSyncClient()` which attaches `x-sync-secret` header, verified by `private.sync_request_authorized()` (SHA-256 check against `private.sync_secrets`)
- Stale records are deleted after each successful upsert: `DELETE WHERE source = X AND synced_at < <run_start>`

### `bike_network` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `bike-inv-{OBJECTID}`, `trail-{OBJECTID}`, `planned-trail-{OBJECTID}` |
| `source` | text | `bike_lane_inventory` · `bike_trail` · `planned_trail` |
| `facility_type` | text | `protected` · `dual_protected` · `buffered` · `dual_buffered` · `conventional` · `contraflow` · `sharrow` · `shared_path` · `trail` · `unknown` |
| `status` | text | `existing` · `planned` · `under_construction` · `future` · `complete` · `unknown` |
| `ward` | text | |
| `length_m` | numeric | meters |
| `geometry` | jsonb | GeoJSON LineString or MultiLineString |
| `raw` | jsonb | original ArcGIS attributes |

Synced via `/api/sync-bike-network`. Trigger manually:
```bash
curl -X GET "https://ddotter.vercel.app/api/sync-bike-network" -H "Authorization: Bearer <SYNC_SECRET>"
# Run a single source:
curl -X GET "https://ddotter.vercel.app/api/sync-bike-network?only=bike_lane_inventory" -H "Authorization: Bearer <SYNC_SECRET>"
```

### Migrations (in order)

1. `202606190001_initial_schema.sql` — `features`, `feedback`, `sync_log`, `features_with_feedback` view
2. `202606190002_public_mvp_access.sql` — RLS policies for public reads
3. `202606190003_sync_sources.sql` — adds `bike_lane` source type; `private.sync_secrets` table; `private.sync_request_authorized()` function; RLS for sync writes
4. `20260620222100_allow_sync_delete_stale_features.sql` — grants DELETE to anon for stale-record cleanup
5. `20260622002000_bike_network.sql` — `bike_network` table with facility_type + status enums, RLS, indexes
6. `20260622003000_bike_network_drop_project_source.sql` — drops `bike_lane_project` source; adds `project_id FK → projects(id)`

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes (sync) | Service role key; falls back to anon key |
| `SUPABASE_ANON_KEY` | Yes | Public anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client-side Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client-side anon key |
| `SYNC_SECRET` | Recommended | Bearer token protecting `/api/sync` and `/api/enrich`; also sent as `x-sync-secret` header to Supabase |
| `CRON_SECRET` | Optional | Vercel-injected cron token; either this or `SYNC_SECRET` is checked |
| `ANTHROPIC_API_KEY` | Required for LLM | Gates all Claude calls; `/api/enrich` returns 500 without it |
| `LABEL_CLEAN_LIMIT` | Optional | Max labels cleaned per sync. **Default 10** (safe). Set `-1` for unlimited. |
| `ENRICH_LIMIT` | Optional | Max records enriched per `/api/enrich` call. **Default 10** (safe). Set `-1` for unlimited. |
| `SCRAPE_LIMIT` | Optional | Max projects scraped per `/api/scrape` call. **Default 5** (safe). Set `-1` for unlimited. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key; must have Dynamic Maps enabled |
| `BROWSERBASE_API_KEY` | Optional | Enables `scripts/scrape-browserbase.mjs` for JS-rendered project pages |
| `BROWSERBASE_PROJECT_ID` | Optional | Browserbase project ID (required alongside `BROWSERBASE_API_KEY`) |

All limit vars accept `-1` for unlimited; query params (`?label_limit=N`, `?limit=N`) can lower but not raise the env ceiling.

## Scraping and enrichment

### Run everything (catch-up)
```bash
# Enrich all un-enriched projects
curl -X GET "https://ddotter.vercel.app/api/enrich?limit=-1" -H "Authorization: Bearer <SYNC_SECRET>"

# Scrape all projects with official_url
curl -X GET "https://ddotter.vercel.app/api/scrape?limit=-1&source_type=bike_lane" -H "Authorization: Bearer <SYNC_SECRET>"
curl -X GET "https://ddotter.vercel.app/api/scrape?limit=-1&source_type=capital_project" -H "Authorization: Bearer <SYNC_SECRET>"
curl -X GET "https://ddotter.vercel.app/api/scrape?limit=-1&source_type=trail_project" -H "Authorization: Bearer <SYNC_SECRET>"
```

### Browserbase (JS-rendered pages)

Plain fetch skips pages where the rendered body is < 300 chars of visible text.  Use the
standalone Browserbase script for those:

```bash
# Scrape thin-content bike lanes (requires BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID in .env.local)
pnpm scrape:bb                         # 3 projects (default)
pnpm scrape:bb -- --limit=-1           # all projects
pnpm scrape:bb -- --source=capital_project --limit=10
pnpm scrape:bb -- --id=<project-id> --force
```

The script queries Supabase directly (no Next.js server needed) and upserts results to `project_assets`.

## Page structure

The home page (`src/app/page.tsx`) is a thin server component that renders `<AppShell>` inside a `<Suspense>` boundary. `AppShell` is the stable client component — it reads `useSearchParams()`, owns project-loading state, and renders `MapWrapper` + `BottomDrawer`. Default filters when no params are set: `type=bike_lane`, `status=active,planned`.

`/projects/[id]` is a shareable permalink for a single project.
