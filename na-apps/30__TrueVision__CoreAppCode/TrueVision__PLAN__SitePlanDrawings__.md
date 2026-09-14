# TrueVision 3D - Site Plan Drawings: Tag Schema, Site Plan Export, Site Plan Viewports

**Status**: IN PROGRESS (14-Sep-2026). Tag range agreed: 71-75, with similar layers sharing a number (Adam). Phase 1 - the site plan tags in the SSOT - is written; see section 13. The other open questions are in section 10.
**Created**: 14-Sep-2026
**Owner**: Adam Noble
**Spans two repositories**
- `Adam-Noble-01/Plugins` (the SketchUp Plugins folder): the tag SSOT and the TrueVision GLB Builder.
- This repository: the ProjectVision pipeline scripts, the standard example project, and TrueVision 3D.

---

## 0. How to read this document

This work spans many sessions. **Section 13 is the progress ledger** - the only record of what
is actually done. Everything above it is design; revise a decision in place with a dated note.

Start a session by reading sections 1, 3, 10 and 13. Finish a session by updating 13.

Line numbers below were read on 14-Sep-2026 from working copies that other sessions were editing
at the time. Treat them as pointers: find the anchor by its function name before editing.

---

## 1. The brief (Adam, 14-Sep-2026)

- A new **Drawing Type** dropdown in the top-left "main drawing section" of the Layout Editor:
  **Architectural Drawing** or **Site Plan Drawing**. The type sets up two modes.
- On a Site Plan drawing, inserting a viewport adds a **site plan viewport**.
- A new **standard folder** in each project's TrueVision content, separate from the design phase
  GLB stores: a dedicated **site plan drawing data** folder.
- The TrueVision exporter writes **one linework GLB per site plan SketchUp tag** into that folder.
- A site plan viewport reads that data at **1:500 or 1:1250**, with every existing overdrawing tool.
- Site plan drawings are **always the last tabs, immediately before the Project Specification tab**.
- Order of work: map the tag SSOT, propose site plan tags, Adam tags up a drawing in SketchUp,
  then the exporter, the example folder, and TrueVision's handling.
- **Done means**: a robust way to export site plan 2D data from SketchUp and build standardised
  site plan drawings from it in TrueVision.

---

## 2. What a Noble Architecture site plan sheet holds

Surveyed from the PlanVision drawing PNGs already in this repository:
`BH03_T02_D04__LocationAndBlockPlans` (A2), `NP03_T02_D09__LocationAndBlockPlans` (A2),
`EB03_T02_D03__ProposedSiteLocationAndBlockPlan` (A1) and `BH03_T02_D03__ProposedSitePlan` (1:50).

**Two viewports per sheet.** A Block Plan at 1:500 (large) and a Location Plan at 1:1250 (small).

**In the viewports (data from SketchUp):**
- **OS mapping:** thin grey linework - roads and kerbs, plot boundaries, neighbouring buildings.
- **Red line boundary:** a heavier red outline.
- **Proposal:** solid red fill with a red outline. EB03 uses two reds for two parts of the scheme.
- **Existing buildings on the site:** a thin outline (BH03 red, EB03 blue with a light fill).
- **Block plan only:**
  - trees as green filled canopy circles with a stem dot;
  - hedges as green strips;
  - garden paths and terraces in thin grey.

**On the sheet (Layout Editor, not SketchUp):**
- Road names and house numbers as boxed text.
- A north point: a grey circle with a red and white arrow.
- Under each viewport: title, scale bar, "Printed Scale Factor | 1mm : 500mm" and
  "Scale Valid When Printed At : Iso A2".
- Mapping Data Credentials (OS licence number, Crown copyright line) and the Project Portal QR.
- EB03 also carries specification bubbles (DV01, DR01, GC01, VG01) and their notes.

**Not a site plan in this sense.** The 1:50 Proposed Site Plan (BH03 D03) is a projected-model
drawing with dimensions, cars and levels. It stays an Architectural drawing.

**Conclusion.** Site plan *data* is linework plus fills, per layer. Labels, north point, scale bar
and credits belong to the sheet.

---

## 3. Decisions register

`PROPOSED` = recommended here, not yet agreed. `ASK` = needs Adam's answer (also listed in section 10).

| Id | Decision | State |
|---|---|---|
| SP01 | Site plan tags use **71-75**, named `{NN}__SitePlan__{Category}__{Item}`. Similar layers share a number with different names; **one GLB per tag name**, not per number | AGREED (Adam, 14-Sep-2026) |
| SP02 | Site plan tags **never enter the design phase model GLBs**: the model export excludes them at any nesting depth | DONE (GLB Builder 2.6.2: by name and by pattern) |
| SP03 | **One site plan store per project**: `30__TrueVision__AppContent/SitePlan__DrawingData/` | PROPOSED |
| SP04 | The exporter writes a **manifest**, `TrueVision__SitePlanData__Manifest__.json`, beside the GLBs: what was written, counts, bounds, north angle, and each layer's style defaults copied from the SSOT | PROPOSED |
| SP05 | The ProjectVision build script registers the store as a **build-owned** project data key, `SitePlan__DataStore`. It is never a model group and never a dev-owned key | DONE (ProjectVision 0.2.0) |
| SP06 | A site plan viewport **draws the lines as 2D paths**: no projection pipeline, no raster underlay. `Viewport__Kind` stays `'2d'`; a new `Viewport__SitePlan` marks the source | PROPOSED |
| SP07 | Drawing Type is a sheet field, `Sheet__DrawingType`, **stored only when `'siteplan'`** | PROPOSED |
| SP08 | Tab order: `3D Model` \| architectural sheets \| `+` \| site plan sheets \| `Project Specification` | ASK |
| SP09 | Site plan scales `[500, 1250]`, default 500 - a list of their own, kept in config | PROPOSED |
| SP10 | Faces on fill tags export as polygon rings in a `__FillModel__` GLB; TrueVision paints them from the layer style, not from SketchUp materials | ASK (first release or later) |
| SP11 | Layer styles default from the manifest (so from the SSOT); per-viewport overrides use the existing `Viewport__ProjectedEdges`. EdgeStyles gains accent colours | PROPOSED |
| SP12 | The site plan export **ignores tag visibility** (hidden tags still export; hidden entities do not) | ASK |
| SP13 | Coordinates stay in world metres, Y-up, as exported. Drawing mm = (X x 1000, +Z x 1000). North-up rotation comes later, from the manifest's north angle | PROPOSED |
| SP14 | **Phase 0**: the pipeline must keep `LayoutEditor__DrawingsData`. Fixed the same afternoon by the Save Sheets session (v2.39.0). `CrossSection__SceneData` is still in none of the three lists; that session has handed Adam a task for it | DONE (another session) |

---

## 4. The current tag schema (SSOT map)

### 4.1 Where it lives and who loads it

- **Folder:** `Plugins/Na__Common__DataLib__CoreSuEntityStandards/` (git remote `Adam-Noble-01/Plugins`).
- **Files:**
  - `Na__DataLib__CoreIndex__Tags__.json` - v2.2.2, 11-Sep-2026.
  - `Na__DataLib__CoreIndex__EdgeMaterials__.json` - v2.0.0.
  - `...Materials__.json` and `...Components__.json`.
- **Loaders:**
  - `Na__DataLib__CacheData__.rb` fetches the GitHub raw copy first, caches it in the temp folder for 30 minutes, and falls back to the local file.
  - `Na__DataLib__UrlGenerator__.rb` and `Na__DataLib__LocalFallback__.rb` support it.
- **Naming:** `{NN}__{Category}__{Subcategory}`. The number sets sort order and export grouping.
- **Field prefixes:**
  - `Tag__` - identity.
  - `Glb__` - exporter.
  - `Storey__` - storey system.
  - `Layout__` - SketchUp line style and colour.
  - `EdgePainting__` - the Edge Paint plugin.

### 4.2 Sections and number ranges

| Range | Section key | Tags | Export |
|---|---|---|---|
| 00-01 | `00__ModelFlagTags__` | `01__ModelFlag__FloorLevel__IndicatorLines`, `...BuildingJoins__IndicatorLines`, `...OverheadObjects__IndicatorLines`, `01__ModelFlag__ElementsForRemoval` | Flags. Three hide linework; ElementsForRemoval is fully excluded |
| 00-06 | `00__SystemAndUtilityTags__` | `01__OrbitHelperCube`; `02__Linetype__DoorSwings`, `02__ClearanceLines__IndicatorLines`, `02__ProfilePathTracer_Helpers`, `02__DoorHelpers__RotationPivots`, `02__Reference__CadLines__NotUsed`; `05__3dModelingUtil__*`; `06__Reference__CadData__General`, `06__Reference__Drawings__General`; `00__OriginPoint`; `Na__Door__Open/Closed`, `Na__DoorPanel`, `Na__DoorHandle`, `Na__Architrave` | Excluded, except OrbitHelperCube `[1]` |
| 03 | `03__LayoutDrawingLineworkTags__` | `03__LineworkStyle__01.00pt` ... `00.15pt` - an MTE edge colour to Layout line thickness map | Range `[3]`, but 3 is a skip range; treat-as-untagged |
| 07-09 | `07__EnvironmentTags__` | `07__Landscape`, `08__Site__Boundaries`, `09__Site__Vegetation__2D` | Mesh + linework: `TrueVision__LandscapeEnvironment`, `__SiteBoundaries`, `__SiteVegetation2D` |
| 10-19 | `10_19__ExistingBuildingTags__` | 10 whole building, 11 walls ... 19 interior decor | `TrueVision__MainBuildingModel__Existing*`; storey elements |
| 20-29 | `20_29__ProposedBuildingTags__` | the same for proposed | `TrueVision__MainBuildingModel__Proposed*` |
| 30-70 | `30_70__FurnitureAndContextTags__` | 30_38 GF furniture, 39 GF decor, 40_48 FF furniture, 49 FF decor, 50_59 vegetation, 60 entourage 2D, 61 silhouettes (linework hidden), 62_70 scene context | One GLB pair per entry |
| **71-75** | `71_75__SitePlanTags__` (new in v2.3.0) | The 18 site plan layers - section 5 | Fully excluded from model GLBs; Site Plan Export only |
| 76-89 | - | unused | - |
| 90-93 | `90_93__StoreyContainerTags__` | Ground, First, Second, Third floor containers | Children re-segmented as `Storey__{Floor}__{Element}` |
| 94-99 | - | unused | - |

**Top-level blocks:**
- `meta.skipRanges`: `[0, 2, 3, 4, 5, 6]`.
- `ExportExclusions`:
  - `PatternExclusionRegex` `^TrueVision_.*_DoNotExportGLTF$`.
  - `FullyExcludedTagNames` (13).
  - `LineworkHiddenTagNames` (6).
  - `AdvancedSwapOffTagNames` (31, including the `05__SetOut__*` construction tags defined in the EdgeMaterials SSOT).
  - `TreatAsUntaggedTagNames` (9).
- `GlbBuilderConfig.Logging`.
- `LineStyleReference`: the 12 SketchUp line style names, plus a tag template.

### 4.3 How the GLB Builder uses it (Plugins, `Na__TrueVision__GlbBuilderUtility__Modules__`, v2.6.1)

- **Loading.** `Na__ExportConfig__LoadFromDataLib` (Main.rb ~150) reads GitHub first. It builds:
  - `TAG_RANGES` as `{ Glb__ExportFileNameStem => Glb__ExportRangeNumbers }`;
  - the storey maps, skip ranges and exclusion lists.
  - Hard-coded fallbacks are at Main.rb ~445-523.
- **Segmentation.** `Na__ExportCore__OrganizeEntitiesByTags` (CoreExport.rb ~498) looks at **top-level entities only**, by the `NN__` number of their own tag.
  - Everything nested inside goes with its top-level parent.
  - Excluded tag names apply at any depth.
  - A top-level tag in no range is silently ignored.
- **Output.** Per series: `{ProjectPrefix}{Stem}__MeshModel__.glb` and `{ProjectPrefix}{Stem}__LineworkModel__.glb`.
  - Linework is one non-indexed `LINES` primitive with `POSITION` + `COLOR_0` (the edge material colour).
  - Hidden, soft and smooth edges are skipped, and **tag visibility is respected**.
  - Instanced components, doors and camera-follow billboards keep node hierarchy.
- **Tags Manager.** "Create Standardised Tags From Index" (TagsManager.rb ~40):
  - Reads the local SSOT file first.
  - Creates only ranges 1, 7-9, 10-29, 60-61 and 90-93.
  - Skips fully-excluded entries unless they are model flags or storey containers.
  - Applies `Layout__LineStyleName` and `Layout__EdgeColourRGB`.
  - Fallback index: `Na__TrueVision__GlbBuilder__TagsIndex__.json` (30 tags).

### 4.4 Every other reader of the tags SSOT, checked against a new section

| Reader | What it reads | Effect of a new site plan section |
|---|---|---|
| Noble 3D Modelling Tools - Tag Utils (`TagUtils__Run__.rb`) | Loads through `Na__DataLib__CacheData` (GitHub first, 30-minute cache). "Load TrueVision All Tags" takes a fixed list of five sections (`NA_TRUEVISION_ALL_GROUP_KEYS`); "Minimal" takes a fixed list of names | **Does not create site plan tags**: the new section is in neither list, and it reads GitHub. Create them with the GLB Builder's "Create Standardised Tags From Index", which reads the local file first. (Corrected 14-Sep-2026: the first survey said Tag Utils would pick them up.) |
| ValeVision Cloud Sync - `TagVisibilityCapture__.rb` ~148-169 | `{ Tag__SketchUpName => Glb__ExportFileNameStem }` | Safe **only if site plan entries carry no `Glb__ExportFileNameStem`**; otherwise they become ValeVision scene-visibility categories |
| Edge Paint - `ApplyLineThicknessTags__.rb` ~61-146 | The 03 section's colour map; protected names from `AdvancedSwapOffTagNames` or `EdgePainting__AdvancedSwapOff` | **Site plan tags must be protected**, or Advanced mode moves their edges (a red line, say) to Untagged |
| Profile Path Tracer - TagApplier ~107; Assembly Studio - TagManager ~142, 245 | Look up their own tags by name | Unaffected |
| Vale Lantern Importer - DataLibBridge | ConstructionLinework in the EdgeMaterials SSOT | Unaffected |
| TrueVision 3D | Fetches the tags SSOT (`Na__DataLib__LoadAll`), but `Na__DataLib__GetTags` has no consumer; `Na__LayoutEditor__ModelLayers__Config__.json` copies tag to category by hand (`Meta__SsotVersionRead` 2.2.2) | Needs site plan layers from somewhere: the manifest (SP04, SP11) |

### 4.5 Inconsistencies found while mapping (not part of this job, not fixed)

- `05__3dModelingUtil__BoundingBoxes` appears twice as a JSON key (~lines 123 and 130). The second, the AssetDimensions entry, silently replaces the first in every parser, so the BoundingBoxes entry is lost.
- `03__LineThickness__00.30pt` carries `Tag__SketchUpName` `03__LineworkStyle__00.35pt` and a 0.35 description - a copy of the 0.35 entry.
- `TreatAsUntaggedTagNames` lists `03__LineThickness__*`, but the tags are named `03__LineworkStyle__*`, so the list never matches.
- EdgeMaterials: the key `MTE103__LineColour__MediumDarkGrey__L50` carries SketchUp name `...__L45`.
- The GLB Builder README's range table still shows context as 61-70.

---

## 5. Site plan tags (range agreed 14-Sep-2026)

**Decision (Adam, 14-Sep-2026):** use **71-75**, and double up similar tags on the same number with
different names. The entries themselves live in the SSOT - `Na__DataLib__CoreIndex__Tags__.json`,
section `71_75__SitePlanTags__` (v2.3.0). This section explains them.

### 5.1 Principles

1. **71-75.** Nothing used 71-89 before; 76-89 stay free.
2. **`SitePlan` in every name**, so `^\d{2}__SitePlan__` identifies a site plan tag anywhere.
3. **Similar layers share a number; the name picks the GLB.** The number only groups tags in
   SketchUp's Tags panel. (In 10-29 the number picks the GLB; here the name does.)
4. **Site plan data is 2D.** Draw it at ground level; heights are kept in the GLB but ignored in plan.
5. **The style is the standard.** Each entry says how its layer draws - colour, line type, weight,
   fill, and which scales show it - so every project's site plan comes out the same. A viewport can
   still override any of it.

### 5.2 The tags

Core set, used on every planning job: `71 OsMapping`, `72 RedLine`, `73 Proposed`. An unused tag
simply writes no file. Every stem is `TrueVision__SitePlan__` followed by the stem column.

| Number | Tag | Stem | What goes on it | Line (paper) | Fill | 1:1250 | 1:500 |
|---|---|---|---|---|---|---|---|
| 71 Base Map | `71__SitePlan__BaseMap__OsMapping` | `OsMapping` | OS or map-provider DXF: roads, kerbs, plot boundaries, neighbouring buildings | 0.13 mm dark grey | - | on | on |
| | `71__SitePlan__BaseMap__Amendments` | `MapAmendments` | Lines added or corrected where the OS map is out of date | 0.13 mm dark grey | - | on | on |
| | `71__SitePlan__BaseMap__Contours` | `Contours` | Contours and level breaks from a survey | 0.13 mm light grey | - | off | off |
| 72 Boundaries | `72__SitePlan__Boundary__RedLine` | `RedLineBoundary` | The application site boundary | 0.50 mm red | - | on | on |
| | `72__SitePlan__Boundary__BlueLine` | `BlueLineBoundary` | Other land owned by the applicant | 0.50 mm blue | - | on | on |
| | `72__SitePlan__Boundary__WallsAndFences` | `WallsAndFences` | Walls, fences, gates and piers the drawing needs beyond the OS lines | 0.25 mm soft black | - | off | on |
| | `72__SitePlan__Boundary__SettingOutLines` | `SettingOutLines` | Distances to boundaries, building lines, 45 and 25 degree test lines | 0.13 mm red, centre fine | - | off | off |
| 73 Buildings | `73__SitePlan__Buildings__Existing` | `ExistingBuildings` | Existing buildings on the site that stay | 0.25 mm soft black | available, off | on | on |
| | `73__SitePlan__Buildings__ToBeDemolished` | `BuildingsToBeDemolished` | Existing structures to be removed | 0.25 mm soft black, dashed | - | off | on |
| | `73__SitePlan__Buildings__Proposed` | `ProposedBuildings` | Proposed buildings and extensions: the roof outline | 0.35 mm red | red 45% | on | on |
| | `73__SitePlan__Buildings__ProposedSecondary` | `ProposedBuildingsSecondary` | A second part of the proposal, shown lighter | 0.25 mm red | red 20% | on | on |
| 74 External Works | `74__SitePlan__ExternalWorks__HardSurfaces` | `HardSurfaces` | Driveways, parking areas, paths, patios, terraces, tracks | 0.13 mm dark grey | available, off | off | on |
| | `74__SitePlan__ExternalWorks__ParkingAndAccess` | `ParkingAndAccess` | Parking bays, turning heads, visibility splays, access widths | 0.18 mm dark grey, dashed fine | - | off | on |
| | `74__SitePlan__ExternalWorks__DrainageAndServices` | `DrainageAndServices` | Soakaways, drainage runs, manholes, trial pits, service routes | 0.18 mm blue, dotted | - | off | off |
| 75 Soft Landscape | `75__SitePlan__SoftLandscape__Trees` | `Trees` | Tree canopies, with a stem mark | 0.18 mm green | green 35% | off | on |
| | `75__SitePlan__SoftLandscape__HedgesAndPlanting` | `HedgesAndPlanting` | Hedges and planting beds | 0.18 mm green | green 25% | off | on |
| | `75__SitePlan__SoftLandscape__TreesToRemove` | `TreesToRemove` | Trees and hedges to be removed | 0.18 mm red, dashed | - | off | on |
| | `75__SitePlan__SoftLandscape__RootProtectionAreas` | `RootProtectionAreas` | BS 5837 root protection areas and protective fencing | 0.18 mm green, dashed | - | off | on |

**Draw order, bottom to top.** Every fill is drawn under every line. Lines then go: contours,
OS mapping, amendments, hard surfaces, existing buildings, to be demolished, walls and fences,
parking and access, hedges, trees, trees to remove, root protection areas, drainage and services,
secondary proposal, proposal, blue line, red line, setting out lines.

**Colours** come from the EdgeMaterials SSOT:
- red `MTE201__LineColour__Red` `#E53935`
- green `MTE202__LineColour__Green` `#43A047`
- the greys `MTE102` (soft black), `MTE103` (dark grey) and `MTE107` (light grey)
- a **new** blue, `MTE205__LineColour__Blue` `#1E88E5`, Material Blue 600, matching the series' Material 600 convention

**Line types** are TrueVision's EdgeStyles aliases: `solid`, `dashed`, `dashed-fine`, `centre`,
`centre-fine`, `phantom`, `dotted`. The non-solid tags also set a SketchUp tag line style (`Dash`,
`Short dash`, `Dot`, `Dash dot`), so they read the same way in SketchUp.

### 5.3 Fields on a site plan entry (`SitePlan__` prefix)

```json
"71_75__SitePlanTags__": {
    "Tag__Description" : "Site plan drawing tags (71-75). ...",

    "72__SitePlan__Boundary__RedLine": {
        "Tag__SketchUpName"            : "72__SitePlan__Boundary__RedLine",
        "Tag__Description"             : "The application site boundary (the red line). A closed loop of edges at ground level.",
        "Glb__ExportRangeNumbers"      : null,
        "Glb__FullyExcluded"           : true,
        "EdgePainting__AdvancedSwapOff": true,
        "Layout__EdgeColourRGB"        : [229, 57, 53],
        "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__RedLineBoundary",
        "SitePlan__LayerLabel"         : "Red Line Boundary",
        "SitePlan__LayerGroup"         : "Boundaries",
        "SitePlan__DrawOrder"          : 90,
        "SitePlan__ExportFills"        : false,
        "SitePlan__LineColourId"       : "MTE201__LineColour__Red",
        "SitePlan__LineType"           : "solid",
        "SitePlan__LineWeightMm"       : 0.50,
        "SitePlan__FillColourId"       : null,
        "SitePlan__FillOpacity"        : null,
        "SitePlan__VisibleAtScales"    : [500, 1250]
    },

    "73__SitePlan__Buildings__Proposed": {
        "Tag__SketchUpName"            : "73__SitePlan__Buildings__Proposed",
        "Tag__Description"             : "Proposed buildings and extensions as a roof outline. Draw closed FACES at ground level: the face is the fill, its edges the outline.",
        "Glb__ExportRangeNumbers"      : null,
        "Glb__FullyExcluded"           : true,
        "EdgePainting__AdvancedSwapOff": true,
        "Layout__EdgeColourRGB"        : [229, 57, 53],
        "SitePlan__ExportFileNameStem" : "TrueVision__SitePlan__ProposedBuildings",
        "SitePlan__LayerLabel"         : "Proposed Buildings",
        "SitePlan__LayerGroup"         : "Buildings",
        "SitePlan__DrawOrder"          : 71,
        "SitePlan__ExportFills"        : true,
        "SitePlan__LineColourId"       : "MTE201__LineColour__Red",
        "SitePlan__LineType"           : "solid",
        "SitePlan__LineWeightMm"       : 0.35,
        "SitePlan__FillColourId"       : "MTE201__LineColour__Red",
        "SitePlan__FillOpacity"        : 0.45,
        "SitePlan__VisibleAtScales"    : [500, 1250]
    }
}
```

**Why these fields:**
- **`Glb__FullyExcluded: true` plus the name in `ExportExclusions.FullyExcludedTagNames`.** The model export already honours that list at every depth, so site plan geometry can never leak into a design phase GLB.
- **`SitePlan__ExportFileNameStem`, never `Glb__ExportFileNameStem`.** Cloud Sync treats any entry with a `Glb__` stem as a toggleable 3D layer (4.4).
- **`EdgePainting__AdvancedSwapOff`, plus the name in `AdvancedSwapOffTagNames`.** This keeps Edge Paint's Advanced mode off site plan edges.
- **`Layout__EdgeColourRGB`, and `Layout__LineStyleName` on the non-solid tags.** The tag looks right in SketchUp the moment it is created, so the red line shows red with colour-by-tag on.
- **Stems start `TrueVision__SitePlan__`.** Site plan categories can never collide with model categories in Model Layers or Edge Styles.

### 5.4 Top-level block, and the other SSOT edits

```json
"SitePlanExportConfig": {
    "TagNumberRange"             : [71, 75],
    "TagNamePatternRegex"        : "^\\d{2}__SitePlan__",
    "ExportFolderName"           : "SitePlan__DrawingData",
    "ManifestFileName"           : "TrueVision__SitePlanData__Manifest__.json",
    "LineworkFileSuffix"         : "__LineworkModel__",
    "FillFileSuffix"             : "__FillModel__",
    "ExportIgnoresTagVisibility" : true,
    "SupportedScaleDenominators" : [500, 1250],
    "SketchUpTagFolderName"      : "Site Plan"
}
```

- **Tags SSOT v2.3.0:**
  - `meta.fieldPrefixes` gains `SitePlan__`.
  - `FullyExcludedTagNames` and `AdvancedSwapOffTagNames` gain the 18 names.
- **EdgeMaterials SSOT v2.1.0:** adds `MTE205__LineColour__Blue`.
- **Push the Plugins repository** so every reader has v2.3.0. Nothing waits on it: the model export already keeps site plan tags out by pattern (`SITE_PLAN_TAG_PATTERN`), and the Tags Manager reads the local file first.

### 5.5 How to tag a SketchUp model

1. **Create the tags.** Use the GLB Builder's "Create Standardised Tags From Index". New site plan
   tags are filed in a "Site Plan" tag folder (SketchUp 2021 and later).
2. **OS mapping.** Import the DXF in the model's own coordinates, where the building actually sits.
   Group it and tag the group `71__SitePlan__BaseMap__OsMapping`. Raw edges inside stay Untagged,
   which is normal SketchUp practice.
3. **Red line.** Draw it as a closed loop of edges at ground level. Group it and tag the group
   `72__SitePlan__Boundary__RedLine`.
4. **Proposal footprints.** Draw closed **faces** of the roof outline at ground level: the face becomes
   the fill, its edges the outline. Tag them `73__SitePlan__Buildings__Proposed`, or
   `73__SitePlan__Buildings__ProposedSecondary` for the lighter second colour.
5. **Trees and hedges.** A circle face per canopy, plus a small cross or dot for the stem, on
   `75__SitePlan__SoftLandscape__Trees`. Hedges are faces on `75__SitePlan__SoftLandscape__HedgesAndPlanting`.
6. **Where site plan groups live.** Anywhere in the hierarchy - for example one Untagged "Site Plan"
   group holding one group per tag. The export finds the nearest site plan tag above each edge.
   **Never put a site plan tag on 3D model geometry**: it would vanish from the model GLBs.
7. **Text.** Road names, house numbers, dimensions and labels are not modelled; they go on the sheet.
8. **North.** If north is not SketchUp's green axis, set the north angle (Solar North, or Shadows).
   The export records it.
9. **Visibility.** Hidden *tags* still export (SP12); hidden *objects* do not.
10. **Keep it flat.** The export warns about any site plan layer that holds vertical geometry.

---

## 6. PROPOSAL - Site Plan Export (GLB Builder, Plugins repository)

**Built 14-Sep-2026 (GLB Builder 2.7.0, module `Na__TrueVision__GlbBuilder__SitePlanExport__.rb` 1.0.0), awaiting
its first run in SketchUp.** Where the build differs from the proposal below:
- **Summary first.** A confirmation box lists every layer with geometry, the unused tag count and the checks, before
  a folder is chosen.
- **Folder choice.** Picking `30__TrueVision__AppContent` exports into its `SitePlan__DrawingData` (created if
  missing); any other folder name asks first; the last folder is remembered.
- **Prefix.** Model names like `PS01_M10__...` give the `PS01__` prefix.
- **Open edits.** It refuses to run while a group or component is open for editing.
- **Guarded load.** The module loads inside a guard in Main, so a fault in it cannot stop the model export loading.

### 6.1 Interface

- **Dialog.** The export dialog gains a second primary button, **Export Site Plan Data**, and a
  "Site plan files to be exported" list in its output pane (one row per GLB, with counts and warnings).
  "Export GLB Files" is unchanged except for the exclusion in 6.3.
- **Folder.** `UI.select_directory` as today. The dialog names the folder the pipeline expects:
  `...\30__TrueVision__AppContent\SitePlan__DrawingData`.
- **Menu.** An Extensions menu entry beside the existing ones (`Na__PublicApi__RegisterMenu`).

### 6.2 New module `Na__TrueVision__GlbBuilder__SitePlanExport__.rb`

**Loading the tags.** From the local SSOT file first, as the Tags Manager does, so an unpushed
SSOT edit already works; then `Na__DataLib__CacheData`. Entries carrying
`SitePlan__ExportFileNameStem` are the site plan layers.

**Collecting geometry.**
- Walk the model depth-first, accumulating transforms exactly as the model export does (`Z_UP_TO_Y_UP_MATRIX`, inches to metres).
- An entity's bucket is the **nearest site plan tag on itself or an ancestor**.
- Skip:
  - hidden entities;
  - entities on fully-excluded tags other than site plan tags, such as reference CAD;
  - soft, smooth and hidden edges.
- Ignore tag visibility (SP12).
- Faces count only on fill tags, and only as their loops.

**Writing, per layer:**
- **`{prefix}{Stem}__LineworkModel__.glb`.** One flattened, non-indexed `LINES` primitive with `POSITION` + `COLOR_0`.
  - No instancing, door or camera-follow handling, so a reader needs no node matrices.
  - Reuses `Na__LineworkEngine__BuildGltfFromEdgeData` and `Na__GlbEngine__WriteGlbFile`.
- **Fill tags only - `{prefix}{Stem}__FillModel__.glb`.** One mesh with one `LINE_LOOP` primitive per face ring (outer loop and holes).
  - Each primitive carries `extras.Na__SitePlanFace` (face index) and `extras.Na__SitePlanRing` (`outer` or `inner`).
  - Rings, not triangles, because a triangulated fill shows hairline seams in PDF viewers.
- **The manifest (6.5), written last.**
  - It lists exactly what this export wrote.
  - Site plan GLBs already in the folder that this export did not write (a removed tag's old file) are listed and deleted after a confirmation. Otherwise the pipeline keeps publishing a stale layer.

**Warnings**, in the dialog and the export log:
- a layer spanning more than 0.5 m in height;
- a site plan tag that produced no geometry;
- faces on a non-fill tag (ignored, counted);
- bounds larger than 2 km, or far from the origin (float32 precision);
- a site plan tag found inside a group that the model export also writes.

### 6.3 Model export change

- Site plan tags are excluded at any depth, through `FullyExcludedTagNames` from the SSOT.
- The fallback also tests the `^\d{2}__SitePlan__` pattern, so a 30-minute-old cached SSOT still keeps them out. **Done in GLB Builder 2.6.2:** `SITE_PLAN_TAG_PATTERN` in Main, checked in `Na__ExportCore__IdentifyExcludedLayers`. The Site Plan Export must therefore build its own exclusion set rather than reuse the model export's `@excluded_layers`.

### 6.4 Tags Manager

- `NA__TAGS_MANAGER__CREATE_PREFIX_RANGES` gains `(71..75)` (done in GLB Builder 2.6.2, 14-Sep-2026).
- Entries with `SitePlan__ExportFileNameStem` are created even though they are fully excluded.
- They are filed in a SketchUp tag folder, "Site Plan" (`model.layers.add_folder`).
- The local fallback index gains the 18 tags.

### 6.5 Manifest schema (v1)

```json
{
    "SitePlanData__Description"      : "Site plan drawing data exported by the TrueVision3D GLB Builder. One linework GLB per site plan tag, plus a fill GLB for fill tags.",
    "SitePlanData__SchemaVersion"    : 1,
    "SitePlanData__ProjectPrefix"    : "BH03",
    "SitePlanData__SourceModelFile"  : "BH03__...skp",
    "SitePlanData__ExportedIso"      : "2026-09-20T10:15:00Z",
    "SitePlanData__ExporterVersion"  : "2.7.0",
    "SitePlanData__TagsSsotVersion"  : "2.3.0",
    "SitePlanData__Units"            : "metres",
    "SitePlanData__UpAxis"           : "Y",
    "SitePlanData__NorthAngleDeg"    : 0.0,
    "SitePlanData__BoundsMm"         : { "MinX": 0, "MinZ": 0, "MaxX": 0, "MaxZ": 0 },
    "SitePlanData__Layers": [
        {
            "Layer__TagName"        : "73__SitePlan__Buildings__Proposed",
            "Layer__CategoryKey"    : "TrueVision__SitePlan__ProposedBuildings",
            "Layer__Label"          : "Proposed Buildings",
            "Layer__Group"          : "Proposed",
            "Layer__DrawOrder"      : 71,
            "Layer__LineworkFile"   : "BH03__TrueVision__SitePlan__ProposedBuildings__LineworkModel__.glb",
            "Layer__FillFile"       : "BH03__TrueVision__SitePlan__ProposedBuildings__FillModel__.glb",
            "Layer__SegmentCount"   : 12,
            "Layer__RingCount"      : 1,
            "Layer__BoundsMm"       : { "MinX": 0, "MinZ": 0, "MaxX": 0, "MaxZ": 0 },
            "Layer__Style"          : { "LineHex": "#E53935", "LineType": "solid", "LineWeightMm": 0.35, "FillHex": "#E53935", "FillOpacity": 0.45 },
            "Layer__VisibleAtScales": [500, 1250],
            "Layer__Warnings"       : []
        }
    ]
}
```

`Layer__Style` is resolved from the SSOT at export time: MTE ids become hex. A layer added to the
SSOT therefore reaches TrueVision with no TrueVision change.

### 6.6 Hand-over tests

- A tagged test model writes one linework GLB per used tag, and a fill GLB per used fill tag.
- Segment and ring counts match the SketchUp selection; a face with a hole gives one outer and one inner ring.
- Every GLB passes the glTF validator.
- `LINES` is non-indexed with `COLOR_0`.
- The manifest lists every file; a removed tag's old GLB is offered for deletion.
- A model export of the same file contains no site plan edges at any depth.
- Edge Paint Advanced mode leaves site plan edges on their tags.
- The Cloud Sync stem map is unchanged.

---

## 7. PROPOSAL - Pipeline and the standard example folder (this repository)

### 7.1 Phase 0 - the pipeline dropped Layout Editor drawings from R2 (fixed in v2.39.0)

**Update, later on 14-Sep-2026.** The Save Sheets session fixed this while the survey was being
written up (landed about 15:25).
- **Dev-owned keys.** Both Python lists now end with `LayoutEditor__DrawingsData`
  (`ProjectVision__BuildScript__.py` ~75, `CloudflareR2__ModelSync__Main__.py` ~118).
- **Local mirror.** Since v2.39.0, every drawings save also writes its keys into the repo project data,
  through the ProjectVision Flask server (`03__AppUtils/Na__AppUtils__LocalProjectMirror__.js`).
- **Still open.** `CrossSection__SceneData` is in none of the three lists. That session has handed
  Adam a separate task for it.

The analysis below is kept for the record.

**What happens:**
- **Build script.** `ProjectVision__BuildScript__.py` `write_truevision_project_data` (~413) rewrites the local `TrueVision__ProjectData__.json`. It keeps the generated keys plus only `TRUEVISION_DEV_OWNED_KEYS` (~67).
- **Model sync.** `CloudflareR2__ModelSync__Main__.py` `build_project_data_operation` (~497) uploads that local document. It overlays only `DEV_OWNED_PROJECT_DATA_KEYS` (~110) from R2, then mirrors the result back to disk.
- **The gap.** Neither list contains `LayoutEditor__DrawingsData` (or `CrossSection__SceneData`), although the app's `Na__DevSavedKeys` does.
- **The result.** Every pipeline run replaces R2's project data with a copy that has no sheets.

**The evidence:**
- DEVLOG v2.36.0 found PS01's R2 project data holding "only the eight keys of the repository base file" during a test.
- PS01's local file holds exactly those eight keys now.
- The block came back when a browser with the sheets still open saved again.

**The fix.** Add `LayoutEditor__DrawingsData` and `CrossSection__SceneData` to both Python lists.
Then check whether `CrossSection__SceneData` also belongs in `Na__DevSavedKeys`
(`Na__AppFlow__LoadingSequence.js` ~314): Save Sheets writes it to R2, but localhost never overlays it.

**Why first.** Publishing site plan data means running this pipeline.

### 7.2 Build script

**Done 14-Sep-2026 (ProjectVision 0.2.0).** `discover_truevision_model_groups` skips the folder;
`discover_truevision_siteplan_store` builds the key below from the manifest, or from the file names
without one; project data is written when a project has design phases or a site plan store. The
`.bat` and the PowerShell menu needed no change: option 3 runs the build, then the TrueVision-only sync.

- **Skip the site plan folder.** `discover_truevision_model_groups` (~344) must skip `SitePlan__DrawingData`. Otherwise:
  - it becomes a model group;
  - its name sorts after every `DesignPhase...` folder;
  - it has no "existing" in its label - so it becomes the **default design phase the project opens on** (`Na__ModelGroup__PhaseLibrary__.js` ~353-365).
- **Register the store.** A new `discover_siteplan_store` reads the manifest, checks every listed GLB exists, and builds absolute CDN URLs. `generate_truevision_project_data` then emits a build-owned key:

```json
"SitePlan__DataStore": {
    "SitePlan__FolderName"    : "SitePlan__DrawingData",
    "SitePlan__ExportedIso"   : "2026-09-20T10:15:00Z",
    "SitePlan__NorthAngleDeg" : 0.0,
    "SitePlan__BoundsMm"      : { "MinX": 0, "MinZ": 0, "MaxX": 0, "MaxZ": 0 },
    "SitePlan__Layers"        : [
        { "Layer__CategoryKey": "TrueVision__SitePlan__ProposedBuildings", "Layer__Label": "Proposed Buildings", "Layer__Group": "Proposed", "Layer__DrawOrder": 71,
          "Layer__LineworkUrl": "https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/BH03__BoundaryRoad/30__TrueVision__AppContent/SitePlan__DrawingData/BH03__TrueVision__SitePlan__ProposedBuildings__LineworkModel__.glb",
          "Layer__FillUrl": ".../BH03__TrueVision__SitePlan__ProposedBuildings__FillModel__.glb",
          "Layer__Style": { "LineHex": "#E53935", "LineType": "solid", "LineWeightMm": 0.35, "FillHex": "#E53935", "FillOpacity": 0.45 },
          "Layer__VisibleAtScales": [500, 1250], "Layer__SegmentCount": 12, "Layer__BoundsMm": { "MinX": 0, "MinZ": 0, "MaxX": 0, "MaxZ": 0 } }
    ]
}
```

- **Build-owned, not dev-owned.** The key is regenerated on every run and never goes into `Na__DevSavedKeys` or either Python dev list. The v2.39.0 local mirror writes only a drawings save's own keys into the repo file, so it never touches `SitePlan__DataStore`.
- **Existing caveat.** The build script writes project data only when it finds at least one model group (~941-962).

### 7.3 Model sync

**Done 14-Sep-2026 (ProjectVision 0.2.0).** The manifest now uploads beside the GLBs.

- **GLBs need no change.** `discover_model_groups` (~339) already uploads every non-`00__` GLB folder under `30__TrueVision__AppContent`, keyed by folder name, so site plan GLBs upload as they are.
- **Add the manifest JSON** to the upload (the JSON content type already exists) for traceability.
- **`--purge`.** It removes site plan GLBs too, which is correct.

### 7.4 Standard example folder (`26-Projects/AA00__ExampleProjectStructure`)

- **Placeholder note.** Done 14-Sep-2026: `SitePlan__DrawingData/SitePlanData__LineworkGlbs&Manifest__GoHere__.note` in AA00 and in PS01, empty like the PlanVision notes. The pipeline ignores a folder with no GLBs.
- **The DesignPhase example folders.** `DesignPhase01__ConceptDesign__ExistingBuilding` and `...Scheme-01` exist only on disk; git keeps no empty folders, so the "standard structure" is not really in the repository. Add a `.note` to each (ASK).
- **Example project data.** AA00's `TrueVision__ProjectData__.json` still shows the retired `modelDefaults.modelUrls` shape. Bring it up to `modelGroups` plus `SitePlan__DataStore` so the example matches what the build writes.

---

## 8. PROPOSAL - TrueVision 3D

### 8.1 Drawing Type - `Sheet__DrawingType`

- **Record.** Absent means `'architectural'`; stored only as `'siteplan'`, the same pattern as `Viewport__ShowFrame`. Every existing sheet and draft stays byte-identical.
  - `Na__LeRec__NormaliseSheet` (`SheetRecords__` ~542) deletes any other value.
  - `Na__LeModel__CreateSheet` (`SheetModel__` ~321) leaves it absent.
- **Edit.** A new `drawingType` patch key on `Na__LeModel__UpdateSheet` (~385). It announces `sheet-updated`, so auto save and an undo step come as they do for a rename.
- **Interface.** The first row of the Sheet panel (`Panel__Sheet__` `Na__LePanelSheet__Build`, before Name at ~81): a select, `sheet-drawing-type`, reading "Architectural Drawing" / "Site Plan Drawing".
  - The Sheet panel is the first section of the left column - the top-left "main drawing section".
  - The labels go in the Layout Editor config's Labels block.
- **Changing type never converts or deletes a viewport.** It moves the tab and changes what Add Viewport inserts.

### 8.2 Tab order

- **Sort.** `Na__LeModel__GetSheets` (~282) sorts by `(siteplan ? 1 : 0, Sheet__Order)`. This is the one sort point that the tabs, the editor's first-sheet default and the Dev menu all read.
- **Delete.** `Na__LeModel__DeleteSheet` (~367) renumbers `Sheet__Order` by position in the saved array, which **undoes any drag reorder today** (`ReorderSheet` renumbers a sorted copy, ~430). Renumber the sorted list instead. This fixes an existing fault and is needed once there are groups.
- **Reorder.** A drop in `Na__LeModel__ReorderSheet` and the tab strip handler (`TabStrip__` ~176-185) stays inside the sheet's own group.
- **Render.** The tab strip (~157-208) draws `3D Model` | architectural sheets | `+` | site plan sheets | `Project Specification` (SP08). `+` creates an architectural sheet, so the new tab lands right beside it; site plans stay glued to the Specification tab.
- **Rebuild signature.** The tab strip signature (~214-220) includes the type.
- **Drawing number.** The default Drawing No. follows `Sheet__Order` (`SheetRecords__` ~613), so site plans take the last numbers unless the field is typed. Adam's sets often number location plans early (D02-D04).

### 8.3 Site plan store - new folder `52__System__SitePlanData`

- **`Na__SitePlan__Store__.js` (`Na__SpStore__`):**
  - Reads `SitePlan__DataStore` from the loaded project data.
  - Loads lazily, on the first site plan viewport, one layer at a time.
  - Fetches the linework GLBs, and the fill GLBs where present.
- **Parsing.** It reads GLB bytes directly: header, JSON chunk, accessors. That gives Float32 positions and rings.
- **Conversion.** Positions become drawing-mm segment arrays per category: **(X x 1000, +Z x 1000)**, since drawing y points down and equals +world Z. Mapping to (x, -z) would mirror the site against every plan viewport.
- **Status and cache.** Status goes out on `na-siteplan-store-changed`. The cache key is layer URL + `SitePlan__ExportedIso`, so a re-export can never serve stale lines.
- **Never enters the three.js scene.** Site plan data stays out of the model root, the phase library, the category toggles, walk collision and the profile-line caches.
- **Why not the model loader.** It darkens colours, upgrades to fat lines and adds scene objects. Its fingerprint also counts only mesh triangles: every `LineSegments2` counts as 6, so a re-exported linework GLB keeps the same cache key.

### 8.4 Site plan viewport

**Record:**
- `Viewport__Kind: '2d'`. Kept deliberately: dimensions (paper x D), snapping and viewport carry, the caption, the title block scale, PDF export and Render Composites all test for `'2d'`.
- `Viewport__DrawingId: null`.
- New `Viewport__SitePlan: {}` - its presence marks the source. It later holds `RotationDeg` / `NorthUp`.
- Normalised in `SheetRecords__` (~303-388). `Na__LeModel__ResolveViewportSource` (~752) returns a site plan source.

**Add Viewport on a Site Plan sheet** (`Panel__ViewportSettings__` Add block ~143-194):
- A 1:500 / 1:1250 choice and Add.
- Centred on the red line's bounds, or the store's bounds when there is no red line.
- Model Layers preset from each layer's `VisibleAtScales` for the chosen scale.
- With no data yet, it says so and names the export and the folder.

**Scales:**
- New `LayoutEditor__Scales__SitePlanScaleDenominators: [500, 1250]`, default 500.
- `Na__LeScale__Coerce` (`ScaleManager__` ~66) takes the source into account. **Today it silently turns 500 or 1250 into 50.**
- The panel's scale row is built once (`Panel__ViewportSettings__` ~245); it must follow the selected viewport's list.

**Painting** (`Viewport2d__` Fill ~596):
- **No underlay.** The site plan branch skips the raster.
- **Classes.** It builds the `classes` object - `authored` holding the segments, `visible`, `hidden` and `section` empty - and attaches one owner per category through `Na__PlOwners__Attach`. Segments are culled to the window.
- **Existing paint path.** `PaintLinework` / `StyleBands` (~348-492) paint it unchanged.
- **Same classes for the rest.** `GetSnapSource` (~738-747) and `PdfExporter__` (~163-195) read those same classes, so snapping and the vector PDF come with it.
- **Loading.** A badge shows while the store loads.

**Why not the projection pipeline:**
- A model made only of linework projects to an **empty drawing with no error**: `WorkerPool__.js` ~297 returns no segments when there are no occluder triangles. The empty result is cached and persisted like a real one.
- It is also tied to a floor plan record and its cut, and re-projects the whole model each render.
- Site plan lines should never be hidden by anything anyway.

**Model Layers:**
- The category list is the store's layers.
- Switched-off categories are filtered by owner, not by exclusion tokens.
- Labels and groups come from the store.
- `Viewport__ModelLayers` stores only what is off, as today.

**Styles:**
- `Na__LeEdge__Effective`'s default layer becomes the store's `Layer__Style` for site plan categories, instead of the Model Layers config. Per-viewport overrides go in `Viewport__ProjectedEdges` as today.
- `Na__LayoutEditor__EdgeStyles__Config__.json` gains accent colours `red` (MTE201), `green` (MTE202) and `blue` (MTE205) beside its six greys. They are harmless on architectural drawings.

**Fills:**
- **On the sheet.** A new paint step under the linework: one SVG path per category (even-odd rings), with fill colour and opacity from the style.
- **In the PDF.** The same rings through the polyline primitive the vector shapes already print with, `FillOpacity` through jsPDF `GState`.
- **Overrides.** Per-viewport fill colour and opacity join the `Viewport__ProjectedEdges` category record. Its normaliser rebuilds entries, so the two fields must be added there.

**Other caches and PDF:**
- The paint key is store key + window + D + style tokens. Nothing from the projection fingerprints is involved.
- The PDF drops chords under `MinSegmentPaperMm` (0.05 mm), so under 25 mm at 1:500 - fine for OS data; watch small tree circles.

### 8.5 Already working on any sheet, so on a site plan sheet too

- Text, Leaders with specification bubbles, Margin Notes.
- Dimensions (paper x D over a `'2d'` viewport).
- Draw, Rectangle and Gradient vectors, the Eyedropper and palette, Box Select.
- Layers, the title block, Save Sheets, the PDF.

### 8.6 Later - site plan sheet furniture (Phase 6)

- A north point symbol linked to a viewport (manifest north angle plus viewport rotation).
- A scale bar caption in the house style: "Printed Scale Factor | 1mm : 500mm" and "Scale Valid When Printed At : Iso A2".
- A Mapping Data Credentials text block, with the OS licence number from config and the current year.
- Viewport rotation (north up) and an optional reference grid.
- Optional: the design phase's roof plan projected into a site plan viewport through the pipeline's `modelRoot`, for jobs where the proposal is not traced by hand.

---

## 9. Phases

| Phase | Scope | Repository | Depends on |
|---|---|---|---|
| 0 | Pipeline dev-key lists (7.1) - done in v2.39.0 by the Save Sheets session | this | - |
| 1 | Tags SSOT section, `SitePlanExportConfig`, exclusion lists, MTE205 blue, Tags Manager ranges and folder (5, 6.4) | Plugins | Range agreed 14-Sep-2026 (71-75) |
| - | **Adam tags up a real project** in SketchUp (BH03 or EB03 suggested - both already have hand-drawn site plans to compare against) | - | 1 |
| 2 | Site Plan Export: module, dialog, manifest, model-export exclusion, DevLog and ReadMe (6) | Plugins | 1 |
| 3 | Build script store registration and folder skip; manifest upload; AA00 example folder (7.2-7.4) | this | 0, 2 |
| 4 | TrueVision: site plan store, Drawing Type, tab order (8.1-8.3) | this | 3 |
| 5 | TrueVision: site plan viewport - add flow, scales, painting, Model Layers, styles, fills, PDF, snapping (8.4) | this | 4 |
| 6 | Site plan sheet furniture (8.6) | this | 5 |
| 7 | Adam's sign-off, then the standing question: port to ValeVision 3D? | - | 5 |

**Hand-over tests for phases 4-5:**
- On PS01 or the tagged project, at `127.0.0.1` or `localhost` only, with every non-read request blocked:
  - old sheets byte-identical;
  - Drawing Type round trip and undo;
  - tab order after create, drag, delete and type change;
  - a site plan viewport at both scales, with Model Layers presets per scale;
  - edge style and fill overrides;
  - a dimension across the red line measuring true metres;
  - snapping to site plan vertices;
  - a PDF compared with the SVG.
- A Node harness on the GLB parser and the (X, +Z) mapping, using an exported test file.

---

## 10. Questions for Adam

1. **Tags (5.2):** the range is settled (71-75) and all 18 tags are in the SSOT. Are the groupings on each number, the names and the default scales right?
2. **Tab order (SP08):** `+` just after the architectural sheets (recommended, so site plans sit directly before the Specification tab), or at the very end?
3. **Fills (SP10):** needed in the first release? The red proposal fill says yes.
4. **Visibility (SP12):** should hidden tags still export?
5. **Test project:** which project gets tagged up first?
6. **Example folders:** `SitePlan__DrawingData` is now in AA00 and PS01 (14-Sep-2026). AA00's two DesignPhase folders are still empty and untracked - add notes to those too?

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| A pipeline run wipes any dev-owned key it does not list | Fixed for `LayoutEditor__DrawingsData` in v2.39.0; `CrossSection__SceneData` is still unlisted, and Adam holds a task for it; a new dev-owned key joins all three lists (the site plan store key is build-owned, so it joins none) |
| SSOT push timing: the model export reads GitHub first through a 30-minute cache | Site plan export reads the local SSOT first; the model export's exclusion falls back to the `^\d{2}__SitePlan__` pattern (done, GLB Builder 2.6.2) |
| Float32 precision: GLB positions lose about 1 mm at 10 km from the origin | Keep models near the origin as today; the export warns on bounds |
| Large OS imports (50,000+ segments) | Window culling; one PDF line operation per segment is already the norm |
| Other sessions editing the same Layout Editor files (Sheet panel, TabStrip, SheetModel, SheetRecords, Viewport2d, PdfExporter) | Anchored all-or-nothing patches; agree splits by message; re-read before every write |
| GLBs load from the CDN even on localhost | Sync before testing a new export locally |
| `*.localhost` origins take the production path | Test on `127.0.0.1` or `localhost` only |

---

## 12. Survey sources (14-Sep-2026)

- **Plugins:**
  - the Tags SSOT, EdgeMaterials SSOT, `Na__DataLib__CacheData__`, `Na__DataLib__UrlGenerator__`;
  - GLB Builder: Main, CoreExport, EngineCore, LineworkModelHandling, TagsManager, UserInterface, ReadMe, DevLog, the Loader;
  - every other SSOT reader in 4.4.
- **Pipeline:** `ProjectVision__BuildScript__.py` and `CloudflareR2__ModelSync__Main__.py`.
- **TrueVision.** Three read-only surveys:
  - model stores and loading (LoadingSequence, ProjectLoader, MultiModel, LineworkColours, PhaseLibrary, ModelGroupSelector, ModelToggle, R2AssetUpload, ApiClient, the worker's R2 handler);
  - the Layout Editor (SheetModel, SheetRecords, TabStrip, PanelHost, Panel__Sheet, Panel__ViewportSettings, ScaleManager, SheetSurface, Viewport2d, SnapshotRenderer, AutoSave, History, AppConfig);
  - projected linework (Pipeline, ModelStage, StageSampler, AuthoredEdges, Projector, CpuBackend, EdgeExtractor, ClipKernel, WorkerPool, Owners, Persistence, ViewDefinition, EdgeStyles, ModelLayers, PdfExporter).
- **Drawings:** the four PlanVision PNGs in section 2.

---

## 13. Progress ledger

Update this every session. `-` not started, `~` in progress, `x` done and tested.

| Phase | Item | State | Version | Notes |
|---|---|---|---|---|
| - | Mapping: tag SSOT and its readers, GLB Builder, pipeline, TrueVision model stores, Layout Editor, projected linework | x | - | 14-Sep-2026 |
| - | Site plan tag proposal and build plan | x | - | This document |
| - | Tag range decision | x | - | Adam, 14-Sep-2026: use 71-75, doubling up similar tags on a number with different names |
| 0 | Pipeline dev-key lists | x | 2.39.0 | Root cause found by this survey; fixed the same afternoon by the Save Sheets session. `CrossSection__SceneData` still unlisted (Adam holds a task for it) |
| 1 | Tags SSOT v2.3.0, EdgeMaterials v2.1.0, Tags Manager | ~ | GLB Builder 2.6.2 | Written 14-Sep-2026 by an all-or-nothing patch that parses every JSON file and cross-checks the 18 entries (exclusion lists, colours, line types, SketchUp line styles, unique stems). The model export also excludes the `^\d{2}__SitePlan__` pattern (`SITE_PLAN_TAG_PATTERN`), so site plan geometry stays out of model GLBs before any push. Uncommitted and not pushed. Waits on a tagged model |
| - | Adam tags up a project | ~ | - | First pass 14-Sep-2026: `PS01_M10__SitePlanModel` (OS mapping, existing and proposed buildings tagged) |
| 2 | Site Plan Export | ~ | GLB Builder 2.7.0 | Written 14-Sep-2026: module 1.0.0 (scan, summary and checks, linework GLB per tag, fill ring GLBs, manifest, old-file removal), dialog button, Extensions menu item, guarded load. No Ruby outside SketchUp, so only a block-balance check; not yet run in SketchUp |
| 3 | Pipeline registration, example folder | ~ | ProjectVision 0.2.0 | Pipeline done 14-Sep-2026: the folder is never a design phase, `SitePlan__DataStore` is built from the manifest or the file names, the manifest syncs. Harness on the real scripts against a throwaway project: 24 checks. Uncommitted. `SitePlan__DrawingData` added to AA00 and PS01 with a placeholder note (Adam, 14-Sep-2026) |
| 4 | Site plan store, Drawing Type, tab order | - | - | |
| 5 | Site plan viewport | - | - | |
| 6 | Site plan sheet furniture | - | - | |
| 7 | ValeVision question | - | - | Ask at sign-off |
