// =============================================================================
// TRUEVISION3D - RENDER EFFECT - LINEWORK SETTINGS STATE (STAND-IN)
// =============================================================================
//
// FILE       : Na__RenderEffect__LineworkSettings__State.js
// NAMESPACE  : Na__LineworkSettings
// MODULE     : Linework Settings State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Answer the three questions ValeVision's vegetation and entourage
//              runtimes ask of Linework Settings, as ValeVision answers them at
//              its defaults: TrueVision has no user line weight and no export
//              line scale
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - VALEVISION'S MODULE OF THIS NAME is its own Linework Settings: a session line
//   weight and profile line factor the user sets, Silly Lines, the export scales
//   its tiled exporter sets so a big still keeps the screen's weight, and the
//   Layout Editor's base width override. TrueVision has none of these: its model
//   edges draw at the loader's width, its exports draw them at screen pixels, and
//   its snapshot renderer writes the model's edge widths itself, under the model
//   root only (Na__LeSnap__SetModelEdgeWidth).
// - THE PLANTS' AND PEOPLE'S RUNTIMES ASK THREE THINGS, and this answers each as
//   ValeVision's module does with nothing set:
//     GetLineworkFactor        1: no user line weight
//     SetLineworkFactor(f)     nothing to do: each layer writes its own widths, and
//                              at a factor of 1 ValeVision's re-apply leaves them
//                              exactly as they are
//     GetLineworkExportScale   1: an export draws lines at screen pixels, so the
//                              plants' detail stays measured in pixels, as the
//                              model's own edges are
// - A LATER PORT OF THE REAL MODULE REPLACES THIS FILE, and the runtimes need no
//   change: they already call it as ValeVision's.
//
// INTEGRATION:
// - Imported by ../24__System__Vegetation/03__System__SceneLayer/Na__Vegetation__Runtime__.js
//   and ../28__System__Entourage/03__System__SceneLayer/Na__Entourage__Runtime__.js,
//   both loaded lazily: nothing on the start-up path imports this.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 05__RenderPipeline/Na__RenderEffect__LineworkSettings__State.js 1.5.0 (v2.85.0),
//                   its interface only (the three calls the ported systems make)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : diverged (a stand-in)
// - Divergences   : No user factors, Silly Lines, export scales or base width
//                   override: the answers are ValeVision's defaults.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (TrueVision3D v2.185.0)
// - The stand-in, for the vegetation and entourage systems ported from ValeVision 3D.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The User's Linework Thickness Factor: Always 1 in TrueVision
    // ------------------------------------------------------------
    function Na__LineworkSettings__GetLineworkFactor() {
        return 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply a Linework Thickness Factor: Nothing to Apply in TrueVision
    // ------------------------------------------------------------
    // Each scene layer sets its own line widths, and ValeVision's re-apply at a
    // factor of 1 leaves them as they are.
    // ------------------------------------------------------------
    function Na__LineworkSettings__SetLineworkFactor(factor) {   // eslint-disable-line no-unused-vars
        // <-- Nothing: returns nothing, as ValeVision's does
    }
    // ------------------------------------------------------------


    // FUNCTION | The Linework Export Scale: Always 1 in TrueVision
    // ------------------------------------------------------------
    // An export draws lines at screen pixels, so detail measured against the
    // line weight is measured in pixels, as the model's edges are.
    // ------------------------------------------------------------
    function Na__LineworkSettings__GetLineworkExportScale() {
        return 1;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Linework Settings (Stand-In)
    // ------------------------------------------------------------
    export {
        Na__LineworkSettings__GetLineworkFactor,
        Na__LineworkSettings__SetLineworkFactor,
        Na__LineworkSettings__GetLineworkExportScale
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
