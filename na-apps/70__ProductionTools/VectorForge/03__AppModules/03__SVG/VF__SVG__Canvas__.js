// =============================================================================
// VECTORFORGE - SVG CANVAS
// =============================================================================
//
// FILE      : VF__SVG__Canvas__.js
// NAMESPACE : VectorForge.SVG
// MODULE    : Canvas
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Creates and manages the live SVG drawing surface and layer groups
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Creates the SVG element, appends the background paper rect, and injects
//   the canvas into the #canvas-container DOM element.
// - Maintains a layerGroups map (layerId → <g> element) so drawing tools can
//   target the correct layer when adding elements.
// - Translates mouse events from screen coordinates to SVG coordinates via
//   getScreenCTM, applying grid-snap rounding when AppState.snapToGrid is true.
// - Listens to layers:changed to add new layer groups and remove deleted ones.
// - Renders an SVG dot-grid overlay (#canvas-dot-grid) above all layer content
//   using an in-SVG <pattern>, ensuring dots zoom/pan with the canvas.
// - ensureEditorChrome() restores the paper rect and dot-grid after any external
//   DOM manipulation (e.g. code-panel sync). _maintainOverlayOrder() keeps the
//   grid and point-edit overlay at the top of the SVG child stack at all times.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.2.0
// - Dot grid now starts hidden (matches snapToGrid initial false state).
// - Added setDotGridVisible(visible) so the snap toggle can show/hide the grid.
// - ensureEditorChrome() respects current snapToGrid state when restoring grid.
//
// 26-Jun-2026 - Version 1.1.0
// - Added SVG dot-grid overlay (#canvas-dot-grid) above all layer content.
// - Added ensureEditorChrome() to restore paper + grid after code-panel sync.
// - Added _maintainOverlayOrder() to keep dot-grid below point-edit handles.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release. Refactored from prototype to ValeDesignSuite conventions.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | SVGCanvas Class
// -----------------------------------------------------------------------------

    // CLASS | SVGCanvas — Live SVG Drawing Surface and Layer Manager
    // ------------------------------------------------------------
    export class SVGCanvas {

        // FUNCTION | Constructor — Create SVG Element, Background, Dot Grid, and Initial Layer
        // ------------------------------------------------------------
        constructor(appState, eventBus, viewBoxController) {
            this.appState    = appState;    // <-- App state reference
            this.eventBus    = eventBus;    // <-- Event bus reference
            this.layerGroups = {};          // <-- Map of layerId → <g> element

            this.container = document.getElementById('canvas-container'); // <-- Canvas host element

            this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.svg.style.width  = '100%';
            this.svg.style.height = '100%';
            this.svg.setAttribute('viewBox', `0 0 ${appState.canvasWidth} ${appState.canvasHeight}`);

            this.canvasRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            this.canvasRect.id = 'canvas-paper';
            this.canvasRect.setAttribute('width',  appState.canvasWidth);
            this.canvasRect.setAttribute('height', appState.canvasHeight);
            this.canvasRect.setAttribute('fill',   '#ffffff');              // <-- White paper background
            this.svg.appendChild(this.canvasRect);

            this._createDotGridPattern(); // <-- Inject <defs> dot pattern and overlay rect above paper

            this._createLayerGroup(appState.activeLayerId); // <-- Create initial default layer

            this.container.appendChild(this.svg);

            this.svg.addEventListener('mousemove', (e) => {
                const pt = this.getSVGPoint(e);
                this.eventBus.emit('cursor:moved', pt); // <-- Broadcast cursor position for status bar
            });

            this.eventBus.on('layers:changed', () => this._updateLayers()); // <-- Sync layer groups on change
        }
        // ------------------------------------------------------------


        // FUNCTION | GetSVGPoint — Convert a Mouse Event to SVG Coordinate Space
        // ------------------------------------------------------------
        getSVGPoint(e) {
            const pt = this.svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgPt = pt.matrixTransform(this.svg.getScreenCTM().inverse()); // <-- Apply inverse CTM

            if (this.appState.snapToGrid) {
                const gridSize = this.appState.gridSize || 10;
                svgPt.x = Math.round(svgPt.x / gridSize) * gridSize; // <-- Snap to nearest grid column
                svgPt.y = Math.round(svgPt.y / gridSize) * gridSize; // <-- Snap to nearest grid row
            }

            return svgPt;
        }
        // ------------------------------------------------------------


        // FUNCTION | AddElement — Append a New SVG Element to the Active Layer Group
        // ------------------------------------------------------------
        addElement(el) {
            const layerId = this.appState.activeLayerId;
            if (this.layerGroups[layerId]) {
                this.layerGroups[layerId].appendChild(el); // <-- Add to active layer group
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | EnsureEditorChrome — Restore Paper Rect and Dot-Grid Overlay After External DOM Changes
        // ------------------------------------------------------------
        ensureEditorChrome() {
            const w = this.appState.canvasWidth;
            const h = this.appState.canvasHeight;

            if (!this.svg.querySelector('#canvas-paper')) {
                const paper = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                paper.id = 'canvas-paper';
                paper.setAttribute('width',  w);
                paper.setAttribute('height', h);
                paper.setAttribute('fill',   '#ffffff');                        // <-- Restore white paper background
                this.svg.insertBefore(paper, this.svg.firstChild);
                this.canvasRect = paper;
            }

            if (!this.svg.querySelector('#vf-dot-grid')) {
                this._createDotGridPattern(); // <-- Re-inject missing dot pattern and overlay rect
            }

            this._maintainOverlayOrder();                              // <-- Re-sort chrome to top of child stack
            this.setDotGridVisible(this.appState.snapToGrid);          // <-- Restore visibility to match current snap state
        }
        // ------------------------------------------------------------


        // FUNCTION | SetDotGridVisible — Show or Hide the Dot-Grid Overlay
        // ------------------------------------------------------------
        setDotGridVisible(visible) {
            const dotGrid = this.svg.querySelector('#canvas-dot-grid');
            if (dotGrid) dotGrid.style.display = visible ? '' : 'none'; // <-- Toggle display without removing from DOM
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | CreateDotGridPattern — Inject <defs> Dot Pattern and Overlay Rect into SVG
        // ------------------------------------------------------------
        _createDotGridPattern() {
            const ns = 'http://www.w3.org/2000/svg';

            const defs = document.createElementNS(ns, 'defs');
            defs.id = 'vf-editor-defs';

            const pattern = document.createElementNS(ns, 'pattern');
            pattern.id = 'vf-dot-grid';
            pattern.setAttribute('patternUnits', 'userSpaceOnUse'); // <-- Coords match SVG user units — dots zoom and pan with viewBox
            pattern.setAttribute('width',  '20');
            pattern.setAttribute('height', '20');

            const dot = document.createElementNS(ns, 'circle');
            dot.setAttribute('cx',   '0');
            dot.setAttribute('cy',   '0');
            dot.setAttribute('r',    '0.8');                        // <-- Subtle 0.8 px radius dot
            dot.setAttribute('fill', '#94a3b8');                    // <-- slate-400, matches former CSS colour

            pattern.appendChild(dot);
            defs.appendChild(pattern);
            this.svg.appendChild(defs);

            const gridRect = document.createElementNS(ns, 'rect');
            gridRect.id = 'canvas-dot-grid';
            gridRect.setAttribute('width',          this.appState.canvasWidth);
            gridRect.setAttribute('height',         this.appState.canvasHeight);
            gridRect.setAttribute('fill',           'url(#vf-dot-grid)');
            gridRect.setAttribute('pointer-events', 'none');                     // <-- Transparent to all mouse events
            gridRect.style.display = this.appState.snapToGrid ? '' : 'none';    // <-- Hidden unless snap is active
            this.svg.appendChild(gridRect);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | MaintainOverlayOrder — Move Dot-Grid and Point-Edit Overlay to End of SVG Stack
        // ------------------------------------------------------------
        _maintainOverlayOrder() {
            const dotGrid = this.svg.querySelector('#canvas-dot-grid');
            const ptEdit  = this.svg.querySelector('#vf-point-edit-overlay');

            if (dotGrid) this.svg.appendChild(dotGrid); // <-- Renders above all layer <g> elements
            if (ptEdit)  this.svg.appendChild(ptEdit);  // <-- Point-edit handles stay above the dot grid
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | CreateLayerGroup — Create a <g> Element for a New Layer
        // ------------------------------------------------------------
        _createLayerGroup(id) {
            if (!this.layerGroups[id]) {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('data-layer-id', id);
                this.svg.appendChild(g);
                this.layerGroups[id] = g;         // <-- Register in group map
                this._maintainOverlayOrder();     // <-- Keep overlays above the new layer group
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | UpdateLayers — Sync SVG <g> Elements to the Current Layer Stack
        // ------------------------------------------------------------
        _updateLayers() {
            const layerIds = this.appState.layers.map(l => l.id);

            for (const id in this.layerGroups) {
                if (!layerIds.includes(id)) {
                    this.layerGroups[id].remove();    // <-- Remove group for deleted layer
                    delete this.layerGroups[id];
                }
            }

            this.appState.layers.forEach(l => {
                this._createLayerGroup(l.id);
                this.layerGroups[l.id].setAttribute('data-layer-name', l.name); // <-- Keep name attribute current
            });
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
