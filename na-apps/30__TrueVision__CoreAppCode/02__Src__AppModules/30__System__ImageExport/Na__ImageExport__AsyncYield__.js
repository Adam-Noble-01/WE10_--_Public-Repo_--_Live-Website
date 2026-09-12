// =============================================================================
// TRUEVISION3D - IMAGE EXPORT - ASYNC YIELD HELPERS
// =============================================================================
//
// FILE       : Na__ImageExport__AsyncYield__.js
// NAMESPACE  : Na__ExportYield
// MODULE     : Image Export - Async Yield Helpers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Yield to the event loop between export work units without
//              deadlocking when the tab is hidden
// CREATED    : 12-Sep-2026
//
// DESCRIPTION:
// - The tiled export renderer and the strip-based post-process effects yield
//   between work units so the overlay animates and the GPU drains. A naive
//   requestAnimationFrame yield DEADLOCKS the export if the tab is hidden
//   (backgrounded window, user switches apps mid-export) because rAF never
//   fires in hidden tabs.
// - These helpers race rAF against fallbacks so exports always make progress:
//   - Visible tab : double-rAF (guarantees a paint between work units)
//   - Hidden tab  : MessageChannel macrotask (NOT timer-throttled, unlike
//                   setTimeout which is clamped to 1s+ in background tabs)
//   - Transition  : a setTimeout safety net covers a tab hidden mid-await
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 30__System__ImageExport/Na__ImageExport__AsyncYield__.js
// - Ported on     : 12-Sep-2026 for TrueVision3D v2.25.0
// - Parity        : verbatim
// - Divergences   : File header block only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 12-Sep-2026 - Version 1.0.0
// - Ported for the ValeVision-style tiled exporter.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Image Export - Async Yield Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Yield One Macrotask via MessageChannel
    // ------------------------------------------------------------
    function Na__ExportYield__MessageTask() {
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();   // <-- Fires next macrotask, even in hidden tabs
            channel.port2.postMessage(0);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Wait for the Next Painted Frame (Hidden-Tab Safe)
    // ------------------------------------------------------------
    // Visible: double-rAF so the browser paints (overlay status text,
    // spinner) between heavy work units. Hidden: immediate macrotask
    // yield. A timeout safety net prevents a deadlock when the tab is
    // hidden after the rAF was requested.
    // ------------------------------------------------------------
    function Na__ExportYield__NextPaint() {
        if (document.hidden) {
            return Na__ExportYield__MessageTask();       // <-- No paint possible; just breathe
        }
        return new Promise((resolve) => {
            let settled = false;
            const done = () => { if (!settled) { settled = true; resolve(); } };
            requestAnimationFrame(() => requestAnimationFrame(done));   // <-- Normal path: paint in between
            setTimeout(done, 250);                                      // <-- Safety net: tab hidden mid-await
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Light Yield Between Processing Strips (Hidden-Tab Safe)
    // ------------------------------------------------------------
    // Cheaper than NextPaint - used between pixel-processing strips
    // where responsiveness matters but a guaranteed paint does not.
    // ------------------------------------------------------------
    function Na__ExportYield__NextTick() {
        if (document.hidden) {
            return Na__ExportYield__MessageTask();       // <-- Unthrottled progress in background tabs
        }
        return new Promise((resolve) => {
            let settled = false;
            const done = () => { if (!settled) { settled = true; resolve(); } };
            requestAnimationFrame(done);                 // <-- Single rAF lets input/paint interleave
            setTimeout(done, 100);                       // <-- Safety net: tab hidden mid-await
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Async Yield API
    // ------------------------------------------------------------
    export {
        Na__ExportYield__NextPaint,
        Na__ExportYield__NextTick
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
