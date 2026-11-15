-- Campus Board college-domain allowlist and verified student membership.
-- Apply after 20261112_multi_college_platform.sql.
begin;

create table if not exists public.college_email_domains (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  domain text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint college_email_domains_format check (
    domain = lower(domain)
    and domain !~ '^@'
    and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);
create unique index if not exists college_email_domains_domain_uidx
  on public.college_email_domains (domain);
create index if not exists college_email_domains_college_idx
  on public.college_email_domains (college_id, is_active);

create table if not exists public.campus_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  college_id uuid not null references public.colleges(id) on delete restrict,
  full_name text,
  academic_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists campus_members_email_uidx
  on public.campus_members (lower(email));
create index if not exists campus_members_college_idx
  on public.campus_members (college_id);

alter table public.college_email_domains enable row level security;
alter table public.campus_members enable row level security;

grant select on public.college_email_domains to anon, authenticated;
grant insert, update, delete on public.college_email_domains to authenticated;
grant select on public.campus_members to authenticated;
revoke update on public.campus_members from authenticated;
grant update (full_name, academic_year, updated_at) on public.campus_members to authenticated;

drop policy if exists "Public can check active college email domains" on public.college_email_domains;
create policy "Public can check active college email domains"
  on public.college_email_domains for select to anon, authenticated
  using (is_active = true);
drop policy if exists "Super admins manage college email domains" on public.college_email_domains;
create policy "Super admins manage college email domains"
  on public.college_email_domains for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Campus members read own profile" on public.campus_members;
create policy "Campus members read own profile"
  on public.campus_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());
drop policy if exists "Campus members update own profile" on public.campus_members;
create policy "Campus members update own profile"
  on public.campus_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Atomic domain replacement: only a verified Super Admin can edit mappings.
create or replace function public.set_college_email_domains(p_college_id uuid, p_domains text[])
returns setof public.college_email_domains
language plpgsql security definer set search_path = ''
as $$
declare normalized text[];
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Super Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.colleges c where c.id = p_college_id) then
    raise exception 'College not found';
  end if;

  select coalesce(array_agg(distinct lower(trim(both '.' from trim(d)))),'{}'::text[])
    into normalized
  from unnest(coalesce(p_domains,'{}'::text[])) d
  where trim(d) <> '';

  if exists (
    select 1 from unnest(normalized) d
    where d !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ) then raise exception 'Enter valid domains only, e.g. college.edu.in'; end if;

  if exists (
    select 1 from public.college_email_domains x
    where x.domain = any(normalized) and x.college_id <> p_college_id
  ) then raise exception 'One or more domains are already assigned to another college'; end if;

  update public.college_email_domains
    set is_active = false, updated_at = now()
    where college_id = p_college_id;

  insert into public.college_email_domains (college_id, domain, is_active, updated_at)
  select p_college_id, d, true, now() from unnest(normalized) d
  on conflict (domain) do update
    set is_active = true, updated_at = now()
    where public.college_email_domains.college_id = excluded.college_id;

  return query
    select * from public.college_email_domains
    where college_id = p_college_id and is_active = true
    order by domain;
end;
$$;
revoke all on function public.set_college_email_domains(uuid,text[]) from public, anon;
grant execute on function public.set_college_email_domains(uuid,text[]) to authenticated;

-- A newly created Auth account is mapped to a college only when its exact email
-- domain is on the Super Admin allowlist. Pending College Admin invitations are
-- left to the existing admin activation workflow.
create or replace function public.handle_campus_member_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare email_domain text; mapped_college uuid;
begin
  if exists (select 1 from public.profiles p where p.user_id = new.id)
     or exists (select 1 from public.admin_invitations i
                where lower(i.email) = lower(new.email)
                  and i.status = 'pending' and i.expires_at > now()) then
    return new;
  end if;

  email_domain := lower(split_part(coalesce(new.email,''),'@',2));
  select d.college_id into mapped_college
  from public.college_email_domains d
  join public.colleges c on c.id = d.college_id and c.is_active = true
  where d.domain = email_domain and d.is_active = true
  limit 1;

  if mapped_college is null then
    raise exception 'This email domain is not approved for Campus Board';
  end if;

  insert into public.campus_members(user_id,email,college_id,full_name)
  values (new.id, lower(new.email), mapped_college,
          nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')),''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_campus_member_signup() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_campus_member on auth.users;
create trigger on_auth_user_created_campus_member
  after insert on auth.users
  for each row execute function public.handle_campus_member_signup();

-- Also supports accounts that existed before this migration. The email is read
-- from auth.users, never trusted from browser-supplied parameters.
create or replace function public.ensure_campus_member()
returns table(user_id uuid, email text, college_id uuid, college_name text, full_name text, academic_year text)
language plpgsql security definer set search_path = ''
as $$
declare current_email text; mapped_college uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles p where p.user_id = auth.uid()) then
    raise exception 'Admin accounts must use the Hapn Admin portal';
  end if;

  select lower(u.email) into current_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if current_email is null then raise exception 'Verify your email before entering Campus Board'; end if;

  select d.college_id into mapped_college
  from public.college_email_domains d
  join public.colleges c on c.id = d.college_id and c.is_active = true
  where d.domain = lower(split_part(current_email,'@',2)) and d.is_active = true
  limit 1;
  if mapped_college is null then
    raise exception 'This college email domain is not currently approved';
  end if;

  insert into public.campus_members(user_id,email,college_id)
  values (auth.uid(),current_email,mapped_college)
  on conflict (user_id) do update
    set email = excluded.email,
        college_id = excluded.college_id,
        updated_at = now();

  return query
  select m.user_id,m.email,m.college_id,c.name,m.full_name,m.academic_year
  from public.campus_members m
  join public.colleges c on c.id=m.college_id
  where m.user_id=auth.uid();
end;
$$;
revoke all on function public.ensure_campus_member() from public, anon;
grant execute on function public.ensure_campus_member() to authenticated;

commit;
