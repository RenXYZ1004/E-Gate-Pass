import Icons from '../icons.js';
import { escapeHTML, schoolDateKey, schoolDateLabel } from '../utils.js';

export default class TGPView {
  static render(model) {
    const tgps = model.tgp || [];
    
    // Sort so most recent is first
    const sortedTgps = [...tgps].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const pendingCount = tgps.filter(t => t.status === 'pending').length;
    const approvedCount = tgps.filter(t => t.status === 'approved').length;
    const rejectedCount = tgps.filter(t => t.status === 'rejected').length;

    return `
      <div class="kpi-strip">
        <div class="kpi-card kpi-purple">
          <div class="kpi-icon">${Icons['file-text'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${tgps.length}</div><div class="kpi-lbl">Total TGPs</div></div>
        </div>
        <div class="kpi-card kpi-yellow">
          <div class="kpi-icon">${Icons['clock'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${pendingCount}</div><div class="kpi-lbl">Pending</div></div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon">${Icons['check-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${approvedCount}</div><div class="kpi-lbl">Approved</div></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon">${Icons['x-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${rejectedCount}</div><div class="kpi-lbl">Rejected</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Temporary Gate Passes (TGP)</div>
            <div class="card-sub">Single-day exit passes for active students</div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-tgp">
            ${Icons['plus'](14)} New TGP
          </button>
        </div>

        <div style="padding: 16px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
           <button class="pill on" data-filter="all">All</button>
           <button class="pill" data-filter="pending">Pending Approval</button>
           <button class="pill" data-filter="approved">Approved</button>
           <button class="pill" data-filter="rejected">Rejected</button>
           <button class="pill" data-filter="online">Online Applications</button>
           <div style="margin-left: auto;">
             <select id="tgp-filter-gate" class="form-input" style="font-size:13px;padding:6px 10px;width:auto;min-width:140px;">
               <option value="all">All Gates</option>
               ${(model.getActiveGates && model.getActiveGates().length > 0
                 ? model.getActiveGates()
                 : [{ name: 'Tropical Gate' }, { name: 'Gate 1' }, { name: 'Gate 2' }, { name: 'College Gate' }, { name: 'Monarchs Gym' }]
               ).map(g => `<option value="${escapeHTML(g.name)}">${escapeHTML(g.name)}</option>`).join('')}
             </select>
           </div>
        </div>

        <div class="tbl-wrap">
          <table id="tgp-table">
            <thead>
              <tr>
                <th>TGP No.</th>
                <th>Valid Date</th>
                <th>Student</th>
                <th>Gate / Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows(sortedTgps, model)}
            </tbody>
          </table>
        </div>
        
        <div id="tgp-pagination" class="pagination-bar"></div>
      </div>

      <!-- New TGP Modal -->
      <div id="modal-tgp" class="overlay" style="display: none;">
        <div class="modal">
          <div class="modal-head">
            <div class="modal-title">Create Temporary Gate Pass</div>
            <button class="close-btn" id="btn-close-tgp">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body">
            
            <!-- Info Banner -->
            <div style="background: var(--blue-s); border-left: 3px solid var(--blue); padding: 12px 16px; border-radius: var(--radius-sm); display: flex; gap: 12px; margin-bottom: 20px;">
              <div style="color: var(--blue);">${Icons['info'](20)}</div>
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--blue);">TGP Workflow</div>
                <div style="font-size: 11.5px; color: var(--text2); margin-top: 2px;">Temporary passes are valid for ONE day only. They require Secretary or Head approval before they can be scanned at the gate.</div>
              </div>
            </div>

            <form id="form-tgp">

              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text3);margin-bottom:10px;">Student Information</div>

              <div class="grid-2 mb-12">
                <div class="form-group required">
                  <label for="tgp-last-name">Last Name</label>
                  <input type="text" id="tgp-last-name" class="form-input" required>
                </div>
                <div class="form-group required">
                  <label for="tgp-first-name">First Name</label>
                  <input type="text" id="tgp-first-name" class="form-input" required>
                </div>
              </div>

              <div class="form-group required mb-12">
                <label for="tgp-studid">Student ID</label>
                <input type="text" id="tgp-studid" class="form-input" required placeholder="e.g. 26-0015c">
              </div>

              <div class="grid-2 mb-12">
                <div class="form-group required">
                  <label for="tgp-grade">Grade</label>
                  <select id="tgp-grade" class="form-input" required>
                    <option value="">-- Grade --</option>
                    <option>Grade 7</option><option>Grade 8</option><option>Grade 9</option>
                    <option>Grade 10</option><option>Grade 11</option><option>Grade 12</option>
                    <option>IB1</option><option>IB2</option>
                  </select>
                </div>
                <div class="form-group required">
                  <label for="tgp-section">Section</label>
                  <select id="tgp-section" class="form-input" required disabled>
                    <option value="">Select grade first</option>
                  </select>
                </div>
              </div>

              <div class="form-group required mb-12">
                <label for="tgp-student-email">Student Email</label>
                <input type="email" id="tgp-student-email" class="form-input" required placeholder="student@email.com">
                <div style="font-size:11px;color:var(--text3);margin-top:4px;">The approved TGP card will be emailed here via the Email Pass button.</div>
              </div>

              <div class="form-group mb-12">
                <label>Student Photo <span style="color:var(--text3);font-size:11px;font-weight:400;">(optional)</span></label>
                <div id="tgp-photo-area" style="border:1.5px dashed var(--border);border-radius:8px;padding:12px;background:var(--bg-elevated);cursor:pointer;text-align:center;">
                  <input type="file" id="tgp-photo-input" accept="image/*" style="display:none">
                  <div id="tgp-photo-placeholder" style="color:var(--text3);font-size:12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Tap to upload student photo
                  </div>
                  <div id="tgp-photo-preview" style="display:none;align-items:center;gap:10px;text-align:left;">
                    <img id="tgp-photo-img" src="" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:2px solid var(--primary);flex-shrink:0;">
                    <span id="tgp-photo-name" style="font-size:12px;color:var(--text2);word-break:break-all;"></span>
                  </div>
                </div>
                <div style="font-size:11px;color:var(--text3);margin-top:4px;">Helps the guard identify the student at the gate.</div>
              </div>

              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text3);margin:4px 0 10px;">Pass Details</div>

              <div class="grid-2 mb-12">
                <div class="form-group required">
                  <label for="tgp-date">Valid For Date</label>
                  <input type="date" id="tgp-date" class="form-input" required min="${schoolDateKey(new Date())}">
                </div>
                <div class="form-group required">
                  <label for="tgp-gate">Designated Gate</label>
                  <select id="tgp-gate" class="form-input" required>
                    ${(model.getActiveGates && model.getActiveGates().length > 0
                      ? model.getActiveGates()
                      : [{ name: 'Tropical Gate' }, { name: 'Gate 1' }, { name: 'Gate 2' }, { name: 'College Gate' }, { name: 'Monarchs Gym' }]
                    ).map(g => `<option value="${escapeHTML(g.name)}">${escapeHTML(g.name)}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group required mb-12">
                <label for="tgp-reason">Reason for Temporary Exit</label>
                <textarea id="tgp-reason" class="form-input" rows="3" required placeholder="e.g. Forgotten ID, Medical appointment..."></textarea>
              </div>

              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text3);margin:4px 0 10px;">Parent / Guardian</div>

              <div class="form-group required mb-12">
                <label for="tgp-requester">Name of Parent/Guardian</label>
                <input type="text" id="tgp-requester" class="form-input" required placeholder="Full name">
              </div>

              <div class="form-group required mb-12">
                <label for="tgp-phone">Contact Number</label>
                <input type="tel" id="tgp-phone" class="form-input" required placeholder="09171234567" inputmode="numeric" maxlength="11">
                <div style="font-size:11px;color:var(--text3);margin-top:4px;">School will call this number to verify the request.</div>
              </div>

              <div class="form-group">
                <label for="tgp-parent-email">Parent Email <span style="color:var(--text3);font-size:11px;font-weight:400;">(optional)</span></label>
                <input type="email" id="tgp-parent-email" class="form-input" placeholder="parent@email.com">
              </div>
            </form>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" id="btn-cancel-tgp">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-tgp" form="form-tgp">Submit Request</button>
          </div>
        </div>
      </div>

      ${this.renderTGPCardModal()}
    `;
  }

  static renderTGPCardModal() {
    return `
      <div id="modal-tgp-card" class="overlay" style="display: none;">
        <div class="modal" style="width: 360px;">
          <div class="modal-head">
            <div class="modal-title">Temporary Gate Pass</div>
            <button class="close-btn" id="btn-close-tgp-card">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body" style="background: #f5f4f8;">
             <div id="tgp-card-render-target"></div>
          </div>
          <div class="modal-foot" style="justify-content: center; gap: 8px;">
            <button class="btn btn-ghost" id="btn-download-tgp">
              ${Icons['download'](14)} Download Image
            </button>
            <button class="btn btn-primary" id="btn-email-tgp" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Email Pass
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static renderTableRows(tgps, model) {
    if (!tgps || tgps.length === 0) {
      return `<tr><td colspan="6" class="empty">
        <div class="empty-state">
          ${Icons['file-text'] ? Icons['file-text'](48) : Icons['id-card'](48)}
          <div class="empty-state-title">No Temporary Passes</div>
          <div class="empty-state-sub">There are no temporary gate passes requested or matching the current filters.</div>
        </div>
      </td></tr>`;
    }

    return tgps.map(t => {
      const student = model.getStudentByPassId(t.studentId) || model.getStudentByStudId(t.studentId);
      const sName = t.name || (student ? student.name : 'Unknown');
      const sGrade = (t.grade ? `${t.grade}${t.section ? ' - ' + t.section : ''}` : '') || (student ? (student.fullSection || student.grade) : '');
      
      const dateStr = schoolDateLabel(t.validDate, { month: 'short', day: 'numeric', year: 'numeric' });
      
      let badgeHtml = '';
      if (t.status === 'pending') badgeHtml = `<span class="badge b-pending">PENDING</span>`;
      if (t.status === 'approved') badgeHtml = `<span class="badge b-active">APPROVED</span>`;
      if (t.status === 'rejected') badgeHtml = `<span class="badge b-denied">REJECTED</span>`;

      const sourceBadge = t.source === 'online'
        ? `<span style="display:inline-block;margin-top:4px;font-size:9px;font-weight:700;letter-spacing:.5px;padding:2px 6px;border-radius:4px;background:var(--blue-s,#e0f0ff);color:var(--blue,#1d6fa8);">ONLINE</span>`
        : '';

      return `
        <tr data-status="${escapeHTML(t.status)}">
          <td>
            <div style="font-family: monospace; font-weight: 700; color: var(--primary);">${escapeHTML(t.id)}</div>
            ${sourceBadge}
          </td>
          <td>
            <div style="font-weight: 600;">${dateStr}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHTML(sName)}</div>
            <div style="font-size: 11px; color: var(--text3);">${escapeHTML(sGrade)}</div>
            ${t.studentEmail ? `<div style="font-size:11px;color:var(--blue,#1d6fa8);margin-top:2px;">✉ ${escapeHTML(t.studentEmail)}</div>` : ''}
            ${t.contactPhone ? `<div style="font-size:11px;color:var(--text3);">📞 ${escapeHTML(t.contactPhone)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHTML(t.gate)}</div>
            <div style="font-size: 11px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${escapeHTML(t.reason)}">${escapeHTML(t.reason)}</div>
          </td>
          <td>
            ${badgeHtml}
          </td>
          <td>
            <div class="flex gap-8">
              ${t.status === 'pending' ? `
                <button class="btn btn-primary btn-sm btn-tgp-action" data-id="${t.id}" data-action="approved" data-tooltip="Approve">
                  ${Icons['check-circle'](14)}
                </button>
                <button class="btn btn-danger btn-sm btn-tgp-action" data-id="${t.id}" data-action="rejected" data-tooltip="Reject">
                  ${Icons['x-circle'](14)}
                </button>
              ` : t.status === 'approved' ? `
                <button class="btn btn-ghost btn-sm btn-view-tgp" data-id="${t.id}" data-tooltip="View TGP Card">
                  ${Icons['id-card'](14)} View Pass
                </button>
              ` : `
                <span style="font-size: 11px; color: var(--text3);">Rejected</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}
