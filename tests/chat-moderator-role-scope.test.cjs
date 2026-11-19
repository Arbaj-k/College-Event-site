'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119001000_chat_moderator_role_scope.sql'),
  'utf8'
);

assert.match(migration, /create or replace function public\.is_chat_moderator\(\)/i);
assert.match(migration, /public\.is_real_campus_user\(\)/i);
assert.match(migration, /p\.role = 'super_admin'[\s\S]*?p\.is_active = true/i);
assert.doesNotMatch(migration, /from public\.admins|a\.role = 'admin'|public\.is_admin\(\)/i,
  'Legacy admins-table membership must not grant global chat moderation');
assert.match(migration, /revoke all on function public\.is_chat_moderator\(\) from public, anon/i);
assert.match(migration, /grant execute on function public\.is_chat_moderator\(\) to authenticated/i);
for (const policy of [
  'Chat moderators review reports',
  'Chat moderators update reports',
  'Chat moderators read messages',
  'Chat moderators update messages',
  'Reporters and chat moderators read private reports',
  'Chat moderators update private reports',
  'Private participants and chat moderators read conversations',
  'Private participants and chat moderators read messages'
]) assert.ok(migration.includes(policy), 'missing policy: '+policy);
console.log('Chat moderator role-scope checks passed.');
