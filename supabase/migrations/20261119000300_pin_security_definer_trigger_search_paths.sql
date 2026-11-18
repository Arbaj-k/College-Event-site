-- Pin SECURITY DEFINER trigger functions to an empty search_path.
-- The public schema currently denies CREATE to browser roles, but explicit
-- qualification removes ambient name resolution from privileged trigger code.
begin;

create or replace function public.campus_connect_request_notify_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.campus_notifications(user_id,college_id,notification_type,message,post_id,request_id)
  values(new.owner_id,new.college_id,'request',new.requester_name || ' wants to connect about your post.',new.post_id,new.id);
  return new;
end
$function$;

create or replace function public.hapn_clear_private_chat_on_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.ended_at is null and new.ended_at is not null then
    delete from public.chat_private_messages where conversation_id = new.id;
  end if;
  return new;
end
$function$;

create or replace function public.hapn_delete_old_group_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.chat_messages
  where room_id = 'group'
    and created_at < pg_catalog.now() - interval '12 hours';
  return new;
end
$function$;

commit;
