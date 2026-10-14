import SheetsService from '../services/SheetsService.js';
import { uploadPhotoLocally, hashPassword } from '../utils.js';
import { SESSION_TIMEOUT_MS } from '../config.js';

// ════════════════════════════════════════════════════════════════
// AppModel — Data Layer with Google Sheets + localStorage Cache
// ════════════════════════════════════════════════════════════════
// Data flows:
//   READ:  Google Sheet → localStorage cache → Views
//   WRITE: Views → Google Sheet + localStorage cache
//   OFFLINE: Falls back to localStorage cache automatically
// ════════════════════════════════════════════════════════════════

// Read a JSON value from localStorage without ever throwing.
// A single corrupt entry used to break the whole app at construction time.
function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed ?? fallback;
  } catch (err) {
    console.warn(`[AppModel] Corrupt cache for "${key}" — resetting.`, err);
    try { localStorage.removeItem(key); } catch (_) { }
    return fallback;
  }
}

// Write a JSON value to localStorage without ever throwing.
//
// The students array outgrew the 5 MB origin quota: most records still carry
// their photo inline as a base64 data URI, and localStorage counts UTF-16, so
// the array measures ~8.4 MB. setItem then threw QuotaExceededError on every
// single sync — and because the cache write runs inside syncFromSheet's try
// block, that throw was caught there as a *sync failure*, so the freshly
// fetched students were never rendered and the app kept showing whatever stale
// cache predated the overflow. A cache miss must degrade to "not cached", not
// take the sync down with it.
function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[AppModel] Could not cache "${key}" — ${err.name}. Continuing without it.`, err);
    return false;
  }
}

// The cached copy of a student drops an inline data-URI photo and keeps a
// photo that is already a URL (a few dozen characters). Inline photos are ~90%
// of the payload; without them the array is well under quota. Nothing is lost
// on screen — this.students keeps every photo in memory for the session, and
// the next sync refetches them.
//
// The key is deleted, not blanked. JSON.stringify omits undefined, so such a
// record reloads with photo === undefined, which mapStudentToSheet passes
// through as an absent Photo column — and Apps Script's updateRow keeps the
// cell it already has. Caching '' instead would mean that editing a student
// before the first sync completed wrote that '' back and destroyed the photo.
function withoutInlinePhotos(students) {
  return students.map(s => {
    if (typeof s.photo !== 'string' || !s.photo.startsWith('data:')) return s;
    const { photo, ...rest } = s;
    return rest;
  });
}

// Normalize user profiles from Google Sheets and old browser sessions. Some
// legacy user rows have a username but no display name; preserve those sessions
// and use the username as the visible name instead of crashing the dashboard.
function normalizeUserProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const username = String(profile.username || profile.userName || '').trim();
  const name = String(
    profile.name || profile.displayName || profile.fullName || username || 'User'
  ).trim() || 'User';
  const role = String(profile.role || '').trim().toLowerCase();
  return { ...profile, username, name, role };
}

export default class AppModel {
  constructor() {
    // Load cached data from localStorage (instant load)
    this.students = readCache('pgp_students', []);
    this.exitLogs = readCache('pgp_logs', []);
    this.tgp = readCache('pgp_tgp', []);
    this.users = readCache('pgp_users', []);
    this.gates = readCache('pgp_gates', []);
    this.emailQueue = readCache('pgp_email_queue', []);

    // Session management
    const profile = normalizeUserProfile(readCache('pgp_session', null));
    const browserAlive = sessionStorage.getItem('pgp_browser_alive');
    this.currentUser = (profile && browserAlive) ? profile : null;
    if (profile && !browserAlive) localStorage.removeItem('pgp_session');

    // Sync state
    this.lastSyncTime = parseInt(localStorage.getItem('pgp_last_sync') || '0');
    this.syncStatus = 'idle'; // 'idle' | 'syncing' | 'error'
    this.isOnline = navigator.onLine;
    this.lastDataHash = null; // Change detection for sync optimization

    // Session timeout — configured in js/config.js
    this.SESSION_TIMEOUT = SESSION_TIMEOUT_MS;

    // Offline write queue (for writes that failed due to no internet)
    this.writeQueue = readCache('pgp_write_queue', []);

    // Hot-path lookup indexes. They preserve the existing first-match behavior
    // while avoiding repeated O(n) scans during dashboard/scanner renders.
    this._studentByPassId = new Map();
    this._studentByStudId = new Map();
    this._tgpById = new Map();
    this.rebuildIndexes();
  }

  // ════════════════════════════════════════════════════════════
  // SYNC ENGINE — Pulls fresh data from Google Sheets
  // ════════════════════════════════════════════════════════════

  async syncFromSheet() {
    // Never allow overlapping full syncs. A second caller should wait for the
    // same request instead of racing the first request and overwriting fresh
    // state with an older response.
    if (this._syncPromise) return this._syncPromise;

    this._syncPromise = (async () => {
      this.syncStatus = 'syncing';
      try {
        // Flush any writes that were queued while offline BEFORE pulling the
        // cloud snapshot. Otherwise the sync can fetch old data, then write the
        // queued change afterwards, leaving the UI one sync behind.
        if (navigator.onLine && this.writeQueue.length > 0) {
          await this.processWriteQueue();
        }

        const data = await SheetsService.getAll();

        // Change detection must account for actual record changes, not only
        // row counts / first / last IDs. The previous lightweight fingerprint
        // could report `changed: false` when a name, gate, TGP status, QR token,
        // face descriptor, or other middle-row field changed. That made sync
        // look successful while the current page stayed stale.
        const newHash = this.computeDataHash(data);
        const hasChanged = newHash !== this.lastDataHash;
        this.lastDataHash = newHash;

        // Map Sheet columns to frontend field names
        this.students = (data.students || []).map(s => this.mapStudentFromSheet(s));
        this.exitLogs = (data.scan_logs || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.tgp = data.temporary_passes || [];
        this.users = data.users || [];
        this.gates = (data.gates || []).map(g => this.mapGateFromSheet(g));
        this.rebuildIndexes();

        // Cache to localStorage. A cache failure must never turn a successful
        // cloud fetch into a reported sync failure.
        this.cacheAll();
        this.lastSyncTime = Date.now();
        try {
          localStorage.setItem('pgp_last_sync', this.lastSyncTime.toString());
        } catch (_) {
          // Cache quota/privacy mode must not invalidate a successful sync.
        }
        this.syncStatus = 'idle';
        this.isOnline = navigator.onLine;

        return { success: true, changed: hasChanged };
      } catch (err) {
        console.error('Sync failed:', err);
        this.syncStatus = 'error';
        // A server/API failure does not mean the browser is offline. Keeping
        // these states distinct prevents the reconnect handler from becoming
        // the only path back to a healthy sync loop.
        this.isOnline = navigator.onLine;
        this.lastSyncError = err && err.message ? err.message : String(err);
        return { success: false, changed: false, error: this.lastSyncError };
      } finally {
        this._syncPromise = null;
      }
    })();

    return this._syncPromise;
  }

  // ── Field Mapping: Sheet → Frontend ───────────────────────
  mapStudentFromSheet(s) {
    const grade = String(s.Grade || '');
    const section = String(s.Section || '');
    const fullSection = section ? `${grade} - ${section}` : grade;
    
    return {
      id: String(s.PassID || ''),
      pgp: String(s.PassID || ''),
      studid: String(s.StudentID || ''),
      name: s.CompleteName || '',
      grade: grade,
      section: section,
      fullSection,
      schoolYear: String(s.SchoolYear || ''),
      // The sheet column is spelled 'QRtoken'; older code wrote 'QRToken'.
      // Accept either so approvals that mint a token are not silently lost.
      qrToken: String(s.QRToken || s.QRtoken || ''),
      arrangements: s.Arrangements || '',
      preferredGate: s.PreferredGate || '',
      vehicleDetails: s.VehicleDetails || '',
      parentName: s.ParentName || '',
      parentEmail: s.ParentEmail || '',
      phone: String(s.ParentMobile || ''),
      address: s.Address || '',
      // Photo is normally a Google Drive URL. Accept common alternate
      // field names too, so older Sheets rows still display correctly.
      photo: s.Photo || s.photo || s.PhotoURL || s.photoUrl || '',
      status: s.Status || 'active',
      faceDescriptor: s.FaceDescriptor || ''
    };
  }

  // ── Field Mapping: Frontend → Sheet ───────────────────────
  mapStudentToSheet(s) {
    return {
      PassID: s.pgp || s.id || '',
      StudentID: s.studid || '',
      CompleteName: s.name || '',
      Grade: s.grade || '',
      Section: s.section || '',
      SchoolYear: s.schoolYear || '',
      Arrangements: s.arrangements || '',
      ParentName: s.parentName || '',
      ParentEmail: s.parentEmail || '',
      ParentMobile: s.phone || '',
      PreferredGate: s.preferredGate || '',
      VehicleDetails: s.vehicleDetails || '',
      Address: s.address || '',
      // Photo is a persistent URL after upload. undefined means the value was
      // dropped from the localStorage cache to fit the quota, not that the
      // student has no photo — leaving the key out makes Apps Script's
      // updateRow keep whatever the cell already holds rather than blanking it.
      Photo: s.photo === undefined ? undefined : (s.photo || ''),
      Status: s.status || 'active',
      FaceDescriptor: s.faceDescriptor || '',
      QRToken: s.qrToken || '',
      // Same value under the sheet's actual column name.
      QRtoken: s.qrToken || ''
    };
  }

  // ── Name Helpers ──────────────────────────────────────────
  buildFullName(last, first, mid) {
    const parts = [];
    if (last) parts.push(last + ',');
    if (first) parts.push(first);
    if (mid) parts.push(mid.charAt(0) + '.');
    return parts.join(' ') || 'Unknown';
  }

  extractGrade(section) {
    // "Grade 7 - Diligence" → "Grade 7"
    const match = section.match(/^(.*?)\s*-/);
    return match ? match[1].trim() : section;
  }

  extractSection(section) {
    // "Grade 7 - Diligence" → "Diligence"
    const match = section.match(/-\s*(.+)$/);
    return match ? match[1].trim() : '';
  }

  // ── Cache all data to localStorage ────────────────────────
  cacheAll() {
    writeCache('pgp_students', withoutInlinePhotos(this.students));
    writeCache('pgp_logs', this.exitLogs);
    writeCache('pgp_tgp', this.tgp);
    writeCache('pgp_users', this.users);
    writeCache('pgp_gates', this.gates);
  }

  // ── Gate Field Mapping ────────────────────────────────────
  mapGateFromSheet(g) {
    return {
      id: String(g.GateID || ''),
      name: String(g.GateName || ''),
      assignedGuard: String(g.AssignedGuard || ''),
      status: String(g.Status || 'active')
    };
  }

  mapGateToSheet(g) {
    return {
      GateID: g.id || '',
      GateName: g.name || '',
      AssignedGuard: g.assignedGuard || '',
      Status: g.status || 'active'
    };
  }

  rebuildIndexes() {
    this._studentByPassId.clear();
    this._studentByStudId.clear();
    this._tgpById.clear();

    for (const student of this.students || []) {
      // Preserve the original lookup semantics: getStudentByPassId matched
      // either `id` OR `pgp`, while getStudentByStudId matched `studid` OR `id`.
      // The first matching student wins, just like Array.prototype.find().
      for (const key of [student.id, student.pgp]) {
        if (key !== undefined && key !== null && !this._studentByPassId.has(key)) {
          this._studentByPassId.set(key, student);
        }
      }
      for (const key of [student.studid, student.id]) {
        if (key !== undefined && key !== null && !this._studentByStudId.has(key)) {
          this._studentByStudId.set(key, student);
        }
      }
    }
    for (const pass of this.tgp || []) {
      if (pass.id !== undefined && pass.id !== null && !this._tgpById.has(pass.id)) {
        this._tgpById.set(pass.id, pass);
      }
    }
  }

  _indexStudent(student) {
    if (!student) return;
    for (const key of [student.id, student.pgp]) {
      if (key !== undefined && key !== null && !this._studentByPassId.has(key)) {
        this._studentByPassId.set(key, student);
      }
    }
    for (const key of [student.studid, student.id]) {
      if (key !== undefined && key !== null && !this._studentByStudId.has(key)) {
        this._studentByStudId.set(key, student);
      }
    }
  }

  _removeStudentFromIndexes(student) {
    if (!student) return;
    for (const key of [student.id, student.pgp]) {
      if (key !== undefined && key !== null && this._studentByPassId.get(key) === student) this._studentByPassId.delete(key);
    }
    for (const key of [student.studid, student.id]) {
      if (key !== undefined && key !== null && this._studentByStudId.get(key) === student) this._studentByStudId.delete(key);
    }
  }

  getActiveGates() {
    return this.gates.filter(g => g.status === 'active');
  }

  // ── Change Detection ─────────────────────────────────────
  computeDataHash(data) {
    // Build a deterministic, content-based fingerprint over every returned
    // record. Huge inline image payloads are represented by length + edge
    // samples so photo blobs cannot dominate sync CPU/memory, while normal
    // URL-based photos are captured in full.
    const compactRows = rows => (Array.isArray(rows) ? rows : []).map(row => {
      const out = {};
      Object.keys(row || {}).sort().forEach(key => {
        const value = row[key];
        if (typeof value === 'string' && value.length > 8192) {
          out[key] = {
            __largeString: true,
            length: value.length,
            head: value.slice(0, 256),
            tail: value.slice(-256)
          };
        } else {
          out[key] = value;
        }
      });
      return out;
    });

    const str = JSON.stringify({
      students: compactRows(data && data.students),
      scan_logs: compactRows(data && data.scan_logs),
      temporary_passes: compactRows(data && data.temporary_passes),
      users: compactRows(data && data.users),
      gates: compactRows(data && data.gates)
    });

    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // ════════════════════════════════════════════════════════════
  // OFFLINE WRITE QUEUE
  // ════════════════════════════════════════════════════════════

  async queueWrite(action, data) {
    this.writeQueue.push({ action, data, timestamp: Date.now() });
    writeCache('pgp_write_queue', this.writeQueue);
  }

  async processWriteQueue() {
    if (this.writeQueue.length === 0) return;
    console.log(`Processing ${this.writeQueue.length} queued writes...`);

    const remaining = [];
    for (const item of this.writeQueue) {
      try {
        if (item.action === 'addStudent') await SheetsService.addStudent(item.data);
        else if (item.action === 'addLog') await SheetsService.addLog(item.data);
        else if (item.action === 'addTGP') await SheetsService.addTGP(item.data);
        else if (item.action === 'updateTGPStatus') await SheetsService.updateTGPStatus(item.data.id, item.data.status);
        else if (item.action === 'updateStudentStatus') await SheetsService.updateStudentStatus(item.data.id, item.data.status);
        else if (item.action === 'updateStudent') await SheetsService.updateStudent(item.data);
        else if (item.action === 'removeStudent') await SheetsService.removeStudent(item.data.id);
        console.log('Queued write sent:', item.action);
        // Add delay to prevent rate limiting from backend when processing large queues
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (err) {
        console.error('Queued write failed:', err);
        const errMsg = (err.message || err.toString()).toLowerCase();
        // Drop the item if it's a permanent error (like row not found) to prevent infinite loops
        if (errMsg.includes('not found')) {
          console.warn(`Dropping permanently failed write action: ${item.action}`);
        } else {
          item.retries = (item.retries || 0) + 1;
          if (item.retries > 5) {
            console.warn(`Dropping write action ${item.action} after 5 failed retries.`);
          } else {
            console.log('Keeping in queue for retry...');
            remaining.push(item);
          }
        }
      }
    }
    this.writeQueue = remaining;
    writeCache('pgp_write_queue', this.writeQueue);
  }

  // ════════════════════════════════════════════════════════════
  // STUDENT CRUD — Writes to Sheet + updates local cache
  // ════════════════════════════════════════════════════════════

  async addStudent(student) {
    // Upload image bytes first. Only the returned Blob URL is cached and sent to Sheets.
    if (student.photo instanceof Blob) {
      const filenameBase = student.pgp || student.studid || student.id;
      student.photo = await uploadPhotoLocally(filenameBase, student.photo);
    }

    // Add to local cache immediately
    this.students.push(student);
    this._indexStudent(student);
    writeCache('pgp_students', withoutInlinePhotos(this.students));

    // Write to Sheet
    const sheetData = this.mapStudentToSheet(student);
    try {
      await SheetsService.addStudent(sheetData);
    } catch (err) {
      console.error('Failed to write student to Sheet, queuing...', err);
      await this.queueWrite('addStudent', sheetData);
    }
  }

  async removeStudent(id) {
    this.students = this.students.filter(s => s.id !== id);
    this.rebuildIndexes();
    writeCache('pgp_students', withoutInlinePhotos(this.students));

    try {
      await SheetsService.removeStudent(id);
    } catch (err) {
      console.error('Failed to remove student from Sheet, queuing...', err);
      await this.queueWrite('removeStudent', { id });
    }
  }

  getStudentByPassId(id) {
    return this._studentByPassId.get(id);
  }

  getStudentByStudId(studid) {
    return this._studentByStudId.get(studid);
  }

  async updateStudentStatus(id, status) {
    const student = this.students.find(s => s.id === id || s.pgp === id);
    if (student) {
      student.status = status;
      writeCache('pgp_students', withoutInlinePhotos(this.students));

      // Always send the pgp value (= PassID in Sheet) for reliable backend lookup
      const sheetId = student.pgp || student.id;
      try {
        await SheetsService.updateStudentStatus(sheetId, status);
      } catch (err) {
        console.error('Failed to update status on Sheet, queuing...', err);
        await this.queueWrite('updateStudentStatus', { id: sheetId, status });
      }
    }
  }

  async updateStudent(updatedStudent) {
    const idx = this.students.findIndex(s => s.id === updatedStudent.id);
    if (idx === -1) return;

    // Upload image bytes first. Only the returned Blob URL is cached and sent to Sheets.
    if (updatedStudent.photo instanceof Blob) {
      const current = this.students[idx];
      const filenameBase = updatedStudent.pgp || current.pgp || updatedStudent.studid || current.studid || updatedStudent.id;
      updatedStudent.photo = await uploadPhotoLocally(filenameBase, updatedStudent.photo);
    }

    // Merge updates into local cache
    this.students[idx] = { ...this.students[idx], ...updatedStudent };
    this.rebuildIndexes();
    writeCache('pgp_students', withoutInlinePhotos(this.students));

    // Write full row to Sheet
    const sheetData = this.mapStudentToSheet(this.students[idx]);


    try {
      await SheetsService.updateStudent(sheetData);
    } catch (err) {
      console.error('Failed to update student on Sheet, queuing...', err);
      await this.queueWrite('updateStudent', sheetData);
    }
  }

  async archiveStudent(id) {
    await this.updateStudentStatus(id, 'archived');
  }

  // ════════════════════════════════════════════════════════════
  // EXIT LOG CRUD
  // ════════════════════════════════════════════════════════════

  async addExitLog(logEntry) {
    this.exitLogs.unshift(logEntry);
    writeCache('pgp_logs', this.exitLogs);

    try {
      await SheetsService.addLog(logEntry);
    } catch (err) {
      console.error('Failed to write log to Sheet, queuing...', err);
      await this.queueWrite('addLog', logEntry);
    }
  }

  async clearLogs() {
    this.exitLogs = [];
    writeCache('pgp_logs', this.exitLogs);
  }

  // ════════════════════════════════════════════════════════════
  // EMAIL QUEUE
  // ════════════════════════════════════════════════════════════

  async addEmailToQueue(emailParams) {
    this.emailQueue.push(emailParams);
    writeCache('pgp_email_queue', this.emailQueue);
  }

  async removeEmailFromQueue(index) {
    this.emailQueue.splice(index, 1);
    writeCache('pgp_email_queue', this.emailQueue);
  }

  // ════════════════════════════════════════════════════════════
  // TGP CRUD
  // ════════════════════════════════════════════════════════════

  async addTGP(tgpEntry) {
    this.tgp.unshift(tgpEntry);
    if (tgpEntry.id !== undefined && tgpEntry.id !== null) this._tgpById.set(tgpEntry.id, tgpEntry);
    writeCache('pgp_tgp', this.tgp);

    try {
      await SheetsService.addTGP(tgpEntry);
    } catch (err) {
      console.error('Failed to write TGP to Sheet, queuing...', err);
      await this.queueWrite('addTGP', tgpEntry);
    }
  }

  async updateTGPStatus(id, status) {
    const pass = this._tgpById.get(id) || this.tgp.find(t => t.id === id);
    if (pass) {
      pass.status = status;
      writeCache('pgp_tgp', this.tgp);

      try {
        await SheetsService.updateTGPStatus(id, status);
      } catch (err) {
        console.error('Failed to update TGP status on Sheet, queuing...', err);
        await this.queueWrite('updateTGPStatus', { id, status });
      }
    }
  }

  getTGP(id) {
    return this.tgp.find(t => t.id === id);
  }

  // ════════════════════════════════════════════════════════════
  // GATE CRUD
  // ════════════════════════════════════════════════════════════

  async addGate(gate) {
    this.gates.push(gate);
    writeCache('pgp_gates', this.gates);
    await SheetsService.addGate(this.mapGateToSheet(gate));
  }

  async updateGate(gate) {
    const idx = this.gates.findIndex(g => g.id === gate.id);
    if (idx !== -1) this.gates[idx] = gate;
    writeCache('pgp_gates', this.gates);
    await SheetsService.updateGate(this.mapGateToSheet(gate));
  }

  async removeGate(id) {
    this.gates = this.gates.filter(g => g.id !== id);
    writeCache('pgp_gates', this.gates);
    await SheetsService.removeGate(id);
  }

  // ════════════════════════════════════════════════════════════
  // AUTHENTICATION — Now checks against users from Google Sheet
  // ════════════════════════════════════════════════════════════

  async authenticateUser(username, password) {
    // Try to fetch fresh users from sheet first
    try {
      this.users = await SheetsService.getUsers();
      writeCache('pgp_users', this.users);
    } catch (err) {
      console.warn('Could not fetch users from Sheet, using cached data');
      // users already loaded from localStorage cache
    }

    const hashedPassword = await hashPassword(password);
    
    const user = this.users.find(u =>
      u.username === username && 
      (u.password === hashedPassword || u.password === password) && // Support transition
      (!u.status || u.status.toLowerCase() === 'active')
    );

    if (user) {
      const userPayload = normalizeUserProfile({
        username: user.username,
        name: user.name || user.displayName || user.fullName,
        role: user.role,
        gate: user.gate || '',
        loginTime: new Date().toISOString(),
        lastActivity: Date.now()
      });
      if (!userPayload || !userPayload.username || !userPayload.role) {
        console.error('[AppModel] Refusing login: user record is missing a username or role.');
        return null;
      }
      this.currentUser = userPayload;
      localStorage.setItem('pgp_session', JSON.stringify(userPayload));
      sessionStorage.setItem('pgp_browser_alive', '1');
      return userPayload;
    }
    return null;
  }

  login(userPayload) {
    userPayload = normalizeUserProfile(userPayload);
    if (!userPayload || !userPayload.username || !userPayload.role) {
      throw new Error('Cannot start a session: the user profile is missing a username or role.');
    }
    userPayload.loginTime = new Date().toISOString();
    userPayload.lastActivity = Date.now();
    this.currentUser = userPayload;
    localStorage.setItem('pgp_session', JSON.stringify(userPayload));
    sessionStorage.setItem('pgp_browser_alive', '1');
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('pgp_session');
    sessionStorage.removeItem('pgp_browser_alive');
  }

  // ── Theme / Sidebar / Session ─────────────────────────────
  getTheme() { return localStorage.getItem('pgp_theme') || null; }
  setTheme(theme) {
    if (theme) localStorage.setItem('pgp_theme', theme);
    else localStorage.removeItem('pgp_theme');
  }

  getSidebarCollapsed() { return localStorage.getItem('pgp_sidebar') === 'collapsed'; }
  setSidebarCollapsed(c) { localStorage.setItem('pgp_sidebar', c ? 'collapsed' : 'expanded'); }

  updateActivity() {
    if (!this.currentUser) return;
    this.currentUser.lastActivity = Date.now();
    localStorage.setItem('pgp_session', JSON.stringify(this.currentUser));
  }

  isSessionExpired() {
    if (!this.currentUser) return true;

    // Administrators use a persistent in-browser session and are not subject
    // to the inactivity timeout. The browserAlive flag still prevents a stale
    // localStorage session from surviving a closed browser session.
    const role = String(this.currentUser.role || '').trim().toLowerCase();
    if (role === 'admin') return false;

    if (!this.currentUser.lastActivity) return true;
    return (Date.now() - this.currentUser.lastActivity) > this.SESSION_TIMEOUT;
  }
}
