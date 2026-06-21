# Architecture

## Overview

```text
ArcGIS REST Feature Services
          │
          │  daily cron (never on page load)
          ▼
GET /api/sync  ─── Claude Haiku (bike lane label cleaning, optional)
          │
          │  upsert + stale-delete per source
          ▼
Supabase Postgres (features, feedback, sync_log)
          │
          │  optional, on-demand
          ▼
GET /api/enrich  ─── Claude Haiku (description synthesis/extraction)
          │
          │  reads via features_with_feedback view
          ▼
Next.js API Routes → React server components + Leaflet
```

ArcGIS is never called from the page-load request path.

## Source Services

| source_type | ArcGIS Endpoint | Geometry |
|---|---|---|
| `capital_project` | DDOT/PTP/FeatureServer/0 | Point |
| `bike_lane` | DDOT/BikeLane/FeatureServer/0 | MultiLineString (segments merged by Project/RouteName) |
| `trail_project` (existing) | Transportation_Bikes_Trails/MapServer/4 | LineString |
| `trail_project` (planned) | Transportation_Bikes_Trails/MapServer/1 | LineString |
| `art_installation` | Cultural_and_Society/MapServer/18 | Point |

## Sync Flow

Vercel Cron (`0 5 * * *`) calls `GET /api/sync`. Can be triggered manually with `Authorization: Bearer <SYNC_SECRET>`.

All four sources run in **parallel** (`Promise.all`):

1. Validate auth (`SYNC_SECRET` / `CRON_SECRET`) and Supabase config.
2. Each adapter fetches paginated GeoJSON from ArcGIS.
3. Records are normalized into canonical `FeatureRecord` shape.
4. For bike lanes: segments are grouped by `Project`/`RouteName` into a single `MultiLineString`. Claude Haiku cleans ALL-CAPS segment labels to title case. Controlled by `LABEL_CLEAN_LIMIT` env var (default 10, `-1` = unlimited).
5. Records upserted by deterministic `id` (`capital-project-{OBJECTID}`, `bike-lane-{slug}`, etc.).
6. Stale records deleted: `DELETE WHERE source_type = X AND synced_at < <run_start>`. This avoids sending thousands of IDs through a NOT IN filter.
7. Each source logged to `sync_log`.

## Bike Lane Segment Merging

ArcGIS stores one row per physical block. `fetchBikeLanes()` groups by `Project` (fallback `RouteName`) and merges into a single record:

- **ID**: `bike-lane-<slug>` where slug = lowercased, non-alphanumeric → `-`
- **Geometry**: `MultiLineString` from all segment coordinates
- **mode**: unique `Facility` values joined (e.g. `"Protected Bike Lane, Bike Lane"`)
- **`raw._segments`**: `[{ facility, label, coordinates }]` array used by the frontend for per-segment colors and street labels

## Enrichment Flow

`GET /api/enrich` fills or replaces `description` for records where `last_enrichment_attempted_at` is null. It sets `last_enrichment_attempted_at` on every attempt, sets `last_enriched_at` when a description is written, and stores the last failure in `enrichment_error`. Controlled by `ENRICH_LIMIT` env var (default 10, `-1` = unlimited). Filter with `?source_type=` and `?limit=`; use `?force=true` to retry already-attempted records.

| source_type | Approach |
|---|---|
| `bike_lane` | Scrape `official_url` (`bikelanes.ddot.dc.gov/pages/[slug]`), LLM extract |
| `capital_project` | LLM synthesize from structured fields: ward, work type, status, ANC, intersection, route, timeline, cost |
| `trail_project` | LLM synthesize from structured fields: class, surface, maintenance, length, ward, year |

Model: `claude-haiku-4-5-20251001` via `@ai-sdk/anthropic` + `generateText`. Use `maxOutputTokens`, not `maxTokens`.

## Read Path

Frontend calls API routes (never Supabase directly):

- `GET /api/features` — filtered list, paginated 1000 rows
- `GET /api/features/:id` — single feature with feedback aggregates
- `GET /api/features.geojson` — GeoJSON FeatureCollection for map

`getFeatures()` in `src/lib/features.ts` reads from the `features_with_feedback` Supabase view; falls back to `src/lib/sample-data.ts` when Supabase is unconfigured.

## Status Normalization

| Source Value Contains | Normalized Status |
|---|---|
| `proposed`, `planned`, `future`, `"0"` | `planned` |
| `construction`, `active`, `pending ntp`, `notice to proceed` | `active` |
| `design`, `planning` | `planned` |
| `complete`, `built`, `existing` | `complete` |
| empty or unmatched | `unknown` |

## Security

- `SUPABASE_ANON_KEY` is used server-side only; never exposed to the client.
- Sync writes use `getSupabaseSyncClient()` which sends `x-sync-secret` header. `private.sync_request_authorized()` validates against a SHA-256 hash stored in `private.sync_secrets`.
- Public reads and feedback inserts are allowed via RLS policies. All other writes require the sync secret.
- `SYNC_SECRET` / `CRON_SECRET` gate `/api/sync` and `/api/enrich` at the HTTP level.
- Feedback validated server-side with Zod (comment 3–1200 chars, valid email if provided).

## Reliability

- ArcGIS failures do not break public pages — data stays in Supabase; sync logs the error.
- Each source in `/api/sync` fails independently; a bad art source does not block capital project sync.
- Partial failures are visible in `sync_log`.
- Local dev falls back to `src/lib/sample-data.ts` when `SUPABASE_URL` is not configured.
