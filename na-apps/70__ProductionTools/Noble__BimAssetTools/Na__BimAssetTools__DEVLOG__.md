# Noble BIM Asset Tools — Development Log

**Author:** Adam Noble — Noble Architecture
**Purpose:** Inspect, audit and convert downloaded BIM assets for use in SketchUp

---

## Version 0.2.1 — 14-Aug-2026 — Self-Containment Audit

Traced what the application actually loads, rather than assuming the vendored set
was complete, and proved a fresh clone runs.

### Method

Not a source read — the runtime was exercised. Every loader route was driven in
the browser (IFC via WASM, RFA via the pure-JS CFBF reader, all eight three.js
addon loaders, the GLTF exporter, OrbitControls, and the OpenCascade WASM engine)
and the resulting file set recorded. Then the tree was copied **excluding
everything `.gitignore` excludes**, served from that copy, and the whole pipeline
re-run against it.

```
Clean clone     33 MB, 476 files
IFC load        millimetre declared, 16,043 triangles, 61777.2 × 14056.1 × 48720.0 mm
GLB export      1.13 MB, verification PASS, worst deviation 0.001665 mm
RFA read        16 types, 128×128 preview
OCCT WASM       initialised
```

Identical to the working tree. The browser application is genuinely
self-contained.

### Findings

**No external references at all.** A sweep for `http(s)://` across every module,
stylesheet, config and the HTML shell found nothing outside `www.w3.org` (XML
namespaces) and `localhost`. No CDN, no runtime fetch, no build step.

**No absolute paths in browser code.** The one hit was a comment describing what
`BasicFileInfo` contains, not a dependency.

**The converter cannot be committed — and the reason is licence, not size.**
This changed the recommendation. Reading `DDC_REVIT2IFC_CONVERTER/LICENSE`:

> LibXL: *"Redistribution, modification, reverse engineering, or sublicensing of
> the SOFTWARE PRODUCT is prohibited unless expressly permitted by the EULA."*

It also incorporates ODA software under a separate agreement. Committing it to a
repository is redistribution, so it stays out regardless of what git could cope
with. The size problem (720 MB, one 80 MB file) is real but secondary.

The graceful-degradation path built in v0.2.0 turns out to be exactly what makes
this acceptable: without a converter the app still audits Revit files fully and
simply does not offer the Convert button.

### Added

- **`Na__Setup__VerifyDependencies__.py`** — preflight check for a fresh clone.
  Verifies 23 runtime files and 20 application modules, separates hard
  requirements from the optional converter, and reports whether the converter
  resolved to the vendored copy or the studio fallback. Verified against both a
  full tree and a clean clone.
- **`README.md`** — quick start. Three commands, no build, no npm install.

---

## Version 0.2.0 — 14-Aug-2026 — Revit Conversion Orchestration

v0.1.0 detected Revit files, audited them, and then told the user to go and
convert the file themselves. That is an instruction, not a feature. This version
closes the loop.

### The constraint, and the way around it

A browser page cannot launch a local executable, and it should not be able to.
But the application already ships a local Python server, and *that* can. So the
server became a conversion broker:

```
POST /api/convert/start    raw bytes + X-Na-Filename  →  { jobId }   202
GET  /api/convert/status   ?job=id                    →  { state, percent, message }
GET  /api/convert/result   ?job=id                    →  the IFC bytes
GET  /api/capabilities                                →  is a converter present?
```

Conversion runs on a background thread and is **polled** rather than held open on
one long request. A large project takes minutes, and a request that just hangs
tells the user nothing. The converter writes `Progress: NN.NN%` to stdout, which
is parsed and surfaced straight through to the status line.

### Converter command line

Recovered from the DDC config tool's own `generateCommand()`:

```
RVT2IFCconverter.exe "<input.rvt>" "<output.ifc>" [mode=custom Param=Value ...]
```

The bare three-argument form is used. It emits IFC4 Reference View in
millimetres, which is exactly what the IFC loader wants, so no custom parameters
are passed. Confirmed to run headlessly, exit 0, with no GUI window.

### Security posture

The endpoint runs an executable on uploaded bytes, so it is deliberately fenced:

- Server binds to `127.0.0.1` only
- The client filename is **never** used as a path — only its basename survives,
  stripped to `[A-Za-z0-9._-]`, so `../../` cannot escape the job folder
- Every job gets its own temp directory, removed when the job is reaped
- The converter path comes from a fixed allow-list, never from the client

### Vendoring

The converter is now vendored at
`04__Src__Dependencies__VersionLocked/04__Vendor__DdcRvt2Ifc__v18.1.0`.

It is **720 MB**, 689 MB of which is the ODA SDK in `datadrivenlibs`. That is far
past what belongs in git, so the folder is git-ignored and the server resolves
the converter from an ordered allow-list: vendored copy first, studio copy under
`D:/02_CoreLib__SketchUp` second. If neither resolves, `/api/capabilities`
reports `revitConversion: false`, the Convert button never appears, and Revit
files still audit for metadata. The feature degrades rather than failing.

### Also fixed — "Types: 0"

An `.rvt` was reporting *"No family types were recovered from this file"*, which
was true but useless. Project files carry no `<A:part>` elements at all; their
parameters sit at document level and describe the project rather than a family.
The parser now collects any element carrying a `typeOfParameter` attribute when
no parts are found, and the inspector shows them as **Project parameters**.

The Rectangular Range file now yields 6: Project Issue Date, Project Status,
Client Name, Project Address, and so on.

### Verification

Whole chain, browser-side, on `Guttermaster_..._Rectangular_Range.rvt` (10.7 MB):

```
Ingest RVT      auditOnly, 6 project parameters, 128×128 preview
Convert         3.9 s → Test__RectangularRange__.ifc, 2.40 MB
Ingest IFC      millimetre declared, 44,174 triangles
                30546.7 × 1437.9 × 24571.4 mm
Export GLB      2.56 MB, metres, scale baked
Verification    expected 30546.7090 × 1437.8970 × 24571.4160 mm
                measured 30546.7091 × 1437.8972 × 24571.4154 mm
                worst deviation 0.000591 mm   tolerance 0.010 mm   PASS
```

**RVT → IFC → GLB at 0.59 microns.** The Convert button correctly appears when a
Revit asset is selected and hides when the converted IFC is.

### Note

Both source and converted assets are cross-linked (`convertedToAssetId` /
`convertedFromAssetId`), so the Convert button becomes **Show converted IFC**
once a file has been converted, rather than converting it a second time.

---

## Version 0.1.0 — 14-Aug-2026 — Initial Build

First working version. Ingests BIM and CAD assets, audits their geometry, and
exports a dimensionally verified GLB.

### What prompted it

A Guttermaster BIM object download (`BB_6037`, 86 files) needed assessing before
any of it went near a live model. Opening eighty Revit families one at a time to
find out which are worth using is not a workflow.

### Findings that shaped the build

**1. The Guttermaster download is 100% Revit-proprietary.** 82 `.rfa` + 4 `.rvt`,
all OLE2 compound files. No open-source library reads their geometry, and none is
likely to — the element streams are undocumented and partly compressed.

**2. But the RFA container is not a dead end.** Probing one revealed three
recoverable streams:

| Stream | Contents |
|---|---|
| `PartAtom` | Plain UTF-8 XML. Every family type with its real dimensional parameters. |
| `BasicFileInfo` | UTF-16LE. Authoring Revit version, build, original save path. |
| `RevitPreview4.0` | Proprietary wrapper with a complete 128×128 PNG embedded. |

Across all 86 files this recovered **253 family types** with full parameter
schedules, and a preview thumbnail from every single file. That is a genuinely
useful audit even though the meshes stay locked.

`.rvt` files carry no `PartAtom`, but they do carry `ProjectInformation` — the
same partatom schema, DEFLATE-compressed inside a ZIP record. Inflated natively
with `DecompressionStream`, so no zip dependency was needed.

**3. web-ifc does not return geometry in the file's declared unit.** This one
would have been a silent thousandfold error. web-ifc folds two conversions into
every `flatTransformation` before the caller sees it: the declared length unit is
normalised to **metres**, and the IFC Z-up convention is rotated to **Y-up**.

Measured on the DDC RVT2IFC output: local vertices spanned 18419 units, the
placement matrix carried a `0.001` scale, and the product measured 18.419.

So the loader applies a fixed ×1000 and does *not* apply the declared factor. The
declared unit is still resolved, for three reasons — to refuse files declaring no
unit at all, to report the authoring unit, and to cross-check that the scale
actually embedded in the matrices agrees with the file's claim.

**4. Float32 destroys georeferenced models.** web-ifc gives vertices as Float32
in local space with the placement as a double matrix. Multiplying and storing as
float32 is the obvious implementation and it is wrong: a model on the OS National
Grid sits ~523,000,000 mm east, where float32's smallest step is about 32 mm.
Every coordinate snaps to a 32 mm lattice and the geometry shears apart.

The loader therefore accumulates in `Float64Array`, measures bounds in double,
and subtracts a re-centring offset before the single downcast — recording the
offset so absolute position is recoverable.

### Architecture decisions

**Fully ESM, unlike Lantern Designer.** Lantern Designer runs classic scripts with
one ESM bridge (`Na__Env3d__Bootstrap__`) because most of its modules are pure
business logic and only the 3D stack needs modules. Here, almost every module
touches `three` or `web-ifc`, so a single bridge would mean funnelling the whole
application through one file. There is also no ValeSpec staff-familiarity
constraint on an internal tool. Every module is `.mjs`, which already signals
"this is an ES module" in the Lantern Designer codebase.

**Internal working space is millimetres, Y-up.**
- Millimetres because UK practice dimensions in millimetres and the source content
  declares millimetres. Holding metres would put a conversion between every number
  the user reads and the number on the drawing.
- Y-up specifically to match glTF, so the exporter performs **no** axis rotation.
  That removes an entire class of "the component came in on its side" error.

**The unit conversion is baked into vertices at export, not left on a node scale.**
Importers do sometimes drop node transforms, and a dropped scale is a silent
factor of 1000 with nothing on screen to reveal it on an isolated component.

**Draco compression is off and stays off.** It is lossy for vertex positions at
default quantisation, and this tool exists to preserve dimensional accuracy.

### Verification results

Full pipeline, `No4 Huntingdon Drive Concept 3_rvt.ifc` (2.11 MB):

```
Load            76 ms    millimetre declared, cross-check passed
Bounding box    61777.2 × 14056.1 × 48720.0 mm
Audit           40 ms    verdict CRITICAL — 425 non-manifold edges,
                         1192 open edges, 847 inconsistent winding, 25 degenerate
Export          33 ms    1.53 MB GLB, metres, scale baked
Verification    expected 61777.2129 × 14056.0684 × 48719.9502 mm
                measured 61777.2121 × 14056.0683 × 48719.9485 mm
                worst deviation 0.001665 mm   tolerance 0.010 mm   PASS
```

**1.7 microns across a 61.8 metre model.** Confirmed identical in Node and in the
browser.

The CRITICAL verdict is the converter's output, not a bug in the audit — RVT2IFC
produces non-manifold geometry, which is worth knowing before that geometry is
trusted downstream.

### Bugs caught during the build

- **`computeVertexNormals()` after `applyMatrix4()` in the exporter.** Looked like
  a tidy-up; actually destructive. `BufferGeometry.applyMatrix4` already transforms
  normals by the inverse-transpose, so the extra call re-averaged normals across
  shared vertices and wiped every hard edge the source defined. Removed.
- **`GetLine(..., flatten=true)` returns resolved lines, not handles.** The unit
  resolver was reading `.value` off an already-resolved object and getting
  `undefined`, so every file "declared no length unit". Now requests unflattened
  handles and accepts either shape.
- **Build-string regex clipped nested brackets.** `[^)]+` stopped at the first
  `)` in `20160220_1515(x64)`. Changed to a greedy match to the last bracket.
- **`localName` is not portable for prefixed XML.** Browsers strip the prefix;
  other DOM implementations return the qualified name. The PartAtom parser now
  derives the local name from `tagName` itself.

### Known limitations

- **Revit geometry is metadata-only and always will be.** Route: convert to IFC
  with the DDC converter, then load the IFC.
- **`occt-import-js` is LGPL-2.1.** Consumed as an unmodified, separately-loaded
  WASM module at runtime, which is the permitted use. If the STEP route is ever
  statically bundled, that analysis needs revisiting. Noted in the version-lock
  README.
- **STEP/IGES is written but untested** — no STEP fixture was available. The IFC,
  Revit and GLB paths are all verified against real files.
- **Colour batching merges elements by material.** Individual IFC element
  selection is possible via the stored `elementRanges` but no picking UI is wired
  up yet.

### Next

- SketchUp plugin version, reusing these modules through a `UI::HtmlDialog`
  pointing at the hosted copy of this app.
- Element picking and per-element property inspection for IFC.
- Test the STEP/IGES route against a real manufacturer download.

---
