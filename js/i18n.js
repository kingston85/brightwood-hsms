/* ==========================================================================
   Brightwood HSMS — i18n scaffold (English / French)

   This is a STARTING SCAFFOLD, not full app coverage: it translates the
   highest-visibility, always-on-screen chrome — the login screen, the
   sidebar navigation, and a few header controls — so a French-speaking
   school can use the app's shell in their language. The hundreds of
   in-app labels/buttons generated dynamically per module (Students,
   Fees, Grades, etc.) are still English-only; see README.md "Language"
   for how to extend this file to cover more of them.

   Usage: give any static element `data-i18n="some.key"` (translates
   textContent), `data-i18n-placeholder="some.key"` (translates the
   `placeholder` attribute), or `data-i18n-title="some.key"` (translates
   the `title` attribute), then add that key to both DICT.en and DICT.fr
   below. I18N.applyStatic() sweeps the whole document for these on
   load and on every language switch.
   ========================================================================== */

const I18N_LANG_KEY = 'hsms_lang';

const I18N_DICT = {
  en: {
    'nav.dashboard': 'Dashboard', 'nav.announcements': 'Announcements', 'nav.messages': 'Messages',
    'nav.students': 'Students', 'nav.alumni': 'Alumni', 'nav.teachers': 'Teachers',
    'nav.staff': 'Staff Attendance & Leave', 'nav.subjects': 'Subjects', 'nav.classes': 'Classes & Timetable',
    'nav.attendance': 'Attendance', 'nav.qrscan': 'QR Scanner', 'nav.grades': 'Gradebook & Report Cards',
    'nav.examSchedule': 'Exam Timetable', 'nav.assignments': 'Assignments', 'nav.behavior': 'Behavior Log',
    'nav.library': 'Library', 'nav.calendar': 'School Calendar', 'nav.fees': 'Finance & Fees',
    'nav.users': 'User Accounts', 'nav.settings': 'Backup & Sync', 'nav.auditLog': 'Audit Log',
    'section.Academics': 'Academics', 'section.Resources': 'Resources', 'section.Finance': 'Finance',
    'section.Administration': 'Administration',
    'login.heroTitle': 'One platform for your entire school.',
    'login.heroSubtitle': 'Students, teachers, attendance, gradebook, timetables and fees — all in one professional, easy-to-use system.',
    'login.heroBullet1': 'Role-based access for Admins, Teachers & Parents',
    'login.heroBullet2': 'Works offline, syncs to Google Drive',
    'login.heroBullet3': 'Printable report cards & fee invoices',
    'login.signInHeading': 'Sign in to your account',
    'login.signInSub': 'Sign in with your school Google account, or your Firebase email and password.',
    'login.signInBtn': 'Sign In',
    'login.firebaseSectionTitle': 'Sign in with Email', 'login.firebaseSectionNote': '(Firebase account)',
    'header.searchPlaceholder': 'Search students, teachers, classes…',
    'header.notifications': 'Notifications', 'header.toggleDarkMode': 'Toggle dark mode',
    'sidebar.installApp': 'Install App', 'sidebar.signOut': 'Sign out',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord', 'nav.announcements': 'Annonces', 'nav.messages': 'Messages',
    'nav.students': 'Élèves', 'nav.alumni': 'Anciens élèves', 'nav.teachers': 'Enseignants',
    'nav.staff': 'Présence et congés du personnel', 'nav.subjects': 'Matières', 'nav.classes': 'Classes et emploi du temps',
    'nav.attendance': 'Présence', 'nav.qrscan': 'Scanner QR', 'nav.grades': 'Carnet de notes et bulletins',
    'nav.examSchedule': 'Calendrier des examens', 'nav.assignments': 'Devoirs', 'nav.behavior': 'Registre de discipline',
    'nav.library': 'Bibliothèque', 'nav.calendar': 'Calendrier scolaire', 'nav.fees': 'Finances et frais',
    'nav.users': 'Comptes utilisateurs', 'nav.settings': 'Sauvegarde et synchronisation', 'nav.auditLog': "Journal d'audit",
    'section.Academics': 'Académique', 'section.Resources': 'Ressources', 'section.Finance': 'Finances',
    'section.Administration': 'Administration',
    'login.heroTitle': 'Une seule plateforme pour toute votre école.',
    'login.heroSubtitle': 'Élèves, enseignants, présence, notes, emplois du temps et frais scolaires — le tout dans un système professionnel et facile à utiliser.',
    'login.heroBullet1': 'Accès selon le rôle pour administrateurs, enseignants et parents',
    'login.heroBullet2': 'Fonctionne hors ligne, synchronisation avec Google Drive',
    'login.heroBullet3': 'Bulletins et factures imprimables',
    'login.signInHeading': 'Connectez-vous à votre compte',
    'login.signInSub': 'Connectez-vous avec le compte Google de votre école, ou votre e-mail et mot de passe Firebase.',
    'login.signInBtn': 'Se connecter',
    'login.firebaseSectionTitle': 'Se connecter par e-mail', 'login.firebaseSectionNote': '(compte Firebase)',
    'header.searchPlaceholder': 'Rechercher élèves, enseignants, classes…',
    'header.notifications': 'Notifications', 'header.toggleDarkMode': 'Basculer le mode sombre',
    'sidebar.installApp': "Installer l'application", 'sidebar.signOut': 'Se déconnecter',
  },
};

const I18N = {
  lang: 'en',
  langNames: { en: 'EN', fr: 'FR' },

  init() {
    this.lang = localStorage.getItem(I18N_LANG_KEY) || 'en';
    if (!I18N_DICT[this.lang]) this.lang = 'en';
    document.documentElement.lang = this.lang;
    this.applyStatic();
    this.renderSwitchers();
  },

  // key: dotted string like 'nav.students'. fallback: what to show if this
  // language/key combination isn't in the dictionary yet — keeps an
  // incomplete translation from ever showing a blank or a raw key.
  t(key, fallback) {
    const entry = (I18N_DICT[this.lang] || {})[key];
    if (entry !== undefined) return entry;
    const enEntry = I18N_DICT.en[key];
    return enEntry !== undefined ? enEntry : (fallback !== undefined ? fallback : key);
  },

  setLang(lang) {
    if (!I18N_DICT[lang] || lang === this.lang) return;
    this.lang = lang;
    localStorage.setItem(I18N_LANG_KEY, lang);
    document.documentElement.lang = lang;
    this.applyStatic();
    this.renderSwitchers();
    // Sidebar nav + page title are (re)built from ROUTES at render time
    // rather than sitting in static HTML, so they need their own refresh.
    if (typeof Auth !== 'undefined' && Auth.currentUser && typeof renderNav === 'function') renderNav();
    if (typeof currentRoute !== 'undefined' && typeof ROUTES !== 'undefined') {
      const route = ROUTES.find(r => r.id === currentRoute);
      const titleEl = document.getElementById('pageTitle');
      if (route && titleEl) titleEl.textContent = this.t('nav.' + route.id, route.label);
    }
  },

  applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', this.t(el.dataset.i18nPlaceholder)); });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', this.t(el.dataset.i18nTitle)); });
  },

  renderSwitchers() {
    const langs = Object.keys(I18N_DICT);
    ['langSwitchLogin', 'langSwitchSidebar'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isSidebar = id === 'langSwitchSidebar';
      el.innerHTML = langs.map(l => {
        const active = l === this.lang;
        const base = isSidebar
          ? 'flex-1 text-center py-1.5 ' + (active ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')
          : 'px-2.5 py-1 border-r last:border-r-0 border-slate-200 ' + (active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50');
        return `<button type="button" data-lang="${l}" class="${base}">${this.langNames[l]}</button>`;
      }).join('');
      el.querySelectorAll('button[data-lang]').forEach(btn => {
        btn.onclick = () => this.setLang(btn.dataset.lang);
      });
    });
  },
};
