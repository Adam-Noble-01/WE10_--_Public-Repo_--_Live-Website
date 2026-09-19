# TrueVision3D - PLAN - The Scrapbook System
# =========================================================

**Opened:** 19-Sep-2026  -  **Author:** Adam Noble - Noble Architecture
**Status:** Phases 0 to 4 built in the opening session. Section 9 is the live ledger.

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

Four facts the design rests on, each checked in the code:

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
        Na__LayoutEditor__ScrapbookParametric__Grips__.js      Na__LeParamGrips  the stretch grip and the lookup grip
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

### 4.5 The viewport link - its own module

`Na__LeParamLink` is the only parametric module that knows what a viewport is.
- **Nearest.** On a drop, the 2D viewport nearest the element, within `MaxLinkDistanceMm`.
- **Resolve.** A link names a sheet AND a viewport. A link whose sheet is not the one the
  element is on (a paste to another sheet, a custom item dropped in another project) is
  broken, and a broken link reads as no link: the element keeps the scale it had.
- **Follow.** It hears `viewport` announcements in the CAPTURE phase, so it runs before the
  history does. It regenerates silently and the history's one snapshot holds the new scale
  and the new bar together: one Ctrl+Z undoes both. A restore announcement is never followed.

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
| `Grips__.js` | `RegisterGroupProvider`, called from the group branch of `Render` |
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
| 4 | Verify: Node tests for the generator, in-app test on a scratch sheet | see ledger |
| 5 | Context menu "Save to Scrapbook"; rename and re-categorise a custom item | open |
| 6 | More parametric elements: drawing title (title, underline, scale bar, linked), north point linked to a site plan's north angle, grid bubble, level marker, section marker, revision cloud | open |
| 7 | ValeVision port, once Adam has signed TrueVision off | open |

---------------------------------------------------------
## 8. Traps for the next session
---------------------------------------------------------

- **The ProjectVision server never reloads its routes.** The scrapbook blueprint answers 404
  or 405 until Adam restarts his 8090 server. Read the running routes with OPTIONS.
- **A scale bar regenerated by a link must never announce inside a restore**, or undo can never
  get past it.
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
