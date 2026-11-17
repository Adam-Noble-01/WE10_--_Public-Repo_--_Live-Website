// =============================================================================
// NOBLE ARCHITECTURE - ROOM SIZE COMPARATOR - URL STATE
// =============================================================================
//
// FILE    : MiniApp__SpacePlanningUtils__RoomSizeComparator__UrlState__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Keep the comparison in the page address so a link can be sent to a
//           client, and remember the chosen units on this device
// CREATED : 16-Nov-2026
//
// - Hash format: #room=bedroom&unit=m2&area=14   or   &l=3.5&w=4   (&view=all)
//   Areas and lengths are always stored in metres, whatever the units shown.
// - Preferences (units, last room) live in localStorage and are optional: every
//   read and write is wrapped, so private windows and blocked storage still work.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Address Hash
// -----------------------------------------------------------------------------

// FUNCTION | Read the comparison from the address hash
// ------------------------------------------------------------
export function Na__RoomSizeComparator__ReadHashState() {
    const Na__Params = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const Na__State  = {};

    const Na__Number = (Na__Key) => {
        const Na__Value = Number.parseFloat(Na__Params.get(Na__Key));
        return Number.isFinite(Na__Value) && Na__Value > 0 ? Na__Value : null;
    };

    if (Na__Params.get("room")) Na__State.Na__RoomId = Na__Params.get("room");
    if (["m2", "ft2"].includes(Na__Params.get("unit"))) Na__State.Na__Unit = Na__Params.get("unit");
    if (["compare", "all", "data"].includes(Na__Params.get("view"))) Na__State.Na__View = Na__Params.get("view");

    const Na__Length = Na__Number("l");
    const Na__Width  = Na__Number("w");
    const Na__Area   = Na__Number("area");

    if (Na__Length && Na__Width) {
        Na__State.Na__InputMode = "dims";
        Na__State.Na__LengthM   = Na__Length;
        Na__State.Na__WidthM    = Na__Width;
    } else if (Na__Area) {
        Na__State.Na__InputMode = "area";
        Na__State.Na__AreaM2    = Na__Area;
    }

    return Na__State;
}
// ------------------------------------------------------------


// FUNCTION | Write the comparison to the address hash (no new history entries)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__WriteHashState(Na__State) {
    const Na__Params = new URLSearchParams();
    const Na__Round  = (Na__Value) => String(Number(Na__Value.toFixed(4)));

    if (Na__State.Na__RoomId) Na__Params.set("room", Na__State.Na__RoomId);
    Na__Params.set("unit", Na__State.Na__Unit);

    if (Na__State.Na__InputMode === "dims" && Na__State.Na__LengthM && Na__State.Na__WidthM) {
        Na__Params.set("l", Na__Round(Na__State.Na__LengthM));
        Na__Params.set("w", Na__Round(Na__State.Na__WidthM));
    } else if (Na__State.Na__InputMode === "area" && Na__State.Na__AreaM2) {
        Na__Params.set("area", Na__Round(Na__State.Na__AreaM2));
    }

    if (Na__State.Na__View && Na__State.Na__View !== "compare") Na__Params.set("view", Na__State.Na__View);

    const Na__Hash = `#${Na__Params.toString()}`;
    if (window.location.hash === Na__Hash) return;

    try {
        window.history.replaceState(null, "", Na__Hash);
    } catch (Na__Error) {
        // Sandboxed frames can refuse replaceState; the app works without it
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Device Preferences
// -----------------------------------------------------------------------------

// FUNCTION | Read remembered preferences (empty object when unavailable)
// ------------------------------------------------------------
export function Na__RoomSizeComparator__LoadPrefs(Na__StorageKey) {
    try {
        const Na__Text = window.localStorage.getItem(Na__StorageKey);
        const Na__Prefs = Na__Text ? JSON.parse(Na__Text) : {};
        return Na__Prefs && typeof Na__Prefs === "object" ? Na__Prefs : {};
    } catch (Na__Error) {
        return {};
    }
}
// ------------------------------------------------------------


// FUNCTION | Remember preferences on this device
// ------------------------------------------------------------
export function Na__RoomSizeComparator__SavePrefs(Na__StorageKey, Na__Prefs) {
    try {
        window.localStorage.setItem(Na__StorageKey, JSON.stringify(Na__Prefs));
    } catch (Na__Error) {
        // Private windows or blocked storage: preferences simply aren't kept
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
