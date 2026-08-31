// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - SVG OVERLAY LAYER
// =============================================================================
//
// FILE       : Na__PlanDimensions__Overlay__.js
// NAMESPACE  : Na__PlanDimLayer
// MODULE     : Plan Dimensions - SVG Overlay Layer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw dimension lines and keep them pinned to their world span
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - The dimension layer is an SVG overlay above the canvas, sitting just below
//   the annotation text layer. SVG rather than Three.js geometry for the same
//   reason the text layer is DOM: vector strokes stay hairline-crisp at every
//   zoom, the measured value renders in real Open Sans, and hit-testing for
//   selection comes free. A line drawn into the scene would alias against the
//   linework it is measuring and would have to fight the section cut for
//   depth.
//
// - ALL GEOMETRY IS BUILT IN WORLD MILLIMETRES AND THEN PROJECTED. Extension
//   lines, the offset dimension line and the terminators are all computed as
//   world points on the plan plane, and only then pushed through the plan
//   camera. Building them in screen space instead would be less code, but the
//   offset would then be a fixed pixel distance and the whole dimension would
//   slide across the wall it belongs to as soon as the plan was zoomed.
//
// - Nodes are created once per dimension and thereafter only have their
//   attributes rewritten. Sync runs every frame while plan mode is live, so
//   rebuilding the DOM there would churn hundreds of nodes a second.
//
// - The reported length is never read from storage - it is recomputed from the
//   endpoints on every sync, so a dragged endpoint updates its own figure.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ mounts on entering a plan, unmounts on
//   leaving, and calls Sync from the render loop while plan mode is active.
// - Na__PlanDimensions__Editor__ owns the interaction wired onto each node.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder dimensioning system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math Utilities
    // ------------------------------------------------------------
    import {
        Na__Math__ConvertMmToUnits,
        Na__Math__ConvertUnitsToMm
    } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Plan Camera Projection
    // ------------------------------------------------------------
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__OrthoCamera__.js
    // ------------------------------------------------------------
    import {
        Na__FpCam__ProjectWorldToScreen,
        Na__FpCam__GetUnitsPerPixel,
        Na__FpCam__GetCamera
    } from '../42__System__FloorPlanViews/Na__FloorPlan__OrthoCamera__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDim__F_ID,
        Na__PlanDim__F_START_X,
        Na__PlanDim__F_START_Z,
        Na__PlanDim__F_END_X,
        Na__PlanDim__F_END_Z,
        Na__PlanDim__F_OFFSET,
        Na__PlanDim__F_SIZE,
        Na__PlanDim__F_WEIGHT,
        Na__PlanDim__F_COLOR,
        Na__PlanDim__F_TERM,
        Na__PlanDim__ReadAll,
        Na__PlanDim__MeasureLengthMm,
        Na__PlanDim__FormatLength,
        Na__PlanDim__GetLineSetup,
        Na__PlanDim__GetTextSetup,
        Na__PlanDim__GetLayerSetup
    } from './Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identity
    // ------------------------------------------------------------
    const Na__PlanDimLayer__SVG_NS      = 'http://www.w3.org/2000/svg';
    const Na__PlanDimLayer__ROOT_ID     = 'naPlanDimensionLayer';
    const Na__PlanDimLayer__ROOT_CLASS  = 'na-plan-dim__layer';
    const Na__PlanDimLayer__ITEM_CLASS  = 'na-plan-dim__item';
    const Na__PlanDimLayer__DATA_ATTR   = 'data-na-dimension-id';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Terminator Geometry Ratios
    // ------------------------------------------------------------
    // Expressed against the configured tick length so one config number tunes
    // every terminator style consistently.
    // ------------------------------------------------------------
    const Na__PlanDimLayer__ARROW_WIDTH_RATIO = 0.35;   // <-- Arrow half-width vs its length
    const Na__PlanDimLayer__DOT_RADIUS_RATIO  = 0.22;   // <-- Dot radius vs tick length
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Layer References and Bound Data
    // ------------------------------------------------------------
    let Na__PlanDimLayer__Root       = null;    // <-- The <svg> element
    let Na__PlanDimLayer__HostEl     = null;    // <-- Render canvas the layer tracks
    let Na__PlanDimLayer__Dimensions = null;    // <-- LIVE array off the plan record
    let Na__PlanDimLayer__Session    = null;    // <-- LIVE ephemeral client measurements (never saved)
    let Na__PlanDimLayer__CutHeightMm = 0;      // <-- Plane height the dimensions sit at
    let Na__PlanDimLayer__OnNodeCreated = null; // <-- Editor hook, attached per node
    const Na__PlanDimLayer__Nodes    = new Map(); // <-- id -> { group, parts... }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layer Box and Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Match the Layer Box to the Canvas
    // ------------------------------------------------------------
    function Na__PlanDimLayer__SyncLayerBox() {
        if (!Na__PlanDimLayer__Root || !Na__PlanDimLayer__HostEl) return;
        const host = Na__PlanDimLayer__HostEl;
        const root = Na__PlanDimLayer__Root;
        root.style.top    = host.offsetTop    + 'px';
        root.style.left   = host.offsetLeft   + 'px';
        root.style.width  = host.offsetWidth  + 'px';
        root.style.height = host.offsetHeight + 'px';
        root.setAttribute('viewBox', `0 0 ${host.offsetWidth} ${host.offsetHeight}`);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Client Size of the Host Element
    // ------------------------------------------------------------
    function Na__PlanDimLayer__GetViewportSize() {
        if (!Na__PlanDimLayer__HostEl) return { width: window.innerWidth, height: window.innerHeight };
        return {
            width  : Na__PlanDimLayer__HostEl.clientWidth  || window.innerWidth,
            height : Na__PlanDimLayer__HostEl.clientHeight || window.innerHeight
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Project a World X/Z Millimetre Point to Canvas Pixels
    // ------------------------------------------------------------
    function Na__PlanDimLayer__ProjectMm(xMm, zMm, worldYUnits, size) {
        return Na__FpCam__ProjectWorldToScreen(
            Na__Math__ConvertMmToUnits(xMm),
            worldYUnits,
            Na__Math__ConvertMmToUnits(zMm),
            size.width,
            size.height
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the World-Space Skeleton of One Dimension
    // ------------------------------------------------------------
    // Everything a dimension draws, resolved as world millimetre points on the
    // plan plane. Returns null for a degenerate span, which the caller treats
    // as "hide this one" rather than drawing a division by zero.
    //
    //   S,E   picked endpoints          DS,DE  offset dimension line
    //   X1,X2 extension line starts     T1,T2  extension line ends
    // ------------------------------------------------------------
    function Na__PlanDimLayer__BuildWorldSkeleton(record, lineSetup) {
        const sx = record[Na__PlanDim__F_START_X];
        const sz = record[Na__PlanDim__F_START_Z];
        const ex = record[Na__PlanDim__F_END_X];
        const ez = record[Na__PlanDim__F_END_Z];

        const dx     = ex - sx;
        const dz     = ez - sz;
        const length = Math.sqrt((dx * dx) + (dz * dz));
        if (length <= 0) return null;                                        // <-- Degenerate; nothing to draw

        const dirX  = dx / length;                                           // <-- Unit vector along the span
        const dirZ  = dz / length;
        const perpX = -dirZ;                                                 // <-- Rotate 90 degrees in the X/Z plane
        const perpZ =  dirX;

        const offset = Number.isFinite(record[Na__PlanDim__F_OFFSET]) ? record[Na__PlanDim__F_OFFSET] : 0;
        const sign   = offset >= 0 ? 1 : -1;                                 // <-- Overshoot and gap follow the offset side
        const gap    = lineSetup.extGapMm * sign;
        const beyond = offset + (lineSetup.overshootMm * sign);

        const at = (baseX, baseZ, along) => ({
            xMm : baseX + (perpX * along),
            zMm : baseZ + (perpZ * along)
        });

        return {
            length : length,
            dirX   : dirX,
            dirZ   : dirZ,
            perpX  : perpX,
            perpZ  : perpZ,
            S      : { xMm: sx, zMm: sz },
            E      : { xMm: ex, zMm: ez },
            DS     : at(sx, sz, offset),                                     // <-- Dimension line start
            DE     : at(ex, ez, offset),                                     // <-- Dimension line end
            X1     : at(sx, sz, gap),                                        // <-- Extension line 1 start (clear of the wall)
            T1     : at(sx, sz, beyond),                                     // <-- Extension line 1 end (past the dim line)
            X2     : at(ex, ez, gap),
            T2     : at(ex, ez, beyond),
            MID    : at((sx + ex) / 2, (sz + ez) / 2, offset)                // <-- Text anchor, on the dimension line
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Node Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an SVG Element With Attributes
    // ------------------------------------------------------------
    function Na__PlanDimLayer__Svg(tagName, attributes) {
        const element = document.createElementNS(Na__PlanDimLayer__SVG_NS, tagName);
        if (attributes) {
            for (const key in attributes) {
                if (Object.prototype.hasOwnProperty.call(attributes, key)) {
                    element.setAttribute(key, attributes[key]);
                }
            }
        }
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Root SVG Container
    // ------------------------------------------------------------
    // Pointer events are off on the container so panning the plan still works
    // everywhere between the dimensions; each dimension switches them back on
    // for its own hit area.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__BuildRoot() {
        const layer = Na__PlanDim__GetLayerSetup();
        const root  = Na__PlanDimLayer__Svg('svg', {
            id            : Na__PlanDimLayer__ROOT_ID,
            class         : Na__PlanDimLayer__ROOT_CLASS,
            'aria-hidden' : 'false'
        });
        root.style.zIndex = String(layer.zIndex);
        return root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Node Set for One Dimension
    // ------------------------------------------------------------
    // A group holding every stroke the dimension needs. The hit line is a wide
    // transparent stroke laid over the dimension line so the thing can be
    // grabbed without having to click a one-pixel hairline.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__BuildNode(record) {
        const group = Na__PlanDimLayer__Svg('g', { class: Na__PlanDimLayer__ITEM_CLASS });
        group.setAttribute(Na__PlanDimLayer__DATA_ATTR, record[Na__PlanDim__F_ID]);

        const parts = {
            group   : group,
            ext1    : Na__PlanDimLayer__Svg('line',  { class: 'na-plan-dim__ext' }),
            ext2    : Na__PlanDimLayer__Svg('line',  { class: 'na-plan-dim__ext' }),
            line    : Na__PlanDimLayer__Svg('line',  { class: 'na-plan-dim__line' }),
            term1   : Na__PlanDimLayer__Svg('path',  { class: 'na-plan-dim__term' }),
            term2   : Na__PlanDimLayer__Svg('path',  { class: 'na-plan-dim__term' }),
            hit     : Na__PlanDimLayer__Svg('line',  { class: 'na-plan-dim__hit' }),
            text    : Na__PlanDimLayer__Svg('text',  { class: 'na-plan-dim__text' })
        };

        parts.text.setAttribute('text-anchor', 'middle');
        parts.text.setAttribute('dominant-baseline', 'auto');

        group.appendChild(parts.ext1);
        group.appendChild(parts.ext2);
        group.appendChild(parts.line);
        group.appendChild(parts.term1);
        group.appendChild(parts.term2);
        group.appendChild(parts.text);
        group.appendChild(parts.hit);                                        // <-- Last, so it sits on top for hit-testing

        return parts;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Record the Layer Should Draw, From Both Lists
    // ------------------------------------------------------------
    // Issued dimensions come from the plan record; client measurements come
    // from the ephemeral session list. They are DRAWN together and stored
    // apart - which is what lets a client measure over an issued drawing
    // without any possibility of their work reaching project data.
    //
    // Client ids sit above Na__PlanDim__CLIENT_ID_BASE, so the two id spaces
    // cannot collide in the node map even though each array numbers itself.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__AllRecords() {
        const issued  = Na__PlanDim__ReadAll(Na__PlanDimLayer__Dimensions);
        const session = Na__PlanDimLayer__Session
            ? Na__PlanDim__ReadAll(Na__PlanDimLayer__Session)
            : [];
        return session.length ? issued.concat(session) : issued;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild Every Node From the Bound Array
    // ------------------------------------------------------------
    // Called on mount and whenever a dimension is added or removed. Per-frame
    // updates go through Sync instead, which never touches the DOM tree.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__Rebuild() {
        if (!Na__PlanDimLayer__Root) return;

        Na__PlanDimLayer__Root.textContent = '';                             // <-- Drop every previous node
        Na__PlanDimLayer__Nodes.clear();

        const records = Na__PlanDimLayer__AllRecords();
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const parts  = Na__PlanDimLayer__BuildNode(record);
            Na__PlanDimLayer__Root.appendChild(parts.group);
            Na__PlanDimLayer__Nodes.set(record[Na__PlanDim__F_ID], parts);

            if (Na__PlanDimLayer__OnNodeCreated) {
                Na__PlanDimLayer__OnNodeCreated(parts.group, record);        // <-- Editor wires interaction here
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per-Frame Projection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Terminator Path in Screen Space
    // ------------------------------------------------------------
    // Screen space is correct here and world space is not: a terminator is a
    // drafting glyph of fixed drawn size, like an arrowhead on a printed
    // sheet, so it is sized from the tick length converted through the current
    // zoom rather than being a world-space object of its own.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__TerminatorPath(style, pointPx, dirXPx, dirYPx, tickPx) {
        const px = pointPx.x;
        const py = pointPx.y;

        if (style === 'dot') {
            const r = Math.max(tickPx * Na__PlanDimLayer__DOT_RADIUS_RATIO, 0.5);
            return `M ${px - r} ${py} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
        }

        if (style === 'arrow') {
            const half   = tickPx * Na__PlanDimLayer__ARROW_WIDTH_RATIO;
            const baseX  = px - (dirXPx * tickPx);
            const baseY  = py - (dirYPx * tickPx);
            const normX  = -dirYPx;
            const normY  =  dirXPx;
            return `M ${px} ${py} L ${baseX + normX * half} ${baseY + normY * half} `
                 + `L ${baseX - normX * half} ${baseY - normY * half} Z`;
        }

        // TICK | The architectural default: a short 45-degree stroke through the point
        const halfTick = tickPx / 2;
        const tx = (dirXPx - dirYPx) * halfTick;                             // <-- Direction rotated 45 degrees
        const ty = (dirYPx + dirXPx) * halfTick;
        return `M ${px - tx} ${py - ty} L ${px + tx} ${py + ty}`;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reproject Every Dimension Onto the Current View
    // ------------------------------------------------------------
    // Runs every rendered frame while plan mode is live. Reads the length back
    // from the endpoints each time, so an edit shows its new figure without any
    // separate refresh call.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__Sync() {
        if (!Na__PlanDimLayer__Root) return;

        const size = Na__PlanDimLayer__GetViewportSize();
        const upp  = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return;                                                    // <-- No plan camera yet

        const lineSetup = Na__PlanDim__GetLineSetup();
        const textSetup = Na__PlanDim__GetTextSetup();
        const layer     = Na__PlanDim__GetLayerSetup();
        const worldY    = Na__Math__ConvertMmToUnits(Na__PlanDimLayer__CutHeightMm);

        // MM TO PIXELS | One conversion reused for every drawn size this frame
        const mmToPx = (mm) => Na__Math__ConvertMmToUnits(mm) / upp;

        const strokePx = Math.max(mmToPx(lineSetup.strokeWidthMm), 0.6);     // <-- Never thinner than a visible hairline
        const tickPx   = mmToPx(lineSetup.tickLengthMm);

        const records = Na__PlanDimLayer__AllRecords();

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const parts  = Na__PlanDimLayer__Nodes.get(record[Na__PlanDim__F_ID]);
            if (!parts) continue;

            const skeleton = Na__PlanDimLayer__BuildWorldSkeleton(record, lineSetup);
            if (!skeleton) { parts.group.style.display = 'none'; continue; }

            // PROJECT | Every world point of the skeleton in one pass
            const pDS = Na__PlanDimLayer__ProjectMm(skeleton.DS.xMm, skeleton.DS.zMm, worldY, size);
            const pDE = Na__PlanDimLayer__ProjectMm(skeleton.DE.xMm, skeleton.DE.zMm, worldY, size);
            const pX1 = Na__PlanDimLayer__ProjectMm(skeleton.X1.xMm, skeleton.X1.zMm, worldY, size);
            const pT1 = Na__PlanDimLayer__ProjectMm(skeleton.T1.xMm, skeleton.T1.zMm, worldY, size);
            const pX2 = Na__PlanDimLayer__ProjectMm(skeleton.X2.xMm, skeleton.X2.zMm, worldY, size);
            const pT2 = Na__PlanDimLayer__ProjectMm(skeleton.T2.xMm, skeleton.T2.zMm, worldY, size);
            const pMD = Na__PlanDimLayer__ProjectMm(skeleton.MID.xMm, skeleton.MID.zMm, worldY, size);
            if (!pDS || !pDE || !pMD) { parts.group.style.display = 'none'; continue; }

            // DROP THE UNREADABLE | A dimension zoomed below the legible floor
            const drawnPx = Math.hypot(pDE.x - pDS.x, pDE.y - pDS.y);
            if (drawnPx < layer.minRenderedPx) { parts.group.style.display = 'none'; continue; }

            parts.group.style.display = '';

            const colour = record[Na__PlanDim__F_COLOR];

            // EXTENSION LINES | Wall face out to just past the dimension line
            const wireExt = (node, a, b) => {
                if (!a || !b) return;
                node.setAttribute('x1', a.x); node.setAttribute('y1', a.y);
                node.setAttribute('x2', b.x); node.setAttribute('y2', b.y);
                node.setAttribute('stroke', colour);
                node.setAttribute('stroke-width', strokePx);
            };
            wireExt(parts.ext1, pX1, pT1);
            wireExt(parts.ext2, pX2, pT2);

            // DIMENSION LINE | Plus the wide invisible stroke that catches clicks
            wireExt(parts.line, pDS, pDE);
            parts.hit.setAttribute('x1', pDS.x); parts.hit.setAttribute('y1', pDS.y);
            parts.hit.setAttribute('x2', pDE.x); parts.hit.setAttribute('y2', pDE.y);

            // TERMINATORS | Pointing outward along the dimension line
            const runX = (pDE.x - pDS.x) / (drawnPx || 1);
            const runY = (pDE.y - pDS.y) / (drawnPx || 1);
            const term = record[Na__PlanDim__F_TERM];
            parts.term1.setAttribute('d', Na__PlanDimLayer__TerminatorPath(term, pDS, -runX, -runY, tickPx));
            parts.term2.setAttribute('d', Na__PlanDimLayer__TerminatorPath(term, pDE,  runX,  runY, tickPx));
            [parts.term1, parts.term2].forEach((node) => {
                node.setAttribute('stroke', colour);
                node.setAttribute('stroke-width', strokePx);
                node.setAttribute('fill', term === 'tick' ? 'none' : colour);
            });

            // MEASURED VALUE | Read back from the endpoints, never from storage
            const lengthMm = Na__PlanDim__MeasureLengthMm(record);
            const fontPx   = Math.min(
                Math.max(mmToPx(record[Na__PlanDim__F_SIZE]), 1),
                layer.maxRenderedPx
            );

            parts.text.textContent = Na__PlanDim__FormatLength(lengthMm, record);
            parts.text.setAttribute('x', pMD.x);
            parts.text.setAttribute('y', pMD.y);
            parts.text.setAttribute('fill', colour);
            parts.text.setAttribute('font-size', fontPx);
            parts.text.setAttribute('font-weight', record[Na__PlanDim__F_WEIGHT]);
            parts.text.setAttribute('font-family', textSetup.fontFamily);

            // TEXT ORIENTATION | Along the line, and never upside down
            let angleDeg = Math.atan2(pDE.y - pDS.y, pDE.x - pDS.x) * (180 / Math.PI);
            if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;            // <-- Flip so it always reads left-to-right
            const liftPx = mmToPx(textSetup.textGapMm);
            parts.text.setAttribute(
                'transform',
                `rotate(${angleDeg} ${pMD.x} ${pMD.y}) translate(0 ${-liftPx})`
            );

            // TEXT LEGIBILITY | Hide a value that has zoomed below reading size
            parts.text.style.display = (fontPx < layer.minRenderedPx) ? 'none' : '';
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount and Teardown
// -----------------------------------------------------------------------------

    // FUNCTION | Mount the Layer Over the Canvas for One Plan
    // ------------------------------------------------------------
    function Na__PlanDimLayer__Mount(context) {
        if (!context || !context.hostElement) return false;

        Na__PlanDimLayer__Unmount();                                         // <-- Never stack two plans' dimensions

        Na__PlanDimLayer__HostEl        = context.hostElement;
        Na__PlanDimLayer__Dimensions    = Array.isArray(context.dimensions) ? context.dimensions : [];
        Na__PlanDimLayer__Session       = Array.isArray(context.sessionDimensions) ? context.sessionDimensions : null;
        Na__PlanDimLayer__CutHeightMm   = Number.isFinite(context.cutHeightMm) ? context.cutHeightMm : 0;
        Na__PlanDimLayer__OnNodeCreated = (typeof context.onNodeCreated === 'function') ? context.onNodeCreated : null;

        Na__PlanDimLayer__Root = Na__PlanDimLayer__BuildRoot();

        const parent = Na__PlanDimLayer__HostEl.parentElement || document.body;
        parent.appendChild(Na__PlanDimLayer__Root);
        Na__PlanDimLayer__SyncLayerBox();

        Na__PlanDimLayer__Rebuild();
        Na__PlanDimLayer__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Layer and Every Dimension Node
    // ------------------------------------------------------------
    function Na__PlanDimLayer__Unmount() {
        if (Na__PlanDimLayer__Root && Na__PlanDimLayer__Root.parentElement) {
            Na__PlanDimLayer__Root.parentElement.removeChild(Na__PlanDimLayer__Root);
        }
        Na__PlanDimLayer__Nodes.clear();
        Na__PlanDimLayer__Root       = null;
        Na__PlanDimLayer__Dimensions = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Layer Currently Mounted?
    // ------------------------------------------------------------
    function Na__PlanDimLayer__IsMounted() {
        return Na__PlanDimLayer__Root !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show or Hide the Whole Layer
    // ------------------------------------------------------------
    function Na__PlanDimLayer__SetVisible(visible) {
        if (!Na__PlanDimLayer__Root) return;
        Na__PlanDimLayer__Root.style.display = visible ? '' : 'none';
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Layer's Plane Height
    // ------------------------------------------------------------
    function Na__PlanDimLayer__SetCutHeightMm(cutHeightMm) {
        if (!Number.isFinite(cutHeightMm)) return;
        Na__PlanDimLayer__CutHeightMm = cutHeightMm;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Bound Dimension Array
    // ------------------------------------------------------------
    function Na__PlanDimLayer__GetSessionDimensions() {
        return Na__PlanDimLayer__Session;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Bound Dimension Array
    // ------------------------------------------------------------
    function Na__PlanDimLayer__GetDimensions() {
        return Na__PlanDimLayer__Dimensions;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Host Canvas Element
    // ------------------------------------------------------------
    function Na__PlanDimLayer__GetHost() {
        return Na__PlanDimLayer__HostEl;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Root SVG Element
    // ------------------------------------------------------------
    function Na__PlanDimLayer__GetRoot() {
        return Na__PlanDimLayer__Root;
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Millimetre Length to Screen Pixels
    // ------------------------------------------------------------
    // The same conversion the committed dimensions are drawn with. The
    // placement preview uses it so previewed text is rendered at the size it
    // will actually be created at, rather than at a fixed pixel size that
    // jumps the moment the second click lands.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__MmToPx(lengthMm) {
        const size = Na__PlanDimLayer__GetViewportSize();
        const upp  = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return 0;
        return Na__Math__ConvertMmToUnits(lengthMm) / upp;
    }
    // ------------------------------------------------------------


    // FUNCTION | Project a World X/Z Millimetre Point to Canvas Pixels
    // ------------------------------------------------------------
    // The public counterpart to ScreenToWorldMm. The placement preview needs
    // it to draw the rubber band to the CONSTRAINED end point rather than to
    // wherever the cursor happens to be, which is what makes an axis lock
    // visible while the dimension is still being dragged out.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__WorldToScreenMm(xMm, zMm) {
        const size = Na__PlanDimLayer__GetViewportSize();
        if (!size.width || !size.height) return null;

        return Na__PlanDimLayer__ProjectMm(
            xMm,
            zMm,
            Na__Math__ConvertMmToUnits(Na__PlanDimLayer__CutHeightMm),
            size
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Pointer Position to a World X/Z in Millimetres
    // ------------------------------------------------------------
    // The inverse of ProjectMm, and the entry point for every pick. Takes
    // VIEWPORT coordinates straight off a pointer event; the conversion into
    // canvas space happens here so no caller has to remember the header
    // offset. Under a parallel projection one pixel is a fixed number of scene
    // units everywhere, so a canvas offset from the centre converts to a world
    // offset from the camera without a ray solve.
    //
    // Deliberately duplicated from the annotation layer's equivalent rather
    // than imported from it: the dimensioning system must keep working with
    // annotations switched off, and that helper is bound to the annotation
    // layer's own host element.
    // ------------------------------------------------------------
    function Na__PlanDimLayer__ScreenToWorldMm(clientX, clientY) {
        const camera = Na__FpCam__GetCamera();
        if (!camera || !Na__PlanDimLayer__HostEl) return null;

        const size = Na__PlanDimLayer__GetViewportSize();
        const upp  = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return null;

        const rect    = Na__PlanDimLayer__HostEl.getBoundingClientRect();
        const localX  = clientX - rect.left;
        const localY  = clientY - rect.top;
        const offsetX = localX - (size.width  / 2);
        const offsetY = localY - (size.height / 2);

        return {
            posXMm : Na__Math__ConvertUnitsToMm(camera.position.x + (offsetX * upp)),
            posZMm : Na__Math__ConvertUnitsToMm(camera.position.z + (offsetY * upp))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimensions Overlay API
    // ------------------------------------------------------------
    export {
        Na__PlanDimLayer__Mount,
        Na__PlanDimLayer__Unmount,
        Na__PlanDimLayer__IsMounted,
        Na__PlanDimLayer__SetVisible,
        Na__PlanDimLayer__Rebuild,
        Na__PlanDimLayer__Sync,
        Na__PlanDimLayer__SyncLayerBox,
        Na__PlanDimLayer__SetCutHeightMm,
        Na__PlanDimLayer__GetDimensions,
        Na__PlanDimLayer__GetSessionDimensions,
        Na__PlanDimLayer__AllRecords,
        Na__PlanDimLayer__GetHost,
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__ScreenToWorldMm,
        Na__PlanDimLayer__WorldToScreenMm,
        Na__PlanDimLayer__MmToPx
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
