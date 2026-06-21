alter table public.features
  add column if not exists last_enrichment_attempted_at timestamptz,
  add column if not exists last_enriched_at timestamptz,
  add column if not exists enrichment_error text;

create index if not exists features_last_enrichment_attempted_at_idx
  on public.features (last_enrichment_attempted_at)
  where last_enrichment_attempted_at is null;
