# TrueVision3D - PLAN - Floor Plans, Elevations and Cross Sections Menus
# =========================================================

**Status:** built 20-Sep-2026 as v2.86.0. **Awaiting Adam's test.** Not in ValeVision.
**Brief:** Adam, 20-Sep-2026, one dictated message and five marked-up screenshots.
**Read first:** section 2 (every mark, and where it lives) and section 6 (what is still mine to confirm).

---

## 1. The brief, in his words

> Update the elevations and floor plans assignment menus and make them behave a lot more like the
> animation scenes menus. Don't have a per-scene thumbnail button. Instead, just have a green update
> button that, when you press it, pops up an "Are you sure?" modal. Updating a plan or elevation view
> could potentially fuck up a bunch of drawings that are assigned to it, because if it moves the
> position, the drawing won't line up anymore. [...] When you press that, it saves to both local and
> R2 [...] Each section as well needs to be collapsed unless it's the one that you're focusing on
> [...] Move the delete scene below HR and space out the buttons better [...] At the bottom, the
> Update All save elevations and save plans. Just get rid of that. And add a plus at the top [...]
> Add a cross-sections section to the menu as well [...] I just want the placeholder added there now.
> [...] Is this "Viewed from" button still even relevant, seeing as the elevations now are derived
> from the new compass tool? [...] It should just auto-populate the name of the elevation, but then
> allow the user to be able to overwrite that text box [...] It reports the elevation underneath as
> well [...] But do check for conflicts with any of the systems we've built already.

And the sentence the whole job turns on: *"Currently, you can destroy an entire project's viewports
by moving a few of these around: move the view around or change a parameter, hit Save All, and it
will just break all of the drawings."*

---

## 2. Requirement audit - every mark and every sentence

| # | Source | Read literally | Where it lives | State |
|---|---|---|---|---|
| 1 | Image 1: green arrow onto **Save Thumbnail** | That button is the one to replace | `DevRowShell__BuildCommitActions`: green **Update Elevation** / **Update Floor Plan**; Save Thumbnail removed from both row builders | Built |
| 2 | "pops up an Are you sure? modal" | A dialog before anything is written | `DevRowShell__ConfirmUpdate` - lists the changes, names the sheets drawn from the drawing, red when it moves one | Built |
| 3 | "it saves to both local and R2" | One save, two destinations | `DraftGuard__SaveActive` -> `Na__DrawData__Save` (R2 then the repository file); toast says where it landed, or that the local copy was NOT written | Built. A real local write is untested (needs the ProjectVision server) |
| 4 | "You might not need to update all of the scenes at once" | Update is per drawing | One Update per open row; nothing updates anything else | Built |
| 5 | "realign the different parameters and then capture them all" | Several edits, one Update | The open row is a draft; Update keeps every change on it together | Built. **My reading** - see section 6 |
| 6 | Image 2: green cross over **Save Elevations** | Remove it | Gone from both panels. Found on the way: it had not saved a drawing record since v2.21.0 | Built |
| 7 | "Each section... collapsed unless it's the one you're focusing on" | Rows fold, one open | `RowAccordion__` wired at last (ported 10-Sep, never imported); one slot across both panels | Built |
| 8 | "Move the delete scene below HR and space out the buttons better" | A rule, Delete beneath it | `DevRowShell__BuildDangerZone`; actions are a two-column grid: Preview / Annotate, then Update / Revert; captions over each group of controls | Built |
| 9 | "add a plus at the top" | A + in each panel's head | `DevRowShell__BuildPanelHead` - the scenes panel's own square + | Built (the full-width Add at the foot is kept too, as the scenes panel keeps both) |
| 10 | Image 3: green box between **Elevations** and **North Direction** | A new menu entry in that place | `Index.html` `#naCrossSectionDevItem`, `48__System__CrossSectionViews/` | Built - placeholder, as asked |
| 11 | "the cross-sections menu will use the same style of menu" | Same shell | Built from `DevRowShell__`; its header says how the real one plugs in | Built |
| 12 | Image 4: green box round **Viewed from**, the four buttons and **Bearing** | That whole region becomes a statement | `RowBuilders__BuildIdentity`: compass mark + one sentence + true bearing. The stored bearing moved under a folded **Advanced** as "Model bearing" | Built. Keeping the bearing at all is **my call** - section 6 |
| 13 | Image 5: green arrow from **South** up to the **name box** | The direction fills the name | `45/Na__Elevation__AutoName__` - `Elevation__NameIsAuto` | Built |
| 14 | "allow the user to overwrite that text box... coach house east elevation" | A typed name wins and stays | Flag goes false; `Name it "East Elevation"` offers the way back; clearing the box does the same | Built |
| 15 | "It reports the elevation underneath as well" | The sentence stays when the name is typed over | It is the same sentence, always shown | Built |
| 16 | "make it less brittle" | No stray edit can reach a save | Section 3 | Built |
| 17 | "check for conflicts with any of the systems we've built" | Audit the neighbours | Section 5 | Done |

---

## 3. How it is put together

**The fault had two halves.** (a) Every control wrote to the live record, on every row at once, and
the drawings block is written whole by whoever saves next. (b) The panels' own Save buttons wrote
only the presentation block - the records left it in v2.21.0 - so they had kept nothing for ten days.

**The rule: one drawing open, and the open drawing is a draft.**

| Piece | File | What it does |
|---|---|---|
| Draft maths | `40/Na__DrawView__DraftMaths__.js` | Pure. Snapshot, changed keys (view keys ignored, key order ignored), restore IN PLACE (same record, same arrays), swap a record in a payload copy for its snapshot |
| Draft guard | `40/Na__DrawView__DraftGuard__.js` | The one live draft. Owners per drawing type. `ConfirmLeave`, `Revert`, `SaveActive` (the draft's own Update), `SaveBlock` (anything else). Registers the payload guard and the accordion's change guard as it loads |
| Payload guard | `40/Na__DrawView__ProjectData__.js` | `Na__DrawData__Save` hands its payload COPY to the guard before splitting it into the R2 and local copies - so Save Sheets, the register, north and a rename all write a changed draft as it was last updated |
| Row accordion | `40/Na__DrawView__RowAccordion__.js` | One open slot across both panels. New: a change guard asked before the slot moves, listeners told when it has, `RequestOpenId`, header `lead` / `trail` |
| Row shell | `40/Na__DrawView__DevRowShell__.js` | Head with +, header chips, Update / Revert actions, danger zone, Advanced, the two dialogs, "where saved" |
| Usage | `40/Na__DrawView__DrawingUsage__.js` | Which sheet viewports draw from a drawing, by the sheet model's own rule, read off the sheet records (no editor needed) |
| Staged rename | `40/Na__DrawView__RenameDrawing__.js` | `StageFloorPlan` / `StageElevation`: the card, the section binding key and the sheet fingerprints brought into step in memory, with an undo - the caller owns the save |

**View state is not an edit.** The mode controllers write zoom and pan into a record every time a
preview settles. `*__CameraZoom` and `*__CameraTargetMm` are left out of the comparison and out of a
revert. Update stores them on purpose.

**Planes in the 3D view.** The source adapters' `setPositionMm` and `applyFacePick` claim the
drawing first: already the draft - go; nothing else changed - open its row and begin one; another
drawing changed - refuse, one toast.

**What Update does, in order:** confirm -> (on screen) store framing, render and upload the
thumbnail -> card camera from the record -> stage the name's other holders -> ONE save -> re-baseline
-> toast. A failed save undoes the staged name and leaves the row changed.

---

## 4. Elevation names and the project's north

- `Elevation__NameIsAuto`: **true** follows the direction; **false** a name typed in this panel;
  **absent** a record from before the flag (adopted as automatic only if its name already IS the
  automatic one - PS01's three are).
- Automatic names are unique among elevations: "North Elevation", then "North Elevation 2".
- Nothing is named while north is not set; the flag waits and the name arrives with north.
- `prepare` (before the snapshot) adopts; `afterBegin` (after it) syncs - so a name catching up with
  a north set since the last update shows as a change to be kept, not a silent rewrite.
- Seed N / E / S / W seeds square to the MODEL's axes and names from north.

---

## 5. Conflicts checked

| System | Finding | Action |
|---|---|---|
| North Direction (46) | Read only: `FacingWordForAzimuth`, `TrueBearingForAzimuth`, its changed event | None needed. Closes its open item "the Elevations dev menu still names by axis" |
| Viewport identity / drawing titles (51) | An elevation's title came from the compass word unless the VIEWPORT was named, so a chosen record name never reached a sheet | Additive hunk: a record whose flag is `false` lends its name where the viewport has none. Absent never promotes. Proved: EXISTING COACH HOUSE EAST ELEVATION |
| Drawing Planes (47) | Its grip writes records through the source adapters | Adapters claim the draft first; nothing in 47 edited |
| Rename drawing (40) | Its `Apply` saves by itself, which a draft cannot use | Two Stage functions added beside it; `Apply` untouched (the scenes editor still uses it) |
| Presentation Scenes editor (21) | Saves the presentation block on its own, so anything of a draft written there early would leak | The card's camera and name are now written on Update only |
| Layout Editor saves, register, north save | All call `Na__DrawData__Save` | Covered by the payload guard |
| Snapshot fingerprints (51) | Include the scene name | Restamped by the staged rename, undone if the save fails |
| Floor plan storey levels (peer session, v2.87.0) | New record key `FloorPlan__StoreyLevel`, its row sits in the rebuilt plan row | A draft edit like any other, not a "moves the drawing" key; a revert announces it |
| Service worker | New exports on cached modules | Token `2026-09-20-3` |
| ValeVision | Reads the same records | `Elevation__NameIsAuto` is ignored there. NOT ported |

---

## 6. Decisions that are mine until Adam confirms them

1. **Edits show live but are only kept by Update.** He asked for a confirmed Update; the draft (and
   the prompt on leaving a changed row) is how I made "less brittle" true. The alternative - edits
   that do not show until Update - would make the sliders blind.
2. **The bearing is kept, under Advanced, as "Model bearing".** His box in image 4 includes it. A
   building square to nothing still needs a typed bearing, and Aim at face writes the same number.
3. **Update off screen keeps the settings and leaves the thumbnail.** It could instead insist on a
   preview first.
4. **A new drawing, a delete, "Add to Scenes" and "Let clients measure" save at once**, without the
   Are-you-sure (delete has its own). None of them moves an existing drawing.
5. **A chosen elevation name goes onto sheet titles.** He did not ask for it; without it his coach
   house example titles wrongly.
6. **Sections are auto-named "North Section".** Probably typed over in practice ("Section A-A").

---

## 7. Ledger

| Date | Version | What |
|---|---|---|
| 20-Sep-2026 | v2.86.0 | Built and tested as above. Node 51 checks; in-app on PS01 with every write faked or refused |
| - | - | **Next:** Adam's test. Then the ValeVision question. Then the Cross Sections system itself |
