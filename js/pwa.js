/* ==========================================================================
   Brightwood HSMS — PWA install + service worker registration
   ========================================================================== */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      // Proactively check for a changed sw.js on every load, rather than
      // waiting on the browser's own much-less-frequent update schedule
      // (which can otherwise leave someone on an old service worker script
      // for a surprisingly long time). sw.js's own fetch handler already
      // always serves fresh app files while online regardless — this just
      // makes sure the service worker script itself doesn't lag behind too.
      .then((reg) => reg.update())
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}

// Chrome/Edge/Android fire this instead of showing their own install UI,
// so a site can offer its own "Install" button — Safari/iOS has no such
// event and relies on the browser's own Share -> Add to Home Screen instead.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installAppBtn');
  if (btn) { btn.classList.remove('hidden'); btn.classList.add('flex'); }
});

function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.classList.add('hidden');
  });
}

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.classList.add('hidden');
});
