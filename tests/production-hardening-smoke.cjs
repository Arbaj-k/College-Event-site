'use strict';
const assert = require('node:assert/strict');
const { safeHttpsUrl, eventPageHtml } = require('../generate-sitemap.js');

assert.equal(safeHttpsUrl('https://forms.gle/example'), 'https://forms.gle/example');
for (const value of [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'http://example.com',
  '//example.com/path',
  'https://user:pass@example.com',
  'not a url',
  '',
  null
]) assert.equal(safeHttpsUrl(value), null, 'Unsafe URL must be rejected: ' + String(value));

const base = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Safe event',
  date: '2026-12-01',
  time: '10:00:00',
  description: 'A public event',
  registration_link: 'javascript:alert(1)',
  poster_url: 'javascript:alert(1)'
};
const html = eventPageHtml(base);
assert.ok(!html.includes('href="javascript:alert(1)"'));
assert.ok(!html.includes('src="javascript:alert(1)"'));
assert.ok(html.includes('https://hapn.info/assets/images/og-image.png'));
assert.ok(!html.includes('Register Now'));

const safeHtml = eventPageHtml({
  ...base,
  registration_link: 'https://forms.gle/register',
  poster_url: 'https://images.example.org/poster.webp'
});
assert.ok(safeHtml.includes('href="https://forms.gle/register"'));
assert.ok(safeHtml.includes('src="https://images.example.org/poster.webp"'));
assert.ok(safeHtml.includes('Register Now'));
assert.ok(safeHtml.includes('data-share-image="https://images.example.org/poster.webp"'));
assert.ok(safeHtml.includes('navigator.canShare({ files: [file] })'));
assert.ok(safeHtml.includes('files: [file]'));
assert.ok(safeHtml.includes('await navigator.share({ title, text: description, url })'));
assert.ok(!safeHtml.includes('Poster image: '), 'Poster URL must not be appended as message text');

console.log('Production hardening smoke checks passed.');
