import Icons from '../icons.js';
import { escapeHTML } from '../utils.js';

export default class LogsView {
  static render(model) {
    const logs = model.exitLogs || [];
    const userGate = model.currentUser?.gate || 'all';
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr));
    const grantedLogs = logs.filter(l => l.result === 'granted');
    const grantRate = logs.length > 0 ? ((grantedLogs.length / logs.length) * 100).toFixed(1) + '%' : '0%';
    
    const gateCounts = {};
    logs.forEach(l => { if (l.gate) gateCounts[l.gate] = (gateCounts[l.gate] || 0) + 1; });
    const mostActiveGate = Object.keys(gateCounts).sort((a, b) => gateCounts[b] - gateCounts[a])[0] || 'None';

    return `
      <div class="kpi-strip">
        <div class="kpi-card kpi-purple">
          <div class="kpi-icon">${Icons['file-text'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${logs.length}</div><div class="kpi-lbl">Total Records</div></div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon">${Icons['door-open'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${todayLogs.length}</div><div class="kpi-lbl">Today's Exits</div></div>
        </div>
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon">${Icons['check-circle'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${grantRate}</div><div class="kpi-lbl">Grant Rate</div></div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon">${Icons['bar-chart'](20)}</div>
          <div class="kpi-info"><div class="kpi-val">${escapeHTML(mostActiveGate)}</div><div class="kpi-lbl">Most Active Gate</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Exit Logs</div>
            <div class="card-sub">Immutable record of all gate pass scans</div>
          </div>
          <div class="flex gap-8 items-center">
            <button class="btn btn-ghost btn-sm" id="logs-btn-export">
              ${Icons['download'](14)} Export CSV
            </button>
            <button class="btn btn-danger btn-sm" id="logs-btn-clear">
              ${Icons['trash'](14)} Clear All
            </button>
          </div>
        </div>
        
        <div class="logs-filter-bar">
          <div class="form-group logs-search-group">
            <input type="text" id="logs-search" class="form-input" placeholder="Search by student ID or name...">
          </div>
          <div class="form-group logs-select-group">
            <select id="logs-filter-grade" class="form-input">
              <option value="all">All Grades</option>
              <option value="Pre-school">Pre-school</option>
              <option value="Grade 1">Grade 1</option>
              <option value="Grade 2">Grade 2</option>
              <option value="Grade 3">Grade 3</option>
              <option value="Grade 4">Grade 4</option>
              <option value="Grade 5">Grade 5</option>
              <option value="Grade 6">Grade 6</option>
              <option value="Grade 7">Grade 7</option>
              <option value="Grade 8">Grade 8</option>
              <option value="Grade 9">Grade 9</option>
              <option value="Grade 10">Grade 10</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
              <option value="College">College</option>
            </select>
          </div>
          <div class="form-group logs-select-group">
            <select id="logs-filter-gate" class="form-input">
              <option value="all">All Gates</option>
              <option value="Tropical Gate" ${userGate === 'Tropical Gate' ? 'selected' : ''}>Tropical Gate</option>
              <option value="Gate 1" ${userGate === 'Gate 1' ? 'selected' : ''}>Gate 1</option>
              <option value="Gate 2" ${userGate === 'Gate 2' ? 'selected' : ''}>Gate 2</option>
              <option value="College Gate" ${userGate === 'College Gate' ? 'selected' : ''}>College Gate</option>
            </select>
          </div>
          <div class="form-group logs-time-group">
            <span class="logs-time-label">Time:</span>
            <input type="time" id="logs-filter-time-from" class="form-input logs-time-input">
            <span class="logs-time-label">to</span>
            <input type="time" id="logs-filter-time-to" class="form-input logs-time-input">
          </div>
        </div>

        <div class="tbl-wrap">
          <table id="logs-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Student</th>
                <th>Gate</th>
                <th>Result</th>
                <th>Pass Type</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderTableRows(logs, model)}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Footer -->
        <div id="logs-pagination" class="pagination-bar"></div>
      </div>
    `;
  }

  static renderTableRows(logs, model) {
    if (!logs || logs.length === 0) {
      return `<tr><td colspan="5" class="empty">
        <div class="empty-state">
          ${Icons['clock'] ? Icons['clock'](48) : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'}
          <div class="empty-state-title">No Scan Logs</div>
          <div class="empty-state-sub">There are no exit logs recorded yet or matching your current filters.</div>
        </div>
      </td></tr>`;
    }

    return logs.map(log => {
      const student = model.getStudentByPassId(log.studentId) || model.getStudentByStudId(log.studentId);
      const sName = student ? escapeHTML(student.name) : 'Unknown';
      const sId = student ? escapeHTML(student.studid || student.id) : escapeHTML(log.studentId);
      const sGrade = student ? escapeHTML(student.grade) : '';
      
      const date = new Date(log.timestamp);
      const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const timeVal = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      const isDenied = log.result === 'denied';
      const rowGate = escapeHTML(log.gate || 'Gate 1');

      return `
        <tr data-gate="${rowGate}" data-grade="${sGrade}" data-time="${timeVal}">
          <td>
            <div style="font-weight: 600;">${dateStr}</div>
            <div style="font-size: 11px; color: var(--text3);">${timeStr}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${sName}</div>
            <div style="font-size: 11px; color: var(--text3);">${sId}</div>
          </td>
          <td>${log.gate || 'Gate 1'}</td>
          <td>
            <span class="badge ${isDenied ? 'b-denied' : 'b-active'}">${isDenied ? 'Denied' : 'Granted'}</span>
          </td>
          <td>
            <span class="badge b-info">${log.passType || 'PGP'}</span>
          </td>
        </tr>
      `;
    }).join('');
  }
}
