-- Hapn Anonymous Chat: admin-only moderation read policy
-- Target: existing Hapn Supabase project (xeablvxtlxdwuiiawsgq)
-- Run this only after reviewing the current policies in Supabase SQL Editor.
-- It does not grant admin privileges; it only uses the existing public.is_admin() check.
-- Do not run if a matching admin SELECT policy already exists.

create policy chat_admin_read_messages
on public.chat_messages
for select
to authenticated
using (public.is_admin());

-- Verification:
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'chat_messages'
  and policyname = 'chat_admin_read_messages';

-- Expected: one SELECT policy for the authenticated role.
-- If the policy already exists, do not run CREATE again.
