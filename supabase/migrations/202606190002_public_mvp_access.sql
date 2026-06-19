grant select on public.features to anon, authenticated;
grant select on public.features_with_feedback to anon, authenticated;
grant insert on public.feedback to anon, authenticated;

alter view public.features_with_feedback
  set (security_invoker = false);

create policy "Public can submit feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (
    char_length(trim(comment)) between 3 and 1200
    and exists (
      select 1
      from public.features
      where features.id = feedback.feature_id
    )
  );
