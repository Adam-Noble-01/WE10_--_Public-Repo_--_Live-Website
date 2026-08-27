# TrueVision3D Development Log
# =========================================================

# ---------------------------------------------------------
## TrueVision3D v2.8.0  -  27-Aug-2026
### Full Screen Mode - Menu Toggle and Startup Invitation

Full screen is now a first-class viewing mode. A toggle sits at the bottom of
the Tools & Settings menu, and a single invitation card recommends full screen
once the model has finished loading.

**Tools & Settings toggle:**
- New `Full Screen` row below `Profile Lines`, following the same
  `na-walk-mode__toggle` pattern as `Shadows` and `Profile Lines`.
- The ON/OFF badge, the active highlight, `aria-pressed` and the tooltip are
  all driven from the browser `fullscreenchange` event rather than from the
  click, so the row stays correct however the user leaves full screen -
  including the Escape key, which is never intercepted.
- The expand/collapse arrow icon swaps with the state, so the row reads
  correctly in both directions.
- This row is the route out of full screen for touch-screen devices, which
  have no Escape key.

**Startup invitation:**
- `Better in Full Screen` card fades in 700 ms after `na-app-scene-ready`,
  explaining the benefit and - before the user commits - how to leave again:
  Escape on desktop, the Tools & Settings row on tablets and phones.
- The Fullscreen API only accepts a real user gesture, so the card carries the
  click the browser requires; the app can never switch itself over.
- Dismissed via `Go Full Screen`, `Not Now`, the backdrop, or Escape. Once
  dismissed it is suppressed for the rest of the browser session, so a refresh
  mid-review does not nag. A fresh visit offers it again.
- Card height is capped against the dynamic viewport with the body scrolling,
  so the action buttons stay reachable on landscape phones.

**Compatibility and rendering:**
- Feature-detected. Where element full screen is unavailable - notably Safari
  on iPhone, which only supports it for video - the menu row is hidden and the
  card is never built, rather than offering a dead control.
- Every state change forces a `resize` after the viewport settles, so the
  renderer, composer, depth pre-pass, AO, profile lines and FXAA render targets
  all pick up the new dimensions. Browsers fire `resize` themselves on a full
  screen transition but the timing is inconsistent.
- `na-fullscreen-state-changed` is dispatched for any module that needs it.

**Changed Files**
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__FullscreenMode__SystemLogic.js`
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__FullscreenMode__Prompt.js`
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__Styles__FullscreenMode__.css`
- MOD `Index.html` - Full Screen menu row, module imports, initialisation
- MOD `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` - stylesheet import
- MOD `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` - dispatches `na-app-scene-ready`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json` - documents Escape as the full screen exit
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html` - Full Screen User Guide section

# ---------------------------------------------------------
## TrueVision3D v2.7.8  -  10-Jul-2026
### Exterior Double Doors — Independent Leaf Animation

Added explicit independent animation for exterior double-door ADRs while
preserving the established lockstep behavior for every existing product.

**Classification and compatibility:**
- `ADR` names containing `ExteriorDoubleDoor` are independently coupled when
  `IndependentPanelsEnabled` is true.
- Bifold `ROT_MVE` structures, `InteriorDoor`, `BifoldDoor`, `SlidingDoor`, and
  unknown legacy ADRs remain lockstep. Two `ROT_ONLY` panels alone never opt in.
- ADR-level state/progress/timing fields remain compatibility aliases of the
  primary panel. External whole-door callers retain `Na__DoorAnim__ToggleDoor`.

**Interaction and proximity:**
- Raycast hits resolve through the nearest MOD ancestor, pairing mesh and
  linework branches to one panel descriptor.
- Each independent panel owns state, progress, timing, easing, and
  mid-animation reversal.
- Walk/Fly proximity measures paired ROT world positions and applies one
  near/far state to both leaves of an unfixed pair. Orbit clicks remain
  independent; assemblies containing a FIXED leaf retain nearest-leaf behavior.

**Configuration and testing:**
- Added `IndependentPanelsEnabled` and
  `IndependentPanelAdrNameTokens: ["ExteriorDoubleDoor"]` to production and
  prototype-sandbox config.
- Updated door-animation technical documentation and the sandbox test matrix.

**Changed Files**
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js`
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- MOD `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- MOD `80__Testing__PrototypeEnvironment/TestEnv__README__.md`

# ---------------------------------------------------------
## TrueVision3D v2.7.7  -  22-Jun-2026
### DataLib v1.4.0 — Discussion Marker Materials (MAT012–014)

Three new `MAT010__ModelingUtilitySeries__` materials added to the DataLib SSOT (`Na__DataLib__CoreIndex__Materials__.json`) for flagging conceptual elements during client presentations.

**New materials:**
- `MAT012__DiscussionMarker__Red` — vivid red semi-transparent overlay (`rgb(220, 55, 55)`)
- `MAT013__DiscussionMarker__Green` — vivid green semi-transparent overlay (`rgb(55, 200, 75)`)
- `MAT014__DiscussionMarker__Yellow` — vivid amber-yellow semi-transparent overlay (`rgb(230, 200, 30)`)

**Material properties (all three):**
- `Opacity: 0.35`, `Transparent: true` — clearly visible but geometry beneath reads through
- `IsDoubleSided: true` — correct for painted box volumes (no inverted-face issues)
- `DepthWrite: false` — correct transparency sorting against other scene geometry
- `PbrRoughness: 1.0`, `PbrMetallic: 0.0`, `EnvMapIntensity: 0.0` — fully matte, no reflections
- `AoExclude: true` — placed on Three.js layer 1; SSAO depth pre-pass and profile lines normals pass both skip layer 1, so these volumes generate no AO halos and no profile line edges

**No TrueVision code changes required.** All properties (`Transparent`, `IsDoubleSided`, `DepthWrite`, `AoExclude`) are already fully wired in `Na__MaterialsSystem__MaterialSwap.js`. The layer 1 exclusion mechanism in `Na__RenderPipeline__PostProcessing__Setup.js` covers both AO and profile lines simultaneously.

**Usage workflow:**
1. In SketchUp, paint any box/volume with `MAT012__DiscussionMarker__Red`, `__Green`, or `__Yellow`
2. Export GLB via the GLB Builder — material name is preserved exactly
3. Load in TrueVision — material swap pass matches the name, applies the transparent PBR material automatically

**Changed Files**
- UPDATED `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — bumped to v1.4.0, added MAT012–014

---

# ---------------------------------------------------------
## TrueVision3D v2.7.6  -  22-Jun-2026
### Hotkeys System — Central Config-Driven View Mode Shortcuts

Introduced a complete hotkeys system replacing the previously scattered and hardcoded `Alt+Shift+W` / `Alt+Shift+F` keyboard shortcuts. All key bindings are now defined in a single JSON config file and propagate automatically to every user-facing surface.

**New keys:**
- `1` — Switch to Orbit mode
- `2` — Switch to Walk mode (gated by per-model enabled flag)
- `3` — Switch to Fly mode (gated by per-model enabled flag)
- `4` — Toggle Animation Views (saved scene carousel)
- `0` — Reset View to project start position

**Architecture:**
- NEW `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json` — single source of truth for all hotkey bindings, display labels, and reference documentation for movement/UI keys.
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__Hotkeys__Manager.js` — single `window` keydown listener; reads keys from config; routes to action callbacks; exports `Na__Hotkeys__ApplyUiLabels` which propagates key labels to toolbar tooltips, navigation help panel rows (`data-na-hotkey-row`), and user instructions items (`data-na-hotkey-item`).
- `Na__AppConfig__Loader.js` — added `Na__AppConfig__LoadHotkeysConfig()` to fetch the new config file.
- `Na__UiFeature__WalkModeEventListeners.js` — `Na__UiFeature__InitializeWalkModeHotkey` deprecated (no-op). Button wiring function retained.
- `Na__UiFeature__FlyModeEventListeners.js` — `Na__UiFeature__InitializeFlyModeHotkey` deprecated (no-op). Button wiring function retained.
- `Na__AppConfig__Main.json` — `Global__Hotkeys` block removed; superseded by `Na__AppConfig__Hotkeys.json`.
- `Na__UserInstructions__SystemLogic.js` — `Na__UserInstructions__Initialize` now accepts an optional `onContentLoaded(modal)` callback invoked after HTML content injection, enabling hotkey labels to be applied to the dynamically loaded overlay.
- `Na__UserInstructions__Content__.html` — Global Hotkeys section renamed "View Mode Shortcuts"; all five actions listed with `data-na-hotkey-item` attributes populated at runtime. Walk/Fly intro text updated.
- `Index.html` — hotkey wiring block replaced with `Na__Hotkeys__Initialize(actionMap, config)`; `Na__Hotkeys__ApplyUiLabels` called once at startup and again via `Na__UserInstructions__Initialize` callback. Navigation toolbar buttons gain hotkey-suffixed tooltips (e.g. `Orbit mode (1)`). Navigation help panel rows updated with `data-na-hotkey-row` attributes for all five actions.

**Changed Files**
- NEW `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json`
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__Hotkeys__Manager.js`
- MOD `02__Src__AppModules/01__AppCore/Na__AppConfig__Loader.js`
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeEventListeners.js`
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeEventListeners.js`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js`
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`
- MOD `Index.html`


# ---------------------------------------------------------
## TrueVision3D v2.7.5b  -  22-Jun-2026
### Dev Menu — Per-Scene Layer Switch Timing Toggle

Per-scene control over when saved model visibility is applied during animated transitions.

- New dev-menu checkbox on each Presentation Mode scene: **Switch layers before camera move**.
- Default (unchecked): layers switch **after** the camera arrives at the scene position (current behaviour).
- When enabled: layers switch **before** the camera move begins (useful for dolls-house / isolate views).
- Persisted per scene as `PresentationMode__Scene__ApplyVisibilityBeforeCamera` in `TrueVision__ProjectData__.json` (R2). Key omitted when false to keep JSON lean.

**Changed Files**
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneEditor.js` (checkbox row + save).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (respect per-scene flag).
- MOD `03__Style__AppStylesheets/Na__PresentationMode__Styles__SceneCarousel__.css` (checkbox row styling).


# ---------------------------------------------------------
## TrueVision3D v2.7.5a  -  22-Jun-2026
### Fix — Scene Visibility Restore + Natural Transition Timing

Follow-up fixes to the v2.8.0 scene visibility capture, addressing two issues reported in testing.

**Fix 1 — Hidden layers never restored when returning to a "show all" scene.**
- Root cause: scene apply only re-applied the categories/storeys present in a snapshot, so any element hidden by a previous scene (or a scene with a missing/partial block) lingered as hidden.
- `Na__PmVisibility__ApplyState` now resets to a **fully-visible baseline first** (entire building + all category groups), then applies the scene's saved state. Each scene is now authoritative and idempotent — exactly like SketchUp scene tags. A scene with no block now shows the whole model.
- New baseline helper `Na__ModelToggle__SetAllCategoriesVisible` (exported) plus reuse of `Na__StoreySystem__ResetEntireBuilding`.

**Fix 2 — Layers switched immediately on scene click (jarring).**
- Animated transitions now apply the saved visibility **after** the camera has finished moving to the new scene position, rather than at the start. The instant (default-scene) path is unchanged.

**Changed Files**
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` (`SetAllCategoriesVisible` baseline helper + export).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Visibility__StateCapture.js` (reset-to-full baseline before apply).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (apply visibility on transition complete, not start).


# ---------------------------------------------------------
## TrueVision3D v2.7.4  -  21-Jun-2026
### Dev Menu — Per-Project View-Mode FOV Overrides + Scene Visibility Capture

Two new Presentation/Dev-mode capabilities, both persisted per-project to R2 and preserved by the build pipeline.

**Feature 1 — Default View-Mode FOV Overrides.**
- New localhost Dev Tools panel "Default View FOVs" with Orbit / Walk / Fly degree inputs and Apply Live / Save / Clear actions.
- Save writes a new `Navmode__FovOverrides` block to `TrueVision__ProjectData__.json` (R2), overriding the master FOV defaults in `Na__AppConfig__Main.json` on a per-project basis.
- Apply Live: Orbit sets the main camera FOV instantly; Walk/Fly stage the override and live-update if that mode is currently active.
- On load, `Na__AppFlow__LoadingSequence` applies the Orbit FOV to the live camera **before** the canonical Reset View capture, and stages Walk/Fly overrides for their next activation.
- New FOV setters `Na__WalkMode__SetFovOverride` / `Na__FlyMode__SetFovOverride` added to the respective navigation system modules.

**Feature 2 — Scene Model-Element Visibility Capture (SketchUp-style scene tags).**
- Capturing / updating a Presentation Mode scene now records the on/off state of every model element (category toggles) plus storey + roof dolls-house bookkeeping into a new `PresentationMode__Scene__Visibility` block.
- On scene apply/transition the saved visibility is restored: coarse storey/roof state first, then fine per-category visibility last (authoritative), so different scenes can show e.g. a ground-floor-only "dolls house" view.
- Drives the EXISTING visibility systems only — no new core visibility logic. `Na__UiFeature__ModelToggle__Controls` gained `GetVisibilityState` / `ApplyVisibilityState`; storey state read via `Na__StoreySystem__GetState`.
- Older scenes without the block remain fully backwards-compatible (apply is a no-op).

**New / Changed Files**
- NEW `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Visibility__StateCapture.js` (capture + apply orchestrator).
- NEW `02__Src__AppModules/11__CameraUtils/Na__UiFeature__ViewModeFov__DevControls.js` (FOV dev panel).
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` (visibility get/apply API).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneEditor.js` (capture on Add/Update).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (apply on instant + animated transition).
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js` + `…__FlyMode__SystemLogic.js` (FOV override setters).
- MOD `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` (`Navmode__FovOverrides` dev key + load-time apply).
- MOD `Index.html` (FOV dev menu item + init wiring).
- MOD `na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py` + `ProjectVision__BuildScript__.py` (added `Navmode__FovOverrides` to dev-owned keys).

# ---------------------------------------------------------
## TrueVision3D v2.7.3  -  21-Jun-2026
### Build Pipeline — Mirror Live R2 Dev Config Back to Local Project Data

**Problem.**
- After running `ProjectVision__BuildScript__.bat`, the local `TrueVision__ProjectData__.json` still showed only build-generated "standard" data (model groups, camera default). Dev-menu config saved live in-app to R2 (presentation scenes, nav modes, orbit max, orbit target) was never pulled back down to the local file, so the local copy could not be read as an accurate mirror of R2.
- Root cause: the R2 sync (`CloudflareR2__ModelSync__Main__.py`) merged R2's dev-owned keys into the document it **uploaded to R2**, but never wrote that merged document back to the **local** file.

**Fix — R2 → local write-back.**
- `build_project_data_operation` now flags `local_out_of_sync` whenever the merged document (local build + R2 dev keys) differs from the on-disk local file, and carries the dev keys it pulled (`dev_preserved`) for logging.
- New `sync_project_data_to_local()` writes the merged bytes back to each stale local `TrueVision__ProjectData__.json`.
- `run_r2_sync` calls it as STEP 5b — after the `--dry-run-only` guard (so pure previews never touch disk) but **before** the upload prompt and the "all up to date" early-return, so the local mirror happens even when R2 needs no upload.
- This is a read-from-R2 convenience mirror only; saving locally still pushes nothing. The result is local and R2 staying in sync after every build.

**Changed Files**
- `na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py` — `local_out_of_sync`/`dev_preserved` flags, `sync_project_data_to_local()`, STEP 5b wiring.

# ---------------------------------------------------------
## TrueVision3D v2.7.2  -  21-Jun-2026
### Design Phase Model Group Transition Overlay

**Summary.**
- Added a dedicated loading overlay shown while switching between design phase model groups. Large GLB model sets can take a while to swap, so the user now gets clear visual feedback (Vale branded spinner + phase label + live progress status) during the transition rather than a frozen-looking canvas.

**Behaviour.**
- New semi-transparent overlay (`#naModelGroupTransitionOverlay`) modelled on the existing layout-export overlay pattern: `--visible` / `--fade-out` class modifiers with a `transitionend` (plus 400ms fallback) teardown.
- Reuses the shared `.loading-spinner` styling from the initial loader for visual consistency.
- Shows on phase-switch start, mirrors each loader status message into the overlay, and fades out on both success and error.

**Changed / New Files**
- NEW `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupTransitionOverlay__.js` (Show / UpdateStatus / Hide control).
- MOD `Index.html` (added `#naModelGroupTransitionOverlay` element).
- MOD `03__Style__AppStylesheets/Na__UiFeature__Styles__LoadingOverlays__.css` (new transition overlay CSS region).
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js` (wired overlay into `Na__GroupSelector__LoadGroup`).

# ---------------------------------------------------------
## TrueVision3D v2.7.1  -  21-Jun-2026
### Fix — Dev-Menu R2 Saves Now Persist and Read Back

**Problem.**
- Dev-menu saves reported success (toast + no console errors) but nothing persisted on reload. Root cause was a read/write split: saves wrote to **R2**, but on localhost the app read the **local static file** (`/na-project-portal/.../TrueVision__ProjectData__.json`), never R2 — so a refresh re-loaded the untouched local file. A latent data-loss bug also existed: when R2 had no copy yet, a save wrote a document containing only the changed keys (dropping `modelGroups`, camera, etc.).

**Fix — full-document merge base.**
- `Na__CloudflareIntegration__ApiClient__.js` now holds the full loaded project data in memory (`Na__CfApi__SetLoadedProjectData` / `GetLoadedProjectData`). `Na__CfApi__MergeAndSaveKeys` / `DeleteProjectKeys` merge changes into that complete document and write the **whole** document back to R2 (then refresh the cache). Model groups / camera / everything are preserved — no more partial writes.

**Fix — localhost reads the R2 source of truth (overlay).**
- `Na__AppFlow__LoadingSequence.js` registers the loaded full data as the save merge base, and on localhost overlays only the Dev-menu-saved keys (`Na__DevSavedKeys`: `PresentationMode__SavedCameraScenes`, `Navmode__EnabledModes`, `Navmode__OrbitMaxDistanceMm`, `Camera__DefaultPosition`, `OrbitHelperCube__Position`) from the live R2 copy (worker `/r2/read`, bypasses CDN cache) onto the full base file.
- Overlaying (not replacing) guarantees model-defining keys always come from the complete base file, so a partial R2 file from a pre-fix save can never break model loading — and the next save re-seeds R2 with a complete merged document (self-healing). Production is unchanged (reads the full file from CDN).

**Result.**
- Confirmed working end to end: Dev-menu edits (camera, navigation modes, orbit max, presentation scenes + thumbnails) persist to R2 and are read back on reload without a GitHub push.

**Changed Files**
- `02__Src__AppModules/80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js` — in-memory full-document merge base + cache refresh on write.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — `Na__DevSavedKeys` constant, register loaded data, localhost R2 overlay.

# ---------------------------------------------------------
## TrueVision3D v2.7.0  -  21-Jun-2026
### Navigation Toolbar + Presentation Mode + Realtime R2 Dev Saves (ValeVision Parity)

**Summary.**
- Transplanted ValeVision3D's floating navigation toolbar, Presentation Mode scene-animation system, and full Dev-menu tooling into TrueVision3D. Dev-menu actions now persist straight to Cloudflare R2 (read back from R2 — no GitHub push required), via a new dedicated Worker.

**Navigation toolbar (moved out of Tools & Settings).**
- Orbit / Walk / Fly / Views / Reset View / Help now live in a floating bottom-centre pill toolbar (`#naNavToolbar`). The Walk/Fly/Orbit buttons were removed from the `#naToolsMenu` dropdown.
- Contextually dynamic position: bottom-centre by default; when a project has valid `PresentationMode__SavedCameraScenes`, `body.na-presentation-mode-active` moves the toolbar to the top and the scene carousel takes the bottom slot.
- Walk/Fly buttons reveal only when `Navmode__EnabledModes` enables them for the model (via the `na-navigation-modes-loaded` event). Reset View restores the captured project start state.

**Presentation Mode (scene animation).**
- Per-project saved camera scenes under `PresentationMode__SavedCameraScenes` in `TrueVision__ProjectData__.json`. Discrete camera snapshots with interpolated transitions (lerp position/target/FOV + quaternion slerp), a bottom thumbnail carousel, and a Views toggle button.

**Realtime R2 persistence (NEW Worker).**
- New `na-truevision-api` Worker (`80__CloudflareIntegration/CloudflareWorker/`) modelled on `na-projectadmin-api`; binds the shared `noble-architecture-cdn` bucket under the `NaProjectPortal/` prefix, exposes `/r2/read|write|list|delete` + `/health`.
- New `Na__CloudflareIntegration__ApiClient__.js` (read-merge-write to `TrueVision__ProjectData__.json` + base64 WebP thumbnail upload).
- Dev-menu saves (camera, navigation modes, orbit max distance, presentation scenes + thumbnails) now write to R2 via the Worker instead of localhost Flask. (Note: ValeVision itself uses Flask + GitHub static reads; the R2-write path is net-new per the brief.)

**Dev menu (full parity, localhost-only).**
- Re-pointed Save Camera Settings to R2.
- Added Navigation Modes (Walk/Fly enable) and Orbit Max Zoom Radius (apply live / save / clear) controls.
- Added the Presentation Scenes editor (add-from-camera, FOV/transition/easing, regenerate thumbnail, save/delete, export JSON, clear all).
- Render-engine switch intentionally skipped (TrueVision is single-pipeline). Camera-path visualizer omitted (unwired debug overlay in ValeVision).

**Assets.**
- Copied the ValeVision navigation icon set into `01__AppAssets__TrueVision/UiIcons__MenuIcons__NavigationMenu/`.

**Config.**
- Added `CloudflareConfig.CloudflareConfig__WorkerBaseUrl` to `Na__AppConfig__Main.json` (Dev-menu Worker base URL).

**Changed / New Files**
- NEW `80__CloudflareIntegration/CloudflareWorker/` (wrangler.toml, package.json, deploy.bat, `src/CloudflareWorker__Main__.js`, `src/handlers/CloudflareHandler__R2__.js`).
- NEW `02__Src__AppModules/80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js`.
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__NavigationToolbar__Controls.js`, `Na__UiFeature__NavigationHelpPanel__Controls.js`, `Na__Camera__ProjectStartState.js`, `Na__NavigationModes__State.js`.
- NEW `02__Src__AppModules/21__System__PresentationMode/` (`*__ProjectJson__SceneData.js`, `*__Camera__SceneTransition.js`, `*__UI__SceneCarousel.js`, `*__Thumbnail__Renderer.js`, `*__DevMenu__SceneEditor.js`).
- NEW `03__Style__AppStylesheets/Na__UiFeature__Styles__NavigationToolbar__.css`, `Na__PresentationMode__Styles__SceneCarousel__.css`.
- NEW `02__Src__AppModules/70__System__DevTools/Na__UiFeature__NavigationModes__DevControls.js`, `02__Src__AppModules/11__CameraUtils/Na__UiFeature__OrbitMaxDistance__DevControls.js`.
- CHANGED `Index.html` (toolbar/help/carousel markup, dev-menu sections, orchestrator wiring, removed Tools-menu nav buttons).
- CHANGED `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` (dispatch `na-navigation-modes-loaded` + `na-presentation-mode-scenes-loaded`, capture camera start state, apply orbit-max override).
- CHANGED `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js` (Flask → R2).
- CHANGED `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` (CloudflareConfig).
- CHANGED `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` (new stylesheet imports).

**Deployment note.** Deploy the Worker once with `wrangler deploy` from `80__CloudflareIntegration/CloudflareWorker/` (requires `wrangler login`). Update `CloudflareConfig__WorkerBaseUrl` if the deployed `workers.dev` subdomain differs from `na-truevision-api.adam-fb3.workers.dev`.

# ---------------------------------------------------------
## TrueVision3D v2.6.1  -  16-Jun-2026
### Camera-Follow Billboards — 2D Site Vegetation Ported from ValeVision3D

**Feature.**
- 2D billboard vegetation (`09__Site__Vegetation__2D` tag, GLB stem `TrueVision__SiteVegetation2D`) now yaw-rotates to always face the camera, mimicking SketchUp's "Always Face Camera". Mesh and linework twins rotate together around the baked `00__OriginPoint` pivot. Behaviour is driven entirely by glTF node `extras` baked by the shared SketchUp GLB Builder (`type: CameraFollowBillboard`, `pivotLocal`, `shadeFlatness`) — no Ruby changes were needed for this port.

**Flat shading.**
- Billboards opt into directional-light flattening via a per-component `shadeFlatness` (0=full directional, 1=fully flat) sourced from the Components DataLib and baked into each node's extras. An `onBeforeCompile` patch mixes the lit colour toward albedo. Models exported before the field fall back to the config `DefaultShadeFlatness` (0.85), so existing GLBs flatten without a re-export.

**Detection is category-agnostic.**
- Every loaded category is scanned for the baked billboard flag (not a name/category token), so the system is robust to which category GLB the exporter bundled the trees into.

**Rebind-aware.**
- `Na__CameraFollow__Initialize` re-scans on every call, so it rebuilds correctly through `Na__ReinitializeModelBoundSystems` model-group / design-phase switches.

**Storey + consolidation integration.**
- Floor isolation now hides/restores SiteVegetation2D alongside Landscape (`/Landscape|SiteVegetation/i`).
- Client-side instance consolidation now guards billboards (`userData.type === 'CameraFollowBillboard'`) so repeated trees are never merged into an `InstancedMesh` (which would break per-instance rotation).
- AO exclusion needs no code change: the shared `__SiteVegetation__` token is already in the DataLib AmbientOcclusion exclusion list consumed by the material swap.

**Changed Files**
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__CameraFollowBillboards__.js` — new module (ported, rebind-aware).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — import, collect-all-categories helper, init in reinit, per-frame update.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `3dObject__Interaction__CameraFollowComponents` block.
- `Index.html` — extract `Na__Config__CameraFollow`, pass `cameraFollow` in configs.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — `TrueVision__SiteVegetation2D` load-order slot.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__InstanceConsolidation__.js` — billboard guard.
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` — display name.
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js` + `3dObject__ViewBuildingStoreys__SystemLogic__.js` — hide with landscape on floor isolate.

# ---------------------------------------------------------
## TrueVision3D v2.6.0  -  07-Jun-2026
### Plant Performance — Name-Based Pipeline Exclusions + Leaf Instance Consolidation

**Problem.**
- Adding a potted olive-tree (`29_4001__PottedPlant__Exterior__OliveTree__Dia450mm__`) seized the renderer. The cause was a draw-call explosion, not triangle count: the tree's `29_4001_10__Plant__SubComp__Leaf__Individual` component is placed **2,557 times**. Three.js GLTFLoader renders each instanced glTF node as its own draw call, and the linework upgrade created **2,557 separate `LineSegments2` fat-line objects** — all multiplied across the profile-normal and AO depth pre-passes (~7,000–10,000 draw calls/frame for one plant).

**Fix — three coordinated changes (leaves + stems + branches; pot untouched).**
1. **Linework omitted at export** (GLB Builder) for the excluded names, so no fat lines for the plant reach the renderer (biggest single win). See GLB Builder dev log.
2. **Leaf instance consolidation** — new `Na__ModelLoader__InstanceConsolidation__.js` collapses repeated same-geometry+material mesh nodes into a single `THREE.InstancedMesh` at load (2,557 draws → 1). Generic geometry+material bucketing with a door/interactive guard (`ADR`/`MOD`/`ROT`/`Door`) so animated assemblies are never merged. Config-flagged.
3. **AO exclusion by name** — `Na__MaterialsSystem__MaterialSwap.js` now assigns Three.js layer 1 (the existing SSAO/profile pre-pass exclusion layer) to meshes whose node or ancestor name matches the Ambient Occlusion token list, in addition to the existing material-level `AoExclude` flag.

**SSOT.**
- New `Na__DataLib__PipelineExclusions` section in the Components DataLib (`Na__DataLib__CoreIndex__Components__.json`, bumped to v1.1.0) holds two contains-matched token lists: `Na__DataLib__PipelineExclusions__AmbientOcclusion` and `Na__DataLib__PipelineExclusions__ProfileLines`. Tokens (`__Plant__SubComp__Stem`, `__Plant__SubComp__Branches`, `__Plant__SubGroup__LeavesContainer`, `__Plant__SubComp__Leaf__Individual`) generalise to any plant following the naming convention and never match `__PlantPot`.

**Config.**
- `models.RenderConfig__InstanceConsolidation` added to `Na__AppConfig__Main.json` (`Enabled`, `MinInstanceCount: 16`, `FoliageCastShadow: false`).

**Changed Files**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__InstanceConsolidation__.js` — new module.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — import + invoke consolidation per category mesh root.
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js` — name-based AO exclusion (layer 1) + helpers.
- `02__Src__AppModules/01__AppCore/AppCore__DataLib__Loader.js` — `Na__DataLib__GetPipelineExclusions()` getter.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `RenderConfig__InstanceConsolidation` block.
- `Na__DataLib__CoreIndex__Components__.json` (DataLib repo) — new exclusion section + version bump.

**Note.** Linework omission requires a re-export of the model. Name-based AO covers instanced/named geometry (leaves) directly; flattened stems/branches rely on their foliage/stem material's `AoExclude` flag.

# ---------------------------------------------------------
## TrueVision3D v2.5.3  -  07-Jun-2026
### Distance Culling — Correct Bounds for Nested + Instanced Geometry (Leaf Pop-In Fix)

**Symptom.** Plant leaves popped in/out at seemingly random camera positions — their cull distance was being measured against a wrong cached centre.

**Root cause.** The bounds computation transformed each node's local `boundingBox` by its `matrixWorld`. That is correct for ordinary nesting, but **wrong for `InstancedMesh`**: GLTF foliage is frequently instanced, and the per-instance `instanceMatrix` offsets are not captured by the node's single `matrixWorld`. The leaf cluster's cached centre therefore collapsed onto the base/origin instance, so the leaves appeared/disappeared relative to that wrong point.

**Fix.** `Na__RenderEffect__DistanceCulling__.js` now computes item world bounds with `THREE.Box3.setFromObject(itemNode)`, which walks arbitrarily deep group/component nesting and expands `InstancedMesh` by every instance matrix. Fat-line `LineSegments2` endpoints (which `setFromObject` does not bound) are still unioned in explicitly via their `instanceStart` / `instanceEnd` attributes, so linework remains bounded too. Removed the now-unused per-child scratch box.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js` — `ComputeWorldBounds` rewritten (setFromObject + fat-line union); module v1.1.0.

# ---------------------------------------------------------
## TrueVision3D v2.5.2  -  07-Jun-2026
### Distance Culling — Linework Now Hides (Profile-Lines Pass Was Overriding It)

**Root cause (the real one).**
- Every object is rendered twice: a Mesh model and a completely separate fat-line (`LineSegments2`) linework model. The **profile-lines render pass** (`renderProfileNormals`, run every frame inside the composer block) collects *all* `LineSegments2` in the scene, hides them for its normal pre-pass, then **restored them to a hardcoded `visible = true`**. This ran *after* `Na__DistanceCulling__Update`, so it silently un-hid every linework item the culler had just hidden — every frame. That is why only the mesh disappeared while the linework stayed.

**Fix.**
- `Na__RenderEffect__ProfileLines__.js` now **saves each line object's prior visibility** before the normal pre-pass and **restores to that saved state** (instead of forcing `true`). External per-object visibility — distance culling today, anything similar in future — is now preserved across the profile-lines pass. Mesh material swap/restore logic is unchanged.
- Added a pre-allocated `cachedLineVisibility` backup array (sized in `rebuildSceneCache`) so the save/restore is allocation-free per frame.

**Also (carried from the same investigation).**
- `Na__RenderEffect__DistanceCulling__.js` bounds fat-line items by reading their interleaved `instanceStart` / `instanceEnd` endpoint attributes directly (these are not bounded reliably by `Box3.setFromObject` / `geometry.boundingBox`), so linework items register with correct world bounds and cull in lockstep with their mesh twins.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js` — save/restore prior line visibility instead of forcing `true`; added `cachedLineVisibility` backup array.

# ---------------------------------------------------------
## TrueVision3D v2.5.1  -  07-Jun-2026
### Distance Culling — Linework + Foreground-Clipping Fixes

**Bug 1 — Linework was never culled (only the mesh model hid).**
- Every item is rendered twice (a Mesh model + a paired fat-line `LineSegments2` linework model). Fat lines store their segment endpoints in interleaved `instanceStart` / `instanceEnd` attributes; neither `Box3.setFromObject()` nor `geometry.boundingBox` bounds these reliably, so linework items returned empty bounds and were silently skipped from the cull registry.
- Fix: `Na__DistanceCulling__ComputeWorldBounds` now reads the fat-line `instanceStart` / `instanceEnd` attributes directly (via `getX/getY/getZ`, transformed by `matrixWorld`) to build the world AABB, and uses the cached local `boundingBox` only for standard mesh geometry. Linework items are now bounded and cull in lockstep with their mesh counterparts. Registration logging reports mesh vs linework item counts for verification.

**Bug 2 — Items near the camera were wrongly clipped.**
- Furniture/decor categories contain large merged-by-material meshes (e.g. `28__ProposedBuilding__FurnitureDefault`, merged `Linework`) that span an entire storey. Culling by their single centroid hid the whole merged blob — including parts right in front of the camera — until the camera neared the centroid (hence "move forward and they pop back").
- Fix: switched from centroid culling to **nearest-point (radius-aware) culling**. Each item caches a bounding-sphere radius and a threshold of `(cullDistance + radius)^2`; an item hides only when its nearest point is beyond the cull distance. Large merged meshes stay visible while any part is near; compact distant items still cull normally.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js` — robust world-bounds computation, per-item radius-aware squared threshold, `Update` now compares against per-item `thresholdSq`.

# ---------------------------------------------------------
## TrueVision3D v2.5.0  -  07-Jun-2026
### Furniture / Interior-Decor Distance Culling

**Overview**
- Interior furniture and decor (pillows, chairs, beds, etc.) add a large per-frame render cost while contributing little when viewed from a distance.
- Added a config-driven per-item distance-culling system that hides furniture and interior-decor items beyond a configurable radius from the active camera. Default ON at 15 m.

**Behaviour**
- Per individual item: each item node under a matching category's `__MeshRoot` and `__LineworkRoot` is toggled independently by radial distance from the active camera (works in orbit, walk, and fly modes).
- Squared-distance comparison (no `sqrt`); each item's world-space centre is cached once at registry build, so the per-frame cost is a single distance check per item.
- Runs only inside the invalidation-based render loop (camera-move frames), so idle cost is zero.
- Sets `.visible` on individual item nodes only — never on category groups — so it composes safely with the model-toggle and storey visibility systems via the THREE.js visibility hierarchy.
- The cull registry is rebuilt in `Na__ReinitializeModelBoundSystems`, so it stays correct after model-group switches.

**New Module: `Na__RenderEffect__DistanceCulling__.js`** (`02__Src__AppModules/05__RenderPipeline/`)
- `Na__DistanceCulling__Initialize(config)` — reads enable flag, converts `CullDistanceMm` to units, stores category tokens.
- `Na__DistanceCulling__RegisterModelGroups(loadedGroups)` — builds the per-item registry from categories whose key matches a configured token.
- `Na__DistanceCulling__Update(cameraWorldPos)` — toggles item visibility against the cull distance; returns whether anything changed.
- `Na__DistanceCulling__SetEnabled(bool)` / `Na__DistanceCulling__IsEnabled()` — runtime toggle (disable restores all items to visible).

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — new `RenderEffect__DistanceCulling` block (`Enabled`, `CullDistanceMm: 15000`, `CategoryNameTokens: ["Furniture", "InteriorDecor", "Decor"]`).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — imports the module; initialises it from config; registers groups in `Na__ReinitializeModelBoundSystems`; calls `Na__DistanceCulling__Update` in `Na__RenderLoop__RenderFrame` before the composer render.
- `index.html` — extracts `Na__Config__DistanceCulling` and passes it through the `configs` object to `Na__AppFlow__StartLoadingSequence`.

# ---------------------------------------------------------
## TrueVision3D v2.4.1  -  07-Jun-2026
### Edge Colour Lightness Calibration

**Overview**
- SketchUp MTE edge colours are calibrated for the SketchUp viewport and render slightly too bright in TrueVision's lit white-card environment.
- Added a configurable HSL lightness reduction applied at load time to all vertex colours extracted from linework GLBs. The source data files (SketchUp DataLib) are not modified.

**Rule**
- Lightness values from the MTE greyscale series are reduced by 10 units (0-100 scale) in TrueVision: L20→L10, L40→L30, L45→L35, etc. Accent colours darkened equivalently in HSL space. Absolute black (L0) clamped at 0 and unchanged.

**Changed Files**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__LineworkColours__.js` — new `Na__ModelLoader__DarkenExtractedColors(colorArray, lightnessReductionAmount)` function added and exported.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — imports and calls `Na__ModelLoader__DarkenExtractedColors` in `Na__ModelLoader__UpgradeLineworkRoot` immediately after colour extraction.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `RenderConfig__Linework__EdgeColorLightnessReduction: 10` added to `RenderConfig__Linework` (adjust to tune).

# ---------------------------------------------------------
## TrueVision3D v2.4.0  -  06-Jun-2026
### Edge Colour System — Full Parity with ValeVision3D

**Overview**
- Fixed a critical bug where SketchUp MTE edge colours exported as glTF `COLOR_0` vertex colours were being silently annihilated by an incorrect `LineMaterial.color` multiplier. All coloured linework was rendering as near-black regardless of the actual vertex colour data.
- Ported ValeVision3D's complete linework colour infrastructure to TrueVision, including dominant colour votes, name-based colour matching, and per-mesh profile colour propagation.
- Split colour logic out of `Na__ModelLoader__MultiModel.js` into `Na__ModelLoader__LineworkColours__.js`.

**Root Cause Fixed**
- `LineMaterial.color` was set to the config fallback colour (`0x141414`, near-black) even when `vertexColors: true`. In Three.js, `LineMaterial` multiplies `material.color × vertexColor`, so a near-black multiplier collapsed every vertex colour to near-black. Fix: set `color = 0xffffff` (white, multiplicative identity) when vertex colours are present.

**New Module: `Na__ModelLoader__LineworkColours__.js`**
- `Na__ModelLoader__ExtractLineColors` — safe `fromBufferAttribute` extraction.
- `Na__ModelLoader__BuildColorKey` / `Na__ModelLoader__RegisterColorVote` / `Na__ModelLoader__ResolveDominantColor` / `Na__ModelLoader__ResolveDominantImportedLineColor` — weighted colour vote map.
- `Na__ModelLoader__FindColorByName` + `Na__ModelLoader__ResolveProfileColorForObject` — exact and longest-prefix name matching.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot` — propagates `Na__ProfileLineColor` userData to paired mesh nodes for profile-line depth cue effects.

**Updated: `Na__ModelLoader__MultiModel.js`**
- Imports colour utilities with `@delegate:` pointer.
- `Na__ModelLoader__UpgradeLineworkRoot` extracted from inline `LoadSingleLinework`.
- Node `name`, `visible`, and `userData` preserved during fat-line upgrade.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot` called in both loops of `Na__ModelLoader__LoadAllModels`.
- Exports updated to include `Na__ModelLoader__UpgradeLineworkRoot` and `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot`.

**Updated: `Na__AppConfig__Main.json`**
- `RenderEffect__ProfileLines__ColorPassIncludesLinework: true` added — was already read by ProfileLines module, now declared in SSOT config.

# ---------------------------------------------------------
## TrueVision3D v2.3.9  -  06-Jun-2026
### Door Animation — Interior Doors: Sign-Convention Inversion vs Bifold

**Root cause (confirmed by scene-graph diagnostics + cross-system comparison)**

Per-door diagnostics proved the loaded GLB is clean: every door has `det=1`, `scale=(1,1,1)`, and TrueVision faithfully applies the signed angle baked into each MOD name. So there is no mirror and no math error in the animation engine. Bifold doors swing correctly; interior doors swing 180° inverted.

The discriminator is the **sign convention used by the two SketchUp builders**:
- The **bifold (ExtFold) system** computes its MOD rotation degrees via `na_compute_panel_rot_degrees`, and its sign was **calibrated empirically against TrueVision's actual rendered swing** — see the ExtFold AllOneWay devlog v1.7.2: *"Right-cascade master now swings OUTWARD (+90 deg) instead of into the room (-90 deg)."* They flipped the sign because they watched it open the wrong way in TV.
- The **interior door system** (older Element Assembly Studio code) derives its MOD sign from pure SketchUp geometric logic (`na_resolve_mod_panel_name`) and was never validated against TV. It is internally self-consistent with the SketchUp swing arc, but renders inverted in TV.

Same animation code, opposite real-world result — because the bifold convention already bakes in a TV compensation the interior convention lacks.

**Fix: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` (v1.6.0)**
- Added `Na__DoorAnim__ResolveInteriorInversionSign(adrObject)`: when AppConfig `3dObject__Interaction__DoorAnimation__InteriorRotationInverted` is `true` (default), doors whose ADR name contains `InteriorDoor` receive a `-1` rotation sign, landing them on the same TV-correct convention bifold uses.
- Folded into `panel.rotationSign` alongside the existing mirror-determinant sign, applied in `ApplyPanelTransform`.
- Bifold, sliding, and exterior doors are unaffected (name token gate).
- **Reversible via AppConfig, no GLB re-export required** — hard-reload to test.

**Config: `Na__AppConfig__Main.json`**
- Added `3dObject__Interaction__DoorAnimation__InteriorRotationInverted: true`.

**If this over-corrects** (i.e. an interior door that was previously correct now swings wrong), that proves the inversion is per-door (mismatched SwingSide/SwingDirection config in SketchUp) rather than global, and we narrow to those specific doors.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.8  -  06-Jun-2026
### Door Animation — TRUE Root Cause: Mirrored Door Instances Swing Reversed

**This is the actual fix for the "interior doors open 180 degrees the wrong way" bug.**

The previous version notes (v2.3.6 / v2.3.7) chased the SketchUp side (MOD name angle, instancing, open-state leakage). A scene-graph log proved the exported GLB was correct: exactly one MOD per door, correct signed angle in the name (`MOD001__ROT__-90-Deg__DoorPanel`), no open-state copy. The bug was purely in TrueVision's animation.

**Root Cause**
`Na__DoorAnim__ApplyPanelTransform` rotates each MOD about the door's LOCAL `+Y` axis `(0,1,0)`. That local rotation only maps to the intended WORLD swing when the door's accumulated world transform is a proper rotation (determinant > 0).

Interior doors are routinely **mirror-copied** between rooms (and/or sit under a mirrored storey container). A mirrored instance carries a **negative-determinant** world transform. A mirror converts a right-handed rotation into a left-handed one — `M · R(θ) · M⁻¹ = R(−θ)` when the mirror plane contains the vertical axis — so the fixed local `+Y` swing appears reversed in world space and the door opens 180° the wrong way.

This precisely matches the observed behaviour:
- Top-level (non-mirrored) interior doors → correct.
- Nested / mirrored interior doors → flipped.
- Bifold doors on the same storey (not mirrored) → correct.

**Fix: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` (v1.5.0)**
- Added `Na__DoorAnim__ResolveMirrorSign(adrObject)` — calls `updateWorldMatrix` then reads `adrObject.matrixWorld.determinant()`, returning `-1` for mirrored doors and `+1` otherwise.
- `Na__DoorAnim__BuildPanelDescriptor` stores the result in `panel.rotationSign` (resolved once at scan time; the determinant sign is static for the door's lifetime).
- `Na__DoorAnim__ApplyPanelTransform` multiplies the swing angle by `panel.rotationSign`, so mirrored doors swing in the intended world direction. Non-mirrored doors are unchanged.
- MVE translation is intentionally **not** sign-corrected: a mirrored sliding/bifold panel and its track are mirrored together, so the local-space translation already lands on the correct side.

**No re-export required** — this is a runtime animation fix. Hard-reload the app to pick up the new module.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.7  -  06-Jun-2026
### Door Animation — Root Cause Fix: Open-State MOD Leaking Into GLB

**Root Cause of "180° Flip" Bug (was misdiagnosed in v2.3.6)**

The doors appeared to open 180° wrong because the GLB contained **two** MOD panels per door: the closed-state panel (correct) and the open-state authoring copy (already pre-rotated in SketchUp by the composer). TrueVision registered both as animatable panels and applied the rotation angle to both — but the open-state copy started at its pre-rotated position, so the same rotation pushed it to −180° from the correct open position, which dominated the visual result.

This happened because `Na__Door__Open` was not in the DataLib's `FullyExcludedTagNames`. Our earlier hardcoded-fallback fix (v2.3.6 Bug 3) only applied when DataLib load *fails*; when DataLib loads successfully the hardcoded list is ignored entirely.

**Fix: `Na__TrueVision__GlbBuilder__SpecialObject__DoorObjectHandling__.rb`**
- Added `DOOR_OPEN_LAYER_NAME = "Na__Door__Open".freeze` constant.
- Added an unconditional guard at the top of `Na__DoorHandler__ChildExportDecision` that immediately returns `[false, "open_state_preview_always_excluded"]` for any entity tagged `Na__Door__Open`, **before** the DataLib exclusion check and **before** the tag-visibility check. This makes the guard impossible to bypass by exporting in open-state preview mode or by DataLib configuration drift.

**Cleanup: `Na__AssemblyStudio__InteriorDoorSystem__DoorAssemblyComposer__.rb`**
- Removed the four redundant intermediate constants (`NA_GROUP_NAME_MOD_PANEL_RIGHT_OUTWARD`, `_RIGHT_INWARD`, and the over-commented aliases) introduced in v2.3.6. Restored to the original two reference constants plus the legacy alias — the dynamic `na_resolve_mod_panel_name` function already generates the correct name and the extra constants added noise.

**Action required**
Re-export the affected storey GLBs. The open-state MOD will now be silently excluded regardless of the `Na__Door__Open` tag visibility in SketchUp at export time.

---

## TrueVision3D v2.3.6  -  06-Jun-2026
### Door Animation — Six-Bug Fix (Rotation Direction, Instancing, Leakage, Duplicate Code)

**Overview**
Six related bugs in the door animation pipeline have been fixed. The primary symptom was interior doors nested inside storey groups (`90__Storey__*`) opening 180° in the wrong direction. Secondary issues caused identical repeated door instances to become permanently static, open-state panel geometry to pollute GLBs, and the test-sandbox door finder to silently return empty results for storey-mode scenes.

---

**Bug 1 — CRITICAL (SketchUp): MOD degree ignored hinge side → left-handed doors always opened 180° wrong**
- File: `Na__AssemblyStudio__InteriorDoorSystem__DoorAssemblyComposer__.rb`
- `na_resolve_mod_panel_name` used two fixed constants (`-90-Deg` for outward, `+90-Deg` for inward) regardless of hinge side. These are correct only for right-handed doors; left-handed doors need opposite signs.
- Fix: `na_resolve_mod_panel_name` now mirrors the same `base_angle × sign` formula as `na_compute_open_rotation_transform` (accounting for both `Na__DoorConfig__SwingSide` and `Na__DoorConfig__SwingDirection`). This produces the correct signed degree token for all four hinge+swing combinations.
- Truth table:  Left+Inward→`-90`, Right+Inward→`+90`, Left+Outward→`+90`, Right+Outward→`-90`.
- Old fixed constants renamed to `NA_GROUP_NAME_MOD_PANEL_RIGHT_OUTWARD` / `_RIGHT_INWARD` for clarity; old aliases retained.

**Bug 2 — HIGH (GLB Exporter): Instancing skip-set fired before ADR check → repeat-definition doors lost animation hierarchy**
- Files: `Na__TrueVision__GlbBuilder__EngineCore__.rb` (top-level entity loop), `Na__TrueVision__GlbBuilder__EngineCore__GeometryHandling__.rb` (`TraverseEntities`)
- `next if instanced_skip_set.key?(entity.object_id)` was evaluated before `Na__DoorHandler__IsDoorAssembly?`. If a door ComponentDefinition appeared more than once, the second (and any subsequent) instance was silently consumed by the instancing path, which flattens geometry into a static mesh without preserving the ADR/MOD/ROT hierarchy. Those doors became permanently static in TrueVision.
- Fix: moved the `IsDoorAssembly?` check to before the instancing skip in both locations. Door assemblies now always bypass the instancing skip-set so every instance gets its own hierarchy node in the GLB.

**Bug 3 — MEDIUM (GLB Exporter): `Na__Door__Open` missing from hardcoded exclusion fallback → open-state MODs leaked into GLB**
- File: `Na__TrueVision__GlbBuilder__Main__.rb`
- `ALWAYS_EXCLUDED_LAYER_NAMES` did not include `Na__Door__Open`. If the DataLib load failed at export time, or if the SketchUp model was in open-state preview mode during export, the open-state MOD (already rotated 90° by `na_compose_open_state_copy`) was written into the GLB alongside the closed-state MOD. TrueVision then found two MOD siblings with the same name, registered both as panels, and animated the already-open one past its correct open position.
- Fix: added `"Na__Door__Open"` to `ALWAYS_EXCLUDED_LAYER_NAMES`.

**Bug 4 — MEDIUM (TrueVision): `Na__DoorAnimation__FindDoorGroups.js` used wrong traversal level and never worked for storey-mode**
- File: `Na__DoorAnimation__FindDoorGroups.js`
- The original single-level loop checked direct children of `rootGroup` for names containing both a door token AND 'Mesh'/'Linework'. Category group names (e.g. `Storey__GroundFloor__ProposedDoors`) never contain 'Mesh'/'Linework', so both output arrays were always empty for any scene. The production app was not affected (it uses `Na__CollectDoorModelGroups` inline), but the test sandbox was silently broken.
- Fix: rewritten as a two-level traversal: outer loop finds category groups containing a door token; inner loop reads `child.userData.Na__ModelType` to split mesh/linework roots — identical to the production `Na__CollectDoorModelGroups` logic and robust for flat and storey GLBs alike.

**Bug 5 — LOW (TrueVision): Fragile index-order fallback in `Na__CollectDoorModelGroups`**
- File: `Na__AppFlow__LoadingSequence.js`
- `Na__CollectDoorModelGroups` fell back to `children[0]`/`children[1]` when neither child had `userData.Na__ModelType`. The tag is set on every real load path, so the fallback was unreachable dead code — but it was a correctness landmine for any future async load-order change.
- Fix: replaced fallback with a `console.warn` that identifies the category key and skips it cleanly.

**Bug 6 — LOW (TrueVision): Dead legacy exports in `ClickToOpenDoors__.js`**
- File: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `Na__DoorAnim__FindModRotChild` and `Na__DoorAnim__ApplyPivotRotation` were exported as "backward compat" but had no known callers anywhere in the codebase. Keeping them in the export surface created confusion about whether they were part of the public API.
- Fix: both functions removed; exports block updated with removal comments.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.5  -  06-Jun-2026
### Edge Colour System — Full Parity with ValeVision3D

**Overview**
- Fixed a critical bug where SketchUp MTE edge colours exported as glTF `COLOR_0` vertex colours were being silently annihilated by an incorrect `LineMaterial.color` multiplier. All coloured linework was rendering as near-black regardless of the actual vertex colour data.
- Ported ValeVision3D's complete linework colour infrastructure to TrueVision, including dominant colour votes, name-based colour matching, and per-mesh profile colour propagation.
- Split colour logic out of `Na__ModelLoader__MultiModel.js` into a dedicated `Na__ModelLoader__LineworkColours__.js` module, keeping the loader file focused on loading and geometry.

**Root Cause Fixed**
- `LineMaterial.color` was set to the config fallback colour (`0x141414`, near-black) even when `vertexColors: true`. In Three.js, `LineMaterial` multiplies `material.color × vertexColor`, so a near-black multiplier collapsed every vertex colour to near-black. Fix: set `color = 0xffffff` (white, multiplicative identity) when vertex colours are present.

**New Module: `Na__ModelLoader__LineworkColours__.js`**
- `Na__ModelLoader__ExtractLineColors(geometry)` — safe `fromBufferAttribute` extraction with normalisation.
- `Na__ModelLoader__BuildColorKey()` / `Na__ModelLoader__RegisterColorVote()` / `Na__ModelLoader__ResolveDominantColor()` — weighted vote map for dominant colour resolution.
- `Na__ModelLoader__ResolveDominantImportedLineColor(importedColors)` — dominant colour from a flat colour array.
- `Na__ModelLoader__FindColorByName()` + `Na__ModelLoader__ResolveProfileColorForObject()` — exact and longest-prefix name matching up the ancestor chain.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot()` — propagates `Na__ProfileLineColor` userData from linework root to every paired mesh node for profile-line depth cue effects.

**Updated: `Na__ModelLoader__MultiModel.js`**
- Imports colour utilities from `Na__ModelLoader__LineworkColours__.js` with `@delegate:` pointer.
- Extracted inline upgrade logic into `Na__ModelLoader__UpgradeLineworkRoot()`.
- `Na__ModelLoader__LoadSingleLinework()` is now a thin loader that calls `UpgradeLineworkRoot`.
- Node `name`, `visible`, and `userData` are now correctly preserved during fat-line upgrade.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot()` called in both loops of `Na__ModelLoader__LoadAllModels()`.
- Exports updated to include `Na__ModelLoader__UpgradeLineworkRoot` and `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot`.

**Updated: `Na__AppConfig__Main.json`**
- Added `RenderEffect__ProfileLines__ColorPassIncludesLinework: true` to the `RenderEffect__ProfileLines` block. The ProfileLines module already reads this key — it was missing from the config (SSOT).

**What This Enables**
- Coloured linework from SketchUp MTE edge materials (e.g. depth cue grey series, accent colours) now displays correctly in TrueVision.
- Auto-detected silhouette edges (Sobel profile-lines pass) now inherit the linework vertex colour at that pixel rather than collapsing to the grey fallback.
- Per-mesh `Na__ProfileLineColor` metadata is available for future per-mesh profile colour overrides.

# ---------------------------------------------------------
## TrueVision3D v2.3.4  -  06-Jun-2026
### DataLib Single Source of Truth — Local Materials Library Removed

**Overview**
- Eliminated the duplicate `Na__AppConfig__MaterialsLibrary.json` that lived inside the TrueVision source tree. The SketchUp plugins repo (`Na__Common__DataLib__CoreSuEntityStandards`) is now the single source of truth for all indexed material definitions.
- New `AppCore__DataLib__Loader.js` module fetches all four DataLib index files in parallel from their GitHub raw URLs at startup and caches them for the session.
- Network log confirmed all four GitHub raw URLs resolved on first load (06-Jun-2026).

**New Module: `AppCore__DataLib__Loader.js`**
- `Na__DataLib__LoadAll()` — parallel fetch of all 4 DataLib files, call once at startup.
- `Na__DataLib__GetMaterials()` / `Na__DataLib__GetTags()` / `Na__DataLib__GetComponents()` / `Na__DataLib__GetEdgeMaterials()` — cached getters for each index.
- `Na__DataLib__IsReady()` — boolean guard.
- Error handling: `na-show-toast` event dispatched + rethrow on any URL failure.

**DataLib URLs (hardcoded in loader):**
- Materials: `https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json`
- Tags, Components, EdgeMaterials — same repo prefix.

**Changed Files**
- `02__Src__AppModules/01__AppCore/AppCore__DataLib__Loader.js` — new module (see above).
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js` — v2.0.0: removed `LoadLibrary()` fetch; `BuildLookup()` updated to use `Na__DataLib__CoreIndex__Materials` root key.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — calls `Na__DataLib__LoadAll()` at sequence start; uses `Na__DataLib__GetMaterials()` instead of local fetch.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `MaterialsSystem__Config__LibraryUrl` removed.
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json` — `MaterialsSystem__Config__LibraryUrl` removed.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js` — both `Na__MaterialsSystem__LoadLibrary` call sites replaced with `Na__DataLib__GetMaterials()`.
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — **DELETED**.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — MAT161 `BaseColor` corrected to `rgb(207, 213, 207)`.
- `.cursor/rules/30-materials-library-single-source-of-truth.mdc` — updated to reference the DataLib GitHub URL as the sole authority.

# ---------------------------------------------------------
## TrueVision3D v2.3.3  -  06-Jun-2026
### Scene Inspector — Instance Aggregation + Download .txt

**Scene Inspector — Instance Aggregation**
- Sibling nodes in the scene tree that share the same base name (after stripping TrueVision `_IDxxxxxxx` instancing suffixes) are now collapsed into a single aggregated row in the DOM tree.
- The row shows the base name, a green `×N` instance count badge, and a tooltip with total triangle count. A single visibility dot toggles all instances together.
- All underlying `nodeRef` objects are still registered in the NodeRegistry so Hide All / Restore All operate correctly on every individual node.
- Applies to both the interactive DOM tree and the exported text log (both concise and full reports). Aggregated text lines are formatted as `Mesh 29_4004__Plant__SubComp__Leaf_1 [×2557]`.
- Threshold is 2+ siblings with matching base name. Catches: instanced plant leaves (`_IDxxxxxxx`), chimney pots, window groups, anonymous `[unnamed]` linework segments.

**Scene Inspector — Download .txt**
- New "Download .txt" toolbar button exports the same concise + full report as a timestamped `TrueVision_SceneLog_YYYY-MM-DD_HH-MM-SS.txt` file.
- Shares the `Na__SceneInspector__BuildReportText` helper with the existing Copy Tree button to avoid duplication.
- Button shows "Downloaded!" feedback text for 1.5 s after triggering.

**Changed Files**
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__SceneInspector__Controls.js` — v1.1.0: aggregation region, `BuildAggregatedGroupNode`, `BuildAggregatedTextLine`, `GroupSiblingsByBaseName`, `ExtractBaseName`, `BuildReportText`, `DownloadTree`, updated `BuildDomTree`, `WalkTreeToText`, `GetDomElements`, `InitializeSceneInspector`.
- `index.html` — Download .txt button added to scene inspector toolbar.
- `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` — `na-scene-inspector__count--instances` modifier for the green ×N badge.

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
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — v2.3.2: `AoExclude: false` added to MAT001 default template; `AoExclude: true` on MAT160 and MAT161.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — v1.2.0: same additions synced to SketchUp DataLib (MAT161 added directly by user).
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


