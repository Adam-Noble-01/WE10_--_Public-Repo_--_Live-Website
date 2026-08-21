// =============================================================================
// NOBLE CAD AUDIT TOOLS - BOX SELECT TOOL
// =============================================================================
//
// FILE      : Na__SelectionTools__BoxSelectTool__.js
// NAMESPACE : CadAuditTools.SelectionTools
// MODULE    : BoxSelectTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Unified Select tool — click select + directional box select
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - THE default tool. One tool, three behaviours (AutoCAD convention):
//     Click (tiny drag)     — select topmost entity under cursor; Shift toggles.
//     Drag Left → Right     — WINDOW select (blue) — fully enclosed entities only.
//     Drag Right → Left     — CROSSING select (green) — anything touched.
// - Mode is decided live during the drag from the X direction, so the rubber
//   band recolours as you cross back over the start point — exactly as AutoCAD.
// - Hit testing runs in DXF model space with PRECISE geometry tests
//   (segment-level, not bounding-box only) via Na__CommonUtils__GeometryHelpers__.
// - INSERT block references select as one unit via parentHandle.
// - Rubber band drawn in the screen-space overlay SVG from CadCanvas.
// - Colours/dash patterns and click tolerance are config-driven
//   (Config__BoxSelect + Controls__Mouse).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Unified select tool: click select + live directional window/crossing box.
// - Precise segment-level crossing tests; DXF-space hit testing (Y-flip fixed).
// - Shift add/toggle selection support.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — rubber-band overlay wired, bbox hit test.
//
// =============================================================================

import {
    Na__Geom__NormaliseRect,
    Na__Geom__EntityInRect,
    Na__Geom__EntityIntersectsRect,
} from '../03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js';

const _SVG_NS = 'http://www.w3.org/2000/svg';


// -----------------------------------------------------------------------------
// REGION | BoxSelectTool Class
// -----------------------------------------------------------------------------

    export class Na__SelectionTools__BoxSelectTool {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas, selectionManager) {
            this._appState         = appState;
            this._eventBus         = eventBus;
            this._cadCanvas        = cadCanvas;
            this._selectionManager = selectionManager;

            this._isActive    = false;                                   // <-- True while drag is in progress
            this._startScreen = { x: 0, y: 0 };                          // <-- Drag start (screen px)
            this._startDxf    = { x: 0, y: 0 };                          // <-- Drag start (DXF space)
            this._endScreen   = { x: 0, y: 0 };
            this._endDxf      = { x: 0, y: 0 };
            this._shiftKey    = false;

            this._rectEl      = null;                                    // <-- Rubber-band SVG rect (overlay)

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners for Canvas Pointer Events
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('canvas:pointer-down', (e) => this._onPointerDown(e));
            this._eventBus.on('canvas:pointer-move', (e) => this._onPointerMove(e));
            this._eventBus.on('canvas:pointer-up',   (e) => this._onPointerUp(e));
            this._eventBus.on('file:cleared', () => {
                this._hideRubberBand();
                this._isActive = false;
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Down — Begin Potential Click or Box Drag
        // ------------------------------------------------------------
        _onPointerDown({ screen, dxf, shiftKey }) {
            if (this._appState.activeTool !== 'select') return;

            this._isActive    = true;
            this._startScreen = { ...screen };
            this._startDxf    = { ...dxf };
            this._endScreen   = { ...screen };
            this._endDxf      = { ...dxf };
            this._shiftKey    = shiftKey;
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Move — Update Rubber Band Live
        // ------------------------------------------------------------
        _onPointerMove({ screen, dxf, isDown }) {
            if (!this._isActive || !isDown) return;

            this._endScreen = { ...screen };
            this._endDxf    = { ...dxf };

            if (this._dragDistance() >= this._minDragPx()) {
                this._updateRubberBand();                                // <-- Live window/crossing recolour
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Up — Click Select or Box Select Commit
        // ------------------------------------------------------------
        _onPointerUp({ screen, dxf, shiftKey }) {
            if (!this._isActive) return;
            this._isActive  = false;
            this._endScreen = { ...screen };
            this._endDxf    = { ...dxf };
            this._hideRubberBand();

            const useShift = this._shiftKey || shiftKey;

            // CLICK SELECT — drag below threshold
            if (this._dragDistance() < this._minDragPx()) {
                this._runClickSelect(dxf, useShift);
                return;
            }

            // BOX SELECT — mode from horizontal drag direction
            const mode    = this._currentMode();
            const selRect = Na__Geom__NormaliseRect(
                this._startDxf.x, this._startDxf.y,
                this._endDxf.x,   this._endDxf.y
            );

            const matchedUnits = this._runBoxHitTest(selRect, mode);
            this._eventBus.emit('selection:box-complete', {
                unitHandles : matchedUnits,
                additive    : useShift,                                  // <-- Shift extends the selection
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Click Select — Topmost Entity Within Tolerance
        // ------------------------------------------------------------
        _runClickSelect(dxfPoint, additive) {
            const tolerancePx = this._appState.controls?.Controls__Mouse?.Click__SelectTolerance_px ?? 4;
            const scale       = this._appState.viewTransform?.scale || 1;
            const tolerance   = (tolerancePx + 4) / scale;               // <-- Screen tolerance → drawing units

            const hitUnit = this._cadCanvas.Na__CadCanvas__HitTestPoint(dxfPoint, tolerance);

            this._eventBus.emit('selection:click', {
                unitHandle : hitUnit,                                    // <-- null = clicked empty space
                additive,
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Box Hit Test — Precise Window/Crossing Against All Units
        // ------------------------------------------------------------
        _runBoxHitTest(selRect, mode) {
            const entities = this._appState.entities;
            const deleted  = this._appState.deletedHandles;
            const layers   = this._appState.layers;
            if (!entities || entities.length === 0) return [];

            const windowMatched   = new Set();                           // <-- Units with every part inside
            const windowRejected  = new Set();                           // <-- Units with any part outside
            const crossingMatched = new Set();

            // SPATIAL INDEX — narrow to entities near the selection rectangle.
            // Window mode then widens to WHOLE units, because a unit is only
            // enclosed if none of its parts sits outside — including the parts
            // the rectangle never touched.
            const index = this._appState.spatialIndex;
            let scanSet = index ? index.Na__SpatialIndex__QueryRect(selRect) : null;
            if (scanSet && mode === 'window') {
                scanSet = index.Na__SpatialIndex__ExpandToWholeUnits(scanSet);
            }

            (scanSet || entities).forEach((entity) => {
                const unitHandle = entity.parentHandle || entity.handle;
                if (deleted.has(unitHandle)) return;                     // <-- Skip deleted units
                if (entity.type === 'INSERT' && (entity.childCount || 0) > 0) return; // <-- Parent tested via children

                const layerData = layers.get(entity.layer);
                if (layerData && layerData.visible === false) return;   // <-- Skip hidden layers

                if (mode === 'window') {
                    // Whole unit must be enclosed — any child outside rejects the unit
                    if (Na__Geom__EntityInRect(entity, selRect)) {
                        windowMatched.add(unitHandle);
                    } else {
                        windowRejected.add(unitHandle);
                    }
                } else {
                    if (Na__Geom__EntityIntersectsRect(entity, selRect)) {
                        crossingMatched.add(unitHandle);
                    }
                }
            });

            const matched = mode === 'window'
                ? [...windowMatched].filter((h) => !windowRejected.has(h))
                : [...crossingMatched];

            console.log(`[Na__BoxSelectTool] ${mode} select: ${matched.length} units matched`);
            return matched;
        }
        // ------------------------------------------------------------


        // FUNCTION | Update the Rubber-Band Rect in the Overlay SVG
        // ------------------------------------------------------------
        _updateRubberBand() {
            const overlay = this._cadCanvas.Na__CadCanvas__GetOverlaySvg();
            if (!overlay) return;

            if (!this._rectEl) {
                this._rectEl = document.createElementNS(_SVG_NS, 'rect');
                this._rectEl.classList.add('na-box-select-rect');
                overlay.appendChild(this._rectEl);
            }

            const containerRect = overlay.getBoundingClientRect();
            const x1 = this._startScreen.x - containerRect.left;
            const y1 = this._startScreen.y - containerRect.top;
            const x2 = this._endScreen.x   - containerRect.left;
            const y2 = this._endScreen.y   - containerRect.top;

            this._rectEl.setAttribute('x',      Math.min(x1, x2));
            this._rectEl.setAttribute('y',      Math.min(y1, y2));
            this._rectEl.setAttribute('width',  Math.abs(x2 - x1));
            this._rectEl.setAttribute('height', Math.abs(y2 - y1));

            const cfg      = this._appState.config?.Config__BoxSelect || {};
            const isWindow = this._currentMode() === 'window';

            this._rectEl.setAttribute('fill',             isWindow ? (cfg.Window__Fill   ?? 'rgba(77,171,247,0.08)') : (cfg.Crossing__Fill   ?? 'rgba(105,219,124,0.08)'));
            this._rectEl.setAttribute('stroke',           isWindow ? (cfg.Window__Stroke ?? '#4dabf7')               : (cfg.Crossing__Stroke ?? '#69db7c'));
            this._rectEl.setAttribute('stroke-dasharray', isWindow ? (cfg.Window__StrokeDashArray ?? '6 3')          : (cfg.Crossing__StrokeDashArray ?? '3 3'));
            this._rectEl.style.display = '';
        }
        // ------------------------------------------------------------


        // FUNCTION | Hide the Rubber-Band Rectangle
        // ------------------------------------------------------------
        _hideRubberBand() {
            if (this._rectEl) this._rectEl.style.display = 'none';
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Current Mode from Drag Direction (Live)
        // ------------------------------------------------------------
        _currentMode() {
            const convention = this._appState.controls?.Controls__BoxSelectConvention || {};
            const l2r        = convention.LeftToRight__Mode ?? 'window';
            const r2l        = convention.RightToLeft__Mode ?? 'crossing';
            return (this._endScreen.x - this._startScreen.x) >= 0 ? l2r : r2l;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Screen-Space Drag Distance in Pixels
        // ------------------------------------------------------------
        _dragDistance() {
            return Math.hypot(
                this._endScreen.x - this._startScreen.x,
                this._endScreen.y - this._startScreen.y
            );
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Minimum Pixel Drag Before Box Select Engages
        // ------------------------------------------------------------
        _minDragPx() {
            return this._appState.controls?.Controls__Mouse?.Drag__MinBoxSelectDistance_px ?? 4;
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
