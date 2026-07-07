// =============================================================================
// NOBLE CAD AUDIT TOOLS - SNAP ENGINE
// =============================================================================
//
// FILE      : Na__DimensionTools__SnapEngine__.js
// NAMESPACE : CadAuditTools.DimensionTools
// MODULE    : SnapEngine
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Spatial snap-point index — endpoint/midpoint/centre snapping
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Makes the dimension tools "forgiving": near-miss clicks land exactly on
//   entity endpoints, midpoints, and circle/arc centres.
// - Builds a uniform grid spatial hash of snap points on file:loaded so
//   queries stay fast even with 100k+ entities.
// - Na__SnapEngine__Query(dxfPoint, toleranceDxf) returns the nearest snap
//   point within tolerance, or null.
// - Renders the active snap marker (CAD-style glyph) into the annotation
//   layer: square = endpoint, triangle = midpoint, circle = centre.
// - All behaviour config-driven via Config__Dimensions.Snap__* keys.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Initial implementation.
//
// =============================================================================

import { Na__Geom__GetEntitySnapPoints } from '../03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js';

const _SVG_NS = 'http://www.w3.org/2000/svg';


// -----------------------------------------------------------------------------
// REGION | SnapEngine Class
// -----------------------------------------------------------------------------

    export class Na__DimensionTools__SnapEngine {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._cadCanvas = cadCanvas;

            this._grid      = new Map();                                 // <-- "i,j" cell key → snap point array
            this._cellSize  = 1;                                         // <-- Grid cell edge in drawing units
            this._markerEl  = null;                                      // <-- Active snap marker SVG element

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('file:loaded', () => {
                this.Na__SnapEngine__BuildIndex();                       // <-- Index once per file
            });
            this._eventBus.on('file:cleared', () => {
                this._grid = new Map();
                this.Na__SnapEngine__HideMarker();
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Build the Spatial Hash from All Entity Snap Points
        // ------------------------------------------------------------
        Na__SnapEngine__BuildIndex() {
            const config = this._snapConfig();
            this._grid   = new Map();
            if (!config.enabled) return;

            const entities = this._appState.entities || [];

            // Derive cell size from overall drawing extent (~150 cells across)
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let count = 0;

            const allSnaps = [];
            entities.forEach((entity) => {
                const snaps = Na__Geom__GetEntitySnapPoints(entity);
                snaps.forEach((s) => {
                    if (s.kind === 'endpoint' && !config.endpoint) return;
                    if (s.kind === 'midpoint' && !config.midpoint) return;
                    if (s.kind === 'center'   && !config.center)   return;
                    allSnaps.push(s);
                    if (s.x < minX) minX = s.x;
                    if (s.y < minY) minY = s.y;
                    if (s.x > maxX) maxX = s.x;
                    if (s.y > maxY) maxY = s.y;
                    count++;
                });
            });

            if (count === 0) return;

            const extent   = Math.max(maxX - minX, maxY - minY) || 1;
            this._cellSize = extent / 150;                               // <-- ~150x150 grid over the drawing

            allSnaps.forEach((s) => {
                const key = this._cellKey(s.x, s.y);
                if (!this._grid.has(key)) this._grid.set(key, []);
                this._grid.get(key).push(s);
            });

            console.log(`[Na__SnapEngine] Indexed ${count} snap points (cell ${this._cellSize.toFixed(2)}u)`);
        }
        // ------------------------------------------------------------


        // FUNCTION | Query the Nearest Snap Point Within Tolerance
        // ------------------------------------------------------------
        Na__SnapEngine__Query(dxfPoint, toleranceDxf) {
            if (this._grid.size === 0) return null;

            const cellRange = Math.max(1, Math.ceil(toleranceDxf / this._cellSize));
            const ci = Math.floor(dxfPoint.x / this._cellSize);
            const cj = Math.floor(dxfPoint.y / this._cellSize);

            let best     = null;
            let bestDist = toleranceDxf;

            for (let i = ci - cellRange; i <= ci + cellRange; i++) {
                for (let j = cj - cellRange; j <= cj + cellRange; j++) {
                    const bucket = this._grid.get(`${i},${j}`);
                    if (!bucket) continue;
                    bucket.forEach((s) => {
                        const d = Math.hypot(s.x - dxfPoint.x, s.y - dxfPoint.y);
                        if (d <= bestDist) {
                            bestDist = d;
                            best     = s;
                        }
                    });
                }
            }
            return best;                                                 // <-- { x, y, kind } or null
        }
        // ------------------------------------------------------------


        // FUNCTION | Snap a Cursor Point — Returns Snapped Point + Marker Update
        // ------------------------------------------------------------
        Na__SnapEngine__SnapCursor(dxfPoint) {
            const config = this._snapConfig();
            if (!config.enabled) {
                this.Na__SnapEngine__HideMarker();
                return { point: dxfPoint, snapped: false };
            }

            const scale        = this._appState.viewTransform?.scale || 1;
            const toleranceDxf = config.tolerancePx / scale;             // <-- Screen tolerance → drawing units
            const snap         = this.Na__SnapEngine__Query(dxfPoint, toleranceDxf);

            if (!snap) {
                this.Na__SnapEngine__HideMarker();
                return { point: dxfPoint, snapped: false };
            }

            this._showMarker(snap, scale, config.markerColor);
            return { point: { x: snap.x, y: snap.y }, snapped: true, kind: snap.kind };
        }
        // ------------------------------------------------------------


        // FUNCTION | Hide the Snap Marker
        // ------------------------------------------------------------
        Na__SnapEngine__HideMarker() {
            if (this._markerEl) {
                this._markerEl.remove();
                this._markerEl = null;
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Render the Snap Marker Glyph at a Snap Point
        // ------------------------------------------------------------
        _showMarker(snap, scale, color) {
            const annoLayer = this._cadCanvas.Na__CadCanvas__GetAnnotationLayer();
            if (!annoLayer) return;

            this.Na__SnapEngine__HideMarker();

            const s  = 7 / scale;                                        // <-- Half-size: constant ~14px on screen
            const el = document.createElementNS(_SVG_NS, snap.kind === 'center' ? 'circle' : 'polygon');

            if (snap.kind === 'center') {
                el.setAttribute('cx', snap.x);
                el.setAttribute('cy', snap.y);
                el.setAttribute('r',  s);
            } else if (snap.kind === 'midpoint') {
                el.setAttribute('points',                                 // <-- Triangle glyph
                    `${snap.x},${snap.y + s} ${snap.x - s},${snap.y - s} ${snap.x + s},${snap.y - s}`);
            } else {
                el.setAttribute('points',                                 // <-- Square glyph
                    `${snap.x - s},${snap.y - s} ${snap.x + s},${snap.y - s} ${snap.x + s},${snap.y + s} ${snap.x - s},${snap.y + s}`);
            }

            el.setAttribute('fill',           'none');
            el.setAttribute('stroke',         color);
            el.setAttribute('stroke-width',   '1.5');
            el.setAttribute('vector-effect',  'non-scaling-stroke');
            el.classList.add('na-snap-marker');

            annoLayer.appendChild(el);
            this._markerEl = el;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Grid Cell Key for a Coordinate
        // ------------------------------------------------------------
        _cellKey(x, y) {
            return `${Math.floor(x / this._cellSize)},${Math.floor(y / this._cellSize)}`;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Read Snap Config with Fallback Defaults
        // ------------------------------------------------------------
        _snapConfig() {
            const cfg = this._appState.config?.Config__Dimensions || {};
            return {
                enabled     : cfg.Snap__Enabled          !== false,
                tolerancePx : cfg.Snap__Tolerance_px     ?? 12,
                endpoint    : cfg.Snap__EndpointEnabled  !== false,
                midpoint    : cfg.Snap__MidpointEnabled  !== false,
                center      : cfg.Snap__CenterEnabled    !== false,
                markerColor : cfg.Snap__MarkerColor      ?? '#69db7c',
            };
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
