# Noble Architecture - Project Admin & Documentation System
## Development Log

# =============================================================================

## Version 0.4.3 - 31-Jan-2026

### Fixed - Client Data Display in Documents

This release fixes the missing client address, email, and phone number in quotation documents. Client PII is now properly fetched from encrypted Cloudflare R2 storage and displayed in rendered documents.

#### Cloudflare Worker Deployment
- **`deploy.bat`** - Updated deployment script documentation
  - Added `CloudflareHandler__ClientData__.js` to module structure documentation
  - Added `/projectadmin/clientdata` endpoint to test endpoints list
  - Deployed worker with client data handler (Version ID: `d8f81a9e-95a6-4a58-bea3-f4d7d9f68a40`)

- **`CREDENTIALS_BACKUP.txt`** - Added encryption key backup
  - Stored `CLIENT_DATA_KEY` secret for AES-256-GCM encryption
  - Critical: Key loss would make all encrypted client data unreadable
  - Includes restore instructions for disaster recovery

#### Session Token Management
- **`AppCore__Main__.js`** - Added `getSessionToken()` method
  - Retrieves or generates session token for Cloudflare API calls
  - Token format: `btoa(projectCode:timestamp:random)` (matches editor tools)
  - Stores generated token in sessionStorage for reuse
  - Required for accessing encrypted client data from R2
  - Returns `null` if user not authenticated

#### Document Rendering Integration
- **`UserInterface__Main__.js`** - Updated quotation display
  - Changed from synchronous `render()` to asynchronous `renderAsync()`
  - Enables fetching client PII from Cloudflare R2 before rendering
  - Quotation now displays full client details (address, email, phone)

- **`DocumentSystem__QuotationRenderer__.js`** - Fixed client data fetching
  - **API Signature Fix**: Changed from `retrieveClientData(projectCode, year, sessionToken)` to `retrieveClientData(projectCode, sessionToken)`
    - Year parameter removed (auto-detected by Worker)
    - Matches updated CloudflareApiClient interface
  - **Always Fetches Client Data**: `renderAsync()` now always attempts to fetch from R2
    - Previously only fetched when `clientDataStorage === 'cloudflare-r2-encrypted'` flag present
    - Now fetches whenever session token is available
  - **Improved Token Handling**: Added fallback token generation
    - If `App.getSessionToken()` returns null but user is authenticated, generates fallback token
    - Ensures client data can be retrieved even if session token not yet stored
  - **Data Merging**: Cloudflare data merged with any existing inline client details
    - Preserves backward compatibility with legacy quotation files
    - Cloudflare data takes precedence over inline data

### Changed
- **Quotation Rendering Flow** - Now asynchronous with Cloudflare integration
  - **Before**: `render()` → inline `clientDetails` → basic display
  - **After**: `renderAsync()` → fetch from R2 → decrypt → merge → full display
  - Documents now show complete client information when available

- **Session Token Access** - Centralised token management
  - Token generation logic moved to `AppCore__Main__.js`
  - Consistent token format across editor tools and live app
  - Token stored in sessionStorage for reuse during session

### Fixed
- **404 Errors on Client Data Endpoint** - Fixed `/projectadmin/clientdata` not found
  - Worker had not been deployed with new `CloudflareHandler__ClientData__.js` handler
  - Deployed worker successfully with all handlers
  - Endpoint now returns proper validation errors instead of 404

- **Missing Client Details in Documents** - Fixed quotation showing only client name
  - Root cause: Synchronous renderer called instead of async version
  - Solution: Updated `showQuotation()` to use `renderAsync()`
  - Client address, email, and phone now displayed correctly

- **API Signature Mismatch** - Fixed incorrect parameter count
  - `QuotationRenderer` was calling `retrieveClientData()` with 3 parameters
  - Updated to match new signature: 2 parameters (year auto-detected)
  - Prevents "Missing required parameters" errors

### Technical Details

#### Client Data Flow
```
User views quotation
  → UserInterfaceMain.showQuotation()
    → loadQuotationData() [from GitHub Pages]
    → QuotationRenderer.renderAsync(quotationData)
      → fetchClientDataFromCloudflare()
        → App.getSessionToken() [generates if needed]
        → CloudflareApiClient.retrieveClientData(projectCode, sessionToken)
          → Cloudflare Worker `/projectadmin/clientdata`
            → Decrypts AES-256-GCM encrypted data from R2
            → Returns decrypted client PII
      → formatClientDataForDisplay() [structures address, email, phone]
      → render(quotationData, fullClientDetails)
        → Displays complete client information
```

#### Session Token Format
- **Structure**: Base64-encoded string containing `projectCode:timestamp:random`
- **Example**: `RFIwMjoxNzY5ODk4MzY1ODU4Onh3dTNpY2FmZGs=`
- **Decoded**: `DR02:1769898365858:xwu3icafdk`
- **Validation**: Worker validates project code match and 1-hour expiry

#### Error Handling
- Graceful fallback if Cloudflare unavailable: Uses inline client data
- Token generation fallback: Creates token if authenticated but none stored
- Silent failures: Logs warnings but doesn't break document rendering
- User experience: Document still displays even if client data fetch fails

### Files Modified
- `05__CloudflareWorkers/deploy.bat` - Updated documentation
- `05__CloudflareWorkers/CREDENTIALS_BACKUP.txt` - Added encryption key backup
- `03__Src__AppModules/01__AppCore/AppCore__Main__.js` - Added `getSessionToken()` method
- `03__Src__AppModules/10__UserInterface/UserInterface__Main__.js` - Changed to async renderer
- `03__Src__AppModules/20__DocumentSystem/DocumentSystem__QuotationRenderer__.js` - Fixed API calls and data fetching

### User Experience
- Quotation documents now display complete client information
- No user action required - data automatically fetched from secure storage
- Seamless integration - works transparently with existing quotation files
- GDPR compliant - client PII remains encrypted at rest in R2

---

## Version 0.4.2 - 31-Jan-2026

### Fixed - Authentication and Project Path Discovery

This release fixes critical authentication failures and simplifies project URL structure by implementing automatic project folder discovery and year detection across all Cloudflare Workers.

#### Authentication Fix
- **`Authentication__PinLogin__.js`** - Fixed missing `action` parameter
  - Added `action: 'validate'` to Cloudflare Worker auth requests
  - Resolves "Unknown action" errors that prevented PIN validation
  - Authentication now works correctly with hashed PINs

#### URL Simplification
- **`AppCore__Main__.js`** - Simplified project URL format
  - **Before:** `?project=DR02&year=26`
  - **After:** `?project=DR02` (year auto-detected)
  - Added `findProjectYearFromIndex()` function
  - Searches project index across all years to auto-detect project location
  - Falls back to default year if project not found in index

#### New Cloudflare Worker Helper
- **`CloudflareHelper__ProjectPath__.js`** (NEW) - Shared project path discovery utility
  - `findProjectFolder()` - Uses R2 listing to find folders matching `ProjectCode__ProjectName` pattern
  - `buildProjectFilePath()` - Constructs full R2 paths to project files
  - `buildProjectSubfolderPath()` - Builds paths to subfolders within project admin content
  - `getProjectYear()` - Returns detected year for a project
  - In-memory caching to avoid repeated R2 lookups
  - Handles folder naming convention: `DR02__SilverAvenue` (not just `DR02`)

#### Updated Cloudflare Handlers
- **`CloudflareHandler__Auth__.js`** - Uses path helper for project config loading
  - Replaced hardcoded path patterns with `buildProjectFilePath()` helper
  - Now correctly finds projects with `ProjectCode__ProjectName` folder structure
  - Auto-detects year from discovered folder

- **`CloudflareHandler__ClientData__.js`** - Year parameter now optional
  - `storeClientData()` - Year auto-detected, no longer required in request
  - `retrieveClientData()` - Year auto-detected from query parameters
  - `deleteClientData()` - Year auto-detected for GDPR erasure operations
  - All operations use `buildProjectFilePath()` helper

- **`CloudflareHandler__Signature__.js`** - Updated signature storage paths
  - Uses `buildProjectSubfolderPath()` for signature record storage
  - Project folder path now correctly resolves to `ProjectCode__ProjectName` format
  - Archive paths still use year-based structure (unchanged)

#### Updated Client-Side API
- **`CloudflareIntegration__ApiClient__.js`** - Removed year requirement
  - `storeClientData(projectCode, clientData, sessionToken)` - Year parameter removed
  - `retrieveClientData(projectCode, sessionToken)` - Year parameter removed
  - `deleteClientData(projectCode, sessionToken)` - Year parameter removed
  - `loadProjectConfig(projectCode)` - Year parameter removed
  - All methods now rely on Worker's auto-detection

#### Updated Navigation
- **`UserInterface__Navigation__.js`** - Simplified editor URLs
  - Removed `year` parameter from editor iframe URLs
  - Editor tools now receive only `project` parameter
  - Year auto-detected by main app before loading editors

### Changed
- **Project URL Format** - Simplified from `?project=XX00&year=YY` to `?project=XX00`
  - Year is automatically discovered from project index
  - Reduces URL complexity and potential for errors
  - Maintains backward compatibility (year still accepted but ignored)

- **Cloudflare Worker Path Resolution** - Now handles `ProjectCode__ProjectName` folders
  - Previously only looked for exact `ProjectCode` folders
  - Now searches R2 using listing API to find matching folders
  - Supports all folder naming conventions: `XX00__Name`, `XX00_-_Name`, `XX00`

### Fixed
- **Authentication Failure** - Fixed "Invalid PIN" errors caused by missing `action` parameter
  - Worker was returning "Unknown action" error for all auth attempts
  - Now correctly validates PINs against hashed values in project config

- **Project Not Found Errors** - Fixed 404 errors when loading project configs
  - Workers were looking for `DR02/` but folders are `DR02__SilverAvenue/`
  - Path helper now correctly discovers actual folder names via R2 listing

- **Year Parameter Dependency** - Removed requirement for year in all API calls
  - Year is now auto-detected from project folder location
  - Reduces complexity and potential for mismatched year/project combinations

### Technical Details

#### Project Path Discovery Flow
1. Client sends request with `projectCode` only
2. Worker calls `findProjectFolder(projectCode, env)`
3. Helper searches R2 with prefix: `NaProjectPortal/{year}-Projects/{projectCode}`
4. Uses R2 `list()` API with delimiter to find matching folders
5. Returns `{ year, folderName, basePath }` structure
6. Result cached for subsequent requests

#### Folder Naming Support
- **Primary:** `ProjectCode__ProjectName` (e.g., `DR02__SilverAvenue`)
- **Legacy:** `ProjectCode_-_ProjectName` (e.g., `GA06_-_Cloves-Wood`)
- **Fallback:** `ProjectCode` (exact match, e.g., `AA00`)

#### Caching Strategy
- In-memory cache per Worker instance
- Cache key: `{R2_PREFIX}:{ProjectCode}`
- Cache cleared on Worker restart (Cloudflare Workers are stateless)
- Reduces R2 API calls for frequently accessed projects

### Files Modified
- `03__Src__AppModules/30__Authentication/Authentication__PinLogin__.js`
- `03__Src__AppModules/01__AppCore/AppCore__Main__.js`
- `03__Src__AppModules/50__CloudflareIntegration/CloudflareIntegration__ApiClient__.js`
- `03__Src__AppModules/10__UserInterface/UserInterface__Navigation__.js`
- `05__CloudflareWorkers/src/handlers/CloudflareHandler__Auth__.js`
- `05__CloudflareWorkers/src/handlers/CloudflareHandler__ClientData__.js`
- `05__CloudflareWorkers/src/handlers/CloudflareHandler__Signature__.js`
- `05__CloudflareWorkers/src/helpers/CloudflareHelper__ProjectPath__.js` (NEW)

### Deployment
- Cloudflare Worker deployed successfully
- Version ID: `a969a118-63de-49ea-b171-22ad4af25d13`
- Worker URL: `https://na-projectadmin-api.adam-fb3.workers.dev`

### User Experience
- Simpler URLs: Users only need to provide project code
- More reliable: Automatic folder discovery prevents "project not found" errors
- Faster: Caching reduces lookup time for repeated requests
- Consistent: All handlers use same path resolution logic

---

## Version 0.4.1 - 31-Jan-2026

### Added - PDF Download Functionality

This release adds client-side PDF generation capability, allowing users to download 
the currently displayed document (quotation or terms) as a pageless PDF document 
with A4 width and automatic height calculation.

#### New PDF Generator Module
- **`DocumentSystem__GeneratePdf__.js`** - Client-side PDF generation module
  - Captures displayed document content from DOM
  - Generates pageless (endless scrolling) PDFs with A4 width (210mm)
  - Automatic height calculation based on content
  - High-quality JPEG rendering (2x scale, 95% quality)
  - Dynamic filename generation: `NA_Quotation_JH03_31-Jan-2026.pdf`
  - Loading overlay with spinner during generation
  - 30-second timeout protection to prevent UI freezing
  - Comprehensive error handling and user feedback

#### External Dependencies
- **`html2pdf.bundle.min.js`** (v0.10.1) - Added to `02__VersionLocked__ExternalDependencies/`
  - Client-side HTML to PDF conversion library
  - Uses html2canvas and jsPDF under the hood
  - No server-side processing required

#### Updated Navigation Module
- **`UserInterface__Navigation__.js`** - Added PDF download menu item
  - "Download PDF" button added above "Print Documents" option
  - Icon: Floppy disk/save icon (&#128190;)
  - Sidebar remains open during PDF generation (prevents layout shifts)
  - Integrated with PdfGenerator module

#### Updated Main HTML
- **`index.html`** - Added script references
  - html2pdf.js library loaded first (Section 0)
  - PDF generator module loaded with Document System modules (Section 5)

### Changed
- **Navigation Menu** - PDF download option now available for all document views
  - Works with Quotation, Terms & Conditions, and Signature Status views
  - Automatically detects current view type for filename generation

### Fixed
- **Date Formatter Integration** - Fixed incorrect method call
  - Changed `formatShort()` to `formatUK()` to match DateFormatter API
  - Ensures consistent date formatting in PDF filenames

- **Async Promise Handling** - Improved PDF generation flow
  - Added explicit promise handling with `.then()`/`.catch()`
  - Added DOM settle delay (100ms) before capture
  - Added timeout protection (30 seconds) to prevent infinite freezing
  - Proper error recovery and user feedback

- **Layout Stability** - Fixed sidebar collapse issue
  - Sidebar no longer collapses during PDF generation
  - Prevents layout shifts that could affect content capture

### Technical Details

#### PDF Configuration
- **Page Width**: 210mm (A4 standard)
- **Page Height**: Dynamic, calculated from content scrollHeight
- **Margins**: 10mm on all sides
- **Image Quality**: JPEG at 95% quality
- **Canvas Scale**: 2x for high-resolution rendering
- **Page Break Mode**: Avoid-all (pageless output)

#### Filename Format
- Pattern: `NA_{DocumentType}_{ProjectCode}_{Date}.pdf`
- Examples:
  - `NA_Quotation_JH03_31-Jan-2026.pdf`
  - `NA_Terms_JS01_31-Jan-2026.pdf`
  - `NA_SignatureStatus_AA00_31-Jan-2026.pdf`

### Files Modified
- `02__VersionLocked__ExternalDependencies/html2pdf.bundle.min.js` (NEW)
- `03__Src__AppModules/20__DocumentSystem/DocumentSystem__GeneratePdf__.js` (NEW)
- `03__Src__AppModules/10__UserInterface/UserInterface__Navigation__.js`
- `index.html`

### User Experience
- Users can now download professional PDF versions of quotations and terms
- PDFs maintain exact visual appearance of on-screen documents
- Pageless format ensures no awkward page breaks
- A4 width ensures compatibility with standard document viewers
- Automatic filename generation reduces user effort

---

## Version 0.4.0 - 31-Jan-2026

### Added - UK GDPR Compliant Client Data Storage

This release implements proper UK GDPR-compliant storage for client personal 
identifiable information (PII). Client data is now encrypted with AES-256-GCM 
and stored securely in Cloudflare R2 (private bucket), rather than in the 
public GitHub Pages repository.

#### New Cloudflare Worker Handler
- **`CloudflareHandler__ClientData__.js`** - New handler for encrypted PII storage
  - `POST /projectadmin/clientdata` - Store encrypted client data
  - `GET /projectadmin/clientdata` - Retrieve decrypted client data
  - `DELETE /projectadmin/clientdata` - Delete client data (GDPR right to erasure)
  - AES-256-GCM encryption using Web Crypto API
  - SHA-256 integrity verification
  - Full audit logging of all data access

#### New Client Data Fields
- Client name, email, phone number
- Client address (structured: house name/no, street, district, county, postcode)
- Project/site address (can be copied from client address)
- Secondary contact (name, email, phone) - for internal records only

#### Updated Cloudflare Integration
- **`CloudflareIntegration__ApiClient__.js`** - Added client data methods
  - `storeClientData()` - Store encrypted client PII
  - `retrieveClientData()` - Retrieve decrypted client PII
  - `deleteClientData()` - GDPR right to erasure

- **`AppConfiguration__MainAppSettings__.json`** - Added `clientDataEndpoint` config
- **`wrangler.toml`** - Added `CLIENT_DATA_KEY` secret documentation

#### Updated Editor Tools
- **`Editor__ProjectConfig__.html`**
  - Added GDPR compliance notice with lock icon
  - Added client email and phone fields
  - Added client address section (separate from site address)
  - Added secondary contact fields (internal use only)
  - Added "Same as client address" checkbox for site address
  - Dual save: non-PII to Flask/GitHub, PII to Cloudflare R2

- **`Editor__QuotationBuilder__.html`**
  - Client details now read-only (loaded from secure storage)
  - Added "Refresh Client Data" button
  - Client PII no longer stored in quotation JSON

- **`Editor__SharedUtils__.js`** - Added Cloudflare client data helpers
  - `saveClientDataToCloudflare()`
  - `loadClientDataFromCloudflare()`
  - `deleteClientDataFromCloudflare()`

#### Updated Document System
- **`DocumentSystem__QuotationRenderer__.js`**
  - Added `renderAsync()` method for async client data loading
  - `fetchClientDataFromCloudflare()` - Fetches PII from R2
  - Backward compatible with legacy inline client data

### Changed
- **Project Config JSON Schema** - PII no longer stored in local files
  ```json
  {
    "projectCode": "JS01",
    "projectName": "Rear Extension",
    "projectDescription": "Two-storey rear extension...",
    "specialNotes": "Client prefers morning visits",
    "projectPin": "1234",
    "documents": { "quotation": true, "specialTerms": true },
    "clientDataStorage": "cloudflare-r2-encrypted",
    "createdDate": "31-Jan-2026",
    "lastModified": "31-Jan-2026 at 20:30"
  }
  ```

- **Quotation JSON Schema** - Client details removed
  ```json
  {
    "quotationRef": "QUO-JS01-2026-001",
    "projectAddress": "42 Meadow Lane, Nottingham",
    "clientDataStorage": "cloudflare-r2-encrypted",
    "lineItems": [...],
    "totals": {...}
  }
  ```

### Security
- **Encryption**: AES-256-GCM with 96-bit IV
- **Key Storage**: Cloudflare Worker secrets (not in code/repository)
- **Access Control**: Session token validation required
- **Audit Trail**: All PII access logged to R2
- **Data Minimisation**: PII never stored in public repository

### Deployment Notes
Before deploying, you must set the encryption key:
```bash
cd 05__CloudflareWorkers
wrangler secret put CLIENT_DATA_KEY
# Paste a base64-encoded 32-byte (256-bit) key
```

Generate a key with:
```javascript
const key = crypto.getRandomValues(new Uint8Array(32));
console.log(btoa(String.fromCharCode(...key)));
```

**CRITICAL**: Backup this key securely. If lost, all encrypted client data 
becomes permanently unreadable.

### Files Modified
- `05__CloudflareWorkers/src/handlers/CloudflareHandler__ClientData__.js` (NEW)
- `05__CloudflareWorkers/src/CloudflareWorker__Main__.js`
- `05__CloudflareWorkers/wrangler.toml`
- `03__Src__AppModules/50__CloudflareIntegration/CloudflareIntegration__ApiClient__.js`
- `03__Src__AppModules/20__DocumentSystem/DocumentSystem__QuotationRenderer__.js`
- `03__Src__AppModules/02__AppData/AppConfiguration__MainAppSettings__.json`
- `04__EditorTools/Editor__ProjectConfig__.html`
- `04__EditorTools/Editor__QuotationBuilder__.html`
- `04__EditorTools/Editor__SharedUtils__.js`
- `start_local_server.py` - Updated project templates for GDPR compliance

### Cursor Rules Updated
- `01_Global__AppBroadStructure__.mdc` - Added client data privacy section
- `02_Global__AppModulesAndDependencies__.mdc` - Added Worker handlers and ApiClient methods
- `06_Global__WebHosting__DynamicProjectContent__.mdc` - Added client data storage details
- `08_Global__CloudflareWorkers__.mdc` - Added client data endpoint and handler docs
- `12_AppPrinciples__Authentication__.mdc` - Updated project config schema
- `14_AppPrinciples__DocumentSystem__.mdc` - Added client data fetching flow

---

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

