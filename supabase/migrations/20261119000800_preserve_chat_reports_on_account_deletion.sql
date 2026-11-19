-- Preserve moderation evidence while removing the deleted account reference.
-- Reports remain visible to admins; reporter identity is intentionally anonymized.
begin;

alter table public.chat_reports
  alter column reporter_id drop not null;
alter table public.chat_reports
  drop constraint if exists chat_reports_reporter_id_fkey;
alter table public.chat_reports
  add constraint chat_reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id)
  on delete set null;

alter table public.chat_private_reports
  alter column reporter_id drop not null;
alter table public.chat_private_reports
  drop constraint if exists chat_private_reports_reporter_id_fkey;
alter table public.chat_private_reports
  add constraint chat_private_reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id)
  on delete set null;

commit;
