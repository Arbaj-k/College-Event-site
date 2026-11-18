'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000800_preserve_chat_reports_on_account_deletion.sql'),
  'utf8'
);

for (const table of ['chat_reports', 'chat_private_reports']) {
  assert.match(migration, new RegExp('alter table public\\.' + table + '[\\s\\S]*?alter column reporter_id drop not null', 'i'));
  assert.match(migration, new RegExp('alter table public\\.' + table + '[\\s\\S]*?drop constraint if exists ' + table + '_reporter_id_fkey', 'i'));
  assert.match(migration, new RegExp('alter table public\\.' + table + '[\\s\\S]*?add constraint ' + table + '_reporter_id_fkey[\\s\\S]*?references auth\\.users\\(id\\)[\\s\\S]*?on delete set null', 'i'));
}
assert.doesNotMatch(migration, /on delete cascade/i);
console.log('Chat report account-deletion retention checks passed.');
