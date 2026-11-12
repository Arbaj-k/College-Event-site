(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const button = document.getElementById('login-button');
  const message = document.getElementById('login-error');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  function show(text) {
    message.hidden = false;
    message.textContent = text;
  }

  function clearMessage() {
    message.hidden = true;
    message.textContent = '';
  }

  function withTimeout(promise, label) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out. Check your connection and try again.')), 15000);
      })
    ]).finally(() => clearTimeout(timer));
  }

  async function getActiveSuperAdmin(userId) {
    const result = await withTimeout(
      window.sb.from('profiles').select('role,is_active').eq('user_id', userId).maybeSingle(),
      'Account verification'
    );
    if (result.error) {
      const code = result.error.code || '';
      if (code === '42P01' || code.startsWith('PGRST')) {
        throw new Error('Super Admin setup is not active yet. Please try again after the platform setup is completed.');
      }
      throw new Error('We could not verify your Super Admin access. Please retry. (' + result.error.message + ')');
    }
    return result.data?.role === 'super_admin' && result.data?.is_active === true;
  }

  if (!form || !button || !message || !emailInput || !passwordInput) return;

  if (!window.sb) {
    const problem = window.CE?.setupProblem?.() || 'Supabase is not available. Check your connection and reload this page.';
    show(problem);
    button.disabled = true;
    return;
  }

  // Restore a valid owner session without blocking the sign-in form if the network is down.
  withTimeout(window.sb.auth.getSession(), 'Session check')
    .then(async ({ data, error }) => {
      if (error) throw error;
      if (data?.session?.user?.id && await getActiveSuperAdmin(data.session.user.id)) {
        location.replace('/admin/super-admin.html');
      }
    })
    .catch(() => {
      // A failed background session check must not prevent a fresh sign-in attempt.
    });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!email || !password) {
      show('Enter your email address and password.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Verifying…';
    clearMessage();

    try {
      const { data, error } = await withTimeout(
        window.sb.auth.signInWithPassword({ email, password }),
        'Sign in'
      );
      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          throw new Error('Email or password is incorrect. Please check and try again.');
        }
        if (/email not confirmed/i.test(error.message)) {
          throw new Error('Please verify your email address before signing in.');
        }
        throw new Error(error.message || 'Sign in failed. Please try again.');
      }
      if (!data?.user?.id) throw new Error('Sign in could not be completed. Please try again.');

      const isSuperAdmin = await getActiveSuperAdmin(data.user.id);
      if (!isSuperAdmin) {
        await window.sb.auth.signOut();
        throw new Error('Access denied. This account is not an active Super Admin.');
      }

      location.replace('/admin/super-admin.html');
    } catch (error) {
      show(error?.message || 'We could not sign you in. Please try again.');
      button.disabled = false;
      button.textContent = 'Sign in securely';
    }
  });
})();