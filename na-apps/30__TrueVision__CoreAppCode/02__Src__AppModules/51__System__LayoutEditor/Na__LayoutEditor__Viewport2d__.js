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
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (site plan viewports), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port); 1.5.1 ported 13-Sep-2026 as ValeVision3D v2.28.0
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import { Na__LeCfg__GetLineworkSetup, Na__LeCfg__GetLabel, Na__LeCfg__PtToMm } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__ResolveViewportSource, Na__LeModel__UpdateViewport, Na__LeModel__IsSitePlanViewport } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__ToSvgMarkup } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildScenePrimitives } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeSnap__Render2d, Na__LeSnap__DrawingCentreMm, Na__LeSnap__GetPipelineFingerprint, Na__LeSnap__GetModelRoot } from './Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeSource__Resolve, Na__LeSource__Ensure, Na__LeSource__WaitFor, Na__LeSource__StatusText } from './Na__LayoutEditor__ModelSource__.js';
    import { Na__LeModelLayers__Token, Na__LeModelLayers__ExcludeTokens, Na__LeModelLayers__IsOn } from './Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeDoors__PoseFor, Na__LeDoors__ShutPoseFor } from './Na__LayoutEditor__PlanDoors__.js';
    import {
        Na__LeEdge__Effective,
        Na__LeEdge__AppliesToClasses,
        Na__LeEdge__SolidMeansClassDefault,
        Na__LeEdge__Token
    } from './Na__LayoutEditor__EdgeStyles__.js';
    import { Na__LeComposite__Factor, Na__LeComposite__Token, Na__LeComposite__Weight, Na__LeComposite__RasterToken } from './Na__LayoutEditor__RenderComposites__.js';
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
    import { Na__PlOwners__Read, Na__PlOwners__KeyFor, Na__PlOwners__Has, Na__PlOwners__CreateTable, Na__PlOwners__IdFor, Na__PlOwners__Attach } from '../50__System__ProjectedLinework/Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Site Plan Data (what a site plan viewport draws)
    // ------------------------------------------------------------
    import {
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__Resolve,
        Na__SpStore__Reload,
        Na__SpStore__LoadAll,
        Na__SpStore__GetStatus,
        Na__SpStore__GetNote,
        Na__SpStore__GetDescriptor,
        Na__SpStore__GetLayerData,
        Na__SpStore__GetFocusBoundsMm
    } from '../52__System__SitePlanData/Na__SitePlan__Store__.js';
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
        // A PLAN DRAWS ITS DOORS OPEN, bar the ones this viewport closed, AND AN
        // ELEVATION OR SECTION DRAWS EVERY DOOR SHUT, whatever the 3D view shows.
        // The pose is part of the definition, so it keys everything the
        // definition keys.
        const definition = source.plan
            ? Na__PlView__FromPlan(source.plan, override, exclude, Na__LeDoors__PoseFor(viewport))
            : (source.elevation ? Na__PlView__FromElevation(source.elevation, override, exclude, Na__LeDoors__ShutPoseFor(viewport)) : null);
        return { source : source, definition : definition, window : Na__LeVp2d__Window(viewport), modelSource : Na__LeSource__Resolve(viewport) };
    }
    // ------------------------------------------------------------


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
// REGION | Linework
// -----------------------------------------------------------------------------

    // FUNCTION | The Four Classes for a Definition: Cache, Baked Asset, Then Render
    // ------------------------------------------------------------
    // modelSource is the viewport's Model Source (Describe().modelSource);
    // omitted, the live model. A design phase still loading is waited for once.
    // ------------------------------------------------------------
    function Na__LeVp2d__EnsureLinework(definition, onPhase, force, modelSource, waited) {
        if (!definition) return Promise.resolve(null);
        const phaseId = (modelSource && modelSource.renderId) ? modelSource.renderId : null;
        const modelFp = Na__LeSnap__GetPipelineFingerprint(phaseId);
        if (modelFp === null) {
            if (waited === true) return Promise.resolve(null);
            return Na__LeSource__WaitFor(phaseId).then((ready) => (ready ? Na__LeVp2d__EnsureLinework(definition, onPhase, force, modelSource, true) : null));
        }
        const cached = force === true ? null : Na__PlPipe__GetCached(definition, phaseId ? modelFp : undefined);   // <-- A forced render ignores what is already known
        // AN UNTAGGED RESULT IS A MISS HERE. The pipeline cache is shared with the
        // drawing view, and a result with no owner tags cannot draw one category
        // style: it paints the whole viewport in class colours and makes the edge
        // style controls look broken.
        if (cached && Na__PlOwners__Has(cached)) return Promise.resolve(cached);
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
                const root   = phaseId ? Na__LeSnap__GetModelRoot(phaseId) : undefined;
                if (phaseId && !root) return null;                                                  // <-- Let go meanwhile: never project the live model under this key
                const result = await Na__PlPipe__RenderDefinition(definition, null, null, onPhase, root);
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


    // HELPER FUNCTION | The Token for Everything That Changes How Linework Is Inked
    // ------------------------------------------------------------
    // ONE FUNCTION, TWO READERS. PaintLinework stamps it into lineworkKey and
    // Fill compares against it to decide whether a repaint is needed. If the two
    // built it separately and ever disagreed, Fill would never find a match and
    // would rebuild every frame's SVG on every refresh - correct, and slow enough
    // to feel broken on a busy sheet.
    // ------------------------------------------------------------
    function Na__LeVp2d__StyleToken(viewport) {
        return Na__LeEdge__Token(viewport) + '#' + Na__LeComposite__Token(viewport);
    }
    // ------------------------------------------------------------


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


    // FUNCTION | Paper Stroke Rules per Class
    // ------------------------------------------------------------
    // The base rule for each line class, before any per-category style. Three
    // multipliers stack on the configured paper widths, in this order:
    //
    //   scale             the sheet's master viewport lineweight, which sets the
    //                     VISIBLE width and leaves the other classes their
    //                     configured ratios to it
    //   vector            this viewport's Projected Linework composite weight -
    //                     one number that thickens or thins the whole vector
    //                     drawing without touching the sheet master
    //   hiddenFactor      this viewport's Hidden Lines composite weight, on the
    //                     hidden class alone, so hidden work can be quietened
    //                     without thinning anything actually visible
    //
    // Dashes are arrays of paper millimetres now, not a single number: a centre
    // line is long-short-long and cannot be expressed as one figure.
    // ------------------------------------------------------------
    function Na__LeVp2d__StrokeRules(viewport, masterPt) {
        const setup = Na__LeCfg__GetLineworkSetup();
        const scale = Number.isFinite(masterPt) ? Na__LeCfg__PtToMm(masterPt) / setup.visibleWidthMm : 1;
        const vector       = Na__LeComposite__Factor(viewport, 'projectedLinework');
        const hiddenFactor = Na__LeComposite__Factor(viewport, 'hiddenLines');
        const dash         = setup.hiddenDashMm > 0 ? [ setup.hiddenDashMm, setup.hiddenDashMm ] : [];
        return {
            visible  : { colour : Na__PlCfg__GetAppearance('visible').StrokeColour,  widthMm : setup.visibleWidthMm  * scale * vector, dashMm : [] },
            hidden   : { colour : Na__PlCfg__GetAppearance('hidden').StrokeColour,   widthMm : setup.hiddenWidthMm   * scale * vector * hiddenFactor, dashMm : dash },
            authored : { colour : Na__PlCfg__GetAppearance('authored').StrokeColour, widthMm : setup.authoredWidthMm * scale * vector, dashMm : [] },
            section  : { colour : Na__PlCfg__GetAppearance('section').StrokeColour,  widthMm : setup.sectionWidthMm  * scale * vector, dashMm : [] }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Break Each Class Into Bands of One Style
    // ------------------------------------------------------------
    // Returns [ { className, colour, widthMm, dashMm, indices } ] in paint order.
    // indices is null for a band that is the WHOLE class, which is the answer
    // whenever there is nothing to distinguish - an untagged result, a class the
    // config does not let categories restyle, or a viewport whose categories all
    // resolve to the same look. In that case this produces exactly the four
    // rules the module produced before per-category styling existed.
    //
    // A TAGGED CLASS IS BUCKETED BY RESOLVED STYLE, not by category. Thirty
    // categories that all land on black-solid-1.0 are one band and one path, so
    // the common case costs one pass over the segments and nothing else.
    // ------------------------------------------------------------
    function Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden) {
        const rules   = Na__LeVp2d__StrokeRules(viewport, masterPt);
        const tags    = Na__PlOwners__Read(classes);
        const styled  = Na__LeEdge__AppliesToClasses();
        const classDefaultDash = Na__LeEdge__SolidMeansClassDefault();
        const bands   = [];

        Na__LeVp2d__CLASS_ORDER.forEach((name) => {
            if (name === 'hidden' && !showHidden) return;
            const segments = classes ? classes[name] : null;
            if (!segments || segments.length < 4) return;
            const base  = rules[name];
            const count = Math.floor(segments.length / 4);

            if (!tags || styled.indexOf(name) === -1) {
                bands.push({ className : name, colour : base.colour, widthMm : base.widthMm, dashMm : base.dashMm, indices : null });
                return;
            }

            const owners = tags.Owners[name];
            if (!owners || owners.length !== count) {                              // <-- Defensive: paint the class rather than mis-colour it
                bands.push({ className : name, colour : base.colour, widthMm : base.widthMm, dashMm : base.dashMm, indices : null });
                return;
            }

            // ONE LOOKUP PER OWNER ID, not one per segment. A model has tens of
            // categories and a drawing has tens of thousands of segments.
            const byOwner = new Map();
            const resolve = (id) => {
                let style = byOwner.get(id);
                if (style) return style;
                const effective = Na__LeEdge__Effective(viewport, Na__PlOwners__KeyFor(tags.OwnerKeys, id));
                const dash = (effective.lineType === 'solid' && classDefaultDash) ? base.dashMm : effective.patternMm;
                style = {
                    colour  : effective.hex,
                    widthMm : base.widthMm * effective.weight,
                    dashMm  : dash,
                    key     : effective.hex + '|' + (Math.round(base.widthMm * effective.weight * 10000) / 10000) + '|' + dash.join(',')
                };
                byOwner.set(id, style);
                return style;
            };

            const buckets = new Map();
            for (let i = 0; i < count; i++) {
                const style = resolve(owners[i]);
                let list = buckets.get(style.key);
                if (!list) { list = { style : style, indices : [] }; buckets.set(style.key, list); }
                list.indices.push(i);
            }

            if (buckets.size === 1) {                                             // <-- Every category agrees: one path, as before
                const only = buckets.values().next().value;
                bands.push({ className : name, colour : only.style.colour, widthMm : only.style.widthMm, dashMm : only.style.dashMm, indices : null });
                return;
            }

            // HEAVIEST LAST INSIDE A CLASS. Two lines of different weight meeting
            // at a corner read better with the heavier one drawn over the lighter,
            // which is also how the class order itself is arranged.
            Array.from(buckets.values())
                .sort((a, b) => a.style.widthMm - b.style.widthMm)
                .forEach((bucket) => {
                    bands.push({
                        className : name,
                        colour    : bucket.style.colour,
                        widthMm   : bucket.style.widthMm,
                        dashMm    : bucket.style.dashMm,
                        indices   : Uint32Array.from(bucket.indices)
                    });
                });
        });

        return bands;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Path Data per Band, Built Once per Result and Style
    // ------------------------------------------------------------
    // The cache key carries the style token as well as the linework key, because
    // the same projected geometry legitimately draws several ways.
    // ------------------------------------------------------------
    function Na__LeVp2d__BandPaths(cacheKey, bands, classes) {
        let paths = Na__LeVp2d__PathCache.get(cacheKey);
        if (paths) return paths;
        paths = bands.map((band) => {
            const segments = classes[band.className];
            if (band.indices === null) return Na__PlOverlay__BuildPathData(segments);
            return Na__LeVp2d__PathDataFor(segments, band.indices);
        });
        Na__LeVp2d__PathCache.set(cacheKey, paths);
        if (Na__LeVp2d__PathCache.size > 16) Na__LeVp2d__PathCache.delete(Na__LeVp2d__PathCache.keys().next().value);
        return paths;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Path Data for a Chosen Subset of One Class
    // ------------------------------------------------------------
    function Na__LeVp2d__PathDataFor(segments, indices) {
        if (!segments || !indices || indices.length === 0) return '';
        const round = (value) => Math.round(value * 100) / 100;
        const parts = new Array(indices.length);
        for (let k = 0; k < indices.length; k++) {
            const at = indices[k] * 4;
            parts[k] = 'M' + round(segments[at]) + ' ' + round(segments[at + 1]) +
                       'L' + round(segments[at + 2]) + ' ' + round(segments[at + 3]);
        }
        return parts.join('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Linework SVG for a Window
    // ------------------------------------------------------------
    function Na__LeVp2d__PaintLinework(state, viewport, key, classes, ppm) {
        const win = Na__LeVp2d__Window(viewport);
        const D      = win.Denominator;
        const showHidden = viewport.Viewport__Styles.hiddenLines === true;
        // THE STYLE TOKEN IS BOTH THE PATH CACHE KEY AND THE REPAINT GUARD. It is
        // deliberately NOT part of the linework cache key: restyling a category
        // changes how the drawing is painted, not what was projected, so a colour
        // change must never trigger a re-projection.
        const styleToken = Na__LeVp2d__StyleToken(viewport);
        const bands  = Na__LeVp2d__StyleBands(viewport, state.masterPt, classes, showHidden);
        const paths  = Na__LeVp2d__BandPaths(key + '@' + showHidden + '@' + styleToken, bands, classes);
        let body = '';
        bands.forEach((band, index) => {
            const d = paths[index];
            if (!d) return;
            const dashAttr = (band.dashMm && band.dashMm.length > 0)
                ? ' stroke-dasharray="' + band.dashMm.map((mm) => mm * D).join(' ') + '"'
                : '';
            body += '<path d="' + d + '" fill="none" stroke="' + band.colour + '" stroke-width="' + (band.widthMm * D) +
                    '" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + '/>';
        });
        state.linework.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="na-le-frame__linework-svg" viewBox="' +
            win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm + '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>';
        state.lineworkKey  = key + '|' + showHidden + '|' + D + '|' + state.masterPt + '|' + styleToken;
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
            const phaseId = described.modelSource.renderId;
            const phaseFp = Na__LeSnap__GetPipelineFingerprint(phaseId);
            if (phaseFp === null) return;                                         // <-- Its design phase is not in: the load's refresh schedules again
            const key = state.wantedKey;
            const frame   = args.viewport.Viewport__FrameMm;
            const px      = Na__LeRaster__Fit(frame.WidthMm, frame.HeightMm, Na__LeRaster__Working());   // <-- The global working level
            const windowSnapshot = described.window;
            state.inFlight = true;
            Na__LeSnap__Render2d(described.definition, windowSnapshot, args.viewport.Viewport__Styles, px.w, px.h, args.viewport.Viewport__ModelLayers, px.samples, Na__LeVp2d__RasterWeights(args.viewport), phaseId).then((result) => {
                state.inFlight = false;
                if (!Na__LeVp2d__States.has(viewportId) || Na__LeVp2d__States.get(viewportId) !== state) return;
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


    // HELPER FUNCTION | What a Site Plan Viewport's Lines Depend On, as One Token
    // ------------------------------------------------------------
    // The export time and the layers switched off: a new export or a Model Layers
    // toggle changes it; a pan, a crop or a restyle does not.
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanToken(viewport) {
        const descriptor = Na__SpStore__GetDescriptor();
        return 'siteplan:' + (descriptor ? descriptor.SitePlan__ExportedIso : 'none') + ':' + Na__LeModelLayers__Token(viewport);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Repaint Guard for a Site Plan Viewport
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanPaintKey(viewport, masterPt) {
        return Na__LeVp2d__SitePlanToken(viewport) + '|' + viewport.Viewport__ScaleDenominator + '|' + masterPt + '|' + Na__LeVp2d__StyleToken(viewport);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Classes and Fills From the Loaded Site Plan Layers
    // ------------------------------------------------------------
    // EVERY SITE PLAN LINE GOES IN THE VISIBLE CLASS, tagged with its layer as
    // the owner, so StyleBands styles each layer as it styles a model category -
    // colour, line type and weight from EdgeStyles, with the export's style as
    // the default - and snapping and the PDF read the same classes unchanged. A
    // layer this viewport has switched off is left out here, because owners
    // filter nothing downstream.
    //
    // Null while a layer is still loading, unless allowMissing, which leaves out
    // a layer that failed once everything has settled.
    // ------------------------------------------------------------
    function Na__LeVp2d__SitePlanBuild(viewport, allowMissing) {
        const descriptor = Na__SpStore__GetDescriptor();
        if (!descriptor) return null;
        const loaded = [];
        const layers = descriptor.SitePlan__Layers.filter((layer) => Na__LeModelLayers__IsOn(viewport, layer.Layer__CategoryKey));
        for (let i = 0; i < layers.length; i++) {
            const data = Na__SpStore__GetLayerData(layers[i].Layer__CategoryKey);
            if (data) loaded.push(data);
            else if (allowMissing !== true) return null;
        }
        const total    = loaded.reduce((sum, data) => sum + data.segmentCount, 0);
        const segments = new Float32Array(total * 4);
        const owners   = new Uint16Array(total);
        const table    = Na__PlOwners__CreateTable();
        let at = 0;
        loaded.forEach((data) => {
            segments.set(data.segments, at * 4);
            owners.fill(Na__PlOwners__IdFor(table, data.categoryKey), at, at + data.segmentCount);
            at += data.segmentCount;
        });
        const classes = { visible : segments, hidden : new Float32Array(0), authored : new Float32Array(0), section : new Float32Array(0) };
        Na__PlOwners__Attach(classes, { visible : owners, hidden : new Uint16Array(0), authored : new Uint16Array(0), section : new Uint16Array(0) }, table.Keys);
        const fills = loaded
            .filter((data) => data.rings.length > 0 && data.layer.Layer__Style.FillHex && Number.isFinite(data.layer.Layer__Style.FillOpacity) && data.layer.Layer__Style.FillOpacity > 0)
            .map((data) => ({ categoryKey : data.categoryKey, hex : data.layer.Layer__Style.FillHex, opacity : data.layer.Layer__Style.FillOpacity, rings : data.rings }));
        return { classes : classes, fills : fills, key : Na__LeVp2d__SitePlanToken(viewport) };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Site Plan Viewport's Classes and Fills, Loading the Data First
    // ------------------------------------------------------------
    // Resolves { classes, fills, key }, or null when the project has no site plan
    // data. The PDF exporter awaits this; the sheet paints from the same build.
    // ------------------------------------------------------------
    async function Na__LeVp2d__SitePlanDrawing(viewport) {
        const descriptor = await Na__SpStore__Resolve();
        if (!descriptor) return null;
        await Na__SpStore__LoadAll();
        return Na__LeVp2d__SitePlanBuild(viewport, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Path Data for Fill Rings (even-odd, so a hole cuts out)
    // ------------------------------------------------------------
    function Na__LeVp2d__RingPathData(rings) {
        const round = (value) => Math.round(value * 100) / 100;
        let d = '';
        rings.forEach((ring) => {
            const p = ring.points;
            if (!p || p.length < 6) return;
            d += 'M' + round(p[0]) + ' ' + round(p[1]);
            for (let i = 2; i + 1 < p.length; i += 2) d += 'L' + round(p[i]) + ' ' + round(p[i + 1]);
            d += 'Z';
        });
        return d;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Site Plan Viewport's SVG: the Fills Under the Styled Lines
    // ------------------------------------------------------------
    function Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm) {
        const win        = Na__LeVp2d__Window(viewport);
        const D          = win.Denominator;
        const styleToken = Na__LeVp2d__StyleToken(viewport);
        const bands      = Na__LeVp2d__StyleBands(viewport, state.masterPt, built.classes, false);
        const paths      = Na__LeVp2d__BandPaths(built.key + '@false@' + styleToken, bands, built.classes);
        let body = '';
        built.fills.forEach((fill) => {
            const d = Na__LeVp2d__RingPathData(fill.rings);
            if (d) body += '<path d="' + d + '" fill="' + fill.hex + '" fill-opacity="' + fill.opacity + '" fill-rule="evenodd" stroke="none"/>';
        });
        bands.forEach((band, index) => {
            const d = paths[index];
            if (!d) return;
            const dashAttr = (band.dashMm && band.dashMm.length > 0)
                ? ' stroke-dasharray="' + band.dashMm.map((mm) => mm * D).join(' ') + '"'
                : '';
            body += '<path d="' + d + '" fill="none" stroke="' + band.colour + '" stroke-width="' + (band.widthMm * D) +
                    '" stroke-linecap="round" stroke-linejoin="round"' + dashAttr + '/>';
        });
        state.linework.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="na-le-frame__linework-svg" viewBox="' +
            win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm + '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>';
        state.lineworkKey = Na__LeVp2d__SitePlanPaintKey(viewport, state.masterPt);
        state.lineworkSvg = state.linework.firstElementChild;
        state.classes     = built.classes;                                       // <-- Snap source: site plan vertices snap like any linework
        state.classesKey  = built.key;
        state.paintedFp   = null;
        Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill (or Refresh) a Site Plan Viewport
    // ------------------------------------------------------------
    // No raster, no projection and no design phase: the lines come ready-made
    // from the site plan data. While the data loads the frame shows a badge; a
    // project with none says how to export it.
    // ------------------------------------------------------------
    function Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm) {
        if (state.timer) { window.clearTimeout(state.timer); state.timer = null; }
        state.underlay.hidden = true; state.renderedKey = null; state.renderedWindow = null; state.wantedKey = null;
        state.markup.innerHTML = ''; state.markupKey = null;
        state.masterPt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null;

        const status = Na__SpStore__GetStatus();
        if (status !== Na__SpStore__STATUS_READY) {
            state.linework.innerHTML = ''; state.lineworkKey = null; state.lineworkSvg = null; state.classes = null; state.classesKey = null;
            if (status === Na__SpStore__STATUS_EMPTY) {
                Na__LeVp2d__HideProgress(state);
                state.empty.textContent = Na__LeCfg__GetLabel('SitePlanNoData', 'No site plan data for this project.');
                state.empty.title       = Na__SpStore__GetNote() || '';
                state.empty.hidden      = false;
                return;
            }
            state.empty.hidden = true;
            state.progress.textContent = Na__LeCfg__GetLabel('SitePlanLoading', 'Loading site plan data...');
            state.progress.hidden = false;
            Na__SpStore__Resolve().then(() => Na__LeVp2d__RefillSitePlan(state, viewport.Viewport__Id, false));
            return;
        }
        state.empty.hidden = true;
        state.empty.title  = '';

        const win      = Na__LeVp2d__Window(viewport);
        const paintKey = Na__LeVp2d__SitePlanPaintKey(viewport, state.masterPt);
        if (state.lineworkKey === paintKey && state.lineworkSvg) {
            state.lineworkSvg.setAttribute('viewBox', win.OriginX + ' ' + win.OriginY + ' ' + win.WidthMm + ' ' + win.HeightMm);
            Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm);
            return;
        }
        const built = Na__LeVp2d__SitePlanBuild(viewport, false);
        if (built) {
            Na__LeVp2d__HideProgress(state);
            Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm);
            return;
        }
        state.progress.textContent = Na__LeCfg__GetLabel('SitePlanLoading', 'Loading site plan data...');
        state.progress.hidden = false;
        Na__SpStore__LoadAll().then(() => Na__LeVp2d__RefillSitePlan(state, viewport.Viewport__Id, true));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint Again Once the Data Has Arrived (only while the frame is still this one)
    // ------------------------------------------------------------
    function Na__LeVp2d__RefillSitePlan(state, viewportId, settled) {
        if (Na__LeVp2d__States.get(viewportId) !== state || !state.lastArgs) return;
        const args = state.lastArgs;
        if (!Na__LeModel__IsSitePlanViewport(args.viewport)) return;
        if (settled === true && Na__SpStore__GetStatus() === Na__SpStore__STATUS_READY) {
            const built = Na__LeVp2d__SitePlanBuild(args.viewport, true);          // <-- Everything has settled: a layer that failed is left out
            Na__LeVp2d__HideProgress(state);
            if (built) Na__LeVp2d__PaintSitePlan(state, args.viewport, built, args.ppm);
            return;
        }
        Na__LeVp2d__FillSitePlan(state, args.sheet, args.viewport, args.ppm);
    }
    // ------------------------------------------------------------


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
