-- Keep private-chat reports immutable except for their moderation status.
-- RLS does not protect TRUNCATE, so remove destructive table privileges from browser roles.
begin;

revoke delete, truncate
on table public.chat_private_reports,
         public.chat_private_messages,
         public.chat_private_conversations
from public, anon, authenticated;

-- The moderation UI only changes status. Column-level grants prevent admins
-- from rewriting reporter identity, message linkage, reason, details, or evidence.
revoke update
on table public.chat_private_reports
from public, anon, authenticated;

grant update (status)
on table public.chat_private_reports
to authenticated;

commit;
