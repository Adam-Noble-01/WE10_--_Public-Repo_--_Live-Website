// =============================================================================
// NOBLE CAD AUDIT TOOLS - VIEWBOX CONTROLLER
// =============================================================================
//
// FILE      : Na__Navigation__ViewBoxController__.js
// NAMESPACE : CadAuditTools.Navigation
// MODULE    : ViewBoxController
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Pan and zoom the SVG canvas via pointer drag and scroll wheel
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Owns the SVG viewBox transform: { scale, x, y } stored in AppState.viewTransform.
// - Pan: middle-mouse drag, or pointer drag when activeTool === 'pan'.
// - Zoom: scroll wheel, centred on the cursor position.
// - Fit: responds to "view:fit" EventBus event — computes the bounding box of all
//   SVG elements and sets the viewBox to show them with a margin.
// - Uses a CSS transform on the SVG root element (translate + scale) rather than
//   manipulating individual element positions.
// - Emits "zoom:changed" after every zoom or fit so StatusBar can update.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — pan/zoom wired, fit-to-bounds stubbed.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Zoom Limits and Sensitivity
    // ------------------------------------------------------------
    const Na__VIEW_ZOOM_MIN       = 0.01;  // <-- Minimum scale (1%)
    const Na__VIEW_ZOOM_MAX       = 100;   // <-- Maximum scale (10000%)
    const Na__VIEW_ZOOM_FACTOR    = 1.15;  // <-- Scale multiplier per scroll step
    const Na__VIEW_FIT_MARGIN_PX  = 40;   // <-- Pixels of padding around drawing when fitting
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | ViewBoxController Class
// -----------------------------------------------------------------------------

    export class Na__Navigation__ViewBoxController {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState  = appState;
            this._eventBus  = eventBus;
            this._svgEl     = null;                                      // <-- Set by CadCanvas after SVG creation

            this._isPanning       = false;
            this._panLastPos      = { x: 0, y: 0 };

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Set the SVG Element Reference (called by CadCanvas)
        // ------------------------------------------------------------
        Na__ViewBoxController__SetSvgEl(svgEl) {
            this._svgEl = svgEl;
            this._appState.viewTransform = { scale: 1, x: 0, y: 0 };   // <-- Reset transform for new SVG
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('view:fit', () => {
                this.Na__ViewBoxController__FitToDrawing();              // <-- Fit drawing to viewport
            });
            this._eventBus.on('file:cleared', () => {
                this._resetTransform();                                  // <-- Reset view on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pan Start (pointerdown from CadCanvas)
        // ------------------------------------------------------------
        Na__ViewBoxController__OnPanStart(event) {
            this._isPanning  = true;
            this._panLastPos = { x: event.clientX, y: event.clientY };
            if (this._svgEl?.parentElement) {
                this._svgEl.parentElement.classList.add('is-panning');  // <-- Grabbing cursor
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pan Drag (pointermove from CadCanvas)
        // ------------------------------------------------------------
        Na__ViewBoxController__OnDrag(event) {
            if (!this._isPanning) return;

            const dx = event.clientX - this._panLastPos.x;              // <-- Screen-space delta
            const dy = event.clientY - this._panLastPos.y;
            this._panLastPos = { x: event.clientX, y: event.clientY };

            this._appState.viewTransform.x += dx;                       // <-- Accumulate pan offset
            this._appState.viewTransform.y += dy;
            this._applyTransform();
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Pan End (pointerup from CadCanvas)
        // ------------------------------------------------------------
        Na__ViewBoxController__OnPanEnd() {
            this._isPanning = false;
            if (this._svgEl?.parentElement) {
                this._svgEl.parentElement.classList.remove('is-panning');
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Scroll Wheel Zoom
        // ------------------------------------------------------------
        Na__ViewBoxController__OnWheel(event) {
            if (!this._svgEl) return;

            const containerRect = this._svgEl.getBoundingClientRect();
            const cursorX = event.clientX - containerRect.left;         // <-- Cursor position in container
            const cursorY = event.clientY - containerRect.top;

            const delta     = event.deltaY < 0 ? Na__VIEW_ZOOM_FACTOR : 1 / Na__VIEW_ZOOM_FACTOR;
            const oldScale  = this._appState.viewTransform.scale;
            const newScale  = Math.min(Na__VIEW_ZOOM_MAX, Math.max(Na__VIEW_ZOOM_MIN, oldScale * delta));

            if (newScale === oldScale) return;                           // <-- Already at limit

            // Adjust x/y offset so zoom is centred on cursor
            const scaleRatio = newScale / oldScale;
            this._appState.viewTransform.x = cursorX - scaleRatio * (cursorX - this._appState.viewTransform.x);
            this._appState.viewTransform.y = cursorY - scaleRatio * (cursorY - this._appState.viewTransform.y);
            this._appState.viewTransform.scale = newScale;

            this._applyTransform();
            this._eventBus.emit('zoom:changed', { scale: newScale });
        }
        // ------------------------------------------------------------


        // FUNCTION | Fit the View to the Bounding Box of All SVG Content
        // ------------------------------------------------------------
        Na__ViewBoxController__FitToDrawing() {
            if (!this._svgEl) return;

            // TODO: Compute tight bounding box from rendered entity elements
            // For now, use the SVG's getBBox() as a rough approximation
            try {
                const bbox = this._svgEl.getBBox();                      // <-- SVG intrinsic bounding box

                if (!bbox || (bbox.width === 0 && bbox.height === 0)) {
                    this._resetTransform();                              // <-- Nothing rendered yet
                    return;
                }

                const containerW = this._svgEl.clientWidth  || 800;
                const containerH = this._svgEl.clientHeight || 600;

                const margin     = Na__VIEW_FIT_MARGIN_PX;
                const scaleX     = (containerW - margin * 2) / bbox.width;
                const scaleY     = (containerH - margin * 2) / bbox.height;
                const scale      = Math.min(scaleX, scaleY);            // <-- Uniform scale to fit both axes

                const x          = margin - bbox.x * scale;
                const y          = margin - bbox.y * scale;

                this._appState.viewTransform = { scale, x, y };
                this._applyTransform();
                this._eventBus.emit('zoom:changed', { scale });

            } catch (err) {
                console.warn('[Na__ViewBoxController] getBBox() failed:', err);
                this._resetTransform();
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Apply the Current Transform to the SVG Element
        // ------------------------------------------------------------
        _applyTransform() {
            if (!this._svgEl) return;
            const { scale, x, y } = this._appState.viewTransform;
            this._svgEl.style.transformOrigin = '0 0';
            this._svgEl.style.transform       = `translate(${x}px, ${y}px) scale(${scale})`; // <-- CSS transform on SVG
        }
        // ------------------------------------------------------------


        // FUNCTION | Reset Transform to Identity (scale=1, x=0, y=0)
        // ------------------------------------------------------------
        _resetTransform() {
            this._appState.viewTransform = { scale: 1, x: 0, y: 0 };
            this._applyTransform();
            this._eventBus.emit('zoom:changed', { scale: 1 });
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
