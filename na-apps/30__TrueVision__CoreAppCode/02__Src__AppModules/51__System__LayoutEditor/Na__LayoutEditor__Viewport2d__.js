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
//
// INTEGRATION:
// - The sheet surface calls Fill for every visible 2D frame; the tools
//   flag interaction so renders wait for the drag to end.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Viewport2d__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import { Na__LeCfg__GetLineworkSetup, Na__LeCfg__GetLabel, Na__LeCfg__PtToMm } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__ResolveViewportSource, Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__ToSvgMarkup } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildScenePrimitives } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeSnap__Render2d, Na__LeSnap__DrawingCentreMm, Na__LeSnap__GetPipelineFingerprint } from './Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeModelLayers__Token, Na__LeModelLayers__ExcludeTokens } from './Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeRaster__Get, Na__LeRaster__Working, Na__LeRaster__Export, Na__LeRaster__Fit } from './Na__LayoutEditor__RasterQuality__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (definitions, pipeline, store, appearance)
    // ------------------------------------------------------------
    import { Na__PlCfg__GetAppearance } from '../50__System__ProjectedLinework/Na__ProjectedLinework__ConfigAccess__.js';
    import {
        Na__PlView__FromPlan,
        Na__PlView__FromElevation,
        Na__PlView__Fingerprint,
        Na__PlView__CacheKey
    } from '../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    import {
        Na__PlPipe__GetCached,
        Na__PlPipe__RenderDefinition,
        Na__PlPipe__Remember
    } from '../50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js';
    import { Na__PlStore__LoadForDefinition, Na__PlStore__RememberRender } from '../50__System__ProjectedLinework/Na__ProjectedLinework__Persistence__.js';
    import { Na__PlOverlay__BuildPathData } from '../50__System__ProjectedLinework/Na__ProjectedLinework__SvgOverlay__.js';
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
// REGION | Window and Definition
// -----------------------------------------------------------------------------

    // FUNCTION | The Model Window of a Viewport, With Its Paper Mappings
    // ------------------------------------------------------------
    function Na__LeVp2d__Window(viewport) {
        const frame = viewport.Viewport__FrameMm;
        const D     = viewport.Viewport__ScaleDenominator;
        const w     = frame.WidthMm  * D;
        const h     = frame.HeightMm * D;
        const cx    = viewport.Viewport__PanMm.X;
        const cy    = viewport.Viewport__PanMm.Y;
        const ox    = cx - (w / 2);
        const oy    = cy - (h / 2);
        const win = {
            CentreX : cx, CentreY : cy, WidthMm : w, HeightMm : h, OriginX : ox, OriginY : oy, Denominator : D, Frame : frame,
            ToLocal   : (dx, dy) => ({ x : (dx - ox) / D, y : (dy - oy) / D }),
            ToPaper   : (dx, dy) => ({ x : frame.X + ((dx - ox) / D), y : frame.Y + ((dy - oy) / D) }),
            FromPaper : (px, py) => ({ x : ox + ((px - frame.X) * D), y : oy + ((py - frame.Y) * D) })
        };
        return win;
    }
    // ------------------------------------------------------------


    // FUNCTION | Source Records, Projection Definition and Window in One Go
    // ------------------------------------------------------------
    function Na__LeVp2d__Describe(viewport) {
        const source = Na__LeModel__ResolveViewportSource(viewport);
        // The viewport's own Render Composites toggles override the drawing
        // record's, so a sheet can show the same drawing two ways - and so a
        // toggle in the panel governs the linework as well as the raster.
        const override   = viewport.Viewport__Styles || null;
        // AND THE MODEL LAYERS PANEL GOES IN AS EXCLUSION TOKENS, which is the
        // whole of how a hidden category leaves the vectors. The tokens are
        // part of the definition, so they are part of its RecordHash, so two
        // viewports of one drawing that hide different things key differently
        // and cache separately without another word being said about it.
        const exclude    = Na__LeModelLayers__ExcludeTokens(viewport);
        const definition = source.plan
            ? Na__PlView__FromPlan(source.plan, override, exclude)
            : (source.elevation ? Na__PlView__FromElevation(source.elevation, override, exclude) : null);
        return { source : source, definition : definition, window : Na__LeVp2d__Window(viewport) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Centre the Window on the Drawing's Content
    // ------------------------------------------------------------
    function Na__LeVp2d__CentreOnDrawing(sheet, viewport) {
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return false;
        const centre = Na__LeSnap__DrawingCentreMm(described.definition);
        return Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : centre.x, Y : centre.y } }, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Linework
// -----------------------------------------------------------------------------

    // FUNCTION | The Four Classes for a Definition: Cache, Baked Asset, Then Render
    // ------------------------------------------------------------
    function Na__LeVp2d__EnsureLinework(definition, onPhase, force) {
        if (!definition) return Promise.resolve(null);
        const cached = force === true ? null : Na__PlPipe__GetCached(definition);   // <-- A forced render ignores what is already known
        if (cached) return Promise.resolve(cached);
        const modelFp = Na__LeSnap__GetPipelineFingerprint();
        const key     = Na__PlView__CacheKey(definition, modelFp);
        if (force === true) { Na__LeVp2d__Linework.delete(key); Na__LeVp2d__PathCache.delete(key); }
        if (Na__LeVp2d__Linework.has(key)) return Na__LeVp2d__Linework.get(key);
        const fingerprint = Na__PlView__Fingerprint(definition, modelFp);
        const promise = (async () => {
            try {
                // THE BAKED ASSET IS SKIPPED WHEN FORCED. Reading it back is the
                // whole point of the store on an ordinary paint, and exactly the
                // wrong answer when someone has asked for a fresh projection:
                // the stored copy is the thing they are trying to get past.
                const stored = force === true ? null : await Na__PlStore__LoadForDefinition(definition, fingerprint, key);
                if (stored) { Na__PlPipe__Remember(key, definition, stored, fingerprint, 'asset'); return stored; }
                const startedAt = performance.now();
                const result = await Na__PlPipe__RenderDefinition(definition, null, null, onPhase);
                if (result && result.Classes) {
                    Na__PlPipe__Remember(result.CacheKey, definition, result.Classes, result.Fingerprint, 'render');
                    void Na__PlStore__RememberRender(definition, result);                          // <-- A reload paints from IndexedDB
                    const report = result.Report || {};
                    console.log('[TrueVision3D LayoutEditor] Linework ' + definition.ViewKey + ' rendered in ' + Math.round(performance.now() - startedAt) + ' ms',
                        { collectMs : report.CollectMs, intersections : report.IntersectionCount, intersectionSkipped : report.IntersectionSkipped || null, triangles : report.TriangleTotal, edges : report.EdgeCount, segments : report.SegmentCount, phases : report.Phases });
                    return result.Classes;
                }
                return null;
            } catch (lineworkError) {
                console.warn('[TrueVision3D LayoutEditor] Linework unavailable for ' + definition.ViewKey + ':', lineworkError);
                return null;
            } finally {
                Na__LeVp2d__Linework.delete(key);
            }
        })();
        Na__LeVp2d__Linework.set(key, promise);
        return promise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Path Data per Class, Built Once per Result
    // ------------------------------------------------------------
    function Na__LeVp2d__PathsFor(key, classes) {
        let paths = Na__LeVp2d__PathCache.get(key);
        if (paths) return paths;
        paths = {};
        Na__LeVp2d__CLASS_ORDER.forEach((name) => { paths[name] = Na__PlOverlay__BuildPathData(classes ? classes[name] : null); });
        Na__LeVp2d__PathCache.set(key, paths);
        if (Na__LeVp2d__PathCache.size > 16) Na__LeVp2d__PathCache.delete(Na__LeVp2d__PathCache.keys().next().value);
        return paths;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paper Stroke Rules per Class
    // ------------------------------------------------------------
    function Na__LeVp2d__StrokeRules(masterPt) {
        const setup = Na__LeCfg__GetLineworkSetup();
        const scale = Number.isFinite(masterPt) ? Na__LeCfg__PtToMm(masterPt) / setup.visibleWidthMm : 1;   // <-- The sheet's viewport weight sets the visible width; the classes keep their ratios
        return {
            visible  : { colour : Na__PlCfg__GetAppearance('visible').StrokeColour,  widthMm : setup.visibleWidthMm  * scale, dashMm : 0 },
            hidden   : { colour : Na__PlCfg__GetAppearance('hidden').StrokeColour,   widthMm : setup.hiddenWidthMm   * scale, dashMm : setup.hiddenDashMm },
            authored : { colour : Na__PlCfg__GetAppearance('authored').StrokeColour, widthMm : setup.authoredWidthMm * scale, dashMm : 0 },
            section  : { colour : Na__PlCfg__GetAppearance('section').StrokeColour,  widthMm : setup.sectionWidthMm  * scale, dashMm : 0 }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Linework SVG for a Window
    // ------------------------------------------------------------
    function Na__LeVp2d__PaintLinework(state, viewport, key, classes, ppm) {
        const win = Na__LeVp2d__Window(viewport);
        const D      = win.Denominator;
        const rules  = Na__LeVp2d__StrokeRules(state.masterPt);
        const paths  = Na__LeVp2d__PathsFor(key, classes);
        const showHidden = viewport.Viewport__Styles.hiddenLines === true;
        let body = '';
        Na__LeVp2d__CLASS_ORDER.forEach((name) => {
            if (name === 'hidden' && !showHidden) return;
            if (!paths[name]) return;
            const rule = rules[name];
            body += '<path d="' + paths[name] + '" fill="none" stroke="' + rule.colour + '" stroke-width="' + (rule.widthMm * D) +
                    '" stroke-linecap="round" stroke-linejoin="round"' + (rule.dashMm > 0 ? ' stroke-dasharray="' + (rule.dashMm * D) + ' ' + (rule.dashMm * D) + '"' : '') + '/>';
        });
        state.linework.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="na-le-frame__linework-svg" viewBox="' +
            win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm + '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>';
        state.lineworkKey  = key + '|' + showHidden + '|' + D + '|' + state.masterPt;
        state.lineworkSvg  = state.linework.firstElementChild;
        state.classes      = classes;                                             // <-- Snap source
        state.classesKey   = key;
        Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fill
// -----------------------------------------------------------------------------

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
            const key = state.wantedKey;
            const frame   = args.viewport.Viewport__FrameMm;
            const px      = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Working());   // <-- The global working level
            const windowSnapshot = described.window;
            state.inFlight = true;
            Na__LeSnap__Render2d(described.definition, windowSnapshot, args.viewport.Viewport__Styles, px.w, px.h, args.viewport.Viewport__ModelLayers, px.samples).then((result) => {
                state.inFlight = false;
                if (!Na__LeVp2d__States.has(viewportId) || Na__LeVp2d__States.get(viewportId) !== state) return;
                if (result) {
                    state.underlay.src   = result.dataUrl;
                    state.renderedKey    = key;
                    state.renderedWindow = { OriginX : windowSnapshot.OriginX, OriginY : windowSnapshot.OriginY, WidthMm : windowSnapshot.WidthMm, HeightMm : windowSnapshot.HeightMm };
                    Na__LeVp2d__PlaceUnderlay(state, Na__LeVp2d__Window(state.lastArgs.viewport), state.lastArgs.ppm);
                }
                if (state.wantedKey !== state.renderedKey) Na__LeVp2d__ScheduleUnderlay(state, viewportId);   // <-- Moved on meanwhile
            });
        }, Na__LeVp2d__RENDER_DELAY_MS);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fill (or Refresh) the Body of a 2D Frame
    // ------------------------------------------------------------
    function Na__LeVp2d__Fill(body, sheet, viewport, ppm) {
        const state     = Na__LeVp2d__State(body, viewport.Viewport__Id);
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

        // UNDERLAY | Slide the last picture; render a new one once things settle.
        // With the base image off nothing is rendered at all: the frame keeps
        // only its linework, which is what a vector drawing wants, and the
        // costly render never runs.
        const styles  = viewport.Viewport__Styles;
        state.masterPt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null;   // <-- Printed points for the visible linework
        const modelFp = Na__LeSnap__GetPipelineFingerprint();
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
                          Na__LeModelLayers__Token(viewport), Na__LeRaster__Get() ].join('|');
            Na__LeVp2d__PlaceUnderlay(state, win, ppm);
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
            const paintKey = cacheKey + '|' + (styles.hiddenLines === true) + '|' + win.Denominator + '|' + state.masterPt;
            if (state.lineworkKey === paintKey && state.lineworkSvg) {
                state.lineworkSvg.setAttribute('viewBox', win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm);
                Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
            } else {
                const classes = Na__PlPipe__GetCached(described.definition);
                if (classes) Na__LeVp2d__PaintLinework(state, viewport, cacheKey, classes, ppm);
                else {
                    Na__LeVp2d__ShowProgress(state, '');
                    Na__LeVp2d__EnsureLinework(described.definition, (phase) => Na__LeVp2d__ShowProgress(state, phase)).then((loaded) => {
                        Na__LeVp2d__HideProgress(state);
                        if (!loaded || Na__LeVp2d__States.get(viewport.Viewport__Id) !== state || !state.lastArgs) return;
                        Na__LeVp2d__PaintLinework(state, state.lastArgs.viewport, cacheKey, loaded, state.lastArgs.ppm);
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
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return false;
        const ppm    = state.lastArgs.ppm;
        const styles = viewport.Viewport__Styles;

        state.renderedKey = null; state.renderedWindow = null;                    // <-- Nothing on screen is trusted from here
        state.lineworkKey = null; state.lineworkSvg = null;
        state.classes = null; state.classesKey = null;
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }

        // VECTORS | Re-project, ignoring every cache and the baked asset
        if (styles.projectedLinework !== false) {
            Na__LeVp2d__ShowProgress(state, '');
            const classes = await Na__LeVp2d__EnsureLinework(described.definition, (phase) => { Na__LeVp2d__ShowProgress(state, phase); if (onPhase) onPhase(phase); }, true);
            Na__LeVp2d__HideProgress(state);
            if (classes && Na__LeVp2d__States.get(viewport.Viewport__Id) === state) {
                Na__LeVp2d__PaintLinework(state, viewport, Na__PlView__CacheKey(described.definition, Na__LeSnap__GetPipelineFingerprint()), classes, ppm);
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
                result = await Na__LeSnap__Render2d(described.definition, window0, styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples);
            } finally {
                state.inFlight = false;
            }
            if (result && Na__LeVp2d__States.get(viewport.Viewport__Id) === state) {
                state.underlay.src   = result.dataUrl;
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
    function Na__LeVp2d__RenderForExport(viewport) {
        const described = Na__LeVp2d__Describe(viewport);
        if (!described.definition) return Promise.resolve(null);
        if (viewport.Viewport__Styles.baseImage === false) return Promise.resolve(null);   // <-- Vector only: the PDF carries the linework alone
        const frame = viewport.Viewport__FrameMm;
        const px    = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Export());   // <-- Always the export level, whatever is on screen
        return Na__LeSnap__Render2d(described.definition, described.window, viewport.Viewport__Styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples);
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
        Na__LeVp2d__GetSnapSource
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
