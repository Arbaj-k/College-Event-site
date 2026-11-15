-- =====================================================================
--  Add an administrator
--  Step 1: create the user first in  Authentication > Users > Add user
--          (tick "Auto Confirm User").
--  Step 2: run ONE of the options below in the SQL Editor.
-- =====================================================================

-- Option A: paste the user's UID (Authentication > Users > click user > "User UID")
insert into public.admins (user_id, email, role)
values ('YOUR-AUTH-USER-UUID', 'admin@example.com', 'admin');

-- Option B: look the UID up by email automatically
-- insert into public.admins (user_id, email, role)
-- select id, email, 'admin' from auth.users where email = 'admin@example.com';

-- Remove an admin later:
-- delete from public.admins where email = 'admin@example.com';
