'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
  '20261119001600_scope_event_submission_moderation_to_super_admin.sql'), 'utf8');

assert.match(migration, /drop policy if exists "Admins can review submissions" on public\.event_submissions/i);
assert.match(migration, /create policy "Super admins review event submissions"/i);
assert.match(migration, /for all\s+to authenticated/i);
assert.match(migration, /public\.is_real_campus_user\(\)\s+and\s+public\.is_super_admin\(\)/i);
assert.match(migration, /with check\s*\(\s*public\.is_real_campus_user\(\)\s+and\s+public\.is_super_admin\(\)/i);
assert.doesNotMatch(migration, /public\.is_admin\(\)|from public\.admins/i,
  'Legacy admins-table membership must not grant global submission moderation');
assert.doesNotMatch(migration, /drop policy[^;]*public\.event_submissions[^;]*public can submit events/i,
  'Public submission INSERT policy must remain intact');
assert.match(migration, /begin;[\s\S]*commit;/i);

console.log('Event-submission moderator role-scope checks passed.');
