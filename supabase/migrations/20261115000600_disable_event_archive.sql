-- Disable Hapn event archiving without deleting previously retained archive records.
begin;

do $$
declare
  scheduled_job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for scheduled_job in
      select jobid from cron.job where jobname = 'hapn-event-archive-daily'
    loop
      perform cron.unschedule(scheduled_job.jobid);
    end loop;
  end if;
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'pg_cron is not installed; no archive schedule to remove.';
end;
$$;

revoke all on function public.archive_expired_events() from public, anon, authenticated, service_role;
drop function if exists public.archive_expired_events();

-- Keep existing event_archive rows private for historical preservation.
-- The feature is no longer exposed by the app or scheduled automatically.

commit;
