-- Hapn feature migration: event end times and homepage placement controls.
-- Run in Supabase Dashboard > SQL Editor after backing up your project.
alter table public.events
  add column if not exists end_date date,
  add column if not exists end_time time,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_pinned boolean not null default false;

-- Existing rows remain valid: end_date/end_time are optional.
create index if not exists events_featured_idx on public.events (is_featured, is_published, date);
create index if not exists events_pinned_idx on public.events (is_pinned, is_published, date);

alter table public.events drop constraint if exists event_end_after_start;
alter table public.events add constraint event_end_after_start
  check (
    (end_date is null or end_date >= "date")
    and (end_date is null or end_date <> "date" or end_time is null or end_time >= "time")
  );
