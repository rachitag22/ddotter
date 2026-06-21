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

A public advocacy map of DC transportation projects. End users browse bike lanes, capital projects, trails, and public art on a Leaflet map and list, filter by type/ward/status, leave feedback, and share permalinks.

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
| `src/lib/types.ts` | `FeatureRecord`, `SourceType`, `Geometry`, `FeatureFilters` |
| `src/lib/features.ts` | `getFeatures()` / `getFeature()` — reads from `features_with_feedback` view; falls back to `src/lib/sample-data.ts` when Supabase is unconfigured |
| `src/lib/design.ts` | Color tokens and `sourceTypeColor` / `sourceTypeLabel` maps |
| `src/app/api/sync/route.ts` | Sync handler: upsert → delete stale records by timestamp |
| `src/app/api/enrich/route.ts` | Enrichment handler: fills null descriptions using LLM |
| `src/components/MapView.tsx` | Leaflet render (client component) |

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

`MapContainer` uses `preferCanvas={true}`. In canvas mode, react-leaflet does **not** flush prop changes in place for `CircleMarker`. Fix: key `CircleMarker` and non-segment `Polyline` on `isSelected` (`key={\`${feature.id}-${isSelected}\`}`) to force remount on selection change.

All filter state lives in URL search params. `MapView` reads `useSearchParams()` and appends `selected=<id>` without dropping existing params when a marker is clicked.

## Supabase

- **`features_with_feedback`** view — what the frontend reads; joins `features` + aggregated feedback counts
- **`sync_log`** table — one row per source per sync run, records `records_seen`, `records_upserted`, `status`, `error_message`
- RLS is enabled; sync writes go through `getSupabaseSyncClient()` which attaches `x-sync-secret` header, verified by `private.sync_request_authorized()` (SHA-256 check against `private.sync_secrets`)
- Stale records are deleted after each successful upsert: `DELETE WHERE source_type = X AND synced_at < <run_start>`

### Migrations (in order)

1. `202606190001_initial_schema.sql` — `features`, `feedback`, `sync_log`, `features_with_feedback` view
2. `202606190002_public_mvp_access.sql` — RLS policies for public reads
3. `202606190003_sync_sources.sql` — adds `bike_lane` source type; `private.sync_secrets` table; `private.sync_request_authorized()` function; RLS for sync writes
4. `20260620222100_allow_sync_delete_stale_features.sql` — grants DELETE to anon for stale-record cleanup

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

Both limit vars accept `-1` for unlimited; query params (`?label_limit=N`, `?limit=N`) can lower but not raise the env ceiling.

## Page structure

The home page (`src/app/page.tsx`) is a server component that reads filters from URL params, fetches features, then renders `MapWrapper` (client boundary) + `BottomDrawer` (list/modal panel). Default filters when no params are set: `type=bike_lane`, `status=active,planned`.

`/features/[id]` is a shareable permalink for a single project.
