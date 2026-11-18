-- Preserve only the message explicitly reported for moderation when a
-- private conversation ends. Unreported private messages are still erased.
begin;

alter table public.chat_private_reports
  add column if not exists message_snapshot text,
  add column if not exists message_created_at timestamptz;

alter table public.chat_private_reports
  alter column message_id drop not null;

alter table public.chat_private_reports
  drop constraint if exists chat_private_reports_message_id_fkey;

alter table public.chat_private_reports
  add constraint chat_private_reports_message_id_fkey
  foreign key (message_id)
  references public.chat_private_messages(id)
  on delete set null;

create or replace function public.hapn_clear_private_chat_on_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.ended_at is null and new.ended_at is not null then
    update public.chat_private_reports r
    set message_snapshot = pg_catalog.left(m.body, 500),
        message_created_at = m.created_at,
        message_id = null
    from public.chat_private_messages m
    where m.conversation_id = new.id
      and r.message_id = m.id;

    delete from public.chat_private_messages
    where conversation_id = new.id;
  end if;
  return new;
end
$function$;

commit;
