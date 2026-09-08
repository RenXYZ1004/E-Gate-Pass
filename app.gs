// ════════════════════════════════════════════════════════════════
// PGP Google Sheets API — Complete Apps Script Web App
// ════════════════════════════════════════════════════════════════
//
// HOW TO USE:
// 1. Paste this ENTIRE code into your Apps Script editor
// 2. Click ▶ Run on "testGetAll" to test (it will ask for permissions — click Allow)
// 3. Deploy → New Deployment → Web App → Anyone → Deploy
// 4. Copy the Web App URL
//
// IMPORTANT: The doGet/doPost functions ONLY work when called via 
// the deployed Web App URL. You CANNOT run them directly with the 
// ▶ button. Use the test functions at the bottom to test in the editor.
// ════════════════════════════════════════════════════════════════

// ── Web App Entry Points ─────────────────────────────────────
var PHOTO_FOLDER_ID = '1lGruwDr_nhouwRhZUf0qzvGedcbB_4GZ';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

// ── Main Request Router ──────────────────────────────────────

function handleRequest(e) {
  try {
    const params = e.parameter || {};
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
      case 'getGates':
        result = getSheetData('gates');
        break;

      // ── WRITE operations (POST requests with JSON body) ──
      case 'addGate':
        result = addRow('gates', JSON.parse(e.postData.contents));
        break;
      case 'updateGate':
        result = updateRow('gates', JSON.parse(e.postData.contents));
        break;
      case 'removeGate':
        var gateData = JSON.parse(e.postData.contents);
        result = deleteRow('gates', gateData.id);
        break;
      case 'addStudent':
        result = addRow('students', JSON.parse(e.postData.contents));
        break;
      case 'addLog':
        result = addRow('scan_logs', JSON.parse(e.postData.contents));
        break;
      case 'addTGP':
        result = addRow('temporary_passes', JSON.parse(e.postData.contents));
        break;

      // ── UPDATE operations (GET with query params) ──
      case 'updateTGPStatus':
        result = updateField('temporary_passes', params.id, 'status', params.status);
        break;
        
      case 'updateStudentStatus':
        var statusData = JSON.parse(e.postData.contents);
        // FIX: The third parameter is now 'Status' (Capital S) to perfectly match the Sheet header
        result = updateField('students', statusData.id, 'Status', statusData.status);
        break;

      // ── FULL ROW UPDATE (POST with JSON body) ──
      case 'updateStudent':
        result = updateRow('students', JSON.parse(e.postData.contents));
        break;

      // ── DELETE operations ──
      case 'removeStudent':
        // FIX: Now reading from POST JSON body
        var removeData = JSON.parse(e.postData.contents);
        result = deleteRow('students', removeData.id);
        break;

      case 'submitApplication':
        result = submitApplication(JSON.parse(e.postData.contents));
        break;

              // ── PHOTO UPLOAD to Drive ──
      case 'uploadPhoto':
        var upData = JSON.parse(e.postData.contents);
        var upUrl = '';
        if (upData.base64 && upData.studentId) {
          var upExt = (upData.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
          if (upExt === 'jpeg') upExt = 'jpg';
          var upFile = upData.fileName || (upData.studentId + '.' + upExt);
          upUrl = savePhotoToDrive_(upData.studentId, upData.base64, upData.mimeType || 'image/jpeg', upFile);
        }
        return sendJSON({ success: !!upUrl, url: upUrl });

      default:
        result = { error: 'Unknown action: ' + action };
    }

    return sendJSON({ success: true, data: result });

  } catch (err) {
    return sendJSON({ success: false, error: err.message });
  }
}

// ── JSON Response Helper ─────────────────────────────────────

function sendJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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

  // If sheet is empty or only has headers
  if (lastRow <= 1 || lastCol === 0) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];

  var results = [];
  for (var i = 1; i < data.length; i++) {
    // Skip completely empty rows
    if (data[i].every(function(cell) { return cell === '' || cell === null; })) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    results.push(obj);
  }
  return results;
}

/**
 * Get ALL data from all 4 tabs in a single call.
 * This is the most efficient way to sync — one network request gets everything.
 */
function getAllData() {
  return {
    students: getSheetData('students'),
    scan_logs: getSheetData('scan_logs'),
    temporary_passes: getSheetData('temporary_passes'),
    users: getSheetData('users'),
    gates: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('gates') ? getSheetData('gates') : []
  };
}

function testGateActionsNow() {
  var test = { GateID: 'gate-test-99', GateName: 'Test Gate', AssignedGuard: '', Status: 'active' };
  addRow('gates', test);
  Logger.log('✅ addRow OK');
  var rows = getSheetData('gates');
  Logger.log('✅ getSheetData OK — ' + rows.length + ' rows');
  deleteRow('gates', 'gate-test-99');
  Logger.log('✅ deleteRow OK');
  var all = getAllData();
  Logger.log('✅ getAllData OK — gates: ' + JSON.stringify(all.gates));
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
 * The first column of the sheet is always treated as the ID column.
 */
function updateField(sheetName, id, field, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab "' + sheetName + '" not found. Please create it in your spreadsheet.');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  // Find the ID column (first column) and the target field column
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
 * Replaces all fields in the matched row with values from the provided object.
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
  var idCol = 0; // First column is always the ID

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return { deleted: id };
    }
  }
  throw new Error('Row with ID "' + id + '" not found in sheet "' + sheetName + '"');
}


// ════════════════════════════════════════════════════════════════
// TEST FUNCTIONS — Click ▶ Run on these to test in the editor
// ════════════════════════════════════════════════════════════════

/**
 * TEST: Read all data from all tabs.
 * Click ▶ Run on this function first — it will ask for permissions.
 */
function testGetAll() {
  var data = getAllData();
  Logger.log('=== STUDENTS ===');
  Logger.log(JSON.stringify(data.students, null, 2));
  Logger.log('=== SCAN LOGS ===');
  Logger.log(JSON.stringify(data.scan_logs, null, 2));
  Logger.log('=== TEMPORARY PASSES ===');
  Logger.log(JSON.stringify(data.temporary_passes, null, 2));
  Logger.log('=== USERS ===');
  Logger.log(JSON.stringify(data.users, null, 2));
  Logger.log('✅ All data read successfully!');
}

/**
 * TEST: Add a sample student row.
 */
function testAddStudent() {
  var sample = {
    PassID: 'PGP-TEST001',
    StudentID: '23-9999',
    LastName: 'Test',
    FirstName: 'Student',
    MidName: 'M',
    Section: 'Grade 7 - Diligence',
    SchoolYear: '2025-2026',
    Dismissal: '3:00 PM',
    ParentName: 'Test Parent',
    ParentEmail: 'test@email.com',
    ParentMobile: '09170000000',
    Address: '123 Test Street',
    photo: '',
    status: 'active'
  };
  var result = addRow('students', sample);
  Logger.log('✅ Student added: ' + JSON.stringify(result));
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
  var result = addRow('scan_logs', sample);
  Logger.log('✅ Log added: ' + JSON.stringify(result));
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
  var result = addRow('temporary_passes', sample);
  Logger.log('✅ TGP added: ' + JSON.stringify(result));
}

function submitApplication(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('students');

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // ✅ Use proper PassID format instead of timestamp
  var passId = generateProperPassId_(sheet, data.grade, data.section, data.schoolyear);

  var completeName = ((data.lastname || '') + ', ' + (data.firstname || '')).trim().replace(/^,\s*/, '');

  // ── Photo ────────────────────────────────────────────────
  // newForm.html uploads the file bytes to Vercel Blob before it submits, so
  // studentPhoto now arrives as { url, fileName, mimeType } and the sheet only
  // has to store that URL. This branch used to test studentPhoto.base64 alone,
  // which no longer exists in the payload — so every online application after
  // the Blob migration was filed with an empty Photo cell.
  // The base64 branch stays for older callers that still post image bytes.
  var photoUrl = '';
  if (data.studentPhoto && data.studentPhoto.url) {
    photoUrl = String(data.studentPhoto.url).trim();
  } else if (data.studentPhoto && data.studentPhoto.base64) {
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

  var valueMap = {
    'PassID':        passId,
    'StudentID':     data.studid        || '',
    'CompleteName':  completeName,
    'Grade':         data.grade         || '',
    'Section':       data.section       || '',
    'SchoolYear':    data.schoolyear    || '',
    'Arrangements':  data.arrangements  || '',
    'ParentName':    data.parentname    || '',
    'ParentEmail':   data.parentemail   || '',
    'ParentMobile':  data.phone         || '',
    'PreferredGate': data.preferredgate || '',
    'VehicleDetails': '',
    'Address':       '',
    'Photo':         photoUrl,
    'Status':        'for approval',
    'FaceDescriptor': '',
    'QRToken':       ''
  };

  var row = headers.map(function(h) {
    return valueMap.hasOwnProperty(h) ? valueMap[h] : '';
  });

  sheet.appendRow(row);
  return { success: true, passId: passId };
}

function savePhotoToDrive_(studentId, base64, mimeType, fileName) {
  try {
    var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
    // Replace existing file with same name
    var existing = folder.getFilesByName(fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);

    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      mimeType || 'image/jpeg',
      fileName
    );
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Return the googleusercontent host, not drive.google.com/uc?export=view.
    // Google stopped serving raw bytes from the uc endpoint: it answers an
    // HTML interstitial and needs the viewer's cookies, so such a URL loads
    // fine when pasted into a tab but renders as a broken image inside the
    // app. lh3 serves the image itself with permissive CORS, which html2canvas
    // also needs to draw the photo into the downloaded ID card.
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) {
    Logger.log('savePhotoToDrive_ error: ' + e.message);
    return '';
  }
}

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
  for (var i = 1; i < data.length; i++) {
    var existing = String(data[i][0]);
    var re = new RegExp('^' + prefix + '-(\\d{3})$');
    var match = existing.match(re);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > maxNNN) maxNNN = n;
    }
  }
  return prefix + '-' + String(maxNNN + 1).padStart(3, '0');
}

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
    // Fix rows with empty PassID or the old PGP-timestamp format
    if (passId && !passId.match(/^PGP-\d+$/)) continue;

    var grade   = String(data[i][gradeCol]   || '');
    var section = String(data[i][sectionCol] || '');
    var sy      = String(data[i][syCol]      || '');

    var newId = generateProperPassId_(sheet, grade, section, sy);
    sheet.getRange(i + 1, passIdCol + 1).setValue(newId);
    // Re-read so the next NNN calculation sees this one
    data = sheet.getDataRange().getValues();
    fixed++;
    Logger.log('Row ' + (i+1) + ' → ' + newId);
  }
  Logger.log('Done. Fixed: ' + fixed);
}

/**
 * TEST: Update a student status.
 * Make sure you have a row with PassID = 'PGP-TEST001' first (run testAddStudent).
 */
function testUpdateStatus() {
  var result = updateField('students', 'PGP-TEST001', 'status', 'suspended');
  Logger.log('✅ Status updated: ' + JSON.stringify(result));
}

/**
 * TEST: Delete test student.
 * Make sure you have a row with PassID = 'PGP-TEST001' first.
 */
function testDeleteStudent() {
  var result = deleteRow('students', 'PGP-TEST001');
  Logger.log('✅ Student deleted: ' + JSON.stringify(result));
}
