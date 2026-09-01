import Icons from '../icons.js';
import { escapeHTML, resolvePhotoUrl, hasPhoto } from '../utils.js';

export default class PGPView {
  static render(model) {
    const students = model.students || [];
    // In the legacy data model, every student with a PGP string is considered to have a pass.
    const passes = students.filter(s => s.pgp);

    const activeCount = passes.filter(p => p.status === 'active').length;
    const suspendedCount = passes.filter(p => p.status === 'suspended').length;
    const revokedCount = passes.filter(p => p.status === 'revoked').length;
    const complianceRate = passes.length > 0 ? ((activeCount / passes.length) * 100).toFixed(1) + '%' : '0%';

    return `
      <div class="kpi-strip">
        <div class="kpi-card kpi-green">
          <div class="kpi-icon">${Icons['check-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${activeCount}</div><div class="kpi-lbl">Active Passes</div></div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon">${Icons['alert-triangle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${suspendedCount}</div><div class="kpi-lbl">Suspended</div></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon">${Icons['x-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${revokedCount}</div><div class="kpi-lbl">Revoked</div></div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon">${Icons['shield-check'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${complianceRate}</div><div class="kpi-lbl">Compliance Rate</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Permanent Gate Passes (PGP)</div>
            <div class="card-sub">Manage active, suspended, and revoked long-term passes</div>
          </div>
        </div>
        
        <div style="padding: 16px; border-bottom: 1px solid var(--border); background: var(--bg-elevated);">
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center;">
            <div style="flex: 1; min-width: 200px; margin: 0;">
              <input type="text" id="pgp-search" class="form-input" placeholder="Search ID or Name...">
            </div>
            <div style="width: 150px; margin: 0;">
              <select id="pgp-filter-grade" class="form-input">
                <option value="all">All Grades</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
                <option value="IB1">IB1</option>
                <option value="IB2">IB2</option>
              </select>
            </div>
            <div style="width: 140px; margin: 0;">
              <input type="text" id="pgp-filter-section" class="form-input" placeholder="Section...">
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="pgp-filters">
              <button class="pill on" data-filter="all">All</button>
              <button class="pill" data-filter="active">Active</button>
              <button class="pill" data-filter="suspended">Suspended</button>
              <button class="pill" data-filter="revoked">Revoked</button>
            </div>
          </div>
        </div>

        <div class="tbl-wrap">
          <table id="pgp-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;"><input type="checkbox" id="pgp-select-all" title="Select all visible"></th>
                <th>PGP No.</th>
                <th>Student</th>
                <th>Grade/Section</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows(passes)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Floating Bulk Actions Bar -->
      <div id="pgp-bulk-actions" style="display: none; position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--bg-card); box-shadow: 0 10px 30px rgba(0,0,0,0.2); padding: 12px 24px; border-radius: 99px; z-index: 100; align-items: center; gap: 16px; border: 1px solid var(--border);">
        <div style="font-weight: 700; color: var(--primary);">
          <span id="pgp-selected-count">0</span> Selected
        </div>
        <div style="width: 1px; height: 24px; background: var(--border);"></div>
        <button class="btn btn-primary" id="btn-bulk-email">
          ${Icons['mail'](16)} Email Selected Passes
        </button>
      </div>

      <!-- Bulk Email Progress Modal -->
      <div id="modal-bulk-email" class="overlay" style="display: none; align-items: center; justify-content: center; z-index: 9999;">
        <div class="modal" style="width: 100%; max-width: 400px; text-align: center; padding: 32px;">
          <div style="color: var(--primary); margin-bottom: 16px;">
            ${Icons['mail'](48)}
          </div>
          <h2 style="margin-bottom: 8px;">Sending Emails</h2>
          <p id="bulk-email-status" style="color: var(--text2); margin-bottom: 24px;">Preparing to send...</p>
          <div style="width: 100%; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin-bottom: 24px;">
            <div id="bulk-email-progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
          </div>
          <button class="btn btn-ghost" id="btn-close-bulk-email" style="display: none; width: 100%;">Close</button>
        </div>
      </div>

      <!-- PGP Card View Modal -->
      <div id="modal-pgp-card" class="overlay" style="display: none; align-items: center; justify-content: center; z-index: 9999;">
        <div class="modal" style="width: 100%; max-width: 400px; padding: 0; background: transparent; box-shadow: none;">
          <div style="background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="background: var(--primary); color: #fff; padding: 16px; text-align: center; position: relative;">
              <div style="font-weight: 800; font-size: 18px; letter-spacing: 1px;">PERMANENT GATE PASS</div>
              <button class="close-btn" id="btn-close-pgp-card" style="position: absolute; top: 12px; right: 12px; color: #fff; background: rgba(0,0,0,0.2); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                ${Icons['x-close'](14)}
              </button>
            </div>
            <div id="pgp-card-render-target" style="padding: 24px; text-align: center;">
              <!-- Rendered via JS -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderTableRows(passes) {
    if (!passes || passes.length === 0) {
      return `<tr><td colspan="6" class="empty">
        <div class="empty-state">
          ${Icons['id-card'](48)}
          <div class="empty-state-title">No Permanent Passes</div>
          <div class="empty-state-sub">There are no permanent passes matching the current filters.</div>
        </div>
      </td></tr>`;
    }

    return passes.map(p => {
      let statusClass = 'b-active';
      if (p.status === 'suspended') statusClass = 'b-orange'; // We need to define b-orange in CSS or reuse
      if (p.status === 'revoked') statusClass = 'b-denied';

      // Fallback colors for status if not perfectly matching
      let badgeStyle = '';
      if (p.status === 'suspended') badgeStyle = 'background: var(--orange-s); color: var(--orange);';
      if (p.status === 'revoked') badgeStyle = 'background: var(--red-s); color: var(--red);';
      if (p.status === 'active') badgeStyle = 'background: var(--green-s); color: var(--green);';

      return `
        <tr data-status="${escapeHTML(p.status)}">
          <td style="text-align: center;">
            <input type="checkbox" class="pgp-row-cb" data-id="${p.id}">
          </td>
          <td>
            <div style="font-family: monospace; font-weight: 700; color: var(--primary);">${escapeHTML(p.pgp)}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--primary); font-weight: 700; font-size: 10px;">
                ${hasPhoto(p.photo) ? `<img src="${escapeHTML(resolvePhotoUrl(p.photo))}" style="width:100%;height:100%;object-fit:cover;">` : escapeHTML(p.name.substring(0, 2).toUpperCase())}
              </div>
              <div>
                <div style="font-weight: 600;">${escapeHTML(p.name)}</div>
                <div style="font-size: 11px; color: var(--text3);">${escapeHTML(p.studid || p.id)}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHTML(p.grade)}</div>
            <div style="font-size: 11px; color: var(--text3);">${escapeHTML(p.section || '—')}</div>
          </td>
          <td>
            <span class="badge" style="${badgeStyle}">${escapeHTML(p.status.toUpperCase())}</span>
          </td>
          <td>
            <div class="flex gap-8">
              <button class="btn btn-ghost btn-sm btn-view-pgp" data-id="${p.id}" data-tooltip="View Pass">
                ${Icons['eye'](16)} View
              </button>
              ${p.status === 'active' ? `
                <button class="btn btn-primary btn-sm btn-email-pgp" data-id="${p.id}" data-tooltip="Email Pass to Parent">
                  ${Icons['mail'](16)} Email
                </button>
                <button class="btn btn-ghost btn-sm btn-status-update" data-id="${p.id}" data-action="suspended" data-tooltip="Suspend Pass">
                  Suspend
                </button>
                <button class="btn btn-danger btn-sm btn-status-update" data-id="${p.id}" data-action="revoked" data-tooltip="Revoke Pass">
                  Revoke
                </button>
              ` : `
                <button class="btn btn-primary btn-sm btn-status-update" data-id="${p.id}" data-action="active" data-tooltip="Reactivate Pass">
                  Reactivate
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}
