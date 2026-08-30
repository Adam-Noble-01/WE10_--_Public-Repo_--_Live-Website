# TrueVision3D — Context Menu System

Custom right-click context menu. Desktop mouse only, Orbit mode only.

Version 1.0.0 — 30-Aug-2026

---

## What it does

Right-click a piece of the building and get a menu that knows what you clicked:

```
  Ground Floor · Doors
  ──────────────────────────────
  Open Door                          ← object interaction section
  ──────────────────────────────
  Show Entire Building               ← restore rows, only when relevant
  Show All Hidden Elements      2
  ──────────────────────────────
● View Ground Floor                  ← whole storey, alone in its own group
  ──────────────────────────────
  Isolate Doors          Ground Floor
  Isolate Doors            All Floors
  ──────────────────────────────
  Hide Doors             Ground Floor
  Hide Doors               All Floors
```

The storey row is deliberately the odd one out. It is named after the floor
(`View Ground Floor`, no scope tag) and sits alone between two rules, because it
switches an entire floor level on rather than acting on the element that was
right-clicked — the rows below it all act on the element.

Right-clicking empty space (sky, ground, a gap) opens nothing at all — identical
to the behaviour before this system existed.

---

## The pan guard — the part that matters most

The right mouse button is the Orbit **pan** gesture. That gesture is perfect and
must not be disturbed. Three things protect it:

1. **The guard is a pure observer.** It never calls `preventDefault` or
   `stopPropagation` on any pointer event and never touches OrbitControls. The
   event stream OrbitControls receives is byte-for-byte what it received before
   this system existed. The only `preventDefault` in the whole system is on the
   `contextmenu` event, and only in the moment a menu is actually opening.

2. **It is a latch, not a comparison.** Once pointer travel passes
   `MaxTravelPx`, the press is disqualified permanently. Returning the pointer
   to its exact origin cannot re-arm it, so a pan that happens to end where it
   started still suppresses the menu. Only a fresh right-button `pointerdown`
   arms a new press.

3. **Anything ambiguous disarms it** — a second mouse button, a wheel tick,
   window blur, a tab switch, a key press, a pointer cancel, or the wrong
   navigation mode.

`contextmenu` fires after `pointerup`, so by the time the menu is considered the
latch already reflects the whole press.

Measured behaviour (verified against West Farm, RB05):

| Gesture | Menu |
|---|---|
| Stationary right-click | opens |
| 2px hand tremor | opens |
| 4px / 5px travel | suppressed |
| 10px / 60px / 120px travel | suppressed |
| Drag 80px away and return to the exact origin | suppressed |
| Right-drag pan | suppressed, and the camera pans normally |
| Touch or pen pointer | suppressed |
| Walk or Fly mode | suppressed |

---

## Files

| File | Role |
|---|---|
| `Na__ContextMenuSystem__AppConfig__.json` | All tuning. Gesture thresholds, picking rules, labels, element display names, section order. |
| `Na__ContextMenuSystem__SystemLogic__.js` | Entry point. Loads config, wires the parts, owns the section provider registry. |
| `Na__ContextMenuSystem__Gesture__RightClickGuard__.js` | Decides menu click vs pan. See above. |
| `Na__ContextMenuSystem__Picking__HitResolver__.js` | Raycast → category group + storey + element type. |
| `Na__ContextMenuSystem__Section__ModelVisibility__.js` | Isolate / hide / restore rows. Owns the isolation state. |
| `Na__ContextMenuSystem__Section__DoorInteraction__.js` | Open / Close Door row. Reference implementation of an object-type section. |
| `Na__ContextMenuSystem__Ui__MenuRenderer__.js` | DOM build, positioning, dismissal. |
| `Na__ContextMenuSystem__Styles__.css` | Styling, matched to the Tools & Settings dropdown. |

---

## Extending it — adding a new object-type section

Section providers are the whole point of the architecture. The menu does not
know what a door is; it asks every registered provider "do you have anything to
say about this hit?" and renders whatever comes back. Adding a new interactive
asset touches **one new file and one line**.

1. Write `Na__ContextMenuSystem__Section__<YourThing>__.js`, exporting:

```js
function Na__ContextMenu__YourThing__GetProvider() {
    return {
        id           : 'yourThing',
        buildSection : (hitContext) => {
            //  Return null when this hit is not your kind of object.
            if (!recognise(hitContext.hitObject)) return null;

            return {
                id   : 'yourThing',
                rows : [{
                    group    : 'yourThing',     // rows sharing a group draw together
                    label    : 'Do The Thing',
                    meta     : 'Optional right-aligned scope tag',
                    isActive : false,           // true renders the green state dot
                    action   : () => doTheThing()
                }]
            };
        }
    };
}
```

2. Register it in `Na__ContextMenuSystem__SystemLogic__.js`, or from anywhere
   at runtime:

```js
Na__ContextMenu__RegisterSectionProvider(myProvider, 15);   // lower order = higher in the menu
```

Nothing in the renderer changes. Rules between groups are inserted automatically
wherever the group value changes, so sub-sections come for free.

`hitContext` carries: `hitObject`, `point`, `distance`, `categoryGroup`,
`categoryKey`, `storeyKey`, `elementKey`.

---

## State model

```
{ isolation : null | { type:'floor', storeyKey }
                   | { type:'element', elementKey, scope, storeyKey },
  hidden    : Set<categoryKey> }
```

**One isolation at a time.** Choosing a new one replaces the previous one.
The hidden set is **independent** and survives isolating and un-isolating, so
leaving an isolation returns you to the building with your hidden elements
still hidden. `Show All Hidden Elements` clears the set; `Show Entire Building`
clears the isolation.

A row representing the current state renders with the green dot and toggles
itself off when clicked — a second way out on top of the restore rows.

---

## How it drives visibility

This system owns **no visibility logic**. It orchestrates the three existing
systems in the same two-pass order that
`Na__PresentationMode__Visibility__StateCapture.js` uses:

- **Pass 1 (coarse)** — `Na__StoreySystem__` / `Na__StoreyIsolate__` set the
  storey baseline, including the roof dolls-house rule and the landscape cache.
- **Pass 2 (fine)** — `Na__ModelToggle__ApplyVisibilityState()` applies the
  per-category result. It is authoritative and wins over any roof-logic side
  effect from pass 1.

Routing pass 2 through the model-toggle registry rather than poking
`group.visible` directly keeps its cached flags, its Dev-menu buttons and the
Presentation Mode scene capture all correct for free. Saved scenes therefore
pick up context-menu changes with no extra work.

Actions broadcast `na-context-menu-visibility-changed`, which the Tools menu
Floor Isolate and Storey Toggle panels listen for, so the two UIs cannot
disagree about which floor is isolated.

---

## Deliberate behaviours worth knowing

- **`View <Floor>` delegates to `Na__StoreyIsolate__IsolateSingleStorey`**, so
  it behaves identically to the Tools menu Floor Isolate button — including
  leaving non-storey categories such as `TrueVision__MainBuildingModel__*`
  visible. The two entry points must not diverge. Use `Hide Element` to drop
  those too.
- **The dismissal handler is bound on `window` in the CAPTURE phase**, so a
  press on the menu reaches it before the row does. It must therefore test
  whether the target is inside the menu and bail out — without that test the
  menu is torn down on `pointerdown` and no row's `click` ever fires. A bubble
  phase `stopPropagation` on the menu root cannot fix this; it runs too late.
  If you ever add another global dismissal listener, apply the same test.
- **`Isolate Element` means only that element**, so landscape and roofs go with
  everything else.
- **Linework is excluded from the ray.** Fat lines are `LineSegments2`, which
  extends `THREE.Mesh`, so an edge would otherwise beat the solid face behind it
  and every hit would resolve to the outline rather than the wall.
- **Invisible geometry is filtered manually.** `THREE.Raycaster` does not test
  `object.visible`, so a hidden storey would otherwise still be pickable through
  the model in front of it. Every candidate hit has its full ancestor chain
  checked.
- **The "All Floors" rows only appear when the element actually exists on more
  than one storey**, otherwise they would just duplicate the floor row.
- **Door click detection is now left-button only** (see the door module's
  v1.8.0 log). Without that, a stationary right-click would toggle the door AND
  open a menu already labelled for the opposite state.

---

## Config quick reference

| Key | Default | Meaning |
|---|---|---|
| `ContextMenu__Enabled` | `true` | Master switch |
| `ContextMenu__Gesture__MaxTravelPx` | `3` | Travel latch threshold |
| `ContextMenu__Gesture__MaxHoldMs` | `0` | Hold ceiling; `0` disables the check |
| `ContextMenu__Gesture__MouseOnly` | `true` | Reject pen and touch |
| `ContextMenu__Gesture__ArmedNavModes` | `["orbit"]` | Modes the menu arms in |
| `ContextMenu__Picking__IgnoreLinework` | `true` | Keep edges out of the ray |
| `ContextMenu__Sections__*__Order` | `10` / `20` | Ascending render order |
| `ContextMenu__ElementDisplayNames` | map | Element key → menu label |
| `ContextMenu__Labels` | map | Row wording; `{element}` and `{floor}` substituted |
