// =============================================================================
// TRUEVISION3D - RENDER PIPELINE - PROGRESSIVE REFINEMENT
// =============================================================================
//
// FILE       : Na__RenderEffect__ProgressiveRefine__.js
// NAMESPACE  : Na__ProgressiveRefine
// MODULE     : Render Pipeline - Idle-Time Supersampled Refinement
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Sharpen the live viewport to a full 16-sample supersampled
//              image once the camera stops, without costing a single frame
//              while the camera is moving
// CREATED    : 16-Sep-2026
//
// DESCRIPTION:
// - The live viewport draws one sample per pixel and asks FXAA to repair the
//   result afterwards. On whitecard that never worked: a glazing bar thinner
//   than a pixel is a coin toss between full black and full white, so it draws
//   as a dashed line rather than a thin one, and FXAA cannot see far enough
//   along a two-degree eaves line to find where its thirty-pixel step ends.
//   The video exporter solved this in v2.21.19 by rendering each frame sixteen
//   times with sub-pixel jitter and averaging, which turns every pixel from a
//   yes-or-no answer into a measurement of how much of it a line covers.
//   @delegate: ./Na__RenderEffect__Supersampler__.js
// - Sixteen renders per frame is obviously impossible at sixty frames a
//   second. It is entirely possible in the time the viewport spends doing
//   NOTHING, which in practice is nearly all of it: the camera moves for two
//   seconds and then sits still for two minutes while somebody talks over it.
//   That parked image is the one people actually look at, and it is the one
//   this module fixes.
//
// THE COST IS ZERO WHILE YOU ARE MOVING:
// - While the camera moves this module does not run. The render loop draws
//   exactly the frame it drew before this file existed, FXAA included. There
//   is no penalty of any kind to orbiting, walking or flying.
// - The samples are only ever drawn after the camera has been still for the
//   debounce period, so a run of small nudges never starts and abandons a
//   burst over and over.
//
// WHY IT IS SPREAD OVER FRAMES AND NOT DONE IN ONE BLOCK:
// - Sixteen renders inside one frame would block the main thread for as long
//   as they take - a third of a second on a laptop with SSAO at 4K - and the
//   first click after the camera stops would be swallowed. The samples are
//   therefore drawn in chunks sized from the measured frame time, so no single
//   frame blocks for much longer than an ordinary one, and the picture is
//   presented after every chunk.
// - The chunk always stops on a MILESTONE: eight samples, then sixteen. Eight
//   is where a whitecard image stops looking broken; sixteen is where the
//   residual banding drops below what the eye can separate on a clean white
//   field. A fast machine therefore does 8 then 8, which is two visible steps
//   as intended. A slow one does smaller chunks and still lands exactly on
//   eight and sixteen.
//
// EVERY FRAME THAT RUNS MUST DRAW:
// - preserveDrawingBuffer is off on the live renderer, so the drawing buffer
//   is undefined once the browser has composited it. A frame that runs and
//   draws nothing therefore composites an empty buffer and the viewport
//   flashes. Two consequences shape this module:
//     1. A chunk always ends with present(), even a one-sample chunk. That is
//        why present() had to learn to expose a part-finished total.
//     2. When the loop is FORCED to keep running with nothing left to refine -
//        walk and fly hold it open to poll the keyboard - the frame re-presents
//        the finished total rather than skipping. One full screen quad, against
//        the whole effect chain it replaces.
//   When the loop is free to idle it simply stops, exactly as it does today,
//   and the canvas holds the last presented frame with the GPU switched off.
//
// STILLNESS IS MEASURED, NOT ANNOUNCED:
// - The obvious hook would be "the render loop wants to stop", but walk and
//   fly never stop: they hold the loop open for as long as they are active so
//   they can read the keyboard, so standing still in walk mode would never
//   refine. Instead the camera's position, orientation and projection are
//   compared with the previous frame's. That covers orbit, pan, zoom, walk,
//   fly, lens changes, the vertical correction shear and a scene jumping to a
//   saved view, with one rule.
// - Geometry moving while the camera is still - a door swinging, a video
//   timeline playing - is not visible in the camera, so the caller passes
//   those in as sceneBusy and the accumulation resets.
//
// WHAT IS REMEMBERED IS WHEN IT LAST MOVED, NOT HOW LONG IT HAS BEEN STILL:
// - This distinction is the whole reason zoom and scene changes work. The
//   render loop is invalidation based, so most things are ONE frame and then
//   silence: a wheel zoom moves the camera and asks for a single frame, and a
//   scene transition ends by asking for "one final clean frame". A settle test
//   that had to watch two still frames in a row could never pass across that
//   silence, because the second frame never came and nothing was scheduled to
//   bring it. The loop simply stopped with the viewport unrefined.
// - A timestamp can be compared after a gap of any length. The frame that
//   wakes at the end of the debounce compares the camera with a snapshot taken
//   before the silence, finds it unmoved, and refines on that same frame.
// - Panning appeared to work throughout only by accident: its three trailing
//   settle frames happened to hand the old test the second look it needed.
//
// ASKING FOR FRAMES, AND WHEN NOT TO:
// - Because the loop would otherwise stop, this module has to ask for the
//   frames it needs. getPendingWork is what it asks with, and the answer is
//   deliberately NO whenever the frame was not this module's to refine: a 2D
//   sheet owning the viewport, the engine held by another system, the tab in
//   the background. Answering yes there would wake a resting app every
//   debounce for ever, which is a far worse bug than the one being fixed.
//
// THE COMPOSER IS BORROWED ONE FRAME AT A TIME:
// - Supersampling needs the composer to stop drawing to the canvas and FXAA
//   to stand aside, or sixteen blurred pictures get averaged into one blurred
//   picture. Both are set at the top of a chunk and PUT BACK at the bottom of
//   the same frame, never held across frames. Anything that borrows the live
//   pipeline between frames - a still export, a video export, a Layout Editor
//   snapshot - therefore always finds it in its ordinary state.
// - Shadow maps are drawn by the first sample and frozen for the rest of the
//   burst. The jitter moves the view camera; the lights and the geometry are
//   not moving at all, so every later shadow pass would redraw identical maps.
//
// SCOPE:
// - The 3D viewport only. The 2D drawing views (floor plans, elevations,
//   sections) bypass the composer entirely and are excluded by the caller.
//   Image export is untouched: it does its own supersampling in one
//   synchronous block per tile and always did.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js 1.0.1
// - Ported on     : 16-Sep-2026 for TrueVision3D v2.56.0
// - Parity        : verbatim apart from the app name in this header and in the
//                   one console warning. The maths, the settle test, the chunk
//                   planner and the whole API are identical, and are meant to
//                   stay that way - a second copy that drifts is worse than no
//                   second copy.
// - Divergence    : none in behaviour. What differs is the CALLER: TrueVision
//                   has one engine rather than two, no video studio to report
//                   as busy, and a 2D drawing path that bypasses the composer
//                   instead of running a preset through it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 16-Sep-2026 - Version 1.0.1
// - Zoom and scene changes refine now. Both are single invalidation frames, and
//   the settle test needed two still frames in a row, so the loop stopped with
//   nothing scheduled and the viewport stayed unrefined. The test now compares
//   against a "last moved" timestamp, which survives any gap, and the module
//   asks for the frame it needs - except when the frame was never its to
//   refine, which is what suspend() and the blocked state are for.
//
// 17-Sep-2026 - Version 1.0.3
// - EnsureBuffer floors the composer's buffer size before comparing it with
//   the supersampler's. EffectComposer stores cssSize x pixelRatio unrounded,
//   so at 125% or 150% display scaling the size is fractional; the
//   supersampler rounds and reports the rounded size; the two never matched,
//   the buffer was rebuilt and the total discarded on EVERY chunk, and the
//   count sat on the first chunk size for ever. Reproduced at 87 chunks in
//   3.5 seconds against 4 to converge; floor matches what WebGL allocates.
//
// 17-Sep-2026 - Version 1.0.2
// - planFrame reads performance.now() itself instead of taking the caller's
//   animation-frame timestamp. Everything else here stamps and measures with
//   performance.now(), and a refinement chunk blocks long enough for the two
//   clocks to disagree by a quarter of a second at the moment of the decision.
//
// 16-Sep-2026 - Version 1.0.0
// - Initial implementation for ValeVision3D v2.48.0, ported here at v2.56.0.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Shared Supersampler (one jitter table for the whole app)
    // @delegate: ./Na__RenderEffect__Supersampler__.js
    // ------------------------------------------------------------
    import {
        Na__Supersampler__Create,
        Na__Supersampler__ResolveSampleCount
    } from './Na__RenderEffect__Supersampler__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Frame Plan Verdicts
    // ------------------------------------------------------------
    // What the render loop should do with the frame it is holding.
    //   NORMAL  - the ordinary single-sample frame with FXAA, unchanged
    //   REFINE  - draw the next chunk of jittered samples and present them
    //   PRESENT - nothing left to draw; put the finished total back on screen
    // ------------------------------------------------------------
    const Na__Refine__FRAME_NORMAL  = 'normal';
    const Na__Refine__FRAME_REFINE  = 'refine';
    const Na__Refine__FRAME_PRESENT = 'present';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Fallback Settings When AppConfig Is Absent
    // ------------------------------------------------------------
    const Na__Refine__DEFAULTS = Object.freeze({
        enabled           : true,
        sampleCount       : 16,
        presentMilestones : [8, 16],
        settleDebounceMs  : 150,
        chunkBudgetMs     : 100,
        maxChunkSamples   : 8,
        stillnessPosMm    : 1,
        stillnessRotDeg   : 0.01
    });
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Stillness Thresholds That Are Not User Tunables
    // ------------------------------------------------------------
    // The projection comparison is dimensionless, so it carries no unit and
    // belongs here rather than in AppConfig. A lens change, a zoom or the
    // vertical correction shear all move these elements by far more than this.
    // ------------------------------------------------------------
    const Na__Refine__PROJECTION_EPSILON = 1e-7;                              // <-- Max element drift still counted as the same projection
    const Na__Refine__MM_PER_UNIT        = 1000;                              // <-- Scene units are metres (04__MathUtils SSOT)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Debounce Comparison Tolerance
    // ------------------------------------------------------------
    // The settle wake-up is a setTimeout for the remaining debounce, and the
    // frame it asks for arrives at the next animation frame after that. Both
    // legs round and jitter, so a wake armed for 149ms can produce a frame
    // measuring 149ms elapsed and miss a 150ms threshold by a hair, costing a
    // whole extra wake-up to gain one millisecond. A couple of milliseconds of
    // slack removes the miss and changes nothing anyone can perceive.
    // ------------------------------------------------------------
    const Na__Refine__DEBOUNCE_TOLERANCE_MS = 2;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Frame Time Sampling for the Readout and Chunk Sizing
    // ------------------------------------------------------------
    const Na__Refine__FRAME_SAMPLE_COUNT = 30;                                // <-- Rolling window length
    const Na__Refine__FRAME_SAMPLE_MIN_MS = 2;                                // <-- Below this the timestamp is noise, not a frame
    const Na__Refine__FRAME_SAMPLE_MAX_MS = 250;                              // <-- Above this the loop was idle, not slow
    const Na__Refine__FRAME_CONTINUITY_MS = 250;                              // <-- Gap after which the previous frame is not a neighbour
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Settings Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Number From AppConfig With a Fallback
    // ------------------------------------------------------------
    function Na__Refine__ReadNumber(block, key, fallback) {
        const value = block ? Number(block[key]) : NaN;
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Module's Settings From an AppConfig Block
    // ------------------------------------------------------------
    // The sample count is snapped to one the supersampler actually holds a
    // jitter pattern for, and the milestones are cleaned up to match it: every
    // milestone must be inside the run, in order, and the last one must be the
    // full count or the burst would stop one present short of finishing.
    // ------------------------------------------------------------
    function Na__ProgressiveRefine__ResolveSettings(configBlock) {
        const block = configBlock || null;
        const D     = Na__Refine__DEFAULTS;

        const sampleCount = Na__Supersampler__ResolveSampleCount(
            Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__SampleCount', D.sampleCount)
        );

        const rawMilestones = (block && Array.isArray(block.RenderEffect__ProgressiveRefine__PresentMilestones))
            ? block.RenderEffect__ProgressiveRefine__PresentMilestones
            : D.presentMilestones;

        const milestones = Array.from(new Set(
            rawMilestones
                .map(value => Math.round(Number(value)))
                .filter(value => Number.isFinite(value) && value > 0 && value < sampleCount)
        )).sort((a, b) => a - b);
        milestones.push(sampleCount);                                        // <-- The run always ends on a present

        return {
            enabled           : block
                ? block.RenderEffect__ProgressiveRefine__Enabled !== false    // <-- Absent key means on
                : D.enabled,
            sampleCount,
            presentMilestones : milestones,
            settleDebounceMs  : Math.max(0, Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__SettleDebounceMs', D.settleDebounceMs)),
            chunkBudgetMs     : Math.max(8, Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__ChunkBudgetMs',   D.chunkBudgetMs)),
            maxChunkSamples   : Math.max(1, Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__MaxChunkSamples', D.maxChunkSamples)),
            stillnessPosUnits : Math.max(0, Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__StillnessPositionMm', D.stillnessPosMm)) / Na__Refine__MM_PER_UNIT,
            stillnessRotDot   : Na__Refine__RotationToleranceToDot(
                Na__Refine__ReadNumber(block, 'RenderEffect__ProgressiveRefine__StillnessRotationDeg', D.stillnessRotDeg)
            )
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert a Rotation Tolerance in Degrees to a Quaternion Dot Threshold
    // ------------------------------------------------------------
    // Two unit quaternions a half-angle t apart have |dot| = cos(t), so a
    // tolerance of d degrees becomes cos(d/2 in radians). Comparing the dot
    // avoids an acos per frame and is exact enough at these angles.
    // ------------------------------------------------------------
    function Na__Refine__RotationToleranceToDot(degrees) {
        const safeDegrees = Math.max(0, Number.isFinite(degrees) ? degrees : 0);
        return Math.cos(THREE.MathUtils.degToRad(safeDegrees) * 0.5);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Progressive Refiner Construction
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Viewport's Progressive Refiner
    // ------------------------------------------------------------
    // options:
    //   renderer {THREE.WebGLRenderer}  The live renderer (borrowed, never owned)
    //   config   {object}               AppConfig RenderEffect__ProgressiveRefine block
    //
    // The accumulation buffer is NOT allocated here. It is created the first
    // time a burst actually runs and sized from the composer's own read buffer,
    // which is the only size guaranteed to match what is being accumulated. A
    // session that never sits still therefore never pays for the memory.
    // ------------------------------------------------------------
    function Na__ProgressiveRefine__Create(options) {
        const { renderer, config } = options || {};
        const settings = Na__ProgressiveRefine__ResolveSettings(config);

        // STATE | Enablement
        // ------------------------------------------------------------
        let isEnabled = settings.enabled && settings.sampleCount > 1;
        let isDisposed = false;

        // STATE | The Accumulation Buffer, Built On First Use
        // ------------------------------------------------------------
        let supersampler = null;

        // STATE | Where the Current Burst Has Got To
        // ------------------------------------------------------------
        // lastCameraChangeAt is a "when did it last MOVE", not a "how long has
        // it been still". The difference matters enormously: the render loop is
        // invalidation based, so a wheel zoom or a scene change is ONE frame and
        // then silence. A test that had to watch two still frames in a row could
        // never pass across that silence, because the second frame never came.
        // A timestamp can be compared after any gap, however long, so the frame
        // that wakes up at the end of the debounce refines immediately.
        // ------------------------------------------------------------
        let samplesDone        = 0;                                          // <-- Samples in the running total
        let isConverged        = false;                                      // <-- The total holds the full sample count
        let lastCameraChangeAt = 0;                                          // <-- Timestamp the view was last seen to change
        let isBlocked          = true;                                       // <-- Something other than the camera owns this frame

        // STATE | Last Frame's Camera, for the Stillness Comparison
        // ------------------------------------------------------------
        let hasCameraSnapshot = false;
        const lastPosition    = new THREE.Vector3();
        const lastQuaternion  = new THREE.Quaternion();
        const lastProjection  = new Float64Array(16);

        // STATE | Rolling Frame Time, for the Readout and the Chunk Size
        // ------------------------------------------------------------
        const frameSamples    = [];
        let   frameSampleSum  = 0;
        let   lastNormalAt    = 0;

        // SCRATCH | Reused every frame
        // ------------------------------------------------------------
        const scratchPosition   = new THREE.Vector3();
        const scratchQuaternion = new THREE.Quaternion();
        const scratchScale      = new THREE.Vector3();

        // HELPER FUNCTION | Throw Away the Running Total, Keep the Stillness Clock
        // ------------------------------------------------------------
        // The buffer itself is kept: the next burst clears it on its first
        // sample anyway, and reallocating it on every camera nudge would churn
        // tens of megabytes of graphics memory for nothing.
        // ------------------------------------------------------------
        function Na__Refine__DiscardTotal() {
            samplesDone = 0;
            isConverged = false;
        }
        // ------------------------------------------------------------


        // HELPER FUNCTION | Throw the Total Away AND Restart the Debounce
        // ------------------------------------------------------------
        // For a camera that moved or a scene that changed. Kept separate from
        // DiscardTotal, because discarding a total mid-burst - a buffer rebuilt
        // underneath it - must NOT also restart the debounce, or the burst
        // would present its first chunk and then idle, leaving the viewport
        // permanently short of a full run.
        // ------------------------------------------------------------
        function Na__Refine__MarkChanged(now) {
            Na__Refine__DiscardTotal();
            lastCameraChangeAt = Number.isFinite(now) ? now : performance.now();
        }
        // ------------------------------------------------------------

        // HELPER FUNCTION | Compare This Frame's Camera With Last Frame's
        // ------------------------------------------------------------
        // Returns true when nothing about the view has changed. The world
        // matrix is brought up to date first, because the render loop asks
        // this BEFORE the renderer would have updated it, and a stale matrix
        // would report the camera still one frame after it moved.
        // ------------------------------------------------------------
        function Na__Refine__IsCameraStill(camera) {
            camera.updateMatrixWorld();
            camera.matrixWorld.decompose(scratchPosition, scratchQuaternion, scratchScale);

            const projection = camera.projectionMatrix.elements;

            if (!hasCameraSnapshot) {                                         // <-- First frame of the session: nothing to compare with
                lastPosition.copy(scratchPosition);
                lastQuaternion.copy(scratchQuaternion);
                for (let i = 0; i < 16; i++) lastProjection[i] = projection[i];
                hasCameraSnapshot = true;
                return false;
            }

            let isStill = scratchPosition.distanceTo(lastPosition) <= settings.stillnessPosUnits
                && Math.abs(scratchQuaternion.dot(lastQuaternion)) >= settings.stillnessRotDot;

            if (isStill) {
                for (let i = 0; i < 16; i++) {
                    if (Math.abs(projection[i] - lastProjection[i]) > Na__Refine__PROJECTION_EPSILON) {
                        isStill = false;                                      // <-- Lens, zoom, aspect or the vertical correction shear moved
                        break;
                    }
                }
            }

            lastPosition.copy(scratchPosition);
            lastQuaternion.copy(scratchQuaternion);
            for (let i = 0; i < 16; i++) lastProjection[i] = projection[i];

            return isStill;
        }
        // ------------------------------------------------------------

        // HELPER FUNCTION | Build or Re-Build the Accumulation Buffer to Match the Composer
        // ------------------------------------------------------------
        // The composer's read buffer is the thing being accumulated, so its
        // size is the only correct size. Reading it here rather than working
        // the pixel ratio out means a window resize and a live engine switch
        // are both handled without a hook: the size simply no longer matches
        // and the buffer is rebuilt on the next burst.
        // ------------------------------------------------------------
        function Na__Refine__EnsureBuffer(composer) {
            const readBuffer = composer ? composer.readBuffer : null;
            if (!readBuffer) return null;

            // ROUNDED, BECAUSE THE COMPOSER DOES NOT. EffectComposer sizes its
            // buffers as cssWidth x pixelRatio and stores the product as it
            // comes, so on any display scaling that is not 100% - 125% and 150%
            // are the normal cases on a good monitor - readBuffer.width is a
            // number like 2498.75. The supersampler rounds what it is given and
            // reports the rounded size, so comparing the two raw would fail on
            // EVERY chunk: buffer torn down, total discarded, chunk drawn again
            // from zero, landing on the first chunk size every frame for ever.
            // That is the "6 of 16" that never moved, at a full chunk of GPU
            // work per frame. FLOOR, not round: WebGL takes texture sizes as
            // integers and truncates, so the buffer that actually exists on the
            // GPU is the floor of the number three.js wrote down. Matching that
            // makes the equality test exact AND the accumulation target the
            // same pixel size as the frame it accumulates.
            const width  = Math.max(1, Math.floor(readBuffer.width));
            const height = Math.max(1, Math.floor(readBuffer.height));
            if (!(readBuffer.width > 0) || !(readBuffer.height > 0)) return null;

            if (supersampler && (supersampler.width !== width || supersampler.height !== height)) {
                supersampler.dispose();                                       // <-- Window resized or the engine was swapped
                supersampler = null;
            }

            if (!supersampler) {
                supersampler = Na__Supersampler__Create({
                    renderer,
                    width,
                    height,
                    samples : settings.sampleCount
                });
                Na__Refine__DiscardTotal();                                   // <-- A fresh target holds whatever the driver left in it.
                                                                              //     Only sample zero clears it, so the count MUST go back to
                                                                              //     zero with the buffer or the next add lands on garbage.
                                                                              //     The stillness clock stays: this burst carries on from zero.
            }

            return supersampler;
        }
        // ------------------------------------------------------------

        // HELPER FUNCTION | How Many Samples This Frame Should Draw
        // ------------------------------------------------------------
        // Sized from the measured frame time so one chunk blocks for roughly
        // the configured budget and no longer, then trimmed so the chunk lands
        // exactly on the next milestone. A fast machine gets 8 and 8; a slow
        // one gets smaller chunks that still land on eight and sixteen.
        // ------------------------------------------------------------
        function Na__Refine__PlanChunkSize() {
            const measuredMs = refiner.getAverageFrameMs();
            const affordable = measuredMs > 0
                ? Math.floor(settings.chunkBudgetMs / measuredMs)
                : settings.maxChunkSamples;

            let chunk = Math.min(Math.max(affordable, 1), settings.maxChunkSamples);

            for (let i = 0; i < settings.presentMilestones.length; i++) {
                const milestone = settings.presentMilestones[i];
                if (milestone > samplesDone) {
                    chunk = Math.min(chunk, milestone - samplesDone);         // <-- Stop on the milestone, never past it
                    break;
                }
            }

            return Math.max(1, Math.min(chunk, settings.sampleCount - samplesDone));
        }
        // ------------------------------------------------------------

        const refiner = {

            // FUNCTION | Decide What the Render Loop Should Do With This Frame
            // ------------------------------------------------------------
            // context:
            //   camera    {THREE.Camera}  The camera the composer is rendering through
            //   sceneBusy {boolean}       Something other than the camera is moving
            //
            // ONE CLOCK, READ HERE. This used to take the caller's timestamp,
            // and the caller had only one to give: the animation frame's, which
            // is the time the FRAME BEGAN - the vsync tick - and not the time
            // now. Everything else in this module stamps and measures with
            // performance.now(): reset(), suspend(), release(), setEnabled() and
            // getPendingWork() all do. Mixing the two is not a rounding
            // difference, it is two clocks that drift apart by as much as a
            // frame takes, and a refinement chunk is a frame that takes a
            // quarter of a second.
            //
            // The stall that follows is silent and total. reset() stamps the
            // change with wall clock; the next plan measures the wait with the
            // frame clock, finds it short or even negative, and answers "still
            // settling" - which is the ONE outcome that leaves the running total
            // untouched. getPendingWork then measures the same wait with wall
            // clock, finds it long, and answers "come back now". So the loop is
            // sent straight back to a test that will send it away again, for
            // ever: sixty frames a second of ordinary frames, no long frames to
            // show up as violations, the frame rate readout happily reporting
            // 60fps off those frames, and the sample count frozen wherever the
            // last chunk left it. On a machine quick enough to fit six samples
            // into the first chunk, that reads "6 of 16" and never moves.
            // ------------------------------------------------------------
            planFrame(context) {
                const { camera, sceneBusy } = context || {};
                const frameNow = performance.now();

                if (!isEnabled || isDisposed || !camera) {
                    Na__Refine__DiscardTotal();
                    isBlocked         = true;                                 // <-- Nothing to come back for
                    hasCameraSnapshot = false;                                // <-- Re-arm cleanly whenever it comes back on
                    return Na__Refine__FRAME_NORMAL;
                }

                const isStill = Na__Refine__IsCameraStill(camera);            // <-- Always run: the snapshot must track every frame

                if (sceneBusy) {
                    // BLOCKED | A door swinging, the video timeline playing, a
                    // 2D elevation camera. Whoever is driving those asks for the
                    // frames they need; this module must NOT ask for its own, or
                    // a viewport that is merely sitting in a 2D view would be
                    // woken every debounce for ever.
                    Na__Refine__MarkChanged(frameNow);
                    isBlocked = true;
                    return Na__Refine__FRAME_NORMAL;
                }

                isBlocked = false;

                if (!isStill) {
                    Na__Refine__MarkChanged(frameNow);                        // <-- Restart the debounce from this frame
                    return Na__Refine__FRAME_NORMAL;
                }

                if (isConverged) return Na__Refine__FRAME_PRESENT;            // <-- Nothing left to draw; hold the finished image

                const settledForMs = (frameNow - lastCameraChangeAt) + Na__Refine__DEBOUNCE_TOLERANCE_MS;
                if (settledForMs < settings.settleDebounceMs) {
                    return Na__Refine__FRAME_NORMAL;                          // <-- Still settling; a nudge now must not abandon a burst
                }

                return Na__Refine__FRAME_REFINE;
            },
            // ------------------------------------------------------------

            // FUNCTION | Draw the Next Chunk of Samples and Put It On Screen
            // ------------------------------------------------------------
            // context:
            //   camera      {THREE.Camera}      The camera to jitter
            //   composer    {EffectComposer}    The live composer
            //   fxaaPass    {Pass|null}         The chain's FXAA pass, to stand aside
            //   drawChain   {function}          Runs the pre-passes and composer.render()
            //   drawOverlay {function|null}     Draws the section overlay onto the canvas
            //
            // Returns true when the frame drew something. False means the
            // buffer could not be built and the caller must draw an ordinary
            // frame instead, or the viewport would composite an empty buffer.
            //
            // Every borrowed value is handed back before this returns, so the
            // pipeline is only ever in its supersampling state INSIDE this
            // call. An exporter borrowing the composer between frames always
            // finds it as it left it.
            // ------------------------------------------------------------
            renderChunk(context) {
                const { camera, composer, fxaaPass, drawChain, drawOverlay } = context || {};
                if (!camera || !composer || typeof drawChain !== 'function') return false;

                const sampler = Na__Refine__EnsureBuffer(composer);
                if (!sampler) {
                    isEnabled = false;                                        // <-- No buffer means no refinement this session
                    console.warn('[TrueVision3D] Progressive refinement disabled: the accumulation buffer could not be created.');
                    Na__Refine__DiscardTotal();
                    isBlocked = true;                                         // <-- Do not keep waking the loop to try again
                    return false;
                }

                const chunkSize          = Na__Refine__PlanChunkSize();
                const shadowMap          = renderer.shadowMap;
                const savedShadowAuto    = shadowMap.autoUpdate;
                const savedRenderToScreen = composer.renderToScreen;
                const savedFxaaEnabled   = fxaaPass ? fxaaPass.enabled : true;

                composer.renderToScreen = false;                              // <-- Each sample lands in the read buffer, not on the canvas
                if (fxaaPass) fxaaPass.enabled = false;                       // <-- Averaging blurred samples buys blur for nothing

                try {
                    sampler.captureBaseProjection(camera);                    // <-- The lens and the shear have settled by now

                    for (let i = 0; i < chunkSize; i++) {
                        if (samplesDone > 0) shadowMap.autoUpdate = false;    // <-- Sample zero drew the maps; nothing has moved since

                        sampler.applyJitter(camera, samplesDone);
                        drawChain();
                        sampler.accumulate(composer.readBuffer.texture, samplesDone);
                        samplesDone++;
                    }
                } finally {
                    sampler.restoreProjection(camera);                        // <-- Unjittered for the overlay, the picker and the next frame
                    shadowMap.autoUpdate   = savedShadowAuto;
                    composer.renderToScreen = savedRenderToScreen;
                    if (fxaaPass) fxaaPass.enabled = savedFxaaEnabled;
                }

                isConverged = samplesDone >= settings.sampleCount;

                sampler.present(null, settings.sampleCount / samplesDone);    // <-- The mean of what has been drawn so far
                if (typeof drawOverlay === 'function') drawOverlay();         // <-- The present wiped it; the section outlines go back on top

                return true;
            },
            // ------------------------------------------------------------

            // FUNCTION | Put the Finished Total Back On the Canvas
            // ------------------------------------------------------------
            // Only for a loop that is forced to keep running with nothing left
            // to refine - walk and fly hold it open to poll the keyboard. One
            // full screen quad in place of the whole effect chain.
            // ------------------------------------------------------------
            presentAgain(drawOverlay) {
                if (!supersampler || samplesDone < 1) return false;

                supersampler.present(null, settings.sampleCount / samplesDone);
                if (typeof drawOverlay === 'function') drawOverlay();
                return true;
            },
            // ------------------------------------------------------------

            // FUNCTION | Does the Loop Need to Come Back for More Samples
            // ------------------------------------------------------------
            // Asked by a loop that is about to go idle. True means schedule
            // another frame; the delay tells it whether to come straight back
            // for the next chunk or wait out the rest of the debounce.
            // ------------------------------------------------------------
            getPendingWork() {
                if (!isEnabled || isDisposed || isConverged || isBlocked) {
                    return { wanted: false, delayMs: 0 };
                }

                const waitedMs = performance.now() - lastCameraChangeAt;
                return {
                    wanted  : true,
                    delayMs : Math.max(0, Math.ceil(settings.settleDebounceMs - waitedMs))
                };
            },
            // ------------------------------------------------------------

            // FUNCTION | Record an Ordinary Frame's Duration
            // ------------------------------------------------------------
            // Only ordinary frames count. A refinement chunk is several frames'
            // work in one, and a lone invalidation frame after five minutes of
            // idling is a gap rather than a slow frame; feeding either in would
            // make the readout meaningless and mis-size the chunks.
            // ------------------------------------------------------------
            noteNormalFrame(now, deltaMs) {
                const isNeighbour = lastNormalAt > 0 && (now - lastNormalAt) < Na__Refine__FRAME_CONTINUITY_MS;
                lastNormalAt = now;

                if (!isNeighbour) return;
                if (!(deltaMs >= Na__Refine__FRAME_SAMPLE_MIN_MS && deltaMs <= Na__Refine__FRAME_SAMPLE_MAX_MS)) return;

                frameSamples.push(deltaMs);
                frameSampleSum += deltaMs;
                if (frameSamples.length > Na__Refine__FRAME_SAMPLE_COUNT) {
                    frameSampleSum -= frameSamples.shift();
                }
            },
            // ------------------------------------------------------------

            // FUNCTION | Average Ordinary Frame Time in Milliseconds
            // ------------------------------------------------------------
            getAverageFrameMs() {
                return frameSamples.length > 0 ? (frameSampleSum / frameSamples.length) : 0;
            },
            // ------------------------------------------------------------

            // FUNCTION | Abandon Any Part-Finished Total and Restart the Debounce
            // ------------------------------------------------------------
            // Called for anything that changes what the frame should look like
            // without moving the camera: a render request, a pass toggled, a
            // model layer hidden. The refinement is still WANTED afterwards -
            // the new picture deserves it as much as the old one did - so the
            // debounce restarts rather than the whole thing standing down.
            // ------------------------------------------------------------
            reset() {
                Na__Refine__MarkChanged(performance.now());
                isBlocked = false;                                            // <-- A fresh picture to refine once it settles
            },
            // ------------------------------------------------------------

            // FUNCTION | Stand Down Until planFrame Runs Again
            // ------------------------------------------------------------
            // For a frame this module has no business in: a 2D sheet owning the
            // viewport, the engine held by another system, the tab hidden.
            // Unlike reset() this asks for NO further frames, so the loop is
            // free to idle exactly as it did before this feature existed.
            // ------------------------------------------------------------
            suspend() {
                Na__Refine__MarkChanged(performance.now());
                isBlocked = true;
            },
            // ------------------------------------------------------------

            // FUNCTION | Give the Accumulation Buffer Back
            // ------------------------------------------------------------
            // For an engine switch, which throws the composer away. The next
            // burst builds a fresh buffer at the new composer's size.
            // ------------------------------------------------------------
            release() {
                Na__Refine__MarkChanged(performance.now());
                if (supersampler) {
                    supersampler.dispose();
                    supersampler = null;
                }
            },
            // ------------------------------------------------------------

            // FUNCTION | Turn Refinement On or Off at Runtime
            // ------------------------------------------------------------
            setEnabled(wanted) {
                isEnabled = !!wanted && settings.sampleCount > 1;
                Na__Refine__MarkChanged(performance.now());
                isBlocked = !isEnabled;
                if (!isEnabled) refiner.release();                            // <-- Off means off: hand the memory back
                return isEnabled;
            },
            // ------------------------------------------------------------

            // FUNCTION | Read the Live State for the Settings Panel
            // ------------------------------------------------------------
            getStatus() {
                const averageMs = refiner.getAverageFrameMs();
                return {
                    enabled     : isEnabled,
                    sampleCount : settings.sampleCount,
                    samplesDone,
                    converged   : isConverged,
                    frameMs     : averageMs,
                    fps         : averageMs > 0 ? (1000 / averageMs) : 0
                };
            },
            // ------------------------------------------------------------

            // FUNCTION | Release Everything
            // ------------------------------------------------------------
            dispose() {
                if (isDisposed) return;
                isDisposed = true;
                refiner.release();
            }
            // ------------------------------------------------------------
        };

        return refiner;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Active Instance Registry
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Session's Refiner
    // ------------------------------------------------------------
    // The loading sequence owns the render loop and therefore builds the
    // refiner, exactly as it owns the composer. The settings panel needs to
    // switch it on and off and read its state several times a second, which is
    // a poll rather than a command and would be silly to route through events,
    // so the instance is registered here for anything that needs it. Same
    // shape as Na__RenderEffect__SectionClipping__State.js.
    // ------------------------------------------------------------
    let Na__ProgressiveRefine__Active = null;
    // ------------------------------------------------------------


    // FUNCTION | Register the Session's Refiner
    // ------------------------------------------------------------
    function Na__ProgressiveRefine__SetActive(refiner) {
        Na__ProgressiveRefine__Active = refiner || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Session's Refiner (null before the render loop starts)
    // ------------------------------------------------------------
    function Na__ProgressiveRefine__GetActive() {
        return Na__ProgressiveRefine__Active;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Progressive Refinement API
    // ------------------------------------------------------------
    export {
        Na__ProgressiveRefine__Create,
        Na__ProgressiveRefine__ResolveSettings,
        Na__ProgressiveRefine__SetActive,
        Na__ProgressiveRefine__GetActive,
        Na__Refine__FRAME_NORMAL,
        Na__Refine__FRAME_REFINE,
        Na__Refine__FRAME_PRESENT
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
