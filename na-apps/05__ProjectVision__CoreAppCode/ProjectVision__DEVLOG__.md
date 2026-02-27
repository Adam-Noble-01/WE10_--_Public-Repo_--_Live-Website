# Noble Architecture - Project Vision App
## Development Log

# =============================================================================


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
