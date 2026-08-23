/* ==========================================================================
   Brightwood HSMS — QR Scanner (camera-based attendance & library lookups)
   Uses the on-device jsQR decoder (assets/vendor/jsQR.min.js) against live
   camera frames — nothing scanned is ever uploaded anywhere, it's all
   decoded locally in the browser. Also works with a cheap USB "barcode
   scanner" (the keyboard-emulation kind) via the manual code field, and
   with plain mouse clicks via the dropdown fallback, for schools without a
   webcam handy. See js/qr.js for the payload format (bwhsms:student:<id> /
   bwhsms:book:<id>), generated onto ID cards and library book labels.
   ========================================================================== */

const QrScanUI = { mode: 'attendance', running: false, stream: null, rafId: null, lastCode: '', lastCodeAt: 0, recent: [] };

function renderQrScan() {
  // A background Firebase sync can trigger a full re-render of whatever
  // page is on screen (see renderCurrentView() in ui.js). If the camera is
  // already live, tearing down and rebuilding this page's DOM would kill
  // the active <video>/MediaStream for no reason — so once running, this
  // is a no-op; mode switches and scan results update their own bits of
  // the DOM directly instead of going through a full re-render.
  if (QrScanUI.running && document.getElementById('qrVideoWrap')) return;

  document.getElementById('mainContent').innerHTML = `
    <div class="space-y-4">
      <div id="qrModeTabs" class="flex gap-2 no-print">
        <button class="tab-btn ${QrScanUI.mode==='attendance'?'active':''}" data-mode="attendance" onclick="setQrScanMode('attendance')">📝 Attendance</button>
        <button class="tab-btn ${QrScanUI.mode==='library'?'active':''}" data-mode="library" onclick="setQrScanMode('library')">📖 Library</button>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card p-4">
          <div id="qrVideoWrap" class="relative bg-ink-900 rounded-lg overflow-hidden" style="aspect-ratio:4/3;">
            <video id="qrVideo" class="w-full h-full object-cover" playsinline muted></video>
            <div id="qrCamStatus" class="absolute inset-0 flex items-center justify-center text-white text-sm text-center p-4 bg-ink-900/90">Starting camera…</div>
          </div>
          <canvas id="qrCanvas" class="hidden"></canvas>
          <p id="qrHint" class="text-xs text-slate-400 mt-2">${qrHintText()}</p>
          <form id="qrCodeForm" class="flex gap-2 mt-3">
            <input id="qrCodeInput" autocomplete="off" placeholder="No camera? Focus here and scan with a USB barcode scanner…" class="form-input flex-1"/>
            <button class="btn btn-secondary btn-sm">Go</button>
          </form>
        </div>
        <div class="card p-4 space-y-4">
          <div>
            <h3 class="font-semibold text-sm text-slate-500 uppercase tracking-wide mb-2">Or look up manually</h3>
            <div id="qrManualPanel">${manualPanelHTML()}</div>
          </div>
          <div id="qrResultPanel" class="border-t border-slate-100 pt-3">
            <p class="text-sm text-slate-400">Scan a code, or use the manual lookup above.</p>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <h3 class="font-semibold text-sm text-slate-500 uppercase tracking-wide mb-2">Recent scans this session</h3>
        <div id="qrRecentList" class="text-sm text-slate-500">No scans yet this session.</div>
      </div>
    </div>
  `;
  wireQrScan();
}

function qrHintText() {
  return QrScanUI.mode === 'attendance'
    ? 'Point the camera at a student’s ID card to mark them present for today.'
    : 'Point the camera at a book label or a student’s ID card to check items in/out or look up loans.';
}

function manualPanelHTML() {
  if (QrScanUI.mode === 'attendance') {
    const opts = DB.data.students.slice().sort((a,b)=>a.firstName.localeCompare(b.firstName)).map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} — ${DB.classSectionLabel(s.classId,s.sectionId)}</option>`).join('');
    return `
      <div class="flex gap-2">
        <select id="qrManualStudent" class="form-select flex-1">${opts || '<option value="">No students yet</option>'}</select>
        <button id="qrManualStudentBtn" class="btn btn-primary btn-sm">Mark Present</button>
      </div>
    `;
  }
  const bookOpts = DB.data.books.slice().sort((a,b)=>a.title.localeCompare(b.title)).map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('');
  const stuOpts = DB.data.students.slice().sort((a,b)=>a.firstName.localeCompare(b.firstName)).map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)}</option>`).join('');
  return `
    <div class="space-y-2">
      <div class="flex gap-2">
        <select id="qrManualBook" class="form-select flex-1">${bookOpts || '<option value="">No books yet</option>'}</select>
        <button id="qrManualBookBtn" class="btn btn-primary btn-sm">Look Up Book</button>
      </div>
      <div class="flex gap-2">
        <select id="qrManualLookupStudent" class="form-select flex-1">${stuOpts || '<option value="">No students yet</option>'}</select>
        <button id="qrManualLookupBtn" class="btn btn-secondary btn-sm">Look Up Loans</button>
      </div>
    </div>
  `;
}

// Convenience for "📷 Scan" buttons elsewhere in the app (Attendance,
// Library) — jumps to the QR Scanner page pre-set to the right mode.
function goToQrScan(mode) {
  navigate('qrscan');
  setQrScanMode(mode);
}

function setQrScanMode(mode) {
  QrScanUI.mode = mode;
  document.querySelectorAll('#qrModeTabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const hint = document.getElementById('qrHint');
  if (hint) hint.textContent = qrHintText();
  const manual = document.getElementById('qrManualPanel');
  if (manual) manual.innerHTML = manualPanelHTML();
  wireManualPanel();
  setQrResult('<p class="text-sm text-slate-400">Scan a code, or use the manual lookup above.</p>');
}

function wireQrScan() {
  const codeForm = document.getElementById('qrCodeForm');
  if (codeForm) codeForm.onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('qrCodeInput');
    const v = (input.value || '').trim();
    if (v) handleQrDecoded(v);
    input.value = '';
    input.focus();
  };
  wireManualPanel();
  renderRecentScans();
  startQrCamera();
}

function wireManualPanel() {
  const sBtn = document.getElementById('qrManualStudentBtn');
  if (sBtn) sBtn.onclick = () => { const el = document.getElementById('qrManualStudent'); if (el && el.value) scanMarkAttendance(el.value); };
  const bBtn = document.getElementById('qrManualBookBtn');
  if (bBtn) bBtn.onclick = () => { const el = document.getElementById('qrManualBook'); if (el && el.value) scanLibraryBook(el.value); };
  const lBtn = document.getElementById('qrManualLookupBtn');
  if (lBtn) lBtn.onclick = () => { const el = document.getElementById('qrManualLookupStudent'); if (el && el.value) scanLibraryLookup(el.value); };
}

/* ------------------------------ Camera + decode loop ------------------------------ */

async function startQrCamera() {
  const video = document.getElementById('qrVideo');
  const statusEl = document.getElementById('qrCamStatus');
  if (!video) return;
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    if (statusEl) statusEl.textContent = 'Camera not available on this device/browser — use manual lookup or a USB scanner instead.';
    return;
  }
  if (typeof jsQR === 'undefined') {
    if (statusEl) statusEl.textContent = 'QR scanner library failed to load — use manual lookup instead.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    QrScanUI.stream = stream;
    video.srcObject = stream;
    await video.play();
    if (statusEl) statusEl.classList.add('hidden');
    QrScanUI.running = true;
    QrScanUI.rafId = requestAnimationFrame(qrTick);
  } catch (e) {
    console.error('Camera start failed:', e);
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.textContent = 'Could not access the camera (permission denied, or none found) — use manual lookup or a USB scanner instead.'; }
  }
}

function qrTick() {
  const video = document.getElementById('qrVideo');
  const canvas = document.getElementById('qrCanvas');
  if (!video || !canvas || !QrScanUI.running) return; // stopped, or navigated away
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    const w = Math.min(vw, 480);
    const h = Math.max(1, Math.round(vh * (w / vw)));
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    try {
      const frame = ctx.getImageData(0, 0, w, h);
      const code = jsQR(frame.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        const now = Date.now();
        // Ignore the same code seen again within 3s — otherwise a student
        // standing in front of the camera gets marked/scanned dozens of
        // times a second.
        if (code.data !== QrScanUI.lastCode || now - QrScanUI.lastCodeAt > 3000) {
          QrScanUI.lastCode = code.data;
          QrScanUI.lastCodeAt = now;
          handleQrDecoded(code.data);
        }
      }
    } catch (e) { /* a mid-frame read glitch shouldn't kill the scan loop */ }
  }
  QrScanUI.rafId = requestAnimationFrame(qrTick);
}

// Called from navigate() (js/ui.js) when leaving this page, so the camera
// light actually turns off instead of staying on in the background.
function stopQrScan() {
  QrScanUI.running = false;
  if (QrScanUI.rafId) cancelAnimationFrame(QrScanUI.rafId);
  QrScanUI.rafId = null;
  if (QrScanUI.stream) { QrScanUI.stream.getTracks().forEach(t => t.stop()); QrScanUI.stream = null; }
}

/* ------------------------------ Decode -> action ------------------------------ */

function handleQrDecoded(text) {
  const parsed = parseQrPayload((text || '').trim());
  if (!parsed) {
    setQrResult(`<p class="text-red-600 text-sm">⚠️ Not a recognized Brightwood HSMS code: <code class="text-xs break-all">${esc((text || '').slice(0, 80))}</code></p>`);
    pushRecentScan({ ok: false, label: 'Unrecognized code', sub: (text || '').slice(0, 40) });
    return;
  }
  if (parsed.type === 'student') {
    if (QrScanUI.mode === 'attendance') scanMarkAttendance(parsed.id);
    else scanLibraryLookup(parsed.id);
  } else if (parsed.type === 'book') {
    if (QrScanUI.mode === 'attendance') {
      setQrResult(`<p class="text-amber-600 text-sm">That’s a library book code — switch to the Library tab to scan it.</p>`);
    } else {
      scanLibraryBook(parsed.id);
    }
  }
}

function scanMarkAttendance(studentId) {
  const s = DB.find('students', studentId);
  if (!s) { setQrResult(`<p class="text-red-600 text-sm">⚠️ No student found for that code.</p>`); return; }
  const date = todayISO();
  const existing = DB.data.attendance.find(a => a.date === date && a.studentId === studentId);
  if (existing) existing.status = 'Present';
  else DB.data.attendance.push({ id: uid('att'), date, classId: s.classId, sectionId: s.sectionId, studentId, status: 'Present' });
  DB.save();
  setQrResult(`
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">${initialsAvatar(s.firstName + ' ' + s.lastName)}</div>
      <div>
        <div class="font-bold">${esc(s.firstName)} ${esc(s.lastName)}</div>
        <div class="text-xs text-slate-400">${DB.classSectionLabel(s.classId, s.sectionId)} &middot; ${esc(s.admissionNo)}</div>
        <div class="text-emerald-600 text-sm font-semibold mt-0.5">✓ Marked Present — ${esc(date)}</div>
      </div>
    </div>
  `);
  pushRecentScan({ ok: true, label: `${s.firstName} ${s.lastName}`, sub: `Marked Present · ${DB.classSectionLabel(s.classId, s.sectionId)}` });
}

function scanLibraryBook(bookId, opts) {
  opts = opts || {};
  const b = DB.find('books', bookId);
  if (!b) { setQrResult(`<p class="text-red-600 text-sm">⚠️ No book found for that code.</p>`); return; }
  const openLoans = DB.data.loans.filter(l => l.bookId === bookId && !l.returnDate);
  const avail = bookAvailable(bookId);
  const loanRows = openLoans.map(l => `
    <div class="flex items-center justify-between text-sm border-t border-slate-100 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
      <div>${esc(DB.studentName(l.studentId))} <span class="text-xs text-slate-400">due ${esc(l.dueDate)}</span> ${loanStatus(l) === 'Overdue' ? badge('Overdue', 'red') : ''}</div>
      <button class="btn btn-secondary btn-sm no-print" onclick="scanReturnLoan('${l.id}')">Mark Returned</button>
    </div>
  `).join('');
  const checkoutForm = avail > 0 ? `
    <div class="border-t border-slate-100 pt-2 mt-2">
      <label class="form-label">Check out to</label>
      <div class="flex gap-2">
        <select id="qrCheckoutStudent" class="form-select flex-1">${DB.data.students.slice().sort((a,b)=>a.firstName.localeCompare(b.firstName)).map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} — ${DB.classSectionLabel(s.classId, s.sectionId)}</option>`).join('') || '<option value="">No students yet</option>'}</select>
        <button class="btn btn-primary btn-sm" onclick="scanCheckoutBook('${bookId}')">Check Out</button>
      </div>
    </div>
  ` : `<p class="text-xs text-amber-600 mt-2">No copies currently available to check out.</p>`;

  setQrResult(`
    <div>
      <div class="font-bold">${esc(b.title)}</div>
      <div class="text-xs text-slate-400">${esc(b.author)} &middot; ${avail}/${b.copiesTotal} available</div>
      ${loanRows || '<p class="text-xs text-slate-400 mt-2">No copies currently checked out.</p>'}
      ${checkoutForm}
    </div>
  `);
  if (!opts.silent) pushRecentScan({ ok: true, label: b.title, sub: `${avail}/${b.copiesTotal} available` });
}

function scanReturnLoan(loanId) {
  const loan = DB.find('loans', loanId);
  if (!loan) return;
  const book = DB.find('books', loan.bookId);
  DB.update('loans', loanId, { returnDate: todayISO() });
  toast('Book marked as returned.', { type: 'success' });
  pushRecentScan({ ok: true, label: book ? book.title : 'Book', sub: `Returned by ${DB.studentName(loan.studentId)}` });
  scanLibraryBook(loan.bookId, { silent: true });
}

function scanCheckoutBook(bookId) {
  const sel = document.getElementById('qrCheckoutStudent');
  const studentId = sel ? sel.value : '';
  if (!studentId) return;
  DB.add('loans', { bookId, studentId, checkoutDate: todayISO(), dueDate: addDaysISOLib(todayISO(), 14), returnDate: '' });
  toast('Book checked out.', { type: 'success' });
  pushRecentScan({ ok: true, label: DB.find('books', bookId)?.title || 'Book', sub: `Checked out to ${DB.studentName(studentId)}` });
  scanLibraryBook(bookId, { silent: true });
}

function scanLibraryLookup(studentId) {
  const s = DB.find('students', studentId);
  if (!s) { setQrResult(`<p class="text-red-600 text-sm">⚠️ No student found for that code.</p>`); return; }
  const loans = DB.data.loans.filter(l => l.studentId === studentId).sort((a, b) => b.checkoutDate.localeCompare(a.checkoutDate));
  const open = loans.filter(l => !l.returnDate);
  const rows = loans.slice(0, 6).map(l => `
    <div class="flex items-center justify-between text-sm border-t border-slate-100 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
      <div>${esc(DB.find('books', l.bookId)?.title || '—')}</div>
      ${badge(loanStatus(l), loanStatus(l) === 'Overdue' ? 'red' : loanStatus(l) === 'Returned' ? 'green' : 'amber')}
    </div>
  `).join('') || '<p class="text-xs text-slate-400 mt-2">No loan history.</p>';

  setQrResult(`
    <div>
      <div class="flex items-center gap-3 mb-1">
        <div class="w-10 h-10 shrink-0 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">${initialsAvatar(s.firstName + ' ' + s.lastName)}</div>
        <div>
          <div class="font-bold">${esc(s.firstName)} ${esc(s.lastName)}</div>
          <div class="text-xs text-slate-400">${DB.classSectionLabel(s.classId, s.sectionId)}</div>
        </div>
      </div>
      ${open.length ? `<p class="text-xs ${open.some(l => loanStatus(l) === 'Overdue') ? 'text-red-600' : 'text-amber-600'} mt-1">${open.length} item(s) currently out${open.some(l => loanStatus(l) === 'Overdue') ? ' — includes overdue' : ''}.</p>` : '<p class="text-xs text-emerald-600 mt-1">Nothing currently out.</p>'}
      ${rows}
    </div>
  `);
  pushRecentScan({ ok: true, label: `${s.firstName} ${s.lastName}`, sub: `${open.length} item(s) out` });
}

/* ------------------------------ Result / recent-scans panels ------------------------------ */

function setQrResult(html) {
  const el = document.getElementById('qrResultPanel');
  if (el) el.innerHTML = html;
}

function pushRecentScan(entry) {
  QrScanUI.recent.unshift(Object.assign({ at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, entry));
  QrScanUI.recent = QrScanUI.recent.slice(0, 8);
  renderRecentScans();
}

function renderRecentScans() {
  const el = document.getElementById('qrRecentList');
  if (!el) return;
  el.innerHTML = QrScanUI.recent.length ? QrScanUI.recent.map(r => `
    <div class="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span>${r.ok ? '✅' : '⚠️'} <strong>${esc(r.label)}</strong> <span class="text-slate-400">— ${esc(r.sub || '')}</span></span>
      <span class="text-xs text-slate-400 shrink-0 ml-2">${esc(r.at)}</span>
    </div>
  `).join('') : 'No scans yet this session.';
}
