# TrueVision 3D - ValeVision Re-Alignment: Drawing Systems, Projected Linework, Layout Editor

**Status**: PHASES A, B, D, E, F LANDED (11-Sep-2026). Phase C partially done - remaining items listed in section 12.
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

Out of scope: the legacy `90__System__PageLayoutSystem` browser tab (it stayed until
the Layout Editor superseded it, then it was retired in a separate pass - done
12-Sep-2026, see TD02), any SketchUp plugin change, and any change to ValeVision
beyond ledger updates.

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

#### DIV-2 - The section engine — **REVISED 10-Sep-2026, see TD06**

~~TrueVision gets a thin adapter and no section data block.~~ **Superseded.** The
original reading was factually right about today's TrueVision and wrong about where it
should end up. Read TD06 below; the rest of this entry is kept only to explain what the
two engines actually are.

ValeVision's `42/Na__DrawView__SectionAdapter__.js` wraps the **live Cross Sections user
tool** (`41__System__CrossSectionView`, 3,655 lines across 7 modules), snapshotting and
restoring the user's own section state around a drawing (D07).

TrueVision's `41__System__SectionCutEngine` (1,892 lines across 4 modules) is a
purpose-built clipping engine with no user tool, **no serialization, and no persistence
of any kind** - verified 10-Sep-2026: there is no `Serialize`/`Apply` pair and no
project-data block. A TrueVision section exists only for as long as the page is open.

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
| **TD02** | **`90__System__PageLayoutSystem` stayed through this work, and was retired after it.** It is the source of the vendored jsPDF UMD the exporter injects, so it could not go during the port. Retired 12-Sep-2026: the "Create Drawing" button, its handler in `Na__UiFeature__ImageExport__Controls.js`, the dead `--secondary` button CSS, and all eight page-layout source files are gone. `jspdf.umd.js` and `PageLayoutSystem__TitleBlock__A3__.png` remain in the folder because the Layout Editor config points at both by path; see that folder's README. |
| **TD03** | **`PS01__MustersRoad` is the migration reference project.** It carries a basic plan and elevation set. Year folder `26-Projects`, R2 key `NaProjectPortal/26-Projects/PS01__MustersRoad/30__TrueVision__AppContent/TrueVision__ProjectData__.json`, worker `https://na-truevision-api.adam-fb3.workers.dev`. See 3.1 for why this cannot be tested against the repo copy. |
| **TD04** | **Modern title block only, Noble Architecture branding.** Vector primitives rendered to SVG and PDF from one list: NA logo, then the field rows (client, site address, drawing number, revision, scale, issue date, drawn by). `TitleBlock__Classic__.js` is **not ported** - the only scan that exists is Vale's, and a Vale title block on an NA drawing is a live-output hazard. Classic is added if and when an NA scan exists; the `TitleBlock__Style` field stays in the record so adding it later is additive. |
| **TD05** | **Client measuring stays and stays aligned.** TrueVision already has `44/Na__PlanDimensions__ClientMode__.js`; it is kept in step with ValeVision's, which costs nothing. |
| **TD06** | **Section data is recorded in ValeVision's structure, exactly.** Added 10-Sep-2026 at Adam's direction, superseding the original DIV-2 reading. TrueVision gains a `CrossSection__SceneData` block byte-compatible with ValeVision's, a `Serialize`/`Apply` pair over `Na__SectionCut__*`, and per-scene capture and restore. See 3.2. |

### 3.2 Section data recording (TD06)

**The problem this fixes.** TrueVision's section engine has no serialization and no
persistence. A cut exists only while the page is open. That is survivable for a live
3D toggle and fatal for drawings: a section drawing cannot reopen with its own cut, a
sheet viewport has nothing to restore, and the PDF prints an uncut model. ValeVision
solved this in July 2026 and its tool is the more built-out of the two.

**The contract.** TrueVision writes ValeVision's schema verbatim, so a project document
from either app is readable by the other:

```jsonc
"CrossSection__SceneData": {
    "CrossSection__SceneData__Description" : "...",
    "CrossSection__SceneData__Version"     : 1,
    "CrossSection__SceneData__Scenes"      : {
        "<scene NAME>": {                        // keyed by name: stable across a SketchUp re-sync
            "gizmosVisible" : true,
            "sliceDepthM"   : null,              // GLOBAL, metres, null = infinite (no back plane)
            "fillColor"     : "#505050",
            "lineColor"     : "#505050",
            "lineWidthPx"   : 2,
            "sections": [{
                "name"         : "DrawingCut__FloorPlan_001",
                "mode"         : "PLAN",         // "PLAN" | "UPRIGHT"
                "normalXyz"    : [0, -1, 0],     // rounded to 6 dp
                "positionMm"   : 1200,           // -plane.constant in mm, 2 dp
                "enabled"      : true,
                "gizmoVisible" : false
            }]
        }
    }
}
```

**Slice depth: ValeVision's shape wins, and TrueVision flattens to it.** ValeVision holds
slice depth as a **single global** `sliceDepthM`; TrueVision holds it **per plane** as
`depthUnits`. Settled 10-Sep-2026: write the global field and nothing else. A TrueVision
project whose planes carry different depths collapses to the first plane's depth on
capture, and every plane takes that depth on restore.

No additive field, no superset. The schema is ValeVision's, exactly, because two apps
that are ninety-five percent the same shape are worse than useless - the differences are
where the bugs live, and every extra key is a thing the other app will one day be
expected to honour. TrueVision is early enough in its drawing life that flattening costs
nothing real.

**Field mapping**, TrueVision engine to ValeVision schema:

| ValeVision field | TrueVision source |
|---|---|
| `name` | plane record `id` |
| `mode` | derived: normal with a dominant Y component is `PLAN`, otherwise `UPRIGHT` |
| `normalXyz` | `record.plane.normal`, rounded to 6 dp |
| `positionMm` | `-record.plane.constant` converted to mm, 2 dp |
| `enabled` | `record.enabled` |
| `gizmoVisible` | TrueVision draws no gizmo - written `false`, honoured on read |
| `fillColor`, `lineColor`, `lineWidthPx` | `Na__SectionCut__GetAppearance()` |
| *(no per-plane depth)* | `record.depthUnits` collapses into the global `sliceDepthM` |

**Work this adds to Phase B:**

| File | Notes |
|---|---|
| `41/Na__SectionCut__Serialize__.js` | The `Serialize`/`Apply` pair, in the shape above. New - no TrueVision counterpart |
| `41/Na__SectionCut__SceneData__.js` | The block, keyed by scene name; capture on scene update, restore on `na-pm-scene-activated`, skip on a drawing approach scene. Ported from ValeVision's 503-line `Na__CrossSectionView__SceneData.js` |
| `40/Na__DrawView__ProjectData__.js` (edit) | Save carries the block as a **third** merged key |
| `40/Na__DrawView__RenameDrawing__.js` | **FOUR** holders after all, not three - the section binding is keyed by scene name and a rename orphans it. Reverts the note added earlier today |

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
  **DONE 12-Sep-2026, and it was only half done before that.** The new file was
  created in Phase B but nothing was repointed at it, so it sat as dead code while
  the annotations editor, hotkeys and toolbar and the dimensions editor and hotkeys
  all kept importing the old one. Two arbiters, each with its own module-level answer
  to "who owns the keyboard". Both export the same thirteen names, so the repoint was
  mechanical; the old file is deleted.
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
| - | Survey of both trees | x | - | 10-Sep-2026 |
| - | Decisions TD01-TD06 agreed | x | - | Section 3 |
| **A** | **Version-locked libraries (r184 set)** | **x** | 2.20.0 | Live on www.noble-architecture.com; THREE.REVISION reads 184 |
| A | `.gitignore` negations | x | 2.20.0 | THREE `build/` dirs; 598/598 stage; verified live |
| A | Module graph + export harnesses | x | 2.20.0 | Both prove themselves by deliberate break |
| A | RGBELoader → HDRLoader | x | 2.20.0 | |
| A | Service worker retargeted + precache | x | 2.20.0 | |
| **B** | **Drawing core re-alignment** | **x** | 2.21.0 | 15 files in `40__System__DrawingViewCore` |
| B | `ProjectData__` + migration | x | 2.21.0 | **Completed on live PS01**: 1 plan, 1 elevation, client-dims flag; legacy keys cleared |
| B | `ConfigState__`, `StyleRows__`, `RowAccordion__` | x | 2.21.0 | verbatim |
| B | `Transitions__`, `MaterialPreset__` | x | 2.21.0 | adapted |
| B | `SectionAdapter__` (DIV-2) | x | 2.21.0 | Pass-through; Suspend/Release documented no-ops |
| B | `RenderPreset__` (DIV-1) | x | 2.21.0 | ValeVision's 8 exports over the overlay route |
| B | `RenameDrawing__`, `MarkupFocus__` | x | 2.21.0 | Four holders; sheet re-stamp lazily imported |
| B | `MarkupFocus__` actually WIRED (7.2 relocation) | x | 2.24.1 | The ported arbiter was dead code until 12-Sep: all five callers still imported `42/Na__FloorPlan__MarkupFocus__` under `Na__FpFocus__`, so TrueVision ran two arbiters. Callers repointed, old file deleted |
| B | `Na__CfApi__WriteProjectAsset` + `R2AssetUpload__` | x | 2.21.0 | No worker deploy needed |
| B | 42/45 data modules repointed | x | 2.21.0 | Incl. stale `sceneConfig` guards and the client-dims flag |
| **TD06** | **Section data in ValeVision's schema** | **x** | 2.21.0 | `Serialize__` + `SceneData__`; round-trip test caught a sign error |
| **C** | Styles, exclusions, linework asset on both records | x | 2.21.0 | ValeVision key names exactly |
| C | Confirm dialog, dimension config + preview splits | x | 2.21.0 | |
| C | Ground Floor Plan quick action | - | 2.21.x | Not yet ported |
| C | FacePick + GizmoGrip | - | 2.21.x | Not yet ported |
| C | Scene editor splits (RowBuilders, Reorder) | - | 2.21.x | Not yet ported |
| C | Sections filed by drawing type | - | 2.21.x | Not yet ported |
| **D** | **Projected linework** | **x** | 2.22.0 | 24 files; 6 gaps, all real missing pieces |
| D | House-scale timings recorded | - | 2.22.0 | Not measured yet |
| **E** | **Layout Editor** | **x** | 2.23.0 | 49 files; tabs, sheets, viewports at scale, panels, PDF |
| E | Verified on PS01 | x | 2.23.0 | Underlay bakes, scene markup draws at scale |
| E | NA branding + logo aspect | x | 2.23.0 | Vale mark replaced; aspect re-measured 4.096 |
| **F** | **Authoring gate (TD01)** | **x** | 2.24.0 | 11 surfaces routed; URL + console unlock |
| F | Manifest Layout Editor launch mode | - | 2.24.0 | Not yet done |
| F | Windows install + offline boot test | - | 2.24.0 | Needs a person at the machine |
| **G** | **Projection backend chosen from hardware** | **x** | 2.24.0 | `auto` default; WebGPU probe rejects software fallback adapters; anything with a drawing CUT stays on the CPU because the GPU backend cannot apply one |
| G | Dev menu reports the resolved backend | x | 2.24.0 | Per drawing, because `auto` is one answer per view |
| **H** | **Dev Tools menu moved into the top bar** | **x** | 2.24.0 | Trigger beside the logo; flyout drops only when pressed, clearing the tab strip; the drag handle sizes the panel, not the header flex item |
| **I** | **Supersampled anti-aliasing (new module)** | **x** | 2.25.0 | `05__RenderPipeline/Na__RenderEffect__Supersampler__.js`. D3D N-rooks patterns, re-centred; jitter premultiplied into the projection so the Sobel and the cut outlines get it too, not just geometry. Verified in-browser: 1 sample -> 2 grey levels, 4 -> 5, 16 -> 17 on a 2-degree line |
| I | Tiled exporter rebuilt on ValeVision's design | x | 2.25.0 | Shared `TilePlan__` + `AsyncYield__` ported; gutter overscan, canvas probe, context-loss guard. Always tiles now, so the gutter applies even to a one-tile image |
| I | **Profile-line buffers resized per tile** | **x** | 2.25.0 | They never were. The drawing Sobel ran at viewport resolution and was stretched across the sheet - most of the blur on 2D underlays was this, not aliasing. BOTH owners resized (`setProfileLinesSize` for the shared pair, `DrawProfile__HandleResize` for its own) and restored |
| I | **3D snapshot routed through the composer** | **x** | 2.25.0 | The tiled renderer took `getRenderPipelineState` for signature parity and ignored it, so every sheet's 3D base image was a bare `renderer.render`: no profile lines, no AO, no fog, wrong colour transfer - while `Render3d` toggled a pass that never ran. DIV-1 is unaffected: a 2D drawing still passes `renderFrame` and that still wins |
| I | Overlays honour the bound render target | x | 2.25.0 | `Na__DrawProfile__RenderOverlay` and `Na__SectMesh__RenderOverlay` both hard-coded `setRenderTarget(null)`. On screen that is a no-op; during a supersampled bake it inked onto a buffer nobody averages |
| I | sRGB transfer on the target route | x | 2.25.0 | Three applies the output transfer only to the canvas, never to a render target, so a diverted drawing frame comes back linear. Present pass encodes for that route only. Verified byte-identical to the canvas route at 1 sample, swatch by swatch |
| I | Still exporter no longer resizes the composer | x | 2.25.0 | Was 25 MP of half-float ping-pong at 4096 and a silent blank PNG on context loss; now tiles, and throws a message the overlay shows. `RenderToDataUrl` is async; both handlers catch so a failure cannot leave the button locked |
| I | Sample counts are config, per quality level | x | 2.25.0 | Layout Editor Low 1 / Medium 4 / High 16 (High is also the PDF and bake level); image export 16. `Na__LeRaster__Fit` carries the count with the size |
| I | Live viewport left alone | - | 2.25.0 | Deliberate: 16x per frame is 60 fps -> under 4. Progressive refinement in the idle time after the camera stops is the real opportunity and a separate job |
| I | Tested by Adam | x | 2.25.0 | Signed off 12-Sep-2026 |
| **R** | **Return trip: TrueVision -> ValeVision** | **x** | VV 2.22.0/2.22.1 | Glass transmission, viewport style override, Context Layer, backend auto + probe, DevGate, both harnesses, the header dev menu. See ValeVision's parity ledger for the deliberate non-ports |
| R | Supersampler + tiled exporter back-port | x | VV 2.23.0 | Shared module promoted to `05__RenderPipeline`; ValeVision's video-studio file is now an alias re-export of it (verified same function object). Per-tile supersampling in its static exporter, and the sample count per raster level. The two faults TrueVision had - the un-resized Sobel buffers and the ignored pipeline getter - were CHECKED for and are absent there; Export Render Layers is deliberately excluded. See ValeVision's return-trip table |
| R | Render Composites panel column | x | VV 2.22.1 | The 12-Sep move to the LEFT column had not come back; ValeVision's file header said left while its code said right |
| **J** | **Eyedropper - match properties between two items** | **x** | 2.26.0 | Authored in TrueVision first, not ported in. `Na__LayoutEditor__Eyedropper__.js` (`Na__LeDrop__`) owns a trait table, the pick/paint state machine and the highlight boxes; the sheet tools own the tool slot, the pointer and the B key. Text, dimensions and vectors. Style travels, content, geometry and the layer do not |
| J | First test: vectors never redrew | x | 2.26.1 | `shape`/`shapes` were missing from the mode controller's markup route, so a painted or deleted vector kept its old picture until an unrelated repaint. The eyedropper was working; the sheet was not redrawing. **ValeVision has the same gap** |
| J | Click path cleared | x | 2.26.1 | Browser draft debounced (was a synchronous localStorage write of every sheet inside each change); surface refresh coalesced per animation frame; tab strip rebuilds only when a tab would change; item changes refresh only their own panel. Undo granularity unchanged |
| J | Sheet vectors and dimensions as snap candidates | x | 2.26.1 | Vertices, edge midpoints, dimension ends. Moving items exclude their own points; the draft excludes only its newest vertex, so polygons close exactly. 0.09 ms per move at 4,000 vertices |
| J | Tested by Adam | x | 2.26.1 | Signed off 13-Sep-2026 |
| J | Eyedropper back-port to ValeVision | x | VV 2.24.0 | Ported with every 2.26.1 fix by REPLAYING this session's edits against ValeVision's code, which is identical to this repo's last commit in each touched file. Not copied: this tree's working files carry other sessions' unsigned rectangle, clipboard and viewport snap-move work that ValeVision cannot import. One adaptation: the tab strip signature carries `Na__LeMode__IsAvailable` (Layout Mode). Verified there: 49 modules parse, every named import resolves, eyedropper 52 and snapping 29 checks. See ValeVision's 13-Sep return-trip table |
| **K** | **Rectangle tool (R) - corner to corner, then an ordinary polygon** | **x** | 2.27.0 | Authored in TrueVision first, not ported in. `Na__LayoutEditor__RectangleTool__.js` (`Na__LeRect__`): click then click, or press, drag and release; Shift keeps it square; both corners snap. The preview is a rubber box on the handles layer (`Na__LeGrips__ShowBox`), so nothing reaches the model until the second corner lands; the result is a plain closed four-point `Sheet__Shapes` record through `CreateShape`, one undo step, selected on landing. No new record field, so grips, the Vectors panel, the eyedropper and the PDF treat it as any polygon |
| K | Verified | x | 2.27.0 | Harness against stubs: 41 checks. In the app on PS01's A2 sheet with real pointer and key events: 20 checks (R binding, both drawing modes, Shift square, Escape and right-click abandon, arrows swallowed mid-draw, one undo step per rectangle, the Select tool drags a single corner). R2 writes blocked for the run |
| K | Tested by Adam | x | 2.27.0 | Signed off 13-Sep-2026 |
| K | Rectangle back-port to ValeVision | x | VV 2.25.0 | Ported the same day, the wiring replayed edit by edit onto ValeVision's tree - which had just taken the eyedropper port, so every anchor matched TrueVision's. Module verbatim, header only. Verified there: the harness (41 checks) against the ValeVision copy and the same 20 in-app checks on a scratch A3 sheet, every write blocked |
| **L** | **Viewport copy, paste and duplicate** | **x** | 2.28.0 | Authored in TrueVision first. `Na__LayoutEditor__ViewportClipboard__.js` (`Na__LeClip__`). Ctrl+C / Ctrl+V / Ctrl+D and the context menu. A paste is the whole record with a fresh id (`Na__LeModel__InsertViewport`), a "{name} copy" name and a fanned-out position; arrives unlocked; the 3D snapshot reference is kept; the copy name clears when the copy's scene changes. One undo step. No new record field |
| L | Viewports move by a linework point | x | 2.28.0 | `Na__LayoutEditor__ViewportSnapMove__.js` (`Na__LeVpMove__`). Hover marks the grab point; the carry snaps onto other viewports (`Na__LeOsnap__FindOnViewport`, a viewport exclusion in `Find`); dwell-acquired tracking points give level and plumb guides; Shift holds the axis; the carried frame multiplies. Handles, content editing and locks win over it |
| L | Ctrl chords reach the sheet from a focused select or checkbox | x | 2.28.0 | Ctrl+Z straight after choosing a scene in the Viewport panel was swallowed. Text fields still keep every key |
| L | Verified | x | 2.28.0 | In the app on PS01's PD Drawing sheet with pointer and key events, R2 writes blocked: paste field-for-field match, undo/redo, duplicate naming, menu paste at the click, the scene hand-back, Ctrl+Z from the select, exact point landing, exact level tracking, Shift, snapping off, Escape. Sheet restored to its loaded state |
| L | Tested by Adam | - | 2.28.0 | Awaiting sign-off before the ValeVision port |
| L | Clipboard and snap move back-port to ValeVision | - | - | Pending Adam's sign-off. Two new modules plus: `InsertViewport` in the sheet model; `FindOnViewport`, `SearchViewport` and the viewport exclusion in snapping (ValeVision lacks the sheet-object snapping of J, which this sits beside but does not need); the sheet tools wiring (hover, DragFor, ApplyDrag, FinishDrag, CancelPlacement, Escape, keys, menu, the focus rule); the panel's scene hand-back; key map + fallback; Clipboard config block + getter; the snapping keys; labels; stylesheet |
| **M** | **Gradient fill for vectors - start and end colour, alpha, blend, direction** | **x** | 2.29.0 | Authored in TrueVision first. `Na__LayoutEditor__GradientTool__.js` (`Na__LeGrad__`) with its own config JSON, the way the edge styles and composites carry theirs. New shape key `Shape__Gradient` (null, or six `Gradient__` fields). A gradient replaces the solid fill and counts as the fill for the either-or rule; its sliders are silent mid-drag and one undo step on release. PDF: a PNG strip with a soft mask, rotated by jsPDF and clipped to the outline - jsPDF 4.1.0's RGBA image path drops alpha |
| M | Verified | x | 2.29.0 | 19 Node checks on the maths. In the app on PS01's PD Drawing sheet: toggle, either-or, alpha exclusivity, one history step per slider drag. A PDF through `Na__LeChrome__DrawToPdf` rendered with pdf.js against the SVG over a checkerboard: 11 samples within 2/255. Sheet restored and its draft cleared |
| M | Tested by Adam | x | 2.29.0 | Signed off 13-Sep-2026 ("it works well"). At sign-off the gradient rows moved last in the Vectors panel, after the fills and Closed |
| M | Gradient back-port to ValeVision | x | VV 2.26.0 | Replayed from commit `50d46de`, not from the working copies, which already carry an unsigned palette mode on top of the gradient. 35 hunks in 12 files: each anchor found once there, each body hunk found verbatim in `50d46de`; module and config verbatim bar header and console prefix. One adaptation: ValeVision's mode controller waits only on the editor and gradient configs. Verified there: module graph and named exports (309 files) pass; in the app on a scratch A3 sheet with writes blocked (order, defaults, rectangle, direction, edges off, one history step per drag, alpha on one end, SVG); PDF through its jsPDF path within 2/255 of the SVG at 11 points. See ValeVision's gradient return-trip table |
| M | Rectangle takes the gradient default | x | 2.29.x | Found by the port: `Na__LayoutEditor__RectangleTool__.js` passed the Vectors panel's fill but not its gradient, so a rectangle drawn with Gradient on had no fill. Fixed in both apps (1.0.1); verified in ValeVision with a press-drag-release rectangle. Uncommitted here |
| **N** | **Eyedropper palette (Shift+B) - an object's style becomes the settings for new objects** | **x** | 2.30.0 | Built on the eyedropper's trait table. `ToPalette` turns a style into the panel settings (fill and gradient carry `palette` switch names); `SyncPalette` hands it to a writer the sheet tools own (`AdoptStyle`); `DEFAULTS_EVENT` refreshes the panel. The selection clears and the drawing tool for the kind takes over (`PaletteSwitchesTool`). Also Shift+click on the Eyedropper button and Use for new ... on the context menu |
| N | Locked layers readable by the eyedropper | x | 2.30.0 | `Na__LeMarkup__HitTest` takes `includeLocked`; only the eyedropper passes it. A locked scrapbook is a source; a locked target is refused with a reason. Every other tool unchanged |
| N | Verified | x | 2.30.0 | Palette harness 53, eyedropper harness 52; undeclared-name scan clean. Live app, read-only: all modules load, Shift+B and B resolve through the live key map, live labels and settings |
| N | Tested by Adam | x | 2.30.0 | Signed off 13-Sep-2026 ("works perfectly") |
| N | Palette back-port to ValeVision | x | VV 2.27.0 | Replayed edit by edit; every anchor matched ValeVision's tree on the first dry run, which already carried the eyedropper, rectangle and gradient ports. Verified there: 51 modules parse, imports and names clean, palette 53 and eyedropper 52 checks against its copy, and a read-only live load confirming the key map, labels and settings. See ValeVision's return-trip table |
| **N** | **Undo and redo stop writing the project to R2** | **x** | 2.30.1 | Every Ctrl+Z / Ctrl+Y was announced through `UpdateSheet` as `sheet-updated`, which AutoSave reads as structural, so any undo saved the whole project 1.5 s later. History steps now keep their reason; a restore goes out through `Na__LeModel__AnnounceRestore` - still `sheet-updated` for every listener, plus `restore : { direction, stepReason }` in the detail - and AutoSave's `CallsForSave` judges it by its step. Content undo: browser draft only. Structural undo (name, paper, orientation, title block style, lineweights): saves, as the change did. Also: a selected vector survives an undo that keeps it |
| N | Verified | x | 2.30.1 | In the app on PS01's PD Drawing sheet, writes blocked and recorded: 11 checks. Vector add, undo, redo: 0 writes. Selection survives. Rename auto-saves; its undo, redo and undo each auto-save (4 writes). Every restore detail recorded. Sheet back to its loaded state, draft removed |
| N | Tested by Adam | - | 2.30.1 | |
| N | ValeVision has the same fault | - | - | Verbatim ports: its History still restores through `UpdateSheet(sheet, {})` and its AutoSave counts `sheet-updated` as structural. Port after Adam's sign-off: SheetModel `AnnounceRestore` and the restore detail, History step reasons and the shape selection case, AutoSave `CallsForSave`. Noted in ValeVision's parity ledger as pending |
| **O** | **Ortho dimensions - Shift makes a dimension horizontal or vertical** | **x** | 2.31.0 | Authored in TrueVision first. Hold Shift while the line is placed: dragged above or below the two points it runs horizontal and measures the x distance, beside them vertical and the y (the CAD linear-dimension box rule, `Na__LeDimGeo__OrthoToward`). New record field `Dimension__Orientation` ('aligned' / 'horizontal' / 'vertical'; older records normalise to aligned and draw as before). Each point runs its own extension line; the offset is still measured from the start; an ortho line stays put while a grip re-picks a point (`OffsetKeepingLine`). Shift no longer bends the span while the end is picked - the arrow-key lock still does. Shift down or up redraws at once |
| O | Snap marker tones by tool | x | 2.31.0 | `Na__LeOsnap__Snap` / `ShowMarker` take a tone: blue vertex (Draw, Rectangle, vertex grips - the default), orange dimension (the tool, its grips, its inference), purple viewport (hover and carry; the carry ring, tracking crosses and carried frame outline too). One RGB custom property per tone in the main stylesheet |
| O | Verified | x | 2.31.0 | Geometry harness, 30 checks: aligned skeleton, text placement and span bit-identical to HEAD over 80,000 cases; `Push` identical over 3,000 specs; ortho maths, box rule, regrips. 9 changed modules parse; 877 named imports resolve; undeclared-name scan clean. In the app on PS01's PD Drawing sheet with pointer and key events, every non-read request blocked (none attempted): 38 checks - placement, live Shift press and release, 40 / 45 / 60.208 values, inference onto a parallel ortho line, both grips (end across the start) with the line held, two undos, aligned placement unchanged, all three tones on one vertex and on a carried viewport. Test objects removed, draft cleared |
| O | Tested by Adam | x | 2.31.0 | Signed off 13-Sep-2026 ("works great") with the request to port |
| O | Ortho dimensions back-port to ValeVision | x | VV 2.29.0 | Ported the same day by an anchor-checked replay script: 32 anchors across 10 files, every one matched exactly once before anything was written; DimensionGeometry and DimensionTool verbatim below the header. Verified there: 8 modules parse, 812 imports resolve, name scan clean, geometry harness 30, and 23 in-app checks on a scratch A3 sheet with writes blocked. ValeVision has no `ViewportSnapMove__` yet, so the purple tone is ported ready and first shows with the carry |
| - | Parity ledger updated | x | - | Both directions recorded; ValeVision's ledger carries the return-trip table |
| **J** | **Per-category projected edge styles** | **x** | 2.27.0 | Signed off by Adam 13-Sep-2026 after the GPU fix, and ported to ValeVision the same day (VV 2.30.0). Colour, line type and weight per SketchUp category per viewport; composite layer weights; Advanced fold UI. See DEVLOG v2.27.0 |
| J | Owner tags through the CPU projection | x | 2.27.0 | New `Owners__` module. Extractor, cut split, view space, clip kernel, worker protocol, pool merge, sampler section crossings, authored walk. Tags ride NON-enumerable on the classes object so every existing consumer is untouched |
| J | Every kept render on the CPU | x | 2.27.0 | Adam's first test failed: `auto` sent plain elevations to WebGPU on his NVIDIA card and the vendored GPU generator cannot tag, so the styles did nothing. Second correctness rule beside the cut rule in `ResolveBackend`; only an explicit override (Run Diff, keeps nothing) may use the GPU. The bake had been rendering with `auto` as well |
| J | Asset schema 2; untagged is stale | x | 2.27.0 | Owner runs per class, key table in Meta. Untagged blocks refused on read, never written, never baked; an untagged in-memory result is a cache miss. A poisoned cache was planted in the app and healed on the next repaint |
| J | Configs | x | 2.27.0 | `EdgeStyles__Config__` (SSOT greys by alias, 7 line types in paper mm), `RenderComposites__Config__` (panel built from it), ModelLayers config 1.1.0 with per-category defaults. `Drawing2dEdgeWidth` removed from the main config; the bake width is the profileLinework composite weight, default 1.0 (corrected in 2.30.2 from 0.55) |
| **B** | **Drawing view config actually loaded** | **x** | 2.30.2 | `SetAppConfig` and `Load` were never ported from ValeVision's index.html, so `Na__DrawView__AppConfig__.json` and its main-config overrides were ignored from 2.21.0. Wired before the loading sequence, unawaited; the Layout Editor ready chain waits for Load. Node diff of every getter plus before/after in the app: nothing a preset reads changed, live plan/elevation readings identical, bakes byte-identical at 0.55 |
| J | Bake profile width back to 1.0 | x | 2.30.2 | Every bake before 2.27.0 drew at 1.0, the unwired fallback; 2.27.0's 0.55 would have thinned new underlays. The drawing view fallback is 0.55, the live views' width, so a bake no longer leaks a thicker outline into them |
| J | Verified in app on PS01 (CPU path) | x | 2.27.0 | Read-only load: tagged bands exact to the width maths, per-viewport overrides and independence, reset pruning, PDF bands identical to screen, Advanced fold folded and open. The GPU route itself needs Adam's machine - the verification pane has no adapter |
| J | Tested by Adam | x | 2.27.0 | Signed off 13-Sep-2026, with the request to port to ValeVision |
| R | ValeVision port of J | x | VV 2.30.0 | The Edge Styles half; the Render Composites weights crossed separately as VV 2.28.0 (another session). Folder 50 replayed hunk by hunk with every anchor unique (64 hunks, plus the Owners import and JoinOwners placed by hand), the kept-render CPU rule included. `Owners__`, `EdgeStyles__` and its config verbatim below the header; ModelLayers and Panel__ModelLayers replayed. The shared Layout Editor files (already carrying composites, ortho dimensions and gradients) took 22 anchored patch steps cut from this repo's committed code. The model layer config carries this repo's rows under the ValeVision__ prefix, plus the coarse categories older ValeVision exports load. In the app on Doous, read-only: every segment tagged, bands exact to the width maths, a restyle repaints without re-projecting, a reset prunes the record to null. See ValeVision DEVLOG v2.30.0 |
| **P** | **Model Source - a viewport draws a chosen design phase** | **x** | 2.32.0 | Authored in TrueVision first. `Na__ModelGroup__PhaseLibrary__` (26) registers every model group, the Project Default and the live phase, and loads other phases into detached roots; `Na__LayoutEditor__ModelSource__` resolves a viewport's `Viewport__ModelSourceId` (null = Project Default = the phase the startup load picks). The snapshot renderer swaps a phase root into the scene for one render (the live root leaves the scene; section engine, material preset, category registry and profile caches follow it); the linework pipeline takes an optional model root. Viewport panel row, Add Viewport row, right-click Model items |
| P | Stale Layout Editor keys after a Design Phase switch | x | 2.32.0 | Nothing reset the editor's fingerprints on a switch, so a sheet redrew another phase under the old keys; the library's live event now resets them. The Design Phase menu also gains the materials library pass and a correct active button |
| P | Verified | x | 2.32.0 | 19 modules parse; module graph (340) and named exports (253) pass. In the app on PS01's PD Drawing sheet, writes blocked: live path unchanged; an existing-building copy of an elevation renders off-scene in 4 s with the live root, its scene slot and the registry untouched; Model menu switch and undo; Model Layers per phase; PDF linework per phase; a 3D viewport; the 3D view on the existing building leaves Project Default viewports on Scheme-01; one phase's off-scene and live fingerprints identical. Test objects removed, draft cleared |
| P | Tested by Adam | - | 2.32.0 | |
| P | ValeVision port | - | - | ValeVision has no model groups yet; ask at sign-off as usual |
| **Q** | **Drawing Layers: a grip to reorder, Lock / Unlock** | **x** | 2.33.0 | Authored in TrueVision first. `Na__LayoutEditor__Panel__Layers__` 1.1.0: a six-square grip replaces the Up and Down buttons and the whole-row HTML drag and drop. A pointer drag - the row follows, the rows it passes slide aside, and one `ReorderLayer` lands on release (one undo step). A row takes a place once its leading edge passes that row's middle, so both ends are reachable; Escape or pointer-cancel abandons; a refresh mid-drag is held until the drop; the arrow keys on a focused grip step one row. The lock button reads Lock / Unlock (was Open / Locked), one width for both words, faint red while locked. No record field changed |
| Q | Verified | x | 2.33.0 | In the app on PS01's PD Drawing sheet, writes blocked: nine checks (a 2 px press is not a drag; Lock / Unlock with its tint and width; down one row, to the very bottom, to the very top; Escape; pointer-cancel; arrow keys keep focus; a refresh mid-drag). Layer order restored, draft cleared. Styling checked in a headless Chrome render at Adam's ~400 px panel width |
| Q | Tested by Adam | x | 2.33.0 | Signed off 13-Sep-2026 ("It works"), with the request to port. Uncommitted here |
| Q | Layers grip back-port to ValeVision | x | VV 2.31.0 | From the working copy, unchanged since the test. A script asserted ValeVision's Layers body and Layer Rows stylesheet region were byte-identical to this repo's committed originals, transplanted the tested body and region, and re-checked after writing; there the module is LF and the stylesheet CRLF, both kept. Verified there: module graph and named exports (312 files) pass, and the same nine checks on a scratch sheet with writes blocked gave the identical tint and 48 px width. See ValeVision's return-trip table |
| **T** | **Leaders & Annotation Bubbles - a note or a specification bubble on a sweeping leader** | **x** | 2.35.0 | Authored in TrueVision first. `Na__LayoutEditor__LeaderGeometry__.js` (`Na__LeLeadGeo__`: handing, the stub-sweep-stub curve, note and bubble heads, primitives, bounds, hit parts), `Na__LayoutEditor__LeaderTool__.js` (`Na__LeLeader__`: two clicks or a drag, the inline code or note field, the next bubble code), `Na__LayoutEditor__Panel__Leaders__.js`. Tool E, after Text. New sheet array `Sheet__Leaders` (22 `Leader__` fields, listed in DEVLOG v2.35.0) on the text layer; the reasons `leader` / `leaders` are content edits, never an auto save. The eyedropper gains a `paletteOnly` trait flag, so a leader's type goes to the palette but never paints |
| T | Vector fill and edge opacity | x | 2.35.0 | `Shape__FillOpacity`, `Shape__StrokeOpacity` (0 to 1, solid when absent): the Vectors panel's Fill opacity slider, and Transparent edges (off by default) with Edge opacity. The SheetChrome polyline primitive carries `DashMm`, `FillOpacity` and `StrokeOpacity`; the PDF draws inside a saved graphics state with jsPDF `GState`. Old-style primitives stay byte-identical to HEAD in SVG and in jsPDF calls |
| T | Verified | x | 2.35.0 | Node harness on the real modules against stubs: 83 checks. Module graph 345 modules, named exports 258 files. In the app on PS01's PD Drawing sheet (localhost:8463), every non-read request blocked and none attempted: placement with its live preview, handing both ways, the next code, the multi-line field, the abandon paths, tip / head / curve drags, nudge, Delete and undo, double-click, the menu, every panel control with one announcement per slider drag, the eyedropper, Shift+B, vector opacity, and a jsPDF render with its dash operators, `/ca 0.4`, `/CA 0.5` and every leader's text. Test objects removed, draft cleared. A headless Chrome render of the leaders checked against Adam's reference drawings |
| T | Built beside Box Select (S, 2.34.0) | x | 2.35.0 | Two sessions in the same Layout Editor files at once: the split agreed file by file over SendMessage, each side re-reading before every edit, one DEVLOG number each and one service worker token bump (`2026-09-14-1`). Box Select's selection set, box and group move include leaders |
| T | Tested by Adam | x | 2.35.0 | Signed off 14-Sep-2026 ("It seems to be working to me"). Uncommitted here |
| T | ValeVision port | x | VV 2.32.0 | Ported 14-Sep-2026 after Adam's sign-off, ahead of Box Select, which replays on top as its own port. Source: a snapshot of the signed-off files, not the working copies, which already carry the Project Specification hunks. The three new modules came across verbatim below the header. This session's own 123 hunks were replayed in order across 21 files: 112 verbatim, 8 development-log heads rewritten to ValeVision's module versions, and 3 re-anchored (the History selection test, the SheetTools header, the last config label). History takes the leader row only; its shape row waits with ValeVision's pending undo-writes return trip. There is no service worker token there. Verified: `node --check` on 20 modules, both JSON files, the module graph, named exports on 315 files, and the leader harness 83/83 on ValeVision's real modules. Not exercised in the running app |
| **S** | **Box select - a window to the right, a crossing to the left, and several items worked as one** | **x** | 2.34.0 | Authored in TrueVision first, in the same files and at the same time as T (by agreement between the two sessions). `Na__LayoutEditor__SelectionBox__.js` (`Na__LeSelBox__`): a drag that starts where nothing can move (bare paper, the grey stage, a locked viewport, a read-only session - or anywhere with Alt) draws the box; right is a window (blue, solid edge, wholly inside), left a crossing (green, dashed edge, touching too); a viewport or a filled shape is touched by its edge, not its inside, so markup over a drawing boxes on its own; hidden, locked and locked-viewport items are never taken; a live preview outlines what would be taken. `Na__LayoutEditor__SelectionSet__.js` (`Na__LeSelSet__`): group move, nudge and delete, each one undo step; locked items left out; a leader tip follows a moving viewport, not its text. The selection is a set in the sheet model (`GetSelectionItems`, `SetSelectionItems`, `IsSelected`, `DeleteItems`); `GetSelection` still means one item. SketchUp modifiers in the key map's new SelectionBindings: Ctrl adds, Shift toggles, Ctrl+Shift removes. No record field |
| S | Verified | x | 2.34.0 | Harness against stubs: 87 checks (each kind's window and crossing rule, locks, the combines, one undo step for a group move, a nudge and a delete, the leader tip rule, the modifiers from both key maps). Module graph and named exports pass. In the app on PS01's PD Drawing sheet with every non-read blocked (none attempted): window, crossing, Alt over an unlocked viewport, a press on a locked one, Shift / Ctrl / Ctrl+Shift, click-to-narrow, group drag and nudge as one step each, Escape mid-box, the multi menu. Test objects never saved; the browser draft cleared |
| S | Tested by Adam | x | 2.34.0 | Tested 14-Sep-2026 ("It seems to be working") |
| S | ValeVision port | x | VV 2.33.0 | Ported 14-Sep-2026 after Adam's sign-off, on top of T's port (VV 2.32.0), by agreement between the two sessions. The two new modules came across verbatim below the header, leader rows included. Box Select's own 79 hunks were replayed across 13 shared files, every anchor unique before anything was written: 10 development-log heads rewritten to ValeVision's module versions; 6 re-anchored where ValeVision lacks the viewport snap-move and clipboard (the new-module imports, CancelPlacement, Escape, the zoom redraw, the context menu call) or words its History header differently; CarryTarget's guard left out, as there is no viewport carry there. The conversions of T's original hunks (DeleteLeader, the leader highlight) matched as they did here. History there still has no shape row, so a restore drops selected vectors from the set; it waits with ValeVision's pending undo-writes return trip. No service worker token there. Verified: 12 modules parse as ES modules, both JSON files parse, the module graph and named exports (317 files) pass, and this release's harness passes 86/87 on ValeVision's real modules (the one failure is that shape row). Not exercised in the running app |
| **U** | **Project Specification & Margin Notes - notes numbered by their place, bubbles that follow them** | **x** | 2.36.0 | Authored in TrueVision first. `Na__LayoutEditor__SpecData__.js` (`Na__LeSpec__`): the document - prefixed groups, notes, codes from the order, ids from a counter that never goes back - its own undo, the browser draft `Na__LayoutEditor__SpecDraft__<code>`, the read on the first editor entry, and Sync with the cloud overwrite question. `Na__LayoutEditor__SpecLinks__.js` (`Na__LeSpecLink__`): `Leader__SpecNoteId`, link by typed code, the LeaderGeometry resolver, the silent restamp, usage. `Na__LayoutEditor__SpecEditor__.js`: the Project Specification tab page. `Na__LayoutEditor__SpecMargin__.js`, `__MarginGrip__.js` and `__Panel__MarginNotes__.js`: the notes margin (`Sheet__MarginNotes`, reason `margin`). The file `TrueVision__ProjectSpecification__.json` sits beside the project data on R2, through a new CfApi whole-file read and write allowed by name. Records additive: the leader key only on a linked bubble, the sheet key only on a sheet that has had a margin |
| U | Verified | x | 2.36.0 | Node harness on the real modules: 128 checks; it found and fixed a stuck undo and a Retry that could replace the cloud copy without asking. Module graph 351, named exports 264. In the app on PS01 (localhost:8481) with every non-read refused and one specification write faked: the whole flow in DEVLOG v2.36.0, on an in-memory scratch sheet because PS01's R2 copy held no sheets. Test state and drafts cleared |
| U | PS01's R2 drawings block missing for a while | - | - | Found during the test, not caused by it: the live `TrueVision__ProjectData__.json` held only the eight keys of the repository base file, with no `LayoutEditor__DrawingsData`. Back by 14:31 (D01 - Floor Plans, D02 - Elevations). What dropped it is spun off as a separate task |
| U | Tested by Adam | - | 2.36.0 | |
| U | ValeVision port | - | - | Pending Adam's sign-off. Seven new files; the shared hunks sit on top of T (VV 2.32.0) and S (VV 2.33.0) |
| **V** | **Projected linework matches the 3D view - flush joins and seam leaks stop drawing** | **x** | 2.37.0 | Authored in TrueVision first. Layout Editor 2D viewports drew joins the live 3D view hides (the head-height line across a render wall, a sill line across a pier, the line under a fascia): the 3D view draws the SketchUp linework GLB, written without hidden, soft or smooth edges, over an edge-less mesh, while the projection finds its own edges in the mesh. New `Na__ProjectedLinework__FlushJoins__.js` (`Na__PlFlush__`) cuts an edge where the faces either side are coplanar and continuous in the view (`HideFlushJoins`, on). `ClipKernel__` 1.2.0: a triangle side lying along an edge now occludes it, closing the leak through the seam between two faces (`SeamsOcclude`, on). `LineworkFirst` (off): a category that ships linework draws only its authored lines and silhouettes - opt-in, because it deletes the elevation ground line (the top edge of the ground box, hidden in SketchUp). All three in the fingerprint; BuildToken `2026-09-14-flush-joins`. No GPU change: kept renders have been CPU-only since 2.27.0, and a named backend (Run Diff) runs without the rules |
| V | Verified | x | 2.37.0 | Node harness on the real modules: rules off byte-identical to before; defaults clear 3,840 mm (head height), 610 mm (pier sill) and 3,430 mm (fascia) and keep the 20,000 mm ground line, nothing added; strict mode's ground-line cost confirmed; each rule re-keys the cache. In the app on PS01's D02 - Elevations with writes blocked (none attempted): the pipeline's rules-on and rules-off results compared line by line - east elevation 4,573 mm removed (the 3,840 mm head-height line, a 495 mm stub, the pier sill pieces), Elevation 2 5,841 mm removed (the 3,430 mm fascia line, the 2,300 mm old/new wall join), nothing added, both ground lines whole |
| V | Force Render paints the previous projection | - | - | Found while testing, not caused by this release: `EnsureLinework` clears the path cache by the linework key while `BandPaths` stores under key, Hidden Lines and style, and the Layout Editor's memoised pipeline fingerprint ignores a session config change - so a forced re-projection under an unchanged key repaints the old paths. Spun off as its own task |
| V | Tested by Adam | x | 2.37.0 | Signed off 14-Sep-2026 ("That works great"), with a new report that turned out to be the base image, not the linework (X) |
| V | ValeVision port | - | - | Pending Adam's sign-off. Folder 50 only: the new module, nine changed modules and the config. `Pipeline__` sits on 2.32.0's model-root change, which ValeVision does not have |
| **W** | **Viewport Frame toggle - a viewport's frame and caption switch off** | **x** | 2.38.0 | Authored in TrueVision first. A Frame checkbox in the Viewport panel, above Caption. Off, `Na__LeChrome__BuildFrame` builds nothing for the viewport, so its frame and caption leave the sheet's SVG and the PDF together; Caption greys out and keeps its own setting. New record key `Viewport__ShowFrame`, stored only as `false` (the normaliser removes anything else), so every existing record and draft stays byte-identical. `UpdateViewport` patch key `showFrame`: one undo step, a content edit (draft and Save Sheets, never an auto save). Labels `ShowFrameLabel`, `ShowFrameTitle`, `CaptionNeedsFrame` |
| W | Verified | x | 2.38.0 | Four modules parse; module graph and named exports (265 files) pass. In the app on PS01's D01 - Floor Plans (localhost:8491), every non-read request blocked and none attempted: frame rectangle and caption present in the SVG, the chrome primitives and a jsPDF render before; all three gone with Frame unticked (PDF rectangle operators 6 to 4), the neighbouring viewport's frame untouched, Caption greyed and still ticked; undo, redo and re-tick each correct; the key absent whenever the frame shows. Draft cleared |
| W | Tested by Adam | - | 2.38.0 | |
| W | ValeVision port | - | - | Pending Adam's sign-off. Four Layout Editor modules (SheetChrome, Panel__ViewportSettings, SheetModel, SheetRecords) and three labels; nothing TrueVision-only |
| **X** | **Base images stop showing lines through faces - the linework depth bias was 75 mm in orthographic renders** | **x** | 2.38.1 | From Adam's report of lines through a fascia with 30 mm setbacks, in the base image only (the projected linework was exact). The SketchUp fat lines' `gl_FragDepth -= 0.00015` was tuned for perspective log depth; through an orthographic camera three writes linear `gl_FragCoord.z`, so across the drawing cameras' 10 mm to 500 m it was 75 mm. `Na__ModelLoader__MultiModel.js` 1.3.0: orthographic cameras take `RenderConfig__Linework__OrthoDepthBiasMm` (2 mm) through `abs(projectionMatrix[2][2]) / 2`; perspective unchanged; values written as GLSL floats; inside `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER`. Token `2026-09-14-4` |
| X | Verified | x | 2.38.1 | In the app on PS01 with writes blocked: North, East and South elevation base images with the old and new shader, pixel by pixel - 2,788 / 2,261 / 1,671 line pixels removed in the fascia and parapet bands, none added bar 16 on a garden-furniture outline; a perspective 3D scene render identical to the pixel under both shaders; after a reload the shipped module renders byte-identical to the runtime test. No shader errors |
| X | Tested by Adam | - | 2.38.1 | |
| X | ValeVision port | - | - | Pending Adam's sign-off. One loader hunk and one config key, if ValeVision's loader carries the same fixed depth bias |
| **Y** | **Measurements box (VCB) and drawing at scale** | **x** | 2.40.0 | Authored in TrueVision first. SketchUp's VCB at the bottom right of the stage: live readings for the Draw, Rectangle and Dimension tools, and values typed without clicking into it used on Enter - a length along the band; width x height, or a retype of the rectangle that just landed; a dimension's span, then its offset. Millimetres unless `m`, `cm` or `mm` follows; thousands commas. Draw at scale (Vectors) and Measure at scale (Dimensions), both on: real sizes at the scale of the 2D viewport under the point, else the sheet's scale. New modules `Measurements__`, `MeasureParse__`, `DrawingScale__`. New record key `Dimension__AtScale`, true or false only; an older record has no key and reads as before. Config `Measurements` block and two `DefaultAtScale` keys; key map `MeasurementsBox`. Token `2026-09-14-6` |
| Y | Verified | x | 2.40.0 | 77 parser checks in Node; modules parse; module graph 356, named exports 269. In the app on PS01's D01 (localhost:8503), writes refused and none attempted: typed Draw vertices exact (50 and 24 mm at 1:50) with an axis lock, a refused `2,5`, Escape and Enter precedence; a rectangle 60 x 40 then retyped to 80 x 20 as its own undo step; dimensions typed on bare paper (2,500 at the sheet's scale, 50 on paper when switched off) and over a 1:50 viewport (attached, 1,800); paper mode; tool keys and the focused box; the four existing dimensions keyless and unchanged; the mixed-scale rules on a copy. Test items and draft removed |
| Y | Tested by Adam | - | 2.40.0 | |
| Y | ValeVision port | - | - | Pending Adam's sign-off. Three new modules; the three drawing tools, SheetTools, MarkupBridge, both panels, SheetModel, SheetRecords, ConfigState and ModeController; the config, key map and stylesheet hunks. Nothing TrueVision-only |
| **Z** | **Fixed length extension lines - dimensions stand clear of the drawing** | **x** | 2.41.0 | Authored in TrueVision first, from Adam's D01 report. A Start and an End length per dimension (paper mm back from the dimension line; empty is the full line), linked by a padlock in the Dimensions panel's new Ext. lines row (`Na__LePanels__LinkedPairRow`, `ShowLink`), carried by the eyedropper (new trait flag `absent`) and Shift+B. Record keys `Dimension__StartExtensionMm` and `Dimension__EndExtensionMm` (only while set) and `Dimension__ExtensionsLinked` (only as false), so old records and drafts stay byte-identical. `DimensionGeometry__` `Skeleton` takes `{ startMm, endMm }` and returns `G1`/`G2`; a selected shortened dimension shows its undrawn part dashed, never in the PDF. Config `DefaultExtensionMm` (null) |
| Z | Verified | x | 2.41.0 | Node harness, 333,633 checks: no length is bit-identical to the pre-change skeletons and primitives; lengths exact; the eyedropper traits. Modules parse; module graph passes. In the app on PS01's D01 (localhost:8517), writes refused and none attempted, on Adam's own 800 / 890 / 3,740 run: linked and separate lengths, the padlock and its undo, clearing, hit test and snap at the measured point, the ghosts, eyedropper paint and Shift+B, a tool-placed dimension taking the settings. Test state restored, draft cleared |
| Z | Built beside Y and a plan doors session | x | 2.41.0 | Three sessions in the same Layout Editor files at once: footprints swapped by message first, each shared file landed as one anchored all-or-nothing patch after the peer's done, module dev log numbers agreed (SheetModel 1.13.0, SheetRecords 1.9.0, ConfigState 1.9.0, SheetTools 1.15.0 here; the doors session took the next) |
| Z | Tested by Adam | - | 2.41.0 | |
| Z | ValeVision port | - | - | Pending Adam's sign-off. Ten Layout Editor modules, the stylesheet region and two config keys; nothing TrueVision-only. The `SheetModel`, `SheetRecords`, `ConfigState`, `SheetTools`, `DimensionTool`, `MarkupBridge` and `Panel__Dimensions` hunks sit on top of Y's |
| **AA** | **Plan doors - doors stand open on Layout Editor plans, a click closes one** | **x** | 2.42.0 | Authored in TrueVision first. A 2D plan viewport draws every door open, whatever the 3D view shows, in its linework, base image and PDF, posed through the click-to-open door module (`ComputePanelLocalPose`), with a swing arc per open hinged leaf in the Doors layer's style. A click on a door in the selected plan viewport closes or opens it (one undo step, after the double click window); the right-click menu leads with Close door / Open door and Open all doors; the Viewport panel's Doors row counts the shut ones. New record key `Viewport__ClosedDoors` (ADR names, or ADR::MOD for an exterior double leaf). The definition carries `DoorPose`, folded into its record hash and the collection key; the model's doors are posed only for the synchronous model read and one base-image render, then restored by the door's own progress. New modules `Na__ProjectedLinework__DoorPose__` and `Na__LayoutEditor__PlanDoors__` |
| AA | Verified | x | 2.42.0 | Modules parse; named exports (271) and module graph pass. Node, 36 checks on a built five-door model (single, exterior double, sliding, upstairs, mirrored): every swing ends on the posed leaf's corner, copied sampler matrices stay posed after restore, the upstairs swing is cut away, owner tags match, hit test finds leaf, swing, doorway and a double leaf's own key, a door open in 3D is posed shut and comes back open. In the app on PS01 (localhost:8511, writes blocked, none attempted): registry records reused and every panel restored exactly; D01's plan viewports carry the pose (hash differs); Existing Floor Plan projection gains its swings (visible 1120 to 1169); on that LOCKED viewport the cursor is a pointer over the door, a click shuts it after the double click window, a drag and a double click change nothing, the doorway menu offers Open door and a click reopens it, two undo steps; the 3D door panels never moved; draft cleared |
| AA | Tested by Adam | - | 2.42.0 | |
| AA | ValeVision port | - | - | Pending Adam's sign-off. Needs ValeVision's door module to carry the same ADR / MOD / ROT contract first; then the two new modules, ViewDefinition, StageSampler, Projector, Pipeline, SnapshotRenderer, Viewport2d, SheetTools, SheetModel, SheetRecords, ConfigState, Panel__ViewportSettings, the config block and labels |
| **AB** | **Dimension end size - ticks, arrows and dots resize per dimension** | **x** | 2.43.0 | Authored in TrueVision first, from Adam's D01 request. Size mm under Ends in the Dimensions panel, paper millimetres. Record key `Dimension__TickLengthMm` (only while set), so old records and drafts stay byte-identical and draw at the config `TickLengthMm`. New dimensions take the panel setting; the eyedropper and Shift+B copy it. `MarkupBridge__` `DimensionTickMm` is the fallback; the selection box boxes the terminator at that size. Config `MinTickLengthMm` (0.5) and `MaxTickLengthMm` (12). Token `2026-09-14-9` |
| AB | Verified | x | 2.43.0 | Named exports pass (71 Layout Editor files). Module graph 359, 0 failures. AppConfig JSON parses. Not exercised in the running app in this session |
| AB | Tested by Adam | - | 2.43.0 | |
| AB | ValeVision port | x | VV 2.34.0 | Ported the same day at Adam's request ("update the ValeVision counterpart as well"). The Size mm field, `Dimension__TickLengthMm`, draw, eyedropper, selection box, defaults and config, without the TrueVision-only Measure at scale / extension-line rows ValeVision has not taken yet |
| **AC** | **Vector undo, redo, copy, paste and duplicate** | **x** | 2.44.0 | Authored in TrueVision first, from Adam's request after the dim-end-size work. Vectors join the existing clipboard (`Na__LeClip__` kind `'shape'`): Ctrl+C / Ctrl+V / Ctrl+D and the context menu. A paste is the whole record with a fresh id (`Na__LeModel__InsertShape`) and a fanned-out bounding-box origin (`PasteOffsetMm`); one undo step. While the Draw tool is placing points, Ctrl+Z / Ctrl+Y take vertices off and put them back instead of stepping the sheet history. Number fields hand those Ctrl chords to the sheet. No new record field. Token `2026-09-14-10` |
| AC | Verified | x | 2.44.0 | Named exports pass (71 Layout Editor files). Module graph 359, 0 failures. AppConfig JSON parses. Not exercised in the running app in this session |
| AC | Tested by Adam | - | 2.44.0 | |
| AC | ValeVision port | x | VV 2.35.0 | Ported the same day with snap/insert and VCB (VV v2.35.0). Viewport clipboard included because ValeVision had none yet |
| **AD** | **Vector moves snap to the linework; Shift-click inserts a vertex** | **x** | 2.45.0 | Authored in TrueVision first, from Adam's request after clipboard work. A whole-shape drag offers the grab point and every vertex to the existing object snap (linework endpoints and midpoints); the nearest wins and the shape translates onto it. Vertex grips already snapped. Shift-click an edge of the selected vector inserts a vertex (diamond preview while Shift is held), snapped, then the same press can drag it; one undo step. No new record field. Token `2026-09-14-11` |
| AD | Verified | x | 2.45.0 | Named exports pass (71 Layout Editor files). Module graph 359, 0 failures. AppConfig JSON parses. Not exercised in the running app in this session |
| AD | Tested by Adam | - | 2.45.0 | |
| AD | ValeVision port | x | VV 2.35.0 | Ported the same day with clipboard and VCB (VV v2.35.0) |
| **AE** | **Type a length while dragging a vertex** | **x** | 2.46.0 | Authored in TrueVision first, from Adam's request after snap/insert. While a vertex is dragged, the Measurements box takes a typed length and moves the vertex that far along the inferred direction (`GetVertexDrag` / `TypeVertexLength`); exact millimetres, drag finished so the pointer cannot pull it back; Draw at scale applies. Token `2026-09-14-12` |
| AE | Verified | x | 2.46.0 | Named exports pass (Layout Editor). Module graph 359, 0 failures. AppConfig JSON parses. Not exercised in the running app in this session |
| AE | Tested by Adam | - | 2.46.0 | |
| AE | ValeVision port | x | VV 2.35.0 | Ported with the Measurements box (VV had none). Typed lengths for Draw/Rectangle/Dimension came with it. Panel atScale rows left hardcoded true |
| **AF** | **Eyedropper matches unlocked viewports; locked frames are skipped** | **x** | working | Authored in TrueVision first, from Adam's request. Unlocked viewports copy render composites, frame, caption and scale. A locked viewport is not a source or a target and is not even resolved, so the dropper reaches markup through the frame |
| AF | ValeVision port | x | VV 2.36.0 | Ported the same day at Adam's request. Composites, caption and scale; `Viewport__ShowFrame` stays here (Frame toggle is still pending there as W) |
| **AG** | **Type a length while dragging a viewport** | **x** | 2.47.0 | Authored in TrueVision first. While a viewport frame is dragged (not a handle, not a content pan), the Measurements box takes a typed length and moves the frame that far along the inferred direction (`GetViewportDrag` / `TypeViewportLength`); exact millimetres, drag finished; length at the viewport's scale (sheet's for 3D). Token `2026-09-14-13` |
| AG | Verified | x | 2.47.0 | Named exports pass (73 Layout Editor files). Module graph 361, 0 failures. AppConfig and KeyMappings JSON parse. Not exercised in the running app in this session |
| AG | Tested by Adam | - | 2.47.0 | |
| AG | ValeVision port | x | VV 2.39.0 | Ported the same day at Adam's request |
| **AH** | **Doors stay shut on elevations and sections** | **x** | 2.48.1 | From Adam, after AA: doors open on plans only. A Layout Editor elevation or section viewport draws every door shut in its linework, base image and PDF, whatever the 3D view shows: `Describe` passes `Na__LeDoors__ShutPoseFor`, `DoorPose { Shut : true }`, through `FromElevation`'s new fourth argument into the record hash and collection key (each elevation viewport projects once more; plans and drawings outside the editor key as before). Under the shut pose `IsClosed` shuts every panel, no swing is traced, and `HitTest` and `At` answer nothing. New `Na__PlDoors__PutBack`: the projector's read puts panels back exactly where it found them instead of restoring the 3D view's pose, so a read landing between an underlay render's tile yields no longer reads that render's pose or tears its picture. Config `ShutOnElevations` (true). Token `2026-09-14-15` |
| AH | Verified | x | 2.48.1 | Modules parse; 218 named imports resolve; AppConfig JSON parses. In the app on PS01 (localhost:8531, non-read requests refused, none attempted): all six D02 elevation viewports carry the shut pose; both D01 plans keep byte-identical pose JSON and hashes; no door answers a click, the menu or the hit test on an elevation (control: an open pose finds one). With every door held open in 3D, the shut pose matched the at-rest linework on all six, and the at-rest base image byte for byte on South and East copy, where the old definition differed by 1,246 / 45 segments and 8,918 / 3,481 pixels. A forced race put an elevation read inside a plan underlay render: the read kept the double door's 6 leaf meshes shut, the render's doors stayed open, and the plan picture matched an undisturbed render byte for byte. Plan swings intact (72); doors restored exactly |
| AH | Tested by Adam | - | 2.48.1 | |
| AH | ValeVision port | - | - | Pending Adam's sign-off, with AA: DoorPose, ViewDefinition, Projector, PlanDoors, Viewport2d, ConfigState, SnapshotRenderer's comments and the config key, on top of AA's port |
| **AI** | **Zoom inside a 3D viewport** | **x** | 2.50.0 | Authored in TrueVision first, from Adam's request. Double-click a 3D viewport and scroll to zoom its picture about the cursor (Shift for fine steps), Enter to finish; a Zoom % box on 3D viewports (Reset; clamped 25 to 1000 percent). `Viewport__ImageZoom` is a multiple of `Viewport__ImageMm`, stored only when not 1. A frame that is not the whole picture renders as a window onto the camera's picture (TiledRenderer `viewWindow`): sharp zoomed in, full of scene zoomed out; untouched viewports key as before. New `Na__LayoutEditor__Viewport3dZoom__`. Token `2026-09-14-19` |
| AI | Verified | x | 2.50.0 | In the app on PS01 (localhost:8541, writes refused): the wheel zooms exactly about the cursor as one undo step and Enter keeps it; window renders match crops of a whole render (mean difference 0.001 to 0.008, against 12.6 to 18.1 shifted); the panel box, Reset, lock and 2D hiding work; a pasted copy keeps the zoom and Model Source switches it to Existing Building; the PDF places the pictures at their frames. Module graph 365, 0 failures; named exports pass (278 files) |
| AI | Tested by Adam | - | 2.50.0 | |
| AI | ValeVision port | - | - | Pending Adam's sign-off: the new module, Viewport3d, SnapshotRenderer, TiledRenderer `viewWindow`, PdfExporter, Panel__ViewportSettings, SheetTools, Controls__Pc, ViewportHandles, SheetRecords, SheetModel, ConfigState, the config and the key map |
| **AJ** | **Project Specification, Read - the notes as A4 pages, to print or read aloud** | **x** | 2.51.0 | Authored in TrueVision first, from Adam's request: Edit and Read tabs inside the Project Specification tab. New `Na__LayoutEditor__SpecDocument__.js` (`Na__LeSpecDoc__`) lays the live specification out as measured A4 pages: headings kept with what follows, only chunks taller than a third of a page broken (between words, two lines each side), every block at least 2 px above the foot. Print lays the pages out again in a body-level `.na-le-spec-print` shown alone under `@media print`, with `@page { size: A4 portrait; margin: 0; }` in the document only between beforeprint and afterprint. The running head, company and page number are painted from `data-na-spec-paint`, so Read Aloud skips them; the host carries `is-spec-shown`, which hides `.na-le-shell` beneath. The project name comes from `window.TrueVision__Pwa__ProjectContext` (the PresentationMode active config has no projectName). `SpecEditor__` 1.1.0: the view (localStorage `na-layouteditor-spec:view`), each view's scroll, the page count and Print. 17 labels. Nothing new is written to project data. Token `2026-09-14-20` |
| AJ | Verified | x | 2.51.0 | In the app on PS01 (localhost:8537, every write refused): 4 pages at 793.7 x 1122.5 px, the 29 codes in order and the 8,444 characters of note text matching the data; Edit's and Read's bar items; each view's scroll kept across a visit to a sheet; Open in specification switching to Edit; the shell hidden only while the tab is up; beforeprint and afterprint building and removing the paper pages; the context menu not cancelled; a 720 px window fitting the pages at zoom 0.847. The real module in headless Chrome, its imports stubbed by an import map, with the real CSS and PS01 notes: PS01 prints 4 A4 pages (595 x 842 pt) with no app UI and no blank page; a stress document (an 11,000-character note, a note with no text, an empty group) prints 7 pages, the long note breaking where it starts with every word kept. Not exercised: Edge's Read aloud itself, and the print dialog (headless print-to-pdf only) |
| AJ | Tested by Adam | - | 2.51.0 | |
| AJ | ValeVision port | - | - | Pending Adam's sign-off, after U's port (itself pending): the new SpecDocument module, SpecEditor, Styles__Specification and the 17 labels. ValeVision needs its own project-name source in place of TrueVision__Pwa__ProjectContext |
| **AK** | **Rotate text - a round grip turns a text box** | **x** | 2.52.0 | Authored in TrueVision first, from Adam's request for rotation handles on text boxes. A selected text item shows a round grip on a stem off the top of its outline; a drag turns it about the middle of its box, Shift in 15 degree steps, and without Shift it settles on a right angle within 2 degrees. The Text panel's Rotation row (degrees clockwise) turns the selection or sets it for new text; the menu's Reset rotation levels it. New record key `Annotation__RotationDeg` (degrees clockwise about the anchor, only while turned). Lines, leader, selection outline, hit test, box select, inline editor and PDF all follow the turn. Also fixes jsPDF's placement of any turned centred or right-aligned run, which moves vertical and aligned dimension values in the PDF onto the spot the screen draws. Token `2026-09-14-21` |
| AK | Verified | x | 2.52.0 | In the app on PS01 (localhost:8553, every write refused; the one POST refused was the drawing notes save on entering the editor): the grip draws on its geometry; drags land on 90 (detent), 135 (Shift) and 101.7 with the middle still; the turned box hit tests and box selects on its turned shape; the panel, Reset rotation, undo and redo, the turned inline editor, two lines and a leader at -90, and new text at a default of 90 all check out. The PDF text operator puts the anchor on the SVG's; in Node against jsPDF 4.1.0 every alignment and angle lands within 0.0001 mm (15.7 mm off before). Modules parse; module graph passes; named exports pass (280 files) |
| AK | Tested by Adam | - | 2.52.0 | |
| AK | ValeVision port | - | - | Pending Adam's sign-off: MarkupBridge, Grips, TextTool, Panel__Text, SelectionBox, SheetTools, SheetModel, ConfigState, SheetChrome (the PDF fix), the two stylesheet rules, three Text config keys and two labels. ValeVision must read a missing `Annotation__RotationDeg` as level |
| **AL** | **Scrapbook: drag ready-made items onto a site plan sheet** | **x** | 2.53.0 | Authored in TrueVision first, from Adam's request with his Mapping Data Credentials image. A Scrapbook section (left column, after Sheet) shows on a sheet whose drawing type has items - today site plan sheets - with three tiles: Mapping Data Credentials and North Point, and each alone. A pointer drag carries a true-scale ghost and drops the item centred under the pointer, grouped and selected; double-click or Enter places it in the middle of the view. New `Na__LayoutEditor__Scrapbook__` (config, sets, previews through `BuildSheetPrimitives`), `Na__LayoutEditor__Panel__Scrapbook__` and `Na__LayoutEditor__Scrapbook__Config__.json` (pieces of sheet records, items, tokens `{OsLicenceNumber}` and `{Year}`, labels); `ItemClipboard__` 1.1.0 `InsertSet`; `ModeController__` 1.14.0. Nothing new in project data. Token `2026-09-14-22` |
| AL | Verified | x | 2.53.0 | In the app on PS01 (127.0.0.1:8523, every write refused, none attempted), on in-memory scratch sheets restored byte for byte afterwards: the drop centred on the pointer as a group of two groups on the right layers, one undo step with undo and redo; the ghost at the sheet's zoom; Escape and an off-sheet release drop nothing; double-click and Enter place in view; hidden on an architectural sheet; Open Sans line widths within 0.5% of Adam's image; an uncompressed PDF carries the three lines and the fills. New modules parse; the shared-file patches keep their line endings |
| AL | Tested by Adam | - | 2.53.0 | |
| AL | ValeVision port | - | - | Pending Adam's sign-off, and only useful once ValeVision has site plan drawings or the Scrapbook gains architectural items: the two new modules, the config, ItemClipboard `InsertSet`, the ModeController registration and the Scrapbook CSS region |
| **AM** | **Margin notes spread out when the column has room** | **x** | 2.54.0 | From Adam, with D03 and D02 screenshots. `SpecMargin__` 1.3.0: the gap between notes has a least (`NoteGapMm`, 2.5) and a most (new `NoteGapMaxMm`, 5). What fits is decided at the least; when every note fits, room left at the foot opens every gap by the same amount up to the most, each rule centred in its gap. A column with notes that did not fit keeps the least. `ConfigState__` 1.22.0 `noteGapMaxMm`. No record field, nothing new in project data. Token `2026-09-14-23` |
| AM | Verified | x | 2.54.0 | In the app on PS01 (localhost:8563, every write refused), against the same module with the most pinned to the least: D03 39.05 mm to spare, gaps 5 mm; D02 4.13 mm to spare, gaps 2.72 mm; D01 162 mm to spare, gaps 5 mm. Same notes, text, left edges and rules; nothing overflowing; every rule centred to 0 mm; D03's screen SVG draws its 14 rules at the new positions. Both modules and the AppConfig JSON parse. PDF not exported |
| AM | Tested by Adam | - | 2.54.0 | |
| AM | ValeVision port | - | - | With U's port (pending): the `SpecMargin__` Plan hunk, ConfigState's `noteGapMaxMm` and the config key. Nothing TrueVision-only |
| **AN** | **Layout Editor sorted into numbered subfolders** | **x** | 2.55.0 | From Adam (Task 04), after ValeVision3D v2.47.0: the same structure here, so a port lands at the same path in both apps. Folder 51's files moved into 14 numbered subfolders, `03__Core__Config` to `70__DevTools__DevMenu` (ValeVision's `01__Core__Loader` has no TrueVision files while TrueVision has no loader); names, namespaces and exports unchanged; 522 paths inside the folder rewritten, plus Index.html, the CSS index and RenameDrawing. The eight files over 1000 lines split into ValeVision's units with the same functions in each: SheetTools, SheetModel, ConfigState, SpecData, SpecEditor and Viewport2d (plus a TrueVision-only `Viewport2d__SitePlan__` unit for the eight site plan functions, Adam's choice), Styles__Main (Paper) and Styles__Specification (Notes, Read), whose parts the CSS index imports straight after them. Plain file moves, nothing staged. Token `2026-09-15-1` |
| AN | Verified | x | 2.55.0 | Every split: each declaration found exactly once, its text unchanged apart from the accessor writes an imported binding forces (SheetTools 17 lines, SheetModel 27, SpecData 48, SpecEditor 29, ConfigState and Viewport2d none), and every export kept. Both stylesheets' regions moved text for text; the Dev section now precedes three paper regions and shares no class or id with them. Lint over the 117 modules: 0 errors and the one old warning, identical before and after the move. Named exports pass (319 files); module graph 407, 0 failures; every `new URL` target, CSS index import and dynamic import resolves; the same two import cycle groups as before. Not run in a browser |
| AN | Tested by Adam | - | 2.55.0 | |
| AN | ValeVision port | x | VV 2.47.0 | Done there first, the same day |
| **AO** | **Console: the deprecated shadow map type** | **x** | 2.55.0 | From Adam's console log in ValeVision. Index.html asked for `PCFSoftShadowMap`, which three r184 deprecates: it already drew `PCFShadowMap` in its place and warned on every load. It now asks for `PCFShadowMap`, so shadows are unchanged. The Canvas2D readback hint needs nothing here: the sharpen effect already creates its blur canvas with `willReadFrequently`, and the tiler's snapshot canvas stays GPU-backed on purpose |
| AO | Tested by Adam | - | 2.55.0 | |
| AO | ValeVision port | x | VV 2.47.1 | The same line, plus ValeVision's strip sharpen buffers |

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
