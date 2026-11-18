'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000400_preserve_private_chat_report_evidence.sql'),
  'utf8'
);

assert.match(migration, /add column if not exists message_snapshot text/i);
assert.match(migration, /add column if not exists message_created_at timestamptz/i);
assert.match(migration, /alter column message_id drop not null/i);
assert.match(migration, /on delete set null/i);
assert.match(migration, /update public\.chat_private_reports r[\s\S]*?set message_snapshot = pg_catalog\.left\(m\.body, 500\)/i);
assert.match(migration, /message_created_at = m\.created_at/i);
assert.match(migration, /where m\.conversation_id = new\.id[\s\S]*?and r\.message_id = m\.id/i);
assert.match(migration, /delete from public\.chat_private_messages[\s\S]*?where conversation_id = new\.id/i);
assert.match(migration, /set search_path to ''/i);
console.log('Private chat report retention smoke checks passed.');
