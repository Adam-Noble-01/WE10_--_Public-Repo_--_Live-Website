// =============================================================================
// NOBLE CAD AUDIT TOOLS - UPLOAD PANEL
// =============================================================================
//
// FILE      : Na__UI__UploadPanel__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : UploadPanel
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages the file upload overlay — drag-drop, file input, upload to server
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Controls the #Na__App__UploadOverlay element (visible until a file is loaded).
// - Handles three upload entry points: drag-and-drop, file input browse, and
//   (future) paste-from-clipboard.
// - POSTs the selected file to Flask /api/upload.
// - On success, delegates to EntityLoader.Na__EntityLoader__LoadFromServerResponse()
//   which parses the returned entity JSON and populates the canvas.
// - Hides the overlay on successful file load.
// - Shows the overlay again when "file:cleared" is emitted.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.1
// - Reworked upload to a background-job model: XHR upload with live upload %,
//   then polls /api/upload-status for server-side convert/parse progress via
//   the ProgressOverlay, with a Cancel action wired to /api/upload-cancel.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | UploadPanel Class
// -----------------------------------------------------------------------------

    export class Na__UI__UploadPanel {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, entityLoader, progressOverlay) {
            this._appState        = appState;
            this._eventBus        = eventBus;
            this._entityLoader    = entityLoader;
            this._progressOverlay = progressOverlay;                 // <-- Progress/cancel overlay controller

            this._overlayEl   = document.getElementById('Na__App__UploadOverlay');
            this._fileInputEl = document.getElementById('Na__Upload__FileInput');
            this._browseBtnEl = document.getElementById('Na__Upload__BrowseBtn');

            // ACTIVE-JOB STATE — tracks the in-flight upload for cancellation
            this._activeXhr   = null;                                // <-- Current upload XHR (abortable)
            this._activeJobId = null;                                // <-- Server job id being polled
            this._cancelled   = false;                               // <-- True once the user cancels

            if (this._overlayEl) {
                this._bindDragDropHandlers();
                this._bindFileInputHandlers();
                this._bindEventBusListeners();
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Drag-and-Drop Event Handlers to the Overlay
        // ------------------------------------------------------------
        _bindDragDropHandlers() {
            const el = this._overlayEl;

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                el.classList.add('is-drag-target');                      // <-- Visual drop target feedback
            });

            el.addEventListener('dragleave', (e) => {
                if (!el.contains(e.relatedTarget)) {
                    el.classList.remove('is-drag-target');               // <-- Remove feedback when cursor leaves
                }
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('is-drag-target');
                const file = e.dataTransfer?.files?.[0];
                if (file) this.Na__UploadPanel__HandleFile(file);        // <-- Process dropped file
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind File Input and Browse Button Handlers
        // ------------------------------------------------------------
        _bindFileInputHandlers() {
            if (this._browseBtnEl && this._fileInputEl) {
                this._browseBtnEl.addEventListener('click', () => {
                    this._fileInputEl.click();                           // <-- Trigger native file picker
                });
                this._fileInputEl.addEventListener('change', (e) => {
                    const file = e.target.files?.[0];
                    if (file) this.Na__UploadPanel__HandleFile(file);    // <-- Process chosen file
                });
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('file:loaded', () => {
                this.Na__UploadPanel__HideOverlay();                     // <-- Hide after successful load
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__UploadPanel__ShowOverlay();                     // <-- Show again when reset
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Validate, Upload and Track the File Through the Server Job
        // ------------------------------------------------------------
        async Na__UploadPanel__HandleFile(file) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext !== 'dxf' && ext !== 'dwg') {
                alert('Please upload a .dxf or .dwg file.'); // TODO: Replace with a proper UI notification
                return;
            }

            console.log(`[Na__UploadPanel] Uploading: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

            // RESET ACTIVE-JOB STATE FOR THIS UPLOAD
            this._cancelled   = false;
            this._activeXhr   = null;
            this._activeJobId = null;

            // SHOW OVERLAY + WIRE CANCEL
            this._progressOverlay.Na__ProgressOverlay__Show(file.name, 'Uploading file…');
            this._progressOverlay.Na__ProgressOverlay__SetCancelHandler(() => this._cancelActiveJob());

            try {
                const startResult = await this._uploadFileWithProgress(file);   // <-- XHR upload → { jobId } or payload
                if (this._cancelled) return;

                if (startResult && startResult.jobId) {
                    this._activeJobId = startResult.jobId;
                    await this._pollJobUntilComplete(startResult.jobId);        // <-- New async server — poll progress
                } else if (startResult && startResult.entities) {
                    await this._finishLoad(startResult);                       // <-- Legacy synchronous server response
                } else {
                    throw new Error('Unexpected server response — restart the local server to load the latest code.');
                }

            } catch (err) {
                if (this._cancelled) {                                          // <-- User-initiated abort — quietly close
                    this._progressOverlay.Na__ProgressOverlay__Hide();
                    return;
                }
                console.error('[Na__UploadPanel] Upload error:', err);
                this._progressOverlay.Na__ProgressOverlay__ShowError(err.message || 'Upload failed');
            }
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Upload the File via XHR (Reports Upload Progress)
        // ------------------------------------------------------------
        _uploadFileWithProgress(file) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                this._activeXhr = xhr;

                xhr.open('POST', '/api/upload');

                xhr.upload.onprogress = (e) => {
                    if (!e.lengthComputable) return;
                    const pct = Math.round((e.loaded / e.total) * 100);
                    this._progressOverlay.Na__ProgressOverlay__Update({
                        stage   : 'uploading',
                        message : `Uploading… ${pct}%`,
                        percent : pct,
                    });
                };

                xhr.upload.onload = () => {
                    this._progressOverlay.Na__ProgressOverlay__Update({        // <-- Bytes sent — server now working
                        stage   : 'queued',
                        message : 'Upload complete — processing on server…',
                        percent : null,
                    });
                };

                xhr.onload = () => {
                    this._activeXhr = null;
                    // 202 = new async job ({ jobId }); 200 = legacy synchronous payload ({ entities })
                    if (xhr.status === 202 || xhr.status === 200) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch {
                            reject(new Error('Unexpected server response starting the job.'));
                        }
                        return;
                    }
                    let msg = `Server returned ${xhr.status}`;
                    try {
                        const body = JSON.parse(xhr.responseText);
                        if (body.error) msg = body.error;
                    } catch { /* keep default */ }
                    reject(new Error(msg));
                };

                xhr.onerror = () => {
                    this._activeXhr = null;
                    reject(new Error('Could not reach the local server. Is it running?'));
                };

                xhr.onabort = () => {
                    this._activeXhr = null;
                    reject(new Error('__cancelled__'));                        // <-- Handled as a cancel in HandleFile
                };

                const formData = new FormData();
                formData.append('file', file);
                xhr.send(formData);
            });
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Poll the Job Status Endpoint Until It Finishes
        // ------------------------------------------------------------
        async _pollJobUntilComplete(jobId) {
            const pollMs = this._appState?.config?.Config__Upload?.StatusPollInterval_ms || 500;

            while (true) {                                                     // eslint-disable-line no-constant-condition
                if (this._cancelled) return;
                await this._sleep(pollMs);
                if (this._cancelled) return;

                const response = await fetch(`/api/upload-status/${jobId}`);
                if (!response.ok) {
                    throw new Error('Lost contact with the conversion job (it may have expired).');
                }

                const job = await response.json();
                this._progressOverlay.Na__ProgressOverlay__Update({
                    stage   : job.stage,
                    message : job.message,
                    percent : job.percent,
                });

                if (job.status === 'done') {
                    await this._finishLoad(job.result);                        // <-- Render + hide overlay
                    return;
                }
                if (job.status === 'error') {
                    throw new Error(job.error || 'Conversion failed on the server.');
                }
                if (job.status === 'cancelled') {
                    this._progressOverlay.Na__ProgressOverlay__Hide();
                    return;
                }
            }
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Render the Completed Result and Close the Overlay
        // ------------------------------------------------------------
        async _finishLoad(result) {
            if (!result) throw new Error('Server reported completion but returned no drawing data.');

            this._progressOverlay.Na__ProgressOverlay__Update({
                stage   : 'rendering',
                message : 'Rendering drawing…',
                percent : 100,
            });

            await this._entityLoader.Na__EntityLoader__LoadFromServerResponse(result); // <-- Populate canvas + state
            this._progressOverlay.Na__ProgressOverlay__Hide();
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Cancel the In-Flight Upload / Conversion Job
        // ------------------------------------------------------------
        _cancelActiveJob() {
            this._cancelled = true;

            if (this._activeXhr) {
                try { this._activeXhr.abort(); } catch { /* ignore */ }        // <-- Stop an in-progress upload
            }

            if (this._activeJobId) {
                fetch(`/api/upload-cancel/${this._activeJobId}`, { method: 'POST' })
                    .catch(() => { /* best-effort — server sweeps stale jobs */ });
            }

            this._progressOverlay.Na__ProgressOverlay__Hide();
            console.log('[Na__UploadPanel] Upload cancelled by user');
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Promise-Based Sleep
        // ------------------------------------------------------------
        _sleep(ms) {
            return new Promise((resolve) => window.setTimeout(resolve, ms));
        }
        // ------------------------------------------------------------


        // FUNCTION | Hide the Upload Overlay
        // ------------------------------------------------------------
        Na__UploadPanel__HideOverlay() {
            if (this._overlayEl) {
                this._overlayEl.classList.remove('Na__App__UploadOverlay--visible'); // <-- Hide overlay
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Show the Upload Overlay
        // ------------------------------------------------------------
        Na__UploadPanel__ShowOverlay() {
            if (this._overlayEl) {
                this._overlayEl.classList.add('Na__App__UploadOverlay--visible');    // <-- Show overlay
                if (this._fileInputEl) this._fileInputEl.value = '';                // <-- Clear previous file
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
