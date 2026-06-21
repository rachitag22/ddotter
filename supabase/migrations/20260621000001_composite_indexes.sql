-- Composite indexes for the two most common filter combinations:
-- source_type + status and source_type + ward. Individual single-column
-- indexes exist but Postgres bitmap-ANDs them; a composite is faster when
-- both columns are always present in the filter.
create index if not exists features_type_status_idx on public.features (source_type, status);
create index if not exists features_type_ward_idx on public.features (source_type, ward);
