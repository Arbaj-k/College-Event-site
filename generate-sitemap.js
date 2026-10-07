/* Generate a sitemap containing public pages and published event detail URLs. */
const fs = require('fs');

const baseUrl = 'https://hapn.info';
const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

const staticUrls = [
  { loc: baseUrl + '/' },
  { loc: baseUrl + '/events.html' },
  { loc: baseUrl + '/about.html' },
  { loc: baseUrl + '/help.html' },
  { loc: baseUrl + '/terms.html' }
];

function readPublicConfig() {
  try {
    const config = fs.readFileSync('js/config.js', 'utf8');
    const url = config.match(/SUPABASE_URL:\s*"([^"]+)"/)?.[1] || '';
    const key = config.match(/SUPABASE_ANON_KEY:\s*"([^"]+)"/)?.[1] || '';
    return { url, key };
  } catch {
    return { url: '', key: '' };
  }
}

async function getPublishedEvents() {
  const config = readPublicConfig();
  const apiUrl = supabaseUrl || config.url;
  const apiKey = anonKey || config.key;

  if (!apiUrl || !apiKey) {
    throw new Error('Supabase public configuration is missing.');
  }

  const url = apiUrl + '/rest/v1/events?select=id,updated_at&is_published=eq.true&order=date.asc,time.asc';
  const response = await fetch(url, {
    headers: { apikey: apiKey, Authorization: 'Bearer ' + apiKey }
  });

  if (!response.ok) throw new Error('Supabase returned HTTP ' + response.status);
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function main() {
  let events = [];
  try {
    events = await getPublishedEvents();
  } catch (error) {
    console.error('[sitemap] Could not fetch published events:', error.message);
    process.exit(1);
  }

  const urls = staticUrls.concat(events.map((event) => ({
    loc: baseUrl + '/events/' + encodeURIComponent(event.id) + '/',
    lastmod: event.updated_at ? new Date(event.updated_at).toISOString() : undefined
  })));

  const body = urls.map((item) => [
    '  <url>',
    '    <loc>' + escapeXml(item.loc) + '</loc>',
    item.lastmod ? '    <lastmod>' + escapeXml(item.lastmod) + '</lastmod>' : '',
    '  </url>'
  ].filter(Boolean).join('\n')).join('\n');

  fs.writeFileSync(
    'sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      body + '\n</urlset>\n'
  );

  console.log('[sitemap] Generated ' + urls.length + ' URLs (' + events.length + ' published events).');
}

main();
