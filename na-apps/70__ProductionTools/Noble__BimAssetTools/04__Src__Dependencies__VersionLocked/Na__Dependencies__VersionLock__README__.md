# Noble BIM Asset Tools — Version-Locked Vendor Dependencies

Pinned coordinated set (14-Aug-2026). Do not upgrade these packages independently.

| # | Folder | Package | Version | Browser entry | Licence |
|---|--------|---------|---------|---------------|---------|
| 01 | `01__Vendor__ThreeJs__v0.184.0` | three | 0.184.0 | `build/three.module.js` | MIT |
| 02 | `02__Vendor__WebIfc__v0.0.77` | web-ifc | 0.0.77 | `web-ifc-api.js` + `web-ifc.wasm` | MPL-2.0 |
| 03 | `03__Vendor__OcctImportJs__v0.0.23` | occt-import-js | 0.0.23 | `occt-import-js.js` + `occt-import-js.wasm` | LGPL-2.1 |
| 04 | `04__Vendor__DdcRvt2Ifc__v18.1.0` | DDC RVT2IFC Converter | 18.1.0 | **native exe, not browser** | see vendor `LICENSE` |

**Vendor 04 is not a browser library.** It is a native Windows executable invoked
by the local Python server, never by the page. It appears here because it is a
pinned third-party dependency and this is where those live, but it is absent from
`package.json` and from the import map by nature.

Three.js is pinned to **0.184.0 to match Vale Lantern Designer**, so geometry and
exporter behaviour stay identical across both apps. A GLB written here and a GLB
written by the Lantern Designer go through the same `GLTFExporter` revision. Do not
drift this one without checking Lantern Designer first.

## Index / import map

- **SSOT for path map:** `Na__Dependencies__ImportMap__Index__.json`
- **Live wiring:** `Na__BimAssetTools__App__.html` → `<script type="importmap">` (must stay in sync with the JSON)

## WASM modules and why two of them are outside the import map

Both `web-ifc` and `occt-import-js` ship a JS shim plus a `.wasm` binary. The shim
locates its binary at runtime, so the `.wasm` files must sit **beside** their shim
and must be served with `Content-Type: application/wasm`. `Na__LocalServer__Main__.py`
sets that MIME type explicitly — Python's stock `http.server` does not know it, and
a wrong MIME type makes `WebAssembly.instantiateStreaming` fail with a bare
"Incorrect response MIME type" that is easy to misread as a missing file.

- **web-ifc** is a real ES module and *is* in the import map. Its wasm path is set
  at runtime by `Na__IfcLoader__Engine__.js` via `SetWasmPath()`.
- **occt-import-js** is a UMD classic script exposing a `window.occtimportjs`
  factory, exactly like jsPDF in the Lantern Designer. It is **not** in the import
  map; it is loaded by a plain `<script src>` tag and consumed as a global by
  `Na__CadLoader__OcctBridge__.js`.

`web-ifc-mt.wasm` is the multi-threaded build. It is vendored but **not used** —
it requires `SharedArrayBuffer`, which needs COOP/COEP cross-origin isolation
headers that would break loading local files from `file://`. Kept only so an
upgrade does not have to re-fetch the package.

## Licence note — read before this ships to a client

`occt-import-js` wraps OpenCascade and is **LGPL-2.1**. We consume it as an
unmodified, separately-loaded WASM module at runtime (dynamic linking), which is
the permitted use; the vendored copy is byte-identical to the npm release and the
licence text ships alongside it in this folder. If the STEP/IGES route is ever
statically bundled into an application binary, that analysis changes and needs
revisiting. `web-ifc` (MPL-2.0) is file-level copyleft only — unmodified use
carries no obligation beyond retaining the licence, which is vendored here.

npm lockfile at project root (`package.json` / `package-lock.json`) mirrors vendors
01 to 03 for `npm ci`. Browser runtime loads the vendored copies above, not
`node_modules`.

## Vendor 04 — the Revit converter, and why it is NOT committed

Two independent reasons, either of which alone would be decisive.

**1. Licence — the binding one.** The converter bundles third-party components
whose terms forbid redistribution. From its own `LICENSE` file:

> LibXL: *"Redistribution, modification, reverse engineering, or sublicensing of
> the SOFTWARE PRODUCT is prohibited unless expressly permitted by the EULA."*

It also incorporates Open Design Alliance software "pursuant to a license
agreement with Open Design Alliance". Committing the folder to a repository —
public or private — is redistribution. So it is not committed.

**2. Size.** 720 MB, of which 689 MB is the ODA SDK under
`DDC_REVIT2IFC_CONVERTER/datadrivenlibs`, including a single 80 MB file. GitHub
warns above 50 MB per file and recommends repositories stay under 1 GB.

The folder is therefore listed in `.gitignore` and lives on disk only. Obtain it
from DataDrivenConstruction directly on each machine that needs conversion.

`Na__LocalServer__RevitConvert__.py` resolves the converter from an ordered
allow-list, so nothing breaks when the vendored copy is absent:

1. The vendored copy above — preferred, keeps the tool self-contained
2. `D:/02_CoreLib__SketchUp/30__Software__3dSoftware__Tools&Utils/3dTool__Tool__RevitToIfc__Converter/...`

If neither resolves, `/api/capabilities` reports `revitConversion: false`, the
Convert button never appears, and Revit files still load for metadata audit. The
feature degrades rather than failing.

Confirmed command line:

```
RVT2IFCconverter.exe "<input.rvt>" "<output.ifc>" [mode=custom Param=Value ...]
```

The bare three-argument form is used. It emits IFC4 Reference View in
millimetres, which is what the IFC loader wants, so no custom parameters are
passed. Progress arrives on stdout as `Progress: NN.NN%` lines.

## Trimmed content

Vendored copies are trimmed to what the browser actually loads:

- **three** — `build/three.module.js`, `build/three.core.js` and the whole
  `examples/jsm` addon tree (loaders and controls are pulled from it by path).
  CJS, minified and WebGPU builds were dropped.
- **web-ifc** — ESM api and browser wasm only. The Node build and the 2 MB
  `ifc-schema.d.ts` were dropped.
- **occt-import-js** — `dist/` only. Source, tests and examples were dropped.
