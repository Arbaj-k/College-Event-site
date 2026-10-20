-- Hapn multi-photo college fests (run in Supabase SQL Editor)
create table if not exists public.fests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  college_name text not null check (char_length(college_name) between 2 and 160),
  description text check (description is null or char_length(description) <= 5000),
  start_date date,
  end_date date,
  venue text,
  photo_urls text[] not null default '{}',
  event_ids uuid[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fests_dates_valid check (start_date is null or end_date is null or end_date >= start_date),
  constraint fests_photos_limit check (cardinality(photo_urls) <= 10)
);
create index if not exists fests_start_date_idx on public.fests(start_date);
alter table public.fests enable row level security;
grant select on public.fests to anon, authenticated;
grant insert, update, delete on public.fests to authenticated;
drop policy if exists "Public can read published fests" on public.fests;
create policy "Public can read published fests" on public.fests for select to anon, authenticated using (is_published = true);
drop policy if exists "Admins can read all fests" on public.fests;
create policy "Admins can read all fests" on public.fests for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert fests" on public.fests;
create policy "Admins can insert fests" on public.fests for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update fests" on public.fests;
create policy "Admins can update fests" on public.fests for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete fests" on public.fests;
create policy "Admins can delete fests" on public.fests for delete to authenticated using (public.is_admin());
drop trigger if exists fests_set_updated_at on public.fests;
create trigger fests_set_updated_at before update on public.fests for each row execute function public.set_updated_at();
