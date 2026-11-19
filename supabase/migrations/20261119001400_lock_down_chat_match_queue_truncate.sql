-- Prevent API clients from truncating the matchmaking queue.
-- Matchmaking writes are performed by SECURITY DEFINER RPCs; TRUNCATE is not
-- needed by browser clients and bypasses row-level DELETE policies.
begin;

do $preflight$
begin
  if to_regclass('public.chat_match_queue') is null then
    raise exception 'Required table public.chat_match_queue does not exist';
  end if;
end
$preflight$;

revoke truncate on table public.chat_match_queue
  from public, anon, authenticated, service_role;

commit;
