/* ==========================================================================
   Brightwood HSMS — Google Drive Sync
   Uses Google Identity Services (OAuth token client) + Drive API v3 to save
   and load a single JSON snapshot of the school database in the signed-in
   user's own Google Drive (drive.file scope — the app can only see files it
   created, nothing else in the user's Drive).

   SETUP REQUIRED: paste your own OAuth 2.0 Web Client ID below. See
   README.md → "Connect Google Drive" for step-by-step instructions on
   creating one in Google Cloud Console. Without it, the app still works
   fully using local browser storage — Drive is an optional backup/sync layer.
   ========================================================================== */

const DRIVE_CONFIG = {
  CLIENT_ID: '93067659231-7fh7foso247erai2j8v6qvqoj2gmn0g3.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  FILE_NAME: 'brightwood-hsms-data.json',
};

// A "backup" here means the data left the browser it's sitting in — either
// pushed to Google Drive, or downloaded as a local .json file. Tracked in
// localStorage (not DB.data) since it's about this device/browser's backup
// habits, not part of the school data itself, and needs to survive a
// "Reset to Sample Data" or a switch between local/Firebase modes.
const LAST_BACKUP_KEY = 'hsms_lastBackupAt';
const BACKUP_REMINDER_DAYS = 7;

const Drive = {
  tokenClient: null,
  accessToken: null,
  fileId: null,
  connected: false,

  isConfigured() {
    return DRIVE_CONFIG.CLIENT_ID && !DRIVE_CONFIG.CLIENT_ID.startsWith('YOUR_');
  },

  init() {
    if (!this.isConfigured() || typeof google === 'undefined' || !google.accounts) return;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CONFIG.CLIENT_ID,
      scope: DRIVE_CONFIG.SCOPE,
      callback: (resp) => {
        if (resp && resp.access_token) {
          this.accessToken = resp.access_token;
          this.connected = true;
          this._setStatus('connected', 'Drive: connected');
          this.findOrCreateFile()
            .then(() => this.loadFromDrive(true))
            .then(() => this.checkBackupReminder());
        }
      },
    });
  },

  connect() {
    if (!this.isConfigured()) {
      toast('Google Drive isn’t configured yet. See README.md to add your OAuth Client ID.');
      return;
    }
    if (!this.tokenClient) this.init();
    if (!this.tokenClient) { toast('Google Identity Services failed to load.'); return; }
    this.tokenClient.requestAccessToken();
  },

  disconnect() {
    this.accessToken = null;
    this.connected = false;
    this._setStatus('idle', 'Drive: not connected');
    toast('Disconnected from Google Drive.');
  },

  _setStatus(state, text) {
    const dot = document.getElementById('driveDot');
    const label = document.getElementById('driveStatusText');
    if (!dot || !label) return;
    label.textContent = text;
    dot.className = 'w-2 h-2 rounded-full ' + (
      state === 'connected' ? 'bg-emerald-400' :
      state === 'busy' ? 'bg-amber-400 animate-pulse' :
      state === 'error' ? 'bg-red-400' : 'bg-slate-500'
    );
  },

  async _authFetch(url, opts = {}) {
    opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + this.accessToken });
    return fetch(url, opts);
  },

  async findOrCreateFile() {
    this._setStatus('busy', 'Drive: locating file…');
    const q = encodeURIComponent(`name='${DRIVE_CONFIG.FILE_NAME}' and trashed=false`);
    const res = await this._authFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`);
    const json = await res.json();
    if (json.files && json.files.length) {
      this.fileId = json.files[0].id;
    } else {
      const createRes = await this._authFetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: DRIVE_CONFIG.FILE_NAME }),
      });
      const created = await createRes.json();
      this.fileId = created.id;
    }
    this._setStatus('connected', 'Drive: connected');
    return this.fileId;
  },

  async saveToDrive(silent) {
    if (!this.connected) { if (!silent) toast('Connect Google Drive first.'); return; }
    try {
      if (!this.fileId) await this.findOrCreateFile();
      this._setStatus('busy', 'Drive: saving…');
      const body = JSON.stringify(DB.data, null, 2);
      await this._authFetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      this._setStatus('connected', 'Drive: saved ' + new Date().toLocaleTimeString());
      this._recordBackup();
      if (!silent) toast('Saved to Google Drive.');
    } catch (e) {
      console.error(e);
      this._setStatus('error', 'Drive: save failed');
      if (!silent) toast('Could not save to Drive. See console for details.');
    }
  },

  async loadFromDrive(silent) {
    if (!this.connected) { if (!silent) toast('Connect Google Drive first.'); return; }
    try {
      if (!this.fileId) await this.findOrCreateFile();
      this._setStatus('busy', 'Drive: loading…');
      const res = await this._authFetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`);
      const text = await res.text();
      if (text && text.trim().length > 2) {
        const parsed = JSON.parse(text);
        DB.replaceAll(parsed);
        if (window.renderCurrentView) renderCurrentView();
        if (!silent) toast('Loaded latest data from Google Drive.');
      } else {
        // empty file on Drive — push current local data up
        await this.saveToDrive(true);
      }
      this._setStatus('connected', 'Drive: synced ' + new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
      this._setStatus('error', 'Drive: load failed');
      if (!silent) toast('Could not load from Drive. See console for details.');
    }
  },

  /* ---------------------- Backup reminder tracking ---------------------- */

  // Records that a real, offsite backup just happened (Drive push or local
  // .json download). Called from saveToDrive() and exportJSONBackup().
  _recordBackup() {
    try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) { /* private browsing, etc — not critical */ }
    this.hideBackupReminder();
  },

  getLastBackupAt() {
    try {
      const raw = localStorage.getItem(LAST_BACKUP_KEY);
      return raw ? Number(raw) : null;
    } catch (e) { return null; }
  },

  daysSinceLastBackup() {
    const at = this.getLastBackupAt();
    if (!at) return Infinity; // never backed up
    return (Date.now() - at) / (1000 * 60 * 60 * 24);
  },

  needsBackupReminder() {
    return this.daysSinceLastBackup() >= BACKUP_REMINDER_DAYS;
  },

  // Called once at admin login, and again whenever Drive successfully
  // connects mid-session. If Drive is already connected and the last backup
  // is stale, quietly push a fresh one — no action needed from the admin. If
  // it's stale and Drive isn't connected, surface a clear banner instead,
  // since we can't back up anywhere without either Drive or a manual
  // download. Backups are a whole-school concern, so only admins see this.
  checkBackupReminder() {
    if (!Auth.currentUser || Auth.currentUser.role !== 'admin') return;
    if (!this.needsBackupReminder()) { this.hideBackupReminder(); return; }
    if (this.connected) {
      this.saveToDrive(true).then(() => {
        if (this.getLastBackupAt()) toast('It had been a while, so your data was automatically backed up to Google Drive.');
      });
      return;
    }
    this.showBackupReminder();
  },

  showBackupReminder() {
    const el = document.getElementById('backupReminderBanner');
    if (!el) return;
    const never = !this.getLastBackupAt();
    el.innerHTML = `
      <div class="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm no-print">
        <span class="text-amber-500 text-base leading-none">⚠️</span>
        <span class="text-amber-800 flex-1 min-w-0">
          ${never ? "Your school's data has never been backed up." : `It's been over ${BACKUP_REMINDER_DAYS} days since your last backup.`}
          Protect against a lost device or cleared browser storage by connecting Google Drive or downloading a backup file.
        </span>
        <button class="btn btn-primary btn-sm" onclick="Drive.connect()">Connect Google Drive</button>
        <button class="btn btn-secondary btn-sm" onclick="exportJSONBackup()">Download Backup Now</button>
        <button class="text-amber-500 hover:text-amber-700 text-lg leading-none px-1" onclick="Drive.dismissBackupReminder()" aria-label="Dismiss" title="Dismiss for now">&times;</button>
      </div>
    `;
    el.classList.remove('hidden');
  },

  hideBackupReminder() {
    const el = document.getElementById('backupReminderBanner');
    if (!el) return;
    el.classList.add('hidden');
    el.innerHTML = '';
  },

  // Dismissing only hides it for the rest of this sign-in — it isn't marked
  // as backed up, so it reappears next time they log in until an actual
  // backup happens.
  dismissBackupReminder() {
    this.hideBackupReminder();
  },
};

/* ------------------------ Local JSON export / import (no OAuth needed) ---- */

function exportJSONBackup() {
  const blob = new Blob([JSON.stringify(DB.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brightwood-hsms-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  Drive._recordBackup();
  toast('Backup file downloaded.');
}

function importJSONBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.students || !parsed.users) throw new Error('Not a valid HSMS backup file.');
      DB.replaceAll(parsed);
      if (window.renderCurrentView) renderCurrentView();
      toast('Data restored from backup file.');
    } catch (e) {
      toast('Import failed: ' + e.message);
    }
  };
  reader.readAsText(file);
}
