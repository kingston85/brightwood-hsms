/* ==========================================================================
   Brightwood HSMS — Audit Log (Admin only)
   Read-only view of js/ui.js's logAudit() entries. See firestore.rules for
   why this collection can only be created (never read back) by non-admins —
   under Firebase Sync, a teacher's or student's local copy of this
   collection is always empty; only an admin's browser ever actually
   populates and shows this list.
   ========================================================================== */

const AuditLogUI = { search: '', days: '30' };

function renderAuditLog() {
  const cutoffDays = AuditLogUI.days === '' ? null : Number(AuditLogUI.days);
  const cutoff = cutoffDays ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000 : null;

  let list = (DB.data.auditLog || []).slice();
  if (cutoff) list = list.filter(e => new Date(e.at).getTime() >= cutoff);
  if (AuditLogUI.search) {
    const q = AuditLogUI.search.toLowerCase();
    list = list.filter(e => (`${e.action} ${e.details} ${e.actorName}`).toLowerCase().includes(q));
  }
  list = list.sort((a, b) => b.at.localeCompare(a.at));

  const rows = list.map(e => `
    <tr>
      <td class="whitespace-nowrap text-xs text-slate-400">${new Date(e.at).toLocaleString()}</td>
      <td>${esc(e.actorName)} ${e.actorRole ? `<span class="text-xs text-slate-400">(${esc(e.actorRole)})</span>` : ''}</td>
      <td class="font-medium">${esc(e.action)}</td>
      <td class="text-slate-500">${esc(e.details)}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="text-center text-slate-400 py-10">No audited activity in this range.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <p class="text-sm text-slate-500 no-print">Tracks the highest-value actions — user account changes, payment approve/reject, grade entry, graduations/promotions, and record deletions — so more than one admin/teacher can see who did what.</p>
    <div class="flex flex-wrap items-center gap-2 justify-between no-print">
      <div class="flex flex-wrap gap-2">
        <input id="alogSearch" value="${esc(AuditLogUI.search)}" placeholder="Search action, detail, or person…" class="form-input !w-64"/>
        <select id="alogDaysFilter" class="form-select !w-40">
          <option value="7" ${AuditLogUI.days==='7'?'selected':''}>Last 7 days</option>
          <option value="30" ${AuditLogUI.days==='30'?'selected':''}>Last 30 days</option>
          <option value="90" ${AuditLogUI.days==='90'?'selected':''}>Last 90 days</option>
          <option value="" ${AuditLogUI.days===''?'selected':''}>All time</option>
        </select>
      </div>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
  document.getElementById('alogSearch').oninput = (e) => { AuditLogUI.search = e.target.value; renderAuditLog(); };
  document.getElementById('alogDaysFilter').onchange = (e) => { AuditLogUI.days = e.target.value; renderAuditLog(); };
}
