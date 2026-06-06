# TrueVision3D Development Log
# =========================================================

# ---------------------------------------------------------
## TrueVision3D v2.3.2  -  06-Jun-2026
### AO Exclusion System — Plant Foliage Excluded from SSAO

**Overview**
- Added a material-level `AoExclude` flag to the materials library. Any material with `AoExclude: true` is excluded from both depth pre-pass render paths so the SSAO shader never accumulates occlusion on those meshes.
- `MAT160__Generic__PlantFoliage` is the first material to use this flag.

**Mechanism (Three.js Layers)**
- During material swap (`Na__MaterialsSystem__MaterialSwap.js`), meshes whose library config has `AoExclude: true` are moved to Three.js **layer 1** (`node.layers.set(1)`) and tagged `node.userData.na_aoExclude = true`.
- In `Na__RenderPipeline__PostProcessing__Setup.js`, `camera.layers.enable(1)` is called once at setup so layer 1 objects remain visible in the main `RenderPass`.
- Both depth render calls (`renderDepthPrePass` and the profile-lines `renderProfileNormals` wrapper) temporarily call `camera.layers.disable(1)` before the render and `camera.layers.enable(1)` after. This is an O(1) bitmask operation — zero per-frame traversal cost.
- Since neither depth path writes depth data for foliage pixels, the SSAO shader sees `centerDepth = 1.0` (far-plane / no geometry) for those pixels and exits the AO loop at the existing `centerDepth >= 1.0` early-return branch.

**Side Effect (Bonus)**
- Foliage is also excluded from the profile lines normal pass, so the edge-detection shader will not attempt to draw hard outlines on organic leaf geometry.

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — v2.3.1: `AoExclude: false` added to MAT001 default template; `AoExclude: true` on MAT160.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — v1.2.0: same additions synced to SketchUp DataLib.
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js` — AO-exclusion block added to traverse; `AoExcluded` counter in log output.
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js` — `camera.layers.enable(1)` at init; `disable(1)` / `enable(1)` wrapping both depth render paths.

# ---------------------------------------------------------
## TrueVision3D v2.3.1  -  06-Jun-2026
### Materials Library — MAT160__Generic__PlantFoliage Added

**Overview**
- Added `MAT160__Generic__PlantFoliage` to the MAT100 BasicSeries in the materials library.
- Material is double-sided and semi-transparent to support single-plane leaf geometry without backface culling artefacts.
- No renderer or exporter code changes were required — `IsDoubleSided` and `Transparent` flags are already handled by the existing `Na__MaterialsSystem__CreatePbrMaterial` pipeline.

**Material Settings**
- `SketchUpName` : `MAT160__Generic__PlantFoliage` (paint this name onto faces in SketchUp)
- `BaseColor`    : `rgb(140, 150, 125)` — muted sage green
- `Opacity`      : `0.9` — slight leaf translucency
- `Transparent`  : `true` — enables THREE.js alpha blending
- `IsDoubleSided`: `true` — both faces rendered; prevents invisible backsides on single-plane leaves
- `PbrRoughness` : `0.85` — matte leaf surface

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — v2.2.1 → v2.3.0, MAT160 entry added to MAT100__BasicSeries__.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — v1.0.0 → v1.1.0, same entry synced to SketchUp DataLib so GLB exporter embeds `doubleSided: true` and `alphaMode: BLEND` into exported files automatically.

# ---------------------------------------------------------
## TrueVision3D v2.3.0  -  25-May-2026
### User Guide — Accordion Sections, Fly Mode Docs, Whitecard Restyle

**Overview**
- Restyled the User Guide modal from the Vale dark blue panel to a clean light whitecard panel, matching TrueVision's scene aesthetic.
- Each section (Orbit, Walk, Fly, Hotkeys, Isolation Tools) is now a collapsible accordion with a chevron arrow toggle. All sections start expanded.
- Added a Fly Mode section covering WASD + Q/E ascend/descend, pointer-lock mouse look, Alt precision, Shift boost, and touch controls.
- Added the `Alt+Shift+F` hotkey entry to the Global Hotkeys section.
- Added a small SVG mode icon beside each section title (orbit, walk, fly, keyboard, layers).

**Changed Files**
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html` — Accordion structure, mode icons, Fly Mode section, Alt+Shift+F hotkey.
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__Styles__UserInstructions__.css` — Light whitecard modal, accordion toggle/body/chevron styles, CSS variables for colours.
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js` — Added `Na__UserInstructions__InitAccordions` function; called after content injection in `Na__UserInstructions__Initialize`.

# ---------------------------------------------------------
## TrueVision3D v2.2.9  -  25-May-2026
### Fly Mode — Free-Flight Navigation With WASD / Arrows / Mouse / Door Proximity

**Overview**
- Added a third navigation mode alongside Orbit and Walk: a free-flying camera designed for users familiar with first-person shooter / SketchUp-style fly controls.
- Mirrors the existing Walk Mode module layout exactly so the codebase stays consistent and developers can navigate either system using the same mental model.
- Reuses the existing door proximity system so doors open and close as the camera flies near them, matching Walk Mode behaviour.

**Controls (Desktop)**
- `W` / `ArrowUp`        → Forward
- `S` / `ArrowDown`      → Backward
- `A` / `ArrowLeft`      → Strafe Left
- `D` / `ArrowRight`     → Strafe Right
- `E` / `PageUp` / `Space` → Ascend (world Y+)
- `Q` / `PageDown` / `C`  → Descend (world Y−)
- `Shift`                → Boost speed multiplier
- `Alt`                  → Slow / precision multiplier
- `Mouse` (pointer-lock) → Yaw + pitch look (FPS-style; click canvas to lock)

**Controls (Touch / Tablet)**
- Single-finger drag → horizontal motion (forward + strafe), matching Walk Mode UX.
- Two-finger drag    → camera rotation (yaw + pitch).
- Two-finger pinch   → vertical motion (spread to ascend, pinch to descend).

**Hotkey**
- `Alt+Shift+F` toggles Fly Mode globally.

**New Files**
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__SystemLogic.js` — core state, no gravity, no collision, smoothed velocity integration for drone-like glide.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__DesktopControls.js` — WASD + Arrows + Q/E + Space/Ctrl + pointer-lock mouse look.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__TouchScreenControls.js` — one-finger drag + two-finger rotate + pinch-to-elevate.
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeControls.js` — orchestrator (mirror of `WalkModeControls`).
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeEventListeners.js` — hotkey + button binding (mirror of `WalkModeEventListeners`).

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — added `Navmode__Settings.Navmode__FlyMode` config block and `Global__Hotkeys__ToggleFlyMode`.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__ModeTransition.js` — added `Na__ModeTransition__OrbitToFly` and `Na__ModeTransition__FlyToOrbit` (matches the existing repositioned-orbit-camera logic used for walk-to-orbit).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — render loop now branches on `Na__FlyMode__IsActive()` and feeds the camera position to `Na__DoorProximity__Update`; keep-rendering predicate also includes fly mode.
- `index.html` — Fly Mode menu button added between Walk and Orbit, tri-state mode-status repaint, mutual-exclusion handoff so toggling Fly auto-deactivates Walk (and vice versa).

**Config Authority**
- All Fly Mode behaviour is sourced from `Na__AppConfig__Main.json → Navmode__Settings.Navmode__FlyMode` (movement and vertical speeds in mm/sec, boost/slow scalars, damping factor, mouse sensitivity, keyboard rotate rate, door proximity threshold, touch sensitivities). Nothing is hardcoded outside the JSON.

**Door Animation Parity**
- Fly Mode reuses `Na__DoorProximity__Initialize` / `SetEnabled` / `Update` exactly like Walk Mode. Camera position is passed in directly (no capsule), so proximity triggers fire whenever the user flies within the configured threshold.

**Verification Notes**
- No linter errors across all new + modified files.
- Modes are mutually exclusive: switching between Walk ⇄ Fly ⇄ Orbit always cleans up the outgoing mode before starting the incoming one so the saved orbit snapshot remains valid.
- Render loop only spins continuously while a navigation mode that needs it (`walk-mode`, `fly-mode`, or orbit interaction) is active — the existing invalidation contract is preserved.

# ---------------------------------------------------------
## TrueVision3D v2.2.8  -  25-May-2026
### Scene Inspector — ValeVision Dev Tools Tree Explorer Ported to TrueVision

**Overview**
- Ported the ValeVision3D nested Scene Inspector from `70__System__DevTools` into TrueVision as a localhost-only Dev Tools utility.
- Gives developers an on-demand collapsible Three.js scene graph tree with per-node visibility control, mesh stats, filtering, bulk hide/restore, mesh/linework pair isolation, and clipboard export — without waiting for the async model loading sequence to finish.
- No `Na__AppConfig__Main.json` changes required; behaviour is driven by module-local constants and existing render invalidation.

**New Dev Tools System Folder — `70__System__DevTools`**
- Introduced `02__Src__AppModules/70__System__DevTools/` to mirror ValeVision3D's dev-tools module layout and separate localhost developer utilities from production toggle UI in `26__System__ToggleModelElements`.
- `Na__UiFeature__SceneInspector__Controls.js` — full Scene Inspector logic; exports `Na__UiFeature__InitializeSceneInspector(scene)`.
- `Na__UiFeature__DevMenu__LocalhostOnly.js` — moved Dev Tools menu reveal logic here from `26__System__ToggleModelElements`; adds drag-resize handle support aligned with ValeVision.

**Scene Inspector — TrueVision Adaptations**
- Category group pattern adapted from ValeVision's `^ValeVision__\w+__\w+` to TrueVision's loader naming: `^(?:TrueVision|Storey)__\w+` so **Isolate Pair** mode correctly toggles mesh ↔ linework siblings under both standard category groups and storey-based groups from `Na__ModelLoader__MultiModel.js`.
- Scans the live `Na__Scene__Main` on demand (Scan Scene / Rescan); default expand depth remains 3 levels.
- Visibility dot clicks call `Na__RenderLoop__RequestRender()` after mutating `node.visible`.
- **Hide All** / **Restore All** bulk controls snapshot visibility at scan time and restore to that state.
- **Filter nodes…** input narrows the displayed tree by name fragment while auto-revealing ancestor groups.
- **Copy Tree** writes concise and full plain-text reports to the clipboard.

**UI Wiring — Dev Tools Menu**
- Added Scene Inspector submenu block to `#naDevToolsMenu` in `index.html`, positioned after **Toggle Model Layers** and before **Save Camera Settings**.
- Added `#naDevMenuResizeHandle` to the Dev Tools container for runtime panel width adjustment.
- `index.html` import path for localhost Dev Menu updated to `70__System__DevTools/Na__UiFeature__DevMenu__LocalhostOnly.js`.
- Scene Inspector initialised after scene creation: `Na__UiFeature__InitializeSceneInspector(Na__Scene__Main)`.

**Styles**
- New dedicated stylesheet `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` (`.na-scene-inspector__*` rules, wider dev panel min-width, resize handle).
- Imported from `Na__CoreUi__Styles__Index__.css` after the dropdown/toast stylesheet.

**Relationship to Existing Model Toggle**
- **Toggle Model Layers** (flat category list) and **Scene Inspector** (full nested scene graph) are complementary — category toggles remain in `26__System__ToggleModelElements`; per-node exploration lives in the new Dev Tools module.

**Verification Notes**
- Dev Tools menu remains localhost-only via `Na__AppUtils__IsRunningOnLocalhost()`.
- Smoke test: Dev Tools visible on localhost, Scene Inspector opens, Scan Scene renders tree + stats, existing Toggle Model Layers and Save Camera Settings entries unchanged.

**Files Changed**
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__SceneInspector__Controls.js` — new
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__DevMenu__LocalhostOnly.js` — new
- `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` — new
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` — import added
- `index.html` — Dev Tools markup, imports, Scene Inspector init
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.7  -  24-May-2026
### Walk Mode Performance Overhaul — Collision Filtering, Stationary Fast-Path, Allocation Elimination

**Overview**
- After the v2.2.6 profile-lines fix made orbit mode rapid, walk mode remained sluggish (sustained ~15 fps in a 33-category project, with 220+ `requestAnimationFrame` violation warnings and AO auto-disabling from the perf monitor).
- Root cause was the exact same `obj.isMesh === true` trap that hit the profile-lines effect: `Na__WalkMode__SetCollisionMeshes` was traversing the model graph with a bare `isMesh` filter, so every `LineSegments2` fat-line object was being added to the per-frame raycast set. The collision diagnostic now reports the rejected counts: `Collision meshes set: <N> meshes (rejected: <X> fat-lines, <Y> linework-grouped, <Z> exempt)`.
- Compounded by the fact that ground detection re-ran 5 raycasts against the entire collision set **every single frame**, even when the player was standing perfectly still — meaning just looking around in walk mode was firing ~5,500 ray–mesh intersection tests per frame for zero gameplay value.
- Compounded further by per-frame `new THREE.Vector3()` / `new THREE.Euler()` allocations across the ground/horizontal/movement/camera-update paths.

**Walk Mode Collision Filtering — LineSegments2 + Linework Groups Excluded**
- Added `Na__WalkMode__IsInsideLineworkGroup` helper. Walks the object's `parent` chain looking for `userData.Na__ModelType === 'linework'` (set by `Na__ModelLoader__MultiModel.js` when the linework root is attached to its category group).
- `Na__WalkMode__SetCollisionMeshes` now rejects:
  1. Any `Line2 / LineSegments2` (their template quad has no physical collision meaning).
  2. Any mesh nested inside a tagged linework group (defensive — catches a stray real `Mesh` shipped inside a linework GLB).
  3. The pre-existing exempt keyword list (Dev cube, OrbitHelperCube).
- Each reject path is counted and reported in the diagnostic log so future regressions are visible at a glance.

**Stationary Fast-Path for Ground Detection**
- `Na__WalkMode__ApplyGravity` now bails out before raycasting whenever `IsGrounded && VelocityY === 0 && InputForward === 0 && InputStrafe === 0`.
- Ground state cannot change without vertical velocity (jumping/falling) or horizontal input (walking off a ledge), so re-confirming the floor underneath a stationary player is pure wasted work.
- Idle walk-mode ground-check cost drops from ~5,500 ray–mesh tests per frame to **zero**.
- Looking around in walk mode is now as cheap as orbit mode at rest.

**Movement Processing Fast-Path**
- `Na__WalkMode__ProcessMovement` now early-returns when both `InputForward` and `InputStrafe` are zero — no need to compute forward/right vectors, build a zero move vector, or call `ResolveHorizontalCollisions` if the player isn't pressing any keys.

**Per-Frame Allocation Elimination**
- Promoted 13 reusable scratch objects to module scope (`Vector3`s for ray origin, move delta/direction, hit normal, slide velocity, resolved position, forward, right, move vector, previous/proposed positions; an immutable `UpAxis`; a single `Euler` for camera quaternion construction; plus the existing raycaster + down-direction).
- `Na__WalkMode__RaycastGround` no longer allocates `new THREE.Vector3` per call — uses `Scratch__RayOrigin` (Three.js's `Raycaster.set()` internally copies origin/direction so reuse is safe).
- `Na__WalkMode__DetectGroundHeight` no longer allocates a 5-element array of object literals per call — replaced with two lazily-populated module-scope `Float64Array`-style number arrays (`GroundProbeOffsetsX`, `GroundProbeOffsetsZ`).
- `Na__WalkMode__ResolveHorizontalCollisions` no longer allocates per ray height, per slide computation, or per return path — all transient vectors reuse the module-scope scratches.
- `Na__WalkMode__UpdateCameraFromCapsule` no longer allocates a fresh `Euler` per frame.
- `Na__WalkMode__ProcessMovement` no longer allocates forward / right / up-axis / move / previous / proposed vectors per frame.
- Net effect: the walk-mode hot path now does **zero `new THREE.*` allocations per frame**, eliminating the GC pressure that was contributing to the violation warnings.

**Ambient Occlusion — Still Untouched**
- AO was already auto-disabling at 15 fps via its existing perf monitor. With walk mode now running fast, AO should no longer trip the threshold. No changes were made to AO code or config, per the standing constraint.

**Verification Notes**
- After load, the collision diagnostic should now read substantially lower than before. For a 33-category project that previously reported 1117 collision meshes, the figure should drop by roughly the linework count (e.g. ~613 with ~504 fat-lines rejected). Confirm visually that the rejected counts in the log are non-zero.
- Walk mode should now feel as smooth as orbit mode. Standing still in walk mode should not cost more frame budget than standing still in orbit mode.
- The 220+ `requestAnimationFrame` violation warnings should disappear.

**Files Changed**
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js`
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.6  -  24-May-2026
### Profile Lines GPU Drain — Final Fat-Line Material Swap Fix

**Overview**
- TrueVision was still maxing out the GPU after the v2.2.4 overhaul. After a full side-by-side comparison with ValeVision3D (which is now fast), the residual cause was localised to a single bug in `collectMeshObjects` inside the profile lines effect.
- Three.js sets `isMesh = true` on every `LineSegments2` (the fat lines exported from the SketchUp linework GLBs) because they render internally as instanced quads. The previous `collectMeshObjects` filter (`if (obj.isMesh)`) was therefore pushing every fat-line object into the per-frame material-swap array.
- In PASS 2 (profile colour buffer), each fat line's `LineMaterial` was being temporarily replaced with the flat `MeshBasicMaterial` fallback. The instanced draw still fired, but the bound shader did not understand the per-instance line-segment attributes (`instanceStart`/`instanceEnd`/colour twins). The GPU spent most of its budget every frame chewing through corrupt instanced geometry from the template quad. This is what made disabling Profile Lines feel "vastly" faster.

**collectMeshObjects — Fat-Line Exclusion**
- Added explicit early-return for any `obj.isLine2 || obj.isLineSegments2` in `Na__RenderEffect__ProfileLines__.js`. LineMaterial is now never swapped under any circumstance.
- This matches the ValeVision3D filter exactly and is the primary fix.

**Na__IsInsideLineworkGroup — Defensive Parent-Chain Guard**
- New helper walks an object's `parent` chain looking for `userData.Na__ModelType === 'linework'`. Any mesh nested inside a linework GLB root is now skipped by the profile-colour swap regardless of its `isMesh` value.
- Uses the existing tag set in `Na__ModelLoader__MultiModel.js` (lines 473/491/515/527) at load time.
- This guarantees the mesh model and the linework model are never "counted twice" by the profile lines passes — exactly the architectural separation the user requested.

**Diagnostic — One-Shot Cache Rebuild Log**
- `rebuildSceneCache()` now emits one console line per rebuild reporting `meshes(swap)` and `lines(hide)` counts.
- Fires only when the scene actually changes (model load, model toggle, storey isolate) — not per frame — so it is effectively free.
- Future regressions of the mesh/linework split are now visible in DevTools without a debugger.

**Optional Mesh-Only Fast Path — `ColorPassIncludesLinework` Flag**
- Added `RenderEffect__ProfileLines__ColorPassIncludesLinework` config flag, **default `true`** (no visual change vs current behaviour).
- When set to `false` in `Na__AppConfig__Main.json`, the profile colour pass skips rendering linework entirely (lines stay hidden from PASS 1 right through PASS 2 and are only restored before the main `RenderPass`). Auto-detected profile lines then take the uniform fallback colour instead of the local SketchUp linework hue.
- Available as an opt-in for very heavy linework scenes if further perf is ever needed. Not enabled by default.

**Ambient Occlusion — Intentionally Untouched**
- AO is hand-tuned and brittle. No edits were made to `Na__RenderEffect__AmbientOcclusion__.js` or its config block, even though AO uniforms are still updated every frame. AO depth still comes for free from the shared normal-pass depth texture introduced in v2.2.4.

**Files Changed**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.5  -  21-May-2026
### Site Boundaries Toggle — Conditional Layer Support

**Overview**
- Added `Site Boundaries` as a first-class toggleable model layer to match the new `08__Site__Boundaries` SketchUp tag. When a project includes `TrueVision__SiteBoundaries__*` GLBs, a "Site Boundaries" toggle button appears automatically in the Model Parts List panel between "Proposed Interior Decor" and "Landscape". Projects without boundary geometry are unaffected.

**Model Loader — Load Order**
- `"TrueVision__SiteBoundaries"` inserted into `Na__ModelCategories__LoadOrder` in `Na__ModelLoader__MultiModel.js` between `ProposedInteriorDecor` (tag 29) and `LandscapeEnvironment` (tags 07, 09), matching the tag-08 numeric position in the SSOT.
- The existing URL parse regex `/(?:.*?__)?(TrueVision)__(.+?)__(MeshModel|LineworkModel)__\.glb/i` already captures `TrueVision__SiteBoundaries` filenames; no parser changes required.

**Toggle UI — Display Name**
- `"TrueVision__SiteBoundaries": "Site Boundaries"` added to `Na__ModelToggle__DisplayNames` in `Na__UiFeature__ModelToggle__Controls.js` at the correct position between ProposedInteriorDecor and LandscapeEnvironment.
- Button is fully conditional — only created when boundary GLBs are present in the project's model URL list.

**Files Changed**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — added `TrueVision__SiteBoundaries` to load order
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` — added display name

# ---------------------------------------------------------
## TrueVision3D v2.2.4  -  10-Mar-2026
### GPU Performance Overhaul — Profile Lines Pipeline Optimisation

**Overview**
- Diagnosed and resolved sustained 100% GPU usage introduced by the v2.2.3 profile lines system.
- Root cause: the profile lines effect added two extra full-scene `renderer.render()` calls per frame (normal pass + profile colour pass), doubling the per-frame GPU workload from 2 to 4 scene renders.
- Implemented five targeted optimisations that reduce per-frame scene renders from 4 to 3, cut profile colour pass cost by ~75%, eliminate per-frame allocations, fix a render loop spin issue, and add a user-facing toggle.

**Depth Pre-Pass Elimination**
- Attached a `DepthTexture` to the normal render target so the normal pass writes depth as a side-effect.
- Fog and SSAO now read depth from the normal pass instead of a dedicated depth pre-pass render.
- `renderDepthPrePass()` becomes a no-op when profile lines are active, eliminating one full scene render per frame.
- Falls back to the original dedicated depth pre-pass when profile lines are disabled.

**Half-Resolution Profile Colour Buffer**
- Profile colour render target now created at 50% viewport dimensions (quarter the pixel count).
- The profile colour buffer only carries edge tint information; full resolution is unnecessary.
- `setSize()` updated to maintain half-res on window resize.

**Pre-Allocated Material Swap Cache**
- `cachedOriginalMaterials` is now a pre-allocated `Array` sized during `rebuildSceneCache()`.
- Per-frame material swap uses index-based `for` loops writing into fixed array slots instead of creating `{ object, material }` pairs every frame.
- Eliminates all per-frame heap allocations in the profile lines hot path.

**Orbit Controls Render Loop Fix**
- Added a 3-frame trailing budget after the orbit `end` event.
- Previously, `controls.update()` could return `true` after the user stopped interacting, keeping the render loop spinning indefinitely.
- The loop now renders the trailing frames then stops, dropping GPU usage to near-zero when idle.

**Profile Lines Toggle**
- Added "Profile Lines" ON/OFF button to the Tools & Settings dropdown menu (alongside existing "Shadows" toggle).
- `toggleProfileLines()` disables both the shader pass and the pre-pass renders.
- Users can instantly halve per-frame GPU load by toggling profile lines off.

**Invalidation-Based Render Loop** (carried forward from v2.2.3 session)
- Replaced the unconditional `requestAnimationFrame` loop with an invalidation-based system.
- Frames are only scheduled when user interaction, animations, or explicit invalidation events require a redraw.
- Added `Na__RenderLoop__Invalidation.js` as a centralised event dispatcher for render requests.
- All UI controls (model toggles, storey toggles, group selector, door animations, walk mode) now dispatch render requests through the invalidation system.

**Config Adjustments**
- `RenderEffect__AmbientOcclusion__Samples` reduced from 16 to 8.
- `RenderEffect__AmbientOcclusion__CullDistanceMm` reduced from 12000 to 8000.
- `RenderEffect__AmbientOcclusion__BlurRadius` reduced from 1.2 to 1.0.
- Directional light shadow map resolution reduced from 2048 to 1024.
- Renderer pixel ratio cap reduced from 2.0 to 1.5.
- Fat line segments re-enabled frustum culling with computed bounding geometry.

**Files Added**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderLoop__Invalidation.js`

**Files Changed**
- `Index.html`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__MouseControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__IpadControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js`
- `02__Src__AppModules/30__System__ImageExport/Na__UiFeature__ImageExport__Controls.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.3  -  10-Mar-2026
### Profile Lines + Colour System — Aligned With ValeVision3D

**Overview**
- Ported ValeVision3D's profile line system and authored edge colour support into TrueVision so both apps render profile lines identically.
- Profile lines now use a profile colour buffer (meshes + linework in one pass), dynamic camera-distance edge width, and smoothstep blending.
- Linework model loader preserves glTF `COLOR_0` (SketchUp edge paint) into fat-line geometry with `vertexColors`.

**Profile Lines Module**
- Replaced `Na__RenderEffect__ProfileLines__.js` with ValeVision's current version.
- Adds `tProfileColor` buffer: meshes render with fallback colour, linework with vertex colours, in a single depth pass.
- Adds `collectMeshObjects` helper for mesh material swap during profile colour pass.
- Shader uses `smoothstep` for gradual edge transitions instead of hard threshold.
- `orbitTarget` parameter enables per-frame dynamic `u_edgeWidth` (thick when close, thin when far).

**Pipeline Setup**
- `Na__RenderPipeline__SetupComposer` now accepts `orbitTarget` as 7th parameter and forwards it to `ProfileLines__Create`.

**Model Loader — Authored Edge Colours**
- `Na__ModelLoader__LoadSingleLinework` extracts `node.geometry.attributes.color` (glTF `COLOR_0`) when present.
- Calls `fatLineGeometry.setColors(importedColors)` to carry vertex colours into fat-line geometry.
- Sets `vertexColors: !!importedColors` on `LineMaterial` so SketchUp edge paint is preserved.

**Config**
- Added `EdgeWidthMin`, `EdgeWidthMax`, `EdgeWidthDistanceNear`, `EdgeWidthDistanceFar` to `RenderEffect__ProfileLines`.
- Updated `EdgeWidth` to 0.25; values aligned with ValeVision tuned settings.

**Key Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.2  -  28-Feb-2026
### Selective HDR Reflections (Mirror + Glass) with Per-Material Tuning

**Overview**
- Implemented HDR environment reflections using `HdriSkydome__RuralLandscape__AutumnField__SunnyDay__4k__.hdr` without tinting the whole model.
- Fixed black mirror behavior by preserving indexed material PBR during mesh prep and applying reflection overrides after material swap.
- Added selective reflection controls so mirrors are strong/bright (and optionally blurred) while window glass remains subtle.

**Root Cause**
- A global scene environment assignment (`scene.environment`) pushed HDR colour influence across all PBR materials, causing an unwanted blue cast on non-reflective building surfaces.
- Mirror material intent could also be degraded during first-pass loader prep if indexed materials were flattened to whitecard roughness/metalness values before swap.

**Selective Reflection Solution**
- Added HDR load + PMREM pipeline in `Na__Scene__DefaultSceneLighting.js` that returns an environment texture and only applies globally when explicitly configured.
- Introduced mirror-only material override pass in `Na__MaterialsSystem__MaterialSwap.js`:
  - target by material name (`MAT140__Mirror__ClearDefault`),
  - apply env map + env intensity,
  - apply brightness boost,
  - apply optional roughness override for blurred reflections.
- Introduced glass override pass for subtle reflections:
  - target by material name (`MAT101__Glass__ClearDefault`),
  - apply low env intensity,
  - apply brightness multiplier to keep glass less bright.
- Updated loading flow in `Na__AppFlow__LoadingSequence.js` to run selective overrides immediately after library material swap.

**Config Additions (`Na__AppConfig__Main.json`)**
- `Scene__Environment__ApplyToScene` (bool) — keep false for selective-only mode.
- `Scene__Environment__MirrorOnly` (bool) — enables selective mirror pass.
- `Scene__Environment__MirrorMaterialName`
- `Scene__Environment__MirrorEnvMapIntensity`
- `Scene__Environment__MirrorBrightnessBoost`
- `Scene__Environment__MirrorRoughnessOverride` (blur control)
- `Scene__Environment__GlassEnabled`
- `Scene__Environment__GlassMaterialName`
- `Scene__Environment__GlassEnvMapIntensity`
- `Scene__Environment__GlassBrightnessMultiplier`

**Result**
- Mirrors now render reflective and controllable (brightness + blur), instead of dark/black.
- Window glass now reflects environment slightly while staying visually softer/dimmer.
- Non-mirror/non-glass materials remain neutral with no global HDR blue tint.

**Files Changed**
- `index.html`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.1  -  28-Feb-2026
### Model Group Switch State Rebind + Full Building Reset Consistency

**Overview**
- Fixed a state lifecycle regression where switching Design Phases replaced scene objects but left runtime systems bound to stale references.
- Resolved failures in storey toggles, floor isolate controls, and door interactions after model-group switching.
- Standardized `Show Entire Building` in both Storey Toggle and Floor Isolate as a true reset for the active model set.

**Root Cause**
- Group switching only reinitialized category model toggles.
- Storey visibility, floor isolate, door registry bindings, and walk collision meshes were initialized at startup only and not rebound to newly loaded model roots.

**Runtime Rebind Fix**
- Added a unified post-switch rebind path in `Na__AppFlow__LoadingSequence.js` (`Na__ReinitializeModelBoundSystems`).
- Model-group switches now reinitialize:
  - model category toggles,
  - storey view controls,
  - storey isolate controls,
  - door animation model bindings/registry,
  - walk mode collision meshes.
- Added `Na__DoorAnimation__RebindModelGroups()` in `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` so door registry can refresh safely on group switch without duplicating pointer listeners.

**Show Entire Building Reset Behavior**
- Added `Na__StoreySystem__ResetEntireBuilding()` in `3dObject__ViewBuildingStoreys__SystemLogic__.js`.
- Reset now guarantees:
  - all storeys visible,
  - roofs forced on,
  - all landscape groups visible.
- Updated both UI flows to use the same reset:
  - `Na__UiFeature__StoreyView__Controls.js` ("Show Entire Building")
  - `3dObject__IsolateBuildingStoreys__SystemLogic__.js` (`Na__StoreyIsolate__ShowEntireBuilding`)

**Stability Hardening**
- Added listener guards in reinitialized UI modules to prevent duplicate submenu handlers on repeated group switches:
  - `Na__UiFeature__ModelToggle__Controls.js`
  - `Na__UiFeature__StoreyView__Controls.js`
  - `Na__UiFeature__StoreyIsolate__Controls.js`

**Files Changed**
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js`

# ---------------------------------------------------------
## GLB Builder Utility v1.9.0  -  28-Feb-2026
### Component Instancing — 449 MB → 1 MB GLB Export Optimisation

**This entry documents an upstream SketchUp plugin change that directly benefits TrueVision3D load times and runtime performance. No TrueVision app code changes were required.**

**Result: >99% reduction in exported GLB file size on production architectural model.**

The GLB Builder Utility plugin (`Na__TrueVision__GlbBuilder__EngineCore__ComponentInstancing__.rb`) was extended with a full Component Instancing system. SketchUp "Components" (as distinct from "Groups") are shared-definition objects — editing one updates all. The exporter now respects this: instead of flattening every component instance into duplicated vertex data, each unique `ComponentDefinition` is written to the GLB binary buffer exactly once, and multiple glTF nodes reference it with per-instance transform matrices.

**Why TrueVision benefits automatically (zero code changes):**
- Three.js `GLTFLoader` automatically shares a single `BufferGeometry` instance in GPU memory when multiple nodes reference the same mesh index (confirmed Three.js issue #29768). No `InstancedMesh` required for the GPU memory savings.
- Material traversal in `Na__ModelLoader__MultiModel.js` operates per-node (`node.material.name`), not per-geometry, so all existing material cloning, PBR swap, and shadow setup work identically for instanced nodes.
- Walk mode collision, door animation (ADR entities excluded from instancing), storey visibility toggles — all operate by scene traversal and are unaffected by the new node structure.

**Future opportunity:** Converting shared-mesh node groups into `THREE.InstancedMesh` on load would reduce these to a single draw call per definition, delivering a further GPU render performance improvement on top of the memory savings already achieved.

# ---------------------------------------------------------
## TrueVision3D v2.2.0  -  27-Feb-2026
### Real-Time Screen-Space Ambient Occlusion (SSAO) System

**Overview**
- Implemented a fully custom real-time SSAO post-processing system for TrueVision3D that adds contact shadow detail at geometry junctions (wall-floor intersections, window reveals, ceiling corners).
- The effect is dynamic and view-dependent; not baked. It recalculates every frame using a hemisphere-sampled screen-space technique with noise rotation to break banding.
- Required a custom shader because Three.js built-in SAOPass/SSAOPass do not support `logarithmicDepthBuffer: true`, which TrueVision requires for its large architectural scenes.
- All config values use integer millimeters per project convention, converted at runtime via `Na__Math__ConvertMmToUnits`.
- User-facing language uses "Shadows" throughout since end users are architects, not graphics programmers.

**Architecture — Pipeline Integration**
- Two sequential ShaderPass instances are inserted into the EffectComposer:
  - `[RenderPass] → [ProfileLines] → [Fog] → [SSAO] → [AO Blur] → [FXAA]`
- **SSAO pass** reads the scene colour from `tDiffuse` and a separate depth texture from `tDepth`. Outputs sharp scene RGB with the AO factor stored in the alpha channel.
- **AO Blur pass** reads the SSAO output, blurs ONLY the alpha channel (5x5 gaussian), then composites: `sharpRgb * blurredAo`. This keeps geometry edges razor-sharp while smoothing noisy AO boundaries.

**Critical Technical Challenge — WebGL Feedback Loop**
- Initial implementation attached a `DepthTexture` to the EffectComposer's own `WebGLRenderTarget`. This caused `GL_INVALID_OPERATION: Feedback loop formed between Framebuffer and active Texture` because the ping-ponged RT was being read and written simultaneously.
- **Solution**: A dedicated depth pre-pass renders the scene into a separate `WebGLRenderTarget` with a `FloatType DepthTexture` before the EffectComposer runs. Both the fog and SSAO passes sample from this independent texture, eliminating the feedback loop entirely.

**Logarithmic Depth Buffer Inversion**
- Three.js writes `gl_FragDepth = log2(1.0 + w) / log2(far + 1.0)`.
- Custom inversion: `clipW = pow(cameraFar + 1.0, storedDepth) - 1.0`.
- View-space position reconstructed by building a ray through the pixel via the inverse projection matrix, scaled by the recovered clip-space W.

**Performance Optimisation**
- AO culling distance (`CullDistanceMm`) skips the expensive kernel loop for pixels beyond a configurable range, with a smooth fade-out over the last 20%.
- FPS-based auto-disable monitor samples frame rate after a warmup period. If below threshold, disables both passes and shows a user toast: "Shadows have been switched off to improve performance."
- `depthWrite=false` and `depthTest=false` on all ShaderPass materials to prevent depth buffer interference between passes.

**UI — Shadows Toggle**
- Added a "Shadows" ON/OFF toggle to the "Tools & Settings" dropdown menu.
- Toggle calls `pipeline.toggleAo()` which enables/disables both SSAO and blur passes in real time.
- A `na-ao-disabled` custom event keeps the toggle UI synchronised when the performance monitor auto-disables AO.

**Config (`Na__AppConfig__Main.json` → `RenderEffect__AmbientOcclusion`)**
- `Enabled` (bool), `RadiusMm` (50), `Intensity` (1.2), `Bias` (0.005), `Samples` (16)
- `CullDistanceMm` (10000), `BlurRadius` (1.2)
- `FpsThreshold` (24), `FpsSampleFrames` (120), `PerformanceMonitorStartupDelayMs` (3000)
- `DebugMode` — 0=off, 1=raw depth, 2=linear Z, 3=normals, 4=raw AO

**Files Added**
- `02__Src__AppModules/07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__.js`
- `02__Src__AppModules/07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__Shader.js`

**Files Changed**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `Index.html`
- `03__Style__AppStylesheets/Na__UiFeature__Styles__DropdownAndToast__.css`

# ---------------------------------------------------------
## TrueVision3D v2.1.1  -  27-Feb-2026
### Floor Isolate — Landscape Off + User Guide Isolation Notes

**Overview**
- Extended the new `Floor Isolate` workflow so it now disables landscape as well as roofs when isolating a storey.
- Added client-friendly documentation to the User Guide explaining the difference between `Storey Toggle` and `Floor Isolate`, including when each is useful.
- Preserved coexistence: both systems remain available for flexible model view control.

**Floor Isolate Logic Update**
- Updated `3dObject__IsolateBuildingStoreys__SystemLogic__.js` to:
  - Detect landscape groups from the same loaded model root used by storey models.
  - Cache current landscape visibility before isolate actions.
  - Force landscape visibility off during `Na__StoreyIsolate__IsolateSingleStorey(...)`.
  - Restore cached landscape visibility when `Na__StoreyIsolate__ShowEntireBuilding()` is used.
- Roof behavior remains unchanged from previous release: isolate mode forces roofs off.

**UI/UX Copy Update**
- Updated floor isolate button tooltip text in `Na__UiFeature__StoreyIsolate__Controls.js` to communicate that isolate mode now switches both roofs and landscape off.

**User Guide Content Update**
- Added a new section after the existing divider structure in `Na__UserInstructions__Content__.html`:
  - `Model Isolation Tools`
  - Plain-language explanations for:
    - `Storey Toggle` (custom multi-floor combinations)
    - `Floor Isolate` (single floor focus with roofs + landscape off)
    - `Show Entire Building` (quick reset)
- Reassigned `na-instructions-section--last` so the new isolation section is now the final section in the modal.

**Files Changed**
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`

# ---------------------------------------------------------
## TrueVision3D v2.1.0  -  27-Feb-2026
### User Instructions System — User Guide Modal Overlay

**Overview**
- Built a new User Guide system accessible from the Tools dropdown menu.
- Clicking "User Guide" (last item in the menu) opens a full-screen modal overlay listing all navigation controls for both PC and touchscreen users.
- The overlay covers Orbit Mode, Walk Mode, and Global Hotkeys with clear, explicit descriptions of each control gesture and mouse button action.
- System is fully self-contained in a new module folder with clean separation between menu hookup, logic, content, and styles.

**New Module: `02__Src__AppModules/75__System__UserInstructionsSystem/`**
- `Na__UiFeature__UserInstructions__MenuItem.js` — resolves `#naUserInstructionsToggle` from the DOM, collapses the Tools dropdown on click, and delegates to the open function. No cross-system imports.
- `Na__UserInstructions__SystemLogic.js` — builds the overlay/modal DOM structure at initialisation, fetches `Na__UserInstructions__Content__.html` via `fetch()` using `import.meta.url` for correct path resolution, and injects it into the modal. Handles all three close triggers: close button click, backdrop click, and `Escape` key. On touch devices, smooth-scrolls to the touchscreen section on open.
- `Na__UserInstructions__Content__.html` — standalone HTML fragment (no `<html>`/`<body>`) containing the full controls guide: Orbit Mode (PC mouse with explicit button + drag labels, touchscreen), Walk Mode (PC keyboard, PC mouse with pointer lock explanation, touchscreen), and Global Hotkeys.
- `Na__UiFeature__Styles__UserInstructions__.css` — full styles for the overlay backdrop (fixed, full-screen, fade transition), modal card (centred, max-width 680px, brand blue, scrollable), header with close button, section separators, group sub-labels ("PC — Keyboard", "Touchscreen", etc.), control key badge pills, and responsive stacking for narrow viewports.

**`index.html` changes**
- Added "User Guide" `<li>` as the last item in the Tools dropdown (after Design Phase).
- Imported `Na__UiFeature__InitializeUserInstructionsMenuItem` and `Na__UserInstructions__Initialize` / `Na__UserInstructions__Open`.
- Added `await Na__UserInstructions__Initialize(Na__Device__UseTouchControls)` and `Na__UiFeature__InitializeUserInstructionsMenuItem(Na__UserInstructions__Open)` in the Engine Entry Points region.
- Renamed "Storey View" menu label to "Storey Toggle".

**`03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` changes**
- Added `@import` for `Na__UiFeature__Styles__UserInstructions__.css` from the new module folder.

**Files Added**
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__UserInstructions__MenuItem.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__Styles__UserInstructions__.css`

**Files Changed**
- `index.html`
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`

# ---------------------------------------------------------
## TrueVision3D v2.0.9  -  27-Feb-2026
### Orbit Mode — Landscape Floor Collision Guard

**Overview**
- Diagnosed and fixed the ability to orbit the camera below the landscape plane in orbit mode.
- The camera could be dragged in a full 180° arc around the orbit target, passing through the ground and emerging underground looking up at the building underside.
- Implemented a world-space camera Y floor guard that runs every frame in the navigation update loop, preventing the camera from descending below a configurable minimum world height regardless of input source.

**Root Cause Analysis**
- Three.js `OrbitControls` defaults `maxPolarAngle` to `Math.PI` (180°), allowing the camera to orbit from directly above the target all the way to directly below it.
- No polar angle or world-height constraint was set anywhere in the orbit control setup.
- All orbit input paths (mouse drag, pinch-to-zoom pan, WASD Q-key) were unrestricted.
- A `maxPolarAngle` approach was evaluated but discarded — it constrains angle relative to the orbit target position, not the world floor, so it conflicts with OrbitHelperCube placement at varying heights and breaks saved camera restoration.

**Fix — World-Space Camera Y Floor Guard**
- Added `Navmode__MouseControls__OrbitMinCameraYMm: 0` and `Navmode__IpadControls__OrbitMinCameraYMm: 0` to both `Na__AppConfig__Main.json` and `TestEnv__SubAppData__Config.json`.
- In `Na__DefaultNavmode__MouseControls.js` and `Na__DefaultNavmode__IpadControls.js`, the `updateNavigation` function now clamps `camera.position.y` to `minCameraYUnits` after every `controls.update()` call, followed by a second `controls.update()` to re-sync internal state.
- The guard is world-space (absolute Y ≥ configured floor), independent of orbit target position and OrbitHelperCube placement.
- Setting `OrbitMinCameraYMm` to `null` or omitting it disables the guard entirely.
- `index.html` passes `minCameraYMm` through in both the mouse and iPad nav config payloads.

**Files Changed**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__MouseControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__IpadControls.js`
- `index.html`

# ---------------------------------------------------------
## TrueVision3D v2.0.8  -  27-Feb-2026
### Camera Mode Transition — Spatial Continuity Fix

**Overview**
- Diagnosed and fixed the position discontinuity when switching between orbit and walk modes.
- Orbit-to-walk spawned the user far from where they were looking due to ground-snap dropping the camera from elevation, and the inherited orbit pitch pointing at the floor.
- Walk-to-orbit discarded the walk exploration and teleported back to the pre-walk orbit snapshot.
- Created a dedicated transition module (`Na__Navmode__ModeTransition.js`) to own all switching logic, keeping it cleanly separated from the two mode systems.

**Root Cause Analysis**
- Orbit-to-walk: capsule X/Z was placed at the orbit camera position (correct), but ground-snap caused a large Y drop, and the full orbit pitch was inherited rather than clamped — resulting in the user staring at the floor.
- Walk-to-orbit: `Na__WalkMode__Deactivate` unconditionally restored a stale pre-walk snapshot, discarding everything the user had explored.
- The OrbitHelperCube target must never be modified during any transition — it is the authoritative architectural pivot set at load time.

**New Module: `Na__Navmode__ModeTransition.js`**
- `Na__ModeTransition__OrbitToWalk(orbitControls, maxEntryPitchDeg, entryForwardNudgeMm)`:
  - Delegates to `Na__WalkMode__Activate` (saves orbit state, ground-snaps capsule, extracts yaw/pitch).
  - Clamps the inherited pitch to `MaxEntryPitchDeg` (default 30°) so the user enters looking level rather than at the floor.
  - Nudges the capsule forward by `EntryForwardNudgeMm` along the camera yaw direction to compensate for the orbit camera being pulled back from the scene at orbit distance.
- `Na__ModeTransition__WalkToOrbit(camera, orbitControls)`:
  - Reads the saved orbit state from `Na__WalkMode__GetSavedOrbitState()`.
  - Computes a new orbit camera position at the same distance and elevation from the OrbitHelperCube target, but rotated so the camera faces the target from the direction of the user's current walk position.
  - Passes this as `overrideCameraPosition` to `Na__WalkMode__Deactivate` — orbit target and FOV are always restored from saved state and never modified.

**`Na__Navmode__WalkMode__SystemLogic.js` additions**
- `Na__WalkMode__ClampEntryPitch(maxRad)`: clamps `Na__WalkMode__CameraPitch` to ±maxRad and immediately updates the camera quaternion.
- `Na__WalkMode__NudgeCapsuleForward(distanceUnits)`: moves capsule forward along the current yaw direction, re-detects ground at new position, updates camera.
- `Na__WalkMode__GetSavedOrbitState()`: returns a read-only copy of the pre-walk orbit snapshot for use by the transition module.
- `Na__WalkMode__Deactivate` updated to accept an optional `overrideCameraPosition` (Vector3) — when provided the orbit camera is placed there; orbit target and FOV always restore from saved state.
- All new functions added to module exports.

**`Na__UiFeature__WalkModeControls.js` updates**
- Imports `Na__ModeTransition__OrbitToWalk` and `Na__ModeTransition__WalkToOrbit` from new module.
- Direct `Na__WalkMode__Activate` / `Na__WalkMode__Deactivate` calls replaced with transition module calls.
- Stores camera ref, `MaxEntryPitchDeg`, and `EntryForwardNudgeMm` from config at init time.

**`Na__AppConfig__Main.json` additions (`Navmode__WalkMode` section)**
- `Navmode__WalkMode__MaxEntryPitchDeg`: 30 — maximum inherited orbit pitch (degrees) when entering walk mode.
- `Navmode__WalkMode__EntryForwardNudgeMm`: 5000 — forward nudge applied on walk mode entry to bring spawn point closer to the viewed scene (mm, converted to 3JS units via `Na__Math__ConvertMmToUnits`).

**Notes**
- The OrbitHelperCube system is completely unaffected — `controls.target` is always restored from the saved OrbitHelperCube value, never derived from walk position.
- Forward nudge direction uses the same `(0,0,-1)` + yaw rotation convention as `Na__WalkMode__ProcessMovement` (W key forward).
- All new values in AppConfig are integer millimeters per project convention, converted at runtime.

# ---------------------------------------------------------
## TrueVision3D v2.0.7  -  27-Feb-2026
### Export Image — Loading Spinner + Readback Performance Fix

**Overview**
- Added a loading spinner overlay to the "Download Image" export button, matching the existing UX pattern used by the "Send to Drawing Document" (layout view) button.
- Fixed a browser performance warning caused by calling `getImageData` on canvas contexts that were not created with `willReadFrequently: true`.

**Loading Spinner (`Na__UiFeature__ImageExport__Controls.js`)**
- Export button click handler rewritten to match the layout view overlay pattern exactly.
- Added `exportInProgress` guard to prevent double-click during render.
- Added `is-loading` class to dim the button during export.
- Reuses the existing shared `#naLayoutLoadingOverlay` / `#naLayoutLoadingStatus` DOM elements and `na-layout-loading-overlay` CSS modifier classes — no new HTML or CSS required.
- Double-`requestAnimationFrame` defer ensures the overlay paints before the blocking render call executes.
- On completion: status updates to `"Image Downloaded!"` (green success state), overlay fades out after 2 seconds, button and guard reset.

**Canvas Readback Fix (`Na__ImageExport__PostProcessEffects__HighPassSharpen.js`)**
- Both `getContext('2d')` calls in `Na__PostProcess__ApplyHighPassSharpen` now pass `{ willReadFrequently: true }` to match the browser's recommended hint for canvases that call `getImageData` multiple times.
- Resolves the `Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true` console warning.

# ---------------------------------------------------------
## TrueVision3D v2.0.6  -  27-Feb-2026
### Save Camera Persistence + Targeted CDN Sync (Localhost)

**Overview**
- Fixed the localhost `Save Camera Settings` flow so camera coordinates now persist into the active project's `TrueVision__ProjectData__.json`.
- Added confirm-driven targeted CDN upload for the same project via ProjectVision's existing R2 sync tooling.
- Follow-up refactor applied to keep the save module closer to Noble modular style with purer helper functions and clearer region grouping.

**Root Cause**
- The button flow called `GET/POST /api/projects/<projectCode>`, but the local ProjectVision server did not expose that API route initially.
- CORS on local server only allowed `GET/OPTIONS`, so save requests could not complete as intended.
- During validation, duplicate local Flask instances on the same port caused stale 404 behavior until processes were deduplicated.

**Local Server API Fixes (`na-apps/ProjectVision__LocalServer__Main__.py`)**
- Added CORS `POST` support.
- Added `GET/POST /api/projects/<project_code>` for project JSON read/write.
- Added robust project-path resolution using:
  - URL/body context (`project-folder`, `year`)
  - fallback scan by project code under `na-project-portal/*-Projects/*/30__TrueVision__AppContent/TrueVision__ProjectData__.json`
- Added `POST /api/projects/<project_code>/sync-cdn` endpoint for one-project CDN upload.

**CDN Sync Integration (`na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py`)**
- Extended `run_r2_sync(...)` with optional `auto_confirm_upload` parameter.
- Preserved default CLI behavior (interactive confirmation) while enabling non-interactive server-triggered sync after browser-side confirmation.

**Save Module Updates (`Na__UiFeature__SaveCameraSettings.js`)**
- Save flow now passes `project-folder` and `year` to local API.
- Added confirm prompt before CDN upload after local save success.
- Refactored to smaller helpers for readability and purity:
  - context/query/url builders
  - pure project-data merge transform
  - isolated fetch/save/sync API wrappers
  - thin orchestration in main save function

**Validation Notes**
- Local API probe confirmed `GET /api/projects/NP03?project-folder=NP03__AshnessClose&year=26` resolves and returns project data.
- Save button now updates local `TrueVision__ProjectData__.json` and can trigger targeted CDN sync for the same project.
- No linter errors introduced in touched JS/Python files.

# ---------------------------------------------------------
## TrueVision3D v2.0.5  -  27-Feb-2026
### Main-App Material Preservation + Transparency Parity Fix

**Overview**
- Fixed main-app material pipeline so indexed GLB materials survive initial mesh loading and can be swapped by the Materials System.
- Resolved mismatch where test environment rendered transparent materials (e.g. windows) correctly, but main app could lose material identity before swap.
- Added focused diagnostics to confirm indexed material detection and swap coverage during runtime.

**Root Cause**
- In `Na__ModelLoader__MultiModel.js`, mesh materials were being replaced too aggressively during first-pass loading, which could remove indexed `MAT###__...` names needed by the second-pass material swap.
- `Na__MaterialsSystem__MaterialSwap.js` depends on indexed material names to look up PBR configs from `Na__AppConfig__MaterialsLibrary.json`; once names were lost, transparent glass configs could not be applied.

**Main Loader Fix (`Na__ModelLoader__MultiModel.js`)**
- Refactored `Na__ModelLoader__LoadSingleMesh` to preserve and clone existing GLB materials by default.
- Tightened white fallback behavior: fallback now applies only to missing/invalid material slots (instead of broad non-textured replacement).
- Preserved array material handling (`Array.isArray(node.material)`) so all material slots are processed consistently.
- Kept base mesh prep behavior (double-sided + polygon offset + textured emissive/roughness tuning) without discarding material identity.

**Diagnostics Added**
- Loader summary per mesh GLB:
  - `materials=<count>, indexed=<count>, whiteFallback=<count>`
- Material swap summary per processed group:
  - `IndexedSeen=<count>, Swapped=<count>, IndexedMissing=<count>, UniqueSwapped=<count>`

**Validation Notes**
- Main app runtime now reports non-zero indexed detection and non-zero swaps for relevant model groups, including window groups.
- `IndexedMissing=0` observed for swapped indexed groups during validation run.
- No lint errors introduced in modified JS modules.

# ---------------------------------------------------------
## TrueVision3D v2.0.4  -  27-Feb-2026
### Localhost Dev Menu Split + Navigation Mode Status UX

**Overview**
- Split tools into client-facing and localhost-only menu scopes so live builds remain client-safe while local builds expose developer controls.
- Added explicit dual-mode status UX (`Walk Mode` / `Orbit Mode`) with mutually exclusive Active states.
- Moved camera lens/FOV control into the Export tools section.
- Updated local server behavior to canonicalize mixed-case entrypoints (`Index.html` -> `index.html`) to prevent stale/incorrect page variants during local testing.

**Main UI Menu Changes (`index.html`)**
- Client-facing `Tools` order now follows:
  - `Walk Mode`
  - `Orbit Mode`
  - `Export Image` (includes Lens Width/FOV slider)
  - `Storey View`
  - `Design Phase`
- Added left-side `Dev Tools` menu container (hidden by default) containing:
  - `Toggle Model Layers`
  - `Save Camera Settings`

**Localhost-Only Dev Menu**
- Added `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__DevMenu__LocalhostOnly.js`.
- Dev menu visibility is gated by `Na__AppUtils__IsRunningOnLocalhost()`.
- Main runtime now initializes dev menu visibility via `Na__UiFeature__InitializeLocalhostDevMenu()`.

**Navigation Mode Status UX**
- Added Orbit mode button/status in main menu.
- Implemented shared mode-status updater so exactly one mode is Active at a time:
  - Startup defaults to Orbit Active.
  - Enabling Walk sets Walk Active / Orbit Off.
  - Disabling Walk sets Walk Off / Orbit Active.

**Lens/FOV in Export**
- Lens slider/value UI moved from top-level menu item into the Export panel.
- `Na__UiFeature__CameraLens__Controls.js` updated so lens initialization no longer requires a dedicated top-level lens toggle button.

**Server Routing Reliability (Local Dev)**
- Updated `na-apps/ProjectVision__LocalServer__Main__.py`:
  - Added case-insensitive path resolution helper.
  - Canonicalized requests for `.../Index.html` to `.../index.html` when available.
  - Updated printed TrueVision test URL to lowercase `index.html`.
- Updated `na-apps/ProjectVision__LocalServer__Main__.bat` startup notes to reflect new canonicalization behavior.

**Notes**
- Follow-up cleanup pass performed to trim non-essential inline logic additions in `index.html` while preserving behavior.

# ---------------------------------------------------------
## TrueVision3D v2.0.3  -  27-Feb-2026
### Feature Integration Sprint: Storey, Walk Mode, Doors, Materials

**Overview**
- Integrated prototype features from the test environment into the main TrueVision3D app: building storey visibility, Walk Mode navigation, door click-to-open and proximity-to-open, and auto materials swap.
- Resolved structural mismatches between the test env (separate mesh/linework groups per GLB) and the main app (combined category groups with mesh + linework children).
- Simplified the test environment by replacing duplicated logic with calls to shared main-app modules.

**Building Storey System**
- Moved storey visibility from prototype to main app; added dropdown menu section for storey toggles.
- Fixed `Na__ModelLoader__MultiModel.js` regex to correctly parse `Storey__` prefixed model URLs into categories (e.g. `Storey__GroundFloor__ProposedDoors`).
- Test env now calls shared `Na__UiFeature__InitializeStoreyViewControls` instead of duplicating UI code.

**Walk Mode Navigation**
- Integrated Walk Mode into main app with dropdown toggle, status badge, and hotkey.
- Fixed `Na__Navmode__WalkMode__SystemLogic.js`: set `Raycaster.camera` during init so `LineSegments2` objects (linework) can be raycast for collision without crashing.

**Door Animation (Click-to-Open + Proximity)**
- Door systems require **separate** mesh and linework groups: Phase 1 scans mesh groups for ADR assemblies; Phase 2 scans linework groups and links them to existing records. Passing the same combined group as both corrupted the registry.
- Main app fix: tag mesh/linework scene roots with `userData.Na__ModelType` in `Na__ModelLoader__MultiModel.js` (both priority-order and **unordered** load paths; Storey models use the unordered path).
- Loading sequence: extract tagged children from each `ProposedDoors` category group; fallback to child index (mesh=0, linework=1) when tags are absent (e.g. cached loader).
- Added shared `Na__DoorAnimation__FindDoorGroups.js` for test env reuse.

**Test Environment Simplification**
- Replaced duplicated lighting setup with `Na__Scene__SetupDefaultSceneLighting()`.
- Replaced duplicated door-finding logic with `Na__DoorAnimation__FindDoorGroups()`.

**Takeaways**
- Main app multi-model loader has two paths: priority order (Landscape, etc.) and unordered (Storey categories). Both must tag scene roots for downstream consumers.
- Fallback strategies (e.g. child index when tags missing) improve resilience against caching and deployment lag.

# ---------------------------------------------------------
## TrueVision3D v2.0.2  -  27-Feb-2026
### Core Codebase Modularization (PlanVision-Aligned Structure)

**Overview**
- Reorganized the TrueVision runtime modules to align with PlanVision-style modular architecture and numbered folder ordering.
- Completed a full source path migration and reference rewrite across runtime code, test environment, config files, and key technical docs.
- Performed final path-integrity validation to confirm module imports and stylesheet links resolve correctly after the restructure.

**Folder Structure Migration**
- Moved all legacy `src__*` module folders into `02__Src__AppModules` and removed `src__` folder prefixes.
- Moved stylesheets from `src__Styles` to `03__Style__AppStylesheets`.
- Introduced numeric folder ordering for module priority and readability:
  - `01__AppCore`, `02__AppData`, `03__AppUtils`, `04__MathUtils`, `05__RenderPipeline`, `06__Scene__LightingEffects`, `07__Scene__EnvironmentEffects`, `10__NavigationAndCameras`, `11__CameraUtils`, `15__ModelLoader`, `20__System__MaterialsSystem`, `26__System__ToggleModelElements`, `30__System__ImageExport`, `90__System__PageLayoutSystem`, `25__System__3dObject__InteractionSystem`, `26__System__ToggleModelElements`.

**AppCore / AppData Separation**
- Consolidated core orchestration scripts under `02__Src__AppModules/01__AppCore`:
  - `Na__AppFlow__LoadingSequence.js`
  - `Na__AppConfig__Loader.js`
- Moved app configuration data into `02__Src__AppModules/02__AppData`:
  - `Na__AppConfig__Main.json`
  - `Na__AppConfig__MaterialsLibrary.json` (+ related data JSON assets)
- Updated config loader fetch path to load from `02__AppData`.

**Reference Rewiring**
- Updated module imports in `index.html` to point to the new numbered module locations.
- Updated internal JS relative imports between moved modules.
- Updated test sandbox imports and config references in:
  - `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`
  - `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- Updated relevant `.cursor` rule path references to new AppData location.

**Validation and Fixes**
- Resolved one malformed stylesheet import in `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Styles__Main__.css`.
- Final validation checks completed:
  - JS relative import resolution: **PASS** (`MISSING_JS_IMPORTS=0`)
  - `index.html` local `src`/`href` references: **PASS** (`MISSING_INDEX_LINKS=0`)
  - CSS `@import` local path resolution: **PASS** (`MISSING_CSS_IMPORTS=0`)

# ---------------------------------------------------------
## TrueVision3D v2.0.1  -  27-Feb-2026
### Branding Migration Baseline (ValeVision -> TrueVision)

**Overview**
- Began the formal migration baseline from legacy ValeVision naming to TrueVision naming across runtime modules and core project documents.
- Updated primary app and layout branding assets to use Noble Architecture common-assets web URLs.
- Replaced major legacy branding strings in active code paths and prepared compatibility bridges where legacy project data keys may still exist.

**Branding and Logo Updates**
- Updated main app branding in `index.html`:
  - Noble Architecture logo URL in header.
  - Noble Architecture favicon URL(s).
  - Runtime UI text moved to TrueVision naming.
- Updated `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Layout__.html`:
  - Noble Architecture logo URL in layout header.
  - Noble Architecture favicon URL(s).

**Codebase Naming Updates**
- Performed broad naming migration across active project files:
  - `ValeVision3D` -> `TrueVision3D`
  - `ValeVision` -> `TrueVision`
  - `Vale Garden Houses` -> `Noble Architecture`
- Renamed key legacy-named documentation files to TrueVision equivalents.

**Compatibility Safeguards**
- `02__Src__AppModules/03__AppUtils/Na__AppUtils__ProjectLoader.js` now supports both new `trueVision_*` keys and legacy `valeVision_*` keys when extracting model URLs.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` now accepts `trueVision_Camera__DefaultPosition` with fallback to legacy `valeVision_Camera__DefaultPosition`.
- `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js` now removes both `trueVision_*` and `valeVision_*` legacy camera blocks before saving canonical camera payload.

**Supporting Updates**
- Cleaned internal legacy naming in `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.py` (`VALEVISION_ROOT` -> `TRUEVISION_ROOT`).
- Fixed malformed logo URL in `10__DistributionEmails/Distro__InviteEmailEmbedCard__TrueVision3D.html`.

# ---------------------------------------------------------
## LEGACY ValeVision v1.9.7  -  27-Feb-2026
### Stylesheet Naming Standardization 

**Overview**
- Standardized stylesheet naming to the project namespace pattern (`Na__<DomainOrModule>__Styles__<FeatureOrScope>__.css`) for improved maintainability and clearer ownership by module.
- Updated stylesheet link/import wiring across main app, Page Layout System, and Test Environment to match renamed files.
- Removed all remaining Babylon/BABYLON engine references from TrueVision3D runtime/docs.
- Ported legacy `src__GenerateObjects` helper modules from Babylon APIs to Three.js-compatible utility modules.

**Stylesheet Refactor**
- Renamed `src__Styles` files to namespaced equivalents (Core UI, UiFeature, ImageExport scopes).
- Renamed Page Layout stylesheet to `Na__PageLayoutSystem__Styles__Main__.css`.
- Renamed Test Environment stylesheet to `Na__TestEnv__Styles__PrototypeSandbox__.css`.
- Updated `index.html`, Page Layout HTML, and TestEnv HTML to point at new stylesheet names.
- Updated `Na__CoreUi__Styles__Index__.css` import list to new filenames while preserving import order.


