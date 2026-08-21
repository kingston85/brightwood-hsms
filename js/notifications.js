/* ==========================================================================
   Brightwood HSMS — Notification bell
   A lightweight "what's new since I last looked" feed, built by scanning
   existing collections rather than storing separate notification records.
   The "last seen" cursor is kept in localStorage per user (device-local —
   it's just a UI convenience, not synced data), so opening the bell on one
   device doesn't affect the badge on another.
   ========================================================================== */

function notifSeenKey() {
  return Auth.currentUser ? `hsms_notif_seen_${Auth.currentUser.id}` : null;
}
function notifLastSeen() {
  const key = notifSeenKey();
  return (key && localStorage.getItem(key)) || '1970-01-01';
}
function notifMarkSeenNow() {
  const key = notifSeenKey();
  if (key) localStorage.setItem(key, new Date().toISOString());
}

// Builds the notification feed for whoever is signed in. Each item has a
// `when` (ISO date or day-string, compared against the last-seen cursor to
// decide if it's "new") and a `route` to jump to when clicked. Items that
// aren't really about "new since last visit" (like a bill coming due) are
// still included but marked `sticky: true` so they show up every time
// regardless of the seen cursor, instead of disappearing after one glance.
function buildNotifications() {
  const me = Auth.currentUser;
  if (!me) return [];
  const items = [];

  if (me.role === 'admin') {
    DB.data.paymentSubmissions.filter(p => p.status === 'Pending').forEach((p) => {
      items.push({ icon: '💵', text: `Payment submitted by ${DB.studentName(p.studentId)} awaiting verification`, when: p.submittedAt, route: 'fees', sticky: true });
    });
  }

  if (me.role === 'teacher' || me.role === 'student') {
    allThreads().filter(t => t.unread > 0).forEach((t) => {
      items.push({ icon: '💬', text: `${t.unread > 1 ? `${t.unread} new messages` : 'New message'} from ${t.name}`, when: t.lastAt, route: 'messages', sticky: true });
    });
  }

  scopedAnnouncements().forEach((a) => {
    items.push({ icon: '📢', text: `Announcement: ${a.title}`, when: a.date, route: 'announcements' });
  });

  if (me.role === 'student') {
    const stu = Auth.linkedRecord();
    if (stu) {
      (DB.data.assignments || []).filter(a => a.sectionId === stu.sectionId).forEach((a) => {
        items.push({ icon: '🧾', text: `New assignment: ${a.title}`, when: a.createdAt, route: 'assignments' });
      });
      (DB.data.behaviorLogs || []).filter(b => b.studentId === stu.id).forEach((b) => {
        items.push({ icon: b.type === 'Merit' ? '⭐' : '🚦', text: `${b.type === 'Merit' ? 'Merit' : 'Behavior'} note: ${b.description}`, when: b.date, route: 'behavior' });
      });
      const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      DB.invoicesForStudent(stu.id).filter(i => (i.amount - i.paidAmount) > 0 && i.dueDate && i.dueDate <= in7Days).forEach((i) => {
        items.push({ icon: '⏰', text: `${i.label} due ${i.dueDate}`, when: i.dueDate, route: 'fees', sticky: true });
      });
    }
  }

  const lastSeen = notifLastSeen();
  items.forEach((it) => { it.unread = it.sticky || (it.when || '') > lastSeen; });
  items.sort((a, b) => (b.when || '').localeCompare(a.when || ''));
  return items.slice(0, 30);
}

function notifUnreadCount() {
  return buildNotifications().filter(i => i.unread).length;
}

function renderNotifBell() {
  const badge = document.getElementById('notifBellBadge');
  if (!badge) return;
  const n = notifUnreadCount();
  if (n) { badge.textContent = n > 9 ? '9+' : n; badge.classList.remove('hidden'); badge.classList.add('flex'); }
  else { badge.classList.add('hidden'); badge.classList.remove('flex'); }
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  if (!dd.classList.contains('hidden')) { dd.classList.add('hidden'); return; }
  const items = buildNotifications();
  dd.innerHTML = `
    <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
      <span class="font-semibold text-sm">Notifications</span>
      <button id="notifMarkAllBtn" class="text-xs text-brand-600 font-semibold hover:underline">Mark all read</button>
    </div>
    ${items.length ? items.map((it) => `
      <button type="button" class="notifItemBtn w-full text-left px-4 py-3 flex gap-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${it.unread ? 'bg-brand-50/50' : ''}" data-route="${it.route}">
        <span class="text-lg leading-none shrink-0">${it.icon}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-xs text-ink-900 leading-snug">${esc(it.text)}</span>
          <span class="block text-[10px] text-slate-400 mt-0.5">${esc(it.when || '')}</span>
        </span>
        ${it.unread ? '<span class="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1"></span>' : ''}
      </button>
    `).join('') : `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">You're all caught up</div></div>`}
  `;
  dd.classList.remove('hidden');
  document.getElementById('notifMarkAllBtn')?.addEventListener('click', () => {
    notifMarkSeenNow();
    renderNotifBell();
    dd.classList.add('hidden');
    toast('Notifications marked as read.');
  });
  dd.querySelectorAll('.notifItemBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      dd.classList.add('hidden');
      navigate(btn.dataset.route);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBellBtn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleNotifDropdown(); });
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('notifDropdown');
    const btn = document.getElementById('notifBellBtn');
    if (dd && !dd.classList.contains('hidden') && !dd.contains(e.target) && e.target !== btn) dd.classList.add('hidden');
  });
});
