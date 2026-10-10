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
//           - Under the buttons: Voice (a native select, so phones get their own
//             picker) and Speed (- / +). Both are remembered per device and,
//             mid-read, restart the current sentence.
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
    Na__TextToReader__GetReadAloudVoiceOptions,
    Na__TextToReader__SetReadAloudVoice,
    Na__TextToReader__GetReadAloudRate,
    Na__TextToReader__GetReadAloudRateLimits,
    Na__TextToReader__StepReadAloudRate,
    Na__TextToReader__OnReadAloudVoicesChanged
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
     Na__Stop          : "Stop",
     Na__Voice         : "Voice",
     Na__Speed         : "Speed",
     Na__Slower        : "Slower",
     Na__Faster        : "Faster",
     Na__GroupNatural  : "Microsoft Natural",
     Na__GroupDevice   : "On this device",
     Na__GroupPhone    : "Phone voice"
 };

 let Na__TextToReader__MenuDom         = null;    // { Na__Menu, Na__ReadItem, Na__ReadLabel, Na__ReadHint, Na__StopItem, Na__StopLabel, Na__VoiceSelect, ... }
 let Na__TextToReader__MenuScope       = null;    // the area whose browser menu is replaced
 let Na__TextToReader__MenuIsActive    = () => false;
 let Na__TextToReader__MenuText        = { ...Na__TextToReader__MenuDefaultText };
 let Na__TextToReader__MenuStart       = null;    // where Read aloud starts, fixed when the menu opens
 let Na__TextToReader__MenuArmed       = false;   // a press has landed on the menu since it opened
 let Na__TextToReader__MenuPrevFocus   = null;
 let Na__TextToReader__MenuOpenWidth   = 0;       // a phone's toolbar resize must not close it; turning it round does
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


// FUNCTION | Lay the menu out (flipped = growing upward, Read aloud last) and measure it
// ------------------------------------------------------------
function Na__TextToReader__MeasureMenu(Na__Flip) {
    const Na__Menu = Na__TextToReader__MenuDom.Na__Menu;
    const Na__Read = Na__TextToReader__MenuDom.Na__ReadItem;

    if (Na__Flip) {
        Na__Menu.setAttribute("data-ttr-flip", "up");
    } else {
        Na__Menu.removeAttribute("data-ttr-flip");
    }
    Na__Menu.style.left = "0px";
    Na__Menu.style.top  = "0px";

    const Na__Box  = Na__Menu.getBoundingClientRect();
    const Na__Icon = (Na__Read.querySelector("svg") || Na__Read).getBoundingClientRect();
    return {
        Na__Box,
        Na__IconX : Na__Icon.left - Na__Box.left + (Na__Icon.width / 2),
        Na__IconY : Na__Icon.top - Na__Box.top + (Na__Icon.height / 2)
    };
}
// ------------------------------------------------------------


// FUNCTION | Place the menu with Read aloud nearest the pointer or finger
// ------------------------------------------------------------
// Mouse: the pointer lands on the Read aloud icon; near the bottom of the window
// the menu grows upward instead (Read aloud last), so it is still under the pointer.
// Finger: above it, Read aloud nearest the thumb; with no room above, below it.
function Na__TextToReader__PlaceMenu(Na__X, Na__Y, Na__Source) {
    const Na__Menu     = Na__TextToReader__MenuDom.Na__Menu;
    const Na__Gap      = 8;
    const Na__ViewW    = document.documentElement.clientWidth;
    const Na__ViewH    = document.documentElement.clientHeight;
    const Na__HasPoint = Number.isFinite(Na__X) && Number.isFinite(Na__Y) && (Na__X !== 0 || Na__Y !== 0);

    let Na__Fit       = Na__TextToReader__MeasureMenu(false);
    let Na__Left      = (Na__ViewW - Na__Fit.Na__Box.width) / 2;
    let Na__Top       = (Na__ViewH - Na__Fit.Na__Box.height) / 2;
    let Na__BottomGap = Na__Gap;

    if (Na__HasPoint && Na__Source === "touch") {
        Na__Fit  = Na__TextToReader__MeasureMenu(true);
        Na__Left = Na__X - (Na__Fit.Na__Box.width / 2);
        Na__Top  = Na__Y - Na__Fit.Na__Box.height - 28;
        if (Na__Top < Na__Gap) {
            Na__Fit = Na__TextToReader__MeasureMenu(false);
            Na__Top = Na__Y + 36;
        }
    } else if (Na__HasPoint) {
        Na__Left = Na__X - Na__Fit.Na__IconX;
        Na__Top  = Na__Y - Na__Fit.Na__IconY;
        if (Na__Top + Na__Fit.Na__Box.height > Na__ViewH - Na__Gap) {
            Na__Fit       = Na__TextToReader__MeasureMenu(true);
            Na__Left      = Na__X - Na__Fit.Na__IconX;
            Na__Top       = Na__Y - Na__Fit.Na__IconY;
            Na__BottomGap = 2;   // right at the bottom edge, keep Read aloud under the pointer
        }
    }

    Na__Left = Math.min(Math.max(Na__Gap, Na__Left), Na__ViewW - Na__Fit.Na__Box.width - Na__Gap);
    Na__Top  = Math.min(Math.max(Na__Gap, Na__Top),  Na__ViewH - Na__Fit.Na__Box.height - Na__BottomGap);

    Na__Menu.style.left = `${Math.round(Na__Left)}px`;
    Na__Menu.style.top  = `${Math.round(Na__Top)}px`;
}
// ------------------------------------------------------------


// FUNCTION | Fill the Voice select from the voices the browser offers now
// ------------------------------------------------------------
function Na__TextToReader__FillVoiceSelect() {
    const Na__Select = Na__TextToReader__MenuDom.Na__VoiceSelect;
    if (!Na__Select) return;

    const Na__Text    = Na__TextToReader__MenuText;
    const Na__Titles  = { natural: Na__Text.Na__GroupNatural, device: Na__Text.Na__GroupDevice, phone: Na__Text.Na__GroupPhone };
    const Na__Options = Na__TextToReader__GetReadAloudVoiceOptions();

    Na__Select.textContent = "";
    Na__Options.Na__Groups.forEach((Na__Group) => {
        const Na__Holder = document.createElement("optgroup");
        Na__Holder.label = Na__Titles[Na__Group.Na__Key] || Na__Group.Na__Key;

        Na__Group.Na__Options.forEach((Na__Each) => {
            const Na__Option       = document.createElement("option");
            Na__Option.value       = Na__Each.Na__Id;
            Na__Option.textContent = Na__Each.Na__Label;
            Na__Holder.appendChild(Na__Option);
        });
        Na__Select.appendChild(Na__Holder);
    });
    Na__Select.value = Na__Options.Na__SelectedId;
}
// ------------------------------------------------------------


// FUNCTION | Show the speed ("1.5×") and grey out - or + at the limits
// ------------------------------------------------------------
function Na__TextToReader__ShowRate() {
    const Na__Dom = Na__TextToReader__MenuDom;
    if (!Na__Dom.Na__SpeedValue) return;

    const Na__Rate   = Na__TextToReader__GetReadAloudRate();
    const Na__Limits = Na__TextToReader__GetReadAloudRateLimits();

    Na__Dom.Na__SpeedValue.textContent = `${Number.isInteger(Na__Rate) ? Na__Rate.toFixed(1) : String(Na__Rate)}×`;
    if (Na__Dom.Na__SlowerItem) Na__Dom.Na__SlowerItem.disabled = Na__Rate <= Na__Limits.Na__Min + 1e-9;
    if (Na__Dom.Na__FasterItem) Na__Dom.Na__FasterItem.disabled = Na__Rate >= Na__Limits.Na__Max - 1e-9;
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
    Na__TextToReader__FillVoiceSelect();
    Na__TextToReader__ShowRate();

    if (!Na__TextToReader__MenuIsOpen()) Na__TextToReader__MenuPrevFocus = document.activeElement;

    Na__TextToReader__MenuOpenWidth = window.innerWidth;
    Na__Dom.Na__Menu.setAttribute("data-ttr-source", Na__Source);
    Na__Dom.Na__Menu.hidden = false;
    Na__TextToReader__PlaceMenu(Na__X, Na__Y, Na__Source);

    // Mouse and keyboard: focus Read aloud, so Enter reads and Esc closes. Not for a
    // finger: lifting it after the hold focuses the article, and that focus leaving
    // the menu would close it.
    if (Na__Source !== "touch") Na__Dom.Na__ReadItem.focus({ preventScroll: true });
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
// Not on the Voice select: cancelling its press would stop it opening.
function Na__TextToReader__HandleMenuPress(Na__Event) {
    Na__TextToReader__MenuArmed = true;

    const Na__Target = Na__Event.target;
    if (Na__Target && Na__Target.closest && Na__Target.closest("select")) return;
    Na__Event.preventDefault();
}
// ------------------------------------------------------------


// FUNCTION | Voice picked: remember it; the menu stays open for Read aloud
// ------------------------------------------------------------
function Na__TextToReader__HandleVoiceChange() {
    Na__TextToReader__SetReadAloudVoice(Na__TextToReader__MenuDom.Na__VoiceSelect.value);
}
// ------------------------------------------------------------


// FUNCTION | Speed - and +: one step each press; the menu stays open
// ------------------------------------------------------------
function Na__TextToReader__HandleSpeedClick(Na__Event, Na__Direction) {
    if (!Na__TextToReader__MenuArmed && Na__Event.detail !== 0) return;

    Na__TextToReader__StepReadAloudRate(Na__Direction);
    Na__TextToReader__ShowRate();
}
// ------------------------------------------------------------


// FUNCTION | Focus moved to something outside the menu (Tab, or a click elsewhere): close it
// ------------------------------------------------------------
function Na__TextToReader__HandleMenuFocusOut(Na__Event) {
    const Na__Next = Na__Event.relatedTarget;
    if (Na__Next && !Na__TextToReader__MenuDom.Na__Menu.contains(Na__Next)) Na__TextToReader__CloseReadMenu();
}
// ------------------------------------------------------------


// FUNCTION | The window lost focus: close, unless the Voice picker opened (phones give it the focus)
// ------------------------------------------------------------
function Na__TextToReader__HandleWindowBlur() {
    if (!Na__TextToReader__MenuIsOpen()) return;
    if (Na__TextToReader__MenuDom.Na__Menu.contains(document.activeElement)) return;

    Na__TextToReader__CloseReadMenu();
}
// ------------------------------------------------------------


// FUNCTION | Resized: close only when the width changed (a phone's toolbar sliding is not a reason)
// ------------------------------------------------------------
function Na__TextToReader__HandleResize() {
    if (!Na__TextToReader__MenuIsOpen()) return;
    if (window.innerWidth === Na__TextToReader__MenuOpenWidth) return;

    Na__TextToReader__CloseReadMenu();
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

    // Arrows move between Read aloud and Stop; on the Voice select they keep their own job.
    if (Na__Event.key === "ArrowDown" || Na__Event.key === "ArrowUp") {
        const Na__Items = [Na__TextToReader__MenuDom.Na__ReadItem, Na__TextToReader__MenuDom.Na__StopItem]
            .filter((Na__Item) => Na__Item && !Na__Item.hidden);
        const Na__Now   = Na__Items.indexOf(document.activeElement);
        if (Na__Now < 0) return;

        const Na__Step  = Na__Event.key === "ArrowDown" ? 1 : -1;
        const Na__Next  = Na__Items[(Na__Now + Na__Step + Na__Items.length) % Na__Items.length];

        Na__Event.preventDefault();
        if (Na__Next) Na__Next.focus({ preventScroll: true });
    }
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

    const Na__UiText  = uiText || {};
    const Na__Default = Na__TextToReader__MenuDefaultText;
    Na__TextToReader__MenuText = {
        Na__Read          : Na__UiText.NaMiniApp__ReadMenuRead          || Na__Default.Na__Read,
        Na__ReadFromHere  : Na__UiText.NaMiniApp__ReadMenuReadFromHere  || Na__Default.Na__ReadFromHere,
        Na__HintHere      : Na__UiText.NaMiniApp__ReadMenuHintHere      || Na__Default.Na__HintHere,
        Na__HintSelection : Na__UiText.NaMiniApp__ReadMenuHintSelection || Na__Default.Na__HintSelection,
        Na__Stop          : Na__UiText.NaMiniApp__ReadMenuStop          || Na__Default.Na__Stop,
        Na__Voice         : Na__UiText.NaMiniApp__ReadMenuVoice         || Na__Default.Na__Voice,
        Na__Speed         : Na__UiText.NaMiniApp__ReadMenuSpeed         || Na__Default.Na__Speed,
        Na__Slower        : Na__UiText.NaMiniApp__ReadMenuSlower        || Na__Default.Na__Slower,
        Na__Faster        : Na__UiText.NaMiniApp__ReadMenuFaster        || Na__Default.Na__Faster,
        Na__GroupNatural  : Na__UiText.NaMiniApp__ReadMenuGroupNatural  || Na__Default.Na__GroupNatural,
        Na__GroupDevice   : Na__UiText.NaMiniApp__ReadMenuGroupDevice   || Na__Default.Na__GroupDevice,
        Na__GroupPhone    : Na__UiText.NaMiniApp__ReadMenuGroupPhone    || Na__Default.Na__GroupPhone
    };

    const Na__Text = Na__TextToReader__MenuText;
    if (dom.Na__StopLabel)  dom.Na__StopLabel.textContent  = Na__Text.Na__Stop;
    if (dom.Na__VoiceLabel) dom.Na__VoiceLabel.textContent = Na__Text.Na__Voice;
    if (dom.Na__SpeedLabel) dom.Na__SpeedLabel.textContent = Na__Text.Na__Speed;
    if (dom.Na__SlowerItem) dom.Na__SlowerItem.setAttribute("aria-label", Na__Text.Na__Slower);
    if (dom.Na__FasterItem) dom.Na__FasterItem.setAttribute("aria-label", Na__Text.Na__Faster);
    dom.Na__Menu.setAttribute("aria-label", Na__Text.Na__Read);

    document.addEventListener("contextmenu", Na__TextToReader__HandleContextMenu);
    document.addEventListener("pointerdown", Na__TextToReader__HandleOutsidePress, true);
    document.addEventListener("keydown", Na__TextToReader__HandleKeyDown);
    document.addEventListener("wheel", Na__TextToReader__HandleUserScroll, { capture: true, passive: true });
    document.addEventListener("touchmove", Na__TextToReader__HandleUserScroll, { capture: true, passive: true });

    scope.addEventListener("pointerdown", Na__TextToReader__HandlePressStart, { passive: true });
    document.addEventListener("pointermove", Na__TextToReader__HandlePressMove, { passive: true });
    document.addEventListener("pointerup", Na__TextToReader__CancelLongPress, { passive: true });
    document.addEventListener("pointercancel", Na__TextToReader__CancelLongPress, { passive: true });

    window.addEventListener("resize", Na__TextToReader__HandleResize);
    window.addEventListener("blur", Na__TextToReader__HandleWindowBlur);

    dom.Na__Menu.addEventListener("pointerdown", Na__TextToReader__HandleMenuPress);
    dom.Na__Menu.addEventListener("focusout", Na__TextToReader__HandleMenuFocusOut);
    dom.Na__ReadItem.addEventListener("click", Na__TextToReader__HandleReadClick);
    dom.Na__StopItem.addEventListener("click", Na__TextToReader__HandleStopClick);

    if (dom.Na__VoiceSelect) dom.Na__VoiceSelect.addEventListener("change", Na__TextToReader__HandleVoiceChange);
    if (dom.Na__SlowerItem)  dom.Na__SlowerItem.addEventListener("click", (Na__Event) => Na__TextToReader__HandleSpeedClick(Na__Event, -1));
    if (dom.Na__FasterItem)  dom.Na__FasterItem.addEventListener("click", (Na__Event) => Na__TextToReader__HandleSpeedClick(Na__Event, 1));

    // Voices can arrive after the menu first opens (Edge on a computer: the Natural
    // ones a moment after load; Android: perhaps only after the first speech).
    Na__TextToReader__OnReadAloudVoicesChanged(() => {
        if (Na__TextToReader__MenuIsOpen() && document.activeElement !== dom.Na__VoiceSelect) Na__TextToReader__FillVoiceSelect();
    });
    return true;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
