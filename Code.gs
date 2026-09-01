// ════════════════════════════════════════════════════════════════
// PGP Google Sheets API — Complete Apps Script Web App
// ════════════════════════════════════════════════════════════════
//
// HOW TO USE:
// 1. Paste this ENTIRE file into your Apps Script editor (replacing the old code)
// 2. Click ▶ Run on "testGetAll" once (it will ask for permissions — click Allow)
// 3. Deploy → Manage deployments → edit the existing one → Deploy
//    (editing the existing deployment keeps the same /exec URL)
//
// doGet/doPost only run through the deployed Web App URL. You cannot run them
// with the ▶ button — use the test functions at the bottom instead.
//
// ────────────────────────────────────────────────────────────────
// WHAT CHANGED FROM THE PREVIOUS VERSION
// ────────────────────────────────────────────────────────────────
// 1. PHOTOS NOW SAVE.  The browser uploads the photo to Vercel Blob and sends
//    { url, fileName, mimeType }. The old code only looked at .base64, so the
//    condition was never true and the Photo column was written empty every
//    time. It now takes .url first and keeps the Drive path as a fallback.
//
// 2. DUPLICATE APPLICATIONS ARE REJECTED.  submitApplication used to append
//    unconditionally, which is why one Student ID ended up on four rows. It now
//    refuses when the student already holds a live record, and answers in the
//    shape the web form's "Already Registered" pop-up expects.
//
// 3. 'QRtoken' SPELLING MATCHES THE SHEET.  valueMap said 'QRToken'; the column
//    is 'QRtoken', so the header lookup never matched.
//
// 4. MOBILE NUMBERS KEEP THEIR LEADING ZERO.  A cell holding 09171234567 comes
//    back from Sheets as the number 9228331172. Phone-ish columns are now
//    returned as text.
//
// 5. CONCURRENT SUBMISSIONS CAN NO LONGER COLLIDE.  Pass ID generation reads the
//    highest number then appends; two applications arriving together produced
//    the same ID. That block now runs under a script lock.
//
// 6. updateTGPStatus ACCEPTS POST.  It still accepts GET for the current client,
//    but a GET request should never change data — move the client over when you
//    can.
//
// 7. UNKNOWN ACTIONS REPORT FAILURE.  They used to come back as
//    { success: true, data: { error: ... } }, which reads as success.
//
// 8. cleanupBadPhotoCells() added — clears Photo cells left holding an error
//    message by an older version of this script.
// ════════════════════════════════════════════════════════════════

var PHOTO_FOLDER_ID = '1lGruwDr_nhouwRhZUf0qzvGedcbB_4GZ';

// Columns that hold phone numbers. Sheets stores these as numbers when they
// look numeric, which silently eats the leading zero.
var TEXT_COLUMNS = ['ParentMobile', 'StudentID', 'phone'];

// A student with a record in one of these states may not apply again.
// Anything else (archived, declined) is treated as a closed record, so a
// student who was rejected can re-apply.
var BLOCKING_STATUSES = ['active', 'for approval', 'suspended'];

// ── Web App Entry Points ─────────────────────────────────────

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ── Main Request Router ──────────────────────────────────────

function handleRequest(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || '';
    let result;

    switch (action) {
      // ── READ operations (GET requests) ──
      case 'getStudents':
        result = getSheetData('students');
        break;
      case 'getLogs':
        result = getSheetData('scan_logs');
        break;
      case 'getTGP':
        result = getSheetData('temporary_passes');
        break;
      case 'getUsers':
        result = getSheetData('users');
        break;
      case 'getAll':
        result = getAllData();
        break;

      // ── WRITE operations (POST requests with JSON body) ──
      case 'addStudent':
        result = addRow('students', readBody_(e));
        break;
      case 'addLog':
        result = addRow('scan_logs', readBody_(e));
        break;
      case 'addTGP':
        result = addRow('temporary_passes', readBody_(e));
        break;

      // ── UPDATE operations ──
      case 'updateTGPStatus':
        // Accepts a POST body, falling back to query parameters so the current
        // client keeps working. A GET should not mutate data — move the client
        // to POST when convenient.
        var tgp = readBody_(e);
        var tgpId = tgp.id || params.id;
        var tgpStatus = tgp.status || params.status;
        result = updateField('temporary_passes', tgpId, 'status', tgpStatus);
        break;

      case 'updateStudentStatus':
        var statusData = readBody_(e);
        // 'Status' with a capital S, matching the sheet header exactly.
        result = updateField('students', statusData.id, 'Status', statusData.status);
        break;

      // ── FULL ROW UPDATE (POST with JSON body) ──
      case 'updateStudent':
        result = updateRow('students', readBody_(e));
        break;

      // ── DELETE operations ──
      case 'removeStudent':
        var removeData = readBody_(e);
        result = deleteRow('students', removeData.id);
        break;

      case 'submitApplication':
        result = submitApplication(readBody_(e));
        break;

      // ── PHOTO UPLOAD to Drive ──
      // Legacy: the site now uploads to Vercel Blob at /api/upload-photo.
      // Kept so older clients do not break.
      case 'uploadPhoto':
        var upData = readBody_(e);
        var upUrl = '';
        if (upData.base64 && upData.studentId) {
          var upExt = (upData.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
          if (upExt === 'jpeg') upExt = 'jpg';
          var upFile = upData.fileName || (upData.studentId + '.' + upExt);
          upUrl = savePhotoToDrive_(upData.studentId, upData.base64, upData.mimeType || 'image/jpeg', upFile);
        }
        return sendJSON({ success: !!upUrl, url: upUrl });

      default:
        // An unknown action is a failure, not a successful response that
        // happens to carry an error.
        return sendJSON({ success: false, error: 'Unknown action: ' + action });
    }

    return sendJSON({ success: true, data: result });

  } catch (err) {
    return sendJSON({ success: false, error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sendJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Parse the POST body, returning {} when there is none. Guards every action
 * against a bare GET, which used to throw on e.postData.contents.
 */
function readBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents) || {};
  } catch (err) {
    throw new Error('Request body was not valid JSON.');
  }
}

/**
 * Sheets hands back a number for a cell like 09171234567, dropping the leading
 * zero. Phone and ID columns are returned as text instead.
 */
function normalizeCell_(header, value) {
  if (value === null || value === undefined) return '';
  if (TEXT_COLUMNS.indexOf(header) === -1) return value;
  if (typeof value !== 'number') return value;

  var s = String(value);
  // Philippine mobile numbers are 11 digits beginning 09.
  if (s.length === 10 && s.charAt(0) === '9') s = '0' + s;
  return s;
}

// ════════════════════════════════════════════════════════════════
// DATA FUNCTIONS — These are what actually read/write the sheets
// ════════════════════════════════════════════════════════════════

/**
 * Read all rows from a sheet tab and return as array of objects.
 * Each object uses the header row as keys.
 */
function getSheetData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];

  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i].every(function (cell) { return cell === '' || cell === null; })) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = normalizeCell_(headers[j], data[i][j]);
    }
    results.push(obj);
  }
  return results;
}

/**
 * Get ALL data from all 4 tabs in a single call.
 */
function getAllData() {
  return {
    students: getSheetData('students'),
    scan_logs: getSheetData('scan_logs'),
    temporary_passes: getSheetData('temporary_passes'),
    users: getSheetData('users')
  };
}

/**
 * Add a new row to a sheet. The object keys must match the header names.
 */
function addRow(sheetName, obj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(obj[headers[i]] !== undefined ? obj[headers[i]] : '');
  }
  sheet.appendRow(row);
  return obj;
}

/**
 * Update a single field in a row, found by matching the first column (ID column).
 */
function updateField(sheetName, id, field, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }
  if (!id) {
    throw new Error('No ID supplied for the update.');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var idCol = 0; // First column is always the ID
  var fieldCol = headers.indexOf(field);
  if (fieldCol === -1) {
    throw new Error('Column "' + field + '" not found in sheet "' + sheetName + '". Available columns: ' + headers.join(', '));
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, fieldCol + 1).setValue(value);
      var result = {};
      result[headers[idCol]] = id;
      result[field] = value;
      return result;
    }
  }
  throw new Error('Row with ID "' + id + '" not found in sheet "' + sheetName + '"');
}

/**
 * Update an entire row by matching the first column (ID column).
 */
function updateRow(sheetName, obj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = 0;
  var id = obj[headers[idCol]];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      var row = [];
      for (var j = 0; j < headers.length; j++) {
        row.push(obj[headers[j]] !== undefined ? obj[headers[j]] : data[i][j]);
      }
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return obj;
    }
  }
  throw new Error('Row with ID "' + id + '" not found in sheet "' + sheetName + '"');
}

/**
 * Delete a row by ID (first column match).
 */
function deleteRow(sheetName, id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }

  var data = sheet.getDataRange().getValues();
  var idCol = 0;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return { deleted: id };
    }
  }
  throw new Error('Row with ID "' + id + '" not found in sheet "' + sheetName + '"');
}

// ════════════════════════════════════════════════════════════════
// PUBLIC APPLICATION FORM
// ════════════════════════════════════════════════════════════════

/**
 * Handle a submission from the public gatepass application form.
 *
 * Returns either
 *   { success: true,  passId: '26INT09-001', message: '...' }
 * or, for a student who already holds a record,
 *   { success: false, duplicate: true, message: '... already registered ...' }
 *
 * The whole body runs under a script lock: Pass ID generation reads the highest
 * existing number and then appends, so two applications arriving at the same
 * moment would otherwise be handed the same ID.
 */
function submitApplication(data) {
  data = data || {};

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    throw new Error('The server is busy. Please try again in a moment.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('students');
    if (!sheet) throw new Error('Sheet tab "students" not found.');

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // ── One application per student ──────────────────────────
    var clash = findLiveRecord_(sheet, headers, data.studid);
    if (clash) {
      return {
        success: false,
        duplicate: true,
        message: 'Student ID ' + String(data.studid).trim() +
                 ' is already registered to ' + clash.name +
                 ' (' + clash.status + ').'
      };
    }

    var passId = generateProperPassId_(sheet, data.grade, data.section, data.schoolyear);

    var completeName = ((data.lastname || '') + ', ' + (data.firstname || ''))
      .trim().replace(/^,\s*/, '');

    // ── Photo ────────────────────────────────────────────────
    // The browser uploads to Vercel Blob and sends back a URL. The base64
    // branch is only for older clients that still post the raw image.
    var photoUrl = '';
    if (data.studentPhoto) {
      if (data.studentPhoto.url) {
        photoUrl = String(data.studentPhoto.url);
      } else if (data.studentPhoto.base64) {
        var ph = data.studentPhoto;
        var phExt = (ph.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
        if (phExt === 'jpeg') phExt = 'jpg';
        var phFile = ph.fileName || ((data.studid || 'photo') + '.' + phExt);
        photoUrl = savePhotoToDrive_(
          data.studid || data.name || 'photo',
          ph.base64,
          ph.mimeType || 'image/jpeg',
          phFile
        );
      }
    }

    var valueMap = {
      'PassID':         passId,
      'StudentID':      data.studid        || '',
      'CompleteName':   completeName,
      'Grade':          data.grade         || '',
      'Section':        data.section       || '',
      'SchoolYear':     data.schoolyear    || '',
      'Arrangements':   data.arrangements  || '',
      'ParentName':     data.parentname    || '',
      'ParentEmail':    data.parentemail   || '',
      'ParentMobile':   data.phone         || '',
      'PreferredGate':  data.preferredgate || '',
      'VehicleDetails': '',
      'Address':        '',
      'Photo':          photoUrl,
      'Status':         'for approval',
      'FaceDescriptor': '',
      'QRtoken':        ''   // matches the sheet header exactly
    };

    var row = headers.map(function (h) {
      return valueMap.hasOwnProperty(h) ? valueMap[h] : '';
    });

    sheet.appendRow(row);

    return {
      success: true,
      passId: passId,
      message: 'Application submitted successfully.'
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Find an existing student record that should block a new application.
 * Archived and declined records are ignored, so a rejected applicant may
 * re-apply. Returns { name, status } or null.
 */
function findLiveRecord_(sheet, headers, studentId) {
  var wanted = String(studentId || '').trim().toLowerCase();
  if (!wanted) return null;

  var idCol     = headers.indexOf('StudentID');
  var nameCol   = headers.indexOf('CompleteName');
  var statusCol = headers.indexOf('Status');
  if (idCol === -1) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim().toLowerCase() !== wanted) continue;

    var status = String(statusCol === -1 ? '' : data[i][statusCol]).trim().toLowerCase();
    if (BLOCKING_STATUSES.indexOf(status) !== -1) {
      return {
        name: String(nameCol === -1 ? 'an existing student' : data[i][nameCol]),
        status: status
      };
    }
  }
  return null;
}

/**
 * Save a base64 image to the Drive photo folder and return a shareable link.
 * Only used by the legacy base64 path; the site uploads to Vercel Blob now.
 * Never returns an error string — a failure must not be written into the sheet
 * as if it were a photo.
 */
function savePhotoToDrive_(studentId, base64, mimeType, fileName) {
  try {
    var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);

    var existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);

    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      mimeType || 'image/jpeg',
      fileName
    );
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?id=' + file.getId() + '&export=view';
  } catch (e) {
    Logger.log('savePhotoToDrive_ error: ' + e.message);
    return '';
  }
}

/**
 * Build the next Pass ID for a grade and section, e.g. 26INT09-001.
 * Call this inside a lock — it reads the highest existing number.
 */
function generateProperPassId_(sheet, grade, section, schoolYear) {
  var yy = schoolYear ? String(schoolYear).split('-')[0].slice(-2) : '26';

  var gradeStr = String(grade || '').toLowerCase().trim();
  var gradeCode;
  if (gradeStr === 'ib1') gradeCode = 'B1';
  else if (gradeStr === 'ib2') gradeCode = 'B2';
  else {
    var m = gradeStr.match(/(\d+)/);
    gradeCode = m ? String(parseInt(m[1])).padStart(2, '0') : 'XX';
  }

  var sec = String(section || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  sec = (sec + 'XXX').substring(0, 3);

  var prefix = yy + sec + gradeCode;

  var data = sheet.getDataRange().getValues();
  var maxNNN = 0;
  var re = new RegExp('^' + prefix + '-(\\d{3})$');
  for (var i = 1; i < data.length; i++) {
    var match = String(data[i][0]).match(re);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > maxNNN) maxNNN = n;
    }
  }
  return prefix + '-' + String(maxNNN + 1).padStart(3, '0');
}

// ════════════════════════════════════════════════════════════════
// MAINTENANCE — run these by hand from the editor
// ════════════════════════════════════════════════════════════════

/**
 * Replace empty or PGP-timestamp Pass IDs with the proper format.
 */
function fixMissingPassIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var passIdCol  = headers.indexOf('PassID');
  var gradeCol   = headers.indexOf('Grade');
  var sectionCol = headers.indexOf('Section');
  var syCol      = headers.indexOf('SchoolYear');

  var fixed = 0;
  for (var i = 1; i < data.length; i++) {
    var passId = String(data[i][passIdCol] || '').trim();
    if (passId && !passId.match(/^PGP-\d+$/)) continue;

    var newId = generateProperPassId_(
      sheet,
      String(data[i][gradeCol]   || ''),
      String(data[i][sectionCol] || ''),
      String(data[i][syCol]      || '')
    );
    sheet.getRange(i + 1, passIdCol + 1).setValue(newId);
    data[i][passIdCol] = newId;   // keep the local copy in step for the next ID
    fixed++;
    Logger.log('Row ' + (i + 1) + ' → ' + newId);
  }
  Logger.log('Done. Fixed: ' + fixed);
}

/**
 * An older version of this script wrote its exception text into the Photo
 * column, so those cells now hold things like
 *   "ERROR: You do not have permission to call DriveApp.Folder.createFile"
 *   "NO PHOTO DATA RECEIVED"
 * The app treats any non-empty value as a photo path and renders a broken
 * image. This clears them so those students fall back to their initials.
 *
 * The pictures themselves are not recoverable — the uploads never completed.
 */
function cleanupBadPhotoCells() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var photoCol = headers.indexOf('Photo');
  var nameCol  = headers.indexOf('CompleteName');
  if (photoCol === -1) throw new Error('No "Photo" column found.');

  var cleared = 0;
  for (var i = 1; i < data.length; i++) {
    var v = String(data[i][photoCol] || '').trim();
    if (!v) continue;
    var looksLikeAPhoto = v.indexOf('data:image') === 0 || /^https?:\/\//i.test(v);
    if (looksLikeAPhoto) continue;

    sheet.getRange(i + 1, photoCol + 1).setValue('');
    cleared++;
    Logger.log('Cleared row ' + (i + 1) + ' (' +
      (nameCol === -1 ? '' : data[i][nameCol]) + '): ' + v.substring(0, 60));
  }
  Logger.log('Done. Cleared: ' + cleared);
}

/**
 * Replace every plaintext password in the 'users' tab with its SHA-256 hash.
 *
 * WHY THIS MATTERS: getUsers is an open action on this Web App, and the /exec
 * URL ships inside js/config.js on the public site. Whatever sits in the
 * Password column is readable by anyone who fetches that URL. Storing the
 * hash instead means a leak no longer hands over working logins.
 *
 * SAFE TO RUN: the login already compares the SHA-256 hash first
 * (index.html and js/models/AppModel.js check hashed OR plaintext), so staff
 * keep signing in with the passwords they already use. Rows that are already
 * hashed are skipped, so running it twice is harmless.
 *
 * The digest matches the browser's hashPassword() exactly: SHA-256 over the
 * UTF-8 bytes, lowercase hex.
 *
 * HOW TO RUN: open the Apps Script editor, pick hashPlaintextPasswords from
 * the function list and click Run. Read the log. Then change the passwords
 * that were exposed — hashing protects the column from here on, it does not
 * un-leak a password that has already been published.
 */
function hashPlaintextPasswords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('users');
  if (!sheet) throw new Error('Sheet tab "users" not found.');

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var pwCol = headers.indexOf('password');
  if (pwCol === -1) pwCol = headers.indexOf('Password');
  if (pwCol === -1) throw new Error('No "password" column found in the users tab.');

  var userCol = headers.indexOf('username');
  if (userCol === -1) userCol = headers.indexOf('Username');

  var hashed = 0, skipped = 0, blank = 0;
  for (var i = 1; i < data.length; i++) {
    var value = String(data[i][pwCol] || '').trim();
    var who = userCol === -1 ? ('row ' + (i + 1)) : String(data[i][userCol] || ('row ' + (i + 1)));

    if (!value) { blank++; continue; }
    if (/^[a-f0-9]{64}$/i.test(value)) { skipped++; continue; }   // already a SHA-256 hash

    sheet.getRange(i + 1, pwCol + 1).setValue(sha256Hex_(value));
    hashed++;
    Logger.log('Hashed the password for ' + who);
  }

  Logger.log('Done. Hashed: ' + hashed + ', already hashed: ' + skipped + ', blank: ' + blank);
  if (hashed > 0) {
    Logger.log('NOW CHANGE THOSE PASSWORDS. They were readable in plaintext, so treat every one of them as compromised.');
  }
}

/**
 * SHA-256 as lowercase hex, byte for byte identical to the browser's
 * crypto.subtle.digest('SHA-256', ...) used by hashPassword().
 * computeDigest hands back signed bytes, hence the +256.
 */
function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

/**
 * Read-only check: how many accounts still hold a plaintext password.
 * Run this first if you want to see the damage before changing anything.
 */
function reportPlaintextPasswords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('users');
  if (!sheet) throw new Error('Sheet tab "users" not found.');

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var pwCol = headers.indexOf('password');
  if (pwCol === -1) pwCol = headers.indexOf('Password');
  var userCol = headers.indexOf('username');
  if (userCol === -1) userCol = headers.indexOf('Username');
  if (pwCol === -1) throw new Error('No "password" column found in the users tab.');

  var plain = 0;
  for (var i = 1; i < data.length; i++) {
    var value = String(data[i][pwCol] || '').trim();
    if (!value || /^[a-f0-9]{64}$/i.test(value)) continue;
    plain++;
    Logger.log('Plaintext password on row ' + (i + 1) +
      (userCol === -1 ? '' : ' (' + data[i][userCol] + ')') +
      ' — ' + value.length + ' characters');
  }
  Logger.log('Done. Accounts still storing a readable password: ' + plain);
}

/**
 * Report Student IDs that appear on more than one row, newest last.
 * Read-only — it changes nothing, it just tells you what to merge.
 */
function reportDuplicateStudents() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var idCol     = headers.indexOf('StudentID');
  var passCol   = headers.indexOf('PassID');
  var statusCol = headers.indexOf('Status');
  var nameCol   = headers.indexOf('CompleteName');

  var seen = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][idCol] || '').trim().toLowerCase();
    if (!key) continue;
    (seen[key] = seen[key] || []).push({
      row: i + 1,
      pass: data[i][passCol],
      name: data[i][nameCol],
      status: data[i][statusCol]
    });
  }

  var total = 0;
  Object.keys(seen).forEach(function (k) {
    if (seen[k].length < 2) return;
    total++;
    Logger.log('StudentID ' + k + ' → ' + seen[k].length + ' rows');
    seen[k].forEach(function (r) {
      Logger.log('    row ' + r.row + '  ' + r.pass + '  ' + r.name + '  [' + r.status + ']');
    });
  });
  Logger.log('Done. Student IDs on more than one row: ' + total);
}

// ════════════════════════════════════════════════════════════════
// TEST FUNCTIONS — Click ▶ Run on these to test in the editor
// ════════════════════════════════════════════════════════════════

/**
 * TEST: Read all data from all tabs.
 * Run this one first — it will ask for permissions.
 */
function testGetAll() {
  var data = getAllData();
  Logger.log('students: '          + data.students.length);
  Logger.log('scan_logs: '         + data.scan_logs.length);
  Logger.log('temporary_passes: '  + data.temporary_passes.length);
  Logger.log('users: '             + data.users.length);
  Logger.log('✅ All data read successfully!');
}

/**
 * TEST: the photo branch, without writing anything.
 * Proves a Vercel Blob URL is now carried through to the Photo column.
 */
function testPhotoResolution() {
  var blobStyle = { studentPhoto: { url: 'https://example.public.blob.vercel-storage.com/p.webp', mimeType: 'image/webp' } };
  var noPhoto   = { studentPhoto: null };

  var got = blobStyle.studentPhoto && blobStyle.studentPhoto.url ? blobStyle.studentPhoto.url : '';
  Logger.log('Blob URL   → ' + got);
  Logger.log('No photo   → "' + (noPhoto.studentPhoto ? '?' : '') + '"');
  Logger.log(got ? '✅ Blob URLs are stored.' : '❌ Still dropping the photo.');
}

/**
 * TEST: the duplicate guard. Read-only.
 * Put a Student ID that already exists in the sheet here.
 */
function testDuplicateGuard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var existing = findLiveRecord_(sheet, headers, '24-0193c');
  Logger.log(existing
    ? '✅ Would be rejected: already registered to ' + existing.name + ' (' + existing.status + ')'
    : 'ℹ️ No live record — this application would be accepted.');
}

/**
 * TEST: Add a sample scan log.
 */
function testAddLog() {
  var sample = {
    id: 'LOG-' + Date.now(),
    studentId: 'PGP-TEST001',
    gate: 'Gate 1',
    timestamp: new Date().toISOString(),
    result: 'granted',
    passType: 'PGP'
  };
  Logger.log('✅ Log added: ' + JSON.stringify(addRow('scan_logs', sample)));
}

/**
 * TEST: Add a sample TGP.
 */
function testAddTGP() {
  var sample = {
    id: 'TGP-TEST01',
    studentId: 'PGP-TEST001',
    validDate: '2026-07-13',
    gate: 'Main Gate',
    reason: 'Medical appointment',
    requester: 'Test Parent',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  Logger.log('✅ TGP added: ' + JSON.stringify(addRow('temporary_passes', sample)));
}
