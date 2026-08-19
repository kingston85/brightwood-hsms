/* ==========================================================================
   Brightwood HSMS — Shared UI helpers: toast, modal, nav, routing, icons
   ========================================================================== */

/* ------------------------------- Icons ---------------------------------- */
const ICONS = {
  dashboard: '📊', students: '🎓', teachers: '🧑‍🏫', classes: '🏫', timetable: '🗓️',
  attendance: '📝', grades: '📚', fees: '💵', users: '👤', settings: '⚙️',
  reportcard: '📄',
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
    Active: 'green', Inactive: 'slate', Present: 'green', Absent: 'red', Late: 'amber', Excused: 'blue',
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
  { id: 'students', label: 'Students', icon: ICONS.students, roles: ['admin','teacher'], render: 'renderStudents', section: 'Academics' },
  { id: 'teachers', label: 'Teachers', icon: ICONS.teachers, roles: ['admin'], render: 'renderTeachers', section: 'Academics' },
  { id: 'classes', label: 'Classes & Timetable', icon: ICONS.classes, roles: ['admin','teacher','student'], render: 'renderClasses', section: 'Academics' },
  { id: 'attendance', label: 'Attendance', icon: ICONS.attendance, roles: ['admin','teacher','student'], render: 'renderAttendance', section: 'Academics' },
  { id: 'grades', label: 'Gradebook & Report Cards', icon: ICONS.grades, roles: ['admin','teacher','student'], render: 'renderGrades', section: 'Academics' },
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
    html += `<a data-route="${r.id}" class="${r.id === currentRoute ? 'active' : ''}"><span class="nav-icon">${r.icon}</span> ${r.label}</a>`;
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
  closeSidebarMobile();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderCurrentView() {
  const route = ROUTES.find(r => r.id === currentRoute);
  if (route) window[route.render]();
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
