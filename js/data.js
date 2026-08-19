/* ==========================================================================
   Brightwood HSMS — Data Layer
   In-browser data store persisted to localStorage, with optional Google
   Drive backup/sync (see drive.js). All app modules read/write through the
   `DB` object below so storage can be swapped later without touching UI code.
   ========================================================================== */

const STORAGE_KEY = 'hsms_db_v1';

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------- Seed Data -------------------------------- */

function seedData() {
  const subjects = [
    { id: 'sub_math', name: 'Mathematics', code: 'MATH' },
    { id: 'sub_eng', name: 'English Language', code: 'ENG' },
    { id: 'sub_sci', name: 'General Science', code: 'SCI' },
    { id: 'sub_hist', name: 'History', code: 'HIST' },
    { id: 'sub_ict', name: 'ICT', code: 'ICT' },
    { id: 'sub_geo', name: 'Geography', code: 'GEO' },
  ];

  const teachers = [
    { id: 'tch_1', staffNo: 'STF-001', firstName: 'James', lastName: 'Brown', gender: 'Male', email: 'jbrown@brightwood.edu', phone: '0770-100-201', subjectSpecialty: 'sub_math', hireDate: '2019-08-12', status: 'Active' },
    { id: 'tch_2', staffNo: 'STF-002', firstName: 'Grace', lastName: 'Kollie', gender: 'Female', email: 'gkollie@brightwood.edu', phone: '0770-100-202', subjectSpecialty: 'sub_eng', hireDate: '2020-01-20', status: 'Active' },
    { id: 'tch_3', staffNo: 'STF-003', firstName: 'Samuel', lastName: 'Doe', gender: 'Male', email: 'sdoe@brightwood.edu', phone: '0770-100-203', subjectSpecialty: 'sub_sci', hireDate: '2018-09-01', status: 'Active' },
    { id: 'tch_4', staffNo: 'STF-004', firstName: 'Miatta', lastName: 'Freeman', gender: 'Female', email: 'mfreeman@brightwood.edu', phone: '0770-100-204', subjectSpecialty: 'sub_ict', hireDate: '2021-03-15', status: 'Active' },
  ];

  const classes = [
    { id: 'cls_9', name: 'Grade 9', sections: [
      { id: 'sec_9a', name: 'A', classTeacherId: 'tch_1' },
      { id: 'sec_9b', name: 'B', classTeacherId: 'tch_2' },
    ]},
    { id: 'cls_10', name: 'Grade 10', sections: [
      { id: 'sec_10a', name: 'A', classTeacherId: 'tch_3' },
      { id: 'sec_10b', name: 'B', classTeacherId: 'tch_4' },
    ]},
  ];

  const firstNames = ['Emmanuel','Fatu','Joseph','Aminata','David','Comfort','Moses','Blessing','Sekou','Marie','Prince','Esther','Varney','Cecelia','Alfred','Ruth','Momo','Hawa','Peter','Yah'];
  const lastNames = ['Johnson','Kamara','Sirleaf','Toe','Konneh','Weah','Nyema','Barclay','Massaquoi','Gbaba'];
  const students = [];
  let n = 1;
  ['sec_9a','sec_9b','sec_10a','sec_10b'].forEach((secId) => {
    const clsId = secId.startsWith('sec_9') ? 'cls_9' : 'cls_10';
    for (let i = 0; i < 6; i++) {
      const fn = firstNames[(n * 3 + i) % firstNames.length];
      const ln = lastNames[(n + i) % lastNames.length];
      students.push({
        id: uid('stu'),
        admissionNo: 'BW-' + String(1000 + n),
        firstName: fn,
        lastName: ln,
        gender: i % 2 === 0 ? 'Male' : 'Female',
        dob: `20${clsId === 'cls_9' ? '11' : '10'}-0${(i % 9) + 1}-1${i}`,
        classId: clsId,
        sectionId: secId,
        guardianName: lastNames[(n + 2) % lastNames.length] + ' ' + firstNames[(n + 5) % firstNames.length],
        guardianPhone: '0776-' + (200 + n) + '-' + (300 + i),
        guardianEmail: '',
        address: 'Monrovia, Liberia',
        admissionDate: '2023-09-01',
        status: 'Active',
      });
      n++;
    }
  });

  const timetable = [];
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const periods = [1,2,3,4,5];
  const subjPool = ['sub_math','sub_eng','sub_sci','sub_hist','sub_ict','sub_geo'];
  const teacherForSubj = { sub_math:'tch_1', sub_eng:'tch_2', sub_sci:'tch_3', sub_ict:'tch_4', sub_hist:'tch_2', sub_geo:'tch_3' };
  classes.forEach(c => c.sections.forEach(s => {
    days.forEach((day, di) => {
      periods.forEach((p, pi) => {
        const subj = subjPool[(di + pi) % subjPool.length];
        timetable.push({
          id: uid('tt'), classId: c.id, sectionId: s.id, day, period: p,
          time: `${7 + p}:00 - ${7 + p}:45`, subjectId: subj, teacherId: teacherForSubj[subj],
        });
      });
    });
  }));

  const attendance = [];
  for (let d = 1; d <= 5; d++) {
    const date = `2026-08-${10 + d}`;
    students.forEach((s) => {
      const roll = Math.random();
      const status = roll > 0.9 ? 'Absent' : roll > 0.82 ? 'Late' : 'Present';
      attendance.push({ id: uid('att'), date, classId: s.classId, sectionId: s.sectionId, studentId: s.id, status });
    });
  }

  const exams = [
    { id: 'exam_mid1', name: 'Mid-Term Exam', term: 'Term 1', year: '2026' },
    { id: 'exam_final1', name: 'Final Exam', term: 'Term 1', year: '2026' },
  ];

  const grades = [];
  students.forEach((s) => {
    subjPool.forEach((subj) => {
      // sectionId/classId are denormalized onto each grade record (rather
      // than looked up via the student) so Firestore Security Rules can
      // scope a teacher's access without an extra lookup — see
      // firestore.rules.
      grades.push({ id: uid('grd'), examId: 'exam_mid1', studentId: s.id, subjectId: subj, sectionId: s.sectionId, classId: s.classId, score: Math.floor(55 + Math.random() * 45), maxScore: 100 });
    });
  });

  const feeStructure = [
    { id: uid('fs'), classId: 'cls_9', term: 'Term 1', label: 'Tuition Fee', amount: 250 },
    { id: uid('fs'), classId: 'cls_9', term: 'Term 1', label: 'Library & ICT Fee', amount: 40 },
    { id: uid('fs'), classId: 'cls_10', term: 'Term 1', label: 'Tuition Fee', amount: 300 },
    { id: uid('fs'), classId: 'cls_10', term: 'Term 1', label: 'Library & ICT Fee', amount: 40 },
  ];

  const invoices = [];
  students.forEach((s) => {
    const structs = feeStructure.filter(f => f.classId === s.classId);
    structs.forEach((f) => {
      const paid = Math.random() > 0.4;
      invoices.push({
        id: uid('inv'), studentId: s.id, term: f.term, year: '2026', label: f.label,
        amount: f.amount, dueDate: '2026-09-15',
        paidAmount: paid ? f.amount : (Math.random() > 0.5 ? Math.round(f.amount * 0.5) : 0),
        paidDate: paid ? '2026-08-05' : '', method: paid ? 'Cash' : '',
      });
    });
  });

  const users = [
    { id: uid('usr'), name: 'System Administrator', username: 'admin', password: 'admin123', role: 'admin', email: 'admin@brightwood.edu', linkedId: null },
    { id: uid('usr'), name: 'James Brown', username: 'jbrown', password: 'teach123', role: 'teacher', email: 'jbrown@brightwood.edu', linkedId: 'tch_1' },
    { id: uid('usr'), name: 'Grace Kollie', username: 'gkollie', password: 'teach123', role: 'teacher', email: 'gkollie@brightwood.edu', linkedId: 'tch_2' },
    { id: uid('usr'), name: firstNames[0] + ' ' + lastNames[0] + ' (Parent)', username: 'student1', password: 'stud123', role: 'student', email: '', linkedId: students[0].id },
  ];

  return {
    meta: { schoolName: 'Brightwood High School', currentTerm: 'Term 1', currentYear: '2026', address: 'Monrovia, Liberia', updatedAt: new Date().toISOString() },
    subjects, teachers, classes, students, timetable, attendance, exams, grades, feeStructure, invoices, users,
  };
}

/* ---------------------------- DB Object -------------------------------- */

const DB = {
  data: null,

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { this.data = JSON.parse(raw); return this.data; } catch (e) { console.warn('Corrupt local data, reseeding.', e); }
    }
    this.data = seedData();
    this.save();
    return this.data;
  },

  save() {
    this.data.meta.updatedAt = new Date().toISOString();
    // Firebase mode (when connected) is the source of truth — push the
    // in-memory change there and let its real-time listener re-render.
    // Local storage is still written too, so the app has something to show
    // immediately on next load and while offline/signed out.
    if (typeof FB !== 'undefined' && FB.active) FB.pushAll(this.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    document.dispatchEvent(new CustomEvent('hsms:data-changed'));
  },

  replaceAll(newData) {
    // See resetToSeed() — don't let an imported/restored backup clobber the
    // real Firebase-synced login accounts.
    const preserveUsers = (typeof FB !== 'undefined' && FB.active) ? this.data.users : null;
    this.data = newData;
    if (preserveUsers) this.data.users = preserveUsers;
    this.save();
  },

  resetToSeed() {
    // In Firebase mode, `users` is real login accounts synced from
    // Firestore (not part of the write-through in FB.pushAll) — keep them
    // intact rather than replacing them with the local demo accounts.
    const preserveUsers = (typeof FB !== 'undefined' && FB.active) ? this.data.users : null;
    this.data = seedData();
    if (preserveUsers) this.data.users = preserveUsers;
    this.save();
  },

  add(collection, obj) {
    obj.id = obj.id || uid(collection.slice(0, 3));
    this.data[collection].push(obj);
    this.save();
    return obj;
  },

  update(collection, id, patch) {
    const arr = this.data[collection];
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    this.save();
    return arr[idx];
  },

  remove(collection, id) {
    this.data[collection] = this.data[collection].filter(x => x.id !== id);
    this.save();
  },

  find(collection, id) {
    return this.data[collection].find(x => x.id === id) || null;
  },

  /* ---------------------- Convenience lookups ---------------------- */

  className(classId) {
    const c = this.data.classes.find(c => c.id === classId);
    return c ? c.name : '—';
  },
  sectionName(classId, sectionId) {
    const c = this.data.classes.find(c => c.id === classId);
    if (!c) return '—';
    const s = c.sections.find(s => s.id === sectionId);
    return s ? s.name : '—';
  },
  classSectionLabel(classId, sectionId) {
    return `${this.className(classId)} - ${this.sectionName(classId, sectionId)}`;
  },
  allSections() {
    const out = [];
    this.data.classes.forEach(c => c.sections.forEach(s => out.push({ classId: c.id, className: c.name, sectionId: s.id, sectionName: s.name, classTeacherId: s.classTeacherId })));
    return out;
  },
  subjectName(id) {
    const s = this.data.subjects.find(s => s.id === id);
    return s ? s.name : '—';
  },
  teacherName(id) {
    const t = this.data.teachers.find(t => t.id === id);
    return t ? `${t.firstName} ${t.lastName}` : '—';
  },
  studentName(id) {
    const s = this.data.students.find(s => s.id === id);
    return s ? `${s.firstName} ${s.lastName}` : '—';
  },
  studentsInSection(sectionId) {
    return this.data.students.filter(s => s.sectionId === sectionId);
  },
  studentsInClass(classId) {
    return this.data.students.filter(s => s.classId === classId);
  },

  attendanceRateFor(studentId) {
    const recs = this.data.attendance.filter(a => a.studentId === studentId);
    if (!recs.length) return null;
    const present = recs.filter(r => r.status === 'Present' || r.status === 'Late').length;
    return Math.round((present / recs.length) * 100);
  },

  overallAttendanceRate(dateFrom, dateTo) {
    let recs = this.data.attendance;
    if (dateFrom) recs = recs.filter(r => r.date >= dateFrom);
    if (dateTo) recs = recs.filter(r => r.date <= dateTo);
    if (!recs.length) return 0;
    const present = recs.filter(r => r.status === 'Present' || r.status === 'Late').length;
    return Math.round((present / recs.length) * 100);
  },

  studentAverage(studentId, examId) {
    const recs = this.data.grades.filter(g => g.studentId === studentId && (!examId || g.examId === examId));
    if (!recs.length) return null;
    const pct = recs.map(r => (r.score / r.maxScore) * 100);
    return Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
  },

  gradeLetter(pct) {
    if (pct === null || pct === undefined) return '—';
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  },

  invoicesForStudent(studentId) {
    return this.data.invoices.filter(i => i.studentId === studentId);
  },
  balanceFor(studentId) {
    return this.invoicesForStudent(studentId).reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
  },
  totalCollected() {
    return this.data.invoices.reduce((s, i) => s + i.paidAmount, 0);
  },
  totalBilled() {
    return this.data.invoices.reduce((s, i) => s + i.amount, 0);
  },
};
