/* Shared helpers – loaded on every page (public and admin). */
(function () {
  'use strict';

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

  /* Returns a clean https:// URL, or null if the value is not a valid https link. */
  CE.httpsUrl = function (value) {
    try {
      const u = new URL(String(value || '').trim());
      return u.protocol === 'https:' ? u.href : null;
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

  /* Mobile menu */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕' : '☰';
    });
  }

  /* If a poster image fails to load, show the placeholder instead. */
  document.addEventListener('error', function (e) {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.classList.contains('poster-img') && el.dataset.fallback !== 'done') {
      el.dataset.fallback = 'done';
      el.src = CE.PLACEHOLDER;
    }
  }, true);
})();
