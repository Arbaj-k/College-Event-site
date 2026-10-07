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

  const url = apiUrl + '/rest/v1/events?select=*&is_published=eq.true&order=date.asc,time.asc';
  const response = await fetch(url, {
    headers: { apikey: apiKey, Authorization: 'Bearer ' + apiKey }
  });

  if (!response.ok) throw new Error('Supabase returned HTTP ' + response.status);
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function eventPageHtml(event) {
  const title = escapeHtml(event.title || 'College Event');
  const description = escapeHtml(event.description || event.short_description || 'College event details and registration.');
  const canonical = baseUrl + '/events/' + encodeURIComponent(event.id) + '/';
  const image = event.poster_url ? escapeHtml(event.poster_url) : baseUrl + '/assets/images/og-image.png';
  const date = escapeHtml(event.date || '');
  const endDate = escapeHtml(event.end_date || event.date || '');
  const time = escapeHtml(event.time || '');
  const endTime = escapeHtml(event.end_time || '');
  const venue = escapeHtml(event.venue || '');
  const organizer = escapeHtml(event.organizer || '');
  const category = escapeHtml(event.category || '');
  const registration = event.registration_link ? escapeHtml(event.registration_link) : '';
  const dateText = date + (event.end_date ? ' – ' + endDate : '');
  const timeText = time + (event.end_time ? ' – ' + endTime : '');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title || 'College Event',
    description: event.description || event.short_description || 'College event details and registration.',
    startDate: event.date && event.time ? event.date + 'T' + event.time : event.date,
    endDate: event.end_date && event.end_time ? event.end_date + 'T' + event.end_time : (event.end_date || event.date),
    eventStatus: 'https://schema.org/EventScheduled',
    url: canonical,
    image: [event.poster_url || baseUrl + '/assets/images/og-image.png'],
    location: { '@type': 'Place', name: event.venue || 'College campus' }
  };
  if (event.organizer) schema.organizer = { '@type': 'Organization', name: event.organizer };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} – Hapn</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="event">
<meta property="og:site_name" content="Hapn">
<meta property="og:title" content="${title} – Hapn">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} – Hapn">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="${baseUrl}/assets/images/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="${baseUrl}/css/style.css">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="site-header"><div class="container header-inner">
<a class="brand" href="${baseUrl}/"><img src="${baseUrl}/assets/images/logo.svg" alt="" width="34" height="34"><span>Hapn</span></a>
<nav class="nav" aria-label="Main"><a href="${baseUrl}/">Home</a><a href="${baseUrl}/events.html" aria-current="page">Events</a><a href="${baseUrl}/about.html">About</a></nav>
</div></header>
<main id="main"><section class="section"><div class="container">
<a class="back-link" href="${baseUrl}/events.html">Back to all events</a>
<article class="detail">
<div class="detail-poster"><img class="poster-img" src="${image}" alt="Poster for ${title}" width="800" height="500"></div>
<div class="detail-info">
${category ? '<span class="pill">' + category + '</span>' : ''}
<h1>${title}</h1>
<dl class="info-list">
${dateText ? '<div><dt>📅 Date</dt><dd>' + dateText + '</dd></div>' : ''}
${timeText ? '<div><dt>⏰ Time</dt><dd>' + timeText + '</dd></div>' : ''}
${venue ? '<div><dt>📍 Venue</dt><dd>' + venue + '</dd></div>' : ''}
${organizer ? '<div><dt>👥 Organizer</dt><dd>' + organizer + '</dd></div>' : ''}
</dl>
<h2 class="detail-text-title">About this event</h2>
<p class="detail-text">${description}</p>
${registration ? '<div class="detail-cta"><a class="btn btn-primary btn-lg" href="' + registration + '" target="_blank" rel="noopener noreferrer">Register Now</a></div>' : ''}
</div>
</article>
</div></section></main>
<footer class="site-footer"><div class="container"><p class="footer-bottom">© 2026 Hapn</p></div></footer>
</body>
</html>`;
}

async function generateEventPages(events) {
  for (const event of events) {
    const dir = require('path').join('events', String(event.id));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(require('path').join(dir, 'index.html'), eventPageHtml(event));
  }
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

  await generateEventPages(events);\n\n  const urls = staticUrls.concat(events.map((event) => ({
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
