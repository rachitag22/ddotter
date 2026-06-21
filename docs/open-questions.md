# Open Questions

Genuinely undecided questions. Resolved decisions are documented in `architecture.md` and `data-model.md`.

## Data

- Should `ward` be derived from geometry (PostGIS point-in-polygon) when the upstream value is missing? Bike lanes currently have no ward at all.
- Capital project descriptions are LLM-synthesized from structured fields. Is the quality acceptable, or should we invest in scraping `ddot.dc.gov/search`? The PTP layer's own `Description` field is nearly always empty or just a location name.
- Art installations (MapServer/18) have `TITLE`, `ARTIST`, `MEDIUM`, `LOCATION`, `URL`, `YEARINSTALLED` — descriptions are auto-formatted from these. Is the auto-format good enough or should enrich run LLM synthesis on these too?

## Product

- Should public users see raw feedback comments, aggregate support counts only, or selected/moderated comments?
- Should negative feedback (support=false) be shown publicly, or only surfaced in DDOT exports?
- Is email collection acceptable for launch? If so, what privacy language is required?
- What is the first DDOT-facing export: CSV download, admin dashboard, or recurring email digest?

## Technical

- Should geometry move from plain GeoJSON jsonb to PostGIS? Unlocks spatial queries (ward derivation, bbox filter). Current `bbox` filter param is not implemented.
- Rate limiting on `/api/features/:id/feedback` before public launch?
- How should sync failures surface to the operator? Currently only visible in `sync_log` — no alerting.
- `raw._segments` on bike lanes prevents stripping `raw` from list queries. Promote `_segments` to its own column to allow selective projection and reduce list payload size?
