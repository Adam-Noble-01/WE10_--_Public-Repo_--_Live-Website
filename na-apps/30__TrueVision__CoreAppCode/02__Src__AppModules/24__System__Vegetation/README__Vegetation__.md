# 24__System__Vegetation

Linework plants: clean CAD shrubs drawn from rules and a seed, at the whitecard's own line weight. Built in ValeVision 3D and ported to TrueVision 3D (section In TrueVision). Plan of record: ValeVision's `ValeVision__PLAN__VegetationSystem__.md`. Live state: ValeVision's `ValeVision__WORKING_MEMORY__VegetationSystem__.md`.

Adam, 04-Nov-2026: "Use a similar proxy / rendered asset system as to keep assets lightweight for working with and have the renderer doo the work when it loads a view to draw the randomness, there should be rules for shape etc but then radnomisation to create convincing vegetation effect thats not repetative."

## In TrueVision

Ported from ValeVision 3D v2.98.6 at TrueVision v2.185.0 (15-Nov-2026). Most of this folder is ValeVision's code as it
was; each file's PORT NOTE says what differs. Around it, in TrueVision:

- **Saved into the project data.** `Vegetation__SceneData` and `Entourage__SceneData` are top-level keys of
  `TrueVision__ProjectData__.json`, written whole by Save through `../22__System__SceneAssets/Na__SceneAssets__Api__.js`:
  R2 first through the Worker, then the local copy through the ProjectVision local server, refused (nothing written) if
  R2 changed since the window read it. Remove All deletes the key from both. Both keys are on the three keep-lists and
  the two reset lists (`Na__DevSavedKeys`, `Na__DevKeysAbsentAtDefault`; the build's `TRUEVISION_DEV_OWNED_KEYS`; the
  sync's `DEV_OWNED_PROJECT_DATA_KEYS` and `DEV_OWNED_KEYS_ABSENT_AT_DEFAULT`), so a push from SketchUp keeps them.
- **Staff is the author.** `Na__DevGate__IsStaff` is `IsAuthoringEnabled`; `CanCreateAssets` keeps an author on a phone
  to looking. A reader sees Show and Transparency once something is placed. No Change Log, no who-added-it lines:
  TrueVision has one author and keeps no list of who did what.
- **Entourage is `28__System__Entourage`** (TrueVision's 23 is Scene Sync). Asset ids keep the `VVL_` numbers.
- **TrueVision only:** published documents carry the sheet layer (with a vector mask, as the depth fog's); the live
  drawings' own profile cache is refreshed when a root arrives; AO is never asked of an orthographic camera (TrueVision
  draws drawings flat with its AO pass still on); right-clicks keep TrueVision's model menu shut over these menus.
- **Loads last.** Nothing beyond the doors (`Na__Vegetation__.js`, `Na__Entourage__.js`) loads until the model is whole
  (`na-app-model-complete`, v2.186.1), an author's Dev Tools rows included. A changed content stamp is announced as
  `na-placed-assets-changed`, on which an open sheet refills its frames.
- **The proposal's, for now.** On the Existing and Proposed line (v2.186.0) plants and people show on the proposed side
  only (v2.186.2): each runtime's side hook turns its root off while the existing building is drawn. Adam, 15-Nov-2026:
  "For now, we will just do proposed, but in the future, we will probably have to add handling so that plants and people
  can be marked for either existing or proposed." Not yet handled: the existing building chosen on its own in the Design
  Phase menu still shows them, and sheets draw them whatever phase a viewport shows, because a sheet's 3D pictures and
  ticked layers take them from the scene, not from their own phase. The marking needs a field on each plop, path and
  figure (named the same in ValeVision, so the records stay identical), a way to set it, every render knowing which
  phase it draws, and the sheets' fingerprints carrying it; unmarked staying proposed would keep every project as now.
- **Line weights:** `../05__RenderPipeline/Na__RenderEffect__LineworkSettings__State.js` is a stand-in (no user line
  weight, no export scale in TrueVision).
- **Not ported:** Cloud Sync's Sync tabs (SketchUp both ways), ValeVision's `vv3d_` MCP tools, the prototype test bench,
  fog planes' own layers, Video Studio, the activity ledger. ValeVision's plan and working memory for this system are in
  its root, `D:\06__Cloud__Repo__NaCodebase__Puiblic\ValeCodebase\WebApps\Vale__VirtualServer\Vale__ValeVision3D`.

## Where It Stands (as built in ValeVision)

**All nine stages are built (v2.85.0), and plants size and scale, and have the walls' brightness (v2.86.0).** One switch per project in Dev Tools > Vegetation. Switched on, Tools & Settings has a Vegetation section: Show Vegetation and Transparency for everyone, client links and phones included, and for an author the Asset Browser, the Linear Placement Tool, the Bush Tool, the Linework panel and Save. Since v2.91.0 staff's placing and editing is one panel on the left, the Vegetation panel, which opens when that section is unfolded and shuts when it is folded: Line Tool, Brush Tool, Assets, In This Project and Change Log as dropdown sections, all folded when it opens and one open at a time (`../22__System__SceneAssets/Na__SceneAssets__Hub__.js`), with Undo, Redo and Save Vegetation under them (v2.94.2); the section itself keeps Show, Transparency and an admin's rows. While a path is drawn, the Line Tool shows the plants the next click adds as proxies (v2.94.2). Plants draw in the live view, stills, thumbnails, video and a sheet's 3D pictures on both engines; on a plan or elevation only when asked, by a viewport's Vegetation tick or a project's Show on Live Drawings. Cloud Sync's Sync Vegetation tab keeps SketchUp proxies and the planting in lockstep. Everything below `Na__Vegetation__.js` loads only on a project with `Vegetation__SceneData__Enabled` true, apart from the Dev section and what it needs, for an author alone.

## Files

| File | Token | What |
|---|---|---|
| `Na__Vegetation__.js` | `Na__Vegetation` | The one door in, and the only module on the start-up path |
| `Na__Vegetation__AppConfig__.json` | | Defaults, whose keys are the keys a project saves; the list of generators |
| `01__Core__Engine/Na__Vegetation__Random__.js` | `Na__VegRand` | A seeded generator: one seed, one bush, on every machine |
| `01__Core__Engine/Na__Vegetation__BushBuilder__.js` | `Na__VegBuild` | Recipe + seed + size = balls in 3D, in world metres. The generators: `BallCluster` and `ClippedForm` |
| `01__Core__Engine/Na__Vegetation__Contour__.js` | `Na__VegContour` | Balls + camera = outline, T-junctions, hooks and a few arcs, as vector lines |
| `02__Core__Data/Na__Vegetation__SceneData__.js` | `Na__VegData` | The project's object: defaults, reading, saving |
| `01__Core__Engine/Na__Vegetation__PathModel__.js` | `Na__VegPath` | A path's rules and seed = its plants. Cloud Sync has a Python port: change one, change both |
| `01__Core__Engine/Na__Vegetation__BrushModel__.js` | `Na__VegBrush` | Palette draws, keeping plants apart, one brushed plant |
| `02__Core__Data/Na__Vegetation__Library__.js` | `Na__VegLib` | The asset library: the catalogue, recipes, a project's pinned copies |
| `02__Core__Data/Na__Vegetation__History__.js` | `Na__VegHist` | Undo and redo: whole JSON pictures of what the tools change |
| `03__System__SceneLayer/Na__Vegetation__SceneLayer__.js` | `Na__VegLayer` | The objects in the scene, each plant's slot in the shared buffers, the render hook |
| `03__System__SceneLayer/Na__Vegetation__FrameBudget__.js` | `Na__VegBudget` | What may be redrawn this frame, and how: full, moving or settling. No three.js |
| `03__System__SceneLayer/Na__Vegetation__Runtime__.js` | `Na__VegRun` | Joins the layer to the app, and keeps its plants the same as the project's object |
| `10__Ui__Panels/Na__Vegetation__DevControls__.js` | `Na__VegDev` | The Dev section: the one switch, where a viewer starts, Remove All |
| `10__Ui__Panels/Na__Vegetation__MenuSection__.js` | `Na__VegMenu` | The Tools & Settings section; every viewer opens at the project's saved Show and Transparency, and staff capture them with Save (v2.98.4); unfolding it opens the Vegetation panel for staff and folding it shuts it (v2.91.0); an admin's rows for an admin (v2.89.0: on by default, `../22__System__SceneAssets` for who planted what) |
| `20__System__Tools/Na__Vegetation__PlantMenu__.js` | `Na__VegPlantMenu` | Right-click a plant while the Vegetation panel is open: move, size, copy, swap, delete. A plant of a path changes alone |
| `10__Ui__Panels/Na__Vegetation__PanelShell__.js` | `Na__VegShell` | One panel a side, the controls, Save, undo keys, the close guard |
| `10__Ui__Panels/Na__Vegetation__LineworkPanel__.js` | `Na__VegLine` | The demo's Vegetation Linework panel |
| `10__Ui__Panels/Na__Vegetation__AssetBrowser__.js` | `Na__VegCards` | The Vegetation panel (v2.91.0): its sections, cards drawn live, search, filters, click to place, In This Project, move, turn, remove, Changes |
| `10__Ui__Panels/Na__Vegetation__PaletteEditor__.js` | `Na__VegPalUi` | A palette's items, their shares and pictures, shared by both tools; standard palettes copied in on choice (v2.97.0) |
| `10__Ui__Panels/Na__Vegetation__Styles__Panels__.css` | | The panels |
| `20__System__Tools/Na__Vegetation__ToolHost__.js` | `Na__VegTools` | One tool armed at a time, the pointer, the door hold, orbit while painting |
| `20__System__Tools/Na__Vegetation__ToolOverlay__.js` | `Na__VegOverlay` | Tools' aids on a 2D canvas over the model, so they can never print |
| `20__System__Tools/Na__Vegetation__SurfacePick__.js` | `Na__VegPick` | What is under the pointer, by BVH, as the eye sees it |
| `20__System__Tools/Na__Vegetation__LinearTool__.js` | `Na__VegLinear` | Draw and edit paths, Advanced, Bake. Its rows are the panel's Line Tool section (v2.91.0) |
| `20__System__Tools/Na__Vegetation__BushTool__.js` | `Na__VegBushTool` | Paint and erase from a palette. Its rows are the panel's Brush Tool section, and Escape folds it (v2.91.0) |

The library itself is `53__Vegetation__AssetLibrary` at the app's root. Its `VegetationLibrary__StandardPalettes__.json` holds the standard palettes, kept by hand (v2.97.0).

## Rules That Bite

- **Nothing here imports three.js in `01__Core__Engine`,** so it can run in a worker, and in Node for checks.
- **Nothing outside this folder imports anything but `Na__Vegetation__.js`.** Two exceptions: the prototype, `85__EarlyStage__VegetationLinework`, the test bench that never ships, and `28__System__Entourage`, whose figure tool shares the tool host, overlay and pick, and whose panels share the stylesheet, because only one tool may have the clicks. They are lazily loaded on both sides.
- **A generator is never edited** once a project can hold its plants: a saved seed must draw the same bush for ever. `BallCluster` version 1 is `Na__VegBuild__Bush`. A new look is a new version beside it, listed in the config.
- **The order of random draws is part of that promise.** Adding, removing or reordering one `rng` call in a generator changes every plant it has ever made, without any error.
- **A change to what `Contour` draws changes the look of every project.** It is not versioned plant by plant, so such a change is Adam's call.
- **Scale is not size.** `Plop__Scale` is the whole plant, on top of `Plop__SizeMm`, with no draw changed. What a plant really measures is the two together: `Na__VegData__PlopSizeMm`, or `Na__VegRun__SizeOf`. Never read `SizeMm` alone as what is on the ground.
- **The fill's colour is set for each render,** from the scene's lights, in `toneFillForCamera`. A material change to the walls' sums needs the same change there. `FillTone` is the sheet's.
- **A flat shell behaves differently.** Every ball's outline lies under its neighbours, so inner arcs never show: a clipped form has marks. Gaps between its discs let lines through: a box has a core. A step beyond an outline must land on some ball, or it draws as a hole: hence the body behind the shell.
- **A clipped run's ends are behind and ahead along its path,** so it is never flipped, and `Plop__Ends` is in its key.
- **Fit moves centres, never radii,** so a stretched proxy never stretches a scallop. It also means a narrow bed can bury clumps inside a mass, which is why a mass never hides what grows on it (`Na__VegContour__IsHidden`).
- **Saved values are integer mm, Y up.** The builder converts to metres once, on the way in.
- **The scene layer imports nothing of the app's.** It takes a small host object from `Na__Vegetation__Runtime__.js`, so the test bench can draw through it. Without a host every draw is a full one.
- **A fat line is never hidden with `.visible`:** empty its count, or hide the root group.
- **Alpha 0 on the fill is only ever written while MaxEngine's AO runs,** and the AO blur sets it back to 1. It must never reach the page or a still. From the see-through share up the fill is in neither of AO's passes, so it stops: the mark then only cut the wall's own shadow out behind the plant.
- **`Na__VegPath` has a twin.** Cloud Sync's `Na__ValeVisionCloudSync__VegetationSync__.py` ports it, draw for draw, so SketchUp shows a path's plants where the app draws them. Checked against each other by numbers (its DEVLOG, 0.6.0).
- **The object is written whole,** so `Na__VegData__Save` first asks whether the server still holds what this window read, and refuses if not: a SketchUp sync or another window may have changed it.
- **A sheet's plants are a layer of their own,** a twin of the depth fog, never in its base picture. Only a viewport's Vegetation tick brings them in, so no existing sheet moves.

## Checks

```bash
python 53__Vegetation__AssetLibrary/Na__Vegetation__BuildUtil__Library__.py validate
```

```bash
python 53__Vegetation__AssetLibrary/Na__Vegetation__BuildUtil__Library__.py index --check
```

The prototype draws through these modules with the real PureEngine: see its README for how to run it.
