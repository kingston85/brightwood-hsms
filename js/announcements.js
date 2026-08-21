/* ==========================================================================
   Brightwood HSMS — Announcements / Notice Board module
   Admins can post school-wide, teachers-only, students-only, or a specific
   section. Teachers can post to a section they're assigned to. Everyone
   sees announcements relevant to their role/section, newest & pinned first.
   ========================================================================== */

const AnnouncementsUI = { filter: 'all' };

function scopedAnnouncements() {
  let list = DB.data.announcements.slice();
  if (Auth.is('teacher')) {
    const mySecs = Auth.teacherSections(Auth.currentUser.linkedId);
    list = list.filter(a => a.audience === 'All' || a.audience === 'Teachers' || (a.audience === 'Section' && mySecs.includes(a.sectionId)));
  } else if (Auth.is('student')) {
    const stu = Auth.linkedRecord();
    list = list.filter(a => a.audience === 'All' || a.audience === 'Students' || (a.audience === 'Section' && stu && a.sectionId === stu.sectionId));
  }
  return list.sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));
}

function renderAnnouncements() {
  const canPost = Auth.is('admin') || Auth.is('teacher');
  const list = scopedAnnouncements();

  const cards = list.map(a => `
    <div class="card p-5 ${a.pinned ? 'border-l-4 border-l-amber-400' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            ${a.pinned ? '<span title="Pinned">📌</span>' : ''}
            <h3 class="font-bold">${esc(a.title)}</h3>
            ${badge(a.audience === 'Section' ? DB.classSectionLabel(a.classId, a.sectionId) : a.audience, audienceColor(a.audience))}
          </div>
          <p class="text-sm text-slate-600 whitespace-pre-line">${esc(a.body)}</p>
          <p class="text-xs text-slate-400 mt-2">${esc(a.postedByName)} &middot; ${esc(a.date)}</p>
        </div>
        ${(Auth.is('admin') || (Auth.is('teacher') && a.createdBy === Auth.currentUser.id)) ? `
          <div class="space-x-1 no-print shrink-0">
            <button class="btn btn-secondary btn-sm" onclick="togglePinAnnouncement('${a.id}')">${a.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${a.id}')">Delete</button>
          </div>` : ''}
      </div>
    </div>
  `).join('') || `<div class="card p-10 text-center text-slate-400">No announcements yet.</div>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="font-bold text-lg">📢 Notice Board</h2>
      ${canPost ? `<button class="btn btn-primary no-print" onclick="openAnnouncementForm()">+ New Announcement</button>` : ''}
    </div>
    <div class="space-y-3">${cards}</div>
  `;
}

function audienceColor(aud) {
  return { All: 'brand', Teachers: 'blue', Students: 'emerald', Section: 'amber' }[aud] || 'slate';
}

function openAnnouncementForm() {
  const isTeacher = Auth.is('teacher');
  const mySecs = isTeacher ? Auth.teacherSections(Auth.currentUser.linkedId) : [];
  const sectionChoices = isTeacher ? DB.allSections().filter(s => mySecs.includes(s.sectionId)) : DB.allSections();

  openModal(`
    <form id="annForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">New Announcement</h3>
      <div><label class="form-label">Title</label><input required name="title" class="form-input" placeholder="e.g. Sports Day Schedule"/></div>
      <div><label class="form-label">Message</label><textarea required name="body" rows="4" class="form-textarea" placeholder="Details…"></textarea></div>
      <div>
        <label class="form-label">Audience</label>
        <select name="audience" id="annAudience" class="form-select">
          ${isTeacher ? '' : '<option value="All">Everyone (School-wide)</option><option value="Teachers">Teachers Only</option><option value="Students">Students / Parents Only</option>'}
          <option value="Section">Specific Section</option>
        </select>
      </div>
      <div id="annSectionWrap" class="${isTeacher ? '' : 'hidden'}">
        <label class="form-label">Section</label>
        <select name="sectionId" class="form-select">
          ${sectionChoices.map(s => `<option value="${s.sectionId}">${esc(s.className)} - ${esc(s.sectionName)}</option>`).join('')}
        </select>
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="pinned"/> Pin to top</label>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Post</button></div>
    </form>
  `);
  const audEl = document.getElementById('annAudience');
  const secWrap = document.getElementById('annSectionWrap');
  if (audEl) audEl.onchange = (e) => secWrap.classList.toggle('hidden', e.target.value !== 'Section');

  document.getElementById('annForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const audience = isTeacher ? 'Section' : fd.audience;
    const sec = fd.sectionId ? DB.allSections().find(s => s.sectionId === fd.sectionId) : null;
    DB.add('announcements', {
      title: fd.title, body: fd.body, audience,
      sectionId: audience === 'Section' ? fd.sectionId : '',
      classId: audience === 'Section' && sec ? sec.classId : '',
      pinned: !!fd.pinned,
      date: todayISO(),
      postedByName: Auth.currentUser.name,
      createdBy: Auth.currentUser.id,
    });
    closeModal(); toast('Announcement posted.'); renderAnnouncements();
  };
}

function togglePinAnnouncement(id) {
  const a = DB.find('announcements', id);
  DB.update('announcements', id, { pinned: !a.pinned });
  renderAnnouncements();
}

function deleteAnnouncement(id) {
  confirmAction('Delete this announcement?', () => { DB.remove('announcements', id); toast('Announcement deleted.'); renderAnnouncements(); });
}
