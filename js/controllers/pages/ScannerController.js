export default class ScannerController {
  static bind(controller) {
    controller.scannerActive = false;
    controller.videoStream = null;

    // Tabs
    const tabs = document.querySelectorAll('.scan-tab');
    const panels = document.querySelectorAll('.scan-panel');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.fontWeight = '500';
          t.style.color = 'var(--text2)';
          t.style.borderBottomColor = 'transparent';
        });
        const curr = e.currentTarget;
        curr.classList.add('active');
        curr.style.fontWeight = '600';
        curr.style.color = 'var(--primary)';
        curr.style.borderBottomColor = 'var(--primary)';

        const target = curr.dataset.target;
        panels.forEach(p => p.style.display = 'none');
        document.getElementById(`panel-${target}`).style.display = 'block';

        if (target === 'usb') {
          document.getElementById('scan-usb-input').focus();
          controller.stopCamera();
          controller.stopFaceCamera();
        } else if (target === 'camera') {
          // Camera started manually via button now
          controller.stopFaceCamera();
        } else if (target === 'facescan') {
          controller.stopCamera();
          // Update enrolled count display
          if (typeof controller.updateFaceEnrolledCount === 'function') {
            controller.updateFaceEnrolledCount();
          }
        } else {
          controller.stopCamera();
          controller.stopFaceCamera();
        }
      });
    });

    // USB Scanner Input
    //
    // This one box serves two callers: a hardware reader, and a guard typing
    // into it as a fallback (the panel says "Scan or type here"). It used to
    // report every entry as isManual = true, which switches off the QR token
    // check in processScan — so a barcode carrying nothing but a Pass ID was
    // accepted as a genuine pass.
    //
    // A reader delivers the whole payload as a keystroke burst and presses
    // Enter itself, in a few milliseconds; a person cannot. Timing the entry
    // tells the two apart, so reader input is verified like a camera scan
    // while typing keeps the manual override it has always had.
    const USB_SCAN_MAX_MS = 150;   // whole payload, first key to Enter
    const usbInput = document.getElementById('scan-usb-input');
    if (usbInput) {
      let firstKeyAt = 0;

      usbInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') {
          if (!firstKeyAt) firstKeyAt = Date.now();
          return;
        }

        const value = usbInput.value.trim();
        const elapsed = firstKeyAt ? Date.now() - firstKeyAt : Infinity;
        // No recorded keystrokes at all means the value was pasted or set
        // programmatically — treat that as a scan, not as typing.
        const isTyped = firstKeyAt !== 0 && elapsed > USB_SCAN_MAX_MS;

        firstKeyAt = 0;
        usbInput.value = '';
        if (value) controller.processScan(value, isTyped);
      });

      // A value that never reached Enter should not date the next entry.
      usbInput.addEventListener('blur', () => { firstKeyAt = 0; });
    }

    // Manual Input
    const manualBtn = document.getElementById('btn-manual-verify');
    const manualInput = document.getElementById('scan-manual-input');
    if (manualBtn && manualInput) {
      manualBtn.addEventListener('click', () => {
        if (manualInput.value.trim()) {
          controller.processScan(manualInput.value.trim().toUpperCase(), true);
          manualInput.value = '';
        }
      });
      manualInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          manualBtn.click();
        }
      });
    }

    // Camera Start Button
    const camStartBtn = document.getElementById('btn-start-camera');
    if (camStartBtn) {
      camStartBtn.addEventListener('click', () => {
        controller.startCamera();
      });
    }

    const camStopBtn = document.getElementById('btn-stop-camera');
    if (camStopBtn) {
      camStopBtn.addEventListener('click', () => {
        controller.stopCamera();
      });
    }

    const camSwitchBtn = document.getElementById('btn-switch-camera');
    if (camSwitchBtn) {
      camSwitchBtn.addEventListener('click', () => {
        controller.switchCamera();
      });
    }

    // ── Face Scan Buttons (Additive — does not affect QR/USB/Manual) ──
    const faceStartBtn = document.getElementById('btn-start-face-scan');
    if (faceStartBtn) {
      faceStartBtn.addEventListener('click', () => {
        controller.startFaceCamera('scan');
      });
    }

    const faceEnrollBtn = document.getElementById('btn-enroll-face');
    if (faceEnrollBtn) {
      faceEnrollBtn.addEventListener('click', () => {
        controller.startFaceCamera('enroll');
      });
    }

    // Gate Selector Text Update
    const gateSelect = document.getElementById('scan-gate');
    const gateBannerText = document.getElementById('gate-banner-text');
    if (gateSelect && gateBannerText) {
      gateSelect.addEventListener('change', (e) => {
        gateBannerText.textContent = e.target.value.toUpperCase();
      });
    }
  }
}
