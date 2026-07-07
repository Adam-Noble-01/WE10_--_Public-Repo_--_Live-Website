// =============================================================================
// NOBLE CAD AUDIT TOOLS - DIMENSION RENDERER
// =============================================================================
//
// FILE      : Na__DimensionTools__DimensionRenderer__.js
// NAMESPACE : CadAuditTools.DimensionTools
// MODULE    : DimensionRenderer
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Owns dimension records and renders them on the annotation layer
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Single owner of AppState.dimensions — the annotation dimension records.
// - DIMENSION RECORD SHAPE:
//     { id, type: 'linear'|'aligned',
//       p1: {x,y}, p2: {x,y},                ← measured points (DXF space)
//       axis: 'h'|'v' (linear only),          ← measured axis
//       linePos: number (linear) |            ← dim line y (h) or x (v)
//       offset: number (aligned),             ← signed perpendicular offset
//       value: number }                       ← measured distance (drawing units)
// - Renders ValeSpec-style dimensions: extension lines with offset/overshoot,
//   dimension line, 45° architectural ticks, and a value label. Text and tick
//   sizes are held constant in SCREEN pixels by dividing by the zoom scale and
//   re-rendering on zoom:changed.
// - Dimensions are click-selectable (independent of entity selection) and
//   removed with Delete; all add/remove operations emit undo-friendly events.
// - EVENT API:
//     dimension:commit  {dimension}         ← from tools; adds + emits created
//     dimension:remove  {id, silent}        ← removes + emits deleted (unless silent)
//     dimension:restore {dimension, silent} ← re-adds without re-emitting created
//     dimension:created / dimension:deleted ← consumed by UndoManager
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Initial implementation.
//
// =============================================================================

const _SVG_NS = 'http://www.w3.org/2000/svg';


// -----------------------------------------------------------------------------
// REGION | DimensionRenderer Class
// -----------------------------------------------------------------------------

    export class Na__DimensionTools__DimensionRenderer {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._cadCanvas = cadCanvas;

            this._appState.dimensions = [];                              // <-- Dimension record store (SSOT)
            this._selectedIds  = new Set();                              // <-- Selected dimension ids
            this._nextId       = 1;
            this._groupEl      = null;                                   // <-- <g> holding all committed dims
            this._previewEl    = null;                                   // <-- <g> holding the live preview

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('dimension:commit', ({ dimension }) => {
                dimension.id = dimension.id ?? `dim-${this._nextId++}`;
                this._appState.dimensions.push(dimension);
                this.Na__DimensionRenderer__RenderAll();
                this._eventBus.emit('dimension:created', { dimension }); // <-- UndoManager records this
            });

            this._eventBus.on('dimension:remove', ({ id, silent }) => {
                const idx = this._appState.dimensions.findIndex((d) => d.id === id);
                if (idx === -1) return;
                const [dimension] = this._appState.dimensions.splice(idx, 1);
                this._selectedIds.delete(id);
                this.Na__DimensionRenderer__RenderAll();
                if (!silent) this._eventBus.emit('dimension:deleted', { dimension });
            });

            this._eventBus.on('dimension:restore', ({ dimension }) => {
                this._appState.dimensions.push(dimension);
                this.Na__DimensionRenderer__RenderAll();
            });

            this._eventBus.on('hotkey:edit:delete', () => {
                this._deleteSelectedDimensions();                        // <-- Delete key removes selected dims
            });
            this._eventBus.on('hotkey:edit:deselect', () => {
                if (this._selectedIds.size > 0) {
                    this._selectedIds.clear();
                    this.Na__DimensionRenderer__RenderAll();
                }
            });

            this._eventBus.on('zoom:changed', () => {
                this.Na__DimensionRenderer__RenderAll();                 // <-- Keep text/ticks screen-constant
            });

            this._eventBus.on('file:cleared', () => {
                this._appState.dimensions = [];
                this._selectedIds.clear();
                this._groupEl   = null;                                  // <-- Annotation layer was cleared
                this._previewEl = null;
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Render All Committed Dimensions
        // ------------------------------------------------------------
        Na__DimensionRenderer__RenderAll() {
            const annoLayer = this._cadCanvas.Na__CadCanvas__GetAnnotationLayer();
            if (!annoLayer) return;

            if (!this._groupEl || this._groupEl.parentNode !== annoLayer) {
                this._groupEl = document.createElementNS(_SVG_NS, 'g');
                this._groupEl.classList.add('na-dimensions-group');
                annoLayer.appendChild(this._groupEl);
            }
            this._groupEl.replaceChildren();

            this._appState.dimensions.forEach((dim) => {
                const el = this._buildDimensionElement(dim, this._selectedIds.has(dim.id));
                if (el) this._groupEl.appendChild(el);
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Render or Clear the Live Preview Dimension
        // ------------------------------------------------------------
        Na__DimensionRenderer__RenderPreview(dimension) {
            const annoLayer = this._cadCanvas.Na__CadCanvas__GetAnnotationLayer();
            if (!annoLayer) return;

            if (this._previewEl) {
                this._previewEl.remove();
                this._previewEl = null;
            }
            if (!dimension) return;                                      // <-- null clears the preview

            const el = this._buildDimensionElement(dimension, false);
            if (el) {
                el.classList.add('na-dimension--preview');
                annoLayer.appendChild(el);
                this._previewEl = el;
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Compute the Measured Value of a Dimension Record
        // ------------------------------------------------------------
        Na__DimensionRenderer__ComputeValue(dim) {
            if (dim.type === 'linear') {
                return dim.axis === 'h'
                    ? Math.abs(dim.p2.x - dim.p1.x)                      // <-- Horizontal measures ΔX
                    : Math.abs(dim.p2.y - dim.p1.y);                     // <-- Vertical measures ΔY
            }
            return Math.hypot(dim.p2.x - dim.p1.x, dim.p2.y - dim.p1.y); // <-- Aligned measures true length
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Delete All Selected Dimensions (Undo-Recorded)
        // ------------------------------------------------------------
        _deleteSelectedDimensions() {
            if (this._selectedIds.size === 0) return;
            [...this._selectedIds].forEach((id) => {
                this._eventBus.emit('dimension:remove', { id, silent: false });
            });
            this._selectedIds.clear();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Build the SVG Group for One Dimension
        // ------------------------------------------------------------
        _buildDimensionElement(dim, isSelected) {
            const cfg    = this._dimConfig();
            const scale  = this._appState.viewTransform?.scale || 1;
            const px     = (v) => v / scale;                             // <-- Screen px → drawing units

            const groupEl = document.createElementNS(_SVG_NS, 'g');
            groupEl.classList.add('na-dimension');
            groupEl.setAttribute('data-dim-id', dim.id ?? 'preview');
            if (isSelected) groupEl.classList.add('is-selected');

            // RESOLVE GEOMETRY — dimension line ends + extension line runs
            const geo = Na__DimRender__ResolveGeometry(dim, px(cfg.extOffset), px(cfg.extOvershoot));
            if (!geo) return null;

            // EXTENSION LINES
            geo.extensions.forEach(([a, b]) => {
                groupEl.appendChild(Na__DimRender__Line(a, b, cfg.color));
            });

            // DIMENSION LINE
            groupEl.appendChild(Na__DimRender__Line(geo.d1, geo.d2, cfg.color));

            // 45° ARCHITECTURAL TICKS at both ends
            const tick = px(cfg.tickLen) / 2;
            [geo.d1, geo.d2].forEach((pt) => {
                const t1 = { x: pt.x - tick, y: pt.y - tick };
                const t2 = { x: pt.x + tick, y: pt.y + tick };
                groupEl.appendChild(Na__DimRender__Line(t1, t2, cfg.color));
            });

            // VALUE LABEL — constant screen size, flipped upright, along the line
            const value = this.Na__DimensionRenderer__ComputeValue(dim);
            const label = `${value.toFixed(cfg.decimals)}${cfg.suffix ? ' ' + cfg.suffix : ''}`;

            const textEl = document.createElementNS(_SVG_NS, 'text');
            const textGap = px(6);
            const mid = { x: (geo.d1.x + geo.d2.x) / 2, y: (geo.d1.y + geo.d2.y) / 2 };

            let angleDeg = Math.atan2(geo.d2.y - geo.d1.y, geo.d2.x - geo.d1.x) * 180 / Math.PI;
            if (angleDeg > 90 || angleDeg <= -90) angleDeg += 180;       // <-- Keep text readable, never upside down

            const normal = Na__DimRender__UnitNormal(geo.d1, geo.d2, geo.textSide);
            const tx     = mid.x + normal.x * textGap;
            const ty     = mid.y + normal.y * textGap;

            textEl.setAttribute('transform', `translate(${tx},${ty}) scale(1,-1) rotate(${-angleDeg})`);
            textEl.setAttribute('x', 0);
            textEl.setAttribute('y', 0);
            textEl.setAttribute('font-size',    px(cfg.textHeight));
            textEl.setAttribute('fill',         cfg.textColor);
            textEl.setAttribute('text-anchor',  'middle');
            textEl.setAttribute('font-family',  'Segoe UI, system-ui, sans-serif');
            textEl.classList.add('na-dimension-text');
            textEl.textContent = label;
            groupEl.appendChild(textEl);

            // INVISIBLE HIT TARGET along the dimension line for click selection
            if (dim.id) {
                const hit = Na__DimRender__Line(geo.d1, geo.d2, 'transparent');
                hit.setAttribute('stroke-width', '14');
                hit.classList.add('na-dimension-hit');
                hit.addEventListener('pointerdown', (e) => {
                    if (this._appState.activeTool !== 'select') return;  // <-- Only selectable in select mode
                    e.stopPropagation();                                 // <-- Don't start a box select
                    this._toggleDimSelection(dim.id, e.shiftKey);
                });
                groupEl.appendChild(hit);
            }

            return groupEl;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Toggle/Set Dimension Selection State
        // ------------------------------------------------------------
        _toggleDimSelection(id, additive) {
            if (additive) {
                if (this._selectedIds.has(id)) this._selectedIds.delete(id);
                else this._selectedIds.add(id);
            } else {
                this._selectedIds = new Set([id]);
            }
            this.Na__DimensionRenderer__RenderAll();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Read Dimension Style Config with Fallback Defaults
        // ------------------------------------------------------------
        _dimConfig() {
            const cfg = this._appState.config?.Config__Dimensions || {};
            return {
                color        : cfg.Style__Color                ?? '#ff4081',
                textColor    : cfg.Style__TextColor            ?? '#ff80ab',
                textHeight   : cfg.Style__TextHeight_px        ?? 12,
                tickLen      : cfg.Style__TickLength_px        ?? 6,
                extOffset    : cfg.Style__ExtensionOffset_px   ?? 4,
                extOvershoot : cfg.Style__ExtensionOvershoot_px ?? 5,
                suffix       : cfg.Units__Suffix               ?? 'mm',
                decimals     : cfg.Units__DecimalPlaces        ?? 1,
            };
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions — Pure Dimension Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve Dimension/Extension Line Geometry for a Record
    // ------------------------------------------------------------
    function Na__DimRender__ResolveGeometry(dim, extOffset, extOvershoot) {
        const { p1, p2 } = dim;

        if (dim.type === 'linear' && dim.axis === 'h') {
            const y  = dim.linePos;                                      // <-- Dimension line Y
            const d1 = { x: p1.x, y };
            const d2 = { x: p2.x, y };
            return {
                d1, d2,
                textSide   : y >= Math.max(p1.y, p2.y) ? 1 : -1,        // <-- Label on the outside
                extensions : [
                    [Na__DimRender__Toward(p1, d1, extOffset), Na__DimRender__Beyond(p1, d1, extOvershoot)],
                    [Na__DimRender__Toward(p2, d2, extOffset), Na__DimRender__Beyond(p2, d2, extOvershoot)],
                ],
            };
        }

        if (dim.type === 'linear' && dim.axis === 'v') {
            const x  = dim.linePos;                                      // <-- Dimension line X
            const d1 = { x, y: p1.y };
            const d2 = { x, y: p2.y };
            return {
                d1, d2,
                textSide   : x >= Math.max(p1.x, p2.x) ? 1 : -1,
                extensions : [
                    [Na__DimRender__Toward(p1, d1, extOffset), Na__DimRender__Beyond(p1, d1, extOvershoot)],
                    [Na__DimRender__Toward(p2, d2, extOffset), Na__DimRender__Beyond(p2, d2, extOvershoot)],
                ],
            };
        }

        // ALIGNED — dimension line parallel to p1→p2 at signed perpendicular offset
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (len === 0) return null;

        const nx  = -(p2.y - p1.y) / len;                                // <-- Unit normal to p1→p2
        const ny  =  (p2.x - p1.x) / len;
        const off = dim.offset ?? 0;

        const d1 = { x: p1.x + nx * off, y: p1.y + ny * off };
        const d2 = { x: p2.x + nx * off, y: p2.y + ny * off };

        return {
            d1, d2,
            textSide   : off >= 0 ? 1 : -1,
            extensions : [
                [Na__DimRender__Toward(p1, d1, extOffset), Na__DimRender__Beyond(p1, d1, extOvershoot)],
                [Na__DimRender__Toward(p2, d2, extOffset), Na__DimRender__Beyond(p2, d2, extOvershoot)],
            ],
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point Moved from A a Fixed Distance Toward B
    // ------------------------------------------------------------
    function Na__DimRender__Toward(a, b, dist) {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len === 0 || len <= dist) return { ...a };
        const t = dist / len;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };  // <-- Gap between point and extension start
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point Moved a Fixed Distance Beyond B Away from A
    // ------------------------------------------------------------
    function Na__DimRender__Beyond(a, b, dist) {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len === 0) return { ...b };
        const t = (len + dist) / len;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };  // <-- Overshoot past the dimension line
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Unit Normal of Segment d1→d2 on the Given Side
    // ------------------------------------------------------------
    function Na__DimRender__UnitNormal(d1, d2, side) {
        const len = Math.hypot(d2.x - d1.x, d2.y - d1.y);
        if (len === 0) return { x: 0, y: side };
        return { x: -(d2.y - d1.y) / len * side, y: (d2.x - d1.x) / len * side };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Styled SVG Line Element
    // ------------------------------------------------------------
    function Na__DimRender__Line(a, b, color) {
        const el = document.createElementNS(_SVG_NS, 'line');
        el.setAttribute('x1', a.x);
        el.setAttribute('y1', a.y);
        el.setAttribute('x2', b.x);
        el.setAttribute('y2', b.y);
        el.setAttribute('stroke',        color);
        el.setAttribute('stroke-width',  '1');
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        return el;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
