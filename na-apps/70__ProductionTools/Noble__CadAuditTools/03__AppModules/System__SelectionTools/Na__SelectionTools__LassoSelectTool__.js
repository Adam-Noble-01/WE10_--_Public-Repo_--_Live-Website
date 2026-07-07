// =============================================================================
// NOBLE CAD AUDIT TOOLS - LASSO SELECT TOOL
// =============================================================================
//
// FILE      : Na__SelectionTools__LassoSelectTool__.js
// NAMESPACE : CadAuditTools.SelectionTools
// MODULE    : LassoSelectTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Freehand lasso selection with Window and Crossing modes
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Freehand polygon selection — drag to sketch any shape around geometry.
// - Follows the SAME direction convention as box select (AutoCAD lasso):
//     Drag starts moving Left → Right  = WINDOW  (blue)  — fully inside only.
//     Drag starts moving Right → Left  = CROSSING (green) — anything touched.
//   Direction is sampled from net X movement, recolouring live as you draw.
// - Points are decimated to Path__MinPointDistance_px so huge sweeps stay fast.
// - Hit testing runs in DXF space with precise polygon tests:
//     Window   — every entity segment fully inside the lasso polygon.
//     Crossing — any entity segment touching or inside the polygon.
// - Lasso path drawn in the screen-space overlay SVG; polygon auto-closes.
// - Colours configurable via Config__LassoSelect.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Initial implementation.
//
// =============================================================================

import {
    Na__Geom__EntityInPolygon,
    Na__Geom__EntityIntersectsPolygon,
} from '../03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js';

const _SVG_NS = 'http://www.w3.org/2000/svg';


// -----------------------------------------------------------------------------
// REGION | LassoSelectTool Class
// -----------------------------------------------------------------------------

    export class Na__SelectionTools__LassoSelectTool {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas, selectionManager) {
            this._appState         = appState;
            this._eventBus         = eventBus;
            this._cadCanvas        = cadCanvas;
            this._selectionManager = selectionManager;

            this._isActive     = false;
            this._screenPoints = [];                                     // <-- Lasso path (screen px, overlay space)
            this._dxfPoints    = [];                                     // <-- Lasso path (DXF space, for hit test)
            this._shiftKey     = false;

            this._pathEl       = null;                                   // <-- Overlay SVG polygon element

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
                this._resetPath();
                this._isActive = false;
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Down — Begin Lasso Path
        // ------------------------------------------------------------
        _onPointerDown({ screen, dxf, shiftKey }) {
            if (this._appState.activeTool !== 'lasso') return;

            this._isActive     = true;
            this._shiftKey     = shiftKey;
            this._screenPoints = [{ ...screen }];
            this._dxfPoints    = [{ ...dxf }];
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Move — Extend Lasso Path
        // ------------------------------------------------------------
        _onPointerMove({ screen, dxf, isDown }) {
            if (!this._isActive || !isDown) return;

            const minDist = this._appState.config?.Config__LassoSelect?.Path__MinPointDistance_px ?? 3;
            const last    = this._screenPoints[this._screenPoints.length - 1];

            if (Math.hypot(screen.x - last.x, screen.y - last.y) < minDist) return; // <-- Decimate dense points

            this._screenPoints.push({ ...screen });
            this._dxfPoints.push({ ...dxf });
            this._updateLassoPath();
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pointer Up — Close Polygon and Run Hit Test
        // ------------------------------------------------------------
        _onPointerUp({ shiftKey }) {
            if (!this._isActive) return;
            this._isActive = false;

            const polygon = this._dxfPoints;
            const mode    = this._currentMode();
            this._resetPath();

            if (polygon.length < 3) return;                              // <-- Not enough points for a polygon

            const matchedUnits = this._runLassoHitTest(polygon, mode);
            this._eventBus.emit('selection:box-complete', {
                unitHandles : matchedUnits,
                additive    : this._shiftKey || shiftKey,
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Lasso Hit Test — Window/Crossing Against All Units
        // ------------------------------------------------------------
        _runLassoHitTest(polygon, mode) {
            const entities = this._appState.entities;
            const deleted  = this._appState.deletedHandles;
            const layers   = this._appState.layers;
            if (!entities || entities.length === 0) return [];

            // Polygon bbox for cheap rejection inside the entity tests
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygon.forEach((p) => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
            const polyBBox = { minX, minY, maxX, maxY };

            const windowMatched   = new Set();
            const windowRejected  = new Set();
            const crossingMatched = new Set();

            entities.forEach((entity) => {
                const unitHandle = entity.parentHandle || entity.handle;
                if (deleted.has(unitHandle)) return;
                if (entity.type === 'INSERT' && (entity.childCount || 0) > 0) return; // <-- Parent tested via children

                const layerData = layers.get(entity.layer);
                if (layerData && layerData.visible === false) return;   // <-- Skip hidden layers

                if (mode === 'window') {
                    if (Na__Geom__EntityInPolygon(entity, polygon, polyBBox)) {
                        windowMatched.add(unitHandle);
                    } else {
                        windowRejected.add(unitHandle);
                    }
                } else {
                    if (Na__Geom__EntityIntersectsPolygon(entity, polygon, polyBBox)) {
                        crossingMatched.add(unitHandle);
                    }
                }
            });

            const matched = mode === 'window'
                ? [...windowMatched].filter((h) => !windowRejected.has(h))
                : [...crossingMatched];

            console.log(`[Na__LassoSelectTool] ${mode} lasso: ${matched.length} units matched`);
            return matched;
        }
        // ------------------------------------------------------------


        // FUNCTION | Draw the Live Lasso Polygon in the Overlay SVG
        // ------------------------------------------------------------
        _updateLassoPath() {
            const overlay = this._cadCanvas.Na__CadCanvas__GetOverlaySvg();
            if (!overlay) return;

            if (!this._pathEl) {
                this._pathEl = document.createElementNS(_SVG_NS, 'polygon');
                this._pathEl.classList.add('na-lasso-path');
                overlay.appendChild(this._pathEl);
            }

            const rect = overlay.getBoundingClientRect();
            const pts  = this._screenPoints
                .map((p) => `${p.x - rect.left},${p.y - rect.top}`)
                .join(' ');

            const cfg      = this._appState.config?.Config__LassoSelect || {};
            const isWindow = this._currentMode() === 'window';

            this._pathEl.setAttribute('points',           pts);
            this._pathEl.setAttribute('fill',             isWindow ? (cfg.Window__Fill   ?? 'rgba(77,171,247,0.08)') : (cfg.Crossing__Fill   ?? 'rgba(105,219,124,0.08)'));
            this._pathEl.setAttribute('stroke',           isWindow ? (cfg.Window__Stroke ?? '#4dabf7')               : (cfg.Crossing__Stroke ?? '#69db7c'));
            this._pathEl.setAttribute('stroke-dasharray', cfg.Path__StrokeDashArray ?? '4 3');
            this._pathEl.style.display = '';
        }
        // ------------------------------------------------------------


        // FUNCTION | Remove the Lasso Path from the Overlay
        // ------------------------------------------------------------
        _resetPath() {
            if (this._pathEl) {
                this._pathEl.remove();
                this._pathEl = null;
            }
            this._screenPoints = [];
            this._dxfPoints    = [];
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Current Mode from Net Horizontal Drag Direction
        // ------------------------------------------------------------
        _currentMode() {
            if (this._screenPoints.length < 2) return 'window';
            const convention = this._appState.controls?.Controls__BoxSelectConvention || {};
            const l2r        = convention.LeftToRight__Mode ?? 'window';
            const r2l        = convention.RightToLeft__Mode ?? 'crossing';
            const first      = this._screenPoints[0];
            const last       = this._screenPoints[this._screenPoints.length - 1];
            return (last.x - first.x) >= 0 ? l2r : r2l;
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
