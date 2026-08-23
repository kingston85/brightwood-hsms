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
        <h3 class="font-bold mb-3">School Branding</h3>
        <p class="text-sm text-slate-500 mb-4">Shown in the sidebar once signed in, and on printed report cards &amp; ID cards.</p>
        <div class="flex items-center gap-4 mb-4">
          <div class="w-16 h-16 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
            ${meta.schoolLogo ? `<img src="${meta.schoolLogo}" class="w-full h-full object-cover" alt="Current logo"/>` : '<span class="text-xs text-slate-400">No logo</span>'}
          </div>
          <div class="space-y-2">
            <label class="btn btn-secondary btn-sm cursor-pointer">
              Upload Logo
              <input id="logoFileInput" type="file" accept="image/*" class="hidden"/>
            </label>
            ${meta.schoolLogo ? `<button class="btn btn-danger btn-sm" onclick="removeSchoolLogo()">Remove</button>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-3 mb-4">
          <label class="form-label !mb-0">Accent Color</label>
          <input id="brandColorInput" type="color" value="${meta.brandColor || '#4f46e5'}" class="w-10 h-9 rounded border border-slate-300 cursor-pointer"/>
          <button class="btn btn-secondary btn-sm" onclick="resetBrandColor()">Reset to Default</button>
        </div>
        <div class="pt-4 border-t border-slate-100">
          <label class="form-label">Login Page Background Photo</label>
          <p class="text-xs text-slate-400 mb-3">A photo of your school, shown as a faint watermark behind the sign-in screen — before anyone signs in.</p>
          <div class="flex items-center gap-4">
            <div class="w-24 h-16 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
              ${meta.loginBgPhoto ? `<img src="${meta.loginBgPhoto}" class="w-full h-full object-cover" alt="Current login background"/>` : '<span class="text-xs text-slate-400">No photo</span>'}
            </div>
            <div class="space-y-2">
              <label class="btn btn-secondary btn-sm cursor-pointer">
                Upload Photo
                <input id="loginBgFileInput" type="file" accept="image/*" class="hidden"/>
              </label>
              ${meta.loginBgPhoto ? `<button class="btn btn-danger btn-sm" onclick="removeLoginBgPhoto()">Remove</button>` : ''}
            </div>
          </div>
        </div>
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
        ${FB.active ? `
        <div class="mt-4 pt-4 border-t border-slate-100">
          <p class="text-sm font-semibold mb-1">🔔 Push Notifications <span class="font-normal text-xs text-slate-400">(this device)</span></p>
          ${typeof Push === 'undefined' || !Push.isConfigured()
            ? `<p class="text-xs text-slate-400">Not set up yet — needs a VAPID key and the sendPushOnMail Cloud Function. See README.md → "Push Notifications".</p>`
            : Push.permissionState() === 'granted'
              ? `<p class="text-xs text-emerald-600 mb-2">Enabled on this device.</p><button class="btn btn-secondary btn-sm" onclick="Push.disable()">Turn Off</button>`
              : Push.permissionState() === 'denied'
                ? `<p class="text-xs text-red-600">Blocked in this browser's site settings — allow notifications for this site to turn it back on.</p>`
                : `<button class="btn btn-secondary btn-sm" onclick="Push.enable()">Enable Push Notifications</button>`}
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

  document.getElementById('logoFileInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressLogoFile(file);
      DB.data.meta.schoolLogo = dataUrl;
      DB.save();
      applyBranding();
      toast('Logo updated.');
      renderSettings();
    } catch (err) {
      toast(err.message || 'Could not use that image.');
    }
  };

  document.getElementById('brandColorInput').onchange = (e) => {
    DB.data.meta.brandColor = e.target.value;
    DB.save();
    applyBranding();
    toast('Accent color updated.');
  };

  document.getElementById('loginBgFileInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressLoginBgFile(file);
      DB.data.meta.loginBgPhoto = dataUrl;
      DB.save();
      applyLoginBackground();
      toast('Login background photo updated.');
      renderSettings();
    } catch (err) {
      toast(err.message || 'Could not use that image.');
    }
  };
}

function removeSchoolLogo() {
  DB.data.meta.schoolLogo = '';
  DB.save();
  applyBranding();
  toast('Logo removed.');
  renderSettings();
}

function removeLoginBgPhoto() {
  DB.data.meta.loginBgPhoto = '';
  DB.save();
  applyLoginBackground();
  toast('Login background photo removed.');
  renderSettings();
}

function resetBrandColor() {
  DB.data.meta.brandColor = '';
  DB.save();
  applyBranding();
  toast('Accent color reset.');
  renderSettings();
}

// Logos need to stay small (Firestore documents cap at 1MB total, and this
// field shares that budget with everything else in meta/school) but, unlike
// the JPEG compression used for assignment photo submissions, a logo is
// usually a simple graphic that may rely on transparency — so this keeps
// PNG output and controls size via a small max dimension instead of a lossy
// quality setting.
function compressLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file (PNG, JPG, etc).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const maxDim = 300;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > 500000) {
          reject(new Error('That logo is still too large even after resizing. Try a simpler image (a flat-color logo compresses much better than a photo).'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// The login background watermark is a real photo (not a flat-color logo), so
// JPEG compresses it far better than the PNG path above. Shown at low
// opacity behind the login screen, so it doesn't need to be sharp — kept
// deliberately small since it shares the same meta/school Firestore
// document (and its 1MiB cap) as the logo above and everything else in
// School Information/Payment Settings.
function compressLoginBgFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file (PNG, JPG, etc).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (dataUrl.length > 280000) {
          reject(new Error('That photo is still too large even after resizing. Try a different one, or crop it down first.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
