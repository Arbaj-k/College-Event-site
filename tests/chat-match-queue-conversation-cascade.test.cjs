const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
  '20261119001500_cascade_chat_queue_on_conversation_delete.sql'), 'utf8');
assert.match(sql, /delete from public\.chat_match_queue q/i);
assert.match(sql, /not exists\s*\(\s*select 1 from public\.chat_private_conversations/i);
assert.match(sql, /foreign key\s*\(conversation_id\)/i);
assert.match(sql, /references public\.chat_private_conversations\(id\)\s*on delete cascade/i);
assert.match(sql, /pg_catalog\.pg_constraint/i);
assert.match(sql, /begin;/i);
assert.match(sql, /commit;/i);
console.log('chat queue conversation FK cascade checks passed');
