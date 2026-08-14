# Noble BIM Asset Tools — Project Map

**Version:** 0.1.0 · **Author:** Adam Noble — Noble Architecture

A browser tool for inspecting BIM and CAD assets downloaded from manufacturers,
auditing their geometry, and converting them to GLB for SketchUp with verified
dimensional accuracy.

---

## Running it

```bash
Na__LocalServer__Main__.bat
```

Opens `http://localhost:8009/Na__BimAssetTools__App__.html`. The server exists
because ES modules, import maps and WebAssembly streaming all require an HTTP
origin, and because Python's stock handler serves `.wasm` with the wrong MIME
type.

---

## Folder layout

```
Noble__BimAssetTools/
├── Na__BimAssetTools__App__.html        Application shell + import map
├── Na__BimAssetTools__DEVLOG__.md       Build history and decisions
├── Na__BimAssetTools__ProjectMap__.md   This file
├── Na__LocalServer__Main__.py           Static server with WASM MIME types
├── Na__LocalServer__Main__.bat          Launcher
├── package.json                         Mirrors the locked set for npm ci
│
├── 02__AppData/
│   ├── Na__AppData__AppConfig__.json        Tolerances, viewer, export settings
│   └── Na__AppData__FormatRegistry__.json   SSOT for extensions → loader routes
│
├── 10__LocalServer__Modules/
│   └── Na__LocalServer__RevitConvert__.py   Conversion broker (runs the exe)
│
├── 03__AppModules/
│   ├── 01__AppCore/          EventBus · Units · AppState · ConfigLoader · Init
│   ├── 02__UI/               DropZone · AssetBrowser · InspectorPanel · Toolbar
│   ├── 03__FileIngest/       FormatRouter · RevitConvert
│   ├── 04__Loaders__Ifc/     Engine · UnitResolver
│   ├── 05__Loaders__Cad/     OcctBridge  (STEP / IGES / BREP)
│   ├── 06__Loaders__Mesh/    Router      (glTF / OBJ / STL / PLY / 3DS / DAE / FBX)
│   ├── 07__Loaders__Revit/   Cfbf · Metadata
│   ├── 10__Env3d__Viewer/    Viewport
│   ├── 20__System__AssetAudit/  GeometryAudit
│   └── 80__System__GlbExport/   Exporter
│
├── 03__AppStyles/            Na__StyleSheet__BimAssetTools__.css
├── 04__Src__Dependencies__VersionLocked/
│   ├── 01__Vendor__ThreeJs__v0.184.0/
│   ├── 02__Vendor__WebIfc__v0.0.77/
│   ├── 03__Vendor__OcctImportJs__v0.0.23/
│   ├── Na__Dependencies__ImportMap__Index__.json   SSOT for the import map
│   └── Na__Dependencies__VersionLock__README__.md
└── 60__AppTesting/
    ├── Na__TestChecklist__.md
    └── __Fixtures/
```

---

## Format support

| Format | Route | Geometry | Units |
|---|---|---|---|
| IFC 2x3 / 4 / 4x3 | `ifc` — web-ifc WASM | Yes | Declared, verified |
| STEP / IGES | `occt` — OpenCascade WASM | Yes | Declared in header |
| BREP | `occt` | Yes | **Assumed** mm |
| glTF / GLB | `three` | Yes | Metres per spec |
| COLLADA | `three` | Yes | Declared in asset block |
| FBX | `three` | Yes | **Assumed** cm |
| OBJ / STL / PLY / 3DS | `three` | Yes | **Assumed** mm |
| RFA / RVT / RTE / RFT | `revitAudit` | **No** | Per-parameter |

Anything marked **Assumed** is flagged in the inspector as unverified.

---

## Revit files — read directly, converted on demand

Autodesk's geometry is proprietary. No open-source library reads it and this tool
does not pretend to. What it reads **directly** from the file:

- **Family files** — full parameter schedule, every type with its real dimensions
- **Project files** — project-level parameters (name, client, address, status)
- **Both** — the embedded 128×128 preview, authoring Revit version, build, original save path

For **geometry**, select the Revit asset and press **Convert to IFC**. The page
hands the file to the local server, which runs the DDC converter, and the
resulting IFC is loaded, audited and made ready to export — without leaving the
app. A 10 MB project converts in about four seconds.

```
Browser                Local server                DDC converter
  │  POST /api/convert/start  │                          │
  │──────── file bytes ──────►│  RVT2IFCconverter.exe ──►│
  │  GET  …/status  (poll)    │◄──── Progress: NN% ──────│
  │◄─── percent + message ────│                          │
  │  GET  …/result            │                          │
  │◄──────── IFC bytes ───────│                          │
  └─► ingest → audit → export GLB
```

The Convert button only appears when a converter is actually present. Running the
app hosted, or without the local server, hides it rather than offering an action
that cannot work — Revit files still load for metadata audit.

**Converter resolution order:**

1. `04__Src__Dependencies__VersionLocked/04__Vendor__DdcRvt2Ifc__v18.1.0/…` *(vendored, git-ignored at 720 MB)*
2. `D:/02_CoreLib__SketchUp/30__Software__3dSoftware__Tools&Utils/3dTool__Tool__RevitToIfc__Converter/…`

Runs without Revit installed and produces IFC4 Reference View in millimetres.

---

## The accuracy chain

Everything is millimetres, Y-up, internally.

1. **Loaders** convert to mm exactly once and record the factor applied
2. **IFC** cross-checks the declared unit against the scale in the placement
   matrices, and re-centres far-from-origin models in double precision before the
   single float32 downcast
3. **Audit** measures the bounding box for checking against the data sheet
4. **Export** bakes mm→m into vertex positions, then **reads the file back and
   measures it**. If the round trip drifts more than 0.01 mm the export fails
   rather than being handed over

Measured on a 61.8 m model: **1.7 microns**.

---

## Audit checks

| Check | Why it matters downstream |
|---|---|
| Bounding box | First thing to compare against the manufacturer's data sheet |
| Triangle count | A gutter bracket should not be 40,000 triangles |
| Distance from origin | Float32 precision loss; imports far from the model |
| Open edges | Not a solid — no push/pull, no booleans, no volume |
| Non-manifold edges | Cannot exist as a real object; most tools refuse to repair |
| Inconsistent winding | Blue back faces in SketchUp, corrected one at a time |
| Degenerate triangles | Break normals; stop SketchUp healing the surrounding face |
| Unwelded vertices | Defeats smooth shading, inflates the file |
| Non-uniform scale | Dimensions may be right on one axis only |

Verdicts: **clean** · **usable** · **poor** · **critical**

---

## Key conventions

- **Naming:** `Na__<Module>__<Thing>__.mjs`, numbered module folders
- **Module system:** fully ESM (see DEVLOG for why this differs from Lantern Designer)
- **Import map:** declared in the HTML, mirroring `Na__Dependencies__ImportMap__Index__.json`, which is the SSOT
- **occt-import-js** is a UMD classic script and is deliberately *not* in the import map — same handling as jsPDF in Lantern Designer
- **three.js is pinned to 0.184.0** to match Lantern Designer, so GLB export behaves identically in both apps

---

## Planned — SketchUp plugin

The intent is one codebase, two front ends. The SketchUp version will use
`UI::HtmlDialog` pointing at the hosted copy of this app, with a Ruby bridge
receiving the GLB and building geometry through the SketchUp API. Because the
export is already verified to 0.01 mm and already Y-up, the Ruby side only has to
handle the axis convention SketchUp expects and place the result.
