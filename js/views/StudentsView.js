import Icons from '../icons.js';
import { escapeHTML, resolvePhotoUrl, hasPhoto } from '../utils.js';

export default class StudentsView {
  static render(model) {
    const students = model.students || [];
    const grades = ['All', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'IB1', 'IB2'];
    const activeCount = students.filter(s => s.status === 'active').length;
    const archivedCount = students.filter(s => s.status === 'archived').length;
    const inactiveCount = students.filter(s => s.status === 'inactive').length;
    const suspendedCount = students.filter(s => s.status === 'suspended').length;
    const forApprovalCount = students.filter(s => s.status === 'for approval').length;
    const withPhotosCount = students.filter(s => hasPhoto(s.photo)).length;
    const withoutPGPCount = students.filter(s => !s.pgp).length;

    return `
      <div class="kpi-strip">
        <div class="kpi-card kpi-green">
          <div class="kpi-icon">${Icons['users'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${activeCount}</div><div class="kpi-lbl">Total Active</div></div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon">${Icons['archive'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${archivedCount}</div><div class="kpi-lbl">Archived</div></div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon">${Icons['camera'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${withPhotosCount}</div><div class="kpi-lbl">With Photos</div></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon">${Icons['alert-triangle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${withoutPGPCount}</div><div class="kpi-lbl">Without PGP</div></div>
        </div>
        <div class="kpi-card kpi-purple" style="cursor:pointer;" id="kpi-for-approval">
          <div class="kpi-icon">${Icons['file-text'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${forApprovalCount}</div><div class="kpi-lbl">For Approval</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Student Registry</div>
            <div class="card-sub">${activeCount} active · ${archivedCount} archived</div>
          </div>
          ${model.currentUser && model.currentUser.role !== 'guard' ? `
          <div class="students-header-actions">
            <button class="btn btn-ghost btn-sm" id="btn-export-ids">
              ${Icons['download'](14)} <span class="btn-text">Export All IDs</span>
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-import-csv">
              ${Icons['file-text'](14)} <span class="btn-text">Import CSV</span>
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-bulk-photos">
              ${Icons['camera'](14)} <span class="btn-text">Bulk Photos</span>
            </button>
            <button class="btn btn-primary btn-sm" id="btn-add-student">
              ${Icons['plus'](14)} <span class="btn-text">Enroll Student</span>
            </button>
          </div>
          ` : ''}
        </div>
        
        <!-- Status Tabs -->
        <div style="display: flex; border-bottom: 1px solid var(--border); padding: 0 16px; gap: 4px; flex-wrap: wrap;">
          <button class="pill student-status-tab active" data-status="active" style="border-radius: 8px 8px 0 0; padding: 8px 16px; font-weight: 600; font-size: 12px; border: 1px solid var(--border); border-bottom: none; background: var(--bg-card); color: var(--primary);">Active</button>
          <button class="pill student-status-tab" data-status="inactive" style="border-radius: 8px 8px 0 0; padding: 8px 16px; font-weight: 500; font-size: 12px; border: 1px solid transparent; color: var(--text3); background: transparent;">
            Inactive${inactiveCount > 0 ? ` <span style="background:var(--text3);color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px;">${inactiveCount}</span>` : ''}
          </button>
          <button class="pill student-status-tab" data-status="suspended" style="border-radius: 8px 8px 0 0; padding: 8px 16px; font-weight: 500; font-size: 12px; border: 1px solid transparent; color: var(--text3); background: transparent;">
            Suspended${suspendedCount > 0 ? ` <span style="background:#f59e0b;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px;">${suspendedCount}</span>` : ''}
          </button>
          <button class="pill student-status-tab" data-status="for approval" style="border-radius: 8px 8px 0 0; padding: 8px 16px; font-weight: 500; font-size: 12px; border: 1px solid transparent; color: var(--text3); background: transparent; display: flex; align-items: center; gap: 6px;">
            For Approval${forApprovalCount > 0 ? ` <span style="background:var(--red,#ef4444);color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;">${forApprovalCount}</span>` : ''}
          </button>
          <button class="pill student-status-tab" data-status="archived" style="border-radius: 8px 8px 0 0; padding: 8px 16px; font-weight: 500; font-size: 12px; border: 1px solid transparent; color: var(--text3); background: transparent;">Archived</button>
        </div>

        <!-- Filter Bar: Search + Grade Pills -->
        <div id="students-filter-bar" style="padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
          <div class="form-group" style="max-width: 240px; margin: 0; flex-shrink: 0;">
            <input type="text" id="students-search" class="form-input" placeholder="Search by name or ID...">
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="grade-filters">
            ${grades.map((g, i) => `
              <button class="pill grade-pill ${i === 0 ? 'active' : ''}" data-grade="${g}" style="padding: 4px 12px; font-size: 11px; font-weight: ${i === 0 ? '700' : '500'}; border: 1px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'}; background: ${i === 0 ? 'var(--primary-soft)' : 'var(--bg-card)'}; color: ${i === 0 ? 'var(--primary)' : 'var(--text2)'}; border-radius: 20px; cursor: pointer;">
                ${g === 'All' ? 'All Grades' : g}
              </button>
            `).join('')}
          </div>
          <select class="grade-select-mobile form-input" id="grade-select-mobile">
            <option value="All">All Grades</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
            <option value="IB1">IB1</option>
            <option value="IB2">IB2</option>
          </select>
          <div style="margin-left: auto; display: flex; gap: 4px; background: var(--bg-card); padding: 2px; border-radius: 6px; border: 1px solid var(--border);">
            <button id="view-toggle-table" class="view-toggle active" style="padding: 6px; border-radius: 4px; border: none; background: var(--primary-soft); color: var(--primary); cursor: pointer;" title="Table View">
              ${Icons['list'](16)}
            </button>
            <button id="view-toggle-card" class="view-toggle" style="padding: 6px; border-radius: 4px; border: none; background: transparent; color: var(--text3); cursor: pointer;" title="Card View">
              ${Icons['layout-grid'](16)}
            </button>
          </div>
        </div>

        <!-- For Approval: Master-Detail Panel (shown only when For Approval tab is active) -->
        <div id="for-approval-panel" style="display:none; padding:16px;">
          <div style="display:flex; gap:16px; min-height:420px; flex-wrap:wrap;">
            <!-- Left: Applicant list -->
            <div style="width:260px; flex-shrink:0; border:1px solid var(--border); border-radius:10px; overflow:hidden; background:var(--bg-card);">
              <div style="padding:12px 14px; border-bottom:1px solid var(--border); font-size:12px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px;">Pending Review</div>
              <div id="approval-list" style="overflow-y:auto; max-height:560px;">
                <div style="padding:24px 16px; text-align:center; color:var(--text3); font-size:13px;">${Icons['users'](24)}<br>No pending applications</div>
              </div>
            </div>
            <!-- Right: Applicant detail -->
            <div id="approval-detail" style="flex:1; min-width:280px; border:1px solid var(--border); border-radius:10px; overflow-y:auto; max-height:600px; background:var(--bg-card);">
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; gap:10px; color:var(--text3);">
                ${Icons['file-text'](36)}
                <span style="font-size:13px;">Select an applicant to review</span>
              </div>
            </div>
          </div>
        </div>

        <div class="tbl-wrap" id="students-table-container">
          <table id="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Grade Level</th>
                <th>Guardian</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows(students.filter(s => s.status === 'active'), model)}
            </tbody>
          </table>
        </div>
        <div id="students-grid-container" style="display: none; padding: 16px;">
          <div id="students-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${this.renderCardView(students.filter(s => s.status === 'active'), model)}
          </div>
        </div>
        
        <!-- Pagination Footer -->
        <div id="students-pagination" class="pagination-bar"></div>
      </div>

      <!-- Add Student Wizard Modal -->
      <div id="modal-wizard" class="overlay" style="display: none;">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="modal-title">Enroll New Student</div>
            <button class="close-btn" id="btn-close-wizard">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <!-- Wizard Progress Header -->
            <div style="display: flex; background: var(--bg-elevated); padding: 16px 20px; border-bottom: 1px solid var(--border);">
              ${[
                { num: 1, label: 'Identity' },
                { num: 2, label: 'Academic' },
                { num: 3, label: 'Guardian' },
                { num: 4, label: 'Review' }
              ].map((step, idx) => `
                <div class="wizard-step" id="step-ind-${step.num}" style="flex: 1; text-align: center; color: ${idx === 0 ? 'var(--primary)' : 'var(--text3)'}; font-weight: ${idx === 0 ? '700' : '500'};">
                  <div style="width: 24px; height: 24px; border-radius: 50%; background: ${idx === 0 ? 'var(--primary)' : 'var(--bg-card)'}; color: ${idx === 0 ? '#fff' : 'inherit'}; border: 1px solid ${idx === 0 ? 'var(--primary)' : 'var(--border2)'}; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; font-size: 11px;">
                    ${step.num}
                  </div>
                  <div style="font-size: 11px;">${step.label}</div>
                </div>
              `).join('')}
            </div>

            <!-- Form Content -->
            <form id="form-enroll" style="padding: 24px;">
              
              <!-- Step 1: Identity -->
              <div class="wizard-panel" id="panel-step-1" style="display: block;">
                <div class="form-grid mb-12">
                  <div class="form-group required">
                    <label for="w-name">Full Name</label>
                    <input type="text" id="w-name" class="form-input" required placeholder="Lastname, Firstname" maxlength="100">
                    <div class="form-error" id="err-w-name"></div>
                  </div>
                  <div class="form-group required">
                    <label for="w-studid">Student ID</label>
                    <input type="text" id="w-studid" class="form-input" required placeholder="e.g. 23-1234" maxlength="20">
                    <div class="form-error" id="err-w-studid"></div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Photo (Upload or Camera)</label>
                  <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <div id="w-photo-preview" style="width: 80px; height: 80px; border-radius: 8px; background: var(--bg-elevated); border: 1px dashed var(--border2); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      ${Icons['camera'](24)}
                    </div>
                    <input type="file" id="w-photo-file" accept="image/*" class="form-input" style="flex: 1;">
                  </div>
                </div>
              </div>

              <!-- Step 2: Academic & Exit -->
              <div class="wizard-panel" id="panel-step-2" style="display: none;">
                <div class="form-grid mb-12">
                  <div class="form-group required">
                    <label for="w-grade">Grade Level</label>
                    <select id="w-grade" class="form-input" required>
                      <option value="">Select Grade</option>
                      <option value="Grade 7">Grade 7</option>
                      <option value="Grade 8">Grade 8</option>
                      <option value="Grade 9">Grade 9</option>
                      <option value="Grade 10">Grade 10</option>
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                      <option value="IB1">IB1</option>
                      <option value="IB2">IB2</option>
                    </select>
                    <div class="form-error" id="err-w-grade"></div>
                  </div>
                  <div class="form-group">
                    <label for="w-section">Section</label>
                    <input type="text" id="w-section" class="form-input" placeholder="e.g. Diligence" maxlength="50">
                  </div>
                </div>
                <div class="form-grid mb-12">
                  <div class="form-group required">
                    <label for="w-gate">Preferred Gate</label>
                    <select id="w-gate" class="form-input" required>
                      <option value="">Select Gate</option>
                      <optgroup label="Single Gates">
                        <option value="Tropical Gate">Tropical Gate</option>
                        <option value="Gate 1">Gate 1</option>
                        <option value="Gate 2">Gate 2</option>
                        <option value="College Gate">College Gate</option>
                      </optgroup>
                      <optgroup label="Dual Combinations">
                        <option value="Tropical Gate and Gate 1">Tropical Gate & Gate 1</option>
                        <option value="Tropical Gate and Gate 2">Tropical Gate & Gate 2</option>
                        <option value="Tropical Gate and College Gate">Tropical Gate & College Gate</option>
                        <option value="Gate 1 and Gate 2">Gate 1 & Gate 2</option>
                        <option value="Gate 2 and College Gate">Gate 2 & College Gate</option>
                        <option value="College Gate and Gate 1">College Gate & Gate 1</option>
                      </optgroup>
                      <optgroup label="Multiple Gates">
                        <option value="Tropical Gate, Gate 1, and Gate 2">Tropical Gate, Gate 1, and Gate 2</option>
                        <option value="All Gates">All Gates</option>
                        <option value="Any authorized gate">Any authorized gate</option>
                      </optgroup>
                    </select>
                    <div class="form-error" id="err-w-gate"></div>
                  </div>
                  <div class="form-group required">
                    <label for="w-arrangements">Arrangements</label>
                    <select id="w-arrangements" class="form-input" required>
                      <option value="">Select Arrangement</option>
                      <option value="Will go home by herself/himself">Will go home by herself/himself</option>
                      <option value="Will ride with parents/authorized fetchers">Will ride with parents/authorized fetchers</option>
                      <option value="Will ride the school bus">Will ride the school bus</option>
                      <option value="Will drive own car (Grades 11-12 only)">Will drive own car (Grades 11-12 only)</option>
                      <option value="Will ride the Academy Car">Will ride the Academy Car</option>
                    </select>
                    <div class="form-error" id="err-w-arrangements"></div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Vehicle Details (Make, Model, Color, Plate)</label>
                  <input type="text" id="w-vehicle" class="form-input" placeholder="e.g. Red Toyota Vios ABC-123">
                </div>
              </div>

              <!-- Step 3: Guardian -->
              <div class="wizard-panel" id="panel-step-3" style="display: none;">
                <div class="form-group required mb-12">
                  <label for="w-parent-name">Guardian Name</label>
                  <input type="text" id="w-parent-name" class="form-input" required placeholder="Mr. / Mrs. Name" maxlength="100">
                  <div class="form-error" id="err-w-parent-name"></div>
                </div>
                <div class="form-grid">
                  <div class="form-group required">
                    <label for="w-parent-email">Guardian Email</label>
                    <input type="email" id="w-parent-email" class="form-input" required placeholder="Used for exit alerts">
                    <div class="form-error" id="err-w-parent-email"></div>
                  </div>
                  <div class="form-group">
                    <label for="w-parent-phone">Mobile Number (Optional)</label>
                    <input type="text" id="w-parent-phone" class="form-input" placeholder="09XX XXX XXXX" maxlength="13">
                    <div class="form-error" id="err-w-parent-phone"></div>
                  </div>
                </div>
              </div>

              <!-- Step 4: Review -->
              <div class="wizard-panel" id="panel-step-4" style="display: none;">
                <div style="background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 16px; border: 1px solid var(--border);">
                  <h4 style="margin-bottom: 12px; color: var(--primary);">Summary</h4>
                  <div class="grid-2" style="font-size: 13px;">
                    <div><strong>Name:</strong> <span id="r-name"></span></div>
                    <div><strong>ID:</strong> <span id="r-studid"></span></div>
                    <div><strong>Grade:</strong> <span id="r-grade"></span></div>
                    <div><strong>Gate:</strong> <span id="r-gate"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Arrangement:</strong> <span id="r-arrangements"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Vehicle:</strong> <span id="r-vehicle"></span></div>
                    <div style="grid-column: 1 / -1; margin-top:8px;"><strong>Guardian:</strong> <span id="r-guardian"></span></div>
                    <div style="grid-column: 1 / -1;"><strong>Email:</strong> <span id="r-email"></span></div>
                  </div>
                </div>
                <div class="alert alert-success" style="margin-top: 16px; background: var(--green-s); color: var(--green); padding: 12px; border-radius: var(--radius-sm); font-size: 12px;">
                  All details look correct. Click <strong>Generate Pass</strong> to enroll student and create their PGP.
                </div>
              </div>

            </form>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="btn-wizard-prev" style="display: none;">← Back</button>
            <button class="btn btn-primary" id="btn-wizard-next">Next Step →</button>
            <button class="btn btn-accent" id="btn-wizard-submit" style="display: none;">Generate Pass ✓</button>
          </div>
        </div>
      </div>
      
      <!-- CSV Import Modal -->
      <div id="modal-csv-import" class="overlay" style="display: none;">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="modal-title">Import Students from CSV</div>
            <button class="close-btn" id="btn-close-csv">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--blue-s); border-left: 3px solid var(--blue); padding: 12px 16px; border-radius: var(--radius-sm); display: flex; gap: 12px; margin-bottom: 20px;">
              <div style="color: var(--blue);">${Icons['info'](20)}</div>
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--blue);">CSV Format Guide</div>
                <div style="font-size: 11.5px; color: var(--text2); margin-top: 2px;">
                  Required columns: <strong>name, studid, grade, preferredgate, arrangements</strong><br>
                  Optional columns: <strong>section, schoolyear, parentname, parentemail, phone</strong><br>
                  First row must be headers. Duplicate Student IDs will be skipped.
                </div>
              </div>
            </div>

            <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-family:monospace;font-size:11px;color:var(--text2);overflow-x:auto;">
              name,studid,grade,section,schoolyear,preferredgate,arrangements,parentname,parentemail,phone<br>
              "Dela Cruz, Juan",23-1001,Grade 7,Diligence,2026-2027,Gate 1,Will go home by herself/himself,Maria Dela Cruz,maria@email.com,09171234567
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label>Upload CSV File</label>
              <input type="file" id="csv-file-input" accept=".csv" class="form-input">
            </div>
            
            <div id="csv-preview"></div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" id="btn-cancel-csv">Cancel</button>
            <button type="button" class="btn btn-primary" id="btn-submit-csv">${Icons['plus'](14)} Import Students</button>
          </div>
        </div>
      </div>

      <!-- Virtual ID Card Modal -->
      <div id="modal-idcard" class="overlay" style="display: none;">
        <div class="modal" style="width: 360px;">
          <div class="modal-head">
            <div class="modal-title">Virtual ID Card</div>
            <button class="close-btn" id="btn-close-idcard">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body" style="background: #f5f4f8;">
             <div id="idcard-render-target"></div>
          </div>
          <div class="modal-foot" style="justify-content: center;">
            <button class="btn btn-primary" id="btn-download-id">
              ${Icons['download'](14)} Download Image
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk Photo Upload Modal -->
      <div id="modal-bulk-photos" class="overlay" style="display: none;">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="modal-title">Bulk Photo Upload</div>
            <button class="close-btn" id="btn-close-bulk-photos">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--blue-s); border-left: 3px solid var(--blue); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--blue);">Auto-Match Naming Guide</div>
              <div style="font-size: 11.5px; color: var(--text2); margin-top: 2px;">
                Image files must be named exactly as the student's name in the system (commas and spaces are ignored during matching).<br>
                Example: <strong>Dela Cruz, Juan.jpg</strong> or <strong>Dela Cruz Juan.png</strong>.
              </div>
            </div>
            <div class="form-group">
              <label>Select Photos (You can select hundreds of images at once)</label>
              <input type="file" id="bulk-photo-input" multiple accept="image/*" class="form-input">
            </div>
            <div id="bulk-photo-progress" style="display: none; margin-top: 16px;">
              <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--primary);" id="bulk-photo-status">Processing 0 / 0</div>
              <div style="width: 100%; background: var(--bg-elevated); border-radius: 4px; height: 8px; overflow: hidden;">
                <div id="bulk-photo-bar" style="height: 100%; width: 0%; background: var(--primary); transition: width 0.2s;"></div>
              </div>
              <div id="bulk-photo-log" style="margin-top: 12px; max-height: 150px; overflow-y: auto; font-family: monospace; font-size: 10px; background: #1f2937; color: #10b981; padding: 8px; border-radius: 4px;">
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-primary" id="btn-start-bulk-upload">Start Bulk Upload</button>
          </div>
        </div>
      </div>

      <!-- Edit Student Modal -->
      <div id="modal-edit-student" class="overlay" style="display: none;">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="modal-title">${Icons['edit'](16)} Edit Student Details</div>
            <button class="close-btn" id="btn-close-edit">${Icons['x-close'](14)}</button>
          </div>
          <div class="modal-body" style="padding: 24px;">
            <form id="form-edit-student">
              <input type="hidden" id="edit-id">
              
              <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">Identity</div>
              <div class="form-grid mb-12">
                <div class="form-group required">
                  <label for="edit-name">Full Name</label>
                  <input type="text" id="edit-name" class="form-input" required maxlength="100">
                  <div class="form-error" id="err-edit-name"></div>
                </div>
                <div class="form-group required">
                  <label for="edit-studid">Student ID</label>
                  <input type="text" id="edit-studid" class="form-input" required maxlength="20">
                  <div class="form-error" id="err-edit-studid"></div>
                </div>
              </div>
              <div class="form-grid mb-12">
                <div class="form-group">
                  <label for="edit-passid">Pass ID (Auto-generated)</label>
                  <input type="text" id="edit-passid" class="form-input" disabled style="opacity: 0.65; cursor: not-allowed;">
                </div>
                <div class="form-group">
                  <label for="edit-status">Status</label>
                  <select id="edit-status" class="form-input">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="for approval">For Approval</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div class="form-group mb-12">
                <label>Update Photo</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <div id="edit-photo-preview" style="width: 50px; height: 50px; border-radius: 8px; background: var(--bg-elevated); border: 1px dashed var(--border2); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${Icons['camera'](20)}
                  </div>
                  <input type="file" id="edit-photo-file" accept="image/*" class="form-input" style="flex: 1; padding: 6px;">
                </div>
              </div>

              <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">Academic & Exit</div>
              <div class="form-grid mb-12">
                <div class="form-group required">
                  <label for="edit-grade">Grade Level</label>
                  <select id="edit-grade" class="form-input" required>
                    <option value="">Select Grade</option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                    <option value="IB1">IB1</option>
                    <option value="IB2">IB2</option>
                  </select>
                  <div class="form-error" id="err-edit-grade"></div>
                </div>
                <div class="form-group">
                  <label for="edit-section">Section</label>
                  <input type="text" id="edit-section" class="form-input" placeholder="e.g. Diligence" maxlength="50">
                </div>
              </div>
              <div class="form-grid mb-12">
                <div class="form-group">
                  <label for="edit-schoolyear">School Year</label>
                  <input type="text" id="edit-schoolyear" class="form-input" placeholder="e.g. 2026-2027" maxlength="20">
                </div>
              </div>
              <div class="form-grid mb-12">
                <div class="form-group required">
                  <label for="edit-gate">Preferred Gate</label>
                  <select id="edit-gate" class="form-input" required>
                    <option value="">Select Gate</option>
                    <optgroup label="Single Gates">
                      <option value="Tropical Gate">Tropical Gate</option>
                      <option value="Gate 1">Gate 1</option>
                      <option value="Gate 2">Gate 2</option>
                      <option value="College Gate">College Gate</option>
                    </optgroup>
                    <optgroup label="Dual Combinations">
                      <option value="Tropical Gate and Gate 1">Tropical Gate & Gate 1</option>
                      <option value="Tropical Gate and Gate 2">Tropical Gate & Gate 2</option>
                      <option value="Tropical Gate and College Gate">Tropical Gate & College Gate</option>
                      <option value="Gate 1 and Gate 2">Gate 1 & Gate 2</option>
                      <option value="Gate 2 and College Gate">Gate 2 & College Gate</option>
                      <option value="College Gate and Gate 1">College Gate & Gate 1</option>
                    </optgroup>
                    <optgroup label="Multiple Gates">
                      <option value="Tropical Gate, Gate 1, and Gate 2">Tropical Gate, Gate 1, and Gate 2</option>
                      <option value="All Gates">All Gates</option>
                      <option value="Any authorized gate">Any authorized gate</option>
                    </optgroup>
                  </select>
                  <div class="form-error" id="err-edit-gate"></div>
                </div>
                <div class="form-group required">
                  <label for="edit-arrangements">Arrangements</label>
                  <select id="edit-arrangements" class="form-input" required>
                    <option value="">Select Arrangement</option>
                    <option value="Will go home by herself/himself">Will go home by herself/himself</option>
                    <option value="Will ride with parents/authorized fetchers">Will ride with parents/authorized fetchers</option>
                    <option value="Will ride the school bus">Will ride the school bus</option>
                    <option value="Will drive own car (Grades 11-12 only)">Will drive own car (Grades 11-12 only)</option>
                    <option value="Will ride the Academy Car">Will ride the Academy Car</option>
                  </select>
                  <div class="form-error" id="err-edit-arrangements"></div>
                </div>
              </div>
              <div class="form-grid mb-12">
                <div class="form-group">
                  <label>Vehicle Details</label>
                  <input type="text" id="edit-vehicle" class="form-input" placeholder="e.g. Red Toyota Vios ABC-123">
                </div>
              </div>

              <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">Guardian</div>
              <div class="form-grid mb-12">
                <div class="form-group required">
                  <label for="edit-parent-name">Guardian Name</label>
                  <input type="text" id="edit-parent-name" class="form-input" required maxlength="100">
                  <div class="form-error" id="err-edit-parent-name"></div>
                </div>
                <div class="form-group required">
                  <label for="edit-parent-email">Guardian Email</label>
                  <input type="email" id="edit-parent-email" class="form-input" required>
                  <div class="form-error" id="err-edit-parent-email"></div>
                </div>
              </div>
              <div class="form-group">
                <label for="edit-parent-phone">Mobile Number</label>
                <input type="text" id="edit-parent-phone" class="form-input" placeholder="09XX XXX XXXX" maxlength="13">
                <div class="form-error" id="err-edit-parent-phone"></div>
              </div>

              <div style="font-weight: 700; font-size: 13px; color: var(--primary); margin-bottom: 12px; margin-top: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">Address</div>
              <div class="form-group">
                <label for="edit-address">Home Address</label>
                <input type="text" id="edit-address" class="form-input" placeholder="Street, Barangay, City" maxlength="200">
              </div>
            </form>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="btn-cancel-edit">Cancel</button>
            <button class="btn btn-primary" id="btn-save-edit">${Icons['check-circle'](14)} Save Changes</button>
          </div>
        </div>
      </div>
    `;
  }

  static renderTableRows(students, model) {
    if (!students || students.length === 0) {
      return `<tr><td colspan="5" class="empty">
        <div class="empty-state">
          ${Icons['users'](48)}
          <div class="empty-state-title">No Students Found</div>
          <div class="empty-state-sub">There are no students matching the current filters or no students have been enrolled yet.</div>
        </div>
      </td></tr>`;
    }

    const isGuard = model && model.currentUser && model.currentUser.role === 'guard';

    return students.map(s => {
      const isActive = s.status === 'active';
      const isArchived = s.status === 'archived';
      const isForApproval = s.status === 'for approval';
      const isSuspended = s.status === 'suspended';
      const isInactive = s.status === 'inactive';
      const statusBadge = isActive ? 'b-active' : isForApproval ? 'b-review' : isSuspended ? 'b-denied' : 'b-pending';
      const statusLabel = isActive ? 'Active PGP' : isArchived ? 'Archived' : isForApproval ? 'For Approval' : isSuspended ? 'Suspended' : isInactive ? 'Inactive' : escapeHTML(s.status);

      return `
        <tr data-grade="${escapeHTML(s.grade || '')}">
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--primary); font-weight: 700; font-size: 11px;">
                ${hasPhoto(s.photo) ? `<img src="${escapeHTML(resolvePhotoUrl(s.photo))}" style="width:100%;height:100%;object-fit:cover;">` : escapeHTML((s.name || 'U').substring(0, 2).toUpperCase())}
              </div>
              <div>
                <div style="font-weight: 600;">${escapeHTML(s.name)}</div>
                <div style="font-size: 11px; color: var(--text3);">${escapeHTML(s.studid || s.id)}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHTML(s.fullSection || s.grade || '—')}</div>
            <div style="font-size: 11px; color: var(--text3);">${escapeHTML(s.preferredGate || '—')}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHTML(s.parentName || '—')}</div>
            <div style="font-size: 11px; color: var(--text3);">${escapeHTML(s.parentEmail || '—')}</div>
          </td>
          <td>
            <span class="badge ${statusBadge}">${statusLabel}</span>
          </td>
          <td>
            <div class="flex gap-4">
              ${isForApproval && !isGuard ? `
              <button class="btn btn-sm btn-approve-student" data-id="${s.id}" style="background:var(--green,#10b981);color:#fff;border:none;border-radius:var(--radius);padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                ${Icons['check-circle'](12)} Approve
              </button>
              <button class="btn btn-ghost btn-sm btn-reject-student" data-id="${s.id}" style="color:var(--red,#ef4444);" data-tooltip="Reject Application">
                ${Icons['x-close'](14)}
              </button>` : `
              <button class="btn btn-ghost btn-sm btn-view-id" data-id="${s.id}" data-tooltip="View ID Card">
                ${Icons['eye'](14)}
              </button>
              ${!isGuard ? `
              <button class="btn btn-ghost btn-sm btn-edit-student" data-id="${s.id}" data-tooltip="Edit Student" style="color: var(--primary);">
                ${Icons['edit'](14)}
              </button>
              ${isActive ? `
              <button class="btn btn-ghost btn-sm btn-archive-student" data-id="${s.id}" data-tooltip="Archive Student" style="color: var(--orange);">
                ${Icons['archive'](14)}
              </button>` : ''}
              ${(isArchived || isSuspended || isInactive) ? `
              <button class="btn btn-ghost btn-sm btn-restore-student" data-id="${s.id}" data-tooltip="Restore to Active" style="color: var(--green);">
                ${Icons['check-circle'](14)}
              </button>` : ''}
              ` : ''}`}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ── For Approval: Left list panel ─────────────────────────
  static renderForApprovalList(applicants) {
    if (!applicants || applicants.length === 0) {
      return `<div style="padding:24px 16px; text-align:center; color:var(--text3); font-size:13px;">${Icons['users'](24)}<br><br>No pending applications</div>`;
    }
    return applicants.map(s => `
      <div class="approval-list-item" data-id="${escapeHTML(s.id)}"
        style="padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; transition:background 0.15s;">
        <div style="width:38px; height:38px; border-radius:50%; flex-shrink:0; overflow:hidden; background:var(--primary-soft); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:var(--primary);">
          ${hasPhoto(s.photo) ? `<img src="${escapeHTML(resolvePhotoUrl(s.photo))}" style="width:100%;height:100%;object-fit:cover;">` : escapeHTML((s.name || 'U').substring(0,2).toUpperCase())}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(s.name || '—')}</div>
          <div style="font-size:11px; color:var(--text3); margin-top:2px;">${escapeHTML(s.grade || '—')} · ${escapeHTML(s.section || '—')}</div>
        </div>
        <div style="color:var(--text3); flex-shrink:0;">${Icons['arrow-right'](14)}</div>
      </div>
    `).join('');
  }

  // ── For Approval: Right detail panel ──────────────────────
  static renderApprovalDetail(student, passIdPreview, isGuard) {
    const photo = hasPhoto(student.photo) ? resolvePhotoUrl(student.photo) : null;
    const isMalformed = /^PGP-\d+$/.test(student.id || '');

    return `
      <div style="padding:20px;">
        <!-- Header: Photo + Name -->
        <div style="display:flex; gap:16px; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid var(--border); margin-bottom:16px;">
          <div style="width:88px; height:88px; border-radius:10px; border:2px solid var(--border); overflow:hidden; flex-shrink:0; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center;">
            ${photo
              ? `<img src="${escapeHTML(photo)}" style="width:100%;height:100%;object-fit:cover;">`
              : `<span style="font-size:26px; font-weight:800; color:var(--primary);">${escapeHTML((student.name||'U').substring(0,2).toUpperCase())}</span>`}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:19px; font-weight:700; line-height:1.25;">${escapeHTML(student.name || '—')}</div>
            <div style="font-size:13px; color:var(--text2); margin-top:4px;">${escapeHTML(student.grade || '—')}${student.section ? ` — ${escapeHTML(student.section)}` : ''}</div>
            <div style="font-size:12px; color:var(--text3); margin-top:2px;">AY ${escapeHTML(student.schoolYear || '—')}</div>
          </div>
        </div>

        <!-- Details Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; font-size:13px;">
          <div>
            <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text3); margin-bottom:3px; letter-spacing:0.5px;">Preferred Gate</div>
            <div style="font-weight:600;">${escapeHTML(student.preferredGate || '—')}</div>
          </div>
          <div>
            <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text3); margin-bottom:3px; letter-spacing:0.5px;">Arrangement</div>
            <div style="font-weight:600; font-size:12px;">${escapeHTML(student.arrangements || '—')}</div>
          </div>
          ${student.vehicleDetails ? `
          <div style="grid-column:1/-1;">
            <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text3); margin-bottom:3px; letter-spacing:0.5px;">Vehicle</div>
            <div style="font-weight:600;">${escapeHTML(student.vehicleDetails)}</div>
          </div>` : ''}
          ${student.address ? `
          <div style="grid-column:1/-1;">
            <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text3); margin-bottom:3px; letter-spacing:0.5px;">Address</div>
            <div style="font-weight:600; font-size:12px;">${escapeHTML(student.address)}</div>
          </div>` : ''}
        </div>

        <!-- Parent Info -->
        <div style="background:var(--bg-elevated); border-radius:8px; padding:14px; margin-bottom:16px;">
          <div style="font-size:10px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Parent / Guardian</div>
          <div style="font-size:13px; font-weight:700; margin-bottom:4px;">${escapeHTML(student.parentName || '—')}</div>
          <div style="font-size:12px; color:var(--text2); margin-bottom:2px;">${escapeHTML(student.parentEmail || '—')}</div>
          <div style="font-size:12px; color:var(--text2);">${escapeHTML(student.phone || '—')}</div>
        </div>

        <!-- PassID -->
        <div style="background:var(--primary-soft); border:1px solid var(--primary); border-radius:8px; padding:14px; margin-bottom:${!isGuard ? '16px' : '0'};">
          <div style="font-size:10px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">
            Pass ID${isMalformed ? ' ⚠ Needs correction after approval' : ''}
          </div>
          <div style="font-family:monospace; font-size:20px; font-weight:800; color:var(--primary); letter-spacing:2px;">${escapeHTML(passIdPreview)}</div>
          ${isMalformed ? `<div style="font-size:11px; color:var(--text3); margin-top:4px;">Fix Apps Script to auto-generate proper PassID on new submissions.</div>` : ''}
        </div>

        <!-- Action Buttons -->
        ${!isGuard ? `
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-approve-student" data-id="${escapeHTML(student.id)}" style="flex:1; min-width:140px; justify-content:center; gap:6px;">
            ${Icons['check-circle'](14)} Approve &amp; Activate
          </button>
          <button class="btn btn-ghost btn-reject-student" data-id="${escapeHTML(student.id)}" style="color:var(--red,#ef4444); border-color:var(--red,#ef4444); gap:6px;">
            ${Icons['x-close'](14)} Reject
          </button>
        </div>
        ` : ''}
      </div>
    `;
  }

  static renderCardView(students, model) {
    if (!students || students.length === 0) {
      return `<div style="grid-column: 1 / -1;" class="empty">
        <div class="empty-state">
          ${Icons['users'](48)}
          <div class="empty-state-title">No Students Found</div>
          <div class="empty-state-sub">There are no students matching the current filters or no students have been enrolled yet.</div>
        </div>
      </div>`;
    }

    const isGuard = model && model.currentUser && model.currentUser.role === 'guard';

    return students.map(s => {
      const isActive = s.status === 'active';
      const isArchived = s.status === 'archived';
      const statusBadge = isActive ? 'b-active' : (isArchived ? 'b-pending' : 'b-denied');
      const statusLabel = isActive ? 'Active PGP' : (isArchived ? 'Archived' : escapeHTML(s.status));

      return `
        <div class="student-card" data-grade="${escapeHTML(s.grade || '')}" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <!-- Header: Photo + Info -->
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--primary); font-weight: 700; font-size: 16px; flex-shrink: 0;">
              ${hasPhoto(s.photo) ? `<img src="${escapeHTML(resolvePhotoUrl(s.photo))}" style="width:100%;height:100%;object-fit:cover;">` : escapeHTML((s.name || 'U').substring(0, 2).toUpperCase())}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; font-size: 15px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(s.name)}</div>
              <div style="font-size: 12px; color: var(--text3); margin-top: 2px;">${escapeHTML(s.studid || s.id)}</div>
              <div style="margin-top: 6px;"><span class="badge ${statusBadge}">${statusLabel}</span></div>
            </div>
          </div>
          
          <!-- Details -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; background: var(--bg-body); padding: 10px; border-radius: 8px;">
            <div>
              <div style="color: var(--text3); margin-bottom: 2px; font-weight: 500;">Grade Level</div>
              <div style="font-weight: 600; color: var(--text);">${escapeHTML(s.fullSection || s.grade || '—')}</div>
            </div>
            <div>
              <div style="color: var(--text3); margin-bottom: 2px; font-weight: 500;">Gate</div>
              <div style="font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(s.preferredGate || '—')}</div>
            </div>
            <div style="grid-column: 1 / -1;">
              <div style="color: var(--text3); margin-bottom: 2px; font-weight: 500;">Guardian</div>
              <div style="font-weight: 600; color: var(--text); display: flex; justify-content: space-between;">
                <span>${escapeHTML(s.parentName || '—')}</span>
                <span style="color: var(--primary); font-weight: 500;">${escapeHTML(s.parentEmail || '')}</span>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: auto; border-top: 1px solid var(--border); padding-top: 12px;">
            <button class="btn btn-ghost btn-sm btn-view-id" data-id="${s.id}" data-tooltip="View ID Card" style="flex: 1; justify-content: center; background: var(--bg-body);">
              ${Icons['eye'](14)} View ID
            </button>
            ${!isGuard ? `
            <button class="btn btn-ghost btn-sm btn-edit-student" data-id="${s.id}" data-tooltip="Edit Student" style="color: var(--primary); background: var(--primary-soft);">
              ${Icons['edit'](14)}
            </button>
            ${isActive ? `
            <button class="btn btn-ghost btn-sm btn-archive-student" data-id="${s.id}" data-tooltip="Archive Student" style="color: var(--orange); background: rgba(245, 158, 11, 0.1);">
              ${Icons['archive'](14)}
            </button>` : ''}
            ${isArchived ? `
            <button class="btn btn-ghost btn-sm btn-restore-student" data-id="${s.id}" data-tooltip="Restore Student" style="color: var(--green); background: rgba(16, 185, 129, 0.1);">
              ${Icons['check-circle'](14)}
            </button>` : ''}
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

}
