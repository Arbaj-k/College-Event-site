/*
 * Public pages: event list (home + events page), search, category filter,
 * "Next up" ticket, and the single-event details page.
 * Reads events with the public anon key; the database (RLS) only returns published events.
 */
(function () {
  'use strict';

  const CE = window.CE;
  const publicDb = window.sbPublic || window.sb;
  const LIST_COLUMNS = 'id,title,poster_url,date,time,end_date,end_time,venue,category,short_description,registration_deadline,registration_link,is_featured,is_pinned,college_id';
  const state = { events: [], colleges: [], category: 'All', query: '', selectedDate: '', college: '' };
  let shareCareCache = { key: '', at: 0, data: null, error: false };
  let shareCarePending = null;
  let shareCareAutoTimer = null;

  const plane = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';

  const byDateTime = (a, b) => (a.date + ' ' + (a.time || '')).localeCompare(b.date + ' ' + (b.time || ''));

  /* Upcoming events first (soonest first), then past events (most recent first). */
  function sortForDisplay(list) {
    const upcoming = list.filter((e) => CE.eventStatus(e) === 'upcoming').sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || byDateTime(a, b));
    const past = list.filter((e) => CE.eventStatus(e) !== 'upcoming').sort(byDateTime).reverse();
    return upcoming.concat(past);
  }

  function cardHtml(ev, index) {
    const status = CE.eventStatus(ev);
    const link = CE.httpsUrl(ev.registration_link);
    const detailUrl = '/event/?id=' + encodeURIComponent(ev.id);
    const canRegister = CE.registrationOpen(ev) && link;
    const posterDate = ev.date ? new Date(String(ev.date).slice(0, 10) + 'T12:00:00') : null;
    const posterDateValid = posterDate && !Number.isNaN(posterDate.getTime());
    const posterDay = posterDateValid ? String(posterDate.getDate()) : '';
    const posterMonth = posterDateValid ? posterDate.toLocaleDateString('en', { month: 'short' }).toUpperCase() : '';

    const button = canRegister
      ? '<a class="btn btn-primary btn-block" href="' + CE.esc(link) + '" target="_blank" rel="noopener noreferrer">Register Now</a>'
      : (link ? '<span class="btn btn-block btn-disabled" aria-disabled="true">' + (status !== 'upcoming' ? 'Event Ended' : 'Registration Closed') + '</span>' : '');

    const stagger = 'style="--i:' + (index % 12) + '"';
    const page = document.body.getAttribute('data-page');
    const prioritizeCard = (page === 'home' || page === 'events') && index === 0;
    return '' +
      '<article class="event-card reveal' + (status !== 'upcoming' ? ' is-past' : '') + '" ' + stagger + '>' +
        '<div class="card-poster-wrap">' +
          '<a class="card-poster" href="' + detailUrl + '" tabindex="-1" aria-hidden="true">' +
            '<img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="" loading="' + (prioritizeCard ? 'eager' : 'lazy') + '" decoding="async" fetchpriority="' + (prioritizeCard ? 'high' : 'low') + '" width="800" height="500">' +
            '<span class="badge">' + CE.esc(ev.category) + '</span>' +
            (posterDateValid ? '<span class="poster-date-overlay"><strong>' + CE.esc(posterDay) + '</strong><span class="poster-date-side"><span>' + CE.esc(posterMonth) + '</span></span></span>' : '') +
            (status !== 'upcoming' ? '<span class="badge badge-ended">Ended</span>' : '') +
          '</a>' +
          '<button class="poster-share-button share-button" type="button" data-share-url="' + detailUrl + '" data-share-title="' + CE.esc(ev.title) + ' – Hapn" data-share-image="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" data-share-text="' + CE.esc('Check out ' + ev.title + ' on Hapn!') + '" aria-label="Share ' + CE.esc(ev.title) + '">' + plane + '</button>' +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title"><a href="' + detailUrl + '">' + CE.esc(ev.title) + '</a></h3>' +
          '<ul class="meta">' +
            '<li>' + CE.esc(CE.formatDate(ev.date)) + (ev.end_date ? ' – ' + CE.esc(CE.formatDate(ev.end_date)) : '') + '</li>' +
            '<li>' + CE.esc(CE.formatTime(ev.time)) + (ev.end_time ? ' – ' + CE.esc(CE.formatTime(ev.end_time)) : '') + '</li>' +
            (ev.college_id && state.colleges.find(col => col.id === ev.college_id) ? '<li>' + CE.esc(state.colleges.find(col => col.id === ev.college_id).name) + '</li>' : '') +
            '<li>' + CE.esc(ev.venue || 'Venue to be announced') + '</li>' +
          '</ul>' +
          '<div class="card-actions">' + button + '</div>' +
        '</div>' +
      '</article>';
  }

  /* ---------- list page ---------- */
  function filtered() {
    const q = state.query.trim().toLowerCase();
    return sortForDisplay(state.events).filter((ev) => {
      if (state.selectedDate) {
        const eventStart = String(ev.date || '');
        const eventEnd = String(ev.end_date || ev.date || '');
        if (state.selectedDate < eventStart || state.selectedDate > eventEnd) return false;
      }
      if (state.college && ev.college_id !== state.college) return false;
      if (state.category !== 'All' && !String(ev.category || '').split(',').map((c) => c.trim()).includes(state.category)) return false;
      if (!q) return true;
      return [ev.title, ev.venue, ev.category].some((field) => String(field || '').toLowerCase().indexOf(q) !== -1);
    });
  }

  function renderList() {
    const grid = document.getElementById('events-grid');
    const count = document.getElementById('results-count');
    const list = filtered();
    grid.setAttribute('aria-busy', 'false');

    if (!list.length) {
      grid.innerHTML = '<div class="empty"><p class="empty-title">No events found.</p><p>' +
        (state.events.length ? 'Try a different search or category.' : 'New events will show up here soon.') + '</p></div>';
      count.textContent = '';
      return;
    }
    grid.innerHTML = list.map(cardHtml).join('');
    count.textContent = list.length + (list.length === 1 ? ' event' : ' events');
  }

  function renderChips() {
    const wrap = document.getElementById('category-chips');
    const dynamicCategories = state.events.flatMap((ev) => String(ev.category || '').split(',').map((c) => c.trim()).filter(Boolean));
    const categories = ['All'].concat(Array.from(new Set(CE.CATEGORIES.concat(dynamicCategories))));
    wrap.innerHTML = categories.map((c) =>
      '<button type="button" class="chip" data-category="' + CE.esc(c) + '" aria-pressed="' + (c === state.category) + '">' + CE.esc(c) + '</button>'
    ).join('');
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      state.category = btn.dataset.category;
      wrap.querySelectorAll('.chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === btn)));
      btn.classList.remove('just-selected');
      void btn.offsetWidth;
      btn.classList.add('just-selected');
      renderList();
    });
  }

  function renderHomeCalendar() {
    const root = document.getElementById('home-calendar');
    const daysRoot = document.getElementById('calendar-days');
    const monthLabel = document.getElementById('calendar-month');
    const reset = document.getElementById('calendar-reset');
    if (!root || !daysRoot || !monthLabel || !reset) return;

    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - offset);
    const iso = (date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const monthFmt = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
    const dayFmt = new Intl.DateTimeFormat('en', { weekday: 'short' });
    monthLabel.textContent = monthFmt.format(monday);
    daysRoot.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = iso(date);
      const hasEvents = state.events.some((ev) => {
        if (state.college && ev.college_id !== state.college) return false;
        const start = String(ev.date || '');
        const end = String(ev.end_date || ev.date || '');
        return key >= start && key <= end && CE.eventStatus(ev) === 'upcoming';
      });
      const isSelected = state.selectedDate === key || (!state.selectedDate && key === iso(now));
      return '<button type="button" class="calendar-day' + (isSelected ? ' is-selected' : '') + '" data-date="' + key + '" aria-pressed="' + isSelected + '">' +
        '<span class="calendar-weekday">' + dayFmt.format(date) + '</span>' +
        '<strong>' + date.getDate() + '</strong>' +
        '<span class="calendar-event-dot' + (hasEvents ? ' has-events' : '') + '" aria-hidden="true"></span>' +
      '</button>';
    }).join('');
    daysRoot.onclick = (event) => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      state.selectedDate = button.dataset.date;
      renderHomeCalendar();
      renderList();
      document.getElementById('events')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    reset.textContent = 'View all events ↗';
    reset.setAttribute('aria-label', 'View all upcoming events');
    reset.onclick = () => {
      state.selectedDate = '';
      renderHomeCalendar();
      renderList();
      document.getElementById('events')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function shareCareType(post) {
    return post.post_type === 'Other' ? String(post.custom_type || 'Other').slice(0,14) : String(post.post_type || 'General');
  }
  function shareCareAgo(value) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' hr ago';
    return Math.floor(hours / 24) + ' days ago';
  }
  function shareCareEvent(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (_) {}
  }
  async function loadShareCarePreview(collegeId) {
    const key = String(collegeId || '');
    if (!key || !publicDb) return null;
    if (shareCareCache.key === key && Date.now() - shareCareCache.at < 60000) return shareCareCache.data;
    const previewDb = window.sb || publicDb;
    const { data, error } = await previewDb.rpc('get_sharencare_home_preview', { p_college_id: key });
    if (error) throw error;
    shareCareCache = { key, at: Date.now(), data: data || null };
    return shareCareCache.data;
  }
  function renderShareCareCardA(data, loading, error) {
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    const more = Number(data?.more_today || 0);
    const rows = loading ? '<div class="snc-skeleton"></div>'.repeat(4) :
      error ? '' : posts.length ? posts.map((p, i) =>
        '<button type="button" class="snc-post-row' + (i === 0 ? ' newest' : '') + '" data-snc-post="' + CE.esc(p.id) + '" aria-label="Open post: ' + CE.esc(p.body) + '">' +
          '<span class="snc-avatar pastel-' + (i % 4) + '">' + CE.esc(p.initials || '?') + '</span>' +
          '<span class="snc-post-copy"><span class="snc-post-text">' + CE.esc(p.body) + '</span><span class="snc-post-meta"><span>' + CE.esc(shareCareType(p)) + '</span><time>' + CE.esc(shareCareAgo(p.created_at)) + '</time></span></span>' +
        '</button>').join('') :
      '<div class="snc-empty"><strong>Be the first to post in ' + CE.esc(data?.college_name || 'your college') + '</strong><a class="snc-open" href="/connect/board/?create=1">Create Post ↗</a></div>';
    return '<article class="featured-card snc-card snc-card-a" data-snc-card="a" role="link" tabindex="0" aria-label="Share N Care, latest posts from your campus">' +
      '<div class="snc-top"><span class="snc-live"><i></i> LIVE AT ' + CE.esc(data?.college_name || 'YOUR CAMPUS') + '</span><button class="poster-share-button share-button snc-share-button" type="button" data-share-url="/connect/" data-share-title="Share N Care – Hapn" aria-label="Share Share N Care">↗</button></div>' +
      '<div class="snc-title">Share <em>N</em> Care</div><div class="snc-kicker">LATEST FROM YOUR CAMPUS</div>' +
      '<div class="snc-post-list" aria-live="off">' + rows + '</div>' +
      '<div class="snc-footer"><span class="snc-progress">' + posts.slice(0,4).map((p,i)=>'<i class="' + (i===0?'on':'') + '"></i>').join('') + '</span>' + (more>0?'<span class="snc-more">+'+more+' more posts today</span>':'') + '</div>' +
      '<div class="featured-actions snc-actions"><a class="btn btn-primary btn-sm" href="/connect/">Hapn Connect</a></div></article>';
  }
  function renderShareCareCardB(data, loading, error) {
    const p = data?.posts?.[0];
    const preview = loading ? '<div class="snc-skeleton snc-preview-skeleton"></div>' : error || !p ? '' :
      '<div class="snc-b-preview"><span class="snc-avatar lime">' + CE.esc(p.initials || '?') + '</span><span class="snc-b-copy"><span>' + CE.esc(p.body) + '</span><small>' + CE.esc(shareCareAgo(p.created_at)) + ' · ' + CE.esc(shareCareType(p).toUpperCase()) + '</small></span></div>';
    return '<article class="featured-card snc-card snc-card-b" data-snc-card="b" role="link" tabindex="0" aria-label="Share N Care, ask, share and help your campus">' +
      '<div class="snc-top"><span class="snc-live"><i></i> LIVE AT ' + CE.esc(data?.college_name || 'YOUR CAMPUS') + '</span><button class="poster-share-button share-button snc-share-button" type="button" data-share-url="/connect/" data-share-title="Share N Care – Hapn" aria-label="Share Share N Care">↗</button></div>' +
      '<div class="snc-b-head"><span>ASK.</span><span>SHARE.</span><span>HELP.</span></div><div class="snc-b-name">Share <em>N</em> Care</div>' +
      '<div class="snc-chips"><span>Ride Share</span><span>Lost &amp; Found</span><span>Teammate</span></div>' + preview +
      '<div class="featured-actions snc-actions"><a class="btn btn-primary btn-sm" href="/connect/">Hapn Connect</a></div></article>';
  }
  async function renderNextUp() {
    const box = document.getElementById('next-up');
    if (!box) return;
    if (shareCareAutoTimer) { clearInterval(shareCareAutoTimer); shareCareAutoTimer = null; }
    const upcoming = sortForDisplay(state.events).filter((e) => CE.eventStatus(e) === 'upcoming' && (!state.college || e.college_id === state.college));
    const picks = upcoming.slice().sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || byDateTime(a, b));
    let preview = null, previewError = false, loading = false;
    const accountState = await (async()=>{try{const authDb=window.sb||window.sbPublic;const {data:{session}}=await authDb.auth.getSession();if(!session?.user)return {opened:false,collegeId:''};const {data,error}=await authDb.from('campus_members').select('college_id,sharencare_opened_at').eq('user_id',session.user.id).maybeSingle();return {opened:!error&&!!data?.sharencare_opened_at,collegeId:!error&&data?.college_id||''};}catch(_){return {opened:false,collegeId:''};}})();
    const collegeId = accountState.collegeId || state.college || window.HapnCollegeSelection?.get?.() || '';
    const collegeName = state.colleges.find(c => c.id === collegeId)?.name || 'YOUR CAMPUS';
    if (collegeId) {
      const cached = shareCareCache.key === String(collegeId) && Date.now()-shareCareCache.at<60000;
      if (cached) { preview = shareCareCache.data; previewError = !!shareCareCache.error; }
      else {
        loading = true;
        if (!shareCarePending || shareCarePending.key !== String(collegeId)) {
          const pending = loadShareCarePreview(collegeId);
          shareCarePending = { key: String(collegeId), promise: pending };
          pending.catch(error => console.warn('Share N Care preview unavailable:', error)).finally(() => {
            if (shareCarePending?.key === String(collegeId)) shareCarePending = null;
            renderNextUp();
          });
        }
      }
    }
    if (!picks.length && !collegeId) { box.hidden = true; return; }
    const cards = [];
    const eventHtml = picks.map((ev,index) => {
      const eventUrl='/event/?id='+encodeURIComponent(ev.id), dateValue=ev.date?new Date(String(ev.date).slice(0,10)+'T12:00:00'):null;
      const validDate=dateValue&&!Number.isNaN(dateValue.getTime()), posterDay=validDate?String(dateValue.getDate()):'', posterMonth=validDate?dateValue.toLocaleDateString('en',{month:'short'}).toUpperCase():'';
      return '<article class="featured-card" data-slide-index="'+index+'"><div class="featured-poster-wrap"><a class="featured-poster" href="'+eventUrl+'" aria-label="View '+CE.esc(ev.title)+'"><img src="'+CE.esc(CE.posterSrc(ev.poster_url))+'" alt="'+CE.esc(ev.title)+' poster" loading="'+(index===0?'eager':'lazy')+'" decoding="async" width="800" height="450"></a><span class="featured-poster-badge">'+CE.esc(ev.category||'College event')+'</span>'+(validDate?'<span class="poster-date-overlay carousel-poster-date"><strong>'+CE.esc(posterDay)+'</strong><span class="poster-date-side"><span>'+CE.esc(posterMonth)+'</span></span></span>':'')+'<button class="poster-share-button share-button" type="button" data-share-url="'+eventUrl+'" data-share-title="'+CE.esc(ev.title)+' – Hapn" data-share-image="'+CE.esc(CE.posterSrc(ev.poster_url))+'" data-share-text="'+CE.esc('Check out '+ev.title+' on Hapn!')+'" aria-label="Share '+CE.esc(ev.title)+'">'+plane+'</button></div><div class="featured-actions"><a class="btn btn-primary btn-sm" href="'+eventUrl+'">'+(ev.registration_url?'Register Now':'View Event')+'</a></div></article>';
    });
    const shareA=renderShareCareCardA(preview||{college_name:collegeName,posts:[]},loading,previewError);
    const shareB=renderShareCareCardB(preview||{college_name:collegeName,posts:[]},loading,previewError);
    const shareCards=accountState.opened?[shareA]:[shareA,shareB];
    const slideItems=[shareA];
    eventHtml.forEach((html,index)=>{
      slideItems.push(html);
      if((index+1)%3===0) slideItems.push(shareCards[(Math.floor((index+1)/3))%shareCards.length]);
    });
    const count=slideItems.length;
    box.innerHTML='<div class="featured-head"><div class="featured-heading-copy"><span class="ticket-label">Upcoming at Hapn</span><p class="featured-subtitle">Swipe to discover what’s happening next</p></div><div class="carousel-controls"><button type="button" class="carousel-prev" aria-label="Previous slide">‹</button><button type="button" class="carousel-next" aria-label="Next slide">›</button></div></div><div class="featured-carousel" role="region" aria-label="Upcoming college events and Share N Care" tabindex="0">'+slideItems.join('')+'</div>';
    const rail=box.querySelector('.featured-carousel'), allCards=Array.from(rail.querySelectorAll('.featured-card'));
    let activeIndex=0,scrollFrame=0;
    let setActive=index=>{activeIndex=index;allCards.forEach((card,i)=>{card.classList.toggle('is-active',i===index);card.classList.toggle('stack-next',i===(index+1)%count);card.classList.toggle('stack-next-2',i===(index+2)%count&&count>2);card.classList.toggle('stack-prev',i===(index-1+count)%count&&count>1);card.classList.toggle('stack-prev-2',i===(index-2+count)%count&&count>3);card.setAttribute('aria-hidden',String(i!==index));});};
    const goTo=(index,behavior)=>{const next=(index+count)%count,card=allCards[next];rail.scrollTo({left:Math.max(0,card.offsetLeft-(rail.clientWidth-card.clientWidth)/2),behavior:behavior||'smooth'});setActive(next);};
    const update=()=>{scrollFrame=0;const center=rail.getBoundingClientRect().left+rail.clientWidth/2;let best=0,dist=Infinity;allCards.forEach((c,i)=>{const d=Math.abs(c.getBoundingClientRect().left+c.clientWidth/2-center);if(d<dist){dist=d;best=i;}});setActive(best);};
    rail.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(update);},{passive:true});
    rail.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();goTo(activeIndex+1);}if(e.key==='ArrowLeft'){e.preventDefault();goTo(activeIndex-1);}});
    let sx=0,sy=0,pid=null;rail.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;pid=e.pointerId;rail.classList.add('is-dragging');});
    rail.addEventListener('pointerup',e=>{if(pid!==e.pointerId)return;const dx=e.clientX-sx,dy=e.clientY-sy;pid=null;rail.classList.remove('is-dragging');if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2)goTo(activeIndex+(dx<0?1:-1));});
    rail.addEventListener('pointercancel',()=>{pid=null;rail.classList.remove('is-dragging');});
    box.querySelector('.carousel-prev').addEventListener('click',()=>goTo(activeIndex-1));box.querySelector('.carousel-next').addEventListener('click',()=>goTo(activeIndex+1));
    let auto=null,paused=false;const stop=()=>{if(auto){clearInterval(auto);auto=null;}};const start=()=>{stop();if(count<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;auto=setInterval(()=>{if(!document.hidden&&!paused)goTo(activeIndex+1);},3000);};
    box.addEventListener('mouseenter',()=>{paused=true;stop();});box.addEventListener('mouseleave',()=>{paused=false;start();});box.addEventListener('focusin',stop);box.addEventListener('focusout',e=>{if(!box.contains(e.relatedTarget))start();});rail.addEventListener('pointerdown',()=>{paused=true;stop();},{passive:true});rail.addEventListener('pointerup',()=>{setTimeout(()=>{paused=false;if(!box.matches(':hover')&&!box.contains(document.activeElement))start();},900);},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(!paused)start();});
    box.addEventListener('click',async e=>{const share=e.target.closest('.snc-share-button');if(share){e.preventDefault();e.stopPropagation();const url=new URL(share.dataset.shareUrl||'/connect/',location.origin).href;const title=share.dataset.shareTitle||'Hapn Connect';if(navigator.share){try{await navigator.share({title,text:'Check out Hapn Connect',url});return;}catch(err){if(err?.name==='AbortError')return;}}try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);CE.toast('Hapn Connect link copied!','success');return;}}catch(_){}try{const field=document.createElement('textarea');field.value=url;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();if(copied){CE.toast('Hapn Connect link copied!','success');return;}}catch(_){}CE.toast('Share this link: '+url);return;}const openLink=e.target.closest('.snc-open');if(openLink){const card=openLink.closest('[data-snc-card]');if(card)shareCareEvent('sharencare_card_'+card.dataset.sncCard+'_click');}const post=e.target.closest('[data-snc-post]');if(post){shareCareEvent('sharencare_card_a_post_click',{post_id:post.dataset.sncPost});location.href='/connect/board/?post='+encodeURIComponent(post.dataset.sncPost);return;}const card=e.target.closest('[data-snc-card]');if(card&&!e.target.closest('a,button')){shareCareEvent('sharencare_card_'+card.dataset.sncCard+'_click');location.href='/connect/';}});
    box.addEventListener('keydown',e=>{const card=e.target.closest('[data-snc-card]');if(card&&(e.key==='Enter'||e.key===' ')){if(e.target.closest('a,button'))return;e.preventDefault();shareCareEvent('sharencare_card_'+card.dataset.sncCard+'_click');location.href='/connect/';}});
    const seen=new WeakSet();if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting&&entry.intersectionRatio>=.6&&!seen.has(entry.target)){seen.add(entry.target);shareCareEvent(entry.target.dataset.sncCard==='a'?'sharencare_card_a_impression':'sharencare_card_b_impression');}}),{threshold:[.6]});allCards.filter(c=>c.dataset.sncCard).forEach(c=>io.observe(c));}
    setActive(0);box.hidden=false;box.classList.add('ticket-ready');requestAnimationFrame(()=>goTo(0,'auto'));start();
    const aCard=allCards.findIndex(c=>c.dataset.sncCard==='a');
    const aElement=aCard>=0?allCards[aCard]:null;
    let rowIndex=0,rowTimer=null;
    const rotateRows=()=>{if(!aElement||aCard!==activeIndex||paused||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rows=Array.from(aElement.querySelectorAll('.snc-post-row'));if(rows.length<2)return;rowIndex=(rowIndex+1)%rows.length;const first=rows.shift();if(first)aElement.querySelector('.snc-post-list').appendChild(first);const rotated=Array.from(aElement.querySelectorAll('.snc-post-row'));rotated.forEach((r,i)=>r.classList.toggle('newest',i===0));const dotsRow=aElement.querySelectorAll('.snc-progress i');dotsRow.forEach((d,i)=>d.classList.toggle('on',i===rowIndex));};
    const startRows=()=>{if(rowTimer)clearInterval(rowTimer);if(aElement&&aCard===activeIndex&&!matchMedia('(prefers-reduced-motion: reduce)').matches)rowTimer=setInterval(rotateRows,5000);};
    const stopRows=()=>{if(rowTimer){clearInterval(rowTimer);rowTimer=null;}};
    const previousSetActive=setActive;
    setActive=index=>{previousSetActive(index);if(index===aCard)startRows();else stopRows();};
    startRows();
    box.addEventListener('mouseenter',stopRows);box.addEventListener('mouseleave',startRows);
    box.addEventListener('focusin',stopRows);box.addEventListener('focusout',e=>{if(!box.contains(e.relatedTarget))startRows();});
    rail.addEventListener('pointerdown',stopRows,{passive:true});rail.addEventListener('pointerup',()=>setTimeout(startRows,900),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRows();else startRows();});
  }

  function showListError(message) {
    const grid = document.getElementById('events-grid');
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '<div class="empty"><p class="empty-title">Events could not be loaded.</p><p>' + CE.esc(message) + '</p></div>';
  }

  async function initList() {
    renderChips();

    let timer;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.query = e.target.value; renderList(); }, 120);
    });

    const problem = CE.setupProblem();
    if (problem) return showListError(problem);

    try {
      await (window.HapnCollegeSelection?.ready || Promise.resolve());
      const collegeSelect = document.getElementById('college-filter');
      state.colleges = window.HapnCollegeSelection?.getColleges?.() || [];
      state.college = window.HapnCollegeSelection?.get?.() || '';
      if (collegeSelect) {
        collegeSelect.innerHTML = '<option value="">Choose your college</option>' + state.colleges.map(c => '<option value="' + CE.esc(c.id) + '">' + CE.esc(c.name) + '</option>').join('');
        collegeSelect.value = state.college;
        collegeSelect.addEventListener('change', () => window.HapnCollegeSelection?.set?.(collegeSelect.value));
      }
      document.addEventListener('hapn:collegechange', (event) => {
        state.college = event.detail?.collegeId || '';
        if (collegeSelect) collegeSelect.value = state.college;
        renderHomeCalendar(); renderList(); renderNextUp();
      });

      const request = publicDb.from('events')
        .select(LIST_COLUMNS)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Events request timed out')), 10000)
      );

      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw error;

      state.events = data || [];
      renderHomeCalendar();
      renderList();
      renderNextUp();
    } catch (error) {
      console.error('Hapn event loading failed:', error);
      showListError('Events could not be loaded right now. Please refresh and try again.');
    }
  }

  /* ---------- details page ---------- */
  function detailHtml(ev) {
    const status = CE.eventStatus(ev);
    const link = CE.httpsUrl(ev.registration_link);
    const canRegister = CE.registrationOpen(ev) && link;
    const cta = canRegister
      ? '<a class="btn btn-primary btn-lg" href="' + CE.esc(link) + '" target="_blank" rel="noopener noreferrer">Register</a>' +
        '<small>Opens the registration form in a new tab.</small>'
      : '<span class="btn btn-lg btn-disabled" aria-disabled="true">' + (status !== 'upcoming' ? 'This event has ended' : 'Registration closed') + '</span>';

    const rows = [
      ['DATE', CE.formatDate(ev.date) + (ev.end_date ? ' – ' + CE.formatDate(ev.end_date) : '')],
      ['TIME', CE.formatTime(ev.time) + (ev.end_time ? ' – ' + CE.formatTime(ev.end_time) : '')],
      ['VENUE', ev.venue || 'Venue to be announced'],
      ['COLLEGE', (state.colleges.find(col => col.id === ev.college_id) || {}).name || 'College event'],
      ['ORGANIZER', ev.organizer || 'College event']
    ];
    if (ev.registration_deadline) rows.push(['📝 Register by', CE.formatDate(ev.registration_deadline)]);

    return '' +
      '<div class="detail">' +
        '<div class="detail-poster detail-poster-wrap"><img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="Poster for ' + CE.esc(ev.title) + '" loading="eager" decoding="async" fetchpriority="high" width="800" height="1000"><button class="poster-share-button share-button" type="button" data-share-url="/event/?id=' + encodeURIComponent(ev.id) + '" data-share-title="' + CE.esc(ev.title) + ' – Hapn" data-share-image="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" data-share-text="' + CE.esc('Check out ' + ev.title + ' on Hapn!') + '" aria-label="Share ' + CE.esc(ev.title) + '" title="Share event"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>' +
        '<div class="detail-info">' +
          '<div class="detail-pills"><span class="pill">' + CE.esc(ev.category || 'College event') + '</span>' + (status !== 'upcoming' ? '<span class="pill pill-ended">Ended</span>' : (ev.date ? (function(){ const d=new Date(String(ev.date).slice(0,10)+'T00:00:00'); const t=new Date(); t.setHours(0,0,0,0); const n=Math.ceil((d-t)/86400000); return '<span class="pill pill-countdown">' + (n > 0 ? 'Starts in ' + n + (n===1?' day':' days') : (n===0?'Today':'Upcoming')) + '</span>'; })() : '')) + '</div>' +
          '<h1>' + CE.esc(ev.title) + '</h1>' +
          (ev.short_description ? '<p class="detail-subtitle">' + CE.esc(ev.short_description) + '</p>' : '') +
          '<dl class="info-list">' + rows.map((r, i) => '<div><span class="info-icon" aria-hidden="true">' + ['▦','◷','⌖','♙'][i] + '</span><span class="info-copy"><dt>' + r[0] + '</dt><dd>' + CE.esc(r[1]) + '</dd></span></div>').join('') + '</dl>' +
          '<div class="detail-quick-actions">' +
            '<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ev.title) + '&dates=' + encodeURIComponent(String(ev.date || '').replace(/-/g, '') + 'T' + String(ev.time || '00:00:00').replace(/:/g, '').slice(0,6).padEnd(6,'0') + '/' + String(ev.end_date || ev.date || '').replace(/-/g, '') + 'T' + String(ev.end_time || ev.time || '23:59:00').replace(/:/g, '').slice(0,6).padEnd(6,'0')) + '&details=' + encodeURIComponent(ev.description || ev.short_description || '') + '&location=' + encodeURIComponent(ev.venue || '') + '" target="_blank" rel="noopener noreferrer" class="detail-outline-btn">▦ &nbsp; Add to calendar</a>' +
            '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.venue || ev.title) + '" target="_blank" rel="noopener noreferrer" class="detail-outline-btn">⌖ &nbsp; Get directions</a>' +
          '</div>' +
          '<h2 class="detail-text-title">About this event</h2>' +
          '<p class="detail-text">' + CE.esc(ev.description || ev.short_description || 'More event details will be announced soon.') + '</p>' +
          (ev.organizer ? '<section class="detail-organizers"><h2 class="detail-text-title">Who’s organizing</h2><div class="organizer-card"><span class="organizer-avatar">' + CE.esc(String(ev.organizer).trim().charAt(0).toUpperCase()) + '</span><span class="organizer-copy"><strong>' + CE.esc(ev.organizer) + '</strong><small>Event organizer</small></span></div></section>' : '') +
          '<div class="detail-cta">' + cta + '<button class="register-share-icon share-button" type="button" data-share-url="/event/?id=' + encodeURIComponent(ev.id) + '" data-share-title="' + CE.esc(ev.title) + ' – Hapn" data-share-image="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" data-share-text="' + CE.esc('Check out ' + ev.title + ' on Hapn!') + '" aria-label="Share this event" title="Share event"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>' +
        '</div>' +
      '</div>';
  }

  async function initDetail() {
    const box = document.getElementById('event-detail');
    const notFound = (msg) => { box.innerHTML = '<div class="empty"><p class="empty-title">' + CE.esc(msg) + '</p><p><a href="events.html">Browse all events</a></p></div>'; };

    const pathMatch = location.pathname.match(/\/event-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.html$/i);
    const id = new URLSearchParams(location.search).get('id') || (pathMatch ? pathMatch[1] : '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return notFound('Event not found.');

    const problem = CE.setupProblem();
    if (problem) return notFound(problem);

    const { data: collegeRows } = await publicDb.from('colleges').select('id,name').eq('is_active', true);
    state.colleges = collegeRows || [];
    const { data, error } = await publicDb.from('events').select('*').eq('id', id).maybeSingle();
    if (error) { console.error(error); return notFound('This event could not be loaded. Please try again.'); }
    if (!data) return notFound('Event not found.');

    document.title = data.title + ' – Hapn';

    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = location.origin + (location.pathname.match(/\/event-[0-9a-f-]+\.html$/i) ? location.pathname : '/event/?id=' + encodeURIComponent(data.id));

    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content = String(data.short_description || data.description || 'View college event details and registration on Hapn.').slice(0, 160);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = data.title + ' – Hapn';
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = description.content;
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    const sharePoster = data.poster_url ? CE.posterSrc(data.poster_url) : 'https://hapn.info/assets/images/og-image.png';
    const absoluteSharePoster = new URL(sharePoster, location.origin).href;
    if (ogImage) ogImage.content = absoluteSharePoster;
    if (twitterImage) twitterImage.content = absoluteSharePoster;
    const ogImageAlt = document.querySelector('meta[property="og:image:alt"]');
    if (ogImageAlt) ogImageAlt.content = data.title + ' event poster';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = canonical ? canonical.href : location.href;
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.content = data.title + ' – Hapn';
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.content = description.content;

    const existingLd = document.getElementById('event-jsonld');
    if (existingLd) existingLd.remove();
    const ld = document.createElement('script');
    ld.id = 'event-jsonld';
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: data.title,
      description: String(data.description || data.short_description || '').slice(0, 500),
      startDate: data.date + (data.time ? 'T' + data.time : ''),
      endDate: data.end_date ? data.end_date + (data.end_time ? 'T' + data.end_time : '') : undefined,
      location: data.venue ? { '@type': 'Place', name: data.venue } : undefined,
      image: data.poster_url ? [CE.posterSrc(data.poster_url)] : undefined,
      url: canonical ? canonical.href : location.href,
      eventStatus: 'https://schema.org/EventScheduled'
    });
    document.head.appendChild(ld);

    box.innerHTML = detailHtml(data);
    const ctaBar = box.querySelector('.detail-cta');
    if (ctaBar) ctaBar.setAttribute('data-registration-label', (CE.registrationOpen(data) && CE.httpsUrl(data.registration_link)) ? 'Registration open' : (CE.eventStatus(data) !== 'upcoming' ? 'Event ended' : 'Registration closed'));
  }

  const page = document.body.getAttribute('data-page');
  if (page === 'home' || page === 'events') initList();
  if (page === 'event') initDetail();
})();
