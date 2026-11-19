const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
  '20261119001400_lock_down_chat_match_queue_truncate.sql'), 'utf8');
assert.match(migration, /revoke\s+truncate\s+on\s+table\s+public\.chat_match_queue/i);
assert.match(migration, /from\s+public,\s*anon,\s*authenticated,\s*service_role/i);
assert.match(migration, /begin;/i);
assert.match(migration, /commit;/i);
console.log('chat matchmaking queue TRUNCATE privilege checks passed');
