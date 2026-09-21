// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAFT MODE - STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__DraftMode__State__.js
// NAMESPACE  : Na__LeDraft
// MODULE     : Layout Editor - Draft Mode - State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Whether Draft mode is on, and the event that says it changed
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ONE FLAG. Draft mode (K, as in SketchUp LayOut) draws a sheet as bare as
//   it goes to navigate it fast: only the viewports' vector linework, every
//   line a hairline in its own colour, no fills, no dashes, and no raster
//   picture anywhere - none drawn, and none rendered.
// - THIS FILE IS A LEAF ON PURPOSE. The viewport modules have to ask "is
//   Draft on?" before they book a raster render, and the controller that
//   switches Draft has to refresh the sheet surface, which imports those same
//   viewport modules. Holding the flag here, with no imports at all, is what
//   lets both sides read it without an import cycle.
// - THE FLAG IS FOR THIS SESSION ONLY. It is never written to a record, to
//   the browser draft or to localStorage, so it cannot reach saved data, the
//   PDF or the web viewer, and every load starts with Draft off.
//
// INTEGRATION:
// - Na__LayoutEditor__DraftMode__ (the controller) is the only caller of
//   Na__LeDraft__AssignOn; everyone else switches Draft through
//   Na__LeDraft__Set / Na__LeDraft__Toggle there.
// - Na__LayoutEditor__Viewport2d__, Na__LayoutEditor__Viewport2d__Frame__ and
//   Na__LayoutEditor__Viewport3d__ read Na__LeDraft__IsOn before booking a
//   raster render.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026, v2.107.0)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the flag, its reader and its event.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Event Announced When Draft Mode Changes
    // ------------------------------------------------------------
    const Na__LeDraft__CHANGED_EVENT = 'na-layouteditor-draft-changed';    // <-- detail { enabled }
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Flag (off on every load)
    // ------------------------------------------------------------
    let Na__LeDraft__On = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Assigning the Flag
// -----------------------------------------------------------------------------

    // FUNCTION | Is Draft Mode On
    // ------------------------------------------------------------
    function Na__LeDraft__IsOn() {
        return Na__LeDraft__On;
    }
    // ------------------------------------------------------------


    // FUNCTION | Assign the Flag (the controller's only)
    // ------------------------------------------------------------
    // A let cannot be assigned through an import, so the flag and the one
    // function that writes it stay together here. It announces nothing and
    // refreshes nothing: that is the controller's job, so this file can stay a
    // leaf.
    // ------------------------------------------------------------
    function Na__LeDraft__AssignOn(flag) {
        Na__LeDraft__On = flag === true;
        return Na__LeDraft__On;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Draft Mode State
    // ------------------------------------------------------------
    export {
        Na__LeDraft__CHANGED_EVENT,
        Na__LeDraft__IsOn,
        Na__LeDraft__AssignOn
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
