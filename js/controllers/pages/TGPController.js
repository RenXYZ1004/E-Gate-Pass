import { resolvePhotoUrl, hasPhoto, escapeHTML, generatePaginationHTML, bindPaginationEvents, generateQRToken, waitForImages } from '../../utils.js';
import Dialog from '../../services/Dialog.js';
import { setButtonLoading } from '../../views/AppView.js';

export default class TGPController {
  static bind(controller) {
    const modal = document.getElementById('modal-tgp');
    const btnAdd = document.getElementById('btn-add-tgp');
    const btnClose = document.getElementById('btn-close-tgp');
    const btnCancel = document.getElementById('btn-cancel-tgp');
    const form = document.getElementById('form-tgp');

    if (btnAdd && modal) btnAdd.addEventListener('click', () => modal.style.display = 'flex');
    if (btnClose && modal) btnClose.addEventListener('click', () => modal.style.display = 'none');
    if (btnCancel && modal) btnCancel.addEventListener('click', (e) => { e.preventDefault(); modal.style.display = 'none'; });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const studentId = document.getElementById('tgp-student').value;
        const validDate = document.getElementById('tgp-date').value;
        const gate = document.getElementById('tgp-gate').value;
        const reason = document.getElementById('tgp-reason').value;
        const requester = document.getElementById('tgp-requester').value;

        const newTGP = {
          // Same TGP-XXXXXX shape as before, from a cryptographic source.
          // A scanned TGP is accepted on its id alone — there is no second
          // token as there is on a permanent pass — so the id should not come
          // from Math.random, whose output is predictable from earlier draws.
          id: 'TGP-' + generateQRToken(6),
          studentId,
          validDate,
          gate,
          reason,
          requester,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        const btnSubmit = document.getElementById('btn-submit-tgp');
        setButtonLoading(btnSubmit, true);

        try {
          await controller.model.addTGP(newTGP);
          controller.view.showToast('TGP Request Submitted');
          modal.style.display = 'none';
          form.reset();
          controller.navigateToPage('tgp');
        } finally {
          setButtonLoading(btnSubmit, false);
        }
      });
    }

    // RBAC: Hide action buttons if guard
    if (controller.model.currentUser && controller.model.currentUser.role === 'guard') {
      document.querySelectorAll('.btn-tgp-action').forEach(btn => btn.style.display = 'none');
      if (btnAdd) btnAdd.style.display = 'none';
    }

    // Pill filters
    controller.tgpPagination = { page: 1, limit: 25, filter: 'all' };
    const pills = document.querySelectorAll('#tgp-table-filters .pill, button.pill[data-filter]');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        pills.forEach(p => p.classList.remove('on'));
        e.currentTarget.classList.add('on');
        controller.tgpPagination.filter = e.currentTarget.dataset.filter || 'all';
        controller.tgpPagination.page = 1;
        TGPController.updatePagination(controller);
      });
    });

    TGPController.updatePagination(controller);
  }

  static bindRowActions(controller) {
    // Action buttons (Approve/Reject)
    document.querySelectorAll('.btn-tgp-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        const isApprove = action === 'approved';
        const confirmed = await Dialog.confirm(
          isApprove ? 'Approve Pass' : 'Reject Pass',
          `Are you sure you want to ${isApprove ? 'APPROVE' : 'REJECT'} this pass?`,
          { confirmText: isApprove ? 'Yes, Approve' : 'Yes, Reject', type: isApprove ? 'primary' : 'danger' }
        );
        
        if (confirmed) {
          await controller.model.updateTGPStatus(id, action);
          controller.view.showToast(`Pass ${action}`);
          controller.navigateToPage('tgp');
        }
      });
    });

    TGPController.bindTGPCard(controller);
  }

  static updatePagination(controller) {
    let tgpList = controller.model.tgp || [];
    const p = controller.tgpPagination;
    
    let filtered = tgpList.filter(t => p.filter === 'all' || t.status === p.filter);
    
    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const maxPage = Math.ceil(total / p.limit) || 1;
    if (p.page > maxPage) p.page = maxPage;
    if (p.page < 1) p.page = 1;
    
    const start = (p.page - 1) * p.limit;
    const paginated = filtered.slice(start, start + p.limit);

    import('../../views/TGPView.js').then(module => {
      const tbody = document.querySelector('#tgp-table tbody');
      if (tbody) tbody.innerHTML = module.default.renderTableRows(paginated, controller.model);
      
      if (controller.model.currentUser && controller.model.currentUser.role === 'guard') {
        document.querySelectorAll('.btn-tgp-action').forEach(btn => btn.style.display = 'none');
      }

      TGPController.bindRowActions(controller);
      
      const tgpPaginationContainer = document.getElementById('tgp-pagination');
      if (tgpPaginationContainer) {
        tgpPaginationContainer.innerHTML = generatePaginationHTML(p, total);
        bindPaginationEvents(tgpPaginationContainer, p, () => TGPController.updatePagination(controller));
      }
    });
  }

  static bindTGPCard(controller) {
    const modalCard = document.getElementById('modal-tgp-card');
    const btnCloseCard = document.getElementById('btn-close-tgp-card');

    if (btnCloseCard && modalCard) {
      btnCloseCard.addEventListener('click', () => modalCard.style.display = 'none');
    }

    // View Pass buttons
    document.querySelectorAll('.btn-view-tgp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tgpId = e.currentTarget.dataset.id;
        const tgp = controller.model.tgp.find(t => t.id === tgpId);
        if (!tgp) return;

        const student = controller.model.getStudentByPassId(tgp.studentId) || controller.model.getStudentByStudId(tgp.studentId);
        const sName = student ? student.name : 'Unknown Student';
        const sGrade = student ? `${student.grade} ${student.section ? '- ' + student.section : ''}` : '';
        const dateStr = new Date(tgp.validDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

        const photoHtml = student && hasPhoto(student.photo)
          ? `<img src="${resolvePhotoUrl(student.photo)}" style="width:100%;height:100%;object-fit:cover;">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:#e08700;">${sName.substring(0,2).toUpperCase()}</div>`;

        const target = document.getElementById('tgp-card-render-target');
        target.innerHTML = `
          <div id="tgp-card-capture" style="width:300px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);font-family:'Segoe UI',sans-serif;">
            <div style="background:linear-gradient(135deg,#e08700,#f5a623);padding:15px;text-align:center;color:#fff;">
              <div style="font-size:14px;font-weight:800;letter-spacing:1px;">SOUTHVILLE INTERNATIONAL</div>
              <div style="font-size:10px;color:#fff;font-weight:700;margin-top:2px;opacity:0.9;">TEMPORARY GATE PASS</div>
            </div>
            <div style="padding:20px;text-align:center;">
              <div style="width:80px;height:80px;margin:0 auto 12px;border-radius:10px;border:3px solid #e08700;overflow:hidden;background:#fef3e0;">${photoHtml}</div>
              <div style="font-size:18px;font-weight:800;color:#1f2937;margin-bottom:2px;">${sName}</div>
              <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:12px;">${sGrade}</div>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;margin-bottom:16px;">
                <div style="background:#fef3e0;padding:8px 10px;border-radius:6px;">
                  <div style="font-size:9px;color:#b06c00;text-transform:uppercase;font-weight:700;">Valid Date</div>
                  <div style="font-size:12px;font-weight:700;color:#1f2937;margin-top:2px;">${dateStr}</div>
                </div>
                <div style="background:#fef3e0;padding:8px 10px;border-radius:6px;">
                  <div style="font-size:9px;color:#b06c00;text-transform:uppercase;font-weight:700;">Gate</div>
                  <div style="font-size:12px;font-weight:700;color:#1f2937;margin-top:2px;">${tgp.gate}</div>
                </div>
              </div>

              <div style="background:#f5f4f8;border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700;margin-bottom:5px;">Scan to Verify</div>
                <div id="tgp-qrcode"></div>
                <div style="font-size:11px;font-weight:700;font-family:monospace;color:#e08700;margin-top:5px;letter-spacing:1px;">${tgp.id}</div>
              </div>
            </div>
            <div style="background:#e08700;padding:8px;text-align:center;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.5px;">ONE-DAY PASS · REQUIRES APPROVAL · ${tgp.requester ? 'Requested by: ' + tgp.requester : ''}</div>
          </div>`;

        // Generate QR Code
        setTimeout(() => {
          const qrTarget = document.getElementById('tgp-qrcode');
          if (qrTarget && typeof QRCode !== 'undefined') {
            new QRCode(qrTarget, { text: tgp.id, width: 90, height: 90, colorDark: "#1f2937", colorLight: "#f5f4f8" });
          }
        }, 50);

        modalCard.style.display = 'flex';
      });
    });

    // Download TGP Card
    const btnDownload = document.getElementById('btn-download-tgp');
    if (btnDownload) {
      btnDownload.addEventListener('click', async () => {
        const captureArea = document.getElementById('tgp-card-capture');
        if (!captureArea) return;
        btnDownload.innerHTML = 'Generating...';
        btnDownload.disabled = true;
        // Same pair as the permanent pass download: let the images decode,
        // and request them with CORS so a photo served from another origin
        // can actually be drawn into the canvas.
        await waitForImages(captureArea);
        html2canvas(captureArea, { scale: 3, useCORS: true }).then(canvas => {
          const a = document.createElement('a');
          a.href = canvas.toDataURL("image/png");
          a.download = `TGP_Card_${Date.now()}.png`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          btnDownload.innerHTML = 'Download Image';
          btnDownload.disabled = false;
        });
      });
    }
  }
}
