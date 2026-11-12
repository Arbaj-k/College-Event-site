'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(require('node:path').join(__dirname, '..', p), 'utf8');
const migration = read('supabase/migrations/20261112_multi_college_platform.sql');
const home = read('index.html');
const publicEvents = read('events.html');
const adminAuth = read('js/auth.js');
const adminEvents = read('js/admin.js');
const superPage = read('admin/super-admin.html');
const superJs = read('js/super-admin.js');
const edge = read('supabase/functions/super-admin-api/index.ts');

for (const table of ['colleges','profiles','admin_invitations','event_archive']) {
  assert.match(migration, new RegExp('create table if not exists public\\.' + table));
}
assert.match(migration, /Public read published events" on public\\.events for select to anon using/);
assert.doesNotMatch(migration, /Public read published events" on public\\.events for select to anon, authenticated/);
assert.match(migration, /College admins read own events/);
assert.match(migration, /college_id = public\\.current_college_id\\(\\)/);
assert.match(migration, /current_date - 7/);
assert.match(migration, /event_title, college_name, event_date, archived_at/);
assert.doesNotMatch(home + publicEvents, /super-admin-login|super-admin\\.html/i);
assert.match(adminAuth, /role === 'college_admin'/);
assert.match(adminEvents, /payload\\.college_id = CE\\.currentProfile\\.college_id/);
assert.match(superPage, /name="robots" content="noindex,nofollow"/);
for (const section of ['overview','colleges','admins','events','analytics','archive','settings']) {
  assert.match(superPage, new RegExp('data-view="' + section + '"'));
}
for (const action of ['invite_college_admin','finalize_admin_activation','revoke_invitation','reassign_admin','set_admin_status','delete_college_admin']) {
  assert.ok(edge.includes(action), 'Missing Edge Function action: ' + action);
}
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(superJs, /data-delete-event/);
assert.match(superJs, /data-delete-college/);
console.log('Multi-college smoke checks passed.');
