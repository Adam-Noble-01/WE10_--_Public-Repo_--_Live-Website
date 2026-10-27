// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - WORD JUMP AND CONTEXT MENU
// =============================================================================
//
// FILE    : MiniApp__TextToReader__WordJump__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Jump playback to a word's sentence, and the custom right-click menu
// CREATED : 27-Oct-2026
//
// GESTURES (only while prepared audio exists):
//   Mouse : double-click a word  -> play from the start of its sentence
//   Touch : long-press a word    -> the same
// MENU  : right-click anywhere but the editor replaces the browser's menu:
//         Play From Here, Play / Pause, Play From Start, Read Selection, Copy, Stop.
//         Play From Here before any audio exists prepares the article first.
//         With sectioned reading on, Prepare & Play This Section takes the place of
//         Read Selection: it reads on from the section holding the selection (or the word).
//
// The read-aloud controls are driven through their own buttons, so this module
// needs nothing from ReadAloud__.js beyond the DOM, and one call: Play From Start,
// which in sectioned reading is the start of the document, not of the section
// on the audio element. A word in another section is played through the highlight
// module's outside-jump handler (see Highlight__.js), which ReadAloud__.js sets.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__Highlight__.js
import {
    Na__TextToReader__HasHighlightTimeline,
    Na__TextToReader__PlayFromWord
} from "./MiniApp__TextToReader__Highlight__.js";

// @delegate: ./MiniApp__TextToReader__ReadAloud__.js
import {
    Na__TextToReader__PlayFromStart,
    Na__TextToReader__PlayThisSection
} from "./MiniApp__TextToReader__ReadAloud__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__WordJump__LongPressMs   = 450;   // Just under the browser's own long-press, so ours wins
 const Na__WordJump__MoveTolerance = 10;    // px a finger may drift before the press counts as a scroll

 let Na__WordJump__Nodes          = null;
 let Na__WordJump__PointerType    = "mouse";
 let Na__WordJump__PressTimer     = 0;
 let Na__WordJump__PressStart     = null;
 let Na__WordJump__PressFired     = false;
 let Na__WordJump__MenuWord       = null;
 let Na__WordJump__PendingJump    = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Jumping
// -----------------------------------------------------------------------------

// FUNCTION | The word span under an event target inside the article, or null
// ------------------------------------------------------------
function Na__WordJump__WordAt(Na__Target) {
    const Na__Word = Na__Target instanceof Element ? Na__Target.closest(".TTR__w") : null;
    return Na__Word && Na__WordJump__Nodes.article.contains(Na__Word) ? Na__Word : null;
}
// ------------------------------------------------------------


// FUNCTION | Clear any text selection the gesture made
// ------------------------------------------------------------
function Na__WordJump__ClearSelection() {
    window.getSelection()?.removeAllRanges();
}
// ------------------------------------------------------------


// FUNCTION | Jump within prepared audio, or prepare the whole article and jump when that run ends
// ------------------------------------------------------------
// The pending jump belongs to this one preparation run: Prepare stays disabled while
// it runs, and when it is enabled again the run has ended. New audio then means
// success (jump); none means it failed or was cancelled (forget the jump).
function Na__WordJump__PlayFromHere(Na__Word) {
    if (Na__TextToReader__PlayFromWord(Na__Word)) return;

    const { audio, prepare } = Na__WordJump__Nodes;
    if (prepare.disabled) return;   // Already preparing

    Na__WordJump__PendingJump?.disconnect();
    const Na__SourceBefore = audio.src;

    Na__WordJump__ClearSelection();   // Prepare the whole article, not a stray selection
    prepare.click();
    if (!prepare.disabled) return;    // The run did not start

    Na__WordJump__PendingJump = new MutationObserver(() => {
        if (prepare.disabled) return;
        Na__WordJump__PendingJump.disconnect();
        Na__WordJump__PendingJump = null;
        if (audio.src && audio.src !== Na__SourceBefore) Na__TextToReader__PlayFromWord(Na__Word);
    });
    Na__WordJump__PendingJump.observe(prepare, { attributes: true, attributeFilter: ["disabled"] });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mouse Double-Click And Touch Long-Press
// -----------------------------------------------------------------------------

// FUNCTION | Stop a second click selecting the word when it is about to jump instead
// ------------------------------------------------------------
function Na__WordJump__HandleMouseDown(Na__Event) {
    if (Na__Event.detail < 2 || !Na__TextToReader__HasHighlightTimeline()) return;
    if (Na__WordJump__WordAt(Na__Event.target)) Na__Event.preventDefault();
}
// ------------------------------------------------------------


// FUNCTION | Double-click a word: play from its sentence
// ------------------------------------------------------------
function Na__WordJump__HandleDoubleClick(Na__Event) {
    if (!Na__TextToReader__HasHighlightTimeline()) return;
    const Na__Word = Na__WordJump__WordAt(Na__Event.target);
    if (!Na__Word) return;
    Na__WordJump__ClearSelection();
    Na__TextToReader__PlayFromWord(Na__Word);
}
// ------------------------------------------------------------


// FUNCTION | Cancel a pending long-press
// ------------------------------------------------------------
function Na__WordJump__CancelPress() {
    clearTimeout(Na__WordJump__PressTimer);
    Na__WordJump__PressTimer = 0;
    Na__WordJump__PressStart = null;
}
// ------------------------------------------------------------


// FUNCTION | Fire the long-press jump once, with a short buzz where phones allow it
// ------------------------------------------------------------
function Na__WordJump__FireLongPress(Na__Word) {
    Na__WordJump__CancelPress();
    if (Na__WordJump__PressFired) return;
    Na__WordJump__PressFired = true;
    Na__WordJump__ClearSelection();
    if (Na__TextToReader__PlayFromWord(Na__Word)) navigator.vibrate?.(15);
}
// ------------------------------------------------------------


// FUNCTION | Remember the pointer type; on touch, start timing a long-press on a word
// ------------------------------------------------------------
function Na__WordJump__HandlePointerDown(Na__Event) {
    Na__WordJump__PointerType = Na__Event.pointerType || "mouse";
    if (Na__WordJump__PointerType !== "touch") return;

    Na__WordJump__CancelPress();
    Na__WordJump__PressFired = false;
    if (!Na__TextToReader__HasHighlightTimeline()) return;

    const Na__Word = Na__WordJump__WordAt(Na__Event.target);
    if (!Na__Word) return;

    Na__WordJump__PressStart = { x: Na__Event.clientX, y: Na__Event.clientY, word: Na__Word };
    Na__WordJump__PressTimer = setTimeout(() => Na__WordJump__FireLongPress(Na__Word), Na__WordJump__LongPressMs);
}
// ------------------------------------------------------------


// FUNCTION | A finger that drifts is scrolling, not pressing
// ------------------------------------------------------------
function Na__WordJump__HandlePointerMove(Na__Event) {
    const Na__Start = Na__WordJump__PressStart;
    if (!Na__Start) return;
    if (Math.hypot(Na__Event.clientX - Na__Start.x, Na__Event.clientY - Na__Start.y) > Na__WordJump__MoveTolerance) {
        Na__WordJump__CancelPress();
    }
}
// ------------------------------------------------------------


// FUNCTION | No native selection while a long-press on a word is being timed
// ------------------------------------------------------------
function Na__WordJump__HandleSelectStart(Na__Event) {
    if (Na__WordJump__PressStart || Na__WordJump__PressFired) Na__Event.preventDefault();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Custom Context Menu
// -----------------------------------------------------------------------------

// FUNCTION | Selected text inside the article, or ""
// ------------------------------------------------------------
function Na__WordJump__ArticleSelection() {
    const Na__Selection = window.getSelection();
    if (!Na__Selection || Na__Selection.isCollapsed || !Na__Selection.rangeCount) return "";
    const Na__Container = Na__Selection.getRangeAt(0).commonAncestorContainer;
    return Na__WordJump__Nodes.article.contains(Na__Container) ? Na__Selection.toString().trim() : "";
}
// ------------------------------------------------------------


// FUNCTION | The whole sentence a word belongs to, as text
// ------------------------------------------------------------
function Na__WordJump__SentenceText(Na__Word) {
    const Na__Id = Na__Word?.closest(".TTR__s")?.dataset.s;
    if (Na__Id === undefined) return "";
    return [...Na__WordJump__Nodes.article.querySelectorAll('.TTR__s[data-s="' + Na__Id + '"]')]
        .map((Na__Piece) => Na__Piece.textContent).join("").trim();
}
// ------------------------------------------------------------


// FUNCTION | Set a menu item's label and enabled state
// ------------------------------------------------------------
function Na__WordJump__SetItem(Na__Action, Na__Enabled, Na__Label, Na__Icon) {
    const Na__Item = Na__WordJump__Nodes.menu.querySelector('[data-action="' + Na__Action + '"]');
    Na__Item.disabled = !Na__Enabled;
    if (Na__Label) Na__Item.querySelector(".TTR__menu-label").textContent = Na__Label;
    if (Na__Icon) Na__Item.dataset.icon = Na__Icon;
}
// ------------------------------------------------------------


// FUNCTION | Open the menu at the pointer, kept inside the window
// ------------------------------------------------------------
function Na__WordJump__OpenMenu(Na__X, Na__Y, Na__Word) {
    const { menu, audio, prepare, stop } = Na__WordJump__Nodes;
    const Na__Reading  = document.body.dataset.ttrMode === "read";
    const Na__HasAudio = Na__TextToReader__HasHighlightTimeline();
    const Na__CanPrep  = Na__Reading && !prepare.disabled && Boolean(Na__WordJump__Nodes.article.textContent.trim());
    const Na__Selected = Na__WordJump__ArticleSelection();
    const Na__Sections = document.body.dataset.ttrSections === "on";   // Set by the voice modal's switch

    Na__WordJump__MenuWord = Na__Word;
    Na__WordJump__SetItem("here", Na__Reading && Boolean(Na__Word) && (Na__HasAudio || Na__CanPrep));
    if (Na__HasAudio) {
        Na__WordJump__SetItem("toggle", true, audio.paused ? "Play" : "Pause", audio.paused ? "play" : "pause");
    } else {
        Na__WordJump__SetItem("toggle", Na__CanPrep, Na__Sections ? "Choose Section & Play" : "Prepare & Play", "prepare");
    }
    Na__WordJump__SetItem("start", Na__HasAudio);

    // Sectioned reading reads on from a section, never just the selection: This Section replaces Read Selection
    Na__WordJump__SetItem("selection", Na__CanPrep && Boolean(Na__Selected) || Na__Reading && Boolean(Na__Selected) && !prepare.disabled);
    Na__WordJump__SetItem("section", Na__Reading && Boolean(Na__Selected || Na__Word) && (Na__HasAudio || Na__CanPrep));
    Na__WordJump__Nodes.menu.querySelector('[data-action="selection"]').hidden = Na__Sections;
    Na__WordJump__Nodes.menu.querySelector('[data-action="section"]').hidden = !Na__Sections;
    Na__WordJump__SetItem("copy", Boolean(Na__Selected || Na__Word));
    Na__WordJump__SetItem("stop", !stop.disabled);

    menu.hidden = false;
    const Na__Box = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(Na__X, window.innerWidth - Na__Box.width - 4)) + "px";
    menu.style.top  = Math.max(4, Math.min(Na__Y, window.innerHeight - Na__Box.height - 4)) + "px";
    menu.querySelector(".TTR__menu-item:not(:disabled):not([hidden])")?.focus({ preventScroll: true });
}
// ------------------------------------------------------------


// FUNCTION | Close the menu
// ------------------------------------------------------------
function Na__WordJump__CloseMenu() {
    if (!Na__WordJump__Nodes || Na__WordJump__Nodes.menu.hidden) return;
    Na__WordJump__Nodes.menu.hidden = true;
    Na__WordJump__MenuWord = null;
}
// ------------------------------------------------------------


// FUNCTION | Run a menu action
// ------------------------------------------------------------
function Na__WordJump__RunAction(Na__Action) {
    const { prepare, pause, stop } = Na__WordJump__Nodes;
    const Na__Word = Na__WordJump__MenuWord;
    const Na__Selected = Na__WordJump__ArticleSelection();
    Na__WordJump__CloseMenu();

    switch (Na__Action) {
        case "here":
            if (Na__Word) Na__WordJump__PlayFromHere(Na__Word);
            break;
        case "toggle":
            (Na__TextToReader__HasHighlightTimeline() ? pause : prepare).click();
            break;
        case "start":
            Na__TextToReader__PlayFromStart();
            break;
        case "selection":
            prepare.click();   // Prepare reads the article selection, which the menu leaves in place
            break;
        case "section":
            Na__TextToReader__PlayThisSection(Na__Word);
            break;
        case "copy":
            navigator.clipboard?.writeText(Na__Selected || Na__WordJump__SentenceText(Na__Word))
                .catch((Na__Error) => console.warn("Copy refused:", Na__Error));
            break;
        case "stop":
            stop.click();
            break;
    }
}
// ------------------------------------------------------------


// FUNCTION | Right-click: custom menu (editor keeps the native one); touch: long-press jump
// ------------------------------------------------------------
function Na__WordJump__HandleContextMenu(Na__Event) {
    if (Na__Event.target.closest?.("textarea, input, [contenteditable='true']")) return;
    if (document.querySelector("dialog[open]")) return;   // A modal is up: the page menu would sit beneath it

    if (Na__WordJump__PointerType === "touch") {
        // A long-press: jump if this is a word in prepared audio, otherwise leave the phone's own menu
        const Na__Word = Na__TextToReader__HasHighlightTimeline() && Na__WordJump__WordAt(Na__Event.target);
        if (!Na__Word && !Na__WordJump__PressFired) return;
        Na__Event.preventDefault();
        if (Na__Word) Na__WordJump__FireLongPress(Na__Word);
        return;
    }

    Na__Event.preventDefault();
    Na__WordJump__OpenMenu(Na__Event.clientX, Na__Event.clientY, Na__WordJump__WordAt(Na__Event.target));
}
// ------------------------------------------------------------


// FUNCTION | Arrow keys move through enabled items; Escape closes
// ------------------------------------------------------------
function Na__WordJump__HandleMenuKeys(Na__Event) {
    if (Na__Event.key === "Escape") {
        Na__WordJump__CloseMenu();
        return;
    }
    if (Na__Event.key !== "ArrowDown" && Na__Event.key !== "ArrowUp") return;
    Na__Event.preventDefault();
    const Na__Items = [...Na__WordJump__Nodes.menu.querySelectorAll(".TTR__menu-item:not(:disabled):not([hidden])")];
    const Na__Index = Na__Items.indexOf(document.activeElement);
    const Na__Step  = Na__Event.key === "ArrowDown" ? 1 : -1;
    Na__Items[(Na__Index + Na__Step + Na__Items.length) % Na__Items.length]?.focus();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Wire the gestures and the menu
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseWordJump(Na__Config) {
    const { article, audio, menu, prepare, pause, stop } = Na__Config || {};
    if (!article || !audio || !menu || !prepare || !pause || !stop) {
        console.error("Text To Reader word jump: missing required elements.");
        return;
    }
    Na__WordJump__Nodes = { article, audio, menu, prepare, pause, stop };

    // Gestures on the article
    article.addEventListener("mousedown", Na__WordJump__HandleMouseDown);
    article.addEventListener("dblclick", Na__WordJump__HandleDoubleClick);
    article.addEventListener("pointermove", Na__WordJump__HandlePointerMove);
    article.addEventListener("selectstart", Na__WordJump__HandleSelectStart);
    for (const Na__Name of ["pointerup", "pointercancel", "pointerleave"]) {
        article.addEventListener(Na__Name, Na__WordJump__CancelPress);
    }
    document.addEventListener("pointerdown", Na__WordJump__HandlePointerDown, true);

    // The menu
    document.addEventListener("contextmenu", Na__WordJump__HandleContextMenu);
    menu.addEventListener("mousedown", (Na__Event) => Na__Event.preventDefault());   // Keep the selection and focus
    menu.addEventListener("click", (Na__Event) => {
        const Na__Item = Na__Event.target.closest(".TTR__menu-item");
        if (Na__Item && !Na__Item.disabled) Na__WordJump__RunAction(Na__Item.dataset.action);
    });
    menu.addEventListener("keydown", Na__WordJump__HandleMenuKeys);
    document.addEventListener("pointerdown", (Na__Event) => {
        if (!menu.contains(Na__Event.target)) Na__WordJump__CloseMenu();
    });
    // Scroll does not bubble, so listen in capture to hear the article's own scroller.
    // Blur only when the window itself loses focus: element blurs (focusing the menu) must not close it.
    window.addEventListener("scroll", Na__WordJump__CloseMenu, true);
    window.addEventListener("resize", Na__WordJump__CloseMenu);
    window.addEventListener("blur", (Na__Event) => {
        if (Na__Event.target === window) Na__WordJump__CloseMenu();
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
