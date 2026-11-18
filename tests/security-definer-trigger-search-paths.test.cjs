'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20261119000300_pin_security_definer_trigger_search_paths.sql'), 'utf8');
for (const fn of ['campus_connect_request_notify_owner','hapn_clear_private_chat_on_end','hapn_delete_old_group_messages']) {
  const start = migration.indexOf('function public.' + fn);
  assert.ok(start >= 0, 'Missing hardened trigger function: ' + fn);
  const end = migration.indexOf('$function$', migration.indexOf('as $function$', start) + 12);
  const definition = migration.slice(start, end);
  assert.match(definition, /security definer/i, fn + ' must remain SECURITY DEFINER');
  assert.match(definition, /set search_path\s*=\s*''/i, fn + ' must use an empty search_path');
}
console.log('SECURITY DEFINER trigger search-path checks passed.');
