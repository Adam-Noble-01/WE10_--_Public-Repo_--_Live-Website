// =============================================================================
// NOBLE CAD AUDIT TOOLS - CAD CANVAS
// =============================================================================
//
// FILE      : Na__CadEngine__Canvas__.js
// NAMESPACE : CadAuditTools.CadEngine
// MODULE    : Canvas
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Creates and manages the SVG drawing canvas and pointer event routing
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Creates the main SVG element and appends it to #Na__App__CanvasContainer.
// - Owns the SVG viewBox transform (delegated to ViewBoxController for pan/zoom).
// - Routes pointer events to the active tool (BoxSelectTool for selection,
//   or ViewBoxController for pan) based on AppState.activeTool.
// - Emits "cursor:moved" with SVG-space coordinates on every pointermove.
// - Exposes Na__CadCanvas__GetSvgRoot() for SelectionManager DOM queries.
//
// TODO (follow-up): Implement actual SVG entity rendering (stub placeholder below).
// TODO (follow-up): Port point-in-SVG-space coordinate conversion from ViewBox scale/offset.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — event routing wired, entity rendering stubbed.
//
// =============================================================================


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

            this._containerEl = document.getElementById('Na__App__CanvasContainer');
            this._svgEl       = null;                                    // <-- Created in Na__CadCanvas__Init

            this._isPointerDown    = false;
            this._pointerStartPos  = { x: 0, y: 0 };

            this.Na__CadCanvas__Init();
            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Initialise the SVG Element
        // ------------------------------------------------------------
        Na__CadCanvas__Init() {
            if (!this._containerEl) return;

            this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            this._svgEl.classList.add('na-cad-canvas');
            this._containerEl.appendChild(this._svgEl);                 // <-- Inject SVG into canvas container

            this._bindPointerEvents();

            // Pass SVG element to ViewBoxController so it can manage viewBox
            this._viewBoxController.Na__ViewBoxController__SetSvgEl(this._svgEl);
        }
        // ------------------------------------------------------------


        // FUNCTION | Return the Root SVG Element
        // ------------------------------------------------------------
        Na__CadCanvas__GetSvgRoot() {
            return this._svgEl;                                          // <-- Used by SelectionManager for DOM queries
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind Pointer Events for Tool Routing and Cursor Tracking
        // ------------------------------------------------------------
        _bindPointerEvents() {
            if (!this._svgEl) return;

            this._svgEl.addEventListener('pointermove', (e) => {
                const svgCoords = Na__CadCanvas__ScreenToSvg(e, this._svgEl, this._appState.viewTransform);
                this._eventBus.emit('cursor:moved', svgCoords);          // <-- Update status bar coords

                const tool = this._appState.activeTool;
                if (this._isPointerDown && (tool === 'box-window' || tool === 'box-crossing')) {
                    this._eventBus.emit('boxselect:drag', { screen: { x: e.clientX, y: e.clientY } });
                }
                if (this._isPointerDown && tool === 'pan') {
                    this._viewBoxController.Na__ViewBoxController__OnDrag(e);
                }
            });

            this._svgEl.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 && e.button !== 1) return;           // <-- Left button or middle button only
                this._isPointerDown = true;
                this._pointerStartPos = { x: e.clientX, y: e.clientY };
                this._svgEl.setPointerCapture(e.pointerId);             // <-- Capture pointer for drag

                const tool = this._appState.activeTool;
                if (tool === 'box-window' || tool === 'box-crossing') {
                    this._eventBus.emit('boxselect:start', {
                        screen  : { x: e.clientX, y: e.clientY },
                        mode    : tool,
                    });
                }
                if (tool === 'pan' || e.button === 1) {                 // <-- Middle button always pans
                    this._viewBoxController.Na__ViewBoxController__OnPanStart(e);
                }
            });

            this._svgEl.addEventListener('pointerup', (e) => {
                this._isPointerDown = false;
                this._svgEl.releasePointerCapture(e.pointerId);

                const tool = this._appState.activeTool;
                if (tool === 'box-window' || tool === 'box-crossing') {
                    this._eventBus.emit('boxselect:end', {
                        screen : { x: e.clientX, y: e.clientY },
                        start  : this._pointerStartPos,
                    });
                }
                if (tool === 'pan' || e.button === 1) {
                    this._viewBoxController.Na__ViewBoxController__OnPanEnd(e);
                }
            });

            this._svgEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                this._viewBoxController.Na__ViewBoxController__OnWheel(e); // <-- Zoom on scroll
            }, { passive: false });
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('tool:changed', ({ tool }) => {
                Na__CadCanvas__UpdateContainerCursor(this._containerEl, tool); // <-- Update cursor style
            });
            this._eventBus.on('file:cleared', () => {
                this.Na__CadCanvas__Clear();                             // <-- Wipe all entities from SVG
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Clear All Entity Elements from the SVG
        // ------------------------------------------------------------
        Na__CadCanvas__Clear() {
            if (this._svgEl) {
                while (this._svgEl.firstChild) {
                    this._svgEl.removeChild(this._svgEl.firstChild);     // <-- Remove all child elements
                }
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Render Entity Data Array as SVG Elements (STUB)
        // ------------------------------------------------------------
        Na__CadCanvas__RenderEntities(entities) {
            // TODO: Implement DXF entity → SVG element conversion
            // Each entity has: { handle, type, layer, color, geometry: { ... } }
            // Supported types: LINE, ARC, CIRCLE, POLYLINE, LWPOLYLINE, TEXT, INSERT
            // Each SVG element should have:
            //   - class="na-cad-entity"
            //   - data-handle="<entity.handle>"
            //   - data-layer="<entity.layer>"
            //   - data-type="<entity.type>"
            console.warn('[Na__CadCanvas] Na__CadCanvas__RenderEntities — not yet implemented');
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert Screen Coordinates to SVG Drawing Space
    // ------------------------------------------------------------
    function Na__CadCanvas__ScreenToSvg(event, svgEl, viewTransform) {
        const rect  = svgEl.getBoundingClientRect();
        const rawX  = event.clientX - rect.left;
        const rawY  = event.clientY - rect.top;
        const x     = (rawX - viewTransform.x) / viewTransform.scale;   // <-- Apply inverse transform
        const y     = (rawY - viewTransform.y) / viewTransform.scale;
        return { x, y };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Update the Canvas Container CSS Cursor for the Active Tool
    // ------------------------------------------------------------
    function Na__CadCanvas__UpdateContainerCursor(containerEl, tool) {
        if (!containerEl) return;
        containerEl.classList.remove('tool--box-window', 'tool--box-crossing', 'is-panning');
        if (tool === 'box-window')   containerEl.classList.add('tool--box-window');
        if (tool === 'box-crossing') containerEl.classList.add('tool--box-crossing');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
