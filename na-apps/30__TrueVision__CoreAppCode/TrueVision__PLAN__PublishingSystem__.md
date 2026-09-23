# TrueVision3D — Publishing and the Published Reader

**Written 23-Sep-2026.** The plan for splitting the one renderer into an authoring
renderer that stays exactly as it is, and a published-document reader that computes
nothing.

**Status, 23-Sep-2026 (TrueVision v2.155.0 - see the DEVLOG): Phases 0 to 4 are BUILT
AND TESTED on RB05, locally. Phase 5 is BUILT - the R2 client section, the local server's
routes, the archive zip and the service worker cache - but its R2 push has NOT yet run
against the bucket (Adam's PS01 publish is the first), and no real revision change has been
archived yet. The example folder is still the approved version and must be brought up to
the final file shape.** See section 5 for what each phase means and how it was proved.

The worked example of the file shape - which is also the fixture both test suites run
against - is at
`na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments`.

---

## 1. The decision, and why

### 1.1 What the audit got right

The external audit of 23-Sep-2026 is sound on diagnosis and its numbers check out against
the config. `LayoutEditor__Raster__Levels.medium` is 12 px/mm capped at 5,120 with 4
anti-alias samples, `ScaleWithDevicePixelRatio` is true, and
`LayoutEditor__ViewportCache__MaxParkedSheets` is 24. Its reading of the crash —
memory pressure from rendering a print-quality image on the reader's device and then
keeping it — is the right reading.

It is also right that `Na__PlStore__BakeBeforeSave` has no callers: a repository-wide
search finds it defined at `Na__ProjectedLinework__Persistence__.js:616` and exported,
and called nowhere. The comment above it describes a call graph that does not exist.

### 1.2 Where its recommendation is wrong

Its section 6 keeps **one renderer, one viewer and one document format**, and puts a
fingerprint-keyed asset cache in front of them. That is a cache, and a cache has a miss.

`Na__PlStore__Deserialise` refuses a stored block on four independent grounds: schema
version, model build token, view fingerprint, and missing owner tags. Every one of those
refusals currently falls through to computing the drawing on the device. **You cannot
make a phone safe by adding four conditions whose failure mode is the thing that crashes
it.** The audit half-sees this — it says the published viewer should have no
drawing-generation fallback — but it does not follow it through to the only structure
that guarantees it, which is a second format and a second reader that do not contain a
renderer at all.

Adam's design is the correct one, for three reasons that are about structure rather than
about tuning:

1. **A published document is a deliverable, not a cache entry.** It has no fingerprint
   gate. It is either the document or an honest grey mask saying it has not been
   published. There is no third state in which the reader tries.
2. **It removes code from the reader, not just work.** Under the audit's plan the reader
   still loads the projection workers, the snapshot renderer, the tiled exporter, the
   supersampler and the sharpener, and merely hopes not to call them. Under this plan the
   reader's module graph does not contain them. On a four-year-old iPhone that is the
   difference between a page that mostly does not crash and a page that cannot.
3. **The split already exists in the data.** `Sheet__Layers` already carries
   `Layer__Type` of `annotation`, `dimension`, `vector`, `area`, `viewport`, `image`.
   One file per element type is not a new taxonomy — it is the existing one written to
   disk, which is why the layer switch Adam wants later comes free.

### 1.3 The three things to change in Adam's brief

**PNG versus WebP is the wrong axis.** A WebP and a PNG of the same pixel dimensions cost
identical memory once decoded — `width × height × 4` bytes — so swapping codec on a
struggling device saves download and nothing else, and the crash is not a download
problem. The lever is **pixel dimensions**. Publish one codec at several sizes:

| Tier | px/mm | Cap | Format | D02 elevation | Decoded |
|---|---:|---:|---|---|---:|
| Tier01 Fit | 2 | 1,024 | WebP q90 | 948 × 254 | **0.96 MB** |
| Tier02 Read | 6 | 3,072 | WebP q92 | 2,844 × 761 | 8.7 MB |
| Tier03 Detail | 12 | 5,120 | WebP q94 | 5,120 × 1,371 | 28.1 MB |
| Print | 20 | 8,192 | PNG | 8,192 × 2,193 | 71.9 MB, never loaded to look at |

Against **56.2 MB** decoded today for the same viewport merely fitted to the screen —
5,120 × 1,371, held as a base image *and* a fog layer, after computing both on the
device. Tier01 is 58× less memory and zero compute. The ground floor plan is 168.6 MB
today against 3.14 MB; a 560 × 535 mm site plan viewport is **200.3 MB** today against
4.01 MB. That is the iPad.

Print stays PNG because jsPDF drops the alpha of raw RGBA and because print is the one
place lossless earns its bytes. Screen tiers are WebP. A struggling device is given a
**smaller tier**, never a different codec.

**Publish the linework as paint-ready SVG, not as segment data.**
`Na__PlOverlay__BuildSvgMarkup` at `Na__ProjectedLinework__SvgOverlay__.js:349` already
writes exactly this file — one `<path>` per class with stroke colour, width, opacity and
dash resolved onto the element. Publishing the coordinate arrays instead would force the
reader to own the appearance config, the owner-tag decoder and the LineworkModifier
table, which is the styling half of the projection module. And the property that makes
this safe on a phone is that **41,206 segments is still five DOM nodes** — the cost of an
SVG to a browser is the element count far more than the path length. The only change
needed is to emit paper-millimetre coordinates instead of export pixels.

**Do not flip the coordinates at publish time.** Store paper millimetres in the authored
space — origin top-left, x right, y down — which is what the project data holds and what
the linework asset already declares. A reader that wants CAD semantics applies one
transform to one group. Flipping at publish means every element file, every SVG and every
raster offset must agree about the flip, and one disagreement is a silently upside-down
drawing. The example declares `Paper__OriginCorner` and `Paper__AxisY` so the space is
stated rather than assumed, and the publisher honours whatever they say.

### 1.4 The rule that earns the whole design

**Element files carry the authoring keys verbatim, plus one resolved key wherever the
authoring side computes something at paint time.** Each of these deletes a module from
the reader:

| Element | Added at publish | Removed from the reader |
|---|---|---|
| Dimension | `Dimension__Text` | The dimension-text maker — precision, units suffix, at-scale, round-up-to-5 and its asterisk. `Na__LeDim__FormatDimension` is the one text maker and it stays on the authoring side. |
| Floor area | `Area__AreaM2`, `Area__LabelText` | The area maths. m² is never stored — it is computed on paint. |
| Annotation | `Annotation__Lines`, `Annotation__Runs` | Text metrics and the markdown emphasis parse. A reader running a regex over client text will one day eat an asterisk that belonged to a dimension. |
| Drawing title | `Title__UnderlineWidthMm` | The refit that currently has to run twice because titles refit once the font loads. |
| Bubble | `Leader__SpecCode`, `Leader__SpecText` | The specification lookup and the specification document itself. |
| Scale bar | Resolved divisions and labels | Any notion of what a scale is. |
| Margin notes | `ResolvedLines`, numbered and filtered | The note library and the grouping rules. |

### 1.5 The example folder is the schema, and it lives outside this app

The worked example at
`na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments`
is not a sample output. **It is the schema in its readable form** — the template Adam
looks at to see the shape of a published document, for every job.

It sits in the project portal rather than in this app, which is exactly why it needs
naming explicitly in code. A future agent changing a data structure will not find it by
looking around the TrueVision tree. So:

**Every file of all three new modules carries a `SCHEMA REF` line in its header block**,
directly under `PURPOSE`, in this form:

```js
// FILE       : Na__PublishedSchema__Paths__.js
// NAMESPACE  : Na__PubSchema
// MODULE     : Published Schema - Paths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build every published folder and file name; both sides use these
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : ...
```

**The rule, and it is not optional: a change to any published data structure is not
finished until the example folder matches it.** The example is versioned by
`Publish__SchemaVersion`, the same number the code carries, so the two can be checked
against each other in one glance. A parity note sits at each end of the link — in the
example folder's ReadMe and in the schema module's README — because a note at only one
end is a note somebody will not read.

---

## 2. Module numbering

Three new folders, in one run: `51` the editor, `52` the published documents, `53` their
schema. The publisher is a feature *of* the editor so it lives inside 51; the reader is
top-level because it must never import the editor; the schema is top-level because both
import it and neither must import the other. The `Layout__` infix on 52 and 53 binds the
three together by name as well as by number.

### 2.0 Prerequisite: freeing 52 and 53 — **DONE 23-Sep-2026**

`52` and `53` at root were `52__System__SitePlanData` and `53__System__ProjectQrCode`.
Both were **layout-editor-only** — every import of either was from a file inside
`51__System__LayoutEditor` — so both moved in:

| Folder | Import sites | Moved to |
|---|---:|---|
| `52__System__SitePlanData` | 8 | `51__System__LayoutEditor/21__System__SitePlanData` |
| `53__System__ProjectQrCode` | 4 | `51__System__LayoutEditor/53__Feature__ProjectQrCode` |

`21` sits directly after `20__System__Viewports`, which is what reads the site plan
store. `53` fills the one gap in the editor's own feature band, 50 to 59.

**What the move actually cost, recorded because the next one will cost the same.** Not the
12 import specifiers — those were uniform (`../../52__…` → `../21__…`) and a sweep did
them. It was the four things that were not import specifiers:

1. **Outward imports inside the moved folders.** Both folders reached out to
   `../03__AppUtils/` and one to `../80__CloudflareIntegration/`. One level deeper means
   those become `../../`. Miss one and the module fails to load.
2. **A runtime URL resolved against the module, not the page.** The QR system fetches its
   project index with `fetch(new URL(indexUrl, import.meta.url))`, where `indexUrl` was
   `'../../../../q/index.json'` — module-relative, in two places (the config JSON and the
   hard-coded fallback in `Na__ProjectQr__Symbol__.js`). Both needed a fifth `../`. **No
   static verifier can catch this**: it is a string, it resolves at runtime, and the
   failure is a silent 404 on the project-link check.
3. **Test harnesses that stage modules in a temp directory by rewriting an exact
   specifier string.** `Na__Test__ProjectQr__.test.mjs` did
   `source.replace("'../03__AppUtils/…'", "'./ProjectLoader.mjs'")` in **two** places.
   Deepening the real import made both rewrites silently stop matching, and the staged
   copy then reached out of the temp directory. Both are now depth-proof regexes
   (`/'(?:\.\.\/)+03__AppUtils\/…'/`), so the next move cannot break them.
4. **Test harnesses referencing folders by path in `.html` and `.mjs`**, which a sweep
   over the module tree never sees.

The verifiers proved the graph, not the strings: `Na__Verify__ModuleGraph__.mjs` came back
byte-identical to its pre-move baseline (the same two pre-existing false positives, which
are the verifier mis-parsing template literals, not faults), and
`Na__Verify__Exports__.mjs` passed at 504 files against 506 before — exactly the two
vendored UMD bundles that left `02__Src__AppModules`. What proved the strings was running
`Na__Test__ProjectQr__` (50 checks), `Na__Test__SitePlanStore__` (32) and
`Na__Test__ScrapbookProjectQr__`, all green.

`TrueVision__DEVLOG__.md` and the `TrueVision__TASKS__v2.0.x` migration docs still name
the old paths and were **left alone**: they record what was true on the day.

**`54__Feature__ColourPalette` did NOT move, and must not.** It is imported by
`43__System__PlanAnnotations/Na__PlanAnnotations__Toolbar__.js:114` as well as by the
editor's `PanelHost`. Module 43 is a drawing-view system, not a layout-editor one:
putting the palette inside 51 would make a non-editor system reach into the editor's
tree, which is the wrong direction and the kind of import that later stops anyone
loading 43 without 51. It is a shared UI utility and it belongs outside the editor.
`55__Feature__SpellCheck` has only one consumer today, inside the editor, but it is the
same kind of thing — a generic text-field utility the Statement Writer and annotations
will both want — so it stays beside the palette.

The service worker named neither folder, so its precache list and patterns needed nothing.
Its **version token was bumped** to `2026-09-23-01` all the same: files the app loads by
path moved, and a warm cache holding the old shell breaks once. That is the standing rule
for any release that moves or adds a loaded file.

### 2.1 `51__System__LayoutEditor/65__Feature__DocumentPublishing` — the baker

Authoring only. Never in the reader's module graph. **65** sits after
`60__Feature__PdfExport` because it is the same family — making the final artefact — and
before `70__DevTools__DevMenu`.

Namespace `Na__LePub__`.

```
65__Feature__DocumentPublishing/
    Na__LayoutEditor__Publish__Config__.json      Tiers, folder names, limits, labels
    Na__LayoutEditor__Publish__.js                The Publish command and its orchestration
    Na__LayoutEditor__Publish__Flatten__.js       Composite every raster layer of a viewport into one opaque image, once per tier
    Na__LayoutEditor__Publish__Vectors__.js       The per-viewport paint-ready SVG, in paper mm
    Na__LayoutEditor__Publish__Elements__.js      The element split, and the resolved keys of 1.4
    Na__LayoutEditor__Publish__Sheet__.js         Document__Sheet__.json: paper, title block, layers, margin notes
    Na__LayoutEditor__Publish__Manifest__.js      Document__Manifest__.json and the project index
    Na__LayoutEditor__Publish__Transport__.js     Local write, R2 upload, HEAD verify, scoped purge, archive zip
    Na__LayoutEditor__Publish__Panel__.js         The panel: what is published, what is stale, Publish
    Na__LayoutEditor__Styles__Publish__.css
```

### 2.2 `02__Src__AppModules/52__System__Layout__PublishedDocuments` — the reader

Loaded by everyone. Imports `53__Data__Layout__PublishedSchema` and nothing else of ours.

Namespace `Na__PubDoc__`.

```
52__System__Layout__PublishedDocuments/
    Na__PubDoc__Config__.json                     Reader settings: tier thresholds, cache ceiling, labels
    Na__PubDoc__Index__.js                        The project index: which documents, what state
    Na__PubDoc__Urls__.js                         The URL builder, over Na__AppUtils__ResolveAssetUrl
    Na__PubDoc__Fetch__.js                        One fetch path, R2 first, Pages fallback, no retries on a miss
    Na__PubDoc__Document__.js                     Load one document: manifest, sheet, then its layers
    Na__PubDoc__Sheet__.js                        Paper, title block, QR, north, drawing title, scale bar
    Na__PubDoc__Viewports__.js                    Place the raster and the SVG; nothing else
    Na__PubDoc__Tiers__.js                        The zoom ladder: which tier, when, and dropping the one below
    Na__PubDoc__Elements__Dimensions__.js
    Na__PubDoc__Elements__Text__.js
    Na__PubDoc__Elements__Vectors__.js
    Na__PubDoc__Elements__Areas__.js
    Na__PubDoc__Elements__Bubbles__.js
    Na__PubDoc__Elements__Images__.js
    Na__PubDoc__Unpublished__.js                  The grey mask and its message
    Na__PubDoc__Pdf__.js                          Download PDF from the Print tier and the element files
    Na__PubDoc__Styles__Main__.css
```

### 2.3 `02__Src__AppModules/53__Data__Layout__PublishedSchema` — the shared contract

The only module both sides import, so the two can never drift. If a key is in both the
publisher and the reader and not here, that is the bug. **It is also the code end of the
parity link with the example folder** — see 1.5, and the README below is where that link
is written down.

Namespace `Na__PubSchema__`.

```
53__Data__Layout__PublishedSchema/
    Na__PublishedSchema__.json                    Schema version, file names, folder names, the tier table
    Na__PublishedSchema__Paths__.js               Folder and file name builders, both sides use these
    Na__PublishedSchema__Version__.js             The version gate: what a reader will and will not read
    README__PublishedSchema__.md                  The shape, the parity link, and what bumping the version costs
```

### 2.4 What the reader shell keeps

`51__System__LayoutEditor/80__Feature__WebViewer` stays and keeps its job — the dock,
the tab strip, which document is on, the touch recogniser. What changes is what it mounts
for a drawing: `Na__PubDoc__Document__` instead of the read-only sheet surface. It is the
one file that bridges the two halves, and it should be the only one.

### 2.5 `90__System__PageLayoutSystem` removed — **DONE 23-Sep-2026**

It was **not a system and not a placeholder — it was a corpse**, and its own
`Na__PageLayoutSystem__README__.md` said so. The Page Layout System was a ValeVision port
(a Create Drawing button that rendered a still, stashed it on `window` and opened a second
browser tab that dropped the image onto a fixed A3 sheet). The Layout Editor does all of
that in-app on real sheets, so the button, the tab, the controls, the canvas pipeline, the
styles and the A3 exporter were all removed together at that time. What survived was three
files nothing had rehomed, and a folder name that read as a live system nobody could find
the code for.

The three files went where they belong:

| What it was | Now | Read by |
|---|---|---|
| `jspdf.umd.js` (4.1.0) | `04__Lib__ThirdParty__VersionLocked/05__Vendor__JsPdf__v4.1.0/` | `LayoutEditor__Pdf__JsPdfScriptPath` + a hard-coded fallback in `Na__LayoutEditor__ConfigState__SheetSetup__.js` |
| `html2canvas.umd.js` (1.4.1) | `04__Lib__ThirdParty__VersionLocked/06__Vendor__Html2Canvas__v1.4.1/` | `LayoutEditor__Statement__Html2CanvasScriptPath` + a fallback in `Na__LayoutEditor__ConfigState__EditorSetup__.js` |
| `PageLayoutSystem__TitleBlock__A3__.png` | `01__AppAssets__TrueVision/06__AppAssets__TitleBlocks/TitleBlock__ClassicScan__A3__.png` | `LayoutEditor__TitleBlock__ClassicScanAssets` — all four paper sizes still point at the one A3 scan |

**Each library's path was written down twice** — the config JSON and a hard-coded default
in a ConfigState module — plus three `.html` test harnesses and one `.test.mjs` that load
jsPDF by path. All eight strings were updated and each one was then checked to resolve to
a real file on disk, because a wrong path here is not an error: the config falls back, the
fallback is also wrong, and the PDF button simply does nothing.

**One behaviour changed, for the better.** The service worker routes any URL containing
`/04__Lib__ThirdParty__VersionLocked/` to its **vendor** bucket, cache-first and pinned.
Under `02__Src__AppModules` these two were shell assets, re-validated on every load; they
are now downloaded once and never again. That is correct for a version-locked file, and
safe only because the folder name carries the version — an upgrade changes the path, so
it can never be served stale. This is written into
`TrueVision__Dependencies__VersionLock__README__.md` along with the note that vendors 05
and 06 are **not** part of the coordinated 3D set and may be upgraded alone.

The retirement explanation is recorded here because the folder's README went with the
folder.

---

## 3. Publish

### 3.1 The command

A **Publish** button in the Layout Editor, beside Save and never instead of it. Ctrl+S
stays a fast project save exactly as it is. Publishing is a separate, slower, explicit
act, because it is the act that changes what a client sees.

It publishes the sheets it is asked to, not always all of them: a pack of fourteen
sheets is several minutes of rendering and re-publishing an unchanged sheet is waste.
The panel lists every sheet with its state — published, stale, never published — and the
default is every stale one.

### 3.2 The order, and why it is this order

1. Build every file locally into the document folder.
2. Upload every file to R2.
3. `HEAD` each uploaded key and check the byte count.
4. Write `Document__Manifest__.json`.
5. Delete only the keys **under this document's folder** that the new manifest does not name.
6. Write `PublishedDocuments__Index__.json` last of all.

The manifest is the atomic switch for one document; the index is the atomic switch for
the project. A publish that dies at step 2 leaves the previous document whole, because
nothing was deleted and no manifest changed.

**The purge is scoped to one document's folder. Never a prefix sweep.** The GLB sync
already deletes every R2 key no local folder holds, which is correct for a mirror and
catastrophic here: a partly-failed publish would delete live drawings of documents it was
not even asked about.

### 3.3 Revisions

The revision letter is compared with the one already in the folder.

- **Same letter** — overwrite in place, archive nothing. An unissued revision worked on
  all afternoon leaves one folder and no zips.
- **New letter** — zip the existing folder to
  `00__Archive__Revisions/<document id>__Revision__<old>.zip`, then build clean.

The zip is made by the local server with Python's `zipfile`, not in the browser — there
is no zip library vendored and there is no reason to add one.

`00__Archive__Revisions` starts with `00__`, which is what keeps it local:
`SKIP_FOLDER_PREFIXES` in `CloudflareR2__ModelSync__Main__.py` is `('.', '00__')`, so no
archive ever reaches the bucket. Only the latest revision is published, and
`PublishedDocuments__Superseded` in the index is the reserved place for the day that
changes.

### 3.4 Transport

No new Cloudflare Worker routes. `CloudflareHandler__R2__.js` already does read, write,
list, delete, upload and copy, guarded only by the `R2_PREFIX`. Two client-side gates
need widening:

- `Na__CfApi__AssetPathPattern` in `Na__CloudflareIntegration__ApiClient__.js:450` — the
  published-documents folder is not in it. Follow the shape
  `Na__CfApi__SheetImagePlaces` already uses: its own directory constant, its own segment
  and file patterns, its own immutable cache header.
- A local Flask blueprint, `ProjectVision__TrueVisionPublished__Api__.py`, a sibling of
  `ProjectVision__TrueVisionSheetImages__Api__.py`, for the repository-side write and the
  archive zip. **The local server does not reload its routes** — 8090 has to be
  restarted before a new route answers anything but 405.

### 3.5 The service worker

One more cache class, the same shape as the sheet-image one it already has:

```js
const PWA_SW_CACHE_NAME_PUBLISHED = `tv-published-${PWA_SW_VERSION_TOKEN}`;
const PWA_SW_PATTERN_PUBLISHED_ASSET = /\/06__Layout__PublishedDocuments\/[^/]+\/0[23]__Viewports__(Vector|Raster)\/[^/]+\.(svg|webp|png)(\?.*)?$/i;
const PWA_SW_PATTERN_PUBLISHED_DATA  = /\/06__Layout__PublishedDocuments\/.*\.json(\?.*)?$/i;
```

Assets are **cache-first and immutable** — every name carries its content hash, so a name
can never mean two files. JSON is **network-first**, because the index and the manifests
are the switches and a reader holding yesterday's index is a reader showing yesterday's
drawings. Add `'tv-published-'` to `PWA_SW_CACHE_PREFIXES_OWNED` and the new name to the
active-cache list in the activate handler, or the first version bump will orphan it.

A PWA bump is due with this: a warm cache that lacks a new import breaks once.

---

## 4. The reader

### 4.1 Opening a drawing

1. The index is already loaded — it came with the project.
2. Its entry says `published` or `unpublished`.
3. **Unpublished**: draw the paper, the title block and the QR from the index entry, mask
   the drawing area grey, say so. Fetch nothing. This is the whole guard, and it must be
   the first branch in the function rather than a check somewhere inside it.
4. **Published**: fetch the manifest and the sheet, draw the paper and the title block,
   then each layer's file in `Layer__Order` descending, then each viewport's Tier01 raster
   and its SVG.

Nothing on that path can call the projection pipeline, the snapshot renderer or the tiled
exporter, because nothing on that path can import them.

### 4.2 Tiers

A sheet opens fitted, so it opens on Tier01. Stepping up happens when the sheet's zoom
means the current tier's pixels would be larger than a device pixel — the threshold is
`Tier__UpToZoom` in the index, so an old reader and a new publish still agree.

**One tier of one viewport at a time.** Stepping up drops the tier below rather than
adding to it. A decode that fails leaves the reader on the tier below and says so in the
dock; it does not retry the tier that failed. That is the audit's uncapped-retry finding,
and it is the one finding of theirs that must be fixed here rather than on the authoring
side.

### 4.3 What is still worth doing after this

The reader still holds the whole 3D scene while somebody reads drawings, because they
arrived on the 3D tab. Releasing the model on entering a drawing tab and reloading it on
return is the other half of the memory win, and it is a separate piece of work — Phase 5
below. It is not needed to stop the crash, and it should not be mixed into the work that
does.

---

## 4A. Decisions taken while building the reader, 23-Sep-2026

**The reader emits SVG markup strings, not DOM nodes.** A sheet is built as one
string and parsed once. Building it as DOM would be thousands of `createElementNS`
calls, each a JS/DOM boundary crossing, on the device least able to afford them.
Interaction comes from one delegated listener reading `data-na-id`, so nothing is
lost. It also makes the reader testable with no browser at all, which is how both
new test suites work.

**The sheet's furniture is published as a resolved mark list, not as settings.**
Originally `Document__Sheet__.json` carried title block *fields* and the reader was
to lay the block out. That was wrong: the authoring side positions all of it with
`Na__LeChrome__` (SheetChrome) - measuring text, fitting it to cells, placing the
logo by its aspect, wrapping the QR body to a line count - and a reader
reimplementing that would diverge from the approved drawing in ways nobody would
see until a client did. **The reader cannot import SheetChrome**: walking its
imports on 23-Sep-2026 showed it transitively reaches `SnapshotRenderer`, the
`Viewport2d` family and `EdgeStyles`, so importing it would drag the whole renderer
into the reader and undo the split. So the PUBLISHER runs SheetChrome - already
loaded in the editor - and writes out the marks it produced. Parity by
construction, and `Na__PubDoc__Sheet__.js` became an emitter of about 80 lines.

**The one remaining parity risk is dimension ARRANGEMENT.** Values cannot differ -
`Dimension__Text` is a published string. But where the text sits relative to the
line, and which side, is implemented in `Na__PubDoc__Elements__.js` to the standard
convention without reading `Na__LeDim__`. **It must be checked against a screenshot
of the same sheet in the editor before any of this is shown to a client.** It is
flagged in that file's header.

---

## 5. Phasing

| Phase | What | Done when |
|---|---|---|
| 0 | Free `52` and `53` at root: move SitePlanData and ProjectQrCode into the editor (2.0) | **DONE 23-Sep-2026** (Option 2: also emptied and removed `90__System__PageLayoutSystem`, vendors into the version-locked folder). Every import resolves, the QR and site plan test harnesses pass. |
| 1 | `53__Data__Layout__PublishedSchema` and the example folder as the fixture | **DONE 23-Sep-2026.** `Na__Test__PublishedSchema__` - 49 checks. Every path the module builds is a real file in the example, every tier size reproduces the example's own figures, every raster file is the size its manifest promises, the version gate refuses newer and older, and no file in the folder is unaccounted for. |
| 2 | `52__System__Layout__PublishedDocuments`, reading the example folder from disk | **DONE 23-Sep-2026.** `Na__Test__PublishedReader__` - 49 checks. All three published documents build; published dimension strings, area square metres and pre-wrapped note lines appear verbatim; the tier ladder steps up, holds one tier, respects a byte budget and never re-asks a failed tier; and the import walk proves no renderer is reachable. |
| 3 | The unpublished mask, **wired into** `80__Feature__WebViewer` | **DONE 23-Sep-2026.** The viewer shows published drawings only; 0 WebGL draw calls and 0 snapshot renders opening D02, D03, D06 and D10 with authoring locked (the active-sheet path that still rendered was found and closed); tiers swap on zoom; the PDF button downloads the baked PDF. |
| 4 | `65__Feature__DocumentPublishing`, writing locally only | **DONE 23-Sep-2026.** RB05 D01, D02 and D06 published locally with no failures; the reader harness pictures match the drawings; re-publishing overwrites and prunes. |
| 5 | Transport: R2, the scoped purge, the archive zip, the service worker cache | **BUILT, NOT YET RUN AGAINST R2.** Done when a published pack reads correctly on an iPhone from a cold cache. |
| 6 | Release the 3D scene on entering a drawing tab | Thirty tab changes on an affected device settle to a bounded footprint |

Phases 1 to 3 touch no authoring code at all. Phase 4 is additive: a new folder, a new
button, and no change to any existing save path.

**Phase 0 is the exception and should be treated as its own piece of work.** It rewrites
import paths inside the editor, so it changes authoring code even though it changes no
authoring behaviour — and a mistyped relative path there is a module that fails to load.
It is a folder move, it is verifiable by running the exports check and the two test
harnesses, and it must be finished and proven before anything else starts rather than
carried alongside it.

**Nothing in this plan changes the authoring renderer.** The audit's immediate
recommendations — smaller mobile raster budgets, fewer samples, a byte-bounded sheet cache
— are about making the authoring renderer survive being used as a reader, which after this
work it is not.
