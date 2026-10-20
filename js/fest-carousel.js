(function () {
  'use strict';
  const root = document.getElementById('fest-carousel');
  if (!root || !window.sb) return;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel = (start, end) => {
    if (!start) return 'Date to be announced';
    const fmt = (s) => new Date(String(s).slice(0,10) + 'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'});
    return fmt(start) + (end && end !== start ? ' – ' + fmt(end) : '');
  };
  function card(fest) {
    const photos = Array.isArray(fest.photo_urls) ? fest.photo_urls.filter(Boolean) : [];
    const cover = photos[0] || '../assets/images/og-image.png';
    return '<article class="fest-card"><a class="fest-card-cover" href="fest.html?id=' + encodeURIComponent(fest.id) + '"><img src="' + esc(cover) + '" alt="' + esc(fest.title) + '" loading="lazy" decoding="async"><span class="fest-photo-count">' + photos.length + ' photo' + (photos.length === 1 ? '' : 's') + '</span></a><div class="fest-card-body"><p class="fest-college">' + esc(fest.college_name) + '</p><h3><a href="fest.html?id=' + encodeURIComponent(fest.id) + '">' + esc(fest.title) + '</a></h3><p class="fest-date">' + esc(dateLabel(fest.start_date, fest.end_date)) + '</p><a class="btn btn-primary btn-block" href="fest.html?id=' + encodeURIComponent(fest.id) + '">View fest & events</a></div></article>';
  }
  sb.from('fests').select('id,title,college_name,start_date,end_date,photo_urls').eq('is_published',true).order('start_date',{ascending:true}).limit(12).then(({data,error}) => {
    if (error) { root.innerHTML = '<p class="muted">College fests will appear here soon.</p>'; console.warn('Fest carousel:',error.message); return; }
    if (!data || !data.length) { root.innerHTML = '<div class="fest-empty"><strong>No fests featured yet</strong><p>Check back soon for upcoming college fests.</p></div>'; return; }
    root.innerHTML = '<div class="fest-carousel-track">' + data.map(card).join('') + '</div>';
  });
})();
