/* ==========================================================================
   Brightwood HSMS — Authentication & Session
   Lightweight client-side login suited to a single trusted device/network
   (e.g. the school office, or each staff member's own browser). Accounts and
   roles are stored in DB.data.users. This is NOT a hardened multi-tenant auth
   system — see README.md "Security notes" if you plan to expose this beyond
   a trusted local network, since passwords are stored in plain text in the
   local data file for simplicity.
   ========================================================================== */

const SESSION_KEY = 'hsms_session_v1';

const Auth = {
  currentUser: null,
  selectedRole: 'admin',

  restoreSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw);
        const fresh = DB.data.users.find(x => x.id === u.id);
        if (fresh) { this.currentUser = fresh; return true; }
      } catch (e) { /* ignore */ }
    }
    return false;
  },

  login(username, password, role) {
    const user = DB.data.users.find(u =>
      u.username.toLowerCase() === username.trim().toLowerCase() &&
      u.password === password &&
      u.role === role
    );
    if (!user) return { ok: false, error: 'Invalid username, PIN, or role selected.' };
    this.currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
    return { ok: true, user };
  },

  loginByEmail(email) {
    const user = DB.data.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, error: `No account found for ${email}. Ask your administrator to add you under Users.` };
    this.currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id }));
    return { ok: true, user };
  },

  logout() {
    const wasFirebase = this.currentUser && this.currentUser._firebase;
    if (typeof stopQrScan === 'function') stopQrScan(); // release the camera if it was left running
    this.currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
    if (wasFirebase && typeof FB !== 'undefined' && FB.active) {
      FB.signOutUser();
      // Fall back to whatever was last cached locally so the app has
      // something to show if the user switches to a local demo login next.
      DB.load();
    }
  },

  is(role) { return this.currentUser && this.currentUser.role === role; },

  // For a teacher, returns their teacher record; for a student/parent, returns linked student.
  linkedRecord() {
    if (!this.currentUser || !this.currentUser.linkedId) return null;
    if (this.currentUser.role === 'teacher') return DB.find('teachers', this.currentUser.linkedId);
    if (this.currentUser.role === 'student') return DB.find('students', this.currentUser.linkedId);
    return null;
  },

  // Sections a teacher is class-teacher of, or teaches a subject in.
  // In Firebase mode this is exactly the `assignedSectionIds` list an admin
  // set on the account (also what Firestore Security Rules check), so we
  // prefer it when present for consistency between the UI and the rules.
  teacherSections(teacherId) {
    if (this.currentUser && this.currentUser.role === 'teacher' && Array.isArray(this.currentUser.assignedSectionIds) && this.currentUser._firebase) {
      return this.currentUser.assignedSectionIds;
    }
    const sections = DB.allSections();
    const asClassTeacher = sections.filter(s => s.classTeacherId === teacherId).map(s => s.sectionId);
    const asSubjectTeacher = DB.data.timetable.filter(t => t.teacherId === teacherId).map(t => t.sectionId);
    return [...new Set([...asClassTeacher, ...asSubjectTeacher])];
  },
};

/* ---------------------------- Google Sign-In (identity) ------------------ */

function initGoogleSignIn() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) return;
  if (!Drive.isConfigured()) {
    const el = document.getElementById('googleSignInBtn');
    if (el) el.innerHTML = '<p class="text-xs text-slate-400 text-center px-4">Google Sign-In available once an OAuth Client ID is configured — see README.md.</p>';
    return;
  }
  google.accounts.id.initialize({
    client_id: DRIVE_CONFIG.CLIENT_ID,
    callback: handleGoogleCredential,
  });
  google.accounts.id.renderButton(document.getElementById('googleSignInBtn'), {
    theme: 'outline', size: 'large', width: 320, text: 'signin_with',
  });
}

function handleGoogleCredential(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const result = Auth.loginByEmail(payload.email);
    const errEl = document.getElementById('loginError');
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    enterApp();
  } catch (e) {
    console.error(e);
  }
}
