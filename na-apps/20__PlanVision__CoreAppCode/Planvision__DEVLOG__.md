# Noble Architecture - PlanVision Web App
## Development Log

# =============================================================================

# -----------------------------------------------------------------------------

## PlanVision - Version 2.3.1 - 18-Jul-2026
### Added - DESIGN & ACCESS STATEMENT HTML ROUTE (CRISP MARKDOWN-BUILT STATEMENTS)

**New HTML-first statement display (PDF route retained as fallback):**
- Added `DesignAccessStatement__HtmlViewer__.js` module (`NaPlanVision.DesignAccessStatement.HtmlViewer`) containing:
  - `Na__DasHtml__ShowStatement` — fetches the builder-generated statement HTML (CDN first, live site fallback, local portal fallback in local dev) and injects it as an endless-scroll A4 document with crisp, selectable text
  - `Na__DasHtml__ResolveImageSources` — rewrites statement image links from the `design-access-statement` object in `PlanVision__ProjectData__.json` (single source of truth for CDN links) with a CDN → live → local fallback chain
  - `Na__DasHtml__DownloadPdf` — bakes a pageless-style A4 PDF from the rendered HTML in the browser (html2canvas + jsPDF, pinned versions lazy-loaded on demand). The document is captured in canvas-safe tiles from an off-screen clone and assembled onto sequential tall pages, each up to the 14399pt PDF format cap, at FULL A4 width — long statements span a few ~5m pages instead of being downscaled illegibly (improves on the Py_PdfUtils single-page approach, which also hit browser canvas limits)
- `Na__Menu__ShowDesignAccessStatement` now prefers the HTML route and cascades: HTML -> DAS-object PDF link -> legacy Sxx PDF document -> empty state

**New common statement stylesheet (single source of truth):**
- Added `04__Style__AppStylesheets/StyleSheet__DesignAccessStatement__.css` — refactored from the Typora authoring theme `01-na-diary-view-a4.css`, scoped under `.na_das_document`
- Used by BOTH the in-app viewer and every standalone generated statement HTML, so a style tweak here updates all statements at once

**Data schema:**
- New `design-access-statement` object in `PlanVision__ProjectData__.json` (written by `ProjectVision__DasBuilder__.py`): enable flag, folder locations, markdown/HTML/PDF filenames, CDN + live URL set, and bundled image inventory
- `Loader__DrawingsDataManager__.js` exposes it via `Na__Data__GetDesignAccessStatementConfig()`

**Share link:**
- New `DAS` share code: `&doc=DAS` deep-links straight into the statement view
- `Na__Share__CopyStatementLink` added; the toolbar share button and the statement-view Share button both produce the DAS link when the statement is open

**UI:**
- New statement toolbar (Download PDF + Share Document Link) and `#design-access-statement-html-host` swap in for the PDF.js controls when HTML mode is active (`.na-das-mode--html`)
- Version bumped from 2.3.0 to 2.4.0

# -----------------------------------------------------------------------------

## PlanVision - Version 2.3.0 - 01-Jun-2026
### Added - DOCUMENT SHARE LINK SYSTEM

**New per-document shareable URL feature:**
- Added `AppCore__DocumentShareLink__.js` module (`NaPlanVision.DocumentShareLink`) containing:
  - `Na__Share__ExtractDocCodeFromFilename` — extracts the short code prefix from a file-name (e.g. `BH03_T02_D01`)
  - `Na__Share__BuildShareUrlForCode` — builds an absolute URL with `&doc=<code>` preserving all existing query params
  - `Na__Share__CopyCurrentDocumentLink` — reads the currently displayed drawing, builds URL, copies to clipboard, toasts result
  - `Na__Share__ResolveDrawingByDocCode` — finds a drawing object across Drawing, Specification, and Statement lists by code
  - `Na__Share__OpenDeepLinkedDocumentIfPresent` — on page load, reads `?doc=` param and auto-opens the matching document

**New Share Document Link button:**
- Added `#shareDocLinkBtn` button to the View & Export section in the toolbar sub-menu
- Button appears alongside `Download PDF` and `Reset View`
- Disabled state (no drawing open) shows a friendly toast rather than silently failing

**Deep-link support:**
- Visiting a share URL (e.g. `?project=BH03&...&doc=BH03_T02_D01`) now auto-opens that drawing directly
- Unresolvable codes fall back to the Drawing Register with a warning toast

**Current drawing tracking:**
- `DrawingsCanvas__DrawingLoader__.js` now tracks the active drawing object in `currentDrawing` state
- New accessor `Na__Canvas__GetCurrentDrawing()` exposed on the module API

**Menu system improvements:**
- `Na__Menu__ShowDrawingsMenu` and `Na__Menu__ShowSpecificationsMenu` now accept an optional `preferredFileName` argument
- When provided, the specified document is loaded and its button highlighted instead of defaulting to the first item

**Config & housekeeping:**
- Added `Features.DocumentShareLink.enabled` flag to `AppConfiguration__PlanVision__MainAppSettings__.json`
- Feature is gated with strict `=== true` per configuration authority rule
- Version bumped from 2.2.0 to 2.3.0

# -----------------------------------------------------------------------------

## PlanVision - Version 2.2.0 - 04-Apr-2026
### Added - DESIGN & ACCESS STATEMENT PDF VIEWER SYSTEM

**New dedicated Design & Access Statement pipeline (Sxx documents):**
- Added `Sxx` document detection in `Loader__DrawingsDataManager__.js` for files such as `S01`.
- Added statement-specific accessors for fetching the primary Design & Access Statement document.
- Statement documents now bypass the drawing PNG pipeline and open in a dedicated PDF viewer flow.

**New in-app PDF renderer (no iframe/embed):**
- Added a dedicated module and styles for a native-feeling in-app viewer:
  - `03__Src__AppModules/12__DesignAccessStatement/DesignAccessStatement__Viewer__.js`
  - `03__Src__AppModules/12__DesignAccessStatement/DesignAccessStatement__Styles__.css`
- Integrated continuous page rendering to canvas using `pdf.js`.
- Added viewer controls for zoom in/out, fit width, page jump, load state, and error handling.

**Main menu integration:**
- Added new main category button: `Design and Access Statement`.
- Added menu routing to open the statement viewer directly from main menu.
- Preserved existing Drawings and Specifications flows and navigation behavior.

**Version-locked dependency management:**
- Added pinned dependency assets under:
  - `01__AppDependencies__VersionLocked/PdfJs__3.11.174/build/`
- Added dependency lock metadata file:
  - `01__AppDependencies__VersionLocked/DependencyLock__PlanVisionPdfRenderer__.json`
- Runtime now uses local version-locked PDF renderer + worker files (no CDN dependency).

**Module path alignment update:**
- Moved Design & Access Statement module prefix from `11__...` to `12__...` to avoid conflict with User Interaction series.
- Updated all script/style wiring references accordingly.

**UI cohesion refinements:**
- Updated DAS viewer styling to align with existing PlanVision palette and control language.
- Replaced out-of-palette bronze/brown tones with core app variables and neutral theme values.


# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.5 - 04-Apr-2026

### Fixed - Drawing Register Name Pollution and ISO Size Presentation

Document filenames in `PlanVision__ProjectData__.json` include paper format metadata segments such as `IsoA2`. The filename parser was treating this segment as part of the human-readable document title, which caused register rows and drawing button labels to show values like `Ground Floor Plans - Iso A2`. At the same time, the register size column displayed raw `A2` rather than the preferred `ISO A2` presentation.

#### Root Cause
- `Na__Data__ParseFilename()` in `Loader__DrawingsDataManager__.js` parsed `IsoA2` as a normal name segment instead of non-title metadata
- The parsed `document-name` is reused by both:
  - Drawing/specification selection buttons
  - Drawing Register table rows
- Register `Size` column used raw `document-size` values without a display formatter

#### Drawings Data Manager (`Loader__DrawingsDataManager__.js`)
- Added `na_IsPaperFormatSegment()` helper to detect paper-size metadata segments (`IsoA2`, `ISOA2`, `A2`, etc.)
- Updated filename parsing loop to skip detected paper-format segments when building `document-name`
- Preserved existing drawing code extraction and revision extraction behavior

#### Landing Page Register (`LandingPage__Main__.js`)
- Added `na_FormatDocumentSizeForDisplay()` helper to normalize size display to `ISO A#`
- Updated drawing register row rendering to pass `document-size` through the formatter before output
- Register now displays `ISO A2` (and equivalent A-series values) in the `Size` column

#### Canvas View Controls (`DrawingsCanvas__ViewControls__.js`)
- Added defensive size normalization helper `na_NormalizeDrawingSizeKey()` in scale calculation path
- Supports size strings like `ISO A2` by normalizing to `A2` for `PAPER_SIZES` lookup
- Ensures measurement scale calculations remain stable if ISO-prefixed size strings enter runtime state

#### Files Modified
- `03__Src__AppModules/04__AssetAndDataLoaders/Loader__DrawingsDataManager__.js`
- `03__Src__AppModules/09__AppLandingPage/LandingPage__Main__.js`
- `03__Src__AppModules/05__DrawingsCanvas/DrawingsCanvas__ViewControls__.js`

### Fixed - Design & Access Statement Name Spacing in Filename Parser

The drawing register parser rendered the statement token `Design&AccessStatement` without spacing around the ampersand. This update applies a targeted display-name mapping for that exact token so statement rows and any parser consumers display the expected text.

#### Drawings Data Manager (`Loader__DrawingsDataManager__.js`)
- Added `Na__Data__FormatFilenameNameSegmentForDisplay()` helper in the filename parser path
- Added exact token normalization: `Design&AccessStatement` (normalized form) -> `Design & Access Statement`
- Preserved generic segment parsing behavior for all other names (no global ampersand normalization)
- Preserved existing revision extraction and paper-size metadata skipping behavior

#### Files Modified
- `03__Src__AppModules/04__AssetAndDataLoaders/Loader__DrawingsDataManager__.js`

# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.4 - 08-Mar-2026

### Fixed - Local Development Drawing Loading (CDN-First Asset Strategy)

Drawings failed to load on localhost because CDN loading was explicitly disabled for local development environments. The local project portal only contains JSON config files and placeholder text files — the actual drawing PNG/PDF assets only exist on the Cloudflare CDN. With CDN skipped, the app attempted to fetch images from local paths that did not exist, resulting in a load failure every time a drawing was selected.

#### Root Cause
- `buildCdnUrlForAsset()` in DrawingLoader returned `null` immediately when `isLocalDev` was true, preventing CDN URLs from ever being constructed for drawing images on localhost
- `CDN_CONFIG_URL` in the main HTML init was gated behind `!IS_LOCAL_DEV`, so the JSON project data also bypassed CDN and loaded from the local placeholder file instead of the real project data

#### DrawingsCanvas Drawing Loader (`DrawingsCanvas__DrawingLoader__.js`)
- Removed the `if (isLocalDev) return null;` guard from `buildCdnUrlForAsset()` so CDN URLs are built for drawing image assets on all environments
- SessionCache now receives CDN URLs on localhost and fetches from CDN first, falling back to local paths if CDN is unavailable

#### Main HTML Init (`PlanVision__WebApp__Main__.html`)
- Removed the `!IS_LOCAL_DEV &&` condition from `CDN_CONFIG_URL` construction so JSON project data also loads from CDN first on localhost
- Local JSON path is retained as the automatic fallback via `CloudflareCdnLoader.Na__Cdn__FetchJsonWithFallback()`

#### Files Modified
- `03__Src__AppModules/05__DrawingsCanvas/DrawingsCanvas__DrawingLoader__.js`
- `PlanVision__WebApp__Main__.html`

# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.3 - 08-Mar-2026

### Added - Dedicated Measurement Tools Panel

Measurement tools were previously buried as text-only buttons at the bottom of the drawings sidebar menu, making them nearly invisible on projects with large document sets. This release extracts them into a dedicated floating panel in the top-right corner, modelled on TrueVision's dropdown menu pattern, with custom icons and interactive feedback.

#### Measurement Tools Panel (`UserInterface__MeasurementToolsPanel__.js`) - NEW MODULE
- Floating `<details>`-based dropdown panel positioned top-right over the canvas
- Tape measure icon in the header bar with "Measurement Tools" title and dropdown arrow
- Each tool (Linear, Rectangle, Area, Clear) displayed as a button with a custom icon and label
- Active tool feedback: selected tool button highlights with brand-colour left accent border
- Hover animations on all tool buttons for clear interactive affordance
- Prompt animation on app launch: panel opens briefly then auto-closes to show users the tools exist
- Collapsible "Dimensions" sub-section listing all finalised measurements
- Editable name input per measurement so users can label each dimension
- "Copy All to Clipboard" button formats measurements as plain text with names and values
- Defensive `typeof` checks on all measurement system API calls for cache-resilience

#### Measurement Tools Panel Stylesheet (`StyleSheet__MeasurementToolsPanel__.css`) - NEW STYLESHEET
- Adapted from TrueVision's `Na__UiFeature__Styles__DropdownAndToast__.css` using PlanVision CSS variables
- Box-shadow depth effect emphasising the panel as a floating tool suite over the canvas
- Animated open/close transitions (opacity + translateY over 0.24s)
- Active state, hover state, and danger state button styles
- Responsive breakpoint for mobile devices
- z-index 9997: above canvas (9996), below toolbar (9998) and header (9999)

#### Measurement Tool Icons (`02__AppAssets__PlanVision/MeasureToolIcons/`) - NEW ASSETS
- `Icon__MeasureTools__TapeMeasure__.png` - panel header icon
- `Icon__MeasureTools__LinearMeasurment__.png` - linear/tape measure tool
- `Icon__MeasureTools__AreaMeasurment__.png` - freeform area tool
- `Icon__MeasureTools__RectangularMeasurment__.png` - rectangle area tool
- `Icon__MeasureTools__ClearMeasurements__.png` - clear all measurements

### Changed - Measurement System Refactored for Panel Integration

#### MeasurmentToolsSystem Main (`MeasurmentToolsSystem__Main__.js`)
- Removed sidebar UI injection (`injectUi`, `applyToolVisibility`, `wireButtons`) - panel now owns all tool buttons
- Replaced with `injectFloatingButtons()` for Accept/Cancel canvas overlay only
- Added callback system: `onToolChangeCallback` and `onMeasurementChangeCallback`
- Added `Na__Measure__GetMeasurements()` to expose finalised measurements array
- Added `Na__Measure__ActivateToolByName()` for panel-driven tool activation
- Added `Na__Measure__SetOnToolChange()` and `Na__Measure__SetOnMeasurementChange()` callback registration
- `setActiveTool()` and `cancelTool()` now fire `notifyToolChange()` to update panel highlighting
- `finalizeActiveTool()` and `clearMeasurements()` now fire `notifyMeasurementChange()` to update dimensions list
- `showCancelTool`/`hideCancelTool` replaced with no-ops in tool context (backward compatible with individual tool modules)

#### Main HTML Wiring (`PlanVision__WebApp__Main__.html`)
- Added `<script>` tag for `UserInterface__MeasurementToolsPanel__.js`
- Added `<link>` tag for `StyleSheet__MeasurementToolsPanel__.css`
- Added `<div id="measurement-tools-panel-host">` floating host element after toolbar
- Removed `#measurement-tools-host` and `#measurement-info-host` from sidebar
- Panel initialised immediately after measurement system in the init flow

#### Existing Stylesheet Cleanup (`StyleSheet__MeasuringTools__.css`)
- Removed all sidebar tool button styles (no longer needed)
- Retained floating Accept/Cancel action button styles for canvas overlay

#### Files Created
- `03__Src__AppModules/10__UserInterface/UserInterface__MeasurementToolsPanel__.js` (501 lines)
- `04__Style__AppStylesheets/StyleSheet__MeasurementToolsPanel__.css` (398 lines)
- `02__AppAssets__PlanVision/MeasureToolIcons/Icon__MeasureTools__TapeMeasure__.png`
- `02__AppAssets__PlanVision/MeasureToolIcons/Icon__MeasureTools__LinearMeasurment__.png`
- `02__AppAssets__PlanVision/MeasureToolIcons/Icon__MeasureTools__AreaMeasurment__.png`
- `02__AppAssets__PlanVision/MeasureToolIcons/Icon__MeasureTools__RectangularMeasurment__.png`
- `02__AppAssets__PlanVision/MeasureToolIcons/Icon__MeasureTools__ClearMeasurements__.png`

#### Files Modified
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentToolsSystem__Main__.js`
- `04__Style__AppStylesheets/StyleSheet__MeasuringTools__.css`
- `PlanVision__WebApp__Main__.html`

# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.2 - 08-Mar-2026

### Added - Cloudflare CDN Integration, Session Cache, and ProjectVision Launch Support

#### Cloudflare CDN Loader (`Loader__CloudflareCdnLoader__.js`) - NEW MODULE
- PlanVision now loads project data and drawing assets from Cloudflare R2 CDN as the primary source
- Falls back to GitHub Pages (legacy loader) automatically if CDN is unavailable
- Eliminates the 5-minute propagation delay when pushing updates via GitHub Pages
- CDN URL construction mirrors the R2 bucket key structure: `cdn.noble-architecture.com/NaProjectPortal/{year}-Projects/{folder}/20__PlanVision__AppContent/...`
- `Na__Cdn__BuildProjectDataUrl()` builds the CDN path for `PlanVision__ProjectData__.json`
- `Na__Cdn__BuildAssetUrl()` builds CDN paths for any PNG/PDF drawing asset
- `Na__Cdn__ConvertLegacyUrlToCdn()` converts existing GitHub Pages URLs to their CDN equivalents
- `Na__Cdn__FetchJsonWithFallback()` fetches JSON with CDN priority and legacy fallback
- `Na__Cdn__LoadImageWithFallback()` probes CDN image availability with legacy fallback

#### Toast Notification System (`UserInterface__ToastNotification__.js`) - NEW MODULE
- Transient on-screen notifications for load source warnings
- Displays a red warning toast when CDN is unavailable and the legacy loader is active
- Supports warning (red), info (blue), and success (green) notification types
- Auto-fades after configurable duration (default 5 seconds)
- Creates its own DOM container on first use, no HTML template required

#### Drawing Session Cache (`DrawingsCanvas__SessionCache__.js`) - NEW MODULE
- In-memory blob URL cache eliminates redundant CDN downloads when switching between drawings
- Previously every drawing button press triggered 2 full CDN requests (probe image + planImage.src assignment); now triggers 1 `fetch()` on first view and 0 on revisit
- Uses `fetch()` + `response.blob()` + `URL.createObjectURL()` to store images as blob URLs
- Blob URLs live only in browser memory -- no disk persistence, fresh CDN fetch on every new session
- 2-hour staleness guard: after 2 hours the session is considered stale and all subsequent fetches bypass the cache, forcing fresh CDN downloads
- `Na__Cache__Clear()` revokes all blob URLs to prevent memory leaks
- Also caches JSON project data with the same staleness logic

### Changed - URL Path Fix for ProjectVision Launch

#### URL Query System Fix (`AppCore__UrlQuerySystem__.js`)
- **Critical fix**: Added `20__PlanVision__AppContent` directory segment to the URL path construction
- Previously the data URL resolved to `.../RB05__WestFarm/RB05__PlanVision__ProjectData__.json` (missing content directory, wrong filename)
- Now correctly resolves to `.../RB05__WestFarm/20__PlanVision__AppContent/PlanVision__ProjectData__.json`
- Added `NaPlanVisionContentDir__Default` and `NaPlanVisionDataFilename__Default` constants
- Exposed `projectContentBaseUrl` in the context return object for drawing file resolution
- Changed default project year from `'25'` to `'26'`

#### DrawingsDataManager CDN Integration (`Loader__DrawingsDataManager__.js`)
- `Na__Data__FetchDrawings()` now uses `CloudflareCdnLoader.Na__Cdn__FetchJsonWithFallback()` for project data
- Triggers toast notification when falling back to legacy loader
- Added `cdnDataUrl` parameter to `Na__Data__Initialize()`
- Added `Na__Data__GetDataLoadSource()` accessor to report load source (cdn / legacy / direct)

#### DrawingLoader Cache Integration (`DrawingsCanvas__DrawingLoader__.js`)
- Drawing load path now routes through `SessionCache.Na__Cache__GetOrFetchImage()` when available
- Eliminates the double-fetch pattern (CDN probe + planImage.src) by using a single `fetch()` with blob storage
- Falls back to the original `Na__Cdn__LoadImageWithFallback` if session cache is not loaded
- Removed hardcoded `JH03__RomerCottage` fallback from project folder resolution
- Fixed local dev URL transform to use `projectContentBaseUrl`

#### Main HTML Wiring (`PlanVision__WebApp__Main__.html`)
- Added `<script>` tags for CDN loader, toast notification, and session cache modules
- `BASE_URL` now uses `projectContentBaseUrl` (includes `20__PlanVision__AppContent`)
- Builds `CDN_CONFIG_URL` from the CDN loader for production environments
- Passes CDN URL to `Na__Data__Initialize()` as third parameter
- Added `Na__Cache__Initialize()` call in the init sequence
- Changed `defaultProjectYear` from `'25'` to `'26'`

#### Files Created
- `03__Src__AppModules/04__AssetAndDataLoaders/Loader__CloudflareCdnLoader__.js` (206 lines)
- `03__Src__AppModules/10__UserInterface/UserInterface__ToastNotification__.js` (162 lines)
- `03__Src__AppModules/05__DrawingsCanvas/DrawingsCanvas__SessionCache__.js` (282 lines)

#### Files Modified
- `03__Src__AppModules/01__AppCore/AppCore__UrlQuerySystem__.js`
- `03__Src__AppModules/04__AssetAndDataLoaders/Loader__DrawingsDataManager__.js`
- `03__Src__AppModules/05__DrawingsCanvas/DrawingsCanvas__DrawingLoader__.js`
- `PlanVision__WebApp__Main__.html`

# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.1 - 10-Feb-2026

### Added - Area Tool Snap-to-Close & Smart Menu Auto-Hide
- **Area Tool Proximity Snap-to-Close** (`MeasurmentTool__AreaMeasurmentTool__.js`)
  - Added intelligent loop closing for area measurement tool
  - 30-pixel tolerance radius for snapping to first point
  - Automatically completes polygon when clicking near starting point
  - Requires minimum 3 points before snap-to-close activates
  - Eliminates fiddly double-click requirement on touch devices
  - Uses existing `helpers.dist()` function for accurate distance calculation
  - Shows Accept/Cancel buttons immediately on snap-close
  - Significantly improves mobile/tablet user experience

- **Smart Canvas-Triggered Menu Auto-Hide** (4 files)
  - Replaced aggressive 1-second timer with intelligent canvas-interaction detection
  - Menu now stays open indefinitely while browsing tools/drawings
  - Closes automatically only when user actively engages with canvas
  - Triggers: panning (mouse/touch), zooming (wheel/pinch), measurement tool use
  - New `Na__Toolbar__CloseOnCanvasUse()` function in ToolbarManager
  - Ensures maximum drawing area visibility when working
  - Preserves menu accessibility when selecting tools

### Changed
- **ToolbarManager module refactoring** (`UserInterface__ToolbarManager__.js`)
  - Removed all timer-based auto-close logic
  - Deleted `autoCloseTimer`, `autoCloseDelay` state variables
  - Removed `resetAutoCloseTimer()` internal function
  - Removed `clearAutoCloseTimer()` internal function
  - Replaced `Na__Toolbar__ResetAutoClose()` with `Na__Toolbar__CloseOnCanvasUse()`
  - Updated module export API with new function signature
  - Simplified `Na__Toolbar__Open()` (no timer start)
  - Simplified `Na__Toolbar__Close()` (no timer cleanup)
  - Simplified `Na__Toolbar__Toggle()` (no timer management)
  - Reduced module from 244 to 201 lines (18% code reduction)

- **Mouse interaction handlers** (`UserIteraction__KeyboardAndMouse__.js`)
  - Added `toolbarManager()` helper function for module access
  - `onMouseDown()`: Calls `Na__Toolbar__CloseOnCanvasUse()` when panning starts
  - `onWheel()`: Calls `Na__Toolbar__CloseOnCanvasUse()` when zooming
  - Ensures menu closes on any desktop canvas interaction

- **Touch interaction handlers** (`UserIteraction__TouchScreenDevices__.js`)
  - Added `toolbarManager()` helper function for module access
  - `onTouchStart()`: Calls `Na__Toolbar__CloseOnCanvasUse()` on single-finger pan
  - `onTouchStart()`: Calls `Na__Toolbar__CloseOnCanvasUse()` on two-finger pinch-to-zoom
  - Ensures menu closes on any touch canvas interaction
  - Critical for tablet/mobile usability

### Removed
- **HTML event listeners for timer reset** (`PlanVision__WebApp__Main__.html`)
  - Removed `mouseenter` listener on toolbar (19 lines deleted)
  - Removed `click` listener on toolbar
  - Removed `mousemove` listener on toolbar
  - These were resetting the auto-close timer on toolbar interactions
  - No longer needed with canvas-interaction-based closing

### Fixed
- **Touch device menu usability**
  - Previous 1-second timer made menu impossible to use on touchscreens
  - Users couldn't browse tools or drawings before menu closed
  - Smart closing now allows leisurely tool selection
  - Menu only closes when user clearly shifts focus to canvas

- **Area tool loop closing difficulty**
  - Double-click requirement was fiddly and inconsistent
  - Touch devices struggled with precise double-tap on small target
  - 30px snap tolerance provides generous target area
  - Works consistently across desktop, tablet, and mobile

### Technical Details
- **Area Tool Snap Logic**
  - Distance calculation: `helpers.dist(clickPos, measuringPoints[0])`
  - Tolerance: 30 pixels in plan-space coordinates (not screen pixels)
  - Guards: Minimum 3 existing points, shape not already complete
  - On snap: Sets `isAreaComplete = true`, shows buttons, skips point addition
  - Falls back to double-click if user prefers traditional method

- **Canvas Interaction Detection**
  - Mouse panning: Detected in `onMouseDown` before `isDragging` state set
  - Mouse zoom: Detected in `onWheel` before `applyZoom` call
  - Touch panning: Detected in `onTouchStart` for single-finger after tool delegation
  - Pinch zoom: Detected in `onTouchStart` for two-finger after tool delegation
  - Measurement tools: Already close menu via `setActiveTool()` (unchanged)

- **Code Quality**
  - Zero linter errors across all modified files
  - No stale references to removed functions
  - Consistent error handling and null checks
  - Clean separation of concerns (UI, interaction, measurement)

### Impact
- **Usability**: Touch device users can now effectively use the side menu
- **Efficiency**: Menu stays accessible during tool selection workflow
- **Precision**: Area tool loop closing is faster and more reliable
- **Maintainability**: Simpler codebase with less timer management complexity
- **Consistency**: Canvas interaction behavior unified across desktop/touch
- **Performance**: Reduced event listener count and timer overhead

### User Feedback Integration
- Original request: "impossible to use the menu" on touchscreens with 1s timer
- Original request: "have a bigger tolerance for final points" in area tool
- Solution iteratively refined through testing and user validation
- Both features working together create cohesive UX improvement

#### Files Modified
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentTool__AreaMeasurmentTool__.js` (14 lines added for snap-to-close)
- `03__Src__AppModules/10__UserInterface/UserInterface__ToolbarManager__.js` (43 lines removed, 12 lines added, net -31 lines)
- `PlanVision__WebApp__Main__.html` (19 lines removed - timer reset listeners)
- `03__Src__AppModules/11__UserIteraction/UserIteraction__KeyboardAndMouse__.js` (9 lines added for canvas-triggered close)
- `03__Src__AppModules/11__UserIteraction/UserIteraction__TouchScreenDevices__.js` (9 lines added for canvas-triggered close)
- `Planvision__DEVLOG__.md` (this file - documented v2.1.1 enhancements)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.1.0 - 09-Feb-2026

### Added - Enhanced Tutorial Animation System
- **New TutorialAnimations module** (`UserInterface__TutorialAnimations__.js`)
  - Standalone module working alongside existing TutorialSystem
  - Manages flashing animation lifecycle for tutorial overlay
  - Auto-dismiss functionality after 4.5 seconds
  - User interaction dismissal on toolbar/menu clicks
  - Functions: `Na__TutAnim__Initialize()`, `StartFlashAnimation()`, `EnableAutoDismiss()`, `DismissOverlay()`
  - Follows Noble Architecture conventions with `Na__TutAnim__` prefix
  - 253 lines with comprehensive logging and error handling

- **CSS flashing animation** (`tutorialAppear` keyframe)
  - 4-second animation sequence inspired by DocumentSystem
  - Smooth fade-in with translateY transform (0-5%: fade in)
  - Solid display for 2 seconds (5-50%: full opacity)
  - 3 attention-grabbing flashes (50-100%: flash cycles)
  - Applied to `#menu-tutorial-overlay` element
  - Creates eye-catching effect to ensure users notice tutorial

### Changed
- **Tutorial System platform behavior**
  - Removed mobile-only restriction from `TutorialSystem.js`
  - Tutorial now runs on ALL platforms (desktop, tablet, mobile)
  - Previously limited to mobile/portrait orientation only
  - Ensures all users see the tutorial on first launch

- **CSS positioning and z-index**
  - Changed overlay position from `absolute` to `fixed`
  - Increased z-index from 13000 to 150000 (highest in app)
  - Ensures overlay appears above all other UI elements
  - Prevents overlay from being hidden behind modals/dialogs

- **HTML integration** (`PlanVision__WebApp__Main__.html`)
  - Added script tag for new TutorialAnimations module (v1.0.0)
  - Added initialization code with DOM references (menuTutorialOverlay, toolbar, toggleToolbarBtn)
  - Added enhanced flow to trigger flash animation after overlay appears
  - Fixed missing `toolbarToggleButton` reference (now uses `getElementById`)

### Fixed
- **ReferenceError: toolbarToggleButton is not defined**
  - Changed from undefined variable to direct DOM query
  - Now uses `document.getElementById("toggleToolbarBtn")`
  - Resolved initialization crash on page load

- **Overlay visibility issues**
  - Added debug logging to track display state
  - Logs overlay display, z-index, and position values
  - Helps diagnose rendering and visibility problems

### Technical Details
- **Animation Timing**
  - Menu opens immediately on startup
  - Menu closes after 1000ms (MENU_OPEN_DURATION)
  - Overlay appears 300ms after menu closes (TOOLTIP_DELAY)
  - Flash animation starts 1300ms after StartFlow call
  - Auto-dismiss after 4500ms (AUTO_DISMISS_DELAY)
  - Total lifecycle: ~6 seconds from start to auto-dismiss

- **User Interaction Dismissal**
  - Clicking toolbar toggle button immediately hides overlay
  - Clicking anywhere within toolbar dismisses overlay
  - Clears auto-dismiss timer on manual dismissal
  - Prevents duplicate or conflicting timers

### Impact
- **Attention-grabbing**: Flashing animation ensures users notice the tutorial
- **Auto-cleanup**: Overlay auto-dismisses to prevent UI clutter
- **Platform-inclusive**: Works on desktop, tablet, and mobile devices
- **Modular design**: Easy to disable or modify independently
- **Zero conflicts**: Works alongside existing TutorialSystem module
- **Professional polish**: Smooth animations match DocumentSystem quality

#### Files Created
- `03__Src__AppModules/10__UserInterface/UserInterface__TutorialAnimations__.js` (253 lines)

#### Files Modified
- `04__Style__AppStylesheets/StyleSheet__CorePlanVisionApp__.css` (added tutorialAppear keyframe + updated overlay styles)
- `03__Src__AppModules/10__UserInterface/UserInterface__TutorialSystem__.js` (removed mobile-only restriction)
- `PlanVision__WebApp__Main__.html` (added script tag, initialization, and enhanced flow)
- `Planvision__DEVLOG__.md` (this file - documented tutorial animation enhancements)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.10 - 09-Feb-2026

### Added - Cache-Busting System
- **Version-based cache control**
  - Added `APP_VERSION` constant (currently '2.0.9') in main script
  - All JavaScript module imports now include `?v=2.0.9` query parameter
  - All CSS stylesheet imports now include `?v=2.0.9` query parameter
  - Ensures browsers always load latest code after deployments
  - Prevents cached JavaScript from causing errors with updated JSON structure

- **Updated header version display**
  - Changed from "Version 2.0.4 Beta" to "Version 2.0.9 Beta"
  - Reflects current application version accurately

### Problem Solved
- **Web version caching issue**
  - Local version worked: read updated files directly from disk
  - Web version failed: browsers served old cached JavaScript
  - Old code looked for deprecated `project-drawings` property
  - New code supports both `phase-content` (current) and `project-drawings` (legacy)
  - Cache-busting ensures web browsers always fetch latest code

### Impact
- **Eliminated web deployment issues**: No more cached JavaScript errors
- **Consistent behavior**: Web and local versions now work identically
- **Future-proof**: Version parameter can be updated with each release
- **Better reliability**: Users always get latest code without manual cache clearing

#### Files Modified
- `PlanVision__WebApp__Main__.html` (added version constant and ?v= parameters to all script/stylesheet tags)
- `Planvision__DEVLOG__.md` (this file - documented cache-busting implementation)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.9 - 09-Feb-2026

### Added - Drawing Register Landing Page
- **New menu category: "Drawing Register"**
  - Added as first menu button (above Drawings and Specifications)
  - Displays comprehensive project information and document register
  - Functions as a menu feature rather than blocking overlay
  - Accessible at any time, auto-hides when selecting drawings

- **Landing page module** (`09__AppLandingPage/LandingPage__Main__.js`)
  - Project header: displays project name, address, active design phase
  - Dynamic drawing register table: all documents grouped by folder
  - Table columns: Code, Document Name, Type, Scale, Size, Revision
  - How-to-use instructions: 6 numbered steps with responsive grid layout
  - Functions: `Na__Landing__Initialize()`, `Show()`, `Hide()`, `IsVisible()`

- **Landing page styles** (`09__AppLandingPage/LandingPage__Styles__.css`)
  - Full-viewport overlay at z-index 9997 (below toolbar, above canvas)
  - Project header with brand gradient and phase badge
  - Clean table with alternating row shading and folder group headers
  - Instruction cards with numbered badges and responsive grid
  - Mobile-responsive layout with smaller fonts and single-column instructions

### Changed
- **Replaced broken first-drawing auto-load**
  - Removed auto-load of first drawing in DesignPhase03 (lines 724-729)
  - Now shows Drawing Register as default view on startup
  - Eliminated "Failed to load the selected drawing" error on startup
  - No drawing loads until user explicitly selects one from sidebar

- **Enhanced DrawingsDataManager** (`Loader__DrawingsDataManager__.js`)
  - Added `projectDetails` state variable
  - Stores `project-details` during JSON fetch
  - New getter: `Na__Data__GetProjectDetails()` exposes project metadata
  - Provides project name, address, portal links to Landing Page

- **Menu system integration** (`UserInterface__MenuSystem__.js`)
  - Added `Na__Menu__ShowDrawingRegister()` function
  - Added `hideDrawingRegister()` helper
  - Drawing Register button event listener
  - Auto-hides register when navigating to Drawings/Specifications
  - Auto-hides register when returning to Main Menu

- **Canvas drawing loader** (`DrawingsCanvas__DrawingLoader__.js`)
  - Auto-hides Drawing Register when a drawing is loaded
  - Prevents register from obscuring newly loaded drawings

### Impact
- **Eliminated startup errors**: No more failed loads from PDF-only first drawings
- **Improved onboarding**: Users see project context and instructions immediately
- **Better UX**: Menu remains accessible; register is optional, not forced
- **Professional presentation**: Clean register table with all project documents
- **Self-documenting app**: How-to instructions built into the interface

#### Files Created
- `03__Src__AppModules/09__AppLandingPage/LandingPage__Main__.js` (367 lines)
- `03__Src__AppModules/09__AppLandingPage/LandingPage__Styles__.css` (296 lines)

#### Files Modified
- `Loader__DrawingsDataManager__.js` (+16 lines)
- `UserInterface__MenuSystem__.js` (+50 lines)
- `DrawingsCanvas__DrawingLoader__.js` (+5 lines)
- `StyleSheet__CorePlanVisionApp__.css` (+5 lines)
- `PlanVision__WebApp__Main__.html` (+12 lines)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.8 - 09-Feb-2026

### Added - Folder-Structure-Driven File Loading System
- **Per-phase folder-structure definitions in JSON**
  - Replaced flat `project-drawings` with `phase-content` per design phase
  - Each phase declares `phase-folder` and nested `folder-structure` array
  - Folders have `label`, `document-type`, `document-scale`, `document-size`
  - Subfolders inherit properties from parent unless overridden
  - Files listed as base filenames (no extension) in `files` arrays
  - System auto-appends `.png` / `.pdf` extensions for URL construction

- **PowerShell manifest script** (`05__Tools__BuildScripts/Update-ProjectManifest.ps1`)
  - Auto-discovers files on disk and updates JSON `files` arrays
  - Recursively scans phase folders and subfolders
  - Skips `00__Archive` folders and `.note` placeholder files
  - Prioritizes PNG files; includes PDF-only files as fallback
  - Detects new subfolders not in JSON and auto-adds them
  - Preserves all manual metadata (labels, types, scales, sizes)
  - Supports dry-run mode for preview before updating
  - User workflow: drop file in folder → run script → done

- **Recursive folder processor** (`Loader__DrawingsDataManager__.js`)
  - Walks `folder-structure` to unlimited nesting depth
  - Builds drawing objects with auto-constructed URLs
  - Pattern: `{baseUrl}/{phaseFolder}/{folderPath}/{filename}.{ext}`
  - Supports `folder: "."` for files at phase root
  - Handles nested `subfolders` arrays recursively

- **Intelligent filename parser** (`Loader__DrawingsDataManager__.js`)
  - Extracts human-readable display names from filenames
  - Input: `"JH03_T03_D21__TechnicalPlan__RevF__"`
  - Output: `"D21 - Technical Plan (Rev F)"`
  - Handles multiple naming patterns (with/without `_-_` separator)
  - Identifies drawing code (e.g., "D21", "CM10")
  - Extracts document name with PascalCase spacing
  - Parses revision info (e.g., "Rev F", "Rev-A")

- **Dual data output structure**
  - Folder-grouped data: `[{ label, depth, drawings[] }, ...]` for UI rendering
  - Flat list: `[ drawingObj, drawingObj, ... ]` for first-drawing loading
  - New getters: `GetFolderGroups()`, `GetHistoricFolderGroups()`, `GetFlatDrawingsList()`

### Changed - UI Rendering for Grouped Display
- **DrawingButtons module rewritten** (`UserInterface__DrawingButtons__.js`)
  - New function: `Na__Buttons__CreateGroupedDocumentButtons()`
  - Renders section headers for each folder group
  - Renders sub-headers for nested subfolders with indentation
  - Supports unlimited nesting depth with visual hierarchy
  - Maintains historic archive toggle functionality
  - Legacy `CreateFilteredDocumentButtons()` redirects to new grouped display

- **New CSS classes for folder hierarchy** (`StyleSheet__CorePlanVisionApp__.css`)
  - `.folder-group` -- wrapper for top-level folder sections
  - `.folder-group-header` -- section label with left border accent (#7a7060)
  - `.subfolder-group` -- nested section with left margin indent
  - `.subfolder-group-header` -- smaller italic sub-section labels
  - `.no-documents-message` -- empty state messaging
  - `.historic-mode-banner` -- warning banner for historic documents

- **MenuSystem updated for grouped data flow** (`UserInterface__MenuSystem__.js`)
  - `ShowDrawingsMenu()` / `ShowSpecificationsMenu()` now pull folder groups
  - Direct integration with `DrawingsDataManager.GetFolderGroups(type)`
  - No longer stores flat documents object

- **HistoricArchive updated for grouped data** (`UserInterface__HistoricArchive__.js`)
  - Uses `GetHistoricFolderGroups()` for previous-phase documents
  - Passes grouped data to DrawingButtons for sectioned display

- **Main HTML init updated** (`PlanVision__WebApp__Main__.html`)
  - Passes `BASE_URL` to `DrawingsDataManager.Initialize()`
  - Uses `GetFlatDrawingsList()` for first-drawing loading (now removed)
  - No longer iterates flat drawing keys

### Fixed
- **Error banner persistence bug**
  - Added `HideError()` call in DrawingLoader when starting new load
  - Error banner from failed loads now clears properly
  - Prevents stale error messages when subsequent drawings load successfully

### Impact
- **Eliminated manual JSON maintenance**: User drops files in folders, runs script, done
- **Handles unlimited nesting**: Construction Details with 4 subfolder levels works perfectly
- **Auto-generated display names**: "D21 - Technical Plan (Rev F)" from filenames
- **Folder-organized UI**: Buttons grouped by Plans, Elevations, Wall Details, Roof Details, etc.
- **No more tedious JSON editing**: Was 10+ fields per drawing; now 1 filename per drawing
- **DesignPhase03 example**: 8 folder groups, 22 total drawings, 4-level nesting (20__ConstructionDetails/21__WallDetails)

#### JSON Restructure
- **Before**: 
  - Flat `project-drawings` object
  - Manual enumeration: `drawing-01`, `drawing-02`, etc.
  - 10+ fields per entry (name, type, scale, size, phase, links)
  
- **After**:
  - Per-phase `phase-content` structure
  - Folder metadata set once per folder
  - Files array with base filenames only
  - All URLs and display names auto-constructed

#### Files Created
- `05__Tools__BuildScripts/Update-ProjectManifest.ps1` (385 lines)

#### Files Modified (Major Rewrite)
- `Loader__DrawingsDataManager__.js` (171 → 537 lines, +366 lines)
- `UserInterface__DrawingButtons__.js` (196 → 265 lines, +69 lines)
- `JH03__PlanVision__ProjectData__.json` (restructured from flat to folder-based)

#### Files Modified (Integration)
- `UserInterface__MenuSystem__.js` (+10 lines)
- `UserInterface__HistoricArchive__.js` (+8 lines)
- `PlanVision__WebApp__Main__.html` (+3 lines)
- `StyleSheet__CorePlanVisionApp__.css` (+67 lines)
- `DrawingsCanvas__DrawingLoader__.js` (+4 lines)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.7 - 09-Feb-2026

### Changed - Complete Naming Standardization Across All Systems
- **Updated ALL remaining modules to three-part naming convention**
  - DrawingsDataManager: `Na__` → `Na__Data__` (5 functions)
  - VideoPlayer system: `Na__` → `Na__Video__` (4 modules, 14 functions)
  - MarkupToolsSystem: `.initialise()` → `Na__Markup__` (8 functions)
  - UserInteraction: `.initialise()` → `Na__Interact__` (2 modules, 2 functions)
  - AppAssetsLoader: `.initialise()` → `Na__Assets__` (4 functions)

- **Updated all cross-module references**
  - VideoPlayer modules calling each other (4 internal calls)
  - UserInteraction modules calling Markup and Measurement systems (14 calls)
  - Canvas modules calling Markup and Measurement systems (4 calls)
  - AppAssetsLoader internal self-references (6 calls)

- **Updated all main HTML integration points**
  - 8 direct system calls updated
  - All system initializations use new naming
  - Event delegation uses new naming

### Impact
- **100% naming consistency achieved** across entire codebase
- 12 distinct domain prefixes established
- 86 public API functions with descriptive naming
- 19 modules using standardized pattern
- 60+ call sites verified and updated
- Zero legacy naming patterns remaining

### Domains Established
- Canvas, Menu, Buttons, Archive, Tutorial, Toolbar (UI & Canvas layer)
- Measure, Markup (Tools layer)
- Data, Video, Interact, Assets (Core systems)

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.5 - 09-Feb-2026

### Changed - Phase 2A: UI Support Modules and Canvas System Modularization
- **Extracted Tutorial System Module** (`UserInterface__TutorialSystem__.js`)
  - First-load tutorial flow for mobile/tablet devices
  - Device type and orientation detection
  - Three-step sequence: menu open → collapse → tooltip
  - Functions use `Na__Tutorial__` prefix
  - ~34 lines extracted from main HTML

- **Extracted Toolbar Manager Module** (`UserInterface__ToolbarManager__.js`)
  - Toolbar visibility toggle and state management
  - Dismisses tutorial overlay when toggling
  - Prevents toggle during active tool operations
  - Expanded API: Toggle, Open, Close, IsOpen, CanToggle
  - Functions use `Na__Toolbar__` prefix
  - ~8 lines extracted from main HTML

- **Deleted Legacy Font Functions** (Code Cleanup)
  - Removed `preloadFonts()` and `checkFontAvailability()` functions
  - These were NOT being called and duplicated AppAssetsLoader functionality
  - AppAssetsLoader already loads all Caveat and Open Sans fonts properly
  - ~46 lines of dead code removed

- **Enhanced Naming Convention Applied to All UI Modules**
  - Updated MenuSystem: `Na__` → `Na__Menu__` (7 functions)
  - Updated DrawingButtons: `Na__` → `Na__Buttons__` (2 functions)
  - Updated HistoricArchive: `Na__` → `Na__Archive__` (5 functions)
  - All cross-module references updated
  - All main HTML calls updated
  - **100% naming consistency across all 10 extracted modules**

- **Enhanced Naming Convention Applied to Measurement Tools System**
  - Updated MeasurementToolsSystem Main: 9 public API functions
  - Pattern: `Na__Measure__FunctionName`
  - Examples: `Na__Measure__Initialise()`, `Na__Measure__Render()`, `Na__Measure__ClearMeasurements()`
  - Updated all call sites in main HTML and canvas modules
  - Internal tool APIs (LinearTool, AreaTool, etc.) maintain current structure

- **Extracted Canvas Loading States Module** (`DrawingsCanvas__LoadingStates__.js`)
  - Manages loading overlay visibility during async operations
  - Displays error messages to users
  - Provides clean API for loading and error state management
  - ~30 lines extracted from main HTML

- **Extracted Canvas Coordinate Utils Module** (`DrawingsCanvas__CoordinateUtils__.js`)
  - Converts screen coordinates to plan coordinates
  - Converts plan coordinates to screen coordinates (new)
  - Accounts for zoom factor and canvas offset
  - Used by measurement and markup tools
  - ~20 lines extracted from main HTML

- **Extracted Canvas Drawing Loader Module** (`DrawingsCanvas__DrawingLoader__.js`)
  - Loads drawing images asynchronously with Promise-based API
  - Manages drawing metadata (scale, size, dimensions)
  - Handles PDF download link updates
  - Transforms URLs for local development environment
  - Integrates with loading states and error handling
  - ~90 lines extracted from main HTML

- **Extracted Canvas View Controls Module** (`DrawingsCanvas__ViewControls__.js`)
  - Manages zoom operations with focus point preservation
  - Handles canvas resizing and view reset
  - Calculates measurement scale from drawing metadata
  - A-series paper size calculations (A0-A4)
  - Drawing scale parsing (e.g., "1:50")
  - Coordinates with measurement and markup systems
  - ~150 lines extracted from main HTML

- **Extracted Canvas Render System Module** (`DrawingsCanvas__RenderSystem__.js`)
  - Central rendering orchestration with requestAnimationFrame
  - Coordinates rendering of plan image, markup, and measurements
  - Applies canvas transforms and drop shadow effects
  - Controls render loop lifecycle (start/stop)
  - ~50 lines extracted from main HTML

### Fixed
- **Critical Bug: Undefined renderLoop Reference**
  - Fixed MarkupToolsSystem context (line 423) to reference `Na__Canvas__RenderFrame()`
  - Fixed MeasurementToolsSystem context (line 462) to reference `Na__Canvas__RenderFrame()`
  - Resolved `ReferenceError: renderLoop is not defined` crash
  - Loading screen now resolves correctly

- **Script Tag Typo**
  - Fixed AreaMeasurementTool script tag (line 65): `rc=` → `src=`
  - Module now loads correctly
  - Area measurement functionality restored

### Impact
- Main HTML reduced from 1,396 lines to 678 lines (718 lines removed, -51%)
- New modules: +2 files (Tutorial System, Toolbar Manager)
- Legacy code cleanup: -46 lines
- Naming convention: 14 functions renamed for consistency
- Canvas modularization: 5 modules extracted (LoadingStates, CoordinateUtils, DrawingLoader, ViewControls, RenderSystem)
- Total modules: 28 → 30
- Clear module dependencies and initialization order
- All extracted modules follow Noble Architecture coding style
- Improved testability and maintainability

### Module Architecture
- Tutorial System: Self-contained, mobile device detection
- Toolbar Manager: State management with safety checks
- All UI modules use three-part naming: `Na__Domain__Function`
- Pattern established: Canvas (5), Menu, Buttons, Archive, Tutorial, Toolbar
- Canvas Modules: 
  - LoadingStates (standalone)
  - CoordinateUtils (standalone)
  - DrawingLoader (uses LoadingStates, ViewControls)
  - ViewControls (uses CoordinateUtils indirectly)
  - RenderSystem (coordinates MarkupToolsSystem, MeasurementToolsSystem)


# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.4 - 09-Feb-2026

### Changed - Priority 1 Modularization Complete
- **Extracted Menu System Module** (`UserInterface__MenuSystem__.js`)
  - Manages two-tier menu navigation (Main Menu / Category Sub-Menus)
  - Controls visibility transitions between menu states
  - Filters documents by document-type (Drawing/Specification)
  - ~250 lines extracted from main HTML

- **Extracted Drawings Data Manager Module** (`Loader__DrawingsDataManager__.js`)
  - Centralizes drawing data fetching from JSON configuration
  - Manages design phase configuration and active phase state
  - Provides data access to UI components
  - Handles validation and error states
  - ~130 lines extracted from main HTML

- **Extracted Drawing Buttons Module** (`UserInterface__DrawingButtons__.js`)
  - Creates dynamic buttons for document selection
  - Filters by design phase (current vs historic)
  - Filters by document-type (Drawing vs Specification)
  - Supports historic archive mode
  - ~150 lines extracted from main HTML

- **Extracted Historic Archive Module** (`UserInterface__HistoricArchive__.js`)
  - Displays warning modal before accessing historic documents
  - Manages historic archive filtering within categories
  - Coordinates with DrawingButtons for document display
  - ~120 lines extracted from main HTML

### Impact
- Main HTML reduced from 1,396 lines to 976 lines (~420 lines removed)
- Menu system now fully modular with clean separation of concerns
- Data loading separated from UI rendering
- All 4 modules follow consistent Noble Architecture coding style
- Initialization pattern updated to bootstrap new modules properly

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.3 - 09-Feb-2026

### Changed
- Wired in the measurement tools system modules as the authoritative source
  - `MeasurmentToolsSystem__Main__.js` now handles all tool activation, rendering, and events
  - `MeasurmentTool__LinearMeasurmentTool__.js`, `AreaMeasurmentTool`, `RectangularMeasurmentTool` handle per-tool logic
  - `MeasurmentTools__SharedMathHelpers__.js` provides all measurement drawing functions
- Created two new User Interaction modules to offload event handling from the main HTML
  - `UserIteraction__KeyboardAndMouse__.js` - mouse down/move/up, wheel zoom, keyboard delegation
  - `UserIteraction__TouchScreenDevices__.js` - touch start/move/end, pinch-to-zoom
- Replaced hardcoded measurement tool buttons with dynamic UI injection via host divs
- Removed ~850 lines of inline measurement drawing, event handler, and tool management code
- Main HTML reduced from 2,231 lines to 1,380 lines
- Measurement system now self-manages its own state, buttons, and rendering

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.2 - 09-Feb-2026

### Changed
- Completed markup tools system modularisation: split into four sub-modules
  - `MarkupToolsSystem__Main__.js` - orchestrator (state, events, UI wiring)
  - `MarkupToolsSystem__SketchyRenderers__.js` - all canvas rendering functions
  - `MarkupToolsSystem__SelectionHandlers__.js` - hit detection, selection, clipboard, movement
  - `MarkupToolsSystem__UiTemplate__.js` - HTML template generation (existing)
- Removed ~3,800 lines of dead/duplicate inline markup code from the main HTML
- Main HTML reduced from 5,426 lines to 1,608 lines
- Replaced empty stub functions in the markup orchestrator with real sub-module delegation
- Cleaned up orphaned inline state variables and duplicate function definitions
- Added arc tool handling to the external markup system module
- Module architecture now mirrors the measurement tools system pattern

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.1 - 09-Feb-2026

### Added
- Measurement tools system modules with per-tool APIs and shared helpers
- App config flags for enabling measurement tools and per-tool toggles
- Markup tools system modules with injected UI templates
- App config section to enable/disable markup tools (disabled by default)
- Modular URL query system for resolving project context and data paths

### Changed
- Main app delegates measurement rendering and input to the new system
- Refactored video player code into dedicated system modules and cleaned HTML wiring
- Offloaded the polyfill conditional loader into a CommonUtils module
- Main app initialises markup system only when enabled in config
- Local server now serves project assets only via `/na-project-portal/...`
- Fixed local URL transformation to keep project portal base path for assets
- Main app now resolves project data via the URL query system module
- Updated project data loading to use `__PlanVision__ProjectData__.json`
- Set local project portal base path for JH03 Romer Cottage on localhost
- Offloaded inline CSS into dedicated core, markup, and measuring stylesheets
- Linked external stylesheets from `PlanVision__WebApp__Main__.html`

#### Files Modified
- `PlanVision__WebApp__Main__.html`
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentTools__SharedMathHelpers__.js`
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentTool__LinearMeasurmentTool__.js`
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentTool__AreaMeasurmentTool__.js`
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentTool__RectangularMeasurmentTool__.js`
- `03__Src__AppModules/30__SystemModules__MeasurmentToolsSytem/MeasurmentToolsSystem__Main__.js`
- `03__Src__AppModules/02__AppData/AppConfiguration__PlanVision__MainAppSettings__.json`
- `03__Src__AppModules/40__SystemModules__VideoPlayer/VideoPlayer__Core__.js`
- `03__Src__AppModules/40__SystemModules__VideoPlayer/VideoPlayer__DataLoader__.js`
- `03__Src__AppModules/40__SystemModules__VideoPlayer/VideoPlayer__GalleryManager__.js`
- `03__Src__AppModules/40__SystemModules__VideoPlayer/VideoPlayer__Main__.js`
- `03__Src__AppModules/03__CommonUtils/CommonUtils__PolyfillConditionalLoader__.js`
- `03__Src__AppModules/50__SystemModules__MarkupToolsSystem/MarkupToolsSystem__Main__.js`
- `03__Src__AppModules/50__SystemModules__MarkupToolsSystem/MarkupToolsSystem__UiTemplate__.js`
- `03__Src__AppModules/01__AppCore/AppCore__UrlQuerySystem__.js`
- `04__Style__AppStylesheets/StyleSheet__CorePlanVisionApp__.css`
- `04__Style__AppStylesheets/StyleSheet__MarkUpTools__.css`
- `04__Style__AppStylesheets/StyleSheet__MeasuringTools__.css`
- `local_server.py`

# -----------------------------------------------------------------------------

## PlanVision - Version x.x.x - DD-MMM-YYYY

### Added
- ADD HERE

### Changed
- Change No1 Here
- Change No2 Here


#### Files Modified
- List `FileModified__PlanVision__.example`

# -----------------------------------------------------------------------------



# Noble Architecture - Project Admin & Documentation System
## Development Log

# =============================================================================

## Admin & Doc System - Version 0.6.7 - 06-Feb-2026

### Added

- **Mega Delete (Project Manager)** - Hard delete for full project removal
  - Deletes local project folder via Flask API
  - Purges all Cloudflare R2 files under the project prefix
  - Uses exact folder delete to avoid index mismatches

### Changed

- **Project Purge API** - New Worker endpoint for full project delete
  - `/projectadmin/project-purge` removes all objects under project prefix

#### Files Modified

- `04__EditorTools/Editor__ProjectIndexBuilder__.html`
- `05__CloudflareWorkers/src/CloudflareWorker__Main__.js`
- `05__CloudflareWorkers/src/handlers/CloudflareHandler__ProjectPurge__.js`
- `start_local_server.py`

---
# Version History - OLD VERSIONS 
- PRIOR TO TOTAL REFACTORING AND REWRITE OF THE APPLICATION IN FEBRUARY 2026
# ===================================================================

## Issues & Lessons Learned

### iOS Performance Issues

**Problem:** Initial PDF-only approach caused performance and memory issues on iOS devices.

**Solution:** 
- The integration of PNG image handling resolved these issues and improved cross-device compatibility
- Maintaining two separate files (PNG and PDF) leverages the benefits of both in-app viewing and downloadable formatted documents

---

### DOM Loading Issues

**Problem:** Application failed to load due to missing root DOM element (`#app`).

**Details:** The script was executing before the DOM fully loaded, causing critical errors.

**Solution:** Resolved by ensuring the `#app` element exists before running JavaScript logic.

---

### Fullscreen Mode in Embeds

**Problem:** Full screen mode did not function properly in Google Sites embeds.

**Details:** Browsers restrict fullscreen access within iframes, affecting functionality.

**Solution:** Added fallback handling for unsupported fullscreen environments.

---

### Mobile Usability

**Problem:** Mobile usability was initially poor due to lack of user guidance.

**Details:** The previous implementation displayed a static message instructing users to rotate their device.

**Solution:** This was replaced with a dynamic tutorial animation that visually introduces the tools menu.

---

### Toolbar Display Issues

**Problem:** Toolbar animation and menu visibility improvements were required.

**Details:** Initially, the toolbar left a grey margin when hidden, affecting canvas usability.

**Solution:** The toolbar was adjusted to overlay the canvas instead of affecting its dimensions.

---

### Measurement Tools UI

**Problem:** Measurement tools needed UI refinement.

**Details:** Previously, the measurement tools' buttons were not intuitive for first-time users.

**Solution:** Added clear instructions and improved the visibility of the confirm/cancel buttons.

---

### Device Orientation Detection

**Problem:** Device orientation detection required refinements.

**Details:** Early mobile detection logic only considered width constraints, missing certain tablets.

**Solution:** Implemented improved detection for phones, tablets, and iPads, ensuring proper UI scaling.

---

## Version History

**19-Jan-2026 - v1.9.0 | MENU SEPARATION & DOCUMENT CATEGORIZATION**

MENU ARCHITECTURE IMPROVEMENTS
- Separated drawings from specifications into dedicated category menus
- Implemented three-tier menu system: Main Menu → Drawings/Specifications → Document Selection
- Added "Drawings" category button for document-type: "Drawing" (plans, elevations, sections)
- Added "Details & Specifications" category button for document-type: "Specification" (construction details, U-value calculations)

DYNAMIC FILTERING SYSTEM
- Menu dynamically filters documents based on "document-type" field from @JH03_-_DATA_-_Document-Library.json
- Drawing category shows 18 documents (plans, elevations, sections, roof plans)
- Specifications category shows 11 documents (construction details, calculations)
- Document type excluded from both menus preserved

USER EXPERIENCE ENHANCEMENTS
- Both sub-menus include full measuring tools (linear, rectangle, area measurements)
- Both sub-menus include complete markup tools functionality
- Added "Back to Main Menu" navigation buttons for seamless category switching
- Reduced menu clutter by organizing documents into logical categories
- Maintained Video Gallery and Historic Archive access from main menu

---

**08-Jan-2026 - v1.8.9 | DESIGN PHASE ORGANISATION & DEVELOPMENT WORKFLOW**

DESIGN PHASE ARCHITECTURE
- Reorganized project structure from flat root directory to phase-based folders (DesignPhase01/02/03)
- Implemented JSON-driven design phase configuration via "project-phase-config" section
- Active design phase now controlled through JSON "active-design-phase" field (no hardcoded values)
- Added "design-phase" field to all drawing entries for automatic phase filtering

HISTORIC ARCHIVE SYSTEM
- Implemented phase-aware menu system that displays only current phase drawings by default
- Added "View Historic Archive" button to access previous design phase documents
- Created full-screen warning modal with hazard styling and animations:
  - Pulsing red border and animated hazard stripes
  - Strong messaging emphasizing historic documents must NOT be used
  - "Return to Current Drawings" navigation for easy return to active phase
- Added persistent warning banner when viewing historic documents
- Modal uses prominent warnings to prevent accidental use of superseded drawings

VIDEO GALLERY COLLAPSIBLE MENU
- Replaced individual video buttons with single "Video Gallery" button
- Gallery opens dedicated video menu with all videos listed
- "Back to Main Menu" button returns to drawing selection view
- Prevents menu clutter while maintaining easy access to project videos

UI ENHANCEMENTS
- Subtle color coding applied across all button sections:
  - Drawing Selection: Slate blue gradient
  - View & Export: Sage green gradient
  - Measuring Tools: Teal gradient
  - Markup Tools: Warm taupe gradient
  - Video Gallery: Muted purple gradient
  - Historic Archive: Warm brown with dashed border
- All colors use professional, desaturated palette for subtle visual organization

LOCAL DEVELOPMENT ENVIRONMENT
- Created Flask development server (local_server.py) for local testing
- Added start_local_server.bat for one-click server launch
- Implemented environment detection (local vs production) with automatic URL transformation
- Supports hot-reload and serves all DesignPhase folders
- Eliminates need to push to GitHub Pages for every test

PATH UPDATES
- Updated all document URLs in JSON to include DesignPhase subfolder structure
- Added 5 new DesignPhase03 drawings (all A2, 1:50 scale):
  Technical Plan (RevC), Foundations Plan (RevC), Elevations (Sheets 01/02), 3D Model View

# -----------------------------------------------------------------------------

### v0.2.0 (22-Feb-2025)
Basic functions tested across four client projects.

---

### v0.2.1 (22-Feb-2025)
Linear & area measurement tools, PDF download and dual-file (PNG/PDF) handling implemented.

---

### v0.3.1 (22-Feb-2025)
Improved measurement scaling and initial compatibility fixes.

---

### v1.4.0 (10-Mar-2025) - MAJOR UI & USABILITY ENHANCEMENTS

- Mobile usability improvements implemented for phones, tablets, and iPads
- Removed placeholder message for portrait mobile devices
- **New tutorial animation:** Upon first launch, menu now opens briefly before retracting, followed by an arrow tooltip guiding users to the tools menu
- **New Fullscreen Mode Button:** Added fullscreen toggle within the toolbar
- **Fixed Menu Behaviour:** Ensured menu correctly overlays the drawing instead of affecting the canvas scale
- Additional performance optimisations and minor bug fixes

---

### v1.4.1 (10-Mar-2025)
Drawing Markers changed from circles (Dots At Node Points) changed to "+" Shaped Crossheirs for improved accuracy.

---

### v1.5.0 (16-Mar-2025) - MAJOR RELEASE UPDATE - DYNAMIC LOADING & FEATURE UPDATES

- Introduced dynamic loading of drawing data by fetching a JSON file from a remote source
- Expects a nested JSON structure under "na-project-data-library" → "project-documentation" → "project-drawings"
- Each drawing entry (keys starting with "drawing-") includes:
  - `file-name`: The name of the drawing file (template entries are ignored)
  - `document-name`: The display name used for toolbar buttons
  - `document-links`: Contains asset URLs for PNG and PDF versions
- Dynamically creates toolbar buttons for each drawing, allowing users to select from multiple drawings
- Updates the PDF download link dynamically based on the selected drawing's metadata
- Implements asynchronous loading (using async/await) for JSON data and images
- Includes extensive error checking and logging to aid in debugging
- Adds a conditional polyfill loader for older iOS devices

---

### v1.5.5 (16-Mar-2025) - TOOL ADDED - RECTANGULAR MEASUREMENT TOOL

- Introduced a new "Rectangle Measurement" tool to complement existing measurement functionalities
- **Real-time rectangle drawing:** Users can click and drag to define a rectangle with dynamic updates
- **Orthogonal snapping:** Automatically aligns rectangle to horizontal or vertical axes (within 15° tolerance)
- **Area calculation:** Computes and displays area in square meters (m²)

**Implementation Details:**
- Added `isRectDragging` state variable to track active dragging
- Modified event handlers to support click-and-drag workflow
- Enhanced `renderLoop` to draw rectangle preview in real-time
- Integrated into `finalizeMeasurement` for confirmation

**User Experience Improvements:**
- Added instructional overlay for first-time use
- Set cursor to "crosshair" during tool use
- Resolved fluidity issues for responsive feel
- Tested across desktop and touch devices

---

### v1.5.6 (16-Mar-2025) - RENDER EFFECT ADDED

- Added a subtle shadow effect creating the illusion of paper drawing plan
- Sets drop shadow properties for the drawing

---

### v1.5.8 (16-Mar-2025) - Updated Rectangular Measurement Tool

- Added measurements to the rectangle
- Measurements are displayed next to the rectangle

---

### v1.6.0 (25-Mar-2025) - MAJOR RELEASE UPDATE

**Markup Drawing Tools**
- Creates a new nested toolset allowing architects to markup drawings with freehand notes and drawings
- Switches the default toolset to a markup focused palette
- Differenciates itself stylewise by using a technical pen like line style
- Introduces a hand sketched style easily recognisable to architects
- Ensures it's clear it is a different marked up plan version and not the original drawing

**New Tool Accessed From Toolbar**
- Replaces the standard measuring and drawing selection toolset with a different tools palette
- User can toggle between the two toolsets

**The markup toolset includes:**
- Markup freehand pen tool
- Text Box Creation (uses handwriting font)
- Arrow Pen Drawing Tool (spline-based with sketchy line style)
- Freehand Arrow Drawing Tool
- Rectangle Drawing Tool (polygon with sketchy line style)
- Circle Drawing Tool (sketchy line style)

---

### v1.6.1 (25-Mar-2025) - UI LAYOUT IMPROVEMENTS

- Reorganised toolbar layout for better usability:
  - Moved "Select Drawing" section to the top
  - Added clear section dividers with headers
  - Reordered sections to follow logical workflow:
    1. Select Drawing
    2. View & Export
    3. Measuring Tools
    4. Drawing & Markup
- Added spacer after drawing selection for improved visual separation
- Enhanced toolbar section visibility management

---

### v1.6.6 (25-Mar-2025) - UI LAYOUT FIXES & INTERACTIVE IMPROVEMENTS

**Fixed color swatch layout issues:**
- Properly resets flexbox container properties
- Ensures color swatches maintain grid layout regardless of menu state

**Improved handle positioning:**
- Handles now correctly track with their elements when zooming
- Control points properly follow elements when panning
- Selection handles remain accurately positioned after view reset

**Added copy and paste functionality:**
- Press Ctrl+C to copy any selected element
- Press Ctrl+V to paste at current mouse position
- Smart positioning automatically centers pasted elements
- Consecutive pastes are slightly offset to avoid overlap
- Works with all element types (shapes, text, arrows, freehand)
- Shows brief visual feedback when copying elements
- Pasted elements are automatically selected for immediate editing

---

### v1.7.0 (25-Mar-2025) - CENTRALISED ASSET LIBRARY IMPLEMENTATION

**Added centralised asset library:**
- Implemented dynamic font loading system using @font-face declarations
- Added Open Sans font family (regular, light, semi-bold) for UI elements
- Added Caveat font family (regular, semi-bold) for markup handwriting style
- Created a two-tier loading system separating app assets from project assets

**Improved text rendering quality:**
- Text markup now uses Caveat font for authentic handwriting appearance
- Consistent typography across all device types and screen sizes

**Enhanced asset management:**
- App assets (fonts, logos) now loaded from centralised repository
- Project assets (drawings) continue to load from project-specific repository
- Automatic fallback system when assets can't be loaded

**Fixed display issues:**
- Resolved canvas container CSS selector mismatch
- Corrected font scaling on different zoom levels
- Improved text positioning in markup elements

---

### v1.7.1 (25-Mar-2025) - UI CLEANUP & OPTIMIZATION

**Removed Polygon Tool:**
- Simplified markup tools menu by eliminating rarely used functionality
- Reduced user interface clutter
- Maintained backward compatibility with existing polygon elements

**Enhanced markup tools appearance:**
- Implemented more realistic technical pen drawing style
- Added variable line thickness and natural hand-drawn wavering
- Improved sketchy appearance of all markup elements
- Created more authentic hand-drawn effect for architects' markups

**Other improvements:**
- Optimized memory usage for complex markup operations
- Enhanced copy/paste functionality feedback

---

### v1.7.2 (26-Mar-2025) - UI & TOOL REFINEMENTS

**Improved arrow tool:**
- Changed from straight lines to natural S-curved arrows
- Enhanced sketchy hand-drawn appearance with better technical pen style
- Added consistent jitter and reinforcement lines for authentic look
- Ensured arrowhead has no transparency for better visibility

**Fixed circular markup issues:**
- Removed offset inconsistency between first and second circle
- Improved placement of circles with more consistent seed generation

**Reduced transparency variation:**
- Less extreme differences between opaque and transparent elements
- Improved corners and reinforcement lines visibility
- More consistent appearance for technical pen and sketchy effects

**Enhanced text tool usability:**
- Improved text dialog positioning to avoid covering the edited text
- Increased text input size by 25% for better readability
- Enlarged text input box dimensions for easier editing

**Fixed linear measurement tool issues on PC:**
- Resolved point handling and locking with proper state management
- Improved the confirmation button behavior and positioning
- Added proper cleanup of measurement states after completion

---

### v1.7.3 (26-Mar-2025) - MARKUP TOOLS INTERFACE IMPROVEMENTS

**Added dedicated cancel button:**
- Created clear method to exit any active marking tool
- Positioned below drawing tools for consistent interface layout
- Button only appears when a specific tool is selected
- Styled with red background for easy identification

**Fixed object handles persistence issue:**
- Resolved problem where yellow selection dots remained visible after tool change
- Improved handle cleanup during tool transitions
- Enhanced selection state management

**Enhanced markup tools interface:**
- Unified button styling to match main menu appearance
- Corrected hover states and colour consistency
- No tool selected by default to enable panning
- Added ESC key functionality to cancel active operations
- Implemented automatic tool cancellation when returning to main menu

**Optimized tool activation logic:**
- Ensured markup tools only usable while markup menu is open
- Improved tool state tracking and reset procedures
- Fixed cursor style transitions between tools

---

### v1.7.4 (26-Mar-2025) - RECTANGULAR FILL MARKUP TOOL ADDED

**Enhanced rectangle tool capabilities:**
- Added filled rectangle option with 20% opacity fill
- Separated rectangle and filled rectangle buttons for clarity
- Unified drawing mechanics between both rectangle types
- Fixed click-and-drag functionality for consistent operation

**Improved visual appearance:**
- Increased line opacity from 0.8 to 0.9 for better visibility
- Enhanced reinforcement strokes from 0.3 to 0.5 opacity
- Reduced transparency variations for more consistent appearance

**Refined tool usability:**
- Added specific instructions for filled rectangle tool
- Improved tool selection feedback for filled rectangle
- Fixed issues with tool state management

---

### v1.8.0 (01-Apr-2025) - MAJOR UPDATE - Scale From JSON Referenced & Sets Drawing Scale

**Automatic Scale Configuration:**
- The JSON file now sets the scale of the drawing automatically
- The script references the JSON file's `document-size` key to set canvas size
- The `document-scale` key sets the drawing scale for measurement tools
- The scale is applied to each drawing as it is loaded
- Example: If `document-scale` is "1:50", measurement tools are set to 1:50 scale

**Benefits:**
- Ensures numerous drawing sizes and scales can be automatically loaded
- Measurement tools are ALWAYS set to the correct scale for the drawing
- Reduces user error and ensures consistency
- Eliminates manual code editing for each project
- Utilizes existing data in the JSON file efficiently

**Supported Values:**
- Document sizes: A0, A1, A2, A3, A4
- Document scales: 1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:30, 1:50, 1:100, 1:200, 1:500, 1:1250, 1:2500

---

### v1.8.1 (02-Apr-2025) - MAJOR CODE CLEANUP UPDATE

- Code sections and regions reorganised
- Code has been added over many sessions, resulting in haphazard organization
- Now cleaned up and reorganised for easier maintenance
- Consistent code styling applied throughout
- All code sections have headers and are in logical order
- Created new code conventions section in header
- Assists programmers in understanding region and sub-region structure

---

### v1.8.4 (02-Apr-2025) - TEXT TOOL IMPROVEMENTS

**Separated text size control from line thickness slider:**
- Line thickness slider now only affects drawing tools (pencil, shapes, arrows)
- Added dropdown menu in text editor for font size selection
- Implemented three standardized text sizes:
  - Small (10pt)
  - Medium (12pt)
  - Large (18pt)
- Text sizes automatically scale with drawing scale to maintain consistent real-world dimensions
- Ensures text remains proportional across different paper sizes (A0-A4)

**Enhanced text editor dialog:**
- Added font size dropdown menu
- Maintained existing handwriting font style
- Preserved text color selection functionality
- Ensures text size is adjustable before and after text is added to the drawing

---

### v1.8.5 (02-Apr-2025) - ADDITIONAL MARKUP TOOL ADDED - Drawing Straight Line

**Straight Line Tool:**
- Uses the same line style appearance as the markup box drawing tool
- Appearance looks sketchy as per the markup toolset style
- Simple drag point to point function like the linear measuring tool
- Includes both mouse and touchscreen handling
- Cancel button appears when tool is activated
- Button is styled to match the markup toolset
- Button is positioned at the top of the drawing toolset (below selection tools)

---

### v1.8.6 (02-Apr-2025) - ADDITIONAL MARKUP TOOL ADDED - Draw Curved Line (Draw Arc)

**Arc Drawing Tool:**
- Uses the same line style appearance as markup box/straight line drawing tool
- Appearance looks sketchy as per the markup toolset style
- Draw the spline by dragging from start to end point
- A true arc is created but can be manipulated after creation using a centre handle
- Includes both mouse and touchscreen handling
- Cancel button appears when tool is activated
- Button is styled to match the markup toolset
- Button is positioned at the top of the drawing toolset (below selection tools)

---


### v1.9.0 (??-???-2025) - PLANNED FUTURE UPDATES

*To be determined...*

---

*For application documentation and technical details, see [Planvision__ReadMe__.md](Planvision__ReadMe__.md)*

