/* ==========================================================================
   Brightwood HSMS — Gradebook & Report Cards module
   ========================================================================== */

const GradesUI = { tab: 'entry', examId: null, sectionId: null, subjectId: null, reportStudentId: null };

function renderGrades() {
  if (!GradesUI.examId) GradesUI.examId = DB.data.exams[0]?.id;
  if (!GradesUI.sectionId) GradesUI.sectionId = defaultScopedSectionId();
  if (!GradesUI.subjectId) GradesUI.subjectId = DB.data.subjects[0]?.id;

  const canEnter = Auth.is('admin') || Auth.is('teacher');
  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      ${canEnter ? `<button class="tab-btn ${GradesUI.tab==='entry'?'active':''}" onclick="setGradesTab('entry')">Enter Grades</button>` : ''}
      <button class="tab-btn ${GradesUI.tab==='report'?'active':''}" onclick="setGradesTab('report')">Report Cards</button>
      ${canEnter ? `<button class="tab-btn ${GradesUI.tab==='exams'?'active':''}" onclick="setGradesTab('exams')">Exams</button>` : ''}
    </div>
    <div id="gradesTabBody"></div>
  `;
  if (!canEnter) GradesUI.tab = 'report';
  renderGradesTabBody();
}

function setGradesTab(tab) { GradesUI.tab = tab; renderGrades(); }

function renderGradesTabBody() {
  const body = document.getElementById('gradesTabBody');
  if (GradesUI.tab === 'entry') body.innerHTML = gradeEntryHTML();
  else if (GradesUI.tab === 'exams') body.innerHTML = examsAdminHTML();
  else body.innerHTML = reportCardHTML();
  wireGradesControls();
}

/* ------------------------------ Grade entry ------------------------------ */

function gradeEntryHTML() {
  const sections = scopedSectionsForAttendance();
  if (!sections.find(s => s.sectionId === GradesUI.sectionId)) GradesUI.sectionId = sections[0]?.sectionId;
  const students = GradesUI.sectionId ? DB.studentsInSection(GradesUI.sectionId) : [];

  const rows = students.map(s => {
    const rec = DB.data.grades.find(g => g.examId === GradesUI.examId && g.studentId === s.id && g.subjectId === GradesUI.subjectId);
    return `<tr>
      <td>${esc(s.firstName)} ${esc(s.lastName)}</td>
      <td><input type="number" min="0" max="${rec?.maxScore||100}" class="form-input !w-24 grade-input" data-student="${s.id}" value="${rec ? rec.score : ''}" placeholder="—"/></td>
      <td class="text-slate-400 text-xs">/ ${rec?.maxScore || 100}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="3" class="text-center text-slate-400 py-10">No students in this section.</td></tr>`;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div class="flex flex-wrap gap-2">
        <select id="gExamSelect" class="form-select !w-48">${DB.data.exams.map(e=>`<option value="${e.id}" ${e.id===GradesUI.examId?'selected':''}>${esc(e.name)} (${esc(e.term)})</option>`).join('')}</select>
        <select id="gSectionSelect" class="form-select !w-52">${sections.map(s=>`<option value="${s.sectionId}" ${s.sectionId===GradesUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}</select>
        <select id="gSubjectSelect" class="form-select !w-44">${subjectOptions(GradesUI.subjectId)}</select>
      </div>
      <button class="btn btn-primary" onclick="saveGrades()">Save Grades</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Score</th><th></th></tr></thead><tbody id="gradeRows">${rows}</tbody></table>
    </div>
  `;
}

function saveGrades() {
  document.querySelectorAll('.grade-input').forEach(input => {
    const studentId = input.dataset.student;
    const val = input.value;
    if (val === '') return;
    const score = Math.max(0, Math.min(100, Number(val)));
    const existing = DB.data.grades.find(g => g.examId === GradesUI.examId && g.studentId === studentId && g.subjectId === GradesUI.subjectId);
    if (existing) existing.score = score;
    else {
      const stu = DB.find('students', studentId);
      // sectionId/classId are denormalized here so Firestore Security Rules
      // can scope a teacher's write access without an extra lookup.
      DB.data.grades.push({ id: uid('grd'), examId: GradesUI.examId, studentId, subjectId: GradesUI.subjectId, sectionId: stu?.sectionId, classId: stu?.classId, score, maxScore: 100 });
    }
  });
  DB.save();
  toast('Grades saved.');
}

function wireGradesControls() {
  const ex = document.getElementById('gExamSelect');
  const sec = document.getElementById('gSectionSelect');
  const sub = document.getElementById('gSubjectSelect');
  if (ex) ex.onchange = (e) => { GradesUI.examId = e.target.value; renderGradesTabBody(); };
  if (sec) sec.onchange = (e) => { GradesUI.sectionId = e.target.value; renderGradesTabBody(); };
  if (sub) sub.onchange = (e) => { GradesUI.subjectId = e.target.value; renderGradesTabBody(); };

  const rEx = document.getElementById('rExamSelect');
  const rStu = document.getElementById('rStudentSelect');
  if (rEx) rEx.onchange = (e) => { GradesUI.examId = e.target.value; renderGradesTabBody(); };
  if (rStu) rStu.onchange = (e) => { GradesUI.reportStudentId = e.target.value; renderGradesTabBody(); };
}

/* ------------------------------ Exams admin ------------------------------ */

function examsAdminHTML() {
  const rows = DB.data.exams.map(e => `
    <tr><td>${esc(e.name)}</td><td>${esc(e.term)}</td><td>${esc(e.year)}</td>
    <td class="text-right no-print"><button class="btn btn-danger btn-sm" onclick="deleteExam('${e.id}')">Delete</button></td></tr>
  `).join('');
  return `
    <div class="flex justify-end"><button class="btn btn-primary" onclick="addExam()">+ Add Exam</button></div>
    <div class="card overflow-x-auto"><table class="data-table"><thead><tr><th>Exam Name</th><th>Term</th><th>Year</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}
function addExam() {
  openModal(`
    <form id="examForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Exam</h3>
      <div><label class="form-label">Name</label><input required name="name" placeholder="e.g. Quiz 1" class="form-input"/></div>
      <div><label class="form-label">Term</label><input required name="term" value="${esc(DB.data.meta.currentTerm)}" class="form-input"/></div>
      <div><label class="form-label">Year</label><input required name="year" value="${esc(DB.data.meta.currentYear)}" class="form-input"/></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add</button></div>
    </form>
  `);
  document.getElementById('examForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    DB.add('exams', fd);
    closeModal(); toast('Exam added.'); renderGradesTabBody();
  };
}
function deleteExam(id) {
  confirmAction('Delete this exam and all associated grade entries?', () => {
    DB.remove('exams', id);
    DB.data.grades = DB.data.grades.filter(g => g.examId !== id);
    DB.save(); toast('Exam deleted.'); renderGradesTabBody();
  });
}

/* ------------------------------ Report card ------------------------------ */

function reportCardHTML() {
  let studentId = GradesUI.reportStudentId;
  let studentPicker = '';
  if (Auth.is('student')) {
    studentId = Auth.linkedRecord()?.id;
  } else {
    const scoped = scopedStudents();
    if (!studentId || !scoped.find(s => s.id === studentId)) studentId = scoped[0]?.id;
    GradesUI.reportStudentId = studentId;
    studentPicker = `<select id="rStudentSelect" class="form-select !w-56">${scoped.map(s=>`<option value="${s.id}" ${s.id===studentId?'selected':''}>${esc(s.firstName)} ${esc(s.lastName)}</option>`).join('')}</select>`;
  }
  if (!studentId) return '<p class="text-slate-400">No student selected.</p>';
  const stu = DB.find('students', studentId);
  if (!stu) return '<p class="text-slate-400">Student not found.</p>';

  const subjectRows = DB.data.subjects.map(sub => {
    const rec = DB.data.grades.find(g => g.examId === GradesUI.examId && g.studentId === studentId && g.subjectId === sub.id);
    const pct = rec ? Math.round((rec.score / rec.maxScore) * 100) : null;
    return `<tr><td>${esc(sub.name)}</td><td class="text-center">${rec ? rec.score + '/' + rec.maxScore : '—'}</td><td class="text-center">${pct ?? '—'}${pct!==null?'%':''}</td><td class="text-center font-semibold">${DB.gradeLetter(pct)}</td></tr>`;
  }).join('');

  const avg = DB.studentAverage(studentId, GradesUI.examId);
  const exam = DB.find('exams', GradesUI.examId);
  const rate = DB.attendanceRateFor(studentId);

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between no-print">
      <div class="flex flex-wrap gap-2">
        <select id="rExamSelect" class="form-select !w-52">${DB.data.exams.map(e=>`<option value="${e.id}" ${e.id===GradesUI.examId?'selected':''}>${esc(e.name)} (${esc(e.term)})</option>`).join('')}</select>
        ${studentPicker}
      </div>
      <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Report Card</button>
    </div>

    <div class="card p-8 max-w-2xl mx-auto" id="reportCardPrintArea">
      <div class="text-center mb-6">
        <h2 class="font-extrabold text-xl">${esc(DB.data.meta.schoolName)}</h2>
        <p class="text-xs text-slate-400">${esc(DB.data.meta.address)}</p>
        <p class="text-sm font-semibold mt-2">Student Report Card &mdash; ${esc(exam?.name || '')} (${esc(exam?.term || '')} ${esc(exam?.year || '')})</p>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm mb-6 border-y border-slate-200 py-3">
        <div><span class="text-slate-400">Name:</span> <strong>${esc(stu.firstName)} ${esc(stu.lastName)}</strong></div>
        <div><span class="text-slate-400">Admission No:</span> ${esc(stu.admissionNo)}</div>
        <div><span class="text-slate-400">Class:</span> ${DB.classSectionLabel(stu.classId, stu.sectionId)}</div>
        <div><span class="text-slate-400">Attendance:</span> ${rate ?? '—'}${rate!==null?'%':''}</div>
      </div>
      <table class="data-table mb-6">
        <thead><tr><th>Subject</th><th class="text-center">Score</th><th class="text-center">%</th><th class="text-center">Grade</th></tr></thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-3">
        <span class="font-semibold">Overall Average</span>
        <span class="font-extrabold text-lg text-brand-600">${avg ?? '—'}${avg!==null?'%':''} &nbsp; (${DB.gradeLetter(avg)})</span>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-8 text-sm text-center">
        <div class="border-t border-slate-300 pt-2">Class Teacher Signature</div>
        <div class="border-t border-slate-300 pt-2">Principal Signature</div>
      </div>
    </div>
  `;
}
