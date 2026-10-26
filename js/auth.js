/*
 * Admin authentication.
 *  - Login page: signs in with Supabase Auth, then checks the "admins" table.
 *  - Admin pages: CE.auth.requireAdmin() blocks the page unless the signed-in
 *    user's ID is in the "admins" table with role = 'admin'.
 *
 * NOTE: this is only the friendly front door. The real protection is Row Level
 * Security in the database (supabase/schema.sql): even if someone bypasses this
 * file, the database refuses inserts, updates and deletes from non-admins.
 */
(function () {
  'use strict';

  const CE = (window.CE = window.CE || {});
  const DENIED_MESSAGE = 'Access Denied — You do not have administrator permission.';
  // Defense in depth: end an unattended admin session after 15 minutes.
  // This does not replace server-side authorization or protect against active XSS.
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  let idleTimer = null;
  let lastActivityAt = 0;
  let idleListenersBound = false;

  function endIdleSession() {
    if (Date.now() - lastActivityAt < IDLE_TIMEOUT_MS) {
      scheduleIdleCheck();
      return;
    }
    void signOut().finally(() => location.replace('login.html'));
  }

  function scheduleIdleCheck() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(endIdleSession, IDLE_TIMEOUT_MS);
  }

  function recordActivity() {
    lastActivityAt = Date.now();
    scheduleIdleCheck();
  }

  function startIdleTimeout() {
    lastActivityAt = Date.now();
    scheduleIdleCheck();
    if (idleListenersBound) return;
    idleListenersBound = true;
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
      document.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) endIdleSession();
    });
  }

  function stopIdleTimeout() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  /* Is this user listed in the admins table? (RLS lets a user read only their own row.) */
  async function isAdmin(userId) {
    const { data, error } = await sb.from('admins').select('role').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return Boolean(data && data.role === 'admin');
  }

  async function signOut() {
    stopIdleTimeout();
    try { await sb.auth.signOut(); } catch (e) { console.error(e); }
  }

  function gateMessage(html) {
    const gate = document.getElementById('gate');
    if (gate) gate.innerHTML = html;
  }

  function bindLogout() {
    const btn = document.getElementById('logout-btn');
    if (btn) btn.addEventListener('click', async () => { await signOut(); location.replace('login.html'); });
  }

  /* Call at the start of every admin page. Returns the user, or null if access is refused. */
  async function requireAdmin() {
    bindLogout();

    const problem = CE.setupProblem();
    if (problem) {
      gateMessage('<div class="card"><h1>Setup needed</h1><p>' + CE.esc(problem) + '</p></div>');
      return null;
    }

    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) { location.replace('login.html'); return null; }

    // getUser() re-validates the session with the Supabase server.
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) { await signOut(); location.replace('login.html'); return null; }
    const user = userData.user;

    let admin = false;
    try {
      admin = await isAdmin(user.id);
    } catch (e) {
      console.error(e);
      gateMessage('<div class="card"><h1>Something went wrong</h1><p>We could not check your permissions. Please refresh the page.</p></div>');
      return null;
    }

    if (!admin) {
      gateMessage(
        '<div class="card" role="alert"><h1>Access Denied</h1><p>You do not have administrator permission.</p>' +
        '<div class="gate-actions"><button type="button" class="btn btn-primary" id="denied-signout">Sign out</button>' +
        '<a class="btn btn-outline" href="../index.html">Back to website</a></div></div>'
      );
      document.getElementById('denied-signout').addEventListener('click', async () => { await signOut(); location.replace('login.html'); });
      return null;
    }

    const gate = document.getElementById('gate');
    const content = document.getElementById('admin-content');
    if (gate) gate.hidden = true;
    if (content) content.hidden = false;
    const emailEl = document.getElementById('admin-email');
    if (emailEl) emailEl.textContent = user.email || '';
    startIdleTimeout();
    return user;
  }

  /* ---------- login page ---------- */
  async function initLogin() {
    const form = document.getElementById('login-form');
    const msg = document.getElementById('login-msg');
    const btn = document.getElementById('login-btn');

    const problem = CE.setupProblem();
    if (problem) {
      CE.showNotice(msg, problem, 'warn');
      btn.disabled = true;
      return;
    }

    // Already signed in as an admin? Go straight to the dashboard.
    try {
      const { data } = await sb.auth.getSession();
      if (data.session && (await isAdmin(data.session.user.id))) { location.replace('dashboard.html'); return; }
    } catch (e) { /* show the normal form */ }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Logging in…';

      try {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // 1. Authenticate with Supabase Auth
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          CE.showNotice(msg, /confirm/i.test(error.message) ? 'Please confirm your email address first.' : 'Incorrect email or password.');
          return;
        }

        // 2 + 3 + 4. Check the authenticated user's ID in the admins table
        let admin = false;
        try { admin = await isAdmin(data.user.id); }
        catch (checkError) {
          console.error(checkError);
          await signOut();
          CE.showNotice(msg, 'We could not verify your permissions. Please try again.');
          return;
        }

        // 5. Signed in but not an admin
        if (!admin) {
          await signOut();
          CE.showNotice(msg, DENIED_MESSAGE);
          return;
        }

        location.href = 'dashboard.html';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log in';
      }
    });
  }

  CE.auth = { isAdmin: isAdmin, signOut: signOut, requireAdmin: requireAdmin };

  if (document.body.getAttribute('data-page') === 'login') initLogin();
})();
