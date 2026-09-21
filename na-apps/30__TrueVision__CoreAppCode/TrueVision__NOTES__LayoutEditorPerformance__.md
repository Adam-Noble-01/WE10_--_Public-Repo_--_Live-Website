# TrueVision3D - NOTES - Layout Editor Performance (the Dimensioning Audit)
# =========================================================

**Status:** an audit with one fix and one new control BUILT (v2.136.0, 21-Sep-2026) and a list of what
could come next, none of which is built. **Written by:** the session that did the audit, from measurements, not from
reading the code and guessing.

---

## 1. What he asked, in his words

> Deeply audit my code for TrueVision 3D, the layout editor especially, and see why, when I'm
> dimensioning even in draft mode on this project, it's so painfully slow. It's really having to do
> lots of work, it feels like, just to draw a dimension and find the endpoint. Is it trying to test
> for too many snap points at once or something, or is it still rendering the 3D pipeline in the
> background without pausing? Are there any other obvious quick-win optimisations we can make? If
> not, what other options have we got for speeding things up? Can we come up with some kind of better
> 2D caching strategy when working, especially with the PWA app? Is there anything we can utilise
> WebGPU for in terms of the drawing stuff, like a faster graphics API? [...] I've only got the line
> work layer visible.

Six questions:

| # | Question | Answer |
|---|---|---|
| Q1 | Too many snap points tested at once? | No. The snap search is 0.07 ms a move (section 3). |
| Q2 | The 3D pipeline still rendering behind the sheet? | No. It is properly held (section 3). |
| Q3 | Obvious quick wins? | Two, both built: section 4 outright, section 5 as a choice (the Vector control). |
| Q4 | What other options? | Section 7, in the order they pay. |
| Q5 | A better 2D caching strategy, PWA especially? | Section 8. Holding the drawing (section 5) IS the 2D cache. |
| Q6 | Anything for WebGPU? | Section 9. A GPU linework layer, yes; WebGL 2 does it as well. |

---

## 2. How it was measured

Reading the code found the suspects; only measuring found the culprits, and one of the things the
code reading "found" (the snap marker repainting the plan) turned out not to matter.

- **The real app, the real sheet.** RB05 D10 Ground Floor Plan: one 2D viewport of 38,500 projected
  segments in 14 `<path>` elements, 73 vectors, 70 text items, 28 to 34 dimensions (Adam was adding
  them while the runs went: the repo copy of the project data changed under the harness at 18:01).
- **A real browser with a real GPU.** The system Chrome, headless, launched by Playwright.
  `chrome://gpu` confirms hardware rasterisation on this machine's RTX 3080 (ANGLE, D3D11), so
  paint and raster cost what they cost Adam. 1920 x 1080 at 150%. The Browser pane is no use for
  this: hidden, it never paints.
- **Real input.** Mouse moves, presses and wheel events through the DevTools protocol, so the
  handlers run as they do under a hand: one `pointermove` per frame.
- **A Chrome trace per run**, cut into phases by `performance.mark`: handler JavaScript
  (`EventDispatch`), style, layout, pre-paint, paint, layerize, raster tasks and GPU tasks, as
  milliseconds of work per second. Frame rate is the gap between animation frames.
- **Nothing written.** An init script refuses every request that is not a GET or the R2 read. No
  write was ever attempted, and each run left the sheet with the dimensions it arrived with.
- **Candidate fixes were tried without touching the working tree**: Playwright serves a patched
  copy of a module in place of the file (`page.route`), and injects a stylesheet. Only what proved
  out was then written to disk, and measured again from disk.

The harness lives outside the repo, in `D:/_ClaudeScratch/tv_perfaudit_out/`:

| File | What it does |
|---|---|
| `bench_live.py` | The Dimension tool's three phases (+ the landing click with `--commit`), `--draft`, `--zoom`, `--dense` (aims at the densest 20 mm of linework, found through the snap index), `--patch`, `--css`, `--rezoom`, `--shot` |
| `bench_nav.py` | Real wheel zoom in and out, the settles, and a pan |
| `equiv.py` | The same scripted editing session on two builds, the sheet list compared after every step |
| `visual.py` | Full-page screenshots of two stylesheets in four states, compared pixel by pixel |
| `visual_deep.py` | Adam's flow: a hold in place from Fit, REAL wheel notches in to 4x, 12x and 30x, sharpness held against not (`--rule=`) |
| `vq_check.py` | The Vector control through the toolbar's own select: fps, held or not while moving and at rest, rest screenshots against High (`--draft`) |
| `patches.py` | The candidate source patches, anchored (each anchor must occur exactly once) |
| `longtasks.py`, `summarise.js` | Read a saved trace: input events, long tasks, the per-phase table |
| `gpu_check.py` | Is headless Chrome getting the GPU on this machine |

It needs the no-store server on 8987 (`tv-perfaudit` in `.claude/launch.json`) and Python's Playwright.

---

## 3. What was NOT wrong

- **The snap search.** `Na__LeOsnap__Find` costs 0.07 ms a move on this sheet. The per-viewport
  4 mm grid (`ObjectSnap__Index__`) means a search reads a handful of squares, whatever the drawing
  holds; the sheet's own objects are a linear scan of a few hundred points. The whole of
  `Na__LeDim__Move` - snap, marker, band - is 0.07 ms.
- **The 3D engine.** `Na__LeMode__Enter` takes a render hold, and `Na__RenderLoop__RenderFrame`
  returns before any work while a hold stands. Nothing of the 3D pipeline runs behind a sheet.
- **The snap marker and the rubber band repainting the plan.** They do invalidate the paint of what
  is under them, but only their own small rectangle: 3 to 33 ms of GPU work per second. Not worth a
  layer of their own.

---

## 4. Culprit 1: every read of the active sheet normalised the whole drawing pack (FIXED)

`GetActiveSheet()` -> `GetSheetById()` -> `GetSheets()`, which ran `Na__LeRec__NormaliseSheet` over
every record of every sheet on every call. **1.3 ms a read on RB05** (fifteen sheets), from **223
call sites**, and it grows with the pack - which is why it was this project.

| Where | Reads | Cost |
|---|---|---|
| One pointer move, Dimension tool up | 8 (1 in `OnMove`, 7 in `Na__LeMeasure__Refresh`) | 10.5 ms of 12.0 ms |
| A press | ~10 | 13 ms |
| The click that lands a dimension | 60-odd | 88 ms |

The tool's own work in that 12 ms is 0.07 ms.

**The fix** (`SheetModel__Sheets__` 1.2.0, `SheetModel__State__` 1.2.0): a sheet is normalised once
per ANNOUNCEMENT. What brings it back: an announcement (`Na__LeModel__Revision` moves on every
`Dispatch`, before the listeners run); a sheet object not met before; one of its seven lists
replaced, or a different length. A silent edit mid-gesture does not and need not - Create, Insert
and Update normalise the record they write. Proved byte-identical over a 20 step scripted session
against the committed build, and by `Na__Test__SheetsNormaliseOnce__` (26 checks, 6 mutations).

**After:** 0.5 ms a move, 1.5 ms a press, 12 ms for the landing click.

---

## 5. Culprit 2: the drawing shared one painted layer with everything drawn over it (NOW A CHOICE: the Vector control)

The linework is a few `<path>` elements of tens of thousands of segments each, with round caps. It
sits in the same painted layer as the markup SVGs and the handles. The markup above a drawing is
swapped as ONE SVG the size of the page (`Na__LeSurface__PutSlot`), so anything that calls
`Refresh('markup')` every frame - the dimension line following the cursor, a note, a vector, a
vertex or a dimension being dragged - invalidates the whole page, and the browser draws every line
of the plan again under it, every frame: **3.8 fps** in normal mode at 8x over the densest part of
D10, the GPU flat out; 40 in Draft.

HOLDING the drawing - its frame on a compositor layer of its own - makes what changes above it
cost the drawing nothing: 60 fps. The Drawing Grid (v2.114.0) and the Drawing Axes (v2.131.0) were
already built this way.

### 5.1 The first cut, and what Adam saw

It held every 2D frame, always, by `will-change: transform`, and was shipped on the strength of
pixel comparisons that read identical. Adam, running it: **"It's unbelievably fast now, but it looks
super shit compared to before."**

Reproduced afterwards with HIS flow - the hold in place from the first paint at Fit, then real wheel
notches in: the transform hint tells the browser to keep the layer at the scale it was first drawn
at, so the drawing was the Fit picture blown up.

| Sharpness of the stage (mean absolute Laplacian), wheeled in from Fit | 4x | 12x | 30x |
|---|---|---|---|
| Not held | 10.2 | 5.5 | 5.1 |
| Held by `will-change: transform` | **3.5** | 1.9 | 2.1 |
| Held by `will-change: opacity` | 9.5 | 4.6 | 3.8 |

**The lesson for the harness:** the earlier checks took the hold AFTER the zoom was set, or zoomed by
`ZoomTo` rather than by the wheel. A check that does not do what the user does proves nothing about
what the user sees. `visual_deep.py` is the check that does.

### 5.2 The Vector control (`Na__LayoutEditor__VectorQuality__`, the toolbar, beside Raster)

Even held the right way, a held drawing is a picture the browser scales: a touch softer, fine
parallel lines running together. So it is a choice, and at the default it lets go at rest.

| Vector | When the drawing is held | The line phase, normal / Draft | At rest, against High |
|---|---|---|---|
| High | Never | 3.8 / 40 fps | - |
| Medium (default) | From a redraw of the sheet until 1.2 s after the LAST one | 56 / 60 fps, one frame of 0.16 s as the hold is taken | no pixel differs |
| Low | Always | 60 / 60 fps | ~60,000 of 4.7 M pixels differ, by up to 87 of 255 |

- One rule: `body.na-le-vector-hold:not(.na-le-viewer--active) .na-le-frame--2d { will-change : opacity; }`.
- **Medium takes the hold in the same paint as the redraw** (`NoteRedraw`, from the surface's
  animation frame, before the redraw): a redraw swaps a page-sized SVG, so it draws the whole plan
  again held or not, and taking the hold there costs nothing more. Letting go is one more drawing
  of the plan, at rest, where it is not felt.
- **The frame, not the linework inside it.** `.na-le-frame__linework` promoted alone lands on a
  sub-pixel offset of its own: Draft's hairlines came out grey and soft, 35% less ink.
- **Not the web viewer.** Nothing is dragged there, and a phone's layer budget is not a desktop's.
- **A control of its own, not part of Raster**, because Raster renders every viewport picture again
  when it changes and this renders nothing. (Adam asked first for one control driving both, then:
  "If it's got to re-render everything, just add a second one for vector quality.")
- The wheel zoom, held (Low) against not, normal mode: 29 -> 50 fps in, 11 -> 17 out. The transform
  hint gave 51 and 46, by not drawing the layer again at all - which was the fault. The v2.111.0
  zoom hold does not hold under real wheel input on a dense view; not changed here.

---

## 6. What the line phase still costs

With the drawing held (Vector Medium or Low), the dimension line following the cursor holds 60 fps
with about 7 ms of the frame to spare. What is left, per frame, on the main thread:

| Work | ms a frame | What it is |
|---|---|---|
| `RefreshStack` | ~4 | EVERY layer's primitives rebuilt and turned into an SVG string, to find that one changed |
| Style + layout | ~2.7 | The swapped SVG: 70 text items laid out again for one moved dimension |
| Paint + layerize + pre-paint | ~2 | |
| The pointer move itself | 0.5 | |

On a 60 Hz screen that is fine. On a 144 Hz one it caps the phase near 100 fps. It scales with how
much markup the sheet holds, not with the drawing.

---

## 7. What could come next, in the order it pays

**7.1 A markup refresh that knows which layer changed** (half a day; pays on every drag)
- `Refresh('markup')` rebuilds every layer to discover which changed. The caller nearly always
  knows: the Dimension tool changed the Dimensions layer. Give each Layers-panel layer its own SVG
  slot (a four line change in `RefreshStack`'s `add`, measured on its own at 1.2 ms a frame) AND let
  a caller name the layer, so the others are not even built. Expect the 9 ms above to become 2 to 3.
- The same idea, further: draw the ONE item in flight in a small overlay SVG and leave the sheet's
  markup alone until the gesture ends. More code in every tool; only worth it if 7.1 is not enough.

**7.2 The Measurements box asks once** (an hour; tidiness now, not speed)
- `Na__LeMeasure__Reading` still asks the sheet tools seven questions a move that each fetch the
  active sheet. Free since section 4, but the context getters could take the sheet as an argument.

**7.3 The linework in tiles** (a day; pays when zoomed in: the settle after a zoom, a pan into new ground)
- One `<path>` spans the whole plan, so the browser can never cull it: drawing ANY tile walks all
  38,500 segments. Filed by a paper grid (one path per style band per cell, say 50 mm), a tile at 8x
  draws the few percent that touch it. `Na__LeVp2d__BandPaths` is the one place to do it; the snap
  index already files segments by cell and could share the pass. The PDF path is separate.

**7.4 Chain the segments into polylines** (a day; pays on every raster, and on file size)
- Every segment is its own `M..L` with two round caps. Joined end to end where they meet, a wall
  is one subpath with real joins: fewer caps to draw, shorter path strings, and the corners stop
  depending on round caps to look closed. Changes the look at extreme zoom only for the better.

**7.5 A GPU linework layer** (section 9; two to four days; pays during the zoom itself)

---

## 8. "A better 2D caching strategy"

- **The compositor's tile cache is the 2D cache**, and section 5 is what switches it on for the
  drawing: the frame's tiles are drawn once per zoom level and kept on the GPU; nothing above them
  can invalidate them. A hand-built bitmap cache (tiles drawn into `OffscreenCanvas`, kept per zoom
  level like a slippy map) would be the same thing done by hand, and is only worth having if the
  linework ever leaves SVG (section 9).
- **What is already cached, and where:** the projected segments in memory (`Na__PlPipe__`) and in
  IndexedDB (`Na__PlStore__RememberRender`), so a reload paints without projecting; the path strings
  per result and style (`Na__LeVp2d__PathCache`, 16 entries); a parked sheet's whole frame DOM
  (`MaxParkedSheets`); the snap index per viewport.
- **What the PWA adds:** the service worker caches the shell, the models and the sheet pictures.
  It cannot make interaction faster - that is all main thread and GPU - only loading. Worth
  checking, not yet checked: whether a 2D viewport's base image survives a reload (IndexedDB beside
  the linework) or is rendered again each time the editor opens.

---

## 9. "Anything for WebGPU?"

Where a GPU API would earn its place: drawing the linework itself. 40,000 segments as instanced
quads is nothing to a GPU - well under a millisecond - so the drawing could be redrawn CRISP on
every frame of a zoom or a pan, where today it is a scaled picture until the zoom rests, and the
settle (one frame of 0.46 s measured, zoomed right out in Draft, the whole plan drawn at once) would go.

- **Shape:** one screen-sized canvas per sheet under the markup (NOT one per frame at the frame's
  zoomed size - D10's frame at 64x is over 100,000 px wide), the sheet's pan and zoom as a uniform, each 2D
  viewport a scissored draw. One instanced quad per segment, width in the vertex shader (paper mm
  normally, one device pixel in Draft - Draft becomes a uniform, not a stylesheet), round caps and
  dashes in the fragment shader, one draw per style band, in band order.
- **WebGL 2 does this as well as WebGPU**, and runs everywhere the app does; three r184 is already
  vendored (`LineSegments2` would do for a first cut, a 60 line shader would do better). WebGPU adds
  compute, which drawing lines does not need. The projection already has a WebGPU backend; it stays
  on the CPU because only the CPU backend tags each line with its model category.
- **What it costs:** a second renderer to keep in step with the SVG one the PDF and the snaps are
  built round - caps, joins, dashes, band order, the frame clip, the depth fog over it. SVG stays
  for print. After sections 4 and 5 this is a refinement, not a rescue.

---

## 10. Status

- v2.136.0: section 4 built and proved. Section 5's first cut (always held) was tried by Adam and
  refused for its look; the Vector control that replaced it is NOT yet confirmed by him. NOT in ValeVision.
- Sections 7.1 to 7.5: not built.
