/* ==========================================================================
   Brightwood HSMS — Events & School Calendar module
   Admin manages exams, holidays and meetings on a shared calendar; everyone
   sees upcoming events. Includes a simple month-grid view plus a printable
   upcoming-events list.
   ========================================================================== */

const CalendarUI = { year: null, month: null }; // month: 0-11

const EVENT_TYPES = { Exam: 'red', Holiday: 'emerald', Meeting: 'blue', Event: 'amber' };

function scopedEvents() {
  let list = DB.data.events.slice();
  if (Auth.is('teacher')) {
    list = list.filter(e => e.audience === 'All' || e.audience === 'Teachers');
  } else if (Auth.is('student')) {
    list = list.filter(e => e.audience === 'All' || e.audience === 'Students');
  }
  return list;
}

function renderCalendar() {
  const now = new Date();
  if (CalendarUI.year === null) { CalendarUI.year = now.getFullYear(); CalendarUI.month = now.getMonth(); }
  const canManage = Auth.is('admin');

  document.getElementById('mainContent').innerHTML = `
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="card p-5 lg:col-span-2">
        <div class="flex items-center justify-between mb-4 no-print">
          <button class="btn btn-secondary btn-sm" onclick="shiftCalendarMonth(-1)">&larr; Prev</button>
          <h3 class="font-bold text-lg">${monthName(CalendarUI.month)} ${CalendarUI.year}</h3>
          <button class="btn btn-secondary btn-sm" onclick="shiftCalendarMonth(1)">Next &rarr;</button>
        </div>
        <div id="calGrid"></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold">Upcoming Events</h3>
          ${canManage ? `<button class="btn btn-primary btn-sm no-print" onclick="openEventForm()">+ Add Event</button>` : ''}
        </div>
        <div id="calUpcoming" class="space-y-2"></div>
      </div>
    </div>
  `;
  renderCalGrid();
  renderUpcomingEvents();
}

function shiftCalendarMonth(delta) {
  CalendarUI.month += delta;
  if (CalendarUI.month < 0) { CalendarUI.month = 11; CalendarUI.year--; }
  if (CalendarUI.month > 11) { CalendarUI.month = 0; CalendarUI.year++; }
  renderCalGrid();
}

function monthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m];
}

function renderCalGrid() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  const y = CalendarUI.year, m = CalendarUI.month;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const events = scopedEvents();
  const todayStr = todayISO();

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<div class="h-20 border border-slate-100"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter(e => dateStr >= e.date && dateStr <= (e.endDate || e.date));
    const isToday = dateStr === todayStr;
    cells += `
      <div class="h-20 border border-slate-100 p-1 overflow-hidden ${isToday ? 'bg-brand-50' : ''}">
        <div class="text-xs font-semibold ${isToday ? 'text-brand-600' : 'text-slate-500'}">${d}</div>
        ${dayEvents.slice(0, 2).map(e => `<div class="text-[10px] truncate px-1 rounded bg-${EVENT_TYPES[e.type]}-100 text-${EVENT_TYPES[e.type]}-700 mt-0.5">${esc(e.title)}</div>`).join('')}
        ${dayEvents.length > 2 ? `<div class="text-[10px] text-slate-400">+${dayEvents.length - 2} more</div>` : ''}
      </div>`;
  }

  grid.innerHTML = `
    <div class="grid grid-cols-7 text-xs font-semibold text-slate-400 mb-1">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="text-center">${d}</div>`).join('')}
    </div>
    <div class="grid grid-cols-7 gap-px bg-slate-100">${cells}</div>
  `;
}

function renderUpcomingEvents() {
  const wrap = document.getElementById('calUpcoming');
  if (!wrap) return;
  const today = todayISO();
  const canManage = Auth.is('admin');
  const list = scopedEvents().filter(e => (e.endDate || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));

  wrap.innerHTML = list.map(e => `
    <div class="flex items-start justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="badge badge-${EVENT_TYPES[e.type]}">${esc(e.type)}</span>
          <span class="font-semibold text-sm">${esc(e.title)}</span>
        </div>
        <div class="text-xs text-slate-400 mt-1">${esc(e.date)}${e.endDate && e.endDate !== e.date ? ' – ' + esc(e.endDate) : ''}</div>
        ${e.description ? `<div class="text-xs text-slate-500 mt-1">${esc(e.description)}</div>` : ''}
      </div>
      ${canManage ? `<button class="btn btn-danger btn-sm no-print shrink-0" onclick="deleteEvent('${e.id}')">Delete</button>` : ''}
    </div>
  `).join('') || `<p class="text-sm text-slate-400">No upcoming events.</p>`;
}

function eventFormHTML() {
  return `
    <form id="evtForm" class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Add Event</h3>
      <div><label class="form-label">Title</label><input required name="title" class="form-input" placeholder="e.g. Mid-Term Exams Begin"/></div>
      <div><label class="form-label">Description</label><textarea name="description" rows="2" class="form-textarea"></textarea></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Start Date</label><input required type="date" name="date" value="${todayISO()}" class="form-input"/></div>
        <div><label class="form-label">End Date (optional)</label><input type="date" name="endDate" class="form-input"/></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Type</label><select name="type" class="form-select">${Object.keys(EVENT_TYPES).map(t => `<option>${t}</option>`).join('')}</select></div>
        <div><label class="form-label">Audience</label><select name="audience" class="form-select"><option value="All">Everyone</option><option value="Teachers">Teachers Only</option><option value="Students">Students / Parents Only</option></select></div>
      </div>
      <div class="flex justify-end gap-2"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary">Add Event</button></div>
    </form>
  `;
}

function openEventForm() {
  openModal(eventFormHTML());
  document.getElementById('evtForm').onsubmit = (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    DB.add('events', fd);
    closeModal(); toast('Event added.'); renderCalendar();
  };
}

function deleteEvent(id) {
  confirmAction('Delete this event?', () => { DB.remove('events', id); toast('Event deleted.'); renderCalendar(); });
}
