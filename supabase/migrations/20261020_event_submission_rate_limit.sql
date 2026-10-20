-- Public event submission abuse controls.
-- Limits repeat submissions by the same email address; the honeypot/minimum-time
-- checks in the browser are additional friction, not a replacement for CAPTCHA.
create or replace function public.limit_event_submission_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.event_submissions s
    where lower(s.submitter_email) = lower(new.submitter_email)
      and s.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Too many submissions from this email. Please try again later.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists event_submission_rate_limit on public.event_submissions;
create trigger event_submission_rate_limit
before insert on public.event_submissions
for each row execute function public.limit_event_submission_rate();

create index if not exists event_submissions_email_created_idx
on public.event_submissions (lower(submitter_email), created_at desc);
