-- =====================================================================
--  Hapn – database schema, Row Level Security and Storage
--  Run this whole file once in: Supabase Dashboard > SQL Editor > New query
--  It is safe to run again (it drops and recreates the policies).
-- =====================================================================

-- ---------- 1. TABLES ----------

-- Who is an administrator. user_id = the Supabase Auth user's UID.
create table if not exists public.admins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null default 'admin',
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text check (title is null or char_length(title) <= 120),
  poster_url            text,
  "date"                date,
  "time"                time,
  venue                 text check (venue is null or char_length(venue) <= 120),
  organizer             text check (organizer is null or char_length(organizer) <= 120),
  category              text,
  short_description     text check (short_description is null or char_length(short_description) <= 200),
  description           text check (description is null or char_length(description) <= 5000),
  registration_deadline date,
  registration_link     text check (registration_link is null or registration_link ~* '^https://'),
  is_published          boolean not null default true,   -- false = hidden draft (admins only)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint deadline_not_after_event
    check (registration_deadline is null or "date" is null or registration_deadline <= "date")
);

create index if not exists events_date_idx on public.events ("date");

-- Keep updated_at fresh on every edit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ---------- 2. ADMIN CHECK (used by every policy) ----------
-- SECURITY DEFINER lets the function read the admins table safely.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- 3. TABLE PRIVILEGES ----------
grant usage on schema public to anon, authenticated;

revoke all on public.events from anon, authenticated;
grant select                         on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;   -- write access: SQL Editor only

-- ---------- 4. ROW LEVEL SECURITY ----------
alter table public.events enable row level security;
alter table public.admins enable row level security;

-- events: everyone can read published events
drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
  on public.events for select
  to anon, authenticated
  using (is_published = true);

-- events: admins can also read drafts
drop policy if exists "Admins can read all events" on public.events;
create policy "Admins can read all events"
  on public.events for select
  to authenticated
  using (public.is_admin());

-- events: only admins can insert / update / delete
drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
  on public.events for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
  on public.events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
  on public.events for delete
  to authenticated
  using (public.is_admin());

-- admins: a signed-in user can only see THEIR OWN row (so the website can
-- check "am I an admin?"). There are NO insert/update/delete policies, so
-- nobody can make themselves admin through the API. Add admins in the SQL Editor.
drop policy if exists "Users can read their own admin row" on public.admins;
create policy "Users can read their own admin row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------- 5. STORAGE (event posters) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view event posters" on storage.objects;
create policy "Public can view event posters"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-posters');

drop policy if exists "Admins can upload event posters" on storage.objects;
create policy "Admins can upload event posters"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-posters' and public.is_admin());

drop policy if exists "Admins can update event posters" on storage.objects;
create policy "Admins can update event posters"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-posters' and public.is_admin())
  with check (bucket_id = 'event-posters' and public.is_admin());

drop policy if exists "Admins can delete event posters" on storage.objects;
create policy "Admins can delete event posters"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-posters' and public.is_admin());
