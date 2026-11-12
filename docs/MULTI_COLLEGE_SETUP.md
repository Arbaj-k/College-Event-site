# Hapn multi-college platform setup

This change is isolated to branch `multi-college-platform-v1`. It does not add any Super Admin link or button to the public website. The restricted entry points are:

- Super Admin sign-in: `/admin/super-admin-login.html`
- Super Admin control centre: `/admin/super-admin.html`
- Existing College Admin sign-in remains: `/admin/login.html`

The Super Admin pages are `noindex` and have no public navigation link. Hiding a URL is not authorization: the page verifies the signed-in user against `profiles.role = 'super_admin'`, and the database RLS policies independently enforce the same roles.

## Required deployment steps

1. A manual backup is recommended before schema changes. If you choose to proceed without one, understand that recovery options on the Free plan are limited; this migration is designed to preserve existing event rows.
2. Confirm the existing base schema and `20261002_event_end_featured.sql` migration have been applied. The new migration uses `events.end_date`.
3. Apply `supabase/migrations/20261112_multi_college_platform.sql` in Supabase SQL Editor.
4. Create the first owner account in Supabase Authentication (email/password), confirm it, and copy its Auth user UUID.
5. Insert exactly that user as the first Super Admin using the SQL below. Do not promote every legacy row from `admins`.

```sql
insert into public.profiles (user_id, email, full_name, role, college_id, is_active)
values ('AUTH-USER-UUID', 'owner@example.com', 'Platform Owner', 'super_admin', null, true);
```

6. Deploy the Edge Function directory `supabase/functions/super-admin-api` as function name `super-admin-api`. Configure its secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (the public/publishable project key)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only; never put this in the website)
   - `APP_ORIGIN=https://hapn.info`
   - `ADMIN_INVITE_REDIRECT=https://hapn.info/admin/accept-invite.html`
7. In Supabase Auth URL Configuration, allow `https://hapn.info/admin/accept-invite.html` as a redirect URL. Ensure email invitations are enabled and the email template includes the Supabase invite link.
8. Enable the `pg_cron` extension. The migration schedules `public.archive_expired_events()` daily at 02:15 UTC if pg_cron is already enabled when the migration runs. If it was enabled afterward, rerun the schedule DO block from the migration or schedule the function manually.
9. Deploy the branch to a staging site first and test the complete invite flow, College Admin RLS and public listing before merging/deploying production.

## Legacy data transition

The previous platform used a global `admins` table and had no college ownership. The migration intentionally does not guess which institution an old admin or event belongs to.

- Create the colleges first in the Super Admin control centre.
- Assign existing events to the correct college using **All Events → Edit**. Unassigned legacy events remain public if published until assigned; their College Admin ownership is not inferred.
- Existing rows in `admins` are migrated as **College Admins only**, never Super Admins, into a temporary `Legacy / Unassigned` college. Existing events without a college are assigned to that same temporary college so the current Admin workflow remains usable. Rename/split this temporary college and reassign events/admins once their actual institutions are confirmed. Example:

```sql
insert into public.profiles (user_id, email, full_name, role, college_id, is_active)
values ('VERIFIED-AUTH-USER-UUID', 'admin@example.com', 'Admin Name',
        'college_admin', 'COLLEGE-UUID', true)
on conflict (user_id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = 'college_admin',
    college_id = excluded.college_id,
    is_active = true;
```

Never trust an email-only match to assign an account; verify the Auth UID and college out of band. The migration's temporary legacy mapping is only a compatibility bridge and should be replaced with verified institution assignments.

## Security and behavior

- Super Admin actions are checked server-side by the Edge Function and database policies.
- College Admin permissions are limited by `profiles.college_id`; event insert/update/delete policies require that exact college ID. Storage writes must be under a folder named with the assigned college UUID.
- The old Admin Login is College Admin-only. The separate Super Admin login checks `profiles.role` and rejects College Admin accounts.
- Invitation links are time-limited to seven days. A user must authenticate through the invite link, choose a password and complete activation before their College Admin profile is created.
- Event archive is non-destructive. Once an event's effective end date (end date if present, otherwise start date) is at least seven days in the past, a full JSON snapshot is copied to the archive. The original event row and related records are not deleted.
- Existing ancillary modules (fests, submissions, chat/community) were not intentionally redesigned. Their use of the legacy global `is_admin()` helper remains for compatibility; audit those modules separately before granting College Admins access to moderation or submissions.
- College deletion is blocked in the dashboard while that college still has assigned admins or events. Reassign or remove them first.

## Important verification checklist

- A College Admin cannot read or mutate another college's events through direct Supabase API calls.
- A College Admin cannot upload posters outside their college UUID folder.
- A College Admin cannot access either Super Admin page after sign-in.
- An unauthenticated user cannot read the Super Admin dashboard data.
- An invitation can be accepted only by the invited email while the invitation is pending and unexpired.
- A revoked or expired invitation cannot activate a profile.
- Archive runs at the scheduled time; full snapshots are readable only by Super Admins, and anonymous users receive no archive access.
