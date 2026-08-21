/* ==========================================================================
   Brightwood HSMS — Exam Timetable & Seating
   A dedicated schedule for WHEN and WHERE each exam sitting happens —
   separate from the regular weekly class timetable (js/classes.js) — plus
   an optional printable seating chart per exam/section. Admin manages both;
   everyone signed in can view/print what's relevant to them.
   ========================================================================== */

const ExamSchedUI = { tab: 'timetable', examId: '', seatExamId: '', seatSectionId: '', seatRoom: 'Hall A', seatCols: 5 };

function scopedSectionsForExamSched() {
  let sections = DB.allSections();
  if (Auth.is('teacher')) {
    const allowed = Auth.teacherSections(Auth.currentUser.linkedId);
    sections = sections.filter(s => allowed.includes(s.sectionId));
  } else if (Auth.is('student')) {
    const stu = Auth.linkedRecord();
    sections = sections.filter(s => stu && s.sectionId === stu.sectionId);
  }
  return sections;
}

function renderExamSchedule() {
  const isAdmin = Auth.is('admin');
  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${ExamSchedUI.tab==='timetable'?'active':''}" onclick="setExamSchedTab('timetable')">Exam Timetable</button>
      <button class="tab-btn ${ExamSchedUI.tab==='seating'?'active':''}" onclick="setExamSchedTab('seating')">Seating Chart</button>
    </div>
    <div id="examSchedTabBody"></div>
  `;
  renderExamSchedTabBody();
}
function setExamSchedTab(t) { ExamSchedUI.tab = t; renderExamSchedule(); }

function renderExamSchedTabBody() {
  const body = document.getElementById('examSchedTabBody');
  body.innerHTML = ExamSchedUI.tab === 'timetable' ? examTimetableHTML() : examSeatingHTML();
  wireExamSchedControls();
}

/* ------------------------------ Exam Timetable ------------------------------ */

function examTimetableHTML() {
  const isAdmin = Auth.is('admin');
  const sections = scopedSectionsForExamSched();
  const secIds = new Set(sections.map(s => s.sectionId));

  let rows = DB.data.examSchedule.filter(r => secIds.has(r.sectionId));
  if (ExamSchedUI.examId) rows = rows.filter(r => r.examId === ExamSchedUI.examId);
  rows = rows.slice().sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const tableRows = rows.map(r => `
    <tr>
      <td>${esc(r.date)}</td>
      <td>${esc(r.startTime)} – ${esc(r.endTime)}</td>
      <td>${esc(DB.data.exams.find(e => e.id === r.examId)?.name || '—')}</td>
      <td>${DB.classSectionLabel(r.classId, r.sectionId)}</td>
      <td>${DB.subjectName(r.subjectId)}</td>
      <td>${esc(r.room) || '—'}</td>
      ${isAdmin ? `<td class="text-right no-print space-x-1">
        <button class="btn btn-secondary btn-sm" onclick="editExamSlot('${r.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteExamSlot('${r.id}')">Delete</button>
      </td>` : ''}
    </tr>
  `).join('') || `<tr><td colspan="${isAdmin ? 7 : 6}"><div class="empty-state"><div class="empty-icon">🗓️</div><div class="empty-title">No exam slots scheduled${ExamSchedUI.examId ? ' for this exam' : ''}</div></div></td></tr>`;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <select id="examFilterSelect" class="form-select !w-56">
        <option value="">All Exams</option>
        ${DB.data.exams.map(e => `<option value="${e.id}" ${e.id===ExamSchedUI.examId?'selected':''}>${esc(e.name)} (${esc(e.term)} ${esc(e.year)})</option>`).join('')}
      </select>
      <div class="flex gap-2">
        <button class="btn btn-secondary no-print" onclick="window.print()">🖨️ Print</button>
        ${isAdmin ? `<button class="btn btn-primary no-print" onclick="openExamSlotForm()">+ Add Slot</button>` : ''}
      </div>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Time</th><th>Exam</th><th>Class</th><th>Subject</th><th>Room</th>${isAdmin ? '<th class="no-print"></th>' : ''}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

function examSlotFormHTML(slot) {
  const isNew = !slot;
  slot = slot || { examId: DB.data.exams[0]?.id || '', sectionId: '', subjectId: DB.data.subjects[0]?.id || '', date: todayISO(), startTime: '08:00', endTime: '09:30', room: '' };
  const sections = DB.allSections();
  const sec = sections.find(s => s.sectionId === slot.sectionId) || sections[0];
  return `
    <form id="examSlotForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Add Exam Slot' : 'Edit Exam Slot'}</h3>
      <div><label class="form-label">Exam</label><select name="examId" required class="form-select">${DB.data.exams.map(e => `<option value="${e.id}" ${e.id===slot.examId?'selected':''}>${esc(e.name)} (${esc(e.term)} ${esc(e.year)})</option>`).join('')}</select></div>
      <div><label class="form-label">Class - Section</label><select name="sectionId" required class="form-select">${sections.map(s => `<option value="${s.sectionId}" data-class="${s.classId}" ${s.sectionId===slot.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}</select></div>
      <div><label class="form-label">Subject</label><select name="subjectId" required class="form-select">${subjectOptions(slot.subjectId)}</select></div>
      <div class="grid grid-cols-3 gap-3">
        <div><label class="form-label">Date</label><input type="date" required name="date" value="${esc(slot.date)}" class="form-input"/></div>
        <div><label class="form-label">Start</label><input type="time" required name="startTime" value="${esc(slot.startTime)}" class="form-input"/></div>
        <div><label class="form-label">End</label><input type="time" required name="endTime" value="${esc(slot.endTime)}" class="form-input"/></div>
      </div>
      <div><label class="form-label">Room</label><input name="room" value="${esc(slot.room)}" placeholder="e.g. Hall A" class="form-input"/></div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add Slot' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="id" value="${slot.id || ''}"/>
    </form>
  `;
}

function wireExamSlotForm(existingId) {
  const form = document.getElementById('examSlotForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    const obj = Object.fromEntries(new FormData(e.target).entries());
    const sec = DB.allSections().find(s => s.sectionId === obj.sectionId);
    obj.classId = sec ? sec.classId : '';
    if (obj.endTime <= obj.startTime) { toast('End time must be after start time.'); return; }
    if (existingId) { DB.update('examSchedule', existingId, obj); toast('Exam slot updated.'); }
    else { DB.add('examSchedule', obj); toast('Exam slot added.'); }
    closeModal();
    renderExamSchedTabBody();
  };
}

function openExamSlotForm() { openModal(examSlotFormHTML(null)); wireExamSlotForm(null); }
function editExamSlot(id) { openModal(examSlotFormHTML(DB.find('examSchedule', id))); wireExamSlotForm(id); }
function deleteExamSlot(id) {
  confirmAction('Remove this exam slot from the timetable?', () => {
    DB.remove('examSchedule', id);
    toast('Exam slot removed.');
    renderExamSchedTabBody();
  });
}

/* ------------------------------ Seating Chart ------------------------------ */

function examSeatingHTML() {
  const isAdmin = Auth.is('admin');
  const sections = scopedSectionsForExamSched();
  if (!sections.find(s => s.sectionId === ExamSchedUI.seatSectionId)) ExamSchedUI.seatSectionId = sections[0]?.sectionId || '';
  if (!ExamSchedUI.seatExamId) ExamSchedUI.seatExamId = DB.data.exams[0]?.id || '';

  const chart = DB.data.examSeating.find(c => c.examId === ExamSchedUI.seatExamId && c.sectionId === ExamSchedUI.seatSectionId);

  const controls = `
    <div class="flex flex-wrap items-end gap-3 no-print">
      <div><label class="form-label">Exam</label><select id="seatExamSelect" class="form-select">${DB.data.exams.map(e => `<option value="${e.id}" ${e.id===ExamSchedUI.seatExamId?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>
      <div><label class="form-label">Class - Section</label><select id="seatSectionSelect" class="form-select">${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===ExamSchedUI.seatSectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}</select></div>
      ${isAdmin ? `
        <div><label class="form-label">Room</label><input id="seatRoomInput" value="${esc(ExamSchedUI.seatRoom)}" class="form-input !w-32"/></div>
        <div><label class="form-label">Seats per row</label><input id="seatColsInput" type="number" min="1" max="12" value="${ExamSchedUI.seatCols}" class="form-input !w-24"/></div>
        <button class="btn btn-primary" onclick="generateExamSeating()">${chart ? '🔀 Regenerate' : '✓ Generate Chart'}</button>
      ` : ''}
      ${chart ? '<button class="btn btn-secondary" onclick="window.print()">🖨️ Print</button>' : ''}
    </div>
  `;

  if (!chart) {
    return controls + `<div class="card"><div class="empty-state"><div class="empty-icon">🪑</div><div class="empty-title">No seating chart yet</div><div class="empty-hint">${isAdmin ? 'Choose an exam and section above, then generate one.' : 'Ask an admin to generate one for this exam/section.'}</div></div></div>`;
  }

  const cols = chart.seatsPerRow || 5;
  const seats = chart.seatMap.map((seat, i) => {
    const stu = DB.find('students', seat.studentId);
    return `
      <div class="border border-slate-200 rounded-lg p-2 text-center">
        <div class="text-[10px] text-slate-400">Seat ${seat.seatNo}</div>
        <div class="text-xs font-semibold truncate">${stu ? esc(stu.firstName + ' ' + stu.lastName) : '—'}</div>
        <div class="text-[10px] text-slate-400">${stu ? esc(stu.admissionNo) : ''}</div>
      </div>
    `;
  }).join('');

  return controls + `
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="font-semibold text-sm">${esc(DB.data.exams.find(e=>e.id===chart.examId)?.name || '')} — ${DB.classSectionLabel(chart.classId, chart.sectionId)}</div>
        <div class="text-xs text-slate-400">Room: ${esc(chart.room) || '—'} · ${chart.seatMap.length} seat(s)</div>
      </div>
      <div class="grid gap-2" style="grid-template-columns: repeat(${cols}, minmax(0,1fr));">${seats}</div>
    </div>
  `;
}

function generateExamSeating() {
  const sec = scopedSectionsForExamSched().find(s => s.sectionId === ExamSchedUI.seatSectionId);
  const students = DB.studentsInSection(ExamSchedUI.seatSectionId).slice().sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
  if (!students.length) { toast('No students in this section to seat.'); return; }
  const seatMap = students.map((s, i) => ({ studentId: s.id, seatNo: i + 1 }));
  const existing = DB.data.examSeating.find(c => c.examId === ExamSchedUI.seatExamId && c.sectionId === ExamSchedUI.seatSectionId);
  const payload = {
    examId: ExamSchedUI.seatExamId, sectionId: ExamSchedUI.seatSectionId, classId: sec ? sec.classId : '',
    room: ExamSchedUI.seatRoom, seatsPerRow: ExamSchedUI.seatCols, seatMap,
  };
  if (existing) DB.update('examSeating', existing.id, payload);
  else DB.add('examSeating', payload);
  toast('Seating chart generated.');
  renderExamSchedTabBody();
}

function wireExamSchedControls() {
  const examSel = document.getElementById('examFilterSelect');
  if (examSel) examSel.onchange = (e) => { ExamSchedUI.examId = e.target.value; renderExamSchedTabBody(); };

  const seatExamSel = document.getElementById('seatExamSelect');
  if (seatExamSel) seatExamSel.onchange = (e) => { ExamSchedUI.seatExamId = e.target.value; renderExamSchedTabBody(); };
  const seatSecSel = document.getElementById('seatSectionSelect');
  if (seatSecSel) seatSecSel.onchange = (e) => { ExamSchedUI.seatSectionId = e.target.value; renderExamSchedTabBody(); };
  const seatRoomInput = document.getElementById('seatRoomInput');
  if (seatRoomInput) seatRoomInput.oninput = (e) => { ExamSchedUI.seatRoom = e.target.value; };
  const seatColsInput = document.getElementById('seatColsInput');
  if (seatColsInput) seatColsInput.oninput = (e) => { ExamSchedUI.seatCols = Number(e.target.value) || 5; };
}
