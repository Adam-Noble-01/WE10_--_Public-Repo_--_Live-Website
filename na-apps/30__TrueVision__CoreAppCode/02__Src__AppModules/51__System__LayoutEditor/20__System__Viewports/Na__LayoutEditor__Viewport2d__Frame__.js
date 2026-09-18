// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D - FRAME
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__Frame__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D - Frame
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The module state, a 2D frame body's layers, its debounced underlay render and the progress badge
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The module constants and state, whole: the render debounce, the class
//   order, the per-viewport state records, the in-flight linework promises,
//   the band path cache and the interaction hold.
// - The frame body: State creates a viewport's layers (underlay, linework,
//   markup, empty panel, progress badge) on first use, and SizeLayer sizes
//   an absolutely placed layer to the frame.
// - The underlay: RasterWeights (the composite weights the snapshot renderer
//   draws the picture at), PlaceUnderlay (slides the last picture under the
//   current window) and ScheduleUnderlay (renders the wanted window of the
//   viewport's design phase once things settle, re-arming while the pointer
//   is down or a render is in flight).
// - SetInteracting lives here because it assigns the interaction hold that
//   ScheduleUnderlay reads. A let cannot be assigned through an import, so
//   the state and the only function that writes it stay together.
// - ShowProgress and HideProgress: the badge in the frame while the
//   linework is computed.
//
// INTEGRATION:
// - Imports the Window unit only. The Linework unit reads the class order,
//   the linework caches and SizeLayer from here, and the SitePlan unit the
//   state records, SizeLayer and HideProgress; nothing here imports either
//   unit back.
// - Na__LayoutEditor__Viewport2d__ reads the state records and the layer,
//   underlay and badge helpers from Fill, GetSnapSource, Release,
//   ForceRender and RenderForExport, and re-exports CLASS_ORDER and
//   SetInteracting.
// - Every other module imports Na__LayoutEditor__Viewport2d__.js, never
//   this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header and import paths; ScheduleUnderlay's Model Source
//                   handling: it renders the viewport's design phase, skips a
//                   phase still loading (the load's refresh schedules again) and
//                   keeps the fingerprint of the phase it drew.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.1.0 (TrueVision)
// - Park and Restore, for the sheet surface's viewport cache. Leaving a sheet
//   no longer drops its viewports' states: each is lifted out of the state map
//   whole - picture, painted linework, keys - and put back when the sheet is
//   shown again, where Fill finds every key unchanged and renders nothing. The
//   map itself stays keyed by viewport id, which repeats on every sheet
//   (Viewport_1, Viewport_2 ...), so a parked state is never IN the map. A
//   parked state books no render and a render still queued for it is skipped
//   (Render2d's stillWanted); one already under way lands in the parked
//   picture, so the work is kept.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Viewport2d__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Snapshots, Composites, Raster Quality
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSnap__Render2d, Na__LeSnap__GetPipelineFingerprint } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeComposite__Weight } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    import { Na__LeRaster__Working, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport 2D Window Unit
    // ------------------------------------------------------------
    import { Na__LeVp2d__Window, Na__LeVp2d__Describe } from './Na__LayoutEditor__Viewport2d__Window__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Debounce and Class Order
    // ------------------------------------------------------------
    const Na__LeVp2d__RENDER_DELAY_MS = 320;
    const Na__LeVp2d__CLASS_ORDER     = [ 'hidden', 'visible', 'authored', 'section' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Per-Viewport State and Shared Caches
    // ------------------------------------------------------------
    const Na__LeVp2d__States    = new Map();   // <-- viewportId -> state
    const Na__LeVp2d__Linework  = new Map();   // <-- cacheKey -> Promise<classes|null>
    const Na__LeVp2d__PathCache = new Map();   // <-- cacheKey -> { className : pathData }
    let   Na__LeVp2d__Interacting = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Frame Body and Underlay
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Screen-Space Widths This Viewport's Underlay Renders At
    // ------------------------------------------------------------
    // The Profile Linework, Section Outline and Base Image composite weights -
    // the last being how thick the model's own edges draw in the picture -
    // handed to the snapshot renderer, which sets them for one render and puts
    // them back.
    // ------------------------------------------------------------
    function Na__LeVp2d__RasterWeights(viewport) {
        return {
            profilePx   : Na__LeComposite__Weight(viewport, 'profileLinework'),
            sectionPx   : Na__LeComposite__Weight(viewport, 'sectionOutline'),
            modelEdgePx : Na__LeComposite__Weight(viewport, 'baseImage')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Size an Absolutely Placed Layer to the Frame
    // ------------------------------------------------------------
    function Na__LeVp2d__SizeLayer(el, viewport, ppm) {
        if (!el) return;
        el.style.width  = (viewport.Viewport__FrameMm.WidthMm  * ppm) + 'px';
        el.style.height = (viewport.Viewport__FrameMm.HeightMm * ppm) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Per-Viewport State, Creating the Layers on First Use
    // ------------------------------------------------------------
    function Na__LeVp2d__State(body, viewportId) {
        let state = Na__LeVp2d__States.get(viewportId);
        if (state && state.body === body) return state;
        body.innerHTML = '';
        const make = (tag, cls) => { const el = document.createElement(tag); el.className = cls; body.appendChild(el); return el; };
        state = {
            body : body, underlay : make('img', 'na-le-frame__underlay'), linework : make('div', 'na-le-frame__linework'),
            markup : make('div', 'na-le-frame__markup'), empty : make('div', 'na-le-frame__empty'), progress : make('div', 'na-le-frame__progress'),
            renderedKey : null, renderedWindow : null, wantedKey : null, timer : null, inFlight : false,
            lineworkKey : null, lineworkSvg : null, markupKey : null, lastArgs : null, classes : null, classesKey : null, progressTimer : null
        };
        state.progress.hidden = true;
        state.underlay.draggable = false;
        state.underlay.alt = '';
        Na__LeVp2d__States.set(viewportId, state);
        return state;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place the Last Rendered Underlay Under the Current Window
    // ------------------------------------------------------------
    function Na__LeVp2d__PlaceUnderlay(state, win, ppm) {
        const rw = state.renderedWindow;
        if (!rw) { state.underlay.hidden = true; return; }
        const D = win.Denominator;
        state.underlay.hidden = false;
        state.underlay.style.left   = (((rw.OriginX - win.OriginX) / D) * ppm) + 'px';
        state.underlay.style.top    = (((rw.OriginY - win.OriginY) / D) * ppm) + 'px';
        state.underlay.style.width  = ((rw.WidthMm  / D) * ppm) + 'px';
        state.underlay.style.height = ((rw.HeightMm / D) * ppm) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Render the Underlay for the Wanted Window (debounced)
    // ------------------------------------------------------------
    function Na__LeVp2d__ScheduleUnderlay(state, viewportId) {
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = null;
        if (state.parked) return;                                                 // <-- Its sheet is not on screen: Fill books the render when it is shown again
        state.timer = window.setTimeout(() => {
            state.timer = null;
            // NOT NOW MEANS LATER, NOT NEVER. This used to return here, and the
            // render it was holding was simply dropped: state.timer was already
            // null, so nothing was outstanding, and wantedKey stayed different
            // from renderedKey with nobody left to reconcile them. The viewport
            // then sat showing a picture of a window it no longer had - the
            // frame resized, the underlay still drawn for the old one - until
            // something unrelated happened to schedule another render. That is
            // the drift. Re-arm instead, and the pointer-up or the in-flight
            // render that blocked us is simply the thing we wait for.
            if (!state.lastArgs) return;
            if (Na__LeVp2d__Interacting || state.inFlight) { Na__LeVp2d__ScheduleUnderlay(state, viewportId); return; }
            const args = state.lastArgs;
            const described = Na__LeVp2d__Describe(args.viewport);
            if (!described.definition) return;
            const phaseId = described.modelSource.renderId;
            const phaseFp = Na__LeSnap__GetPipelineFingerprint(phaseId);
            if (phaseFp === null) return;                                         // <-- Its design phase is not in: the load's refresh schedules again
            const key = state.wantedKey;
            const frame   = args.viewport.Viewport__FrameMm;
            const px      = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Working());   // <-- The global working level
            const windowSnapshot = described.window;
            state.inFlight = true;
            Na__LeSnap__Render2d(described.definition, windowSnapshot, args.viewport.Viewport__Styles, px.w, px.h, args.viewport.Viewport__ModelLayers, px.samples, Na__LeVp2d__RasterWeights(args.viewport), phaseId, () => !state.parked).then((result) => {   // <-- Still queued when its sheet is left: skipped, not rendered for nobody
                state.inFlight = false;
                if (!state.parked && Na__LeVp2d__States.get(viewportId) !== state) return;   // <-- Released. A parked state keeps the picture it was already rendering
                if (result) {
                    state.underlay.src   = result.dataUrl;
                    state.renderedKey    = key;
                    state.renderedFp     = phaseFp;
                    state.renderedWindow = { OriginX : windowSnapshot.OriginX, OriginY : windowSnapshot.OriginY, WidthMm : windowSnapshot.WidthMm, HeightMm : windowSnapshot.HeightMm };
                    Na__LeVp2d__PlaceUnderlay(state, Na__LeVp2d__Window(state.lastArgs.viewport), state.lastArgs.ppm);
                }
                if (state.wantedKey !== state.renderedKey) Na__LeVp2d__ScheduleUnderlay(state, viewportId);   // <-- Moved on meanwhile
            });
        }, Na__LeVp2d__RENDER_DELAY_MS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Badge in the Frame While the Linework Is Computed
    // ------------------------------------------------------------
    function Na__LeVp2d__ShowProgress(state, phase) {
        if (!state.progress) return;
        if (!state.progressTimer) {
            state.progressStarted = performance.now();
            state.progressTimer   = window.setInterval(() => Na__LeVp2d__ShowProgress(state, state.progressPhase || ''), 1000);
        }
        state.progressPhase = phase || state.progressPhase || '';
        const seconds = Math.round((performance.now() - state.progressStarted) / 1000);
        state.progress.textContent = Na__LeCfg__GetLabel('ProjectingLinework', 'Projecting linework') + (state.progressPhase ? ': ' + state.progressPhase : '') + (seconds > 0 ? ' (' + seconds + ' s)' : '');
        state.progress.hidden = false;
    }
    function Na__LeVp2d__HideProgress(state) {
        if (state.progressTimer) { window.clearInterval(state.progressTimer); state.progressTimer = null; }
        state.progressPhase = '';
        if (state.progress) state.progress.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Lift a Viewport's State Out While Its Sheet Is Off Screen, and Put It Back
    // ------------------------------------------------------------
    // The sheet surface's viewport cache (Na__LayoutEditor__SheetSurface__).
    // Viewport ids repeat on every sheet, so the state of a sheet that is not
    // on screen cannot stay in the map: Park hands it to the surface, which
    // keeps it beside the sheet's detached frames, and Restore puts it back
    // before Fill runs. Fill then finds the same body, the same keys and the
    // same painted layers, and asks for nothing.
    //
    // body guards against the id belonging to another sheet's frame by now.
    // ------------------------------------------------------------
    function Na__LeVp2d__Park(viewportId, body) {
        const state = Na__LeVp2d__States.get(viewportId);
        if (!state || (body && state.body !== body)) return null;
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
        Na__LeVp2d__HideProgress(state);                                          // <-- The badge's one-second tick stops; Fill shows it again if the linework is still coming
        state.parked = true;
        Na__LeVp2d__States.delete(viewportId);
        return state;
    }
    function Na__LeVp2d__Restore(viewportId, state) {
        if (!state) return;
        state.parked = false;
        Na__LeVp2d__States.set(viewportId, state);
    }
    // ------------------------------------------------------------


    // FUNCTION | Hold Renders While the Pointer Is Down, Flush When It Lifts
    // ------------------------------------------------------------
    function Na__LeVp2d__SetInteracting(flag) {
        Na__LeVp2d__Interacting = flag === true;
        if (Na__LeVp2d__Interacting) return;
        Na__LeVp2d__States.forEach((state, viewportId) => {
            if (state.wantedKey !== state.renderedKey) Na__LeVp2d__ScheduleUnderlay(state, viewportId);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D Frame Unit
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__CLASS_ORDER,
        Na__LeVp2d__States,
        Na__LeVp2d__Linework,
        Na__LeVp2d__PathCache,
        Na__LeVp2d__RasterWeights,
        Na__LeVp2d__SizeLayer,
        Na__LeVp2d__State,
        Na__LeVp2d__PlaceUnderlay,
        Na__LeVp2d__ScheduleUnderlay,
        Na__LeVp2d__ShowProgress,
        Na__LeVp2d__HideProgress,
        Na__LeVp2d__Park,
        Na__LeVp2d__Restore,
        Na__LeVp2d__SetInteracting
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
