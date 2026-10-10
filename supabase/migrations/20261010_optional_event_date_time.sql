-- Make event start date/time optional so admins can publish events before details are confirmed.
-- Run this migration in Supabase Dashboard > SQL Editor for an existing project.
alter table public.events
  alter column "date" drop not null,
  alter column "time" drop not null;
