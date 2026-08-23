/* ==========================================================================
   Brightwood HSMS — Attendance module
   ========================================================================== */

const AttendanceUI = { tab: 'mark', date: todayISO(), sectionId: null };

function renderAttendance() {
  if (Auth.is('student')) { renderStudentAttendance(); return; }

  if (!AttendanceUI.sectionId) AttendanceUI.sectionId = defaultScopedSectionId();

  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${AttendanceUI.tab==='mark'?'active':''}" onclick="setAttendanceTab('mark')">Mark Attendance</button>
      <button class="tab-btn ${AttendanceUI.tab==='report'?'active':''}" onclick="setAttendanceTab('report')">Reports</button>
    </div>
    <div id="attTabBody"></div>
  `;
  renderAttendanceTabBody();
}

function setAttendanceTab(tab) { AttendanceUI.tab = tab; renderAttendance(); }

function scopedSectionsForAttendance() {
  let sections = DB.allSections();
  if (Auth.is('teacher')) {
    const allowed = Auth.teacherSections(Auth.currentUser.linkedId);
    sections = sections.filter(s => allowed.includes(s.sectionId));
  }
  return sections;
}

function renderAttendanceTabBody() {
  const body = document.getElementById('attTabBody');
  body.innerHTML = AttendanceUI.tab === 'mark' ? markAttendanceHTML() : attendanceReportHTML();
  wireAttendanceControls();
}

function markAttendanceHTML() {
  const sections = scopedSectionsForAttendance();
  if (!sections.find(s => s.sectionId === AttendanceUI.sectionId)) AttendanceUI.sectionId = sections[0]?.sectionId;
  const students = AttendanceUI.sectionId ? DB.studentsInSection(AttendanceUI.sectionId) : [];
  const existing = {};
  DB.data.attendance.filter(a => a.date === AttendanceUI.date && a.sectionId === AttendanceUI.sectionId)
    .forEach(a => existing[a.studentId] = a.status);

  const rows = students.map(s => {
    const cur = existing[s.id] || 'Present';
    const opts = ['Present','Absent','Late','Excused'].map(st =>
      `<button data-student="${s.id}" data-status="${st}" class="att-btn btn-sm ${cur===st ? 'btn-primary' : 'btn-secondary'} ${st}" >${st}</button>`
    ).join(' ');
    return `<tr><td>${esc(s.firstName)} ${esc(s.lastName)}<div class="text-xs text-slate-400">${esc(s.admissionNo)}</div></td><td class="space-x-1 no-print">${opts}</td></tr>`;
  }).join('') || `<tr><td colspan="2" class="text-center text-slate-400 py-10">No students in this section.</td></tr>`;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div class="flex flex-wrap gap-2 items-center">
        <input type="date" id="attDate" value="${AttendanceUI.date}" class="form-input !w-44"/>
        <select id="attSectionSelect" class="form-select !w-56">
          ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===AttendanceUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-2 no-print">
        <button class="btn btn-secondary" onclick="goToQrScan('attendance')">📷 Scan to Mark</button>
        <button class="btn btn-primary" onclick="saveAttendance()">Save Attendance</button>
      </div>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody id="attRows">${rows}</tbody></table>
    </div>
  `;
}

function wireAttendanceControls() {
  const dateEl = document.getElementById('attDate');
  const secEl = document.getElementById('attSectionSelect');
  if (dateEl) dateEl.onchange = (e) => { AttendanceUI.date = e.target.value; renderAttendanceTabBody(); };
  if (secEl) secEl.onchange = (e) => { AttendanceUI.sectionId = e.target.value; renderAttendanceTabBody(); };
  document.querySelectorAll('.att-btn').forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest('tr');
      row.querySelectorAll('.att-btn').forEach(b => b.classList.remove('btn-primary'));
      row.querySelectorAll('.att-btn').forEach(b => b.classList.add('btn-secondary'));
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
    };
  });

  const repSel = document.getElementById('repSectionSelect');
  if (repSel) repSel.onchange = (e) => { AttendanceUI.sectionId = e.target.value; renderAttendanceTabBody(); };
}

function saveAttendance() {
  const rows = document.querySelectorAll('#attRows tr');
  rows.forEach(row => {
    const activeBtn = row.querySelector('.att-btn.btn-primary');
    if (!activeBtn) return;
    const studentId = activeBtn.dataset.student;
    const status = activeBtn.dataset.status;
    const existing = DB.data.attendance.find(a => a.date === AttendanceUI.date && a.sectionId === AttendanceUI.sectionId && a.studentId === studentId);
    if (existing) existing.status = status;
    else DB.data.attendance.push({ id: uid('att'), date: AttendanceUI.date, classId: DB.allSections().find(s=>s.sectionId===AttendanceUI.sectionId)?.classId, sectionId: AttendanceUI.sectionId, studentId, status });
  });
  DB.save();
  toast('Attendance saved.');
}

function attendanceReportHTML() {
  const sections = scopedSectionsForAttendance();
  if (!sections.find(s => s.sectionId === AttendanceUI.sectionId)) AttendanceUI.sectionId = sections[0]?.sectionId;
  const students = AttendanceUI.sectionId ? DB.studentsInSection(AttendanceUI.sectionId) : [];

  const rows = students.map(s => {
    const recs = DB.data.attendance.filter(a => a.studentId === s.id);
    const present = recs.filter(r => r.status === 'Present').length;
    const late = recs.filter(r => r.status === 'Late').length;
    const absent = recs.filter(r => r.status === 'Absent').length;
    const excused = recs.filter(r => r.status === 'Excused').length;
    const rate = DB.attendanceRateFor(s.id);
    return `<tr>
      <td>${esc(s.firstName)} ${esc(s.lastName)}</td>
      <td>${present}</td><td>${late}</td><td>${absent}</td><td>${excused}</td>
      <td class="font-semibold ${rate!==null && rate<80 ? 'text-red-600' : 'text-emerald-600'}">${rate ?? '—'}${rate!==null?'%':''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No data.</td></tr>`;

  const classAvg = AttendanceUI.sectionId ? Math.round(students.reduce((sum,s) => sum + (DB.attendanceRateFor(s.id) || 0), 0) / (students.length || 1)) : 0;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <select id="repSectionSelect" class="form-select !w-56">
        ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===AttendanceUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
      </select>
      <div class="card stat-card !p-3 text-sm"><span class="text-slate-400">Class Avg. Attendance:</span> <span class="font-bold text-brand-600">${classAvg}%</span></div>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Present</th><th>Late</th><th>Absent</th><th>Excused</th><th>Rate</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function renderStudentAttendance() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = `<p class="text-slate-400">No linked student record.</p>`; return; }
  const recs = DB.data.attendance.filter(a => a.studentId === stu.id).sort((a,b)=>b.date.localeCompare(a.date));
  const rate = DB.attendanceRateFor(stu.id);

  const rows = recs.map(r => `<tr><td>${r.date}</td><td>${statusBadge(r.status)}</td></tr>`).join('') ||
    `<tr><td colspan="2" class="text-center text-slate-400 py-10">No attendance records yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card stat-card inline-block"><div class="stat-value text-brand-600">${rate ?? '—'}${rate!==null?'%':''}</div><div class="text-xs text-slate-400">Overall Attendance Rate</div></div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}
