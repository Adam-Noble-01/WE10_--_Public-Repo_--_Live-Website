// =============================================================================
// VECTORFORGE - VIEW BOX CONTROLLER
// =============================================================================
//
// FILE      : VF__Navigation__ViewBoxController__.js
// NAMESPACE : VectorForge.Navigation
// MODULE    : ViewBoxController
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Manages SVG viewBox for zoom (mouse wheel) and pan (right/middle click)
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Attaches wheel, mousedown, mousemove, and mouseup listeners to the canvas
//   container to support scroll-to-zoom and right/middle-click drag-to-pan.
// - Maintains a viewBox state object and applies it to the SVG element.
// - Emits zoom:changed on the EventBus after every viewBox update so the
//   status bar can display the current zoom percentage.
// - SVG and container references are resolved after a short delay to ensure
//   SVGCanvas has appended the SVG element to the DOM first.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | ViewBoxController Class
// -----------------------------------------------------------------------------

    // CLASS | ViewBoxController — SVG Zoom and Pan Navigation Controller
    // ------------------------------------------------------------
    export class ViewBoxController {

        // FUNCTION | Constructor — Initialise ViewBox State and Defer Event Setup
        // ------------------------------------------------------------
        constructor(appState, eventBus) {
            this.appState  = appState;  // <-- App state reference
            this.eventBus  = eventBus;  // <-- Event bus reference
            this.viewBox   = { x: 0, y: 0, w: appState.canvasWidth, h: appState.canvasHeight }; // <-- Initial viewBox
            this.zoom      = 1;         // <-- Zoom multiplier (1 = 100%)
            this.container = null;      // <-- Resolved after SVGCanvas appends SVG to DOM
            this.svg       = null;      // <-- Resolved after SVGCanvas appends SVG to DOM

            setTimeout(() => {
                this.container = document.getElementById('canvas-container');
                this.svg       = this.container.querySelector('svg');
                this._setupEvents();   // <-- Defer until SVG is in the DOM
                this._updateViewBox();
            }, 100);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | SetupEvents — Attach Wheel, Pan Mouse Listeners to Container
        // ------------------------------------------------------------
        _setupEvents() {
            let isPanning    = false;   // <-- Pan drag state flag
            let lastPanPoint = null;    // <-- Previous mouse position during pan

            this.container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const pt    = this._getSVGPoint(e);
                const scale = e.deltaY > 0 ? 1.1 : 0.9;     // <-- Zoom out/in on scroll direction
                this.zoom        *= scale;
                this.viewBox.w   *= scale;
                this.viewBox.h   *= scale;
                this.viewBox.x    = pt.x - (e.clientX - this.container.getBoundingClientRect().left)  * (this.viewBox.w / this.container.clientWidth);
                this.viewBox.y    = pt.y - (e.clientY - this.container.getBoundingClientRect().top)   * (this.viewBox.h / this.container.clientHeight);
                this._updateViewBox();
            }, { passive: false });

            this.container.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // <-- Suppress browser context menu on canvas
            });

            this.container.addEventListener('mousedown', (e) => {
                if (e.button === 2 || e.button === 1) { // <-- Right or middle button starts pan
                    isPanning              = true;
                    lastPanPoint           = { x: e.clientX, y: e.clientY };
                    this.container.style.cursor = 'grabbing';
                }
            });

            window.addEventListener('mousemove', (e) => {
                if (!isPanning || !lastPanPoint) return;
                const dx = e.clientX - lastPanPoint.x;
                const dy = e.clientY - lastPanPoint.y;
                this._pan(dx, dy);
                lastPanPoint = { x: e.clientX, y: e.clientY };
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 2 || e.button === 1) {
                    isPanning              = false;
                    lastPanPoint           = null;
                    this.container.style.cursor = ''; // <-- Restore default cursor after pan
                }
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | GetSVGPoint — Convert Mouse Event to SVG Coordinate
        // ------------------------------------------------------------
        _getSVGPoint(e) {
            const pt = this.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            return pt.matrixTransform(this.svg.getScreenCTM().inverse()); // <-- Apply inverse screen CTM
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | UpdateViewBox — Apply Current ViewBox State to SVG and Emit Event
        // ------------------------------------------------------------
        _updateViewBox() {
            this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`);
            this.eventBus.emit('zoom:changed', (1 / this.zoom) * 100); // <-- Emit inverse zoom as percentage
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Pan — Offset ViewBox by a Screen-Space Delta
        // ------------------------------------------------------------
        _pan(dx, dy) {
            const scaleX    = this.viewBox.w / this.container.clientWidth;   // <-- SVG units per screen pixel X
            const scaleY    = this.viewBox.h / this.container.clientHeight;  // <-- SVG units per screen pixel Y
            this.viewBox.x -= dx * scaleX;
            this.viewBox.y -= dy * scaleY;
            this._updateViewBox();
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
