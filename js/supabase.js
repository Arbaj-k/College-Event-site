/*
 * Creates the Supabase client (available everywhere as `sb`).
 * Needs the Supabase library (loaded from a CDN in each HTML page) and js/config.js.
 */
(function () {
  'use strict';
  const CE = (window.CE = window.CE || {});
  const cfg = window.CE_CONFIG || {};
  const combined = String(cfg.SUPABASE_URL || '') + String(cfg.SUPABASE_ANON_KEY || '');

  CE.configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) && !/YOUR-/.test(combined);
  CE.libraryLoaded = Boolean(window.supabase && window.supabase.createClient);

  window.sb = null;
  if (CE.configured && CE.libraryLoaded) {
    window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  /* Human-friendly explanation when the site can't talk to Supabase. */
  CE.setupProblem = function () {
    if (!CE.libraryLoaded) return 'The Supabase library could not be loaded. Check your internet connection and try again.';
    if (!CE.configured) return 'Supabase is not configured yet. Add your Project URL and anon key to js/config.js (see the README).';
    return '';
  };
})();
