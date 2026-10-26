-- Hapn random 1-to-1 Campus Lounge — migration draft
-- Apply ONLY to the existing Hapn Supabase project after reviewing this file.
-- This migration deliberately does not change public chat_messages policies; those must
-- be updated in the same deployment so the public "campus" room cannot expose private chats.

create table if not exists public.chat_match_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$'),
  status text not null default 'waiting' check (status in ('waiting','matched')),
  conversation_id uuid,
  queued_at timestamptz not null default now()
);

create table if not exists public.chat_private_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint chat_private_two_distinct_users check (user_a <> user_b)
);

alter table public.chat_match_queue
  add column if not exists matched_user_id uuid references auth.users(id) on delete set null;

alter table public.chat_private_conversations enable row level security;

create table if not exists public.chat_private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_private_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$'),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.chat_private_messages enable row level security;
alter table public.chat_match_queue enable row level security;

drop policy if exists chat_private_participant_read on public.chat_private_conversations;
create policy chat_private_participant_read on public.chat_private_conversations
for select to authenticated using (
  auth.uid() in (user_a, user_b) or public.is_admin()
);

drop policy if exists chat_private_messages_participant_read on public.chat_private_messages;
create policy chat_private_messages_participant_read on public.chat_private_messages
for select to authenticated using (
  deleted_at is null and exists (
    select 1 from public.chat_private_conversations c
    where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)
  )
  or public.is_admin()
);

drop policy if exists chat_private_messages_participant_insert on public.chat_private_messages;
create policy chat_private_messages_participant_insert on public.chat_private_messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and (auth.jwt() ->> 'is_anonymous') = 'true'
  and exists (
    select 1 from public.chat_private_conversations c
    where c.id = conversation_id
      and c.ended_at is null
      and auth.uid() in (c.user_a, c.user_b)
  )
);

drop policy if exists chat_private_messages_admin_update on public.chat_private_messages;
create policy chat_private_messages_admin_update on public.chat_private_messages
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Users can only see their own queue row. Matching is performed through RPC functions.
drop policy if exists chat_match_queue_own_read on public.chat_match_queue;
create policy chat_match_queue_own_read on public.chat_match_queue
for select to authenticated using (user_id = auth.uid());

create or replace function public.chat_match_start(p_nickname text)
returns table (matched boolean, out_conversation_id uuid, out_partner_nickname text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_partner public.chat_match_queue%rowtype;
  v_conversation uuid;
begin
  if v_uid is null or (auth.jwt() ->> 'is_anonymous') <> 'true' then
    raise exception 'Anonymous sign-in required';
  end if;
  if p_nickname !~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$' then
    raise exception 'Invalid nickname';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(784221);

  -- If this user already has a live matched conversation, return it.
  select q.* into v_partner
  from public.chat_match_queue q
  where q.user_id = v_uid and q.status = 'matched'
    and q.conversation_id is not null
  limit 1;
  if found then
    return query select true, v_partner.conversation_id, coalesce(
      (select q2.nickname from public.chat_match_queue q2 where q2.user_id = v_partner.matched_user_id),
      'CampusMate'
    );
    return;
  end if;

  delete from public.chat_match_queue where user_id = v_uid;
  select q.* into v_partner
  from public.chat_match_queue q
  where q.status = 'waiting' and q.user_id <> v_uid
  order by q.queued_at
  for update skip locked
  limit 1;

  if not found then
    insert into public.chat_match_queue(user_id,nickname,status,queued_at)
    values(v_uid,p_nickname,'waiting',pg_catalog.now())
    on conflict(user_id) do update set nickname=excluded.nickname,status='waiting',
      conversation_id=null,matched_user_id=null,queued_at=excluded.queued_at;
    return query select false, null::uuid, null::text;
    return;
  end if;

  v_conversation := gen_random_uuid();
  insert into public.chat_private_conversations(id,user_a,user_b)
  values(v_conversation,v_partner.user_id,v_uid);

  update public.chat_match_queue
  set status='matched',conversation_id=v_conversation,matched_user_id=v_uid
  where user_id=v_partner.user_id;

  insert into public.chat_match_queue(user_id,nickname,status,conversation_id,matched_user_id,queued_at)
  values(v_uid,p_nickname,'matched',v_conversation,v_partner.user_id,pg_catalog.now())
  on conflict(user_id) do update set nickname=excluded.nickname,status='matched',
    conversation_id=excluded.conversation_id,matched_user_id=excluded.matched_user_id;

  return query select true, v_conversation, v_partner.nickname;
end;
$$;

create or replace function public.chat_match_leave()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
declare v_conversation uuid;
begin
  if v_uid is null or (auth.jwt() ->> 'is_anonymous') <> 'true' then
    raise exception 'Anonymous sign-in required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(784221);
  select conversation_id into v_conversation
  from public.chat_match_queue where user_id=v_uid;
  if v_conversation is not null then
    update public.chat_private_conversations
      set ended_at=pg_catalog.now()
      where id=v_conversation and ended_at is null;
    delete from public.chat_match_queue
      where conversation_id=v_conversation;
  else
    delete from public.chat_match_queue where user_id=v_uid;
  end if;
end;
$$;

revoke all on function public.chat_match_start(text) from public;
revoke all on function public.chat_match_leave() from public;
grant execute on function public.chat_match_start(text) to authenticated;
grant execute on function public.chat_match_leave() to authenticated;

-- NOTE: add chat_private_messages to supabase_realtime after applying.
-- NOTE: client UI must use these RPCs and chat_private_messages for Campus Lounge,
-- and must stop querying/inserting room_id='campus' in public.chat_messages.
