-- Align the existing Fests module with Hapn multi-college security.
begin;
alter table public.fests add column if not exists college_id uuid references public.colleges(id) on delete set null;
update public.fests f set college_id=c.id from public.colleges c
where f.college_id is null and lower(trim(f.college_name))=lower(trim(c.name));
create index if not exists fests_college_created_idx on public.fests(college_id,created_at desc);
grant select on public.fests to anon,authenticated;
grant insert,update,delete on public.fests to authenticated;
drop policy if exists "Admins can delete fests" on public.fests;
drop policy if exists "Admins can insert fests" on public.fests;
drop policy if exists "Admins can read all fests" on public.fests;
drop policy if exists "Admins can update fests" on public.fests;
drop policy if exists "Public can read published fests" on public.fests;
create policy "Public can read published fests" on public.fests for select to anon,authenticated using(is_published=true);
create policy "Super admins manage all fests" on public.fests for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
create policy "College admins read own fests" on public.fests for select to authenticated using(public.is_college_admin() and college_id=public.current_college_id());
create policy "College admins insert own fests" on public.fests for insert to authenticated with check(public.is_college_admin() and college_id=public.current_college_id());
create policy "College admins update own fests" on public.fests for update to authenticated using(public.is_college_admin() and college_id=public.current_college_id()) with check(public.is_college_admin() and college_id=public.current_college_id());
create policy "College admins delete own fests" on public.fests for delete to authenticated using(public.is_college_admin() and college_id=public.current_college_id());
commit;