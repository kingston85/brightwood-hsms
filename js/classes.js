/* ==========================================================================
   Brightwood HSMS — Classes, Sections & Timetable module
   ========================================================================== */

const ClassesUI = { tab: 'structure', sectionId: null };

function defaultScopedSectionId() {
  if (Auth.is('student')) {
    const stu = Auth.linkedRecord();
    return stu ? stu.sectionId : null;
  }
  if (Auth.is('teacher')) {
    const secs = Auth.teacherSections(Auth.currentUser.linkedId);
    return secs[0] || null;
  }
  return DB.allSections()[0]?.sectionId || null;
}

function renderClasses() {
  if (!ClassesUI.sectionId) ClassesUI.sectionId = defaultScopedSectionId();
  const isAdmin = Auth.is('admin');

  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      ${isAdmin ? `<button class="tab-btn ${ClassesUI.tab==='structure'?'active':''}" onclick="setClassesTab('structure')">Classes &amp; Sections</button>` : ''}
      <button class="tab-btn ${ClassesUI.tab==='timetable'?'active':''}" onclick="setClassesTab('timetable')">Timetable</button>
    </div>
    <div id="classesTabBody"></div>
  `;
  if (!isAdmin) ClassesUI.tab = 'timetable';
  renderClassesTabBody();
}

function setClassesTab(tab) { ClassesUI.tab = tab; renderClasses(); }

function renderClassesTabBody() {
  const body = document.getElementById('classesTabBody');
  body.innerHTML = ClassesUI.tab === 'structure' ? structureHTML() : timetableHTML();
  if (ClassesUI.tab === 'timetable') wireTimetableControls();
}

/* ------------------------------ Structure tab ------------------------------ */

function structureHTML() {
  const cards = DB.data.classes.map(c => `
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">${esc(c.name)}</h3>
        <div class="space-x-1">
          <button class="btn btn-secondary btn-sm" onclick="addSection('${c.id}')">+ Section</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass('${c.id}')">Delete</button>
        </div>
      </div>
      <div class="space-y-2">
        ${c.sections.map(s => `
          <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <div>
              <span class="font-semibold">Section ${esc(s.name)}</span>
              <span class="text-xs text-slate-400 ml-2">${DB.studentsInSection(s.id).length} students</span>
              <div class="text-xs text-slate-500">Class Teacher: ${s.classTeacherId ? DB.teacherName(s.classTeacherId) : '<span class="text-amber-600">Unassigned</span>'}</div>
            </div>
            <div class="space-x-1">
              <button class="btn btn-secondary btn-sm" onclick="editSection('${c.id}','${s.id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="openPromoteForm('${c.id}','${s.id}')">Promote</button>
              <button class="btn btn-danger btn-sm" onclick="deleteSection('${c.id}','${s.id}')">Remove</button>
            </div>
          </div>
        `).join('') || '<p class="text-sm text-slate-400">No sections yet.</p>'}
      </div>
    </div>
  `).join('');

  return `
    <div class="flex justify-end"><button class="btn btn-primary" onclick="addClass()">+ Add Class / Grade Level</button></div>
    <div class="grid md:grid-cols-2 gap-4">${cards}</div>
  `;
}

function addClass() {
  openModal(`
    <form id="classForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Class / Grade Level</h3>
      <div><label class="form-label">Name</label><input required name="name" placeholder="e.g. Grade 11" class="form-input"/></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add</button></div>
    </form>
  `);
  document.getElementById('classForm').onsubmit = (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    DB.data.classes.push({ id: uid('cls'), name, sections: [] });
    DB.save();
    closeModal(); toast('Class added.'); renderClasses();
  };
}

function deleteClass(classId) {
  const hasStudents = DB.studentsInClass(classId).length > 0;
  confirmAction(hasStudents ? 'This class has enrolled students. Delete anyway? Students will keep an orphaned class reference — reassign them first if possible.' : 'Delete this class and all its sections?', () => {
    DB.data.classes = DB.data.classes.filter(c => c.id !== classId);
    DB.save(); toast('Class deleted.'); renderClasses();
  });
}

function addSection(classId) {
  openModal(`
    <form id="sectionForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Section</h3>
      <div><label class="form-label">Section Name</label><input required name="name" placeholder="e.g. C" class="form-input"/></div>
      <div><label class="form-label">Class Teacher</label><select name="classTeacherId" class="form-select"><option value="">— Unassigned —</option>${teacherOptions('')}</select></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add Section</button></div>
    </form>
  `);
  document.getElementById('sectionForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const c = DB.data.classes.find(c => c.id === classId);
    c.sections.push({ id: uid('sec'), name: fd.name, classTeacherId: fd.classTeacherId || '' });
    DB.save(); closeModal(); toast('Section added.'); renderClasses();
  };
}

function editSection(classId, sectionId) {
  const c = DB.data.classes.find(c => c.id === classId);
  const s = c.sections.find(s => s.id === sectionId);
  openModal(`
    <form id="sectionForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Edit Section</h3>
      <div><label class="form-label">Section Name</label><input required name="name" value="${esc(s.name)}" class="form-input"/></div>
      <div><label class="form-label">Class Teacher</label><select name="classTeacherId" class="form-select"><option value="">— Unassigned —</option>${teacherOptions(s.classTeacherId)}</select></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>
  `);
  document.getElementById('sectionForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    s.name = fd.name; s.classTeacherId = fd.classTeacherId || '';
    DB.save(); closeModal(); toast('Section updated.'); renderClasses();
  };
}

function deleteSection(classId, sectionId) {
  const count = DB.studentsInSection(sectionId).length;
  confirmAction(count ? `This section has ${count} student(s) enrolled. Delete anyway?` : 'Remove this section?', () => {
    const c = DB.data.classes.find(c => c.id === classId);
    c.sections = c.sections.filter(s => s.id !== sectionId);
    DB.data.timetable = DB.data.timetable.filter(t => t.sectionId !== sectionId);
    DB.save(); toast('Section removed.'); renderClasses();
  });
}

/* ------------------------------ Promotion ------------------------------ */

function openPromoteForm(fromClassId, fromSectionId) {
  const fromClass = DB.data.classes.find(c => c.id === fromClassId);
  const fromSection = fromClass?.sections.find(s => s.id === fromSectionId);
  const count = DB.studentsInSection(fromSectionId).length;
  openModal(`
    <form id="promoteForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Promote ${esc(fromClass?.name)} - ${esc(fromSection?.name)}</h3>
      <p class="text-sm text-slate-500">This will move all <strong>${count}</strong> student(s) currently in this section. Their attendance, grade and fee history stays intact.</p>
      <div>
        <label class="form-label">Action</label>
        <select name="action" id="promoteAction" class="form-select">
          <option value="move">Move to another class/section</option>
          <option value="graduate">Graduate (mark as alumni, remove from active roster)</option>
        </select>
      </div>
      <div id="promoteTargetWrap" class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Target Class</label><select name="toClassId" id="promoteClassSelect" class="form-select">${classOptions(fromClassId)}</select></div>
        <div><label class="form-label">Target Section</label><select name="toSectionId" id="promoteSectionSelect" class="form-select">${sectionOptions(fromClassId, '')}</select></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Promote ${count} Student(s)</button></div>
    </form>
  `);
  document.getElementById('promoteClassSelect').onchange = (e) => {
    document.getElementById('promoteSectionSelect').innerHTML = sectionOptions(e.target.value, '');
  };
  document.getElementById('promoteAction').onchange = (e) => {
    document.getElementById('promoteTargetWrap').classList.toggle('hidden', e.target.value === 'graduate');
  };
  document.getElementById('promoteForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const students = DB.studentsInSection(fromSectionId);
    if (fd.action === 'graduate') {
      students.forEach(s => { s.status = 'Graduated'; });
    } else {
      if (!fd.toSectionId) { toast('Please choose a target section.'); return; }
      students.forEach(s => { s.classId = fd.toClassId; s.sectionId = fd.toSectionId; });
    }
    DB.save();
    closeModal();
    toast(fd.action === 'graduate' ? 'Students graduated.' : 'Students promoted.');
    renderClasses();
  };
}

/* ------------------------------ Timetable tab ------------------------------ */

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
const PERIODS = [1,2,3,4,5];

function timetableHTML() {
  let sections = DB.allSections();
  if (Auth.is('teacher')) {
    const allowed = Auth.teacherSections(Auth.currentUser.linkedId);
    sections = sections.filter(s => allowed.includes(s.sectionId));
  } else if (Auth.is('student')) {
    const stu = Auth.linkedRecord();
    sections = sections.filter(s => stu && s.sectionId === stu.sectionId);
  }
  if (!sections.find(s => s.sectionId === ClassesUI.sectionId)) ClassesUI.sectionId = sections[0]?.sectionId || null;

  const rows = PERIODS.map(p => {
    const cells = DAYS.map(day => {
      const entry = DB.data.timetable.find(t => t.sectionId === ClassesUI.sectionId && t.day === day && t.period === p);
      if (!entry) return `<td class="text-center text-slate-300 py-3">
        ${Auth.is('admin') ? `<button class="text-xs text-brand-600 hover:underline no-print" onclick="editTimetableCell('${day}',${p})">+ assign</button>` : '—'}
      </td>`;
      return `<td class="py-2 px-2 text-center">
        <div class="font-semibold text-sm">${DB.subjectName(entry.subjectId)}</div>
        <div class="text-xs text-slate-400">${DB.teacherName(entry.teacherId)}</div>
        ${Auth.is('admin') ? `<button class="text-[11px] text-brand-600 hover:underline no-print" onclick="editTimetableCell('${day}',${p})">edit</button>` : ''}
      </td>`;
    }).join('');
    const time = DB.data.timetable.find(t => t.period === p)?.time || '';
    return `<tr><td class="font-semibold bg-slate-50 text-center">P${p}<div class="text-[10px] text-slate-400 font-normal">${time}</div></td>${cells}</tr>`;
  }).join('');

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <select id="ttSectionSelect" class="form-select !w-56">
        ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===ClassesUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
      </select>
      <button class="btn btn-secondary no-print" onclick="window.print()">🖨️ Print Timetable</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Period</th>${DAYS.map(d=>`<th class="text-center">${d}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function wireTimetableControls() {
  const sel = document.getElementById('ttSectionSelect');
  if (sel) sel.onchange = (e) => { ClassesUI.sectionId = e.target.value; renderClassesTabBody(); };
}

function editTimetableCell(day, period) {
  const entry = DB.data.timetable.find(t => t.sectionId === ClassesUI.sectionId && t.day === day && t.period === period);
  openModal(`
    <form id="ttForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">${day} &middot; Period ${period}</h3>
      <div><label class="form-label">Subject</label><select name="subjectId" class="form-select">${subjectOptions(entry?.subjectId)}</select></div>
      <div><label class="form-label">Teacher</label><select name="teacherId" class="form-select">${teacherOptions(entry?.teacherId)}</select></div>
      <div><label class="form-label">Time</label><input name="time" value="${esc(entry?.time || `${7+period}:00 - ${7+period}:45`)}" class="form-input"/></div>
      <div class="flex justify-between gap-2 pt-2">
        ${entry ? `<button type="button" class="btn btn-danger" onclick="removeTimetableCell('${entry.id}')">Clear Slot</button>` : '<span></span>'}
        <div class="space-x-2">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary">Save</button>
        </div>
      </div>
    </form>
  `);
  document.getElementById('ttForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (entry) {
      DB.update('timetable', entry.id, fd);
    } else {
      DB.add('timetable', { sectionId: ClassesUI.sectionId, classId: DB.allSections().find(s=>s.sectionId===ClassesUI.sectionId)?.classId, day, period, ...fd });
    }
    closeModal(); toast('Timetable updated.'); renderClassesTabBody();
  };
}
function removeTimetableCell(id) {
  DB.remove('timetable', id);
  closeModal(); toast('Slot cleared.'); renderClassesTabBody();
}
