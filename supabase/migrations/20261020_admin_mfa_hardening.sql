-- Hapn admin security hardening: require Supabase MFA (AAL2) for privileged actions.
-- IMPORTANT: First enable/configure MFA for every admin account in Supabase Auth.
-- After applying this migration, admin create/edit/delete, draft access, and poster
-- upload/update/delete operations require a signed-in admin with a verified MFA factor.
-- Public event browsing and the user's own admin-row lookup remain available.

-- Helper: only authenticated sessions with a verified second factor pass.
create or replace function public.is_admin_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1
      from public.admins
      where user_id = (select auth.uid())
        and role = 'admin'
    );
$$;

revoke all on function public.is_admin_mfa() from public;
grant execute on function public.is_admin_mfa() to authenticated;

-- Draft access is privileged; public published-event reads remain unchanged.
drop policy if exists "Admins can read all events" on public.events;
create policy "Admins with MFA can read all events"
  on public.events for select
  to authenticated
  using (public.is_admin_mfa());

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins with MFA can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_admin_mfa());

drop policy if exists "Admins can update events" on public.events;
create policy "Admins with MFA can update events"
  on public.events for update
  to authenticated
  using (public.is_admin_mfa())
  with check (public.is_admin_mfa());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins with MFA can delete events"
  on public.events for delete
  to authenticated
  using (public.is_admin_mfa());

drop policy if exists "Admins can upload event posters" on storage.objects;
create policy "Admins with MFA can upload event posters"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-posters' and public.is_admin_mfa());

drop policy if exists "Admins can update event posters" on storage.objects;
create policy "Admins with MFA can update event posters"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-posters' and public.is_admin_mfa())
  with check (bucket_id = 'event-posters' and public.is_admin_mfa());

drop policy if exists "Admins can delete event posters" on storage.objects;
create policy "Admins with MFA can delete event posters"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-posters' and public.is_admin_mfa());

-- Note: the "Users can read their own admin row" policy is intentionally unchanged
-- so the existing frontend can identify the admin account after sign-in.
