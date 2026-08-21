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
  listenerStatus: {}, // per-collection 'ok' | 'error' — used by runDiagnostics()
  listenerErrors: {}, // per-collection last error message, when status is 'error'
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
    // Denormalize the login account's uid onto the teacher/student record it
    // links to. This is what lets Messages find "who to message" WITHOUT
    // reading the users collection directly — firestore.rules only lets a
    // user read their OWN users/{uid} doc, so a teacher has no way to look
    // up a parent's account (or vice versa) there. students/{id} and
    // teachers/{id} are readable more broadly (by section / by anyone
    // signed in), so storing the link there instead is what makes
    // messaging actually work under real security rules, not just in the
    // no-rules local-storage demo mode.
    if (linkedId && role === 'teacher') {
      await this.db.collection('teachers').doc(linkedId).set({ userId: uid }, { merge: true });
    } else if (linkedId && role === 'student') {
      await this.db.collection('students').doc(linkedId).set({ parentUserId: uid }, { merge: true });
    }
    return uid;
  },

  async updateUserProfile(uid, patch) {
    await this.db.collection('users').doc(uid).update(patch);
  },

  async deleteUserProfile(user) {
    // Removes their Firestore profile (revokes app access immediately).
    // Deleting the underlying Firebase Auth account requires the Admin SDK
    // (a server) or the user's own re-authentication, so it isn't done from
    // this client-only app — see README.md "Security notes".
    await this.db.collection('users').doc(user.id).delete();
    // Clear the denormalized link set by adminCreateAccount above, so a
    // removed account doesn't linger as a dead messaging target.
    if (user.linkedId && user.role === 'teacher') {
      await this.db.collection('teachers').doc(user.linkedId).set({ userId: null }, { merge: true });
    } else if (user.linkedId && user.role === 'student') {
      await this.db.collection('students').doc(user.linkedId).set({ parentUserId: null }, { merge: true });
    }
  },

  // One-time self-healing pass for schools that were already using
  // Firebase Sync before the userId/parentUserId denormalization above
  // existed: without it, teacher/student accounts created earlier have no
  // link for Messages to find, so eligibleMessagePartners() would find
  // nobody even though the accounts are otherwise fine. Only an admin can
  // read every users/{uid} doc (see firestore.rules), so this only runs —
  // once per admin sign-in, quietly — while signed in as admin, which is
  // exactly the account that CAN see the full picture needed to fix it.
  async backfillMessagingLinks() {
    if (!this.active || !this.db || !this.currentProfile || this.currentProfile.role !== 'admin') return;
    try {
      const batch = this.db.batch();
      let count = 0;
      (DB.data.users || []).forEach((u) => {
        if (u.role === 'teacher' && u.linkedId) {
          const t = DB.find('teachers', u.linkedId);
          if (t && !t.userId) { batch.set(this.db.collection('teachers').doc(u.linkedId), { userId: u.id }, { merge: true }); count++; }
        } else if (u.role === 'student' && u.linkedId) {
          const s = DB.find('students', u.linkedId);
          if (s && !s.parentUserId) { batch.set(this.db.collection('students').doc(u.linkedId), { parentUserId: u.id }, { merge: true }); count++; }
        }
      });
      if (count) await batch.commit();
    } catch (e) {
      console.error('backfillMessagingLinks failed:', e);
    }
  },

  // Email notifications: writes a document shaped for Firebase's official
  // "Trigger Email from Firestore" Extension — install it (Firebase Console
  // → Extensions), point it at the "mail" collection, and give it your
  // SMTP details (see README.md → "Email Notifications"). Without the
  // extension installed, these documents just sit in Firestore unsent —
  // harmless, but no email actually goes out. Silently does nothing when
  // Firebase Sync isn't active or the recipient has no email on file, since
  // most of this app's email addresses (a guardian's, in particular) are
  // optional fields that may not be filled in yet.
  async queueEmail(to, subject, text) {
    if (!this.active || !this.db || !to) return;
    try {
      await this.db.collection('mail').add({
        to: [to],
        message: { subject, text },
      });
    } catch (e) {
      // Never let a notification failure block the real action (sending a
      // message, reviewing homework, etc.) that triggered it.
      console.error('Failed to queue email notification:', e);
    }
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
      if (profile.role === 'admin') {
        // Give the teachers/students/users listeners a moment to receive
        // their initial snapshots before checking what needs backfilling.
        setTimeout(() => this.backfillMessagingLinks(), 2500);
      }
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
    this.listenerStatus = {};
    this.listenerErrors = {};

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
        this.listenerStatus[col] = 'ok';
        delete this.listenerErrors[col];
        if (window.renderCurrentView) renderCurrentView();
        document.dispatchEvent(new CustomEvent('hsms:data-changed'));
      }, (err) => {
        console.error(`Firestore listener error on ${col}:`, err);
        this.listenerStatus[col] = 'error';
        this.listenerErrors[col] = (err && (err.message || err.code)) || String(err);
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
  // Turns a Firestore error into something a non-technical admin can act on,
  // instead of a raw error code.
  _friendlyError(e) {
    const code = (e && e.code) || '';
    if (code === 'permission-denied') return 'blocked by Firestore security rules (rules may be out of date — check Settings → Firebase Sync → Run Diagnostics)';
    if (code === 'unavailable') return 'could not reach Firestore (check your internet connection)';
    if (code === 'resource-exhausted') return 'hit Firestore\'s usage quota';
    if (code === 'unauthenticated') return 'your sign-in has expired — sign in again';
    if (code === 'invalid-argument') return 'contained a value Firestore rejected';
    return (e && e.message) || String(e) || 'an unknown error';
  },

  async pushAll(data) {
    if (!this.active || !this.db) return;
    if (this._pushing) { this._pendingPush = data; return; }
    this._pushing = true;
    this._setStatus('busy', 'Firebase: saving…');
    try {
      const batch = this.db.batch();
      const ops = []; // mirrors the batch, so we can retry item-by-item if the batch fails

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
          ops.push({ type: 'set', col: 'meta', id: 'school', data: metaRest, label: 'School information' });
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
          ops.push({ type: 'set', col, id: item.id, data: rest, label: col });
        });
        remoteIds.forEach((rid) => {
          if (!localIds.has(rid)) { batch.delete(this.db.collection(col).doc(rid)); ops.push({ type: 'delete', col, id: rid, label: col }); }
        });
      });

      if (ops.length === 0) {
        this._setStatus('live', 'Firebase: live sync');
        return;
      }

      try {
        await batch.commit();
        this._setStatus('live', 'Firebase: saved ' + new Date().toLocaleTimeString());
      } catch (batchErr) {
        // The batch is all-or-nothing, so one blocked record (e.g. one the
        // current user isn't allowed to touch) takes everything else down
        // with it. Retry each change individually so anything that *is*
        // allowed still gets saved, and we can name exactly what didn't.
        console.error('Firebase batch save failed, retrying individually:', batchErr);
        const failed = [];
        let succeeded = 0;
        for (const op of ops) {
          try {
            const ref = this.db.collection(op.col).doc(op.id);
            if (op.type === 'delete') await ref.delete();
            else await ref.set(op.data);
            succeeded++;
          } catch (itemErr) {
            failed.push({ ...op, reason: this._friendlyError(itemErr) });
          }
        }

        if (failed.length === 0) {
          // Transient batch-level failure (e.g. a dropped connection) —
          // every change made it through once retried individually.
          this._setStatus('live', 'Firebase: saved ' + new Date().toLocaleTimeString());
          toast('Saved (recovered automatically after a brief hiccup).', { type: 'success' });
        } else {
          const uniqueCols = [...new Set(failed.map((f) => f.label))];
          const reason = failed[0].reason;
          this._setStatus('error', `Firebase: ${failed.length} change(s) blocked`);
          toast(
            succeeded > 0
              ? `Saved ${succeeded} change(s). Could NOT save changes to: ${uniqueCols.join(', ')} — ${reason}.`
              : `Nothing was saved. Changes to ${uniqueCols.join(', ')} were ${reason}.`,
            { type: 'error', duration: 9000 }
          );
        }
      }
    } catch (e) {
      console.error('Firebase pushAll failed:', e);
      this._setStatus('error', 'Firebase: save failed');
      toast(`Save failed: ${this._friendlyError(e)}.`, { type: 'error', duration: 9000 });
    } finally {
      this._pushing = false;
      if (this._pendingPush) {
        const next = this._pendingPush;
        this._pendingPush = null;
        this.pushAll(next);
      }
    }
  },

  // Self-service health check for Settings → Firebase Sync. Written for a
  // non-technical admin to run themselves instead of opening the browser
  // console: each check is plain-English, and the most common real-world
  // failure (firestore.rules on the Firebase Console being out of date
  // relative to the app) is called out by name rather than as a generic
  // "permission denied."
  async runDiagnostics() {
    const results = [];

    results.push({
      check: 'Firebase project configured',
      status: this.isConfigured() ? 'pass' : 'fail',
      message: this.isConfigured()
        ? 'A real Firebase project is configured in js/firebase-sync.js.'
        : 'js/firebase-sync.js still has placeholder config values — see README.md → "Firebase Setup".',
    });
    if (!this.isConfigured()) return results;

    results.push({
      check: 'Signed in with a live Firebase account',
      status: this.active ? 'pass' : 'fail',
      message: this.active
        ? `Connected as ${(this.currentProfile && this.currentProfile.email) || 'unknown'}.`
        : 'Not currently signed in with a Firebase account — sign in via "Shared Firebase Account" on the login screen.',
    });
    if (!this.active) return results;

    const role = this.currentProfile && this.currentProfile.role;
    results.push({
      check: 'Signed-in account is an admin',
      status: role === 'admin' ? 'pass' : 'warn',
      message: role === 'admin'
        ? 'Confirmed admin access.'
        : `Signed in as role "${role}" — the remaining checks below need an admin account to fully verify.`,
    });

    const badCollections = FB_COLLECTIONS.filter((col) => this.listenerStatus[col] !== 'ok');
    results.push({
      check: 'All data collections are readable',
      status: badCollections.length ? 'fail' : 'pass',
      message: badCollections.length
        ? `These aren't syncing: ${badCollections.join(', ')}. This almost always means the firestore.rules published in the Firebase Console are older than the app — paste in the latest firestore.rules (Firebase Console → Firestore Database → Rules) and click Publish, then run this check again.`
        : 'Every collection the app uses is syncing correctly.',
    });
    if (badCollections.length) {
      const detail = badCollections
        .filter((col) => this.listenerErrors[col])
        .map((col) => `${col}: ${this.listenerErrors[col]}`)
        .join(' | ');
      if (detail) results.push({ check: 'Error detail', status: 'warn', message: detail });
    }

    if (role === 'admin') {
      try {
        const ref = this.db.collection('events').doc('__diagnostic_test__');
        await ref.set({ title: 'Diagnostic test — safe to ignore', date: new Date().toISOString(), __diagnosticTest: true });
        await ref.delete();
        results.push({ check: 'Live write test', status: 'pass', message: 'Successfully wrote and removed a test record in Firestore — saving works end to end.' });
      } catch (e) {
        results.push({
          check: 'Live write test',
          status: 'fail',
          message: `Writing to Firestore failed: ${(e && (e.message || e.code)) || e}. Re-check that firestore.rules is published and that this account's role is set to "admin" in its users/{uid} profile.`,
        });
      }
    }

    return results;
  },
};
