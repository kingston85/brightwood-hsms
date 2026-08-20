/* ==========================================================================
   Brightwood HSMS — Assignments / Homework module
   Teachers post assignments per subject/section with a due date. Students
   see what's due for their own section, with overdue items highlighted.
   ========================================================================== */

const AssignmentsUI = { sectionId: null };

function scopedSectionsForAssignments() {
  let sections = DB.allSections();
  if (Auth.is('teacher')) {
    const allowed = Auth.teacherSections(Auth.currentUser.linkedId);
    sections = sections.filter(s => allowed.includes(s.sectionId));
  }
  return sections;
}

function renderAssignments() {
  if (Auth.is('student')) { renderStudentAssignments(); return; }

  const sections = scopedSectionsForAssignments();
  if (!sections.find(s => s.sectionId === AssignmentsUI.sectionId)) AssignmentsUI.sectionId = sections[0]?.sectionId || null;
  const list = DB.data.assignments.filter(a => a.sectionId === AssignmentsUI.sectionId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const today = todayISO();

  const rows = list.map(a => `
    <tr class="${a.dueDate < today ? 'bg-red-50' : ''}">
      <td>${esc(a.title)}<div class="text-xs text-slate-400">${esc(a.description || '')}</div></td>
      <td>${DB.subjectName(a.subjectId)}</td>
      <td>${DB.teacherName(a.teacherId)}</td>
      <td class="${a.dueDate < today ? 'text-red-600 font-semibold' : ''}">${esc(a.dueDate)} ${a.dueDate < today ? badge('Overdue', 'red') : ''}</td>
      <td class="text-right no-print space-x-1">
        <button class="btn btn-secondary btn-sm" onclick="editAssignment('${a.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-10">No assignments for this section yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <select id="asgSectionSelect" class="form-select !w-56">
        ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===AssignmentsUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
      </select>
      <button class="btn btn-primary no-print" onclick="openAssignmentForm()">+ New Assignment</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Assignment</th><th>Subject</th><th>Teacher</th><th>Due Date</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
  const sel = document.getElementById('asgSectionSelect');
  if (sel) sel.onchange = (e) => { AssignmentsUI.sectionId = e.target.value; renderAssignments(); };
}

function assignmentFormHTML(a) {
  const isNew = !a;
  a = a || { title: '', description: '', subjectId: DB.data.subjects[0]?.id, dueDate: todayISO() };
  return `
    <form id="asgForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">${isNew ? 'New Assignment' : 'Edit Assignment'}</h3>
      <div><label class="form-label">Title</label><input required name="title" value="${esc(a.title)}" class="form-input" placeholder="e.g. Algebra Worksheet 3"/></div>
      <div><label class="form-label">Instructions</label><textarea name="description" rows="3" class="form-textarea">${esc(a.description)}</textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Subject</label><select name="subjectId" class="form-select">${subjectOptions(a.subjectId)}</select></div>
        <div><label class="form-label">Due Date</label><input required type="date" name="dueDate" value="${esc(a.dueDate)}" class="form-input"/></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">${isNew ? 'Post Assignment' : 'Save Changes'}</button></div>
    </form>
  `;
}

function openAssignmentForm() {
  openModal(assignmentFormHTML(null));
  document.getElementById('asgForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const sec = DB.allSections().find(s => s.sectionId === AssignmentsUI.sectionId);
    DB.add('assignments', {
      ...fd, sectionId: AssignmentsUI.sectionId, classId: sec?.classId,
      teacherId: Auth.is('teacher') ? Auth.currentUser.linkedId : (sec?.classTeacherId || ''),
      createdAt: todayISO(),
    });
    closeModal(); toast('Assignment posted.'); renderAssignments();
  };
}

function editAssignment(id) {
  const a = DB.find('assignments', id);
  openModal(assignmentFormHTML(a));
  document.getElementById('asgForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    DB.update('assignments', id, fd);
    closeModal(); toast('Assignment updated.'); renderAssignments();
  };
}

function deleteAssignment(id) {
  confirmAction('Delete this assignment?', () => { DB.remove('assignments', id); toast('Assignment deleted.'); renderAssignments(); });
}

/* ------------------------------ Student view ------------------------------ */

function renderStudentAssignments() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = `<p class="text-slate-400">No linked student record.</p>`; return; }
  const today = todayISO();
  const list = DB.data.assignments.filter(a => a.sectionId === stu.sectionId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const rows = list.map(a => {
    const overdue = a.dueDate < today;
    const soon = !overdue && a.dueDate <= addDaysISO(today, 3);
    return `
    <tr class="${overdue ? 'bg-red-50' : ''}">
      <td class="font-semibold">${esc(a.title)}<div class="text-xs text-slate-400 font-normal">${esc(a.description || '')}</div></td>
      <td>${DB.subjectName(a.subjectId)}</td>
      <td>${DB.teacherName(a.teacherId)}</td>
      <td>${esc(a.dueDate)} ${overdue ? badge('Overdue', 'red') : soon ? badge('Due Soon', 'amber') : ''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" class="text-center text-slate-400 py-10">No assignments yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Assignment</th><th>Subject</th><th>Teacher</th><th>Due Date</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
