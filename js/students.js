/* ==========================================================================
   Brightwood HSMS — Students module
   ========================================================================== */

const StudentsUI = { search: '', classId: '', sectionId: '', showGraduated: false };

function scopedStudents() {
  let list = DB.data.students.slice();
  if (Auth.is('teacher')) {
    const secIds = Auth.teacherSections(Auth.currentUser.linkedId);
    list = list.filter(s => secIds.includes(s.sectionId));
  }
  // Graduated students have their own home (Alumni) — keep the active
  // roster focused on current students by default, with an explicit
  // checkbox to bring them back into view when needed.
  if (!StudentsUI.showGraduated) list = list.filter(s => s.status !== 'Graduated');
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
          ${avatarHTML(s.photoURL, s.firstName + ' ' + s.lastName, 'w-9 h-9', 'bg-brand-100 text-brand-700 text-xs')}
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
        ${Auth.is('admin') ? `<button class="btn btn-secondary btn-sm" onclick="openPhotoUploadModal('students','${s.id}', renderStudents)">📷</button>` : ''}
        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">Delete</button>` : ''}
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No students found.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between no-print">
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
        <label class="flex items-center gap-1.5 text-xs text-slate-500"><input id="stuShowGraduated" type="checkbox" ${StudentsUI.showGraduated ? 'checked' : ''}/> Include graduated</label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Class List</button>
        <button class="btn btn-secondary" onclick="printIDCards()">🪪 Print ID Cards</button>
        ${Auth.is('admin') ? `<button class="btn btn-secondary" onclick="openCSVImportForm()">⬆ Import CSV</button>` : ''}
        ${Auth.is('admin') ? `<button class="btn btn-primary" onclick="openStudentForm()">+ Add Student</button>` : ''}
      </div>
    </div>

    <h2 class="print-only font-bold text-lg mb-2">${esc(DB.data.meta.schoolName)} — Student List</h2>
    <div class="card overflow-x-auto">
      <table class="data-table">
        <thead><tr><th>Student</th><th>Class</th><th>Gender</th><th>Guardian</th><th>Status</th><th class="text-right no-print">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400 no-print">${list.length} student(s)</p>
  `;

  document.getElementById('stuSearch').oninput = (e) => { StudentsUI.search = e.target.value; renderStudents(); };
  document.getElementById('stuClassFilter').value = StudentsUI.classId;
  document.getElementById('stuClassFilter').onchange = (e) => { StudentsUI.classId = e.target.value; StudentsUI.sectionId=''; renderStudents(); };
  document.getElementById('stuSectionFilter').onchange = (e) => { StudentsUI.sectionId = e.target.value; renderStudents(); };
  document.getElementById('stuShowGraduated').onchange = (e) => { StudentsUI.showGraduated = e.target.checked; renderStudents(); };
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
            <option ${s.status==='Graduated'?'selected':''}>Graduated</option>
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
  const s = DB.find('students', id);
  const label = s ? `${s.firstName} ${s.lastName} (${s.admissionNo})` : id;
  confirmAction('This will permanently remove the student and cannot be undone.', () => {
    DB.remove('students', id);
    DB.data.attendance = DB.data.attendance.filter(a => a.studentId !== id);
    DB.data.grades = DB.data.grades.filter(g => g.studentId !== id);
    DB.data.invoices = DB.data.invoices.filter(i => i.studentId !== id);
    DB.save();
    logAudit('Student deleted', label);
    toast('Student removed.');
    renderStudents();
  });
}

/* ------------------------------ ID Cards ------------------------------ */

function printIDCards() {
  const list = scopedStudents();
  const cards = list.map(s => `
    <div class="card p-4 flex flex-col items-center text-center border-2 border-brand-100" style="width:260px;">
      ${brandLogoImgHTML('h-8 mb-1')}
      <div class="text-[10px] font-bold text-brand-700 uppercase tracking-wide">${esc(DB.data.meta.schoolName)}</div>
      <div class="my-2">${avatarHTML(s.photoURL, s.firstName + ' ' + s.lastName, 'w-16 h-16', 'bg-brand-100 text-brand-700 text-xl')}</div>
      <div class="font-bold">${esc(s.firstName)} ${esc(s.lastName)}</div>
      <div class="text-xs text-slate-500">${DB.classSectionLabel(s.classId, s.sectionId)}</div>
      <div class="text-xs text-slate-400 mt-1">${esc(s.admissionNo)}</div>
      <div class="qr-slot my-2" data-qr="${esc(qrStudentPayload(s.id))}" data-qr-width="90"></div>
      <div class="text-[10px] text-slate-400 mt-1 border-t border-slate-200 pt-1 w-full">${esc(DB.data.meta.currentTerm)} ${esc(DB.data.meta.currentYear)} &middot; Student ID</div>
    </div>
  `).join('') || `<p class="text-slate-400">No students to print.</p>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="no-print flex gap-2 mb-2">
      <button class="btn btn-secondary" onclick="renderStudents()">&larr; Back to Student List</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print ${list.length} Card(s)</button>
    </div>
    <div class="flex flex-wrap gap-4">${cards}</div>
  `;
  renderAllQrSlots();
}

/* ------------------------------ Bulk CSV Import ------------------------------ */

function csvTemplateDataURI() {
  const header = 'firstName,lastName,gender,dob,className,sectionName,guardianName,guardianPhone,guardianEmail,address,admissionNo,admissionDate,status';
  const example = 'John,Doe,Male,2010-05-14,Grade 9,A,Jane Doe,0770-000-000,,Monrovia,BW-2001,2026-09-01,Active';
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + '\n' + example + '\n');
}

function splitCSVLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cells[i] || '').trim());
    return obj;
  });
}

function validateCSVRow(row) {
  if (!row.firstName || !row.lastName) return { ok: false, reason: 'Missing first/last name' };
  const cls = DB.data.classes.find(c => c.name.toLowerCase() === (row.className || '').toLowerCase());
  if (!cls) return { ok: false, reason: `Unknown class "${row.className || ''}"` };
  const sec = cls.sections.find(s => s.name.toLowerCase() === (row.sectionName || '').toLowerCase());
  if (!sec) return { ok: false, reason: `Unknown section "${row.sectionName || ''}" in ${cls.name}` };
  return { ok: true, classId: cls.id, sectionId: sec.id };
}

function openCSVImportForm() {
  openModal(`
    <div class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Import Students from CSV</h3>
      <p class="text-sm text-slate-500">Columns: <code class="text-xs">firstName, lastName, gender, dob, className, sectionName, guardianName, guardianPhone, guardianEmail, address, admissionNo, admissionDate, status</code>. <code>className</code>/<code>sectionName</code> must match existing classes/sections exactly.</p>
      <a href="${csvTemplateDataURI()}" download="student_import_template.csv" class="text-sm text-brand-600 hover:underline">⬇ Download CSV template</a>
      <div><label class="form-label">Choose CSV file</label><input type="file" id="csvFileInput" accept=".csv,text/csv" class="form-input"/></div>
      <div class="text-xs text-slate-400 text-center">— or paste CSV text below —</div>
      <textarea id="csvPasteArea" rows="4" class="form-textarea" placeholder="firstName,lastName,gender,dob,className,sectionName,..."></textarea>
      <div class="flex justify-end"><button type="button" class="btn btn-secondary" onclick="previewCSVImport()">Preview</button></div>
      <div id="csvPreviewWrap"></div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" id="csvImportBtn" class="btn btn-primary hidden" onclick="commitCSVImport()">Import Valid Rows</button>
      </div>
    </div>
  `);
  document.getElementById('csvFileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { document.getElementById('csvPasteArea').value = reader.result; previewCSVImport(); };
    reader.readAsText(file);
  };
}

let _csvImportRows = [];

function previewCSVImport() {
  const text = document.getElementById('csvPasteArea').value;
  const rows = parseCSV(text);
  _csvImportRows = rows.map(row => ({ row, ...validateCSVRow(row) }));
  const validCount = _csvImportRows.filter(r => r.ok).length;

  const tableRows = _csvImportRows.map(r => `
    <tr class="${r.ok ? '' : 'bg-red-50'}">
      <td>${esc(r.row.firstName)} ${esc(r.row.lastName)}</td>
      <td>${esc(r.row.className)} ${esc(r.row.sectionName ? '- ' + r.row.sectionName : '')}</td>
      <td>${r.ok ? '<span class="text-emerald-600 font-semibold">✓ Ready</span>' : `<span class="text-red-600">✗ ${esc(r.reason)}</span>`}</td>
    </tr>
  `).join('') || `<tr><td colspan="3" class="text-center text-slate-400 py-6">No rows found — check the CSV format.</td></tr>`;

  document.getElementById('csvPreviewWrap').innerHTML = `
    <p class="text-sm font-semibold">${validCount} of ${_csvImportRows.length} row(s) ready to import</p>
    <div class="max-h-56 overflow-y-auto border border-slate-200 rounded-lg mt-2">
      <table class="data-table"><thead><tr><th>Name</th><th>Class/Section</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
    </div>
  `;
  document.getElementById('csvImportBtn').classList.toggle('hidden', validCount === 0);
}

function commitCSVImport() {
  const valid = _csvImportRows.filter(r => r.ok);
  valid.forEach(({ row, classId, sectionId }) => {
    DB.data.students.push({
      id: uid('stu'),
      admissionNo: row.admissionNo || ('BW-' + Math.floor(1000 + Math.random() * 9000)),
      firstName: row.firstName, lastName: row.lastName,
      gender: row.gender === 'Female' ? 'Female' : 'Male',
      dob: row.dob || '', classId, sectionId,
      guardianName: row.guardianName || '', guardianPhone: row.guardianPhone || '',
      guardianEmail: row.guardianEmail || '', address: row.address || '',
      admissionDate: row.admissionDate || todayISO(),
      status: ['Active', 'Inactive', 'Graduated'].includes(row.status) ? row.status : 'Active',
    });
  });
  DB.save();
  closeModal();
  toast(`Imported ${valid.length} student(s).`);
  renderStudents();
}

function viewStudent(id) {
  const s = DB.find('students', id);
  if (!s) { toast('That student record could not be found.', { type: 'error' }); return; }
  const rate = DB.attendanceRateFor(id);
  const avg = DB.studentAverage(id);
  const bal = DB.balanceFor(id);

  // Quick links out to the rest of the app — gated to whichever tabs the
  // current viewer actually has access to (this modal can be opened from
  // Fees, Library, Behavior, Messages, Alumni, the QR scanner, and the
  // Dashboard, not just the Students page, so it doubles as the student's
  // hub). Each one closes this modal and jumps to the target tab already
  // filtered/scoped to this student — see the goToStudent*() helpers in
  // js/ui.js.
  const links = [];
  if (Auth.is('admin')) links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); goToStudentFees('${id}')">💵 Fees</button>`);
  if (Auth.is('admin') || Auth.is('teacher')) {
    links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); goToStudentAttendance('${id}')">📝 Attendance</button>`);
    links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); goToStudentReportCard('${id}')">📚 Report Card</button>`);
    links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); goToStudentBehavior('${id}')">🚦 Behavior Log</button>`);
  }
  if (Auth.is('admin')) links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); goToStudentLibrary('${id}')">📖 Library</button>`);
  if (Auth.is('teacher')) links.push(`<button class="btn btn-secondary btn-sm" onclick="closeModal(); openMessageThreadForStudent('${id}')">💬 Message</button>`);
  if (Auth.is('admin')) links.push(`<button class="btn btn-secondary btn-sm" onclick="openPhotoUploadModal('students','${id}', () => viewStudent('${id}'))">📷 Change Photo</button>`);

  openModal(`
    <div class="p-6">
      <div class="flex items-center gap-4 mb-5">
        ${avatarHTML(s.photoURL, s.firstName+' '+s.lastName, 'w-16 h-16', 'bg-brand-100 text-brand-700 text-xl')}
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
        <div class="flex justify-between items-center"><dt class="text-slate-400">Guardian Phone</dt><dd class="flex items-center gap-2">${esc(s.guardianPhone) || '—'} ${whatsappBtnHTML(s.guardianPhone, `Hello ${s.guardianName || ''}, this is ${DB.data.meta.schoolName} regarding ${s.firstName} ${s.lastName}.`)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Address</dt><dd>${esc(s.address) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-400">Admission Date</dt><dd>${esc(s.admissionDate) || '—'}</dd></div>
      </dl>
      ${links.length ? `<div class="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100 no-print">${links.join('')}</div>` : ''}
      <div class="flex justify-end pt-5"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>
    </div>
  `);
}
