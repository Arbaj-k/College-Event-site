-- Keep queue rows consistent with their matched conversation.
-- Without this FK, deleting either auth user cascades the conversation but leaves
-- the other participant's queue row marked matched with a dangling UUID.
begin;

do $preflight$
begin
  if to_regclass('public.chat_match_queue') is null
     or to_regclass('public.chat_private_conversations') is null then
    raise exception 'Chat matchmaking tables must exist before this migration';
  end if;
end
$preflight$;

-- Remove only stale queue pointers; conversation/message/report retention is
-- handled independently by the chat-report evidence migrations.
delete from public.chat_match_queue q
where q.conversation_id is not null
  and not exists (
    select 1 from public.chat_private_conversations c
    where c.id = q.conversation_id
  );

do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.chat_match_queue'::regclass
      and c.conname = 'chat_match_queue_conversation_id_fkey'
  ) then
    alter table public.chat_match_queue
      add constraint chat_match_queue_conversation_id_fkey
      foreign key (conversation_id)
      references public.chat_private_conversations(id)
      on delete cascade;
  end if;
end
$constraint$;

commit;
