# Noble CAD Audit Tools — Development Log
# =========================================================

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
