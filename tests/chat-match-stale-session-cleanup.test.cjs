'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20261119000500_chat_match_stale_session_cleanup.sql'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '..', 'js/anonymous-chat-v3.js'), 'utf8');

assert.match(sql, /chat_match_cleanup_stale/);
assert.match(sql, /message_snapshot/);
assert.match(sql, /message_created_at/);
assert.match(sql, /confdeltype = 'n'/);
assert.match(sql, /hapn_guard_private_chat_report_insert/);
assert.match(sql, /Apply private chat report retention migration \(20261119000350\)/);
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

// Reload recovery reads only the current anonymous user's own queue row.
assert.match(client, /from\('chat_match_queue'\)\.select\('status,nickname'\)\.eq\('user_id',currentUser\.id\)/);
assert.match(client, /queue\.status==='waiting'\|\|queue\.status==='matched'/);
// Initialization must preserve a restored match instead of replacing its status.
assert.match(client, /status\.textContent=privateConversation\?'Matched privately':\(isSearching\?'Waiting for a student…':'Ready to match'\)/);
console.log('Chat matchmaking stale-session cleanup and reload recovery smoke checks passed.');
