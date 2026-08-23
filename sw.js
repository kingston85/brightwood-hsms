/* ==========================================================================
   Brightwood HSMS — Service Worker (offline app shell)
   Caches the app's own files (HTML/CSS/JS) so it still loads and runs after
   the first visit even with no connection — this app already stores its
   data in localStorage (and optionally syncs to Firebase when online), so
   the actual school data was already working offline; this just makes sure
   the app itself can still open.

   NOT cached: the external CDN scripts in index.html (Tailwind, Chart.js,
   the Google/Firebase SDKs) — those need their own network request, and the
   app already has graceful fallbacks for when they can't load (see
   css/style.css's canvas note and dashboard.js). Firebase Sync itself
   obviously still needs a real connection to actually sync.

   Network-first, falling back to cache only when the network request fails
   (i.e. actually offline). An earlier version of this file was cache-first
   with a background refresh — that meant anyone who'd already opened the
   app once kept being served the JS from their FIRST visit until a second
   reload happened to complete the background refresh, which on some hosts'
   caching headers could take far longer than expected. For an app that
   ships updates, "instantly correct when online, cache is just the offline
   fallback" is the safer default — bump CACHE_VERSION below on top of that
   whenever you deploy a change, purely so old cached entries actually get
   cleaned up (evicted in the activate handler) instead of lingering
   unused — it's no longer what makes an update actually show up.
   ========================================================================== */

const CACHE_VERSION = 'hsms-v4';

const PRECACHE_URLS = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/alumni.js', 'js/announcements.js', 'js/assignments.js', 'js/attendance.js',
  'js/auditlog.js', 'js/auth.js', 'js/behavior.js', 'js/calendar.js', 'js/classes.js',
  'js/dashboard.js', 'js/data.js', 'js/drive.js', 'js/examSchedule.js', 'js/fees.js',
  'js/firebase-sync.js', 'js/grades.js', 'js/i18n.js', 'js/library.js', 'js/main.js', 'js/messages.js',
  'js/notifications.js', 'js/photo.js', 'js/pwa.js', 'js/push.js', 'js/qr.js', 'js/qrscan.js',
  'js/settings.js', 'js/staff.js', 'js/stripe-pay.js', 'js/students.js',
  'js/subjects.js', 'js/teachers.js', 'js/theme.js', 'js/ui.js', 'js/users.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/vendor/qrcode.min.js', 'assets/vendor/jsQR.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin GET requests — everything else (CDN scripts,
  // Firestore's own network calls, POSTs) passes straight through untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    // cache: 'no-store' bypasses the BROWSER's own HTTP cache too, not just
    // this service worker's cache — otherwise a host that sends long-lived
    // Cache-Control headers on JS files could hand back a "fresh" network
    // response that's actually just as stale as what we already had.
    fetch(req, { cache: 'no-store' }).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req)) // offline, or the request failed — fall back to whatever's cached
  );
});
