'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000700_lock_down_private_chat_report_moderation.sql'),
  'utf8'
);

assert.match(migration, /revoke delete, truncate[\s\S]*?chat_private_reports[\s\S]*?chat_private_messages[\s\S]*?chat_private_conversations[\s\S]*?from public, anon, authenticated/i);
assert.match(migration, /revoke update[\s\S]*?on table public\.chat_private_reports[\s\S]*?from public, anon, authenticated/i);
assert.match(migration, /grant update \(status\)[\s\S]*?on table public\.chat_private_reports[\s\S]*?to authenticated/i);
assert.doesNotMatch(migration, /grant\s+(?:all|delete|truncate)\b/i);
console.log('Private chat report moderation privilege checks passed.');
