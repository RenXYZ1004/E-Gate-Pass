// ════════════════════════════════════════════════════════════════
// Central app configuration
// Single source of truth for values that used to be hard-coded in
// several files (index.html, SheetsService.js, ...).
// ════════════════════════════════════════════════════════════════

// Google Apps Script Web App endpoint (Sheets backend).
export const SHEETS_API_URL =
  'https://script.google.com/macros/s/AKfycbzac8i25a5Z-kh21dfXG20xqFi0OQ0i4YEjTHjwvaToyvfYttrEFMuo0Zk6j2wsv_IbcA/exec';

// Update the school year here once per academic year instead of maintaining
// separate hard-coded labels and pass-number prefixes throughout the site.
export const SCHOOL_YEAR_START = 2026;
export const SCHOOL_YEAR_END = SCHOOL_YEAR_START + 1;
export const SCHOOL_YEAR = `${SCHOOL_YEAR_START}-${SCHOOL_YEAR_END}`;
export const SCHOOL_YEAR_LABEL = `SY ${SCHOOL_YEAR_START}–${SCHOOL_YEAR_END}`;
export const COPYRIGHT_YEAR = new Date().getFullYear();
export const SCHOOL_TIME_ZONE = 'Asia/Manila';

// The one and only login page. Everything that needs a login sends the
// user here — there is no second, in-app login form.
//
// These are extensionless because vercel.json sets cleanUrls, which serves
// index.html at / and app.html at /app, and 308-redirects the .html form.
// They stay relative so the app still works when it is served from a
// subdirectory (the XAMPP layout in the README) rather than a domain root.
export const LOGIN_PAGE = './';

// Signed-in application shell.
export const APP_PAGE = './app.html';

// localStorage / sessionStorage keys.
export const STORAGE_KEYS = {
  session: 'pgp_session',
  browserAlive: 'pgp_browser_alive',
  students: 'pgp_students',
  logs: 'pgp_logs',
  tgp: 'pgp_tgp',
  users: 'pgp_users',
  emailQueue: 'pgp_email_queue',
  writeQueue: 'pgp_write_queue',
  lastSync: 'pgp_last_sync',
  theme: 'pgp_theme',
  sidebar: 'pgp_sidebar',
  gates: 'pgp_gates'
};

// Inactivity before the session is dropped (ms).
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Build the URL of the main login page, optionally carrying a notice
 * that index.html will surface inside the login modal.
 * @param {string} [notice] - human readable reason (e.g. "Session expired")
 * @returns {string}
 */
export function loginUrl(notice) {
  return notice ? `${LOGIN_PAGE}?notice=${encodeURIComponent(notice)}` : LOGIN_PAGE;
}