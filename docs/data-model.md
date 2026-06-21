# Data Model

## `features`

Canonical record for every project, trail, and art installation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Deterministic source id, such as `capital-project-123` |
| `source_type` | text | `capital_project`, `bike_lane`, `trail_project`, `art_installation` |
| `source_id` | text | Upstream object id or stable upstream id |
| `name` | text | Public display name |
| `status` | text | `active`, `planned`, `complete`, `unknown` |
| `ward` | text nullable | Ward value when available |
| `mode` | text nullable | Bike, trail, pedestrian, art, safety, etc. |
| `description` | text nullable | Public summary |
| `timeline_start` | date nullable | Parsed when available |
| `timeline_end` | date nullable | Parsed when available |
| `cost` | numeric nullable | Cost estimate when available |
| `official_url` | text nullable | DDOT or source page when available |
| `geometry` | jsonb not null | GeoJSON geometry |
| `raw` | jsonb not null | Full upstream attributes |
| `synced_at` | timestamptz not null | Last successful sync timestamp |

Suggested constraints:

```sql
alter table features
  add constraint features_status_check
  check (status in ('active', 'planned', 'complete', 'unknown'));

alter table features
  add constraint features_source_type_check
  check (source_type in ('capital_project', 'bike_lane', 'trail_project', 'art_installation'));
```

Suggested indexes:

```sql
create index features_source_type_idx on features (source_type);
create index features_status_idx on features (status);
create index features_ward_idx on features (ward);
create index features_synced_at_idx on features (synced_at desc);
create index features_raw_gin_idx on features using gin (raw);
```

## `feedback`

Community submissions tied to a feature.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Default `gen_random_uuid()` |
| `feature_id` | text references `features(id)` | Target project |
| `support` | boolean not null | Supports or does not support project |
| `comment` | text not null | Free-text feedback |
| `name` | text nullable | Optional public or DDOT-facing name |
| `email` | text nullable | Optional DDOT follow-up email; do not expose publicly |
| `created_at` | timestamptz not null | Default `now()` |

Suggested indexes:

```sql
create index feedback_feature_id_idx on feedback (feature_id);
create index feedback_created_at_idx on feedback (created_at desc);
```

## `sync_log`

Tracks each sync run per source.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Default `gen_random_uuid()` |
| `source_type` | text not null | Source that ran |
| `status` | text not null | `success` or `error` |
| `records_seen` | integer not null default 0 | Raw upstream records |
| `records_upserted` | integer not null default 0 | Saved records |
| `error_message` | text nullable | Error summary |
| `started_at` | timestamptz not null | Start timestamp |
| `finished_at` | timestamptz not null | End timestamp |

Suggested constraints:

```sql
alter table sync_log
  add constraint sync_log_status_check
  check (status in ('success', 'error'));
```
