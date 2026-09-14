# ValeVision3D Development Log
# =========================================================

# ---------------------------------------------------------
## ValeVision3D v0.1.6  -  15-Feb-2026
### Building Storey Visibility System — Dolls House View & Per-Storey Toggle
*Note: Developed in Test Environment, Migrated to Production Module*

**Feature Overview**
- Per-storey visibility control for multi-storey building models enabling interior exploration.
- "Dolls house view" cut-away mode: hides topmost visible storey's roof to reveal interior spaces.
- Intelligent roof management: lower storey roofs remain visible as ceilings for spatial context.
- Individual storey toggle: show/hide specific floors independently.
- Roof mode toggle: switch between solid building (all roofs) and dolls house (topmost roof hidden).
- Automatic detection from GLB filenames: no manual configuration required.

**SketchUp GLB Builder v1.6.0 Integration**
- Storey-based export system: detects top-level storey containers tagged 90-93 at model root.
- Per-storey per-element export: children organized by element tags (walls 21, floors 22, roofs 23, etc.).
- World-space transform baking: storey container's transformation pre-multiplied into export root.
- Filename pattern: `{Prefix}Storey__{StoreyName}__{ElementType}__{Suffix}.glb` (e.g., "Storey__GroundFloor__ProposedWalls__MeshModel__.glb").
- Element tag granularity: split tag 10 (Existing) and tag 20 (Proposed) into individual element ranges for finer control.
- Parent transform parameter: `Na__GlbEngine__ExportEntitiesToGlb` and `Na__LineworkEngine__ExportLineworkToGlb` accept optional parent transform.
- Transform chain: `Z_UP_TO_Y_UP * storey.transformation * child.transformation` ensures correct vertical positioning.
- MAX_NESTING_DEPTH increased from 3 to 4 to support storey container nesting level.
- Backward compatible: non-storey models export identically using flat TAG_RANGES system.

**Module Architecture**
- Permanent module: `src__3dObject__ViewBuildingStoreysSystem/3dObject__ViewBuildingStoreys__SystemLogic__.js`.
- Stateful design: maintains internal storey map, visibility state, roof map, and roof visibility flag.
- Clean separation: pure logic in module, DOM manipulation in caller.
- Public API: Initialize, DetectStoreys, SetStoreyVisibility, ShowOnlyBelow, ShowAll, ToggleStorey, ToggleRoof, GetState, GetStoreyDisplayName.
- Configuration support: accepts storey order and default roof visibility mode.
- Zero DOM dependencies: no HTML/CSS coupling, works with any UI framework.

**Storey Detection System**
- Pattern matching: scans loaded GLB model names for `Storey__{StoreyName}__` pattern.
- Supported storey names: GroundFloor, FirstFloor, SecondFloor, ThirdFloor (configurable order).
- Automatic grouping: models with matching storey names grouped together for batch visibility control.
- Roof detection: filters models with "Roof" substring (ProposedRoofs, ExistingRoofs) per storey.
- Custom storey support: detected storeys not in predefined order automatically appended.

**Intelligent Roof Visibility Logic**
- **Solid building mode** (default): All roofs visible for complete exterior view.
- **Dolls house mode**: Topmost visible storey's roof hidden (reveals interior), lower roofs shown as ceilings.
- Dynamic adaptation: roof logic recalculates when storey visibility changes.
- Example flow: GF + FF visible → GF roof shown (ceiling), FF roof hidden (see inside FF).
- Manual override: Roof toggle button switches between modes independent of storey state.

**User Interaction Modes**
- **Individual toggle**: Click storey button to show/hide that floor.
- **Dolls house cut**: Right-click storey button to show only that storey and below (architectural section).
- **Entire building**: "Show Entire Building" button restores all storeys with current roof mode.
- **Roof control**: Dedicated roof button toggles between solid building and dolls house view.

**Test Environment Integration**
- Storey panel UI: bottom-left panel with roof button (top) and storey buttons (ordered top to bottom).
- Visual feedback: green tint for visible storeys, red tint for hidden, blue tint for roof button.
- Icon system: eye (visible), no-entry (hidden), house (solid building), no-entry (dolls house).
- Separator line between roof and storey buttons for clear visual hierarchy.
- State synchronization: UI buttons reflect module state via `GetState()` API.

**Benefits**
- **Interior exploration**: Remove upper floors to see room layouts and spatial relationships.
- **Loft conversions**: Hide final roof to expose top floor interior design.
- **Construction phasing**: Show building progress by revealing storeys sequentially.
- **Client presentations**: Dynamic cut-away views without pre-rendered sections.
- **Accessibility**: Understand multi-storey layouts for wheelchair access planning.

**Technical Details**
- Module state: `{ map, order, hasStoreys, visibleState, roofMap, roofVisible }`.
- Detection complexity: O(n) where n = loaded models (single scan on load/refresh).
- Visibility updates: O(k) where k = models per storey (small filtered sets).
- Roof logic: O(m) where m = roof models per storey (typically 1-2).
- Three.js integration: sets `.visible` property on Object3D nodes (no geometry modification).

**Key Files**
- `src__3dObject__ViewBuildingStoreysSystem/3dObject__ViewBuildingStoreys__SystemLogic__.js` — Core storey visibility module.
- `src__3dObject__ViewBuildingStoreysSystem/3dObject__ViewBuildingStoreys__README__.md` — Integration documentation.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js` — Test environment integration (wrapper functions).
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__DomAndLayout.html` — Storey panel HTML structure.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Stylesheet.css` — Storey panel styling (bottom-left positioning).
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json` — StoreyVisibility configuration section.

# ---------------------------------------------------------
## ValeVision3D v0.1.5  -  15-Feb-2026
### 3D Object Interactions System — Click-to-Open Door Animation 
*Note: Migrated From Test Environment*

**Feature Migration to Main Application**
- Door animation feature promoted from test environment to production ValeVision3D application.
- New module system: `src__3dObject__InteractionsSystem/` for interactive 3D object behaviors.
- Dual model animation: synchronized rotation of mesh (solid geometry) and linework (edges) door models.
- Y-up coordinate space integration: proper vertical rotation axis `(0, 1, 0)` via transform conjugation in GLB export.
- Config-driven architecture: nested configuration under `3dObject__InteractionsSystem` → `3dObject__Interaction__DoorAnimation`.
- Fully qualified property names: `3dObject__Interaction__DoorAnimation__Enabled`, `AnimationDurationMs`, `DefaultRotationDeg`, `ClickThresholdPx`.

**SketchUp GLB Builder v1.5.0 Integration**
- Hierarchy-preserving GLB export for door assemblies (ADR-prefixed entities).
- Door Handler module (`Na__TrueVision__GlbBuilder__SpecialObject__DoorObjectHandling__.rb`) exports ADR > MOD/ROT/OuterShell node structures.
- Transform conjugation: `Z_UP * M_su * inv(Z_UP)` converts SketchUp Z-up local spaces to glTF Y-up.
- Inline detection during scene graph traversal: zero overhead when no doors present.
- Tag 25 mapping: `25__ProposedBuilding__Doors` exports as `*__ProposedDoors__MeshModel/LineworkModel__.glb`.
- Both mesh and linework exporters preserve identical hierarchy with matching node names.

**Main Application Integration**
- Module location: `src__3dObject__InteractionsSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`.
- Auto-initialization after model loading if config enabled and door model groups found.
- Delta time tracking added to render loop for frame-rate-independent animation.
- Model loader category support: `ValeVision__MainBuildingModel__ProposedDoors` added to load order.
- Model toggle controls: "Doors" display name for visibility toggles.
- Configuration: `src__AppConfig/Na__AppConfig__Main.json` under `3dObject__InteractionsSystem`.

**Animation System Features**
- Click detection with orbit drag filtering (4px threshold).
- Raycasting against door meshes (both mesh and linework) with ADR ancestor lookup.
- Smooth easeInOutCubic animation (600ms default duration).
- Mid-animation reversal: click during animation to reverse direction with proportional duration scaling.
- Toggle behavior: CLOSED → OPENING → OPEN → CLOSING → CLOSED state machine.
- Pivot rotation around ROT hinge point using quaternion transforms.
- Per-door configuration: rotation angle parsed from MOD name (e.g., `MOD001__ROT__90-Deg__DoorPanel`).

**Test Environment Cleanup**
- Test scripts migrated to main app; test environment now imports from production module.
- Removed duplicate code: test feature scripts deleted, replaced with migration notes.
- Test config inherits door animation settings with proper nested structure.
- Clean separation: test environment validates production code, ready for next feature prototype.

**Naming Convention (SketchUp → glTF)**
- **ADR** = Door Assembly (e.g., `ADR002__InternalDoor__GroundFloor__PorchToLounge`)
- **MOD** = Modifier Object (e.g., `MOD001__ROT__90-Deg__DoorPanel`) — contains rotating geometry
- **ROT** = Rotation Point (e.g., `ROT001__RotationPoint__DoorHingeCentre`) — hinge pivot position

**Key Files**
- `src__3dObject__InteractionsSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js` — Production door animation module.
- `src__3dObject__InteractionsSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md` — Technical documentation.
- `src__AppConfig/Na__AppConfig__Main.json` — Door animation configuration.
- `index.html` — Import, initialization, delta time tracking, render loop integration.
- `src__ModelLoader/Na__ModelLoader__MultiModel.js` — ProposedDoors category support.
- `src__ModelToggle/Na__UiFeature__ModelToggle__Controls.js` — Doors visibility toggle.

# ---------------------------------------------------------
## ValeVision3D v0.1.4  -  14-Feb-2026
### Testing Environment — Prototype Sandbox & Click-to-Open Doors Feature (Initial Prototype)

**Test Environment Infrastructure**
- Created self-contained prototype testing sandbox (`80__Testing__PrototypeEnvironment/`) for rapid feature development before main integration.
- Standalone Flask server (`TestEnv__FlaskLocalServer.py`) on port 5500 serving test environment + parent ValeVision3D engine modules.
- Separate HTML/JS/CSS bootstrap reusing core engine (navigation, render pipeline, math utils) from parent project.
- Local GLB file loading from `TestEnv__GlbFiles/` folder with automatic discovery via Flask API endpoint.
- Live statistics overlay (FPS, mesh count, vertex count, GLB file count) for performance monitoring.
- Full node graph explorer panel (resizable, collapsible) with per-node visibility toggles for scene inspection.
- Tree view export to clipboard with visual hierarchy (emoji icons, indentation, visibility status).
- Testing mode banner and header modifications to clearly distinguish sandbox from production environment.

**Door Animation System (First Feature Test)**
- Click-to-open/close door animation system using scene graph naming conventions.
- Scans loaded GLB models for door assemblies (`ADR` prefix), modifier objects (`MOD__ROT__XX-Deg`), and rotation points (`ROT` prefix).
- Parses rotation angle from modifier name (e.g., `MOD001__ROT__90-Deg__DoorPanel` extracts 90 degrees).
- Raycasting with pointer movement threshold (4px) to distinguish clicks from orbit camera drags.
- Smooth animation with easeInOutCubic easing, configurable duration (600ms default).
- Pivot rotation around hinge point (Y-axis) using quaternion math for proper door swing.
- Toggle behavior: click closed door to open, click open door to close, click during animation to reverse from current position.
- Mid-animation reversal scales duration proportionally to remaining travel distance.
- Config-driven feature flag (`DoorAnimation__Enabled`) and parameters (duration, default rotation, click threshold).

**Architecture & Integration**
- Feature module pattern: standalone ES6 module (`Test__ModelInteraction__Animation__ClickToOpenDoors__.js`) with exported init and update functions.
- Config-driven feature system: test environment config JSON (`TestEnv__SubAppData__Config.json`) controls feature flags and parameters.
- Clean integration points: import in module region, initialize after GLB loading, update in render loop with delta time.
- Delta time tracking added to render loop for frame-rate-independent animation.
- Module structure follows ValeDesignSuite conventions: regions, 4-space indentation, inline comments, `Na__` namespace prefix.

**Development Workflow Benefits**
- Isolated feature prototyping without affecting production ValeVision3D environment.
- Live reloading and debugging with dedicated dev server and file structure.
- Node explorer provides immediate scene graph inspection for understanding model hierarchies.
- Performance overlay monitors frame rate impact of new features during development.
- Clean migration path: stable features copy from test scripts to main engine with minimal refactoring.

**Key Files Created**
- `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.py` — Flask dev server with GLB file API.
- `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.bat` — Server launch script.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js` — Test environment bootstrap and render loop.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__DomAndLayout.html` — Test environment HTML layout.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Stylesheet.css` — Test environment UI styles.
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json` — Test environment configuration.
- `80__Testing__PrototypeEnvironment/TestEnv__README__.md` — Test environment documentation.
- `80__Testing__PrototypeEnvironment/TestEnv__CurrentFeatureTestScripts/Test__ModelInteraction__Animation__ClickToOpenDoors__.js` — Door animation feature module.

# ---------------------------------------------------------
## ValeVision3D v0.1.3c  -  13-Feb-2026
### Page Layout Touch Controls — Edge Handle Clipping Parity (iOS / Touchscreen)

**Issue Fixed**
- On touch devices (including iOS), image clipping via edge handles was not available in Layout View.
- Mouse controls supported edge clipping (`tc`, `bc`, `lc`, `rc`), but touch controls only supported body move + corner proportional resize.

**Touch Control Update**
- Added edge midpoint hit-testing in touch controls:
  - top-center (`tc`)
  - bottom-center (`bc`)
  - left-center (`lc`)
  - right-center (`rc`)
- Added one-finger edge-drag clipping logic matching PC behavior:
  - `rc` -> updates `clipRight`
  - `lc` -> updates `clipLeft`
  - `bc` -> updates `clipBottom`
  - `tc` -> updates `clipTop`
- Clip limits now enforce minimum visible content and max-clip bounds equivalent to PC constraints.

**Behavior Preserved**
- One-finger body drag still moves image.
- One-finger corner drag still performs proportional resize.
- Two-finger pinch/pan navigation path remains unchanged and still takes precedence for canvas navigation.

**Key File Modified**
- `src__PageLayoutSystem/Na__PageLayoutSystem__Controls__TouchScreen__.js`
  - Added edge hit-test branches.
  - Added clip state persistence in drag start transform.
  - Added edge clipping branches in touch move handler.
  - Updated module header comments to reflect clipping support.

# ---------------------------------------------------------
## ValeVision3D v0.1.3b  -  13-Feb-2026
### Layout View Export Fix — Profile Lines / Camera Projection Synchronization

**Issue Fixed**
- Layout View images could show profile lines at a slightly different perspective/FOV than the base render, creating a "layered perspective" look.
- Root cause was capture-time desynchronization between color pass (`composer.render()`) and profile-line normal pass (`renderProfileNormals()`), especially during custom export resize/aspect changes.

**Pipeline Synchronization Update**
- Export pipeline now resolves a full render pipeline state bundle instead of composer-only access.
- Capture order now enforces synchronized projection and buffer state:
  - camera aspect/projection update
  - composer resize
  - profile lines normal render target resize
  - profile normals re-render
  - composer render
- Restore order now also re-syncs profile lines after returning renderer/composer to live viewport size.

**3-Stage Naming / API Wiring**
- Naming convention preserved with `Na__...__...__...` style throughout new helper and state plumbing.
- Added `Na__UiFeature__ResolveRenderPipelineState(...)` helper in export controls.
- `Na__UiFeature__InitializeImageExportControls(...)` now accepts render-pipeline-state getter (composer + helpers), backward compatible with legacy composer getter shape.

**Key Files Modified**
- `src__ImageExport/Na__UiFeature__ImageExport__Controls.js`
  - Added render-pipeline-state resolver helper.
  - Updated export render path to call `setProfileLinesSize(...)` and `renderProfileNormals()` at capture and restore boundaries.
- `index.html`
  - Added shared `Na__RenderPipeline__State` module variable.
  - Updated image export initializer wiring to pass render-pipeline-state getter.
  - Updated render loop and resize code paths to use shared pipeline state consistently.

# ---------------------------------------------------------
## ValeVision3D v0.1.3  -  12-Feb-2026
### Render Effect — Profile Lines (SketchUp-Style Silhouette Edges)

**Profile Lines Feature**
- SketchUp-style "Profile Lines" effect: extra visible edges around rounded/cylindrical geometry (finials, chimney pots, turned details) so they read clearly in the whitecard view.
- Implemented as a post-processing pass: scene normals rendered to a separate buffer; Sobel edge detection on the normal buffer; dark profile lines composited over the scene before FXAA.
- Line geometry (LineSegments2) is hidden during the normal pass to avoid artifacts.
- Enable/disable and parameters (edge color, normal threshold, edge width) driven by AppConfig `RenderEffect__ProfileLines`.

**Config & Integration**
- New AppConfig block `RenderEffect__ProfileLines`: `Enabled`, `EdgeColor`, `EdgeThresholdNormal`, `EdgeThresholdDepth`, `EdgeWidth`.
- Composer setup returns `{ composer, renderProfileNormals, setProfileLinesSize }`; render loop calls `renderProfileNormals()` each frame before `composer.render()`; resize handler calls `setProfileLinesSize(width, height)`.

**Key Files**
- `src__RenderPipeline/Na__RenderEffect__ProfileLines__.js` — normal buffer render, Sobel shader, pass creation.
- `src__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js` — optional ProfileLines pass insertion, config wiring.
- `src__AppConfig/Na__AppConfig__Main.json` — `RenderEffect__ProfileLines` block.
- `index.html` — config destructuring, composer result handling, loop and resize wiring.

# ---------------------------------------------------------
## ValeVision3D v0.1.2  -  12-Feb-2026
### 3D Render Pipeline — Ground Line Visibility & RenderConfig__Linework Naming

**Ground Line Visibility Fix**
- Ground line (building base meeting ground plane) was invisible in viewport due to depth fighting with mesh surfaces.
- Root cause: renderer uses `logarithmicDepthBuffer: true`; depth is written in fragment shader via `gl_FragDepth`, so WebGL polygon offset has no effect (hardware offset does not modify `gl_FragDepth`).
- Solution: fragment shader depth bias via `LineMaterial.onBeforeCompile` — after `#include <logdepthbuf_fragment>`, subtract a small configurable value from `gl_FragDepth` so line fragments win the depth test against coplanar mesh.
- Depth bias value configurable in AppConfig; default `0.00015` balances visibility of ground line without causing distant lines to pop in front of surfaces.

**RenderConfig__Linework Config & 3-Stage Naming**
- Linework config block renamed from `"linework"` to `"RenderConfig__Linework"` for consistency with 3-stage naming.
- All linework properties use `RenderConfig__Linework__*` keys: `EdgeColor`, `LineWidth`, `PolygonOffsetFactor`, `PolygonOffsetUnits`, `RenderOrder`, `DepthBias`.
- Downstream code in `Na__ModelLoader__MultiModel.js` updated to read `config.RenderConfig__Linework` and `lineworkConfig.RenderConfig__Linework__*` properties.
- Single source of truth for line appearance and depth behaviour; no other files reference these keys.

**Key Files Modified**
- `src__AppConfig/Na__AppConfig__Main.json` — `RenderConfig__Linework` block and property names.
- `src__ModelLoader/Na__ModelLoader__MultiModel.js` — depth bias hook on LineMaterial, config key references.

# ---------------------------------------------------------
## ValeVision3D v0.1.1  -  12-Feb-2026
### Page Layout System — Image Clipping with Edge Handles

**Edge Handle Clipping Feature**
- Edge handles (top, bottom, left, right) now clip/trim images instead of free resizing.
- Dragging edge handles inward crops the image from that edge while maintaining container size.
- Corner handles continue to scale the image proportionally (behavior unchanged).
- Clipping is non-destructive: image container maintains full dimensions; only visible portion changes.
- Minimum 10mm visible content enforced to prevent complete clipping.

**Technical Implementation**
- Added clip properties to `imageTransform` state: `clipTop`, `clipRight`, `clipBottom`, `clipLeft` (all in mm).
- Canvas rendering applies clipping via `ctx.clip()` with calculated visible region rectangle.
- Source image draw uses 9-parameter `drawImage()` to map clipped source region to full container bounds.
- PC controls updated: edge handle drag calculates clip values based on drag delta and enforces maximum clip constraints.
- Touch controls description clarified: only corner handles used on touch devices (edge handles PC-only).

**Code Organization**
- Created new "Selection Handle Rendering System" region in `Na__PageLayoutSystem__CanvasRenderPipeline__.js`.
- Extracted handle drawing logic into specialized functions:
  - `Na__PageLayout__DrawHandle()` — draws single handle square
  - `Na__PageLayout__DrawSelectionHandles()` — draws all 8 handles
  - `Na__PageLayout__DrawSelectionBorder()` — draws dashed selection border
- Improved code maintainability by grouping all handle rendering logic in dedicated region block.

**User Experience**
- Intuitive trimming workflow: drag edge handles inward to crop unwanted portions of image.
- Visual feedback: handles always show full container bounds for clear reference.
- Selection border indicates full container area; clipped image visible within that boundary.
- Allows precise image composition without affecting layout positioning.

**Key Files Modified**
- `src__PageLayoutSystem/Na__PageLayoutSystem__SystemLogic__Main__.js` — added clip properties to state initialization.
- `src__PageLayoutSystem/Na__PageLayoutSystem__CanvasRenderPipeline__.js` — clipping render logic, reorganized handle system.
- `src__PageLayoutSystem/Na__PageLayoutSystem__Controls__Pc__.js` — edge handle clipping behavior, clip value constraints.
- `src__PageLayoutSystem/Na__PageLayoutSystem__Controls__TouchScreen__.js` — updated description (no edge handles on touch).

# ---------------------------------------------------------
## ValeVision3D v0.1.0  -  12-Feb-2026
### OrbitHelperCube GLB Integration — Automatic Orbit Target Positioning

**Automatic Orbit Target from SketchUp Exported Cube**
- OrbitHelperCube GLB files exported from SketchUp now automatically define the camera orbit focus point.
- Cube GLB files follow naming pattern: `{ProjectName}__NN__OrbitHelperCube__MeshModel__.glb`.
- System detects OrbitHelperCube URLs in project model arrays and separates them from regular models.
- Cube center position (bounding box) becomes the orbit target, eliminating manual JSON configuration per project.
- Cube is hidden by default; visible only when `OrbitHelperCube__Debug__Visible` flag is enabled in AppConfig.

**Implementation**
- New functions in `Na__ModelLoader__MultiModel.js`:
  - `Na__ModelLoader__SeparateOrbitCubeUrl()` — filters OrbitHelperCube URL from model array.
  - `Na__ModelLoader__LoadOrbitHelperCube()` — loads cube GLB and extracts center position.
- OrbitHelperCube URL filtered before model loading, ensuring it never appears as a category or toggle button.
- Loading sequence: separate cube URL → load cube → set orbit target → load remaining models.
- Falls back to `Dev__DefaultCube` position when no OrbitHelperCube found (backward compatible).

**Configuration Changes**
- Removed `Camera__DefaultTarget` from `Camera__DefaultPosition` in AppConfig (orbit target now from cube or Dev__DefaultCube).
- Added `OrbitHelperCube__Debug__Visible: false` flag in `Dev__DeveloperMode` config.
- Project JSON files can remove `Camera__DefaultTarget` when OrbitHelperCube GLB is present.
- Camera UI JSON output split into two sections: `Camera__DefaultPosition` (Pos/Rotation/FOV) and `OrbitHelperCube__Position` (target) for easier copy/paste.

**Benefits**
- No manual orbit target configuration required per project — set in SketchUp instead.
- Consistent orbit positioning across projects using exported cube geometry.
- Debug visibility toggle allows inspection of orbit cube position when needed.
- Backward compatible: projects without OrbitHelperCube use Dev__DefaultCube fallback.

**Key Files**
- `src__ModelLoader/Na__ModelLoader__MultiModel.js` — cube detection, separation, and loading functions.
- `index.html` — loading sequence integration, orbit target application, debug flag parsing.
- `src__AppConfig/Na__AppConfig__Main.json` — removed Camera__DefaultTarget, added debug flag.
- `src__CameraUtils/Na__UiFeature__CameraPosition__Controls.js` — split JSON output format.

# ---------------------------------------------------------
## ValeVision3D v0.0.9  -  11-Feb-2026
### Page Layout View System (LayoutVision 2D)

**2D Page Layout System for A3 Document Composition**
- Standalone browser tab opens when user clicks "Layout View" button in Export Image panel.
- Rendered 3D viewport image positioned on A3 title block template (landscape 420x297mm).
- Full 2D canvas interaction: drag to reposition, corner/edge handles to resize image.
- Mouse wheel zoom toward cursor, middle/right-click pan, two-finger pinch/pan on touch.
- Exports exact A3-scale PDFs: "Export Full Layout" (title block + image) or "Export Image Only".
- Uses jsPDF v4.1.0 (version-locked, CDN independent, self-contained UMD build).

**Architecture**
- Data transfer via `window.opener` global property (avoids localStorage 5-10 MB size limit).
- All positioning stored in mm coordinates relative to A3 origin; maps directly to jsPDF units.
- DPR-aware canvas rendering for sharp display on retina screens.
- Image initially centered at 80% of A3 printable area with source aspect ratio preserved.
- PC controls: proportional corner resize, free edge resize, body drag.
- Touch controls: single-finger drag/resize, two-finger pinch zoom + pan.

**Key Modules**
- `Na__PageLayoutSystem__Layout__.html` — standalone page with Vale-branded header matching main app.
- `Na__PageLayoutSystem__SystemLogic__Main__.js` — orchestrator; loads image from opener, manages state.
- `Na__PageLayoutSystem__CanvasRenderPipeline__.js` — 2D rendering: A3 paper, title block, image, handles.
- `Na__PageLayoutSystem__2dNavigationControls__.js` — zoom toward cursor, pan on middle/right-click.
- `Na__PageLayoutSystem__Controls__Pc__.js` — left-click hit-test, drag/resize with cursor feedback.
- `Na__PageLayoutSystem__Controls__TouchScreen__.js` — touch drag/resize/pinch with gesture disambiguation.
- `Na__PageLayoutSystem__PdfExport__A3__.js` — jsPDF integration for exact A3-scale PDF export.
- `01__Dependencies__VersionLocked/jspdf.umd.js` — jsPDF v4.1.0 vendored dependency (1.2 MB).

**Integration**
- Shared render helper `Na__UiFeature__RenderToDataUrl()` in Export Controls module.
- Both "Export Now" and "Layout View" use same render pipeline (custom or viewport mode).
- Layout View button added to Export Image panel below "Export Now" button.
- Export controls refactored to eliminate code duplication between export paths.

**UI**
- Header matches main ValeVision app (white background, Vale logo, blue border); title "LayoutVision 2D".
- Secondary actions bar below header with Export Full Layout, Export Image Only, Close buttons.

# ---------------------------------------------------------
## ValeVision3D v0.0.8  -  11-Feb-2026
### Image Export Safe Frame & Rule of Thirds Grid Overlay

**Safe Frame Overlay**
- Transparent grey overlay bars (top, bottom, left, right) showing export crop area.
- Dynamically updates based on selected aspect ratio (3:2, 4:3, 16:9).
- Appears when Image Export panel is opened; hides when panel is closed.
- Automatically recalculates on window resize with debounced updates.
- Uses aspect ratio fitting algorithm for pillarbox (wider viewport) or letterbox (taller viewport) display.

**Rule of Thirds Grid Overlay**
- Composition guide lines dividing safe frame into 9 equal parts (3x3 grid).
- Vale blue (#182c3b) at 50% opacity for brand consistency.
- Line thickness 1.5px for improved visibility.
- Updates dynamically with aspect ratio changes.
- Positioned within safe frame area for accurate composition guidance.

**Implementation**
- New module `Na__UiFeature__ImageExport__ViewportOverlays.js` handles overlay creation, positioning, and updates.
- CSS module `image-export-overlays.css` provides styling with z-index 500 (between viewport and menu).
- Overlays use `pointer-events: none` to allow continued 3D interaction through overlay.
- Integrated into export controls with show/hide on panel toggle and aspect ratio slider changes.
- Overlay automatically hides when custom export is disabled.

**Key Files**
- `src__ImageExport/Na__UiFeature__ImageExport__ViewportOverlays.js` — overlay logic and positioning calculations.
- `src__Styles/image-export-overlays.css` — overlay styles and animations.
- `src__ImageExport/Na__UiFeature__ImageExport__Controls.js` — integration with export panel controls.
- `index.html` — overlay DOM elements added to root container.

# ---------------------------------------------------------
## 11-Feb-2026 - ValeVision3D v0.0.7
### Enhance Whitecard Post-Process Pipeline

**Image Export Post-Processing**
- Added "Enhance Whitecard" toggle to Export Image panel (default: on).
- Post-processing runs at export time only; viewport render pipeline unchanged.
- Canvas 2D pixel manipulation pipeline applied after Three.js render, before download.
- Config-driven effect order and parameters via `Na__AppConfig__Main.json` → `ImageExport__PostProcessEffects`.

**Levels Effect** (`Na__ImageExport__PostProcessEffects__Levels.js`)
- Pixel-level black/white/gamma remapping via ImageData.
- White point set to 230 clips light grays to pure white; dark lines preserved.
- Removes subtle face shading from render for clean whitecard line art.

**High Pass Sharpen Effect** (`Na__ImageExport__PostProcessEffects__HighPassSharpen.js`)
- CSS `blur()` filter for GPU-accelerated blur; high-pass layer = (original - blurred) / 2 + 128.
- Overlay blend mode sharpens black lines against white background.
- Configurable radius, blend mode, opacity.

**Pipeline Orchestrator** (`Na__ImageExport__PostProcessEffects__Pipeline.js`)
- Sorts effects by `Order` field; applies enabled effects sequentially.
- Each effect is a standalone module; pipeline reads config and invokes them.

**Key Files**
- `src__AppConfig/Na__AppConfig__Main.json` — `ImageExport__PostProcessEffects` config block.
- `src__ImageExport/Na__UiFeature__ImageExport__Controls.js` — enhance toggle, pipeline integration.
- `src__ImageExport/Na__ImageExport__PostProcessEffects__*.js` — Levels, HighPassSharpen, Pipeline.

# ---------------------------------------------------------
## 10-Feb-2026 - ValeVision3D v0.0.6
### Dynamic Model Toggle System & Build Pipeline Integration

**Model Toggle Controls**
- Created `src__ModelToggle/Na__UiFeature__ModelToggle__Controls.js` module for per-category visibility toggling.
- Dynamic button generation from loaded model groups Map (category -> THREE.Group).
- User-friendly display names: "Existing Building", "Design Proposal", "Landscape".
- Pairs Mesh + Linework models per category into single toggle button.
- Active/inactive visual states with green dot indicator and line-through styling.
- Future-proof: automatically generates buttons for new categories (furniture, vegetation, context).
- Integrated as expandable dropdown menu item "Toggle Model Layers" positioned between "Export Image" and "Download Position Data".
- Panel title: "Model Parts List" displays category toggle buttons.
- Uses standard dropdown panel pattern with toggle button for consistent UI behavior.
- Panel expands/collapses dynamically matching other menu items (Adjust Camera Lens, Export Image, Download Position Data).

**Project.json Format v4**
- Introduced `valeVision_ModelUrls` array format to support multiple model URLs per project.
- Deprecated `valeVision_ModelUrl_BaseMesh` / `_Linework` (v3) format.
- Maintains backward compatibility in `Na__AppUtils__ExtractModelUrls` for all legacy formats (v1-v4).
- Cleans legacy keys when writing/updating project.json files.

**Build Automation Pipeline Updates**
- Updated `AutomationUtil__FetchLocalProjects__BuildWhitecardopediaProject__Main__.py`:
  - Removed version-based GLB selection (parse_glb_version, select_latest_glb_by_layer).
  - Added `__NaModel__` to `__ValeVision__` namespace rebranding in CDN URL generation.
  - Now discovers all root-level GLBs (skips `01__Archive/` subfolder).
  - **Critical fix**: Always updates model URLs in existing projects instead of skipping entirely.
  - Writes v4 `valeVision_ModelUrls` array format for all new and refreshed projects.
  - Added "Model URLs refreshed" counter and status messages to console output.
  - Fixed Unicode encoding errors in Windows console (replaced arrow and em-dash characters).
- Verified `AutomationUtil__BuildCloudflareBucket__WhitecardopediaProjects__Main__.py` consistency with new naming.

**Validation & Testing**
- Successfully tested full pipeline on `2026/61721__Payne` project.
- Confirmed 6 GLB models discovered (Landscape, Existing Building, Proposed Building × 2 types each).
- Verified project.json updated with v4 format and `__ValeVision__` rebranded CDN URLs.
- Confirmed models load and render correctly in ValeVision3D viewer with new toggle controls.

# ---------------------------------------------------------


# ---------------------------------------------------------
## 10-Feb-2026 - ValeVision3D v0.0.5 
### Multi-Model Category Loading System
- New `Na__ModelLoader__MultiModel.js` module for loading multiple GLB model pairs.
- Models are now classified by ValeVision category (e.g. MainBuildingModel__Existing, LandscapeEnvironment).
- Priority-based sequential loading order matches GLB Builder tag range definitions.
- Each category gets its own THREE.Group enabling future per-category visibility toggling.
- URL parser accepts both `__ValeVision__` (preferred CDN) and `__NaModel__` (backstop) namespaces.
- Mesh and linework loading logic extracted from index.html into dedicated module.
- AppConfig modelDefaults now uses `modelUrls` array instead of separate base/linework URLs.
- Backwards-compatible project.json extraction supporting all four legacy URL formats (v1-v4).
- Cloudflare R2 sync script updated to rename `__NaModel__` to `__ValeVision__` in CDN filenames.
- R2 sync script now skips `01__Archive/` subfolder and pushes all root-level GLBs without version logic.
# ---------------------------------------------------------


# ---------------------------------------------------------
## 05-Feb-2026 - ValeVision3D v0.0.4 
### Web Project Path Fixes
- Added absolute GitHub Pages base URL for project.json fetching.
- Added year-aware and legacy project ID normalization for web loading.
- Removed hard-coded 2025 web path to prevent 404 on new year projects.
# ---------------------------------------------------------


# ---------------------------------------------------------
## 05-Feb-2026 - ValeVision3D v0.0.3 
### Normalized Navigation Controls
- Added normalized mouse wheel zoom with fixed step per tick.
- Added touch-first navigation module for iPad/mobile detection.
- Routed nav initialization through device-aware control selection.
- Added AppConfig-based navmode settings for mouse and iPad controls.
- Inverted mouse wheel zoom direction for expected scroll behavior.
- Added arrow key movement alongside WASD navigation.
- Added mouse wheel acceleration after 3 consecutive ticks for faster long-range zoom.
# ---------------------------------------------------------


# ---------------------------------------------------------
## 05-Feb-2026 - ValeVision3D v0.0.2 
### Navigation, Units, and Camera Tools Updates
- Added Dev__DeveloperMode default cube for fixed scale + pivot reference.
- Standardized config units as integer millimeters with mm-to-units helpers.
- Updated camera defaults schema and live JSON export/import panel.
- Removed bounding-box recentering logic and added orbit limits by scale.
# ---------------------------------------------------------


# ---------------------------------------------------------
## 04-Feb-2026 - ValeVision3D v0.1.0 
### Total Engine Rebuild and New Features
- Switched to a new engine architecture.
  - Previously use Babylon.js for the 3D engine.
  - Now using Three.js for the 3D engine.
- Refactored the old codebase to be more modular and maintainable.
# ---------------------------------------------------------