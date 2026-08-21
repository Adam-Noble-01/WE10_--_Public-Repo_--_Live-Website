# Noble CAD Audit Tools — Development Log
# =========================================================

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.8 — 21-Aug-2026 — The Real SketchUp Killer: Copied Layer Handles

The v0.4.6 dimension-block repair was necessary (the dims were genuinely
spec-invalid) but it was NOT what SketchUp was rejecting: a regenerated,
audit-clean export still failed. Found by brute-force bisection — variant
files import-tested live in SketchUp 2026 itself:

- Same file, real `$EXTMIN/$EXTMAX` → still fails (extents irrelevant)
- Same file minus the INSERT → still fails
- Same content ODA-round-tripped to DWG → imports (content fine)
- Same file, everything moved to layer `0` → imports
- Same file, layer table entries rebuilt fresh → imports
- **Same file, ONLY the copied layer entries' pointer attribs discarded →
  imports** ← the killer, isolated to three group codes

Root cause: ezdxf's Importer copies LAYER table entries verbatim — including
the SOURCE document's plot-style handle (group 390), material handle (347),
and 348. Those objects are never imported, so in the rebuilt export the
handles point at nothing. AutoCAD-family readers, ezdxf, and even the ODA
converter shrug at the dangle; SketchUp 2026 resolves the pointers and
rejects the ENTIRE file with its bare "Import Failed" dialog.

Fix: `_na_sanitise_imported_layer_entries()` discards those attribs on every
layer after `importer.finalize()`; ezdxf then re-emits its own valid defaults
(pointing at the new document's placeholder + Global material) at save time.
Verified end-to-end: the previously failing Negretti exports (SketchUp-strip
AND full audited) now import into SketchUp 2026 cleanly — 1,244 lines, 134
arcs, 13 circles, 44 polylines on their proper layers.

Also: INSERTs whose block definition ends up EMPTY (content the Importer
could not copy, or annotation-only blocks emptied by the SketchUp strip) are
now dropped and the empty definitions purged — they rendered nothing and
appeared in SketchUp's import summary as an ignored "X-Ref", which read like
data loss. Export stats gain `emptyInsertsDropped`.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.7 — 21-Aug-2026 — Saved Projects: Open Button Was Off-Screen

Saved Projects listed every project and version but offered no visible way to
open one. The Open buttons were being rendered all along — they were simply
scrolled out of sight. `Na__ProjectManager__Table` ran on `table-layout: auto`
with no width cap on the Project column, and studio project names use `__`
separators with no spaces, so they cannot wrap: the longest name
(`CorbelDrawing__ElevationsViews__VolutedCorbel__AcanthusEnrichment__0.1.0__`)
forced that one column to 477px. Measured in the live app, the table's
scrollWidth was 1017px inside an 860px card, pushing Removed and the Open
column ~160px past the right edge. `.Na__ProjectManager__TableScroll` sets
only `overflow-y: auto`, and CSS promotes the other axis from `visible` to
`auto`, so the overflow hid behind a horizontal scrollbar nobody looks for.

Fix: the table is now `table-layout: fixed` driven by a `<colgroup>` (Version
78px, Saved 152px, Source 200px, Removed 84px, Action 96px; Project takes the
remainder), so column widths no longer depend on content length. Project and
Source cells clip with an ellipsis and carry the full string as a `title`
tooltip, the Saved timestamp no longer wraps to three lines, the card widened
860px → 940px, and `overflow-x: hidden` guarantees the Action column can never
be scrolled out of reach again. Rows also respond to double-click as a second
route to open, matching normal file-browser behaviour.

Verified in the running app: horizontal overflow 0px, all 15 Open buttons
on-screen at full width down to a 720px card, and opening CAD Negretti v001
loaded 1,437 entities with status “Opened CAD Negretti v001”. The backend
(`/api/projects`, `/api/open-project`) was never at fault.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.6 — 21-Aug-2026 — SketchUp Import Fixed + Export to SketchUp Button

Exports stopped importing into SketchUp after the clean-rebuild update. Root
cause: ezdxf 1.4's `Dimension.copy()` discards the anonymous `*D` geometry
block reference and stashes the block's content on the copy, expecting
`post_bind_hook()` to rebuild a real block when the copy is bound — but the
Importer addon binds copies via `entitydb.add()`/`add_entity()`, which never
fires that hook. Every exported DIMENSION therefore shipped with group 2
EMPTY and zero `*D` blocks (the Hamilton export: 4,399 of them, confirmed by
`ezdxf.audit` as 4,399 × UNDEFINED_BLOCK). That violates the DXF spec, and
SketchUp's ODA-based importer rejects the whole file on it. AutoCAD-family
viewers regenerate dimension graphics from the definition, which is why the
break only surfaced in SketchUp.

Fix in `na_export_audited_dxf`: after `importer.finalize()` the export now
fires `post_bind_hook()` by hand for every imported dimension (modelspace and
nested block definitions), rebuilding all `*D` blocks, then runs a final
`out_doc.audit()` so an irreparable entity is removed rather than shipped.
Verified on the failing drawing: 4,399/4,399 dim blocks rebuilt, strict
reload + audit clean (was 3 MB broken → 12.94 MB valid; the missing bulk WAS
the dimension geometry).

NEW — Export to SketchUp button (Ctrl+Shift+E, default filename
`Audited__SketchUpExport__<name>__.dxf` per studio prefix convention): same
audited export, plus every annotation/markup entity stripped — TEXT, MTEXT,
DIMENSION, LEADER, MULTILEADER, ATTDEF/ATTRIB, TOLERANCE, ACAD_TABLE,
WIPEOUT, POINT, HATCH — from modelspace AND from inside every surviving block
definition (furniture blocks carry their own labels). List is configurable
via `Config__DxfExport.SketchUpStrip__EntityTypes`. `/api/export-write` gains
`stripAnnotations`; stats/status report `annotationsStripped` and
`dimBlocksRepaired`. Measured on the Hamilton concept: 7,432 → 1,644 entities
(5,793 annotations stripped), 0.42 MB, geometry-only, audit clean.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.5 — 19-Aug-2026 — Background Doc Warming

Cold exports kept coming back: the RAM document cache is a single slot, so a
server restart empties it and importing a DIFFERENT drawing evicts it — the
next export of anything else paid the full ~16s file read again. Imports served
from the payload cache (the instant ones) never parsed at all, so they never
warmed the slot either.

`na_warm_doc_cache_async()`: a payload-cache-hit import now kicks off a
background daemon thread that parses the file and fills the slot — by the time
the drawing has been looked at, Export is warm (~3s). Guarded by an in-flight
set (no duplicate parses), the 256 MB file cap, and the existing fingerprint
check. Measured: cached import 0.02s → warm complete ~15s later → export 2.6s.

Also performed a full cache purge (payload caches, conversion sidecars,
__pycache__, and 114 MB of stale July `__export.dxf` leftovers). NOTE: purging
conversion sidecars means the next import of each DWG reconverts once.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.4 — 19-Aug-2026 — MTEXT Codes Stripped + Sane Text Hit Boxes

Titles rendered as `{\LScheme 1 - AE - 13/08/2026}` and note blocks hijacked
selection anywhere near them. Two halves of one bug:

- **Server**: the MTEXT serialiser used the `.text` ATTRIBUTE believing it
  strips inline codes — that is `plain_text()`, a METHOD. Raw `{\L…}` /
  `\P` codes leaked to the canvas. Both MTEXT and TEXT now serialise via
  `plain_text()` (guarded), MTEXT paragraphs arrive as real newlines, and MTEXT
  finally carries its `rotation` (never serialised before). Payload cache
  bumped v2→v3 so stale text re-parses.
- **Frontend**: the text hit box was `full-string-length × height × 0.6` —
  computed from the raw multi-paragraph string with codes, producing one
  enormous phantom rectangle whose outline the click hit-test measured
  distance to. Now sized from the LONGEST LINE, with per-line vertical extent
  matching the renderer. Renderer gained real multiline output (one tspan per
  '
' line, 1.4× line spacing, kept in sync with the bbox estimate).

### Open Existing Project — start-screen button (user request)

The start-up drop card now pairs **Open CAD File** with an **Open Existing
Project** button that raises the same saved-project browser as the header's
Load File / Ctrl+O — the modal already stacks above the upload overlay
(z-index 220 vs 100), and `Na__ProjectManager__Open()` has no loaded-file
dependency, so it works from a cold start. The two buttons sit side by side
in a new `.Na__Upload__Actions` flex row (which cancels the card's
auto-centre margin on `.btn`). Wired inside `Na__App__WireLoadFileButton`
so all three entry points share one handler.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.3 — 19-Aug-2026 — Warm Exports: 30s → 3s

**Export via the API: 15.6s cold → 3.0s warm (6x). After a fresh import the
first export is already warm.**

### Why export was still ~30s

Every export re-opened the full 111 MB working DXF from disk — a ~16s ezdxf
parse — even though the server had already parsed that exact file at import.
(Exporting the viewer's entity JSON directly was considered and rejected: it is
deliberately lossy — blocks exploded, splines flattened, hatch patterns
dropped, coordinates rounded — so a DXF built from it would be degraded.)

### Parsed-document RAM cache

Single-slot cache of the most recently parsed document, fingerprinted by the
file's size+mtime:

- **Stashed** after any full parse — at import (cold payload path) and at a
  cold export — so the expensive read is only ever paid once per file state.
- **Export never mutates it**: survivors are FILTERED into the fresh output
  document via `Importer.import_entities()` instead of deleting from the
  source, so the slot stays valid across unlimited exports. Verified: two
  consecutive exports byte-identical; export with 5 user deletions correctly
  5 entities smaller; a bare mtime touch invalidates the slot.
- The full-document fallback path (RebuildCleanDocument=false) mutates, so it
  parses its own fresh copy and never touches the cached one.
- RAM cost is real: ~6–7x file size (measured 712 MB for the 111 MB DXF), so
  the slot is capped at `SourceCache__MaxFileMb` (256) and holds ONE document.
  `SourceCache__Enabled: false` disables it.

### Spline-edge fix reached the region detector

The v0.4.2 SplineEdge fix also applies to standards containment:
spline-edged hatches inside the border previously crashed the extent test and
fell through as "import as normal" — 208 additional standards entities are now
correctly excluded (181,510 total on Test-01; export 4.26 MB, 10,733 entities).

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.2 — 19-Aug-2026 — Launcher Reset by Default + Spline-Edge Hatch Fix

### The .bat "stopped working"

v0.4.1's port guard made a held port refuse by default, with `-r` to take over
— but the launcher's primary use is DOUBLE-CLICK, which cannot pass flags. So
while any instance was alive, every double-click printed the refusal banner and
sat at `pause`, where the first keystroke closed the window ("typing closes the
console"). `Na__LocalServer__Main__.bat` now passes `-r` itself: double-click =
kill whatever holds port 8007, start fresh on current code. **This is now THE
way to restart the server.** The bare `python Na__LocalServer__Main__.py` keeps
the protective refusal for scripted launches; the login VBS is unchanged.
Verified headless: deps check → killed the old PID → reclaimed → served.

### Spline-edge hatches were silently dropped

Live-log find during the bat test (Test-04 upload): ~80 HATCH entities failed
with `'SplineEdge' object has no attribute 'start'` and vanished from the
viewer. Cause: edge-type dispatch used substring checks and `'LINE' in
'SPLINE'` is TRUE, so spline boundary edges hit the straight-line handler.
Fixed in BOTH edge walkers (`na_hatch_path_vertices` in the DxfEngine and
`na_hatch_extent` in the StandardsRegion detector): SPLINE tested first and
approximated from fit/control points, plus a proper ELLIPSE-edge branch
(param-sampled, rotated) that previously fell through silently. Verified:
spline / arc / ellipse edged hatches all extract geometry + extents.
`_PAYLOAD_CACHE_VERSION` bumped v1→v2 so payloads cached with missing hatches
re-parse instead of being served stale.

### Import CAD File — header button (user request)

New **Import CAD File** button in the top bar (first in the controls group,
left of Load File) + `Ctrl+I`. Until now a DWG/DXF could only be imported via
the start-up drop overlay — once a file was open the only routes to a new
import were Open-With or a page reload. The button calls the new
`Na__UploadPanel__OpenFilePicker()` (clears the input value first so the same
file can be re-imported) and reuses the whole existing pipeline: native picker
→ `/api/upload` → progress overlay → image decision → render. Importing while
a drawing is open replaces it (EntityLoader clears state on load). Binding
added to the keybindings JSON SSOT as `ctrl+i → file:import-cad`.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.1 — 19-Aug-2026 — Export Fixed: 106 MB → 5.4 MB

**Export of the audited Test-01 drawing: 106 MB → 5.35 MB, audit-clean, and it
round-trips back into the app with exactly the entities the viewer shows
(4,915 / 9 layers).**

### Why the export was 100 MB when the viewer showed a few boxes

Three compounding causes, all measured:

1. **Standards content was still in the export.** The exclusion is an import
   filter — the working DXF on disk keeps all 181,302 standards entities, and
   `na_prune_and_save_dxf` removed only the user's soft-deleted handles before
   re-writing everything. 106 MB, 13.4s write.
2. **4,505 of 4,518 block definitions were orphaned.** After standards pruning
   only ~5 blocks are referenced by surviving INSERTs, but the BLOCKS section
   (3.5M lines) was written out wholesale.
3. **The internal `__export.dxf` scratch copy was never deleted** — the temp
   cache was hoarding 215 MB of stale exports.

### What was tried and rejected

- **In-place block purge via INSERT-graph analysis** — crashed `saveas`:
  DIMSTYLE table entries hold handle references to arrowhead blocks
  (`_Oblique`, `Inset Gutter Detail$1$_Oblique`), which no INSERT references.
- **In-place purge via `ezdxf.blkrefs.BlockReferenceCounter`** — safe (saved,
  reopened, audit-clean) but only reached **30.8 MB**: dynamic-block extension
  dictionaries and dead standards blocks referencing each other keep ~4,400
  definitions "referenced" forever.

### What shipped — rebuild instead of purge

`na_export_audited_dxf()` in the DxfEngine:

1. Delete the user's soft-deleted handles (as before).
2. Delete everything inside the standards marker border — same detection as
   import, so **the export matches the viewer**.
3. Rebuild into a **fresh document** via `ezdxf.addons.Importer`
   (`import_modelspace` + `finalize`), which copies only surviving entities
   plus resources they actually reference. Key header vars ($INSUNITS,
   $MEASUREMENT, $EXTMIN/MAX, …) are carried over.
4. `/api/export-write` deletes the scratch `__export.dxf` after the OS-copy.

Measured: parse 16s + standards sweep 4s + rebuild 0.6s + write 0.5s ≈ 21s
server-side (28s end-to-end via the API), 5.35 MB out.

### Trade-offs (config-gated in new `Config__DxfExport`)

- Rebuild is **modelspace only** — paperspace layouts are not carried over.
- DIMASSOC objects are dropped → dimensions become **non-associative**.
- Types the Importer cannot copy are skipped and **reported**, not silent:
  on Test-01 that was 17 REGION (ACIS solids the viewer never rendered) and
  5 MULTILEADER. Counts are returned in the response and shown in the
  status-bar hint.
- `RebuildCleanDocument: false` → full-fat document write (standards exclusion
  still applies); `ExcludeStandardsRegion: false` → old behaviour entirely.

Save Project is **unchanged** — the versioned archive still carries the full
working file. Say the word if it should get the same treatment.

# ---------------------------------------------------------

## CAD Audit Tools | v0.4.0 — 19-Aug-2026 — Standards Region Exclusion + Import Performance

**Result on `Test-01__PurgeCad` (21 MB DWG): 230,923 → 4,915 entities, 43 → 9
layers, 181,302 entities never imported. Repeat load of the same file: 341 ms.**

---

### 1. The feature — standards library is ignored on import

Every studio concept drawing carries the **Concept Design Standards** library:
wall build-ups, window and door panels, hardware, cills, trees, cars, spec
notes. It is never wanted in an audit and it is the heaviest part of the file to
parse, explode and render — on the test file it is **94% of the drawing**.

The studio CAD template already fences it with a machine-readable marker:
**three nested rectangles, each offset ~100mm, in RGB(250, 215, 0)**.

New module `Na__LocalServer__StandardsRegion__.py`:

1. **Marker scan** — one cheap pass over modelspace collecting only LINE /
   LWPOLYLINE / POLYLINE whose resolved display colour matches the marker RGB
   (+/-8 per channel for converter drift). True colour, BYLAYER layer colour and
   plain ACI all resolve through the same path the serialiser uses.
2. **Ring recovery** — two independent routes (see section 2 for why).
3. **Nesting validation** — rings chained largest-to-smallest; a chain qualifies
   only at **3 deep AND all four edge gaps within 95-105mm**. That double
   condition is what stops an unrelated yellow rectangle triggering it.
4. **Region** = outermost ring's bbox, padded 1mm so the rings self-exclude.

`Na__LocalServer__DxfEngine__.py` runs detection **before** the serialisation
loop and tests every entity as the loop's first statement. Contained entities
are skipped outright — not parsed, not serialised, not counted in any layer.

**INSERTs are rejected on their insertion point**, so `virtual_entities()` never
runs for standards blocks — that is where the load-time saving comes from, since
the library is almost entirely block references. `na_explode_insert()` also
re-tests exploded children as a backstop for a block placed outside the border
that draws content inside it; an INSERT left with nothing but filtered children
is dropped too.

Fail-safe: no qualifying border = nothing excluded, import behaves as before.
`Config__StandardsRegion.Enabled: false` turns it off.

---

### 2. The bug that made v1 detect nothing

First implementation found **zero** regions on real drawings. Cause, read
straight out of the file:

| | bbox | gap |
|---|---|---|
| ring 1 | (0, 0) -> (125000, 95000) | — |
| ring 2 | (100, 100) -> (124900, 94900) | 100 |
| ring 3 | (200, 200) -> (124800, 94800) | 100 |
| caption box | (200, 92800) -> (14300, 94800) | — |

The template's "Concept Design / Standards" caption box has its corner at
**(200, 94800)** — the *same point* as ring 3's top-left corner. Ring assembly
grouped marker segments into connected components by shared endpoints, so it
welded caption and ring 3 into one 8-segment blob whose total length ran 7.3%
over its bounding-box perimeter. That failed the 5% "clean rectangle" test, ring
3 was discarded, and 2 rings is below the 3 required — so no region at all.

**Fix — two independent recovery routes:**

- **DIRECT**: a closed marker polyline whose vertices *are* the four corners of
  its own bounding box is a ring outright and contributes **no** segments to the
  grouping pool. It can never be fused with anything. Normal template case, now
  exact.
- **LOOSE**: only genuinely loose linework (borders drawn as four separate
  LINEs, open polyline chains) goes through connectivity grouping, and a
  component qualifies on **edge coverage** — all four bbox edges fully traced by
  segments lying along them — rather than total length. Extra interior segments,
  duplicated linework and shapes touching a corner are ignored, not fatal.

Verified against the real coordinates: 3 rings -> 1 region, offsets [100, 100].
Also verified for a border drawn entirely as loose LINEs, and a mixed case.
Confirmed it does **not** trigger on: 2 rings, 3 rings at 50mm offsets, a lone
yellow rectangle, or no marker colour.

---

### 3. Import performance

Baseline: 21 MB DWG -> 111 MB ASCII DXF (~3 min conversion), then a full ezdxf
parse, then ~60 MB of JSON, then one SVG DOM node per entity.

**Conversion cache.** `na_convert_dwg_to_dxf` computed a deterministic output
path then unconditionally re-ran the converter — every re-import paid the full
3 minutes again. Each converted DXF now gets a JSON sidecar
(`<name>.dxf.na-src.json`) recording the DWG's **content digest** + size +
target DXF versions, plus the converted DXF's own size/mtime. Content not mtime:
the upload rewrites the DWG at a fixed path every import, so mtime is always
"now" and would never hit. The output half is not optional — the converted DXF
*is* the working file, and image-purge and hard-delete rewrite it in place;
without that check a re-upload would hand back a previously pruned file.

**Parsed-payload cache.** After a successful parse the payload is stored gzipped
beside the working DXF (`<name>.dxf.na-payload.json.gz`), keyed on that DXF's
size + mtime plus a digest of every setting affecting payload content, and a
`_PAYLOAD_CACHE_VERSION` constant so a future code change to payload semantics
can invalidate old caches. A reload of an unchanged file skips ezdxf, block
explosion and serialisation entirely. Not used for drawings with embedded
images — those need the interactive keep/purge decision.

**Payload trimming — new `Config__EntityPayload`:**
- Coordinates rounded to 3dp (`12345.678901234567` -> `12345.679`) — sub-micron
  on a mm drawing, halves the length of every number. `-1` disables.
- `color` / `linetype` dropped when BYLAYER. Only the Properties panel reads
  them and it already defaults to `'BYLAYER'` when absent.
- gzip `after_request` on JSON only, never on `direct_passthrough` downloads.
  **Measured 42x** on entity-shaped JSON.

**ODA audit flag.** `OdaConverter__AuditFiles` and
`OdaConverter__RecurseSubfolders` were config keys `na_load_conversion_settings()`
never returned, so the ODA command line hardcoded `audit=1` — a full repair pass
on every fallback conversion, unskippable. Both now read; **audit defaults to
`false`**. Turn it back on if a legacy DWG will not convert cleanly.

**Spatial index — `Na__CommonUtils__SpatialIndex__.js`.** Click / box / lasso
select each walked **every** entity on every interaction. Uniform grid (~256
cells across the drawing), built once in EntityLoader, rebuilt by EntityPruner
after hard delete/undo. Entities spanning more than 64 cells go to an
always-considered oversized list rather than bloating every cell.

Window mode needs care: a unit is only "fully enclosed" if none of its parts
sits outside — including parts the rectangle never touched, which a naive query
would never visit. `Na__SpatialIndex__ExpandToWholeUnits()` widens candidates
from "parts near the rectangle" to "all parts of the units near the rectangle"
via a unitHandle -> parts map. Validated against brute force over 600 randomised
window/crossing queries on a 5,201-entity fixture with multi-part blocks and a
drawing-spanning border: **identical results on all 600**, 69x fewer entities
examined, zero point-query misses. Every consumer falls back to a full scan if
the index is unavailable.

**Binary DXF — measured and rejected.** ezdxf 1.4.3, 60,000-entity document:

| format | size | write | read |
|---|---|---|---|
| ASCII | 10.1 MB | 1.30s | 1.62s |
| binary | 6.4 MB | 1.48s | **2.15s** |

37% smaller but **33% slower to read** — ezdxf's cost is entity object
construction, not tag text parsing. Adopting it would have made imports worse.
The parsed-payload cache achieves what it was meant to achieve instead.

---

### 4. Not a deletion

Standards content is *ignored on import*, not removed. The working DXF on disk
is untouched, so Save/Export still carry it. Shift+Delete remains the way to
physically prune.

---

### Still outstanding

**One SVG DOM node per entity** is the remaining first-load cost and the reason
pan/zoom stays heavy on very large drawings. Moving to Canvas 2D rendering is a
genuine rewrite of the render layer — 11 per-type renderers plus selection
highlight, layer visibility, hard-delete removal and the dimension overlay all
currently work through the DOM. Worth doing as its own focused change.

Also open: `na_collect_and_drop_result` defined but never called (a finished job
holds its full payload until the stale sweep); layer visibility toggling via a
whole-tree `querySelectorAll`; `TempCache__MaxFiles` dead so the temp cache is
never trimmed.

---

### Server port guard (side fix)

`Na__LocalServer__Main__.py` gained a single-instance guard and a `-r` /
`--reset` flag — a held port now refuses loudly naming the owning PID, or with
`-r` kills the owner and takes the port. Detection probes with
`SO_EXCLUSIVEADDRUSE` because Werkzeug binds `SO_REUSEADDR`, which let second
instances bind successfully while never receiving a request.

# ---------------------------------------------------------

## CAD Audit Tools | v0.3.5 — 08-Jul-2026 — Native Export Flow, Load-File Project Manager, Stale-JS Fix

### Export DXF — native folder picker + write-once-then-copy + progress (user requests 1 & 2)

- The Export button no longer triggers a blind browser download. New flow:
  1. `POST /api/export-pick` opens the **native OS Save-As explorer** so the user
     chooses exactly where the DXF lands. The Tk dialog runs in an **isolated
     subprocess** (`Na__LocalServer__NativeDialogs__.py`) — tkinter is not
     thread-safe and Werkzeug serves each request on its own worker thread, so a
     dedicated process sidesteps every "main thread is not in main loop" pitfall.
  2. `POST /api/export-write` **writes the pruned DXF once** to the internal export
     cache (the app's own working copy) then `shutil.copy2`s that single file to
     the chosen destination — geometry is serialised once, then OS-copied.
- The shared `Na__UI__ProgressOverlay` now animates through the export with staged
  messages ("Waiting for save location…" → "Writing and copying…" → "Complete"),
  matching the upload/convert loading graphic. Added `exporting`/`copying`/`loading`
  stage titles.

### Load File — saved-project manager modal (user request 3)

- New **Load File** button + `#Na__App__ProjectManagerOverlay` modal, styled like
  the ValeSpec Project Manager (dark table: Project · Version · Saved · Source ·
  Removed · Open), with a live filter and Refresh. New `Na__UI__ProjectManager__.js`.
- `/api/projects` enriched with per-version metadata (saved date, source file,
  deleted count, dimension count) read from the JSON sidecar, newest-first.
- New `POST /api/open-project` copies the archived DXF into the temp cache as a
  **fresh working copy** (the saved version is never mutated by later edits),
  parses it, and returns saved dimensions so annotations are restored on load.

### Top bar cleanup (user request 4)

- Removed the `L→R Window / R→L Crossing` legend from the header — the guidance
  already lives in the status-bar hint where it belongs.

### Fixes surfaced during testing

- **UTF-8 stdout**: confirmed `na_force_utf8_console()` is wired in
  `Na__LocalServer__Main__.py` — the earlier `charmap` codec crash on `→`/`—` in
  server prints (which was killing `/api/export-*` and `/api/project-save`) came
  from a **stale server instance** started before that fix; a restart clears it.
- **Stale JS after edits**: the PWA service worker was cache-first
  (stale-while-revalidate), so code changes needed two reloads to appear. Rewrote
  `Na__ServiceWorker__CadAuditTools.js` to **network-first for app code**
  (HTML/JS/CSS/JSON), cache-first only for icons/fonts/manifest. Cache bumped to
  **v4**; precache list refreshed to the current module set. Edits now show on the
  first reload.

### Verification

- `.claude/launch.json` added (Flask server, port 8007); server restarted via the
  launch config.
- End-to-end tested: `project-save` (v001 written), `export-write` (22 KB file
  copied to destination), `open-project` (113/118 entities, 1 dimension restored,
  fresh working copy). Load-File modal renders 6 saved projects with correct
  metadata; opens on a single reload post-SW-fix; no console errors.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.6 — 07-Jul-2026 — Fixed Shift+Delete "Not Working" (Duplicate Stale Servers)

### Symptom

- Shift+Delete appeared to do nothing after the v0.0.5 hard-delete feature was
  shipped, despite the keybinding, HotkeyManager, and `EntityPruner` wiring all
  checking out correctly on code review.

### Root Cause — two server processes running at once

- Found **two** `Na__LocalServer__Main__.py` processes alive simultaneously:
  one auto-started `--silent` instance and one started manually from a
  terminal. Only one process can actually hold port 8007, so which process
  (and therefore which version of the route code) was really answering the
  browser's requests was ambiguous — the exact same class of "stale server"
  issue that previously broke `/api/upload` earlier in this project (fixed by
  a restart at the time).

### Fix

- Killed both `Na__LocalServer__Main__.py` processes (including the silent
  one) and confirmed port 8007 was fully released before starting a single
  fresh instance.
- Verified the fix live with the browser automation tool: loaded the app,
  opened the `CAD__Test__StandardBuilding__0.1.0__.dxf` fixture via
  `/api/open-local`, and confirmed a clean response with the correct entity
  count — then confirmed Shift+Delete now works end-to-end.

> **Reminder:** the dev server runs with `use_reloader=False`, and a silent
> auto-start instance can be running in the background. After pulling/making
> server-side changes, make sure **all** `Na__LocalServer__Main__.py`
> processes are stopped (check for a `--silent` one too) before starting a
> fresh one — otherwise a stale process can keep answering on port 8007.

# ---------------------------------------------------------

## CAD Audit Tools | v0.3.4 — 07-Jul-2026 — Open-With Opens the PWA App (Fix + Native Handlers)

### Problem — right-click "Open with" opened a browser tab and the PWA was un-installable

- The Windows Open-With launcher ran `shell.Run appUrl`, which handed the URL to
  the default browser as an ordinary tab — not the app.
- The PWA manifest lived at `03__AppModules/62__Feature__AppInstallability/`, so
  its `start_url`/`scope` (`"./…"`) resolved **relative to that nested folder** →
  a 404 start URL and a wrong scope. The PWA could not install/launch correctly.
- The referenced icon assets (`01__AppAssets__CadAuditTools/…192/512.png`) did
  not exist, breaking installability and leaving the right-click entry blank. The
  installer also assigned a `.png` to the shell-verb `Icon`, which Windows shell
  verbs cannot render (they need an `.ico`).

### Manifest — fixed + native file/protocol handlers

- `Na__AppInstallability__Manifest.webmanifest`: `start_url`/`id` → `/Na__App__.html`,
  `scope` → `/`, icon `src` → root-absolute `/01__AppAssets__CadAuditTools/…`.
- Added `file_handlers` (`.dxf` → `image/vnd.dxf`, `.dwg` → `image/vnd.dwg`) so an
  installed PWA is registered by Edge/Chrome in the Windows "Open with" list.
- Added a `web+noblecad` `protocol_handlers` deep-link entry.

### Icons — generated Noble-branded asset set

- New `01__AppAssets__CadAuditTools/` with `…Icon__192x192.png`, `…Icon__512x512.png`,
  and a multi-resolution `…Icon__.ico` (16–256 px) for the shell verb.
- Regeneratable via `01__AppAssets__CadAuditTools/Na__WinIntegration__GenerateIcons__.py`
  (Pillow) — swap in a real source logo and re-run.

### Launcher — chromeless app window (Path A, robust)

- `Na__WinIntegration__OpenWith__.vbs`: new `Na__LaunchAppWindow` opens Edge then
  Chrome with `--app="http://127.0.0.1:8007/Na__App__.html?openFile=<path>"`
  (browser resolved via `App Paths` registry + standard install locations),
  falling back to the default browser only if neither is found. Server
  health-check/auto-start is unchanged, so the file loads via `/api/open-local`.

### Installer — icon fix

- `Na__WinIntegration__InstallOpenWith__.ps1`: ProgID `DefaultIcon` and the shell
  verb `Icon` now use the `.ico`. Summary notes the labelled entry is the direct
  right-click verb (the greyed row in the *Open-with submenu* is a Windows quirk
  of script-host ProgIDs).

### Frontend — installed-PWA file handler (Path B, native)

- `Na__App__Main__.js`: new `Na__App__HandleLaunchQueue` consumes `window.launchQueue`;
  a launched file handle is read and routed through the existing
  `Na__UploadPanel__HandleFile(file)` pipeline (bytes → `/api/upload` → render).
- Note: Path B needs the PWA installed *and* the server already running (the
  launchQueue path does not auto-start the backend); Path A remains the dependable
  everyday route.

### Service worker

- Cache bumped `v2` → `v3`; PWA icons added to the pre-cached app shell.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.5 — 07-Jul-2026 — Undoable Hard Delete (Shift+Delete)

### Goal — shrink the working file to speed up very large drawings

- `Delete` / `Backspace` remain a **soft** delete: entities are faded and
  tracked in `deletedHandles` but stay in the working file until Save/Export.
- `Shift+Delete` / `Shift+Backspace` are a new **hard** delete: the selected
  units are physically removed from the WORKING DXF on disk. On files with
  tens of thousands of entities this keeps every subsequent load/parse/render/
  save cycle fast, because the working file itself gets smaller.
- Hard delete is fully **undoable** via a server-side backup of the working
  file taken immediately before each prune.

### Server — backup/restore + prune-in-place

- `Na__LocalServer__ProjectCache__.py`: added `na_create_working_backup()` /
  `na_restore_working_backup()` — copy the working DXF to
  `04__LocalProjectCache/05__WorkingFileBackups/` under a UUID token before a
  prune, and copy it back on undo. Oldest backups are trimmed beyond
  `WorkingBackups__MaxFiles` (default 40).
- `Na__LocalServer__ApiRoutes__.py`: new routes —
  - `POST /api/prune-working` `{ tempDxfPath, handles[] }` → backs up, then
    calls the existing `na_prune_and_save_dxf()` **in place** (saves back over
    `tempDxfPath` itself, not a separate export file). Returns `{ removed, backupId }`.
  - `POST /api/restore-working` `{ tempDxfPath, backupId }` → restores the
    backup over the working file. Returns 404 for an unknown/expired backup.
- Added `Config__ProjectCache.WorkingBackups__Path` / `WorkingBackups__MaxFiles`.
- Verified server-side with a scripted test: prune → restore round-trip, and a
  two-operation LIFO undo chain (restore B then restore A brings back exactly
  the right entities in the right order) — both passed.

### Frontend — incremental model/canvas edits + new EntityPruner module

- `Na__CadEngine__Canvas__.js`: extracted the render loop into a shared
  `_buildEntityFragment()`; added `Na__CadCanvas__AddEntities()` and
  `Na__CadCanvas__RemoveEntitiesByHandles()` so a hard delete/undo never
  triggers a full re-render — critical for staying fast on huge files.
- `Na__AppCore__UndoManager__.js`: added a generic
  `Na__UndoManager__PushCommand()` entry point so feature modules can register
  their own undo/redo commands without a dedicated `Record*` wrapper.
- `Na__UI__ProgressOverlay__.js`: `Show()` now accepts `{ allowCancel }` —
  hard delete shows the overlay without a Cancel button (it's quick and
  always undoable); errors still force the button visible so they stay
  dismissible.
- New `Na__CadEngine__EntityPruner__.js` — orchestrates the whole feature:
  resolves the selection to unit handles, awaits `/api/prune-working` BEFORE
  touching the local model (so a failed prune never desyncs the UI from disk),
  then removes from `AppState.entities`/`entityByHandle`, the SVG canvas, and
  decrements per-layer counts. Pushes a `hard-delete` command whose `undo()`
  restores the backup + re-adds the records, and whose `execute()` (redo)
  re-prunes and re-removes, taking a fresh backup each time.
- `Na__UI__LayersPanel__.js` now listens for a new `layers:refresh` event to
  keep per-layer entity counts accurate after a hard delete or its undo/redo.
- Keybindings SSOT: added `shift+delete` / `shift+backspace` → `edit:hard-delete`.

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.4 — 07-Jul-2026 — Async Upload with Progress + Cancel

### Problem — large projects appeared to "time out"

- The old `/api/upload` route did the entire DWG→DXF conversion and DXF parse
  **synchronously inside the request**, so large drawings blocked with no
  feedback and looked like a browser timeout.

### Server — background job model

- New `Na__LocalServer__JobManager__.py`: thread-safe registry of upload jobs,
  each carrying a live `stage / message / percent`, a `result` payload, and a
  `threading.Event` for cancellation. Finished jobs are swept after 15 min.
- `/api/upload` now saves the upload, spawns a **daemon worker thread**, and
  returns `202 { jobId }` immediately (no blocking).
- New `/api/upload-status/<jobId>` (GET) returns live progress and, on
  completion, the entity JSON in `result`.
- New `/api/upload-cancel/<jobId>` (POST) signals cancellation.
- `na_load_cad_file_to_entity_json()` gained optional `progress_cb` +
  `cancel_event`, reporting stages: `converting → parsing → finalising`.
- `Na__LocalServer__DwgConversion__.py`: conversions now run through
  `_na_run_cancellable()` (Popen + poll) so a Cancel **terminates the running
  ezdwg/ODA subprocess** instead of waiting out the timeout.
- Flask dev server now runs `threaded=True` so status polls are served while a
  conversion job runs on its worker thread.
- Added `Config__Upload` to the app config (poll interval, cancel toggle).

### Frontend — progress overlay + cancel

- New `Na__UI__ProgressOverlay__.js` + overlay markup/CSS: spinner, stage title,
  live server message, determinate/indeterminate progress bar, elapsed clock,
  and a Cancel button.
- `Na__UI__UploadPanel__.js` rewritten: XHR upload with live upload %, then polls
  the job status and drives the overlay; Cancel aborts the upload or calls
  `/api/upload-cancel`. Falls back to a legacy `200`-with-payload response so it
  works even before the server is restarted.
- Windows Open-With (`?openFile=`) also shows the overlay with a client-side
  `AbortController` cancel.

> **NOTE:** the local server runs with `use_reloader=False` — **restart it** to
> pick up the new async routes (a stale server returns `200` instead of `202`).

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.3 — 07-Jul-2026 — Legacy DWG Fallback Hardening

### DWG Conversion — Auto-detect ODA File Converter install path

- `ezdwg` cannot read legacy DWGs below R14 (e.g. **R12 / AC1009**); these must use the ODA fallback.
- Added `na_resolve_oda_exe_path()` in `Na__LocalServer__DwgConversion__.py`:
  - Uses the configured `OdaConverter__ExePath` first if it exists on disk.
  - Otherwise globs standard `Program Files` install roots for version-numbered folders
    (`ODAFileConverter <ver>\ODAFileConverter.exe`), picking the highest version found.
  - Means installing ODA File Converter now works with **zero config edits**.
- Clearer failure message telling the user to install ODA for legacy DWG support.
- Updated `Config__DwgConversion._description` to document auto-detection.

### DWG Conversion — Fixed ODA "output folder must differ from input folder"

- ODA File Converter operates on folders and rejects the job when the output
  folder equals the input folder (previous code set them equal).
- Added `na_prepare_oda_workspace()` which isolates the source DWG in a fresh
  `__oda_work__/in` folder and converts into a separate `__oda_work__/out`
  folder, then relocates the resulting DXF beside the source and removes the
  scratch tree.
- Success is now judged by presence of the output DXF (ODA often returns a
  non-zero exit code even on success), with exit code/stderr surfaced on failure.
- Verified end-to-end on an R12 (AC1009) test file: ezdwg fails → ODA fallback
  converts → DXF parses cleanly (2077 entities).

# ---------------------------------------------------------

## CAD Audit Tools | v0.0.2 — 07-Jul-2026 — Core Systems Implemented

### DWG Conversion — Replaced ODA stub with `ezdwg` Python library

**Library chosen: `ezdwg[dxf]>=0.9.0`**

- MIT licence, Rust core + Python API, ships as a pre-built wheel — `pip install "ezdwg[dxf]"`.
- Supports DWG R14 through R2018 (AC1014–AC1032).
- Uses `ezdxf` as DXF write backend; exposes `ezdwg.to_dxf(input, output)` API.
- Added to `requirements.txt` as version-locked dependency.
- `na_convert_dwg_to_dxf_oda()` kept as an optional ODA File Converter subprocess fallback.

### DXF Engine — Full `ezdxf` implementation (`Na__LocalServer__DxfEngine__.py`)

- `na_parse_dxf_to_entity_json()` fully implemented.
  - Iterates modelspace via `doc.modelspace()`.
  - Entity types serialised: `LINE`, `ARC`, `CIRCLE`, `LWPOLYLINE`, `POLYLINE`, `TEXT`, `MTEXT`, `INSERT`, `POINT`, `SPLINE`, `ELLIPSE`.
  - ACI colours resolved server-side via full 256-entry `_ACI_MAP` dict → `hexColor` field on every entity.
  - Layer table built from `doc.layers`; per-layer `aci`, `hexColor`, `entityCount`, `visible` fields returned.
  - `BYLAYER` (ACI 256) resolves to layer colour; `BYBLOCK` (ACI 0) defaults to white.
- `na_prune_and_save_dxf()` fully implemented.
  - Loads source DXF, collects matching handles in one pass, deletes entities, saves with `doc.saveas()`.

### SVG Canvas Rendering — Full implementation (`Na__CadEngine__Canvas__.js`)

- `Na__CadCanvas__RenderEntities(entities)` implemented — renders all entity types as SVG elements.
- Y-axis flip: all Y coordinates negated at render time (DXF Y-up → SVG Y-down).
- `vector-effect="non-scaling-stroke"` applied to all entities — consistent 1px line width at all zoom levels.
- Entity renderers: `Na__CadRender__Line`, `Na__CadRender__Arc`, `Na__CadRender__Circle`,
  `Na__CadRender__Polyline`, `Na__CadRender__Ellipse`, `Na__CadRender__Text`,
  `Na__CadRender__Insert`, `Na__CadRender__Point`.
- ARC rendered as polyline approximation (48-segment default) — avoids SVG arc direction complexity.
- ELLIPSE rendered as polyline approximation supporting partial ellipse via `startParam`/`endParam`.
- INSERT rendered as crosshair + block-name label in drawing units.
- Uses `DocumentFragment` for batched DOM insertion performance.

### Geometry Helpers — Improved (`Na__CommonUtils__GeometryHelpers__.js`)

- ARC bounding box now computes tight bounds using actual sweep angles with `Na__Geom__ArcBounds()`.
  Samples axis-aligned extremes (0°, 90°, 180°, 270°) that fall within the sweep.
- TEXT/MTEXT bounding box now uses insertion point + approximate extent (height × char count × 0.6).
- ELLIPSE bounding box added using `rx`/`ry` fields.
- INSERT/POINT use a 0.5-unit tolerance box (previously degenerate point).
- `SPLINE` added as alias for LWPOLYLINE/POLYLINE path in switch.

### PWA Icon Assets Generated

- `01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__512x512.png` — 512×512, RGBA PNG, 13.7KB.
- `01__AppAssets__CadAuditTools/Na__CadAuditToolsApp__Icon__192x192.png` — 192×192, RGBA PNG, 6.2KB.
- Source: Noble Architecture logo fetched from `www.noble-architecture.com` CDN, resized with Pillow (LANCZOS).
- Placeholder `TODO__AddAppIcons__.txt` removed.
- PWA manifest icon paths already matched from v0.1.0 scaffold — no manifest update needed.

# ---------------------------------------------------------

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

