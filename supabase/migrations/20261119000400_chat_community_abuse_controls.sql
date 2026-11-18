-- Serialize per-user chat writes so concurrent requests cannot race the rate checks.
create or replace function public.enforce_chat_message_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $
begin
  -- Never trust client-supplied timestamps for rate-limit accounting.
  new.created_at := pg_catalog.clock_timestamp();

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chat-message:' || new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.chat_messages m
    where m.user_id = new.user_id
      and m.created_at > pg_catalog.now() - interval '2 seconds'
  ) then
    raise exception 'Please wait a moment before sending another message.'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)
    from public.chat_messages m
    where m.user_id = new.user_id
      and m.created_at > pg_catalog.now() - interval '1 minute'
  ) >= 20 then
    raise exception 'Message limit reached. Please try again in a minute.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

-- Community posts/comments are guest-authenticated, so enforce abuse controls
-- in PostgreSQL rather than relying on browser-side disabled buttons.
create or replace function public.enforce_chat_community_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_recent_count integer;
begin
  -- Client-supplied created_at values must not bypass per-user limits.
  new.created_at := pg_catalog.clock_timestamp();

  if new.author_id is null then
    raise exception 'A chat identity is required.' using errcode = '42501';
  end if;

  if tg_table_name = 'chat_community_posts' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('community-post:' || new.author_id::text, 0)
    );

    if exists (
      select 1 from public.chat_community_posts p
      where p.author_id = new.author_id
        and p.created_at > pg_catalog.now() - interval '30 seconds'
    ) then
      raise exception 'Please wait before publishing another community post.'
        using errcode = 'P0001';
    end if;

    select count(*) into v_recent_count
    from public.chat_community_posts p
    where p.author_id = new.author_id
      and p.created_at > pg_catalog.now() - interval '1 hour';

    if v_recent_count >= 5 then
      raise exception 'Community post limit reached. Please try again later.'
        using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'chat_community_comments' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('community-comment:' || new.author_id::text, 0)
    );

    if exists (
      select 1 from public.chat_community_comments c
      where c.author_id = new.author_id
        and c.created_at > pg_catalog.now() - interval '2 seconds'
    ) then
      raise exception 'Please wait before adding another comment.'
        using errcode = 'P0001';
    end if;

    select count(*) into v_recent_count
    from public.chat_community_comments c
    where c.author_id = new.author_id
      and c.created_at > pg_catalog.now() - interval '1 hour';

    if v_recent_count >= 40 then
      raise exception 'Community comment limit reached. Please try again later.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_community_posts_rate_limit on public.chat_community_posts;
create trigger chat_community_posts_rate_limit
before insert on public.chat_community_posts
for each row execute function public.enforce_chat_community_rate_limit();

drop trigger if exists chat_community_comments_rate_limit on public.chat_community_comments;
create trigger chat_community_comments_rate_limit
before insert on public.chat_community_comments
for each row execute function public.enforce_chat_community_rate_limit();

create index if not exists chat_community_posts_author_created_idx
  on public.chat_community_posts (author_id, created_at desc);
create index if not exists chat_community_comments_author_created_idx
  on public.chat_community_comments (author_id, created_at desc);

-- Database constraints are authoritative even when a client bypasses maxlength.
alter table public.chat_messages
  add constraint chat_messages_body_length_check
  check (char_length(btrim(body)) between 1 and 500);

alter table public.chat_community_posts
  add constraint chat_community_posts_title_length_check
  check (char_length(btrim(title)) between 1 and 140),
  add constraint chat_community_posts_body_length_check
  check (char_length(btrim(body)) between 1 and 2000);

alter table public.chat_community_comments
  add constraint chat_community_comments_body_length_check
  check (char_length(btrim(body)) between 1 and 2000);
