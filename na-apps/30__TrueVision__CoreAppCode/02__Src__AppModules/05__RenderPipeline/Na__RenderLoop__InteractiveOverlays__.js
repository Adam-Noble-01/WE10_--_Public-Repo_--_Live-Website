// =============================================================================
// TRUEVISION3D - RENDER LOOP - INTERACTIVE OVERLAYS
// =============================================================================
//
// FILE       : Na__RenderLoop__InteractiveOverlays__.js
// NAMESPACE  : Na__InteractiveOverlays
// MODULE     : Render Loop - Interactive Overlays
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep authoring overlays out of every render except the interactive 3D frame
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - An authoring overlay - the drawing planes are the first - sits in the main
//   scene, and the main scene is rendered by far more than the 3D view: a
//   sheet's 3D viewport, a carousel thumbnail, a still export, a video, the
//   drawing preset, the projected linework preview. A setup marker used to be
//   kept out of those by hiding it by hand wherever a drawing opened, which
//   works for a marker that lives for one panel visit and cannot work for one
//   the author leaves switched on.
//
// - SO THE RULE IS TURNED ROUND. A registered overlay is INVISIBLE BY DEFAULT.
//   The render loop switches it on as an interactive 3D frame begins and off
//   as the frame ends, and nothing else ever switches it on. Every other
//   render path - including ones nobody has written yet - sees an invisible
//   object without knowing this module exists.
//
// - WANTED IS NOT VISIBLE. The owner says whether it WANTS its overlay shown
//   (SetWanted); object.visible is this module's alone. Hit testing must
//   therefore never read object.visible - between frames it is always false.
//
// - A drawing on screen (a plan or an elevation) is not an interactive 3D
//   frame: the loop returns before it reaches Begin, so an overlay can never
//   appear over a drawing either.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence.js calls BeginFrame on the 3D path of
//   Na__RenderLoop__RenderFrame and EndFrame in the finally of the tick.
// - Na__DrawingPlanes__Overlay__ registers its root group.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Registered Overlays and the Frame Flag
    // ------------------------------------------------------------
    const Na__InteractiveOverlays__Objects = new Set();   // <-- Object3D roots, each invisible outside a frame
    let   Na__InteractiveOverlays__InFrame = false;       // <-- True between BeginFrame and EndFrame
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register an Overlay Root
    // ------------------------------------------------------------
    // Hidden at once: registering is the promise that nothing else will show it.
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__Register(object) {
        if (!object) return false;
        if (object.userData.naOverlayWanted !== true) object.userData.naOverlayWanted = false;
        object.visible = Na__InteractiveOverlays__InFrame && object.userData.naOverlayWanted === true;
        Na__InteractiveOverlays__Objects.add(object);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove an Overlay Root From the Registry
    // ------------------------------------------------------------
    // Left invisible. The owner is about to dispose of it or take it out of
    // the scene, and an object handed back visible is exactly the accident
    // this module exists to prevent.
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__Unregister(object) {
        if (!object) return false;
        object.visible = false;
        return Na__InteractiveOverlays__Objects.delete(object);
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Whether an Overlay Wants to Be Shown
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__SetWanted(object, wanted) {
        if (!object) return false;
        object.userData.naOverlayWanted = (wanted === true);
        if (Na__InteractiveOverlays__InFrame) object.visible = object.userData.naOverlayWanted;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does an Overlay Want to Be Shown?
    // ------------------------------------------------------------
    // What hit testing asks instead of object.visible.
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__IsWanted(object) {
        return Boolean(object && object.userData && object.userData.naOverlayWanted === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Frame Bracket
// -----------------------------------------------------------------------------

    // FUNCTION | An Interactive 3D Frame Is About to Be Drawn
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__BeginFrame() {
        Na__InteractiveOverlays__InFrame = true;
        Na__InteractiveOverlays__Objects.forEach((object) => {
            object.visible = (object.userData.naOverlayWanted === true);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | The Frame Is Done - Everything Goes Back to Invisible
    // ------------------------------------------------------------
    // Safe to call when Begin was not: a held loop and a 2D drawing both
    // return before Begin, and the tick ends here on every path.
    // ------------------------------------------------------------
    function Na__InteractiveOverlays__EndFrame() {
        Na__InteractiveOverlays__InFrame = false;
        Na__InteractiveOverlays__Objects.forEach((object) => {
            object.visible = false;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Interactive Overlays API
    // ------------------------------------------------------------
    export {
        Na__InteractiveOverlays__Register,
        Na__InteractiveOverlays__Unregister,
        Na__InteractiveOverlays__SetWanted,
        Na__InteractiveOverlays__IsWanted,
        Na__InteractiveOverlays__BeginFrame,
        Na__InteractiveOverlays__EndFrame
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
