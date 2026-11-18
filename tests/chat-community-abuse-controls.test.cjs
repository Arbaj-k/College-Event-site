'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/migrations/20261119000400_chat_community_abuse_controls.sql'),
  'utf8'
);

assert.match(migration, /pg_advisory_xact_lock[\s\S]*chat-message:/);
assert.match(migration, /interval '2 seconds'/);
assert.match(migration, /interval '1 minute'[\s\S]*>= 20/);
assert.match(migration, /chat_community_posts_rate_limit/);
assert.match(migration, /chat_community_comments_rate_limit/);
assert.match(migration, /interval '30 seconds'/);
assert.match(migration, /interval '1 hour'[\s\S]*>= 5/);
assert.match(migration, /interval '2 seconds'[\s\S]*>= 40/);
assert.match(migration, /chat_messages_body_length_check/);
assert.match(migration, /chat_community_posts_title_length_check/);
assert.match(migration, /chat_community_posts_body_length_check/);
assert.match(migration, /chat_community_comments_body_length_check/);
assert.match(migration, /set search_path = ''/);
assert.doesNotMatch(migration, /security\s+definer/i);
console.log('Chat community abuse-control smoke checks passed.');
