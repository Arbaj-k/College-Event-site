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
    const detailUrl = 'event-' + encodeURIComponent(ev.id) + '.html';
    const canRegister = CE.registrationOpen(ev) && link;

    const button = canRegister
      ? '<a class="btn btn-primary btn-block" href="' + CE.esc(link) + '" target="_blank" rel="noopener noreferrer">Register Now</a>'
      : (link ? '<span class="btn btn-block btn-disabled" aria-disabled="true">' + (status !== 'upcoming' ? 'Event Ended' : 'Registration Closed') + '</span>' : '');

    const stagger = 'style="--i:' + (index % 12) + '"';
    return '' +
      '<article class="event-card reveal' + (status !== 'upcoming' ? ' is-past' : '') + '" ' + stagger + '>' +
        '<div class="card-poster-wrap">' +
          '<a class="card-poster" href="' + detailUrl + '" tabindex="-1" aria-hidden="true">' +
            '<img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="" loading="lazy" width="800" height="500">' +
            '<span class="badge">' + CE.esc(ev.category) + '</span>' +
            (status !== 'upcoming' ? '<span class="badge badge-ended">Ended</span>' : '') +
          '</a>' +
          '<button class="poster-share-button share-button" type="button" data-share-url="' + detailUrl + '" data-share-title="' + CE.esc(ev.title) + ' – Hapn" aria-label="Share ' + CE.esc(ev.title) + '">' + plane + '</button>' +
        '</div>' +
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

    // Use every upcoming event; featured events appear first, without hiding the rest.
    const upcoming = sortForDisplay(state.events).filter((e) => CE.eventStatus(e) === 'upcoming');
    const picks = upcoming.slice().sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || byDateTime(a, b));
    if (!picks.length) { box.hidden = true; return; }

    box.innerHTML =
      '<div class="featured-head">' +
        '<div class="featured-heading-copy"><span class="ticket-label">Upcoming at Hapn</span><p class="featured-subtitle">Swipe to discover what’s happening next</p></div>' +
        '<div class="carousel-controls">' +
          '<button type="button" class="carousel-prev" aria-label="Previous event">‹</button>' +
          '<button type="button" class="carousel-next" aria-label="Next event">›</button>' +
        '</div>' +
      '</div>' +
      '<div class="featured-carousel" role="region" aria-label="Upcoming college events" tabindex="0">' +
      picks.map((ev, index) => {
        const eventUrl = 'event-' + encodeURIComponent(ev.id) + '.html';
        const description = String(ev.short_description || '').trim();
        return '<article class="featured-card' + (index === 0 ? ' is-active' : '') + '" data-slide-index="' + index + '">' +
          '<div class="featured-poster-wrap">' +
            '<a class="featured-poster" href="' + eventUrl + '" aria-label="View ' + CE.esc(ev.title) + '">' +
              '<img src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="' + CE.esc(ev.title) + ' poster" loading="' + (index < 2 ? 'eager' : 'lazy') + '" width="800" height="450">' +
            '</a>' +
            '<span class="featured-poster-badge">' + CE.esc(ev.category || 'College event') + '</span>' +
            '<button class="poster-share-button share-button" type="button" data-share-url="' + eventUrl + '" data-share-title="' + CE.esc(ev.title) + ' – Hapn" aria-label="Share ' + CE.esc(ev.title) + '">' + plane + '</button>' +
          '</div>' +
          '<div class="featured-copy">' +
            '<span class="featured-date">' + CE.esc(CE.formatDate(ev.date)) + (ev.end_date ? ' – ' + CE.esc(CE.formatDate(ev.end_date)) : '') + '</span>' +
            '<h3><a href="' + eventUrl + '">' + CE.esc(ev.title) + '</a></h3>' +
            '<p class="featured-venue">' + CE.esc(ev.venue || 'Venue to be announced') + (ev.time ? ' · ' + CE.esc(CE.formatTime(ev.time)) : '') + '</p>' +
            (description ? '<p class="featured-description">' + CE.esc(description) + '</p>' : '') +
            '<div class="featured-actions"><a class="btn btn-primary btn-sm" href="' + eventUrl + '">View Event</a></div>' +
          '</div>' +
        '</article>';
      }).join('') +
      '</div>' +
      '<div class="carousel-dots" role="group" aria-label="Choose an event slide">' +
        picks.map((ev, index) => '<button type="button" class="carousel-dot' + (index === 0 ? ' is-active' : '') + '" data-slide-to="' + index + '" aria-label="Go to event ' + (index + 1) + ': ' + CE.esc(ev.title) + '" aria-current="' + (index === 0 ? 'true' : 'false') + '"></button>').join('') +
      '</div>';

    const rail = box.querySelector('.featured-carousel');
    const cards = Array.from(rail.querySelectorAll('.featured-card'));
    const dots = Array.from(box.querySelectorAll('.carousel-dot'));
    let activeIndex = 0;
    let scrollFrame = 0;

    const goTo = (index, behavior) => {
      if (!cards.length) return;
      const nextIndex = (index + cards.length) % cards.length;
      const card = cards[nextIndex];
      const left = card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: behavior || 'smooth' });
      setActive(nextIndex);
    };

    const setActive = (index) => {
      activeIndex = index;
      cards.forEach((card, i) => {
        card.classList.toggle('is-active', i === activeIndex);
        card.setAttribute('aria-label', 'Event ' + (i + 1) + ' of ' + cards.length);
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === activeIndex);
        dot.setAttribute('aria-current', String(i === activeIndex));
      });
    };

    const updateActive = () => {
      scrollFrame = 0;
      const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let best = 0;
      let distance = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2;
        const d = Math.abs(cardCenter - center);
        if (d < distance) { distance = d; best = i; }
      });
      setActive(best);
    };

    rail.addEventListener('scroll', () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateActive);
    }, { passive: true });
    rail.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIndex + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIndex - 1); }
    });
    box.querySelector('.carousel-prev').addEventListener('click', () => goTo(activeIndex - 1));
    box.querySelector('.carousel-next').addEventListener('click', () => goTo(activeIndex + 1));
    box.querySelector('.carousel-dots').addEventListener('click', (e) => {
      const dot = e.target.closest('[data-slide-to]');
      if (dot) goTo(Number(dot.dataset.slideTo));
    });

    // Native touch scrolling preserves vertical page scroll while enabling horizontal swipes.
    box.hidden = false;
    box.classList.add('ticket-ready');
    requestAnimationFrame(() => goTo(0, 'auto'));
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
      const request = sb.from('events')
        .select(LIST_COLUMNS)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Events request timed out')), 10000)
      );

      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw error;

      state.events = data || [];
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
        '<div class="detail-poster detail-poster-wrap"><img class="poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="Poster for ' + CE.esc(ev.title) + '"><button class="poster-share-button share-button" type="button" data-share-url="event-' + encodeURIComponent(ev.id) + '.html" data-share-title="' + CE.esc(ev.title) + ' – Hapn" aria-label="Share ' + CE.esc(ev.title) + '" title="Share event"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>' +
        '<div class="detail-info">' +
          '<span class="pill">' + CE.esc(ev.category) + '</span>' + (status !== 'upcoming' ? '<span class="pill pill-ended">Ended</span>' : '') +
          '<h1>' + CE.esc(ev.title) + '</h1>' +
          '<dl class="info-list">' + rows.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + CE.esc(r[1]) + '</dd></div>').join('') + '</dl>' +
          '<h2 class="detail-text-title">About this event</h2>' +
          '<p class="detail-text">' + CE.esc(ev.description || ev.short_description) + '</p>' +
          '<div class="detail-cta">' + cta + '<button class="register-share-icon share-button" type="button" data-share-url="event-' + encodeURIComponent(ev.id) + '.html" data-share-title="' + CE.esc(ev.title) + ' – Hapn" aria-label="Share this event" title="Share event"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>' +
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

    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = location.origin + '/event.html?id=' + encodeURIComponent(data.id);

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
  }

  const page = document.body.getAttribute('data-page');
  if (page === 'home' || page === 'events') initList();
  if (page === 'event') initDetail();
})();
