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
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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

        // FUNCTION | Constructor — Create SVG Element, Background, and Initial Layer
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


        // HELPER FUNCTION | CreateLayerGroup — Create a <g> Element for a New Layer
        // ------------------------------------------------------------
        _createLayerGroup(id) {
            if (!this.layerGroups[id]) {
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('data-layer-id', id);
                this.svg.appendChild(g);
                this.layerGroups[id] = g; // <-- Register in group map
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
