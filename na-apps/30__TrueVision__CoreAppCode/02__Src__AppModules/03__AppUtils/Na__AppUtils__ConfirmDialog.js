// =============================================================================
// TRUEVISION3D - APPLICATION UTILITIES - CONFIRM DIALOG
// =============================================================================
//
// FILE       : Na__AppUtils__ConfirmDialog.js
// NAMESPACE  : Na__AppUtils
// MODULE     : ConfirmDialog
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared in-app confirmation modal for destructive / persistent actions
// CREATED    : 29-Apr-2026
//
// DESCRIPTION:
// - Provides a single shared modal dialog used by destructive / persistent
//   dev actions (Save Camera, Save Orbit Max, Save Fog, Save Grid Position)
//   to gate writes behind an explicit user confirmation.
// - Returns a Promise<boolean> resolving to true on Confirm, false on Cancel
//   / backdrop click / Escape.
// - Falls back to native window.confirm() if the modal DOM is not present,
//   so callers can rely on the API in any environment.
// - Single dialog instance reused across callsites; if a previous call is
//   still open when a new Show() is invoked, the previous one auto-resolves
//   false to prevent listener / promise leaks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 03__AppUtils/Na__AppUtils__ConfirmDialog.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Apr-2026 - Version 1.0.0
// - Initial implementation alongside Dev Tools menu reorganisation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM IDs
    // ------------------------------------------------------------
    const Na__ConfirmDialog__RootId       = 'naConfirmDialog';
    const Na__ConfirmDialog__BackdropId   = 'naConfirmDialogBackdrop';
    const Na__ConfirmDialog__TitleId      = 'naConfirmDialogTitle';
    const Na__ConfirmDialog__MessageId    = 'naConfirmDialogMessage';
    const Na__ConfirmDialog__ConfirmBtnId = 'naConfirmDialogConfirm';
    const Na__ConfirmDialog__CancelBtnId  = 'naConfirmDialogCancel';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Default Labels
    // ------------------------------------------------------------
    const Na__ConfirmDialog__DefaultConfirmLabel = 'Confirm';
    const Na__ConfirmDialog__DefaultCancelLabel  = 'Cancel';
    const Na__ConfirmDialog__DefaultTitle        = 'Confirm';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Active Dialog Lifecycle Handles
    // ------------------------------------------------------------
    let Na__ConfirmDialog__ActiveCleanup = null;                      // <-- Cleanup function for currently open dialog
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve Required DOM References
    // ------------------------------------------------------------
    function Na__ConfirmDialog__ResolveDom() {
        const root       = document.getElementById(Na__ConfirmDialog__RootId);
        if (!root) return null;                                        // <-- Modal markup missing — caller falls back

        const backdrop   = document.getElementById(Na__ConfirmDialog__BackdropId);
        const titleEl    = document.getElementById(Na__ConfirmDialog__TitleId);
        const messageEl  = document.getElementById(Na__ConfirmDialog__MessageId);
        const confirmBtn = document.getElementById(Na__ConfirmDialog__ConfirmBtnId);
        const cancelBtn  = document.getElementById(Na__ConfirmDialog__CancelBtnId);

        if (!titleEl || !messageEl || !confirmBtn || !cancelBtn) return null;
        return { root, backdrop, titleEl, messageEl, confirmBtn, cancelBtn };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Destructive Styling Flag
    // ------------------------------------------------------------
    function Na__ConfirmDialog__ApplyDestructiveFlag(confirmBtn, isDestructive) {
        if (isDestructive) {
            confirmBtn.classList.add('na-confirm-dialog__confirm--destructive');
        } else {
            confirmBtn.classList.remove('na-confirm-dialog__confirm--destructive');
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close Active Dialog (Cancel-Equivalent)
    // ------------------------------------------------------------
    function Na__ConfirmDialog__ForceCloseActive() {
        if (typeof Na__ConfirmDialog__ActiveCleanup === 'function') {
            Na__ConfirmDialog__ActiveCleanup(false);                   // <-- Auto-cancel any prior open dialog
        }
        Na__ConfirmDialog__ActiveCleanup = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Show Confirmation Dialog (Returns Promise<boolean>)
    // ------------------------------------------------------------
    function Na__AppUtils__ConfirmDialog__Show(options) {
        const opts = options || {};
        const title         = typeof opts.title === 'string'        ? opts.title        : Na__ConfirmDialog__DefaultTitle;
        const message       = typeof opts.message === 'string'      ? opts.message      : '';
        const confirmLabel  = typeof opts.confirmLabel === 'string' ? opts.confirmLabel : Na__ConfirmDialog__DefaultConfirmLabel;
        const cancelLabel   = typeof opts.cancelLabel === 'string'  ? opts.cancelLabel  : Na__ConfirmDialog__DefaultCancelLabel;
        const isDestructive = opts.isDestructive !== false;            // <-- Default true so dev saves get the warm accent

        // Auto-cancel any currently open dialog so listeners cannot leak
        Na__ConfirmDialog__ForceCloseActive();

        const dom = Na__ConfirmDialog__ResolveDom();
        if (!dom) {
            // FALLBACK | Native confirm if modal markup is unavailable
            const fallbackText = title + (message ? `\n\n${message}` : '');
            return Promise.resolve(window.confirm(fallbackText));
        }

        // POPULATE | Title, message, button labels, destructive flag
        dom.titleEl.textContent      = title;
        dom.messageEl.textContent    = message;
        dom.confirmBtn.textContent   = confirmLabel;
        dom.cancelBtn.textContent    = cancelLabel;
        Na__ConfirmDialog__ApplyDestructiveFlag(dom.confirmBtn, isDestructive);

        // SHOW | Open modal
        dom.root.classList.add('is-open');
        dom.root.setAttribute('aria-hidden', 'false');

        return new Promise((resolve) => {
            const onConfirm = () => cleanup(true);
            const onCancel  = () => cleanup(false);
            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    cleanup(false);                                    // <-- Esc cancels
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    cleanup(true);                                     // <-- Enter confirms
                }
            };

            const cleanup = (result) => {
                dom.confirmBtn.removeEventListener('click', onConfirm);
                dom.cancelBtn.removeEventListener('click', onCancel);
                if (dom.backdrop) dom.backdrop.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeyDown);

                dom.root.classList.remove('is-open');
                dom.root.setAttribute('aria-hidden', 'true');

                Na__ConfirmDialog__ActiveCleanup = null;
                resolve(!!result);
            };

            // BIND | All cancel + confirm pathways
            dom.confirmBtn.addEventListener('click', onConfirm);
            dom.cancelBtn.addEventListener('click', onCancel);
            if (dom.backdrop) dom.backdrop.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeyDown);

            // FOCUS | Cancel button by default so accidental Enter still cancels-friendly path
            try { dom.cancelBtn.focus(); } catch (_) { /* focus failures are non-fatal */ }

            Na__ConfirmDialog__ActiveCleanup = cleanup;                // <-- Track for auto-cancel on next Show()
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Confirm Dialog API
    // ------------------------------------------------------------
    export {
        Na__AppUtils__ConfirmDialog__Show
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
