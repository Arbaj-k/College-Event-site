-- Preserve reported message evidence when either chat message is deleted.
-- This covers account deletion cascades, room cleanup, and explicit retention cleanup.
begin;

-- Public reports need the same evidence snapshot and nullable message reference
-- already introduced for private reports by migration 20261119000350.
alter table public.chat_reports
  add column if not exists message_snapshot text,
  add column if not exists message_created_at timestamptz;

alter table public.chat_reports
  alter column message_id drop not null;

alter table public.chat_reports
  drop constraint if exists chat_reports_message_id_fkey;

alter table public.chat_reports
  add constraint chat_reports_message_id_fkey
  foreign key (message_id)
  references public.chat_messages(id)
  on delete set null;

-- A BEFORE DELETE trigger runs before FK SET NULL. Snapshot only reported
-- messages; ordinary messages remain fully deletable and are not archived.
create or replace function public.hapn_snapshot_public_chat_report_before_message_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.chat_reports r
     set message_snapshot = pg_catalog.left(old.body, 500),
         message_created_at = old.created_at
   where r.message_id = old.id
     and r.message_snapshot is null;
  return old;
end
$function$;

drop trigger if exists hapn_snapshot_public_chat_report_before_message_delete_trigger
  on public.chat_messages;

create trigger hapn_snapshot_public_chat_report_before_message_delete_trigger
before delete on public.chat_messages
for each row
execute function public.hapn_snapshot_public_chat_report_before_message_delete();

-- Private reports already have snapshot columns and ON DELETE SET NULL from
-- migration 20261119000350. This trigger also covers account/conversation
-- cascades that bypass the normal ended_at cleanup path.
create or replace function public.hapn_snapshot_private_chat_report_before_message_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.chat_private_reports r
     set message_snapshot = pg_catalog.left(old.body, 500),
         message_created_at = old.created_at
   where r.message_id = old.id
     and r.message_snapshot is null;
  return old;
end
$function$;

drop trigger if exists hapn_snapshot_private_chat_report_before_message_delete_trigger
  on public.chat_private_messages;

create trigger hapn_snapshot_private_chat_report_before_message_delete_trigger
before delete on public.chat_private_messages
for each row
execute function public.hapn_snapshot_private_chat_report_before_message_delete();

revoke all on function public.hapn_snapshot_public_chat_report_before_message_delete() from public, anon, authenticated;
revoke all on function public.hapn_snapshot_private_chat_report_before_message_delete() from public, anon, authenticated;

commit;
