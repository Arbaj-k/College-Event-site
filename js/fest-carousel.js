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
    const cover = photos[0] || '/assets/images/og-image.png';
    return '<article class="fest-card"><a class="fest-card-cover" href="/fest/?id=' + encodeURIComponent(fest.id) + '"><img src="' + esc(cover) + '" alt="' + esc(fest.title) + '" loading="lazy" decoding="async" fetchpriority="low" width="400" height="500"><span class="fest-photo-count">' + photos.length + ' photo' + (photos.length === 1 ? '' : 's') + '</span></a><button class="fest-home-share share-button" type="button" data-share-url="/fest/?id=' + encodeURIComponent(fest.id) + '" data-share-title="' + esc(fest.title) + ' – Hapn" aria-label="Share ' + esc(fest.title) + '" title="Share fest"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button><div class="fest-card-body"><p class="fest-college">' + esc(fest.college_name) + '</p><h3><a href="/fest/?id=' + encodeURIComponent(fest.id) + '">' + esc(fest.title) + '</a></h3><p class="fest-date">' + esc(dateLabel(fest.start_date, fest.end_date)) + '</p><a class="btn btn-primary btn-block" href="/fest/?id=' + encodeURIComponent(fest.id) + '">View fest & events</a></div></article>';
  }
  (async()=>{await (window.HapnCollegeSelection?.ready||Promise.resolve());const collegeId=window.HapnCollegeSelection?.get()||'';if(!collegeId){root.innerHTML='<p class="muted">Choose your college to see its fests.</p>';return;}const {data,error}=await sbPublic.from('fests').select('id,title,college_id,college_name,start_date,end_date,photo_urls').eq('college_id',collegeId).eq('is_published',true).order('start_date',{ascending:true}).limit(12);
    if (error) { root.innerHTML = '<p class="muted">College fests will appear here soon.</p>'; console.warn('Fest carousel:',error.message); return; }
    if (!data || !data.length) { root.closest('.fest-carousel-section')?.remove(); return; }
    root.innerHTML = '<div class="fest-carousel-track">' + data.map(card).join('') + '</div>';
  })();
  document.addEventListener('hapn:collegechange',()=>location.reload());
})();
