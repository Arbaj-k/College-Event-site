/*
 * Public pages: event list (home + events page), search, category filter,
 * "Next up" ticket, and the single-event details page.
 * Reads events with the public anon key; the database (RLS) only returns published events.
 */
(function () {
  'use strict';

  const CE = window.CE;
  const LIST_COLUMNS = 'id,title,poster_url,date,time,end_date,end_time,venue,category,short_description,registration_deadline,registration_link,is_featured,is_pinned';
  const state = { events: [], category: 'All', query: '' };

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
    const detailUrl = 'event.html?id=' + encodeURIComponent(ev.id);
    const canRegister = CE.registrationOpen(ev) && link;

    const button = canRegister
      ? '<a class="btn btn-primary btn-block" href="' + CE.esc(link) + '" target="_blank" rel="noopener noreferrer">Register Now</a>'
      : '<span class="btn btn-block btn-disabled" aria-disabled="true">' + (status !== 'upcoming' ? 'Event Ended' : 'Registration Closed') + '</span>';

    const stagger = 'style="--i:' + (index % 12) + '"';
    return '' +
      '<article class="event-card reveal' + (status !== 'upcoming' ? ' is-past' : '') + '" ' + stagger + '>' +
        '<a class="card-poster" href="' + detailUrl + '" tabindex="-1" aria-hidden="true">' +
          '<img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="" loading="lazy" width="800" height="500">' +
          '<span class="badge">' + CE.esc(ev.category) + '</span>' +
          (status !== 'upcoming' ? '<span class="badge badge-ended">Ended</span>' : '') +
        '</a>' +
        '<div class="card-body">' +
          '<h3 class="card-title"><a href="' + detailUrl + '">' + CE.esc(ev.title) + '</a></h3>' +
          '<ul class="meta">' +
            '<li><span aria-hidden="true">📅</span><span><span class="visually-hidden">Date: </span>' + CE.esc(CE.formatDate(ev.date)) + (ev.end_date ? ' – ' + CE.esc(CE.formatDate(ev.end_date)) : '') + '</span></li>' +
            '<li><span aria-hidden="true">⏰</span><span><span class="visually-hidden">Time: </span>' + CE.esc(CE.formatTime(ev.time)) + (ev.end_time ? ' – ' + CE.esc(CE.formatTime(ev.end_time)) : '') + '</span></li>' +
            '<li><span aria-hidden="true">📍</span><span><span class="visually-hidden">Venue: </span>' + CE.esc(ev.venue) + '</span></li>' +
            '<li><span aria-hidden="true">🏷️</span><span><span class="visually-hidden">Category: </span>' + CE.esc(ev.category) + '</span></li>' +
          '</ul>' +
          '<p class="card-desc">' + CE.esc(ev.short_description) + '</p>' +
          '<div class="card-actions">' + button + '</div>' +
        '</div>' +
      '</article>';
  }

  /* ---------- list page ---------- */
  function filtered() {
    const q = state.query.trim().toLowerCase();
    return sortForDisplay(state.events).filter((ev) => {
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
    // Restart the reveal animation each time the list changes (search/filter).
    requestAnimationFrame(() => {
      grid.querySelectorAll('.event-card.reveal').forEach((card) => {
        card.style.animation = 'none';
        void card.offsetWidth;
        card.style.animation = '';
      });
    });
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

  function renderNextUp() {
    const box = document.getElementById('next-up');
    if (!box) return;
    const featured = sortForDisplay(state.events).filter((e) => e.is_featured && CE.eventStatus(e) === 'upcoming');
    const picks = featured.length ? featured : sortForDisplay(state.events).filter((e) => CE.eventStatus(e) === 'upcoming').slice(0, 5);
    if (!picks.length) { box.hidden = true; return; }
    box.innerHTML = '<div class="featured-head"><span class="ticket-label">Upcoming at Hapn</span><div class="carousel-controls"><button type="button" class="carousel-prev" aria-label="Previous events">‹</button><button type="button" class="carousel-next" aria-label="Next events">›</button></div></div>' +
      '<div class="featured-carousel" aria-label="Featured upcoming events">' +
      picks.map((ev) => '<article class="featured-card"><a class="featured-poster" href="event.html?id=' + encodeURIComponent(ev.id) + '"><img src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="" loading="lazy"></a><div class="featured-copy"><span class="featured-date">' + CE.esc(CE.formatDate(ev.date)) + '</span><h3><a href="event.html?id=' + encodeURIComponent(ev.id) + '">' + CE.esc(ev.title) + '</a></h3><p>' + CE.esc(ev.venue) + ' · ' + CE.esc(CE.formatTime(ev.time)) + '</p><a class="btn btn-primary btn-sm" href="event.html?id=' + encodeURIComponent(ev.id) + '">View event</a></div></article>').join('') +
      '</div>';
    const rail = box.querySelector('.featured-carousel');
    const cards = Array.from(rail.querySelectorAll('.featured-card'));
    let activeIndex = 0;
    const setActive = (index, shouldScroll) => {
      activeIndex = Math.max(0, Math.min(cards.length - 1, index));
      cards.forEach((card, i) => card.classList.toggle('is-active', i === activeIndex));
      if (shouldScroll && cards[activeIndex]) {
        const card = cards[activeIndex];
        const target = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
        rail.scrollTo({ left: Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, target)), behavior: 'smooth' });
      }
    };
    const closestCard = () => {
      const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let best = 0, distance = Infinity;
      cards.forEach((card, i) => { const d = Math.abs(card.getBoundingClientRect().left + card.clientWidth / 2 - center); if (d < distance) { distance = d; best = i; } });
      setActive(best, false);
    };
    rail.addEventListener('scroll', () => { window.requestAnimationFrame(closestCard); }, { passive: true });
    let pointerStartX = 0, pointerStartY = 0, pointerStartScroll = 0, dragging = false, pointerDown = false;
    const startDrag = (x, y) => {
      pointerStartX = x; pointerStartY = y; pointerStartScroll = rail.scrollLeft;
      pointerDown = true; dragging = false; rail.classList.add('is-pointer-down');
    };
    const moveDrag = (x, y, prevent) => {
      if (!pointerDown) return;
      const dx = x - pointerStartX, dy = y - pointerStartY;
      if (!dragging && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.05) dragging = true;
      if (dragging) { rail.scrollLeft = pointerStartScroll - dx; if (prevent) prevent(); }
    };
    const finishDrag = () => {
      if (!pointerDown) return;
      pointerDown = false; rail.classList.remove('is-pointer-down');
      if (dragging) {
        closestCard();
        rail.dataset.justDragged = 'true';
        window.setTimeout(() => { delete rail.dataset.justDragged; }, 120);
      }
      dragging = false;
    };
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') rail.setPointerCapture?.(e.pointerId);
    });
    rail.addEventListener('pointermove', (e) => moveDrag(e.clientX, e.clientY, () => e.preventDefault()));
    rail.addEventListener('pointerup', finishDrag);
    rail.addEventListener('pointercancel', finishDrag);
    // Explicit touch handlers make horizontal swiping reliable on mobile browsers.
    rail.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    rail.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY, () => e.preventDefault());
    }, { passive: false });
    rail.addEventListener('touchend', finishDrag, { passive: true });
    rail.addEventListener('touchcancel', finishDrag, { passive: true });
    rail.addEventListener('click', (e) => {
      if (rail.dataset.justDragged === 'true') { e.preventDefault(); e.stopPropagation(); }
    }, true);
    rail.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); setActive(activeIndex + 1, true); } if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(activeIndex - 1, true); } });
    box.querySelector('.carousel-prev').addEventListener('click', () => setActive(activeIndex - 1, true));
    box.querySelector('.carousel-next').addEventListener('click', () => setActive(activeIndex + 1, true));
    setActive(0, true);
    box.hidden = false;
    box.classList.add('ticket-ready');
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

    const { data, error } = await sb.from('events').select(LIST_COLUMNS).order('date', { ascending: true }).order('time', { ascending: true });
    if (error) {
      console.error(error);
      return showListError('Please check your connection and try again.');
    }
    state.events = data || [];
    renderList();
    renderNextUp();
  }

  /* ---------- details page ---------- */
  function detailHtml(ev) {
    const status = CE.eventStatus(ev);
    const link = CE.httpsUrl(ev.registration_link);
    const canRegister = CE.registrationOpen(ev) && link;
    const cta = canRegister
      ? '<a class="btn btn-primary btn-lg" href="' + CE.esc(link) + '" target="_blank" rel="noopener noreferrer">Register Now</a>' +
        '<small>Opens the registration form in a new tab.</small>'
      : '<span class="btn btn-lg btn-disabled" aria-disabled="true">' + (status !== 'upcoming' ? 'This event has ended' : 'Registration closed') + '</span>';

    const rows = [
      ['📅 Date', CE.formatDate(ev.date) + (ev.end_date ? ' – ' + CE.formatDate(ev.end_date) : '')],
      ['⏰ Time', CE.formatTime(ev.time) + (ev.end_time ? ' – ' + CE.formatTime(ev.end_time) : '')],
      ['📍 Venue', ev.venue],
      ['👥 Organizer', ev.organizer],
      ['🏷️ Category', ev.category]
    ];
    if (ev.registration_deadline) rows.push(['📝 Register by', CE.formatDate(ev.registration_deadline)]);

    return '' +
      '<div class="detail">' +
        '<div class="detail-poster"><img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="Poster for ' + CE.esc(ev.title) + '"></div>' +
        '<div class="detail-info">' +
          '<span class="pill">' + CE.esc(ev.category) + '</span>' + (status !== 'upcoming' ? '<span class="pill pill-ended">Ended</span>' : '') +
          '<h1>' + CE.esc(ev.title) + '</h1>' +
          '<dl class="info-list">' + rows.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + CE.esc(r[1]) + '</dd></div>').join('') + '</dl>' +
          '<h2 class="detail-text-title">About this event</h2>' +
          '<p class="detail-text">' + CE.esc(ev.description || ev.short_description) + '</p>' +
          '<div class="detail-cta">' + cta + '</div>' +
        '</div>' +
      '</div>';
  }

  async function initDetail() {
    const box = document.getElementById('event-detail');
    const notFound = (msg) => { box.innerHTML = '<div class="empty"><p class="empty-title">' + CE.esc(msg) + '</p><p><a href="events.html">Browse all events</a></p></div>'; };

    const id = new URLSearchParams(location.search).get('id') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return notFound('Event not found.');

    const problem = CE.setupProblem();
    if (problem) return notFound(problem);

    const { data, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
    if (error) { console.error(error); return notFound('This event could not be loaded. Please try again.'); }
    if (!data) return notFound('Event not found.');

    document.title = data.title + ' – Hapn';
    box.innerHTML = detailHtml(data);
  }

  const page = document.body.getAttribute('data-page');
  if (page === 'home' || page === 'events') initList();
  if (page === 'event') initDetail();
})();
