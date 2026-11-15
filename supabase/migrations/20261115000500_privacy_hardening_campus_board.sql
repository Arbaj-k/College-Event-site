-- Privacy hardening: prevent Supabase anonymous-auth sessions from using Campus Board or admin data.
-- Anonymous chat remains unchanged; its own RLS policies and matching RPCs are intentionally untouched.
begin;

create or replace function public.is_real_campus_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;
revoke all on function public.is_real_campus_user() from public, anon;
grant execute on function public.is_real_campus_user() to authenticated;

-- Admin records: an anonymous-auth session must never qualify as an administrator session.
drop policy if exists "Users can read their own admin row" on public.admins;
create policy "Users can read their own admin row"
  on public.admins for select to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()));

drop policy if exists "Super admins manage invitations" on public.admin_invitations;
create policy "Super admins manage invitations"
  on public.admin_invitations for all to authenticated
  using (public.is_real_campus_user() and public.is_super_admin())
  with check (public.is_real_campus_user() and public.is_super_admin());

-- Campus Board membership and profile data.
drop policy if exists "Campus members read own profile" on public.campus_members;
create policy "Campus members read own profile"
  on public.campus_members for select to authenticated
  using (public.is_real_campus_user() and (user_id = (select auth.uid()) or public.is_super_admin()));

drop policy if exists "Campus members update own profile" on public.campus_members;
create policy "Campus members update own profile"
  on public.campus_members for update to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()))
  with check (public.is_real_campus_user() and user_id = (select auth.uid()));

-- Private WhatsApp contact remains owner-only, except after an explicitly approved connection.
drop policy if exists "Members manage own private contact" on public.campus_member_private;
create policy "Members manage own private contact"
  on public.campus_member_private for all to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()))
  with check (public.is_real_campus_user() and user_id = (select auth.uid())
    and college_id = public.current_campus_college_id());

drop policy if exists "Approved connections can read contact" on public.campus_member_private;
create policy "Approved connections can read contact"
  on public.campus_member_private for select to authenticated
  using (public.is_real_campus_user() and exists (
    select 1 from public.campus_connect_requests r
    where r.owner_id = campus_member_private.user_id
      and r.requester_id = (select auth.uid()) and r.status = 'approved'
  ));

-- Connection requests are limited to genuine, verified Campus Board sessions.
drop policy if exists "Participants read their campus connection requests" on public.campus_connect_requests;
create policy "Participants read their campus connection requests"
  on public.campus_connect_requests for select to authenticated
  using (public.is_real_campus_user()
    and (requester_id = (select auth.uid()) or owner_id = (select auth.uid())));

drop policy if exists "Campus members send connection requests" on public.campus_connect_requests;
create policy "Campus members send connection requests"
  on public.campus_connect_requests for insert to authenticated
  with check (public.is_real_campus_user()
    and requester_id = (select auth.uid())
    and college_id = public.current_campus_college_id()
    and exists (
      select 1 from public.campus_posts p
      where p.id = campus_connect_requests.post_id
        and p.user_id = campus_connect_requests.owner_id
        and p.college_id = campus_connect_requests.college_id
        and p.status = 'active'
        and (p.expires_at is null or p.expires_at > now())
    ));

-- Notifications: users can only read/mark their own rows.
drop policy if exists "Members read own campus notifications" on public.campus_notifications;
create policy "Members read own campus notifications"
  on public.campus_notifications for select to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()));

drop policy if exists "Members mark own campus notifications read" on public.campus_notifications;
create policy "Members mark own campus notifications read"
  on public.campus_notifications for update to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()))
  with check (public.is_real_campus_user() and user_id = (select auth.uid()));

-- Reports: member self-access and same-college active-admin review.
drop policy if exists "Members submit reports for campus posts" on public.campus_post_reports;
create policy "Members submit reports for campus posts"
  on public.campus_post_reports for insert to authenticated
  with check (public.is_real_campus_user()
    and reporter_id = (select auth.uid())
    and college_id = public.current_campus_college_id()
    and exists (
      select 1 from public.campus_posts p
      where p.id = campus_post_reports.post_id
        and (p.visibility = 'all' or p.college_id = public.current_campus_college_id())
    ));

drop policy if exists "Members see their own campus reports" on public.campus_post_reports;
create policy "Members see their own campus reports"
  on public.campus_post_reports for select to authenticated
  using (public.is_real_campus_user() and reporter_id = (select auth.uid()));

drop policy if exists "College admins review campus reports" on public.campus_post_reports;
create policy "College admins review campus reports"
  on public.campus_post_reports for select to authenticated
  using (public.is_real_campus_user() and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'college_admin'
      and p.college_id = campus_post_reports.college_id
      and p.is_active = true
  ));

-- Saved posts: owner-only.
drop policy if exists "Members manage own saved campus posts" on public.campus_post_saves;
create policy "Members manage own saved campus posts"
  on public.campus_post_saves for all to authenticated
  using (public.is_real_campus_user() and user_id = (select auth.uid()))
  with check (public.is_real_campus_user()
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.campus_posts p
      where p.id = campus_post_saves.post_id
        and (p.visibility = 'all' or p.college_id = public.current_campus_college_id())
    ));

-- Posts: all CRUD paths require a real campus session plus existing ownership/college checks.
drop policy if exists "Campus members create own college posts" on public.campus_posts;
create policy "Campus members create own college posts"
  on public.campus_posts for insert to authenticated
  with check (public.is_real_campus_user()
    and user_id = (select auth.uid())
    and college_id = public.current_campus_college_id()
    and exists (select 1 from public.campus_members m where m.user_id = (select auth.uid())));

drop policy if exists "Campus members read permitted campus board posts" on public.campus_posts;
create policy "Campus members read permitted campus board posts"
  on public.campus_posts for select to authenticated
  using (public.is_real_campus_user()
    and exists (select 1 from public.campus_members m where m.user_id = (select auth.uid()))
    and (visibility = 'all' or college_id = public.current_campus_college_id())
    and (status <> 'hidden' or user_id = (select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'college_admin'
        and p.college_id = campus_posts.college_id and p.is_active = true
    )));

drop policy if exists "Owners and college admins update campus posts" on public.campus_posts;
create policy "Owners and college admins update campus posts"
  on public.campus_posts for update to authenticated
  using (public.is_real_campus_user()
    and college_id = public.current_campus_college_id()
    and (user_id = (select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'college_admin'
        and p.college_id = campus_posts.college_id and p.is_active = true
    )))
  with check (public.is_real_campus_user()
    and college_id = public.current_campus_college_id()
    and (user_id = (select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'college_admin'
        and p.college_id = campus_posts.college_id and p.is_active = true
    )));

drop policy if exists "Owners and college admins delete campus posts" on public.campus_posts;
create policy "Owners and college admins delete campus posts"
  on public.campus_posts for delete to authenticated
  using (public.is_real_campus_user()
    and college_id = public.current_campus_college_id()
    and (user_id = (select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'college_admin'
        and p.college_id = campus_posts.college_id and p.is_active = true
    )));

-- Public image reads are intentional (post images are part of the public feed).
-- Upload, update and delete require a genuine non-anonymous campus session.
drop policy if exists "Campus members upload own images" on storage.objects;
create policy "Campus members upload own images"
  on storage.objects for insert to authenticated
  with check (public.is_real_campus_user()
    and bucket_id = 'campus-post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Campus members update own images" on storage.objects;
create policy "Campus members update own images"
  on storage.objects for update to authenticated
  using (public.is_real_campus_user()
    and bucket_id = 'campus-post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (public.is_real_campus_user()
    and bucket_id = 'campus-post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Campus members delete own images" on storage.objects;
create policy "Campus members delete own images"
  on storage.objects for delete to authenticated
  using (public.is_real_campus_user()
    and bucket_id = 'campus-post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
