import Icons from '../icons.js';
import { escapeHTML, resolvePhotoUrl, hasPhoto } from '../utils.js';

export default class ScannerView {
  static render(model) {
    const todayLogs = (model.exitLogs || []).filter(l => l.timestamp && l.timestamp.startsWith(new Date().toLocaleDateString('en-CA')));
    const userGate = model.currentUser?.gate || 'Gate 1';
    
    const scansCount = todayLogs.length;
    const grantedCount = todayLogs.filter(l => l.result === 'granted').length;
    const deniedCount = todayLogs.filter(l => l.result === 'denied').length;
    const tgpScansCount = todayLogs.filter(l => l.passType === 'TGP').length;

    return `
      <div class="kpi-strip">
        <div class="kpi-card kpi-purple">
          <div class="kpi-icon">${Icons['scan-line'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${scansCount}</div><div class="kpi-lbl">Today's Scans</div></div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon">${Icons['check-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${grantedCount}</div><div class="kpi-lbl">Granted</div></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon">${Icons['x-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${deniedCount}</div><div class="kpi-lbl">Denied</div></div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon">${Icons['file-text'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${tgpScansCount}</div><div class="kpi-lbl">TGP Scans</div></div>
        </div>
      </div>

      <div class="scanner-grid" style="align-items: start;">
        
        <!-- Scanner Main Area -->
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title" style="display: flex; align-items: center; gap: 8px;">
                ${Icons['scan-line'](18)} Gate Scanner
              </div>
              <div class="card-sub">Scan ID or enter pass number manually</div>
            </div>

          </div>

          <!-- Gate Banner -->
          <div class="gate-banner">
            <div class="gate-banner-title">
              ${Icons['door-open'](32)}
              <span id="gate-banner-text">${escapeHTML(userGate.toUpperCase())}</span>
            </div>
            <div class="form-group" style="width: 160px; margin: 0;">
              <select id="scan-gate" class="form-input" style="background: rgba(255,255,255,0.9); border: none; font-weight: 600;" ${model.currentUser?.role === 'guard' ? 'disabled' : ''}>
                <option value="Tropical Gate" ${userGate === 'Tropical Gate' ? 'selected' : ''}>Tropical Gate</option>
                <option value="Gate 1" ${userGate === 'Gate 1' ? 'selected' : ''}>Gate 1</option>
                <option value="Gate 2" ${userGate === 'Gate 2' ? 'selected' : ''}>Gate 2</option>
                <option value="College Gate" ${userGate === 'College Gate' ? 'selected' : ''}>College Gate</option>
              </select>
            </div>
          </div>

          <!-- Tabs -->
          <div class="scan-tabs-bar">
            <button class="scan-tab active" data-target="camera" style="padding: 12px 16px; background: none; border: none; font-weight: 600; color: var(--primary); border-bottom: 2px solid var(--primary); display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${Icons['camera'](16)} QR Scan
            </button>
            <button class="scan-tab" data-target="manual" style="padding: 12px 16px; background: none; border: none; font-weight: 500; color: var(--text2); border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${Icons['file-text'](16)} Manual Input
            </button>
            <button class="scan-tab" data-target="usb" style="padding: 12px 16px; background: none; border: none; font-weight: 500; color: var(--text2); border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${Icons['usb'](16)} USB Scanner
            </button>
            <button class="scan-tab" data-target="facescan" style="padding: 12px 16px; background: none; border: none; font-weight: 500; color: var(--text2); border-bottom: 2px solid transparent; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${Icons['face-scan'](16)} Face Scan
            </button>
          </div>

          <!-- Panels -->
          <div style="padding: 24px;">
            
            <!-- USB Panel -->
            <div id="panel-usb" class="scan-panel" style="display: none;">
              <div style="background: var(--accent-soft); border: 2px solid var(--accent); border-radius: var(--radius); padding: 32px 24px; text-align: center;">
                <div style="color: var(--accent-d); margin-bottom: 12px;">${Icons['usb'](48)}</div>
                <h3 style="color: var(--primary); margin-bottom: 8px;">Ready for USB Scanner</h3>
                <p style="color: var(--text2); font-size: 13px; max-width: 320px; margin: 0 auto 20px;">
                  Click the input below and scan the ID card. The scanner will automatically press Enter.
                </p>
                <input type="text" id="scan-usb-input" class="form-input" style="max-width: 300px; margin: 0 auto; text-align: center; font-family: monospace; font-size: 16px; font-weight: bold; border-width: 2px;" placeholder="Scan or type here..." autofocus>
              </div>
            </div>

            <!-- Manual Panel -->
            <div id="panel-manual" class="scan-panel" style="display: none;">
              <div style="background: var(--primary-soft); border: 2px dashed var(--primary); opacity: 0.8; border-radius: var(--radius); padding: 32px 24px; text-align: center;">
                <div style="color: var(--primary); margin-bottom: 12px;">${Icons['edit'](48)}</div>
                <h3 style="color: var(--primary); margin-bottom: 8px;">Manual Pass Entry</h3>
                <p style="color: var(--text2); font-size: 13px; max-width: 320px; margin: 0 auto 20px;">
                  Type the Student ID or PGP number exactly as it appears on the record.
                </p>
                <div style="display: flex; gap: 8px; max-width: 300px; margin: 0 auto;">
                  <input type="text" id="scan-manual-input" class="form-input" style="flex: 1; text-align: center; font-family: monospace;" placeholder="Student ID or PGP">
                  <button class="btn btn-primary" id="btn-manual-verify">Verify</button>
                </div>
              </div>
            </div>

            <!-- Camera Panel -->
            <div id="panel-camera" class="scan-panel" style="display: block;">
              <div style="background: #000; border-radius: var(--radius); overflow: hidden; position: relative; min-height: 280px; display: flex; align-items: center; justify-content: center;">
                
                <video id="scan-video" style="width: 100%; height: auto; display: none;"></video>
                <canvas id="scan-canvas" style="display: none;"></canvas>
                
                <!-- Target Overlay -->
                <div id="scan-overlay" style="display: none; position: absolute; inset: 0; border: 40px solid rgba(0,0,0,0.5);">
                  <div style="position: absolute; inset: 0; border: 2px solid var(--accent); box-shadow: 0 0 0 4px rgba(0,201,177,0.3);"></div>
                </div>

                <!-- Start UI -->
                <div id="scan-start-ui" style="text-align: center; color: #fff; padding: 24px;">
                  <div style="color: rgba(255,255,255,0.5); margin-bottom: 16px;">${Icons['camera'](48)}</div>
                  <button class="btn btn-accent" id="btn-start-camera" style="padding: 10px 20px;">Start Camera</button>
                  <p style="color: #aaa; font-size: 11px; margin-top: 12px;">Requires camera permission</p>
                </div>

                <!-- Active UI (Stop / Switch) -->
                <div id="scan-active-ui" style="display: none; position: absolute; bottom: 16px; left: 0; right: 0; text-align: center; z-index: 10; pointer-events: none;">
                  <div style="display: inline-flex; gap: 10px; background: rgba(0,0,0,0.6); padding: 8px 12px; border-radius: 99px; pointer-events: auto; backdrop-filter: blur(4px);">
                    <button id="btn-switch-camera" style="background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 8px 16px; border-radius: 99px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                      ${Icons['refresh'](14)} Switch
                    </button>
                    <button id="btn-stop-camera" style="background: var(--red); border: none; color: #fff; padding: 8px 16px; border-radius: 99px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                      ${Icons['x-close'](14)} Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Face Scan Panel -->
            <div id="panel-facescan" class="scan-panel" style="display: none;">
              <div style="background: #000; border-radius: var(--radius); overflow: hidden; position: relative; min-height: 280px; display: flex; align-items: center; justify-content: center;">
                
                <video id="face-video" style="width: 100%; height: auto; display: none; transform: scaleX(-1);" playsinline></video>
                <canvas id="face-overlay-canvas" style="display: none; position: absolute; inset: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none;"></canvas>
                
                <!-- Face Scan Status Overlay -->
                <div id="face-status-overlay" style="display: none; position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #fff; padding: 8px 20px; border-radius: 99px; font-size: 12px; font-weight: 700; z-index: 2; white-space: nowrap;"></div>

                <!-- Liveness Prompt Overlay -->
                <div id="face-liveness-overlay" style="display: none; position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(66,36,103,0.9); color: #fff; padding: 10px 24px; border-radius: 10px; font-size: 13px; font-weight: 700; z-index: 2; text-align: center; white-space: nowrap;">
                  👁️ Please BLINK to verify liveness
                </div>

                <!-- Start UI -->
                <div id="face-start-ui" style="text-align: center; color: #fff; padding: 24px;">
                  <div style="color: rgba(255,255,255,0.5); margin-bottom: 12px;">${Icons['face-scan'](48)}</div>
                  <h3 style="color: #fff; font-size: 15px; margin-bottom: 6px;">Face Recognition</h3>
                  <p style="color: #aaa; font-size: 12px; max-width: 300px; margin: 0 auto 20px;">Use facial biometrics to verify student identity. Enroll a face first, then scan to match.</p>
                  <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-accent" id="btn-start-face-scan" style="padding: 10px 20px;">Start Face Scan</button>
                    ${model.currentUser && model.currentUser.role === 'admin' ? `
                      <button class="btn btn-ghost" id="btn-enroll-face" style="padding: 10px 20px; color: #fff; border-color: rgba(255,255,255,0.3);">${Icons['plus'](14)} Enroll Face</button>
                    ` : ''}
                  </div>
                  <div id="face-enrolled-count" style="color: #aaa; font-size: 11px; margin-top: 12px;"></div>
                  <div style="color: #666; font-size: 10px; margin-top: 8px; max-width: 280px; margin-left: auto; margin-right: auto;">
                    ${Icons['shield-check'](12)} Biometric data is processed locally and protected under RA 10173.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Live Feed Sidebar -->
        <div class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Live Exit Feed</div>
              <div class="card-sub">Today's scans</div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green);"></div>
              <span style="font-size: 11px; font-weight: 600; color: var(--green);">Live</span>
            </div>
          </div>
          <div id="live-feed-container" style="max-height: 500px; overflow-y: auto;">
            ${this.renderLiveFeed(todayLogs, model)}
          </div>
        </div>
      </div>
      
      <!-- Premium Glassmorphism Result Overlay -->
      <div id="scan-result-overlay" style="display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(15, 10, 20, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
        <div style="position: relative; width: 100%; max-width: 550px; margin: 20px; animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <!-- Close Button -->
          <button id="btn-close-scan-result" style="position: absolute; top: -12px; right: -12px; z-index: 10; background: #fff; border: 2px solid var(--border); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.15); color: var(--text); transition: transform 0.2s, background 0.2s;">
            ${Icons['x-close'](18)}
          </button>
          
          <div id="scan-result" style="width: 100%; box-shadow: 0 24px 48px rgba(0,0,0,0.4); border-radius: 16px; overflow: hidden;"></div>
        </div>
      </div>
      <style>
        @keyframes modalPop {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        #btn-close-scan-result:hover { transform: scale(1.1); background: var(--bg-hover); }
      </style>
    `;
  }

  static renderLiveFeed(logs, model) {
    if (!logs || logs.length === 0) {
      return `
        <div class="empty" style="padding: 32px 16px;">
          <div class="empty-icon">${Icons['users'](32)}</div>
          <div class="empty-title">Waiting for scans...</div>
        </div>
      `;
    }

    // Show recent first
    return logs.slice(0, 15).map(log => {
      const student = model.getStudentByPassId(log.studentId) || model.getStudentByStudId(log.studentId);
      const sName = student ? escapeHTML(student.name) : 'Unknown';
      const isDenied = log.result === 'denied';
      const timeStr = new Date(log.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

      return `
        <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: ${isDenied ? 'var(--red-s)' : 'transparent'};">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sName}</div>
            <div style="font-size: 10px; color: var(--text3);">${log.gate}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <span class="badge ${isDenied ? 'b-denied' : 'b-active'}">${isDenied ? 'Denied' : 'Granted'}</span>
            <div style="font-size: 10px; color: var(--text3); margin-top: 4px;">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  static renderResult(student, isDenied, message, designatedGate = '') {
    if (!student) {
      return `
        <div class="scan-result-invalid">
          ${Icons['x-circle'](32)}
          <div>
            <div class="scan-result-invalid-title">Invalid Pass</div>
            <div class="scan-result-invalid-sub">${message ? escapeHTML(message) : 'Student not found in the system.'}</div>
          </div>
        </div>
      `;
    }

    const resultClass = isDenied ? 'denied' : 'granted';
    const icon = isDenied ? Icons['x-circle'](42) : Icons['check-circle'](42);

    return `
      <div class="scan-result-card ${resultClass}">
        <div class="scan-result-bg-icon">${icon}</div>
        <div class="scan-result-icon">${icon}</div>
        <div class="scan-result-info">
          <div class="scan-result-title">${isDenied ? 'EXIT DENIED' : 'EXIT GRANTED'}</div>
          <div class="scan-result-name">${escapeHTML(student.name)} <span class="scan-result-id">(${escapeHTML(student.studid || student.id)})</span></div>
          <div class="scan-result-grade">${escapeHTML(student.fullSection || student.grade)}</div>
          <div class="scan-result-details">
            ${designatedGate ? `<div class="scan-result-detail-row"><b>Gate:</b> ${escapeHTML(designatedGate)}</div>` : ''}
            ${student.arrangements ? `<div class="scan-result-detail-row"><b>Arrangement:</b> ${escapeHTML(student.arrangements)}</div>` : ''}
            ${student.vehicleDetails ? `<div class="scan-result-detail-row"><b>Vehicle:</b> ${escapeHTML(student.vehicleDetails)}</div>` : ''}
          </div>
          ${message ? `<div class="scan-result-message">${escapeHTML(message)}</div>` : ''}
        </div>
        ${hasPhoto(student.photo) ? `<div class="scan-result-photo"><img src="${escapeHTML(resolvePhotoUrl(student.photo))}" alt="${escapeHTML(student.name)}"></div>` : ''}
      </div>
    `;
  }
}
