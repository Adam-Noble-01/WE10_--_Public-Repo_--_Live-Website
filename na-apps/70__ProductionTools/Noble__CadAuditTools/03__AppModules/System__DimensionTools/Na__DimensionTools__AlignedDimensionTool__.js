// =============================================================================
// NOBLE CAD AUDIT TOOLS - ALIGNED DIMENSION TOOL
// =============================================================================
//
// FILE      : Na__DimensionTools__AlignedDimensionTool__.js
// NAMESPACE : CadAuditTools.DimensionTools
// MODULE    : AlignedDimensionTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Free vector-to-vector aligned dimensions — any angle, 3-click flow
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Measures the TRUE distance between any two points at any angle:
//     Click 1 — first measure point   (snap-assisted)
//     Click 2 — second measure point  (snap-assisted, live length readout)
//     Move    — dimension line stays parallel to p1→p2, following the cursor's
//               perpendicular offset (either side of the measured line)
//     Click 3 — places the dimension line.
// - Escape cancels at any stage; switching tools cancels too.
// - Snapping via Na__DimensionTools__SnapEngine__ (endpoint/midpoint/centre).
// - Preview + commit rendering delegated to Na__DimensionTools__DimensionRenderer__.
// - Emits "dimension:commit" — renderer stores it and UndoManager records it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | AlignedDimensionTool Class
// -----------------------------------------------------------------------------

    export class Na__DimensionTools__AlignedDimensionTool {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, snapEngine, dimensionRenderer) {
            this._appState   = appState;
            this._eventBus   = eventBus;
            this._snapEngine = snapEngine;
            this._renderer   = dimensionRenderer;

            this._stage = 'idle';                                        // <-- idle | await-p2 | await-place
            this._p1    = null;
            this._p2    = null;

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('canvas:pointer-down', (e) => this._onPointerDown(e));
            this._eventBus.on('canvas:pointer-move', (e) => this._onPointerMove(e));
            this._eventBus.on('hotkey:edit:deselect', () => this._cancel());     // <-- Escape cancels
            this._eventBus.on('tool:changed', ({ tool }) => {
                if (tool !== 'dim-aligned') this._cancel();              // <-- Leaving the tool cancels
            });
            this._eventBus.on('file:cleared', () => this._cancel());
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Down — Advance the 3-Click Flow
        // ------------------------------------------------------------
        _onPointerDown({ dxf }) {
            if (this._appState.activeTool !== 'dim-aligned') return;

            const { point } = this._snapEngine.Na__SnapEngine__SnapCursor(dxf); // <-- Forgiving: snap wins

            if (this._stage === 'idle') {
                this._p1    = point;
                this._stage = 'await-p2';
                this._emitHint('Aligned dimension — pick the second point');
                return;
            }

            if (this._stage === 'await-p2') {
                if (point.x === this._p1.x && point.y === this._p1.y) return; // <-- Ignore zero-length
                this._p2    = point;
                this._stage = 'await-place';
                this._emitHint('Move to offset the dimension line — click to place');
                return;
            }

            if (this._stage === 'await-place') {
                const dim = this._buildDimension(dxf);                   // <-- Placement uses raw cursor
                this._renderer.Na__DimensionRenderer__RenderPreview(null);
                this._eventBus.emit('dimension:commit', { dimension: dim });
                this._reset();
                this._emitHint('Aligned dimension — pick the first point');
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Move — Snap Marker and Live Preview
        // ------------------------------------------------------------
        _onPointerMove({ dxf }) {
            if (this._appState.activeTool !== 'dim-aligned') return;

            if (this._stage === 'idle') {
                this._snapEngine.Na__SnapEngine__SnapCursor(dxf);        // <-- Show snap marker while hunting
                return;
            }

            if (this._stage === 'await-p2') {
                const { point } = this._snapEngine.Na__SnapEngine__SnapCursor(dxf);
                this._renderer.Na__DimensionRenderer__RenderPreview({
                    type   : 'aligned',
                    p1     : this._p1,
                    p2     : point,
                    offset : 0,                                          // <-- Zero offset = live length readout
                });
                return;
            }

            if (this._stage === 'await-place') {
                this._snapEngine.Na__SnapEngine__HideMarker();           // <-- Placement is free — no snap
                this._renderer.Na__DimensionRenderer__RenderPreview(this._buildDimension(dxf));
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Build the Dimension Record from the Placement Cursor
        // ------------------------------------------------------------
        _buildDimension(cursor) {
            // Signed perpendicular distance of the cursor from the p1→p2 line
            const dx  = this._p2.x - this._p1.x;
            const dy  = this._p2.y - this._p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx  = -dy / len;                                       // <-- Unit normal
            const ny  =  dx / len;
            const offset = (cursor.x - this._p1.x) * nx + (cursor.y - this._p1.y) * ny;

            return {
                type   : 'aligned',
                p1     : { ...this._p1 },
                p2     : { ...this._p2 },
                offset : offset,                                         // <-- Which side + how far
            };
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Cancel the In-Progress Dimension
        // ------------------------------------------------------------
        _cancel() {
            if (this._stage === 'idle') return;
            this._renderer.Na__DimensionRenderer__RenderPreview(null);
            this._snapEngine.Na__SnapEngine__HideMarker();
            this._reset();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Reset the Tool FSM
        // ------------------------------------------------------------
        _reset() {
            this._stage = 'idle';
            this._p1    = null;
            this._p2    = null;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Emit a Status Bar Hint
        // ------------------------------------------------------------
        _emitHint(text) {
            this._eventBus.emit('status:hint', { text });
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
