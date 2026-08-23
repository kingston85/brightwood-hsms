# Brightwood HSMS — High School Management System

A complete, professional school management web app: students, teachers,
classes & timetables, attendance, gradebook & report cards, finance/fees,
role-based logins (Admin / Teacher / Student-Parent), and an optional live,
shared Firebase backend (or Google Drive backup) so everyone sees the same
data. Runs entirely in the browser — no server to install unless you opt
into Firebase. Works comfortably on a phone or tablet as well as a desktop.

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
- **Subjects** — admin manages the school's subject list (name + subject
  code, with duplicate-code validation), used throughout timetables,
  gradebook and exam scheduling; a subject in use shows how many
  timetable/exam records reference it before it can be deleted.
- **Classes & Timetable** — manage grade levels and sections, assign a
  class teacher to each section, and build/edit a weekly timetable per
  section (with print support).
- **Exam Timetable & Seating** — admin builds a per-exam schedule (date,
  time, subject, section, room) that teachers and students see filtered to
  their own section; a seating chart can be auto-generated per
  exam/section (alphabetical, configurable seats-per-row) and printed.
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
  A backup reminder tracks when data was last actually backed up anywhere
  and, on admin login, either quietly backs up to Drive if it's already
  connected and overdue, or shows a dismissible banner with one-click
  backup options if it isn't.
- **Firebase self-diagnostics** (Admin, when Firebase Sync is set up) — a
  one-click check under Settings walks through config, sign-in, role,
  per-collection read access and a live write/delete round-trip, and
  explains any problem in plain English instead of "see console."
- **Email Notifications** (optional, requires Firebase Sync) — parents/
  guardians can automatically get an email when a teacher sends them a
  message, marks their child's homework reviewed, or a submitted payment
  is confirmed or rejected (see "Email Notifications" below).
- **Announcements / Notice Board** — post school-wide, teachers-only,
  students-only, or a specific-section notice; pin important ones to the
  top. Everyone sees what's relevant to their role/section, and the latest
  ones also show up right on the Dashboard.
- **Assignments / Homework** — teachers post assignments per subject and
  section with a due date; students see exactly what's due for their own
  section, with overdue items flagged in red and a "Due Soon" warning for
  anything due within 3 days. Students submit their work directly in the
  app — a note plus either a photo (compressed client-side to stay small)
  or a link — and teachers see a submission count per assignment, review
  each one, leave feedback and mark it reviewed.
- **Messaging** — a private inbox between a teacher and the
  parent/guardian of each student in their section (and vice versa), with
  unread counts and a two-pane chat view; admin can read messages for
  safeguarding oversight.
- **Notifications** — a bell in the header aggregates what's new and
  relevant to your role (new messages, posted assignments, graded work,
  payment status changes, announcements, upcoming dues) with an unread
  badge and click-through to the right page.
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
  cards (photo-style initials avatar, name, class/section, admission no.,
  and a scannable QR code) for the current filtered list, or print a clean
  class-list report; both reuse the same print-friendly styling as report
  cards and timetables.
- **QR Codes for Attendance & Library** — every student ID card and library
  book label carries a QR code; the **QR Scanner** page (camera-based, with
  a manual-lookup and USB-scanner-gun fallback for devices without a
  webcam) scans a student's card to mark them present in one tap, or a book
  label to check it in/out — see "QR Codes" below.
- **Language (English/French scaffold)** — a switcher on the login screen
  and sidebar translates the app's always-on-screen chrome (nav, login,
  page titles); a starting point for full translation, not complete
  coverage — see "Language" below.
- **Online Fee Payment** — students/parents can pay an invoice two ways:
  **Mobile Money (Orange Money / MTN MoMo) or Bank Transfer**, where they
  submit a reference number after sending the money and an admin verifies
  it against the real account before it counts (works immediately, no
  setup — see "Payment Settings" below); and, optionally, **Card / Google
  Pay** via a real Stripe checkout that updates the invoice automatically
  (requires a one-time backend setup — see "Card & Google Pay Setup"
  below, including an important note for schools based in Liberia).

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

### Email Notifications (optional, requires Firebase Setup above)

Once Firebase Sync is on, the app can automatically email parents/guardians
when something happens that they'd want to know about without opening the
app: a new direct message from a teacher, a homework submission being
marked reviewed (with the teacher's feedback), or a submitted payment being
confirmed or rejected. It uses a guardian's email as recorded on the
student's record (**Students → Edit → Guardian Email**) — if that field is
blank, that student's notifications are silently skipped, nothing else is
affected.

The app never sends email directly (a browser can't do that safely) — it
writes a small "please send this" document to a `mail` collection in
Firestore, and Firebase's own official **Trigger Email from Firestore**
Extension watches that collection and does the actual sending through your
SMTP provider. One-time setup, about 10 minutes:

1. In the [Firebase Console](https://console.firebase.google.com/), open
   your project and go to **Build → Extensions → Explore extensions**,
   then find and install **Trigger Email from Firestore** (by Firebase).
2. During install, you'll be asked for SMTP connection details (host, port,
   username, password) and a default "from" address. Any SMTP provider
   works — a school Gmail account with an
   [App Password](https://support.google.com/accounts/answer/185833), or a
   transactional email service like SendGrid, Mailgun, or Brevo (all have
   free tiers plenty big enough for a school).
3. Set the **Collection path** the extension watches to `mail` — this must
   match exactly, since that's the collection name `js/firebase-sync.js`
   writes to.
4. Finish the install. From then on, any document the app writes to `mail`
   is picked up and sent automatically, usually within a few seconds — no
   further configuration or app changes needed.

The `firestore.rules` in this project already includes a `/mail/{id}` rule
that lets any signed-in user *create* a document there (so the app can
queue a notification), but nobody — not even an admin — can read, edit, or
delete one back out; only the Extension's own server-side access (which
bypasses these rules entirely) processes them. If you skip this setup, the
app still works exactly as before — the `mail` documents just accumulate
unsent in Firestore, harmless but doing nothing, until you either install
the Extension or periodically clear that collection out yourself.

### Push Notifications (optional, requires Firebase Setup + a deployed Cloud Function)

A step up from email: a real browser/OS notification, even when nobody has
the app open in a tab. It rides the same events as Email Notifications
(new message, homework reviewed, payment confirmed/rejected, fee overdue) —
no extra trigger points to configure — but needs its own one-time setup
since (unlike email) there's no ready-made Extension for it:

1. In the [Firebase Console](https://console.firebase.google.com/), go to
   **Project settings → Cloud Messaging → Web Push certificates** and
   generate a key pair. Copy the key.
2. Open `js/push.js` and paste it in as `VAPID_KEY`.
3. Deploy the Cloud Functions in this project (the same step Card/Google
   Pay payments use — see "Card & Google Pay Setup" below):
   ```
   cd functions && npm install && firebase deploy --only functions
   ```
   This adds one more function, `sendPushOnMail`, alongside the Stripe one
   — if you've already deployed for Stripe, just redeploy.
4. Publish the updated `firestore.rules` (adds a `/pushTokens/{uid}` rule).
5. Reload the app. Each person who wants push notifications on a given
   device signs in and clicks **Settings → Push Notifications → Enable
   Push Notifications** once on that device/browser (this has to be a
   real click — browsers block permission prompts that aren't a direct
   response to one). It stays on for that device until they turn it off or
   deliberately clear site data.

Without this setup, the app works exactly as before — notifications just
go out by email only. A `firebase-messaging-sw.js` file at the project
root is required by Firebase Cloud Messaging to be at exactly that path;
if you ever change the Firebase project this app points to, update the
config duplicated near the top of that file to match (a service worker
can't read `js/firebase-sync.js` directly, so it's a small, deliberate
duplication — the comment in the file points this out too).

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

### Backup reminders

Whoever's browser this app runs in keeps track of the last time its data
was actually backed up somewhere else — a Drive push or a downloaded
`.json` file both count. Each time an admin signs in, the app checks that
timestamp: if Drive is already connected and it's been more than 7 days,
it quietly backs up to Drive on its own and lets you know with a toast; if
it's been more than 7 days and Drive isn't connected, a dismissible amber
banner appears at the top of the screen with one-click buttons to connect
Drive or download a backup file. Dismissing the banner only clears it for
that sign-in — it comes back next login until an actual backup happens.
This is separate from the "auto-saves every 2 minutes while connected"
behavior above, which only runs while Drive is already connected in that
same browser tab; the reminder exists for the far more common case of a
school that hasn't connected Drive at all, or whose admin only opens the
app occasionally. **Settings → Google Drive Sync** always shows the exact
last-backup time.

### Install as an app (works offline)

This app is a PWA (Progressive Web App) — on Chrome/Edge/Android an
**📲 Install App** button appears in the sidebar once the browser decides
the app qualifies (usually within a few seconds of your first visit);
clicking it adds a proper app icon to your home screen/desktop that opens
without browser chrome. On iPhone/iPad (Safari has no install prompt of its
own), use the Share button → **Add to Home Screen** instead.

Once installed (or even just visited once in a regular browser tab), the
app's own files are cached by a service worker (`sw.js`) so it still opens
with no internet connection at all — this app already stores its data in
local storage, so a school not using Firebase Sync can keep working
entirely offline. Firebase Sync itself, naturally, still needs a real
connection to actually sync; while offline it just resumes the moment the
connection comes back. If you edit any of the app's own files after
deploying, bump `CACHE_VERSION` at the top of `sw.js` so returning visitors
pick up the change instead of a stale cached copy.

### WhatsApp

Wherever a guardian's phone number appears (a student's profile, an unpaid
invoice, a message thread with a teacher), a **💬 WhatsApp** button opens
WhatsApp with a message already filled in, ready to send — no setup, no
account, no cost. It assumes a Liberian number when none is given a
country code (e.g. `0770-123-456`); a guardian outside Liberia should have
their number saved with its own country code already included.

This is a one-click deep link, not automatic sending — a person still has
to press send. Fully automatic WhatsApp messages (matching how the email
notifications work) would need a paid Meta WhatsApp Business API account
and a backend to call it, which is a substantially bigger undertaking; this
gets you most of the day-to-day convenience without that cost or setup.

### QR Codes

Two kinds of printable QR codes, and one page to scan them:

- **Student ID cards** (Students → Print ID Cards) each carry a QR code
  identifying that student.
- **Library book labels** (Library → Print Book Labels, one per title in
  the catalog — not per physical copy) each carry a QR code identifying
  that book. Print one and slip it inside the front cover of each copy.
- **QR Scanner** (its own page in the sidebar, and a "📷 Scan…" button on
  the Attendance and Library pages) opens the device camera and decodes
  codes as it sees them:
  - In **Attendance mode**, scanning a student's ID card marks them
    present for today, right there — handy for a quick line-up at the
    gate or classroom door.
  - In **Library mode**, scanning a book label shows who has it out (with
    a one-tap "Mark Returned"), or offers to check it out to a student
    picked from a dropdown if a copy is free; scanning a student's ID card
    instead shows their current loans, flagging anything overdue.

No camera, or a school hall too noisy/crowded to rely on one? Every mode
also has a manual fallback: a dropdown to pick the student/book by name and
click a button, and a plain text field that a cheap USB "barcode scanner"
(the kind that types the code like a keyboard, no drivers needed) can type
straight into.

QR decoding happens entirely on-device — nothing scanned is ever sent
anywhere. The QR encode/decode libraries are bundled locally in
`assets/vendor/` (not loaded from a CDN), so this all keeps working
offline; see `assets/vendor/LICENSES.md` for their open-source licenses.

### Language

A small English/French switcher — **EN | FR** — appears on the login
screen and in the sidebar footer once signed in. It's a **starting
scaffold, not full translation coverage**: it currently covers the
always-on-screen chrome — the login screen, the sidebar navigation and
section headings, the page title, and a couple of header controls — since
those are what every user sees regardless of role or page. The choice is
remembered per device (`localStorage`), so it doesn't need to be set again
next visit.

What it does **not** yet cover: the hundreds of labels, buttons, table
headers and messages generated inside each module (Students, Fees,
Grades, and so on) — those stay in English. Extending coverage is
additive, not a rewrite:

1. Wrap the string. For a static piece of HTML, add
   `data-i18n="some.key"` (translates the element's text),
   `data-i18n-placeholder="some.key"` (an input's placeholder), or
   `data-i18n-title="some.key"` (a `title` tooltip). For a string built in
   JavaScript, call `I18N.t('some.key', 'English fallback text')` in place
   of the literal string.
2. Add that key to **both** the `en` and `fr` blocks in `js/i18n.js`'s
   `I18N_DICT`. (`I18N.t()` gracefully falls back to English, then to the
   key itself, if a translation is missing — so a half-finished addition
   never shows a blank field, but it's still worth filling in both.)

No build step, and no other file needs to change — `I18N.applyStatic()`
re-sweeps the whole page for `data-i18n*` attributes on every language
switch. Adding a third language means adding one more block to
`I18N_DICT` (e.g. `es: { ... }`) — `I18N.renderSwitchers()` picks up
every key of `I18N_DICT` automatically, no separate list to update.

## Online Fee Payment

There are two independent ways parents can pay online — set up one or both.

### Payment Settings (Mobile Money / Bank Transfer) — works immediately

This needs no accounts, no API keys, and no deployment — it's a "submit and
verify" flow: the parent sends money the normal way (through their own
Orange Money / MTN Mobile Money app, or a bank transfer), then tells the
app they've paid; you confirm it once you actually see the money land.

1. Sign in as Admin, go to **Backup & Sync → Payment Settings**, and fill in
   whichever of Orange Money, MTN Mobile Money, and Bank Transfer details
   apply to your school (leave any section blank to hide that method from
   parents). Save.
2. From now on, a student/parent with an unpaid invoice sees a **Pay Now**
   button under **Finance & Fees**. It shows your payment details for
   whichever method they pick, and asks them to submit the amount sent and
   a reference/transaction number after they've actually paid.
3. That submission appears under **Finance & Fees → Pending Verification**
   for you (and shows as a badge on the sidebar and a banner on your
   dashboard). Check it against your real Orange Money/MTN/bank
   statement, then click **Approve** (which records the payment against
   the invoice) or **Reject** (with a reason the parent will see).

This is intentionally semi-manual — nobody can mark their own payment as
verified, only an admin can, which is what makes it trustworthy without
needing a real payment gateway integration.

### Card & Google Pay Setup (Stripe) — optional, requires a one-time backend setup

**Read this first if your school is based in Liberia:** Stripe (and every
major alternative — PayPal, Flutterwave, Paystack, DPO) does not currently
offer merchant accounts to businesses registered in Liberia. The common
workaround is incorporating a company abroad via
[Stripe Atlas](https://stripe.com/atlas) (or similar), which gives you a US
entity, bank account, and from there a normal Stripe account — this is a
real legal/business step, not a config change, and money settles to that
entity rather than directly inside Liberia. If that's not something you can
do right now, the Mobile Money / Bank Transfer flow above is fully
functional on its own and needs none of this.

If you do have (or can get) a Stripe account, here's the one-time setup.
This wires up a small serverless backend (Firebase Cloud Functions) because
real card payments need a secret key and a server-verified webhook — a
static site alone can't do this safely. About 20–30 minutes.

1. **Switch Firebase to the Blaze (pay-as-you-go) plan.** In the Firebase
   Console, click **Upgrade** (bottom of the left sidebar). This is
   required for Cloud Functions regardless of usage — but the free tier
   (2M function calls/month) comfortably covers a school's payment volume,
   so realistically this costs $0/month beyond Stripe's own per-transaction
   fee.
2. **Install the Firebase CLI** (one-time, needs [Node.js](https://nodejs.org)):
   ```
   npm install -g firebase-tools
   firebase login
   ```
3. **Point this project at your Firebase project.** Open `.firebaserc` in
   the project root and replace `YOUR_FIREBASE_PROJECT_ID` with your real
   Project ID (Firebase Console → gear icon → Project settings → General —
   it's the **Project ID**, not the Project name).
4. **Get your Stripe secret key.** Stripe Dashboard → Developers → API keys
   → copy the **Secret key** (starts `sk_test_...` while you're testing).
   Then, from the project root:
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
   and paste it in when prompted.
5. **Install the function's dependencies and deploy:**
   ```
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
   The output will list a URL for `stripeWebhook`, something like
   `https://us-central1-yourproject.cloudfunctions.net/stripeWebhook` —
   copy it.
6. **Register the webhook in Stripe.** Stripe Dashboard → Developers →
   Webhooks → **Add endpoint** → paste that URL → select the
   `checkout.session.completed` event → **Add endpoint**. Stripe will show
   a **Signing secret** (starts `whsec_...`) — copy it too.
7. **Set the webhook secret and redeploy:**
   ```
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions
   ```
8. **(Recommended) Set your real app URL**, so Stripe sends parents back to
   the right place after paying: create a file `functions/.env` containing
   one line —
   ```
   APP_URL=https://yourschool.github.io/brightwood-hsms
   ```
   — then redeploy (`firebase deploy --only functions`) once more.
9. **Turn it on in the app.** Open `js/stripe-pay.js` and set:
   ```js
   const STRIPE_CONFIG = {
     ENABLED: true,
     FUNCTIONS_REGION: 'us-central1', // only change if you deployed elsewhere
   };
   ```
10. **Test it.** Reload the app, sign in as a student/parent with an unpaid
    invoice, click **Pay Now** — you'll now see a **"Pay instantly with
    Card or Google Pay"** button above the Mobile Money/Bank section. Use
    [Stripe's test card](https://docs.stripe.com/testing) `4242 4242 4242
    4242`, any future expiry date, any CVC. The invoice should update on
    its own within a few seconds (the webhook confirms the payment and the
    app's live Firestore listener picks it up automatically — no manual
    verification needed for card payments).

When you're ready to accept real money, repeat steps 4, 6 and 7 with your
Stripe **live** keys/webhook instead of test ones (test and live webhooks
are separate in Stripe) — everything else stays the same. Note this
integration charges in **USD** only; changing currency would need editing
`functions/index.js`.

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
- Mobile Money/Bank payments are parent-submitted claims, not verified
  transactions — the rules only let a student/parent create their own
  submission (always starting "Pending"), never approve one, so an invoice
  only updates once an admin confirms it against the real account. Card
  payments via Stripe are the one exception that updates automatically,
  and only because the Cloud Functions webhook verifies Stripe's signature
  server-side before writing anything — a client can't fake that.
- Whichever mode you use, this is still a browser-only app with no server
  of your own — for anything beyond what's described here (e.g. formal
  data-protection compliance, audit logging, multi-school tenancy), you'd
  want a real backend team to review the design.

## Customizing

- **School name, term/year, address**: Backup & Sync → School Information.
- **Sample data / starting point**: edit `seedData()` in `js/data.js`.
- **Colors/branding**: edit the `tailwind.config` block in `index.html`
  (the `brand` color scale) and the school name/initials in the header.
- **Subjects, grading scale, fee items**: subjects are managed entirely
  in-app under Subjects (Academics); the letter-grade cutoffs are in
  `DB.gradeLetter()` in `js/data.js`; fee items are managed entirely
  in-app under Finance & Fees → Fee Structure.

## Project structure

```
index.html            Shell: login screen, app layout, all <script> includes
manifest.json         PWA manifest (install as an app)
sw.js                 Service worker — offline app-shell caching
firebase-messaging-sw.js  Service worker required by push notifications (FCM)
firestore.rules       Security rules to paste into the Firebase Console
firebase.json          Cloud Functions deploy config (for Stripe payments)
.firebaserc             Points the Firebase CLI at your project (edit this)
functions/             Cloud Functions backend: Stripe Checkout + webhook + push
assets/vendor/         Vendored QR encode/decode libraries — see LICENSES.md there
css/style.css         Supplemental styles (Tailwind CDN handles the rest)
js/data.js            Data model, sample data, localStorage persistence, CRUD
js/drive.js           Google Drive OAuth + save/load, local JSON export/import
js/firebase-sync.js   Firebase Auth + Firestore real-time sync (write-through)
js/stripe-pay.js      Card/Google Pay checkout client (calls the Cloud Function)
js/auth.js            Login/session/role logic
js/ui.js              Shared UI helpers, routing/navigation, global search
js/i18n.js            Language scaffold (English/French) — see "Language" below
js/theme.js           Dark mode
js/pwa.js             Service worker registration + "Install app" prompt
js/push.js            Push notifications (FCM) client
js/qr.js              QR code encode helpers (ID cards, book labels)
js/qrscan.js          QR Scanner page (camera + manual/USB-scanner fallback)
js/students.js        Students module (CRUD, CSV import, ID cards, print)
js/alumni.js          Alumni tracking (graduated students)
js/teachers.js        Teachers module
js/staff.js           Staff attendance & leave module
js/subjects.js        Subjects module (CRUD, duplicate-code + in-use checks)
js/classes.js         Classes/Sections + Timetable module + Promotion
js/attendance.js      Attendance module
js/grades.js          Gradebook + Report Cards module
js/examSchedule.js    Exam Timetable + Seating Chart module
js/fees.js            Finance/Fees module + Pay Now + payment verification
js/announcements.js   Announcements / Notice Board module
js/messages.js        Teacher <-> parent messaging inbox
js/assignments.js     Assignments / Homework module + student submissions
js/behavior.js        Behavior / Discipline Log module
js/library.js         Library Management module (catalog + loans + book labels)
js/calendar.js        Events & School Calendar module
js/dashboard.js       Dashboard module (role-aware, with widgets)
js/users.js           User account management (Admin)
js/settings.js        School info, branding, backup/sync, reset (Admin)
js/auditlog.js        Audit Log (Admin)
js/notifications.js   Notification bell (aggregates + per-user "seen" cursor)
js/main.js            App bootstrap and shell wiring
```
