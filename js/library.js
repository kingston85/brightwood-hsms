/* ==========================================================================
   Brightwood HSMS — Library Management module
   Admin manages the book catalog and checks books in/out per student.
   Teachers get a read-only view. Students see the catalog and their own
   loan history, with overdue items flagged.
   ========================================================================== */

const LibraryUI = { tab: 'catalog', search: '' };

function bookAvailable(bookId) {
  const book = DB.find('books', bookId);
  if (!book) return 0;
  const out = DB.data.loans.filter(l => l.bookId === bookId && !l.returnDate).length;
  return Math.max(0, book.copiesTotal - out);
}

function loanStatus(loan) {
  if (loan.returnDate) return 'Returned';
  return loan.dueDate < todayISO() ? 'Overdue' : 'Out';
}

function renderLibrary() {
  if (Auth.is('student')) { renderStudentLibrary(); return; }
  const isAdmin = Auth.is('admin');

  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${LibraryUI.tab==='catalog'?'active':''}" onclick="setLibraryTab('catalog')">Catalog</button>
      ${isAdmin ? `<button class="tab-btn ${LibraryUI.tab==='loans'?'active':''}" onclick="setLibraryTab('loans')">Loans</button>` : ''}
    </div>
    <div id="libTabBody"></div>
  `;
  if (!isAdmin) LibraryUI.tab = 'catalog';
  renderLibraryTabBody();
}
function setLibraryTab(t) { LibraryUI.tab = t; renderLibrary(); }

function renderLibraryTabBody() {
  const body = document.getElementById('libTabBody');
  body.innerHTML = LibraryUI.tab === 'catalog' ? catalogHTML() : loansHTML();
  wireLibraryControls();
}

function catalogHTML() {
  const isAdmin = Auth.is('admin');
  let list = DB.data.books.slice();
  if (LibraryUI.search) {
    const q = LibraryUI.search.toLowerCase();
    list = list.filter(b => (`${b.title} ${b.author} ${b.category}`).toLowerCase().includes(q));
  }
  const rows = list.map(b => `
    <tr>
      <td class="font-semibold">${esc(b.title)}<div class="text-xs text-slate-400 font-normal">${esc(b.isbn)}</div></td>
      <td>${esc(b.author)}</td>
      <td>${esc(b.category)}</td>
      <td>${bookAvailable(b.id)} / ${b.copiesTotal}</td>
      ${isAdmin ? `<td class="text-right no-print space-x-1">
        <button class="btn btn-secondary btn-sm" onclick="editBook('${b.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBook('${b.id}')">Delete</button>
      </td>` : ''}
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-slate-400 py-10">No books in the catalog yet.</td></tr>`;

  return `
    <div class="flex flex-wrap items-center gap-3 justify-between">
      <input id="libSearch" value="${esc(LibraryUI.search)}" placeholder="Search title, author, category…" class="form-input !w-64"/>
      ${isAdmin ? `<div class="flex gap-2 no-print">
        <button class="btn btn-secondary" onclick="printBookLabels()">🏷️ Print Book Labels</button>
        <button class="btn btn-primary" onclick="openBookForm()">+ Add Book</button>
      </div>` : ''}
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Available</th>${isAdmin ? '<th class="no-print"></th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function loansHTML() {
  const list = DB.data.loans.slice().sort((a, b) => b.checkoutDate.localeCompare(a.checkoutDate));
  const rows = list.map(l => `
    <tr class="${loanStatus(l)==='Overdue' ? 'bg-red-50' : ''}">
      <td>${DB.find('books', l.bookId)?.title || '—'}</td>
      <td>${DB.studentName(l.studentId)}</td>
      <td>${esc(l.checkoutDate)}</td>
      <td>${esc(l.dueDate)}</td>
      <td>${badge(loanStatus(l), loanStatus(l)==='Overdue' ? 'red' : loanStatus(l)==='Returned' ? 'green' : 'amber')}</td>
      <td class="text-right no-print">${!l.returnDate ? `<button class="btn btn-secondary btn-sm" onclick="returnBook('${l.id}')">Mark Returned</button>` : ''}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-slate-400 py-10">No loans recorded yet.</td></tr>`;

  return `
    <div class="flex justify-end gap-2 no-print">
      <button class="btn btn-secondary" onclick="goToQrScan('library')">📷 Scan to Check Out/Return</button>
      <button class="btn btn-primary" onclick="openCheckoutForm()">+ Check Out Book</button>
    </div>
    <div class="card overflow-x-auto">
      <table class="data-table"><thead><tr><th>Book</th><th>Student</th><th>Checked Out</th><th>Due</th><th>Status</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
}

function wireLibraryControls() {
  const s = document.getElementById('libSearch');
  if (s) s.oninput = (e) => { LibraryUI.search = e.target.value; renderLibraryTabBody(); };
}

/* ------------------------------ Book CRUD (admin) ------------------------------ */

function bookFormHTML(b) {
  const isNew = !b;
  b = b || { title: '', author: '', isbn: '', category: '', copiesTotal: 1 };
  return `
    <form id="bookForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">${isNew ? 'Add Book' : 'Edit Book'}</h3>
      <div><label class="form-label">Title</label><input required name="title" value="${esc(b.title)}" class="form-input"/></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Author</label><input name="author" value="${esc(b.author)}" class="form-input"/></div>
        <div><label class="form-label">ISBN</label><input name="isbn" value="${esc(b.isbn)}" class="form-input"/></div>
        <div><label class="form-label">Category</label><input name="category" value="${esc(b.category)}" placeholder="e.g. Fiction" class="form-input"/></div>
        <div><label class="form-label">Copies Owned</label><input required type="number" min="1" name="copiesTotal" value="${b.copiesTotal}" class="form-input"/></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">${isNew ? 'Add' : 'Save'}</button></div>
    </form>
  `;
}

function openBookForm() {
  openModal(bookFormHTML(null));
  document.getElementById('bookForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.copiesTotal = Number(fd.copiesTotal);
    DB.add('books', fd);
    closeModal(); toast('Book added.'); renderLibraryTabBody();
  };
}
function editBook(id) {
  const b = DB.find('books', id);
  openModal(bookFormHTML(b));
  document.getElementById('bookForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.copiesTotal = Number(fd.copiesTotal);
    DB.update('books', id, fd);
    closeModal(); toast('Book updated.'); renderLibraryTabBody();
  };
}
function deleteBook(id) {
  confirmAction('Delete this book from the catalog? Existing loan history will be kept.', () => {
    DB.remove('books', id); toast('Book removed.'); renderLibraryTabBody();
  });
}

/* ------------------------------ Loans (admin) ------------------------------ */

function openCheckoutForm() {
  const availableBooks = DB.data.books.filter(b => bookAvailable(b.id) > 0);
  openModal(`
    <form id="coForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Check Out Book</h3>
      <div><label class="form-label">Book</label><select name="bookId" class="form-select">${availableBooks.map(b => `<option value="${b.id}">${esc(b.title)} (${bookAvailable(b.id)} available)</option>`).join('') || '<option value="">No books available</option>'}</select></div>
      <div><label class="form-label">Student</label><select name="studentId" class="form-select">${DB.data.students.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} — ${DB.classSectionLabel(s.classId,s.sectionId)}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Checkout Date</label><input type="date" name="checkoutDate" value="${todayISO()}" class="form-input"/></div>
        <div><label class="form-label">Due Date</label><input type="date" name="dueDate" value="${addDaysISOLib(todayISO(), 14)}" class="form-input"/></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Check Out</button></div>
    </form>
  `);
  document.getElementById('coForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (!fd.bookId) { toast('No book selected.'); return; }
    DB.add('loans', { ...fd, returnDate: '' });
    closeModal(); toast('Book checked out.'); renderLibraryTabBody();
  };
}

function returnBook(id) {
  DB.update('loans', id, { returnDate: todayISO() });
  toast('Book marked as returned.'); renderLibraryTabBody();
}

/* ------------------------------ Book Labels (admin) ------------------------------ */
// Printable QR labels — one per title in the catalog (not per physical
// copy, since this app doesn't track individual copies). Stick one inside
// the front cover of each copy; scanning it in the Library tab of the QR
// Scanner looks the title up and offers check-out/return on the spot.
function printBookLabels() {
  const list = DB.data.books.slice().sort((a, b) => a.title.localeCompare(b.title));
  const labels = list.map(b => `
    <div class="card p-3 flex flex-col items-center text-center border border-slate-200" style="width:160px;">
      <div class="qr-slot" data-qr="${esc(qrBookPayload(b.id))}" data-qr-width="110"></div>
      <div class="text-xs font-semibold mt-1 leading-snug">${esc(b.title)}</div>
      <div class="text-[10px] text-slate-400">${esc(b.isbn || b.author || '')}</div>
    </div>
  `).join('') || `<p class="text-slate-400">No books in the catalog yet.</p>`;

  document.getElementById('mainContent').innerHTML = `
    <div class="no-print flex gap-2 mb-2">
      <button class="btn btn-secondary" onclick="renderLibrary()">&larr; Back to Library</button>
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print ${list.length} Label(s)</button>
    </div>
    <div class="flex flex-wrap gap-3">${labels}</div>
  `;
  renderAllQrSlots();
}

function addDaysISOLib(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------ Student view ------------------------------ */

function renderStudentLibrary() {
  const stu = Auth.linkedRecord();
  document.getElementById('mainContent').innerHTML = `
    <div class="flex gap-2 no-print">
      <button class="tab-btn ${LibraryUI.tab==='catalog'?'active':''}" onclick="setLibraryTab('catalog')">Catalog</button>
      <button class="tab-btn ${LibraryUI.tab==='myloans'?'active':''}" onclick="setStudentLibraryTab('myloans')">My Loans</button>
    </div>
    <div id="libTabBody"></div>
  `;
  const body = document.getElementById('libTabBody');
  if (LibraryUI.tab === 'myloans') {
    const list = stu ? DB.data.loans.filter(l => l.studentId === stu.id).sort((a,b)=>b.checkoutDate.localeCompare(a.checkoutDate)) : [];
    const rows = list.map(l => `
      <tr class="${loanStatus(l)==='Overdue' ? 'bg-red-50' : ''}">
        <td>${DB.find('books', l.bookId)?.title || '—'}</td>
        <td>${esc(l.checkoutDate)}</td>
        <td>${esc(l.dueDate)}</td>
        <td>${badge(loanStatus(l), loanStatus(l)==='Overdue' ? 'red' : loanStatus(l)==='Returned' ? 'green' : 'amber')}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" class="text-center text-slate-400 py-10">No loans yet.</td></tr>`;
    body.innerHTML = `<div class="card overflow-x-auto"><table class="data-table"><thead><tr><th>Book</th><th>Checked Out</th><th>Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else {
    body.innerHTML = catalogHTML();
    wireLibraryControls();
  }
}
function setStudentLibraryTab(t) { LibraryUI.tab = t; renderStudentLibrary(); }
