// =============================================================================
// NOBLE CAD AUDIT TOOLS - STATUS BAR
// =============================================================================
//
// FILE      : Na__UI__StatusBar__.js
// NAMESPACE : CadAuditTools.UI
// MODULE    : StatusBar
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Updates the top-bar status readouts (zoom, cursor, selection count)
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Subscribes to EventBus events from Canvas (cursor:moved, zoom:changed),
//   SelectionManager (selection:changed), and EntityLoader (file:loaded).
// - Updates the four span elements in the top-bar status strip.
// - Also updates the file name chip next to the app title on file load.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | StatusBar Class
// -----------------------------------------------------------------------------

    export class Na__UI__StatusBar {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState = appState;
            this._eventBus = eventBus;

            this._zoomEl      = document.getElementById('Na__Status__ZoomLevel');
            this._cursorEl    = document.getElementById('Na__Status__CursorPos');
            this._selectedEl  = document.getElementById('Na__Status__SelectedCount');
            this._totalEl     = document.getElementById('Na__Status__TotalCount');
            this._fileChipEl  = document.getElementById('Na__App__FileChip');

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('zoom:changed', ({ scale }) => {
                this.Na__StatusBar__SetZoom(scale);                      // <-- Update zoom readout
            });
            this._eventBus.on('cursor:moved', ({ x, y }) => {
                this.Na__StatusBar__SetCursor(x, y);                     // <-- Update cursor coordinates
            });
            this._eventBus.on('selection:changed', (entities) => {
                this.Na__StatusBar__SetSelectedCount(entities.length);   // <-- Update selected count
            });
            this._eventBus.on('file:loaded', ({ fileName, entityCount }) => {
                this.Na__StatusBar__SetFileName(fileName);               // <-- Show file name chip
                this.Na__StatusBar__SetTotalCount(entityCount || 0);     // <-- Total entity count
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__StatusBar__Reset();
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Zoom Percentage Readout
        // ------------------------------------------------------------
        Na__StatusBar__SetZoom(scale) {
            if (this._zoomEl) {
                this._zoomEl.textContent = `${Math.round(scale * 100)}%`; // <-- Convert scale to percent
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Cursor Position Readout
        // ------------------------------------------------------------
        Na__StatusBar__SetCursor(x, y) {
            if (this._cursorEl) {
                this._cursorEl.textContent = `${Math.round(x)}, ${Math.round(y)}`; // <-- Integer pixel coords
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Selected Entity Count
        // ------------------------------------------------------------
        Na__StatusBar__SetSelectedCount(count) {
            if (this._selectedEl) {
                this._selectedEl.textContent = count;
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Update Total Entity Count
        // ------------------------------------------------------------
        Na__StatusBar__SetTotalCount(count) {
            if (this._totalEl) {
                this._totalEl.textContent = count;
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Update the File Name Chip in the Top Bar
        // ------------------------------------------------------------
        Na__StatusBar__SetFileName(fileName) {
            if (this._fileChipEl) {
                this._fileChipEl.textContent = fileName || 'No file loaded';
                this._fileChipEl.title       = fileName || '';            // <-- Full name on hover
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Reset All Status Readouts to Default State
        // ------------------------------------------------------------
        Na__StatusBar__Reset() {
            if (this._zoomEl)     this._zoomEl.textContent     = '100%';
            if (this._cursorEl)   this._cursorEl.textContent   = '0, 0';
            if (this._selectedEl) this._selectedEl.textContent = '0';
            if (this._totalEl)    this._totalEl.textContent    = '0';
            if (this._fileChipEl) this._fileChipEl.textContent = 'No file loaded';
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
