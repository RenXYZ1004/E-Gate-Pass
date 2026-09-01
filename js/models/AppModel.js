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

export default class AppModel {
  constructor() {
    // Load cached data from localStorage (instant load)
    this.students = readCache('pgp_students', []);
    this.exitLogs = readCache('pgp_logs', []);
    this.tgp = readCache('pgp_tgp', []);
    this.users = readCache('pgp_users', []);
    this.emailQueue = readCache('pgp_email_queue', []);

    // Session management
    const profile = readCache('pgp_session', null);
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
  }

  // ════════════════════════════════════════════════════════════
  // SYNC ENGINE — Pulls fresh data from Google Sheets
  // ════════════════════════════════════════════════════════════

  async syncFromSheet() {
    this.syncStatus = 'syncing';
    try {
      const data = await SheetsService.getAll();

      // Change detection: compare hash before updating
      const newHash = this.computeDataHash(data);
      const hasChanged = newHash !== this.lastDataHash;
      this.lastDataHash = newHash;

      // Map Sheet columns to frontend field names
      this.students = (data.students || []).map(s => this.mapStudentFromSheet(s));
      this.exitLogs = (data.scan_logs || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      this.tgp = data.temporary_passes || [];
      this.users = data.users || [];

      // Cache to localStorage
      this.cacheAll();
      this.lastSyncTime = Date.now();
      localStorage.setItem('pgp_last_sync', this.lastSyncTime.toString());
      this.syncStatus = 'idle';
      this.isOnline = true;

      // Process any queued offline writes
      await this.processWriteQueue();

      return { success: true, changed: hasChanged };
    } catch (err) {
      console.error('Sync failed:', err);
      this.syncStatus = 'error';
      this.isOnline = false;
      return { success: false, changed: false };
    }
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
      // Photo is normally a Vercel Blob URL. Accept the common alternate
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
      // Only include the photo if it exists. We'll strip it later if it's too large to prevent network crashes.
      Photo: s.photo || '',
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
    localStorage.setItem('pgp_students', JSON.stringify(this.students));
    localStorage.setItem('pgp_logs', JSON.stringify(this.exitLogs));
    localStorage.setItem('pgp_tgp', JSON.stringify(this.tgp));
    localStorage.setItem('pgp_users', JSON.stringify(this.users));
  }

  // ── Change Detection ─────────────────────────────────────
  computeDataHash(data) {
    const str = JSON.stringify({
      studentCount: (data.students || []).length,
      logCount: (data.scan_logs || []).length,
      tgpCount: (data.temporary_passes || []).length,
      userCount: (data.users || []).length,
      firstStudent: (data.students || [])[0]?.PassID || '',
      lastStudent: (data.students || []).slice(-1)[0]?.PassID || '',
      firstLog: (data.scan_logs || [])[0]?.id || '',
      lastLog: (data.scan_logs || []).slice(-1)[0]?.id || '',
      // Include a snapshot of statuses for edit detection
      statusSnapshot: (data.students || []).map(s => s.Status || '').join(',')
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash;
  }

  // ════════════════════════════════════════════════════════════
  // OFFLINE WRITE QUEUE
  // ════════════════════════════════════════════════════════════

  async queueWrite(action, data) {
    this.writeQueue.push({ action, data, timestamp: Date.now() });
    localStorage.setItem('pgp_write_queue', JSON.stringify(this.writeQueue));
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
    localStorage.setItem('pgp_write_queue', JSON.stringify(this.writeQueue));
  }

  // ════════════════════════════════════════════════════════════
  // STUDENT CRUD — Writes to Sheet + updates local cache
  // ════════════════════════════════════════════════════════════

  async addStudent(student) {
    // Intercept Base64 photos and save them locally to prevent Google Sheets bloat
    if (student.photo && student.photo.startsWith('data:image')) {
      const filenameBase = student.pgp || student.studid || student.id;
      student.photo = await uploadPhotoLocally(filenameBase, student.photo);
    }

    // Add to local cache immediately
    this.students.push(student);
    localStorage.setItem('pgp_students', JSON.stringify(this.students));

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
    localStorage.setItem('pgp_students', JSON.stringify(this.students));

    try {
      await SheetsService.removeStudent(id);
    } catch (err) {
      console.error('Failed to remove student from Sheet, queuing...', err);
      await this.queueWrite('removeStudent', { id });
    }
  }

  getStudentByPassId(id) {
    return this.students.find(s => s.id === id || s.pgp === id);
  }

  getStudentByStudId(studid) {
    return this.students.find(s => s.studid === studid || s.id === studid);
  }

  async updateStudentStatus(id, status) {
    const student = this.students.find(s => s.id === id || s.pgp === id);
    if (student) {
      student.status = status;
      localStorage.setItem('pgp_students', JSON.stringify(this.students));

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

    // Intercept Base64 photos and save them locally
    if (updatedStudent.photo && updatedStudent.photo.startsWith('data:image')) {
      const filenameBase = updatedStudent.pgp || updatedStudent.studid || updatedStudent.id;
      updatedStudent.photo = await uploadPhotoLocally(filenameBase, updatedStudent.photo);
    }

    // Merge updates into local cache
    this.students[idx] = { ...this.students[idx], ...updatedStudent };
    localStorage.setItem('pgp_students', JSON.stringify(this.students));

    // Write full row to Sheet
    const sheetData = this.mapStudentToSheet(this.students[idx]);

    // CRITICAL FIX: If the Photo is a massive legacy Base64 string (>50KB), 
    // DO NOT send it in this payload. Apps Script will keep the existing photo 
    // if the key is undefined. This prevents the "Failed to fetch" error!
    if (sheetData.Photo && sheetData.Photo.length > 50000) {
      console.warn(`[AppModel] Stripping massive legacy photo from payload to prevent network crash.`);
      delete sheetData.Photo;
    }

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
    localStorage.setItem('pgp_logs', JSON.stringify(this.exitLogs));

    try {
      await SheetsService.addLog(logEntry);
    } catch (err) {
      console.error('Failed to write log to Sheet, queuing...', err);
      await this.queueWrite('addLog', logEntry);
    }
  }

  async clearLogs() {
    this.exitLogs = [];
    localStorage.setItem('pgp_logs', JSON.stringify(this.exitLogs));
  }

  // ════════════════════════════════════════════════════════════
  // EMAIL QUEUE
  // ════════════════════════════════════════════════════════════

  async addEmailToQueue(emailParams) {
    this.emailQueue.push(emailParams);
    localStorage.setItem('pgp_email_queue', JSON.stringify(this.emailQueue));
  }

  async removeEmailFromQueue(index) {
    this.emailQueue.splice(index, 1);
    localStorage.setItem('pgp_email_queue', JSON.stringify(this.emailQueue));
  }

  // ════════════════════════════════════════════════════════════
  // TGP CRUD
  // ════════════════════════════════════════════════════════════

  async addTGP(tgpEntry) {
    this.tgp.unshift(tgpEntry);
    localStorage.setItem('pgp_tgp', JSON.stringify(this.tgp));

    try {
      await SheetsService.addTGP(tgpEntry);
    } catch (err) {
      console.error('Failed to write TGP to Sheet, queuing...', err);
      await this.queueWrite('addTGP', tgpEntry);
    }
  }

  async updateTGPStatus(id, status) {
    const pass = this.tgp.find(t => t.id === id);
    if (pass) {
      pass.status = status;
      localStorage.setItem('pgp_tgp', JSON.stringify(this.tgp));

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
  // AUTHENTICATION — Now checks against users from Google Sheet
  // ════════════════════════════════════════════════════════════

  async authenticateUser(username, password) {
    // Try to fetch fresh users from sheet first
    try {
      this.users = await SheetsService.getUsers();
      localStorage.setItem('pgp_users', JSON.stringify(this.users));
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
      const userPayload = {
        username: user.username,
        name: user.name,
        role: user.role,
        gate: user.gate || '',
        loginTime: new Date().toISOString(),
        lastActivity: Date.now()
      };
      this.currentUser = userPayload;
      localStorage.setItem('pgp_session', JSON.stringify(userPayload));
      sessionStorage.setItem('pgp_browser_alive', '1');
      return userPayload;
    }
    return null;
  }

  login(userPayload) {
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
    if (!this.currentUser || !this.currentUser.lastActivity) return true;
    return (Date.now() - this.currentUser.lastActivity) > this.SESSION_TIMEOUT;
  }
}
