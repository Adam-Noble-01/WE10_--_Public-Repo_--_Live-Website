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
// - Holding Shift constrains each new segment to the nearest orthogonal axis
//   from the most recently committed point, producing H/V stair-step paths.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.1.0
// - Shift key orthogonal axis lock added to mousemove path extension.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


import { VF__CommonUtils__ConstrainPointToOrtho } from '../03__CommonUtils/VF__CommonUtils__OrthoConstraint__.js';

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
            const raw    = this.svgCanvas.getSVGPoint(e);
            const anchor = this.points[this.points.length - 1]; // <-- Last point — ortho anchor for new segment
            const pt     = VF__CommonUtils__ConstrainPointToOrtho(anchor.x, anchor.y, raw.x, raw.y, e.shiftKey); // <-- Constrain if Shift held

            if (e.shiftKey && this.points.length >= 2) {
                // Avoid accumulating collinear vertices: replace last point if new segment is on same axis
                const prev   = this.points[this.points.length - 2];
                const last   = this.points[this.points.length - 1];
                const sameH  = (Math.abs(last.y - prev.y) < 0.01 && Math.abs(pt.y - prev.y) < 0.01); // <-- Both on same horizontal
                const sameV  = (Math.abs(last.x - prev.x) < 0.01 && Math.abs(pt.x - prev.x) < 0.01); // <-- Both on same vertical
                if (sameH || sameV) {
                    this.points[this.points.length - 1] = pt; // <-- Extend existing segment
                } else {
                    this.points.push(pt); // <-- Axis changed — start new segment
                }
            } else {
                this.points.push(pt); // <-- Freehand: accumulate all positions; or first point in ortho mode
            }

            let d = `M ${this.points[0].x} ${this.points[0].y}`;
            for (let i = 1; i < this.points.length; i++) {
                d += ` L ${this.points[i].x} ${this.points[i].y}`; // <-- Append lineto for each point
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
