# Open Questions

## Data

- What is the correct public source for art installations?
- Which Capital Projects fields should map to name, description, ward, cost, timeline, and official URL?
- Which Trails fields should map to name, status, ward, and timeline?
- Are there project pages or DDOT references that should be linked from each feature?
- Should ward be derived from geometry when the upstream value is missing?

## Product

- Should public users see raw comments, aggregate support only, or selected moderated comments?
- Should negative feedback be displayed publicly or only included in DDOT exports?
- Is email collection acceptable for launch, and what privacy language is needed?
- Should feedback support be binary, a thumbs-up only, or a richer sentiment field?
- What is the first DDOT-facing export: CSV, dashboard, or recurring email digest?

## Technical

- Leaflet or MapLibre GL?
- Should geometry stay as plain GeoJSON jsonb, or should the app use PostGIS?
- Should the MVP implement rate limiting before public launch?
- Should ArcGIS sync delete missing records, mark them inactive, or leave them untouched?
- How should partial sync failures be reported to maintainers?
