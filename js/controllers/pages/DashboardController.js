export default class DashboardController {
  static bind(controller) {
    // ── Quick Action Buttons ────────────────────────────────
    const btnScan = document.getElementById('dash-btn-scan');
    const btnEnroll = document.getElementById('dash-btn-enroll');
    const btnQuickLogs = document.getElementById('dash-btn-quick-logs');
    const btnViewAll = document.getElementById('dash-btn-logs');
    const btnReports = document.getElementById('dash-btn-reports');
    const btnTgp = document.getElementById('dash-btn-tgp');
    const btnSettings = document.getElementById('dash-btn-settings');

    if (btnScan) btnScan.addEventListener('click', () => controller.navigateToPage('scanner'));
    if (btnQuickLogs) btnQuickLogs.addEventListener('click', () => controller.navigateToPage('logs'));
    if (btnViewAll) btnViewAll.addEventListener('click', () => controller.navigateToPage('logs'));
    if (btnReports) btnReports.addEventListener('click', () => controller.navigateToPage('reports'));
    if (btnTgp) btnTgp.addEventListener('click', () => controller.navigateToPage('tgp'));
    if (btnSettings) btnSettings.addEventListener('click', () => controller.navigateToPage('settings'));
    if (btnEnroll) btnEnroll.addEventListener('click', () => {
      controller.navigateToPage('students');
      setTimeout(() => {
        const addBtn = document.getElementById('btn-add-student');
        if (addBtn) addBtn.click();
      }, 100);
    });

    // ── Clickable Stat Cards → Navigate ─────────────────────
    document.querySelectorAll('.dash-stat-link[data-nav]').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.nav;
        if (target) controller.navigateToPage(target);
      });
    });

    // ── Live Clock (updates every second) ───────────────────
    if (controller._dashClockInterval) clearInterval(controller._dashClockInterval);
    controller._dashClockInterval = setInterval(() => {
      const now = new Date();
      const timeEl = document.getElementById('dash-live-time');
      const dateEl = document.getElementById('dash-live-date');
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('en-PH', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-PH', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
      }
    }, 1000);

    // ── System Health: Live sync timer (updates every 5s) ───
    if (controller._dashHealthInterval) clearInterval(controller._dashHealthInterval);
    controller._dashHealthInterval = setInterval(() => {
      const el = document.getElementById('dash-health-sync');
      if (el && controller.model.lastSyncTime) {
        const secs = Math.floor((Date.now() - controller.model.lastSyncTime) / 1000);
        if (secs < 5) el.textContent = 'Just now';
        else if (secs < 60) el.textContent = `${secs}s ago`;
        else if (secs < 3600) el.textContent = `${Math.floor(secs / 60)}m ago`;
        else el.textContent = `${Math.floor(secs / 3600)}h ago`;
      }
    }, 5000);
  }
}
