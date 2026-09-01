import Icons from '../icons.js';

export default class ReportsView {
  static render(model) {
    const students = model.students || [];
    const passes = students.filter(s => s.pgp);
    const logs = model.exitLogs || [];

    // Today's Date String
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr));

    // ── 1. Pass Status Summary ──
    const active = passes.filter(p => p.status === 'active').length;
    const suspended = passes.filter(p => p.status === 'suspended').length;
    const revoked = passes.filter(p => p.status === 'revoked').length;
    const totalPasses = Math.max(passes.length, 1);

    const activePct = Math.round((active / totalPasses) * 100);
    const suspendedPct = Math.round((suspended / totalPasses) * 100);
    const revokedPct = Math.round((revoked / totalPasses) * 100);

    // ── 2. Exit Activity (All Time) ──
    const granted = logs.filter(l => l.result === 'granted').length;
    const denied = logs.filter(l => l.result === 'denied').length;
    const totalLogs = Math.max(logs.length, 1);

    const grantedPct = Math.round((granted / totalLogs) * 100);
    const deniedPct = Math.round((denied / totalLogs) * 100);

    // ── 3. Gate Utilization (All Time) ──
    const gateUsage = {};
    logs.forEach(l => {
      const gate = l.gate || 'Gate 1';
      gateUsage[gate] = (gateUsage[gate] || 0) + 1;
    });
    const sortedGates = Object.entries(gateUsage).sort((a, b) => b[1] - a[1]);
    const totalGateLogs = Math.max(logs.length, 1);

    // ── 4. Hourly Activity (Today) ──
    const hourlyData = Array(12).fill(0); // 7 AM to 6 PM
    let maxHourCount = 0;
    todayLogs.forEach(l => {
      const date = new Date(l.timestamp);
      const hour = date.getHours();
      if (hour >= 7 && hour <= 18) {
        const idx = hour - 7;
        hourlyData[idx]++;
        if (hourlyData[idx] > maxHourCount) maxHourCount = hourlyData[idx];
      }
    });
    const hourLabels = ['7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM'];

    // ── 5. Pass Types (Today) ──
    const pgpScans = todayLogs.filter(l => l.passType !== 'TGP').length;
    const tgpScans = todayLogs.filter(l => l.passType === 'TGP').length;
    const totalToday = Math.max(todayLogs.length, 1);
    const pgpPct = Math.round((pgpScans / totalToday) * 100);
    const tgpPct = Math.round((tgpScans / totalToday) * 100);

    // ── 6. Grade Level Distribution ──
    const gradeUsage = {};
    passes.forEach(p => {
      const g = p.grade || 'Unknown';
      gradeUsage[g] = (gradeUsage[g] || 0) + 1;
    });
    const sortedGrades = Object.entries(gradeUsage).sort((a, b) => b[1] - a[1]);

    // ── Build sub-sections via helpers ──
    const hourlyBarsHtml = this.buildHourlyBars(hourlyData, maxHourCount, hourLabels);
    const gateBarsHtml = this.buildGateBars(sortedGates, totalGateLogs);
    const gradeRowsHtml = this.buildGradeRows(sortedGrades, passes.length);

    return `
      <!-- Header with Print Button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;" class="no-print">
        <div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text);">System Reports</h2>
          <div style="font-size: 13px; color: var(--text2);">Analytics and printable PDF reports</div>
        </div>
        <button class="btn btn-primary" id="btn-print-report" style="display: flex; align-items: center; gap: 8px;">
          ${Icons['printer'](16)} Print PDF Report
        </button>
      </div>

      <!-- Printable Report Container -->
      <div id="print-area">

        <!-- Print Header (hidden on screen) -->
        <div class="print-only" style="margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <h1 style="margin: 0; font-size: 24px;">Southville International School and Colleges</h1>
          <h2 style="margin: 5px 0 0 0; font-size: 18px; color: #555;">Gate Pass System - Official Report</h2>
          <div style="font-size: 12px; color: #777; margin-top: 5px;">Generated on: ${new Date().toLocaleString('en-PH')}</div>
        </div>

        <!-- ═══ ROW 1: Summary Cards ═══ -->
        <div class="grid-2">
          <!-- Pass Status Summary -->
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Pass Status Summary</div>
                <div class="card-sub">Distribution of permanent gate passes</div>
              </div>
              <div style="color: var(--primary);">${Icons['shield-check'](20)}</div>
            </div>
            <div class="card-body">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 80px; text-align: right; font-size: 11px; color: var(--text2);">Active</div>
                <div style="flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden;">
                  <div style="width: ${activePct}%; height: 100%; background: var(--green); border-radius: 5px;" class="print-bg-exact"></div>
                </div>
                <div style="width: 30px; font-weight: 700; color: var(--green); text-align: right;">${active}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 80px; text-align: right; font-size: 11px; color: var(--text2);">Suspended</div>
                <div style="flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden;">
                  <div style="width: ${suspendedPct}%; height: 100%; background: var(--orange); border-radius: 5px;" class="print-bg-exact"></div>
                </div>
                <div style="width: 30px; font-weight: 700; color: var(--orange); text-align: right;">${suspended}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 80px; text-align: right; font-size: 11px; color: var(--text2);">Revoked</div>
                <div style="flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden;">
                  <div style="width: ${revokedPct}%; height: 100%; background: var(--red); border-radius: 5px;" class="print-bg-exact"></div>
                </div>
                <div style="width: 30px; font-weight: 700; color: var(--red); text-align: right;">${revoked}</div>
              </div>
            </div>
          </div>

          <!-- Exit Activity -->
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Overall Exit Activity</div>
                <div class="card-sub">All-time scan results</div>
              </div>
              <div style="color: var(--primary);">${Icons['scan-line'](20)}</div>
            </div>
            <div class="card-body">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 80px; text-align: right; font-size: 11px; color: var(--text2);">Granted Exits</div>
                <div style="flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden;">
                  <div style="width: ${grantedPct}%; height: 100%; background: var(--primary); border-radius: 5px;" class="print-bg-exact"></div>
                </div>
                <div style="width: 30px; font-weight: 700; color: var(--primary); text-align: right;">${granted}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                <div style="width: 80px; text-align: right; font-size: 11px; color: var(--text2);">Denied</div>
                <div style="flex: 1; height: 10px; background: var(--bg-elevated); border-radius: 5px; overflow: hidden;">
                  <div style="width: ${deniedPct}%; height: 100%; background: var(--red); border-radius: 5px;" class="print-bg-exact"></div>
                </div>
                <div style="width: 30px; font-weight: 700; color: var(--red); text-align: right;">${denied}</div>
              </div>
              <div style="background: var(--primary-soft); padding: 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 11px; color: var(--primary); font-weight: 700; text-transform: uppercase;">Total Scans Today</div>
                  <div style="font-size: 18px; font-weight: 800; color: var(--text);">${todayLogs.length}</div>
                </div>
                <div style="color: var(--primary);">${Icons['bar-chart'](24)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ ROW 2: Charts ═══ -->
        <div class="grid-2 mt-16">
          <!-- Hourly Activity Chart -->
          <div class="card">
            <div class="card-head">
              <div>
                <div class="card-title">Today's Peak Hours</div>
                <div class="card-sub">Scan frequency by hour (7 AM – 6 PM)</div>
              </div>
              <div style="color: var(--primary);">${Icons['clock'](20)}</div>
            </div>
            <div class="card-body">
              <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 140px; padding: 10px 0 0 0; border-bottom: 1px solid var(--border);">
                ${hourlyBarsHtml}
              </div>
            </div>
          </div>

          <!-- Gates & Pass Types stacked -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Gate Utilization -->
            <div class="card" style="flex: 1;">
              <div class="card-head" style="padding-bottom: 12px;">
                <div>
                  <div class="card-title">Gate Utilization</div>
                  <div class="card-sub">All-time scan distribution by gate</div>
                </div>
                <div style="color: var(--primary);">${Icons['door-open'](20)}</div>
              </div>
              <div class="card-body" style="padding-top: 0;">
                ${sortedGates.length === 0 ? '<div style="font-size: 12px; color: var(--text3); text-align: center; padding: 10px;">No gate data yet</div>' : gateBarsHtml}
              </div>
            </div>

            <!-- Pass Types Today -->
            <div class="card" style="flex: 1;">
              <div class="card-head" style="padding-bottom: 12px;">
                <div>
                  <div class="card-title">Today's Pass Types</div>
                  <div class="card-sub">Permanent vs Temporary passes used today</div>
                </div>
                <div style="color: var(--primary);">${Icons['file-text'](20)}</div>
              </div>
              <div class="card-body" style="padding-top: 0;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                  <div style="width: 70px; font-size: 11px; font-weight: 600; color: var(--text);">PGP</div>
                  <div style="flex: 1; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${pgpPct}%; height: 100%; background: var(--primary); border-radius: 3px;" class="print-bg-exact"></div>
                  </div>
                  <div style="width: 40px; text-align: right; font-size: 11px; color: var(--text2);">${pgpScans}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 70px; font-size: 11px; font-weight: 600; color: var(--text);">TGP</div>
                  <div style="flex: 1; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${tgpPct}%; height: 100%; background: var(--orange); border-radius: 3px;" class="print-bg-exact"></div>
                  </div>
                  <div style="width: 40px; text-align: right; font-size: 11px; color: var(--text2);">${tgpScans}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ ROW 3: Grade Distribution Table ═══ -->
        <div class="card mt-16">
          <div class="card-head">
            <div>
              <div class="card-title">Enrolled Students per Grade Level</div>
              <div class="card-sub">Active PGP holders broken down by grade</div>
            </div>
            <div style="color: var(--primary);">${Icons['users'](20)}</div>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Grade Level</th>
                  <th>Total Enrolled</th>
                  <th>Percentage</th>
                  <th style="width: 50%;">Distribution</th>
                </tr>
              </thead>
              <tbody>
                ${gradeRowsHtml}
                ${sortedGrades.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No students found</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ── Helper: Hourly bar chart ──────────────────────────────
  static buildHourlyBars(hourlyData, maxHourCount, hourLabels) {
    return hourlyData.map((count, i) => {
      const heightPct = maxHourCount === 0 ? 0 : (count / maxHourCount) * 100;
      const countLabel = count > 0
        ? '<div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 600; color: var(--text2);">' + count + '</div>'
        : '';
      return '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%;">'
        + '<div style="flex: 1; display: flex; align-items: flex-end; width: 100%; justify-content: center;">'
        + '<div style="width: 60%; max-width: 16px; height: ' + Math.max(heightPct, 2) + '%; background: var(--primary); border-radius: 4px 4px 0 0; transition: height 0.3s; min-height: 2px; position: relative;" class="print-bg-exact" title="' + count + ' scans">'
        + countLabel
        + '</div></div>'
        + '<div style="font-size: 9px; font-weight: 500; color: var(--text3); margin-top: 4px;">' + hourLabels[i] + '</div>'
        + '</div>';
    }).join('');
  }

  // ── Helper: Gate utilization bars ─────────────────────────
  static buildGateBars(sortedGates, totalGateLogs) {
    return sortedGates.map(([gate, count]) => {
      const pct = Math.round((count / totalGateLogs) * 100);
      return '<div style="margin-bottom: 10px;">'
        + '<div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">'
        + '<span style="font-weight: 600; color: var(--text);">' + gate + '</span>'
        + '<span style="color: var(--text2); font-weight: 500;">' + count + ' (' + pct + '%)</span>'
        + '</div>'
        + '<div style="height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">'
        + '<div style="width: ' + pct + '%; height: 100%; background: var(--accent); border-radius: 3px;" class="print-bg-exact"></div>'
        + '</div></div>';
    }).join('');
  }

  // ── Helper: Grade distribution table rows ─────────────────
  static buildGradeRows(sortedGrades, totalPasses) {
    const safeTotal = Math.max(totalPasses, 1);
    return sortedGrades.map(([g, count]) => {
      const pct = Math.round((count / safeTotal) * 100);
      return '<tr>'
        + '<td style="font-weight: 600;">' + g + '</td>'
        + '<td>' + count + ' Students</td>'
        + '<td>' + pct + '%</td>'
        + '<td><div style="width: 100%; height: 6px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden;">'
        + '<div style="width: ' + pct + '%; height: 100%; background: var(--primary-soft); border: 1px solid var(--primary); border-radius: 3px;" class="print-bg-exact"></div>'
        + '</div></td></tr>';
    }).join('');
  }
}
