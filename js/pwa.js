(function () {
  'use strict';

  // Keep Hapn's existing offline/PWA service-worker registration.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (error) {
        console.warn('Hapn offline support could not be registered.', error);
      });
    });
  }

  var deferredInstallPrompt = null;

  function addInstallButton() {
    var header = document.querySelector('.site-header .header-inner');
    var menuButton = header && header.querySelector('.nav-toggle');
    if (!header || !menuButton || document.getElementById('hapn-install-button')) return;

    // Do not show an install action when Hapn is already running as an installed app.
    var standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (standalone) return;

    var style = document.createElement('style');
    style.textContent = `
      .hapn-install-button {
        display: inline-flex; align-items: center; justify-content: center;
        flex: 0 0 auto; width: 52px; height: 52px; margin-left: auto;
        padding: 0; border: 0; border-radius: 18px;
        background: #eef1ff; color: #2f45ff; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .hapn-install-button svg { width: 26px; height: 26px; display: block; }
      .hapn-install-button:focus-visible { outline: 3px solid #2f45ff; outline-offset: 3px; }
      @media (max-width: 600px) {
        .hapn-install-button { width: 48px; height: 48px; border-radius: 16px; margin-right: 10px; }
      }
    `;
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'hapn-install-button';
    button.className = 'hapn-install-button';
    button.setAttribute('aria-label', 'Install Hapn on your device');
    button.title = 'Install Hapn';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 17v3h14v-3"/></svg>';

    button.addEventListener('click', async function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        var choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === 'accepted') button.hidden = true;
        return;
      }

      var isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
        !window.MSStream;
      if (isIOS) {
        window.alert('To install Hapn: tap the Share button in Safari, then choose “Add to Home Screen”.');
      } else {
        window.alert('To install Hapn, open your browser menu and choose “Install app” or “Add to Home screen” if available.');
      }
    });

    // Place install control immediately before the existing menu button.
    header.insertBefore(button, menuButton);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener('appinstalled', function () {
    var button = document.getElementById('hapn-install-button');
    if (button) button.hidden = true;
    deferredInstallPrompt = null;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addInstallButton);
  } else {
    addInstallButton();
  }
})();