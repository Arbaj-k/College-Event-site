-- Only active platform Super Admins may moderate global chat.
-- Legacy admins rows map to College Admins in the multi-college model and are
-- deliberately not treated as platform-wide moderators.
begin;

create or replace function public.is_chat_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_real_campus_user()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'super_admin'
        and p.is_active = true
    );
$function$;

revoke all on function public.is_chat_moderator() from public, anon;
grant execute on function public.is_chat_moderator() to authenticated;

-- Public chat moderation.
drop policy if exists "Admins moderate chat messages" on public.chat_messages;
create policy "Chat moderators update messages"
on public.chat_messages for update to authenticated
using ((select public.is_chat_moderator()))
with check ((select public.is_chat_moderator()));

drop policy if exists "chat_admin_read_messages" on public.chat_messages;
create policy "Chat moderators read messages"
on public.chat_messages for select to authenticated
using ((select public.is_chat_moderator()));

-- Public reports.
drop policy if exists "Admins review chat reports" on public.chat_reports;
create policy "Chat moderators review reports"
on public.chat_reports for select to authenticated
using ((select public.is_chat_moderator()));

drop policy if exists "Admins update chat reports" on public.chat_reports;
create policy "Chat moderators update reports"
on public.chat_reports for update to authenticated
using ((select public.is_chat_moderator()))
with check ((select public.is_chat_moderator()));

-- Private conversation and evidence access is limited to platform Super Admins.
drop policy if exists "chat_private_participant_read" on public.chat_private_conversations;
create policy "Private participants and chat moderators read conversations"
on public.chat_private_conversations for select to authenticated
using (
  (select auth.uid()) = user_a
  or (select auth.uid()) = user_b
  or (select public.is_chat_moderator())
);

drop policy if exists "chat_private_messages_admin_update" on public.chat_private_messages;
create policy "Chat moderators update private messages"
on public.chat_private_messages for update to authenticated
using ((select public.is_chat_moderator()))
with check ((select public.is_chat_moderator()));

drop policy if exists "chat_private_messages_participant_read" on public.chat_private_messages;
create policy "Private participants and chat moderators read messages"
on public.chat_private_messages for select to authenticated
using (
  (
    deleted_at is null
    and exists (
      select 1
      from public.chat_private_conversations c
      where c.id = chat_private_messages.conversation_id
        and ((select auth.uid()) = c.user_a or (select auth.uid()) = c.user_b)
    )
  )
  or (select public.is_chat_moderator())
);

drop policy if exists "chat_private_reports_own_or_admin_read" on public.chat_private_reports;
create policy "Reporters and chat moderators read private reports"
on public.chat_private_reports for select to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_chat_moderator())
);

drop policy if exists "chat_private_reports_admin_update" on public.chat_private_reports;
create policy "Chat moderators update private reports"
on public.chat_private_reports for update to authenticated
using ((select public.is_chat_moderator()))
with check ((select public.is_chat_moderator()));

commit;
