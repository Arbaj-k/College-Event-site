-- Multi-college Hapn platform. Apply after the existing base schema and event end-date migrations.
begin;

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 160),
  logo_url text,
  website_url text check (website_url is null or website_url ~* '^https://'),
  description text check (description is null or char_length(description) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists colleges_name_idx on public.colleges (lower(name));

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('super_admin','college_admin')),
  college_id uuid references public.colleges(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_college_role_check check (
    (role = 'super_admin' and college_id is null) or
    (role = 'college_admin' and college_id is not null)
  )
);
create index if not exists profiles_college_role_idx on public.profiles (college_id, role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  college_id uuid not null references public.colleges(id) on delete cascade,
  invited_by uuid not null references public.profiles(user_id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists admin_invitations_college_status_idx on public.admin_invitations (college_id, status, created_at desc);
create unique index if not exists admin_invitation_one_pending_email_idx
  on public.admin_invitations (lower(email)) where status = 'pending';

alter table public.events add column if not exists college_id uuid references public.colleges(id) on delete set null;
create index if not exists events_college_date_idx on public.events (college_id, "date" desc);
create index if not exists events_public_college_date_idx on public.events (is_published, college_id, "date");

-- Deliberately minimal retention: no event descriptions, links, posters, venue, analytics or metadata.
create table if not exists public.event_archive (
  id uuid primary key default gen_random_uuid(),
  event_title text not null,
  college_name text not null,
  event_date date,
  archived_at timestamptz not null default now()
);
create index if not exists event_archive_date_idx on public.event_archive (archived_at desc);
create index if not exists event_archive_college_idx on public.event_archive (college_name);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'super_admin' and p.is_active = true
  );
$$;

create or replace function public.current_college_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.college_id from public.profiles p
  join public.colleges c on c.id = p.college_id and c.is_active = true
  where p.user_id = (select auth.uid())
    and p.role = 'college_admin' and p.is_active = true
  limit 1;
$$;

create or replace function public.is_college_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.colleges c on c.id = p.college_id and c.is_active = true
    where p.user_id = (select auth.uid())
      and p.role = 'college_admin' and p.college_id is not null and p.is_active = true
  );
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.current_college_id() from public;
revoke all on function public.is_college_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_college_id() to authenticated;
grant execute on function public.is_college_admin() to authenticated;

alter table public.colleges enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.event_archive enable row level security;

grant select on public.colleges to anon, authenticated;
grant insert, update, delete on public.colleges to authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.admin_invitations to authenticated;
grant select, insert, update, delete on public.event_archive to authenticated;
grant select on public.event_archive to anon;

drop policy if exists "Public can read active colleges" on public.colleges;
create policy "Public can read active colleges" on public.colleges for select to anon, authenticated using (is_active = true);
drop policy if exists "Super admins manage colleges" on public.colleges;
create policy "Super admins manage colleges" on public.colleges for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "College admins read own college" on public.colleges;
create policy "College admins read own college" on public.colleges for select to authenticated using (id = public.current_college_id());

drop policy if exists "Profiles self or super admin read" on public.profiles;
create policy "Profiles self or super admin read" on public.profiles for select to authenticated using (user_id = (select auth.uid()) or public.is_super_admin());
drop policy if exists "Super admins manage profiles" on public.profiles;
create policy "Super admins manage profiles" on public.profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Super admins manage invitations" on public.admin_invitations;
create policy "Super admins manage invitations" on public.admin_invitations for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Public can read archived event summaries" on public.event_archive;
create policy "Public can read archived event summaries" on public.event_archive for select to anon, authenticated using (true);
drop policy if exists "Super admins manage archive" on public.event_archive;
create policy "Super admins manage archive" on public.event_archive for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Remove legacy global-admin event policies: they would otherwise bypass tenant isolation.
drop policy if exists "Public can read published events" on public.events;
drop policy if exists "Admins can read all events" on public.events;
drop policy if exists "Admins can insert events" on public.events;
drop policy if exists "Admins can update events" on public.events;
drop policy if exists "Admins can delete events" on public.events;
drop policy if exists "Public can read published events only" on public.events;
drop policy if exists "Admins can manage events" on public.events;

create policy "Public read published events" on public.events for select to anon using (is_published = true);
create policy "Super admins read all events" on public.events for select to authenticated using (public.is_super_admin());
create policy "College admins read own events" on public.events for select to authenticated using (college_id = public.current_college_id());
create policy "Super admins insert events" on public.events for insert to authenticated with check (public.is_super_admin());
create policy "College admins insert own events" on public.events for insert to authenticated with check (public.is_college_admin() and college_id = public.current_college_id());
create policy "Super admins update events" on public.events for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "College admins update own events" on public.events for update to authenticated using (college_id = public.current_college_id() and public.is_college_admin()) with check (college_id = public.current_college_id() and public.is_college_admin());
create policy "Super admins delete events" on public.events for delete to authenticated using (public.is_super_admin());
create policy "College admins delete own events" on public.events for delete to authenticated using (college_id = public.current_college_id() and public.is_college_admin());

-- Storage writes are restricted to Super Admins or the assigned college folder.
drop policy if exists "Admins can upload event posters" on storage.objects;
drop policy if exists "Admins can update event posters" on storage.objects;
drop policy if exists "Admins can delete event posters" on storage.objects;
drop policy if exists "Super admins upload posters" on storage.objects;
create policy "Super admins upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-posters' and public.is_super_admin());
create policy "College admins upload own posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-posters' and public.is_college_admin() and (storage.foldername(name))[1] = public.current_college_id()::text);
create policy "Super admins update posters" on storage.objects for update to authenticated
  using (bucket_id = 'event-posters' and public.is_super_admin())
  with check (bucket_id = 'event-posters' and public.is_super_admin());
create policy "College admins update own posters" on storage.objects for update to authenticated
  using (bucket_id = 'event-posters' and public.is_college_admin() and (storage.foldername(name))[1] = public.current_college_id()::text)
  with check (bucket_id = 'event-posters' and public.is_college_admin() and (storage.foldername(name))[1] = public.current_college_id()::text);
create policy "Super admins delete posters" on storage.objects for delete to authenticated
  using (bucket_id = 'event-posters' and public.is_super_admin());
create policy "College admins delete own posters" on storage.objects for delete to authenticated
  using (bucket_id = 'event-posters' and public.is_college_admin() and (storage.foldername(name))[1] = public.current_college_id()::text);

-- Archive events seven days after their effective end date, retaining only approved summary fields.
-- Only Super Admins can invoke this from an authenticated session; database scheduler calls run as owner.
create or replace function public.archive_expired_events()
returns integer language plpgsql security definer set search_path = ''
as $archive$
declare archived_count integer;
begin
  if auth.uid() is not null and not public.is_super_admin() then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;
  with due as (
    select e.id, coalesce(e.end_date, e."date") as effective_end,
           coalesce(nullif(c.name, ''), 'Unassigned college') as college_name,
           coalesce(nullif(e.title, ''), 'Untitled event') as event_title
    from public.events e
    left join public.colleges c on c.id = e.college_id
    where coalesce(e.end_date, e."date") is not null
      and coalesce(e.end_date, e."date") <= (current_date - 7)
  ), inserted as (
    insert into public.event_archive (event_title, college_name, event_date, archived_at)
    select d.event_title, d.college_name, d.effective_end, now() from due d
    returning id
  )
  select count(*) into archived_count from inserted;

  delete from public.events e
  where coalesce(e.end_date, e."date") is not null
    and coalesce(e.end_date, e."date") <= (current_date - 7);
  return coalesce(archived_count, 0);
end;
$archive$;
revoke all on function public.archive_expired_events() from public, anon, authenticated;
grant execute on function public.archive_expired_events() to service_role;

-- If pg_cron is enabled in this Supabase project, schedule automatic daily archiving at 02:15 UTC.
-- If it is not enabled, enable the pg_cron extension and run this migration again.
do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'hapn-event-archive-daily') then
      execute 'select cron.schedule(''hapn-event-archive-daily'', ''15 2 * * *'', ''select public.archive_expired_events();'')';
    end if;
  end if;
exception when undefined_table or undefined_function or invalid_schema_name then
  raise notice 'pg_cron is not enabled; schedule public.archive_expired_events() daily after enabling pg_cron.';
end;
$schedule$;

commit;

-- Bootstrap: create the first Auth user in Supabase Auth, then insert exactly that UID:
-- insert into public.profiles(user_id,email,full_name,role)
-- values ('AUTH-USER-UUID','owner@example.com','Platform Owner','super_admin');
-- Never promote all rows from the legacy admins table automatically.
