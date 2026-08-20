# Brightwood HSMS — High School Management System

A complete, professional school management web app: students, teachers,
classes & timetables, attendance, gradebook & report cards, finance/fees,
role-based logins (Admin / Teacher / Student-Parent), and an optional live,
shared Firebase backend (or Google Drive backup) so everyone sees the same
data. Runs entirely in the browser — no server to install unless you opt
into Firebase.

## Quick Start

1. Unzip the project and open the folder.
2. Because the app loads its own JS files, most browsers require it to be
   served over `http://` rather than opened directly as a `file://` path.
   The simplest way:
   - **Python:** `python3 -m http.server 8000` inside the project folder,
     then open `http://localhost:8000`.
   - **Node:** `npx serve .` inside the project folder.
   - Or upload the folder to any static host (GitHub Pages, Netlify,
     Vercel, cPanel, etc.) — see "Deploying" below.
3. Sign in with one of the demo accounts shown on the login screen:

   | Role            | Username  | PIN       |
   |-----------------|-----------|-----------|
   | Admin           | `admin`   | `admin123`|
   | Teacher         | `jbrown`  | `teach123`|
   | Student/Parent  | `student1`| `stud123` |

The app comes pre-loaded with realistic sample data (24 students, 4
teachers, 2 grade levels with 2 sections each, a timetable, attendance
history, exam grades, and fee invoices) so you can explore every screen
immediately. Wipe it and start fresh any time from **Backup & Sync → Reset
to Sample Data**, or just edit/delete the sample records as you go.

## What's included

- **Dashboard** — role-aware overview with enrollment, attendance-trend,
  gender-distribution and fee-collection charts (Admin), today's schedule
  and section summaries (Teacher), and personal attendance/grades/fees
  (Student/Parent).
- **Students** — full CRUD, search & filter by class/section, student
  profile with attendance rate, average score and fee balance at a glance.
- **Teachers** — staff records, subject specialty, class-teacher
  assignment.
- **Classes & Timetable** — manage grade levels and sections, assign a
  class teacher to each section, and build/edit a weekly timetable per
  section (with print support).
- **Attendance** — mark daily attendance per section with one click per
  student, plus a reporting view with present/late/absent/excused counts
  and attendance-rate per student.
- **Gradebook & Report Cards** — enter scores per exam/section/subject,
  and generate a printable, letter-graded report card for any student
  (or their own, if signed in as Student/Parent).
- **Finance & Fees** — a reusable fee structure per class/term, per-student
  invoices, payment recording (partial payments supported), outstanding
  balance reporting, and bulk invoice generation from the fee structure.
- **User Accounts** (Admin) — create logins for teachers and
  students/parents and link each to its Teacher/Student record, which is
  what scopes their view of the data.
- **Backup & Sync** (Admin) — download/restore a full JSON backup with no
  setup required, connect Google Drive for automatic cloud backup, or turn
  on Firebase Sync so every account shares one live database (see below).
- **Announcements / Notice Board** — post school-wide, teachers-only,
  students-only, or a specific-section notice; pin important ones to the
  top. Everyone sees what's relevant to their role/section, and the latest
  ones also show up right on the Dashboard.
- **Assignments / Homework** — teachers post assignments per subject and
  section with a due date; students see exactly what's due for their own
  section, with overdue items flagged in red and a "Due Soon" warning for
  anything due within 3 days.
- **Behavior / Discipline Log** — teachers record merits, demerits and
  incidents (with a points value and notes) for students in their sections;
  admin sees the full school-wide log, and each student/parent sees their
  own record with a running points total.
- **Library Management** — admin manages a book catalog (title, author,
  category, copies owned) and checks books in/out per student, with
  automatic availability counts and an overdue-loans view; students see the
  catalog and their own loan history.
- **Events & School Calendar** — admin schedules exams, holidays, meetings
  and general events on a shared month-grid calendar; everyone sees what's
  coming up, both on the Calendar page and as a Dashboard widget.
- **Global Search** — the search box in the header finds students, teachers,
  class sections and announcements as you type (scoped to what your role
  can see) — click a result to jump straight to it.
- **Student Promotion & Graduation** — move every student in a section to a
  new class/section in one click at the end of a term, or graduate a whole
  section out of the active roster at once.
- **Bulk CSV Import** — add many students at once from a CSV file (a
  downloadable template is provided), with a validation preview that flags
  any row referencing a class/section that doesn't exist before you commit.
- **ID Cards & Printable Reports** — generate a printable grid of student ID
  cards (photo-style initials avatar, name, class/section, admission no.)
  for the current filtered list, or print a clean class-list report; both
  reuse the same print-friendly styling as report cards and timetables.

## How data is stored

By default, all data lives in the browser's `localStorage` on the device
you're using — nothing leaves your machine, and no account or setup is
needed to start using the app. This is perfect for a single computer (e.g.
the school office) or for trying the app out. Local demo accounts
(`admin`/`jbrown`/`student1` from the table above) only work in this mode.

There are three ways to go further, in increasing order of capability:

1. **Manual backup file** (works immediately, no setup): **Backup & Sync →
   Download Backup**, then **Restore from File** on any other device
   running the same app. Good for occasional transfers, not live sharing.
2. **Google Drive sync** (automatic, one-time OAuth setup — see below): the
   app saves a single JSON file into *your own* Google Drive. Simplest
   cloud setup, but each signed-in Google user only sees their own copy of
   that file — it doesn't, by itself, give a teacher and an admin a shared
   live view of the same data (see "Security notes").
3. **Firebase Sync** (recommended if more than one person needs to see the
   same live data — see below): a real shared backend. Every admin,
   teacher, and student/parent account reads and writes the same Cloud
   Firestore database in real time, and *Firestore Security Rules* (not
   just this app's UI) enforce who can see and edit what.

You can set up Google Drive, Firebase, both, or neither — they're
independent, opt-in layers on top of the local-storage mode that always
works.

### Firebase Setup (recommended for more than one user)

This gives you real accounts (Firebase Authentication) and a shared,
real-time database (Cloud Firestore) — the closest thing to a "real" school
system this app can offer without you running your own server, and it's
free for a school-sized amount of data. One-time setup, about 15 minutes:

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
   and **Add project** (Google Analytics is optional — you can skip it).
2. **Build → Authentication → Get started**, then enable the
   **Email/Password** sign-in provider.
3. **Build → Firestore Database → Create database**. Choose a location
   close to your school and start in **production mode** (we'll publish
   proper rules in step 6).
4. In Firestore, manually create one document so the "first admin" signup
   works: click **Start collection**, collection ID `meta`, document ID
   `bootstrap`, and add a single field `adminCreated` of type **boolean**
   set to `false`. Save.
5. **Project settings (gear icon) → General → Your apps → Add app → Web**
   (the `</>` icon). Register the app (any nickname), skip the hosting
   step, and copy the `firebaseConfig` object it shows you.
6. Open `js/firebase-sync.js` in this project and paste your config in:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...',
   };
   ```
7. In the Firebase Console, go to **Firestore Database → Rules**, replace
   the contents with everything in `firestore.rules` from this project, and
   click **Publish**. This is what actually enforces role-based access —
   read the comments at the top of that file for how it works.
8. Reload the app. On the login screen, under **Shared Firebase Account**,
   click **First-time setup**, enter your name/email/password, and submit
   — this creates the one and only bootstrap admin account. (The rules
   only allow this once; anyone trying it again after that gets "an admin
   account already exists — please sign in instead".)
9. You're now signed in with live Firestore data (starts empty). Go to
   **Backup & Sync → Reset to Sample Data** if you'd like to try it out
   with the same realistic sample dataset the local demo uses, or head to
   **User Accounts** to create real teacher and student/parent logins —
   each teacher account lets you tick which sections they're allowed to
   access, which both drives the app's UI *and* is what the Firestore
   rules check on the server.

From here on, sign in with the **Shared Firebase Account** panel (not the
local demo tabs) to see and edit the live, shared data from any device.

### Connecting Google Drive

Google requires every app that uses Sign-In or Drive access to be
registered with your own free Google Cloud project — this is a one-time,
10-minute setup:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a new project (or use an existing one).
2. **APIs & Services → Enabled APIs → Enable APIs** and turn on the
   **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: choose **External**, fill in
   an app name and your email, and add your own Google account as a test
   user (this keeps it private while you use it).
4. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID** → Application type **Web application**.
   - Under **Authorized JavaScript origins**, add the exact URL you'll run
     the app from, e.g. `http://localhost:8000` or
     `https://yourschool.github.io`.
5. Copy the generated **Client ID** (it ends in
   `.apps.googleusercontent.com`).
6. Open `js/drive.js` in this project and paste it in:
   ```js
   const DRIVE_CONFIG = {
     CLIENT_ID: 'PASTE-YOUR-CLIENT-ID-HERE.apps.googleusercontent.com',
     ...
   };
   ```
7. Reload the app. Go to **Backup & Sync → Connect Google Drive** and sign
   in — the app will create (or find) `brightwood-hsms-data.json` in your
   Drive and keep it updated as you use the app (it also auto-saves every
   2 minutes while connected).

Without this setup, the app works fully using local storage and manual
backup/restore — Google Drive is an optional convenience layer, not a
requirement.

## Deploying so multiple people can use it

"Deploying" just means putting these files on any static web host so your
staff can reach it from a shared URL: GitHub Pages, Netlify, Vercel, or
your school's own web hosting all work — just upload the whole folder
(Firestore/Firebase Auth are called directly from the browser, so no
server-side code is needed even in Firebase mode). If you set up Google
Drive sync or Firebase Authentication, remember to add that hosting URL:
- Google Cloud Console → your OAuth client → **Authorized JavaScript
  origins**.
- Firebase Console → Authentication → Settings → **Authorized domains**.

## Security notes — please read before wider use

**Local demo mode** (no Firebase configured) is designed for a **trusted
environment** — a school office computer, staff room network, or similar —
not for exposure on the open internet with sensitive student data:

- Login PINs are stored in plain text inside the local data file for
  simplicity, and there is no password hashing, rate-limiting, or
  server-side verification. Anyone with access to the browser's storage
  (or the JSON backup file) can read them.
- Role checks happen entirely in the browser, so a technically determined
  user could bypass them by editing local data.
- Google Drive sync uses your personal Google account's own Drive; each
  signed-in Google user only ever sees the one file *they* created, so
  it does not, by itself, give a teacher access to data an admin entered
  under a different Google account.

**Firebase Sync mode** addresses both of those: real Firebase
Authentication (hashed passwords, handled by Google's infrastructure, not
this app) plus Firestore Security Rules that are enforced *on Google's
servers*, not in the browser — so a user genuinely cannot read or write
data the rules don't allow them to, no matter what they do in the browser's
dev tools. A few things worth knowing even so:

- The rules in `firestore.rules` are a solid starting point written for
  this app's data model, not a formally audited security artifact — for
  anything beyond a single school's own trusted staff/families, have
  someone review them (the Firebase Console's Rules Playground is a good
  way to test specific scenarios before relying on it).
- A teacher's access is scoped by the "Assigned Sections" you set on their
  account (User Accounts → edit their profile) — keep that current as
  teaching assignments change.
- Deleting a user account in this app removes their Firestore profile
  (revoking app access immediately), but the underlying Firebase Auth
  login isn't deleted from the client for security reasons — if you want
  it fully removed, delete it from Firebase Console → Authentication too.
- Whichever mode you use, this is still a browser-only app with no server
  of your own — for anything beyond what's described here (e.g. formal
  data-protection compliance, audit logging, multi-school tenancy), you'd
  want a real backend team to review the design.

## Customizing

- **School name, term/year, address**: Backup & Sync → School Information.
- **Sample data / starting point**: edit `seedData()` in `js/data.js`.
- **Colors/branding**: edit the `tailwind.config` block in `index.html`
  (the `brand` color scale) and the school name/initials in the header.
- **Subjects, grading scale, fee items**: subjects live in
  `js/data.js` → `seedData().subjects`; the letter-grade cutoffs are in
  `DB.gradeLetter()` in the same file; fee items are managed entirely
  in-app under Finance & Fees → Fee Structure.

## Project structure

```
index.html           Shell: login screen, app layout, all <script> includes
firestore.rules       Security rules to paste into the Firebase Console
css/style.css         Supplemental styles (Tailwind CDN handles the rest)
js/data.js            Data model, sample data, localStorage persistence, CRUD
js/drive.js           Google Drive OAuth + save/load, local JSON export/import
js/firebase-sync.js   Firebase Auth + Firestore real-time sync (write-through)
js/auth.js            Login/session/role logic
js/ui.js              Shared UI helpers, routing/navigation, global search
js/students.js        Students module (CRUD, CSV import, ID cards, print)
js/teachers.js        Teachers module
js/classes.js         Classes/Sections + Timetable module + Promotion
js/attendance.js      Attendance module
js/grades.js          Gradebook + Report Cards module
js/fees.js            Finance/Fees module
js/announcements.js   Announcements / Notice Board module
js/assignments.js     Assignments / Homework module
js/behavior.js        Behavior / Discipline Log module
js/library.js         Library Management module (catalog + loans)
js/calendar.js        Events & School Calendar module
js/dashboard.js       Dashboard module (role-aware, with widgets)
js/users.js           User account management (Admin)
js/settings.js        School info, backup/sync, reset (Admin)
js/main.js            App bootstrap and shell wiring
```
