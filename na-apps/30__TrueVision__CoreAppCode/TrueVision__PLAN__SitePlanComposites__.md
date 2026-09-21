# TrueVision 3D - Site Plan Composites: Tags, Z-Index, Face Fills, Hatch Patterns, Two Stores

**Status**: IN PROGRESS (20-Sep-2026). Research and design complete and written up. **P1 written,
awaiting Adam's first run in SketchUp.** P0 and P2-P10 not started.
**Created**: 20-Sep-2026
**Owner**: Adam Noble
**Predecessor**: `TrueVision__PLAN__SitePlanDrawings__.md` - the original site plan build (phases 0-6,
all landed). **Read its sections 4, 5, 6.5, 8.3, 8.4 and 13 before touching anything here.** This
document does not repeat what that one establishes; it records only what *changes*.

**Spans three repositories / trees**
- `Adam-Noble-01/Plugins` (the SketchUp Plugins folder): the tag + material SSOT and the GLB Builder.
- This repository, `na-apps/05__ProjectVision__CoreAppCode`: the build script and the R2 model sync.
- This repository, `na-apps/30__TrueVision__CoreAppCode`: TrueVision 3D itself.

---

## 0. How to read this document

This work spans many sessions and will be handed between agents. **Section 12 is the progress
ledger - the only record of what is actually done.** Everything above it is requirement and design.

- Start a session by reading sections 1, 2, 3 and 12.
- Finish a session by updating 12, and by revising any decision in section 2 **in place**, dated.
- Never mark a ledger row `x` on the strength of code being written. `x` means built *and* proven.
- Adam tests in SketchUp himself. When a plugin change is ready, **stop and ask him to run it**.

**The prime rule for whoever picks this up:** Adam's brief of 20-Sep-2026 is reproduced verbatim in
section 1. It is the specification. Where this document interprets it, the interpretation is marked
`INTERPRETED` and says what the literal words were. Do not drift from section 1.

---

## 1. The brief (Adam, 20-Sep-2026) - verbatim requirement register

Adam's own words are quoted. `REQ-nn` ids are this document's, for the ledger.

### 1.1 Task 01 - research

> Research the codebase: SSOT Libs in Plugins; TrueVision Exporter App (syncs TrueVision assets to
> R2 for loading in TrueVision, downstream app there is an export pipeline specifically for site
> plan data files); TrueVision Drawing Editor codebase.

| Id | Requirement |
|---|---|
| REQ-01 | Survey the tag/material SSOT in the Plugins repository |
| REQ-02 | Survey the TrueVision exporter and its R2 site plan export pipeline |
| REQ-03 | Survey the TrueVision Layout Editor site plan rendering |

### 1.2 Task 02 - SSOT tags and SketchUp face materials

> Added site plan tags & create new SketchUp site plan face materials corresponding to the fills
> (but no alpha for the SU ones, that is for TrueVision only)

**New tags** (Adam's table, verbatim values):

| Tag | Line colour | Lineweight | Fill / hatch |
|---|---|---|---|
| `71__SitePlan__BaseMap__OsMapping__MainRoads` | Grey L40 | 1.0 | - |
| `71__SitePlan__BaseMap__OsMapping__MinorStreets` | Grey L60 | 0.75 | - |
| `71__SitePlan__BaseMap__OsMapping__MinorFeature` | Grey L60 | 0.50 | - |
| `71__SitePlan__BaseMap__NeighbouringBuildings` | Grey L40 | 1.0 | - |
| `73__SitePlan__SiteFeature__Access` | Grey L40 | 1.0 | - |
| `73__SitePlan__SiteFeature__Paths` | Grey L60 | 0.75 | - |
| `75__SitePlan__SoftLandscape__Trees__MixedWoodland` | MTE202 | 0.75 | hatch **Mixed Woodland**, fill `rgb(220, 237, 207)` |
| `75__SitePlan__SoftLandscape__HedgesAndPlanting` | MTE202 | 0.75 | fill `rgb(220, 237, 207)` |
| `71__SitePlan__BaseMap__Waterbodies` | MTE205 | 1.0 | hatch **Ponds & Lakes**, fill `rgb(186, 228, 253)` |

**Renames of existing tags:**

| From | To |
|---|---|
| `71__SitePlan__BaseMap__OsMapping` | `71__SitePlan__BaseMap__OsMapping__General` |
| `75__SitePlan__SoftLandscape__Trees` | `75__SitePlan__SoftLandscape__Trees__Existing` |
| `75__SitePlan__SoftLandscape__TreesToRemove` | `75__SitePlan__SoftLandscape__Trees__ToBeRemoved` |

**"Ensure these are":**

| Tag | Line | Weight | Fill |
|---|---|---|---|
| `73__SitePlan__Buildings__Existing` | MTE201 | 1.5 | none |
| `73__SitePlan__Buildings__Proposed__NewConstruction` | MTE201 | 2.0 | `rgba(255, 0, 0, 0.1)` |
| `73__SitePlan__Buildings__Proposed__Alterations` | MTE201 | 2.0, **dashed** | `rgba(255, 0, 0, 0.1)` |

| Id | Requirement |
|---|---|
| REQ-04 | Add the nine new tags to the tags SSOT |
| REQ-05 | Rename the three tags listed above |
| REQ-06 | Set the three Buildings tags to the colours, weights and fills listed above |
| REQ-07 | Create matching **SketchUp face materials** in the materials SSOT, one per fill, **fully opaque** - alpha exists only in TrueVision |

### 1.3 Task 03 - site plan line height hierarchy (Z-index)

> We need to add a line height hierarchy in TrueVision Site Plan Layout Editor because currently,
> for example, a boundary red line and a tree line (such as woodland or water bodies) can foul the
> red line if they run along a boundary and the red line should always be over. We need to create a
> height index from 0 to 10, with Z-index 10 being more than enough for this level of stacking. The
> highest level is 10 and the lowest level is 1. 10 would be the index value assigned to the red
> boundary line because that is the absolute highest thing that needs to be rendered and then we can
> work back from there:
> - Buildings would be around 5.
> - Things like minor streets would be 1.
> - Roads would be 2.
> - Fences would be 3, etc.
> - Water lines above trees so you would see the blue outline rather than the green but then
>   enclosed faces would still be filled in with the tree pattern.

| Id | Requirement |
|---|---|
| REQ-08 | A 1-10 Z-index per site plan layer, 10 highest, replacing the current `SitePlan__DrawOrder` |
| REQ-09 | Red line boundary = 10; buildings ~5; fences ~3; roads 2; minor streets 1 |
| REQ-10 | **Line Z-index and fill Z-index are independent** - water *lines* sit above tree *lines*, while the tree *fill* can still sit above the water *fill*. This is the load-bearing consequence of Adam's last bullet |

### 1.4 Task 04 - hatching system for enclosed polygons

> Things like forests can be automatically hatched and so can things like the design proposal, which
> is a red shaded block.
> Add a toggle to exporter for "Export Polygon Faces".
> When enabled the SketchUp faces get exported as a mesh model in 2D. Much like with the system we
> already have for the 3D, we can use the mesh model behind the line work model.
> Each of the elements, again, gets a mesh model that gets rendered underneath the 2D line work and
> the Z-index that I mentioned previously.
> All of those layers are on a completely different separate line work system, which is a layer
> above this.
> These polygon fill hatch sections will be used to feed auto SVG hatching as we will create some
> hatch patterns.
> The faces get used purely for creating a bounded space, which is then infilled with a new
> SVG-generated layer using simple repeated hatches.
> The Design Proposal Fill should be = rgba(255, 0, 0, 0.1)
> Fills should be rgba values with no bounding lines, just the fill.
> Patterns should be read from the new pattern library and should be JSON files formatted strictly
> in accordance with my rules of how I set out JSON files with the three-stage naming, and then
> these are loaded to the SVG pattern generator that generates hatched patterns, such as
> cross-hatches, woodland hatches, grassland hatches, all that kind of stuff where you've got a
> repeating pattern. There should be, in the site plan editor, a way to be able to scale and rotate
> patterns to make single patterns more reusable within the editor.

| Id | Requirement |
|---|---|
| REQ-11 | **"Export Polygon Faces" toggle** on the exporter |
| REQ-12 | Faces export as a 2D mesh model per layer, sitting behind the linework model |
| REQ-13 | Fills obey the Z-index of REQ-08, on their own layer stack below the linework stack |
| REQ-14 | Faces are *bounded space only* - the paint is an SVG-generated repeating hatch |
| REQ-15 | Design proposal fill = `rgba(255, 0, 0, 0.1)` |
| REQ-16 | Fills are rgba, **no bounding line on the fill itself** |
| REQ-17 | Patterns are JSON files in the new library, in Adam's three-stage naming |
| REQ-18 | An SVG pattern generator builds repeating hatches from those JSON files |
| REQ-19 | The editor can **scale and rotate** a pattern per use |

### 1.5 Task 04b - the Patterns panel

> Create a new dropdown in the right-side menu as the very last one, called Patterns. This reads the
> new pattern files and contains a pattern library. Folders within the pattern library contain
> different pattern packs so I will build some preliminary pattern folders. The site plan patterns
> will be in one subfolder.

Library root: `52__LayoutEditor__HatchPatternLibrary`
Packs present on disk: `01__GeometricHatches`, `02__ConstructionMaterialHatches`, `03__Placeholder`,
`04__Placeholder`, `05__SitePlanHatches` (all empty at time of writing).
Reference sheets: `OS_Symbol__Examples__.png`, `OS_Symbol__Examples__Woodland&Water__.png`.

| Id | Requirement |
|---|---|
| REQ-20 | A **Patterns** dropdown, the **very last** panel in the **right** column |
| REQ-21 | It reads the pattern library; each sub-folder is a **pack** |
| REQ-22 | Mixed Woodland is one of the first hatches, taken from the Woodland & Water reference sheet |

### 1.6 Task 05 - two site plan stores (existing and proposed)

> Add the ability to have multiple R2 site plan buckets... you quite often have an existing site plan
> and a proposed site plan where you materially change so much that it's impossible to work with just
> layers alone. For 50-75% of my projects the system as we've got it now is fine with a singular site
> plan viewport type. In both the TrueVision exporter site plan options we need a way to define
> whether it's the existing site plan or a proposed site plan. Let's learn from the system we've
> already got and have distinct folders created. In the Project Configurator tab of the TrueVision
> exporter, in the section that deals with the site plan stuff, have a similar folder setup to what
> we've got with the others so you can clearly lock in what kind of plan you're exporting from
> SketchUp. This will be added to the local folder, the constituent parts exported, and then pushed
> to R2. Downstream in TrueVision there needs to be a way to assign, in the viewport options,
> existing or proposed viewports. Or, even better, I guess it can just automatically detect that,
> can't it? Depending on what kind of folder it's in, that's a much more logical solution, isn't it?
> - If it's in an existing folder, it's the existing site plan.
> - If it's in a proposed folder for site plans, it's proposed.

| Id | Requirement |
|---|---|
| REQ-23 | The exporter's Project Configurator gains an **Existing / Proposed** site plan folder lock-in, matching the design phase folder pattern |
| REQ-24 | The chosen variant creates its own local folder, exports into it, and pushes to its own R2 path |
| REQ-25 | TrueVision holds **more than one** site plan store per project |
| REQ-26 | The variant is **detected from the folder**, not typed by hand |
| REQ-27 | A viewport can link to a chosen site plan store; single-store projects keep working untouched |

### 1.7 Task 06 - location plans vs block plans, and the composite

> **Site Location Plans** - Viewports over 1:500 (in the future if we go for even larger scales, like
> 1,000, 2,500, or something, for housing development location plans, the same rule would apply). For
> the site location plan only show one type of fill, and that is the proposed new construction or the
> alterations proposed fills. Only use the boundary line work colours. Omit all other colours because
> that plan is tiny at the 1,250 scale. It will look unprofessional and ridiculous using that amount
> of colour and detail. Keep that basically as it is now, with the only exception that it fills in the
> proposed automatically now based on the new fill system.
>
> **Block Plans** - Ensure all of the procedural patterns and fills are generated based on the new
> parser using the faces from the mesh models, but as 2D face islands to fill as polygons. And to
> align underneath the existing line work rendering to create a layered composite plan that can
> include much more OS mapping data to give the site plan more legibility and interest. In the left
> menu add a Site Plan Render Composites dropdown, which functions exactly like the other render
> composites, with the same kind of controls, so you can flip off the coloured underlying filled
> polygon and hatched polygon layers. The way I see it, do three layers:
> 1. A solid fill base layer
> 2. On top, the patterns
> 3. On top of that, the linework
> It's a composite of three layers that create the site plan drawing for any site plans under 1:500
> scale, which could include a 1:100, a 1:200, or a 1:500 site plan / block plan of the site.
>
> The exporter needs to have an awareness so as not to accidentally save over the other type of site
> plan... The same robust controls we've got set up for the other system need to be assigned so as
> you can lock into a project's exact plan and folder you are trying to make from within SketchUp.

| Id | Requirement |
|---|---|
| REQ-28 | **Location Plan** = denominator coarser than 1:500 (1:1250, 1:2500, ...). Shows **only** the proposed NewConstruction / Alterations fills, and only boundary linework colours. Everything else greyscale, as now |
| REQ-29 | The location plan's proposal fill is now automatic, from the new fill system |
| REQ-30 | **Block Plan** = 1:500 or finer (1:100, 1:200, 1:500). Full three-layer composite |
| REQ-31 | Composite order, bottom to top: **solid fill base -> patterns -> linework** |
| REQ-32 | A **Site Plan Render Composites** dropdown in the **left** menu, matching the existing Render Composites controls, toggling the fill and pattern layers |
| REQ-33 | Site plan scale list gains 100, 200 (and 2500 for location plans) |
| REQ-34 | The exporter must refuse to overwrite the *other* site plan variant - the same guards as the design phase folders |

### 1.8 Task 07 - handover

> I suggest, because this is such a complex multi-step task, you create some notes for yourself
> because you will have to hand it on... Make sure you create a robust plan and notes so the next
> agent doesn't stray away from the above.

| Id | Requirement |
|---|---|
| REQ-35 | This document, kept current, with section 12 as the ledger |

---

## 2. Decisions register

`AGREED` = Adam said so. `DECIDED` = taken here with reasons, revisable. `ASK` = still open.

| Id | Decision | State |
|---|---|---|
| SC01 | Adam's lineweights (0.50 / 0.75 / 1.0 / 1.5 / 2.0) are **points**, the LayOut convention, matching the existing `03__LineworkStyle__NN.NNpt` tags. Stored as points; mm = pt x 0.352778 | AGREED (Adam, 20-Sep-2026) |
| SC02 | `73__SitePlan__SiteFeature__Access` / `__Paths` are **added alongside** `74__SitePlan__ExternalWorks__HardSurfaces` / `__ParkingAndAccess`. All four exist. 73 is the simple everyday pair; 74 stays for jobs needing drainage and parking detail | AGREED (Adam, 20-Sep-2026) |
| SC03 | Test bed is **RB05 - West Farm**, a model Adam is building now. Adam runs every SketchUp test himself: when a plugin change is ready, **stop and ask** | AGREED (Adam, 20-Sep-2026) |
| SC04 | Every rename carries a `SitePlan__LegacyTagNames` alias array, so a model already tagged with the old name still exports. Without this, PS01 and any in-flight model break silently | DECIDED |
| SC05 | Z-index is **two fields**, not one: `SitePlan__ZIndexLine` and `SitePlan__ZIndexFill`, both 1-10. Adam's water-over-trees rule is unsatisfiable with a single ordering (REQ-10) | DECIDED |
| SC06 | "Export Polygon Faces" controls whether the **fill model GLB** is written, and widens it from the handful of `SitePlan__ExportFills` tags to **every** site plan layer that carries faces | DECIDED |
| SC07 | The fill model keeps exporting **rings** (`LINE_LOOP` outer + inner), not triangles. SVG fill and jsPDF both want boundaries; a triangulated fill shows hairline seams in PDF viewers and cannot be hatched by clipping. Adam's words were "exported as a mesh model in 2D" - the interpretation is that the *file* is the mesh-model counterpart of the linework model, exactly as in the 3D pair, and rings are its payload | DECIDED / `INTERPRETED` |
| SC08 | Hatches render at **paper scale**, not model scale: a woodland hatch is the same size on the sheet at 1:200 and 1:500, as in LayOut. The per-use scale/rotate controls of REQ-19 then adjust from there | DECIDED |
| SC09 | Patterns is a **new collapsible panel, last in the right column**, not a fourth tab on the Scrapbook tab strip. Adam's words were "a new dropdown in the right-side menu as the very last one" | DECIDED / `INTERPRETED` |
| SC10 | A viewport with no explicit store binding resolves to the **proposed** store, or to the single store when a project has only one. Every existing viewport record therefore keeps painting exactly what it paints today | DECIDED |
| SC11 | Location plan vs block plan is decided **by scale denominator at paint time**, not by a stored flag: `> 500` is a location plan. Adam may place both on one sheet | DECIDED |
| SC12 | Adam's "Ponds & Lakes Mixed Woodland" against the trees tag is read as two hatches: **Mixed Woodland** on the trees tag, **Ponds & Lakes** on the waterbodies tag. The OS reference sheet carries both | DECIDED / `INTERPRETED` |
| SC13 | Grey L40 = **`MTE103__LineColour__DarkGrey__L40`** `#666666`; Grey L60 = **`MTE104__LineColour__MidGrey__L60`** `#999999`. Both already exist - **no new MTE ids are needed**. Confirmed by reading `Na__DataLib__CoreIndex__EdgeMaterials__.json` v2.1.0, 20-Sep-2026 | RESOLVED |
| SC14 | New SketchUp face materials are opaque (REQ-07). The rgba alpha lives only in the tags SSOT `SitePlan__FillOpacity`, which TrueVision reads | AGREED (Adam, 20-Sep-2026) |
| SC15 | The first `05__SitePlanHatches` pack ships **exactly two** patterns - **Mixed Woodland** and **Ponds & Lakes** - drawn carefully against `OS_Symbol__Examples__Woodland&Water__.png`. The rest of the OS set follows once Adam has seen one printed | AGREED (Adam, 20-Sep-2026) |
| SC16 | The pattern loader **skips a pack folder that is empty or has no index**, so the two `__Placeholder` folders cost nothing and can be renamed at any time. Adam will name them later | AGREED (Adam, 20-Sep-2026 - he chose to name them but has not yet said what; **open, not blocking**) |
| SC18 | A hatch **pattern tile is transparent** - it paints glyphs only. The solid ground is the *fill* deck. Baking the ground into the tile collapses two of Adam's three decks into one. Proven by the glyph study, section 5 | DECIDED |
| SC20 | Site plan folders are **`SitePlan__DrawingData__Existing`** and **`SitePlan__DrawingData__Proposed`**. The stem is kept deliberately: one prefix test finds every variant *and* the original bare `SitePlan__DrawingData`, which is read as **Proposed** and **never renamed** - live TrueVision projects and published R2 keys point at that name | DECIDED |
| SC21 | The variant is **chosen, never inferred**. With two folders and nothing stored the export **refuses** rather than guessing, so an existing site plan cannot be written over a proposed one (REQ-34). A project holding exactly one folder answers for itself, which covers every project that pre-dates the split | DECIDED |
| SC22 | Getting the **folder** right is independent of anything downstream reading it. Adam overruled the plan to defer the split until the pipeline and store caught up, on the grounds that RB05's first site plan is an Existing one and wrong-foldered data would need migrating. He was right; the ordering in section 6 was wrong | AGREED (Adam, 20-Sep-2026) |
| SC19 | **A renamed tag keeps its old stem.** The stem is `Layer__CategoryKey`, the identity key behind every saved layer toggle and style override; `SitePlan__LayerLabel` is the name Adam reads. See section 4.8 | DECIDED |
| SC17 | Location plan (REQ-28) means: non-boundary layers paint in **greyscale**, the red and blue boundary lines keep their colour, and the **only** fills drawn are the proposed NewConstruction / Alterations ones. "Omit all other colours" is read as desaturate, not hide - Adam's "keep that basically as it is now" says the linework itself stays | DECIDED / `INTERPRETED` |
| SC23 | **A hatch pattern may carry its OWN ink.** `Defaults__StrokeColour` written as a hex wins over the layer's line colour; `'inherit'` (every pattern before Grassland) keeps taking it. Needed because the grass tags draw their edges in the OS base map grey - see SC24 - and an inherited ink would paint grey grass. The field was already in the format and parsed; only the painter ignored it | DECIDED (21-Sep-2026) |
| SC24 | **Grassland and Rough Grassland draw their edges exactly like `OsMapping__General`** (dark grey L40, 0.5 pt, line Z 1), not in the woodland green. A field is traced over OS linework that is already on the drawing, so the two merge into one band (finding F2) and tracing a field adds nothing to the linework. Green outlines round every field would bury the OS structure. One SSOT field to change if Adam wants them green | DECIDED / `INTERPRETED` (21-Sep-2026) |
| SC25 | **Fill Z 1 is grass.** Every other wash - hard standing 2, woodland 3, water 4, buildings 5, proposal 8 - paints over it, so one big grass face under the whole site is a legitimate way to work | DECIDED (21-Sep-2026) |
| SC26 | The light grey hard standing wash goes on **three** tags, not one: `SiteFeature__Access` (the SSOT's drive), `SiteFeature__Paths` (**where RB05 actually draws its drives** - 497 segments) and `ExternalWorks__HardSurfaces` (the hard standing tag). Adam asked for "whatever tag we have set up for driveways", and in his own model that is Paths | DECIDED (21-Sep-2026) |

---

## 3. Survey findings

### 3.0 The exporter as Adam actually sees it (screenshot, 20-Sep-2026 13:21)

Adam sent a screenshot of RB05 open in SketchUp 2026 with the GLB Builder dialog up. Recorded
literally, because two of these correct assumptions made earlier in this document:

- **The dialog has three tabs: `Export` | `Project` | `Settings`.** There is no tab called "Project
  Configurator" - **Adam's "Project Configurator tab" is the `Project` tab** (REQ-23). Search for
  the `Project` tab, not for the words in the brief.
- **Header block:** `MODEL RB05_T01_M00__SitePlanModel__0.2.1__` / `FILE PREFIX (none)` /
  `STOREYS None (flat model)` / **`SITE PLAN TAGS 14`**. So the exporter already counts site plan
  tags and RB05 already carries 14 of them.
- **`FILE PREFIX` reads `(none)`** on a model named `RB05_T01_M00__...`. **Resolved by reading the
  code, 20-Sep-2026 - the export is fine, the header is wrong.** There are two prefix rules:
  - `Na__Helpers__ExtractProjectPrefix` (`CoreExport.rb` ~253) matches `/^([^_]+)__/`. On
    `RB05_T01_M00__...` the `[^_]+` run stops at the first `_`, so nothing matches and it returns
    `""`. This is the rule the **dialog header** uses (`UserInterface.rb` ~509, ~582).
  - `Na__SitePlan__ProjectPrefix` (`SitePlanExport.rb` ~455) matches `/\A([A-Za-z]{2}\d{2})(?=_)/`,
    which **does** match `RB05_` and returns `RB05__`. This is the rule the **site plan export**
    uses (~760).
  - So RB05's site plan GLBs will be named `RB05__TrueVision__SitePlan__*` correctly; only the
    header lies. **Low-cost fix to fold into this build:** have the header fall back to the site
    plan rule when the model holds site plan tags, so Adam is not told `(none)` before an export
    that will in fact be prefixed.
  - **CONFIRMED IN THE FIELD, 20-Sep-2026.** Adam's export summary on RB05 reads
    `Files are named RB05__TrueVision__SitePlan__{Layer}__LineworkModel__.glb` while the header
    above it still reads `FILE PREFIX (none)`. Diagnosis correct; the export is unaffected.
- **Export options:** `Export Materials`, `Standard Indexed Materials Only` (both ticked),
  `Optimise Large Textures` (unticked). The "Export Polygon Faces" toggle of REQ-11 belongs in this
  block, but note these three are *model* export options - confirm whether the site plan export
  reads them at all, and if not, whether the new toggle needs its own group.
- **Export actions:** `Export GLB File`, `Export To Project`, `Export And Sync`, **`Export Site Plan`**,
  `Rescan Model`.
- **Project linking is by a four-character code** (`RB05`), through a "Link This Model To A Project"
  modal, with `Export Without A Project` as the fallback. That code is what resolves the portal
  folder and the R2 path, so the Existing/Proposed choice of REQ-23 hangs below it.
- **Footer messages present:** "14 site plan tag(s) (71-75) in this model. They never go into model
  GLBs: use Export Site Plan Data." and "No model layers to export. This model holds site plan tags:
  use Export Site Plan Data." So RB05 is a **site-plan-only model** - it has no 3D building geometry.
- **The model itself** shows exactly the content this build is for: a red line boundary, woodland
  blocks, a lake, watercourses as blue lines, roads and tracks in grey, and yellow areas.

### 3.1 Edge colours available (read 20-Sep-2026, `Na__DataLib__CoreIndex__EdgeMaterials__.json` v2.1.0)

Every colour this build needs already exists. **Do not add MTE entries.**

| Adam's words | MTE id | Hex | RGB |
|---|---|---|---|
| Grey L40 | `MTE103__LineColour__DarkGrey__L40` | `#666666` | 102, 102, 102 |
| Grey L60 | `MTE104__LineColour__MidGrey__L60` | `#999999` | 153, 153, 153 |
| MTE201 | `MTE201__LineColour__Red` | `#E53935` | 229, 57, 53 |
| MTE202 | `MTE202__LineColour__Green` | `#43A047` | 67, 160, 71 |
| MTE205 | `MTE205__LineColour__Blue` | `#1E88E5` | 30, 136, 229 |

Greyscale series in full, for picking anything else: MTE101 AbsoluteBlack `#000000`,
MTE102 SoftBlack L20 `#333333`, MTE103 DarkGrey L40 `#666666`,
MTE103 MediumDarkGrey L50 `#737373`, MTE104 MidGrey L60 `#999999`,
MTE105 LightMidGrey L70 `#B4B4B4`, MTE106 NearWhiteGrey L80 `#CCCCCC`,
MTE107 LightGrey L85 `#D9D9D9`, MTE108 VeryLightGrey L95 `#F2F2F2`, MTE109 White `#FFFFFF`.

**Two pre-existing faults in this file, not introduced here and not fixed here** (they were already
logged in the predecessor document's section 4.5):
- `MTE103` is used **twice** - `MTE103__LineColour__DarkGrey__L40` and
  `MTE103__LineColour__MediumDarkGrey__L50`. Numbering is not unique.
- The key `MTE103__LineColour__MediumDarkGrey__L50` carries `SketchUpName`
  `MTE103__LineColour__MediumDarkGrey__L45` - key and SketchUp name disagree.

Because of the first fault, **always reference these by full key string, never by the `MTE103`
number**, or a lookup will pick the wrong grey.

### 3.2 Codebase survey

The full survey - 12 read-only agents, every subsystem, with file paths, symbol names, extension
points and traps - is in its own document:

> **`TrueVision__NOTES__SitePlanComposites__Survey__.md`** (3,400 lines)

**Read it before writing any code.** Its two "Cross-cutting findings" sections at the end are the
most valuable part: they correct several claims the per-area surveys got wrong.

### 3.3 The eight findings that change the design

These are the ones that overturn an assumption. Everything else is in the survey notes.

**F1 - Linework paint order is by STROKE WIDTH, not by draw order.**
`Na__LeVp2d__StyleBands` (`Na__LayoutEditor__Viewport2d__Linework__.js`) buckets segments by
*resolved style* (`hex|width|dash`) and sorts `(a, b) => a.style.widthMm - b.style.widthMm` -
heaviest painted last, so heaviest on top. `Layer__DrawOrder` reaches **only the fills**. PS01's red
line sits on top because it is the heaviest line (0.50 mm), *not* because its draw order is 90.
- **Consequence for REQ-08:** a Z-index wired to the existing sort cannot work. `StyleBands` must
  gain a site-plan branch that orders by Z-index instead of by width.
- **Consequence for Adam's new weights:** Proposed buildings at 2.0 pt = 0.706 mm is **heavier than
  the 0.50 mm red line**, so under today's rule the proposal would paint *over* the red boundary -
  exactly the fault REQ-08 is meant to cure. The Z-index is not a nicety here; without it Adam's
  own weight table makes the drawing worse.

**F2 - Two layers that resolve to the same colour + weight + line type MERGE into one SVG path.**
`if (buckets.size === 1)` collapses them. Adam's new table deliberately creates collisions:
MainRoads, NeighbouringBuildings and SiteFeature__Access are all Grey L40 at 1.0 pt; MinorStreets
and SiteFeature__Paths are both Grey L60 at 0.75 pt; MixedWoodland and HedgesAndPlanting are both
MTE202 at 0.75 pt. Merging is harmless *visually* (they look identical by design) and layer toggles
still work (segments are filtered before banding), but **no Z-index can order two merged layers
against each other.** That is acceptable - they are indistinguishable anyway - but the code must not
assume one band per layer.

**F3 - There is a hard ceiling on site plan line weight at 0.635 mm, and Adam's table exceeds it.**
The weight factor is `SitePlan__LineWeightMm / 0.10584` (the 0.30 pt master), clamped by
`Weight__Max: 6.00` in `Na__LayoutEditor__EdgeStyles__Config__.json`. Maximum expressible weight =
`6.00 x 0.10584` = **0.635 mm**. Adam's 2.0 pt = 0.706 mm would be **silently clamped**, and 1.5 pt
= 0.529 mm only just fits.
- **Fix:** raise `Weight__Max` to `10.00` (= 1.058 mm) in the same change. Widening a clamp is safe;
  nothing is currently near it.

**F4 - The line colour is an ALIAS WHITELIST, not the manifest hex. An unlisted colour paints BLACK.**
`Na__LeEdge__SitePlanDefault` does `Na__LeEdge__AliasForHex(style.LineHex) || fall.colour`, and the
palette is the nine rows of `LayoutEditor__EdgeStyles__Colours`. A hex outside those nine falls back
to `Fallback__ColourAlias: "black"` **silently**, with a perfectly correct `LineHex` in the manifest.
- **Good news:** all five colours Adam asked for are already in the nine (dark-grey `#666666`,
  mid-grey `#999999`, red, green, blue). **No new alias is needed.**
- **Standing rule:** any future site plan colour must be added to
  `LayoutEditor__EdgeStyles__Colours` *in the same commit* as the SSOT tag that references it.

**F5 - No site plan fill has ever been painted, on screen or on paper.**
Verified by running the real parser over PS01's GLBs. The only layer with a fill GLB
(`ExistingBuildings`) has `FillHex: null`; the two layers that *have* a fill colour
(`ProposedBuildings`, `ProposedBuildingsSecondary`) have no faces and carry the warning
"no faces, so no fill; draw the outline as a closed face". The `fill-rule="evenodd"` hole cutting
and the PDF's outer-ring-only path have **never run against real data**.
- **Consequence:** this whole build sits on an unexercised code path. **Phase 1 of the build must be
  to make one real fill appear**, on screen and in a PDF, before anything is layered on top.

**F6 - A layer with faces but no edges exports NOTHING.**
`Na__SitePlan__Write` skips a layer whose `positions` array is empty *before* it considers rings, and
three downstream gates repeat the assumption (`if linework not in present: continue` in the build
script; `Na__SpStore__Layer` drops a layer with no linework URL). A woodland polygon whose boundary
edges are soft or smooth therefore vanishes completely and silently.
- **Consequence for REQ-11:** "Export Polygon Faces" must relax that gate, or face-only layers never
  appear. All four gates must move together.

**F7 - The GLB parser does not understand triangles, and should not have to.**
`Na__SpGlb__Primitives` matches an exact mode; only `MODE_LINES` (1) and `MODE_LOOP` (2) are ever
requested. A triangle GLB parses to an **empty result with no error** - the worst failure mode.
This is the evidence behind SC07: keep exporting rings. If Adam wants a face mesh file as well, write
it as a *third* file and keep painting from the rings.

**F8 - A new key inside `Layer__Style` survives the pipeline but dies in TrueVision.**
The Python build script copies `Layer__Style` **whole** (`entry.get('Layer__Style')`), so a new
sub-key reaches the app. It is then deleted by `Na__SpStore__Style`, which rebuilds exactly seven
keys. Likewise `Na__LeRec__NormaliseProjectedEdges` rebuilds every category override as exactly four
keys, so a fifth is dropped on save.
- **Consequence:** every new style field needs **two** registrations: `Na__SpStore__Style` and, if it
  is overridable per viewport, `Na__LeRec__NormaliseProjectedEdges`.
- **One piece of good news:** `Na__LeRec__NormaliseViewport` shallow-copies `Viewport__SitePlan`, so a
  new sub-key there survives save / load / undo with no normaliser change. But
  `Na__LeModel__UpdateViewport` has **no `patch.sitePlan` branch**, so it can only be set at create
  time until one is added.

### 3.4 How to test this locally

- Launch entry **`truevision-static-siteplan`** (port 8523), which serves the **repo root**.
- URL, with **both** parameters (one alone silently loads a ValeVision default and reads as a dead
  build):
  `http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26`
- **Use `127.0.0.1` or `localhost`, never `app.localhost`.** `Na__AppUtils__IsRunningOnLocalhost`
  tests the hostname exactly, and the site plan store reads the **local repository manifest first**
  only on those hostnames - so a fresh SketchUp export draws with no build and no R2 sync.
- Fixtures: PS01 (the real export), PS02 (byte-identical copies under a different project folder -
  a genuine second fixture that already proves a foreign file prefix works), AA00 (empty).
- `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` passes today (385 files) and
  must keep passing after every JS edit.
- There is **no site plan regression test of any kind**. `Na__SitePlan__GlbParse__.js` cannot be
  imported by a `.test.mjs` directly (Node resolves `.js` here as CommonJS); copy it to `.mjs` first.

### 3.4b Seeing a GLB Builder dialog change WITHOUT SketchUp

The plugin dialog can be assembled and rendered offline, so markup and JS changes are checked before
Adam reloads. Harness: read `Na__TrueVision__GlbBuilder__UiLayout__.html`, substitute the mustache
placeholders, stub `window.sketchup`, push a fake payload through
`window.Na__Tvgb__ReceiveProjectStatus(...)`, then screenshot with headless Chrome
(`chrome.exe --headless --screenshot=<ABSOLUTE path> --window-size=W,H file:///...`).

**Three traps, all hit on the first attempt 20-Sep-2026:**
1. **The template already provides the wrappers.** `{{STYLESHEET_CONTENT}}` sits inside
   `<style>...</style>` and `{{UI_BRIDGE_SCRIPT}}` inside `<script>...</script>`. Substituting
   wrapped content nests a `<script>` inside a `<script>`, which throws
   `Uncaught SyntaxError: Unexpected token '<'`, so the bridge IIFE never runs and **every**
   `window.Na__Tvgb__*` export is missing.
2. **Use a FUNCTION replacement, never a string one.** `String.replace` reads `$&`, `` $` ``, `$'`
   and `$1` in the *replacement* as back-references and silently mangles JS or CSS containing them.
   The Ruby avoids this with `gsub('{{X}}') { content }` - a block - and the harness must match.
3. **The tab buttons are `.naTvgb__TabButton`**, not `.naTvgb__Tab`. The bridge is a plain IIFE that
   runs immediately, so calling `window.Na__Tvgb__ShowTab('project', tabs[1])` straight after it
   works - no `DOMContentLoaded` wait needed.

Always read the console (`--enable-logging=stderr --v=0 --dump-dom`, grep for `Uncaught`). A silent
render that looks like the wrong tab means the bridge threw.

### 3.4c Ruby CAN be syntax-checked here after all

The standing belief - no Ruby on the studio PC, so plugin Ruby goes to Adam unchecked - **is wrong,
and it cost him two broken loads.** There is no `ruby.exe`, but SketchUp ships its interpreter as
`x64-ucrt-ruby320.dll`. It can be loaded through `ctypes` and asked to parse a file with Ruby's own
parser.

> **`python 80__Testing__PrototypeEnvironment/Na__Verify__RubySyntax__.py`**
> With no arguments it checks every `.rb` in the GLB Builder modules folder. Pass paths to check
> something else. Exit 0 all parse, 1 a failure, 2 no interpreter.

It calls `RubyVM::InstructionSequence.compile`, which **parses and stops** - no plugin code runs, no
SketchUp API is touched, and a file referencing `Sketchup::` constants still checks clean because
those resolve at run time. Calibrated 20-Sep-2026 against deliberately broken files: it reproduces
the exact message Adam saw (`syntax error, unexpected ':', expecting =>`), catches a missing `end`,
and passes a good file.

**Run it after every Ruby edit.** The block-balance checker used earlier in this build is a crude
proxy that cannot see a bad hash key, a stray operator or a broken string - this can.

**The error it was written for:** a Ruby symbol-key hash entry is `key: value` with **no space
before the colon**. Aligning values with `path   : ...` is a syntax error, not a style choice.
Align *after* the colon instead:

```ruby
{
    path:   folder_path,
    folder: folder
}
```

### 3.5 ValeVision

`Na__LayoutEditor__Viewport2d__SitePlan__.js`, the whole `52__System__SitePlanData` folder,
`36__System__HatchPatternTools` and `52__LayoutEditor__HatchPatternLibrary` are **absent** from
ValeVision. Its copies of `EdgeStyles`, `SheetRecords` and `ScaleManager` contain **zero**
occurrences of "SitePlan". A whole-file copy of any of those four would import `Na__SpStore__*`
symbols that do not exist there and fail `Na__Verify__Exports__.mjs` immediately.
**Any port to ValeVision is a surgical merge of the non-site-plan parts only** - and per the standing
rule, the port is only *offered* to Adam after he confirms the TrueVision work.

---

## 4. The design, decided

An 18-agent design workflow ran on 20-Sep-2026: five competing designs on the two hard problems,
five judges, four supporting designs, four adversarial critiques. The full output is in

> **`TrueVision__NOTES__SitePlanComposites__Design__.md`** (3,000 lines)

**The critiques in that document's last section are binding.** Every supporting design came back
`buildable-with-fixes` with 4-7 proven fatal problems. This section records only what was *decided*;
go to the design notes for the reasoning and to the critiques before writing a line of code.

### 4.1 The two contests

| Problem | Winner | Score | The insight that won it |
|---|---|---|---|
| Composite painter + Z-index | **`painter:minimal`** | 9 / 8 / 8 | REQ-31 asks for a hard **three-deck stack** (all fills, then all patterns, then all linework) - **not** a per-layer interleave. `Na__LeVp2d__PaintSitePlan` already has that shape. The build is therefore *one extra pass inserted between the two that exist*, not a restructure, and the band merge survives. |
| Hatch engine | **`hatch:svgpattern`** | 8 / 9 | SVG `<pattern>` in `<defs>`, filling the same ring path the fill layer already builds. Tile size is paper mm x denominator, exactly as `stroke-dasharray` already scales. PDF via one PNG data URL per layer, following the `Na__LeGrad__DrawPdf` / `Na__LeGrad__StripPng` precedent. |

### 4.2 Z-index: two fields, and `Layer__DrawOrder` is never redefined

New SSOT fields `SitePlan__ZIndexLine` and `SitePlan__ZIndexFill`, integers 1-10, **beside** the
existing `SitePlan__DrawOrder`, which stays exactly as it is. They travel as `Layer__ZIndexLine` /
`Layer__ZIndexFill` at manifest layer **top level** (not inside `Layer__Style` - a Z-index is not an
inking property), and must be named in the build script's closed per-layer whitelist.

**The backward-compatibility rule** (this is why `Layer__DrawOrder` is not reused):

```
Na__SpStore__ZIndex(value, drawOrder)
    integer 1..10           -> value
    else drawOrder finite   -> min(10, max(1, ceil(drawOrder / 10)))
    else                    -> 5
```

On PS01's untouched two-week-old manifest that derives OsMapping 2, ExistingBuildings 4,
ProposedSecondary 7, Proposed 8, RedLine 9 - the correct hierarchy, **with no re-export**. The
store's default `Layer__DrawOrder` of 50 derives to 5, which is Adam's own "buildings around 5".

**The decided table.** These are Adam's drawing conventions, not technical constants, and every one
is a single SSOT integer - cheap to change. Anchors he gave are marked *.

| Z | Line layers | Z | Fill layers |
|---|---|---|---|
| **10*** | `Boundary__RedLine` | 8 | `Buildings__Proposed__NewConstruction`, `__Alterations` |
| 9 | `Boundary__BlueLine`, `Boundary__SettingOutLines` | 5 | `Buildings__Existing`, `BaseMap__NeighbouringBuildings` |
| 8 | `Buildings__Proposed__NewConstruction`, `__Alterations` | 4 | `BaseMap__Waterbodies` |
| 7 | `BaseMap__Waterbodies` | 3 | `Trees__MixedWoodland`, `Trees__Existing`, `HedgesAndPlanting` |
| 6 | `Trees__MixedWoodland`, `Trees__Existing`, `Trees__ToBeRemoved`, `HedgesAndPlanting`, `RootProtectionAreas` | 2 | `ExternalWorks__HardSurfaces` |
| **5*** | `Buildings__Existing`, `Buildings__ToBeDemolished`, `BaseMap__NeighbouringBuildings` | | |
| 4 | `ExternalWorks__DrainageAndServices` | | |
| **3*** | `Boundary__WallsAndFences` | | |
| **2*** | `BaseMap__OsMapping__MainRoads`, `SiteFeature__Access`, `SiteFeature__Paths`, `ExternalWorks__HardSurfaces`, `__ParkingAndAccess` | | |
| **1*** | `BaseMap__OsMapping__General`, `__Amendments`, `__MinorStreets`, `__MinorFeature`, `BaseMap__Contours` | | |

Water line 7 sits above tree line 6, as REQ-10 requires. **One value to put to Adam:** water *fill*
is set to 4 and tree *fill* to 3, so a pond drawn inside a wood reads as water rather than as trees.
Adam's sentence ("enclosed faces would still be filled in with the tree pattern") can be read the
other way round; the line/fill split is what he actually asked for, and this is the technically
correct default. Swapping them is a two-integer edit.

### 4.3 Line order becomes Z-order without touching architectural viewports

`Na__LeVp2d__StyleBands` gains an **optional fifth parameter `siteRules`, defaulted null**. Every
existing caller passes four arguments and is byte-for-byte unchanged; all new behaviour is inside
`if (siteRules)` guards.

1. In `resolve(id)`: `rank = siteRules ? siteRules.RankFor(ownerKey) : 0` and
   `hex = siteRules ? siteRules.ColourFor(ownerKey, effective.hex) : effective.hex`.
   The bucket key becomes `(siteRules ? rank + '|' : '') + hex + '|' + width + '|' + dash`.
2. The comparator becomes `(a.style.rank - b.style.rank) || (a.style.widthMm - b.style.widthMm)`
   under `siteRules`, and the plain width sort otherwise.
3. Each band carries `rank`.

**This preserves the merge exactly where it should be preserved** (F2): prefixing the rank into the
bucket key splits two layers only when a Z-index actually asks for an order between them. The three
Grey-L40-at-1.0pt layers still collapse into one path, because they are indistinguishable and have
no order between them. The `buckets.size === 1` fast path still fires. An architectural drawing
takes the null branch and produces a byte-identical band list.

`ColourFor` is also the **location plan lever** (REQ-28 / SC17): on a location plan a dozen layers
resolve to the same neutral grey at the same rank and merge into a single path, so the rule makes
the coarse drawing *cheaper*, not dearer.

### 4.4 The three decks

`Na__LeVp2d__SitePlanBuild` becomes the single decision point and returns
`{ classes, fills, patterns, siteRules, locationPlan, key }`. `fills` and `patterns` are separate
arrays off the same `data.rings`, **each sorted by `Layer__ZIndexFill`** before the `.map()` - that
one line satisfies REQ-10's fill half and fixes screen and PDF together, because both painters
consume that same array.

Screen: three `<g data-na-sp="fills|patterns|lines">` wrappers in that order, the first two gated on
the toggles. PDF: three calls gated on the same two flags, passing the same `drawing.siteRules` into
`Na__LePdf__DrawLinework` as an optional sixth parameter.

**The rule that keeps screen and paper in step: everything that decides content, order or colour
happens in `SitePlanBuild`; the two painters only draw what they are handed.**

### 4.5 Hatch patterns

- Pattern tiles are **transparent**. The solid ground is the *fill* deck; the pattern deck paints
  only glyphs over it. Proven by the study in section 5 below.
- Screen: an SVG `<pattern>` filling the ring path. **Pattern element ids must carry the viewport
  id** or two site plan frames on one sheet collide.
- PDF: one PNG data URL per layer, the rings filled with the pattern and rasterised at the paper
  bounding box, placed with `addImage`. The alpha channel does the clipping, so jsPDF never needs a
  polygon clip. **It must be a PNG data URL, not the `'RGBA'` path, which this jsPDF build strips
  alpha from.** jsPDF's native tiling patterns are unusable: `beginTilingPattern` and friends sit
  behind `advancedApiModeTrap` and throw outside `doc.advancedAPI()`, and this exporter runs
  entirely in compat mode.
- A hatch is bound to a layer by **default from the SSOT** (`SitePlan__HatchPatternId`, carried
  inside `Layer__Style`, so it survives the Python hop - but it must be added to
  `Na__SpStore__Style`'s eight-key rebuild or F8 deletes it), and **overridden per viewport** with
  scale and rotation (REQ-19).

### 4.6 Fill colours come from the Materials SSOT, not EdgeMaterials

Adam's fills - `rgb(220,237,207)`, `rgb(186,228,253)`, `rgba(255,0,0,0.1)` - are **not** edge
material colours, and `Na__SitePlan__EdgeHexIndex` only resolves MTE ids from EdgeMaterials. Since
REQ-07 requires matching **SketchUp face materials** anyway, a new `MAT800__SitePlanFillSeries__`
block goes in `Na__DataLib__CoreIndex__Materials__.json` and a new `SitePlan__FillMaterialId`
resolves against it through a new index function.

**Insert the new series between `MAT600__MetalSeries__` and `MAT900__SceneEntourageSeries__`** - the
file is not in numeric order and nothing sits between MAT700 and MAT900. Per SC14 the MAT entries
are **opaque**; the alpha lives only in `SitePlan__FillOpacity`.

### 4.7 Corrections the critiques forced (do not skip these)

| # | Correction |
|---|---|
| C1 | **REQ-33 needs `Na__LayoutEditor__AppConfig__.json`.** `SitePlanExportConfig.SupportedScaleDenominators` in the SSOT is **dead config - nothing reads it**. The real list is `LayoutEditor__Scales__SitePlanScaleDenominators` -> `[500, 1250]`. Set it to `[100, 200, 500, 1250, 2500]`, leave the default at 500. |
| C2 | **The repaint fix belongs in `Na__LeVp2d__SitePlanToken`, not `SitePlanPaintKey`.** `SitePlanToken` produces `built.key`, which also keys the `BandPaths` path cache. `Na__LeVp2d__BandPaths` returns a cache hit unconditionally, **and a cached empty array is truthy** - so toggling linework off and on again would leave the viewport permanently empty until a page reload. `SitePlanPaintKey` already begins with `SitePlanToken`, so fixing the token fixes both. Also add `Na__LeVp2d__ForgetPaths(built.key)` to Force Render's site plan branch. |
| C3 | ~~Re-keying buckets by stem gives `defn: nil`~~ - **MOOT. The `by_stem` refactor was not built.** See section 4.9: a smaller change achieves the same thing and never produces a nil definition. |
| C4 | **Do not raise `Weight__Max` in the SSOT pass.** Today Adam's 2.0 pt proposal is clamped to 0.635 mm against a 0.50 mm red line; raising the ceiling first makes it print its full 0.706 mm and *still* sort on top. Raise the ceiling **in the same pass that adds the z-ordered band branch**, so the clamp widens only when the Z sort is there to keep the red line above it. |
| C5 | **`unused` in `Na__SitePlan__SummaryText` must keep its `- skipped.keys` term**, or a layer whose edges are all hidden/soft/smooth is reported both as "nothing on them" and under Check, in the same dialog. Given F6 this is the case RB05 is most likely to hit. |
| C6 | **The saved-state citation was wrong.** `Viewport__ModelLayers` survives because `NormaliseViewport` keeps every `false` key unconditionally - no prefix test. `Viewport__ProjectedEdges` survives because `NormaliseProjectedEdges` exempts the `TrueVision__SitePlan__` prefix. Both are keyed by the **stem**, which is the real reason stems must hold. |
| C7 | **The Patterns panel must not import from the hatch generator before it exists**, or the whole Layout Editor fails to load on an unresolved specifier and `Na__Verify__Exports__.mjs` fails first. Give the panel its own minimal preview function, or sequence the generator ahead of it. |
| C8 | **Two edited files need imports the design omitted** (`Na__LeSpComp__BLOCK` in SheetRecords; the whole composites + hatch import block in `SheetModel__Viewports__`). Run `Na__Verify__Exports__.mjs` after **every** step that edits a `.js`, not once at the end. |
| C9 | **Do not ship a label that promises the location plan rule before it is built.** Either implement the rule in the same `SitePlanBuild` edit, or word the label as forward-looking. |

### 4.8 The stem rule

`SitePlan__ExportFileNameStem` becomes `Layer__CategoryKey`, which is the identity key in
`Viewport__ModelLayers`, `Viewport__ProjectedEdges`, the owner table and
`Na__LeEdge__SitePlanDefault`.

> **A renamed TAG keeps its old STEM.** Always. The stem is identity; `SitePlan__LayerLabel` is the
> name Adam reads. Renaming a stem silently loses every saved viewport's layer toggles and style
> overrides, and changes every published GLB filename.

So `71__SitePlan__BaseMap__OsMapping__General` keeps the stem `TrueVision__SitePlan__OsMapping`,
`Trees__Existing` keeps `Trees`, and `Trees__ToBeRemoved` keeps `TreesToRemove`. Only the eight
genuinely new tags get new stems. Per SC04 every renamed tag also carries a
`SitePlan__LegacyTagNames` array - follow the shape of the existing `Glb__LineworkLegacyTagNames`.

---
### 4.10 BUILT - two stores, and the key scheme that needs no migration

**The problem.** Both stores publish the *same* `Layer__CategoryKey` values, because both SketchUp
models carry the same tags. `Na__SpStore__LayerData`, `Viewport__ModelLayers` and
`Viewport__ProjectedEdges` are all keyed by that bare key, so the two stores would overwrite each
other and every saved layer toggle would apply to both.

**The rule.** A category key is qualified by its store, **and the default store's qualifier is
empty**:

```
TrueVision__SitePlan__OsMapping            <- the proposed store (the default)
TrueVision__SitePlan__OsMapping@existing   <- the existing store
```

`Na__SpStore__QualifyKey`, `__SplitKey` and `__StoreIdForKey` are the *only* places that know this
shape. Three properties fall out of it, and all three are covered by the committed test:

1. **No migration.** Every viewport saved before the split keys off the bare stem, which is still
   exactly what the proposed store publishes. Layer toggles and edge overrides keep working
   untouched; not one saved record changes.
2. **`Na__LeRec__SITEPLAN_CATEGORY_PREFIX` still matches both forms**, because the suffix is on the
   end, so the no-prune exemption in `NormaliseProjectedEdges` is unaffected.
3. It is the house pattern already used by `Sheet__DrawingType` and `Viewport__ShowFrame`: **the
   default is absent**.

**Which store a viewport draws.** `Viewport__SitePlan.SitePlan__StoreId`, read by
`Na__LeVp2d__SitePlanStoreId` - which lives in the site plan painter, *not* in `SheetRecords`,
because SheetRecords is shared with ValeVision and ValeVision has no site plan store. A viewport
naming no store gets `Na__SpStore__DefaultStoreId()`: the proposed store when it has data, otherwise
the only store that does - which is what a project holding an Existing site plan alone (RB05 today)
needs in order to draw anything at all.

**The store id is in the paint token** (`Na__LeVp2d__SitePlanToken`), not only in the paint key.
That token is `built.key`, which also keys the path cache in `Na__LeVp2d__BandPaths`; without it a
store switch would repaint the previous store's cached path strings. This is critique C2 applied.

### 4.9 BUILT - legacy tag aliases (supersedes the design's `by_stem` refactor)

**The design notes propose re-keying every bucket by stem. That was not built, and should not be.**
Reading `Na__SitePlan__Collect` shows a change one line long does the same job with no nil-definition
risk, which is what critique C3 was about.

The whole mechanism is: **`owner` becomes the definition's canonical `:tag_name`, not the tag name
on the entity.**

```ruby
# was
owner = ctx[:layers].key?(tag_name) ? tag_name : current_tag
# now
owner = ctx[:layers].key?(tag_name) ? ctx[:layers][tag_name][:tag_name] : current_tag
```

`Na__SitePlan__BuildLayerDefinitions` registers each definition under its canonical name **and under
every `SitePlan__LegacyTagNames` entry, pointing at the same object**, with a guard so a live tag
always beats another entry's alias (in either registration order). Buckets therefore stay keyed by
canonical tag name, `ctx[:layers][owner]` is always a real definition, and every downstream
consumer - `Warnings`, `SummaryText`, `Write`, the `skipped` map, the GLB `extras` - is untouched.

A model holding **both** the old and the new tag name collects into **one** bucket and writes **one**
GLB, instead of two buckets racing for the same filename. That is the case RB05 will be in.

One consequence, handled: `scan[:layers]` is now keyed by alias names too, so the pre-export
summary's "tags with nothing on them" count is taken from canonical names only - and keeps its
`- skipped.keys` term (critique C5).

**Verification, 20-Sep-2026.** There is no Ruby interpreter on this machine (see
`[[sketchup-ruby-no-local-interpreter]]`), so:
- a block-keyword balance checker was **calibrated on the committed HEAD copy** (delta 0 = known
  good) and the working copy also reads delta 0, with `open`/`close` each +1 for the new `do...end`;
- the alias logic was ported to JS and unit-tested - 11 checks, all passing, including a control
  that proves the *old* rule really did split the two names into two buckets.
- **Neither is a substitute for running it.** Adam tests in SketchUp (SC03).


## 5. The hatch glyph study (20-Sep-2026)

Two tiles were drawn and rendered before any code, to settle the format against the OS reference:

- **Mixed Woodland** - 18 x 18 mm tile, 8 glyphs (4 conifer, 4 broadleaf), stroke 0.18 mm.
  Conifer 2.3 x 3.4 mm, broadleaf 3.0 x 3.4 mm.
- **Ponds & Lakes** - 15 x 11 mm tile, 5 ripple glyphs, stroke 0.18 mm. Ripple 3.2 x 1.5 mm.

Rendered at 22x, tiled, and at true print size, then composited as fill + pattern + 0.35 mm outline.
**Both read correctly at true print size on paper.** Two findings came out of it:

1. **The tile must be transparent.** A first draft baked the ground colour into the tile, which
   collapses two of Adam's three decks into one. The ground is the fill deck; the tile paints glyphs
   only. This is now decision SC18.
2. **Glyphs clip cleanly at the polygon edge** (a half-drawn tree at the boundary), which is what OS
   mapping does and what `<pattern>` gives for free.

The study harness is reproducible: an HTML file rendered with headless Chrome
(`chrome.exe --headless --screenshot=<abs path> --window-size=W,H file:///...`). Edge headless does
not work for this; Chrome does. Use it to check any new glyph before committing it.

---

## 6. Phases

Ordering is constrained by three hard dependencies found in the critiques, and **is not negotiable**:

- **P1 before P3.** Legacy-alias support must be in the Ruby *before* the SSOT renames land, or
  RB05 - already tagged with the old names - silently stops exporting those layers.
- **C4.** The `Weight__Max` raise ships with the Z-order band branch, not with the SSOT.
- **C7.** The hatch generator ships before the Patterns panel that imports from it.

| Phase | Scope | Repo | Needs Adam |
|---|---|---|---|
| **P0** | Make **one real fill paint**, on screen and in a PDF (F5 - the whole fill path is unexercised). Use PS02 as the scratch fixture. Nothing else is built on an unproven path | TrueVision | no |
| **P1** | Ruby: legacy tag aliases + canonical-owner resolution, the `unused` term (C5) | Plugins | **test** |
| **P2** | Z-index end to end: SSOT fields, Ruby, build script, store helper + derivation. `Layer__DrawOrder` untouched | all three | test |
| **P3** | SSOT tags: the 8 new tags, 5 renames, 3 Buildings corrections, `MAT800__SitePlanFillSeries__`, `SitePlan__FillMaterialId` + its index function, exclusion lists, meta bumps | Plugins | test |
| **P4** | Painter: `siteRules`, the Z-ordered band branch, the three decks, the `SitePlanToken` fix (C2), `Weight__Max` raise (C4), the location plan rule in `SitePlanBuild` | TrueVision | no |
| **P5** | Scales: `LayoutEditor__Scales__SitePlanScaleDenominators` -> `[100, 200, 500, 1250, 2500]` (C1) | TrueVision | no |
| **P6** | Hatch generator + the two pattern JSONs + the pack/library index | TrueVision | no |
| **P7** | Patterns panel (right column, last) and Site Plan Render Composites (left column) | TrueVision | no |
| **P8** | Exporter: "Export Polygon Faces" toggle, **the F6 face-only export gate across all four places**, the FILE PREFIX header fix, manifest schema v2 | Plugins | test |
| **P9** | Two stores: folders, store-qualified keys, `patch.sitePlan`, pipeline, viewport binding | all three | test |
| **P10** | Adam's sign-off on RB05, then the standing question: offer the ValeVision port | - | yes |

**Every phase ends with** `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs`
(385 files, passing today) and, for a phase that touches the Plugins tree, a **stop-and-ask** so
Adam runs it in SketchUp himself (SC03).

---

## 11b. Requirement audit (20-Sep-2026)

Every `REQ-nn` from section 1, against what is actually built. **`x` means built; `~` means the data
is in place but nothing paints it yet; `-` means not started.** Nothing here is marked on the
strength of a design.

| Req | What Adam asked for | State | Where |
|---|---|---|---|
| 01-03 | Research the SSOT, the exporter, the Layout Editor | x | Survey + Design notes |
| 04 | Nine new site plan tags | x | Tags SSOT v2.4.0 - 26 tags |
| 05 | Three tag renames | x | Plus the two Proposed renames; all five carry `SitePlan__LegacyTagNames` |
| 06 | Buildings: MTE201, 1.5 / 2.0 pt, red wash, Alterations dashed | x | Tags SSOT |
| 07 | SketchUp face materials, opaque | x | Materials SSOT v1.5.0, `MAT800__SitePlanFillSeries__` |
| 08 | A 1-10 Z-index per layer | x | SSOT -> Ruby -> build script -> store, with a derivation for old manifests |
| 09 | Red line 10, buildings 5, fences 3, roads 2, minor streets 1 | x | Section 4.2 table, authored in the SSOT |
| 10 | Line Z and fill Z independent | ~ | Both fields exist and are tested; **the painter does not read them yet** |
| 11 | "Export Polygon Faces" toggle | - | P8 |
| 12 | Faces as a 2D mesh behind the linework | - | P8 |
| 13 | Fills obey the Z-index | - | P4 |
| 14 | Faces are bounded space for an SVG hatch | - | P6 |
| 15 | Design proposal fill `rgba(255, 0, 0, 0.1)` | ~ | `MAT803` + `FillOpacity 0.1` authored; nothing paints it |
| 16 | Fills are rgba with no bounding line | ~ | Same |
| 17 | Pattern JSON files, three-stage naming | - | P6. Format designed, glyphs drawn |
| 18 | An SVG pattern generator | - | P6 |
| 19 | Scale and rotate a pattern per use | - | P6 |
| 20 | A **Patterns** dropdown, last in the right column | - | P7 |
| 21 | Pattern packs from folders | - | P7 |
| 22 | Mixed Woodland hatch | ~ | Drawn, rendered and composited (section 5); not yet a JSON file |
| 23 | Existing / Proposed lock-in on the Project tab | x | Section 4.10 |
| 24 | Its own folder, exported, pushed to R2 | x | Build script + R2 sync |
| 25 | TrueVision holds more than one store | x | Store 1.1.0 |
| 26 | The variant is detected from the folder | x | `SITEPLAN_STORES` catalogue |
| 27 | A viewport links to a store; single-store projects untouched | x | `Viewport__SitePlan.SitePlan__StoreId` + `patch.sitePlanStoreId` |
| 28-29 | Location plan: only the proposal fills, boundary colours only | - | P4 |
| 30-31 | Block plan: the three-deck composite | - | P4 |
| 32 | **Site Plan Render Composites** in the left column | - | P7 |
| 33 | Scales gain 1:100, 1:200, 1:2500 | x | `LayoutEditor__Scales__SitePlanScaleDenominators` |
| 34 | The exporter refuses to overwrite the other variant | x | Never guessed; refuses and says so |
| 35 | Handover notes | x | These three documents |

**What is left is one coherent block:** the site plan **painter** (REQ-10 painting, 13, 28-31), the
**hatch engine** (REQ-14, 17-19, 22), the **two panels** (REQ-20, 21, 32) and the exporter's
**face toggle** (REQ-11, 12). Everything they depend on - the tags, the materials, the Z-index
values, the scales, the two stores - is now in place and tested.

---

## 11c. Land cover materials - the recipe, and what only Adam can do (21-Sep-2026)

Adam, 21-Sep: *"Build out some more materials. Build out the grassland and rough grassland materials
here... Find the SSOT and add new tags and materials for those as well... Create a light grey as well
for whatever tag we have set up for driveways. If there is a hard standing tag, make a material so I
can make the driveway a very light grey as well... I need some materials to fill out the scene for
the site plan because there are huge gaps in it."*

**What landed** (all of it in place and tested; nothing of it can paint until faces exist):

| Piece | Where |
|---|---|
| Grassland and Rough Grassland hatch patterns | `52__LayoutEditor__HatchPatternLibrary/05__SitePlanHatches/`, listed in the pack index |
| Tags `75__SitePlan__SoftLandscape__Grassland` / `__RoughGrassland` | Tags SSOT 2.6.0 |
| Face materials MAT804 grass / MAT805 rough / MAT806 hard standing | Materials SSOT 1.6.0 |
| The light grey wash on Site Access, Site Paths and Hard Surfaces | Tags SSOT 2.6.0 |
| A pattern's own ink (SC23) | `Na__LeHatch__Parse` -> `Pattern__Ink`, applied in `Na__LeVp2d__SitePlanBuild` |

**The recipe, per area, in SketchUp:**

1. Run the Tag Manager once so the two new tags exist (they are filed in the **Site Plan** folder).
2. Paste this in the Ruby Console once per model to create the six fill materials from the SSOT:

```ruby
require 'json'; m = Sketchup.active_model; p_dir = Sketchup.find_support_file('Plugins')
lib = JSON.parse(File.read(File.join(p_dir, 'Na__Common__DataLib__CoreSuEntityStandards', 'Na__DataLib__CoreIndex__Materials__.json')))
made = lib['Na__DataLib__CoreIndex__Materials']['MAT800__SitePlanFillSeries__'].map { |_k, e|
  r, g, b = e['BaseColor'].scan(/\d+/).map(&:to_i)
  mat = m.materials[e['SketchUpName']] || m.materials.add(e['SketchUpName'])
  mat.color = Sketchup::Color.new(r, g, b); mat.alpha = 1.0; e['SketchUpName'] }
puts "Site plan fill materials ready: #{made.join(', ')}"
```

3. Draw each field as a **closed face whose EDGES ARE ON THE SAME TAG**. Painting the face is for
   the model's own sake; the drawing's colour comes from the SSOT.
4. Export Site Plan Data, then reload TrueVision.

> **The trap that will bite first (finding F6, still true - P8 is not built).** A layer with faces
> but **no edges of its own exports nothing at all**, silently. Tracing a field by reusing the OS
> map's edges and tagging only the face gives a Grassland layer with rings and no segments, and
> `Na__SitePlan__Write` skips it ("faces but no visible edges... the layer is skipped"). Copy the
> boundary onto the grass tag, or draw it there. The same applies to a drive on Site Paths.

**Why the grass edges are grey, not green:** SC24. A traced field edge lands on top of the OS line it
was traced from, and both resolve to the same colour, weight and Z, so they merge into one band and
the drawing does not change. The tufts stay green because the pattern carries its own ink (SC23).

**Three numbers Adam may want to move**, each a single SSOT edit: the grass wash `rgb(229,242,214)`,
the rough wash `rgb(231,235,217)` and the hard standing grey `rgb(235,235,235)` (about 8 per cent -
light enough to read as paving, dark enough to survive a laser printer).

**Not yet decided by Adam:** whether Site Paths should wash grey at all (it is where RB05's drives
are, so it does for now - SC26), and whether the tufts should be a darker green than the woodland's
`#43A047`.

---

## 12. Progress ledger

Update this every session. `-` not started, `~` in progress, `x` done **and proven**.

| Phase | Item | State | Version | Notes |
|---|---|---|---|---|
| 0 | Requirement register from Adam's brief (section 1) | x | - | 20-Sep-2026 |
| 0 | Decisions SC01-SC03 put to Adam | x | - | 20-Sep-2026, answered |
| 0 | Codebase survey (REQ-01 to REQ-03) | x | - | 20-Sep-2026. 12 agents, 2.39M tokens. Written up as `TrueVision__NOTES__SitePlanComposites__Survey__.md`. Eight findings overturned assumptions - see section 3.3 |
| 0 | Design, judged and critiqued | x | - | 20-Sep-2026. 18 agents, 4.26M tokens. Written up as `TrueVision__NOTES__SitePlanComposites__Design__.md`. Winners and the nine binding corrections are in section 4 |
| 0 | Hatch glyph study - Mixed Woodland and Ponds & Lakes drawn, rendered and composited | x | - | 20-Sep-2026, section 5. Proved the tile must be transparent (SC18) |
| 0 | Decisions SC15-SC19 | x | - | 20-Sep-2026 |
| P0 | One real fill painted, screen + PDF | ~ | v2.89.0 | SCREEN: proven on RB05 20-Sep-2026 - Adam's woodland, pond and proposal washes all painting, with the hatches over them. PDF: the fills and now the pattern deck are both written by the exporter, but **nobody has looked at a printed sheet yet**. Stays `~` until a real PDF is opened and checked |
| P1 | Ruby: legacy tag aliases + canonical-owner resolution, `unused` term (C5) | x | SitePlanExport 1.2.0 | Written 20-Sep-2026, section 4.9. **Run by Adam on RB05 the same afternoon and correct**: 7 layers with geometry, 11 with nothing, 18 total = the SSOT's site plan tag count, so the canonical `unused` term is right. The design's `by_stem` refactor was rejected for a one-line change (C3 moot). **Note the alias path itself is still unexercised** - no tag carries `SitePlan__LegacyTagNames` until P3. What P1 proves is that it is correctly INERT. **Gates P3** |
| P9a | Project tab: Site Plan Data section, **Existing / Proposed choice**, one-click export | x | ProjectActions 2.10.0 | **Pulled forward out of P9 on 20-Sep-2026 because it blocked Adam mid-export.** `UserInterface__ProjectActions__.rb` had zero references to site plans; the only route was a blind `UI.select_directory`. I first shipped this WITHOUT the Existing/Proposed choice, arguing it should land as one piece with the downstream; **Adam overruled that and was right** - RB05's first site plan is an Existing one, so the folder has to be correct on the first write or the data needs migrating later. Getting the folder right is independent of anything reading it. Five files: `ProjectLink` (2 accessors that bypass the `unless defined?` key-list guard), `ProjectPortalMapper` (4 functions), `ProjectActions` (3 actions + selector), the markup, the JS. Not yet run |
| P9b | Pipeline reads two stores | x | ProjectVision | 20-Sep-2026. `SITEPLAN_STORES` catalogue + `SITEPLAN_FOLDER_PREFIX`; `discover_truevision_siteplan_store` takes a folder and store id; new `discover_truevision_siteplan_stores` wrapper; project data emits **`SitePlan__DataStores`** (array) **and keeps `SitePlan__DataStore`** holding the proposed store, so an older TrueVision build reads exactly what it read before. The design-phase skip and the R2 sync both moved from an exact folder test to the prefix. **Proven against real data:** PS01 and PS02 resolve as `proposed` from the legacy folder (5 layers each), **RB05 resolves as `existing` from `SitePlan__DrawingData__Existing` (7 layers)**, AA00 yields none. Both scripts compile |
| P9c | TrueVision store + viewport binding for two stores | x | Store 1.1.0 | 20-Sep-2026. Store rewritten: per-store state maps, `ResolveAll`, `GetStores`, `DefaultStoreId`, and **store-qualified category keys where the default store's qualifier is EMPTY** (section 4.10). Consumers updated: `Viewport2d__SitePlan` (new `Na__LeVp2d__SitePlanStoreId`, store folded into the token), `ModelSource`, `Viewport2d`, `SheetRecords` (`SitePlan__StoreId` normalised, stored only when set), `SheetModel__Viewports` (new `patch.sitePlanStoreId`), `Panel__ViewportSettings` (a Site Plan select on both Add and Edit). PWA token bumped to `2026-09-20-4`. **New committed test `Na__Test__SitePlanStore__.test.mjs` - 21 checks against the real shipped module, all passing.** All 10 tests + both verifiers pass. **Not yet opened in the app** |
| P2 | Z-index end to end | x | Tags 2.4.0 / Store 1.1.0 | 20-Sep-2026. `SitePlan__ZIndexLine` / `__ZIndexFill` in the SSOT, carried by the Ruby into `Layer__ZIndexLine` / `__ZIndexFill`, named in the build script's closed whitelist, read by `Na__SpStore__ZIndex` **with a derivation from `Layer__DrawOrder`** so PS01's published 20/40/70/71/90 still stack as 2/4/7/8/9 with no re-export. `Layer__DrawOrder` untouched. 6 new tests. **The painter does not consume them yet - that is P4** |
| P3 | SSOT tags + `MAT800__SitePlanFillSeries__` | x | Tags 2.4.0, Materials 1.5.0 | 20-Sep-2026. 26 tags: 8 new, 5 renamed with `SitePlan__LegacyTagNames`, the three Buildings corrections. Weights authored in **points** (`SitePlan__LineWeightPt`) with the mm conversion beside them. New `SitePlan__FillMaterialId` resolves against the Materials SSOT through a new `Na__SitePlan__MaterialHexIndex`, and `SitePlan__FillHatchId` is a forward declaration for P6. Exclusion lists rewritten to the 26 names. Written by an all-or-nothing generator that re-parses and cross-checks: 26 unique stems, every legacy name an ex-tag and not still live, every renamed tag aliased exactly once, every weight's mm matching its pt. Verified afterwards that **all 26 line colours and every fill material resolve**, and that every line colour is in the EdgeStyles palette (finding F4), so none can paint black |
| P4b | Site plan subtype: Plan type dropdown + location plan render rule | x | v2.89.0 | 20-Sep-2026. TASK 06. `SitePlan__PlanType` is `block` / `location` / absent for Automatic (1:500 or finer is a block plan). STORED, not inferred: Adam, "By selecting block plan, even at huge scale, it should turn the pattern vectors on." A location plan paints proposal fills only, no patterns, and greyscales every line but the boundary and the proposal - Rec. 709 luminance, so the OS greys are byte-identical and only the green and the blue move. Two places carrying their own `>= 1000` now read the one config number |
| P5 | Site plan scale list | x | AppConfig | `[100, 200, 500, 1250, 2500]`, default 500 (critique C1 - the SSOT's `SupportedScaleDenominators` is dead config) |
| P9d | No folder picker on a linked model | x | SitePlanExport 1.3.0 | 20-Sep-2026, **at Adam's prompting**: the Export tab still opened a blind picker even though the project and store were configured, which defeated the point of linking. `Na__SitePlan__Run` now resolves the destination from the project link itself, so all three routes - Export tab, Project tab, Extensions menu - land in the same place. The confirmation names project, store and path. Linked but no store chosen refuses and points at the Project tab. Only an unlinked model sees a picker |
| P4 | Painter: `siteRules`, three decks, token fix, weight ceiling, location plan rule | x | v2.89.0 | 20-Sep-2026. `Na__LeVp2d__StyleBands` takes `{ Order, Grey, Greyscale }` and, when it has them, orders the bands inside a class by the 1-10 line Z-index with stroke width only breaking a tie; the Z is part of the bucket key, or two layers agreeing on colour and weight would merge and lose their stacking. Weight ceiling 6.00 -> 10.00 (the 2.00 pt proposal outline needs 6.67 at a 0.30 pt master and was silently clamped - every line over 0.635 mm printed at 0.635 mm). Location plan rule in `Na__LayoutEditor__SitePlanComposites__.js`. Fill deck sorted by fill Z, independent of line Z |
| P5 | Site plan scale list | x | v2.89.0 | 20-Sep-2026. `SitePlanScaleDenominators` [100, 200, 500, 1250, 2500], and the Tags SSOT's documentation copy caught up with it |
| P6 | Hatch generator + two patterns + indexes | x | HatchPatterns 1.1.0 | 20-Sep-2026. Library loading, pattern resolution, native SVG `<pattern>` generation, and `Na__LeHatch__TilePolylines` so the PDF can stamp a tile it cannot tile. **Tiles are transparent** - the wash is a separate deck. Confirmed painting in the app on RB05 |
| P7a | Patterns panel, last in the right column | x | Panel__Patterns 1.1.0 | 20-Sep-2026. **The panel saved everything and drew nothing until a reload.** The site plan PAINT KEY did not read the hatch block, so `FillSitePlan` compared its key, found it identical and resized the SVG it already had. `Na__LeHatch__Token` now joins the paint key - and deliberately NOT the token that also keys the band path cache, since a hatch edit changes only the `<defs>` and would otherwise re-serialise every OS segment per keystroke. Enter commits without waiting for blur |
| P7b | Site Plan Render Composites, left column | x | Panel__SitePlanComposites 1.0.0 | 20-Sep-2026. Left column, under Render Composites, hidden off a site plan sheet. Solid Fills / Hatch Patterns / Linework from `Na__LayoutEditor__SitePlanComposites__Config__.json`. Linework off still builds the classes (they are the snap source). A location plan overrules the pattern switch and the panel says so |
| P4c | SSOT: OsMapping__MajorFeature, and `SitePlan__LineDashScale` | x | Tags 2.5.0 | 20-Sep-2026. New tag at 0.75 pt in the roads' dark grey, between the 0.5 pt minor feature and the 1.0 pt main roads. New style field `SitePlan__LineDashScale` (0.5 on Proposed Alterations): Adam, "the line dash space scaling needs to be smaller" - it belongs to the LAYER, so it survives a hand-picked line type and touches no other dashed line in either app. Threaded Ruby -> manifest -> store closed list -> `Na__LeEdge__Effective`. `SupportedScaleDenominators` caught up with the five scales the app offers |
| P6b | Hatches on vector shapes (Vectors panel) | x | v2.90.0 | 20-Sep-2026. `Shape__Hatch` on a shape record; a Hatch block last in the Vectors panel, default OFF. Deck order asserted on the real markup: fill, gradient, hatch, then the outline - which rides on the hatch path. Sheet markup is PAPER mm, so no denominator. The PDF tile stamper moved into the hatch module as `Na__LeHatch__DrawPdf` beside `Na__LeHatch__SvgPaint`, mirroring the gradient tool, so the site plan and a drawn rectangle print through the same code |
| P6c | Per-layer "do not fill", and 1:5000 | x | v2.90.0 | 20-Sep-2026. `Hatch__Filled` (stored only when false, and in the hatch token so it repaints) as a Fill checkbox in the Patterns panel - a separate control from the pattern list, because a hatch over bare paper is a real look. 1:5000 on the site plan scale list and in the SSOT |
| P6d | **Land cover materials: Grassland, Rough Grassland and the hard standing grey** | x | Tags 2.6.0, Materials 1.6.0, HatchPatterns 1.2.0 | 21-Sep-2026, section 11c. Two patterns (28 x 26 mm, 10 tufts; 32 x 30 mm, 9 tufts in two shapes), drawn against the OS sheet and rendered at true print size before anything was written. Positions are a **blue-noise scatter scored on a torus** against the three regularities that survive a repeat - shared columns, shared rows, three in line: the first attempt was a skewed lattice and laid diagonal stripes across a field. Two new tags, edges styled as `OsMapping__General` so a traced field merges into the OS line (SC24), fill Z 1 (SC25); MAT804/805/806; the grey wash on Access, Paths and HardSurfaces (SC26). **A pattern may now carry its own ink** (SC23) - one hunk in `SitePlanBuild`, which is what the screen AND the PDF both read. 24 new checks; the two that matter were calibrated against the old code and old data and fail there. **Nothing can paint until Adam tags faces in SketchUp and exports** |
| P6e | Mixed Woodland: the conifer that was cut at the tile seam | x | MixedWoodland 1.0.1 | 21-Sep-2026, found while writing the seam guard. The conifer at x 17.4 on an 18 mm tile reached 0.55 mm past the right edge; a browser clips a `<pattern>` at its tile edge and the PDF stamper does not, so **every wood on screen had that conifer's three right-hand arms cut off** while the PDF printed them whole. Fixed with a knit copy one tile to the left, the way Ponds & Lakes already did it. The new test checks every glyph of every pattern |
| P8 | Exporter: Export Polygon Faces, prefix header fix, manifest v2 | - | - | - |
| P9 | Two stores, Existing and Proposed | x | v2.88.x | 20-Sep-2026. Proven on RB05: the Export tab writes to `SitePlan__DrawingData__Existing` with one click and the viewport panel reads "Existing (14)". P9a-P9d above are the parts |
| P10 | Adam's sign-off, then offer the ValeVision port | - | - | - |
