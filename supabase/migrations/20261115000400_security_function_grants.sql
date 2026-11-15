-- Least-privilege execution grants for public SECURITY DEFINER helpers.
-- Preserve functions intentionally used by authenticated app flows; prevent anonymous RPC execution.
begin;
revoke all on function public.current_college_id() from public, anon;
grant execute on function public.current_college_id() to authenticated;
revoke all on function public.current_campus_college_id() from public, anon;
grant execute on function public.current_campus_college_id() to authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_college_admin() from public, anon;
grant execute on function public.is_college_admin() to authenticated;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
revoke all on function public.ensure_campus_member() from public, anon;
grant execute on function public.ensure_campus_member() to authenticated;
revoke all on function public.set_college_email_domains(uuid,text[]) from public, anon;
grant execute on function public.set_college_email_domains(uuid,text[]) to authenticated;
revoke all on function public.update_campus_member_profile(text,text,text) from public, anon;
grant execute on function public.update_campus_member_profile(text,text,text) to authenticated;
revoke all on function public.respond_to_campus_connect_request(uuid,boolean) from public, anon;
grant execute on function public.respond_to_campus_connect_request(uuid,boolean) to authenticated;
-- These are trigger-only functions, not callable through PostgREST RPC.
revoke all on function public.hapn_clear_private_chat_on_end() from public, anon, authenticated;
revoke all on function public.hapn_delete_old_group_messages() from public, anon, authenticated;
-- Anonymous-auth users receive the authenticated Postgres role, so keep the
-- matching chat RPCs available to that role; their functions enforce is_anonymous.
grant execute on function public.chat_match_start(text) to authenticated;
grant execute on function public.chat_match_leave() to authenticated;
commit;
