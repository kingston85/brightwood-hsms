/* ==========================================================================
   Brightwood HSMS — FCM background service worker
   Required by Firebase Cloud Messaging to be at this exact path/filename at
   the site root. Handles a push notification arriving while no tab is
   open/focused — a separate concern from sw.js (the app's own offline-shell
   cache), which is why this is its own file rather than merged into it.

   IMPORTANT: this config must be kept in sync with FIREBASE_CONFIG in
   js/firebase-sync.js — a service worker can't read that file directly, so
   the same values are duplicated here.
   ========================================================================== */

importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDSWaHotMQ-idNgzcieWveAbR4i7UoCy3I',
  authDomain: 'school-management-30e7d.firebaseapp.com',
  projectId: 'school-management-30e7d',
  storageBucket: 'school-management-30e7d.firebasestorage.app',
  messagingSenderId: '93067659231',
  appId: '1:93067659231:web:f071729115c5a3f04fe66a',
});

// Instantiating this is enough — the SDK automatically displays a
// notification for any push payload that includes a `notification` field
// (which functions/index.js's sendPushOnMail always sends), even with no
// custom handler here.
firebase.messaging();
