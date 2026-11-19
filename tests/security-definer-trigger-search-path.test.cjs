const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations',
  '20261119001300_harden_security_definer_trigger_search_path.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

for (const fn of [
  'campus_connect_request_notify_owner',
  'hapn_clear_private_chat_on_end',
  'hapn_delete_old_group_messages'
]) {
  const start = sql.indexOf(`create or replace function public.${fn}()`);
  assert.notEqual(start, -1, `missing hardened definition: ${fn}`);
  const next = sql.indexOf('create or replace function ', start + 1);
  const body = sql.slice(start, next === -1 ? sql.length : next);
  assert.match(body, /security definer/i, `${fn} must remain SECURITY DEFINER`);
  assert.match(body, /set search_path = ''/i, `${fn} must pin an empty search_path`);
}

assert.match(sql, /public\.campus_notifications/i);
assert.match(sql, /public\.chat_private_messages/i);
assert.match(sql, /public\.chat_messages/i);
assert.match(sql, /pg_catalog\.now\(\)/i);
console.log('SECURITY DEFINER trigger search-path hardening checks passed');
