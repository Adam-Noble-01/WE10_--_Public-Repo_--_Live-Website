# 28__System__Entourage

People in the plants' line language: flat figures that turn to the camera, drawn at the whitecard's own line weight, fading with their faces, so they give a sense of scale without pulling the eye from the architecture. Built in ValeVision 3D and ported to TrueVision 3D (section In TrueVision). Plan of record: ValeVision's `ValeVision__PLAN__EntourageSystem__.md`. Live state: ValeVision's `ValeVision__WORKING_MEMORY__EntourageSystem__.md`.

Adam, 05-Nov-2026: "the plants on that look amazing, so human entourage needs to be in the same flavour and vibe as to not distract from the architecture".

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

**Built, v2.88.0.** One switch per project in Dev Tools > Assets > Entourage. Switched on, Tools & Settings has an Entourage section: Show Entourage and Transparency for everyone, client links and phones included, and for an author the Asset Browser, the Linework panel, Show on Live Elevations and Save. Since v2.91.0 staff's placing and editing is one panel on the left, the Entourage panel, which opens when that section is unfolded and shuts when it is folded: Assets, In This Project and Changes as dropdown sections, one open at a time (`../22__System__SceneAssets/Na__SceneAssets__Hub__.js`). Figures draw in the live view, stills, thumbnails, video and a sheet's 3D pictures on both engines; on an elevation only when asked. Cloud Sync's Sync Entourage tab keeps SketchUp proxies and the figures in lockstep. Everything below `Na__Entourage__.js` loads only on a project with `Entourage__SceneData__Enabled` true, apart from the Dev section, for an author alone.

## Files

| File | Token | What |
|---|---|---|
| `Na__Entourage__.js` | `Na__Entourage` | The one door in, and the only module on the start-up path |
| `Na__Entourage__AppConfig__.json` | | Defaults, whose keys are the keys a project saves; the ring; the list of generators |
| `01__Core__Engine/Na__Entourage__FigureBuilder__.js` | `Na__EntBuild` | Asset + seed + rules = lines and fill loops: smoothed, pen lifts, hooks. No three.js |
| `02__Core__Data/Na__Entourage__SceneData__.js` | `Na__EntData` | The project's object: defaults, reading, saving |
| `02__Core__Data/Na__Entourage__Library__.js` | `Na__EntLib` | The asset library: the catalogue, assets, a project's pinned copies |
| `02__Core__Data/Na__Entourage__History__.js` | `Na__EntHist` | Undo and redo: whole JSON pictures of what the tools change |
| `03__System__SceneLayer/Na__Entourage__SceneLayer__.js` | `Na__EntLayer` | The objects in the scene, written turned to the eye, the render hook, the pick |
| `03__System__SceneLayer/Na__Entourage__Runtime__.js` | `Na__EntRun` | Joins the layer to the app, and keeps its figures the same as the project's object |
| `10__Ui__Panels/Na__Entourage__DevControls__.js` | `Na__EntDev` | Its part of Dev Tools > Assets: the switch, where a viewer starts, Remove All |
| `10__Ui__Panels/Na__Entourage__MenuSection__.js` | `Na__EntMenu` | The Tools & Settings section; every viewer opens at the project's saved Show and Transparency, and staff capture them with Save (v2.98.4); unfolding it opens the Entourage panel for staff and folding it shuts it (v2.91.0); an admin's rows for an admin (v2.89.0: on by default, `../22__System__SceneAssets` for who placed what) |
| `10__Ui__Panels/Na__Entourage__PanelShell__.js` | `Na__EntShell` | One panel a side, the controls, Save, undo keys, the close guard |
| `10__Ui__Panels/Na__Entourage__AssetBrowser__.js` | `Na__EntCards` | The Entourage panel (v2.91.0): its sections, cards drawn live, search, filters, drag from a card, In This Project, Changes |
| `10__Ui__Panels/Na__Entourage__FigurePicture__.js` | `Na__EntPic` | One figure on a small canvas, for a card and the menu |
| `10__Ui__Panels/Na__Entourage__FigureMenu__.js` | `Na__EntPopup` | The right-click menu, with pictures of who to swap for |
| `10__Ui__Panels/Na__Entourage__LineworkPanel__.js` | `Na__EntLine` | Every line rule as a slider |
| `10__Ui__Panels/Na__Entourage__Styles__Panels__.css` | | What the plants' stylesheet does not have |
| `20__System__Tools/Na__Entourage__FigureTool__.js` | `Na__EntTool` | Drop, move, the ring, keys, right-click |

The library is `54__Entourage__AssetLibrary` at the app's root. Dev Tools > Assets is `70__System__DevTools/Na__UiFeature__AssetsSection__DevControls__.js`.

## Rules That Bite

- **Nothing here imports three.js in `01__Core__Engine`,** so it runs in Node for checks.
- **Nothing outside this folder imports anything but `Na__Entourage__.js`.**
- **`20__System__Tools` shares the plants' tool host, overlay and pick, and the panels share their stylesheet.** Only one tool may have the clicks. They load lazily, and read the plants' config once, whether or not plants are on.
- **A generator is never edited** once a project can hold its figures: `FlatFigure` version 1 is `Na__EntBuild__BuildFigure`. A new look is a new version beside it, listed in the config.
- **The order of random draws is part of that promise.** Pen lifts and hooks draw from separate streams, and every notch draws its three numbers, taken or not, so a slider never reshuffles the other.
- **A change to the walls' sums belongs in `toneFillForCamera` here and in the plants' layer.** It is copied, so a project with people and no plants fetches no plant engine.
- **A figure's fill is written in world space, not turned as a node,** because its one normal must point at the eye: see the plants' layer on the Sobel.
- **A fat line is never hidden with `.visible`:** empty its count, or hide the root group.
- **Saved values are integer mm, Y up. An asset's points are mm in its own plane, as a string.** The layer converts to metres once, on the way in.
- **The object is written whole,** so `Na__EntData__Save` first asks whether the server still holds what this window read, and refuses if not.
- **A sheet's figures share the plants' layer, a twin of the depth fog,** each with its own tick. Only a viewport's tick brings them in, so no existing sheet moves.

## Checks

```bash
python 54__Entourage__AssetLibrary/Na__Entourage__BuildUtil__Library__.py validate
```

```bash
python 54__Entourage__AssetLibrary/Na__Entourage__BuildUtil__Library__.py index --check
```
