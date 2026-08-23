/* ==========================================================================
   Brightwood HSMS — Behavior / Discipline Log module
   Teachers log merits/demerits/incidents for students in their sections.
   Admin sees everything school-wide. Students/parents see their own record
   and a running points total.
   ========================================================================== */

const BehaviorUI = { sectionId: null, search: '' };

const BEHAVIOR_TYPES = {
  Merit: { color: 'emerald', points: 5 },
  Demerit: { color: 'amber', points: -5 },
  Incident: { color: 'red', points: -10 },
};

function scopedSectionsForBehavior() {
  let sections = DB.allSections();
  if (Auth.is('teacher')) {
    const allowed = Auth.teacherSections(Auth.currentUser.linkedId);
    sections = sections.filter(s => allowed.includes(s.sectionId));
  }
  return sections;
}

function renderBehavior() {
  if (Auth.is('student')) { renderStudentBehavior(); return; }

  const sections = scopedSectionsForBehavior();
  if (!sections.find(s => s.sectionId === BehaviorUI.sectionId)) BehaviorUI.sectionId = sections[0]?.sectionId || null;

  let list = DB.data.behaviorLogs.filter(b => b.sectionId === BehaviorUI.sectionId);
  if (BehaviorUI.search) {
    const q = BehaviorUI.search.toLowerCase();
    list = list.filter(b => DB.studentName(b.studentId).toLowerCase().includes(q));
  }
  list = list.sort((a, b) => b.date.localeCompare(a.date));

  const rows = list.map(b => `
    <tr>
      <td>${studentLinkHTML(b.studentId)}</td>
      <td>${badge(b.type, BEHAVIOR_TYPES[b.type]?.color || 'slate')}</td>
      <td class="${b.points >= 0 ? 'text-emerald-600' : 'text-red-600'} font-semibold">${b.points > 0 ? '+' : ''}${b.points}</td>
      <td>${esc(b.description)}</td>
      <td>${esc(b.date)}</td>
      <td>${esc(b.recordedByName)}</td>
      <td class="text-right no-print"><button class="btn btn-danger btn-sm" onclick="deleteBehaviorLog('${b.id}')">Delete</button></td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="text-center text-slate-400 py-10">No behavior records for this section yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <div class="flex flex-wrap gap-2 items-center">
        <select id="behSectionSelect" class="form-select !w-56">
          ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===BehaviorUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
        </select>
        <input id="behSearch" value="${esc(BehaviorUI.search)}" placeholder="Search student…" class="form-input !w-48"/>
      </div>
      <button class="btn btn-primary no-print" onclick="openBehaviorForm()">+ Log Entry</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Type</th><th>Points</th><th>Notes</th><th>Date</th><th>Recorded By</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
  const sel = document.getElementById('behSectionSelect');
  if (sel) sel.onchange = (e) => { BehaviorUI.sectionId = e.target.value; renderBehavior(); };
  const s = document.getElementById('behSearch');
  if (s) s.oninput = (e) => { BehaviorUI.search = e.target.value; renderBehavior(); };
}

function openBehaviorForm() {
  const students = DB.studentsInSection(BehaviorUI.sectionId);
  openModal(`
    <form id="behForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Log Behavior Entry</h3>
      <div><label class="form-label">Student</label><select name="studentId" class="form-select">${students.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)}</option>`).join('')}</select></div>
      <div><label class="form-label">Type</label>
        <select name="type" id="behTypeSelect" class="form-select">
          ${Object.keys(BEHAVIOR_TYPES).map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div><label class="form-label">Points</label><input required type="number" name="points" id="behPoints" value="${BEHAVIOR_TYPES.Merit.points}" class="form-input"/></div>
      <div><label class="form-label">Notes</label><textarea required name="description" rows="3" class="form-textarea" placeholder="What happened…"></textarea></div>
      <div><label class="form-label">Date</label><input type="date" name="date" value="${todayISO()}" class="form-input"/></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>
  `);
  document.getElementById('behTypeSelect').onchange = (e) => {
    document.getElementById('behPoints').value = BEHAVIOR_TYPES[e.target.value].points;
  };
  document.getElementById('behForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const sec = DB.allSections().find(s => s.sectionId === BehaviorUI.sectionId);
    DB.add('behaviorLogs', {
      ...fd, points: Number(fd.points), sectionId: BehaviorUI.sectionId, classId: sec?.classId,
      recordedByName: Auth.currentUser.name,
    });
    closeModal(); toast('Behavior entry saved.'); renderBehavior();
  };
}

function deleteBehaviorLog(id) {
  confirmAction('Delete this behavior log entry?', () => { DB.remove('behaviorLogs', id); toast('Entry deleted.'); renderBehavior(); });
}

/* ------------------------------ Student view ------------------------------ */

function renderStudentBehavior() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = `<p class="text-slate-400">No linked student record.</p>`; return; }
  const list = DB.data.behaviorLogs.filter(b => b.studentId === stu.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((sum, b) => sum + b.points, 0);

  const rows = list.map(b => `
    <tr>
      <td>${badge(b.type, BEHAVIOR_TYPES[b.type]?.color || 'slate')}</td>
      <td class="${b.points >= 0 ? 'text-emerald-600' : 'text-red-600'} font-semibold">${b.points > 0 ? '+' : ''}${b.points}</td>
      <td>${esc(b.description)}</td>
      <td>${esc(b.date)}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-center text-slate-400 py-10">No behavior records yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card stat-card inline-block"><div class="stat-value ${total>=0?'text-emerald-600':'text-red-600'}">${total>0?'+':''}${total}</div><div class="text-xs text-slate-400">Total Behavior Points</div></div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Type</th><th>Points</th><th>Notes</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}
