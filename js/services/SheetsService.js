import { SHEETS_API_URL as API_URL } from '../config.js';

// ════════════════════════════════════════════════════════════════
// SheetsService — Google Sheets API Wrapper
// All network calls to the Apps Script Web App go through here.
// The endpoint itself lives in js/config.js (single source of truth).
// ════════════════════════════════════════════════════════════════

export default class SheetsService {

  // ── Generic GET request ───────────────────────────────────
  static async get(action, params = {}) {
    const query = new URLSearchParams({ action, ...params, _t: Date.now() }).toString();
    const url = `${API_URL}?${query}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API returned HTTP ${res.status}`);
    let json;
    try {
      json = await res.json();
    } catch (_) {
      throw new Error('Sheets API returned a non-JSON response (check the Web App deployment).');
    }
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
  }

  static async post(action, body = {}) {
    const url = `${API_URL}?action=${action}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Sheets API returned HTTP ${res.status}`);
      let json;
      try {
        json = await res.json();
      } catch (_) {
        throw new Error('Sheets API returned a non-JSON response (check the Web App deployment).');
      }
      if (!json.success) throw new Error(json.error || 'API error');
      return json.data;
    } catch (err) {
      console.error('Sheets API POST Error:', err);
      // Note: Callers handle errors with toast notifications — no alert() needed
      throw err;
    }
  }

  // ── Bulk fetch (single network call for ALL data) ─────────
  static async getAll() {
    return this.get('getAll');
  }

  // ── Students ──────────────────────────────────────────────
  static async getStudents() { return this.get('getStudents'); }

  static async addStudent(student) {
    return this.post('addStudent', student);
  }

  static async updateStudentStatus(id, status) {
    return this.post('updateStudentStatus', { id, status });
  }

  static async updateStudent(student) {
    return this.post('updateStudent', student);
  }

  static async removeStudent(id) {
    return this.post('removeStudent', { id });
  }

  // ── Scan Logs ─────────────────────────────────────────────
  static async getLogs() { return this.get('getLogs'); }

  static async addLog(logEntry) {
    return this.post('addLog', logEntry);
  }

  // ── Temporary Gate Passes ─────────────────────────────────
  static async getTGP() { return this.get('getTGP'); }

  static async addTGP(tgp) {
    return this.post('addTGP', tgp);
  }

  static async updateTGPStatus(id, status) {
    return this.get('updateTGPStatus', { id, status });
  }

  // ── Users ─────────────────────────────────────────────────
  static async getUsers() { return this.get('getUsers'); }
}
