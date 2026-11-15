-- Hapn Share N Care: retain the original Campus Board UI and persist its data securely.
begin;
alter table public.campus_posts
  add column if not exists visibility text not null default 'all',
  add column if not exists contact_pref text not null default 'whatsapp';
alter table public.campus_posts drop constraint if exists campus_posts_visibility_check;
alter table public.campus_posts add constraint campus_posts_visibility_check check (visibility in ('all','college'));
alter table public.campus_posts drop constraint if exists campus_posts_contact_pref_check;
alter table public.campus_posts add constraint campus_posts_contact_pref_check check (contact_pref in ('whatsapp','inapp'));

create table if not exists public.campus_connect_requests (
 id uuid primary key default gen_random_uuid(), college_id uuid not null references public.colleges(id) on delete cascade,
 post_id uuid not null references public.campus_posts(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade, owner_id uuid not null references auth.users(id) on delete cascade,
 requester_name text not null, owner_name text not null, message text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 created_at timestamptz not null default now(), responded_at timestamptz,
 unique(post_id,requester_id), check(requester_id<>owner_id)
);
alter table public.campus_connect_requests enable row level security;
drop policy if exists "Participants read their campus connection requests" on public.campus_connect_requests;
create policy "Participants read their campus connection requests" on public.campus_connect_requests for select to authenticated
 using(requester_id=(select auth.uid()) or owner_id=(select auth.uid()));
drop policy if exists "Campus members send connection requests" on public.campus_connect_requests;
create policy "Campus members send connection requests" on public.campus_connect_requests for insert to authenticated
 with check(requester_id=(select auth.uid()) and college_id=current_campus_college_id()
 and exists(select 1 from public.campus_posts p where p.id=post_id and p.user_id=owner_id
 and p.college_id=campus_connect_requests.college_id and p.status='active' and (p.expires_at is null or p.expires_at>now())));

create table if not exists public.campus_member_private (
 user_id uuid primary key references auth.users(id) on delete cascade,
 college_id uuid not null references public.colleges(id) on delete cascade,
 whatsapp_phone text, updated_at timestamptz not null default now(),
 constraint campus_member_private_phone_check check(whatsapp_phone is null or whatsapp_phone ~ '^[+]?[0-9][0-9 -]{6,15}$')
);
alter table public.campus_member_private enable row level security;
drop policy if exists "Members manage own private contact" on public.campus_member_private;
create policy "Members manage own private contact" on public.campus_member_private for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and college_id=current_campus_college_id());
drop policy if exists "Approved connections can read contact" on public.campus_member_private;
create policy "Approved connections can read contact" on public.campus_member_private for select to authenticated
 using(exists(select 1 from public.campus_connect_requests r where r.owner_id=campus_member_private.user_id
 and r.requester_id=(select auth.uid()) and r.status='approved'));

create table if not exists public.campus_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 college_id uuid not null references public.colleges(id) on delete cascade,
 notification_type text not null check(notification_type in ('request','approved','declined','info')),
 message text not null, post_id uuid references public.campus_posts(id) on delete cascade,
 request_id uuid references public.campus_connect_requests(id) on delete cascade,
 read_at timestamptz, created_at timestamptz not null default now()
);
alter table public.campus_notifications enable row level security;
drop policy if exists "Members read own campus notifications" on public.campus_notifications;
create policy "Members read own campus notifications" on public.campus_notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Members mark own campus notifications read" on public.campus_notifications;
create policy "Members mark own campus notifications read" on public.campus_notifications for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table if not exists public.campus_post_saves (
 user_id uuid not null references auth.users(id) on delete cascade, post_id uuid not null references public.campus_posts(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,post_id)
);
alter table public.campus_post_saves enable row level security;
drop policy if exists "Members manage own saved campus posts" on public.campus_post_saves;
create policy "Members manage own saved campus posts" on public.campus_post_saves for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(
 select 1 from public.campus_posts p where p.id=post_id and (p.visibility='all' or p.college_id=current_campus_college_id())));

create table if not exists public.campus_post_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
 college_id uuid not null references public.colleges(id) on delete cascade,
 post_id uuid not null references public.campus_posts(id) on delete cascade, reason text not null,
 created_at timestamptz not null default now(), unique(reporter_id,post_id)
);
alter table public.campus_post_reports enable row level security;
drop policy if exists "Members submit reports for campus posts" on public.campus_post_reports;
create policy "Members submit reports for campus posts" on public.campus_post_reports for insert to authenticated
 with check(reporter_id=(select auth.uid()) and college_id=current_campus_college_id()
 and exists(select 1 from public.campus_posts p where p.id=post_id and (p.visibility='all' or p.college_id=current_campus_college_id())));
drop policy if exists "Members see their own campus reports" on public.campus_post_reports;
create policy "Members see their own campus reports" on public.campus_post_reports for select to authenticated using(reporter_id=(select auth.uid()));
drop policy if exists "College admins review campus reports" on public.campus_post_reports;
create policy "College admins review campus reports" on public.campus_post_reports for select to authenticated
 using(exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role='college_admin'
 and p.college_id=campus_post_reports.college_id and p.is_active=true));

drop policy if exists "Campus members read own college board" on public.campus_posts;
drop policy if exists "Campus members read permitted campus board posts" on public.campus_posts;
create policy "Campus members read permitted campus board posts" on public.campus_posts for select to authenticated using(
 exists(select 1 from public.campus_members m where m.user_id=(select auth.uid()))
 and (visibility='all' or college_id=current_campus_college_id())
 and ((status<>'hidden') or user_id=(select auth.uid()) or exists(select 1 from public.profiles p
 where p.user_id=(select auth.uid()) and p.role='college_admin' and p.college_id=campus_posts.college_id and p.is_active=true)));

create or replace function public.update_campus_member_profile(p_full_name text,p_academic_year text,p_whatsapp_phone text)
returns void language plpgsql security definer set search_path=public as $$
declare v_college uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in first.'; end if;
 select college_id into v_college from public.campus_members where user_id=auth.uid();
 if v_college is null then raise exception 'Verified campus membership is required.'; end if;
 if length(trim(coalesce(p_full_name,''))) not between 1 and 50 then raise exception 'Enter a valid display name.'; end if;
 if p_academic_year not in ('1st Year','2nd Year','3rd Year','4th Year','Postgraduate') then raise exception 'Choose a valid academic year.'; end if;
 if coalesce(p_whatsapp_phone,'')<>'' and p_whatsapp_phone !~ '^[+]?[0-9][0-9 -]{6,15}$' then raise exception 'Enter a valid WhatsApp number.'; end if;
 update public.campus_members set full_name=trim(p_full_name),academic_year=p_academic_year,updated_at=now() where user_id=auth.uid();
 insert into public.campus_member_private(user_id,college_id,whatsapp_phone,updated_at)
 values(auth.uid(),v_college,nullif(trim(p_whatsapp_phone),''),now())
 on conflict(user_id) do update set whatsapp_phone=excluded.whatsapp_phone,updated_at=now();
end $$;
revoke all on function public.update_campus_member_profile(text,text,text) from public;
revoke all on function public.update_campus_member_profile(text,text,text) from anon;
grant execute on function public.update_campus_member_profile(text,text,text) to authenticated;

create or replace function public.respond_to_campus_connect_request(p_request_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare r public.campus_connect_requests%rowtype; v_phone text;
begin
 if auth.uid() is null then raise exception 'Please sign in first.'; end if;
 select * into r from public.campus_connect_requests where id=p_request_id for update;
 if not found or r.owner_id<>auth.uid() then raise exception 'Request not found or not yours to respond to.'; end if;
 if r.status<>'pending' then raise exception 'This request has already been answered.'; end if;
 if p_approve then select whatsapp_phone into v_phone from public.campus_member_private where user_id=auth.uid();
 if coalesce(v_phone,'')='' then raise exception 'Add your WhatsApp number in Settings first.'; end if; end if;
 update public.campus_connect_requests set status=case when p_approve then 'approved' else 'declined' end,responded_at=now() where id=p_request_id;
 insert into public.campus_notifications(user_id,college_id,notification_type,message,post_id,request_id)
 values(r.requester_id,r.college_id,case when p_approve then 'approved' else 'declined' end,
 case when p_approve then r.owner_name||' accepted your request. You can now message them on WhatsApp.'
 else r.owner_name||' declined your connection request.' end,r.post_id,r.id);
end $$;
revoke all on function public.respond_to_campus_connect_request(uuid,boolean) from public;
revoke all on function public.respond_to_campus_connect_request(uuid,boolean) from anon;
grant execute on function public.respond_to_campus_connect_request(uuid,boolean) to authenticated;

create or replace function public.campus_connect_request_notify_owner()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.campus_notifications(user_id,college_id,notification_type,message,post_id,request_id)
 values(new.owner_id,new.college_id,'request',new.requester_name||' wants to connect about your post.',new.post_id,new.id);
 return new;
end $$;
drop trigger if exists campus_connect_request_notify_owner on public.campus_connect_requests;
create trigger campus_connect_request_notify_owner after insert on public.campus_connect_requests
 for each row execute function public.campus_connect_request_notify_owner();
revoke all on function public.campus_connect_request_notify_owner() from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campus-post-images','campus-post-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Campus post images are publicly viewable" on storage.objects;
create policy "Campus post images are publicly viewable" on storage.objects for select to public using(bucket_id='campus-post-images');
drop policy if exists "Campus members upload own images" on storage.objects;
create policy "Campus members upload own images" on storage.objects for insert to authenticated
 with check(bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Campus members update own images" on storage.objects;
create policy "Campus members update own images" on storage.objects for update to authenticated
 using(bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Campus members delete own images" on storage.objects;
create policy "Campus members delete own images" on storage.objects for delete to authenticated
 using(bucket_id='campus-post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_posts') then alter publication supabase_realtime add table public.campus_posts; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='campus_notifications') then alter publication supabase_realtime add table public.campus_notifications; end if;
end $$;
commit;
