/* ==========================================================================
   Brightwood HSMS — Push Notifications (Firebase Cloud Messaging)
   Optional, on top of Firebase Sync + the Email Notifications setup — see
   README.md "Push Notifications". Requires a VAPID key (below) and the
   sendPushOnMail Cloud Function in functions/index.js to be deployed.
   Without either, this module simply does nothing (no errors) — email
   notifications keep working regardless.
   ========================================================================== */

// Firebase Console -> Project settings -> Cloud Messaging -> Web Push
// certificates -> generate a key pair, and paste it here.
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

const Push = {
  messaging: null,

  isConfigured() {
    return VAPID_KEY && !VAPID_KEY.startsWith('YOUR_');
  },

  // A quick synchronous check for whether it's worth showing the "Enable
  // Push Notifications" option at all. This does NOT guarantee success —
  // e.g. actual browser support can only really be confirmed by trying —
  // enable() below has its own try/catch for that.
  available() {
    return this.isConfigured()
      && typeof firebase !== 'undefined' && !!firebase.messaging
      && 'Notification' in window && 'serviceWorker' in navigator
      && typeof FB !== 'undefined' && FB.active;
  },

  permissionState() {
    return ('Notification' in window) ? Notification.permission : 'unsupported'; // 'default' | 'granted' | 'denied'
  },

  // Called from Settings' "🔔 Enable Push Notifications" button — must be a
  // direct result of a user click, since browsers block permission prompts
  // that aren't.
  async enable() {
    if (!this.available()) { toast('Push notifications need a VAPID key configured and Firebase Sync active — see README.md.'); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast('Notification permission was not granted.'); return; }
      if (!this.messaging) this.messaging = firebase.messaging();
      const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
      const token = await this.messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) { toast('Could not get a push token — try again.'); return; }
      await this._saveToken(token);
      this._wireForegroundMessages();
      toast('Push notifications enabled on this device.', { type: 'success' });
    } catch (e) {
      console.error('Push enable failed:', e);
      toast('Could not enable push notifications — see console.');
    }
  },

  async _saveToken(token) {
    if (!FB.active || !FB.auth.currentUser) return;
    const uid = FB.auth.currentUser.uid;
    await FB.db.collection('pushTokens').doc(uid).set({
      uid, email: FB.currentProfile ? FB.currentProfile.email : '', token, updatedAt: new Date().toISOString(),
    });
  },

  async disable() {
    try {
      if (this.messaging) await this.messaging.deleteToken();
      if (FB.active && FB.auth.currentUser) await FB.db.collection('pushTokens').doc(FB.auth.currentUser.uid).delete();
      toast('Push notifications turned off on this device.');
    } catch (e) {
      console.error('Push disable failed:', e);
    }
  },

  // A push that arrives while this tab is already open and focused doesn't
  // trigger the OS-level notification banner by design (that's standard
  // browser behavior) — show a toast instead so it's not silently missed.
  _wireForegroundMessages() {
    if (!this.messaging || this._foregroundWired) return;
    this._foregroundWired = true;
    this.messaging.onMessage((payload) => {
      const n = payload.notification || {};
      toast(`🔔 ${n.title || 'Notification'}: ${n.body || ''}`, { duration: 6000 });
    });
  },
};
