/* ==========================================================================
   Brightwood HSMS — Teachers / Staff module (Admin only)
   ========================================================================== */

const TeachersUI = { search: '' };

function assignedSectionsLabel(teacherId) {
  const secs = DB.allSections().filter(s => s.classTeacherId === teacherId);
  if (!secs.length) return '<span class="text-slate-400">Subject teacher only</span>';
  return secs.map(s => `${s.className}-${s.sectionName}`).join(', ');
}

function renderTeachers() {
  let list = DB.data.teachers.slice();
  if (TeachersUI.search) {
    const q = TeachersUI.search.toLowerCase();
    list = list.filter(t => (`${t.firstName} ${t.lastName} ${t.staffNo}`).toLowerCase().includes(q));
  }
  list.sort((a, b) => a.firstName.localeCompare(b.firstName));

  const rows = list.map(t => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">${initialsAvatar(t.firstName+' '+t.lastName)}</div>
          <div>
            <div class="font-semibold">${esc(t.firstName)} ${esc(t.lastName)}</div>
            <div class="text-xs text-slate-400">${esc(t.staffNo)}</div>
          </div>
        </div>
      </td>
      <td>${DB.subjectName(t.subjectSpecialty)}</td>
      <td>Class Teacher: ${assignedSectionsLabel(t.id)}</td>
      <td>${esc(t.email)}<br/><span class="text-xs text-slate-400">${esc(t.phone)}</span></td>
      <td>${statusBadge(t.status)}</td>
      <td class="text-right space-x-1 no-print">
        <button class="btn btn-secondary btn-sm" onclick="editTeacher('${t.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTeacher('${t.id}')">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No teachers found.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <input id="tchSearch" value="${esc(TeachersUI.search)}" placeholder="Search teacher or staff no…" class="form-input !w-64" />
      <button class="btn btn-primary" onclick="openTeacherForm()">+ Add Teacher</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Teacher</th><th>Specialty</th><th>Assignment</th><th>Contact</th><th>Status</th><th class="text-right no-print">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400">${list.length} teacher(s)</p>
  `;
  document.getElementById('tchSearch').oninput = (e) => { TeachersUI.search = e.target.value; renderTeachers(); };
}

function teacherFormHTML(t) {
  const isNew = !t;
  t = t || { firstName:'', lastName:'', gender:'Male', email:'', phone:'', subjectSpecialty: DB.data.subjects[0]?.id, staffNo:'', hireDate: todayISO(), status:'Active' };
  return `
    <form id="teacherForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Add Teacher' : 'Edit Teacher'}</h3>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">First Name</label><input required name="firstName" value="${esc(t.firstName)}" class="form-input"/></div>
        <div><label class="form-label">Last Name</label><input required name="lastName" value="${esc(t.lastName)}" class="form-input"/></div>
        <div><label class="form-label">Gender</label>
          <select name="gender" class="form-select"><option ${t.gender==='Male'?'selected':''}>Male</option><option ${t.gender==='Female'?'selected':''}>Female</option></select>
        </div>
        <div><label class="form-label">Staff No.</label><input name="staffNo" value="${esc(t.staffNo)}" placeholder="Auto if blank" class="form-input"/></div>
        <div><label class="form-label">Subject Specialty</label><select name="subjectSpecialty" class="form-select">${subjectOptions(t.subjectSpecialty)}</select></div>
        <div><label class="form-label">Hire Date</label><input type="date" name="hireDate" value="${esc(t.hireDate)}" class="form-input"/></div>
        <div><label class="form-label">Email</label><input type="email" name="email" value="${esc(t.email)}" class="form-input"/></div>
        <div><label class="form-label">Phone</label><input name="phone" value="${esc(t.phone)}" class="form-input"/></div>
        <div><label class="form-label">Status</label>
          <select name="status" class="form-select"><option ${t.status==='Active'?'selected':''}>Active</option><option ${t.status==='Inactive'?'selected':''}>Inactive</option></select>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add Teacher' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="id" value="${t.id || ''}"/>
    </form>
  `;
}

function wireTeacherForm(existingId) {
  document.getElementById('teacherForm').onsubmit = (e) => {
    e.preventDefault();
    const obj = Object.fromEntries(new FormData(e.target).entries());
    if (!obj.staffNo) obj.staffNo = 'STF-' + Math.floor(100 + Math.random() * 900);
    if (existingId) { DB.update('teachers', existingId, obj); toast('Teacher updated.'); }
    else { DB.add('teachers', obj); toast('Teacher added.'); }
    closeModal();
    renderTeachers();
  };
}

function openTeacherForm() { openModal(teacherFormHTML(null)); wireTeacherForm(null); }
function editTeacher(id) { openModal(teacherFormHTML(DB.find('teachers', id))); wireTeacherForm(id); }
function deleteTeacher(id) {
  const inUse = DB.allSections().some(s => s.classTeacherId === id);
  confirmAction(inUse ? 'This teacher is a class teacher for a section. Removing them will leave that section without a class teacher. Continue?' : 'This will permanently remove the teacher.', () => {
    DB.remove('teachers', id);
    DB.data.classes.forEach(c => c.sections.forEach(s => { if (s.classTeacherId === id) s.classTeacherId = ''; }));
    DB.data.timetable = DB.data.timetable.filter(t => t.teacherId !== id);
    DB.save();
    toast('Teacher removed.');
    renderTeachers();
  });
}
