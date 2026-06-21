# Data Model

## `features`

Canonical record for every project, trail, and art installation.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | Deterministic: `capital-project-{OBJECTID}`, `bike-lane-{slug}`, `trail-existing-{OBJECTID}`, `trail-planned-{OBJECTID}`, `art-installation-{OBJECTID}` |
| `source_type` | text | `capital_project`, `bike_lane`, `trail_project`, `art_installation` |
| `source_id` | text | Upstream ArcGIS OBJECTID |
| `name` | text | Public display name |
| `status` | text | `active`, `planned`, `complete`, `unknown` |
| `ward` | text nullable | Ward when available from upstream |
| `mode` | text nullable | Work type or facility type (e.g. `"Protected Bike Lane, Bike Lane"`) |
| `description` | text nullable | Public summary; backfilled by `/api/enrich` |
| `timeline_start` | date nullable | Parsed from upstream when available |
| `timeline_end` | date nullable | Parsed from upstream when available |
| `cost` | numeric nullable | Cost estimate in dollars |
| `official_url` | text nullable | Source page (populated for bike lanes) |
| `geometry` | jsonb not null | GeoJSON geometry (Point, LineString, or MultiLineString) |
| `raw` | jsonb not null | Full upstream ArcGIS attributes. Bike lanes store `_segments: [{facility, label, coordinates}]` here — used by the SegmentList component. |
| `synced_at` | timestamptz not null | Set to `now()` on each upsert; used to detect and delete stale records |

### Constraints (applied)

```sql
check (status in ('active', 'planned', 'complete', 'unknown'))
check (source_type in ('capital_project', 'bike_lane', 'trail_project', 'art_installation'))
```

### Indexes (applied)

```sql
-- single-column
features_source_type_idx  on (source_type)
features_status_idx       on (status)
features_ward_idx         on (ward)
features_synced_at_idx    on (synced_at desc)
features_raw_gin_idx      using gin (raw)

-- composite (common filter combinations)
features_type_status_idx  on (source_type, status)
features_type_ward_idx    on (source_type, ward)
```

## `features_with_feedback` (view)

Read surface for all API routes. Joins `features` with aggregated feedback counts:

- `feedback_count` — total submissions
- `support_count` — submissions where `support = true`
- `support_percent` — rounded percentage

`security_invoker = false` so anon callers see the view through the view owner's grants.

## `feedback`

Community submissions tied to a feature.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `feature_id` | text → `features(id)` | ON DELETE CASCADE |
| `support` | boolean not null | True = supports project |
| `comment` | text not null | 3–1200 chars (enforced server-side by Zod + RLS check) |
| `name` | text nullable | Optional display name |
| `email` | text nullable | Optional DDOT contact; never exposed publicly |
| `created_at` | timestamptz not null | `now()` |

### Indexes (applied)

```sql
feedback_feature_id_idx  on (feature_id)
feedback_created_at_idx  on (created_at desc)
```

## `sync_log`

One row per source per sync run.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `source_type` | text not null | `capital_project`, `bike_lane`, etc. |
| `status` | text not null | `success` or `error` |
| `records_seen` | integer | Raw upstream count |
| `records_upserted` | integer | Saved to DB |
| `error_message` | text nullable | Set on error |
| `started_at` | timestamptz not null | |
| `finished_at` | timestamptz not null | |

## `private.sync_secrets`

| Column | Type | Notes |
|---|---|---|
| `key` | text PK | e.g. `arcgis_sync` |
| `secret_hash` | text | SHA-256 hex of the secret |
| `updated_at` | timestamptz | |

`private.sync_request_authorized()` checks the `x-sync-secret` header against the stored hash. Used in RLS policies for insert, update, and delete on `features` and insert on `sync_log`.

## Migration History

| File | What it does |
|---|---|
| `202606190001_initial_schema.sql` | Tables, RLS, `features_with_feedback` view |
| `202606190002_public_mvp_access.sql` | Grants to anon/authenticated, feedback insert policy |
| `202606190003_sync_sources.sql` | Adds `bike_lane` to source_type constraint; `private.sync_secrets` + auth function; sync write policies |
| `20260620222100_allow_sync_delete_stale_features.sql` | Grants `delete` on features to anon; adds delete RLS policy for sync |
| `20260621000001_composite_indexes.sql` | Composite indexes on `(source_type, status)` and `(source_type, ward)` |
