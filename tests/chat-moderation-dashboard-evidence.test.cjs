'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['admin/chat-moderation/index.html', 'admin/chat-moderation.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert.match(html, /first 10,000 reports per report type[\s\S]*?dashboard has no date filter yet/i);
  assert.match(html, /async function fetchAllReports\(table\)/);
  assert.match(html, /\.range\(from,to\)/);
  assert.match(html, /message_snapshot,message_created_at/);
  assert.match(html, /async function fetchMessagesByIds\(table,ids,columns\)/);
  assert.match(html, /i\+=100/);
  assert.match(html, /Preserved message evidence/);
  assert.match(html, /Preserved private-message evidence/);
  assert.match(html, /Reporter account: anonymized or unavailable/);
  assert.match(html, /\.eq\('status',report\.status\)\.select\('id'\)\.maybeSingle\(\)/);
  assert.match(html, /\.is\('deleted_at',null\)\.select\('id'\)\.maybeSingle\(\)/);
  assert.match(html, /already updated by another moderator/);
  assert.match(html, /already changed by another moderator/);
  assert.match(html, /let auditPage=0/);
  assert.match(html, /auditPageSize=200/);
  assert.match(html, /\.range\(from,to\)/);
  assert.match(html, /auditPrev/);
  assert.match(html, /auditNext/);
  assert.match(html, /order\('id',\{ascending:false\}\)/);
  assert.match(html, /actor_role/);
  assert.ok(html.includes("Role: '+(item.actor_role||'unknown')"));
  assert.doesNotMatch(html, /from\('chat_reports'\)[\s\S]{0,180}\.limit\(100\)/);
  assert.doesNotMatch(html, /from\('chat_private_reports'\)[\s\S]{0,180}\.limit\(100\)/);
}
console.log('Chat moderation dashboard pagination and evidence display checks passed.');
