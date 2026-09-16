// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A window onto a plan, elevation or section at a locked scale
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The window: the frame's paper size times the scale denominator, in
//   drawing millimetres, centred on the viewport's pan. Everything in the
//   frame is placed from that one rectangle.
// - Three layers inside the frame body: the raster underlay (the composer
//   render of the drawing, rendered offscreen at UnderlayPixelsPerMm and
//   cached by fingerprint; the last picture is slid under the cursor while
//   a pan is in progress and re-rendered once it settles), the projected
//   linework SVG (viewBox spanning exactly the window in drawing
//   millimetres, strokes at the configured paper widths times the
//   denominator so they print true), and the scene markup at scale.
// - Linework comes from the projection pipeline's cache, else the baked
//   R2 asset, else an on-device render, in that order.
// - A SITE PLAN VIEWPORT (Viewport__SitePlan) draws the project's site plan
//   data instead: no underlay and no projection. The lines arrive ready-made
//   in drawing millimetres (52__System__SitePlanData), styled per layer, with
//   the layers' fills underneath.
// - This file keeps the entry points the rest of the editor calls
//   (CentreOnDrawing, Fill, GetSnapSource, Release, ForceRender and
//   RenderForExport) and re-exports everything else from its units in this
//   folder:
//   - Na__LayoutEditor__Viewport2d__Window__: the model window and the
//     projection definition (Window, Describe).
//   - Na__LayoutEditor__Viewport2d__Frame__: the module constants and
//     state, the frame body's layers (State, SizeLayer), the underlay
//     (RasterWeights, PlaceUnderlay, ScheduleUnderlay), the interaction
//     hold (SetInteracting) and the progress badge (ShowProgress,
//     HideProgress).
//   - Na__LayoutEditor__Viewport2d__Linework__: the linework fetch
//     (EnsureLinework), how it is inked (StyleToken, StrokeRules,
//     StyleBands) and how it is painted (BandPaths, PathDataFor,
//     PaintLinework).
//   - Na__LayoutEditor__Viewport2d__SitePlan__ (TrueVision only): the site
//     plan viewport, from its data to its painted SVG (SitePlanToken,
//     SitePlanPaintKey, SitePlanBuild, SitePlanDrawing, RingPathData,
//     PaintSitePlan, FillSitePlan, RefillSitePlan).
//
// INTEGRATION:
// - The sheet surface calls Fill for every visible 2D frame; the tools
//   flag interaction so renders wait for the drag to end.
// - Callers keep importing this file, which still exports every name it
//   always has. The units import downward only (Frame reads Window;
//   Linework reads Window and Frame; SitePlan reads Window, Frame and
//   Linework) and never this file, so the split adds no cycle to the
//   module graph.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Viewport2d__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (site plan viewports), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port); 1.5.1 ported 13-Sep-2026 as ValeVision3D v2.28.0
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.10.0
// - Split into Na__LayoutEditor__Viewport2d__Window__.js,
//   Na__LayoutEditor__Viewport2d__Frame__.js,
//   Na__LayoutEditor__Viewport2d__Linework__.js and
//   Na__LayoutEditor__Viewport2d__SitePlan__.js to stay under the line
//   budget. No behaviour change: the code moved verbatim and every export
//   is unchanged.
// - Window, Frame and Linework are the ValeVision3D v2.47.0 split
//   (Viewport2d 1.7.0): each holds the same functions as ValeVision's, so a
//   change ports file for file. SitePlan is TrueVision only: the eight site
//   plan viewport functions, in their original order. Linework also exports
//   BandPaths, which PaintSitePlan calls.
//
// 14-Sep-2026 - Version 1.9.0 (TrueVision)
// - Site plan viewports (Viewport__SitePlan). Fill takes its own path before any
//   drawing or design phase check: no raster and no projection; the lines come
//   ready-made from the site plan data in drawing millimetres. Every line goes in
//   the visible class tagged with its layer, so StyleBands styles each layer from
//   its export (or the viewport's own edge overrides) and snapping reads the same
//   classes. Fills paint under the lines as even-odd paths. A layer switched off in
//   Model Layers is left out. A badge shows while the data loads; a project with
//   none says how to export it. CentreOnDrawing centres on the red line and Force
//   Render re-reads the data. SitePlanDrawing hands the PDF the same classes.
//
// 14-Sep-2026 - Version 1.8.0 (TrueVision)
// - Elevation doors. Describe gives an elevation or section viewport's
//   definition the shut door pose (Na__LeDoors__ShutPoseFor): every door drawn
//   shut in its linework, base image and PDF, whatever the 3D view shows. The
//   pose is in the record hash, so each elevation viewport projects once afresh
//   rather than paint linework read while a door stood open.
//
// 14-Sep-2026 - Version 1.7.0 (TrueVision)
// - Plan doors. Describe gives a plan viewport's definition the door pose it
//   draws with (Na__LayoutEditor__PlanDoors__): every door open, bar the ones
//   the viewport closed, with swing arcs. The pose is part of the definition's
//   record hash, so the linework, the base image and the PDF all key on it; an
//   elevation's definition is unchanged.
//
// 13-Sep-2026 - Version 1.6.0 (TrueVision)
// - Model Source. Describe carries the viewport's design phase; the underlay and
//   linework keys use that phase's fingerprint, the linework projects its model
//   and the underlay renders it. While the phase loads the frame shows a badge
//   and nothing of the previous model; switching phase never slides one phase's
//   picture or lines under the other. A viewport of the live phase is unchanged.
//
// 13-Sep-2026 - Version 1.5.1
// - The underlay draws the model's own edges at the viewport's Base Image weight.
//
// 12-Sep-2026 - Version 1.5.0
// - Per-category linework. The projection now tags every segment with the model
//   category it came from, so one class can be painted as several bands - walls
//   black and full weight, windows dark grey and thinner, furniture light grey -
//   from one projected result. Stroke rules also pick up the viewport's
//   Projected Linework and Hidden Lines composite weights, and dashes are
//   patterns rather than a single figure so centre lines are expressible.
//   An untagged result paints exactly as 1.4.1 did.
//
// 10-Sep-2026 - Version 1.4.1
// - Base Image off: no underlay is rendered, shown or exported; the frame keeps its linework alone.
//
// 10-Sep-2026 - Version 1.4.0
// - Underlay pixels come from the global raster level (Low, Medium, High); the export render always uses the export level.
//
// 10-Sep-2026 - Version 1.3.0
// - Linework widths scale from the sheet's viewport lineweight (points); the underlay key carries the Enhance Whitecard style.
//
// 10-Sep-2026 - Version 1.2.0
// - Progress badge while linework computes, render timing in the console, fresh renders kept in the browser store, snap source for the snapping module.
//
// 10-Sep-2026 - Version 1.1.0
// - Keys use the session-cached pipeline fingerprint instead of walking the model on every refresh.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Chrome, Markup, Snapshots
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__UpdateViewport, Na__LeModel__IsSitePlanViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__ToSvgMarkup } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildScenePrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeSnap__Render2d, Na__LeSnap__DrawingCentreMm, Na__LeSnap__GetPipelineFingerprint } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeSource__Resolve, Na__LeSource__Ensure, Na__LeSource__WaitFor, Na__LeSource__StatusText } from './Na__LayoutEditor__ModelSource__.js';
    import { Na__LeModelLayers__Token } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeComposite__RasterToken } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    import { Na__LeRaster__Get, Na__LeRaster__Working, Na__LeRaster__Export, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (definitions, pipeline, owners)
    // ------------------------------------------------------------
    import { Na__PlView__CacheKey } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__PlPipe__GetCached } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js';
    import { Na__PlOwners__Has } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Site Plan Data (what a site plan viewport draws)
    // ------------------------------------------------------------
    import {
        Na__SpStore__Reload,
        Na__SpStore__LoadAll,
        Na__SpStore__GetFocusBoundsMm
    } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport 2D Units (Window, Frame, Linework, SitePlan)
    // ------------------------------------------------------------
    import { Na__LeVp2d__Window, Na__LeVp2d__Describe } from './Na__LayoutEditor__Viewport2d__Window__.js';
    import {
        Na__LeVp2d__CLASS_ORDER,
        Na__LeVp2d__States,
        Na__LeVp2d__RasterWeights,
        Na__LeVp2d__SizeLayer,
        Na__LeVp2d__State,
        Na__LeVp2d__PlaceUnderlay,
        Na__LeVp2d__ScheduleUnderlay,
        Na__LeVp2d__ShowProgress,
        Na__LeVp2d__HideProgress,
        Na__LeVp2d__SetInteracting
    } from './Na__LayoutEditor__Viewport2d__Frame__.js';
    import {
        Na__LeVp2d__EnsureLinework,
        Na__LeVp2d__StyleToken,
        Na__LeVp2d__StrokeRules,
        Na__LeVp2d__StyleBands,
        Na__LeVp2d__PaintLinework
    } from './Na__LayoutEditor__Viewport2d__Linework__.js';
    import { Na__LeVp2d__SitePlanDrawing, Na__LeVp2d__FillSitePlan } from './Na__LayoutEditor__Viewport2d__SitePlan__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Window and Definition
// -----------------------------------------------------------------------------

    // FUNCTION | Centre the Window on the Drawing's Content
    // ------------------------------------------------------------
    function Na__LeVp2d__CentreOnDrawing(sheet, viewport) {
        if (Na__LeModel__IsSitePlanViewport(viewport)) {                         // <-- A site plan centres on the red line, else on all of its data
            const bounds = Na__SpStore__GetFocusBoundsMm();
            if (!bounds) return false;
            return Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : (bounds.MinX + bounds.MaxX) / 2, Y : (bounds.MinY + bounds.MaxY) / 2 } }, true);
        }
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return false;
        const centre = Na__LeSnap__DrawingCentreMm(described.definition);
        return Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : centre.x, Y : centre.y } }, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fill
// -----------------------------------------------------------------------------

    // FUNCTION | Fill (or Refresh) the Body of a 2D Frame
    // ------------------------------------------------------------
    function Na__LeVp2d__Fill(body, sheet, viewport, ppm) {
        const state     = Na__LeVp2d__State(body, viewport.Viewport__Id);
        if (Na__LeModel__IsSitePlanViewport(viewport)) {                         // <-- Site plan data: its own path, before any drawing or design phase check
            state.lastArgs = { sheet : sheet, viewport : viewport, ppm : ppm };
            Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm);
            return;
        }
        const described = Na__LeVp2d__Describe(viewport);
        const win       = described.window;
        state.lastArgs  = { sheet : sheet, viewport : viewport, ppm : ppm };

        if (!described.definition) {
            state.empty.textContent = Na__LeCfg__GetLabel('NoDrawingLinked', 'No drawing linked to this viewport.');
            state.empty.hidden = false;
            state.underlay.hidden = true;
            state.linework.innerHTML = ''; state.markup.innerHTML = '';
            state.lineworkKey = null; state.markupKey = null;
            return;
        }
        state.empty.hidden = true;

        // DESIGN PHASE NOT IN YET | Nothing of the model drawn before stays in the
        // frame; a badge says the phase is loading (the empty panel, that it
        // failed). The library's event refreshes the frames when it is in.
        const modelSource = described.modelSource;
        const modelFp     = Na__LeSnap__GetPipelineFingerprint(modelSource.renderId);
        if (modelFp === null) {
            Na__LeSource__Ensure(modelSource);
            if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
            state.underlay.hidden = true; state.renderedKey = null; state.renderedWindow = null; state.wantedKey = null;
            state.linework.innerHTML = ''; state.lineworkKey = null; state.lineworkSvg = null; state.classes = null; state.classesKey = null; state.markup.innerHTML = '';
            Na__LeVp2d__HideProgress(state);
            const failed = modelSource.status === 'failed';
            state.empty.textContent = failed ? Na__LeSource__StatusText(modelSource) : ''; state.empty.hidden = !failed;
            state.progress.textContent = failed ? '' : Na__LeSource__StatusText(modelSource); state.progress.hidden = failed;
            state.phaseWaiting = true;
            return;
        }
        if (state.phaseWaiting) { state.phaseWaiting = false; Na__LeVp2d__HideProgress(state); }

        // UNDERLAY | Slide the last picture; render a new one once things settle.
        // With the base image off nothing is rendered at all: the frame keeps
        // only its linework, which is what a vector drawing wants, and the
        // costly render never runs.
        const styles  = viewport.Viewport__Styles;
        state.masterPt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null;   // <-- Printed points for the visible linework
        if (styles.baseImage === false) {
            if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
            state.underlay.hidden = true;
            state.wantedKey = state.renderedKey;                                 // <-- Nothing outstanding while it is off
            // AND THE OLD PICTURE IS FORGOTTEN IF THE WINDOW HAS MOVED SINCE.
            // Switching the base image off does not stop the viewport being
            // resized, panned or rescaled; it only stops us re-rendering while
            // nobody can see it. Keeping the last picture across that meant
            // switching the base image back on painted a drawing of the old
            // window, stretched into the new frame, for as long as the fresh
            // render took - seconds, at high raster - and it reads exactly like
            // the drawing has drifted. Better to show nothing until there is
            // something true to show.
            const rendered = state.renderedWindow;
            const moved    = !rendered
                || Math.abs(rendered.OriginX  - win.OriginX)  > 0.5
                || Math.abs(rendered.OriginY  - win.OriginY)  > 0.5
                || Math.abs(rendered.WidthMm  - win.WidthMm)  > 0.5
                || Math.abs(rendered.HeightMm - win.HeightMm) > 0.5;
            if (moved) { state.renderedKey = null; state.renderedWindow = null; state.wantedKey = null; }
        } else {
            const key = [ described.definition.RecordHash, modelFp, Math.round(win.CentreX), Math.round(win.CentreY),
                          Math.round(win.WidthMm), Math.round(win.HeightMm), styles.whitecard, styles.glassOpaque, styles.profileLinework, styles.enhanceWhitecard, styles.contextLayer,
                          Na__LeModelLayers__Token(viewport), Na__LeRaster__Get() ]
                          .concat(Na__LeComposite__RasterToken(viewport) ? [ Na__LeComposite__RasterToken(viewport) ] : [])   // <-- Appended only when set, so every existing key is unchanged
                          .join('|');
            if (state.renderedFp && state.renderedFp !== modelFp) state.underlay.hidden = true;   // <-- Another design phase's picture is never slid under this one
            else Na__LeVp2d__PlaceUnderlay(state, win, ppm);
            state.wantedKey = key;
            if (key !== state.renderedKey) Na__LeVp2d__ScheduleUnderlay(state, viewport.Viewport__Id);
        }

        // LINEWORK | Cached classes paint now; otherwise they arrive later
        if (styles.projectedLinework === false) {
            // OFF | A raster viewport: no projection is ever asked for, nothing is
            // painted and the snap index has no points to offer.
            state.linework.innerHTML = ''; state.lineworkKey = null; state.lineworkSvg = null;
            state.classes = null; state.classesKey = null;
            Na__LeVp2d__HideProgress(state);
        } else {
            const cacheKey = Na__PlView__CacheKey(described.definition, modelFp);
            const paintKey = cacheKey + '|' + (styles.hiddenLines === true) + '|' + win.Denominator + '|' + state.masterPt + '|' + Na__LeVp2d__StyleToken(viewport);
            if (state.lineworkKey === paintKey && state.lineworkSvg) {
                state.lineworkSvg.setAttribute('viewBox', win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm);
                Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
            } else {
                if (state.paintedFp && state.paintedFp !== modelFp) { state.linework.innerHTML = ''; state.lineworkSvg = null; state.classes = null; state.classesKey = null; }   // <-- Another phase's lines go at once
                const cachedClasses = Na__PlPipe__GetCached(described.definition, modelSource.renderId ? modelFp : undefined);
                const classes = (cachedClasses && Na__PlOwners__Has(cachedClasses)) ? cachedClasses : null;   // <-- Untagged: fall through, EnsureLinework re-renders it tagged
                if (classes) { Na__LeVp2d__PaintLinework(state, viewport, cacheKey, classes, ppm); state.paintedFp = modelFp; }
                else {
                    Na__LeVp2d__ShowProgress(state, '');
                    Na__LeVp2d__EnsureLinework(described.definition, (phase) => Na__LeVp2d__ShowProgress(state, phase), false, modelSource).then((loaded) => {
                        Na__LeVp2d__HideProgress(state);
                        if (!loaded || Na__LeVp2d__States.get(viewport.Viewport__Id) !== state || !state.lastArgs) return;
                        Na__LeVp2d__PaintLinework(state, state.lastArgs.viewport, cacheKey, loaded, state.lastArgs.ppm);
                        state.paintedFp = modelFp;
                    });
                }
            }
        }

        // SCENE MARKUP | Static, at scale
        if (viewport.Viewport__MarkupMode === 'scene') {
            const primitives = Na__LeMarkup__BuildScenePrimitives(described);
            const frame = viewport.Viewport__FrameMm;
            state.markup.innerHTML = Na__LeChrome__ToSvgMarkup(primitives, frame.WidthMm, frame.HeightMm, 'na-le-frame__markup-svg');
            Na__LeVp2d__SizeLayer(state.markup.firstElementChild, viewport, ppm);
        } else {
            state.markup.innerHTML = '';
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Snapping Module Reads: Painted Classes and the Window
    // ------------------------------------------------------------
    // The key changes whenever the linework, pan, crop or scale changes, so
    // the snap index knows when to rebuild without being told.
    // ------------------------------------------------------------
    function Na__LeVp2d__GetSnapSource(viewportId) {
        const state = Na__LeVp2d__States.get(viewportId);
        if (!state || !state.classes || !state.lastArgs) return null;
        const win = Na__LeVp2d__Window(state.lastArgs.viewport);
        return {
            classes : state.classes,
            window  : win,
            key     : state.classesKey + '|' + Math.round(win.OriginX) + '|' + Math.round(win.OriginY) + '|' + Math.round(win.WidthMm) + '|' + Math.round(win.HeightMm) + '|' + win.Frame.X + '|' + win.Frame.Y
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Viewport's State
    // ------------------------------------------------------------
    function Na__LeVp2d__Release(viewportId) {
        const state = Na__LeVp2d__States.get(viewportId);
        if (!state) return;
        if (state.timer) window.clearTimeout(state.timer);
        Na__LeVp2d__HideProgress(state);
        Na__LeVp2d__States.delete(viewportId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Throw Away Everything Known About This Viewport and Draw It Again
    // ------------------------------------------------------------
    // Returns a promise that settles when the picture and the vectors are both
    // back. Awaited rather than debounced, so a caller stepping through a
    // sheet can wait for one viewport before starting the next instead of
    // launching every render at once and watching them queue.
    //
    // BOTH HALVES ARE REDONE, because "the composite is wrong" never tells you
    // which half is wrong. The raster carries the whitecard, the glass and the
    // context; the vectors carry the projection. Forcing one and trusting the
    // other would leave the same class of complaint half-fixed.
    // ------------------------------------------------------------
    async function Na__LeVp2d__ForceRender(sheet, viewport, onPhase) {
        const state = Na__LeVp2d__States.get(viewport.Viewport__Id);
        if (!state || !state.lastArgs) return false;                             // <-- Never painted: the next refresh draws it anyway
        if (Na__LeModel__IsSitePlanViewport(viewport)) {                         // <-- Re-read the site plan data: a new export draws without a reload
            await Na__SpStore__Reload();
            await Na__SpStore__LoadAll();
            if (Na__LeVp2d__States.get(viewport.Viewport__Id) !== state) return false;
            state.lineworkKey = null; state.lineworkSvg = null; state.classes = null; state.classesKey = null;
            Na__LeVp2d__FillSitePlan(state, sheet, viewport, state.lastArgs.ppm);
            return true;
        }
        if (!(await Na__LeSource__WaitFor(Na__LeSource__Resolve(viewport).renderId))) return false;   // <-- Its design phase, loaded first
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return false;
        const phaseId = described.modelSource.renderId;
        const ppm    = state.lastArgs.ppm;
        const styles = viewport.Viewport__Styles;

        state.renderedKey = null; state.renderedWindow = null;                    // <-- Nothing on screen is trusted from here
        state.lineworkKey = null; state.lineworkSvg = null;
        state.classes = null; state.classesKey = null;
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }

        // VECTORS | Re-project, ignoring every cache and the baked asset
        if (styles.projectedLinework !== false) {
            Na__LeVp2d__ShowProgress(state, '');
            const classes = await Na__LeVp2d__EnsureLinework(described.definition, (phase) => { Na__LeVp2d__ShowProgress(state, phase); if (onPhase) onPhase(phase); }, true, described.modelSource);
            Na__LeVp2d__HideProgress(state);
            if (classes && Na__LeVp2d__States.get(viewport.Viewport__Id) === state) {
                Na__LeVp2d__PaintLinework(state, viewport, Na__PlView__CacheKey(described.definition, Na__LeSnap__GetPipelineFingerprint(phaseId)), classes, ppm);
                state.paintedFp = Na__LeSnap__GetPipelineFingerprint(phaseId);
            }
        }

        // RASTER | Render the picture for the window the viewport has NOW
        if (styles.baseImage !== false) {
            const frame  = viewport.Viewport__FrameMm;
            const px     = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Working());
            const window0 = described.window;
            state.inFlight = true;
            let result = null;
            try {
                result = await Na__LeSnap__Render2d(described.definition, window0, styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples, Na__LeVp2d__RasterWeights(viewport), phaseId);
            } finally {
                state.inFlight = false;
            }
            if (result && Na__LeVp2d__States.get(viewport.Viewport__Id) === state) {
                state.underlay.src   = result.dataUrl;
                state.renderedFp     = Na__LeSnap__GetPipelineFingerprint(phaseId);
                state.renderedWindow = { OriginX : window0.OriginX, OriginY : window0.OriginY, WidthMm : window0.WidthMm, HeightMm : window0.HeightMm };
                state.renderedKey    = state.wantedKey;
                Na__LeVp2d__PlaceUnderlay(state, Na__LeVp2d__Window(viewport), ppm);
            }
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Fresh Underlay at Export Resolution (not cached)
    // ------------------------------------------------------------
    async function Na__LeVp2d__RenderForExport(viewport) {
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return null;
        if (viewport.Viewport__Styles.baseImage === false) return null;           // <-- Vector only: the PDF carries the linework alone
        if (!(await Na__LeSource__WaitFor(described.modelSource.renderId))) return null;   // <-- Its design phase, loaded first
        const frame = viewport.Viewport__FrameMm;
        const px    = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Export());   // <-- Always the export level, whatever is on screen
        return Na__LeSnap__Render2d(described.definition, described.window, viewport.Viewport__Styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples, Na__LeVp2d__RasterWeights(viewport), described.modelSource.renderId);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D API
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__CLASS_ORDER,
        Na__LeVp2d__StyleBands,
        Na__LeVp2d__Window,
        Na__LeVp2d__Describe,
        Na__LeVp2d__CentreOnDrawing,
        Na__LeVp2d__EnsureLinework,
        Na__LeVp2d__StrokeRules,
        Na__LeVp2d__Fill,
        Na__LeVp2d__Release,
        Na__LeVp2d__SetInteracting,
        Na__LeVp2d__RenderForExport,
        Na__LeVp2d__ForceRender,
        Na__LeVp2d__GetSnapSource,
        Na__LeVp2d__SitePlanDrawing
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
