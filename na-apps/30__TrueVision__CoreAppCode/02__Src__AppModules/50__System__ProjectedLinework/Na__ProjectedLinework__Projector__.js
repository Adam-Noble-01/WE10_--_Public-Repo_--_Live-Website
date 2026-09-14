// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - PROJECTOR
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Projector__.js
// NAMESPACE  : Na__PlProjector
// MODULE     : Projected Linework - Projector
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own how a drawing faces the model, and pick who does the work
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The one entry point for turning a drawing definition into linework. It
//   gathers the settings a render runs under, reads the model into the
//   per-state and per-drawing preparations, and routes the projection to a
//   backend.
//
// - THREE BACKENDS, ONE ANSWER
//     cpu       This module's own kernel, spread across a pool of workers.
//               The default, available everywhere, the only one that honours
//               the drawing cut and the line classes, and the only one that
//               reuses work between drawings.
//     webgpu    The compute shader implementation inside the vendored library.
//               Opt-in; falls back to cpu where WebGPU is missing. Plain
//               visible linework of the uncut model.
//     legacy    The vendored CPU generator, unchanged, kept so the Diff
//               harness always has something known-good to compare against.
//
// - THE ORIENTATION comes from the view definition: a basis whose columns are
//   the images of the three scene axes. A right-angled view is a signed
//   permutation and takes the exact path; a free bearing takes the rotation
//   path (D40). The read-back is always sx = px / s, sy = pz / s.
//
// INTEGRATION:
// - Na__ProjectedLinework__Pipeline__ drives it for the drawing on screen;
//   Na__ProjectedLinework__Persistence__ for every drawing at bake time.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__Projector__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim, bar 1.2.0 and 1.3.0
// - Divergences   : Console prefix, header and folder numbers; the 3D-matching
//                   rules (1.2.0) and the door pose read (1.3.0), authored here first.
// - Back-port     : 1.2.0 and 1.3.0 PENDING to ValeVision3D, on Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.3.0
// - Door pose. Collect reads a definition that carries DoorPose (a Layout
//   Editor plan) with the model's doors stood at that pose: open, bar the ones
//   the viewport closed. The doors are posed, the model is read and they are
//   put back in one synchronous run, so no frame and no other reader ever sees
//   them moved. The sampler copies the posed matrices, the authored walk bakes
//   its points, and the collection keeps the swing arcs traced meanwhile
//   (DoorSwings) for the pipeline to place on each drawing.
//
// 14-Sep-2026 - Version 1.2.0
// - Linework first, seams occlude and hide flush joins. BuildOptions carries
//   LineworkFirst, SeamsOcclude and HideFlushJoins from the projection config
//   and forces all three off for an explicit backend override (Run Diff),
//   because the vendored backends apply none of them and cannot be told to. Collect keeps the authored walk's linework category Set on the
//   collection, and primes bounds trees only for the instances the
//   intersection pass can still test.
//
// 13-Sep-2026 - Version 1.1.0
// - Every render the pipeline keeps resolves to the CPU backend, the only one
//   that tags each line with its model category. An explicit backend override
//   (the Dev menu Run Diff, which keeps nothing) still gets the speed rules.
//   auto used to send plain elevations to the GPU on a capable machine, and on
//   exactly that machine the Layout Editor's per-category edge styles did nothing.
// - The collection carries an OwnerTable built from its instance list, shared by
//   the per-view stage pass and the cached intersection pass.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js and the Vendored Generator
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { ProjectionGenerator } from 'three-edge-projection';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Config, Scheduler, Stage, Sampler and Backends
    // ------------------------------------------------------------
    import {
        Na__PlCfg__GetProjectionSetup,
        Na__PlCfg__GetPerformanceSetup
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    import { Na__ProjectedLinework__Scheduler__DriveGenerator } from './Na__ProjectedLinework__Scheduler__.js';
    import {
        Na__PlStage__PrimeBoundsTrees,
        Na__PlStage__BuildStageGroup
    } from './Na__ProjectedLinework__ModelStage__.js';
    import {
        Na__PlSampler__BuildOwnerTable,
        Na__PlSampler__Collect,
        Na__PlSampler__Sample,
        Na__PlSampler__CountTriangles
    } from './Na__ProjectedLinework__StageSampler__.js';
    import { Na__PlAuthored__Collect } from './Na__ProjectedLinework__AuthoredEdges__.js';
    import { Na__PlDoors__Apply, Na__PlDoors__Restore, Na__PlDoors__SwingEdges } from './Na__ProjectedLinework__DoorPose__.js';
    import {
        Na__PlCpu__PrepareIntersections,
        Na__PlCpu__ProjectView
    } from './Na__ProjectedLinework__CpuBackend__.js';
    import {
        Na__ProjectedLinework__WebGpuBackend__IsAvailable,
        Na__ProjectedLinework__WebGpuBackend__IsHardwareCapable,
        Na__ProjectedLinework__WebGpuBackend__GetProbe,
        Na__ProjectedLinework__WebGpuBackend__ProjectView
    } from './Na__ProjectedLinework__WebGpuBackend__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Backend Names and Units
    // ------------------------------------------------------------
    const Na__PlProjector__BACKEND_AUTO   = 'auto';
    const Na__PlProjector__BACKEND_CPU    = 'cpu';
    const Na__PlProjector__BACKEND_WEBGPU = 'webgpu';
    const Na__PlProjector__BACKEND_LEGACY = 'legacy';
    const Na__PlProjector__SCALE_DIVISOR  = 0.001;      // <-- Scene units are metres; drawings are millimetres
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Phase Names
    // ------------------------------------------------------------
    const Na__PlProjector__PHASE_COLLECTING   = 'Reading the model';
    const Na__PlProjector__PHASE_SAMPLING     = 'Cutting the model';
    const Na__PlProjector__PHASE_INTERSECTING = 'Finding solid intersections';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Options
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Once Why a Kept Render Is on the CPU
    // ------------------------------------------------------------
    // Once per session and only when it could surprise someone: a backend other
    // than cpu was configured, or a GPU is present that auto used to pick.
    // ------------------------------------------------------------
    let Na__PlProjector__TaggedCpuNoted = false;
    function Na__PlProjector__NoteTaggedCpu(requested) {
        if (Na__PlProjector__TaggedCpuNoted) return;
        Na__PlProjector__TaggedCpuNoted = true;
        console.info('[TrueVision3D ProjectedLinework] Kept linework renders on the CPU backend (configured: ' + requested + '). '
            + 'Only the CPU backend tags each line with its model category, which the Layout Editor edge styles need. '
            + 'WebGPU and legacy remain available to the Dev menu Run Diff.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Settle Which Backend Will Actually Run
    // ------------------------------------------------------------
    // THE ONE RULE THAT OUTRANKS SPEED: a view with a drawing cut must go to the
    // CPU backend, whatever was asked for.
    //
    // The GPU backend has no cut handling at all - it never calls SplitByCut and
    // never sees definition.Cut. Give it a floor plan and it happily projects the
    // whole building, roof included, instead of the storey below the cut. The
    // drawing that comes back is not slightly wrong, it is a different drawing,
    // and nothing on the sheet says so. Every floor plan carries a cut by
    // definition, and so does a section-mode elevation; a plain elevation does
    // not, which is where the GPU path is both correct and worth having.
    //
    // 'legacy' is exempt from the rule because it is a diagnostic that exists to
    // give the Diff harness something known-good to compare against, and it is
    // only ever selected by hand.
    //
    // definition may be absent (a warm-up or a probe render), in which case there
    // is no cut to protect and the hardware alone decides.
    //
    // AND A SECOND RULE THAT OUTRANKS SPEED, ADDED 13-Sep-2026: every render the
    // pipeline KEEPS goes to the CPU backend, because only the CPU backend tags each
    // line with the model category it came from. Kept means the on-screen drawing,
    // every Layout Editor viewport, the browser cache and the R2 bake - and those
    // share one cache, so a single untagged result poisons all of them.
    //
    // Until this rule, 'auto' sent plain elevations to the GPU on any machine with
    // a hardware adapter. The vendored GPU generator returns one merged buffer with
    // no provenance, so on exactly the workstation the drawings are made on, every
    // per-category edge style in the Layout Editor silently did nothing - walls
    // stayed the class colour whatever the panel said. A drawing that ignores its
    // styles is as wrong as a floor plan that ignores its cut.
    //
    // diagnostic is true only when a caller names a backend explicitly for a render
    // it will NOT keep - the Dev menu's Run Diff. Only then do the old speed rules
    // apply, so the card can still be measured against the CPU.
    function Na__PlProjector__ResolveBackend(requested, definition, diagnostic) {
        if (diagnostic !== true) {
            if (requested !== Na__PlProjector__BACKEND_CPU || Na__ProjectedLinework__WebGpuBackend__IsHardwareCapable()) Na__PlProjector__NoteTaggedCpu(requested);
            return Na__PlProjector__BACKEND_CPU;
        }

        if (requested === Na__PlProjector__BACKEND_LEGACY) return Na__PlProjector__BACKEND_LEGACY;

        const hasCut  = !!(definition && definition.Cut);
        const capable = Na__ProjectedLinework__WebGpuBackend__IsHardwareCapable();

        // AUTO | The default. Fastest backend that is CORRECT for this view.
        if (requested === Na__PlProjector__BACKEND_AUTO) {
            if (hasCut)  return Na__PlProjector__BACKEND_CPU;
            if (capable) return Na__PlProjector__BACKEND_WEBGPU;
            return Na__PlProjector__BACKEND_CPU;
        }

        // EXPLICIT WEBGPU | Honoured on the views it can actually draw.
        if (requested === Na__PlProjector__BACKEND_WEBGPU) {
            if (hasCut) {
                console.info('[TrueVision3D ProjectedLinework] WebGPU was asked for, but this view has a drawing cut '
                    + 'and the GPU backend cannot apply one. Using the CPU backend so the drawing is right.');
                return Na__PlProjector__BACKEND_CPU;
            }
            if (capable) return Na__PlProjector__BACKEND_WEBGPU;

            const probe = Na__ProjectedLinework__WebGpuBackend__GetProbe();
            console.info('[TrueVision3D ProjectedLinework] WebGPU was asked for but is not usable here ('
                + (probe ? probe.Reason : 'the hardware probe has not finished yet') + '); using the CPU backend.');
            return Na__PlProjector__BACKEND_CPU;
        }

        return Na__PlProjector__BACKEND_CPU;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read Every Setting a Render Needs, Once
    // ------------------------------------------------------------
    // Gathered so one render cannot half-apply a setting changed partway
    // through, and so the whole of what governed a projection can be logged
    // as one object. definition supplies the per-drawing flags.
    //
    // THE 3D-MATCHING RULES ARE OFF FOR AN EXPLICIT OVERRIDE - linework first,
    // seams occlude and hide flush joins. Only the Diff names a backend, to
    // hold the CPU against a vendored generator, and those extract every crease
    // from the mesh themselves, leave every seam open and keep every join. Both
    // sides of a Diff therefore do the same, and the Diff still compares one
    // engine with another rather than one rule with another. Every kept render
    // follows the config.
    // ------------------------------------------------------------
    function Na__PlProjector__BuildOptions(definition, backendOverride) {
        const projection  = Na__PlCfg__GetProjectionSetup();
        const performance = Na__PlCfg__GetPerformanceSetup();
        const requested   = backendOverride || performance.backend || Na__PlProjector__BACKEND_AUTO;
        const backend     = Na__PlProjector__ResolveBackend(requested, definition, !!backendOverride);   // <-- An explicit override is the Diff harness: a render nothing keeps

        return {
            Backend                  : backend,
            RequestedBackend         : requested,
            AngleThresholdDegrees    : projection.angleThresholdDegrees,
            LineworkFirst            : !backendOverride && projection.lineworkFirst === true,
            SeamsOcclude             : !backendOverride && projection.seamsOcclude === true,
            HideFlushJoins           : !backendOverride && projection.hideFlushJoins === true,
            IncludeIntersectionEdges : projection.includeIntersectionEdges,
            IterationTimeMs          : projection.iterationTimeMs,
            MinimumSegmentLengthMm   : projection.minimumSegmentLengthMm,
            EdgeLiftWorldUnits       : projection.edgeLiftWorldUnits,
            ScaleDivisor             : Na__PlProjector__SCALE_DIVISOR,
            BvhMaxLeafSize           : performance.clipBvhMaxLeafSize,
            MaxWorkers               : performance.maxWorkers,
            MinimumEdgesForWorkers   : performance.minimumEdgesForWorkers,
            YieldEveryMs             : performance.yieldEveryMs,
            MaxTriangles             : performance.maxTriangles,
            IncludeHiddenEdges       : !!(definition && definition.Styles && definition.Styles.hiddenLines),
            IntersectionMaxInstances : projection.intersectionMaxInstances,
            IntersectionMaxPairs     : projection.intersectionMaxPairs,
            IntersectionSelfMaxTriangles : projection.intersectionSelfMaxTriangles,
            NeedsIntersectionEdges   : backend === Na__PlProjector__BACKEND_CPU && projection.includeIntersectionEdges
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Preparation
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Model for One Exclusion and Occluder Rule
    // ------------------------------------------------------------
    // Cached by the pipeline per model state and collection key. Everything
    // here is independent of the cut: the instance list, the authored edges,
    // the primed bounds trees, and (lazily) the intersection lines.
    // ------------------------------------------------------------
    async function Na__PlProjector__Collect(modelRoot, definition, options, onPhase) {
        if (typeof onPhase === 'function') onPhase(Na__PlProjector__PHASE_COLLECTING);
        const startedAt = performance.now();

        // DOORS STAND WHERE THE DRAWING WANTS THEM, for this read only. A Layout
        // Editor plan carries a door pose: every door open bar the ones its
        // viewport closed. Posed, read and put back in one synchronous run, so no
        // frame and no other reader ever sees a door the 3D view did not move.
        const doorPose = definition.DoorPose || null;
        const posed    = doorPose ? Na__PlDoors__Apply(modelRoot, doorPose) : null;
        let   collected;
        try {
            collected = Na__PlSampler__Collect(modelRoot, {
                excludeTokens : definition.ExcludeTokens,
                glassOpaque   : definition.Styles.glassOpaque,
                posedMods     : posed ? posed.Mods : null
            });
            collected.TriangleTotal     = Na__PlSampler__CountTriangles(collected);
            // THE OWNER TABLE IS A PROPERTY OF THE COLLECTION, settled here before
            // anything reads an edge. Built from the instance list in order, so the
            // per-view stage pass and the per-collection intersection pass agree
            // about which id means which category. The authored walk extends it with
            // any linework-only category that carried no mesh instance of its own.
            collected.OwnerTable        = Na__PlSampler__BuildOwnerTable(collected);
            const authoredCollected     = Na__PlAuthored__Collect(modelRoot, { excludeTokens : definition.ExcludeTokens, ownerTable : collected.OwnerTable });
            collected.AuthoredEdges     = authoredCollected.Edges;
            collected.AuthoredOwners    = authoredCollected.Owners;
            collected.LineworkCategories = authoredCollected.Categories;         // <-- Whose creases the authored class draws under linework first
            collected.DoorSwings        = posed ? Na__PlDoors__SwingEdges(posed, doorPose, collected.PosedModsDrawn, modelRoot) : null;
        } finally {
            Na__PlDoors__Restore(posed);                                         // <-- Back where the 3D view holds them, whatever the read did
        }
        collected.IntersectionEdges = new Float64Array(0);
        collected.IntersectionOwners = new Uint16Array(0);
        collected.HasIntersections  = false;
        collected.Report            = { CollectMs : 0, BvhCount : 0, BvhMs : 0, IntersectionMs : 0, IntersectionCount : 0, PairsTested : 0, PairsSkipped : 0, SelfReused : 0 };

        if (options.NeedsIntersectionEdges && collected.Instances.length <= options.IntersectionMaxInstances) {   // <-- Trees only for a pass that will run
            // Under linework first an instance of a linework category is only ever
            // tested against one that is not, so only those are primed here; the
            // pass builds any other tree the first time a test reaches it.
            const testable = options.LineworkFirst === true
                ? collected.Instances.filter((instance) => !collected.LineworkCategories.has(instance.categoryName))
                : collected.Instances;
            const primedAt = performance.now();
            collected.Report.BvhCount = await Na__PlStage__PrimeBoundsTrees(testable, options.YieldEveryMs);
            collected.Report.BvhMs    = Math.round(performance.now() - primedAt);
        }

        collected.Report.CollectMs = Math.round(performance.now() - startedAt);
        return collected;
    }
    // ------------------------------------------------------------


    // FUNCTION | Cut and Flatten the Collected Model for One Drawing
    // ------------------------------------------------------------
    function Na__PlProjector__Sample(collected, definition, onPhase) {
        if (typeof onPhase === 'function') onPhase(Na__PlProjector__PHASE_SAMPLING);
        const startedAt = performance.now();
        const sampled   = Na__PlSampler__Sample(collected, definition.Cut);
        sampled.SampleMs = Math.round(performance.now() - startedAt);
        return sampled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add the Cut Lines Between Solids to a Collection
    // ------------------------------------------------------------
    // The expensive half; only when the exact linework is wanted and only
    // for the CPU backend.
    // ------------------------------------------------------------
    async function Na__PlProjector__PrepareIntersections(collected, options, slicer, onPhase) {
        if (!options.NeedsIntersectionEdges || collected.HasIntersections) return collected;
        if (collected.Instances.length > options.IntersectionMaxInstances) {
            // A house-scale model: the pairwise search would run for minutes.
            // The junction lines come from the authored linework instead.
            console.info('[TrueVision3D ProjectedLinework] Intersection edges skipped: ' + collected.Instances.length +
                         ' instances, over the ' + options.IntersectionMaxInstances + ' ceiling (ProjectedLinework__Projection__IntersectionMaxInstances).');
            collected.Report.IntersectionSkipped = 'instances';
            collected.HasIntersections = true;
            return collected;
        }
        if (typeof onPhase === 'function') onPhase(Na__PlProjector__PHASE_INTERSECTING);
        return Na__PlCpu__PrepareIntersections(collected, slicer, options);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Projection
// -----------------------------------------------------------------------------

    // FUNCTION | Project One Drawing Through the Chosen Backend
    // ------------------------------------------------------------
    // run carries { AbortSignal, OnPhase }. Returns
    //   { Classes : { visible, hidden, authored, section }, Phases, ... }
    // with every class a Float32Array of drawing millimetres, whichever
    // backend produced it.
    // ------------------------------------------------------------
    async function Na__PlProjector__Project(collected, sampled, definition, options, run) {
        if (options.Backend === Na__PlProjector__BACKEND_WEBGPU) {
            try {
                const stage  = Na__PlStage__BuildStageGroup(collected.Instances);
                const result = await Na__ProjectedLinework__WebGpuBackend__ProjectView(stage, definition.Basis, options, run);
                return Na__PlProjector__VisibleOnly(result);
            } catch (gpuError) {
                if (gpuError && gpuError.name === 'AbortError') throw gpuError;
                console.warn('[TrueVision3D ProjectedLinework] WebGPU projection failed, falling back to the CPU backend:', gpuError);
            }
        }

        if (options.Backend === Na__PlProjector__BACKEND_LEGACY) {
            const stage = Na__PlStage__BuildStageGroup(collected.Instances);
            return Na__PlProjector__VisibleOnly(await Na__PlProjector__ProjectLegacy(stage, definition.Basis, options, run));
        }

        return Na__PlCpu__ProjectView(collected, sampled, definition, options, run);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap a Single-Class Backend Result in the Class Shape
    // ------------------------------------------------------------
    function Na__PlProjector__VisibleOnly(result) {
        return {
            Classes : {
                visible  : result.Segments || new Float32Array(0),
                hidden   : new Float32Array(0),
                authored : new Float32Array(0),
                section  : new Float32Array(0)
            },
            Phases        : result.Phases || [],
            EdgeCount     : 0,
            OccluderCount : 0
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Legacy Vendored Path
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Wrap a Stage Group in the Orientation for One View
    // ------------------------------------------------------------
    function Na__PlProjector__Orient(stage, basis) {
        const oriented = new THREE.Group();
        oriented.name  = 'Na__ProjectedLinework__Oriented';
        oriented.matrixAutoUpdate = false;
        oriented.matrix.makeBasis(
            new THREE.Vector3(basis.XAxisTo[0], basis.XAxisTo[1], basis.XAxisTo[2]),
            new THREE.Vector3(basis.YAxisTo[0], basis.YAxisTo[1], basis.YAxisTo[2]),
            new THREE.Vector3(basis.ZAxisTo[0], basis.ZAxisTo[1], basis.ZAxisTo[2])
        );
        oriented.add(stage);
        oriented.updateMatrixWorld(true);
        return oriented;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Vendored Output to Drawing Millimetres
    // ------------------------------------------------------------
    function Na__PlProjector__ToDrawingSegments(positionArray, options) {
        const minimumLengthSq = options.MinimumSegmentLengthMm * options.MinimumSegmentLengthMm;
        const scaleDivisor    = options.ScaleDivisor;
        const segmentCount    = Math.floor(Math.floor(positionArray.length / 3) / 2);
        const kept            = new Float32Array(segmentCount * 4);
        let   writeIndex      = 0;

        for (let i = 0; i < segmentCount; i++) {
            const a = i * 6, b = a + 3;
            const x0 = positionArray[a] / scaleDivisor, y0 = positionArray[a + 2] / scaleDivisor;
            const x1 = positionArray[b] / scaleDivisor, y1 = positionArray[b + 2] / scaleDivisor;
            const dx = x1 - x0, dy = y1 - y0;
            if (((dx * dx) + (dy * dy)) < minimumLengthSq) continue;
            kept[writeIndex++] = x0; kept[writeIndex++] = y0; kept[writeIndex++] = x1; kept[writeIndex++] = y1;
        }
        return kept.slice(0, writeIndex);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Project Through the Unmodified Vendored Generator
    // ------------------------------------------------------------
    async function Na__PlProjector__ProjectLegacy(stage, basis, options, run) {
        const settings  = run || {};
        const oriented  = Na__PlProjector__Orient(stage, basis);
        const generator = new ProjectionGenerator();
        generator.angleThreshold           = options.AngleThresholdDegrees;
        generator.iterationTime            = options.IterationTimeMs;
        generator.includeIntersectionEdges = options.IncludeIntersectionEdges;

        const phases  = [];
        let current   = null;
        let startedAt = performance.now();

        const onProgress = (percent, message) => {
            if (message === current) return;
            if (current !== null) phases.push({ Phase : current, Ms : Math.round(performance.now() - startedAt) });
            current   = message;
            startedAt = performance.now();
            if (typeof settings.OnPhase === 'function') settings.OnPhase(message);
        };

        try {
            const task   = generator.generate(oriented, { onProgress : onProgress });
            const result = await Na__ProjectedLinework__Scheduler__DriveGenerator(task, options.YieldEveryMs, settings.AbortSignal);
            if (current !== null) phases.push({ Phase : current, Ms : Math.round(performance.now() - startedAt) });

            const geometry = result.visibleEdges.getLineGeometry();
            const position = geometry.attributes ? geometry.attributes.position : null;
            return {
                Segments : position ? Na__PlProjector__ToDrawingSegments(position.array, options) : new Float32Array(0),
                Phases   : phases
            };
        } finally {
            oriented.remove(stage);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Projector API
    // ------------------------------------------------------------
    export {
        Na__PlProjector__BACKEND_CPU,
        Na__PlProjector__BACKEND_WEBGPU,
        Na__PlProjector__BACKEND_LEGACY,
        Na__PlProjector__SCALE_DIVISOR,
        Na__PlProjector__BuildOptions,
        Na__PlProjector__Collect,
        Na__PlProjector__Sample,
        Na__PlProjector__PrepareIntersections,
        Na__PlProjector__Project
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
