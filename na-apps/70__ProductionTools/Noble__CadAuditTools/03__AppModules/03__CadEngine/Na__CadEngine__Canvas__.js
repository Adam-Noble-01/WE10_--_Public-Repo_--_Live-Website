// =============================================================================
// NOBLE CAD AUDIT TOOLS - CAD CANVAS
// =============================================================================
//
// FILE      : Na__CadEngine__Canvas__.js
// NAMESPACE : CadAuditTools.CadEngine
// MODULE    : Canvas
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Creates and manages the SVG drawing canvas and entity rendering
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Creates the main SVG element and appends it to #Na__App__CanvasContainer.
// - SVG STRUCTURE:
//     <svg>                              ← viewBox managed by ViewBoxController
//       <g class="na-flip">              ← scale(1,-1): DXF Y-up → SVG Y-down
//         <g class="na-entities-layer">  ← all CAD entities (raw DXF coords)
//         <g class="na-annotation-layer">← dimensions + snap markers
//       </g>
//     </svg>
//     <svg class="na-overlay-svg">       ← screen-space overlay (rubber band, lasso)
// - INSERT block references with exploded children render as a single <g>
//   carrying the parent handle — selecting/deleting works on the whole block.
// - POINTER ROUTING: emits generic canvas:pointer-down/move/up events carrying
//   both screen and DXF-space coordinates; active tools subscribe and act.
//   Pan (middle-drag always, left-drag in pan tool, Space temporary pan) is
//   handled here via the ViewBoxController.
// - LAYER VISIBILITY: responds to "layer:visibility-changed" by toggling
//   display on all elements tagged with that data-layer.
// - INCREMENTAL EDITS: Na__CadCanvas__AddEntities()/RemoveEntitiesByHandles()
//   let EntityPruner apply an undoable hard-delete without re-rendering the
//   whole drawing — critical for responsiveness on very large files.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.3
// - Extracted _buildEntityFragment() (shared by render/add) — new
//   Na__CadCanvas__AddEntities()/RemoveEntitiesByHandles() support the
//   EntityPruner's undoable hard-delete without a full re-render.
//
// 07-Jul-2026 - Version 0.3.0
// - Root flip group — renderers now use raw DXF coordinates (no per-Y negation).
// - Generic pointer routing for the tool system (select/lasso/dimensions).
// - Screen-space overlay SVG for selection visuals.
// - INSERT children grouped under parent handle; HATCH/SOLID renderers added.
// - Layer visibility toggling; Space temporary pan; hover highlight.
//
// 07-Jul-2026 - Version 0.2.0
// - Implemented full SVG entity rendering for all supported DXF types.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — event routing wired, entity rendering stubbed.
//
// =============================================================================

import { Na__Geom__DistancePointToEntity, Na__Geom__GetEntityBoundingBox } from '../03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js';

const _SVG_NS  = 'http://www.w3.org/2000/svg';                         // <-- SVG namespace constant


// -----------------------------------------------------------------------------
// REGION | Canvas Class
// -----------------------------------------------------------------------------

    export class Na__CadEngine__Canvas {

        // SUB FUNCTION | Constructor — Create SVG and Attach to DOM
        // ------------------------------------------------------------
        constructor(appState, eventBus, viewBoxController) {
            this._appState          = appState;
            this._eventBus          = eventBus;
            this._viewBoxController = viewBoxController;

            this._containerEl  = document.getElementById('Na__App__CanvasContainer');
            this._svgEl        = null;                                  // <-- Main drawing SVG
            this._flipGroup    = null;                                  // <-- scale(1,-1) DXF→SVG group
            this._entityLayer  = null;                                  // <-- CAD entity group
            this._annoLayer    = null;                                  // <-- Dimension/snap annotation group
            this._overlaySvgEl = null;                                  // <-- Screen-space overlay SVG

            this._isPointerDown  = false;
            this._pointerButton  = 0;
            this._isSpacePanning = false;                               // <-- Space bar temporary pan active
            this._hoverHandle    = null;                                // <-- Currently hover-highlighted unit handle

            this.Na__CadCanvas__Init();
            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Initialise the SVG Elements
        // ------------------------------------------------------------
        Na__CadCanvas__Init() {
            if (!this._containerEl) return;

            // MAIN DRAWING SVG
            this._svgEl = document.createElementNS(_SVG_NS, 'svg');
            this._svgEl.setAttribute('xmlns', _SVG_NS);
            this._svgEl.classList.add('na-cad-canvas');

            this._flipGroup = document.createElementNS(_SVG_NS, 'g');
            this._flipGroup.setAttribute('transform', 'scale(1,-1)');   // <-- DXF Y-up → screen Y-down
            this._flipGroup.classList.add('na-flip');

            this._entityLayer = document.createElementNS(_SVG_NS, 'g');
            this._entityLayer.classList.add('na-entities-layer');

            this._annoLayer = document.createElementNS(_SVG_NS, 'g');
            this._annoLayer.classList.add('na-annotation-layer');

            this._flipGroup.appendChild(this._entityLayer);
            this._flipGroup.appendChild(this._annoLayer);
            this._svgEl.appendChild(this._flipGroup);
            this._containerEl.appendChild(this._svgEl);                 // <-- Inject SVG into canvas container

            // SCREEN-SPACE OVERLAY SVG (rubber band, lasso path)
            this._overlaySvgEl = document.createElementNS(_SVG_NS, 'svg');
            this._overlaySvgEl.classList.add('na-overlay-svg');
            this._containerEl.appendChild(this._overlaySvgEl);

            this._bindPointerEvents();
            this._bindSpacePanKeys();

            // Pass SVG element to ViewBoxController so it can manage pan/zoom viewBox
            this._viewBoxController.Na__ViewBoxController__SetSvgEl(this._svgEl);
        }
        // ------------------------------------------------------------


        // FUNCTION | Element Accessors for Other Modules
        // ------------------------------------------------------------
        Na__CadCanvas__GetSvgRoot()         { return this._svgEl; }        // <-- Used by SelectionManager for DOM queries
        Na__CadCanvas__GetAnnotationLayer() { return this._annoLayer; }    // <-- Used by DimensionRenderer
        Na__CadCanvas__GetOverlaySvg()      { return this._overlaySvgEl; } // <-- Used by Box/Lasso select visuals
        // ------------------------------------------------------------


        // FUNCTION | Convert Client Coordinates to DXF Model Space
        // ------------------------------------------------------------
        Na__CadCanvas__ClientToDxf(clientX, clientY) {
            const svg = this._viewBoxController.Na__ViewBoxController__ScreenToSvg(clientX, clientY);
            return { x: svg.x, y: -svg.y };                              // <-- Undo the flip group: DXF Y = -SVG Y
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear All Entity Elements from the SVG
        // ------------------------------------------------------------
        Na__CadCanvas__Clear() {
            if (this._entityLayer) this._entityLayer.replaceChildren();
            if (this._annoLayer)   this._annoLayer.replaceChildren();
        }
        // ------------------------------------------------------------


        // FUNCTION | Render Entity Array as SVG Elements
        // ------------------------------------------------------------
        Na__CadCanvas__RenderEntities(entities) {
            if (!this._entityLayer || !entities || entities.length === 0) return;

            this._entityLayer.replaceChildren();
            this._entityLayer.appendChild(this._buildEntityFragment(entities));

            console.log(`[Na__CadCanvas] Rendered ${entities.length} entities`);
        }
        // ------------------------------------------------------------


        // FUNCTION | Append Entities to the Canvas (Hard-Delete Undo Restore)
        // ------------------------------------------------------------
        Na__CadCanvas__AddEntities(entities) {
            if (!this._entityLayer || !entities || entities.length === 0) return;
            this._entityLayer.appendChild(this._buildEntityFragment(entities));
        }
        // ------------------------------------------------------------


        // FUNCTION | Remove Entities from the Canvas by Unit Handle (Hard Delete)
        // ------------------------------------------------------------
        Na__CadCanvas__RemoveEntitiesByHandles(unitHandles) {
            if (!this._entityLayer || !unitHandles || unitHandles.length === 0) return;
            unitHandles.forEach((handle) => {
                const el = this._entityLayer.querySelector(`[data-handle="${CSS.escape(handle)}"]`);
                if (el) el.remove();                                     // <-- Removes the INSERT group (and children) or standalone entity
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Build a DocumentFragment of Entity Elements (Shared by Render/Add)
        // ------------------------------------------------------------
        _buildEntityFragment(entities) {
            const fragment     = document.createDocumentFragment();     // <-- Batch DOM insertion for performance
            const insertGroups = new Map();                              // <-- parentHandle → <g> element

            entities.forEach((entity) => {
                // INSERT PARENT — create the group container for its children
                if (entity.type === 'INSERT' && (entity.childCount || 0) > 0) {
                    const groupEl = document.createElementNS(_SVG_NS, 'g');
                    Na__CadCanvas__ApplyEntityAttributes(groupEl, entity);
                    insertGroups.set(entity.handle, groupEl);
                    fragment.appendChild(groupEl);
                    return;
                }

                const el = Na__CadCanvas__CreateEntityElement(entity);
                if (!el) return;

                // EXPLODED CHILD — append inside the parent INSERT group
                if (entity.parentHandle && insertGroups.has(entity.parentHandle)) {
                    el.setAttribute('data-layer', entity.layer);        // <-- Children keep own layer tag
                    insertGroups.get(entity.parentHandle).appendChild(el);
                    return;
                }

                Na__CadCanvas__ApplyEntityAttributes(el, entity);       // <-- Standalone entity
                fragment.appendChild(el);
            });

            return fragment;
        }
        // ------------------------------------------------------------


        // FUNCTION | Toggle Visibility of All Elements on a Layer
        // ------------------------------------------------------------
        Na__CadCanvas__SetLayerVisibility(layerName, visible) {
            if (!this._entityLayer) return;
            this._entityLayer.querySelectorAll(`[data-layer="${CSS.escape(layerName)}"]`).forEach((el) => {
                el.style.display = visible ? '' : 'none';                // <-- Hide/show without removing from DOM
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Hit Test a Point Against All Selectable Units (Click Select)
        // ------------------------------------------------------------
        Na__CadCanvas__HitTestPoint(dxfPoint, tolerance) {
            const entities = this._appState.entities;
            const deleted  = this._appState.deletedHandles;
            const layers   = this._appState.layers;

            let bestUnit = null;
            let bestDist = tolerance;

            // SPATIAL INDEX — only entities near the click are worth testing.
            // Falls back to the full entity array if the index is unavailable.
            const index      = this._appState.spatialIndex;
            const candidates = index
                ? index.Na__SpatialIndex__QueryPoint(dxfPoint.x, dxfPoint.y, tolerance)
                : null;

            for (const entity of (candidates || entities)) {
                const unitHandle = entity.parentHandle || entity.handle;
                if (deleted.has(unitHandle)) continue;                   // <-- Skip deleted units
                if (entity.type === 'INSERT' && (entity.childCount || 0) > 0) continue; // <-- Parent tested via children

                const layerData = layers.get(entity.layer);
                if (layerData && layerData.visible === false) continue; // <-- Skip hidden layers

                // Cheap bbox rejection expanded by tolerance
                const bbox = Na__Geom__GetEntityBoundingBox(entity);
                if (!bbox) continue;
                if (dxfPoint.x < bbox.minX - tolerance || dxfPoint.x > bbox.maxX + tolerance ||
                    dxfPoint.y < bbox.minY - tolerance || dxfPoint.y > bbox.maxY + tolerance) continue;

                const dist = Na__Geom__DistancePointToEntity(dxfPoint, entity);
                if (dist <= bestDist) {
                    bestDist = dist;
                    bestUnit = unitHandle;
                }
            }

            return bestUnit;                                             // <-- Unit handle string or null
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Pointer Events for Tool Routing and Cursor Tracking
        // ------------------------------------------------------------
        _bindPointerEvents() {
            if (!this._svgEl) return;

            this._svgEl.addEventListener('pointermove', (e) => {
                const dxf = this.Na__CadCanvas__ClientToDxf(e.clientX, e.clientY);
                this._eventBus.emit('cursor:moved', dxf);               // <-- Status bar coords in DXF space

                if (this._isPointerDown && this._isPanGesture()) {
                    this._viewBoxController.Na__ViewBoxController__OnDrag(e);
                    return;
                }

                this._eventBus.emit('canvas:pointer-move', {
                    screen : { x: e.clientX, y: e.clientY },
                    dxf,
                    shiftKey : e.shiftKey,
                    isDown   : this._isPointerDown,
                });
            });

            this._svgEl.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 && e.button !== 1) return;           // <-- Left or middle button only
                this._isPointerDown = true;
                this._pointerButton = e.button;
                this._svgEl.setPointerCapture(e.pointerId);             // <-- Capture pointer for clean drag

                if (this._isPanGesture()) {
                    this._viewBoxController.Na__ViewBoxController__OnPanStart(e);
                    return;
                }

                this._eventBus.emit('canvas:pointer-down', {
                    screen : { x: e.clientX, y: e.clientY },
                    dxf    : this.Na__CadCanvas__ClientToDxf(e.clientX, e.clientY),
                    shiftKey : e.shiftKey,
                });
            });

            this._svgEl.addEventListener('pointerup', (e) => {
                const wasPanning = this._isPanGesture();
                this._isPointerDown = false;
                try { this._svgEl.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }

                if (wasPanning) {
                    this._viewBoxController.Na__ViewBoxController__OnPanEnd(e);
                    return;
                }

                this._eventBus.emit('canvas:pointer-up', {
                    screen : { x: e.clientX, y: e.clientY },
                    dxf    : this.Na__CadCanvas__ClientToDxf(e.clientX, e.clientY),
                    shiftKey : e.shiftKey,
                });
            });

            this._svgEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                this._viewBoxController.Na__ViewBoxController__OnWheel(e); // <-- Zoom on scroll
            }, { passive: false });

            this._svgEl.addEventListener('contextmenu', (e) => e.preventDefault()); // <-- No browser menu on canvas
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Space Bar Temporary Pan (Config-Driven)
        // ------------------------------------------------------------
        _bindSpacePanKeys() {
            document.addEventListener('keydown', (e) => {
                if (e.code !== 'Space' || e.repeat) return;
                const enabled = this._appState.controls?.Controls__Mouse?.SpaceBar__TemporaryPanEnabled !== false;
                if (!enabled) return;
                const tag = document.activeElement?.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea') return;      // <-- Don't hijack typing
                e.preventDefault();
                this._isSpacePanning = true;
                this._containerEl?.classList.add('is-panning');
            });
            document.addEventListener('keyup', (e) => {
                if (e.code !== 'Space') return;
                this._isSpacePanning = false;
                this._containerEl?.classList.remove('is-panning');
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('tool:changed', ({ tool }) => {
                Na__CadCanvas__UpdateContainerCursor(this._containerEl, tool);
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__CadCanvas__Clear();
            });
            this._eventBus.on('layer:visibility-changed', ({ layer, visible }) => {
                this.Na__CadCanvas__SetLayerVisibility(layer, visible);
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Is the Current Pointer Interaction a Pan Gesture?
        // ------------------------------------------------------------
        _isPanGesture() {
            const middlePan = this._appState.controls?.Controls__Mouse?.MiddleButton__PanEnabled !== false;
            return (
                this._appState.activeTool === 'pan' ||
                this._isSpacePanning ||
                (middlePan && this._pointerButton === 1)
            );
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entity Element Factory
// -----------------------------------------------------------------------------

    // FUNCTION | Dispatch to Per-Type Renderer and Attach Shared Attributes
    // ------------------------------------------------------------
    function Na__CadCanvas__CreateEntityElement(entity) {
        if (!entity || !entity.geometry) return null;

        switch (entity.type) {
            case 'LINE':       return Na__CadRender__Line(entity);
            case 'ARC':        return Na__CadRender__Arc(entity);
            case 'CIRCLE':     return Na__CadRender__Circle(entity);
            case 'LWPOLYLINE':
            case 'POLYLINE':
            case 'SPLINE':     return Na__CadRender__Polyline(entity);
            case 'SOLID':
            case 'TRACE':      return Na__CadRender__Solid(entity);
            case 'HATCH':      return Na__CadRender__Hatch(entity);
            case 'ELLIPSE':    return Na__CadRender__Ellipse(entity);
            case 'TEXT':
            case 'MTEXT':      return Na__CadRender__Text(entity);
            case 'INSERT':     return Na__CadRender__Insert(entity);
            case 'POINT':      return Na__CadRender__Point(entity);
            case 'IMAGE':      return Na__CadRender__Image(entity);
            default:           return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Shared Data Attributes and CSS Classes to SVG Element
    // ------------------------------------------------------------
    function Na__CadCanvas__ApplyEntityAttributes(el, entity) {
        el.classList.add('na-cad-entity');
        el.setAttribute('data-handle', entity.handle);
        el.setAttribute('data-layer',  entity.layer);
        el.setAttribute('data-type',   entity.type);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Standard Stroke Attributes to a Geometry Primitive
    // ------------------------------------------------------------
    function Na__CadCanvas__ApplyStroke(el, entity) {
        el.setAttribute('stroke',        entity.hexColor || '#e2e2e8');
        el.setAttribute('stroke-width',  '1');
        el.setAttribute('fill',          'none');
        el.setAttribute('vector-effect', 'non-scaling-stroke');        // <-- Crisp 1px stroke at all zooms
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per-Type SVG Renderers — RAW DXF Coordinates (Flip Group Handles Y)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Render LINE Entity
    // ------------------------------------------------------------
    function Na__CadRender__Line(entity) {
        const g  = entity.geometry;
        const el = document.createElementNS(_SVG_NS, 'line');
        el.setAttribute('x1', g.x1);
        el.setAttribute('y1', g.y1);
        el.setAttribute('x2', g.x2);
        el.setAttribute('y2', g.y2);
        Na__CadCanvas__ApplyStroke(el, entity);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render ARC Entity (True SVG Arc Path)
    // ------------------------------------------------------------
    function Na__CadRender__Arc(entity) {
        const g = entity.geometry;
        const { cx, cy, radius } = g;

        let a0 = g.startAngle * Math.PI / 180;
        let a1 = g.endAngle   * Math.PI / 180;
        if (a1 <= a0) a1 += 2 * Math.PI;                                // <-- DXF arcs run CCW start→end

        const x0       = cx + radius * Math.cos(a0);
        const y0       = cy + radius * Math.sin(a0);
        const x1       = cx + radius * Math.cos(a1);
        const y1       = cy + radius * Math.sin(a1);
        const largeArc = (a1 - a0) > Math.PI ? 1 : 0;

        const el = document.createElementNS(_SVG_NS, 'path');
        el.setAttribute('d', `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`); // <-- Sweep 1 = CCW in DXF space
        Na__CadCanvas__ApplyStroke(el, entity);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render CIRCLE Entity
    // ------------------------------------------------------------
    function Na__CadRender__Circle(entity) {
        const g  = entity.geometry;
        const el = document.createElementNS(_SVG_NS, 'circle');
        el.setAttribute('cx', g.cx);
        el.setAttribute('cy', g.cy);
        el.setAttribute('r',  g.radius);
        Na__CadCanvas__ApplyStroke(el, entity);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render LWPOLYLINE / POLYLINE / SPLINE as SVG Polyline/Polygon
    // ------------------------------------------------------------
    function Na__CadRender__Polyline(entity) {
        const g = entity.geometry;
        if (!g.vertices || g.vertices.length === 0) return null;

        const pts = g.vertices.map(v => `${v.x},${v.y}`).join(' ');

        const el = document.createElementNS(_SVG_NS, g.closed ? 'polygon' : 'polyline');
        el.setAttribute('points', pts);
        Na__CadCanvas__ApplyStroke(el, entity);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render SOLID / TRACE as Filled Polygon
    // ------------------------------------------------------------
    function Na__CadRender__Solid(entity) {
        const g = entity.geometry;
        if (!g.vertices || g.vertices.length < 3) return null;

        const el = document.createElementNS(_SVG_NS, 'polygon');
        el.setAttribute('points', g.vertices.map(v => `${v.x},${v.y}`).join(' '));
        el.setAttribute('fill',           entity.hexColor || '#e2e2e8');
        el.setAttribute('fill-opacity',   '0.55');                      // <-- Solid fill, slightly translucent
        el.setAttribute('stroke',         entity.hexColor || '#e2e2e8');
        el.setAttribute('stroke-width',   '1');
        el.setAttribute('vector-effect',  'non-scaling-stroke');
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render HATCH Boundary Paths as a Group of Polygons
    // ------------------------------------------------------------
    function Na__CadRender__Hatch(entity) {
        const g = entity.geometry;
        if (!g.paths || g.paths.length === 0) return null;

        const groupEl = document.createElementNS(_SVG_NS, 'g');
        g.paths.forEach((path) => {
            if (!path.vertices || path.vertices.length < 2) return;
            const poly = document.createElementNS(_SVG_NS, 'polygon');
            poly.setAttribute('points', path.vertices.map(v => `${v.x},${v.y}`).join(' '));
            poly.setAttribute('fill',          entity.hexColor || '#e2e2e8');
            poly.setAttribute('fill-opacity',  '0.12');                 // <-- Ghost fill signals hatched region
            poly.setAttribute('stroke',        entity.hexColor || '#e2e2e8');
            poly.setAttribute('stroke-width',  '1');
            poly.setAttribute('vector-effect', 'non-scaling-stroke');
            groupEl.appendChild(poly);
        });
        return groupEl.childNodes.length > 0 ? groupEl : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render ELLIPSE Entity (Polyline Approximation with Rotation)
    // ------------------------------------------------------------
    function Na__CadRender__Ellipse(entity) {
        const g      = entity.geometry;
        const startP = g.startParam ?? 0;
        let   span   = (g.endParam ?? (2 * Math.PI)) - startP;
        if (span <= 0) span += 2 * Math.PI;

        const rot      = (g.rotation ?? 0) * Math.PI / 180;
        const segments = Math.max(8, Math.ceil(span / (2 * Math.PI) * 64));
        const points   = [];

        for (let i = 0; i <= segments; i++) {
            const t  = startP + span * (i / segments);
            const ex = g.rx * Math.cos(t);
            const ey = g.ry * Math.sin(t);
            const px = g.cx + ex * Math.cos(rot) - ey * Math.sin(rot); // <-- Rotate by major-axis angle
            const py = g.cy + ex * Math.sin(rot) + ey * Math.cos(rot);
            points.push(`${px},${py}`);
        }

        const el = document.createElementNS(_SVG_NS, 'polyline');
        el.setAttribute('points', points.join(' '));
        Na__CadCanvas__ApplyStroke(el, entity);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render TEXT / MTEXT Entity (Un-Flipped Locally)
    // ------------------------------------------------------------
    function Na__CadRender__Text(entity) {
        const g  = entity.geometry;
        const el = document.createElementNS(_SVG_NS, 'text');

        // Position via transform, then locally undo the global Y flip so
        // glyphs render upright. Rotation applies in DXF space (CCW).
        const rotation = g.rotation ? ` rotate(${-g.rotation})` : '';
        el.setAttribute('transform', `translate(${g.x},${g.y}) scale(1,-1)${rotation}`);
        el.setAttribute('x', 0);
        el.setAttribute('y', 0);
        el.setAttribute('font-size', g.height || 2.5);
        el.setAttribute('fill',      entity.hexColor || '#e2e2e8');
        el.setAttribute('stroke',    'none');
        el.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');

        // MULTILINE — MTEXT paragraphs arrive as '\n'; one tspan per line,
        // successive lines stepping downward (local +y = down after the flip)
        const lines = String(g.text || '').split('\n');
        if (lines.length === 1) {
            el.textContent = lines[0];
        } else {
            const lineH = (g.height || 2.5) * 1.4;                       // <-- Keep in sync with the bbox estimate
            lines.forEach((line, i) => {
                const tspan = document.createElementNS(_SVG_NS, 'tspan');
                tspan.setAttribute('x', 0);
                tspan.setAttribute('y', i * lineH);
                tspan.textContent = line;
                el.appendChild(tspan);
            });
        }
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render INSERT Without Exploded Children (Crosshair Marker)
    // ------------------------------------------------------------
    function Na__CadRender__Insert(entity) {
        if ((entity.childCount || 0) > 0) return null;                  // <-- Children carry the visuals

        const g    = entity.geometry;
        const size = 1.5;                                                // <-- Cross arm length in drawing units
        const g_el = document.createElementNS(_SVG_NS, 'g');

        const hLine = document.createElementNS(_SVG_NS, 'line');
        hLine.setAttribute('x1', g.x - size);
        hLine.setAttribute('y1', g.y);
        hLine.setAttribute('x2', g.x + size);
        hLine.setAttribute('y2', g.y);

        const vLine = document.createElementNS(_SVG_NS, 'line');
        vLine.setAttribute('x1', g.x);
        vLine.setAttribute('y1', g.y - size);
        vLine.setAttribute('x2', g.x);
        vLine.setAttribute('y2', g.y + size);

        [hLine, vLine].forEach((line) => Na__CadCanvas__ApplyStroke(line, entity));

        g_el.appendChild(hLine);
        g_el.appendChild(vLine);
        return g_el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render POINT Entity as Small Circle
    // ------------------------------------------------------------
    function Na__CadRender__Point(entity) {
        const g  = entity.geometry;
        const el = document.createElementNS(_SVG_NS, 'circle');
        el.setAttribute('cx',     g.x);
        el.setAttribute('cy',     g.y);
        el.setAttribute('r',      '0.5');                               // <-- Fixed radius in drawing units
        el.setAttribute('fill',   entity.hexColor || '#e2e2e8');
        el.setAttribute('stroke', 'none');
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render IMAGE Entity — Raster When Available, Else a Frame
    // ------------------------------------------------------------
    function Na__CadRender__Image(entity) {
        const g = entity.geometry;
        const c = g && g.corners;
        if (!c || c.length < 4) return null;

        const [p0, p1, p2, p3] = c;                                     // <-- LL, LR, UR, UL (model space)

        // KEPT RASTER — map the unit image box onto the model quad via an affine
        // matrix (raster top-left → P3, top-right → P2, bottom-left → P0). This
        // reproduces the DXF rotation/scale and keeps the picture upright inside
        // the parent flip group without a separate local flip.
        if (g.present && g.href) {
            const a  = p2.x - p3.x, b = p2.y - p3.y;                    // <-- Image X axis in model space
            const cX = p0.x - p3.x, d = p0.y - p3.y;                    // <-- Image Y axis in model space
            const el = document.createElementNS(_SVG_NS, 'image');
            el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', g.href); // <-- Legacy UA fallback
            el.setAttribute('href',   g.href);
            el.setAttribute('x',      0);
            el.setAttribute('y',      0);
            el.setAttribute('width',  1);
            el.setAttribute('height', 1);
            el.setAttribute('preserveAspectRatio', 'none');            // <-- Quad already encodes true aspect
            el.setAttribute('transform', `matrix(${a} ${b} ${cX} ${d} ${p3.x} ${p3.y})`);
            return el;
        }

        // MISSING RASTER — dashed placeholder frame + centred filename label so the
        // image's position and extent stay visible and selectable.
        const groupEl = document.createElementNS(_SVG_NS, 'g');
        const frame   = document.createElementNS(_SVG_NS, 'polygon');
        frame.setAttribute('points', c.map(v => `${v.x},${v.y}`).join(' '));
        frame.setAttribute('fill',           entity.hexColor || '#a78bfa');
        frame.setAttribute('fill-opacity',   '0.06');
        frame.setAttribute('stroke',         entity.hexColor || '#a78bfa');
        frame.setAttribute('stroke-width',   '1');
        frame.setAttribute('stroke-dasharray', '5 4');
        frame.setAttribute('vector-effect',  'non-scaling-stroke');
        groupEl.appendChild(frame);

        const cx    = (p0.x + p2.x) / 2;                                // <-- Quad centroid
        const cy    = (p0.y + p2.y) / 2;
        const span  = Math.min(g.widthUnits || 0, g.heightUnits || 0) || 10;
        const label = document.createElementNS(_SVG_NS, 'text');
        label.setAttribute('transform', `translate(${cx},${cy}) scale(1,-1)`); // <-- Local un-flip for upright text
        label.setAttribute('x', 0);
        label.setAttribute('y', 0);
        label.setAttribute('font-size',        Math.max(0.5, span * 0.1));
        label.setAttribute('fill',             entity.hexColor || '#a78bfa');
        label.setAttribute('stroke',           'none');
        label.setAttribute('text-anchor',      'middle');
        label.setAttribute('dominant-baseline','middle');
        label.setAttribute('font-family',      'Segoe UI, system-ui, sans-serif');
        label.textContent = `⊞ ${g.name || 'image'}`;
        groupEl.appendChild(label);
        return groupEl;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Update the Canvas Container CSS Cursor for the Active Tool
    // ------------------------------------------------------------
    function Na__CadCanvas__UpdateContainerCursor(containerEl, tool) {
        if (!containerEl) return;
        containerEl.classList.remove('tool--select', 'tool--lasso', 'tool--dimension', 'is-panning');
        if (tool === 'select')       containerEl.classList.add('tool--select');
        if (tool === 'lasso')        containerEl.classList.add('tool--lasso');
        if (tool === 'dim-linear' || tool === 'dim-aligned') containerEl.classList.add('tool--dimension');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
