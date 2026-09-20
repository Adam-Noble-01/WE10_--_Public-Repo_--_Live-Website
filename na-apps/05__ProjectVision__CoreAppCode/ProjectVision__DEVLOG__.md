# Noble Architecture - Project Vision App
## Development Log

# =============================================================================


# -----------------------------------------------------------------------------

## Project Vision - Version 0.4.1 - 20-Sep-2026

### Added - The build writes the index that every drawing's QR code resolves through

#### Why
- Every TrueVision drawing now carries a QR code (TrueVision v2.81.0). It reads
  `https://www.noble-architecture.com/q/?PS01` - 42 bytes, exactly what a 29 module
  symbol holds - and `q/index.html` at the website root sends the phone on to the
  project's full TrueVision address. The full address is 135 bytes, a 49 module symbol,
  which a phone cannot read at title block size.
- The page has to find the project's folder and year from its code, and the build script
  is the one thing that already knows all three for every project.

#### Build script (`ProjectVision__BuildScript__.py`)
- `build_qr_link_index` writes `q/index.json` beside the master index on every build:
  `projects`, keyed by code, each with `projectFolder` and `projectYear`. The shape is the
  master index's on purpose - the resolver falls back to that file and reads both alike.
- EVERY valid project is listed, with or without TrueVision content, and always all of
  them even on a `--project` run. A printed code sits in a site bag for years; it must not
  stop working because a content check changed its mind, or because a build was aimed at
  another job.
- `--qr-index-only` rewrites that one file and nothing else. `--dry-run-check` reports it.

#### Project Manager (`ProjectVision__ProjectManager__Api__.py`)
- `_update_master_index` now carries the change on to `q/index.json` (`_update_qr_index`):
  a folder rename, a code change or a delete reaches both in the same breath. A STALE
  entry is worse than a missing one - the resolver only falls back to the master index
  when a code is not listed at all - so a project renamed here and left stale there would
  have sent every drawing already printed for it to a folder that no longer exists.
- It never fails the edit that caused it, never invents an index that is not there, and
  keeps only the folder and the year. Proved against copies of both indexes; the real
  ones were not touched. THE 8090 SERVER NEEDS A RESTART to pick it up.

#### Never
- Never move, rename or remove the `q` folder, and never edit `q/index.json` by hand.
  `Na__Test__ProjectQr__.test.mjs` in TrueVision fails when it falls behind the portal.
- It has to be PUBLISHED with the site before a drawing carrying the code is issued.


# -----------------------------------------------------------------------------

## Project Vision - Version 0.4.0 - 19-Sep-2026

### Added - Project Manager: multi-project admin with local and R2 in lockstep

#### Why
- Dummy projects from the original build-out (TS01, JS01, AA00) needed removing, and
  there was nowhere in the system to do it. The R2 sync script could only purge GLBs,
  from the command line, one project at a time.
- The ask was a table of every project that can edit and delete them, keeping the local
  folder, the master index and the Cloudflare R2 bucket in step.

#### Project Manager Tab (`02__ProjectVision__StudioShell__AppCode/`)
- `NaStudioShell__ProjectManager__.html` is served at `/project-manager` and opens from a
  new button in the Studio bar beside Projects. The bar now shows whichever page is open
  as a pressed button, so the button and the breadcrumb no longer read as duplicates.
- Sortable on every column - code, name, address, folder, year, created, local footprint
  and R2 footprint. Click to sort, click again to reverse.
- **A row is read-only until Edit is pressed.** Only then does any cell become an input,
  so no amount of clicking around the table can begin changing project data.
- R2 sizes load on demand behind a button: it is one listing of the whole bucket prefix,
  bucketed by project, rather than a request per row.

#### Destructive Operations (`ProjectVision__ProjectManager__Api__.py`)
- A Flask blueprint the local server registers. Localhost only.
- **Delete local never unlinks.** It moves the folder to
  `na-project-portal/00__Deleted__Quarantine/<stamp>__<folder>/`, which is outside the
  `NN-Projects` pattern the launcher scans, so the project leaves the gallery while the
  files stay on disk. The page lists what is in quarantine.
- **Delete R2 does delete**, because an object store has no quarantine. It is always
  preceded by a listing of exactly what will go.
- Two confirmations on every write and every delete. The first states real counts fetched
  from the server - local files, R2 objects, the exact prefix, the first dozen keys. The
  second keeps its button disabled until the project code has been typed.
- The server refuses independently: every mutating call needs a `confirm` field equal to
  the project code, so the modal is not the only guard. Verified: a call with no `confirm`
  and a call with another project's code are both refused with 400.
- Paths are checked for containment in the portal before any move, so no request can aim
  the operation outside `na-project-portal`.

#### Rename
- Changing the code, folder or year renames the folder on disk, rewrites `projectCode` in
  the Project Admin config, copies every object under the old R2 prefix to the new one and
  deletes the originals, then rewrites the master index - one operation.
- Refused on a malformed code and on a collision with an existing project.

#### Source of Truth and File Hygiene
- `ProjectAdmin__ProjectConfig__.json` is authoritative for name and code. The PlanVision
  and TrueVision project data files are generated from it by the build script, so they are
  never written here - a rebuild would overwrite anything put in them.
- Address and description are written to every quotation entry, in whichever quotation
  file name that project uses.
- `_detect_newline()` preserves each file's existing line endings. The build script pins
  LF and the Project Admin app writes CRLF; the first implementation wrote CRLF via
  Python's default text mode, which rewrote all 170 lines of the master index in git on
  every edit. Caught by byte-comparing the index against a pre-test backup.

#### Fixed - Address Missing on Newer Projects (`ProjectVision__DevLauncher__Shared__.py`)
- `_summarise_project_admin()` read only `ProjectAdmin__Quotation__.json`. Projects on the
  newer `ProjectAdmin__Quotations__.json` format (PS01, PS02, SB04, EB03, NP03) therefore
  had no address at all. It now reads either file and walks the `quotations` list.
- The gallery cards gained addresses from the same fix.

#### Fixed - Action Buttons Not Lining Up With Their Row (reported as "super dangerous")
- Three separate faults, all found by measuring the rendered geometry rather than by eye:
  - **The sticky header never stuck.** `.pm-tablewrap` had `overflow-x: auto`, which makes
    that element the containing block for sticky descendants, so a header told to stick
    against the page could not. It measured at `bottom: 1px` - fully scrolled off. The
    wrapper now scrolls in both axes and the header sticks to it.
  - **`th` had `z-index: auto`**, so scrolling rows painted over the header. A row's delete
    buttons measured at y = -49 to 16, on top of it. Now `z-index: 3` on a solid ground.
  - **The four action buttons wrapped to two lines**, making rows 86px tall and putting the
    second line hard against the row boundary, where it read as the next row's. Now
    `flex-wrap: nowrap`.
- The tall rows had a further cause: the three Apps badges were stacking onto three
  separate lines in a 54px column (measured at y = 274, 292, 311). With that column set to
  `nowrap`, every row is a uniform 45px, down from 77-86.
- Hovering any destructive button now tints its whole row and marks its left edge, so the
  project about to be acted on is unmistakable before the click rather than after it.
- Destructive buttons are pale until hovered. Fifteen rows each carrying three red buttons
  is a wall of red that stops carrying meaning; red is kept for the button under the cursor.
- Address column widened to 400px and set to never break; name and folder likewise on one
  line, folder truncated with the full value in its tooltip since it repeats the code and
  the name.
- "Delete" is said once as a group label followed by Local / R2 / Both, rather than three
  buttons each repeating the word. That and the folder trim bought ~140px, which is what
  let the 1680px centred cap return - the previous 1720px cap did not clear the table's
  natural minimum once the Actions column existed, which is why it clipped.
- Measured at 1999px: table 1635px inside a 1680px shell, 160px margins each side, no
  clipping, last button fully visible, rows uniform at 45px.

#### Added - Sub-Application Toggles in Edit Mode
- The A / P / T badges become buttons while a row is in edit mode. Green is shown on the
  project hub, amber is on with no content on disk, a blue ring marks an unsaved change.
- They write the master index `subApps` flags, which are what gate the three cards on the
  project hub page. The build script recomputes those from disk, so a toggle holds until
  the next build - the save dialog says so, and the API reports it in its result.
- `_update_master_index()` merges `subApps` key by key, so writing one flag cannot drop
  the other two.

#### Verification
- Run on port 8095 against the real repository and the live R2 bucket, using a throwaway
  ZZ99 project created for the purpose. No real project was edited or deleted.
- Confirmed: preview reports true counts; a delete with no confirmation and with the wrong
  code are both refused; a field edit writes name and address; a rename moves the folder,
  updates the config, attempts the R2 migration and rewrites the index; a malformed code
  and a collision are refused; delete local quarantines the folder, drops the index entry
  and removes the row; the quarantine panel lists it.
- The master index was byte-identical to its pre-test backup afterwards, and every test
  artefact was removed.

#### Fixed - A Saved Toggle That Looked Like It Had Done Nothing
- The Apps column rendered `subApps[key].available`, which is **on-disk content**, while the
  edit-mode toggle rendered and wrote `subApps[key].indexed`, the **master index flag**. Two
  different facts behind the same three letters.
- Turning PlanVision off for PS02 therefore wrote `planVision: false` to the index and
  correctly disabled the card on the project hub, while the table went on showing a green
  P - because the PlanVision content is still on disk either way. It read as a failed save.
- The column now shows the index flag, which is what actually governs the hub and what the
  toggle writes. Where the flag and the disk disagree the badge turns amber and says which
  way round it is, so a deliberate override is distinguishable from a stale index.
- Confirmed on the live 8090 server: the index holds `planVision: false`, the API reports
  `indexed=False onDisk=True`, the badge is amber, and the PS02 hub renders the PlanVision
  card disabled with no href while Admin and TrueVision stay enabled.

#### Fixed - The Gallery Ignored The Same Flag (`ProjectVision__LocalServer__DevLanding__.html`)
- The project gallery had the identical fault: `buildButton()` enabled a sub-app shortcut on
  `subApp.available` (content on disk) while the project hub gates its cards on the index
  flag. A sub-app switched off in the Project Manager still offered a live, clickable
  shortcut straight into a page the hub had been told to hide.
- Buttons and card shading now both gate on `indexed && url`. A button switched off says so
  in its tooltip - "switched off for this project in the Project Manager. The content is
  still on disk; rerun the build script to switch it back on" - rather than the misleading
  "no content for this project".
- The `Index stale` chip is now `Index override`, because a mismatch is as likely to be a
  deliberate switch-off as a stale index; the tooltip names both possibilities.
- Verified against the live index: PS02 and PS01 show PlanVision off, SB04 shows both
  PlanVision and TrueVision off, EB03 shows all three on, and every off button carries no
  href.

#### Note - Sub-App Flags Do Not Touch R2
- The master project index is a repository file. The R2 sync script only ever **reads** it,
  to resolve a project code; it is never uploaded. A sub-app toggle writes that one file
  and nothing else - no R2 call is made, and none is needed.
- The project hub reads the index from the local server on localhost, so a toggle takes
  effect there on the next load. The public site reads the GitHub Pages copy, so the change
  reaches it when the repository is committed and pushed.

#### Fixed - Two "Close" Buttons On The Result Modal
- `showResult()` reuses `showStage()`, which always rendered a cancel button beside the
  confirm button, and both were labelled "Close". A stage can now declare `singleButton`,
  which a result uses: an acknowledgement has nothing to cancel.

#### Operational - A Toggle That Silently Did Nothing
- An app toggle saved against a server started four minutes before the `subApps` handling
  was written reported only "INDEX updated". The flags were posted and ignored: the route
  existed, so nothing 404'd, and the write simply had no effect.
- This is the quieter cousin of the stale-route 404 above, and the reason the API now
  reports a `subApps` step in its result - the absence of that line is the tell that the
  running server predates the feature.

#### State At The End Of The Session
- The tool was used in earnest the same afternoon. Three projects sit in
  `na-project-portal/00__Deleted__Quarantine/`, quarantined from the live 8090 server:
  - `2026-09-19_133345__JS01__JohnSmith`   - 9 files, 31 KB  - dummy, intended
  - `2026-09-19_133358__TS01__TestProject` - 9 files, 25 KB  - dummy, intended
  - `2026-09-19_133417__GA06_-_Cloves-Wood` - 16 files, 63 MB - **a real 2025 job**, with
    PD Site Plans, Elevations and Scheme-02 RevB drawings as PDF and PNG
- GA06 was quarantined while the mis-aligned button layout was still loaded, minutes after
  that layout was reported as dangerous. It is intact and restorable by moving the folder
  back into `25-Projects/`, and git also holds it. Left in place pending a decision.
- Nothing was deleted from R2 at any point in this session.

# -----------------------------------------------------------------------------

## Project Vision - Version 0.3.1 - 19-Sep-2026

### Changed - Studio shell folded into the numbered series, and two launcher faults fixed

#### Numbered Series (`na-apps/02__ProjectVision__StudioShell__AppCode/`)
- The shell shipped in `ProjectVision__LocalServer__DevShell__/`, the only unnumbered
  directory under `na-apps/`. It is now `02__ProjectVision__StudioShell__AppCode`, sitting
  above `05__ProjectVision__CoreAppCode`: 00 archive, 01 shared assets, 02 the shell that
  hosts everything, then 05/10/20/30 the apps it hosts.
- Internally it follows the same series as the core app - `02__Src__AppModules`,
  `03__Style__AppStylesheets`, `05__AppData`.
- Names were aligned to the app's actual name at the same time, since "DevShell" was only
  ever a working label: `NaDevShell__` became `NaStudioShell__`, the asset prefix
  `/__na-devshell/` became `/__na-studio/`, the escape hatch `?devshell=off` became
  `?studio=off`, and the server constants `DEV_SHELL_*` became `STUDIO_SHELL_*`.
- The served URLs keep the numbered paths, so the stylesheet is at
  `/__na-studio/03__Style__AppStylesheets/NaStudioShell__AppShell__Stylesheet__.css`.

#### Fixed - The Double-Injection Guard Never Matched
- `inject_studio_shell_bridge()` guarded against injecting twice by searching the served
  HTML for the marker `na-devshell-bridge`, which was not a substring of the tag it
  injects. A page that somehow received two passes would have been given two script tags.
- The marker is now the bridge filename, which does appear in the injected tag.

#### Fixed - The Silent Startup Server Never Started (HTTP 501 on localhost:8090)
- `Start__ProjectVision__WindowsStartUp__Silent__8090__.bat` asked
  `Get-NetTCPConnection -LocalPort 8090 -State Listen` and exited when anything answered.
- On this machine `WsToastNotification.exe` holds `0.0.0.0:8090` permanently, so that test
  is **always** true: the launcher concluded the server was already up, started nothing,
  and the browser got 501 from WsToastNotification. The absent log file was the proof.
- Both launchers now ask whether **our** server is answering - `GET /api/health` must
  return `na-projectvision-local-dev` - rather than whether the port is held. Flask binds
  `127.0.0.1:8090` alongside WsToastNotification and the more specific bind wins for
  `localhost`, so the two coexist as they always have.
- The duplicate logic is gone: the startup `.bat` now calls
  `ProjectVision__StudioApp__Launch__.ps1 -ServerOnly`, so the Start Menu launcher and the
  startup server share one definition of "already running" and cannot drift apart.

#### Operational - Routes Are Fixed When The Process Starts
- A Project Manager route added at 13:11 returned 404 on a server that had been running
  since 12:42, while the shell bar still drew its button, because the shell HTML is read
  from disk on every request but Flask fixes its routes at start. That combination makes a
  stale process look like a broken link.
- The tell: `curl -i -X OPTIONS <url>` answering `Allow: OPTIONS, GET, HEAD` means only the
  static catch-all matched, so the route does not exist in the running process.
- This matters more now that the startup server runs under `pythonw.exe` with no console
  and can be days old. Restart it after any change to the server-side Python.

#### Documentation
- `README__StudioShell__.md` corrected: it still described the old port-in-use logic, and
  claimed "every shell response" was `no-store` when that covers only the shell's own
  responses. Added a "When it will not start" section covering the 501, where the log
  lives, and the stale-route symptom.

# -----------------------------------------------------------------------------

## Project Vision - Version 0.3.0 - 19-Sep-2026

### Added - Noble Architecture Studio: one local window over the whole ecosystem

#### Why
- Working locally meant juggling folders, URLs and browser tabs to reach a project's
  Admin, PlanVision and TrueVision content. The ask was a single PWA on the Start Menu
  that opens a project gallery and then travels into any project and back out again.
- None of this touches the live website. The public apps were not modified; the shell
  exists only in front of the local Flask server, which the public site never runs.

#### Studio Shell (`02__ProjectVision__StudioShell__AppCode/`)
- `NaStudioShell__AppShell__.html` is served at `/` and holds a 42px application bar above
  a full-bleed frame. The frame owns everything below the bar, so a sub-app's `100vh`
  resolves against the frame rather than the screen - TrueVision lays out untouched.
- Bar carries Back, Forward, Reload, a Projects home button, the breadcrumb
  (`PS01 / Musters Road / TrueVision 3D`), sub-app pills for the active project, and a
  pop-out to an ordinary browser tab.
- Back and Forward drive the real session history. A navigation inside a same-origin
  frame pushes an entry onto the top-level history, so `history.back()` steps the frame
  back through the pages actually visited. No custom stack is kept.
- `Ctrl+K` opens a project switcher that jumps to the **same** sub-app in another
  project, falling back to that project's hub when it has no content there.
- The address hash mirrors the framed page via `replaceState`, so the window can be
  reloaded, bookmarked and deep-linked without adding phantom history entries.
- `NaStudioShell__Pwa__Manifest__.webmanifest` scopes the PWA to `/`, so every local app is
  inside the installed window. **No service worker is registered** - deliberately. Local
  app code is edited constantly and a caching worker is the known cause of stale modules.

#### Hosted Page Bridge (injected, not authored into the apps)
- `ProjectVision__LocalServer__Main__.py` appends one `<script>` tag to every HTML
  response it serves (`inject_studio_shell_bridge`). The apps themselves are unchanged,
  and any future sub-app is covered without further work.
- Inside the frame the bridge only forwards the four shell chords (`Alt+Left`,
  `Alt+Right`, `Alt+Home`, `Ctrl+K`) to the bar. Every other key is left to the app's own
  hotkey manager.
- Opened directly in a browser tab, it draws a small "Open in Studio" pill that
  deep-links that exact page back into the shell.
- `?studio=off` serves any page exactly as the live site does.

#### Card Order and Filtering (`ProjectVision__DevLauncher__Shared__.py`, dev landing)
- Cards were ordered alphabetically by project code within a year, which is arbitrary
  from the desk. They are now ordered by the project's own date, newest first.
- `_parse_na_date()` reads the several shapes the apps write - `07-Sep-2026`,
  `07-Sep-2026 at 21:58` and ISO-8601 with a trailing `Z` - into a sortable value.
  `createdDate` leads (when the job was opened), `lastModified` is the fallback.
- Projects with no Project Admin content carry no date at all. They always sit at the
  back of a date sort rather than jumping to the front of "Oldest first" on a zero.
- New `Sort` control on the gallery: Newest first (default), Oldest first, Name A-Z,
  Code A-Z, persisted in local storage beside the existing filter chips.
- Each card now shows its date, in the house `17-Sep-2026` format. The month names are
  spelled out in the code because `toLocaleDateString('en-GB')` renders September as
  "Sept".
- The Project Admin dev server (port 8081) imports the same module and serves the same
  landing page, so it gained the ordering and the dates with no change of its own.

#### Launchers (`na-apps/`)
- `Launch__ProjectVision__StudioApp__.bat` + `ProjectVision__StudioApp__Launch__.ps1` -
  **the Start Menu entry point.** Opens the Studio in a chromeless Edge application
  window, starting the server first only when nothing is listening on 8090. Takes an
  optional project code to open straight into one project.
- `Start__ProjectVision__WindowsStartUp__Silent__8090__.bat` - background server for the
  Windows Startup folder, matching the ValePlanner and ValeSpec pattern. Runs under
  `pythonw.exe`, opens nothing, exits quietly when the port is already held, and logs to
  `ProjectVision__LocalServer__Startup__.log`.
- `ProjectVision__LocalServer__Main__.bat` (the existing desktop shortcut target) still
  runs the server in the foreground for development, and now opens the Studio window
  rather than a browser tab.
- Server gained `--silent`, `--log-file` and `--no-app-window`. `--silent` implies no
  window at all, because a startup server is a background service.

#### Verification
- Ran on port 8095 against the real repository, with Adam's own 8090 server left running.
- Confirmed: bridge injected exactly once into all four sub-apps and never into the shell
  itself; the frame viewport measures 908px against a 950px window, so `100vh` inside
  TrueVision is correct; Back and Forward traverse the frame and repaint the breadcrumb;
  the switcher filters and jumps; the "Open in Studio" pill round-trips a directly opened
  page back into the shell; all four sorts order correctly with undated projects last.
- The silent server started under `pythonw.exe` with no console and wrote its log, and the
  launcher opened an Edge window titled "Noble Architecture Studio" against the already
  running server without starting a second one.

# -----------------------------------------------------------------------------

## Project Vision - Version 0.2.0 - 14-Sep-2026

### Added - TrueVision Site Plan Store (`SitePlan__DrawingData`)

#### Why
- TrueVision3D is gaining Site Plan drawings, fed by the GLB Builder's Site Plan Export. That export writes
  one linework GLB per site plan tag (71-75), a fill GLB for fill tags, and a manifest, into
  `30__TrueVision__AppContent/SitePlan__DrawingData/`. Plan: `na-apps/30__TrueVision__CoreAppCode/TrueVision__PLAN__SitePlanDrawings__.md`.
- Without this change the build would have registered that folder as a design phase. It sorts after every
  `DesignPhase...` folder and has no "existing" in its label, so TrueVision would have opened the project on it.

#### Build Script (`ProjectVision__BuildScript__.py`)
- `discover_truevision_model_groups()` skips `SitePlan__DrawingData`.
- New `discover_truevision_siteplan_store()` describes the folder for TrueVision:
  - with a manifest, it takes each layer's tag, label, group, draw order, style, scales, counts and bounds;
  - without one, it takes the layers from the file names (`TrueVision__SitePlan__{Stem}__LineworkModel__` / `__FillModel__`);
  - either way it gives absolute CDN URLs.
  - A manifest entry whose GLB is missing is skipped with a warning.
- `generate_truevision_project_data()` writes that description as `SitePlan__DataStore`. The key is build-owned:
  regenerated on every run, dropped when the folder goes, never a dev-owned key.
- Project data is written when a project has design phases OR a site plan store.

#### R2 Model Sync (`CloudflareR2__ModelSync__Main__.py`)
- The site plan GLBs already uploaded like any other GLB folder.
- `discover_model_groups()` now also lists the site plan manifest as an extra file, and `collect_sync_operations()`
  uploads it beside the GLBs as `application/json`.
- `--purge` removes the site plan GLBs with the rest; the manifest, being JSON, stays.

#### Unchanged
- `ProjectVision__BuildScript__.bat` and `ProjectVision__BuildPipeline__.ps1`. Menu option 3 (a specific project,
  TrueVision only) runs the build and then `--project <folder> --tv-only`, which picks up the site plan store.

#### Verification
- A harness on the real scripts, run against a throwaway project in a scratch folder, passed 24 checks:
  - the folder is never a design phase;
  - the store is built both with a manifest and without one;
  - fill URLs are present only where a fill GLB exists;
  - the writer keeps dev-owned keys and drops a store that has gone;
  - the sync lists the manifest beside the GLBs.

# -----------------------------------------------------------------------------

## Project Vision - Version 0.1.0 - 08-Mar-2026

### Added - PlanVision CDN Integration, Build Pipeline Overhaul, Interactive CLI

#### PlanVision R2 Sync (`CloudflareR2__ModelSync__Main__.py`)
- Extended the Cloudflare R2 sync utility to upload PlanVision content (PNG, PDF, JSON) alongside TrueVision GLB files
- New `discover_planvision_content()` function recursively walks `20__PlanVision__AppContent/` and collects all syncable files
- New `collect_planvision_sync_operations()` builds R2 keys mirroring the local folder structure
- New `resolve_content_type()` maps file extensions to MIME types (image/png, application/pdf, application/json)
- New `build_r2_key_planvision()` constructs R2 keys for PlanVision content files
- Added `sync_truevision` and `sync_planvision` parameters to `run_r2_sync()` for selective sync
- Added CLI flags: `--tv-only` / `--truevision-only`, `--pv-only` / `--planvision-only`, `--all`
- R2 key pattern: `NaProjectPortal/{year}-Projects/{folder}/20__PlanVision__AppContent/{relativePath}`

#### PlanVision Project Data Generation (`ProjectVision__BuildScript__.py`)
- Build script now auto-generates `PlanVision__ProjectData__.json` for projects with PlanVision content
- New `discover_planvision_phases()` scans for `DesignPhaseNN__*` folders and their drawing content
- New `discover_planvision_folder()` recursively discovers PNG/PDF files up to 3 levels of nesting
- New `generate_planvision_project_data()` builds the standard PlanVision JSON schema
- New `merge_planvision_existing_data()` preserves manual overrides (project details, label overrides) across rebuilds
- `label-override` flag per folder entry: when `true`, the build script preserves the existing label; when `false` (default), it auto-generates from the folder name
- `parse_folder_label()` strips `DesignPhaseNN__` prefixes and `__Content` suffixes for clean labels
- Active design phase validation: preserved from existing JSON only if it exists in the new available phases

#### Interactive Build Pipeline (`ProjectVision__BuildPipeline__.ps1`)
- Complete rewrite with interactive numbered menu when launched with no arguments (double-click)
- Menu options: Sync All, Sync Specific Project (TV+PV / TV only / PV only), Purge GLBs, Help
- Project code prompt with validation (`[A-Z]{2}[0-9]{2}` format)
- Resolves project name from master index for confirmation before proceeding
- Two-stage confirmation: first confirms project identity, then the R2 sync handles upload confirmation
- All original CLI flags still work when passed as arguments (`--All`, `--Project--{CODE}`, `--Project--{CODE}--TV`, `--Project--{CODE}--PV`, `--Help`)
- Shorthand aliases: `--project {CODE} --tv`, `--project {CODE} --pv`, `--TrueVision`, `--PlanVision`
- Displays mode summary (project + filter) before running

### Changed - Sub-App URL Year Parameter

#### URL Query System (`Na__AppUtils__UrlQuerySystem.js`)
- `buildSubAppUrl()` now accepts and passes `projectYear` as a `year` query parameter
- All sub-app URLs (Admin, PlanVision, TrueVision) now include the year so the target app resolves the correct year folder

#### ProjectVision Landing Page (`index.html`)
- Updated all three `buildSubAppUrl` calls to pass `projectData.projectYear`
- Sub-app URLs now include `&year=26` (or whichever year the project belongs to)

#### Files Created
- None (all changes extend existing files)

#### Files Modified
- `CloudflareR2__ModelSync__Main__.py` (PlanVision discovery, sync, CLI flags)
- `ProjectVision__BuildScript__.py` (PlanVision JSON generation, label parsing, merge logic)
- `ProjectVision__BuildPipeline__.ps1` (interactive menu, flag parsing rewrite)
- `02__Src__AppModules/Na__AppUtils__UrlQuerySystem.js` (year parameter in sub-app URLs)
- `index.html` (pass projectYear to buildSubAppUrl)

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
