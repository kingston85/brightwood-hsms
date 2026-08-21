/* ==========================================================================
   Brightwood HSMS — Firebase Sync (shared, real-time, multi-device backend)
   Optional alternative/companion to the local browser storage + Google Drive
   backup. When configured, ALL school data (students, teachers, attendance,
   grades, fees, etc.) lives in Cloud Firestore and updates in real time for
   everyone signed in — so an admin, a teacher and a student/parent on three
   different devices all see the same live data, with access enforced by
   Firestore Security Rules (see firestore.rules) rather than just hidden in
   the browser.

   SETUP REQUIRED: paste your own Firebase project config below, create the
   `meta/bootstrap` document, and publish `firestore.rules`. See README.md →
   "Firebase Setup" for the full walkthrough. Without it, the app works fully
   using local browser storage (and optionally Google Drive) — this is an
   opt-in upgrade, not a requirement.
   ========================================================================== */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDSWaHotMQ-idNgzcieWveAbR4i7UoCy3I',
  authDomain: 'school-management-30e7d.firebaseapp.com',
  projectId: 'school-management-30e7d',
  storageBucket: 'school-management-30e7d.firebasestorage.app',
  messagingSenderId: '93067659231',
  appId: '1:93067659231:web:f071729115c5a3f04fe66a',
};

// The collections synced wholesale between DB.data and Firestore on every
// save. `users` (login profiles/roles) is handled separately because
// creating one also has to create a Firebase Auth account (see
// adminCreateAccount below) — a generic array-sync can't do that.
const FB_COLLECTIONS = [
  'subjects', 'teachers', 'classes', 'students', 'timetable', 'exams', 'grades', 'attendance', 'feeStructure', 'invoices',
  'announcements', 'assignments', 'behaviorLogs', 'books', 'loans', 'events', 'paymentSubmissions', 'messages',
  'examSchedule', 'examSeating', 'submissions',
];

const FB = {
  app: null, auth: null, db: null,
  secondaryApp: null, secondaryAuth: null,
  active: false,
  ready: false,
  currentProfile: null,
  unsubscribers: [],
  lastKnownRemote: {},
  lastKnownRemoteMeta: null,
  _pushing: false,
  _pendingPush: null,

  isConfigured() {
    return FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('YOUR_');
  },

  init() {
    if (!this.isConfigured() || typeof firebase === 'undefined' || this.app) return;
    this.app = firebase.initializeApp(FIREBASE_CONFIG);
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    this._setStatus('idle', 'Firebase: signed out');
    this.auth.onAuthStateChanged((user) => this._onAuthStateChanged(user));
  },

  _secondaryAuth() {
    if (!this.secondaryApp) {
      this.secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, 'HSMS-Secondary');
      this.secondaryAuth = this.secondaryApp.auth();
    }
    return this.secondaryAuth;
  },

  _setStatus(state, text) {
    const wrap = document.getElementById('fbStatus');
    const dot = document.getElementById('fbDot');
    const label = document.getElementById('fbStatusText');
    if (!wrap) return;
    if (state === 'hidden') { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
    if (label) label.textContent = text;
    if (dot) dot.className = 'w-2 h-2 rounded-full ' + (
      state === 'live' ? 'bg-emerald-400' : state === 'busy' ? 'bg-amber-400 animate-pulse' : state === 'error' ? 'bg-red-400' : 'bg-slate-500'
    );
  },

  /* ------------------------------ Auth ------------------------------ */

  async signIn(email, password) {
    return this.auth.signInWithEmailAndPassword(email.trim(), password);
  },

  async signUpFirstAdmin(name, email, password) {
    const cred = await this.auth.createUserWithEmailAndPassword(email.trim(), password);
    const uid = cred.user.uid;
    try {
      const batch = this.db.batch();
      batch.set(this.db.collection('users').doc(uid), {
        name, email: email.trim(), role: 'admin', linkedId: null, assignedSectionIds: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      batch.update(this.db.collection('meta').doc('bootstrap'), { adminCreated: true });
      await batch.commit();
    } catch (e) {
      // Roll back the orphaned auth account if we couldn't claim the admin slot
      // (e.g. someone already bootstrapped this project).
      await cred.user.delete().catch(() => {});
      throw e;
    }
    return uid;
  },

  signOutUser() { return this.auth.signOut(); },

  // Creates a login for a teacher/student/parent WITHOUT disturbing the
  // admin's own session: the new account is created on a throwaway
  // "secondary" Firebase app instance, then immediately signed out there,
  // while the admin's primary session (and therefore their Firestore write
  // permission) stays intact to create the profile document.
  async adminCreateAccount({ name, email, password, role, linkedId, assignedSectionIds }) {
    const sAuth = this._secondaryAuth();
    const cred = await sAuth.createUserWithEmailAndPassword(email.trim(), password);
    const uid = cred.user.uid;
    await sAuth.signOut();
    await this.db.collection('users').doc(uid).set({
      name, email: email.trim(), role, linkedId: linkedId || null, assignedSectionIds: assignedSectionIds || [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return uid;
  },

  async updateUserProfile(uid, patch) {
    await this.db.collection('users').doc(uid).update(patch);
  },

  async deleteUserProfile(uid) {
    // Removes their Firestore profile (revokes app access immediately).
    // Deleting the underlying Firebase Auth account requires the Admin SDK
    // (a server) or the user's own re-authentication, so it isn't done from
    // this client-only app — see README.md "Security notes".
    await this.db.collection('users').doc(uid).delete();
  },

  async _onAuthStateChanged(user) {
    if (user) {
      this._setStatus('busy', 'Firebase: connecting…');
      let snap;
      try {
        snap = await this.db.collection('users').doc(user.uid).get();
      } catch (e) {
        console.error(e);
        this._setStatus('error', 'Firebase: permission error');
        toast('Could not load your profile from Firestore — check firestore.rules is published.');
        return;
      }
      if (!snap.exists) {
        toast('No profile found for this account. Ask your admin to set one up, or use "First-time setup" if you are the first admin.');
        await this.auth.signOut();
        return;
      }
      const profile = snap.data();
      this.currentProfile = profile;
      this.active = true;
      Auth.currentUser = {
        id: user.uid, name: profile.name, username: profile.email, email: profile.email,
        role: profile.role, linkedId: profile.linkedId || null, assignedSectionIds: profile.assignedSectionIds || [],
        _firebase: true,
      };
      this._startListeners();
      this._setStatus('live', 'Firebase: live sync');
      enterApp();
    } else {
      this.active = false;
      this.currentProfile = null;
      this._stopListeners();
      if (this.app) this._setStatus('idle', 'Firebase: signed out');
    }
  },

  /* --------------------------- Real-time sync --------------------------- */

  _startListeners() {
    this._stopListeners();
    DB.data = DB.data || {};
    this.lastKnownRemote = {};
    this.lastKnownRemoteMeta = null;

    this.unsubscribers.push(this.db.collection('meta').doc('school').onSnapshot((doc) => {
      if (doc.exists) {
        this.lastKnownRemoteMeta = doc.data();
        DB.data.meta = { ...DB.data.meta, ...this.lastKnownRemoteMeta };
      }
      if (window.renderCurrentView) renderCurrentView();
    }));

    FB_COLLECTIONS.forEach((col) => {
      this.unsubscribers.push(this.db.collection(col).onSnapshot((qs) => {
        const map = {};
        DB.data[col] = qs.docs.map((d) => {
          const docData = d.data();
          map[d.id] = docData; // full remote data, not just a flag — pushAll() diffs against this
          return { id: d.id, ...docData };
        });
        this.lastKnownRemote[col] = map;
        if (window.renderCurrentView) renderCurrentView();
        document.dispatchEvent(new CustomEvent('hsms:data-changed'));
      }, (err) => {
        console.error(`Firestore listener error on ${col}:`, err);
      }));
    });

    this.unsubscribers.push(this.db.collection('users').onSnapshot((qs) => {
      DB.data.users = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (window.renderCurrentView) renderCurrentView();
    }, (err) => console.error('Firestore listener error on users:', err)));
  },

  _stopListeners() {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  },

  // Plain-object/array deep-equality, key-order independent — used by
  // pushAll() below to tell "actually changed" apart from "identical to
  // what we last received from Firestore." Good enough for this app's data
  // (JSON-shaped: strings, numbers, booleans, null, arrays, nested objects;
  // no Firestore Timestamp/FieldValue values are ever stored on the
  // per-record fields this compares).
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return a.every((v, i) => this._deepEqual(v, b[i]));
    }
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && this._deepEqual(a[k], b[k]));
  },

  // Full-collection write-through: called by DB.save() whenever local data
  // changes. Diffs the in-memory arrays against the last known Firestore
  // snapshot (kept up to date by the listeners above) so it can add/update
  // AND delete removed records in one batch. Simple and robust for a
  // school-sized dataset; the free Firestore tier's daily write quota is
  // far larger than what a school's worth of edits will ever use.
  //
  // Important: a record that hasn't actually changed since we last heard
  // about it from Firestore is skipped entirely rather than re-written.
  // This isn't just an efficiency tweak — several collections (payment
  // submissions once approved, homework submissions once reviewed, etc.)
  // have security rules that only let their *owner* update them while
  // still in an early/unlocked status. Since one save() call batches every
  // collection together, re-writing an untouched-but-now-locked record
  // alongside a real edit would get the *entire* batch rejected — breaking
  // saves for that user from then on, not just that one record.
  async pushAll(data) {
    if (!this.active || !this.db) return;
    if (this._pushing) { this._pendingPush = data; return; }
    this._pushing = true;
    this._setStatus('busy', 'Firebase: saving…');
    try {
      const batch = this.db.batch();
      let writeCount = 0;

      // meta/school is admin-only to write (see firestore.rules) — including
      // it in every save() batch regardless of who's saving would get a
      // teacher's or student's *entire* save (e.g. sending a message,
      // submitting homework) rejected, since a batch either fully commits
      // or fully fails. Only an admin ever attempts this write, and only
      // when it actually changed.
      if (this.currentProfile && this.currentProfile.role === 'admin') {
        const { id, ...metaRest } = data.meta || {};
        if (!this._deepEqual(this.lastKnownRemoteMeta || {}, metaRest)) {
          batch.set(this.db.collection('meta').doc('school'), metaRest, { merge: true });
          writeCount++;
        }
      }

      FB_COLLECTIONS.forEach((col) => {
        const remoteMap = this.lastKnownRemote[col] || {};
        const localIds = new Set((data[col] || []).map((x) => x.id));
        const remoteIds = new Set(Object.keys(remoteMap));
        (data[col] || []).forEach((item) => {
          const { id, ...rest } = item;
          const remote = remoteMap[id];
          if (remote !== undefined && this._deepEqual(remote, rest)) return; // unchanged — skip
          batch.set(this.db.collection(col).doc(item.id), rest);
          writeCount++;
        });
        remoteIds.forEach((rid) => {
          if (!localIds.has(rid)) { batch.delete(this.db.collection(col).doc(rid)); writeCount++; }
        });
      });

      if (writeCount > 0) {
        await batch.commit();
        this._setStatus('live', 'Firebase: saved ' + new Date().toLocaleTimeString());
      } else {
        this._setStatus('live', 'Firebase: live sync');
      }
    } catch (e) {
      console.error('Firebase pushAll failed:', e);
      this._setStatus('error', 'Firebase: save failed (see console)');
    } finally {
      this._pushing = false;
      if (this._pendingPush) {
        const next = this._pendingPush;
        this._pendingPush = null;
        this.pushAll(next);
      }
    }
  },
};
