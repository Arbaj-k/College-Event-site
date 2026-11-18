'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const migration = read('supabase/migrations/20261112_multi_college_platform.sql');
const disableArchiveMigration = read('supabase/migrations/20261115000600_disable_event_archive.sql');
const home = read('index.html');
const publicEvents = read('events.html');
const adminAuth = read('js/auth.js');
const adminEvents = read('js/admin.js');
const superPage = read('admin/super-admin.html');
const superJs = read('js/super-admin.js');
const edge = read('supabase/functions/super-admin-api/index.ts');
const supabaseClient = read('js/supabase.js');
const publicEventsJs = read('js/events.js');
const campusDomains = read('supabase/migrations/20261115000000_campus_board_email_domains.sql');
const campusPosts = read('supabase/migrations/20261115000100_campus_board_posts.sql');
const campusAdminRbac = read('supabase/migrations/20261119000100_campus_board_admin_rbac_hardening.sql');
const campusLogin = read('connect/index.html');
const campusBoard = read('connect/board/index.html');

for (const table of ['colleges','profiles','admin_invitations','event_archive']) {
  assert.ok(migration.includes('create table if not exists public.' + table), 'Missing table: ' + table);
}
assert.ok(migration.includes('Public read published events" on public.events for select to anon using'));
assert.ok(!migration.includes('Public read published events" on public.events for select to anon, authenticated'));
assert.ok(migration.includes('College admins read own events'));
assert.ok(migration.includes('college_id = public.current_college_id()'));
assert.ok(!/grant\s+select\s+on\s+public\.event_archive\s+to\s+anon/i.test(migration), 'Archive must not be readable by anon');
assert.ok(!/create\s+policy\s+\"Public can read archived event summaries\"/i.test(migration), 'Archive must not have a public read policy');
assert.ok(migration.includes('create policy "Super admins manage archive"'), 'Archive must be Super Admin-only');
assert.ok(migration.includes('to_jsonb(e)'));
assert.ok(migration.includes('source_event_id uuid not null unique'));
assert.ok(!/delete\s+from\s+public\.events/i.test(migration), 'Archive must never delete original events');
assert.ok(migration.includes("values ('Legacy / Unassigned'"));
assert.ok(migration.includes("'college_admin', c.id, true"), 'Legacy Admins must remain College Admins');
assert.ok(migration.includes("'720be4a2-d704-4021-8fdd-80d23272a3da', 'mdarbaj62167@gmail.com', 'Platform Owner', 'super_admin'"), 'Only the explicitly designated owner UID is bootstrapped as Super Admin');
assert.ok(migration.includes('from public.admins a'), 'Existing Admin accounts must be preserved');
assert.ok(!/super-admin-login|super-admin\.html/i.test(home + publicEvents));
assert.ok(adminAuth.includes("profile.role !== 'college_admin'"));
assert.ok(adminEvents.includes('payload.college_id = CE.currentProfile.college_id'));
assert.ok(supabaseClient.includes('window.sbPublic'));
assert.ok(publicEventsJs.includes('const publicDb = window.sbPublic || window.sb'));
assert.ok(superPage.includes('name="robots" content="noindex,nofollow"'));
for (const section of ['overview','colleges','admins','events','analytics','settings']) {
  assert.ok(superPage.includes('data-view="' + section + '"'), 'Missing dashboard section: ' + section);
}
for (const action of ['invite_college_admin','finalize_admin_activation','revoke_invitation','reassign_admin','set_admin_status','delete_college_admin']) {
  assert.ok(edge.includes(action), 'Missing Edge Function action: ' + action);
}
assert.ok(edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(superJs.includes('data-delete-event'));
assert.ok(superJs.includes('data-delete-college'));
assert.ok(!superJs.includes('loadArchive'));
assert.ok(!superJs.includes('run-archive'));
assert.ok(!superPage.includes('Event Archive'));
assert.ok(!home.includes('/archive.html'));
assert.ok(!publicEvents.includes('/archive.html'));
assert.ok(!edge.includes('archive_events'));
assert.ok(disableArchiveMigration.includes('cron.unschedule'));
assert.ok(disableArchiveMigration.includes('drop function if exists public.archive_expired_events()'));
assert.ok(!/drop table[^;]*event_archive/i.test(disableArchiveMigration));
assert.ok(!superJs.includes('permanently remove all events'));


assert.ok(campusDomains.includes('create table if not exists public.college_email_domains'));
assert.ok(campusDomains.includes('create table if not exists public.campus_members'));
assert.ok(campusDomains.includes('public.set_college_email_domains'));
assert.ok(campusDomains.includes('public.ensure_campus_member'));
assert.ok(campusDomains.includes('on_auth_user_created_campus_member'));
assert.ok(campusDomains.includes('public.is_super_admin()'));
assert.ok(campusPosts.includes('create table if not exists public.campus_posts'));
assert.ok(campusPosts.includes('Campus members read own college board'));
assert.ok(campusPosts.includes('college_id=public.current_campus_college_id()'));
assert.ok(campusLogin.includes("signInWithOAuth({provider:'google'"), 'Campus login must use Google OAuth');
assert.ok(campusLogin.includes('exchangeCodeForSession(code)'), 'OAuth callback must exchange the authorization code');
assert.ok(campusLogin.includes("session.user.app_metadata?.provider!=='google'"), 'Only Google provider sessions are accepted');
assert.ok(campusLogin.includes("from('college_email_domains')"), 'Login must check the college domain allowlist');
assert.ok(campusLogin.includes("rpc('ensure_campus_member')"), 'Login must verify campus membership server-side');
assert.ok(campusLogin.includes("location.replace(nextPath)"), 'Campus login must preserve Share N Care deep links');
assert.ok(campusLogin.includes("sessionStorage.setItem('hapn-connect-next',nextPath)"), 'Campus login must preserve deep links through OAuth');
assert.ok(campusBoard.includes("from('campus_posts')"));
assert.ok(campusBoard.includes("ensure_campus_member"));
assert.ok(home.includes('class="campus-board-card"'));
assert.ok(home.includes('href="/connect/"'));
const shareCareMigration = read('supabase/migrations/20261115190000_sharencare_home_carousel.sql');
assert.ok(shareCareMigration.includes('get_sharencare_home_preview'));
assert.ok(shareCareMigration.includes('mark_sharencare_opened'));
assert.ok(shareCareMigration.includes('sharencare_opened_at'));
assert.ok(publicEventsJs.includes('sharencare_card_a_impression'));
assert.ok(publicEventsJs.includes('sharencare_card_b_impression'));
assert.ok(publicEventsJs.includes('sharencare_card_a_post_click'));
assert.ok(publicEventsJs.includes('prefers-reduced-motion: reduce'));
assert.ok(campusBoard.includes('mark_sharencare_opened'));
assert.ok(campusBoard.includes('params.get(\'post\')'));
assert.ok(home.includes('20261116sharencare2'));
assert.ok(campusAdminRbac.includes('campus_posts_identity_immutable'));
assert.ok(campusAdminRbac.includes('new.user_id is distinct from old.user_id'));
assert.ok(campusAdminRbac.includes('new.college_id is distinct from old.college_id'));
assert.ok(campusAdminRbac.includes('Super admins read all campus posts'));
assert.ok(campusAdminRbac.includes('Super admins update all campus posts'));
assert.ok(campusAdminRbac.includes('Super admins delete all campus posts'));
assert.ok(campusAdminRbac.includes('Super admins review all campus reports'));
assert.ok(edge.includes('activation_profile_lookup_failed'));
assert.ok(edge.includes('A Super Admin account cannot be activated through a College Admin invitation.'));
assert.ok(edge.includes('This account already has an admin profile. Ask a Super Admin to manage its role.'));
assert.ok(edge.includes('.from("profiles").insert('), 'Invitation activation must use an insert, not an upsert');
assert.ok(edge.includes('profileErr.code === "23505"'), 'Unique constraint must guard activation races');
assert.ok(edge.includes('.select("id")'), 'Invitation consumption must confirm a pending row was actually updated');
assert.ok(edge.includes('This invitation has already been used or is no longer pending.'), 'Concurrent invitation consumption must be rejected');



console.log('Multi-college and Campus Board smoke checks passed.');
