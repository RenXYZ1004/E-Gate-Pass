import Dialog from '../../services/Dialog.js';
import { debounce, escapeHTML, generatePaginationHTML, bindPaginationEvents, renderPassCard, renderPassCardQR, waitForImages } from '../../utils.js';

export default class PGPController {
  static bind(controller) {
    controller.pgpPagination = { page: 1, limit: 25, query: '', status: 'all', grade: 'all', section: '' };

    // PGP Filters
    const pills = document.querySelectorAll('#pgp-filters .pill');
    const searchIn = document.getElementById('pgp-search');
    const gradeSel = document.getElementById('pgp-filter-grade');
    const sectionIn = document.getElementById('pgp-filter-section');

    const applyFilters = () => {
      const activePill = document.querySelector('#pgp-filters .pill.on');
      controller.pgpPagination.status = activePill ? activePill.dataset.filter : 'all';
      controller.pgpPagination.query = (searchIn ? searchIn.value : '').toLowerCase().trim();
      controller.pgpPagination.grade = gradeSel ? gradeSel.value : 'all';
      controller.pgpPagination.section = (sectionIn ? sectionIn.value : '').toLowerCase().trim();
      controller.pgpPagination.page = 1;
      
      const selectAllCb = document.getElementById('pgp-select-all');
      if (selectAllCb) selectAllCb.checked = false;
      
      PGPController.updatePagination(controller);
    };

    const debouncedFilter = debounce(applyFilters, 250);

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => p.classList.remove('on'));
        e.currentTarget.classList.add('on');
        applyFilters(); 
      });
    });

    if (searchIn) searchIn.addEventListener('input', debouncedFilter);
    if (gradeSel) gradeSel.addEventListener('change', applyFilters);
    if (sectionIn) sectionIn.addEventListener('input', debouncedFilter);

    // Initial render
    PGPController.updatePagination(controller);

    // Status Updates
    document.querySelectorAll('.btn-status-update').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        const confirmMsg = action === 'revoked' 
          ? 'Revoke this pass permanently?' 
          : action === 'suspended' 
            ? 'Suspend this pass temporarily?' 
            : 'Reactivate this pass?';
            
        const confirmed = await Dialog.confirm(
          'Update Pass Status',
          confirmMsg,
          { 
            confirmText: 'Yes, Update', 
            type: action === 'revoked' ? 'danger' : action === 'suspended' ? 'warning' : 'primary' 
          }
        );
            
        if (confirmed) {
          await controller.model.updateStudentStatus(id, action);
          controller.view.showToast(`Pass status updated to ${action}`);
          controller.navigateToPage('pgp'); // Refresh view
        }
      });
    });

    // --- BULK ACTIONS LOGIC ---
    const selectAllCb = document.getElementById('pgp-select-all');
    const bulkBar = document.getElementById('pgp-bulk-actions');
    const selectedCountSpan = document.getElementById('pgp-selected-count');
    const btnBulkEmail = document.getElementById('btn-bulk-email');

    controller.updateBulkActions = () => {
      const selected = Array.from(document.querySelectorAll('.pgp-row-cb:checked:not([style*="display: none"])'));
      const count = selected.length;
      if (bulkBar && selectedCountSpan) {
        if (count > 0) {
          selectedCountSpan.textContent = count;
          bulkBar.style.display = 'flex';
        } else {
          bulkBar.style.display = 'none';
        }
      }
      if (selectAllCb) {
        const visibleRows = document.querySelectorAll('#pgp-table tbody tr:not([style*="display: none"]) .pgp-row-cb');
        selectAllCb.checked = visibleRows.length > 0 && selected.length === visibleRows.length;
      }
    };

    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = document.querySelectorAll('#pgp-table tbody tr:not([style*="display: none"]) .pgp-row-cb');
        visibleRows.forEach(cb => {
          cb.checked = isChecked;
        });
        controller.updateBulkActions();
      });
    }

    // Call updateBulkActions globally when needed
    // Row cb bind happens in updatePagination now

    const btnClosePgpCard = document.getElementById('btn-close-pgp-card');
    if (btnClosePgpCard) {
      btnClosePgpCard.addEventListener('click', () => {
        document.getElementById('modal-pgp-card').style.display = 'none';
      });
    }
  }

  static bindRowActions(controller) {
    document.querySelectorAll('.btn-status-update').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        const confirmMsg = action === 'revoked' 
          ? 'Revoke this pass permanently?' 
          : action === 'suspended' 
            ? 'Suspend this pass temporarily?' 
            : 'Reactivate this pass?';
            
        const confirmed = await Dialog.confirm(
          'Update Pass Status',
          confirmMsg,
          { 
            confirmText: 'Yes, Update', 
            type: action === 'revoked' ? 'danger' : action === 'suspended' ? 'warning' : 'primary' 
          }
        );
            
        if (confirmed) {
          await controller.model.updateStudentStatus(id, action);
          controller.view.showToast(`Pass status updated to ${action}`);
          controller.navigateToPage('pgp'); // Refresh view
        }
      });
    });

    const rowCbs = document.querySelectorAll('.pgp-row-cb');
    rowCbs.forEach(cb => cb.addEventListener('change', controller.updateBulkActions));

    // --- VIEW PASS LOGIC ---
    document.querySelectorAll('.btn-view-pgp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => s.id === id);
        if (!student) return;

        const target = document.getElementById('pgp-card-render-target');
        if (!target) return;

        target.innerHTML = renderPassCard(student, {
          captureId: 'pgpcard-capture',
          qrId: 'pgpcard-qrcode',
          centered: true,
          shadow: true
        });
        renderPassCardQR('pgpcard-qrcode', student);

        document.getElementById('modal-pgp-card').style.display = 'flex';
      });
    });

    // --- EMAIL LOGIC (Single & Bulk) ---
    // The pass card is rendered off-screen, rasterised with html2canvas and
    // posted to the mail API, which shows it inline in the message body and
    // attaches it so the parent can save or print it.
    const processEmails = async (studentsToEmail) => {
      const modal = document.getElementById('modal-bulk-email');
      const statusText = document.getElementById('bulk-email-status');
      const progressBar = document.getElementById('bulk-email-progress-bar');
      const btnClose = document.getElementById('btn-close-bulk-email');

      modal.style.display = 'flex';
      btnClose.style.display = 'none';
      progressBar.style.width = '0%';

      // Both come from a CDN, so they are the first thing to go missing on a
      // bad connection. Without them the card cannot be drawn, and sending
      // anyway would deliver an email promising a gate pass it does not carry.
      const missing = [];
      if (typeof html2canvas === 'undefined') missing.push('html2canvas');
      if (typeof QRCode === 'undefined') missing.push('qrcode.js');

      if (missing.length) {
        statusText.innerHTML = '<strong>Cannot send.</strong><br>'
          + '<span style="color:#ef4444;font-size:12px;">'
          + `${missing.join(' and ')} failed to load, so the pass card cannot be `
          + 'generated. Reconnect to the internet and reload the page.</span>';
        progressBar.style.width = '100%';
        btnClose.style.display = 'block';
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      const failures = [];
      const total = studentsToEmail.length;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-10000px';
      tempContainer.style.top = '0';
      document.body.appendChild(tempContainer);

      try {
        for (let i = 0; i < total; i++) {
          const student = studentsToEmail[i];
          statusText.textContent = `Generating ID & Sending ${i + 1} of ${total}...`;
          progressBar.style.width = `${(i / total) * 100}%`;

          if (!student.parentEmail || !student.parentEmail.includes('@')) {
            console.warn('Skipping student without valid parent email:', student.name);
            skippedCount++;
            continue;
          }

          try {
            tempContainer.innerHTML = renderPassCard(student, {
              captureId: 'email-idcard-capture',
              qrId: 'email-idcard-qrcode'
            });
            renderPassCardQR('email-idcard-qrcode', student);

            const captureArea = document.getElementById('email-idcard-capture');

            // html2canvas snapshots the DOM synchronously, so the photo and the
            // QR image have to be decoded first or the card exports blank boxes.
            await waitForImages(captureArea);

            // useCORS lets photos hosted on Drive/Cloudinary be drawn without
            // tainting the canvas, which would make toDataURL() throw.
            const canvas = await html2canvas(captureArea, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            });

            // JPEG keeps the base64 payload small enough for the API body limit.
            const attachmentBase64 = canvas
              .toDataURL('image/jpeg', 0.85)
              .replace(/^data:image\/[a-z]+;base64,/, '');

            if (!attachmentBase64) {
              throw new Error('the pass card image came out empty');
            }

            const safeFileName = (student.name || 'PGP')
              .replace(/[^a-zA-Z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '') + '_GatePass.jpg';

            // Goes through AppController so a non-2xx response is treated as a
            // failure instead of being reported to the user as a success.
            await controller.sendParentEmail({
              email_type: 'pgp_delivery',
              to_name: student.parentName || 'Parent/Guardian',
              to_email: student.parentEmail,
              student_name: student.name,
              grade: student.grade + (student.section ? ' - ' + student.section : ''),
              pgp_no: student.pgp,
              attachment_base64: attachmentBase64,
              attachment_name: safeFileName
            });

            successCount++;
          } catch (err) {
            console.error('Email failed for', student.name, err);
            failures.push(`${student.name}: ${err.message || 'unknown error'}`);
            failCount++;
          }

          // Small delay to stay under the Gmail send rate limit.
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } finally {
        tempContainer.remove();
      }

      progressBar.style.width = '100%';

      const summary = [`${successCount} sent successfully.`];
      if (failCount > 0) {
        summary.push(`<span style="color:#ef4444;">${failCount} failed.</span>`);
      }
      if (skippedCount > 0) {
        summary.push(`<span style="color:#ef4444;">${skippedCount} skipped (no valid email).</span>`);
      }

      const detail = failures.length
        ? '<div style="margin-top:8px;font-size:11px;color:#ef4444;text-align:left;'
          + `max-height:120px;overflow:auto;">${failures.map(escapeHTML).join('<br>')}</div>`
        : '';

      statusText.innerHTML = `<strong>Complete!</strong><br>${summary.join(' ')}${detail}`;
      btnClose.style.display = 'block';
    };

    document.querySelectorAll('.btn-email-pgp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => s.id === id);
        if (student) {
          processEmails([student]);
        }
      });
    });

    const btnBulkEmail = document.getElementById('btn-bulk-email');
    if (btnBulkEmail) {
      // Remove existing listener to prevent duplicates on re-render
      const newBtn = btnBulkEmail.cloneNode(true);
      btnBulkEmail.parentNode.replaceChild(newBtn, btnBulkEmail);
      newBtn.addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.pgp-row-cb:checked')).map(cb => cb.dataset.id);
        const studentsToEmail = selectedIds.map(id => controller.model.students.find(s => s.id === id)).filter(s => s);
        if (studentsToEmail.length > 0) {
          processEmails(studentsToEmail);
        }
      });
    }

    const btnCloseBulkEmail = document.getElementById('btn-close-bulk-email');
    if (btnCloseBulkEmail) {
      const newBtnClose = btnCloseBulkEmail.cloneNode(true);
      btnCloseBulkEmail.parentNode.replaceChild(newBtnClose, btnCloseBulkEmail);
      newBtnClose.addEventListener('click', () => {
        document.getElementById('modal-bulk-email').style.display = 'none';
        // Uncheck all after bulk send
        const selectAllCb = document.getElementById('pgp-select-all');
        if (selectAllCb) selectAllCb.checked = false;
        document.querySelectorAll('.pgp-row-cb').forEach(cb => cb.checked = false);
        controller.updateBulkActions();
      });
    }
  }

  static updatePagination(controller) {
    let students = controller.model.students || [];
    
    // Only students with PGP
    students = students.filter(s => s.pgp);
    
    const p = controller.pgpPagination;
    
    let filtered = students.filter(s => {
      if (p.status !== 'all' && s.status !== p.status) return false;
      if (p.grade !== 'all' && s.grade !== p.grade) return false;
      if (p.section && !(s.section && s.section.toLowerCase().includes(p.section))) return false;
      if (p.query && !(
        (s.name && s.name.toLowerCase().includes(p.query)) ||
        (s.studid && s.studid.toLowerCase().includes(p.query)) ||
        (s.pgp && s.pgp.toLowerCase().includes(p.query))
      )) return false;
      return true;
    });

    const total = filtered.length;
    const maxPage = Math.ceil(total / p.limit) || 1;
    if (p.page > maxPage) p.page = maxPage;
    if (p.page < 1) p.page = 1;
    
    const start = (p.page - 1) * p.limit;
    const paginated = filtered.slice(start, start + p.limit);

    import('../../views/PGPView.js').then(module => {
      const tbody = document.querySelector('#pgp-table tbody');
      if (tbody) tbody.innerHTML = module.default.renderTableRows(paginated);
      
      // Update bulk actions visibility
      if (controller.updateBulkActions) controller.updateBulkActions();
      
      // Re-bind actions
      PGPController.bindRowActions(controller);
      
      const pgpPaginationContainer = document.getElementById('pgp-pagination');
      if (pgpPaginationContainer) {
        pgpPaginationContainer.innerHTML = generatePaginationHTML(p, total);
        bindPaginationEvents(pgpPaginationContainer, p, () => PGPController.updatePagination(controller));
      }
    });
  }
}
