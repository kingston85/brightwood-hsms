/* ==========================================================================
   Brightwood HSMS — App bootstrap & shell wiring
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  DB.load();
  I18N.init();
  applyLoginBackground();
  wireThemeToggle();
  wireFirebaseLoginForm();
  initGoogleSignIn();
  Drive.init();
  FB.init(); // no-ops silently if not configured; if it IS configured and a
             // session already exists, its onAuthStateChanged callback will
             // call enterApp() itself shortly after this.
  // The Google Identity Services script tag loads async/defer, so it may
  // not be ready yet on first attempt — retry shortly after.
  setTimeout(() => { initGoogleSignIn(); Drive.init(); }, 1200);

  if (Auth.restoreSession()) {
    enterApp();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
  }

  wireShell();
});

let fbSetupMode = false;

function wireFirebaseLoginForm() {
  if (!FB.isConfigured()) return; // leave the "not configured" note showing
  document.getElementById('firebaseNotConfigured').classList.add('hidden');
  const form = document.getElementById('firebaseForm');
  form.classList.remove('hidden');

  document.getElementById('fbToggleModeBtn').addEventListener('click', () => {
    fbSetupMode = !fbSetupMode;
    document.getElementById('fbName').classList.toggle('hidden', !fbSetupMode);
    document.getElementById('fbSubmitBtn').textContent = fbSetupMode ? 'Create Admin Account' : 'Sign In';
    document.getElementById('fbToggleModeBtn').textContent = fbSetupMode ? 'Back to sign in' : 'First-time setup';
    document.getElementById('fbError').classList.add('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('fbEmail').value;
    const password = document.getElementById('fbPassword').value;
    const name = document.getElementById('fbName').value;
    const errEl = document.getElementById('fbError');
    errEl.classList.add('hidden');
    const submitBtn = document.getElementById('fbSubmitBtn');
    submitBtn.disabled = true;
    try {
      if (fbSetupMode) {
        if (!name.trim()) throw new Error('Please enter your full name.');
        await FB.signUpFirstAdmin(name.trim(), email, password);
      } else {
        await FB.signIn(email, password);
      }
      // enterApp() is triggered by FB's onAuthStateChanged listener once the
      // profile doc loads — nothing further to do here on success.
    } catch (err) {
      console.error(err);
      errEl.textContent = friendlyFirebaseError(err);
      errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function friendlyFirebaseError(err) {
  const code = err && err.code;
  if (code === 'auth/email-already-in-use') return 'An admin account already exists for this project — please sign in instead.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Incorrect email or password.';
  if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
  if (code === 'permission-denied') return 'An admin account may already exist for this project — please sign in instead, or check firestore.rules is published.';
  return err && err.message ? err.message : 'Something went wrong — please try again.';
}

// Shows the signed-in person's real photo in the top-right header avatar
// when they have one (students/teachers only — see js/photo.js), else the
// initials it always showed before. Called on login, and again from the
// student/teacher dashboards' "Change Photo" flow so a freshly-uploaded
// photo shows up there immediately too, not just after the next sign-in.
function refreshHeaderAvatar() {
  const u = Auth.currentUser;
  const el = document.getElementById('userAvatar');
  if (!u || !el) return;
  const linked = (typeof Auth.linkedRecord === 'function') ? Auth.linkedRecord() : null;
  if (linked && linked.photoURL) {
    el.innerHTML = `<img src="${esc(linked.photoURL)}" alt="${esc(u.name)}" class="w-full h-full rounded-full object-cover"/>`;
  } else {
    el.textContent = initialsAvatar(u.name);
  }
}

function enterApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('loginForm')?.reset();

  const u = Auth.currentUser;
  refreshHeaderAvatar();
  document.getElementById('userName').textContent = u.name;
  document.getElementById('userRole').textContent = u.role === 'student' ? 'Student / Parent' : u.role;
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  currentRoute = ROUTES.find(r => r.roles.includes(u.role)) ? 'dashboard' : ROUTES[0].id;
  renderNav();
  navigate('dashboard');
  applyBranding();

  // Give Drive.init()'s own async token/file setup a moment to settle before
  // checking — backups are admin-only, Drive.checkBackupReminder() no-ops
  // for everyone else.
  setTimeout(() => { if (typeof Drive !== 'undefined') Drive.checkBackupReminder(); }, 1500);
  setTimeout(() => { if (typeof checkOverdueRemindersOnLogin === 'function') checkOverdueRemindersOnLogin(); }, 2500);
}

function wireShell() {
  document.getElementById('sidebarLogout').addEventListener('click', () => {
    Auth.logout();
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('firebaseForm')?.reset();
    applyLoginBackground(); // Auth.logout() may have reloaded DB.data from local cache
    if (typeof Drive !== 'undefined') Drive.hideBackupReminder();
  });

  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarMobile);
  wireGlobalSearch();
}

// Optional: auto-save to Drive every 2 minutes if connected, so data stays backed up.
setInterval(() => { if (Drive.connected) Drive.saveToDrive(true); }, 120000);
