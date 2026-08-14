# Noble BIM Asset Tools

**Inspect, audit and convert BIM assets downloaded from manufacturers — with verified dimensional accuracy.**

Noble Architecture · v0.2.0

---

## Quick start

Three steps, no build, no npm install.

```bash
python Na__Setup__VerifyDependencies__.py
```

```bash
Na__LocalServer__Main__.bat
```

Then drop a file or a folder onto the left panel.

That's it. The browser opens at `http://localhost:8009` automatically. Everything
the app needs is committed to this repository — there is no CDN, no package
install and no build step.

> **Why a server rather than opening the HTML directly?**
> ES modules, import maps and WebAssembly streaming all require an HTTP origin,
> and Python's stock handler serves `.wasm` with the wrong MIME type — which
> fails with a misleading "Incorrect response MIME type" error. The bundled
> server fixes both.

**Requirements:** Python 3.8+ and a current browser. Nothing else.

---

## What it does

| | |
|---|---|
| **View** | Orbit, section and shade any BIM or CAD asset for visual inspection |
| **Audit** | Judge whether it is fit for production — dimensions, topology, materials |
| **Convert** | Write a GLB for SketchUp, verified to 0.01 mm against the source |
| **Revit** | Read parameter schedules directly, and convert to IFC on demand |

### Formats read

| Format | Geometry | Units |
|---|---|---|
| IFC 2x3 / 4 / 4x3 | Yes | Declared, cross-checked |
| STEP / IGES / BREP | Yes | Declared in header |
| glTF / GLB | Yes | Metres per spec |
| COLLADA / FBX | Yes | Declared / assumed cm |
| OBJ / STL / PLY / 3DS | Yes | **Assumed** — flagged in the inspector |
| Revit RFA / RVT / RTE / RFT | Via conversion | Per-parameter |

---

## Try it in 60 seconds

1. Drop a folder of downloaded BIM objects onto the left panel — subfolders are
   walked automatically, and anything unreadable is ignored.
2. Coloured dots show the verdict at a glance: **green** clean, **grey** usable,
   **amber** poor, **red** critical.
3. Click one. The inspector shows its bounding box in millimetres — check it
   against the manufacturer's data sheet.
4. Press **Export GLB**. The status line reports the verified deviation.

For a Revit file, press **Convert to IFC** first — the geometry loads
automatically once converted.

---

## Dependencies

Everything below is committed. A fresh clone is **33 MB / 476 files** and runs
with no further setup.

| Library | Version | Licence | Used for |
|---|---|---|---|
| [three.js](https://threejs.org) | 0.184.0 | MIT | Rendering, mesh loaders, GLB export |
| [web-ifc](https://github.com/ThatOpen/engine_web-ifc) | 0.0.77 | MPL-2.0 | IFC parsing (WASM) |
| [occt-import-js](https://github.com/kovacsv/occt-import-js) | 0.0.23 | LGPL-2.1 | STEP / IGES / BREP (OpenCascade WASM) |

Pinned in `04__Src__Dependencies__VersionLocked/`, indexed by
`Na__Dependencies__ImportMap__Index__.json`, documented in
`Na__Dependencies__VersionLock__README__.md`.

**three.js is pinned to 0.184.0 to match Vale Lantern Designer**, so a GLB written
by either app goes through the same exporter revision. Check Lantern Designer
before changing it.

`node_modules/` is **not** required to run — `package.json` exists only so
`npm ci` can reproduce the same set for Node-side testing. The browser always
loads the vendored copies.

### The one thing not committed

The **DDC RVT2IFC converter** (720 MB) is excluded, for two reasons:

1. **Licence.** It bundles LibXL and the Open Design Alliance SDK. LibXL's terms
   state redistribution is *"prohibited unless expressly permitted by the EULA"*.
   Committing it to a repository would be redistributing it.
2. **Size.** 689 MB of it is the ODA SDK, with one 80 MB file. GitHub warns above
   50 MB per file and recommends repositories stay under 1 GB.

**Nothing breaks without it.** Revit files still load and show their full
parameter schedule, thumbnail and version data — only the conversion to geometry
is unavailable, and the Convert button simply doesn't appear.

To enable conversion on a machine, put the converter at either:

```
04__Src__Dependencies__VersionLocked/04__Vendor__DdcRvt2Ifc__v18.1.0/
  DDC_REVIT2IFC_CONVERTER/RVT2IFCconverter.exe
```

or leave it at its studio location — the server checks the vendored path first,
then falls back to:

```
D:/02_CoreLib__SketchUp/30__Software__3dSoftware__Tools&Utils/
  3dTool__Tool__RevitToIfc__Converter/DDC_Converter_Revit2IFC_v05032026/
```

`Na__Setup__VerifyDependencies__.py` reports which one it found.

---

## Accuracy

This is the reason the tool exists. Everything is **millimetres, Y-up** internally.

- Loaders convert to millimetres **exactly once** and record the factor applied
- IFC cross-checks the declared unit against the scale actually baked into the
  placement matrices, and re-centres far-from-origin models in double precision
  before the single float32 downcast
- Export bakes mm→m into vertex positions, then **reads the file back and
  measures it**. Drift beyond 0.01 mm fails the export rather than handing over a
  file that is quietly wrong

Measured on a 61.8 m model: **1.7 microns**. On a full RVT → IFC → GLB chain:
**0.59 microns**.

---

## Project files

| File | Purpose |
|---|---|
| `Na__BimAssetTools__App__.html` | Application shell and import map |
| `Na__LocalServer__Main__.bat` | **Start here** |
| `Na__Setup__VerifyDependencies__.py` | Preflight check for a fresh clone |
| `Na__BimAssetTools__ProjectMap__.md` | Architecture and folder layout |
| `Na__BimAssetTools__DEVLOG__.md` | Build history and the reasoning behind decisions |
| `60__AppTesting/Na__TestChecklist__.md` | Hand-test checklist |

---

## Troubleshooting

**Blank page, console shows 404s**
Run `python Na__Setup__VerifyDependencies__.py`. It names the missing file.

**"Incorrect response MIME type" in the console**
The app is being served by something other than the bundled server. Use
`Na__LocalServer__Main__.bat`.

**Port already in use**
The server finds the next free port automatically and prints it. Or pass
`--port 8010`.

**No Convert to IFC button on a Revit file**
No converter was found. The verification script reports this, and the app still
audits the file's parameters. See *The one thing not committed* above.

**A component imports into SketchUp 1000× too small or too large**
Check the inspector's **Unit basis** row. If it says *ASSUMED*, the format
declared no units — verify against a known dimension.

---

## Next

A SketchUp plugin sharing this codebase, via `UI::HtmlDialog` against the hosted
copy, with a Ruby bridge receiving the already-verified GLB.
