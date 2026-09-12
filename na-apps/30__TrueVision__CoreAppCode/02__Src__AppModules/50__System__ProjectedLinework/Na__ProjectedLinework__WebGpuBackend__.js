// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - WEBGPU BACKEND
// =============================================================================
//
// FILE       : Na__ProjectedLinework__WebGpuBackend__.js
// NAMESPACE  : Na__ProjectedLinework__WebGpuBackend
// MODULE     : Projected Linework - WebGPU Backend
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hand the occlusion pass to the graphics card where one is willing
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - Drives the WebGPU projection generator that ships inside the vendored
//   three-edge-projection package, using a compute-only renderer this module
//   creates and keeps to itself.
// - An OPTIONAL fast path. Every failure route in this file ends with the CPU
//   backend doing the work instead, and the drawing is identical either way to
//   within the tolerance the DiffHarness reports.
//
// ---------------------------------------------------------------------------
//
// WHAT IT ACTUALLY ACCELERATES, AND WHAT IT DOES NOT
//
// The vendored WebGPU generator moves ONE phase onto the card: the edge against
// triangle occlusion test, one GPU thread per edge. That is the phase that
// dominated, so the win is real, but the phases either side of it stay on the CPU
// inside the vendored code:
//
//     CPU   edge extraction, then intersection edge generation
//     GPU   occlusion clipping
//     CPU   merging the returned ranges back into line segments
//
// This module therefore cannot use the per lantern caching the CPU backend was
// built around - the vendored entry point takes a scene and does its own
// extraction, with nowhere to hand it a result computed earlier. On a lantern where
// the intersection pass is expensive, the CPU backend with a warm cache and a full
// worker pool can come out AHEAD of this one on the second and third views.
//
// That is not a reason to avoid it, it is a reason to measure. The Pipeline logs
// both, the DiffHarness compares both, and the backend is a config choice.
//
// ---------------------------------------------------------------------------
//
// ROUGH EDGES IN THE VENDORED CODE, ALL VERIFIED IN ITS SOURCE
//
//   ONPROGRESS IS NOT OPTIONAL   Its generate() calls onProgress unguarded at one
//                                point despite guarding it everywhere else, so
//                                omitting the callback throws. One is always
//                                passed below, even when nothing wants it.
//
//   A 128 MB BUFFER PER CALL     It allocates the overlap buffer fresh on every
//                                generate() and its dispose() calls are commented
//                                out in the vendored source. Three views is three
//                                allocations left for the collector to notice.
//                                Watched rather than worked around: patching
//                                vendor code to fix it would fork the version lock.
//
//   ANIMATION FRAME SCHEDULING   Its job queue waits on requestAnimationFrame with
//                                no timer fallback, so a background tab stalls it
//                                indefinitely. Fine for a button the user presses
//                                and watches; NOT fine for the sheet bake, which is
//                                why that path stays on the CPU backend.
//
//   NOT BIT IDENTICAL            Single precision on the card against double on the
//                                CPU, looser epsilons, and a visibility offset
//                                fifty times larger. Endpoints move by far less
//                                than the drawing rounds to, but visible against
//                                hidden can genuinely flip where two faces are
//                                nearly coincident.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     IsAvailable()                                -> boolean
//     Warm()                                       -> Promise<boolean>
//     ProjectView(stage, basis, options, run)      -> Promise<{ Segments, Phases }>
//     Dispose()
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__WebGpuBackend__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Ported from the Lantern Designer projection engine for port Phase 4;
//   identifiers renamed to the TrueVision namespace and the header restyled.
//   The body is kept as the Lantern Designer wrote it so the kernel stays
//   diff-able against its source and the Diff harness remains meaningful.
//
// =============================================================================


import * as THREE from 'three';

// =============================================================================
// REGION | Projected Edges WebGPU Backend Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Compute Renderer and Its Loading State
    // ------------------------------------------------------------
    // One renderer for the life of the session. Creating a WebGPU device is not
    // cheap and the first compute pass additionally compiles the shaders, so tying
    // that to a single view would pay it three times per render.
    let Na__ProjectedLinework__WebGpuBackend__Renderer   =  null;
    let Na__ProjectedLinework__WebGpuBackend__Generator  =  null;
    let Na__ProjectedLinework__WebGpuBackend__Loading    =  null;
    let Na__ProjectedLinework__WebGpuBackend__Unusable   =  false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Hardware Probe Result
    // ------------------------------------------------------------
    // Settled once per session and cached. Null until the probe has run.
    let Na__ProjectedLinework__WebGpuBackend__Probe      =  null;   // <-- { Capable, Reason, Adapter }
    let Na__ProjectedLinework__WebGpuBackend__Probing    =  null;   // <-- In-flight probe promise
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Availability
// -----------------------------------------------------------------------------

    // FUNCTION | Whether This Browser Could Possibly Run the GPU Path
    // ------------------------------------------------------------
    // Only answers the cheap, synchronous question: does the API exist at all.
    // It is NOT a capability test and must not be used as one - navigator.gpu is
    // present in every current Chromium build, including on machines where the
    // adapter request goes on to fail outright or hand back a software
    // rasteriser. Na__ProjectedLinework__WebGpuBackend__ProbeHardware answers the
    // question that actually matters.
    export function Na__ProjectedLinework__WebGpuBackend__IsAvailable() {
        return !Na__ProjectedLinework__WebGpuBackend__Unusable &&
               (typeof navigator !== 'undefined') &&
               !!navigator.gpu;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ask the Machine What Graphics Hardware It Actually Has
    // ------------------------------------------------------------
    // Resolves { Capable, Reason, Adapter } and caches it for the session. Never
    // rejects: a machine without a usable GPU is an ordinary condition, and every
    // caller's answer to it is the same.
    //
    // powerPreference 'high-performance' asks for the discrete card on a machine
    // with both. IT IS CURRENTLY IGNORED ON WINDOWS (crbug 369219127) and Chromium
    // says so in the console on every probe, so treat it as a hint that will start
    // working rather than a guarantee that does. It costs nothing to ask, and on a
    // single-GPU workstation the question does not arise; on a hybrid laptop the
    // browser picks, and the worst case is the integrated chip - still a real
    // adapter, still correct, just less of a win than the discrete one would be.
    //
    // A FALLBACK ADAPTER IS REPORTED AS NOT CAPABLE, and that is the important
    // part of this function. When no real GPU is reachable the browser may still
    // return an adapter backed by a SOFTWARE rasteriser. It satisfies every API
    // check, runs the compute shader correctly, and is SLOWER than the CPU
    // backend it would be displacing - so accepting it would make the app choose
    // the slow path while reporting that it had chosen the fast one.
    export async function Na__ProjectedLinework__WebGpuBackend__ProbeHardware() {
        if (Na__ProjectedLinework__WebGpuBackend__Probe)   return Na__ProjectedLinework__WebGpuBackend__Probe;
        if (Na__ProjectedLinework__WebGpuBackend__Probing) return Na__ProjectedLinework__WebGpuBackend__Probing;

        Na__ProjectedLinework__WebGpuBackend__Probing = (async function() {
            const settle = (capable, reason, adapterInfo) => {
                Na__ProjectedLinework__WebGpuBackend__Probe = {
                    Capable : capable,
                    Reason  : reason,
                    Adapter : adapterInfo || null
                };
                return Na__ProjectedLinework__WebGpuBackend__Probe;
            };

            if (typeof navigator === 'undefined' || !navigator.gpu) {
                return settle(false, 'This browser has no WebGPU API.', null);
            }

            try {
                const adapter = await navigator.gpu.requestAdapter({ powerPreference : 'high-performance' });
                if (!adapter) {
                    return settle(false, 'WebGPU is present but no adapter was granted (driver blocklisted, or disabled).', null);
                }

                // adapter.info is the current shape; requestAdapterInfo() is the
                // older one. Neither is guaranteed, and a missing description is
                // not a reason to refuse the card - only to describe it vaguely.
                let info = adapter.info || null;
                if (!info && typeof adapter.requestAdapterInfo === 'function') {
                    try { info = await adapter.requestAdapterInfo(); } catch (infoError) { info = null; }
                }

                const described = {
                    Vendor       : (info && info.vendor)       || 'unknown',
                    Architecture : (info && info.architecture) || 'unknown',
                    Device       : (info && info.device)       || '',
                    Description  : (info && info.description)  || '',
                    IsFallback   : adapter.isFallbackAdapter === true
                };

                if (described.IsFallback) {
                    return settle(false, 'Only a software fallback adapter is available, which is slower than the CPU backend.', described);
                }

                return settle(true, 'Hardware adapter granted.', described);

            } catch (probeError) {
                return settle(false, 'The adapter request failed: ' + (probeError && probeError.message ? probeError.message : probeError), null);
            }
        })();

        return Na__ProjectedLinework__WebGpuBackend__Probing;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cached Probe Result, or null If It Has Not Run
    // ------------------------------------------------------------
    // Synchronous, for the places that cannot await - the backend resolver on a
    // render already in flight, and the dev menu drawing its status line.
    export function Na__ProjectedLinework__WebGpuBackend__GetProbe() {
        return Na__ProjectedLinework__WebGpuBackend__Probe;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Hardware Good Enough, As Far As We Know Right Now?
    // ------------------------------------------------------------
    // False before the probe has run, deliberately. An unprobed machine takes the
    // CPU path for that one render rather than gambling; the probe is started at
    // boot, so this is only ever the answer for a render in the first moments of
    // a session.
    export function Na__ProjectedLinework__WebGpuBackend__IsHardwareCapable() {
        return !Na__ProjectedLinework__WebGpuBackend__Unusable
            && !!Na__ProjectedLinework__WebGpuBackend__Probe
            && Na__ProjectedLinework__WebGpuBackend__Probe.Capable === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Acquire the Device and Build the Generator, Once
    // ------------------------------------------------------------
    // Resolves true when the GPU path is ready to use and false when it is not. It
    // never rejects: an unavailable graphics card is an ordinary condition here,
    // not an error, and every caller's answer to it is the same.
    //
    // The imports are dynamic on purpose. Reaching them pulls in the WebGPU build
    // of three.js and the shader language layer, which is around a megabyte of
    // parsing that a machine using the CPU backend should never pay.
    export async function Na__ProjectedLinework__WebGpuBackend__Warm() {
        if (Na__ProjectedLinework__WebGpuBackend__Generator) return true;
        if (!Na__ProjectedLinework__WebGpuBackend__IsAvailable()) return false;

        if (!Na__ProjectedLinework__WebGpuBackend__Loading) {
            Na__ProjectedLinework__WebGpuBackend__Loading  =  (async function() {
                const [ webgpuThree, edgeProjectionWebGpu ]  =  await Promise.all([
                    import('three/webgpu'),
                    import('three-edge-projection/webgpu')
                ]);

                const renderer  =  new webgpuThree.WebGPURenderer({ antialias : false });
                await renderer.init();

                // Nothing is ever drawn: the canvas exists only because the renderer
                // insists on one, and it is never attached to the document.
                Na__ProjectedLinework__WebGpuBackend__Renderer   =  renderer;
                Na__ProjectedLinework__WebGpuBackend__Generator  =
                    new edgeProjectionWebGpu.ProjectionGenerator(renderer);

                return true;
            })().catch(function(warmError) {
                console.warn('[TrueVision3D ProjectedLinework] WebGPU unavailable, staying on the CPU backend:', warmError);
                Na__ProjectedLinework__WebGpuBackend__Unusable  =  true;
                return false;
            });
        }

        return Na__ProjectedLinework__WebGpuBackend__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release the Device
    // ------------------------------------------------------------
    export function Na__ProjectedLinework__WebGpuBackend__Dispose() {
        if (Na__ProjectedLinework__WebGpuBackend__Renderer) {
            try {
                Na__ProjectedLinework__WebGpuBackend__Renderer.dispose();
            } catch (disposeError) {
                console.warn('[TrueVision3D ProjectedLinework] WebGPU renderer would not release cleanly:', disposeError);
            }
        }

        Na__ProjectedLinework__WebGpuBackend__Renderer   =  null;
        Na__ProjectedLinework__WebGpuBackend__Generator  =  null;
        Na__ProjectedLinework__WebGpuBackend__Loading    =  null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Projection
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Wrap a Stage in the Orientation for One View
    // ------------------------------------------------------------
    // The vendored generator always looks down world +Y, so the model is turned to
    // suit rather than the projection being aimed. The matrix is written directly
    // instead of through position, quaternion and scale: the basis entries are exact
    // integers and decomposing them would introduce floating point dust into what is
    // a clean quarter turn.
    //
    // This re-parents the staged group, so two of these must never be in flight at
    // once against one stage. The Pipeline runs GPU views one at a time for exactly
    // this reason.
    function Na__ProjectedLinework__WebGpuBackend__Orient(stage, basis) {
        const oriented  =  new THREE.Group();
        oriented.name   =  'Na__ProjectedLinework__WebGpuOriented';

        oriented.matrixAutoUpdate  =  false;
        oriented.matrix.makeBasis(
            new THREE.Vector3(basis.XAxisTo[0], basis.XAxisTo[1], basis.XAxisTo[2]),
            new THREE.Vector3(basis.YAxisTo[0], basis.YAxisTo[1], basis.YAxisTo[2]),
            new THREE.Vector3(basis.ZAxisTo[0], basis.ZAxisTo[1], basis.ZAxisTo[2])
        );

        oriented.add(stage);
        oriented.updateMatrixWorld(true);                                     // <-- Nothing renders this, so nothing else refreshes it

        return oriented;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Convert the Generator's Output to Drawing Millimetres
    // ------------------------------------------------------------
    // The generator emits (x, 0, z) triples, consecutive pairs forming a segment.
    // Only x and z carry anything, and both are in stage world units, so one divide
    // returns them to the space the Env2d renderers already work in.
    function Na__ProjectedLinework__WebGpuBackend__ToDrawingSegments(positionArray, scaleDivisor, minimumLengthMm) {
        const minimumLengthSq  =  minimumLengthMm * minimumLengthMm;

        const vertexCount   =  Math.floor(positionArray.length / 3);
        const segmentCount  =  Math.floor(vertexCount / 2);
        const kept          =  new Float32Array(segmentCount * 4);

        let writeIndex  =  0;

        for (let i = 0; i < segmentCount; i++) {
            const a  =  i * 6;
            const b  =  a + 3;

            const x0  =  positionArray[a]     / scaleDivisor;
            const y0  =  positionArray[a + 2] / scaleDivisor;
            const x1  =  positionArray[b]     / scaleDivisor;
            const y1  =  positionArray[b + 2] / scaleDivisor;

            const dx  =  x1 - x0;
            const dy  =  y1 - y0;
            if (((dx * dx) + (dy * dy)) < minimumLengthSq) continue;

            kept[writeIndex++]  =  x0;
            kept[writeIndex++]  =  y0;
            kept[writeIndex++]  =  x1;
            kept[writeIndex++]  =  y1;
        }

        return kept.slice(0, writeIndex);
    }
    // ------------------------------------------------------------


    // FUNCTION | Project One View on the Graphics Card
    // ------------------------------------------------------------
    // Throws if the GPU path is not usable, so the caller can fall through to the
    // CPU backend. It does not swallow that decision itself, because falling back
    // silently would hide a card that has quietly stopped working.
    export async function Na__ProjectedLinework__WebGpuBackend__ProjectView(stage, basis, options, run) {
        const settings  =  run || {};

        const ready  =  await Na__ProjectedLinework__WebGpuBackend__Warm();
        if (!ready) throw new Error('WebGPU backend is not available');

        const generator  =  Na__ProjectedLinework__WebGpuBackend__Generator;
        generator.angleThreshold           =  options.AngleThresholdDegrees;
        generator.includeIntersectionEdges =  options.IncludeIntersectionEdges === true;

        const phases  =  [];
        let   current   =  null;
        let   startedAt =  performance.now();

        // The vendored generator calls this without a guard in one place, so it is
        // always supplied. It doubles as the phase timer.
        const onProgress  =  function(percent, message) {
            if (message === current) return;

            if (current !== null) {
                phases.push({ Phase : current, Ms : Math.round(performance.now() - startedAt) });
            }
            current    =  message;
            startedAt  =  performance.now();

            if (typeof settings.OnPhase === 'function') settings.OnPhase(message);
        };

        const oriented  =  Na__ProjectedLinework__WebGpuBackend__Orient(stage, basis);

        let result;
        try {
            result  =  await generator.generate(oriented, {
                onProgress : onProgress,
                signal     : settings.AbortSignal
            });
        } finally {
            // Hand the stage back so the next view, or the CPU backend, finds it
            // where it expects. The orientation wrapper is disposable.
            oriented.remove(stage);
        }

        if (current !== null) {
            phases.push({ Phase : current, Ms : Math.round(performance.now() - startedAt) });
        }

        const geometry  =  result.visibleEdges.getLineGeometry();
        const position  =  geometry.attributes ? geometry.attributes.position : null;

        return {
            Segments : position
                ? Na__ProjectedLinework__WebGpuBackend__ToDrawingSegments(
                    position.array, options.ScaleDivisor, options.MinimumSegmentLengthMm
                  )
                : new Float32Array(0),
            Phases   : phases
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
