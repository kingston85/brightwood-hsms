/* ==========================================================================
   Brightwood HSMS — Alumni module
   Graduated students (see js/classes.js -> openPromoteForm's "graduate"
   action, which sets status='Graduated' and stamps graduationYear) stay in
   the same students collection — this is just a dedicated, filterable view
   of that subset, since the main Students page mixes every status together.
   ========================================================================== */

const AlumniUI = { search: '', year: '' };

function graduatedStudents() {
  return DB.data.students.filter(s => s.status === 'Graduated');
}

function alumniYears() {
  return [...new Set(graduatedStudents().map(s => s.graduationYear).filter(Boolean))].sort().reverse();
}

function renderAlumni() {
  let list = graduatedStudents();
  if (AlumniUI.year) list = list.filter(s => s.graduationYear === AlumniUI.year);
  if (AlumniUI.search) {
    const q = AlumniUI.search.toLowerCase();
    list = list.filter(s => (`${s.firstName} ${s.lastName} ${s.admissionNo}`).toLowerCase().includes(q));
  }
  list = list.sort((a, b) => (b.graduationYear || '').localeCompare(a.graduationYear || '') || a.firstName.localeCompare(b.firstName));

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
      <td>${badge('Class of ' + esc(s.graduationYear || '—'), 'brand')}</td>
      <td>${DB.classSectionLabel(s.classId, s.sectionId)}</td>
      <td>${esc(s.guardianName)}<br/><span class="text-xs text-slate-400">${esc(s.guardianPhone)}</span></td>
      <td class="text-right no-print"><button class="btn btn-secondary btn-sm" onclick="viewStudent('${s.id}')">View</button></td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-10">No alumni yet — graduate a section from Classes &amp; Timetable to see them here.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between no-print">
      <div class="flex flex-wrap items-center gap-2">
        <input id="alumSearch" value="${esc(AlumniUI.search)}" placeholder="Search name or admission no…" class="form-input !w-64"/>
        <select id="alumYearFilter" class="form-select !w-36">
          <option value="">All Years</option>
          ${alumniYears().map(y => `<option value="${esc(y)}" ${y===AlumniUI.year?'selected':''}>Class of ${esc(y)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary" onclick="window.print()">🖨️ Print List</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Name</th><th>Graduation Year</th><th>Last Class/Section</th><th>Guardian</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
  document.getElementById('alumSearch').oninput = (e) => { AlumniUI.search = e.target.value; renderAlumni(); };
  document.getElementById('alumYearFilter').onchange = (e) => { AlumniUI.year = e.target.value; renderAlumni(); };
}
