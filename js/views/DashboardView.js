import Icons from '../icons.js';
import { escapeHTML, resolvePhotoUrl, hasPhoto } from '../utils.js';

export default class DashboardView {
  static render(model) {
    const students = model.students || [];
    const logs = model.exitLogs || [];
    const user = model.currentUser;
    const isGuard = user && user.role === 'guard';

    // ── Date & time calculations ──────────────────────────
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    const todayLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(today));
    const todayGranted = todayLogs.filter(l => l.result !== 'denied').length;
    const todayDenied = todayLogs.filter(l => l.result === 'denied').length;

    // Yesterday comparison for trend indicator
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const yesterdayExits = logs.filter(l => l.timestamp && l.timestamp.startsWith(yesterdayStr)).length;
    const exitDiff = todayLogs.length - yesterdayExits;

    // General stats
    const totalStudents = students.length;
    const activePGP = students.filter(s => s.status === 'active').length;

    // Greeting based on time of day
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const userName = user ? user.name : 'User';
    const userRole = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

    // Trend arrow
    const trendIcon = exitDiff > 0 ? '▲' : exitDiff < 0 ? '▼' : '—';
    const trendColor = exitDiff > 0 ? 'var(--green)' : exitDiff < 0 ? 'var(--red)' : 'var(--text3)';
    const trendText = exitDiff !== 0 ? `${Math.abs(exitDiff)} vs yesterday` : 'Same as yesterday';

    // Grade breakdown from today's logs
    const gradeBreakdown = {};
    todayLogs.forEach(log => {
      const student = model.getStudentByPassId(log.studentId) || model.getStudentByStudId(log.studentId);
      const grade = student ? (student.grade || 'Unknown') : 'Unknown';
      gradeBreakdown[grade] = (gradeBreakdown[grade] || 0) + 1;
    });
    const sortedGrades = Object.entries(gradeBreakdown).sort((a, b) => b[1] - a[1]);
    const maxGradeCount = sortedGrades.length > 0 ? sortedGrades[0][1] : 1;

    // System health
    const lastSyncAgo = model.lastSyncTime ? this.timeAgo(model.lastSyncTime) : 'Never';
    const offlineQueue = model.writeQueue ? model.writeQueue.length : 0;

    return `
      <!-- ── Greeting Banner ──────────────────────────────── -->
      <div class="dash-greeting">
        <div class="dash-greeting-left">
          <div class="dash-greeting-text">${greeting}, <strong>${escapeHTML(userName)}</strong></div>
          <div class="dash-greeting-meta">
            <span class="badge b-info" style="font-size:10px;padding:1px 8px;">${escapeHTML(userRole)}</span>
            <span class="dash-greeting-date" id="dash-live-date">${now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span class="dash-greeting-time" id="dash-live-time">${now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
        <div class="dash-greeting-right">${Icons['layout-grid'](28)}</div>
      </div>

      <!-- ── Stat Cards (clickable) ───────────────────────── -->
      <div class="stats-row">
        <a class="stat dash-stat-link" data-nav="pgp">
          <div class="stat-icon">${Icons['shield-check'](20)}</div>
          <div class="stat-val" style="color:var(--accent-d);">${activePGP}</div>
          <div class="stat-lbl">Active PGP Passes</div>
          <div class="stat-sub">Valid for SY 2026–2027</div>
        </a>
        <a class="stat dash-stat-link" data-nav="students">
          <div class="stat-icon">${Icons['users'](20)}</div>
          <div class="stat-val" style="color:var(--primary);">${totalStudents}</div>
          <div class="stat-lbl">Enrolled Students</div>
          <div class="stat-sub">Registered in system</div>
        </a>
        <a class="stat dash-stat-link" data-nav="logs">
          <div class="stat-icon">${Icons['door-open'](20)}</div>
          <div class="stat-val" style="color:var(--green);">${todayLogs.length}</div>
          <div class="stat-lbl">Today's Exits</div>
          <div class="stat-sub"><span style="color:${trendColor};font-weight:700;">${trendIcon} ${trendText}</span></div>
        </a>
        <a class="stat dash-stat-link" data-nav="logs">
          <div class="stat-icon">${Icons['x-circle'](20)}</div>
          <div class="stat-val" style="color:var(--red);">${todayDenied}</div>
          <div class="stat-lbl">Denied Today</div>
          <div class="stat-sub">${todayDenied === 0 ? 'No denied attempts' : `${todayDenied} blocked scan${todayDenied !== 1 ? 's' : ''}`}</div>
        </a>
      </div>

      <!-- ── Main Content Grid ────────────────────────────── -->
      <div class="grid-2">
        <!-- Left: Activity Feed -->
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Today's Exit Activity</div>
              <div class="card-sub">Real-time gate scans</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="dash-btn-logs">View All</button>
          </div>
          <div class="dash-summary-row">
            <div class="dash-summary-item dash-summary-granted">
              ${Icons['check-circle'](14)}
              <span>${todayGranted} Granted</span>
            </div>
            <div class="dash-summary-item dash-summary-denied">
              ${Icons['x-circle'](14)}
              <span>${todayDenied} Denied</span>
            </div>
            <div class="dash-summary-item">
              ${Icons['clock'](14)}
              <span>${todayLogs.length} Total</span>
            </div>
          </div>
          <div class="dash-activity-feed">
            ${this.renderActivityFeed(todayLogs, model)}
          </div>
        </div>

        <!-- Right: Quick Actions + System Health + Grade Breakdown -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Quick Actions -->
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Quick Actions</div>
                <div class="card-sub">Common tasks</div>
              </div>
            </div>
            <div class="card-body">
              <div class="dash-actions-grid">
                <button class="dash-action-btn dash-action-primary" id="dash-btn-scan">
                  ${Icons['scan-line'](20)}
                  <span>Gate Scanner</span>
                </button>
                ${!isGuard ? `
                <button class="dash-action-btn dash-action-teal" id="dash-btn-enroll">
                  ${Icons['plus'](20)}
                  <span>Enroll Student</span>
                </button>` : `
                <button class="dash-action-btn dash-action-teal" id="dash-btn-tgp">
                  ${Icons['clock'](20)}
                  <span>Temp Passes</span>
                </button>`}
                <button class="dash-action-btn" id="dash-btn-quick-logs">
                  ${Icons['file-text'](20)}
                  <span>Exit Logs</span>
                </button>
                ${!isGuard ? `
                <button class="dash-action-btn" id="dash-btn-reports">
                  ${Icons['bar-chart'](20)}
                  <span>Reports</span>
                </button>` : `
                <button class="dash-action-btn" id="dash-btn-settings">
                  ${Icons['settings-gear'](20)}
                  <span>Settings</span>
                </button>`}
              </div>
            </div>
          </div>

          <!-- System Health -->
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">System Health</div>
                <div class="card-sub">Infrastructure status</div>
              </div>
              ${Icons['info'](18)}
            </div>
            <div class="card-body">
              <div class="dash-health-grid">
                <div class="dash-health-item">
                  <div class="dash-health-label">Last Sync</div>
                  <div class="dash-health-value" id="dash-health-sync">${lastSyncAgo}</div>
                </div>
                <div class="dash-health-item">
                  <div class="dash-health-label">Connection</div>
                  <div class="dash-health-value">
                    <span class="badge ${model.isOnline ? 'b-active' : 'b-denied'}" style="font-size:10px;">${model.isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
                <div class="dash-health-item">
                  <div class="dash-health-label">Offline Queue</div>
                  <div class="dash-health-value">${offlineQueue === 0
                    ? '<span style="color:var(--green);">Clear</span>'
                    : `<span style="color:var(--orange);font-weight:700;">${offlineQueue} pending</span>`}</div>
                </div>
                <div class="dash-health-item">
                  <div class="dash-health-label">Students Loaded</div>
                  <div class="dash-health-value">${totalStudents}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Exits by Grade (only if exits exist today) -->
          ${sortedGrades.length > 0 ? `
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Exits by Grade</div>
                <div class="card-sub">Today's breakdown</div>
              </div>
              ${Icons['bar-chart'](18)}
            </div>
            <div class="card-body">
              ${sortedGrades.slice(0, 6).map(([grade, count]) => `
                <div class="dash-grade-bar">
                  <div class="dash-grade-label">${escapeHTML(grade)}</div>
                  <div class="dash-grade-track">
                    <div class="dash-grade-fill" style="width:${Math.round((count / maxGradeCount) * 100)}%;"></div>
                  </div>
                  <div class="dash-grade-count">${count}</div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  // ── Activity Feed Rows (proper CSS classes, no inline styles) ──
  static renderActivityFeed(logs, model) {
    if (!logs || logs.length === 0) {
      return `
        <div class="empty" style="padding:32px;">
          <div class="empty-icon">${Icons['clock'](36)}</div>
          <div class="empty-title">No exits today</div>
          <div class="empty-sub">Gate scans will appear here in real time</div>
        </div>
      `;
    }

    const recentLogs = logs.slice(0, 15);

    return recentLogs.map(log => {
      const student = model.getStudentByPassId(log.studentId) || model.getStudentByStudId(log.studentId);
      const sName = student ? escapeHTML(student.name) : 'Unknown Student';
      const sGrade = student ? escapeHTML(student.fullSection || student.grade) : 'Unknown Grade';
      const isDenied = log.result === 'denied';
      const timeStr = new Date(log.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const initials = sName !== 'Unknown Student' ? sName.substring(0, 2).toUpperCase() : '??';

      return `
        <div class="dash-activity-row${isDenied ? ' dash-activity-denied' : ''}">
          <div class="dash-activity-avatar${isDenied ? ' denied' : ''}">
            ${student && hasPhoto(student.photo)
              ? `<img src="${resolvePhotoUrl(student.photo)}" alt="${sName}">`
              : initials}
          </div>
          <div class="dash-activity-info">
            <div class="dash-activity-name">${sName}</div>
            <div class="dash-activity-meta">${sGrade} · ${log.gate || 'Gate 1'}</div>
          </div>
          <div class="dash-activity-status">
            <span class="badge ${isDenied ? 'b-denied' : 'b-active'}">${isDenied ? 'Denied' : 'Granted'}</span>
            <div class="dash-activity-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Helper: human-readable time ago ─────────────────────
  static timeAgo(timestamp) {
    const secs = Math.floor((Date.now() - timestamp) / 1000);
    if (secs < 5) return 'Just now';
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }
}
