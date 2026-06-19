# Architecture

## Overview

```text
ArcGIS REST Feature Services
          |
          | hourly sync only
          v
Supabase Postgres
          |
          | all reads
          v
Vercel API Routes
          |
          v
Next.js Frontend
```

The app does not call ArcGIS from the request path. ArcGIS is treated as an upstream source that is periodically copied into Supabase.

## Source Services

| Source | Endpoint | Geometry | MVP Status |
| --- | --- | --- | --- |
| Capital Projects | `https://maps2.dcgis.dc.gov/dcgis/rest/services/DDOT/PTP/FeatureServer/0` | Points | Required |
| Trail Projects | `https://maps2.dcgis.dc.gov/dcgis/rest/services/DDOT/Trails/FeatureServer/0` | Polylines | Required |
| Art Installations | TBD, likely `opendata.dc.gov` | Points | Stubbed |

## Sync Flow

1. Cron calls `POST /api/sync`.
2. Route validates `SYNC_SECRET`.
3. Each source adapter fetches from ArcGIS.
4. Source records are normalized into canonical `features` records.
5. Records are upserted by deterministic `id`.
6. Each source run is recorded in `sync_log`.

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
