# TrueVision 3D - ValeVision Re-Alignment: Drawing Systems, Projected Linework, Layout Editor

**Status**: AGREED - decisions answered 10-Sep-2026 (section 3). Ready to start Phase A.
**Created**: 10-Sep-2026
**Owner**: Adam Noble

**Companion documents**
- `WebApps/ValeVision3D/ValeVision__PLAN__TrueVisionPort__LayoutEditor__.md` - the outbound port plan; this document is its mirror. Record schemas and per-file design notes live there and are deliberately not restated here.
- `WebApps/ValeVision3D/ValeVision__PARITY__TrueVisionLedger__.md` - the parity ledger. Its "Pending back-port" table is the seed for this work.
- `TrueVision__DEVLOG__.md` - one entry per phase, newest first, house voice.

---

## 0. How to read this document

This work spans many sessions. **Section 12 is the progress ledger** - the only place
that records what is actually done. Everything above it is design and does not change
once agreed, except where a decision is revised in place with a dated note (the
ValeVision plan's convention).

Start a session by reading sections 1, 2, 3 and 12. Finish a session by updating 12.

---

## 1. End goal

Two apps, one drawing system. Vale Garden Houses drawings authored in ValeVision and
Noble Architecture drawings authored in TrueVision must present the **same interface,
the same interactions and the same output**, so switching between them costs nothing.

ValeVision is the gold standard. It ran ahead over 09/10-Sep-2026 through five port
phases (v2.16.0 to v2.21.14) and now carries systems TrueVision has never had. This
plan brings TrueVision back to parity, and then keeps it there.

Delivered at the end of this work, TrueVision has:

1. The **version-locked library set** (three r184, three-mesh-bvh, clipper2-js,
   three-edge-projection) in place of the esm.sh r160 import map.
2. A **drawing core** matching ValeVision's `42__System__DrawingViewCore` - shared
   config state, shared style rows, one data writer, one rename path, folding rows.
3. **Floor plans and elevations** at feature parity - Ground Floor Plan quick action,
   per-drawing style toggles, Pick Face and the gizmo grip, sections filed by type.
4. **Projected linework** - exact hidden-line-removed vector drawings from the mesh
   GLBs, baked to R2 on localhost, with the SketchUp linework GLB as a second class.
5. The **Layout Editor** - drawing tabs under the header, paper sheets at A4 to A1,
   scaled viewports, layers, text, dimensions, vector shapes, title blocks, undo,
   autosave and a true-size vector PDF.
6. An **installable Windows PWA** that opens straight into the Layout Editor and is
   usable as drawing software.

Out of scope: the legacy `90__System__PageLayoutSystem` browser tab (it stays until
the Layout Editor supersedes it, then it is retired in a separate pass), any SketchUp
plugin change, and any change to ValeVision beyond ledger updates.

---

## 2. What was surveyed (10-Sep-2026)

### 2.1 The two trees, side by side

| System | ValeVision | lines | TrueVision | lines | Gap |
|---|---|---|---|---|---|
| Vendored libraries | `04__Lib__ThirdParty__VersionLocked/` (4 vendors, 29 MB) | - | esm.sh `three@0.160.0` import map | - | **Whole set missing** |
| Scene groups | `21__System__PresentationMode` (11 files, incl. 3 splits) | - | `21__System__PresentationMode` (11 files, no splits) | - | 3 splits + confirm dialog |
| Drawing core | `42__System__DrawingViewCore` (16 files) | 5,070 | `40__System__DrawingViewCore` (5 files) | 2,157 | **11 files missing** |
| Section engine | drives `41__System__CrossSectionView` via adapter | - | own `41__System__SectionCutEngine` (5 files) | 1,914 | Adapter re-written, not copied |
| Floor plans | `43__System__FloorPlanViews` (10 files) | 4,184 | `42__System__FloorPlanViews` (11 files) | 4,092 | Feature deltas only |
| Annotations | `44__System__PlanAnnotations` (8 files) | - | `43__System__PlanAnnotations` (8 files) | 3,182 | Near-verbatim already |
| Dimensions | `45__System__PlanDimensions` (15 files) | 6,727 | `44__System__PlanDimensions` (13 files) | 6,328 | 2 splits missing |
| Elevations | `46__System__ElevationViews` (13 files) | 6,204 | `45__System__ElevationViews` (11 files) | 4,946 | FacePick + GizmoGrip + deltas |
| Projected linework | `50__System__ProjectedLinework` (24 files) | 8,651 | none | 0 | **Whole system missing** |
| Layout editor | `51__System__LayoutEditor` (49 files) | 16,205 | none (legacy `90__System__PageLayoutSystem`, 1,936) | 0 | **Whole system missing** |

Net new code to land in TrueVision: roughly **28,000 lines across 84 new files**, plus
edits to about 25 existing files.

### 2.2 The five structural divergences

These are why this is not a copy-and-repoint job. Each is a deliberate, load-bearing
difference that must be respected, not flattened.

#### DIV-1 - The drawing render path

ValeVision renders drawings **through** the EffectComposer with the RenderPass camera
swapped to ortho, disabling the fog and AO passes with a preset
(`Na__DrawView__ComposerPreset__.js`, decision D12), relying on its ortho-aware
`Na__RenderEffect__2dProfileLines__` twin.

TrueVision deliberately **bypasses** the composer for drawings and composites the
Sobel edge as a **transparent full-screen quad over the finished flat render**
(`40/Na__DrawView__ProfileLines__.js`, v2.19.0). That decision stands: routing a
drawing back through TrueVision's composer would drag fog and SSAO onto it.

**Consequence**: `ComposerPreset__` is *not* ported. TrueVision keeps `ProfileLines__`
and gains `Na__DrawView__RenderPreset__.js` presenting the same **interface** (enter,
exit, apply style toggles, announce the change) over its own overlay route.
Everything downstream that calls the preset - the mode controllers, the Layout
Editor's `SnapshotRenderer__` - then ports unchanged.

#### DIV-2 - The section engine

ValeVision's `42/Na__DrawView__SectionAdapter__.js` wraps the **live Cross Sections
user tool** (`41__System__CrossSectionView__SystemLogic`), snapshotting and restoring
the user's own section state around a drawing (D07), including `SuspendLiveTool` and
`Release`.

TrueVision has a purpose-built `41__System__SectionCutEngine` with no live user tool
behind it, so there is no user state to snapshot.

**Consequence**: TrueVision gets a **thin** `40/Na__DrawView__SectionAdapter__.js`
exposing the same five entry points over `Na__SectionCut__*`. `SuspendLiveTool` and
`Release` become documented no-ops. Roughly 150 lines against ValeVision's 400.

#### DIV-3 - Storage location of drawing records

TrueVision stores plans and elevations **inside** the presentation block, at
`PresentationMode__SavedCameraScenes__FloorPlans` and `...__Elevations`
(`42/Na__FloorPlan__ProjectJson__Data__.js:73`,
`45/Na__Elevation__ProjectJson__Data__.js:93`).

ValeVision moved them to a **top-level** `LayoutEditor__DrawingsData` block carrying
`__FloorPlans`, `__Elevations`, `__Sheets` and `__ClientDimensionsEnabled` (D08). The
Layout Editor's sheets have nowhere sensible to live under the presentation block, and
the two are written by different panels, so the split is the right shape.

**Consequence**: TrueVision **migrates** to `LayoutEditor__DrawingsData` with a
read-time upgrade shim (section 5.2). TrueVision's top-level key convention is already
system-prefixed (`Navmode__`, `RenderEffect__`, `Camera__`,
`OrbitHelperCube__`), so ValeVision's key name fits TrueVision unchanged and the two
trees diff cleanly. No renaming.

#### DIV-4 - The persistence transport

ValeVision: Flask localhost server, plus the `whitecardopedia-editor-api` worker, plus
a **new** path-guarded `POST /api/editor/projects/{folderId}/assets` route and a Flask
mirror, under `VaApps/Projects/{folderId}/` (D36 - required a wrangler deploy).

TrueVision: **no Flask at all**. The `na-truevision-api` worker already exposes generic
`/r2/read`, `/r2/write`, `/r2/list`, `/r2/delete` over the `NaProjectPortal/` prefix,
and `Na__CfApi__WriteThumbnailWebp` already proves the base64 binary write path.

**Consequence**: **no worker change and no deploy are needed.** The asset upload
utility is a ~120-line wrapper over the existing `/r2/write`. This is materially
simpler than the ValeVision side, and R2 is the sole writer - which matches the
"Cloudflare R2 is always the priority" rule directly rather than by convention.

#### DIV-5 - Library baseline

ValeVision was on r160 and upgraded to r184 in Phase 0 with a documented touch-point
checklist. TrueVision is still on r160 **from esm.sh over the network** - not
reproducible, not offline-capable, and therefore fatal for an installable PWA.

**Consequence**: Phase A is the same upgrade against TrueVision's own shader set, plus
a `.gitignore` correction (2.3).

### 2.3 Three environment facts that will bite if forgotten

1. **`.gitignore` ignores `build/`.** The vendored three.js ships as
   `01__Vendor__ThreeJs__v0.184.0/build/three.module.js`. Without explicit negation
   lines the entire renderer is silently untracked and the live site 404s on the
   import map. PlanVision already hit this and solved it the same way - copy that
   pattern from the `PdfJs__3.11.174/build/` negations near the top of `.gitignore`.
2. **GitHub Pages 1 GB limit.** `.github/workflows/static.yml` already prunes `*.glb`,
   `*.zip` and the CAD audit cache before upload because the repo is far past 1 GB
   (~4.7 GB tracked). Vendored `.js` survives the prune, so +29 MB is safe - but a
   successful push is **not** a successful deploy. Check the Actions run every time.
3. **The service worker version token.**
   `62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js:71` holds
   `PWA_SW_VERSION_TOKEN` (currently `2026-09-07-1`). Every phase that changes shell
   JS, CSS or the import map **must** bump it, or installed PWAs keep serving the old
   module graph. ValeVision bumped it on nearly every release for exactly this reason.

---

## 3. Decisions register

Answered 10-Sep-2026. Each carries the id it is referenced by elsewhere in this document.

| Id | Decision |
|---|---|
| **TD01** | **Authoring runs from both origins, via an unlock flag.** A new `03__AppUtils/Na__AppUtils__DevGate__.js` exports `Na__DevGate__IsAuthoringEnabled()`, true for localhost **or** a persisted unlock flag. Every existing `hostname === 'localhost'` test in the dev menu, scene editor, drawing panels and Layout Editor routes through it. The installed Windows PWA therefore authors from the live origin without a local server running, and the fast localhost edit-reload loop is untouched. |
| **TD02** | **`90__System__PageLayoutSystem` stays through this work.** It is the source of the vendored jsPDF UMD the exporter injects. Its browser tab and UI are retired in a separate pass once the Layout Editor ships, not during it. |
| **TD03** | **`PS01__MustersRoad` is the migration reference project.** It carries a basic plan and elevation set. Year folder `26-Projects`, R2 key `NaProjectPortal/26-Projects/PS01__MustersRoad/30__TrueVision__AppContent/TrueVision__ProjectData__.json`, worker `https://na-truevision-api.adam-fb3.workers.dev`. See 3.1 for why this cannot be tested against the repo copy. |
| **TD04** | **Modern title block only, Noble Architecture branding.** Vector primitives rendered to SVG and PDF from one list: NA logo, then the field rows (client, site address, drawing number, revision, scale, issue date, drawn by). `TitleBlock__Classic__.js` is **not ported** - the only scan that exists is Vale's, and a Vale title block on an NA drawing is a live-output hazard. Classic is added if and when an NA scan exists; the `TitleBlock__Style` field stays in the record so adding it later is additive. |
| **TD05** | **Client measuring stays and stays aligned.** TrueVision already has `44/Na__PlanDimensions__ClientMode__.js`; it is kept in step with ValeVision's, which costs nothing. |

### 3.1 The repo copy of a project's data is the base file, not the truth (TD03)

`na-project-portal/26-Projects/PS01__MustersRoad/30__TrueVision__AppContent/TrueVision__ProjectData__.json`
in this repo has **seven top-level keys and no `PresentationMode__SavedCameraScenes`
at all**. The plans and elevations exist only on R2, because
`01__AppCore/Na__AppFlow__LoadingSequence.js` loads the repo file as the complete base
document and then overlays only the `Na__DevSavedKeys` list from the live R2 copy.

Three consequences, all load-bearing:

1. **The DIV-3 migration runs against the R2 overlay**, never against the repo file. A
   migration that reads only the base document sees nothing to migrate and writes an
   empty block over live work.
2. **The repo file is never hand-edited** to add `LayoutEditor__DrawingsData`. Doing so
   creates a second stale copy that the overlay silently shadows.
3. **`Na__DevSavedKeys` must gain `'LayoutEditor__DrawingsData'` before the migration
   ships**, or the overlay drops the new block on every load and each session appears
   to lose its drawings. This is the single highest-consequence line in Phase B.

Verify against PS01 by reading R2 through the worker (`POST /r2/read`) rather than
opening the repo file.

---

## 4. Code discipline

Inherited from the ValeVision plan's section 4, restated for this direction of travel.

- **Naming**: `Na__` prefix on file names and JS identifiers. Ported files keep their
  ValeVision names verbatim so the trees diff cleanly, with the folder number
  translated (4.1). CSS classes stay `na-` BEM. Window events stay `na-` kebab-case
  and keep their ValeVision names exactly.
- **PORT NOTE**: every ported or parity-tracked file carries a `PORT NOTE` block in its
  header naming its ValeVision counterpart, the parity state and every deliberate
  divergence. This is what makes the ledger auditable.
- **Line budget**: 900 lines a file. ValeVision split `SheetModel__`/`SheetRecords__`
  and `PlanDimensions__Data__`/`ConfigState__` for exactly this reason; keep the
  splits rather than re-merging.
- **Config discipline**: no magic numbers in logic. Each system carries its own
  `*__AppConfig__.json`; `Na__AppConfig__Main.json` overrides it; hard-coded fallbacks
  come last. The `ConfigState__` modules encode that order.
- **Ledger**: `ValeVision__PARITY__TrueVisionLedger__.md` is updated from the
  TrueVision side too. Each row this work closes moves out of "Pending back-port".

### 4.1 Folder number map

Fixed for the whole of this work:

| ValeVision | TrueVision | Note |
|---|---|---|
| `42__System__DrawingViewCore` | `40__System__DrawingViewCore` | exists; grows from 5 to 15 files |
| `41__System__CrossSectionView` | `41__System__SectionCutEngine` | different implementations, same role |
| `43__System__FloorPlanViews` | `42__System__FloorPlanViews` | exists |
| `44__System__PlanAnnotations` | `43__System__PlanAnnotations` | exists |
| `45__System__PlanDimensions` | `44__System__PlanDimensions` | exists |
| `46__System__ElevationViews` | `45__System__ElevationViews` | exists |
| `50__System__ProjectedLinework` | `50__System__ProjectedLinework` | **new**, same number |
| `51__System__LayoutEditor` | `51__System__LayoutEditor` | **new**, same number |
| `04__Lib__ThirdParty__VersionLocked` | `04__Lib__ThirdParty__VersionLocked` | **new**, same name, app root |

Numbers 50 and 51 are free in TrueVision, so the two trees share them. Only the
42→40, 43→42, 44→43, 45→44, 46→45 shifts differ, and they are mechanical.

---

## 5. Data model and migration

### 5.1 Target shape

Identical to ValeVision, in `TrueVision__ProjectData__.json`:

```jsonc
"LayoutEditor__DrawingsData": {
    "LayoutEditor__DrawingsData__Description"            : "TrueVision-owned drawing definitions: floor plans, elevations and sections with their markup, and Layout Editor sheets. Distances are integer millimetres.",
    "LayoutEditor__DrawingsData__Version"                : 1,
    "LayoutEditor__DrawingsData__ClientDimensionsEnabled": false,
    "LayoutEditor__DrawingsData__FloorPlans"             : [ /* FloorPlan records */ ],
    "LayoutEditor__DrawingsData__Elevations"             : [ /* Elevation records */ ],
    "LayoutEditor__DrawingsData__Sheets"                 : [ /* DrawingSheet records */ ]
}
```

Record schemas are **byte-identical to ValeVision's** - sections 5.2, 5.3 and 5.5 of
`ValeVision__PLAN__TrueVisionPort__LayoutEditor__.md`. They are deliberately not
restated here so there is one definition and it cannot drift.

Scene-side keys stay where they are, inside `PresentationMode__SavedCameraScenes`:
`PresentationMode__Scene__GroupId`, `__Order`, `__FloorPlanId`, `__ElevationId`, and
the `__Groups` array.

### 5.2 The migration (DIV-3)

One-way, read-time, in `40/Na__DrawView__ProjectData__.js`:

**THREE keys migrate, not two.** Read live from PS01 on 10-Sep-2026, the presentation
block carries `__FloorPlans`, `__Elevations` **and `__ClientDimensionsEnabled`**. The
last one is easy to miss because it is a scalar sitting between two arrays, and losing
it silently turns client measuring off on every project that had it on:

| Legacy key (inside `PresentationMode__SavedCameraScenes`) | New key (inside `LayoutEditor__DrawingsData`) |
|---|---|
| `..__FloorPlans` | `LayoutEditor__DrawingsData__FloorPlans` |
| `..__Elevations` | `LayoutEditor__DrawingsData__Elevations` |
| `..__ClientDimensionsEnabled` | `LayoutEditor__DrawingsData__ClientDimensionsEnabled` |

`__Groups`, `__Scenes`, `__Description`, `__Enabled` and `__DefaultSceneId` stay where
they are - they are scene-side, not drawing-side (D08).

1. On load, if `LayoutEditor__DrawingsData` is absent **and** any of the three legacy
   keys is present, lift all three into a fresh block, stamp `__Version: 1`, set a
   dirty flag. A missing `__ClientDimensionsEnabled` defaults to `false`.
2. The legacy keys are **left in place, untouched**, until the first successful save of
   the new block. That save writes the new block and deletes the legacy keys in the
   same merge, so there is never a moment where the only copy is unwritten.
3. A project carrying both blocks reads the new one and logs a warning naming both -
   that state means a save was interrupted and wants eyes on it.
4. `Na__DevSavedKeys` in `01__AppCore/Na__AppFlow__LoadingSequence.js:295` gains
   `'LayoutEditor__DrawingsData'`. Without it the R2 overlay drops the new block on
   every load and each session appears to lose its drawings. **Land this line before
   anything writes the block** - see 3.1.
5. The migration reads the **overlaid** document, after the R2 read has resolved, never
   the repo base file (3.1). It runs once per load and is idempotent: a document that
   already has the new block is left alone.

### 5.3 Save path

One writer, mirroring ValeVision's single-writer rule over TrueVision's transport:

`Na__DrawData__Save()` → `Na__CfApi__MergeAndSaveKeys({ LayoutEditor__DrawingsData,
PresentationMode__SavedCameraScenes })`. The worker does read-merge-write on
`NaProjectPortal/{year}-Projects/{projectFolder}/30__TrueVision__AppContent/TrueVision__ProjectData__.json`.

The Floor Plans, Elevations and Layout Editor dev panels all call this one function.
The group editor never saves for itself - it raises `na-presentation-groups-changed`
and the scene editor writes, exactly as both apps already do.

### 5.4 R2 asset keys

Under the existing per-project content prefix
`NaProjectPortal/{year}-Projects/{projectFolder}/30__TrueVision__AppContent/`:

| Asset | Relative key | Written by |
|---|---|---|
| Scene thumbnail | `PresentationMode/Thumbnails/{sceneId}.webp` | existing `Na__CfApi__WriteThumbnailWebp` |
| Baked linework | `LayoutEditor/Linework/{drawingId}__{fingerprint}.json` | projection pipeline, authoring only |
| 3D viewport snapshot | `LayoutEditor/Snapshots/{sheetId}__{viewportId}__{fingerprint}.png` | Layout Editor, authoring only |

New client helper `Na__CfApi__WriteProjectAsset(relativePath, blobOrJson, contentType)`
in `80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js` (~120 lines):
base64-encode, build the key from `GetProjectContext()`, `POST /r2/write`, return
`{ ok, relUrl, publicUrl }` with `publicUrl` from the existing
`Na__CfApi__BuildContentCdnUrl`. Reads go through that CDN URL with the loader's
existing R2-first fallback.

**No worker deploy. No Flask. No new route.** (DIV-4.)

---

## 6. Phase A - Version-locked libraries (target v2.20.0)

The riskiest phase, and first because everything downstream needs r184.

### 6.1 Vendoring

Copy from `WebApps/ValeVision3D/04__Lib__ThirdParty__VersionLocked/` so all three apps
run byte-identical libraries:

```
30__TrueVision__CoreAppCode/04__Lib__ThirdParty__VersionLocked/
    01__Vendor__ThreeJs__v0.184.0/            25 MB   build/ + examples/jsm/
    02__Vendor__ThreeMeshBvh__v0.9.9/         2.2 MB  src/
    03__Vendor__Clipper2Js__v0.9.0/           1.8 MB  fesm2020/
    04__Vendor__ThreeEdgeProjection__v0.0.10/ 253 KB  src/
    TrueVision__Dependencies__ImportMap__Index__.json
    TrueVision__Dependencies__VersionLock__README__.md
```

Clipper2 is **not optional** - `three-edge-projection`'s SilhouetteGenerator imports it
at module load, and a bare unresolved specifier breaks every module on the page.
ValeVision learned this the hard way in v2.21.1.

`Index.html` import map replaces the two esm.sh entries with eight relative ones (the
exact map is in the ValeVision plan section 6.1; only the folder prefix changes).

### 6.2 `.gitignore` (2.3, fact 1)

Add negations directly beneath the PlanVision block:

```
# TrueVision version-locked three.js runtime (must be deployed to live)
!na-apps/30__TrueVision__CoreAppCode/04__Lib__ThirdParty__VersionLocked/
!na-apps/30__TrueVision__CoreAppCode/04__Lib__ThirdParty__VersionLocked/**
```

Verify with `git status --porcelain` and `git check-ignore -v <a build/ file>` before
committing. A clean `git add` that stages nothing under `build/` is the failure mode.

### 6.3 Touch points to re-verify (r160 → r184)

TrueVision's own shader and loader surface. Every row is a place ValeVision found or
expected breakage.

| File | What to check |
|---|---|
| `Index.html` renderer creation | Constructor options unchanged; `outputColorSpace` default; no `useLegacyLights` reference |
| `05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js` | `EffectComposer`, `RenderPass`, `ShaderPass`, `FXAAShader` import paths; FXAA was rewritten upstream after r160 - compare edge softness on a reference project |
| `05__RenderPipeline/Na__RenderEffect__ProfileLines__.js` | `MeshNormalMaterial` override; `WebGLRenderTarget` options (`samples`, `depthTexture`, `HalfFloatType`); `DepthTexture` constructor |
| `40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js` | Same, plus the borrowed-buffer path (`profileNormalTarget`, `profileColorTarget`, `profileLinesPassRef`) and the full-screen quad blend |
| `05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js` | Per-material `clippingPlanes` assignment; `renderer.localClippingEnabled` |
| `05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js` | Frustum and distance maths against the r184 camera |
| `15__ModelLoader/*` | `LineMaterial.onBeforeCompile` patch replacing `#include <logdepthbuf_fragment>` - confirm the chunk still exists in the r184 LineMaterial fragment shader and the fat-line depth bias still lands (the ground line test) |
| `41__System__SectionCutEngine/Na__SectionCut__CapGeometry__.js` | `THREE.ShapeUtils.triangulateShape` signature unchanged |
| `10__NavigationAndCameras/*` | OrbitControls now extends the `Controls` base: construction still connects; verify `enabled`, `target`, `update()`, and the walk/fly hand-offs that toggle `controls.enabled` |
| `30__System__ImageExport/*` | Sub-frustum camera offsets in the tiled renderer unchanged; post-process Levels and HighPassSharpen still read the same buffers |
| `20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js` | `KHR_materials_*` glass still lands as `MeshPhysicalMaterial` |
| `25__System__3dObject__InteractionSystem/*` | `onBeforeCompile` shader edit still matches the chunk it searches for |
| `62__Feature__AppInstallability/*` | Bump `PWA_SW_VERSION_TOKEN`; confirm the vendor cache bucket now catches same-origin vendor files rather than esm.sh |

### 6.4 Hand-over test list

1. A reference project loads with no console errors from the import map.
2. Profile lines, section cuts, HDR glass and shadows look as before (compare against
   a pre-upgrade screenshot of the same scene).
3. Ground line stays visible (fat-line depth bias).
4. Orbit, walk and fly modes; door animation; billboards; distance culling.
5. Image export, viewport and tiled.
6. Floor plan and elevation drawings still render flat with their profile overlay.
7. **Offline**: with the network throttled to offline after one load, the app still
   boots from the service worker cache. This is the acceptance test that the esm.sh
   dependency is genuinely gone.

**Do not delete anything.** There is nothing to delete - TrueVision had no vendored
folder. The esm.sh entries simply leave the import map.

---

## 7. Phase B - Drawing core re-alignment (target v2.21.0)

Grows `40__System__DrawingViewCore` from 5 files to 15, and lands the DIV-3 migration.
This is the seam every later phase attaches to, so it goes in before the big systems.

### 7.1 New files

| File | Source | Parity | Notes |
|---|---|---|---|
| `Na__DrawView__ConfigState__.js` | VV `42/` same | verbatim | Main config over system JSON over fallbacks |
| `Na__DrawView__StyleRows__.js` | VV `42/` same | verbatim | Style toggles and exclusion field shared by plans and elevations |
| `Na__DrawView__ProjectData__.js` | VV `42/` same | **adapted** | Owns `LayoutEditor__DrawingsData`; save via `Na__CfApi__MergeAndSaveKeys`; carries the 5.2 migration |
| `Na__DrawView__SectionAdapter__.js` | VV `42/` same | **diverged (DIV-2)** | ~150 lines over `Na__SectionCut__*`; Suspend/Release documented no-ops |
| `Na__DrawView__RenderPreset__.js` | VV `42/Na__DrawView__ComposerPreset__.js` | **diverged (DIV-1)** | Same interface, overlay route; must restore the profile-lines pass state on exit (VV v2.21.2 fix) |
| `Na__DrawView__MaterialPreset__.js` | VV `42/` same | verbatim | Self-contained stash and restore |
| `Na__DrawView__Transitions__.js` | VV `42/` same | verbatim | Walk and fly return to orbit through the toolbar |
| `Na__DrawView__RenameDrawing__.js` | VV `42/` same | adapted | The one path that writes all four holders of a name (VV plan 5.8); TrueVision's fourth holder is the section-cut binding key |
| `Na__DrawView__RowAccordion__.js` | VV `42/` same | verbatim | Single open slot across both dev panels |
| `Na__DrawView__AppConfig__.json` | VV `42/` same | adapted | NA labels |
| `Na__DrawView__Styles__DevMenu__.css` | VV `42/` same | adapted | Header, arrow, folded body rules |

### 7.2 Relocations and edits

- `42/Na__FloorPlan__MarkupFocus__.js` → `40/Na__DrawView__MarkupFocus__.js`, namespace
  `Na__DrawFocus__`. ValeVision made the same move; the arbiter serves both drawing
  kinds and does not belong to floor plans.
- `40/Na__DrawView__MarkupMount__.js` - dimension config getters come from the split
  `ConfigState__` module.
- `01__AppCore/Na__AppFlow__LoadingSequence.js` - load the drawings block after project
  data resolves; dispatch `na-layouteditor-drawingsdata-loaded`; add
  `'LayoutEditor__DrawingsData'` to `Na__DevSavedKeys`; add
  `Na__RenderLoop__Pause` / `Na__RenderLoop__Resume` with stacking reasons (VV v2.21.2 -
  needed by Phase G, cheaper to land here).
- `42/Na__FloorPlan__ProjectJson__Data__.js` and `45/Na__Elevation__ProjectJson__Data__.js`
  - read and write through `Na__DrawData__*` instead of their own key constants.
- Delete `Na__FpLink__SyncSceneName` and `Na__ElevLink__SyncSceneName` outright. A
  helper that does the easy quarter of a rename is how the record and the card drifted
  apart in ValeVision in the first place.

### 7.3 Hand-over test list

1. A project with legacy `PresentationMode__SavedCameraScenes__FloorPlans` opens with
   every plan present; the legacy keys are still on R2 until the first save; after one
   save the new block is there and the legacy keys are gone.
2. A project with neither block opens with an empty skeleton and no errors.
3. Renaming a plan updates the record, the carousel card, the section binding key and
   any snapshot fingerprints, in one save; a failed save reverts all of it.
4. Dev panel rows fold; one open at a time across both panels; opening a row does not
   preview it.
5. Style toggles on a plan record round-trip through a save and reload.

---

## 8. Phase C - Floor plan and elevation parity (target v2.21.x)

Feature deltas only; no restructuring. Everything here is in the ledger's
"Pending back-port" table already.

| Item | Files | Source |
|---|---|---|
| Scene row builders and reorder helpers split out of the 1,622-line scene editor | `21/Na__PresentationMode__DevMenu__SceneRowBuilders__.js`, `...__SceneReorder__.js` | VV `21/` same |
| Async confirm dialog replacing `window.confirm` (which blocks the render loop and cannot be styled) | `21/Na__PresentationMode__DevMenu__GroupEditor__.js` + scene editor | VV `21/` same |
| Ground Floor Plan one-click default at datum 0 | `42/Na__FloorPlan__DevMenu__Editor__.js` | VV `43/` same |
| Per-drawing style toggles through the shared StyleRows | `42/Na__FloorPlan__DevMenu__RowBuilders__.js`, `45/Na__Elevation__DevMenu__RowBuilders__.js` | VV same |
| Dimension config and preview splits (TrueVision's Data and Editor are 988 and 907 lines) | `44/Na__PlanDimensions__ConfigState__.js`, `...__EditorPreview__.js` | VV `45/` same |
| Pick Face - click threshold, first mesh hit, XZ normal, bearing from normal | `45/Na__Elevation__FacePick__.js` (new) | VV `46/` same |
| Gizmo grip - drag along the plane normal against the gizmo face mesh only, orbit paused for the drag | `45/Na__Elevation__GizmoGrip__.js` (new) | VV `46/` same |
| Sections filed by drawing type into the Cross Sections group | `45/Na__Elevation__SceneLink__.js`, config section-group keys | VV `46/` same |
| `IsDrawingApproach` on approach scenes; framing hook | `42/Na__FloorPlan__Framing__.js`, `45/Na__Elevation__Framing__.js`, `21/Na__PresentationMode__Camera__SceneTransition.js` | VV same |

### 8.1 Hand-over test list

1. Ground Floor Plan creates a working plan in one click on a project with no named storeys.
2. Pick Face on a wall seeds an elevation whose azimuth matches the wall; the gizmo drags the plane and the sliders fine-tune the same value.
3. A Section-mode elevation lands in the Cross Sections group; an Elevation-mode one lands in Elevations; changing the mode moves the card.
4. Every destructive dev action asks through the styled dialog, and the render loop keeps running behind it.

---

## 9. Phase D - Projected linework (target v2.22.0)

The `50__System__ProjectedLinework` system, 24 files and 8,651 lines. This is the
largest single copy in the work and the most nearly verbatim, because ValeVision itself
ported it from the Lantern Designer and it depends on almost nothing app-specific.

### 9.1 What ports cleanly

The projection engine proper - `ClipKernel__`, `FlatBvh__`, `ClipWorker__`,
`WorkerPool__`, `Scheduler__`, `DiffHarness__`, `RasterPreview__`, `WebGpuBackend__`,
`SoupBuilder__`, `EdgeExtractor__`, `Projector__`, `CpuBackend__`, `ViewDefinition__`,
`AuthoredEdges__`, `ConfigAccess__` - is pure geometry over three r184 and
three-edge-projection. Console prefix and header only.

### 9.2 What needs adapting

| File | Adaptation |
|---|---|
| `Na__ProjectedLinework__StageSampler__.js` | Reads the **live model root**, helper flags, `InstancedMesh`, per-category exclusions, the transparency rule, cut clipping and section outline. TrueVision's model root and helper-flag conventions differ from ValeVision's - this is the one file that genuinely has to be re-read against TrueVision's `15__ModelLoader` and `26__System__ToggleModelElements`. |
| `Na__ProjectedLinework__ModelStage__.js` | Model fingerprint from TrueVision's model group state; must be invalidated by `Na__ReinitializeModelBoundSystems` on a model group switch |
| `Na__ProjectedLinework__Persistence__.js` | R2 asset per drawing via `Na__CfApi__WriteProjectAsset` (5.4) instead of the ValeVision worker route; IndexedDB layer unchanged; bake-before-save unchanged |
| `Na__ProjectedLinework__Pipeline__.js` | Triangle ceiling and the asset-before-compute order stay; the fingerprint source changes with `ModelStage__` |
| `Na__ProjectedLinework__SvgOverlay__.js` | Standalone SVG over TrueVision's canvas; per-frame transform must read TrueVision's ortho camera through `Na__DrawView__ActiveView__` |
| `Na__ProjectedLinework__ExportCompositor__.js` | Overlays onto TrueVision's `30__System__ImageExport` output |
| `Na__ProjectedLinework__DevMenu__Controls__.js` | TrueVision dev menu section |
| `Na__ProjectedLinework__AppConfig__.json`, `Styles__Main__.css` | NA keys and exclusion token list |

### 9.3 Integration edits

- `26/Na__UiFeature__ModelToggle__Controls.js` - raise a visibility event the sampler listens for.
- `30/Na__UiFeature__ImageExport__Controls.js` - composite the overlay into exports.
- `01/Na__AppFlow__LoadingSequence.js` - overlay sync in the render loop; invalidate the fingerprint on model group switch.
- `42/Na__FloorPlan__ModeController__.js`, `45/Na__Elevation__ModeController__.js` - `ApplyStyles` announces the change so the overlay re-keys.
- Both dev editors - bake before save.

### 9.4 Guard rails (carried from the ValeVision plan's risk table)

House-scale models are ten to fifty times a lantern. Keep, verbatim: baking on the
authoring machine, cut half-space and exclusions applied **before** sampling, the
triangle ceiling with a graceful fallback, worker pool at cores minus one, and timings
printed in the dev section. `SharedArrayBuffer` is not available (GH Pages cannot send
COOP/COEP), so R2 baking remains the real answer - do not design around it.

### 9.5 Hand-over test list

1. A floor plan shows exact hidden-line-removed linework over its raster, and the
   linework survives a reload from the R2 bake.
2. Hidden lines toggle on as a dashed class.
3. An excluded category disappears from the linework and nothing else changes.
4. A model group switch invalidates the fingerprint and re-bakes rather than showing
   the previous model's lines.
5. Timings for a real house-scale project are recorded in the DEVLOG entry.

---

## 10. Phase E - Layout Editor (target v2.23.0)

49 files, 16,205 lines. The largest phase, but the one with the fewest unknowns,
because it depends only on the drawing records and the projection pipeline, both landed
by then. Build it in the order below; each group is independently testable.

### 10.1 Shell, model and navigation

`TabStrip__`, `ModeController__`, `SheetModel__`, `SheetRecords__`, `ScaleManager__`,
`SheetLayout__`, `SheetSurface__`, `Navigation__`, `ConfigState__`, `AppConfig__.json`,
`Styles__Main__.css`, `Styles__Panels__.css`.

TrueVision notes: the tab strip mounts under `<header class="app-header">` and
publishes its height as a CSS custom property that the canvas, menus and carousel shift
by. The mode controller holds the render loop (`Na__RenderLoop__Pause`, landed in Phase
B) for the whole time a sheet is open and suspends 3D navigation and distance culling
the way a drawing does.

### 10.2 Viewports

`Viewport2d__`, `Viewport3d__`, `ViewportHandles__`, `SnapshotRenderer__`,
`MarkupBridge__`, `DimensionGeometry__`, `Assets__`, `RasterQuality__`, `Enhance__`.

TrueVision notes: the 2D underlay is rendered **through TrueVision's own drawing route**
(DIV-1) - flat render plus the profile-lines overlay quad - not through a composer.
`SnapshotRenderer__` therefore calls `Na__DrawView__RenderPreset__` rather than
`ComposerPreset__`, and must restore the profile-lines pass state afterwards. 3D
snapshots pose the main camera from the scene record through the tiled renderer and
restore pose, layer visibility and section cuts. Carry ValeVision's v2.21.11 fix from
the start: the stored snapshot record needs `Asset__PixelWidth`, or a picture baked at
a lower raster level is reused forever and prints blurred.

Carry the v2.21.2 render-trigger rules verbatim: a viewport re-renders only when its
key changes (scene, drawing, pan, frame or crop, scale, style toggles), never during a
drag, and 320 ms (2D) or 400 ms (3D) after the last change; the model fingerprint is
computed once per editor session; the 3D key ignores layer visibility.

### 10.3 Tools, panels and chrome

`SheetTools__`, `TextTool__`, `DimensionTool__`, `ShapeTool__`, `ShapeGeometry__`,
`Grips__`, `Snapping__`, `AxisLock__`, `Controls__Pc__`, `Controls__TouchScreen__`,
`KeyMappings__.json`, `ContextMenu__`, `History__`, `AutoSave__`, `Toolbar__`,
`PanelHost__`, `Panel__Sheet__`, `Panel__Layers__`, `Panel__ViewportSettings__`,
`Panel__Text__`, `Panel__Dimensions__`, `Panel__Styles__`, `Panel__Shapes__`,
`SheetChrome__`, `TitleBlock__Modern__`.

`TitleBlock__Classic__.js` is **not ported** (TD04). `TitleBlock__Modern__` is re-authored
with Noble Architecture branding and NA field rows rather than copied. The
`TitleBlock__Style` field stays on the sheet record and the style select stays in the
Sheet panel with one option, so adding Classic later is additive rather than a schema
change.

These port essentially verbatim. `Panel__Styles__` is the "Render Composites" section
as of v2.21.12: Base Image, Projected Linework, Profile Linework Effect, Glass
Transparency Off, Whitecard, Enhance Whitecard, Hidden Lines, Context Layer.

Note carried from ValeVision v2.21.12: the Whitecard toggle only does anything under
MaxEngine. TrueVision's default engine should be checked and the toggle labelled or
hidden accordingly rather than shipping a control that silently does nothing.

### 10.4 Export and dev controls

`PdfExporter__` (jsPDF UMD already vendored at
`90__System__PageLayoutSystem/01__Dependencies__VersionLocked/jspdf.umd.js`, injected
as a classic script on first use), `DevMenu__Controls__`.

Filename convention: `Na__{ProjectCode}__{SheetName}__{PaperSize}.pdf`.

### 10.5 Hand-over test list

ValeVision's section 11.6 list, items 1 to 9, run verbatim against TrueVision, plus:

10. The PDF opens at true paper size with selectable text and vector linework; printed
    at 100 percent a 1:50 viewport measures true with a ruler.
11. A web viewer (non-authoring origin) sees the tabs, can pan and zoom and can
    download the PDF, and has no editing affordance anywhere.

---

## 11. Phase F - Windows PWA packaging (target v2.24.0)

Implements TD01.

| Item | Work |
|---|---|
| Authoring gate | New `03__AppUtils/Na__AppUtils__DevGate__.js` (~60 lines): `Na__DevGate__IsAuthoringEnabled()` returns true for localhost **or** a persisted unlock flag. Every existing `hostname === 'localhost'` test in the dev menu, scene editor, drawing panels and Layout Editor routes through it. Grep first - there are more of these than expected, and one missed test is a dev control that never appears in the installed app. |
| Unlock surface | How the flag is set is a small UI decision, not an architectural one: a keyed URL parameter that persists to `localStorage`, or a hidden item in the existing dev menu. Decide when building; either is ~20 lines and neither changes anything else. |
| Manifest | `TrueVision__Pwa__Manifest__Builder__.js` gains a Layout Editor launch mode so an installed icon can open straight onto a sheet (`start_url` with a `?sheet=` parameter), and `display: 'standalone'` stays |
| Service worker | Vendor cache bucket now catches same-origin `04__Lib__ThirdParty__VersionLocked/**` (it currently expects esm.sh). Shell precache list gains the Layout Editor modules and stylesheets. Bump `PWA_SW_VERSION_TOKEN`. |
| Offline behaviour | Decide and document what an installed app does with no network: the shell and libraries come from cache; project data and GLBs are network-first with grace; baked linework is cache-first. A sheet already opened should stay openable. |
| Windows install test | Install from Edge and from Chrome; confirm the icon, the window chrome, the title, that the Layout Editor opens, that a PDF downloads, and that a save reaches R2. |

### 11.1 Open design note

An installed PWA writing to R2 needs the worker reachable and the project context in
the URL. If the app is installed per-project (as the manifest builder already does with
`start_url`), that context survives. If a single generic install is wanted, a project
picker on launch is needed - that is a separate small feature, and worth raising
before Phase F rather than during it.

---

## 12. Progress ledger

Update this every session. `-` not started, `~` in progress, `x` done and tested.

| Phase | Item | State | Version | Notes |
|---|---|---|---|---|
| - | Survey of both trees | x | - | 10-Sep-2026, this document |
| - | Decisions TD01-TD05 agreed | x | - | 10-Sep-2026, section 3 |
| A | Vendor the four libraries | x | 2.20.0 | 598 files; index JSON + README authored |
| A | `.gitignore` negations verified | x | 2.20.0 | THREE `build/` dirs, not one; `git add --dry-run` stages 598/598 |
| A | Import map switched | x | 2.20.0 | 11 entries; `THREE.REVISION` reads 184 at runtime |
| A | Module graph verification harness | x | 2.20.0 | `Na__Verify__ModuleGraph__.mjs`; two-pass; proven by deliberate break |
| A | r184 touch points re-verified (6.3) | x | 2.20.0 | Static surface + live PS01 render |
| A | RGBELoader → HDRLoader | x | 2.20.0 | Deprecated upstream at r180; pure rename |
| A | Service worker retargeted + precache | x | 2.20.0 | Path-based vendor test, runs first; token `2026-09-10-1` |
| A | Drawing profile lines on r184 | x | 2.20.0 | Harness passes; GL error 0; verified by pixel count |
| A | **Live-project pass (PS01)** | x | 2.20.0 | 12 categories, mesh + linework, renders correctly - see 12.1 for the URL |
| A | Offline boot test | - | 2.20.0 | Acceptance test for the PWA; do with Phase F |
| A | Image export / Video Studio / section-cut pass | - | 2.20.0 | Not exercised yet; low risk, worth a look before Phase D |
| B | `ProjectData__` (owner + one writer) | x | 2.21.0 | Migration proven on live PS01 |
| B | `ConfigState__`, `StyleRows__`, `RowAccordion__` | x | 2.21.0 | verbatim |
| B | `Transitions__`, `MaterialPreset__` | x | 2.21.0 | adapted - no engine split, toolbar API differs |
| B | `AppConfig__.json`, `Styles__DevMenu__.css` | x | 2.21.0 | |
| B | `SectionAdapter__` (thin, DIV-2) | - | 2.21.0 | ~150 lines over `Na__SectionCut__*` |
| B | `RenderPreset__` (DIV-1) | - | 2.21.0 | ValeVision's interface over the overlay route |
| B | `RenameDrawing__` | - | 2.21.0 | **THREE** holders here, not ValeVision's four - no section binding to re-key |
| B | `MarkupFocus__` relocated | - | 2.21.0 | `42/Na__FloorPlan__MarkupFocus__.js` → `40/Na__DrawView__MarkupFocus__.js` |
| B | `Na__CfApi__WriteProjectAsset` | - | 2.21.0 | ~120 lines over the existing /r2/write |
| B | Repoint 42 and 45 data modules at `Na__DrawData__*` | - | 2.21.0 | Delete the two `SyncSceneName` helpers outright |
| B | `Na__DevSavedKeys` gains the block key | - | 2.21.0 | **First.** See 3.1 |
| B | DIV-3 migration, proved against PS01 | - | 2.21.0 | Read R2, not the repo file |
| B | Render loop pause/resume | - | 2.21.0 | Landed early for Phase E |
| C | Scene editor splits + confirm dialog | - | 2.21.x | |
| C | Ground Floor Plan + style rows | - | 2.21.x | |
| C | Dimension splits | - | 2.21.x | |
| C | FacePick + GizmoGrip | - | 2.21.x | |
| C | Sections filed by type | - | 2.21.x | |
| D | Projection engine (15 verbatim files) | - | 2.22.0 | |
| D | 8 adapted files | - | 2.22.0 | `StageSampler__` is the real work |
| D | Integration edits (5 files) | - | 2.22.0 | |
| D | House-scale timings recorded | - | 2.22.0 | |
| E | Shell, model, navigation (12 files) | - | 2.23.0 | |
| E | Viewports (9 files) | - | 2.23.0 | |
| E | Tools, panels, chrome (25 files) | - | 2.23.0 | |
| E | PDF export + dev controls | - | 2.23.0 | |
| F | Authoring gate | - | 2.24.0 | Depends on Q1 |
| F | Manifest + service worker | - | 2.24.0 | |
| F | Windows install test | - | 2.24.0 | |
| - | Parity ledger updated | - | - | Each phase closes rows in the Pending back-port table |

### 12.1 How to actually run a real project on localhost

**There is no `/api` problem.** An earlier note here said localhost could not load a
project because `Na__AppUtils__FetchProjectJson` hits `${origin}/api/projects/...`.
That is the LEGACY Whitecardopedia path and TrueVision does not use it. The live path is
`Na__AppUtils__FetchTrueVisionProjectData`, which on localhost reads the repository copy
at `/na-project-portal/{year}-Projects/{folder}/30__TrueVision__AppContent/TrueVision__ProjectData__.json`
and then overlays the `Na__DevSavedKeys` from R2. Both halves work offline of any API.

The real trap is the URL. `Na__AppFlow__LoadingSequence.js:618` gates the whole project
path on `if (projectCode && projectFolder)` - **both** parameters, not one:

```
http://127.0.0.1:8433/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26
```

Drop `?project=` and the app silently falls through to a default document that points at
ValeVision's Clough GLBs, loads zero model categories, and looks exactly like a broken
build. It is not broken; the URL is short.

Two further notes for anyone verifying in a headless or hidden browser pane:

- **`requestAnimationFrame` does not fire while the pane is hidden**, so the render loop
  never starts and the loading overlay never clears. Shim it
  (`window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`)
  in the same batch as the navigation, before the app boots, and emulate an explicit
  viewport first or the canvas is created at 0x0.
- **Do not sample the WebGL canvas with `drawImage` to check whether it rendered.** The
  renderer runs without `preserveDrawingBuffer`, so a read outside the render call
  returns a cleared buffer and reports a perfectly good frame as one flat colour. Take a
  screenshot, which composites the real framebuffer. The synthetic harness is different -
  it reads inside its own controlled render, which is why the pixel counts there are
  trustworthy.

With the correct URL, PS01 loads all 12 model categories (mesh and linework GLBs) from
the CDN and renders correctly on r184.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| r184 regressions in TrueVision's custom shaders, especially the drawing profile-lines overlay quad which has no ValeVision equivalent to compare against | Phase A checklist against pre-upgrade screenshots; the existing `Na__Test__DrawingProfileLines__.html` harness in `80__Testing__PrototypeEnvironment` re-run first |
| Vendored `build/` folder silently untracked by `.gitignore` | Explicit negations plus a `git check-ignore -v` gate before the Phase A commit |
| GH Pages deploy fails at 1 GB despite the prune step | Check the Actions run after every push, not just the push |
| Stale service worker serving the old module graph to installed PWAs | Bump `PWA_SW_VERSION_TOKEN` in every phase that touches shell JS, CSS or the import map |
| DIV-1 divergence quietly widening as the Layout Editor evolves | `RenderPreset__` presents ValeVision's exact interface; anything that reaches past it into the render route is a ledger entry, not a quiet edit |
| The DIV-3 migration losing authored drawings | Legacy keys survive until the first successful save; both-blocks state warns loudly; proved against PS01 read from R2 (TD03) |
| The migration reading the stale repo base file and writing an empty block over PS01's live drawings | Section 3.1. `Na__DevSavedKeys` lands first; the migration runs after the R2 overlay resolves and is idempotent; the repo file is never hand-edited |
| Projection cost on house-scale models | Bake on the authoring machine; exclusions and cut half-space before sampling; triangle ceiling with graceful fallback |
| Two apps drifting again after this work | The parity ledger is updated from both sides; every ported file carries a PORT NOTE naming its counterpart |
