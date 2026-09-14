// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - CPU BACKEND
// =============================================================================
//
// FILE       : Na__ProjectedLinework__CpuBackend__.js
// NAMESPACE  : Na__PlCpu
// MODULE     : Projected Linework - CPU Backend
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drive the whole projection through the module's own kernel
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The default backend, available everywhere, and the one that produces the
//   linework the drawing is judged against. Nothing here does geometry: it
//   decides the ORDER of the work, what is kept between drawings, and what is
//   handed to the workers.
//
// - PER MODEL STATE, once, cached with the collection:
//     the instance list and the authored edges
//     every geometry's hard and candidate silhouette edges (weak cache)
//     the lines where two solids cut through one another
//   PER DRAWING:
//     cutting and flattening the triangles, turning them to face the view,
//     culling back faces, building the tree, splitting the edges at the cut,
//     deciding which silhouettes the view breaks, clipping.
//
// - FOUR CLASSES COME OUT (D18, D21):
//     visible    model edges on the kept side, the parts nothing hides
//     hidden     with Hidden Lines on: the parts something hides, plus every
//                edge between the viewer and the cut (above a plan's datum,
//                in front of a section plane), dashed
//     authored   the SketchUp linework, occlusion-clipped like the rest
//     section    the outline of cut material, never occluded because the
//                cut is by definition the nearest thing to the viewer
//
// - THREE RULES MATCH THE LIVE 3D VIEW, and the Dev menu's Run Diff runs with
//   all of them off, because the vendored backends it compares against apply
//   none of them:
//
//   HIDE FLUSH JOINS (options.HideFlushJoins, on unless the config says false).
//   Before clipping, Na__ProjectedLinework__FlushJoins__ cuts out of the model
//   edges every span where faces of one plane lie along the edge on both
//   sides - a wall band flush on the wall below, a pier between windows - which
//   the 3D view shows as one unbroken surface. Outlines and real creases keep
//   their lines; the authored linework never passes through it.
//
//   SEAMS OCCLUDE (options.SeamsOcclude, on unless the config says false) is
//   handed to the clip kernel: where two occluders meet exactly along an
//   edge's line, the seam hides what lies behind it, as the depth buffer does
//   in 3D.
//
//   LINEWORK FIRST (options.LineworkFirst, off unless the config turns it on).
//   A category that ships SketchUp linework gives the visible class its
//   silhouettes only, and is never intersection-tested beside another such
//   category; its creases reach the drawing through the authored class alone.
//   A strict mode, not the default: SketchUp's hidden flags cannot tell a join
//   from an outline, so it also loses outlines the modeller hid - the ground
//   box's top edge, which is the ground line of every elevation. Much faster
//   on a large model.
//
// INTEGRATION:
// - Na__ProjectedLinework__Projector__ calls PrepareIntersections and
//   ProjectView.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__CpuBackend__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim, bar 1.3.0
// - Divergences   : Console prefix, header and folder numbers; the three
//                   3D-matching rules (1.3.0), authored here first.
// - Back-port     : 1.3.0 PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.3.0
// - Linework first: ProjectView and PrepareIntersections hand the collection's
//   linework category Set to the edge extractor while options.LineworkFirst
//   is on. Seams occlude: every clip call carries options.SeamsOcclude to the
//   kernel. Hide flush joins: each view's model edges pass through
//   Na__PlFlush__CutFlushJoins before clipping while options.HideFlushJoins is
//   on. (1.2.0, the owner tags of 12-Sep-2026, was never logged here.)
//
// 10-Sep-2026 - Version 1.1.0
// - Intersection budget passed through to the edge extractor.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Soup, Edges and the Worker Pool
    // ------------------------------------------------------------
    import {
        Na__PlSoup__ViewMapFromBasis,
        Na__PlSoup__BuildViewSoup
    } from './Na__ProjectedLinework__SoupBuilder__.js';
    import {
        Na__PlEdges__ExtractStageEdges,
        Na__PlEdges__ExtractIntersectionEdges,
        Na__PlEdges__SplitByCut,
        Na__PlEdges__ToViewSpace,
        Na__PlEdges__ToDrawingSegments
    } from './Na__ProjectedLinework__EdgeExtractor__.js';
    import { Na__ProjectedLinework__WorkerPool__Run } from './Na__ProjectedLinework__WorkerPool__.js';
    import { Na__PlFlush__CutFlushJoins } from './Na__ProjectedLinework__FlushJoins__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Segment Owner Tags
    // ------------------------------------------------------------
    import {
        Na__PlOwners__Concat,
        Na__PlOwners__Blank,
        Na__PlOwners__Attach
    } from './Na__ProjectedLinework__Owners__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Phase Labels
    // ------------------------------------------------------------
    const Na__PlCpu__PHASE_INTERSECTING = 'Finding solid intersections';
    const Na__PlCpu__PHASE_OCCLUDERS    = 'Sorting occluders';
    const Na__PlCpu__PHASE_EDGES        = 'Finding edges';
    const Na__PlCpu__PHASE_CLIPPING     = 'Clipping edges';
    const Na__PlCpu__PHASE_AUTHORED     = 'Clipping authored linework';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Join Two Scene Space Edge Buffers
    // ------------------------------------------------------------
    function Na__PlCpu__Concat(first, second) {
        if (!second || second.length === 0) return first || new Float64Array(0);
        if (!first  || first.length  === 0) return second;
        const joined = new Float64Array(first.length + second.length);
        joined.set(first, 0);
        joined.set(second, first.length);
        return joined;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Join Two Drawing Segment Buffers
    // ------------------------------------------------------------
    function Na__PlCpu__ConcatSegments(first, second) {
        if (!second || second.length === 0) return first || new Float32Array(0);
        if (!first  || first.length  === 0) return second;
        const joined = new Float32Array(first.length + second.length);
        joined.set(first, 0);
        joined.set(second, first.length);
        return joined;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Append Segments and Their Owner Tags Together
    // ------------------------------------------------------------
    // target is { Segments, Owners } and is mutated. Owners null means this
    // render is not tagging at all, in which case only the coordinates move.
    //
    // THE TAG LENGTH IS DERIVED FROM THE SEGMENTS, never trusted. A half that
    // arrives with no tags (an empty clip, a backend that does not tag) is
    // padded with the unknown owner to exactly its own segment count, so the
    // two buffers cannot drift apart no matter which half was missing.
    // ------------------------------------------------------------
    function Na__PlCpu__Append(target, segments, owners) {
        const add = segments || new Float32Array(0);
        target.Segments = Na__PlCpu__ConcatSegments(target.Segments, add);
        if (target.Owners !== null) {
            const count = Math.floor(add.length / 4);
            const tags  = (owners && owners.length === count) ? owners : Na__PlOwners__Blank(count);
            target.Owners = Na__PlOwners__Concat(target.Owners, tags);
        }
        return target;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Throw If the Render Has Been Abandoned
    // ------------------------------------------------------------
    function Na__PlCpu__CheckAbort(settings) {
        if (settings.AbortSignal && settings.AbortSignal.aborted) {
            throw new DOMException('Projection aborted', 'AbortError');
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clip One Edge Buffer Through the Pool
    // ------------------------------------------------------------
    async function Na__PlCpu__Clip(soup, edges, options, settings) {
        return Na__ProjectedLinework__WorkerPool__Run(
            soup,
            edges,
            {
                ScaleDivisor           : options.ScaleDivisor,
                MinimumSegmentLengthMm : options.MinimumSegmentLengthMm,
                IncludeHiddenEdges     : options.IncludeHiddenEdges === true,
                SeamsOcclude           : options.SeamsOcclude === true           // <-- Posted to every worker whole, with the rest of these options
            },
            {
                MaxWorkers             : options.MaxWorkers,
                MinimumEdgesForWorkers : options.MinimumEdgesForWorkers,
                YieldEveryMs           : options.YieldEveryMs,
                AbortSignal            : settings.AbortSignal
            }
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per Model State Preparation
// -----------------------------------------------------------------------------

    // FUNCTION | Find the Cut Lines Between Solids, Once per Collection
    // ------------------------------------------------------------
    async function Na__PlCpu__PrepareIntersections(collected, slicer, options) {
        if (collected.HasIntersections) return collected;

        const startedAt = performance.now();
        const limits    = { MaxPairs : options ? options.IntersectionMaxPairs : 0, SelfMaxTriangles : options ? options.IntersectionSelfMaxTriangles : 0 };
        // THE COLLECTION'S OWN OWNER TABLE, not a fresh one. This pass is cached
        // per collection and the stage pass runs per view, so if the two built
        // their own tables the ids in the cached intersection buffer would mean
        // different categories from the ids in this view's stage buffer.
        // LINEWORK FIRST. This pass is cached on the collection, and the pipeline
        // keys collections on the rule, so one never holds the other rule's lines.
        const linework = (options && options.LineworkFirst === true) ? (collected.LineworkCategories || null) : null;
        const found = await Na__PlEdges__ExtractIntersectionEdges(collected.Instances, slicer, collected.Report, limits, collected.OwnerTable || null, linework);
        collected.IntersectionEdges  = found.Edges;
        collected.IntersectionOwners = found.Owners;
        collected.Report.IntersectionMs    = Math.round(performance.now() - startedAt);
        collected.Report.IntersectionCount = Math.floor(collected.IntersectionEdges.length / 6);
        collected.HasIntersections         = true;
        return collected;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Per Drawing Projection
// -----------------------------------------------------------------------------

    // FUNCTION | Project One Drawing From the Collected and Sampled Model
    // ------------------------------------------------------------
    // run carries { AbortSignal, OnPhase }. Returns the four classes in
    // drawing millimetres plus the phase timings.
    // ------------------------------------------------------------
    async function Na__PlCpu__ProjectView(collected, sampled, definition, options, run) {
        const settings = run || {};
        const phases   = [];
        const mark     = (name, startedAt) => phases.push({ Phase : name, Ms : Math.round(performance.now() - startedAt) });
        const announce = (name) => { if (typeof settings.OnPhase === 'function') settings.OnPhase(name); };
        const viewMap  = Na__PlSoup__ViewMapFromBasis(definition.Basis);
        const up       = definition.UpScene;

        // OCCLUDERS | Cut, turned, culled, treed.
        announce(Na__PlCpu__PHASE_OCCLUDERS);
        let startedAt = performance.now();
        const soup = Na__PlSoup__BuildViewSoup(sampled, viewMap, { MaxLeafSize : options.BvhMaxLeafSize });
        mark(Na__PlCpu__PHASE_OCCLUDERS, startedAt);
        Na__PlCpu__CheckAbort(settings);

        // OWNER TAGS | On when the collection carries a table, which the
        // projector builds from the instance list. Absent is a working render
        // with class colours only, which is what every other backend produces.
        const ownerTable = collected.OwnerTable || null;
        const tagging    = ownerTable !== null;
        const blank      = () => (tagging ? Na__PlOwners__Blank(0) : null);
        const tagsFor    = (edgeBuffer, existing) => {
            if (!tagging) return null;
            if (existing) return existing;
            return Na__PlOwners__Blank(Math.floor((edgeBuffer ? edgeBuffer.length : 0) / 6));
        };

        // EDGES | Hard and silhouette per instance, the cut lines placed, then
        // everything divided at the drawing cut. Under linework first a category
        // that ships SketchUp linework gives its silhouettes and nothing else.
        announce(Na__PlCpu__PHASE_EDGES);
        startedAt = performance.now();
        const linework   = options.LineworkFirst === true ? (collected.LineworkCategories || null) : null;
        const stage      = Na__PlEdges__ExtractStageEdges(collected.Instances, up[0], up[1], up[2], options.AngleThresholdDegrees, ownerTable, linework);
        const combined   = Na__PlCpu__Concat(stage.Edges, collected.IntersectionEdges);
        // The intersection buffer is cached per collection and can be empty
        // because the pass was skipped on a house-scale model, so its tag count
        // is taken from its own edge count rather than assumed to exist.
        const combinedOwners = tagging
            ? Na__PlOwners__Concat(stage.Owners, tagsFor(collected.IntersectionEdges, collected.IntersectionOwners))
            : null;
        const split      = Na__PlEdges__SplitByCut(combined, definition.Cut, combinedOwners);
        const authored   = Na__PlEdges__SplitByCut(collected.AuthoredEdges, definition.Cut, tagsFor(collected.AuthoredEdges, collected.AuthoredOwners));
        const viewEdges  = Na__PlEdges__ToViewSpace(split.Kept, viewMap, options.EdgeLiftWorldUnits, split.KeptOwners);
        // HIDE FLUSH JOINS. Joins between two faces of one plane leave the model's
        // own edges here, before the clip; the authored linework never passes through.
        const modelEdges = options.HideFlushJoins === true ? Na__PlFlush__CutFlushJoins(soup, viewEdges) : viewEdges;
        const drawnEdges = Na__PlEdges__ToViewSpace(authored.Kept, viewMap, options.EdgeLiftWorldUnits, authored.KeptOwners);
        mark(Na__PlCpu__PHASE_EDGES, startedAt);
        Na__PlCpu__CheckAbort(settings);

        // CLIPPING | Everything above exists to make these calls small.
        announce(Na__PlCpu__PHASE_CLIPPING);
        startedAt = performance.now();
        const modelResult = await Na__PlCpu__Clip(soup, modelEdges, options, settings);
        mark(Na__PlCpu__PHASE_CLIPPING, startedAt);
        Na__PlCpu__CheckAbort(settings);

        let authoredResult = { Segments : new Float32Array(0), HiddenSegments : null, Owners : null, HiddenOwners : null };
        if (drawnEdges.Count > 0) {
            announce(Na__PlCpu__PHASE_AUTHORED);
            startedAt = performance.now();
            authoredResult = await Na__PlCpu__Clip(soup, drawnEdges, options, settings);
            mark(Na__PlCpu__PHASE_AUTHORED, startedAt);
            Na__PlCpu__CheckAbort(settings);
        }

        // HIDDEN | What the occluders covered, plus what lies between the
        // viewer and the cut. Only assembled when the drawing asked for it.
        const hidden = { Segments : new Float32Array(0), Owners : blank() };
        if (options.IncludeHiddenEdges) {
            Na__PlCpu__Append(hidden, modelResult.HiddenSegments,    modelResult.HiddenOwners);
            Na__PlCpu__Append(hidden, authoredResult.HiddenSegments, authoredResult.HiddenOwners);
            const aboveCut      = Na__PlEdges__ToDrawingSegments(split.Removed,    viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm, split.RemovedOwners);
            const aboveCutDrawn = Na__PlEdges__ToDrawingSegments(authored.Removed, viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm, authored.RemovedOwners);
            Na__PlCpu__Append(hidden, aboveCut.Segments,      aboveCut.Owners);
            Na__PlCpu__Append(hidden, aboveCutDrawn.Segments, aboveCutDrawn.Owners);
        }

        // SECTION | The outline of cut material, straight to the page; the
        // light crossings (glass) join the visible class as thin lines.
        const section = Na__PlEdges__ToDrawingSegments(sampled.SectionEdges,      viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm, tagging ? sampled.SectionOwners      : null);
        const light   = Na__PlEdges__ToDrawingSegments(sampled.SectionEdgesLight, viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm, tagging ? sampled.SectionOwnersLight : null);

        const visible  = Na__PlCpu__Append({ Segments : new Float32Array(0), Owners : blank() }, modelResult.Segments, modelResult.Owners);
        Na__PlCpu__Append(visible, light.Segments, light.Owners);
        const drawn    = Na__PlCpu__Append({ Segments : new Float32Array(0), Owners : blank() }, authoredResult.Segments, authoredResult.Owners);
        const cutLines = Na__PlCpu__Append({ Segments : new Float32Array(0), Owners : blank() }, section.Segments, section.Owners);

        const classes = {
            visible  : visible.Segments,
            hidden   : hidden.Segments,
            authored : drawn.Segments,
            section  : cutLines.Segments
        };

        // ATTACH, DO NOT MERGE. The tags are hidden on the classes object as
        // non-enumerable properties, so every existing consumer - the class
        // loops, the segment count, the serialiser - sees exactly the four
        // arrays it saw before. Attach refuses a mismatched buffer and says so,
        // in which case the drawing paints per class and is still correct.
        if (tagging) {
            Na__PlOwners__Attach(classes, {
                visible  : visible.Owners,
                hidden   : hidden.Owners,
                authored : drawn.Owners,
                section  : cutLines.Owners
            }, ownerTable.Keys);
        }

        return {
            Classes       : classes,
            Phases        : phases,
            EdgeCount     : modelEdges.Count + drawnEdges.Count,
            OccluderCount : soup.TriCount,
            StagedCount   : soup.SourceCount
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework CPU Backend API
    // ------------------------------------------------------------
    export {
        Na__PlCpu__PHASE_INTERSECTING,
        Na__PlCpu__PrepareIntersections,
        Na__PlCpu__ProjectView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
