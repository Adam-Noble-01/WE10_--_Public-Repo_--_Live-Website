// =============================================================================
// TRUEVISION3D - SECTION CLIPPING SHARED STATE
// =============================================================================
//
// FILE       : Na__RenderEffect__SectionClipping__State.js
// NAMESPACE  : Na__SectionClipping
// MODULE     : Render Pipeline - Section Clipping State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared accessor for the active section-cut clipping planes
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Single source of truth for the THREE.Plane list currently cutting the
//   model (written by 41__System__SectionCutEngine, read by render passes).
// - The profile-lines effect renders the scene with override materials
//   (MeshNormalMaterial). Override materials bypass per-mesh
//   material.clippingPlanes, so those passes must read the active plane list
//   from here and assign it to their own materials each frame - otherwise
//   the linework keeps drawing the roof you just cut away.
// - Lives in 05__RenderPipeline so render passes can import it without
//   depending on the section-cut system folder (imports point inward).
// - Holds state only - the plane array instance is owned and mutated by the
//   section cut engine; consumers must not modify it.
//
// INTEGRATION:
// - Na__SectionCut__Engine__ calls Na__SectionClipping__SetPlanes() once at
//   init with its live plane array, then mutates that array in place.
// - Profile-line passes call Na__SectionClipping__GetClipList() per render
//   and assign the result to material.clippingPlanes (null when no cuts).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Ported from ValeVision3D (14-Jul-2026 v1.0.0) for the Floor Plan Builder.
// - Unchanged apart from the header; the dual-engine note was dropped because
//   TrueVision runs a single render engine.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Active Clipping Plane List
    // ------------------------------------------------------------
    let Na__SectionClipping__Planes = [];                          // <-- Live THREE.Plane array (owned by the cross-section system)
    // ------------------------------------------------------------


    // MODULE VARIABLES | Section Overlay Renderer Callback
    // ------------------------------------------------------------
    // The cross-section system draws its caps / outlines / gizmos on a
    // dedicated render layer AFTER the EffectComposer finishes, so the fog,
    // SSAO and Sobel profile passes never touch them. It registers that
    // per-frame draw callback here; the render loop invokes it each frame
    // immediately after composer.render(). Null until a section exists.
    // ------------------------------------------------------------
    let Na__SectionClipping__OverlayRenderer = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Accessors
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Live Cross-Section Plane Array
    // ------------------------------------------------------------
    function Na__SectionClipping__SetPlanes(planes) {
        Na__SectionClipping__Planes = Array.isArray(planes) ? planes : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Raw Plane Array (May Be Empty)
    // ------------------------------------------------------------
    function Na__SectionClipping__GetPlanes() {
        return Na__SectionClipping__Planes;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a material.clippingPlanes Compatible Value
    // ------------------------------------------------------------
    // Returns the live array when cuts are active, otherwise null so
    // materials take the zero-cost "no clipping" render path.
    // ------------------------------------------------------------
    function Na__SectionClipping__GetClipList() {
        return Na__SectionClipping__Planes.length > 0 ? Na__SectionClipping__Planes : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Per-Frame Section Overlay Draw Callback
    // ------------------------------------------------------------
    function Na__SectionClipping__SetOverlayRenderer(fn) {
        Na__SectionClipping__OverlayRenderer = (typeof fn === 'function') ? fn : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Section Overlay Draw Callback (Null When Idle)
    // ------------------------------------------------------------
    function Na__SectionClipping__GetOverlayRenderer() {
        return Na__SectionClipping__OverlayRenderer;
    }
    // ------------------------------------------------------------


    // MODULE VARIABLES | Image Export Mode Handler
    // ------------------------------------------------------------
    // fn(active, lineWidthScale): the cross-section system hides its gizmo
    // widgets and scales outline fat-line widths for tiled image exports.
    // Registered alongside the overlay renderer so the image exporter only
    // ever imports from 05__RenderPipeline.
    // ------------------------------------------------------------
    let Na__SectionClipping__ExportModeHandler = null;
    // ------------------------------------------------------------


    // FUNCTION | Register the Export Mode Handler
    // ------------------------------------------------------------
    function Na__SectionClipping__SetExportModeHandler(fn) {
        Na__SectionClipping__ExportModeHandler = (typeof fn === 'function') ? fn : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Export Mode Handler (Null When Unregistered)
    // ------------------------------------------------------------
    function Na__SectionClipping__GetExportModeHandler() {
        return Na__SectionClipping__ExportModeHandler;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Section Clipping State API
    // ------------------------------------------------------------
    export {
        Na__SectionClipping__SetPlanes,
        Na__SectionClipping__GetPlanes,
        Na__SectionClipping__GetClipList,
        Na__SectionClipping__SetOverlayRenderer,
        Na__SectionClipping__GetOverlayRenderer,
        Na__SectionClipping__SetExportModeHandler,
        Na__SectionClipping__GetExportModeHandler
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
