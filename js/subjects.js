/* ==========================================================================
   Brightwood HSMS — Subjects module (Admin only)
   Manages the master list of subjects taught at the school. Every other
   module (teacher specialties, timetable, gradebook, assignments) picks a
   subject from this list via subjectOptions() in ui.js — previously this
   list was fixed in the seed data with no way to add to it.
   ========================================================================== */

const SubjectsUI = { search: '' };

// How many other records currently reference a subject — shown in the table
// and used to warn (not block) before deleting one that's in use.
function subjectUsageCount(subjectId) {
  const teachers = DB.data.teachers.filter(t => t.subjectSpecialty === subjectId).length;
  const timetable = DB.data.timetable.filter(t => t.subjectId === subjectId).length;
  const grades = DB.data.grades.filter(g => g.subjectId === subjectId).length;
  const assignments = (DB.data.assignments || []).filter(a => a.subjectId === subjectId).length;
  return { teachers, timetable, grades, assignments, total: teachers + timetable + grades + assignments };
}

function renderSubjects() {
  let list = DB.data.subjects.slice();
  if (SubjectsUI.search) {
    const q = SubjectsUI.search.toLowerCase();
    list = list.filter(s => (`${s.name} ${s.code}`).toLowerCase().includes(q));
  }
  list.sort((a, b) => a.name.localeCompare(b.name));

  const rows = list.map(s => {
    const usage = subjectUsageCount(s.id);
    return `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${esc((s.code || s.name || '?').slice(0, 2).toUpperCase())}</div>
          <div class="font-semibold">${esc(s.name)}</div>
        </div>
      </td>
      <td><span class="badge badge-slate">${esc(s.code) || '—'}</span></td>
      <td class="text-xs text-slate-500">
        ${usage.total ? `${usage.teachers} teacher(s), ${usage.timetable} timetable slot(s), ${usage.grades} grade record(s), ${usage.assignments} assignment(s)` : '<span class="text-slate-400">Not used yet</span>'}
      </td>
      <td class="text-right space-x-1 no-print">
        <button class="btn btn-secondary btn-sm" onclick="editSubject('${s.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSubject('${s.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📘</div><div class="empty-title">No subjects found</div><div class="empty-hint">Try a different search, or add a new subject.</div></div></td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <input id="subjSearch" value="${esc(SubjectsUI.search)}" placeholder="Search subject or code…" class="form-input !w-64" />
      <button class="btn btn-primary" onclick="openSubjectForm()">+ Add Subject</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Subject</th><th>Code</th><th>Used by</th><th class="text-right no-print">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400">${list.length} subject(s)</p>
  `;
  document.getElementById('subjSearch').oninput = (e) => { SubjectsUI.search = e.target.value; renderSubjects(); };
}

function subjectFormHTML(s) {
  const isNew = !s;
  s = s || { name: '', code: '' };
  return `
    <form id="subjectForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Add Subject' : 'Edit Subject'}</h3>
      <div><label class="form-label">Subject Name</label><input required name="name" value="${esc(s.name)}" placeholder="e.g. Physical Education" class="form-input"/></div>
      <div><label class="form-label">Short Code</label><input required name="code" value="${esc(s.code)}" placeholder="e.g. PE" maxlength="8" class="form-input" style="text-transform:uppercase"/></div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add Subject' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="id" value="${s.id || ''}"/>
    </form>
  `;
}

function wireSubjectForm(existingId) {
  document.getElementById('subjectForm').onsubmit = (e) => {
    e.preventDefault();
    const obj = Object.fromEntries(new FormData(e.target).entries());
    obj.code = (obj.code || '').toUpperCase().trim();
    obj.name = (obj.name || '').trim();
    const dupe = DB.data.subjects.find(s => s.code === obj.code && s.id !== existingId);
    if (dupe) { toast(`Code "${obj.code}" is already used by ${dupe.name}.`); return; }
    if (existingId) { DB.update('subjects', existingId, obj); toast('Subject updated.'); }
    else { DB.add('subjects', obj); toast('Subject added.'); }
    closeModal();
    renderSubjects();
  };
}

function openSubjectForm() { openModal(subjectFormHTML(null)); wireSubjectForm(null); }
function editSubject(id) { openModal(subjectFormHTML(DB.find('subjects', id))); wireSubjectForm(id); }
function deleteSubject(id) {
  const usage = subjectUsageCount(id);
  const msg = usage.total
    ? `This subject is used in ${usage.total} existing record(s) (teacher specialties, timetable slots, grades, or assignments). Those records will keep showing the subject as blank/unknown rather than being deleted. Continue?`
    : 'This will permanently remove the subject.';
  confirmAction(msg, () => {
    DB.remove('subjects', id);
    toast('Subject removed.');
    renderSubjects();
  });
}
