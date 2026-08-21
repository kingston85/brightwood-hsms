/* ==========================================================================
   Brightwood HSMS — Shared UI helpers: toast, modal, nav, routing, icons
   ========================================================================== */

/* ------------------------------- Icons ---------------------------------- */
const ICONS = {
  dashboard: '📊', students: '🎓', teachers: '🧑‍🏫', classes: '🏫', timetable: '🗓️',
  attendance: '📝', grades: '📚', fees: '💵', users: '👤', settings: '⚙️',
  reportcard: '📄', announcements: '📢', assignments: '🧾', library: '📖',
  calendar: '📅', behavior: '🚦', subjects: '📘', messages: '💬', examSchedule: '📋',
};

/* ------------------------------- Toast ----------------------------------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

/* ------------------------------- Modal ------------------------------------ */
function openModal(html) {
  document.getElementById('modalCard').innerHTML = html;
  document.getElementById('modalRoot').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modalRoot').classList.add('hidden');
  document.getElementById('modalCard').innerHTML = '';
}
document.addEventListener('click', (e) => {
  if (e.target.id === 'modalRoot') closeModal();
});

function confirmAction(message, onConfirm, confirmLabel = 'Delete') {
  openModal(`
    <div class="p-6">
      <h3 class="font-bold text-lg mb-2">Are you sure?</h3>
      <p class="text-sm text-slate-500 mb-5">${message}</p>
      <div class="flex justify-end gap-2">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button id="confirmActionBtn" class="btn btn-danger">${confirmLabel}</button>
      </div>
    </div>
  `);
  document.getElementById('confirmActionBtn').onclick = () => { onConfirm(); closeModal(); };
}

/* ------------------------------- Badges ----------------------------------- */
function badge(text, color) {
  return `<span class="badge badge-${color}">${text}</span>`;
}
function statusBadge(status) {
  const map = {
    Active: 'green', Inactive: 'slate', Graduated: 'blue', Present: 'green', Absent: 'red', Late: 'amber', Excused: 'blue',
    Paid: 'green', Unpaid: 'red', Partial: 'amber',
  };
  return badge(status, map[status] || 'slate');
}

/* ------------------------------- Routing ----------------------------------- */

// NOTE: render is stored as a function NAME (string) and resolved lazily via
// window[name](). This module (ui.js) loads before the module files that
// define renderDashboard/renderStudents/etc., so referencing the functions
// directly here would throw a ReferenceError at parse time.
const ROUTES = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, roles: ['admin','teacher','student'], render: 'renderDashboard', section: null },
  { id: 'announcements', label: 'Announcements', icon: ICONS.announcements, roles: ['admin','teacher','student'], render: 'renderAnnouncements', section: null },
  { id: 'messages', label: 'Messages', icon: ICONS.messages, roles: ['teacher','student'], render: 'renderMessages', section: null },
  { id: 'students', label: 'Students', icon: ICONS.students, roles: ['admin','teacher'], render: 'renderStudents', section: 'Academics' },
  { id: 'teachers', label: 'Teachers', icon: ICONS.teachers, roles: ['admin'], render: 'renderTeachers', section: 'Academics' },
  { id: 'subjects', label: 'Subjects', icon: ICONS.subjects, roles: ['admin'], render: 'renderSubjects', section: 'Academics' },
  { id: 'classes', label: 'Classes & Timetable', icon: ICONS.classes, roles: ['admin','teacher','student'], render: 'renderClasses', section: 'Academics' },
  { id: 'attendance', label: 'Attendance', icon: ICONS.attendance, roles: ['admin','teacher','student'], render: 'renderAttendance', section: 'Academics' },
  { id: 'grades', label: 'Gradebook & Report Cards', icon: ICONS.grades, roles: ['admin','teacher','student'], render: 'renderGrades', section: 'Academics' },
  { id: 'examSchedule', label: 'Exam Timetable', icon: ICONS.examSchedule, roles: ['admin','teacher','student'], render: 'renderExamSchedule', section: 'Academics' },
  { id: 'assignments', label: 'Assignments', icon: ICONS.assignments, roles: ['admin','teacher','student'], render: 'renderAssignments', section: 'Academics' },
  { id: 'behavior', label: 'Behavior Log', icon: ICONS.behavior, roles: ['admin','teacher','student'], render: 'renderBehavior', section: 'Academics' },
  { id: 'library', label: 'Library', icon: ICONS.library, roles: ['admin','teacher','student'], render: 'renderLibrary', section: 'Resources' },
  { id: 'calendar', label: 'School Calendar', icon: ICONS.calendar, roles: ['admin','teacher','student'], render: 'renderCalendar', section: 'Resources' },
  { id: 'fees', label: 'Finance & Fees', icon: ICONS.fees, roles: ['admin','student'], render: 'renderFees', section: 'Finance' },
  { id: 'users', label: 'User Accounts', icon: ICONS.users, roles: ['admin'], render: 'renderUsers', section: 'Administration' },
  { id: 'settings', label: 'Backup & Sync', icon: ICONS.settings, roles: ['admin'], render: 'renderSettings', section: 'Administration' },
];

let currentRoute = 'dashboard';

function renderNav() {
  const nav = document.getElementById('navList');
  const role = Auth.currentUser.role;
  let html = '';
  let lastSection = '__none__';
  ROUTES.filter(r => r.roles.includes(role)).forEach(r => {
    if (r.section && r.section !== lastSection) {
      html += `<div class="nav-section-label">${r.section}</div>`;
      lastSection = r.section;
    } else if (!r.section && lastSection !== '__none__' && lastSection !== null) {
      lastSection = null;
    }
    const navBadge = r.id === 'fees' && role === 'admin' ? DB.data.paymentSubmissions.filter(p => p.status === 'Pending').length
      : r.id === 'messages' ? unreadMessageCount() : 0;
    html += `<a data-route="${r.id}" class="${r.id === currentRoute ? 'active' : ''} flex items-center justify-between"><span class="flex items-center gap-2"><span class="nav-icon">${r.icon}</span> ${r.label}</span>${navBadge ? `<span class="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">${navBadge}</span>` : ''}</a>`;
  });
  nav.innerHTML = html;
  nav.querySelectorAll('a[data-route]').forEach(a => {
    a.addEventListener('click', () => navigate(a.dataset.route));
  });
}

function navigate(routeId) {
  const role = Auth.currentUser.role;
  const route = ROUTES.find(r => r.id === routeId && r.roles.includes(role));
  if (!route) return;
  currentRoute = routeId;
  document.getElementById('pageTitle').textContent = route.label;
  document.querySelectorAll('#navList a').forEach(a => a.classList.toggle('active', a.dataset.route === routeId));
  window[route.render]();
  const mc = document.getElementById('mainContent');
  if (mc) { mc.classList.remove('view-fade'); void mc.offsetWidth; mc.classList.add('view-fade'); }
  if (window.renderNotifBell) renderNotifBell();
  closeSidebarMobile();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderCurrentView() {
  const route = ROUTES.find(r => r.id === currentRoute);
  if (route) window[route.render]();
  if (window.renderNotifBell) renderNotifBell();
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

/* ------------------------------- Small helpers ------------------------------ */

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function initialsAvatar(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function classOptions(selectedId) {
  return DB.data.classes.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}
function sectionOptions(classId, selectedId) {
  const c = DB.data.classes.find(c => c.id === classId);
  if (!c) return '';
  return c.sections.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}
function subjectOptions(selectedId) {
  return DB.data.subjects.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}
function teacherOptions(selectedId) {
  return DB.data.teachers.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${esc(t.firstName + ' ' + t.lastName)}</option>`).join('');
}

/* ------------------------------ Global Search ------------------------------ */

function wireGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const results = document.getElementById('globalSearchResults');
  if (!input) return;
  input.oninput = (e) => renderGlobalSearchResults(e.target.value.trim());
  input.onfocus = (e) => { if (e.target.value.trim()) renderGlobalSearchResults(e.target.value.trim()); };
  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) results.classList.add('hidden');
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; results.classList.add('hidden'); } });
}

function globalSearchRun(q) {
  const role = Auth.currentUser.role;
  const query = q.toLowerCase();
  const out = [];

  if (role === 'admin' || role === 'teacher') {
    let students = DB.data.students;
    if (role === 'teacher') {
      const secIds = Auth.teacherSections(Auth.currentUser.linkedId);
      students = students.filter(s => secIds.includes(s.sectionId));
    }
    students.filter(s => (`${s.firstName} ${s.lastName} ${s.admissionNo}`).toLowerCase().includes(query)).slice(0, 6).forEach(s => {
      out.push({ icon: '🎓', label: `${s.firstName} ${s.lastName}`, sub: `Student · ${DB.classSectionLabel(s.classId, s.sectionId)}`, action: () => { navigate('students'); setTimeout(() => viewStudent(s.id), 50); } });
    });
  }
  if (role === 'admin') {
    DB.data.teachers.filter(t => (`${t.firstName} ${t.lastName} ${t.staffNo}`).toLowerCase().includes(query)).slice(0, 5).forEach(t => {
      out.push({ icon: '🧑‍🏫', label: `${t.firstName} ${t.lastName}`, sub: 'Teacher · ' + DB.subjectName(t.subjectSpecialty), action: () => navigate('teachers') });
    });
  }
  if (role !== 'student') {
    DB.allSections().filter(s => (`${s.className} ${s.sectionName}`).toLowerCase().includes(query)).slice(0, 5).forEach(s => {
      out.push({ icon: '🏫', label: `${s.className} - ${s.sectionName}`, sub: 'Class Section', action: () => navigate('classes') });
    });
  }
  DB.data.announcements?.filter(a => a.title.toLowerCase().includes(query)).slice(0, 3).forEach(a => {
    out.push({ icon: '📢', label: a.title, sub: 'Announcement', action: () => navigate('announcements') });
  });
  return out.slice(0, 12);
}

function renderGlobalSearchResults(q) {
  const results = document.getElementById('globalSearchResults');
  if (!results) return;
  if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
  const matches = globalSearchRun(q);
  results.innerHTML = matches.map((m, i) => `
    <div class="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer" data-idx="${i}">
      <span class="text-lg">${m.icon}</span>
      <div><div class="font-medium">${esc(m.label)}</div><div class="text-xs text-slate-400">${esc(m.sub)}</div></div>
    </div>
  `).join('') || `<div class="px-3 py-4 text-slate-400 text-center">No matches for "${esc(q)}"</div>`;
  results.classList.remove('hidden');
  results.querySelectorAll('[data-idx]').forEach(el => {
    el.onclick = () => {
      matches[Number(el.dataset.idx)].action();
      results.classList.add('hidden');
      document.getElementById('globalSearchInput').value = '';
    };
  });
}
