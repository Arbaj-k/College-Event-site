-- Expire abandoned anonymous matchmaking sessions without deleting report history.
-- A waiting identity expires after 2 minutes. A matched conversation is ended
-- after 30 minutes without messages (or 30 minutes after creation if empty).

create or replace function public.chat_match_cleanup_stale()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Remove abandoned waiting entries.
  delete from public.chat_match_queue q
  where q.status = 'waiting'
    and q.queued_at < pg_catalog.now() - interval '2 minutes';

  -- End conversations that have been idle for 30 minutes.
  update public.chat_private_conversations c
  set ended_at = pg_catalog.now()
  where c.ended_at is null
    and coalesce(
      (select max(m.created_at)
       from public.chat_private_messages m
       where m.conversation_id = c.id),
      c.created_at
    ) < pg_catalog.now() - interval '30 minutes';

  -- Remove only queue pointers for ended conversations. Conversation and
  -- message/report records remain available to authorized moderation.
  delete from public.chat_match_queue q
  using public.chat_private_conversations c
  where q.conversation_id = c.id
    and c.ended_at is not null;
end;
$$;

revoke all on function public.chat_match_cleanup_stale() from public, anon, authenticated;

create or replace function public.chat_match_start(p_nickname text)
returns table(matched boolean, out_conversation_id uuid, out_partner_nickname text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_self public.chat_match_queue%rowtype;
  v_partner public.chat_match_queue%rowtype;
  v_conversation uuid;
begin
  if v_uid is null or coalesce(auth.jwt() ->> 'is_anonymous','false') <> 'true' then
    raise exception 'Anonymous sign-in required';
  end if;
  if p_nickname !~ '^[A-Za-z][A-Za-z0-9_-]{2,19}$' then
    raise exception 'Invalid nickname';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(784221);
  perform public.chat_match_cleanup_stale();

  select q.* into v_self from public.chat_match_queue q where q.user_id=v_uid limit 1;
  if found and v_self.status='matched' and v_self.conversation_id is not null then
    return query select true, v_self.conversation_id, coalesce(
      (select q2.nickname from public.chat_match_queue q2 where q2.user_id=v_self.matched_user_id),
      'CampusMate'
    );
    return;
  end if;

  select q.* into v_partner
  from public.chat_match_queue q
  where q.status='waiting' and q.user_id<>v_uid
  order by q.queued_at
  limit 1
  for update skip locked;

  if not found then
    insert into public.chat_match_queue(user_id,nickname,status,queued_at)
    values(v_uid,p_nickname,'waiting',pg_catalog.now())
    on conflict(user_id) do update set nickname=excluded.nickname
      where public.chat_match_queue.status='waiting';
    return query select false, null::uuid, null::text;
    return;
  end if;

  delete from public.chat_match_queue where user_id=v_uid;
  v_conversation := pg_catalog.gen_random_uuid();
  insert into public.chat_private_conversations(id,user_a,user_b)
  values(v_conversation,v_partner.user_id,v_uid);

  update public.chat_match_queue
  set status='matched',conversation_id=v_conversation,matched_user_id=v_uid
  where user_id=v_partner.user_id and status='waiting';

  if not found then
    delete from public.chat_private_conversations where id=v_conversation;
    insert into public.chat_match_queue(user_id,nickname,status,queued_at)
    values(v_uid,p_nickname,'waiting',pg_catalog.now())
    on conflict(user_id) do update set nickname=excluded.nickname,status='waiting',
      conversation_id=null,matched_user_id=null,queued_at=excluded.queued_at;
    return query select false, null::uuid, null::text;
    return;
  end if;

  insert into public.chat_match_queue(user_id,nickname,status,conversation_id,matched_user_id,queued_at)
  values(v_uid,p_nickname,'matched',v_conversation,v_partner.user_id,pg_catalog.now())
  on conflict(user_id) do update set nickname=excluded.nickname,status='matched',
    conversation_id=excluded.conversation_id,matched_user_id=excluded.matched_user_id;
  return query select true, v_conversation, v_partner.nickname;
end;
$$;

revoke all on function public.chat_match_start(text) from public, anon;
grant execute on function public.chat_match_start(text) to authenticated;
