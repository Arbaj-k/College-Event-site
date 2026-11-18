-- Ensure only anonymous matchmaking sessions can leave the matchmaking queue.
-- Keep the authenticated grant: Supabase anonymous Auth sessions use the authenticated DB role.
CREATE OR REPLACE FUNCTION public.chat_match_leave()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_is_anonymous boolean := coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'true';
  v_conversation uuid;
begin
  if v_uid is null or not v_is_anonymous then
    raise exception 'Anonymous sign-in required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(784221);
  select conversation_id into v_conversation
  from public.chat_match_queue where user_id = v_uid;

  if v_conversation is not null then
    update public.chat_private_conversations
      set ended_at = pg_catalog.now()
      where id = v_conversation and ended_at is null;
    delete from public.chat_match_queue
      where conversation_id = v_conversation;
  else
    delete from public.chat_match_queue where user_id = v_uid;
  end if;
end;
$function$;
