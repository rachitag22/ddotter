# API Contract

## `GET /api/features`

Returns project records from Supabase.

### Query Parameters

| Parameter | Example | Notes |
| --- | --- | --- |
| `type` | `trail_project` | Repeat or comma-separate in implementation if needed |
| `ward` | `5` | Ward filter |
| `status` | `active` | `active`, `planned`, `complete`, `unknown` |
| `q` | `bike` | Search across name and description |
| `bbox` | `-77.12,38.80,-76.90,39.00` | Optional map bounds filter |

### Response

```json
{
  "features": [
    {
      "id": "capital-project-123",
      "source_type": "capital_project",
      "name": "Example Project",
      "status": "planned",
      "ward": "5",
      "mode": "bike",
      "timeline_start": "2026-01-01",
      "timeline_end": "2027-01-01",
      "feedback_count": 12,
      "support_count": 10,
      "support_percent": 83
    }
  ]
}
```

## `GET /api/features/:id`

Returns a single project with geometry, raw metadata, and feedback aggregate.

### Response

```json
{
  "feature": {
    "id": "trail-project-456",
    "source_type": "trail_project",
    "name": "Example Trail",
    "status": "active",
    "ward": "4",
    "mode": "trail",
    "description": "Trail improvement project.",
    "timeline_start": null,
    "timeline_end": null,
    "cost": null,
    "official_url": null,
    "geometry": {
      "type": "LineString",
      "coordinates": []
    },
    "raw": {},
    "feedback_count": 47,
    "support_count": 44,
    "support_percent": 94
  }
}
```

## `GET /api/features.geojson`

Returns a GeoJSON `FeatureCollection` for the map.

### Response

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "capital-project-123",
      "geometry": {
        "type": "Point",
        "coordinates": [-77.03, 38.90]
      },
      "properties": {
        "name": "Example Project",
        "source_type": "capital_project",
        "status": "planned",
        "ward": "5",
        "feedback_count": 12,
        "support_percent": 83
      }
    }
  ]
}
```

## `POST /api/sync`

Triggers ArcGIS-to-Supabase sync. Protected by `SYNC_SECRET`.

### Request

```http
POST /api/sync
Authorization: Bearer <SYNC_SECRET>
```

### Response

```json
{
  "ok": true,
  "sources": [
    {
      "source_type": "capital_project",
      "status": "success",
      "records_seen": 100,
      "records_upserted": 100
    }
  ]
}
```

## `POST /api/features/:id/feedback`

Submits advocate feedback.

### Request

```json
{
  "support": true,
  "comment": "Please prioritize this project.",
  "name": "Optional Name",
  "email": "optional@example.com"
}
```

### Validation

- `support` is required and boolean.
- `comment` is required, trimmed, and length-limited.
- `name` is optional and length-limited.
- `email` is optional and must be valid when present.

## `GET /api/features/:id/feedback`

Returns feedback for a project. For the public MVP, consider returning aggregate data by default and raw comments only when explicitly needed.

### Public Aggregate Response

```json
{
  "feature_id": "capital-project-123",
  "feedback_count": 47,
  "support_count": 44,
  "support_percent": 94
}
```
