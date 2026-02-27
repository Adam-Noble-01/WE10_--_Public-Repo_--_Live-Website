# TrueVision3D Development Log
# =========================================================

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


