-- Append-only audit trail for administrative chat moderation actions.
-- This records status changes and message hides without copying message content.
begin;

do $preflight$
begin
  if to_regprocedure('public.is_chat_moderator()') is null then
    raise exception 'Apply migration 20261119001000_chat_moderator_role_scope.sql before this migration';
  end if;
end
$preflight$;

create table if not exists public.chat_moderation_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'public_report_status_changed',
    'private_report_status_changed',
    'public_message_hidden',
    'private_message_hidden'
  )),
  report_id uuid,
  message_id uuid,
  conversation_id uuid,
  old_status text,
  new_status text,
  old_deleted_at timestamptz,
  new_deleted_at timestamptz,
  occurred_at timestamptz not null default now()
);

create index if not exists chat_moderation_audit_occurred_at_idx
  on public.chat_moderation_audit (occurred_at desc);
create index if not exists chat_moderation_audit_actor_idx
  on public.chat_moderation_audit (actor_id, occurred_at desc);
create index if not exists chat_moderation_audit_report_idx
  on public.chat_moderation_audit (report_id, occurred_at desc);

alter table public.chat_moderation_audit enable row level security;
revoke all on table public.chat_moderation_audit from public, anon, authenticated;
grant select on table public.chat_moderation_audit to authenticated;
drop policy if exists "Chat moderators read moderation audit" on public.chat_moderation_audit;
create policy "Chat moderators read moderation audit"
  on public.chat_moderation_audit
  for select to authenticated
  using (public.is_chat_moderator());

create or replace function public.hapn_audit_chat_report_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status is distinct from new.status then
    insert into public.chat_moderation_audit
      (actor_id,event_type,report_id,message_id,old_status,new_status)
    values
      (auth.uid(),
       case when tg_table_name = 'chat_reports'
         then 'public_report_status_changed'
         else 'private_report_status_changed' end,
       new.id,new.message_id,old.status,new.status);
  end if;
  return new;
end
$function$;

create or replace function public.hapn_audit_chat_message_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.deleted_at is distinct from new.deleted_at and new.deleted_at is not null then
    insert into public.chat_moderation_audit
      (actor_id,event_type,message_id,old_deleted_at,new_deleted_at)
    values
      (auth.uid(),
       case when tg_table_name = 'chat_messages'
         then 'public_message_hidden'
         else 'private_message_hidden' end,
       new.id,old.deleted_at,new.deleted_at);
  end if;
  return new;
end
$function$;

revoke all on function public.hapn_audit_chat_report_moderation() from public, anon, authenticated;
revoke all on function public.hapn_audit_chat_message_moderation() from public, anon, authenticated;

drop trigger if exists hapn_audit_public_chat_report_status on public.chat_reports;
create trigger hapn_audit_public_chat_report_status
after update of status on public.chat_reports
for each row execute function public.hapn_audit_chat_report_moderation();

drop trigger if exists hapn_audit_private_chat_report_status on public.chat_private_reports;
create trigger hapn_audit_private_chat_report_status
after update of status on public.chat_private_reports
for each row execute function public.hapn_audit_chat_report_moderation();

drop trigger if exists hapn_audit_public_chat_message_hidden on public.chat_messages;
create trigger hapn_audit_public_chat_message_hidden
after update of deleted_at on public.chat_messages
for each row execute function public.hapn_audit_chat_message_moderation();

drop trigger if exists hapn_audit_private_chat_message_hidden on public.chat_private_messages;
create trigger hapn_audit_private_chat_message_hidden
after update of deleted_at on public.chat_private_messages
for each row execute function public.hapn_audit_chat_message_moderation();

commit;
