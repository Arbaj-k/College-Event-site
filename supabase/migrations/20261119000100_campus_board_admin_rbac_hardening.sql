-- Campus Board admin RBAC hardening.
-- College Admins remain scoped to their own college; Super Admins get explicit
-- platform-wide moderation visibility/actions. Post authorship and college ownership
-- are immutable after creation, including for administrators.
begin;

create or replace function public.prevent_campus_post_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Campus post author cannot be changed' using errcode = '42501';
  end if;
  if new.college_id is distinct from old.college_id then
    raise exception 'Campus post college cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists campus_posts_identity_immutable on public.campus_posts;
create trigger campus_posts_identity_immutable
before update on public.campus_posts
for each row execute function public.prevent_campus_post_identity_change();

-- Explicit platform-wide Super Admin moderation access. Existing College Admin
-- policies remain intact and continue to scope access to the assigned college.
drop policy if exists "Super admins read all campus posts" on public.campus_posts;
create policy "Super admins read all campus posts"
  on public.campus_posts for select to authenticated
  using (public.is_real_campus_user() and public.is_super_admin());

drop policy if exists "Super admins update all campus posts" on public.campus_posts;
create policy "Super admins update all campus posts"
  on public.campus_posts for update to authenticated
  using (public.is_real_campus_user() and public.is_super_admin())
  with check (public.is_real_campus_user() and public.is_super_admin());

drop policy if exists "Super admins delete all campus posts" on public.campus_posts;
create policy "Super admins delete all campus posts"
  on public.campus_posts for delete to authenticated
  using (public.is_real_campus_user() and public.is_super_admin());

drop policy if exists "Super admins review all campus reports" on public.campus_post_reports;
create policy "Super admins review all campus reports"
  on public.campus_post_reports for select to authenticated
  using (public.is_real_campus_user() and public.is_super_admin());

commit;
