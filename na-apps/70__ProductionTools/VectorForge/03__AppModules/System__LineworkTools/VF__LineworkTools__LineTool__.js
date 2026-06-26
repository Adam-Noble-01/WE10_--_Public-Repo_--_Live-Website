// =============================================================================
// VECTORFORGE - LINE TOOL
// =============================================================================
//
// FILE      : VF__LineworkTools__LineTool__.js
// NAMESPACE : VectorForge.LineworkTools
// MODULE    : LineTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Click-to-start, click-to-finish straight line drawing tool
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - First left-click on the canvas starts a new <line> element at the cursor position.
// - Mouse movement updates the line's x2/y2 endpoint in real time for live preview.
// - A second left-click commits the line; deactivation cancels any in-progress
//   zero-length line and removes it from the DOM.
// - Respects AppState.snapToGrid via SVGCanvas.getSVGPoint.
// - Holding Shift during mousemove or the commit click locks the endpoint to the
//   nearest orthogonal axis (horizontal or vertical) from the start point.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.1.0
// - Shift key orthogonal axis lock added to live preview and commit click.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


import { VF__CommonUtils__ConstrainPointToOrtho } from '../03__CommonUtils/VF__CommonUtils__OrthoConstraint__.js';

// -----------------------------------------------------------------------------
// REGION | LineTool Class
// -----------------------------------------------------------------------------

    // CLASS | LineTool — Straight Line Drawing Tool
    // ------------------------------------------------------------
    export class LineTool {

        // FUNCTION | Constructor — Attach Mouse Listeners to SVG Canvas
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState    = appState;   // <-- App state reference
            this.svgCanvas   = svgCanvas;  // <-- SVG canvas reference
            this.active      = false;      // <-- Tool active flag
            this.drawing     = false;      // <-- Mid-draw flag
            this.currentLine = null;       // <-- In-progress SVG line element

            this.svgCanvas.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
            this.svgCanvas.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
        }
        // ------------------------------------------------------------


        // FUNCTION | Activate — Enable the Tool
        // ------------------------------------------------------------
        activate() {
            this.active = true;
        }
        // ------------------------------------------------------------


        // FUNCTION | Deactivate — Disable the Tool and Cancel Any In-Progress Draw
        // ------------------------------------------------------------
        deactivate() {
            this.active  = false;
            this.drawing = false;
            if (this.currentLine && this.currentLine.getAttribute('x1') === this.currentLine.getAttribute('x2')) {
                this.currentLine.remove(); // <-- Remove zero-length line on cancel
            }
            this.currentLine = null;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseDown — Start or Finish a Line on Left Click
        // ------------------------------------------------------------
        _onMouseDown(e) {
            if (!this.active || e.button !== 0) return;
            const pt = this.svgCanvas.getSVGPoint(e);

            if (!this.drawing) {
                this.drawing     = true;
                this.currentLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                this.currentLine.setAttribute('x1',           pt.x);
                this.currentLine.setAttribute('y1',           pt.y);
                this.currentLine.setAttribute('x2',           pt.x);
                this.currentLine.setAttribute('y2',           pt.y);
                this.currentLine.setAttribute('stroke',       '#000000');
                this.currentLine.setAttribute('stroke-width', '2');
                this.currentLine.dataset.originalStroke = '#000000'; // <-- Cache for selection manager
                this.svgCanvas.addElement(this.currentLine);
            } else {
                const x1     = parseFloat(this.currentLine.getAttribute('x1')); // <-- Start point X
                const y1     = parseFloat(this.currentLine.getAttribute('y1')); // <-- Start point Y
                const commit = VF__CommonUtils__ConstrainPointToOrtho(x1, y1, pt.x, pt.y, e.shiftKey); // <-- Apply ortho lock at commit
                this.currentLine.setAttribute('x2', commit.x);
                this.currentLine.setAttribute('y2', commit.y);
                this.drawing     = false; // <-- Second click commits the line
                this.currentLine = null;
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseMove — Update Live Line Endpoint During Draw
        // ------------------------------------------------------------
        _onMouseMove(e) {
            if (!this.active || !this.drawing || !this.currentLine) return;
            const raw = this.svgCanvas.getSVGPoint(e);
            const x1  = parseFloat(this.currentLine.getAttribute('x1')); // <-- Start point X for ortho anchor
            const y1  = parseFloat(this.currentLine.getAttribute('y1')); // <-- Start point Y for ortho anchor
            const pt  = VF__CommonUtils__ConstrainPointToOrtho(x1, y1, raw.x, raw.y, e.shiftKey); // <-- Constrain if Shift held
            this.currentLine.setAttribute('x2', pt.x); // <-- Update end X
            this.currentLine.setAttribute('y2', pt.y); // <-- Update end Y
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
