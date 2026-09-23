# TrueVision 3D - Version-Locked Third-Party Dependencies

**Locked**: 10-Sep-2026 (v2.20.0)
**Mirror of**: `WebApps/ValeVision3D/04__Lib__ThirdParty__VersionLocked` - byte-identical
vendor folders 01 to 04, which in turn mirror the Vale Lantern Designer's set.

---

## Why this folder exists

TrueVision previously pulled three.js r160 from `esm.sh` through an inline import map.
That was replaced because a renderer fetched over the network:

- is **not reproducible** - esm.sh can change what it serves for a given version tag,
  and a CDN outage takes the app down entirely;
- is **not offline-capable** - which is fatal for the installable PWA;
- **cannot carry the projection stack** - `three-mesh-bvh`, `clipper2-js` and
  `three-edge-projection` form one coordinated set with a specific three revision, and
  the projected linework system (Phase D) will not work on r160.

These four vendors are copied byte-for-byte from ValeVision so all three apps
(TrueVision, ValeVision, Lantern Designer) run identical geometry code. That is what
lets the `50__System__ProjectedLinework` modules port between them without edits.

---

## The set

| Folder | Package | Version | Size | Files |
|---|---|---|---|---|
| `01__Vendor__ThreeJs__v0.184.0` | `three` | 0.184.0 (r184) | 25 MB | 436 |
| `02__Vendor__ThreeMeshBvh__v0.9.9` | `three-mesh-bvh` | 0.9.9 | 2.2 MB | 91 |
| `03__Vendor__Clipper2Js__v0.9.0` | `clipper2-js` | 0.9.0 | 1.8 MB | 22 |
| `04__Vendor__ThreeEdgeProjection__v0.0.10` | `three-edge-projection` | 0.0.10 @ `f794481` | 253 KB | 47 |
| `05__Vendor__JsPdf__v4.1.0` | `jspdf` | 4.1.0 (built 2026-02-02) | 1.2 MB | 1 |
| `06__Vendor__Html2Canvas__v1.4.1` | `html2canvas` | 1.4.1 | 196 KB | 1 |

**Vendors 05 and 06 are the document-output pair, and they are NOT part of the
coordinated 3D set** — see rule 1. Both are single UMD bundles **injected as a
`<script>` tag at the moment they are first needed**, not imported as ES modules, so
neither has an import-map entry and neither ever will. They are read by path, from:

| Vendor | Read by | Config key | Hard-coded fallback |
|---|---|---|---|
| jsPDF | `Na__LayoutEditor__PdfExporter__.js` | `LayoutEditor__Pdf__JsPdfScriptPath` | `Na__LayoutEditor__ConfigState__SheetSetup__.js` |
| html2canvas | the Statement Writer's PDF export | `LayoutEditor__Statement__Html2CanvasScriptPath` | `Na__LayoutEditor__ConfigState__EditorSetup__.js` |

**Each one has its path written down twice** — in the config JSON and as a hard-coded
default in a ConfigState module — so moving either file means editing both, or the app
silently falls back to a path that no longer exists and the PDF button does nothing.
Three test harnesses (`Na__Test__SpecificationPdf__.html`,
`Na__Test__TitleBlockCells__.html`, `Na__Test__TitleBlockScaleCell__.html`) and
`Na__Test__ViewportRotation__.test.mjs` load jsPDF by path too.

Both arrived here on 23-Sep-2026 from `02__Src__AppModules/90__System__PageLayoutSystem`,
a folder that had held the retired Page Layout System and survived only as the home of
these two files. Vendored libraries belong in a version-locked vendor folder, not in a
module tree, and certainly not in a module folder named after a system that no longer
exists.

`TrueVision__Dependencies__ImportMap__Index__.json` is the single source of truth for
the import map. A browser cannot read an import map from JSON, so the copy declared
inline in `Index.html` **must be kept in sync by hand**.

---

## Three rules

### 1. Do not upgrade any one vendor on its own

**This rule is about vendors 01 to 04 only.** They are a coordinated set:
`three-edge-projection` is pinned to a three revision; `three-mesh-bvh` is pinned to
both. Moving one alone produces silent geometry faults rather than an error. If the set
moves, it moves in all three apps together.

Vendors 05 and 06 are independent of that set and of each other, and either can be
upgraded on its own. Upgrading one means renaming its folder to the new version and
updating the four path strings above.

### 2. Clipper2 is not optional

No TrueVision module imports `clipper2-js` directly, which makes it look droppable.
It is not: `three-edge-projection`'s `SilhouetteGenerator` imports `Path64`, `Clipper`
and `FillRule` **at module load**. A missing map entry throws
`Failed to resolve module specifier "clipper2-js"` and takes down **every** module on
the page, not just the projection ones. ValeVision shipped without it once and the app
failed to load entirely (v2.21.1).

### 3. `build/` is in `.gitignore` - the negations are load-bearing

The repository `.gitignore` ignores `build/` globally. Without the explicit negation
lines added for this folder, `01__Vendor__ThreeJs__v0.184.0/build/three.module.js` is
silently untracked, the push succeeds, and the live GitHub Pages site 404s on the
import map with no local symptom whatsoever.

Verify before every commit that touches this folder:

```bash
git check-ignore -v na-apps/30__TrueVision__CoreAppCode/04__Lib__ThirdParty__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.module.js
```

Exit code 1 and no output means it is tracked correctly. Any output naming a
`.gitignore` line means the renderer is about to be left out of the deploy.

---

## Service worker

`62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js` caches
these files in its vendor bucket. Two things follow:

- `three.module.js` imports `./three.core.js` **relatively**, so both files must ship
  and both must be reachable by the worker. Precaching only the entry point produces an
  app that boots online and fails offline.
- `PWA_SW_VERSION_TOKEN` must be bumped whenever this folder or the import map changes,
  or installed PWAs keep serving the old module graph.

---

## Upstream bug carried knowingly

`04__Vendor__ThreeEdgeProjection__v0.0.10/src/utils/bvhcastEdges.js` line 55 compares a
number to a boolean, so `FrontSide` meshes never backface cull. The vendored file is
left untouched (it must stay byte-identical to the other two apps); the ported soup
builder in `50__System__ProjectedLinework` fixes this before the kernel ever sees a
triangle.

---

## Provenance

Copied 10-Sep-2026 from
`D:\80__External__LiveRepos\ValeCodebase\WebApps\ValeVision3D\04__Lib__ThirdParty__VersionLocked`,
596 files, verified against the source file count and eleven named entry points.
