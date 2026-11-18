-- Harden the moderation audit log against TRUNCATE and label system/service actions.
begin;

do $preflight$
begin
  if to_regclass('public.chat_moderation_audit') is null then
    raise exception 'Apply migration 20261119001100_chat_moderation_audit_log.sql before this migration';
  end if;
end
$preflight$;

alter table public.chat_moderation_audit
  add column if not exists actor_role text not null default 'unknown';

-- Browser and service roles never need to truncate/delete the audit log.
revoke truncate, delete, update, insert, references, trigger
  on table public.chat_moderation_audit
  from public, anon, authenticated, service_role;
grant select on table public.chat_moderation_audit to authenticated;

-- TRUNCATE bypasses row-level DELETE triggers. Revoke it from API roles on
-- the source tables too; the normal message/report APIs do not require it.
revoke truncate on table public.chat_reports, public.chat_private_reports,
  public.chat_messages, public.chat_private_messages,
  public.chat_private_conversations
  from public, anon, authenticated, service_role;

create or replace function public.hapn_audit_chat_report_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status is distinct from new.status then
    insert into public.chat_moderation_audit
      (actor_id,actor_role,event_type,report_id,message_id,old_status,new_status)
    values
      (auth.uid(),
       coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), 'unknown'),
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
      (actor_id,actor_role,event_type,message_id,conversation_id,old_deleted_at,new_deleted_at)
    values
      (auth.uid(),
       coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), 'unknown'),
       case when tg_table_name = 'chat_messages'
         then 'public_message_hidden'
         else 'private_message_hidden' end,
       new.id,
       case when tg_table_name = 'chat_private_messages' then new.conversation_id else null end,
       old.deleted_at,new.deleted_at);
  end if;
  return new;
end
$function$;

revoke all on function public.hapn_audit_chat_report_moderation() from public, anon, authenticated;
revoke all on function public.hapn_audit_chat_message_moderation() from public, anon, authenticated;

commit;
