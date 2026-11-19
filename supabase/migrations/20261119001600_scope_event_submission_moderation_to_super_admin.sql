-- Restrict event-submission moderation to active platform Super Admins.
-- Legacy admins rows are College Admins after the multi-college migration and
-- must not grant platform-wide access to submissions from every college.
begin;

drop policy if exists "Admins can review submissions" on public.event_submissions;

create policy "Super admins review event submissions"
  on public.event_submissions
  for all
  to authenticated
  using (
    public.is_real_campus_user()
    and public.is_super_admin()
  )
  with check (
    public.is_real_campus_user()
    and public.is_super_admin()
  );

commit;
