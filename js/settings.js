/* ==========================================================================
   Brightwood HSMS — Backup, Sync & School Settings (Admin only)
   ========================================================================== */

function lastBackupLabel() {
  const at = Drive.getLastBackupAt();
  if (!at) return 'Last backup: never — see "Local Backup File" or "Google Drive Sync" below.';
  return `Last backup: ${new Date(at).toLocaleString()}`;
}

function renderSettings() {
  const meta = DB.data.meta;
  document.getElementById('mainContent').innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="font-bold mb-3">School Information</h3>
        <form id="metaForm" class="space-y-3">
          <div><label class="form-label">School Name</label><input name="schoolName" value="${esc(meta.schoolName)}" class="form-input"/></div>
          <div><label class="form-label">Address</label><input name="address" value="${esc(meta.address)}" class="form-input"/></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Current Term</label><input name="currentTerm" value="${esc(meta.currentTerm)}" class="form-input"/></div>
            <div><label class="form-label">Current Year</label><input name="currentYear" value="${esc(meta.currentYear)}" class="form-input"/></div>
          </div>
          <button class="btn btn-primary">Save</button>
        </form>
      </div>

      <div class="card p-5">
        <h3 class="font-bold mb-3">Firebase Sync <span class="badge ${FB.active ? 'badge-green' : FB.isConfigured() ? 'badge-amber' : 'badge-slate'}">${FB.active ? 'Live' : FB.isConfigured() ? 'Configured' : 'Not set up'}</span></h3>
        <p class="text-sm text-slate-500 mb-4">The recommended option: every admin, teacher and student/parent account shares one live database in real time, with access enforced by Firestore Security Rules on the server — not just hidden in this browser. Requires a one-time Firebase project setup — see README.md → "Firebase Setup".</p>
        ${FB.active
          ? `<p class="text-xs text-emerald-600">Connected as ${esc(Auth.currentUser.email)}. All data on this page is synced live.</p>`
          : FB.isConfigured()
            ? `<p class="text-xs text-amber-600">Configured, but you're signed in with a local demo account. Sign out and use the "Shared Firebase Account" panel on the login screen to connect.</p>`
            : `<p class="text-xs text-slate-400">No Firebase project configured yet — add one in js/firebase-sync.js (see README.md).</p>`}
        ${FB.isConfigured() ? `
        <div class="mt-4 pt-4 border-t border-slate-100">
          <button class="btn btn-secondary btn-sm" onclick="runFirebaseDiagnostics()">🩺 Run Diagnostics</button>
          <p class="text-xs text-slate-400 mt-2">Checks your setup step by step and explains any problem in plain English — no browser console needed.</p>
          <div id="diagResults" class="mt-3 space-y-2"></div>
        </div>` : ''}
      </div>

      <div class="card p-5 lg:col-span-2">
        <h3 class="font-bold mb-3">Payment Settings</h3>
        <p class="text-sm text-slate-500 mb-4">These details are shown to parents on the "Pay Now" screen for Mobile Money and Bank Transfer. Leave a section blank to hide that payment method from parents. See Finance &amp; Fees for the queue of payments parents submit for you to verify.</p>
        <form id="paySettingsForm" class="grid md:grid-cols-3 gap-4">
          <div class="space-y-3">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Orange Money</p>
            <div><label class="form-label">Number</label><input name="orangeMoneyNumber" value="${esc(meta.orangeMoneyNumber)}" placeholder="e.g. 0770-123-456" class="form-input"/></div>
            <div><label class="form-label">Account Name</label><input name="orangeMoneyName" value="${esc(meta.orangeMoneyName)}" class="form-input"/></div>
          </div>
          <div class="space-y-3">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">MTN Mobile Money</p>
            <div><label class="form-label">Number</label><input name="mtnMoMoNumber" value="${esc(meta.mtnMoMoNumber)}" placeholder="e.g. 0880-654-321" class="form-input"/></div>
            <div><label class="form-label">Account Name</label><input name="mtnMoMoName" value="${esc(meta.mtnMoMoName)}" class="form-input"/></div>
          </div>
          <div class="space-y-3">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Bank Transfer</p>
            <div><label class="form-label">Bank Name</label><input name="bankName" value="${esc(meta.bankName)}" class="form-input"/></div>
            <div><label class="form-label">Account Name</label><input name="bankAccountName" value="${esc(meta.bankAccountName)}" class="form-input"/></div>
            <div><label class="form-label">Account Number</label><input name="bankAccountNumber" value="${esc(meta.bankAccountNumber)}" class="form-input"/></div>
            <div><label class="form-label">Branch (optional)</label><input name="bankBranch" value="${esc(meta.bankBranch)}" class="form-input"/></div>
          </div>
          <div class="md:col-span-3">
            <label class="form-label">Extra Instructions for Parents (optional)</label>
            <textarea name="paymentInstructions" rows="2" class="form-textarea" placeholder="e.g. Please include your child's admission number as the reference.">${esc(meta.paymentInstructions)}</textarea>
          </div>
          <div class="md:col-span-3"><button class="btn btn-primary">Save Payment Settings</button></div>
        </form>
      </div>

      <div class="card p-5">
        <h3 class="font-bold mb-3">Google Drive Sync</h3>
        <p class="text-sm text-slate-500 mb-4">Back up the entire school database to your own Google Drive, and load it back on any device. Requires a one-time Google Cloud OAuth setup — see README.md.</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <button class="btn btn-primary" onclick="Drive.connect()">Connect Google Drive</button>
          <button class="btn btn-secondary" onclick="Drive.saveToDrive()">Save Now</button>
          <button class="btn btn-secondary" onclick="Drive.loadFromDrive()">Load from Drive</button>
          <button class="btn btn-secondary" onclick="Drive.disconnect()">Disconnect</button>
        </div>
        <p class="text-xs ${Drive.isConfigured() ? 'text-emerald-600' : 'text-amber-600'}">${Drive.isConfigured() ? 'OAuth Client ID is configured.' : 'No OAuth Client ID configured yet — add one in js/drive.js (see README.md).'}</p>
        <p class="text-xs ${Drive.needsBackupReminder() ? 'text-amber-600' : 'text-slate-400'} mt-2">${lastBackupLabel()}${Drive.needsBackupReminder() ? ' — connecting Drive or downloading a backup below will clear this.' : ''}</p>
      </div>

      <div class="card p-5">
        <h3 class="font-bold mb-3">Local Backup File</h3>
        <p class="text-sm text-slate-500 mb-4">Download a full JSON snapshot, or restore from a previous backup file. Works without any setup.</p>
        <div class="flex flex-wrap gap-2 items-center">
          <button class="btn btn-primary" onclick="exportJSONBackup()">Download Backup (.json)</button>
          <label class="btn btn-secondary cursor-pointer">
            Restore from File
            <input type="file" accept="application/json" class="hidden" onchange="importJSONBackup(this.files[0])"/>
          </label>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-bold mb-3 text-red-600">Danger Zone</h3>
        <p class="text-sm text-slate-500 mb-4">Reset all data back to the original sample dataset. This cannot be undone — download a backup first.${FB.active ? ' <strong>You are connected to Firebase — this resets the live, shared data for everyone.</strong>' : ''}</p>
        <button class="btn btn-danger" onclick="resetAllData()">Reset to Sample Data</button>
      </div>
    </div>
  `;

  document.getElementById('metaForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    Object.assign(DB.data.meta, fd);
    DB.save();
    toast('School information updated.');
  };

  document.getElementById('paySettingsForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    Object.assign(DB.data.meta, fd);
    DB.save();
    toast('Payment settings updated.');
  };
}

async function runFirebaseDiagnostics() {
  const wrap = document.getElementById('diagResults');
  if (!wrap) return;
  wrap.innerHTML = `<p class="text-xs text-slate-400 flex items-center gap-2"><span class="animate-pulse">●</span> Running checks…</p>`;
  let results;
  try {
    results = await FB.runDiagnostics();
  } catch (e) {
    wrap.innerHTML = `<p class="text-xs text-red-600">Diagnostics itself failed to run: ${esc((e && e.message) || String(e))}</p>`;
    return;
  }
  const icon = (s) => s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : '❌';
  wrap.innerHTML = results.map(r => `
    <div class="flex items-start gap-2 text-xs p-2 rounded-lg ${r.status === 'pass' ? 'bg-emerald-50' : r.status === 'warn' ? 'bg-amber-50' : 'bg-red-50'}">
      <span>${icon(r.status)}</span>
      <div>
        <div class="font-semibold">${esc(r.check)}</div>
        <div class="text-slate-500 mt-0.5">${esc(r.message)}</div>
      </div>
    </div>
  `).join('');
}

function resetAllData() {
  confirmAction('This replaces ALL current data with the original sample dataset. Make sure you have downloaded a backup if you need to keep anything.', () => {
    DB.resetToSeed();
    toast('Data reset to sample dataset.');
    renderCurrentView();
  }, 'Reset Data');
}
