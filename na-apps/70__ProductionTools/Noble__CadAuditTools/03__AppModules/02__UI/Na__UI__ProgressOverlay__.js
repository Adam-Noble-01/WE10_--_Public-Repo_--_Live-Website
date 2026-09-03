// =============================================================================
// NOBLE CAD AUDIT TOOLS - PROGRESS OVERLAY
// =============================================================================
//
// FILE      : Na__UI__ProgressOverlay__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : ProgressOverlay
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Full-screen progress overlay for long uploads/conversions + cancel
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Controls the #Na__App__ProgressOverlay element.
// - Reports live stage/message coming back from the server-side background job
//   (uploading → converting → parsing → finalising) so large DWG conversions no
//   longer look like a silent timeout.
// - Drives a determinate or indeterminate progress bar and a live elapsed timer.
// - Exposes a single cancel handler that UploadPanel wires to abort the job.
// - Purely presentational: it owns no upload logic, only display + the cancel
//   button wiring (single responsibility).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 01-Sep-2026 - Version 0.5.0
// - Added 'checking' / 'saving' / 'complete' stage titles for the project-save
//   flow. Update({stage}) rewrites the title from this map, so an unmapped
//   stage silently reverted the heading to the generic "Processing…".
// - ShowError() takes an optional title; it previously hardcoded "Upload
//   failed" onto every error, including save and export failures.
//
// 07-Jul-2026 - Version 0.3.3
// - Na__ProgressOverlay__Show() gained an { allowCancel } option — hard-delete
//   (quick, always undoable) shows the overlay without a Cancel button.
//   ShowError() always re-reveals the button so failures stay dismissible.
//
// 07-Jul-2026 - Version 0.3.1
// - Initial release — progress reporting + cancel action for large uploads.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | ProgressOverlay Class
// -----------------------------------------------------------------------------

    export class Na__UI__ProgressOverlay {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor() {
            this._overlayEl   = document.getElementById('Na__App__ProgressOverlay');
            this._titleEl     = document.getElementById('Na__Progress__Title');
            this._fileNameEl  = document.getElementById('Na__Progress__FileName');
            this._messageEl   = document.getElementById('Na__Progress__Message');
            this._barEl       = document.getElementById('Na__Progress__Bar');
            this._barFillEl   = document.getElementById('Na__Progress__BarFill');
            this._elapsedEl   = document.getElementById('Na__Progress__Elapsed');
            this._cancelBtnEl = document.getElementById('Na__Progress__CancelBtn');

            this._cancelHandler = null;                              // <-- Set by UploadPanel per job
            this._elapsedTimer  = null;                             // <-- setInterval id for elapsed clock
            this._startMs       = 0;                                // <-- Job start timestamp

            if (this._cancelBtnEl) {
                this._cancelBtnEl.addEventListener('click', () => this._onCancelClicked());
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Show the Overlay and Start the Elapsed Clock
        // ------------------------------------------------------------
        Na__ProgressOverlay__Show(fileName, title = 'Processing…', { allowCancel = true } = {}) {
            if (!this._overlayEl) return;

            this._overlayEl.classList.remove('is-error');           // <-- Reset any prior error state
            this._setCancelEnabled(true);
            this._setCancelVisible(allowCancel);                    // <-- Hide Cancel for quick, non-abortable ops
            if (this._cancelBtnEl) this._cancelBtnEl.textContent = 'Cancel';

            if (this._titleEl)    this._titleEl.textContent    = title;
            if (this._fileNameEl) this._fileNameEl.textContent = fileName || '';
            if (this._messageEl)  this._messageEl.textContent  = 'Starting…';

            this.Na__ProgressOverlay__Update({ stage: 'uploading', message: 'Uploading…', percent: null });

            this._overlayEl.classList.add('Na__App__ProgressOverlay--visible');
            this._overlayEl.setAttribute('aria-hidden', 'false');

            this._startMs = Date.now();
            this._startElapsedClock();
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Stage, Message and Progress Percentage
        // ------------------------------------------------------------
        Na__ProgressOverlay__Update({ stage, message, percent } = {}) {
            if (!this._overlayEl) return;

            if (message && this._messageEl) {
                this._messageEl.textContent = message;              // <-- Live server-reported status text
            }

            if (stage && this._titleEl) {
                this._titleEl.textContent = this._stageTitle(stage);
            }

            this._applyProgress(percent);
        }
        // ------------------------------------------------------------


        // FUNCTION | Switch the Overlay into an Error State
        // ------------------------------------------------------------
        Na__ProgressOverlay__ShowError(message, title = 'Operation failed') {
            if (!this._overlayEl) return;

            this._stopElapsedClock();
            this._overlayEl.classList.add('is-error');

            if (this._titleEl)   this._titleEl.textContent   = title;   // <-- Callers name their own failure
            if (this._messageEl) this._messageEl.textContent = message || 'An unknown error occurred.';

            if (this._cancelBtnEl) {
                this._cancelBtnEl.textContent = 'Close';            // <-- Cancel button doubles as dismiss
                this._setCancelEnabled(true);
                this._setCancelVisible(true);                       // <-- Always dismissible, even if shown with allowCancel:false
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Hide the Overlay and Reset State
        // ------------------------------------------------------------
        Na__ProgressOverlay__Hide() {
            if (!this._overlayEl) return;

            this._stopElapsedClock();
            this._overlayEl.classList.remove('Na__App__ProgressOverlay--visible', 'is-error');
            this._overlayEl.setAttribute('aria-hidden', 'true');
            this._cancelHandler = null;                             // <-- Drop the per-job handler
        }
        // ------------------------------------------------------------


        // FUNCTION | Register the Cancel Handler for the Current Job
        // ------------------------------------------------------------
        Na__ProgressOverlay__SetCancelHandler(handlerFn) {
            this._cancelHandler = (typeof handlerFn === 'function') ? handlerFn : null;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Handle Cancel Button Click
        // ------------------------------------------------------------
        _onCancelClicked() {
            if (this._overlayEl && this._overlayEl.classList.contains('is-error')) {
                this.Na__ProgressOverlay__Hide();                   // <-- In error state the button just closes
                return;
            }

            if (this._cancelHandler) {
                if (this._messageEl) this._messageEl.textContent = 'Cancelling…';
                this._setCancelEnabled(false);
                this._cancelHandler();                              // <-- UploadPanel aborts/cancels the job
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Apply Determinate or Indeterminate Progress
        // ------------------------------------------------------------
        _applyProgress(percent) {
            if (!this._barEl || !this._barFillEl) return;

            const hasPercent = (typeof percent === 'number') && !Number.isNaN(percent);

            if (hasPercent) {
                this._barEl.classList.remove('is-indeterminate');
                const clamped = Math.max(0, Math.min(100, percent));
                this._barFillEl.style.width = `${clamped}%`;
            } else {
                this._barEl.classList.add('is-indeterminate');      // <-- Unknown duration — travelling sliver
                this._barFillEl.style.width = '';
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Enable or Disable the Cancel Button
        // ------------------------------------------------------------
        _setCancelEnabled(enabled) {
            if (this._cancelBtnEl) this._cancelBtnEl.disabled = !enabled;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Show or Hide the Cancel Button Entirely
        // ------------------------------------------------------------
        _setCancelVisible(visible) {
            if (this._cancelBtnEl) this._cancelBtnEl.style.display = visible ? '' : 'none';
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Map a Server Stage to a Human Title
        // ------------------------------------------------------------
        _stageTitle(stage) {
            const titles = {
                'uploading'  : 'Uploading file…',
                'queued'     : 'Preparing…',
                'converting' : 'Converting DWG → DXF…',
                'parsing'    : 'Parsing entities…',
                'finalising' : 'Finalising…',
                'rendering'  : 'Rendering drawing…',
                'exporting'  : 'Exporting DXF…',
                'copying'    : 'Copying to destination…',
                'loading'    : 'Loading project…',
                'checking'   : 'Checking connection…',
                'saving'     : 'Saving project…',
                'complete'   : 'Saved',
                'done'       : 'Complete',
            };
            return titles[stage] || 'Processing…';
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Start the Live Elapsed-Time Clock
        // ------------------------------------------------------------
        _startElapsedClock() {
            this._stopElapsedClock();
            const tick = () => {
                if (!this._elapsedEl) return;
                const secs = Math.floor((Date.now() - this._startMs) / 1000);
                const mins = Math.floor(secs / 60);
                const rem  = secs % 60;
                this._elapsedEl.textContent = mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
            };
            tick();
            this._elapsedTimer = window.setInterval(tick, 1000);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Stop the Elapsed-Time Clock
        // ------------------------------------------------------------
        _stopElapsedClock() {
            if (this._elapsedTimer) {
                window.clearInterval(this._elapsedTimer);
                this._elapsedTimer = null;
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
