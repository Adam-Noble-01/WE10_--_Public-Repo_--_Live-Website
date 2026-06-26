// =============================================================================
// VECTORFORGE - RECTANGLE TOOL
// =============================================================================
//
// FILE      : VF__LineworkTools__RectangleTool__.js
// NAMESPACE : VectorForge.LineworkTools
// MODULE    : RectangleTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Click-drag rectangle drawing tool with Shift-constrain to square
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Mousedown starts a new <rect> element at the cursor position.
// - Mouse drag resizes the rect in real time, supporting all four quadrant directions.
// - Holding Shift constrains the rect to a perfect square.
// - Mouseup commits the shape; zero-width rects are discarded automatically.
// - Respects AppState.snapToGrid via SVGCanvas.getSVGPoint.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | RectangleTool Class
// -----------------------------------------------------------------------------

    // CLASS | RectangleTool — Click-Drag Rectangle Drawing Tool
    // ------------------------------------------------------------
    export class RectangleTool {

        // FUNCTION | Constructor — Attach Mouse Listeners to SVG Canvas
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState     = appState;   // <-- App state reference
            this.svgCanvas    = svgCanvas;  // <-- SVG canvas reference
            this.active       = false;      // <-- Tool active flag
            this.drawing      = false;      // <-- Mid-draw flag
            this.currentRect  = null;       // <-- In-progress SVG rect element
            this.startX       = 0;          // <-- Anchor X on mousedown
            this.startY       = 0;          // <-- Anchor Y on mousedown

            this.svgCanvas.svg.addEventListener('mousedown', (e) => this._onMouseDown(e));
            this.svgCanvas.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));
            this.svgCanvas.svg.addEventListener('mouseup',   (e) => this._onMouseUp(e));
        }
        // ------------------------------------------------------------


        // FUNCTION | Activate — Enable the Tool
        // ------------------------------------------------------------
        activate() {
            this.active = true;
        }
        // ------------------------------------------------------------


        // FUNCTION | Deactivate — Disable the Tool and Clear Draw State
        // ------------------------------------------------------------
        deactivate() {
            this.active      = false;
            this.drawing     = false;
            this.currentRect = null;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseDown — Start a New Rect at the Cursor Position
        // ------------------------------------------------------------
        _onMouseDown(e) {
            if (!this.active || e.button !== 0) return;
            const pt     = this.svgCanvas.getSVGPoint(e);
            this.drawing = true;
            this.startX  = pt.x;
            this.startY  = pt.y;

            this.currentRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            this.currentRect.setAttribute('x',            pt.x);
            this.currentRect.setAttribute('y',            pt.y);
            this.currentRect.setAttribute('width',        0);
            this.currentRect.setAttribute('height',       0);
            this.currentRect.setAttribute('stroke',       '#000000');
            this.currentRect.setAttribute('stroke-width', '2');
            this.currentRect.setAttribute('fill',         'none');
            this.currentRect.dataset.originalStroke = '#000000'; // <-- Cache for selection manager
            this.svgCanvas.addElement(this.currentRect);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseMove — Resize Rect Live During Drag
        // ------------------------------------------------------------
        _onMouseMove(e) {
            if (!this.active || !this.drawing || !this.currentRect) return;
            const pt = this.svgCanvas.getSVGPoint(e);
            let   w  = pt.x - this.startX;
            let   h  = pt.y - this.startY;

            if (e.shiftKey) {
                const size = Math.max(Math.abs(w), Math.abs(h)); // <-- Constrain to square on Shift
                w = w < 0 ? -size : size;
                h = h < 0 ? -size : size;
            }

            this.currentRect.setAttribute('x',      w < 0 ? this.startX + w : this.startX); // <-- Handle negative drag X
            this.currentRect.setAttribute('y',      h < 0 ? this.startY + h : this.startY); // <-- Handle negative drag Y
            this.currentRect.setAttribute('width',  Math.abs(w));
            this.currentRect.setAttribute('height', Math.abs(h));
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseUp — Commit or Discard the Rect on Release
        // ------------------------------------------------------------
        _onMouseUp(e) {
            if (!this.active || !this.drawing) return;
            this.drawing = false;
            if (this.currentRect && this.currentRect.getAttribute('width') === '0') {
                this.currentRect.remove(); // <-- Discard zero-size rect
            }
            this.currentRect = null;
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
