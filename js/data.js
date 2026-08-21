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

  const announcements = [
    { id: uid('ann'), title: 'Welcome back for Term 1!', body: 'We are excited to start the new term. Please make sure all fee invoices are settled by the due date.', audience: 'All', sectionId: '', classId: '', pinned: true, date: '2026-08-11', postedByName: 'System Administrator', createdBy: '' },
    { id: uid('ann'), title: 'Staff Meeting Reminder', body: 'Monthly staff meeting in the main hall, Friday at 3:30pm.', audience: 'Teachers', sectionId: '', classId: '', pinned: false, date: '2026-08-12', postedByName: 'System Administrator', createdBy: '' },
    { id: uid('ann'), title: 'Grade 9A: Bring Lab Coats', body: 'Please bring your lab coats for Wednesday\'s science practical.', audience: 'Section', sectionId: 'sec_9a', classId: 'cls_9', pinned: false, date: '2026-08-13', postedByName: 'James Brown', createdBy: '' },
  ];

  const assignments = [
    { id: uid('asg'), title: 'Algebra Worksheet 3', description: 'Complete exercises 1-20 on quadratic equations.', subjectId: 'sub_math', sectionId: 'sec_9a', classId: 'cls_9', teacherId: 'tch_1', dueDate: '2026-08-25', createdAt: '2026-08-13' },
    { id: uid('asg'), title: 'Essay: My Community', description: 'A 500-word essay, handwritten or typed.', subjectId: 'sub_eng', sectionId: 'sec_9b', classId: 'cls_9', teacherId: 'tch_2', dueDate: '2026-08-18', createdAt: '2026-08-11' },
    { id: uid('asg'), title: 'Lab Report: Photosynthesis', description: 'Write up last week\'s experiment following the standard lab report format.', subjectId: 'sub_sci', sectionId: 'sec_10a', classId: 'cls_10', teacherId: 'tch_3', dueDate: '2026-08-22', createdAt: '2026-08-14' },
    { id: uid('asg'), title: 'Spreadsheet Basics', description: 'Complete the ICT workbook chapter 2 exercises.', subjectId: 'sub_ict', sectionId: 'sec_10b', classId: 'cls_10', teacherId: 'tch_4', dueDate: '2026-08-16', createdAt: '2026-08-09' },
  ];

  const behaviorLogs = [
    { id: uid('beh'), studentId: students[0].id, sectionId: students[0].sectionId, classId: students[0].classId, type: 'Merit', points: 5, description: 'Helped a classmate with homework.', date: '2026-08-12', recordedByName: 'James Brown' },
    { id: uid('beh'), studentId: students[1].id, sectionId: students[1].sectionId, classId: students[1].classId, type: 'Demerit', points: -5, description: 'Late to class without a valid reason.', date: '2026-08-13', recordedByName: 'James Brown' },
    { id: uid('beh'), studentId: students[6]?.id || students[0].id, sectionId: (students[6] || students[0]).sectionId, classId: (students[6] || students[0]).classId, type: 'Merit', points: 5, description: 'Excellent participation in class discussion.', date: '2026-08-14', recordedByName: 'Grace Kollie' },
  ];

  const books = [
    { id: uid('bk'), title: 'Things Fall Apart', author: 'Chinua Achebe', isbn: '978-0385474542', category: 'Fiction', copiesTotal: 4 },
    { id: uid('bk'), title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '978-0553380163', category: 'Science', copiesTotal: 2 },
    { id: uid('bk'), title: 'Introduction to Algebra', author: 'Richard Rusczyk', isbn: '978-1934124149', category: 'Mathematics', copiesTotal: 5 },
    { id: uid('bk'), title: 'The Story of Liberia', author: 'C. Abayomi Cassell', isbn: '978-0000000001', category: 'History', copiesTotal: 3 },
    { id: uid('bk'), title: 'Practical Computing', author: 'Miatta Freeman', isbn: '978-0000000002', category: 'ICT', copiesTotal: 3 },
  ];

  const loans = [
    { id: uid('ln'), bookId: books[0].id, studentId: students[0].id, checkoutDate: '2026-08-05', dueDate: '2026-08-19', returnDate: '' },
    { id: uid('ln'), bookId: books[2].id, studentId: students[1].id, checkoutDate: '2026-07-28', dueDate: '2026-08-11', returnDate: '' },
    { id: uid('ln'), bookId: books[1].id, studentId: students[2]?.id || students[0].id, checkoutDate: '2026-07-20', dueDate: '2026-08-03', returnDate: '2026-08-02' },
  ];

  const events = [
    { id: uid('evt'), title: 'Mid-Term Exams Begin', description: 'Mid-term exams run for the full week.', date: '2026-08-24', endDate: '2026-08-28', type: 'Exam', audience: 'All' },
    { id: uid('evt'), title: 'Founders Day Holiday', description: 'School closed for the public holiday.', date: '2026-09-03', endDate: '', type: 'Holiday', audience: 'All' },
    { id: uid('evt'), title: 'Parent-Teacher Meeting', description: 'Term 1 progress discussion with parents.', date: '2026-09-10', endDate: '', type: 'Meeting', audience: 'All' },
    { id: uid('evt'), title: 'Inter-House Sports Day', description: 'Annual sports competition on the school field.', date: '2026-09-18', endDate: '', type: 'Event', audience: 'All' },
    { id: uid('evt'), title: 'Staff Development Workshop', description: 'Teaching methods refresher, mandatory for all staff.', date: '2026-08-21', endDate: '', type: 'Meeting', audience: 'Teachers' },
  ];

  const users = [
    { id: uid('usr'), name: 'System Administrator', username: 'admin', password: 'admin123', role: 'admin', email: 'admin@brightwood.edu', linkedId: null },
    { id: uid('usr'), name: 'James Brown', username: 'jbrown', password: 'teach123', role: 'teacher', email: 'jbrown@brightwood.edu', linkedId: 'tch_1' },
    { id: uid('usr'), name: 'Grace Kollie', username: 'gkollie', password: 'teach123', role: 'teacher', email: 'gkollie@brightwood.edu', linkedId: 'tch_2' },
    { id: uid('usr'), name: firstNames[0] + ' ' + lastNames[0] + ' (Parent)', username: 'student1', password: 'stud123', role: 'student', email: '', linkedId: students[0].id },
  ];

  // Mirrors what FB.adminCreateAccount() denormalizes onto teachers/students
  // when a real account is created via Firebase Sync (see firebase-sync.js
  // for why: a teacher/student can't read someone else's users/{uid} doc
  // under the real security rules, so Messages needs this link stored
  // somewhere both sides CAN read). Keeping the seed data consistent with
  // that means messaging behaves the same in local-storage demo mode as it
  // does on live Firebase, instead of only being exercised in one of them.
  users.forEach((u) => {
    if (u.role === 'teacher' && u.linkedId) {
      const t = teachers.find(x => x.id === u.linkedId);
      if (t) t.userId = u.id;
    } else if (u.role === 'student' && u.linkedId) {
      const s = students.find(x => x.id === u.linkedId);
      if (s) s.parentUserId = u.id;
    }
  });

  // A couple of sample payment submissions so the admin verification queue
  // isn't empty on first look — one still pending, one already verified.
  const paymentSubmissions = [];
  if (invoices.length) {
    const inv0 = invoices[0];
    paymentSubmissions.push({
      id: uid('pay'), invoiceId: inv0.id, studentId: inv0.studentId, method: 'Orange Money',
      amount: inv0.amount, reference: 'OM-778234561', note: 'Paid the full tuition fee.',
      submittedAt: '2026-08-14', status: 'Pending', reviewedBy: '', reviewNote: '', reviewedAt: '',
    });
  }
  if (invoices.length > 3) {
    const inv1 = invoices[3];
    paymentSubmissions.push({
      id: uid('pay'), invoiceId: inv1.id, studentId: inv1.studentId, method: 'Bank Transfer',
      amount: inv1.amount, reference: 'TRX-88213', note: '',
      submittedAt: '2026-08-10', status: 'Verified', reviewedBy: 'System Administrator', reviewNote: 'Confirmed in bank statement.', reviewedAt: '2026-08-11',
    });
  }

  // A sample teacher <-> parent conversation so the Messages inbox isn't
  // empty on first look — James Brown (class teacher of sec_9a) messaging
  // the parent of students[0], who is in that section.
  const messages = [];
  if (users[1] && users[3] && students[0]) {
    const threadId = [users[1].id, users[3].id].sort().join('__');
    messages.push({
      id: uid('msg'), threadId, fromUserId: users[1].id, fromName: users[1].name, fromRole: 'teacher',
      toUserId: users[3].id, toName: users[3].name, studentId: students[0].id,
      body: `Hi! Just a note that ${students[0].firstName} did great in today's math quiz. Keep encouraging the practice at home!`,
      sentAt: '2026-08-13T09:15:00.000Z', readBy: [users[1].id, users[3].id],
    });
    messages.push({
      id: uid('msg'), threadId, fromUserId: users[3].id, fromName: users[3].name, fromRole: 'student',
      toUserId: users[1].id, toName: users[1].name, studentId: students[0].id,
      body: 'Thank you so much for letting me know — we really appreciate it!',
      sentAt: '2026-08-13T14:40:00.000Z', readBy: [users[3].id],
    });
  }

  // A couple of sample exam timetable slots so the module isn't empty —
  // the mid-term exam for Math and English in sec_9a.
  const examSchedule = [];
  if (students.length) {
    examSchedule.push({ id: uid('exs'), examId: 'exam_mid1', subjectId: 'sub_math', classId: 'cls_9', sectionId: 'sec_9a', date: '2026-08-24', startTime: '08:00', endTime: '09:30', room: 'Hall A' });
    examSchedule.push({ id: uid('exs'), examId: 'exam_mid1', subjectId: 'sub_eng', classId: 'cls_9', sectionId: 'sec_9a', date: '2026-08-25', startTime: '08:00', endTime: '09:30', room: 'Hall A' });
  }
  const examSeating = [];

  // A sample homework submission so the teacher's review screen isn't empty.
  const submissions = [];
  if (assignments[0] && students[0]) {
    submissions.push({
      id: uid('sub'), assignmentId: assignments[0].id, studentId: students[0].id, sectionId: assignments[0].sectionId,
      note: 'Completed all 20 problems — attached my working.', attachType: 'none', attachValue: '',
      submittedAt: '2026-08-14T18:20:00.000Z', status: 'Submitted', feedback: '', reviewedAt: '',
    });
  }

  return {
    meta: {
      schoolName: 'Brightwood High School', currentTerm: 'Term 1', currentYear: '2026', address: 'Monrovia, Liberia', updatedAt: new Date().toISOString(),
      // Payment destination details shown to parents on the "Pay Now" screen —
      // configured by the admin under Backup & Sync -> Payment Settings. Left
      // blank by default; the app hides a method until its details are filled in.
      orangeMoneyNumber: '0770-123-456', orangeMoneyName: 'Brightwood High School',
      mtnMoMoNumber: '0880-654-321', mtnMoMoName: 'Brightwood High School',
      bankName: 'Liberia Bank for Development & Investment (LBDI)', bankAccountName: 'Brightwood High School',
      bankAccountNumber: '0012-345678-01', bankBranch: 'Broad Street, Monrovia',
      paymentInstructions: 'Please include your child\'s full name and admission number as the payment reference/note.',
    },
    subjects, teachers, classes, students, timetable, attendance, exams, grades, feeStructure, invoices, users,
    announcements, assignments, behaviorLogs, books, loans, events, paymentSubmissions, messages,
    examSchedule, examSeating, submissions,
  };
}

/* ---------------------------- DB Object -------------------------------- */

const DB = {
  data: null,

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { this.data = JSON.parse(raw); this._migrate(); return this.data; } catch (e) { console.warn('Corrupt local data, reseeding.', e); }
    }
    this.data = seedData();
    this.save();
    return this.data;
  },

  // Backfills any collections added in later app versions (e.g. announcements,
  // assignments, behaviorLogs, books, loans, events) onto data saved by an
  // older version of the app, so existing browsers/backups don't crash on
  // the newer modules.
  _migrate() {
    ['announcements', 'assignments', 'behaviorLogs', 'books', 'loans', 'events', 'paymentSubmissions', 'messages', 'examSchedule', 'examSeating', 'submissions'].forEach((col) => {
      if (!Array.isArray(this.data[col])) this.data[col] = [];
    });
    const metaDefaults = {
      orangeMoneyNumber: '', orangeMoneyName: '', mtnMoMoNumber: '', mtnMoMoName: '',
      bankName: '', bankAccountName: '', bankAccountNumber: '', bankBranch: '', paymentInstructions: '',
    };
    this.data.meta = Object.assign({}, metaDefaults, this.data.meta || {});

    // Backfill the userId/parentUserId link Messages relies on (see
    // messages.js) for accounts created before that link started being
    // written automatically. Local-storage-only path — the equivalent
    // backfill for existing Firebase-synced schools is
    // FB.backfillMessagingLinks() in firebase-sync.js.
    (this.data.users || []).forEach((u) => {
      if (u.role === 'teacher' && u.linkedId) {
        const t = (this.data.teachers || []).find(x => x.id === u.linkedId);
        if (t && !t.userId) t.userId = u.id;
      } else if (u.role === 'student' && u.linkedId) {
        const s = (this.data.students || []).find(x => x.id === u.linkedId);
        if (s && !s.parentUserId) s.parentUserId = u.id;
      }
    });
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
    this._migrate();
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
