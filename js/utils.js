export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function hashPassword(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds.
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function compressImage(file, maxWidth = 250, maxHeight = 250, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        let format = 'image/webp';
        let dataUrl = canvas.toDataURL(format, quality);
        
        // If the browser doesn't support WebP encoding, it returns a PNG.
        if (dataUrl.startsWith('data:image/png')) {
          format = 'image/jpeg';
          // JPEG doesn't support transparency, so we add a white background
          ctx.globalCompositeOperation = "destination-over";
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = "source-over"; // reset
          dataUrl = canvas.toDataURL(format, quality);
        }
        
        // Compress further if the Base64 string is too large for Google Sheets (limit 50,000 chars)
        while (dataUrl.length > 45000 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL(format, quality);
        }

        // Failsafe: if it's STILL too big, cut dimensions in half
        if (dataUrl.length > 45000) {
          const failsafeCanvas = document.createElement('canvas');
          failsafeCanvas.width = width * 0.5;
          failsafeCanvas.height = height * 0.5;
          const fsCtx = failsafeCanvas.getContext('2d');
          if (format === 'image/jpeg') {
              fsCtx.fillStyle = "#FFFFFF";
              fsCtx.fillRect(0, 0, failsafeCanvas.width, failsafeCanvas.height);
          }
          fsCtx.drawImage(canvas, 0, 0, failsafeCanvas.width, failsafeCanvas.height);
          dataUrl = failsafeCanvas.toDataURL(format, 0.5);
        }
        
        console.log('--- COMPRESSION COMPLETE ---');
        console.log('Final image format:', format);
        console.log('Final base64 length:', dataUrl.length);
        
        resolve(dataUrl);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

// ════════════════════════════════════════════════════════════════
// Photo URL Resolver — Works with Base64, local paths, and URLs
// ════════════════════════════════════════════════════════════════

/**
 * Resolve a photo value from the database into a valid image src.
 * Handles three formats:
 *   1. Base64:     "data:image/webp;base64,UklGR..."  → used as-is
 *   2. Local path: "photos/PGP-001.webp"              → resolved relative to app root
 *   3. URL:        "https://drive.google.com/..."      → used as-is
 *   4. Empty/null                                      → returns '' (no image)
 * 
 * @param {string} photoValue — the raw value from the student record
 * @returns {string} A valid src attribute for an <img> tag, or '' if empty
 */
export function resolvePhotoUrl(photoValue) {
  if (!photoValue) return '';

  // Google Sheets / APIs can occasionally return the photo as an object
  // instead of a plain string. Accept the common URL-shaped fields.
  if (typeof photoValue === 'object') {
    photoValue = photoValue.url || photoValue.href || photoValue.value || '';
  }

  const trimmed = String(photoValue || '').trim();
  if (!trimmed) return '';

  // Case 1: Already a Base64 data URI — use as-is
  if (trimmed.startsWith('data:image')) {
    return trimmed;
  }

  // Case 2: A full URL (Google Drive, Cloudinary, etc.) — use as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Case 3: A local server path (e.g., "photos/PGP-001.webp")
  // Resolve relative to the app root
  if (trimmed.startsWith('photos/') || trimmed.startsWith('./photos/')) {
    return trimmed;
  }

  // Case 4: Unknown format — treat as a path anyway
  return trimmed;
}

/**
 * Check if a photo value represents a valid, displayable image.
 * @param {string} photoValue 
 * @returns {boolean}
 */
export function hasPhoto(photoValue) {
  return !!resolvePhotoUrl(photoValue);
}

/**
 * Upload a Base64 image to the persistent Vercel Blob endpoint.
 * Returns the permanent Vercel Blob URL on success.
 * Falls back to returning the original Base64 if the upload fails.
 * 
 * @param {string} studentId — the student's PassID (used as filename)
 * @param {string} base64Data — the full data URI (data:image/webp;base64,...)
 * @returns {Promise<string>} The saved Blob URL or the original Base64
 */
export async function uploadPhotoLocally(studentId, base64Data) {
  if (!base64Data || !studentId) return base64Data || '';

  try {
    const res = await fetch('/api/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Keep imageData as the canonical field and also send image for
      // compatibility with older deployed upload-photo functions.
      body: JSON.stringify({ studentId, imageData: base64Data, image: base64Data })
    });

    const json = await res.json();
    if (res.ok && json.success && json.url) {
      console.log(`[PhotoUpload] Saved to persistent storage: ${json.url}`);
      return json.url;
    }

    console.warn('[PhotoUpload] Server rejected:', json.error || `HTTP ${res.status}`);
    return base64Data;
  } catch (err) {
    console.warn('[PhotoUpload] Upload failed; using Base64 fallback:', err.message);
    return base64Data;
  }
}

// ════════════════════════════════════════════════════════════════
// Virtual ID Card renderer
//
// The single card design used everywhere a pass is drawn: the Students
// page modal, the PGP "View Pass" preview, the emailed attachment and
// the bulk ZIP export. The layout mirrors id_preview_new.html — a CR80
// portrait card, 315 x 500, purple gradient header with a curved white
// lip, teal accents and a teal footer band.
//
// Everything is inline-styled on purpose: html2canvas rasterises these
// nodes off-screen where no stylesheet applies, and it cannot render
// ::before / ::after, so the header's curved lip is a real element.
// ════════════════════════════════════════════════════════════════

const CARD_FONT = "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// The card is a fixed 315 x 500. Real records carry names up to 39 characters
// and dismissal arrangements past 180, so these two fields scale down and clip
// instead of pushing the QR panel out through the footer.
function fitName(text) {
  const n = text.length;
  if (n <= 22) return { size: 17, maxLines: 2 };
  if (n <= 32) return { size: 15, maxLines: 2 };
  return { size: 13, maxLines: 2 };
}

function fitArrangement(text) {
  const n = text.length;
  if (n <= 55) return { size: 11, maxLines: 2 };
  if (n <= 110) return { size: 9.5, maxLines: 3 };
  return { size: 8.5, maxLines: 3 };
}

// max-height rather than line-clamp: html2canvas rasterises these nodes and
// handles overflow:hidden reliably, but not -webkit-line-clamp.
function clampBox(size, lineHeight, maxLines) {
  return `max-height:${(size * lineHeight * maxLines).toFixed(1)}px;overflow:hidden;`;
}

/**
 * Build the HTML for a student's virtual ID card.
 *
 * @param {Object} student                 mapped student record
 * @param {Object} [options]
 * @param {string} [options.captureId]     id on the card root (html2canvas target)
 * @param {string} [options.qrId]          id of the empty div the QR is drawn into
 * @param {boolean} [options.centered]     centre the card in its container
 * @param {boolean} [options.shadow]       draw the drop shadow (off for exports)
 * @returns {string} HTML string
 */
export function renderVirtualIdCard(student, options = {}) {
  const {
    captureId = 'idcard-capture',
    qrId = 'idcard-qrcode',
    centered = false,
    shadow = false
  } = options;

  const s = student || {};
  const name = s.name || 'Unknown';
  const gradeLine = [s.grade, s.section].filter(Boolean).join(' - ');
  const arrangementText = s.arrangements || 'No arrangement specified';
  const nameFit = fitName(name);
  const arrFit = fitArrangement(arrangementText);
  // A long arrangement eats vertical room; shrink the QR panel to pay for it
  // so the Pass ID under the code is never clipped.
  const compact = arrangementText.length > 110;
  const qrBox = compact ? 84 : 100;
  const qrPad = compact ? 10 : 12;

  const photoInner = hasPhoto(s.photo)
    ? `<img src="${escapeHTML(resolvePhotoUrl(s.photo))}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`
    : `<div style="width:100%;height:100%;border-radius:10px;background:#f0ebf7;color:#422467;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;letter-spacing:1px;">${escapeHTML(name.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase() || '--')}</div>`;

  const cardStyle = [
    'width:315px',
    'height:500px',
    centered ? 'margin:0 auto' : '',
    'background:#ffffff',
    'border-radius:16px',
    'overflow:hidden',
    shadow ? 'box-shadow:0 24px 48px rgba(0,0,0,0.15),0 8px 16px rgba(0,0,0,0.1)' : '',
    'position:relative',
    'display:flex',
    'flex-direction:column',
    'box-sizing:border-box',
    `font-family:${CARD_FONT}`
  ].filter(Boolean).join(';');

  return `
    <div id="${escapeHTML(captureId)}" data-name="${escapeHTML(name)}" style="${cardStyle};">

      <div style="background:linear-gradient(135deg,#422467 0%,#291244 100%);padding:18px 16px 24px;color:#fff;display:flex;align-items:center;gap:12px;position:relative;flex-shrink:0;">
        <div style="width:40px;height:40px;background:#ffffff;border-radius:10px;padding:4px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.2);flex-shrink:0;box-sizing:border-box;">
          <img src="SISC_logo.png" alt="SISC" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:900;letter-spacing:0.2px;line-height:1.1;text-transform:uppercase;">Southville International</div>
          <div style="font-size:8.5px;font-weight:500;color:rgba(255,255,255,0.8);margin-top:4px;line-height:1.2;">1281 Tropical Ave Cor. Luxembourg St.<br>BF International, Las Pi&ntilde;as City</div>
        </div>
        <div style="position:absolute;bottom:-1px;left:0;right:0;height:20px;background:#ffffff;border-radius:20px 20px 0 0;"></div>
      </div>

      <div style="padding:0 16px;background:#ffffff;flex:1;display:flex;flex-direction:column;position:relative;z-index:1;min-height:0;overflow:hidden;">

        <div style="text-align:center;font-size:10px;color:#00c9b1;font-weight:900;text-transform:uppercase;letter-spacing:2.5px;margin-bottom:11px;">Permanent Gate Pass</div>

        <div style="display:flex;gap:14px;align-items:center;margin-bottom:11px;">
          <div style="width:76px;height:76px;border-radius:14px;border:3px solid #00c9b1;padding:2px;background:#fff;box-shadow:0 6px 12px rgba(0,201,177,0.2);flex-shrink:0;box-sizing:border-box;">${photoInner}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:${nameFit.size}px;font-weight:800;color:#1a1a2e;line-height:1.15;margin-bottom:4px;${clampBox(nameFit.size, 1.15, nameFit.maxLines)}">${escapeHTML(name)}</div>
            <div style="font-size:10px;color:#6b7280;font-weight:600;margin-bottom:4px;">ID: <span style="color:#422467;font-weight:800;font-size:12px;">${escapeHTML(s.studid || s.id || '—')}</span></div>
            ${gradeLine ? `<div style="display:inline-block;background:rgba(66,36,103,0.08);color:#422467;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:800;">${escapeHTML(gradeLine)}</div>` : ''}
          </div>
        </div>

        <div style="background:linear-gradient(90deg,#FDE047 0%,#fef08a 100%);border-radius:8px;padding:10px;text-align:center;margin-bottom:10px;border:1px solid rgba(234,179,8,0.5);">
          <div style="font-size:${arrFit.size}px;font-weight:800;color:#854d0e;line-height:1.25;${clampBox(arrFit.size, 1.25, arrFit.maxLines)}">${escapeHTML(arrangementText)}</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:11px;">
          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:800;letter-spacing:0.5px;">Authorized Gate</div>
          <div style="font-size:12px;font-weight:800;color:#422467;text-align:right;">${escapeHTML(s.preferredGate || 'Any authorized gate')}</div>
        </div>

        <div style="background:#f8fafc;border-radius:12px;padding:${qrPad}px;display:flex;flex-direction:column;align-items:center;border:1px dashed #cbd5e1;margin-top:auto;margin-bottom:${compact ? 8 : 12}px;flex-shrink:0;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:800;margin-bottom:${compact ? 6 : 8}px;letter-spacing:1px;">Scan to Verify</div>
          <div id="${escapeHTML(qrId)}" data-qr-size="${qrBox - 12}" style="width:${qrBox}px;height:${qrBox}px;background:#fff;padding:6px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.05);box-sizing:border-box;display:flex;align-items:center;justify-content:center;"></div>
          <div style="font-size:${compact ? 12 : 13}px;font-weight:900;font-family:'Courier New',Courier,monospace;color:#422467;margin-top:${compact ? 6 : 8}px;letter-spacing:2px;white-space:nowrap;">${escapeHTML(s.pgp || s.id || '—')}</div>
        </div>
      </div>

      <div style="background:#00c9b1;padding:10px;text-align:center;color:#003d35;font-size:9px;font-weight:800;letter-spacing:0.5px;flex-shrink:0;">A.Y. 2026-2027 &bull; VALID UNTIL JULY 2027</div>
    </div>`;
}

/**
 * The payload a pass card's QR encodes: "<PassID>|<QRToken>".
 * Falls back to the bare id for records issued before tokens existed.
 * @param {Object} student
 * @returns {string}
 */
export function passCardQRPayload(student) {
  const s = student || {};
  return s.qrToken
    ? `${s.pgp || ''}|${s.qrToken}`
    : (s.pgp || s.studid || s.id || 'N/A');
}

/**
 * Draw the QR code into the placeholder produced by renderVirtualIdCard().
 * Safe when the element is gone or the QR library never loaded.
 *
 * @param {string} containerId  the id passed as options.qrId
 * @param {Object} student
 * @returns {boolean} true if a QR image was drawn
 */
export function renderVirtualIdCardQR(containerId, student) {
  const container = document.getElementById(containerId);
  if (!container) return false;

  container.innerHTML = '';   // re-rendering must not stack QR codes
  const qrPayload = passCardQRPayload(student);

  if (typeof window !== 'undefined' && typeof window.QRCode === 'function') {
    try {
      // The card tells us how big it can afford; default to the roomy size.
      const size = parseInt(container.dataset.qrSize, 10) || 88;
      new window.QRCode(container, {
        text: qrPayload,
        width: size,
        height: size,
        colorDark: '#1f2937',
        colorLight: '#ffffff'
      });
      return true;
    } catch (err) {
      console.error('[IdCard] Failed to render QR code:', err);
    }
  }

  // No QR library: show the payload so the card is still usable.
  container.textContent = qrPayload;
  container.style.fontSize = '9px';
  container.style.wordBreak = 'break-all';
  container.style.textAlign = 'center';
  return false;
}

// ── Aliases ─────────────────────────────────────────────────────
// PGPController imports these names. They render the same card, so the
// emailed attachment and the on-screen preview can never drift apart.
export const renderPassCard = renderVirtualIdCard;
export const renderPassCardQR = renderVirtualIdCardQR;

export function waitForImages(root, timeout = 5000) {
  if (!root) return Promise.resolve();
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return Promise.resolve();
  return Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      const timer = setTimeout(resolve, timeout);
      img.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }));
}

// ════════════════════════════════════════════════════════════════
// PGP ID Generator — Format: {YY}{S}{GG}-{NNN}
// Example: 26A07-001 = Year 2026, Section starting with "A", Grade 7, student #001
// ════════════════════════════════════════════════════════════════

/**
 * Current school year prefix (first 2 digits of the starting year).
 * For SY 2026-2027, this is '26'.
 */
export const CURRENT_SCHOOL_YEAR = '26';

/**
 * Extract a 2-character grade code from a grade string.
 * "Grade 7" → "07", "Grade 10" → "10", "Grade 12" → "12"
 * "Pre-school" → "PS", "College" → "CO"
 * Unknown → "XX"
 */
export function gradeToCode(gradeStr) {
  if (!gradeStr) return 'XX';
  const trimmed = gradeStr.trim();
  const lower = trimmed.toLowerCase();

  // Special IB grades first
  if (lower.includes('ib1')) return 'B1';
  if (lower.includes('ib2')) return 'B2';

  // Special grade levels
  if (lower.includes('pre-school') || lower.includes('preschool') || lower.includes('kinder')) return 'PS';
  if (lower.includes('college')) return 'CO';

  // Match "Grade N" or "N" patterns
  const match = trimmed.match(/(\d+)/);
  if (match) {
    return match[1].padStart(2, '0'); // "7" → "07", "10" → "10"
  }

  return 'XX';
}

/**
 * Extract a section code letter from a section name.
 * Uses the first uppercase letter of the section name.
 * "Diligence" → "D", "Integrity" → "I", "" → "X"
 */
export function sectionToCode(sectionStr) {
  if (!sectionStr || typeof sectionStr !== 'string') return 'XXX';
  const trimmed = sectionStr.trim();
  if (!trimmed) return 'XXX';
  
  // Extract up to 3 alphabetical characters for a robust abbreviation
  const letters = trimmed.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters + 'XXX').substring(0, 3);
}

/**
 * Generate a unique PGP ID in the format: {YY}{S}{GG}-{NNN}
 * 
 * @param {string} grade - The grade level string (e.g., "Grade 7", "Grade 10")
 * @param {string} section - The section name (e.g., "Diligence", "A")
 * @param {Array} existingStudents - Array of existing student objects to check for duplicates
 * @param {string} [schoolYear] - Optional override for the year prefix (default: CURRENT_SCHOOL_YEAR)
 * @returns {string} A unique PGP ID like "26D07-001"
 */
export function generatePGP(grade, section, existingStudents, schoolYear) {
  const yy = schoolYear || CURRENT_SCHOOL_YEAR;
  const sCode = sectionToCode(section);
  const gCode = gradeToCode(grade);
  const prefix = `${yy}${sCode}${gCode}`; // e.g., "26A07"

  // Find the highest existing number for this prefix
  const existingNumbers = (existingStudents || [])
    .filter(s => s.pgp && s.pgp.startsWith(prefix + '-'))
    .map(s => {
      const parts = s.pgp.split('-');
      return parseInt(parts[1], 10);
    })
    .filter(n => !isNaN(n));

  const nextNumber = existingNumbers.length > 0
    ? Math.max(...existingNumbers) + 1
    : 1; // Start from 001

  if (nextNumber > 999) {
    throw new Error(`PGP capacity exceeded for prefix "${prefix}". Max 999 students per section per grade per year.`);
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  // Result: "26A07-001", "26A07-002", etc.
}

/**
 * Generate a random alphanumeric token for secure QR codes.
 *
 * Same alphabet and same default length as before — only the source of
 * randomness changed. This token is the one thing that separates a genuine
 * pass QR from a photograph or reprint of the Pass ID, and Math.random is a
 * predictable PRNG: seeing a handful of issued tokens can be enough to
 * predict the next. crypto.getRandomValues is available in every browser
 * this app supports, over plain HTTP as well as HTTPS.
 *
 * @param {number} [length=8]
 * @returns {string}
 */
export function generateQRToken(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rng = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto
    : null;

  if (!rng) {
    // Nothing better available — keep issuing a token rather than throwing.
    console.warn('[utils] crypto.getRandomValues unavailable; QR token quality is reduced.');
    let fallback = '';
    for (let i = 0; i < length; i++) {
      fallback += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return fallback;
  }

  // 252 is the largest multiple of 36 below 256. Discarding the values above
  // it keeps every character equally likely instead of favouring the first
  // four of the alphabet.
  const limit = Math.floor(256 / chars.length) * chars.length;
  let token = '';
  while (token.length < length) {
    const bytes = new Uint8Array(length);
    rng.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && token.length < length; i++) {
      if (bytes[i] < limit) token += chars.charAt(bytes[i] % chars.length);
    }
  }
  return token;
}

// ════════════════════════════════════════════════════════════════
// Pagination UI Helper
// ════════════════════════════════════════════════════════════════
export function generatePaginationHTML(pagination, totalItems) {
  const maxPage = Math.ceil(totalItems / pagination.limit) || 1;
  const start = (pagination.page - 1) * pagination.limit;
  const end = Math.min(start + pagination.limit, totalItems);
  
  let infoText = totalItems === 0 ? 'No records found' : `Showing ${start + 1} to ${end} of ${totalItems}`;
  
  let pageButtons = '';
  let startPage = Math.max(1, pagination.page - 2);
  let endPage = Math.min(maxPage, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  
  if (startPage > 1) {
    pageButtons += `<button class="page-num" data-page="1">1</button>`;
    if (startPage > 2) pageButtons += `<span class="page-ellipsis">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pageButtons += `<button class="page-num ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  
  if (endPage < maxPage) {
    if (endPage < maxPage - 1) pageButtons += `<span class="page-ellipsis">...</span>`;
    pageButtons += `<button class="page-num" data-page="${maxPage}">${maxPage}</button>`;
  }

  return `
    <div class="pagination-info">${infoText}</div>
    <div class="pagination-controls">
      <button class="page-nav" id="btn-page-prev" ${pagination.page === 1 ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;"><polyline points="15 18 9 12 15 6"></polyline></svg> Prev
      </button>
      ${pageButtons}
      <button class="page-nav" id="btn-page-next" ${pagination.page === maxPage ? 'disabled' : ''}>
        Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;
}

export function bindPaginationEvents(container, pagination, updateCallback) {
  if (!container) return;
  const prevBtn = container.querySelector('#btn-page-prev');
  const nextBtn = container.querySelector('#btn-page-next');
  const pageNums = container.querySelectorAll('.page-num');
  
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (pagination.page > 1) { pagination.page--; updateCallback(); }
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    pagination.page++; updateCallback();
  });
  pageNums.forEach(btn => {
    btn.addEventListener('click', (e) => {
      pagination.page = parseInt(e.currentTarget.dataset.page, 10);
      updateCallback();
    });
  });
}

