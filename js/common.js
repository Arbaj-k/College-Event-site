/* Shared helpers – loaded on every page (public and admin). */
(function () {
  'use strict';

  // Keep public page URLs extensionless, including old bookmarks and generated event links.
  (function normalizePublicUrl() {
    const routes = {
      '/index.html': '/',
      '/events.html': '/events/',
      '/about.html': '/about/',
      '/help.html': '/help/',
      '/terms.html': '/terms/',
      '/submit-event.html': '/submit-event/',
      '/fests.html': '/fests/',
      '/event.html': '/event/',
      '/fest.html': '/fest/'
    };
    const path = location.pathname;
    const eventFile = path.match(/^\/event-([0-9a-f-]{36})\.html$/i);
    let cleanPath = routes[path];
    let query = location.search;
    if (eventFile) {
      cleanPath = '/event/';
      const params = new URLSearchParams(query);
      params.set('id', eventFile[1]);
      query = params.toString() ? '?' + params.toString() : '';
    }
    if (cleanPath && cleanPath !== path) {
      history.replaceState(null, document.title, cleanPath + query + location.hash);
    }

    // Rewrite legacy public links before users click them; leave admin tools/assets untouched.
    const cleanHref = (anchor) => {
      if (!anchor || !anchor.getAttribute) return;
      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
      let url;
      try { url = new URL(raw, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      const p = url.pathname;
      if (routes[p]) {
        url.pathname = routes[p];
      } else {
        const match = p.match(/^\/event-([0-9a-f-]{36})\.html$/i);
        if (match) {
          url.pathname = '/event/';
          const params = url.searchParams;
          params.set('id', match[1]);
          url.search = params.toString();
        }
      }
      if (url.pathname !== p) anchor.setAttribute('href', url.pathname + url.search + url.hash);
    };
    document.querySelectorAll('a[href]').forEach(cleanHref);
    const observer = new MutationObserver((records) => records.forEach((record) =>
      record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('a[href]')) cleanHref(node);
        if (node.querySelectorAll) node.querySelectorAll('a[href]').forEach(cleanHref);
      })
    ));
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  })();

  const CE = (window.CE = window.CE || {});
  const ROOT = document.body.getAttribute('data-root') || '';   // "" on public pages, "../" in /admin

  CE.ROOT = ROOT;
  CE.BUCKET = 'event-posters';
  CE.CATEGORIES = ['Technical', 'Workshop', 'Hackathon', 'Cultural', 'Sports', 'Career', 'Other'];
  CE.PLACEHOLDER = ROOT + 'assets/images/placeholder-poster.svg';

  /* Escape text before inserting it into HTML (protects against XSS). */
  CE.esc = function (value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
  };

  /* Returns a safe external HTTPS URL, rejecting credentials and non-HTTPS schemes. */
  CE.httpsUrl = function (value) {
    try {
      const u = new URL(String(value || '').trim());
      if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
      return u.href;
    } catch (e) { return null; }
  };

  /* Poster address: https URL (Supabase Storage) or a local path such as assets/images/x.svg. */
  CE.posterSrc = function (url) {
    if (!url) return CE.PLACEHOLDER;
    if (/^https:\/\//i.test(url)) return url;
    if (/^[\w\-./]+$/.test(url) && url.indexOf('..') === -1 && url.charAt(0) !== '/') return ROOT + url;
    return CE.PLACEHOLDER;
  };

  /* ---------- dates and times ---------- */
  CE.todayStr = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  CE.formatDate = function (str) {            // "2026-09-28" -> "28 September 2026"
    if (!str) return '';
    const p = str.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  CE.formatTime = function (str) {            // "14:00:00" -> "2:00 PM"
    if (!str) return '';
    const p = str.split(':').map(Number);
    return new Date(2000, 0, 1, p[0], p[1] || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  CE.daysUntil = function (str) {
    const p = str.split('-').map(Number);
    const t = new Date();
    const a = new Date(p[0], p[1] - 1, p[2]);
    const b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((a - b) / 86400000);
  };

  CE.nowLocalParts = function () {
    const d = new Date();
    return { date: CE.todayStr(), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
  };

  CE.eventStatus = function (ev) {
    const now = CE.nowLocalParts();
    const endDate = ev.end_date || ev.date;
    const endTime = ev.end_time || null;
    if (endDate < now.date || (endDate === now.date && endTime && endTime <= now.time)) return 'ended';
    return 'upcoming';
  };

  CE.registrationOpen = function (ev) {
    const now = CE.nowLocalParts();
    const beforeEnd = CE.eventStatus(ev) === 'upcoming';
    const beforeDeadline = !ev.registration_deadline || ev.registration_deadline >= now.date;
    return beforeEnd && beforeDeadline;
  };

  /* ---------- small UI helpers ---------- */
  CE.toast = function (message, type) {
    let box = document.getElementById('toast-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-box';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'success');
    t.textContent = message;
    box.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s ease, transform .25s ease';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px) scale(.98)';
      setTimeout(function () { t.remove(); }, 250);
    }, 4200);
  };

  CE.showNotice = function (el, message, kind) {
    if (!el) return;
    el.className = 'notice notice-' + (kind || 'error');
    el.textContent = message;
    el.hidden = false;
  };

  /* Accessible mobile menu: keyboard escape, outside click and clear labels. */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    function setMenuOpen(open, returnFocus) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      toggle.textContent = open ? '✕' : '☰';
      if (!open && returnFocus) toggle.focus();
    }

    toggle.setAttribute('aria-label', 'Open menu');
    toggle.addEventListener('click', function () {
      setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true', false);
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && window.matchMedia('(max-width: 767px)').matches) {
        setMenuOpen(false, false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false, true);
      }
    });

    document.addEventListener('click', function (event) {
      if (toggle.getAttribute('aria-expanded') === 'true' &&
          !nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenuOpen(false, false);
      }
    });

    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 768px)').matches) setMenuOpen(false, false);
    });
  }

  /* Share buttons use native sharing when available, otherwise copy the link. */
  document.addEventListener('click', async function (event) {
    const button = event.target.closest('.share-button');
    if (!button) return;
    event.preventDefault();
    const url = new URL(button.getAttribute('data-share-url') || location.href, location.href).href;
    const title = button.getAttribute('data-share-title') || document.title;
    if (navigator.share) {
      try { await navigator.share({ title: title, text: 'Check this out on Hapn:', url: url }); return; }
      catch (error) { if (error && error.name === 'AbortError') return; }
    }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement('textarea');
        input.value = url; input.setAttribute('readonly', '');
        input.style.position = 'fixed'; input.style.opacity = '0';
        document.body.appendChild(input); input.select();
        const copied = document.execCommand('copy'); input.remove();
        if (!copied) throw new Error('Copy failed');
      }
      CE.toast('Link copied! Share it with your friends.', 'success');
    } catch (error) {
      CE.toast('Could not copy the link. Please copy the page URL from your browser.', 'error');
    }
  });

  /* If a poster image fails to load, show the placeholder instead. */
  document.addEventListener('error', function (e) {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.classList.contains('poster-img') && el.dataset.fallback !== 'done') {
      el.dataset.fallback = 'done';
      el.src = CE.PLACEHOLDER;
    }
  }, true);
  /* ---------- OneSignal web push + lightweight Hapn popup ---------- */
  function initHapnNotifications() {
    if (location.pathname.startsWith('/admin/')) return;

    let resolveOneSignal, rejectOneSignal;
    const oneSignalReady = new Promise(function (resolve, reject) {
      resolveOneSignal = resolve;
      rejectOneSignal = reject;
    });
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: '876e30fb-b69f-49da-a8aa-e90bf0240723',
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          notifyButton: { enable: false }
        });
        window.HapnOneSignal = OneSignal;
        resolveOneSignal(OneSignal);
      } catch (error) {
        console.warn('Hapn OneSignal initialization failed.', error);
        rejectOneSignal(error);
      }
    });

    if (!document.querySelector('script[data-hapn-onesignal]')) {
      const sdk = document.createElement('script');
      sdk.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      sdk.defer = true;
      sdk.dataset.hapnOnesignal = 'true';
      sdk.onerror = function () {
        rejectOneSignal(new Error('OneSignal SDK failed to load'));
      };
      document.head.appendChild(sdk);
    }

    let dismissedUntil = 0;
    try { dismissedUntil = Number(localStorage.getItem('hapn-notice-dismissed-until') || 0); } catch (_) {}
    if (dismissedUntil > Date.now()) return;

    const popup = document.createElement('aside');
    popup.className = 'hapn-notice';
    popup.setAttribute('aria-label', 'Hapn notifications');
    popup.innerHTML = '<span class="hapn-notice-eyebrow">HAPN UPDATES</span><h2>Turn on notifications?</h2><p>Get alerts for important fests, hackathons and workshops. You can choose now.</p><div class="hapn-notice-actions"><button class="btn btn-primary hapn-enable-push" type="button">Turn ON</button><button class="btn btn-outline hapn-notice-off" type="button">Turn OFF</button></div>';
    document.body.appendChild(popup);

    function closePopup() {
      popup.classList.remove('is-visible');
      try { localStorage.setItem('hapn-notice-dismissed-until', String(Date.now() + 3 * 86400000)); } catch (_) {}
      setTimeout(function () { popup.remove(); }, 180);
    }
    popup.querySelector('.hapn-notice-off').addEventListener('click', closePopup);
    popup.querySelector('.hapn-enable-push').addEventListener('click', async function () {
      const button = this;
      if (button.disabled) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Connecting…';
      try {
        // The SDK loads asynchronously. Wait for init rather than showing repeated
        // "still loading" errors when a visitor clicks soon after page load.
        const OneSignal = await Promise.race([
          oneSignalReady,
          new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('OneSignal initialization timed out')); }, 15000);
          })
        ]);
        await OneSignal.Notifications.requestPermission();
        if (OneSignal.Notifications.permission) {
          CE.toast('Hapn notifications enabled!', 'success');
          closePopup();
        } else {
          CE.toast('Notifications were not enabled. You can change this in your browser settings.', 'error');
        }
      } catch (error) {
        console.warn('Could not enable Hapn notifications.', error);
        CE.toast('Notifications could not connect. Please refresh the page and try again.', 'error');
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
    if (popup.isConnected) popup.classList.add('is-visible');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHapnNotifications, { once: true });
  else initHapnNotifications();

})();
