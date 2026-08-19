/* ==========================================================================
   Brightwood HSMS — Dashboard module (role-aware)
   ========================================================================== */

const ChartRegistry = {};
function destroyChart(id) { if (ChartRegistry[id]) { ChartRegistry[id].destroy(); delete ChartRegistry[id]; } }

function renderDashboard() {
  if (Auth.is('admin')) renderAdminDashboard();
  else if (Auth.is('teacher')) renderTeacherDashboard();
  else renderStudentDashboard();
}

/* ------------------------------ Admin dashboard ------------------------------ */

function renderAdminDashboard() {
  const totalStudents = DB.data.students.length;
  const totalTeachers = DB.data.teachers.length;
  const totalSections = DB.allSections().length;
  const attRate = DB.overallAttendanceRate();
  const collected = DB.totalCollected();
  const billed = DB.totalBilled();
  const collectionPct = billed ? Math.round((collected / billed) * 100) : 0;

  document.getElementById('mainContent').innerHTML = `
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('🎓', 'Total Students', totalStudents, 'brand')}
      ${statCard('🧑‍🏫', 'Total Teachers', totalTeachers, 'emerald')}
      ${statCard('🏫', 'Sections', totalSections, 'amber')}
      ${statCard('📝', 'Attendance Rate', attRate + '%', attRate >= 85 ? 'emerald' : 'red')}
    </div>
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="card p-5 lg:col-span-2">
        <h3 class="font-bold mb-3">Enrollment by Class</h3>
        <canvas id="chartEnrollment" height="110"></canvas>
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-3">Gender Distribution</h3>
        <canvas id="chartGender" height="110"></canvas>
      </div>
      <div class="card p-5 lg:col-span-2">
        <h3 class="font-bold mb-3">Attendance Trend (recent days)</h3>
        <canvas id="chartAttendance" height="100"></canvas>
      </div>
      <div class="card p-5">
        <h3 class="font-bold mb-3">Fee Collection</h3>
        <canvas id="chartFees" height="110"></canvas>
        <p class="text-center text-sm text-slate-500 mt-2">${collectionPct}% collected &middot; ${money(billed - collected)} outstanding</p>
      </div>
    </div>
    <div class="card p-5">
      <h3 class="font-bold mb-3">Class Teachers Overview</h3>
      <div class="overflow-x-auto">
        <table class="data-table"><thead><tr><th>Class</th><th>Section</th><th>Class Teacher</th><th>Students</th></tr></thead>
        <tbody>${DB.allSections().map(s => `<tr><td>${esc(s.className)}</td><td>${esc(s.sectionName)}</td><td>${s.classTeacherId ? DB.teacherName(s.classTeacherId) : '<span class="text-amber-600">Unassigned</span>'}</td><td>${DB.studentsInSection(s.sectionId).length}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>
  `;

  drawEnrollmentChart();
  drawGenderChart();
  drawAttendanceTrendChart();
  drawFeesChart();
}

function statCard(icon, label, value, color) {
  const colors = { brand: 'text-brand-600', emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600' };
  return `<div class="card stat-card"><div class="text-2xl mb-1">${icon}</div><div class="stat-value ${colors[color]}">${value}</div><div class="text-xs text-slate-400">${label}</div></div>`;
}

function chartsAvailable() {
  if (typeof Chart === 'undefined') {
    document.querySelectorAll('canvas[id^="chart"]').forEach(c => {
      c.replaceWith(Object.assign(document.createElement('p'), { className: 'text-xs text-slate-400 text-center py-6', textContent: 'Charts unavailable — Chart.js could not be loaded (check your internet connection).' }));
    });
    return false;
  }
  return true;
}

function drawEnrollmentChart() {
  if (!chartsAvailable()) return;
  destroyChart('enrollment');
  const ctx = document.getElementById('chartEnrollment');
  if (!ctx) return;
  const labels = DB.data.classes.map(c => c.name);
  const data = DB.data.classes.map(c => DB.studentsInClass(c.id).length);
  ChartRegistry.enrollment = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Students', data, backgroundColor: '#3d63f5', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function drawGenderChart() {
  if (!chartsAvailable()) return;
  destroyChart('gender');
  const ctx = document.getElementById('chartGender');
  if (!ctx) return;
  const male = DB.data.students.filter(s => s.gender === 'Male').length;
  const female = DB.data.students.filter(s => s.gender === 'Female').length;
  ChartRegistry.gender = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Male', 'Female'], datasets: [{ data: [male, female], backgroundColor: ['#3d63f5', '#f59e0b'] }] },
    options: { plugins: { legend: { position: 'bottom' } } },
  });
}

function drawAttendanceTrendChart() {
  if (!chartsAvailable()) return;
  destroyChart('attendance');
  const ctx = document.getElementById('chartAttendance');
  if (!ctx) return;
  const dates = [...new Set(DB.data.attendance.map(a => a.date))].sort();
  const rates = dates.map(d => {
    const recs = DB.data.attendance.filter(a => a.date === d);
    const present = recs.filter(r => r.status === 'Present' || r.status === 'Late').length;
    return recs.length ? Math.round((present / recs.length) * 100) : 0;
  });
  ChartRegistry.attendance = new Chart(ctx, {
    type: 'line',
    data: { labels: dates, datasets: [{ label: 'Attendance %', data: rates, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.15)', fill: true, tension: .3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } },
  });
}

function drawFeesChart() {
  if (!chartsAvailable()) return;
  destroyChart('fees');
  const ctx = document.getElementById('chartFees');
  if (!ctx) return;
  const collected = DB.totalCollected();
  const outstanding = DB.totalBilled() - collected;
  ChartRegistry.fees = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Collected', 'Outstanding'], datasets: [{ data: [collected, outstanding], backgroundColor: ['#10b981', '#ef4444'] }] },
    options: { plugins: { legend: { position: 'bottom' } } },
  });
}

/* ------------------------------ Teacher dashboard ------------------------------ */

function renderTeacherDashboard() {
  const t = Auth.linkedRecord();
  const secIds = Auth.teacherSections(Auth.currentUser.linkedId);
  const sections = DB.allSections().filter(s => secIds.includes(s.sectionId));
  const studentCount = sections.reduce((sum, s) => sum + DB.studentsInSection(s.sectionId).length, 0);
  const today = new Date();
  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
  const todaysClasses = DB.data.timetable.filter(tt => tt.teacherId === Auth.currentUser.linkedId && tt.day === dayShort).sort((a,b)=>a.period-b.period);

  document.getElementById('mainContent').innerHTML = `
    <div class="grid sm:grid-cols-3 gap-4">
      ${statCard('🏫', 'My Sections', sections.length, 'brand')}
      ${statCard('🎓', 'My Students', studentCount, 'emerald')}
      ${statCard('🗓️', "Today's Periods", todaysClasses.length, 'amber')}
    </div>
    <div class="card p-5">
      <h3 class="font-bold mb-3">Today's Schedule (${dayShort})</h3>
      ${todaysClasses.length ? `<table class="data-table"><thead><tr><th>Period</th><th>Time</th><th>Section</th><th>Subject</th></tr></thead><tbody>
        ${todaysClasses.map(c => `<tr><td>P${c.period}</td><td>${esc(c.time)}</td><td>${DB.classSectionLabel(c.classId,c.sectionId)}</td><td>${DB.subjectName(c.subjectId)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="text-slate-400 text-sm">No classes scheduled today.</p>'}
    </div>
    <div class="card p-5">
      <h3 class="font-bold mb-3">My Sections</h3>
      <table class="data-table"><thead><tr><th>Class</th><th>Section</th><th>Role</th><th>Students</th><th>Avg. Attendance</th></tr></thead><tbody>
        ${sections.map(s => {
          const list = DB.studentsInSection(s.sectionId);
          const avgAtt = Math.round(list.reduce((sum, st) => sum + (DB.attendanceRateFor(st.id) || 0), 0) / (list.length || 1));
          return `<tr><td>${esc(s.className)}</td><td>${esc(s.sectionName)}</td><td>${s.classTeacherId===Auth.currentUser.linkedId ? badge('Class Teacher','blue') : badge('Subject Teacher','slate')}</td><td>${list.length}</td><td>${avgAtt}%</td></tr>`;
        }).join('')}
      </tbody></table>
    </div>
  `;
}

/* ------------------------------ Student dashboard ------------------------------ */

function renderStudentDashboard() {
  const stu = Auth.linkedRecord();
  if (!stu) { document.getElementById('mainContent').innerHTML = '<p class="text-slate-400">No linked student record for this account.</p>'; return; }
  const rate = DB.attendanceRateFor(stu.id);
  const avg = DB.studentAverage(stu.id);
  const balance = DB.balanceFor(stu.id);
  const today = new Date();
  const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
  const todaysClasses = DB.data.timetable.filter(tt => tt.sectionId === stu.sectionId && tt.day === dayShort).sort((a,b)=>a.period-b.period);

  document.getElementById('mainContent').innerHTML = `
    <div class="card p-5 flex items-center gap-4">
      <div class="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold">${initialsAvatar(stu.firstName+' '+stu.lastName)}</div>
      <div>
        <h2 class="font-bold text-lg">${esc(stu.firstName)} ${esc(stu.lastName)}</h2>
        <p class="text-sm text-slate-500">${DB.classSectionLabel(stu.classId, stu.sectionId)} &middot; ${esc(stu.admissionNo)}</p>
      </div>
    </div>
    <div class="grid sm:grid-cols-3 gap-4">
      ${statCard('📝', 'Attendance Rate', (rate ?? '—') + (rate!==null?'%':''), rate!==null && rate < 80 ? 'red' : 'emerald')}
      ${statCard('📚', 'Average Score', (avg ?? '—') + (avg!==null?'%':''), 'brand')}
      ${statCard('💵', 'Fee Balance', money(balance), balance > 0 ? 'red' : 'emerald')}
    </div>
    <div class="card p-5">
      <h3 class="font-bold mb-3">Today's Schedule (${dayShort})</h3>
      ${todaysClasses.length ? `<table class="data-table"><thead><tr><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>
        ${todaysClasses.map(c => `<tr><td>P${c.period}</td><td>${esc(c.time)}</td><td>${DB.subjectName(c.subjectId)}</td><td>${DB.teacherName(c.teacherId)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="text-slate-400 text-sm">No classes scheduled today.</p>'}
    </div>
  `;
}
