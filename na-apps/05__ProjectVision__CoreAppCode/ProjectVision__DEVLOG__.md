# Noble Architecture - Project Vision App
## Development Log

# =============================================================================


# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.6 - 06-Mar-2026

### Validated - Build Pipeline Purge Flow

#### Purge Workflow Confirmation (`ProjectVision__BuildPipeline__.ps1`, `CloudflareR2__ModelSync__Main__.py`)

- Confirmed the build pipeline now enters purge mode correctly when `--purge <PROJECT_CODE>` is supplied
- Purge mode skips the normal build step and routes directly into the Cloudflare R2 GLB purge workflow
- The purge workflow resolves the target project, connects to Cloudflare R2, lists matching `.glb` files under the project prefix, and waits for explicit `yes` confirmation before deletion
- This provides a reliable review step before any destructive action is taken

#### Files Validated
- `ProjectVision__BuildPipeline__.ps1`
- `CloudflareR2__ModelSync__Main__.py`

# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.5 - 06-Mar-2026

### Added - GLB Purge, Date-Based Sync, Help Flags, Pipeline Improvements

#### GLB Purge Function (`CloudflareR2__ModelSync__Main__.py`)

- **New `--purge` / `--Purge` / `--purgeGlb` / `--PurgeGlb` CLI flag** accepts a project code (e.g. `RB05`) to delete all GLB files for that project from the Cloudflare R2 bucket
- Resolves project via `ProjectVision__MasterProjectIndex__Core__.json` or folder scan fallback
- Red warning banner shows project code, name, folder, and R2 prefix before confirmation
- Lists all `.glb` objects under `NaProjectPortal/{year}-Projects/{projectFolder}/30__TrueVision__AppContent/`
- Requires typing `yes` exactly to confirm; JSON config files are not affected
- `run_r2_purge()` handles credentials, client creation, project resolution, and `purge_project_glbs()`

#### Date-Based File Comparison (`CloudflareR2__ModelSync__Main__.py`)

- Switched from size-based to **date-based comparison** for sync decisions
- `check_r2_file()` now returns `(exists, size, last_modified)` from HEAD response
- `determine_action()` compares local `st_mtime` (UTC) vs R2 `LastModified`
- Local file newer than remote → `UPDATE`; otherwise → `SKIP`
- Display shows timestamps, e.g. `UPDATE (local 2026-03-06 10:15 vs remote 2026-03-05 14:30)`

#### Help and Instructions Flags (`CloudflareR2__ModelSync__Main__.py`)

- **`--help`** (argparse built-in) shows argument list and examples epilog
- **`--instructions` / `--Instructions`** prints a detailed colourised usage guide covering overview, commands, purge mode, file comparison, project code format, and credentials path; then exits

#### Confirmation Prompt Hint (`CloudflareR2__ModelSync__Main__.py`)

- When user types a flag (e.g. `--purge RB05`) at the yes/no prompt, shows a hint that flags must be passed when launching the script, with example commands

#### Build Pipeline Argument Passing (`ProjectVision__BuildScript__.bat`, `ProjectVision__BuildPipeline__.ps1`)

- **BAT**: Switched from `-File` to `-Command "& '...' %*"` so `%*` arguments reliably reach the PowerShell script
- **Pipeline**: Detects `--purge` among `$ExtraArgs`; when present, skips Step 1 (build) and runs only R2 sync with purge flag
- **Pipeline**: In normal mode, `$ExtraArgs` now forwarded to both build script and R2 sync script (e.g. `--dry-run-only`, `--project`)

#### Removed End Pause (`ProjectVision__BuildPipeline__.ps1`)

- Removed `Read-Host 'Press Enter to close this window'` at end of pipeline
- Window closes automatically when script finishes
- Error-path `Read-Host` pauses (Python not found, deps failed) retained so user can read errors before window closes

#### Files Modified
- `CloudflareR2__ModelSync__Main__.py` (purge, date-based sync, help/instructions, prompt hint)
- `ProjectVision__BuildPipeline__.ps1` (purge detection, arg forwarding, removed end pause)
- `ProjectVision__BuildScript__.bat` (`-Command` for reliable arg passing)

# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.4 - 27-Feb-2026

### Fixed - R2 Sync Pipeline Stability

#### ANSI Colour Codes in PowerShell Console (`CloudflareR2__ModelSync__Main__.py`)

- Added `_enable_windows_ansi()` function using `ctypes.windll.kernel32` to enable `ENABLE_VIRTUAL_TERMINAL_PROCESSING` on the Windows console handle before any output is printed
- This fixes the raw escape codes (`←[96m←[1m...←[0m`) that were appearing instead of colours when the script was launched via `start powershell ... -File`
- The fix is applied at the Python level (more reliable than the previous PowerShell P/Invoke approach since Python owns its own stdout handle)

#### Build Pipeline Robustness (`CloudflareR2__ModelSync__Main__.py`)

- Added top-level `try/except` with `traceback.print_exc()` around the `run_r2_sync()` call so any unhandled exceptions print a full Python traceback instead of silently closing the window
- Added `sys.stdout.flush()` after every upload print line and after error messages to prevent output buffering loss before a crash
- Upload error messages now include the exception type name (`type(error).__name__`) for faster diagnosis
- Removed the PowerShell P/Invoke ANSI block from `ProjectVision__BuildPipeline__.ps1` (now handled by the Python script itself)

#### Build Script Launcher (`ProjectVision__BuildScript__.bat`)

- Changed from running `powershell -File` inside the current `cmd.exe` window to using `start "Noble Architecture - Build Pipeline" powershell ...` which opens a dedicated PowerShell window
- The BAT file now closes immediately after launching, leaving only the PowerShell window open

#### Build Pipeline Stay-Open (`ProjectVision__BuildPipeline__.ps1`)

- Replaced `Write-Host 'You can close this window...'` at the end with `Read-Host 'Press Enter to close this window'`
- The PowerShell window now stays open showing the full pipeline output and success/error messages until the user explicitly dismisses it

#### Files Modified
- `CloudflareR2__ModelSync__Main__.py` (ANSI init, flush calls, traceback wrapper)
- `ProjectVision__BuildPipeline__.ps1` (removed P/Invoke block, added Read-Host pause)
- `ProjectVision__BuildScript__.bat` (use `start` to open PowerShell window)

# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.3 - 27-Feb-2026

### Added - TrueVision R2 Model Upload Pipeline and Project Loader Update

This version introduces a complete Cloudflare R2 upload pipeline for TrueVision GLB models, rewrites the TrueVision project loader to fetch model data from the new project portal CDN structure, and adds a runtime model group selector for switching between design phases.

#### Cloudflare R2 Model Sync Script (`CloudflareR2__ModelSync__Main__.py`)

- **New Python module** for syncing GLB model files to Cloudflare R2 via `boto3` (S3-compatible API)
- Scans `na-project-portal/{year}-Projects/*/30__TrueVision__AppContent/` for model group subfolders
- Each subfolder (e.g. `DesignPhase01__ConceptDesign__ExistingBuilding`) is treated as a model group containing `.glb` files
- R2 bucket key mirrors the local folder structure under the `NaProjectPortal/` prefix
- Incremental sync: uses `HEAD` requests to check file existence and size, only uploads new or changed files
- Also uploads `TrueVision__ProjectData__.json` alongside GLB files
- Dry-run preview with colourful ANSI console output, then yes/no confirmation before committing
- CLI flags: `--dry-run-only`, `--project <FOLDER_NAME>`
- Credentials loaded from `API__Cloudflare/Token__CloudflareR2.env` via `python-dotenv`

#### R2 Credentials Template (`API__Cloudflare/Token__CloudflareR2.env`)

- Template file with `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`
- Added `**/API__Cloudflare/` to root `.gitignore` to prevent credential leaks

#### Build Script Updates (`ProjectVision__BuildScript__.py`)

- New `discover_truevision_model_groups()` function scans TrueVision content folders for GLB files
- New `generate_truevision_project_data()` builds `TrueVision__ProjectData__.json` with:
  - `projectCode`, `projectName`, `activeGroupIndex`
  - `modelGroups` array: one entry per subfolder with `groupId`, `label`, `modelUrls` (CDN URLs)
  - `Camera__DefaultPosition` placeholder (preserved from existing file if present)
- `write_truevision_project_data()` preserves user-customised labels and camera config from existing files
- Auto-generates human-readable labels from folder names (e.g. `DesignPhase01__ConceptDesign__ExistingBuilding` → "Concept Design - Existing Building")

#### Build BAT File Updates (`ProjectVision__BuildScript__.bat`)

- Now opens PowerShell as the console for full ANSI colour support
- Two-step pipeline: Step 1 runs `ProjectVision__BuildScript__.py`, Step 2 runs `CloudflareR2__ModelSync__Main__.py`
- Checks for `boto3` and `python-dotenv` dependencies, auto-installs if missing
- Colourful status output with `Write-Host -ForegroundColor`

#### TrueVision Project Loader Rewrite (`Na__AppUtils__ProjectLoader.js`)

- **Version 2.0.0** - Rewritten to fetch `TrueVision__ProjectData__.json` from Cloudflare R2 CDN
- New `Na__AppUtils__GetProjectFolderFromUrl()` reads `?project-folder=` parameter (passed by Project Vision)
- New `Na__AppUtils__GetYearFromUrl()` reads `?year=` parameter (defaults to `26`)
- New `Na__AppUtils__FetchTrueVisionProjectData()` constructs CDN URL from project folder and year:
  - Production: `https://cdn.noble-architecture.com/NaProjectPortal/{year}-Projects/{folder}/30__TrueVision__AppContent/TrueVision__ProjectData__.json`
  - Localhost: serves from local Flask server path
- New `Na__AppUtils__HasModelGroups()`, `Na__AppUtils__ExtractModelGroup()`, `Na__AppUtils__GetActiveGroupIndex()`
- Legacy `Na__AppUtils__FetchProjectJson()` and `Na__AppUtils__ExtractModelUrls()` retained for backward compatibility

#### Loading Sequence Updates (`Na__AppFlow__LoadingSequence.js`)

- Updated to support the new `modelGroups` format from `TrueVision__ProjectData__.json`
- Three-tier project data resolution:
  1. New CDN path (when both `?project=` and `?project-folder=` are present)
  2. Legacy fallback to old `project.json` format if CDN fetch fails
  3. Legacy-only path when only `?project=` is provided
- Stores all model groups in `Na__ProjectData__AllModelGroups` for the group selector UI
- Initialises `Na__UiFeature__InitializeModelGroupSelector` when multiple groups exist

#### Model Group Selector UI (`Na__UiFeature__ModelGroupSelector.js`)

- **New module** for switching between model groups (design phases) at runtime
- Creates selector buttons in the Tools dropdown panel (one per model group)
- When a group is selected: disposes current models, loads new group's GLB URLs via `Na__ModelLoader__LoadAllModels()`
- Re-initialises the model toggle controls after each group switch
- Only visible when a project has 2+ model groups
- Loading state disables buttons during model switch

#### HTML and CSS Updates

- Added `naModelGroupSelectorItem` menu item to `Index.html` Tools dropdown (hidden by default, shown by JS when groups > 1)
- Added `.na-model-group-selector__*` CSS classes to `Na__UiFeature__Styles__DropdownAndToast__.css`
- Selector buttons match the existing model toggle button styling with green active indicator

#### R2 Bucket Path Convention

```
Local:  na-project-portal/26-Projects/NP03__AshnessClose/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding/NP03__01__OrbitHelperCube__MeshModel__.glb
R2 Key: NaProjectPortal/26-Projects/NP03__AshnessClose/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding/NP03__01__OrbitHelperCube__MeshModel__.glb
CDN:    https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/NP03__AshnessClose/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding/NP03__01__OrbitHelperCube__MeshModel__.glb
```

#### TrueVision__ProjectData__.json Schema

```json
{
    "projectCode": "NP03",
    "projectName": "Ashness Close",
    "activeGroupIndex": 0,
    "modelGroups": [
        {
            "groupId": "DesignPhase01__ConceptDesign__ExistingBuilding",
            "label": "Concept Design - Existing Building",
            "modelUrls": [
                "https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/NP03__AshnessClose/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding/NP03__01__OrbitHelperCube__MeshModel__.glb"
            ]
        }
    ],
    "Camera__DefaultPosition": {
        "Camera__DefaultPosition__PosX": 0,
        "Camera__DefaultPosition__PosY": 5000,
        "Camera__DefaultPosition__PosZ": 15000,
        "Camera__DefaultFov": 50
    }
}
```

#### Files Created
- `CloudflareR2__ModelSync__Main__.py`
- `API__Cloudflare/Token__CloudflareR2.env` (template)
- `../30__TrueVision__CoreAppCode/02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js`

#### Files Modified
- `ProjectVision__BuildScript__.py` (added TrueVision data generation)
- `ProjectVision__BuildScript__.bat` (PowerShell pipeline with R2 sync step)
- `../../.gitignore` (added `**/API__Cloudflare/` pattern)
- `../30__TrueVision__CoreAppCode/02__Src__AppModules/03__AppUtils/Na__AppUtils__ProjectLoader.js` (v2.0.0 rewrite)
- `../30__TrueVision__CoreAppCode/02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` (modelGroups support)
- `../30__TrueVision__CoreAppCode/Index.html` (model group selector menu item)
- `../30__TrueVision__CoreAppCode/03__Style__AppStylesheets/Na__UiFeature__Styles__DropdownAndToast__.css` (group selector styles)

# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.2 - 27-Feb-2026

### Added - Local Development Server

- **Flask development server** (`ProjectVision__LocalServer__Main__.py`)
  - Serves all static files from the repository root via a catch-all `/<path>` route
  - Both `na-apps/` and `na-project-portal/` paths served from a single process
  - Repo root resolved one level above the script (`na-apps/` → repo root)
  - CORS enabled for all routes (`flask-cors`, `origins: *`) so the landing page can fetch JSON from `na-project-portal`
  - Root `GET /` redirects to the Project Vision landing page with default project parameter
  - `GET /api/health` returns service name, port, and resolved repo root path
  - Default port: `8090` (avoids collision with Project Admin on `8080`)
  - CLI args: `--port`, `--debug`, `--project`, `--year`, `--no-browser`
  - Browser auto-open via `webbrowser.open()` in a daemon thread with a 1.5 s delay
  - Platform-specific window-focus via PowerShell (Windows) or `osascript` (macOS)
  - Startup banner listing test URLs, sub-application deep links, and health endpoint

- **Windows batch launcher** (`ProjectVision__LocalServer__Main__.bat`)
  - Checks `python -c "import flask"` before launching; auto-installs `flask flask-cors` if missing
  - Prints a brief usage hint for common CLI flags
  - Passes `%*` through to the Python script so all CLI args work from the BAT file
  - Ends with `pause` to keep the console window open after the server stops

### Technical Details
- **REPO_ROOT resolution**: `os.path.abspath(os.path.join(SCRIPT_DIR, '..'))` (script lives in `na-apps/`, one level from repo root, unlike Project Admin which lives two levels deep)
- **Static serving pattern**: Mirrors `start_local_server.py` in Project Admin — directory requests attempt `index.html`, file requests use `send_from_directory`, everything else `abort(404)`
- **No API endpoints**: Project Vision is a static landing page; the full Project Admin editor API (`/api/project/create`, etc.) is intentionally omitted

#### Files Created
- `../ProjectVision__LocalServer__Main__.py` (343 lines)
- `../ProjectVision__LocalServer__Main__.bat` (52 lines)

# -----------------------------------------------------------------------------

## Project Vision - Version 0.0.1 - 27-Feb-2026

### Added - Initial Application Build

This version represents the complete initial build of the Project Vision landing page
application — a multi-sub-app hub that gives clients a single entry point for each project.

#### URL Query System (`02__Src__AppModules/Na__AppUtils__UrlQuerySystem.js`)

- **Namespace**: `window.NaProjectVision.UrlQuerySystem`
- Reads `?project=XX00` and optional `?year=NN`, `?project-folder=XX00__Name` parameters
- Detects local vs. production environment (`localhost`, `127.0.0.1`, or `file:` protocol)
- Resolves master index URL relative to the current environment:
  - Local: path relative to the served file tree
  - Production: absolute URL at `https://www.noble-architecture.com/na-apps/`
- `getProjectContext()` — returns full context object including `projectCode`, `projectName`, `projectYear`, `projectFolder`, `isLocalDev`, `subAppAvailability`
- `fetchMasterIndex(url)` — async fetch with JSON parsing and error propagation
- `resolveProjectFromIndex(masterIndex, projectCode)` — looks up project entry by code
- `buildSubAppUrl(appsBase, subAppKey, projectCode, projectFolder)` — constructs deep-link URLs for each sub-app using the same `?project=XX00` query pattern as Project Admin and PlanVision
- Pattern follows `AppCore__UrlQuerySystem__.js` from PlanVision

#### Master Project Index Schema (`05__AppData/ProjectVision__MasterProjectIndex__Core__.json`)

- Defined canonical schema populated by the Python build script:
  ```json
  {
      "buildTimestamp": "ISO-8601 string",
      "projects": {
          "XX00": {
              "projectCode": "XX00",
              "projectName": "Human Readable Name",
              "projectFolder": "XX00__FolderName",
              "projectYear": "26",
              "subApps": {
                  "projectAdmin": true,
                  "planVision": false,
                  "trueVision": false
              }
          }
      }
  }
  ```
- `subApps.projectAdmin`: `true` if `10__ProjectAdmin__AppContent/ProjectAdmin__ProjectConfig__.json` exists
- `subApps.planVision`: `true` if `20__PlanVision__AppContent/` contains real content (not just placeholder `.txt` files)
- `subApps.trueVision`: `true` if `30__TrueVision__AppContent/` contains real content (not just placeholder `.txt` files)

#### Landing Page (`index.html`)

- Noble Architecture header with company logo from CDN and "Project Vision" title
- Dynamically populated project name from master index
- Three responsive sub-application button cards:
  - **Project Admin** — "Documents & Contracts" — links to Project Admin with `?project=XX00`
  - **PlanVision** — "2D Drawings & Plans" — links to PlanVision with `?project=XX00&project-folder=XX00__Name`
  - **TrueVision 3D** — "3D Model Viewer" — links to TrueVision with `?project=XX00`
- **Disabled state**: Cards greyed out with "Coming Soon" label when `subApps.xxx` is `false`
- **Loading overlay**: Shown while fetching the master index JSON
- **Error state**: Shown if `?project=` is missing or project is not found in the index
- Inline initialization script using `async/await` pattern to fetch, resolve, and render

#### Stylesheet (`04__Style__AppStylesheets/StyleSheet__ProjectVisionApp__.css`)

- CSS custom properties following Noble Architecture brand conventions:
  - `--Pv_BrandPrimary: #555041` (warm dark olive)
  - `--Pv_BrandAccent: #7a7460`
  - `--Pv_BgPrimary: #f8f7f5`
  - `--Pv_CardColor__Admin: #555041`
  - `--Pv_CardColor__PlanVision: #3b6e8f`
  - `--Pv_CardColor__TrueVision: #172b3a`
- Open Sans loaded from CDN
- CSS Grid with `auto-fit / minmax(260px, 1fr)` for responsive card layout
- Landscape: three cards in a row; Portrait: stacked single-column via `@media (orientation: portrait)`
- Card hover: `translateY(-4px)` lift with box-shadow transition
- Disabled card state: reduced opacity, `pointer-events: none`, "Coming Soon" badge overlay
- Loading spinner using CSS `@keyframes` rotation
- Error state panel with red-tinted border and descriptive messaging
- Region comments (`#region` / `endregion`) matching Noble Architecture CSS conventions

#### Python Build Script (`ProjectVision__BuildScript__.py`)

- **Input**: Scans `na-project-portal/{year}-Projects/` directories (years 20–26)
- **Project discovery**: Regex `[A-Z]{2}[0-9]{2}(?:__|_-_)` matches both `__` and `_-_` separator styles
- **Per-project scanning**:
  - Reads `ProjectAdmin__ProjectConfig__.json` for human-readable project name
  - Checks `20__PlanVision__AppContent/` for real content vs. placeholder `.txt` files
  - Checks `30__TrueVision__AppContent/` for real content vs. placeholder `.txt` files
- **Outputs**:
  - Writes `ProjectVision__MasterProjectIndex__Core__.json` (overwrites on each run)
  - Generates `ProjectVision-WebApp.html` redirect file in each project's root folder
  - Updates `AppConfiguration__ProjectKeysIndex__.json` in the Project Admin app (replaces the previous Project Admin build script's responsibility)
- **Validation**: Project codes validated against `[A-Z]{2}[0-9]{2}` format with console warnings for invalid entries
- **Idempotent**: Safe to re-run; all outputs are overwritten
- **CLI summary**: Prints a formatted table of all discovered projects with sub-app availability flags
- Year range limited to `range(20, 27)` to avoid generating empty entries for years that don't exist yet

#### Per-Project Redirect Files (`na-project-portal/.../{project}/ProjectVision-WebApp.html`)

- Generated by the build script for every discovered project
- `<meta http-equiv="refresh">` with JavaScript fallback redirect
- Target URL: `https://www.noble-architecture.com/na-apps/05__ProjectVision__CoreAppCode/index.html?project=XX00&project-folder=XX00__Name`
- Styled fallback message with Noble Architecture brand colours if redirect does not fire
- Allows a clean short URL (`/na-project-portal/26-Projects/NP03__AshnessClose/ProjectVision-WebApp.html`) rather than exposing the full core-app path

#### Root Redirect (`na-apps/ProjectVision-WebApp.html`)

- Lives in `na-apps/` root for a convenient short URL
- JavaScript reads `window.location.search` and forwards any `?project=` parameter to `05__ProjectVision__CoreAppCode/index.html`
- Styled fallback `<a>` tag in case scripted redirect is blocked

### Technical Decisions
- **Runtime data loading**: The landing page fetches `MasterProjectIndex__Core__.json` at runtime rather than baking data into the HTML, keeping the build artefact cacheable and the page content always fresh after a build-script run
- **Shared URL query pattern**: `?project=XX00&project-folder=XX00__Name` follows the same pattern as PlanVision and Project Admin to avoid introducing a new URL scheme
- **Build script replaces Project Admin build**: The Project Admin app previously maintained its own `AppConfiguration__ProjectKeysIndex__.json` through a separate script; `ProjectVision__BuildScript__.py` now owns this responsibility for all apps

### Fixed
- **Empty year entries in `AppConfiguration__ProjectKeysIndex__.json`**: First run generated empty entries for years 27–29 (not yet in use). Fixed by changing iteration from `range(20, 30)` to `range(20, 27)`

#### Files Created
- `index.html` (277 lines)
- `02__Src__AppModules/Na__AppUtils__UrlQuerySystem.js`
- `04__Style__AppStylesheets/StyleSheet__ProjectVisionApp__.css` (513 lines)
- `05__AppData/ProjectVision__MasterProjectIndex__Core__.json`
- `ProjectVision__BuildScript__.py` (455 lines)
- `ProjectVision__BuildScript__.bat`
- `../ProjectVision-WebApp.html` (root redirect, 83 lines)
- Generated per-project `ProjectVision-WebApp.html` redirect files across `na-project-portal/26-Projects/`

#### Files Modified
- `../10__NaProjectAdmin__DocumentSystem__CoreAppCode/03__Src__AppModules/02__AppData/AppConfiguration__ProjectKeysIndex__.json` (updated by build script)

# -----------------------------------------------------------------------------

## Project Vision - Version x.x.x - DD-MMM-YYYY

### Added
- ADD HERE

### Changed
- Change No1 Here
- Change No2 Here

#### Files Modified
- List `FileModified__ProjectVision__.example`

# -----------------------------------------------------------------------------
