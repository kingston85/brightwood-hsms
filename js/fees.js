/* ==========================================================================
   Brightwood HSMS — Finance & Fees module
   ========================================================================== */

const FeesUI = { tab: 'invoices', classId: '', status: '', search: '' };

function invoiceStatus(inv) {
  if (inv.paidAmount >= inv.amount) return 'Paid';
  if (inv.paidAmount > 0) return 'Partial';
  return 'Unpaid';
}

function renderFees() {
  if (Auth.is('student')) { renderStudentFees(); return; }

  const pendingCount = DB.data.paymentSubmissions.filter(p => p.status === 'Pending').length;
  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${FeesUI.tab==='invoices'?'active':''}" onclick="setFeesTab('invoices')">Invoices</button>
      <button class="tab-btn ${FeesUI.tab==='structure'?'active':''}" onclick="setFeesTab('structure')">Fee Structure</button>
      <button class="tab-btn ${FeesUI.tab==='verification'?'active':''}" onclick="setFeesTab('verification')">Pending Verification ${pendingCount ? badge(pendingCount, 'red') : ''}</button>
    </div>
    <div id="feesTabBody"></div>
  `;
  renderFeesTabBody();
}
function setFeesTab(t) { FeesUI.tab = t; renderFees(); }

function renderFeesTabBody() {
  const body = document.getElementById('feesTabBody');
  body.innerHTML = FeesUI.tab === 'invoices' ? invoicesHTML() : FeesUI.tab === 'structure' ? feeStructureHTML() : verificationQueueHTML();
  wireFeesControls();
  if (FeesUI.tab === 'verification') wireVerificationControls();
}

function invoicesHTML() {
  const totalBilled = DB.totalBilled();
  const totalCollected = DB.totalCollected();
  const outstanding = totalBilled - totalCollected;

  let list = DB.data.invoices.slice();
  if (FeesUI.classId) list = list.filter(i => DB.find('students', i.studentId)?.classId === FeesUI.classId);
  if (FeesUI.status) list = list.filter(i => invoiceStatus(i) === FeesUI.status);
  if (FeesUI.search) {
    const q = FeesUI.search.toLowerCase();
    list = list.filter(i => DB.studentName(i.studentId).toLowerCase().includes(q));
  }

  const rows = list.map(i => `
    <tr>
      <td>${DB.studentName(i.studentId)}</td>
      <td>${esc(i.label)}</td>
      <td>${esc(i.term)} ${esc(i.year)}</td>
      <td>${money(i.amount)}</td>
      <td>${money(i.paidAmount)}</td>
      <td class="${i.amount-i.paidAmount>0?'text-red-600':'text-emerald-600'} font-semibold">${money(i.amount - i.paidAmount)}</td>
      <td>${statusBadge(invoiceStatus(i))}</td>
      <td class="text-right no-print space-x-1">
        ${invoiceStatus(i) !== 'Paid' ? `<button class="btn btn-secondary btn-sm" onclick="recordPayment('${i.id}')">Record Payment</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${i.id}')">Delete</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="8" class="text-center text-slate-400 py-10">No invoices found.</td></tr>`;

  return `
    <div class="grid sm:grid-cols-3 gap-4">
      <div class="card stat-card"><div class="stat-value">${money(totalBilled)}</div><div class="text-xs text-slate-400">Total Billed</div></div>
      <div class="card stat-card"><div class="stat-value text-emerald-600">${money(totalCollected)}</div><div class="text-xs text-slate-400">Collected</div></div>
      <div class="card stat-card"><div class="stat-value text-red-600">${money(outstanding)}</div><div class="text-xs text-slate-400">Outstanding</div></div>
    </div>
    <div class="flex flex-wrap items-center gap-2 justify-between">
      <div class="flex flex-wrap gap-2">
        <input id="invSearch" value="${esc(FeesUI.search)}" placeholder="Search student…" class="form-input !w-48"/>
        <select id="invClassFilter" class="form-select !w-40"><option value="">All Classes</option>${classOptions(FeesUI.classId)}</select>
        <select id="invStatusFilter" class="form-select !w-36">
          <option value="">All Status</option>
          <option ${FeesUI.status==='Paid'?'selected':''}>Paid</option>
          <option ${FeesUI.status==='Partial'?'selected':''}>Partial</option>
          <option ${FeesUI.status==='Unpaid'?'selected':''}>Unpaid</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="openInvoiceForm()">+ Add Invoice</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Item</th><th>Term</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function wireFeesControls() {
  const s = document.getElementById('invSearch');
  const c = document.getElementById('invClassFilter');
  const st = document.getElementById('invStatusFilter');
  if (s) s.oninput = (e) => { FeesUI.search = e.target.value; renderFeesTabBody(); };
  if (c) c.onchange = (e) => { FeesUI.classId = e.target.value; renderFeesTabBody(); };
  if (st) st.onchange = (e) => { FeesUI.status = e.target.value; renderFeesTabBody(); };
}

function openInvoiceForm() {
  openModal(`
    <form id="invForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Invoice</h3>
      <div><label class="form-label">Student</label><select name="studentId" class="form-select">${DB.data.students.map(s=>`<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} — ${DB.classSectionLabel(s.classId,s.sectionId)}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Item</label><input required name="label" placeholder="e.g. Tuition Fee" class="form-input"/></div>
        <div><label class="form-label">Amount</label><input required type="number" min="0" step="0.01" name="amount" class="form-input"/></div>
        <div><label class="form-label">Term</label><input name="term" value="${esc(DB.data.meta.currentTerm)}" class="form-input"/></div>
        <div><label class="form-label">Year</label><input name="year" value="${esc(DB.data.meta.currentYear)}" class="form-input"/></div>
        <div class="col-span-2"><label class="form-label">Due Date</label><input type="date" name="dueDate" class="form-input"/></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add</button></div>
    </form>
  `);
  document.getElementById('invForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.amount = Number(fd.amount);
    fd.paidAmount = 0; fd.paidDate = ''; fd.method = '';
    DB.add('invoices', fd);
    closeModal(); toast('Invoice added.'); renderFeesTabBody();
  };
}

function recordPayment(id) {
  const inv = DB.find('invoices', id);
  const balance = inv.amount - inv.paidAmount;
  openModal(`
    <form id="payForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Record Payment</h3>
      <p class="text-sm text-slate-500">${DB.studentName(inv.studentId)} &middot; ${esc(inv.label)} &middot; Balance: <strong>${money(balance)}</strong></p>
      <div><label class="form-label">Amount Paid</label><input required type="number" min="0" max="${balance}" step="0.01" name="amount" value="${balance}" class="form-input"/></div>
      <div><label class="form-label">Method</label>
        <select name="method" class="form-select"><option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Cheque</option></select>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Save Payment</button></div>
    </form>
  `);
  document.getElementById('payForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const paidAmount = Math.min(inv.amount, inv.paidAmount + Number(fd.amount));
    DB.update('invoices', id, { paidAmount, method: fd.method, paidDate: todayISO() });
    closeModal(); toast('Payment recorded.'); renderFeesTabBody();
  };
}

function deleteInvoice(id) {
  confirmAction('Delete this invoice?', () => { DB.remove('invoices', id); toast('Invoice deleted.'); renderFeesTabBody(); });
}

/* ------------------------------ Fee structure ------------------------------ */

function feeStructureHTML() {
  const rows = DB.data.feeStructure.map(f => `
    <tr><td>${DB.className(f.classId)}</td><td>${esc(f.term)}</td><td>${esc(f.label)}</td><td>${money(f.amount)}</td>
    <td class="text-right no-print"><button class="btn btn-danger btn-sm" onclick="deleteFeeItem('${f.id}')">Delete</button></td></tr>
  `).join('');
  return `
    <div class="flex justify-end"><button class="btn btn-primary" onclick="addFeeItem()">+ Add Fee Item</button></div>
    <div class="card overflow-x-auto"><table class="data-table"><thead><tr><th>Class</th><th>Term</th><th>Item</th><th>Amount</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="text-xs text-slate-400">Fee structure defines standard charges per class/term. Use "Add Invoice" under Invoices to bill an individual student, or generate invoices in bulk for a class below.</p>
    <button class="btn btn-secondary no-print" onclick="bulkGenerateInvoices()">Generate Invoices for All Students by Class Fee Structure</button>
  `;
}

function addFeeItem() {
  openModal(`
    <form id="fsForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Fee Item</h3>
      <div><label class="form-label">Class</label><select name="classId" class="form-select">${classOptions('')}</select></div>
      <div><label class="form-label">Term</label><input name="term" value="${esc(DB.data.meta.currentTerm)}" class="form-input"/></div>
      <div><label class="form-label">Item Label</label><input required name="label" placeholder="e.g. Exam Fee" class="form-input"/></div>
      <div><label class="form-label">Amount</label><input required type="number" min="0" step="0.01" name="amount" class="form-input"/></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add</button></div>
    </form>
  `);
  document.getElementById('fsForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.amount = Number(fd.amount);
    DB.add('feeStructure', fd);
    closeModal(); toast('Fee item added.'); renderFeesTabBody();
  };
}
function deleteFeeItem(id) { DB.remove('feeStructure', id); toast('Removed.'); renderFeesTabBody(); }

function bulkGenerateInvoices() {
  confirmAction('This will create an invoice for every student for every fee item matching their class, skipping duplicates already billed. Continue?', () => {
    let count = 0;
    DB.data.students.forEach(s => {
      DB.data.feeStructure.filter(f => f.classId === s.classId).forEach(f => {
        const exists = DB.data.invoices.some(i => i.studentId === s.id && i.label === f.label && i.term === f.term);
        if (!exists) {
          DB.data.invoices.push({ id: uid('inv'), studentId: s.id, term: f.term, year: DB.data.meta.currentYear, label: f.label, amount: f.amount, dueDate: '', paidAmount: 0, paidDate: '', method: '' });
          count++;
        }
      });
    });
    DB.save();
    toast(`${count} invoice(s) generated.`);
    renderFeesTabBody();
  }, 'Generate');
}

/* ------------------------------ Payment Verification (admin) ------------------------------ */

function verificationQueueHTML() {
  const list = DB.data.paymentSubmissions.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const rows = list.map(p => {
    const inv = DB.find('invoices', p.invoiceId);
    return `
    <tr class="${p.status==='Pending' ? 'bg-amber-50' : ''}">
      <td>${DB.studentName(p.studentId)}</td>
      <td>${inv ? esc(inv.label) + ' — ' + esc(inv.term) + ' ' + esc(inv.year) : '<span class="text-slate-400">Invoice deleted</span>'}</td>
      <td>${esc(p.method)}</td>
      <td>${money(p.amount)}</td>
      <td>${esc(p.reference) || '<span class="text-slate-400">—</span>'}</td>
      <td>${esc(p.submittedAt)}</td>
      <td>${badge(p.status, p.status==='Verified'?'green':p.status==='Rejected'?'red':'amber')}</td>
      <td class="text-right no-print space-x-1">
        ${p.status === 'Pending' && inv ? `
          <button class="btn btn-secondary btn-sm" onclick="approvePaymentSubmission('${p.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectPaymentSubmission('${p.id}')">Reject</button>
        ` : p.reviewNote ? `<span class="text-xs text-slate-400" title="${esc(p.reviewNote)}">note</span>` : ''}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="text-center text-slate-400 py-10">No payment submissions yet.</td></tr>`;

  return `
    <p class="text-sm text-slate-500">Payments parents submit through "Pay Now" (Mobile Money / Bank Transfer) land here for you to confirm against your actual Orange Money, MTN MoMo or bank statement before they count toward an invoice.</p>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Student</th><th>Invoice</th><th>Method</th><th>Amount Claimed</th><th>Reference</th><th>Submitted</th><th>Status</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function wireVerificationControls() { /* row buttons are wired via inline onclick */ }

function approvePaymentSubmission(id) {
  const p = DB.find('paymentSubmissions', id);
  const inv = DB.find('invoices', p.invoiceId);
  if (!inv) { toast('That invoice no longer exists.'); return; }
  const balance = inv.amount - inv.paidAmount;
  openModal(`
    <form id="approvePayForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Confirm Payment</h3>
      <p class="text-sm text-slate-500">${DB.studentName(p.studentId)} &middot; ${esc(inv.label)} &middot; claimed <strong>${money(p.amount)}</strong> via ${esc(p.method)} ${p.reference ? '(ref: ' + esc(p.reference) + ')' : ''}. Current balance: <strong>${money(balance)}</strong>.</p>
      <div><label class="form-label">Amount to Record</label><input required type="number" min="0" max="${balance}" step="0.01" name="amount" value="${Math.min(p.amount, balance)}" class="form-input"/></div>
      <p class="text-xs text-slate-400">Only confirm this once you've actually seen the money land in your Orange Money / MTN MoMo / bank account.</p>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Confirm &amp; Record Payment</button></div>
    </form>
  `);
  document.getElementById('approvePayForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const paidAmount = Math.min(inv.amount, inv.paidAmount + Number(fd.amount));
    DB.update('invoices', inv.id, { paidAmount, method: p.method, paidDate: todayISO() });
    DB.update('paymentSubmissions', id, { status: 'Verified', reviewedBy: Auth.currentUser.name, reviewedAt: todayISO(), reviewNote: '' });
    notifyPaymentReviewed(p.studentId, inv, 'confirmed');
    closeModal(); toast('Payment confirmed and recorded.'); renderFeesTabBody();
  };
}

// Email the parent/guardian when their payment submission is confirmed or
// rejected, so they know without having to check the app.
function notifyPaymentReviewed(studentId, inv, outcome, reason) {
  if (typeof FB === 'undefined' || !FB.active) return;
  const stu = DB.find('students', studentId);
  if (!stu || !stu.guardianEmail) return;
  const label = inv ? inv.label : 'your invoice';
  const body = outcome === 'confirmed'
    ? `Your payment toward "${label}" for ${stu.firstName} ${stu.lastName} has been confirmed and recorded.\n\nSign in to Brightwood HSMS to see the updated balance.`
    : `Your payment submission toward "${label}" for ${stu.firstName} ${stu.lastName} could not be confirmed.\n\nReason: "${reason}"\n\nPlease check the details and resubmit, or contact the school office.`;
  FB.queueEmail(stu.guardianEmail, `Payment ${outcome === 'confirmed' ? 'confirmed' : 'not confirmed'} — ${stu.firstName} ${stu.lastName} — Brightwood HSMS`, body);
}

function rejectPaymentSubmission(id) {
  const p = DB.find('paymentSubmissions', id);
  const inv = p ? DB.find('invoices', p.invoiceId) : null;
  openModal(`
    <form id="rejectPayForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Reject Submission</h3>
      <div><label class="form-label">Reason (shown to the parent/student)</label><textarea required name="reviewNote" rows="3" class="form-textarea" placeholder="e.g. Reference number doesn't match any transaction in our account."></textarea></div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-danger">Reject</button></div>
    </form>
  `);
  document.getElementById('rejectPayForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    DB.update('paymentSubmissions', id, { status: 'Rejected', reviewedBy: Auth.currentUser.name, reviewedAt: todayISO(), reviewNote: fd.reviewNote });
    if (p) notifyPaymentReviewed(p.studentId, inv, 'rejected', fd.reviewNote);
    closeModal(); toast('Submission rejected.'); renderFeesTabBody();
  };
}

/* ------------------------------ Student view ------------------------------ */

function paymentMethodsConfigured() {
  const m = DB.data.meta;
  const methods = [];
  if (m.orangeMoneyNumber) methods.push({ key: 'Orange Money', number: m.orangeMoneyNumber, name: m.orangeMoneyName });
  if (m.mtnMoMoNumber) methods.push({ key: 'MTN Mobile Money', number: m.mtnMoMoNumber, name: m.mtnMoMoName });
  if (m.bankName || m.bankAccountNumber) methods.push({ key: 'Bank Transfer', bankName: m.bankName, accountName: m.bankAccountName, accountNumber: m.bankAccountNumber, branch: m.bankBranch });
  return methods;
}

function renderStudentFees() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = `<p class="text-slate-400">No linked student record.</p>`; return; }
  const invs = DB.invoicesForStudent(stu.id);
  const balance = DB.balanceFor(stu.id);
  const mySubs = DB.data.paymentSubmissions.filter(p => p.studentId === stu.id);

  const rows = invs.map(i => {
    const due = i.amount - i.paidAmount;
    const pendingSub = mySubs.find(p => p.invoiceId === i.id && p.status === 'Pending');
    const lastRejected = mySubs.filter(p => p.invoiceId === i.id && p.status === 'Rejected').sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt))[0];
    return `
    <tr>
      <td>${esc(i.label)}</td><td>${esc(i.term)} ${esc(i.year)}</td><td>${money(i.amount)}</td><td>${money(i.paidAmount)}</td>
      <td class="font-semibold ${due>0?'text-red-600':'text-emerald-600'}">${money(due)}</td>
      <td>${statusBadge(invoiceStatus(i))}</td>
      <td class="no-print">
        ${due <= 0 ? '' : pendingSub
          ? `<span class="text-xs text-amber-600 font-semibold">⏳ Awaiting verification</span>`
          : `<button class="btn btn-primary btn-sm" onclick="openPayNowForm('${i.id}')">Pay Now</button>
             ${lastRejected ? `<div class="text-xs text-red-600 mt-1">Last attempt rejected: ${esc(lastRejected.reviewNote || 'see school office')}</div>` : ''}`}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="text-center text-slate-400 py-10">No invoices yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card stat-card inline-block"><div class="stat-value ${balance>0?'text-red-600':'text-emerald-600'}">${money(balance)}</div><div class="text-xs text-slate-400">Outstanding Balance</div></div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Item</th><th>Term</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th class="no-print">Pay</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

/* ------------------------------ Pay Now (student) ------------------------------ */

function openPayNowForm(invoiceId) {
  const inv = DB.find('invoices', invoiceId);
  const balance = inv.amount - inv.paidAmount;
  const methods = paymentMethodsConfigured();
  const stripeReady = (typeof StripePay !== 'undefined' && StripePay.isConfigured());

  if (!methods.length && !stripeReady) {
    openModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-2">Online Payment Not Set Up Yet</h3>
        <p class="text-sm text-slate-500">The school hasn't configured any payment methods yet. Please contact the school office to pay this invoice in person.</p>
        <div class="flex justify-end pt-4"><button class="btn btn-secondary" onclick="closeModal()">Close</button></div>
      </div>
    `);
    return;
  }

  openModal(`
    <div class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Pay ${esc(inv.label)}</h3>
      <p class="text-sm text-slate-500">${esc(inv.term)} ${esc(inv.year)} &middot; Balance due: <strong>${money(balance)}</strong></p>

      ${stripeReady ? `
        <div class="border border-slate-200 rounded-lg p-4">
          <p class="font-semibold text-sm mb-2">💳 Pay instantly with Card or Google Pay</p>
          <button id="stripePayBtn" class="btn btn-primary w-full justify-center">Pay ${money(balance)} Now</button>
          <p id="stripePayError" class="text-xs text-red-600 hidden mt-2"></p>
        </div>
        ${methods.length ? '<div class="text-xs text-slate-400 text-center">— or pay via Mobile Money / Bank below —</div>' : ''}
      ` : ''}

      ${methods.length ? `
      <div>
        ${DB.data.meta.paymentInstructions ? `<p class="text-xs text-slate-500 mb-3 bg-slate-50 border border-slate-200 rounded-lg p-3">${esc(DB.data.meta.paymentInstructions)}</p>` : ''}
        <div class="flex gap-2 mb-3 flex-wrap">
          ${methods.map((m, i) => `<button type="button" data-method-idx="${i}" class="payMethodTab tab-btn ${i===0?'active':''}">${esc(m.key)}</button>`).join('')}
        </div>
        <div id="payMethodDetails"></div>
        <form id="paySubmitForm" class="space-y-3 mt-4 border-t border-slate-200 pt-4">
          <input type="hidden" name="method" id="paySubmitMethod" value="${esc(methods[0].key)}"/>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Amount You Sent</label><input required type="number" min="0.01" max="${balance}" step="0.01" name="amount" value="${balance}" class="form-input"/></div>
            <div><label class="form-label">Date Sent</label><input type="date" name="date" value="${todayISO()}" class="form-input"/></div>
          </div>
          <div><label class="form-label">Transaction / Reference Number</label><input name="reference" placeholder="From your Mobile Money / bank confirmation SMS" class="form-input"/></div>
          <div><label class="form-label">Note (optional)</label><input name="note" class="form-input"/></div>
          <div class="flex justify-end gap-2 pt-1"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Submit Payment for Verification</button></div>
        </form>
      </div>
      ` : ''}
    </div>
  `);

  if (methods.length) {
    renderPayMethodDetails(methods[0]);
    document.querySelectorAll('.payMethodTab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.payMethodTab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const m = methods[Number(btn.dataset.methodIdx)];
        document.getElementById('paySubmitMethod').value = m.key;
        renderPayMethodDetails(m);
      };
    });
    document.getElementById('paySubmitForm').onsubmit = (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      const stu = Auth.linkedRecord();
      DB.add('paymentSubmissions', {
        invoiceId, studentId: stu.id, method: fd.method, amount: Number(fd.amount),
        reference: fd.reference || '', note: fd.note || '', submittedAt: fd.date || todayISO(),
        status: 'Pending', reviewedBy: '', reviewNote: '', reviewedAt: '',
      });
      closeModal();
      toast('Payment submitted — the school will verify it and update your balance.');
      renderStudentFees();
    };
  }

  if (stripeReady) {
    document.getElementById('stripePayBtn').onclick = () => StripePay.payInvoice(inv, document.getElementById('stripePayError'));
  }
}

function renderPayMethodDetails(m) {
  const wrap = document.getElementById('payMethodDetails');
  if (!wrap) return;
  if (m.key === 'Bank Transfer') {
    wrap.innerHTML = `
      <dl class="text-sm space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div class="flex justify-between"><dt class="text-slate-500">Bank</dt><dd class="font-semibold">${esc(m.bankName) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Account Name</dt><dd class="font-semibold">${esc(m.accountName) || '—'}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Account Number</dt><dd class="font-semibold">${esc(m.accountNumber) || '—'}</dd></div>
        ${m.branch ? `<div class="flex justify-between"><dt class="text-slate-500">Branch</dt><dd>${esc(m.branch)}</dd></div>` : ''}
      </dl>
      <p class="text-xs text-slate-400 mt-2">Transfer the amount from your own bank, then fill in the form below with the transaction reference.</p>
    `;
  } else {
    // The USSD code that opens each operator's own money-transfer menu in
    // Liberia. Neither operator supports a one-shot dial string with the
    // recipient/amount baked in (transfers are an interactive menu you step
    // through on the phone) — so this button just saves the payer from
    // typing the code themselves; they still pick "Send Money", enter the
    // number/amount, and confirm with their own PIN on their own phone.
    const ussd = m.key === 'Orange Money' ? '*144#' : m.key === 'MTN Mobile Money' ? '*156#' : '';
    wrap.innerHTML = `
      <dl class="text-sm space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div class="flex justify-between"><dt class="text-slate-500">Send to</dt><dd class="font-semibold">${esc(m.number)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Account Name</dt><dd class="font-semibold">${esc(m.name) || '—'}</dd></div>
      </dl>
      ${ussd ? `
      <a href="tel:${encodeURIComponent(ussd)}" class="btn btn-secondary w-full justify-center mt-2 gap-2">
        📞 Open ${esc(ussd)} on this phone
      </a>
      <p class="text-xs text-slate-400 mt-1">On a phone, this opens your dialer with ${esc(ussd)} ready to call — from there choose <strong>Send Money</strong>, enter <strong>${esc(m.number)}</strong> and the amount, and confirm with your PIN. (Doesn't work from a computer — dial ${esc(ussd)} manually on the phone the SIM is in instead.)</p>
      ` : ''}
      <p class="text-xs text-slate-400 mt-2">Once sent, come back here and fill in the form below with the confirmation reference from the SMS you receive.</p>
    `;
  }
}
