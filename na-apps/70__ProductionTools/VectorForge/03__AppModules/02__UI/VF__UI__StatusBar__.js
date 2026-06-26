// =============================================================================
// VECTORFORGE - STATUS BAR UI
// =============================================================================
//
// FILE      : VF__UI__StatusBar__.js
// NAMESPACE : VectorForge.UI
// MODULE    : StatusBar
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Updates header status bar readouts for zoom, cursor position, and canvas size
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Binds to the cursor:moved, zoom:changed, and canvas:resized events and
//   keeps the four header status spans updated in real time.
// - Canvas size is displayed in both pixels and millimetres using the DPI
//   conversion factor stored in AppState.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | StatusBar UI Class
// -----------------------------------------------------------------------------

    // CLASS | StatusBarUI — Header Status Readout Controller
    // ------------------------------------------------------------
    export class StatusBarUI {

        // FUNCTION | Constructor — Bind DOM Elements and Register Bus Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this.zoomEl   = document.getElementById('zoom-level');  // <-- Zoom percentage span
            this.posEl    = document.getElementById('cursor-pos');  // <-- Cursor position span
            this.canvasPx = document.getElementById('canvas-px');   // <-- Canvas pixel dimensions span
            this.canvasMm = document.getElementById('canvas-mm');   // <-- Canvas millimetre dimensions span

            eventBus.on('cursor:moved',   (pt) => this._updateCursorPos(pt));          // <-- Live cursor position
            eventBus.on('zoom:changed',   (pct) => this._updateZoom(pct));             // <-- Zoom level change
            eventBus.on('canvas:resized', () => this._updateCanvasInfo(appState));     // <-- Canvas size change

            this._updateCanvasInfo(appState); // <-- Initialise display on load
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | UpdateCursorPos — Write Cursor Position to Status Bar
        // ------------------------------------------------------------
        _updateCursorPos(pt) {
            this.posEl.innerText = `${Math.round(pt.x)}, ${Math.round(pt.y)}`; // <-- Display rounded SVG coordinates
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | UpdateZoom — Write Zoom Percentage to Status Bar
        // ------------------------------------------------------------
        _updateZoom(pct) {
            this.zoomEl.innerText = `${Math.round(pct)}%`; // <-- Display rounded zoom percentage
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | UpdateCanvasInfo — Write Canvas Dimensions to Status Bar
        // ------------------------------------------------------------
        _updateCanvasInfo(appState) {
            const widthMm  = (appState.canvasWidth  / appState.pxPerMm).toFixed(1); // <-- Convert px to mm
            const heightMm = (appState.canvasHeight / appState.pxPerMm).toFixed(1); // <-- Convert px to mm
            this.canvasPx.innerText = `${appState.canvasWidth}x${appState.canvasHeight} px`;
            this.canvasMm.innerText = `${widthMm}x${heightMm} mm`;
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
