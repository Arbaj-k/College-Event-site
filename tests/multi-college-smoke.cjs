'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const migration = read('supabase/migrations/20261112_multi_college_platform.sql');
const home = read('index.html');
const publicEvents = read('events.html');
const adminAuth = read('js/auth.js');
const adminEvents = read('js/admin.js');
const superPage = read('admin/super-admin.html');
const superJs = read('js/super-admin.js');
const edge = read('supabase/functions/super-admin-api/index.ts');
const supabaseClient = read('js/supabase.js');
const publicEventsJs = read('js/events.js');

for (const table of ['colleges','profiles','admin_invitations','event_archive']) {
  assert.ok(migration.includes('create table if not exists public.' + table), 'Missing table: ' + table);
}
assert.ok(migration.includes('Public read published events" on public.events for select to anon using'));
assert.ok(!migration.includes('Public read published events" on public.events for select to anon, authenticated'));
assert.ok(migration.includes('College admins read own events'));
assert.ok(migration.includes('college_id = public.current_college_id()'));
assert.ok(migration.includes('current_date - 7'));
assert.ok(migration.includes('grant execute on function public.archive_expired_events() to service_role'));
assert.ok(!migration.includes('grant execute on function public.archive_expired_events() to authenticated'));
assert.ok(migration.includes('event_title, college_name, event_date, event_snapshot, archived_at'));
assert.ok(!/grant\s+select\s+on\s+public\.event_archive\s+to\s+anon/i.test(migration), 'Archive must not be readable by anon');
assert.ok(!/create\\s+policy\\s+\"Public can read archived event summaries\"/i.test(migration), 'Archive must not have a public read policy');
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
for (const section of ['overview','colleges','admins','events','analytics','archive','settings']) {
  assert.ok(superPage.includes('data-view="' + section + '"'), 'Missing dashboard section: ' + section);
}
for (const action of ['invite_college_admin','finalize_admin_activation','revoke_invitation','reassign_admin','set_admin_status','delete_college_admin','archive_events']) {
  assert.ok(edge.includes(action), 'Missing Edge Function action: ' + action);
}
assert.ok(edge.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(superJs.includes('data-delete-event'));
assert.ok(superJs.includes('data-delete-college'));
assert.ok(superJs.includes('Original event records remain unchanged'));
assert.ok(!superJs.includes('permanently remove all events'));
console.log('Multi-college smoke checks passed.');
