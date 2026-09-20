# TrueVision 3D - Site Plan Composites: DESIGN NOTES

**Generated** 20-Sep-2026 from an 18-agent design workflow (4.26M tokens, 847 tool calls):
five competing designs on the two hard problems, five judges, four supporting designs, four
adversarial critiques.

**Companion to** `TrueVision__PLAN__SitePlanComposites__.md` (the brief, the decisions, the
ledger) and `TrueVision__NOTES__SitePlanComposites__Survey__.md` (the evidence).

> **Line numbers are POINTERS.** Find every symbol by NAME.
> **The critiques in the last section are binding.** A design is only buildable once its
> critique's fatal problems are folded in. Read the critique before implementing its design.

## Verdicts

| Problem | Winner | Why |
|---|---|---|
| Composite painter + Z-index | **painter:minimal** | 9 / 8 / 8 across three judge lenses. It spots that REQ-31 asks for a hard three-deck stack (all fills, then all patterns, then all linework), *not* a per-layer interleave - which makes the change one extra pass rather than a restructure. |
| Hatch engine | **hatch:svgpattern** | 8 / 9 from both judges. SVG `<pattern>` on the ring path the fill layer already builds; PDF via a PNG data URL per layer, following the GradientTool precedent. |

Graft list from the losing designs is in each judge verdict below.

---

## painter:minimal  [WINNER - 2 of 3 judges]

### Site Plan Composites: the 1..10 Z-index and the three-deck painter (minimal-change design)

## The one fact that makes this small

Adam's REQ-31 says the composite is **all fills, then all patterns, then all linework** — a hard three-deck stack, not a per-layer interleave. The survey's open question ("does layer 6's fill go above layer 3's linework?") is therefore answered *no* by the brief itself. That matters enormously, because `Na__LeVp2d__PaintSitePlan` already has exactly that shape: `let body = ''`, every fill, then every band. The build needs **one extra pass inserted between the two that exist**. No `<g>` interleaving, no per-layer paths, no abandoning the StyleBands merge. The survey's warning that "the performance and the feature are in direct tension" applies only to an interleave nobody asked for.

## Where the Z-index lives

Two fields, per SC05, because REQ-10 (water lines over tree lines, tree fill over water fill) is unsatisfiable with one ordering:

- SSOT (`Na__DataLib__CoreIndex__Tags__.json`, `71_75__SitePlanTags__`): `SitePlan__ZIndexLine`, `SitePlan__ZIndexFill`, integers 1–10, beside the existing `SitePlan__DrawOrder`.
- Manifest, written by `Na__SitePlan__Write`: `Layer__ZIndexLine`, `Layer__ZIndexFill` at layer **top level**, beside `Layer__DrawOrder`. Not inside `Layer__Style` — a Z-index is not an inking property, and keeping `Na__SpStore__Style`'s rebuild as "the seven fields that ink a line" is worth the two extra lines in the Python whitelist.
- Project data: two entries in `discover_truevision_siteplan_store`'s per-layer dict.
- App: `Na__SpStore__Layer` reads both through one new helper.

**`Layer__DrawOrder` is not touched, not redefined, not removed.** F1's warning is that PS01's published 20/40/70/71/90 would sort above any new 1–10 value. The defaulting rule instead *derives* from it:

```
Na__SpStore__ZIndex(value, drawOrder)
    integer 1..10            -> value
    else, drawOrder finite   -> min(10, max(1, ceil(drawOrder / 10)))
    else                     -> 5
```

On PS01 that yields OsMapping 2, ExistingBuildings 4, ProposedBuildingsSecondary 7, ProposedBuildings 8, RedLineBoundary 9 — the correct hierarchy, from an unmodified two-year-old manifest, with no re-export. The store's default `Layer__DrawOrder` of 50 maps to 5, which is Adam's own "buildings would be around 5". The store's existing `.sort((a,b) => a.Layer__DrawOrder - b.Layer__DrawOrder)` **stays exactly as it is**: it still orders the Model Layers panel, the owner table and the segment concatenation. Z-order is applied at paint time in three explicit places, never by re-sorting the descriptor.

## Line order becomes Z-order without touching architectural viewports

`Na__LeVp2d__StyleBands` gains an optional fifth parameter, `siteRules`, defaulted null. Every existing caller passes four arguments and is byte-for-byte unchanged; all new behaviour sits inside `if (siteRules)` guards. Three edits inside the function:

1. In `resolve(id)`: `const rank = siteRules ? siteRules.RankFor(ownerKey) : 0;` and `const hex = siteRules ? siteRules.ColourFor(ownerKey, effective.hex) : effective.hex;`. The bucket key becomes `(siteRules ? rank + '|' : '') + hex + '|' + width + '|' + dash`.
2. The comparator: `(a,b) => (siteRules ? (a.style.rank - b.style.rank) || (a.style.widthMm - b.style.widthMm) : (a.style.widthMm - b.style.widthMm))`.
3. Each pushed band carries `rank : bucket.style.rank || 0`.

**This preserves the merge precisely where it should be preserved.** Prefixing the rank into the bucket key splits two layers only when a Z-index actually asks for an order between them. Two layers that share colour+weight+linetype *and* rank — F2's MainRoads / NeighbouringBuildings / Access case — still collapse into one path, because they are indistinguishable and have no order. The `buckets.size === 1` fast path still fires. A 30-category architectural drawing takes the null branch and produces the identical band list it produces today.

`ColourFor` is the location-plan lever, and on a location plan it makes the drawing *cheaper*: a dozen layers all resolve to the same neutral grey at the same rank and merge into a single path.

## Three layers, emitted and toggled

`Na__LeVp2d__SitePlanBuild` becomes the single decision point and returns `{ classes, fills, patterns, siteRules, locationPlan, key }`. `fills` and `patterns` are separate arrays off the same `data.rings` (a layer may have a fill and no hatch, or both), each sorted by `Layer__ZIndexFill` with descriptor order as the tie-break.

Screen: `PaintSitePlan` writes three `<g data-na-sp-layer="fills|patterns|linework">` wrappers in that order, the first two gated on the toggles. The `<g>`s cost nothing and give the DOM the stack identity the survey said was missing — without introducing per-category identity, which is what would break the merge.

The hatch on screen is **an SVG `<pattern>` fill on the same ring path the fill layer already built**, not generated hatch geometry. Tile size is paper mm × denominator, exactly as `stroke-dasharray` already scales (SC08). That removes the pattern-cache problem entirely and makes the middle deck nearly free. Pattern element ids must carry `viewport.Viewport__Id` or two site plan frames on one sheet collide.

Toggles ride the existing `Viewport__Styles` boolean channel as two new render-composite rows, `sitePlanFills` and `sitePlanPatterns`, with `Weight__Kind: "none"`. They must be registered in **four** places or they are silently dropped (F8): `Na__LeRec__STYLE_KEYS`, the `Viewport__Styles` literal in `Na__LeRec__NormaliseViewport`, `Na__LeCfg__DefaultStyles`, and `LayoutEditor__Viewport__DefaultStyles`. Both default true, so every existing saved viewport gains them on load with no migration.

REQ-32's separate left-column dropdown is a new panel reading the same config filtered by a new `Composite__SitePlan` flag; the existing `Na__LePanelStyles__Rows()` — already a one-line helper, a perfect seam — filters those rows out. Three lines, and the architectural panel provably cannot change, because no existing row carries the flag.

## Screen and PDF in step

The rule: **everything that decides content, order or colour happens in `SitePlanBuild`; the two painters only draw what they are handed.** The PDF's site plan branch becomes three calls gated on the same two flags, passing the same `drawing.siteRules` into `Na__LePdf__DrawLinework` (optional sixth parameter; the architectural call site is untouched).

On holes, I deliberately change nothing. F5 proves no site plan fill has ever painted; PS01's single ring is a 5-point outer with no inner ring. Designing an even-odd fill into `Na__LeChrome__PushPolyline` — a primitive every markup shape uses — against zero evidence is exactly the blast radius this lens forbids. Instead `SitePlanBuild` counts inner rings and the PDF logs one named warning, so the divergence becomes visible rather than silent, and Phase 1 produces the evidence.

The PDF hatch is a **PNG data URL per layer** — the layer's rings filled with the pattern, rasterised at its paper bounding box, placed with `addImage`. The alpha channel does the clipping, so jsPDF never needs a polygon clip; the precedent is `Na__LeGrad__DrawPdf` / `Na__LeGrad__StripPng`, and it must be PNG because this jsPDF build drops alpha on the 'RGBA' path.

## Cache keys

- `Na__LeVp2d__SitePlanToken` is `built.key`, the prefix of the `BandPaths` cache entry. It must fold in the **location-plan flag** (`':loc'` / `':blk'`), because that rule changes which segments land in which band. Without it, a 1:500 → 1:1250 change rebuilds the SVG (the paint key differs) and reuses the old path strings — the same class of bug as the Force Render one already recorded in memory. The flag, not the raw denominator, so 1:100 ↔ 1:200 does not discard paths for nothing.
- The Z values themselves need nothing: they are fully determined by the descriptor, which is determined by `SitePlan__ExportedIso`, already in the token.
- `Na__LeVp2d__SitePlanPaintKey` gains the two toggle booleans and a hatch-override token. These change `body` but not band geometry, so they must **not** enter `built.key` or every toggle would throw away cached paths.
- `Na__LeVp2d__ForgetPaths` is not exported. A store `Reload()` that returns the same `ExportedIso` leaves stale band paths — a pre-existing bug, flagged, with a one-line optional fix.

## The location-plan rule (REQ-28)

It lives in `SitePlanBuild`, so the PDF inherits it free. Threshold **`denominator > 500`**. The survey claims a contradiction at exactly 1:500; there is none. It mis-quotes the brief as ">= 500". Adam wrote "Viewports over 1:500", REQ-30 makes 1:500 a Block Plan, and the shipped naming (`scale >= 1000`) classifies identically on every scale on the list today and on every scale REQ-33 adds. Do not re-ask Adam, and do not touch `Na__LePanelViewport__AddSitePlan`'s naming line in this build.

When the flag is true: `fills` is filtered to a **config list** of proposal category keys (not "has a fill" — under REQ-11 every layer gains one; not a new SSOT boolean — that cannot work on PS01 today); `patterns` is emptied; and `siteRules.ColourFor` returns the boundary hex for the boundary keys and `#666666` for everything else. `classes` is untouched, so the snap source and owner table are identical at both scales.

The threshold and both key lists live in one new config, `Na__LayoutEditor__SitePlanComposites__Config__.json`, with its module's `Ready()` joined to `Na__LeMode__ReadyOnce`. I deliberately did **not** add `Na__LeScale__IsLocationPlan` to ScaleManager: that file is shared with ValeVision, which has zero site plan code, and only the site plan unit needs the predicate.

#### Files

| Action | Path | What |
|---|---|---|
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | Under Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__, every tag entry gains SitePlan__ZIndexLine and SitePlan__ZIndexFill (integers 1-10) and SitePlan__HatchPatternId (string or null), placed immediately after the existing SitePlan__DrawOrder. Values per REQ-09: RedLineBoundary 10; Proposed buildings 8; Existing buildings 5; Waterbodies line 6 / fill 3; Trees line 5 / fill 4; Fences 3; MainRoads 2; MinorStreets 1. SitePlan__DrawOrder is left in place unchanged. Bump the file's meta version. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | Na__SitePlan__BuildLayerDefinitions: add `z_line: entry['SitePlan__ZIndexLine']` and `z_fill: entry['SitePlan__ZIndexFill']` to the layers[name] hash beside draw_order, and `'HatchPatternId' => entry['SitePlan__HatchPatternId']` inside the style hash. Na__SitePlan__Write, the `records << {...}` block: add `'Layer__ZIndexLine' => defn[:z_line]` and `'Layer__ZIndexFill' => defn[:z_fill]` beside 'Layer__DrawOrder'. Leave `records.sort_by!` on Layer__DrawOrder alone. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | discover_truevision_siteplan_store: add 'Layer__ZIndexLine' : entry.get('Layer__ZIndexLine') and 'Layer__ZIndexFill' : entry.get('Layer__ZIndexFill') to the per-layer dict beside 'Layer__DrawOrder'. Mirror the same two keys in the no-manifest `by_key` fallback branch wherever it sets Layer__DrawOrder. Layer__Style is already copied whole, so HatchPatternId needs no edit here. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | ADD helper Na__SpStore__ZIndex(value, drawOrder): returns value when it is an integer 1-10; else min(10, max(1, Math.ceil(drawOrder / 10))) when drawOrder is finite; else 5. In Na__SpStore__Layer add Layer__ZIndexLine : Na__SpStore__ZIndex(raw.Layer__ZIndexLine, raw.Layer__DrawOrder) and Layer__ZIndexFill likewise, beside Layer__DrawOrder. In Na__SpStore__Style add an eighth key HatchPatternId : text(style.HatchPatternId, null) (F8: an unregistered style key is deleted here). Do NOT change Na__SpStore__Describe's sort - it still sorts on Layer__DrawOrder. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__SitePlanComposites__Config__.json` | New config, house style, 4-space indent, values aligned, matching Na__LayoutEditor__EdgeStyles__Config__.json exactly. Blocks: LayoutEditor__SitePlanComposites__Meta (Meta__FileName, Meta__Description, Meta__Version 1.0.0, Meta__Created, Meta__Author, plus prose Meta__WhyTwoZIndexes, Meta__WhyNotDrawOrder, Meta__WhereTheOrderIsApplied, Meta__WhichKeysAreProposal, Meta__WhereHatchScaleGoes); LayoutEditor__SitePlanComposites__Stack (array of three, each Stack__Id / Stack__Label / Stack__Order / Stack__CompositeKey / Stack__Note); LayoutEditor__SitePlanComposites__ZIndex (ZIndex__Description, ZIndex__Min 1, ZIndex__Max 10, ZIndex__Default 5, ZIndex__DrawOrderDivisor 10); LayoutEditor__SitePlanComposites__LocationPlan (LocationPlan__Description, LocationPlan__DenominatorAbove 500, LocationPlan__ProposalCategoryKeys array with __Note entries, LocationPlan__BoundaryCategoryKeys, LocationPlan__NeutralColourHex "#666666", LocationPlan__DrawPatterns false). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__SitePlanComposites__.js` | New module, namespace Na__LeSpComp__. Exports: Na__LeSpComp__Ready() (fetch-once, same shape as Na__LeComposite__Ready, falls back to a built-in inventory so a failed fetch still paints); Na__LeSpComp__Stack(); Na__LeSpComp__IsLocationPlan(denominator) -> parseFloat(denominator) > LocationPlan__DenominatorAbove; Na__LeSpComp__IsProposalKey(categoryKey); Na__LeSpComp__IsBoundaryKey(categoryKey); Na__LeSpComp__NeutralHex(); Na__LeSpComp__ClampZ(value). Imports nothing but its own config URL - no cycle with the viewport units. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js` | Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden, siteRules) gains a fifth optional parameter, defaulted null. Three guarded changes inside: (1) resolve(id) computes `const rank = siteRules ? siteRules.RankFor(ownerKey) : 0` and `const hex = siteRules ? siteRules.ColourFor(ownerKey, effective.hex) : effective.hex`, stores rank on the style, and prefixes `rank + '\|'` to style.key only when siteRules is present; (2) the bucket comparator becomes rank-then-width when siteRules is present and stays width-only otherwise; (3) every bands.push gains `rank : (bucket.style.rank \|\| 0)` (the two single-band pushes get rank 0). No other function changes. ALSO export Na__LeVp2d__ForgetPaths (optional, for the Force Render fix). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Na__LeVp2d__SitePlanToken: append ':' + (Na__LeSpComp__IsLocationPlan(viewport.Viewport__ScaleDenominator) ? 'loc' : 'blk'). Na__LeVp2d__SitePlanPaintKey: append '\|' + (Viewport__Styles.sitePlanFills !== false) + (Viewport__Styles.sitePlanPatterns !== false) + '\|' + Na__LeVp2d__HatchToken(viewport). ADD Na__LeVp2d__HatchToken(viewport) - a stable string over Viewport__SitePlan.SitePlan__HatchOverrides, empty when absent. ADD Na__LeVp2d__SiteRules(viewport, layersByKey, locationPlan) returning { RankFor, ColourFor }. Na__LeVp2d__SitePlanBuild: compute locationPlan once; sort fills by Layer__ZIndexFill then descriptor index; build a second `patterns` array from the same loaded rings for layers whose Layer__Style.HatchPatternId is set, also sorted by ZIndexFill; on a location plan, filter fills to Na__LeSpComp__IsProposalKey and set patterns to []; return { classes, fills, patterns, siteRules, locationPlan, holesPending, key }. ADD Na__LeVp2d__HatchDefs(viewport, patterns, D) building the <defs><pattern> markup with ids carrying Viewport__Id. Na__LeVp2d__PaintSitePlan: pass built.siteRules as the fifth argument to StyleBands; emit defs, then <g data-na-sp-layer="fills">, <g data-na-sp-layer="patterns">, <g data-na-sp-layer="linework"> in that order, the first two gated on the Viewport__Styles flags. Export Na__LeVp2d__SitePlanBuild is NOT needed; SitePlanDrawing already carries the new fields. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js` | Na__LePdf__DrawLinework(doc, sheet, viewport, described, classes, siteRules) gains an optional sixth parameter, forwarded straight into the StyleBands call; the architectural call site passes nothing. The site plan branch of Na__LePdf__DrawViewport becomes three gated calls in stack order: DrawSitePlanFills when Viewport__Styles.sitePlanFills !== false, then a new Na__LePdf__DrawSitePlanHatch(doc, viewport, described, drawing.patterns) when sitePlanPatterns !== false, then DrawLinework with drawing.siteRules. ADD Na__LePdf__DrawSitePlanHatch: rasterises each pattern layer's rings filled with its SVG pattern to a transparent PNG data URL at the layer's paper bounding box and places it with doc.addImage (PNG, never 'RGBA' - this jsPDF build drops alpha). ADD one console.warn naming the layers when drawing.holesPending is true. Na__LePdf__DrawSitePlanFills is otherwise unchanged. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json` | Add two rows to LayoutEditor__RenderComposites__Layers: { Composite__Key: "sitePlanFills", Composite__Label: "Solid Fills", Composite__SitePlan: true, Composite__TwoDOnly: true, Composite__Toggle: true, Composite__Order: 110, Composite__Note, Composite__Weight: { Weight__Kind: "none" } } and the same shape for "sitePlanPatterns" / "Hatch Patterns" at order 120. Add Meta__WhySitePlanRows explaining that Composite__SitePlan splits the one inventory between two panels. Bump Meta__Version to 1.3.0. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js` | Na__LeComposite__Rows(): surface the new config field as `sitePlan : row['Composite__SitePlan'] === true` on each mapped row, and add the same flag (false) to the Na__LeComposite__FALLBACK entries plus two new fallback entries for sitePlanFills and sitePlanPatterns. No other change; Token, RasterToken and Weight are untouched because these rows carry no weight. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js` | One line only: Na__LePanelStyles__Rows() becomes `return Na__LeComposite__Rows().filter((row) => row.sitePlan !== true);`. Nothing else in this panel changes. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__SitePlanStyles__.js` | New panel, namespace Na__LePanelSpStyles, section id 'siteplanstyles', title 'Site Plan Render Composites', registered into the LEFT column. Structurally a trimmed copy of Na__LayoutEditor__Panel__Styles__.js: Na__LePanelSpStyles__Rows() = Na__LeComposite__Rows().filter(row => row.sitePlan === true); Na__LePanelSpStyles__Fill / __Build / __Refresh / __Register. No Advanced fold and no weight cluster (both rows are Weight__Kind none) and no force-render button. Refresh hides every row and shows the note unless Na__LeModel__IsSitePlanViewport(selected) is true. The 'style-toggle' control name is reused, so the existing PanelHost handler already writes { styles : { <key> : checked } } - register its own OnControl under a distinct control name 'sp-style-toggle' to avoid double-handling. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Import and call Na__LePanelSpStyles__Register() immediately after Na__LePanelStyles__Register(). Import Na__LeSpComp__Ready and add it to the Na__LeMode__ReadyOnce Promise.all, or the config is not awaited before the first sheet normalises. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Add 'sitePlanFills' and 'sitePlanPatterns' to Na__LeRec__STYLE_KEYS (this is what patch.styles filters through in UpdateViewport). Add sitePlanFills : pick('sitePlanFills') and sitePlanPatterns : pick('sitePlanPatterns') to the Viewport__Styles literal in Na__LeRec__NormaliseViewport. Na__LeRec__NormaliseProjectedEdges is NOT touched - the hatch overrides deliberately live in Viewport__SitePlan, which NormaliseViewport already shallow-copies. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js` | Na__LeModel__UpdateViewport gains a patch.sitePlan branch (F8 records that none exists): `if (patch.sitePlan && Na__LeRec__IsSitePlanViewport(viewport)) viewport.Viewport__SitePlan = Object.assign({}, viewport.Viewport__SitePlan, patch.sitePlan);` placed beside the patch.styles branch. This is what lets the hatch scale/rotation of REQ-19 be edited after create time. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__SheetSetup__.js` | Na__LeCfg__DefaultStyles: add sitePlanFills : flag('SitePlanFills', true) and sitePlanPatterns : flag('SitePlanPatterns', true). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json` | LayoutEditor__Viewport__DefaultStyles gains "SitePlanFills": true and "SitePlanPatterns": true. Extend LayoutEditor__Viewport__DefaultStylesNote to say these two mean nothing on an architectural viewport and are carried only so the record shape is uniform. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json` | One value: LayoutEditor__EdgeStyles__Weight.Weight__Max 6.00 -> 10.00, and update Weight__Description to cite the new ceiling (10.00 x 0.10584 = 1.058 mm). Fixes F3, under which Adam's 2.0 pt proposed-building weight silently clamps. Also bump Meta__SsotVersionRead 2.0.0 -> 2.1.0, which is stale by one minor. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanZIndex__.test.mjs` | New Node test. Copies Na__SitePlan__Store__.js to a temp .mjs (Node resolves .js here as CommonJS - it cannot be imported directly) and asserts Na__SpStore__ZIndex's three branches, including that PS01's real 20/40/70/71/90 map to 2/4/7/8/9 and stay strictly ordered. Second block: a pure re-implementation of the StyleBands bucket-key and comparator rules, asserting (a) same style + same rank merges, (b) same style + different rank splits and orders by rank, (c) with siteRules null the comparator is width-only. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill section 5 (Design - Z-index) and section 10 (Design - the composite and the location plan rule) with this design. Add decisions SC15 (Z-index is a new top-level manifest key with a ceil(DrawOrder/10) fallback; Layer__DrawOrder is never redefined), SC16 (StyleBands takes an optional siteRules hook; the merge is kept and split only by rank), SC17 (REQ-31's hard three-deck stack means PaintSitePlan is not restructured), SC18 (the location-plan threshold is > 500 and the survey's '1:500 contradiction' is a misquote - do not re-ask Adam), SC19 (the PDF keeps today's outer-ring-only fill and warns; even-odd is deferred until a real hole exists), SC20 (hatch identity is layer-owned in Layer__Style; hatch scale and rotation are viewport-owned in Viewport__SitePlan, dodging NormaliseProjectedEdges). Add the phase rows to the section 12 ledger. |

#### New keys

- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexLine`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexFill`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__HatchPatternId`
- `SitePlanData__Layers[].Layer__ZIndexLine`
- `SitePlanData__Layers[].Layer__ZIndexFill`
- `SitePlanData__Layers[].Layer__Style.HatchPatternId`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexLine`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexFill`
- `LayoutEditor__SitePlanComposites__Meta`
- `LayoutEditor__SitePlanComposites__Meta.Meta__FileName`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Description`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Version`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Created`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Author`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhyTwoZIndexes`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhyNotDrawOrder`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhereTheOrderIsApplied`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhichKeysAreProposal`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhereHatchScaleGoes`
- `LayoutEditor__SitePlanComposites__Stack`
- `LayoutEditor__SitePlanComposites__Stack[].Stack__Id`
- `LayoutEditor__SitePlanComposites__Stack[].Stack__Label`
- `LayoutEditor__SitePlanComposites__Stack[].Stack__Order`
- `LayoutEditor__SitePlanComposites__Stack[].Stack__CompositeKey`
- `LayoutEditor__SitePlanComposites__Stack[].Stack__Note`
- `LayoutEditor__SitePlanComposites__ZIndex`
- `LayoutEditor__SitePlanComposites__ZIndex.ZIndex__Description`
- `LayoutEditor__SitePlanComposites__ZIndex.ZIndex__Min`
- `LayoutEditor__SitePlanComposites__ZIndex.ZIndex__Max`
- `LayoutEditor__SitePlanComposites__ZIndex.ZIndex__Default`
- `LayoutEditor__SitePlanComposites__ZIndex.ZIndex__DrawOrderDivisor`
- `LayoutEditor__SitePlanComposites__LocationPlan`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__Description`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__DenominatorAbove`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__ProposalCategoryKeys`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__BoundaryCategoryKeys`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__NeutralColourHex`
- `LayoutEditor__SitePlanComposites__LocationPlan.LocationPlan__DrawPatterns`
- `LayoutEditor__RenderComposites__Layers[].Composite__SitePlan`
- `LayoutEditor__RenderComposites__Meta.Meta__WhySitePlanRows`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanFills`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanPatterns`
- `Viewport__Styles.sitePlanFills`
- `Viewport__Styles.sitePlanPatterns`
- `Viewport__SitePlan.SitePlan__HatchOverrides`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__Scale`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__RotationDeg`

#### Order of work

1. STEP 0 - Unblock testing without SketchUp. Hand-edit PS02's manifest (na-project-portal\26-Projects\PS02__MustersRoad__OfficialPdPack\30__TrueVision__AppContent\SitePlan__DrawingData\TrueVision__SitePlanData__Manifest__.json) to give TrueVision__SitePlan__ExistingBuildings a Layer__Style.FillHex "#43A047" and FillOpacity 0.35. That layer already has a fill GLB with one real ring. Open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS02&project-folder=PS02__MustersRoad__OfficialPdPack&year=26 (both params, 127.0.0.1 only - the local manifest wins there). PROVE ONE FILL PAINTS on screen and in a PDF before anything else. This closes F5 and needs no SketchUp and no build.
2. STEP 1 - Config and module, no behaviour. Create Na__LayoutEditor__SitePlanComposites__Config__.json and Na__LayoutEditor__SitePlanComposites__.js. Join Na__LeSpComp__Ready to Na__LeMode__ReadyOnce. Run node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs. Nothing on screen changes yet; the only test is that the config fetches and the verifier still passes.
3. STEP 2 - Z-index into the app, reading only the fallback. Add Na__SpStore__ZIndex and the two Layer__ZIndex* fields to Na__SpStore__Layer. Add Na__Test__SitePlanZIndex__.test.mjs and prove PS01's 20/40/70/71/90 map to 2/4/7/8/9. No painter change yet - this step is provable in Node alone, against published manifests, with no exporter change.
4. STEP 3 - The siteRules hook in StyleBands. Add the optional fifth parameter and the three guarded edits. Do NOT pass it from anywhere yet. Reload an ARCHITECTURAL sheet and confirm it is pixel-identical: the whole point is that the null branch is unchanged. Run the verifier.
5. STEP 4 - Wire line Z-order. SitePlanBuild builds siteRules (RankFor only; ColourFor returns its input unchanged) and PaintSitePlan passes it. Add the loc/blk flag to SitePlanToken. On PS01 at 1:500, confirm the red line is still on top; then temporarily set RedLineBoundary's ZIndexLine to 1 in the store fallback and confirm it drops under the OS mapping - a visible proof the rank, not the width, now decides.
6. STEP 5 - Fill Z-order and the three <g> decks. Sort fills by Layer__ZIndexFill in SitePlanBuild; emit the three <g> wrappers; the patterns deck is empty for now. Prove with PS02's fill that reordering ZIndexFill reorders two overlapping fills, and that the screen SVG has exactly three groups in the right order.
7. STEP 6 - The two composite toggles, end to end. Config rows, Na__LeComposite__Rows flag, the Rows() filter in Panel__Styles, the new Panel__SitePlanStyles, the ModeController registration, and all four record registrations (STYLE_KEYS, NormaliseViewport, DefaultStyles, AppConfig). Add the toggles to SitePlanPaintKey. Prove: toggle off, the fills vanish; save, reload, they are still off; undo restores; an architectural viewport's Render Composites panel is unchanged and does not show the two new rows.
8. STEP 7 - The location plan rule. Add ColourFor to siteRules, the proposal/boundary filters and the empty-patterns rule in SitePlanBuild. Prove on one sheet carrying a 1:500 and a 1:1250 viewport of the same data side by side: the 1:1250 shows only the proposal fill and neutral grey linework except the red boundary. Then switch one viewport's scale both ways and confirm it repaints correctly - that is the SitePlanToken loc/blk flag doing its job against the 16-entry path cache.
9. STEP 8 - PDF parity for decks 1 and 3. Pass drawing.siteRules into Na__LePdf__DrawLinework; gate DrawSitePlanFills on the flag; add the holesPending warning. Export a PDF of the step-7 sheet and compare it to the screen at the same zoom: the band order, the colours and the location-plan suppression must match exactly.
10. STEP 9 - STOP AND ASK ADAM. The SSOT and Ruby edits (SitePlan__ZIndexLine/Fill/HatchPatternId, the manifest keys) need him to run the exporter on RB05. Only after he re-exports do the authored Z values replace the derived ones. Nothing above this line depends on him.
11. STEP 10 - The patterns deck. Na__LeVp2d__HatchDefs and the <pattern> emission on screen (ids carrying Viewport__Id); Na__LePdf__DrawSitePlanHatch as a PNG data URL per layer; the Viewport__SitePlan.SitePlan__HatchOverrides channel and the patch.sitePlan branch in UpdateViewport. This step depends on the hatch library and generator design, which is a separate piece of work - deck 2 stays empty and harmless until it lands.
12. STEP 11 - Housekeeping. Raise Weight__Max to 10.00 and Meta__SsotVersionRead to 2.1.0 in the EdgeStyles config. Bump PWA_SW_VERSION_TOKEN in TrueVision__Pwa__ServiceWorker__Logic__.js (currently '2026-09-20-3') with its DEVELOPMENT LOG line, because this release adds new module exports that new imports name. Update plan doc sections 5, 10 and 12.

#### Risks

- The two new Viewport__Styles keys land on EVERY viewport, architectural included, because the Viewport__Styles rebuild is a flat literal and pick() falls back to the config default. That is two ignored booleans per viewport and zero behaviour change. Gating them behind IsSitePlanViewport was considered and rejected as more risk than the noise; if a project file diff is ever questioned, this is why.
- Na__LeVp2d__ForgetPaths is not exported from the Linework unit, and Na__LeVp2d__SitePlanToken keys on SitePlan__ExportedIso. A store Reload() that returns the SAME ExportedIso leaves the 16-entry path cache holding stale band strings, so Force Render on a site plan viewport re-fetches faithfully and repaints the old drawing. Pre-existing, not introduced here, but this build makes it likelier to be hit. Optional one-line fix: export ForgetPaths and call it from Na__LeVp2d__ForceRender for a site plan viewport.
- The path cache is 16 entries, FIFO, and SHARED with every architectural viewport. A site plan sheet now generates more distinct band sets (rank splits, plus the loc/blk variant), so it can evict an architectural viewport's paths more often. The symptom is a slower repaint, not a wrong one. Watch it on a sheet mixing both kinds.
- If an authored ZIndexLine collides with the derived value of an unauthored neighbour, the tie-break is stroke width, then bucket insertion order - which is descriptor order, i.e. Layer__DrawOrder. Stable and explicable, but a half-migrated SSOT (some tags authored, some not) will produce orders nobody predicted. Author all nine tags in one pass or none.
- F3's clamp. Until Weight__Max is raised to 10.00, Adam's 2.0 pt proposed-building weight silently prints at 0.635 mm. The Z-index hides the visible symptom (the proposal no longer covers the red line because rank beats width) which makes the underlying wrong weight HARDER to notice. Do the one-value edit in the same release.
- F4's alias whitelist. LocationPlan__NeutralColourHex must be one of the nine rows in LayoutEditor__EdgeStyles__Colours or it silently paints black. #666666 is in the list; any future change to that value must go through the palette in the same commit.
- F6 still bites. A layer with faces but no edges exports nothing at all, through four separate gates. The fill and pattern decks read rings that only exist when the layer also has linework. Nothing in this design fixes that - it is the Export Polygon Faces work, and until it lands a face-only woodland polygon will simply be absent, not mis-ordered.
- The PDF hatch as a PNG is a raster on a vector drawing. At A1 and 600 dpi it will be large. If the file size or the print quality is wrong, the fallback is vector hatch lines culled by Na__LePdf__DrawLinework's minSegmentPaperMm (0.05 mm = 25 m of site at 1:500), which is a different set of problems. Decide against a real printed sheet, not a screen preview.
- SVG <pattern> ids must carry Viewport__Id. Two site plan frames on one sheet with the same hatch will otherwise share one id and the second frame will take the first's transform. Easy to write, invisible in a one-viewport test, obvious on a real sheet.
- ValeVision. Na__LayoutEditor__Viewport2d__Linework__.js, RenderComposites, SheetRecords, ScaleManager and Panel__Styles all exist there and none contains the string 'SitePlan'. Every edit above to those files must be back-ported as the GUARDED, site-plan-free part only - the optional parameter and the null branch, never the site plan module imports. A whole-file copy fails Na__Verify__Exports__.mjs immediately. Per the standing rule, the port is offered to Adam only after he confirms the TrueVision work.
- PWA token. This release adds new module exports (Na__LeSpComp__*, Na__LePanelSpStyles__*) that new imports name. A warm cache without them breaks the editor until a second visit. PWA_SW_VERSION_TOKEN must be bumped from '2026-09-20-3' in the same commit.

#### Rejected alternatives

- Redefining Layer__DrawOrder as 1-10. F1's explicit warning: PS01's published 20/40/70/71/90 would all sort above any new value and every existing project would invert. Rejected outright; DrawOrder is left alone and the new keys derive from it when absent.
- Re-sorting Na__SpStore__Describe by the new Z-index. It would silently reorder the Model Layers panel, the segment concatenation and the owner table for no gain, since Z is applied at paint time anyway. The store sort stays on Layer__DrawOrder.
- A single Z-index field. REQ-10 (water lines over tree lines while tree fill sits over water fill) is mathematically unsatisfiable with one ordering. SC05 already decided this; the design just implements it.
- Putting the Z-index inside Layer__Style. One file fewer to edit (only Na__SpStore__Style), but a Z-index is not an inking property, and mixing it into the seven-key style rebuild invites someone to route it through Na__LeRec__NormaliseProjectedEdges, whose four-key rebuild would drop it. Top level, beside Layer__DrawOrder, is where it belongs.
- Replacing the width sort in StyleBands outright. It is shared with every architectural viewport; changing the comparator unconditionally is the single most likely regression in this build. An optional parameter defaulted null makes the architectural path provably untouched.
- Suppressing the StyleBands merge for site plan viewports (the survey's assumption). Folding the rank into the bucket key instead splits only the pairs a Z-index actually orders. Merging is kept for F2's genuinely indistinguishable layers, and on a location plan the merge gets stronger, not weaker.
- Per-layer <g> elements or data- attributes in the SVG. That is what would force the merge to be abandoned: the geometry of two merged layers is genuinely one path string, so per-layer identity cannot be added without splitting every band. Three deck-level <g>s give all the identity the toggles need.
- Restructuring Na__LeVp2d__PaintSitePlan to interleave fills and lines per Z band. REQ-31 asks for a hard three-deck stack, so the interleave is not required. Building it anyway would cost the merge and the path cache for a feature nobody asked for.
- Adding Na__LeScale__IsLocationPlan to Na__LayoutEditor__ScaleManager__.js. ScaleManager is shared with ValeVision, which has zero site plan code; only the site plan unit needs the predicate. It lives in the new Na__LeSpComp__ module instead, removing a shared-file edit and a port obligation.
- Changing Na__LePanelViewport__AddSitePlan's `scale >= 1000` naming rule to the shared predicate. It classifies identically on every scale that exists today and on every scale REQ-33 adds, so the edit is unrequested churn. Flagged as a one-line tidy-up, not done.
- Asking Adam to settle the '1:500 contradiction' the survey raises. There is none - the survey misquotes the brief as '>= 500'. Adam wrote 'over 1:500' and REQ-30 makes 1:500 a Block Plan. Re-asking would waste a round trip on a settled point.
- Detecting proposal layers by 'the layer's style carries a fill'. Under REQ-11 every layer gains a fill, so that test would let woodland and water through onto a 1:1250 location plan - the exact fault REQ-28 exists to prevent. A config key list is used instead.
- A new SSOT boolean SitePlan__IsProposal for the location-plan filter. Correct long-term, but it needs a plugin change, a re-export and a manifest key, and cannot work against PS01 as published. The config list works today; the SSOT flag becomes the primary source later with the list as fallback.
- Adding the two composite toggles to Na__LeVp2d__SitePlanToken (built.key). They change what is written into `body`, not the band geometry, so putting them there would discard every cached path string on each toggle. They go in the paint key.
- Generating hatch line geometry per layer on screen. An SVG <pattern> fill on the ring path the fill deck has already built costs one extra <path>, needs no new cache and scales with the denominator exactly as stroke-dasharray already does.
- Rewriting Na__LeChrome__PushPolyline to support even-odd sub-paths so the PDF cuts holes. That primitive is used by every markup shape on every sheet; the blast radius is enormous, and F5 proves no real site plan fill with an inner ring has ever existed. The divergence is made visible with a warning and deferred until there is evidence.
- jsPDF native tiling patterns for the paper hatch. beginTilingPattern / addShadingPattern sit behind advancedApiModeTrap and throw outside doc.advancedAPI(); the whole exporter runs in compat mode. A PNG data URL per layer reuses the proven Na__LeGrad__DrawPdf path and lets the alpha channel do the polygon clipping jsPDF cannot.

#### Flagged for Adam

- Confirm the nine SitePlan__ZIndexLine / SitePlan__ZIndexFill values. The brief gives red line 10, buildings ~5, fences 3, roads 2, minor streets 1, and water lines above tree lines with tree fill above water fill. Everything else is a guess and the values are cheap to change, but they are his drawing convention, not a technical choice. A proposed table should be put to him as part of the SSOT edit in step 9.

---

## painter:perf  [not chosen]

### Site Plan Composites: the three-layer painter and the 1..10 Z-index (REQ-08 to REQ-16, REQ-30 to REQ-32)

## 0. The shape of the answer

Four things have to be true at once: line order must obey a 1..10 index; the StyleBands merge must survive (it is what keeps a 30-category architectural drawing to one `<path>`); the three composite layers must toggle without rebuilding anything; and screen and paper must not drift. All four fall out of one idea — **bucket by `(zIndex, styleKey)` instead of `styleKey`, and sort by `(zIndex, widthMm)`** — plus one discipline: **every ordering and filtering decision happens in `Na__LeVp2d__SitePlanBuild`; the two painters only draw the arrays they are handed, in array order.**

## 1. Where the Z-index lives

Two fields, per SC05, because REQ-10 is unsatisfiable with one.

SSOT (`Na__DataLib__CoreIndex__Tags__.json`, `71_75__SitePlanTags__`): `SitePlan__ZIndexLine` and `SitePlan__ZIndexFill`, integers 1..10, beside the existing `SitePlan__DrawOrder`. Ruby (`Na__SitePlan__BuildLayerDefinitions`) carries them as `z_line` / `z_fill`; `Na__SitePlan__Write` writes `Layer__ZIndexLine` / `Layer__ZIndexFill` into each manifest record. The build script's `discover_truevision_siteplan_store` per-layer dict gains both — that dict is a closed whitelist of *top-level* per-layer keys (survey finding 11), so they must be named there or they are dropped.

**`SitePlan__DrawOrder` / `Layer__DrawOrder` is NOT deleted and NOT redefined.** F1's warning is exact: PS01's published 20/40/70/71/90 would sort above every new 1..10 value, and a half-re-exported project would be nonsense. Instead the store derives a z from DrawOrder when no explicit z is present:

```
function Na__SpStore__ZIndex(value, drawOrder) {
    if (Number.isInteger(value) && value >= 1 && value <= 10) return value;
    const from = Number.isFinite(drawOrder) ? drawOrder : 50;
    return Math.min(10, Math.max(1, Math.ceil(from / 10)));
}
```

On PS01 that yields OsMapping 2, ExistingBuildings 4, ProposedBuildingsSecondary 7, ProposedBuildings 8, RedLineBoundary 9 — strictly increasing, distinct, and *identical in ordinal to today's fill order*. A manifest with no DrawOrder lands on 5, the middle. Old and new manifests therefore always land on the same 1..10 scale, and mixing them is safe. That is the whole reason the derivation lives in the store and not in the exporter.

`Na__SpStore__Layer` gains `Layer__ZIndexLine` / `Layer__ZIndexFill` from that helper. `Na__SpStore__Describe` keeps sorting by `Layer__DrawOrder` — that sort now means only *load and concatenation* order, and I add `|| a.Layer__CategoryKey.localeCompare(b.Layer__CategoryKey)` so the byte offsets inside `built.classes` are stable across exports.

**No per-viewport Z override.** It would need a fifth key in `Na__LeRec__NormaliseProjectedEdges`, which rebuilds exactly four and silently drops the fifth (F8), plus a fifth field in `Na__LeEdge__Token`. Z-index is a property of the layer, not of a viewport. If Adam later wants it, the seam is `Viewport__SitePlan` (shallow-copied by `Na__LeRec__NormaliseViewport`, so it survives) plus a new `patch.sitePlan` branch in `Na__LeModel__UpdateViewport`, which does not exist today.

## 2. Line order becomes Z-order without losing the merge

`Na__LeVp2d__StyleBands` gains an optional fifth parameter, `spec` — `null` for every architectural caller.

In `resolve(ownerId)`, the style identity key gains a z prefix and the sort gains a primary term:

```
style.z   = spec && spec.ZOf ? spec.ZOf(key) : 0;
style.key = style.z + '|' + hex + '|' + roundedWidth + '|' + dash.join(',');
...
.sort((a, b) => (a.style.z - b.style.z) || (a.style.widthMm - b.style.widthMm))
```

With `spec === null` every z is 0, the key gains a constant `0|` prefix, the buckets are the same buckets, the comparator resolves identically, and `if (buckets.size === 1)` still collapses to one whole-class band with `indices : null` — the fast path that lets `Na__PlOverlay__BuildPathData` walk the raw `Float32Array` with no index indirection. **Architectural output is byte-identical**, and that is the regression test.

With a `spec`, two layers that agree on colour + weight + linetype **and z** still merge (F2's Grey L40 trio stays one path). Two that disagree on z split — which is the feature, not a cost. The merge is preserved exactly where it was ever doing work.

Cost at 50,000 segments / 30 layers: `resolve()` is still memoised per owner id (≤30 lookups, not 50,000). The bucketing loop is still one pass. The band count rises at worst to the layer count, but **path-building work is unchanged** — each band walks only its own indices, so the total is still exactly one pass over all segments. Thirty `<path>` elements instead of one is not a browser problem; thirty passes over 50,000 segments would have been, and this does not do that.

Rejected: **one `<path>` per layer always.** It abandons the `indices : null` fast path for every architectural viewport and allocates a `Uint32Array` per category for nothing.
Rejected: **pre-sorting segments into z order in `SitePlanBuild` and keeping the width sort.** The width sort runs afterwards and re-scrambles across bands.
Rejected: **per-layer `<g>` wrappers with DOM reordering.** Needs the merge suppressed, re-shapes the `BandPaths` cache key, and buys nothing the tuple bucket does not.

## 3. The three composite layers

`Na__LeVp2d__PaintSitePlan` writes one SVG containing a `<defs>` and three groups, in REQ-31's order:

```
<defs> ...deduped <pattern> nodes... </defs>
<g data-na-sp="fills">    ...fill paths, ZIndexFill order...
<g data-na-sp="patterns"> ...hatch paths, ZIndexFill order...
<g data-na-sp="lines">    ...bands, (ZIndexLine, width) order...
```

Three groups, not one flat string, because a toggle is then a `hidden` flag on a `<g>` and costs no rebuild at all.

Fills are sorted in the build: `fills.sort((a,b) => a.z - b.z || a.categoryKey.localeCompare(b.categoryKey))` — O(n log n) on ≤30 entries, once per build, never touching the segment arrays.

**REQ-31 is literal and it settles the survey's open question.** The composite is three *stacked layers*; the 1..10 index orders *within* each stack. It does not interleave layer 6's fill above layer 3's linework. REQ-10 is satisfied exactly by this: water lines above tree lines in the line stack, tree fill above water fill in the fill stack. Record as decision **SC15** — this is the reading that keeps the design cheap and it is the one Adam wrote.

The pattern layer's geometry belongs to the hatch-library design; this design fixes its *contract*: `built.patterns = [{ categoryKey, patternId, z, rings, scaleFactor, rotateDeg }]`, filtered on a new `Layer__Style.HatchPatternId` string. Each entry paints as one `<path fill="url(#id)" fill-rule="evenodd">` reusing the **same ring path string** as its fill entry. `<pattern>` nodes are deduped by `(patternId, scaleFactor, rotateDeg, denominator)` and carry `patternTransform="scale(D)"` so hatches measure in paper millimetres (SC08), exactly as stroke widths are multiplied by D.

Toggles: three keys — `sitePlanFills`, `sitePlanPatterns`, `sitePlanLinework` — stored in `Viewport__Styles`, **all defaulting to `true`**. Because `Na__LeRec__NormaliseViewport`'s `pick()` returns the default for an absent key, every already-saved site plan viewport reads all three as on and paints exactly as it does today. No migration, nothing breaks (the non-negotiable).

They go in the **existing** `Na__LayoutEditor__RenderComposites__Config__.json` as three rows with `Composite__Weight : { "Weight__Kind" : "none" }`, plus two new per-row fields, `Composite__Panel` (default `"styles"`) and `Composite__AppliesTo` (default `"all"`). Rejected: a second config file and module — it would need its own `Ready()` joined to `Na__LeMode__ReadyOnce`, its own Rows/Row/Token and a duplicate fallback contract, and the existing config's own `Meta` insists it is "a complete inventory rather than a selective one".

The panel is a new left-column section, `Na__LayoutEditor__Panel__SitePlanStyles__.js` (`Na__LeSpStyles__`, id `siteplan-styles`, title "Site Plan Render Composites"), registered immediately after `Na__LePanelStyles__Register()`. It reuses the existing `style-toggle` control handler verbatim — `Na__LeModel__UpdateViewport(sheet, id, { styles })` — which is the deciding reason the three keys live in `Viewport__Styles` rather than in `Viewport__SitePlan`: zero new model plumbing. It hides itself via `Na__LePanels__SetSectionVisible` when the selection is not a site plan viewport, the precedent being `Na__LePanelScrap__`.

## 4. Screen and paper in step

Both painters consume `Na__LeVp2d__SitePlanBuild`'s output in array order and call the **same** `Na__LeVp2d__StyleBands` with the **same** `spec`. `Na__LePdf__DrawLinework` gains a sixth parameter and passes it through. Band order cannot diverge because there is one function deciding it.

`Na__LePdf__DrawViewport`'s site plan branch gates each layer on `viewport.Viewport__Styles.<key> !== false` — `!== false`, not `=== true`, so a record written before this feature prints everything.

**The holes, fixed here.** The PDF's outer-ring-only path (`if (!ring.outer) return`) has never run against real data (F5) and the first fills Adam ever sees will be the REQ-29 proposal blocks. `Na__LePdf__DrawSitePlanFills` stops using `Na__LeChrome__PushPolyline` (one ring, one path) and instead accumulates subpaths and fills once:

```
Na__LeChrome__WithOpacity(doc, fill.opacity, 1, () => {
    doc.setFillColor(r, g, b);
    fill.rings.forEach((ring) => doc.lines(rel(ring), x0, y0, [1,1], null, true));  // no paint operator
    doc.fillEvenOdd();                                                              // one "f*" over every subpath
});
```

Verified in the vendored build: `putStyle` returns early on `style === null` (jspdf.umd.js ~4486), so `doc.lines(..., null, true)` emits only `m`/`l`/`h`; `API.fillEvenOdd` (~4444) emits `f*` with no `advancedApiModeTrap`. The working precedent in compat mode is `Na__LeGrad__DrawPdf`, which builds a paintless path and clips it. The `ring.outer` skip goes — even-odd needs the inner rings. This also **cuts the fill primitive count** from one per ring to one operator per layer and skips the `Na__LeChrome__DrawToPdf` dispatcher entirely.

Patterns on paper: **vector, clipped** — `doc.lines(..., null, true)` per ring, then `doc.clipEvenOdd()` (~4329, `out("W*")`), `doc.discardPath()`, then the hatch strokes, inside `saveGraphicsState/restoreGraphicsState`. Rejected: a raster tile (this jsPDF drops alpha on the `'RGBA'` path, so it would need a PNG data URL, and a 1:1250 plan shows tile seams at print resolution). Rejected: jsPDF tiling patterns (advanced-API only; the exporter runs compat, y-down mm). Hatch strokes must NOT go through `Na__LePdf__DrawLinework` — its `minSegmentPaperMm` cull (0.05 mm) would eat them by design.

## 5. The cache keys — where stale paint comes from

**`Na__LeVp2d__SitePlanToken`** becomes `'siteplan:' + ExportedIso + ':' + OrderToken + ':' + ModelLayersToken`. `OrderToken` is a new `Na__SpStore__GetOrderToken()` — `layers.map(l => key + ':' + zLine + ':' + zFill).join(',')`, computed **once per descriptor resolve** and memoised on the descriptor, not per paint. Without it, hand-editing the local repo manifest on 127.0.0.1 (which is the whole local test loop, plan §3.4) changes z-indices while `ExportedIso` stays put, and the viewport paints the old order.

**`Na__LeVp2d__SitePlanPaintKey` must NOT absorb the three toggles, and this is the sharpest trap in the feature.** `Na__LeVp2d__StyleToken` = `Na__LeEdge__Token + '#' + Na__LeComposite__Token`, and `Na__LeComposite__Token` reads only `Viewport__CompositeWeights`. The new toggles live in `Viewport__Styles` and are invisible to it — so today's code would flip "Solid Fills" and repaint nothing until something else dirtied the key.

The fix is deliberately *not* to stuff them into the key. Add a separate three-character token and a second early-out:

```
function Na__LeVp2d__SitePlanCompositeToken(viewport) {
    const s = viewport.Viewport__Styles || {};
    return (s.sitePlanFills !== false ? '1' : '0') + (s.sitePlanPatterns !== false ? '1' : '0') + (s.sitePlanLinework !== false ? '1' : '0');
}
```

`Na__LeVp2d__PaintSitePlan` stores `state.spGroups = { fills, patterns, lines }` (the three `<g>` nodes) and `state.spCompositeToken`. `Na__LeVp2d__FillSitePlan` keeps its existing early-out (key match → update `viewBox`, resize, return) and adds, inside it: if `state.spCompositeToken !== token`, flip the three `hidden` flags, restamp, return.

That split is the performance point. A toggle costs three `hidden` assignments. It does **not** rebuild `built` (no re-concatenation of 50,000 segments, no owner table), does **not** re-run `StyleBands`, and does **not** change `Na__LeVp2d__BandPaths`'s key (`built.key + '@false@' + styleToken`), so the band path strings are reused verbatim.

**`Na__LeVp2d__PathCache` — the existing Force Render bug, fixed here.** `Na__LeVp2d__ForceRender`'s site plan branch nulls `state.lineworkKey` but never calls `Na__LeVp2d__ForgetPaths`. A re-export that keeps the same `ExportedIso` (the exporter stamps whole seconds; a hand-edited manifest keeps it entirely) leaves `built.key` identical, so Force Render re-reads the GLBs faithfully and then paints the *old* path strings — precisely the fault the `ForgetPaths` comment was written about, reproduced in the site plan path. Fix: export `Na__LeVp2d__ForgetPaths` from the Linework unit and call it in the site plan branch with the token computed **both before and after** `Na__SpStore__Reload()`, so both generations are swept.

**Do not change the 16-entry FIFO.** Keeping the composite token out of the `BandPaths` key means this feature adds no entries at all. Say so in the code comment, so a later reader does not "fix" it by raising the cap.

**Fills and patterns have no path cache today** — `Na__LeVp2d__RingPathData` runs on every paint, and the pattern layer wants the same string as the fill layer. Add `built.ringPaths`, a `Map(categoryKey → d)` filled lazily in `PaintSitePlan` and hung on `built`. A fill and its pattern then share one `RingPathData` call, and a pan or zoom (which keeps `built`) reuses it. Rejected: a module-level cache — it would need its own eviction and key; `built` already has exactly the right lifetime.

## 6. The location plan rule (REQ-28)

In `Na__LeVp2d__SitePlanBuild`, so the PDF inherits it free.

New `Na__LeScale__IsLocationPlan(denominator)` in ScaleManager, exported: `denominator > LocationPlanAboveDenominator` (config, ships 500). **This resolves the survey's contradiction in favour of the shipped app**: 500 is a Block Plan (as `AddSitePlan` already names it), 1250 is a Location Plan, matching REQ-30's "1:500 or finer → full composite". `AddSitePlan`'s `scale >= 1000` naming line is changed to call the same function in the same commit, so there is one rule, not two.

- **fills**: when a location plan, the filter additionally requires membership of `LayoutEditor__Scales__LocationPlanProposalCategoryKeys` (ships `["TrueVision__SitePlan__ProposedBuildings", "TrueVision__SitePlan__ProposedBuildingsSecondary"]`). Rejected: deriving it from `Layer__Group === 'Buildings'` — that catches ExistingBuildings. Rejected: a new SSOT flag — it is a drawing convention, not a model property, and would need the full four-hop registration for a two-entry list that changes about never.
- **patterns**: empty.
- **linework**: **not recoloured in this build.** On real data the only colours on a PS01 location plan today are the red boundary and the red proposal — precisely the "boundary linework colours" Adam wants kept; everything else is already grey. Suppressing fills and patterns therefore delivers the brief on the data that exists, while a greyscale recolour would have no visible effect on PS01 and an unbounded one on RB05's blue watercourses and green woodland, which Adam may well count as boundary work. The seam is built and costs nothing: `spec.ColourOf(categoryKey, effectiveColour)` is constructed only when `LayoutEditor__Scales__LocationPlanGreyscaleAlias` is a non-empty string, and it ships `null`, so `resolve()` runs byte-identical. Turning it on is a config edit, not a painter change.

## 7. Two things that must ride along or the feature is wrong on arrival

**F3's ceiling.** `Weight__Max` 6.00 → 10.00 in `Na__LayoutEditor__EdgeStyles__Config__.json`. Adam's 2.0 pt proposal line is 0.706 mm and clamps silently to 0.635 today. That is not only a wrong width — a clamped weight also destroys the width *tiebreaker inside a z band*, so two layers at the same z that should stack by weight would merge into one path. Bump `Meta__Version` 1.1.0 → 1.2.0 and the stale `Meta__SsotVersionRead` 2.0.0 → 2.1.0 at the same time.

**REQ-33's new scales introduce a silent blank viewport.** With `SitePlanScaleDenominators : [100, 200, 500, 1250, 2500]`, `AddSitePlan`'s off-map loop (`if (layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[key] = false`) switches **every layer off** on a new 1:200 viewport, because every PS01 layer lists `[500, 1250]`. Guard it: `if (layer.Layer__VisibleAtScales.length > 0 && indexOf(scale) === -1)`. The SSOT should also gain the new scales, but the guard is what stops a blank drawing.

## 8. Test the invariant, not the picture

Per the memory rule "verify results, not paint": the regression test is a snapshot of `Na__LeVp2d__StyleBands`'s band array for a fixture of classes + owners, asserted identical with `spec === null` before and after the change. `Na__SpStore__ZIndex` and the band comparator get a `.test.mjs` — which must copy the source to `.mjs` first, because Node resolves a `.js` in this tree as CommonJS (the survey agent hit this and named it a blocker). `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` after every JS edit.

Release: **v2.88.0**. Four new exports are introduced (`Na__LeVp2d__ForgetPaths`, `Na__LeComposite__PanelRows`, `Na__LeScale__IsLocationPlan`, `Na__SpStore__GetOrderToken`) plus a new module, so `PWA_SW_VERSION_TOKEN` must be bumped from `'2026-09-20-3'` — checked against HEAD first — or a warm cache breaks the editor until the second visit.

#### Files

| Action | Path | What |
|---|---|---|
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | In 71_75__SitePlanTags__, add SitePlan__ZIndexLine and SitePlan__ZIndexFill (integers 1..10) to every site plan tag entry, beside the existing SitePlan__DrawOrder, which STAYS. Adam's values: RedLineBoundary 10; Buildings__Proposed / __ProposedSecondary 5; Buildings__Existing 5; SiteFeature fences 3; MainRoads 2; MinorStreets 1; Waterbodies line 7 / fill 4; Trees line 6 / fill 5 (water line above tree line, tree fill above water fill = REQ-10). Bump meta.version. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | Na__SitePlan__BuildLayerDefinitions: add z_line: entry['SitePlan__ZIndexLine'], z_fill: entry['SitePlan__ZIndexFill'] to the layers[name] hash. Na__SitePlan__Write: add 'Layer__ZIndexLine' => defn[:z_line], 'Layer__ZIndexFill' => defn[:z_fill] to the records << {...} block. Leave the records.sort_by! on Layer__DrawOrder alone. Bump NA__SITEPLAN__EXPORTER_VERSION. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | discover_truevision_siteplan_store: add 'Layer__ZIndexLine' : entry.get('Layer__ZIndexLine') and 'Layer__ZIndexFill' : entry.get('Layer__ZIndexFill') to the manifest-path per-layer dict (it is a closed whitelist), and ': None' for both in the no-manifest fallback dict. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | ADD Na__SpStore__ZIndex(value, drawOrder) — integer 1..10 wins, else clamp(1,10,ceil((drawOrder ?? 50)/10)). Na__SpStore__Layer: add Layer__ZIndexLine / Layer__ZIndexFill via that helper. Na__SpStore__Describe: add a secondary sort key on Layer__CategoryKey after Layer__DrawOrder so concatenation offsets are stable. ADD and export Na__SpStore__GetOrderToken() — layers.map(l => key + ':' + zLine + ':' + zFill).join(','), memoised on the descriptor object at Describe time, NOT recomputed per paint. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js` | Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden, spec): new optional 5th parameter. In resolve(): style.z = spec && spec.ZOf ? spec.ZOf(key) : 0; colour = spec && spec.ColourOf ? spec.ColourOf(key, effective.colour) : effective.colour, with hex recomputed via Na__LeEdge__Hex only when it changed; style.key gains the z prefix. The bucket sort becomes (a.style.z - b.style.z) \|\| (a.style.widthMm - b.style.widthMm). ADD Na__LeVp2d__ForgetPaths to the module exports (it exists but is not exported). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Na__LeVp2d__SitePlanToken: fold in Na__SpStore__GetOrderToken(). ADD Na__LeVp2d__SitePlanCompositeToken(viewport) (three chars from Viewport__Styles, !== false). Na__LeVp2d__SitePlanBuild: build zLine/zFill maps from loaded layers; apply the location-plan rule via Na__LeScale__IsLocationPlan(viewport.Viewport__ScaleDenominator); sort fills by (zFill, categoryKey); add a patterns array (filtered on Layer__Style.HatchPatternId); return { classes, fills, patterns, zLine, spec, ringPaths : new Map(), key }. Na__LeVp2d__PaintSitePlan: emit <defs> + three <g data-na-sp="fills\|patterns\|lines">, pass built.spec to StyleBands, memoise ring path strings in built.ringPaths, store state.spGroups and state.spCompositeToken, set the three hidden flags. Na__LeVp2d__FillSitePlan: inside the existing key-match early-out, add the composite-token early-out that flips the three hidden flags and returns without any string work. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js` | Import Na__LeVp2d__ForgetPaths from the Linework unit. In Na__LeVp2d__ForceRender's site plan branch, call ForgetPaths on the SitePlanToken computed BEFORE Na__SpStore__Reload() and again on the token computed after, then FillSitePlan. Re-export Na__LeVp2d__ForgetPaths alongside Na__LeVp2d__StyleBands for the PDF exporter's use. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js` | Na__LePdf__DrawLinework gains a 6th parameter spec, passed to StyleBands. Na__LePdf__DrawSitePlanFills rewritten: drop Na__LeChrome__PushPolyline and the !ring.outer skip; per fill, inside Na__LeChrome__WithOpacity, setFillColor then doc.lines(rel, x0, y0, [1,1], null, true) per ring then doc.fillEvenOdd(). ADD Na__LePdf__DrawSitePlanPatterns (paintless subpaths, doc.clipEvenOdd(), doc.discardPath(), hatch strokes, inside save/restoreGraphicsState — no minSegmentPaperMm cull). Na__LePdf__DrawViewport's site plan branch gates each of the three on viewport.Viewport__Styles.<key> !== false and passes drawing.spec. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Na__LeRec__STYLE_KEYS: add 'sitePlanFills', 'sitePlanPatterns', 'sitePlanLinework'. Na__LeRec__NormaliseViewport's Viewport__Styles rebuild: add the three pick(...) lines. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__SheetSetup__.js` | Na__LeCfg__DefaultStyles: add sitePlanFills / sitePlanPatterns / sitePlanLinework, all flag(..., true). Na__LeCfg__GetScaleSetup: add locationPlanAbove, locationPlanProposalKeys, locationPlanGreyscaleAlias. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json` | LayoutEditor__Viewport__DefaultStyles: add SitePlanFills / SitePlanPatterns / SitePlanLinework, all true. LayoutEditor__Scales__SitePlanScaleDenominators becomes [100, 200, 500, 1250, 2500]. Add LayoutEditor__Scales__LocationPlanAboveDenominator (500), ...__LocationPlanProposalCategoryKeys, ...__LocationPlanGreyscaleAlias (null) and their ...Note keys. Add the four Labels keys: SitePlanStylesTitle, StyleSitePlanFills, StyleSitePlanPatterns, StyleSitePlanLinework. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__ScaleManager__.js` | ADD and export Na__LeScale__IsLocationPlan(denominator) — parseFloat > setup.locationPlanAbove. ADD Na__LeScale__LocationPlanProposalKeys() and Na__LeScale__LocationPlanGreyscaleAlias(). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json` | Meta__Version 1.2.0 -> 1.3.0; add Meta__WhyTwoPanels and Meta__WhichPanelsExist. Add Composite__Panel and Composite__AppliesTo to every existing row ("styles" / "all"). Add three rows: sitePlanFills (order 110), sitePlanPatterns (120), sitePlanLinework (130), each Composite__Toggle true, Composite__TwoDOnly true, Composite__Panel "sitePlanStyles", Composite__AppliesTo "sitePlan", Composite__Weight { "Weight__Kind": "none" }, with a Composite__Note each. Fallback block gains Fallback__Panel "styles". |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js` | Na__LeComposite__Rows(): map the two new per-row fields onto row.panel and row.appliesTo, defaulting "styles"/"all". ADD and export Na__LeComposite__PanelRows(panelId) = Rows().filter(r => r.panel === panelId). Extend the built-in FALLBACK inventory with the three new rows so the panel is right before the config lands. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js` | Na__LePanelStyles__Rows() returns Na__LeComposite__PanelRows('styles') instead of Na__LeComposite__Rows(). One line; the three new rows belong to the other panel and must not appear here. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__SitePlanStyles__.js` | New left-column section, namespace Na__LeSpStyles__, id 'siteplan-styles'. Na__LeSpStyles__Rows (PanelRows('sitePlanStyles')), __Fill (toggle rows only, no weight cluster), __Build, __Refresh (calls Na__LePanels__SetSectionVisible('siteplan-styles', Na__LeModel__IsSitePlanViewport(selected)) and sets each checkbox from Viewport__Styles[key] !== false), __Register (reuses the existing 'style-toggle' delegated control; no Force Render button). Exports Na__LeSpStyles__Register. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Import and call Na__LeSpStyles__Register() immediately after Na__LePanelStyles__Register() and before Na__LePanelModelLayers__Register(), so the new section sits directly under Render Composites in the left column. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js` | Na__LePanelViewport__AddSitePlan: guard the off-map loop with layer.Layer__VisibleAtScales.length > 0 (otherwise the new 100/200/2500 scales switch every layer off, since PS01's layers list only [500, 1250]); replace the name line's scale >= 1000 with Na__LeScale__IsLocationPlan(scale). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json` | LayoutEditor__EdgeStyles__Weight: Weight__Max 6.00 -> 10.00, and rewrite Weight__Description to say 10.00 = 1.058 mm at the 0.30 pt master and why (Adam's 2.0 pt = 0.706 mm would clamp silently, and a clamped weight also destroys the width tiebreaker inside a z band). Meta__Version 1.1.0 -> 1.2.0; Meta__SsotVersionRead 2.0.0 -> 2.1.0 (stale by one minor). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js` | Bump PWA_SW_VERSION_TOKEN from '2026-09-20-3' (check against HEAD first) and add the matching DEVELOPMENT LOG line. Required: this release adds a new module and four new exports that a warm cache would not have. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanZOrder__.test.mjs` | Tests Na__SpStore__ZIndex's derivation (PS01's 20/40/70/71/90 -> 2/4/7/8/9, strictly increasing and distinct; missing -> 5; explicit 1..10 wins) and the (z, width) band comparator. Must copy the source .js to a temp .mjs first — Node resolves a .js in this tree as CommonJS. Also snapshots Na__LeVp2d__StyleBands's band array with spec === null against a classes+owners fixture, asserting the architectural output is unchanged. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill section 5 (Z-index) and section 10 (composite + location plan) with this design. Add decision SC15 (the composite is three stacked layers; the 1..10 index orders WITHIN each stack, it does not interleave a fill above a line — the reading of REQ-31's literal words) and SC16 (location plan threshold is > 500, resolving the survey's contradiction in favour of the shipped app's Block Plan naming at 1:500). Add ledger rows for each phase below. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` | New v2.88.0 entry, house style: a titled narrative of the three-layer composite, the (z, style) bucket that keeps the merge, the composite-token/build-key split that makes a toggle free, the ForceRender ForgetPaths bug, and the PDF even-odd hole fix. |

#### New keys

- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexLine`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexFill`
- `SitePlanData__Layers[].Layer__ZIndexLine`
- `SitePlanData__Layers[].Layer__ZIndexFill`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexLine`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexFill`
- `Layer__Style.HatchPatternId`
- `LayoutEditor__RenderComposites__Meta.Meta__WhyTwoPanels`
- `LayoutEditor__RenderComposites__Meta.Meta__WhichPanelsExist`
- `LayoutEditor__RenderComposites__Layers[].Composite__Panel`
- `LayoutEditor__RenderComposites__Layers[].Composite__AppliesTo`
- `LayoutEditor__RenderComposites__Fallback.Fallback__Panel`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanFills`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanPatterns`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanLinework`
- `LayoutEditor__Scales__LocationPlanAboveDenominator`
- `LayoutEditor__Scales__LocationPlanAboveDenominatorNote`
- `LayoutEditor__Scales__LocationPlanProposalCategoryKeys`
- `LayoutEditor__Scales__LocationPlanProposalCategoryKeysNote`
- `LayoutEditor__Scales__LocationPlanGreyscaleAlias`
- `LayoutEditor__Scales__LocationPlanGreyscaleAliasNote`
- `LayoutEditor__Labels__SitePlanStylesTitle`
- `LayoutEditor__Labels__StyleSitePlanFills`
- `LayoutEditor__Labels__StyleSitePlanPatterns`
- `LayoutEditor__Labels__StyleSitePlanLinework`
- `Viewport__Styles.sitePlanFills`
- `Viewport__Styles.sitePlanPatterns`
- `Viewport__Styles.sitePlanLinework`

#### Order of work

1. PHASE 1 - MAKE ONE FILL APPEAR (F5 says this whole build sits on a code path that has never drawn a pixel). Give 73__SitePlan__Buildings__Existing a SitePlan__FillColourId and SitePlan__FillOpacity in the Tags SSOT, ask Adam to re-export PS01, and open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 (127.0.0.1, never app.localhost - the local manifest only wins on that hostname). Confirm the fill on screen AND in a PDF before anything else is built. Nothing below is trustworthy until this is seen.
2. PHASE 2 - THE PDF HOLE FIX, ALONE AND MEASURABLE. Rewrite Na__LePdf__DrawSitePlanFills to accumulate paintless subpaths and call doc.fillEvenOdd(). Prove it with a two-ring fixture (outer + inner) that the courtyard is cut on paper as it is on screen. Independently testable and it de-risks every fill that follows.
3. PHASE 3 - THE WEIGHT CEILING. Weight__Max 6.00 -> 10.00 plus the two Meta bumps in Na__LayoutEditor__EdgeStyles__Config__.json. One-line, no dependants, and it must land before any of Adam's new lineweights arrive or they clamp silently. Verify by reading Na__LeEdge__Effective(viewport, 'TrueVision__SitePlan__ProposedBuildings').weight against 2.0 pt.
4. PHASE 4 - THE Z-INDEX, DATA SIDE ONLY. Na__SpStore__ZIndex + the two Layer__ fields + Na__SpStore__GetOrderToken in the store; the build-script whitelist; the Ruby fields; the SSOT values. Testable with no painter change at all: log Na__SpStore__GetLayers() for PS01 and assert 2/4/7/8/9, then assert an explicit SSOT value overrides it. Run Na__Test__SitePlanZOrder__.test.mjs.
5. PHASE 5 - THE BAND COMPARATOR. Add the spec parameter to Na__LeVp2d__StyleBands, the z prefix in the bucket key, the (z, width) sort, and export Na__LeVp2d__ForgetPaths. Assert FIRST that with spec === null the band array for an architectural fixture is byte-identical; only then wire spec from the site plan painter. Run Na__Verify__Exports__.mjs.
6. PHASE 6 - THE FORCERENDER STALE-PATH FIX. Call Na__LeVp2d__ForgetPaths around Na__SpStore__Reload() in Na__LeVp2d__ForceRender's site plan branch. Prove it the way the memory note demands - edit the local manifest's z-indices WITHOUT touching SitePlanData__ExportedIso, press Force Render, and diff the emitted path strings, not the picture.
7. PHASE 7 - THE THREE GROUPS AND THE FILL SORT. Rewrite Na__LeVp2d__PaintSitePlan to emit <defs> + three <g>, sort built.fills by (zFill, categoryKey), and add built.ringPaths. No toggles yet: all three groups visible. Screen and PDF must still look exactly as they did at the end of Phase 2.
8. PHASE 8 - THE TOGGLES. STYLE_KEYS + NormaliseViewport + DefaultStyles + AppConfig defaults (all true), then the three config rows, Na__LeComposite__PanelRows, the one-line change in Na__LePanelStyles__Rows, the new panel module and its ModeController registration. Then Na__LeVp2d__SitePlanCompositeToken and the second early-out in FillSitePlan. Verify the early-out by breakpointing SitePlanBuild and StyleBands - a toggle must reach NEITHER.
9. PHASE 9 - THE LOCATION PLAN RULE. Na__LeScale__IsLocationPlan and the three config keys, then the fills/patterns suppression in Na__LeVp2d__SitePlanBuild, then the AddSitePlan naming line and the VisibleAtScales guard, then the new scale list. Verify on one sheet carrying a 1:500 and a 1:1250 viewport side by side (SC11 says Adam may place both), and in one PDF of that sheet.
10. PHASE 10 - THE PATTERN SLOT. Wire built.patterns and the <defs> dedupe against a single hand-written hatch, to prove the contract, and hand the library itself to the hatch-pattern design. Then bump the version to v2.88.0, bump PWA_SW_VERSION_TOKEN (check against HEAD first), write the DEVLOG entry, update plan sections 5, 10 and the section 12 ledger, and STOP - Adam confirms before any ValeVision port is offered.

#### Risks

- Na__LeRec__STYLE_KEYS gaining three keys grows Viewport__Styles on EVERY viewport, architectural included, because Na__LeRec__NormaliseViewport writes the whole object unconditionally. Every project file will show a three-boolean diff on its next save. Accepted deliberately: it buys the new panel a zero-plumbing write path through the existing 'style-toggle' handler. The alternative (Viewport__SitePlan) is smaller on disk but needs a patch.sitePlan branch in Na__LeModel__UpdateViewport that does not exist (F8).
- The (z, style) bucket splits bands that merge today the moment two site plan layers share colour+weight+linetype but differ in z. F2 names the exact collisions Adam's new tag table creates (MainRoads / NeighbouringBuildings / SiteFeature__Access all Grey L40 at 1.0 pt). If he gives them different z values the drawing gains paths it did not have. Bounded by the layer count, never by the segment count - but it must be stated so a band-count rise is not read as a regression.
- PS01 exercises none of this. Zero fills are painted today, the only fill GLB has FillHex null, the only ring is a 5-point outer with no inner, and fill-rule="evenodd" has never run against real data. The even-odd PDF fix and the hole behaviour are both verified against a fixture, not against a project, until Adam re-exports. Phase 1 exists precisely to close this and must not be skipped.
- REQ-33's new scale list silently blanks a new 1:200 viewport unless the AddSitePlan guard lands in the same change, because every PS01 layer lists Layer__VisibleAtScales [500, 1250] and the off-map loop switches off anything not listed. The guard is in the plan; if the scale list ships without it the symptom is an empty drawing with no error.
- The location-plan linework greyscale is deliberately NOT built (the ColourOf seam ships disabled). If Adam expected RB05's blue watercourses and green woodland to go grey at 1:1250, this reads as the requirement half-done. It is one config value away, but it is an open question, not a silent omission - it is in openForAdam.
- The brief's threshold and the shipped app disagree at exactly 1:500. This design picks > 500 (1:500 is a Block Plan) and changes AddSitePlan's naming line to the same function so there is one rule. If Adam meant >= 500, every site plan drawing in the app loses its existing-site fills, which is a visible change to PS01, and the single config value LocationPlanAboveDenominator is where to flip it.
- The three-<g> SVG changes the shape of state.linework's subtree. I found no positional query into linework.firstElementChild.children, but the snap source (state.classes) and the viewBox early-out (state.lineworkSvg) both live off that node and must be re-checked after the rewrite.
- Whether the service worker STORES site plan GLBs in the tv-models- bucket is still unknown (survey gap). If it does and ?v= is the only buster, a re-export with an unchanged ExportedIso would serve stale geometry from the worker at the same time as the ForceRender fix stops the path cache serving stale strings - two caches that could still agree on the wrong answer. Read the fetch handler's PWA_SW_PATTERN_MODEL_GLB branch before trusting Phase 6's proof.

#### Rejected alternatives

- Redefining Layer__DrawOrder as the 1..10 scale (the literal reading of REQ-08). F1: PS01's published 20/40/70/71/90 would sort entirely above any new 1..10 value, so a half-re-exported project is nonsense. Two new fields plus a store-side derivation from DrawOrder keeps old and new manifests on one scale.
- One Z-index field instead of two. Cannot satisfy REQ-10 (water lines above tree lines while tree fill sits above water fill). This is SC05 and it is settled.
- Abandoning the StyleBands merge and emitting one <path> per layer. It destroys the indices === null fast path, where Na__PlOverlay__BuildPathData walks the raw Float32Array with no index indirection, for every architectural viewport in the app, and allocates a Uint32Array per category for nothing. The (z, style) tuple bucket gets the ordering without touching that path.
- Pre-sorting the segment array into z order in SitePlanBuild and leaving the width sort alone. The width sort runs afterwards and re-scrambles order across bands; within a band it is already redundant because SitePlanBuild concatenates in layer order.
- Per-layer <g> wrappers with data- attributes and DOM-level reordering. Requires the merge suppressed, re-shapes the BandPaths cache key, and buys nothing the tuple bucket does not.
- A separate Na__LayoutEditor__SitePlanComposites__Config__.json and module. It would need its own Ready() joined to Na__LeMode__ReadyOnce, its own Rows/Row/Token and a duplicate Fallback contract; and the existing config's own Meta insists it is 'a complete inventory rather than a selective one'. Two new per-row fields on the existing file is smaller and keeps one inventory.
- Putting the three toggles inside the existing Render Composites panel behind a twoDOnly-style hide. Adam asked for a separate dropdown (REQ-32), and the uniform-tab-styling rule says peers must look alike - a hidden sub-group inside another panel is not a peer.
- Folding the three toggles into Na__LeVp2d__SitePlanToken (the build key). It would rebuild the whole 50,000-segment build, re-run StyleBands and re-key BandPaths every time someone flipped a checkbox. Folding them into a separate three-character token compared inside FillSitePlan's early-out makes a toggle cost three hidden assignments.
- Raising the 16-entry Na__LeVp2d__PathCache FIFO. Keeping the composite token out of the BandPaths key means this feature adds no entries, so the cap does not need to move; changing a cache shared with every architectural viewport for one feature's benefit is a global behaviour change with no evidence behind it.
- Triangulated face meshes instead of rings (SC07 / F7). The parser only asks for MODE_LINES and MODE_LOOP and returns an empty result with no error for triangles; SVG would show hairline seams at every zoom, jsPDF would draw N polygons with N shared anti-aliased edges, and a hatch clip wants the outline the exporter has already produced.
- jsPDF native tiling patterns for the hatch. beginTilingPattern / addShadingPattern sit behind advancedApiModeTrap and throw outside doc.advancedAPI(); the whole exporter runs in compat mode, y-down millimetres.
- A raster PNG tile for the hatch on paper. This jsPDF build drops alpha on the 'RGBA' addImage path so it would have to be a PNG data URL, and a 1:1250 location plan shows tile seams at print resolution. Vector strokes clipped by clipEvenOdd are exact at any scale.
- A new SSOT flag SitePlan__ShowOnLocationPlan to drive REQ-28. It is a drawing convention, not a model property, and it would need the full four-hop registration (Ruby, manifest, build script, Na__SpStore__Style) for a two-entry list that changes about never. A config array of category keys in the app is the right home.
- Deriving the location plan's proposal set from Layer__Group === 'Buildings'. It catches TrueVision__SitePlan__ExistingBuildings, which is exactly what REQ-28 says to omit.
- A per-viewport Z-index override. Na__LeRec__NormaliseProjectedEdges rebuilds every category override as exactly four keys and would silently drop a fifth (F8), and Na__LeEdge__Token would need a fifth field. Z is a layer property; the named seam if Adam ever asks is Viewport__SitePlan plus a new patch.sitePlan branch.

#### Flagged for Adam

- The location plan at 1:1250: should non-boundary LINEWORK go greyscale, or only the fills and patterns be suppressed? On PS01 the only colours already present are the red boundary and the red proposal, so fill suppression alone delivers your words on real data - but RB05 has blue watercourses and green woodland, and I do not know whether you count those as boundary work. The switch is built and ships off; turning it on is one config value (LayoutEditor__Scales__LocationPlanGreyscaleAlias).
- Your Z-index values for the nine new tags and the renames. I have assumed RedLineBoundary 10, buildings 5, fences 3, roads 2, minor streets 1 from your brief, and inferred water line 7 / fill 4 against trees line 6 / fill 5 to make your last bullet true. The two numbers per tag are SitePlan__ZIndexLine and SitePlan__ZIndexFill; please give me the table.

---

## painter:clean  [not chosen]

### Site Plan Composites: an ordered emit the site plan painter owns, three bands, and a 1..10 Z-index that reaches the linework

## The decision that everything else follows from

`Na__LeVp2d__StyleBands` is left untouched. No site-plan branch, no order field on a band, no risk to the thirty-category merge that keeps an architectural drawing to one `<path>`. Instead the site plan stops calling it.

The site plan already has the thing the architectural path does not: a **layer list**. Every layer's geometry is its own `Float32Array` in `Na__SpStore__LayerData`. `Na__LeVp2d__SitePlanBuild` concatenates them into one `classes.visible` with an owner table purely to satisfy the StyleBands contract; StyleBands then reconstructs per-layer identity from that owner table and immediately merges layers back together again. The merge is self-inflicted, and it is the single reason a Z-index cannot exist today.

Cost of abandoning it, measured rather than assumed: PS01's whole store is five layers and ~785 segments; the largest is 364. After Adam's nine new tags the SSOT holds ~25 site plan tags. So the site plan emits at most ~25 `<path>` elements instead of ~5. The merge exists to stop a thirty-category *architectural* drawing becoming thirty paths of tens of thousands of segments each. A site plan is three orders of magnitude smaller. **Dropping the merge for site plans only costs nothing measurable and buys the whole feature** — plus per-layer DOM identity (`data-na-layer`), which the survey flagged as missing and which every later toggle wants.

## The ordering authority: one list, two painters

New module `Na__LayoutEditor__SitePlanComposite__.js` (`Na__LeSpComp__`), beside the site plan painter. It is the only thing in the app that decides site plan draw order. It produces a **plan**:

```
{ Plan__Key, Plan__IsLocationPlan, Plan__Ops : [ op, ... ] }   // bottom to top, already ordered
```

Each op is `{ Op__Kind, Op__CategoryKey, Op__Z, Op__Ordinal, ... }` plus its payload — `Op__Hex`/`Op__Opacity`/`Op__Rings` for a fill, `Op__ColourHex`/`Op__WidthMm`/`Op__DashMm`/`Op__Segments`/`Op__SegmentCount` for a line. Both the SVG painter and the jsPDF painter consume `Plan__Ops` and nothing else. They cannot disagree about order because there is no second ordering decision to get wrong.

**Bands are the major key, Z is the minor key.** `Band__Rank`: fill 0, pattern 1, line 2 — exactly Adam's "1. A solid fill base 2. On top, the patterns 3. On top of that, the linework". Ops are produced band by band and sorted *within* a band by `[Op__Z, Op__Ordinal]`, then concatenated. No global comparator: the band-major rule is structural, and a fourth band later is one array entry plus one builder.

This is also why REQ-10 falls out for free and why SC05's two fields are right. Because *all* fills sit below *all* lines, "water lines above tree lines while the tree fill sits above the water fill" is not a tension at all — it is two independent sorts in two different bands. `SitePlan__ZIndexFill` then orders trees above water inside the fill band. With one index the fill band would inherit the line band's order and the tree fill would land under the water fill.

`Op__Ordinal` is the layer's position in `descriptor.SitePlan__Layers` (already `Layer__DrawOrder`-sorted). Two layers at the same Z therefore keep today's relative order — deterministic, and an SSOT that has not yet been given Z values behaves exactly as it does now.

## Where the Z-index lives

Two new fields, top-level on the layer, **not** inside `Layer__Style`. That is deliberate: a key inside `Layer__Style` needs two registrations (finding F8 — `Na__SpStore__Style` rebuilds seven keys, `Na__LeRec__NormaliseProjectedEdges` rebuilds four), and order is not appearance. Top-level needs one registration in `Na__SpStore__Layer` and one in the Python whitelist, and dodges F8 entirely.

- SSOT tag: `SitePlan__ZIndexLine`, `SitePlan__ZIndexFill` (integers 1-10).
- Ruby `Na__SitePlan__BuildLayerDefinitions`: `z_line:`/`z_fill:`; `Na__SitePlan__Write` writes `Layer__ZIndexLine`/`Layer__ZIndexFill` into each record. `Layer__DrawOrder` is **kept** — it still sorts the manifest and is the legacy fallback.
- Python `discover_truevision_siteplan_store`: both keys added to the per-layer closed list, in both branches.
- `Na__SpStore__Layer`: `Layer__ZIndexLine`/`Layer__ZIndexFill`, `null` when absent.

**The defaulting rule is a rank, not a band table.** F1's warning is that reusing `Layer__DrawOrder` breaks every published manifest — PS01's 20/40/70/71/90 sort above any 1..10 value. So after `Na__SpStore__Describe` has sorted by `Layer__DrawOrder`, `Na__SpStore__DeriveZIndices(layers)` fills every null with `1 + floor(rank / max(1, count - 1) * 9)` and stamps `Layer__ZIndexSource : 'derived'`. That is monotone in `Layer__DrawOrder`, so **an un-migrated manifest draws in exactly the order it draws today**, which is the only promise a fallback should make. A hand-written DrawOrder→Z band table was rejected: two places to keep in step, and it silently mis-maps the moment Adam changes an SSOT number. Rank instability (adding a layer re-ranks) is harmless because Z only ever sorts inside one descriptor, and `Layer__ZIndexSource` means a derived value can never be mistaken for an authored one.

## Line ops without StyleBands

`Na__LeSpComp__LineOps` does per *layer* what StyleBands does per *style bucket*, reusing the pure parts so nothing about weight resolution changes:

- `Na__LeVp2d__StrokeRules(viewport, masterPt).visible` for the base width — keeps the sheet master and the `projectedLinework` composite factor behaving identically.
- `Na__LeEdge__Effective(viewport, categoryKey)` for hex, weight factor and pattern.
- `widthMm = base.widthMm * effective.weight`; dash `= (effective.lineType === 'solid' && Na__LeEdge__SolidMeansClassDefault()) ? base.dashMm : effective.patternMm`.

One op per layer. F2's merge collisions (MainRoads / NeighbouringBuildings / Access all grey-L40-1.0pt) become three ordered paths instead of one unordered path — which is the point.

## Toggling the three layers

The toggles must **not** be a DOM hide. The PDF never touches the DOM, so a DOM hide would be screen-only — precisely the divergence this build has to prevent. The toggles filter inside `Na__LeSpComp__Plan`, so the PDF inherits them for free, the same argument the survey makes for the location-plan rule.

They reuse the Render Composites machinery rather than inventing a second one: `Viewport__Styles` for the flag, `Viewport__CompositeWeights` for any future number, both already normalised, already undoable, already config-driven. Adam asked for a *separate dropdown* with "the same kind of controls", so the mechanism is shared and the panel is not. One new config field, `Composite__Scope` (`"architectural"` when absent, `"siteplan"` on the new rows), splits them; `Na__LeComposite__Rows(scope)` defaults to `'architectural'` so the existing panel is a one-line change and never sees the new rows.

Three rows, not two: `sitePlanFills`, `sitePlanPatterns`, `sitePlanLinework`. Adam named two. The third costs one config row, makes the panel the complete inventory the Render Composites config's own `Meta__WeightKinds` says the file is for, and gives a fills-only check plot. Flagged as a decision taken here. Snapping is unaffected when linework is off — `state.classes` is still the whole store.

The F8-shaped trap here is `Na__LeRec__NormaliseViewport`, which rebuilds `Viewport__Styles` as a **hand-written eight-key literal** that can silently drift from `Na__LeRec__STYLE_KEYS`. It becomes a loop over `STYLE_KEYS`, skipping a site-plan-scoped key on a non-site-plan viewport unless the record already carries it (the same "the prune waits for the config" rule the file already uses for edge styles). The three rows also go into `Na__LeComposite__FALLBACK` so the scope lookup is never unknown.

## Cache keys

Three, and getting any of them wrong paints stale.

1. `Na__LeVp2d__SitePlanToken` is the identity of the **geometry**, and geometry does not change with Z or with a toggle — so it keeps its shape, **except** that the location-plan rule drops geometry from the build. It gains `':' + (isLocationPlan ? 'loc' : 'blk')`. Without this, a 1:500 and a 1:1250 site plan viewport on one sheet would collide in `Na__LeVp2d__PathCache` under the same key and paint each other's drawing. That is a real bug the rule introduces and it closes in the same change.
2. `Na__LeVp2d__SitePlanPaintKey` gains `Na__LeSpComp__ToggleToken(viewport)`. `Na__LeComposite__Token` reads `Viewport__CompositeWeights` only and never sees `Viewport__Styles`, so without this, flipping a composite toggle would change nothing on screen. It is **not** folded into `Na__LeVp2d__StyleToken`, which is shared with the architectural painter and would invalidate every cached architectural band path for no reason.
3. The site plan stops using `Na__LeVp2d__BandPaths`/`Na__LeVp2d__PathCache` entirely and gets its own `Na__LeSpComp__PathCache` keyed by `Plan__Key`. Reasons: `BandPaths` files paths by band *index*, and an op list changes length the moment a toggle flips, so index-keyed caching is unsound; the 16-entry FIFO is sized for architectural drawings and a site plan sharing it evicts them; and it is the last borrowed contract. Bonus: `Na__LeVp2d__ForceRender`'s site plan branch currently clears **no** path cache — a latent stale-paint bug on a re-export with an unchanged `ExportedIso`. It gains `Na__LeSpComp__ForgetAll()`.

## Screen and paper

`Na__LeVp2d__PaintSitePlan` walks `Plan__Ops`, opening a `<g data-na-sp-band="...">` at each band change (skipped when a band has no ops). `Na__LePdf__DrawSitePlanFills` is **deleted** and the site plan branch of `Na__LePdf__DrawViewport` becomes one call to `Na__LePdf__DrawSitePlanPlan`, walking the same ops in the same order.

The hole bug is fixed in that one function, because it is now the only place fills reach paper. Verified in the vendored jsPDF 4.1.0: `putStyle` returns early on a `null` style, so `doc.lines(rel, x, y, [1,1], null, true)` emits path operators with no painting operator; `'f*'` is in `isValidStyle`'s list. So every ring of a face is emitted with style `null` and the last one with `'f*'` — even-odd fill with holes, in compat mode, no advanced API, no `advancedApiModeTrap`. The hard constraint: PDF forbids other operators between path construction and painting, so the fill colour and the GState alpha (`Na__LeChrome__WithOpacity`) must be set **before** the first `moveTo`. This is a new `Na__LeChrome__PushPolygonRings` primitive rather than a hand-rolled block in the exporter, so the sheet chrome keeps owning jsPDF.

## The location-plan rule (REQ-28)

It lives in `Na__LeSpComp__Plan`, not literally in `Na__LeVp2d__SitePlanBuild` — but `Plan` is what `Na__LeVp2d__SitePlanDrawing` calls and the PDF awaits, so the finding's intent (the PDF inherits it for free) is honoured exactly.

Threshold: `Location__ThresholdDenominator : 500` with a **strictly greater** test, which reads as Adam's literal "Viewports over 1:500". The survey flags a contradiction with `Na__LePanelViewport__AddSitePlan`'s `scale >= 1000`; on the scale list [100, 200, 500, 1250, 2500] the two tests agree on every value, so the contradiction is hypothetical and does not need Adam. Adam's own Task 06 text puts 1:500 in the composite set ("1:100, a 1:200, or a 1:500"), which settles it.

What it does: drop every fill op whose category key is not in `Location__ProposalFillKeys` (the two Proposed building stems); drop every pattern op; and force every line op's colour to `Location__GreyscaleAlias` (`"soft-black"`) unless its key is in `Location__KeepColourKeys` (the union of the boundary stems and the proposal stems — the proposal outline must stay red or it would be a grey line round a red fill) **or** `Na__LeEdge__Effective(...).overridden === true`. That last clause is the right seam and it already exists: a per-viewport edge override is a deliberate decision and the EdgeStyles design says a record holds only real decisions. `SettingOutLines` is excluded from the keep set — it is red but it is a setting-out aid, not a boundary, and at 0.13 mm it is invisible at 1:1250 anyway. The rule does not touch `Viewport__ModelLayers`; the existing `Layer__VisibleAtScales` off-map is separate and both apply.

## The pattern band, present from day one

`Op__Kind: 'pattern'` and `Na__LeSpComp__PatternOps` exist from the first commit and return `[]` until the hatch build lands. The `sitePlanPatterns` toggle exists and is honoured. The pattern band's Z reuses `Layer__ZIndexFill` — a hatch belongs to the same polygon as the fill and nobody would order them differently; a third SSOT field was rejected as a field no one would ever set. A provider-registration hook was also rejected as over-engineering for a one-team codebase: the hatch build edits one function body.

## Phase 1 must make one real fill appear

Finding F5 is load-bearing: zero site plan fills have ever been painted. Before any of this is layered, `73__SitePlan__Buildings__Existing` gets a `SitePlan__FillColourId` in the SSOT, Adam re-exports, and the fill is seen on screen **and in a PDF** at `http://127.0.0.1:8523/...?project=PS01&project-folder=PS01__MustersRoad&year=26`. That is the only way the even-odd hole behaviour and the opacity are observed rather than assumed.

#### Files

| Action | Path | What |
|---|---|---|
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__SitePlanComposite__.js` | NEW. Namespace Na__LeSpComp__. The only ordering authority for site plan drawings. Exports: Na__LeSpComp__Ready, Na__LeSpComp__Bands, Na__LeSpComp__BAND_FILL / __BAND_PATTERN / __BAND_LINE (the Op__Kind constants), Na__LeSpComp__IsLocationPlan(viewport), Na__LeSpComp__IsBandOn(viewport, bandKey), Na__LeSpComp__ToggleToken(viewport), Na__LeSpComp__Plan(viewport, loaded, masterPt), Na__LeSpComp__RingPathData(rings), Na__LeSpComp__Paths(planKey, ops), Na__LeSpComp__Forget(prefix), Na__LeSpComp__ForgetAll. Internal: Na__LeSpComp__FillOps, Na__LeSpComp__PatternOps (returns [] until the hatch build), Na__LeSpComp__LineOps, Na__LeSpComp__ZIndexOf(layer, bandKey), Na__LeSpComp__PathCache (own 8-entry FIFO), Na__LeSpComp__BANDS fallback array. Imports Na__LeVp2d__StrokeRules from Na__LayoutEditor__Viewport2d__Linework__.js, Na__LeEdge__Effective / __SolidMeansClassDefault from EdgeStyles, Na__LeComposite__Row from RenderComposites. Never imports the site plan painter (no cycle). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__SitePlanComposite__Config__.json` | NEW config, four blocks: LayoutEditor__SitePlanComposite__Meta (Meta__FileName, Meta__Description, Meta__Version 1.0.0, Meta__Created, Meta__Author, plus prose Meta__WhyBandMajor, Meta__WhyTwoZIndices, Meta__WhyNotStyleBands, Meta__WhichFallback, Meta__WhereOrderWasBefore); LayoutEditor__SitePlanComposite__Bands (array of Band__Key / Band__Rank / Band__CompositeKey / Band__ZField / Band__Label / Band__Note); LayoutEditor__SitePlanComposite__ZIndex (ZIndex__Description, ZIndex__Min 1, ZIndex__Max 10, ZIndex__Default 5, ZIndex__DeriveFromDrawOrder true); LayoutEditor__SitePlanComposite__LocationPlan (Location__Description, Location__ThresholdDenominator 500, Location__TestIsStrictlyGreater true, Location__DropPatterns true, Location__GreyscaleAlias "soft-black", Location__ProposalFillKeys + Location__ProposalFillKeysNote, Location__KeepColourKeys + Location__KeepColourKeysNote). 4-space indent, values aligned, matching Na__LayoutEditor__EdgeStyles__Config__.json exactly. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Na__LeVp2d__SitePlanToken: append ':' + (Na__LeSpComp__IsLocationPlan(viewport) ? 'loc' : 'blk'). Na__LeVp2d__SitePlanPaintKey: append '\|' + Na__LeSpComp__ToggleToken(viewport). Na__LeVp2d__SitePlanBuild: returns { classes, loaded, key } - the fills array is removed (ops own it), loaded is the array of layer data. Na__LeVp2d__SitePlanDrawing: returns { classes, plan, key } where plan = Na__LeSpComp__Plan(...). Na__LeVp2d__RingPathData: DELETED (moved to the composite module). Na__LeVp2d__PaintSitePlan: rewritten to walk plan.Plan__Ops, opening a <g data-na-sp-band="fill\|pattern\|line"> at each band change and emitting one <path data-na-layer="<categoryKey>"> per op; no longer calls Na__LeVp2d__StyleBands or Na__LeVp2d__BandPaths. NEW helper Na__LeVp2d__SitePlanOpSvg(op, D, pathData). Imports drop Na__LeVp2d__StyleBands and Na__LeVp2d__BandPaths, add the composite module. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | Na__SpStore__Layer: add Layer__ZIndexLine, Layer__ZIndexFill (null when absent or out of range), Layer__ZIndexSource ('manifest' or null). NEW helper Na__SpStore__ZIndex(value) - finite integer clamped to 1..10, else null. NEW helper Na__SpStore__DeriveZIndices(layers) - after the Layer__DrawOrder sort, fills every null with 1 + Math.floor(rank / Math.max(1, count - 1) * 9) and stamps Layer__ZIndexSource 'derived'. Na__SpStore__Describe: call Na__SpStore__DeriveZIndices on the sorted list before returning. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js` | Na__LeComposite__Rows(scope) - scope defaults to 'architectural'; a row with no Composite__Scope reads as 'architectural'. NEW Na__LeComposite__AllRows() (unfiltered) backing Na__LeComposite__Row(key). Na__LeComposite__Index becomes Map<scope, Map<key,row>> or is built from AllRows. Na__LeComposite__ToggleRows(scope) / Na__LeComposite__WeightRows(scope) take the scope through. NEW Na__LeComposite__ToggleKeys(scope) and Na__LeComposite__ToggleToken(viewport, scope) - the on/off state of every toggle row in that scope as a stable sorted string, for a paint key. Na__LeComposite__FALLBACK gains the three siteplan rows so the scope lookup is never unknown before the fetch lands. Export the new functions. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json` | Add Composite__Scope : "architectural" to the eight existing rows (explicit, though absence reads the same). Append three rows with Composite__Scope : "siteplan", Composite__Toggle true, Composite__TwoDOnly true, Composite__Weight { Weight__Kind: "none" }: sitePlanFills (Order 910, "Fill Base Layer"), sitePlanPatterns (Order 920, "Hatch Pattern Layer"), sitePlanLinework (Order 930, "Linework Layer"), each with a Composite__Note. Add Meta__WhyScope prose and bump Meta__Version to 1.3.0. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Na__LeRec__STYLE_KEYS gains 'sitePlanFills', 'sitePlanPatterns', 'sitePlanLinework'. Na__LeRec__NormaliseViewport: the hand-written eight-key Viewport__Styles literal becomes a loop over Na__LeRec__STYLE_KEYS, so the list and the rebuild can no longer drift; a key whose Na__LeComposite__Row(key) says scope 'siteplan' is skipped on a non-site-plan viewport UNLESS the record already carries it, and a key whose row is unknown (config not yet fetched) is kept if present and not added if absent. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__SheetSetup__.js` | Na__LeCfg__DefaultStyles gains sitePlanFills : flag('SitePlanFills', true), sitePlanPatterns : flag('SitePlanPatterns', true), sitePlanLinework : flag('SitePlanLinework', true). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json` | LayoutEditor__Viewport__DefaultStyles gains SitePlanFills / SitePlanPatterns / SitePlanLinework, all true. LayoutEditor__Scales__SitePlanScaleDenominators becomes [100, 200, 500, 1250, 2500] (REQ-33) and the LayoutEditor__Scales__Description sentence about 1:500 / 1:1250 is rewritten to name the block-plan / location-plan split at 500. LayoutEditor__Labels__Config gains SitePlanCompositesTitle ("Site Plan Render Composites"), StyleSitePlanFills, StyleSitePlanPatterns, StyleSitePlanLinework, SitePlanCompositesNote ("Select a site plan viewport on the sheet.") and SitePlanLocationPlanNote (what the coarse-scale rule is suppressing). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__SitePlanComposites__.js` | NEW left-column panel, namespace Na__LePanelSpComp__. Na__LePanelSpComp__Register() registers section id 'siteplan-composites', title from Na__LeCfg__GetLabel('SitePlanCompositesTitle', 'Site Plan Render Composites'). Build/Refresh copied in shape from Na__LayoutEditor__Panel__Styles__.js: rows from Na__LeComposite__Rows('siteplan'), a checkbox per toggle writing { styles : { <key> : checked } } through Na__LeModel__UpdateViewport, and a note when nothing is selected. Refresh calls Na__LePanels__SetSectionVisible('siteplan-composites', Na__LeModel__IsSitePlanViewport(selected)) so the section is absent on an architectural sheet, and shows the location-plan note when Na__LeSpComp__IsLocationPlan(viewport). Listens on Na__SpStore__CHANGED_EVENT and awaits Na__LeComposite__Ready() / Na__LeSpComp__Ready(). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js` | Na__LePanelStyles__Rows() returns Na__LeComposite__Rows('architectural') so the existing Render Composites panel never lists the three new site plan rows. One line. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Import and call Na__LePanelSpComp__Register() immediately after Na__LePanelStyles__Register() and before Na__LePanelModelLayers__Register(). Add Na__LeSpComp__Ready() to the Na__LeMode__ReadyOnce Promise.all, or the config is not awaited before the first sheet is normalised. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js` | Na__LeVp2d__ForceRender site plan branch: call Na__LeSpComp__ForgetAll() beside the existing Na__SpStore__Reload() / Na__SpStore__LoadAll(). This also closes a pre-existing bug: the branch cleared no path cache at all, so a re-export with an unchanged SitePlanData__ExportedIso repainted stale paths from Na__LeVp2d__PathCache. Header DESCRIPTION updated (it names SitePlanBuild / RingPathData). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js` | Na__LePdf__DrawSitePlanFills: DELETED. NEW Na__LePdf__DrawSitePlanPlan(doc, sheet, viewport, described, plan) - walks plan.Plan__Ops in order; a fill op goes through the new Na__LeChrome__PushPolygonRings primitive, a line op transforms its own Op__Segments to paper and draws with doc.line under the existing minSegmentPaperMm cull and frame-reject, a pattern op is ignored until the hatch build. Na__LePdf__DrawViewport site plan branch replaced by one call to it; the Na__LePdf__DrawLinework call for site plans is removed. Na__LeVp2d__StyleBands import kept (still used by the architectural path). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\10__Core__SheetSurface\Na__LayoutEditor__SheetChrome__.js` | NEW primitive kind Na__LeChrome__KIND_POLYRINGS and NEW Na__LeChrome__PushPolygonRings(list, rings, fillColour, extra) where rings is [[ [x,y], ... ], ...]. In Na__LeChrome__ToPdf, the new branch sets the fill colour and the GState alpha through Na__LeChrome__WithOpacity FIRST (PDF forbids other operators between path construction and the painting operator), then emits every ring but the last with doc.lines(rel, x, y, [1,1], null, true) and the last with style 'f*' - even-odd, holes cut, compat mode, no advancedApiModeTrap. In the SVG branch, one <path> with fill-rule="evenodd" built from the same rings, so screen and paper agree. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | Every entry under Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__ gains SitePlan__ZIndexLine and SitePlan__ZIndexFill (integers 1-10), placed immediately after SitePlan__DrawOrder, which is KEPT. Adam's stated values: RedLine 10, BlueLine 10, Proposed/ProposedSecondary ~5 with buildings, WallsAndFences 3, OsMapping MainRoads 2, MinorStreets 1. Fill indices set so trees sit above waterbodies. Also add SitePlan__FillColourId to 73__SitePlan__Buildings__Existing for the Phase 1 proof. Bump the file's meta.version and lastUpdated. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | Na__SitePlan__BuildLayerDefinitions: the definition hash gains z_line: entry['SitePlan__ZIndexLine'] and z_fill: entry['SitePlan__ZIndexFill'], beside draw_order:. Na__SitePlan__Write: the records << { ... } block gains 'Layer__ZIndexLine' => defn[:z_line] and 'Layer__ZIndexFill' => defn[:z_fill] after 'Layer__DrawOrder'. The records.sort_by! on Layer__DrawOrder is unchanged. Bump NA__SITEPLAN__EXPORTER_VERSION (schema version stays 1 - the two keys are additive and TrueVision defaults them). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | discover_truevision_siteplan_store: the per-layer closed list in the manifest branch gains 'Layer__ZIndexLine' : entry.get('Layer__ZIndexLine') and 'Layer__ZIndexFill' : entry.get('Layer__ZIndexFill'); the filename-fallback branch gains both as None. Without this the two keys die at this hop and every deployed project falls back to the derived rank. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js` | Bump PWA_SW_VERSION_TOKEN (currently '2026-09-20-3') and add the matching DEVELOPMENT LOG line. Required: the release adds a new module whose exports a warm shell cache does not have, which breaks the editor until a second visit. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanComposite__.test.mjs` | NEW. Pure-logic regression test for the ordering authority, the first site plan test of any kind. Copies Na__LayoutEditor__SitePlanComposite__.js to a temp .mjs (Node resolves .js here as CommonJS - the survey's blocker) or re-exports its pure helpers. Asserts: band-major ordering (every fill op precedes every pattern op precedes every line op); Z ordering inside a band; Op__Ordinal as the tiebreak; that a layer list with no Layer__ZIndex* fields derives a monotone rank so PS01's 20/40/70/71/90 keeps its present relative order; that the location-plan rule at 1250 keeps only the two proposal fills, drops all patterns and greys every non-keep line; and that Plan__Key changes when a toggle flips or the denominator crosses 500. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill section 5 (Design - Z-index) and section 10 (Design - the composite and the location plan rule) with this design. Add decisions SC15 (bands are the major key, Z the minor key - REQ-10 needs no interleaving), SC16 (the site plan painter owns its emit; StyleBands is untouched; the merge is abandoned for site plans only, with the segment counts as the evidence), SC17 (the Z fallback is a rank derived in Na__SpStore__Describe, not a band table, and not Layer__DrawOrder), SC18 (location-plan threshold is strictly greater than 500, which agrees with the shipped >= 1000 naming on every listed scale), SC19 (three composite toggles, not two), SC20 (the pattern band reuses Layer__ZIndexFill). Update the section 12 ledger. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` | New version entry at the top, in house style (title line, Overview, then a section per change), recording: the painter that stopped borrowing StyleBands; the two Z fields and why Layer__DrawOrder could not be reused; the three bands; the even-odd hole fix that made paper agree with screen; the location-plan rule; and the ForceRender cache bug closed on the way past. |

#### New keys

- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexLine`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__ZIndexFill`
- `TrueVision__SitePlanData__Manifest__.json.SitePlanData__Layers[].Layer__ZIndexLine`
- `TrueVision__SitePlanData__Manifest__.json.SitePlanData__Layers[].Layer__ZIndexFill`
- `TrueVision__ProjectData__.json.SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexLine`
- `TrueVision__ProjectData__.json.SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexFill`
- `LayoutEditor__SitePlanComposite__Meta.Meta__FileName`
- `LayoutEditor__SitePlanComposite__Meta.Meta__Description`
- `LayoutEditor__SitePlanComposite__Meta.Meta__Version`
- `LayoutEditor__SitePlanComposite__Meta.Meta__Created`
- `LayoutEditor__SitePlanComposite__Meta.Meta__Author`
- `LayoutEditor__SitePlanComposite__Meta.Meta__WhyBandMajor`
- `LayoutEditor__SitePlanComposite__Meta.Meta__WhyTwoZIndices`
- `LayoutEditor__SitePlanComposite__Meta.Meta__WhyNotStyleBands`
- `LayoutEditor__SitePlanComposite__Meta.Meta__WhichFallback`
- `LayoutEditor__SitePlanComposite__Meta.Meta__WhereOrderWasBefore`
- `LayoutEditor__SitePlanComposite__Bands[].Band__Key`
- `LayoutEditor__SitePlanComposite__Bands[].Band__Rank`
- `LayoutEditor__SitePlanComposite__Bands[].Band__CompositeKey`
- `LayoutEditor__SitePlanComposite__Bands[].Band__ZField`
- `LayoutEditor__SitePlanComposite__Bands[].Band__Label`
- `LayoutEditor__SitePlanComposite__Bands[].Band__Note`
- `LayoutEditor__SitePlanComposite__ZIndex.ZIndex__Description`
- `LayoutEditor__SitePlanComposite__ZIndex.ZIndex__Min`
- `LayoutEditor__SitePlanComposite__ZIndex.ZIndex__Max`
- `LayoutEditor__SitePlanComposite__ZIndex.ZIndex__Default`
- `LayoutEditor__SitePlanComposite__ZIndex.ZIndex__DeriveFromDrawOrder`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__Description`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__ThresholdDenominator`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__TestIsStrictlyGreater`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__DropPatterns`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__GreyscaleAlias`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__ProposalFillKeys`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__ProposalFillKeysNote`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__KeepColourKeys`
- `LayoutEditor__SitePlanComposite__LocationPlan.Location__KeepColourKeysNote`
- `LayoutEditor__RenderComposites__Layers[].Composite__Scope`
- `LayoutEditor__RenderComposites__Meta.Meta__WhyScope`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanFills`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanPatterns`
- `LayoutEditor__Viewport__DefaultStyles.SitePlanLinework`
- `LayoutEditor__Labels__SitePlanCompositesTitle`
- `LayoutEditor__Labels__SitePlanCompositesNote`
- `LayoutEditor__Labels__SitePlanLocationPlanNote`
- `LayoutEditor__Labels__StyleSitePlanFills`
- `LayoutEditor__Labels__StyleSitePlanPatterns`
- `LayoutEditor__Labels__StyleSitePlanLinework`
- `Viewport__Styles.sitePlanFills`
- `Viewport__Styles.sitePlanPatterns`
- `Viewport__Styles.sitePlanLinework`

#### Order of work

1. PHASE 0 - make one real fill appear (finding F5; nothing here is safe to build on an unexercised path). Give 73__SitePlan__Buildings__Existing a SitePlan__FillColourId in the Tags SSOT, ask Adam to re-export PS01, and open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 (127.0.0.1 or localhost only - the local manifest wins there, so no build and no R2 sync). Confirm the fill on screen AND in an exported PDF. Record what the opacity and the single 5-point ring actually look like. Do not proceed until seen.
2. PHASE 1 - the ordering authority, with no behaviour change. Write Na__LayoutEditor__SitePlanComposite__.js and its config. Wire Na__LeSpComp__Ready() into Na__LeMode__ReadyOnce. Add the two Z fields to Na__SpStore__Layer and Na__SpStore__DeriveZIndices to Na__SpStore__Describe. Write Na__Test__SitePlanComposite__.test.mjs and prove the rank fallback reproduces PS01's present relative order exactly. Nothing paints from the plan yet. Run node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs.
3. PHASE 2 - the screen paints from the plan. Rewrite Na__LeVp2d__SitePlanBuild / __SitePlanDrawing / __PaintSitePlan; delete Na__LeVp2d__RingPathData; add the two cache-key changes (the loc/blk discriminator on SitePlanToken, the toggle token on SitePlanPaintKey) and Na__LeSpComp__ForgetAll() in Na__LeVp2d__ForceRender. The three <g> bands and the per-layer data-na-layer attribute appear. With no toggles and no Z values in the SSOT yet, PS01 must be pixel-identical to before except that merged bands are now separate paths - check that first, on a screenshot diff.
4. PHASE 3 - the paper follows. Add Na__LeChrome__KIND_POLYRINGS / Na__LeChrome__PushPolygonRings with the even-odd multi-subpath fill; delete Na__LePdf__DrawSitePlanFills; add Na__LePdf__DrawSitePlanPlan and repoint Na__LePdf__DrawViewport. Export a PDF of the PS01 fill from Phase 0 and prove the ring order matches the screen and that a face with an inner ring now cuts its hole on paper. This is the phase that closes the screen/paper hole disagreement.
5. PHASE 4 - the toggles. Add Composite__Scope and the three rows to the RenderComposites config and module; add the three keys to Na__LeRec__STYLE_KEYS and turn the Viewport__Styles literal into a loop; add the three defaults to Na__LeCfg__DefaultStyles and the app config; scope the existing Styles panel to 'architectural'; write Na__LayoutEditor__Panel__SitePlanComposites__.js and register it. Prove: flipping a toggle repaints immediately (the paint key), survives save/reload/undo (the normaliser loop), reaches the PDF, and that the three keys are NOT written onto architectural viewport records.
6. PHASE 5 - the location-plan rule. Implement Na__LeSpComp__IsLocationPlan and the filtering inside Na__LeSpComp__Plan. Widen LayoutEditor__Scales__SitePlanScaleDenominators to [100, 200, 500, 1250, 2500] (REQ-33) in the same commit, because the rule is defined over the denominator. Put two site plan viewports on one sheet at 1:500 and 1:1250 and prove they paint differently - this is also the regression test for the SitePlanToken loc/blk discriminator.
7. PHASE 6 - the real Z values end to end. Add SitePlan__ZIndexLine / SitePlan__ZIndexFill to every site plan tag in the SSOT with Adam's numbers; add z_line/z_fill to the Ruby definition hash and the manifest record; add both keys to the Python build script's per-layer whitelist. Ask Adam to re-export RB05 (decision SC03: he runs every SketchUp test). Prove the water line paints over the tree line while the tree fill paints over the water fill - the literal REQ-10 acceptance test. Then run the ProjectVision build and confirm the two keys survive to SitePlan__DataStore.
8. PHASE 7 - release. Bump the app version and PWA_SW_VERSION_TOKEN, write the DEVLOG entry, update plan doc sections 5, 10 and the section 12 ledger with SC15-SC20. Run Na__Verify__Exports__.mjs and Na__Verify__ModuleGraph__.mjs. Do NOT offer the ValeVision port: per the standing rule that is offered only after Adam confirms the TrueVision work, and per survey finding 7 it would be a surgical merge, never a file copy.

#### Risks

- Raising Weight__Max is NOT in this piece but blocks it in practice. Finding F3: the ceiling is 6.00 x 0.10584 = 0.635 mm and Adam's new 2.0 pt = 0.706 mm is silently clamped. A Z-index that correctly puts the proposal below the red line will look right even while the proposal's weight is wrong, so the two faults will mask each other. Whoever does the tags work must raise Weight__Max to 10.00 in Na__LayoutEditor__EdgeStyles__Config__.json; flag it if that build has not landed before Phase 6.
- Phase 2 changes what the SVG contains for every existing site plan viewport. A merged band becomes N paths of identical style, which is visually identical but not byte-identical. Anything that reads the linework SVG by structure (a screenshot test, a selector) breaks. Grep for '.na-le-frame__linework-svg' before Phase 2.
- The even-odd PDF fill depends on jsPDF's putStyle returning early on a null style and on 'f*' being in isValidStyle - both verified in the vendored 4.1.0 build, neither is a documented public contract. A jsPDF upgrade could break it silently into an unfilled or non-holed polygon. The Phase 3 acceptance test must be a real PDF opened in a reader, not a unit test.
- PDF forbids operators between path construction and the painting operator. If the fill colour or the GState alpha is set after the first moveTo, some readers ignore it and some refuse the page. Na__LeChrome__WithOpacity must wrap the whole ring emission, not each ring.
- Na__LeRec__NormaliseViewport's Viewport__Styles rebuild runs on every load of every project. Turning a literal into a loop is the single highest-blast-radius edit in this design: a mistake silently rewrites every viewport record in every project. Do it alone, with the existing eight keys and nothing else, and confirm a byte-identical save before the three new keys are added.
- The Z rank fallback is monotone in Layer__DrawOrder, so it preserves order - but it does NOT reproduce Adam's numbers. PS01's red line at DrawOrder 90 derives to 9, not 10, until the SSOT carries explicit values. If Adam looks at a derived value in a future UI he will read it as wrong. Layer__ZIndexSource exists for exactly this; any UI that shows a Z must show the source too.
- Finding F2's merge collisions are now ordered, but two layers with identical colour, weight and line type are still visually indistinguishable. A Z-index between them is real in the DOM and invisible on paper. Adam may report the Z-index 'not working' when it is working on layers he cannot tell apart. Say so when handing it over.
- The location-plan rule suppresses fills that a viewport's own Viewport__ModelLayers may already suppress, and greys colours a per-viewport edge override may already have set. The override escape hatch (effective.overridden) means a viewport Adam has curated will not obey the rule. That is deliberate, and it will look like a bug the first time it happens.

#### Rejected alternatives

- Adding a site-plan branch to Na__LeVp2d__StyleBands that sorts by Z instead of by width. Rejected: StyleBands is shared with every architectural viewport and with the PDF's architectural path, its merge is what keeps a thirty-category drawing to one path, and a branch inside it would have to carry a Z through the owner table and out the other side. The site plan does not need the merge (25 layers, ~800 segments) and does need ordering, so the honest answer is a separate emit, not a flag on a shared one.
- Adding an explicit order field to a band and leaving the merge in place. Rejected: a merged band has no single Z. Two layers merged into one path cannot be ordered against each other by construction, which is exactly the case Adam's new tag table creates (MainRoads / NeighbouringBuildings / Access all grey L40 at 1.0 pt).
- Redefining Layer__DrawOrder as 1..10. Rejected outright on the survey's evidence: PS01's published manifest holds 20/40/70/71/90 and would sort entirely above any new value, so the red line would end up under everything new. A new key with a derived fallback is the only shape that does not break already-published data.
- A hand-written DrawOrder-to-Z band table as the fallback. Rejected: two places to keep in step (the table and the SSOT), and it mis-maps silently the moment Adam changes an SSOT number. A rank derived from the already-sorted list is provably order-preserving and needs no maintenance.
- A third SSOT field, SitePlan__ZIndexPattern. Rejected: a hatch belongs to the same polygon as the fill it sits on, and there is no drawing in which they would be ordered differently. The pattern band reads Layer__ZIndexFill.
- Storing the composite toggles in Viewport__SitePlan (which finding F8 says survives normalisation as a shallow copy). Rejected: Na__LeModel__UpdateViewport has no patch.sitePlan branch, so it would need one; and it would mean re-inventing the record normalising, the undo integration and the cache token that Viewport__Styles / Na__LeComposite__Token already provide. Reusing the Render Composites record plumbing with a scope field is a far smaller surface.
- Toggling the bands by hiding the <g> elements in the DOM. Rejected: the PDF exporter never touches the DOM, so the toggle would be screen-only and the paper would silently disagree - the exact failure mode this build exists to remove. The filter belongs in the shared plan.
- Keeping Na__LeVp2d__BandPaths for the site plan. Rejected: it files path strings by band INDEX, and an op list changes length whenever a toggle flips, so index-keyed caching is unsound the moment toggles exist. It also shares a 16-entry FIFO sized for architectural drawings.
- Folding the toggle token into Na__LeVp2d__StyleToken. Rejected: StyleToken is also the architectural linework path-cache key, so every architectural viewport's cached band paths would be invalidated by a site plan toggle that cannot possibly affect them.
- Switching the fill export to triangles (finding F7 / SC07). Rejected and not revisited: the GLB parser matches an exact primitive mode and a triangle GLB parses to an empty result with no error; SVG and jsPDF both want a closed ring; and a hatch has to be clipped to an outline, which triangles would have to be re-stitched into.
- Making the screen match the PDF by dropping fill-rule="evenodd". Rejected: it degrades the correct painter to match the broken one. The PDF is fixed instead.
- Setting the location-plan threshold at >= 1000 to match Na__LePanelViewport__AddSitePlan's naming. Rejected as a distinction without a difference: on the scale list [100, 200, 500, 1250, 2500] a strictly-greater-than-500 test and a >= 1000 test agree on every value. The strictly-greater form is kept because it reads as Adam's literal words, 'Viewports over 1:500'.
- A provider-registration hook (Na__LeSpComp__SetPatternProvider) so the hatch build could plug in without editing the composite module. Rejected as over-engineering for a one-team codebase that imports directly everywhere else. Na__LeSpComp__PatternOps returns [] with a comment naming the module that will fill it.

#### Flagged for Adam

- The nine SitePlan__ZIndexLine and SitePlan__ZIndexFill values themselves. Adam gave five anchors (red line 10, buildings ~5, fences 3, roads 2, minor streets 1) and one relation (water lines above tree lines, tree fill above water fill). Everything else across 25 tags is interpolation. Phase 6 should put the full table to him as a single list before it goes into the SSOT - it is a five-minute read for him and a guess for anyone else.
- Whether the third toggle, Linework Layer, should exist. He asked for two ('flip off the coloured underlying filled polygon and hatched polygon layers'). The third is taken here because it makes the panel a complete inventory and gives a fills-only check plot, but switching the linework off produces a drawing he may consider meaningless and would rather not be able to make by accident.

---

## hatch:geometry  [not chosen]

### Hatch patterns for site plan polygons: one paper-millimetre generator, two painters (generated-geometry design)

## The verdict first

**Build the hatch as real clipped geometry on both surfaces, from one pure generator. Reject SVG `<pattern>`. Reject the raster PNG.** Neither alternative survives the house's own rule — "ONE FUNCTION, TWO SURFACES ... so the screen and the paper cannot drift apart" — and I verified the reasons rather than assuming them.

**Why not SVG `<pattern>`.** It works beautifully on screen and costs nothing to clip. But it has no counterpart on paper: I read the vendored jsPDF 4.1.0 and confirmed `beginTilingPattern` / `endTilingPattern` / `addShadingPattern` each open with `advancedApiModeTrap(...)`, which throws outside `doc.advancedAPI()`, and `Na__LePdf__BuildDocument` never enters advanced mode. So `<pattern>` forces a second, unrelated implementation for print, and the two will drift — which is precisely how the site plan PDF already ended up cutting no holes while the screen cuts them with `fill-rule="evenodd"`. There is a second, quieter objection: the site plan frame SVG's viewBox is in **model** millimetres (`win.WidthMm = frame.WidthMm * D`), while the sheet chrome SVG's viewBox is **paper** millimetres, so a paper-mm tile would have to be authored twice, once per surface. Generated geometry has the same problem and solves it with one multiply.

**Why not the raster PNG (the GradientTool precedent).** `Na__LeGrad__StripPng` gets away with a raster because a gradient is a low-frequency image; a hatch is high-frequency line art sitting directly beside crisp vector linework. Run the numbers: a 0.18 mm hatch stroke needs ~600 dpi not to fuzz. An A2 sheet at 600 dpi is 14,031 × 9,921 px — 557 MB of canvas, impossible. Even one 200 × 150 mm woodland polygon at 300 dpi is 4.2 Mpx and a megabyte or two of PNG, several polygons giving a PDF of tens of megabytes that still prints softer than the line it abuts. The alpha trap (`'RGBA'` drops alpha, PNG data URL mandatory) is real but is not the reason to reject it; resolution is.

**What makes generated geometry cheap enough is that neither surface needs geometric clipping.** On screen the strokes go inside `<g clip-path="url(#...)">` whose `clipPath` holds the same multi-ring `d` with `clip-rule="evenodd"`. On paper I confirmed by reading the library that `API.clipEvenOdd`, `API.path`, `API.moveTo`, `API.lineTo`, `API.close`, `API.stroke` and `API.discardPath` are all **plain compat-mode methods with no trap** — so emitting every ring as a subpath, then `clipEvenOdd()` + `discardPath()`, gives an exact even-odd clip on paper. That is stronger than what the fills do today (`Na__LePdf__DrawSitePlanFills` draws outer rings only and skips holes), so the hatch will cut a courtyard or an island correctly on paper from day one.

And the cull never reaches us: `Na__LePdf__DrawLinework`'s `minSegmentPaperMm` cull lives inside that function and only touches `classes` segments. The hatch does not go through it. It also must not go through `Na__LeChrome__PushPolyline` one stroke at a time — 12,000 primitives each re-issuing `setDrawColor`/`setLineWidth`/GState would be ruinous. It goes through a dedicated batched writer.

## The cost, honestly, and how it is solved

SC08 (paper millimetres) is what makes this tractable, and it is worth spelling out why. Because the tile is a fixed paper size, **the tile count is bounded by the frame, never by the site**: a 180 mm frame at 1:100 and at 1:500 both hold the same number of 14 mm tiles. Worst case is frame area ÷ tile area. An A3-sized frame with a 6 mm tile is 70 × 50 = 3,500 tiles; at 6 marks × ~14 segments that is ~294,000 segments, which is too much. A realistic block plan (14 mm woodland tile, 180 × 120 mm frame) is ~13 × 10 tiles → ~1,000 glyphs → ~14,000 segments, which is one `d` string of roughly 400 KB and a comparable PDF content stream before compression. That is the heaviest thing on the sheet and it must be governed. Four levers, all in `Na__LeHatchGeo__Build`:

1. **Clip the lattice to the viewport window first**, not to the polygon. A woodland running miles off-sheet costs nothing.
2. **Cull per ring bounding box, not per fill.** Each ring carries a box; a tile touching none is skipped. For scattered copses this is the big win.
3. **Bleed one glyph extent** (`Tile__BleedMm`) beyond the clip box so edge glyphs are whole. This also makes tile seams automatically invisible: a mark that overhangs its tile is simply drawn by that tile, and the neighbour draws its own.
4. **A hard budget.** `Budget__MaxStrokes` (60,000) and `Budget__MaxTiles` (20,000). Over budget, `Build` returns `{ Result__Ok : false, Result__Reason : 'budget', Result__SuggestedScale }`; the painters draw nothing extra (the solid fill underneath still shows), one `console.warn` fires, and the Patterns panel says so. Never a blank polygon, never a frozen tab.

Geometry is cached in a small FIFO keyed `patternId|scale|rot|D|categoryKey|ExportedIso|windowBoxRounded` — rings only change on a new export, so the fingerprint is free.

## The generator and its purity

`Na__LayoutEditor__HatchPatterns__Geometry__.js` (`Na__LeHatchGeo__`) **imports nothing**. That is a hard constraint, not a preference: the established test idiom (`Na__Test__ScrapbookScaleBar__.test.mjs`) copies the module to a temp `.mjs` and imports it, because Node resolves `.js` in this tree as CommonJS. Zero imports also forces the generator to be pure — pattern object plus placement in, strokes out — which is what makes it the single source of truth for screen, paper and the panel swatch.

Output shape is **pens**, not strokes:
`{ Result__Ok, Result__Pens : [ { Pen__ColourHex, Pen__WeightMm, Pen__Filled, Pen__Strokes : [ Float64Array(x,y,x,y,…) ] } ], Result__StrokeCount, Result__TileCount }`
One SVG `<path>` and one `doc.path()`+`doc.stroke()` per pen. Typically one to three pens.

**Lattice anchoring** is the trap a naive design misses. Anchor the lattice to the viewport window and the hatch crawls across the ground as you pan. `Na__LeHatchGeo__Build` therefore takes `Placement__AnchorX/Y` — model **(0, 0)** for a site plan layer, so the hatch is nailed to the ground through pan, zoom and a scale change — and `Placement__StepScale`, which is `D` for the frame SVG and `1` for a sheet primitive. One parameter expresses both cases.

**`Tile__RotationMode` is the second necessary field.** `"tile"` rotates the whole tile (right for a diagonal or cross hatch). `"lattice"` rotates the lattice but keeps each mark upright — because a rotated woodland with the trees lying on their sides is nonsense. Mixed Woodland is `"lattice"`.

Circles become polylines at `Rendering__CircleSegments` (16). Curves would be two different approximations on the two surfaces.

## The pattern schema, and Mixed Woodland in full

Three-stage naming, `Meta__Why…` prose, `__Note` on every array entry, glyph space **y up** (declared in `Meta__WhereYPoints` — a tree written with negative numbers is unreadable, and the generator flips it once).

```json
{
    "LayoutEditor__HatchPattern__Meta": {
        "Meta__FileName"            : "HatchPattern__MixedWoodland__.json",
        "Meta__Description"         : "Ordnance-Survey-style mixed woodland: conifer and broadleaf glyphs scattered on a tile, for 75__SitePlan__SoftLandscape__Trees__MixedWoodland. Read by Na__LayoutEditor__HatchPatterns__.js and turned into real clipped geometry by Na__LayoutEditor__HatchPatterns__Geometry__.js, so the screen and the paper draw the same strokes.",
        "Meta__Version"             : "1.0.0",
        "Meta__Created"             : "20-Sep-2026",
        "Meta__Author"              : "Adam Noble - Noble Architecture",
        "Meta__WhyPaperMillimetres" : "Every figure here is PAPER millimetres, like a dash in Na__LayoutEditor__LineStyleTool__Config__.json. A tree therefore measures the same on the sheet at 1:200 and at 1:500, which is what a drawn symbol does. The painter multiplies by the scale denominator; nothing here is ever rewritten.",
        "Meta__WhereYPoints"        : "Inside a glyph and inside the tile, y runs UP from the bottom-left, so a tree is written with the numbers climbing. The sheet's y runs down; the generator turns it over once, in one place.",
        "Meta__WhereScaleGoes"      : "A per-use Hatch__Scale multiplies the tile and the marks together at build time. It never changes the pen weight: a hatch at 2x should be sparser, not fatter.",
        "Meta__WhichGlyphs"         : "Glyphs are drawn once and placed many times. Marks say only where and how big, so a tile of seven trees is two glyph definitions and seven short rows."
    },

    "LayoutEditor__HatchPattern__Identity": {
        "Identity__Description" : "What this pattern is called and where it lives. Identity__PatternId is persisted in the tags SSOT and in saved viewport records and may never be renamed.",
        "Identity__PatternId"   : "HatchSitePlan__MixedWoodland",
        "Identity__Name"        : "Mixed Woodland",
        "Identity__Pack"        : "05__SitePlanHatches",
        "Identity__Keywords"    : [ "woodland", "trees", "conifer", "broadleaf", "ordnance survey" ],
        "Identity__SourceNote"  : "Drawn from the Mixed woodland tile on OS_Symbol__Examples__Woodland&Water__.png."
    },

    "LayoutEditor__HatchPattern__Tile": {
        "Tile__Description"  : "The repeat. RowOffsetMm shifts alternate rows so the eye does not read a grid; BleedMm is the furthest a mark reaches past its own tile, which the generator uses to extend the lattice so no glyph is cut in half at the edge of the clip.",
        "Tile__WidthMm"      : 14.00,
        "Tile__HeightMm"     : 14.00,
        "Tile__RowOffsetMm"  : 5.00,
        "Tile__RotationDeg"  : 0,
        "Tile__RotationMode" : "lattice",
        "Tile__BleedMm"      : 4.50
    },

    "LayoutEditor__HatchPattern__Pen": {
        "Pen__Description" : "The default pen every stroke takes unless it names its own weight. ColourMode 'layer' takes the site plan layer's own line colour, so woodland hatches green without being told and follows an edge-style override; 'fixed' uses Pen__ColourHex.",
        "Pen__WeightMm"    : 0.18,
        "Pen__ColourMode"  : "layer",
        "Pen__ColourHex"   : null,
        "Pen__Opacity"     : 1.00,
        "Pen__LineCap"     : "round"
    },

    "LayoutEditor__HatchPattern__Glyphs": [
        {
            "Glyph__Id"       : "Conifer",
            "Glyph__Name"     : "Conifer",
            "Glyph__ExtentMm" : [ 2.80, 4.00 ],
            "Glyph__Anchor"   : "base",
            "Glyph__Note"     : "A fir: one trunk and four branch tiers, each an inverted V whose arms droop, widest at the bottom.",
            "Glyph__Strokes"  : [
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [  0.00, 0.00 ], [ 0.00, 4.00 ] ],                          "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": 0.13, "Stroke__Note": "The trunk, finer than the branches." },
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [ -1.40, 1.10 ], [ 0.00, 2.00 ], [ 1.40, 1.10 ] ],          "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": null, "Stroke__Note": "Lowest tier, the widest." },
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [ -1.05, 2.00 ], [ 0.00, 2.85 ], [ 1.05, 2.00 ] ],          "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": null, "Stroke__Note": "Second tier." },
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [ -0.70, 2.85 ], [ 0.00, 3.60 ], [ 0.70, 2.85 ] ],          "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": null, "Stroke__Note": "Third tier." },
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [ -0.32, 3.60 ], [ 0.00, 4.00 ], [ 0.32, 3.60 ] ],          "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": null, "Stroke__Note": "The apex." }
            ]
        },
        {
            "Glyph__Id"       : "Broadleaf",
            "Glyph__Name"     : "Broadleaf",
            "Glyph__ExtentMm" : [ 2.40, 3.45 ],
            "Glyph__Anchor"   : "base",
            "Glyph__Note"     : "A lollipop: a short trunk under an open round crown. At 3 mm a circle reads as a broadleaf and an outline blob does not.",
            "Glyph__Strokes"  : [
                { "Stroke__Kind": "polyline", "Stroke__Points": [ [ 0.00, 0.00 ], [ 0.00, 1.15 ] ],                            "Stroke__Closed": false, "Stroke__Filled": false, "Stroke__WeightMm": 0.13, "Stroke__Note": "The trunk, up to the crown." },
                { "Stroke__Kind": "circle",   "Stroke__CentreMm": [ 0.00, 2.30 ], "Stroke__RadiusMm": 1.15,                    "Stroke__Closed": true,  "Stroke__Filled": false, "Stroke__WeightMm": null, "Stroke__Note": "The crown, polylined at Rendering__CircleSegments so both surfaces draw one shape." }
            ]
        }
    ],

    "LayoutEditor__HatchPattern__Marks": [
        { "Mark__Id": "M1", "Mark__GlyphRef": "Conifer",   "Mark__AtMm": [  3.10, 10.40 ], "Mark__ScaleFactor": 1.00, "Mark__RotationDeg": 0, "Mark__Note": "Trees stand up: every mark is upright, which is why Tile__RotationMode is 'lattice'." },
        { "Mark__Id": "M2", "Mark__GlyphRef": "Broadleaf", "Mark__AtMm": [  8.60, 12.10 ], "Mark__ScaleFactor": 1.00, "Mark__RotationDeg": 0, "Mark__Note": "Overhangs the top edge; the tile above draws its own, so the seam does not show." },
        { "Mark__Id": "M3", "Mark__GlyphRef": "Conifer",   "Mark__AtMm": [ 12.30,  8.90 ], "Mark__ScaleFactor": 0.88, "Mark__RotationDeg": 0, "Mark__Note": "Slightly smaller, so the repeat does not read as identical stamps." },
        { "Mark__Id": "M4", "Mark__GlyphRef": "Broadleaf", "Mark__AtMm": [  1.40,  5.20 ], "Mark__ScaleFactor": 0.94, "Mark__RotationDeg": 0, "Mark__Note": "Left edge." },
        { "Mark__Id": "M5", "Mark__GlyphRef": "Conifer",   "Mark__AtMm": [  6.20,  6.40 ], "Mark__ScaleFactor": 1.06, "Mark__RotationDeg": 0, "Mark__Note": "The middle of the tile, deliberately off both centre lines." },
        { "Mark__Id": "M6", "Mark__GlyphRef": "Broadleaf", "Mark__AtMm": [ 10.90,  3.10 ], "Mark__ScaleFactor": 1.00, "Mark__RotationDeg": 0, "Mark__Note": "Lower right." },
        { "Mark__Id": "M7", "Mark__GlyphRef": "Conifer",   "Mark__AtMm": [  3.60,  1.20 ], "Mark__ScaleFactor": 0.92, "Mark__RotationDeg": 0, "Mark__Note": "Overhangs the bottom edge." }
    ]
}
```

## Library index

There is no directory listing on Flask or the live site, so a checked-in index is required, exactly as `Na__LayoutEditor__ScrapbookCustom__Config__.json` states for `Library__IndexFile`. **One flat index at the library root**, not one per pack — copying the Custom Scrapbook precedent, where each entry carries its own category rather than there being two levels to keep in step by hand. `52__LayoutEditor__HatchPatternLibrary/HatchPattern__Index__.json` holds `…__Meta`, `…__Packs` (Pack__Folder / Pack__Name / Pack__Order / Pack__Note) and `…__Patterns` (Pattern__Id / Pattern__Name / Pattern__Pack / Pattern__File / Pattern__TileMm / Pattern__Keywords / Pattern__Note). `03__Placeholder` and `04__Placeholder` are listed with their real folder names and no patterns; the panel shows an empty pack rather than hiding it, so Adam can see where to drop files.

**Read-only.** No Flask blueprint, no write routes, no 8090 restart trap. Patterns are shipped content Adam edits in the repo; `.json` lands in the service worker's network-first `data` bucket, so an edited pack is picked up on the next load. (Had we shipped `.svg` tiles they would land in the stale-while-revalidate shell bucket and lag a reload — another reason the pattern is JSON.)

## Binding: default from the SSOT, override per viewport

**Layer default (REQ-14, no user action).** Three new SSOT fields per tag — `SitePlan__HatchPatternId`, `SitePlan__HatchScale`, `SitePlan__HatchRotationDeg` — carried by `Na__SitePlan__BuildLayerDefinitions`'s `style:` hash into `Layer__Style`. The Python build script needs **no change**: it copies `Layer__Style` whole (`entry.get('Layer__Style')`). The key then dies at `Na__SpStore__Style`, which rebuilds exactly seven keys — so that whitelist grows to ten. That is F8's first registration.

**A fallback map, deliberately.** `HatchPatternTools__LayerBindings` in the module config maps `Layer__CategoryKey` → pattern id, consulted only when `Layer__Style.HatchPatternId` is null. Reason: PS01's manifest is already two SSOT revisions behind, so a hatch bound *only* through the SSOT is invisible until Adam re-exports from SketchUp. The fallback makes the whole feature testable today, on a real fixture, with no SketchUp round trip — and it is how phase 1 gets proven (see below). It carries `Meta__WhyTheFallbackMap` saying it is a bridge for manifests written before the field existed. The SSOT always wins when present.

**Per-viewport override (REQ-19).** Not in `Viewport__ProjectedEdges`: `Na__LeRec__NormaliseProjectedEdges` rebuilds exactly four keys, that block is documented as *projected linework style*, and its prune rule compares against `Na__LeEdge__Default` — putting hatch state there would force EdgeStyles to learn about hatches. Instead a sub-key of `Viewport__SitePlan`, which `Na__LeRec__NormaliseViewport` shallow-copies and therefore already survives save, load, draft and undo:

`Viewport__SitePlan.SitePlan__HatchOverrides = { "<categoryKey>" : { Hatch__On, Hatch__PatternId, Hatch__Scale, Hatch__RotationDeg } }`

Two things must still be added: a new `Na__LeRec__NormaliseSitePlanBlock(block)` (so junk from an old draft cannot reach the painter — the shallow copy passes anything through), and a `patch.sitePlan` branch in `Na__LeModel__UpdateViewport`, which today has no such branch, so a site plan block can only be set at create time.

**Resolution order** lives in one function, `Na__LeHatch__EffectiveForLayer(viewport, layer, isLocationPlan)`: location plan → null (SC11/REQ-28 suppresses everything but the proposal fill); override `Hatch__On === false` → null; then patternId, scale and rotation each falling override → `Layer__Style` → config map → default. Colour comes from `Na__LeEdge__Effective(viewport, categoryKey).hex` when `Pen__ColourMode` is `"layer"`, so an edge-style override recolours the hatch with the line. Pen weight is absolute paper millimetres and is **not** multiplied by `Hatch__Scale`.

**The hatch does not depend on a fill.** `Na__LeVp2d__SitePlanBuild` filters fills on `FillHex && FillOpacity > 0`; the hatch list is built independently on `rings.length > 0 && effective !== null`, so a woodland can be hatched with no solid fill under it — and, usefully, PS01's `TrueVision__SitePlan__ExistingBuildings` (one real ring, `FillHex: null`) becomes a working test polygon with nothing but a config-map line.

## Where it plugs in

Screen: `Na__LeVp2d__SitePlanBuild` returns `{ classes, fills, hatches, key }`; `Na__LeVp2d__PaintSitePlan` emits the hatch markup between the fills loop and the bands loop, giving REQ-31's bottom-to-top order for free. Paper: `Na__LePdf__DrawViewport` gains `Na__LePdf__DrawSitePlanHatches` between the existing fills and linework calls, fed from the same `drawing.hatches`. `Na__LeVp2d__SitePlanToken` folds in a new `Na__LeHatch__ViewportToken`, or a pattern or scale change will not repaint and the parked-frame cache will serve stale paint.

Two PDF rules the implementer must not get wrong: every state call (`setDrawColor`, `setLineWidth`, `setLineCap`) happens **before** the first `moveTo`, because a state operator inside path construction is illegal PDF; and `saveGraphicsState` / `restoreGraphicsState` wrap the ring clip in a `finally`, because clips intersect and a clip left open crops everything after it — the frame clip `Na__LePdf__BeginClip` already opened is what we correctly fall back to.

Clip ids come from a never-reset module counter (`Na__LeHatchPaint__IdCounter`, `'naLeHatch' + (++n)`), copying `Na__LeGrad__IdCounter`'s comment verbatim: the chrome, markup, focus and per-frame SVGs are separate strings in one document and an id may never repeat.

## Scope held back deliberately

`Shape__Hatch` on a drawn vector shape is phase 2. The generator and both painters are already shape-agnostic (rings plus placement in), so it is a small later addition — but it needs all ten `Shape__Gradient` sites mirrored, and F5 says the site plan fill path has never drawn a pixel in the live project. Getting one real hatch onto one real layer first is worth more than two half-finished homes.

#### Files

| Action | Path | What |
|---|---|---|
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Geometry__.js` | NAMESPACE Na__LeHatchGeo. THE GENERATOR. Must import NOTHING (the test idiom copies it to .mjs; Node resolves .js here as CommonJS). Pure: pattern object + placement + clip box in, pens out. Adds Na__LeHatchGeo__NormalisePattern(raw) (whitelist rebuild of every block, returns null on a pattern with no marks), Na__LeHatchGeo__GlyphStrokes(glyph, atMm, scaleFactor, rotationDeg, circleSegments) (turns one placed glyph into an array of point arrays, y flipped from glyph-space y-up to sheet y-down, circles polylined), Na__LeHatchGeo__RingsBounds(rings) (per-ring boxes plus a union box), Na__LeHatchGeo__Lattice(pattern, placement, clipBox) (the tile walk: rotated lattice for RotationMode 'tile', upright marks on a rotated lattice for 'lattice', anchored at Placement__AnchorX/Y, extended by Tile__BleedMm, alternate rows shifted by Tile__RowOffsetMm, tiles culled against the per-ring boxes), Na__LeHatchGeo__Build(pattern, use, rings, placement, clipBox, budget) returning { Result__Ok, Result__Reason, Result__SuggestedScale, Result__Pens:[{Pen__ColourHex,Pen__WeightMm,Pen__Filled,Pen__Strokes}], Result__StrokeCount, Result__TileCount }, and Na__LeHatchGeo__RingPathD(rings, round) (the multi-subpath d string, shared by the screen clipPath and the PDF clip). Exports all six. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Paint__.js` | NAMESPACE Na__LeHatchPaint. The two painters over one build. Adds Na__LeHatchPaint__IdCounter (module-level, NEVER reset, copying Na__LeGrad__IdCounter's comment), Na__LeHatchPaint__SvgMarkup(built, rings, stepScale) returning a '<clipPath id="naLeHatchN" clipPathUnits="userSpaceOnUse"><path d=... clip-rule="evenodd"/></clipPath><g clip-path="url(#naLeHatchN)">' wrapper with one <path fill="none" stroke-linecap="round"> per pen (every coordinate and stroke-width multiplied by stepScale), and Na__LeHatchPaint__DrawPdf(doc, built, rings) which does saveGraphicsState, emits every ring via moveTo/lineTo/close, clipEvenOdd(), discardPath(), then per pen sets setDrawColor/setLineWidth/setLineCap BEFORE any moveTo, emits all strokes as one path and calls doc.stroke() once (doc.fill() for a filled pen), and restoreGraphicsState in a finally. Exports both painters. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Transport__.js` | NAMESPACE Na__LeHatchIo. Copied from Na__LayoutEditor__ScrapbookCustom__Transport__.js, read paths only. Adds Na__LeHatchIo__AppRootUrl = new URL('../../../', import.meta.url), Na__LeHatchIo__Place, Na__LeHatchIo__Configure(library), Na__LeHatchIo__FileUrl(relativePath) (encodeURIComponent per path part - the reference PNG's '&' proves this is needed), Na__LeHatchIo__ReadIndex() and Na__LeHatchIo__ReadPattern(pack, file). No API path, no save, no delete: the library is read-only shipped content, so no Flask blueprint and no 8090 restart. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__.js` | NAMESPACE Na__LeHatch. The library front door and the record. Adds Na__LeHatch__ConfigUrl, Na__LeHatch__Ready() (fetch-once, never rejects, falls back to frozen Na__LeHatch__FALLBACK_* - copy Na__LeDash__Ready exactly), Na__LeHatch__Block(name), Na__LeHatch__Bounds(), Na__LeHatch__Budget(), Na__LeHatch__Rendering(), Na__LeHatch__Label(key, fallback), Na__LeHatch__GetStatus(), Na__LeHatch__Packs(), Na__LeHatch__List(), Na__LeHatch__GetPattern(patternId) (sync, cache only), Na__LeHatch__EnsureLoaded(ids) (async, fetches missing patterns, fires Na__LeHatch__CHANGED_EVENT on window when the set changes), Na__LeHatch__Normalise(raw)/Na__LeHatch__Create(patternId)/Na__LeHatch__With(hatch, patch) for the Hatch__ sub-record, Na__LeHatch__EffectiveForLayer(viewport, layer, isLocationPlan) (the whole resolution order), Na__LeHatch__PatternIdsFor(viewport, descriptor), Na__LeHatch__ViewportToken(viewport, descriptor), and Na__LeHatch__SwatchSvg(patternId, sizeMm) which runs the SAME generator at a fixed preview scale so a panel swatch cannot lie about what prints. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Config__.json` | The module's own config. Blocks: LayoutEditor__HatchPatternTools__Meta (with Meta__WhyGeneratedGeometry, Meta__WhyNotAnSvgPattern, Meta__WhyNotARaster, Meta__WhereScaleGoes, Meta__WhyTheFallbackMap), __Library (Library__ContentFolder '52__LayoutEditor__HatchPatternLibrary', Library__IndexFile 'HatchPattern__Index__.json', Library__ReadOnlyNote), __Bounds (Bounds__MinScale 0.25, Bounds__MaxScale 4, Bounds__StepScale 0.05, Bounds__MinRotationDeg 0, Bounds__MaxRotationDeg 360, Bounds__StepRotationDeg 5), __Budget (Budget__MaxStrokes 60000, Budget__MaxTiles 20000, Budget__Description), __Rendering (Rendering__CircleSegments 16, Rendering__RoundDecimals 2, Rendering__CacheEntries 8), __LayerBindings (the fallback categoryKey to pattern id array, entries Binding__CategoryKey / Binding__PatternId / Binding__Note) and __Labels. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\HatchPattern__Index__.json` | The checked-in library index - the only way the library is readable on the live site, which has no directory listing. Blocks LayoutEditor__HatchPatternLibrary__Meta, __Packs (Pack__Folder / Pack__Name / Pack__Order / Pack__Note, all five folders listed including the two Placeholders with their real folder names), __Patterns (Pattern__Id / Pattern__Name / Pattern__Pack / Pattern__File / Pattern__TileMm / Pattern__Keywords / Pattern__Note). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\05__SitePlanHatches\HatchPattern__MixedWoodland__.json` | The worked example, verbatim as given in the approach: 14x14 mm tile, RowOffsetMm 5.0, RotationMode 'lattice', BleedMm 4.5, pen 0.18 mm ColourMode 'layer', two glyphs (Conifer 2.80x4.00 - trunk plus four drooping inverted-V tiers; Broadleaf 2.40x3.45 - 1.15 mm trunk plus an r=1.15 crown at [0, 2.30]) and seven marks, four conifer and three broadleaf, at irregular positions with scale factors 0.88 to 1.06. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\05__SitePlanHatches\HatchPattern__PondsAndLakes__.json` | Identity__PatternId 'HatchSitePlan__PondsAndLakes' (SC12's second hatch, for 71__SitePlan__BaseMap__Waterbodies). 9x9 mm tile, RowOffsetMm 4.5, RotationMode 'lattice', BleedMm 2.0, pen 0.15 mm ColourMode 'layer'. One glyph 'Ripple', extent 3.20x0.80, anchor 'centre', a single seven-point polyline tilde [[0,0.10],[0.45,0.58],[1.05,0.62],[1.60,0.20],[2.15,-0.18],[2.75,-0.14],[3.20,0.34]], placed three times per tile. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\01__GeometricHatches\HatchPattern__Diagonal45__.json` | Identity__PatternId 'HatchGeometric__Diagonal45'. The simplest possible pattern and the proof of Tile__RotationMode 'tile': a 2.50x2.50 mm tile, BleedMm 0, no Glyphs block, one inline Mark of kind 'polyline' running corner to corner. Exercises the no-glyph path in the generator. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\01__GeometricHatches\HatchPattern__CrossHatch45__.json` | Identity__PatternId 'HatchGeometric__CrossHatch45'. As Diagonal45 with a second crossing mark; the smallest tile in the shipped set (2.50 mm), so it is the pattern that will hit Budget__MaxTiles first and is the one to test the budget fallback with. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | Na__SpStore__Style: grow the closed whitelist from seven keys to ten by adding HatchPatternId : text(style.HatchPatternId, null), HatchScale : num(style.HatchScale, 1) and HatchRotationDeg : num(style.HatchRotationDeg, 0). This is F8's first registration; without it the three fields die here having survived every earlier hop. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Import Na__LeHatch__* and Na__LeHatchPaint__SvgMarkup. Na__LeVp2d__SitePlanToken: append '\|' + Na__LeHatch__ViewportToken(viewport, descriptor) so a pattern, scale, rotation or on/off change repaints and the parked-frame cache cannot serve stale paint. Na__LeVp2d__SitePlanBuild: add a hatches array built independently of the fills filter (rings.length > 0 && Na__LeHatch__EffectiveForLayer(...) !== null), return { classes, fills, hatches, key }. Na__LeVp2d__SitePlanDrawing: after Na__SpStore__LoadAll(), await Na__LeHatch__Ready() then Na__LeHatch__EnsureLoaded(Na__LeHatch__PatternIdsFor(viewport, descriptor)). Na__LeVp2d__PaintSitePlan: call Na__LeHatchGeo__Build then Na__LeHatchPaint__SvgMarkup for each hatch, appending to body between the fills loop and the bands loop, with stepScale = D. Na__LeVp2d__FillSitePlan: add a window listener on Na__LeHatch__CHANGED_EVENT beside the existing store listener so a pattern arriving late triggers Na__LeVp2d__RefillSitePlan. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js` | Add Na__LePdf__DrawSitePlanHatches(doc, viewport, described, hatches): converts each hatch's rings from model mm to paper mm with the same frame.X + ((p - win.OriginX) / D) arithmetic Na__LePdf__DrawSitePlanFills uses, calls Na__LeHatchGeo__Build with Placement__StepScale 1 and the frame rect as the clip box, then Na__LeHatchPaint__DrawPdf. Call it in Na__LePdf__DrawViewport's site plan branch between the existing Na__LePdf__DrawSitePlanFills and Na__LePdf__DrawLinework calls, giving REQ-31's fill / pattern / linework order. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Add Na__LeRec__NormaliseSitePlanBlock(block): a whitelist rebuild of Viewport__SitePlan, keeping SitePlan__HatchOverrides as a map of categoryKey to { Hatch__On, Hatch__PatternId, Hatch__Scale, Hatch__RotationDeg } with the scale and rotation clamped to Na__LeHatch__Bounds() and an entry that says nothing dropped. Call it from the Na__LeRec__IsSitePlanViewport branch of Na__LeRec__NormaliseViewport, replacing the bare Object.assign({}, ...). Its header must state that it is THE registration point for every Viewport__SitePlan sub-key, so the two-store work adds SitePlan__StoreId here. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js` | Na__LeModel__UpdateViewport: add a patch.sitePlan branch beside the existing rect/pan/styles/modelLayers/projectedEdges branches (it has none today, so a site plan block can currently only be set at create time). It merges the patch into Viewport__SitePlan and re-runs Na__LeRec__NormaliseSitePlanBlock, so a whole slider drag is one undo step exactly as the gradient and dash patches are. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Import Na__LeHatch__Ready and add it to the Na__LeMode__ReadyOnce Promise.all beside Na__LeGrad__Ready and Na__LeDash__Ready, or the hatch config is not loaded before the first sheet is normalised. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__HatchGeometry__.test.mjs` | Copies Na__LayoutEditor__HatchPatterns__Geometry__.js to a temp .mjs (the Na__Test__ScrapbookScaleBar__ idiom - Node resolves .js here as CommonJS) and asserts: the Mixed Woodland pattern normalises; a 100x100 mm clip box at scale 1 yields the expected tile count; Hatch__Scale 2 halves the tile count in each axis; RotationMode 'lattice' leaves every conifer trunk vertical while RotationMode 'tile' does not; the lattice is anchor-stable (shifting the clip box by exactly one tile step reproduces the same strokes translated); a circle stroke emits Rendering__CircleSegments segments and closes; and a 2.50 mm tile over a 400x300 mm box trips Budget__MaxTiles and returns Result__Ok false with a Result__SuggestedScale. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js` | Bump PWA_SW_VERSION_TOKEN from '2026-09-20-3' (check against HEAD first) and add the matching DEVELOPMENT LOG line. This release adds new module exports that a warm cache lacks, which breaks the editor until the second visit. Do NOT add pattern files to PWA_SW_SHELL_PRECACHE_RELATIVE: .json already lands in the network-first data bucket, which is the wanted behaviour. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | Add SitePlan__HatchPatternId (null), SitePlan__HatchScale (1) and SitePlan__HatchRotationDeg (0) to every entry under Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__, and set SitePlan__HatchPatternId to 'HatchSitePlan__MixedWoodland' on 75__SitePlan__SoftLandscape__Trees__MixedWoodland and 'HatchSitePlan__PondsAndLakes' on 71__SitePlan__BaseMap__Waterbodies (both tags are added by the REQ-04 work). Bump the file's meta.version. Adam runs every SketchUp test himself: stop and ask him before he re-exports. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | Na__SitePlan__BuildLayerDefinitions: add 'HatchPatternId' => entry['SitePlan__HatchPatternId'], 'HatchScale' => entry['SitePlan__HatchScale'] and 'HatchRotationDeg' => entry['SitePlan__HatchRotationDeg'] to the style: hash, beside the existing FillOpacity line. No other Ruby change; the manifest writer copies defn[:style] whole. No Python change either - ProjectVision__BuildScript__.py copies Layer__Style with entry.get('Layer__Style'), verified. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill sections 6 and 7 (face fills and the hatch pattern format; the SVG hatch generator) with this design. Add decisions SC15 'hatches are generated geometry on both surfaces, not an SVG pattern and not a raster - jsPDF tiling patterns are trapped behind advancedAPI and a raster cannot hold a 0.18 mm line at print resolution', SC16 'a per-use hatch override lives in Viewport__SitePlan.SitePlan__HatchOverrides, not in Viewport__ProjectedEdges', SC17 'the pattern library is read-only shipped content with one flat checked-in index; no Flask blueprint' and SC18 'the app-side LayerBindings map is a bridge for manifests exported before the SSOT field existed; the SSOT wins when present'. Update the section 12 ledger. Record the open questions listed for Adam. |

#### New keys

- `LayoutEditor__HatchPattern__Meta`
- `LayoutEditor__HatchPattern__Meta.Meta__FileName`
- `LayoutEditor__HatchPattern__Meta.Meta__Description`
- `LayoutEditor__HatchPattern__Meta.Meta__Version`
- `LayoutEditor__HatchPattern__Meta.Meta__Created`
- `LayoutEditor__HatchPattern__Meta.Meta__Author`
- `LayoutEditor__HatchPattern__Meta.Meta__WhyPaperMillimetres`
- `LayoutEditor__HatchPattern__Meta.Meta__WhereYPoints`
- `LayoutEditor__HatchPattern__Meta.Meta__WhereScaleGoes`
- `LayoutEditor__HatchPattern__Meta.Meta__WhichGlyphs`
- `LayoutEditor__HatchPattern__Identity`
- `LayoutEditor__HatchPattern__Identity.Identity__Description`
- `LayoutEditor__HatchPattern__Identity.Identity__PatternId`
- `LayoutEditor__HatchPattern__Identity.Identity__Name`
- `LayoutEditor__HatchPattern__Identity.Identity__Pack`
- `LayoutEditor__HatchPattern__Identity.Identity__Keywords`
- `LayoutEditor__HatchPattern__Identity.Identity__SourceNote`
- `LayoutEditor__HatchPattern__Tile`
- `LayoutEditor__HatchPattern__Tile.Tile__Description`
- `LayoutEditor__HatchPattern__Tile.Tile__WidthMm`
- `LayoutEditor__HatchPattern__Tile.Tile__HeightMm`
- `LayoutEditor__HatchPattern__Tile.Tile__RowOffsetMm`
- `LayoutEditor__HatchPattern__Tile.Tile__RotationDeg`
- `LayoutEditor__HatchPattern__Tile.Tile__RotationMode`
- `LayoutEditor__HatchPattern__Tile.Tile__BleedMm`
- `LayoutEditor__HatchPattern__Pen`
- `LayoutEditor__HatchPattern__Pen.Pen__Description`
- `LayoutEditor__HatchPattern__Pen.Pen__WeightMm`
- `LayoutEditor__HatchPattern__Pen.Pen__ColourMode`
- `LayoutEditor__HatchPattern__Pen.Pen__ColourHex`
- `LayoutEditor__HatchPattern__Pen.Pen__Opacity`
- `LayoutEditor__HatchPattern__Pen.Pen__LineCap`
- `LayoutEditor__HatchPattern__Glyphs`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Id`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Name`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__ExtentMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Anchor`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Note`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__Kind`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__Points`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__CentreMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__RadiusMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__Closed`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__Filled`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__WeightMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Strokes[].Stroke__Note`
- `LayoutEditor__HatchPattern__Marks`
- `LayoutEditor__HatchPattern__Marks[].Mark__Id`
- `LayoutEditor__HatchPattern__Marks[].Mark__GlyphRef`
- `LayoutEditor__HatchPattern__Marks[].Mark__Kind`
- `LayoutEditor__HatchPattern__Marks[].Mark__Points`
- `LayoutEditor__HatchPattern__Marks[].Mark__AtMm`
- `LayoutEditor__HatchPattern__Marks[].Mark__ScaleFactor`
- `LayoutEditor__HatchPattern__Marks[].Mark__RotationDeg`
- `LayoutEditor__HatchPattern__Marks[].Mark__WeightMm`
- `LayoutEditor__HatchPattern__Marks[].Mark__Note`
- `LayoutEditor__HatchPatternLibrary__Meta`
- `LayoutEditor__HatchPatternLibrary__Packs`
- `LayoutEditor__HatchPatternLibrary__Packs[].Pack__Folder`
- `LayoutEditor__HatchPatternLibrary__Packs[].Pack__Name`
- `LayoutEditor__HatchPatternLibrary__Packs[].Pack__Order`
- `LayoutEditor__HatchPatternLibrary__Packs[].Pack__Note`
- `LayoutEditor__HatchPatternLibrary__Patterns`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__Id`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__Name`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__Pack`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__File`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__TileMm`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__Keywords`
- `LayoutEditor__HatchPatternLibrary__Patterns[].Pattern__Note`
- `LayoutEditor__HatchPatternTools__Meta`
- `LayoutEditor__HatchPatternTools__Meta.Meta__WhyGeneratedGeometry`
- `LayoutEditor__HatchPatternTools__Meta.Meta__WhyNotAnSvgPattern`
- `LayoutEditor__HatchPatternTools__Meta.Meta__WhyNotARaster`
- `LayoutEditor__HatchPatternTools__Meta.Meta__WhereScaleGoes`
- `LayoutEditor__HatchPatternTools__Meta.Meta__WhyTheFallbackMap`
- `LayoutEditor__HatchPatternTools__Library`
- `LayoutEditor__HatchPatternTools__Library.Library__Description`
- `LayoutEditor__HatchPatternTools__Library.Library__ContentFolder`
- `LayoutEditor__HatchPatternTools__Library.Library__IndexFile`
- `LayoutEditor__HatchPatternTools__Library.Library__ReadOnlyNote`
- `LayoutEditor__HatchPatternTools__Bounds`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__Description`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__MinScale`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__MaxScale`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__StepScale`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__MinRotationDeg`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__MaxRotationDeg`
- `LayoutEditor__HatchPatternTools__Bounds.Bounds__StepRotationDeg`
- `LayoutEditor__HatchPatternTools__Budget`
- `LayoutEditor__HatchPatternTools__Budget.Budget__Description`
- `LayoutEditor__HatchPatternTools__Budget.Budget__MaxStrokes`
- `LayoutEditor__HatchPatternTools__Budget.Budget__MaxTiles`
- `LayoutEditor__HatchPatternTools__Rendering`
- `LayoutEditor__HatchPatternTools__Rendering.Rendering__Description`
- `LayoutEditor__HatchPatternTools__Rendering.Rendering__CircleSegments`
- `LayoutEditor__HatchPatternTools__Rendering.Rendering__RoundDecimals`
- `LayoutEditor__HatchPatternTools__Rendering.Rendering__CacheEntries`
- `LayoutEditor__HatchPatternTools__LayerBindings`
- `LayoutEditor__HatchPatternTools__LayerBindings.Bindings__Description`
- `LayoutEditor__HatchPatternTools__LayerBindings.Bindings__List`
- `LayoutEditor__HatchPatternTools__LayerBindings.Bindings__List[].Binding__CategoryKey`
- `LayoutEditor__HatchPatternTools__LayerBindings.Bindings__List[].Binding__PatternId`
- `LayoutEditor__HatchPatternTools__LayerBindings.Bindings__List[].Binding__Note`
- `LayoutEditor__HatchPatternTools__Labels`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__HatchPatternId`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__HatchScale`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<tag>.SitePlan__HatchRotationDeg`
- `SitePlanData__Layers[].Layer__Style.HatchPatternId`
- `SitePlanData__Layers[].Layer__Style.HatchScale`
- `SitePlanData__Layers[].Layer__Style.HatchRotationDeg`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__Style.HatchPatternId`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__Style.HatchScale`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__Style.HatchRotationDeg`
- `Viewport__SitePlan.SitePlan__HatchOverrides`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__On`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__PatternId`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__Scale`
- `Viewport__SitePlan.SitePlan__HatchOverrides.<categoryKey>.Hatch__RotationDeg`

#### Order of work

1. STEP 1 - Prove a polygon can be painted at all, before any hatch code exists. F5 is unambiguous: not one site plan fill has ever been drawn in PS01, on screen or on paper, so this whole build sits on an unexercised path. Serve the repo root on launch entry truevision-static-siteplan (8523) and open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 (both parameters, 127.0.0.1 not app.localhost - the local manifest only wins on that hostname). Temporarily give TrueVision__SitePlan__ExistingBuildings a FillHex and FillOpacity in the LOCAL manifest (it is the only layer with a real fill GLB - one 5-point outer ring) and confirm the fill appears on screen AND in an exported PDF. Do not proceed until it does. Revert the manifest edit.
2. STEP 2 - Write Na__LayoutEditor__HatchPatterns__Geometry__.js with zero imports, and Na__Test__HatchGeometry__.test.mjs beside it, together. The test is written against a hand-typed pattern object, so the generator is proven before any file format, any fetch or any painter exists. Assert tile counts, scale halving, lattice anchor stability, upright marks under RotationMode 'lattice', circle segmentation and the budget refusal. Run it.
3. STEP 3 - Write the library on disk: HatchPattern__Index__.json, the two site plan patterns and the two geometric ones. Then Na__LayoutEditor__HatchPatterns__Transport__.js and Na__LayoutEditor__HatchPatterns__Config__.json. Prove by hand in the browser console that Na__LeHatchIo__ReadIndex() and Na__LeHatchIo__ReadPattern('05__SitePlanHatches', 'HatchPattern__MixedWoodland__.json') both resolve on the static server - no Flask, no new route.
4. STEP 4 - Write Na__LayoutEditor__HatchPatterns__.js (Ready, cache, EnsureLoaded, Normalise, EffectiveForLayer, ViewportToken) and add Na__LeHatch__Ready() to Na__LeMode__ReadyOnce. Put a fallback binding of TrueVision__SitePlan__ExistingBuildings to HatchGeometric__Diagonal45 in the config's Bindings__List, so there is a bindable hatch on PS01 with no SketchUp involvement.
5. STEP 5 - Write Na__LayoutEditor__HatchPatterns__Paint__.js SCREEN half only, and wire the site plan viewport: SitePlanToken, SitePlanBuild's hatches array, SitePlanDrawing's EnsureLoaded await, PaintSitePlan's emit between fills and bands, and the CHANGED_EVENT listener. Reload PS01 and see a diagonal hatch clipped to the ExistingBuildings ring. Run node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs.
6. STEP 6 - Write the PDF half of Paint and Na__LePdf__DrawSitePlanHatches, wired into DrawViewport between fills and linework. Export the same sheet and compare the PDF against the screen at 400% zoom: the hatch must be crisp vector, in the same places, with holes cut. This is also the first time an even-odd multi-ring clip is proven on paper.
7. STEP 7 - Swap the fallback binding for the real Mixed Woodland pattern on a polygon with a hole, to exercise the clip properly. If PS01 has no such polygon, author one by hand in the local manifest's fill GLB path rather than waiting on SketchUp.
8. STEP 8 - Add the per-viewport override plumbing: Na__LeRec__NormaliseSitePlanBlock, its call from NormaliseViewport, and the patch.sitePlan branch in Na__LeModel__UpdateViewport. Prove scale and rotation survive a save, a reload, an undo and a redo (REDO as well as undo - the window listener order trap).
9. STEP 9 - Register the SSOT chain: Na__SpStore__Style's three new keys, the Ruby style hash, the Tags SSOT fields. Confirm no Python change is needed by reading discover_truevision_siteplan_store. Then STOP and ask Adam to re-export RB05 or PS01 from SketchUp - he runs every SketchUp test himself (SC03).
10. STEP 10 - Bump PWA_SW_VERSION_TOKEN (check it against HEAD first) with its DEVELOPMENT LOG line, run Na__Verify__Exports__.mjs and Na__Test__HatchGeometry__.test.mjs, and update the plan doc's sections 6, 7 and 12. Do not mark a ledger row x until Adam has seen it. Do not offer the ValeVision port until he confirms - and note that VV has no site plan code at all, so only the Geometry and Paint modules are portable, not the viewport or store wiring.

#### Risks

- THE BUDGET IS THE FEATURE'S REAL CEILING. A 2.5 mm cross hatch over a full A3 frame is roughly 70 x 50 = 3,500 tiles; with a glyph pattern that is hundreds of thousands of segments. The budget refusal is not a nicety - without it a single careless binding freezes the tab and the PDF export. Test the refusal path deliberately (step 2), and make sure the refusal is visible to Adam rather than silent, or it will read as 'the hatch didn't work'.
- THE LATTICE ANCHOR IS EASY TO GET WRONG AND LOOKS FINE UNTIL YOU PAN. Anchoring to the viewport window rather than to model (0,0) produces a hatch that crawls across the ground as you pan and re-solves differently at every zoom. It will pass every static screenshot test. The Node test's anchor-stability assertion (shift the clip box by exactly one tile step, expect the same strokes translated) is the only thing that catches it.
- F5's WARNING COMPOUNDS HERE. Zero site plan fills have ever been painted, so the even-odd hole cutting on screen and the ring handling on paper have never run against real data. A hatch makes both highly visible at once. Step 1 exists to separate 'the fill path is broken' from 'the hatch is broken'; skipping it means debugging two unproven systems through one symptom.
- ADDING A WHITELIST NORMALISER TO Viewport__SitePlan CHANGES AN EXISTING ASSUMPTION. Today Na__LeRec__NormaliseViewport shallow-copies that block, so anything survives. The two-store agent may be relying on that to slip SitePlan__StoreId through with no normaliser change. Na__LeRec__NormaliseSitePlanBlock must be written with a header saying it is THE registration point for every sub-key, and the two-store design must be told - otherwise their store binding is silently dropped on the first save.
- PS01's MANIFEST IS TWO SSOT REVISIONS BEHIND (2.3.0 against 2.3.2). A hatch bound only through the SSOT is invisible until Adam re-exports, which needs SketchUp and needs him. The config LayerBindings map is the mitigation, but it is a second source of truth and must be written as an explicitly temporary bridge with Meta__WhyTheFallbackMap, or it will quietly become the real binding and diverge from the tags SSOT.
- THE PDF STATE RULES ARE UNFORGIVING AND FAIL SILENTLY. A state operator (setDrawColor, setLineWidth) issued between moveTo and stroke is illegal PDF; some readers render it anyway and others show nothing. A clip left un-restored crops every primitive after it, including the whole rest of the sheet - the gradient's finally block comments say exactly this. Both faults produce a PDF that opens without error.
- CLIP IDS COLLIDE ACROSS FOUR-PLUS SVG DOCUMENTS ON ONE PAGE. The chrome, markup and focus SVGs plus one linework SVG per viewport frame all live in one document. A per-render counter (as Na__LeChrome__ToSvgMarkup uses for clipPaths) is safe only because a clipPath is consumed by the very next element; a hatch clip is referenced by url() from a sibling group and must use a never-reset module counter, or one frame's hatch will be clipped by another frame's polygon.
- BANDS MERGE, AND PEN COLOUR MODE 'layer' READS FROM EdgeStyles. Na__LeEdge__Effective is the source of the hatch colour, and Adam's new tag table deliberately puts MixedWoodland and HedgesAndPlanting at the same colour and weight. Two layers hatched differently but coloured identically will look right; two layers hatched identically will be indistinguishable, which is correct but should not surprise anyone reviewing it.
- PATTERN IDS AND Identity__PatternId ARE PERSISTED IN THE TAGS SSOT AND IN SAVED VIEWPORT RECORDS. Renaming one orphans a tag's binding and a viewport's override with no error, exactly as Composite__Key and Layer__CategoryKey do. Declare it un-renameable in Meta, as the Render Composites config declares Meta__KeyStability.
- THE PANEL SECTION OFF ITS TAB IS SKIPPED BY Refresh (is-off-tab). If the Patterns panel is the only thing that calls Na__LeHatch__EnsureLoaded, a saved sheet with a hatched layer will paint no hatch until Adam opens the Scrapbook tab. The load must be driven from Na__LeVp2d__SitePlanDrawing, not from the panel.

#### Rejected alternatives

- SVG <pattern> in <defs> for the screen. It tiles for free, clips for free and stays crisp at any zoom - and it has no counterpart on paper. I confirmed in the vendored jspdf.umd.js that beginTilingPattern, endTilingPattern and addShadingPattern each open with advancedApiModeTrap(...), which throws outside doc.advancedAPI(), and Na__LePdf__BuildDocument never enters advanced mode. Using it would mean two unrelated implementations for one feature, which is how the site plan PDF already ended up cutting no holes while the screen cuts them. Secondary objection: the frame SVG's viewBox is model millimetres and the chrome SVG's is paper millimetres, so a paper-mm tile would need authoring twice.
- A raster PNG tile, following the GradientTool precedent (Na__LeGrad__StripPng / Na__LeGrad__DrawPdf). Rejected on resolution, not on the alpha trap. A 0.18 mm hatch stroke needs about 600 dpi not to fuzz; an A2 sheet at 600 dpi is 14,031 x 9,921 px - 557 MB of canvas. Even one 200 x 150 mm polygon at 300 dpi is 4.2 Mpx and a megabyte or two of PNG, and it still prints visibly softer than the vector linework it abuts. A gradient survives as a raster because it is low-frequency; a hatch is line art and does not.
- jsPDF native tiling patterns via doc.advancedAPI(). Beyond the trap, advanced mode flips the coordinate system (the whole exporter is compat, y-down millimetres) and jsPDF's own documentation warns some plugins do not support it. Switching modes mid-document to paint a hatch would put every other primitive at risk for one feature.
- Triangulated face meshes from the exporter instead of rings. F7 is decisive and SC07 already settled it: Na__SpGlb__Primitives matches an exact mode and a triangle GLB parses to an empty result with no error. Rings also give the even-odd hole cutting for free on both surfaces and are exactly what a clip wants; a triangle soup would have to be re-stitched into an outline before a hatch could be clipped to it.
- Putting the per-use scale and rotation in Viewport__ProjectedEdges -> Edges__Categories. Na__LeRec__NormaliseProjectedEdges rebuilds every entry as exactly four keys, so a fifth is dropped on save; widening it to seven would also force Na__LeEdge__Default to learn about hatches so the prune comparison still works, and would put texture state inside a block documented as 'projected linework style for this viewport only'. Viewport__SitePlan is already shallow-copied by the viewport normaliser and is the block the two-store work will use as well.
- A separate index file per pack. The Custom Scrapbook precedent is one flat UserScrapbook__Index__.json whose entries carry their own category. Five indexes means five things to keep in step by hand on a library with no directory listing anywhere, and the failure mode - a pattern that exists but is invisible on the live site - is silent.
- A Flask write route so the app can save a generated pack. It would need a new blueprint beside ProjectVision__TrueVisionScrapbook__Api__.py, its registration in ProjectVision__LocalServer__Main__.py, a server-rebuilt index, and an 8090 restart by Adam before any route answers (the server never reloads routes). Patterns are shipped content Adam edits in the repo; read-only removes all of that and costs nothing.
- Multiplying the pen weight by Hatch__Scale. A hatch at 2x should be sparser, not fatter - a thickened pen at large scale reads as a bad photocopy and at small scale the strokes merge into a solid tone. The scale multiplies the tile and the marks only.
- Rotating the marks along with the lattice for every pattern. A cross hatch wants it; a woodland rotated 30 degrees would have the trees lying over. Hence Tile__RotationMode, with 'lattice' as Mixed Woodland's value.
- Geometric segment-versus-polygon clipping of the strokes. It is O(strokes x ring edges) without a spatial index and it produces different arithmetic on the two surfaces. Both SVG clip-path and jsPDF clipEvenOdd give an exact clip for free, so the generator only ever needs a bounding-box cull - which is what makes generated geometry affordable at all.
- Doing Shape__Hatch on drawn vector shapes in the same pass. It needs all ten Shape__Gradient sites mirrored (records, model create and update, geometry push and hit, chrome SVG and PDF branches, eyedropper trait table, selection box, shapes panel, parametric portable list). The generator and painters are already shape-agnostic, so it is a cheap later addition - and F5 says the site plan fill path has never drawn a pixel, so one real hatch on one real layer is worth more than two half-built homes.

#### Flagged for Adam

- Pack folders 03__Placeholder and 04__Placeholder need real names now. The index lists folders by name and they are persisted in every pattern's Identity__Pack, so renaming later means editing every pattern file in them. Suggested from the reference sheets: 03__LandscapeAndTerrain (grassland, rough grassland, marsh, heath, orchard, scrub, felled woodland) and 04__AnnotationTones (solid tones, stipples, the design-proposal tone). One word from Adam settles it.
- The tile size for Mixed Woodland - the one figure that decides how the drawing reads and how much it costs. 14 mm gives roughly seven trees per 14 mm square, which at 1:500 is a tree every 30 m or so of real ground. That matches the OS reference sheet's density on paper but is coarse against a real copse. Adam should look at one printed A3 at 1:200 and at 1:500 before the figure is fixed, because it is the same size on both by design (SC08) and he is the only one who can say whether that is right.
- Whether a hatch should follow its layer's line colour (Pen__ColourMode 'layer', the default here - woodland hatches green, water blue, and an edge-style override recolours both together) or carry its own fixed colour so the hatch can be lighter than the line that bounds it. OS sheets usually draw the symbol lighter than the outline. This is a drawing-convention judgement, not a technical one.

---

## hatch:svgpattern  [WINNER - both judges]

### Hatch Patterns: the JSON format, the SVG-native generator, and printing it as clipped vectors (REQ-14, 17, 18, 19, 22)

## 1. What I verified before designing

**The sheet SVG is a string, there is no `<defs>` today, and one already works.** `Na__LeVp2d__PaintSitePlan` builds `let body = ''`, concatenates fill paths then band paths, and assigns `state.linework.innerHTML = '<svg ... viewBox="ox oy w h" preserveAspectRatio="none">' + body + '</svg>'`. The viewBox is in **model millimetres** (`Na__LeVp2d__Window`: `w = frame.WidthMm * D`), which is why every band writes `stroke-width="band.widthMm * D"`. The element is then sized in px by `Na__LeVp2d__SizeLayer` from the same frame mm, so the viewBox and the box have identical aspect ratios and `preserveAspectRatio="none"` never actually shears anything. A `<defs>` referenced by `url(#id)` is already proven in this app by `Na__LeGrad__SvgPaint`, whose `<defs><linearGradient gradientUnits="userSpaceOnUse">` string goes through `innerHTML` in `Na__LayoutEditor__SheetChrome__.js`. `patternUnits`, `patternContentUnits` and `patternTransform` are all in the HTML parser's SVG attribute-adjustment table, so they survive `innerHTML` exactly as `gradientUnits` does.

**Drawing y is already y-down.** `Na__SpGlb__DrawingPoints` sets `drawY = +glTF z`, which for a Y-up glTF written from SketchUp is `-SketchUpY`. So site plan drawing space, SVG user space and jsPDF compat-mm space all agree on y-down. **Glyph geometry authored once in y-down paper millimetres serves both painters with no flip.** This is the single fact that makes one geometry core possible.

**jsPDF: tiling is trapped, clipping is not.** In the vendored `jspdf.umd.js` only `addShadingPattern`, `beginTilingPattern` and `endTilingPattern` call `advancedApiModeTrap`. `API.moveTo`, `API.lineTo`, `API.curveTo`, `API.close`, `API.path`, `API.clip`, `API.clipEvenOdd`, `API.discardPath`, `API.fillEvenOdd`, `API.circle`, `API.setLineJoin` are plain `out()` wrappers with no trap. `clipEvenOdd()` emits `W*`. And `Na__LeGrad__DrawPdf` already clips a path in compat mode (`saveGraphicsState → lines(..., null, true) → clip → discardPath → … → restoreGraphicsState`). So a multi-ring even-odd clip is available today.

## 2. Screen: SVG `<pattern>` — and the trick that makes it cheap

**Verdict: `<pattern>` in `<defs>`, one extra `<path>` per hatched layer.** Rejected: generated clipped geometry (see rejected list).

The payoff of going SVG-native properly: **author the tile in true paper millimetres and put the whole scale conversion in one `patternTransform`.** With `patternUnits="userSpaceOnUse"` the tile width/height are in the *pattern* coordinate system and `patternTransform` maps that system into user space. So:

```
<pattern id="ID" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"
         width="14" height="28" patternTransform="rotate(A) scale(K)">…paper-mm content…</pattern>
```

with `K = D * userScale`. The tile then occupies `14 × D × userScale` model mm = `14 × userScale` paper mm on the sheet — SC08 satisfied, identically at 1:200 and 1:500 — and the stroke widths inside are written as plain paper mm and scaled by the same transform. Nothing inside the pattern is computed. The JSON's numbers go into the SVG byte for byte, and the *same* numbers go into the PDF with the tile loop applying `userScale`. Screen-versus-paper agreement becomes a property of the data, not of two functions staying in step.

The hatch is painted as a second path over the same rings:

```
<path d="RINGS" fill="url(#ID)" fill-rule="evenodd" stroke="none"/>
```

Holes come free from the same `fill-rule="evenodd"` already used for the solid fill; no `<clipPath>` is needed at all. Cost per hatched layer is **one path element and one pattern definition, regardless of polygon count** — which is what makes very large OS polygon sets survivable.

Three real costs, each solved rather than hoped away:

- **Tile-edge clipping.** A stroke crossing the tile boundary is cut by the pattern tile. The generator's `Tile__Wrap` emits every mark whose extent crosses an edge again at ±tile width/height (up to nine copies). This is mandatory for scatter patterns, not decoration.
- **Rotation must not tip the trees over.** `patternTransform="rotate(A)"` rotates the content too. OS tree and reed glyphs are always upright. So `Tile__RotationMode` is `"whole"` (ripples, cross-hatch, diagonals — rotate everything) or `"upright"` (woodland, orchard, marsh — rotate the *layout*, counter-rotate each glyph marked `Glyph__Upright` by `-A` about its own placement point). The counter-rotation is applied identically by the geometry expander for the PDF, so the two agree.
- **Id collisions.** Several viewport SVGs share one document id space. The gradient tool uses a monotonic counter, which would churn on every repaint. Use a **deterministic** id: `naLeHatch-<viewportId>-<short hash of categoryKey>-<Na__LeHatchGeo__Signature>`, stable across repaints and unique per viewport/layer/scale/rotation/ink.

## 3. Paper: real vectors, clipped by the rings

**Verdict: real vector geometry. Not a raster.**

The raster route fails on arithmetic, not taste. jsPDF cannot tile an image in compat mode, so a PNG would have to cover the whole polygon bounding box in one `addImage`. A 400 × 300 mm site plan at the 600 dpi an issued planning drawing needs is 9,449 × 7,087 px — tens of megabytes of base64, rasterising the one thing a planning officer scales off, and (because this build drops alpha on the `'RGBA'` path) needing hand-compositing against the solid fill first. `Na__LeGrad__StripPng` exists because a gradient genuinely has no vector expression in compat jsPDF. A hatch does.

The vector route, inside the frame clip `Na__LePdf__BeginClip` already opened (PDF intersects nested clips for free):

```
doc.saveGraphicsState();
doc.path(ringOps);          // every ring, outer AND inner, as m / l… / h subpaths
doc.clipEvenOdd();          // W*  — holes cut, no trap
doc.discardPath();          // n
…tile loop, doc.setLineWidth / setDrawColor / lines / curveTo / circle…
doc.restoreGraphicsState();
```

`minSegmentPaperMm` (0.05, `LayoutEditor__Linework__MinSegmentPaperMm`) lives inside `Na__LePdf__DrawLinework` and applies only to segments routed through it. The hatch does not go through it — but the library normaliser applies **the same figure from the same config key** when it loads a pattern, and warns on any primitive below it, so the two never disagree. No library glyph should be near 0.05 mm anyway: the smallest thing in Mixed Woodland is a 0.55 mm chevron arm.

Primitive budget: the tile loop runs over `ring bbox ∩ frame rect`, so a polygon mostly off-frame costs nothing. `Hatch__MaxTilesPerFill` (4000) guards the pathological case; past it the PDF draws the solid fill only, logs which layer and why, and throws under `options.strict`. `Bounds__MinTilePaperMm` (2.0) exists to keep that unreachable — 4000 tiles of 2 mm is 160 × 100 mm of solid stipple.

**Free fix to fold in:** `Na__LePdf__DrawSitePlanFills` currently drops inner rings (`if (!ring.outer) return`), so screen and paper already disagree on holes. Rebuilding it on the same `Na__LeHatchPdf__RingPath` + `fillEvenOdd()` fixes that in three lines and makes the fill and its hatch use one path.

## 4. The pattern JSON format

Three-stage naming throughout; blocks are `LayoutEditor__HatchPattern__*`, inner keys `{Block}__{Field}`, array entries carry `__Note`, 4-space indent, values aligned, matching `Na__LayoutEditor__LineStyleTool__Config__.json`.

Two levels of geometry, which is what makes both an OS scatter and a plain cross-hatch expressible in one schema:

- **`Glyphs`** — named reusable shapes, each a list of primitives in its own local mm frame with its own origin (the base of a trunk, the left end of a ripple).
- **`Marks`** — placements of a glyph at `Mark__AtMm` in the tile, with per-mark scale, rotation and mirror. A geometric hatch is a tile whose glyph is one line.

Five authoring primitive kinds — `line`, `polyline`, `arc`, `circle`, `curve` — lowered by the expander into **three** output kinds (`poly`, `circle`, `curve`), so each painter handles three cases, not five.

`Inks` are resolved late. `Ink__Colour` is a hex, or the token `"layer-line"` (→ `Na__LeEdge__Effective(viewport, categoryKey).hex`) or `"layer-fill"` (→ `Layer__Style.FillHex`). Default `"layer-line"`, so a woodland hatch is green and a water hatch blue with nobody choosing anything — and a layer restyled to grey in one viewport gets a grey hatch, free. `Ink__WeightFactor` is a **factor on the sheet master viewport lineweight**, not a width, per `Meta__WhereWeightGoes` in the EdgeStyles config: 1.00 = 0.106 mm at the shipped 0.30 pt master, and raising the master thickens the hatch with everything else.

### Worked example — `HatchPattern__MixedWoodland__.json` (conifer + broadleaf, from the reference sheet)

```json
{
    "LayoutEditor__HatchPattern__Meta": {
        "Meta__FileName"        : "HatchPattern__MixedWoodland__.json",
        "Meta__Description"     : "Mixed woodland: three conifers and three broadleaf trees scattered on a 14 mm tile, the Ordnance Survey convention for woodland of no single species. Drawn in the layer's own line colour, so the woodland tag's green needs no repeating here.",
        "Meta__Version"         : "1.0.0",
        "Meta__Created"         : "20-Sep-2026",
        "Meta__Author"          : "Adam Noble - Noble Architecture",
        "Meta__WhyPaperMm"      : "Every figure is PAPER millimetres. A woodland hatch is the same size on the sheet at 1:200 and at 1:500, as a LayOut pattern is; the viewport's scale denominator is applied once by the generator, in one transform, and never here.",
        "Meta__WhereOriginIs"   : "The tile's origin is its top-left corner and y increases DOWN, which is the SVG's convention and the PDF's. A glyph's own origin is the point it stands on - the base of a trunk, the left end of a ripple - so a mark places the glyph where it meets the ground.",
        "Meta__WhichGlyphs"     : "Conifer is three nested chevrons over a short trunk. Broadleaf is an open circle on a short stem. Both are stroked, never filled: an OS tree reads as an outline over the ground tint, and a filled crown would fight the fill beneath it.",
        "Meta__WhyUpright"      : "Tile__RotationMode is upright: a per-use rotation turns the LAYOUT of the trees and leaves each tree standing. Rotating the content as well would tip the woodland over, which is the one thing a rotated tree hatch must not do."
    },

    "LayoutEditor__HatchPattern__Identity": {
        "Identity__Id"     : "SitePlanHatch__MixedWoodland",
        "Identity__Name"   : "Mixed Woodland",
        "Identity__Pack"   : "05__SitePlanHatches",
        "Identity__Kind"   : "scatter",
        "Identity__Source" : "OS_Symbol__Examples__Woodland&Water__.png - 'Mixed woodland'"
    },

    "LayoutEditor__HatchPattern__Tile": {
        "Tile__Description"  : "The repeating unit. StaggerXMm shifts every other row sideways so the repeat does not read as a grid; the generator expresses it by emitting a tile of twice the height with the second row shifted, because an SVG pattern has no row offset of its own.",
        "Tile__WidthMm"      : 14.0,
        "Tile__HeightMm"     : 14.0,
        "Tile__StaggerXMm"   : 7.0,
        "Tile__Wrap"         : true,
        "Tile__RotationMode" : "upright"
    },

    "LayoutEditor__HatchPattern__Inks": [
        { "Ink__Alias": "foliage", "Ink__Colour": "layer-line", "Ink__WeightFactor": 1.00, "Ink__Note": "The crowns and skirts, at the layer's own line colour and the master lineweight." },
        { "Ink__Alias": "trunk",   "Ink__Colour": "layer-line", "Ink__WeightFactor": 0.85, "Ink__Note": "Trunks a shade finer, so the canopy reads first." }
    ],

    "LayoutEditor__HatchPattern__Glyphs": [
        {
            "Glyph__Id"       : "Conifer",
            "Glyph__Upright"  : true,
            "Glyph__ExtentMm" : [ -1.10, -3.20, 1.10, 0.00 ],
            "Glyph__Note"     : "3.2 mm tall, 2.2 mm across. Origin at the foot of the trunk.",
            "Glyph__Prims"    : [
                { "Prim__Kind": "line",     "Prim__Ink": "trunk",   "Prim__From": [ 0.00, 0.00 ], "Prim__To": [ 0.00, -0.60 ], "Prim__Note": "Trunk" },
                { "Prim__Kind": "polyline", "Prim__Ink": "foliage", "Prim__Points": [ [ -1.10, -0.60 ], [ 0.00, -1.55 ], [ 1.10, -0.60 ] ], "Prim__Closed": false, "Prim__Note": "Lower skirt" },
                { "Prim__Kind": "polyline", "Prim__Ink": "foliage", "Prim__Points": [ [ -0.85, -1.35 ], [ 0.00, -2.30 ], [ 0.85, -1.35 ] ], "Prim__Closed": false, "Prim__Note": "Middle skirt" },
                { "Prim__Kind": "polyline", "Prim__Ink": "foliage", "Prim__Points": [ [ -0.55, -2.15 ], [ 0.00, -3.20 ], [ 0.55, -2.15 ] ], "Prim__Closed": false, "Prim__Note": "Top" }
            ]
        },
        {
            "Glyph__Id"       : "Broadleaf",
            "Glyph__Upright"  : true,
            "Glyph__ExtentMm" : [ -0.95, -2.90, 0.95, 0.00 ],
            "Glyph__Note"     : "2.9 mm tall. An open crown on a stem; never filled.",
            "Glyph__Prims"    : [
                { "Prim__Kind": "line",   "Prim__Ink": "trunk",   "Prim__From": [ 0.00, 0.00 ], "Prim__To": [ 0.00, -1.00 ], "Prim__Note": "Stem" },
                { "Prim__Kind": "circle", "Prim__Ink": "foliage", "Prim__Centre": [ 0.00, -1.95 ], "Prim__RadiusMm": 0.95, "Prim__Filled": false, "Prim__Note": "Crown" }
            ]
        }
    ],

    "LayoutEditor__HatchPattern__Marks": [
        { "Mark__Glyph": "Conifer",   "Mark__AtMm": [  2.60,  4.20 ], "Mark__Scale": 1.00, "Mark__RotationDeg": 0, "Mark__MirrorX": false, "Mark__Note": "Left group" },
        { "Mark__Glyph": "Broadleaf", "Mark__AtMm": [  7.40,  6.60 ], "Mark__Scale": 1.00, "Mark__RotationDeg": 0, "Mark__MirrorX": false, "Mark__Note": "Centre" },
        { "Mark__Glyph": "Conifer",   "Mark__AtMm": [  9.80,  2.90 ], "Mark__Scale": 0.92, "Mark__RotationDeg": 0, "Mark__MirrorX": true,  "Mark__Note": "Upper right, slightly smaller so the stand is not uniform" },
        { "Mark__Glyph": "Broadleaf", "Mark__AtMm": [ 12.40,  9.60 ], "Mark__Scale": 1.05, "Mark__RotationDeg": 0, "Mark__MirrorX": false, "Mark__Note": "Right edge - crosses the tile edge, so Tile__Wrap repeats it on the left" },
        { "Mark__Glyph": "Broadleaf", "Mark__AtMm": [  2.20, 10.40 ], "Mark__Scale": 0.95, "Mark__RotationDeg": 0, "Mark__MirrorX": true,  "Mark__Note": "Lower left" },
        { "Mark__Glyph": "Conifer",   "Mark__AtMm": [  6.20, 12.60 ], "Mark__Scale": 1.00, "Mark__RotationDeg": 0, "Mark__MirrorX": false, "Mark__Note": "Bottom - crosses the lower edge, wrapped to the top" }
    ],

    "LayoutEditor__HatchPattern__Preview": {
        "Preview__Description" : "What the Patterns panel swatch shows: two tiles across, on the ground tint of the tag this pattern is meant for.",
        "Preview__TileCount"   : 2,
        "Preview__InkHex"      : "#43A047",
        "Preview__GroundHex"   : "#DCEDCF"
    }
}
```

`Ponds & Lakes` is the same schema with one `Ripple` glyph (a single cubic S-wave, `Prim__Kind: "curve"`, `From [0,0] C1 [0.85,-0.95] C2 [2.55,0.95] To [3.40,0]`), a 9 × 9 mm tile, two marks, `Tile__RotationMode: "whole"`, ink `layer-line` at 1.00.

## 5. The library index

There is no directory listing on Flask, on `python -m http.server` or on the live site — confirmed, and stated outright in the Custom Scrapbook's `Meta__Files`. So a checked-in index is required, following `Library__IndexFile`.

**One index file, not one per pack:** `52__LayoutEditor__HatchPatternLibrary/HatchPatternLibrary__Index__.json`, with a `Packs` block (folder, id, label, order) and a flat `Patterns` array (each row naming its pack folder and file). A per-pack index would either cost five extra fetches before the first paint or duplicate a pattern-id → location map, and nothing on the server rebuilds either. Adding a pattern is one new file plus one row. Naming follows the content-folder precedent (`UserScrapbook__Index__Items`), so the top-level keys are `HatchPatternLibrary__Index__Meta` / `__Packs` / `__Patterns`.

Keep packs as `.json`. The service worker classifies `.json` as **data, network-first**, so an edited pattern is picked up on the next load; `.svg` would land in the **shell** bucket, stale-while-revalidate, and serve yesterday's tile. Do not add packs to `PWA_SW_SHELL_PRECACHE_RELATIVE`.

## 6. Binding a hatch to a layer

**Default, from the SSOT — the style travels with the data, as everything else on a site plan layer does.** Four hops, only the last of which is a surprise:

1. Tags SSOT: `SitePlan__HatchPatternId`, `SitePlan__HatchScale`, `SitePlan__HatchRotationDeg` on the site plan tag entries.
2. Ruby `Na__SitePlan__BuildLayerDefinitions`: three lines into the `style:` hash.
3. Python `discover_truevision_siteplan_store`: **nothing** — it copies `Layer__Style` whole (`entry.get('Layer__Style')`), verified.
4. `Na__SpStore__Style`: **three lines, mandatory.** It rebuilds exactly seven keys; an eighth is deleted silently and the fault reads as "the exporter did nothing" (F8).

**And a config fallback, which is the migration, not a hedge.** `LayoutEditor__HatchPattern__LayerBindings` maps `Layer__CategoryKey` → pattern id in `Na__LayoutEditor__HatchPattern__Config__.json`. Every manifest exported before this build — PS01, PS02, RB05 — carries no `HatchPatternId`, and the Ruby change needs Adam to re-export (SC03). The config binding lets the whole screen and paper path be proven on PS01 today with no SketchUp at all, and it is the same thinking as SC04's legacy tag aliases applied to style.

Precedence: **viewport override > manifest `Layer__Style.HatchPatternId` > config `LayerBindings` > none.**

**Per-viewport override (REQ-19).** Not `Viewport__ProjectedEdges`: `Na__LeRec__NormaliseProjectedEdges` rebuilds every category entry as exactly four keys and a fifth dies on save (F8). It goes on `Viewport__SitePlan`, which `Na__LeRec__NormaliseViewport` shallow-copies untouched:

```
Viewport__SitePlan : {
    SitePlan__Hatches : {
        "TrueVision__SitePlan__MixedWoodland" : { Hatch__PatternId, Hatch__Scale, Hatch__RotationDeg, Hatch__On }
    }
}
```

Do **not** rely on the shallow copy alone — a shallow copy shares the nested object with whatever the history holds. Add an explicit `Na__LeRec__NormaliseSitePlanHatches` inside the site plan branch of `Na__LeRec__NormaliseViewport`: whitelist four keys per category, clamp against `Bounds`, deep-copy, and drop an entry that has come back to its default, exactly as the projected-edges normaliser does. And `Na__LeModel__UpdateViewport` has no `patch.sitePlan` branch at all, so add a narrow `patch.sitePlanHatches` (merged per category, `null` clears) rather than a general `patch.sitePlan` that a later phase's store binding could silently overwrite.

**The repaint guard.** `Na__LeVp2d__SitePlanPaintKey` must fold in `Na__LeHatch__Token(viewport)` or a scale change repaints nothing. Fold it into the **paint key only, never into `Na__LeVp2d__SitePlanToken`** — that token is also `built.key`, which keys `Na__LeVp2d__BandPaths` in the 16-entry FIFO shared with every architectural viewport. Changing a hatch scale must not evict linework path strings.

**F2 is not a problem here.** Two layers whose linework merges into one band still have their own fills and their own hatches, because a hatch keys off the layer, not the band. Worth stating so nobody "fixes" it.

## 7. Clipping, on screen and on paper

Screen: no `<clipPath>`. The hatch is a `<path>` over the same `Na__LeVp2d__RingPathData(fill.rings)` string with `fill-rule="evenodd"` and `stroke="none"` (REQ-16 — a fill carries no bounding line).

Paper: `Na__LeHatchPdf__RingPath(rings)` → `doc.path()` → `clipEvenOdd()` → `discardPath()`, nested inside the frame clip. The same helper, used with `fillEvenOdd()` instead, replaces the outer-ring-only loop in `Na__LePdf__DrawSitePlanFills` and fixes the hole bug.

Composite order (REQ-31) is two passes, not one interleaved pass: **all** solid fills, then **all** hatches, then the linework — in `Na__LeVp2d__PaintSitePlan` and in `Na__LePdf__DrawViewport` identically.

#### Files

| Action | Path | What |
|---|---|---|
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPattern__Config__.json` | The system config. Blocks: LayoutEditor__HatchPattern__Meta (with Meta__WhyPaperMm, Meta__WhereScaleGoes, Meta__WhyTwoBindings, Meta__WhyUpright, Meta__WhyOneIndex); __Library (Library__ContentFolder '52__LayoutEditor__HatchPatternLibrary', Library__IndexFile 'HatchPatternLibrary__Index__.json'); __Defaults (Defaults__Scale 1, Defaults__RotationDeg 0, Defaults__On true); __Bounds (MinScale 0.25, MaxScale 4, StepScale 0.05, MinRotationDeg 0, MaxRotationDeg 360, StepRotationDeg 1, MinTilePaperMm 2.0, MaxTilePaperMm 60, MinInkWeightFactor 0.10, MaxInkWeightFactor 6.00); __Rendering (MinSegmentPaperMm 0.05, MaxTilesPerFill 4000, WrapCopies 8); __Inks (Inks__Tokens ['layer-line','layer-fill'], Inks__FallbackHex '#000000', Inks__FallbackWeightFactor 1.00); __LayerBindings (array of Binding__CategoryKey / Binding__PatternId / Binding__Scale / Binding__RotationDeg / Binding__Note - the pre-SSOT fallback, seeded with MixedWoodland and Waterbodies); __Labels (panel wording, {name}/{pack} tokens). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatternGeometry__.js` | Namespace Na__LeHatchGeo__. IMPORT-FREE by design (like Na__SitePlan__GlbParse__.js) so a Node test can import a copy; say so in the header. Exports: Na__LeHatchGeo__Normalise(raw, limits) -> normalised pattern + Warnings (whitelists every block, clamps the tile, lowers arc/line into poly/curve, verifies each Glyph__ExtentMm against the computed extent and warns on disagreement, drops a primitive shorter than MinSegmentPaperMm); Na__LeHatchGeo__Expand(pattern, {rotationDeg, inkResolver, masterMm}) -> {WidthMm, HeightMm, Prims:[{Kind:'poly'\|'circle'\|'curve', ...coords in tile paper mm, Hex, WidthMm, Fill}]} applying stagger (doubled tile height), wrap copies, per-mark scale/rotation/mirror and the -A counter-rotation for Glyph__Upright under RotationMode 'upright'; Na__LeHatchGeo__TileSize(pattern, scale); Na__LeHatchGeo__Signature(pattern, scale, rotationDeg, inkHexes) -> short stable string. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatternLibrary__.js` | Namespace Na__LeHatchLib__. Modelled on Na__LayoutEditor__ScrapbookCustom__.js + its Transport, read-only. Const Na__LeHatchLib__AppRootUrl = new URL('../../../', import.meta.url). Exports: Na__LeHatchLib__Ready() (fetch config then index once, never rejects); Na__LeHatchLib__Reload(); Na__LeHatchLib__GetStatus(); STATUS_LOADING/READY/EMPTY/FAILED; Na__LeHatchLib__CHANGED_EVENT; Na__LeHatchLib__GetPacks(); Na__LeHatchLib__ListPatterns(packId); Na__LeHatchLib__FindEntry(patternId); Na__LeHatchLib__LoadPattern(patternId) (fetch + Na__LeHatchGeo__Normalise, cached); Na__LeHatchLib__LoadAll(ids); Na__LeHatchLib__GetPattern(patternId) (synchronous cache read, for the painters); Na__LeHatchLib__Revision(); config accessors Na__LeHatchLib__Bounds / __Defaults / __Rendering / __Bindings / __GetLabel. Per-part encodeURIComponent on the file URL (the library root holds a file with '&' in its name). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatternSvg__.js` | Namespace Na__LeHatchSvg__. Imports the Geometry unit only. Exports Na__LeHatchSvg__Paint(pattern, {id, scale, rotationDeg, denominator, masterMm, inkResolver}) -> {defs:'<pattern id=... patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" width=Tile height=Tile patternTransform="rotate(A) scale(D*scale)">...</pattern>', fill:'url(#id)'} or null; and Na__LeHatchSvg__Defs(list) -> '<defs>'+list.join('')+'</defs>' or ''. Tile content is written at true paper-mm coordinates with paper-mm stroke widths; the single patternTransform does the whole scale conversion. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatternPdf__.js` | Namespace Na__LeHatchPdf__. Imports the Geometry unit only; never imports the SVG unit. Exports Na__LeHatchPdf__RingPath(rings) -> the doc.path() op array ({op:'m'\|'l'\|'h', c:[...]}) covering every ring, outer and inner; and Na__LeHatchPdf__DrawFill(doc, pattern, {rings, clipRectMm, scale, rotationDeg, masterMm, inkResolver, minSegmentPaperMm, maxTiles}) -> boolean. Does saveGraphicsState / doc.path(RingPath) / clipEvenOdd / discardPath / tile loop over (ring bbox intersect clipRectMm) emitting doc.lines, doc.curveTo and doc.circle per expanded primitive / restoreGraphicsState in a finally. Returns false and logs when the tile count exceeds maxTiles. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatternBinding__.js` | Namespace Na__LeHatch__. Imports the Library unit, Na__SitePlan__Store__ (GetLayers) and Na__LayoutEditor__EdgeStyles__ (Na__LeEdge__Effective). Modelled line for line on Na__LeEdge__SitePlanDefault / Na__LeEdge__Effective. Exports: Na__LeHatch__FIELD ('SitePlan__Hatches'); Na__LeHatch__Default(categoryKey) (manifest Layer__Style.HatchPatternId, else the config LayerBindings row, else null); Na__LeHatch__Stored(viewport); Na__LeHatch__Effective(viewport, categoryKey) -> {patternId, scale, rotationDeg, on, overridden} or null; Na__LeHatch__PatternIdsFor(viewport) (for LoadAll); Na__LeHatch__Token(viewport) (library revision + a compact string of every effective binding, for the paint key); Na__LeHatch__InkResolver(viewport, categoryKey) -> (token)=>hex resolving 'layer-line' through Na__LeEdge__Effective and 'layer-fill' through Layer__Style.FillHex. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\HatchPatternLibrary__Index__.json` | The checked-in index (there is no directory listing anywhere). Top-level HatchPatternLibrary__Index__Meta, __Packs (Pack__Id / Pack__Folder / Pack__Name / Pack__Order / Pack__Note for all five folders), __Patterns (Pattern__Id / Pattern__Name / Pattern__Pack / Pattern__File / Pattern__Kind / Pattern__Note per pattern). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\05__SitePlanHatches\HatchPattern__MixedWoodland__.json` | The worked example, verbatim as given in the approach: Identity__Id 'SitePlanHatch__MixedWoodland', 14 x 14 mm tile, StaggerXMm 7, Wrap true, RotationMode 'upright', inks foliage/trunk on 'layer-line', Conifer and Broadleaf glyphs with real primitive geometry, six marks. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\05__SitePlanHatches\HatchPattern__PondsAndLakes__.json` | Identity__Id 'SitePlanHatch__PondsAndLakes'. 9 x 9 mm tile, StaggerXMm 4.5, Wrap true, RotationMode 'whole'. One Ripple glyph: a single cubic S-wave, Prim__Kind 'curve', From [0,0] Control1 [0.85,-0.95] Control2 [2.55,0.95] To [3.40,0], ink 'layer-line' at weight factor 1.00. Two marks at [1.20,2.40] and [4.90,6.50]. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\01__GeometricHatches\HatchPattern__Diagonal45__.json` | Identity__Id 'GeometricHatch__Diagonal45'. Proves the schema covers a plain hatch: a 2.5 x 2.5 mm tile, RotationMode 'whole', Wrap false, one glyph 'Stroke' holding a single line from [0,2.5] to [2.5,0], one mark at [0,0]. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\01__GeometricHatches\HatchPattern__CrossHatch45__.json` | Identity__Id 'GeometricHatch__CrossHatch45'. As Diagonal45 with a second line from [0,0] to [2.5,2.5]. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | Na__SpStore__Style: add three keys to the returned object - HatchPatternId : text(style.HatchPatternId, null), HatchScale : num(style.HatchScale, null), HatchRotationDeg : num(style.HatchRotationDeg, null). MANDATORY: the function rebuilds a closed whitelist and silently deletes anything it does not name (finding F8). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Import Na__LeHatchLib__Ready/LoadAll/GetPattern/Revision, Na__LeHatch__Effective/PatternIdsFor/Token/InkResolver and Na__LeHatchSvg__Paint/Defs. Na__LeVp2d__SitePlanPaintKey: append '\|' + Na__LeHatch__Token(viewport) - the hatch token goes in the PAINT key only, never in Na__LeVp2d__SitePlanToken, which is also built.key for the shared 16-entry BandPaths cache. Na__LeVp2d__SitePlanBuild: put hatch : Na__LeHatch__Effective(viewport, data.categoryKey) on each fills[] entry. Na__LeVp2d__SitePlanDrawing: await Na__LeHatchLib__Ready() then Na__LeHatchLib__LoadAll(Na__LeHatch__PatternIdsFor(viewport)) before the build, so the PDF has the patterns in hand. Na__LeVp2d__PaintSitePlan: collect defs while walking the fills; emit pass 1 (all solid fills, unchanged), pass 2 (all hatches, one <path d=RingPathData fill=url(#id) fill-rule="evenodd" stroke="none"/> each), pass 3 (the bands, unchanged); write Na__LeHatchSvg__Defs(defs) immediately after the opening <svg> tag. Deterministic id naLeHatch-<viewportId>-<hash(categoryKey)>-<Na__LeHatchGeo__Signature>. Na__LeVp2d__FillSitePlan: also repaint on Na__LeHatchLib__CHANGED_EVENT. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js` | Import Na__LeHatchPdf__DrawFill/RingPath, Na__LeHatchLib__GetPattern/Rendering and Na__LeHatch__InkResolver. Rewrite Na__LePdf__DrawSitePlanFills to build one doc.path() from Na__LeHatchPdf__RingPath(fill.rings) and paint it with doc.fillEvenOdd() inside Na__LeChrome__WithOpacity, replacing the per-ring Na__LeChrome__PushPolyline loop and its 'if (!ring.outer) return' - this fixes the existing dropped-hole bug and makes the fill and its hatch share one path. Add Na__LePdf__DrawSitePlanHatches(doc, viewport, described, fills): for each fill carrying an effective hatch whose pattern is loaded, call Na__LeHatchPdf__DrawFill with the rings already converted to paper mm (frame.X + (p - win.OriginX) / D), clipRectMm = the frame, and minSegmentPaperMm from Na__LeCfg__GetLineworkSetup(). In Na__LePdf__DrawViewport's site plan branch, call it between DrawSitePlanFills and DrawLinework (REQ-31: fill, patterns, linework). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Add Na__LeRec__NormaliseSitePlanHatches(block) beside Na__LeRec__NormaliseProjectedEdges: rebuild each category entry as exactly Hatch__PatternId / Hatch__Scale / Hatch__RotationDeg / Hatch__On, clamp the scale and rotation against the config Bounds, deep-copy, drop an entry back at its default and return null for an empty map. Call it from the Na__LeRec__IsSitePlanViewport branch of Na__LeRec__NormaliseViewport: viewport.Viewport__SitePlan['SitePlan__Hatches'] = Na__LeRec__NormaliseSitePlanHatches(...). Do NOT touch Na__LeRec__NormaliseProjectedEdges - a fifth key there is dropped on save (F8). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js` | Add a patch.sitePlanHatches branch to Na__LeModel__UpdateViewport, merged one category at a time with null clearing that category, writing into viewport.Viewport__SitePlan['SitePlan__Hatches'] - the same shape as the existing patch.projectedEdges branch. Deliberately narrow: not a general patch.sitePlan, so a later store-binding phase cannot overwrite a hatch by accident. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Add Na__LeHatchLib__Ready() to the Na__LeMode__ReadyOnce Promise.all, beside Na__LeCfg__Ready / Na__LeEdge__Ready / Na__LeComposite__Ready / Na__LeGrad__Ready / Na__LeDash__Ready / Na__DrawCfg__Load - or the first sheet is normalised before the Bounds the hatch normaliser clamps against exist. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__HatchPatterns__.test.mjs` | Copies Na__LayoutEditor__HatchPatternGeometry__.js into an mkdtempSync folder as .mjs and imports it by pathToFileURL, exactly as Na__Test__FloorPlanStoreyLevel__.test.mjs does (Node resolves .js in this tree as CommonJS). Asserts, against the real HatchPattern__MixedWoodland__.json: the normaliser accepts it with no warnings; every declared Glyph__ExtentMm matches the computed extent; Expand at rotation 0 returns the six marks' primitives plus the stagger row; Tile__Wrap adds exactly the copies for the two edge-crossing marks; under RotationMode 'upright' at 30 degrees every conifer chevron apex is still directly above its trunk foot while the tile frame has turned; no primitive is shorter than MinSegmentPaperMm; and Signature differs for two different scales but is stable across two calls at the same scale. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js` | Bump PWA_SW_VERSION_TOKEN from '2026-09-20-3' in the release that lands the screen phase, and add the matching DEVELOPMENT LOG line in that file. The new imports in Viewport2d__SitePlan and the PDF exporter name exports a warm cache does not have, which breaks the editor until a second visit. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | PHASE H5, Adam runs it. Add SitePlan__HatchPatternId / SitePlan__HatchScale / SitePlan__HatchRotationDeg beside the existing SitePlan__Fill* fields on the 71_75__SitePlanTags__ entries. 75__SitePlan__SoftLandscape__Trees__MixedWoodland -> 'SitePlanHatch__MixedWoodland'; 71__SitePlan__BaseMap__Waterbodies -> 'SitePlanHatch__PondsAndLakes'; null elsewhere. Bump the file meta version. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | PHASE H5, Adam runs it. Na__SitePlan__BuildLayerDefinitions: three lines into the style: hash - 'HatchPatternId' => entry['SitePlan__HatchPatternId'], 'HatchScale' => entry['SitePlan__HatchScale'], 'HatchRotationDeg' => entry['SitePlan__HatchRotationDeg']. Nothing else; Na__SitePlan__Write already writes Layer__Style whole and the Python build script copies it whole. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill sections 6 (face fills and the hatch pattern format) and 7 (the SVG hatch generator) with this design; add decisions SC15 (PDF hatches print as vectors clipped by an even-odd ring path, because clipEvenOdd / path / fillEvenOdd are NOT behind advancedApiModeTrap - verified in the vendored build - and a raster tile would need one whole-bbox addImage at ~9400 x 7100 px), SC16 (the tile is authored in true paper mm and one patternTransform does the whole scale conversion), SC17 (RotationMode upright keeps tree and reed glyphs standing under a per-use rotation), SC18 (one library index file, not one per pack), SC19 (a hatch binds from the SSOT AND from a config LayerBindings fallback, viewport override first, because no manifest on disk carries a HatchPatternId), SC20 (a per-viewport hatch override lives on Viewport__SitePlan.SitePlan__Hatches with its own normaliser, never in Viewport__ProjectedEdges). Add the H0-H6 rows to the section 12 ledger. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` | One entry per phase that lands, newest at the top, in the house voice. |

#### New keys

- `LayoutEditor__HatchPattern__Meta`
- `LayoutEditor__HatchPattern__Meta.Meta__FileName`
- `LayoutEditor__HatchPattern__Meta.Meta__Description`
- `LayoutEditor__HatchPattern__Meta.Meta__Version`
- `LayoutEditor__HatchPattern__Meta.Meta__Created`
- `LayoutEditor__HatchPattern__Meta.Meta__Author`
- `LayoutEditor__HatchPattern__Meta.Meta__WhyPaperMm`
- `LayoutEditor__HatchPattern__Meta.Meta__WhereScaleGoes`
- `LayoutEditor__HatchPattern__Meta.Meta__WhyTwoBindings`
- `LayoutEditor__HatchPattern__Meta.Meta__WhyUpright`
- `LayoutEditor__HatchPattern__Meta.Meta__WhyOneIndex`
- `LayoutEditor__HatchPattern__Meta.Meta__WhichInks`
- `LayoutEditor__HatchPattern__Library`
- `LayoutEditor__HatchPattern__Library.Library__Description`
- `LayoutEditor__HatchPattern__Library.Library__ContentFolder`
- `LayoutEditor__HatchPattern__Library.Library__IndexFile`
- `LayoutEditor__HatchPattern__Defaults`
- `LayoutEditor__HatchPattern__Defaults.Defaults__Description`
- `LayoutEditor__HatchPattern__Defaults.Defaults__Scale`
- `LayoutEditor__HatchPattern__Defaults.Defaults__RotationDeg`
- `LayoutEditor__HatchPattern__Defaults.Defaults__On`
- `LayoutEditor__HatchPattern__Bounds`
- `LayoutEditor__HatchPattern__Bounds.Bounds__Description`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MinScale`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MaxScale`
- `LayoutEditor__HatchPattern__Bounds.Bounds__StepScale`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MinRotationDeg`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MaxRotationDeg`
- `LayoutEditor__HatchPattern__Bounds.Bounds__StepRotationDeg`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MinTilePaperMm`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MaxTilePaperMm`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MinInkWeightFactor`
- `LayoutEditor__HatchPattern__Bounds.Bounds__MaxInkWeightFactor`
- `LayoutEditor__HatchPattern__Rendering`
- `LayoutEditor__HatchPattern__Rendering.Rendering__Description`
- `LayoutEditor__HatchPattern__Rendering.Rendering__MinSegmentPaperMm`
- `LayoutEditor__HatchPattern__Rendering.Rendering__MaxTilesPerFill`
- `LayoutEditor__HatchPattern__Rendering.Rendering__WrapCopies`
- `LayoutEditor__HatchPattern__Inks`
- `LayoutEditor__HatchPattern__Inks.Inks__Description`
- `LayoutEditor__HatchPattern__Inks.Inks__Tokens`
- `LayoutEditor__HatchPattern__Inks.Inks__FallbackHex`
- `LayoutEditor__HatchPattern__Inks.Inks__FallbackWeightFactor`
- `LayoutEditor__HatchPattern__LayerBindings`
- `LayoutEditor__HatchPattern__LayerBindings[].Binding__CategoryKey`
- `LayoutEditor__HatchPattern__LayerBindings[].Binding__PatternId`
- `LayoutEditor__HatchPattern__LayerBindings[].Binding__Scale`
- `LayoutEditor__HatchPattern__LayerBindings[].Binding__RotationDeg`
- `LayoutEditor__HatchPattern__LayerBindings[].Binding__Note`
- `LayoutEditor__HatchPattern__Labels`
- `LayoutEditor__HatchPattern__Labels.Labels__Description`
- `LayoutEditor__HatchPattern__Labels.Labels__Title`
- `LayoutEditor__HatchPattern__Labels.Labels__Pack`
- `LayoutEditor__HatchPattern__Labels.Labels__Hint`
- `LayoutEditor__HatchPattern__Labels.Labels__Empty`
- `LayoutEditor__HatchPattern__Labels.Labels__Loading`
- `LayoutEditor__HatchPattern__Labels.Labels__Failed`
- `LayoutEditor__HatchPattern__Labels.Labels__Scale`
- `LayoutEditor__HatchPattern__Labels.Labels__ScaleTitle`
- `LayoutEditor__HatchPattern__Labels.Labels__Rotation`
- `LayoutEditor__HatchPattern__Labels.Labels__RotationTitle`
- `LayoutEditor__HatchPattern__Labels.Labels__None`
- `LayoutEditor__HatchPattern__Labels.Labels__TooManyTiles`
- `LayoutEditor__HatchPattern__Identity`
- `LayoutEditor__HatchPattern__Identity.Identity__Id`
- `LayoutEditor__HatchPattern__Identity.Identity__Name`
- `LayoutEditor__HatchPattern__Identity.Identity__Pack`
- `LayoutEditor__HatchPattern__Identity.Identity__Kind`
- `LayoutEditor__HatchPattern__Identity.Identity__Source`
- `LayoutEditor__HatchPattern__Tile`
- `LayoutEditor__HatchPattern__Tile.Tile__Description`
- `LayoutEditor__HatchPattern__Tile.Tile__WidthMm`
- `LayoutEditor__HatchPattern__Tile.Tile__HeightMm`
- `LayoutEditor__HatchPattern__Tile.Tile__StaggerXMm`
- `LayoutEditor__HatchPattern__Tile.Tile__Wrap`
- `LayoutEditor__HatchPattern__Tile.Tile__RotationMode`
- `LayoutEditor__HatchPattern__Inks[].Ink__Alias`
- `LayoutEditor__HatchPattern__Inks[].Ink__Colour`
- `LayoutEditor__HatchPattern__Inks[].Ink__WeightFactor`
- `LayoutEditor__HatchPattern__Inks[].Ink__Note`
- `LayoutEditor__HatchPattern__Glyphs`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Id`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Upright`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__ExtentMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Note`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Kind`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Ink`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__From`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__To`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Points`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Closed`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Centre`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__RadiusMm`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__StartDeg`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__SweepDeg`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Control1`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Control2`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Filled`
- `LayoutEditor__HatchPattern__Glyphs[].Glyph__Prims[].Prim__Note`
- `LayoutEditor__HatchPattern__Marks`
- `LayoutEditor__HatchPattern__Marks[].Mark__Glyph`
- `LayoutEditor__HatchPattern__Marks[].Mark__AtMm`
- `LayoutEditor__HatchPattern__Marks[].Mark__Scale`
- `LayoutEditor__HatchPattern__Marks[].Mark__RotationDeg`
- `LayoutEditor__HatchPattern__Marks[].Mark__MirrorX`
- `LayoutEditor__HatchPattern__Marks[].Mark__Note`
- `LayoutEditor__HatchPattern__Preview`
- `LayoutEditor__HatchPattern__Preview.Preview__Description`
- `LayoutEditor__HatchPattern__Preview.Preview__TileCount`
- `LayoutEditor__HatchPattern__Preview.Preview__InkHex`
- `LayoutEditor__HatchPattern__Preview.Preview__GroundHex`
- `HatchPatternLibrary__Index__Meta`
- `HatchPatternLibrary__Index__Meta.Meta__FileName`
- `HatchPatternLibrary__Index__Meta.Meta__Description`
- `HatchPatternLibrary__Index__Meta.Meta__Version`
- `HatchPatternLibrary__Index__Meta.Meta__Created`
- `HatchPatternLibrary__Index__Meta.Meta__Author`
- `HatchPatternLibrary__Index__Meta.Meta__WhyAnIndex`
- `HatchPatternLibrary__Index__Meta.Meta__HowToAdd`
- `HatchPatternLibrary__Index__Packs`
- `HatchPatternLibrary__Index__Packs[].Pack__Id`
- `HatchPatternLibrary__Index__Packs[].Pack__Folder`
- `HatchPatternLibrary__Index__Packs[].Pack__Name`
- `HatchPatternLibrary__Index__Packs[].Pack__Order`
- `HatchPatternLibrary__Index__Packs[].Pack__Note`
- `HatchPatternLibrary__Index__Patterns`
- `HatchPatternLibrary__Index__Patterns[].Pattern__Id`
- `HatchPatternLibrary__Index__Patterns[].Pattern__Name`
- `HatchPatternLibrary__Index__Patterns[].Pattern__Pack`
- `HatchPatternLibrary__Index__Patterns[].Pattern__File`
- `HatchPatternLibrary__Index__Patterns[].Pattern__Kind`
- `HatchPatternLibrary__Index__Patterns[].Pattern__Note`
- `Layer__Style.HatchPatternId`
- `Layer__Style.HatchScale`
- `Layer__Style.HatchRotationDeg`
- `SitePlan__HatchPatternId`
- `SitePlan__HatchScale`
- `SitePlan__HatchRotationDeg`
- `Viewport__SitePlan.SitePlan__Hatches`
- `Viewport__SitePlan.SitePlan__Hatches.<categoryKey>.Hatch__PatternId`
- `Viewport__SitePlan.SitePlan__Hatches.<categoryKey>.Hatch__Scale`
- `Viewport__SitePlan.SitePlan__Hatches.<categoryKey>.Hatch__RotationDeg`
- `Viewport__SitePlan.SitePlan__Hatches.<categoryKey>.Hatch__On`

#### Order of work

1. H0 (precondition, owned by the fills phase, not this one). Make ONE real site plan fill appear on screen and in a PDF before any hatch work. Finding F5: PS01 paints zero fills today - the only layer with a fill GLB (ExistingBuildings) has FillHex null, and the two layers with a fill colour have no rings. Until a fill is on screen there is nothing to hatch and no way to tell a broken hatch from a broken fill. Give TrueVision__SitePlan__ExistingBuildings a SitePlan__FillColourId, or hand-edit PS01's local manifest, and open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 (127.0.0.1, never app.localhost - the local manifest wins only on that hostname).
2. H1. Data and geometry, no painting. Write Na__LayoutEditor__HatchPattern__Config__.json, HatchPatternLibrary__Index__.json, HatchPattern__MixedWoodland__.json, HatchPattern__PondsAndLakes__.json, HatchPattern__Diagonal45__.json, HatchPattern__CrossHatch45__.json, then Na__LayoutEditor__HatchPatternGeometry__.js and Na__LayoutEditor__HatchPatternLibrary__.js. Write Na__Test__HatchPatterns__.test.mjs and make it pass. Run node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs. Independently testable with no browser.
3. H2. Screen. Na__LayoutEditor__HatchPatternSvg__.js and Na__LayoutEditor__HatchPatternBinding__.js (config LayerBindings path only - do NOT touch the SSOT yet). Plumb the defs and the second fill pass into Na__LeVp2d__PaintSitePlan, fold Na__LeHatch__Token into Na__LeVp2d__SitePlanPaintKey, add Na__LeHatchLib__Ready() to Na__LeMode__ReadyOnce. Bind the hatch to whichever layer H0 made visible via LayerBindings, and look at it at 1:500 and 1:1250 on the same sheet: the tile must measure the same on paper at both. Zoom the sheet to 400% and check the pattern is still crisp (the paper is zoomed by a CSS transform: scale() with no will-change, so it should re-rasterise; this is the one unverified assumption). Bump PWA_SW_VERSION_TOKEN.
4. H3. Paper. Na__LayoutEditor__HatchPatternPdf__.js, then rewrite Na__LePdf__DrawSitePlanFills on the shared Na__LeHatchPdf__RingPath + fillEvenOdd (fixing the dropped inner rings at the same time) and add Na__LePdf__DrawSitePlanHatches between the fills and the linework. Export the SAME sheet H2 proved and compare the PDF against the screen side by side: same tile size, same glyph, same holes, same colour. Open the PDF in the vendored pdf.js under PlanVision to confirm the hatch is vector, not an image.
5. H4. Per-use scale and rotation (REQ-19). Na__LeRec__NormaliseSitePlanHatches in Na__LayoutEditor__SheetRecords__.js and the patch.sitePlanHatches branch in Na__LayoutEditor__SheetModel__Viewports__.js. Drive it from the console first (Na__LeModel__UpdateViewport with a sitePlanHatches patch), prove the sheet repaints, then save, reload and check the override survives - and test REDO as well as undo. The panel controls belong to the Patterns panel design; this phase only has to leave them a record and a setter.
6. H5. The SSOT route. Three keys in Na__DataLib__CoreIndex__Tags__.json, three lines in Na__TrueVision__GlbBuilder__SitePlanExport__.rb, three lines in Na__SpStore__Style. STOP AND ASK ADAM to run the export from SketchUp (SC03) - there is no Ruby interpreter on this PC. When his re-export lands, a MixedWoodland layer must hatch itself with no config binding and no user action, and the config LayerBindings row for it can then be deleted.
7. H6. The rest of the library: Grassland, Rough Grassland, Orchard, Marsh/Reedbed, Scrub, Felled Woodland from the Woodland & Water sheet, plus the geometric and construction-material packs. Pure data; each one is a file plus an index row and needs no code. Name 03__Placeholder and 04__Placeholder before writing into them - ask Adam.

#### Risks

- The whole build sits on an unexercised code path. Finding F5: no site plan fill has ever been painted in TrueVision, on screen or on paper. If H0 is skipped, a hatch that does not appear is indistinguishable from a fill that does not appear, and the first day of H2 will be spent on the wrong bug.
- Na__SpStore__Style is a closed seven-key whitelist. Without the three-line edit, the SSOT route fails completely and SILENTLY - the SketchUp tag is right, the Ruby is right, the manifest on disk is right, the build script copies Layer__Style whole, and the app shows no hatch. It will read as 'the exporter did nothing'. This is finding F8 and it is the single most likely way this build wastes a session.
- Pattern tiles under the paper's CSS transform: scale() at high zoom. .na-le-paper has transform-origin and a transform but no will-change, so the layer is not force-promoted and vector content including patterns should re-rasterise on repaint - but this is NOT verified in Edge, and a blurred hatch at 400% would be the first thing Adam notices. Check it explicitly in H2 at 100%, 200% and 400%. The existing linework paths have the same property, so if patterns blur, so does everything else and the fix is shared.
- Tile-edge clipping is a correctness bug, not a polish item. An SVG <pattern> cuts any stroke crossing the tile boundary. If Tile__Wrap is implemented late or half-heartedly, a mixed woodland reads as a grid of half-trees and the whole pattern looks broken. Two of the six marks in the worked example deliberately cross an edge, so the Node test catches it on day one.
- Pattern ids share one document id space across every viewport SVG on the sheet. Two site plan viewports of the same layer at different scales must not collide; if they do, one silently paints the other's hatch and it will look like a scale bug. The signature-based id is the fix; the test asserts it.
- A per-use rotation on an upright pattern rebuilds the tile content, so its SVG defs string and its expanded PDF primitives both depend on A. Anything that caches an expanded tile must key on A. Na__LeHatchGeo__Signature must include the rotation, not just the scale.
- The PDF primitive budget. A pathological pattern (a sub-millimetre stipple over a whole sheet) would emit hundreds of thousands of operators and make the PDF unopenable. Rendering__MaxTilesPerFill 4000 guards it and Bounds__MinTilePaperMm 2.0 is meant to make it unreachable, but a library pattern authored badly could still get close; the normaliser's warnings must be surfaced somewhere Adam sees them, not only in the console.
- PWA token. The release that lands H2 adds new module exports named by new imports in Viewport2d__SitePlan and the PDF exporter. A warm cache lacking them breaks the editor until the second visit. PWA_SW_VERSION_TOKEN is currently '2026-09-20-3'; bump it and add the matching DEVELOPMENT LOG line in that file.
- ValeVision. 36__System__HatchPatternTools and 52__LayoutEditor__HatchPatternLibrary are both absent there, and its EdgeStyles, SheetRecords and ScaleManager contain zero occurrences of 'SitePlan'. The Geometry, Svg and Pdf trio is site-plan-free and would port cleanly; the Binding module would not, because it imports Na__SpStore__GetLayers and Na__LeEdge__SitePlanDefault, neither of which exists in ValeVision. Any port is a surgical merge, and per the standing rule it is only OFFERED after Adam confirms the TrueVision work.
- The Patterns panel (REQ-20/21/22) is a different design's scope but shares this library module. If that design invents its own loader or its own index shape, there will be two indexes and they will drift. Na__LeHatchLib__ is deliberately the only module that knows where the files are; the panel must read through it.

#### Rejected alternatives

- jsPDF native tiling patterns (beginTilingPattern / endTilingPattern / addShadingPattern). Verified in the vendored jspdf.umd.js: all three call advancedApiModeTrap, which throws outside doc.advancedAPI(), and this exporter runs entirely in compat mode (y-down millimetres, doc.line, doc.lines everywhere). Switching the exporter to advanced mode would invert every y coordinate in every primitive on every sheet. Not available, not worth reaching for.
- A raster PNG tile in the PDF (the GradientTool precedent). Rejected on arithmetic. jsPDF cannot tile an image in compat mode, so the PNG would have to cover the whole polygon bounding box in one addImage. At the 600 dpi an issued planning drawing needs, a 400 x 300 mm site plan is 9,449 x 7,087 px - tens of megabytes of base64, and it rasterises the one thing a planning officer scales off. It would also need hand-compositing against the solid fill first, because this build drops alpha on the 'RGBA' addImage path. Na__LeGrad__StripPng exists because a gradient has no vector expression in compat jsPDF; a hatch does.
- Generated clipped geometry on screen instead of <pattern>. Rejected on cost and on cache damage. A 120 x 80 mm woodland at a 14 mm tile is ~50 tiles x ~30 primitives = 1,500 path segments per layer, per repaint, against ONE path element for the pattern; and an OS mapping composite has many such layers. Worse, the generated path strings would have to live somewhere, and the obvious somewhere is Na__LeVp2d__PathCache - a 16-entry FIFO shared with every architectural viewport in the app, which hatch geometry would flush.
- Putting the per-viewport scale and rotation in Viewport__ProjectedEdges. Na__LeRec__NormaliseProjectedEdges rebuilds every category entry as exactly Category__Label / Category__EdgeWeightFactor / Category__EdgeColour / Category__EdgeLineType. A fifth key is dropped on save, silently (finding F8). Viewport__SitePlan is shallow-copied untouched by Na__LeRec__NormaliseViewport and is the right home.
- Relying on that shallow copy alone, with no normaliser. Rejected: a shallow copy shares the nested SitePlan__Hatches object with whatever the undo history holds, and there would be nothing clamping a scale or pruning a default. One small normaliser, modelled on the projected-edges one, costs twenty lines and makes the record honest.
- Adding patch.sitePlan as a general branch on Na__LeModel__UpdateViewport. The two-stores phase (REQ-25 to REQ-27) will want to write a store id into the same object; a general branch lets either phase overwrite the other's key. A narrow patch.sitePlanHatches cannot.
- A per-pack index file (HatchPack__Index__.json in each folder), the obvious reading of 'each sub-folder is a pack'. Rejected: nothing on the server rebuilds these (unlike the Custom Scrapbook's, which ProjectVision__TrueVisionScrapbook__Api__.py writes), so they are hand-maintained either way; and the default-binding resolver needs to find one pattern id before the first paint, which with five pack indexes means five fetches or a duplicated location map. One index, with Pattern__Pack naming the folder, satisfies REQ-21 and costs one fetch.
- Shipping pattern tiles as .svg files. The service worker classifies .svg under PWA_SW_PATTERN_SHELL_ASSET - the shell bucket, stale-while-revalidate in production - so an edited tile serves the previous version until a second reload. .json lands in the data bucket, network-first. Keep patterns as .json.
- Binding the hatch only in a TrueVision config, with no SSOT field. It works today with no exporter change, but it splits the site plan style vocabulary in two: line colour, weight, type and fill colour all travel with the data from the tags SSOT, and the hatch would not. Adam's whole site plan design is that the style travels with the data. The config binding is kept as the FALLBACK, because no manifest on disk carries a HatchPatternId and the Ruby change needs Adam to re-export.
- Binding only in the SSOT, with no config fallback. Rejected because it makes the entire screen and paper path untestable until Adam next opens SketchUp (SC03), and PS01 and PS02 - the only fixtures - would never hatch.
- An absolute Ink__WidthMm instead of Ink__WeightFactor. Rejected against the house rule stated outright in Na__LayoutEditor__EdgeStyles__Config__.json's Meta__WhereWeightGoes: 'A weight FACTOR is never a width.' A factor on the sheet master viewport lineweight means raising the master thickens the hatch with everything else and the ink hierarchy survives.
- Folding the hatch token into Na__LeVp2d__SitePlanToken. It reads as the natural place, but that token is also built.key, which keys Na__LeVp2d__BandPaths. Changing a hatch scale would evict linework path strings for every viewport sharing the 16-entry cache. It goes in Na__LeVp2d__SitePlanPaintKey only.
- Letting patternTransform='rotate(A)' rotate scatter glyphs with the tile. It is what the attribute does and it is wrong for OS symbology: a woodland rotated 20 degrees would have its trees leaning. Hence Tile__RotationMode, and the -A counter-rotation applied by the geometry expander so the screen and the paper tip identically (i.e. not at all).
- A monotonic pattern-id counter, as Na__LeGrad__IdCounter does for gradients. A gradient's defs is rebuilt on every chrome repaint so churn is free there; a hatch id that changes every repaint would defeat any future caching and makes a bug impossible to read in the DOM. A deterministic id from viewport + category + signature is unique across viewports and stable across repaints.

#### Flagged for Adam

- The two unnamed pack folders, 03__Placeholder and 04__Placeholder. The index has to list a folder by name and the panel will show an empty section for anything listed, so naming them now is cheaper than renaming folders later. My guess from the reference sheet would be 03__LandUseAndSpecialAreas (National Park, AONB, SSSI, flood zone, danger area) and 04__TerrainAndSurfaces (scree, sand/shingle, rock outcrop, hardstanding), but they are his folders. Until he answers I will list only the three named packs and leave the two out of the index, which costs nothing to change.
- Whether a hatch should be able to override the layer's colour. My default is that it cannot: every ink resolves to 'layer-line', so a woodland hatch is green because the woodland tag is green and a water hatch is blue for the same reason, with no per-project colour picking and no new rows needed in LayoutEditor__EdgeStyles__Colours (finding F4). The schema already allows a fixed hex per ink if he later wants, say, a brown earth-bank hatch on a green layer. I would not build a UI for it until he asks.

---

## design:panels

### Site Plan Composites + Patterns: the two new Layout Editor panels (REQ-20, REQ-21, REQ-32)

## 1. Where the two controls go, and why registration order settles it

`Na__LePanels__RegisterSection(side, spec)` appends to `column.querySelector('.na-le-panel__scroll')`. There is no order field, no priority, no re-sort. The list of `*__Register()` calls inside the shell builder of `Na__LayoutEditor__ModeController__.js` (the block beginning `Na__LePanels__Mount({ left : ..., right : ... })`) IS the column order. Both new panels are therefore one call each, placed exactly.

**LEFT** — insert `Na__LePanelSpComp__Register();` between `Na__LePanelStyles__Register();` and `Na__LePanelModelLayers__Register();`. It is the site-plan twin of Render Composites and belongs beside it; Model Layers stays last because it is the long list.

**RIGHT** — insert `Na__LePanelPatterns__Register();` immediately after `Na__LePanelScrapCustom__Register();`, which is the last call in the file's right-column block. That makes Patterns the last section in the right column's DOM, which is literally what Adam asked for.

## 2. Scrapbook TAB, not a standalone panel and not a fourth tab (point 3)

SC09 rules out a fourth **tab**, and the code agrees: `Na__LePanels__RegisterTab` hides the strip while `tabs.length < 2` and otherwise splits it evenly, so a third tab shrinks and re-weights the two Adam reads — the "uniform tab styling" rule.

The remaining choice is which existing tab. `Na__LePanels__TabOf` falls back to `tabs[0].id` (`'properties'`) when `spec.tab` is omitted, so an omitted tab still lands last in the column — Adam's words are satisfied either way. I put it on the Scrapbook tab (`tab : Na__LeScrap__TAB_ID`, imported from `../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js` exactly as `Panel__ScrapbookCustom__` does) for three reasons read out of the code:

1. Adam described a **library of packs**. The Scrapbook tab already means "libraries", and holds three sibling sections. A fourth is the established shape.
2. Selecting a viewport on the sheet does **not** switch tabs — `Na__LeMode__FocusPanelForSelection` only calls `Na__LePanels__FocusSection`, which returns early for any id outside `LayoutEditor__Panels__AccordionSections` (`text`, `dimensions`, `shapes`, `leaders`). So a Patterns panel on the Scrapbook tab stays open and stays put while the user clicks from viewport to viewport — which is exactly the workflow.
3. The Properties tab's sections are one-per-selected-kind. A pattern library is not a property of a selection; it is a source you apply *from*.

So: **follow Adam literally — last in the right column — and satisfy it as a section on the existing Scrapbook tab.** Nothing in the code makes this impossible, so no exception is needed.

## 3. Site Plan Render Composites (REQ-32) — weights, not styles (point 4)

The existing feature splits in two for historical reasons only: toggles in `Viewport__Styles` (booleans), weights in `Viewport__CompositeWeights` (numbers). I reject reusing either.

`Viewport__Styles` is a **dense** record — `Na__LeRec__NormaliseViewport` rebuilds all eight keys on every viewport of every sheet on every load and save. Two site-plan-only booleans would be written into every architectural viewport in every project file forever, and a new key there needs four edits (`Na__LeRec__STYLE_KEYS`, the `Viewport__Styles = {...}` literal, `Na__LeCfg__DefaultStyles`, `LayoutEditor__Viewport__DefaultStyles`) — and would *still* not repaint, because `Na__LeVp2d__StyleToken` is `Na__LeEdge__Token + '#' + Na__LeComposite__Token` and neither reads `Viewport__Styles`.

Adding rows to the existing `LayoutEditor__RenderComposites__Layers` would persist through `Viewport__CompositeWeights` and join the token for free, but it puts site-plan rows in the panel of every architectural viewport (they would have to be filtered by a new flag) and it mixes two inventories in one file.

**Decision: a parallel module and a parallel sparse record.** `Na__LayoutEditor__SitePlanComposites__.js` (namespace `Na__LeSpComp`) mirrors `Na__LeComposite` one-for-one — `__ConfigUrl` from `import.meta.url`, `__FALLBACK` array, memoised `__Ready()` with `{cache:'no-store'}`, `__Rows()`, `__Row(key)`, `__Clamp`, `__IsOn`, `__Weight`, `__Factor`, `__IsOverridden`, `__Token` — and writes one new record key, `Viewport__SitePlanComposites`, holding **both** the toggle and the weight per row and stored **only where a viewport dissents** (`null` otherwise), per the house rule the normaliser's own comment states.

Three rows, keys permanent: `sitePlanFill` (Solid Fill Base), `sitePlanPattern` (Hatch Patterns), `sitePlanLinework` (Site Plan Linework). The first two carry `Weight__Kind: "factor"`, min 0.00, max 1.00, default 1.00 — an opacity multiplier on the layer's own `FillOpacity` / the pattern's ink. `sitePlanLinework` is `Weight__Kind: "none"` (toggle only), deliberately: `projectedLinework` already multiplies site plan band widths via `Na__LeComposite__Factor`, and two numbers fighting over one width is the fault this avoids.

The panel, `Na__LayoutEditor__Panel__SitePlanComposites__.js` (section id `'siteplan-composites'`), is `Na__LayoutEditor__Panel__Styles__.js` copied structurally: `Na__LePanels__AdvancedToggle`, a `[data-na-block="note"]`, a `[data-na-block="list"]` of `na-le-row--toggle` rows each with an inline `na-le-row__adv na-le-adv` weight cluster and a `↺` reset, a `BuiltKey` rebuild signature, and `document.activeElement !== el` guards. `Na__LePanelStyles__Unit` returns `'×'` for anything that is not `'pixels'`, so the copied cluster reads right unchanged. Same shape, same wording pattern, same Advanced fold — "the same kind of controls", literally.

## 4. The Patterns panel (REQ-19, REQ-20, REQ-21) — packs, tiles, scale and rotation (point 2)

`52__LayoutEditor__HatchPatternLibrary` sits beside `Index.html` and is served by a plain relative GET in all three environments (the 8090 catch-all `serve_static` over `REPO_ROOT`, a static server, GitHub Pages). **No environment lists a directory**, so a checked-in index is mandatory — the Custom Scrapbook's contract exactly.

- `Na__LayoutEditor__HatchPatterns__Transport__.js` (`Na__LeHatchIo`) is `Na__LayoutEditor__ScrapbookCustom__Transport__.js` copied with only the `Place` defaults changed: `{ contentFolder : '52__LayoutEditor__HatchPatternLibrary', indexFile : 'HatchPattern__Index__.json', apiPath : '/api/truevision/hatchpatterns' }`. Keep `new URL('../../../', import.meta.url)` — it resolves the folder holding `Index.html` from any `51__System__LayoutEditor/NN__*/` module — and keep the per-segment `encodeURIComponent` (the library root holds `OS_Symbol__Examples__Woodland&Water__.png`). Reading only: `ReadIndex`, `ReadPattern`. No `Post`, no `Save`, no `Delete`.
- `Na__LayoutEditor__HatchPatterns__.js` (`Na__LeHatch`) is the library layer: `__Ready()`, `__Label(key, fallback, tokens)`, `__Packs()`, `__PatternsIn(pack)`, `__GetPattern(id)`, `__LoadPack(folder)` (lazy, PENDING-marked, announces `Na__LeHatch__CHANGED_EVENT`), `__Bounds()`, plus the record layer: `__FIELD = 'Viewport__SitePlanHatches'`, `__Effective(viewport, categoryKey)`, `__Token(viewport)`. Per SC16 `__Packs()` drops a pack with no patterns, so the two `__Placeholder` folders cost nothing.
- Patterns are kept as `.json`, never `.svg` — the service worker classifies `.json` network-first (`PWA_SW_PATTERN_DATA_JSON`) but `.svg` into the stale-while-revalidate shell bucket, where an edited tile serves the previous version until a second reload.

Panel body, top to bottom: a **Layer** select (the site plan layers of the selected viewport, from `Na__SpStore__GetLayers()` intersected with `Na__LeSource__CategoryKeys(viewport)`, labelled `Layer__Group – Layer__Label`, last choice remembered in `na-layouteditor-patterns:layer`); a **Pack** select; a note; a `.na-le-scrap`-style tile grid with a leading **None** tile and `is-active` on the assigned pattern; then a **Scale** slider and a **Rotation** slider built with `Na__LePanels__SliderRow` / `ShowSlider` (the gradient rows' readout class, so every slider in the editor reads alike); then a Reset button.

A tile is **not** `Na__LeScrapDrag__Tile` — that drags records onto paper. It is a plain `<button class="na-le-scrap__item">` with `data-na-control="pattern-tile"` and `data-na-role="<Pattern__Id>"`, its thumb filled by `Na__LeHatch__PreviewMarkup(pattern, scale, rotationDeg)` — modelled on `Na__LeDash__PreviewMarkup`, drawn at ~4 px per paper mm, and **emitting plain geometry with no `<defs>` and no id**: the sheet chrome, markup, focus and per-frame linework SVGs share one document, and a repeated `<pattern>` id would leak the panel's swatch into the paper. The generator design owns `PreviewMarkup`, and the panel and the painter must call the same function so the swatch cannot drift from the paint — the `Na__LeGrad__ColourAt` precedent.

Clicking a tile, moving a slider or pressing Reset all write one patch through `Na__LeModel__UpdateViewport(sheet, viewportId, { sitePlanHatches : { '<categoryKey>' : { Hatch__PatternId, Hatch__Scale, Hatch__RotationDeg } } })`, with `null` for that category clearing it — the `patch.projectedEdges` merge rule verbatim.

**Why a Layer dropdown and not clicking the polygon:** finding F2 — same colour + weight + line type collapse into one `<path>` (`if (buckets.size === 1)`), and every site plan segment is concatenated into one `Float32Array`. The painted SVG carries no per-layer identity at all, so hit-testing a layer on the sheet is not merely unimplemented, it is not expressible. A dropdown is one self-contained control; a cross-panel "selected layer" state would be a new concept with its own event.

## 5. Visibility (point 5)

Both panels follow `Na__LePanelScrap__Sync` / `__OnModelChanged`: a module-level listener on `Na__LeModel__CHANGED_EVENT` with a reason allow-list — `['loaded','active','selection','sheet-created','sheet-deleted','sheet-updated','viewport','viewports']`, the complete `Na__LeModel__Dispatch` / `Na__LeModel__Touch` vocabulary that can change which sheet or which viewport is up — calling `Na__LePanels__SetSectionVisible(id, show)` and then `Na__LePanels__Refresh(id)`.

`show` = the active sheet holds at least one site plan viewport: `!!sheet && sheet.Sheet__Viewports.some(Na__LeModel__IsSitePlanViewport)`. Not `Na__LeModel__IsSitePlanSheet`, because SC11 lets Adam put a site plan viewport on any sheet. Both panels also listen to `Na__SpStore__CHANGED_EVENT` (as `Panel__ModelLayers__` does), because the layers arrive after the panels are built.

**This must run from the window listener, never from `refresh`** — `Na__LePanels__Refresh` returns early for a folded section *and* for an off-tab one, and Patterns is off-tab whenever the Properties tab is up. And `hidden` (SetSectionVisible) and `is-off-tab` (the tab system) are two separate mechanisms that must never be crossed.

## 6. CSS (point 6)

Site Plan Render Composites needs **no new CSS at all**: `.na-le-row--toggle`, `.na-le-row__adv`, `.na-le-adv`, `.na-le-adv-weight`, `.na-le-adv-unit`, `.na-le-adv-reset`, `.na-le-row__check-slot` and `.is-overridden` already exist in `40__Ui__Panels/Na__LayoutEditor__Styles__Panels__.css`, which is `@import`ed globally from `Na__CoreUi__Styles__Index__.css`.

Patterns adds one `REGION | Patterns` block to that same sheet — `.na-le-pattern`, `.na-le-pattern__item` (extending the `.na-le-scrap__item` look with a square tile), `.na-le-pattern__thumb`, `.na-le-pattern__name`, `.na-le-pattern__item.is-active` — because the panel file lives in `40__Ui__Panels`, whose stylesheet is already imported. A new global `@import` (which would have to stay above the WebViewer sheet) and an injected feature stylesheet are both avoided.

## 7. `Ready()` and the Promise.all (point 7)

In `Na__LayoutEditor__ModeController__.js`, add beside the other config imports:

```
import { Na__LeSpComp__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
```

and change the one line in `Na__LeMode__Initialize` to:

```
Na__LeMode__ReadyOnce = Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeSpComp__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load() ]).then(() => {
```

It must be there for the same reason `Na__LeComposite__Ready()` is: `Na__LeRec__NormaliseSitePlanComposites` asks `Na__LeSpComp__Row(key)` whether to keep a stored key, and it runs on the first sheet normalise. Un-awaited, the built-in fallback answers and a saved key the config declares but the fallback does not would be silently erased.

`Na__LeHatch__Ready()` deliberately does **not** join it. Design `Na__LeRec__NormaliseSitePlanHatches` to keep an unknown `Hatch__PatternId` **verbatim**, exactly as `Viewport__ModelSourceId` keeps a phase id the project does not have — the library may be a pack Adam has not pushed yet. Nothing in the normalise path then needs the library, and the Patterns panel calls `Na__LeHatch__Ready().then(...)` from its own `Build()`.

## 8. The one seam that makes the controls do something

`Na__LeVp2d__SitePlanPaintKey` must become

```
Na__LeVp2d__SitePlanToken(viewport) + '|' + viewport.Viewport__ScaleDenominator + '|' + masterPt + '|' + Na__LeVp2d__StyleToken(viewport) + '|' + Na__LeSpComp__Token(viewport) + '|' + Na__LeHatch__Token(viewport)
```

or nothing repaints when a toggle is flipped, and `SheetSurface`'s parked-frame cache will serve the old picture after a tab change.

And the toggles must be honoured **inside `Na__LeVp2d__SitePlanBuild(viewport, allowMissing)`**, where `fills` is assembled — not inside `Na__LeVp2d__PaintSitePlan`. `Na__LePdf__DrawViewport` takes its fills from `Na__LeVp2d__SitePlanDrawing` → `SitePlanBuild`, so the build gets screen and paper together; a suppression written in the painter fixes the screen and silently does not fix the PDF, which is the deliverable.

#### Files

| Action | Path | What |
|---|---|---|
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__SitePlanComposites__.js` | New module, namespace Na__LeSpComp, mirroring Na__LayoutEditor__RenderComposites__.js one-for-one. Constants: Na__LeSpComp__ConfigUrl (new URL('./Na__LayoutEditor__SitePlanComposites__Config__.json', import.meta.url)), Na__LeSpComp__FIELD = 'Viewport__SitePlanComposites', Na__LeSpComp__BLOCK = 'SpComposites__Layers', Na__LeSpComp__FALLBACK (the three rows hard-coded). Functions: Na__LeSpComp__Ready(), Na__LeSpComp__Rows(), Na__LeSpComp__Row(key) (lazy Map index), Na__LeSpComp__ToggleRows(), Na__LeSpComp__WeightRows(), Na__LeSpComp__Clamp(key, value), Na__LeSpComp__IsOn(viewport, key) (stored Layer__On, else Composite__DefaultOn), Na__LeSpComp__Weight(viewport, key), Na__LeSpComp__Factor(viewport, key) (0 when the row is off, so one call answers both questions), Na__LeSpComp__IsOverridden(viewport, key), Na__LeSpComp__Token(viewport) (empty string when nothing is stored, so an untouched viewport keys as it did), Na__LeSpComp__LocationPlanAbove(), Na__LeSpComp__IsLocationPlan(viewport) (viewport.Viewport__ScaleDenominator > Rules__LocationPlanAboveScale). All exported under a MODULE EXPORTS banner. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__SitePlanComposites__Config__.json` | Four top-level blocks, formatted exactly like Na__LayoutEditor__RenderComposites__Config__.json (4-space indent, values column-aligned, prose Meta__ essays). LayoutEditor__SitePlanComposites__Meta with Meta__FileName/Description/Version(1.0.0)/Created(20-Sep-2026)/Author plus Meta__WhyASeparateFile, Meta__WhichLayers, Meta__WhereTheWeightGoes, Meta__WhereLocationPlansDiffer, Meta__KeyStability. LayoutEditor__SitePlanComposites__Layers: three rows sitePlanFill (order 10), sitePlanPattern (order 20), sitePlanLinework (order 30), each with Composite__Key/Label/Toggle/DefaultOn/Order/Note/Weight; the first two Weight__Kind 'factor' Min 0.00 Max 1.00 Default 1.00 Step 0.05 Label 'Opacity', the third Weight__Kind 'none'. LayoutEditor__SitePlanComposites__Rules with Rules__Description, Rules__LocationPlanAboveScale 500, Rules__LocationPlanNote. LayoutEditor__SitePlanComposites__Fallback with Fallback__Description, Fallback__WeightKind, Fallback__WeightFactor. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__SitePlanComposites__.js` | New panel, namespace Na__LePanelSpComp, section id 'siteplan-composites', structurally a copy of Na__LayoutEditor__Panel__Styles__.js. Na__LePanelSpComp__ID, __BuiltKey, __IdSeed, __Listening; helpers __Unit(kind), __WeightCluster(row), __Fill(list), __Build(body) (AdvancedToggle + [data-na-block="note"] + [data-na-block="list"] + [data-na-block="location"] note line, then Na__LeSpComp__Ready().then(() => { BuiltKey = null; Refresh(); })), __Refresh(body) (reflects the selected viewport, sets the location-plan note from Na__LeSpComp__IsLocationPlan, guards writes with document.activeElement !== el), __Apply(key, patch), __Sync() and __OnModelChanged(event) for visibility. Register() declares controls 'sp-composite-toggle' (change), 'sp-composite-weight' (change), 'sp-composite-weight-reset' (click, with e.preventDefault() because it sits inside a <label>), adds the window listeners once, and returns Na__LePanels__RegisterSection('left', { id, title : Na__LeCfg__GetLabel('SitePlanCompositesTitle', 'Site Plan Render Composites'), build, refresh, defaultOpen : false }). Exports Na__LePanelSpComp__Register. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Transport__.js` | New module, namespace Na__LeHatchIo, a read-only copy of Na__LayoutEditor__ScrapbookCustom__Transport__.js. Na__LeHatchIo__AppRootUrl = new URL('../../../', import.meta.url); Na__LeHatchIo__ServerService = 'na-projectvision-local-dev'; SOURCE_API/SOURCE_FILE/SOURCE_NONE; WHY_NO_SERVER/WHY_RESTART; INDEX_PACKS = 'HatchPatternIndex__Packs'; INDEX_PATTERNS = 'HatchPatternIndex__Patterns'; Na__LeHatchIo__Place defaults { contentFolder : '52__LayoutEditor__HatchPatternLibrary', indexFile : 'HatchPattern__Index__.json', apiPath : '/api/truevision/hatchpatterns' }. Functions Na__LeHatchIo__Configure(library), __FileUrl(relativePath) (per-segment encodeURIComponent), __ApiUrl(suffix), __IsProjectVisionServer(), __PacksOf(index), __PatternsOf(index), __ReadIndex() (API first only when Na__AppUtils__IsRunningOnLocalhost(), else the checked-in index; a 404 index is an empty library, not an error), __ReadPattern(relativeFile). Never throws; every call resolves to { ok, ..., error }. No write functions at all. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__.js` | New module, namespace Na__LeHatch, the library layer plus the per-viewport hatch record. Constants Na__LeHatch__ConfigUrl, __PREFIX = 'LayoutEditor__HatchPatterns__', __STATUS_LOADING/READY/FAILED, __CHANGED_EVENT = 'na-layouteditor-hatchpatterns-changed', __FIELD = 'Viewport__SitePlanHatches', __CAT_FIELD = 'Hatches__Layers', __PENDING. Functions: __Block(name), __Label(key, fallback, tokens), __Announce(what), __Ready() (fetch config no-store, Na__LeHatchIo__Configure(Block('Library')), read the index, announce), __Reload(), __GetStatus(), __Packs() (config order first, index-only packs appended, packs with no patterns dropped per SC16), __PackName(folder), __PatternsIn(folder), __GetPattern(id) (undefined while pending, null when unreadable), __LoadPack(folder) (lazy, PENDING-marked, Promise.all, announces), __Bounds() (from LayoutEditor__HatchPatterns__Bounds with hard-coded fallbacks), __Normalise(entry) (clamps Hatch__Scale and Hatch__RotationDeg, KEEPS an unknown Hatch__PatternId verbatim), __Stored(viewport), __Effective(viewport, categoryKey) (the viewport's entry, else the layer's Layer__Style.HatchId/HatchScale/HatchRotationDeg from Na__SpStore__GetLayers(), else null), __Token(viewport) (sorted key:id:scale:rotation, empty when nothing stored), __PreviewMarkup is NOT defined here - it is imported from the generator module the sibling design writes. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\Na__LayoutEditor__HatchPatterns__Config__.json` | Four blocks in the ScrapbookCustom config's shape. LayoutEditor__HatchPatterns__Meta (Meta__FileName/Description/Version/Created/Author plus Meta__Files, Meta__Reading, Meta__WhereScaleGoes, Meta__KeyStability). LayoutEditor__HatchPatterns__Library (Library__Description, Library__ContentFolder '52__LayoutEditor__HatchPatternLibrary', Library__IndexFile 'HatchPattern__Index__.json', Library__ApiPath '/api/truevision/hatchpatterns', Library__PacksNote, Library__Packs[] of { Pack__Folder, Pack__Name, Pack__Note } for the five folders on disk). LayoutEditor__HatchPatterns__Bounds (Bounds__Description, Bounds__DefaultScale 1, Bounds__MinScale 0.25, Bounds__MaxScale 4, Bounds__StepScale 0.05, Bounds__DefaultRotationDeg 0, Bounds__MinRotationDeg 0, Bounds__MaxRotationDeg 360, Bounds__StepRotationDeg 1). LayoutEditor__HatchPatterns__Labels (Labels__Description plus Title, Layer, Pack, Hint, Empty, EmptyLayer, Loading, Failed, NoViewport, NoFillLayer, None, NoneTitle, ItemTitle, Scale, ScaleTitle, Rotation, RotationTitle, Reset, ResetTitle, LocationPlan, ReadOnlyView, Restart). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Patterns__.js` | New panel, namespace Na__LePanelPatterns, section id 'patterns', on the Scrapbook tab. Constants __ID, __STORE_KEY_LAYER = 'na-layouteditor-patterns:layer', __STORE_KEY_PACK = 'na-layouteditor-patterns:pack', __SHOW_REASONS (the eight reasons), __Signature, __Listening. Helpers __CurrentLayer(viewport)/__SetLayer(key), __CurrentPack()/__SetPack(folder) (localStorage in try/catch), __LayerOptions(viewport) (Na__SpStore__GetLayers() intersected with Na__LeSource__CategoryKeys(viewport), labelled 'Group - Label'), __Tile(pattern, assigned, editable) (a <button class="na-le-pattern__item" data-na-control="pattern-tile" data-na-role="<Pattern__Id>"> whose thumb is Na__LeHatchGen__PreviewMarkup(pattern, scale, rotationDeg); is-active when it is the assigned one), __NoneTile(), __Build(body) (Layer row, Pack row, note, .na-le-pattern grid, Scale SliderRow, Rotation SliderRow, a Reset button row, a status note), __Refresh(body) (rebuilds the grid only when its signature changes; ShowSlider for the two sliders; sets the note from the store status, the transport's WHY_RESTART reason, whether the viewport is a location plan, and whether the chosen layer can take a fill), __Apply(patch) (Na__LeModel__UpdateViewport with sitePlanHatches), __Sync()/__OnModelChanged(event)/__OnLibraryChanged(). Register() declares 'pattern-layer' (change), 'pattern-pack' (change), 'pattern-tile' (click), 'pattern-scale' (input), 'pattern-rotation' (input), 'pattern-reset' (click), adds the Na__LeModel__CHANGED_EVENT / Na__LeHatch__CHANGED_EVENT / Na__SpStore__CHANGED_EVENT listeners once, and returns Na__LePanels__RegisterSection('right', { id : 'patterns', title : Na__LeHatch__Label('Title', 'Patterns'), tab : Na__LeScrap__TAB_ID, build, refresh, defaultOpen : false }), then Na__LeHatch__Ready().then(() => { retitle from the config; Na__LePanels__Refresh('patterns'); }). Exports Na__LePanelPatterns__Register. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\HatchPattern__Index__.json` | The checked-in index, the only thing that makes the library readable off localhost. HatchPatternIndex__Meta (Meta__FileName, Meta__Description, Meta__Version, Meta__Created, Meta__Author, Meta__WhoWritesThis - the ProjectVision GET route rebuilds it from the folders on localhost, and it is committed so the live site can read it). HatchPatternIndex__Packs[] of { Pack__Folder, Pack__Name }. HatchPatternIndex__Patterns[] of { Pattern__Id, Pattern__Pack, Pattern__File, Pattern__Name, Pattern__UpdatedIso, Pattern__Note } - seeded with the two SC15 patterns in 05__SitePlanHatches (Mixed Woodland, Ponds & Lakes), whose pattern files themselves are the generator design's deliverable. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__TrueVisionHatchPatterns__Api__.py` | New Flask blueprint, READ ONLY, copied from ProjectVision__TrueVisionScrapbook__Api__.py with every write route removed. truevision_hatchpatterns_api = Blueprint('truevision_hatchpatterns_api', __name__); SCRIPT_DIR; TRUEVISION_APP_DIR; HATCH_DIR = os.path.join(TRUEVISION_APP_DIR, '52__LayoutEditor__HatchPatternLibrary'); INDEX_FILE_NAME = 'HatchPattern__Index__.json'; PACK_PATTERN and PATTERN_FILE_PATTERN regex whitelists. One route: @truevision_hatchpatterns_api.route('/api/truevision/hatchpatterns') def hatchpatterns_index() -> _rebuild_index() then jsonify({'status':'ok','index':index}). Helpers _rebuild_index(), _list_packs(), _index_entry(pack, file_name, pattern), _is_inside(). It writes HatchPattern__Index__.json back to disk so the committed index stays true to the folders; it never creates a folder and never unlinks a file. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__LocalServer__Main__.py` | Two lines. Beside the existing 'from ProjectVision__TrueVisionScrapbook__Api__ import truevision_scrapbook_api', add 'from ProjectVision__TrueVisionHatchPatterns__Api__ import truevision_hatchpatterns_api'. Beside 'app.register_blueprint(truevision_scrapbook_api)', add 'app.register_blueprint(truevision_hatchpatterns_api)'. The server never reloads its routes - the new route answers 404 until Adam restarts 8090, and the panel must say 'restart it' rather than 'no server'. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Four edits, all inside the existing import block and the shell builder. (1) Add 'import { Na__LeSpComp__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';' beside the Na__LeComposite__Ready import. (2) Add 'import { Na__LePanelSpComp__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__SitePlanComposites__.js';' beside the Na__LePanelStyles__Register import, and 'import { Na__LePanelPatterns__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Patterns__.js';' beside the Na__LePanelScrapCustom__Register import. (3) In the shell builder, insert 'Na__LePanelSpComp__Register();' between Na__LePanelStyles__Register() and Na__LePanelModelLayers__Register(), with the comment '// <-- The site plan twin of Render Composites: the fill, pattern and linework layers of a site plan picture'; and insert 'Na__LePanelPatterns__Register();' immediately after Na__LePanelScrapCustom__Register(), with the comment '// <-- Patterns: the hatch library, LAST in the right column (Adam, 20-Sep-2026)'. Extend the 'THE SCRAPBOOK TAB \| Three libraries' comment to say four. (4) In Na__LeMode__Initialize, change the Promise.all to Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeSpComp__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load() ]). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | Add two imports (Na__LeSpComp__FIELD/Row/Clamp from the new composites module; Na__LeHatch__FIELD/CAT_FIELD/Normalise from the hatch module). Add function Na__LeRec__NormaliseSitePlanComposites(block): returns null unless the block is an object; walks block[Na__LeSpComp__BLOCK], keeps an entry only when Na__LeSpComp__Row(key) exists, rebuilds it as exactly { Layer__On, Layer__Weight } (Layer__On kept only when it disagrees with Composite__DefaultOn; Layer__Weight only when finite after Na__LeSpComp__Clamp and different from the row default); returns null when nothing is left, and otherwise { SpComposites__Description, SpComposites__Layers }. Add function Na__LeRec__NormaliseSitePlanHatches(block): same shape over Hatches__Layers, each entry rebuilt as exactly { Hatch__PatternId, Hatch__Scale, Hatch__RotationDeg } via Na__LeHatch__Normalise, an entry with no Hatch__PatternId dropped, an UNKNOWN Hatch__PatternId KEPT; preserves Hatches__UpdatedIso; returns null when empty. In Na__LeRec__NormaliseViewport, inside the existing 'if (Na__LeRec__IsSitePlanViewport(viewport)) { ... }' branch, add the two assignments viewport[Na__LeSpComp__FIELD] = Na__LeRec__NormaliseSitePlanComposites(...) and viewport[Na__LeHatch__FIELD] = Na__LeRec__NormaliseSitePlanHatches(...); in the else branch, delete both keys alongside the existing 'delete viewport.Viewport__SitePlan'. Export the two new normalisers if the file's export block lists the existing ones. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js` | In Na__LeModel__UpdateViewport, add two patch branches beside the existing patch.compositeWeights branch, and add 'sitePlanComposites, sitePlanHatches' to the patch vocabulary comment above the function. patch.sitePlanComposites: merge one key at a time into a copy of viewport[Na__LeSpComp__FIELD] (its SpComposites__Layers map), a null value deleting that key, a { Layer__On } or { Layer__Weight } object merging into the existing entry, values clamped by Na__LeSpComp__Clamp. patch.sitePlanHatches: merge one categoryKey at a time into a copy of viewport[Na__LeHatch__FIELD]'s Hatches__Layers, a null value deleting that category, and stamp Hatches__UpdatedIso with new Date().toISOString() exactly as the projectedEdges branch does. Both rely on the normaliser called at the end of the function to clamp and to drop an empty block. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | THE SEAM. Import Na__LeSpComp__IsOn / Na__LeSpComp__Factor / Na__LeSpComp__Token and Na__LeHatch__Effective / Na__LeHatch__Token. (1) Na__LeVp2d__SitePlanPaintKey gains two terms: + '\|' + Na__LeSpComp__Token(viewport) + '\|' + Na__LeHatch__Token(viewport), or nothing repaints when a toggle moves and the parked-frame cache serves a stale picture. (2) In Na__LeVp2d__SitePlanBuild - NOT in PaintSitePlan, because Na__LePdf__DrawViewport takes its fills from SitePlanBuild and a change made in the painter fixes the screen and silently not the PDF - the fills array is built only when Na__LeSpComp__IsOn(viewport, 'sitePlanFill'), each entry's opacity multiplied by Na__LeSpComp__Factor(viewport, 'sitePlanFill'); a parallel hatches array is built only when Na__LeSpComp__IsOn(viewport, 'sitePlanPattern'), each entry carrying { categoryKey, rings, hatch : Na__LeHatch__Effective(viewport, categoryKey), opacity : Na__LeSpComp__Factor(viewport, 'sitePlanPattern') }; and the classes are emptied (or the band loop skipped) when Na__LeSpComp__IsOn(viewport, 'sitePlanLinework') is false. The exact painting of the hatches array is the generator/painter design's; this file only has to produce it and key on it. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | In Na__SpStore__Style, add three keys to the whitelist so a hatch declared in the tags SSOT survives finding F8's hop 5: HatchId : text(style.HatchId, null), HatchScale : num(style.HatchScale, null), HatchRotationDeg : num(style.HatchRotationDeg, null). All three default to null, so today's manifests are unchanged and Na__LeHatch__Effective simply finds no layer default. The exporter/SSOT side that populates them belongs to the tags design. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Styles__Panels__.css` | Add one '/* REGION \| Patterns */' block after the Scrapbook region: .na-le-pattern (grid, grid-template-columns repeat(3, 1fr), gap 6px), .na-le-pattern__item (the .na-le-scrap__item look, cursor pointer not grab, aspect-ratio 1), .na-le-pattern__thumb (block, aspect-ratio 1, pointer-events none, with a hairline border so an empty tile still reads), .na-le-pattern__thumb svg (width/height 100%, display block), .na-le-pattern__name (0.68rem, centred, pointer-events none), .na-le-pattern__item:hover:not(:disabled), :focus-visible and .is-active (the #1a7fc4 border and 2px ring already used for a selected tile). Properties one per line with the colons column-aligned, capitalised prose comments explaining each rule. NO new stylesheet and NO new @import - this file is already imported by Na__CoreUi__Styles__Index__.css. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json` | Add five label keys to LayoutEditor__Labels__Config, beside the existing StylesTitle and SitePlanBlockPlan rows: LayoutEditor__Labels__SitePlanCompositesTitle 'Site Plan Render Composites'; LayoutEditor__Labels__SitePlanCompositesNote 'Select a site plan viewport on the sheet.'; LayoutEditor__Labels__SitePlanCompositeLocationNote 'Location Plan at 1:{scale} - only the proposed fills are drawn, whatever these say.'; LayoutEditor__Labels__SitePlanCompositeOpacityHint 'How opaque this layer draws, as a multiple of the colour the export carries.'; LayoutEditor__Labels__StylesitePlanFill / StylesitePlanPattern / StylesitePlanLinework are NOT added - the panel reads its row wording from its own config's Composite__Label, exactly as Panel__Styles falls back to row.label. |

#### New keys

- `LayoutEditor__SitePlanComposites__Meta`
- `LayoutEditor__SitePlanComposites__Meta.Meta__FileName`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Description`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Version`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Created`
- `LayoutEditor__SitePlanComposites__Meta.Meta__Author`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhyASeparateFile`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhichLayers`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhereTheWeightGoes`
- `LayoutEditor__SitePlanComposites__Meta.Meta__WhereLocationPlansDiffer`
- `LayoutEditor__SitePlanComposites__Meta.Meta__KeyStability`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Key`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Label`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Toggle`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__DefaultOn`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Order`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Note`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Kind`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Default`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Min`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Max`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Step`
- `LayoutEditor__SitePlanComposites__Layers[].Composite__Weight.Weight__Label`
- `LayoutEditor__SitePlanComposites__Rules.Rules__Description`
- `LayoutEditor__SitePlanComposites__Rules.Rules__LocationPlanAboveScale`
- `LayoutEditor__SitePlanComposites__Rules.Rules__LocationPlanNote`
- `LayoutEditor__SitePlanComposites__Fallback.Fallback__Description`
- `LayoutEditor__SitePlanComposites__Fallback.Fallback__WeightKind`
- `LayoutEditor__SitePlanComposites__Fallback.Fallback__WeightFactor`
- `LayoutEditor__HatchPatterns__Meta.Meta__FileName`
- `LayoutEditor__HatchPatterns__Meta.Meta__Description`
- `LayoutEditor__HatchPatterns__Meta.Meta__Version`
- `LayoutEditor__HatchPatterns__Meta.Meta__Created`
- `LayoutEditor__HatchPatterns__Meta.Meta__Author`
- `LayoutEditor__HatchPatterns__Meta.Meta__Files`
- `LayoutEditor__HatchPatterns__Meta.Meta__Reading`
- `LayoutEditor__HatchPatterns__Meta.Meta__WhereScaleGoes`
- `LayoutEditor__HatchPatterns__Meta.Meta__KeyStability`
- `LayoutEditor__HatchPatterns__Library.Library__Description`
- `LayoutEditor__HatchPatterns__Library.Library__ContentFolder`
- `LayoutEditor__HatchPatterns__Library.Library__IndexFile`
- `LayoutEditor__HatchPatterns__Library.Library__ApiPath`
- `LayoutEditor__HatchPatterns__Library.Library__PacksNote`
- `LayoutEditor__HatchPatterns__Library.Library__Packs[].Pack__Folder`
- `LayoutEditor__HatchPatterns__Library.Library__Packs[].Pack__Name`
- `LayoutEditor__HatchPatterns__Library.Library__Packs[].Pack__Note`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__Description`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__DefaultScale`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__MinScale`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__MaxScale`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__StepScale`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__DefaultRotationDeg`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__MinRotationDeg`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__MaxRotationDeg`
- `LayoutEditor__HatchPatterns__Bounds.Bounds__StepRotationDeg`
- `LayoutEditor__HatchPatterns__Labels.Labels__Description`
- `LayoutEditor__HatchPatterns__Labels.Labels__Title`
- `LayoutEditor__HatchPatterns__Labels.Labels__Layer`
- `LayoutEditor__HatchPatterns__Labels.Labels__Pack`
- `LayoutEditor__HatchPatterns__Labels.Labels__Hint`
- `LayoutEditor__HatchPatterns__Labels.Labels__Empty`
- `LayoutEditor__HatchPatterns__Labels.Labels__EmptyLayer`
- `LayoutEditor__HatchPatterns__Labels.Labels__Loading`
- `LayoutEditor__HatchPatterns__Labels.Labels__Failed`
- `LayoutEditor__HatchPatterns__Labels.Labels__NoViewport`
- `LayoutEditor__HatchPatterns__Labels.Labels__NoFillLayer`
- `LayoutEditor__HatchPatterns__Labels.Labels__None`
- `LayoutEditor__HatchPatterns__Labels.Labels__NoneTitle`
- `LayoutEditor__HatchPatterns__Labels.Labels__ItemTitle`
- `LayoutEditor__HatchPatterns__Labels.Labels__Scale`
- `LayoutEditor__HatchPatterns__Labels.Labels__ScaleTitle`
- `LayoutEditor__HatchPatterns__Labels.Labels__Rotation`
- `LayoutEditor__HatchPatterns__Labels.Labels__RotationTitle`
- `LayoutEditor__HatchPatterns__Labels.Labels__Reset`
- `LayoutEditor__HatchPatterns__Labels.Labels__ResetTitle`
- `LayoutEditor__HatchPatterns__Labels.Labels__LocationPlan`
- `LayoutEditor__HatchPatterns__Labels.Labels__ReadOnlyView`
- `LayoutEditor__HatchPatterns__Labels.Labels__Restart`
- `HatchPatternIndex__Meta.Meta__FileName`
- `HatchPatternIndex__Meta.Meta__Description`
- `HatchPatternIndex__Meta.Meta__Version`
- `HatchPatternIndex__Meta.Meta__Created`
- `HatchPatternIndex__Meta.Meta__Author`
- `HatchPatternIndex__Meta.Meta__WhoWritesThis`
- `HatchPatternIndex__Packs[].Pack__Folder`
- `HatchPatternIndex__Packs[].Pack__Name`
- `HatchPatternIndex__Patterns[].Pattern__Id`
- `HatchPatternIndex__Patterns[].Pattern__Pack`
- `HatchPatternIndex__Patterns[].Pattern__File`
- `HatchPatternIndex__Patterns[].Pattern__Name`
- `HatchPatternIndex__Patterns[].Pattern__UpdatedIso`
- `HatchPatternIndex__Patterns[].Pattern__Note`
- `Viewport__SitePlanComposites`
- `Viewport__SitePlanComposites.SpComposites__Description`
- `Viewport__SitePlanComposites.SpComposites__Layers`
- `Viewport__SitePlanComposites.SpComposites__Layers.<compositeKey>.Layer__On`
- `Viewport__SitePlanComposites.SpComposites__Layers.<compositeKey>.Layer__Weight`
- `Viewport__SitePlanHatches`
- `Viewport__SitePlanHatches.Hatches__Description`
- `Viewport__SitePlanHatches.Hatches__UpdatedIso`
- `Viewport__SitePlanHatches.Hatches__Layers`
- `Viewport__SitePlanHatches.Hatches__Layers.<Layer__CategoryKey>.Hatch__PatternId`
- `Viewport__SitePlanHatches.Hatches__Layers.<Layer__CategoryKey>.Hatch__Scale`
- `Viewport__SitePlanHatches.Hatches__Layers.<Layer__CategoryKey>.Hatch__RotationDeg`
- `Layer__Style.HatchId`
- `Layer__Style.HatchScale`
- `Layer__Style.HatchRotationDeg`
- `LayoutEditor__Labels__Config.LayoutEditor__Labels__SitePlanCompositesTitle`
- `LayoutEditor__Labels__Config.LayoutEditor__Labels__SitePlanCompositesNote`
- `LayoutEditor__Labels__Config.LayoutEditor__Labels__SitePlanCompositeLocationNote`
- `LayoutEditor__Labels__Config.LayoutEditor__Labels__SitePlanCompositeOpacityHint`

#### Order of work

1. STEP 1 - The composites data layer, on its own. Create Na__LayoutEditor__SitePlanComposites__Config__.json and Na__LayoutEditor__SitePlanComposites__.js. Add Na__LeSpComp__Ready() to the ModeController's Promise.all and its import. TEST: `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` still passes (386 files), and in the console on the test URL `Na__LeSpComp__Rows()` returns three rows with the config's wording, not the fallback's.
2. STEP 2 - Persistence, before any UI. Add Na__LeRec__NormaliseSitePlanComposites to Na__LayoutEditor__SheetRecords__.js and its call inside the IsSitePlanViewport branch of Na__LeRec__NormaliseViewport; add the patch.sitePlanComposites branch to Na__LeModel__UpdateViewport and extend the patch-vocabulary comment. TEST: from the console, UpdateViewport a site plan viewport with { sitePlanComposites : { sitePlanFill : { Layer__On : false } } }, save, reload the sheet, and confirm the key survives; then set it back and confirm the whole block normalises away to null. Nothing visible yet - this is the step that proves the record, and doing it after the panel hides a silent strip as 'the control does not work'.
3. STEP 3 - The left panel. Create Na__LayoutEditor__Panel__SitePlanComposites__.js, add the two AppConfig labels, and add Na__LePanelSpComp__Register() to the ModeController between Styles and ModelLayers. TEST at http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 : the panel appears in the left column only on a sheet holding a site plan viewport, disappears on an architectural sheet, the three toggles and the two Advanced opacity fields reflect and write, the reset clears the override, and the location-plan note appears on a 1:1250 viewport. Nothing paints differently yet.
4. STEP 4 - Wire the seam. Edit Na__LayoutEditor__Viewport2d__SitePlan__.js: fold Na__LeSpComp__Token into Na__LeVp2d__SitePlanPaintKey, and honour sitePlanFill / sitePlanLinework inside Na__LeVp2d__SitePlanBuild. TEST: switch Site Plan Linework off on a PS01 site plan viewport - the frame empties and comes back; export a PDF and confirm the paper agrees with the screen. NOTE finding F5: PS01 paints ZERO fills today, so the sitePlanFill toggle cannot be seen working until the fill phase lands. Prove it by asserting the length of the fills array in the console, not by looking.
5. STEP 5 - The hatch library transport and data layer. Create the 36__System__HatchPatternTools config, transport and library modules, and HatchPattern__Index__.json with the two SC15 entries (the pattern documents themselves come from the generator design; until they exist, point the index at them and expect Na__LeHatch__GetPattern to return null, which the panel must tolerate). TEST: Na__LeHatch__Ready() resolves to 'ready' on a plain static server with no local server running, Na__LeHatch__Packs() lists only packs that have patterns, and the two __Placeholder folders are absent.
6. STEP 6 - The hatch record. Add Na__LeRec__NormaliseSitePlanHatches and the patch.sitePlanHatches branch, and the three new keys in Na__SpStore__Style. TEST as in step 2: a hatch assignment survives save, reload and undo; an unknown Hatch__PatternId is KEPT verbatim; a hatch written onto an architectural viewport is deleted by the normaliser.
7. STEP 7 - The Patterns panel. Create Na__LayoutEditor__Panel__Patterns__.js, add the CSS region, and register it after Na__LePanelScrapCustom__Register(). TEST: it is the last section in the right column on the Scrapbook tab; the Layer select lists PS01's five layers; the Pack select lists the populated packs; a tile click writes the record; the two sliders write scale and rotation and their readings follow; Reset clears; the whole section hides on an architectural sheet; and switching to the Properties tab and back does not lose the chosen layer.
8. STEP 8 - The Flask GET route and the release chores. Create ProjectVision__TrueVisionHatchPatterns__Api__.py, register it in ProjectVision__LocalServer__Main__.py, and ASK ADAM TO RESTART his 8090 server (it never reloads routes; read the running routes with OPTIONS and the Allow header, never a test POST). Then: re-run Na__Verify__Exports__.mjs, bump PWA_SW_VERSION_TOKEN in TrueVision__Pwa__ServiceWorker__Logic__.js with a matching DEVELOPMENT LOG line (this release adds new module exports that a warm cache lacks), add the version entries to each new file's DEVELOPMENT LOG, and update section 12 of TrueVision__PLAN__SitePlanComposites__.md. Do NOT offer the ValeVision port: finding 7 says a whole-file copy of any site plan module fails VV's verifier immediately, and the standing rule is to offer a port only after Adam confirms the TrueVision work.

#### Risks

- THE CONTROLS CAN LOOK PERFECT AND DO NOTHING. Na__LeModel__UpdateViewport ignores an unknown patch key silently - no error, the checkbox just springs back. Steps 2 and 6 exist to prove the record before the panel, in that order, for exactly this reason.
- A REPAINT THAT NEVER HAPPENS. If Na__LeVp2d__SitePlanPaintKey does not gain Na__LeSpComp__Token and Na__LeHatch__Token, flipping a toggle changes the record and nothing on screen; worse, SheetSurface's parked-frame cache will keep serving the old picture across a tab change, so it will read as intermittent rather than as broken.
- THE SUPPRESSION IN THE WRONG FUNCTION. Put the fill/pattern toggles in Na__LeVp2d__PaintSitePlan and the screen obeys while Na__LePdf__DrawViewport - which takes its fills from Na__LeVp2d__SitePlanBuild - does not. The PDF is the deliverable, and the divergence would only show up on an issued drawing.
- FINDING F5: NOTHING TO SEE. PS01 paints zero site plan fills today (ExistingBuildings has a fill GLB but FillHex null; both Proposed layers have a colour and no rings). The sitePlanFill toggle and every hatch tile therefore cannot be judged by eye until the fill phase lands. Assert the length of the fills array in the console, or this build will be signed off against a blank frame.
- A SECTION THAT NEVER REFRESHES. Na__LePanels__Refresh returns early for a FOLDED section and for an OFF-TAB one, and Patterns is off-tab whenever the Properties tab is up. Anything that decides whether a section is visible at all must run from the window listener. Crossing the two hiding mechanisms - `hidden` from SetSectionVisible, `is-off-tab` from the tab system - breaks one of them silently.
- A MISSING spec.tab PUTS PATTERNS ON THE WRONG TAB. Na__LePanels__TabOf falls back to tabs[0].id, which is 'properties'. It would still be last in the column, so the mistake reads as a deliberate choice rather than a bug.
- THE INDEX GOES STALE OFF LOCALHOST. The live site and a plain static server cannot list 52__LayoutEditor__HatchPatternLibrary. A pattern added by hand and not written into HatchPattern__Index__.json is invisible everywhere but Adam's 8090. The GET blueprint rewrites the index on his machine; it must then be committed.
- THE 8090 SERVER NEVER RELOADS ITS ROUTES. /api/truevision/hatchpatterns answers 404 until Adam restarts it, and the panel must say 'restart it' rather than 'no server' - the transport's IsProjectVisionServer() check against /api/health is what tells them apart.
- PWA CACHE. This release adds new module exports that a new import names. A warm service-worker cache breaks the editor until the second visit unless PWA_SW_VERSION_TOKEN is bumped (currently '2026-09-20-3' - check it against HEAD first). Keep patterns as .json: a .svg tile falls into the stale-while-revalidate shell bucket and serves the previous version after an edit.
- PATTERN IDS IN THE SHEET SVG. The chrome, markup, focus and per-frame linework SVGs are four separate strings in ONE document. If the panel's swatch ever emits a <defs><pattern id=...>, that id collides with the painter's. Na__LeHatch__PreviewMarkup must emit plain geometry with no paint server and no id at all.
- PERSISTED IDENTIFIERS. Composite__Key, Pattern__Id and Layer__CategoryKey all end up inside saved viewport records. Renaming any of them orphans saved sheets silently. Say so in Meta__KeyStability in both new configs, as the Render Composites config already does.
- Na__LeSpComp__Ready() LEFT OUT OF Promise.all. The first sheet is then normalised against the built-in fallback, and a stored key the config declares but the fallback does not is erased before the panel is ever built.

#### Rejected alternatives

- A fourth TAB on the right column, rather than a fourth section. Rejected by SC09 and by the code: Na__LePanels__RegisterTab splits the strip evenly and hides it below two tabs, so a third tab shrinks and re-weights the two Adam already reads - the 'uniform tab styling' rule. A section costs one RegisterSection call; a tab costs a RegisterTab call plus a decision about which sections move.
- Patterns on the PROPERTIES tab. It would still be last in the right column's DOM (TabOf falls back to tabs[0]), and a pattern picker is arguably a property of a selection. Rejected because Adam described a library of packs, the Scrapbook tab already means 'libraries', and the Properties sections are one-per-selected-kind - a library you apply FROM is not a property of what is selected.
- Adding sitePlanFill / sitePlanPattern rows to the EXISTING LayoutEditor__RenderComposites__Layers. Tempting: Viewport__CompositeWeights already joins Na__LeComposite__Token and therefore Na__LeVp2d__SitePlanPaintKey for free, and Na__LeRec__NormaliseCompositeWeights already keeps them. Rejected because the rows would then appear in the Render Composites panel of every architectural viewport (needing a new filtering flag), and because Adam asked for a SEPARATE dropdown - two inventories in one file would make the panel that is built from it lie about what it is.
- Storing the three toggles as booleans in Viewport__Styles, matching how the existing composites store theirs. Rejected on three counts: (1) Viewport__Styles is a DENSE record that Na__LeRec__NormaliseViewport rebuilds in full on every viewport of every sheet, so two site-plan-only keys would be written into every architectural viewport in every project file for ever; (2) a new key needs four separate edits (Na__LeRec__STYLE_KEYS, the Viewport__Styles literal, Na__LeCfg__DefaultStyles, LayoutEditor__Viewport__DefaultStyles) and missing any one gives a control that forgets everything; (3) it would STILL not repaint, because Na__LeVp2d__StyleToken is Na__LeEdge__Token + Na__LeComposite__Token and neither reads Viewport__Styles.
- Expressing 'off' as weight 0 in a weights-only record, to avoid a new record key entirely. Rejected: unchecking would destroy the opacity the user had chosen, and re-checking would have to guess. The toggle and the weight are two facts and the record should hold two.
- Giving sitePlanLinework its own weight. Rejected: Na__LeVp2d__StyleBands already multiplies site plan band widths by Na__LeComposite__Factor(viewport, 'projectedLinework'). A second number over the same width is two controls fighting, which is the fault the Render Composites config's own Meta__WeightKinds note warns about. Weight__Kind 'none', like glassOpaque and whitecard.
- Dropping the sitePlanLinework row altogether, since REQ-32 names only the fill and pattern layers. Rejected because the Render Composites config states its purpose as 'a complete inventory of the picture rather than a selective one', and Adam's own brief describes the drawing as three layers. The row costs a line of config.
- Applying a pattern to the layer the user clicks on the sheet. Rejected as not expressible: finding F2 - two layers that resolve to the same colour, weight and line type collapse into ONE <path> (`if (buckets.size === 1)`), and every site plan segment is concatenated into one Float32Array before painting. The SVG carries no per-layer identity, so there is nothing to hit-test.
- Selecting the target layer by clicking a row in the Model Layers panel. Rejected: it invents a cross-panel selection state with its own event and its own persistence, for a target a single dropdown expresses. Panel__ModelLayers' rows are toggles and per-layer edge clusters, not a selection.
- A new 58__Feature__HatchPatterns folder with a stylesheet injected at Register(), copying the ScrapbookCustom layout wholesale. Rejected because Adam already created 36__System__HatchPatternTools on 20-Sep-2026 between 35__System__DrawingTools and 40__Ui__Panels - a SYSTEM slot, the home of the GradientTool and LineStyleTool's siblings - and because a panel that lives in 40__Ui__Panels is styled by Na__LayoutEditor__Styles__Panels__.css, which is already @imported globally. An injected sheet adds a load race and a second place to look for a rule.
- A hand-maintained index with no Flask route at all. Simpler, and plain GETs already work in all three environments. Rejected because Adam said he will build pattern folders himself, and an index that goes stale the moment a file is dropped in reads as 'the panel is broken'. A GET-only blueprint that rebuilds the index from the folders is ~120 lines of the scrapbook API with every write route deleted, and it costs one server restart.
- Shipping write routes (Save / Delete / quarantine) with the library. Rejected as scope: SC15 ships exactly two patterns, drawn against the OS reference sheet. The transport is copied in the shape that already distinguishes 'restart it' from 'no server', so adding POST later is additive.
- Shipping pattern tiles as .svg files instead of .json. Rejected: the service worker classifies .svg into PWA_SW_PATTERN_SHELL_ASSET (stale-while-revalidate), so an edited tile serves the previous version until a second reload; .json is network-first, which is the behaviour a library being authored needs. It also breaks REQ-17, which asks for JSON in the three-stage naming.
- Reusing Na__LeScrapDrag__Tile for the pattern swatches. Rejected: it builds a drag source that places RECORDS on the paper via buildSet()/place(). A pattern is applied to a layer, not dropped on a sheet; borrowing the tile would also borrow the ghost, the pointer capture and the drop handling for a gesture that has no meaning here. The tile is a plain button that reuses the .na-le-scrap__item look only.
- Making the Patterns panel visible on every sheet, the way the Custom Scrapbook is. Rejected: the Custom Scrapbook is useful on any sheet; a site plan hatch is not. Adam's clutter rule and the Standard Scrapbook's own Sync precedent both say hide it.

#### Flagged for Adam

- THE LOCATION PLAN THRESHOLD, AT EXACTLY 1:500. The brief says viewports at 1:500 or coarser are Location Plans, but the shipped app names a 1:500 viewport a Block Plan (Na__LePanelViewport__AddSitePlan: `name : scale >= 1000 ? 'Location Plan' : 'Block Plan'`), and the only two site plan scales today are [500, 1250]. Taken literally the rule suppresses the fills on EVERY site plan drawing in the app. Rules__LocationPlanAboveScale is set to 500 in this design (so 1250 is a location plan and 500 is not, matching the app's own naming and SC11's '> 500'), and the panel's note tells the user which it thinks it is - but Adam should confirm that 1:500 keeps its full colour composite.
- WHAT 03__Placeholder AND 04__Placeholder ARE CALLED. SC16 records that Adam chose to name them and has not yet said what. The loader skips an empty pack, so nothing breaks either way, but Library__Packs needs their display names and renaming a folder later means editing every Pattern__Pack that references it. Naming them now is cheaper.
- WHETHER SCALE AND ROTATION SHOULD ALSO EXIST ONCE PER PROJECT, not only per viewport. This design stores them per viewport per layer (Viewport__SitePlanHatches), which is the house pattern for curation and lets a 1:1250 location plan hatch differently from a 1:500 block plan on the same sheet. The cost is that setting the woodland hatch on six site plan viewports is six edits. The resolver already falls back to a layer default (Layer__Style.HatchId/HatchScale/HatchRotationDeg) that the tags SSOT would carry, which would answer this - but that means the per-project default is authored in SketchUp, not in the editor. Adam should say whether that is what he wants, or whether he wants an 'apply to every site plan viewport in this document' button instead.

---

## design:two-stores

### Two site plan stores per project — Existing and Proposed (REQ-23 to REQ-27, REQ-34)

## The one decision everything else follows from

The survey frames this as "both stores publish the same `Layer__CategoryKey`, therefore every key needs qualifying". Having read all ten singleton sites by name, that is half right. There are **two key spaces**, and only one of them collides.

- **The record key space** — `Viewport__ModelLayers`, `Viewport__ProjectedEdges.Edges__Categories`, the per-build owner table in `Na__LeVp2d__SitePlanBuild`. Every one of these is scoped to **one viewport**, and a viewport draws **exactly one store**. Inside that scope `TrueVision__SitePlan__OsMapping` is unambiguous. There is no collision here and there must be no change: bare keys stay bare, forever.
- **The process key space** — `Na__SpStore__LayerData`, `Na__SpStore__LayerPromises`, the repaint token, the band-path cache. These are module-level and shared across every viewport on every sheet. These collide, hard and silently.

So: **the composite key is `storeId + '::' + categoryKey`, it lives only in the process key space, and it is never persisted.** `Na__SpStore__StoreKey(storeId, categoryKey)` is the one function that makes one.

That is what makes the "migration for existing sheets" a **no-op by construction**, which is the whole point. Finding F8 and the house rule both say an unregistered record key is silently dropped; a design that rewrites `TrueVision__SitePlan__OsMapping` to `proposed::TrueVision__SitePlan__OsMapping` inside a saved record would have to run *before* the store has loaded (normalisation happens on sheet restore, long before `Na__SpStore__Resolve` settles), would have to guess which store an unbound viewport meant, and would break the `Na__LeRec__SITEPLAN_CATEGORY_PREFIX` no-prune exemption and `Na__LeEdge__SITEPLAN_PREFIX` on the way. It would put every saved PS01 sheet at risk to solve a collision that does not exist inside a viewport. Rejected.

The store identity a viewport *does* need is carried once, by the viewport itself: `Viewport__SitePlan.SitePlan__StoreId`.

## 1. The folder convention

Learn from `DesignPhases` in `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json`: a canonical `FolderTemplate`, an `Aliases` list, and a mapper that **never renames a folder on disk**. Apply it verbatim:

| Variant | Canonical folder | Aliases |
|---|---|---|
| `proposed` | `SitePlan__DrawingData__Proposed` | `SitePlan__DrawingData` (legacy) |
| `existing` | `SitePlan__DrawingData__Existing` | — |

The legacy folder is an **alias of proposed**, so a project that has only `SitePlan__DrawingData` today needs no rename, no re-export and no build: it resolves to the `proposed` store, which is exactly the store SC10 says an unbound viewport wants. It is shown in the exporter as "Proposed — legacy folder name", the same wording design phases already use for an alias folder.

Every folder name begins with the string `SitePlan__DrawingData`, so the four hand-held copies of that name become a **prefix test** rather than an equality test — one character of change each, and the old name still matches. This is why the suffix goes on the end rather than the front (`SitePlanExisting__DrawingData` would break all four gates).

If Adam's legacy folder actually holds an *existing* site plan, he renames the folder once and nothing else changes: the project then has one store, `existing`, and every unbound viewport resolves to the single store per SC10.

## 2. The composite key, and which signatures change

`Na__SpStore__StoreKey(storeId, categoryKey)` → `'proposed::TrueVision__SitePlan__OsMapping'`. Used as the flat key of `Na__SpStore__LayerData` and (with the export time) of `Na__SpStore__LayerPromises`. Flat rather than nested maps so `Reload`'s single `clear()` still works and a debugger shows one readable string.

The signature changes are all **"gained a store id"**, and every call site already has either a viewport or an explicit store to hand:

| Function | Was | Becomes |
|---|---|---|
| `Na__SpStore__GetDescriptor()` | — | **deleted**; replaced by `Na__SpStore__GetStore(storeId)` |
| — | — | new `Na__SpStore__GetStores()`, `Na__SpStore__GetDefaultStoreId()`, `Na__SpStore__ResolveStoreId(viewport)`, `Na__SpStore__HasChoices()`, `Na__SpStore__StoreKey()` |
| `Na__SpStore__GetLayers()` | — | `(storeId)` |
| `Na__SpStore__GetLayerData(categoryKey)` | — | `(storeId, categoryKey)` |
| `Na__SpStore__LoadLayer(categoryKey)` | — | `(storeId, categoryKey)` |
| `Na__SpStore__LoadAll()` | — | `(storeId)` — omit for every store |
| `Na__SpStore__GetFocusBoundsMm()` | — | `(storeId)` |
| `Na__LeEdge__SitePlanDefault(categoryKey)` | — | `(categoryKey, storeId)` |
| `Na__LeEdge__Default(categoryKey)` | — | `(categoryKey, storeId)` — optional |
| `Na__LeModelLayers__Groups(categoryKeys)` | — | `(categoryKeys, storeId)` — optional trailing arg, so a ValeVision port is unaffected |

`Na__LeEdge__Effective(viewport, categoryKey)` keeps its signature and derives the store id from the viewport — that is the seam that makes the bare owner key work.

`Na__SpStore__ResolveStoreId(viewport)` reads `viewport.Viewport__SitePlan.SitePlan__StoreId`; absent → `GetDefaultStoreId()` (the single store if there is one, else the `proposed` variant, else the first in variant order). A binding naming a store the project has **not** got is returned as written, not silently redirected — the frame then says so, and the Viewport Settings select lists the missing id so it can be re-pointed in one click. This is the `Na__LeSource__Options` precedent, and it matters: silently painting the other store would issue a planning drawing of the wrong scheme.

## 3. `SitePlan__StoreId` and the patch branch

`Na__LeRec__NormaliseViewport` already shallow-copies `Viewport__SitePlan`, so the sub-key survives save/load/undo (F8's good news). Two additions:

- In the site plan branch, trim the id and **delete it when empty** — the `Viewport__ShowFrame` / `Viewport__ImageZoom` "stored only when it is not the default" pattern. Every existing record stays byte-identical, which is REQ-27 for free.
- `Na__LeModel__UpdateViewport` gains `if (patch.sitePlan && ... && Na__LeRec__IsSitePlanViewport(viewport)) viewport.Viewport__SitePlan = Object.assign({}, viewport.Viewport__SitePlan, patch.sitePlan);`. Guarded on `IsSitePlanViewport` so a patch can never turn an architectural viewport into a site plan one.

Undo needs no special help — the store id lives inside the sheet record, so the ordinary sheet history covers it. **Test redo as well as undo** (the window-listener-order memory).

## 4. Pipeline

`discover_truevision_siteplan_store` becomes `discover_truevision_siteplan_stores(...)` returning a **list**. It scans `30__TrueVision__AppContent` for every directory whose name starts with `SITEPLAN_FOLDER_PREFIX`, identifies the variant from a `SITEPLAN_VARIANTS` table (canonical name then aliases), and runs today's body per folder. Two keys are written:

- `SitePlan__DataStore` — **the default store, in exactly today's shape**, so a warm-cached older app keeps working. Byte-identical for a single-store project.
- `SitePlan__DataStores` — the ordered array, each store gaining `SitePlan__StoreId`, `SitePlan__StoreLabel`, `SitePlan__IsLegacyFolder`.

`discover_truevision_model_groups`'s `if entry == SITEPLAN_FOLDER_NAME: continue` becomes `startswith(SITEPLAN_FOLDER_PREFIX)`, or the second folder appears as a phantom design phase full of site plan GLBs. Same one-line change to `Na__PortalMapper__ListPhaseFolders` and to `CloudflareR2__ModelSync__Main__.py`'s manifest extra-file gate. The R2 sync's upload loop already walks every folder with GLBs, so nothing else there changes.

## 5. The Viewport Settings panel

**Adding.** A `Site Plan` select above the Scale row in the `add-siteplan` block, `data-na-control="vp-add-siteplan-store"`, whose row is hidden unless `Na__SpStore__HasChoices()` — the same "no choice to make, no row" rule the Model Source row already uses. `Na__LePanelViewport__AddSitePlan(sheet, denominator, storeId)` passes it through as `sitePlan : { SitePlan__StoreId : storeId }` and resolves bounds and the scale off-map from **that** store.

**Changing.** A `Site Plan` row in the edit block, in the slot Model Source occupies for architectural viewports (Model Source is hidden for a site plan viewport, so the two never both show). Change → `UpdateViewport(..., { sitePlan : { SitePlan__StoreId : el.value || null } })`, one undo step. It deliberately does **not** re-centre or re-preset the layer toggles — that would throw away Adam's curation; the existing Centre button re-centres on demand.

## 6. Cache keys that must gain the store id

1. `Na__SpStore__LayerData` — bare key → `StoreKey(storeId, categoryKey)`.
2. `Na__SpStore__LayerPromises` — `categoryKey + '|' + exportedIso` → `storeId + '|' + categoryKey + '|' + exportedIso`. The `?v=` on each GLB URL must be **that store's** `SitePlan__ExportedIso`, not a global one.
3. `Na__LeVp2d__SitePlanToken(viewport)` — insert the store id: `'siteplan:' + storeId + ':' + exportedIso + ':' + modelLayersToken`. **This is the load-bearing one.** It is `built.key`, therefore `state.classesKey`, therefore the base of `Na__LeVp2d__SitePlanPaintKey` and of `Na__LeVp2d__BandPaths`'s `built.key + '@false@' + styleToken`. Fixing it fixes the repaint guard, the snap source and the path cache together; leaving it is the bug where switching store repaints nothing.
4. `Na__LePanelModelLayers__BuiltKey` — prefix the store id. Two stores publish identical group ids and layer keys, so without it the panel skips its rebuild when the selection moves between stores.

`Na__LeVp2d__PathCache` is a shared 16-entry FIFO; two stores on one sheet double the pressure on it. Noted as a risk, not fixed here.

## 7. Exporter guard (REQ-34)

The model's ProjectLink dictionary gains `target_siteplan_folder` / `target_siteplan_variant`, mirroring `target_phase_folder` / `target_phase_id`. `Na__SitePlan__ChooseFolder` is replaced by `Na__SitePlan__ResolveTargetFolder`, which uses the locked-in folder when there is one and otherwise falls back to today's picker plus a variant identification. Before writing, a modal built from `Na__PortalMapper__InspectSitePlanFolder` states what is already in the folder, **including the variant read from that folder's own manifest**: "This folder holds 6 GLBs for the **Existing** site plan, last written 18-Sep-2026. You are exporting the **Proposed** site plan. Overwrite?" The stale sweep (`NA__SITEPLAN__OLD_FILE_PATTERN`) is already scoped to the chosen export dir, so it can never reach into the other variant's folder — that property must be preserved, not widened.

The manifest gains `SitePlanData__Variant`. Per SC26 the **folder decides**; the manifest's variant is a cross-check that logs a warning on disagreement, never an override. Stamping `asset.extras.Na__SitePlanVariant` into each GLB (one Ruby line, using the channel finding 13 says is already there and unread) is a cheap belt-and-braces catch for a mis-copied file — optional, last.

#### Files

| Action | Path | What |
|---|---|---|
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Stores__Config__.json` | New config, newer Meta-block style, modelled exactly on Na__LayoutEditor__LineStyleTool__Config__.json (4-space indent, aligned colons, prose Meta__Why/Which/Where keys, per-row __Note). Blocks: SitePlanData__Stores__Meta, SitePlanData__Stores__Variants (array of Variant__ rows), SitePlanData__Stores__Fallback, SitePlanData__Stores__Labels. Meta__WhereElseThisLives names the two other copies of the variant table (ProjectVision__BuildScript__.py SITEPLAN_VARIANTS and Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json SitePlanVariants). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__StoresConfig__.js` | New module, NAMESPACE Na__SpCfg. Adds Na__SpCfg__ConfigUrl, Na__SpCfg__LoadPromise, Na__SpCfg__Config, frozen Na__SpCfg__FALLBACKS mirroring the JSON exactly, Na__SpCfg__Ready(), Na__SpCfg__Variants(), Na__SpCfg__IdentifyFolder(folderName) -> {id,label,isLegacyFolder}\|null, Na__SpCfg__FolderNamesFor(variantId), Na__SpCfg__DefaultVariantId(), Na__SpCfg__LabelFor(variantId). Exports all of these. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | The core change. REMOVE const Na__SpStore__FOLDER (replaced by the variant table) but keep exporting a Na__SpStore__FOLDER_PREFIX = 'SitePlan__DrawingData'. Replace let Na__SpStore__Descriptor with const Na__SpStore__Stores = new Map() (storeId -> descriptor) plus let Na__SpStore__Order = []. ADD Na__SpStore__StoreKey(storeId, categoryKey) returning storeId + '::' + categoryKey. CHANGE Na__SpStore__FolderUrls(folderName) to take the folder name. CHANGE Na__SpStore__Describe(raw, source, folderUrls, variant) to stamp SitePlan__StoreId, SitePlan__StoreLabel, SitePlan__FolderName, SitePlan__IsLegacyFolder onto the descriptor. REWRITE Na__SpStore__Find() to await Na__SpCfg__Ready() and then, per source in today's order (local manifests, then SitePlan__DataStores/SitePlan__DataStore, then CDN manifests), probe every variant folder and its aliases; the first SOURCE that yields at least one store wins outright, and the console line names the source and every store it produced. ADD Na__SpStore__GetStores(), Na__SpStore__GetStore(storeId), Na__SpStore__GetDefaultStoreId(), Na__SpStore__HasChoices(), Na__SpStore__ResolveStoreId(viewport) (reads viewport.Viewport__SitePlan.SitePlan__StoreId, returns it as written when it names no known store). DELETE Na__SpStore__GetDescriptor. CHANGE Na__SpStore__GetLayers(storeId), Na__SpStore__GetLayerData(storeId, categoryKey), Na__SpStore__LoadLayer(storeId, categoryKey), Na__SpStore__LoadAll(storeId) (undefined = every store), Na__SpStore__GetFocusBoundsMm(storeId). Key Na__SpStore__LayerData by Na__SpStore__StoreKey and Na__SpStore__LayerPromises by storeId + '\|' + categoryKey + '\|' + exportedIso, with the ?v= taken from that store's own SitePlan__ExportedIso. Na__SpStore__Dispatch gains storeId in its detail. Update the exports list and the DEVELOPMENT LOG. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js` | Na__LeVp2d__SitePlanToken(viewport): resolve the store id and emit 'siteplan:' + storeId + ':' + exportedIso + ':' + Na__LeModelLayers__Token(viewport). Na__LeVp2d__SitePlanBuild(viewport, allowMissing): resolve the store id once, read Na__SpStore__GetStore(storeId) instead of GetDescriptor, and pass storeId to Na__SpStore__GetLayerData; the owner table keeps BARE Layer__CategoryKey values. Na__LeVp2d__SitePlanDrawing(viewport): await Na__SpStore__Resolve() then Na__SpStore__LoadAll(storeId). Na__LeVp2d__FillSitePlan: after the READY check, if Na__SpStore__GetStore(resolvedId) is null show the new SitePlanStoreMissing empty message naming the bound id; LoadAll(storeId). Na__LeVp2d__RefillSitePlan unchanged. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js` | Import Na__SpStore__ResolveStoreId. Na__LeVp2d__CentreOnDrawing: Na__SpStore__GetFocusBoundsMm(Na__SpStore__ResolveStoreId(viewport)). Na__LeVp2d__ForceRender site plan branch: keep Na__SpStore__Reload() (every store re-read — a re-export may touch both), then Na__SpStore__LoadAll(Na__SpStore__ResolveStoreId(viewport)). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__ModelSource__.js` | Na__LeSource__CategoryKeys(viewport): the site plan branch becomes Na__SpStore__GetLayers(Na__SpStore__ResolveStoreId(viewport)).map(l => l.Layer__CategoryKey) — bare keys, this store only. Add a sibling export Na__LeSource__SitePlanStoreId(viewport) that returns Na__SpStore__ResolveStoreId for a site plan viewport and null otherwise, so the panels have one import for it. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__.js` | Na__LeModelLayers__Groups(categoryKeys, storeId): optional trailing argument; the site plan branch reads Na__SpStore__GetLayers(storeId) instead of GetLayers(). Na__LeModelLayers__IsOn / __HiddenKeys / __Token unchanged — Viewport__ModelLayers stays keyed by bare Layer__CategoryKey. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js` | Na__LeEdge__SitePlanDefault(categoryKey, storeId): keeps the Na__LeEdge__SITEPLAN_PREFIX test on the bare key, then finds the layer in Na__SpStore__GetLayers(storeId). Na__LeEdge__Default(categoryKey, storeId): passes storeId through; an omitted storeId resolves to the default store. Na__LeEdge__Effective(viewport, categoryKey): signature UNCHANGED — it computes Na__SpStore__ResolveStoreId(viewport) and passes it to Default. This is the seam that lets the owner table keep bare keys. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js` | In Na__LeRec__NormaliseViewport's site plan branch, after the existing shallow copy: trim Viewport__SitePlan.SitePlan__StoreId when it is a non-empty string, delete it otherwise. Nothing else changes — Na__LeRec__SITEPLAN_CATEGORY_PREFIX, Na__LeRec__NormaliseProjectedEdges and the Viewport__ModelLayers rebuild all keep working on bare keys. Extend the file-header THE RECORD note to document SitePlan__StoreId (absent = the default store). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js` | Na__LeModel__UpdateViewport: add a patch.sitePlan branch — if (patch.sitePlan && typeof patch.sitePlan === 'object' && Na__LeRec__IsSitePlanViewport(viewport)) viewport.Viewport__SitePlan = Object.assign({}, viewport.Viewport__SitePlan, patch.sitePlan); placed beside patch.modelLayers. Update the patch list in the function's header comment and the PORT NOTE divergence line. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js` | Add Na__LePanelViewport__StoreOptions(viewport) (every store as {value: SitePlan__StoreId, label: SitePlan__StoreLabel}, plus a viewport's unknown bound id listed as written). In Build: a 'vp-add-siteplan-store' select row above the scale row in the add-siteplan block; a 'vp-siteplan-store' select row in the edit block tagged data-na-block="siteplan-store". In Refresh: hide both rows unless Na__SpStore__HasChoices(); show the edit row only when isSitePlan; fill both from StoreOptions. Na__LePanelViewport__AddSitePlan(sheet, denominator, storeId) — resolve storeId (default when absent), read the descriptor via Na__SpStore__GetStore(storeId), build the scale off-map and the bounds from that store, and pass sitePlan : { SitePlan__StoreId : storeId }. Register a change handler on 'vp-siteplan-store' calling UpdateViewport with { sitePlan : { SitePlan__StoreId : el.value \|\| null } }; pass the add select's value in the existing 'vp-add-siteplan' click handler. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ModelLayers__.js` | Both Na__LeModelLayers__Groups call sites (Refresh, and the all-on/all-off bulk handler) pass Na__LeSource__SitePlanStoreId(viewport) as the second argument. Prefix Na__LePanelModelLayers__BuiltKey with that store id so the panel rebuilds when the selection moves between two stores that publish identical keys and labels. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js` | Import Na__SpCfg__Ready and add it to the Promise.all in Na__LeMode__Initialize beside Na__LeCfg__Ready()/Na__LeEdge__Ready()/etc, so the variant table is in before the first sheet is normalised and before any panel builds. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json` | Add labels beside the existing SitePlan ones: LayoutEditor__Labels__SitePlanStore, LayoutEditor__Labels__SitePlanStoreTitle, LayoutEditor__Labels__SitePlanStoreMissing, LayoutEditor__Labels__SitePlanStoreExisting, LayoutEditor__Labels__SitePlanStoreProposed. Reword LayoutEditor__Labels__SitePlanNoData so it no longer names one folder by hand. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js` | Bump PWA_SW_VERSION_TOKEN (check the current value against HEAD first; today's is '2026-09-20-3') and add the matching DEVELOPMENT LOG line 'Token bumped (…): two site plan stores adds Na__SpStore__GetStore/GetStores/ResolveStoreId, which new imports name.' Required because this release adds new exports that newly-added imports reference — a warm cache would otherwise break the editor on the first visit. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanStores__.test.mjs` | Node test. Because Node resolves .js here as CommonJS, it reads Na__SitePlan__StoresConfig__.js and Na__LayoutEditor__SheetRecords__.js as text and re-exports (or copies to a temp .mjs) exactly as the survey's probe did. Asserts: (1) IdentifyFolder('SitePlan__DrawingData') -> proposed with isLegacyFolder true; (2) IdentifyFolder('SitePlan__DrawingData__Existing') -> existing; (3) ResolveStoreId on {Viewport__SitePlan:{}} gives the only store when there is one and 'proposed' when there are two; (4) a bound id naming no known store is returned as written; (5) StoreKey round-trips and never produces the bare key; (6) THE COMPATIBILITY INVARIANT: normalising a pre-change site plan viewport record leaves Viewport__SitePlan deep-equal to {} and adds no key anywhere; (7) the shipped JSON and Na__SpCfg__FALLBACKS are equal. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | Add SITEPLAN_FOLDER_PREFIX = 'SitePlan__DrawingData' and a SITEPLAN_VARIANTS table (id, label, folder, aliases, is_default, order) with a 'Keep in sync with' comment naming the TrueVision config and the GLB Builder config, in the style of the TRUEVISION_DEV_OWNED_KEYS comment. Keep SITEPLAN_FOLDER_NAME as the legacy alias. Add identify_siteplan_variant(folder_name). Rename discover_truevision_siteplan_store -> discover_truevision_siteplan_stores(project_path, year_folder_name, project_folder) returning a list; per folder it runs today's body and adds SitePlan__StoreId, SitePlan__StoreLabel, SitePlan__IsLegacyFolder to the returned dict. Change discover_truevision_model_groups's `if entry == SITEPLAN_FOLDER_NAME: continue` to a startswith(SITEPLAN_FOLDER_PREFIX) test. generate_truevision_project_data(project_code, project_name, model_groups, siteplan_stores=None) writes SitePlan__DataStores (the list) and SitePlan__DataStore (the default store, in exactly today's shape). Update the __main__ call site accordingly. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\CloudflareR2__ModelSync__Main__.py` | Add SITEPLAN_FOLDER_PREFIX = 'SitePlan__DrawingData' beside SITEPLAN_FOLDER_NAME. In discover_model_groups change `if item.name == SITEPLAN_FOLDER_NAME and (item / SITEPLAN_MANIFEST_FILENAME).is_file()` to a startswith test on the prefix, so each variant folder's manifest travels with its GLBs. Nothing else: the upload loop already walks every folder that holds GLBs. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json` | Under TrueVisionContent add SitePlanFolderPrefix : 'SitePlan__DrawingData'. Add a top-level SitePlanVariants array modelled exactly on DesignPhases: { VariantId, Label, FolderTemplate, Aliases, IsDefault, Description } for 'proposed' (aliases ['SitePlan__DrawingData']) and 'existing'. Extend _documentation.folderNames to say the same alias rule applies to site plan folders. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalMapper__.rb` | Add Na__PortalMapper__SitePlanVariants, Na__PortalMapper__IdentifySitePlanVariant(folder_name) (canonical then aliases, mirroring IdentifyPhase), Na__PortalMapper__ListSitePlanFolders(project_root), Na__PortalMapper__SitePlanFolderPath, Na__PortalMapper__InspectSitePlanFolder(project_root, folder_name) (exists, glb_count, last_written, variant read from that folder's own manifest) and Na__PortalMapper__CreateSitePlanFolder(project_root, variant_id). Change ListPhaseFolders's `next if entry == siteplan_name` to a prefix test so neither variant folder is ever listed as a design phase. In BuildStructureTree, list every site plan folder as an 'aside' row with its variant label and '· legacy name' where it matched an alias. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectLink__.rb` | Add target_siteplan_folder and target_siteplan_variant to the attribute key list and to Na__ProjectLink__BlankLink/Read, and add Na__ProjectLink__WriteTargetSitePlan(model, folder_name, variant_id) mirroring Na__ProjectLink__WriteTargetPhase. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | Replace Na__SitePlan__ChooseFolder with Na__SitePlan__ResolveTargetFolder(model, config): use the model's target_siteplan_folder when set (creating it if missing); otherwise fall back to today's UI.select_directory, then identify the chosen folder's variant and confirm when it matches none. Add Na__SitePlan__ConfirmOverwrite(project_root, folder_name, variant_id) which calls InspectSitePlanFolder and refuses-with-confirm when the folder already holds a DIFFERENT variant (REQ-34). Add 'SitePlanData__Variant' and 'SitePlanData__VariantLabel' to the manifest written in Na__SitePlan__Write. Leave NA__SITEPLAN__OLD_FILE_PATTERN and the stale sweep exactly as they are — they are scoped to the chosen export dir and must stay that way. Optionally add 'Na__SitePlanVariant' to the asset.extras written by Na__SitePlan__WriteLinework / Na__SitePlan__WriteFill. Bump NA__SITEPLAN__EXPORTER_VERSION. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__ProjectActions__.rb` | Add Na__ProjectActions__SetSitePlanTarget(dialog, params) and Na__ProjectActions__CreateSitePlanFolder(dialog, params), routed from Na__UserInterface__HandleProjectAction. Add Na__ProjectActions__SitePlanCatalogue(link) (variant_id, label, next_folder_name, exists, glb_count) mirroring Na__ProjectActions__PhaseCatalogue, and include it plus the current target in Na__UserInterface__BuildProjectStatus. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiLayout__.html` | In #tab-project, a new settings group 'Site Plan Variant' immediately after 'Design Phases And Schemes', with the same markup shape: a folder list showing each site plan folder, its variant label, GLB count and last-written time; a select (#naTvgbSitePlanVariantSelect) and a Create Folder button; and a locked-in target row stating which variant Export Site Plan will write into. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiBridge__.js` | Render the new Site Plan Variant group from the project status payload and post setSitePlanTarget / createSitePlanFolder actions back to Ruby, following the existing setTargetFolder / createScheme handlers verbatim. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill section 9 with this design. Add decisions SC18 (the folder convention and the legacy alias), SC19 (record keys stay bare; the composite key is runtime-only), SC20 (a binding naming a missing store is kept and reported, never silently redirected) and SC21 (SitePlan__DataStore keeps being written beside SitePlan__DataStores for warm caches). Note that the predecessor document's SP03 ('one site plan store per project') is superseded by REQ-25. Update the section 12 ledger. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` | New release entry at the top with Overview / Tested / For Adam / Files, listing every file above and its new per-file version, and recording the PWA token bump. |

#### New keys

- `SitePlanData__Stores__Meta`
- `SitePlanData__Stores__Meta.Meta__FileName`
- `SitePlanData__Stores__Meta.Meta__Description`
- `SitePlanData__Stores__Meta.Meta__Version`
- `SitePlanData__Stores__Meta.Meta__Created`
- `SitePlanData__Stores__Meta.Meta__Author`
- `SitePlanData__Stores__Meta.Meta__WhyFolderDetected`
- `SitePlanData__Stores__Meta.Meta__WhyKeysStayBare`
- `SitePlanData__Stores__Meta.Meta__WhichStoreIsDefault`
- `SitePlanData__Stores__Meta.Meta__WhereElseThisLives`
- `SitePlanData__Stores__Meta.Meta__KeyStability`
- `SitePlanData__Stores__Variants`
- `SitePlanData__Stores__Variants[].Variant__Id`
- `SitePlanData__Stores__Variants[].Variant__Label`
- `SitePlanData__Stores__Variants[].Variant__FolderName`
- `SitePlanData__Stores__Variants[].Variant__FolderAliases`
- `SitePlanData__Stores__Variants[].Variant__IsDefault`
- `SitePlanData__Stores__Variants[].Variant__Order`
- `SitePlanData__Stores__Variants[].Variant__Note`
- `SitePlanData__Stores__Fallback`
- `SitePlanData__Stores__Fallback.Fallback__Description`
- `SitePlanData__Stores__Fallback.Fallback__VariantId`
- `SitePlanData__Stores__Fallback.Fallback__FolderPrefix`
- `SitePlanData__Stores__Labels`
- `SitePlanData__Stores__Labels.Labels__Description`
- `SitePlanData__Stores__Labels.Labels__StoreRow`
- `SitePlanData__Stores__Labels.Labels__StoreRowTitle`
- `SitePlanData__Stores__Labels.Labels__LegacyFolderSuffix`
- `LayoutEditor__Labels__SitePlanStore`
- `LayoutEditor__Labels__SitePlanStoreTitle`
- `LayoutEditor__Labels__SitePlanStoreMissing`
- `LayoutEditor__Labels__SitePlanStoreExisting`
- `LayoutEditor__Labels__SitePlanStoreProposed`
- `Viewport__SitePlan.SitePlan__StoreId`
- `SitePlan__DataStores`
- `SitePlan__DataStores[].SitePlan__StoreId`
- `SitePlan__DataStores[].SitePlan__StoreLabel`
- `SitePlan__DataStores[].SitePlan__IsLegacyFolder`
- `SitePlan__DataStores[].SitePlan__FolderName`
- `SitePlan__DataStores[].SitePlan__ManifestUrl`
- `SitePlan__DataStores[].SitePlan__ExportedIso`
- `SitePlan__DataStores[].SitePlan__NorthAngleDeg`
- `SitePlan__DataStores[].SitePlan__BoundsMm`
- `SitePlan__DataStores[].SitePlan__Layers`
- `SitePlan__DataStore.SitePlan__StoreId`
- `SitePlan__DataStore.SitePlan__StoreLabel`
- `SitePlan__DataStore.SitePlan__IsLegacyFolder`
- `SitePlanData__Variant`
- `SitePlanData__VariantLabel`
- `TrueVisionContent.SitePlanFolderPrefix`
- `SitePlanVariants`
- `SitePlanVariants[].VariantId`
- `SitePlanVariants[].Label`
- `SitePlanVariants[].FolderTemplate`
- `SitePlanVariants[].Aliases`
- `SitePlanVariants[].IsDefault`
- `SitePlanVariants[].Description`

#### Order of work

1. STEP 0 — prove the baseline, before touching anything. Launch truevision-static-siteplan (8523) and open http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 on 127.0.0.1 (never app.localhost). Open PS01's site plan sheet and screenshot the viewport. That screenshot is the acceptance test for REQ-27: nothing in this build may change it. Run `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` and record the file count.
2. STEP 1 — the variant table, app side, alone. Write Na__SitePlan__Stores__Config__.json and Na__SitePlan__StoresConfig__.js (Na__SpCfg) with the mirrored FALLBACKS. Register Na__SpCfg__Ready() in the ModeController's Promise.all. Nothing reads it yet. Run the exports verifier. Testable on its own: the app loads unchanged and the config fetches.
3. STEP 2 — the store module, still single-store in practice. Rework Na__SitePlan__Store__.js to the Map-of-stores shape with the new API (GetStores/GetStore/GetDefaultStoreId/ResolveStoreId/HasChoices/StoreKey), the composite cache keys, and the per-variant discovery in Find(). PS01 still has one folder, so discovery finds exactly one store, id 'proposed', isLegacyFolder true. Update the five consumer files' imports mechanically (Viewport2d__SitePlan, Viewport2d__, ModelSource, ModelLayers, EdgeStyles, Panel__ViewportSettings, Panel__ModelLayers). Run the exports verifier. Testable: STEP 0's screenshot must be pixel-identical, and the console must say one store from the local manifest.
4. STEP 3 — the token and the caches. Put the store id into Na__LeVp2d__SitePlanToken and into Na__LePanelModelLayers__BuiltKey. Still one store, so nothing visibly changes; this lands the repaint guard before there is anything to switch between. Run the exports verifier.
5. STEP 4 — the second store as a local fixture. Copy PS01's SitePlan__DrawingData to SitePlan__DrawingData__Existing and delete the RedLineBoundary GLB from the copy so the two stores differ at a glance. Reload. Testable: the console names two stores; the existing saved viewport still paints exactly as in STEP 0 (it is unbound, so it resolves to 'proposed'). DO NOT COMMIT THIS FIXTURE — git status is shared with other sessions.
6. STEP 5 — the record and the patch. Add SitePlan__StoreId trimming to Na__LeRec__NormaliseViewport and the patch.sitePlan branch to Na__LeModel__UpdateViewport. Write Na__Test__SitePlanStores__.test.mjs and get its seven assertions passing, the byte-identity invariant first. Testable in Node alone.
7. STEP 6 — the panel. Add the two selects to Na__LayoutEditor__Panel__ViewportSettings__.js, the labels to the AppConfig, and the AddSitePlan store argument. Testable in the browser: add one viewport of each store on one sheet, confirm they paint different drawings; switch a viewport's store and confirm it repaints (this is what STEP 3 bought); undo AND redo the switch.
8. STEP 7 — the missing-store path. Hand-edit a saved viewport's SitePlan__StoreId to a nonsense value, reload, and confirm the frame says so rather than painting the other store, and that the select lists the unknown id so it can be re-pointed.
9. STEP 8 — the PDF. Export a sheet holding both viewports and confirm the PDF matches the screen. Na__LePdf__DrawViewport goes through Na__LeVp2d__SitePlanDrawing(viewport), so this should need no PDF change at all — confirm that, do not assume it.
10. STEP 9 — the pipeline. Edit ProjectVision__BuildScript__.py and CloudflareR2__ModelSync__Main__.py. Run the build with --dry-run-check first, then for real on PS01, and diff PS01's TrueVision__ProjectData__.json: SitePlan__DataStore must be byte-identical to its previous content and SitePlan__DataStores must list both folders. Then delete the fixture folder, rebuild, and confirm the file returns to exactly its pre-build state.
11. STEP 10 — the exporter. Edit the GLB Builder config, mapper, project link, site plan export and Project tab. STOP AND ASK ADAM TO RUN IT (SC03) — there is no Ruby interpreter on this PC and none of it can be syntax-checked here. Ask him to export RB05's site plan into a Proposed folder, then attempt an export into the Existing folder and confirm the REQ-34 guard fires.
12. STEP 11 — release. Bump PWA_SW_VERSION_TOKEN (check its current value against HEAD first), add its DEVELOPMENT LOG line, write the DEVLOG entry, update section 9 and the section 12 ledger in TrueVision__PLAN__SitePlanComposites__.md, and run both verifiers. Do not mark any ledger row 'x' until Adam has confirmed it.
13. STEP 12 — after Adam signs off, ask: 'Would you like me to introduce them to ValeVision 3D now?' The answer is almost certainly no for this one — ValeVision has no site plan system at all (survey cross-cutting 7), so there is nothing to port.

#### Risks

- The legacy folder is aliased to 'proposed'. If a project's existing SitePlan__DrawingData actually holds an EXISTING site plan, it is mislabelled until Adam renames the folder. The label is cosmetic while the project has one store (an unbound viewport resolves to the single store either way), but it becomes real the moment a second folder appears. Flag it to him; the fix is a one-off folder rename with no app or record consequences.
- Na__LeVp2d__PathCache is a 16-entry FIFO shared with every architectural viewport. Two site plan stores on one sheet double the pressure on it. Not fixed here; watch for a sheet that repaints more than it should.
- Na__SpStore__Find picks ONE source for ALL stores (the first that yields any), preserving today's semantics and keeping the console story simple. A project whose Existing folder exists only locally and whose Proposed exists only on the CDN would therefore show one store, not two. Very unlikely on the authoring machine, where the export writes locally, but it is a genuine behaviour edge and the console line must name the source so it is diagnosable.
- Discovery probes each variant folder's manifest, so a project with no site plan data now costs two failed fetches instead of one at each of the local and CDN steps. Harmless, but it doubles the 404 noise in the console for AA00-shaped projects; the note text must not read as an error.
- The variant table is declared THREE times (TrueVision config JSON, Python build script, GLB Builder config JSON) because no one of the three can read the others. This is the same disease the survey logged as 'four files hold that folder name by hand'. Mitigated only by the Meta__WhereElseThisLives / 'Keep in sync with' comments, following the TRUEVISION_DEV_OWNED_KEYS precedent. A folder rename that touches one and not the others fails silently.
- F5 stands: no site plan fill has ever been painted, on screen or on paper. This design does not depend on the fill path, but STEP 4's fixture and STEP 8's PDF run over code that has never seen real data. Do not read a blank fill as a two-store fault.
- The ProjectVision 8090 server never reloads its routes and a re-export with an unchanged SitePlanData__ExportedIso will be served stale by both the service worker's tv-models- bucket and the path cache. When STEP 4's fixture is copied, the two stores share an ExportedIso — the store id in the cache keys is what keeps them apart, so if STEP 3 is skipped or done wrong this manifests as 'the two stores paint the same drawing', not as an error.
- Na__LeModelLayers__Groups gains an optional trailing argument. If ValeVision carries a copy of that file, the argument is harmless there (undefined = today's behaviour), but the port obligation should be checked before the edit, not after.

#### Rejected alternatives

- Store-qualified keys INSIDE the saved record (Viewport__ModelLayers, Viewport__ProjectedEdges). Rejected. A viewport draws exactly one store, so there is no collision to solve inside a viewport's own record; the price would be a migration that has to run at normalisation time, before the store has resolved, guessing which store an unbound viewport meant, and that would also break the Na__LeRec__SITEPLAN_CATEGORY_PREFIX no-prune exemption and the Na__LeEdge__SITEPLAN_PREFIX test, both of which match on the bare prefix. It would put every saved PS01 sheet at risk for nothing.
- Composite keys in the per-build owner table. Rejected for the same reason plus one more: the owner key is handed straight to Na__LeEdge__Effective(viewport, key), which then looks it up in Viewport__ProjectedEdges — a composite owner key would miss every saved bare override. The store correctness that a composite key would have bought is obtained instead by Na__LeEdge__Effective resolving the store from the viewport it already holds.
- Nested Maps (storeId -> Map(categoryKey -> data)) in the store. Rejected in favour of one flat Map keyed by the composite string: Reload's single clear() keeps working, the shape stays closest to today's code, and one readable key string is easier to diagnose than two levels.
- Writing only SitePlan__DataStores and dropping SitePlan__DataStore. Rejected: a warm PWA cache can hold an older app against freshly built project data, and that app would read no site plan at all. Both keys are written; the old one stays byte-identical for a single-store project.
- Prefixing the variant onto the front of the folder name (SitePlanExisting__DrawingData). Rejected: it breaks all four hand-held equality tests on 'SitePlan__DrawingData' at once and forces a rename of every existing project's folder. The suffix form makes the legacy name a prefix-match of the new scheme, so each gate becomes startswith and back-compatibility is free.
- Giving the legacy folder its own third variant id ('default'). Rejected: it puts a phantom third entry in front of Adam in a feature whose whole brief is 'Existing or Proposed', and the store id it produces is not the one SC10 wants an unbound viewport to resolve to.
- Silently redirecting a viewport bound to a missing store onto the default store. Rejected: it would issue a planning drawing showing the wrong scheme with nothing said. The binding is kept, the frame reports it, and the select lists the unknown id so it can be re-pointed — the Na__LeSource__Options precedent for an unknown design phase.
- Re-running the scale-based layer off-map and re-centring when Adam changes a viewport's store. Rejected: it would discard the layer toggles and edge overrides he has curated. Changing the store changes only the store; the existing Centre button re-centres on demand.
- Trusting SitePlanData__Variant in the manifest over the folder name. Rejected outright by SC26 — the variant is detected from the FOLDER. The manifest field and the GLB asset.extras stamp exist only as a cross-check that logs a warning when a file has been copied into the wrong folder.

#### Flagged for Adam

- The legacy folder alias. SitePlan__DrawingData is read as the PROPOSED site plan. If any live project's single site plan folder is in fact the existing site, say which, and rename that folder to SitePlan__DrawingData__Existing — it is a one-off rename with no app, record or re-export consequence. Everything else in this design is decided here.

---

## design:exporter

### GLB Builder: Export Polygon Faces, the face-only export fix, the Existing/Proposed store lock-in, manifest schema v2, and the pipeline that carries them

## 1. "Export Polygon Faces" (REQ-11, REQ-12, SC06, SC07)

**Where it lives.** A new `naTvgb__ActionGroup` titled **Site Plan Options**, on the Export tab, between the existing "Export Options" group and "Export Actions". It holds one `naTvgb__OptionRow`, `#naTvgbExportPolygonFaces`. It does *not* join the three existing rows: those are model-export options applied through `Na__MaterialEngine__SetExportMode`, and a site plan flag among them makes a user who unticks "Export Materials" wonder whether the site plan changed too. No CSS is needed — every class already exists.

**How it crosses the bridge.** `Na__Tvgb__RunExportAction` already sends `JSON.stringify(params)` for *every* action, `export_site_plan` included; it is Ruby that throws the payload away (`when 'export_site_plan' then self.Na__UserInterface__ActionExportSitePlan(dialog)` — no `params_json`). So: `na__tvgb__collectExportParams()` gains `exportPolygonFaces`, the router passes `params_json`, and `Na__UserInterface__ActionExportSitePlan(dialog, params_json = nil)` parses it with `Na__UserInterface__ParseParams`.

**How it persists.** `Sketchup.write_default(NA__SITEPLAN__PREFS_SECTION, 'SitePlanExportFaces', bool)` — the mechanism that already remembers `SitePlanExportDir` in the same module. Chosen over the model attribute dictionary for two reasons: the *second* entry point, the Extensions menu item "Export Site Plan Data", has no params channel at all, and a shared Sketchup default is the only thing both paths read without plumbing; and whether Adam wants face fills is a way of working, not a property of RB05. The dialog is told the current value through a new `site_plan_export_faces` field on the model status, and `Na__Tvgb__ReceiveModelStatus` sets the checkbox from it, so reopening the dialog shows the remembered state. The initial value before Adam ever ticks it comes from a new `SitePlanExportConfig.ExportPolygonFacesDefault` in the Tags SSOT — which must *also* be added to `NA__SITEPLAN__CONFIG_DEFAULTS`, because `Na__SitePlan__Config` iterates the defaults hash and silently drops any SSOT key with no default counterpart.

**What it changes in the exporter.** `Na__SitePlan__Scan` puts `all_faces: self.Na__SitePlan__ExportFacesEnabled?(config)` into `ctx`. In `Na__SitePlan__Collect` the face branch becomes `if bucket[:defn][:fills] || ctx[:all_faces]`. In `Na__SitePlan__Write` the fill-file condition drops its `defn[:fills] &&` and becomes simply `unless bucket[:rings].empty?`. Widening is safe downstream: `Na__LeVp2d__SitePlanBuild` filters fills on `FillHex && FillOpacity > 0`, so a ring file for, say, OsMapping exists and paints nothing until a colour is authored — which is precisely REQ-14's "bounded space only". Two text fixes travel with it: the `faces_ignored` warning becomes "…tick Export Polygon Faces to write them as a fill outline" (it can only fire when the toggle is off, so it needs no guard), and `Na__SitePlan__SummaryText` drops `defn[:fills] &&` from its face count so the summary tells the truth.

**A separate triangle face-mesh file: no.** Four reasons, and they are not preferences. (a) `Na__SpGlb__Primitives` matches an exact mode and only `MODE_LINES` and `MODE_LOOP` are ever requested; a triangle GLB parses to an empty result *with no thrown error* — a file with no reader whose failure mode is silence. (b) Both painters are vector: rings give SVG one `d` string plus `fill-rule="evenodd"` for free hole-cutting, and jsPDF draws through `Na__LeChrome__PushPolyline`; a triangulated fill shows hairline seams at every shared edge in the issued drawing. (c) REQ-14 wants a *bounded outline* to clip an SVG hatch to; a mesh would have to be re-stitched into the outline the exporter already has in `face.loops`. (d) A new suffix must be taught to four separate patterns plus a manifest key. SC07 stands. One two-line hedge is worth taking: stamp the fill GLB's `asset.extras` with `'Na__SitePlanPayload' => 'rings'`, so a future parser can refuse the wrong payload loudly instead of returning empty.

## 2. Finding F6 — five gates, not four

A layer with faces but no visible edges must survive. Every gate moves in one commit.

1. **`Na__SitePlan__Write`** — `if bucket[:positions].empty?` becomes `if bucket[:positions].empty? && bucket[:rings].empty?`. `linework_file` becomes `nil` unless positions exist, and the write of the linework GLB is wrapped in the same test. `Layer__LineworkFile` may now legitimately be null. The existing warning "faces but no visible edges… the layer is skipped" is reworded to "faces but no visible edges; the fill exports, the outline does not".
2. **`discover_truevision_siteplan_store`, manifest path** — `if linework not in present: continue` becomes a `has_line` / `has_fill` pair; skip only when neither is present, keep today's `[WARNING]` for a *named but missing* linework file, and make `Layer__LineworkUrl` conditional.
3. **Same function, no-manifest fallback path** — `if 'linework' not in files: continue` becomes `if 'linework' not in files and 'fill' not in files: continue`, with the same conditional URL.
4. **`Na__SpStore__Layer`** — `return layer.Layer__LineworkUrl ? layer : null;` becomes `return (layer.Layer__LineworkUrl || layer.Layer__FillUrl) ? layer : null;`.
5. **`Na__SpStore__LoadLayer`** (the gate the brief's count misses) — it fetches and parses `Layer__LineworkUrl` unguarded, so a null URL throws and the layer rejects. Guard it the way the fill already is, defaulting to empty segments, and change `boundsMm : lines.boundsMm` to `lines.boundsMm || layer.Layer__BoundsMm` — the manifest bounds already grow over face ring points, so for a fill-only layer they are the only correct bounds.

## 3. Existing / Proposed (REQ-23, REQ-24, REQ-34)

**Folders: siblings.** `SitePlan__DrawingData__Existing` and `SitePlan__DrawingData__Proposed` beside the legacy `SitePlan__DrawingData`, which is kept and never renamed. Nested folders are not merely unsupported — `discover_model_groups` only `iterdir()`s one level, so their files would never be enumerated and never reach R2, silently, and `build_r2_key` takes exactly one subfolder segment. Renaming the legacy folder is worse: the R2 sync never deletes, so the old objects would be stranded in the bucket while a cached ProjectData still pointed at them.

**The control.** A `naTvgb__SettingsGroup` "Site Plan Store" on the **Project** tab, between `#naTvgbSchemeGroup` and Project Structure, rendered as `naTvgb__SchemeRow` buttons — identical in shape and styling to the design phase rows, because Adam asked for "a similar folder setup to what we've got with the others" and because peers should look alike. Each row shows folder name, GLB count and last-written date. A third row appears only when a legacy flat folder exists, labelled "Unassigned (legacy)". Picking a store creates its folder if missing and says so in the status line — there are exactly two canonical folders and an empty one is harmless (`discover_truevision_siteplan_store` returns `None` for a folder with no GLBs), so a separate Create button would be ceremony.

**Persistence: on the model.** A new `site_plan_store` key in `NA_PROJECT_LINK_KEYS`, `Na__ProjectLink__BlankLink` and a new `Na__ProjectLink__WriteSitePlanStore`, exactly mirroring `WriteTargetPhase`. This is the opposite choice to the faces toggle, deliberately: the variant *is* a property of the .skp, as `target_phase_folder` is. A global default would mean opening the existing-site model and exporting it into the proposed folder because that is what was picked last. `Na__ProjectLink__Clear`'s existing loop already clears it on unlink, and `Na__ProjectLink__Write` does not touch it, so a re-link keeps it.

**Where the export goes.** A new `Na__SitePlan__ResolveExportFolder(config)`: when the model is linked *and* carries a known store, skip `UI.select_directory` entirely and write into `Na__PortalMapper__SitePlanFolderPath`; otherwise fall through to today's `Na__SitePlan__ChooseFolder`, then identify the store from the chosen basename (REQ-26 working even by hand). `ChooseFolder`'s `30__TrueVision__AppContent` special case descends into the model's chosen store when it has one, and into the legacy folder when it does not — every current workflow unchanged. `NA__SITEPLAN__PREFS_KEY_DIR` becomes variant-qualified so the two stores stop fighting over one remembered folder.

**The overwrite guard (REQ-34).** The design-phase guard protects against losing the *previous export of the same thing*; this one protects against the *wrong content in the right-looking folder*, so it has a different shape. `Na__SitePlan__GuardExportFolder(model, export_dir, store_id)` runs in Ruby — not in the JS modal, because the menu path has no JS — after the folder is resolved and before a byte is written. It reads any manifest already in the folder and compares `SitePlanData__StoreId` and `SitePlanData__SourceModelFile`:

- no manifest, or both match → **proceed silently**. The everyday re-export must not nag;
- store matches, model differs → `MB_YESNO`, naming the folder and both model files;
- store **differs** → **refuse outright**, naming both stores, the date and the model that last wrote the folder, and telling him to change the store on the Project tab. No way through. The design-phase guard offers a way through; this one does not, because the two folders are one click apart, the fix is trivial, and the cost of being wrong is a planning drawing that silently shows the wrong site. There is no legitimate reason to write a proposed export into the existing folder;
- `StoreId` absent (a v1 manifest) → fall back to `Na__PortalMapper__IdentifySitePlanStore(basename)`; the legacy folder belongs to no variant and proceeds.

The second half of REQ-34 comes free from the sibling-folder decision: the post-write stale sweep runs against `export_dir` only, so a proposed export can never offer to delete the existing store's GLBs. That is exactly the hazard that rules out "one folder, variant-suffixed filenames".

For the dialog to report a refusal honestly, `Na__SitePlan__Run` must stop returning a bare boolean and return `{ success:, refused:, message:, layers:, files:, removed:, warnings:, export_dir:, store_id: }`. **A Hash is truthy**, so `Na__UserInterface__ActionExportSitePlan`'s `succeeded = self.Na__PublicApi__ExportSitePlanData` would report every refusal as a success — the handler must read `result.is_a?(Hash) ? result[:success] : result == true`. And because the log session only wraps the write phase, the guard's decision must be re-stated with one `Na__Log__Puts` *inside* `Na__SitePlan__Write`, naming store and folder, or the export log will never say which variant it wrote.

## 4. The FILE PREFIX header bug

`Na__UserInterface__BuildModelStatus`'s local `project_prefix` is load-bearing — it builds the filenames in the manifest rows and is passed to `Na__ExportCore__PlanLinetypeLinework` — so it must keep using `Na__Helpers__ExtractProjectPrefix`. But the payload field `project_prefix:` is display-only (the sole JS use is `na__tvgb__setText('naTvgbProjectPrefix', …)`). So the fix is one changed line in the returned hash plus one small helper:

`project_prefix: self.Na__UserInterface__FilePrefixLabel(model, project_prefix, site_plan_tag_count)` — returns the model prefix when non-empty; else, when the model holds site plan tags, `Na__SitePlan__ProjectPrefix(model)` suffixed " (site plan)"; else "(none)". No JS change, no key rename, and the model-export filenames are untouched.

## 5. Manifest schema v2

`NA__SITEPLAN__SCHEMA_VERSION` → **2**, `NA__SITEPLAN__EXPORTER_VERSION` → **1.2.0**.

New store-level keys: `SitePlanData__StoreId`, `SitePlanData__StoreLabel`, `SitePlanData__FolderName`, `SitePlanData__ExportedPolygonFaces`. New per-layer keys: `Layer__ZIndexLine`, `Layer__ZIndexFill` (SC05, 1–10), `Layer__HatchPatternId`, `Layer__FillMaterialName`.

All four per-layer keys go at layer **top level, not inside `Layer__Style`**. `Layer__Style` is the *resolved paint of a line* and is already mirrored by `Na__SpStore__Style`'s seven-key rebuild and by `Na__LeEdge__SitePlanDefault`; a style sub-key survives the build script whole and then dies at `Na__SpStore__Style` (F8), so it needs an app-side edit anyway — and a top-level key needs exactly two registrations instead of three. `Layer__DrawOrder` **stays, unchanged, and remains the manifest sort key**: DrawOrder is the sort and the legacy compatibility axis, ZIndex* is the paint order and only TrueVision reads it. A reader that knows only DrawOrder behaves exactly as today.

`Layer__FillMaterialName` records the SketchUp material seen on a layer's faces (most common, nil when mixed), read in `Na__SitePlan__AddFace`. It is traceability only: per SC14 the SSOT's `SitePlan__FillOpacity` stays authoritative for alpha and no colour is written into the GLB, so there is still one source of truth.

**How a v1 manifest still reads.** The build script reads every new key with `entry.get(...)`/`meta.get(...)`, which yields `None` on v1 — no version gate, deliberately, because a gate is a second thing to keep in step. In the app, `Na__SpStore__SCHEMA` moves to 2 in the same release, and `Na__SpStore__Layer` gives each new field a documented default. The load-bearing one is a new `Na__SpStore__ZIndexFromDrawOrder(drawOrder)` = `clamp(ceil(drawOrder / 10), 1, 10)`, used when `Layer__ZIndexLine`/`Fill` are absent. PS01's real values map 20→2, 40→4, 70→7, 71→8, 90→9 — the fallback preserves today's *order*, which is all it has to do; it is for legacy data only and every SSOT tag gets an authored value.

## 6. Pipeline

**`ProjectVision__BuildScript__.py`** — `SITEPLAN_STORE_FOLDERS` (folder → store id) and `SITEPLAN_FOLDER_NAMES`; `discover_truevision_model_groups`'s `if entry == SITEPLAN_FOLDER_NAME` becomes `in SITEPLAN_FOLDER_NAMES` (**do this first**: unwidened, the new folders become ordinary modelGroups, sort after every DesignPhase folder, and TrueVision opens the project on flat site plan linework loaded as a 3D model). `discover_truevision_siteplan_store` gains `folder_name` and `store_id` parameters defaulted to today's values, the F6 fixes, the new per-layer keys, and five new store-level keys. Where a folder-derived store id and a manifest-declared one disagree, print a `[WARNING]` and **the folder wins** — that is the pipeline half of REQ-26. `generate_truevision_project_data` gains `SitePlan__DataStores` (keyed by store id) beside `SitePlan__DataStore`, which now points at **proposed if present, else existing, else legacy** — not the survey's suggested "existing first", because SC10 makes proposed the default an unbound viewport resolves to, and a warm PWA cache on an older build reads only the legacy key; they must paint the same drawing. Both keys are build-owned and must **not** join `TRUEVISION_DEV_OWNED_KEYS`, `DEV_OWNED_PROJECT_DATA_KEYS` or `Na__DevSavedKeys`.

**`CloudflareR2__ModelSync__Main__.py`** — one line: `if item.name == SITEPLAN_FOLDER_NAME and …` becomes `in SITEPLAN_FOLDER_NAMES`. Without it a store's GLBs upload and its manifest does not, so `SitePlan__ManifestUrl` 404s. `build_r2_key` needs nothing: it already uses `group['group_id']` as the one subfolder segment.

**`truevision_r2_worker.py`** — extend the fetch filter and the purge regex to an explicit **allow-list** (`purgeable_folder(folder)`), not a loosened regex; loosening removes the deliberate fence that stops a purge aiming at an arbitrary prefix. Doing this now matters because with two stores, syncing the wrong variant is a new plausible mistake whose only current remedy is the whole-project purge, which also deletes every design-phase model.

**Stale-file sweep patterns.** No new file suffix is introduced, so no pattern learns one. What both patterns *do* need is the same widening, in the same commit: `NA__SITEPLAN__OLD_FILE_PATTERN` and `SITEPLAN_FILE_PATTERN` both cap the stem at `[A-Za-z0-9]+`, so a multi-token stem such as `TrueVision__SitePlan__OsMapping__MinorStreets` — which Adam's new tag table produces — matches neither: its stale GLB is never swept and the build's fallback path rejects it. Widen both to `[A-Za-z0-9_]+`; the trailing `__(LineworkModel|FillModel)__\.glb$` anchor keeps the parse unambiguous. Add a comment in each naming the other: **these two regexes must always agree.**

## 7. Ruby house style

Match the file being edited, not a global rule: `SitePlanExport__.rb` uses the `# -----` / `# REGION |` dash form, `UserInterface__.rb` the `# =====` form. Every new method gets a `# FUNCTION |` / `# HELPER FUNCTION |` / `# ACTION HANDLER |` banner in caps, wrapped above and below by a `# ------------------------------------------------------------` rule, with the rationale as full-sentence `#` prose between banner and method, and `@param`/`@return` lines on multi-argument entry points. Naming stays `self.Na__<Domain>__<VerbPhrase>` — no new domain token is needed; everything belongs to `Na__SitePlan__`, `Na__PortalMapper__`, `Na__ProjectLink__`, `Na__ProjectActions__` or `Na__UserInterface__`. File-private constants are `NA__SITEPLAN__NAME`, frozen, with an aligned trailing `# <--` comment. Logging is `Na__Log__Puts` for ordinary lines and `Na__Log__Warn` for anything that must be seen, every site plan line prefixed `  [SitePlan] `. User messages stay plain English sentences that say what to do. Confirms are `UI.messagebox(text, MB_YESNO) == IDYES`. Each `self.Na__…` helper carries its own `rescue => e` returning a safe default with the message logged.

`Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json` keeps *its own* JSON style — `_documentation`, `_note`, `Description`, aligned colons — rather than the TrueVision app's three-stage `Meta__` convention, because consistency inside a file is what a reader relies on and every other block in that file already reads that way.

The DevLog entry goes at the **top** of `Na__TrueVision__GlbBuilder__Doc__DevLog__.md` in the shipped form (`# ---`, `### GLB Builder Utility - Version 2.11.0 - <date>`, `#### Title Case Headline`, `**Why**`, `**New:**`, `**Changed:** \`file\` (1.2.0)`), ending `**Not run in SketchUp.**` until Adam has run it. There is no Ruby interpreter on this machine: every change ships on a block-balance check, and **when the plugin change is ready, stop and ask Adam to run it.**

#### Files

| Action | Path | What |
|---|---|---|
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | NA__SITEPLAN__EXPORTER_VERSION -> '1.2.0'; NA__SITEPLAN__SCHEMA_VERSION -> 2; NA__SITEPLAN__CONFIG_DEFAULTS gains 'ExportPolygonFacesDefault' => false; NA__SITEPLAN__PREFS_KEY_FACES = 'SitePlanExportFaces'; NA__SITEPLAN__OLD_FILE_PATTERN stem widened [A-Za-z0-9]+ -> [A-Za-z0-9_]+. New methods: Na__SitePlan__ExportFacesEnabled?(config), Na__SitePlan__SetExportFaces(bool), Na__SitePlan__ResolveExportFolder(model, config), Na__SitePlan__GuardExportFolder(model, export_dir, store_id), Na__SitePlan__ReadFolderManifest(export_dir, config), Na__SitePlan__PrefsKeyDirFor(store_id), Na__SitePlan__FaceMaterialName(bucket). Changed: Na__SitePlan__Scan adds ctx[:all_faces]; Na__SitePlan__Collect face branch 'if bucket[:defn][:fills] \|\| ctx[:all_faces]'; Na__SitePlan__NewBucket adds :materials hash; Na__SitePlan__AddFace records face.material.name; Na__SitePlan__Write skips only when positions AND rings are both empty, writes linework conditionally, writes the fill whenever rings exist, logs the store and folder, emits Layer__ZIndexLine/ZIndexFill/HatchPatternId/FillMaterialName and SitePlanData__StoreId/StoreLabel/FolderName/ExportedPolygonFaces; Na__SitePlan__BuildLayerDefinitions reads SitePlan__ZIndexLine/ZIndexFill/HatchPatternId; Na__SitePlan__WriteFill adds asset.extras Na__SitePlanPayload='rings'; Na__SitePlan__Warnings rewords two strings; Na__SitePlan__SummaryText drops the defn[:fills] guard on the face count; Na__SitePlan__ChooseFolder descends into the model's store folder; Na__SitePlan__Run calls ResolveExportFolder + GuardExportFolder and returns a result Hash instead of a boolean. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__.rb` | Router: 'export_site_plan' now passes params_json. Na__UserInterface__ActionExportSitePlan(dialog, params_json = nil) parses the payload, writes the faces preference via Na__SitePlan__SetExportFaces, and reads result[:success] / result[:refused] from the returned Hash so a guard refusal reports as a refusal, not a success. New helper Na__UserInterface__FilePrefixLabel(model, model_prefix, site_plan_tag_count). BuildModelStatus: the payload's project_prefix value now comes from that helper (the local variable that builds filenames is unchanged) and the payload gains site_plan_export_faces. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilder__UserInterface__ProjectActions__.rb` | Na__UserInterface__HandleProjectAction gains "when 'set_site_plan_store' then self.Na__ProjectActions__SetSitePlanStore(dialog, params)" inside the case (below the @na_cloud_job guard). New Na__ProjectActions__SetSitePlanStore(dialog, params) - validates the id against Na__PortalMapper__SitePlanStoreById, refuses when unlinked, ensures the folder, writes the link, pushes project status + status line. Na__UserInterface__BuildProjectStatus gains site_plan_store and site_plan_stores, and its rescue fallback hash gains the same two keys. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectLink__.rb` | NA_PROJECT_LINK_KEYS gains 'site_plan_store'; Na__ProjectLink__BlankLink gains site_plan_store: ''. New Na__ProjectLink__WriteSitePlanStore(model, store_id) beside WriteTargetPhase. NOTE: the constant is inside `unless defined?(NA_PROJECT_LINK_DICT)`, so Reload Scripts will not refresh it - SketchUp must be restarted. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalMapper__.rb` | New: Na__PortalMapper__SitePlanStores, Na__PortalMapper__SitePlanFolderNames, Na__PortalMapper__SitePlanStoreById(store_id), Na__PortalMapper__IdentifySitePlanStore(folder_name), Na__PortalMapper__SitePlanFolderPath(project_root, store_id), Na__PortalMapper__EnsureSitePlanFolder(project_root, store_id), Na__PortalMapper__ListSitePlanStores(project_root), Na__PortalMapper__DescribeSitePlanFolder(folder_path, store). Changed: Na__PortalMapper__ListPhaseFolders skips every name in SitePlanFolderNames, not just one; Na__PortalMapper__BuildStructureTree emits one kind:'aside' row per present site plan folder with the store label in meta; Na__PortalMapper__FallbackConfig gains the SitePlanStores array. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json` | TrueVisionContent gains SitePlanStores (array of {StoreId, Label, FolderName, Description}) and _note prose; SitePlanFolderName is kept unchanged as the legacy name. Matches this file's own style (_documentation / _note / Description, aligned colons). |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiLayout__.html` | Export tab: new <div class="naTvgb__ActionGroup"> titled 'Site Plan Options' between Export Options and Export Actions, holding one naTvgb__OptionRow with input id="naTvgbExportPolygonFaces". Project tab: new <div class="naTvgb__SettingsGroup" id="naTvgbSitePlanGroup"> between #naTvgbSchemeGroup and Project Structure, with an h3 Title, a Desc paragraph and <div class="naTvgb__SchemeList" id="naTvgbSitePlanStoreList"></div>. No new CSS classes. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiBridge__.js` | na__tvgb__collectExportParams returns exportPolygonFaces. Na__Tvgb__ReceiveModelStatus sets the checkbox from status.site_plan_export_faces and shows status.project_prefix unchanged. naTvgbProject gains sitePlanStore and sitePlanStores. New Na__Tvgb__SelectSitePlanStore(storeId) dispatching 'set_site_plan_store' with {sitePlanStore}. New na__tvgb__renderSitePlanStoreList(), called from Na__Tvgb__ReceiveProjectStatus alongside the other renderers. window.Na__Tvgb__SelectSitePlanStore exported at the bottom of the FIRST IIFE. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\truevision_r2_worker.py` | New module constant SITEPLAN_FOLDER_NAMES and helper purgeable_folder(folder); the fetch branch's folder.startswith('DesignPhase') and the purge branch's re.fullmatch both go through it. Explicit allow-list, not a loosened regex. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | SitePlanExportConfig gains ExportPolygonFacesDefault (false) and ExportPolygonFacesNote, plus ZIndexNote and HatchPatternIdNote documenting the new per-tag fields. meta.version and meta.lastUpdated bumped. The per-tag SitePlan__ZIndexLine / SitePlan__ZIndexFill / SitePlan__HatchPatternId values themselves belong to the tags/SSOT design, not this one - this exporter reads them tolerantly and emits null when absent. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Doc__DevLog__.md` | New entry at the TOP: '### GLB Builder Utility - Version 2.11.0 - <date>' with Why / New / Changed (naming SitePlanExport__.rb 1.2.0) / 'Not run in SketchUp.', and an explicit line telling Adam a SketchUp RESTART is needed for the new ProjectLink key. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Doc__ReadMe__.md` | 'Site Plan Export (Tags 71-75)' section: document the Export Polygon Faces option, the Existing/Proposed store lock-in on the Project tab, the three folder names, and the refusal guard. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | New constants SITEPLAN_STORE_FOLDERS, SITEPLAN_STORE_LABELS, SITEPLAN_FOLDER_NAMES; SITEPLAN_FILE_PATTERN stem widened to [A-Za-z0-9_]+ with a comment naming NA__SITEPLAN__OLD_FILE_PATTERN. discover_truevision_model_groups skips every name in SITEPLAN_FOLDER_NAMES. discover_truevision_siteplan_store(project_path, year_folder_name, project_folder, folder_name=SITEPLAN_FOLDER_NAME, store_id=None): F6 has_line/has_fill gates on both the manifest and the fallback path, new per-layer keys Layer__ZIndexLine/Layer__ZIndexFill/Layer__HatchPatternId/Layer__FillMaterialName, new store-level keys SitePlan__StoreId/StoreLabel/SchemaVersion/PolygonFaces, and a folder-wins warning when the folder and manifest store ids disagree. generate_truevision_project_data gains siteplan_stores and writes SitePlan__DataStores. main() discovers each present store folder plus the legacy folder and picks the primary (proposed > existing > legacy) for SitePlan__DataStore. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\CloudflareR2__ModelSync__Main__.py` | New constant SITEPLAN_FOLDER_NAMES; discover_model_groups's manifest gate becomes 'if item.name in SITEPLAN_FOLDER_NAMES and (item / SITEPLAN_MANIFEST_FILENAME).is_file()'. No change to build_r2_key. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__DEVLOG__.md` | New '## Project Vision - Version 0.5.0 - <date>' entry: Why / per-script sections for BuildScript and ModelSync / Unchanged / Verification (the parser and manifest test run and its check count). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | Na__SpStore__SCHEMA -> 2. Na__SpStore__Layer: url() also accepts a layer with only a fill; the tail test becomes (LineworkUrl \|\| FillUrl); new fields Layer__ZIndexLine, Layer__ZIndexFill, Layer__HatchPatternId, Layer__FillMaterialName. New helper Na__SpStore__ZIndexFromDrawOrder(drawOrder) = clamp(ceil(drawOrder/10),1,10) used as the v1 fallback. Na__SpStore__LoadLayer guards the linework fetch/parse and falls back to layer.Layer__BoundsMm for bounds. Na__SpStore__Describe unchanged (still sorts on Layer__DrawOrder). |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanManifest__.test.mjs` | Node test covering, with no browser: the SITEPLAN_FILE_PATTERN / NA__SITEPLAN__OLD_FILE_PATTERN equivalence on single- and multi-token stems; the DrawOrder->ZIndex derivation against PS01's real 20/40/70/71/90; a v1 manifest fixture still producing layers; a fill-only layer surviving Na__SpStore__Layer. Na__SitePlan__GlbParse__.js must be copied to .mjs first - Node resolves .js in this tree as CommonJS. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` | New version entry at the top covering the Na__SitePlan__Store__.js schema-2 read, the fill-only layer support and the z-index fallback. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanComposites__.md` | Fill in section 9 (two stores) with this design; add the new decisions SC18-SC24 to section 2 (sibling folders; store on the model vs faces toggle in Sketchup defaults; refuse-don't-confirm on the wrong store; no triangle mesh file; new layer keys at top level not in Layer__Style; legacy SitePlan__DataStore points at proposed; schema 2); record the fifth F6 gate (Na__SpStore__LoadLayer) in section 3.3; add the phase rows to the section 12 ledger. |

#### New keys

- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__StoreId`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__StoreLabel`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__FolderName`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__ExportedPolygonFaces`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__Layers[] > Layer__ZIndexLine`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__Layers[] > Layer__ZIndexFill`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__Layers[] > Layer__HatchPatternId`
- `TrueVision__SitePlanData__Manifest__.json > SitePlanData__Layers[] > Layer__FillMaterialName`
- `TrueVision__ProjectData__.json > SitePlan__DataStores`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__StoreId`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__StoreLabel`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__FolderName`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__SchemaVersion`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__PolygonFaces`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__Layers[] > Layer__ZIndexLine`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__Layers[] > Layer__ZIndexFill`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__Layers[] > Layer__HatchPatternId`
- `TrueVision__ProjectData__.json > SitePlan__DataStores > <storeId> > SitePlan__Layers[] > Layer__FillMaterialName`
- `TrueVision__ProjectData__.json > SitePlan__DataStore > SitePlan__StoreId (and StoreLabel, FolderName, SchemaVersion, PolygonFaces, and the four new Layer__ keys - the legacy key carries the same shape)`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > SitePlanStores`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > SitePlanStores[] > StoreId`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > SitePlanStores[] > Label`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > SitePlanStores[] > FolderName`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > SitePlanStores[] > Description`
- `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json > TrueVisionContent > _note (extended to cover the store folders)`
- `Na__DataLib__CoreIndex__Tags__.json > SitePlanExportConfig > ExportPolygonFacesDefault`
- `Na__DataLib__CoreIndex__Tags__.json > SitePlanExportConfig > ExportPolygonFacesNote`
- `Na__DataLib__CoreIndex__Tags__.json > SitePlanExportConfig > ZIndexNote`
- `Na__DataLib__CoreIndex__Tags__.json > SitePlanExportConfig > HatchPatternIdNote`
- `JS -> Ruby dialog payload > exportPolygonFaces`
- `JS -> Ruby dialog payload > sitePlanStore`
- `Ruby -> JS model status > site_plan_export_faces`
- `Ruby -> JS project status > site_plan_store`
- `Ruby -> JS project status > site_plan_stores (rows of store_id, label, folder_name, folder_path, exists, glb_count, last_written, has_manifest, manifest_prefix, manifest_exported, is_legacy)`
- `SketchUp model attribute dictionary Na__TrueVision__GlbBuilder__ProjectLink > site_plan_store`
- `Sketchup defaults section TrueVision3D_GlbBuilder > SitePlanExportFaces`
- `Sketchup defaults section TrueVision3D_GlbBuilder > SitePlanExportDir__Existing`
- `Sketchup defaults section TrueVision3D_GlbBuilder > SitePlanExportDir__Proposed`

#### Order of work

1. 1. Portal config + PortalMapper store helpers, read-only. Add SitePlanStores to Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json and to Na__PortalMapper__FallbackConfig; add SitePlanStores / SitePlanFolderNames / SitePlanStoreById / IdentifySitePlanStore / SitePlanFolderPath / ListSitePlanStores / DescribeSitePlanFolder; widen Na__PortalMapper__ListPhaseFolders's skip to every site plan folder name; make Na__PortalMapper__BuildStructureTree emit one aside row per present store. TEST (Adam): hand-create SitePlan__DrawingData__Proposed in a test project, reopen the dialog - it must NOT appear in the scheme list or the Danger Zone picker, and MUST appear as a greyed aside in the structure tree. Nothing is written by this step. Do this FIRST: until it lands, a store folder is selectable as a model export target.
2. 2. The FILE PREFIX header fix. Add Na__UserInterface__FilePrefixLabel and change the one payload line in Na__UserInterface__BuildModelStatus. TEST (Adam): RB05 header reads 'RB05__ (site plan)' instead of '(none)'; a normal model is unchanged.
3. 3. ProjectLink site_plan_store. Add the key to NA_PROJECT_LINK_KEYS and BlankLink, add Na__ProjectLink__WriteSitePlanStore. TEST (Adam): RESTART SketchUp (Reload Scripts will not refresh the frozen constant), then confirm the key round-trips.
4. 4. The Project tab store block. UiLayout markup, UiBridge state + Na__Tvgb__SelectSitePlanStore + na__tvgb__renderSitePlanStoreList + the window export, Na__ProjectActions__SetSitePlanStore, and the two new fields on Na__UserInterface__BuildProjectStatus. TEST (Adam): pick Proposed - the folder is created, the row highlights, the status line says so; close and reopen the dialog and it is still picked.
5. 5. Export folder resolution and the REQ-34 guard. Na__SitePlan__ResolveExportFolder, Na__SitePlan__GuardExportFolder, Na__SitePlan__ReadFolderManifest, Na__SitePlan__PrefsKeyDirFor, the ChooseFolder store descent, Na__SitePlan__Run returning a Hash, and Na__UserInterface__ActionExportSitePlan reading result[:success]. TEST (Adam): with the model set to Proposed, export - no folder picker, files land in __Proposed. Then set it to Existing, put a proposed manifest in the existing folder by hand, and confirm the export is REFUSED with both stores named and the report panel says refused, not succeeded.
6. 6a. F6 in Ruby. Na__SitePlan__Write skips only when positions AND rings are empty; linework written conditionally; the two warning strings reworded; Na__SitePlan__SummaryText face count ungated. TEST (Adam): soften the boundary edges of one woodland face and export - the layer appears in the manifest with Layer__LineworkFile null and a fill file present.
7. 6b. F6 in the build script (both the manifest path and the no-manifest fallback). TEST locally: hand-edit a copy of PS01's manifest to null one Layer__LineworkFile, run the build against that project, and confirm the layer reaches SitePlan__DataStore with Layer__LineworkUrl null.
8. 6c. F6 in the app. Na__SpStore__Layer's tail test and the Na__SpStore__LoadLayer guard + bounds fallback. TEST locally: truevision-static-siteplan on 127.0.0.1:8523 with ?project=PS01&project-folder=PS01__MustersRoad&year=26 against the edited local manifest; then run node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs.
9. 7. Export Polygon Faces. SSOT default + NA__SITEPLAN__CONFIG_DEFAULTS entry + Na__SitePlan__ExportFacesEnabled?/SetExportFaces; ctx[:all_faces] through Scan and Collect; the fill-write condition; the UiLayout row, collectExportParams, the site_plan_export_faces status field and the ReceiveModelStatus checkbox restore; the router passing params_json. TEST (Adam): tick it, export, and confirm a fill GLB now exists for a non-fill tag that carries faces; untick, re-export, and confirm it is offered as stale.
10. 8. Manifest schema v2. Bump NA__SITEPLAN__SCHEMA_VERSION to 2 and NA__SITEPLAN__EXPORTER_VERSION to 1.2.0; emit the four store-level and four per-layer keys (reading the SSOT fields tolerantly, null when the tags work has not landed); bump Na__SpStore__SCHEMA to 2 and add the four fields plus Na__SpStore__ZIndexFromDrawOrder to Na__SpStore__Layer. TEST: PS01's existing v1 manifest still loads with no console error and paints identically.
11. 9. Two-store discovery in the build script. SITEPLAN_STORE_FOLDERS, the widened model-group skip, the folder_name/store_id parameters, SitePlan__DataStores, and the proposed>existing>legacy primary rule. TEST locally: build a project holding only the legacy folder and confirm the output is byte-identical to today; then add a __Proposed folder and confirm both keys appear and SitePlan__DataStore points at proposed.
12. 10. R2. The ModelSync manifest gate and the truevision_r2_worker allow-list. TEST: a dry run push showing the new folder's GLBs AND its manifest in the operation list.
13. 11. The two stale-sweep regexes widened together, plus Na__Test__SitePlanManifest__.test.mjs asserting they agree on single- and multi-token stems. Run the test and Na__Verify__Exports__.mjs.
14. 12. Documentation. The plugin DevLog entry at the top (2.11.0, module 1.2.0, 'Not run in SketchUp', and the RESTART note), the ProjectVision DEVLOG entry, the TrueVision DEVLOG entry, section 9 and the new SC decisions in TrueVision__PLAN__SitePlanComposites__.md, and the section 12 ledger rows marked only after Adam has proven each one.
15. 13. STOP and ask Adam to run the plugin in SketchUp. Nothing Ruby here can be executed or syntax-checked on this machine; every step above ships on a block-balance check only.

#### Risks

- NA_PROJECT_LINK_KEYS sits inside `unless defined?(NA_PROJECT_LINK_DICT)`. Reload Scripts will NOT pick up site_plan_store, so the choice reads as 'it didn't save' until SketchUp is restarted. Say this in the DevLog entry and when handing the change to Adam.
- There is no Ruby interpreter on this PC. Every Ruby change ships on a block-balance check and Adam's manual run - the plan doc's standing rule is to stop and ask him when a plugin change is ready.
- If Na__PortalMapper__ListPhaseFolders is not widened before a store folder exists, that folder shows in the scheme list as 'Unknown', is selectable as the model export target (so a model export writes mesh GLBs into a site plan store) and is offered in the Danger Zone delete picker. Step 1 must land first.
- Na__SitePlan__Run returning a Hash makes the existing truthiness test in Na__UserInterface__ActionExportSitePlan report every guard refusal as a success. The handler change is not optional and must land in the same commit.
- The dialog's running lock clears only on Na__Tvgb__ReceiveReport with running falsy, or on Na__Tvgb__ReceiveProjectStatus. set_site_plan_store must end on a project-status push or every button stays disabled until the dialog is reopened.
- na__tvgb__renderSitePlanStoreList must be called from Na__Tvgb__ReceiveProjectStatus, and Na__Tvgb__SelectSitePlanStore must be re-exported on window at the bottom of the FIRST IIFE. Miss either and the panel never repaints, or the inline onclick silently does nothing with no console anyone is watching.
- The R2 sync never deletes. Once a store folder name is on R2 it is permanent; the names must be agreed before the first push. The worker allow-list is the only remedy short of the whole-project purge, which also deletes every design-phase model.
- Widening one stem regex and not the other leaves the exporter and the build script disagreeing about which files are site plan files: the build warns about files the exporter refuses to clean. Change both in one commit and comment each naming the other.
- With the folder now resolved automatically, the post-write stale-file prompt will fire more often, and it is a native UI.messagebox that pops BEHIND the HtmlDialog. Behaviour is unchanged but more visible; moving it into the report panel is deliberately out of scope.
- determine_action compares local mtime to R2 LastModified, not content. A store folder restored from an archive with an older mtime reads as SKIP and the stale object stays on the CDN.
- SitePlan__DataStore and SitePlan__DataStores are build-owned. Adding either to TRUEVISION_DEV_OWNED_KEYS, DEV_OWNED_PROJECT_DATA_KEYS or Na__DevSavedKeys would freeze a stale store list on R2 forever. The instinct to apply the three-list rule here is wrong.
- Widening face collection to every site plan layer grows the fill GLB count from one file to potentially one per tag. Export time and R2 object count both rise; worth watching on RB05's 14 tags before Adam runs it on a large model.
- purge_project_glbs deletes every .glb under the whole content prefix but leaves the manifests, so after a purge a store manifest describes GLBs that are gone and the app's manifest fallback resolves to 404s. Not made worse here, but two stores double the exposure.

#### Rejected alternatives

- A separate triangulated face-mesh GLB (mode 4). Na__SpGlb__Primitives matches an exact mode and only requests LINES and LINE_LOOP, so a triangle file parses to an empty result with no thrown error - a file with no reader whose failure mode is silence. Both painters are vector and would show hairline seams at every shared edge, and REQ-14 needs a bounded outline to clip a hatch to, not a mesh. SC07 stands; asset.extras gains Na__SitePlanPayload='rings' so a future variant can be discriminated without a filename change.
- Nested store folders (SitePlan__DrawingData/Existing). ModelSync's discover_model_groups only iterdir()s one level, so the files would never be enumerated and never reach R2 - silently - and build_r2_key takes exactly one subfolder segment. Sibling folders cost two equality-test widenings.
- Both variants in one folder with variant-suffixed filenames. The post-write stale sweep is folder-wide, so exporting one variant would offer to delete the other variant's GLBs. Separate folders buy half of REQ-34 outright.
- Renaming the legacy SitePlan__DrawingData folder to __Existing or __Proposed. The R2 sync never deletes, so the rename would strand the old objects in the bucket while a cached ProjectData still pointed at them. The portal config already states the house rule: recognise older names, never rename a folder that exists on disk.
- Storing the Existing/Proposed choice as a Sketchup default. It is a property of the .skp, exactly as target_phase_folder is; a global default would export the existing-site model into the proposed folder because that is what was picked last.
- Storing the Export Polygon Faces toggle on the model (ProjectLink or ExportSelection). The Extensions menu path has no params channel, so only a shared Sketchup default keeps the two entry points in step; and ExportSelection's contract is filenames, pruned to known names, not booleans.
- Putting Layer__ZIndexLine/Fill, Layer__HatchPatternId and Layer__FillMaterialName inside Layer__Style. Layer__Style is the resolved paint of a line and is rebuilt as exactly seven keys by Na__SpStore__Style and mirrored by Na__LeEdge__SitePlanDefault; a style sub-key needs three registrations where a top-level layer key needs two.
- Re-using Layer__DrawOrder for the 1-10 z-index. Every published manifest carries 20/40/70/71/90 and would sort entirely above any new 1-10 value, so the red line would end on top of nothing. DrawOrder stays the sort key; ZIndex* is a separate paint-order axis with a documented derivation for legacy data.
- Pointing the legacy SitePlan__DataStore at the Existing store (the survey's recommendation). SC10 makes proposed the store an unbound viewport resolves to, and a warm PWA cache on an older build reads only the legacy key - they must paint the same drawing, so the legacy key points at proposed first.
- A <select> for the store. The design-phase lock-in Adam asked this to mirror is a list of naTvgb__SchemeRow buttons, and a row can show the folder's GLB count and last-written date, which is what makes the choice safe.
- Offering a way through the wrong-store guard, as the design-phase overwrite modal does. The two folders are one click apart, the fix is trivial, and the cost of being wrong is a planning drawing that silently shows the wrong site. There is no legitimate reason to write a proposed export into the existing folder.
- Loosening the r2 worker's purge regex to a general pattern instead of an allow-list. The regex is a deliberate fence against a purge aiming at an arbitrary prefix; naming the three folders keeps the fence.
- Adding a SitePlanData__SchemaVersion gate to the build script. Every new key is read with .get() and yields None on a v1 manifest; a version gate would be a second thing to keep in step for no gain. The only place the version matters is the app's console warning.
- Applying the TrueVision app's three-stage Meta__ JSON convention to Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json. That file has its own established style (_documentation / _note / Description, aligned colons) and consistency inside a file is what a reader relies on.
- A separate Create Folder button for the store, mirroring Create Scheme. There are exactly two canonical folders, an empty one is ignored by the build, and selection-creates is fewer controls for the same result.

#### Flagged for Adam

- Confirm the two folder names exactly - SitePlan__DrawingData__Existing and SitePlan__DrawingData__Proposed - before the first export creates one. The R2 sync never deletes, so once a name is in the bucket it is permanent and a later rename strands the old objects there forever.
- May the R2 Danger Zone purge tool be extended to reach site plan folders? It cannot today (the worker only sees folders starting with DesignPhase), so a mis-targeted store upload can only be cleared with the interactive whole-project purge, which also deletes every design-phase model. Extending it is an explicit allow-list, not a loosened regex - but it does widen what a destructive tool can reach.
- PS01 already holds a flat SitePlan__DrawingData folder. The design leaves it unassigned and untouched, so PS01 keeps painting exactly what it paints today. The alternative is adopting it as Proposed so it binds to the new default store - cheaper later, but it changes a live project's data on the next build. Which?

---

## design:ssot-tags

### Site Plan Tags + Materials SSOT: the complete 71_75__SitePlanTags__ rewrite (REQ-04 to REQ-10, REQ-15)

## 1. The stem question — a renamed TAG always keeps its old STEM

`SitePlan__ExportFileNameStem` becomes `Layer__CategoryKey`, and that key is the identity in six places I read by name: `Viewport__ModelLayers` (the off-map, bare keys), `Viewport__ProjectedEdges -> Edges__Categories`, the per-paint owner table (`Na__PlOwners__IdFor`), `Na__LeEdge__SitePlanDefault`'s `.find()`, `Na__LeModelLayers__Groups` and `Na__LeSource__CategoryKeys`. It is also the published GLB filename and the R2 object name. Changing it loses every saved viewport's layer toggles and edge overrides **silently and permanently** — `Na__LeRec__NormaliseViewport` exempts site plan categories from pruning, so the orphaned entry is kept forever while the new key quietly takes defaults.

**Decision: the stem is a wire identity, the tag name is an authoring label, and the two are decoupled from here on.** All five renames hold their stems:

| New tag name | Stem (unchanged) |
|---|---|
| `71__SitePlan__BaseMap__OsMapping__General` | `TrueVision__SitePlan__OsMapping` |
| `75__SitePlan__SoftLandscape__Trees__Existing` | `TrueVision__SitePlan__Trees` |
| `75__SitePlan__SoftLandscape__Trees__ToBeRemoved` | `TrueVision__SitePlan__TreesToRemove` |
| `73__SitePlan__Buildings__Proposed__NewConstruction` | `TrueVision__SitePlan__ProposedBuildings` |
| `73__SitePlan__Buildings__Proposed__Alterations` | `TrueVision__SitePlan__ProposedBuildingsSecondary` |

(The last two are Adam's own literal names from the "Ensure these are" table. Renaming them costs nothing because the stem holds, and *not* renaming them would drift from section 1. `ProposedSecondary` -> `Alterations` does change the layer's meaning from "a lighter second massing element" to "alterations to existing fabric"; because the style Adam specified — same colour, same weight, dashed — is exactly the alterations convention, I have taken the rename and flagged it.)

**What this means for the four new OsMapping-family tags.** They are new, so they take new stems, and the family is therefore *not* stem-symmetric: the parent keeps `OsMapping` while the three children get `OsMappingMainRoads`, `OsMappingMinorStreets`, `OsMappingMinorFeature`. Nothing may infer family membership from the stem — group by `SitePlan__LayerGroup` ("Base Map"), which is already what `Na__LeModelLayers__Groups` does.

**Hard constraint on every new stem, found by reading the code, not the survey:** `NA__SITEPLAN__OLD_FILE_PATTERN` (SitePlanExport.rb) and `SITEPLAN_FILE_PATTERN` (ProjectVision__BuildScript__.py line 60) both match `TrueVision__SitePlan__[A-Za-z0-9]+__(Linework|Fill)Model__\.glb`. **A stem containing `__` never matches**, so the stale-file sweep silently stops sweeping and the no-manifest fallback silently stops discovering. Every new stem must be a single CamelCase run.

## 2. The full final table

26 tags (18 existing, 8 genuinely new — note `75__SitePlan__SoftLandscape__HedgesAndPlanting` in Adam's "new" table **already exists**, so it is a restyle, not an addition). Weights: Adam's points converted at mm = pt x 0.352778, 3 dp (SC01). ZL = `SitePlan__ZIndexLine`, ZF = `SitePlan__ZIndexFill`, DO = `SitePlan__DrawOrder` (kept as a deprecated mirror, now always ZL x 10).

| Tag | Stem | Group | Colour | mm (pt) | Type | ZL | ZF | DO | Fill MAT | Op | Hatch | Scales |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 71 BaseMap__Contours | Contours | Base Map | MTE107 L85 | 0.13 | solid | 1 | 1 | 10 | - | - | - | [] |
| 71 BaseMap__OsMapping__MinorFeature *NEW* | OsMappingMinorFeature | Base Map | MTE104 L60 | 0.176 (0.50) | solid | 1 | 1 | 10 | - | - | - | 100,200,500 |
| 71 BaseMap__OsMapping__MinorStreets *NEW* | OsMappingMinorStreets | Base Map | MTE104 L60 | 0.265 (0.75) | solid | 1 | 1 | 10 | - | - | - | all |
| 73 SiteFeature__Paths *NEW* | SitePaths | Site Feature | MTE104 L60 | 0.265 (0.75) | solid | 1 | 1 | 10 | - | - | - | 100,200,500 |
| 71 BaseMap__OsMapping__General *RENAME* | OsMapping | Base Map | MTE103 L40 | 0.13 | solid | 2 | 2 | 20 | - | - | - | all |
| 71 BaseMap__Amendments | MapAmendments | Base Map | MTE103 L40 | 0.13 | solid | 2 | 2 | 20 | - | - | - | all |
| 71 BaseMap__OsMapping__MainRoads *NEW* | OsMappingMainRoads | Base Map | MTE103 L40 | 0.353 (1.0) | solid | 2 | 2 | 20 | - | - | - | all |
| 71 BaseMap__NeighbouringBuildings *NEW* | NeighbouringBuildings | Base Map | MTE103 L40 | 0.353 (1.0) | solid | 2 | 2 | 20 | - | - | - | all |
| 73 SiteFeature__Access *NEW* | SiteAccess | Site Feature | MTE103 L40 | 0.353 (1.0) | solid | 2 | 2 | 20 | - | - | - | 100,200,500 |
| 74 ExternalWorks__HardSurfaces | HardSurfaces | External Works | MTE103 L40 | 0.13 | solid | 2 | 2 | 20 | - | - | - | 100,200,500 |
| 74 ExternalWorks__ParkingAndAccess | ParkingAndAccess | External Works | MTE103 L40 | 0.18 | dashed-fine | 2 | 2 | 20 | - | - | - | 100,200,500 |
| 72 Boundary__WallsAndFences | WallsAndFences | Boundaries | MTE102 L20 | 0.25 | solid | 3 | 3 | 30 | - | - | - | 100,200,500 |
| 75 SoftLandscape__Trees__Existing *RENAME* | Trees | Soft Landscape | MTE202 Green | 0.265 (0.75) | solid | 4 | 4 | 40 | MAT801 | 1.00 | - | 100,200,500 |
| 75 SoftLandscape__Trees__MixedWoodland *NEW* | MixedWoodland | Soft Landscape | MTE202 Green | 0.265 (0.75) | solid | 4 | 4 | 40 | MAT801 | 1.00 | MixedWoodland | 100,200,500 |
| 75 SoftLandscape__HedgesAndPlanting *RESTYLE* | HedgesAndPlanting | Soft Landscape | MTE202 Green | 0.265 (0.75) | solid | 4 | 4 | 40 | MAT801 | 1.00 | - | 100,200,500 |
| 71 BaseMap__Waterbodies *NEW* | Waterbodies | Base Map | MTE205 Blue | 0.353 (1.0) | solid | **5** | **3** | 50 | MAT802 | 1.00 | PondsAndLakes | all |
| 73 Buildings__Existing *RESTYLE* | ExistingBuildings | Buildings | **MTE201 Red** | 0.529 (1.5) | solid | 5 | 5 | 50 | null | null | - | all |
| 73 Buildings__ToBeDemolished | BuildingsToBeDemolished | Buildings | MTE102 L20 | 0.25 | dashed | 5 | 5 | 50 | - | - | - | 100,200,500 |
| 74 ExternalWorks__DrainageAndServices | DrainageAndServices | External Works | MTE205 Blue | 0.18 | dotted | 6 | 6 | 60 | - | - | - | [] |
| 75 SoftLandscape__Trees__ToBeRemoved *RENAME* | TreesToRemove | Soft Landscape | MTE201 Red | 0.18 | dashed | 6 | 6 | 60 | - | - | - | 100,200,500 |
| 75 SoftLandscape__RootProtectionAreas | RootProtectionAreas | Soft Landscape | MTE202 Green | 0.18 | dashed | 6 | 6 | 60 | - | - | - | 100,200,500 |
| 73 Buildings__Proposed__Alterations *RENAME* | ProposedBuildingsSecondary | Buildings | MTE201 Red | 0.706 (2.0) | **dashed** | 7 | **6** | 70 | MAT803 | 0.10 | - | all |
| 73 Buildings__Proposed__NewConstruction *RENAME* | ProposedBuildings | Buildings | MTE201 Red | 0.706 (2.0) | solid | 7 | **7** | 70 | MAT803 | 0.10 | - | all |
| 72 Boundary__SettingOutLines | SettingOutLines | Boundaries | MTE201 Red | 0.13 | centre-fine | 9 | 9 | 90 | - | - | - | [] |
| 72 Boundary__BlueLine | BlueLineBoundary | Boundaries | MTE205 Blue | 0.50 | solid | 9 | 9 | 90 | - | - | - | all |
| 72 Boundary__RedLine | RedLineBoundary | Boundaries | MTE201 Red | 0.50 | solid | **10** | 10 | 100 | - | - | - | all |

"all" = `[100, 200, 500, 1250, 2500]`. The scale lists are widened in this same edit because `Na__LePanelViewport__AddSitePlan` switches a layer **off** when the viewport's denominator is absent from `Layer__VisibleAtScales`; adding 100/200/2500 to `SupportedScaleDenominators` without widening these arrays would make every 1:200 site plan open completely blank.

**The logic, in one paragraph.** The scale is "how much this line is allowed to win a collision", and Adam's five anchors are honoured literally: minor streets 1, roads 2, fences 3, buildings 5, red line 10. Below the anchors sits the quiet survey substrate (contours, minor features); at 2 sits everything that reads as ground-plane base map — roads, neighbouring outlines, hard surfaces, site access — because Adam gave three of those *identical* colour and weight and `Na__LeVp2d__StyleBands` merges identically-styled layers into one path (F2), so **no order between them is expressible and pretending otherwise would be a lie in the data**. That gives the governing invariant: *two site plan tags that share (LineColourId, LineWeightMm, LineType) must share a ZIndexLine.* Soft landscape sits at 4 and water at 5 so Adam's blue lake edge reads over the green woodland edge; fills invert that one pair (water 3, trees 4) so the woodland wash still covers the water wash, which is the whole of REQ-10 and the only reason two fields exist. Buildings occupy 5 (existing, demolished) and 7 (the proposal), which is the cure for F1: at 2.0 pt the proposal is 0.706 mm, heavier than the 0.50 mm red line, so under today's width sort it would paint *over* the boundary. Set-out and the blue line take 9, the red line alone takes 10, and 8 is left deliberately empty as headroom. `ZIndexFill` equals `ZIndexLine` everywhere except the two places the fill stack must differ (Waterbodies 5/3, Alterations 7/6). Ties inside a z-band break by ascending weight, then by store order — which is why MinorFeature (0.176) correctly falls under MinorStreets (0.265) at z 1 without needing a level of its own.

## 3. Fill colour source — a new MAT800 series and `SitePlan__FillMaterialId`

Adam's three fills are not edge-material colours and `Na__SitePlan__EdgeHexIndex` only indexes `Na__DataLib__CoreIndex__EdgeMaterials`. Adding them as MTE entries would be wrong twice: they are face colours, and (F4) `Na__LeEdge__AliasForHex` would then need three new rows in `LayoutEditor__EdgeStyles__Colours` for colours that are never a line. REQ-07 asks for SketchUp **face** materials anyway, so the Materials SSOT is the right home and one source serves both.

New block `MAT800__SitePlanFillSeries__`, opaque per SC14 (alpha lives only in `SitePlan__FillOpacity`):

```json
        "MAT800__SitePlanFillSeries__": {
            "MAT801__SitePlanFill__SoftLandscape__Green": {
                "SketchUpName"       : "MAT801__SitePlanFill__SoftLandscape__Green",
                "Description"        : "Site plan soft landscape wash -- pale green for woodland, tree canopies, hedges and planting beds. Painted on the flat 2D faces of the 75__SitePlan__SoftLandscape tags. FULLY OPAQUE in SketchUp by design: TrueVision applies the drawing transparency from SitePlan__FillOpacity in the Tags SSOT, so the model shows the true ink and the drawing shows the wash.",
                "BaseColor"          : "rgb(220, 237, 207)",
                "Opacity"            : 1.0,
                "PbrRoughness"       : 1.0,
                "PbrMetallic"        : 0.0,
                "EnvMapIntensity"    : 0.0,
                "AoExclude"          : true,
                "ProfileLineExclude" : true
            },
            "MAT802__SitePlanFill__Waterbodies__Blue": {
                "SketchUpName"       : "MAT802__SitePlanFill__Waterbodies__Blue",
                "Description"        : "Site plan waterbody wash -- pale blue for ponds, lakes and the wet side of a watercourse. Painted on the faces of 71__SitePlan__BaseMap__Waterbodies. Fully opaque in SketchUp; the drawing transparency is SitePlan__FillOpacity.",
                "BaseColor"          : "rgb(186, 228, 253)",
                "Opacity"            : 1.0,
                "PbrRoughness"       : 1.0,
                "PbrMetallic"        : 0.0,
                "EnvMapIntensity"    : 0.0,
                "AoExclude"          : true,
                "ProfileLineExclude" : true
            },
            "MAT803__SitePlanFill__Proposal__Red": {
                "SketchUpName"       : "MAT803__SitePlanFill__Proposal__Red",
                "Description"        : "Site plan proposal wash -- pure red for new construction and proposed alterations. Painted on the faces of the 73__SitePlan__Buildings__Proposed tags. Fully opaque in SketchUp; the drawing wash is rgba(255, 0, 0, 0.1), the alpha coming from SitePlan__FillOpacity 0.10 (REQ-15).",
                "BaseColor"          : "rgb(255, 0, 0)",
                "Opacity"            : 1.0,
                "PbrRoughness"       : 1.0,
                "PbrMetallic"        : 0.0,
                "EnvMapIntensity"    : 0.0,
                "AoExclude"          : true,
                "ProfileLineExclude" : true
            }
        },
```

MAT804 is left free for a hard-surfaces wash. These are ordinary indexed materials, not `MAT000E__` exempt, because they are opaque; and because `Na__MaterialUtils__LoadAllNobleArchitectureMaterials` selects `:all_non_default`, **the new series is created in SketchUp with no plugin change** — Adam just runs "Load All Noble Architecture Materials". (An optional `Na__MaterialUtils__LoadSitePlanFillMaterials` with `NA_SITEPLAN_FILL_SERIES_KEY = 'MAT800__SitePlanFillSeries__'` would give it its own menu item; not required.)

**Resolution in the Ruby exporter.** A new index function mirroring the edge one, plus a small parser:

- `Na__SitePlan__ParseRgbString(text)` — matches `/\Argb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\z/i` and returns `"#RRGGBB"` upcased, or `nil`.
- **`Na__SitePlan__FaceHexIndex(material_data)`** — walks `material_data['Na__DataLib__CoreIndex__Materials']`, each series, each entry; for every entry whose `BaseColor` parses, stores `index[key] = hex`. Same shape and same failure mode as `Na__SitePlan__EdgeHexIndex`.

`Na__SitePlan__BuildLayerDefinitions(tags_data, edge_data, material_data)` then resolves with an explicit precedence — `SitePlan__FillMaterialId` wins, `SitePlan__FillColourId` remains as the legacy edge-palette route:

```ruby
    fill_mat = entry['SitePlan__FillMaterialId']
    fill_id  = entry['SitePlan__FillColourId']
    fill_hex = fill_mat ? face_hex_by_id[fill_mat] : (fill_id ? hex_by_id[fill_id] : nil)
    Na__Log__Warn "  [SitePlan] #{name}: SitePlan__FillMaterialId '#{fill_mat}' is not in the Materials SSOT" if fill_mat && fill_hex.nil?
```

and the style hash gains `'FillMaterialId' => fill_mat` and `'FillHatchId' => entry['SitePlan__FillHatchId']` beside the existing `FillHex`/`FillOpacity`. `Na__SitePlan__Scan` loads the third DataLib file with the cache key `:materials`, which already exists in `Na__DataLib__CacheData__.rb`.

## 4. Five representative entries, in the file's exact style

Alignment: keys padded to 31 characters, then `:`, then one space — the column set by `"EdgePainting__AdvancedSwapOff"`. Field order follows the existing entries, with the new `SitePlan__` fields slotted in place.

```json
            "71__SitePlan__BaseMap__OsMapping__General": {
                "Tag__SketchUpName"            : "71__SitePlan__BaseMap__OsMapping__General",
                "Tag__Description"             : "OS or map-provider mapping imported as DXF - the general run of the base map: kerbs, plot boundaries, street furniture, everything the three specific OS Mapping tags do not claim. Group the import and tag the group; the raw edges inside stay Untagged. Renamed from 71__SitePlan__BaseMap__OsMapping on 20-Sep-2026 - the export stem is deliberately unchanged, so every drawing already made keeps its layer toggles and its style overrides.",
                "Glb__ExportRangeNumbers"      : null,
                "Glb__FullyExcluded"           : true,
                "EdgePainting__AdvancedSwapOff": true,
                "Layout__EdgeColourRGB"        : [102, 102, 102],
                "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__OsMapping",
                "SitePlan__LegacyTagNames"     : ["71__SitePlan__BaseMap__OsMapping"],
                "SitePlan__LayerLabel"         : "OS Mapping - General",
                "SitePlan__LayerGroup"         : "Base Map",
                "SitePlan__DrawOrder"          : 20,
                "SitePlan__ZIndexLine"         : 2,
                "SitePlan__ZIndexFill"         : 2,
                "SitePlan__ExportFills"        : false,
                "SitePlan__LineColourId"       : "MTE103__LineColour__DarkGrey__L40",
                "SitePlan__LineType"           : "solid",
                "SitePlan__LineWeightMm"       : 0.13,
                "SitePlan__FillColourId"       : null,
                "SitePlan__FillMaterialId"     : null,
                "SitePlan__FillOpacity"        : null,
                "SitePlan__FillHatchId"        : null,
                "SitePlan__VisibleAtScales"    : [100, 200, 500, 1250, 2500]
            },
            "71__SitePlan__BaseMap__OsMapping__MinorStreets": {
                "Tag__SketchUpName"            : "71__SitePlan__BaseMap__OsMapping__MinorStreets",
                "Tag__Description"             : "Minor streets, service roads, private drives and back lanes taken from the OS base map. The quietest road line on the drawing: mid grey at 0.75 pt, Z-index 1, so everything else crosses over it.",
                "Glb__ExportRangeNumbers"      : null,
                "Glb__FullyExcluded"           : true,
                "EdgePainting__AdvancedSwapOff": true,
                "Layout__EdgeColourRGB"        : [153, 153, 153],
                "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__OsMappingMinorStreets",
                "SitePlan__LayerLabel"         : "OS Mapping - Minor Streets",
                "SitePlan__LayerGroup"         : "Base Map",
                "SitePlan__DrawOrder"          : 10,
                "SitePlan__ZIndexLine"         : 1,
                "SitePlan__ZIndexFill"         : 1,
                "SitePlan__ExportFills"        : false,
                "SitePlan__LineColourId"       : "MTE104__LineColour__MidGrey__L60",
                "SitePlan__LineType"           : "solid",
                "SitePlan__LineWeightMm"       : 0.265,
                "SitePlan__FillColourId"       : null,
                "SitePlan__FillMaterialId"     : null,
                "SitePlan__FillOpacity"        : null,
                "SitePlan__FillHatchId"        : null,
                "SitePlan__VisibleAtScales"    : [100, 200, 500, 1250, 2500]
            },
            "71__SitePlan__BaseMap__Waterbodies": {
                "Tag__SketchUpName"            : "71__SitePlan__BaseMap__Waterbodies",
                "Tag__Description"             : "Ponds, lakes, reservoirs and the wet side of a watercourse, drawn as closed faces at ground level with the face painted MAT802. The blue outline sits at Z-index 5, above every green landscape line, so a lake edge running through woodland reads as water; the fill sits at 3, below the landscape washes, so the woodland pattern still covers the water where they overlap. That split is the whole reason line and fill carry separate Z-indices.",
                "Glb__ExportRangeNumbers"      : null,
                "Glb__FullyExcluded"           : true,
                "EdgePainting__AdvancedSwapOff": true,
                "Layout__EdgeColourRGB"        : [30, 136, 229],
                "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__Waterbodies",
                "SitePlan__LayerLabel"         : "Waterbodies",
                "SitePlan__LayerGroup"         : "Base Map",
                "SitePlan__DrawOrder"          : 50,
                "SitePlan__ZIndexLine"         : 5,
                "SitePlan__ZIndexFill"         : 3,
                "SitePlan__ExportFills"        : true,
                "SitePlan__LineColourId"       : "MTE205__LineColour__Blue",
                "SitePlan__LineType"           : "solid",
                "SitePlan__LineWeightMm"       : 0.353,
                "SitePlan__FillColourId"       : null,
                "SitePlan__FillMaterialId"     : "MAT802__SitePlanFill__Waterbodies__Blue",
                "SitePlan__FillOpacity"        : 1.00,
                "SitePlan__FillHatchId"        : "SitePlanHatch__PondsAndLakes",
                "SitePlan__VisibleAtScales"    : [100, 200, 500, 1250, 2500]
            },
            "75__SitePlan__SoftLandscape__Trees__MixedWoodland": {
                "Tag__SketchUpName"            : "75__SitePlan__SoftLandscape__Trees__MixedWoodland",
                "Tag__Description"             : "Blocks of mixed woodland drawn as closed faces at ground level, filled pale green and hatched with the OS mixed woodland symbol. Use this for a wood or a copse read as one mass; use Trees - Existing for individual canopies with a stem mark.",
                "Glb__ExportRangeNumbers"      : null,
                "Glb__FullyExcluded"           : true,
                "EdgePainting__AdvancedSwapOff": true,
                "Layout__EdgeColourRGB"        : [67, 160, 71],
                "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__MixedWoodland",
                "SitePlan__LayerLabel"         : "Mixed Woodland",
                "SitePlan__LayerGroup"         : "Soft Landscape",
                "SitePlan__DrawOrder"          : 40,
                "SitePlan__ZIndexLine"         : 4,
                "SitePlan__ZIndexFill"         : 4,
                "SitePlan__ExportFills"        : true,
                "SitePlan__LineColourId"       : "MTE202__LineColour__Green",
                "SitePlan__LineType"           : "solid",
                "SitePlan__LineWeightMm"       : 0.265,
                "SitePlan__FillColourId"       : null,
                "SitePlan__FillMaterialId"     : "MAT801__SitePlanFill__SoftLandscape__Green",
                "SitePlan__FillOpacity"        : 1.00,
                "SitePlan__FillHatchId"        : "SitePlanHatch__MixedWoodland",
                "SitePlan__VisibleAtScales"    : [100, 200, 500]
            },
            "73__SitePlan__Buildings__Proposed__Alterations": {
                "Tag__SketchUpName"            : "73__SitePlan__Buildings__Proposed__Alterations",
                "Tag__Description"             : "Proposed alterations to existing fabric, shown as a dashed red roof outline over a 10 percent red wash. Draw closed FACES at ground level: the face is the fill, its edges the outline. Renamed from 73__SitePlan__Buildings__ProposedSecondary on 20-Sep-2026 - the export stem is unchanged, so every drawing already made keeps its toggles and overrides.",
                "Glb__ExportRangeNumbers"      : null,
                "Glb__FullyExcluded"           : true,
                "EdgePainting__AdvancedSwapOff": true,
                "Layout__LineStyleName"        : "Dash",
                "Layout__EdgeColourRGB"        : [229, 57, 53],
                "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__ProposedBuildingsSecondary",
                "SitePlan__LegacyTagNames"     : ["73__SitePlan__Buildings__ProposedSecondary"],
                "SitePlan__LayerLabel"         : "Proposed - Alterations",
                "SitePlan__LayerGroup"         : "Buildings",
                "SitePlan__DrawOrder"          : 70,
                "SitePlan__ZIndexLine"         : 7,
                "SitePlan__ZIndexFill"         : 6,
                "SitePlan__ExportFills"        : true,
                "SitePlan__LineColourId"       : "MTE201__LineColour__Red",
                "SitePlan__LineType"           : "dashed",
                "SitePlan__LineWeightMm"       : 0.706,
                "SitePlan__FillColourId"       : null,
                "SitePlan__FillMaterialId"     : "MAT803__SitePlanFill__Proposal__Red",
                "SitePlan__FillOpacity"        : 0.10,
                "SitePlan__FillHatchId"        : null,
                "SitePlan__VisibleAtScales"    : [100, 200, 500, 1250, 2500]
            },
```

## 5. `SitePlanExportConfig`, `ExportExclusions`, meta

`SitePlanExportConfig` keeps every existing key, changes `SupportedScaleDenominators` to `[100, 200, 500, 1250, 2500]`, rewrites `StyleUnitsNote`, and gains:

```json
        "ZIndexRange"                : [1, 10],
        "ZIndexNote"                 : "SitePlan__ZIndexLine and SitePlan__ZIndexFill are the drawing's stacking order, 1 furthest from the reader and 10 nearest. They are TWO fields because the two stacks genuinely differ: a waterbody's blue outline must read over a woodland's green outline (line 5 over line 4) while the woodland's wash must still cover the water's wash (fill 4 over fill 3). The red line boundary is 10 and nothing else may be. 8 is left empty as headroom.",
        "ZIndexCollisionRule"        : "The drawing editor merges layers that resolve to the same colour, weight and line type into one SVG path, so no order between them can be drawn. Two site plan tags sharing SitePlan__LineColourId, SitePlan__LineWeightMm and SitePlan__LineType must therefore share a SitePlan__ZIndexLine. Inside one Z-index the lighter line is drawn first, so a finer member of a band still falls under a heavier one without needing a level of its own.",
        "DrawOrderDeprecatedNote"    : "SitePlan__DrawOrder is retained only so a manifest exported before 20-Sep-2026 still orders correctly: readers derive a Z-index from it as round(DrawOrder / 10), clamped to 1-10. Every entry now carries DrawOrder equal to ZIndexLine x 10, so the two can never disagree. Author the Z-index; never the draw order.",
        "LineWeightUnitsNote"        : "SitePlan__LineWeightMm is PAPER millimetres. Weights are authored in LayOut points and converted at mm = pt x 0.352778, rounded to three decimals: 0.50 pt = 0.176, 0.75 pt = 0.265, 1.00 pt = 0.353, 1.50 pt = 0.529, 2.00 pt = 0.706. The drawing editor turns the millimetres into a factor on the sheet master lineweight, so its Weight__Max must be at least 10.00 for 0.706 mm to print true at the 0.30 pt master.",
        "MaterialsSsotFile"          : "Na__DataLib__CoreIndex__Materials__.json",
        "FillMaterialsNote"          : "SitePlan__FillMaterialId names a MAT entry in the Materials SSOT and is the source of a layer's fill colour; SitePlan__FillColourId is the older route through the EdgeMaterials SSOT and is used only where a fill genuinely reuses a line colour. When both are set the material wins. SketchUp face materials are FULLY OPAQUE: the drawing transparency lives only in SitePlan__FillOpacity, so the model reads true and the drawing reads as a wash.",
        "FillHatchNote"              : "SitePlan__FillHatchId names a pattern in the drawing editor's hatch pattern library (52__LayoutEditor__HatchPatternLibrary). null means a flat wash with no pattern. The hatch belongs to the LAYER, not to a viewport, because it is a property of what the thing IS - a woodland is hatched as woodland on every drawing it appears on.",
        "LegacyTagNamesNote"         : "SitePlan__LegacyTagNames lists older SketchUp names for the same layer. Geometry on a legacy name lands in the same GLB as the canonical one, so a model tagged up before the tag was renamed still exports. The export is per STEM, never per tag name, which is why two names can never write the same file twice.",
        "StemStabilityNote"          : "SitePlan__ExportFileNameStem is an identity, not a label. It is the GLB filename, the R2 object name and the runtime Layer__CategoryKey that every saved viewport's layer toggles and style overrides are keyed by. A tag may be renamed at will; its stem never changes. It must also be a single alphanumeric run with no double underscore, because the stale-file sweep and the no-manifest discovery both match TrueVision__SitePlan__[A-Za-z0-9]+__(LineworkModel|FillModel)__.glb.",
```

`ExportExclusions` — both `FullyExcludedTagNames` and `AdvancedSwapOffTagNames` go from 18 site plan entries to **31** in each list: keep all 18 present names (the five old ones stay, exactly as the `AdvancedSwapOffNote` already promises for legacy names), then add the 5 new canonical names and the 8 new tags. Full addition list for both, in file order: `71__SitePlan__BaseMap__OsMapping__General`, `71__SitePlan__BaseMap__OsMapping__MainRoads`, `71__SitePlan__BaseMap__OsMapping__MinorStreets`, `71__SitePlan__BaseMap__OsMapping__MinorFeature`, `71__SitePlan__BaseMap__NeighbouringBuildings`, `71__SitePlan__BaseMap__Waterbodies`, `73__SitePlan__Buildings__Proposed__NewConstruction`, `73__SitePlan__Buildings__Proposed__Alterations`, `73__SitePlan__SiteFeature__Access`, `73__SitePlan__SiteFeature__Paths`, `75__SitePlan__SoftLandscape__Trees__Existing`, `75__SitePlan__SoftLandscape__Trees__MixedWoodland`, `75__SitePlan__SoftLandscape__Trees__ToBeRemoved`. `FullyExcludedNote` gains a sentence saying legacy names are listed too.

`meta.version` 2.3.2 -> **2.4.0**, `meta.lastUpdated` "20-Sep-2026". `meta.fieldPrefixes.SitePlan__` is rewritten to name the five new fields and to say that fill colour now comes from the Materials SSOT while line colour still comes from EdgeMaterials. The `71_75__SitePlanTags__` block's own `Tag__Description` gains the Z-index and legacy-name sentences. Materials SSOT `meta.version` 1.4.3 -> **1.5.0**.

## 6. Other readers that break, and what each needs

**Ruby, `Na__TrueVision__GlbBuilder__SitePlanExport__.rb` — the one real code change.** Today `Na__SitePlan__Collect` buckets by *tag name* (`ctx[:buckets][owner]`, `owner = ctx[:layers].key?(tag_name) ? tag_name : current_tag`). With a legacy alias in the layer map, the old and new names would each open a bucket, both carrying the same stem, and `Na__SitePlan__Write` would write the same GLB twice and emit two manifest records with the same `Layer__CategoryKey`. The fix is the one the Linetype exporter already made: **bucket by stem**. `Na__SitePlan__BuildLayerDefinitions` returns `[by_tag, by_stem]`, with legacy names fanned out into `by_tag` pointing at the same definition object; `ctx[:layers]` stays `by_tag` (it is what recognises a tag name), `owner` becomes `by_tag[tag_name][:stem]`, and `Na__SitePlan__NewBucket`, `CountSkipped`, `Warnings`, `SummaryText` and `Write` all key by stem, printing `bucket[:defn][:tag_name]` where a human name is wanted. `unused` in `SummaryText` becomes `by_stem.keys - buckets.keys`. `Na__SitePlan__Scan` also loads the Materials file and passes it to BuildLayerDefinitions. `Na__SitePlan__Write` adds `Layer__ZIndexLine` / `Layer__ZIndexFill` to each record and sorts `records.sort_by! { [ZIndexLine, TagName] }`. `NA__SITEPLAN__EXPORTER_VERSION` 1.1.1 -> **1.2.0**; **`NA__SITEPLAN__SCHEMA_VERSION` stays 1** — the manifest only gains keys, and bumping it makes every app older than this release print a "newer than this app reads" warning for no benefit.

**`ProjectVision__BuildScript__.py`** — `discover_truevision_siteplan_store`'s per-layer whitelist must gain `'Layer__ZIndexLine'` and `'Layer__ZIndexFill'`; `Layer__Style` is copied whole (`entry.get('Layer__Style')`) so `FillMaterialId` and `FillHatchId` ride through untouched (F8's good half). `SITEPLAN_FILE_PATTERN` needs no change *provided* the stem rule above is obeyed.

**`CloudflareR2__ModelSync__Main__.py`** — no change; `GLB_FILE_PATTERN` is `^.+\.glb$`.

**`Na__SitePlan__Store__.js`** — two registrations, both mandatory or the work dies here (F8). `Na__SpStore__Style` currently rebuilds exactly seven keys: add `FillMaterialId : text(style.FillMaterialId, null)` and `FillHatchId : text(style.FillHatchId, null)`. `Na__SpStore__Layer` adds `Layer__ZIndexLine` / `Layer__ZIndexFill`, each clamped 1-10, each falling back through a new helper `Na__SpStore__ZFromDrawOrder(drawOrder)` = `Math.min(10, Math.max(1, Math.round((Number.isFinite(drawOrder) ? drawOrder : 50) / 10)))`. On PS01's frozen manifest that yields OsMapping 2, ExistingBuildings 4, ProposedBuildings 7, RedLineBoundary 9 — the new hierarchy, near enough, with the red line still on top. `Na__SpStore__Describe`'s sort becomes `(a, b) => (a.Layer__ZIndexLine - b.Layer__ZIndexLine) || (a.Layer__DrawOrder - b.Layer__DrawOrder)`.

**`Na__LayoutEditor__EdgeStyles__.js`** — no signature change. `Na__LeEdge__SitePlanDefault` already divides `LineWeightMm` by the 0.10584 mm master, but 0.706 / 0.10584 = **6.67**, above today's `Weight__Max` 6.00, so `Na__LeEdge__ClampWeight` would silently print Adam's proposal at 0.635 mm (F3). All five colours Adam uses are already in the nine-row alias whitelist (F4), so **no new `LayoutEditor__EdgeStyles__Colours` row is needed** — but `MAT801`/`802`/`803` must never be handed to `Na__LeEdge__AliasForHex`, which is why they resolve to `FillHex` in Ruby and never reach the line path.

**`Na__LayoutEditor__ModelLayers__.js` / `Panel__ModelLayers__.js` / `ModelSource__.js`** — no change: site plan rows are built from the live store, so the eight new layers and the new "Site Feature" group appear on their own. Saved viewports keep their toggles because the stems held.

**`Na__LayoutEditor__Viewport2d__Linework__.js` :: `Na__LeVp2d__StyleBands`** — not this pass's code, but this pass defines its input. It needs a site-plan branch whose band key is `hex|width|dash|zLine` and whose sort is `(zLine asc, widthMm asc)`, so that two layers differing only in z survive as two bands while genuinely identical ones still merge. `Na__LeVp2d__PaintSitePlan` and `Na__LePdf__DrawSitePlanFills` must order fills by `ZIndexFill`. Flagging it here so nobody wires the new field to the store sort alone and declares REQ-08 done (F1).

**`Na__LayoutEditor__SheetRecords__.js`** — deliberately **no** change. The Z-index is a property of what a layer *is*, not a per-viewport preference, so it does not join `Na__LeRec__NormaliseProjectedEdges`'s four-key rebuild. If Adam later wants per-viewport z, that is a fifth key there and a fifth key in the overrides UI.

**`Na__LayoutEditor__ModelLayers__Config__.json`** — `Meta__SsotVersionRead` "2.3.2" -> "2.4.0". Documentary only; the file carries no site plan rows.

**`Na__LayoutEditor__EdgeStyles__Config__.json`** — `Meta__SsotVersionRead` "2.0.0" -> **"2.1.0"** (it has been stale by one minor since the EdgeMaterials SSOT moved; fixed here because this is the commit that makes the file wrong in a way that matters). `Weight__Max` 6.00 -> **10.00**, and `Weight__Description` rewritten: "The ceiling is 10.00 so a 2.00 pt site plan proposal outline (0.706 mm, 6.67 at the 0.30 pt master) prints true; nothing else is near it." Widening a clamp is safe — no stored record is above 6.00 today.

**`Na__TrueVision__GlbBuilder__TagsManager__.rb` and `Main__.rb`** — no change. `BuildTagsFromDataLib` creates one tag per entry from `Tag__SketchUpName` and ignores the legacy array, and `SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/` already matches every new name for both the model-export exclusion and the dialog's tag count.

#### Files

| Action | Path | What |
|---|---|---|
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json` | meta.version 2.3.2 -> 2.4.0; meta.lastUpdated -> 20-Sep-2026; meta.fieldPrefixes.SitePlan__ prose rewritten to name SitePlan__ZIndexLine, SitePlan__ZIndexFill, SitePlan__FillMaterialId, SitePlan__FillHatchId, SitePlan__LegacyTagNames and to say fill colour now resolves through Na__DataLib__CoreIndex__Materials__.json while line colour still resolves through EdgeMaterials. 71_75__SitePlanTags__ rewritten in full: 5 tag keys renamed in place (OsMapping->OsMapping__General, Trees->Trees__Existing, TreesToRemove->Trees__ToBeRemoved, Proposed->Proposed__NewConstruction, ProposedSecondary->Proposed__Alterations) each keeping its SitePlan__ExportFileNameStem and gaining SitePlan__LegacyTagNames; 8 new entries added (71__SitePlan__BaseMap__OsMapping__MainRoads / __MinorStreets / __MinorFeature, 71__SitePlan__BaseMap__NeighbouringBuildings, 71__SitePlan__BaseMap__Waterbodies, 73__SitePlan__SiteFeature__Access, 73__SitePlan__SiteFeature__Paths, 75__SitePlan__SoftLandscape__Trees__MixedWoodland); every one of the 26 entries gains SitePlan__ZIndexLine, SitePlan__ZIndexFill, SitePlan__FillMaterialId and SitePlan__FillHatchId; SitePlan__DrawOrder reset to ZIndexLine x 10 everywhere; SitePlan__VisibleAtScales widened to [100,200,500,1250,2500] or [100,200,500]; restyles per Adam's table on 73__SitePlan__Buildings__Existing (MTE201, 0.529), both Proposed tags (0.706, red MAT803 fill at 0.10, Alterations dashed) and 75__SitePlan__SoftLandscape__HedgesAndPlanting + Trees__Existing (0.265, MAT801 fill). ExportExclusions.FullyExcludedTagNames and ExportExclusions.AdvancedSwapOffTagNames each go from 18 to 31 site plan entries (old names kept, 5 new canonical names + 8 new tags added); FullyExcludedNote gains a legacy-names sentence. SitePlanExportConfig: SupportedScaleDenominators -> [100,200,500,1250,2500], StyleUnitsNote rewritten, and new keys ZIndexRange, ZIndexNote, ZIndexCollisionRule, DrawOrderDeprecatedNote, LineWeightUnitsNote, MaterialsSsotFile, FillMaterialsNote, FillHatchNote, LegacyTagNamesNote, StemStabilityNote. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Materials__.json` | meta.version 1.4.3 -> 1.5.0, meta.lastUpdated -> 20-Sep-2026. New series block MAT800__SitePlanFillSeries__ inserted between MAT700__GlassSeries__ and MAT900__SceneEntourageSeries__, holding MAT801__SitePlanFill__SoftLandscape__Green rgb(220, 237, 207), MAT802__SitePlanFill__Waterbodies__Blue rgb(186, 228, 253) and MAT803__SitePlanFill__Proposal__Red rgb(255, 0, 0) - all Opacity 1.0, PbrRoughness 1.0, PbrMetallic 0.0, EnvMapIntensity 0.0, AoExclude true, ProfileLineExclude true, each Description stating that the SketchUp material is opaque and that the drawing wash comes from SitePlan__FillOpacity. MAT804 left free for a future hard-surfaces wash. |
| edit | `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb` | NA__SITEPLAN__EXPORTER_VERSION 1.1.1 -> 1.2.0 (NA__SITEPLAN__SCHEMA_VERSION stays 1). New Na__SitePlan__ParseRgbString(text) and new Na__SitePlan__FaceHexIndex(material_data) beside Na__SitePlan__EdgeHexIndex. Na__SitePlan__BuildLayerDefinitions(tags_data, edge_data, material_data) now returns [by_tag, by_stem], fans SitePlan__LegacyTagNames entries into by_tag pointing at the same definition, resolves FillHex through FillMaterialId first then FillColourId with a warn on an unresolved material id, and adds 'FillMaterialId' and 'FillHatchId' to the style hash plus :z_line / :z_fill to the definition. Na__SitePlan__Scan loads Na__DataLib__CoreIndex__Materials__.json via Na__SitePlan__LoadDataLibFile(..., :materials), stores both maps in ctx, and keeps ctx[:excluded] rejecting every name in by_tag. Na__SitePlan__Collect sets owner to by_tag[tag_name][:stem] so buckets are keyed by STEM, never by tag name. Na__SitePlan__CountSkipped, Na__SitePlan__Warnings and Na__SitePlan__SummaryText re-keyed by stem, printing bucket[:defn][:tag_name] for human output; SummaryText's unused list becomes by_stem.keys - buckets.keys. Na__SitePlan__Write adds 'Layer__ZIndexLine' and 'Layer__ZIndexFill' to each record and sorts records by [ZIndexLine, TagName]. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py` | discover_truevision_siteplan_store: add 'Layer__ZIndexLine' : entry.get('Layer__ZIndexLine') and 'Layer__ZIndexFill' : entry.get('Layer__ZIndexFill') to the per-layer whitelist dict, and the same two keys to the no-manifest fallback branch's layer dict. Layer__Style is already copied whole so FillMaterialId / FillHatchId need no entry. SITEPLAN_FILE_PATTERN unchanged. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js` | Na__SpStore__Style: add FillMaterialId : text(style.FillMaterialId, null) and FillHatchId : text(style.FillHatchId, null) to the rebuilt key set (was exactly 7 keys, now 9). New helper Na__SpStore__ZFromDrawOrder(drawOrder) returning Math.min(10, Math.max(1, Math.round((Number.isFinite(drawOrder) ? drawOrder : 50) / 10))). Na__SpStore__Layer: add Layer__ZIndexLine and Layer__ZIndexFill, each read from the raw record when finite and clamped 1-10, otherwise from Na__SpStore__ZFromDrawOrder(raw.Layer__DrawOrder). Na__SpStore__Describe: sort becomes (a, b) => (a.Layer__ZIndexLine - b.Layer__ZIndexLine) \|\| (a.Layer__DrawOrder - b.Layer__DrawOrder). |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json` | Meta__Version 1.1.0 -> 1.2.0. Meta__SsotVersionRead "2.0.0" -> "2.1.0" (stale by one minor against Na__DataLib__CoreIndex__EdgeMaterials__.json). LayoutEditor__EdgeStyles__Weight.Weight__Max 6.00 -> 10.00 and Weight__Description rewritten to cite the 2.00 pt site plan proposal outline (0.706 mm = 6.67 at the 0.30 pt master) instead of the 0.50 mm red line. No new row in LayoutEditor__EdgeStyles__Colours - all five colours the new tags use are already aliased. |
| edit | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__Config__.json` | Meta__Version 1.1.1 -> 1.1.2 and Meta__SsotVersionRead "2.3.2" -> "2.4.0". Documentary only: the file carries no site plan rows, which are built at runtime from the store. |
| create | `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__SitePlanTagsSsot__.test.mjs` | New Node test that reads Na__DataLib__CoreIndex__Tags__.json directly and asserts the SSOT invariants this design creates: (1) every entry carrying SitePlan__ExportFileNameStem has integer SitePlan__ZIndexLine and SitePlan__ZIndexFill in 1..10; (2) every stem is unique and matches /^TrueVision__SitePlan__[A-Za-z0-9]+$/; (3) no two entries share (SitePlan__LineColourId, SitePlan__LineWeightMm, SitePlan__LineType) while differing in SitePlan__ZIndexLine (the merge rule); (4) SitePlan__DrawOrder === SitePlan__ZIndexLine * 10; (5) every SitePlan__LineColourId exists in Na__DataLib__CoreIndex__EdgeMaterials__.json AND its hex appears in Na__LayoutEditor__EdgeStyles__Config__.json's Colours list (the F4 black-line trap); (6) every SitePlan__FillMaterialId exists in Na__DataLib__CoreIndex__Materials__.json with a parseable rgb() BaseColor and Opacity 1.0; (7) every canonical and legacy site plan tag name appears in both ExportExclusions lists; (8) SitePlan__LineWeightMm / 0.10584 <= EdgeStyles Weight__Max; (9) every non-empty SitePlan__VisibleAtScales is a subset of SitePlanExportConfig.SupportedScaleDenominators. |

#### New keys

- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<entry>.SitePlan__ZIndexLine`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<entry>.SitePlan__ZIndexFill`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<entry>.SitePlan__FillMaterialId`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<entry>.SitePlan__FillHatchId`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.<entry>.SitePlan__LegacyTagNames`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__OsMapping__General`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__OsMapping__MainRoads`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__OsMapping__MinorStreets`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__OsMapping__MinorFeature`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__NeighbouringBuildings`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.71__SitePlan__BaseMap__Waterbodies`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.73__SitePlan__SiteFeature__Access`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.73__SitePlan__SiteFeature__Paths`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.73__SitePlan__Buildings__Proposed__NewConstruction`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.73__SitePlan__Buildings__Proposed__Alterations`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.75__SitePlan__SoftLandscape__Trees__Existing`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.75__SitePlan__SoftLandscape__Trees__MixedWoodland`
- `Na__DataLib__CoreIndex__Tags.71_75__SitePlanTags__.75__SitePlan__SoftLandscape__Trees__ToBeRemoved`
- `SitePlanExportConfig.ZIndexRange`
- `SitePlanExportConfig.ZIndexNote`
- `SitePlanExportConfig.ZIndexCollisionRule`
- `SitePlanExportConfig.DrawOrderDeprecatedNote`
- `SitePlanExportConfig.LineWeightUnitsNote`
- `SitePlanExportConfig.MaterialsSsotFile`
- `SitePlanExportConfig.FillMaterialsNote`
- `SitePlanExportConfig.FillHatchNote`
- `SitePlanExportConfig.LegacyTagNamesNote`
- `SitePlanExportConfig.StemStabilityNote`
- `Na__DataLib__CoreIndex__Materials.MAT800__SitePlanFillSeries__`
- `Na__DataLib__CoreIndex__Materials.MAT800__SitePlanFillSeries__.MAT801__SitePlanFill__SoftLandscape__Green`
- `Na__DataLib__CoreIndex__Materials.MAT800__SitePlanFillSeries__.MAT802__SitePlanFill__Waterbodies__Blue`
- `Na__DataLib__CoreIndex__Materials.MAT800__SitePlanFillSeries__.MAT803__SitePlanFill__Proposal__Red`
- `SitePlanData__Layers[].Layer__ZIndexLine`
- `SitePlanData__Layers[].Layer__ZIndexFill`
- `SitePlanData__Layers[].Layer__Style.FillMaterialId`
- `SitePlanData__Layers[].Layer__Style.FillHatchId`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexLine`
- `SitePlan__DataStore.SitePlan__Layers[].Layer__ZIndexFill`

#### Order of work

1. 1. Materials SSOT first, on its own. Add MAT800__SitePlanFillSeries__ with MAT801/802/803, bump meta.version to 1.5.0. Testable immediately and with no dependency: open SketchUp, run Noble 3D Modelling Tools > Load All Noble Architecture Materials (it selects :all_non_default, so the new series needs no plugin change) and confirm three new materials appear in the Materials tray at the right colours and fully opaque.
2. 2. Tags SSOT, structure only. Rename the five tag keys in place, keep every stem, add SitePlan__LegacyTagNames to each, add the eight new entries, add SitePlan__ZIndexLine / ZIndexFill / FillMaterialId / FillHatchId to all 26, reset SitePlan__DrawOrder to ZIndexLine x 10, widen SitePlan__VisibleAtScales, apply the Buildings and Soft Landscape restyles with the converted point weights. Do NOT touch ExportExclusions or SitePlanExportConfig yet. Testable: `node -e "JSON.parse(require('fs').readFileSync(p,'utf8'))"` parses, and a quick script proves 26 entries, 26 unique stems, and that every stem matches /^TrueVision__SitePlan__[A-Za-z0-9]+$/.
3. 3. Tags SSOT, the surrounding blocks. ExportExclusions FullyExcludedTagNames and AdvancedSwapOffTagNames grow to 31 site plan entries each; SitePlanExportConfig gains the ten new keys and the widened SupportedScaleDenominators; meta.version -> 2.4.0, lastUpdated, fieldPrefixes prose, block Tag__Description. Testable by the same parse plus a set-difference script proving every canonical and legacy site plan name is in both lists.
4. 4. Write Na__Test__SitePlanTagsSsot__.test.mjs and make it pass. This is the gate: it encodes every invariant above (unique stems, the merge rule, DrawOrder === ZIndexLine x 10, colour aliases resolvable, material ids resolvable and opaque, weights inside Weight__Max, scales a subset). Run it BEFORE any Ruby is touched, so a later edit that breaks the data is caught by a test rather than by a silent black line in a drawing.
5. 5. TrueVision config bumps, which step 4's test depends on. Na__LayoutEditor__EdgeStyles__Config__.json: Meta__SsotVersionRead -> 2.1.0, Weight__Max -> 10.00, Weight__Description rewritten, Meta__Version -> 1.2.0. Na__LayoutEditor__ModelLayers__Config__.json: Meta__SsotVersionRead -> 2.4.0. Testable: the weight assertion in step 4 flips from fail to pass, and `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` still passes (no JS changed yet).
6. 6. Ruby exporter, the bucket-by-stem refactor ALONE, with no new fields. Change Na__SitePlan__BuildLayerDefinitions to return [by_tag, by_stem], fan out SitePlan__LegacyTagNames, make owner the stem, re-key buckets / skipped / warnings / summary by stem. Bump NA__SITEPLAN__EXPORTER_VERSION to 1.2.0. Stop and ask Adam to run Export Site Plan on RB05: the file list and the manifest must be byte-for-byte the same shape as before apart from the version, and a model still carrying an OLD tag name must land in the SAME GLB as the new one. This is the step most likely to write a file twice if it is done wrong, so it is proved on its own.
7. 7. Ruby exporter, the new data. Add Na__SitePlan__ParseRgbString and Na__SitePlan__FaceHexIndex, load the Materials SSOT in Na__SitePlan__Scan, resolve FillHex through FillMaterialId with a warn on a miss, add FillMaterialId and FillHatchId to the style hash and Layer__ZIndexLine / Layer__ZIndexFill to the record, sort records by [ZIndexLine, TagName]. Stop and ask Adam to re-export RB05. Testable by reading the written manifest: the woodland layer must carry FillHex #DCEDCF, FillOpacity 1.0, FillHatchId SitePlanHatch__MixedWoodland, ZIndexLine 4, ZIndexFill 4.
8. 8. Python build script whitelist: two keys in two places. Testable with --dry-run-check against PS01 and then a real run against RB05, reading SitePlan__DataStore in TrueVision__ProjectData__.json to confirm the z keys and the style sub-keys arrived.
9. 9. TrueVision store: Na__SpStore__Style's two new keys, Na__SpStore__ZFromDrawOrder, Na__SpStore__Layer's two new fields, Na__SpStore__Describe's two-key sort. Run Na__Verify__Exports__.mjs. Testable in the browser at http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 (127.0.0.1, never app.localhost, so the local repo manifest wins): PS01's frozen pre-z manifest must derive OsMapping 2, ExistingBuildings 4, ProposedBuildings 7, RedLineBoundary 9 from the fallback and paint exactly as it does today.
10. 10. Hand off. The painter work (Na__LeVp2d__StyleBands's z-ordered site plan branch with the hex|width|dash|zLine band key, and the fill ordering in Na__LeVp2d__PaintSitePlan and Na__LePdf__DrawSitePlanFills) is a separate design pass and must not be folded in here - but nothing in REQ-08 is visible on a drawing until it lands, so say so plainly in the plan doc's section 12 ledger rather than marking the Z-index row done.

#### Risks

- The biggest one: after all of this, nothing changes on screen. Layer__ZIndexLine reaches TrueVision and is sorted on in the store, but linework paint order is decided by Na__LeVp2d__StyleBands's ascending stroke-width sort (F1), which this pass does not touch. Adam will re-export RB05, open it, and see his 2.0 pt proposal painting over his 0.50 mm red line exactly as before. The ledger row for REQ-08 must not be marked done, and Adam must be told the painter pass is what makes it visible.
- Bucketing by stem instead of tag name is the one genuinely risky code change. Get it half-right - buckets by stem but warnings or skipped counts still by tag name - and the summary dialog Adam reads before every export silently stops reporting on renamed layers. Steps 6 and 7 are deliberately split so this is proved alone.
- Adam's table makes 73__SitePlan__Buildings__Existing red at 1.5 pt, where it is currently soft black at 0.25 mm. That is a six-fold weight increase and a colour change on the one layer that has ever produced a real fill GLB. It is his literal spec and I have applied it, but it will look like a mistake the first time he opens PS01.
- Leaving 73__SitePlan__Buildings__Existing with a null fill (Adam: 'none') means the fill code path stays unexercised (F5) until RB05 is exported with real woodland or water faces. If RB05's woodland boundaries are soft or smooth edges, F6 says the layer exports NOTHING at all - no linework, no record, no manifest entry - and the whole fill story silently has no data behind it. Check the GlbBuilder export log's per-layer skipped-edge counts before concluding the SSOT is wrong.
- Widening SupportedScaleDenominators to include 100, 200 and 2500 without widening every SitePlan__VisibleAtScales array in the same edit would make any new 1:200 site plan viewport open with every layer switched off, because Na__LePanelViewport__AddSitePlan writes off[key] = false for any layer whose scale list omits the viewport's denominator. The two edits must not be separated.
- A new stem containing a double underscore breaks two regexes silently: NA__SITEPLAN__OLD_FILE_PATTERN stops offering to sweep stale GLBs and SITEPLAN_FILE_PATTERN stops discovering files on the no-manifest fallback. Neither errors; both just stop working. The step-4 test asserts the stem shape for exactly this reason.
- PS01 and PS02's published manifests were exported against SSOT 2.3.0 and will now be two minors behind 2.4.0. Their Layer__CategoryKey values all survive the renames because the stems held, so nothing breaks - but any comparison of PS01's data against the SSOT will show phantom differences until Adam re-exports, and the DrawOrder fallback gives PS01 a red line at z 9 rather than 10.
- MAT801/802/803 are face colours and must never reach Na__LeEdge__AliasForHex, whose nine-row whitelist silently paints an unknown hex BLACK (F4). They are safe only because Ruby resolves them into FillHex and the line path never sees them - a future refactor that unifies the two colour lookups would reintroduce the trap.
- Two of Adam's five renames (Proposed -> Proposed__NewConstruction, ProposedSecondary -> Proposed__Alterations) are taken from his style table rather than his rename table, and 'Secondary' meant a lighter massing element while 'Alterations' means existing fabric being altered. If he wanted both concepts he now has one tag doing two jobs.
- The exporter's Project tab header still reports FILE PREFIX (none) on RB05 because Na__Helpers__ExtractProjectPrefix and Na__SitePlan__ProjectPrefix use different regexes. Harmless to this pass, but Adam will be told '(none)' immediately before an export that correctly writes RB05__ files, which reads as a failure of this work.

#### Rejected alternatives

- Renaming the stem with the tag (TrueVision__SitePlan__OsMappingGeneral etc.). Rejected: the stem is Layer__CategoryKey, which keys Viewport__ModelLayers, Viewport__ProjectedEdges, the owner table, Na__LeEdge__SitePlanDefault, Na__LeModelLayers__Groups and Na__LeSource__CategoryKeys. Every saved viewport would lose its toggles and overrides with no error, and Na__LeRec__NormaliseViewport's site-plan pruning exemption would keep the orphan forever. It would also orphan every GLB already on R2.
- Redefining SitePlan__DrawOrder as the 1-10 scale, as REQ-08's wording suggests. Rejected on the cross-cutting finding's evidence: PS01's published manifest keeps 20/40/70/71/90, which would sort entirely above any new 1..10 value and put the red line beneath everything. Two new keys plus a documented round(DrawOrder / 10) fallback degrades correctly instead.
- A single Z-index field. Rejected because Adam's own last bullet is unsatisfiable with one ordering: the water LINE must be above the tree LINE while the tree FILL is above the water FILL. That is SC05, and it is the only reason the field is doubled.
- Adding MTE entries to the EdgeMaterials SSOT for the three fill colours. Rejected twice over: they are face colours, not line colours, so they have no business in an edge palette; and any new MTE referenced by a tag would also need a matching row in LayoutEditor__EdgeStyles__Colours in the same commit or it paints black (F4). REQ-07 asks for SketchUp face materials anyway, so the Materials SSOT serves both the model and the drawing from one source.
- Replacing SitePlan__FillColourId with SitePlan__FillMaterialId. Rejected: FillColourId is one of the seven keys Na__SpStore__Style rebuilds and one of the eleven the build script carries, and removing it is a wider blast radius than adding beside it. It stays for any fill that genuinely reuses a line colour; the material id takes precedence when both are set.
- Putting the hatch id on the viewport (a Viewport__ProjectedEdges-style override). Rejected on Adam's own table, which binds 'Mixed Woodland' to the woodland tag and 'Ponds & Lakes' to the waterbodies tag: a hatch is a property of what the thing IS, so it travels with the layer. It also avoids Na__LeRec__NormaliseProjectedEdges, which rebuilds each category as exactly four keys and would silently drop a fifth (F8). A per-use scale and rotation (REQ-19) can still be a viewport override later without moving the identity.
- Giving MainRoads, NeighbouringBuildings and SiteFeature__Access three different Z-indices. Rejected because Adam gave all three the same colour, weight and line type, and Na__LeVp2d__StyleBands collapses identically-styled layers into ONE path (F2). A distinct z would be data that no painter could honour. The same reasoning ties MinorStreets to SiteFeature__Paths, and the three green landscape layers to each other.
- Bumping NA__SITEPLAN__SCHEMA_VERSION from 1 to 2. Rejected: the manifest only gains keys, and Na__SpStore__Find prints a console warning for any schema above Na__SpStore__SCHEMA. A stale PWA cache serving the previous app against a new manifest would warn for no reason. The exporter version bump records the change honestly.
- Adding SitePlan__LineWeightPt beside SitePlan__LineWeightMm to preserve Adam's authored points. Rejected: nothing would consume it, and SitePlan__LineWeightMm is read by name in four places. The conversion factor and the five standard values are recorded in SitePlanExportConfig.LineWeightUnitsNote instead, where the next agent will actually find them.
- Leaving 75__SitePlan__SoftLandscape__Trees__Existing at its current 0.18 mm and MTE202-at-0.35 fill. Rejected: it would print a tree canopy thinner than the hedge beside it and wash it a different green from the woodland behind it, in a drawing whose whole purpose here is a coherent fill system. It takes 0.265 mm and MAT801 like its two siblings.

#### Flagged for Adam

- 73__SitePlan__Buildings__Existing becomes RED at 1.5 pt (from soft black at 0.25 mm) because that is exactly what your 'Ensure these are' table says. Existing buildings in red is unusual - confirm you meant the built form to read red throughout, with weight and fill separating existing from proposed, rather than MTE102 soft black.
- Your style table names 73__SitePlan__Buildings__Proposed__NewConstruction and __Alterations, but the shipped tags are __Proposed and __ProposedSecondary. I have renamed them to your names (stems held, so nothing downstream moves) and relabelled Secondary as 'Alterations'. If you still want a separate LIGHTER SECOND MASSING tag as well as an alterations one, that is a ninth new tag, not a rename.
- 03__Placeholder and 04__Placeholder in 52__LayoutEditor__HatchPatternLibrary are still unnamed. Not blocking this pass (SitePlan__FillHatchId only names patterns in 05__SitePlanHatches), but naming them before the pattern pass is cheaper than renaming folders later.

---

# Judge verdicts

## Judge 1 - winner: **svgpattern**

| Approach | Score | Why | Fatal flaw |
|---|---|---|---|
| svgpattern | 8 | PDF half is verified-correct and its architectural wiring is the only one that survives contact with the real code. Every jsPDF claim checks out: four trap sites only, clipEvenOdd/path/fillEvenOdd/discardPath/moveTo/lineTo/curveTo/circle all untrapped, transformScaleY handles y-down compat mm, putStyle(null) lets paths compose. It names LayoutEditor__Linework__MinSegmentPaperMm exactly and correctly scopes the 0.05 cull to DrawLinework's classes loop. It is the ONLY design that gets the cache right: built.key IS Na__LeVp2d__SitePlanToken and IS the BandPaths 16-entry FIFO key (Viewport2d__Linework__.js 338-348), so folding the hatch token into the paint key only is verified-correct. It fixes the existing dropped-inner-ring bug at PdfExporter:253 and shares one RingPath between the fill and its hatch, so fill and hatch cut the same holes. Screen cost is one <path> plus one <pattern> per layer regardless of polygon count, and patternUnits/patternContentUnits/patternTransform are all in the HTML parser's SVG attribute-adjustment table so they survive innerHTML exactly as Na__LeGrad__SvgPaint's gradientUnits already does. Ink__WeightFactor matches the house rule stated in EdgeStyles' Meta__WhereWeightGoes. Marked down for: hanging the hatch off fills[] entries (SitePlanBuild:165 filters on FillHex && FillOpacity > 0, so a FillHex-null layer such as PS01's ExistingBuildings can never be hatched - this contradicts REQ-14 and forces a manifest hand-edit to do its own H0); a tile-only budget; unstated PDF operator batching; and an unstated lattice phase for the PDF tile loop. | - |
| geometry | 7 | The better PDF craftsman, undone by two verified wiring errors. Its PDF construction is genuinely superior: one composed path per pen with a single doc.stroke() (putStyle(null) at 4485 confirms this composes; the existing DrawLinework emits m/l/S per segment via doc.line -> lines(...,'S'), so batching is a real operator-count win), the state-before-moveTo rule is correct PDF, restoreGraphicsState in a finally matches Na__LeGrad__DrawPdf verbatim, and a dual Budget__MaxStrokes 60000 + MaxTiles 20000 is the correctly-shaped guard because stroke count, not tile count, drives stream size. It alone identifies the lattice-anchor trap (anchor at model 0,0, with a Node test that shifts the clip box one tile step) and it alone builds the hatch list independently of the fills filter, which makes PS01's FillHex-null ExistingBuildings hatchable with no manifest edit. But: it instructs appending the hatch token to Na__LeVp2d__SitePlanToken, which line 167 shows IS built.key, which line 210 feeds to Na__LeVp2d__BandPaths keying a 16-entry FIFO shared with every architectural viewport - every hatch scale change would evict linework path strings app-wide. Its file list never rewrites DrawSitePlanFills, so its hatch cuts holes the fill beneath does not. Its anti-<pattern> viewBox argument is wrong (patternTransform scale(D) resolves model-mm vs paper-mm in one attribute). Its 557 MB A2 raster figure is a strawman - nobody rasterises a whole sheet - though its 4.2 Mpx per-polygon figure is fair. And 14,000 path segments per repaint per layer against one <path> is a real screen cost it accepts too readily. | - |

**Verdict.** Winner: svgpattern, 8 to 7, and it should be the base the implementer starts from - but four of geometry's ideas must be grafted before a line is written, one of them load-bearing.

Both designs reached the same PDF verdict and both reached it honestly. I re-derived it from the vendored jspdf.umd.js rather than trusting either: grep finds exactly four advancedApiModeTrap call sites - addShadingPattern (2210), beginTilingPattern (2223), endTilingPattern (2238) and text()'s Matrix parameter (3821). Nothing else is trapped. API.clip (4308), clipEvenOdd (4329), discardPath (4342), close (4401), stroke, fill/fillEvenOdd (4444), moveTo (4564), lineTo (4580), curveTo (4601), path (4732) and circle (4917) are all plain out() wrappers. Crucially moveTo/lineTo/curveTo route y through transformScaleY = scale(getPageHeight() - y) in COMPAT, so an exporter that speaks y-down paper millimetres - which this one does throughout - can emit an arbitrary even-odd multi-ring clip and arbitrary stroked geometry today with no mode switch and no coordinate inversion. putStyle(null) returns early (4485), so a path can be composed across hundreds of calls and painted once. Na__LePdf__BeginClip already proves nested compat clipping (rect(...,null) then clip() then discardPath()), and Na__LeGrad__DrawPdf proves the save/clip/discard/restore-in-a-finally idiom. So: vectors, not raster, and certainly not jsPDF tiling. Both got it right; neither earns points over the other on the headline question.

The separation is in the wiring, and there the code is unambiguous. Na__LeVp2d__SitePlanBuild line 167 returns key : Na__LeVp2d__SitePlanToken(viewport); Na__LeVp2d__PaintSitePlan line 210 passes built.key + '@false@' + styleToken to Na__LeVp2d__BandPaths; and Na__LeVp2d__BandPaths (Viewport2d__Linework__.js 338-348) is a 16-entry FIFO shared with every architectural viewport in the app. svgpattern predicted this exactly and put the hatch token in SitePlanPaintKey only, spelling out why. geometry instructs the implementer to append it to SitePlanToken - which would make every hatch scale nudge flush linework path strings for unrelated viewports, and would read to Adam as unexplained sluggishness rather than as a hatch bug. That is not a difference of taste; one design read the code and the other inferred.

The second separation is the hole bug. PdfExporter line 253 really is if (!ring.outer || !ring.points || ring.points.length < 6) return, with a candid comment admitting a hole is not cut on paper. svgpattern rebuilds DrawSitePlanFills on the same Na__LeHatchPdf__RingPath it uses for the hatch clip, painted with fillEvenOdd - one path serving fill and hatch, bug fixed in passing. geometry notices the bug, says its clip is 'stronger than what the fills do today', and then never fixes it: its FILES list touches PdfExporter only to add DrawSitePlanHatches. The result on the first courtyard polygon is a hatch that cuts the hole over a fill that does not - which looks like a hatch fault and is not one.

Against that, geometry is the better PDF craftsman and I want its craft. Its one-composed-path-per-pen with a single doc.stroke() is the correct construction and is measurably better than svgpattern's unstated per-primitive emission - the existing DrawLinework already shows the cost of the naive route, since doc.line in compat expands to lines([[dx,dy]],...,'S'), an m/l/S triple per segment. Its state-before-moveTo warning is real PDF law and fails silently in some readers. Its dual Budget__MaxStrokes/MaxTiles is the correctly shaped guard, and svgpattern's tile-only MaxTilesPerFill of 4000 is demonstrably mis-scaled: a 2.5 mm CrossHatch45 over an A3 frame is roughly 168 x 119 = 20,000 tiles of one line each - trivially printable, and flatly refused - while a 14 mm MixedWoodland tile that squeaks under 4,000 carries ~24 primitives each, 96,000 of them. svgpattern's own claim that MinTilePaperMm 2.0 makes 4,000 unreachable is arithmetically backwards; on A3 it is reachable several times over. Note also that BuildDocument passes compress : true, so the content stream is FlateEncoded - repetitive operator text compresses hard, which means a stroke budget in the tens of thousands is genuinely affordable and geometry's 60,000 is a sane ceiling where svgpattern's 4,000 tiles is not.

And geometry alone spotted the two things that would otherwise be found the hard way: the lattice anchor (anchor to model 0,0 or the hatch crawls under pan and re-solves at every zoom - it will pass every static screenshot), and the fact that SitePlanBuild line 165 filters fills on FillHex && FillOpacity > 0, so building the hatch list independently of that filter makes PS01's TrueVision__SitePlan__ExistingBuildings - one real ring, FillHex null - hatchable with a single config line and no manifest edit at all. That directly de-risks F5 and makes svgpattern's own H0 precondition cheaper than svgpattern designed it.

On my lens the two PDF halves are close, with geometry ahead on craft and svgpattern ahead on correctness of what surrounds it. What decides it is graftability: every one of geometry's PDF strengths is a local property of a PDF module and drops straight into Na__LayoutEditor__HatchPatternPdf__.js without disturbing anything. svgpattern's cache placement, hole fix and one-path-per-layer screen cost cannot be retrofitted into geometry's generated-geometry screen path, which pays ~14,000 path segments per repaint per layer against one <path> element. Base on svgpattern; import geometry's PDF discipline and its two traps.

One thing neither design settles and the implementer must, because it is where a shared generator can still drift: the browser anchors an SVG pattern tile at user-space (0,0), which in this viewBox is model (0,0) - so the screen gets geometry's lattice anchor for free and does not crawl on pan. The PDF tile loop must therefore start its lattice at model (0,0) mapped through frame.X + ((p - win.OriginX) / D) and rotate about that same point, not at the ring bbox corner. svgpattern says only 'the tile loop runs over ring bbox intersect frame rect', which is a cull, not a phase. Get that wrong and screen and paper are half a tile out on every polygon - the exact drift geometry warned about, arriving through the one seam svgpattern left unspecified. Write the phase rule into Na__LeHatchGeo__Expand's contract and assert it in Na__Test__HatchPatterns__.test.mjs.

Two smaller corrections before work starts. Na__LeChrome__WithOpacity is defined at SheetChrome 658 but is absent from the export block at 860-878, so svgpattern's instruction to paint the fill inside it needs that export added - Na__Verify__Exports__.mjs would catch it, but name it now. And geometry's stated objection that a paper-mm tile would have to be authored twice because the frame SVG's viewBox is model mm while the chrome's is paper mm is simply wrong: patternTransform="scale(D)" absorbs the whole conversion in one attribute, which is the single best idea in svgpattern's design and the reason its screen and paper numbers are the same numbers.

Finally, keep svgpattern's honesty about the one unverified assumption - pattern tiles under .na-le-paper's transform: scale() at 400%. Blink does rasterise pattern tiles at nominal size and can blur them under an ancestor scale in a way a plain <path> does not. That risk is real and it is the only technical argument that could have carried geometry. It is checkable in an hour at H2, at 100/200/400%, and if it fails the fallback is geometry's screen painter behind the same Na__LeHatchGeo__Expand - which is exactly why the expander must stay import-free and painter-agnostic.

**Graft from the losers:**

- Build the hatch list independently of the fills filter. Na__LeVp2d__SitePlanBuild line 165 filters fills on FillHex && FillOpacity > 0; gate the hatch on rings.length > 0 && Na__LeHatch__Effective(...) !== null instead, and do NOT hang the hatch off fills[] entries as svgpattern does. This makes PS01's TrueVision__SitePlan__ExistingBuildings (one real ring, FillHex null) hatchable from a single config LayerBindings row with no manifest hand-edit, which is a cheaper and more honest H0 than svgpattern's.
- Replace Hatch__MaxTilesPerFill 4000 with geometry's dual budget: Budget__MaxStrokes 60000 AND Budget__MaxTiles 20000. A tile-only cap is mis-scaled across the library - a 2.5 mm CrossHatch45 over an A3 frame is ~20,000 one-line tiles (trivially printable, wrongly refused) while a 14 mm woodland tile under 4,000 carries ~96,000 primitives. Stream size tracks strokes, not tiles. BuildDocument passes compress : true (FlateEncode), so a stroke budget in the tens of thousands is affordable.
- Return geometry's refusal shape rather than a bare false: { Result__Ok, Result__Reason, Result__SuggestedScale }. A suggested scale turns 'the hatch did not print' into a one-click fix, and it is what the Patterns panel should surface. Keep svgpattern's rule that the solid fill still paints under a refusal.
- Batch the PDF like geometry: per pen, set setDrawColor / setLineWidth / setLineCap BEFORE the first moveTo, compose every stroke of that pen as one path, and call doc.stroke() once (doc.fill() for a filled pen). putStyle(null) at jspdf.umd.js:4485 returns early, so this composes correctly. Do not emit doc.lines(..., 'S') per primitive - the existing DrawLinework shows the cost, since doc.line in compat expands to an m/l/S triple per segment.
- Adopt geometry's explicit PDF state law in the module header: a state operator issued between moveTo and the paint operator is illegal PDF and fails silently in some readers, and a clip left unrestored crops every primitive after it including the rest of the sheet. Wrap the ring clip in try/finally with restoreGraphicsState, exactly as Na__LeGrad__DrawPdf does.
- Take geometry's lattice-anchor discipline and make it the contract of Na__LeHatchGeo__Expand. The browser anchors a userSpaceOnUse pattern at user-space (0,0) = model (0,0), so the screen never crawls on pan; the PDF tile loop must therefore phase its lattice from model (0,0) mapped through frame.X + ((p - win.OriginX) / D) and rotate about that same point, not from the ring bbox corner. svgpattern specifies only a bbox cull, which is not a phase. This is the one remaining screen/paper drift seam.
- Add geometry's anchor-stability assertion to Na__Test__HatchPatterns__.test.mjs: shift the clip box by exactly one tile step and expect the identical primitives translated. A phase error passes every static screenshot and is otherwise only found by panning in front of Adam.
- Keep geometry's Pen__Opacity / stroke-alpha thought in the Inks block (an Ink__Opacity beside Ink__WeightFactor). Site plan fills carry FillOpacity and the hatch sits on top of a translucent ground; Na__LeChrome__WithOpacity (SheetChrome:658) already sets both fill and stroke alpha via GState and is the existing mechanism - note that it is NOT currently exported (export block, lines 860-878) and must be added.
- Borrow geometry's framing that the tile count is bounded by the FRAME, never by the site, because SC08 fixes the tile in paper millimetres - a 180 mm frame holds the same tile count at 1:100 and at 1:500. State it in Meta__WhyPaperMm; it is the sentence that makes the budget numbers legible to whoever tunes them later.
- Carry geometry's warning to the two-stores phase. svgpattern's narrow Na__LeRec__NormaliseSitePlanHatches is the right blast radius (keep it over geometry's whole-block NormaliseSitePlanBlock), but its header must still say that Viewport__SitePlan is no longer a free-for-all shallow copy for the keys it names, and the two-store design must be told before it tries to slip SitePlan__StoreId through unnormalised.

---

## Judge 2 - winner: **minimal**

| Approach | Score | Why | Fatal flaw |
|---|---|---|---|
| minimal | 9 | Smallest blast radius by a clear margin, and every claim I checked against the code is true. StyleBands takes an optional 5th param defaulted null, with the rank folded into the bucket key and the comparator — architectural output is provably byte-identical and the merge is preserved exactly where it was doing work (F2's Grey-L40 trio still collapses). Na__SpStore__Describe's sort is NOT touched. Na__LeRec__NormaliseViewport keeps its hand-written literal and gains two additive pick() lines whose defaults are true, so every already-saved viewport paints identically with no migration. Na__LeChrome__PushPolyline, the scale list, ScaleManager and Na__LeVp2d__SitePlanDrawing's fills contract are all left alone. The derivation ceil(DrawOrder/10) verified against PS01's real manifest: 20/40/70/71/90 -> 2/4/7/8/9, strictly increasing — correct hierarchy from an unmodified two-year-old manifest with no re-export. It is the only design whose first step needs neither SketchUp nor Adam: PS02__MustersRoad__OfficialPdPack exists on disk with a real ExistingBuildings__FillModel__.glb, so hand-editing that manifest's FillHex closes F5 on 127.0.0.1 immediately. Its loc/blk flag on SitePlanToken is correct and necessary: BandPaths keys on built.key + '@false@' + styleToken, and styleToken does not move with scale, so without it a 500<->1250 switch reuses the other scale's band strings. Three small blemishes, none structural: its own risk note claims LocationPlan__NeutralColourHex must be in the EdgeStyles alias whitelist, but its ColourFor substitutes a raw hex after Na__LeEdge__Effective has already resolved one, so the whitelist is bypassed — over-caution, not error; the 'style-toggle' concern is an overwrite in Na__LePanels__Handlers (a Map keyed eventType:controlName), not double-handling, though the distinct control name is still the right remedy; and it deliberately leaves the PDF hole divergence open, which the brief explicitly asked about. Its stated reason (do not rewrite Na__LeChrome__PushPolyline, used by every markup shape) is sound, but 'perf' showed the fix can live entirely inside Na__LePdf__DrawSitePlanFills touching nothing shared — so minimal argued against a design it did not have to pick. | - |
| perf | 8 | The best cache and performance reasoning of the three, and it is the only design that caught a real shippable bug: Na__LePanelViewport__AddSitePlan's off-map loop switches OFF every layer whose Layer__VisibleAtScales omits the new scale, and I verified all five PS01 layers list exactly [500,1250] — so REQ-33's widened list silently blanks every new 1:100/1:200/1:2500 viewport unless the length>0 guard lands in the same change. Its (z, style) tuple bucket with a constant '0\|' prefix when spec is null preserves the indices===null fast path for every architectural viewport, and its regression test — a band-array snapshot for a classes+owners fixture with spec===null, asserted identical before and after — is the correct proof for a shared function. Na__SpStore__GetOrderToken folded into SitePlanToken is a genuine insight the other two lack: the documented local test loop (section 3.4) hand-edits the repo manifest, which changes Z while SitePlan__ExportedIso stays put. Its ForceRender fix is the only one done properly, calling ForgetPaths on the token computed both before and after Na__SpStore__Reload(). Its even-odd PDF fix sits entirely inside Na__LePdf__DrawSitePlanFills and touches no shared chrome primitive — the best-placed version of that fix. Verified in the vendored build: putStyle returns early on null (line 4485), fillEvenOdd is fillWithOptionalPattern('f*') which is a bare out('f*') with no advancedApiModeTrap, and null/'f*' are both in isValidStyle. Marked down for three things. It ships REQ-28's greyscale recolour DISABLED (LocationPlanGreyscaleAlias null) while SC17 in the decisions register reads 'non-boundary layers paint in greyscale ... desaturate, not hide' — that is a live register entry being quietly half-delivered. It adds a localeCompare tiebreak to Na__SpStore__Describe's sort, which is unrequested and changes tie order for any manifest with duplicate DrawOrder (certain once Adam's nine new tags arrive unnumbered). And it adds Na__LeScale__IsLocationPlan to ScaleManager, a file shared with ValeVision that contains zero occurrences of 'SitePlan' — a port obligation minimal explicitly avoided. | Na__LeVp2d__SitePlanToken is redefined as 'siteplan:' + ExportedIso + ':' + OrderToken + ':' + ModelLayersToken — with NO location-plan or scale discriminator. Its own spec.ColourOf seam is shipped disabled but is described as 'one config value away, a config edit, not a painter change'. The moment LocationPlanGreyscaleAlias is set, the bands resolved by StyleBands differ between a 1:500 and a 1:1250 viewport while built.key is identical, and Na__LeVp2d__BandPaths keys on built.key + '@false@' + styleToken — styleToken (Na__LeEdge__Token + Na__LeComposite__Token) does not move with scale. Two site plan viewports of the same data at different scales on one sheet would then paint each other's band strings, and a scale change would repaint the old drawing. This is the exact cache key the brief named, and the one fault class already recorded in the Force Render memory note. Both rival designs got it right. |
| clean | 6 | The cleanest conceptual model and the strongest answer to 'what does it do to architectural viewports' — Na__LeVp2d__StyleBands is not edited at all, so the architectural path is untouched by construction rather than by a guard. Bands-major / Z-minor is the right reading of REQ-31 and makes REQ-10 fall out as two independent sorts. Its jsPDF even-odd verification is correct (I confirmed putStyle's null early return and fillEvenOdd's bare out('f*')), its argument that a DOM hide would make the toggles screen-only is right, its Layer__ZIndexSource marker is a good idea, and its measured case for dropping the merge for site plans only (five layers / ~785 segments in PS01, ~25 tags after Adam's additions) is honest and holds. But under a regression lens it carries the most unforced risk of the three. It re-implements site plan line drawing inside the PDF exporter with its own doc.line loop, minSegmentPaperMm cull, frame-reject, dash and cap state — roughly twenty lines duplicated from Na__LePdf__DrawLinework, which is precisely how screen and paper drift apart over time, on the build whose stated purpose is to stop them drifting. It adds a new KIND_POLYRINGS primitive to Na__LayoutEditor__SheetChrome__.js, a file every sheet uses. Its Phase 0 blocks on Adam (SSOT edit plus a re-export) where minimal's does not. And Phase 5 widens LayoutEditor__Scales__SitePlanScaleDenominators to [100,200,500,1250,2500] with no mention of the AddSitePlan off-map guard — I verified all five PS01 layers list only [500,1250], so that commit ships a silently blank 1:200 site plan viewport with no error. | It turns Na__LeRec__NormaliseViewport's hand-written Viewport__Styles literal into a config-dependent loop over Na__LeRec__STYLE_KEYS, with the rule 'a key whose Na__LeComposite__Row(key) is unknown is kept if present and not added if absent'. I checked the two lists: STYLE_KEYS holds 'contextLayer', and Na__LayoutEditor__RenderComposites__Config__.json holds no Composite__Key 'contextLayer' at all (its eight rows are projectedLinework, profileLinework, sectionOutline, hiddenLines, glassOpaque, whitecard, enhanceWhitecard, baseImage — note sectionOutline is in the config but not in STYLE_KEYS). So contextLayer lands in the unknown branch and stops being defaulted onto any viewport record that does not already carry it. This is the highest-blast-radius function in the codebase, it runs on every viewport of every project on every load and save, the design names it as its own top risk, and it did not find the mismatch that breaks its own rule. Combined with the unguarded scale-list widening, that is two shippable regressions in the one dimension being judged. |

**Verdict.** Winner: "minimal", and not narrowly. Judged on regression risk it is the only design that changes nothing an architectural viewport, a saved sheet or a published manifest can observe. Its StyleBands edit is guarded exactly as "perf"'s is, but it also leaves Na__SpStore__Describe's sort, Na__LeRec__NormaliseViewport's literal, Na__LeChrome__PushPolyline, Na__LayoutEditor__ScaleManager__.js, the site plan scale list and Na__LeVp2d__SitePlanDrawing's fills contract completely alone. Every claim I checked against the code is true, and the ceil(DrawOrder/10) fallback is verified correct against PS01's real published manifest (20/40/70/71/90 -> 2/4/7/8/9, strictly increasing, correct hierarchy, no re-export needed). Decisively, it is the only design whose first step unblocks without Adam and without SketchUp: PS02__MustersRoad__OfficialPdPack is on disk with a real ExistingBuildings__FillModel__.glb, so hand-editing that manifest's FillHex closes finding F5 on 127.0.0.1 today. Both rivals gate their Phase 0 on an SSOT edit plus a re-export, which SC03 makes an Adam-blocking round trip.

"perf" scores close and contributes the most graftable material, but it leaves the location-plan discriminator out of SitePlanToken — a config-flippable stale-band landmine on the exact cache key the brief named — and ships REQ-28's greyscale off against SC17.

"clean" has the best idea in the field (the site plan owning its own ordered emit, StyleBands untouched by construction) but pays for it with the two riskiest edits proposed anywhere: a config-dependent loop replacing NormaliseViewport's Viewport__Styles literal, whose own unknown-row rule silently drops contextLayer because that key has no Composite__Key row; and widening the site plan scale list without the AddSitePlan off-map guard, which blanks every new 1:200 viewport because all five PS01 layers list only [500,1250]. Under this lens that is disqualifying, however good the model is.

One correction that applies to all three: the plan doc's decisions register ALREADY contains SC15, SC16 and SC17 (the two-pattern first pack, the empty-pack skip rule, and the location-plan greyscale reading). Every design proposes writing new decisions over those ids. New decisions must start at SC18, and SC17 in particular must be honoured or explicitly revised in place and dated — it is the register entry that says the location plan desaturates rather than hides, which "perf" quietly declines to build.

**Graft from the losers:**

- From perf: the PDF hole fix, done inside Na__LePdf__DrawSitePlanFills only. Drop the `if (!ring.outer) return` skip, stop calling Na__LeChrome__PushPolyline, and inside Na__LeChrome__WithOpacity(doc, fill.opacity, 1, ...) set the fill colour first, emit every ring with doc.lines(rel, x0, y0, [1,1], null, true), then call doc.fillEvenOdd() once. I verified this in the vendored jspdf.umd.js: putStyle (line 4485) returns early on style === null, fillWithOptionalPattern with no pattern object is a bare out('f*'), and both null and 'f*' pass isValidStyle. No advanced API, no advancedApiModeTrap, and Na__LeChrome__PushPolyline is never touched. This removes minimal's only real shortfall (SC19's deferral) at zero shared-code cost, and the whole PDF forbids-operators-between-construction-and-painting constraint is satisfied because WithOpacity wraps the entire ring emission, not each ring.
- From perf: the AddSitePlan off-map guard. `if (layer.Layer__VisibleAtScales.length > 0 && layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[key] = false;`. I confirmed all five PS01 layers carry exactly [500, 1250], so the moment REQ-33 widens LayoutEditor__Scales__SitePlanScaleDenominators, a new 1:100/1:200/1:2500 site plan viewport is created with every layer switched off and paints blank with no error. Minimal defers REQ-33 so it does not hit this today, but the guard must be written into the plan doc as a hard precondition on whoever widens that list.
- From perf: Na__SpStore__GetOrderToken(), memoised on the descriptor at Describe time (never recomputed per paint), folded into Na__LeVp2d__SitePlanToken as layers.map(l => key + ':' + zLine + ':' + zFill).join(','). Minimal argues the Z values are fully determined by SitePlan__ExportedIso and need nothing — that is true for a real re-export but false for the documented local test loop in section 3.4, which hand-edits the repo manifest and leaves ExportedIso untouched. Minimal's own STEP 0 uses exactly that loop.
- From perf: the ForceRender fix done two-sided. Export Na__LeVp2d__ForgetPaths from the Linework unit and, in Na__LeVp2d__ForceRender's site plan branch, call it on the SitePlanToken computed BEFORE Na__SpStore__Reload() and again on the token computed after, so both generations are swept. Minimal makes this a one-line optional afterthought; the before-and-after detail is what actually makes it work.
- From perf: the architectural regression test. Snapshot Na__LeVp2d__StyleBands's band array for a fixed classes+owners fixture with the 5th parameter null, and assert it byte-identical before and after the edit. That is the proof that the shared function is untouched — strictly better than minimal's proposed test, which only re-implements the bucket-key and comparator rules in the harness and therefore cannot catch a mistake in the real function.
- From perf: the explicit standing note that the new toggles must NOT enter Na__LeVp2d__StyleToken. StyleToken is Na__LeEdge__Token + '#' + Na__LeComposite__Token and is also the architectural BandPaths cache key, so a site plan toggle folded in there would invalidate every architectural viewport's cached band paths. Minimal keeps them out of built.key but does not say this about StyleToken; write it as a code comment so a later reader does not 'tidy' it in.
- From clean: make the tie-break explicit and named. Minimal's tie-break for two layers at the same rank is 'stroke width, then bucket insertion order', which it admits produces orders nobody predicts on a half-authored SSOT. Adopt clean's Op__Ordinal discipline — the layer's index in descriptor.SitePlan__Layers, which is already Layer__DrawOrder-sorted — as a stated, documented secondary key, so two layers at the same Z keep today's relative order deterministically.
- From clean: Layer__ZIndexSource ('manifest' or 'derived'). A derived ceil(DrawOrder/10) value must never be readable as an authored one — PS01's red line derives to 9, not Adam's 10, and any future UI showing a Z must show where it came from.
- From clean: register the new composite rows in Na__LeComposite__FALLBACK as well as the config, so the row lookup is total before the fetch lands. Minimal adds fallback entries for the two rows but should also make the sitePlan flag explicit (false) on every existing fallback entry, so row.sitePlan is never undefined in the Panel__Styles filter.
- From clean: keep the two composite toggles as a filter inside the shared build rather than a DOM-level suppression. Minimal already gates its three <g> decks at emit time, which is correct — hold that line and do not adopt perf's state.spGroups hidden-flag early-out, which makes the screen suppress by DOM and the PDF suppress by a Viewport__Styles read. Two mechanisms for one rule is the divergence class this whole build exists to remove, and `hidden` on an SVG <g> depends on a UA stylesheet rule nobody has tested here.
- Housekeeping all three flagged and all three should carry: raise LayoutEditor__EdgeStyles__Weight.Weight__Max from 6.00 to 10.00 (verified 6.00 in the file) and Meta__SsotVersionRead from 2.0.0 to 2.1.0 (verified stale) in Na__LayoutEditor__EdgeStyles__Config__.json, in the same release. Adam's 2.0 pt proposed-building weight is 0.706 mm against a 0.635 mm ceiling and clamps silently; worse, a clamped weight destroys the width tie-break inside a rank, which perf alone spotted.

---

## Judge 3 - winner: **svgpattern**

| Approach | Score | Why | Fatal flaw |
|---|---|---|---|
| svgpattern | 9 | Verified correct on every fact I could check, and correct on the two that decide the screen-and-scale lens.  VERIFIED IN ITS FAVOUR: (1) The sheet SVG really is a string with no <defs> (Na__LeVp2d__PaintSitePlan builds `let body = ''` and assigns one innerHTML), the viewBox really is model mm (Na__LeVp2d__Window: `w = frame.WidthMm * D`), and the gradient really does push `<defs><linearGradient gradientUnits="userSpaceOnUse">` through innerHTML (Na__LeGrad__SvgPaint ~line 478). The survey's own hatch-precedent agent independently recommends exactly this shape (survey lines 509, 1808, 2153, 2168): patternUnits="userSpaceOnUse" with a patternTransform scaled by win.Denominator. (2) THE PAN PATH. Na__LeVp2d__FillSitePlan's fast path is `if (state.lineworkKey === paintKey && state.lineworkSvg) { setAttribute('viewBox', ...); SizeLayer(...); return; }` - a pan does NOT repaint, it swaps one attribute. A userSpaceOnUse pattern lives in viewBox space, so it is anchored to model (0,0) and pans with the ground for free, needing no anchor parameter at all. On a 50,000-segment OS drawing this is the behaviour that matters most, and this design gets it without trying. (3) THE CACHE KEY. Verified that `built.key` IS Na__LeVp2d__SitePlanToken and that Na__LeVp2d__BandPaths files under `built.key + '@false@' + styleToken` in Na__LeVp2d__PathCache, a 16-entry FIFO (`if (size > 16) delete keys().next().value`) shared with every architectural viewport. Putting the hatch token in the PAINT key only, never in SitePlanToken, is exactly right and is the difference between a REQ-19 slider that works and one that rebuilds 50,000 path segments per tick. (4) jsPDF: confirmed addShadingPattern / beginTilingPattern / endTilingPattern each open with advancedApiModeTrap (lines 2210 / 2223 / 2238) while clip, clipEvenOdd, discardPath and fillEvenOdd are plain out() wrappers (4308-4444). The vector verdict is right and the raster arithmetic is right. (5) HOUSE RULE. Ink__WeightFactor obeys Na__LayoutEditor__EdgeStyles__Config__.json's Meta__WhereWeightGoes verbatim: 'A weight FACTOR is never a width.' (6) RECORD SAFETY. A narrow SitePlan__Hatches sub-normaliser and a narrow patch.sitePlanHatches, explicitly defended against the concurrent two-stores phase - and survey section 3.I confirms that phase will use the same Viewport__SitePlan shallow copy for SitePlan__StoreId. (7) It fixes the verified `if (!ring.outer) return` dropped-hole bug in Na__LePdf__DrawSitePlanFills as part of the work. (8) drawY = +glTF z (Na__SpGlb__DrawingPoints line 247) really is y-down, so the no-flip claim holds.  FLAWS: (a) Tile__Wrap DOUBLE-DRAWS ON PAPER. Na__LeHatchGeo__Expand is specified to apply wrap copies unconditionally, and the PDF tile loop draws whole tiles with no per-tile clip. A mark crossing the right edge is then drawn once by its own tile and again as the next tile's wrap copy - every edge glyph printed twice, heavier and darker than on screen. Two of the six worked-example marks deliberately cross an edge, so it lands on day one. One flag on Expand fixes it, but the design does not say so, which is exactly the re-deciding the brief forbids. (b) THE HATCH IS WELDED TO A COLOURED FILL. It puts `hatch` on each fills[] entry, and Na__LeVp2d__SitePlanBuild filters fills on `FillHex && Number.isFinite(FillOpacity) && FillOpacity > 0`. A hatch-only layer is then impossible (REQ-14 says the face is bounded space, not a tint), and PS01's one real ring polygon - ExistingBuildings, FillHex null - cannot be hatched without a manifest edit. (c) No swatch generator for the Patterns panel; it ships a hard-coded Preview__InkHex / Preview__GroundHex block that can lie about what prints. (d) Never mentions the location-plan suppression (SC11 / REQ-28, denominator > 500). (e) SC15-SC20 collide with the plan doc's existing SC15 / SC16 / SC17. | - |
| geometry | 6 | A clean, honest, well-tested centre - a pure zero-import generator, Tile__BleedMm, the budget refusal, the anchor-stability test, a swatch from the real generator - built on one assumption this codebase falsifies.  THE ASSUMPTION THAT FAILS: 'Clip the lattice to the viewport window first, not to the polygon' is the lever that makes its cost argument work ('the tile count is bounded by the frame, never by the site'). But Na__LeVp2d__SitePlanPaintKey is `SitePlanToken \| ScaleDenominator \| masterPt \| StyleToken` - the pan is NOT in it - and Na__LeVp2d__FillSitePlan's fast path on a pan swaps the viewBox attribute and returns without calling PaintSitePlan. Generated geometry clipped to the old window simply runs out mid-polygon as you pan, and it will read as a clipping bug rather than a caching one. Both fixes are bad: add the pan to the paint key and regenerate ~14,000 hatch segments on every pan frame on top of a full BandPaths rebuild, or clip to the ring bounds instead - which is the site extent, not the frame, and blows Budget__MaxTiles on any real OS polygon. Its own risk list names lattice anchoring, but only as an aesthetic crawl; the real consequence is a hatch that stops existing off the original window.  SECOND VERIFIED FAULT, SAME LENS: it folds Na__LeHatch__ViewportToken into Na__LeVp2d__SitePlanToken. That token is `built.key`, which keys Na__LeVp2d__BandPaths in Na__LeVp2d__PathCache - a 16-entry FIFO shared with every architectural viewport. A REQ-19 scale-slider tick therefore misses the cache and re-runs Na__LeVp2d__PathDataFor over all 50,000 segments (per-segment string concatenation), evicts other viewports' cached path strings, regenerates ~14,000 hatch segments and re-parses ~2 MB of innerHTML. REQ-19 as a live control does not work; the winner's version is one setAttribute on one <pattern> element.  OTHER VERIFIED PROBLEMS: - Pen__WeightMm is an absolute paper millimetre and is argued for explicitly. Na__LayoutEditor__EdgeStyles__Config__.json states the rule outright in Meta__WhereWeightGoes: 'A weight FACTOR is never a width.' Every site plan line beside the hatch is a factor on the sheet master (F3's 0.10584 divisor); the hatch would not follow the master. - Na__LeRec__NormaliseSitePlanBlock whitelists the WHOLE Viewport__SitePlan block and patch.sitePlan is general. Survey 3.I confirms the concurrent two-stores phase depends on that block's shallow copy for SitePlan__StoreId. It flags the hazard itself and mitigates with a header comment, which is not a mechanism. - It names Na__LePdf__DrawSitePlanFills's dropped inner rings as a divergence but does not schedule the fix; its PdfExporter edit only adds DrawSitePlanHatches. - Its central rejection of <pattern> - 'no counterpart on paper, so the two will drift' - is largely a straw man: the competing design shares ONE geometry expander across both surfaces and only the tiling mechanism differs. Its secondary objection, that the frame SVG's model-mm viewBox versus the chrome SVG's paper-mm viewBox would force authoring a paper-mm tile twice, is simply wrong; one patternTransform multiply handles it, as the survey itself states at line 1808.  CREDIT WHERE DUE: the jsPDF trap reading is correct, the raster arithmetic is correct, the PDF state-operator rule (no setDrawColor between moveTo and stroke) and the finally-wrapped clip are real and worth keeping, Tile__BleedMm is the right seam mechanism for a loop painter, and building the hatch list independently of the fills filter is more faithful to REQ-14 than the winner is. | The lattice is clipped to the viewport window, but the viewport window is not in the repaint guard and a pan never repaints - Na__LeVp2d__FillSitePlan's fast path only swaps the viewBox attribute when lineworkKey === paintKey, and paintKey contains no pan. A panned site plan therefore shows hatch generated for the old window, running out mid-polygon. Clipping to the ring bounds instead removes the flaw and simultaneously destroys the frame-bounded tile-count argument the whole approach rests on. |

**Verdict.** svgpattern wins, and on the screen-and-scale lens it is not close.

I read Na__LayoutEditor__Viewport2d__SitePlan__.js, __Window__.js, __Linework__.js, __Frame__.js, Na__LayoutEditor__SheetSurface__.js, the PDF exporter, Na__SitePlan__Store__.js, Na__SitePlan__GlbParse__.js, Na__LayoutEditor__SheetRecords__.js, Na__LayoutEditor__SheetModel__Viewports__.js, the EdgeStyles config, the service worker and the vendored jspdf.umd.js. Three facts decide it.

1. THE SITE PLAN SVG IS NEVER REPAINTED ON PAN OR ZOOM. Na__LeVp2d__FillSitePlan's fast path is `if (state.lineworkKey === paintKey && state.lineworkSvg) { lineworkSvg.setAttribute('viewBox', ...); SizeLayer(...); return; }`, and the sheet zoom is a CSS `transform: scale()` on .na-le-paper (Na__LeSurface__ApplyZoom) that never touches ppm. A `<pattern>` with patternUnits="userSpaceOnUse" lives in viewBox space, so it is anchored to model (0,0) and pans and zooms with the ground for nothing - svgpattern does not even need geometry's Placement__AnchorX/Y parameter. Generated geometry clipped to the viewport window is wrong the moment you pan, because the pan is not in the paint key. That is geometry's fatal flaw, and its own budget argument is what forces the window clip.

2. REQ-19 ONLY WORKS ON ONE OF THEM. `built.key` IS Na__LeVp2d__SitePlanToken, and it keys Na__LeVp2d__BandPaths in a 16-entry FIFO PathCache shared with every architectural viewport. svgpattern puts the hatch token in the PAINT key only and says why; geometry folds it into SitePlanToken, so every scale-slider tick rebuilds the path string for all 50,000 segments through Na__LeVp2d__PathDataFor and evicts other viewports. Worse, svgpattern's architecture leaves a live drag available as a single setAttribute('patternTransform', ...) on an existing element - the only version of REQ-19 that is genuinely interactive on a big OS drawing.

3. PER-LAYER COST. One `<path fill="url(#id)">` plus one pattern definition per hatched layer regardless of polygon count, against ~14,000 path segments per hatched layer per repaint, on a drawing that already carries 50,000 linework segments in one innerHTML string.

Geometry's rejection of `<pattern>` rests on a house rule it misapplies. "ONE FUNCTION, TWO SURFACES" is about the geometry, and svgpattern honours it: Na__LeHatchGeo__Expand feeds both painters, and only the tiling mechanism differs, because the browser can tile and jsPDF cannot. Its secondary objection - that the frame SVG's model-mm viewBox would force authoring the tile twice - is wrong, and the survey says so at line 1808. Both approaches are correct and verified on the jsPDF traps: addShadingPattern / beginTilingPattern / endTilingPattern call advancedApiModeTrap; clip, clipEvenOdd, discardPath and fillEvenOdd do not.

Two things both designs must fix before implementation. First, the plan doc ALREADY uses SC15, SC16 and SC17 (exactly two patterns ship; the loader skips an empty pack; the location plan desaturates). Both proposals renumber over them - the new decisions start at SC18. Second, neither is worth much until F5's precondition is met: no site plan fill has ever been painted, and svgpattern is right to own H0 as a separate phase even though it belongs to the fills work.

One genuine risk svgpattern flags and geometry does not have: a `<pattern>` fill under the paper's CSS transform: scale() at 400%. .na-le-paper has transform-origin and a transform and there is no will-change anywhere in the Layout Editor CSS, so the layer is not force-promoted and Blink should re-rasterise the pattern tile at the new scale - but this is unverified in Edge, and a blurred hatch is the first thing Adam would see. Check it at 100%, 200% and 400% on day one of H2, as svgpattern's own order says. If it does blur, the fallback is geometry's generated tile emitted as a `<g>` at the same coordinates, which the shared Na__LeHatchGeo__Expand already makes available - so grafting geometry's Paint module as a debug escape hatch costs almost nothing and buys the insurance.

**Graft from the losers:**

- Tile__BleedMm instead of unconditional wrap copies for the PDF: give Na__LeHatchGeo__Expand a `{ wrap : true|false }` option. The SVG <pattern> needs wrap copies because the browser clips at the tile edge; the PDF tile loop does NOT clip, so wrap copies there draw every edge-crossing mark twice - once from its own tile and once as the neighbour's copy. For the PDF, extend the lattice by one Glyph__ExtentMm past the clip rect and draw each mark once from its owning tile. Assert in Na__Test__HatchPatterns__.test.mjs that the PDF expansion of Mixed Woodland emits each of the two edge-crossing marks exactly once.
- Build the hatch list INDEPENDENTLY of the fills filter, as geometry does: `rings.length > 0 && Na__LeHatch__Effective(viewport, categoryKey) !== null`, returning `{ classes, fills, hatches, key }`. Na__LeVp2d__SitePlanBuild's fills filter requires `FillHex && FillOpacity > 0` (verified), so hanging the hatch off a fills[] entry makes a hatch-only layer impossible - contrary to REQ-14, where the face is bounded space and not a tint - and blocks PS01's only real ring polygon (ExistingBuildings, FillHex null) from being a test fixture without a manifest edit.
- Na__LeHatch__SwatchSvg(patternId, sizeMm), running the SAME generator at a fixed preview scale, in place of svgpattern's hard-coded Preview__InkHex / Preview__GroundHex block. A panel swatch built from separate numbers can disagree with what prints; one built from the generator cannot. Keep only Preview__TileCount and Preview__GroundHex in the JSON (the ground tint has no other source).
- The location plan suppression in the resolution order: Na__LeHatch__Effective returns null when the viewport's scale denominator is greater than 500 (SC11 / REQ-28 - a location plan shows only the proposed fills and the boundary colours). svgpattern never mentions it, and a woodland hatch appearing on a 1:1250 location plan is a requirement breach, not a bug.
- Geometry's PDF state-operator discipline, written into Na__LayoutEditor__HatchPatternPdf__.js's header as a rule rather than a comment: every setDrawColor / setLineWidth / setLineCap is issued BEFORE the first moveTo of a path (a state operator inside path construction is illegal PDF and some readers render it anyway while others drop it), and restoreGraphicsState goes in a finally, because a clip left open crops the whole rest of the sheet.
- Budget__MaxStrokes alongside Rendering__MaxTilesPerFill. A tile count alone does not bound a scatter pattern's primitive count - 4000 tiles of Mixed Woodland is ~4000 x 6 marks x ~10 primitives = 240,000 operators, an unopenable PDF well inside the tile budget. Cap strokes as well as tiles, and return geometry's Result__SuggestedScale so the refusal can tell Adam what would work.
- Geometry's anchor-stability test idea, restated for <pattern>: assert in the Node test that Na__LeHatchGeo__Expand's output is independent of any window or clip box, and add a browser check in H2 that panning the viewport does not move the hatch relative to the linework. This is free under <pattern>, but it is exactly the property that would silently break if anyone later 'optimised' the expander to take a window.
- Geometry's Meta__WhereYPoints prose. Keep svgpattern's y-down authoring (no flip - drawY = +glTF z at Na__SpGlb__DrawingPoints line 247 is verified y-down), but explain the negative conifer coordinates in the Meta block the way geometry explains its y-up choice, so the next author does not 'fix' the signs.
- Geometry's declaration that Identity__Id is un-renameable, modelled on the Render Composites config's Meta__KeyStability. A pattern id will be persisted in the tags SSOT and in saved viewport records; renaming one orphans both silently, exactly as Composite__Key and Layer__CategoryKey do.

---

## Judge 4 - winner: **minimal**

| Approach | Score | Why | Fatal flaw |
|---|---|---|---|
| minimal | 8 | Every claim I spot-checked held exactly. StyleBands' signature (viewport, masterPt, classes, showHidden), its bucket key (hex\|roundedWidth\|dash.join) and its width-only comparator are as described; the optional 5th param with a rank prefix applied only when siteRules is present leaves the architectural path provably byte-identical, and the buckets.size===1 fast path survives. Na__LeVp2d__ForgetPaths does exist unexported. PS01's manifest really is 20/40/70/71/90 and ceil(n/10) really gives 2/4/7/8/9 - strictly increasing, distinct, same ordinal as today. REQ-10 is satisfied cleanly by the two fields plus the hard three-deck stack, and REQ-31's literal words do settle the interleave question the survey left open. Two things make it the strongest under this lens. First, screen and PDF share one decision point: SitePlanBuild returns siteRules and both painters consume it, and I confirmed Na__LeVp2d__SitePlanDrawing just returns SitePlanBuild's object, so the new fields reach the exporter with no signature change - and it leaves masterPt where it already is, at DrawLinework's existing call site. Second, its STEP 0 is the only Phase 0 of the three that can actually run today: PS02__MustersRoad__OfficialPdPack really does hold PS01__TrueVision__SitePlan__ExistingBuildings__FillModel__.glb with FillHex null, so hand-editing that manifest closes F5 with no SketchUp and no re-export, where clean and perf both block on Adam. It is also the only design that spots the panel control-name hazard, and the hazard is worse than it says: Na__LePanels__Handlers is a Map keyed eventType+':'+controlName, so a second OnControl('change','style-toggle') overwrites Panel__Styles' handler outright rather than double-handling it. Its prescription (a distinct 'sp-style-toggle' name) is the right fix. | - |
| clean | 6 | The best-verified design of the three on the pieces it read, and structurally the strongest answer to 'will screen and PDF agree': one ordered Plan__Ops list, two dumb painters, no second ordering decision to get wrong. Claims I confirmed independently: Na__LeVp2d__StrokeRules IS exported from the Linework unit; Na__LeEdge__Effective really does return .overridden; the dash rule it quotes matches the real code verbatim; the jsPDF even-odd route is real (putStyle returns early on style===null at ~4485, isValidStyle's list contains both null and 'f*', fillEvenOdd/clipEvenOdd/discardPath carry no advancedApiModeTrap); and PS01 really is 5 layers / 785 segments (largest 394, not 364 - trivially off), which genuinely does make the merge a non-question for site plans. It is also the only design that noticed Na__LeComposite__Row(key) must stay unscoped because Na__LeRec__NormaliseCompositeWeights depends on it. But it is the design that breaks on the code it did not read. | masterPt never reaches the plan on the PDF path. Na__LeVp2d__SitePlanDrawing's real signature is (viewport) - one argument - and the exporter supplies sheet.Sheet__Lineweights.ViewportPt separately, directly into Na__LePdf__DrawLinework. clean moves all width resolution into Na__LeSpComp__Plan(viewport, loaded, masterPt) built inside SitePlanDrawing, and never says to change that signature or thread the sheet through. As specified, every site plan line in an exported PDF is computed with masterPt undefined, so StrokeRules' Number.isFinite(masterPt) test fails and scale falls to 1 - wrong lineweights on paper, a silent screen/paper divergence introduced by the one change meant to guarantee agreement. Compounding it, the replacement PDF line loop is specified with the minSegmentPaperMm cull and the frame-reject but with no setLineDashPattern, and REQ-06 requires a dashed Proposed__Alterations; as written it prints solid. Separately, turning Na__LeRec__NormaliseViewport's Viewport__Styles literal into a loop over STYLE_KEYS is unsafe as scoped: 'contextLayer' is in STYLE_KEYS but has no row in the composites config or fallback (the composite key is 'baseImage', labelled Context Layer), so clean's 'unknown row - keep if present, do not add if absent' rule stops writing contextLayer onto records that lack it, changing the raster fingerprint string built at Viewport2d__.js:316. It flags the loop as its top risk with a byte-identical-save gate that would catch this, but the loop buys the feature nothing. |
| perf | 6 | Contains the two sharpest original findings in the whole set, both of which I confirmed. (1) Na__LeComposite__Token reads only Viewport__CompositeWeights and never touches Viewport__Styles, so StyleToken cannot see a toggle - perf is the only design that explains why a composite checkbox would otherwise repaint nothing. (2) Na__LePanelViewport__AddSitePlan's off-map loop is exactly 'if (layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[key] = false', and every PS01 layer lists [500,1250], so REQ-33's new scale list silently blanks a new 1:200 viewport with no error. Nobody else saw that. Its ForgetPaths-around-Reload (both the pre- and post-Reload token) is the most correct handling of the stale-path bug of the three, and its point that a clamped weight also destroys the width tiebreaker inside a Z band promotes Weight__Max from housekeeping to correctness. Its even-odd jsPDF verification is sound. Against that: it ships REQ-28 half-built and its performance premise does not survive measurement. | It declines to build the location-plan greyscale (LocationPlanGreyscaleAlias ships null), then asserts that enabling it later is 'a config edit, not a painter change'. That is false and it is the dangerous kind of false. built.key is Na__LeVp2d__SitePlanToken, which perf extends only with an OrderToken - no scale or location discriminator - and Na__LeVp2d__BandPaths files under built.key + '@false@' + styleToken. Two site plan viewports of the same data at 1:500 and 1:1250 on one sheet (SC11 explicitly permits this, and perf's own PHASE 9 test does it) share that key with the same Model Layers state. Flip the config value and the second viewport paints the first's cached path strings. A single config number silently corrupting a sheet is exactly the failure class this lens exists to catch, and SC17 already settles that the greyscale is required, so shipping it off is also a requirement miss on the stated test bed RB05 (blue watercourses, green woodland) however true it is of PS01. Two smaller ones: the toggle mechanism has two sources of truth - the screen hides <g> nodes, the PDF gates on Viewport__Styles inside Na__LePdf__DrawViewport - justified by a rebuild cost that does not exist (a site plan is 785 segments, not the 50,000 perf reasons from); and 'flip the three hidden flags' is a no-op as written, because hidden is an HTMLElement property and SVGElement implements only HTMLOrSVGElement (dataset/nonce/autofocus/tabIndex), so an SVGGElement needs setAttribute('hidden',''). It also reuses the 'style-toggle' control name without noticing that the handler registry is a Map keyed event:name, so re-registering would overwrite the architectural panel's handler. |

**Verdict.** minimal wins, but only after absorbing four things from the losers - two of which are mandatory, not optional.

Why it wins on correctness specifically: it is the only design in which every claim I checked against the real file held, and the only one that keeps the number of places that decide something to a minimum without moving anything that already works. StyleBands gains one null-defaulted parameter and three guarded lines, so the architectural regression test is trivially "nothing changed". SitePlanBuild becomes the single decision point and Na__LeVp2d__SitePlanDrawing already returns exactly that object to the PDF exporter with no signature change - which is also why minimal is the only design that does not disturb how masterPt reaches the PDF. Its Z derivation is arithmetically verified against the real PS01 manifest (20/40/70/71/90 to 2/4/7/8/9, strictly increasing and distinct). And its STEP 0 is the only phase 0 that is executable this afternoon: PS02 genuinely holds the ExistingBuildings fill GLB with FillHex null, so F5 closes with a manifest edit rather than a blocking SketchUp round-trip with Adam.

Its two real defects are both graftable and neither is silent corruption. First, it knowingly leaves the screen (fill-rule="evenodd") and the PDF (the !ring.outer skip) disagreeing about holes, behind a console.warn. Its evidence for deferring is sound - I confirmed no site plan fill has ever painted - but clean and perf both proved the fix is available and cheap, and I verified it myself in the vendored jsPDF 4.1.0: putStyle returns early on style===null, isValidStyle accepts null and 'f*', and fillEvenOdd carries no advancedApiModeTrap. Deliberately shipping a known screen/paper divergence when the fix is three verified lines is the wrong call under this lens. Take clean's Na__LeChrome__PushPolygonRings (in SheetChrome, not inline in the exporter - the chrome unit should keep owning jsPDF), with Na__LeChrome__WithOpacity wrapping the whole ring emission because PDF forbids operators between path construction and the painting operator.

Second, minimal asserts the Z values need nothing in the cache key because they are determined by SitePlan__ExportedIso. That is false for minimal's own workflow: its STEP 0 hand-edits a manifest without touching ExportedIso, its STEP 4 changes store-side Z values, and section 3.4's whole local loop is hand-edited local manifests. Combined with leaving ForgetPaths unexported as an "optional one-line fix", Force Render on a site plan will re-fetch faithfully and repaint the old band strings - the exact bug already recorded in the Linework unit's own v1.1.0 log. Take perf's Na__SpStore__GetOrderToken() folded into SitePlanToken and memoised on the descriptor, and perf's ForgetPaths-before-and-after-Reload. Neither is optional.

Third, and this one is a bug-on-arrival nobody else saw: perf's AddSitePlan guard. I confirmed the off-map loop and confirmed every PS01 layer lists Layer__VisibleAtScales [500, 1250]. The moment REQ-33's [100, 200, 500, 1250, 2500] list lands without the length > 0 guard, a new 1:200 site plan viewport comes up completely blank with no error. minimal does not touch the scale list, so it does not create this - but whoever does REQ-33 must carry the guard in the same commit.

Two housekeeping corrections for whoever implements. All three designs propose new decision ids starting at SC15, but the register already holds SC15, SC16 and SC17 - renumber from SC18, and note that SC17 already settles the greyscale question perf tries to leave open and SC11 already settles the > 500 threshold that minimal spends a paragraph relitigating (it is right, but it is arguing with a decision that is already recorded as agreed). And minimal's location-plan proposal-key list must hold Adam's new stems (Buildings__Proposed__NewConstruction / __Alterations) alongside the legacy ProposedBuildings / ProposedBuildingsSecondary, or REQ-28 will filter nothing at all after the re-export.

**Graft from the losers:**

- MANDATORY, from perf: the Na__LePanelViewport__AddSitePlan off-map guard. Change `if (layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[key] = false` to require `layer.Layer__VisibleAtScales.length > 0` first. Verified: every PS01 layer lists [500, 1250], so REQ-33's new scale list blanks a new 1:200 viewport entirely, with no error. Only perf saw this.
- MANDATORY, from perf: fold a Na__SpStore__GetOrderToken() (layers.map(l => key + ':' + zLine + ':' + zFill).join(','), memoised on the descriptor at Describe time) into Na__LeVp2d__SitePlanToken. minimal's claim that Z needs no cache key is false for its own STEP 0 and STEP 4 test loop, both of which change the store without changing SitePlan__ExportedIso.
- MANDATORY, from perf: export Na__LeVp2d__ForgetPaths and call it in Na__LeVp2d__ForceRender's site plan branch on the token computed BOTH before and after Na__SpStore__Reload(). I confirmed the branch clears state.lineworkKey and no path cache at all. minimal treats this as optional; it is not, and this build makes it likelier to bite.
- From clean and perf: the PDF even-odd hole fix, rather than minimal's warn-and-defer. Verified in the vendored jspdf.umd.js: putStyle returns early on style===null (~4485), isValidStyle's list contains both null and 'f*' (~4346), and API.fillEvenOdd outs 'f*' with no advancedApiModeTrap (~4444). Implement it as clean's Na__LeChrome__PushPolygonRings / KIND_POLYRINGS in Na__LayoutEditor__SheetChrome__.js - not inline in the exporter - and set the fill colour and the GState alpha before the first moveTo, with Na__LeChrome__WithOpacity wrapping the entire ring emission, not each ring.
- From clean: the discipline that Na__LeComposite__Row(key) must remain an unscoped lookup over the whole inventory. Na__LeRec__NormaliseCompositeWeights calls it at record-normalise time and would silently drop weights for any row the scoped index hid. This applies to minimal's row.sitePlan flag exactly as it does to clean's Composite__Scope.
- From clean and perf: add the third toggle, sitePlanLinework. The PDF's site plan branch gates linework on nothing today (the architectural branch gates on Viewport__Styles.projectedLinework; the site plan branch does not), so a fills-only check plot is currently impossible. One config row, and it makes the new panel the complete inventory the RenderComposites config's own Meta claims the file is.
- From clean: use Na__LeEdge__Effective(...).overridden as the escape hatch in the location-plan greyscale, so a category Adam has deliberately restyled on that viewport keeps its colour. I confirmed the field exists and is set only when a stored override actually touched weight, colour or lineType.
- From perf: the argument that F3's clamp is a correctness item, not housekeeping - a clamped weight also destroys the width tiebreaker inside a Z band, so two layers at the same rank that should stack by weight would merge into one path. Pull Weight__Max 6.00 -> 10.00 out of minimal's STEP 11 into an early standalone step, verified by reading Na__LeEdge__Effective(viewport, 'TrueVision__SitePlan__ProposedBuildings').weight against 2.0 pt.
- From clean: put its measured evidence in the plan doc - PS01 is 5 layers and 785 segments (OsMapping 364, ProposedBuildingsSecondary 394, RedLineBoundary 14, ExistingBuildings 10, ProposedBuildings 3). It is the reason the StyleBands merge is not a performance question for site plans at all, and it is what stops a future agent re-litigating the interleave.
- From perf: its concrete LocationPlanProposalCategoryKeys list, but extended. Ship ["TrueVision__SitePlan__ProposedBuildings", "TrueVision__SitePlan__ProposedBuildingsSecondary"] for today's published data AND Adam's new stems from the REQ-04/REQ-06 tag table, with a __Note saying why both generations are listed. perf's list alone stops working the moment Adam re-exports RB05.
- Keep minimal's own catch and strengthen its wording: the new panel must register its OnControl under a distinct name (e.g. 'sp-style-toggle'). Na__LePanels__Handlers is a Map keyed eventType + ':' + controlName, so a second registration under 'style-toggle' does not double-handle - it OVERWRITES Na__LayoutEditor__Panel__Styles__.js's handler and silently breaks every architectural Render Composites checkbox.
- Renumber every new decision from SC18. The register in TrueVision__PLAN__SitePlanComposites__.md already holds SC15, SC16 and SC17; SC17 already decides the location-plan greyscale (desaturate, not hide) and SC11 already decides the > 500 threshold, so neither needs a new id or a round trip to Adam.

---

## Judge 5 - winner: **minimal**

| Approach | Score | Why | Fatal flaw |
|---|---|---|---|
| minimal | 8 | Every symbol it names is real and every claim about what a function does checks out — including the one hop nobody else traced explicitly, that patch.styles filters through Na__LeModel__STYLE_KEYS which literally IS Na__LeRec__STYLE_KEYS (verified in Na__LayoutEditor__SheetModel__State__.js line 101). Smallest blast radius: the rank prefix goes into style.key ONLY when siteRules is present, so the architectural bucket keys are byte-for-byte what they are today, not merely equivalent. STEP 3 — add the fifth parameter, pass it from nowhere, reload an architectural sheet and confirm it is pixel-identical — is the strongest single de-risking move in the whole set. Decisively, its STEP 0 is the ONLY phase-zero in the three that can run today: I confirmed PS02__MustersRoad__OfficialPdPack holds PS01__TrueVision__SitePlan__ExistingBuildings__FillModel__.glb (the one real 5-point ring), so hand-editing that manifest's Layer__Style.FillHex and opening 127.0.0.1:8523 closes finding F5 with no SketchUp, no re-export and no Adam. Clean and perf both open by blocking on Adam, which SC03 makes a hard stop. Steps 0-8 are all solo-executable and the human-blocked SSOT/Ruby work is correctly isolated at STEP 9. Correctly refuses to re-ask Adam about the 1:500 threshold, and correctly reasons that REQ-31's hard three-deck stack means PaintSitePlan needs one pass inserted, not a restructure. Marked down for three things: its merge-preservation argument is oversold (once every layer carries a distinct Z the rank prefix splits nearly every bucket anyway, so the merge survives only for F2's genuinely-indistinguishable pairs); its own risk note claims LocationPlan__NeutralColourHex must be one of the nine EdgeStyles aliases or it paints black, which is wrong about its own design — it substitutes the hex straight into the band and never touches Na__LeEdge__AliasForHex, so the whitelist does not apply; and it leaves the ForceRender stale-path bug as an 'optional one-line fix' when the other two close it properly. | - |
| clean | 6 | The best architecture of the three and the best single idea in the set: one ordering authority producing Plan__Ops that both painters consume unchanged, so screen and paper cannot disagree because there is no second ordering decision to get wrong. Band-major/Z-minor is the correct reading of REQ-31 and makes REQ-10 fall out as two independent sorts. Its cost argument for abandoning the merge is evidence-based and I verified it (PS01 is 10+364+394+3+14 = 785 segments across 5 layers). Its even-odd PDF fix is the only one in the set that actually closes the screen/paper hole disagreement the brief names, and I verified every premise in the vendored jspdf.umd.js. It is also the only design that spots that once Na__LeComposite__Rows takes a scope, Na__LeComposite__Row(key) must be backed by a new unfiltered AllRows(). But on the buildability lens it loses badly. PHASE 0 is declared 'do not proceed until seen' and requires Adam to re-export PS01 — a hard stop under SC03 that PS02 makes unnecessary. There is a genuine specification gap: PaintSitePlan is rewritten to walk plan.Plan__Ops, but the screen path is FillSitePlan -> SitePlanBuild -> PaintSitePlan(built) and Plan is only named on SitePlanDrawing (the PDF path), so where Na__LeSpComp__Plan is called on screen is never stated and the implementing agent must re-decide it. It duplicates Na__LePdf__DrawLinework's transform/minSegmentPaperMm-cull/frame-reject loop inside Na__LePdf__DrawSitePlanPlan, which undercuts the one-authority claim on paper. It is by far the largest surface — new module and config, PaintSitePlan rewritten, RingPathData and DrawSitePlanFills deleted, a new SheetChrome primitive kind, the normaliser literal turned into a loop, and four new RenderComposites exports — with phases 2-4 each touching several load-bearing shared files at once. It ships three toggles where Adam asked for two, in a document whose prime rule is 'do not drift from section 1'. And it widens LayoutEditor__Scales__SitePlanScaleDenominators to [100,200,500,1250,2500] in PHASE 5 without perf's guard, which I confirmed blanks a new 1:200 viewport silently. | Its prescribed rule for the new Na__LeRec__NormaliseViewport loop is wrong against the real key list. Na__LeRec__STYLE_KEYS contains 'contextLayer', which has no Composite__Key row (the eight are projectedLinework, profileLinework, sectionOutline, hiddenLines, glassOpaque, whitecard, enhanceWhitecard, baseImage — verified in Na__LayoutEditor__RenderComposites__.js FALLBACK and the config). Under clean's stated rule — 'a key whose row is unknown is kept if present and not added if absent' — contextLayer stops being written onto any viewport that lacks it, silently, on a normaliser that runs on every load of every project. The design correctly calls this the highest-blast-radius edit in the build, but the rule it hands the implementer is the defect. |
| perf | 7 | Technically the sharpest reading of the code, and it carries two findings nobody else has, both of which I confirmed are real. First: Na__LeVp2d__SitePlanToken keys on SitePlan__ExportedIso alone, and the documented local test loop (plan section 3.4) is hand-editing the repo manifest on 127.0.0.1, where ExportedIso does not move — so a Z-index change would repaint from the 16-entry path cache. Its Na__SpStore__GetOrderToken, memoised on the descriptor at Describe time, is the right fix and nobody else has it. Second: Na__LePanelViewport__AddSitePlan's off-map loop at line 258 has no Layer__VisibleAtScales.length > 0 guard, and I confirmed every PS01 layer lists exactly [500, 1250] — so REQ-33's new 100/200/2500 scales would switch every layer off and paint a blank 1:200 viewport with no error. Clean ships that scale widening without the guard; perf is the only design that catches it. Its (z, styleKey) tuple bucket is argued more rigorously than minimal's equivalent, correctly preserving the indices === null fast path that lets Na__PlOverlay__BuildPathData walk the raw Float32Array. Its ForceRender fix sweeps the token both before and after Reload(), the most careful version in the set. Its diagnosis of the paint-key trap is the sharpest — Na__LeComposite__Token reads only Viewport__CompositeWeights, verified — and its resolution (a separate three-character token compared inside FillSitePlan's existing early-out, deliberately kept OUT of built.key so the feature adds no BandPaths entries) is the best cache thinking here. It is also right that the new panel can reuse the existing 'style-toggle' delegated control with zero new plumbing: Na__LePanels__OnControl is a Map keyed event:name and the handler is selection-based and panel-agnostic. Best test discipline too — snapshot the band array with spec === null and assert byte-identical. Held back by: it blocks PHASE 1 on Adam re-exporting PS01 when PS02 makes that unnecessary; it filters the screen by DOM state and the paper by a gate in DrawViewport, two mechanisms for one rule; it deliberately ships the location-plan greyscale disabled (LocationPlanGreyscaleAlias null), leaving half of REQ-28/SC17 unbuilt and an open question back to Adam; and it ships three toggles where Adam asked for two. | The screen toggle does not work as written. Perf's headline performance claim is that a toggle costs 'three hidden assignments' on state.spGroups, which are <g> elements inside the linework SVG. But `hidden` is an IDL attribute of HTMLElement and SVGElement does not implement it — it is not in the HTMLOrSVGElement mixin. Assigning `.hidden = true` to an SVG <g> sets a JS expando and no attribute, so nothing is hidden. The result is that Solid Fills toggled off would still paint on screen while Na__LePdf__DrawViewport's separate `!== false` gate correctly suppressed it on paper — the exact screen/paper divergence this build exists to remove, and invisible to any PDF-only test. It is a one-line fix at implementation time (setAttribute('display','none') or a class), but the design names the mechanism explicitly and an agent would build it literally. |

**Verdict.** minimal wins on the buildability lens, but it should absorb roughly a third of the other two before anyone starts.

Nothing in minimal is factually wrong about the codebase. I checked every symbol it names and every claim it makes about what a function does, and all of them hold: StyleBands really takes four parameters and buckets on hex|width|dash; ForgetPaths really exists and really is not exported; SitePlanBuild really is not exported and really does not need to be; patch.styles really filters through Na__LeRec__STYLE_KEYS via the Na__LeModel__STYLE_KEYS alias. Clean and perf are also almost entirely accurate — this is a strong field — but each prescribes one concrete step that would ship a defect (clean's contextLayer rule in the normaliser loop, perf's .hidden on an SVGElement), and minimal prescribes none.

The decisive difference is the order of work, which is what this lens asks about. Minimal's STEP 0 closes finding F5 today: I confirmed PS02 holds the ExistingBuildings fill GLB with its single real ring, so hand-editing that manifest's FillHex and opening 127.0.0.1:8523 proves a fill paints on screen and in a PDF with no SketchUp, no re-export and no Adam. Clean's PHASE 0 and perf's PHASE 1 both open by asking Adam to re-export PS01 and both say not to proceed until he has — which under SC03 stops the build dead on a human turn that PS02 removes. Minimal then keeps every step solo-executable through STEP 8 and isolates the SSOT and Ruby work at STEP 9 behind an explicit STOP AND ASK ADAM. That is the shape a multi-session hand-off needs.

Minimal is also the only design that can honestly claim the architectural path is untouched. Putting the rank prefix into style.key only when siteRules is present means the architectural bucket keys are byte-identical strings, not merely equivalent partitions — so STEP 3's 'add the parameter, pass it from nowhere, confirm pixel-identical' is a real proof rather than a hopeful one.

Where clean is right and minimal is wrong-ish: clean's single ordering authority is the better long-term shape, and its even-odd PDF fix is the only one of the three that actually closes the hole divergence the brief names. Minimal's decision to leave the PDF's ring.outer skip alone and just warn is defensible on blast-radius grounds today, but it knowingly leaves the screen and the paper disagreeing on the one thing the brief singles out, and the fix turns out to be cheap and verified.

Where perf is right and minimal is wrong: the SitePlanToken staleness on a hand-edited manifest, and the AddSitePlan blank-viewport guard. Both are real, both are one line, and neither is in minimal.

Recommendation: build minimal's phase order and minimal's StyleBands hook exactly as written, then graft the items below. The one thing to change in minimal itself before starting is to delete its risk note about LocationPlan__NeutralColourHex needing to be in the nine-alias palette — that note describes a hazard its own design does not have, and leaving it in will send a later reader looking for a constraint that is not there.

**Graft from the losers:**

- From perf: Na__SpStore__GetOrderToken() folded into Na__LeVp2d__SitePlanToken. Minimal's reasoning that 'the Z values are fully determined by SitePlan__ExportedIso, already in the token' is true for a published manifest and false for the documented local test loop, where the whole method is to hand-edit the repo manifest on 127.0.0.1 with ExportedIso untouched. Memoise the token on the descriptor at Describe time, not per paint.
- From perf: the Layer__VisibleAtScales.length > 0 guard in Na__LePanelViewport__AddSitePlan. I confirmed line 258 has no guard and that every PS01 layer lists exactly [500, 1250], so the moment REQ-33's 100/200/2500 scales land, a new 1:200 site plan viewport switches every layer off and paints blank with no error. This must ship in the same commit as any scale-list widening.
- From perf and clean: close the ForceRender stale-path bug properly rather than leaving it as minimal's 'optional one-line fix'. Perf's version is the better one — export Na__LeVp2d__ForgetPaths and call it on the SitePlanToken computed BOTH before and after Na__SpStore__Reload(), so both generations are swept. Minimal's own build makes this likelier to be hit, so it should not be optional.
- From clean: the even-odd PDF fill. Both clean and perf verified the same three facts in the vendored jspdf.umd.js and I confirmed all three — putStyle returns early on style === null, 'f*' is in isValidStyle, and API.fillEvenOdd emits it with no advancedApiModeTrap. Accumulate every ring as a paintless subpath and fill once, drop the `if (!ring.outer) return` skip. Minimal's decision to warn and defer is over-cautious given that the fix is small, verified, and closes the exact screen/paper divergence the brief names. Clean's placement of it as a new Na__LeChrome__PushPolygonRings primitive in SheetChrome (rather than hand-rolled in the exporter) is also the right home.
- From clean and perf: the hard PDF constraint that goes with that fix — the fill colour and the GState alpha must be set BEFORE the first moveTo, because PDF forbids other operators between path construction and the painting operator. Na__LeChrome__WithOpacity must wrap the whole ring emission, not each ring. Neither minimal nor its risk list mentions this and it is the way the even-odd fix fails in the wild.
- From perf: the test invariant. 'Snapshot Na__LeVp2d__StyleBands's band array for a classes+owners fixture and assert it is identical with spec === null before and after' is a better regression test than minimal's re-implementation of the bucket rules in the test file, because it tests the real function rather than a copy of its logic that can drift. Keep minimal's Na__SpStore__ZIndex branch tests (PS01's 20/40/70/71/90 -> 2/4/7/8/9 — I verified those are the real manifest values and the arithmetic holds).
- From perf: do not fold the composite toggles into built.key, and say so in a code comment. Minimal already puts them in the paint key rather than the build key, but perf's explicit note — that keeping them out means the feature adds NO entries to the 16-entry FIFO, so a later reader must not 'fix' it by raising the cap — is worth carrying into the code, because minimal's own risk list worries about eviction pressure that this choice removes.
- From clean: Na__LeComposite__AllRows(). If the Rows() filtering ever moves from the panels into the module (minimal keeps it in the panels, which is fine today), Na__LeComposite__Row(key) must be backed by an unfiltered list or the new site plan keys become unknown rows. Worth a one-line note in the RenderComposites config Meta so the next person does not trip on it.
- From clean: Layer__ZIndexSource ('manifest' vs 'derived'). Minimal derives ceil(DrawOrder/10) silently. Since the derived value for PS01's red line is 9 and Adam's stated value is 10, any future UI that shows a Z must be able to say the number was inferred, or he will read a correct fallback as a bug. One extra field on the layer, no pipeline cost.
- From perf, as a caution rather than a graft: do NOT implement any toggle by assigning .hidden to an SVG <g>. hidden is an IDL attribute of HTMLElement and SVGElement does not implement it, so the assignment sets an expando and paints nothing. Minimal gates the <g> emission at paint time instead, which is correct — this note is to stop an implementer 'optimising' minimal's repaint into perf's DOM hide later.

---

# Adversarial critiques (BINDING - fold these in before building)

## Critique of `two-stores` - verdict: **buildable-with-fixes**

### 1. The design deletes Na__SpStore__GetDescriptor but never mentions one of its two live call sites, in a file it does list as edited. Na__LayoutEditor__Panel__ViewportSettings__.js imports it and uses it to build the SitePlanReady note and to decide whether the Add Site Plan Viewport button is enabled. The design's ViewportSettings entry covers StoreOptions, the two selects, AddSitePlan and the change handler, and nothing else in Refresh. Left as written the module fails to link and Na__Verify__Exports__.mjs fails on the named import.

**Evidence.** D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js line 143 imports `Na__SpStore__GetDescriptor`; line 452 `const descriptor = Na__SpStore__GetDescriptor();` then line 456-458 `note.textContent = (status === Na__SpStore__STATUS_READY && descriptor) ? Na__LeCfg__FormatLabel('SitePlanReady', ..., { count : descriptor.SitePlan__Layers.length, date : Na__LePanelViewport__ExportDate(descriptor.SitePlan__ExportedIso) }) : ...`. The verifier's own PASS line reads "every named import resolves to a real export, and every Na__ identifier used is imported or declared."

**Fix.** Add to the ViewportSettings entry: replace line 452's GetDescriptor with Na__SpStore__GetStore(<the add select's value, else Na__SpStore__GetDefaultStoreId()>), and say what the note reads when two stores exist (it currently states one layer count and one export date for the whole project). Also decide what disables the Add button when the chosen store is missing.

### 2. Na__SpStore__Resolve()'s resolved value is left undefined while two call sites branch on it, and the obvious Map-of-stores reading makes both branches dead. The design replaces `let Na__SpStore__Descriptor` (the value Resolve resolves to) with a Map plus an order array, lists every other signature change in a table, and omits Resolve. If Resolve now resolves to the array or the Map, `[]` and `new Map()` are truthy, so both existing "the project has no site plan data" guards silently stop firing.

**Evidence.** D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js line 178-180: `const descriptor = await Na__SpStore__Resolve(); if (!descriptor) return null; await Na__SpStore__LoadAll();` — this is Na__LeVp2d__SitePlanDrawing, the PDF's only site plan entry point. And Na__LayoutEditor__Panel__ViewportSettings__.js line 249-254: `const descriptor = await Na__SpStore__Resolve(); if (!descriptor) { ...toast(SitePlanNoData, true); return null; }`. Today Resolve returns `Na__SpStore__Descriptor`, which is null on an empty project (Na__SitePlan__Store__.js lines 334-356).

**Fix.** State Resolve's new contract explicitly in the signature table. Simplest: it resolves to the store COUNT or to Na__SpStore__GetStore(Na__SpStore__GetDefaultStoreId()) (null when there is none), and both call sites keep their falsy guard unchanged. Whatever is chosen, the PDF guard and the AddSitePlan toast must be re-derived, not left to the implementer.

### 3. The missing-store path is added to the screen only, so screen and PDF disagree and the strict-mode PDF guard cannot fire. The design adds the `Na__SpStore__GetStore(resolvedId) === null` test to Na__LeVp2d__FillSitePlan alone. Na__LeVp2d__SitePlanBuild never returns null for an unknown store — it returns a fully-formed build with an empty segment array — so the PDF receives a truthy `drawing` and prints a silent blank frame while the frame on screen says the store is missing. STEP 7 only tests the screen; STEP 8 would pass on a blank.

**Evidence.** Na__LayoutEditor__Viewport2d__SitePlan__.js Na__LeVp2d__SitePlanBuild: only `if (!descriptor) return null;` exits early; with zero layers `total` is 0, `const segments = new Float32Array(total * 4)` is empty and it returns `{ classes, fills : [], key }`. Na__LayoutEditor__PdfExporter__.js line 274-280: `const drawing = await Na__LeVp2d__SitePlanDrawing(viewport); if (!drawing && options && options.strict) throw new Error('Site plan drawing could not be rendered.'); if (drawing) { Na__LePdf__DrawSitePlanFills(...); Na__LePdf__DrawLinework(...); }`.

**Fix.** Put the unknown-store test in Na__LeVp2d__SitePlanDrawing as well (return null, so strict throws), or have Na__LeVp2d__SitePlanBuild return null when Na__SpStore__GetStore(storeId) is null and let FillSitePlan distinguish "missing store" from "still loading" by asking GetStore itself. Add a PDF assertion to STEP 7, not just STEP 8.

### 4. The pipeline section contradicts itself and STEP 9's acceptance test is therefore unpassable as written. It says discover_truevision_siteplan_stores "adds SitePlan__StoreId, SitePlan__StoreLabel, SitePlan__IsLegacyFolder to the returned dict", the NEW KEYS register lists all three under SitePlan__DataStore, and the same paragraph plus STEP 9 require SitePlan__DataStore to be "in exactly today's shape" and "byte-identical to its previous content".

**Evidence.** D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py lines 527-534 return exactly six keys: SitePlan__FolderName, SitePlan__ManifestUrl, SitePlan__ExportedIso, SitePlan__NorthAngleDeg, SitePlan__BoundsMm, SitePlan__Layers. The design's NEW KEYS list contains `SitePlan__DataStore.SitePlan__StoreId`, `SitePlan__DataStore.SitePlan__StoreLabel`, `SitePlan__DataStore.SitePlan__IsLegacyFolder`.

**Fix.** Pick one. Either generate_truevision_project_data writes SitePlan__DataStore as the six-key projection of the default store (drop the three from that copy, keep them in SitePlan__DataStores), and remove the three SitePlan__DataStore.* entries from the NEW KEYS register; or drop the byte-identity claim and rewrite STEP 9's test as "the six legacy keys are unchanged". The app tolerates either, since Na__SpStore__Describe picks named keys.

### 5. Na__Test__SitePlanStores__.test.mjs cannot be written the way it is specified. The repo's only working Node-test technique copies ONE module to a temp .mjs and imports it, which works only for a module that imports nothing. Five of the seven assertions target functions the design places in modules with imports: StoreKey and ResolveStoreId in Na__SitePlan__Store__.js, and the compatibility invariant (6) in Na__LayoutEditor__SheetRecords__.js. A copied file's relative imports do not resolve from the temp directory, and Node reads the app's .js as CommonJS. There is no package.json with "type":"module" anywhere in the app.

**Evidence.** Na__Test__DrawingPlanes__.test.mjs header: "The maths module imports nothing, so it runs here exactly as the app runs it. Node 20 reads the app's .js modules as CommonJS, so the module is copied to a temporary .mjs first" — then `copyFileSync(join(SYSTEM, 'Na__DrawingPlanes__Maths__.js'), join(SCRATCH, 'Maths.mjs')); const maths = await import(...)`. Na__Test__FloorPlanStoreyLevel__ and Na__Test__TitleBlockCells__ do the same. Na__LayoutEditor__SheetRecords__.js carries relative imports at lines 205, 218, 219, 227, 236, 241, 242, 244, 245, 246; Na__SitePlan__Store__.js imports Na__CloudflareIntegration__ApiClient__.js, Na__AppUtils__ProjectLoader.js and Na__SitePlan__GlbParse__.js at lines 61-67. `find . -maxdepth 2 -name package.json` returns nothing.

**Fix.** Put Na__SpStore__StoreKey, ResolveStoreId (as a pure function of the marker object plus a store-id list), IdentifyFolder and DefaultVariantId in the no-imports leaf Na__SitePlan__StoresConfig__.js and have Na__SitePlan__Store__.js import them — then assertions 1-5 and 7 test a real leaf. For assertion 6, the byte-identity invariant, either copy only the site plan branch's logic (and accept it is a mirror, which is the fault the storey-level unit test already made) or prove it in the browser as part of STEP 0/STEP 2 by diffing the saved sheet JSON.

### 6. The canonical folder name is hand-held in seven places, not the four the design counts, and the two it misses are the ones that actually decide where an Existing export lands. Na__SitePlan__ChooseFolder reads the name from the Tags SSOT, not from the GLB Builder portal config the design extends, and its 30__TrueVision__AppContent shortcut hard-creates that one folder. So an Existing export taken through the shortcut silently lands in the Proposed/legacy folder, and every deliberate Existing export trips the "export anyway?" warning.

**Evidence.** Na__TrueVision__GlbBuilder__SitePlanExport__.rb line 63 `NA__SITEPLAN__CONFIG_DEFAULTS = { 'ExportFolderName' => 'SitePlan__DrawingData', ... }`, overridden at line 173-180 from the SSOT; Na__DataLib__CoreIndex__Tags__.json line 1094-1099 `"SitePlanExportConfig": { ... "ExportFolderName": "SitePlan__DrawingData" }`. Na__SitePlan__ChooseFolder lines 512-536: `folder_name = config['ExportFolderName']` ... `if File.basename(dir) == NA__SITEPLAN__TV_CONTENT_FOLDER then dir = File.join(dir, folder_name); FileUtils.mkdir_p(dir)` ... `unless File.basename(dir) == folder_name ... UI.messagebox("The pipeline only publishes site plan data from a folder named #{folder_name}. Export into ... anyway?")`.

**Fix.** Na__SitePlan__ResolveTargetFolder must replace BOTH behaviours: the shortcut must create the folder for the resolved variant, and the equality warning must become "matches no known variant" against the variant table. Name Na__DataLib__CoreIndex__Tags__.json's SitePlanExportConfig.ExportFolderName and NA__SITEPLAN__CONFIG_DEFAULTS in Meta__WhereElseThisLives, and say whether ExportFolderName stays as the legacy/proposed default or is deprecated.

**Missing pieces:**

- "Per SC26 the folder decides" cites a decision that does not exist. The register in section 2 of TrueVision__PLAN__SitePlanComposites__.md ends at SC17, and this design itself proposes SC18-SC21. Neither document contains an SC26. Renumber before handover or the next agent hunts for it.
- REQ-34's guard degrades exactly where it matters most. Na__PortalMapper__InspectSitePlanFolder is specified to read "the variant from that folder's own manifest", but SitePlanData__Variant is written for the first time by this release's exporter. PS01's and RB05's existing TrueVision__SitePlanData__Manifest__.json have no such key, so the quoted modal ("This folder holds 6 GLBs for the Existing site plan") has no variant to print on the first export into a legacy folder. Specify the unknown-variant branch of the modal and make the folder name the primary signal.
- Two imports the file list does not mention, both enforced by Na__Verify__Exports__.mjs ("every Na__ identifier used is imported or declared"): Na__LayoutEditor__EdgeStyles__.js must add Na__SpStore__ResolveStoreId to its import from Na__SitePlan__Store__.js (the design has Na__LeEdge__Effective calling it but its file entry does not say so), and Na__LayoutEditor__Panel__ModelLayers__.js line 70 currently imports only Na__LeSource__CategoryKeys and must add Na__LeSource__SitePlanStoreId.
- Na__LeEdge__Effective is on the hot path for EVERY viewport, not just site plan ones: Na__LayoutEditor__Viewport2d__Linework__.js line 267 calls it once per owner id inside Na__LeVp2d__StyleBands. Adding a Na__SpStore__ResolveStoreId call inside it puts a Map lookup and a default-store computation on every architectural viewport's band resolution. Not a break, but GetDefaultStoreId should be memoised per resolve generation rather than recomputed.
- Switching a viewport's store carries its curation across, because both record maps are keyed by bare Layer__CategoryKey and site plan keys are exempt from pruning (Na__LeRec__SITEPLAN_CATEGORY_PREFIX in Na__LeRec__NormaliseProjectedEdges). A red-line weight or colour override authored against Proposed applies unchanged to Existing, and a layer switched off in Proposed stays off in Existing. The design says it deliberately does not re-preset the toggles; say the same about the edge overrides, and tell Adam, because on a planning drawing this is the same class of risk as painting the wrong scheme.
- STEP 4's fixture creates a permanently failing layer rather than a clean second store. Copying the manifest while deleting the RedLineBoundary GLB leaves Layer__LineworkFile listed, so Na__SpStore__Layer keeps the layer (it only drops one with no linework URL), Na__SpStore__LoadLayer 404s on both the local and CDN candidates, and the console logs 'Site plan layer ... did not load.' every refresh while the Model Layers panel shows a row that never paints. Delete the manifest entry as well, or the fixture's noise will be read as a two-store fault.
- No step proves REQ-27 against a SAVED record. STEP 0 captures a screenshot and STEP 2 compares pixels, but nothing diffs the sheet JSON before and after. Add to STEP 5: open PS01's site plan sheet, save, and diff the sheets file against a copy taken at STEP 0 — Viewport__SitePlan must still serialise as {}. That is the one assertion that protects every already-published sheet, and it is currently only a Node test that (per fatal problem 5) cannot be written as specified.

---

## Critique of `ssot-tags` - verdict: **buildable-with-fixes**

### 1. The bucket-by-stem refactor crashes the exporter as specified. The design says `owner` becomes the stem and that buckets/skipped/warnings/Write re-key by stem, while `ctx[:layers]` "stays `by_tag` (it is what recognises a tag name)". But `Na__SitePlan__Collect` does not only *recognise* with `ctx[:layers]` - it *constructs the bucket* from it, indexed by `owner`. With `owner` a stem, `ctx[:layers][owner]` is `by_tag[stem]` = nil, so the bucket is built with `defn: nil`.

**Evidence.** Na__TrueVision__GlbBuilder__SitePlanExport__.rb:322 and :326 - `bucket = (ctx[:buckets][owner] ||= self.Na__SitePlan__NewBucket(ctx[:layers][owner]))`, immediately followed at :327 by `if bucket[:defn][:fills]`. The same nil `defn` is then dereferenced at :402 (`bucket[:defn][:fills]` in Na__SitePlan__Warnings), :475 (Na__SitePlan__SummaryText) and :627/:654 (`defn[:stem]`, `defn[:tag_name]` in Na__SitePlan__Write). This is step 6 of the order of work - the step the design itself calls "the one genuinely risky code change".

**Fix.** State explicitly that both bucket-creation sites at :322 and :326 change to `self.Na__SitePlan__NewBucket(ctx[:by_stem][owner])`, and that `Na__SitePlan__Scan` stores `by_stem` in `ctx` alongside `layers`. Keep `ctx[:layers] = by_tag` only for the `.key?(tag_name)` test at :309 and for `excluded.reject { |name| layer_defs.key?(name) }`; `owner` then becomes `ctx[:layers].key?(tag_name) ? ctx[:layers][tag_name][:stem] : current_tag`.

### 2. REQ-33 is left unimplemented, and the mechanism the design uses for it is dead config. `SitePlanExportConfig.SupportedScaleDenominators` is read by nothing - not the exporter, not the build script, not the app. Widening it to [100,200,500,1250,2500] changes no behaviour at all, so no 1:100 / 1:200 / 1:2500 site plan viewport can be created after this build. Three further claims fall with it: the risk "the two edits must not be separated" (the premise is false), the justification for widening every `SitePlan__VisibleAtScales`, and test assertion (9), which validates the widened arrays against a key nothing reads while the real list goes untested - a green test over an impossible viewport.

**Evidence.** `Na__SitePlan__Config` (SitePlanExport.rb:173-181) copies only `NA__SITEPLAN__CONFIG_DEFAULTS.each_key`, and that hash (:62-68) holds exactly ExportFolderName, ManifestFileName, LineworkFileSuffix, FillFileSuffix, ExportIgnoresTagVisibility. A grep of na-apps + the Plugins tree finds `SupportedScaleDenominators` only in the SSOT itself (Tags__.json:1104), the two survey/plan docs and two stale caches - no reader. The app's list is `Na__LeScale__SitePlanSetup()` (Na__LayoutEditor__ScaleManager__.js:74-79) -> `setup.sitePlanDenominators` -> `Na__LayoutEditor__AppConfig__.json:158 "LayoutEditor__Scales__SitePlanScaleDenominators": [500, 1250]`, consumed by `Na__LePanelViewport__AddSitePlan` at Panel__ViewportSettings__.js:255 and the scale dropdown at :309. The design never edits that file. The survey's own cross-cutting finding says this (Survey .md:2749: "TagNumberRange, TagNamePatternRegex and SupportedScaleDenominators are documentation - nothing in the Plugins folder reads them").

**Fix.** Add `Na__LayoutEditor__AppConfig__.json` to the files-changed list: `LayoutEditor__Scales__SitePlanScaleDenominators` -> [100, 200, 500, 1250, 2500], leave `LayoutEditor__Scales__SitePlanDefaultScaleDenominator` at 500, and update the `LayoutEditor__Scales__Description` prose. Keep the SSOT `SupportedScaleDenominators` edit as documentation but say so, and re-point test assertion (9) at the AppConfig key (or assert the two lists agree).

### 3. REQ-10 is not met, and the design's own store change guarantees it is violated. Section 2 claims the split Waterbodies 5/3 vs Trees 4/4 "is the whole of REQ-10". But fill paint order is the store's layer order, and this design re-sorts the store by `Layer__ZIndexLine`. Waterbodies (ZL 5) therefore sorts after Trees/MixedWoodland (ZL 4), so the water wash paints over the woodland wash - the exact inversion Adam asked for. `SitePlan__ZIndexFill` is written into the SSOT, the manifest, the build script and the store, and then read by nothing. Because the design also sets `SitePlan__FillOpacity: 1.00` on Waterbodies, MixedWoodland, Trees__Existing and HedgesAndPlanting, the occlusion is total rather than a tint.

**Evidence.** `Na__LeVp2d__SitePlanBuild` (Na__LayoutEditor__Viewport2d__SitePlan__.js:146-166) builds `fills` by mapping `loaded`, which is `descriptor.SitePlan__Layers.filter(...)` in store order; `Na__LeVp2d__PaintSitePlan` (:212-215) emits them with `built.fills.forEach`, first emitted = furthest back. `Na__LePdf__DrawSitePlanFills` (Na__LayoutEditor__PdfExporter__.js:246-262) walks the same array in the same order. The design's change to `Na__SpStore__Describe`'s sort is `(a.Layer__ZIndexLine - b.Layer__ZIndexLine) || (a.Layer__DrawOrder - b.Layer__DrawOrder)` - ZIndexFill appears nowhere in it.

**Fix.** Either (a) state plainly in section 2 and in the plan doc ledger that REQ-10 is NOT satisfied by this pass and that ZIndexFill is inert until the painter pass, or (b) fold the two-line fill ordering into this pass: sort `fills` by `Layer__ZIndexFill` inside `Na__LeVp2d__SitePlanBuild` before the `.map()`, which fixes screen and PDF together because both consume that one array. (b) is cheap and makes the two new fields earn their place. Also reconsider `FillOpacity: 1.00` - an opaque wash contradicts the design's own MAT prose that "the drawing transparency lives only in SitePlan__FillOpacity".

### 4. Raising `Weight__Max` to 10.00 in this build makes the F1 fault on Adam's red line strictly worse, while the cure is deferred. The design's risk register says he will "see his 2.0 pt proposal painting over his 0.50 mm red line exactly as before". It will not be as before - it will be heavier. Today the proposal is clamped to 0.635 mm against a 0.50 mm red line; after step 5 it prints its full 0.706 mm and still sorts last.

**Evidence.** `Na__LeEdge__SitePlanDefault` (Na__LayoutEditor__EdgeStyles__.js:371) returns `style.LineWeightMm / master`, master = PtToMm(0.30) = 0.10584; `Na__LeEdge__ClampWeight` (:327-333) clamps to `Weight__Max`. 0.706/0.10584 = 6.670 -> 6.00 today, 6.67 after. Red line 0.50/0.10584 = 4.724. `Na__LeVp2d__StyleBands` (Na__LayoutEditor__Viewport2d__Linework__.js:295-297) sorts `(a, b) => a.style.widthMm - b.style.widthMm` and paints last-on-top, in both the sheet and the PDF.

**Fix.** Move the `Weight__Max` raise out of this pass into the painter pass that adds the z-ordered band branch, so the clamp is widened only when the z sort is there to keep the red line on top. If it must land here, say in the plan doc that the interim state is a visibly heavier proposal over the boundary, so Adam is not surprised into calling it a regression.

### 5. The rewritten `unused` expression in `Na__SitePlan__SummaryText` drops a term, so the pre-export dialog Adam reads starts lying about layers whose geometry was all hidden, soft or smooth. Such a layer would be counted as "nothing on them" *and* listed under Check - contradicting itself in the same dialog. Given finding F6 (a woodland whose edges are soft exports nothing at all), this is exactly the case RB05 is most likely to hit.

**Evidence.** SitePlanExport.rb:479 today reads `unused = scan[:layers].keys - buckets.keys - (scan[:skipped] || {}).keys`. The design specifies "`unused` in `SummaryText` becomes `by_stem.keys - buckets.keys`", omitting the `- skipped.keys` subtraction. `Na__SitePlan__CountSkipped` (:279-289) populates `ctx[:skipped]` for exactly the hidden/soft/smooth case.

**Fix.** Specify `unused = by_stem.keys - buckets.keys - (scan[:skipped] || {}).keys` - the skipped map is already re-keyed by stem by the same refactor, so the term still resolves.

### 6. The design mis-cites the function that protects a renamed layer's saved state, which could send an implementer to patch the wrong normaliser. It claims `Na__LeRec__NormaliseViewport` "exempts site plan categories from pruning". It does not - the site plan exemption is in `Na__LeRec__NormaliseProjectedEdges`, and it guards the per-viewport EDGE OVERRIDE map, not the layer toggle map. `Viewport__ModelLayers` is pruned by a rule that checks no registry at all: every `false` entry survives regardless of whether the key exists. The design's conclusion (stems must hold) is right; the reason given is wrong.

**Evidence.** Na__LayoutEditor__SheetRecords__.js:368 - `if (canPrune && key.indexOf(Na__LeRec__SITEPLAN_CATEGORY_PREFIX) !== 0 && weight === ... ) return;` inside `Na__LeRec__NormaliseProjectedEdges`. The `Viewport__ModelLayers` block is at :480-487: `Object.keys(modelLayers).forEach((key) => { if (modelLayers[key] === false) kept[key] = false; });` - no prefix test, no registry test.

**Fix.** Correct the citation: the layer toggle map survives because `NormaliseViewport` keeps every `false` key unconditionally (:480-487); the edge override map survives because `NormaliseProjectedEdges` exempts the `TrueVision__SitePlan__` prefix from the default-prune (:368). Both are keyed by the stem, which is why the stem must hold.

### 7. The named insertion point for the new materials series does not exist. The design instructs "New series block MAT800__SitePlanFillSeries__ inserted between MAT700__GlassSeries__ and MAT900__SceneEntourageSeries__". Nothing sits between those two - the file is not in numeric order, and MAT600__MetalSeries__ occupies that slot.

**Evidence.** Na__DataLib__CoreIndex__Materials__.json, `Na__DataLib__CoreIndex__Materials` key order as parsed: MAT000__DefaultSeries__, MAT010__ModelingUtilitySeries__, MAT100__BasicSeries__, MAT300__PaintSeries__, MAT500__TimberSeries__, MAT700__GlassSeries__, MAT600__MetalSeries__, MAT900__SceneEntourageSeries__.

**Fix.** Say "between MAT600__MetalSeries__ and MAT900__SceneEntourageSeries__". Nothing depends on order (`:all_non_default` at MaterialUtils__Run__.rb:313-314 rejects only NA_DEFAULT_SERIES_KEY and takes every other key), so this is purely about the edit landing where intended.

**Missing pieces:**

- `Na__LayoutEditor__AppConfig__.json` is absent from the files-changed list, yet `LayoutEditor__Scales__SitePlanScaleDenominators` (:158) and `LayoutEditor__Scales__SitePlanDefaultScaleDenominator` (:159) are the only things that decide which site plan scales exist. Without them REQ-33 cannot land.
- The Ruby refactor never says where `Na__SitePlan__NewBucket`, `Na__SitePlan__Warnings` (:402), `Na__SitePlan__SummaryText` (:475) and `Na__SitePlan__Write` (:627, :654) get their definition object from once buckets are keyed by stem. Name `ctx[:by_stem]` explicitly, and say `Na__SitePlan__Scan` must put it in `ctx`.
- `Layout__LineStyleName: "Dash"` appears only inside the sample entry for `73__SitePlan__Buildings__Proposed__Alterations`. The files-changed summary never mentions it, so an implementer working from that summary will drop it and the SketchUp tag will draw solid. ("Dash" is valid - it is in `LineStyleReference.AvailableLineStyles` and already used by five site plan tags.) State which of the 26 tags carry a `Layout__LineStyleName` and which value.
- The new `Na__Test__SitePlanTagsSsot__.test.mjs` lives in the TrueVision repo but reads three files from the SketchUp Plugins tree (a different repository). The design never says how the path is resolved - it will need a hard-coded `%APPDATA%/SketchUp/SketchUp 2026/SketchUp/Plugins/Na__Common__DataLib__CoreSuEntityStandards/` root and a defined behaviour when that folder is absent (skip vs fail). Assertion (8) also hard-codes 0.10584, which is derived from `LayoutEditor__Lineweights__ViewportPt: 0.30` in the AppConfig - read it, do not bake it.
- `SitePlan__FillHatchId` values `SitePlanHatch__MixedWoodland` / `SitePlanHatch__PondsAndLakes` name a library that is empty (52__LayoutEditor__HatchPatternLibrary holds only two PNGs and five empty pack folders) and a module folder that is empty (02__Src__AppModules/51__System__LayoutEditor/36__System__HatchPatternTools contains no files). The `FillHatchNote` prose asserts the id "names a pattern in the drawing editor's hatch pattern library", which is not true today. Mark it a forward declaration and fix the note's tense, or the next agent will go looking for a naming convention that has never been written.
- Nothing is said about what a renamed tag does to an existing model on "Create Standardised Tags". `Na__TagsManager__BuildTagsFromDataLib` creates one tag per `Tag__SketchUpName` and ignores `SitePlan__LegacyTagNames`, so RB05 (14 site plan tags today) will end up with the new name beside the old one in the Site Plan folder, the old one unstyled because it is no longer an SSOT entry. Harmless for export once buckets key by stem, but Adam should be told before he runs it.

---

## Critique of `panels` - verdict: **buildable-with-fixes**

### 1. THE REPAINT FIX IS AIMED AT THE WRONG KEY. The design folds Na__LeSpComp__Token / Na__LeHatch__Token into Na__LeVp2d__SitePlanPaintKey only. But the linework path strings are cached under a DIFFERENT key that the design never touches, and Na__LeVp2d__BandPaths returns a cache hit unconditionally — including a cached EMPTY array, which is truthy. Switching Site Plan Linework off and on again therefore leaves the viewport permanently empty of linework (on screen AND in the PDF, which re-derives from the same classes) until a full page reload. This is not self-healing: Force Render's site plan branch nulls state.lineworkKey but never calls Na__LeVp2d__ForgetPaths, and Na__SpStore__Reload does not change SitePlan__ExportedIso unless the model is re-exported, so the stale entry survives everything short of a reload or 16 competing cache keys.

**Evidence.** Na__LayoutEditor__Viewport2d__SitePlan__.js, Na__LeVp2d__PaintSitePlan: `const paths = Na__LeVp2d__BandPaths(built.key + '@false@' + styleToken, bands, built.classes);` — the cache key is `built.key`, i.e. `Na__LeVp2d__SitePlanToken(viewport)` = `'siteplan:' + descriptor.SitePlan__ExportedIso + ':' + Na__LeModelLayers__Token(viewport)`, plus `styleToken` = `Na__LeEdge__Token(viewport) + '#' + Na__LeComposite__Token(viewport)`. Na__LeEdge__Token reads only Na__LeEdge__Stored (Viewport__ProjectedEdges); Na__LeComposite__Token reads only viewport[Na__LeComposite__FIELD]. Neither can see Viewport__SitePlanComposites. Na__LayoutEditor__Viewport2d__Linework__.js, Na__LeVp2d__BandPaths: `let paths = Na__LeVp2d__PathCache.get(cacheKey); if (paths) return paths;` then `Na__LeVp2d__PathCache.set(cacheKey, paths);`. Na__LeVp2d__StyleBands skips a class with `if (!segments || segments.length < 4) return;`, so emptied classes produce `bands = []` and BandPaths caches `[]`. Verified in node: a cached `[]` is truthy and `p[0]` is `undefined`, and PaintSitePlan then does `const d = paths[index]; if (!d) return;` for every band. Na__LayoutEditor__Viewport2d__.js, Na__LeVp2d__ForceRender site plan branch: `state.lineworkKey = null; state.lineworkSvg = null; state.classes = null; state.classesKey = null;` — no Na__LeVp2d__ForgetPaths call.

**Fix.** Fold the new tokens into Na__LeVp2d__SitePlanToken itself — the function that produces `built.key` — rather than into Na__LeVp2d__SitePlanPaintKey. SitePlanPaintKey already begins with SitePlanToken, so it inherits the change for free, and `built.key` then also correctly re-keys the BandPaths cache, state.classesKey (the snap source) and anything else derived from the build identity. Add `Na__LeVp2d__ForgetPaths(built.key)` to the site plan branch of ForceRender as a belt-and-braces measure, and change `if (paths) return paths;` to `if (paths && paths.length === bands.length) return paths;` if a defensive fix in BandPaths is wanted too.

### 2. STEP 7 CANNOT BE BUILT OR RUN AS ORDERED: the Patterns panel imports a module that no step in this design creates. The design states outright that Na__LeHatchGen__PreviewMarkup comes from 'the generator module the sibling design writes', and the ORDER OF WORK never sequences that module. Registering Na__LePanelPatterns__Register() in Na__LayoutEditor__ModeController__.js (step 7) puts an unresolvable module specifier into the editor's static import graph, so the whole Layout Editor fails to load — not just the panel. Na__Verify__Exports__.mjs fails first, on an unresolved import.

**Evidence.** Design, file entry for Na__LayoutEditor__HatchPatterns__.js: '__PreviewMarkup is NOT defined here - it is imported from the generator module the sibling design writes'; and for Na__LayoutEditor__Panel__Patterns__.js: '__Tile(pattern, assigned, editable) ... whose thumb is Na__LeHatchGen__PreviewMarkup(pattern, scale, rotationDeg)'. No ORDER OF WORK step creates a Na__LeHatchGen module. Na__Verify__Exports__.mjs reports `FAIL - ${failures.length} unresolved name(s)` with `"name" from "from" -> reason` and `process.exit(1)`; the directory walk covers all of 02__Src__AppModules (`const SRC_ROOT = resolve(APP_ROOT, '02__Src__AppModules')`), and the ModeController already imports every panel statically (lines 197-208, e.g. `import { Na__LePanelStyles__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Styles__.js';`).

**Fix.** Name the generator module, its exact file path and the exact signature of its preview export as a hard precondition of step 7, and move it ahead of step 7 in the order of work. Alternatively give Na__LayoutEditor__HatchPatterns__.js its own minimal Na__LeHatch__PreviewMarkup (a plain-geometry swatch with no <defs> and no id, as the design already requires) so the panel has no cross-design import at all, and have the generator call that same function — which is the Na__LeGrad__ColourAt precedent the design cites.

### 3. TWO EDITED FILES ARE SPECIFIED WITHOUT THE IMPORTS THEY NEED, so Na__Verify__Exports__.mjs fails and UpdateViewport throws a ReferenceError the moment either new patch branch runs. The design's own CHECK list asks for exactly this and its file entries do not satisfy it.

**Evidence.** (a) Design, Na__LayoutEditor__SheetRecords__.js entry: 'Add two imports (Na__LeSpComp__FIELD/Row/Clamp from the new composites module; Na__LeHatch__FIELD/CAT_FIELD/Normalise from the hatch module)' — but the same entry specifies 'walks block[Na__LeSpComp__BLOCK]'. Na__LeSpComp__BLOCK is never imported. (b) Design, Na__LayoutEditor__SheetModel__Viewports__.js entry specifies no imports at all ('Two patch branches ... and add sitePlanComposites, sitePlanHatches to the patch vocabulary comment'), yet the branches are specified to use `viewport[Na__LeSpComp__FIELD]`, 'its SpComposites__Layers map', `Na__LeSpComp__Clamp`, `viewport[Na__LeHatch__FIELD]` and its Hatches__Layers map. That file's actual import block carries only `import { Na__LeEdge__FIELD, Na__LeEdge__CAT_FIELD } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';` and `import { Na__LeComposite__FIELD, Na__LeComposite__Clamp } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';`. Na__Verify__Exports__.mjs: `FAIL - ${undefinedUses.length} Na__ identifier(s) used but never imported or declared` / `process.exit(1)`; it strips string literals and import/export blocks first, so these are real uses, not filename noise.

**Fix.** Add Na__LeSpComp__BLOCK to the SheetRecords import list, and add to Na__LayoutEditor__SheetModel__Viewports__.js: `import { Na__LeSpComp__FIELD, Na__LeSpComp__BLOCK, Na__LeSpComp__Clamp } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';` and `import { Na__LeHatch__FIELD, Na__LeHatch__CAT_FIELD } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';` — beside the existing EdgeStyles/RenderComposites imports. Then move the `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` run from step 8 to the end of every step that edits a .js file.

### 4. THE PANEL TELLS ADAM SOMETHING THE DESIGN DOES NOT BUILD. The design adds a user-facing label asserting that a location plan draws only the proposed fills, and adds Na__LeSpComp__IsLocationPlan / Rules__LocationPlanAboveScale to back it — but the one paint-path edit it specifies honours only sitePlanFill, sitePlanPattern and sitePlanLinework. Nothing in FILES suppresses non-proposed fills or desaturates non-boundary linework at a coarse scale. On a 1:1250 viewport every fill is drawn exactly as at 1:500 while the panel states the opposite, which is worse than saying nothing: it makes a real REQ-28 regression read as already handled.

**Evidence.** Design, Na__LayoutEditor__AppConfig__.json entry: "LayoutEditor__Labels__SitePlanCompositeLocationNote 'Location Plan at 1:{scale} - only the proposed fills are drawn, whatever these say.'" and Na__LayoutEditor__Panel__SitePlanComposites__.js entry: '__Refresh(body) ... sets the location-plan note from Na__LeSpComp__IsLocationPlan'. The only paint edit is Na__LayoutEditor__Viewport2d__SitePlan__.js: 'the fills array is built only when Na__LeSpComp__IsOn(viewport, sitePlanFill) ... a parallel hatches array ... and the classes are emptied ... when Na__LeSpComp__IsOn(viewport, sitePlanLinework) is false' — no scale term. Plan doc REQ-28 and SC17 require the suppression; the survey's seam section 4 states the rule belongs in Na__LeVp2d__SitePlanBuild, 'Adding it in PaintSitePlan instead would fix the screen and silently NOT fix the paper'.

**Fix.** Either implement the rule in the same Na__LeVp2d__SitePlanBuild edit — filter `fills` to the proposed NewConstruction / Alterations categories when `Na__LeSpComp__IsLocationPlan(viewport)`, which is already imported there — or change the label to a forward-looking statement (e.g. 'Location Plan at 1:{scale} - fill rules for location plans are not in yet.') and move REQ-28 explicitly to the sibling composite design with a named owner. Note also that '{scale}' requires Na__LeCfg__FormatLabel, not Na__LeCfg__GetLabel.

**Missing pieces:**

- The Layer-select filter is a no-op. Na__LeSource__CategoryKeys(viewport) for a site plan viewport returns exactly `Na__SpStore__GetLayers().map((layer) => layer.Layer__CategoryKey)` (Na__LayoutEditor__ModelSource__.js), so 'Na__SpStore__GetLayers() intersected with Na__LeSource__CategoryKeys(viewport)' is the identity. It does NOT restrict the list to layers that can take a fill, which is what the panel's Labels__NoFillLayer implies. Either drop the intersection or state the real filter (rings present, or Layer__Style.FillHex non-null).
- Neither new panel is specified to hide itself at registration. Na__LePanelScrap__Register calls `Na__LePanels__SetSectionVisible(Na__LePanelScrap__ID, false)` immediately after RegisterSection, precisely so the section is not briefly present on a sheet that should not have it; the design's Register() specs for both new panels omit that line and rely solely on the window listener firing later. Add the explicit SetSectionVisible(id, false) plus a Sync() inside the existing Ready().then block.
- Na__LeSpComp__Factor's stated semantics collide with the mirrored module. RenderComposites' Clamp/Weight return null for a row whose Weight__Kind is 'none' and Factor then returns 1. sitePlanLinework is specified as kind 'none', so a literal mirror makes Factor(viewport,'sitePlanLinework') === 1 whether the toggle is on or off. The design only ever calls IsOn for that row, so nothing breaks today, but the 'one call answers both questions' claim is not true of a 'none' row and should be written down.
- Na__LeHatch__Ready() is deliberately left out of the Promise.all, but Na__LeHatch__Normalise is specified to clamp Hatch__Scale / Hatch__RotationDeg through Na__LeHatch__Bounds(), which falls back to hard-coded values until the config lands. The first sheet normalise therefore runs against the fallback bounds and would silently rewrite a stored scale that the config allows and the fallback does not — the same fault the design correctly guards against for Na__LeSpComp__Ready(). Either keep the two bound sets provably identical and say so in Meta__KeyStability, or make Normalise pass a value through untouched until the config is loaded (the Na__LeEdge__IsLoaded() / canPrune precedent in Na__LeRec__NormaliseProjectedEdges).
- SC09 tension worth putting to Adam rather than settling silently: 'properties' is registered first, so Na__LePanels__TabUp.right defaults to it and is remembered per column. A Patterns section on the Scrapbook tab is invisible whenever Properties is up — which is the tab a viewport selection leaves you on. The design's argument that FocusSection cannot switch tabs is correct (Na__LePanels__FocusSection returns early for any id outside LayoutEditor__Panels__AccordionSections, verified as ['text','dimensions','shapes','leaders']), but that argument shows Patterns will never be brought into view automatically either.
- Step 1's test target is right (386 files after one new .js; the verifier reports 385 today and passes), but it is only re-run at step 8. Steps 2, 4, 6 and 7 each edit .js and each can break it.

---

## Critique of `exporter` - verdict: **buildable-with-fixes**

### 1. The new Node test cannot be written as specified. Two of its four assertions ("a v1 manifest fixture still producing layers", "a fill-only layer surviving Na__SpStore__Layer", plus the Na__SpStore__ZIndexFromDrawOrder derivation) target module-private functions inside a module Node cannot load at all. The design's stated blocker names the wrong file: it says "Na__SitePlan__GlbParse__.js must be copied to .mjs first", but the described test never needs GlbParse - it needs Na__SitePlan__Store__.js, which is the one that cannot be loaded.

**Evidence.** Na__SitePlan__Store__.js export block (lines 472-491) lists exactly 19 names: CHANGED_EVENT, DATA_KEY, FOLDER, MANIFEST, the four STATUS_*, Resolve, Reload, LoadLayer, LoadAll, GetStatus, GetNote, GetDescriptor, GetLayers, GetLayerData, GetFocusBoundsMm. Na__SpStore__Layer, Na__SpStore__Describe and Na__SpStore__Style are NOT exported. I ran both import routes: (a) `await import(file:///...52__System__SitePlanData/Na__SitePlan__Store__.js)` -> "FAIL: Cannot use import statement outside a module"; (b) copied in place to __probe_store.mjs and imported -> "FAIL: Named export 'Na__AppUtils__GetProjectFolderFromUrl' not found. The requested module '../03__AppUtils/Na__AppUtils__ProjectLoader.js' is a CommonJS module". The store's header imports three app modules: Na__CloudflareIntegration__ApiClient__.js, Na__AppUtils__ProjectLoader.js, Na__SitePlan__GlbParse__.js - and ProjectLoader reads window.location at lines 64/65/80/89/98. The precedent the design copies, Na__Test__FloorPlanStoreyLevel__.test.mjs, works only because Na__FloorPlan__StoreyLevel__.js has ZERO import statements (grep -c '^import' = 0).

**Fix.** Either (a) extract Na__SpStore__Style, Na__SpStore__Layer and the new Na__SpStore__ZIndexFromDrawOrder into a new import-free leaf module - e.g. 02__Src__AppModules/52__System__SitePlanData/Na__SitePlan__LayerNormalise__.js, symbol prefix Na__SpNorm__ - which Na__SitePlan__Store__.js imports and the test copies to .mjs (the exact StoreyLevel pattern); or (b) cut the test back to the two assertions that need no app module (the SITEPLAN_FILE_PATTERN / NA__SITEPLAN__OLD_FILE_PATTERN equivalence, read out of the two source files as text, and the ceil/clamp arithmetic reimplemented in the test) and say so. Do not plan on importing Na__SitePlan__Store__.js from Node under any arrangement.

### 2. On the only local test route the plan document permits, TrueVision will never see either new store. The app resolves its descriptor from the LEGACY folder's manifest first on localhost, before it ever looks at SitePlan__DataStore - so after an export into SitePlan__DrawingData__Proposed, a project that still holds the legacy folder keeps painting the legacy data locally while the published site paints proposed. The design edits Na__SitePlan__Store__.js but leaves the folder constant and the lookup order untouched, and its step-9/11 tests only inspect the build script's JSON output, so the divergence is not caught anywhere in the order of work.

**Evidence.** Na__SitePlan__Store__.js: `const Na__SpStore__FOLDER = 'SitePlan__DrawingData';` (hard-coded, line ~84). Na__SpStore__FolderUrls() builds `const path = `${year}-Projects/${projectFolder}/${CONTENT_DIR}/${Na__SpStore__FOLDER}`` and returns `local : Na__AppUtils__IsRunningOnLocalhost() ? ... : null`. Na__SpStore__Find() then does, in this order: `if (folderUrls && folderUrls.local) { const local = await fromManifest(`${folderUrls.local}/${Na__SpStore__MANIFEST}`); if (local) return { descriptor : local, note : null }; }` and only AFTER that `const block = projectData ? projectData[Na__SpStore__DATA_KEY] : null;`. Na__AppUtils__ProjectLoader.js: `hostname === 'localhost' || hostname === '127.0.0.1'` - true for the 127.0.0.1:8523 URL that plan section 3.4 and the design's own step 6c mandate.

**Fix.** In the same step as the build-script two-store work, make the local manifest lookup store-aware: give Na__SpStore__FolderUrls a folder-name argument, and have Na__SpStore__Find try the store folders in the primary order (proposed, existing, legacy) rather than only 'SitePlan__DrawingData'. Add the site plan store folder names to the same single list the design already introduces, and state the rule in the design so the app and the build script agree on which folder is primary. Until that lands, add an explicit warning to step 5's test that local TrueVision will still show the old data.

### 3. The Export Polygon Faces tick is silently reverted by any model-status push, so Adam can tick it, do something else, and export without faces having seen the box ticked. The preference is written only inside the export handler, but the checkbox is specified to be restored from the model status - and Ruby re-pushes the model status after a model export, after Rescan Model, and on dialog ready.

**Evidence.** Design: "Na__Tvgb__ReceiveModelStatus sets the checkbox from status.site_plan_export_faces" and "Na__UserInterface__ActionExportSitePlan(dialog, params_json = nil) ... writes the faces preference via Na__SitePlan__SetExportFaces". In the real code, Na__UserInterface__ActionExportModel ends with `self.Na__UserInterface__PushModelStatus(dialog)`; Na__UserInterface__ActionRescanModel calls it; the `na_tvgb_dialog_ready` callback calls it. PushModelStatus executes `window.Na__Tvgb__ReceiveModelStatus(...)`. The three existing option checkboxes are untouched by that function - Na__Tvgb__ReceiveModelStatus only sets naTvgbState flags, na__tvgb__setText on six text nodes, and na__tvgb__renderManifest - so the new checkbox would behave unlike every one of its neighbours. Separately, Na__UserInterface__EmptyModelStatus (lines 766-787) is not in the design's change list and returns no site_plan_export_faces key, so on a scan failure or with no active model the checkbox clears to unchecked.

**Fix.** Persist on change, not at export time: give the row an onchange that dispatches a new action (e.g. 'set_site_plan_faces' with {exportPolygonFaces}) straight to Na__SitePlan__SetExportFaces, and keep the ReceiveModelStatus restore as the read-back. Add site_plan_export_faces to Na__UserInterface__EmptyModelStatus as well. Keeping it in collectExportParams is still worth doing as a belt-and-braces, but it must not be the only writer.

### 4. One file path in the FILES IT CHANGES list is wrong - it omits the Na__TrueVision__GlbBuilderUtility__Modules__ segment. An implementer following the list literally would create a second copy at the Plugins root that is never required and never hot-reloaded, which is precisely the fault the plugin's own 2.10.1 DevLog entry records for truevision_cloud_manager.rb ("was never required by Main.rb. It only loaded through the hot reloader's Dir.glob").

**Evidence.** The design lists `edit C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilder__UserInterface__ProjectActions__.rb` while every sibling entry carries `...\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\...`. `ls` on that exact path returns "No such file or directory"; the file is at ...\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__ProjectActions__.rb (618 lines). The reloader scopes itself with `rb_files = Dir.glob(File.join(NA_PLUGIN_ROOT, "*.rb"))` (Na__TrueVision__GlbBuilder__DynamicReloaderPluginUtil__.rb line 68), i.e. the Modules folder only.

**Fix.** Correct the path in the design's file list to the Modules folder before handing it to an implementer.

### 5. Two changes to Na__SitePlan__ChooseFolder are specified that its current signature cannot support, and the design's change list does not say the signature moves. It is called from exactly one place, so this is cheap to fix - but it has to be decided, not discovered mid-build.

**Evidence.** Current definition: `def self.Na__SitePlan__ChooseFolder(config)` - its only inputs are `config['ExportFolderName']`, `NA__SITEPLAN__PREFS_SECTION` and `NA__SITEPLAN__PREFS_KEY_DIR`. The design asks it to (a) "descend into the model's chosen store folder when it has one" - which needs the model, or at least a resolved store id - and (b) use the new variant-qualified key via Na__SitePlan__PrefsKeyDirFor(store_id) - which needs a store id. Neither is in scope in the function today. Its sole caller is Na__SitePlan__Run: `export_dir = self.Na__SitePlan__ChooseFolder(scan[:config])`.

**Fix.** State the new signature explicitly, e.g. Na__SitePlan__ChooseFolder(config, model, store_id = nil), and have Na__SitePlan__ResolveExportFolder pass the store id it has already resolved. Also say what happens to the existing 'SitePlanExportDir' default: the NEW KEYS list adds SitePlanExportDir__Existing and SitePlanExportDir__Proposed but names no legacy key, so the remembered folder is silently forgotten on first run after the upgrade.

### 6. Extending the truevision_r2_worker purge allow-list to the site plan store folders is not a neutral widening - it makes a hazard reachable that the design's risk register says is "not made worse here". Today a site plan store cannot be purged from the dialog at all; afterwards it can, and the purge deletes only the GLBs while leaving the manifest on R2, so the app's CDN manifest fallback then resolves a complete layer list whose every Layer__LineworkUrl 404s.

**Evidence.** truevision_r2_worker.py, manage(): the fetch branch keeps only `if folder.startswith('DesignPhase')` and the purge branch guards with `if not re.fullmatch(r'DesignPhase[A-Za-z0-9_ -]+', folder): raise ValueError('Select one design phase/scheme folder')`. The delete loop iterates `expected`, which comes from list_glbs(), which filters `key.lower().endswith('.glb')` - so TrueVision__SitePlanData__Manifest__.json is never deleted. Na__SpStore__Find()'s third step is `const remote = await fromManifest(`${folderUrls.cdn}/${Na__SpStore__MANIFEST}`)`, and Na__SpStore__Layer builds each Layer__LineworkUrl from `${folderUrls.cdn}/${raw.Layer__LineworkFile}` - all of which would then 404.

**Fix.** Either keep the purge fence at DesignPhase only and widen just the fetch/inventory filter (the design's stated motive - seeing what is on R2 for a store - needs only the fetch side), or extend the purge and make it delete the store's manifest alongside its GLBs. Say which, and record it as a decision rather than leaving both halves of purgeable_folder() to the implementer.

**Missing pieces:**

- Everything the design asserts about the Ruby exporter checks out by name: NA__SITEPLAN__CONFIG_DEFAULTS / EXPORTER_VERSION '1.1.1' / SCHEMA_VERSION 1 / OLD_FILE_PATTERN with the [A-Za-z0-9]+ stem / PREFS_SECTION / PREFS_KEY_DIR / TV_CONTENT_FOLDER all exist with those spellings; Na__SitePlan__Config really does iterate NA__SITEPLAN__CONFIG_DEFAULTS.each_key and drop an SSOT key with no default counterpart; Na__SitePlan__Collect's face branch really is `if bucket[:defn][:fills]` with `bucket[:faces_ignored] += 1` in the else (so the reworded warning genuinely cannot fire with the toggle on); Na__SitePlan__Write really skips on `if bucket[:positions].empty?` before rings; Na__SitePlan__Run really returns a bare true/false while Na__SitePlan__Write already returns a Hash; Na__PublicApi__ExportSitePlanData passes Na__SitePlan__Run's value straight through, so the handler is indeed the only place the truthiness bug can be fixed; the Extensions menu item ignores the return value entirely.
- Also verified correct: NA_PROJECT_LINK_KEYS is inside `unless defined?(NA_PROJECT_LINK_DICT)` and Na__ProjectLink__Read / __Clear both iterate it, so the restart warning and the free-unlink claim are both right; Na__PortalMapper__ListPhaseFolders skips only the single siteplan_name and its SkipFolderPrefixes are ['.','00__'], so a SitePlan__DrawingData__Proposed folder WOULD appear in the scheme list and the Danger Zone picker until step 1 lands; Na__PortalMapper__BuildStructureTree's aside row is single-folder; Na__UserInterface__BuildModelStatus's project_prefix really is display-only in the payload while the local drives PlanLinetypeLinework and BuildFlatGroupRows; na__tvgb__sendExportAction really JSON.stringifies params for every action including export_site_plan; the router really drops params_json for 'export_site_plan'; the two IIFEs and the window-export block at the bottom of the first one are as described; every CSS class named (naTvgb__ActionGroup/__Title, naTvgb__OptionRow, naTvgb__SettingsGroup/__Title/__Desc, naTvgb__SchemeList, naTvgb__SchemeRow, #naTvgbSchemeGroup) exists; discover_model_groups iterdir()s one level and build_r2_key takes one subfolder segment; SITEPLAN_FILE_PATTERN and NA__SITEPLAN__OLD_FILE_PATTERN really do both cap the stem at [A-Za-z0-9]+; DevLog 2.10.1 -> 2.11.0 and ProjectVision 0.4.1 -> 0.5.0 are the right next numbers.
- The bounds fallback in point 5 of the F6 section is dead code, and its stated rationale is wrong. `boundsMm : lines.boundsMm` on the object Na__SpStore__LoadLayer resolves is read by nothing: a repo-wide grep for `.boundsMm` outside 52__System__SitePlanData returns zero hits, and inside the store only Na__SpStore__GetFocusBoundsMm computes bounds - from `redLine.Layer__BoundsMm || descriptor.SitePlan__BoundsMm`, i.e. the manifest values, never the parsed ones. The change is harmless, but it is not "the only correct bounds" for a fill-only layer; nothing consumes it either way. Keep it if you like, but do not count it as one of the five F6 gates.
- The REQ-34 store-mismatch refusal is close to unreachable in the workflow it is written for, and the design does not say so. Na__SitePlan__ResolveExportFolder derives the folder FROM the model's store (Na__PortalMapper__SitePlanFolderPath(project_root, store_id)), and the manifest in that folder was written with that same store id - so "store differs" cannot fire on the linked path. On the unlinked path the store id is derived from the chosen basename by Na__PortalMapper__IdentifySitePlanStore, so it matches there too. It is only reachable after a manual copy or folder rename. Worth keeping as cheap insurance, but the order-of-work test for step 5 ("put a proposed manifest in the existing folder by hand") is the only way to exercise it, and the design should say that plainly rather than presenting the guard as the everyday protection.
- One consequence of the primary-store rule (proposed > existing > legacy) is not stated as a hazard: the moment Adam's FIRST proposed export lands, SitePlan__DataStore stops pointing at the legacy folder, and every already-saved site plan viewport in that project repaints from the proposed store on the published site. Viewport__ModelLayers and Viewport__ProjectedEdges are keyed by bare Layer__CategoryKey, so their toggles and overrides silently carry across to the new store's layers. That follows from SC10 and may be intended, but it is the one way this design changes what an existing sheet draws, and it belongs in the risk register.

---
