'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20261119000500_chat_match_stale_session_cleanup.sql'), 'utf8');

assert.match(sql, /chat_match_cleanup_stale/);
assert.match(sql, /interval '2 minutes'/);
assert.match(sql, /interval '30 minutes'/);
assert.match(sql, /max\(m\.created_at\)/);
assert.match(sql, /set ended_at = pg_catalog\.now\(\)/);
assert.match(sql, /delete from public\.chat_match_queue q\s+using public\.chat_private_conversations c/i);
assert.match(sql, /perform public\.chat_match_cleanup_stale\(\)/);
assert.match(sql, /revoke all on function public\.chat_match_cleanup_stale\(\) from public, anon, authenticated/);
assert.match(sql, /revoke all on function public\.chat_match_start\(text\) from public, anon/);
assert.match(sql, /grant execute on function public\.chat_match_start\(text\) to authenticated/);
assert.match(sql, /set search_path = ''/);
assert.doesNotMatch(sql, /delete from public\.chat_private_messages/i);
assert.doesNotMatch(sql, /delete from public\.chat_private_reports/i);
console.log('Chat matchmaking stale-session cleanup smoke checks passed.');
