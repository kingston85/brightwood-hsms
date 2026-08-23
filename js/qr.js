/* ==========================================================================
   Brightwood HSMS — QR code helpers (shared by ID cards, library labels,
   and the camera scanner in js/qrscan.js).

   Encoding uses the vendored `qrcode` library (assets/vendor/qrcode.min.js,
   global `QRCode`); decoding uses the vendored `jsQR` library
   (assets/vendor/jsQR.min.js, global `jsQR`). Both are bundled locally —
   not loaded from a CDN — so QR codes keep working fully offline, and
   nothing scanned is ever sent anywhere; it's all decoded on-device.
   See assets/vendor/LICENSES.md for their license/source.
   ========================================================================== */

// Our own compact scheme: "bwhsms:student:<id>" / "bwhsms:book:<id>".
// Deliberately not a URL — these codes are meant to be scanned by this app
// only, and a plain custom scheme keeps the payload short (denser codes
// scan more reliably from a small/cheap camera than long ones).
const QR_PREFIX = 'bwhsms:';

function qrStudentPayload(studentId) { return `${QR_PREFIX}student:${studentId}`; }
function qrBookPayload(bookId) { return `${QR_PREFIX}book:${bookId}`; }

// Returns { type: 'student'|'book', id } or null if `text` isn't one of
// ours (e.g. someone scans an unrelated QR code by mistake).
function parseQrPayload(text) {
  if (typeof text !== 'string' || !text.startsWith(QR_PREFIX)) return null;
  const rest = text.slice(QR_PREFIX.length);
  const i = rest.indexOf(':');
  if (i < 1) return null;
  const type = rest.slice(0, i);
  const id = rest.slice(i + 1);
  if (!id || (type !== 'student' && type !== 'book')) return null;
  return { type, id };
}

// Renders an inline <svg> QR code into a DOM element. Async (the vendored
// encoder is Promise-based) — fire-and-forget is fine since this is purely
// cosmetic and a slow/failed render just leaves that one slot blank rather
// than breaking the page.
async function renderQrInto(el, text, opts) {
  if (!el || typeof QRCode === 'undefined') return;
  try {
    const svg = await QRCode.toString(text, Object.assign({ type: 'svg', margin: 1, width: 120 }, opts));
    el.innerHTML = svg;
  } catch (e) {
    console.error('QR render failed:', e);
  }
}

// Call once after inserting a batch of placeholder elements shaped like
// <div class="qr-slot" data-qr="bwhsms:student:123" data-qr-width="140"></div>
// — finds every [data-qr] under `root` (default: whole document) and fills
// each one in. Used by ID card printing and library book labels, where the
// surrounding cards are built as one big HTML string for speed and the QR
// codes are filled in afterward.
function renderAllQrSlots(root) {
  (root || document).querySelectorAll('[data-qr]').forEach(el => {
    const width = Number(el.dataset.qrWidth) || 120;
    renderQrInto(el, el.dataset.qr, { width });
  });
}
