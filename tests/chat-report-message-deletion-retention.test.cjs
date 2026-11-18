'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000900_snapshot_chat_report_evidence_on_message_delete.sql'),
  'utf8'
);

for (const [table, messageTable, functionName] of [
  ['chat_reports', 'chat_messages', 'hapn_snapshot_public_chat_report_before_message_delete'],
  ['chat_private_reports', 'chat_private_messages', 'hapn_snapshot_private_chat_report_before_message_delete']
]) {
  assert.match(migration, new RegExp('update public\\.' + table + '[\\s\\S]*?message_snapshot = pg_catalog\\.left\\(old\\.body, 500\\)[\\s\\S]*?message_created_at = old\\.created_at', 'i'));
  assert.match(migration, new RegExp('where r\\.message_id = old\\.id[\\s\\S]*?and r\\.message_snapshot is null', 'i'));
  assert.match(migration, new RegExp('before delete on public\\.' + messageTable, 'i'));
  assert.match(migration, new RegExp('execute function public\\.' + functionName + '\\(\\)', 'i'));
  assert.match(migration, new RegExp('revoke all on function public\\.' + functionName + '\\(\\) from public, anon, authenticated', 'i'));
}
assert.match(migration, /Apply migration 20261119000350_preserve_private_chat_report_evidence\.sql/i);\nassert.match(migration, /c\.confdeltype = 'n'/i);\nassert.match(migration, /on delete set null/i);
assert.match(migration, /set search_path = ''/i);
console.log('Chat message deletion report-evidence snapshot checks passed.');
