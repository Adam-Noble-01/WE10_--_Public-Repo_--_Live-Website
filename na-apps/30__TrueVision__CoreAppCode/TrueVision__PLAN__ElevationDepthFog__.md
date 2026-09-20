# TrueVision3D - PLAN - Elevation Depth Fog Effect
# =========================================================

**Status:** built 20-Sep-2026 as v2.94.0. **Awaiting Adam's test.** Not in ValeVision.
**Brief:** Adam, 20-Sep-2026, one dictated message and one marked-up screenshot of RB05's South West Elevation.
**Read first:** section 3 (the map he asked for before any code), section 4 (what is still mine to confirm)
and section 7 (the live ledger).

---

## 1. The brief, in his words

> The project is highly modular. You must map it out first before coding anything. In the new upgraded
> elevations menu, we need to create a fog depth effect and create a start effect, which is the distance
> from the plane, the elevations plane. If you set a metre, it would set it a metre behind the plane,
> away from the camera. 1 m into the building, say here, would start the fog, and then add a second end
> value, and that's the distance of the fog. Add a fall-off, and put all three values in a line in a new
> row. Have a subheading called "Fog", and then have: Depth value, End value, Fall-off value. It will be
> a percentage, 0 to 100. Typing 50 in the box would give you a 50% fall-off. If you jack it up higher,
> it makes it more aggressive, so the fog is denser. Each elevation gets fog data saved, so you'll need
> to create a new JSON object [...] You must create a module for this called Elevation Depth Fog Effect
> (In My Style) and in the compositor, the depth effect goes over the line work to fade out the line
> work, so the fog is an actual render layer, which then can be inserted over the 3D viewport and also
> in the drawings as a render layer component (which we've already got a system for). [...] There is
> likely code for another fog effect. Ignore that for now [...] We will be able to use the same fog
> effect on the section system when it's built and in the plan section when it's built. By default, it
> should be toggled off, but it needs to be assigned per elevation.

The sentence the job turns on: *"the fog is an actual render layer"* - not a material trick and not a
pass buried in a chain, but a layer that sits over the linework wherever the drawing is shown.

---

## 2. Requirement audit - every sentence and the one mark

| # | Source | Read literally | Where it lives | State |
|---|---|---|---|---|
| B1 | brief | Map the systems before coding | Section 3 | Done |
| B2 | brief | A fog depth effect in the new Elevations menu | `49/Na__ElevationDepthFog__DevMenu__Row__`, placed by `45/...RowBuilders__` | Built |
| B3 | brief | Start = distance BEHIND the elevation plane, away from the camera | `DepthFog__StartDepthMm`; `Na__ElevFogMath__DepthBehindPlane` | Built |
| B4 | brief | A second, end value - "the distance of the fog" | `DepthFog__EndDepthMm`, measured from the plane like the start. **Reading is mine - D2** | Built |
| B5 | brief | Fall-off, a percentage 0-100; 50 is "a 50% fall-off"; higher is more aggressive and denser | `DepthFog__FalloffPercent`; the fog's density half way along the band. **Reading is mine - D3** | Built |
| B6 | brief | All three values in a line in a new row, under a subheading "Fog" | Caption FOG, then Depth / End / Fall-off as three columns on one line | Built |
| B7 | brief | Each elevation gets fog data saved - a new JSON object | `Elevation__DepthFog { DepthFog__* }` inside the elevation record | Built |
| B8 | brief | A module called Elevation Depth Fog Effect, in his style | `02__Src__AppModules/49__System__ElevationDepthFog/` | Built |
| B9 | brief | The fog goes OVER the linework, as a render layer, over the 3D viewport | `Na__ElevFog__RenderOverlay` in the render loop's drawing branch, after the silhouette pass | Built |
| B10 | brief | ...and in the drawings as a render layer component, in the system that exists | Render Composites row `depthFog`; a fog image ABOVE the vector linework in the frame and in the PDF | Built |
| B11 | brief | Ignore the other fog | `07/Na__Scene__DefaultFogEffect` untouched. It never runs on a drawing anyway (section 3.2) | Done |
| B12 | brief | The same effect for sections and plan sections later | The block, the maths, the layer and the row know nothing about elevations; only the wiring does | Built |
| B13 | brief | Off by default, assigned per elevation | `DepthFog__Enabled: false` written on first read | Built |
| S1 | screenshot | Red arrow from a window of the main house to the gap under **View depth**, above **Advanced** | The Fog block sits exactly there in the open row | Built |

---

## 3. The map

### 3.1 The render loop and rendering system

- ONE `WebGLRenderer`, made in `Index.html`: `antialias`, `alpha`, `logarithmicDepthBuffer: true`, no
  `preserveDrawingBuffer`, pixel ratio capped at 1.5. No reversed depth.
- `01__AppCore/Na__AppFlow__LoadingSequence.js` owns the loop. `Na__RenderLoop__RenderFrame`:
  held engine -> **2D drawing branch** -> interactive overlays -> navigation -> the composer
  (normal / refine / present).
- THE 2D DRAWING BRANCH BYPASSES THE COMPOSER. `Na__DrawView__GetCamera()` non-null means a plan or an
  elevation owns the viewport: `renderer.render(scene, orthoCamera)` flat, then
  `Na__DrawProfile__RenderOverlay` (silhouettes), then `Na__SectionCut__RenderOverlay` (poche), then
  the markup sync. Fog, SSAO and tone mapping "shade a parallel drawing like a surface".
- The same three steps are written down in TWO more places and must stay in step:
  `40/Na__DrawView__RenderPreset__RenderFrame` (the Layout Editor's bake) and
  `21/Na__PresentationMode__Thumbnail__Renderer` (the card thumbnail).
- An orthographic camera under the log depth buffer writes LINEAR window depth
  (`vIsPerspective == 0.0 ? gl_FragCoord.z`). The fat lines know it too (their ortho depth bias).

### 3.2 The 3D compositing system

- `05/Na__RenderPipeline__PostProcessing__Setup.js` is the only place a pass enters the chain:
  RenderPass -> profile lines Sobel -> the existing fog -> SSAO + blur -> FXAA.
- The existing fog is orbit-anchored and radial, reads a depth texture that EXCLUDES the fat linework,
  has no orthographic branch, and only ever sees the perspective camera. It cannot reach a drawing.
- The composer's own targets must not carry a depth texture (feedback loop). Depth comes from the
  profile-lines normal target or a separate pre-pass.
- Progressive refinement and the tiled exporter jitter `camera.projectionMatrix` and keep
  `projectionMatrixInverse` in step - anything that rebuilds positions must read the inverse per sample.
- THE PRECEDENT IS `40/Na__DrawView__ProfileLines__`: off-screen pre-passes through the drawing's own
  camera, then ONE transparent full-screen quad blended onto whatever target was bound when it was
  called - the canvas on screen, the sample target during a supersampled bake.

### 3.3 The 2D compositing system (Layout Editor)

- A "render composite" is a CONFIG ROW (`25/...RenderComposites__Config__.json`): a label, a toggle,
  a weight, a cache token. It is not a render path. The toggle's key must also be in the record
  layer's closed style list (`Viewport__Styles`) to persist.
- ONE raster per 2D viewport: `Na__LeSnap__Render2d` stages the model (design phase, door pose, cut,
  camera, presets, hidden categories), hands the tiled renderer a `renderFrame` callback, and undoes
  all of it. Output: a PNG data URL.
- The frame is a DOM STACK, not a flattened bitmap, and the order is DOM order:
  `img.underlay` -> `div.linework` (SVG vectors) -> `div.markup`. No z-index, no blend modes.
- Keys: the underlay key is built in `Na__LeVp2d__Fill`; the vector cache keys on
  `Na__PlView__RecordHash` and must NOT learn about fog (fog changes no projected geometry).
- PDF (`60/...PdfExporter__`): raster `addImage` -> vector `doc.line` -> scene markup, inside one clip.
  jsPDF 4.1.0 keeps alpha only from a real PNG data URL, never from 'RGBA'.
- The web viewer runs the same Fill path; nothing is published flat.

### 3.4 The drawing editor (Dev Tools > Elevations)

- `45/...DevMenu__RowBuilders__` builds the open row top to bottom: what it is, where it is, what to
  do. View depth is the last control before the folded Advanced. There was no helper for several
  numbers on one line.
- The open row is a DRAFT (`40/Na__DrawView__DraftGuard__` + `DraftMaths__`): edits land on the live
  record, a JSON snapshot taken when the row opens decides "changed", Update is the only save, Revert
  restores in place. A nested object compares and reverts correctly, with two rules: read it through
  a getter (a revert replaces the object), and write its defaults BEFORE the snapshot.
- `Na__ElevDev__DescribeChanges` words the Update dialog; keys in `MOVE_KEYS` turn it red. Fog moves
  nothing, so it is not one.

### 3.5 How the data files are constructed

- `TrueVision__ProjectData__.json` -> `LayoutEditor__DrawingsData` ->
  `LayoutEditor__DrawingsData__Elevations[]`. Flat `Elevation__*` records, integer millimetres.
  `Elevation__Styles { Styles__* }` is the precedent for a nested block whose inner keys carry the
  BLOCK's prefix, not the record's - which is what lets one block serve three record types.
- There is no serialiser: records are saved verbatim, unknown keys survive. `Na__ElevData__Normalise`
  runs on every read and fills what is missing.
- `LayoutEditor__DrawingsData` is already on all three dev-owned key lists (the app, the R2 sync, the
  build script). A key NESTED in a record needs none of them touched.
- The plane: `n = (sin az, 0, -cos az)` points from the building to the viewer;
  `d = origin . n` (mm). Depth behind the plane of a world point P is `d - P . n`.

---

## 4. Decisions that are mine until Adam confirms them

- D1 **A new system folder, `49__System__ElevationDepthFog/`.** The name says Elevation; the code does
  not. Everything in it takes a plane (a normal and a distance) and a settings block.
- D2 **End is measured from the plane, like Depth** - fog starts at Depth and is full at End. The other
  reading (End as the band's length from Depth) differs only when Depth is moved. The row SAYS which
  it is, in words, under the three boxes.
- D3 **Fall-off is the fog's density half way between Depth and End.** 50 is a straight ramp - half
  way there, half fogged. 80 is 80% fogged by half way (aggressive, denser); 20 holds off until late.
  0 and 100 are the two hard walls. One curve, Schlick's bias, identical in the shader and in Node.
- D4 **The fog is white, at full strength, from config** (`DepthFog__Appearance__*`), not per drawing.
  He asked for three numbers. A colour or a ceiling per drawing is a fourth and fifth.
- D5 **A viewport shows its drawing's fog unless told not to.** `Viewport__Styles.depthFog` defaults
  TRUE ("follow the drawing"); the elevation's own switch defaults OFF. One elevation can then be on
  two sheets, fogged on one and not the other.
- D6 **The base image is never fogged.** The fog layer goes over picture and vectors alike, so baking
  it into the picture as well would fog the picture twice.
- D7 **The card thumbnail shows the fog**, because it is a picture of what the author is looking at.
- D8 **Glass is fogged at the pane.** Untextured blended materials are lent a depth write for the
  fog's pre-pass. Textured ones (cut-out trees and figures) are not, and take the fog of whatever
  stands behind them - the lesser of two faults, and the one to revisit if entourage goes on an
  elevation.
- D9 **A fog image is never quite clear.** Its least alpha is 2/255 and its colour is paper white at
  every pixel, so it can be scaled by a sheet at Fit or a PDF viewer without drawing a grey line
  round its own edge. It costs a drawing under 1% of its blackest ink.

---

## 5. Module map (`02__Src__AppModules/49__System__ElevationDepthFog/`)

| File | Namespace | Job |
|---|---|---|
| `Na__ElevationDepthFog__AppConfig__.json` | - | Defaults, limits, appearance, every label |
| `Na__ElevationDepthFog__ConfigState__.js` | `Na__ElevFogCfg` | One fetch, typed getters, fallbacks that mirror the JSON |
| `Na__ElevationDepthFog__Maths__.js` | `Na__ElevFogMath` | PURE. The block's normaliser, the curve, depth behind a plane, the affine depth solve, the token |
| `Na__ElevationDepthFog__RecordData__.js` | `Na__ElevFogData` | Read and write the block on any drawing record |
| `Na__ElevationDepthFog__Shader__.js` | `Na__ElevFogShader` | The GLSL |
| `Na__ElevationDepthFog__RenderLayer__.js` | `Na__ElevFog` | The layer: depth pre-pass, the quad, over a picture or on its own |
| `Na__ElevationDepthFog__DevMenu__Row__.js` | `Na__ElevFogRow` | The Fog block of a drawing's row |
| `Na__ElevationDepthFog__Styles__DevMenu__.css` | - | Three columns on one line, and the sentence under them |

Also touched, all additive:

| Where | What |
|---|---|
| `45/Na__Elevation__ProjectJson__Data__` | The record key, the block written by the normaliser and the creator, `GetDepthFog` / `SetDepthFog` / `GetDepthFogPlane` |
| `45/...DevMenu__RowBuilders__`, `...DevMenu__Editor__` | The block placed under View depth; `onFogChange`; the Update dialog's wording. NOT a move key |
| `45/...ModeController__` | The elevation on screen is the fog layer's source; cleared on leaving |
| `41/Na__SectionCut__Engine__`, `...CapMeshes__` | `RenderDepthInto` - the cut faces into the fog's depth buffer, so a poche stays solid |
| `01/LoadingSequence`, `40/RenderPreset__`, `21/Thumbnail__Renderer` | The one overlay call, in all three places that carry a drawing's frame sequence |
| `51/25/SnapshotRenderer__` | `Render2d`'s optional eleventh argument: the same staged model, drawn as the fog image |
| `51/20/Viewport2d__DepthFog__` (new), `...Frame__`, `...Viewport2d__` | What fog a viewport wants; the sixth frame layer; the key, the debounce, Force Render, the export twin |
| `51/25/RenderComposites__` + config, `51/07/SheetRecords__`, `51/03/ConfigState__SheetSetup__` + `AppConfig__.json` | The Depth Fog composite and its style key, on by default |
| `51/60/PdfExporter__`, `51/10/Styles__Main__Paper__.css` | The image after the vectors; its frame rule |
| `Index.html`, the stylesheet index | One import and one Initialise; one @import |

---

## 6. Testing

- `80__Testing__PrototypeEnvironment/Na__Test__ElevationDepthFog__.test.mjs` - 68 checks on the
  pure maths. The fixture is RB05's South West Elevation ("cut -2200 mm").
- Both verifiers. (The module graph's one failure on 20-Sep was another session's `SceneEditor`.)
- In the app on RB05, `tv-depthfog` (localhost:8811), every write refused and none attempted: the
  block on first read; the 3D view and the card thumbnail; the row and its draft; the sheet
  `D01 - TEMP__Elevations`; the PDF read back with PyMuPDF.
- HOW THE PICTURES WERE PROVED. The pane's screenshots crop to a corner, so composites were built in
  the page and POSTed to the server's `/__save/` route (`tv_projectqr_nocache_save_server.py`), then
  read from disk. A fog image is checked by its NUMBERS, not its look: colour plane min and max,
  alpha min and max, read with `createImageBitmap(..., { premultiplyAlpha : 'none' })`.
- NOT tested: a real save (needs the ProjectVision server), a real pointer in the row, the web viewer.

---

## 7. Ledger

| Date | Version | What |
|---|---|---|
| 20-Sep-2026 | - | Mapped (section 3). Plan written. Build started. |
| 20-Sep-2026 | v2.94.0 | **Built and tested as above. Awaiting Adam's test.** Three faults found on the way and fixed: glass with no depth, and a ghost outline that turned out to be the fog image's own black-under-clear colour plane (DEVLOG v2.94.0 has the two wrong diagnoses that came first) |
| - | - | **Next:** Adam's test. Then the ValeVision question. Then plans and cross sections, when that system exists |

### Open after the build

- **Is End measured from the plane (as built), or from Depth?** D2. The row states which.
- **Is Fall-off "how fogged by half way" what he meant?** D3. The alternative reading - a ceiling on
  the fog's strength - is a different control, and the whitecard release's 'percent' weight would
  carry it per viewport if wanted.
- **Fog colour and ceiling are config, not per drawing.** D4.
- A cut-out tree or figure on an elevation takes the fog of what is behind it. D8.
- Floor plans and cross sections: the wiring only - a key, a plane, a row.
- The follow-up he dictated mid-build - standard, always-present, off-by-default Floor Plans /
  Elevations / Sections scene groups - is written up in `TrueVision__NOTES__StandardDrawingGroups__.md`.
