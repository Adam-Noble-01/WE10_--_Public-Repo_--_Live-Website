// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - SCHEDULER
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Scheduler__.js
// NAMESPACE  : Na__ProjectedLinework__Scheduler
// MODULE     : Projected Linework - Scheduler
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Run long synchronous work without freezing the interface
// CREATED    : 06-Aug-2026
//
// DESCRIPTION:
// - Drives three-edge-projection's generators, and this module's own BVH build
//   loop, on a time slice of our choosing rather than the library's.
// - Exists because of one specific and costly detail in the vendor code.
//
// ---------------------------------------------------------------------------
//
// THE COST THIS FILE REMOVES
//
// three-edge-projection ships an async wrapper that reads:
//
//     while ( ! res || ! res.done ) {
//         res = task.next();
//         await nextFrame();
//     }
//
// Its generators yield roughly every iterationTime milliseconds - 30 by default -
// and nextFrame waits for a full animation frame, about 16 milliseconds. So the
// loop spends 30 working, 16 waiting, 30 working, 16 waiting. Around a THIRD of
// the elapsed time is the projection sitting still.
//
// That trade buys responsiveness, and on a small model it is the right call. On a
// full lantern with glazing and finials it is simply thrown away time.
//
// This module drives the same generators itself and hands the browser a frame only
// every YieldEveryMs. Raising it goes faster and feels chunkier in exact
// proportion; the number is in Na__ProjectedEdges__Config.json precisely so that
// trade stays visible.
//
// ---------------------------------------------------------------------------
//
// WHY THE BUDGET WAS LOWERED FROM 250 TO 64
//
// The original 250 was right for what this was: a projection the user pressed a
// button for and then waited half a minute for, where throughput was everything and
// a quarter-second stutter cost nothing anybody would notice.
//
// Rendering is now realtime, and the budget governs something else entirely - how
// long an ABANDONED render takes to notice it has been abandoned. Every edit
// cancels the work in flight, but the cancel is only seen at a yield point, so a
// 250 budget meant up to a quarter of a second of computing a shape the user had
// already moved on from, while the interface sat still.
//
// At 64 the loop still runs around 80 percent of the time rather than 94, so the
// arithmetic is genuinely a little slower. It buys a drawing that keeps up with the
// hand editing it, which is now the thing worth optimising for.
//
// ---------------------------------------------------------------------------
//
// PUBLIC API:
//     NextFrame()                              -> Promise, one animation frame
//     CreateSlicer(yieldEveryMs)               -> { Tick() }
//     DriveGenerator(task, yieldEveryMs, signal) -> Promise<generator return value>
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__Scheduler__.js
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


// =============================================================================
// REGION | Projected Edges Scheduler Module
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Frame Yielding
// -----------------------------------------------------------------------------

    // FUNCTION | Wait One Animation Frame, With a Timer Fallback
    // ------------------------------------------------------------
    // Races requestAnimationFrame against a timeout, mirroring the vendor's own
    // helper. The fallback matters: the drawing sheet bake runs against an
    // off-canvas host and a background tab stops serving animation frames
    // altogether, which would hang a projection indefinitely on rAF alone.
    export function Na__ProjectedLinework__Scheduler__NextFrame() {
        return new Promise(function(resolve) {
            let frameHandle;
            let timerHandle;

            const settle  =  function() {
                cancelAnimationFrame(frameHandle);
                clearTimeout(timerHandle);
                resolve();
            };

            frameHandle  =  requestAnimationFrame(settle);
            timerHandle  =  setTimeout(settle, 16);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Time Slicer That Yields on a Fixed Budget
    // ------------------------------------------------------------
    // Tick resolves immediately on a microtask while inside the budget, and costs a
    // real frame only when the budget is spent. Callers can therefore await it in
    // their innermost loop without thinking about the cadence.
    export function Na__ProjectedLinework__Scheduler__CreateSlicer(yieldEveryMs) {
        const budget  =  (typeof yieldEveryMs === 'number' && yieldEveryMs > 0) ? yieldEveryMs : 250;
        let   lastYieldAt  =  performance.now();

        return {
            Tick : async function() {
                if ((performance.now() - lastYieldAt) < budget) return;

                await Na__ProjectedLinework__Scheduler__NextFrame();
                lastYieldAt  =  performance.now();
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Generator Driving
// -----------------------------------------------------------------------------

    // FUNCTION | Run a Synchronous Generator to Completion on Our Own Time Slice
    // ------------------------------------------------------------
    // The generator still decides where it is safe to pause; this only decides how
    // often a pause is spent on the browser rather than resumed immediately.
    //
    // The abort check sits between iterations, so a superseded projection stops at
    // the next yield point instead of running to completion and being discarded.
    export async function Na__ProjectedLinework__Scheduler__DriveGenerator(task, yieldEveryMs, abortSignal) {
        const slicer  =  Na__ProjectedLinework__Scheduler__CreateSlicer(yieldEveryMs);
        let   step    =  task.next();

        while (!step.done) {
            await slicer.Tick();

            if (abortSignal && abortSignal.aborted) {
                throw new DOMException('Projection aborted', 'AbortError');
            }

            step  =  task.next();
        }

        return step.value;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
