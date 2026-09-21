# TrueVision3D - PLAN - Floor Areas
# =========================================================
#
# FILE     : TrueVision__PLAN__FloorAreas__.md
# PURPOSE  : The map, the decisions, the traps and the ledger for the floor area measuring
#            and area data reporting system in the Layout Editor
# CREATED  : 21-Sep-2026
# AUTHOR   : Adam Noble - Noble Architecture (brief) / built with Claude
#
# ---------------------------------------------------------


---------------------------------------------------------
## 1. The brief (Adam, 21-Sep-2026)
---------------------------------------------------------

> In the layout editor, build out a comprehensive system for being able to draw out floor areas.
> Effectively create a new floor area measuring dropdown and put it below the patterns one. When
> unfolded, it effectively uses most of the system we've already got for drawing the vectors, but
> then measures the enclosed shape and then has some controls.
>
> You should be able to flip it on or off, and it should be on its own new layer. In the drawing
> layers, have floor areas. The aim is you can effectively draw around the perimeter of a room,
> close it, and then capture the data because you should be able to name the area. The text should
> appear in the middle of the area, and you should have the ability to colour the area and change
> the opacity, etc. You should be able to create a table that's created. You should be able to
> drag, drop, manipulate, and move around an area calculation table. Make this area calculation
> table a parametric block so it can be dragged in or out of the parametric block scrapbook. This
> will be a new parametric block that links to a floor area index. In the floor area index, you
> should be able to group certain floor areas into groups, and then those groups can be reported.
> If, for example, you make a group for ground floor and the user names every room or every one of
> the area measurements to a room, then you could sum each floor and sum those different groups.
> You could create two dynamic tables:
>
> * One that finds all the groups of areas that the user can set up, which could be floor areas.
> * The user can get creative with this, but effectively we need a way to capture area data, then
>   name each area, and then be able to group sets of areas, etc.
>
> This in the build a new feature folder for it to go in, and then put the dynamic scrapbook items
> in the correct folder.
>
> In conclusion, you are going to build an extremely robust, user-friendly, and well-integrated
> area measuring and area data reporting system. A house can have its areas measured per room, and
> then the rooms, if needed, tallied into bigger conglomerations, such as floors. The tables can be
> dragged around anywhere on the layout because they're just dynamic blocks that then stay in tune
> if the special layout vectors are stretched. The layout area vectors are special and will be on
> their own layer that can be toggled on and off. A lot of the time, they will probably be switched
> off and will just be used as an overlay for reporting, but then hidden and switched on again if
> needed to remove the vertices around.
>
> That brings me to my next point: all of the controls that exist for a regular vector item should
> be the same with these areas. They are effectively just a closed shape, but you're using the
> scale of the viewport they're drawn over, or the ability to right-click on it and change it to a
> set scale or to set the scale in the menu, etc. For all intents and purposes, it's just a special
> vector, so build upon the vector system we've already got. The vector snaps and the way that the
> movement handling and all of that works: have a really good deep dive into that before you think
> of coding anything up.

---------------------------------------------------------
## 2. The one decision everything else follows from
---------------------------------------------------------

**A FLOOR AREA IS A VECTOR SHAPE CARRYING ONE EXTRA BLOCK.** It is an ordinary record in
`Sheet__Shapes` with `Shape__Area : { ... }` on it - exactly the idiom `Shape__Hatch` and
`Shape__Qr` already follow - and it sits on a layer of a new type, `'area'`, called **Floor Areas**.

Everything Adam asked for in his last paragraph then costs nothing, because it is not written
twice: the deep dive found that **not one of the sixteen files in the select / drag / snap / grip
pipeline ever tells one kind of shape from another**. An area therefore inherits, with no new code:

| Inherited free | Where it already lives |
|---|---|
| Drawing it point by point, with snapping to the drawing's linework | `ShapeTool__`, `Snapping__` |
| The first point as a real snap target, so a room closes exactly on it | `ShapeTool__:181` `OwnExclusion` |
| Shift axis hold, arrow-key axis lock, typed lengths at the drawing's scale | `AxisLock__`, `Measurements__` |
| Select, body move (auto-Move on select), nudge, box select, group, copy, paste, duplicate | `SheetTools__*`, `ItemClipboard__` |
| Double-click to open it and drag its vertices; Shift-click to insert one; Delete to remove them | `EditScope__`, `Grips__`, `Keyboard__` |
| Colour, opacity, edge weight, dash, gradient, hatch | `Panel__Shapes__`, the record |
| Draw order, layer visibility and lock, PDF, the read-only web viewer | `DrawOrder__`, `MarkupBridge__`, `PdfExporter__` |
| Undo and redo, the browser draft, Save Sheets | `History__`, `AutoSave__` |

What the feature actually has to build is only the part that is genuinely new: the measurement,
the label, the index and its groups, the panel, and the tables.

---------------------------------------------------------
## 3. The data model
---------------------------------------------------------

### 3.1 The block on a shape

```
Shape__Area : {
    Area__Name              'Kitchen'   (may be '')
    Area__Group             'Ground Floor'  ('' = ungrouped)      <-- a NAME, not an id: see 3.3
    Area__ScaleDenominator  50          (only when FIXED; absent = automatic)
    Area__Label             'both' | 'name' | 'value' | 'none'    (absent = both)
    Area__TextSizeMm        2.4         (absent = the config's)
    Area__LabelDXMm/DYMm    paper offset of the label from its home - the middle of the
                            room's box, or its visual centre for an L or a U - written by a
                            drag in the room's edit mode (absent = at home; both dropped
                            when a drag lands back home, or on Centre the label)
}
```

Kept by `Na__LeRec__NormaliseShapeArea` **only when it is an object**, the rule `Shape__Qr`
follows, so every shape drawn before floor areas existed saves byte-identical. A shape carrying the
block is forced `Shape__Closed = true` (an open area is not an area) and counts as "something to
paint", so it can never be invisible.

### 3.2 The layer

`Na__LeRec__LAYER_TYPES` gains `'area'`. New sheets are seeded with a fifth layer, **Floor Areas**;
an older sheet gets one the first time an area lands on it. The layer is the on/off switch Adam
asked for - hiding it takes the areas AND their labels off the screen, the PDF and the viewer,
while the index and every table go on reporting them, because the data is read from the records and
never from what is painted.

### 3.3 The groups - keyed by NAME, deliberately

```
Sheet__AreaGroups : [ { AreaGroup__Name : 'Ground Floor', AreaGroup__Colour : '#...' } ]
```

Stored only when there is at least one, in display order. **An area names its group rather than
pointing at an id**, which is the one place this design departs from the rest of the codebase, and
it is worth the departure:

- Group ids are per sheet and sequential. `Na__LeClip__InsertSet` remaps group *members* and
  dimension *hosts* and nothing else, so an id held inside a record is pasted raw - copying a floor's
  areas onto the Proposed sheet would have silently filed them under whatever `AreaGroup_002` means
  there. A name means what it says on any sheet, in any project, and through the Custom Scrapbook.
- The reconciler (5.4) appends any group name an area uses but the sheet's list has not got, so a
  pasted area brings its group with it.
- A rename rewrites the entry, every area holding the old name, and every table filtered on it, in
  one announcement - one undo step.

### 3.4 What is NOT stored

The measured area, the perimeter and the scale in force. All three are solved on every read from
the points and the sheet, so an area that is moved onto a 1:100 drawing reports itself at 1:100
with nothing to migrate and nothing that can go stale.

---------------------------------------------------------
## 4. Measuring
---------------------------------------------------------

- **The area** is the shoelace of the paper points, times the square of the drawing scale.
  `m² = |Σ(x_i·y_{i+1} - x_{i+1}·y_i)| / 2 × D² / 10^6`.
- **The perimeter** is the sum of the closed run's edges × D / 1000, in metres.
- **The scale D** is, in order: `Area__ScaleDenominator` when one has been set by hand; else the
  scale of the 2D viewport under the area's visual centre; else the sheet's own scale
  (`Na__LeDrawScale__SheetDenominator`, the scale the title block quotes).
  - The viewport is found **whether or not its layer is visible**, which is where this departs from
    `Na__LeDrawScale__ViewportAt`: hiding the Viewports layer must never change a reported area.
- **A self-crossing outline** is reported as a fault in the panel and on the label rather than
  silently returning the shoelace's cancelled-out nonsense.
- **The label sits in the middle of the room's box** (Adam, after first use) - unless that middle is
  not inside the room at all (an L, a U), when it takes the **visual centre**: the pole of
  inaccessibility, not the centroid, so an L-shaped room labels itself inside the L rather than in
  the garden. `Label__Placement : "visual"` puts every room on the visual centre. The visual centre
  also picks the drawing a room is measured against and sizes the label's shrink to fit, wherever
  the label sits. (Until the label drag, the label sat at the visual centre for every room - which
  on a room with a bay and a chimney breast floats up and sideways, off the middle.)

---------------------------------------------------------
## 5. The five moving parts
---------------------------------------------------------

### 5.1 The label (live)

Pushed by the markup bridge in the shapes pass, right after the shape itself, so it reaches the
screen, the PDF, the web viewer and the scrapbook preview through the one painter that already
serves all four. It is **computed at paint time from the live points**, which is what makes it
follow a vertex drag as the vertex moves - a model listener could not, because a drag is silent
until it is let go.

**Dragging it** (`Na__LayoutEditor__FloorAreas__LabelGrip__.js`). In the room's edit mode (double
click, or Enter) a dashed box stands round the label, drawn by a shape grip provider - the idiom a
picture's corner grips use - so it takes its own presses and no sheet tools file changed. A drag
writes `Area__LabelDXMm/DYMm` silently and announces once on release (one undo step); Escape puts it
back; Shift or Ortho holds the axis; within `Label__HomeSnapPx` of home it snaps home. A press inside
the box within reach of a corner, an Alt press and a Shift press on an edge are handed on to the
sheet tools untouched, and only Select and Move drag the label.

### 5.2 The tool

One new tool, `TOOL_AREA` ('area'), on the toolbar and on **A**. It is a thin adapter over the two
tools that already exist: polygon mode drives `ShapeTool__` and rectangle mode drives
`RectangleTool__`, both handed area defaults and the Floor Areas layer. Finishing always closes.
The adapter exists so that each of the six dispatch sites (press, move, release, double-click,
right-click, the keyboard, the Measurements box) gets **one** branch rather than two.

### 5.3 The panel - "Floor Areas", right column, below Patterns

Show / lock the layer · Draw (polygon or rectangle) · the selected area's name, group, colour,
opacity, label and scale, with its measurement read out in words · the settings new areas take ·
**the index**: every area on the sheet under its group heading with a subtotal, ungrouped last, a
total at the foot, and the group management (add, rename, recolour, reorder, delete, paint its
areas) · and the two buttons that drop a table.

### 5.4 The reconciler and the follower (one before-announce hook)

Registered with `Na__LeModel__RegisterBeforeAnnounce`, so its silent edits are carried by the
announcement they run ahead of and one change is one undo step - with a correct **redo**, which is
the fault that a capture-phase listener produced on the scale bar in v2.76.0. It does three things,
in this order, and nothing else:

1. **Reconcile** - any group name an area uses that the sheet's list has not got is appended.
2. **Adopt** - a table that has just landed (a drop, a paste, a scrapbook item) is filled with this
   sheet's real data.
3. **Follow** - every area table whose stored data no longer matches the sheet is regenerated
   silently. Cheap: the data is compared as one JSON string, so nothing is rebuilt when nothing moved.

A `Refresh` booked on `'active'` and `'loaded'` catches the case with no announcement to run ahead
of - a sheet opened later whose tables were saved by an older build.

### 5.5 The tables - one parametric type, two tiles

`AreaSchedule`, in `57__Feature__ScrapbookParametric/` with the other element types, because that is
where a dynamic block belongs. Two presets:

- **Area Schedule** - a row per area, optionally under group headings with subtotals, and a total.
- **Area Summary** - a row per group with its total, and a grand total.

The type is **pure** - parameters in, records out - like every other. The sheet's data reaches it as
a parameter (`Data`), filled by the hook above, which is the same "facts are parameters" idiom the
Drawing Title uses for Existing / Proposed / North. So the table draws under Node, in the tile
preview, and in the drag ghost, and what it shows is exactly what is stored.

---------------------------------------------------------
## 6. Shared code touched (additive, and why each is unavoidable)
---------------------------------------------------------

| File | Change | Why |
|---|---|---|
| `SheetRecords__.js` | `'area'` in `LAYER_TYPES`; `NormaliseShapeArea`; `NormaliseAreaGroups`; Floor Areas in the default layers | else an `'area'` layer becomes `'mixed'` and the block is never tidied |
| `SheetModel__Shapes__.js` | `UpdateShape` takes `area` (replaced whole, as `qr` is); `InsertShape` puts an area shape on an area layer | `UpdateShape` writes a fixed list of keys, so the block cannot be written at all today |
| `SheetModel__Layers__.js` | `DeleteLayer` re-homes **shapes** as it re-homes everything else | it does not today: delete a layer and its vectors keep a dangling id |
| `SheetModel__AreaGroups__.js` | NEW unit: the group list's CRUD, announced `'areas'` | a content edit must not announce `'sheet-updated'`, which writes the whole project to R2 |
| `History__.js` | `'areas'` in `STEP_REASONS` | an unlisted reason is **not a step**, and the next step swallows it |
| `ModeController__.js` | `'areas'` routed to a markup redraw and to the panel; the Floor Areas panel registered after Patterns; an area selection opens the Floor Areas section | else an area edit repaints nothing |
| `MarkupBridge__.js` | one line in the shapes pass: push the area's label | the one painter for screen, PDF, viewer and preview |
| `ShapeGeometry__.js` | `Hit` counts the inside of an area | an area with no fill could only be clicked on its edge |
| `SelectionBox__.js` | an area's part is `area : true` | a box drawn inside a room selects it |
| `ItemClipboard__.js` | paste keeps an area on an area layer | `LayerFor(..., 'vector')` would move it |
| `ScrapbookCustom__.js` | a saved area loses its group and its fixed scale | they mean nothing in another project (the `Leader__SpecNoteId` precedent) |
| `Keyboard__.js` | Delete refuses to take an area below three vertices | the vector floor is two |
| `SheetTools__State__/ToolState__/PointerPress__/PointerDrag__/Keyboard__/ContextMenu__`, `Measurements__`, `Toolbar__` | the new tool's six dispatch sites | a tool is a parallel path; missing one is the v2.98.0 fault |
| `Panel__Layers__.js` | `'area'` → "Floor Areas" in the type labels | else the select reads the raw string |
| `Panel__ScrapbookParametric__.js`, its config | the table type registered; its controls in the element settings | where a selected block's settings live |
| `AppConfig__.json`, `KeyMappings__.json` | the Floor Areas block, `floor-areas` in the accordion, the **A** binding | |

---------------------------------------------------------
## 7. Phases
---------------------------------------------------------

| Phase | What | State |
|---|---|---|
| 0 | The deep dive and this plan | done |
| 1 | The record, the layer, the pure geometry, the model plumbing | done |
| 2 | The label, the hit test, the box select | done |
| 3 | The tool and its six dispatch sites | done |
| 4 | The panel and the index | done |
| 5 | The context menu | done |
| 6 | The parametric tables and the follower | done |
| 7 | Node tests and the in-app test on a scratch sheet | done |
| 8 | DEVLOG (v2.104.0), ledger, service worker note, memory | done |
| 9 | ValeVision - only once Adam has signed TrueVision off | open |

---------------------------------------------------------
## 8. Traps (found in the survey, before a line was written)
---------------------------------------------------------

- **An unlisted change reason is not an undo step.** `Na__LeHist__STEP_REASONS` drops anything it
  does not list, and worse than losing the undo, it leaves the baseline stale so the NEXT step
  swallows the change. `'areas'` is listed.
- **`Na__LeModel__UpdateShape` writes a fixed list of patch keys.** A block that is not in the list
  cannot be written; one that is not in `Na__LeParam__ShapePatch` is written once and never updated.
- **`InsertShape` forces every shape onto a `'vector'` layer**, so a paste, a duplicate and every
  scrapbook drop would pull an area off the Floor Areas layer. `CreateShape` honours an explicit
  `layerId`, which is the clean way in.
- **The eyedropper's trait table filters multi-selection writes** (`ApplyToSelection` →
  `ApplyMany` → `StyleOnly`). An `area` patch key would be silently dropped, so the panel writes
  each selected area itself, silently, and announces once.
- **A vertex drag is silent until it is let go.** Anything derived that must move WITH the drag is
  computed in the painter; anything derived that may wait is done in the before-announce hook.
- **Test redo, not only undo.** A follower that runs after the history gives a right undo and a
  stale redo.
- **`DeleteLayer` does not re-home shapes** (it re-homes viewports, text, dimensions and leaders),
  so deleting the Floor Areas layer orphans its areas.
- **`Na__LeScrapCustom__PortableRecord` keeps every unknown key**, so an area would carry its
  group into another project.
- **The label must not read a viewport's layer visibility.** `Na__LeDrawScale__ViewportAt` skips
  hidden layers, which would change a reported area when the Viewports layer is switched off.

---------------------------------------------------------
## 9. Decisions Adam may want to overturn
---------------------------------------------------------

| Decision | Why it was made this way |
|---|---|
| An area belongs to **one** group | A table of groups that double-counted would be worse than useless; a second axis can be added later without moving the record |
| The index and the tables read **this sheet** | Undo and the draft are per sheet; the table's parameters already carry a `Source`, so the whole project is a later switch, not a redesign |
| Areas are reported in **m²**, with ft² offered | UK planning is m²; estate agents want ft² |
| Two decimal places | 18.45 m² is how a room schedule reads |
| A new area takes the panel's current group and its colour | So a floor can be drawn in one pass without touching the panel between rooms |
| Dropping or pasting an area onto a hidden Floor Areas layer turns the layer on | Otherwise the paste is invisible and reads as a fault |
| A Floor Areas layer a sheet makes for itself goes straight **over** the frontmost drawing (v2.106.0) | A plan's Base Image is an opaque picture: a room under it would vanish, which reads as a fault. Dragging the layer below Viewports gives the tint UNDER a vector-only plan's lines, which is how RB05 D02 is set up |
| Selecting a viewport folds the whole fold group; the **Viewport** section itself stays outside the group (v2.106.0) | Adam asked for Floor Areas and Patterns to be open only when active. Whether the Viewport section should fold when markup is selected is the next question, not answered here |
| The Layers panel's **Add** still adds at the bottom of the list, which is now the back of the stack (v2.106.0) | Unchanged on purpose; a layer made BY the app (Floor Areas, Vectors) goes over the drawings instead |
| A label's home is the middle of the room's **box**, and the visual centre only where that middle falls outside the room | Adam asked for the box as the standard. The fallback is this build's own addition: without it an L or a U would label the garden or the room next door, and every one would need dragging |
| A label drags only in the room's **edit mode**, not whenever the room is selected | Adam asked for edit mode. Selected, a press on a room picks up Move and carries the whole room; a label that answered there would make every room awkward to move |
| **Centre its label** is not on the right-click menu while the room is open | That menu is the points menu, which the Vector Tools work is rebuilding. In edit mode the label is re-centred by dragging it back (it snaps home) or by the panel's Centre the label |

---------------------------------------------------------
## 10. Ledger
---------------------------------------------------------

| Date | Entry |
|---|---|
| 21-Sep-2026 | Plan opened after a read-only deep dive: the vector record and its normalisers, both drawing tools, the markup painter, the parametric engine and its four types, and three parallel surveys (drag/snap/grip, clipboard/PDF/history/layers, panels/tools/menus). Section 8's traps all come from that survey. |
| 21-Sep-2026 | Phases 1-7 built and tested. Every trap in section 8 was hit in the code as written, and each one is closed where the trap says: `'areas'` in `STEP_REASONS`, `area` in the `UpdateShape` patch list (merged, `null` clears), `CreateShape` taking an explicit `layerId`, the panel writing each selected area itself rather than through `ApplyMany`, the label solved in the painter so it follows a vertex live, `DeleteLayer` re-homing shapes, `PortableRecord` stripping `Area__Group` and `Area__ScaleDenominator`, and `Na__LeArea__HostViewport` finding a viewport whether or not its layer is shown. |
| 21-Sep-2026 | **Fault 1, found in the app, not in a test: a schedule rebuilt itself on every announcement.** The stored `Data` had been through the type's `normalise` and the freshly-read `Data` had not, so the two JSON strings differed by key order alone (`Colour` before `Count`) and never matched. Every announcement regenerated every table and dirtied the sheet behind the user. Both sides now go through `definition.normalise` before the compare and before the regenerate. Re-measured in the app: `dataNowInStep:true`, `idleAnnouncementRebuildsNothing:true`. The general lesson, worth carrying to the next parametric type: **compare normalised against normalised, never stored against raw.** |
| 21-Sep-2026 | **Fault 2: the index's group headings read "G" and "F...".** A Paint button was squeezing the name out of its own row. Removed - the swatch beside the name repaints the group, which is where anyone looks first anyway. |
| 21-Sep-2026 | **Fault 3: a schedule's group heading sat 1.6 mm low**, because `GroupGapMm` was added to the band top and again to the baseline. Fixed by taking the band top first and the baseline from it; two row-spacing checks added so it cannot come back. Found by measuring the SVG the app writes, not by reading the code. |
| 21-Sep-2026 | Rounding: `toFixed` gives `(18.45).toFixed(1) === '18.4'`. Both the label formatter and the schedule formatter now round half away from zero, and a test pins them to each other on 18.45, 0.05, 2.675, 1234.565, 0, 99.995 and 78.25 at 0-3 dp. A label and a schedule disagreeing about the same room is the one fault nobody would report as a fault. |
| 21-Sep-2026 | Visual centre: the first cut took 17 ms on a 48-point comb. Binary-heap search plus a precision of `max(0.5 mm, size/60)` and a convex fast path: 3.73 ms on that comb, 0.105 ms on a six-point L, 0.6 µs on a rectangle - fast enough to solve inside the painter, which is what makes the label follow a vertex being dragged. |
| 21-Sep-2026 | In-app test on PS01 behind a fetch guard allowing only `POST .../r2/read`: zero writes, every real sheet byte-identical afterwards, draft key cleared, snapping unchanged. Proof rendered through the app's own `ToSvgMarkup` rather than a screenshot, after the Browser pane timed out repeatedly. Two readings along the way were misleading and had to be re-taken - `ListOnSheet[0]` was a DrawingTitle, not my table, and "Kitchen" appears both as a label and a schedule row, so its presence proved nothing until the occurrences were counted (2 shown, 1 hidden, 2 back on). |
| 21-Sep-2026 | Released as **v2.104.0**. No new service-worker token: the one on disk (`2026-09-21-01`) was already ahead of the deployed `2026-09-20-14` and had not shipped, so one eviction covers this release too - but it is required, because the new modules import new exports from `Na__LayoutEditor__SheetModel__` and a warm cache holding the old copy would fail to link them. A log entry saying so is in the service worker's own header. |
| 21-Sep-2026 | Phase 9 (ValeVision) stays **open** - and stays open until Adam has used this in TrueVision and said it works. |
| 21-Sep-2026 | **Adam's first use (RB05 D02, "Kids Lounge"), three notes.** (1) The Floor Areas layer sat UNDER Viewports in the list and was still drawn OVER the plan's linework. (2) A toggle to switch the outline off and see only the fill. (3) Floor Areas and Patterns stand open when not in use - they should open and fold with the others, as Vectors, Text and Leaders do. |
| 21-Sep-2026 | **(1) was not a floor-area fault.** The Layers list had never been the paint order for anything but viewports against each other (D31, "top of the list draws frontmost", half built): the screen put every frame in one box under every SVG, the markup painter went kind by kind and never read the list, the PDF printed all viewports then all markup then all chrome, and frames were opaque white. Fixed at the root as **v2.106.0**: `Na__LayoutEditor__PaintOrder__` is the one back-to-front plan, and the screen (frames and SVG slots interleaved in `div.na-le-paper__stack`), the PDF and the web viewer paint from it; hit tests ask front to back; frames are clear. Old sheets are restacked once on load (`Sheet__LayerStack : 2`) so nothing they showed ends up under a picture - PS01's 3D Images and Site Plan and all three stored RB05 sheets moved, PS01's Floor Plans and Elevations (already in order by Adam's hand) did not, and a Floor Areas layer under a drawing is never moved. The rule first missed RB05 TEMP__Plans as stored - one viewport over three EMPTY layers, so nothing was buried yet - and was widened to count what an empty layer is for; found in the app, not by the test, which now carries that case. |
| 21-Sep-2026 | **(2)** Outline switches in the panel (selected, several, New areas) and **Show its outline** on the room's menu, all writing the vector's own `Shape__Stroked` (`Na__LeArea__Restyle` is the one-step write for the menu). On the way: Vectors > Edges with several shapes selected wrote ONE fill colour to all of them - a floor's coloured rooms came out one blue - now fixed. **(3)** Patterns joins the fold group; a viewport folds the group, and a single site plan viewport opens Patterns. The v2.57.0 "Still open" note about viewports leaving the folds alone is closed by this. |
| 21-Sep-2026 | Proved in the app on PS01 and RB05 behind the write guard (zero writes attempted): a room drawn over a plan and then moved under it flips the browser's own `elementsFromPoint` order at the room, and moves in the PDF's page operators from after the viewport's clip to before it. The test page was reloaded once by a service-worker update (another session had changed the worker's script), which took the guard with it; the worker was unregistered for the test origin after that, and nothing had been edited in the gap. |
| 21-Sep-2026 | **v2.125.0 - the label, from Adam's second note.** He asked for the label to start in the middle of the room's bounding box and to be draggable in edit mode, saving where it was put. It had been at the visual centre, which on RB05's Formal Lounge (a bay, a chimney breast, a recess) floated 5.79 mm up and right of the middle. Home is now the box middle, falling back to the visual centre only where that middle is outside the room (`Na__LeAreaGeo__LabelHome`, 11 new Node checks). The drag is `Na__LayoutEditor__FloorAreas__LabelGrip__`, a shape grip provider that takes its own presses, so no sheet tools file changed while two other sessions were working in them. Proved in the app on RB05 D10 with trusted mouse drags: one undo step per drag, the snap home dropping both keys, Escape, a corner winning over the words, Shift holding the axis, the label travelling with the room; zero writes attempted and the sheet byte-identical afterwards. NOT tried by Adam. |
