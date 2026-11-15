-- Share N Care homepage previews: public, privacy-minimized feed + per-account opened flag.
begin;

alter table public.campus_members
  add column if not exists sharencare_opened_at timestamptz;

create or replace function public.get_sharencare_home_preview(p_college_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_college_name text;
  v_posts jsonb;
  v_recent_count integer;
begin
  select c.name into v_college_name
  from public.colleges c
  where c.id = p_college_id and c.is_active = true;

  if v_college_name is null then
    raise exception 'Choose an active college to view Share N Care previews';
  end if;

  with visible_posts as (
    select p.id, p.display_name, p.post_type, p.custom_type, p.body, p.created_at
    from public.campus_posts p
    where p.college_id = p_college_id
      and p.status = 'active'
      and (p.expires_at is null or p.expires_at > now())
      and (p.visibility='all' or (p.visibility='college' and (exists(select 1 from public.campus_members cm where cm.user_id=auth.uid() and cm.college_id=p_college_id) or exists(select 1 from public.profiles pr where pr.user_id=auth.uid() and pr.role='college_admin' and pr.is_active=true and pr.college_id=p_college_id))))
      and not exists (
        select 1 from public.campus_post_reports r where r.post_id = p.id
      )
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'initials', q.initials,
        'body', q.body,
        'post_type', q.post_type,
        'custom_type', q.custom_type,
        'created_at', q.created_at
      ) order by q.created_at desc
    ), '[]'::jsonb)
  into v_posts
  from (
    select
      v.id,
      upper(left(parts[1],1) || case when cardinality(parts) > 1 then left(parts[cardinality(parts)],1) else '' end) as initials,
      v.body,
      v.post_type,
      v.custom_type,
      v.created_at
    from visible_posts v
    cross join lateral (select regexp_split_to_array(trim(v.display_name), '\\s+') as parts) n
    order by v.created_at desc
    limit 4
  ) q;

  select count(*)::integer into v_recent_count
  from public.campus_posts p
  where p.college_id = p_college_id
    and p.status = 'active'
    and (p.expires_at is null or p.expires_at > now())
    and (p.visibility='all' or (p.visibility='college' and (exists(select 1 from public.campus_members cm where cm.user_id=auth.uid() and cm.college_id=p_college_id) or exists(select 1 from public.profiles pr where pr.user_id=auth.uid() and pr.role='college_admin' and pr.is_active=true and pr.college_id=p_college_id))))
    and p.created_at >= now() - interval '24 hours'
    and not exists (select 1 from public.campus_post_reports r where r.post_id = p.id);

  return jsonb_build_object(
    'college_name', v_college_name,
    'posts', v_posts,
    'more_today', greatest(v_recent_count - 4, 0)
  );
end;
$function$;

revoke all on function public.get_sharencare_home_preview(uuid) from public;
grant execute on function public.get_sharencare_home_preview(uuid) to anon, authenticated;

create or replace function public.mark_sharencare_opened()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.campus_members
    set sharencare_opened_at = coalesce(sharencare_opened_at, now()),
        updated_at = now()
  where user_id = auth.uid();
  return found;
end;
$function$;

revoke all on function public.mark_sharencare_opened() from public, anon;
grant execute on function public.mark_sharencare_opened() to authenticated;

commit;
