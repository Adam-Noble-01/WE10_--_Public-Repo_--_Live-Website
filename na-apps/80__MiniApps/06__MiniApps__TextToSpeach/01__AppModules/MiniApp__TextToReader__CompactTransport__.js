// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - CONTEXT-AWARE COMPACT TRANSPORT
// =============================================================================
//
// PURPOSE : Keep the existing playback buttons visible as readers scroll.
//           After a guarded scroll threshold, reduce the fixed header and
//           centre the SAME speed / stop / play controls in the sticky toolbar.
//           The full section-seek transport stays in the document at the top.
//           No cloned buttons, duplicate listeners, or playback state changes.
//
// =============================================================================


// REGION | State
// --------------------------------------------------------
let Na__Compact__Scroller = null;
let Na__Compact__Toolbar = null;
let Na__Compact__Controls = null;
let Na__Compact__Output = null;
let Na__Compact__Animation = null;
let Na__Compact__Frame = 0;
let Na__Compact__ReducedMotion = null;
// endregion -------------------------------------------------------------------


// REGION | Helpers
// --------------------------------------------------------

// FUNCTION | CanCompact - Only an actual, scrollable reading document
// --------------------------------------------------------
function Na__Compact__CanCompact() {
    return document.body.dataset.ttrMode === "read" &&
        Boolean(Na__Compact__Output?.textContent.trim()) &&
        Na__Compact__Scroller.scrollHeight > Na__Compact__Scroller.clientHeight + 80;
}
// --------------------------------------------------------


// FUNCTION | Transition - Shift the existing controls horizontally with FLIP
// --------------------------------------------------------
function Na__Compact__Transition(Na__Compact) {
    const Na__IsCompact = document.body.classList.contains("TTR__compact-reader");
    if (Na__Compact === Na__IsCompact) return;

    // The existing buttons retain their event handlers and the playing audio.
    // Only the layout changes, and the header's height animates independently.
    Na__Compact__Animation?.cancel();
    const Na__Before = Na__Compact__Controls.getBoundingClientRect();
    document.body.classList.toggle("TTR__compact-reader", Na__Compact);
    const Na__After = Na__Compact__Controls.getBoundingClientRect();

    // Move from the right-aligned controls to the centred cluster (and back).
    // Do not animate vertical translation: the collapsible header performs that
    // movement, and a second vertical transform would cause an overshoot.
    const Na__Dx = Na__Before.left + Na__Before.width / 2 -
        (Na__After.left + Na__After.width / 2);
    if (!Na__Compact__ReducedMotion.matches && Math.abs(Na__Dx) > 1 &&
        typeof Na__Compact__Controls.animate === "function") {
        Na__Compact__Animation = Na__Compact__Controls.animate(
            [{ transform: `translateX(${Na__Dx}px)` }, { transform: "translateX(0)" }],
            { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
        Na__Compact__Animation.addEventListener("finish", () => {
            Na__Compact__Animation = null;
        }, { once: true });
    }
}
// --------------------------------------------------------


// FUNCTION | Update - Hysteresis prevents flip-flopping during small swipes
// --------------------------------------------------------
function Na__Compact__Update() {
    Na__Compact__Frame = 0;
    if (!Na__Compact__Scroller) return;
    if (!Na__Compact__CanCompact()) {
        Na__Compact__Transition(false);
        return;
    }

    const Na__Enter = Math.max(140, Math.min(220, Na__Compact__Scroller.clientHeight * 0.28));
    const Na__Exit = Math.max(55, Na__Enter * 0.40);
    const Na__IsCompact = document.body.classList.contains("TTR__compact-reader");
    const Na__ScrollTop = Na__Compact__Scroller.scrollTop;

    if (!Na__IsCompact && Na__ScrollTop >= Na__Enter) Na__Compact__Transition(true);
    else if (Na__IsCompact && Na__ScrollTop <= Na__Exit) Na__Compact__Transition(false);
}
// --------------------------------------------------------


// FUNCTION | QueueUpdate - Only inspect layout once per animation frame
// --------------------------------------------------------
function Na__Compact__QueueUpdate() {
    if (!Na__Compact__Frame) Na__Compact__Frame = requestAnimationFrame(Na__Compact__Update);
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Public
// --------------------------------------------------------

// FUNCTION | ResetCompactTransport - A new document or Edit restores the full bar
// --------------------------------------------------------
export function Na__TextToReader__ResetCompactTransport() {
    if (!Na__Compact__Scroller) return;
    Na__Compact__Animation?.cancel();
    Na__Compact__Animation = null;
    Na__Compact__Scroller.scrollTop = 0;
    document.body.classList.remove("TTR__compact-reader");
    Na__Compact__QueueUpdate();
}
// --------------------------------------------------------


// FUNCTION | InitialiseCompactTransport - Watch the app's actual scroll owner
// --------------------------------------------------------
export function Na__TextToReader__InitialiseCompactTransport() {
    Na__Compact__Scroller = document.querySelector(".FULL__page-app-container");
    Na__Compact__Toolbar = document.querySelector(".TTR__toolbar");
    Na__Compact__Controls = document.getElementById("js__readAloudPanel");
    Na__Compact__Output = document.getElementById("js__output");
    Na__Compact__ReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!Na__Compact__Scroller || !Na__Compact__Toolbar ||
        !Na__Compact__Controls || !Na__Compact__Output) {
        console.warn("Text To Reader: compact transport layout unavailable.");
        return;
    }
    Na__Compact__Scroller.addEventListener("scroll", Na__Compact__QueueUpdate, { passive: true });
    window.addEventListener("resize", Na__Compact__QueueUpdate, { passive: true });
    Na__Compact__ReducedMotion.addEventListener?.("change", Na__Compact__QueueUpdate);
    Na__Compact__QueueUpdate();
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
