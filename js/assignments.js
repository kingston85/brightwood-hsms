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

  const rows = list.map(a => {
    const subs = (DB.data.submissions || []).filter(s => s.assignmentId === a.id);
    const total = DB.studentsInSection(a.sectionId).length;
    return `
    <tr class="${a.dueDate < today ? 'bg-red-50' : ''}">
      <td>${esc(a.title)}<div class="text-xs text-slate-400">${esc(a.description || '')}</div></td>
      <td>${DB.subjectName(a.subjectId)}</td>
      <td>${DB.teacherName(a.teacherId)}</td>
      <td class="${a.dueDate < today ? 'text-red-600 font-semibold' : ''}">${esc(a.dueDate)} ${a.dueDate < today ? badge('Overdue', 'red') : ''}</td>
      <td class="no-print"><button class="btn btn-secondary btn-sm" onclick="openSubmissionsReview('${a.id}')">${subs.length}/${total} submitted</button></td>
      <td class="text-right no-print space-x-1">
        <button class="btn btn-secondary btn-sm" onclick="editAssignment('${a.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No assignments for this section yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <select id="asgSectionSelect" class="form-select !w-56">
        ${sections.map(s => `<option value="${s.sectionId}" ${s.sectionId===AssignmentsUI.sectionId?'selected':''}>${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
      </select>
      <button class="btn btn-primary no-print" onclick="openAssignmentForm()">+ New Assignment</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Assignment</th><th>Subject</th><th>Teacher</th><th>Due Date</th><th class="no-print">Submissions</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
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
    const sub = myOwnSubmission(a.id);
    return `
    <tr class="${overdue ? 'bg-red-50' : ''}">
      <td class="font-semibold">${esc(a.title)}<div class="text-xs text-slate-400 font-normal">${esc(a.description || '')}</div></td>
      <td>${DB.subjectName(a.subjectId)}</td>
      <td>${DB.teacherName(a.teacherId)}</td>
      <td>${esc(a.dueDate)} ${overdue ? badge('Overdue', 'red') : soon ? badge('Due Soon', 'amber') : ''}</td>
      <td class="no-print">
        ${sub ? `${statusBadge(sub.status)}${sub.feedback ? `<div class="text-xs text-slate-400 mt-1">💬 ${esc(sub.feedback)}</div>` : ''}` : badge('Not submitted', 'slate')}
      </td>
      <td class="text-right no-print"><button class="btn btn-secondary btn-sm" onclick="openSubmissionForm('${a.id}')">${sub ? 'Update' : 'Submit Work'}</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No assignments yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Assignment</th><th>Subject</th><th>Teacher</th><th>Due Date</th><th class="no-print">Submission</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

/* ------------------------------ Submissions ------------------------------ */

function mySubmissionFor(assignmentId) {
  const stu = Auth.linkedRecord();
  if (!stu) return null;
  return (DB.data.submissions || []).find(s => s.assignmentId === assignmentId && s.studentId === stu.id) || null;
}
// Alias kept for readability at call sites above.
function myOwnSubmission(assignmentId) { return mySubmissionFor(assignmentId); }

// Resizes an image client-side (there's no cloud file storage configured —
// everything lives in Firestore/localStorage) and caps the result well
// under Firestore's 1MB document limit. Rejects with a friendly message
// telling the student to use the Link option instead for anything larger
// (a PDF, a video, multiple pages) rather than silently failing.
function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file (JPG, PNG, etc).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        if (dataUrl.length > 400000) {
          reject(new Error('That photo is still too large even after compressing. Try a simpler/smaller photo, or use the Link option instead for bigger files.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function submissionFormHTML(assignment, existing) {
  const isNew = !existing;
  const val = existing || { note: '', attachType: 'none', attachValue: '' };
  return `
    <form id="subForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Submit Your Work' : 'Update Your Submission'}</h3>
      <p class="text-xs text-slate-500">${esc(assignment.title)}</p>
      <div><label class="form-label">Note (optional)</label><textarea name="note" rows="2" class="form-textarea" placeholder="Anything you want to tell your teacher…">${esc(val.note)}</textarea></div>
      <div>
        <label class="form-label">Attach</label>
        <div class="flex gap-2 mb-2">
          <button type="button" data-attach="none" class="attachTypeBtn tab-btn ${val.attachType==='none'?'active':''}">Nothing</button>
          <button type="button" data-attach="link" class="attachTypeBtn tab-btn ${val.attachType==='link'?'active':''}">Link</button>
          <button type="button" data-attach="image" class="attachTypeBtn tab-btn ${val.attachType==='image'?'active':''}">Photo</button>
        </div>
        <div id="attachLinkWrap" class="${val.attachType==='link'?'':'hidden'}">
          <input name="linkValue" value="${val.attachType==='link'?esc(val.attachValue):''}" placeholder="https://drive.google.com/… or any link to your work" class="form-input"/>
        </div>
        <div id="attachImageWrap" class="${val.attachType==='image'?'':'hidden'}">
          <input type="file" id="subImageInput" accept="image/*" class="form-input"/>
          <p class="text-xs text-slate-400 mt-1">Photos are resized automatically to keep things fast. For a PDF, multiple pages, or a video, use the Link option instead (e.g. a Google Drive share link).</p>
          ${val.attachType==='image' && val.attachValue ? `<img src="${val.attachValue}" class="mt-2 rounded-lg border border-slate-200 max-h-40"/>` : ''}
        </div>
      </div>
      <p id="subFormError" class="text-xs text-red-600 hidden"></p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Submit' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="attachType" value="${val.attachType}"/>
      <input type="hidden" id="subImageData" value="${val.attachType==='image' ? esc(val.attachValue) : ''}"/>
    </form>
  `;
}

function openSubmissionForm(assignmentId) {
  const assignment = DB.find('assignments', assignmentId);
  const existing = mySubmissionFor(assignmentId);
  openModal(submissionFormHTML(assignment, existing));
  wireSubmissionForm(assignment, existing);
}

function wireSubmissionForm(assignment, existing) {
  const form = document.getElementById('subForm');
  const errEl = document.getElementById('subFormError');
  let currentType = existing ? existing.attachType : 'none';

  form.querySelectorAll('.attachTypeBtn').forEach((btn) => {
    btn.onclick = () => {
      form.querySelectorAll('.attachTypeBtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.attach;
      form.elements.attachType.value = currentType;
      document.getElementById('attachLinkWrap').classList.toggle('hidden', currentType !== 'link');
      document.getElementById('attachImageWrap').classList.toggle('hidden', currentType !== 'image');
      errEl.classList.add('hidden');
    };
  });

  const fileInput = document.getElementById('subImageInput');
  if (fileInput) {
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      errEl.classList.add('hidden');
      const submitBtn = form.querySelector('button[type=submit]');
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true; submitBtn.textContent = 'Processing photo…';
      try {
        const dataUrl = await compressImageFile(file);
        document.getElementById('subImageData').value = dataUrl;
        toast('Photo attached.');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
        fileInput.value = '';
      } finally {
        submitBtn.disabled = false; submitBtn.textContent = originalLabel;
      }
    };
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    let attachValue = '';
    if (currentType === 'link') attachValue = (fd.linkValue || '').trim();
    else if (currentType === 'image') attachValue = document.getElementById('subImageData').value || '';
    if (currentType === 'link' && !attachValue) { errEl.textContent = 'Please paste a link, or switch to Nothing/Photo.'; errEl.classList.remove('hidden'); return; }
    if (currentType === 'image' && !attachValue) { errEl.textContent = 'Please choose and wait for the photo to attach, or switch to Nothing/Link.'; errEl.classList.remove('hidden'); return; }

    const stu = Auth.linkedRecord();
    const payload = {
      assignmentId: assignment.id, studentId: stu.id, sectionId: assignment.sectionId,
      note: fd.note || '', attachType: currentType, attachValue,
      submittedAt: new Date().toISOString(), status: 'Submitted',
      feedback: existing ? existing.feedback : '', reviewedAt: existing ? existing.reviewedAt : '',
    };
    if (existing) { DB.update('submissions', existing.id, payload); toast('Submission updated.'); }
    else { DB.add('submissions', payload); toast('Work submitted!'); }
    closeModal();
    renderStudentAssignments();
  };
}

function openSubmissionsReview(assignmentId) {
  openModal(submissionsReviewHTML(assignmentId));
  wireSubmissionsReview(assignmentId);
}

function submissionsReviewHTML(assignmentId) {
  const assignment = DB.find('assignments', assignmentId);
  const students = DB.studentsInSection(assignment.sectionId).slice().sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
  const subs = (DB.data.submissions || []).filter(s => s.assignmentId === assignmentId);

  const rows = students.map((stu) => {
    const sub = subs.find(s => s.studentId === stu.id);
    return `
    <div class="border border-slate-200 rounded-lg p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-sm">${esc(stu.firstName)} ${esc(stu.lastName)}</div>
        ${sub ? statusBadge(sub.status) : badge('Not submitted', 'slate')}
      </div>
      ${sub ? `
        ${sub.note ? `<div class="text-xs text-slate-500 mt-1">${esc(sub.note)}</div>` : ''}
        ${sub.attachType === 'link' ? `<a href="${esc(sub.attachValue)}" target="_blank" rel="noopener noreferrer" class="text-xs text-brand-600 hover:underline">🔗 View attached link</a>` : ''}
        ${sub.attachType === 'image' && sub.attachValue ? `<img src="${sub.attachValue}" class="mt-2 rounded-lg border border-slate-200 max-h-32"/>` : ''}
        <div class="text-[10px] text-slate-400 mt-1">Submitted ${new Date(sub.submittedAt).toLocaleString()}</div>
        <div class="mt-2 flex gap-2 items-center no-print">
          <input class="form-input !text-xs flex-1" data-feedback-for="${sub.id}" placeholder="Feedback (optional)" value="${esc(sub.feedback || '')}"/>
          <button class="btn btn-secondary btn-sm" data-mark-reviewed="${sub.id}">${sub.status === 'Reviewed' ? 'Update' : 'Mark Reviewed'}</button>
        </div>
      ` : ''}
    </div>`;
  }).join('');

  return `
    <div class="p-6 space-y-3" style="max-height:80vh;overflow-y:auto;">
      <h3 class="font-bold text-lg">Submissions — ${esc(assignment.title)}</h3>
      <p class="text-xs text-slate-400">${subs.length} of ${students.length} submitted</p>
      ${rows || '<p class="text-sm text-slate-400">No students in this section.</p>'}
      <div class="flex justify-end pt-2"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>
    </div>
  `;
}

function wireSubmissionsReview(assignmentId) {
  document.querySelectorAll('[data-mark-reviewed]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.markReviewed;
      const feedbackInput = document.querySelector(`[data-feedback-for="${id}"]`);
      DB.update('submissions', id, { status: 'Reviewed', feedback: feedbackInput ? feedbackInput.value : '', reviewedAt: new Date().toISOString() });
      toast('Marked reviewed.');
      openSubmissionsReview(assignmentId);
      renderAssignments();
    };
  });
}

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
