# TrueVision3D - PLAN - The Scrapbook System
# =========================================================

**Opened:** 19-Sep-2026  -  **Author:** Adam Noble - Noble Architecture
**Status:** Phases 0 to 4c built and tested by Claude; awaiting Adam's sign-off in his own browser.
Section 9 is the live ledger; section 10 audits the original brief against what exists.
Section 12 (20-Sep-2026, v2.91.0) is a fourth library, the Specification Scrapbook, on a new
Specification tab in the LEFT column - built and tested by Claude, not yet tried by Adam.
Section 13 (20-Sep-2026, v2.96.0) is the drawing title with its scale bar stood away TO THE RIGHT,
held by its far end - built and tested by Claude, not yet tried by Adam, not in ValeVision.

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
| Specification | `58__Feature__ScrapbookSpecification` | The project's own specification notes, one bubble each | Nobody: read live from the drawing notes file (section 12) |

All of them drop through `Na__LeClip__InsertSet`, so whatever lands is ordinary sheet records: it
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
        Na__LayoutEditor__ScrapbookParametric__Grips__.js      Na__LeParamGrips  the stretch grip, the slide grip (section 13) and the lookup grip
        Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js Na__LeParamNoodle the noodle to what an element is tied to, and the socket that re-ties it
        Na__LayoutEditor__ScrapbookParametric__Config__.json
        Na__LayoutEditor__Panel__ScrapbookParametric__.js      Na__LePanelParam  the library section and the properties section
        Na__LayoutEditor__Styles__ScrapbookParametric__.css

    58__Feature__ScrapbookSpecification/                     NEW 20-Sep-2026 (section 12)
        Na__LayoutEditor__ScrapbookSpecification__.js          Na__LeScrapSpec      the library: the notes by group, a note's bubble, the tail, the drop
        Na__LayoutEditor__Panel__ScrapbookSpecification__.js   Na__LePanelScrapSpec the LEFT column's Specification tab and its one section
        Na__LayoutEditor__ScrapbookSpecification__Config__.json
        Na__LayoutEditor__Styles__ScrapbookSpecification__.css

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
- **The plug.** The noodle's FAR end is a handle too (v2.85.0 on, Adam: "for a lot of users it's
  going to be more logical to grab the end point and move that to whatever they want to tag...
  like dragging a rope or a cable"). A round grip laid over the end dot, a little larger than the
  socket because it lies on a drawing's frame among linework. It starts the SAME drag as the
  socket - one behaviour, two places to begin it - and keeps its press to itself, or the sheet
  tools would pick up the viewport it lies on. No noodle, no plug: an untied element has only
  its hollow socket, which is how a first noodle is drawn. THE PLUG IS A GRIP ELEMENT, NOT PART
  OF THE NOODLE'S DRAWING, so taking the finished tie away for a drag does not take it: the live
  noodle HIDES it (hidden, never removed - it may be the element the press began on) and the
  repaint that ends every drag replaces it. Found by the ValeVision port's test, not this one's.
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
| 20-Sep-2026 | Adam tried the Drawing Title in his own browser (his screenshot shows EXISTING FLOOR PLAN tied to PS01's plan) and asked for one more thing: the noodle's END to be draggable as well as its start. Built as the plug (4.6). In-app on a scratch copy of PS02 D21, fetch guarded, 23 checks: both handles up on a tied element, the plug exactly on the end dot, a press that never moves does nothing, carried to the other plan the title retitles in ONE undo step with undo AND redo byte for byte, neither drawing moved and the element stayed selected, Escape, bare paper unties and the plug goes with the noodle, the SOCKET still does all it did, the title block and back, a locked layer shows the tie with neither handle, a plain scale bar has it too. Real sheets byte-identical; no write attempted. Then asked for the whole session's work to be ported to ValeVision. |
| 20-Sep-2026 | PORTED TO VALEVISION the same day, as VV v2.67.0 (north and viewport identity), v2.68.0 (the tab, the host, the Parametric Scrapbook with the noodle and its plug) and v2.69.0 (the Custom Scrapbook and a save route on Whitecardopedia's `server.py`). Scripted, anchored, all-or-nothing patches; every module marked verbatim proved byte-identical from its first code region down. What ValeVision does NOT get, and why, is in its DEVLOG and parity ledger: no phases (one model per project, so Existing / Proposed is chosen per title), no site plans, an EMPTY Standard library (the items here are Noble Architecture's own), no Show Compass (no `Na__InteractiveOverlays` there). ValeVision's clipboard also had to learn to land a dimension (`InsertDimension`, a dimension leaf in `InsertLeaves`) - copy there is unchanged. Tested in ValeVision: Node 23 + 27 + 35 + 39, the API 25, and in the app on a scratch copy of project 3047's sheet through a test server of its own; real sheet byte-identical, nothing written. ITS SHARED SERVICE WORKER TOKEN IS ADAM'S CALL and was not bumped. |
| 20-Sep-2026 | TWO FAULTS FOUND BY THE VALEVISION TEST. (1) ValeVision only: the north compass was rendered into a sheet's 3D viewport - the mode controller collapses every dev panel by class before it announces a sheet, so a listener that first asked "is my panel open?" always heard no. TrueVision is safe because its compass is an interactive overlay. (2) BOTH APPS: the plug's dot stayed at the far end of a noodle that was no longer there for the length of a drag; it is a grip element, not part of the noodle's drawing. Now hidden while either end is carried (4.6). `LinkNoodle__` stays 1.2.0 - it had not shipped. |
| 20-Sep-2026 | OTHER SESSIONS MOVED THIS SYSTEM ON THE SAME MORNING, in work Adam has not yet tried: v2.86.0 rebuilt the Elevations and Floor Plans menus (presets named from north, typed elevation names reaching the title - which closes 11.6's first item) and v2.87.0 made a floor plan's storey a sixth fact (11.8, written by that session). ValeVision holds the five modules as they were before both. |
| 20-Sep-2026 | A FOURTH LIBRARY, v2.91.0: the Specification Scrapbook, and tabs for the LEFT column (section 12). Adam asked for a concise specification beside the sheet, then in the same message for the codes as bubbles to drag on. Built in `58__Feature__ScrapbookSpecification`; the shared host gained one field (`spec.caption`) and the panel host one (`spec.hint`), no new export. In-app on scratch copies of PS01 D01 and RB05 D01, fetch guarded: tabs, list, drop (bubble centre on the drop point to 0.0000 mm), undo AND redo byte for byte and ONE step, the tail rule in five places, Escape, double-click, Enter, filter, full notes, the look following the Leaders panel, the list following a rename, a renumber and a delete, the empty specification. Real sheets byte-identical; no write attempted. NOT yet tried by Adam; NOT in ValeVision. |
| 20-Sep-2026 | A FIFTH TILE, v2.96.0: the drawing title with its scale bar stood away TO THE RIGHT (section 13), asked for over a marked-up PS01 elevation, plus the checker fill lightened from the measured #666666 to #858585 on every parametric bar. Built as two parameters on the existing Drawing Title - `BarPlacement` and `BarOffsetMm` - so any title can be switched either way and the new tile is only a preset of it. Node: the drawing title test grew from 45 checks to 73, including the one that matters - divisions driven 3 to 9 to 11 to 3 to 7 with the FAR END asserted unmoved each time. In-app on PS01 D02 (`Sheet_001`, six real 1:50 elevation viewports), fetch guarded: drop and auto-link, the four grips where they belong, a slide stepping in 50 mm, a slide landing exactly on a snapped vertex with its dashed guide, the reversed stretch holding the far end through every step, Escape byte-identical, and the panel's two new controls. Zero write attempts all session; the local draft was cleared afterwards. NOT yet tried by Adam; NOT in ValeVision. |
| 20-Sep-2026 | FOUND BY TESTING THE SLIDE IN THE APP, not by the Node tests: the slide grip sits ON the bar's own far corner, so `Na__LeOsnap__Find` returned that corner at distance 0 and the bar locked onto itself and would not move. Proved directly - the same point searched with and without the exclusion returns its own `Shape__195` at 0.0000 mm, or a neighbour's vertex 2.8358 mm away. The snapping module already took the exclusions a selection move passes; the grips module now passes the element's own vectors. |
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
  **CLOSED 20-Sep-2026, by the Elevations / Floor Plans menu session (v2.86.0), as that session
  reports it:** the N / E / S / W preset buttons are gone, Seed names from north through
  `Na__NorthData__FacingWordForAzimuth`, and a record carries `Elevation__NameIsAuto` (true follows
  the direction, false is a name somebody typed and reaches the title, absent is a record from
  before the flag and never promotes). Not re-tested here. ValeVision's menu is still the old one.
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

### 11.8 The storey level - a sixth fact (20-Sep-2026, v2.87.0)

*Written by the "Floor plan building story levels" session, which built it, and placed here by this
one as the two agreed. Not re-tested by this session; not in ValeVision.*

A floor plan record now knows which building storey it is a plan of (`FloorPlan__StoreyLevel`, chosen
per plan in Dev Tools > Floor Plans; `42__System__FloorPlanViews/Na__FloorPlan__StoreyLevel__.js`
holds the list and an educated guess from the plan's name, then its cut height, which is never
written down). Viewport identity answers it as a sixth fact, `level` - the storey's own title,
"Ground Floor Plan", '' for everything that is not a floor plan - and the Drawing Title stores it as
`ViewLevel`. In the title text a plan with a level is lettered from it in place of its record's name.

THE TRAP: a typed viewport name is the subject, and PS02 D21's two plan viewports are typed "Existing
Floor Plan" / "Proposed Floor Plan", so the fact alone changed nothing on the very sheet Adam asked
about. Rule: a typed name beats the storey only by SAYING MORE - every word of it, the opening
qualifier aside, found in the storey's title or in `Words__GenericPlan` ("Floor Plan", the words that
only say "a plan") means the storey is lettered; "Coach House Floor Plan" stays as typed, and so does
"Ground Floor Plan" typed on a plan assigned to the roof. GenericPlan was found by falling in: without
it, reassigning D21's plan to Roof lettered PROPOSED FLOOR PLAN, because "Floor" is no word of "Roof
Plan" - caught in the app, not by the unit test, which had encoded the wrong expectation. Elevations
are untouched: a typed name there always wins.

Compose's answer gains `source` ('override' | 'name' | 'facing' | 'level' | 'drawing' |
'placeholder') and the panel's why-sentence asks that instead of looking at ViewName. A title saved
before there was a ViewLevel reads exactly as it did and gains the fact the next time its sheet is
brought into line (Refresh: one undo step); a storey chosen in the Dev menu is announced
(`na-floorplan-storey-changed` -> identity reason 'level') and reaches an open sheet through the same
booked refresh north uses.

Versions after it: TitleText 1.1.0, Identity 1.1.0 (+ `Words__GenericPlan` in its config),
DrawingTitle 1.1.0, ViewportLink 1.3.0 (FactsOf only), Panel 1.3.0 (the why-sentence only). Title
text test 48 checks (was 27), drawing title 45 (was 39). Open: unnamed PLAN viewports are still named
by their record in the panels and toasts (the namer only names elevations) - offered to Adam, not
built. ValeVision holds the five modules one fact behind (1.0.0 / 1.0.0 / 1.0.0 / 1.2.0 / 1.2.0) and
has no storey field.

---------------------------------------------------------
## 12. The Specification Scrapbook, and tabs for the left column (20-Sep-2026, v2.91.0)
---------------------------------------------------------

Adam: "In the drawings, quite often I'll forget what the codes are, and because you can't have two
separate tabs open at the same time, it's hard to match things up on really complicated jobs."
Then: "Better still, it should show the codes in an annotation bubble, like a detail bubble. You
can drag that bubble straight onto your drawing, and then it creates one of the annotations with
the correct code... a dynamic scrapbook of all of the specification items."

### 12.1 What it is

- **The left column has two tabs**, Document Preferences and Specification, through the SAME
  `Na__LePanels__RegisterTab` the right column uses - it has always taken a side. Everything the
  column held is on the first tab, registered first so it is theirs by default. All four tabs carry
  hover text (`spec.hint`).
- **A fourth library with no library file.** Its items are the project's drawing notes
  (`TrueVision__DrawingNotes__.json`, through `Na__LayoutEditor__SpecData__`), one row per note in
  the specification's order, headed by group. It listens to the specification's change event, so it
  cannot go stale, and stores nothing.
- **A row is a scrapbook tile**, dragged by the shared `TileDrag`. `spec.caption` lets a library
  fill a tile's caption itself - a row says a title and a paragraph, not one word.
- **What lands is an ordinary specification bubble** carrying `Leader__SpecNoteId`, through
  `InsertSet`: one undo step, selected, renumbered with its note, listed in the notes margin.

### 12.2 The three decisions worth keeping

1. **The set's origin and size are the BUBBLE'S square, not the leader's box.** They are what a
   drop is centred on and kept on the paper by, and it is the bubble that was dragged. The tile
   and the ghost draw the bubble bare (line weight 0, endpoint 0) because the tail's direction is
   not known until the drop. The scrapbook stylesheet already gives the ghost's SVG
   `overflow : visible`, which is why a tail could hang off that box if one were ever wanted.
2. **The tail aims at the drawing** (`TailFor`): the middle of the viewport the bubble was dropped
   on or nearest to; the middle of the paper on a sheet with none. Then the tip grip is the
   user's - the leader lands selected with Select up.
3. **A filter word under three letters matches the START OF A CODE only.** Every prefix is two
   letters and sits inside ordinary words (surface, existing); matched against the text, "rf" found
   seven rows in three groups instead of the five in its own.

### 12.3 Traps

- **The mode controller routes 'leader' and 'leaders' to the Leaders panel alone**, so a section
  that counts bubbles must listen to the model itself (`COUNT_REASONS`), and include
  'sheet-updated', which is what an undo or a redo announces.
- **A tile is `display : flex`**, so the `hidden` attribute does nothing to it until the stylesheet
  says `[hidden] { display : none }` for that modifier. The filter hides rows that way.
- **The host's `Input` is disabled with the sheets.** The filter and Show full notes are made by
  hand: reading the specification is never a thing to switch off.
- **Testing: Fit before a synthetic drop, and assert something landed.** A drop point off the
  visible stage lands nothing, and the last leader on the sheet is then the PREVIOUS one - which
  read exactly like "the drop ignores the panel's settings" for ten minutes.
- **RB05's specification is empty** (no groups). It is the project in Adam's screenshot, so the
  first thing he sees there is the empty-state sentence and the Open Project Specification button,
  not a list. PS01 (31 notes) and PS02 (29) are where the list shows.

### 12.4 Audit of the brief and of every mark on the screenshot

| The brief, or the mark | Where it is |
|---|---|
| Red box 1, over the top of the left column | The Document Preferences tab |
| Red box 2 beside it, with an arrowhead on it | The Specification tab |
| The long red curve from box 2 across to the right column | "Like those": the left tabs ARE the right column's tab strip, registered by side. Read as a likeness, not as a line to draw - it joins two pieces of UI, not two things on the paper |
| Two red arrows up at Properties and Scrapbook | The model being pointed at: same strip, same styling, measured identical |
| "Two tabs on each side... Keep everything now in the first tab" | All six left sections on Document Preferences, untouched; nothing moved between columns |
| "Document preferences" | Read as the first tab's NAME - Adam to confirm. One label, `PanelTabDocument` |
| "A separate tab that shows me the specification document... more concise... the code and the note" | One row per note: the code, the title, the text cut to three lines with Show full notes |
| "Reach into the same data file that the drawings and notes [use]... PS01 or PS02" | `Na__LayoutEditor__SpecData__`: `TrueVision__DrawingNotes__.json` beside the project data |
| "Give you a breakdown of that" | Rows grouped under the specification's own group headings |
| "Show the codes in an annotation bubble, like a detail bubble" | Each row's bubble, drawn by the sheet's markup builder from the record that lands |
| "Drag that bubble straight onto your drawing... creates one of the annotations with the correct code" | The shared tile drag; a leader of type bubble, linked by `Leader__SpecNoteId` |
| "A dynamic scrapbook of all of the specification items" | No library file; rebuilt from the specification's change event |
| "Then connect it up like you normally would" | The leader lands selected with its square tip grip up. Read as the existing grip - Adam to confirm; a tail that follows the pointer to a click was offered, not built |
| "Implement this in a new systems subfolder" | `58__Feature__ScrapbookSpecification` |

Not asked for, added because the brief's own complaint ("hard to match things up on really
complicated jobs") wanted them, and both can be switched off by not using them: the filter, and the
quiet count of bubbles already on the sheet.

---------------------------------------------------------
## 13. The scale bar stood to the right (20-Sep-2026, v2.96.0)
---------------------------------------------------------

Adam, over a marked-up PS01 elevation: *"Can you see that the measuring bar is under the title
here? We need a version where the bar is to the right of it... Add the handle for stretching where
I've shown here in blue, and make sure I can infer the projected line work vertices so I can drag
it from point A to, say, the corner of that building. You need to reverse the extending thing so it
extends the other way round, so I can drag the other end of the bar to a larger value back towards
the title."*

### 13.1 The one decision everything else follows from

**THE FAR END OF THE BAR IS THE END THAT IS HELD.** The bar is meant to sit under the far corner of
a wide elevation, so that end is placed and must then stay placed. Every other rule is a
consequence:

- the grip on the FAR end **slides** - it carries the bar along without changing its length, and it
  is the one that snaps;
- the stretch grip moves to the NEAR end and runs **backwards** - dragging it towards the title
  lengthens the bar and pulls the offset back by the same amount, so the far end does not move;
- the lookup triangle, whose old place the stretch arrow has taken, steps up over the bar's near
  end, where nothing of the element is (the numerals are all underneath).

### 13.2 Where it lands - measured, not designed

The arrangement was measured off Adam's own mock-up at 4.10 px/mm (calibrated against the 100 mm
bar and the 2 mm checker in the same image). The bar's top stands **3.631 mm above the underline**,
which is `TextBaselineAboveUnderlineMm` (1.631) plus the bar's own 2 mm - in other words **the
bar's foot sits exactly on the title's baseline**, so the two read as one band across the foot of
the drawing. Measured 15.5 px, predicted 14.9 px: half a pixel of antialiasing.

### 13.3 `BarOffsetMm` is measured from the ORIGIN, not from the end of the underline

Adam called it "the step in between", and the obvious reading is the clear gap from the underline's
end to the bar. It is not built that way, deliberately:

- the underline **grows to fit** its title and its length is not stored - it is measured from the
  browser's text metrics at build time. A gap hung off it would move the bar whenever the title
  changed length, which is precisely what must not happen to a bar that has been put under a
  corner;
- `stretchTo` and `slideTo` are handed no `tools`, so they cannot measure text at all. An
  origin-relative offset keeps both of them pure arithmetic.

So the parameter is where the bar's **zero end** stands, from the element's own origin. The panel
calls it *Bar position (mm)* and says so underneath. `BarOffsetStepMm` is 50, as asked; a drag that
lands on a snapped vertex is exact and ignores the step.

### 13.4 The snap

`Na__LeOsnap__Snap` in the vertex tone - the same search the Draw tool uses, so the projected
linework of the drawing above is found first and the sheet's own vectors after it. A slide moves
along one line, so a corner two metres above decides its x and nothing else; a dashed guide is
drawn from the vertex down to the bar for the length of the drag, or there is no saying WHICH
corner the end has been put under.

### 13.5 Traps

- **A slide must exclude the element's own vectors.** The grip sits on the bar's far corner, so
  without the exclusion the snap finds that corner at distance 0 and the bar will not move at all.
  Found on the sheet, not by the unit tests, which do not know where the grip is.
- **The far end is not `offset + 100`.** It is `offset + Divisions x divisionMm`. A test helper
  that hard-codes the length reports the far end moving when it has not - which is exactly what the
  first in-app run appeared to show.
- **A reversed stretch that hits a limit moves the far end.** At `MaxDivisions` the bar can grow no
  further and the offset clamps at zero; the far end then shifts. This is the honest behaviour, not
  a bug, but it is the one case where the promise above does not hold.
- **The record order is unchanged**, in both placements: the underline is vector one, the title is
  text one, the bar's cells and numerals follow. The engine's slots depend on it, so switching
  placement regenerates in place with nothing re-keyed.

### 13.6 Audit of the brief and of every mark on the two screenshots

| The brief, or the mark | Where it is |
|---|---|
| "A version where the bar is to the right of it" | `BarPlacement : 'right'`, and a fifth tile that presets it - "Drawing Title + Scale Bar to the Right" |
| "An extra parameter where you can increase or decrease the step in between by increments of 50 mm" | `BarOffsetMm`, `BarOffsetStepMm` 50; the panel's *Bar position (mm)* spinner, and the step a free drag lands on. Measured from the ORIGIN, not the gap - 13.3 says why |
| Blue arrow at the bar's far end (image 3) | The slide grip, a double arrow, at exactly that end |
| Green ring round it | Taken as "this end is the one that is placed" - the decision in 13.1 |
| "Make sure I can infer the projected line work vertices so I can drag it from point A to, say, the corner of that building" | The slide snaps through `Na__LeOsnap__Snap`; the dashed guide draws the inference from the vertex down to the bar |
| "Reverse the extending thing... drag the other end of the bar to a larger value back towards the title" | The stretch grip moves to the near end, points back at the title (`is-reversed`), and adds divisions as it is pulled - far end held |
| Long green arrow from the title to the bar (image 3) | The gap itself: the thing `BarOffsetMm` sets |
| Red box and line to the right of the title (image 2) | The same ask, sketched first: the bar belongs over there |
| "These are a bit too dark on the page. The filled sections on all of the parametric rulers make 20% lighter" | `ScaleBar__FillColour` #666666 -> #858585, one value, every parametric bar. Read as a fifth of the way to white; the measured value is still recorded in `Meta__HouseBar` |

Open, deliberately: a bar to the right is offered on every drawing title, not only on elevations,
because a wide plan wants it too; and the reversed stretch does not snap - divisions are its own
rule, and Adam asked for the snap on the placing end.

## 14. The Project Portal block (21-Sep-2026, v2.100.0)
---------------------------------------------------------

Adam, with two mock-ups - a narrow column and a wide panel: *"Create parametric scrapbook items
for these, but the actual QR codes are the ones that are generated through the QR code generator
that already generates the QR code in the bottom right-hand corner in the title blocks. When these
are dragged in, update the QR code to the correct project. Also put the project name in as well...
Don't mention PlanVision. Mention the fully 3D model with navigatable scenes, etc. Basically, write
a short little thing that's really persuasive to make people want to scan with their phone. Point
out to scan with your phone or tablet as well, for Boomers, so Boomers can understand. There are
two formats of this: the concise one and the bigger one. The actual QR codes make it parametric, so
we can have the smallest, a 30 mm square, or a 40 mm square version. The default should be the 30
mm square one. But you can press the drop-down arrow, like with the other parametric things we've
made, and make it bigger and smaller."*

### 14.1 The one decision everything else follows from

**THE CODE IS ONE RECORD.** A version 3 symbol is 217 filled runs. Written as 217 shape records it
would have been 217 ids in the group, 217 slots for the engine to regenerate, 217 entries in every
undo snapshot and in the browser draft - and, because abutting filled rectangles are anti-aliased
one at a time, a faint light grid through every finder pattern on the screen and in the PDF.

So the box is ONE ordinary vector - four points - carrying a new block on the shape record:

```
Shape__Qr : { Qr__MarginMm }        and nothing else
```

`Na__LeShapeGeo__Push` draws the shape exactly as it always did and then pushes the chrome's
existing `'qr'` primitive inside it, that far in from its box. That primitive already carries the
symbol whole and is already painted by both surfaces - `Na__QrPaint__SvgGroup` on the screen and
`Na__QrPaint__DrawPdf` into jsPDF - because the title block's cell has used it since 19-Sep. One
filled path either way, no seams, and the model carries a rectangle.

Everything else falls out of that. The code moves, copies, prints, exports, undoes and changes
layer like any vector. Ungrouping the block leaves a box that still draws the code. A block saved
to the Custom Scrapbook and dropped into another project draws **that** project's code, because the
block names no project and holds no matrix: the painter asks `Na__ProjectQr__GetSymbol()` at
painting time, which is the same call, and therefore the same symbol, the title block prints.

### 14.2 The margin is a FRACTION of the code, not a size

`MarginFraction` 0.07. The quiet zone the QR system asks for is counted in MODULES, and
`0.07 x codeMm / (codeMm / N) = 0.07 x N` - **2.03 modules for a 29 module symbol at every size in
the list**, and more for a bigger symbol. A margin in millimetres would have been right at one size
and wrong at the other four. `Na__LeShapeGeo__PushQr` reports the printed size to
`Na__ProjectQr__CheckPrint`, so a box drawn too small, or a margin squeezed, says so on the console
the way the title block's cell does.

### 14.3 The code is the parameter; the type is not

`SizeMm` is the symbol edge to edge - 30 mm as shipped, 20/25/30/40/50 on the triangle. Everything
round it is set in paper millimetres and does **not** scale with it. Type on a drawing is house
sizes or it is wrong: a 20 mm code with 1.8 mm bullets under it would be a block nobody could read
pointing at a code everybody could. The column instead grows to fit its own longest line, measured
through the editor's own text measurer.

### 14.4 Two forms, one type

COMPACT is the column: code, Scan Me button, caption, heading, project, bullets. FULL stands that
column beside a heading and a wrapped paragraph, and the left column then drops its project line,
because the heading beside it is already carrying it. The lookup triangle swaps between them and
the panel offers the same choice - they are the same block with more or less said.

### 14.5 Two additions to the parametric engine, both small and general

- **`definition.choices(params)`** - what a type offers on the lookup grip BEYOND the scale and the
  split every scaled type has. Each entry is `{ label, checked, patch }`, and the grips module hands
  the patch straight back to `Regenerate`. It never reads them: a code size and a choice of form
  mean nothing there, which is the point.
- **`definition.linkable : false`** - a type that is never tied to a viewport. It is dropped with no
  link and no scale laid over its preset, the follower leaves it alone, `AdoptNew` does not adopt
  it, and the panel shows it no link row. This block reads the PROJECT; a cable from it to the
  nearest elevation would say something untrue about what it is.

### 14.6 The project name

Read live through `tools.projectName()` - the PWA's own project context, which is what the Project
Specification and the Drawing Register both print, with the project code put in front of it:
**PS01 - Musters Road**. Renaming the project rewrites every block. A name typed into the panel
wins and stops it following, and clearing the box puts it back - the drawing title's own idiom.
With nothing to ask it reads `{{Project}}`, the placeholder idiom, and the panel says why.

*(The obvious source, `Na__PresentationMode__ProjectJson__GetActiveConfig().projectName`, which is
what `Na__LeRec__BuildFields` uses for its Client default, is a DEAD END: on PS01 that call answers
the SavedCameraScenes block, which has no such key. The Client default has been quietly falling
back to empty ever since. Worth a look on its own.)*

### 14.7 Traps

- **`Na__LeParam__ShapePatch` is the list of what a regenerate writes onto an existing member.** A
  new shape field that is not in it is written on the first build and never again, so the element
  looks right until it is resized. `qr` is in it, and `Na__LeModel__UpdateShape` takes it.
- **A shape carrying only a code is not "nothing to paint".** Both the record normaliser's
  edges-or-fill guard and `Push`'s early return had to learn that.
- **`RefreshProps` reflected the scale rows unconditionally.** For a type with no scale that put
  `undefined` into the scale list and the divisions box - hidden, but waiting there for the next
  bar selected. It now returns early for a type with neither a bar nor a link.
- **The panel's tiles are not built until the Scrapbook tab is opened.** A test that drops a tile
  has to click that tab first, and the drop is TWO pointer presses, not a `dblclick` - the tile
  drag counts its own double press (see `Na__LeScrapDrag__OnPointerUp`).

### 14.8 How it was proved

- `80__Testing__PrototypeEnvironment/Na__Test__ScrapbookProjectQr__.test.mjs` - 55 checks. The
  quiet-zone arithmetic is asserted against the **QR system's own config**, at every size the list
  offers, rather than against a number typed in twice; so is the module floor.
- In the app on PS01, with a fetch guard refusing every write: both tiles show live previews, a drop
  lands a 12 member group with `Shape__Qr`, the triangle's menu ticks the size it is, 30 -> 40 mm
  regenerates **in place** (same record ids, box 34.2 -> 45.6 mm, margin 2.1 -> 2.8 mm), the form
  switch re-letters the block, and an undo left the sheets byte-identical with nothing sent to R2.
- The rendered block was rasterised at 200 and 300 dpi and **decoded by OpenCV** back to
  `https://www.noble-architecture.com/q/?PS01` - both forms, every read correct.
- The PDF path was run through a jsPDF stand-in: one `qr` primitive at the box origin plus the
  margin, 217 unpainted rects and one `fill()`. The single-path idiom, as the title block's.

### 14.9 Audit of the brief

| The brief | Where it is |
|---|---|
| "Parametric scrapbook items for these" | Two tiles, one type: `ProjectQr`, elements `ProjectPortalCompact` and `ProjectPortalFull` |
| "The actual QR codes are the ones that are generated through the QR code generator that already generates the QR code in the... title blocks" | `Shape__Qr` -> `Na__ProjectQr__GetSymbol()`. The identical call the title block's cell makes, so the two codes on a sheet are the same object |
| "When these are dragged in, update the QR code to the correct project" | Nothing is stored. The symbol is asked for at painting time, so it is always the project on screen's |
| "Also put the project name in as well" | `PS01 - Musters Road`, under whichever heading leads the block, live from the PWA project context |
| "Don't mention PlanVision" | No app is named anywhere in the copy. A test asserts it |
| "Mention the fully 3D model with navigatable scenes" | "Walk through it at full size, step between the saved views and scenes"; bullets one and two |
| "Really persuasive to make people want to scan with their phone" | The Scan Me button with its handset, and copy that says what to do, what happens, and answers the objection that stops people - "Nothing to download - it opens straight in your browser" |
| "Point out to scan with your phone or tablet as well, for Boomers" | The caption under the button: *Use your phone or tablet camera*. In both forms, and said again in the paragraph |
| "Two formats: the concise one and the bigger one" | COMPACT and FULL, 14.4 |
| "The smallest, a 30 mm square, or a 40 mm square version" | `SizeChoicesMm` 20, 25, 30, 40, 50 - the two he named, with room either side |
| "The default should be the 30 mm square one" | `ProjectQr__SizeMm` 30; neither tile presets a size |
| "You can press the drop-down arrow, like with the other parametric things we've made, and make it bigger and smaller" | The lookup triangle off the code box's top right corner, through the new `choices` hook |

Open, deliberately: the block is offered on every drawing type, including site plans; the bullets
are one list shared by both forms; and there is no control for the code itself, because there is
nothing about it to choose.

### 14.10 Changes after Adam used it (21-Sep-2026)

| Adam | What changed |
|---|---|
| The phone glyph is "a bit too ambiguous" - it should read as a modern smartphone (v2.108.0) | A slim 2.4 x 4.6 mm handset with a filled Dynamic Island pill at the top, in place of a squat box with a bar across its foot. Still two records in the same slots |
| "Make the standard one that's inserted when you drag it in ... the 20 mm option" (v2.109.0) | `ProjectQr__SizeMm` 20, which overrides row 14.9's 30. A block already on a sheet keeps its stored size |
| "The body text should be 2.2, and 'Use your phone or tablet camera' 1.5 mm" (v2.109.0) | `BodySizeMm` 2.2 (was 3.1), `BulletSizeMm` 2.2 (was 2.7), `CaptionSizeMm` 1.5 (was 2.1). Reading "body text" as the paragraph AND the bullets, because the compact form has no paragraph and 2.7 mm bullets over a 2.2 mm paragraph would read upside down. Gaps re-set against a rendering at 20 mm: caption 2.8, heading 6.2, bullets 5.0 and 3.6 apart, paragraph 4.6 and 3.4 apart. `BodyWidthMm` left at 95 |
| "Instead of them being absolute black, make them softer. use hsl(0, 0%, 35%) ... apply that to both of the versions of it" (v2.120.0) | The code of BOTH forms is `#595959`: the Project QR config's new `ProjectQr__Symbol__PortalDarkColour`, which `Na__LeShapeGeo__PushQr` hands the chrome for any vector's `Shape__Qr`. Chosen at painting time, not stored on the record, so blocks already on sheets turn grey with no re-pick; `Shape__Qr` stays `{ Qr__MarginMm }`. The title block's code keeps `DarkColour` black (0.30 mm module against the Portal's 0.52 mm and up; see `PortalDarkColourNote`) |

## 15. The underline runs five millimetres past the words (21-Sep-2026, v2.122.0)
---------------------------------------------------------

Adam, with three marked-up screenshots of RB05's front elevation title: *"Add a new rule that the line that's
generated should always be a set distance from the end of the text box that makes the title... In the case of long
titles like this, make sure this line always goes at least 5 mm past, if possible. And that's 5 mm in real
dimensions. On this page, it's 500 because, obviously, it's 1:100... Because it looks kind of weird being short.
Note there are a few of these titles."*

### 15.1 Two faults behind one short line

- **The line was drawn to an estimate.** Until jsPDF and the Open Sans cuts load, `Na__LeChrome__MeasureTextMm`
  answers `characters x size x 0.52`, ten per cent short on capitals. RB05's front title measured 92.82 on the
  estimate and 103.47 for real (the painted SVG agrees to the thousandth); it was underlined 93.2.
- **It was rebuilt when nothing had changed.** `FactsPatch` compared a viewport's RAW facts with the element's
  NORMALISED ones. RB05's elevation names carry two spaces round the dash, so every refresh rebuilt the title - and
  the first refresh of a session runs about 100 ms after the tab opens, long before the metrics.

### 15.2 The rule, and the one thing that may shorten it

- `UnderlinePastTextMm` 5, paper millimetres: the line ends 5 mm past the words - `TextOffsetXMm` plus the measured
  width - at every scale. The set length stays the least it is.
- A bar stood to the RIGHT is the only thing that shortens the run (`UnderlineBarGapMm` 5 clear of its zero end,
  where its numerals cross the underline's level), and never to less than the words. That is the reading given to
  "if possible" - **Adam to confirm**. A bar below, or none, never shortens it.

### 15.3 Refit - and why only the underline's length is asked about

- The rule changes records already on sheets, and the underline's length IS a record. `Na__LeParam__Refit` rebuilds
  an element whose type says it no longer fits; `Na__LeParamLink__Refresh` runs it after reconciling, on 'active',
  'loaded', an identity change, and once when the panel sees the metrics land.
- A whole-geometry comparison was the obvious test and the wrong one: a group can be opened (double-click) and its
  members edited by hand, and a refit on every visit would quietly undo that. The title answers about the length of
  its underline and nothing else.
- Nothing is refit until `metricsReady()`: fitted to the estimate, a good line would be cut back.

### 15.4 Traps

- **A text's bounding box is not where its words end.** Chrome's `getBBox()` of the painted title is 0.49 mm wider
  than its advance. By the bbox the gap read 4.53 mm; by `getExtentOfChar(n - 1)` - where the last letter really
  ends - 5.02. Measure against the advance.
- **Compare facts as they would be stored.** Anything read from a viewport and written into parameters is normalised
  on the way in; comparing it raw rebuilds forever.
- **Each sheet takes one step, once.** The first open after this release rebuilds its titles, one undo step, and the
  sheet shows unsaved changes. Saved, it never happens again.

### 15.5 Audit of the brief and of every mark on the three screenshots

| The brief, or the mark | Where it is |
|---|---|
| "A new rule that the line... should always be a set distance from the end of the text box that makes the title" | `DrawingTitle__UnderlinePastTextMm`, measured from the end of the words |
| "At least 5 mm past" | 5, and the set length is still a minimum, so a short title's line runs further |
| "If possible" | A bar stood to the right may shorten the run, never below the words (15.2) - Adam to confirm |
| "5 mm in real dimensions... it's 500 because... 1:100" | Paper millimetres: 5 on the sheet at every scale, 500 mm of building at 1:100 |
| "However you calculated all of the dimensions, just make it offshoot by that amount" | The same measure the title already used, now waited for before it is trusted (15.3) |
| "A few of these titles" | Every Drawing Title - three tiles, one type. RB05's D02, D03 and D05 titles are refit on first open |
| Image 1: orange stroke past the end of FASCADE | The line now runs past the last letter; it stopped under the S |
| Image 2: dashed arrow on from the line's end | The same, and the grips (socket, stretch arrow) move with the line |
| Image 3: a 5mm dimension from the words' end | D02's Dim_001, x 148 -> 153; the line now ends at 153.29, 5.02 past the letters |
