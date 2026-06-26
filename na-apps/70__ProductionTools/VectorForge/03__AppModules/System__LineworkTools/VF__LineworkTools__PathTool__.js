// =============================================================================
// VECTORFORGE - PATH TOOL
// =============================================================================
//
// FILE      : VF__LineworkTools__PathTool__.js
// NAMESPACE : VectorForge.LineworkTools
// MODULE    : PathTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Freehand path drawing tool — mousedown starts, mousemove extends, mouseup commits
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Mousedown begins a new <path> element with an M (moveto) command at the
//   cursor position.
// - Each mousemove event while drawing appends an L (lineto) to the path's d
//   attribute, building a freehand polyline in real time.
// - Mouseup commits the path and resets draw state.
// - Deactivation also clears any in-progress path and the accumulated points.
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
// REGION | PathTool Class
// -----------------------------------------------------------------------------

    // CLASS | PathTool — Freehand Path Drawing Tool
    // ------------------------------------------------------------
    export class PathTool {

        // FUNCTION | Constructor — Attach Mouse Listeners to SVG Canvas
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState     = appState;   // <-- App state reference
            this.svgCanvas    = svgCanvas;  // <-- SVG canvas reference
            this.active       = false;      // <-- Tool active flag
            this.drawing      = false;      // <-- Mid-draw flag
            this.currentPath  = null;       // <-- In-progress SVG path element
            this.points       = [];         // <-- Accumulated path points

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
            this.currentPath = null;
            this.points      = [];
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseDown — Start a New Path at the Cursor Position
        // ------------------------------------------------------------
        _onMouseDown(e) {
            if (!this.active || e.button !== 0) return;
            const pt     = this.svgCanvas.getSVGPoint(e);
            this.drawing = true;
            this.points  = [pt];

            this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.currentPath.setAttribute('d',            `M ${pt.x} ${pt.y}`);
            this.currentPath.setAttribute('fill',         'none');
            this.currentPath.setAttribute('stroke',       '#000000');
            this.currentPath.setAttribute('stroke-width', '2');
            this.currentPath.dataset.originalStroke = '#000000'; // <-- Cache for selection manager
            this.svgCanvas.addElement(this.currentPath);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseMove — Extend Path with Each Cursor Position
        // ------------------------------------------------------------
        _onMouseMove(e) {
            if (!this.active || !this.drawing || !this.currentPath) return;
            const pt = this.svgCanvas.getSVGPoint(e);
            this.points.push(pt);

            let d = `M ${this.points[0].x} ${this.points[0].y}`;
            for (let i = 1; i < this.points.length; i++) {
                d += ` L ${this.points[i].x} ${this.points[i].y}`; // <-- Append lineto for each new point
            }
            this.currentPath.setAttribute('d', d);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnMouseUp — Commit the Path and Reset Draw State
        // ------------------------------------------------------------
        _onMouseUp(e) {
            if (!this.active || !this.drawing || e.button !== 0) return;
            this.drawing     = false;
            this.currentPath = null;
            this.points      = [];
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
