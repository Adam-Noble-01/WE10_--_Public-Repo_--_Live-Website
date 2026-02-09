# Noble Architecture - PlanVision Web App
## Development Log

# =============================================================================


# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.6 - 09-Feb-2026

### Changed - Phase 2A: UI Support Modules
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

### Impact
- Main HTML reduced from 713 lines to 678 lines (35 lines removed, -5%)
- New modules: +2 files (Tutorial System, Toolbar Manager)
- Legacy code cleanup: -46 lines
- Naming convention: 14 functions renamed for consistency
- Total modules: 28 → 30
- Overall reduction from original: 1,396 → 678 lines (718 lines removed, -51%)

### Module Architecture
- Tutorial System: Self-contained, mobile device detection
- Toolbar Manager: State management with safety checks
- All UI modules use three-part naming: `Na__Domain__Function`
- Pattern established: Canvas (5), Menu, Buttons, Archive, Tutorial, Toolbar

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.5.1 - 09-Feb-2026 (Hotfix)

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
- App initialization now completes successfully
- Loading overlay displays and hides correctly
- First drawing loads automatically
- All canvas functionality operational

# -----------------------------------------------------------------------------

## PlanVision - Version 2.0.5 - 09-Feb-2026

### Changed - Canvas System Modularization Complete
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

### Impact
- Main HTML reduced from 976 lines to 713 lines (263 lines removed, -27%)
- Canvas concerns fully separated from main app logic
- All 5 modules follow consistent Noble Architecture coding style
- Clear module dependencies and initialization order
- Improved testability and maintainability
- Total reduction from original: 1,396 → 713 lines (683 lines removed, -49%)

### Module Architecture
New folder created: `03__Src__AppModules/05__DrawingsCanvas/`
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

