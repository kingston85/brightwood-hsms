/* ==========================================================================
   Brightwood HSMS — Staff Attendance & Leave module
   Two tabs: Attendance (admin marks each teacher present/absent/late per
   day) and Leave Requests (a teacher submits their own; admin approves or
   rejects). Mirrors the patterns already used for student attendance and
   payment submissions, just scoped to staff instead.
   ========================================================================== */

const StaffUI = { tab: 'attendance', date: todayISO() };

function renderStaff() {
  if (!Auth.is('admin')) StaffUI.tab = 'leave'; // teachers only ever see their own leave requests here
  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      ${Auth.is('admin') ? `<button class="tab-btn ${StaffUI.tab==='attendance'?'active':''}" onclick="setStaffTab('attendance')">Staff Attendance</button>` : ''}
      <button class="tab-btn ${StaffUI.tab==='leave'?'active':''}" onclick="setStaffTab('leave')">Leave Requests</button>
    </div>
    <div id="staffTabBody"></div>
  `;
  renderStaffTabBody();
}
function setStaffTab(t) { StaffUI.tab = t; renderStaff(); }

function renderStaffTabBody() {
  const body = document.getElementById('staffTabBody');
  body.innerHTML = StaffUI.tab === 'attendance' ? staffAttendanceHTML() : staffLeaveHTML();
  wireStaffControls();
}

/* ------------------------------ Attendance ------------------------------ */

function staffAttendanceHTML() {
  const existing = {};
  (DB.data.staffAttendance || []).filter(a => a.date === StaffUI.date).forEach(a => existing[a.teacherId] = a.status);

  const rows = DB.data.teachers.map(t => {
    const cur = existing[t.id] || 'Present';
    const opts = ['Present', 'Absent', 'Late'].map(st =>
      `<button data-teacher="${t.id}" data-status="${st}" class="staffatt-btn btn-sm ${cur===st ? 'btn-primary' : 'btn-secondary'}">${st}</button>`
    ).join(' ');
    return `<tr><td>${esc(t.firstName)} ${esc(t.lastName)}<div class="text-xs text-slate-400">${esc(DB.subjectName(t.subjectSpecialty))}</div></td><td class="space-x-1 no-print">${opts}</td></tr>`;
  }).join('') || `<tr><td colspan="2" class="text-center text-slate-400 py-10">No teachers on record.</td></tr>`;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <input type="date" id="staffAttDate" value="${StaffUI.date}" class="form-input !w-44"/>
      <button class="btn btn-primary" onclick="saveStaffAttendance()">Save Attendance</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Teacher</th><th>Status</th></tr></thead><tbody id="staffAttRows">${rows}</tbody></table>
    </div>
  `;
}

function saveStaffAttendance() {
  document.querySelectorAll('#staffAttRows .btn-primary.staffatt-btn').forEach(btn => {
    const teacherId = btn.dataset.teacher, status = btn.dataset.status;
    const existing = (DB.data.staffAttendance || []).find(a => a.date === StaffUI.date && a.teacherId === teacherId);
    if (existing) existing.status = status;
    else DB.data.staffAttendance.push({ id: uid('sat'), date: StaffUI.date, teacherId, status });
  });
  DB.save();
  toast('Staff attendance saved.');
}

function wireStaffControls() {
  const dateInput = document.getElementById('staffAttDate');
  if (dateInput) dateInput.onchange = (e) => { StaffUI.date = e.target.value; renderStaffTabBody(); };
  document.querySelectorAll('.staffatt-btn').forEach(btn => {
    btn.onclick = () => {
      const teacherId = btn.dataset.teacher, status = btn.dataset.status;
      const existing = (DB.data.staffAttendance || []).find(a => a.date === StaffUI.date && a.teacherId === teacherId);
      if (existing) existing.status = status;
      else DB.data.staffAttendance.push({ id: uid('sat'), date: StaffUI.date, teacherId, status });
      renderStaffTabBody();
    };
  });
  const leaveForm = document.getElementById('leaveRequestForm');
  if (leaveForm) leaveForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const t = Auth.linkedRecord();
    if (!t) { toast('No linked teacher record — ask an admin to link your account.'); return; }
    DB.add('staffLeave', {
      teacherId: t.id, teacherName: DB.teacherName(t.id), type: fd.type, startDate: fd.startDate, endDate: fd.endDate,
      reason: fd.reason, status: 'Pending', requestedAt: new Date().toISOString(),
    });
    toast('Leave request submitted.');
    e.target.reset();
    renderStaffTabBody();
  };
}

/* ------------------------------ Leave requests ------------------------------ */

function staffLeaveHTML() {
  const isAdmin = Auth.is('admin');
  const myTeacher = isAdmin ? null : Auth.linkedRecord();
  let list = (DB.data.staffLeave || []).slice();
  if (!isAdmin) list = list.filter(l => myTeacher && l.teacherId === myTeacher.id);
  list = list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const rows = list.map(l => `
    <tr>
      <td>${esc(l.teacherName)}</td>
      <td>${esc(l.type)}</td>
      <td>${esc(l.startDate)} &rarr; ${esc(l.endDate)}</td>
      <td class="text-slate-500 max-w-xs">${esc(l.reason)}</td>
      <td>${statusBadge(l.status)}</td>
      <td class="text-right no-print space-x-1">
        ${isAdmin && l.status === 'Pending' ? `
          <button class="btn btn-secondary btn-sm" onclick="reviewStaffLeave('${l.id}','Approved')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="reviewStaffLeave('${l.id}','Rejected')">Reject</button>
        ` : ''}
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No leave requests${isAdmin ? '' : ' yet'}.</td></tr>`;

  return `
    ${!isAdmin ? `
    <form id="leaveRequestForm" class="card p-5 grid md:grid-cols-4 gap-3">
      <div><label class="form-label">Type</label><select name="type" class="form-select"><option>Sick</option><option>Personal</option><option>Bereavement</option><option>Maternity/Paternity</option><option>Other</option></select></div>
      <div><label class="form-label">Start Date</label><input required type="date" name="startDate" class="form-input"/></div>
      <div><label class="form-label">End Date</label><input required type="date" name="endDate" class="form-input"/></div>
      <div class="md:col-span-1 flex items-end"><button class="btn btn-primary w-full">Request Leave</button></div>
      <div class="md:col-span-4"><label class="form-label">Reason</label><input name="reason" class="form-input" placeholder="Brief reason"/></div>
    </form>` : ''}
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Teacher</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function reviewStaffLeave(id, status) {
  DB.update('staffLeave', id, { status, reviewedBy: Auth.currentUser.name, reviewedAt: new Date().toISOString() });
  logAudit(`Staff leave ${status.toLowerCase()}`, DB.find('staffLeave', id)?.teacherName || '');
  toast(`Leave request ${status.toLowerCase()}.`);
  renderStaffTabBody();
}
