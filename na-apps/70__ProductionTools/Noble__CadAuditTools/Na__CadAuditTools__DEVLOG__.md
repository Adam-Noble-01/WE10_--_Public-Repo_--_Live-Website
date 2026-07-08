# Noble CAD Audit Tools — Development Log
# =========================================================

# ---------------------------------------------------------

## CAD Audit Tools | v0.3.5 — 08-Jul-2026 — Native Export Flow, Load-File Project Manager, Stale-JS Fix

### Export DXF — native folder picker + write-once-then-copy + progress (user requests 1 & 2)

- The Export button no longer triggers a blind browser download. New flow:
  1. `POST /api/export-pick` opens the **native OS Save-As explorer** so the user
     chooses exactly where the DXF lands. The Tk dialog runs in an **isolated
     subprocess** (`Na__LocalServer__NativeDialogs__.py`) — tkinter is not
     thread-safe and Werkzeug serves each request on its own worker thread, so a
     dedicated process sidesteps every "main thread is not in main loop" pitfall.
  2. `POST /api/export-write` **writes the pruned DXF once** to the internal export
     cache (the app's own working copy) then `shutil.copy2`s that single file to
     the chosen destination — geometry is serialised once, then OS-copied.
- The shared `Na__UI__ProgressOverlay` now animates through the export with staged
  messages ("Waiting for save location…" → "Writing and copying…" → "Complete"),
  matching the upload/convert loading graphic. Added `exporting`/`copying`/`loading`
  stage titles.

### Load File — saved-project manager modal (user request 3)

- New **Load File** button + `#Na__App__ProjectManagerOverlay` modal, styled like
  the ValeSpec Project Manager (dark table: Project · Version · Saved · Source ·
  Removed · Open), with a live filter and Refresh. New `Na__UI__ProjectManager__.js`.
- `/api/projects` enriched with per-version metadata (saved date, source file,
  deleted count, dimension count) read from the JSON sidecar, newest-first.
- New `POST /api/open-project` copies the archived DXF into the temp cache as a
  **fresh working copy** (the saved version is never mutated by later edits),
  parses it, and returns saved dimensions so annotations are restored on load.

### Top bar cleanup (user request 4)

- Removed the `L→R Window / R→L Crossing` legend from the header — the guidance
  already lives in the status-bar hint where it belongs.

### Fixes surfaced during testing

- **UTF-8 stdout**: confirmed `na_force_utf8_console()` is wired in
  `Na__LocalServer__Main__.py` — the earlier `charmap` codec crash on `→`/`—` in
  server prints (which was killing `/api/export-*` and `/api/project-save`) came
  from a **stale server instance** started before that fix; a restart clears it.
- **Stale JS after edits**: the PWA service worker was cache-first
  (stale-while-revalidate), so code changes needed two reloads to appear. Rewrote
  `Na__ServiceWorker__CadAuditTools.js` to **network-first for app code**
  (HTML/JS/CSS/JSON), cache-first only for icons/fonts/manifest. Cache bumped to
  **v4**; precache list refreshed to the current module set. Edits now show on the
  first reload.

### Verification

- `.claude/launch.json` added (Flask server, port 8007); server restarted via the
  launch config.
- End-to-end tested: `project-save` (v001 written), `export-write` (22 KB file
  copied to destination), `open-project` (113/118 entities, 1 dimension restored,
  fresh working copy). Load-File modal renders 6 saved projects with correct
  metadata; opens on a single reload post-SW-fix; no console errors.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.6 — 07-Jul-2026 — Fixed Shift+Delete "Not Working" (Duplicate Stale Servers)

### Symptom

- Shift+Delete appeared to do nothing after the v0.0.5 hard-delete feature was
  shipped, despite the keybinding, HotkeyManager, and `EntityPruner` wiring all
  checking out correctly on code review.

### Root Cause — two server processes running at once

- Found **two** `Na__LocalServer__Main__.py` processes alive simultaneously:
  one auto-started `--silent` instance and one started manually from a
  terminal. Only one process can actually hold port 8007, so which process
  (and therefore which version of the route code) was really answering the
  browser's requests was ambiguous — the exact same class of "stale server"
  issue that previously broke `/api/upload` earlier in this project (fixed by
  a restart at the time).

### Fix

- Killed both `Na__LocalServer__Main__.py` processes (including the silent
  one) and confirmed port 8007 was fully released before starting a single
  fresh instance.
- Verified the fix live with the browser automation tool: loaded the app,
  opened the `CAD__Test__StandardBuilding__0.1.0__.dxf` fixture via
  `/api/open-local`, and confirmed a clean response with the correct entity
  count — then confirmed Shift+Delete now works end-to-end.

> **Reminder:** the dev server runs with `use_reloader=False`, and a silent
> auto-start instance can be running in the background. After pulling/making
> server-side changes, make sure **all** `Na__LocalServer__Main__.py`
> processes are stopped (check for a `--silent` one too) before starting a
> fresh one — otherwise a stale process can keep answering on port 8007.

# ---------------------------------------------------------

## CAD Audit Tools | v0.3.4 — 07-Jul-2026 — Open-With Opens the PWA App (Fix + Native Handlers)

### Problem — right-click "Open with" opened a browser tab and the PWA was un-installable

- The Windows Open-With launcher ran `shell.Run appUrl`, which handed the URL to
  the default browser as an ordinary tab — not the app.
- The PWA manifest lived at `03__AppModules/62__Feature__AppInstallability/`, so
  its `start_url`/`scope` (`"./…"`) resolved **relative to that nested folder** →
  a 404 start URL and a wrong scope. The PWA could not install/launch correctly.
- The referenced icon assets (`01__AppAssets__CadAuditTools/…192/512.png`) did
  not exist, breaking installability and leaving the right-click entry blank. The
  installer also assigned a `.png` to the shell-verb `Icon`, which Windows shell
  verbs cannot render (they need an `.ico`).

### Manifest — fixed + native file/protocol handlers

- `Na__AppInstallability__Manifest.webmanifest`: `start_url`/`id` → `/Na__App__.html`,
  `scope` → `/`, icon `src` → root-absolute `/01__AppAssets__CadAuditTools/…`.
- Added `file_handlers` (`.dxf` → `image/vnd.dxf`, `.dwg` → `image/vnd.dwg`) so an
  installed PWA is registered by Edge/Chrome in the Windows "Open with" list.
- Added a `web+noblecad` `protocol_handlers` deep-link entry.

### Icons — generated Noble-branded asset set

- New `01__AppAssets__CadAuditTools/` with `…Icon__192x192.png`, `…Icon__512x512.png`,
  and a multi-resolution `…Icon__.ico` (16–256 px) for the shell verb.
- Regeneratable via `01__AppAssets__CadAuditTools/Na__WinIntegration__GenerateIcons__.py`
  (Pillow) — swap in a real source logo and re-run.

### Launcher — chromeless app window (Path A, robust)

- `Na__WinIntegration__OpenWith__.vbs`: new `Na__LaunchAppWindow` opens Edge then
  Chrome with `--app="http://127.0.0.1:8007/Na__App__.html?openFile=<path>"`
  (browser resolved via `App Paths` registry + standard install locations),
  falling back to the default browser only if neither is found. Server
  health-check/auto-start is unchanged, so the file loads via `/api/open-local`.

### Installer — icon fix

- `Na__WinIntegration__InstallOpenWith__.ps1`: ProgID `DefaultIcon` and the shell
  verb `Icon` now use the `.ico`. Summary notes the labelled entry is the direct
  right-click verb (the greyed row in the *Open-with submenu* is a Windows quirk
  of script-host ProgIDs).

### Frontend — installed-PWA file handler (Path B, native)

- `Na__App__Main__.js`: new `Na__App__HandleLaunchQueue` consumes `window.launchQueue`;
  a launched file handle is read and routed through the existing
  `Na__UploadPanel__HandleFile(file)` pipeline (bytes → `/api/upload` → render).
- Note: Path B needs the PWA installed *and* the server already running (the
  launchQueue path does not auto-start the backend); Path A remains the dependable
  everyday route.

### Service worker

- Cache bumped `v2` → `v3`; PWA icons added to the pre-cached app shell.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.5 — 07-Jul-2026 — Undoable Hard Delete (Shift+Delete)

### Goal — shrink the working file to speed up very large drawings

- `Delete` / `Backspace` remain a **soft** delete: entities are faded and
  tracked in `deletedHandles` but stay in the working file until Save/Export.
- `Shift+Delete` / `Shift+Backspace` are a new **hard** delete: the selected
  units are physically removed from the WORKING DXF on disk. On files with
  tens of thousands of entities this keeps every subsequent load/parse/render/
  save cycle fast, because the working file itself gets smaller.
- Hard delete is fully **undoable** via a server-side backup of the working
  file taken immediately before each prune.

### Server — backup/restore + prune-in-place

- `Na__LocalServer__ProjectCache__.py`: added `na_create_working_backup()` /
  `na_restore_working_backup()` — copy the working DXF to
  `04__LocalProjectCache/05__WorkingFileBackups/` under a UUID token before a
  prune, and copy it back on undo. Oldest backups are trimmed beyond
  `WorkingBackups__MaxFiles` (default 40).
- `Na__LocalServer__ApiRoutes__.py`: new routes —
  - `POST /api/prune-working` `{ tempDxfPath, handles[] }` → backs up, then
    calls the existing `na_prune_and_save_dxf()` **in place** (saves back over
    `tempDxfPath` itself, not a separate export file). Returns `{ removed, backupId }`.
  - `POST /api/restore-working` `{ tempDxfPath, backupId }` → restores the
    backup over the working file. Returns 404 for an unknown/expired backup.
- Added `Config__ProjectCache.WorkingBackups__Path` / `WorkingBackups__MaxFiles`.
- Verified server-side with a scripted test: prune → restore round-trip, and a
  two-operation LIFO undo chain (restore B then restore A brings back exactly
  the right entities in the right order) — both passed.

### Frontend — incremental model/canvas edits + new EntityPruner module

- `Na__CadEngine__Canvas__.js`: extracted the render loop into a shared
  `_buildEntityFragment()`; added `Na__CadCanvas__AddEntities()` and
  `Na__CadCanvas__RemoveEntitiesByHandles()` so a hard delete/undo never
  triggers a full re-render — critical for staying fast on huge files.
- `Na__AppCore__UndoManager__.js`: added a generic
  `Na__UndoManager__PushCommand()` entry point so feature modules can register
  their own undo/redo commands without a dedicated `Record*` wrapper.
- `Na__UI__ProgressOverlay__.js`: `Show()` now accepts `{ allowCancel }` —
  hard delete shows the overlay without a Cancel button (it's quick and
  always undoable); errors still force the button visible so they stay
  dismissible.
- New `Na__CadEngine__EntityPruner__.js` — orchestrates the whole feature:
  resolves the selection to unit handles, awaits `/api/prune-working` BEFORE
  touching the local model (so a failed prune never desyncs the UI from disk),
  then removes from `AppState.entities`/`entityByHandle`, the SVG canvas, and
  decrements per-layer counts. Pushes a `hard-delete` command whose `undo()`
  restores the backup + re-adds the records, and whose `execute()` (redo)
  re-prunes and re-removes, taking a fresh backup each time.
- `Na__UI__LayersPanel__.js` now listens for a new `layers:refresh` event to
  keep per-layer entity counts accurate after a hard delete or its undo/redo.
- Keybindings SSOT: added `shift+delete` / `shift+backspace` → `edit:hard-delete`.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.4 — 07-Jul-2026 — Async Upload with Progress + Cancel

### Problem — large projects appeared to "time out"

- The old `/api/upload` route did the entire DWG→DXF conversion and DXF parse
  **synchronously inside the request**, so large drawings blocked with no
  feedback and looked like a browser timeout.

### Server — background job model

- New `Na__LocalServer__JobManager__.py`: thread-safe registry of upload jobs,
  each carrying a live `stage / message / percent`, a `result` payload, and a
  `threading.Event` for cancellation. Finished jobs are swept after 15 min.
- `/api/upload` now saves the upload, spawns a **daemon worker thread**, and
  returns `202 { jobId }` immediately (no blocking).
- New `/api/upload-status/<jobId>` (GET) returns live progress and, on
  completion, the entity JSON in `result`.
- New `/api/upload-cancel/<jobId>` (POST) signals cancellation.
- `na_load_cad_file_to_entity_json()` gained optional `progress_cb` +
  `cancel_event`, reporting stages: `converting → parsing → finalising`.
- `Na__LocalServer__DwgConversion__.py`: conversions now run through
  `_na_run_cancellable()` (Popen + poll) so a Cancel **terminates the running
  ezdwg/ODA subprocess** instead of waiting out the timeout.
- Flask dev server now runs `threaded=True` so status polls are served while a
  conversion job runs on its worker thread.
- Added `Config__Upload` to the app config (poll interval, cancel toggle).

### Frontend — progress overlay + cancel

- New `Na__UI__ProgressOverlay__.js` + overlay markup/CSS: spinner, stage title,
  live server message, determinate/indeterminate progress bar, elapsed clock,
  and a Cancel button.
- `Na__UI__UploadPanel__.js` rewritten: XHR upload with live upload %, then polls
  the job status and drives the overlay; Cancel aborts the upload or calls
  `/api/upload-cancel`. Falls back to a legacy `200`-with-payload response so it
  works even before the server is restarted.
- Windows Open-With (`?openFile=`) also shows the overlay with a client-side
  `AbortController` cancel.

> **NOTE:** the local server runs with `use_reloader=False` — **restart it** to
> pick up the new async routes (a stale server returns `200` instead of `202`).

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.3 — 07-Jul-2026 — Legacy DWG Fallback Hardening

### DWG Conversion — Auto-detect ODA File Converter install path

- `ezdwg` cannot read legacy DWGs below R14 (e.g. **R12 / AC1009**); these must use the ODA fallback.
- Added `na_resolve_oda_exe_path()` in `Na__LocalServer__DwgConversion__.py`:
  - Uses the configured `OdaConverter__ExePath` first if it exists on disk.
  - Otherwise globs standard `Program Files` install roots for version-numbered folders
    (`ODAFileConverter <ver>\ODAFileConverter.exe`), picking the highest version found.
  - Means installing ODA File Converter now works with **zero config edits**.
- Clearer failure message telling the user to install ODA for legacy DWG support.
- Updated `Config__DwgConversion._description` to document auto-detection.

### DWG Conversion — Fixed ODA "output folder must differ from input folder"

- ODA File Converter operates on folders and rejects the job when the output
  folder equals the input folder (previous code set them equal).
- Added `na_prepare_oda_workspace()` which isolates the source DWG in a fresh
  `__oda_work__/in` folder and converts into a separate `__oda_work__/out`
  folder, then relocates the resulting DXF beside the source and removes the
  scratch tree.
- Success is now judged by presence of the output DXF (ODA often returns a
  non-zero exit code even on success), with exit code/stderr surfaced on failure.
- Verified end-to-end on an R12 (AC1009) test file: ezdwg fails → ODA fallback
  converts → DXF parses cleanly (2077 entities).

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.2 — 07-Jul-2026 — Core Systems Implemented

### DWG Conversion — Replaced ODA stub with `ezdwg` Python library

**Library chosen: `ezdwg[dxf]>=0.9.0`**

- MIT licence, Rust core + Python API, ships as a pre-built wheel — `pip install "ezdwg[dxf]"`.
- Supports DWG R14 through R2018 (AC1014–AC1032).
- Uses `ezdxf` as DXF write backend; exposes `ezdwg.to_dxf(input, output)` API.
- Added to `requirements.txt` as version-locked dependency.
- `na_convert_dwg_to_dxf_oda()` kept as an optional ODA File Converter subprocess fallback.

### DXF Engine — Full `ezdxf` implementation (`Na__LocalServer__DxfEngine__.py`)

- `na_parse_dxf_to_entity_json()` fully implemented.
  - Iterates modelspace via `doc.modelspace()`.
  - Entity types serialised: `LINE`, `ARC`, `CIRCLE`, `LWPOLYLINE`, `POLYLINE`, `TEXT`, `MTEXT`, `INSERT`, `POINT`, `SPLINE`, `ELLIPSE`.
  - ACI colours resolved server-side via full 256-entry `_ACI_MAP` dict → `hexColor` field on every entity.
  - Layer table built from `doc.layers`; per-layer `aci`, `hexColor`, `entityCount`, `visible` fields returned.
  - `BYLAYER` (ACI 256) resolves to layer colour; `BYBLOCK` (ACI 0) defaults to white.
- `na_prune_and_save_dxf()` fully implemented.
  - Loads source DXF, collects matching handles in one pass, deletes entities, saves with `doc.saveas()`.

### SVG Canvas Rendering — Full implementation (`Na__CadEngine__Canvas__.js`)

- `Na__CadCanvas__RenderEntities(entities)` implemented — renders all entity types as SVG elements.
- Y-axis flip: all Y coordinates negated at render time (DXF Y-up → SVG Y-down).
- `vector-effect="non-scaling-stroke"` applied to all entities — consistent 1px line width at all zoom levels.
- Entity renderers: `Na__CadRender__Line`, `Na__CadRender__Arc`, `Na__CadRender__Circle`,
  `Na__CadRender__Polyline`, `Na__CadRender__Ellipse`, `Na__CadRender__Text`,
  `Na__CadRender__Insert`, `Na__CadRender__Point`.
- ARC rendered as polyline approximation (48-segment default) — avoids SVG arc direction complexity.
- ELLIPSE rendered as polyline approximation supporting partial ellipse via `startParam`/`endParam`.
- INSERT rendered as crosshair + block-name label in drawing units.
- Uses `DocumentFragment` for batched DOM insertion performance.

### Geometry Helpers — Improved (`Na__CommonUtils__GeometryHelpers__.js`)

- ARC bounding box now computes tight bounds using actual sweep angles with `Na__Geom__ArcBounds()`.
  Samples axis-aligned extremes (0°, 90°, 180°, 270°) that fall within the sweep.
- TEXT/MTEXT bounding box now uses insertion point + approximate extent (height × char count × 0.6).
- ELLIPSE bounding box added using `rx`/`ry` fields.
- INSERT/POINT use a 0.5-unit tolerance box (previously degenerate point).
- `SPLINE` added as alias for LWPOLYLINE/POLYLINE path in switch.

### PWA Icon Assets Generated

- `01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__512x512.png` — 512×512, RGBA PNG, 13.7KB.
- `01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__192x192.png` — 192×192, RGBA PNG, 6.2KB.
- Source: Noble Architecture logo fetched from `www.noble-architecture.com` CDN, resized with Pillow (LANCZOS).
- Placeholder `TODO__AddAppIcons__.txt` removed.
- PWA manifest icon paths already matched from v0.1.0 scaffold — no manifest update needed.

# ---------------------------------------------------------

# ---------------------------------------------------------
## CAD Audit Tools | v0.0.1 — 07-Jul-2026 — Initial Scaffold Release

### Initial Scaffold Release

**What was generated in this pass:**

- Root entry point: `Na__App__.html` with full editor shell (top bar, toolbar, canvas container, right panel)
- App bootstrap module: `Na__App__Main__.js` (ES module — constructs and wires all sub-modules)
- PWA service worker: `Na__ServiceWorker__CadAuditTools.js` (stale-while-revalidate caching)
- Flask local server entry: `Na__LocalServer__Main__.py` (delegates to `10__LocalServer__Modules/`)
- Batch launcher: `Na__LocalServer__Main__.bat` (auto-installs deps, starts server on port 8007)
- `requirements.txt` (`flask`, `flask-cors`, `ezdxf`)
- `.gitignore` (cache files, Python artifacts, node_modules excluded)
- App config SSOT: `02__AppData/Na__AppData__AppConfig__.json`
- All `03__AppModules/` frontend modules (fully wired: EventBus, AppState, HotkeyManager, UndoManager; stubbed: CAD-specific modules)
- PWA manifest + service worker registration
- Editor CSS theme: `03__AppStyles/Na__StyleSheet__EditorTheme__.css`
- Project cache directories: `04__LocalProjectCache/01__TempCache__DwgToDxfConversions/` and `04__LocalProjectCache/02__SavedProjects__AuditedDxfFiles/`
- All `10__LocalServer__Modules/` Python backend modules (AppSetup, Config, ApiRoutes, DwgConversion, DxfEngine, ProjectCache)
- Early-stage brief: `85__EarlyStage__StarterInfoAndBrief/Na__CadAuditTools__EarlyStagePlan__0.1.0__.md`

**Architecture decisions recorded:**

- Port `8007` assigned (next free after VectorForge 8006)
- Namespace prefix `Na__` used for all files, functions, CSS classes
- Entry HTML namespaced as `Na__App__.html` (ValeSpec style)
- DWG conversion strategy: ODA File Converter (CLI subprocess) → DXF in temp cache; `ezdxf` (MIT) for all DXF parsing/manipulation
- Box select follows CAD convention: left-to-right drag = Window (fully enclosed), right-to-left drag = Crossing (touching)
- SVG-based canvas (not Canvas2D) — mirrors VectorForge approach for hit-testable entity elements

**Known stubs (follow-up implementation required):**

- `Na__LocalServer__DwgConversion__.py` — ODA converter subprocess call not yet wired
- `Na__LocalServer__DxfEngine__.py` — `ezdxf` parsing to JSON not yet implemented
- `Na__CadEngine__Canvas__.js` — SVG entity rendering stubbed
- `Na__CadEngine__EntityLoader__.js` — JSON → SVG element creation stubbed
- `Na__SelectionTools__BoxSelectTool__.js` — rubber-band rect and hit-testing stubbed
- `Na__UI__LayersPanel__.js` — layer list population stubbed
- PWA icon assets — placeholder text file only; 192×192 and 512×512 PNG assets not yet generated

# ---------------------------------------------------------

