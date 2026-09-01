import Icons from '../icons.js';
import DashboardView from './DashboardView.js';
import StudentsView from './StudentsView.js';
import ScannerView from './ScannerView.js';
import LogsView from './LogsView.js';
import PGPView from './PGPView.js';
import ReportsView from './ReportsView.js';
import SettingsView from './SettingsView.js';
import TGPView from './TGPView.js';
import UsersView from './UsersView.js';

// Page definitions for navigation
const NAV_SECTIONS = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' }
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { id: 'students', label: 'Student Registry', icon: 'users' },
      { id: 'tgp', label: 'Temporary Passes', icon: 'clock' }
    ]
  },
  {
    title: 'GATE OPERATIONS',
    items: [
      { id: 'scanner', label: 'Gate Scanner', icon: 'scan-line' },
      { id: 'logs', label: 'Exit Logs', icon: 'file-text' }
    ]
  },
  {
    title: 'SYSTEM ADMIN',
    items: [
      { id: 'pgp', label: 'PGP Management', icon: 'shield-check' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart' },
      { id: 'users', label: 'User Management', icon: 'user-cog' },
      { id: 'settings', label: 'Settings', icon: 'settings-gear' }
    ]
  }
];

const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'students', 'scanner', 'logs', 'pgp', 'reports', 'tgp', 'users', 'settings'],
  secretary: ['dashboard', 'students', 'tgp', 'logs'],
  guard: ['dashboard', 'scanner', 'tgp', 'logs']
};

// Bottom nav shows only the most-used pages
const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', icon: 'layout-grid', label: 'Home' },
  { id: 'scanner',   icon: 'scan-line',   label: 'Scanner' },
  { id: 'students',  icon: 'users',       label: 'Students' },
  { id: 'logs',      icon: 'file-text',   label: 'Logs' },
  { id: 'settings',  icon: 'settings-gear', label: 'More' },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  scanner:   'Gate Scanner',
  logs:      'Exit Logs',
  pgp:       'Permanent Gate Passes',
  tgp:       'Temporary Gate Passes',
  students:  'Student Registry',
  reports:   'Reports',
  users:     'User Management',
  settings:  'Settings',
};

export default class AppView {
  constructor() {
    this.currentPage = 'dashboard';
  }

  // ── Render Navigation ─────────────────────────────────
  renderSidebar(model) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    if (!model.currentUser) {
      nav.innerHTML = '';
      const foot = document.querySelector('.sidebar-foot');
      if(foot) foot.style.display = 'none';
      return;
    }

    const permissions = ROLE_PERMISSIONS[model.currentUser.role] || [];
    let html = '';

    NAV_SECTIONS.forEach(section => {
      const allowedItems = section.items.filter(item => permissions.includes(item.id));
      if (allowedItems.length > 0) {
        html += `<div class="nav-sec">${section.title}</div>`;
        allowedItems.forEach(item => {
          const isActive = this.currentPage === item.id ? 'active' : '';
          html += `
            <button class="nav-item ${isActive}" data-page="${item.id}">
              <span class="nav-icon">${Icons[item.icon](16)}</span>
              <span class="nav-label">${item.label}</span>
            </button>
          `;
        });
      }
    });

    nav.innerHTML = html;

    // Update footer elements
    const foot = document.querySelector('.sidebar-foot');
    if(foot) foot.style.display = 'block';

    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = model.currentUser.name.substring(0, 1).toUpperCase();
    
    const uname = document.getElementById('user-name');
    if (uname) uname.textContent = model.currentUser.name;
    
    const urole = document.getElementById('user-role');
    if (urole) urole.textContent = model.currentUser.role.toUpperCase();

    const logoutIcon = document.getElementById('logout-icon');
    if (logoutIcon) logoutIcon.innerHTML = Icons['log-out'](14);
    
    const collapseIcon = document.getElementById('collapse-icon');
    if (collapseIcon) collapseIcon.innerHTML = Icons['chevron-left'](14);
  }

  renderBottomNav(model) {
    const inner = document.getElementById('bottom-nav-inner');
    if (!inner) return;

    if (!model.currentUser) {
      inner.innerHTML = '';
      document.getElementById('bottom-nav').style.display = 'none';
      return;
    }
    document.getElementById('bottom-nav').style.display = '';

    const permissions = ROLE_PERMISSIONS[model.currentUser.role] || [];
    const allItems = NAV_SECTIONS.flatMap(s => s.items).filter(item => permissions.includes(item.id));

    // Use BOTTOM_NAV_ITEMS priority order for the 4 main slots
    const priorityIds = BOTTOM_NAV_ITEMS.slice(0, 4).map(i => i.id);
    const mobileItems = priorityIds
      .filter(id => permissions.includes(id))
      .map(id => BOTTOM_NAV_ITEMS.find(i => i.id === id));

    // "More" appears if any permitted page is not already in the 4 main slots
    const hasMore = allItems.some(item => !mobileItems.find(m => m.id === item.id));
    const isMoreActive = hasMore && !mobileItems.find(m => m.id === this.currentPage);

    let html = mobileItems.map(item => `
      <button class="bottom-nav-item ${this.currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
        ${Icons[item.icon](20)}
        <span>${item.label}</span>
      </button>
    `).join('');

    if (hasMore) {
      html += `
        <button class="bottom-nav-item ${isMoreActive ? 'active' : ''}" id="btn-bottom-more">
          ${Icons['menu'](20)}
          <span>More</span>
        </button>
      `;
    }

    inner.innerHTML = html;
  }

  // ── Sync UI ───────────────────────────────────────────
  renderSyncStatus(model) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    if (!model.isOnline) {
      dot.className = 'badge b-denied';
      text.textContent = 'Offline';
    } else if (model.syncStatus === 'syncing') {
      dot.className = 'badge b-pending';
      text.textContent = 'Syncing...';
    } else {
      dot.className = 'badge b-active';
      if (model.lastSyncTime) {
        const secs = Math.floor((Date.now() - model.lastSyncTime) / 1000);
        text.textContent = secs < 60 ? `Synced ${secs}s ago` : `Synced ${Math.floor(secs/60)}m ago`;
      } else {
        text.textContent = 'Online';
      }
    }
  }

  // ── Render topbar icons ───────────────────────────────
  renderTopbarIcons(isDark) {
    const menuIcon = document.getElementById('menu-icon');
    if (menuIcon) menuIcon.innerHTML = Icons['menu'](18);

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) themeIcon.innerHTML = isDark ? Icons['sun'](18) : Icons['moon'](18);
  }

  // ── Navigate to page ──────────────────────────────────
  showPage(pageId, model) {
    this.currentPage = pageId;

    const sidebar = document.getElementById('sidebar');
    const topbar = document.getElementById('topbar');
    const bottomNav = document.getElementById('bottom-nav');
    const main = document.querySelector('.main');

    // Update topbar title
    const title = document.getElementById('topbar-title');
    if (title) title.textContent = PAGE_TITLES[pageId] || 'e-gatepass';

    // The app shell is only ever rendered for a signed-in user
    if (sidebar) sidebar.style.display = '';
    if (topbar) topbar.style.display = '';
    if (bottomNav) bottomNav.style.display = '';
    if (main) {
      main.style.marginLeft = '';
      main.style.paddingBottom = '';
    }

    // Re-render navs to update active state
    if (model.currentUser) {
      this.renderSidebar(model);
      this.renderBottomNav(model);
    }

    // Render page content
    const content = document.getElementById('page-content');
    if (content) {
      if (model.syncStatus === 'syncing' && !model.lastSyncTime) {
        content.innerHTML = this.renderPageSkeleton(pageId);
      } else {
        content.innerHTML = this.renderPageContent(pageId, model);
      }
    }
  }

  // ── Page Skeleton ───────────────────────────────────────
  renderPageSkeleton(pageId) {
    if (pageId === 'students' || pageId === 'logs' || pageId === 'tgp' || pageId === 'users') {
      return `
        <div class="card">
          <div class="card-head">
            <div>
              <div class="skeleton" style="width: 150px; height: 24px; margin-bottom: 4px;"></div>
              <div class="skeleton" style="width: 100px; height: 16px;"></div>
            </div>
          </div>
          <div style="padding: 16px;">
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
            <div class="skeleton skeleton-row"></div>
          </div>
        </div>
      `;
    }
    if (pageId === 'dashboard') {
      return `
        <div class="grid-4 mb-20">
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        </div>
        <div class="grid-2">
          <div class="skeleton skeleton-card" style="height: 300px;"></div>
          <div class="skeleton skeleton-card" style="height: 300px;"></div>
        </div>
      `;
    }
    // Generic fallback skeleton
    return `
      <div style="padding: 20px;">
        <div class="skeleton skeleton-row" style="height: 40px; margin-bottom: 20px;"></div>
        <div class="skeleton skeleton-card" style="height: 200px;"></div>
      </div>
    `;
  }

  // ── Page content router ───────────────────────────────
  renderPageContent(pageId, model) {
    if (pageId === 'dashboard') return DashboardView.render(model);
    if (pageId === 'students') return StudentsView.render(model);
    if (pageId === 'scanner') return ScannerView.render(model);
    if (pageId === 'logs') return LogsView.render(model);
    if (pageId === 'pgp') return PGPView.render(model);
    if (pageId === 'reports') return ReportsView.render(model);
    if (pageId === 'settings') return SettingsView.render(model);
    if (pageId === 'tgp') return TGPView.render(model);
    if (pageId === 'users') return UsersView.render(model);
    const iconName = NAV_SECTIONS
      .flatMap(s => s.items)
      .find(i => i.id === pageId)?.icon || 'layout-grid';

    const title = PAGE_TITLES[pageId] || pageId;

    // Phase 1: All pages are placeholders
    // Phase 2+ will replace these with actual content
    return `
      <div class="page-placeholder">
        <div class="page-placeholder-icon">${Icons[iconName](64)}</div>
        <div class="page-placeholder-title">${title}</div>
        <div class="page-placeholder-sub">Coming in Phase 2 — This page will be built next</div>
      </div>
    `;
  }

  // ── Theme ─────────────────────────────────────────────
  applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      html.setAttribute('data-theme', theme);
    } else {
      html.removeAttribute('data-theme');
    }
    const isDark = this.isDarkMode();
    this.renderTopbarIcons(isDark);

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isDark ? '#0c0a14' : '#422467';
  }

  isDarkMode() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit === 'dark';
    return false; // Default is strictly light theme now
  }

  // ── Sidebar collapse ─────────────────────────────────
  setSidebarCollapsed(collapsed) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed', collapsed);
    
    const collapseIcon = document.getElementById('collapse-icon');
    if (collapseIcon) {
      collapseIcon.innerHTML = collapsed ? Icons['arrow-right'](14) : Icons['chevron-left'](14);
    }
  }

  // ── Mobile sidebar ────────────────────────────────────
  openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('visible');
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('visible');
  }

  // ── Toast notifications ───────────────────────────────
  showToast(msg, type = 'success') {
    const root = document.getElementById('toast-root');
    if (!root) return;

    const typeMap = {
      success: { icon: 'check-circle',    css: 'toast-success' },
      error:   { icon: 'alert-triangle',  css: 'toast-error' },
      warning: { icon: 'alert-triangle',  css: 'toast-warning' },
      info:    { icon: 'info',            css: 'toast-info' }
    };
    const { icon: iconName, css: cssClass } = typeMap[type] || typeMap.success;

    const toast = document.createElement('div');
    toast.className = `toast ${cssClass}`;
    toast.innerHTML = `${Icons[iconName](16)} <span></span>`;
    toast.querySelector('span').textContent = String(msg);
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

export { NAV_SECTIONS, BOTTOM_NAV_ITEMS, PAGE_TITLES, ROLE_PERMISSIONS };

export function setButtonLoading(btn, isLoading, originalHtml = '') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> <span style="margin-left: 6px;">Loading...</span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = originalHtml || btn.dataset.originalHtml || 'Submit';
    btn.disabled = false;
  }
}
