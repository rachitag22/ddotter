# Architecture

## Overview

```text
ArcGIS REST Feature Services
          |
          | daily sync only (never on page load)
          v
/api/sync → Supabase Postgres
          |
          | optional, on-demand
          v
/api/enrich (Claude Haiku) → Supabase (description field)
          |
          | all reads via features_with_feedback view
          v
Vercel API Routes → Next.js Frontend
```

ArcGIS is never called from the page-load request path. It is treated as an upstream source copied into Supabase by the sync job.

## Source Services

| source_type | ArcGIS Endpoint | Geometry |
| --- | --- | --- |
| `capital_project` | DDOT/PTP/FeatureServer/0 | Point |
| `bike_lane` | DDOT/BikeLane/FeatureServer/0 | MultiLineString (segments merged by Project/RouteName) |
| `trail_project` (existing) | Transportation_Bikes_Trails/MapServer/4 | LineString |
| `trail_project` (planned) | Transportation_Bikes_Trails/MapServer/1 | LineString |
| `art_installation` | Cultural_and_Society/MapServer/18 | Point |

Bike lane ArcGIS records are one row per physical segment. `fetchBikeLanes()` groups them by `Project` (fallback: `RouteName`) and merges into a single `FeatureRecord` with a MultiLineString geometry. Per-segment metadata (facility type, street label, coordinates) is stored in `raw._segments`.

## Sync Flow

1. Vercel Cron (`0 5 * * *`) calls `GET /api/sync`; or trigger manually with `Authorization: Bearer <SYNC_SECRET>`.
2. Route validates auth and Supabase config.
3. Each source adapter fetches paginated GeoJSON from ArcGIS.
4. Records are normalized into canonical `FeatureRecord` shape.
5. For bike lanes, Claude Haiku cleans ALL-CAPS segment labels to title case (controlled by `LABEL_CLEAN_LIMIT` env var; default 10, `-1` for unlimited).
6. Records are upserted by deterministic `id` (e.g., `capital-project-123`, `bike-lane-<slug>`).
7. Stale records for each source are deleted: `DELETE WHERE source_type = X AND synced_at < <run_start>`.
8. Each source run is recorded in `sync_log`.

## Enrichment Flow (optional, separate from sync)

`POST /api/enrich` fills `description` for records that have a null or empty description, using Claude Haiku:

- `bike_lane`: scrapes `official_url`, then summarizes
- `capital_project`: synthesizes from structured fields (ward, status, cost, location, etc.)
- `trail_project`: synthesizes from structured fields (trail class, surface, maintenance, length, etc.)

Controlled by `ENRICH_LIMIT` env var (default 10, `-1` for unlimited). Can be filtered by `?source_type=` and `?limit=`.

## Runtime Reads

The frontend calls API routes, not Supabase directly for canonical project reads:

- `GET /api/features`
- `GET /api/features/:id`
- `GET /api/features.geojson`

Feedback writes also go through API routes so validation, spam prevention, and future moderation can live server-side.

## Status Normalization

Canonical status values:

- `active`
- `planned`
- `complete`
- `unknown`

Suggested initial mapping:

| Source Value Contains | Normalized Status |
| --- | --- |
| `under construction`, `construction`, `active` | `active` |
| `design`, `planning`, `planned`, `future` | `planned` |
| `complete`, `completed`, `built` | `complete` |
| empty or unmatched | `unknown` |

## Geometry

Store geometry as GeoJSON in `features.geometry`.

- Point projects should become GeoJSON `Point`.
- Trail projects should become GeoJSON `LineString` or `MultiLineString`.
- Preserve full upstream attributes in `features.raw`.

## Security

- `SUPABASE_SERVICE_KEY` is server-only.
- `SYNC_SECRET` is required for `POST /api/sync`.
- Feedback submissions should be validated server-side.
- Email should be optional and not exposed publicly by default.

## Reliability

- ArcGIS failures should not break existing project pages.
- Failed sync runs should be visible in `sync_log`.
- Partial source failures should not prevent successful sources from updating.
