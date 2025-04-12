=========================================================================================
Project Details
App Name    | Noble-Architecture_-_Plan-Vision-App_-_1.7.2.html
App Version | 2.0.0 - !Currently in Development!
App Type    | HTML/CSS/JS Web Application
App Details | A web application for viewing and interacting with Architectural Drawings.
Author      | Adam Noble – Noble Architecture
=========================================================================================

### BRIEF DESCRIPTION
- PlanVision is a web application for viewing and interacting with Architectural Drawings.
- It is designed to be used on desktop, tablet and mobile devices.
- It is a single page application that uses a sidebar menu to navigate between different views.
- The Application is intended for usage amongst Architecture & Construction Professionals.
- The application is used for loading drawings from a remote JSON configuration file.
- Users can then select the drawings they wish to view from the sidebar menu.
- The application will then load the selected drawing onto the canvas.
- The application will then load the selected drawing metadata and drawing scale from the JSON configuration file.
- The application will then load the selected drawing image from the JSON configuration file.
- The application will then load the selected drawing PDF from the JSON configuration file.
- Accuracy with the measurement tools is key, However accurate scales are loaded and computed based on the JSON configuration file.
- This is dealt with by the application intelligently scaling the drawing to the correct size for the device it is being viewed on.



### CURRENT FEATURES IMPLEMENTED

#### DYNAMIC LOADING SYSTEM
- A two-tier loading system separating app assets from project assets.

**Application Asset Dynamic Loading System**
- A centralised asset library for consistent fonts and images across all devices.
- A Application specific dynamic loading system for assets such as fonts, icons and images etc.
- This data is loaded from a centralised Json core asset library.

**Project Specific Dynamic Loading System**
- A project specific dynamic loading system for loading drawings and metadata.
    - A remote JSON configuration file for loading drawings and metadata.
    - This allows for a single app to be used across multiple projects.
- Json Data dynamically populates the sidebar menu with toolbar buttons.
- These buttons are also mapped to the Download PDF button per page loaded.

**Dynamic Scale Recognition**
- The drawings realworld scale is loaded from the JSON configuration file.
- The application then intelligently ensures the measurement tools are scaled.
- The application fetches both the drawing scale and the paper size from the JSON configuration file.
- The application then uses this information to compute the correct scale.


**Dual Image & PDF File Loading**
- The application loads a PNG image and a PDF file with the same base file name.
    - The PNG File is used for the canvas view.
    - The PDF File is used for the Download feature.
- The dual-file approach was introduced in response to earlier issues on iOS where PDF-only
  implementations led to memory constraints. 
- The PNG handling ensures compatibility across devices while the PDF file offers a formatted download.


#### MEASUREMENT TOOLS
- A linear measurement tool for precise distance calculations.
- A rectangular measurement tool for precise distance calculations.
- An area measurement tool for computing polygon areas.

#### FILE TOOLS
- A PDF download feature allowing users to to download their PDF Files.
- Responsive design ensuring compatibility across various devices.
- Dynamic loading of drawing data via a remote JSON configuration file


=========================================================================================
## FULL BREAKDOWN OF THE APPLICATION
NOTE | ⚠ Below information may be out of date, I need to validate this information.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
ISSUES & LESSONS LEARNED  

- Initial PDF-only approach caused performance and memory issues on iOS devices.  
    - The integration of PNG image handling resolved these issues and improved cross-device compatibility.  
    - Maintaining two separate files (PNG and PDF) leverages the benefits of both in-app viewing and downloadable formatted documents.  

- Application failed to load due to missing root DOM element (`#app`).  
    - The script was executing before the DOM fully loaded, causing critical errors.  
    - Resolved by ensuring the `#app` element exists before running JavaScript logic.  

- Full screen mode did not function properly in Google Sites embeds.  
    - Browsers restrict fullscreen access within iframes, affecting functionality.  
    - Added fallback handling for unsupported fullscreen environments.  

- Mobile usability was initially poor due to lack of user guidance.  
    - The previous implementation displayed a static message instructing users to rotate their device.  
    - This was replaced with a dynamic tutorial animation that visually introduces the tools menu.  

- Toolbar animation and menu visibility improvements were required.  
    - Initially, the toolbar left a grey margin when hidden, affecting canvas usability.  
    - The toolbar was adjusted to overlay the canvas instead of affecting its dimensions.  

- Measurement tools needed UI refinement.  
    - Previously, the measurement tools' buttons were not intuitive for first-time users.  
    - Added clear instructions and improved the visibility of the confirm/cancel buttons.  

- Device orientation detection required refinements.  
    - Early mobile detection logic only considered width constraints, missing certain tablets.  
    - Implemented improved detection for phones, tablets, and iPads, ensuring proper UI scaling.  

- Initial PDF-only approach caused performance and memory issues on iOS; integrating PNG resolved these issues.
- Early loading errors were resolved by ensuring the #app element exists before JavaScript execution.
- Fullscreen mode was adjusted for better functionality in embedded contexts.
- Mobile usability was enhanced with dynamic tutorial animations and improved toolbar handling.
- UI refinements were made for measurement tools, and device orientation detection was improved for better scaling across phones, tablets, and iPads.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
ASSET LOADING ARCHITECTURE

The application uses a two-tier approach for loading resources:

1. App Assets (Centralised Asset Library)
    - Loads core UI assets from a centralised JSON repository
    - Fetches from "SN40_31_--_PlanVision_-_Asset-Link-Library.json"
    - Provides consistent fonts, logos, and UI elements across all instances
    - Assets include:
        * Fonts: Open Sans (regular, light, semi-bold) and Caveat (regular, semi-bold)
        * Logo: Noble Architecture brand imagery
        * UI elements: Common interface components
    - Font loading is handled via dynamic @font-face declarations injected into a style element
    - Ensures visual consistency across different deployments and devices

2. Project Assets (Drawing Library)
    - Loads project-specific drawings from a project JSON repository
    - Each project has its own data file (e.g., "GA06_-_DATA_-_Document-Library.json")
    - Contains links to:
        * PNG files for on-screen display
        * PDF files for high-quality downloads
    - Supports multiple drawings per project with dynamic toolbar buttons
    - Drawing metadata includes document names and proper filenames for downloads

    The dual-library approach separates core application assets from project-specific content,
allowing the same app version to be used across multiple projects while maintaining
consistent branding and UI elements.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    DYNAMIC LOADING FROM REMOTE JSON CONFIGURATION FILE - UPDATED FOR v1.8.0
    JSON Functionality Overview
    Dynamically loads drawing data by fetching a JSON file from a remote source.
    Expects a nested JSON structure under "na-project-data-library" → "project-documentation" → "project-drawings"; missing keys trigger error messages.
    Dynamically creates toolbar buttons for each drawing entry (ignoring template placeholders) to allow selection of multiple drawings.
    NEW IN v1.8.0: Extracts drawing scale and paper size metadata to configure accurate measurement tools.
    NEW IN v1.8.0: Automatically applies the correct scale factors based on document-scale and document-size values.
    Updates the PDF download link dynamically based on the selected drawing's metadata, including generating a filename derived from the drawing name.
    Implements asynchronous loading (using async/await) to ensure a non-blocking user interface during data retrieval and image loading.
    Incorporates extensive error checking and logging to aid in debugging and maintain robust functionality.
    Improves maintainability and scalability compared to hardcoded URLs, addressing previous iOS issues by enabling efficient handling of multiple drawings.
    JSON Keys and Their Roles
    "na-project-data-library"
    -   > Root container for all project-related data.
    "project-documentation"
        -> Nested under the root; contains documentation details including drawings.
    "project-drawings"
        -> Nested under "project-documentation"; holds individual drawing entries.
    Drawing Entry Keys (each key starting with "drawing-"):
    "file-name"
        -> Specifies the drawing file's name; template entries (marked as {{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}) are ignored.
    "document-name"
        -> Provides the display name for the drawing, used as the label on toolbar buttons.
    "document-scale" (NEW IN v1.8.0)
        -> Specifies the drawing scale (e.g., "1:50") used for accurate measurements.
        -> Supports values from "1:1" through "1:2500".
    "document-size" (NEW IN v1.8.0)
    -   > Specifies the paper size (e.g., "A1") for dimension calculations.
        -> Supports standard A-series sizes (A0-A4).
    "document-links"
        -> Contains URLs for drawing assets:
    "png--github-link-url"
        -> URL to load the drawing image (PNG) onto the canvas.
    "pdf--github-link-url"
        -> URL for the downloadable PDF version of the drawing.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
VISUAL JSON HIERARCHY TREE

    na-project-data-library  
    └── project-documentation  
    └── project-drawings  
        ├── drawing-01  
        │  ├── file-name          
        │  ├── added-to-register  
        │  ├── document-type      
        │  ├── document-name      
        │  ├── document-scale     // NEW IN v1.8.0
        │  ├── document-size      // NEW IN v1.8.0
        │  ├── document-status    
        │  ├── document-notes     
        │  ├── document-revisions
        │  │  └── revision-a, revision-b, etc.
        │  └── document-links  
        │    ├── png--windows-dir-path
        │    ├── pdf--windows-dir-path
        │    ├── png--github-link-url  
        │    └── pdf--github-link-url  
        └── drawing-02 …  


- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
FUTURE SCRIPT IMPROVEMENTS & IDEAS

- 1.3.0 Updates Planned
  - List Improvemnets  . . .


- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
SCRIPT DEVELOPMENT & VERSION HISTORY TRACKER

22-Feb-2025 - v0.2.0  |  Basic functions tested across four client projects.
22-Feb-2025 - v0.2.1  |  Linear & area measurement tools, PDF download and dual-file (PNG/PDF) handling implemented.
22-Feb-2025 - v0.3.1  |  Improved measurement scaling and initial compatibility fixes.

10-Mar-2025 - v1.4.0  |  MAJOR UI & USABILITY ENHANCEMENTS
                    - Mobile usability improvements implemented for phones, tablets, and iPads.  
                    - Removed placeholder message for portrait mobile devices.  
                    - New tutorial animation: Upon first launch, menu now opens briefly before retracting, followed by an arrow tooltip guiding users to the tools menu.  
                    - New Fullscreen Mode Button: Added fullscreen toggle within the toolbar.  
                    - Fixed Menu Behaviour: Ensured menu correctly overlays the drawing instead of affecting the canvas scale.  
                    - Additional performance optimisations and minor bug fixes.  
10-Mar-2025 - v1.4.1  |  Drawing Markers changed from circles (Dots At Node Points) changed to "+" Shaped Crossheirs for improved accuracy.

16-Mar-2025 - v1.5.0  |  MAJOR RELEASE UPDATE - DYNAMIC LOADING & FEATURE UPDATES
                    - Introduced dynamic loading of drawing data by fetching a JSON file from a remote source.
                    - Expects a nested JSON structure under "na-project-data-library" → "project-documentation" → "project-drawings".
                    - Each drawing entry (keys starting with "drawing-") includes:
                        - "file-name": The name of the drawing file (template entries are ignored).
                        - "document-name": The display name used for toolbar buttons.
                        - "document-links": Contains asset URLs for:
                            - "png--github-link-url": The URL for the PNG image used on the canvas.
                            - "pdf--github-link-url": The URL for the downloadable PDF version.
                    - Dynamically creates toolbar buttons for each drawing, allowing users to select from multiple drawings.
                    - Updates the PDF download link dynamically based on the selected drawing's metadata, generating filenames from the drawing name.
                    - Implements asynchronous loading (using async/await) for JSON data and images to ensure a smooth, non-blocking user experience.
                    - Includes extensive error checking and logging to aid in debugging and maintain robust functionality.
                    - Adds a conditional polyfill loader that only loads the core-js-bundle if modern JavaScript features 
                        - (e.g. Promise) are missing—ensuring compatibility with older iOS devices while avoiding unnecessary overhead on newer devices.
16-Mar-2025 - v1.5.5  | TOOL ADDED -RECTANGULAR MEASUREMENT TOOL
                    - Introduced a new "Rectangle Measurement" tool to complement the existing linear and area measurement functionalities.
                    - Real-time rectangle drawing: Users can click and drag to define a rectangle, with the shape updating dynamically as the mouse moves, enhancing fluidity and usability compared to earlier static implementations.
                    - Orthogonal snapping: Automatically aligns the rectangle to horizontal or vertical axes (within 15° tolerance) for precise, clean measurements, mirroring the linear tool's snapping behavior.
                    - Area calculation: Computes and displays the area in square meters (m²) based on the scaled canvas dimensions, consistent with the app's measurement system.
                        Implementation Details:
                        - Added `isRectDragging` state variable to track active dragging, paired with `isRectMeasuring` for tool activation.
                        - Modified `onMouseDown`, `onMouseMove`, and `onMouseUp` event handlers to support click-and-drag workflow: `mousedown` sets the start point, `mousemove` updates the end point with snapping, and `mouseup` finalizes the shape pending confirmation.
                        - Enhanced `renderLoop` to draw the rectangle preview in real-time using `drawRectangle` with a semi-transparent fill for better visibility during interaction.
                        - Integrated into `finalizeMeasurement` to save the rectangle's area and points upon clicking "Confirm," resetting states appropriately.
                        User Experience Improvements:
                        - Added instructional overlay for first-time use, explaining the click-and-drag process and confirmation step.
                        - Set cursor to "crosshair" during tool use for intuitive feedback, aligning with the linear tool's UX.
                        - Resolved fluidity issues reported in prior versions by ensuring continuous updates during mouse movement, making it feel as responsive as the linear tool.
                        - Tested across desktop and touch devices, with adjustments to `onTouchStart` and `onTouchMove` for seamless mobile support.
16-Mar-2025 - v1.5.6  | RENDER EFFECT ADDED
                        - Added a subtle shadow effect creating the illusion of paper drawing plan.
                        - Sets drop shadow properties for the drawing.

16-Mar-2025 - v1.5.8  | Updated Rectangular Measurement Tool
                        - Added measurements to the rectangle.
                        - Measurements are displayed next to the rectangle.


25-Mar-2025 - v1.6.0  |  MAJOR RELEASE UPDATE
                    - Markup Drawing Tools
                        - Creates a new nested toolset allowing architects to markup drawings with freehand notes and drawings.
                        - Switches the default toolset to a markup focused palette.
                        - Differenciates itself stylewise by using a technical pen like line style.
                        - Introduces a hand sketched style easily recognisable to architects and users of the drawings.
                            - Ensuring its clear it is a different marked up plan version and not the original drawing.
                    - New Tool Accessed From Toolbar
                    - Replaces the standard measuring and drawing selection toolset with a different tools pallete
                    - User can toggle between the two toolsets
                    - The markup toolset includes the following tools:
                        - Markup freehand pen tool
                        - Text Box Creation - Uses a Handwriting font to write the text
                        - Arrow Pen Drawing Tool
                            - Spline Based Arrow Drawing Tool
                            - Uses a sketchy line style
                            - Uses a transparent fill
                            - Feels like a technical pen hand sketched
                            - Arrowheads are created at the end of the arrow line.
                        - Freehand Arrow Drawing Tool
                            - Spline Based Arrow Drawing Tool
                            - Uses a sketchy line style
                            - Uses a transparent fill
                            - Feels like a technical pen hand sketched
                            - Arrowheads are created at the end of the arrow line.
                        - Rectangle Drawing Tool
                            - Polygon Drawing Tool
                            - Uses a sketchy line style
                            - Uses a transparent fill
                            - Feels like a technical pen hand sketched
                        - Circle Drawing Tool
                            - Uses a sketchy line style
                            - Feels like a technical pen hand sketched

25-Mar-2025 - v1.6.1  |  UI LAYOUT IMPROVEMENTS
                    - Reorganised toolbar layout for better usability:
                        - Moved "Select Drawing" section to the top of the toolbar
                        - Added clear section dividers with headers
                        - Reordered sections to follow logical workflow:
                            1. Select Drawing
                            2. View & Export
                            3. Measuring Tools
                            4. Drawing & Markup
                    - Added spacer after drawing selection for improved visual separation
                    - Enhanced toolbar section visibility management when switching between measuring and markup tools

25-Mar-2025 - v1.6.6  |  UI LAYOUT FIXES & INTERACTIVE IMPROVEMENTS
                    - Fixed color swatch layout issues when revisiting markup tools:
                        - Properly resets flexbox container properties
                        - Ensures color swatches maintain grid layout regardless of menu state
                    - Improved handle positioning during canvas manipulation:
                        - Handles now correctly track with their elements when zooming
                        - Control points properly follow elements when panning
                        - Selection handles remain accurately positioned after view reset
                    - Added copy and paste functionality for markup elements:
                        - Press Ctrl+C to copy any selected element
                        - Press Ctrl+V to paste at current mouse position
                        - Smart positioning automatically centers pasted elements
                        - Consecutive pastes are slightly offset to avoid overlap
                        - Works with all element types (shapes, text, arrows, freehand)
                        - Shows brief visual feedback when copying elements
                        - Pasted elements are automatically selected for immediate editing

25-Mar-2025 - v1.7.0  |  CENTRALISED ASSET LIBRARY IMPLEMENTATION
                    - Added centralised asset library for consistent branding and UI assets:
                        - Implemented dynamic font loading system using @font-face declarations
                        - Added Open Sans font family (regular, light, semi-bold) for UI elements
                        - Added Caveat font family (regular, semi-bold) for markup handwriting style
                        - Created a two-tier loading system separating app assets from project assets
                    - Improved text rendering quality:
                        - Text markup now uses Caveat font for authentic handwriting appearance
                        - Consistent typography across all device types and screen sizes
                    - Enhanced asset management:
                        - App assets (fonts, logos) now loaded from centralised repository
                        - Project assets (drawings) continue to load from project-specific repository
                        - Automatic fallback system when assets can't be loaded
                    - Fixed display issues:
                        - Resolved canvas container CSS selector mismatch
                        - Corrected font scaling on different zoom levels
                        - Improved text positioning in markup elements

25-Mar-2025 -  - v1.7.1  |  UI CLEANUP & OPTIMIZATION
                    - Removed Polygon Tool from markup toolset for improved usability:
                        - Simplified markup tools menu by eliminating rarely used functionality
                        - Reduced user interface clutter
                        - Maintained backward compatibility with existing polygon elements 
                    - Enhanced markup tools appearance:
                        - Implemented more realistic technical pen drawing style
                        - Added variable line thickness and natural hand-drawn wavering
                        - Improved sketchy appearance of all markup elements (lines, shapes, arrows)
                        - Created more authentic hand-drawn effect for architects' markups
                    - Other improvements:
                        - Optimized memory usage for complex markup operations
                        - Enhanced copy/paste functionality feedback

26-Mar-2025 - v1.7.2  |  UI & TOOL REFINEMENTS
                    - Improved arrow tool:
                        - Changed from straight lines to natural S-curved arrows
                        - Enhanced sketchy hand-drawn appearance with better technical pen style
                        - Added consistent jitter and reinforcement lines for authentic look
                        - Ensured arrowhead has no transparency for better visibility
                    - Fixed circular markup issues:
                        - Removed offset inconsistency between first and second circle
                        - Improved placement of circles with more consistent seed generation
                    - Reduced transparency variation across all markup elements:
                        - Less extreme differences between opaque and transparent elements
                        - Improved corners and reinforcement lines visibility
                        - More consistent appearance for technical pen and sketchy effects
                    - Enhanced text tool usability:
                        - Improved text dialog positioning to avoid covering the edited text
                        - Increased text input size by 25% for better readability
                        - Enlarged text input box dimensions for easier editing
                    - Fixed linear measurement tool issues on PC:
                        - Resolved point handling and locking with proper state management
                        - Improved the confirmation button behavior and positioning
                        - Added proper cleanup of measurement states after completion

26-Mar-2025 - v1.7.3  |  MARKUP TOOLS INTERFACE IMPROVEMENTS
                    - Added dedicated cancel button for markup tools:
                        - Created clear method to exit any active marking tool
                        - Positioned below drawing tools for consistent interface layout
                        - Button only appears when a specific tool is selected
                        - Styled with red background for easy identification
                    - Fixed object handles persistence issue:
                        - Resolved problem where yellow selection dots remained visible after tool change
                        - Improved handle cleanup during tool transitions
                        - Enhanced selection state management
                    - Enhanced markup tools interface:
                        - Unified button styling to match main menu appearance
                        - Corrected hover states and colour consistency
                        - No tool selected by default to enable panning
                        - Added ESC key functionality to cancel active operations
                        - Implemented automatic tool cancellation when returning to main menu
                    - Optimized tool activation logic:
                        - Ensured markup tools only usable while markup menu is open
                        - Improved tool state tracking and reset procedures
                        - Fixed cursor style transitions between tools

26-Mar-2025 - v1.7.4  |  RECTANGULAR FILL MARKUP TOOL ADDED
                    - Enhanced rectangle tool capabilities:
                        - Added filled rectangle option with 20% opacity fill
                        - Separated rectangle and filled rectangle buttons for clarity
                        - Unified drawing mechanics between both rectangle types
                        - Fixed click-and-drag functionality for consistent operation
                    - Improved visual appearance:
                        - Increased line opacity from 0.8 to 0.9 for better visibility
                        - Enhanced reinforcement strokes from 0.3 to 0.5 opacity
                        - Reduced transparency variations for more consistent appearance
                    - Refined tool usability:
                        - Added specific instructions for filled rectangle tool
                        - Improved tool selection feedback for filled rectangle
                        - Fixed issues with tool state management
                        
01-Apr-2025 - v1.8.0  |  MAJOR UPDATE - Scale From JSON Referenced & Sets Drawing Scale
                    - The Json File that used to just set the name for the buttons now also sets the scale of the drawing.
                    - The script now references the Json files "document-size" key which values are used to set the size of the canvas.
                    - The "document-scale" key in the Json file now sets the scale of the drawing.
                        - The scale of the drawing is applied to each page as it is loaded.
                        - Example: If the scale value for "document-scale" is 1:50, then this sets the scale of the drawing to 1:50.
                        - This ensures the data already contained in the Json file is used to set the scale of the drawing.
                        - This ensures each drawing has its measurment tools set to the correct scale.  
                    - This critically ensures numerous drawing sizes and scales can be automatically loaded and used in the application.
                        - Critically ensuing the measurment tools are always set to the correct scale for the drawing.
                        - This reduces user error and ensures the measurment tools are ALWAYS displayed in the correct scale.
                    - Values Supported for "document-size" are:
                        - Note : This values drive the scaling of the canvas.
                        - Note : Checks the Json File when the app launches to see the values used for the current drawing set.
                        - "A0"
                        - "A1"
                        - "A2"
                        - "A3"
                        - "A4"
                    - Values Supported for "document-scale" are:
                        - Note : This values drive the scaling of the measurment tools.
                        - Note : These values also drive the scaling of Markup tools
                        - Note : This ensures scaling of all tools are consistent across all drawings, i.e. text sizes
                        - Note : Check the Json File when the app launches to see the values used for the current drawing set.
                        - "1:1"
                        - "1:2"
                        - "1:5"
                        - "1:10"
                        - "1:20"
                        - "1:25"
                        - "1:30"   
                        - "1:50"
                        - "1:100"
                        - "1:200"
                        - "1:500"
                        - "1:1250"
                        - "1:2500"
                    - What this fixes? Manual editing of the code for each project, the keys and values will always be correct in the 
                      Thus not utilising the already existing data in the Json File was heavily innefficient.                    


02-Apr-2025 - v1.8.1  |  MAJOR CODE CLEANUP UPDATE
                    - Code sections and regions reorganised.
                      - Code has been added to over many many sessions so sections were hapharzardly added and removed.
                      - This has now been cleaned up and reorganised to make it easier to maintain and update the code.
                    - Consistent code styling applied.
                    - Now all code sections have a header and are in a logical order rather than being illogoically ordered.
                    - Created a new code conventions section for the header section to assist and make it clear to other programmers
                      how to maintain and update the code, and the region and sub region structure.

02-Apr-2025 - v1.8.4  |  TEXT TOOL IMPROVEMENTS
                    - Separated text size control from line thickness slider:
                        - Line thickness slider now only affects drawing tools (pencil, shapes, arrows)
                        - Added dropdown menu in text editor for font size selection
                        - Implemented three standardized text sizes:
                            • Small (10pt)
                            • Medium (12pt)
                            • Large (18pt)
                        - Text sizes automatically scale with drawing scale to maintain consistent real-world dimensions
                        - Ensures text remains proportional across different paper sizes (A0-A4)
                    - Enhanced text editor dialog:
                        - Added font size dropdown menu
                        - Maintained existing handwriting font style
                        - Preserved text color selection functionality
                        - Ensures text size is adjustable before and after text is added to the drawing

02-Apr-2025 - v1.8.5  |  ADDITIONAL MARKUP TOOL ADDED - Drawing Staight Line 
                    - Straight Line Tool
                        - Uses the same line style appearance as used on the markup box drawing tool
                        - Appearance of the lines look sketchy as per the markup toolset style and design intent
                        - Simple drag point to point function like the linear measuring tool
                        - Inlcudes both mouse and touchscreen handling
                        - Cancel button appears when the tool is activated 
                          - (In the markup toolset menu as with other tools)
                        - Button is styled to match the markup toolset  
                        - Button is positioned in the markup toolset at the top of the drawing toolset
                            - Below the selection tools

02-Apr-2025 - v1.8.6  |  ADDITIONAL MARKUP TOOL ADDED - Draw Cruved Line (Draw Arc) 
                    -  Arc Drawing Tool 
                        - Uses the same line style appearance as used on the markup box / straight line drawing tool
                        - Appearance of the lines look sketchy as per the markup toolset style and design intent
                        - Draw the spline by dragging from the start to the end point
                        - A true arc is created but can be manipulated after creation using a centre handle
                        - Inlcudes both mouse and touchscreen handling
                        - Cancel button appears when the tool is activated 
                          - (In the markup toolset menu as with other tools)
                        - Button is styled to match the markup toolset  
                          - (Buttonn was created in the previous version, may need linking and listeners etc)
                        - Button is positioned in the markup toolset at the top of the drawing toolset
                            - Below the selection tools


??-???-2025 - v1.9.0  |  LIST FUTURE UPDATES HERE
