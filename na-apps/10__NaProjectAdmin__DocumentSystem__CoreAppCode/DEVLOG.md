# Noble Architecture - Project Admin & Documentation System
## Development Log

# =============================================================================

## Version 0.3.2 - 31-Jan-2026

### Added
- **Search Engine Blocking** - Comprehensive no-index protection
  - Added `<meta name="robots" content="noindex, nofollow">` to all HTML files
  - Added `<meta name="googlebot" content="noindex, nofollow">` for Google-specific blocking
  - Created `robots.txt` with universal blocking directive (`User-agent: *, Disallow: /`)
  - Files updated: `index.html`, all Editor Tools HTML files
  - Provides defence-in-depth alongside existing PIN-based authentication
  - Prevents accidental indexing of private client project administration system

---

## Version 0.3.1 - 31-Jan-2026

### Changed
- **Menu Tutorial Overlay Improvements**
  - Moved tutorial overlay down from `top: 70px` to `top: 140px` to prevent obscuring hamburger menu button
  - New attention-grabbing animation sequence:
    - Appears solid for 3 seconds
    - Flashes 3 times over 2 seconds to grab attention
    - Auto-dismisses after 6.5 seconds total
  - Immediately dismisses when any menu item is clicked
  - New `@keyframes tutorialAppear` animation with solid display followed by flash cycles

### Fixed
- Menu tutorial overlay no longer blocks hamburger menu button visibility

---

## Version 0.3.0 - 31-Jan-2026

### Added
- **Encrypted Client Address Fields** - New site address section in Project Config
  - Fields: House Name/No., Street, District/Town/City, County, Postcode
  - Address data encrypted using Base64 + character shifting for client privacy
  - `encryptAddress()` and `decryptAddress()` helpers in `Editor__SharedUtils__.js`

- **New Project Config Fields**
  - `projectDescription` - Project description textarea
  - `specialNotes` - Internal notes field (not shown to clients)

- **Address Decryptor Module** - New `CommonUtils__AddressDecryptor__.js`
  - `decrypt()` - Reverses address obfuscation
  - `formatAddress()` - Formats address with separator options
  - `formatForDocument()` - Multi-line format for quotations/documents

### Changed
- **Editor Tools Layout** - Simplified single-column design
  - Removed JSON Output panels from all editors (no longer needed with Flask)
  - Removed "Download JSON" and "Load JSON" buttons
  - Changed layout from 2-column grid to single-column flex (~75% width)
  - Removed tabs from Terms Editor, keeping only preview

- **Editor Files Refactored**
  - `Editor__ProjectConfig__.html` - Added address/description/notes fields
  - `Editor__QuotationBuilder__.html` - Removed JSON panel
  - `Editor__TermsEditor__.html` - Removed tabs, JSON panel
  - `Editor__ProjectIndexBuilder__.html` - Removed JSON panel

- **Project Config JSON Schema** - New structure:
  ```json
  {
    "projectCode": "JS01",
    "projectName": "Rear Extension",
    "clientName": "John Smith",
    "projectDescription": "Two-storey rear extension...",
    "siteAddress": "encrypted_base64_string",
    "specialNotes": "Client prefers morning visits",
    "projectPin": "1234",
    "documents": { "quotation": true, "specialTerms": true },
    "createdDate": "31-Jan-2026",
    "lastModified": "31/01/2026, 20:30:45"
  }
  ```

### Removed
- JSON Output panels from all editor tools
- Download JSON / Load JSON buttons (Flask API handles file operations)
- Preview/JSON tabs from Terms Editor
- `.json-output` and `.tab` CSS classes from common stylesheet

# =============================================================================

## Version 0.2.0 - 31-Jan-2026

### Added
- **Flask Editor Tools Integration** - Full integration of editor tools into main application
  - Editor tools now available in navigation menu when running on localhost Flask server
  - Auto-detection of Flask server via `/api/health` endpoint
  - Editor Tools section appears after standard navigation items with purple "Dev" badges
  - Editors load inline in main content area via iframe with project context

- **Flask API Endpoints** - New project management API in `start_local_server.py`
  - `GET /api/project/<year>/<code>/files` - List project files
  - `GET/PUT /api/project/<year>/<code>/<filename>` - Read/write specific files
  - `POST /api/project/create` - Create new project with full folder structure
  - `GET /api/projects/scan` - Scan na-project-portal for all projects
  - `PUT /api/config/project-index` - Update ProjectKeysIndex.json

- **Editor Shared Utilities** - New `Editor__SharedUtils__.js` module
  - `isLocalDevServer()` - Detect Flask server availability
  - `getProjectFromUrl()` / `initialiseProjectContext()` - URL parameter parsing
  - `loadProjectFile()` / `saveProjectFile()` - Flask API file operations
  - `markDirty()` / `hasUnsavedChanges()` - Dirty state tracking
  - `showConfirmDialog()` / `showSaveConfirmDialog()` - Confirmation modals
  - `showSuccessMessage()` / `showErrorMessage()` - Toast notifications
  - `createStatusBar()` - Status bar with project context display
  - `createProject()` / `scanProjects()` / `updateProjectIndex()` - Project operations

- **Project Creation** - New project creation via Project Manager
  - Create new project with full folder structure via Flask API
  - Automatically creates: 01__Archive, 10__ProjectAdmin__AppContent, 20__PlanVision__AppContent, 30__TrueVision__AppContent
  - Generates template files: ProjectAdmin__ProjectConfig__.json, ProjectAdmin__Quotation__.json, ProjectAdmin__SpecialTerms__.json
  - Auto-updates project index after creation
  - Project code validation (XX00 format)

### Changed
- **Editor Tools Architecture** - Complete refactor for Flask integration
  - All four editors now support dual mode: Flask API (localhost) and standalone (file-based)
  - Auto-load project data when embedded in main application
  - "Save to Project" button for direct file saving when Flask available
  - Confirmation dialogs before overwriting files
  - Unsaved changes warnings before navigation
  - Status bar showing project context, file state, and Flask mode

- **Navigation Module** (`UserInterface__Navigation__.js`)
  - Added `detectLocalDevMode()` function
  - Added "Editor Tools" section in menu when localhost detected
  - Menu items: Edit Project Config, Edit Quotation, Edit Special Terms, Project Manager
  - `loadEditorInline()` for embedding editors in main content
  - `closeActiveEditor()` with unsaved changes check

- **Project Index Builder** (`Editor__ProjectIndexBuilder__.html`)
  - Renamed to "Project Manager" for clarity
  - New project creation form with validation
  - Scan projects via Flask API
  - Direct index saving to AppConfiguration__ProjectKeysIndex__.json
  - Improved UI with project count indicator

### Technical Details
- Flask server version updated to 2.0.0
- All editor tools load `Editor__SharedUtils__.js` for common functionality
- Editors detect `?embedded=true` parameter when loaded in iframe
- CSS added for `.nav-menu__badge--dev` (purple badge for dev tools)
- `beforeunload` event handling for unsaved changes protection

# =============================================================================

## Version 0.1.3 - 31-Jan-2026

### Added
- **Project Index Builder** - Enhanced editor tool for managing project index
  - **Auto-load Directory** - IndexedDB storage of FileSystemDirectoryHandle for automatic directory scanning
  - **Inline Editing** - Click-to-edit functionality for project code and folder names with validation
  - **Save Index Button** - Direct file save using File System Access API with suggested filename
  - **Per-Project Purge** - Contract purging per project row with confirmation dialogue
  - **Forget Directory** - Button to clear stored directory handle from IndexedDB

- **Cloudflare Worker - Signature Purging** - DELETE endpoint for testing and rectification
  - Added `purgeSignatures()` handler to signature.js (CloudflareHandler__Signature__.js)
  - Deletes signatures from both R2 locations (project folder + central archive)
  - Returns count of deleted records and keys for audit trail
  - Validates project code format before deletion

### Changed
- **Asset Loading Strategy** - Refactored for GitHub Pages compatibility
  - HTML now uses `data-asset-src` and `data-asset-href` attributes instead of direct paths
  - AssetLoader dynamically injects full absolute URLs from configuration
  - `updateImageSources()` and `updateFaviconLinks()` parse data attributes and inject URLs
  - Eliminates 404 errors on GitHub Pages by preventing browser from loading assets before AssetLoader initialises
  - QuotationRenderer and TermsRenderer now exclusively use `AssetLoader.getAssetUrl()`

- **Cloudflare Worker File Naming** - Updated to follow Noble Architecture conventions
  - `index.js` → `CloudflareWorker__Main__.js`
  - `handlers/auth.js` → `handlers/CloudflareHandler__Auth__.js`
  - `handlers/signature.js` → `handlers/CloudflareHandler__Signature__.js`
  - `handlers/r2.js` → `handlers/CloudflareHandler__R2__.js`
  - Updated `wrangler.toml` and `package.json` to reference new main file
  - Updated all import statements in worker modules

- **Local Development Server** - Migrated from http.server to Flask
  - Implemented Flask with CORS support using `flask-cors`
  - Added command-line arguments: `--debug`, `--port`, `--project`, `--year`, `--no-browser`
  - Regional code structure applied to Python for consistency
  - API endpoints: `/api/health` and `/api/config`
  - Static file serving with proper directory index handling
  - Defaults to opening JS01 project on launch
  - Auto-installs dependencies from requirements.txt if not found

- **Configuration Authority** - Enforced config-driven paths
  - `AppCore__Main__.js` now reads `config.AppConfig.Paths.projectPortalBase` instead of hardcoded `/na-project-portal/`
  - Ensures all path resolution respects configuration as single source of truth
  - Maintains both local development (../../) and production (/) path compatibility

### Fixed
- **CORS Configuration** - Cloudflare Worker now handles all origins correctly
  - `getAllowedOrigin()` explicitly handles `null` origin for `file://` protocol access
  - Added `localhost` to allowed origins for local development
  - Worker deployed with updated CORS headers

- **Project Index Loading Race Condition** - Fixed timing issue in AppCore__Main__.js
  - Added explicit `await ConfigManager.waitForProjectIndex()` before loading projects
  - `guessProjectFolderName()` now actively waits for project index if not loaded
  - Prevents incorrect project path guessing when index loads late

- **Static File Serving** - Fixed Flask route ordering
  - API routes now defined before catch-all static route
  - Directory requests correctly serve index.html
  - Asset path resolution fixed for nested directories

### Deployment
- Updated `deploy.bat` to reflect new Cloudflare Worker file names
- Updated `start_local_server.bat` to handle Flask dependencies
- Added `requirements.txt` with Flask and flask-cors dependencies
- Updated `SETUP_GUIDE.md` with new file structure documentation

# =============================================================================

## Version 0.1.2 - 31-Jan-2026

### Changed
- **Code Organization** - Refactored multiple files with logical regional structure
  
  **AppCore__Main__.js**
  - Broke down 751-line file into 9 logical sub-regions for better code navigation
  - Added regions: STATE, INITIALIZATION, PROJECT LOADING, SESSION MANAGEMENT, AUTHENTICATION, CONTENT DISPLAY, SIGNATURE WORKFLOW, UTILITY FUNCTIONS, API EXPORT
  - Improved code folding support and maintainability
  
  **Editor Tools (04__EditorTools/)**
  - Refactored all three editor HTML files with consistent regional structure
  - `Editor__ProjectConfig__.html` - Added HTML and JavaScript regions (INITIALIZATION, VALIDATION, PIN OPERATIONS, JSON GENERATION, UI ACTIONS, FILE OPERATIONS)
  - `Editor__QuotationBuilder__.html` - Added regions (STATE, INITIALIZATION, LINE ITEM MANAGEMENT, RENDERING, CALCULATIONS, JSON GENERATION, UI ACTIONS, FILE OPERATIONS)
  - `Editor__TermsEditor__.html` - Added regions (STATE, INITIALIZATION, TERMS MANAGEMENT, RENDERING, UI ACTIONS, JSON GENERATION, FILE OPERATIONS)
  - Consistent HTML regions: Document Head, Document Body, UI Header, UI Main, UI Panels, UI Hidden inputs
  - All functionality preserved, purely organizational refactoring

# =============================================================================

## Version 0.1.1 - 31-Jan-2026

### Fixed
- **Signature Form Submission** - Implemented missing signature form handlers
  - Added `setupSignatureForm()` to handle form submission and cancellation
  - Added `handleSignatureSubmit()` to process signature, create audit record, and store
  - Fixed issue where completing signature returned to default screen instead of project content
  - URL query parameters now preserved after signature completion
  - Navigation menu badges now refresh after signature to show "Signed" status
  - Returns user to signed document view after successful submission
  
- **Logout Function** - Fixed URL parameter preservation on logout
  - Changed from `window.location.reload()` to `window.location.href = currentUrl`
  - Ensures project code and year parameters persist after logout

# =============================================================================

## Version 0.1.0 - 31-Jan-2026

### Added
- **Core App Shell** - Main application structure with index.html entry point
- **Module System** - ES6 module architecture with dependency management
- **Configuration Manager** - Centralised config via AppConfiguration__MainAppSettings__.json

- **Authentication System** (30__Authentication/)
  - PIN-based login with SHA-256 hashing
  - Session management via sessionStorage
  - Lockout protection (5 attempts, 300s duration)
  - Audit logging of all auth attempts

- **Document System** (20__DocumentSystem/)
  - Quotation renderer with line items and phase grouping
  - Terms & Conditions renderer (special + general)
  - General Terms HTML template (15 sections)

- **Signature System** (40__SignatureSystem/)
  - Canvas-based signature capture
  - Court-admissible audit records
  - Dual sign-off (quotation + terms)
  - Dual storage (project folder + archive)

- **Cloudflare Integration** (50__CloudflareIntegration/)
  - ApiClient module for Worker communication
  - R2 bucket integration for dynamic content

- **Cloudflare Workers** (05__CloudflareWorkers/)
  - `na-projectadmin-api` Worker deployed
  - Auth handler for PIN validation
  - Signature handler for record storage
  - R2 handler for bucket operations
  - Worker URL: https://na-projectadmin-api.adam-fb3.workers.dev/

- **Editor Tools** (04__EditorTools/)
  - Quotation Builder - offline line item editor
  - Terms Editor - WYSIWYG for special terms
  - Project Config Editor - PIN and metadata setup

- **UI Components** (10__UserInterface/)
  - Dynamic navigation menu
  - Modal manager
  - Loading overlays

- **Project Loading**
  - URL query parameter support (?project=XX00&year=26)
  - Dynamic project content from R2

### Configuration
- Main config: `03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json`
- Worker URL: `https://na-projectadmin-api.adam-fb3.workers.dev/`
- R2 Bucket: `noble-architecture-cdn`
- CDN Domain: `https://cdn.noble-architecture.com/`

# =============================================================================

## Planned Features
- Document library viewer
- Email notifications
- PDF export
- Multi-language support

