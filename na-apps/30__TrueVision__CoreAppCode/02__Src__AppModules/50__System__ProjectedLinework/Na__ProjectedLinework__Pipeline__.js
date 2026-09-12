// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - PIPELINE
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Pipeline__.js
// NAMESPACE  : Na__PlPipe
// MODULE     : Projected Linework - Pipeline
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Project the drawing on screen when it needs it, share the result, and paint it in
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The single public entry point of the module. It watches the drawing
//   systems, works out what the drawing on screen needs, finds it in the
//   result cache, in a baked asset, or by computing it, and paints it through
//   the SVG overlay. Nothing is projected unless a drawing is on screen and
//   its record asks for projected linework.
//
// - THE FOUR THINGS THIS FILE GETS RIGHT (the Lantern Designer's list)
//     SHARING      Results are cached by drawing and model state, so the
//                  Layout Editor viewports and the on-screen drawing read
//                  the same numbers.
//     REUSE        The model is read once per state and exclusion rule, and
//                  the lines where solids cut through one another once; a
//                  second drawing pays only for its own cut and clip.
//     SERIALISING  One render at a time. A change arriving mid-render aborts
//                  it rather than finishing a projection of a drawing that
//                  no longer exists.
//     STALENESS    A result is keyed to the fingerprint that produced it.
//                  Change the datum, the bearing, the exclusions or the
//                  model and the overlay clears itself and renders afresh.
//
// - THE REALTIME DEBOUNCE. Dragging a slider changes the cut every frame;
//   each change pushes the start back and the render begins only once the
//   drawing has been still for a moment.
//
// - CEILING. Above the configured triangle count the drawing keeps the
//   composer render alone and reports why, rather than starting minutes of
//   work on a device that cannot finish it.
//
// INTEGRATION:
// - index.html initialises it after the drawing systems; the Dev menu section
//   and the persistence layer drive it; the render loop syncs the overlay.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - A finished render is kept in the browser store as well as in memory.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Views, Stage, Projector, Overlay, Persistence
    // ------------------------------------------------------------
    import {
        Na__PlCfg__Ready,
        Na__PlCfg__IsEnabled,
        Na__PlCfg__GetRenderSetup,
        Na__PlCfg__GetPerformanceSetup,
        Na__PlCfg__GetLabel
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    import {
        Na__PlView__FromActiveDrawing,
        Na__PlView__CacheKey,
        Na__PlView__Fingerprint
    } from './Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__PlStage__Describe } from './Na__ProjectedLinework__ModelStage__.js';
    import { Na__ProjectedLinework__WebGpuBackend__ProbeHardware } from './Na__ProjectedLinework__WebGpuBackend__.js';
    import {
        Na__PlProjector__BuildOptions,
        Na__PlProjector__Collect,
        Na__PlProjector__Sample,
        Na__PlProjector__PrepareIntersections,
        Na__PlProjector__Project
    } from './Na__ProjectedLinework__Projector__.js';
    import { Na__ProjectedLinework__Scheduler__CreateSlicer } from './Na__ProjectedLinework__Scheduler__.js';
    import {
        Na__PlOverlay__Paint,
        Na__PlOverlay__Clear,
        Na__PlOverlay__SetShown
    } from './Na__ProjectedLinework__SvgOverlay__.js';
    import { Na__PlStore__LoadForDefinition, Na__PlStore__RememberRender } from './Na__ProjectedLinework__Persistence__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Events From the Drawing Systems
    // ------------------------------------------------------------
    import { Na__FpMode__CHANGED_EVENT } from '../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js';
    import { Na__ElevMode__CHANGED_EVENT } from '../45__System__ElevationViews/Na__Elevation__ModeController__.js';
    import { Na__DrawData__CHANGED_EVENT } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Events and Cache Bounds
    // ------------------------------------------------------------
    const Na__PlPipe__CHANGED_EVENT      = 'na-projectedlinework-changed';
    const Na__PlPipe__SECTION_EVENT      = 'na-crosssection-state-changed';
    const Na__PlPipe__VISIBILITY_EVENT   = 'na-model-visibility-changed';
    const Na__PlPipe__MAX_COLLECTIONS    = 2;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status Words (the event detail and the Dev menu)
    // ------------------------------------------------------------
    const Na__PlPipe__STATUS_IDLE     = 'idle';
    const Na__PlPipe__STATUS_WORKING  = 'working';
    const Na__PlPipe__STATUS_READY    = 'ready';
    const Na__PlPipe__STATUS_HIDDEN   = 'hidden';
    const Na__PlPipe__STATUS_TOOLARGE = 'toolarge';
    const Na__PlPipe__STATUS_ERROR    = 'error';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Context, Caches and Render State
    // ------------------------------------------------------------
    let   Na__PlPipe__ModelRoot   = null;
    let   Na__PlPipe__Initialized = false;
    const Na__PlPipe__Results     = new Map();   // <-- cacheKey -> { Classes, Definition, Fingerprint, Source }
    const Na__PlPipe__Collections = new Map();   // <-- collectionKey -> collected model
    let   Na__PlPipe__Working     = false;
    let   Na__PlPipe__Abort       = null;
    let   Na__PlPipe__AutoTimer   = null;
    let   Na__PlPipe__Status      = Na__PlPipe__STATUS_IDLE;
    let   Na__PlPipe__Phase       = '';
    let   Na__PlPipe__CurrentKey  = null;        // <-- The cache key painted on screen (or wanted)
    let   Na__PlPipe__LastReport  = null;
    let   Na__PlPipe__Pending     = new Set();   // <-- Cache keys with an asset fetch in flight
    let   Na__PlPipe__Chain       = Promise.resolve();   // <-- Serialises every projection through one queue
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Status Change
    // ------------------------------------------------------------
    function Na__PlPipe__Dispatch(status, definition, extra) {
        Na__PlPipe__Status = status;
        window.dispatchEvent(new CustomEvent(Na__PlPipe__CHANGED_EVENT, {
            detail : Object.assign({
                status    : status,
                phase     : Na__PlPipe__Phase,
                drawingId : definition ? definition.DrawingId : null,
                viewKey   : definition ? definition.ViewKey : null
            }, extra || {})
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Oldest Entries Beyond a Ceiling
    // ------------------------------------------------------------
    function Na__PlPipe__Bound(cache, maximumEntries) {
        while (cache.size > maximumEntries) cache.delete(cache.keys().next().value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Key the Collection Cache Uses
    // ------------------------------------------------------------
    // Everything that changes which instances are read: the model state, the
    // exclusion list and the occluder rule.
    // ------------------------------------------------------------
    function Na__PlPipe__CollectionKey(definition, modelFingerprint) {
        return modelFingerprint + '|' + definition.ExcludeTokens.join(',') + '|' + (definition.Styles.glassOpaque ? 'g1' : 'g0');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Report What One Drawing Cost
    // ------------------------------------------------------------
    function Na__PlPipe__LogCost(definition, report) {
        if (!Na__PlCfg__GetRenderSetup().logTimings) return;
        console.log(
            '[TrueVision3D ProjectedLinework] ' + definition.ViewKey + ' [' + report.Backend + '] | ' +
            (report.CollectReused ? 'model reused' : (report.TriangleTotal + ' triangles read in ' + report.CollectMs + ' ms')) +
            ' | ' + report.OccluderCount + ' occluders, ' + report.EdgeCount + ' edges' +
            (report.IntersectionCount ? (', ' + report.IntersectionCount + ' cut lines') : '') +
            ' | ' + report.SegmentCount + ' segments in ' + report.ProjectMs + ' ms | total ' + report.TotalMs + ' ms'
        );
        if (report.Phases && report.Phases.length) console.table(report.Phases);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Total Segments Across the Classes
    // ------------------------------------------------------------
    function Na__PlPipe__CountSegments(classes) {
        let total = 0;
        Object.keys(classes).forEach((name) => { total += Math.floor(classes[name].length / 4); });
        return total;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Paint the Drawing on Screen From Cache, or Clear It
    // ------------------------------------------------------------
    // The only place the overlay is written. Linework shows when the feature
    // is on, the record asks for it, and a result exists for exactly the
    // drawing and model state on screen. Anything else clears.
    // ------------------------------------------------------------
    function Na__PlPipe__PaintCurrent() {
        const definition = Na__PlView__FromActiveDrawing();
        if (!definition || !Na__PlCfg__IsEnabled()) {
            Na__PlOverlay__Clear();
            Na__PlPipe__CurrentKey = null;
            return false;
        }

        Na__PlOverlay__SetShown(definition.Styles.projectedLinework);

        const modelFingerprint = Na__PlStage__Describe(Na__PlPipe__ModelRoot).Fingerprint;
        const cacheKey         = Na__PlView__CacheKey(definition, modelFingerprint);
        const entry            = Na__PlPipe__Results.get(cacheKey);
        Na__PlPipe__CurrentKey = cacheKey;

        if (!entry) {
            Na__PlOverlay__Clear();
            return false;
        }

        Na__PlOverlay__Paint(entry.Classes, definition);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Repaint From Cache Without Computing
    // ------------------------------------------------------------
    function Na__PlPipe__Refresh() {
        return Na__PlPipe__PaintCurrent();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get or Build the Collected Model for a Definition
    // ------------------------------------------------------------
    async function Na__PlPipe__GetCollection(definition, modelFingerprint, options, report, onPhase) {
        const key = Na__PlPipe__CollectionKey(definition, modelFingerprint);
        let collected = Na__PlPipe__Collections.get(key);

        if (collected) {
            report.CollectReused = true;
        } else {
            collected = await Na__PlProjector__Collect(Na__PlPipe__ModelRoot, definition, options, onPhase);
            Na__PlPipe__Collections.set(key, collected);
            Na__PlPipe__Bound(Na__PlPipe__Collections, Na__PlPipe__MAX_COLLECTIONS);
            report.CollectMs     = collected.Report.CollectMs;
            report.TriangleTotal = collected.TriangleTotal;
        }

        if (options.NeedsIntersectionEdges && !collected.HasIntersections) {
            const slicer = Na__ProjectedLinework__Scheduler__CreateSlicer(options.YieldEveryMs);
            await Na__PlProjector__PrepareIntersections(collected, options, slicer, onPhase);
        }
        report.IntersectionCount = collected.Report.IntersectionCount;
        return collected;
    }
    // ------------------------------------------------------------


    // FUNCTION | Project One Definition, Returning the Classes (no painting)
    // ------------------------------------------------------------
    // Used by the on-screen render, the bake and the Diff harness. options
    // may be pre-built (the Diff builds two); abortSignal is optional.
    //
    // ONE RENDER AT A TIME. The worker pool keeps a single generation
    // counter and reassigns its message handlers per run, so two projections
    // in flight would steal each other's replies. Every call queues behind
    // the previous one; an abandoned render rejects quickly and the queue
    // moves on.
    // ------------------------------------------------------------
    function Na__PlPipe__RenderDefinition(definition, options, abortSignal, onPhase) {
        const run = Na__PlPipe__Chain.then(() => Na__PlPipe__RenderDefinitionNow(definition, options, abortSignal, onPhase));
        Na__PlPipe__Chain = run.catch(() => {});                                 // <-- A failure never blocks the next render
        return run;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Render Itself, Once the Queue Reaches It
    // ------------------------------------------------------------
    async function Na__PlPipe__RenderDefinitionNow(definition, options, abortSignal, onPhase) {
        const startedAt = performance.now();
        const described = Na__PlStage__Describe(Na__PlPipe__ModelRoot);
        const settings  = options || Na__PlProjector__BuildOptions(definition);
        const report    = {
            Backend : settings.Backend, CollectReused : false, CollectMs : 0, TriangleTotal : described.TriangleTotal,
            IntersectionCount : 0, OccluderCount : 0, EdgeCount : 0, SegmentCount : 0, ProjectMs : 0, TotalMs : 0, Phases : []
        };

        if (described.TriangleTotal > settings.MaxTriangles) {
            const error = new Error(Na__PlCfg__GetLabel('TooManyTrianglesMessage', 'Model too large for exact linework on this device.'));
            error.name  = 'TooLargeError';
            throw error;
        }

        const signal = abortSignal || new AbortController().signal;
        if (signal.aborted) throw new DOMException('Projection aborted', 'AbortError');

        const collected = await Na__PlPipe__GetCollection(definition, described.Fingerprint, settings, report, onPhase);
        if (signal.aborted) throw new DOMException('Projection aborted', 'AbortError');

        const sampled = Na__PlProjector__Sample(collected, definition, onPhase);
        if (signal.aborted) throw new DOMException('Projection aborted', 'AbortError');

        const projectedAt = performance.now();
        const projection  = await Na__PlProjector__Project(collected, sampled, definition, settings, { AbortSignal : signal, OnPhase : onPhase });

        report.ProjectMs     = Math.round(performance.now() - projectedAt);
        report.TotalMs       = Math.round(performance.now() - startedAt);
        report.Phases        = projection.Phases;
        report.OccluderCount = projection.OccluderCount;
        report.EdgeCount     = projection.EdgeCount;
        report.SegmentCount  = Na__PlPipe__CountSegments(projection.Classes);

        return {
            Classes          : projection.Classes,
            Report           : report,
            ModelFingerprint : described.Fingerprint,
            Fingerprint      : Na__PlView__Fingerprint(definition, described.Fingerprint),
            CacheKey         : Na__PlView__CacheKey(definition, described.Fingerprint)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Result Into the Cache (a render, a fetched asset, the browser)
    // ------------------------------------------------------------
    function Na__PlPipe__Remember(cacheKey, definition, classes, fingerprint, source) {
        Na__PlPipe__Results.set(cacheKey, { Classes : classes, Definition : definition, Fingerprint : fingerprint, Source : source });
        Na__PlPipe__Bound(Na__PlPipe__Results, Na__PlCfg__GetPerformanceSetup().maxCachedResults);
    }
    // ------------------------------------------------------------


    // FUNCTION | Render the Drawing on Screen and Paint It
    // ------------------------------------------------------------
    async function Na__PlPipe__RenderCurrent() {
        await Na__PlCfg__Ready();
        if (!Na__PlCfg__IsEnabled()) return false;

        const definition = Na__PlView__FromActiveDrawing();
        if (!definition) return false;
        if (Na__PlPipe__Working) Na__PlPipe__Cancel();                           // <-- The newer request wins; the older rejects and the queue moves on

        const modelFingerprint = Na__PlStage__Describe(Na__PlPipe__ModelRoot).Fingerprint;
        const cacheKey         = Na__PlView__CacheKey(definition, modelFingerprint);
        if (Na__PlPipe__Results.has(cacheKey)) {
            Na__PlPipe__PaintCurrent();
            Na__PlPipe__Dispatch(Na__PlPipe__STATUS_READY, definition, { cacheKey : cacheKey });
            return true;
        }

        const abort = new AbortController();
        Na__PlPipe__Working = true;
        Na__PlPipe__Abort   = abort;
        Na__PlPipe__Phase   = '';
        Na__PlPipe__Dispatch(Na__PlPipe__STATUS_WORKING, definition);

        const onPhase = (phase) => {
            Na__PlPipe__Phase = phase || '';
            Na__PlPipe__Dispatch(Na__PlPipe__STATUS_WORKING, definition);
        };

        const settle = () => {
            if (Na__PlPipe__Abort !== abort) return;                             // <-- A newer request already owns the flags
            Na__PlPipe__Working = false;
            Na__PlPipe__Abort   = null;
            Na__PlPipe__Phase   = '';
        };

        try {
            const result = await Na__PlPipe__RenderDefinition(definition, null, abort.signal, onPhase);
            Na__PlPipe__LastReport = result.Report;
            Na__PlPipe__LogCost(definition, result.Report);
            Na__PlPipe__Remember(result.CacheKey, definition, result.Classes, result.Fingerprint, 'render');
            void Na__PlStore__RememberRender(definition, result);                 // <-- A reload paints from IndexedDB
            settle();
            Na__PlPipe__PaintCurrent();
            Na__PlPipe__Dispatch(Na__PlPipe__STATUS_READY, definition, { cacheKey : result.CacheKey, report : result.Report });
            return true;
        } catch (error) {
            settle();
            if (error && error.name === 'AbortError') {
                Na__PlPipe__Dispatch(Na__PlPipe__STATUS_IDLE, definition);      // <-- Superseded by a newer change, which is normal
                return false;
            }
            if (error && error.name === 'TooLargeError') {
                console.warn('[TrueVision3D ProjectedLinework] ' + error.message);
                Na__PlPipe__Dispatch(Na__PlPipe__STATUS_TOOLARGE, definition, { message : error.message });
                return false;
            }
            console.error('[TrueVision3D ProjectedLinework] Render failed:', error);
            Na__PlPipe__Dispatch(Na__PlPipe__STATUS_ERROR, definition, { message : String(error && error.message || error) });
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop a Render in Progress
    // ------------------------------------------------------------
    function Na__PlPipe__Cancel() {
        if (Na__PlPipe__Abort) Na__PlPipe__Abort.abort();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Drawing Up To Date Without Being Asked
    // ------------------------------------------------------------
    // Each change pushes the start back; a change mid-render aborts it.
    // ------------------------------------------------------------
    function Na__PlPipe__ScheduleAuto() {
        const render = Na__PlCfg__GetRenderSetup();
        if (!render.realtime) return;

        if (Na__PlPipe__AutoTimer !== null) window.clearTimeout(Na__PlPipe__AutoTimer);
        if (Na__PlPipe__Working) Na__PlPipe__Cancel();

        Na__PlPipe__AutoTimer = window.setTimeout(() => {
            Na__PlPipe__AutoTimer = null;
            void Na__PlPipe__RenderCurrent();
        }, render.realtimeDebounceMs);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Evaluation (what the drawing on screen needs)
// -----------------------------------------------------------------------------

    // FUNCTION | Decide What To Do for the Drawing on Screen
    // ------------------------------------------------------------
    // Cache first, then a baked asset (browser cache or R2), then a render.
    // Runs on every drawing system event and is cheap when nothing is owed.
    // ------------------------------------------------------------
    function Na__PlPipe__Evaluate() {
        if (!Na__PlPipe__Initialized) return;

        void (async () => {
            await Na__PlCfg__Ready();

            const definition = Na__PlView__FromActiveDrawing();
            if (!definition || !Na__PlCfg__IsEnabled()) {
                Na__PlPipe__Cancel();
                Na__PlOverlay__Clear();
                Na__PlPipe__CurrentKey = null;
                Na__PlPipe__Dispatch(Na__PlPipe__STATUS_IDLE, null);
                return;
            }

            if (!definition.Styles.projectedLinework) {
                Na__PlOverlay__SetShown(false);
                Na__PlPipe__Dispatch(Na__PlPipe__STATUS_HIDDEN, definition);
                return;
            }

            const modelFingerprint = Na__PlStage__Describe(Na__PlPipe__ModelRoot).Fingerprint;
            const cacheKey         = Na__PlView__CacheKey(definition, modelFingerprint);

            if (Na__PlPipe__Results.has(cacheKey)) {
                Na__PlPipe__PaintCurrent();
                Na__PlPipe__Dispatch(Na__PlPipe__STATUS_READY, definition, { cacheKey : cacheKey });
                return;
            }

            Na__PlPipe__PaintCurrent();                                          // <-- Clears any stale linework at once

            // A baked asset for exactly this state? Fetched once per key.
            if (!Na__PlPipe__Pending.has(cacheKey)) {
                Na__PlPipe__Pending.add(cacheKey);
                const fingerprint = Na__PlView__Fingerprint(definition, modelFingerprint);
                let classes = null;
                try {
                    classes = await Na__PlStore__LoadForDefinition(definition, fingerprint, cacheKey);
                } catch (loadError) {
                    console.warn('[TrueVision3D ProjectedLinework] Stored linework unavailable:', loadError);
                }
                Na__PlPipe__Pending.delete(cacheKey);

                if (classes) {
                    Na__PlPipe__Remember(cacheKey, definition, classes, fingerprint, 'asset');
                    if (Na__PlPipe__CurrentKey === cacheKey) {
                        Na__PlPipe__PaintCurrent();
                        Na__PlPipe__Dispatch(Na__PlPipe__STATUS_READY, definition, { cacheKey : cacheKey });
                    }
                    return;
                }
            }

            Na__PlPipe__ScheduleAuto();
        })().catch((evaluateError) => {
            console.error('[TrueVision3D ProjectedLinework] Evaluate failed:', evaluateError);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Control, Status and Caches
// -----------------------------------------------------------------------------

    // FUNCTION | Render Whatever the Drawing on Screen Is Missing, Now
    // ------------------------------------------------------------
    function Na__PlPipe__ForceRender() {
        if (Na__PlPipe__AutoTimer !== null) { window.clearTimeout(Na__PlPipe__AutoTimer); Na__PlPipe__AutoTimer = null; }
        return Na__PlPipe__RenderCurrent();
    }
    // ------------------------------------------------------------


    // FUNCTION | Throw Away Every Result and Collection
    // ------------------------------------------------------------
    function Na__PlPipe__ClearCache() {
        Na__PlPipe__Results.clear();
        Na__PlPipe__Collections.clear();
        Na__PlPipe__PaintCurrent();
        Na__PlPipe__Evaluate();
        console.log('[TrueVision3D ProjectedLinework] Caches cleared.');
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Cached Result by Definition and Model State (null when absent)
    // ------------------------------------------------------------
    function Na__PlPipe__GetCached(definition) {
        const modelFingerprint = Na__PlStage__Describe(Na__PlPipe__ModelRoot).Fingerprint;
        const entry = Na__PlPipe__Results.get(Na__PlView__CacheKey(definition, modelFingerprint));
        return entry ? entry.Classes : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Fingerprint of the Model as the Projection Sees It Now
    // ------------------------------------------------------------
    function Na__PlPipe__GetModelFingerprint() {
        return Na__PlStage__Describe(Na__PlPipe__ModelRoot).Fingerprint;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Dev Menu Should Say
    // ------------------------------------------------------------
    function Na__PlPipe__GetStatus() {
        const definition = Na__PlView__FromActiveDrawing();
        return {
            isEnabled   : Na__PlCfg__IsEnabled(),
            isWorking   : Na__PlPipe__Working,
            status      : Na__PlPipe__Status,
            phase       : Na__PlPipe__Phase,
            drawingId   : definition ? definition.DrawingId : null,
            drawingName : definition ? definition.DrawingName : null,
            cached      : Na__PlPipe__CurrentKey ? Na__PlPipe__Results.has(Na__PlPipe__CurrentKey) : false,
            results     : Na__PlPipe__Results.size,
            collections : Na__PlPipe__Collections.size,
            lastReport  : Na__PlPipe__LastReport
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Definition and Classes Painted on Screen (null when none)
    // ------------------------------------------------------------
    function Na__PlPipe__GetPainted() {
        if (!Na__PlPipe__CurrentKey) return null;
        const entry = Na__PlPipe__Results.get(Na__PlPipe__CurrentKey);
        if (!entry) return null;
        return { Definition : entry.Definition, Classes : entry.Classes };
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Pipeline at a Different Model Root
    // ------------------------------------------------------------
    function Na__PlPipe__SetModelRoot(modelRoot) {
        Na__PlPipe__ModelRoot = modelRoot || null;
        Na__PlPipe__Collections.clear();
        Na__PlPipe__Evaluate();
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Pipeline
    // ------------------------------------------------------------
    // context: { modelRoot }
    // ------------------------------------------------------------
    function Na__PlPipe__Initialize(context) {
        Na__PlPipe__ModelRoot   = (context && context.modelRoot) || null;
        Na__PlPipe__Initialized = true;

        const reevaluate = () => Na__PlPipe__Evaluate();
        window.addEventListener(Na__FpMode__CHANGED_EVENT,      reevaluate);   // <-- Enter, flip, leave, style change
        window.addEventListener(Na__ElevMode__CHANGED_EVENT,    reevaluate);
        window.addEventListener(Na__DrawData__CHANGED_EVENT,    reevaluate);   // <-- Project switch replaces the records
        window.addEventListener(Na__PlPipe__SECTION_EVENT,      reevaluate);   // <-- Slider commit moved the cut
        window.addEventListener(Na__PlPipe__VISIBILITY_EVENT,   reevaluate);   // <-- A category toggled
        window.addEventListener('na-render-engine-changed',     reevaluate);

        // HARDWARE PROBE | Started at boot, deliberately, and not awaited.
        // The backend resolver reads the cached answer synchronously on every
        // render, and answers "no GPU" until the probe lands. Starting it here
        // means that window is the first second of a session rather than the
        // first drawing somebody opens - and because it is not awaited, a machine
        // where the adapter request hangs still boots at the normal speed and
        // simply uses the CPU.
        void Na__ProjectedLinework__WebGpuBackend__ProbeHardware().then((probe) => {
            console.log('[TrueVision3D ProjectedLinework] Graphics probe: '
                + (probe.Capable ? 'hardware adapter granted' : 'no usable GPU')
                + (probe.Adapter ? ' [' + [probe.Adapter.Vendor, probe.Adapter.Architecture].filter(Boolean).join(' ') + ']' : '')
                + ' - ' + probe.Reason);
        });

        void Na__PlCfg__Ready().then(() => {
            console.log('[TrueVision3D ProjectedLinework] Loaded, enabled: ' + Na__PlCfg__IsEnabled() + '.');
            Na__PlPipe__Evaluate();
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Pipeline API
    // ------------------------------------------------------------
    export {
        Na__PlPipe__CHANGED_EVENT,
        Na__PlPipe__STATUS_IDLE,
        Na__PlPipe__STATUS_WORKING,
        Na__PlPipe__STATUS_READY,
        Na__PlPipe__STATUS_HIDDEN,
        Na__PlPipe__STATUS_TOOLARGE,
        Na__PlPipe__STATUS_ERROR,
        Na__PlPipe__Initialize,
        Na__PlPipe__SetModelRoot,
        Na__PlPipe__Evaluate,
        Na__PlPipe__Refresh,
        Na__PlPipe__ForceRender,
        Na__PlPipe__RenderDefinition,
        Na__PlPipe__Remember,
        Na__PlPipe__Cancel,
        Na__PlPipe__ClearCache,
        Na__PlPipe__GetCached,
        Na__PlPipe__GetModelFingerprint,
        Na__PlPipe__GetStatus,
        Na__PlPipe__GetPainted
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
