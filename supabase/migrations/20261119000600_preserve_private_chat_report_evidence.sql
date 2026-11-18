-- Preserve only the message explicitly reported for moderation when a
-- private conversation ends. Unreported private messages are still erased.
-- Serialize report submission with conversation ending by locking the parent
-- conversation row in both paths (the UPDATE already owns this row lock).
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

create or replace function public.hapn_guard_private_chat_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_conversation_id uuid;
begin
  if new.reporter_id is distinct from auth.uid()
     or coalesce((auth.jwt() ->> 'is_anonymous') = 'true', false) is not true then
    raise exception 'Only the reporting participant may submit a private-chat report'
      using errcode = '42501';
  end if;

  -- FOR UPDATE waits for an in-flight conversation end (or report) and
  -- rechecks ended_at after the wait under READ COMMITTED.
  select c.id
    into v_conversation_id
  from public.chat_private_messages m
  join public.chat_private_conversations c
    on c.id = m.conversation_id
  where m.id = new.message_id
    and c.ended_at is null
    and auth.uid() in (c.user_a, c.user_b)
  for update of c;

  if v_conversation_id is null then
    raise exception 'The private conversation has ended or the message is unavailable'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

drop trigger if exists hapn_guard_private_chat_report_insert_trigger
  on public.chat_private_reports;

create trigger hapn_guard_private_chat_report_insert_trigger
before insert on public.chat_private_reports
for each row
execute function public.hapn_guard_private_chat_report_insert();

revoke all on function public.hapn_guard_private_chat_report_insert() from public, anon, authenticated;

create or replace function public.hapn_clear_private_chat_on_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.ended_at is null and new.ended_at is not null then
    -- The UPDATE that fired this AFTER trigger holds the conversation row
    -- lock. Report inserts take the same lock in their BEFORE INSERT trigger.
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
