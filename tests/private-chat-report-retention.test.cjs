'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000600_preserve_private_chat_report_evidence.sql'),
  'utf8'
);

assert.match(migration, /add column if not exists message_snapshot text/i);
assert.match(migration, /add column if not exists message_created_at timestamptz/i);
assert.match(migration, /alter column message_id drop not null/i);
assert.match(migration, /on delete set null/i);
assert.match(migration, /create or replace function public\.hapn_guard_private_chat_report_insert\(\)/i);
assert.match(migration, /for update of c/i);
assert.match(migration, /c\.ended_at is null/i);
assert.match(migration, /auth\.uid\(\) in \(c\.user_a, c\.user_b\)/i);
assert.match(migration, /new\.reporter_id is distinct from auth\.uid\(\)/i);
assert.match(migration, /coalesce\(\(auth\.jwt\(\) ->> 'is_anonymous'\) = 'true', false\)/i);
assert.match(migration, /before insert on public\.chat_private_reports/i);
assert.match(migration, /revoke all on function public\.hapn_guard_private_chat_report_insert\(\) from public, anon, authenticated/i);
assert.match(migration, /update public\.chat_private_reports r[\s\S]*?set message_snapshot = pg_catalog\.left\(m\.body, 500\)/i);
assert.match(migration, /message_created_at = m\.created_at/i);
assert.match(migration, /where m\.conversation_id = new\.id[\s\S]*?and r\.message_id = m\.id/i);
assert.match(migration, /delete from public\.chat_private_messages[\s\S]*?where conversation_id = new\.id/i);
assert.match(migration, /set search_path to ''/i);
console.log('Private chat report retention and serialization smoke checks passed.');
