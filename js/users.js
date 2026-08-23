/* ==========================================================================
   Brightwood HSMS — User Accounts module (Admin only)
   Controls who can log in and with which role. Teacher/Student accounts must
   be linked to an existing Teacher or Student record so the app knows which
   data to scope them to.

   Works in two modes:
   - Local demo mode: accounts live in DB.data.users with a username + PIN,
     checked entirely in the browser (see README.md "Security notes").
   - Firebase mode (when connected): accounts are real Firebase Authentication
     logins (email + password) with a matching Firestore profile document
     that also carries the "assignedSectionIds" a teacher may access — the
     same list Firestore Security Rules use to enforce that access on the
     server, not just in this UI.
   ========================================================================== */

const UsersUI = { search: '' };

function renderUsers() {
  let list = DB.data.users.slice();
  if (UsersUI.search) {
    const q = UsersUI.search.toLowerCase();
    list = list.filter(u => (`${u.name} ${u.username || ''} ${u.email || ''}`).toLowerCase().includes(q));
  }

  const idCol = FB.active ? 'Email (login)' : 'Username';
  const rows = list.map(u => {
    const isSelf = FB.active && Auth.currentUser && Auth.currentUser.id === u.id;
    const isProtected = FB.active ? isSelf : u.username === 'admin';
    return `
    <tr>
      <td><div class="font-semibold">${esc(u.name)}</div>${FB.active ? '' : `<div class="text-xs text-slate-400">${esc(u.email) || '—'}</div>`}</td>
      <td>${esc(FB.active ? u.email : u.username)}</td>
      <td>${badge(u.role, u.role==='admin'?'blue':u.role==='teacher'?'green':'amber')}</td>
      <td>${linkedLabel(u)}</td>
      <td class="text-right no-print space-x-1">
        <button class="btn btn-secondary btn-sm" onclick="editUser('${u.id}')">Edit</button>
        ${!isProtected ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button>` : ''}
      </td>
    </tr>
  `;
  }).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-10">No users found.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <input id="usrSearch" value="${esc(UsersUI.search)}" placeholder="Search users…" class="form-input !w-64"/>
      <button class="btn btn-primary" onclick="openUserForm()">+ Add User Account</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Name</th><th>${idCol}</th><th>Role</th><th>Linked Record</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
    <p class="text-xs text-slate-400 max-w-2xl">
      ${FB.active
        ? 'Accounts are real Firebase logins shared across every device — a teacher\'s "Assigned Sections" also control what Firestore lets them read and write, not just what this screen shows them.'
        : 'Passwords set here are simple PINs suitable for a trusted school office or single-device setup. See README.md → "Security notes" before deploying this beyond a trusted local network.'}
    </p>
  `;
  document.getElementById('usrSearch').oninput = (e) => { UsersUI.search = e.target.value; renderUsers(); };
}

function linkedLabel(u) {
  if (u.role === 'teacher') return u.linkedId ? DB.teacherName(u.linkedId) : '<span class="text-amber-600">Not linked</span>';
  if (u.role === 'student') return u.linkedId ? DB.studentName(u.linkedId) : '<span class="text-amber-600">Not linked</span>';
  return '<span class="text-slate-400">—</span>';
}

function userFormHTML(u) {
  const isNew = !u;
  u = u || { name:'', username:'', password:'', role:'teacher', email:'', linkedId:'', assignedSectionIds:[] };
  return `
    <form id="userForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg mb-1">${isNew ? 'Add User Account' : 'Edit User Account'}</h3>
      <div><label class="form-label">Full Name</label><input required name="name" value="${esc(u.name)}" class="form-input"/></div>

      ${FB.active ? `
        <div><label class="form-label">Email (login)</label><input required type="email" name="email" value="${esc(u.email)}" ${isNew ? '' : 'readonly'} class="form-input ${isNew ? '' : 'bg-slate-50 text-slate-400'}"/></div>
        ${isNew ? `<div><label class="form-label">Temporary Password</label><input required minlength="6" name="password" placeholder="At least 6 characters" class="form-input"/></div>`
                : `<p class="text-xs text-slate-400">Password changes aren't managed here — the account holder can use Firebase's "forgot password" flow, or you can reset it from the Firebase Console → Authentication.</p>`}
      ` : `
        <div class="grid grid-cols-2 gap-4">
          <div><label class="form-label">Username</label><input required name="username" value="${esc(u.username)}" class="form-input"/></div>
          <div><label class="form-label">PIN / Password</label><input required name="password" value="${esc(u.password)}" class="form-input"/></div>
        </div>
        <div><label class="form-label">Email (for Google Sign-In, optional)</label><input type="email" name="email" value="${esc(u.email)}" class="form-input"/></div>
      `}

      <div><label class="form-label">Role</label>
        <select name="role" id="userRoleSelect" class="form-select">
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
          <option value="teacher" ${u.role==='teacher'?'selected':''}>Teacher</option>
          <option value="student" ${u.role==='student'?'selected':''}>Student / Parent</option>
        </select>
      </div>
      <div id="linkedIdWrap">${linkedIdSelectHTML(u.role, u.linkedId, u.assignedSectionIds)}</div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add User' : 'Save Changes'}</button>
      </div>
      <input type="hidden" name="id" value="${u.id || ''}"/>
    </form>
  `;
}

function linkedIdSelectHTML(role, selected, assignedSectionIds) {
  if (role === 'teacher') {
    return `
      <div><label class="form-label">Link to Teacher Record</label><select name="linkedId" class="form-select"><option value="">— None —</option>${teacherOptions(selected)}</select></div>
      ${FB.active ? `<div><label class="form-label">Assigned Sections <span class="font-normal text-slate-400">(controls what this teacher can access)</span></label>${assignedSectionsCheckboxes(assignedSectionIds || [])}</div>` : ''}
    `;
  }
  if (role === 'student') return `<div><label class="form-label">Link to Student Record</label><select name="linkedId" class="form-select"><option value="">— None —</option>${DB.data.students.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${esc(s.firstName)} ${esc(s.lastName)} (${esc(s.admissionNo)})</option>`).join('')}</select></div>`;
  return '';
}

function assignedSectionsCheckboxes(selectedIds) {
  const sections = DB.allSections();
  if (!sections.length) return '<p class="text-xs text-slate-400">No sections exist yet.</p>';
  return `<div class="grid grid-cols-2 gap-1 border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto">
    ${sections.map(s => `
      <label class="flex items-center gap-2 text-sm px-1 py-0.5">
        <input type="checkbox" name="assignedSectionIds" value="${s.sectionId}" ${selectedIds.includes(s.sectionId) ? 'checked' : ''}/>
        ${esc(s.className)} - ${esc(s.sectionName)}
      </label>
    `).join('')}
  </div>`;
}

function wireUserForm(existingId) {
  document.getElementById('userRoleSelect').onchange = (e) => {
    document.getElementById('linkedIdWrap').innerHTML = linkedIdSelectHTML(e.target.value, '', []);
  };
  document.getElementById('userForm').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = Object.fromEntries(new FormData(form).entries());
    const assignedSectionIds = Array.from(form.querySelectorAll('input[name="assignedSectionIds"]:checked')).map(c => c.value);
    const submitBtn = form.querySelector('button[type=submit]');

    if (FB.active) {
      submitBtn.disabled = true;
      try {
        if (existingId) {
          await FB.updateUserProfile(existingId, { name: fd.name, role: fd.role, linkedId: fd.linkedId || null, assignedSectionIds });
          logAudit('User account updated', `${fd.name} (${fd.role})`);
          toast('User updated.');
        } else {
          await FB.adminCreateAccount({ name: fd.name, email: fd.email, password: fd.password, role: fd.role, linkedId: fd.linkedId || null, assignedSectionIds });
          logAudit('User account created', `${fd.name} (${fd.role}) — ${fd.email}`);
          toast('User added — they can sign in with the email and temporary password you set.');
        }
        closeModal(); renderUsers();
      } catch (err) {
        console.error(err);
        toast(friendlyFirebaseError ? friendlyFirebaseError(err) : (err.message || 'Could not save user.'));
      } finally {
        submitBtn.disabled = false;
      }
      return;
    }

    // Local demo mode
    const dupe = DB.data.users.find(u => u.username.toLowerCase() === fd.username.toLowerCase() && u.id !== existingId);
    if (dupe) { toast('That username is already taken.'); return; }
    if (existingId) { DB.update('users', existingId, fd); logAudit('User account updated', `${fd.name} (${fd.role})`); toast('User updated.'); }
    else { DB.add('users', fd); logAudit('User account created', `${fd.name} (${fd.role})`); toast('User added.'); }
    closeModal(); renderUsers();
  };
}

function openUserForm() { openModal(userFormHTML(null)); wireUserForm(null); }
function editUser(id) { openModal(userFormHTML(DB.find('users', id))); wireUserForm(id); }
function deleteUser(id) {
  const u = DB.find('users', id);
  const label = u ? `${u.name} (${u.role})` : id;
  confirmAction('Remove this user account? They will no longer be able to sign in.', async () => {
    if (FB.active) {
      try { await FB.deleteUserProfile(u || { id }); logAudit('User account deleted', label); toast('User removed.'); renderUsers(); }
      catch (err) { console.error(err); toast('Could not remove user — see console.'); }
      return;
    }
    DB.remove('users', id); logAudit('User account deleted', label); toast('User removed.'); renderUsers();
  });
}
