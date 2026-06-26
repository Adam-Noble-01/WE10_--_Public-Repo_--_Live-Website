// =============================================================================
// VECTORFORGE - POINT EDIT MANAGER
// =============================================================================
//
// FILE      : VF__AppCore__PointEditManager__.js
// NAMESPACE : VectorForge.AppCore
// MODULE    : PointEditManager
// AUTHOR    : Adam Noble - Noble Architecture
// PURPOSE   : Vector point edit mode — renders draggable handles on selected
//             path, line, and rect elements for direct point manipulation
// CREATED   : 26-Jun-2026
//
// DESCRIPTION:
// - Manages a dedicated SVG overlay group (<g id="vf-point-edit-overlay">)
//   appended above all drawing layers, containing circle handles for each
//   editable coordinate point on the selected element.
// - Activated by toggling appState.pointEditMode via the toggle button (UI)
//   or the E keyboard shortcut (hotkey:togglePointEdit event).
// - On activation, shows handles for the currently selected element if any.
// - Listens to selection:changed to refresh handles when selection changes.
// - Handles mousedown on a handle → mousemove on SVG → mouseup drag sequence.
//   Coordinates are read via svgCanvas.getSVGPoint (respects snap-to-grid).
// - Holding Shift during a handle drag constrains movement to the nearest
//   orthogonal axis (H or V) relative to the opposite anchor point:
//     <line>  — anchor is the non-dragged endpoint
//     <path>  — anchor is the previous absolute vertex in pathCommands
// - Element type support:
//     <line>  — two endpoint handles (x1/y1, x2/y2)
//     <rect>  — four corner handles (TL, TR, BR, BL); all corners sync on drag
//     <path>  — one handle per M/L/C/Q/A absolute coordinate; H and V are
//               normalised to L during parsing; relative commands converted to
//               absolute; bezier control points rendered as smaller handles
// - On mouseup, the SVG element's own mouseup event fires, triggering the
//   UndoManager's debounced snapshot automatically — no extra undo wiring needed.
// - Emits pointEditMode:changed(bool) on the EventBus after each mode toggle
//   so Main.js can update the toggle button appearance.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Jun-2026 - Version 1.1.0
// - Shift key orthogonal axis lock added to line and path handle drags.
//
// 26-Jun-2026 - Version 1.0.0
// - Initial stable release.
//
// =============================================================================


import { VF__CommonUtils__ConstrainPointToOrtho } from '../03__CommonUtils/VF__CommonUtils__OrthoConstraint__.js';

// -----------------------------------------------------------------------------
// REGION | PointEditManager Class
// -----------------------------------------------------------------------------

    // CLASS | PointEditManager — Vector Point Handle Overlay and Drag Controller
    // ------------------------------------------------------------
    export class PointEditManager {

        // FUNCTION | Constructor — Set Up Overlay Group and Wire Event Bus Listeners
        // ------------------------------------------------------------
        constructor(appState, eventBus, svgCanvas) {
            this.appState      = appState;   // <-- App state reference
            this.eventBus      = eventBus;   // <-- Event bus reference
            this.svgCanvas     = svgCanvas;  // <-- SVG canvas reference

            this.overlayGroup  = null;       // <-- SVG <g> containing all handles
            this.editElement   = null;       // <-- The SVG element currently showing handles
            this.handles       = [];         // <-- Array of { circle, type, ... } descriptors
            this.dragState     = null;       // <-- Active drag operation or null
            this.pathCommands  = null;       // <-- Parsed path commands for <path> elements
            this._boundMove    = null;       // <-- Stored mousemove handler for cleanup
            this._boundUp      = null;       // <-- Stored mouseup handler for cleanup
            this._lastSelection = [];        // <-- Cached last selection:changed payload

            this._setupOverlay();
            this._bindEvents();
        }
        // ------------------------------------------------------------


        // FUNCTION | SetupOverlay — Create the Handle Overlay Group in the SVG Root
        // ------------------------------------------------------------
        _setupOverlay() {
            this.overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.overlayGroup.setAttribute('id', 'vf-point-edit-overlay');

            // Stop click propagation so SelectionManager does not select handle circles
            this.overlayGroup.addEventListener('click',     (e) => this._onOverlayClick(e));
            this.overlayGroup.addEventListener('mousedown', (e) => this._onHandleMouseDown(e));

            this.svgCanvas.svg.appendChild(this.overlayGroup);
        }
        // ------------------------------------------------------------


        // FUNCTION | BindEvents — Register EventBus Listeners
        // ------------------------------------------------------------
        _bindEvents() {
            this.eventBus.on('selection:changed', (elements) => {
                this._lastSelection = elements;                         // <-- Cache for use when mode is toggled on
                if (this.appState.pointEditMode) {
                    this._refreshHandles(elements);                     // <-- Update handles immediately if mode is active
                }
            });

            this.eventBus.on('hotkey:togglePointEdit', () => this.toggleMode()); // <-- E key shortcut
        }
        // ------------------------------------------------------------


        // FUNCTION | ToggleMode — Flip Point Edit Mode On or Off
        // ------------------------------------------------------------
        toggleMode() {
            this.appState.pointEditMode = !this.appState.pointEditMode;
            this.eventBus.emit('pointEditMode:changed', this.appState.pointEditMode); // <-- Notify Main.js to update button

            if (this.appState.pointEditMode) {
                this._refreshHandles(this._lastSelection); // <-- Show handles for current selection immediately
            } else {
                this._clearHandles();                      // <-- Remove all handles on deactivation
            }
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | RefreshHandles — Re-render Handles for the Given Selection
        // ------------------------------------------------------------
        _refreshHandles(elements) {
            this._clearHandles();
            if (elements.length !== 1) return; // <-- Only show handles for a single selection

            const el  = elements[0];
            const tag = el.tagName.toLowerCase();

            if (!['line', 'rect', 'path'].includes(tag)) return; // <-- Only supported element types

            this.editElement = el;
            this._buildHandlesFor(el, tag);
            this._attachSvgDragListeners();
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | BuildHandlesFor — Dispatch to the Correct Handle Builder
        // ------------------------------------------------------------
        _buildHandlesFor(el, tag) {
            if (tag === 'line') this._buildLineHandles(el);
            if (tag === 'rect') this._buildRectHandles(el);
            if (tag === 'path') this._buildPathHandles(el);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | BuildLineHandles — Two Endpoint Handles for <line>
        // ------------------------------------------------------------
        _buildLineHandles(el) {
            const pts = [
                { x: parseFloat(el.getAttribute('x1')), y: parseFloat(el.getAttribute('y1')), index: 0 },
                { x: parseFloat(el.getAttribute('x2')), y: parseFloat(el.getAttribute('y2')), index: 1 },
            ];
            pts.forEach(pt => {
                const circle = this._makeHandle(pt.x, pt.y, false);
                circle.dataset.hType  = 'line';
                circle.dataset.hIndex = pt.index;
                this.overlayGroup.appendChild(circle);
                this.handles.push({ circle, type: 'line', index: pt.index });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | BuildRectHandles — Four Corner Handles for <rect>
        // ------------------------------------------------------------
        _buildRectHandles(el) {
            const x = parseFloat(el.getAttribute('x')      || 0);
            const y = parseFloat(el.getAttribute('y')      || 0);
            const w = parseFloat(el.getAttribute('width')  || 0);
            const h = parseFloat(el.getAttribute('height') || 0);

            const corners = [
                { cx: x,     cy: y,     role: 'tl' },
                { cx: x + w, cy: y,     role: 'tr' },
                { cx: x + w, cy: y + h, role: 'br' },
                { cx: x,     cy: y + h, role: 'bl' },
            ];

            corners.forEach(c => {
                const circle = this._makeHandle(c.cx, c.cy, false);
                circle.dataset.hType = 'rect';
                circle.dataset.role  = c.role;
                this.overlayGroup.appendChild(circle);
                this.handles.push({ circle, type: 'rect', role: c.role });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | BuildPathHandles — One Handle Per Coordinate in <path>
        // ------------------------------------------------------------
        _buildPathHandles(el) {
            this.pathCommands = this._parsePath(el.getAttribute('d') || '');

            this.pathCommands.forEach((cmd, ci) => {
                if (!cmd.coords || cmd.coords.length === 0) return;
                cmd.coords.forEach((coord, pi) => {
                    const circle = this._makeHandle(coord.x, coord.y, coord.isControl);
                    circle.dataset.hType = 'path';
                    circle.dataset.ci    = ci;
                    circle.dataset.pi    = pi;
                    this.overlayGroup.appendChild(circle);
                    this.handles.push({ circle, type: 'path', ci, pi });
                });
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | MakeHandle — Create a Styled SVG Circle Handle
        // ------------------------------------------------------------
        _makeHandle(x, y, isControl) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r',  isControl ? 3.5 : 5);      // <-- Control points are smaller
            circle.classList.add('vf-point-handle');
            if (isControl) circle.classList.add('vf-control-handle');
            return circle;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | AttachSvgDragListeners — Listen for Drag Move and Release on SVG
        // ------------------------------------------------------------
        _attachSvgDragListeners() {
            this._boundMove = (e) => this._onSvgMouseMove(e);
            this._boundUp   = (e) => this._onSvgMouseUp(e);
            this.svgCanvas.svg.addEventListener('mousemove', this._boundMove);
            this.svgCanvas.svg.addEventListener('mouseup',   this._boundUp);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | ClearHandles — Remove All Handles and Listeners
        // ------------------------------------------------------------
        _clearHandles() {
            if (this.overlayGroup) this.overlayGroup.innerHTML = ''; // <-- Remove all child handle circles

            if (this._boundMove) {
                this.svgCanvas.svg.removeEventListener('mousemove', this._boundMove); // <-- Clean up move listener
                this.svgCanvas.svg.removeEventListener('mouseup',   this._boundUp);   // <-- Clean up up listener
                this._boundMove = null;
                this._boundUp   = null;
            }

            this.handles      = [];
            this.editElement  = null;
            this.pathCommands = null;
            this.dragState    = null;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnOverlayClick — Stop Click Propagation from Handle Circles
        // ------------------------------------------------------------
        _onOverlayClick(e) {
            if (e.target.classList.contains('vf-point-handle')) {
                e.stopPropagation(); // <-- Prevent SelectionManager from seeing handle clicks
            }
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnHandleMouseDown — Begin a Drag Operation
        // ------------------------------------------------------------
        _onHandleMouseDown(e) {
            if (e.button !== 0) return;
            if (!e.target.classList.contains('vf-point-handle')) return;

            e.stopPropagation(); // <-- Prevent drawing tools and SelectionManager from seeing this

            this.dragState = {
                circle : e.target,
                hType  : e.target.dataset.hType,
                hIndex : parseInt(e.target.dataset.hIndex),  // <-- Used by line handles
                role   : e.target.dataset.role,              // <-- Used by rect handles
                ci     : parseInt(e.target.dataset.ci),      // <-- Command index for path handles
                pi     : parseInt(e.target.dataset.pi),      // <-- Point index within command
            };
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnSvgMouseMove — Update Element Geometry During Drag
        // ------------------------------------------------------------
        _onSvgMouseMove(e) {
            if (!this.dragState) return;
            const raw = this.svgCanvas.getSVGPoint(e); // <-- Converts to SVG coords, applies snap if active
            const pt  = e.shiftKey ? this._resolveOrthoPoint(raw.x, raw.y) : raw; // <-- Constrain if Shift held
            this._applyHandleDrag(pt.x, pt.y);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | ResolveOrthoPoint — Constrain Drag Position to Ortho Axis from Anchor
        // ------------------------------------------------------------
        _resolveOrthoPoint(newX, newY) {
            const ds = this.dragState;
            const el = this.editElement;

            if (ds.hType === 'line') {
                // Anchor is the opposite endpoint
                const anchorAttr = ds.hIndex === 0 ? ['x2', 'y2'] : ['x1', 'y1']; // <-- Non-dragged endpoint attributes
                const anchorX    = parseFloat(el.getAttribute(anchorAttr[0]));
                const anchorY    = parseFloat(el.getAttribute(anchorAttr[1]));
                return VF__CommonUtils__ConstrainPointToOrtho(anchorX, anchorY, newX, newY, true);
            }

            if (ds.hType === 'path') {
                const commands = this.pathCommands;
                const ci       = ds.ci;
                let anchorX, anchorY;

                if (ci > 0) {
                    // Anchor is the last coordinate of the previous command
                    const prevCmd   = commands[ci - 1];
                    const prevCoord = prevCmd.coords[prevCmd.coords.length - 1];
                    anchorX = prevCoord.x;
                    anchorY = prevCoord.y;
                } else {
                    // First command (M) — anchor to the next command's endpoint if available
                    const nextCmd = commands.length > 1 ? commands[1] : null;
                    if (nextCmd && nextCmd.coords.length > 0) {
                        const nextCoord = nextCmd.coords[nextCmd.coords.length - 1];
                        anchorX = nextCoord.x;
                        anchorY = nextCoord.y;
                    } else {
                        return { x: newX, y: newY }; // <-- No viable anchor, no constraint
                    }
                }
                return VF__CommonUtils__ConstrainPointToOrtho(anchorX, anchorY, newX, newY, true);
            }

            return { x: newX, y: newY }; // <-- Rect and unknown types: no ortho constraint
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | OnSvgMouseUp — Commit the Drag and Clear State
        // ------------------------------------------------------------
        _onSvgMouseUp(e) {
            if (!this.dragState) return;
            this.dragState = null;
            // UndoManager's debounced snapshot fires on the SVG mouseup event automatically
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | ApplyHandleDrag — Dispatch Drag Update to Correct Element Handler
        // ------------------------------------------------------------
        _applyHandleDrag(newX, newY) {
            const ds = this.dragState;
            const el = this.editElement;

            if (ds.hType === 'line') this._dragLinePoint(el, ds.hIndex, newX, newY, ds.circle);
            if (ds.hType === 'rect') this._dragRectCorner(el, ds.role, newX, newY);
            if (ds.hType === 'path') this._dragPathPoint(el, ds.ci, ds.pi, newX, newY, ds.circle);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | DragLinePoint — Move a Line Endpoint Handle
        // ------------------------------------------------------------
        _dragLinePoint(el, index, newX, newY, circle) {
            if (index === 0) {
                el.setAttribute('x1', newX); // <-- Update start point x
                el.setAttribute('y1', newY); // <-- Update start point y
            } else {
                el.setAttribute('x2', newX); // <-- Update end point x
                el.setAttribute('y2', newY); // <-- Update end point y
            }
            circle.setAttribute('cx', newX);
            circle.setAttribute('cy', newY);
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | DragRectCorner — Move a Rect Corner and Sync All Four Handles
        // ------------------------------------------------------------
        _dragRectCorner(el, role, newX, newY) {
            const x  = parseFloat(el.getAttribute('x')      || 0);
            const y  = parseFloat(el.getAttribute('y')      || 0);
            const w  = parseFloat(el.getAttribute('width')  || 0);
            const h  = parseFloat(el.getAttribute('height') || 0);

            let nx = x, ny = y, nw = w, nh = h;

            switch (role) {
                case 'tl': nx = newX; ny = newY; nw = (x + w) - newX; nh = (y + h) - newY; break; // <-- TL: shifts origin, shrinks/grows w+h
                case 'tr': ny = newY; nw = newX - x; nh = (y + h) - newY;                   break; // <-- TR: only shifts y and w
                case 'br': nw = newX - x; nh = newY - y;                                    break; // <-- BR: only changes w+h
                case 'bl': nx = newX; nw = (x + w) - newX; nh = newY - y;                   break; // <-- BL: shifts origin x, changes h
            }

            if (nw < 1) nw = 1; // <-- Clamp to prevent negative/zero width
            if (nh < 1) nh = 1; // <-- Clamp to prevent negative/zero height

            el.setAttribute('x',      nx);
            el.setAttribute('y',      ny);
            el.setAttribute('width',  nw);
            el.setAttribute('height', nh);

            // Recompute all four handle positions from the updated geometry
            const updated = { tl: [nx, ny], tr: [nx+nw, ny], br: [nx+nw, ny+nh], bl: [nx, ny+nh] };
            this.handles.forEach(handle => {
                if (handle.type !== 'rect') return;
                const [hx, hy] = updated[handle.role];
                handle.circle.setAttribute('cx', hx);
                handle.circle.setAttribute('cy', hy);
            });
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | DragPathPoint — Move a Single Path Point and Rebuild d
        // ------------------------------------------------------------
        _dragPathPoint(el, ci, pi, newX, newY, circle) {
            this.pathCommands[ci].coords[pi].x = newX; // <-- Update stored coordinate
            this.pathCommands[ci].coords[pi].y = newY;
            el.setAttribute('d', this._buildPath(this.pathCommands)); // <-- Rebuild entire d string
            circle.setAttribute('cx', newX);
            circle.setAttribute('cy', newY);
        }
        // ------------------------------------------------------------


        // FUNCTION | ParsePath — Tokenise and Normalise SVG Path d to Absolute Commands
        // ------------------------------------------------------------
        _parsePath(d) {
            // Tokenise into command letters and numeric values
            const tokenRe = /([MmLlHhVvCcQqAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
            const tokens  = [];
            let m;
            while ((m = tokenRe.exec(d)) !== null) {
                if (m[1]) tokens.push({ type: 'cmd', val: m[1] });
                else      tokens.push({ type: 'num', val: parseFloat(m[2]) });
            }

            const commands = [];
            let i  = 0;
            let cx = 0, cy = 0; // <-- Current pen position (absolute)
            let sx = 0, sy = 0; // <-- Subpath start position (for Z)

            const rn  = () => (tokens[i++]?.val ?? 0);                          // <-- Read next numeric token
            const has = () => i < tokens.length && tokens[i].type === 'num';    // <-- More numbers ahead?

            while (i < tokens.length) {
                if (tokens[i].type !== 'cmd') { i++; continue; }
                const letter = tokens[i++].val;
                const rel    = (letter !== letter.toUpperCase());               // <-- Lowercase = relative
                const cmd    = letter.toUpperCase();

                switch (cmd) {

                    case 'M': {
                        let isFirst = true;
                        do {
                            const x = rel ? cx + rn() : rn();
                            const y = rel ? cy + rn() : rn();
                            cx = x; cy = y;
                            if (isFirst) { sx = cx; sy = cy; }
                            commands.push({ cmd: isFirst ? 'M' : 'L',              // <-- First pair is M; additional pairs are implicit L
                                coords: [{ x, y, isControl: false }] });
                            isFirst = false;
                        } while (has());
                        break;
                    }

                    case 'L': {
                        do {
                            const x = rel ? cx + rn() : rn();
                            const y = rel ? cy + rn() : rn();
                            cx = x; cy = y;
                            commands.push({ cmd: 'L', coords: [{ x, y, isControl: false }] });
                        } while (has());
                        break;
                    }

                    case 'H': {
                        do {
                            cx = rel ? cx + rn() : rn();
                            commands.push({ cmd: 'L', coords: [{ x: cx, y: cy, isControl: false }] }); // <-- Normalise H to L
                        } while (has());
                        break;
                    }

                    case 'V': {
                        do {
                            cy = rel ? cy + rn() : rn();
                            commands.push({ cmd: 'L', coords: [{ x: cx, y: cy, isControl: false }] }); // <-- Normalise V to L
                        } while (has());
                        break;
                    }

                    case 'C': {
                        do {
                            const x1 = rel ? cx + rn() : rn(), y1 = rel ? cy + rn() : rn();
                            const x2 = rel ? cx + rn() : rn(), y2 = rel ? cy + rn() : rn();
                            const x  = rel ? cx + rn() : rn(), y  = rel ? cy + rn() : rn();
                            cx = x; cy = y;
                            commands.push({ cmd: 'C', coords: [
                                { x: x1, y: y1, isControl: true  }, // <-- First control point
                                { x: x2, y: y2, isControl: true  }, // <-- Second control point
                                { x,     y,     isControl: false }, // <-- Endpoint
                            ]});
                        } while (has());
                        break;
                    }

                    case 'Q': {
                        do {
                            const x1 = rel ? cx + rn() : rn(), y1 = rel ? cy + rn() : rn();
                            const x  = rel ? cx + rn() : rn(), y  = rel ? cy + rn() : rn();
                            cx = x; cy = y;
                            commands.push({ cmd: 'Q', coords: [
                                { x: x1, y: y1, isControl: true  }, // <-- Control point
                                { x,     y,     isControl: false }, // <-- Endpoint
                            ]});
                        } while (has());
                        break;
                    }

                    case 'A': {
                        do {
                            const rx       = rn(), ry = rn(), xRot = rn();
                            const largeArc = rn(), sweep = rn();
                            const x        = rel ? cx + rn() : rn();
                            const y        = rel ? cy + rn() : rn();
                            cx = x; cy = y;
                            commands.push({ cmd: 'A', rx, ry, xRot, largeArc, sweep,
                                coords: [{ x, y, isControl: false }] }); // <-- Arc endpoint only
                        } while (has());
                        break;
                    }

                    case 'Z': {
                        commands.push({ cmd: 'Z', coords: [] });
                        cx = sx; cy = sy; // <-- Reset pen to subpath start
                        break;
                    }
                }
            }

            return commands;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | BuildPath — Reconstruct d Attribute String from Parsed Commands
        // ------------------------------------------------------------
        _buildPath(commands) {
            const f = (n) => Math.round(n * 100) / 100; // <-- Round to 2dp for clean output

            return commands.map(cmd => {
                const co = cmd.coords;
                switch (cmd.cmd) {
                    case 'M': return `M ${f(co[0].x)} ${f(co[0].y)}`;
                    case 'L': return `L ${f(co[0].x)} ${f(co[0].y)}`;
                    case 'C': return `C ${f(co[0].x)} ${f(co[0].y)} ${f(co[1].x)} ${f(co[1].y)} ${f(co[2].x)} ${f(co[2].y)}`;
                    case 'Q': return `Q ${f(co[0].x)} ${f(co[0].y)} ${f(co[1].x)} ${f(co[1].y)}`;
                    case 'A': return `A ${cmd.rx} ${cmd.ry} ${cmd.xRot} ${cmd.largeArc} ${cmd.sweep} ${f(co[0].x)} ${f(co[0].y)}`;
                    case 'Z': return 'Z';
                    default:  return '';
                }
            }).filter(s => s !== '').join(' ');
        }
        // ------------------------------------------------------------

    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
