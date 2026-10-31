(function () {
  'use strict';
  const msg = document.getElementById('reset-msg');
  const form = document.getElementById('reset-form');
  const btn = document.getElementById('reset-btn');

  function show(text, type) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = type ? 'notice notice-' + type : 'notice';
  }

  async function init() {
    if (window.CE && CE.setupProblem && CE.setupProblem()) {
      show(CE.setupProblem(), 'warn');
      form.hidden = true;
      return;
    }
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const authError = params.get('error_description') || params.get('error');
    if (authError) {
      show('This reset link is invalid or expired. Return to admin login and request a fresh link.', 'warn');
      form.hidden = true;
      return;
    }
    if (params.get('type') !== 'recovery' || !accessToken || !refreshToken) {
      show('Open this page using the password reset link sent to your email.', 'warn');
      form.hidden = true;
      return;
    }
    const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      show('This reset link is invalid or expired. Request a new one from admin login.', 'warn');
      form.hidden = true;
      return;
    }
    // Remove credentials from the address bar once Supabase has accepted them.
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const password = document.getElementById('new-password').value;
    const confirmation = document.getElementById('confirm-password').value;
    if (password.length < 8) { show('Password must be at least 8 characters.', 'warn'); return; }
    if (password !== confirmation) { show('Passwords do not match.', 'warn'); return; }
    btn.disabled = true;
    btn.textContent = 'Updating…';
    try {
      const { error } = await sb.auth.updateUser({ password: password });
      if (error) throw error;
      show('Password updated. You can now log in with your new password.', 'success');
      form.hidden = true;
    } catch (error) {
      show('Password could not be updated. The link may have expired; request a new reset email.', 'warn');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update password';
    }
  });

  init().catch(function () {
    show('Could not validate this reset link. Please request a fresh one.', 'warn');
    form.hidden = true;
  });
})();