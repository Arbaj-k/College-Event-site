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

  const url = apiUrl + '/rest/v1/events?select=id,title,description,short_description,date,time,end_date,end_time,venue,organizer,category,registration_link,poster_url,updated_at&is_published=eq.true&order=date.asc,time.asc';
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
  const canonical = baseUrl + '/event-' + encodeURIComponent(event.id) + '.html';
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

  // VGU Campus has a verified public address; add it only when the event venue is VGU Campus.
  if (String(event.venue || '').trim().toLowerCase() === 'vgu campus') {
    schema.location.address = {
      '@type': 'PostalAddress',
      streetAddress: 'Sector-36, NRI Road, Jagatpura',
      addressLocality: 'Jaipur',
      postalCode: '303012',
      addressRegion: 'Rajasthan',
      addressCountry: 'IN'
    };
  }
  if (event.organizer) schema.organizer = { '@type': 'Organization', name: event.organizer };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-EYVRV7CS7B"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-EYVRV7CS7B');
  </script>
<title>${title} – College Event | Hapn</title>
<meta name="description" content="${description}">\n<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hapn">
<meta property="og:title" content="${title} – College Event | Hapn">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} – College Event | Hapn">
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
${'<div class="detail-cta">' + (registration ? '<a class="btn btn-primary btn-lg" href="' + registration + '" target="_blank" rel="noopener noreferrer">Register Now</a>' : '') + '<button class="btn btn-outline share-button" type="button" data-share-url="' + canonical + '" data-share-title="' + title + ' – Hapn" aria-label="Share this event"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg> Share event</button></div>'}
</div>
</article>
</div></section></main>
<footer class="site-footer"><div class="container"><p class="footer-bottom">© 2026 Hapn</p></div></footer>
<script>
document.addEventListener('click', async function (event) {
  const button = event.target.closest('.share-button'); if (!button) return;
  const url = new URL(button.getAttribute('data-share-url') || location.href, location.href).href;
  const title = button.getAttribute('data-share-title') || document.title;
  if (navigator.share) { try { await navigator.share({ title, text: 'Check this out on Hapn:', url }); return; } catch (error) { if (error && error.name === 'AbortError') return; } }
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
    else { const input=document.createElement('textarea'); input.value=url; input.setAttribute('readonly',''); input.style.position='fixed'; input.style.opacity='0'; document.body.appendChild(input); input.select(); const copied=document.execCommand('copy'); input.remove(); if(!copied) throw new Error('Copy failed'); }
    window.alert('Event link copied! Share it with your friends.');
  } catch (error) { window.prompt('Copy this event link:', url); }
});
</script>
</body>
</html>`;
}

async function generateEventPages(events) {
  for (const event of events) {
    const fileName = 'event-' + String(event.id).replace(/[^a-zA-Z0-9_-]/g, '') + '.html';
    fs.writeFileSync(fileName, eventPageHtml(event));
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

  await generateEventPages(events);

  const eventUrls = events.map((event) => ({
    loc: baseUrl + '/event-' + encodeURIComponent(event.id) + '.html',
    lastmod: event.updated_at ? new Date(event.updated_at).toISOString() : undefined
  }));

  const urls = staticUrls.concat(eventUrls);

  if (events.length === 0) {
    throw new Error('No published events were returned; refusing to publish a sitemap without event URLs.');
  }

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
  console.log('[sitemap] Event URLs: ' + eventUrls.length);
}

main();
