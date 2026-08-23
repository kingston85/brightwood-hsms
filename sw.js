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

   Bump CACHE_VERSION any time you deploy a change to a cached file, so
   returning visitors pick up the update instead of a stale cached copy.
   ========================================================================== */

const CACHE_VERSION = 'hsms-v2';

const PRECACHE_URLS = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/alumni.js', 'js/announcements.js', 'js/assignments.js', 'js/attendance.js',
  'js/auditlog.js', 'js/auth.js', 'js/behavior.js', 'js/calendar.js', 'js/classes.js',
  'js/dashboard.js', 'js/data.js', 'js/drive.js', 'js/examSchedule.js', 'js/fees.js',
  'js/firebase-sync.js', 'js/grades.js', 'js/i18n.js', 'js/library.js', 'js/main.js', 'js/messages.js',
  'js/notifications.js', 'js/pwa.js', 'js/push.js', 'js/qr.js', 'js/qrscan.js',
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
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached); // offline — fall back to whatever's cached
      // Cache-first for instant loads, but still refresh the cache in the
      // background from the network when available.
      return cached || network;
    })
  );
});
