# Noble CAD Audit Tools — Full Project Map

**Date:** 07-Jul-2026
**Author:** Adam Noble — Noble Architecture
**Status:** v0.3.0 Feature Build — Working Document
**Supersedes:** `Na__CadAuditTools__EarlyStagePlan__0.1.0__.md` (scaffold plan)

---

## 1. Mission Statement

A full-featured local CAD viewer/editor that goes beyond Autodesk TrueView:

- **Load** DWG (auto-converted) and DXF files.
- **Edit** — delete unwanted linework/objects (hatching, furniture, survey clutter) that TrueView cannot touch.
- **Measure** — a dimension system more intuitive and forgiving than TrueView (ortho + free-vector, snap-assisted).
- **Save** — versioned per-project DXF + JSON archives, plus direct DXF download.
- **Frictionless** — Windows right-click "Open With" → PWA opens the file instantly; server auto-starts silently at login.

---

## 2. Complete File Map

```
Noble__CadAuditTools/
│
├── Na__App__.html                                    ← App shell (ValeSpec-style grid layout)
├── Na__App__Main__.js                                ← ES-module bootstrap — constructs + wires all modules
├── Na__ServiceWorker__CadAuditTools.js               ← PWA stale-while-revalidate cache
├── Na__LocalServer__Main__.py                        ← Flask entry (port 8007)
├── Na__LocalServer__Main__.bat                       ← Visible launcher (dev use)
├── Na__LocalServer__Silent__.vbs                     ← Silent launcher → link in shell:startup      [NEW]
├── Na__WinIntegration__OpenWith__.vbs                ← Right-click Open-With target (file arg)      [NEW]
├── Na__WinIntegration__InstallOpenWith__.ps1         ← One-shot installer: registry + startup       [NEW]
├── requirements.txt
│
├── 01__AppAssets__CadAuditTools/                     ← PWA icons (192/512) + logo
│
├── 02__AppData/
│   ├── Na__AppData__AppConfig__.json                 ← Defaults SSOT (canvas, tools, cache, save)   [EXTENDED]
│   └── Na__AppData__KeybindingsAndControls__.json    ← Data-driven keys + mouse controls            [NEW]
│
├── 03__AppModules/
│   ├── 01__AppCore/
│   │   ├── Na__AppCore__EventBus__.js                ← Pub/sub backbone (complete)
│   │   ├── Na__AppCore__AppState__.js                ← Shared state store (complete)
│   │   ├── Na__AppCore__Keybindings__.js             ← Loads JSON bindings, merges defaults         [UPGRADED]
│   │   ├── Na__AppCore__HotkeyManager__.js           ← keydown → "hotkey:<action>" events (complete)
│   │   ├── Na__AppCore__SelectionManager__.js        ← Selection state + click select               [UPGRADED]
│   │   └── Na__AppCore__UndoManager__.js             ← 50-step undo/redo + hot-cache persist        [UPGRADED]
│   │
│   ├── 02__UI/
│   │   ├── Na__UI__Toolbar__.js                      ← Tool strip incl. lasso/dims/export           [UPGRADED]
│   │   ├── Na__UI__LayersPanel__.js                  ← Layer list + visibility eye toggles          [UPGRADED]
│   │   ├── Na__UI__PropertiesPanel__.js              ← Entity inspector + selection summary         [UPGRADED]
│   │   ├── Na__UI__StatusBar__.js                    ← Zoom / cursor / counts readouts              [UPGRADED]
│   │   └── Na__UI__UploadPanel__.js                  ← Drop/browse upload (complete)
│   │
│   ├── 03__CadEngine/
│   │   ├── Na__CadEngine__Canvas__.js                ← SVG render + pointer routing to tools        [UPGRADED]
│   │   ├── Na__CadEngine__EntityLoader__.js          ← Server JSON → state + canvas                 [UPGRADED]
│   │   └── Na__CadEngine__ExportSerializer__.js      ← Save/export payload builder                  [UPGRADED]
│   │
│   ├── 03__CommonUtils/
│   │   └── Na__CommonUtils__GeometryHelpers__.js     ← Rect/polygon/segment hit tests, snapping     [UPGRADED]
│   │
│   ├── System__Navigation/
│   │   └── Na__Navigation__ViewBoxController__.js    ← Pan / wheel-zoom / fit / zoom in-out         [UPGRADED]
│   │
│   ├── System__SelectionTools/
│   │   ├── Na__SelectionTools__BoxSelectTool__.js    ← Unified select: L→R Window / R→L Crossing    [UPGRADED]
│   │   └── Na__SelectionTools__LassoSelectTool__.js  ← Freehand lasso, same direction convention    [NEW]
│   │
│   ├── System__DimensionTools/                                                                      [NEW]
│   │   ├── Na__DimensionTools__SnapEngine__.js       ← Endpoint/midpoint/center snap index
│   │   ├── Na__DimensionTools__DimensionRenderer__.js← Ext lines, dim line, ticks, text (SVG layer)
│   │   ├── Na__DimensionTools__LinearDimensionTool__.js  ← Ortho H/V (auto axis from cursor)
│   │   └── Na__DimensionTools__AlignedDimensionTool__.js ← Free vector-to-vector
│   │
│   └── 62__Feature__AppInstallability/               ← PWA manifest + SW registration (complete)
│
├── 03__AppStyles/
│   └── Na__StyleSheet__EditorTheme__.css             ← ValeSpec dark aesthetic, Na__ naming         [REWRITTEN]
│
├── 04__LocalProjectCache/
│   ├── 01__TempCache__DwgToDxfConversions/           ← Uploaded files + converted DXFs (gitignored)
│   ├── 02__SavedProjects__AuditedDxfFiles/           ← One subfolder per project                    [RESTRUCTURED]
│   │   └── <ProjectName>/
│   │       ├── <ProjectName>__v001__.dxf             ← Pruned DXF, version auto-increments
│   │       └── <ProjectName>__v001__.json            ← Metadata: source, date, deletions, layers
│   └── 03__HotCache__UndoRedoStates/                 ← Undo/redo action snapshots (trimmed)         [NEW]
│
└── 10__LocalServer__Modules/
    ├── Na__LocalServer__Config__.py                  ← Server constants (port 8007)
    ├── Na__LocalServer__AppSetup__.py                ← Flask app + static routes
    ├── Na__LocalServer__ApiRoutes__.py               ← All API routes                               [EXTENDED]
    ├── Na__LocalServer__DwgConversion__.py           ← ezdwg primary + ODA fallback, hardened       [FIXED]
    ├── Na__LocalServer__DxfEngine__.py               ← ezdxf parse / prune / save (complete)
    └── Na__LocalServer__ProjectCache__.py            ← Cache paths + project versioning             [EXTENDED]
```

---

## 3. API Surface (Flask, port 8007)

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Server alive check (used by silent launcher) |
| `/api/upload` | POST | Upload DWG/DXF → convert if DWG → entity JSON |
| `/api/open-local` | GET | `?path=` absolute path — load file straight from disk (Open-With flow) |
| `/api/save` | POST | Legacy prune-and-save into saved projects root |
| `/api/project-save` | POST | Versioned project save → `<Project>/<Project>__vNNN__.dxf + .json` |
| `/api/projects` | GET | List saved projects + versions |
| `/api/export-dxf` | POST | Prune current DXF → return as browser download attachment |
| `/api/undo-cache` | POST | Persist an undo/redo state snapshot to hot cache |

---

## 4. Frontend Event Map (EventBus)

| Event | Emitter | Consumers |
|---|---|---|
| `file:loaded` / `file:cleared` | EntityLoader / UploadPanel | All panels, tools, managers |
| `tool:changed` | AppState.setTool | Toolbar, Canvas cursor |
| `pointer:down/move/up` (canvas) | Canvas → active tool object | BoxSelect, Lasso, Dimension tools |
| `selection:box-complete` | BoxSelect / Lasso | SelectionManager |
| `selection:changed` | SelectionManager | Toolbar, PropertiesPanel, StatusBar |
| `entity:deleted` | SelectionManager | UndoManager, StatusBar |
| `dimension:created` / `dimension:deleted` | Dimension tools | UndoManager, DimensionRenderer |
| `layer:visibility-changed` | LayersPanel | Canvas |
| `zoom:changed` / `cursor:moved` | ViewBoxController / Canvas | StatusBar |
| `hotkey:<action>` | HotkeyManager | Everything (data-driven from JSON) |
| `undo:applied` / `redo:applied` | UndoManager | StatusBar |

---

## 5. Tool Behaviour Specs

### 5.1 Unified Box Select (AutoCAD convention)
- One **Select** tool (default). Drag direction decides mode at drag time:
  - **L→R = Window** (blue, solid-ish dash): only entities **fully enclosed**.
  - **R→L = Crossing** (green, dashed): entities **touching or crossing**.
- Tiny drag (< 4 px) = **click select** (topmost hit entity); Shift adds/toggles.
- Hit testing is **true geometry**: segment-vs-rect intersection per entity segment, not bbox-only.

### 5.2 Lasso Select
- Freehand polygon drag (same tool group, hotkey `l` or press-and-hold behaviour per config).
- Direction convention mirrors box select: clockwise/L→R start = Window (fully inside polygon), R→L = Crossing (any intersection).

### 5.3 Dimensions (the TrueView-beater)
- **Linear ortho** (`d`): click point A, click point B, then move to place — axis auto-locks to H or V from cursor position (whichever offset is dominant); forgiving, no pre-choice needed.
- **Aligned** (`shift+d` or toolbar): free vector A→B, dimension line parallel to AB, offset by placement click.
- **Snap engine**: endpoint / midpoint / circle-arc centre markers within screen-px tolerance (config), rendered as ValeSpec-style snap glyphs. Snapping makes dims forgiving — near-miss clicks land exactly.
- Dimensions live on a dedicated SVG annotation layer, are selectable/deletable, and participate in undo/redo. Units = drawing units (mm assumed), decimal places from config.

### 5.4 Navigation
- Wheel zoom centred on cursor, middle-drag pan always available, Space+drag pan, `f` fit-to-drawing, `+`/`-` zoom steps, toolbar buttons for all. All factors/limits data-driven from config.

### 5.5 Undo / Redo
- Default 50 steps (`Config__UndoRedo.MaxDepth`), covers deletions and dimension add/remove.
- Every action snapshot also POSTed to `03__HotCache__UndoRedoStates/` (JSON, fire-and-forget, folder trimmed to `HotCache__MaxFiles`) so a session can be recovered after an accidental reload.

---

## 6. Data-Driven Configuration

- `Na__AppData__AppConfig__.json` — **defaults SSOT**: canvas colours, selection colours, dimension style, snap tolerances, undo depth, cache paths, save/versioning format, navigation factors.
- `Na__AppData__KeybindingsAndControls__.json` — **controls SSOT**: every hotkey and mouse control (wheel zoom, middle pan, modifiers). HotkeyManager + Canvas read this at startup; built-in defaults only used if fetch fails.

---

## 7. DWG → DXF Conversion Strategy (fix for current failure)

1. **Primary:** `ezdwg` 0.9.0 (installed) — API verified against the real library, run with a watchdog timeout so a bad DWG can't hang the upload route.
2. **Fallback:** ODA File Converter subprocess if installed (path from config).
3. **Failure:** clear JSON error naming which converters were tried and what to install.

---

## 8. Windows Integration

### 8.1 Right-click Open With
- `InstallOpenWith__.ps1` writes HKCU (no admin) registry keys: ProgID `NobleCadAuditTools.CadFile` + `OpenWithProgids` for `.dwg`/`.dxf`, plus a direct `SystemFileAssociations` shell verb ("Open with Noble CAD Audit Tools") with the Noble `.ico`.
- **Path A — VBS app window (robust default):** shell command → `wscript.exe Na__WinIntegration__OpenWith__.vbs "%1"`:
  1. Health-check `127.0.0.1:8007` — start `Na__LocalServer__Silent__.vbs` if down, wait for ready.
  2. `Na__LaunchAppWindow` opens Edge/Chrome with `--app="http://127.0.0.1:8007/Na__App__.html?openFile=<encoded path>"` (chromeless PWA-style window; default-browser fallback if neither browser is found).
  3. Frontend reads `?openFile=` → GET `/api/open-local?path=` → same load path as upload.
- **Path B — native installed-PWA handler:** the manifest now declares `file_handlers` (`.dxf`/`.dwg`) so Edge/Chrome register the *installed* PWA in Windows "Open with". Launched files arrive via `window.launchQueue`; `Na__App__HandleLaunchQueue` reads the handle and routes it through `Na__UploadPanel__HandleFile` → `/api/upload`. Requires the PWA installed and the server already running (this path does not auto-start the backend).
- **Manifest fix:** `start_url`/`scope`/icon paths are now root-absolute (`/Na__App__.html`, `/`, `/01__AppAssets__CadAuditTools/…`) — previously they resolved relative to the nested manifest folder and 404'd, which broke installability.

### 8.2 Silent startup
- `Na__LocalServer__Silent__.vbs` runs the Flask server with a hidden window (no console). Installer drops a shortcut into `shell:startup`. `AUTO_OPEN_BROWSER` suppressed in silent mode via `--silent` arg.

---

## 9. Build Order

1. Project map (this document) ✔
2. DWG conversion fix + hardened server routes
3. Config + keybindings JSON
4. ValeSpec restyle (CSS + HTML shell)
5. Selection suite (unified box, lasso, click)
6. Dimension suite (snap engine, ortho, aligned)
7. Undo/redo upgrade + hot cache
8. Project save + DXF export download
9. UI panels (layers, properties, status)
10. Windows integration (Open-With, silent startup)
11. End-to-end test with real DWG/DXF + DEVLOG v0.3.0
