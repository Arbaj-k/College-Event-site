'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'..','supabase/migrations/20261119001100_chat_moderation_audit_log.sql'),'utf8');
assert.match(sql,/Apply migration 20261119001000_chat_moderator_role_scope\.sql/i);
assert.match(sql,/create table if not exists public\.chat_moderation_audit/i);
assert.match(sql,/enable row level security/i);
assert.match(sql,/revoke all on table public\.chat_moderation_audit from public, anon, authenticated/i);
assert.match(sql,/using \(public\.is_chat_moderator\(\)\)/i);
assert.match(sql,/actor_id uuid references auth\.users\(id\) on delete set null/i);
assert.match(sql,/security definer[\s\S]*?set search_path = ''/i);
for(const name of ['chat_reports','chat_private_reports','chat_messages','chat_private_messages']){
 assert.match(sql,new RegExp('on public\\.'+name+'[\\s\\S]*?execute function public\\.hapn_audit_chat_', 'i'));
}
assert.match(sql,/old\.status is distinct from new\.status/i);
assert.match(sql,/old\.deleted_at is distinct from new\.deleted_at/i);
assert.match(sql,/before update or delete on public\.chat_moderation_audit/i);
assert.match(sql,/chat_moderation_audit is append-only/i);
assert.doesNotMatch(sql,/message body|message_snapshot|reporter email/i);
console.log('Chat moderation audit log migration checks passed.');
