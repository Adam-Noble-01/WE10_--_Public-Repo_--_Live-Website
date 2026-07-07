# Noble CAD Audit Tools — Early Stage Plan v0.1.0

**Date:** 07-Jul-2026  
**Author:** Adam Noble — Noble Architecture  
**Status:** Scaffold Complete — Implementation Pending

---

## 1. Project Goals

The primary goal is a simple, fast, **local-host-only** tool for CAD file cleanup.

**Core Use Case:**  
> Open a DWG or DXF file → see all vector entities on-screen → draw a box selection to grab a set of entities → delete them → save the pruned DXF.

This replaces the slow, manual process of opening AutoCAD or similar to batch-delete groups of unwanted elements (hatching, furniture, survey data, redundant annotation, etc.) before importing CAD geometry into other workflows.

**Secondary Goals:**
- PWA installable to the Windows taskbar for quick access (no browser chrome).
- Layer visibility filtering (show/hide layers to isolate geometry).
- Basic entity properties inspector (layer, type, handle, colour).
- Undo/Redo history for deletions.

---

## 2. Architecture Summary

```
Browser (ES Modules)           Flask Local Server (Python)
─────────────────────────────  ─────────────────────────────────────────
Na__App__.html                 Na__LocalServer__Main__.py  (port 8007)
  └─ Na__App__Main__.js          └─ 10__LocalServer__Modules/
       ├─ AppCore/                     ├─ Na__LocalServer__Config__
       │   ├─ EventBus               ├─ Na__LocalServer__AppSetup__
       │   ├─ AppState               ├─ Na__LocalServer__ApiRoutes__
       │   ├─ HotkeyManager         │   ├─ POST /api/upload
       │   ├─ SelectionManager      │   └─ POST /api/save
       │   └─ UndoManager           ├─ Na__LocalServer__DwgConversion__
       ├─ CadEngine/                │   └─ ODA File Converter (stub)
       │   ├─ Canvas (SVG)          └─ Na__LocalServer__DxfEngine__
       │   ├─ EntityLoader              └─ ezdxf (stub)
       │   └─ ExportSerializer
       ├─ UI/
       │   ├─ Toolbar
       │   ├─ LayersPanel
       │   ├─ PropertiesPanel
       │   ├─ StatusBar
       │   └─ UploadPanel
       ├─ System__SelectionTools/
       │   └─ BoxSelectTool
       └─ System__Navigation/
           └─ ViewBoxController
```

**Data Flow (upload → display → audit → save):**
1. User drops a DWG or DXF file onto the upload overlay.
2. `UploadPanel` POSTs the file to `/api/upload`.
3. If DWG → ODA File Converter converts to DXF in `04__LocalProjectCache/01__TempCache__DwgToDxfConversions/`.
4. `Na__LocalServer__DxfEngine__` parses the DXF with `ezdxf` → returns entity JSON.
5. `EntityLoader` builds AppState.entities and AppState.layers; calls `CadCanvas.Na__CadCanvas__RenderEntities()`.
6. User selects entities with Box Select (Window or Crossing) → `SelectionManager` highlights them.
7. User presses Delete → `SelectionManager` marks entities as deleted (faded); records handles in `AppState.deletedHandles`.
8. User clicks "Save Audited DXF" → `ExportSerializer` builds payload → POSTs to `/api/save` → `DxfEngine` prunes DXF with `ezdxf` → saved to `04__LocalProjectCache/02__SavedProjects__AuditedDxfFiles/`.

---

## 3. DWG → DXF Conversion Research & Decision

### Problem
DWG is Autodesk's proprietary binary format. There is no pure open-source DWG parser that is:
- Stable for modern DWG versions (2018+)
- Buildable on Windows without complex dependencies
- MIT or similarly permissive licensed

### Options Evaluated

| Tool | Licence | Windows? | DWG 2018? | Notes |
|---|---|---|---|---|
| **ODA File Converter** | Proprietary (free binary) | ✅ Yes | ✅ Yes | Industry-standard CLI. Recommended choice. |
| LibreDWG | GPLv3 | ⚠️ Complex build | ⚠️ Partial | Requires Linux toolchain; GPL is restrictive for this tool type. |
| ezdxf | MIT | ✅ Yes | ✅ DXF only | Excellent Python library — reads and writes DXF. No DWG support. |
| dwg2dxf (various wrappers) | Various | ⚠️ Varies | ⚠️ Varies | All ultimately depend on ODA or LibreDWG under the hood. |

### Decision
- **ODA File Converter** handles the DWG → DXF step (one-time conversion to temp cache).
- **ezdxf** (MIT) handles all subsequent DXF operations (parse, prune, save).
- This combination is practical, widely used, and legally clean for an internal tool.

### ODA File Converter Setup
1. Download from: https://www.opendesign.com/guestfiles/oda_file_converter
2. Install to: `C:\Program Files\ODA\ODAFileConverter\` (default)
3. Update `Config__DwgConversion.OdaConverter__ExePath` in `02__AppData/Na__AppData__AppConfig__.json` if installed elsewhere.

---

## 4. Box Selection Behaviour Spec

Box selection follows the **AutoCAD/standard CAD convention**:

| Drag Direction | Mode | Colour | Behaviour |
|---|---|---|---|
| Left → Right | **Window** | Blue (dashed) | Selects only entities **fully enclosed** by the box |
| Right → Left | **Crossing** | Green (dashed) | Selects entities that **touch or cross** the box boundary |

Implementation details:
- Drag direction is determined at drag-end by comparing start vs end X coordinates.
- Hit testing uses entity **bounding boxes** (from `Na__CommonUtils__GeometryHelpers__`).
- Window: `Na__Geom__RectContainsRect(selectionRect, entityBoundingBox)`
- Crossing: `Na__Geom__RectIntersectsRect(selectionRect, entityBoundingBox)`
- Bounding box is sufficient for most use cases; precise edge-crossing geometry is a follow-up.

---

## 5. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vanilla JS ES Modules | No bundler. Mirrors VectorForge architecture. |
| Rendering | SVG (injected into DOM) | Each DXF entity becomes an SVG element with `data-handle` attribute. |
| Inter-module communication | EventBus (pub/sub) | No direct module-to-module references except via constructor injection. |
| Backend | Python Flask | Lightweight local dev server. Mirrors VectorForge's `VF__LocalServer__*` pattern. |
| DWG conversion | ODA File Converter (CLI subprocess) | External binary — user must install. |
| DXF parsing/pruning | ezdxf (Python, MIT) | Production-quality DXF library. |
| PWA | Web manifest + service worker | Installable to taskbar; stale-while-revalidate caching. |

---

## 6. Folder Purposes

| Folder | Purpose |
|---|---|
| `01__AppAssets__CadAuditTools/` | App icons, brand assets (PWA icons TBD) |
| `02__AppData/` | Config JSON SSOT |
| `03__AppModules/` | All ES module source files |
| `03__AppModules/01__AppCore/` | EventBus, AppState, HotkeyManager, SelectionManager, UndoManager |
| `03__AppModules/02__UI/` | All UI panel and toolbar modules |
| `03__AppModules/03__CadEngine/` | SVG canvas, entity loading, export serialiser |
| `03__AppModules/03__CommonUtils/` | Pure geometry helper functions (no deps) |
| `03__AppModules/System__SelectionTools/` | Box-select rubber-band tool |
| `03__AppModules/System__Navigation/` | Pan/zoom ViewBox controller |
| `03__AppModules/62__Feature__AppInstallability/` | PWA manifest + SW registration |
| `03__AppStyles/` | CSS theme |
| `04__LocalProjectCache/01__TempCache*/` | DWG→DXF conversion outputs (gitignored, auto-cleaned) |
| `04__LocalProjectCache/02__SavedProjects*/` | Audited DXF outputs (gitignored, user-owned) |
| `10__LocalServer__Modules/` | Flask Python server modules |
| `85__EarlyStage__StarterInfoAndBrief/` | This document and early planning |

---

## 7. Open Questions / Follow-Up Items

- [ ] **DWG subprocess**: Wire the actual ODA File Converter subprocess call in `Na__LocalServer__DwgConversion__.py`.
- [ ] **DXF entity serialisation**: Implement `na_parse_dxf_to_entity_json()` for all entity types in `Na__LocalServer__DxfEngine__.py`.
- [ ] **SVG rendering**: Implement `Na__CadCanvas__RenderEntities()` for LINE, ARC, CIRCLE, LWPOLYLINE, TEXT, INSERT.
- [ ] **DXF pruning**: Implement `na_prune_and_save_dxf()` in `Na__LocalServer__DxfEngine__.py`.
- [ ] **Layer visibility toggle**: Add eye-icon toggle to `Na__UI__LayersPanel__` to show/hide entities by layer.
- [ ] **PWA icons**: Create 192×192 and 512×512 PNG icons and place in `01__AppAssets__CadAuditTools/`.
- [ ] **Coordinate display**: Decide on coordinate system for cursor readout — SVG space vs DXF model space.
- [ ] **Temp cache cleanup**: Optionally auto-delete temp files on server start (config flag `TempCache__AutoCleanOnStartup`).
