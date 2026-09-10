// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - CLIP WORKER
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ClipWorker__.js
// NAMESPACE  : Na__ProjectedLinework__ClipWorker
// MODULE     : Projected Linework - Clip Worker
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Run the clip kernel on a slice of the edge list, off the main thread
// CREATED    : 07-Aug-2026
//
// DESCRIPTION:
// - The worker entry point. It holds one view's occluders, then answers requests to
//   clip a range of that view's edges.
// - Deliberately thin. Everything it knows how to do lives in the clip kernel, so
//   the same code path is exercised whether the projection runs across a pool of
//   workers or inline on the main thread when workers are unavailable.
//
// ---------------------------------------------------------------------------
//
// WHY THERE IS NO BUILD STEP HERE
//
// Import maps are scoped to the document, so a module worker cannot resolve the
// bare specifiers ('three', 'three-mesh-bvh') that the vendored libraries use
// internally. The usual answer is a bundler, which this application does not have
// and does not want.
//
// The answer taken instead is to have nothing to resolve. This file imports one
// module by relative path, that module imports one more, and neither of them
// imports anything else at all - no three.js, no BVH library, no application
// plumbing. The browser loads three plain files and the worker starts.
//
// That constraint is the reason the clip kernel takes typed arrays rather than
// meshes, and it is worth preserving. Adding an import of anything that reaches
// three.js to this file, or to either module beneath it, breaks the worker path
// silently on every browser.
//
// ---------------------------------------------------------------------------
//
// PROTOCOL
//
// Two messages in, two messages out. The load is sent once per view and the clip
// requests that follow are a few numbers each, so a worker can be handed many
// small slices for balance without the occluders being copied again.
//
//     IN   { Type : 'Load', Generation, Soup, Edges, Options }
//     OUT  { Type : 'Ready', Generation }
//
//     IN   { Type : 'Clip', Generation, JobId, EdgeStart, EdgeEnd }
//     OUT  { Type : 'Done', Generation, JobId, Segments, PairsTested }
//     OUT  { Type : 'Failed', Generation, JobId, Message }
//
// Generation is the pool's run counter. A message carrying a stale generation is
// answered but ignored by the pool, which is what lets a cancelled render's
// in-flight work drain harmlessly rather than having to be killed.
//
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ClipWorker__.js
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
//   The body is kept as the Lantern Designer wrote it apart from the
//   divergences above, so the kernel stays diff-able against its source.
//
// =============================================================================


import { Na__ProjectedLinework__ClipKernel__Clip } from './Na__ProjectedLinework__ClipKernel__.js';

// =============================================================================
// REGION | Projected Edges Clip Worker
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Worker State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The View This Worker Is Currently Loaded With
    // ------------------------------------------------------------
    let Na__ProjectedLinework__ClipWorker__Soup        =  null;
    let Na__ProjectedLinework__ClipWorker__Edges       =  null;
    let Na__ProjectedLinework__ClipWorker__Options     =  null;
    let Na__ProjectedLinework__ClipWorker__Generation  =  -1;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Message Handling
// -----------------------------------------------------------------------------

    // FUNCTION | Answer One Message From the Pool
    // ------------------------------------------------------------
    self.onmessage  =  function(event) {
        const message  =  event.data;
        if (!message) return;

        if (message.Type === 'Load') {
            Na__ProjectedLinework__ClipWorker__Soup        =  message.Soup;
            Na__ProjectedLinework__ClipWorker__Edges       =  message.Edges;
            Na__ProjectedLinework__ClipWorker__Options     =  message.Options;
            Na__ProjectedLinework__ClipWorker__Generation  =  message.Generation;

            self.postMessage({ Type : 'Ready', Generation : message.Generation });
            return;
        }

        if (message.Type !== 'Clip') return;

        // A clip request for a view this worker no longer holds. Answering with an
        // empty result rather than staying silent keeps the pool's bookkeeping
        // simple: every request it issues gets exactly one reply.
        if (message.Generation !== Na__ProjectedLinework__ClipWorker__Generation ||
            !Na__ProjectedLinework__ClipWorker__Soup) {

            const spent  =  new Float32Array(0);
            self.postMessage(
                {
                    Type           : 'Done',
                    Generation     : message.Generation,
                    JobId          : message.JobId,
                    Segments       : spent,
                    HiddenSegments : null,
                    PairsTested    : 0
                },
                [ spent.buffer ]
            );
            return;
        }

        try {
            const result  =  Na__ProjectedLinework__ClipKernel__Clip(
                Na__ProjectedLinework__ClipWorker__Soup,
                Na__ProjectedLinework__ClipWorker__Edges,
                message.EdgeStart,
                message.EdgeEnd,
                Na__ProjectedLinework__ClipWorker__Options
            );

            self.postMessage(
                {
                    Type           : 'Done',
                    Generation     : message.Generation,
                    JobId          : message.JobId,
                    Segments       : result.Segments,
                    HiddenSegments : result.HiddenSegments,                   // <-- Null unless IncludeHiddenEdges was asked for (TrueVision addition)
                    PairsTested    : result.PairsTested
                },
                result.HiddenSegments
                    ? [ result.Segments.buffer, result.HiddenSegments.buffer ]
                    : [ result.Segments.buffer ]                              // <-- Handed over rather than copied; this worker will not touch it again
            );
        } catch (clipError) {
            self.postMessage({
                Type       : 'Failed',
                Generation : message.Generation,
                JobId      : message.JobId,
                Message    : (clipError && clipError.message) ? clipError.message : String(clipError)
            });
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------
