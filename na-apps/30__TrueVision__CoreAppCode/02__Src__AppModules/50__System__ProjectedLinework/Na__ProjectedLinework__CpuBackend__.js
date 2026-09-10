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
// INTEGRATION:
// - Na__ProjectedLinework__Projector__ calls PrepareIntersections and
//   ProjectView.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__CpuBackend__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
                IncludeHiddenEdges     : options.IncludeHiddenEdges === true
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
        collected.IntersectionEdges = await Na__PlEdges__ExtractIntersectionEdges(collected.Instances, slicer, collected.Report, limits);
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

        // EDGES | Hard and silhouette per instance, the cut lines placed, then
        // everything divided at the drawing cut.
        announce(Na__PlCpu__PHASE_EDGES);
        startedAt = performance.now();
        const stageEdges = Na__PlEdges__ExtractStageEdges(collected.Instances, up[0], up[1], up[2], options.AngleThresholdDegrees);
        const combined   = Na__PlCpu__Concat(stageEdges, collected.IntersectionEdges);
        const split      = Na__PlEdges__SplitByCut(combined, definition.Cut);
        const authored   = Na__PlEdges__SplitByCut(collected.AuthoredEdges, definition.Cut);
        const modelEdges = Na__PlEdges__ToViewSpace(split.Kept, viewMap, options.EdgeLiftWorldUnits);
        const drawnEdges = Na__PlEdges__ToViewSpace(authored.Kept, viewMap, options.EdgeLiftWorldUnits);
        mark(Na__PlCpu__PHASE_EDGES, startedAt);
        Na__PlCpu__CheckAbort(settings);

        // CLIPPING | Everything above exists to make these calls small.
        announce(Na__PlCpu__PHASE_CLIPPING);
        startedAt = performance.now();
        const modelResult = await Na__PlCpu__Clip(soup, modelEdges, options, settings);
        mark(Na__PlCpu__PHASE_CLIPPING, startedAt);
        Na__PlCpu__CheckAbort(settings);

        let authoredResult = { Segments : new Float32Array(0), HiddenSegments : null };
        if (drawnEdges.Count > 0) {
            announce(Na__PlCpu__PHASE_AUTHORED);
            startedAt = performance.now();
            authoredResult = await Na__PlCpu__Clip(soup, drawnEdges, options, settings);
            mark(Na__PlCpu__PHASE_AUTHORED, startedAt);
            Na__PlCpu__CheckAbort(settings);
        }

        // HIDDEN | What the occluders covered, plus what lies between the
        // viewer and the cut. Only assembled when the drawing asked for it.
        let hidden = new Float32Array(0);
        if (options.IncludeHiddenEdges) {
            hidden = Na__PlCpu__ConcatSegments(modelResult.HiddenSegments, authoredResult.HiddenSegments);
            hidden = Na__PlCpu__ConcatSegments(hidden, Na__PlEdges__ToDrawingSegments(split.Removed,    viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm));
            hidden = Na__PlCpu__ConcatSegments(hidden, Na__PlEdges__ToDrawingSegments(authored.Removed, viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm));
        }

        // SECTION | The outline of cut material, straight to the page; the
        // light crossings (glass) join the visible class as thin lines.
        const section = Na__PlEdges__ToDrawingSegments(sampled.SectionEdges,      viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm);
        const light   = Na__PlEdges__ToDrawingSegments(sampled.SectionEdgesLight, viewMap, options.ScaleDivisor, options.MinimumSegmentLengthMm);

        return {
            Classes : {
                visible  : Na__PlCpu__ConcatSegments(modelResult.Segments, light),
                hidden   : hidden,
                authored : authoredResult.Segments,
                section  : section
            },
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
