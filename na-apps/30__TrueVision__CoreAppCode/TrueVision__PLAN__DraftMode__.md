# TrueVision3D - PLAN - Layout Editor Draft Mode (K)
# =========================================================

**Status:** built 21-Sep-2026 as v2.107.0. **Awaiting Adam's test.** Not in ValeVision.
**Brief:** Adam, 21-Sep-2026, one dictated message: "Add a Draft Mode like LayOut's".
**Read first:** section 3 (what LayOut actually does), section 4 (the map he asked for before any code),
section 5 (the decisions that are still mine) and section 8 (the live ledger).

---

## 1. The brief, in his words

> Add a "Draft Mode" like with layout, SketchUp's drawing programme. Before you code anything, you must
> research online and look at how that functions. I want to be able to press the K hotkey. And what that
> does is switch on only the rendered vector line work projection layer. All the raster layers are
> switched off in a state where they aren't using render or draw calls on the canvas, so it's just really
> fast to navigate. [...] Take out all of the line thickness rendering, so it's only rendering the
> thinnest, simplest lines that just retain the colours of the lines. [...] Even fills are removed from
> vectors [...] you should be able just to see the drawn elements, like vectors, text, annotations, etc.,
> but then, in viewports, only the rendered linework viewports. When you press K again, it untoggles it.
> [...] It's designed for when I'm working on things where I only need the vector snap points and really
> the outline of everything: the most bare-bones, optimising speed above everything else. [...] The
> project is very complicated and modular, so you must map out all modules before coding anything.

The sentence the job turns on: *"the most bare-bones, optimising speed above everything else"* - a view
mode, never a change to the drawing, and never anything the PDF can see.

---

## 2. Requirement audit - every sentence

| # | Read literally | Where it lives | State |
|---|---|---|---|
| R1 | Research LayOut's Draft Mode before coding | Section 3 | Done |
| R2 | Map every module before coding | Section 4 | Done |
| R3 | K switches it on, K again switches it off | `View__DraftToggle` row in `Na__LayoutEditor__KeyMappings__.json` (+ fallback row), case in `Na__LeTools__OnKey`; also a Draft toolbar button | Built |
| R4 | In viewports, ONLY the projected vector linework | Raster layers hidden by the draft stylesheet; the linework SVG is untouched apart from its strokes | Built |
| R5 | Raster layers cost no render and no draw calls | `display:none` on underlay, fog and 3D snapshot (no paint, no composite); Fill, the debounced schedulers and the render queue's `stillWanted` all refuse to start a raster render while Draft is on | Built |
| R6 | Thinnest, simplest lines that keep their colours | Every stroke on the paper becomes a 1 device-pixel hairline (`vector-effect: non-scaling-stroke`, width 1/(zoom x devicePixelRatio)), colour kept, no dashes | Built |
| R7 | Fills removed from vectors | `fill:none` on every shape on the paper; text keeps its fill; a shape that had ONLY a fill is outlined in the draft ink so it does not vanish | Built |
| R8 | Still see vectors, text, annotations | Sheet markup and chrome stay, restyled; text untouched | Built |
| R9 | Less regeneration while zooming | Nothing is regenerated on zoom (section 4.4); Draft cuts what the browser re-rasterises per zoom step, and holds the raster while a zoom gesture is under way (LayOut's redraw delay) | Built |
| R10 | Vector snap points keep working | Snapping reads data, never paint (section 4.6); Draft changes paint only | Built (nothing to change) |

---

## 3. Research - how SketchUp LayOut's Draft Mode works

Sources: SketchUp Help "Performance" and "Rendering Models" pages; the LayOut 2024.0 release notes;
SketchUp Community threads "LayOut's new Graphic Engine!", "Learned a new Layout trick today (with Enable
Draft Mode)", "Layout 2025 Draft Mode (K)", "LayOut screen rendering vs. output rendering".

- **Introduced in LayOut 2024.0** with the new graphics engine and a new Preferences > Performance tab.
- **What it does:** it "defers the final rendering of entities", showing simplified entities "without the
  final line weights, dashes, or pattern fills" for performance while navigating. Users describe it as a
  **hairline view**; SketchUp staff said drawing the dashes "does take a performance hit".
- **The key is K** (View > Enable/Disable Draft Mode). K was already free in TrueVision (section 4.7), so
  the binding is the same as LayOut's.
- **Two modes:** "Pan and Zoom Only" (draft while navigating) or "Always On". Always On is recommended
  for tracing over SketchUp models "as a thin line is shown for easy traceability" - exactly Adam's use.
- **Two stronger options:** "Disable SketchUp Viewport Drawing" shows only a viewport's bounding box;
  "Disable Raster-Rendered Object Drawing" hides images, pattern fills and raster viewports the same way.
- **Pan and Zoom Redraw Delay:** 0.1 s to 3 s, default 0.3 s - the full render waits until navigation rests.
- **Output is never affected:** printing and export draw the full document.
- **Why vector viewports are slow in LayOut** (community): Vector and Hybrid re-render every face, edge
  and layer on every pan and zoom; the standing advice is Raster while drafting. Inferencing into a model
  viewport is another large cost.

What that means here: TrueVision's vector linework is already cheap to keep (one SVG per viewport, never
rebuilt on zoom), so the TrueVision reading of LayOut's Draft is **Always On + "Disable Raster-Rendered
Object Drawing"**: keep the vectors, drop every raster, hairline every line, no dashes, no fills, plus the
redraw delay while a zoom gesture is under way.

---

## 4. The map

### 4.1 The sheet surface (`51/10__Core__SheetSurface`)

- `.na-le-stage` (overflow:auto, the pan is its scroll) > `.na-le-room` > `.na-le-scaler` > `.na-le-paper`.
- **Zoom is ONE CSS transform:** `Na__LeSurface__ApplyZoom` writes `transform: scale(zoom)` on the paper
  and announces `na-layouteditor-zoom-changed` (`{ zoom }`). No markup, stroke width or viewport picture is
  rebuilt on zoom or pan.
- Inside the paper: `.na-le-paper__stack` (21-Sep-2026, the Floor Areas session's paint order) holding the
  viewport frames interleaved by z-index with SEVERAL SVGs - `svg.na-le-paper__markup` (sheet markup; the
  selection highlights are the last one, also `.na-le-paper__highlights`) and `svg.na-le-paper__chrome`
  (border, title block, frame outlines and captions) - then `svg.na-le-paper__focus` and the HTML handles.
- Every sheet SVG is `viewBox` in paper mm, sized to paper px at `ScreenPixelsPerMm` 3.2, so a 0.3 pt
  line is ~0.34 CSS px at zoom 1 and grows with the zoom.

### 4.2 One primitives pipeline (`51/15__Core__Markup`, `SheetChrome`)

- Builders push paper-mm primitives; `Na__LeChrome__ToSvgMarkup` / `ToSvg` writes them. Strokes and fills
  are SVG presentation ATTRIBUTES (`stroke`, `stroke-width`, `stroke-dasharray`, `fill`), so an author
  CSS rule overrides them with no rebuild.
- Solid fill, gradient and hatch are separate paths (`stroke="none"` on the fill-only ones); text is a
  real `<text>` painted with `fill`; images are `<image>`; the QR is a group of filled paths.
- The PDF never uses ToSvg - it goes through `Na__LeChrome__DrawToPdf`.

### 4.3 A 2D viewport (`51/20__System__Viewports`)

- Frame body DOM order is the stack: `img.na-le-frame__underlay` (raster), `div.na-le-frame__linework >
  svg.na-le-frame__linework-svg` (vectors, viewBox in DRAWING mm), `img.na-le-frame__fog`,
  `div.na-le-frame__markup`, the empty panel, the progress badge.
- `Na__LeVp2d__Fill` decides every layer inline: underlay key + `ScheduleUnderlay` (320 ms debounce),
  fog key + `ScheduleFog`, linework paint key (repaint only when it changes), scene markup.
- **The raster** is `Na__LeSnap__Render2d` - a full tiled WebGL render of the staged model through one
  global queue, returned as a PNG data URL. Its pixel size depends on the raster level and the frame's
  paper size, never on the sheet zoom. Renders are held while a drag is down (`SetInteracting`).
- **The vectors** are `EnsureLinework` -> `StyleBands` -> `BandPaths` -> `PaintLinework`: one `<path>` per
  style band, `fill="none"`, width = paper width x drawing scale, round caps, hidden lines dashed.
- **Site plan viewports** paint washes (`stroke="none"`), hatch `<pattern>` fills and line bands into the
  same linework SVG.
- `projectedLinework` defaults to FALSE: many viewports are raster-only and have no vectors at all.

### 4.4 What actually costs time on a heavy sheet

Nothing is REGENERATED on zoom - but the browser re-RASTERISES the whole paper at every zoom step: every
linework path at its full width with round caps and joins, every dash, every fill, hatch pattern and
gradient, every underlay and fog image resampled (up to 5120 px a side at Medium), and the paper's blurred
shadow. The wheel handler runs synchronously per wheel event. That per-step raster is what Draft removes.

### 4.5 A 3D viewport

- `img.na-le-frame__snapshot` only - a WebP from `Na__LeSnap__Render3d` (the full 3D pipeline). No vectors.
- `Na__LeVp3d__Fill` -> `Schedule` (400 ms) -> stored asset or `RenderNow` (which also uploads on localhost).

### 4.6 Snapping and picking read DATA

`Na__LeOsnap__FindOnSheet` scans `Sheet__Shapes`; viewports snap through `Na__LeVp2d__GetSnapSource`
(the painted `state.classes`); hit testing is maths. No `getBBox`, `elementFromPoint` or `isPointInFill`
anywhere. A CSS-only restyle cannot move a snap point.

### 4.7 Keys

- `Na__LayoutEditor__KeyMappings__.json` rows (`Keys`, `Modifiers`, `ModifierMatch`) resolved by
  `Na__LeCfg__MatchKeyBinding`; `Na__LeTools__OnKey`'s switch runs the action. The fallback list in
  `Na__LayoutEditor__ConfigState__KeyMap__.js` mirrors the enabled rows.
- **K was bound nowhere** - not in the editor, not in the 3D view's hotkey manager, not hard-coded.
  Free bare letters: C G H I J K N O P Q S U W X Y Z.
- The snap toggle (F3) is the shape to copy: module state + event, toolbar button lit by
  `na-le-toolbar__btn--active`.

### 4.8 The Render Composites menu (`51/25__System__RenderStyles`, `40/Panel__Styles`)

- A composite is a config row (`RenderComposites__Config__.json`) plus a boolean in `Viewport__Styles`
  (baseImage, projectedLinework, profileLinework, glassOpaque, whitecard, hiddenLines, enhanceWhitecard,
  contextLayer, depthFog). A tick writes the RECORD through `Na__LeModel__UpdateViewport`: it dirties the
  sheet, enters undo and the autosave draft, and re-keys the 3D snapshot (whose fingerprint hashes the
  whole styles object). **So Draft must never write a composite** - it would reach saved data and the PDF.
- Session-only precedents that write nothing: Snap (F3) and the Raster level (toolbar select).

### 4.9 The PDF

`Na__LePdf__DrawViewport` calls `RenderForExport` / `RenderFogForExport` (always fresh renders at the
export level), `EnsureLinework` and `StyleBands` directly, and the chrome's own PDF writer. It never calls
Fill, PaintLinework, PaintSitePlan, ToSvg or anything in a stylesheet. **Draft lives only in a stylesheet
and in the screen's schedulers, so it cannot reach the PDF.**

---

## 5. Decisions that are mine until Adam confirms them

- D1 **Always On, toggled by K** - LayOut's "Always On". No "Pan and Zoom Only" setting was asked for.
- D2 **A raster-only viewport shows its outline and a note, not a picture** (LayOut's "Disable Raster-
  Rendered Object Drawing"). Draft never switches Projected Linework on for it: that would start a
  projection - seconds per viewport - which is the opposite of fast. Tick Projected Linework on a viewport
  to have its lines in Draft.
- D3 **3D viewports are outlines in Draft** - they are pictures and nothing else.
- D4 **A shape that had only a fill is outlined in a neutral draft ink** (config `Lines__FillOnlyInk`),
  so dots, bubbles, washes and masks stay visible. CSS cannot read a fill colour into a stroke.
- D5 **Draft is for this session only** - not saved, not in localStorage, off on every load, so it can
  never surprise anyone later or reach the web viewer. It survives switching sheets and leaving the editor.
- D6 **Draft covers the title block and border too** - hairlines, no fills, logo images hidden - because
  LayOut's Draft simplifies every entity on the page.
- D7 **Force Render still renders** in Draft - it is an explicit request - and the picture waits hidden.
- D8 **The redraw delay holds the zoom raster**: while a zoom gesture is under way the paper is a
  composited layer (`will-change: transform`), so a step is a GPU scale, not a re-raster; the crisp raster
  happens once, when the wheel rests. **Since v2.111.0 this is every sheet's, not Draft's** (section 9):
  `LayoutEditor__Navigation__ZoomSettleMs` (350) and `HoldPaperWhileZooming` (true) in the AppConfig.
- D9 **The stage scroller is composited in Draft** (`will-change: scroll-position`) so a pan moves pixels
  rather than repainting them.
- D10 **The paper's drop shadow is dropped in Draft** - a large blur re-rasterised every zoom step.

---

## 6. Module map (`02__Src__AppModules/51__System__LayoutEditor/26__System__DraftMode/`)

| File | Namespace | Job |
|---|---|---|
| `Na__LayoutEditor__DraftMode__State__.js` | `Na__LeDraft` | LEAF: the flag and its event. The viewport modules import only this, so no import cycle |
| `Na__LayoutEditor__DraftMode__.js` | `Na__LeDraft` | Set / Toggle, the body class, the hairline width per zoom and device pixel ratio, the zoom hold, the frame refresh, config and labels |
| `Na__LayoutEditor__DraftMode__Config__.json` | - | Hairline width, draft ink, smoothing, redraw delay, every label |
| `Na__LayoutEditor__Styles__DraftMode__.css` | - | The whole look: rasters off, hairlines, no dashes, no fills, raster-only outlines, the zoom hold |

Also touched, all additive:

| Where | What |
|---|---|
| `20/Viewport2d__.js` | Fill books no underlay or fog render in Draft; marks a raster-only frame; Release also clears the fog timer (a pre-existing leak) |
| `20/Viewport2d__Frame__.js` | The two debounced schedulers and the render queue's `stillWanted` refuse raster work in Draft |
| `20/Viewport3d__.js` | Fill books nothing in Draft; the scheduler and `stillWanted` refuse it |
| `30/SheetTools__Keyboard__.js` | `View__DraftToggle` -> `Na__LeDraft__Toggle` (a held K repeats: only the first press counts) |
| `03/KeyMappings__.json`, `03/ConfigState__KeyMap__.js` | The K row, the catalogue entry, the fallback row |
| `40/Toolbar__.js` | A Draft toggle beside Snap and Notes, lit while Draft is on |
| `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` | One @import |

---

## 7. Testing

- **Hairline maths proved in headless Chrome first** (scratch page, zoom 0.5-4 at devicePixelRatio 1 and
  1.5, viewBox in paper mm and in drawing mm at 1:100): `non-scaling-stroke` with width
  1/(zoom x dpr) px measured exactly **1.0 device pixel of ink in every case**. Without the zoom term the
  line grew with the zoom (2.0 at x2, 4.0 at x4) - Chrome does not count the paper's CSS transform, so the
  compensation is required and correct.
- Both verifiers: every named import resolves (431 files); the module graph shows only its two old false
  positives. No import cycle (checked with a reachability walk: the sheet surface reaches neither the
  controller, the keyboard nor the toolbar; the state leaf imports nothing).
- **In the app** - RB05 on a no-store server (127.0.0.1:8867), rAF shimmed, every write refused by a guard
  (one was attempted, by the stand-in 3D viewport's snapshot upload, and never sent):
  - K on the stage: width 1.64358 px at zoom 0.4056 x dpr 1.5 (one device pixel), band colours kept, dashes
    gone, base image `display:none`, text untouched, paper shadow off, toolbar button lit.
  - Raster level Medium -> High in Draft (re-keys every base image): **0 renders** in 2.5 s; K off: the old
    picture back at once, then exactly one render. D01 (four elevations) and D03 (two site plans), first
    shown in Draft: **0 renders**, every vector painted, site plan washes and hatches not drawn.
  - Zoom hold: six steps held the layer and left the width alone; 300 ms after the last the hold was off and
    the width read 0.430855 px = 1 / (1.5473 x 1.5).
  - A held K counts once; K in a panel field stays there; Ctrl+K is the browser's; Caps Lock K works; K mid
    floor-area keeps the tool and the room, a corner placed in Draft lands, nothing is written.
  - Raster-only outline and note (flipped in memory, no model call, restored); a 3D stand-in through the real
    `Na__LeVp3d__Fill`: nothing booked in Draft, its render booked 1.2 s after Draft went off.
  - The live D02 markup rendered offline, same DOM both ways (`D:/_ClaudeScratch/tv_draftmode_out/closeup_*.png`,
    `fit_*.png`).
- **Benchmark** (`D:/_ClaudeScratch/tv_draftmode_out/bench.py`): the live D02 markup zoomed 0.45x to 3.2x in 72
  steps in headless Chrome at 150% scaling, three runs each:

  | | Normal | Draft | Draft + zoom hold |
  |---|---|---|---|
  | CPU raster, per step (median) | 110 ms (108-136) | 52 ms (36) | **17.5 ms (17)** |
  | CPU raster, fps | 9 | 19 | **57** |
  | GPU raster, per step (median) | 76 ms (67-83) | 50 ms (23) | **20 ms (17)** |
  | GPU raster, fps | 13 | 20 | **50** |

  The crisp redraw when the wheel rests: ~34 ms. The hold (D8) is what reaches the display's frame rate.

---

## 8. Ledger

| Date | Version | What |
|---|---|---|
| 21-Sep-2026 | - | Researched (section 3), mapped (section 4), plan written. |
| 21-Sep-2026 | v2.107.0 | Built and tested as section 7. DEVLOG v2.107.0 (v2.105.0 and v2.106.0 were taken by the storey band and paint order sessions while this was built). Service worker: no bump needed from this release; the token on disk already reads `2026-09-21-02`. Committed and pushed by Adam as `866d1bd`. |
| 21-Sep-2026 | v2.111.0 | Adam tried it: "still trying to redraw and regenerate the vectors on every mouse wheel zoom... there should be a debounce". Measured, found and fixed as section 9 - for every sheet, Draft or not. Token `2026-09-21-03`. **Awaiting Adam's test.** |

### Open after the build

- D2: should Draft offer to project linework for raster-only viewports? (A setting, off by default.)
- "Pan and Zoom Only" (Draft only while navigating) is one config switch away if wanted.
- Dashed hidden and overhead lines draw SOLID in Draft (LayOut drops dashes too). Keeping them would need the
  dash arrays rescaled, because non-scaling-stroke measures dashes in CSS pixels as well.
- `Na__LeModel__GetSheets()` normalises every sheet on every call (0.6 ms a call on RB05, several calls per
  pointer move while drawing) - flagged as its own task; the zoom no longer goes near it.
- The ValeVision question, once Adam has tried it.

---

## 9. The zoom settle (v2.111.0) - zoom now, redraw when it rests

**The complaint.** In Draft it still felt as if the vectors were redrawn on every wheel notch; Adam asked for a
debounce - "zoom in and then it regenerates, rather than trying to do too much at once".

**Measured in the app first** (RB05 D02, Draft on, 20 notches; nothing was changed until this was known):
- ~6 ms of synchronous JavaScript per notch, plus two animation-frame callbacks per notch (one, the group
  boxes' repaint, never merged). 3.4 ms of it was the five zoom listeners; most of that the toolbar's full sync
  for the zoom readout, which reads the active sheet four times - and `GetSheets()` normalises every sheet on
  every call.
- With a viewport selected, its outline (as big as the viewport) was torn down and rebuilt every notch, so the
  browser redrew the whole viewport's linework under it every notch: the "regenerate" Adam felt.
- A middle/right pan ran the tool under the pointer on every move (1.8 ms with Select; 5.2 ms, 41 at worst,
  with Floor Area) for a paper point a drag-pan never changes.

**The design.** A zoom GESTURE in the sheet surface: wheel and pinch steps call
`Na__LeNav__ZoomAbout(..., gesture = true)`, which calls `Na__LeSurface__NoteZoomGesture`. While the gesture is
open only the paper's scale changes and the paper is held (`na-le-paper--zooming`, `will-change: transform`).
`ZoomSettleMs` after the last step, `SettleZoom` takes the hold off, counter-scales the handles and announces
`Na__LeSurface__ZOOM_SETTLED_EVENT` - one task, one layout, one raster. Everything that followed the zoom listens
for the settle now (margin grip, Measurements box, the sheet tools' counter-scaled boxes, Draft's hairlines);
`ZOOM_EVENT` keeps only the toolbar's readout. A single zoom (Fit, 100%, a resize) settles at once. Wheel steps
are gathered into one zoom per frame; a pan no longer drives the tools; the group repaint is booked once a frame.

**Why the hold for every sheet, not just Draft.** Benchmarked on the live D02 markup (headless Chrome, 72 steps,
three runs): normal mode with the hold runs at 50-60 fps zooming in AND out (17-20 ms a step), against 9-13 fps
(76-110 ms) without; zooming out under the hold was checked specifically, in case a layer held at a high zoom had
to be rasterised huge - Chrome coped (a flat 60 fps on GPU raster). The one crisp redraw at the settle is ~33 ms.
The cost is a soft picture while the wheel turns, sharp a moment after - the LayOut "Pan and Zoom" behaviour.

**After, same test in the app:** 0.03-0.05 ms of JavaScript per wheel event (was 5.4-5.9); 6 zooms for 24 wheel
events over 6 frames (was 24); the selection outline rebuilt once, at the settle (was every notch); 7 DOM changes
inside the paper during the gesture (was 100); a pan move with Floor Area mid-room 0.66 ms (was 5.2, 41 at worst).
One settle, 381 ms after the last notch; Draft's hairline unchanged mid-gesture and exact after.
