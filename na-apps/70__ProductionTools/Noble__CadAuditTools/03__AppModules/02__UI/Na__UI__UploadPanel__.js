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
        constructor(appState, eventBus, entityLoader) {
            this._appState    = appState;
            this._eventBus    = eventBus;
            this._entityLoader = entityLoader;

            this._overlayEl   = document.getElementById('Na__App__UploadOverlay');
            this._fileInputEl = document.getElementById('Na__Upload__FileInput');
            this._browseBtnEl = document.getElementById('Na__Upload__BrowseBtn');

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


        // FUNCTION | Validate File Type and POST to Server
        // ------------------------------------------------------------
        async Na__UploadPanel__HandleFile(file) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext !== 'dxf' && ext !== 'dwg') {
                alert('Please upload a .dxf or .dwg file.'); // TODO: Replace with a proper UI notification
                return;
            }

            console.log(`[Na__UploadPanel] Uploading: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/upload', {
                    method : 'POST',
                    body   : formData,
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({ error: 'Unknown server error' }));
                    console.error('[Na__UploadPanel] Upload failed:', err);
                    alert(`Upload failed: ${err.error || response.statusText}`);
                    return;
                }

                const data = await response.json();                      // <-- { entities, layers, filename, tempPath }
                await this._entityLoader.Na__EntityLoader__LoadFromServerResponse(data); // <-- Delegate to EntityLoader

            } catch (err) {
                console.error('[Na__UploadPanel] Network error during upload:', err);
                alert('Upload failed: Could not reach the local server. Is it running?');
            }
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
