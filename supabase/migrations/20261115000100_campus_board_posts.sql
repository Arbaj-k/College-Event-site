-- Live Campus Board feed, isolated by verified college membership.
-- Apply after 20261115000000_campus_board_email_domains.sql.
begin;

create table if not exists public.campus_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  academic_year text,
  post_type text not null default 'General' check (post_type in ('General','Ride Share','Lost & Found','Help','Work','Buy / Sell','Rent','Roommate','Teammate','Giveaway','Other')),
  custom_type text check (custom_type is null or char_length(custom_type) <= 40),
  body text not null check (char_length(body) between 1 and 1200),
  image_url text,
  status text not null default 'active' check (status in ('active','completed','hidden')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campus_posts_college_feed_idx
  on public.campus_posts (college_id, status, created_at desc);
create index if not exists campus_posts_owner_idx
  on public.campus_posts (user_id, created_at desc);

create or replace function public.current_campus_college_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.college_id from public.campus_members m join public.colleges c on c.id=m.college_id and c.is_active=true join public.college_email_domains d on d.college_id=m.college_id and d.domain=lower(split_part(m.email,'@',2)) and d.is_active=true where m.user_id=(select auth.uid()) limit 1),
    (select p.college_id from public.profiles p join public.colleges c on c.id=p.college_id and c.is_active=true join public.college_email_domains d on d.college_id=p.college_id and d.domain=lower(split_part(p.email,'@',2)) and d.is_active=true where p.user_id=(select auth.uid()) and p.role='college_admin' and p.is_active=true limit 1)
  );
$$;
revoke all on function public.current_campus_college_id() from public, anon;
grant execute on function public.current_campus_college_id() to authenticated;

alter table public.campus_posts enable row level security;
grant select,insert,update,delete on public.campus_posts to authenticated;

drop policy if exists "Campus members read own college board" on public.campus_posts;
create policy "Campus members read own college board"
  on public.campus_posts for select to authenticated
  using (
    college_id = public.current_campus_college_id()
    and (status <> 'hidden' or user_id = (select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.role='college_admin'
        and p.college_id=campus_posts.college_id and p.is_active=true
    ))
  );

drop policy if exists "Campus members create own college posts" on public.campus_posts;
create policy "Campus members create own college posts"
  on public.campus_posts for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and college_id=public.current_campus_college_id()
    and exists (select 1 from public.campus_members m where m.user_id=(select auth.uid()))
  );

drop policy if exists "Owners and college admins update campus posts" on public.campus_posts;
create policy "Owners and college admins update campus posts"
  on public.campus_posts for update to authenticated
  using (
    college_id=public.current_campus_college_id()
    and (user_id=(select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.role='college_admin'
        and p.college_id=campus_posts.college_id and p.is_active=true
    ))
  )
  with check (
    college_id=public.current_campus_college_id()
    and (user_id=(select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.role='college_admin'
        and p.college_id=campus_posts.college_id and p.is_active=true
    ))
  );

drop policy if exists "Owners and college admins delete campus posts" on public.campus_posts;
create policy "Owners and college admins delete campus posts"
  on public.campus_posts for delete to authenticated
  using (
    college_id=public.current_campus_college_id()
    and (user_id=(select auth.uid()) or exists (
      select 1 from public.profiles p
      where p.user_id=(select auth.uid()) and p.role='college_admin'
        and p.college_id=campus_posts.college_id and p.is_active=true
    ))
  );

commit;
