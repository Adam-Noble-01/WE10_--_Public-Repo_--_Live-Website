// =============================================================================
// TRUEVISION3D - PLAN ANNOTATIONS - DOM OVERLAY LAYER
// =============================================================================
//
// FILE       : Na__PlanAnnotations__Overlay__.js
// NAMESPACE  : Na__PlanAnnoLayer
// MODULE     : Plan Annotations - DOM Overlay Layer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw and keep floor plan text pinned to its world position
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - The annotation layer is a DOM overlay above the canvas, deliberately NOT
//   Three.js geometry. Real DOM text gives true Open Sans rendering at every
//   zoom, an in-situ editor that is just a contenteditable, and drag handling
//   for free - none of which a canvas-textured plane in the scene could match.
// - Each label stores a world X/Z in millimetres. Every sync projects that
//   through the plan camera to screen pixels, so a label stays exactly over
//   the room it names while the plan is panned or zoomed.
// - Text is sized in real millimetres and converted to pixels through the
//   camera's units-per-pixel, so labels scale with the drawing the way CAD
//   text does. Labels that fall below the readable pixel floor are hidden
//   rather than drawn as unreadable specks.
// - Conceptually the layer sits the configured offset below the camera, just
//   above the cut. Nothing here depends on that height, but it is recorded in
//   config so a future canvas-plane renderer for image export can reproduce
//   the same placement.
// - Only one plan's labels are ever mounted. Switching plans tears the layer
//   down and rebuilds it, which is what keeps each plan's markup independent.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ mounts on entering a plan and unmounts on
//   leaving, and calls Sync from the render loop while plan mode is active.
// - Na__PlanAnnotations__Editor__ owns the interaction wired onto each node.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
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
        Na__FpCam__GetUnitsPerPixel
    } from '../42__System__FloorPlanViews/Na__FloorPlan__OrthoCamera__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Annotation Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanAnnotations__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PlanAnno__ReadAll,
        Na__PlanAnno__Read,
        Na__PlanAnno__GetTextSetup,
        Na__PlanAnno__GetLayerSetup
    } from './Na__PlanAnnotations__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers and Class Names
    // ------------------------------------------------------------
    const Na__PlanAnnoLayer__ROOT_ID    = 'naPlanAnnotationLayer';
    const Na__PlanAnnoLayer__ROOT_CLASS = 'na-plan-anno__layer';
    const Na__PlanAnnoLayer__ITEM_CLASS = 'na-plan-anno__item';
    const Na__PlanAnnoLayer__DATA_ATTR  = 'data-na-annotation-id';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Mounted Layer and Its Contents
    // ------------------------------------------------------------
    let Na__PlanAnnoLayer__Root       = null;    // <-- Container div, or null when unmounted
    let Na__PlanAnnoLayer__HostEl     = null;    // <-- Element the layer is sized against (the canvas)
    let Na__PlanAnnoLayer__Annotations = null;   // <-- Live annotation array of the mounted plan
    let Na__PlanAnnoLayer__CutHeightMm = 0;      // <-- Plan cut height; labels project at this world Y
    // ------------------------------------------------------------

    // MODULE VARIABLES | Node Registry and Interaction Hook
    // ------------------------------------------------------------
    const Na__PlanAnnoLayer__Nodes = new Map();  // <-- annotationId -> HTMLElement
    let Na__PlanAnnoLayer__OnNodeCreated = null; // <-- Editor callback: wire interaction onto a fresh node
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layer Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Lay the Layer Exactly Over the Canvas
    // ------------------------------------------------------------
    // The render canvas is NOT flush with the viewport - it sits below the app
    // header - so the layer is positioned from the canvas's own offset box
    // rather than stretched across its parent. Without this every label would
    // be displaced downward by the header height.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__SyncLayerBox() {
        if (!Na__PlanAnnoLayer__Root || !Na__PlanAnnoLayer__HostEl) return;
        const host = Na__PlanAnnoLayer__HostEl;
        const root = Na__PlanAnnoLayer__Root;
        root.style.top    = host.offsetTop    + 'px';
        root.style.left   = host.offsetLeft   + 'px';
        root.style.width  = host.offsetWidth  + 'px';
        root.style.height = host.offsetHeight + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Viewport Coordinates to Canvas-Local Ones
    // ------------------------------------------------------------
    // Pointer events report viewport coordinates. Everything downstream works
    // in canvas space, so this conversion has to happen exactly once, here.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__ClientToLocal(clientX, clientY) {
        if (!Na__PlanAnnoLayer__HostEl) return { x: clientX, y: clientY };
        const rect = Na__PlanAnnoLayer__HostEl.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Viewport Size of the Host Element
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__GetViewportSize() {
        if (!Na__PlanAnnoLayer__HostEl) return { width: window.innerWidth, height: window.innerHeight };
        return {
            width  : Na__PlanAnnoLayer__HostEl.clientWidth  || window.innerWidth,
            height : Na__PlanAnnoLayer__HostEl.clientHeight || window.innerHeight
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Container Div
    // ------------------------------------------------------------
    // Pointer events are off on the container so panning the plan still works
    // everywhere between the labels; each label switches them back on.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__BuildRoot() {
        const root = document.createElement('div');
        root.id        = Na__PlanAnnoLayer__ROOT_ID;
        root.className = Na__PlanAnnoLayer__ROOT_CLASS;
        root.setAttribute('aria-hidden', 'false');
        return root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build One Label Node
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__BuildNode(fields) {
        const setup = Na__PlanAnno__GetTextSetup();

        const node = document.createElement('div');
        node.className = Na__PlanAnnoLayer__ITEM_CLASS;
        node.setAttribute(Na__PlanAnnoLayer__DATA_ATTR, fields.id);
        node.style.fontFamily = setup.fontFamily;
        node.textContent = fields.text;

        if (typeof Na__PlanAnnoLayer__OnNodeCreated === 'function') {
            Na__PlanAnnoLayer__OnNodeCreated(node, fields.id);                   // <-- Editor wires drag / dblclick here
        }
        return node;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Mounting
// -----------------------------------------------------------------------------

    // FUNCTION | Mount the Layer for One Floor Plan
    // ------------------------------------------------------------
    // context: { hostElement, annotations, cutHeightMm, onNodeCreated }
    // The annotations array is held by reference, so edits made through the
    // data module are picked up by the next Sync with no re-mount.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__Mount(context) {
        if (!context || !context.hostElement) return false;

        Na__PlanAnnoLayer__Unmount();                                            // <-- Never stack two plans' markup

        Na__PlanAnnoLayer__HostEl        = context.hostElement;
        Na__PlanAnnoLayer__Annotations   = Array.isArray(context.annotations) ? context.annotations : [];
        Na__PlanAnnoLayer__CutHeightMm   = Number.isFinite(context.cutHeightMm) ? context.cutHeightMm : 0;
        Na__PlanAnnoLayer__OnNodeCreated = (typeof context.onNodeCreated === 'function') ? context.onNodeCreated : null;

        Na__PlanAnnoLayer__Root = Na__PlanAnnoLayer__BuildRoot();

        const parent = Na__PlanAnnoLayer__HostEl.parentElement || document.body;
        parent.appendChild(Na__PlanAnnoLayer__Root);
        Na__PlanAnnoLayer__SyncLayerBox();                                       // <-- Match the canvas box, header offset included

        Na__PlanAnnoLayer__Rebuild();
        Na__PlanAnnoLayer__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Layer and Every Label Node
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__Unmount() {
        if (Na__PlanAnnoLayer__Root && Na__PlanAnnoLayer__Root.parentElement) {
            Na__PlanAnnoLayer__Root.parentElement.removeChild(Na__PlanAnnoLayer__Root);
        }
        Na__PlanAnnoLayer__Nodes.clear();
        Na__PlanAnnoLayer__Root        = null;
        Na__PlanAnnoLayer__Annotations = null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Layer Currently Mounted?
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__IsMounted() {
        return Na__PlanAnnoLayer__Root !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fade the Whole Layer In or Out
    // ------------------------------------------------------------
    // Called before a camera transition so the text is gone before the view
    // starts moving, rather than sliding across the screen with it.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__SetVisible(visible) {
        if (!Na__PlanAnnoLayer__Root) return;
        const fadeMs = Na__PlanAnno__GetLayerSetup().fadeMs;
        Na__PlanAnnoLayer__Root.style.transition = 'opacity ' + fadeMs + 'ms ease';
        Na__PlanAnnoLayer__Root.style.opacity    = visible ? '1' : '0';
        Na__PlanAnnoLayer__Root.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Rebuild and Sync
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild Every Label Node From the Annotation Array
    // ------------------------------------------------------------
    // Called after an add or delete. Position and size come from the next
    // Sync, so this only has to get the right nodes into the DOM.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__Rebuild() {
        if (!Na__PlanAnnoLayer__Root) return;

        const annotations = Na__PlanAnno__ReadAll(Na__PlanAnnoLayer__Annotations);
        const seen        = new Set();

        for (let i = 0; i < annotations.length; i++) {
            const fields = Na__PlanAnno__Read(annotations[i]);
            seen.add(fields.id);

            let node = Na__PlanAnnoLayer__Nodes.get(fields.id);
            if (!node) {
                node = Na__PlanAnnoLayer__BuildNode(fields);
                Na__PlanAnnoLayer__Nodes.set(fields.id, node);
                Na__PlanAnnoLayer__Root.appendChild(node);
            }
        }

        // Drop nodes whose annotation has been deleted.
        Na__PlanAnnoLayer__Nodes.forEach((node, id) => {
            if (seen.has(id)) return;
            if (node.parentElement) node.parentElement.removeChild(node);
            Na__PlanAnnoLayer__Nodes.delete(id);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Reproject Every Label Onto the Current Camera View
    // ------------------------------------------------------------
    // Called from the render loop while plan mode is active. This is what
    // makes a label stay planted over its room as the drawing is panned.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__Sync() {
        if (!Na__PlanAnnoLayer__Root) return;

        const size  = Na__PlanAnnoLayer__GetViewportSize();
        const layer = Na__PlanAnno__GetLayerSetup();
        const upp   = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return;                                                        // <-- No plan camera yet

        const worldY      = Na__Math__ConvertMmToUnits(Na__PlanAnnoLayer__CutHeightMm);
        const annotations = Na__PlanAnno__ReadAll(Na__PlanAnnoLayer__Annotations);

        for (let i = 0; i < annotations.length; i++) {
            const fields = Na__PlanAnno__Read(annotations[i]);
            const node   = Na__PlanAnnoLayer__Nodes.get(fields.id);
            if (!node) continue;

            const worldX = Na__Math__ConvertMmToUnits(fields.posXMm);
            const worldZ = Na__Math__ConvertMmToUnits(fields.posZMm);
            const screen = Na__FpCam__ProjectWorldToScreen(worldX, worldY, worldZ, size.width, size.height);
            if (!screen) continue;

            // Millimetres to pixels through the parallel projection scale.
            const sizePx = Na__Math__ConvertMmToUnits(fields.sizeMm) / upp;

            if (sizePx < layer.minRenderedPx) {
                node.style.display = 'none';                                     // <-- Zoomed out past legibility
                continue;
            }
            node.style.display    = '';
            node.style.fontSize   = Math.min(sizePx, layer.maxRenderedPx) + 'px';
            node.style.fontWeight = String(fields.fontWeight);
            node.style.color      = fields.color;
            node.style.transform  = 'translate(-50%, -50%) translate(' + screen.x + 'px, ' + screen.y + 'px)';

            if (node.textContent !== fields.text && !node.isContentEditable) {
                node.textContent = fields.text;                                  // <-- Never fight the open editor
            }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Update the Cut Height the Layer Projects At
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__SetCutHeightMm(cutHeightMm) {
        if (Number.isFinite(cutHeightMm)) Na__PlanAnnoLayer__CutHeightMm = cutHeightMm;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Node and Coordinate Lookup
// -----------------------------------------------------------------------------

    // FUNCTION | Get the DOM Node for One Annotation
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__GetNode(annotationId) {
        return Na__PlanAnnoLayer__Nodes.get(annotationId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Live Annotation Array the Layer Is Showing
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__GetAnnotations() {
        return Na__PlanAnnoLayer__Annotations;
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Pointer Position to a World X/Z in Millimetres
    // ------------------------------------------------------------
    // Takes VIEWPORT coordinates straight off a pointer event; the conversion
    // into canvas space happens here so no caller has to remember the header
    // offset. Under a parallel projection one pixel is a fixed number of scene
    // units everywhere, so a canvas offset from the centre converts to a world
    // offset from the camera without a ray solve. Screen X maps to world +X
    // and screen Y to world +Z, matching the plan camera's -Z up vector.
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__ScreenToWorldMm(clientX, clientY, cameraXUnits, cameraZUnits) {
        const size  = Na__PlanAnnoLayer__GetViewportSize();
        const upp   = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return null;

        const local   = Na__PlanAnnoLayer__ClientToLocal(clientX, clientY);
        const offsetX = local.x - (size.width  / 2);
        const offsetY = local.y - (size.height / 2);

        return {
            posXMm : Na__Math__ConvertUnitsToMm(cameraXUnits + (offsetX * upp)),
            posZMm : Na__Math__ConvertUnitsToMm(cameraZUnits + (offsetY * upp))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Layer Root Element
    // ------------------------------------------------------------
    function Na__PlanAnnoLayer__GetRoot() {
        return Na__PlanAnnoLayer__Root;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Annotation Overlay API
    // ------------------------------------------------------------
    export {
        Na__PlanAnnoLayer__Mount,
        Na__PlanAnnoLayer__Unmount,
        Na__PlanAnnoLayer__IsMounted,
        Na__PlanAnnoLayer__SetVisible,
        Na__PlanAnnoLayer__Rebuild,
        Na__PlanAnnoLayer__Sync,
        Na__PlanAnnoLayer__SetCutHeightMm,
        Na__PlanAnnoLayer__SyncLayerBox,
        Na__PlanAnnoLayer__GetNode,
        Na__PlanAnnoLayer__GetAnnotations,
        Na__PlanAnnoLayer__ScreenToWorldMm,
        Na__PlanAnnoLayer__GetRoot
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
