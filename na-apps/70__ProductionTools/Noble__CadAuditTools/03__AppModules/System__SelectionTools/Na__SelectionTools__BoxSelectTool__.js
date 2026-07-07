// =============================================================================
// NOBLE CAD AUDIT TOOLS - BOX SELECT TOOL
// =============================================================================
//
// FILE      : Na__SelectionTools__BoxSelectTool__.js
// NAMESPACE : CadAuditTools.SelectionTools
// MODULE    : BoxSelectTool
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Rubber-band box selection with Window and Crossing modes
// CREATED   : 07-Jul-2026
//
// DESCRIPTION:
// - Implements the two-mode box selection that is standard in professional CAD:
//     Window   (left-to-right drag, solid blue rect)  — only fully-enclosed entities
//     Crossing (right-to-left drag, dashed green rect) — any entity touching the box
// - Drag direction is determined automatically by comparing start vs end X positions.
// - Subscribes to canvas EventBus events: boxselect:start, boxselect:drag, boxselect:end.
// - On boxselect:end, runs hit testing against AppState.entities using GeometryHelpers.
// - Emits "selection:box-complete" with the array of matched entity objects.
// - Renders the rubber-band rectangle as a positioned <div> overlay on the canvas container.
//
// TODO (follow-up): The hit testing currently checks entity bounding boxes only.
//   Full accuracy requires testing actual entity geometry (e.g. a LINE that has
//   its bounding box overlapping the selection rect but doesn't actually cross it).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jul-2026 - Version 0.1.0
// - Initial scaffold release — rubber-band overlay wired, hit-testing stubbed.
//
// =============================================================================

import {
    Na__Geom__NormaliseRect,
    Na__Geom__RectContainsRect,
    Na__Geom__RectIntersectsRect,
    Na__Geom__GetEntityBoundingBox,
} from '../03__CommonUtils/Na__CommonUtils__GeometryHelpers__.js';


// -----------------------------------------------------------------------------
// REGION | BoxSelectTool Class
// -----------------------------------------------------------------------------

    export class Na__SelectionTools__BoxSelectTool {

        // SUB FUNCTION | Constructor
        // ------------------------------------------------------------
        constructor(appState, eventBus, cadCanvas, selectionManager) {
            this._appState        = appState;
            this._eventBus        = eventBus;
            this._cadCanvas       = cadCanvas;
            this._selectionManager = selectionManager;

            this._isActive        = false;                               // <-- True while drag is in progress
            this._startScreen     = { x: 0, y: 0 };                    // <-- Drag start in screen pixels
            this._endScreen       = { x: 0, y: 0 };                    // <-- Current drag end in screen pixels
            this._currentMode     = 'window';                           // <-- 'window' or 'crossing'

            this._rectOverlayEl   = null;                               // <-- Rubber-band div element
            this._containerEl     = document.getElementById('Na__App__CanvasContainer');

            this._createRubberBandRect();
            this._bindEventBusListeners();
        }
        // ------------------------------------------------------------


        // FUNCTION | Create the Rubber-Band Rectangle Overlay Div
        // ------------------------------------------------------------
        _createRubberBandRect() {
            const el = document.createElement('div');
            el.className        = 'na-box-select-rect';
            el.style.display    = 'none';
            el.style.position   = 'absolute';
            el.style.pointerEvents = 'none';
            if (this._containerEl) this._containerEl.appendChild(el);  // <-- Add to canvas container
            this._rectOverlayEl = el;
        }
        // ------------------------------------------------------------


        // FUNCTION | Bind EventBus Listeners for Canvas Pointer Events
        // ------------------------------------------------------------
        _bindEventBusListeners() {
            this._eventBus.on('boxselect:start', ({ screen }) => {
                this._onStart(screen);
            });
            this._eventBus.on('boxselect:drag', ({ screen }) => {
                this._onDrag(screen);
            });
            this._eventBus.on('boxselect:end', ({ screen }) => {
                this._onEnd(screen);
            });
            this._eventBus.on('file:cleared', () => {
                this._hideRubberBand();
                this._isActive = false;
            });
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Start of Box Select Drag
        // ------------------------------------------------------------
        _onStart(screen) {
            if (this._appState.activeTool !== 'box-window' &&
                this._appState.activeTool !== 'box-crossing') return;

            this._isActive     = true;
            this._startScreen  = { ...screen };
            this._endScreen    = { ...screen };
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle Drag Update — Update Rubber-Band Rectangle
        // ------------------------------------------------------------
        _onDrag(screen) {
            if (!this._isActive) return;
            this._endScreen = { ...screen };

            const dx = this._endScreen.x - this._startScreen.x;        // <-- +ve = left-to-right = Window
            this._currentMode = dx >= 0 ? 'window' : 'crossing';       // <-- Determine mode from drag direction

            this._updateRubberBandRect();
        }
        // ------------------------------------------------------------


        // FUNCTION | Handle End of Drag — Run Hit Test and Emit Selection
        // ------------------------------------------------------------
        _onEnd(screen) {
            if (!this._isActive) return;
            this._isActive  = false;
            this._endScreen = { ...screen };

            this._hideRubberBand();

            const containerRect = this._containerEl?.getBoundingClientRect();
            if (!containerRect) return;

            // Convert screen rect to SVG drawing space
            const transform = this._appState.viewTransform;
            const selRect   = Na__BoxSelect__ScreenRectToSvgRect(
                this._startScreen,
                this._endScreen,
                containerRect,
                transform
            );

            // Determine mode from drag direction
            const dx = this._endScreen.x - this._startScreen.x;
            const mode = dx >= 0 ? 'window' : 'crossing';

            // Run hit test against all non-deleted entities
            const matched = this._runHitTest(selRect, mode);

            this._eventBus.emit('selection:box-complete', matched);      // <-- Pass matched entities to SelectionManager
        }
        // ------------------------------------------------------------


        // FUNCTION | Run Hit Test — Find Entities Inside/Touching the Selection Rect
        // ------------------------------------------------------------
        _runHitTest(selRect, mode) {
            const entities  = this._appState.entities;
            const deleted   = this._appState.deletedHandles;

            if (!entities || entities.length === 0) return [];

            const matched = [];

            entities.forEach((entity) => {
                if (deleted.has(entity.handle)) return;                  // <-- Skip deleted entities

                const bbox = Na__Geom__GetEntityBoundingBox(entity);     // <-- Get entity bounding box
                if (!bbox) return;                                       // <-- Skip entities with no geometry

                if (mode === 'window') {
                    if (Na__Geom__RectContainsRect(selRect, bbox)) matched.push(entity); // <-- Fully inside
                } else {
                    if (Na__Geom__RectIntersectsRect(selRect, bbox)) matched.push(entity); // <-- Any overlap
                }
            });

            console.log(`[Na__BoxSelectTool] ${mode} select: ${matched.length} entities matched`);
            return matched;
        }
        // ------------------------------------------------------------


        // FUNCTION | Update the Rubber-Band Rect Div Position and Style
        // ------------------------------------------------------------
        _updateRubberBandRect() {
            if (!this._rectOverlayEl || !this._containerEl) return;

            const containerRect = this._containerEl.getBoundingClientRect();
            const x1 = this._startScreen.x - containerRect.left;
            const y1 = this._startScreen.y - containerRect.top;
            const x2 = this._endScreen.x   - containerRect.left;
            const y2 = this._endScreen.y   - containerRect.top;

            const left   = Math.min(x1, x2);
            const top    = Math.min(y1, y2);
            const width  = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            // Style based on mode
            const isWindow = this._currentMode === 'window';
            const fill     = isWindow ? 'rgba(37, 99, 235, 0.10)' : 'rgba(34, 197, 94, 0.10)';
            const border   = isWindow
                ? '1.5px dashed #2563eb'
                : '1.5px dashed #22c55e';

            const el = this._rectOverlayEl;
            el.style.display    = 'block';
            el.style.left       = `${left}px`;
            el.style.top        = `${top}px`;
            el.style.width      = `${width}px`;
            el.style.height     = `${height}px`;
            el.style.background = fill;
            el.style.border     = border;
        }
        // ------------------------------------------------------------


        // FUNCTION | Hide and Reset the Rubber-Band Rectangle
        // ------------------------------------------------------------
        _hideRubberBand() {
            if (this._rectOverlayEl) {
                this._rectOverlayEl.style.display = 'none';
            }
        }
        // ------------------------------------------------------------

    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert a Screen-Space Rect to SVG Drawing Space
    // ------------------------------------------------------------
    function Na__BoxSelect__ScreenRectToSvgRect(startScreen, endScreen, containerRect, transform) {
        const toSvgX = (sx) => (sx - containerRect.left - transform.x) / transform.scale;
        const toSvgY = (sy) => (sy - containerRect.top  - transform.y) / transform.scale;

        return Na__Geom__NormaliseRect(
            toSvgX(startScreen.x),
            toSvgY(startScreen.y),
            toSvgX(endScreen.x),
            toSvgY(endScreen.y)
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
