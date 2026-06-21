grant delete on public.features to anon;

drop policy if exists "Secret sync can delete stale features" on public.features;

create policy "Secret sync can delete stale features"
  on public.features for delete
  to anon
  using (private.sync_request_authorized());
