// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D - LINEWORK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__Linework__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D - Linework
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A 2D viewport's projected linework: fetched, styled into bands and painted as SVG
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - EnsureLinework: the four classes for a definition, from the projection
//   pipeline's cache, else the baked R2 asset, else an on-device render,
//   with one promise per cache key. A forced render skips the caches and
//   the asset. The viewport's design phase (Model Source) keys the cache
//   and is the model projected; a phase still loading is waited for once.
// - StyleToken, StrokeRules and StyleBands: how the classes are inked. The
//   paper stroke rules per class, then each class broken into bands of one
//   resolved per-category style, heaviest last inside a class.
// - BandPaths, PathDataFor and PaintLinework: path data per band, built once
//   per result and style, written into the frame's linework SVG with a
//   viewBox spanning exactly the window in drawing millimetres.
//
// INTEGRATION:
// - Imports the Window unit (Window) and the Frame unit (the class order,
//   the linework caches and SizeLayer); neither imports this unit back.
// - Na__LayoutEditor__Viewport2d__ calls EnsureLinework, StyleToken and
//   PaintLinework from Fill and ForceRender, and re-exports EnsureLinework,
//   StrokeRules and StyleBands (the PDF exporter reads EnsureLinework and
//   StyleBands through it).
// - The SitePlan unit (TrueVision only) paints site plan lines through
//   StyleToken, StyleBands and BandPaths, so BandPaths is exported too.
// - Every other module imports Na__LayoutEditor__Viewport2d__.js, never
//   this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header and import paths; EnsureLinework's Model Source
//                   handling (the modelSource and waited arguments, the design
//                   phase fingerprint and model root, and the wait for a phase
//                   still loading) and console prefix; BandPaths is exported for
//                   the TrueVision-only SitePlan unit.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.2.0
// - StyleBands checks Na__LeModelLayers__IsOn per resolved owner key, not just
//   per class. A nested LineworkModifier owner (SSOT 76-79) is never a
//   top-level model category, so switching its Model Layers row off could
//   never reach it through the usual pre-sampling exclusion tokens - its
//   segments still got collected and still got painted. resolve() now caches
//   a hidden id as null and the band loop drops it before bucketing.
//
// 18-Sep-2026 - Version 1.1.0
// - ForgetPaths. A forced render cleared PathCache under the bare linework key,
//   but BandPaths files under key@hidden@styleToken, so nothing was ever
//   cleared: the projection ran again and PaintLinework painted the old path
//   strings it found under the unchanged key. Every entry built from the result
//   now goes.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Viewport2d__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Snapshots, Model Source, Edge Styles, Composites
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLineworkSetup, Na__LeCfg__PtToMm } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSnap__GetPipelineFingerprint, Na__LeSnap__GetModelRoot } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeSource__WaitFor } from './Na__LayoutEditor__ModelSource__.js';
    import {
        Na__LeEdge__Effective,
        Na__LeEdge__AppliesToClasses,
        Na__LeEdge__SolidMeansClassDefault,
        Na__LeEdge__Token
    } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
    import { Na__LeModelLayers__IsOn, Na__LeModelLayers__Token } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeComposite__Factor, Na__LeComposite__Token } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (definitions, pipeline, store, appearance)
    // ------------------------------------------------------------
    import { Na__PlCfg__GetAppearance } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ConfigAccess__.js';
    import {
        Na__PlView__Fingerprint,
        Na__PlView__CacheKey
    } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    import {
        Na__PlPipe__GetCached,
        Na__PlPipe__RenderDefinition,
        Na__PlPipe__Remember
    } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js';
    import { Na__PlStore__LoadForDefinition, Na__PlStore__RememberRender } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Persistence__.js';
    import { Na__PlOverlay__BuildPathData } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__SvgOverlay__.js';
    import { Na__PlOwners__Read, Na__PlOwners__KeyFor, Na__PlOwners__Has } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport 2D Units (Window, Frame)
    // ------------------------------------------------------------
    import { Na__LeVp2d__Window } from './Na__LayoutEditor__Viewport2d__Window__.js';
    import {
        Na__LeVp2d__CLASS_ORDER,
        Na__LeVp2d__Linework,
        Na__LeVp2d__PathCache,
        Na__LeVp2d__SizeLayer
    } from './Na__LayoutEditor__Viewport2d__Frame__.js';
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
        if (force === true) { Na__LeVp2d__Linework.delete(key); Na__LeVp2d__ForgetPaths(key); }
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
    //
    // MODEL LAYERS TOKEN INCLUDED for a normal category this is redundant - its
    // checkbox already changes the drawing's exclusion tokens, which changes the
    // projected classes and so the linework KEY, well upstream of this token. But
    // a nested LineworkModifier owner key (SSOT 76-79) is never a top-level model
    // category, so it never touches the exclusion tokens: StyleBands resolving it
    // as hidden is the ONLY thing that changes when its row is switched off, and
    // without its token here that resolve would still return the BandPaths cache's
    // stale, pre-toggle painting.
    // ------------------------------------------------------------
    function Na__LeVp2d__StyleToken(viewport) {
        return Na__LeEdge__Token(viewport) + '#' + Na__LeComposite__Token(viewport) + '#' + Na__LeModelLayers__Token(viewport);
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
    //
    // siteRules, OPTIONAL, is the site plan painter's { Order, Grey, Greyscale }:
    // a Map of category key to 1-10 line Z-index, the set of categories a
    // location plan strips the colour from, and the greyscale function. Given,
    // the Z-index decides the order inside a class and the weight only breaks a
    // tie; omitted - every architectural viewport, and the PDF's own path for
    // one - this function behaves exactly as it did before it existed.
    // ------------------------------------------------------------
    function Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden, siteRules) {
        const rules   = Na__LeVp2d__StrokeRules(viewport, masterPt);
        const site    = (siteRules && siteRules.Order instanceof Map) ? siteRules : null;   // <-- A site plan viewport: stack by Z-index, not by stroke width
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
            //
            // A CATEGORY-EXCLUSION TOKEN NEVER REACHES HERE - it only ever takes a
            // whole top-level model category out of the sampling before this runs,
            // and a nested LineworkModifier owner key (SSOT 76-79) is never a
            // top-level category, so its Model Layers checkbox would otherwise do
            // nothing. Checking IsOn per owner id, here, is what actually turns it
            // off - resolve() caches null for a hidden id (undefined still means
            // "not resolved yet"), and the loop below drops any index it returns.
            // ------------------------------------------------------------
            const byOwner = new Map();
            const resolve = (id) => {
                let style = byOwner.get(id);
                if (style !== undefined) return style;
                const ownerKey  = Na__PlOwners__KeyFor(tags.OwnerKeys, id);
                if (Na__LeModelLayers__IsOn(viewport, ownerKey) === false) {
                    byOwner.set(id, null);
                    return null;
                }
                const effective = Na__LeEdge__Effective(viewport, ownerKey);
                const dash = (effective.lineType === 'solid' && classDefaultDash) ? base.dashMm : effective.patternMm;
                // THE LOCATION PLAN'S GREYSCALE runs over the EFFECTIVE colour,
                // not the layer's default, so a colour the viewport has chosen by
                // hand is greyed too rather than quietly surviving the rule.
                const colour = (site && site.Grey && site.Grey.has(ownerKey) && typeof site.Greyscale === 'function')
                    ? site.Greyscale(effective.hex)
                    : effective.hex;
                // Z is part of the bucket key: two layers that happen to share a
                // colour and a weight must stay in SEPARATE bands when they sit
                // at different depths, or the stacking they were given is lost
                // the moment two of them agree on how they look.
                const z = site ? (site.Order.get(ownerKey) || 0) : 0;
                style = {
                    colour  : colour,
                    widthMm : base.widthMm * effective.weight,
                    dashMm  : dash,
                    z       : z,
                    key     : z + '|' + colour + '|' + (Math.round(base.widthMm * effective.weight * 10000) / 10000) + '|' + dash.join(',')
                };
                byOwner.set(id, style);
                return style;
            };

            const buckets = new Map();
            for (let i = 0; i < count; i++) {
                const style = resolve(owners[i]);
                if (!style) continue;                                             // <-- Switched off in the Model Layers panel (a LineworkModifier owner key)
                let list = buckets.get(style.key);
                if (!list) { list = { style : style, indices : [] }; buckets.set(style.key, list); }
                list.indices.push(i);
            }

            if (buckets.size === 0) return;                                       // <-- Everything in this class was switched off

            if (buckets.size === 1) {                                             // <-- Every category agrees: one path, as before
                const only = buckets.values().next().value;
                bands.push({ className : name, colour : only.style.colour, widthMm : only.style.widthMm, dashMm : only.style.dashMm, indices : null });
                return;
            }

            // HEAVIEST LAST INSIDE A CLASS. Two lines of different weight meeting
            // at a corner read better with the heavier one drawn over the lighter,
            // which is also how the class order itself is arranged.
            //
            // ON A SITE PLAN THE Z-INDEX COMES FIRST and weight only settles a
            // tie. Adam, TASK 03: '10 would be the index value assigned to the
            // red boundary line... Buildings would be around 5. Things like
            // minor streets would be 1.' A site plan's hierarchy is what the
            // layer MEANS, not how thick it happens to be drawn - a hairline
            // boundary still belongs over a heavy road - so where a rule exists
            // it overrules the weight rather than being blended with it.
            Array.from(buckets.values())
                .sort((a, b) => (site ? (a.style.z - b.style.z) : 0) || (a.style.widthMm - b.style.widthMm))
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


    // HELPER FUNCTION | Drop Every Painted Path Built From One Linework Result
    // ------------------------------------------------------------
    // WHY A FORCED RENDER CHANGED NOTHING. BandPaths files its path strings under
    // key@hidden@styleToken; the forced render cleared the bare key, which is
    // never an entry. So the projection ran again, produced the right classes,
    // and PaintLinework then found the OLD path strings under the same composite
    // key and painted those. Every re-render button re-projected faithfully and
    // drew the stale drawing. The entries for a result are the ones that start
    // with its key and the separator.
    // ------------------------------------------------------------
    function Na__LeVp2d__ForgetPaths(key) {
        const prefix = key + '@';
        Array.from(Na__LeVp2d__PathCache.keys()).forEach((entry) => {
            if (entry === key || entry.indexOf(prefix) === 0) Na__LeVp2d__PathCache.delete(entry);
        });
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
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D Linework Unit
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__EnsureLinework,
        Na__LeVp2d__StyleToken,
        Na__LeVp2d__StrokeRules,
        Na__LeVp2d__StyleBands,
        Na__LeVp2d__BandPaths,
        Na__LeVp2d__PaintLinework
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
