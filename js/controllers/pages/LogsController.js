import Dialog from '../../services/Dialog.js';
import { debounce, generatePaginationHTML, bindPaginationEvents } from '../../utils.js';

export default class LogsController {
  static bind(controller) {
    controller.pagination = { page: 1, limit: 25, query: '', gate: 'all', grade: 'all', timeFrom: '', timeTo: '' };
    
    // Clear Logs
    const btnClear = document.getElementById('logs-btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        const confirmed = await Dialog.confirm(
          'Clear Logs',
          'Are you sure you want to clear all exit logs? This cannot be undone.',
          { confirmText: 'Yes, Clear All', type: 'danger' }
        );
        if (confirmed) {
          controller.model.clearLogs();
          controller.view.showToast('Exit logs cleared.');
          controller.navigateToPage('logs'); // Refresh
        }
      });
    }

    // Export CSV
    const btnExport = document.getElementById('logs-btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const logs = controller.model.exitLogs || [];
        if (logs.length === 0) {
          controller.view.showToast('No logs to export', 'error');
          return;
        }
        
        let csv = 'Date,Time,Student Name,Student ID,Gate,Result,Pass Type\n';
        const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
        logs.forEach(log => {
          const student = controller.model.getStudentByPassId(log.studentId) || controller.model.getStudentByStudId(log.studentId);
          const sName = student ? student.name : 'Unknown';
          const sId = student ? (student.studid || student.id) : log.studentId;
          const date = new Date(log.timestamp);
          const dateStr = date.toLocaleDateString('en-CA');
          const timeStr = date.toLocaleTimeString('en-GB');
          
          csv += `${escapeCSV(dateStr)},${escapeCSV(timeStr)},${escapeCSV(sName)},${escapeCSV(sId)},${escapeCSV(log.gate || 'Gate 1')},${escapeCSV(log.result)},${escapeCSV(log.passType || 'PGP')}\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PGP_ExitLogs_${new Date().toLocaleDateString('en-CA')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        controller.view.showToast('Logs exported successfully');
      });
    }

    // Filter Logic (Search, Gate, Grade, Time)
    const searchIn = document.getElementById('logs-search');
    const gateSel = document.getElementById('logs-filter-gate');
    const gradeSel = document.getElementById('logs-filter-grade');
    const timeFrom = document.getElementById('logs-filter-time-from');
    const timeTo = document.getElementById('logs-filter-time-to');
    
    const applyFilters = () => {
      controller.pagination.query = (searchIn ? searchIn.value : '').toLowerCase().trim();
      controller.pagination.gate = gateSel ? gateSel.value : 'all';
      controller.pagination.grade = gradeSel ? gradeSel.value : 'all';
      controller.pagination.timeFrom = timeFrom ? timeFrom.value : '';
      controller.pagination.timeTo = timeTo ? timeTo.value : '';
      controller.pagination.page = 1;
      LogsController.updatePagination(controller);
    };

    const filterLogs = debounce(applyFilters, 250);

    if (searchIn) searchIn.addEventListener('input', filterLogs);
    if (gateSel) gateSel.addEventListener('change', applyFilters);
    if (gradeSel) gradeSel.addEventListener('change', applyFilters);
    if (timeFrom) timeFrom.addEventListener('input', filterLogs);
    if (timeTo) timeTo.addEventListener('input', filterLogs);
    
    // Apply default filters on load
    applyFilters();
  }

  static updatePagination(controller) {
    let logs = controller.model.exitLogs || [];
    
    let filtered = logs.filter(log => {
      const student = controller.model.getStudentByPassId(log.studentId) || controller.model.getStudentByStudId(log.studentId);
      const sName = (student ? student.name : '').toLowerCase();
      const sGrade = student ? student.grade : '';
      const logGate = log.gate || 'Gate 1';
      
      const date = new Date(log.timestamp);
      const logTime = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      
      const p = controller.pagination;
      
      if (p.query && !sName.includes(p.query)) return false;
      if (p.gate !== 'all' && logGate !== p.gate) return false;
      if (p.grade !== 'all' && sGrade !== p.grade) return false;
      if (p.timeFrom && logTime < p.timeFrom) return false;
      if (p.timeTo && logTime > p.timeTo) return false;
      
      return true;
    });

    const total = filtered.length;
    const maxPage = Math.ceil(total / controller.pagination.limit) || 1;
    if (controller.pagination.page > maxPage) controller.pagination.page = maxPage;
    if (controller.pagination.page < 1) controller.pagination.page = 1;
    
    const start = (controller.pagination.page - 1) * controller.pagination.limit;
    const paginated = filtered.slice(start, start + controller.pagination.limit);

    import('../../views/LogsView.js').then(module => {
      const tbody = document.querySelector('#logs-table tbody');
      if (tbody) tbody.innerHTML = module.default.renderTableRows(paginated, controller.model);

      const logsPaginationContainer = document.getElementById('logs-pagination');
      if (logsPaginationContainer) {
        logsPaginationContainer.innerHTML = generatePaginationHTML(controller.pagination, total);
        bindPaginationEvents(logsPaginationContainer, controller.pagination, () => LogsController.updatePagination(controller));
      }
    });
  }
}
