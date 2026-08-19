/* ==========================================================================
   Brightwood HSMS — Students module
   ========================================================================== */

const StudentsUI = { search: '', classId: '', sectionId: '' };

function scopedStudents() {
  let list = DB.data.students.slice();
  if (Auth.is('teacher')) {
    const secIds = Auth.teacherSections(Auth.currentUser.linkedId);
    list = list.filter(s => secIds.includes(s.sectionId));
  }
  if (StudentsUI.classId) list = list.filter(s => s.classId === StudentsUI.classId);
  if (StudentsUI.sectionId) list = list.filter(s => s.sectionId === StudentsUI.sectionId);
  if (StudentsUI.search) {
    const q = StudentsUI.search.toLowerCase();
    list = list.filter(s => (`${s.firstName} ${s.lastName} ${s.admissionNo}`).toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.firstName.localeCompare(b.firstName));
}

function renderStudents() {
  const canEdit = Auth.is('admin') || Auth.is('teacher');
  const canDelete = Auth.is('admin');
  const list = scopedStudents();

  const rows = list.map(s => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">${initialsAvatar(s.firstName + ' ' + s.lastName)}</div>
          <div>
            <div class="font-semibold text-ink-900">${esc(s.firstName)} ${esc(s.lastName)}</div>
            <div class="text-xs text-slate-400">${esc(s.admissionNo)}</div>
          </div>
        </div>
      </td>
      <td>${DB.classSectionLabel(s.classId, s.sectionId)}</td>
      <td>${esc(s.gender)}</td>
      <td>${esc(s.guardianName)}<br/><span class="text-xs text-slate-400">${esc(s.guardianPhone)}</span></td>
      <td>${statusBadge(s.status)}</td>
      <td class="text-right space-x-1 no-print">
        <button class="btn btn-secondary btn-sm" onclick="viewStudent('${s.id}')">View</button>
        ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="editStudent('${s.id}')">Edit</button>` : ''}
        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">Delete</button>` : ''}
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No students found.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <input id="stuSearch" value="${esc(StudentsUI.search)}" placeholder="Search name or admission no…" class="form-input !w-64" />
        <select id="stuClassFilter" class="form-select !w-40">
          <option value="">All Classes</option>
          ${classOptions(StudentsUI.classId)}
        </select>
        <select id="stuSectionFilter" class="form-select !w-32">
          <option value="">All Sections</option>
          ${StudentsUI.classId ? sectionOptions(StudentsUI.classId, StudentsUI.sectionId) : ''}
        </select>
      </div>
      ${Auth.is('admin') ? `<button class="btn btn-primary" onclick="openStudentForm()">+ Add Student</button>` : ''}
    </div>

    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Student</th><th>Class</th><th>Gender</th><th>Guardian</th><th>Status</th><th class="text-right no-print">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400">${list.length} student(s)</p>
  `;

  document.getElementById('stuSearch').oninput = (e) => { StudentsUI.search = e.target.value; renderStudents(); };
  document.getElementById('stuClassFilter').value = StudentsUI.classId;
  document.getElementById('stuClassFilter').onchange = (e) => { StudentsUI.classId = e.target.value; StudentsUI.sectionId=''; renderStudents(); };
  document.getElementById('stuSectionFilter').onchange = (e) => { StudentsUI.sectionId = e.target.value; renderStudents(); };
}

function studentFormHTML(s) {
  const isNew = !s;
  s = s || { firstName:'', lastName:'', gender:'Male', dob:'', classId: DB.data.classes[0]?.id, sectionId:'', guardianName:'', guardianPhone:'', guardianEmail:'', address:'', admissionNo:'', admissionDate: todayISO(), status:'Active' };
  return `
    <form id="studentForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Add Student' : 'Edit Student'}</h3>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">First Name</label><input required name="firstName" value="${esc(s.firstName)}" class="form-input"/></div>
        <div><label class="form-label">Last Name</label><input required name="lastName" value="${esc(s.lastName)}" class="form-input"/></div>
        <div><label class="form-label">Gender</label>
          <select name="gender" class="form-select">
            <option ${s.gender==='Male'?'selected':''}>Male</option>
            <option ${s.gender==='Female'?'selected':''}>Female</option>
          </select>
        </div>
        <div><label class="form-label">Date of Birth</label><input type="date" name="dob" value="${esc(s.dob)}" class="form-input"/></div>
        <div><label class="form-label">Class</label>
          <select name="classId" id="formClassId" class="form-select">${classOptions(s.classId)}</select>
        </div>
        <div><label class="form-label">Section</label>
          <select name="sectionId" id="formSectionId" class="form-select">${sectionOptions(s.classId, s.sectionId)}</select>
        </div>
        <div><label class="form-label">Admission No.</label><input name="admissionNo" value="${esc(s.admissionNo)}" placeholder="Auto-generated if blank" class="form-input"/></div>
        <div><label class="form-label">Admission Date</label><input type="date" name="admissionDate" value="${esc(s.admissionDate)}" class="form-input"/></div>
        <div><label class="form-label">Guardian Name</label><input name="guardianName" value="${esc(s.guardianName)}" class="form-input"/></div>
        <div><label class="form-label">Guardian Phone</label><input name="guardianPhone" value="${esc(s.guardianPhone)}" class="form-input"/></div>
        <div class="col-span-2"><label class="form-label">Guardian Email</label><input type="email" name="guardianEmail" value="${esc(s.guardianEmail)}" class="form-input"/></div>
        <div class="col-span-2"><label class="form-label">Address</label><input name="address" value="${esc(s.address)}" class="form-input"/></div>
        <div><label class="form-label">Status</label>
          <select name="status" class="form-select">
            <option ${s.status==='Active'?'selected':''}>Active</option>
            <option ${s.status==='Inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add Student' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="id" value="${s.id || ''}"/>
    </form>
  `;
}

function wireStudentForm(existingId) {
  document.getElementById('formClassId').onchange = (e) => {
    document.getElementById('formSectionId').innerHTML = sectionOptions(e.target.value, '');
  };
  document.getElementById('studentForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    if (!obj.admissionNo) obj.admissionNo = 'BW-' + Math.floor(1000 + Math.random() * 9000);
    if (existingId) {
      DB.update('students', existingId, obj);
      toast('Student updated.');
    } else {
      DB.add('students', obj);
      toast('Student added.');
    }
    closeModal();
    renderStudents();
  };
}

function openStudentForm() {
  openModal(studentFormHTML(null));
  wireStudentForm(null);
}
function editStudent(id) {
  const s = DB.find('students', id);
  openModal(studentFormHTML(s));
  wireStudentForm(id);
}
function deleteStudent(id) {
  confirmAction('This will permanently remove the student and cannot be undone.', () => {
    DB.remove('students', id);
    DB.data.attendance = DB.data.attendance.filter(a => a.studentId !== id);
    DB.data.grades = DB.data.grades.filter(g => g.studentId !== id);
    DB.data.invoices = DB.data.invoices.filter(i => i.studentId !== id);
    DB.save();
    toast('Student removed.');
    renderStudents();
  });
}

function viewStudent(id) {
  const s = DB.find('students', id);
  const rate = DB.attendanceRateFor(id);
  const avg = DB.studentAverage(id);
  const bal = DB.balanceFor(id);
  openModal(`
    <div class="p-6">
      <div class="flex items-center gap-4 mb-5">
        <div class="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold">${initialsAvatar(s.firstName+' '+s.lastName)}</div>
        <div>
          <h3 class="font-bold text-lg">${esc(s.firstName)} ${esc(s.lastName)}</h3>
          <p class="text-sm text-slate-500">${DB.classSectionLabel(s.classId, s.sectionId)} &middot; ${esc(s.admissionNo)}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="card stat-card text-center"><div class="stat-value text-brand-600">${rate ?? '—'}%</div><div class="text-xs text-slate-400">Attendance</div></div>
        <div class="card stat-card text-center"><div class="stat-value text-emerald-600">${avg ?? '—'}${avg?'%':''}</div><div class="text-xs text-slate-400">Avg. Score</div></div>
        <div class="card stat-card text-center"><div class="stat-value ${bal>0?'text-red-600':'text-emerald-600'}">${money(bal)}</div><div class="text-xs text-slate-400">Fee Balance</div></div>
      </div>
      <dl class="text-sm space-y-2">
        <div class="flex justify-between"><dt class="text-slate-400">Gender</dt><dd>${esc(s.gender)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Date of Birth</dt><dd>${esc(s.dob) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Guardian</dt><dd>${esc(s.guardianName) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Guardian Phone</dt><dd>${esc(s.guardianPhone) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Address</dt><dd>${esc(s.address) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Admission Date</dt><dd>${esc(s.admissionDate) || '—'}</dd></div>
      </dl>
      <div class="flex justify-end pt-5"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>
    </div>
  `);
}
