// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FORCE RENDER
// =============================================================================
//
// FILE       : Na__LayoutEditor__ForceRender__.js
// NAMESPACE  : Na__LeForce
// MODULE     : Layout Editor - Force Render
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Rebuild a viewport's composite layers on demand, or every viewport on the sheet, one after another
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - Two scopes and one mechanism. "This viewport" throws away everything
//   known about one frame - the rendered picture, the cached projection and
//   the baked asset behind it - and draws it again. "This sheet" does the
//   same to every viewport on the active sheet, in order, waiting for each.
// - Sequential on purpose. The snapshot renderer and the projection pipeline
//   are each a single shared resource that queues internally, so firing ten
//   renders at once would not make them finish sooner; it would only take
//   away any idea of how far along the job is. Stepping through them gives
//   an honest count and a sheet that fills in one frame at a time.
// - Announces its progress on an event so a button can say what it is doing
//   and go quiet again afterwards.
//
// WHY THIS EXISTS:
// - A viewport's picture is cached against a fingerprint of everything that
//   ought to change it. When that bookkeeping and reality disagree - a render
//   dropped on the floor, a scene edited outside the editor's knowledge, a
//   baked asset from a model that has since moved on - the frame shows a
//   picture of a window it no longer has, and no amount of nudging the
//   viewport will talk it round, because as far as it knows it is up to date.
//   This is the way out that does not involve reloading the page.
//
// INTEGRATION:
// - The Render Composites panel button and the sheet context menu both call
//   in here; nothing else should need to.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a - authored in TrueVision3D
// - Back-port     : PENDING to ValeVision3D.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model and the Two Viewport Kinds
    // ------------------------------------------------------------
    import { Na__LeModel__KIND_2D, Na__LeModel__GetViewports, Na__LeModel__GetViewportById } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeVp2d__ForceRender } from './Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__ForceRender } from './Na__LayoutEditor__Viewport3d__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Progress Event
    // ------------------------------------------------------------
    const Na__LeForce__CHANGED_EVENT = 'na-layouteditor-forcerender-changed';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Run in Progress, if Any
    // ------------------------------------------------------------
    let Na__LeForce__Run = null;     // <-- { total, done, label, promise }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Progress
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say What Is Happening
    // ------------------------------------------------------------
    function Na__LeForce__Announce() {
        window.dispatchEvent(new CustomEvent(Na__LeForce__CHANGED_EVENT, { detail : Na__LeForce__GetProgress() }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Run Is Under Way, and How Far Along
    // ------------------------------------------------------------
    function Na__LeForce__IsRunning() { return !!Na__LeForce__Run; }
    function Na__LeForce__GetProgress() {
        if (!Na__LeForce__Run) return { running : false, done : 0, total : 0 };
        return { running : true, done : Na__LeForce__Run.done, total : Na__LeForce__Run.total };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Redraw One Viewport, Whichever Kind It Is
    // ------------------------------------------------------------
    async function Na__LeForce__One(sheet, viewport) {
        if (!sheet || !viewport) return false;
        try {
            return viewport.Viewport__Kind === Na__LeModel__KIND_2D
                ? await Na__LeVp2d__ForceRender(sheet, viewport)
                : await Na__LeVp3d__ForceRender(sheet, viewport);
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Forced render failed for ' + viewport.Viewport__Id + ':', error);
            return false;                                                        // <-- One bad viewport must not stop the sheet
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Step Through a List, Announcing as It Goes
    // ------------------------------------------------------------
    function Na__LeForce__Sequence(sheet, viewports) {
        if (Na__LeForce__Run) return Na__LeForce__Run.promise;                    // <-- One run at a time; a second press joins the first
        if (!sheet || !viewports || viewports.length === 0) return Promise.resolve(0);

        Na__LeForce__Run = { total : viewports.length, done : 0, promise : null };
        const promise = (async () => {
            let rendered = 0;
            try {
                for (let i = 0; i < viewports.length; i++) {
                    Na__LeForce__Announce();
                    if (await Na__LeForce__One(sheet, viewports[i])) rendered += 1;
                    Na__LeForce__Run.done = i + 1;
                }
            } finally {
                Na__LeForce__Run = null;
                Na__LeForce__Announce();
            }
            return rendered;
        })();
        Na__LeForce__Run.promise = promise;
        Na__LeForce__Announce();
        return promise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild One Viewport's Composite Layers
    // ------------------------------------------------------------
    function Na__LeForce__Viewport(sheet, viewportId) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        return Na__LeForce__Sequence(sheet, viewport ? [ viewport ] : []);
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild Every Viewport on the Sheet, One After Another
    // ------------------------------------------------------------
    function Na__LeForce__Sheet(sheet) {
        return Na__LeForce__Sequence(sheet, sheet ? Na__LeModel__GetViewports(sheet).slice() : []);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Force Render API
    // ------------------------------------------------------------
    export {
        Na__LeForce__CHANGED_EVENT,
        Na__LeForce__IsRunning,
        Na__LeForce__GetProgress,
        Na__LeForce__Viewport,
        Na__LeForce__Sheet
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
