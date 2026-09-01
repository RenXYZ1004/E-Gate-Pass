import { escapeHTML, compressImage, resolvePhotoUrl, hasPhoto, generatePGP, CURRENT_SCHOOL_YEAR, debounce, generateQRToken, uploadPhotoLocally, generatePaginationHTML, bindPaginationEvents, renderVirtualIdCard, renderVirtualIdCardQR, waitForImages } from '../../utils.js';
import Dialog from '../../services/Dialog.js';
import Icons from '../../icons.js';
import { setButtonLoading } from '../../views/AppView.js';

export default class StudentsController {

  // ── Inline Validation Helpers ────────────────────────────
  static showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errDiv = document.getElementById(`err-${fieldId}`);
    if (input) input.classList.add('input-error');
    if (errDiv) { errDiv.textContent = message; errDiv.classList.add('visible'); }
  }

  static clearFieldErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.form-error.visible').forEach(el => { el.textContent = ''; el.classList.remove('visible'); });
  }

  static validatePhone(value) {
    if (!value) return true; // optional
    return /^09\d{9}$/.test(value.replace(/[\s-]/g, ''));
  }

  static bind(controller) {
    controller.currentWizardStep = 1;
    controller.viewMode = controller.viewMode || 'card';
    controller.pagination = { page: 1, limit: 25, query: '', grade: 'All', status: 'active' };
    const btnAdd = document.getElementById('btn-add-student');
    const wizardModal = document.getElementById('modal-wizard');
    if (btnAdd && wizardModal) {
      btnAdd.addEventListener('click', () => {
        wizardModal.style.display = 'flex';
        controller.goToWizardStep(1);
        document.getElementById('form-enroll').reset();
        StudentsController.clearFieldErrors();
        document.getElementById('w-photo-preview').innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      });
    }
    const btnClose = document.getElementById('btn-close-wizard');
    if (btnClose && wizardModal) {
      btnClose.addEventListener('click', () => { wizardModal.style.display = 'none'; });
    }

    // Close any modal when clicking outside of it (on the overlay)
    document.querySelectorAll('.overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    const btnNext = document.getElementById('btn-wizard-next');
    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnSubmit = document.getElementById('btn-wizard-submit');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        StudentsController.clearFieldErrors();

        if (controller.currentWizardStep === 1) {
          const nameVal = document.getElementById('w-name').value.trim();
          const studidVal = document.getElementById('w-studid').value.trim();
          let hasError = false;
          if (!nameVal) {
            StudentsController.showFieldError('w-name', 'Full Name is required');
            hasError = true;
          }
          if (!studidVal) {
            StudentsController.showFieldError('w-studid', 'Student ID is required');
            hasError = true;
          }
          if (hasError) { controller.view.showToast('Please fill out the required fields', 'error'); return; }
          // Duplicate Student ID check
          const duplicate = (controller.model.students || []).find(s => s.studid === studidVal);
          if (duplicate) {
            StudentsController.showFieldError('w-studid', `ID "${studidVal}" already exists (${duplicate.name})`);
            controller.view.showToast(`Student ID "${studidVal}" already exists`, 'error'); return;
          }
        } else if (controller.currentWizardStep === 2) {
          let hasError = false;
          if (!document.getElementById('w-grade').value) {
            StudentsController.showFieldError('w-grade', 'Please select a grade level');
            hasError = true;
          }
          if (!document.getElementById('w-gate').value) {
            StudentsController.showFieldError('w-gate', 'Preferred Gate is required');
            hasError = true;
          }
          if (!document.getElementById('w-arrangements').value) {
            StudentsController.showFieldError('w-arrangements', 'Arrangement is required');
            hasError = true;
          }
          if (hasError) { controller.view.showToast('Please fill out the required academic fields', 'error'); return; }
        } else if (controller.currentWizardStep === 3) {
          const parentName = document.getElementById('w-parent-name').value.trim();
          const parentEmail = document.getElementById('w-parent-email').value.trim();
          const parentPhone = document.getElementById('w-parent-phone').value.trim();
          let hasError = false;
          if (!parentName) {
            StudentsController.showFieldError('w-parent-name', 'Guardian Name is required');
            hasError = true;
          }
          if (!parentEmail) {
            StudentsController.showFieldError('w-parent-email', 'Guardian Email is required');
            hasError = true;
          }
          if (hasError) { controller.view.showToast('Please fill out the required fields', 'error'); return; }
          // Email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(parentEmail)) {
            StudentsController.showFieldError('w-parent-email', 'Please enter a valid email address');
            controller.view.showToast('Please enter a valid email address', 'error'); return;
          }
          // Phone validation (optional but must be valid PH format if provided)
          if (parentPhone && !StudentsController.validatePhone(parentPhone)) {
            StudentsController.showFieldError('w-parent-phone', 'Enter a valid PH mobile number (09XX XXX XXXX)');
            controller.view.showToast('Invalid phone number format', 'error'); return;
          }
          document.getElementById('r-name').textContent = document.getElementById('w-name').value;
          document.getElementById('r-studid').textContent = document.getElementById('w-studid').value;
          document.getElementById('r-grade').textContent = document.getElementById('w-grade').value;
          document.getElementById('r-gate').textContent = document.getElementById('w-gate').value || 'Any';
          document.getElementById('r-arrangements').textContent = document.getElementById('w-arrangements').value || 'None specified';
          document.getElementById('r-vehicle').textContent = document.getElementById('w-vehicle').value || 'None';
          document.getElementById('r-guardian').textContent = document.getElementById('w-parent-name').value;
          document.getElementById('r-email').textContent = document.getElementById('w-parent-email').value;
        }
        if (controller.currentWizardStep < 4) {
          controller.goToWizardStep(controller.currentWizardStep + 1);
        }
      });
    }
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (controller.currentWizardStep > 1) controller.goToWizardStep(controller.currentWizardStep - 1);
      });
    }
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => { await controller.handleEnrollment(); });
    }
    const photoInput = document.getElementById('w-photo-file');
    if (photoInput) {
      photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const compressedDataUrl = await compressImage(file, 250, 250, 0.7);
            document.getElementById('w-photo-preview').innerHTML = `<img src="${compressedDataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
            controller.tempPhotoData = compressedDataUrl;
          } catch (err) {
            console.error('Failed to compress image:', err);
            controller.view.showToast('Failed to process image.', 'error');
          }
        }
      });
    }
    // ── Bind Action Buttons ─────────────────────────────────
    StudentsController.bindRowActionsOnly(controller);

    const editPhotoInput = document.getElementById('edit-photo-file');
    if (editPhotoInput) {
      editPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const compressedDataUrl = await compressImage(file, 250, 250, 0.7);
            document.getElementById('edit-photo-preview').innerHTML = `<img src="${compressedDataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
            controller.editPhotoData = compressedDataUrl;
          } catch (err) {
            console.error('Failed to compress image:', err);
            controller.view.showToast('Failed to process image.', 'error');
          }
        }
      });
    }

    const btnSaveEdit = document.getElementById('btn-save-edit');
    const editModal = document.getElementById('modal-edit-student');
    const btnCloseEdit = document.getElementById('btn-close-edit');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    const getEditFormState = () => {
      return {
        name: document.getElementById('edit-name').value.trim(),
        studid: document.getElementById('edit-studid').value.trim(),
        grade: document.getElementById('edit-grade').value,
        section: document.getElementById('edit-section').value.trim(),
        status: document.getElementById('edit-status').value,
        schoolYear: document.getElementById('edit-schoolyear').value.trim(),
        gate: document.getElementById('edit-gate').value,
        arrangements: document.getElementById('edit-arrangements').value,
        vehicle: document.getElementById('edit-vehicle').value,
        parentName: document.getElementById('edit-parent-name').value.trim(),
        parentEmail: document.getElementById('edit-parent-email').value.trim(),
        parentPhone: document.getElementById('edit-parent-phone').value.trim(),
        address: document.getElementById('edit-address').value.trim(),
        photo: controller.editPhotoData || null
      };
    };

    const handleEditClose = async (e) => {
      if (e) e.preventDefault();
      const currentState = JSON.stringify(getEditFormState());
      if (controller._editSnapshot && currentState !== controller._editSnapshot) {
        const confirm = await Dialog.confirm('Discard Changes?', 'You have unsaved changes. Are you sure you want to discard them?', { type: 'warning', confirmText: 'Discard', cancelText: 'Keep Editing' });
        if (!confirm) return;
      }
      editModal.style.display = 'none';
      controller._editSnapshot = null;
    };

    if (btnCloseEdit && editModal) btnCloseEdit.addEventListener('click', handleEditClose);
    if (btnCancelEdit && editModal) btnCancelEdit.addEventListener('click', handleEditClose);

    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', async () => {
        StudentsController.clearFieldErrors();
        const id = document.getElementById('edit-id').value;
        const name = document.getElementById('edit-name').value.trim();
        const studid = document.getElementById('edit-studid').value.trim();
        const grade = document.getElementById('edit-grade').value;
        const parentEmail = document.getElementById('edit-parent-email').value.trim();
        const parentPhone = document.getElementById('edit-parent-phone').value.trim();

        const gate = document.getElementById('edit-gate').value;
        const arrangements = document.getElementById('edit-arrangements').value;

        let hasError = false;
        if (!name) { StudentsController.showFieldError('edit-name', 'Full Name is required'); hasError = true; }
        if (!studid) { StudentsController.showFieldError('edit-studid', 'Student ID is required'); hasError = true; }
        if (!grade) { StudentsController.showFieldError('edit-grade', 'Grade Level is required'); hasError = true; }
        if (!gate) { StudentsController.showFieldError('edit-gate', 'Preferred Gate is required'); hasError = true; }
        if (!arrangements) { StudentsController.showFieldError('edit-arrangements', 'Arrangement is required'); hasError = true; }
        if (hasError) { controller.view.showToast('Please fill out all required fields', 'error'); return; }

        // Email validation (if provided)
        if (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
          StudentsController.showFieldError('edit-parent-email', 'Please enter a valid email address');
          controller.view.showToast('Please enter a valid email address', 'error'); return;
        }
        // Phone validation (if provided)
        if (parentPhone && !StudentsController.validatePhone(parentPhone)) {
          StudentsController.showFieldError('edit-parent-phone', 'Enter a valid PH mobile number (09XX XXX XXXX)');
          controller.view.showToast('Invalid phone number format', 'error'); return;
        }

        const student = controller.model.students.find(s => String(s.id) === String(id));
        const section = document.getElementById('edit-section').value.trim();
        const newFullSection = section ? `${grade} - ${section}` : grade;

        const updatedStudent = {
          id,
          name,
          studid,
          grade,
          section,
          fullSection: newFullSection,
          schoolYear: document.getElementById('edit-schoolyear').value.trim(),
          status: document.getElementById('edit-status').value,
          preferredGate: gate,
          arrangements: arrangements,
          vehicleDetails: document.getElementById('edit-vehicle').value,
          parentName: document.getElementById('edit-parent-name').value.trim(),
          parentEmail,
          phone: parentPhone,
          address: document.getElementById('edit-address').value.trim()
        };

        if (controller.editPhotoData) {
          updatedStudent.photo = controller.editPhotoData;
        }

        setButtonLoading(btnSaveEdit, true, `${Icons['check-circle'](14)} Save Changes`);

        try {
          await controller.model.updateStudent(updatedStudent);
          controller.view.showToast('Student details updated successfully');
          editModal.style.display = 'none';
          controller.navigateToPage('students');
        } finally {
          setButtonLoading(btnSaveEdit, false);
        }
      });
    }

    // ── Pagination Engine ────────────────────────────────────
    document.querySelectorAll('.grade-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.grade-pill').forEach(p => {
          p.classList.remove('active');
          p.style.fontWeight = '500';
          p.style.border = '1px solid var(--border)';
          p.style.background = 'var(--bg-card)';
          p.style.color = 'var(--text2)';
        });
        pill.classList.add('active');
        pill.style.fontWeight = '700';
        pill.style.border = '1px solid var(--primary)';
        pill.style.background = 'var(--primary-soft)';
        pill.style.color = 'var(--primary)';

        controller.pagination.grade = pill.dataset.grade;
        controller.pagination.page = 1; // Reset to page 1 on filter
        StudentsController.updatePagination(controller);
      });
    });

    const gradeSelectMobile = document.getElementById('grade-select-mobile');
    if (gradeSelectMobile) {
      gradeSelectMobile.addEventListener('change', () => {
        controller.pagination.grade = gradeSelectMobile.value;
        controller.pagination.page = 1;
        StudentsController.updatePagination(controller);
      });
    }

    document.querySelectorAll('.student-status-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.student-status-tab').forEach(t => {
          t.classList.remove('active');
          t.style.background = 'transparent';
          t.style.color = 'var(--text3)';
          t.style.border = '1px solid transparent';
          t.style.fontWeight = '500';
        });
        tab.classList.add('active');
        tab.style.background = 'var(--bg-card)';
        tab.style.color = 'var(--primary)';
        tab.style.border = '1px solid var(--border)';
        tab.style.borderBottom = 'none';
        tab.style.fontWeight = '600';

        controller.pagination.status = tab.dataset.status;
        controller.pagination.page = 1; // Reset to page 1 on filter
        StudentsController.updatePagination(controller);
      });
    });

    const searchIn = document.getElementById('students-search');
    if (searchIn) {
      const handleSearch = debounce(() => {
        controller.pagination.query = searchIn.value.toLowerCase().trim();
        controller.pagination.page = 1; // Reset on search
        StudentsController.updatePagination(controller);
      }, 250);
      searchIn.addEventListener('input', handleSearch);
    }

    StudentsController.bindBulkPhotos(controller);
    StudentsController.bindCSVImport(controller);
    StudentsController.bindIdCard(controller);
    StudentsController.bindExportAll(controller);
    StudentsController.bindViewToggles(controller);

    // KPI card shortcut to For Approval tab
    const kpiApproval = document.getElementById('kpi-for-approval');
    if (kpiApproval) kpiApproval.addEventListener('click', () => {
      const tab = document.querySelector('.student-status-tab[data-status="for approval"]');
      if (tab) tab.click();
    });

    // Initial Render
    StudentsController.updatePagination(controller);
  }

  static updatePagination(controller) {
    if (!controller.model.students) return;

    const tableContainer = document.getElementById('students-table-container');
    const gridContainer = document.getElementById('students-grid-container');
    const approvalPanel = document.getElementById('for-approval-panel');
    const filterBar = document.getElementById('students-filter-bar');
    const paginationBar = document.getElementById('students-pagination');

    if (controller.pagination.status === 'for approval') {
      // Show master-detail panel, hide table/grid/filter
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (approvalPanel) approvalPanel.style.display = 'block';
      if (filterBar) filterBar.style.display = 'none';
      if (paginationBar) paginationBar.innerHTML = '';

      const applicants = controller.model.students.filter(s => s.status === 'for approval');
      import('../../views/StudentsView.js').then(module => {
        const list = document.getElementById('approval-list');
        if (list) list.innerHTML = module.default.renderForApprovalList(applicants);
        StudentsController.bindApprovalPanel(controller, applicants);
      });
      return;
    }

    // Restore normal view
    if (approvalPanel) approvalPanel.style.display = 'none';
    if (filterBar) filterBar.style.display = '';
    if (tableContainer) tableContainer.style.display = controller.viewMode === 'table' ? '' : 'none';
    if (gridContainer) gridContainer.style.display = controller.viewMode === 'card' ? 'block' : 'none';

    let filtered = controller.model.students.filter(s => s.status === controller.pagination.status);

    if (controller.pagination.grade !== 'All') {
      filtered = filtered.filter(s => s.grade === controller.pagination.grade);
    }

    if (controller.pagination.query) {
      const q = controller.pagination.query;
      filtered = filtered.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.studid && String(s.studid).toLowerCase().includes(q)) ||
        (s.pgp && String(s.pgp).toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const maxPage = Math.ceil(total / controller.pagination.limit) || 1;
    if (controller.pagination.page > maxPage) controller.pagination.page = maxPage;
    if (controller.pagination.page < 1) controller.pagination.page = 1;

    const start = (controller.pagination.page - 1) * controller.pagination.limit;
    const paginated = filtered.slice(start, start + controller.pagination.limit);

    const tbody = document.querySelector('#students-table tbody');
    const grid = document.getElementById('students-grid');

    import('../../views/StudentsView.js').then(module => {
      if (tbody) tbody.innerHTML = module.default.renderTableRows(paginated, controller.model);
      if (grid) grid.innerHTML = module.default.renderCardView(paginated, controller.model);

      StudentsController.bindRowActionsOnly(controller);
      StudentsController.bindIdCard(controller);

      if (paginationBar) {
        paginationBar.innerHTML = generatePaginationHTML(controller.pagination, total);
        bindPaginationEvents(paginationBar, controller.pagination, () => StudentsController.updatePagination(controller));
      }
    });
  }

  static bindApprovalPanel(controller, applicants) {
    const detailEl = document.getElementById('approval-detail');

    const showDetail = (student) => {
      // Highlight selected item
      document.querySelectorAll('.approval-list-item').forEach(el => {
        const selected = el.dataset.id === student.id;
        el.style.background = selected ? 'var(--primary-soft)' : '';
        el.style.borderLeft = selected ? '3px solid var(--primary)' : '3px solid transparent';
      });

      if (!detailEl) return;

      // Compute PassID preview using existing students as context
      const yy = (student.schoolYear || '').split('-')[0].slice(-2) || CURRENT_SCHOOL_YEAR;
      // Exclude this applicant's own (possibly malformed) id from the NNN scan
      const othersForScan = controller.model.students.filter(s => s.id !== student.id);
      let passIdPreview;
      try {
        passIdPreview = generatePGP(student.grade, student.section, othersForScan, yy);
      } catch (_) {
        passIdPreview = student.id || '—';
      }

      import('../../views/StudentsView.js').then(module => {
        const isGuard = controller.model.currentUser?.role === 'guard';
        detailEl.innerHTML = module.default.renderApprovalDetail(student, passIdPreview, isGuard);
        StudentsController.bindRowActionsOnly(controller);
      });
    };

    document.querySelectorAll('.approval-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const student = applicants.find(s => s.id === el.dataset.id);
        if (student) showDetail(student);
      });
    });

    // Auto-select first applicant
    if (applicants.length > 0) showDetail(applicants[0]);
  }

  static bindViewToggles(controller) {
    const btnTable = document.getElementById('view-toggle-table');
    const btnCard = document.getElementById('view-toggle-card');
    const tableContainer = document.getElementById('students-table-container');
    const gridContainer = document.getElementById('students-grid-container');

    const updateView = () => {
      if (controller.viewMode === 'table') {
        if (btnTable) {
          btnTable.classList.add('active');
          btnTable.style.background = 'var(--primary-soft)';
          btnTable.style.color = 'var(--primary)';
        }
        if (btnCard) {
          btnCard.classList.remove('active');
          btnCard.style.background = 'transparent';
          btnCard.style.color = 'var(--text3)';
        }
        if (tableContainer) tableContainer.style.display = '';
        if (gridContainer) gridContainer.style.display = 'none';
      } else {
        if (btnCard) {
          btnCard.classList.add('active');
          btnCard.style.background = 'var(--primary-soft)';
          btnCard.style.color = 'var(--primary)';
        }
        if (btnTable) {
          btnTable.classList.remove('active');
          btnTable.style.background = 'transparent';
          btnTable.style.color = 'var(--text3)';
        }
        if (tableContainer) tableContainer.style.display = 'none';
        if (gridContainer) gridContainer.style.display = 'block';
      }
    };

    if (btnTable) {
      btnTable.addEventListener('click', () => {
        controller.viewMode = 'table';
        updateView();
      });
    }

    if (btnCard) {
      btnCard.addEventListener('click', () => {
        controller.viewMode = 'card';
        updateView();
      });
    }

    updateView(); // Apply initial state
  }

  static bindRowActionsOnly(controller) {
    // Approve "for approval" student — generates QRToken and sets status to active
    document.querySelectorAll('.btn-approve-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        if (!student) return;
        const confirmed = await Dialog.confirm(
          'Approve Application',
          `Approve ${student.name}'s application? This will activate their permanent gate pass.`,
          { confirmText: 'Approve & Activate', type: 'primary' }
        );
        if (confirmed) await controller.approveStudent(id);
      });
    });

    // Reject "for approval" student — archives the record
    document.querySelectorAll('.btn-reject-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        if (!student) return;
        const confirmed = await Dialog.confirm(
          'Reject Application',
          `Reject ${student.name}'s application? Their record will be archived.`,
          { confirmText: 'Yes, Reject', type: 'danger' }
        );
        if (confirmed) {
          await controller.model.updateStudentStatus(id, 'archived');
          controller.view.showToast(`${student.name}'s application rejected.`, 'error');
          controller.navigateToPage('students');
        }
      });
    });

    document.querySelectorAll('.btn-archive-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        if (!student) return;
        const confirmed = await Dialog.confirm(
          'Archive Student',
          `Archive "${student.name}"? Their PGP will be deactivated.`,
          { confirmText: 'Yes, Archive', type: 'danger' }
        );
        if (confirmed) {
          await controller.model.updateStudentStatus(id, 'archived');
          controller.view.showToast(`${student.name} has been archived`);
          controller.navigateToPage('students');
        }
      });
    });

    document.querySelectorAll('.btn-restore-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        if (!student) return;
        const confirmed = await Dialog.confirm(
          'Restore Student',
          `Restore "${student.name}" and reactivate their PGP?`,
          { confirmText: 'Yes, Restore', type: 'primary' }
        );
        if (confirmed) {
          await controller.model.updateStudentStatus(id, 'active');
          controller.view.showToast(`${student.name} has been restored`);
          controller.navigateToPage('students');
        }
      });
    });

    document.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        const editModal = document.getElementById('modal-edit-student');
        if (!student || !editModal) return;

        document.getElementById('edit-id').value = student.id;
        document.getElementById('edit-name').value = student.name || '';
        document.getElementById('edit-studid').value = student.studid || '';
        document.getElementById('edit-passid').value = student.pgp || student.id || '';
        document.getElementById('edit-status').value = student.status || 'active';
        document.getElementById('edit-grade').value = student.grade || '';
        document.getElementById('edit-section').value = student.section || '';
        document.getElementById('edit-schoolyear').value = student.schoolYear || '';
        document.getElementById('edit-gate').value = student.preferredGate || '';
        document.getElementById('edit-arrangements').value = student.arrangements || '';
        document.getElementById('edit-vehicle').value = student.vehicleDetails || '';
        document.getElementById('edit-parent-name').value = student.parentName || '';
        document.getElementById('edit-parent-email').value = student.parentEmail || '';
        document.getElementById('edit-parent-phone').value = student.phone || '';
        document.getElementById('edit-address').value = student.address || '';

        controller.editPhotoData = null;
        document.getElementById('edit-photo-file').value = '';
        document.getElementById('edit-photo-preview').innerHTML = hasPhoto(student.photo) 
          ? `<img src="${escapeHTML(resolvePhotoUrl(student.photo))}" style="width:100%;height:100%;object-fit:cover;">`
          : Icons['camera'](20);

        // Snapshot state for unsaved changes detection
        controller._editSnapshot = JSON.stringify({
          name: document.getElementById('edit-name').value.trim(),
          studid: document.getElementById('edit-studid').value.trim(),
          grade: document.getElementById('edit-grade').value,
          section: document.getElementById('edit-section').value.trim(),
          status: document.getElementById('edit-status').value,
          schoolYear: document.getElementById('edit-schoolyear').value.trim(),
          gate: document.getElementById('edit-gate').value,
          arrangements: document.getElementById('edit-arrangements').value,
          vehicle: document.getElementById('edit-vehicle').value,
          parentName: document.getElementById('edit-parent-name').value.trim(),
          parentEmail: document.getElementById('edit-parent-email').value.trim(),
          parentPhone: document.getElementById('edit-parent-phone').value.trim(),
          address: document.getElementById('edit-address').value.trim(),
          photo: controller.editPhotoData || null
        });

        editModal.style.display = 'flex';
      });
    });
  }

  static bindIdCard(controller) {
    const modalId = document.getElementById('modal-idcard');
    const btnCloseId = document.getElementById('btn-close-idcard');
    if (btnCloseId && modalId) btnCloseId.addEventListener('click', () => modalId.style.display = 'none');
    document.querySelectorAll('.btn-view-id').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const student = controller.model.students.find(s => String(s.id) === String(id));
        if (!student) return;
        const target = document.getElementById('idcard-render-target');
        
        target.innerHTML = renderVirtualIdCard(student, { captureId: 'idcard-capture', qrId: 'idcard-qrcode' });
        renderVirtualIdCardQR('idcard-qrcode', student);
        modalId.style.display = 'flex';
      });
    });
    const btnDownload = document.getElementById('btn-download-id');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        const captureArea = document.getElementById('idcard-capture');
        if (!captureArea) return;
        btnDownload.innerHTML = 'Generating...';
        btnDownload.disabled = true;
        // Strip box-shadow before capture to avoid ugly outline in exported image
        const origShadow = captureArea.style.boxShadow;
        captureArea.style.boxShadow = 'none';
        html2canvas(captureArea, { scale: 3, backgroundColor: null }).then(canvas => {
          captureArea.style.boxShadow = origShadow;
          const a = document.createElement('a');
          a.href = canvas.toDataURL("image/png");
          const rawName = captureArea.dataset.name || `PGP_Card_${Date.now()}`;
          const safeName = rawName.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().replace(/\s+/g, '_');
          a.download = `${safeName}.png`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          btnDownload.innerHTML = `${Icons['download'](14)} Download Image`;
          btnDownload.disabled = false;
        }).catch(err => {
          captureArea.style.boxShadow = origShadow;
          console.error('Failed to generate ID card image:', err);
          btnDownload.innerHTML = `${Icons['download'](14)} Download Image`;
          btnDownload.disabled = false;
        });
      });
    }
  }

  static bindExportAll(controller) {
    const btnExport = document.getElementById('btn-export-ids');
    if (!btnExport) return;

    btnExport.addEventListener('click', async () => {
      const activeStudents = controller.model.students.filter(s => s.status === 'active');
      if (activeStudents.length === 0) {
        controller.view.showToast('No active students to export.', 'error');
        return;
      }

      if (!window.JSZip) {
        controller.view.showToast('ZIP library not loaded. Please wait or reload the page.', 'error');
        return;
      }

      const confirmed = await Dialog.confirm(
        'Export All IDs',
        `This will generate and download a ZIP file containing the ID cards for all ${activeStudents.length} active students. This process may take a minute. Continue?`,
        { confirmText: 'Yes, Export All', type: 'primary' }
      );
      if (!confirmed) return;

      btnExport.innerHTML = 'Generating...';
      btnExport.disabled = true;

      try {
        const zip = new JSZip();
        
        // Temporary off-screen container for rendering
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        document.body.appendChild(tempContainer);

        let processed = 0;
        
        for (const student of activeStudents) {
          // One shared card design for the modal, the email and this export.
          tempContainer.innerHTML = renderVirtualIdCard(student, {
            captureId: 'temp-idcard-capture',
            qrId: 'temp-idcard-qrcode'
          });
          renderVirtualIdCardQR('temp-idcard-qrcode', student);

          // html2canvas snapshots synchronously — let the photo and QR decode first.
          await waitForImages(document.getElementById('temp-idcard-capture'));

          const captureArea = document.getElementById('temp-idcard-capture');
          // Strip box-shadow for clean export
          captureArea.style.boxShadow = 'none';
          const canvas = await html2canvas(captureArea, { scale: 3, logging: false, backgroundColor: null });
          const base64Data = canvas.toDataURL("image/png").replace(/^data:image\/(png|jpg);base64,/, "");
          
          const safeName = (student.name || `PGP_Card_${student.pgp}`).replace(/[^a-zA-Z0-9 \-_]/g, '').trim().replace(/\s+/g, '_');
          zip.file(`${safeName}.png`, base64Data, {base64: true});
          
          processed++;
          btnExport.innerHTML = `Generating... ${processed}/${activeStudents.length}`;
        }

        document.body.removeChild(tempContainer);
        btnExport.innerHTML = 'Zipping files...';
        
        const content = await zip.generateAsync({type:"blob"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = `PGP_IDs_${Date.now()}.zip`;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
        
        controller.view.showToast('IDs exported successfully!', 'success');
        
      } catch (err) {
        console.error('Export failed:', err);
        controller.view.showToast('Failed to export IDs.', 'error');
      }

      btnExport.innerHTML = `${Icons['download'](14)} Export All IDs`;
      btnExport.disabled = false;
    });
  }

  static bindBulkPhotos(controller) {
    const btnOpen = document.getElementById('btn-bulk-photos');
    const modal = document.getElementById('modal-bulk-photos');
    const btnClose = document.getElementById('btn-close-bulk-photos');
    const btnStart = document.getElementById('btn-start-bulk-upload');
    const fileInput = document.getElementById('bulk-photo-input');
    const progressDiv = document.getElementById('bulk-photo-progress');
    const statusText = document.getElementById('bulk-photo-status');
    const bar = document.getElementById('bulk-photo-bar');
    const log = document.getElementById('bulk-photo-log');

    if (btnOpen && modal) btnOpen.addEventListener('click', () => {
      modal.style.display = 'flex';
      progressDiv.style.display = 'none';
      if (fileInput) fileInput.value = '';
      if (log) log.innerHTML = '';
      if (btnStart) btnStart.disabled = false;
    });

    if (btnClose && modal) btnClose.addEventListener('click', () => modal.style.display = 'none');

    if (btnStart) {
      btnStart.addEventListener('click', async () => {
        if (!fileInput || !fileInput.files.length) {
          controller.view.showToast('Please select at least one photo', 'error');
          return;
        }

        const files = Array.from(fileInput.files);
        progressDiv.style.display = 'block';
        btnStart.disabled = true;
        log.innerHTML = '';
        
        const addLog = (msg, color = '#10b981') => {
          log.innerHTML += `<div style="color:${color}; margin-bottom:2px;">${msg}</div>`;
          log.scrollTop = log.scrollHeight;
        };
        
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          statusText.textContent = `Processing ${i + 1} / ${files.length}`;
          bar.style.width = `${((i + 1) / files.length) * 100}%`;

          // Filename without extension
          const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const normName = normalize(rawName);

          const student = controller.model.students.find(s => normalize(s.name) === normName);
          
          if (!student) {
            addLog(`[SKIP] No match for "${file.name}"`, '#ef4444');
            failCount++;
            continue;
          }

          try {
            // Needs compressImage which is globally accessible if imported, wait compressImage is in utils.js!
            // Wait, we can assume compressImage and uploadPhotoLocally are available because this file uses them.
            const b64 = await compressImage(file, 250, 250, 0.7);
            const savedPath = await uploadPhotoLocally(student.pgp, b64);
            
            if (savedPath) {
              student.photo = savedPath;
              await controller.model.updateStudent(student);
              addLog(`[OK] Uploaded photo for ${student.name}`);
              successCount++;
            } else {
              addLog(`[FAIL] Upload rejected for ${student.name}`, '#ef4444');
              failCount++;
            }
          } catch (err) {
            addLog(`[ERROR] ${student.name}: ${err.message}`, '#ef4444');
            failCount++;
          }
        }
        
        statusText.textContent = `Complete! ${successCount} uploaded, ${failCount} failed.`;
        controller.view.showToast(`Bulk upload finished: ${successCount} saved.`);
        
        // Refresh view
        StudentsController.updatePagination(controller);
      });
    }
  }

  static bindCSVImport(controller) {
    const btnImport = document.getElementById('btn-import-csv');
    const modal = document.getElementById('modal-csv-import');
    const btnClose = document.getElementById('btn-close-csv');
    const btnCancel = document.getElementById('btn-cancel-csv');
    const btnSubmit = document.getElementById('btn-submit-csv');
    const fileInput = document.getElementById('csv-file-input');
    const previewArea = document.getElementById('csv-preview');

    if (btnImport && modal) btnImport.addEventListener('click', () => {
      modal.style.display = 'flex';
      if (previewArea) previewArea.innerHTML = '';
      if (fileInput) fileInput.value = '';
    });
    if (btnClose && modal) btnClose.addEventListener('click', () => modal.style.display = 'none');
    if (btnCancel && modal) btnCancel.addEventListener('click', (e) => { e.preventDefault(); modal.style.display = 'none'; });

    // CSV Preview on file select
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target.result;
          const rows = StudentsController.parseCSV(text);
          if (rows.length <= 1) {
            previewArea.innerHTML = '<div style="color:var(--red);padding:12px;">CSV file is empty or has no data rows.</div>';
            return;
          }
          const headers = rows[0];
          const dataRows = rows.slice(1);
          // Validate required headers
          const requiredHeaders = ['name', 'studid', 'grade'];
          const lowerHeaders = headers.map(h => h.toLowerCase().trim());
          const missing = requiredHeaders.filter(h => !lowerHeaders.includes(h));
          if (missing.length > 0) {
            previewArea.innerHTML = `<div style="color:var(--red);padding:12px;">Missing required columns: <strong>${missing.join(', ')}</strong></div>`;
            return;
          }

          previewArea.innerHTML = `
            <div style="color:var(--green);padding:8px 12px;font-size:12px;font-weight:600;background:var(--green-s);border-radius:var(--radius-sm);margin-bottom:8px;">
              ✓ ${dataRows.length} student(s) found. Preview below:
            </div>
            <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);">
              <table style="width:100%;font-size:11px;">
                <thead><tr>${headers.map(h => `<th style="padding:6px 8px;text-align:left;background:var(--bg-elevated);">${h}</th>`).join('')}</tr></thead>
                <tbody>${dataRows.slice(0, 10).map(row => `<tr>${row.map(cell => `<td style="padding:4px 8px;border-top:1px solid var(--border);">${cell}</td>`).join('')}</tr>`).join('')}
                ${dataRows.length > 10 ? `<tr><td colspan="${headers.length}" style="padding:6px 8px;text-align:center;color:var(--text3);font-style:italic;">...and ${dataRows.length - 10} more</td></tr>` : ''}
                </tbody>
              </table>
            </div>`;
        };
        reader.readAsText(file);
      });
    }

    // Submit CSV
    if (btnSubmit) {
      btnSubmit.addEventListener('click', async () => {
        if (!fileInput || !fileInput.files[0]) {
          controller.view.showToast('Please select a CSV file first', 'error');
          return;
        }
        const file = fileInput.files[0];
        const text = await file.text();
        const rows = StudentsController.parseCSV(text);
        if (rows.length <= 1) {
          controller.view.showToast('CSV file has no data rows', 'error');
          return;
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);

        const nameIdx = headers.indexOf('name');
        const studidIdx = headers.indexOf('studid');
        const gradeIdx = headers.indexOf('grade');
        const sectionIdx = headers.indexOf('section');
        const parentNameIdx = headers.indexOf('parentname');
        const parentEmailIdx = headers.indexOf('parentemail');
        const phoneIdx = headers.indexOf('phone');
        const gateIdx = headers.indexOf('preferredgate');
        const arrangementsIdx = headers.indexOf('arrangements');
        const vehicleIdx = headers.indexOf('vehicledetails');
        const schoolYearIdx = headers.indexOf('schoolyear');

        let imported = 0;
        let skipped = 0;
        const totalRows = dataRows.length;
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `Importing... 0%`;

        let currentIndex = 0;
        for (const row of dataRows) {
          currentIndex++;
          const name = row[nameIdx]?.trim();
          const studid = row[studidIdx]?.trim();
          const grade = row[gradeIdx]?.trim();

          const gate = gateIdx >= 0 ? (row[gateIdx]?.trim() || '') : '';
          const arrangements = arrangementsIdx >= 0 ? (row[arrangementsIdx]?.trim() || '') : '';

          if (!name || !studid || !grade || !gate || !arrangements) { skipped++; continue; }

          // Check duplicate
          const exists = controller.model.students.find(s => s.studid === studid);
          if (exists) { skipped++; continue; }

          const section = sectionIdx >= 0 ? (row[sectionIdx]?.trim() || '') : '';

          // Generate unique PGP ID: format {YY}{S}{GG}-{NNN}
          const pgpId = generatePGP(grade, section, controller.model.students);

          const newStudent = {
            id: pgpId,
            name,
            studid,
            grade,
            section,
            fullSection: section ? `${grade} - ${section}` : grade,
            schoolYear: schoolYearIdx >= 0 ? (row[schoolYearIdx]?.trim() || '') : '',
            preferredGate: gate,
            arrangements: arrangements,
            vehicleDetails: vehicleIdx >= 0 ? (row[vehicleIdx]?.trim() || '') : '',
            parentName: parentNameIdx >= 0 ? (row[parentNameIdx]?.trim() || '') : '',
            parentEmail: parentEmailIdx >= 0 ? (row[parentEmailIdx]?.trim() || '') : '',
            phone: phoneIdx >= 0 ? (row[phoneIdx]?.trim() || '') : '',
            photo: '',
            pgp: pgpId,
            status: 'active',
            qrToken: generateQRToken()
          };
          await controller.model.addStudent(newStudent);
          // Add a short delay to prevent Google Apps Script rate limits on bulk upload
          await new Promise(resolve => setTimeout(resolve, 500));
          imported++;
          
          const percent = Math.round((currentIndex / totalRows) * 100);
          btnSubmit.innerHTML = `Importing... ${percent}%`;
        }

        modal.style.display = 'none';
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `${Icons['upload'](14)} Import Students`;
        controller.view.showToast(`Imported ${imported} student(s). ${skipped > 0 ? `${skipped} skipped (duplicate or incomplete).` : ''}`);
        controller.navigateToPage('students');
      });
    }
  }

  static parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    return lines.map(line => {
      const result = [];
      let inQuotes = false;
      let current = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
      }
      result.push(current);
      return result;
    });
  }
}
