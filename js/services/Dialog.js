import Icons from '../icons.js';

// Icons are factory functions — they must be CALLED. Interpolating the
// function itself used to dump its source code into the dialog markup.
const ICON = {
  danger:  () => Icons['alert-triangle'](22),
  warning: () => Icons['alert-triangle'](22),
  info:    () => Icons['info'](22),
  edit:    () => Icons['edit'](22)
};

export default class Dialog {
  /**
   * Show a confirmation dialog.
   * @param {string} title - The title of the dialog
   * @param {string} message - The main message body
   * @param {Object} options - Options object
   * @param {string} [options.confirmText='Confirm'] - Text for confirm button
   * @param {string} [options.cancelText='Cancel'] - Text for cancel button
   * @param {string} [options.type='primary'] - 'primary', 'danger', 'warning'
   * @returns {Promise<boolean>} True if confirmed, false if canceled
   */
  static confirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const {
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'primary'
      } = options;

      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      const iconKind = type === 'danger' ? 'danger' : (type === 'warning' ? 'warning' : 'info');
      const iconHtml = `<div class="dialog-icon ${iconKind === 'info' ? 'info' : iconKind}">${ICON[iconKind]()}</div>`;

      overlay.innerHTML = `
        <div class="dialog-box" role="alertdialog" aria-modal="true">
          <div class="dialog-head">
            ${iconHtml}
            <div class="dialog-title">${this.escape(title)}</div>
          </div>
          <div class="dialog-body">
            ${this.escape(message)}
          </div>
          <div class="dialog-foot">
            <button class="dialog-btn cancel" id="dlg-cancel">${this.escape(cancelText)}</button>
            <button class="dialog-btn ${type}" id="dlg-confirm">${this.escape(confirmText)}</button>
          </div>
        </div>
      `;

      const previouslyFocused = document.activeElement;
      document.body.appendChild(overlay);

      let settled = false;
      const close = (result) => {
        if (settled) return;              // one resolution per dialog
        settled = true;
        document.removeEventListener('keydown', keyHandler);
        overlay.classList.add('closing');
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
          resolve(result);
        }, 200); // Wait for fade-out animation
      };

      const keyHandler = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        // Enter only confirms non-destructive dialogs — a stray keypress
        // should never be able to confirm a delete.
        if (e.key === 'Enter' && type !== 'danger') { e.preventDefault(); close(true); }
      };
      document.addEventListener('keydown', keyHandler);

      overlay.querySelector('#dlg-cancel').addEventListener('click', () => close(false));
      overlay.querySelector('#dlg-confirm').addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

      setTimeout(() => {
        const focusTarget = overlay.querySelector(type === 'danger' ? '#dlg-cancel' : '#dlg-confirm');
        if (focusTarget) focusTarget.focus();
      }, 50);
    });
  }

  /**
   * Show a prompt dialog for user input.
   * @param {string} title
   * @param {string} message
   * @param {string} defaultValue
   * @returns {Promise<string|null>} The inputted string, or null if canceled
   */
  static prompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';

      overlay.innerHTML = `
        <div class="dialog-box" role="dialog" aria-modal="true">
          <div class="dialog-head">
            <div class="dialog-icon info">${ICON.edit()}</div>
            <div class="dialog-title">${this.escape(title)}</div>
          </div>
          <div class="dialog-body">
            ${this.escape(message)}
            <input type="text" class="dialog-input" id="dlg-input" value="${this.escape(defaultValue)}" />
          </div>
          <div class="dialog-foot">
            <button class="dialog-btn cancel" id="dlg-cancel">Cancel</button>
            <button class="dialog-btn primary" id="dlg-confirm">OK</button>
          </div>
        </div>
      `;

      const previouslyFocused = document.activeElement;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#dlg-input');
      setTimeout(() => input.focus(), 50);

      let settled = false;
      const close = (result) => {
        if (settled) return;
        settled = true;
        overlay.classList.add('closing');
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
          resolve(result);
        }, 200);
      };

      overlay.querySelector('#dlg-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('#dlg-confirm').addEventListener('click', () => close(input.value));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
      });
    });
  }

  static escape(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}
