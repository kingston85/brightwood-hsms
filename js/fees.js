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

  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${FeesUI.tab==='invoices'?'active':''}" onclick="setFeesTab('invoices')">Invoices</button>
      <button class="tab-btn ${FeesUI.tab==='structure'?'active':''}" onclick="setFeesTab('structure')">Fee Structure</button>
    </div>
    <div id="feesTabBody"></div>
  `;
  renderFeesTabBody();
}
function setFeesTab(t) { FeesUI.tab = t; renderFees(); }

function renderFeesTabBody() {
  const body = document.getElementById('feesTabBody');
  body.innerHTML = FeesUI.tab === 'invoices' ? invoicesHTML() : feeStructureHTML();
  wireFeesControls();
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

/* ------------------------------ Student view ------------------------------ */

function renderStudentFees() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = `<p class="text-slate-400">No linked student record.</p>`; return; }
  const invs = DB.invoicesForStudent(stu.id);
  const balance = DB.balanceFor(stu.id);
  const rows = invs.map(i => `
    <tr><td>${esc(i.label)}</td><td>${esc(i.term)} ${esc(i.year)}</td><td>${money(i.amount)}</td><td>${money(i.paidAmount)}</td>
    <td class="font-semibold ${i.amount-i.paidAmount>0?'text-red-600':'text-emerald-600'}">${money(i.amount-i.paidAmount)}</td><td>${statusBadge(invoiceStatus(i))}</td></tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No invoices yet.</td></tr>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="card stat-card inline-block"><div class="stat-value ${balance>0?'text-red-600':'text-emerald-600'}">${money(balance)}</div><div class="text-xs text-slate-400">Outstanding Balance</div></div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Item</th><th>Term</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}
