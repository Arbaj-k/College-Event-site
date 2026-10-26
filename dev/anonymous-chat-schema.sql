-- Hapn Anonymous Chat: DEVELOPMENT ONLY
-- Review and apply to an isolated Supabase development project before enabling chat.
-- Do NOT run against production until explicitly approved.
create extension if not exists pgcrypto;

create table if not exists public.chat_rooms (
  id text primary key check (id in ('campus','fest','teams','help')),
  title text not null check (char_length(title) between 1 and 80),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.chat_rooms (id,title) values
 ('campus','Campus Lounge'),
 ('fest','Fest & Events'),
 ('teams','Find a Team'),
 ('help','Ask the Community')
on conflict (id) do nothing;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$'),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_messages_recent_time check (created_at <= now() + interval '1 minute')
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','hate','personal_information','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;

drop policy if exists "Chat rooms readable by visitors" on public.chat_rooms;
create policy "Chat rooms readable by visitors" on public.chat_rooms
 for select to anon, authenticated using (is_open = true);

drop policy if exists "Signed-in anonymous users read recent chat" on public.chat_messages;
create policy "Signed-in anonymous users read recent chat" on public.chat_messages
 for select to authenticated using (deleted_at is null and created_at > now() - interval '24 hours');

drop policy if exists "Users insert own chat messages" on public.chat_messages;
create policy "Users insert own chat messages" on public.chat_messages
 for insert to authenticated with check (
   auth.uid() = user_id
   and deleted_at is null
   and created_at > now() - interval '1 minute'
   and exists (select 1 from public.chat_rooms r where r.id = room_id and r.is_open)
 );

drop policy if exists "Users report chat messages" on public.chat_reports;
create policy "Users report chat messages" on public.chat_reports
 for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "Users read own reports" on public.chat_reports;
create policy "Users read own reports" on public.chat_reports
 for select to authenticated using (auth.uid() = reporter_id);

-- Intentionally no public update/delete policy for messages or reports.
-- Moderation/deletion must be performed through a trusted server-side function.
grant select on public.chat_rooms to anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
grant insert, select on public.chat_reports to authenticated;
revoke all on public.chat_messages from anon;
revoke all on public.chat_reports from anon;

-- Realtime Presence is configured per client channel; do not publish message
-- bodies or user metadata into presence payloads.
