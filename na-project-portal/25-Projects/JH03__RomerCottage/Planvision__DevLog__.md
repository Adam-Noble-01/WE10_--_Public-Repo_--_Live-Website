# Plan Vision Development Log

This document tracks the development history, issues, lessons learned, and version updates for the Plan Vision web application.

---

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

