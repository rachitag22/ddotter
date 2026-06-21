# Backlog

Known issues, improvement opportunities, and things to revisit. Add new items freely.

## Known Issues

- **Bike lane ward is always null** — the DDOT BikeLane ArcGIS source doesn't include a ward field. Ward would need to be derived from geometry (PostGIS point-in-polygon against a ward boundary layer) or cross-referenced against another source.
- **Bike lane descriptions only enrichable if `official_url` exists** — `/api/enrich` scrapes the project URL; lanes without one are skipped and stay description-null indefinitely.
- **Enrichment doesn't retry failed records** — if a URL fetch times out, that record keeps a null description. Re-running `/api/enrich` will retry it, but there's no automatic retry or backoff.
- **No alerting on sync failures** — failures are logged to `sync_log` but nothing notifies maintainers. You have to check the table or the sync response manually.

## LLM / API Limits

- Set `LABEL_CLEAN_LIMIT=-1` and `ENRICH_LIMIT=-1` in Vercel once label cleaning and description quality are validated, to allow full production runs.
- Art installations are excluded from `/api/enrich` — descriptions are assembled from structured fields (artist, medium, location) at sync time and are generally good enough.

## Improvement Opportunities

- **Parallelize sync sources** — currently `syncSource()` calls run sequentially. Wrapping them in `Promise.all` would cut sync time roughly 4×. Tradeoff: harder to attribute which source caused a timeout.
- **Ward derivation from geometry** — use a DC ward boundary GeoJSON and a point-in-polygon check to fill `ward` for bike lanes and other ward-null records at sync time.
- **Rate limiting on `/api/features/:id/feedback`** — no rate limiting currently; a simple per-IP limit would prevent spam before public launch.
- **Feedback comment visibility** — currently only aggregate counts are shown (feedback_count, support_percent). Consider whether to display individual comments publicly or only in a DDOT export.
- **Sync status UI** — no way for maintainers to see last sync time or errors from the frontend. A simple `/admin` or `/status` page reading `sync_log` would help.
- **Map viewport filter** — the list currently shows all features matching the active filters, regardless of what's visible on the map. A bounding-box filter (`?bbox=`) is defined in the API contract but not wired up to the map.
- **Permalink OG tags** — `/features/[id]` pages don't have Open Graph metadata, so shared links won't preview well in social/messaging apps.

## Open Questions

- Should ward be derived from geometry, or is it acceptable to leave bike lanes ward-null?
- What's the DDOT-facing export format: CSV download, dashboard view, or email digest?
- Should negative feedback be displayed publicly or only surfaced in internal exports?
- Is email collection acceptable at launch? What privacy language is needed?
