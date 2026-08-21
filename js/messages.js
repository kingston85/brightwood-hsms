/* ==========================================================================
   Brightwood HSMS — Messages (direct teacher <-> parent inbox)
   A private 1:1 conversation between a teacher and the parent/student
   account of a child in one of their sections — separate from the
   school-wide Announcements board. Each pair of people has exactly one
   thread, identified by their two user IDs sorted together.
   ========================================================================== */

const MessagesUI = { activePartnerId: null };

function messageThreadId(uidA, uidB) {
  return [uidA, uidB].sort().join('__');
}

// Who the signed-in user is currently allowed to START a new conversation
// with, based on real teaching relationships (not just anyone in the
// school) — a teacher can message parents of students in their assigned
// sections; a parent can message any teacher connected to their child's
// section (class teacher or a subject teacher on the timetable).
function eligibleMessagePartners() {
  const me = Auth.currentUser;
  const out = [];
  if (me.role === 'teacher') {
    const secIds = Auth.teacherSections(me.linkedId);
    const seen = new Set();
    DB.data.students.filter(s => secIds.includes(s.sectionId)).forEach((stu) => {
      const parentUser = DB.data.users.find(u => u.role === 'student' && u.linkedId === stu.id);
      if (!parentUser || seen.has(parentUser.id)) return;
      seen.add(parentUser.id);
      out.push({ userId: parentUser.id, name: parentUser.name, studentId: stu.id, studentName: `${stu.firstName} ${stu.lastName}` });
    });
  } else if (me.role === 'student') {
    const stu = Auth.linkedRecord();
    if (!stu) return out;
    const teacherIds = new Set();
    DB.allSections().filter(s => s.sectionId === stu.sectionId && s.classTeacherId).forEach(s => teacherIds.add(s.classTeacherId));
    DB.data.timetable.filter(t => t.sectionId === stu.sectionId).forEach(t => teacherIds.add(t.teacherId));
    teacherIds.forEach((tid) => {
      const teacherUser = DB.data.users.find(u => u.role === 'teacher' && u.linkedId === tid);
      if (!teacherUser) return;
      out.push({ userId: teacherUser.id, name: teacherUser.name, studentId: stu.id, studentName: `${stu.firstName} ${stu.lastName}` });
    });
  }
  return out;
}

function myMessages() {
  const me = Auth.currentUser.id;
  return (DB.data.messages || []).filter(m => m.fromUserId === me || m.toUserId === me);
}

function threadMessages(partnerId) {
  const me = Auth.currentUser.id;
  return myMessages()
    .filter(m => m.fromUserId === partnerId || m.toUserId === partnerId)
    .filter(m => (m.fromUserId === me && m.toUserId === partnerId) || (m.fromUserId === partnerId && m.toUserId === me))
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

function unreadMessageCount() {
  if (!Auth.currentUser) return 0;
  const me = Auth.currentUser.id;
  return (DB.data.messages || []).filter(m => m.toUserId === me && !(m.readBy || []).includes(me)).length;
}

// Every thread the signed-in user should see: people they're currently
// eligible to message, PLUS anyone they've already exchanged messages with
// (e.g. a section reassignment happened after the conversation started) —
// merged and de-duplicated by the other person's user ID.
function allThreads() {
  const me = Auth.currentUser.id;
  const byId = new Map();
  eligibleMessagePartners().forEach((p) => byId.set(p.userId, { ...p }));
  myMessages().forEach((m) => {
    const partnerId = m.fromUserId === me ? m.toUserId : m.fromUserId;
    const partnerName = m.fromUserId === me ? m.toName : m.fromName;
    if (!byId.has(partnerId)) byId.set(partnerId, { userId: partnerId, name: partnerName, studentId: m.studentId, studentName: DB.studentName(m.studentId) });
  });
  const threads = Array.from(byId.values()).map((p) => {
    const msgs = threadMessages(p.userId);
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter(m => m.toUserId === me && !(m.readBy || []).includes(me)).length;
    return { ...p, lastMessage: last ? last.body : '', lastAt: last ? last.sentAt : '', unread };
  });
  threads.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  return threads;
}

function renderMessages() {
  const threads = allThreads();
  // Fall back to the first thread if nothing is selected yet, OR if what's
  // selected belongs to a previous user's session (MessagesUI persists across
  // a logout/login on a shared device, but their thread list won't match).
  if ((!MessagesUI.activePartnerId || !threads.some(t => t.userId === MessagesUI.activePartnerId)) && threads.length) {
    MessagesUI.activePartnerId = threads[0].userId;
  }

  const listHTML = threads.length ? threads.map((t) => `
    <button type="button" class="w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 messageThreadBtn ${t.userId === MessagesUI.activePartnerId ? 'bg-brand-50' : 'hover:bg-slate-50'}" data-partner="${t.userId}">
      <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">${initialsAvatar(t.name)}</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-2">
          <span class="font-semibold text-sm truncate">${esc(t.name)}</span>
          ${t.unread ? `<span class="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">${t.unread}</span>` : ''}
        </div>
        <div class="text-xs text-slate-400 truncate">${t.studentName ? `Re: ${esc(t.studentName)}` : ''}${t.lastMessage ? ' · ' + esc(t.lastMessage) : (t.studentName ? ' · ' : '') + '<span class="italic">No messages yet — say hello</span>'}</div>
      </div>
    </button>
  `).join('') : `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">No conversations yet</div><div class="empty-hint">${Auth.is('teacher') ? 'Nobody in your assigned sections has a parent account linked yet.' : 'No teachers are linked to your child\'s section yet.'}</div></div>`;

  const activeThread = threads.find(t => t.userId === MessagesUI.activePartnerId);
  const convHTML = activeThread ? renderThreadPane(activeThread) : `<div class="empty-state h-full flex flex-col items-center justify-center"><div class="empty-icon">💬</div><div class="empty-title">Select a conversation</div></div>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card overflow-hidden" style="height: calc(100vh - 11rem);">
      <div class="grid md:grid-cols-[280px_1fr] h-full">
        <div class="border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto p-2 space-y-1">${listHTML}</div>
        <div class="flex flex-col min-h-0">${convHTML}</div>
      </div>
    </div>
  `;

  document.querySelectorAll('.messageThreadBtn').forEach((btn) => {
    btn.onclick = () => { MessagesUI.activePartnerId = btn.dataset.partner; markThreadRead(btn.dataset.partner); renderMessages(); };
  });
  if (activeThread) {
    markThreadRead(activeThread.userId);
    wireThreadPane(activeThread.userId);
  }
}

function renderThreadPane(thread) {
  const me = Auth.currentUser.id;
  const msgs = threadMessages(thread.userId);
  const bubbles = msgs.length ? msgs.map((m) => `
    <div class="flex ${m.fromUserId === me ? 'justify-end' : 'justify-start'}">
      <div class="max-w-[75%] ${m.fromUserId === me ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-900'} rounded-2xl px-4 py-2 text-sm">
        <div>${esc(m.body)}</div>
        <div class="text-[10px] mt-1 ${m.fromUserId === me ? 'text-brand-100' : 'text-slate-400'}">${new Date(m.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
      </div>
    </div>
  `).join('') : `<p class="text-sm text-slate-400 text-center py-8">No messages yet — say hello to ${esc(thread.name)}.</p>`;

  return `
    <div class="px-4 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0">
      <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${initialsAvatar(thread.name)}</div>
      <div>
        <div class="font-semibold text-sm">${esc(thread.name)}</div>
        ${thread.studentName ? `<div class="text-xs text-slate-400">Regarding ${esc(thread.studentName)}</div>` : ''}
      </div>
    </div>
    <div id="msgScroll" class="flex-1 overflow-y-auto p-4 space-y-3">${bubbles}</div>
    <form id="msgSendForm" class="border-t border-slate-200 p-3 flex gap-2 shrink-0">
      <input name="body" required autocomplete="off" placeholder="Type a message…" class="form-input flex-1" />
      <button type="submit" class="btn btn-primary">Send</button>
    </form>
  `;
}

function wireThreadPane(partnerId) {
  const scroll = document.getElementById('msgScroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  const form = document.getElementById('msgSendForm');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = form.elements.body;
    const body = input.value.trim();
    if (!body) return;
    sendMessageTo(partnerId, body);
    input.value = '';
  };
}

function sendMessageTo(partnerId, body) {
  const me = Auth.currentUser;
  const partner = allThreads().find(t => t.userId === partnerId) || eligibleMessagePartners().find(p => p.userId === partnerId);
  DB.add('messages', {
    threadId: messageThreadId(me.id, partnerId),
    fromUserId: me.id, fromName: me.name, fromRole: me.role,
    toUserId: partnerId, toName: partner ? partner.name : '',
    studentId: partner ? partner.studentId : '',
    body, sentAt: new Date().toISOString(), readBy: [me.id],
  });
  renderMessages();
}

function markThreadRead(partnerId) {
  const me = Auth.currentUser.id;
  let changed = false;
  (DB.data.messages || []).forEach((m) => {
    if (m.toUserId === me && m.fromUserId === partnerId && !(m.readBy || []).includes(me)) {
      m.readBy = [...(m.readBy || []), me];
      changed = true;
    }
  });
  if (changed) { DB.save(); if (window.renderNav) renderNav(); if (window.renderNotifBell) renderNotifBell(); }
}
