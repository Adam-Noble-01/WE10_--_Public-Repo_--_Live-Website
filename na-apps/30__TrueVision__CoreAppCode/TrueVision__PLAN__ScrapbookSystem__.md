# TrueVision3D - PLAN - The Scrapbook System
# =========================================================

**Opened:** 19-Sep-2026  -  **Author:** Adam Noble - Noble Architecture
**Status:** Phases 0 to 4c built and tested by Claude; awaiting Adam's sign-off in his own browser.
Section 9 is the live ledger; section 10 audits the original brief against what exists.

Adam's brief (19-Sep-2026): "I need a way to be able to save and insert common elements, but we
need two versions in the main drawings: a custom scrapbook, and a parametric element scrapbook.
Set both up as different subsystem folders... because both will function very differently."
The first parametric element is the scale bar he draws by hand under every drawing title.

---------------------------------------------------------
## 1. The map - what the scrapbook system plugs into
---------------------------------------------------------

The Layout Editor is `02__Src__AppModules/51__System__LayoutEditor/`, sixteen numbered folders.
Only the ones the scrapbooks touch are listed.

| Folder | What it owns | How the scrapbooks use it |
|---|---|---|
| `05__Core__ModeController` | Builds the shell, registers every panel section | Two new `Register()` calls |
| `07__Core__SheetData` | Sheet records, the model, history, scales | Records are inserted, updated and deleted through the model only |
| `10__Core__SheetSurface` | The paper, its SVG layers, the handles layer | Parametric grips draw into the handles layer |
| `15__Core__Markup` | Groups, geometry, the primitives builder | A parametric element IS a group; previews use the primitives builder |
| `20__System__Viewports` | Viewport frames, handles, scale | The viewport link reads `Viewport__ScaleDenominator` and the frame |
| `30__System__SheetTools` | Pointer, keys, grips, clipboard, context menu | `ItemClipboard.InsertSet` is the one door every drop goes through |
| `40__Ui__Panels` | The panel host and the property panels | New sections register with the host like every other |
| `55__Feature__Scrapbook` | The v2.53.0 Scrapbook: config items for site plans | Becomes the shared host: preview, tile drag, drop |

Five facts the design rests on, each checked in the code or proved in the app:

1. **A group record keeps keys it does not know.** `Na__LeRec__NormaliseGroup` rewrites
   `Group__Members` and nothing else, the clipboard clones the whole record, and `InsertGroup`
   is handed `{ ...record, Group__Members }`. So a `Group__Parametric` block survives a load, a
   save, a draft, an undo, a copy and a paste with no change to any of them.
2. **The history de-duplicates identical snapshots** (`if (next === entry.current.json) return`).
   Any number of silent edits followed by one announcement is one undo step.
3. **The handles layer is cleared by class** (`.na-le-selection, .na-le-handle, .na-le-grip`), and
   the stage listens for `pointerdown` in the bubble phase. A grip element that carries
   `na-le-grip`, takes pointer events and stops propagation owns its own press without a line
   changed in the pointer pipeline.
4. **The app's scales are 1:20, 1:50, 1:100 (architectural) and 1:500, 1:1250 (site plan).**
5. **Nothing can run "before the history" by listening.** The model dispatches its change event
   ON `window`. For an event whose target IS window, listeners fire in the order they were
   added; the capture flag does not reorder them (proved in Chrome 152, 19-Sep-2026 - capture
   only comes first for an event travelling THROUGH window from something beneath it). The
   history is added first, so it always snapshots first. The first build of the viewport link
   assumed otherwise, and a test of REDO caught it: see 4.5 and the traps.

---------------------------------------------------------
## 2. The three libraries
---------------------------------------------------------

| Library | Folder | Items are | Authored by |
|---|---|---|---|
| Standard | `55__Feature__Scrapbook` | Pieces in a config JSON | A developer, in the repo |
| Custom | `56__Feature__ScrapbookCustom` | One JSON file each, in the user content folder | Adam, from a selection on a sheet |
| Parametric | `57__Feature__ScrapbookParametric` | Scripted generators with parameters | A developer, one module per element |

All three drop through `Na__LeClip__InsertSet`, so whatever lands is ordinary sheet records: it
moves, copies, prints, exports, ungroups and undoes like anything drawn by hand. **No new record
kind is introduced.** That was the deciding trade: a new `Sheet__Parametrics` collection would
have needed a hand in the markup bridge, hit resolution, selection, the move tool, the
clipboard, draw order, the eyedropper, snapping, the PDF exporter and the web viewer, and then
the same again in ValeVision.

---------------------------------------------------------
## 3. Folder and file layout
---------------------------------------------------------

```
51__System__LayoutEditor/
    55__Feature__Scrapbook/                                  THE HOST (exists; gains one module)
        Na__LayoutEditor__Scrapbook__.js                       Na__LeScrap       standard items, PreviewSvg
        Na__LayoutEditor__Scrapbook__TileDrag__.js             Na__LeScrapDrag   NEW: one tile, its drag, its ghost, its drop
        Na__LayoutEditor__Scrapbook__Config__.json
        Na__LayoutEditor__Panel__Scrapbook__.js                Na__LePanelScrap  the Standard section

    56__Feature__ScrapbookCustom/                            NEW
        Na__LayoutEditor__ScrapbookCustom__.js                 Na__LeScrapCustom    the library: index, items, capture, build
        Na__LayoutEditor__ScrapbookCustom__Transport__.js      Na__LeScrapCustomIo  read the files; save through the local server
        Na__LayoutEditor__ScrapbookCustom__Config__.json
        Na__LayoutEditor__Panel__ScrapbookCustom__.js          Na__LePanelScrapCustom
        Na__LayoutEditor__Styles__ScrapbookCustom__.css

    57__Feature__ScrapbookParametric/                        NEW
        Na__LayoutEditor__ScrapbookParametric__.js             Na__LeParam       the engine: types, the block, insert, regenerate
        Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js   Na__LeParamBar    element one: parameters in, records out
        Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js  Na__LeParamLink  THE LINK TO THE VIEWPORT SYSTEM
        Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js Na__LeParamTitle the drawing title: title, underline, optional bar, written from its viewport's facts
        Na__LayoutEditor__ScrapbookParametric__Grips__.js      Na__LeParamGrips  the stretch grip and the lookup grip
        Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js Na__LeParamNoodle the noodle to what an element is tied to, and the socket that re-ties it
        Na__LayoutEditor__ScrapbookParametric__Config__.json
        Na__LayoutEditor__Panel__ScrapbookParametric__.js      Na__LePanelParam  the library section and the properties section
        Na__LayoutEditor__Styles__ScrapbookParametric__.css

30__TrueVision__CoreAppCode/
    51__LayoutEditor__UserScrapbookContent/                  THE LOCAL REPOSITORY (Adam made it)
        UserScrapbook__Index__.json                            written by the server on every save
        01__ScrapbookItems__General/ ... 05__ScrapbookItems__GeneralNotes/
        00__Deleted__Quarantine/                               a delete moves the file here; nothing is unlinked

na-apps/
    ProjectVision__TrueVisionScrapbook__Api__.py             NEW Flask blueprint: /api/truevision/scrapbook
```

---------------------------------------------------------
## 4. The parametric engine
---------------------------------------------------------

### 4.1 The block on the group

```json
"Group__Parametric": {
    "Parametric__Type"    : "ScaleBar",
    "Parametric__Version" : 1,
    "Parametric__Params"  : { "ScaleDenominator": 50, "Divisions": 5, "DivisionMm": 1000,
                              "SubdivideFirst": false, "SubdivisionMm": 200 },
    "Parametric__Link"    : { "Link__SheetId": "Sheet_002", "Link__ViewportId": "Viewport_001" }
}
```

- **The anchor is never stored.** The Move tool, the arrow keys and a paste shift a group's
  members and know nothing about this block, so a stored anchor would go stale on the first
  move. The generator always writes the element's origin as the first point of the first
  member, and the engine reads it back from there.
- **Regeneration edits in place.** Existing members are updated slot for slot, extra ones are
  inserted, left-over ones are deleted. Ids stay put, so the draft and the undo snapshots barely
  change, the element keeps its place in the draw order, and it stays on whatever layer Adam
  moved it to.
- **Ungroup is explode.** The members stay as plain vectors and text; the block goes with the
  group record. Exactly what exploding an AutoCAD block does.

### 4.2 An element type

A type is a module that registers `{ type, name, defaults(scale), build(params), grips(...) }`.
`build` is pure: parameters in, records out, in paper millimetres from an origin of (0, 0). It
knows nothing of sheets, ids, layers or the DOM, so it runs in Node and is tested there.

### 4.3 The scale bar (element one)

Measured from PS02's hand-drawn bars (D21 Floor Plans, D22 Elevations, A2, 1:50):

| Part | Value |
|---|---|
| Cells | 5 of 20 mm (1 m at 1:50), in two rows of 1 mm: 100 x 2 mm |
| Checker | Top row filled on odd cells, bottom row on even cells |
| Fill / edge | `#666666` / `#172b3a` at 0.2 pt; an empty cell has no fill at all |
| Numerals | Open Sans 400, `#172b3a`, centred on each division, baseline 5.314 mm under the bar |
| Numeral size | 2.5 mm at the two ends, 2 mm between |

**Standards per scale.** Changing the scale puts the bar back to its standard, as Adam asked.
Every listed scale lands on a 100 mm bar, and all but two on the house 5 x 20 mm:

| Scale | Division | Count | On paper | Reads |
|---|---|---|---|---|
| 1:1 | 10 mm | 10 | 10 x 10 mm | 0 ... 100 mm |
| 1:2 | 50 mm | 4 | 4 x 25 mm | 0 ... 200 mm |
| 1:5 | 100 mm | 5 | 5 x 20 mm | 0 ... 500 mm |
| 1:10 | 200 mm | 5 | 5 x 20 mm | 0 ... 1000 mm |
| 1:20 | 500 mm | 4 | 4 x 25 mm | 0, 0.5, 1, 1.5, 2 m |
| 1:25 | 500 mm | 5 | 5 x 20 mm | 0 ... 2.5 m |
| **1:50** | **1 m** | **5** | **5 x 20 mm** | **0 1 2 3 4 5 m (the house bar)** |
| 1:100 | 2 m | 5 | 5 x 20 mm | 0 2 4 6 8 10 m |
| 1:200 | 5 m | 4 | 4 x 25 mm | 0 5 10 15 20 m |
| 1:250 | 5 m | 5 | 5 x 20 mm | 0 ... 25 m |
| 1:500 | 10 m | 5 | 5 x 20 mm | 0 ... 50 m |
| 1:1000 | 20 m | 5 | 5 x 20 mm | 0 ... 100 m |
| 1:1250 | 25 m | 5 | 5 x 20 mm | 0 25 50 75 100 125 m |
| 1:2500 | 50 m | 5 | 5 x 20 mm | 0 ... 250 m |

A scale not in the table is solved: the 1-2-2.5-5 x 10^n division nearest 20 mm on paper, and
the count nearest 100 mm. **Split first division** cuts the first division into sub-cells in the
same checker (200 mm at 1:50: five 4 mm cells), without a numeral of their own.

### 4.4 The grips - the AutoCAD dynamic block feel

- **Stretch** (an arrow at the far end): drag to add or remove whole divisions, live. One undo
  step on release. A change of scale puts the length back to the standard.
- **Lookup** (a triangle above the zero end): click for a menu of scales, From viewport, Split
  first division, and Reset length.

- **Link** (a round socket off the top of the far end): the noodle to what the element is
  tied to leaves from it, and it is dragged to re-tie it. See 4.6.

### 4.5 The viewport link - its own module

`Na__LeParamLink` is the only parametric module that knows what a viewport is.
- **Nearest.** On a drop, the 2D viewport nearest the element, within `MaxLinkDistanceMm`.
- **Two kinds of link.** `{ Link__SheetId, Link__ViewportId }` ties an element to a viewport;
  `{ Link__SheetId, Link__Kind : 'sheet' }` ties it to THE SHEET'S OWN SCALE, the one the
  title block quotes. An element dropped out of reach of any drawing is tied to that, so it
  still follows something. `Describe` says which, for the panel, the menu and the noodle.
- **Resolve.** A link names a sheet AND what on it. A link whose sheet is not the one the
  element is on (a paste to another sheet, a custom item dropped in another project) is
  broken, and a broken link reads as no link: the element keeps the scale it had.
- **Follow.** It is registered with the model as a before-announce hook
  (`Na__LeModel__RegisterBeforeAnnounce`), which `Touch` runs just before it dispatches. It
  rebuilds the bar silently, so the one announcement - and the history's one snapshot of it -
  already holds the new scale and the new bar: one Ctrl+Z puts both back and one Ctrl+Y
  brings both forward. `Touch` runs no hooks for a restore, so an undo is never followed.
- **Adopt.** A Custom Scrapbook item holding a scale bar is saved with the link removed.
  `InsertAdopting` runs the drop and links what arrived by the same hook, inside the drop's
  own announcement: the drop and the re-link are one undo step, and redo brings the bar back
  linked.

### 4.6 The link noodle

Adam's image 3 drew it in blue, from the scale bar to the drawing, labelled LINK: "so you can
see what it is tied to". `Na__LeParamNoodle` is a second group grip provider.
- **Selected:** a noodle runs from the socket to a cap on the nearest edge of the viewport it
  is tied to, and that viewport's frame is outlined. Tied to the sheet's scale, it runs to the
  title block's Scale cell instead. Tied to nothing: a HOLLOW socket and no noodle, so
  "is this bar following anything?" is answered by looking at it.
- **Drag the socket** (the red DRAG arrow in image 3 runs from the bar to the title block's
  Scale cell): a dashed live noodle follows the pointer and what it is over lights up. Let go
  on a 2D viewport to tie to it, on the title block for the sheet's scale, on bare paper to
  untie. Escape cancels. Each is one undo step and a toast, since an untie is invisible.
- **SVG in the handles layer**, drawn in millimetres on a viewBox the size of the page, every
  width divided by the zoom. It keeps the `na-le-grip` class so the grips' clear takes it.
- **The Scale cell is FOUND, not worked out:** it is read off the Scale label the chrome SVG
  already holds at the cell's left padding. The title block lays its cells out privately, and
  was being re-laid-out by another session the same evening; copied arithmetic would have
  broken within the hour.

### 4.7 The Scrapbook tab

Adam's image 4 boxed the top of the right column in green: a tab. The right column now has two,
**Properties** and **Scrapbook** (`Na__LePanels__RegisterTab`). All three libraries sit on
Scrapbook; every section that was in the right column is on Properties, which is registered
first so it is theirs by default. The left column is back to the sheet and its layers.
- Both tabs are styled alike - the sheet tab strip's look, a size down. Which is up is said by
  weight and the join to the column, never by a mark one has and the other lacks.
- A drop does not switch tabs: several items are usually placed in a row. The settings of what
  was dropped are one click away on Properties, and its grips are on the sheet already.
- A section off its tab is put away by `is-off-tab`, never by `hidden` (that is
  `SetSectionVisible`'s), and `Refresh` passes it by - so the Custom library's files are not
  read until the Scrapbook tab is first opened.

---------------------------------------------------------
## 5. The custom scrapbook
---------------------------------------------------------

- **Capture.** Select anything on a sheet, name it, pick a category, Save. The selection is read
  through `Na__LeClip__CopyItems`' own rules (vectors, text, leaders, dimensions, groups nested
  to any depth), rebased so its top-left is (0, 0).
- **Made portable on the way out.** Layer ids, a dimension's viewport, a bubble's specification
  link and a parametric element's viewport link are all sheet or project facts. They are
  removed, so a PS01 item is safe on a PS02 sheet. Viewports are refused: they carry a scene,
  a snapshot and a model source.
- **One file per item**, in the category folder, plus `UserScrapbook__Index__.json` at the
  root. The live website has no directory listing, so the index is what makes the library
  readable there once the repo is pushed. The server rebuilds it from the folders on every
  save, so a file added or removed by hand is picked up.
- **Saving needs the ProjectVision local server** (localhost:8090), like every other local
  write. On the live site the library is read-only and the panel says so.
- **Delete is quarantine**, the Project Manager's rule: the file moves to
  `00__Deleted__Quarantine/` and nothing is unlinked.

---------------------------------------------------------
## 6. Shared code touched (kept to the minimum, all additive)
---------------------------------------------------------

| File | Change |
|---|---|
| `SheetModel__Groups__.js` | `DeleteItems(sheet, items, silent)`: a third, optional flag |
| `SheetModel__State__.js` | `RegisterBeforeAnnounce`; `Touch` runs the hooks before it dispatches, never for a restore |
| `SheetModel__.js` | Re-exports `RegisterBeforeAnnounce` |
| `15__Core__Markup/Groups__.js` | `RegisterLabeller`: a feature names a selected group's box. Answered inside `Render`, which has two callers |
| `Grips__.js` | `RegisterGroupProvider`, called from the group branch of `Render` |
| `PanelHost__.js` | Column tabs: `RegisterTab`, `SetActiveTab`, `GetActiveTab`, `spec.tab`; `Refresh` passes an off-tab section by |
| `Styles__Panels__.css` | One new region at the foot: the column tab strip and `is-off-tab` |
| `ModeController__.js` | Two imports, three `Register()` calls |
| `Scrapbook__.js` | `PreviewSvg` draws leaders and dimensions too |
| `Panel__Scrapbook__.js` | Its tile drag moves out to `Scrapbook__TileDrag__` |
| `ProjectVision__LocalServer__Main__.py` | One import, one `register_blueprint` |

---------------------------------------------------------
## 7. Phases
---------------------------------------------------------

| Phase | What | State |
|---|---|---|
| 0 | Map, plan, measure the house bar from PS02 | done |
| 1 | Host: `TileDrag` split out of the Standard panel | done |
| 2 | Parametric engine, scale bar, viewport link, grips, panel | done |
| 3 | Custom library, transport, panel, server blueprint | done |
| 4 | Verify: Node tests for the generator, API tests, in-app test on a scratch sheet | done - see ledger |
| 4b | The Scrapbook tab in the right column; the link noodle and its drag; the sheet-scale link | done - see ledger |
| 4c | The north direction tool (Dev menu, 3D); viewport identity; the parametric Drawing Title with {{placeholders}} | done - see section 11 and the ledger |
| 5 | Context menu "Save to Scrapbook"; rename and re-categorise a custom item | open |
| 6 | More parametric elements: north point turned by the project's north (section 11.6), grid bubble, level marker, section marker, revision cloud | open |
| 6b | The Elevations dev menu read against true north: presets, Seed N / E / S / W and an offer to rename seeded records (section 11.6) | open |
| 7 | ValeVision port, once Adam has signed TrueVision off | open |

---------------------------------------------------------
## 8. Traps for the next session
---------------------------------------------------------

- **The ProjectVision server never reloads its routes.** The scrapbook blueprint answers 404
  or 405 until Adam restarts his 8090 server. Read the running routes with OPTIONS.
- **Test REDO, not only undo.** A follower that runs after the history gives the right undo
  (the step's "before" snapshot is whole) and the wrong redo (its "after" snapshot holds the
  old bar beside the new scale). An undo-only test passes both designs.
- **A capture-phase listener on `window` does not run first** for an event dispatched on
  window. Fact 5. Use the model's before-announce hook for anything derived from a sheet.
- **A selected group's box has two painters**: the grips, then the sheet tools' own redraw a
  frame later (`dropperdraw`). Re-wording the tag after the first is undone by the second, so
  the name is given to `Na__LeGroup__Render` itself through `RegisterLabeller`.
- **Build a dropped element where it lands.** A set that `InsertSet` moves has an arbitrary
  offset added to every coordinate, a few parts in 10^14 off what a rebuild writes. The first
  rebuild then changes every record invisibly, and Escape no longer leaves the sheet as it
  found it. `Na__LeParam__Insert` measures at (0, 0), rebuilds at the tidy final origin and
  hands the set over with nothing to add.
- **Testing on a scratch sheet: the FIRST editor entry of a page session re-announces the
  drawings data**, which replaces the sheet list and silently drops a scratch sheet made before
  it. The editor then falls back to the first REAL sheet, which has the same viewport ids, so
  every check still passes - on the real sheet's in-memory copy. Enter a real sheet once, wait
  for 'loaded' to go quiet, THEN make the scratch sheet, and assert `Sheet__Id` before every
  mutation. `80__Testing__PrototypeEnvironment/Na__Test__ScrapbookServer__.py` (launch entry
  `tv-scrapbook`) serves the app with the real save blueprint pointed at a temporary folder.
- **The grip element is destroyed on every repaint**, including the repaint its own drag
  causes. The drag listens on the window and holds no reference to the element.
- **`DeleteItems` prunes groups of fewer than two members.** Regeneration rewrites the member
  list BEFORE it deletes the left-overs, or the prune takes the group with them.

---------------------------------------------------------
## 9. Ledger
---------------------------------------------------------

| Date | Entry |
|---|---|
| 19-Sep-2026 | Plan opened. House bar measured from PS02 D21 and D22: twelve bars, all identical. |
| 19-Sep-2026 | Phases 1 to 3 built. `Na__Test__ScrapbookScaleBar__.test.mjs`: the generated 1:50 bar matches Adam's hand-drawn one point for point, fill for fill. `Na__Test__ScrapbookApi__.test.py`: 26 checks on a temporary folder. |
| 19-Sep-2026 | In-app, on a scratch copy of PS02 D21, fetch guarded: drop and auto-link, live stretch as one step, Escape byte-identical, lookup menu, every panel control, duplicate, move-then-rebuild, explode; custom save, portable file, tile, drop with re-link, delete to quarantine. Real sheets byte-identical afterwards; the only write all session was the scrapbook POST to a temporary folder. |
| 19-Sep-2026 | FOUND BY TESTING REDO: the capture-phase follower ran AFTER the history (fact 5), so redo restored a stale bar. Replaced with the model's before-announce hook; follow, viewport delete and custom drop all re-tested with undo AND redo, byte for byte. |
| 19-Sep-2026 | Test harness fault, mine: two runs executed on the real D21's IN-MEMORY copy because the scratch sheet had been dropped by a reload (trap above). Nothing was saved - the guard logged no write attempt - and the model was restored byte-identical. The harness now asserts the sheet id. |
| 19-Sep-2026 | Commit 3276740 (21:54, titled for the v2.75.0 Safari manifest work) swept in the whole system, late fixes included, and was PUSHED - so it reached origin/main before Adam had tried it. Checked each late fix in HEAD by name. The original Standard Scrapbook was then re-tested on a scratch site plan sheet after its tile drag moved out: three tiles, drag, tokens, undo and redo byte for byte, double-click, and a plain group still tagged "Group". Uncommitted at close: the v2.76.0 DEVLOG entry, this plan, the three tests, a one-line config wording fix, a launch.json entry. |
| 19-Sep-2026 | SECOND SESSION, after Adam's "you still need to build out the extra tab... and the linking noodle". Both had been in his images and misread: the green box in image 4 was taken for "put the settings here", and the blue curve in image 3 for a sketch of the idea of a link rather than a thing to draw. Built 4.6 and 4.7. In-app on scratch copies of PS02 D21 and D24, fetch guarded: the tab (11 checks - two tabs styled alike, remembered, libraries not read until opened, a drop does not switch tabs); the noodle (19 checks - drawn to the right edge, target outlined, socket filled or hollow, drag to another drawing, to the title block, to bare paper, Escape, undo AND redo for each, a sheet-tied bar following the sheet's scale in one step); the Standard library from its new home and a bar on a site plan reading 1:500 or 1:1250 (9 checks). Real sheets byte-identical afterwards; nothing written. |
| 20-Sep-2026 | THIRD SESSION, after Adam's "elevation viewports should derive their names from a new direction tool... the text should show as a placeholder within double curly braces until you set up the north arrow". Mapped first (three read-only searches): the app has always ASSUMED the model's -Z axis is north, and PS01/PS02 store their "North Elevation" at azimuth 90 - seeded as East, renamed by hand. Built section 11. Node: compass 23 checks, title text 27, drawing title 39 (the generated title sits where Adam's hand-lettered one does to a thousandth of a millimetre). In-app on scratch copies of PS02 D22, D21 and D24, fetch guarded: facts and names for all twelve 2D viewports before and after north (all six elevation titles come out exactly as Adam lettered them at a north bearing of 90); the title element 68 checks - placeholder on drop, fills itself in when north is set, follows model source, rename, re-tie, scale and delete each inside ONE undo step with undo AND redo byte for byte, keeps what it says when untied, catches up when its sheet next comes up, plans and site plans, the panel's controls and its why-note, the scale bar unchanged; the 3D tool 22 checks - two-click draw, an orbit drag is not a click, live aiming, Escape, typed bearing, a REFUSED save reported as a failure, clear, the compass gone when the panel closes, and picks from a plan view (up the plan = 0, right = 90). Real sheets byte-identical afterwards; the one write attempted was Save North's, refused by the guard. Service worker token bumped to 2026-09-20-1: new modules import new exports from modules a warm cache already holds. |
| 19-Sep-2026 | NOT YET DONE: Adam's own test in his browser through the real 8090 server, which must be RESTARTED first to load the scrapbook routes. |

---------------------------------------------------------
## 10. Audit of the original brief (19-Sep-2026)
---------------------------------------------------------

Every ask in Adam's first message and its four images, against what exists.

| The brief | Where it is |
|---|---|
| Two scrapbooks "in the main drawings": Custom and Parametric | Both show on every sheet, on the Scrapbook tab |
| "Different subsystem folders in the established naming style" | `56__Feature__ScrapbookCustom`, `57__Feature__ScrapbookParametric` |
| Custom "will save a new user-generated scrapbook item JSON file" in `51__LayoutEditor__UserScrapbookContent` | One JSON file per item in his five category folders, through the Flask blueprint; an index for the live site |
| Parametric "largely driven by scripted code" | One module per element type; `build` is pure |
| "A dynamic ruler in the style of the image", under a drawing's title | The scale bar; matches his hand-drawn bar point for point |
| "A grab handle on one side to be able to drag it and extend it out" | The stretch arrow, live, in whole divisions |
| "When you change it from 1:50 to 1:100... regenerate back to a sensible standard" | `ScaleBar__Standards`, fourteen scales, each a 100 mm bar; a solver for the rest |
| "Insert at 5 m... broken up... with alternating items" | 1:50 standard: five 1 m cells, two-row checker |
| "Look at the JSON object for the vectors, which should be in a group" | Done: PS02 D21/D22, twelve bars, measured; the fixture in the test |
| "Annotated with a number" | Numerals on every division, larger at the ends |
| "Split that first metre up again... 200 mm alternate chunks" | Split first division, with a choice of sub-cell size |
| "Some kind of toggle on the dynamic block... to flip between the different scales. Think dynamic blocks in AutoCAD" | The lookup triangle and its menu; the same choices on the Properties tab |
| "Ensure the link to the viewport system gets its own module" | `...ScrapbookParametric__ViewportLink__.js`, the only parametric module that knows what a viewport is |
| "Map out the project first... then work through the plan" | Sections 1 to 3 and 7 |
| Image 3, blue curve, "LINK" | The link noodle (4.6) - missed in the first session |
| Image 3, red "DRAG" arrow along the bar | The stretch arrow |
| Image 3, red "DRAG" arrow from the bar to the title block's Scale cell | Dragging the noodle onto the title block ties the bar to the sheet's scale (4.5, 4.6) - my reading; Adam to confirm |
| Image 4, green box at the top of the right column | The Scrapbook tab (4.7) - missed in the first session |
| Image 1, arrow to the Scrapbook section on a site plan | The existing library, now the Standard one, moved to the Scrapbook tab with the others - Adam to confirm he wants it moved |
| Image 2, arrow at the hand-drawn bar | The element the scale bar reproduces |

---------------------------------------------------------
## 11. North, viewport identity and the Drawing Title (20-Sep-2026)
---------------------------------------------------------

Adam: titling elevations by hand is "a real pain... boring job"; the title should "reach in and say,
okay, this is an existing plan" and "fetch the directional data because this face of the building is
aligned with this direction". Three layers, each usable without the one above it.

### 11.1 What was wrong

The elevation system stores an azimuth - the bearing of the side the viewer stands on, clockwise from
the model's -Z axis - and CALLS -Z north (`Na__Elevation__AppConfig__.json`: "0 draws the north
elevation"). -Z is SketchUp's green axis, which is north only on a model drawn north-up. PS01 and PS02
were not: "North Elevation" is stored at azimuth 90, "East" at 180, "South" at 270 - seeded one
preset out and renamed by hand. One number puts it right: where TRUE north lies, in that same measure.

### 11.2 The north direction tool - `02__Src__AppModules/46__System__NorthDirection/`

| File | Namespace | What |
|---|---|---|
| `Na__North__Compass__.js` | `Na__NorthMath` | Pure: bearings, true bearing, the compass word. Runs under Node |
| `Na__North__AppConfig__.json`, `Na__North__ConfigState__.js` | `Na__NorthCfg` | Words, pick feel, gizmo, labels; every value has a fallback |
| `Na__North__ProjectJson__Data__.js` | `Na__NorthData` | Get / Set / Clear / Save, `FacingWordForAzimuth`, `na-north-direction-changed` |
| `Na__North__CompassGizmo__.js` | `Na__NorthGizmo` | The compass in the 3D view: ring, ticks, red needle, N. Drawn over the model |
| `Na__North__PickTool__.js` | `Na__NorthPick` | Two clicks: where it sits, then towards north. Reads the drawing broker's camera in a plan view |
| `Na__North__DevMenu__Editor__.js` | `Na__NorthDev` | Dev Tools > North Direction: Draw Compass, a typed bearing, what every elevation will be called, Save |

- **Stored INSIDE the drawings block**, `LayoutEditor__DrawingsData__North : { North__BearingDeg,
  North__OriginMm, North__SetIso }`, saved by `Na__DrawData__Save`. A top-level key would have to be
  listed in THREE places (the loader's `Na__DevSavedKeys` and two ProjectVision scripts) or the next
  sync wipes it from R2; the drawings block is in all three already. ABSENT MEANS NOT SET - never zero,
  which is a real answer (a north-up model is set to 0 on purpose).
- **The compass word.** Four cardinals, and intercardinals as wide as the config says
  (`IntercardinalHalfWidthDeg` 15): a wall 30 degrees off north is still the North Elevation, one 40 off
  is the North East. 22.5 is the ordinary eight-point compass, 0 the four-point.
- **The proof is in the panel:** every elevation listed with its stored bearing and the word north now
  gives it, live while the compass is being aimed. A compass pointed the wrong way round shows at once.

### 11.3 Viewport identity - `20__System__Viewports/`

- `Na__LayoutEditor__ViewportTitleText__.js` (`Na__LeViewText`), pure: facts in, sentence out.
  `Compose({ kind, phase, facing, name, drawing }, { phaseMode, uppercase, override }, words)`.
  House pattern, read off PS02: QUALIFIER then SUBJECT, no punctuation. The subject is a name TYPED on
  the viewport, else for an elevation the compass word and "Elevation", else the drawing record's name.
  A missing fact is `{{Direction}}` or `{{Drawing}}` - shown, never guessed.
- `Na__LayoutEditor__ViewportIdentity__.js` (`Na__LeViewId`) finds the facts: phase from the viewport's
  Model Source (a group whose label says "existing" is existing - the app's own startup test - any other
  is proposed; no groups, or a site plan, is none); facing from `Na__NorthData__FacingWordForAzimuth`;
  name only when TYPED - a paste's "East Elevation copy" is not a name (PS02's three proposed
  elevations all carry one).
- **Unnamed elevation viewports are named here**, through the sheet model's new
  `RegisterViewportNamer`: "Existing North Elevation" in the panels, link menus, toasts and the frame
  caption, once north is set. Derived on the spot, never stored, so it cannot go stale. A typed
  `Viewport__Name` still wins; plans, sections and 3D pictures keep the names they had.

### 11.4 The Drawing Title (element two)

Measured from PS02 D22's six titles, which agree to the digit: capitals, Open Sans 600 at 3.5 mm,
#172b3a, ranged left; underline 0.4 pt, exactly 60 mm, 1.631 mm under the baseline and 0.171 mm in
from the text's left; scale bar 6.318 mm under the underline, sharing its left end. Adam groups the
three as one object; this type draws that object.
- **Origin = the underline's left end**, the first record. Text above, bar below - so the bar is the
  scale bar module's own, moved down, and nothing about a bar is restated.
- **Two tiles, one type.** An element is now a PRESET of a type (`Element__Id`, `Element__Params`,
  `Element__PreviewParams`): "Drawing Title + Scale Bar" and "Drawing Title". The tile shows a worked
  example; a real drop reads its own viewport.
- **Facts are parameters** (`ViewKind, ViewPhase, ViewFacing, ViewName, ViewDrawing`), filled by the
  link module for any type that lists them in `definition.facts`. The type never sees a viewport, so
  it rebuilds from its own parameters alone and KEEPS WHAT IT SAYS when untied.
- **The underline is at least its set length and grows to fit** a longer title, given a way to measure
  text. A type is pure, so the engine hands it one (`Na__LeParam__SetTools`, the chrome's measure).
- **Grips.** With its bar: the bar's two. Without: the stretch grip sets the underline, no lookup grip.
- **Settings:** what it reads, WHY it still holds a placeholder (in words, naming the menu), Existing /
  Proposed (automatic, forced, left out), a typed override, capitals, underline, scale bar on or off.

### 11.5 Following facts

- **Inside the announcement** (the before-announce hook, one undo step, undo AND redo): model source,
  a viewport rename, its drawing, its scale, its deletion.
- **With no sheet changing** - north set in the 3D view, the design phases registering after a load, an
  elevation's bearing edited - there is no announcement to run ahead of. `Na__LeParamLink__Refresh`
  brings the ACTIVE sheet into line and announces once (its own undo step), booked by a timeout, never
  nested in the event that asked: on the identity module's event, and whenever a sheet becomes active
  or the sheets load. A sheet that is away is left alone until it comes up. Editable sheets only - a
  reader's copy says what its author saved. It does nothing, and marks nothing dirty, when no element
  changed.

### 11.6 Open, deliberately

- **The Elevations dev menu still calls -Z north.** "Viewed from: North" sets azimuth 0 and Seed N / E
  / S / W names by the model's axes. Titles and viewport names no longer care - they read azimuth
  against true north - but the records' own names, and their carousel cards, stay as typed. Next:
  presets relative to true north, and an offer to rename seeded records when north is set.
- **The site plan's north point** still points up the paper. It wants the same bearing, as a
  parametric element (and site plan viewports have no rotation yet).
- **Sheets that are away** catch up when next opened; a PDF of the whole pack made straight after
  moving north, without visiting them, would print the old words. North is set once per project, so
  this is left until it bites.
- **3D picture viewports** are not link targets (the link list is scaled 2D viewports).

### 11.7 Audit of this brief

| The brief | Where it is |
|---|---|
| "A new direction tool added to the dev menu that allows you to draw a compass in 3D space and point to north" | Dev Tools > North Direction > Draw Compass: two clicks, a compass gizmo in the scene |
| "Elevation viewports should derive their names from" it | Unnamed elevation viewports are named by `Na__LeViewId` through `RegisterViewportNamer` |
| "All of the different elevations can be generated" | Every elevation's compass word comes from its azimuth and north; the panel lists them. The dev menu's seeding still names by axis - 11.6, open |
| "Existing and proposed sections of the naming string... by using which model it's pulling from" | Phase from the viewport's Model Source |
| "If it's an existing model, add the existing section... then add the elevation direction" | QUALIFIER then DIRECTION then ELEVATION, as he letters them |
| "The text should show as a placeholder within double curly braces until you set up the north arrow" | `EXISTING {{DIRECTION}} ELEVATION`; fills itself in the moment north is set. My reading of "if you try and insert that block, it shouldn't work": the block inserts, and the WORD does not resolve - Adam to confirm |
| "Parametric elevation tags... reach in and say, this is an existing plan... fetch the directional data" | The Drawing Title, written from the identity module's facts |
