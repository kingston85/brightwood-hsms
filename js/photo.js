/* ==========================================================================
   Brightwood HSMS — Profile photos (students & teachers)
   The compressed photo is embedded directly on the student/teacher record
   as a data: URI — the same trick already used for the school logo in
   Settings. No Firebase Storage needed (that requires the paid Blaze plan
   as of late 2024), so this works identically whether Firebase Sync is on
   or the app is running in pure local-storage demo mode: the record just
   syncs through Firestore like any other field. Every display site only
   ever deals with a `photoURL` field via avatarHTML() below.
   ========================================================================== */

const PHOTO_MAX_DIM = 480;
const PHOTO_JPEG_QUALITY = 0.82;
// Firestore documents are capped at 1MiB total, and base64 adds ~33%
// overhead on top of the raw JPEG bytes — so this cap has to leave real
// headroom under that limit (not just under the file's own reasonableness).
// PHOTO_MAX_DIM/PHOTO_JPEG_QUALITY above normally produce a file well under
// this anyway; it's a safety ceiling for unusually busy/noisy source images.
const PHOTO_MAX_BYTES = 400 * 1024;

// Renders a photo <img> when one exists, else the same initials-circle this
// replaces — same sizeClass/colorClass convention as the old
// `initialsAvatar()` call sites, so swapping one for the other is a
// one-line change at each of them.
function avatarHTML(photoURL, name, sizeClass, colorClass) {
  if (photoURL) {
    return `<img src="${esc(photoURL)}" alt="${esc(name)}" class="${sizeClass} rounded-full object-cover shrink-0" />`;
  }
  return `<div class="${sizeClass} rounded-full ${colorClass || 'bg-brand-100 text-brand-700'} flex items-center justify-center font-bold shrink-0">${initialsAvatar(name)}</div>`;
}

function compressPhotoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file (PNG, JPG, etc).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > PHOTO_MAX_DIM || height > PHOTO_MAX_DIM) {
          const scale = PHOTO_MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        // Flatten onto white first — a transparent PNG re-saved as JPEG
        // would otherwise pick up a black background.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not process that image.')); return; }
          if (blob.size > PHOTO_MAX_BYTES) { reject(new Error('That photo is still too large even after resizing — try a different one.')); return; }
          resolve(blob);
        }, 'image/jpeg', PHOTO_JPEG_QUALITY);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not process that image.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// kind is 'students' or 'teachers' — matches the DB collection name, so
// every call site below stays a one-liner regardless of which record type
// it's for.
async function uploadProfilePhoto(kind, id, file) {
  const blob = await compressPhotoFile(file);
  const dataUrl = await blobToDataURL(blob);
  DB.update(kind, id, { photoURL: dataUrl });
  return dataUrl;
}

async function removeProfilePhoto(kind, id) {
  DB.update(kind, id, { photoURL: '' });
}

// Shared upload modal, used both from the admin-facing student/teacher list
// (any record) and from a person's own dashboard (their own record only —
// callers are responsible for only offering this where the viewer is
// actually allowed to write that record; the real enforcement is
// firestore.rules / storage.rules either way). Only `id` needs to travel
// through an onclick="" attribute (a plain uid, always quote-safe) — the
// display name is looked up here instead of also being passed in, since a
// real person's name can contain an apostrophe (e.g. "O'Brien") that would
// break out of the attribute's JS string if interpolated in directly.
// `onDone` re-renders whatever's on screen so the new photo shows up
// immediately instead of only after a manual refresh.
function openPhotoUploadModal(kind, id, onDone) {
  const current = DB.find(kind, id);
  const label = current ? `${current.firstName} ${current.lastName}` : 'this person';
  const colorClass = kind === 'teachers' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700';
  openModal(`
    <div class="p-6 space-y-4">
      <h3 class="font-bold text-lg">Profile Photo — ${esc(label)}</h3>
      <div class="flex justify-center" id="photoPreviewWrap">${avatarHTML(current && current.photoURL, label, 'w-24 h-24', colorClass)}</div>
      <input id="photoFileInput" type="file" accept="image/*" class="form-input"/>
      <p id="photoUploadStatus" class="text-xs text-slate-400"></p>
      <div class="flex justify-between gap-2">
        ${current && current.photoURL ? `<button type="button" id="photoRemoveBtn" class="btn btn-danger">Remove Photo</button>` : '<span></span>'}
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
          <button type="button" id="photoSaveBtn" class="btn btn-primary" disabled>Save Photo</button>
        </div>
      </div>
    </div>
  `);

  let pendingFile = null;
  document.getElementById('photoFileInput').onchange = (e) => {
    pendingFile = e.target.files[0] || null;
    document.getElementById('photoSaveBtn').disabled = !pendingFile;
    const status = document.getElementById('photoUploadStatus');
    if (status) { status.textContent = ''; status.className = 'text-xs text-slate-400'; }
  };

  document.getElementById('photoSaveBtn').onclick = async () => {
    if (!pendingFile) return;
    const status = document.getElementById('photoUploadStatus');
    const saveBtn = document.getElementById('photoSaveBtn');
    status.textContent = 'Uploading…';
    status.className = 'text-xs text-slate-400';
    saveBtn.disabled = true;
    try {
      await uploadProfilePhoto(kind, id, pendingFile);
      closeModal();
      toast('Photo updated.', { type: 'success' });
      if (onDone) onDone();
    } catch (e) {
      status.textContent = (e && e.message) || 'Could not upload that photo — please try again.';
      status.className = 'text-xs text-red-600';
      saveBtn.disabled = false;
    }
  };

  const removeBtn = document.getElementById('photoRemoveBtn');
  if (removeBtn) removeBtn.onclick = () => {
    confirmAction('Remove this profile photo?', async () => {
      await removeProfilePhoto(kind, id);
      toast('Photo removed.');
      if (onDone) onDone();
    }, 'Remove');
  };
}
