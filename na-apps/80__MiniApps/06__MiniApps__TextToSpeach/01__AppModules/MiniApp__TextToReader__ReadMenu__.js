// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - READ MENU
// =============================================================================
//
// FILE    : MiniApp__TextToReader__ReadMenu__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : On the Read view, replace the browser's context menu with one big
//           Read aloud button: right-click on a computer, press and hold on a phone
// CREATED : 10-Oct-2026
//
// NOTES   : - Shift + right-click still opens the browser's own menu.
//           - A mouse menu opens with its Read aloud button under the pointer, so
//             right-click then left-click without moving reads.
//           - iOS never fires contextmenu for a long press, so touch presses are
//             timed here. Android does fire it; that duplicate is swallowed.
//           - Esc closes the menu, or stops reading when the menu is shut.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__ReadAloud__.js
import {
    Na__TextToReader__HasReadableText,
    Na__TextToReader__ResolveReadStart,
    Na__TextToReader__StartReadAloud,
    Na__TextToReader__StopReadAloud,
    Na__TextToReader__IsReadingAloud,
    Na__TextToReader__GetReadAloudVoiceLabel
} from "./MiniApp__TextToReader__ReadAloud__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__TextToReader__MenuDefaultText = {
     Na__Read          : "Read aloud",
     Na__ReadFromHere  : "Read from here",
     Na__HintHere      : "From here",
     Na__HintSelection : "Selected text",
     Na__Stop          : "Stop"
 };

 let Na__TextToReader__MenuDom         = null;    // { Na__Menu, Na__ReadItem, Na__ReadLabel, Na__ReadHint, Na__StopItem, Na__StopLabel, Na__VoiceLine }
 let Na__TextToReader__MenuScope       = null;    // the area whose browser menu is replaced
 let Na__TextToReader__MenuIsActive    = () => false;
 let Na__TextToReader__MenuText        = { ...Na__TextToReader__MenuDefaultText };
 let Na__TextToReader__MenuStart       = null;    // where Read aloud starts, fixed when the menu opens
 let Na__TextToReader__MenuArmed       = false;   // a press has landed on the menu since it opened
 let Na__TextToReader__MenuPrevFocus   = null;
 let Na__TextToReader__LongPress       = null;    // { Na__Id, Na__X, Na__Y, Na__Timer }
 let Na__TextToReader__LongPressMs     = 450;
 let Na__TextToReader__SwallowUntil    = 0;       // ignore Android's own long-press contextmenu until then

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers
// -----------------------------------------------------------------------------

// FUNCTION | True while the menu is showing
// ------------------------------------------------------------
function Na__TextToReader__MenuIsOpen() {
    return !!Na__TextToReader__MenuDom && Na__TextToReader__MenuDom.Na__Menu.hidden === false;
}
// ------------------------------------------------------------


// FUNCTION | True when a press or right-click on this target belongs to the Read view's text area
// ------------------------------------------------------------
function Na__TextToReader__IsReadTarget(Na__Target) {
    if (!Na__TextToReader__MenuIsActive() || !Na__Target || !Na__TextToReader__MenuScope) return false;
    if (!Na__TextToReader__MenuScope.contains(Na__Target)) return false;

    // Tabs and header keep the browser's menu.
    const Na__Element = Na__Target.nodeType === Node.ELEMENT_NODE ? Na__Target : Na__Target.parentElement;
    return !(Na__Element && Na__Element.closest(".TTR__chrome"));
}
// ------------------------------------------------------------


// FUNCTION | Place the menu: under a mouse pointer, or above a finger so the thumb never hides it
// ------------------------------------------------------------
function Na__TextToReader__PlaceMenu(Na__X, Na__Y, Na__Source) {
    const Na__Menu = Na__TextToReader__MenuDom.Na__Menu;
    const Na__Gap  = 8;

    Na__Menu.style.left = "0px";
    Na__Menu.style.top  = "0px";

    const Na__Box      = Na__Menu.getBoundingClientRect();
    const Na__ViewW    = document.documentElement.clientWidth;
    const Na__ViewH    = document.documentElement.clientHeight;
    const Na__HasPoint = Number.isFinite(Na__X) && Number.isFinite(Na__Y) && (Na__X !== 0 || Na__Y !== 0);

    let Na__Left = (Na__ViewW - Na__Box.width) / 2;
    let Na__Top  = (Na__ViewH - Na__Box.height) / 2;

    if (Na__HasPoint && Na__Source === "touch") {
        Na__Left = Na__X - (Na__Box.width / 2);
        Na__Top  = Na__Y - Na__Box.height - 28;
        if (Na__Top < Na__Gap) Na__Top = Na__Y + 36;
    } else if (Na__HasPoint) {
        // Put the pointer on the Read aloud icon.
        const Na__Icon = Na__TextToReader__MenuDom.Na__ReadItem.querySelector("svg") || Na__TextToReader__MenuDom.Na__ReadItem;
        const Na__Spot = Na__Icon.getBoundingClientRect();
        Na__Left = Na__X - (Na__Spot.left - Na__Box.left + (Na__Spot.width / 2));
        Na__Top  = Na__Y - (Na__Spot.top - Na__Box.top + (Na__Spot.height / 2));
    }

    Na__Left = Math.min(Math.max(Na__Gap, Na__Left), Na__ViewW - Na__Box.width - Na__Gap);
    Na__Top  = Math.min(Math.max(Na__Gap, Na__Top),  Na__ViewH - Na__Box.height - Na__Gap);

    Na__Menu.style.left = `${Math.round(Na__Left)}px`;
    Na__Menu.style.top  = `${Math.round(Na__Top)}px`;
}
// ------------------------------------------------------------


// FUNCTION | Open the menu at a point; returns false when there is nothing to read
// ------------------------------------------------------------
function Na__TextToReader__OpenReadMenu(Na__X, Na__Y, Na__Source) {
    const Na__Dom   = Na__TextToReader__MenuDom;
    const Na__Text  = Na__TextToReader__MenuText;
    const Na__Start = Na__TextToReader__ResolveReadStart(Na__X, Na__Y, Na__Source !== "touch");
    if (!Na__Start) return false;

    const Na__Reading     = Na__TextToReader__IsReadingAloud();
    const Na__IsSelection = Na__Start.Na__Kind === "selection";

    Na__TextToReader__MenuStart = Na__Start;
    Na__TextToReader__MenuArmed = false;

    Na__Dom.Na__ReadLabel.textContent = (Na__Reading && !Na__IsSelection) ? Na__Text.Na__ReadFromHere : Na__Text.Na__Read;
    Na__Dom.Na__ReadHint.textContent  = Na__IsSelection ? Na__Text.Na__HintSelection : (Na__Reading ? "" : Na__Text.Na__HintHere);
    Na__Dom.Na__StopItem.hidden       = !Na__Reading;
    if (Na__Dom.Na__VoiceLine) Na__Dom.Na__VoiceLine.textContent = Na__TextToReader__GetReadAloudVoiceLabel();

    if (!Na__TextToReader__MenuIsOpen()) Na__TextToReader__MenuPrevFocus = document.activeElement;

    Na__Dom.Na__Menu.setAttribute("data-ttr-source", Na__Source);
    Na__Dom.Na__Menu.hidden = false;
    Na__TextToReader__PlaceMenu(Na__X, Na__Y, Na__Source);
    Na__Dom.Na__ReadItem.focus({ preventScroll: true });   // Enter reads, Esc closes
    return true;
}
// ------------------------------------------------------------


// FUNCTION | Clear a pending press-and-hold timer
// ------------------------------------------------------------
function Na__TextToReader__CancelLongPress(Na__Event) {
    const Na__Press = Na__TextToReader__LongPress;
    if (!Na__Press) return;
    if (Na__Event && Na__Event.pointerId !== undefined && Na__Event.pointerId !== Na__Press.Na__Id) return;

    window.clearTimeout(Na__Press.Na__Timer);
    Na__TextToReader__LongPress = null;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

// FUNCTION | Right-click (and Android long-press): our menu instead of the browser's
// ------------------------------------------------------------
function Na__TextToReader__HandleContextMenu(Na__Event) {
    const Na__Menu = Na__TextToReader__MenuDom.Na__Menu;

    if (Na__Menu.contains(Na__Event.target)) {
        Na__Event.preventDefault();
        return;
    }
    if (!Na__TextToReader__IsReadTarget(Na__Event.target)) return;
    if (Na__Event.shiftKey === true) {
        Na__TextToReader__CloseReadMenu();   // Shift + right-click: the browser's own menu
        return;
    }
    if (!Na__TextToReader__HasReadableText()) return;

    Na__Event.preventDefault();
    if (Date.now() < Na__TextToReader__SwallowUntil) return;

    Na__TextToReader__CancelLongPress();

    const Na__IsTouch = Na__Event.pointerType === "touch" || Na__Event.pointerType === "pen";
    Na__TextToReader__OpenReadMenu(Na__Event.clientX, Na__Event.clientY, Na__IsTouch ? "touch" : "mouse");
}
// ------------------------------------------------------------


// FUNCTION | A finger goes down on the text: start the press-and-hold timer
// ------------------------------------------------------------
function Na__TextToReader__HandlePressStart(Na__Event) {
    if (Na__Event.pointerType !== "touch" && Na__Event.pointerType !== "pen") return;
    if (Na__Event.isPrimary === false || !Na__TextToReader__IsReadTarget(Na__Event.target)) return;
    if (!Na__TextToReader__HasReadableText()) return;

    Na__TextToReader__CancelLongPress();

    const Na__Press = { Na__Id: Na__Event.pointerId, Na__X: Na__Event.clientX, Na__Y: Na__Event.clientY, Na__Timer: 0 };
    Na__Press.Na__Timer = window.setTimeout(() => {
        if (Na__TextToReader__LongPress !== Na__Press) return;

        Na__TextToReader__LongPress    = null;
        Na__TextToReader__SwallowUntil = Date.now() + 1500;
        Na__TextToReader__OpenReadMenu(Na__Press.Na__X, Na__Press.Na__Y, "touch");
    }, Na__TextToReader__LongPressMs);

    Na__TextToReader__LongPress = Na__Press;
}
// ------------------------------------------------------------


// FUNCTION | The finger moved: it is a scroll, not a press and hold
// ------------------------------------------------------------
function Na__TextToReader__HandlePressMove(Na__Event) {
    const Na__Press = Na__TextToReader__LongPress;
    if (!Na__Press || Na__Event.pointerId !== Na__Press.Na__Id) return;

    if (Math.hypot(Na__Event.clientX - Na__Press.Na__X, Na__Event.clientY - Na__Press.Na__Y) > 10) {
        Na__TextToReader__CancelLongPress();
    }
}
// ------------------------------------------------------------


// FUNCTION | Any press outside the open menu closes it
// ------------------------------------------------------------
function Na__TextToReader__HandleOutsidePress(Na__Event) {
    if (!Na__TextToReader__MenuIsOpen()) return;
    if (Na__TextToReader__MenuDom.Na__Menu.contains(Na__Event.target)) return;

    Na__TextToReader__CloseReadMenu();
}
// ------------------------------------------------------------


// FUNCTION | A press on the menu itself arms its buttons and keeps the page's selection
// ------------------------------------------------------------
function Na__TextToReader__HandleMenuPress(Na__Event) {
    Na__TextToReader__MenuArmed = true;
    Na__Event.preventDefault();
}
// ------------------------------------------------------------


// FUNCTION | Read aloud button
// ------------------------------------------------------------
function Na__TextToReader__HandleReadClick(Na__Event) {
    if (!Na__TextToReader__MenuArmed && Na__Event.detail !== 0) return;   // a stray click from the opening press

    const Na__Start = Na__TextToReader__MenuStart;
    Na__TextToReader__CloseReadMenu();
    if (Na__Start) Na__TextToReader__StartReadAloud(Na__Start);   // inside the click: iOS needs the gesture
}
// ------------------------------------------------------------


// FUNCTION | Stop button
// ------------------------------------------------------------
function Na__TextToReader__HandleStopClick(Na__Event) {
    if (!Na__TextToReader__MenuArmed && Na__Event.detail !== 0) return;

    Na__TextToReader__CloseReadMenu();
    Na__TextToReader__StopReadAloud();
}
// ------------------------------------------------------------


// FUNCTION | Esc closes the menu, or stops reading; arrows move between the buttons
// ------------------------------------------------------------
function Na__TextToReader__HandleKeyDown(Na__Event) {
    if (Na__Event.key === "Escape") {
        if (Na__TextToReader__MenuIsOpen()) {
            Na__Event.preventDefault();
            Na__TextToReader__CloseReadMenu();
            return;
        }
        if (Na__TextToReader__MenuIsActive() && Na__TextToReader__IsReadingAloud()) {
            Na__Event.preventDefault();
            Na__TextToReader__StopReadAloud();
        }
        return;
    }

    if (!Na__TextToReader__MenuIsOpen()) return;

    if (Na__Event.key === "ArrowDown" || Na__Event.key === "ArrowUp") {
        const Na__Items = [Na__TextToReader__MenuDom.Na__ReadItem, Na__TextToReader__MenuDom.Na__StopItem]
            .filter((Na__Item) => Na__Item && !Na__Item.hidden);
        const Na__Now   = Na__Items.indexOf(document.activeElement);
        const Na__Step  = Na__Event.key === "ArrowDown" ? 1 : -1;
        const Na__Next  = Na__Items[(Na__Now + Na__Step + Na__Items.length) % Na__Items.length];

        Na__Event.preventDefault();
        if (Na__Next) Na__Next.focus({ preventScroll: true });
        return;
    }

    if (Na__Event.key === "Tab") Na__TextToReader__CloseReadMenu();
}
// ------------------------------------------------------------


// FUNCTION | Wheel or finger scrolling elsewhere closes the menu, like the browser's own
// ------------------------------------------------------------
function Na__TextToReader__HandleUserScroll(Na__Event) {
    if (!Na__TextToReader__MenuIsOpen()) return;
    if (Na__TextToReader__MenuDom.Na__Menu.contains(Na__Event.target)) return;

    Na__TextToReader__CloseReadMenu();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Close the menu and hand focus back
// ------------------------------------------------------------
export function Na__TextToReader__CloseReadMenu() {
    if (!Na__TextToReader__MenuIsOpen()) return;

    const Na__Menu      = Na__TextToReader__MenuDom.Na__Menu;
    const Na__HadFocus  = Na__Menu.contains(document.activeElement);
    const Na__PrevFocus = Na__TextToReader__MenuPrevFocus;

    Na__Menu.hidden                 = true;
    Na__TextToReader__MenuStart     = null;
    Na__TextToReader__MenuArmed     = false;
    Na__TextToReader__MenuPrevFocus = null;

    if (Na__HadFocus) {
        if (Na__PrevFocus && Na__PrevFocus.isConnected && typeof Na__PrevFocus.focus === "function") {
            Na__PrevFocus.focus({ preventScroll: true });
        } else if (document.activeElement && typeof document.activeElement.blur === "function") {
            document.activeElement.blur();
        }
    }
}
// ------------------------------------------------------------


// FUNCTION | Wire the menu to the Read view
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseReadMenu(Na__Config) {
    const {
        dom,
        scope,
        isActive,
        uiText,
        longPressMs
    } = Na__Config || {};

    const Na__Required = dom ? [dom.Na__Menu, dom.Na__ReadItem, dom.Na__ReadLabel, dom.Na__ReadHint, dom.Na__StopItem] : [];
    if (!scope || Na__Required.length === 0 || Na__Required.some((Na__Node) => !Na__Node)) return false;

    Na__TextToReader__MenuDom      = dom;
    Na__TextToReader__MenuScope    = scope;
    Na__TextToReader__MenuIsActive = typeof isActive === "function" ? isActive : () => false;
    if (Number(longPressMs) > 0) Na__TextToReader__LongPressMs = Number(longPressMs);

    const Na__UiText = uiText || {};
    Na__TextToReader__MenuText = {
        Na__Read          : Na__UiText.NaMiniApp__ReadMenuRead          || Na__TextToReader__MenuDefaultText.Na__Read,
        Na__ReadFromHere  : Na__UiText.NaMiniApp__ReadMenuReadFromHere  || Na__TextToReader__MenuDefaultText.Na__ReadFromHere,
        Na__HintHere      : Na__UiText.NaMiniApp__ReadMenuHintHere      || Na__TextToReader__MenuDefaultText.Na__HintHere,
        Na__HintSelection : Na__UiText.NaMiniApp__ReadMenuHintSelection || Na__TextToReader__MenuDefaultText.Na__HintSelection,
        Na__Stop          : Na__UiText.NaMiniApp__ReadMenuStop          || Na__TextToReader__MenuDefaultText.Na__Stop
    };
    if (dom.Na__StopLabel) dom.Na__StopLabel.textContent = Na__TextToReader__MenuText.Na__Stop;
    dom.Na__Menu.setAttribute("aria-label", Na__TextToReader__MenuText.Na__Read);

    document.addEventListener("contextmenu", Na__TextToReader__HandleContextMenu);
    document.addEventListener("pointerdown", Na__TextToReader__HandleOutsidePress, true);
    document.addEventListener("keydown", Na__TextToReader__HandleKeyDown);
    document.addEventListener("wheel", Na__TextToReader__HandleUserScroll, { capture: true, passive: true });
    document.addEventListener("touchmove", Na__TextToReader__HandleUserScroll, { capture: true, passive: true });

    scope.addEventListener("pointerdown", Na__TextToReader__HandlePressStart, { passive: true });
    document.addEventListener("pointermove", Na__TextToReader__HandlePressMove, { passive: true });
    document.addEventListener("pointerup", Na__TextToReader__CancelLongPress, { passive: true });
    document.addEventListener("pointercancel", Na__TextToReader__CancelLongPress, { passive: true });

    window.addEventListener("resize", Na__TextToReader__CloseReadMenu);
    window.addEventListener("blur", Na__TextToReader__CloseReadMenu);

    dom.Na__Menu.addEventListener("pointerdown", Na__TextToReader__HandleMenuPress);
    dom.Na__ReadItem.addEventListener("click", Na__TextToReader__HandleReadClick);
    dom.Na__StopItem.addEventListener("click", Na__TextToReader__HandleStopClick);
    return true;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
