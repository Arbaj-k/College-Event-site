-- Allow Supabase anonymous-auth guest identities to use Hapn chat without
-- being treated as Campus Board members. Email-domain validation remains
-- mandatory for normal account signups.
create or replace function public.handle_campus_member_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  email_domain text;
  mapped_college uuid;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if exists (
    select 1 from public.profiles p where p.user_id = new.id
  ) or exists (
    select 1 from public.admin_invitations i
    where lower(i.email) = lower(new.email)
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    return new;
  end if;

  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  select d.college_id into mapped_college
  from public.college_email_domains d
  join public.colleges c on c.id = d.college_id and c.is_active = true
  where d.domain = email_domain and d.is_active = true
  limit 1;

  if mapped_college is null then
    raise exception 'This email domain is not approved for Campus Board';
  end if;

  insert into public.campus_members(user_id, email, college_id, full_name)
  values (
    new.id,
    lower(new.email),
    mapped_college,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;
