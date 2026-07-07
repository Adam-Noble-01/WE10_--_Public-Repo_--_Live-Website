// =============================================================================
// NOBLE CAD AUDIT TOOLS - VIEWBOX CONTROLLER
// =============================================================================
//
// FILE      : Na__Navigation__ViewBoxController__.js
// NAMESPACE : CadAuditTools.Navigation
// MODULE    : ViewBoxController
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Pan and zoom the SVG canvas via true SVG viewBox manipulation
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Owns the SVG viewBox { x, y, w, h } — the window onto the drawing.
// - TRUE viewBox manipulation (not CSS transforms) so vector-effect
//   non-scaling-stroke keeps every line crisp at 1px at any zoom level,
//   exactly like the ValeSpec CAD viewer.
// - Pan  : middle-mouse drag always; left drag when activeTool === 'pan';
//          Space+drag temporary pan (config-driven).
// - Zoom : scroll wheel centred on cursor; +/- hotkey step zoom; fit-all.
// - Fit  : "view:fit" event — frames the drawing bbox with a margin.
// - Factors and limits read from Config__Navigation in the app config SSOT.
// - Publishes appState.viewTransform.scale (screen px per drawing unit) and
//   emits "zoom:changed" so StatusBar and annotation layers can react.
// - Provides Na__ViewBoxController__ScreenToSvg() — the single source of truth
//   for screen→SVG coordinate mapping used by Canvas and all tools.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.3.0
// - Rewritten from CSS transform to true SVG viewBox manipulation.
// - Config-driven zoom factors/limits; step zoom; ResizeObserver aspect sync.
//
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — CSS-transform pan/zoom.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants — Fallback Defaults (Config Overrides These)
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Zoom Limits and Sensitivity
    // ------------------------------------------------------------
    const Na__VIEW_ZOOM_MIN         = 0.001;  // <-- Minimum scale (screen px per drawing unit)
    const Na__VIEW_ZOOM_MAX         = 1000;   // <-- Maximum scale
    const Na__VIEW_ZOOM_FACTOR      = 1.15;   // <-- Scale multiplier per scroll step
    const Na__VIEW_STEP_FACTOR      = 1.4;    // <-- Scale multiplier per +/- button step
    const Na__VIEW_FIT_MARGIN_PX    = 40;     // <-- Pixels of padding around drawing when fitting
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | ViewBoxController Class
// -----------------------------------------------------------------------------

    export class Na__Navigation__ViewBoxController {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this._appState   = appState;
            this._eventBus   = eventBus;
            this._svgEl      = null;                                     // <-- Set by CadCanvas after SVG creation

            this._viewBox    = { x: 0, y: 0, w: 1000, h: 1000 };        // <-- Current window onto SVG space
            this._isPanning  = false;
            this._panLastPos = { x: 0, y: 0 };

            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Set the SVG Element Reference (called by CadCanvas)
        // ------------------------------------------------------------
        Na__ViewBoxController__SetSvgEl(svgEl) {
            this._svgEl = svgEl;
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice'); // <-- Aspect kept in sync manually below

            // Keep viewBox height matched to container aspect on window resize
            if (typeof ResizeObserver !== 'undefined') {
                this._resizeObserver = new ResizeObserver(() => this._syncAspect());
                this._resizeObserver.observe(svgEl);
            }

            this._resetToDefault();
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('view:fit', () => {
                this.Na__ViewBoxController__FitToDrawing();              // <-- Fit drawing to viewport
            });
            this._eventBus.on('hotkey:view:fit', () => {
                this.Na__ViewBoxController__FitToDrawing();
            });
            this._eventBus.on('hotkey:view:zoom-in', () => {
                this.Na__ViewBoxController__StepZoom(true);              // <-- + key / toolbar button
            });
            this._eventBus.on('hotkey:view:zoom-out', () => {
                this.Na__ViewBoxController__StepZoom(false);             // <-- - key / toolbar button
            });
            this._eventBus.on('file:cleared', () => {
                this._resetToDefault();                                  // <-- Reset view on file clear
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Convert Screen (client) Coordinates to SVG Space
        // ------------------------------------------------------------
        Na__ViewBoxController__ScreenToSvg(clientX, clientY) {
            if (!this._svgEl) return { x: 0, y: 0 };
            const rect = this._svgEl.getBoundingClientRect();
            const px   = clientX - rect.left;
            const py   = clientY - rect.top;
            return {
                x : this._viewBox.x + (px / rect.width)  * this._viewBox.w,
                y : this._viewBox.y + (py / rect.height) * this._viewBox.h,
            };
        }
        // ------------------------------------------------------------


        // FUNCTION | Current Zoom Scale — Screen Pixels per SVG Unit
        // ------------------------------------------------------------
        Na__ViewBoxController__GetScale() {
            if (!this._svgEl) return 1;
            const rect = this._svgEl.getBoundingClientRect();
            return rect.width / this._viewBox.w;                         // <-- px-per-unit uniform scale
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
            if (!this._isPanning || !this._svgEl) return;

            const rect = this._svgEl.getBoundingClientRect();
            const dx   = event.clientX - this._panLastPos.x;            // <-- Screen-space delta
            const dy   = event.clientY - this._panLastPos.y;
            this._panLastPos = { x: event.clientX, y: event.clientY };

            this._viewBox.x -= dx * (this._viewBox.w / rect.width);     // <-- Convert px delta to SVG units
            this._viewBox.y -= dy * (this._viewBox.h / rect.height);
            this._applyViewBox();
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


        // FUNCTION | Handle Scroll Wheel Zoom (Centred on Cursor)
        // ------------------------------------------------------------
        Na__ViewBoxController__OnWheel(event) {
            if (!this._svgEl) return;

            const nav      = this._navConfig();
            const invert   = this._mouseConfig()?.Wheel__InvertDirection === true;
            const zoomIn   = invert ? event.deltaY > 0 : event.deltaY < 0;
            const factor   = zoomIn ? nav.wheelFactor : 1 / nav.wheelFactor;

            this._zoomAtPoint(event.clientX, event.clientY, factor);
        }
        // ------------------------------------------------------------


        // FUNCTION | Step Zoom In/Out Centred on the Viewport Middle
        // ------------------------------------------------------------
        Na__ViewBoxController__StepZoom(zoomIn) {
            if (!this._svgEl) return;
            const nav    = this._navConfig();
            const rect   = this._svgEl.getBoundingClientRect();
            const factor = zoomIn ? nav.stepFactor : 1 / nav.stepFactor;
            this._zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
        }
        // ------------------------------------------------------------


        // FUNCTION | Fit the View to the Bounding Box of All SVG Content
        // ------------------------------------------------------------
        Na__ViewBoxController__FitToDrawing() {
            if (!this._svgEl) return;

            try {
                const bbox = this._svgEl.getBBox();                      // <-- SVG intrinsic bounding box

                if (!bbox || (bbox.width === 0 && bbox.height === 0)) {
                    this._resetToDefault();                              // <-- Nothing rendered yet
                    return;
                }

                const rect    = this._svgEl.getBoundingClientRect();
                const margin  = this._navConfig().fitMargin;
                const scaleX  = (rect.width  - margin * 2) / bbox.width;
                const scaleY  = (rect.height - margin * 2) / bbox.height;
                const scale   = Math.min(scaleX, scaleY);                // <-- Uniform px-per-unit to fit both axes

                const w = rect.width  / scale;
                const h = rect.height / scale;

                this._viewBox = {
                    x : bbox.x + bbox.width  / 2 - w / 2,               // <-- Centre drawing in viewport
                    y : bbox.y + bbox.height / 2 - h / 2,
                    w : w,
                    h : h,
                };
                this._applyViewBox();

            } catch (err) {
                console.warn('[Na__ViewBoxController] getBBox() failed:', err);
                this._resetToDefault();
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Zoom by Factor Keeping the Point Under the Cursor Fixed
        // ------------------------------------------------------------
        _zoomAtPoint(clientX, clientY, factor) {
            const rect     = this._svgEl.getBoundingClientRect();
            const oldScale = rect.width / this._viewBox.w;
            const nav      = this._navConfig();
            const newScale = Math.min(nav.zoomMax, Math.max(nav.zoomMin, oldScale * factor));

            if (newScale === oldScale) return;                           // <-- Already at limit

            const anchor = this.Na__ViewBoxController__ScreenToSvg(clientX, clientY);
            const ratio  = oldScale / newScale;                          // <-- New viewBox size ratio

            this._viewBox.w *= ratio;
            this._viewBox.h *= ratio;
            this._viewBox.x  = anchor.x - (clientX - rect.left) / rect.width  * this._viewBox.w;
            this._viewBox.y  = anchor.y - (clientY - rect.top)  / rect.height * this._viewBox.h;

            this._applyViewBox();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Write the viewBox Attribute and Publish Scale
        // ------------------------------------------------------------
        _applyViewBox() {
            if (!this._svgEl) return;
            const { x, y, w, h } = this._viewBox;
            this._svgEl.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); // <-- True SVG viewBox — crisp at all zooms

            const scale = this.Na__ViewBoxController__GetScale();
            this._appState.viewTransform = { scale, x, y, w, h };        // <-- Publish for tools and status bar
            this._eventBus.emit('zoom:changed', { scale });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Keep viewBox Aspect Matched to the Container
        // ------------------------------------------------------------
        _syncAspect() {
            if (!this._svgEl) return;
            const rect = this._svgEl.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            this._viewBox.h = this._viewBox.w * (rect.height / rect.width); // <-- Height follows container aspect
            this._applyViewBox();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Reset to the Default Empty-Canvas View
        // ------------------------------------------------------------
        _resetToDefault() {
            if (!this._svgEl) {
                this._viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
                return;
            }
            const rect = this._svgEl.getBoundingClientRect();
            const w    = rect.width  || 1000;
            const h    = rect.height || 1000;
            this._viewBox = { x: -w / 2, y: -h / 2, w, h };             // <-- Origin centred, 1:1 px scale
            this._applyViewBox();
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Read Navigation Config with Fallback Defaults
        // ------------------------------------------------------------
        _navConfig() {
            const cfg = this._appState.config?.Config__Navigation || {};
            return {
                zoomMin     : cfg.Zoom__Min              ?? Na__VIEW_ZOOM_MIN,
                zoomMax     : cfg.Zoom__Max              ?? Na__VIEW_ZOOM_MAX,
                wheelFactor : cfg.Zoom__WheelFactor      ?? Na__VIEW_ZOOM_FACTOR,
                stepFactor  : cfg.Zoom__ButtonStepFactor ?? Na__VIEW_STEP_FACTOR,
                fitMargin   : cfg.Fit__Margin_px         ?? Na__VIEW_FIT_MARGIN_PX,
            };
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Read Mouse Controls Config (Keybindings JSON)
        // ------------------------------------------------------------
        _mouseConfig() {
            return this._appState.controls?.Controls__Mouse || null;    // <-- Loaded by Keybindings module
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------
