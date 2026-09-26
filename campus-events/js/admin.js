/*
 * Admin dashboard and the add / edit event form.
 * Every write below (insert, update, delete, upload) is checked by the database:
 * Row Level Security refuses it unless the signed-in user is in the "admins" table.
 */
(function () {
  'use strict';

  const CE = window.CE;
  const page = document.body.getAttribute('data-page');

  const MAX_POSTER_BYTES = 5 * 1024 * 1024;
  const POSTER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const $ = (id) => document.getElementById(id);

  /* ---------- helpers ---------- */
  function friendlyError(err) {
    console.error(err);
    const text = (err && err.message) || '';
    if ((err && err.code === '42501') || /row-level security|permission denied/i.test(text)) return 'You do not have permission to do that.';
    if (err && (err.status === 401 || /jwt|token/i.test(text))) return 'Your session has expired. Please log in again.';
    if (err && err.code === '23514') return 'Some values are not allowed (check the dates, category and Google Form link).';
    return text || 'Something went wrong. Please try again.';
  }

  /* Storage path of a poster that lives in our bucket, or null (e.g. for sample images). */
  function posterPath(url) {
    if (!url) return null;
    const marker = '/storage/v1/object/public/' + CE.BUCKET + '/';
    const i = url.indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  }

  async function removePoster(url) {
    const path = posterPath(url);
    if (!path) return;
    const { error } = await sb.storage.from(CE.BUCKET).remove([path]);
    if (error) console.warn('Could not remove old poster:', error.message);
  }

  function statusOf(ev) {
    if (!ev.is_published) return { key: 'draft', label: 'Draft' };
    return CE.eventStatus(ev) === 'past' ? { key: 'past', label: 'Past' } : { key: 'upcoming', label: 'Upcoming' };
  }

  /* =====================================================
     DASHBOARD
     ===================================================== */
  let events = [];
  let pendingDelete = null;

  function renderStats() {
    const today = CE.todayStr();
    $('stat-total').textContent = events.length;
    $('stat-upcoming').textContent = events.filter((e) => e.date >= today).length;
    $('stat-past').textContent = events.filter((e) => e.date < today).length;
  }

  function renderRows() {
    const body = $('events-body');
    if (!events.length) {
      body.innerHTML = '<tr><td class="table-empty" colspan="6">No events yet. Click “+ Add New Event” to publish your first one.</td></tr>';
      return;
    }
    body.innerHTML = events.map((ev) => {
      const s = statusOf(ev);
      return '<tr>' +
        '<td data-label="Poster"><img class="thumb poster-img" src="' + CE.esc(CE.posterSrc(ev.poster_url)) + '" alt="" loading="lazy"></td>' +
        '<td data-label="Event"><span class="event-name">' + CE.esc(ev.title) + '</span></td>' +
        '<td data-label="Date">' + CE.esc(CE.formatDate(ev.date)) + '</td>' +
        '<td data-label="Category">' + CE.esc(ev.category) + '</td>' +
        '<td data-label="Status"><span class="status status-' + s.key + '">' + s.label + '</span></td>' +
        '<td data-label="Actions"><div class="row-actions">' +
          '<a class="btn btn-sm btn-outline" href="add-event.html?id=' + encodeURIComponent(ev.id) + '">Edit</a>' +
          '<button type="button" class="btn btn-sm btn-danger-outline" data-delete="' + CE.esc(ev.id) + '">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  async function loadEvents() {
    const { data, error } = await sb.from('events')
      .select('id,title,poster_url,date,time,category,is_published')
      .order('date', { ascending: false });
    if (error) {
      CE.showNotice($('dash-error'), friendlyError(error));
      return;
    }
    events = data || [];
    renderStats();
    renderRows();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const btn = $('confirm-delete');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      // .select() returns the deleted rows, so we can tell if the database really deleted something.
      const { data, error } = await sb.from('events').delete().eq('id', pendingDelete.id).select('id,poster_url');
      if (error) throw error;
      if (!data || !data.length) throw new Error('The event was not deleted. You may not have permission.');
      await removePoster(data[0].poster_url);
      $('delete-dialog').close();
      CE.toast('Event deleted successfully!');
      pendingDelete = null;
      await loadEvents();
    } catch (err) {
      $('delete-dialog').close();
      CE.toast(friendlyError(err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  }

  function initDashboard() {
    const dialog = $('delete-dialog');
    $('events-body').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delete]');
      if (!btn) return;
      pendingDelete = events.find((ev) => ev.id === btn.getAttribute('data-delete'));
      if (!pendingDelete) return;
      $('delete-title').textContent = pendingDelete.title;
      dialog.showModal();
    });
    $('cancel-delete').addEventListener('click', () => dialog.close());
    $('confirm-delete').addEventListener('click', confirmDelete);
    loadEvents();
  }

  /* =====================================================
     ADD / EDIT EVENT FORM
     ===================================================== */
  let editing = null;   // the event being edited (null when adding)

  function isGoogleFormUrl(url) {
    const clean = CE.httpsUrl(url);
    if (!clean) return false;
    const host = new URL(clean).hostname.toLowerCase();
    return host === 'forms.gle' || host === 'google.com' || host.endsWith('.google.com');
  }

  function readForm() {
    const v = (id) => $(id).value.trim();
    return {
      title: v('title'),
      date: v('date'),
      time: v('time').slice(0, 5),
      venue: v('venue'),
      organizer: v('organizer'),
      category: v('category'),
      short_description: v('short_description'),
      description: v('description') || null,
      registration_deadline: v('registration_deadline') || null,
      registration_link: v('registration_link'),
      is_published: $('is_published').checked
    };
  }

  function validate(values, file) {
    if (values.title.length < 3) return 'The event name must be at least 3 characters.';
    if (CE.CATEGORIES.indexOf(values.category) === -1) return 'Please choose a category.';
    if (!isGoogleFormUrl(values.registration_link)) return 'Enter a valid Google Form link. It must start with https:// (for example https://forms.gle/… or https://docs.google.com/forms/…).';
    if (values.registration_deadline && values.registration_deadline > values.date) return 'The registration deadline cannot be after the event date.';
    if (file) {
      if (!POSTER_TYPES[file.type]) return 'The poster must be a JPG, PNG or WebP image.';
      if (file.size > MAX_POSTER_BYTES) return 'The poster is too large. Please use an image under 5 MB.';
    }
    return '';
  }

  async function uploadPoster(file) {
    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    const path = id + '.' + POSTER_TYPES[file.type];   // extension comes from the verified type, not the file name
    const { error } = await sb.storage.from(CE.BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from(CE.BUCKET).getPublicUrl(path);
    return { path: path, url: data.publicUrl };
  }

  function fillForm(ev) {
    ['title', 'date', 'venue', 'organizer', 'category', 'short_description', 'description', 'registration_deadline', 'registration_link']
      .forEach((f) => { $(f).value = ev[f] || ''; });
    $('time').value = (ev.time || '').slice(0, 5);
    $('is_published').checked = ev.is_published !== false;
    if (ev.poster_url) {
      $('poster-preview').src = CE.posterSrc(ev.poster_url);
      $('poster-preview').hidden = false;
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    const errorBox = $('form-error');
    const button = $('submit-btn');
    errorBox.hidden = true;

    const values = readForm();
    const file = $('poster').files[0] || null;
    const problem = validate(values, file);
    if (problem) {
      CE.showNotice(errorBox, problem);
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    button.disabled = true;
    button.textContent = editing ? 'Saving…' : 'Publishing…';
    let uploaded = null;

    try {
      const payload = Object.assign({}, values);
      if (file) {
        uploaded = await uploadPoster(file);
        payload.poster_url = uploaded.url;
      }

      if (editing) {
        const { data, error } = await sb.from('events').update(payload).eq('id', editing.id).select('id');
        if (error) throw error;
        if (!data || !data.length) throw new Error('The event was not updated. You may not have permission.');
        if (uploaded) await removePoster(editing.poster_url);   // replace old poster
        CE.toast('Event updated successfully!');
      } else {
        const { error } = await sb.from('events').insert(payload);
        if (error) throw error;
        CE.toast('Event published successfully!');
      }
      setTimeout(() => { location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
      if (uploaded) await removePoster(uploaded.url);           // don't leave an unused upload behind
      CE.showNotice(errorBox, friendlyError(err));
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      button.disabled = false;
      button.textContent = editing ? 'Save Changes' : 'Publish Event';
    }
  }

  async function initForm() {
    const id = new URLSearchParams(location.search).get('id');

    $('poster').addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = $('poster-preview');
      if (!file) { preview.hidden = !editing || !editing.poster_url; return; }
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    if (id) {
      if (!UUID_RE.test(id)) { CE.showNotice($('form-error'), 'That event link is not valid.'); $('event-form').hidden = true; return; }
      const { data, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        CE.showNotice($('form-error'), error ? friendlyError(error) : 'Event not found. It may have been deleted.');
        $('event-form').hidden = true;
        return;
      }
      editing = data;
      $('form-heading').textContent = 'Edit event';
      $('submit-btn').textContent = 'Save Changes';
      $('poster-hint').textContent = 'Leave empty to keep the current poster. JPG, PNG or WebP, up to 5 MB.';
      document.title = 'Edit event – Campus Events';
      fillForm(data);
    }

    $('event-form').addEventListener('submit', submitForm);
  }

  /* ---------- start ---------- */
  async function start() {
    const user = await CE.auth.requireAdmin();    // stops here unless the user is an admin
    if (!user) return;
    if (page === 'dashboard') initDashboard();
    if (page === 'event-form') initForm();
  }

  if (page === 'dashboard' || page === 'event-form') start();
})();
