# TrueVision 3D - Site Plan Composites: SURVEY NOTES (read-only findings)

**Generated** 20-Sep-2026 from a 12-agent read-only survey (2.39M tokens, 445 tool calls).
**Companion to** `TrueVision__PLAN__SitePlanComposites__.md` - that document holds the brief,
the decisions and the ledger. This one holds the *evidence*: what the code does today.

> **Every line number in this document is a POINTER.** Files here are edited constantly.
> Always locate a symbol by its NAME. If a pointer is wrong, the name is still right.

---

## Contents

1. [Adam's house conventions for TrueVision3D — JSON config file shape, module file/header conventions, config loading and registration, versioning/DEVLOG/PWA token, and the verification scripts](#area-1)
2. [TrueVision site plan data store (02__Src__AppModules/52__System__SitePlanData) and its consumers](#area-2)
3. [ProjectVision pipeline: local project folder -> TrueVision project data + Cloudflare R2 objects (site plan store focus)](#area-3)
4. [TrueVision3D Layout Editor - panel system (PanelHost, column tabs), the Render Composites feature, the Scrapbook tab's three libraries, and the ScrapbookCustom Flask-backed transport - surveyed for adding a "Site Plan Render Composites" LEFT-column control and a "Patterns" panel last in the RIGHT column.](#area-4)
5. [TrueVision GLB Builder SketchUp plugin — HtmlDialog UI (tabs, "Project" tab), the Ruby action bridge, the project-portal folder mapper, the site plan export, and the Cloudflare R2 push it drives](#area-5)
6. [TrueVision 3D Layout Editor — the records that persist a site plan viewport (SheetRecords / SheetModel Viewports / ScaleManager), the PDF export path, and the Viewport Settings panel's Add-Viewport flow](#area-6)
7. [TrueVision3D Layout Editor - how a site plan viewport is painted on the sheet today (SVG fills + styled linework), and the seams a fill/pattern/linework composite build must hook into](#area-7)
8. [TrueVision vector fill / pattern / tiling mechanisms, the sheet SVG + <defs>, gradient-to-PDF survival, and the scale/rotate levers a hatch pattern panel can reuse](#area-8)
9. [SketchUp GLB Builder — Site Plan Export (Na__TrueVision__GlbBuilder__SitePlanExport__.rb and its host plugin)](#area-9)
10. [SketchUp SSOT data library (Na__Common__DataLib__CoreSuEntityStandards) - tags, edge materials, face materials, and every plugin that reads them](#area-10)
11. [Cross-cutting findings: seams](#seams)
12. [Cross-cutting findings: feasibility](#feasibility)

---

<a id="area-1"></a>
## 1. Adam's house conventions for TrueVision3D — JSON config file shape, module file/header conventions, config loading and registration, versioning/DEVLOG/PWA token, and the verification scripts

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY — find things by NAME, not by line.

**1. The three-stage naming convention for JSON keys.** Every key in a TrueVision config JSON is `<Stage1>__<Stage2>__<Stage3>`, double-underscore separated, PascalCase in each stage, and the stages narrow left to right. Stage 1 is the SYSTEM (the config file's owning feature, matching its folder/module, e.g. `LayoutEditor`, `FloorPlanViews`). Stage 2 is the BLOCK inside that system (e.g. `EdgeStyles`, `Datum`, `Camera`, `Scrapbook`, `RenderComposites`). Stage 3 is the LEAF value (e.g. `MinMm`, `DefaultZoom`, `Description`). The same three stages repeat on the top-level block key AND on every key inside it, so a block reads `"FloorPlanViews__Datum__Config": { "FloorPlanViews__Datum__DefaultMm": 0, "FloorPlanViews__Datum__MinMm": -5000 }` — the full prefix is repeated inside, never shortened. Two distinct flavours exist and a NEW file must use the NEWER one:
- OLDER (pre-Sept, e.g. `Na__FloorPlan__AppConfig__.json`, `Na__LayoutEditor__AppConfig__.json`): a top-level `"<System>__Description"` string, then `"<System>__<Block>__Config"` objects each opening with `"<System>__<Block>__Description"`.
- NEWER, and what every config written since 12-Sep-2026 uses (`EdgeStyles`, `ModelLayers`, `RenderComposites`, `LineStyleTool`, `Scrapbook`, `ScrapbookParametric`): the file opens with a `"<System>__<Feature>__Meta"` block whose keys are TWO-stage `Meta__<Thing>`: `Meta__FileName`, `Meta__Description`, `Meta__Version`, `Meta__Created` ("DD-MMM-YYYY", e.g. "14-Sep-2026"), `Meta__Author` ("Adam Noble - Noble Architecture"), optionally `Meta__SsotSource` / `Meta__SsotPath` / `Meta__SsotVersionRead` when the file mirrors the SketchUp SSOT, then any number of free-form essay keys `Meta__WhyAliases`, `Meta__DashUnits`, `Meta__WhichClasses`, `Meta__KeyStability`, `Meta__HouseSizes`… Each is a full prose paragraph explaining a decision. Then sibling blocks `"<System>__<Feature>__Colours"`, `"…__LineTypes"`, `"…__Weight"`, `"…__Fallback"`, `"…__Labels"`, `"…__Items"`.
- ARRAY ROWS drop the system prefix and use a TWO-stage singular-noun prefix taken from the row's kind: `Colour__Alias`, `Colour__Label`, `Colour__Hex`, `Colour__SsotKey`, `Colour__Note`; `LineType__Alias`, `LineType__PatternMm`; `Kind__Alias`, `Kind__DashMm`; `Composite__Key`, `Composite__Label`, `Composite__Weight`; `Level__Key`, `Level__Label`, `Level__TitleText`; `Item__Id`, `Item__Name`, `Item__Pieces`; `Element__Id`, `Element__Type`. Nested objects inside a row narrow again: `"Composite__Weight": { "Weight__Kind", "Weight__Default", "Weight__Min", "Weight__Max", "Weight__Step", "Weight__Label" }`.
- Every non-array block opens with a `…__Description` (or `Labels__Description`, `Bounds__Description`) prose key. A `…__Note` string beside a scalar explains an individual value (`LayoutEditor__Sheet__MarginMmNote` sits beside `LayoutEditor__Sheet__MarginMm`).
- UNITS ARE IN THE KEY NAME. `...Mm`, `...Pt`, `...Px`, `...Ms`, `...Deg` — mandatory. House rule: distances in JSON are integer millimetres and are converted to Three.js units in code (stated in `FloorPlanViews__Description` and `Meta__DashUnits`).
- FORMATTING: 4-space indent, and colons are COLUMN-ALIGNED with spaces before the colon inside a `Meta` block and in row literals (`"Meta__FileName"        : "..."`). Array rows are one row per line, fields aligned. Hex colours lower-case `#000000`.

**2. File naming.** `Na__<Feature>__<Thing>__.js` / `.json` / `.css` — `Na__` prefix, double underscore between stages, and a TRAILING `__` before the extension. Configs are `Na__<Feature>__<Thing>__Config__.json`, or `Na__<Feature>__AppConfig__.json` for a system's main config. Stylesheets are `Na__<Feature>__Styles__<Thing>__.css`. Tests are `Na__Test__<Thing>__.test.mjs`; verifiers `Na__Verify__<Thing>__.mjs`. Folders are `NN__<Kind>__<Name>` with a two-digit sort-order prefix and a kind word: `03__Core__Config`, `25__System__RenderStyles`, `35__System__DrawingTools`, `36__System__HatchPatternTools`, `40__Ui__Panels`, `55__Feature__Scrapbook`, `70__DevTools__DevMenu`. Kind vocabulary in use: `Core`, `System`, `Ui`, `Feature`, `DevTools`, `Scene`, `Lib`, `Style`, `Src`, `Testing`. Panel modules are `Na__LayoutEditor__Panel__<Name>__.js`.

**3. JS identifiers.** Every exported/module-level identifier is `Na__<ShortNamespace>__<Name>`. The short namespace is declared in the header's `NAMESPACE :` line and is NOT the filename: `Na__FloorPlan__ConfigState__.js` → `Na__FpCfg`; `Na__LayoutEditor__PanelHost__.js` → `Na__LePanels`; `Na__LayoutEditor__LineStyleTool__.js` → `Na__LeDash`; `Na__LayoutEditor__Panel__Scrapbook__.js` → `Na__LePanelScrap`; `Na__LayoutEditor__ConfigState__.js` → `Na__LeCfg`; `Na__LayoutEditor__EdgeStyles__.js` → `Na__LeEdge`; `Na__LayoutEditor__RenderComposites__.js` → `Na__LeComposite`. Constants are `Na__Ns__UPPER_SNAKE` (`Na__LePanels__MIN_BODY_PX`, `Na__LeScrap__TAB_ID`, `Na__LeModel__CHANGED_EVENT`). This `Na__` discipline is LOAD-BEARING: `Na__Verify__Exports__.mjs` pass 2 relies on it to catch undeclared identifiers.

**4. Config loading.** There is NO central loader or registry. Each config is fetched by its OWN owning module, once, via a module-level `const Na__Ns__ConfigUrl = new URL('./Na__X__Config__.json', import.meta.url);` plus a memoised promise. Two shapes are in use: `Na__FpCfg__Load()` (guards `Na__FpCfg__LoadPromise`, sets `Na__FpCfg__Config`) and `Na__LeScrap__Ready()` (same, with `fetch(url, { cache : 'no-store' })`). Values are then read only through getters that take a block key constant + a leaf key + a fallback (`Na__FpCfg__Val`, `Na__FpCfg__Num`). HOUSE RULE, stated in nearly every header: a module carries a frozen `Na__Ns__FALLBACKS` object that MIRRORS THE SHIPPED JSON EXACTLY, so a failed fetch degrades to correct behaviour; the storey-level test asserts JSON and fallback are equal.

**5. Registering a NEW config so it actually loads.** For a Layout Editor config: add your module's `Ready()` to the `Promise.all([...])` in `Na__LayoutEditor__ModeController__.js` `Na__LeMode__Initialize` (pointer ~line 811, currently `Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load()`), with the import added to the import region (~lines 170-176). A new PANEL registers itself: import its `…__Register` into the mode controller (~lines 197-208) and call it in the registration run (~lines 368-385). A right-column tab needs `Na__LePanels__RegisterTab('right', { id, title })` called BEFORE the sections that name it (see `Na__LePanelScrap__RegisterTab()` at ~line 375), then each section registers with `Na__LePanels__RegisterSection('right', { id, title, tab : <TAB_ID>, build, refresh })`. A new CSS file must be added as an `@import url('../02__Src__AppModules/…')` line in `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` or it never loads.

**6. Versioning.** There is NO single app-version constant — `grep` for "2.87.0" outside the DEVLOG returns nothing. The release number lives ONLY in the DEVLOG heading. Per-file versions live in the JS header's `DEVELOPMENT LOG:` block (newest entry first, `DD-MMM-YYYY - Version X.Y.Z`) and in a config's `Meta__Version`. Both must be bumped when a file changes; the DEVLOG's **Files** section lists every file and its new version.

**7. PWA token.** `PWA_SW_VERSION_TOKEN` in `02__Src__AppModules/62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js` (pointer line 166), currently `'2026-09-20-3'`, format `YYYY-MM-DD-N` where N restarts each day. Four cache buckets derive from it (`tv-shell-`, `tv-data-`, `tv-models-`, `tv-vendor-`). RULE: bump it whenever shell JS/CSS changes in a way a warm cache would break — specifically when a release adds a NEW EXPORT that a newly-added import names, or the editor dies on the first visit. Bumping it also requires a new `DEVELOPMENT LOG` entry in that same file recording `Token bumped (YYYY-MM-DD-N): <why>`.

**8. Verification.** `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` — run from the app root, no args (optional subdir args resolve under `02__Src__AppModules`). Ran it just now: 385 files, PASS. Two passes: (1) every `import { X } from './relative.js'` names something the target actually exports; (2) every `Na__`-prefixed identifier USED in a file is imported or declared in it. Exit 0 pass / 1 fail. Companion: `node 80__Testing__PrototypeEnvironment/Na__Verify__ModuleGraph__.mjs` — walks the import map out of `Index.html` and proves every specifier resolves on disk. Both must pass before a release ("Both verifiers pass, 385 files" is the DEVLOG phrasing).

**9. Already-existing scaffolding for the coming build (important).** Two EMPTY folders already exist and are clearly the intended homes: `02__Src__AppModules/51__System__LayoutEditor/36__System__HatchPatternTools/` (empty) and app-root `52__LayoutEditor__HatchPatternLibrary/` (holds only two reference PNGs: `OS_Symbol__Examples__.png`, `OS_Symbol__Examples__Woodland&Water__.png`). Also already present: `Na__LayoutEditor__RenderComposites__.js` + `__Config__.json` (the existing composite layer system the "Site Plan Render Composites" dropdown must extend, keyed on `Composite__Key` which is declared unrenameable in `Meta__KeyStability`), and `Na__LayoutEditor__ModelLayers__Config__.json` (the SketchUp-tag → runtime-category map, `Meta__SsotSource: Na__DataLib__CoreIndex__Tags__.json` at SSOT version 2.3.2) and `Na__LayoutEditor__EdgeStyles__Config__.json` (`Meta__SsotSource: Na__DataLib__CoreIndex__EdgeMaterials__.json`, SSOT 2.0.0) — these two are where the new/renamed SketchUp tags and new face materials must land.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\.cursorrules`

The ONLY machine-readable code-style rules file in the app. No CLAUDE.md exists here. Defines the mandatory header/footer comment pattern for every function, class, method and region.

*Key symbols:* `#Region`, `#endregion`, `// FUNCTION |`, `// CLASS |`, `// METHOD |`, `48 dashes`, `56 dashes`, `36 dashes`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md`
*Version:* v2.87.0 (20-Sep-2026) is the latest entry

The release ledger. The app's version number exists ONLY here. Newest entry at the top; 727 KB, read the top 150 lines only.

*Key symbols:* `## TrueVision3D v2.87.0  -  20-Sep-2026`, `**Overview**`, `**Tested**`, `**For Adam**`, `**Files**`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__README__.md`

NOT a project overview - it is a placeholder plus a long essay on the custom SSAO pipeline. Contains no conventions. Do not treat as the conventions source.

*Key symbols:* `RenderEffect__AmbientOcclusion`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json`
*Version:* Meta__Version 1.1.0 (created 12-Sep-2026)

BEST TEMPLATE for a new config JSON. Newer Meta-block style, SSOT-linked, alias/label/hex/ssotkey row shape, Weight bounds block, Fallback block. The site plan accent colours (red/green/blue) already live here.

*Key symbols:* `LayoutEditor__EdgeStyles__Meta`, `Meta__FileName`, `Meta__Version`, `Meta__SsotSource`, `Meta__SsotPath`, `Meta__SsotVersionRead`, `LayoutEditor__EdgeStyles__Colours`, `Colour__Alias`, `Colour__SsotKey`, `LayoutEditor__EdgeStyles__LineTypes`, `LineType__PatternMm`, `LayoutEditor__EdgeStyles__Weight`, `LayoutEditor__EdgeStyles__Fallback`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__Config__.json`
*Version:* Meta__Version 1.1.1 (created 12-Sep-2026)

Maps SketchUp SSOT tag names to runtime model categories, panel labels and default edge styles. THIS is where the new site plan tags and the three renamed tags must be reflected.

*Key symbols:* `LayoutEditor__ModelLayers__Meta`, `Meta__SsotSource (Na__DataLib__CoreIndex__Tags__.json)`, `Meta__SsotVersionRead (2.3.2)`, `Layer__CategoryKey`, `Layer__SketchUpTags`, `Meta__WhyKeyAndTag`, `Meta__HowThisIsUsed`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json`
*Version:* Meta__Version 1.2.0 (created 12-Sep-2026)

The existing per-viewport composite layer inventory that the new 'Site Plan Render Composites' dropdown must extend. One row per layer that goes into a viewport's picture; the panel is built FROM this file, so adding a composite is a config edit.

*Key symbols:* `LayoutEditor__RenderComposites__Layers`, `Composite__Key`, `Composite__Label`, `Composite__TwoDOnly`, `Composite__Toggle`, `Composite__Order`, `Composite__Note`, `Composite__Weight`, `Weight__Kind`, `Weight__Default`, `Meta__KeyStability`, `Meta__WeightKinds`, `Meta__PerViewport`, `Viewport__CompositeWeights`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__LineStyleTool__Config__.json`
*Version:* Meta__Version 1.0.0 (created 14-Sep-2026)

Second-best config template - shows the Defaults / Kinds / Bounds / Labels block quartet, and the Labels convention where every control has both a Labels__X and a Labels__XTitle tooltip string.

*Key symbols:* `LayoutEditor__LineStyleTool__Meta`, `LayoutEditor__LineStyleTool__Defaults`, `LayoutEditor__LineStyleTool__Kinds`, `Kind__Alias`, `Kind__DashMm`, `LayoutEditor__LineStyleTool__Bounds`, `Bounds__MinMm`, `LayoutEditor__LineStyleTool__Labels`, `Labels__DashedTitle`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__LineStyleTool__.js`
*Version:* see its DEVELOPMENT LOG header block

TEMPLATE FOR A TOOL MODULE. Header shows the extended form: DESCRIPTION, a THE RECORD block documenting the sheet-record field shape, INTEGRATION list naming every collaborating module, an IMPORTS ARE KEPT TO... rule, and PORT NOTE.

*Key symbols:* `Na__LeDash (namespace)`, `Na__LeDash__Ready`, `Shape__LineStyle`, `LineStyle__Kind`, `LineStyle__Scale`, `LineStyle__DashMm`, `LineStyle__GapMm`, `LineStyle__MarkMm`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\55__Feature__Scrapbook\Na__LayoutEditor__Scrapbook__Config__.json`
*Version:* Meta__Version 1.0.0 (created 14-Sep-2026)

Shows the Tokens / Pieces / Items / Labels pattern and the {Name} token substitution convention. Item__DrawingTypes ['siteplan','architectural'] is the existing per-drawing-type gating mechanism a Patterns panel would reuse.

*Key symbols:* `LayoutEditor__Scrapbook__Meta`, `Tokens__OsLicenceNumber`, `Pieces__Records`, `Record__Kind`, `Item__Id`, `Item__Name`, `Item__DrawingTypes`, `Item__Pieces`, `Labels__Title`, `Labels__StandardTitle`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\57__Feature__ScrapbookParametric\Na__LayoutEditor__ScrapbookParametric__Config__.json`
*Version:* Meta__Version 1.1.0 (created 19-Sep-2026)

Shows an Elements registry keyed by type + preset id, and the house-measurement Meta essays (Meta__HouseTitle, Meta__HouseBar) that record real measurements taken from Adam's own hand-drawn sheets.

*Key symbols:* `LayoutEditor__ScrapbookParametric__Meta`, `Meta__Block`, `Meta__HouseTitle`, `Meta__HouseBar`, `Elements__TypeNames`, `Elements__List`, `Element__Id`, `Element__Type`, `Element__Params`, `Element__PreviewParams`, `Element__DrawingTypes`, `Group__Parametric`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\42__System__FloorPlanViews\Na__FloorPlan__AppConfig__.json`
*Version:* no Meta__Version; older style

The OLDER config style (top-level __Description string, no Meta block). Useful for seeing block/leaf key repetition and the Labels block, but do NOT copy its header style for a new file.

*Key symbols:* `FloorPlanViews__Description`, `FloorPlanViews__Enabled`, `FloorPlanViews__Datum__Config`, `FloorPlanViews__Camera__Config`, `FloorPlanViews__StoreyLevels__Config`, `Level__Key`, `Level__TitleText`, `FloorPlanViews__Labels__Config`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\42__System__FloorPlanViews\Na__FloorPlan__ConfigState__.js`
*Version:* 1.1.0 (20-Sep-2026); created 31-Aug-2026

TEMPLATE FOR A CONFIG-STATE READER MODULE. Canonical shape: ConfigUrl from import.meta.url, block-key constants, a frozen FALLBACKS object mirroring the JSON, Val/Num private readers, Load() memoised once, then one getter per block.

*Key symbols:* `Na__FpCfg (namespace)`, `Na__FpCfg__ConfigUrl`, `Na__FpCfg__DATUM_BLOCK`, `Na__FpCfg__FALLBACKS`, `Na__FpCfg__Val`, `Na__FpCfg__Num`, `Na__FpCfg__Fetch`, `Na__FpCfg__Load`, `Na__FpCfg__IsEnabled`, `Na__FpCfg__GetLabel`, `Na__FpCfg__FormatLabel`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\55__Feature__Scrapbook\Na__LayoutEditor__Panel__Scrapbook__.js`
*Version:* 1.2.0 (19-Sep-2026); created 14-Sep-2026

TEMPLATE FOR A RIGHT-COLUMN PANEL that lives on a tab - exactly the shape the new 'Patterns' panel needs. Shows RegisterTab + RegisterSection, SetSectionVisible gating, and deferring config reads until Ready() resolves.

*Key symbols:* `Na__LePanelScrap (namespace)`, `Na__LePanelScrap__RegisterTab`, `Na__LePanelScrap__Register`, `Na__LePanelScrap__Build`, `Na__LePanelScrap__Refresh`, `Na__LePanelScrap__Sync`, `Na__LePanelScrap__ID`, `Na__LeScrap__TAB_ID`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__PanelHost__.js`
*Version:* 1.4.0 (19-Sep-2026); created 09-Sep-2026

Owns the left and right columns, their tabs, sections, fold state and delegated controls. Every new panel registers here. Also supplies row builders (SliderRow, LinkedPairRow, Note).

*Key symbols:* `Na__LePanels (namespace)`, `Na__LePanels__RegisterTab`, `Na__LePanels__RegisterSection`, `Na__LePanels__SetSectionVisible`, `Na__LePanels__SetActiveTab`, `Na__LePanels__GetActiveTab`, `Na__LePanels__Refresh`, `Na__LePanels__IsEditable`, `Na__LePanels__Note`, `Na__LePanels__SetFolded`, `Na__LePanels__FocusSection`, `Na__LePanels__SliderRow`, `Na__LePanels__LinkedPairRow`, `Na__LePanels__ApplyToSelection`, `Na__LePanels__STORE_PREFIX`, `data-na-control`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js`
*Version:* see its DEVELOPMENT LOG header block

THE REGISTRATION POINT. Imports and calls every panel's Register, and awaits every Layout Editor config's Ready() in one Promise.all before building anything. A new config or panel that is not added here never loads.

*Key symbols:* `Na__LeMode__Initialize`, `Na__LeMode__ReadyOnce`, `Na__LeMode__Ready`, `Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load() ])`, `Na__LePanelScrap__RegisterTab()`, `Na__LePanelScrap__Register()`, `Na__LePanelStyles__Register()`, `Na__LePanelModelLayers__Register()`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__.js`
*Version:* 1.26.0 (19-Sep-2026); created 09-Sep-2026

The Layout Editor's own config reader. Split into five units in the same folder; the parent re-exports every name so callers never change their imports. Documents the no-cycle rule: the units never import this file.

*Key symbols:* `Na__LeCfg (namespace)`, `Na__LeCfg__SetAppConfig`, `Na__LeCfg__Ready`, `Na__LeCfg__IsEnabled`, `Na__LeCfg__IsReadOnlyOnWeb`, `Na__LeCfg__GetLabel`, `Na__LeCfg__FormatLabel`, `Na__LeCfg__GetPanelSetup`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js`
*Version:* 1.9.1 (20-Sep-2026)

The real service worker. Holds the PWA cache token that MUST be bumped when a release adds exports a warm cache would lack. Note this file is NOT Na__-prefixed - the PWA stack uses a TrueVision__Pwa__ prefix instead.

*Key symbols:* `PWA_SW_VERSION_TOKEN (pointer line 166, currently '2026-09-20-3')`, `PWA_SW_CACHE_NAME_SHELL`, `PWA_SW_CACHE_NAME_DATA`, `PWA_SW_CACHE_NAME_MODELS`, `PWA_SW_CACHE_NAME_VENDOR`, `PWA_SW_CACHE_PREFIXES_OWNED`, `PWA_SW_SHELL_PRECACHE_RELATIVE (pointer line 222)`, `PWA_SW_VENDOR_PRECACHE_RELATIVE`, `PWA_SW_IS_DEV_ENVIRONMENT`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\Na__Pwa__ServiceWorker__.js`
*Version:* 1.0.0 (27-Aug-2026)

Trivial root-level SW stub that importScripts the logic file. Header says DO NOT MOVE THIS FILE - its location IS the worker scope on GitHub Pages.

*Key symbols:* `NA_PWA_SW_LOGIC_RELATIVE_PATH`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Verify__Exports__.mjs`
*Version:* 1.0.0 (10-Sep-2026)

Mandatory post-edit verifier. Two passes: unresolved named imports, and Na__ identifiers used but never imported or declared. Ran during this survey: 385 files, PASS.

*Key symbols:* `StripComments`, `CollectNamedImports`, `CollectExports`, `CollectJsFiles`, `SKIP_DIRS`, `ExportsOf`, `undefinedUses`, `failures`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Verify__ModuleGraph__.mjs`
*Version:* 1.0.0 (10-Sep-2026)

Companion verifier: reads the import map out of Index.html and walks every specifier to a file on disk, vendored library internals included. Carries a Na__Verify__KnownIssues allowlist of real-but-unreachable vendor defects.

*Key symbols:* `Na__Verify__ScriptDir`, `Na__Verify__AppRoot`, `Na__Verify__IndexPath`, `Na__Verify__KnownIssues`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\03__Style__AppStylesheets\Na__CoreUi__Styles__Index__.css`

The single stylesheet manifest. Every feature CSS file is pulled in here with @import url('../02__Src__AppModules/...'). A new Patterns panel stylesheet MUST be added here or it silently never loads.

*Key symbols:* `@import url(...)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\02__AppData\Na__AppConfig__Main.json`

The app-wide main config. Contains no app version string. Holds CloudflareConfig__WorkerBaseUrl, Scene__*, RenderEffect__*, RenderConfig__* and LayoutEditor__Config (the web read-only guard).

*Key symbols:* `CloudflareConfig__WorkerBaseUrl`, `Scene__Default__CameraConfig`, `Scene__Environment`, `RenderEffect__AmbientOcclusion`, `RenderConfig__Linework__LineWidth`, `LayoutEditor__Config`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary`

ALREADY EXISTS, app root. Currently holds only two reference images (OS_Symbol__Examples__.png, OS_Symbol__Examples__Woodland&Water__.png). Sibling of 51__LayoutEditor__UserScrapbookContent (empty) - the established place for user/library content outside 02__Src__AppModules.

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools`

ALREADY EXISTS AND IS EMPTY. Created 20-Sep-2026, numbered to sit directly after 35__System__DrawingTools. This is the intended home for the pattern generator / hatch tool modules.

### Conventions observed

- THREE-STAGE JSON KEYS: <System>__<Block>__<Leaf>, PascalCase per stage, double underscore. The full prefix is REPEATED on every key inside a block - never shortened. Example: "FloorPlanViews__Datum__Config": { "FloorPlanViews__Datum__MinMm": -5000 }.
- ARRAY ROWS use a two-stage singular-noun prefix instead of the system prefix: Colour__Alias, LineType__PatternMm, Kind__DashMm, Composite__Key, Level__Key, Item__Id, Element__Type. Nested objects inside a row narrow again (Composite__Weight -> Weight__Kind, Weight__Default).
- EVERY NEW CONFIG opens with a "<System>__<Feature>__Meta" block containing Meta__FileName, Meta__Description, Meta__Version, Meta__Created (DD-MMM-YYYY), Meta__Author ("Adam Noble - Noble Architecture"), then free-form Meta__<Topic> prose essays explaining each design decision. Add Meta__SsotSource / Meta__SsotPath / Meta__SsotVersionRead when the file mirrors the SketchUp SSOT.
- EVERY non-array block opens with a __Description prose key. A scalar that needs explaining gets a sibling ...Note key (LayoutEditor__Sheet__MarginMm + LayoutEditor__Sheet__MarginMmNote).
- UNITS LIVE IN THE KEY NAME: ...Mm, ...Pt, ...Px, ...Ms, ...Deg. House rule: distances in JSON are integer millimetres, converted to Three.js units in code.
- JSON FORMATTING: 4-space indent; inside Meta blocks and array row literals the colons are column-aligned with spaces before the colon; array rows one per line with aligned fields; hex colours lower-case with a leading #.
- FILE NAMES: Na__<Feature>__<Thing>__.js / .json / .css - Na__ prefix AND a trailing __ before the extension. Configs: Na__X__Y__Config__.json, or Na__X__AppConfig__.json for a system's main config. Stylesheets: Na__X__Styles__Y__.css. Tests: Na__Test__X__.test.mjs. Verifiers: Na__Verify__X__.mjs.
- FOLDER NAMES: NN__<Kind>__<Name> with a two-digit sort prefix. Kind vocabulary in use: Core, System, Ui, Feature, DevTools, Scene, Lib, Style, Src, Testing. e.g. 03__Core__Config, 25__System__RenderStyles, 36__System__HatchPatternTools, 40__Ui__Panels, 55__Feature__Scrapbook.
- JS IDENTIFIERS: every module-level name is Na__<ShortNs>__<Name>, where ShortNs is declared on the header's NAMESPACE line and is an abbreviation, not the filename (Na__FpCfg, Na__LePanels, Na__LeDash, Na__LePanelScrap, Na__LeCfg, Na__LeEdge, Na__LeComposite). Constants are Na__Ns__UPPER_SNAKE.
- MODULE HEADER: a === banner, then FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED lines, a DESCRIPTION bullet list, optional INTEGRATION block naming every collaborating module, optional PORT NOTE block (Ported from / Ported on / Parity / Divergences / Back-port, or Authored in / ValeVision), then DEVELOPMENT LOG with newest entry first as 'DD-MMM-YYYY - Version X.Y.Z' followed by bullets.
- BODY STRUCTURE (from .cursorrules): // REGION ... // endregion for top-level sections; // FUNCTION | Name - Description with a dash rule above and below; // HELPER FUNCTION |, // MODULE IMPORTS |, // MODULE CONSTANTS |, // MODULE VARIABLES |, // MODULE EXPORTS | as sub-headers. Region bodies are indented 4 spaces. 2 blank lines between functions, 3 between regions.
- TRAILING INLINE COMMENTS use the '// <-- ' marker, column-aligned far right, to explain one line.
- A CONFIG READER MODULE always carries a frozen Na__Ns__FALLBACKS object that MIRRORS THE SHIPPED JSON EXACTLY, so a failed fetch degrades to correct behaviour. Tests assert the two are equal.
- '// @delegate: ./Path.js' comments (309 of them) mark a lazy/dynamic dependency that no static import expresses, so the module-graph tooling and a reader can still see it.
- PROSE VOICE: Meta__ essays and header DESCRIPTIONs are written in full, opinionated English explaining WHY, often recording real measurements taken from Adam's own drawings and the date they were taken. This is expected, not optional decoration.
- EXPORTS are a single explicit `export { ... }` list in a MODULE EXPORTS region at the foot of the file - never inline `export function`.

### Extension points

**Register a new config file so it actually loads before the editor builds**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js - Na__LeMode__Initialize, the Promise.all (pointer ~line 811) and the import region (pointer ~lines 170-176)
- *How:* Write Na__<Ns>__Ready() in your owning module (memoised fetch of a URL built from import.meta.url), import it into the mode controller, and add it to the Promise.all alongside Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load().
- *Risk:* There is NO central config registry. A config nobody awaits here is read late or not at all, and the record normaliser will prune stored values against built-in fallbacks instead of the real file.

**Add a 'Patterns' panel to the right column**

- *Where:* Na__LayoutEditor__ModeController__.js import region (pointer ~lines 197-208) and the registration run (pointer ~lines 368-385); the panel host is 02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__PanelHost__.js
- *How:* Copy the shape of Na__LayoutEditor__Panel__Scrapbook__.js: export a …__RegisterTab() calling Na__LePanels__RegisterTab('right', { id, title }) and a …__Register() calling Na__LePanels__RegisterSection('right', { id, title, tab, build, refresh }), then Na__LePanels__SetSectionVisible(id, false) and re-title from config once Ready() resolves. Call RegisterTab BEFORE any section that names it.
- *Risk:* Order matters: sections registered before the first tab exists fall onto the column's default tab. A section off its tab is hidden with the is-off-tab class, never the hidden attribute (SetSectionVisible owns that), and Refresh skips it - so a library's files are not read until its tab is first opened.

**Add the new SketchUp site plan tags and the three renames**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__Config__.json
- *How:* Add rows carrying Layer__CategoryKey (the runtime THREE.Group name the loader creates and every render/linework/owner-tag match uses) and Layer__SketchUpTags (the SSOT tag names). Bump Meta__Version and Meta__SsotVersionRead (currently 2.3.2 against Na__DataLib__CoreIndex__Tags__.json).
- *Risk:* Meta__WhyKeyAndTag is explicit: Layer__CategoryKey is the runtime identity and is matched on everywhere - a rename there is not a label change. Meta__HowThisIsUsed: the panel lists categories the MODEL loaded, not this file, so a row with no GLB behind it silently never appears (and a loaded category this file has not heard of appears under an auto-generated label, so a missing row looks like a working feature).

**Add the new face-material fill colours (opaque in SketchUp, alpha only in TrueVision)**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json
- *How:* The site plan accent rows (red #E53935, green #43A047, blue #1E88E5, added at Meta__Version 1.1.0) already establish the row shape: Colour__Alias / Colour__Label / Colour__Hex / Colour__SsotKey / Colour__Note. Add fill rows the same way, or add a sibling '…__Fills' block if fills need their own alphabet. Bump Meta__Version and Meta__SsotVersionRead (currently 2.0.0 against Na__DataLib__CoreIndex__EdgeMaterials__.json).
- *Risk:* Meta__WhyAliases: Colour__Alias is what a project record STORES, Colour__SsotKey is the thread back to SketchUp. Renaming an alias silently orphans every stored record.

**Add site plan composite layers (fill / pattern / linework) for the 'Site Plan Render Composites' dropdown**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json and Na__LayoutEditor__RenderComposites__.js (Na__LeComposite__Ready)
- *How:* Meta__Description states the panel is built FROM this file, so adding a composite is a config edit: add a row with Composite__Key, Composite__Label, Composite__TwoDOnly, Composite__Toggle, Composite__Order (existing rows step by 10) and optionally Composite__Weight { Weight__Kind: factor|pixels|none, Weight__Default/Min/Max/Step/Label }.
- *Risk:* Meta__KeyStability: Composite__Key is what saved viewports already hold in Viewport__CompositeWeights and MUST NOT be renamed (baseImage is labelled 'Context Layer' rather than renamed, for exactly this reason). Changing a Composite__Weight default moves every viewport that never stored an override.

**Home for the new hatch pattern JSON library and the pattern generator modules**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary (app root, already created) and 02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools (already created, empty)
- *How:* Follow 51__LayoutEditor__UserScrapbookContent / 55__Feature__Scrapbook as the precedent: user/library content sits in the app-root NN__ folder, the code sits in the numbered folder inside 51__System__LayoutEditor. If the library is user-writable JSON files served by a Flask blueprint, copy 56__Feature__ScrapbookCustom (it has a __Transport__.js and its own stylesheet).
- *Risk:* 36__System__HatchPatternTools is empty - nothing references it yet, so nothing will load from it until the mode controller imports it.

**Register a new stylesheet**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\03__Style__AppStylesheets\Na__CoreUi__Styles__Index__.css
- *How:* Add @import url('../02__Src__AppModules/51__System__LayoutEditor/36__System__HatchPatternTools/Na__LayoutEditor__Styles__HatchPatterns__.css'); in the appropriate numbered block.
- *Risk:* A stylesheet not imported here loads nowhere and the panel renders unstyled with no error.

**Record the release**

- *Where:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md (top of file) and 02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js (PWA_SW_VERSION_TOKEN, pointer line 166)
- *How:* Prepend a new entry at the very top using the exact heading format (see traps). Bump PWA_SW_VERSION_TOKEN to the next YYYY-MM-DD-N and add a matching DEVELOPMENT LOG entry in the service worker logic file saying 'Token bumped (YYYY-MM-DD-N): <why>'.
- *Risk:* The app version number exists ONLY in the DEVLOG heading - there is no APP_VERSION constant to update, and grepping for one returns nothing. Forgetting the token bump breaks the editor on every warm cache until the second visit.

### Traps

- THE EXACT DEVLOG HEADING FORMAT (verbatim, whitespace is significant). Each entry is prepended at the TOP of the file, directly under the two-line file banner, in this shape:

# ---------------------------------------------------------
## TrueVision3D v2.87.0  -  20-Sep-2026
### A Plan Knew How High It Was Cut and Not Which Floor That Was

The rule line is '# ' followed by 57 hyphens (59 characters total). The version line is '## TrueVision3D v<X.Y.Z>' then TWO SPACES, a hyphen, TWO SPACES, then 'DD-MMM-YYYY'. The third line is a '### ' narrative title - a full sentence in Adam's storytelling voice naming the fault or the discovery, NOT a feature label. The body then uses bold pseudo-headings in this order: **Overview**, one or more topic headings, **Tested**, **For Adam**, **Files**. (Pointer: lines 4-6 of TrueVision__DEVLOG__.md.)
- THERE IS NO APP VERSION CONSTANT ANYWHERE. Grepping for '2.87.0' or 'v2.87' across .js/.json/.html outside the DEVLOG returns zero hits. Do not go looking for a version file to bump - the DEVLOG heading IS the release record, and per-file versions live in each module's DEVELOPMENT LOG header block and each config's Meta__Version.
- THERE IS NO CLAUDE.md IN THIS APP. The only machine-readable rules file is .cursorrules at the app root, and it covers ONLY the comment header/footer pattern - it says nothing about Na__ naming, JSON keys or versioning. Those must be read off the existing files (as done here), not assumed from .cursorrules.
- THERE IS NO package.json AND NO TEST RUNNER CONFIG. Every check is a bare node invocation from the app root: `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs` and `node 80__Testing__PrototypeEnvironment/Na__Verify__ModuleGraph__.mjs`, plus individual `node 80__Testing__PrototypeEnvironment/Na__Test__<Name>__.test.mjs` files.
- Na__Verify__Exports__.mjs PASS 2 DEPENDS ON THE Na__ PREFIX. It reports any Na__-prefixed identifier a file uses but does not import or declare. So a helper that is NOT Na__-prefixed escapes the check entirely, and conversely any Na__ name used without an import line fails the build. It also strips string literals first (because filenames are Na__-prefixed too) and skips object-literal keys.
- THE ONLY FOLDERS THE VERIFIER SKIPS are node_modules, dist, 00__Archive and 00__ArchivedVersions (SKIP_DIRS). New code anywhere under 02__Src__AppModules is checked; new code OUTSIDE it (e.g. in the app-root 52__LayoutEditor__HatchPatternLibrary) is NOT checked by default - the verifier's roots default to 02__Src__AppModules only.
- A NEW CSS FILE NOT ADDED to 03__Style__AppStylesheets\Na__CoreUi__Styles__Index__.css silently never loads. There is no bundler and no automatic discovery.
- A NEW CONFIG WHOSE Ready() IS NOT IN THE MODE CONTROLLER'S Promise.all is not awaited. The header comments warn what this costs: the record normaliser prunes stored values that match its DEFAULTS, and it can only do that honestly once the real file is in - so an un-awaited config means the first sheet a project opens is normalised against built-in fallbacks and stored data is silently pruned wrong.
- A MODULE'S BUILT-IN FALLBACKS MUST MIRROR THE SHIPPED JSON EXACTLY. This is enforced by test in at least one place (Na__Test__FloorPlanStoreyLevel__.test.mjs compares the shipped JSON against the module's fallback and fails when they differ). Write the fallback and the JSON in the same commit.
- Composite__Key IN Na__LayoutEditor__RenderComposites__Config__.json IS SAVED DATA. Meta__KeyStability says it must not be renamed - saved viewports hold these keys in Viewport__CompositeWeights. The same applies to Colour__Alias in EdgeStyles (stored in records) and Layer__CategoryKey in ModelLayers (matched by the loader, the render, the linework exclusion and the per-segment owner tag).
- Na__LayoutEditor__ModelLayers__Config__.json IS NOT AN INVENTORY. Meta__HowThisIsUsed: the Model Layers panel lists categories the loaded GLB ACTUALLY contains. A row added here with no geometry behind it never appears; a category the model has that this file lacks still appears, under an auto-generated label. So a forgotten row does not error - it just shows an ugly auto-label.
- THE SERVICE WORKER'S PRECACHE LIST IS SHORT AND SPECIFIC (PWA_SW_SHELL_PRECACHE_RELATIVE names only Index.html, the CSS index, Na__AppConfig__Main.json, Na__AppConfig__Hotkeys.json and the manifest fallback). New config JSONs populate the tv-data- bucket naturally on first fetch - do not add them to the shell list, and note the comment warning that precaching a vendor file into the shell bucket 'would look right and do nothing' because the fetch classifier looks in the vendor bucket.
- Na__Pwa__ServiceWorker__.js AT THE APP ROOT MUST NOT BE MOVED - its location is the worker's scope on GitHub Pages, which cannot send a Service-Worker-Allowed header.
- THE PWA STACK BREAKS THE Na__ NAMING RULE ON PURPOSE: TrueVision__Pwa__ServiceWorker__Logic__.js and TrueVision__Pwa__Manifest__Fallback__.webmanifest use a TrueVision__ prefix, and their internal constants are bare UPPER_SNAKE (PWA_SW_VERSION_TOKEN), not Na__-prefixed. Do not 'fix' these.
- TWO FOLDERS FOR THIS BUILD ALREADY EXIST AND ARE EMPTY OR NEARLY SO: 02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools (empty, created 20-Sep-2026) and 52__LayoutEditor__HatchPatternLibrary (two reference PNGs only). Check them before creating new ones - someone has already chosen the numbering.

### Open questions raised by this survey

- Whether the hatch pattern JSON files belong in the app-root 52__LayoutEditor__HatchPatternLibrary (precedent: 51__LayoutEditor__UserScrapbookContent, which is user-written content served by a Flask blueprint) or as a single developer-authored Na__LayoutEditor__HatchPatterns__Config__.json inside 36__System__HatchPatternTools. The Scrapbook system split exactly this way into Standard (config, 55) vs Custom (user JSON files + Transport, 56) - so the answer may be 'both', and that decision shapes every file name.
- Whether the new Z-index / height hierarchy (1..10) is a per-layer key in Na__LayoutEditor__ModelLayers__Config__.json (alongside Layer__CategoryKey) or a new Composite__Order-style field. RenderComposites already owns a draw-order concept via Composite__Order (stepping by 10), so two ordering systems risk disagreeing - worth resolving before either is written.
- Whether the three tag RENAMES require a migration for already-saved projects. Meta__WhyKeyAndTag distinguishes Layer__CategoryKey (runtime, matched everywhere) from Layer__SketchUpTags (SSOT names). If only the SketchUp tag names change, adding the new name to Layer__SketchUpTags may be enough; if a CategoryKey changes, saved viewport data is affected. Nothing read confirms which.
- The SSOT version numbers this build should read: ModelLayers currently declares Meta__SsotVersionRead 2.3.2 against Na__DataLib__CoreIndex__Tags__.json and EdgeStyles declares 2.0.0 against Na__DataLib__CoreIndex__EdgeMaterials__.json. The actual SSOT files under the SketchUp Plugins path were not read in this survey - their current versions need checking before the Meta blocks are written.
- Whether the 'Patterns' right-column panel joins the existing Scrapbook TAB (which already holds three library sections) or gets a tab of its own. Na__LePanels__RegisterTab supports either; the memory note about uniform tab styling suggests Adam cares which.
- Whether the two Existing/Proposed site plan R2 stores need a new config block or reuse the existing Model Source / design-phase machinery (Na__LeSource__Initialize in the mode controller). Not investigated in this survey.

---

<a id="area-2"></a>
## 2. TrueVision site plan data store (02__Src__AppModules/52__System__SitePlanData) and its consumers

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY - find code by symbol name, not by line.

THE TWO FILES. `52__System__SitePlanData` holds exactly two modules, both v1.0.x, created 14-Sep-2026 (Store is 1.0.1 after a stack-overflow fix). `Na__SitePlan__GlbParse__.js` (namespace `Na__SpGlb`) imports nothing - no three.js, no DOM, no network - deliberately, so a Node harness can import a copy. `Na__SitePlan__Store__.js` (namespace `Na__SpStore`) imports `Na__CfApi__GetLoadedProjectData` from `../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js`, three URL helpers from `../03__AppUtils/Na__AppUtils__ProjectLoader.js` (`Na__AppUtils__IsRunningOnLocalhost`, `Na__AppUtils__GetProjectFolderFromUrl`, `Na__AppUtils__GetYearFromUrl`), and the two parse functions.

SOURCE RESOLUTION (`Na__SpStore__Find`, ~line 282). Folder path is built by `Na__SpStore__FolderUrls` (~145) as `{year}-Projects/{project-folder}/30__TrueVision__AppContent/SitePlan__DrawingData`, where year comes from `?year=` (default '26') and the folder from `?project-folder=` (null = no project, store goes empty with "the page URL names no project folder"). It returns `{ local, cdn }`; `local` is `window.location.origin + '/na-project-portal/' + path` and is non-null only on localhost (hostname localhost/127.0.0.1 or port 8000/8090); `cdn` is `https://cdn.noble-architecture.com/NaProjectPortal/` + path. Order: (1) on localhost only, the local repo manifest `{local}/TrueVision__SitePlanData__Manifest__.json`; (2) `SitePlan__DataStore` on the loaded project data; (3) the CDN manifest. Each candidate only wins if it yields at least one layer with linework. Manifest JSON is fetched with `cache:'no-store'`; a `SitePlanData__SchemaVersion` greater than `Na__SpStore__SCHEMA` (1) only logs a warning and still reads. Per-file GLB reads go through `Na__SpStore__Candidates` (~162), which on localhost rewrites a CDN URL to the local repo copy first and falls back to the CDN.

CACHE KEY AND EVENTS. Layer cache key is `categoryKey + '|' + (SitePlan__ExportedIso || '')` in `Na__SpStore__LayerPromises`; loaded geometry is also stored in `Na__SpStore__LayerData` keyed by bare categoryKey. Every GLB URL gets `?v=<exportedIso>` (`Na__SpStore__Versioned`). One event, `na-siteplan-store-changed` (`Na__SpStore__CHANGED_EVENT`), dispatched on `window` inside `queueMicrotask` (never synchronously - that recursion was the 1.0.1 fix), detail `{ reason, status, categoryKey }` with reason one of `'status'`, `'reload'`, `'layer-loaded'`, `'layer-failed'`. Statuses: `idle`/`loading`/`ready`/`empty`.

DESCRIPTOR SHAPE (built by `Na__SpStore__Describe`, ~261, and `Na__SpStore__Layer`, ~234). Top level: `SitePlan__Source` ('project-data' | 'manifest'), `SitePlan__ExportedIso`, `SitePlan__NorthAngleDeg` (0 default), `SitePlan__BoundsMm`, `SitePlan__Layers` (sorted ascending by `Layer__DrawOrder`, default 50, so the red line at 90 lands on top). Each layer: `Layer__CategoryKey` (required, else dropped), `Layer__TagName`, `Layer__Label`, `Layer__Group`, `Layer__DrawOrder`, `Layer__LineworkUrl` (required, else dropped), `Layer__FillUrl`, `Layer__Style` `{ LineColourId, LineHex '#000000', LineType 'solid', LineWeightMm 0.25, FillColourId, FillHex, FillOpacity }`, `Layer__VisibleAtScales` (finite numbers only), `Layer__SegmentCount`, `Layer__BoundsMm`. Bounds are rewritten by `Na__SpStore__Bounds` from `{MinX,MinZ,MaxX,MaxZ}` (world) to `{MinX,MinY,MaxX,MaxY}` (drawing mm; drawing y = +world Z). The manifest branch composes URLs from `Layer__LineworkFile`/`Layer__FillFile` against `folderUrls.cdn`; the project-data branch takes `Layer__LineworkUrl`/`Layer__FillUrl` as written by the build script.

PARSER. `Na__SpGlb__ReadContainer` reads GLB v2 only (magic, version, chunk walk, JSON + first BIN). `Na__SpGlb__Primitives(container, mode)` walks the scene graph (`Na__SpGlb__MeshInstances`, matrix from `matrix` or TRS, depth cap 32, fallback to all meshes when no node places one) and collects only primitives whose mode equals the one asked for: `1` LINES for linework, `2` LINE_LOOP for fill. Mode 4 (triangles) is defined as `Na__SpGlb__MODE_DEFAULT` purely to interpret an absent `mode` and is never collected: THERE IS NO TRIANGLE / MESH PATH TODAY, no LINE_STRIP path, no sparse-accessor support, no COLOR_0 read. POSITION must be a float VEC3 (`Na__SpGlb__ReadVec3`), indices unsigned SCALAR 1/2/4 bytes. Coordinates: `x = worldX * 1000`, `y = worldZ * 1000` (not -Z, which would mirror the site). `ParseLinework` returns `{ segments: Float64Array [x0,y0,x1,y1,...], segmentCount, boundsMm }`; `ParseFill` returns `{ rings: [{ face, outer, points Float64Array }], ringCount, boundsMm }`, where `face` comes from primitive `extras.Na__SitePlanFace` (else the primitive index) and `outer` from `extras.Na__SitePlanRing === 'outer'` (absent = outer). Rings under three corners are skipped. The store keeps only `.rings` from the fill parse and throws its `boundsMm`/`ringCount` away.

CONSUMERS. Drawing: `Na__LayoutEditor__Viewport2d__SitePlan__.js` (all of it). Record/UI: `Viewport2d__.js` (Reload/LoadAll/GetFocusBoundsMm), `Panel__ViewportSettings__.js` (add flow, note, event), `Panel__ModelLayers__.js` (rebuild on event), `ModelLayers__.js` (`Na__LeModelLayers__Groups` builds site plan groups first), `EdgeStyles__.js` (`Na__LeEdge__SitePlanDefault`, prefix `TrueVision__SitePlan__`), `ModelSource__.js` (`Na__LeSource__CategoryKeys`), `PdfExporter__.js` (via `Na__LeVp2d__SitePlanDrawing`). The producer side is `05__ProjectVision__CoreAppCode/ProjectVision__BuildScript__.py`, `discover_truevision_siteplan_store`, which writes the single `SitePlan__DataStore` key.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`
*Version:* 1.0.1 (14-Sep-2026) - DEVELOPMENT LOG in the header block; no separate version constant

The site plan data store: finds the project's site plan layer list (local manifest / SitePlan__DataStore / CDN manifest), loads each layer's GLBs once, caches geometry, announces na-siteplan-store-changed. Module-level singleton - one store per page.

*Key symbols:* `Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed' (~79, exported)`, `Na__SpStore__DATA_KEY = 'SitePlan__DataStore' (~80, exported)`, `Na__SpStore__CDN_BASE = 'https://cdn.noble-architecture.com/NaProjectPortal' (~81)`, `Na__SpStore__PORTAL_DIR = 'na-project-portal' (~82)`, `Na__SpStore__CONTENT_DIR = '30__TrueVision__AppContent' (~83)`, `Na__SpStore__FOLDER = 'SitePlan__DrawingData' (~84, exported)`, `Na__SpStore__MANIFEST = 'TrueVision__SitePlanData__Manifest__.json' (~85, exported)`, `Na__SpStore__SCHEMA = 1 (~86)`, `Na__SpStore__RED_LINE_KEY = 'TrueVision__SitePlan__RedLineBoundary' (~87)`, `Na__SpStore__STATUS_IDLE / _LOADING / _READY / _EMPTY = 'idle'|'loading'|'ready'|'empty' (~92-95, all exported)`, `Na__SpStore__SOURCE_PROJECT = 'project-data' / Na__SpStore__SOURCE_MANIFEST = 'manifest' (~96-97, not exported)`, `Na__SpStore__Status / __Note / __Descriptor / __Pending / __Generation (module state ~102-106)`, `Na__SpStore__LayerPromises : Map cacheKey->Promise (~107)`, `Na__SpStore__LayerData : Map categoryKey->geometry (~108)`, `Na__SpStore__Dispatch(reason, categoryKey) (~126) - queueMicrotask dispatch on window`, `Na__SpStore__SetStatus(status, note) (~135)`, `Na__SpStore__FolderUrls() -> { local, cdn } | null (~145)`, `Na__SpStore__Candidates(url) -> string[] (~162)`, `Na__SpStore__Versioned(url, exportedIso) (~176)`, `Na__SpStore__FetchFirst(urls, asJson) (~185)`, `Na__SpStore__Bounds(raw) -> {MinX,MinY,MaxX,MaxY}|null (~203)`, `Na__SpStore__Style(raw) (~215)`, `Na__SpStore__Layer(raw, source, folderUrls) (~234)`, `Na__SpStore__Describe(raw, source, folderUrls) (~261)`, `Na__SpStore__Find() -> { descriptor, note } (~282)`, `Na__SpStore__Resolve() -> Promise<descriptor|null> (~334, exported)`, `Na__SpStore__Reload() -> Promise<descriptor|null> (~362, exported)`, `Na__SpStore__LoadLayer(categoryKey) -> Promise<{categoryKey, layer, segments, segmentCount, rings, boundsMm}|null> (~384, exported)`, `Na__SpStore__LoadAll() -> Promise<geometry[]> (~434, exported)`, `Na__SpStore__GetStatus() / GetNote() / GetDescriptor() / GetLayers() / GetLayerData(categoryKey) (~445-449, all exported)`, `Na__SpStore__GetFocusBoundsMm() (~455, exported)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__GlbParse__.js`
*Version:* 1.0.0 (14-Sep-2026)

Zero-import GLB reader: turns a linework GLB (LINES) into drawing-mm segments and a fill GLB (LINE_LOOP) into rings. No three.js, no DOM, no network - importable by a Node harness.

*Key symbols:* `Na__SpGlb__MAGIC 0x46546C67 / CHUNK_JSON 0x4E4F534A / CHUNK_BIN 0x004E4942 (~41-43)`, `Na__SpGlb__FLOAT = 5126 ; Na__SpGlb__INDEX_BYTES { 5121:1, 5123:2, 5125:4 } (~44-45)`, `Na__SpGlb__MODE_LINES = 1 ; Na__SpGlb__MODE_LOOP = 2 ; Na__SpGlb__MODE_DEFAULT = 4 (~46-48)`, `Na__SpGlb__MM_PER_METRE = 1000 ; Na__SpGlb__MAX_DEPTH = 32 ; Na__SpGlb__IDENTITY (~49-51)`, `Na__SpGlb__ReadContainer(buffer) -> { json, bin, view } (~63, exported)`, `Na__SpGlb__AccessorBase(container, accessor, elementBytes, label) (~90)`, `Na__SpGlb__ReadVec3(container, accessorIndex) -> Float64Array (~107)`, `Na__SpGlb__ReadIndices(container, accessorIndex) -> Uint32Array (~126)`, `Na__SpGlb__Multiply(a, b) (~150) ; Na__SpGlb__NodeMatrix(node) (~164)`, `Na__SpGlb__MeshInstances(json) -> [{ mesh, matrix }] (~182)`, `Na__SpGlb__Primitives(container, mode) -> [{ primitive, matrix }] (~213)`, `Na__SpGlb__DrawingPoints(container, primitive, matrix, bounds) -> Float64Array [x,y,...] (~230)`, `Na__SpGlb__NewBounds() (~262) ; Na__SpGlb__CloseBounds(bounds) (~266)`, `Na__SpGlb__ParseLinework(buffer) -> { segments, segmentCount, boundsMm } (~280, exported)`, `Na__SpGlb__ParseFill(buffer) -> { rings:[{face,outer,points}], ringCount, boundsMm } (~320, exported)`, `primitive extras read: Na__SitePlanFace (integer), Na__SitePlanRing ('outer')`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js`
*Version:* 1.0.0 (15-Sep-2026, split from Viewport2d__)

The only module that paints site plan data. Builds one linework 'visible' class tagged by layer owner, plus even-odd SVG fills, and is what the PDF exporter awaits.

*Key symbols:* `Na__LeVp2d__SitePlanToken(viewport) (~115) - 'siteplan:' + ExportedIso + ':' + ModelLayers token`, `Na__LeVp2d__SitePlanPaintKey(viewport, masterPt) (~124)`, `Na__LeVp2d__SitePlanBuild(viewport, allowMissing) -> { classes, fills, key } (~142)`, `Na__LeVp2d__SitePlanDrawing(viewport) (~177, exported; awaited by the PDF exporter)`, `Na__LeVp2d__RingPathData(rings) (~188)`, `Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm) (~205)`, `Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm) (~243, exported)`, `Na__LeVp2d__RefillSitePlan(state, viewportId, settled) (~290)`, `Imports Na__SpStore__STATUS_READY/_EMPTY, Resolve, LoadAll, GetStatus, GetNote, GetDescriptor, GetLayerData (~76-85)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js`

Viewport 2D facade: centres a new site plan viewport, forces a re-read on Force Render, re-exports SitePlanDrawing for the PDF exporter.

*Key symbols:* `imports Na__SpStore__Reload, Na__SpStore__LoadAll, Na__SpStore__GetFocusBoundsMm (~181-188)`, `Na__LeVp2d__CentreOnDrawing(sheet, viewport) - site plan branch (~225-235)`, `Na__LeVp2d__ForceRender - awaits Na__SpStore__Reload() then LoadAll() (~414-425)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js`

Right-column panel: the Add Site Plan Viewport flow, the 'N layers, exported <date>' note, and the store event listener.

*Key symbols:* `imports Na__SpStore__CHANGED_EVENT, STATUS_READY, STATUS_EMPTY, Resolve, GetStatus, GetDescriptor, GetFocusBoundsMm (~137-145)`, `Na__LePanelViewport__AddSitePlan(sheet, denominator) (~247) - presets Viewport__ModelLayers off-map from Layer__VisibleAtScales, pans to GetFocusBoundsMm`, `Na__LePanelViewport__ExportDate(iso) (~277)`, `Na__LePanelViewport__Refresh - site plan sheet branch (~444-462)`, `window.addEventListener(Na__SpStore__CHANGED_EVENT, ...) (~579)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__.js`

Builds the Model Layers panel inventory; site plan layers are injected as their own groups, named by Layer__Group / Layer__Label, before any model groups. Also owns the per-viewport off-map and its token.

*Key symbols:* `Na__LeModelLayers__Groups(categoryKeys) (~243) - site plan block calls Na__SpStore__GetLayers() (~253)`, `Na__LeModelLayers__IsOn(viewport, categoryKey) (~301) - absent means on`, `Na__LeModelLayers__HiddenKeys(viewport) (~311)`, `Na__LeModelLayers__Token(viewport) (~325)`, `Na__LeModelLayers__ExcludeTokens(viewport) (~342)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js`

Per-category edge style defaults; a key beginning TrueVision__SitePlan__ takes its default from the store's Layer__Style instead of the config.

*Key symbols:* `Na__LeEdge__SITEPLAN_PREFIX = 'TrueVision__SitePlan__' (~98)`, `Na__LeEdge__SitePlanDefault(categoryKey) (~363) - calls Na__SpStore__GetLayers(); weight = LineWeightMm / master lineweight mm`, `Na__LeEdge__Default(categoryKey) (~381)`, `Na__LeEdge__AliasForHex(hex) (~344)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__ModelSource__.js`

Decides which category keys a viewport lists; a site plan viewport lists the store's layer keys instead of a model phase's.

*Key symbols:* `Na__LeSource__CategoryKeys(viewport) (~188) - reads viewport.Viewport__SitePlan then Na__SpStore__GetLayers()`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ModelLayers__.js`

Model Layers panel; rebuilds itself on every store event except 'layer-loaded'.

*Key symbols:* `window.addEventListener(Na__SpStore__CHANGED_EVENT, ...) (~160)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js`

PDF export: site plan fills drawn as sheet polygons (outer rings only, holes not cut), then the same style bands the screen paints.

*Key symbols:* `imports Na__LeVp2d__SitePlanDrawing (~104) and Na__LeModel__IsSitePlanViewport (~101)`, `Na__LePdf__DrawSitePlanFills(doc, viewport, described, fills) (~246)`, `site plan branch inside the viewport loop (~274-278)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js`
*Version:* 1.15.0+ (header DEVELOPMENT LOG)

Record normalisers: the Viewport__SitePlan marker, Sheet__DrawingType, and the rule that a TrueVision__SitePlan__ edge-style entry is never pruned.

*Key symbols:* `Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural' / Na__LeRec__DRAWING_SITEPLAN = 'siteplan' (~266-267)`, `Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__' (~268)`, `Na__LeRec__IsSitePlanViewport(viewport) (~413) - truthy plain object marker`, `Na__LeRec__NormaliseViewport (~422) - site plan branch (~433-439) keeps Viewport__SitePlan as Object.assign({}, marker) (unknown sub-keys survive), forces KIND_2D and DrawingId null`, `Na__LeRec__IsSitePlanSheet(sheet) (~762)`, `edge-style prune exemption (~368)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js`

CreateViewport/UpdateViewport/ResolveViewportSource - the only writers of Viewport__SitePlan.

*Key symbols:* `Na__LeModel__CreateViewport opts.sitePlan -> Viewport__SitePlan (~192)`, `Na__LeModel__UpdateViewport (~296 scale coercion) - NO patch key for sitePlan today`, `Na__LeModel__ResolveViewportSource site plan branch (~326-328)`, `Na__LeModel__IsSitePlanViewport (~169)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__ScaleManager__.js`

Site plan scale list (1:500 / 1:1250) kept apart from the architectural list.

*Key symbols:* `Na__LeScale__SitePlanSetup() (~74)`, `Na__LeScale__ListDenominators(sitePlan) (~86)`, `Na__LeScale__Coerce(value, sitePlan) (~98)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json`

Labels and scales for site plan work - where a Patterns panel / composites dropdown would add its own labels.

*Key symbols:* `LayoutEditor__Scales__SitePlanScaleDenominators [500,1250] (~158)`, `LayoutEditor__Scales__SitePlanDefaultScaleDenominator 500 (~159)`, `LayoutEditor__Labels__DrawingTypeSitePlan / SitePlanTabTitle / SitePlanViewportName / SitePlanBlockPlan / SitePlanLocationPlan / SitePlanAddScale / AddSitePlanViewport / SitePlanLoading / SitePlanNoData / SitePlanReady / SitePlanNoLayers (~566-589)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py`
*Version:* ProjectVision 0.2.0

Producer of the SitePlan__DataStore key: scans one folder per project, reads the manifest (or falls back to file names) and writes CDN URLs into TrueVision__ProjectData__.json.

*Key symbols:* `SITEPLAN_FOLDER_NAME = 'SitePlan__DrawingData' (~58)`, `SITEPLAN_MANIFEST_FILENAME = 'TrueVision__SitePlanData__Manifest__.json' (~59)`, `SITEPLAN_FILE_PATTERN = r'^(?:.*?__)?(TrueVision__SitePlan__[A-Za-z0-9]+)__(LineworkModel|FillModel)__\.glb$' (~60)`, `discover_truevision_siteplan_store(project_path, year_folder_name, project_folder) (~437)`, `returns SitePlan__FolderName / SitePlan__ManifestUrl / SitePlan__ExportedIso / SitePlan__NorthAngleDeg / SitePlan__BoundsMm / SitePlan__Layers (~527-535)`, `generate_truevision_project_data(..., siteplan_store) writes data['SitePlan__DataStore'] (~565)`, `design-phase scan skips the site plan folder (~410)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\TrueVision__SitePlanData__Manifest__.json`
*Version:* SitePlanData__SchemaVersion 1

The live v1 manifest fixture (PS01, exporter 1.1.1, exported 2026-09-17T19:30:36Z): 5 layers, 5 linework GLBs + 1 fill GLB in the same folder. The realistic test fixture for any parser or store harness.

*Key symbols:* `SitePlanData__Description / __SchemaVersion / __ProjectPrefix / __SourceModelFile / __ExportedIso / __ExporterVersion / __TagsSsotVersion / __Units ('metres') / __UpAxis ('Y') / __NorthAngleDeg / __BoundsMm {MinX,MinZ,MaxX,MaxZ} / __Layers`, `Layer__TagName, Layer__CategoryKey, Layer__Label, Layer__Group, Layer__DrawOrder, Layer__LineworkFile, Layer__FillFile, Layer__SegmentCount, Layer__RingCount, Layer__BoundsMm, Layer__Style{LineColourId,LineHex,LineType,LineWeightMm,FillColourId,FillHex,FillOpacity}, Layer__VisibleAtScales, Layer__Warnings`, `keys present today: TrueVision__SitePlan__OsMapping, __ExistingBuildings, __ProposedBuildingsSecondary, __ProposedBuildings, __RedLineBoundary`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanDrawings__.md`

The plan doc and ledger for this area. Section 5.3 lists the SitePlan__ SSOT fields per tag, 5.4 the SitePlanExportConfig block, 6.5 the manifest schema v1, 8.3 the built store, 8.4 the viewport record, 13 the progress ledger.

*Key symbols:* `SitePlanExportConfig { TagNumberRange [71,75], TagNamePatternRegex, ExportFolderName, ManifestFileName, LineworkFileSuffix '__LineworkModel__', FillFileSuffix '__FillModel__', ExportIgnoresTagVisibility, SupportedScaleDenominators [500,1250], SketchUpTagFolderName 'Site Plan' } (~300-322)`, `Per-tag SSOT fields: SitePlan__ExportFileNameStem, SitePlan__LayerLabel, SitePlan__LayerGroup, SitePlan__DrawOrder, SitePlan__ExportFills, SitePlan__LineColourId, SitePlan__LineType, SitePlan__LineWeightMm, SitePlan__FillColourId, SitePlan__FillOpacity, SitePlan__VisibleAtScales (~245-292)`, `Section 13 progress ledger (~744-761)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Test__DrawingPlanes__.test.mjs`
*Version:* 1.0.0

The house pattern for a zero-import module harness: copies the app's .js module into a tmp dir as .mjs, dynamic-imports it, runs check() assertions, exits 1 on failure. This is the template to copy for a site plan parser harness.

*Key symbols:* `mkdtempSync + copyFileSync + await import(pathToFileURL(...).href) (~44-47)`, `check(name, passed, detail) / near(a,b,tolerance) (~57-62)`, `usage line in header: node 80__Testing__PrototypeEnvironment/Na__Test__DrawingPlanes__.test.mjs`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment\Na__Verify__Exports__.mjs`
*Version:* 1.0.0

Static check that every imported name is actually exported. Must be run after any JS edit in this area (memory rule). Sister script Na__Verify__ModuleGraph__.mjs checks file resolution.

*Key symbols:* `node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs [subdir ...]`, `APP_ROOT / SRC_ROOT resolution from the script's own directory`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary`

ALREADY EXISTS AND IS EMPTY: 01__GeometricHatches, 02__ConstructionMaterialHatches, 03__Placeholder, 04__Placeholder, 05__SitePlanHatches, plus two OS symbol reference PNGs (OS_Symbol__Examples__.png, OS_Symbol__Examples__Woodland&Water__.png). The coming SVG hatch library has a home already; no code references it yet.

*Key symbols:* `05__SitePlanHatches (empty)`, `OS_Symbol__Examples__Woodland&Water__.png`

### Conventions observed

- Header block: a 77-character '// ====' banner, then FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED, a DESCRIPTION bullet list, an INTEGRATION list, optionally a PORT NOTE (Ported from / Parity / Divergences / Back-port), then a '// DEVELOPMENT LOG:' with newest entry first as 'DD-Mon-YYYY - Version X.Y.Z' plus bullets. There is no version constant in code - the header log IS the version record.
- Body is divided by '// REGION | <Name>' banners closed with '// endregion ----'; every function carries a '// FUNCTION | ...' or '// HELPER FUNCTION | ...' comment line followed by a '// ----' rule, and the code inside a region is indented four spaces under the banner.
- Naming: every symbol is prefixed with the file's namespace and double underscores - Na__SpStore__X, Na__SpGlb__X, Na__LeVp2d__X, Na__LeRec__X. Constants are SCREAMING_SNAKE after the prefix (Na__SpStore__STATUS_READY); functions are PascalCase after the prefix.
- Exports: named exports only, gathered in one '// MODULE EXPORTS | ...' block inside a final 'REGION | Module Exports' at the end of the file; no default exports, no export-on-declaration.
- Imports: plain ESM named imports at the top under 'REGION | Module Imports', grouped under '// MODULE IMPORTS | <what>' comment headings with relative paths including the .js extension. No bundler, no import maps in app code.
- Data keys are namespaced with double underscores too: SitePlan__*, Layer__*, Viewport__*, Sheet__*, Category__*, SitePlanData__* (manifest). The app-side descriptor deliberately uses the BUILD's key names (SitePlan__/Layer__) rather than the manifest's (SitePlanData__/Layer__), so both sources normalise to one shape.
- Trailing comment style '// <-- explanation' is used for the load-bearing one-liners; long rationale goes in a comment block above the function.
- Config-driven UI text: every string a user sees comes from Na__LeCfg__GetLabel('Key', 'fallback') and a matching LayoutEditor__Labels__Key entry in Na__LayoutEditor__AppConfig__.json.
- Defensive readers: every JSON value is type-checked with Number.isFinite / typeof / Array.isArray and given a fallback; an entry that fails its required fields is dropped rather than throwing.
- Testing: harnesses live in 80__Testing__PrototypeEnvironment as Na__Test__<Thing>__.test.mjs (Node, no deps, exit 0/1, a USAGE line in the header). Run Na__Verify__Exports__.mjs after every JS edit.

### Extension points

**New tags / renamed tags reaching TrueVision**

- *Where:* Na__SitePlan__Store__.js -> Na__SpStore__Layer / Na__SpStore__Describe
- *How:* Nothing in TrueVision enumerates tags: a layer arrives as a manifest entry with Layer__CategoryKey / Layer__Label / Layer__Group / Layer__DrawOrder / Layer__Style / Layer__VisibleAtScales, and the Model Layers panel, EdgeStyles defaults and the painter all key off those. New SSOT tags need NO TrueVision change as long as the category key keeps the TrueVision__SitePlan__ stem prefix.
- *Risk:* A RENAMED tag changes Layer__CategoryKey, which is the identity used by Viewport__ModelLayers off-maps, Viewport__EdgeStyles overrides (Category__* entries) and the owners table. Existing saved sheets will silently keep the OLD key switched off / restyled and the new key will appear on with default styles. Plan a migration or a rename map in the record normaliser (Na__LeRec__NormaliseViewport / the edge-style prune at SheetRecords ~368).

**Z-index / height hierarchy (1..10) for draw order**

- *Where:* Na__SpStore__Layer (Layer__DrawOrder default 50) and the sort in Na__SpStore__Describe
- *How:* Draw order already exists as Layer__DrawOrder and the descriptor sorts ascending so the highest number paints last. A 1..10 hierarchy either maps onto Layer__DrawOrder or arrives as a new Layer__* key that the store must copy through (add it to Na__SpStore__Layer, or it is dropped) and that the sort must respect.
- *Risk:* Na__SpStore__Layer is a WHITELIST: any manifest key it does not name is discarded silently. Painting order also depends on a second place - Na__LeVp2d__SitePlanBuild concatenates loaded layers in descriptor order into ONE segment array, so line order follows the store's sort, but fills are painted first as a separate pass (all fills, then all lines). A true per-layer z-order interleaving fill and linework needs the painter changed, not just the sort.

**Export Polygon Faces (triangulated 2D face meshes)**

- *Where:* Na__SitePlan__GlbParse__.js -> Na__SpGlb__Primitives / a new Na__SpGlb__ParseFaces, plus Na__SpStore__LoadLayer
- *How:* Add a MODE_TRIANGLES reader (mode 4, and decide about 5 TRIANGLE_STRIP / 6 TRIANGLE_FAN) that returns triangles (or triangle-derived outlines) in drawing mm through the existing Na__SpGlb__DrawingPoints; then extend the store's layer geometry record with the new field beside segments/rings, and give the layer descriptor a Layer__FaceFile/Layer__FaceUrl (mirroring Layer__FillFile/Layer__FillUrl in Na__SpStore__Layer and in the build script's discover_truevision_siteplan_store).
- *Risk:* Today mode 4 is only a default-mode placeholder (Na__SpGlb__MODE_DEFAULT) and Na__SpGlb__Primitives collects ONLY the exact mode asked for, so a face-mesh GLB parses to nothing with no error. The store's LoadLayer also throws away everything ParseFill returns except .rings. And the painter's fill test (Na__LeVp2d__SitePlanBuild ~165) requires Layer__Style.FillHex AND a finite FillOpacity > 0, so faces with no style never draw.

**SVG hatch pattern library + Patterns right-column panel**

- *Where:* 52__LayoutEditor__HatchPatternLibrary (exists, empty, with 05__SitePlanHatches) and 51__System__LayoutEditor/40__Ui__Panels
- *How:* Panels follow the Na__LePanel<Name>__ID / __Build(body) / __Refresh(body) / Na__LePanels__OnControl pattern seen in Na__LayoutEditor__Panel__ViewportSettings__.js and Panel__ModelLayers__.js, with labels added to Na__LayoutEditor__AppConfig__.json under LayoutEditor__Labels__*. Fills are already written as raw SVG <path fill=...> in Na__LeVp2d__PaintSitePlan, so a <pattern> def is injected in the same innerHTML string.
- *Risk:* Na__LeVp2d__PaintSitePlan rebuilds state.linework.innerHTML wholesale and gates on state.lineworkKey === Na__LeVp2d__SitePlanPaintKey(...). A pattern choice that is not in that key will not repaint. Also the PDF path (Na__LePdf__DrawSitePlanFills) draws polygons, not SVG, so an SVG-only hatch will be missing from the PDF.

**Existing vs Proposed site plan stores auto-detected by folder**

- *Where:* Na__SpStore__FOLDER / Na__SpStore__DATA_KEY / all module-level state, and the build script's SITEPLAN_FOLDER_NAME
- *How:* See traps: the store is a module-level singleton keyed on nothing. Every piece of state (Status, Note, Descriptor, Pending, Generation, LayerPromises, LayerData) and every public function would take a store id, or the module becomes a factory whose instances are held in a Map keyed by store id, with thin compatibility wrappers for the current call sites.
- *Risk:* Large blast radius - 8 consumer modules, a viewport record key, and the build script's single SitePlan__DataStore key.

**Site Plan Render Composites left-column dropdown (fill / pattern / linework layering)**

- *Where:* Na__LayoutEditor__RenderComposites__ (imported by Viewport2d__ as Na__LeComposite__RasterToken) and Na__LeVp2d__PaintSitePlan
- *How:* Composites are already a per-viewport concept for architectural viewports; a site plan composite would need to reach Na__LeVp2d__SitePlanPaintKey (so a change repaints) and drive which of the three passes PaintSitePlan writes.
- *Risk:* Site plan viewports currently ignore raster and composites entirely (FillSitePlan clears state.underlay, renderedKey, wantedKey). Per the plan doc 8.4, the Styles panel still shows raster-only rows on a site plan viewport - a known wart to avoid repeating.

**A Node test harness for the parser**

- *Where:* 80__Testing__PrototypeEnvironment/Na__Test__SitePlanGlbParse__.test.mjs (does not exist yet)
- *How:* Copy the Na__Test__DrawingPlanes__.test.mjs shape: mkdtempSync, copyFileSync Na__SitePlan__GlbParse__.js to <tmp>/GlbParse.mjs, await import(pathToFileURL(...)), then readFileSync the PS01 GLBs and assert against the manifest.
- *Risk:* Node reads the app's .js as CommonJS (no package.json type:module in the app root), so it MUST be copied to .mjs first. Also fs.readFileSync gives a Buffer whose .buffer may be a pooled ArrayBuffer - Na__SpGlb__ReadContainer requires an ArrayBuffer instance and offsets from 0, so slice it: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength).

### Traps

- Na__SpStore__Layer and Na__SpStore__Describe are WHITELIST normalisers. Any new Layer__* or SitePlan__* key written by the exporter or the build script is silently dropped unless it is added there. A layer with no Layer__CategoryKey or no linework URL is dropped entirely (a face-only layer would vanish).
- Na__SpStore__Bounds accepts both {MinY,MaxY} and {MinZ,MaxZ} and returns null unless all four are finite - a bounds block with a new key shape quietly becomes null, which makes GetFocusBoundsMm fall through to the red line or to nothing.
- Announcements MUST stay on queueMicrotask (Na__SpStore__Dispatch) and the pending promise MUST be recorded before SetStatus('loading'). Reversing either reintroduces the v1.0.1 stack overflow: a panel refreshing on 'loading' calls Resolve, which starts another Find, forever.
- Na__SpStore__Generation is the only guard against a stale read. Anything added that resolves asynchronously must capture the generation and compare before writing into LayerData, or a Reload during a load leaves old geometry behind.
- Layer failures are cached-as-absent, not cached-as-failed: LoadLayer deletes the promise on rejection so the next ask retries. A fill failure is swallowed with a console.warn and the layer draws lines only - so a broken fill/face GLB shows as 'no fill', never as an error.
- LayerData is keyed by bare categoryKey while LayerPromises is keyed by categoryKey|exportedIso. Two stores (existing + proposed) sharing the same category keys would overwrite each other in LayerData with no warning at all - this is the single sharpest trap for the two-store build.
- Category keys are global identity across three unrelated records: Viewport__ModelLayers (the off-map, absent means ON), Viewport__EdgeStyles Category__* overrides, and the owners table built per paint. Duplicate keys across two stores means one Model Layers toggle switches BOTH stores' layers off.
- EdgeStyles recognises a site plan category ONLY by the literal prefix 'TrueVision__SitePlan__' (Na__LeEdge__SITEPLAN_PREFIX, and the same literal again as Na__LeRec__SITEPLAN_CATEGORY_PREFIX in SheetRecords). Any new key stem outside that prefix loses its export-carried style default AND loses the no-prune exemption, so its stored style is wiped on the next normalise.
- Na__SpGlb__Primitives matches the requested mode exactly. Triangles (4), LINE_STRIP (3), TRIANGLE_STRIP (5) and TRIANGLE_FAN (6) are collected by nothing today, and produce an empty result with no thrown error - a face-mesh export will look like 'the export wrote nothing'.
- The parser supports neither sparse accessors nor non-float POSITION nor quantised/normalized attributes; those throw. COLOR_0 is present in the linework GLBs and is ignored - colour comes only from Layer__Style.
- The (X, +Z) mapping is load-bearing: (X, -Z) mirrors the site against every plan viewport. Any new reader added to the parser must reuse Na__SpGlb__DrawingPoints rather than doing its own maths.
- Repaint guards: Na__LeVp2d__SitePlanPaintKey = SitePlanToken (export iso + ModelLayers token) + scale + masterPt + StyleToken. Anything new that changes the picture (a pattern, a composite, a z-order, a store choice) and is NOT in that token will not repaint - the frame will keep the old SVG.
- state.classes is set from the site plan build and is the SNAP source, so changing the class layout changes snapping as well as painting.
- The PDF path is separate code: Na__LePdf__DrawSitePlanFills draws OUTER RINGS ONLY as sheet polygons (holes are not cut out, per plan doc 8.4), while the screen uses an even-odd SVG path. Fill/pattern work has to be done twice or unified.
- Viewport__SitePlan is an empty object used purely as a marker; Na__LeRec__NormaliseViewport keeps unknown sub-keys (Object.assign copy) so a StoreId could ride there, BUT Na__LeModel__UpdateViewport has no 'sitePlan' patch key today, so nothing can change it after creation without a new patch branch.
- Na__LeScale__Coerce(value, isSitePlan) will coerce a site plan viewport's scale onto the architectural list if the site plan flag is not passed - the known 'coerces to 1:50' trap recorded in the plan doc.
- Site plan scale presets drive initial visibility: AddSitePlan writes an off-map from Layer__VisibleAtScales at creation time only. A layer added to the SSOT later appears ON in old viewports (absent means on).
- Localhost source order means a stale repo manifest beats a fresh CDN one on the authoring machine; and IsRunningOnLocalhost also returns true for ports 8000/8090 on any hostname, but is FALSE for app.localhost (hostname test is exact), so the local-first path silently disappears there.
- The service worker does not cache GLBs at all (no .glb or cdn rule in Na__Pwa__ServiceWorker__.js) - cache-busting rests entirely on the ?v= export time; a store whose ExportedIso is missing gets no ?v= at all.
- The build script's SITEPLAN_FILE_PATTERN only accepts '<prefix>__TrueVision__SitePlan__<AlphaNum>__(LineworkModel|FillModel)__.glb' - a new file kind (face mesh) or a category key containing a non-alphanumeric character will be skipped with a warning in the filename-fallback path.
- na-project-portal/26-Projects/PS02__MustersRoad__OfficialPdPack holds a COPY of PS01's site plan GLBs still carrying the PS01__ filename prefix - useful as a second fixture, misleading as evidence about naming.

### Open questions raised by this survey

- Do existing and proposed stores reuse the same Layer__CategoryKey values (e.g. TrueVision__SitePlan__OsMapping in both)? If yes, a store-scoped composite key (storeId + '/' + categoryKey) is needed everywhere Model Layers, EdgeStyles and the owners table touch a key, and old sheets need a migration. If the exporter can emit distinct stems per store instead, most of the two-store work disappears.
- How are the two stores addressed on disk - two sibling folders (e.g. SitePlan__DrawingData__Existing / __Proposed), or one folder with two manifests? The store's FOLDER constant, the build script's SITEPLAN_FOLDER_NAME and the design-phase scan's skip rule (build script ~410) all assume exactly one folder name.
- Does SitePlan__DataStore become an array of stores or gain a sibling key (SitePlan__DataStores)? The build script writes the key wholesale on every run and TrueVision reads it by that one name; whichever shape is chosen has to be handled in both, plus the manifest-only fallback path which has no store id at all.
- Which viewport chooses which store - a new key inside Viewport__SitePlan (needs a new UpdateViewport patch branch) or the sheet's Sheet__DrawingType? A sheet-level choice would prevent an existing/proposed pair on one sheet.
- Does the coming z-index hierarchy (1..10) replace Layer__DrawOrder or sit beside it? Today's values are 20/40/71/90 and the painter has exactly two passes (all fills, then all lines) - a 10-band hierarchy that must interleave fill and linework per band changes Na__LeVp2d__SitePlanBuild, not just the sort.
- Do face meshes replace the LINE_LOOP fill GLBs or arrive alongside them? If alongside, the layer descriptor needs a third URL and LoadLayer a third fetch; if replacing, the LINE_LOOP path and the existing PS01 fill GLB fixture still have to keep working.
- Are the new hatch patterns per-layer (from the SSOT, like LineHex) or per-viewport (an override, like EdgeStyles)? That decides whether the pattern id belongs in Layer__Style (store whitelist + exporter) or in a new per-viewport record block, and whether it lands in the PDF path as well.
- No committed Node harness exists for the parser - the 37-check harness recorded in the DEVLOG for v2.48.0 was a scratch file. Should one be written and committed as part of this build (Na__Test__SitePlanGlbParse__.test.mjs against the PS01 fixtures), given the Export Polygon Faces work is exactly the kind of change it would protect?

---

<a id="area-3"></a>
## 3. ProjectVision pipeline: local project folder -> TrueVision project data + Cloudflare R2 objects (site plan store focus)

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY - find everything by symbol name.

THE SHAPE OF THE PIPELINE
There are two independent Python programs plus a Flask dev server. They do NOT share constants; every site plan constant is duplicated by hand in at least four places (build script, R2 sync, the TrueVision JS store module, and the SketchUp Ruby exporter).

1) ProjectVision__BuildScript__.py (D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\). Scans na-project-portal\{NN}-Projects\{CODE}__{Name}\, validates codes against PROJECT_CODE_PATTERN (^[A-Z]{2}[0-9]{2}$), and writes: the master index (05__AppData\ProjectVision__MasterProjectIndex__Core__.json), AppConfiguration__ProjectKeysIndex__.json, q\index.json (QR resolver), a per-project ProjectVision-WebApp.html redirect, TrueVision__ProjectData__.json, PlanVision__ProjectData__.json, and the DAS builds. Entry: main() ~line 1000; args are --portal-root, --project <folder>, --tv-only style flags, --dry-run-check, --qr-index-only.

2) CloudflareR2__ModelSync__Main__.py (same folder). boto3 S3 client against the R2 bucket, mirroring the local folder tree to key prefix NaProjectPortal/{NN}-Projects/{ProjectFolder}/... Entry run_r2_sync(target_project, dry_run_only, auto_confirm_upload, sync_truevision, sync_planvision, das_only) ~line 1179. Destructive mode run_r2_purge(project_code) -> purge_project_glbs ~line 1020.

3) ProjectVision__LocalServer__Main__.py (na-apps root, port 8090). Flask. Serves the Studio shell and the repo as static; three project APIs: GET/POST /api/projects/<code> (reads/writes TrueVision__ProjectData__.json verbatim - this is the /r2/write equivalent the app saves through), GET/POST /api/projects/<code>/files/<filename> (only names in the frozenset TRUEVISION_SIBLING_FILES, pointer line 88), POST /api/projects/<code>/sync-cdn which imports run_r2_sync in-process with auto_confirm_upload=True. Registers the Project Manager and Scrapbook blueprints. NOTE: this server never reloads routes - a new route answers 405 until Adam restarts 8090.

4) ProjectVision__ProjectManager__Api__.py and ProjectVision__TrueVisionScrapbook__Api__.py - Flask blueprints. Grepped: NEITHER contains the string "SitePlan" anywhere. Project Manager is explicit that PlanVision/TrueVision project data files are generated by the build script and are never written there. So site plan data touches exactly two Python files.

5) ProjectVision__DasBuilder__.py - DAS only, no site plan content.

HOW THE SITE PLAN STORE IS PRODUCED
The SketchUp exporter Na__TrueVision__GlbBuilder__SitePlanExport__.rb (in the Plugins tree, module Na__TrueVision__GlbBuilderUtility__Modules__) writes into 30__TrueVision__AppContent\SitePlan__DrawingData\: one linework GLB per tag, an optional fill GLB, and TrueVision__SitePlanData__Manifest__.json. Its NA__SITEPLAN__CONFIG_DEFAULTS (pointer line 63) holds ExportFolderName='SitePlan__DrawingData', ManifestFileName, LineworkFileSuffix='__LineworkModel__', FillFileSuffix='__FillModel__', ExportIgnoresTagVisibility=true - each overridable by a SitePlanExportConfig block in the Tags SSOT (Na__DataLib__CoreIndex__Tags__.json). Na__SitePlan__ChooseFolder warns unless the chosen folder's basename equals ExportFolderName; picking 30__TrueVision__AppContent auto-creates and descends into the site plan folder. NA__SITEPLAN__SCHEMA_VERSION = 1, NA__SITEPLAN__EXPORTER_VERSION = '1.1.1'.

The real PS01 export on disk is 5 linework GLBs + 1 fill GLB (ExistingBuildings only) + the manifest, SitePlanData__TagsSsotVersion "2.3.0", ExportedIso 2026-09-17T19:30:36Z.

HOW THE BUILD SCRIPT TURNS THAT INTO PROJECT DATA
discover_truevision_siteplan_store() (pointer line 437) builds base_url = CDN_BASE_URL/R2_BASE_PREFIX/{year}-Projects/{projectFolder}/30__TrueVision__AppContent/SitePlan__DrawingData, reads the manifest if present, and copies a FIXED, EXPLICIT list of keys per layer. Any key the manifest grows that is not in that list is silently dropped from the project data. Same for the six store-level keys. The result is written as the single top-level key SitePlan__DataStore by generate_truevision_project_data() (pointer ~546), documented in-code as "Build-owned: regenerated every run, never a dev key".

HOW IT REACHES R2
ModelSync's discover_model_groups() (pointer 345) treats SitePlan__DrawingData as just another folder of GLBs - it is NOT skipped there - and additionally appends the manifest into extra_files when item.name == SITEPLAN_FOLDER_NAME exactly. collect_sync_operations() (pointer 740) then uploads GLBs as model/gltf-binary and the manifest via resolve_content_type -> application/json. Keys come from build_r2_key(year_folder_name, project_folder, content_folder, subfolder, filename) - ONE flat subfolder segment, no nesting. determine_action() compares local st_mtime against R2 LastModified: newer local = update, otherwise skip. The project data JSON is special-cased by build_project_data_operation(): it fetches the R2 copy, overlays the DEV_OWNED_PROJECT_DATA_KEYS from R2 onto the freshly built local document, uploads those merged bytes (upload_bytes_to_r2, not the file), and mirrors the merged document back down to disk via sync_project_data_to_local(). SitePlan__DataStore is not dev-owned, so the build's version always wins - correct today, and the reason a folder rename wipes the key everywhere in one sync.

HOW THE APP READS IT
na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js is a SINGLETON: one module-level Na__SpStore__Descriptor, one Na__SpStore__Pending, one layer cache. Na__SpStore__Find() looks in this order: (a) on localhost only, the LOCAL manifest at {origin}/na-project-portal/{year}-Projects/{folder}/30__TrueVision__AppContent/SitePlan__DrawingData/TrueVision__SitePlanData__Manifest__.json; (b) the project data key SitePlan__DataStore; (c) the CDN manifest. The local manifest therefore BEATS the project data on localhost. Na__SpStore__Describe() maps manifest keys to project-data keys pairwise (SitePlanData__Layers/SitePlan__Layers etc.), sorts by Layer__DrawOrder ascending, and Na__SpStore__Layer() drops any layer with no linework URL. Consumers: Na__LayoutEditor__Viewport2d__SitePlan__.js and Na__LayoutEditor__Panel__ViewportSettings__.js, both of which read descriptor.SitePlan__Layers directly.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py`
*Version:* Project Vision 0.4.1 - 20-Sep-2026 (per ProjectVision__DEVLOG__.md; the site plan store landed in 0.2.0 - 14-Sep-2026)

Scans the portal and generates TrueVision__ProjectData__.json (including the whole SitePlan__DataStore block), the master index, the project keys index, q/index.json and the per-project redirect HTML. THE place the site plan schema is narrowed.

*Key symbols:* `SITEPLAN_FOLDER_NAME (ptr 58)`, `SITEPLAN_MANIFEST_FILENAME (ptr 59)`, `SITEPLAN_FILE_PATTERN (ptr 60)`, `TRUEVISION_CONTENT_FOLDER (ptr 56)`, `CDN_BASE_URL (ptr 54)`, `R2_BASE_PREFIX (ptr 55)`, `GLB_FILE_PATTERN (ptr 63)`, `PHASE_FOLDER_PATTERN (ptr 65)`, `SKIP_FOLDER_PREFIXES (ptr 66)`, `TRUEVISION_DEV_OWNED_KEYS (ptr 74)`, `resolve_paths (ptr 90)`, `detect_sub_app_availability (ptr 204)`, `dir_has_real_content`, `build_master_index (ptr 229)`, `build_qr_link_index`, `discover_truevision_model_groups (ptr 395)`, `discover_truevision_siteplan_store (ptr 437)`, `parse_group_label (ptr ~535)`, `generate_truevision_project_data (ptr ~546)`, `write_truevision_project_data (ptr ~569)`, `write_json (ptr 934)`, `main (ptr ~1000)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\CloudflareR2__ModelSync__Main__.py`
*Version:* no version header; last touched 14-Sep-2026

boto3 mirror of the local portal tree to the R2 bucket, plus the dev-key-safe project-data merge and the GLB purge.

*Key symbols:* `SITEPLAN_FOLDER_NAME (ptr 90)`, `SITEPLAN_MANIFEST_FILENAME (ptr 91)`, `DEV_OWNED_PROJECT_DATA_KEYS (ptr 115)`, `CONTENT_TYPE_GLB/JSON/PNG/PDF (ptr 129-132)`, `JSON_PROJECT_DATA_FILENAME (ptr 97)`, `JSON_DRAWING_NOTES_FILENAME (ptr 98)`, `load_r2_credentials (ptr 157)`, `create_r2_client (ptr 192)`, `check_r2_file (ptr 211)`, `upload_to_r2 (ptr 227)`, `upload_bytes_to_r2 (ptr 250)`, `fetch_r2_json (ptr 269)`, `discover_model_groups (ptr 345)`, `build_r2_key (ptr 446)`, `build_r2_key_project_data (ptr 463)`, `determine_action (ptr 494)`, `build_project_data_operation (ptr 515)`, `sync_project_data_to_local (ptr 576)`, `collect_sync_operations (ptr 740)`, `resolve_content_type (ptr 804)`, `purge_project_glbs (ptr 1020)`, `run_r2_purge (ptr 1120)`, `run_r2_sync (ptr 1179)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__LocalServer__Main__.py`

Flask dev server on 8090. Serves the repo statically, exposes the read/write project-data API the TrueVision app saves through, and can fire a targeted R2 sync. No site plan code of its own.

*Key symbols:* `TRUEVISION_CONTENT_DIR (ptr 86)`, `TRUEVISION_DATA_FILENAME (ptr 87)`, `TRUEVISION_SIBLING_FILES (ptr 88)`, `resolve_case_insensitive_path (ptr 138)`, `_extract_project_context (ptr 210)`, `_find_project_file_by_folder (ptr 228)`, `_find_project_file_by_code (ptr 280)`, `_resolve_project_data_path (ptr 321)`, `_write_json_file (ptr 332)`, `_sanitize_sibling_filename (ptr 341)`, `_run_targeted_r2_sync (ptr 370)`, `project_data_api (ptr 503)`, `project_sibling_file_api (ptr 542)`, `project_sync_cdn_api (ptr 587)`, `serve_static (ptr 620)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__ProjectManager__Api__.py`
*Version:* 1.0.0 - 19-Sep-2026

Flask blueprint for the Studio Project Manager tab (list/edit/rename/delete projects, keep master index + q/index.json + R2 in step). Contains NO site plan code and by design never writes TrueVision__ProjectData__.json.

*Key symbols:* `_update_master_index`, `_update_qr_index`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__TrueVisionScrapbook__Api__.py`
*Version:* 1.0.0 - 19-Sep-2026

Flask blueprint for the Layout Editor Custom Scrapbook (JSON files in category folders under 30__TrueVision__CoreAppCode\51__LayoutEditor__UserScrapbookContent\, index rebuilt from the folders on every change). The closest existing precedent for a new SVG hatch-pattern library route. No site plan code.

*Key symbols:* `GET /api/truevision/scrapbook`, `POST /api/truevision/scrapbook/items`, `POST /api/truevision/scrapbook/items/delete`, `UserScrapbook__Index__.json`, `00__Deleted__Quarantine`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__DasBuilder__.py`

Design & Access Statement builds, called from the build script's main. No site plan content.

*Key symbols:* `is_das_folder`, `run_das_builds`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__DevLauncher__Shared__.py`

Shared launcher helpers. No site plan content.

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\TrueVision__SitePlanData__Manifest__.json`
*Version:* SitePlanData__SchemaVersion 1

The real exported manifest (schema 1) - the only ground truth for the layer schema. 5 layers, one of which has a fill GLB.

*Key symbols:* `SitePlanData__Description`, `SitePlanData__SchemaVersion=1`, `SitePlanData__ProjectPrefix=PS01`, `SitePlanData__SourceModelFile`, `SitePlanData__ExportedIso`, `SitePlanData__ExporterVersion=1.1.1`, `SitePlanData__TagsSsotVersion=2.3.0`, `SitePlanData__Units=metres`, `SitePlanData__UpAxis=Y`, `SitePlanData__NorthAngleDeg`, `SitePlanData__BoundsMm{MinX,MinZ,MaxX,MaxZ}`, `SitePlanData__Layers[]`, `Layer__TagName`, `Layer__CategoryKey`, `Layer__Label`, `Layer__Group`, `Layer__DrawOrder`, `Layer__LineworkFile`, `Layer__FillFile`, `Layer__SegmentCount`, `Layer__RingCount`, `Layer__BoundsMm`, `Layer__Style{LineColourId,LineHex,LineType,LineWeightMm,FillColourId,FillHex,FillOpacity}`, `Layer__VisibleAtScales`, `Layer__Warnings`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\TrueVision__ProjectData__.json`

The generated project data (709 KB). Top-level keys today: projectCode, projectName, activeGroupIndex, modelGroups(2), Camera__DefaultPosition, SitePlan__DataStore, PresentationMode__SavedCameraScenes, Navmode__EnabledModes, OrbitHelperCube__Position, LayoutEditor__DrawingsData.

*Key symbols:* `SitePlan__DataStore`, `SitePlan__FolderName`, `SitePlan__ManifestUrl`, `SitePlan__ExportedIso`, `SitePlan__NorthAngleDeg`, `SitePlan__BoundsMm`, `SitePlan__Layers[]`, `Layer__LineworkUrl`, `Layer__FillUrl`, `LayoutEditor__DrawingsData`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`

The app-side consumer. Singleton store that resolves ONE descriptor for the whole session. Read it before changing the key shape.

*Key symbols:* `Na__SpStore__DATA_KEY = 'SitePlan__DataStore' (ptr 80)`, `Na__SpStore__CDN_BASE (ptr 81)`, `Na__SpStore__PORTAL_DIR (ptr 82)`, `Na__SpStore__CONTENT_DIR (ptr 83)`, `Na__SpStore__FOLDER = 'SitePlan__DrawingData' (ptr 84)`, `Na__SpStore__MANIFEST (ptr 85)`, `Na__SpStore__SCHEMA = 1 (ptr 86)`, `Na__SpStore__RED_LINE_KEY (ptr 87)`, `Na__SpStore__FolderUrls (ptr 145)`, `Na__SpStore__Candidates (ptr 162)`, `Na__SpStore__Layer (ptr ~236)`, `Na__SpStore__Describe (ptr ~258)`, `Na__SpStore__Find (ptr 282)`, `Na__SpStore__Resolve (ptr ~336)`, `Na__SpStore__Reload`, `Na__SpStore__GetLayers (ptr 448)`, `Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed'`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb`
*Version:* Exporter 1.1.1, manifest schema 1

Upstream producer of the GLBs and the manifest. Its folder choice is what the pipeline auto-detects.

*Key symbols:* `NA__SITEPLAN__CONFIG_DEFAULTS (ptr 62)`, `ExportFolderName`, `ManifestFileName`, `LineworkFileSuffix`, `FillFileSuffix`, `NA__SITEPLAN__EXPORTER_VERSION='1.1.1' (ptr 69)`, `NA__SITEPLAN__SCHEMA_VERSION=1 (ptr 70)`, `NA__SITEPLAN__OLD_FILE_PATTERN (ptr 74)`, `NA__SITEPLAN__TV_CONTENT_FOLDER (ptr 77)`, `Na__SitePlan__ChooseFolder (ptr ~508)`, `Na__SitePlan__WriteLinework`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json`
*Version:* TagsSsotVersion 2.3.0 as stamped into the PS01 manifest

The tags SSOT. Carries SitePlanExportConfig, which overrides every exporter default including ExportFolderName - so the two-store folder naming is ultimately a decision taken here, not in Python.

*Key symbols:* `SitePlanExportConfig`, `ExportFolderName`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__DEVLOG__.md`
*Version:* 0.4.1

The changelog that must be appended to. Version 0.2.0 (ptr 364) is the site plan store entry and states the design intent in full; 0.4.1 (ptr 9) is current.

*Key symbols:* `## Project Vision - Version 0.2.0 - 14-Sep-2026`, `## Project Vision - Version 0.4.1 - 20-Sep-2026`

### Conventions observed

- Two distinct Python house styles coexist and each file keeps to its own. ProjectVision__BuildScript__.py and ProjectVision__DasBuilder__.py use the PLAIN style: a '# ====' banner header block with FILE / AUTHOR / PURPOSE / CREATED / DESCRIPTION / USAGE, then '# ====' section banners (CONSTANTS, PATH RESOLUTION, PROJECT DISCOVERY, OUTPUT GENERATORS, TRUEVISION PROJECT DATA GENERATION), plain def with a one-line docstring, no type hints.
- CloudflareR2__ModelSync__Main__.py, ProjectVision__LocalServer__Main__.py and both Flask blueprints use the REGION style: '# #region ---' / '# REGION | Name' / '# endregion ---', and every function introduced by a '    # FUNCTION | Title Case Description' (or '# HELPER FUNCTION |' / '# MODULE CONSTANTS |') comment indented four spaces, followed by a '    # ------------------------------------------------------------' rule, and closed by the same rule after the body. Type hints are used throughout ModelSync (-> Tuple[bool, Optional[int], Optional[datetime]]).
- Constants are SCREAMING_SNAKE at module level with the '=' vertically ALIGNED across the whole block (ModelSync aligns at column 36). Trailing rationale comments use the '# <--' arrow form.
- Dict literals align the ':' into a column, e.g. 'Layer__CategoryKey     : entry.get(...)'. This is used for every emitted JSON object in both scripts.
- JSON is always written with json.dump(data, f, indent=4, ensure_ascii=False) followed by an explicit f.write('\n'), opened with encoding='utf-8', newline='\n'. See write_json, write_truevision_project_data, _write_json_file, and dump_json_bytes.
- JSON key naming is Domain__PascalCase with a double underscore: SitePlanData__*, SitePlan__*, Layer__*, Camera__DefaultPosition__*. Legacy TrueVision keys (projectCode, projectName, modelGroups, activeGroupIndex, groupId, label, modelUrls) stay camelCase - do not 'tidy' them.
- Console output uses bracketed tags at two-space indent: [WRITTEN], [WARNING], [ERROR], [INFO], [TARGET], [DRY-RUN], [OK], [SCAN], [LOCAL SYNC], [DELETED], [CANCEL]. ModelSync wraps them in the C_GREEN/C_YELLOW/C_RED/C_CYAN ANSI constants; the build script does not colour.
- Warnings are printed and collected, never raised. Unreadable input degrades to a documented fallback (an unreadable manifest falls back to file-name parsing) rather than failing the build.
- Flask helpers that are not routes are prefixed with a single underscore (_resolve_project_data_path, _write_json_file, _run_targeted_r2_sync). Nothing from a request is ever used as a path - names are sanitised against an allowlist (TRUEVISION_SIBLING_FILES) or regenerated.
- Destructive operations require typed confirmation ('yes', or a 'confirm' field holding the project code) and print the full list of what will go before asking. Deletes move to a 00__Deleted__Quarantine folder wherever a folder can be moved; only R2 objects are truly deleted.
- Every change is logged in ProjectVision__DEVLOG__.md as '## Project Vision - Version X.Y.Z - DD-Mon-YYYY' with '### Added/Changed - <headline>' then '#### Why', a '#### <Script name>' section per file touched, '#### Unchanged', and '#### Verification' describing the harness run and the number of checks passed.

### Extension points

**Where every new manifest key must be admitted (Z-index, face-mesh file, pattern id, fill material)**

- *Where:* ProjectVision__BuildScript__.py :: discover_truevision_siteplan_store (ptr 437), the layers.append({...}) block and the return {...} block
- *How:* Both blocks copy an EXPLICIT, CLOSED list of keys out of the manifest. Add each new key here (Layer__ZIndex, Layer__FaceFile/Layer__FaceUrl, Layer__PatternId, Layer__FillMaterialId, and any new store-level meta) or it will never reach SitePlan__DataStore. Follow the aligned-colon dict style. The URL-forming keys need the same '{base_url}/{filename} if filename in present' guard the linework and fill already use.
- *Risk:* HIGHEST-VALUE TRAP. There is no pass-through. A key added to the exporter and the manifest appears on disk, appears on the CDN manifest, works on localhost (where the local manifest wins), and is silently missing from the live app, which reads the project data. It will look like a caching bug.

**The single test that decides whether a folder is a design phase**

- *Where:* ProjectVision__BuildScript__.py :: discover_truevision_model_groups (ptr 395), 'if entry == SITEPLAN_FOLDER_NAME: continue'
- *How:* Replace the equality with a pattern/prefix test the moment a second site plan folder exists.
- *Risk:* An unrecognised SitePlan folder becomes a modelGroup. It sorts after every DesignPhase* folder and has no 'existing' in its label, so TrueVision opens the project on it - the exact failure the 0.2.0 devlog entry was written to prevent.

**The manifest's ride to R2**

- *Where:* CloudflareR2__ModelSync__Main__.py :: discover_model_groups (ptr 345), 'if item.name == SITEPLAN_FOLDER_NAME and (item / SITEPLAN_MANIFEST_FILENAME).is_file()'
- *How:* Same equality problem. Widen it, or a second store's GLBs upload while its manifest does not.
- *Risk:* Silent partial success: the GLBs are on the CDN, the project data points at them, but SitePlan__ManifestUrl 404s and the app's manifest fallback path is dead for that store.

**Where the new top-level project-data key would be declared**

- *Where:* ProjectVision__BuildScript__.py :: generate_truevision_project_data (ptr ~546) - the 'if siteplan_store: data['SitePlan__DataStore'] = siteplan_store' line
- *How:* Add SitePlan__DataStores here alongside the existing key. It is build-owned, so it must NOT be added to TRUEVISION_DEV_OWNED_KEYS or DEV_OWNED_PROJECT_DATA_KEYS.
- *Risk:* If the new key were ever added to the dev-owned lists, the build would stop being able to correct it and a stale store list would be frozen on R2 forever.

**The three-list rule for anything the APP saves (e.g. which store a sheet uses, a per-viewport pattern choice)**

- *Where:* ProjectVision__BuildScript__.py :: TRUEVISION_DEV_OWNED_KEYS (ptr 74); CloudflareR2__ModelSync__Main__.py :: DEV_OWNED_PROJECT_DATA_KEYS (ptr 115); and Na__DevSavedKeys in the TrueVision app (both constants' comments name it, one pointing at Na__AppFlow__LoadingSequence.js)
- *How:* Prefer putting the choice INSIDE LayoutEditor__DrawingsData, which is already in all three lists - then nothing needs adding. If a genuinely new top-level key is unavoidable, it must be added to all three in the same commit.
- *Risk:* A key in one or two lists but not the third is wiped by the next build or the next sync. This has bitten before.

**R2 key construction**

- *Where:* CloudflareR2__ModelSync__Main__.py :: build_r2_key (ptr 446)
- *How:* Signature is (year_folder_name, project_folder, content_folder, subfolder, filename) - exactly ONE folder segment between the content folder and the filename. Nested store folders need either a new build_r2_key_nested taking a relative Path (copy build_r2_key_planvision, ptr 454, which already does as_posix() on a relative path) or a flat sibling-folder layout.
- *Risk:* Nested folders are not merely unsupported - discover_model_groups only iterdir()s one level, so a nested store's files are never even enumerated. Nothing errors; the files simply never reach R2.

**A new Flask route for the SVG hatch pattern library**

- *Where:* ProjectVision__TrueVisionScrapbook__Api__.py is the pattern to copy; registration happens in ProjectVision__LocalServer__Main__.py
- *How:* Blueprint, localhost only, folder of JSON/SVG files under na-apps\30__TrueVision__CoreAppCode\, index rebuilt from the folder on every change so hand-added files are picked up, deletes moved to 00__Deleted__Quarantine, nothing from a request used as a path.
- *Risk:* The 8090 server does not reload routes. A new route answers 405 until Adam restarts it. Read the running routes with OPTIONS (Allow header), never a test POST.

**Triggering a sync of new site plan assets from inside the app**

- *Where:* ProjectVision__LocalServer__Main__.py :: project_sync_cdn_api (ptr 587) -> _run_targeted_r2_sync (ptr 370) -> run_r2_sync(target_project=folder, dry_run_only=False, auto_confirm_upload=True)
- *How:* This already picks up whatever collect_sync_operations returns, so widening discovery is enough - no route change needed.
- *Risk:* auto_confirm_upload=True means no human sees the operation list. A discovery bug here uploads or skips silently.

**App-side singleton that assumes exactly one store**

- *Where:* Na__SitePlan__Store__.js :: Na__SpStore__Descriptor, Na__SpStore__Pending, Na__SpStore__LayerPromises, Na__SpStore__LayerData, Na__SpStore__Find (ptr 282), Na__SpStore__FolderUrls (ptr 145)
- *How:* Two stores need the descriptor and both caches keyed by store id, and Find() given a store id. Na__SpStore__GetLayers (ptr 448) and both Layout Editor consumers take the current store implicitly today.
- *Risk:* On localhost the LOCAL manifest at the hardcoded Na__SpStore__FOLDER path wins over the project data. A two-store project will show one store locally and both on the CDN, so localhost testing will not reveal the break.

### Traps

- discover_truevision_siteplan_store copies a closed list of keys. Every new manifest field is dropped unless explicitly added. No error, no warning.
- The two 'is this the site plan folder' tests are equality against SITEPLAN_FOLDER_NAME, in two different files (build script ptr 410, ModelSync ptr ~367). A second folder passes neither.
- ModelSync's discover_model_groups enumerates only ONE level below 30__TrueVision__AppContent. Files in a sub-sub-folder are never listed, never uploaded, and never reported as missing.
- build_r2_key takes a single flat subfolder segment. build_r2_key_planvision is the only nesting-capable key builder and it is PlanVision-only.
- generate_truevision_project_data DROPS SitePlan__DataStore entirely when no store is found. Rename or move the folder and one build silently removes the key; the next sync pushes that removal to R2. Because the local manifest still wins on localhost, the developer sees it working while the live site has lost it.
- build_project_data_operation only restores DEV_OWNED_PROJECT_DATA_KEYS from R2. Anything else the app ever wrote live to R2 and the build does not regenerate is overwritten on the next sync.
- determine_action compares local mtime to R2 LastModified. A re-export that preserves or backdates mtime (a copy, a restore, a git checkout) reads as SKIP and the stale object stays on the CDN.
- SITEPLAN_FILE_PATTERN only accepts ^(?:.*?__)?(TrueVision__SitePlan__[A-Za-z0-9]+)__(LineworkModel|FillModel)__\.glb$ - a single alphanumeric stem, and only those two suffixes. A new 'Faces'/'PolygonFaces' GLB is rejected by the no-manifest fallback path (warned and skipped), and it also falls outside the exporter's NA__SITEPLAN__OLD_FILE_PATTERN, so the exporter's own clean-up will leave stale copies behind between exports.
- The category key regex allows no underscores or digits after the stem, so a key like TrueVision__SitePlan__MixedWoodland_Trees or ...__OsMapping__MinorStreets will NOT match the fallback pattern. New tag names must stay single-token PascalCase or the pattern must be widened in both the Python and the Ruby (NA__SITEPLAN__OLD_FILE_PATTERN).
- purge_project_glbs deletes every .glb under the whole 30__TrueVision__AppContent prefix for a project - both stores, and the design phase models too - but leaves the manifests, because they are JSON. After a purge the manifest describes GLBs that no longer exist and the app's manifest fallback resolves to 404s.
- Layer__DrawOrder is already in use with values 20/40/70/71/90 and Na__SpStore__Describe sorts ascending on it with a default of 50. The new 1..10 Z-index is a DIFFERENT scale. Do not overload the existing key - a 1..10 value would put every new layer under the OS mapping.
- write_truevision_project_data preserves the existing per-groupId 'label' from the file on disk, so hand-renamed model groups survive a rebuild. Site plan layer labels get NO such treatment - they are regenerated from the manifest every run.
- Nothing is shared between the build script and ModelSync: SITEPLAN_FOLDER_NAME, SITEPLAN_MANIFEST_FILENAME, TRUEVISION_CONTENT_FOLDER, CDN_BASE_URL, R2_BASE_PREFIX, GLB_FILE_PATTERN and parse_group_label are all duplicated verbatim. Counting the JS module and the Ruby exporter, a folder-name change is a four-file edit.
- The 8090 Flask server never reloads routes; a restart by Adam is required before any new endpoint answers.
- Adding a top-level project-data key without adding it to all three dev-key lists (TRUEVISION_DEV_OWNED_KEYS, DEV_OWNED_PROJECT_DATA_KEYS, Na__DevSavedKeys) means a build or a sync wipes it.
- Na__SpStore__SCHEMA is 1 and only WARNS on a higher SitePlanData__SchemaVersion, then reads what it recognises. A schema 2 manifest will appear to work while quietly losing the new fields on older app builds - the warning is console-only.

### Open questions raised by this survey

- Folder layout for the two stores: SIBLING folders (30__TrueVision__AppContent\SitePlan__DrawingData__Existing and __Proposed) or NESTED (SitePlan__DrawingData\Existing). Sibling is far cheaper - ModelSync's one-level discovery and the flat build_r2_key both keep working and only the two equality tests change. Nested requires a recursive walk and a new key builder in ModelSync. Recommend sibling.
- What does a single-store project mean going forward - is a bare SitePlan__DrawingData folder read as 'Existing', as 'Proposed', or as an unlabelled default? The 26-Projects portal has at least PS01 in that state today.
- Which store should the legacy SitePlan__DataStore key keep pointing at, so a warm PWA cache running an older TrueVision build still draws something sensible? Recommend: the first store in folder order, i.e. Existing when present.
- Does the per-viewport store choice live inside LayoutEditor__DrawingsData (already dev-owned in all three lists, so zero pipeline change) or as a new top-level key (three-list rule, plus a build-script decision about whether to preserve it)? Strongly recommend the former.
- Is the new 1..10 Z-index a replacement for Layer__DrawOrder or a second axis layered under it (fill vs pattern vs linework within one layer)? The Site Plan Render Composites dropdown implies the latter, which means TWO sort keys in Na__SpStore__Describe.
- Do the exported face meshes become a third file per layer (Layer__FaceFile alongside Layer__LineworkFile and Layer__FillFile) or do they replace the current fill GLB? Only one layer in PS01 has a fill GLB today, and two layers carry a Layer__Warnings entry saying 'no faces, so no fill'.
- Does the SVG hatch pattern library live in the repo (like the Custom Scrapbook under 51__LayoutEditor__UserScrapbookContent) or per project on R2? Repo + a rebuilt index file is the established pattern and needs no R2 work.
- Will SitePlanData__SchemaVersion go to 2? If so, Na__SpStore__SCHEMA must move with it and the build script should decide whether an unknown-schema manifest is read or refused - today it is read with a console warning only.
- Should the ProjectVision build gain a --siteplan-only flag mirroring --qr-index-only, so a re-export can be republished without a whole-portal rebuild?

---

<a id="area-4"></a>
## 4. TrueVision3D Layout Editor - panel system (PanelHost, column tabs), the Render Composites feature, the Scrapbook tab's three libraries, and the ScrapbookCustom Flask-backed transport - surveyed for adding a "Site Plan Render Composites" LEFT-column control and a "Patterns" panel last in the RIGHT column.

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY - find everything by NAME, the files move.

THE PANEL HOST. `Na__LayoutEditor__PanelHost__.js` (namespace `Na__LePanels`, folder `02__Src__AppModules/51__System__LayoutEditor/40__Ui__Panels/`) owns both columns. `Na__LePanels__Mount(context)` (~line 215) takes `{ left, right, editable, showToast }` - two host elements the mode controller creates - and builds, per side, a `div.na-le-panel.na-le-panel--<side>` holding `div.na-le-panel__scroll` and a width grip. `Na__LePanels__Unmount()` (~244) clears the Sections, Handlers and Tabs maps, so EVERY panel re-registers on every entry into the editor.

REGISTRATION AND ORDER. A panel is a "section": `Na__LePanels__RegisterSection(side, spec)` (~387) where `side` is the string `'left'` or `'right'` and `spec = { id, title, build(body, context), refresh(body, context), defaultOpen, tab }`. It returns `{ spec, root, body, side, header }`. There is NO ordering field and no priority: the section root is appended to `column.querySelector('.na-le-panel__scroll')`, so ORDER IS CALL ORDER. The single ordering authority is the list of `*__Register()` calls in `Na__LayoutEditor__ModeController__.js` (~lines 362-386, inside the shell-building function that also calls `Na__LePanels__Mount`). Left column today: Sheet, MarginNotes, Layers, Styles (= Render Composites), ModelLayers. Right column: `Na__LePanels__RegisterTab('right', { id : 'properties', ... })` FIRST, then `Na__LePanelScrap__RegisterTab()`, then the Properties sections (Param properties, Viewport, Text, Leaders, Dims, Shapes), then the three Scrapbook-tab sections (Standard, Parametric library, Custom).

VISIBILITY. Two independent, non-declarative mechanisms. (a) `Na__LePanels__SetSectionVisible(id, visible)` (~500) sets `entry.root.hidden`. A panel that only applies to some sheets does this ITSELF: it listens to `Na__LeModel__CHANGED_EVENT` and calls SetSectionVisible from its own sync function - see `Na__LePanelScrap__Sync` / `Na__LePanelScrap__OnModelChanged` (~190-201 of the Standard Scrapbook panel) with its reason allow-list `Na__LePanelScrap__SHOW_REASONS = ['active','loaded','sheet-created','sheet-deleted','sheet-updated']`. That sync must run even when the section is FOLDED, because `Na__LePanels__Refresh` skips folded sections. (b) `spec.tab` puts a section on a column tab; off-tab sections get class `is-off-tab` and `Refresh` passes them by, so a library's files are not read until its tab is first opened.

TABS. `Na__LePanels__RegisterTab(side, { id, title })` (~302) creates `div.na-le-panel__tabs` as the first child of the scroller (sticky), returns `{ id, title, button }`. The strip is hidden while `tabs.length < 2`. The FIRST tab registered on a column is where every section with no `spec.tab` lands (`Na__LePanels__TabOf`, ~268). `Na__LePanels__SetActiveTab` / `GetActiveTab` complete the API; the active tab is remembered as `na-layouteditor-panel:tab-<side>`.

THE SCRAPBOOK TAB. There is exactly ONE extra tab on the right column: `Na__LeScrap__TAB_ID = 'scrapbook'`, a constant in `55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js` (~line 84). The "three libraries" are three SECTIONS all naming that tab: `'scrapbook'` (Standard), the Parametric library, `'scrapbook-custom'`. So "Patterns" should be a NEW SECTION on the EXISTING Scrapbook tab, registered after `Na__LePanelScrapCustom__Register()` - that is the only way for it to be the last panel in the right column, and it matches the tab's meaning ("libraries you drag from") and Adam's uniform-tab rule.

RENDER COMPOSITES. `25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js` (namespace `Na__LeComposite`) is the data layer: it fetches its sibling `Na__LayoutEditor__RenderComposites__Config__.json` once via `Na__LeComposite__Ready()`, exposes `Rows()`, `Row(key)`, `ToggleRows()`, `WeightRows()`, `Clamp`, `Weight(viewport,key)`, `Factor(viewport,key)`, `IsOverridden`, `Token(viewport)`, `RasterToken(viewport, forThreeD)` and the record field name `Na__LeComposite__FIELD = 'Viewport__CompositeWeights'`. A hard-coded `Na__LeComposite__FALLBACK` array keeps the panel working before/without the fetch. Storage splits in two: the TOGGLES live in `Viewport__Styles` (booleans, one per composite key) and the WEIGHTS in `Viewport__CompositeWeights` (flat key->number, stored only where overridden). Both are written through `Na__LeModel__UpdateViewport(sheet, viewportId, patch)` with `patch.styles` and `patch.compositeWeights` respectively (see `Na__LayoutEditor__SheetModel__Viewports__.js` ~258-286; compositeWeights merge, `null` deletes a key, values pass through `Na__LeComposite__Clamp`). It reaches the renderer by direct read at render time: `Na__LayoutEditor__Viewport2d__Frame__.js` (~127-129) passes `profilePx`, `sectionPx`, `modelEdgePx`; `Na__LayoutEditor__Viewport2d__Linework__.js` (~210-211) multiplies by `Factor(viewport,'projectedLinework')` and `Factor(viewport,'hiddenLines')`; `Na__LayoutEditor__Viewport3d__.js` (~409) hands `Viewport__Styles` plus `{ modelEdgePx }` to `Na__LeSnap__Render3d`. Cache keys use `Token` / `RasterToken`. The UI is `40__Ui__Panels/Na__LayoutEditor__Panel__Styles__.js` (namespace `Na__LePanelStyles`, section id `'styles'`): build = AdvancedToggle + note + `[data-na-block="list"]` + a wide Force Render button; refresh rebuilds the rows only when the config signature changes and otherwise just reflects the selected viewport.

TRANSPORT. `56__Feature__ScrapbookCustom/Na__LayoutEditor__ScrapbookCustom__Transport__.js` (namespace `Na__LeScrapCustomIo`) is the only module that knows where files are. `Na__LeScrapCustomIo__AppRootUrl = new URL('../../../', import.meta.url)` resolves the folder holding `Index.html` from any `51__System__LayoutEditor/<NN__Feature>/` module. `FileUrl(relativePath)` joins `contentFolder + '/' + encodeURIComponent'd parts` onto that root - so plain file GETs work identically on 8090, a static server and the live site. `ApiUrl(suffix)` is `window.location.origin + apiPath + suffix`. `ReadIndex()` asks the API first, but ONLY when `Na__AppUtils__IsRunningOnLocalhost()`; otherwise (and on failure) it reads the checked-in index file. Writing needs the local Flask server. `/api/health` returning `service === 'na-projectvision-local-dev'` distinguishes "server needs restarting" from "no server".

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__PanelHost__.js`
*Version:* 1.4.0 (19-Sep-2026)

The two panel columns, their sections, column tabs, delegated controls and every shared row builder. Namespace Na__LePanels. Everything a new panel needs.

*Key symbols:* `Na__LePanels__Mount(context)`, `Na__LePanels__Unmount()`, `Na__LePanels__RegisterSection(side, spec)`, `Na__LePanels__RegisterTab(side, spec)`, `Na__LePanels__SetActiveTab(side, tabId)`, `Na__LePanels__GetActiveTab(side)`, `Na__LePanels__Refresh(sectionId)`, `Na__LePanels__SetFolded(sectionId, folded)`, `Na__LePanels__FocusSection(sectionId)`, `Na__LePanels__SetSectionVisible(sectionId, visible)`, `Na__LePanels__OnControl(eventType, controlName, handler)`, `Na__LePanels__IsEditable()`, `Na__LePanels__GetContext()`, `Na__LePanels__SelectedOfKind(sheet, kind)`, `Na__LePanels__ApplyToSelection(sheet, kind, patch)`, `Na__LePanels__AdvancedToggle(body, sectionId, label)`, `Na__LePanels__IsAdvanced(sectionId)`, `Na__LePanels__Row(labelText, control, className)`, `Na__LePanels__Input(type, controlName, attributes)`, `Na__LePanels__Select(controlName, options, value)`, `Na__LePanels__FillSelect(select, options, value)`, `Na__LePanels__Button(text, controlName, modifier, role)`, `Na__LePanels__Note(text)`, `Na__LePanels__SliderRow(labelText, controlName, attributes)`, `Na__LePanels__ShowSlider(body, controlName, value, readingText)`, `Na__LePanels__LinkedPairRow(labelText, pair)`, `Na__LePanels__ShowLink(body, controlName, linked, title)`, `Na__LePanels__STORE_PREFIX = 'na-layouteditor-panel:'`, `Na__LePanels__TabOf(entry)`, `Na__LePanels__ApplyTabs(side)`, `Na__LePanels__BindDelegation(column)`, `Na__LePanels__MIN_BODY_PX`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js`

THE REGISTRATION LIST. The shell-building function (~lines 330-389) creates the columns, calls Na__LePanels__Mount, then calls every panel's Register() in the order the panels appear. Both new panels must be added here.

*Key symbols:* `Na__LePanels__Mount({ left, right, editable, showToast })`, `Na__LePanelSheet__Register()`, `Na__LePanelMargin__Register()`, `Na__LePanelLayers__Register()`, `Na__LePanelStyles__Register()`, `Na__LePanelModelLayers__Register()`, `Na__LePanels__RegisterTab('right', { id : 'properties', title : ... })`, `Na__LePanelScrap__RegisterTab()`, `Na__LePanelParam__RegisterProperties()`, `Na__LePanelViewport__Register()`, `Na__LePanelText__Register()`, `Na__LePanelLeaders__Register()`, `Na__LePanelDims__Register()`, `Na__LePanelShapes__Register()`, `Na__LePanelScrap__Register()`, `Na__LePanelParam__RegisterLibrary()`, `Na__LePanelScrapCustom__Register()`, `Na__LeMode__HOST_ID`, `Na__LeVw__IsViewerMode()`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js`
*Version:* 1.1.0 (13-Sep-2026)

Data layer for the render composites: fetches the config, indexes it, clamps and reads per-viewport weights, and mints cache tokens. The exact template for a parallel Site Plan composites module.

*Key symbols:* `Na__LeComposite__FIELD = 'Viewport__CompositeWeights'`, `Na__LeComposite__ConfigUrl (new URL('./Na__LayoutEditor__RenderComposites__Config__.json', import.meta.url))`, `Na__LeComposite__FALLBACK`, `Na__LeComposite__Ready()`, `Na__LeComposite__Rows()`, `Na__LeComposite__Row(key)`, `Na__LeComposite__ToggleRows()`, `Na__LeComposite__WeightRows()`, `Na__LeComposite__Clamp(key, value)`, `Na__LeComposite__Weight(viewport, key)`, `Na__LeComposite__Factor(viewport, key)`, `Na__LeComposite__IsOverridden(viewport, key)`, `Na__LeComposite__RasterToken(viewport, forThreeD)`, `Na__LeComposite__Token(viewport)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json`
*Version:* Meta__Version 1.2.0

The composite inventory: one row per layer in a viewport's picture. Adding a composite is a config edit (plus the persistence lists - see traps).

*Key symbols:* `LayoutEditor__RenderComposites__Meta`, `LayoutEditor__RenderComposites__Layers`, `Composite__Key`, `Composite__Label`, `Composite__TwoDOnly`, `Composite__Toggle`, `Composite__Order`, `Composite__Note`, `Composite__Weight`, `Weight__Kind ('factor'|'pixels'|'none')`, `Weight__TwoDOnly`, `Weight__Default`, `Weight__Min`, `Weight__Max`, `Weight__Step`, `Weight__Label`, `LayoutEditor__RenderComposites__Fallback`, `keys: projectedLinework, profileLinework, sectionOutline, hiddenLines, glassOpaque, whitecard, enhanceWhitecard, baseImage`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js`
*Version:* 1.6.1 (13-Sep-2026)

The Render Composites panel (section id 'styles') in the LEFT column. The UI template to copy for a Site Plan Render Composites control.

*Key symbols:* `Na__LePanelStyles__ID = 'styles'`, `Na__LePanelStyles__Register()`, `Na__LePanelStyles__Build(body)`, `Na__LePanelStyles__Refresh(body)`, `Na__LePanelStyles__Fill(list)`, `Na__LePanelStyles__WeightCluster(row)`, `Na__LePanelStyles__Unit(kind)`, `Na__LePanelStyles__ForceLabel(viewport)`, `Na__LePanelStyles__ApplyWeight(key, value)`, `Na__LePanelStyles__BuiltKey`, `control names: 'style-toggle', 'style-weight', 'style-weight-reset', 'style-force'`, `data-na-block: 'note', 'list', 'force'`, `label keys: StylesTitle, AdvancedToggle, NoSelection, ForceRenderViewport, ForceRenderDocument, ForceRenderBusy, ResetToDefault, CompositeWeightPixelsHint, CompositeWeightFactorHint`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ModelLayers__.js`
*Version:* 1.3.0 (14-Sep-2026)

The LEFT column's last panel today, and the best worked example of a list panel with a config that arrives late, a rebuild signature, an Advanced fold, an inline cluster and column headings. Already listens for site plan data arriving.

*Key symbols:* `Na__LePanelModelLayers__ID = 'modellayers'`, `Na__LePanelModelLayers__Register()`, `Na__LePanelModelLayers__Build(body)`, `Na__LePanelModelLayers__Refresh(body)`, `Na__LePanelModelLayers__Fill(list, groups)`, `Na__LePanelModelLayers__Head()`, `Na__LePanelModelLayers__EdgeCluster(layerKey)`, `Na__LePanelModelLayers__ReflectEdge(row, viewport, layerKey)`, `Na__LePanelModelLayers__Apply(patch)`, `Na__LePanelModelLayers__ApplyEdge(layerKey, part, value)`, `Na__LePanelModelLayers__BuiltKey`, `Na__SpStore__CHANGED_EVENT (imported from ../../52__System__SitePlanData/Na__SitePlan__Store__.js)`, `control names: 'model-layer-toggle', 'model-layer-bulk', 'edge-colour', 'edge-type', 'edge-weight', 'edge-reset', 'edge-reset-all'`, `defaultOpen : false`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Styles__Panels__.css`

Every panel, section, row, control, Advanced-fold, scrapbook-tile and column-tab rule. Imported globally (see conventions). A new panel styles itself here or in its own feature stylesheet.

*Key symbols:* `.na-le-panel / .na-le-panel--left / --right / __scroll / __grip`, `.na-le-panel__tabs / .na-le-panel__tab / .is-active`, `.na-le-section / __header / __chevron / __title / __body / __grip / .is-folded / .is-off-tab / [hidden]`, `.na-le-row / .na-le-row__label / .na-le-row--toggle / --pair / --buttons`, `.na-le-input / --check / --colour / --inline / --range`, `.na-le-select / .na-le-select--compact`, `.na-le-btn / --primary / --danger / --toggle / --active / --small / --icon / --wide`, `.na-le-note / --heading / --warn / --offer`, `.na-le-subheading / .na-le-bar / .na-le-block`, `.na-le-adv-toggle / __chevron / .na-le-adv / .is-advanced / .na-le-adv--off`, `.na-le-row__adv / .na-le-adv-weight / .na-le-adv-unit / .na-le-adv-reset / .na-le-adv-swatch / .na-le-adv-head / __cell / __spacer`, `.na-le-row__check-slot / .is-overridden`, `.na-le-scrap / .na-le-scrap__item / __thumb / __name / .na-le-scrap-ghost`, `.na-le-grad / .na-le-grad-readout / .na-le-dash`, `var(--Na_Le_Chrome), var(--Na_Le_ChromeRule), var(--Na_Le_Ink)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\55__Feature__Scrapbook\Na__LayoutEditor__Panel__Scrapbook__.js`
*Version:* 1.2.0 (19-Sep-2026)

Standard Scrapbook section AND the owner of the right column's Scrapbook tab registration. The template for sheet-conditional visibility.

*Key symbols:* `Na__LePanelScrap__ID = 'scrapbook'`, `Na__LePanelScrap__RegisterTab()`, `Na__LePanelScrap__Register()`, `Na__LePanelScrap__Sync()`, `Na__LePanelScrap__OnModelChanged(event)`, `Na__LePanelScrap__SHOW_REASONS = ['active','loaded','sheet-created','sheet-deleted','sheet-updated']`, `Na__LePanelScrap__Spec(item, editable)`, `Na__LePanelScrap__PlaceInView(itemId)`, `Na__LePanelScrap__Signature`, `Na__LeScrap__TAB_ID`, `Na__LeScrapDrag__Tile / PlaceInView / EndDrag`, `data-na-scrap: 'note', 'grid'`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\55__Feature__Scrapbook\Na__LayoutEditor__Scrapbook__.js`

Standard library data module - owns the Scrapbook TAB ID and the config fetch/label pattern.

*Key symbols:* `Na__LeScrap__TAB_ID = 'scrapbook'`, `Na__LeScrap__ConfigUrl`, `Na__LeScrap__Ready()`, `Na__LeScrap__GetStatus()`, `Na__LeScrap__STATUS_FAILED`, `Na__LeScrap__Label(key, fallback, tokens)`, `Na__LeScrap__Items()`, `Na__LeScrap__ItemsFor(sheet)`, `Na__LeScrap__GetItem(itemId)`, `Na__LeScrap__ItemName(item)`, `Na__LeScrap__BuildSet(item)`, `Na__LeScrap__Insert(sheet, itemId, centreMm)`, `Item__DrawingTypes`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\56__Feature__ScrapbookCustom\Na__LayoutEditor__Panel__ScrapbookCustom__.js`
*Version:* 1.0.0 (19-Sep-2026)

Custom Scrapbook section - currently the LAST section in the right column, so the Patterns panel registers immediately after it. Also shows the per-feature stylesheet injection and a category dropdown.

*Key symbols:* `Na__LePanelScrapCustom__ID = 'scrapbook-custom'`, `Na__LePanelScrapCustom__STORE_KEY = 'na-layouteditor-scrapbook-custom:category'`, `Na__LePanelScrapCustom__Register()`, `Na__LePanelScrapCustom__Build(body)`, `Na__LePanelScrapCustom__Refresh(body)`, `Na__LePanelScrapCustom__SaveState(categoryName)`, `Na__LePanelScrapCustom__CurrentCategory()`, `Na__LePanelScrapCustom__SetCategory(folder)`, `Na__LePanelScrapCustom__OnTileMenu(event, entry)`, `Na__LePanelScrapCustom__Toast(message, isError)`, `control names: 'scrap-custom-category', 'scrap-custom-name', 'scrap-custom-save'`, `data-na-scrap-custom: 'note', 'grid', 'status'`, `link.href = new URL('./Na__LayoutEditor__Styles__ScrapbookCustom__.css', import.meta.url).href`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\56__Feature__ScrapbookCustom\Na__LayoutEditor__ScrapbookCustom__Transport__.js`
*Version:* 1.0.0 (19-Sep-2026)

THE FILE-LOADING TEMPLATE for the hatch pattern library: app-root URL resolution, index-then-files reads, localhost API vs checked-in index, POST writes, never throws.

*Key symbols:* `Na__LeScrapCustomIo__AppRootUrl = new URL('../../../', import.meta.url)`, `Na__LeScrapCustomIo__ServerService = 'na-projectvision-local-dev'`, `Na__LeScrapCustomIo__SOURCE_API / SOURCE_FILE / SOURCE_NONE`, `Na__LeScrapCustomIo__WHY_NO_SERVER / WHY_RESTART`, `Na__LeScrapCustomIo__INDEX_ITEMS = 'UserScrapbook__Index__Items'`, `Na__LeScrapCustomIo__Place = { contentFolder, indexFile, apiPath }`, `Na__LeScrapCustomIo__Configure(library)`, `Na__LeScrapCustomIo__FileUrl(relativePath)`, `Na__LeScrapCustomIo__ApiUrl(suffix)`, `Na__LeScrapCustomIo__IsProjectVisionServer()`, `Na__LeScrapCustomIo__ItemsOf(index)`, `Na__LeScrapCustomIo__ReadIndex()`, `Na__LeScrapCustomIo__ReadItem(relativeFile)`, `Na__LeScrapCustomIo__Post(suffix, payload)`, `Na__LeScrapCustomIo__Save(categoryFolder, name, itemDocument)`, `Na__LeScrapCustomIo__Delete(relativeFile)`, `Item__File`, `Item__Category`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\56__Feature__ScrapbookCustom\Na__LayoutEditor__ScrapbookCustom__Config__.json`
*Version:* Meta__Version 1.0.0

The config shape a file-backed library uses: a Library block (folder, index file, API path, categories) plus a Labels block. Copy this shape for the hatch pattern library.

*Key symbols:* `LayoutEditor__ScrapbookCustom__Meta`, `LayoutEditor__ScrapbookCustom__Library`, `Library__ContentFolder = '51__LayoutEditor__UserScrapbookContent'`, `Library__IndexFile = 'UserScrapbook__Index__.json'`, `Library__ApiPath = '/api/truevision/scrapbook'`, `Library__MaxNameLength`, `Library__AllowedKinds`, `Library__Categories[] { Category__Folder, Category__Name }`, `LayoutEditor__ScrapbookCustom__Labels (Labels__Title, Labels__Category, Labels__Hint, Labels__Empty, Labels__Loading, Labels__Failed, ...)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__TrueVisionScrapbook__Api__.py`
*Version:* 1.0.0 (19-Sep-2026)

The Flask BLUEPRINT to mirror for a hatch pattern API. Absolute route paths declared on the blueprint (no url_prefix). Rebuilds its index from the folders on every read and write.

*Key symbols:* `truevision_scrapbook_api = Blueprint('truevision_scrapbook_api', __name__)`, `SCRIPT_DIR`, `TRUEVISION_APP_DIR = os.path.join(SCRIPT_DIR, '30__TrueVision__CoreAppCode')`, `SCRAPBOOK_DIR = os.path.join(TRUEVISION_APP_DIR, '51__LayoutEditor__UserScrapbookContent')`, `INDEX_FILE_NAME = 'UserScrapbook__Index__.json'`, `QUARANTINE_DIR_NAME = '00__Deleted__Quarantine'`, `CATEGORY_PATTERN`, `ITEM_FILE_PATTERN`, `@route('/api/truevision/scrapbook') scrapbook_index()`, `@route('/api/truevision/scrapbook/items', methods=['POST']) scrapbook_save_item()`, `@route('/api/truevision/scrapbook/items/delete', methods=['POST']) scrapbook_delete_item()`, `_rebuild_index()`, `_list_categories()`, `_index_entry(category, file_name, item)`, `_is_inside(candidate_path, parent_path)`, `_safe_name_part(name)`, `_free_file_name(category_dir, name_part, stamp)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__LocalServer__Main__.py`

The 8090 local server: imports and registers the blueprints, answers /api/health, and serves the whole repo root statically (case-insensitive). A new blueprint is added here.

*Key symbols:* `from ProjectVision__TrueVisionScrapbook__Api__ import truevision_scrapbook_api  (~line 56)`, `app.register_blueprint(truevision_scrapbook_api)  (~line 193)`, `app.register_blueprint(project_manager_api)`, `@app.route('/api/health') health_check()  -> service 'na-projectvision-local-dev'`, `@app.route('/<path:filepath>') serve_static(filepath)`, `resolve_case_insensitive_path(REPO_ROOT, normalized_path)`, `REPO_ROOT`, `PORT`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js`

Where a panel's edit actually lands. UpdateViewport's patch vocabulary and merge rules for styles / modelLayers / projectedEdges / compositeWeights.

*Key symbols:* `Na__LeModel__UpdateViewport(sheet, viewportId, patch, silent)`, `patch keys: rect, scaleDenominator, pan, imageMm, imageOffset, imageZoom, styles, modelLayers, projectedEdges, compositeWeights, markupMode, name, layerId, sceneId, drawingId, kind, showScaleLabel, showFrame, locked, snapshotAsset, modelSourceId, closedDoors`, `Na__LeModel__STYLE_KEYS`, `Na__LeComposite__FIELD`, `Na__LeEdge__FIELD / Na__LeEdge__CAT_FIELD`, `Viewport__SitePlan (CreateViewport opts.sitePlan)`, `Na__LeModel__Touch('viewports', ...)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js`

The record normaliser - the silent gatekeeper. Any new viewport style key or new per-viewport block must be handled here or it is stripped on every load/save.

*Key symbols:* `Na__LeRec__STYLE_KEYS = ['baseImage','projectedLinework','profileLinework','glassOpaque','whitecard','hiddenLines','enhanceWhitecard','contextLayer']  (~line 261)`, `Na__LeRec__NormaliseViewport(viewport, defaultLayerId)  - Viewport__Styles literal ~line 493`, `Na__LeRec__NormaliseCompositeWeights(block)  (~line 390)`, `Na__LeRec__NormaliseProjectedEdges(block)`, `Na__LeRec__IsSitePlanViewport(viewport)  (~line 413)`, `Na__LeRec__IsSitePlanSheet(sheet)`, `Na__LeRec__SITEPLAN_CATEGORY_PREFIX`, `Na__LeRec__KIND_2D / KIND_3D`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json`

The Layout Editor's own config: panel column setup, viewport default styles, and every user-facing label the panels read through Na__LeCfg__GetLabel.

*Key symbols:* `LayoutEditor__Panels__Config`, `LayoutEditor__Panels__AccordionSections = ['text','dimensions','shapes','leaders']`, `LayoutEditor__Panels__FocusSectionOnSelect`, `LayoutEditor__Panels__LeftWidthPx 250 / RightWidthPx 300 / MinWidthPx 190 / MaxWidthPx 680`, `LayoutEditor__Panels__CollapseOthersOnOpen`, `LayoutEditor__Viewport__DefaultStyles { BaseImage, ProjectedLinework, ProfileLinework, GlassOpaque, Whitecard, HiddenLines, ContextLayer, EnhanceWhitecard }  (~line 182)`, `LayoutEditor__Labels__Config (~line 542): StylesTitle 'Render Composites', ModelLayersTitle, PanelTabProperties, LayersTitle, ViewportTitle ...`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__EditorSetup__.js`

Reads the Panels block into the shape PanelHost uses.

*Key symbols:* `Na__LeCfg__GetPanelSetup()  -> { leftWidthPx, rightWidthPx, minWidthPx, maxWidthPx, collapseOthers, accordion, focusOnSelect }  (~line 170)`, `Na__LeCfg__Num(block, key, fallback)`, `Na__LeCfg__Val(block, key, fallback)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__SheetSetup__.js`

Turns the JSON DefaultStyles block (PascalCase) into the camelCase flags the normaliser uses. A new style toggle needs a line here too.

*Key symbols:* `Na__LeCfg__DefaultStyles(block)  (~line 328)`, `Na__LeCfg__GetViewportSetup()  - defaultStyles, assetFolder, imageZoomMin/Max/FineFactor/CommitMs`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__.js`

Label and config accessors every panel imports.

*Key symbols:* `Na__LeCfg__GetLabel(keySuffix, fallback)  (~line 354, reads LayoutEditor__Labels__<keySuffix>)`, `Na__LeCfg__GetPanelSetup (re-export)`, `Na__LeCfg__SetAppConfig`, `Na__LeCfg__Ready`, `Na__LeCfg__IsEnabled`, `Na__LeCfg__IsReadOnlyOnWeb`, `Na__LeCfg__MatchKeyBinding`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\03__Style__AppStylesheets\Na__CoreUi__Styles__Index__.css`

The global stylesheet index. Na__LayoutEditor__Styles__Panels__.css is @imported here (~line 157); a new CORE panel stylesheet would be added here, a FEATURE one is injected by its own Register().

*Key symbols:* `@import url('../02__Src__AppModules/51__System__LayoutEditor/40__Ui__Panels/Na__LayoutEditor__Styles__Panels__.css')`, `the WebViewer sheet must stay LAST of the Layout Editor imports`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary`

THE PATTERN LIBRARY FOLDER ALREADY EXISTS at the app root beside 51__LayoutEditor__UserScrapbookContent. Pack folders are present and EMPTY of JSON; only two reference PNGs sit at its root. Nothing in the codebase references it yet (grep for '52__LayoutEditor__HatchPatternLibrary' returns nothing).

*Key symbols:* `01__GeometricHatches`, `02__ConstructionMaterialHatches`, `03__Placeholder`, `04__Placeholder`, `05__SitePlanHatches`, `OS_Symbol__Examples__.png`, `OS_Symbol__Examples__Woodland&Water__.png`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\03__AppUtils\Na__AppUtils__ProjectLoader.js`

The localhost test the transport uses, and the only place the CDN-vs-localhost split for PROJECT data is decided (the in-repo libraries do not use it for file reads).

*Key symbols:* `Na__AppUtils__IsRunningOnLocalhost()  (~line 63): hostname === 'localhost' || '127.0.0.1' || port === '8000' || port === '8090'`, `Na__AppUtils__FetchTrueVisionProjectData(projectFolder, yearCode)`, `Na__AppUtils__CdnBaseUrl / Na__AppUtils__R2Prefix`, `Na__AppUtils__ResolveAssetUrl`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Frame__.js`

Where pixel composite weights reach the 2D render.

*Key symbols:* `profilePx : Na__LeComposite__Weight(viewport, 'profileLinework')`, `sectionPx : Na__LeComposite__Weight(viewport, 'sectionOutline')`, `modelEdgePx : Na__LeComposite__Weight(viewport, 'baseImage')  (~lines 127-129)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js`

Where factor composite weights multiply the projected vector drawing, and where Token joins the cache key.

*Key symbols:* `Na__LeComposite__Factor(viewport, 'projectedLinework')  (~line 210)`, `Na__LeComposite__Factor(viewport, 'hiddenLines')  (~line 211)`, `Na__LeComposite__Token`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport3d__.js`

The 3D snapshot path: hands Viewport__Styles straight to the renderer with the base image edge width, keyed on RasterToken(viewport, true).

*Key symbols:* `Na__LeSnap__Render3d(scene, viewport.Viewport__Styles, px.w, px.h, viewport.Viewport__ModelLayers, px.samples, { modelEdgePx : Na__LeComposite__Weight(viewport,'baseImage') }, renderId, view, stillWanted)  (~line 409)`, `Na__LeComposite__RasterToken`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`

The site plan data store. Its change event is what a site-plan-aware panel listens to (ModelLayers already does).

*Key symbols:* `Na__SpStore__CHANGED_EVENT`, `event.detail.reason (e.g. 'layer-loaded')`

### Conventions observed

- FILE NAMING: Na__<Area>__<Thing>__.js with a trailing double underscore before the extension. A panel is Na__LayoutEditor__Panel__<Name>__.js; its data layer Na__LayoutEditor__<Name>__.js; its config Na__LayoutEditor__<Name>__Config__.json; its stylesheet Na__LayoutEditor__Styles__<Name>__.css. Folders are NN__<Role>__<Name> (25__System__RenderStyles, 40__Ui__Panels, 55__Feature__Scrapbook).
- NAMESPACE PREFIX: every symbol in a module shares one short prefix - Na__LePanels (host), Na__LeComposite (composites data), Na__LePanelStyles (composites panel), Na__LeScrapCustomIo (transport), Na__LeModel, Na__LeCfg, Na__LeRec. Module-private helpers carry the same prefix. Nothing is exported that is not in the explicit `export { ... }` block at the foot under a 'MODULE EXPORTS' banner.
- HEADER BLOCK: every file opens with a banner comment - FILE, NAMESPACE, MODULE, AUTHOR, PURPOSE, CREATED - then DESCRIPTION, INTEGRATION, a PORT NOTE (Ported from / Ported on / Parity / Divergences / Back-port, or 'Authored in TrueVision3D first' plus the ValeVision status), then a reverse-chronological DEVELOPMENT LOG with a semantic version per entry.
- REGION BANNERS: code is divided by `// ----` / `// REGION | Name` / `// endregion ----` blocks, and each function carries a `// FUNCTION |` or `// HELPER FUNCTION |` caption line with a `// ----` rule under it. Prose comments in capitals explain WHY a decision was taken, often at length.
- JSON CONFIG SHAPE: a top-level `<App>__<Feature>__Meta` block (Meta__FileName, Meta__Description, Meta__Version, Meta__Created, Meta__Author, plus free-form Meta__<Topic> essays), then one or more data blocks named `<App>__<Feature>__<Block>`. Every leaf key is prefixed by its block's singular noun: Composite__Key, Weight__Kind, Library__ContentFolder, Category__Folder, Item__File.
- RECORD KEYS: per-viewport data lives under `Viewport__<Thing>` (Viewport__Styles, Viewport__CompositeWeights, Viewport__ModelLayers, Viewport__SitePlan). A record key is NEVER renamed once saved - baseImage is still called baseImage though it is labelled 'Context Layer' (Meta__KeyStability says so explicitly).
- CONFIG, NOT CODE: a panel's rows come from a fetched JSON inventory with a hard-coded FALLBACK array in the module, so a failed fetch still gives a working panel. The fetch is `new URL('./<file>.json', import.meta.url)` with `{ cache : 'no-store' }`, memoised behind a single `__Ready()` promise, and the panel calls `Ready().then(() => { <BuiltKey> = null; Refresh(ID); })`.
- REBUILD SIGNATURE: a panel never rebuilds its rows on every refresh. It computes a string signature of what the rows were built from (`Na__LePanelStyles__BuiltKey`, `Na__LePanelModelLayers__BuiltKey`, `Na__LePanelScrap__Signature`) and rebuilds only when it changes - otherwise a refresh would destroy the control under the pointer and close an open dropdown.
- DECLARED CONTROLS: never addEventListener on a panel control. Put `data-na-control="<name>"` (and `data-na-role="<key>"` for per-row identity) on the element and register `Na__LePanels__OnControl('<change|click|input|keydown|dblclick>', '<name>', (event, el, role) => ...)` in the panel's Register(). Blocks inside a body are found with `data-na-block="..."` or a panel-specific attribute (`data-na-scrap`, `data-na-scrap-custom`, `data-na-toggle`, `data-na-model-layer`).
- REFRESH NEVER FIGHTS THE USER: `if (document.activeElement !== el) el.value = ...` guards every write into a live control.
- WORDING IS CONFIG: user-facing strings go through `Na__LeCfg__GetLabel('<Key>', '<fallback>')` reading `LayoutEditor__Labels__<Key>`, or a feature's own `Na__Le<Feature>__Label(key, fallback, tokens)` with `{token}` substitution. The fallback in code is always the real English string.
- PERSISTENCE OF UI STATE: localStorage through the host's Remember/Recall with prefix `na-layouteditor-panel:` and keys `width-<side>`, `height-<id>`, `fold-<id>`, `advanced-<id>`, `tab-<side>`. A feature with its own preference uses its own prefixed key (`na-layouteditor-scrapbook-custom:category`) inside try/catch ('storage is a courtesy').
- EDIT PATH: a panel never mutates a record. It builds a patch and calls `Na__LeModel__UpdateViewport(sheet, viewportId, patch)` (or the equivalent model writer), which merges, clamps and announces. Reset is expressed as `null` in the patch, which deletes the key so the record shows no trace.
- VERSIONING: semantic per-file versions in the DEVELOPMENT LOG, and an app version (TrueVision3D v2.xx.0) in the commit subject. A feature that is ported carries the ValeVision version it landed as in the PORT NOTE.
- STYLESHEETS: a CORE panel stylesheet is @imported from 03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css; a FEATURE folder's stylesheet is injected at Register() time with `const link = document.createElement('link'); link.rel='stylesheet'; link.href = new URL('./Na__LayoutEditor__Styles__<Name>__.css', import.meta.url).href; document.head.appendChild(link);`.
- CSS NAMING: BEM-ish, all lowercase, `na-le-<block>__<element>--<modifier>`, with state classes `is-folded`, `is-active`, `is-advanced`, `is-overridden`, `is-off-tab`, `is-linked`, `is-dragging`. Properties are written one per line with the colons aligned in a column. Capitalised prose comments explain each rule's reason.
- PYTHON API: one blueprint per feature in a `ProjectVision__<Feature>__Api__.py` file at na-apps root, with a ROUTES list in the header banner, absolute `@blueprint.route('/api/truevision/<feature>...')` paths (no url_prefix), module-level SCRIPT_DIR/DIR constants, regex whitelists for any folder or file name, helpers prefixed `_`, and jsonify answers shaped `{ 'status' : 'ok', ... }` or `{ 'error' : '...' }`. It never creates a folder and never unlinks a file (delete moves to 00__Deleted__Quarantine).

### Extension points

**Add the 'Site Plan Render Composites' panel to the LEFT column**

- *Where:* Na__LayoutEditor__ModeController__.js, the shell-building function's left-column block (~lines 368-372), between Na__LePanelStyles__Register() and Na__LePanelModelLayers__Register()
- *How:* Import the new panel module beside the others (~line 207) and add one call, e.g. `Na__LePanelSpComposite__Register();`. That Register() ends with `return Na__LePanels__RegisterSection('left', { id : 'siteplan-composites', title : Na__LeCfg__GetLabel('SitePlanCompositesTitle', 'Site Plan Render Composites'), build : ..., refresh : ..., defaultOpen : false });`. Position in the column IS the position of this call - there is no order field.
- *Risk:* Registering it before Na__LePanels__Mount, or in the viewer branch, silently does nothing (RegisterSection returns null when the column does not exist). The viewer path returns early at ~line 360 and must stay that way.

**Add the 'Patterns' panel as the LAST section of the RIGHT column**

- *Where:* Na__LayoutEditor__ModeController__.js, immediately after Na__LePanelScrapCustom__Register() (~line 385)
- *How:* `Na__LePanelPatterns__Register();` whose body calls `Na__LePanels__RegisterSection('right', { id : 'patterns', title : Na__LePat__Label('Title','Patterns'), tab : Na__LeScrap__TAB_ID, build, refresh })`. Import Na__LeScrap__TAB_ID from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js' exactly as Panel__ScrapbookCustom__ does (~line 59). RECOMMENDATION: a new SECTION on the existing Scrapbook tab, NOT a new tab. Evidence: (1) the requirement is 'the very LAST panel in the RIGHT column' and order is registration order, so it must sit after the Custom Scrapbook, which is on the Scrapbook tab; (2) the tab already means 'libraries you drag things from' and holds three sibling sections, so a fourth is the established shape; (3) PanelHost supports N tabs but the memory rule 'Adam's uniform tab styling' plus the tab strip's 1/N width means a third tab shrinks and re-weights the two he already reads; (4) a section costs one RegisterSection call, a tab costs a RegisterTab call plus a decision about which sections move.
- *Risk:* If `tab` is omitted the section silently lands on the FIRST tab ('properties'), where it would be last in Properties, not last in the column. Registering it before Na__LePanelScrap__RegisterTab() would also put it on the wrong tab.

**Create the parallel site plan composites data module + config**

- *Where:* New files: 51__System__LayoutEditor/25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js and Na__LayoutEditor__SitePlanComposites__Config__.json
- *How:* Mirror Na__LayoutEditor__RenderComposites__.js one-for-one: a `__ConfigUrl` from import.meta.url, a `__FIELD` constant naming a new viewport record key (e.g. 'Viewport__SitePlanComposites'), a `__FALLBACK` array, `__Ready()` memoised fetch with no-store, `__Rows()` mapping `SitePlanComposite__Key/Label/Order/Note` (+ a `Layer__ZIndex` if the 1..10 hierarchy is stored here), `__Row(key)` with a lazy Map index, `__Clamp`, a per-viewport getter, and `__Token(viewport)` for the render cache key. For a DROPDOWN (fill / pattern / linework layering) the config row is a list of named composite presets rather than per-layer weights: `SitePlanComposite__Modes: [ { Mode__Key, Mode__Label, Mode__Layers : ['fill','pattern','linework'] } ]`.
- *Risk:* If the new record key is not handled in Na__LeRec__NormaliseViewport it is deleted on every load and every save; the composites precedent is `viewport[Na__LeComposite__FIELD] = Na__LeRec__NormaliseCompositeWeights(viewport[Na__LeComposite__FIELD]);`.

**Store the site plan composite choice per viewport**

- *Where:* Na__LayoutEditor__SheetModel__Viewports__.js, Na__LeModel__UpdateViewport (~lines 258-290), and the patch vocabulary comment above it
- *How:* Add a `patch.sitePlanComposite` (or `.sitePlanComposites`) branch beside the existing `patch.styles` / `patch.compositeWeights` branches, merging rather than replacing, with `null` deleting the key. The panel then calls `Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { sitePlanComposite : value })` exactly as Na__LePanelStyles__ApplyWeight does.
- *Risk:* UpdateViewport ignores unknown patch keys silently - no error, the control just appears not to work. Also add the new key to the patch-vocabulary comment so the next reader finds it.

**Make the new panel visible only on site plan sheets/viewports**

- *Where:* The new panel module's own sync function, modelled on Na__LePanelScrap__Sync / __OnModelChanged in 55__Feature__Scrapbook/Na__LayoutEditor__Panel__Scrapbook__.js (~lines 190-201)
- *How:* Listen once to `Na__LeModel__CHANGED_EVENT` with a reason allow-list, call `Na__LePanels__SetSectionVisible('siteplan-composites', Na__LeModel__IsSitePlanSheet(sheet))` (or `Na__LeRec__IsSitePlanViewport(Na__LeModel__GetSelectedViewport())`), then `Na__LePanels__Refresh(id)`. Also listen to `Na__SpStore__CHANGED_EVENT` from ../../52__System__SitePlanData/Na__SitePlan__Store__.js the way Panel__ModelLayers does (~line 160), because site plan layers arrive after the panel is built.
- *Risk:* Na__LePanels__Refresh skips FOLDED and OFF-TAB sections, so visibility must be driven from the window event listener, never from refresh. Use SetSectionVisible (the `hidden` attribute) and never touch the `is-off-tab` class, which belongs to the tab system.

**Load the hatch pattern JSON packs**

- *Where:* New module 51__System__LayoutEditor/<NN>__Feature__HatchPatterns/Na__LayoutEditor__HatchPatterns__Transport__.js, mirroring Na__LayoutEditor__ScrapbookCustom__Transport__.js
- *How:* Copy the transport verbatim and change only its Place defaults: `{ contentFolder : '52__LayoutEditor__HatchPatternLibrary', indexFile : 'HatchPattern__Index__.json', apiPath : '/api/truevision/hatchpatterns' }`, fed from a `LayoutEditor__HatchPatterns__Library` block in the feature's Config JSON through a `__Configure(library)` function. Keep `AppRootUrl = new URL('../../../', import.meta.url)` (it resolves the folder holding Index.html from any 51__System__LayoutEditor/<NN__Feature>/ module) and keep FileUrl's per-segment encodeURIComponent. A pack file is then read at `<appRoot>/52__LayoutEditor__HatchPatternLibrary/<packFolder>/<File>.json`. URL SHAPE for the index on localhost: `window.location.origin + '/api/truevision/hatchpatterns'`; everywhere else, and as the fallback: the index FILE at `<appRoot>/52__LayoutEditor__HatchPatternLibrary/HatchPattern__Index__.json`. LOCALHOST vs CDN: there is no CDN leg for this library - it lives inside the app repo and is served by the same origin as Index.html in all three environments (8090 local server, static server, live website). `Na__AppUtils__IsRunningOnLocalhost()` (hostname localhost or 127.0.0.1, or port 8000 or 8090) decides ONLY whether to ask the Flask API for a freshly-rebuilt index; file GETs are origin-relative either way. Contrast with project data, which does split CDN vs localhost in Na__AppUtils__FetchTrueVisionProjectData - do not copy that split here.
- *Risk:* No environment has a directory listing, so the pack folders cannot be enumerated from the browser. A checked-in index file is mandatory for the live site, and the index must be rewritten whenever a pattern JSON is added by hand - which is exactly why the scrapbook API rebuilds it from the folders on every read.

**Add the Flask blueprint for the pattern library (only if patterns are ever WRITTEN or the index must self-rebuild)**

- *Where:* New file D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__TrueVisionHatchPatterns__Api__.py, registered in ProjectVision__LocalServer__Main__.py
- *How:* Copy ProjectVision__TrueVisionScrapbook__Api__.py. Blueprint: `truevision_hatchpatterns_api = Blueprint('truevision_hatchpatterns_api', __name__)`. Constants: `HATCH_DIR = os.path.join(TRUEVISION_APP_DIR, '52__LayoutEditor__HatchPatternLibrary')`, `INDEX_FILE_NAME = 'HatchPattern__Index__.json'`, a `PACK_PATTERN` regex for `NN__<Name>`. Routes are declared as absolute paths on the blueprint (there is no url_prefix): GET '/api/truevision/hatchpatterns' returning `{ 'status':'ok', 'index': {...} }` rebuilt from the folders first, and POST routes only if saving is wanted. Then two lines in ProjectVision__LocalServer__Main__.py: the import beside line 56 and `app.register_blueprint(truevision_hatchpatterns_api)` beside line 193.
- *Risk:* The 8090 server NEVER reloads its routes - a new route answers 404/405 until Adam restarts it. Read the running routes with OPTIONS (Allow header), never a test POST. The transport must tell 'needs restart' from 'no server' the way the scrapbook one does, by checking /api/health for service 'na-projectvision-local-dev'.

**Style the two new panels**

- *Where:* Either Na__LayoutEditor__Styles__Panels__.css (already @imported globally) for anything reusing the existing row vocabulary, or a feature stylesheet injected at Register()
- *How:* Reuse .na-le-row / .na-le-row__label / .na-le-select / .na-le-btn as-is; only add rules for genuinely new furniture (a pattern swatch grid - copy .na-le-scrap / .na-le-scrap__item / .na-le-scrap__thumb). If the Patterns panel lives in its own NN__Feature__ folder, inject its stylesheet in Register() with the ScrapbookCustom four-liner rather than adding a global @import.
- *Risk:* Adding a global @import to Na__CoreUi__Styles__Index__.css must stay ABOVE the WebViewer sheet, which is deliberately last because it reshapes the shell.

### Traps

- A NEW COMPOSITE TOGGLE NEEDS FOUR EDITS OUTSIDE ITS CONFIG or it will not persist: (1) `Na__LeRec__STYLE_KEYS` in Na__LayoutEditor__SheetRecords__.js (~line 261) - UpdateViewport only copies keys in this list; (2) the hard-coded `viewport.Viewport__Styles = { ... }` literal in Na__LeRec__NormaliseViewport (~line 493) - a key absent here is deleted on every load AND every save; (3) `Na__LeCfg__DefaultStyles` in Na__LayoutEditor__ConfigState__SheetSetup__.js (~line 328); (4) `LayoutEditor__Viewport__DefaultStyles` in Na__LayoutEditor__AppConfig__.json (~line 182, PascalCase keys). The panel and the config alone give a working-looking control that forgets everything.
- Na__LeRec__NormaliseCompositeWeights DROPS any key the composites config has never heard of, and any key whose Weight__Kind is 'none'. A weight written before its config row lands is silently erased on the next normalise pass.
- REGISTRATION ORDER IS THE ONLY ORDER. RegisterSection appends; there is no order/priority field and no re-sort. Moving a panel means moving its call in Na__LayoutEditor__ModeController__.js, and adding one in the wrong place puts it in the wrong position with no warning.
- Na__LePanels__Unmount() CLEARS Sections, Handlers and Tabs. Every panel must register on every editor entry, and `Na__LePanels__OnControl` handlers registered once at module load would be lost - which is why Register() re-declares them each time (they are keyed 'type:name' in a Map, so re-registering is idempotent).
- A SECTION WITH NO spec.tab LANDS ON THE COLUMN'S FIRST TAB. Na__LePanels__TabOf falls back to tabs[0].id. On the right column that is 'properties', not the Scrapbook tab.
- Na__LePanels__Refresh SKIPS folded sections AND off-tab sections. Anything that must happen regardless of fold state - deciding whether a section is visible at all - has to run from a window event listener, not from refresh. Na__LePanelScrap__Sync says so in a comment.
- TWO DIFFERENT HIDING MECHANISMS MUST NOT BE CROSSED: `hidden` belongs to SetSectionVisible (sheet applicability); the `is-off-tab` class belongs to the tab system. A section can legitimately be both. Writing display:none on .na-le-section, or toggling the other's mechanism, breaks one of them.
- REBUILDING ROWS ON EVERY REFRESH DESTROYS THE CONTROL UNDER THE POINTER - with a dropdown open it closes under the cursor. Always compute a BuiltKey/Signature string and rebuild only when it changes. Equally, never write into a control that has focus (`document.activeElement !== el`).
- A `<label>` ROW ADOPTS ITS FIRST CONTROL. Na__LePanels__Row returns a <label>; once extra controls sit between the caption and the checkbox, clicking the caption opens the first of them instead. The fix used everywhere is `input.id = ...; row.htmlFor = input.id;`. A button inside such a row must call `e.preventDefault()` in its handler or the click also reaches the checkbox (see 'style-weight-reset' and 'edge-reset').
- THE 8090 PROJECTVISION SERVER NEVER RELOADS ITS ROUTES. A blueprint route added to a .py file answers 405/404 until Adam restarts the server. Read the live routes with OPTIONS and the Allow header, never with a test POST. The transport layer is expected to detect this and say 'restart it' rather than 'no server'.
- NO DIRECTORY LISTING ANYWHERE. Neither the live website nor a plain static server can enumerate 52__LayoutEditor__HatchPatternLibrary/<pack>/. A checked-in index JSON is the only thing that makes the library readable off localhost - and it goes stale the moment a file is added by hand unless a server route rebuilds it.
- THE HATCH LIBRARY FOLDER IS ALREADY THERE AND ALREADY EMPTY: 01__GeometricHatches, 02__ConstructionMaterialHatches, 03__Placeholder, 04__Placeholder, 05__SitePlanHatches contain no JSON at all, and nothing in the codebase references the folder name yet. Do not assume a loader or an index exists.
- THE RENDER PATH READS THE RECORD DIRECTLY AT RENDER TIME (Viewport2d__Frame, Viewport2d__Linework, Viewport3d). A new site plan composite that changes pixels MUST join a cache token or a stale raster is reused; and it must join the RIGHT token - Na__LeComposite__Token keys everything, Na__LeComposite__RasterToken keys only the PIXEL weights (and narrows again for 3D), deliberately, so a vector-only factor does not re-render a multi-second supersampled underlay.
- SITE PLAN SCALE COERCION: Na__LeScale__Coerce takes Na__LeRec__IsSitePlanViewport(viewport) as its second argument - a site plan viewport whose marker is missing coerces to the architectural scale list (memory: 'scales coerce to 1:50 without the site plan flag').
- Viewport__SitePlan IS DELETED BY THE NORMALISER unless it is a non-array object, and a site plan viewport is forced to KIND_2D with Viewport__DrawingId nulled. Any new per-viewport site plan setting hung off that object must survive `Object.assign({}, viewport.Viewport__SitePlan)`.
- A SITE PLAN CATEGORY IS NEVER PRUNED from the projected-edges record (Na__LeRec__SITEPLAN_CATEGORY_PREFIX), because its default is the style its export carries and that is not known until the site plan data has loaded. Any new per-layer site plan style must respect the same rule or curation is thrown away on load.
- PWA CACHE: a release whose new import names an export a warm service-worker cache lacks breaks the editor until the second visit. TrueVision bumps its own token in Na__Pwa__ServiceWorker__.js - check it against HEAD before shipping new modules.
- RUN 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs after every JS edit: it catches a Na__ helper used but never imported, which node --check cannot see and which a copy-paste port causes constantly.

### Open questions raised by this survey

- Is the 'Site Plan Render Composites' dropdown a PER-VIEWPORT setting (like every other composite, stored on Viewport__* and undoable) or a PER-SHEET / per-session view mode? The whole Render Composites machinery is per-viewport; if this one is not, none of the storage precedent applies and it needs a different home (Sheet__* or a runtime-only toggle like the drawing planes).
- Does the new Z-index / height hierarchy (1..10) live in the SketchUp SSOT tag config (Na__LayoutEditor__ModelLayers__Config__.json / the site plan export), in the new site plan composites config, or on the record per viewport? It determines whether the left-column dropdown just picks a mode or also needs per-layer number controls.
- Should the Patterns panel apply a pattern to a SELECTED shape (a properties-style panel, which argues for the Properties tab) or be a LIBRARY you drag from (which argues for the Scrapbook tab)? The survey recommends the Scrapbook tab on the strength of 'last panel in the right column', but a selection-driven pattern picker is conceptually a Properties panel and Adam should confirm.
- Is the pattern library READ-ONLY (checked-in JSON packs, no Flask route needed at all - plain GETs work in every environment) or does the pattern GENERATOR save new packs from the browser? Only the second needs a new blueprint and a server restart.
- What is the index file called and who writes it? The scrapbook precedent is a server-rebuilt UserScrapbook__Index__.json with a UserScrapbook__Index__Items array of { Item__File, Item__Category }. A hand-maintained HatchPattern__Index__.json is simpler but will go stale.
- Existing vs Proposed site plan folders are described as 'two R2 stores auto-detected by folder' - this survey did not cover 52__System__SitePlanData's loader, so how a viewport says which store it draws is unknown here and needs its own survey before the composites dropdown can offer it.
- Does anything about the composites config need a Meta__Version bump rule? The existing file tracks Meta__Version 1.2.0 by hand alongside the module's own DEVELOPMENT LOG version; a parallel file should follow, but nothing enforces it.

---

<a id="area-5"></a>
## 5. TrueVision GLB Builder SketchUp plugin — HtmlDialog UI (tabs, "Project" tab), the Ruby action bridge, the project-portal folder mapper, the site plan export, and the Cloudflare R2 push it drives

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY — find symbols by name, the files are edited often.

THE DIALOG. One `UI::HtmlDialog` built in `Na__UserInterface__ShowExportDialog` (UserInterface__.rb ~55), preferences key `Na__TrueVision__GlbBuilder__Dialog`, 620x760. `Na__UserInterface__GenerateDialogHtml` (~109) reads three asset files resolved by PathResolver and inlines them into the HTML template with SIX placeholders — `{{DIALOG_TITLE}}`, `{{LOGO_REMOTE_URL}}`, `{{LOGO_FILE_URI}}`, `{{STYLESHEET_CONTENT}}`, `{{UI_BRIDGE_SCRIPT}}` (html) and `{{FONT_DIR_URI}}` (css). Every substitution uses the BLOCK form of gsub; the two-arg form shreds the JS (documented in a long comment at ~117). There is no local server, no linked files.

TABS. Three, static in markup (UiLayout__.html ~62-69): buttons `Na__Tvgb__ShowTab('export'|'project'|'settings', this)` and panels `#tab-export`, `#tab-project`, `#tab-settings`. **There is no tab called "Project Configurator".** The thing Adam means is the **Project** tab, `#tab-project` (~249-437), which holds, in order: the project card `#naTvgbProjectCard` (code/name/brief/portal folder/target folder, Link + Unlink); "Design Phases And Schemes" `#naTvgbSchemeGroup` (scheme list `#naTvgbSchemeList`, new-phase `<select id="naTvgbNewPhaseSelect">`, Create Folder + Duplicate Selected); "Project Structure" tree `#naTvgbStructureTree`; "Cloudflare R2" `#naTvgbCloudGroup` (Push, Dry Run, Open Pipeline); "Portal Root" (`#naTvgbPortalInput` + Save Portal Root); and a `<details class="naTvgb__DangerZone">` holding Delete A Design Phase Folder and Purge A Folder From Cloudflare R2.

DESIGN PHASE LOCK-IN (the pattern to copy). The UI control is a list of buttons, not a select: `na__tvgb__renderSchemeList()` (UiBridge ~1259) paints `naTvgb__SchemeRow` buttons from `naTvgbProject.folders`; clicking calls `Na__Tvgb__SelectScheme(name)` → `na__tvgb__dispatch('set_target_folder', {targetFolder})`. Ruby `Na__ProjectActions__SetTargetFolder` (ProjectActions ~181) resolves the phase with `Na__PortalMapper__IdentifyPhase` and persists via `Na__ProjectLink__WriteTargetPhase`, writing `target_phase_folder` and `target_phase_id` into the model attribute dictionary `Na__TrueVision__GlbBuilder__ProjectLink`. Folder naming is data, not code: `DesignPhases[]` in `Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json` with `PhaseId`, `Label`, `FolderTemplate` (`DesignPhase01__ConceptDesign__Scheme-{NN}`), `SupportsSchemes`, `Aliases` (this is where `DesignPhase01__ConceptDesign__ExistingBuilding` is recognised without renaming). Creation goes through `Na__PortalMapper__CreatePhaseFolder`, which refuses an existing folder and refuses a second non-schemed phase. The wrong-phase guard is a two-stage thing: `Na__PortalMapper__InspectTargetFolder` reports `glb_count`, the JS shows a modal offering "Archive, Then Export" vs "Overwrite Without Archiving" (`Na__Tvgb__RunExportAction` ~189), and Ruby then zips the old GLBs with `Na__PortalMapper__ArchiveFolderContents` limited to `Na__ProjectActions__SelectedFileNames` — a failed archive aborts the export rather than becoming a silent overwrite. Deletes and purges re-check the typed project code server-side.

SITE PLAN TODAY. There is no site plan section on the Project tab at all, and the site plan export knows nothing about the project link. The Export tab has a status row `#naTvgbSitePlanCount` and one card `#naTvgbExportSitePlanCard` → `Na__Tvgb__RunExportAction('export_site_plan')` → `Na__UserInterface__ActionExportSitePlan(dialog)` (note: takes NO params) → `Na__PublicApi__ExportSitePlanData` → `Na__SitePlan__Run`, which owns its own `UI.messagebox` summary, its own `UI.select_directory` in `Na__SitePlan__ChooseFolder`, and its own stale-file delete prompt. The last folder is remembered in Sketchup defaults section `TrueVision3D_GlbBuilder`, key `SitePlanExportDir`. Output: one `{PREFIX}TrueVision__SitePlan__{Layer}__LineworkModel__.glb` per tag, `__FillModel__.glb` for fill tags (LINE_LOOP rings, mode 2 — NOT triangulated faces), plus `TrueVision__SitePlanData__Manifest__.json`, all into a single flat `SitePlan__DrawingData`.

R2 PATH. `push_to_cloud` / `push_dry_run` / `export_and_sync` → `Na__CloudSync__PushProject(link, dry_run:)` runs two Python scripts from `na-apps/05__ProjectVision__CoreAppCode`: `ProjectVision__BuildScript__.py` (rebuilds `TrueVision__ProjectData__.json`), then the sync. The sync is NOT run as a CLI any more: `truevision_cloud_manager.rb` overrides `Na__CloudSync__Execute` and `Na__CloudSync__RunR2Sync` to write a request JSON, spawn `truevision_process.ps1` (hidden PowerShell, 30 min cap, result file published atomically) and pump a Fiber from `UI.start_timer`; `truevision_r2_worker.py` imports `CloudflareR2__ModelSync__Main__.py` as a module and calls `run_r2_sync(..., auto_confirm_upload=True, sync_truevision=True, sync_planvision=False)`. Bucket keys: `NaProjectPortal/{NN}-Projects/{CODE__Folder}/30__TrueVision__AppContent/{folderName}/{file}`. The sync only ever uploads (new/update by local mtime > remote LastModified); it never deletes. The only deletion from the dialog is the per-folder purge (`Na__ProjectActions__ManageR2` + `manage()` in the worker), which is fenced by a fetched inventory snapshot, project-root equality, bucket+prefix equality, a per-object `head_object` ETag/size/mtime recheck, and the typed project code — and by a regex `DesignPhase[A-Za-z0-9_ -]+` that today makes site plan folders invisible to both fetch and purge.

WHAT IS MISSING FOR EXISTING/PROPOSED. Everything downstream assumes exactly ONE site plan folder: `TrueVisionContent.SitePlanFolderName` (one string), `SITEPLAN_FOLDER_NAME` in both Python scripts, `data['SitePlan__DataStore']` (one object) in the build script, one `next if entry == siteplan_name` skip in three separate listing loops, and one aside row in the structure tree. Two folders added naively would be published as ordinary design-phase model groups (loaded as 3D models in TrueVision) and their manifests would not upload.

### Files that matter

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiLayout__.html`
*Version:* created 19-Sep-2026 (no version header)

The whole dialog markup: brand header, 3-button tab bar, export/project/settings panels, footer status line, project-link modal, generic confirm modal. 652 lines. Placeholders only, no model data interpolated.

*Key symbols:* `nav.naTvgb__TabBar`, `Na__Tvgb__ShowTab('export'|'project'|'settings')`, `#tab-export`, `#tab-project`, `#tab-settings`, `#naTvgbModelStatus`, `#naTvgbSitePlanCount`, `#naTvgbExportMaterials`, `#naTvgbIndexedGroup`, `#naTvgbExportIndexedOnly`, `#naTvgbDownscaleTextures`, `#naTvgbExportModelCard`, `#naTvgbExportProjectCard`, `#naTvgbExportSyncCard`, `#naTvgbExportSitePlanCard`, `#naTvgbRescanCard`, `#naTvgbManifestBody`, `#naTvgbSelectionCount`, `#naTvgbReport`, `#naTvgbProjectCard`, `#naTvgbSchemeGroup`, `#naTvgbSchemeList`, `#naTvgbNewPhaseSelect`, `#naTvgbDuplicateBtn`, `#naTvgbStructureTree`, `#naTvgbCloudGroup`, `#naTvgbPushCard`, `#naTvgbDryRunCard`, `#naTvgbPipelineCard`, `#naTvgbPortalInput`, `#naTvgbDangerFolderSelect`, `#naTvgbDangerPermanent`, `#naTvgbDeleteBtn`, `#naTvgbR2Fetch`, `#naTvgbR2Folders`, `#naTvgbR2Report`, `#naTvgbR2Purge`, `#naTvgbProjectModal`, `#naTvgbConfirmModal`, `#naTvgbConfirmSecondary`, `{{STYLESHEET_CONTENT}}`, `{{UI_BRIDGE_SCRIPT}}`, `{{LOGO_REMOTE_URL}}`, `{{LOGO_FILE_URI}}`, `{{DIALOG_TITLE}}`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiBridge__.js`
*Version:* 2.8.0 header, extended since

Two IIFEs. The first is the whole bridge: tab switching, export params, dispatch, manifest render, report render, button lock state, project-link modal, generic confirm modal, project-tab rendering, and the window API export list. The second (from ~1453) is the R2 cloud-inventory module, which cannot see the first's private helpers and uses a deliberate small published surface. 1529 lines.

*Key symbols:* `naTvgbState {isRunning, activeTabId, canExportModel, canExportSitePlan}`, `naTvgbProject {linked, code, targetFolder, targetGlbCount, selectedFolder, phases, folders, structure, portalFound}`, `naTvgbManifestGroups`, `NA_TVGB_PROJECT_CODE_PATTERN`, `NA_TVGB_CONFIRMED_ACTIONS`, `Na__Tvgb__ShowTab`, `na__tvgb__collectExportParams`, `Na__Tvgb__RunExportAction`, `na__tvgb__sendExportAction`, `Na__Tvgb__ToggleFile`, `Na__Tvgb__ToggleGroup`, `Na__Tvgb__SetAllFilesSelected`, `na__tvgb__sendSelection`, `Na__Tvgb__ReceiveReport`, `Na__Tvgb__ReceiveModelStatus`, `Na__Tvgb__ReceiveProjectStatus`, `Na__Tvgb__ReceiveProjectLinkResult`, `na__tvgb__renderManifest`, `na__tvgb__noteHtml`, `na__tvgb__groupHtml`, `na__tvgb__fileRowHtml`, `na__tvgb__renderReport`, `na__tvgb__applyButtonLockState`, `na__tvgb__lockCard`, `na__tvgb__lockButton`, `na__tvgb__showConfirm`, `Na__Tvgb__AcceptConfirmModal`, `Na__Tvgb__AcceptConfirmSecondary`, `Na__Tvgb__HandleConfirmTyping`, `Na__Tvgb__RunProjectAction`, `Na__Tvgb__SelectScheme`, `Na__Tvgb__ConfirmCreateScheme`, `Na__Tvgb__ConfirmDuplicateScheme`, `Na__Tvgb__ConfirmDeleteScheme`, `na__tvgb__dispatch`, `na__tvgb__renderSchemeList`, `na__tvgb__renderPhaseSelect`, `na__tvgb__renderDangerFolderSelect`, `na__tvgb__renderTree`, `na__tvgb__escHtml`, `na__tvgb__escAttr`, `Na__Tvgb__LockR2`, `Na__Tvgb__ReceiveR2`, `Na__Tvgb__ReviewR2`, `Na__Tvgb__ConfirmPurgeR2Folder`, `Na__Tvgb__Confirm`, `Na__Tvgb__SetStatus`, `Na__Tvgb__ProjectCode`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__Styles__.css`
*Version:* created 19-Sep-2026

All dialog styling, 1515 lines, inlined into the page. Open Sans @font-face (local file URI first, noble-architecture.com second), :root design tokens, then one REGION per UI block.

*Key symbols:* `--naTvgb_Navy #172b3a`, `--naTvgb_NavyMid #2a4558`, `--naTvgb_NavyHover #3a5f78`, `--naTvgb_Bg #f5f7f9`, `--naTvgb_PanelBg #ffffff`, `--naTvgb_Text #1b1f24`, `--naTvgb_MutedText #5b636d`, `--naTvgb_Border #d6dbe1`, `--naTvgb_Success #1f7a42`, `--naTvgb_Error #b32d2d`, `--naTvgb_Warning #7a5400`, `--naTvgb_InfoText #2a4558`, `--naTvgb_FontFamily`, `--naTvgb_FontMono`, `naTvgb__Shell`, `naTvgb__TabBar`, `naTvgb__TabButton--active`, `naTvgb__TabPanel--active`, `naTvgb__ProjectStatus__Row`, `naTvgb__ActionGroup__Title`, `naTvgb__ActionCard`, `naTvgb__ActionCard--primary`, `naTvgb__OptionRow`, `naTvgb__OptionRow--dependent`, `naTvgb__OptionRow--locked`, `naTvgb__Note--storey|siteplan|excluded|empty`, `naTvgb__Manifest`, `naTvgb__SelectBar`, `naTvgb__MiniBtn`, `naTvgb__StoreyBlock`, `naTvgb__ReportStep__Badge--ok|error|skip|running`, `naTvgb__SettingsGroup`, `naTvgb__FieldRow`, `naTvgb__Btn--primary|danger|success`, `naTvgb__ProjectCard--linked|unlinked`, `naTvgb__SchemeRow--selected`, `naTvgb__SchemeRow__Tag--alias|empty|unrecognised`, `naTvgb__Select`, `naTvgb__TextInput`, `naTvgb__Tree__Row--target|affected`, `naTvgb__DangerZone`, `naTvgb__CheckRow`, `naTvgb__Modal__Panel`, `naTvgb__Status--info|success|error|warning`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__.rb`
*Version:* 2.8.0

Dialog lifecycle, HTML assembly, the TWO action callbacks, the Export-tab action handlers, the model status / export manifest payload builder, and the three Ruby->JS push helpers. 850 lines.

*Key symbols:* `Na__UserInterface__ShowExportDialog`, `Na__UserInterface__GenerateDialogHtml`, `Na__UserInterface__FontDirectoryUri`, `Na__UserInterface__EscapeHtml`, `Na__UserInterface__AddDialogCallbacks`, `na_tvgb_dialog_ready`, `na_tvgb_run_action`, `Na__UserInterface__HandleAction`, `Na__UserInterface__ActionExportModel`, `Na__UserInterface__ActionExportSitePlan`, `Na__UserInterface__ActionRescanModel`, `Na__UserInterface__ActionCreateTags`, `Na__UserInterface__ActionReloadPlugin`, `Na__UserInterface__ActionSetFileSelection`, `Na__UserInterface__ParseParams`, `Na__UserInterface__ApplyExportParams`, `Na__UserInterface__BuildExportReport`, `Na__UserInterface__BuildReportStep`, `Na__UserInterface__BuildIdleReport`, `Na__UserInterface__BuildModelStatus`, `Na__UserInterface__BuildFlatGroupRows`, `Na__UserInterface__BuildStoreyGroupRows`, `Na__UserInterface__BuildFileRow`, `Na__UserInterface__BuildManifestNotes`, `Na__UserInterface__EmptyModelStatus`, `Na__UserInterface__PushStatus`, `Na__UserInterface__PushReport`, `Na__UserInterface__PushModelStatus`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__ProjectActions__.rb`
*Version:* 2.9.0

Every Project-tab action, the project-aware export, and the Project-tab status payload. Returns false for an action it does not own so the main router can report it. 618 lines.

*Key symbols:* `Na__UserInterface__HandleProjectAction`, `Na__ProjectActions__Link`, `Na__ProjectActions__DismissPrompt`, `Na__ProjectActions__Unlink`, `Na__ProjectActions__SavePortalRoot`, `Na__ProjectActions__SetTargetFolder`, `Na__ProjectActions__CreateScheme`, `Na__ProjectActions__DuplicateScheme`, `Na__ProjectActions__DeleteScheme`, `Na__ProjectActions__ExportToProject`, `Na__ProjectActions__RemoveExistingGlbs`, `Na__ProjectActions__SelectedFileNames`, `Na__ProjectActions__PushToCloud`, `Na__ProjectActions__OpenPipeline`, `Na__UserInterface__BuildProjectStatus`, `Na__UserInterface__PushProjectStatus`, `Na__UserInterface__PushProjectLinkResult`, `Na__ProjectActions__PhaseCatalogue`, `Na__ProjectActions__StoredPortalRoot`, `Na__ProjectActions__BriefFor`, `@na_cloud_job`, `@na_r2_inventory`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectLink__.rb`
*Version:* 2.9.0

The model attribute dictionary that stores which project and which design phase folder this .skp belongs to. 268 lines.

*Key symbols:* `NA_PROJECT_LINK_DICT = 'Na__TrueVision__GlbBuilder__ProjectLink'`, `NA_PROJECT_CODE_PATTERN = /\A[A-Z]{2}\d{2}\z/`, `NA_PROJECT_LINK_KEYS (project_code, project_folder, project_name, project_year, portal_root, project_root, target_phase_folder, target_phase_id, linked_at, prompt_dismissed)`, `Na__ProjectLink__Read`, `Na__ProjectLink__Linked?`, `Na__ProjectLink__ShouldPrompt?`, `Na__ProjectLink__BlankLink`, `Na__ProjectLink__Write`, `Na__ProjectLink__WriteTargetPhase`, `Na__ProjectLink__DismissPrompt`, `Na__ProjectLink__Clear`, `Na__ProjectLink__ValidCode?`, `Na__ProjectLink__NormaliseCode`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json`
*Version:* no version field

Single source of truth for portal discovery, design phase folder naming, the TrueVision content folder names, the build pipeline scripts, and the Python interpreter. Hand-editable, reloaded on Reload Scripts. 87 lines.

*Key symbols:* `PortalRoots.SearchPaths`, `PortalRoots.YearFolderPattern ^(\d{2})-Projects$`, `MasterIndex.RelativePath`, `MasterIndex.ProjectConfigRel`, `TrueVisionContent.ContentFolderName = 30__TrueVision__AppContent`, `TrueVisionContent.ProjectDataFileName = TrueVision__ProjectData__.json`, `TrueVisionContent.SitePlanFolderName = SitePlan__DrawingData`, `TrueVisionContent.ArchiveFolderName = 00__Archive`, `TrueVisionContent.SkipFolderPrefixes = ['.', '00__']`, `DesignPhases[].PhaseId|Label|FolderTemplate|SupportsSchemes|Aliases|Description`, `BuildPipeline.ScriptDirRel|BuildScriptName|R2SyncScriptName|R2SyncTrueVisionArg|LauncherBatName|TimeoutSeconds`, `Python.PythonExecutable|RequiredPackages`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ProjectPortalMapper__.rb`
*Version:* 2.9.0

Portal root discovery, project-code resolution, the design phase catalogue and folder naming/alias rules, phase folder listing with GLB counts, the structure tree, create/duplicate/delete, and a pure-Ruby zip archiver. 956 lines.

*Key symbols:* `Na__PortalMapper__Config`, `Na__PortalMapper__ForceReload`, `Na__PortalMapper__ContentFolderName`, `Na__PortalMapper__ResolvePortalRoot`, `Na__PortalMapper__YearFolders`, `Na__PortalMapper__RepoRoot`, `Na__PortalMapper__ResolveProjectCode`, `Na__PortalMapper__LookupInMasterIndex`, `Na__PortalMapper__MasterIndex`, `Na__PortalMapper__ScanYearFoldersForCode`, `Na__PortalMapper__ReadProjectAdminData`, `Na__PortalMapper__DesignPhases`, `Na__PortalMapper__BuildFolderName`, `Na__PortalMapper__IdentifyPhase`, `Na__PortalMapper__NextSchemeNumber`, `Na__PortalMapper__ListPhaseFolders`, `Na__PortalMapper__DescribeFolder`, `Na__PortalMapper__PhaseFolderPath`, `Na__PortalMapper__InspectTargetFolder`, `Na__PortalMapper__BuildStructureTree`, `Na__PortalMapper__SuggestTargetFolder`, `Na__PortalMapper__CreatePhaseFolder`, `Na__PortalMapper__DuplicateScheme`, `Na__PortalMapper__DeletePhaseFolder`, `Na__PortalMapper__ArchiveFolderContents`, `Na__PortalMapper__BuildArchiveFileName`, `Na__PortalMapper__WriteZipArchive`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__PathResolver__.rb`
*Version:* 2.8.0

All plugin-internal asset paths (UI folder, the three UI files, fonts, brand logo, toolbar icons) and the file:/// URI helper. Does NOT resolve project paths. 165 lines.

*Key symbols:* `Na__PathResolver__ModulesRoot`, `Na__PathResolver__PluginRoot`, `Na__PathResolver__UiDirectory (05__Plugin__UserInterface)`, `Na__PathResolver__UiLayoutFilePath`, `Na__PathResolver__UiStylesheetFilePath`, `Na__PathResolver__UiBridgeFilePath`, `Na__PathResolver__AssetsDirectory (06__Assets)`, `Na__PathResolver__FontDirectory`, `Na__PathResolver__BrandLogoFilePath`, `Na__PathResolver__BrandLogoRemoteUrl`, `Na__PathResolver__ToolbarIconLargeFilePath`, `Na__PathResolver__ToolbarIconSmallFilePath`, `Na__PathResolver__FileUriFor`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__CloudSyncOrchestrator__.rb`
*Version:* 2.9.0

Runs ProjectVision__BuildScript__.py then the R2 sync, in the dialog's report shape. Also Python discovery, the sanitized child env, the debug log, and the .bat escape hatch. Its ORIGINAL Open3 Execute/RunR2Sync are overridden by truevision_cloud_manager.rb, which it loads at its own last line. 523 lines.

*Key symbols:* `Na__CloudSync__PushProject`, `Na__CloudSync__OpenBuildPipelineWindow`, `Na__CloudSync__RunBuildScript`, `Na__CloudSync__RunR2Sync (overridden)`, `Na__CloudSync__DescribeR2Outcome`, `Na__CloudSync__Execute (overridden)`, `Na__CloudSync__DescribeFailure`, `Na__CloudSync__MeaningfulTail`, `Na__CloudSync__ResolvePythonExecutable`, `Na__CloudSync__DiscoverAbsolutePythonExes`, `Na__CloudSync__PythonCandidateWorks?`, `Na__CloudSync__SanitizedPythonEnv`, `Na__CloudSync__PipelineConfig`, `Na__CloudSync__PythonConfig`, `Na__CloudSync__ScriptDirectory`, `Na__CloudSync__WriteDebugLog`, `Na__CloudSync__FailureReport`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\truevision_cloud_manager.rb`
*Version:* no header

Deliberate monkey-patch layer: replaces Execute and RunR2Sync with the PowerShell + result-file + Fiber approach, adds the R2 fetch/purge worker call and the non-blocking cloud job pump. 163 lines, no region banners (different house style from the rest).

*Key symbols:* `Na__CloudSync__Execute (PowerShell/result-file)`, `Na__CloudSync__Worker(link, action, extra)`, `Na__CloudSync__RunR2Sync (API auto-confirm)`, `Na__ProjectActions__CloudJob(dialog, work, complete)`, `Na__ProjectActions__FinishCloudJob`, `Na__ProjectActions__ManageR2(dialog, action, params)`, `@na_cloud_job`, `@na_r2_inventory`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\truevision_r2_worker.py`
*Version:* no version

Python adapter run by the PowerShell worker. Imports CloudflareR2__ModelSync__Main__.py as a module and either runs the sync or does a guarded per-folder fetch/purge. 99 lines.

*Key symbols:* `project_prefix(request, sync)`, `list_glbs(client, bucket, prefix)`, `manage(request, sync, client, bucket)`, `main(request)`, `sync.run_r2_sync(target_project=, dry_run_only=, auto_confirm_upload=True, sync_truevision=True, sync_planvision=False)`, `sync.load_r2_credentials`, `sync.create_r2_client`, `re.fullmatch(r'DesignPhase[A-Za-z0-9_ -]+', folder)`, `folder.startswith('DesignPhase')`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\truevision_process.ps1`
*Version:* no version

Hidden PowerShell launcher: runs one process with redirected UTF-8 stdio, 30-minute cap, writes {exit_code, stdout, stderr} to a .writing temp and atomically moves it to the result path SketchUp polls. 39 lines.

*Key symbols:* `-RequestPath`, `$request.executable|arguments|cwd|stdin|result`, `WaitForExit(1800000)`, `Move-Item -Force`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb`
*Version:* NA__SITEPLAN__EXPORTER_VERSION = 1.1.1

The site plan exporter: reads the Tags SSOT, walks the model collecting geometry by nearest site plan tag, writes linework and fill GLBs plus the manifest, and offers to delete stale files. Owns its own folder picker and message boxes. 795 lines.

*Key symbols:* `NA__SITEPLAN__CONFIG_DEFAULTS (ExportFolderName, ManifestFileName, LineworkFileSuffix, FillFileSuffix, ExportIgnoresTagVisibility)`, `NA__SITEPLAN__SCHEMA_VERSION`, `NA__SITEPLAN__OLD_FILE_PATTERN`, `NA__SITEPLAN__PREFS_SECTION 'TrueVision3D_GlbBuilder'`, `NA__SITEPLAN__PREFS_KEY_DIR 'SitePlanExportDir'`, `NA__SITEPLAN__TV_CONTENT_FOLDER`, `Na__SitePlan__LoadDataLibFile`, `Na__SitePlan__BuildLayerDefinitions`, `Na__SitePlan__Config`, `Na__SitePlan__NewBucket`, `Na__SitePlan__AddEdge`, `Na__SitePlan__AddFace`, `Na__SitePlan__Collect`, `Na__SitePlan__Scan`, `Na__SitePlan__Warnings`, `Na__SitePlan__ProjectPrefix`, `Na__SitePlan__SummaryText`, `Na__SitePlan__ChooseFolder`, `Na__SitePlan__WriteLinework`, `Na__SitePlan__WriteFill`, `Na__SitePlan__NorthAngleDeg`, `Na__SitePlan__Write`, `Na__SitePlan__Run`, `SitePlanData__SchemaVersion|ProjectPrefix|SourceModelFile|ExportedIso|ExporterVersion|TagsSsotVersion|Units|UpAxis|NorthAngleDeg|BoundsMm|Layers`, `Layer__TagName|CategoryKey|Label|Group|DrawOrder|LineworkFile|FillFile|SegmentCount|RingCount|BoundsMm|Style|VisibleAtScales|Warnings`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__ExportSelection__.rb`
*Version:* 2.10.0

Per-file export toggles persisted in the model. The exact pattern to copy for any new persisted per-model choice (e.g. Export Polygon Faces). Stores the DESELECTED names so unknown files default ON. 179 lines.

*Key symbols:* `NA_EXPORT_SELECTION_DICT = 'Na__TrueVision__GlbBuilder__ExportSelection'`, `NA_EXPORT_SELECTION_KEY = 'deselected'`, `Na__ExportSelection__DeselectedSet`, `Na__ExportSelection__Selected?`, `Na__ExportSelection__SetSelected`, `Na__ExportSelection__SetManySelected`, `Na__ExportSelection__SelectAll`, `Na__ExportSelection__Persist`, `Na__ExportSelection__PruneToKnown`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Main__.rb`
*Version:* plugin 2.10.1 per the DevLog

Module constants, the export config loader (DataLib SSOT overlaid with the local AppConfig), and the public API the loader/menu/UI call. Also the require list, whose ORDER matters. 1000+ lines.

*Key symbols:* `SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/`, `MESH_MODEL_SUFFIX = '__MeshModel__'`, `LINEWORK_MODEL_SUFFIX = '__LineworkModel__'`, `INCHES_TO_METERS = 0.0254`, `EXCLUDED_LAYER_DESCRIPTION`, `Na__ExportConfig__ForceReload`, `Na__ExportConfig__LoggingConsoleVerbose`, `Na__ExportConfig__LoggingTextFileEnabled`, `Na__PublicApi__StartExport`, `Na__PublicApi__PerformExport(export_dir, quiet:)`, `Na__PublicApi__CreateStandardisedTags`, `Na__PublicApi__RegisterToolbar`, `Na__PublicApi__ExportSitePlanData`, `require_relative 'truevision_cloud_manager' (line ~87, AFTER the orchestrator)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__DynamicReloaderPluginUtil__.rb`
*Version:* no version header

Extensions > Na__TrueVision3D menu registration and the hot reloader that Dir.globs every .rb in the modules folder. 200-ish lines.

*Key symbols:* `Na__DynamicReloader__RegisterMenu`, `Na__PublicApi__RegisterMenu`, `Na__DynamicReloader__ReloadAllScripts`, `Na__DevTools__ReloadScripts`, `menu items: 'Na__TrueVision3D__GlbBuilderUtility', 'Create Standardised Tags From Index', 'Export Site Plan Data'`, `@menu_registered`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__AppConfig__.json`
*Version:* no version field

Local plugin override of GlbBuilderConfig from the Tags SSOT. Only the Logging block is read today — the obvious home for any new plugin-level default that is not per-model. 13 lines.

*Key symbols:* `Logging.ConsoleVerbose`, `Logging.TextFileEnabled`, `Logging.TextFileNamePattern`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\CloudflareR2__ModelSync__Main__.py`
*Version:* no single version constant

The uploader. Walks the portal, builds R2 keys, compares local mtime to remote LastModified, previews, confirms, uploads. Also the whole-project --purge mode. 1513 lines.

*Key symbols:* `R2_BASE_PREFIX = 'NaProjectPortal'`, `TRUEVISION_CONTENT_FOLDER = '30__TrueVision__AppContent'`, `SITEPLAN_FOLDER_NAME = 'SitePlan__DrawingData'`, `SITEPLAN_MANIFEST_FILENAME`, `GLB_FILE_PATTERN`, `discover_model_groups`, `collect_sync_operations`, `build_r2_key(year, project_folder, content_folder, subfolder, filename)`, `build_r2_key_project_data`, `determine_action`, `upload_to_r2`, `prompt_confirmation`, `run_r2_sync(target_project, dry_run_only, auto_confirm_upload, sync_truevision, sync_planvision)`, `run_r2_purge`, `purge_project_glbs`, `--project`, `--purge`, `--tv-only`, `--dry-run-only`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\ProjectVision__BuildScript__.py`
*Version:* no single version constant

Rebuilds the master index and writes TrueVision__ProjectData__.json per project, including the single build-owned SitePlan__DataStore key. Run first on every push. 1100+ lines.

*Key symbols:* `SITEPLAN_FOLDER_NAME`, `SITEPLAN_MANIFEST_FILENAME`, `SITEPLAN_FILE_PATTERN`, `PHASE_FOLDER_PATTERN`, `discover_truevision_model_groups (skips SITEPLAN_FOLDER_NAME)`, `discover_truevision_siteplan_store`, `generate_truevision_project_data`, `write_truevision_project_data`, `SitePlan__FolderName`, `SitePlan__ManifestUrl`, `SitePlan__ExportedIso`, `SitePlan__NorthAngleDeg`, `SitePlan__BoundsMm`, `SitePlan__Layers`, `Layer__LineworkUrl`, `Layer__FillUrl`, `data['SitePlan__DataStore']`, `--qr-index-only`

### Conventions observed

- Ruby method naming: self.Na__{Module}__{PascalAction}, e.g. Na__PortalMapper__ListPhaseFolders, Na__ProjectActions__SetTargetFolder. The module token is short and never the filename.
- Ruby file naming: Na__TrueVision__GlbBuilder__{Thing}__.rb, all flat in Na__TrueVision__GlbBuilderUtility__Modules__ so the hot reloader's Dir.glob finds them. Only the three UI assets and 06__Assets sit in subfolders.
- Every file opens with a banner block: FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED / DESCRIPTION / DEPENDENCIES / DEVELOPMENT LOG, with a dated version entry per release.
- Code is organised into `# REGION | Name` ... `# endregion` blocks, with `# FUNCTION |` / `# HELPER FUNCTION | ` / `# ACTION HANDLER |` captions and a `# ---` rule under each.
- Inline rationale comments use the `# <-- reason` trailing form, right-aligned.
- Every Ruby action handler returns / pushes a hash in the report shape { success:, running:, message:, steps: [{label:, success: or status:'skip', message:}] } — the JS renders success booleans and status strings identically.
- Result hashes from helpers are always { success:, message:, ... }, never raised exceptions, and callers push message straight into the status line.
- JS is one strict-mode IIFE with private lowercase helpers na__tvgb__x and public PascalCase Na__Tvgb__X, which MUST be re-exported on `window` at the bottom of the file because the markup uses inline onclick.
- JSON payload keys: camelCase going JS -> Ruby (projectCode, targetFolder, phaseId, selectedFolder, portalRoot, typedConfirmation, permanent, cloudFolder, skipArchive, fileNames, scope, selected, downscaleTextures, materialExportMode, selectionOnly); snake_case symbols coming Ruby -> JS (project_code, target_folder, target_glb_count, folder_name, glb_count, last_written, phase_id, phase_label, scheme_number, is_alias, recognised, should_prompt, portal_found, can_export_model, can_export_site_plan).
- JSON config files are hand-editable and self-documenting: a leading "_documentation" object, aligned colons, and a "_note" string inside sub-objects.
- Manifest / project-data JSON keys use the double-underscore namespace form: SitePlanData__X, Layer__X, SitePlan__X, Camera__DefaultPosition__PosX.
- Folder naming on disk: DesignPhase{NN}__{PhaseName}__Scheme-{NN}; archives {CODE}__TrueVision__ArchivedModels__{Stage}__Archived__{dd-Mon-yyyy}.zip; GLBs {CODE}__{Base}__MeshModel__.glb / __LineworkModel__.glb; site plan {CODE}__TrueVision__SitePlan__{Layer}__LineworkModel__.glb / __FillModel__.glb.
- CSS: BEM-ish naTvgb__Block__Element--modifier, one REGION per block, property values aligned at a fixed column, colours only via --naTvgb_* tokens on :root.
- Destructive actions always: own picker + own confirm function + the shared modal + type the 4-char project code + a server-side re-check in Ruby before anything is touched.
- Nothing is renamed on disk that TrueVision might already be reading; older names are handled with an Aliases list instead.

### Extension points

**A new section on the Project tab for the Existing/Proposed site plan store, mirroring the Design Phases block**

- *Where:* Na__TrueVision__GlbBuilder__UiLayout__.html, inside <section id="tab-project">, between the "Design Phases And Schemes" div#naTvgbSchemeGroup (~280-301) and "Project Structure" (~304)
- *How:* Add a <div class="naTvgb__SettingsGroup" id="naTvgbSitePlanGroup"> with an h3 Title, a Desc paragraph, and either two naTvgb__SchemeRow-style buttons (Existing / Proposed) or a naTvgb__FieldRow + <select class="naTvgb__Select" id="naTvgbSitePlanStoreSelect" onchange="Na__Tvgb__SelectSitePlanStore()">. Render it from a new status field in na__tvgb__renderProjectCard's sibling renderers and lock it in na__tvgb__applyButtonLockState alongside naTvgbDuplicateBtn.
- *Risk:* The render functions all run from Na__Tvgb__ReceiveProjectStatus (UiBridge ~1173); a new renderer not called there will never repaint after an action.

**A new JS -> Ruby action for the store choice**

- *Where:* UiBridge: a new Na__Tvgb__SelectSitePlanStore() calling na__tvgb__dispatch('set_site_plan_store', {sitePlanStore: 'existing'|'proposed'}); plus the window export list at the bottom of the first IIFE (~1408-1442). Ruby: add `when 'set_site_plan_store' then ...` to the case in Na__UserInterface__HandleProjectAction (ProjectActions ~62-75).
- *How:* Follow Na__ProjectActions__SetTargetFolder exactly: resolve, write to the ProjectLink dictionary, then PushProjectStatus + PushStatus. The router's tail already pushes project status, which is what clears the dialog's running lock.
- *Risk:* Forget the window.* export and the inline onclick silently does nothing. Forget the status push and the whole dialog stays locked behind naTvgbState.isRunning.

**Persisting the chosen store on the model**

- *Where:* Na__TrueVision__GlbBuilder__ProjectLink__.rb — NA_PROJECT_LINK_KEYS (~50), Na__ProjectLink__BlankLink (~115), and a new Na__ProjectLink__WriteSitePlanStore beside WriteTargetPhase (~178)
- *How:* Add a key such as site_plan_store (values 'existing'|'proposed') to the frozen key list, the blank hash, and Na__ProjectLink__Clear's skip logic if it should survive an unlink.
- *Risk:* NA_PROJECT_LINK_KEYS is inside `unless defined?(NA_PROJECT_LINK_DICT)`, so a Reload Scripts will NOT pick up the new key — SketchUp must be restarted, or the guard temporarily lifted, or the change reads as 'it didn't save'.

**Folder creation and naming for the two site plan stores**

- *Where:* Na__TrueVision__GlbBuilder__ProjectPortalConfig__.json -> TrueVisionContent, plus Na__PortalMapper__ListPhaseFolders (~416 `next if entry == siteplan_name`), Na__PortalMapper__BuildStructureTree (~534-539), and a new Na__PortalMapper__SitePlanFolderPath / EnsureSitePlanFolder beside PhaseFolderPath (~460)
- *How:* Replace the single SitePlanFolderName string with a block that keeps it as the legacy/flat name and adds the two new names (e.g. SitePlanStores: {existing: 'SitePlan__DrawingData__Existing', proposed: 'SitePlan__DrawingData__Proposed', legacy: 'SitePlan__DrawingData'}). Every place that does `next if entry == siteplan_name` must skip all three, and the structure tree should show all present stores as 'aside' rows.
- *Risk:* Any site plan folder NOT skipped in ListPhaseFolders appears in the scheme list as an 'Unknown' design phase, can be picked as an export target, and can be deleted from the Danger Zone.

**Driving the site plan export into the chosen folder instead of a picker**

- *Where:* Na__UserInterface__ActionExportSitePlan(dialog) (UserInterface ~291) and Na__SitePlan__Run / Na__SitePlan__ChooseFolder (SitePlanExport ~732 / ~512)
- *How:* Give Na__SitePlan__Run an optional export_dir: keyword; when supplied, skip ChooseFolder and the two UI.messagebox prompts and return the Na__SitePlan__Write result hash rather than a bare boolean, so the dialog's report panel can show layer/file/removed counts the way BuildExportReport does. Change the action handler signature to take params_json and read the store choice from the link.
- *Risk:* Na__SitePlan__Run currently returns only true/false and reports through message boxes; the report panel therefore shows one fabricated step. Leaving it boolean wastes the whole per-layer warning set the exporter already computes.

**Marking which variant a manifest belongs to**

- *Where:* Na__SitePlan__Write's manifest hash (SitePlanExport ~671-684)
- *How:* Add a key in the existing namespace, e.g. 'SitePlanData__Variant' => 'Existing'|'Proposed' (and optionally 'SitePlanData__FolderName'), then read it in the build script's discover_truevision_siteplan_store so the published store is self-describing rather than inferred from the folder name.
- *Risk:* The build script falls back to file-name parsing when the manifest is missing or unreadable, so the variant must ALSO be derivable from the folder, not only from the manifest.

**Publishing two stores to TrueVision**

- *Where:* ProjectVision__BuildScript__.py — discover_truevision_model_groups (~395, its `if entry == SITEPLAN_FOLDER_NAME: continue`), discover_truevision_siteplan_store (~437), generate_truevision_project_data (~550, `data['SitePlan__DataStore']`), and main's call site (~1127-1133)
- *How:* Make the skip test cover every site plan folder name, call the store discovery once per variant, and publish either a keyed object (SitePlan__DataStores: {Existing: {...}, Proposed: {...}}) or keep SitePlan__DataStore for the legacy flat folder and add the new key alongside, so existing published projects keep working.
- *Risk:* If the skip is not widened, the new folders become ordinary modelGroups and TrueVision loads flat site plan linework as a 3D model group. Also note the build writes project data only when it finds at least one model group OR a site plan store.

**Uploading two stores and their manifests**

- *Where:* CloudflareR2__ModelSync__Main__.py — discover_model_groups (~345), specifically `if item.name == SITEPLAN_FOLDER_NAME and (item / SITEPLAN_MANIFEST_FILENAME).is_file()` which gates extra_files
- *How:* Widen that test to any site plan folder name so each store's manifest travels with its GLBs. The R2 key needs no change: build_r2_key already uses group['group_id'] as the subfolder, so a new folder name simply becomes a new prefix.
- *Risk:* Without widening, the GLBs upload but the manifests do not, and TrueVision reads a store whose ManifestUrl 404s.

**Making the new folders visible to the R2 fetch/purge tool**

- *Where:* truevision_r2_worker.py manage() — `if folder.startswith('DesignPhase')` in the fetch branch and `re.fullmatch(r'DesignPhase[A-Za-z0-9_ -]+', folder)` in the purge branch
- *How:* Extend both to accept the site plan folder names explicitly (an allow-list, not a loosened regex).
- *Risk:* Loosening the regex to a general pattern removes the deliberate fence that stops a purge aiming at an arbitrary prefix. Keep it an explicit allow-list.

**The Export Polygon Faces toggle**

- *Where:* UiLayout Export Options group (~107-154, the naTvgb__OptionRow pattern), na__tvgb__collectExportParams (UiBridge ~126), Na__UserInterface__ApplyExportParams (UserInterface ~399), and the fill writer Na__SitePlan__AddFace / Na__SitePlan__WriteFill (SitePlanExport ~257 / ~558)
- *How:* Add a checkbox row id naTvgbExportPolygonFaces, return it from collectExportParams as exportPolygonFaces, store it on @export_polygon_faces in ApplyExportParams, and persist it per-model using the ExportSelection dictionary pattern if it must survive the session. In the exporter, today's fill output is one LINE_LOOP primitive per ring (mode 2) with Na__SitePlanFace / Na__SitePlanRing extras — real 2D face meshes mean triangulating each face and writing mode 4 with its own accessor, probably as a third file suffix beside LineworkFileSuffix and FillFileSuffix in NA__SITEPLAN__CONFIG_DEFAULTS.
- *Risk:* The site plan action handler receives NO params today (Na__UserInterface__ActionExportSitePlan(dialog)), so a toggle collected on the Export tab never reaches the site plan exporter unless the signature and the JS dispatch are both changed. Also a new file suffix must be added to NA__SITEPLAN__OLD_FILE_PATTERN and to SITEPLAN_FILE_PATTERN in the build script or every new mesh file is treated as stale / unrecognised.

### Traps

- Load order: truevision_cloud_manager.rb deliberately OVERRIDES Na__CloudSync__Execute and Na__CloudSync__RunR2Sync. It is required last in Main.rb (~87) AND loaded again at the bottom of CloudSyncOrchestrator__.rb (~523). Anything that re-requires the orchestrator after the manager silently restores the old blocking Open3 path — the DevLog records exactly this bug.
- The dialog's running lock: naTvgbState.isRunning is set by na__tvgb__dispatch / na__tvgb__sendExportAction and is cleared ONLY by Na__Tvgb__ReceiveReport with running falsy, or by Na__Tvgb__ReceiveProjectStatus. Any new Ruby action that returns without pushing one of those leaves every button disabled until the dialog is reopened.
- Constants are frozen behind `unless defined?(...)` guards (NA_PROJECT_LINK_DICT/KEYS, NA_EXPORT_SELECTION_DICT). Reload Scripts will not refresh them, so a newly added dictionary key appears not to persist until SketchUp is restarted.
- Template substitution must use the BLOCK form of gsub. The two-argument form expands \\ and \' inside the replacement, which turns the bridge script into a SyntaxError and leaves every window function undefined — the page then looks fine and every button does nothing.
- The bridge file has TWO IIFEs. The cloud-inventory one at the end cannot see the first one's private na__tvgb__ helpers; only Na__Tvgb__Confirm, Na__Tvgb__SetStatus and Na__Tvgb__ProjectCode are published to it. New shared helpers must be published deliberately.
- Inline onclick handlers in the HTML only work for functions re-exported on window at the bottom of the first IIFE. A new function added but not exported fails silently with no console anyone is watching.
- Na__PortalMapper__ListPhaseFolders skips only ONE site plan folder name plus the '.' and '00__' prefixes. Any new folder under 30__TrueVision__AppContent immediately shows in the scheme list as an 'Unrecognised folder', is selectable as an export target, and is offered in the Danger Zone delete picker.
- ProjectVision__BuildScript__.py's discover_truevision_model_groups has its own independent `if entry == SITEPLAN_FOLDER_NAME: continue`, and CloudflareR2__ModelSync__Main__.py's discover_model_groups has its own manifest gate. Three separate places encode 'the site plan folder is called exactly this'; fixing one and not the others publishes site plan linework as a 3D model group or drops the manifest from the upload.
- The R2 fetch/purge only ever sees folders starting with 'DesignPhase' (worker fetch filter + purge regex). Site plan folders are unreachable from the Danger Zone today, so a bad site plan upload can only be cleared with the interactive whole-project --purge.
- The R2 sync never deletes. A renamed or removed local folder leaves its GLBs in the bucket forever, orphaned but still served. Renaming SitePlan__DrawingData rather than adding beside it would strand the old objects and the app could keep reading them from a cached ProjectData.
- determine_action compares LOCAL MTIME to remote LastModified, not content. A re-export that writes an identical file still uploads; a file restored from an archive with an older mtime does NOT upload.
- The site plan exporter's stale-file sweep uses NA__SITEPLAN__OLD_FILE_PATTERN and deletes via a native UI.messagebox mid-export. Running it into a project folder from the dialog will pop a modal behind the HtmlDialog. The same pattern also has to learn any new file suffix or it will offer to delete files the export just wrote.
- Na__SitePlan__Run refuses to run while a group or component is open for editing (model.active_path) and returns false — the dialog reports that as a generic failure.
- Archiving before an overwrite zips the WHOLE folder but only deletes the files the current selection will rewrite (ArchiveFolderContents only_files). A site plan store would need the same care or a partial export deletes layers it is not replacing.
- @na_cloud_job is a module-level singleton: while any R2 operation runs, Na__UserInterface__HandleProjectAction short-circuits EVERY project action with 'An R2 operation is already running'. A new action added above that guard would bypass it.
- The Fiber-based cloud job is pumped by UI.start_timer on the main thread and polls for a result file; it is not a background thread. Never call SketchUp APIs from inside the work proc other than through that pump.
- Site plan fill GLBs are LINE_LOOP ring outlines (mode 2), not filled meshes, despite the '__FillModel__' name. Do not assume a fill file already contains a face mesh.

### Open questions raised by this survey

- Adam calls it the 'Project Configurator' but the tab is labelled 'Project' (id tab-project). Is the build meant to rename the tab, or is 'Project Configurator' just his name for the existing one?
- Existing/Proposed: two sibling folders under 30__TrueVision__AppContent (SitePlan__DrawingData__Existing / __Proposed), or two subfolders INSIDE SitePlan__DrawingData? The second shape breaks every current listing loop less visibly but changes the R2 key depth, because build_r2_key takes a single subfolder segment.
- What happens to projects that already hold a flat SitePlan__DrawingData (PS01 does)? Adopt it as Existing, adopt it as Proposed, leave it as an unversioned third store, or migrate on first use?
- Is the store choice a property of the MODEL (a .skp is the existing-site model, like the design-phase link) or a property of the EXPORT (one model holding both, chosen per run)? The design-phase precedent is per-model, stored in the ProjectLink dictionary.
- Should TrueVision__ProjectData__.json gain SitePlan__DataStores (a keyed object, a schema change for the app) or keep SitePlan__DataStore for the legacy folder and add SitePlan__DataStore__Existing / __Proposed beside it? This decides how much of the TrueVision-side reader changes.
- Does 'Export Polygon Faces' replace the current LINE_LOOP fill output, or add a third file per layer (a real triangulated mesh) alongside it? A third file needs a new suffix in NA__SITEPLAN__CONFIG_DEFAULTS, NA__SITEPLAN__OLD_FILE_PATTERN, SITEPLAN_FILE_PATTERN and the manifest Layer__ keys.
- Is the polygon-faces toggle global (AppConfig / DataLib default), per-model (ExportSelection-style dictionary), or per-run (an unpersisted checkbox)? The three existing export options are per-run only and are lost when the dialog closes.
- Should the site plan export, once it can write into the project folder, also get its own Archive / Overwrite confirmation like a design phase target, and should its files be purgeable from the Danger Zone?
- Should the R2 purge allow-list be extended to site plan folders now, or deliberately left out so a site plan store can only be corrected by re-export?

---

<a id="area-6"></a>
## 6. TrueVision 3D Layout Editor — the records that persist a site plan viewport (SheetRecords / SheetModel Viewports / ScaleManager), the PDF export path, and the Viewport Settings panel's Add-Viewport flow

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY (files are edited constantly) — find everything by symbol name.

THE RECORD SPINE. A sheet is a plain object normalised by `Na__LeRec__NormaliseSheet(sheet, index)` (SheetRecords ~770). It is NOT a load-time-only gate: `Na__LeModel__GetSheets()` (SheetModel__Sheets__ ~119) calls `list.forEach(Na__LeRec__NormaliseSheet)` on EVERY read, and the autosave serialises exactly that (`AutoSave__` ~188: `JSON.stringify({ savedAt, sheets : Na__LeModel__GetSheets() })`), as does the R2 drawings-block save and the register export. `Na__LeModel__RestoreSheets` (SheetModel__ ~595) and `Na__LeModel__AnnounceRestore` (~587) normalise too. So the normaliser is the single chokepoint for every read, every save and every undo/redo restore.

THE TRAP, PRECISELY. `Na__LeRec__NormaliseViewport(viewport, defaultLayerId)` (SheetRecords ~422) MUTATES IN PLACE and never enumerates the viewport's own keys. Consequently an UNKNOWN top-level `Viewport__*` key SURVIVES a round trip untouched — it is simply never validated, defaulted, clamped or documented. The silent dropping happens one level down, inside the sub-objects the normaliser REBUILDS from literals: `Viewport__FrameMm` (X, Y, WidthMm, HeightMm), `Viewport__PanMm` (X, Y), `Viewport__ImageMm` (WidthMm, HeightMm), `Viewport__ImageOffsetMm` (X, Y), `Viewport__Styles` (an 8-key literal), `Viewport__ModelLayers` (only entries whose value is exactly `false` survive; otherwise null), and `Viewport__ProjectedEdges` via `Na__LeRec__NormaliseProjectedEdges` (~349), which rebuilds every category entry as exactly four keys. Add a fifth key to a category entry without touching that function and it vanishes on the next `GetSheets()`. Deletions are explicit and targeted: `Viewport__SitePlan` (deleted when not an object), `Viewport__ImageZoom` (deleted when 1), `Viewport__ShowFrame` (deleted unless `=== false`), `Viewport__ClosedDoors` (deleted when the cleaned list is empty).

`Viewport__SitePlan` is the friendliest extension point in the whole record: `Na__LeRec__IsSitePlanViewport` (~413) only tests "is a non-array object", and the normaliser does `viewport.Viewport__SitePlan = Object.assign({}, viewport.Viewport__SitePlan)` — a shallow copy, so ANY key inside it survives save/load without a normaliser change. It is still worth adding real normalisation (a source enum, defaults) because nothing validates it today. It is read in exactly six places: the normaliser; `Na__LeModel__ResolveViewportSource` (SheetModel__Viewports__ ~326, returns `{kind:'2d', scene:null, plan:null, elevation:null, sitePlan, label}`); `Na__LeModel__CreateViewport`'s `opts.sitePlan`; `Na__LeSource__Resolve` (`ModelSource__` ~192, a site plan viewport has no design phase); `Panel__ModelLayers__` ~294 (empty-state wording); and `Na__LeViewText__`/`ViewportIdentity__` ~219/~247.

SCALE. `Na__LeScale__Coerce(denominator, sitePlan)` (ScaleManager ~97) picks the site plan list when `sitePlan === true`, else the architectural list, and falls back to that list's default. It is called from exactly two places: `Na__LeRec__NormaliseViewport` (~454) and `Na__LeModel__UpdateViewport` (~296), both passing `Na__LeRec__IsSitePlanViewport(viewport)`. The site plan list is `LayoutEditor__Scales__SitePlanScaleDenominators: [500, 1250]` with `SitePlanDefaultScaleDenominator: 500`, surfaced by `Na__LeCfg__GetScaleSetup()` (ConfigState__SheetSetup__ ~281) as `sitePlanDenominators` / `sitePlanDefaultDenominator`, wrapped by `Na__LeScale__SitePlanSetup()` (~74, hard fallback `[500,1250]`). At PAINT time the denominator is read raw off the record — never via Coerce — by `Na__LeVp2d__Window(viewport)` (Viewport2d__Window__ ~83: `const D = viewport.Viewport__ScaleDenominator`), which returns `win.Denominator`, `win.OriginX/OriginY`, and the ToPaper/FromPaper mappings. Both the screen painter and the PDF exporter divide model mm by `win.Denominator`.

PDF. `Na__LePdf__BuildDocument` (PdfExporter ~341) opens jsPDF in mm at true paper size with `compress:true`, installs Open Sans, draws the classic scan, then each viewport back-to-front, then sheet markup and chrome. A site plan viewport takes its own branch in `Na__LePdf__DrawViewport` (~274): `await Na__LeVp2d__SitePlanDrawing(viewport)` → `Na__LePdf__DrawSitePlanFills(doc, viewport, described, drawing.fills)` → `Na__LePdf__DrawLinework(...drawing.classes)`. The fill helper (~246) walks `fill.rings` and SKIPS any ring where `ring.outer` is falsy — that is the "outer rings only, holes not cut out on paper" behaviour; on screen `Na__LeVp2d__RingPathData` emits every ring into one even-odd path so holes DO cut out. Each surviving ring is pushed through `Na__LeChrome__PushPolyline(primitives, points, null, 0, fill.hex, true, null, { fillOpacity : fill.opacity })` and drawn by `Na__LeChrome__DrawToPdf`. Alpha comes from `Na__LeChrome__WithOpacity` (SheetChrome ~658): when either alpha < 1 and the build supports it, `doc.saveGraphicsState(); doc.setGState(new doc.GState({'opacity':fillAlpha,'stroke-opacity':strokeAlpha})); draw(); doc.restoreGraphicsState()`.

PANEL. `Na__LePanelViewport__Build` (Panel__ViewportSettings ~293) builds BOTH add blocks into the body and `Na__LePanelViewport__Refresh` (~435) shows one: `[data-na-block="add-scene"]` for architectural sheets, `[data-na-block="add-siteplan"]` when `Na__LeModel__IsSitePlanSheet(sheet)`. The site plan block is Scale-select + "Add Site Plan Viewport" + a status note driven by `Na__SpStore__GetStatus()/GetDescriptor()`. `Na__LePanelViewport__AddSitePlan(sheet, denominator)` (~247) resolves the store, coerces the scale onto the site plan list, builds an `off` map from `layer.Layer__VisibleAtScales`, creates the viewport with `{ kind:'2d', sitePlan:{}, scaleDenominator, modelLayers:off, name, rect }`, then pans it onto `Na__SpStore__GetFocusBoundsMm()` with a silent update and selects it.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js`
*Version:* DEVELOPMENT LOG head: 19-Sep-2026 - Version 1.22.0

Namespace Na__LeRec. THE normaliser file - every sheet/viewport/shape/leader record shape and its defaults. 1095 lines. The single gate every new persisted key must pass.

*Key symbols:* `Na__LeRec__NormaliseSheet(sheet, index) ~770`, `Na__LeRec__NormaliseViewport(viewport, defaultLayerId) ~422`, `Na__LeRec__NormaliseProjectedEdges(block) ~349`, `Na__LeRec__NormaliseCompositeWeights(block) ~397`, `Na__LeRec__IsSitePlanViewport(viewport) ~413`, `Na__LeRec__IsSitePlanSheet(sheet) ~762`, `Na__LeRec__NormaliseLayer ~325`, `Na__LeRec__NormaliseShape ~627`, `Na__LeRec__NormaliseLeader ~656`, `Na__LeRec__NormaliseDimension ~567`, `Na__LeRec__NormaliseAnnotation ~548`, `Na__LeRec__NormaliseGroup ~700`, `Na__LeRec__NormaliseMarginNotes ~727`, `Na__LeRec__BuildFields(sheet) ~1016`, `Na__LeRec__DefaultLayerId(sheet, type) ~839`, `Na__LeRec__NextId ~280`, `Na__LeRec__Num ~294`, `Na__LeRec__Unit ~302`, `Na__LeRec__Find ~310`, `Na__LeRec__KIND_2D = '2d'`, `Na__LeRec__KIND_3D = '3d'`, `Na__LeRec__LAYER_TYPES = ['viewport','annotation','dimension','vector','mixed']`, `Na__LeRec__STYLE_KEYS (8 style flags)`, `Na__LeRec__DRAWING_ARCHITECTURAL = 'architectural'`, `Na__LeRec__DRAWING_SITEPLAN = 'siteplan'`, `Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__' ~268`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js`
*Version:* 19-Sep-2026 - Version 1.1.0

Namespace Na__LeModel. Viewport CRUD unit of the sheet model (377 lines). CreateViewport/UpdateViewport are the only sanctioned write paths; UpdateViewport is where a new patch key must be accepted.

*Key symbols:* `Na__LeModel__CreateViewport(sheet, options) ~180 - options {kind, sceneId, drawingId, name, rect, scaleDenominator, modelSourceId, sitePlan, modelLayers}`, `Na__LeModel__UpdateViewport(sheet, viewportId, patch, silent) ~249 - patch keys: rect, pan, imageMm, imageOffset, imageZoom, styles, modelLayers, projectedEdges, compositeWeights, scaleDenominator, markupMode, name, layerId, sceneId, drawingId, kind, showScaleLabel, showFrame, closedDoors, locked, snapshotAsset, modelSourceId`, `Na__LeModel__ResolveViewportSource(viewport) ~325`, `Na__LeModel__IsSitePlanViewport(viewport) ~169`, `Na__LeModel__InsertViewport(sheet, record, silent) ~212`, `Na__LeModel__DeleteViewport ~228`, `Na__LeModel__GetViewportById ~161`, `Na__LeModel__GetViewports ~153`, `Na__LeModel__RegisterViewportNamer(namer) ~123`, `Na__LeModel__DerivedViewportName ~132`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__ScaleManager__.js`
*Version:* 17-Sep-2026 - Version 1.2.0

Namespace Na__LeScale. 217 lines. Paper-mm <-> model-mm at a locked denominator, the two scale lists, and the title block's Scale cell label.

*Key symbols:* `Na__LeScale__Coerce(denominator, sitePlan) ~97`, `Na__LeScale__SitePlanSetup() ~74 (private; fallback [500,1250])`, `Na__LeScale__ListDenominators(sitePlan) ~85`, `Na__LeScale__IsListed(denominator) ~108`, `Na__LeScale__Next(denominator) ~118 (architectural list ONLY - does not know site plan)`, `Na__LeScale__PaperToModelMm ~128`, `Na__LeScale__ModelToPaperMm ~136`, `Na__LeScale__FormatLabel(denominator) ~144`, `Na__LeScale__PaperSuffix ~159`, `Na__LeScale__SheetLabel(denominators, paperLabel) ~181`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js`
*Version:* 17-Sep-2026 - Version 1.5.0 (TrueVision)

Namespace Na__LePdf. 415 lines. One sheet to one jsPDF page in paper mm. Site plan fills + linework take a dedicated branch.

*Key symbols:* `Na__LePdf__BuildDocument(sheet, options) ~341`, `Na__LePdf__DrawViewport(doc, sheet, viewport, options) ~268 (site plan branch ~274)`, `Na__LePdf__DrawSitePlanFills(doc, viewport, described, fills) ~246`, `Na__LePdf__DrawLinework(doc, sheet, viewport, described, classes) ~203`, `Na__LePdf__BeginClip / Na__LePdf__EndClip ~177/~186`, `Na__LePdf__Offset ~161`, `Na__LePdf__Rgb ~194`, `Na__LePdf__Filename ~320`, `Na__LePdf__ExportSheet(sheet, showToast, options) ~379`, `Na__LePdf__LoadLibrary ~127`, `Na__LePdf__EnsureJsPdf ~145`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js`
*Version:* 14-Sep-2026 - Version 1.7.0

Namespace Na__LePanelViewport. 666 lines. The right-column Viewport section: two Add blocks (scene / site plan) and the selected-viewport editor.

*Key symbols:* `Na__LePanelViewport__Build(body) ~293`, `Na__LePanelViewport__Refresh(body) ~435`, `Na__LePanelViewport__AddSitePlan(sheet, denominator) ~247`, `Na__LePanelViewport__Add(sheet, sceneId, modelSourceId) ~224`, `Na__LePanelViewport__Describe(sceneId) ~208`, `Na__LePanelViewport__SceneOptions() ~185`, `Na__LePanelViewport__ExportDate(iso) ~277`, `Na__LePanelViewport__Current() ~556`, `Na__LePanelViewport__Register() ~566`, `Na__LePanelViewport__ID = 'viewport'`, `Na__LePanelViewport__EDIT_EVENT = 'na-layouteditor-request-drawing'`, `control ids: vp-add-siteplan-scale, vp-add-siteplan, vp-add-scene, vp-add-source, vp-scale, vp-name, vp-layer, vp-raster`, `block ids: data-na-block add | add-scene | add-siteplan | siteplan-note | edit | scale | scale-siteplan | pan | zoom | markup | doors | actions2d`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js`
*Version:* 15-Sep-2026 - Version 1.0.0

TrueVision-only. 319 lines. Builds the classes + fills a site plan viewport draws and paints them as SVG; the PDF reads the same build through Na__LeVp2d__SitePlanDrawing.

*Key symbols:* `Na__LeVp2d__SitePlanDrawing(viewport) ~173 -> { classes, fills, key }`, `Na__LeVp2d__SitePlanBuild(viewport, allowMissing) ~140`, `Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm) ~202`, `Na__LeVp2d__RingPathData(rings) ~186 (even-odd, ALL rings)`, `Na__LeVp2d__FillSitePlan ~236`, `Na__LeVp2d__RefillSitePlan ~290`, `Na__LeVp2d__SitePlanToken ~113`, `Na__LeVp2d__SitePlanPaintKey ~122`, `fill record shape: { categoryKey, hex, opacity, rings }`, `ring shape: { face, outer, points [x,y,...] }`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`

Namespace Na__SpStore. 494 lines. THE single R2/CDN store for site plan layers. This is the file the existing-vs-proposed two-store feature must be built in - today it is a singleton with one descriptor and one folder.

*Key symbols:* `Na__SpStore__FolderUrls() ~145 - builds {local, cdn} from `${year}-Projects/${projectFolder}/30__TrueVision__AppContent/SitePlan__DrawingData``, `Na__SpStore__Find() ~282 (local manifest -> project data block -> CDN manifest)`, `Na__SpStore__Resolve() ~334`, `Na__SpStore__Reload() ~362`, `Na__SpStore__LoadLayer(categoryKey) ~384`, `Na__SpStore__LoadAll() ~434`, `Na__SpStore__Describe(raw, source, folderUrls) ~261`, `Na__SpStore__Layer(raw, source, folderUrls) ~234`, `Na__SpStore__Style(raw) ~215`, `Na__SpStore__GetDescriptor / GetLayers / GetLayerData / GetStatus / GetNote / GetFocusBoundsMm ~445-459`, `Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed'`, `Na__SpStore__DATA_KEY = 'SitePlan__DataStore'`, `Na__SpStore__FOLDER = 'SitePlan__DrawingData'`, `Na__SpStore__MANIFEST = 'TrueVision__SitePlanData__Manifest__.json'`, `Na__SpStore__CDN_BASE = 'https://cdn.noble-architecture.com/NaProjectPortal'`, `Na__SpStore__RED_LINE_KEY = 'TrueVision__SitePlan__RedLineBoundary'`, `Na__SpStore__SCHEMA = 1`, `statuses: idle | loading | ready | empty`, `descriptor keys: SitePlan__Source, SitePlan__ExportedIso, SitePlan__NorthAngleDeg, SitePlan__BoundsMm, SitePlan__Layers`, `layer keys: Layer__CategoryKey, Layer__TagName, Layer__Label, Layer__Group, Layer__DrawOrder (default 50), Layer__LineworkUrl, Layer__FillUrl, Layer__Style, Layer__VisibleAtScales, Layer__SegmentCount, Layer__BoundsMm`, `style keys: LineColourId, LineHex, LineType, LineWeightMm, FillColourId, FillHex, FillOpacity`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js`

Namespace Na__LeEdge. Owns the Viewport__ProjectedEdges field name and the per-category override arithmetic. Fill overrides must be added HERE as well as in the normaliser.

*Key symbols:* `Na__LeEdge__FIELD = 'Viewport__ProjectedEdges' ~96`, `Na__LeEdge__CAT_FIELD = 'Edges__Categories' ~97`, `Na__LeEdge__SITEPLAN_PREFIX = 'TrueVision__SitePlan__' ~98`, `Na__LeEdge__SitePlanDefault(categoryKey) ~363`, `Na__LeEdge__Default(categoryKey) ~381`, `Na__LeEdge__Effective(viewport, categoryKey) ~411 -> {weight, colour, lineType, hex, patternMm, overridden}`, `Na__LeEdge__Patch(viewport, categoryKey, label, part, value) ~448 (part = 'weight'|'colour'|'lineType')`, `Na__LeEdge__ResetPatch(categoryKey) ~472`, `Na__LeEdge__Token(viewport) ~485`, `Na__LeEdge__OverrideCount ~500`, `Na__LeEdge__Stored(viewport) ~398`, `Na__LeEdge__IsLoaded ~181`, `Na__LeEdge__ClampWeight ~327`, `Na__LeEdge__IsColour ~314`, `Na__LeEdge__IsLineType ~318`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\10__Core__SheetSurface\Na__LayoutEditor__SheetChrome__.js`

Namespace Na__LeChrome. The sheet primitive list and its two painters (SVG and jsPDF). Any new PDF paint (a hatch) either becomes a primitive here or is drawn directly by the exporter.

*Key symbols:* `Na__LeChrome__PushPolyline(list, points, strokeColour, strokeMm, fillColour, closed, gradient, extra) ~312 - extra = {dashMm, dashArray, fillOpacity, strokeOpacity}`, `Na__LeChrome__WithOpacity(doc, fillAlpha, strokeAlpha, draw) ~658 - the ONLY GState alpha in the app`, `Na__LeChrome__ToPdf(doc, primitive, style) ~692`, `Na__LeChrome__DrawToPdf`, `Na__LeChrome__Build(layout, sheet, opts)`, `Na__LeChrome__Alpha(value) ~295`, `Na__LeChrome__Rgb ~640`, `Na__LeChrome__PdfRunWidth ~682`, `Na__LeChrome__PushText ~327`, `Na__LeChrome__PushImage`, `primitive kinds: rect | line | polyline | text | image | group`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__GradientTool__.js`

The working precedent for printing something jsPDF has no native primitive for: clip to the shape path, then addImage a PNG. A hatch pattern should copy this shape exactly.

*Key symbols:* `Na__LeGrad__DrawPdf(doc, points, gradient) ~532 - doc.lines(rel, x, y, [1,1], null, true); doc.clip(); doc.discardPath(); doc.addImage(png, 'PNG', ...) inside save/restoreGraphicsState`, `Na__LeGrad__StripPng`, `Na__LeGrad__Normalise`, `Na__LeGrad__SvgPaint`, `Na__LeGrad__Axis`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\90__System__PageLayoutSystem\01__Dependencies__VersionLocked\jspdf.umd.js`
*Version:* 4.1.0

THE VENDORED jsPDF. Version 4.1.0, built 2026-02-02, 1,201,403 bytes, UNMINIFIED UMD. NOT in 04__Lib__ThirdParty__VersionLocked (that folder holds only three.js 0.184.0, three-mesh-bvh 0.9.9, clipper2js 0.9.0, three-edge-projection 0.0.10). Loaded by path from config, not by import map.

*Key symbols:* `API.GState / API.setGState ~ (used by Na__LeChrome__WithOpacity)`, `API.TilingPattern(boundingBox, xStep, yStep, gState, matrix) ~1058 / API.TilingPattern ~2198`, `API.beginTilingPattern(pattern) ~2222 - calls advancedApiModeTrap`, `API.endTilingPattern(key, pattern) ~2237 - calls advancedApiModeTrap`, `API.addPattern(key, pattern) ~2210`, `API.ShadingPattern / API.addShadingPattern ~2210`, `API.fill(pattern) ~4429, API.fillEvenOdd ~4445, API.fillStroke ~4460, API.fillStrokeEvenOdd ~4475 -> fillWithOptionalPattern ~4478`, `API.advancedAPI(body) ~1274 / API.compatAPI(body) ~1298`, `API.clip(rule) ~4308`, `doc.setLineDashPattern, doc.lines, doc.addImage, doc.rect, doc.line, doc.discardPath`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__AppConfig__.json`

The Layout Editor's whole config. Scale lists and the jsPDF path live here.

*Key symbols:* `LayoutEditor__Scales__Config ~154`, `LayoutEditor__Scales__AvailableScaleDenominators: [20, 50, 100] ~156`, `LayoutEditor__Scales__DefaultScaleDenominator: 50 ~157`, `LayoutEditor__Scales__SitePlanScaleDenominators: [500, 1250] ~158`, `LayoutEditor__Scales__SitePlanDefaultScaleDenominator: 500 ~159`, `LayoutEditor__Scales__ScaleLabelPrefix: "1:" ~160`, `LayoutEditor__Scales__NotToScaleLabel: "NTS" ~161`, `LayoutEditor__Pdf__JsPdfScriptPath: "./02__Src__AppModules/90__System__PageLayoutSystem/01__Dependencies__VersionLocked/jspdf.umd.js" ~467`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\03__Core__Config\Na__LayoutEditor__ConfigState__SheetSetup__.js`

Turns the AppConfig JSON into the setup objects the code reads.

*Key symbols:* `Na__LeCfg__GetScaleSetup() ~281 -> {denominators, defaultDenominator, sitePlanDenominators, sitePlanDefaultDenominator, labelPrefix, notToScaleLabel, sheetShowPaperSize, sheetScaleSeparator, sheetPaperJoiner, sheetPaperPrefix, sheetMaxScales, sheetMixedLabel}`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Window__.js`

Where the scale denominator is consumed at paint time.

*Key symbols:* `Na__LeVp2d__Window(viewport) ~83 -> {CentreX, CentreY, WidthMm, HeightMm, OriginX, OriginY, Denominator, Frame, ToLocal, ToPaper, FromPaper}`, `Na__LeVp2d__Describe(viewport) ~105 -> {window, definition, modelSource, ...}`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js`

Turns classes + owners into styled bands; the PDF and the screen share it.

*Key symbols:* `Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden) ~236 -> [{className, colour, widthMm, dashMm, indices}]`, `Na__LeVp2d__BandPaths(key, bands, classes)`, `Na__LeVp2d__StyleToken(viewport)`, `Na__LeVp2d__StrokeRules ~(private)`, `Na__LeVp2d__CLASS_ORDER`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Sheets__.js`

Where NormaliseSheet is actually invoked on every read - proves the normaliser is the save gate.

*Key symbols:* `Na__LeModel__GetSheets() ~119 (forEach NormaliseSheet, then sort by Sheet__Order)`, `Na__LeModel__IsSitePlanSheet ~(near 136)`, `Na__LeModel__CreateSheet ~(NormaliseSheet ~225)`, `Na__LeModel__UpdateSheet ~(NormaliseSheet ~285)`, `Na__LeModel__RenumberSheets`, `Na__LeModel__TabGroup`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__AutoSave__.js`

Serialises GetSheets() verbatim to the browser draft; no key whitelist anywhere.

*Key symbols:* `localStorage.setItem(key, JSON.stringify({ savedAt, sheets : Na__LeModel__GetSheets() })) ~188`, `Na__LeAuto__Same ~178`, `Na__LeAuto__ClearDraft ~330`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanDrawings__.md`

The existing plan doc. Section 8.4 already specifies the fill-override design; section 13 is the live ledger (Phases 0-5 done, Phase 6 in progress).

*Key symbols:* `8.4 Site plan viewport ~589 - 'Fills / Overrides: Per-viewport fill colour and opacity join the Viewport__ProjectedEdges category record. Its normaliser rebuilds entries, so the two fields must be added there.'`, `8.4 'In the PDF, outer rings ... holes are not cut out yet'`, `8.6 Later - site plan sheet furniture ~652`, `13 Progress ledger ~744`

### Conventions observed

- Namespacing: every module has a NAMESPACE header line and prefixes every symbol with it - Na__LeRec__, Na__LeModel__, Na__LeScale__, Na__LePdf__, Na__LeChrome__, Na__LeEdge__, Na__LeVp2d__, Na__SpStore__, Na__LePanelViewport__, Na__LeCfg__, Na__LeComposite__, Na__LeModelLayers__.
- Record key naming: <Entity>__<Field> in PascalCase - Sheet__Viewports, Viewport__FrameMm, Viewport__ScaleDenominator, Layer__CategoryKey, Category__EdgeColour, Asset__PixelWidth, SitePlan__Layers. Sub-blocks get their own prefix (Edges__Categories, Edges__UpdatedIso).
- Units live in the key name: ...Mm for paper/drawing millimetres, ...Pt for printed points, ...Deg, ...Iso for an ISO timestamp.
- THE HOUSE RULE FOR A NEW PERSISTED KEY: store dissent, never consent. A key is written only when it differs from the default and is DELETED when it comes back to the default, so every record written before the feature is byte-identical after a load. See Viewport__ShowFrame (kept only when false), Viewport__ImageZoom (deleted when 1), Viewport__ClosedDoors (deleted when empty), Sheet__DrawingType (only ever 'siteplan'), Viewport__ModelLayers (only entries that are false).
- A stored override entry is written out SELF-DESCRIBING - label and every value - so a project file can be read without the config (see NormaliseProjectedEdges' four Category__* keys and Edges__Description).
- Pruning waits for its config: NormaliseProjectedEdges only deletes a default-valued entry when Na__LeEdge__IsLoaded() is true, and NEVER prunes a key beginning 'TrueVision__SitePlan__' because that default arrives with the data, not the config.
- Config: one JSON per feature, keys shaped LayoutEditor__<Block>__<Field>, always with a sibling ...__Description or ...__Note string explaining the block in prose. A getter in ConfigState__*Setup__.js turns them into a camelCase setup object with hard-coded fallbacks.
- UI: panels register with Na__LePanels__RegisterSection('right'|'left', {id, title, build, refresh}); build() creates BOTH states and refresh() hides one with el.hidden; controls are addressed by data-na-control="<id>" and blocks by data-na-block="<id>"; handlers bind through Na__LePanels__OnControl(event, controlId, fn) with the third arg being data-na-role.
- Every module carries a fixed header (FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED, DESCRIPTION, INTEGRATION, PORT NOTE with Ported from / Parity / Divergences / Back-port, then a DEVELOPMENT LOG newest-first with a semantic version per entry). TrueVision-only features say 'Ported from: none (TrueVision-only)'.
- Region banners: '// ----- REGION | Name' ... '// endregion -----', and each function preceded by '// FUNCTION | Title' or '// HELPER FUNCTION | Title' with a dashed rule under it. Explanatory prose goes in ALL-CAPS-led comment paragraphs above the code, and trailing '// <-- ...' notes on single lines.
- One writer per record: UI never mutates a record directly, it calls Na__LeModel__UpdateViewport / UpdateSheet with a patch object whose keys are lowerCamelCase aliases of the Viewport__* fields, and the model re-normalises afterwards.
- Silent writes: pass silent=true to UpdateViewport/InsertViewport during a live drag; it sets the dirty flag via Na__LeModel__AssignDirty and skips the change event (one undo step on release).

### Extension points

**Any new per-viewport persisted key (e.g. a render-composite mode, a pattern id, a source store id)**

- *Where:* Na__LayoutEditor__SheetRecords__.js -> Na__LeRec__NormaliseViewport (~422); plus Na__LayoutEditor__SheetModel__Viewports__.js -> Na__LeModel__UpdateViewport (~249) for the patch alias and Na__LeModel__CreateViewport (~180) for the create option
- *How:* Add an explicit clause in NormaliseViewport that coerces the value and DELETES the key when it is the default; add `if (patch.<alias> !== undefined) viewport.Viewport__<Key> = ...` in UpdateViewport before the trailing Na__LeRec__NormaliseViewport call; add to the CreateViewport literal if a new viewport should carry it. Export nothing new unless a reader outside the record file needs it.
- *Risk:* A top-level Viewport__ key actually SURVIVES without a normaliser change (the normaliser never enumerates keys), which makes it easy to ship a key that is never validated, never clamped and never defaulted - it will then differ between a fresh create and a restored draft. Worse, a key placed INSIDE Viewport__FrameMm / PanMm / ImageMm / ImageOffsetMm / Styles / ModelLayers / ProjectedEdges is silently destroyed on the very next GetSheets().

**Per-category FILL colour + opacity overrides on a site plan viewport**

- *Where:* Na__LeRec__NormaliseProjectedEdges (SheetRecords ~349) AND Na__LeEdge__Effective (~411) / Na__LeEdge__Patch (~448) / Na__LeEdge__Token (~485) in Na__LayoutEditor__EdgeStyles__.js
- *How:* The plan doc already specifies this (section 8.4 'Fills / Overrides'). Add e.g. Category__FillColour and Category__FillOpacity to the `kept[key] = { ... }` literal in NormaliseProjectedEdges, extend the prune test (`weight === ... && colour === ... && lineType === ...`) with the two new fields so an entry that is back to default is still dropped, give Na__LeEdge__SitePlanDefault a fill default read from layer.Layer__Style.FillHex / FillOpacity, return fill in Na__LeEdge__Effective, accept part='fillColour'|'fillOpacity' in Na__LeEdge__Patch, and include the fields in Na__LeEdge__Token so cached paints re-key. Then read the effective fill in Na__LeVp2d__SitePlanBuild instead of data.layer.Layer__Style directly.
- *Risk:* NormaliseProjectedEdges REBUILDS every entry from a four-key literal - forget it and the overrides disappear on the next read with no error. The prune is also skipped for any key starting 'TrueVision__SitePlan__', so a site plan fill override is never auto-dropped and will bloat the file unless the prune is extended deliberately.

**The 'viewports at 1:500 or coarser are Location Plans, proposal fill only' rule**

- *Where:* It is a DERIVED READ, not a stored key. Put the predicate in Na__LayoutEditor__ScaleManager__.js beside Na__LeScale__Coerce (~97) - e.g. Na__LeScale__IsLocationPlan(denominator) - and consume it in Na__LeVp2d__SitePlanBuild (Viewport2d__SitePlan__ ~140) where the fills array is assembled, and in Na__LePdf__DrawSitePlanFills (PdfExporter ~246) if the exporter ever stops going through SitePlanDrawing.
- *How:* ScaleManager already owns both lists and is a config leaf imported by SheetRecords, SheetModel__Viewports, Panel__ViewportSettings and PdfExporter, so a new predicate there reaches every caller with no cycle. Read the denominator the same way paint does: viewport.Viewport__ScaleDenominator (or win.Denominator from Na__LeVp2d__Window). Do NOT store a 'isLocationPlan' flag on the record - the existing naming convention already derives 'Location Plan' vs 'Block Plan' from `d >= 1000` in Panel__ViewportSettings (~263 and ~311), and two sources of truth would drift.
- *Risk:* `d >= 1000` is currently hard-coded twice in the panel (the Add name and the Add scale label). A new threshold rule must replace both or the viewport will be NAMED Block Plan while behaving as a Location Plan. Also note Na__LeScale__Next (~118) reads ONLY the architectural list, so a coarse-scale toggle path must not go through it.

**Site plan SOURCE selector (existing vs proposed store) on Add Viewport**

- *Where:* UI: Na__LePanelViewport__Build (~306-318, the data-na-block="add-siteplan" block, beside the vp-add-siteplan-scale select) and Na__LePanelViewport__Refresh (~450-462). Flow: Na__LePanelViewport__AddSitePlan(sheet, denominator) ~247. Record: Viewport__SitePlan (e.g. SitePlan__Source: 'existing' | 'proposed'). Data: Na__SitePlan__Store__ FolderUrls (~145) / Find (~282) / Resolve (~334) / GetDescriptor / GetLayerData.
- *How:* Add a `vp-add-siteplan-source` select in the add block and a matching row in the edit block (hidden unless isSitePlan), give AddSitePlan a source argument and write it into the `sitePlan : { SitePlan__Source : source }` object passed to Na__LeModel__CreateViewport (Viewport__SitePlan is shallow-copied by the normaliser, so the key survives immediately - but add explicit coercion/default there anyway). Then key the store by source: Na__SpStore__FolderUrls must take a source and append the folder, and the module's single Descriptor/Status/LayerData/LayerPromises singletons must become per-source maps. Every caller of Na__SpStore__GetDescriptor / GetLayers / GetLayerData / GetStatus / GetFocusBoundsMm / Resolve / LoadAll must then pass the viewport's source.
- *Risk:* Na__SitePlan__Store__ is a hard singleton (Na__SpStore__Descriptor, Na__SpStore__Status, Na__SpStore__LayerData, Na__SpStore__LayerPromises, Na__SpStore__Generation). Adding a second store without splitting these means the second folder's layers overwrite the first's under the same Layer__CategoryKey. Na__LeEdge__SitePlanDefault also looks a category key up in Na__SpStore__GetLayers() with no viewport context, so two stores sharing a key would resolve the wrong default style. Also Na__LeVp2d__SitePlanToken uses only descriptor.SitePlan__ExportedIso - two stores need the source in the token or the repaint guard will keep a stale paint.

**Per-layer Z-INDEX / draw order (1..10)**

- *Where:* Na__SitePlan__Store__ already reads Layer__DrawOrder (default 50) and sorts descriptor.SitePlan__Layers by it in Na__SpStore__Describe (~267). Paint order: Na__LeVp2d__SitePlanBuild (~140) concatenates layers in that order into ONE classes.visible array, and Na__LeVp2d__PaintSitePlan (~202) draws all fills first, then all bands.
- *How:* A new 1..10 hierarchy should map onto the existing Layer__DrawOrder rather than adding a key, or be exported as a new manifest field that Na__SpStore__Layer normalises into Layer__DrawOrder. To make it actually control paint order the painter must change: today fills are ALL drawn before ANY linework, so a higher layer's fill cannot cover a lower layer's lines. Interleaving means emitting fill+lines per layer (and, in the PDF, calling DrawSitePlanFills and DrawLinework per layer rather than once each).
- *Risk:* StyleBands buckets segments by OWNER STYLE, not by layer, and sorts nothing - band order comes from Na__LeVp2d__CLASS_ORDER and bucket insertion order, so 'linework Z order' is not currently expressible at all. Also, the concatenated Float32Array + Uint16Array owner table is built once per repaint key, so a per-layer split changes the snap source (state.classes) that Na__LeVp2d__GetSnapSource reads.

**Printing a repeating SVG hatch pattern**

- *Where:* Na__LayoutEditor__PdfExporter__.js -> Na__LePdf__DrawSitePlanFills (~246), following the precedent in Na__LayoutEditor__GradientTool__.js -> Na__LeGrad__DrawPdf (~532)
- *How:* Three concrete options, in order of risk. (1) VECTOR HATCH (recommended): clip to the ring path exactly as DrawSitePlanFills already builds it, then emit the hatch as real doc.line() strokes computed in paper mm - same code path as Na__LePdf__DrawLinework, prints crisp at any zoom, no library features needed. (2) RASTER TILE: rasterise one tile to a PNG at export DPI, tile it into a canvas covering the ring bounds, clip and doc.addImage(png,'PNG',...) - this is exactly Na__LeGrad__DrawPdf's proven shape (doc.lines(rel,x,y,[1,1],null,true); doc.clip(); doc.discardPath(); addImage; inside save/restoreGraphicsState). It must be a PNG data URL, never raw 'RGBA'. (3) TRUE PDF TILING PATTERN: jsPDF 4.1.0 does expose API.TilingPattern, API.beginTilingPattern, API.endTilingPattern, API.addPattern and API.fill(pattern) - but beginTilingPattern/endTilingPattern call advancedApiModeTrap, so the whole sequence must run inside doc.advancedAPI(...), where the coordinate system and the paint operators differ from the compat mode the rest of the exporter uses.
- *Risk:* Option 3 switches API mode for the whole callback; every other draw in this exporter assumes compat mode with y-down mm, so mixing them mid-page will silently misplace geometry. Option 2 hits the known trap that this jsPDF build's raw 'RGBA' addImage path DROPS the alpha channel (documented in Na__LayoutEditor__GradientTool__Config__.json's Meta__WhyThePdfIsAStrip) - a PNG data URL is mandatory. Any option must respect Na__LePdf__BeginClip already being open around the whole viewport, and must restore the graphics state or everything after it is clipped.

**'Export Polygon Faces' writing 2D face meshes, and how they reach the viewport**

- *Where:* Consumer side: Na__SitePlan__GlbParse__.js -> Na__SpGlb__ParseFill(buffer) ~320, returning { rings: [{ face, outer, points [x,y,...] }], ringCount, boundsMm }; ring.outer comes from the GLB extra `Na__SitePlanRing === 'outer'` (a ring with no tag counts as outer). Store side: Na__SpStore__Layer's Layer__FillUrl / Layer__FillFile (~248) and Na__SpStore__LoadLayer (~398).
- *How:* If the exporter's new toggle writes the same LINE_LOOP ring GLB, nothing downstream changes. If it writes true triangle meshes, ParseFill needs a second path and the fill record ({ categoryKey, hex, opacity, rings }) needs a mesh variant, which then splits both painters (RingPathData for SVG, DrawSitePlanFills for PDF).
- *Risk:* Na__LePdf__DrawSitePlanFills requires ring.points.length >= 6 AND ring.outer truthy; a mesh or an untagged inner ring will print as a solid block over its own hole. Na__LeVp2d__SitePlanBuild only builds a fill entry when data.rings.length > 0 AND Layer__Style.FillHex AND FillOpacity > 0 - a new layer with faces but no FillHex in the manifest draws nothing and gives no warning.

### Traps

- THE NORMALISER IS NOT A LOAD-TIME GATE, IT RUNS ON EVERY READ. Na__LeModel__GetSheets() normalises the whole list each call, and that same call is what the autosave, the R2 drawings-block save and the register export serialise. A key the normaliser destroys is destroyed on the very next panel refresh, not only on reload.
- UNKNOWN KEYS: a top-level Viewport__* key survives (NormaliseViewport never enumerates keys) but a key inside a REBUILT sub-object does not. The rebuilt objects are Viewport__FrameMm, Viewport__PanMm, Viewport__ImageMm, Viewport__ImageOffsetMm, Viewport__Styles (8-key literal), Viewport__ModelLayers (only values === false survive) and Viewport__ProjectedEdges->Edges__Categories->each entry (exactly Category__Label, Category__EdgeWeightFactor, Category__EdgeColour, Category__EdgeLineType).
- Viewport__SitePlan is Object.assign({}, ...) - a SHALLOW copy. Keys inside it survive today with zero normaliser work, which is convenient and dangerous: nothing defaults, clamps or documents them, and a nested object inside it is shared by reference with the source record (a paste/duplicate via InsertViewport deep-copies via JSON, but a hand-built patch does not).
- NormaliseViewport FORCES Viewport__Kind = '2d' and Viewport__DrawingId = null on any viewport carrying Viewport__SitePlan. Do not try to mark a site plan viewport with a drawing id or a 3D kind.
- Na__LeScale__Coerce with sitePlan falsy will turn 500 or 1250 into 50 SILENTLY (the plan doc records this as the original bug). Every call site must pass Na__LeRec__IsSitePlanViewport(viewport). Na__LeScale__Next() reads ONLY the architectural list and has no site plan awareness at all.
- Adding new scale denominators (500, 1250, 2500...) to LayoutEditor__Scales__SitePlanScaleDenominators changes what Na__LeScale__ListDenominators(true) returns, which in turn changes the number of buttons Na__LePanelViewport__Build puts in the data-na-block="scale-siteplan" toggle group - but that group is built ONCE per panel build, so a config that loads late leaves a stale button set. The same latch already exists for the architectural group.
- The site plan scale-preset in AddSitePlan switches a layer OFF when layer.Layer__VisibleAtScales does not contain the chosen scale. Adding a new coarse scale without updating the exporter's VisibleAtScales lists means every layer starts switched off at that scale and the viewport draws empty with no error.
- Na__LeRec__NormaliseProjectedEdges NEVER prunes a category key starting 'TrueVision__SitePlan__' (Na__LeRec__SITEPLAN_CATEGORY_PREFIX), because the default comes from the export, not the config. Any new site plan override therefore persists forever once written - reset must be an explicit null patch through Na__LeModel__UpdateViewport's projectedEdges merge (a null value deletes the entry).
- The prune also waits for Na__LeEdge__IsLoaded(): before the EdgeStyles config fetch lands, entries are cleaned but never dropped. A test run immediately after boot will show overrides that a later run drops.
- PDF fills print OUTER RINGS ONLY (Na__LePdf__DrawSitePlanFills skips any ring where ring.outer is falsy), while the screen paints every ring into one fill-rule="evenodd" path. Screen and paper therefore disagree about holes TODAY. Anyone testing a new fill or hatch must check the PDF, not the screen.
- jsPDF 4.1.0 is vendored at 02__Src__AppModules/90__System__PageLayoutSystem/01__Dependencies__VersionLocked/jspdf.umd.js (NOT in 04__Lib__ThirdParty__VersionLocked) and is injected as a classic script from LayoutEditor__Pdf__JsPdfScriptPath, so it is invisible to the import map and to any module-graph check.
- This jsPDF build drops the alpha channel on the raw 'RGBA' addImage path. Anything translucent must go in as a PNG data URL (see Na__LayoutEditor__GradientTool__Config__.json Meta__WhyThePdfIsAStrip).
- GState alpha exists in exactly ONE place, Na__LeChrome__WithOpacity, and it is applied inside saveGraphicsState/restoreGraphicsState with a feature test (typeof doc.GState === 'function' etc). A build without GState draws SOLID rather than failing - so a transparent hatch silently prints opaque if the library is swapped.
- beginTilingPattern / endTilingPattern / addShadingPattern all call advancedApiModeTrap and throw outside doc.advancedAPI(). The rest of the exporter runs in compat mode with y-down millimetres; mixing modes mid-page misplaces geometry with no error.
- Na__LePdf__DrawLinework drops any chord shorter than LineworkSetup.minSegmentPaperMm (0.05 mm), which at 1:500 is 25 mm of real world and at 1:1250 is 62.5 mm. Small tree circles and fine hatch emitted as short segments can disappear from the PDF while showing on screen.
- Na__LePdf__BuildDocument opens the document with compress:true; raw operator inspection of an exported PDF needs that turned off first.
- Na__SitePlan__Store__ is a singleton over ONE folder: Na__SpStore__Descriptor, Na__SpStore__Status, Na__SpStore__Note, Na__SpStore__LayerData (keyed by Layer__CategoryKey alone) and Na__SpStore__LayerPromises. A second (proposed) store cannot be added by calling FolderUrls twice - the caches collide on category key.
- Na__LeEdge__SitePlanDefault looks a category up in Na__SpStore__GetLayers() with NO viewport argument, so per-store styles are impossible until that lookup takes a source.
- The repaint guard Na__LeVp2d__SitePlanPaintKey = SitePlanToken + scale + masterPt + StyleToken, and SitePlanToken is only 'siteplan:' + descriptor.SitePlan__ExportedIso + ':' + hidden-layer list. Any new per-viewport site plan setting (source, pattern, composite mode) MUST be folded into that token or the viewport will keep showing the old paint.
- Panel__ViewportSettings builds every control up front and hides blocks in Refresh; a control added only in one branch of Build will be missing from the DOM for the other state and its querySelector will return null.
- Na__LeModel__UpdateViewport merges modelLayers, projectedEdges and compositeWeights but REPLACES everything else. A patch that carries only part of Viewport__SitePlan would blow the rest away unless a merge clause is added.
- Window-target events fire in registration order and the site plan store's Na__SpStore__CHANGED_EVENT listener in Panel__ViewportSettings skips refresh when event.detail.reason === 'layer-loaded' - a new panel that needs to react to a layer landing must not copy that filter blindly.
- Per the repo memory: run 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs after every JS edit (node --check cannot see a Na__ helper used but never imported), and a release whose new import names an export a warm PWA cache lacks needs the TrueVision service-worker token bumped.

### Open questions raised by this survey

- Does the coarse-scale 'Location Plan shows only the proposal fill' rule suppress the FILLS only, or the linework too? Today fills and lines are selected independently (fills from Layer__Style.FillHex/FillOpacity, lines from the owner-tagged visible class), and the existing coarse-scale mechanism is per-layer Layer__VisibleAtScales, not a fill/line split.
- Should the new rule be a hard derived rule from the denominator, or a default that Viewport__SitePlan can override per viewport? Two Location Plans on one sheet at the same scale would then need different treatment.
- Does 'viewports at 1:500 or coarser' mean 1:500 inclusive? At 1:500 the Add flow currently NAMES the viewport 'Block Plan' (d >= 1000 gives 'Location Plan'), so the proposed rule and the existing naming disagree at exactly 500.
- Existing vs Proposed: is 'auto-detected by folder' a second sibling folder under 30__TrueVision__AppContent (e.g. SitePlan__DrawingData__Existing / __Proposed), or two manifests in the one folder? Na__SpStore__FOLDER is a single constant and Na__SpStore__Find has a fixed three-step search order (local manifest, SitePlan__DataStore project-data block, CDN manifest) that would need doubling either way.
- If both stores publish the same Layer__CategoryKey (the same SketchUp tag in both models), how are Viewport__ModelLayers and Viewport__ProjectedEdges keyed? Today both are keyed by bare category key, so an override would leak between the existing and proposed viewport unless the key is namespaced by source.
- Does the Z-index hierarchy (1..10) replace Layer__DrawOrder (currently an open integer defaulting to 50) or sit beside it? And is it meant to order fills against OTHER LAYERS' LINEWORK - which the current painter cannot express, since it draws all fills then all lines?
- Where do the SVG hatch patterns live - a new config JSON under the Layout Editor (the house pattern) or in the site plan manifest beside Layer__Style, so a pattern travels with the export like LineHex and FillHex already do?
- Is the 'Patterns' right-column panel a per-viewport site plan control (like Model Layers) or a general drawing-tool palette for vector shapes? That decides whether the chosen pattern is stored in Viewport__SitePlan, in the Viewport__ProjectedEdges category record, or on Shape__ records.
- Does 'Site Plan Render Composites' reuse the existing Viewport__CompositeWeights / Na__LeComposite__ machinery (a flat map of key to clamped number, normalised by Na__LeRec__NormaliseCompositeWeights, which DROPS any key the config has never heard of), or is it a separate new field?
- The plan doc's Phase 5 open list still names 'Styles panel raster rows on site plan viewports' and 'PDF holes' - should this build close those, since the fill work touches exactly that code?
- ValeVision: the whole site plan feature is TrueVision-only (Na__LayoutEditor__Viewport2d__SitePlan__ says 'Ported from: none'). Per the standing rule, Adam should be asked about the ValeVision port only after he confirms the TrueVision build.

---

<a id="area-7"></a>
## 7. TrueVision3D Layout Editor - how a site plan viewport is painted on the sheet today (SVG fills + styled linework), and the seams a fill/pattern/linework composite build must hook into

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY - find everything by function/constant name, the files move.

1. THE PAINT PIPELINE, END TO END.
The sheet surface calls `Na__LeVp2d__Fill(body, sheet, viewport, ppm)` (Na__LayoutEditor__Viewport2d__.js ~248) for every visible 2D frame. Its very first act (~250) is `if (Na__LeModel__IsSitePlanViewport(viewport))` - it records `state.lastArgs = { sheet, viewport, ppm }` and hands off to `Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm)`, returning before any `Describe()`, design-phase, underlay or projection code runs. A site plan viewport is recognised purely by the presence of the object `Viewport__SitePlan` on the record (`Na__LeRec__IsSitePlanViewport`, SheetRecords ~413).

`Na__LeVp2d__FillSitePlan` (Viewport2d__SitePlan__.js ~243): clears the debounce timer, hides `state.underlay`, nulls `renderedKey/renderedWindow/wantedKey`, empties `state.markup`, reads `state.masterPt = sheet.Sheet__Lineweights.ViewportPt`. Then it branches on `Na__SpStore__GetStatus()`: not READY -> blank the linework and either show the EMPTY note (`Na__LeCfg__GetLabel('SitePlanNoData', ...)` with `Na__SpStore__GetNote()` as the title) or the loading badge plus `Na__SpStore__Resolve().then(... Na__LeVp2d__RefillSitePlan(state, viewport.Viewport__Id, false))`. READY -> compute `paintKey = Na__LeVp2d__SitePlanPaintKey(viewport, state.masterPt)`; if it equals `state.lineworkKey` and an SVG exists, it ONLY re-writes the `viewBox` and re-sizes the layer (that is the pan/zoom fast path - no rebuild). Otherwise `Na__LeVp2d__SitePlanBuild(viewport, false)`; a non-null build paints, a null build (a layer still loading) shows the badge and `Na__SpStore__LoadAll().then(... RefillSitePlan(..., true))`. `Na__LeVp2d__RefillSitePlan` (~290) guards `Na__LeVp2d__States.get(viewportId) === state` and `Na__LeModel__IsSitePlanViewport(args.viewport)` before repainting with `allowMissing = true`.

2. THE CLASSES OBJECT AND OWNERS.
`Na__LeVp2d__SitePlanBuild(viewport, allowMissing)` (~142) reads `Na__SpStore__GetDescriptor()`, filters `descriptor.SitePlan__Layers` by `Na__LeModelLayers__IsOn(viewport, layer.Layer__CategoryKey)`, fetches each layer's geometry with `Na__SpStore__GetLayerData(key)`, and concatenates every loaded layer's `segments` into ONE `Float32Array(total*4)`. It builds an owner table with `Na__PlOwners__CreateTable()` / `Na__PlOwners__IdFor(table, data.categoryKey)` and `owners.fill(id, at, at + segmentCount)`. The result is `classes = { visible : segments, hidden : Float32Array(0), authored : Float32Array(0), section : Float32Array(0) }` with `Na__PlOwners__Attach(classes, {visible: owners, ...}, table.Keys)`. EVERY site plan line is in the `visible` class, tagged by layer, which is what lets the ordinary `StyleBands` path style each layer exactly like a model category. It returns `{ classes, fills, key : Na__LeVp2d__SitePlanToken(viewport) }`.
THERE IS NO CULLING. The plan doc's section 8.4 says "Segments are culled to the window"; the built code does not cull at all - the whole store is concatenated every rebuild and the SVG viewBox does the clipping. (The PDF path does cull, crudely, in `Na__LePdf__DrawLinework`.)

3. THE FILLS, AND THE EVEN-ODD PATH.
`fills` is built in the same function: `loaded.filter(d => d.rings.length > 0 && d.layer.Layer__Style.FillHex && Number.isFinite(d.layer.Layer__Style.FillOpacity) && d.layer.Layer__Style.FillOpacity > 0).map(d => ({ categoryKey, hex : FillHex, opacity : FillOpacity, rings : d.rings }))`. A layer with no fill style simply drops out.
`Na__LeVp2d__RingPathData(rings)` (~188) is the function that builds the fill path: for each ring it reads `ring.points` (a flat `[x,y,x,y,...]` Float64Array in drawing millimetres), skips anything shorter than 6 numbers, emits `M x y` then `L x y` for every remaining pair, then `Z`. EVERY ring of the layer - outer and inner alike - is concatenated into ONE `d` string; the hole is cut by the `fill-rule="evenodd"` attribute, not by any winding calculation. Coordinates are rounded to 2 dp (`Math.round(v*100)/100`).

4. HOW THE SVG IS WRITTEN.
`Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm)` (~205) is the single writer. It takes `win = Na__LeVp2d__Window(viewport)`, `D = win.Denominator`, `styleToken = Na__LeVp2d__StyleToken(viewport)`, `bands = Na__LeVp2d__StyleBands(viewport, state.masterPt, built.classes, false)` (hidden always false - a site plan has no hidden class) and `paths = Na__LeVp2d__BandPaths(built.key + '@false@' + styleToken, bands, built.classes)`.
It then concatenates a plain STRING `body`, in this order:
  (a) one `<path d=... fill="HEX" fill-opacity="N" fill-rule="evenodd" stroke="none"/>` per entry in `built.fills`, in `built.fills` order;
  (b) one `<path d=... fill="none" stroke="band.colour" stroke-width="band.widthMm * D" stroke-linecap="round" stroke-linejoin="round" [stroke-dasharray="dashMm.map(mm => mm*D).join(' ')"]/>` per band.
There is NO `<g>` grouping, no per-layer id, no class attribute, no `data-` attribute of any kind on any path. Nothing in the painted SVG identifies which layer a path belongs to.
It writes `state.linework.innerHTML = '<svg xmlns=... class="na-le-frame__linework-svg" viewBox="OriginX OriginY WidthMm HeightMm" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>'`, then sets `state.lineworkKey = SitePlanPaintKey(...)`, `state.lineworkSvg = state.linework.firstElementChild`, `state.classes = built.classes` (the snap source), `state.classesKey = built.key`, `state.paintedFp = null`, and finally `Na__LeVp2d__SizeLayer(state.lineworkSvg, viewport, ppm)`.
The frame body's DOM layers are created once in `Na__LeVp2d__State` (Frame unit ~147) in this fixed order: `underlay` (img.na-le-frame__underlay), `linework` (div.na-le-frame__linework), `markup` (div.na-le-frame__markup), `empty`, `progress`. The CSS (Na__LayoutEditor__Styles__Main__Paper__.css ~121-155) gives them `position:absolute; inset:0` and NO z-index at all: stacking is DOM order. A site plan viewport hides the underlay, so its whole picture is the single linework SVG.

5. THE PDF PAINTS THE SAME BUILD, DIFFERENTLY. `Na__LePdf__DrawViewport` (PdfExporter ~268) branches on `Na__LeModel__IsSitePlanViewport` (~274), awaits `Na__LeVp2d__SitePlanDrawing(viewport)` (the async wrapper that does `Na__SpStore__Resolve()` then `Na__SpStore__LoadAll()` then `SitePlanBuild(viewport, true)`), then calls `Na__LePdf__DrawSitePlanFills(doc, viewport, described, drawing.fills)` and `Na__LePdf__DrawLinework(doc, sheet, viewport, described, drawing.classes)`. The PDF fill path draws ONLY `ring.outer` rings, one polygon each, through `Na__LeChrome__PushPolyline(..., { fillOpacity })` - so holes are not cut on paper (known gap). PDF widths and dashes go in unscaled (already paper mm); the screen multiplies by `D`.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js`
*Version:* 1.0.0 (15-Sep-2026)

THE file that paints a site plan viewport. Namespace Na__LeVp2d. 320 lines, v1.0.0, TrueVision-only (no ValeVision counterpart). Everything in items 1-6 of the brief lands here.

*Key symbols:* `Na__LeVp2d__SitePlanToken (~115) - 'siteplan:' + descriptor.SitePlan__ExportedIso + ':' + Na__LeModelLayers__Token(viewport)`, `Na__LeVp2d__SitePlanPaintKey (~124) - token + '|' + Viewport__ScaleDenominator + '|' + masterPt + '|' + Na__LeVp2d__StyleToken(viewport)`, `Na__LeVp2d__SitePlanBuild (~142) - returns { classes, fills, key }; builds owners; NO culling`, `Na__LeVp2d__SitePlanDrawing (~177) - async; Resolve -> LoadAll -> SitePlanBuild(vp, true); the PDF's entry point`, `Na__LeVp2d__RingPathData (~188) - THE fill path builder; all rings into one d, evenodd cuts holes; 2dp rounding`, `Na__LeVp2d__PaintSitePlan (~205) - the only SVG writer; fills first, then bands; string concatenation into state.linework.innerHTML`, `Na__LeVp2d__FillSitePlan (~243) - status branch, paintKey fast path, badge, empty note`, `Na__LeVp2d__RefillSitePlan (~290) - repaint once data lands, guarded by States.get(id) === state`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js`
*Version:* 1.11.0 (18-Sep-2026)

The facade every other module imports. Owns Fill/ForceRender/GetSnapSource/Release/RenderForExport and re-exports the four units' names. The site plan branch is the first thing Fill and ForceRender do.

*Key symbols:* `Na__LeVp2d__Fill (~248) - site plan branch at ~250-254`, `Na__LeVp2d__CentreOnDrawing (~226) - site plan branch uses Na__SpStore__GetFocusBoundsMm()`, `Na__LeVp2d__ForceRender (~414) - site plan branch ~417-424: Na__SpStore__Reload() + LoadAll(), nulls lineworkKey/lineworkSvg/classes/classesKey, re-FillSitePlan`, `Na__LeVp2d__GetSnapSource (~374) - reads state.classes + state.classesKey`, `Na__LeVp2d__RenderForExport (~475) - returns null for a site plan (no definition)`, `export list (~495) - includes Na__LeVp2d__SitePlanDrawing and Na__LeVp2d__StyleBands`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js`
*Version:* 1.1.0 (18-Sep-2026)

How classes become inked bands and path strings. SitePlan imports StyleToken, StyleBands and BandPaths from here (BandPaths is exported specifically for the site plan unit).

*Key symbols:* `Na__LeVp2d__StyleToken (~183) - Na__LeEdge__Token(viewport) + '#' + Na__LeComposite__Token(viewport)`, `Na__LeVp2d__StrokeRules (~207) - per-class base rule: scale = PtToMm(masterPt)/setup.visibleWidthMm, times Na__LeComposite__Factor(viewport,'projectedLinework'), hidden also times 'hiddenLines'`, `Na__LeVp2d__StyleBands (~236) - buckets a class by RESOLVED style (Na__LeEdge__Effective per owner id), heaviest last, indices null when one band is the whole class`, `Na__LeVp2d__BandPaths (~338) - path cache keyed by the caller's composite key; evicts when PathCache.size > 16`, `Na__LeVp2d__PathDataFor (~355) - M/L per segment for a subset`, `Na__LeVp2d__ForgetPaths (~324) - deletes every PathCache entry starting key + '@'`, `Na__LeVp2d__PaintLinework (~371) - the architectural twin of PaintSitePlan`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Frame__.js`
*Version:* 1.1.0 (18-Sep-2026)

Module state and the frame body's DOM layers. Owns the shared caches a new layer would have to join or clear.

*Key symbols:* `Na__LeVp2d__CLASS_ORDER (~100) = [ 'hidden', 'visible', 'authored', 'section' ]`, `Na__LeVp2d__States (~105) Map viewportId -> state`, `Na__LeVp2d__Linework (~106) Map cacheKey -> Promise`, `Na__LeVp2d__PathCache (~107) Map cacheKey -> paths[] (16-entry FIFO)`, `Na__LeVp2d__State (~147) - creates underlay/linework/markup/empty/progress IN THAT DOM ORDER`, `Na__LeVp2d__SizeLayer (~137)`, `Na__LeVp2d__HideProgress / ShowProgress (~231-246)`, `Na__LeVp2d__Park / Restore (~261-274) - the sheet surface's viewport cache; state.parked`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Window__.js`
*Version:* 1.0.0

The model window (paper mm x denominator, centred on the pan) and its mappings. A site plan uses Window but NEVER Describe (Describe would return definition: null).

*Key symbols:* `Na__LeVp2d__Window (~83) - { CentreX, CentreY, WidthMm, HeightMm, OriginX, OriginY, Denominator, Frame, ToLocal, ToPaper, FromPaper }`, `Na__LeVp2d__Describe (~105) - folds in Na__LeModelLayers__ExcludeTokens + door pose; site plan gets { definition : null }`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js`
*Version:* 1.1.0 (14-Sep-2026)

What one category looks like in one viewport: colour alias -> hex, line type alias -> paper-mm dash pattern, weight factor. Owns the per-viewport record Viewport__ProjectedEdges. Already special-cases site plan keys.

*Key symbols:* `Na__LeEdge__FIELD = 'Viewport__ProjectedEdges' (~96)`, `Na__LeEdge__CAT_FIELD = 'Edges__Categories' (~97)`, `Na__LeEdge__SITEPLAN_PREFIX = 'TrueVision__SitePlan__' (~98)`, `Na__LeEdge__SitePlanDefault (~363) - weight = Layer__Style.LineWeightMm / PtToMm(GetLineweightSetup().viewportPt); colour = AliasForHex(LineHex); lineType = LineType if a real alias`, `Na__LeEdge__Default (~381) - site plan default first, then Na__LeModelLayers__EdgeDefault, then Fallback`, `Na__LeEdge__Effective (~411) - returns { weight, colour, lineType, hex, patternMm, overridden }`, `Na__LeEdge__Patch (~448) / Na__LeEdge__ResetPatch (~472) - patch shape { [key] : { Category__Label, Category__EdgeWeightFactor, Category__EdgeColour, Category__EdgeLineType } } or null`, `Na__LeEdge__Token (~485) - key:weight:colour:lineType joined by '|', '' when untouched`, `Na__LeEdge__ClampWeight (~327), Na__LeEdge__Hex (~289), Na__LeEdge__Pattern (~304), Na__LeEdge__AliasForHex (~345)`, `Na__LeEdge__Ready (~151) awaits Na__LeModelLayers__Ready() first`, `Na__LeEdge__IsLoaded (~181) - BOTH configs; the record pruner gates on it`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json`
*Version:* 1.1.0

The vocabulary: colours, line types, weight bounds, which classes a category may restyle, fallback. NO fill or pattern vocabulary exists here yet - a pattern library would be its sibling or a new block.

*Key symbols:* `LayoutEditor__EdgeStyles__Colours - 9 rows: black #000000, soft-black #333333, dark-grey #666666, mid-dark-grey #737373, mid-grey #999999, light-grey #D9D9D9, red #E53935, green #43A047, blue #1E88E5; fields Colour__Alias / Colour__Label / Colour__Hex / Colour__SsotKey / Colour__Note`, `LayoutEditor__EdgeStyles__LineTypes - 7 rows: solid [], dashed [2.5,1.5], dashed-fine [1.2,0.8], centre [8,2,2,2], centre-fine [5,1.5,1,1.5], phantom [12,2,2,2,2,2], dotted [0.4,1.2]; fields LineType__Alias / LineType__Label / LineType__PatternMm (PAPER mm)`, `LayoutEditor__EdgeStyles__Weight - Weight__Min 0.10, Weight__Max 6.00, Weight__Step 0.05, Weight__Decimals 2, Weight__Default 1.00`, `LayoutEditor__EdgeStyles__Classes - Classes__AppliesToClasses [visible, hidden, authored] (NO section), Classes__SolidMeansClassDefault true`, `LayoutEditor__EdgeStyles__Fallback - Fallback__ColourAlias black, Fallback__LineTypeAlias solid, Fallback__WeightFactor 1.00`, `Meta__SsotSource = Na__DataLib__CoreIndex__EdgeMaterials__.json, Meta__SsotVersionRead 2.0.0`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__.js`
*Version:* 1.3.0 (14-Sep-2026)

Which categories a viewport may see, what they are called, and each category's configured default edge style. Its Groups() already merges site plan layers ahead of model groups.

*Key symbols:* `Na__LeModelLayers__FIELD = 'Viewport__ModelLayers' (~80)`, `Na__LeModelLayers__Groups (categoryKeys) (~242) - site plan block ~250-261 runs FIRST, from Na__SpStore__GetLayers(), grouped by Layer__Group, id 'siteplan-' + slug(groupLabel); then the config's groups; then an 'Other' group`, `Na__LeModelLayers__IsOn (~301) - ABSENT MEANS ON; stored[key] !== false`, `Na__LeModelLayers__HiddenKeys (~311) - sorted, only the false ones`, `Na__LeModelLayers__Token (~325) - hidden.join(','), '' when nothing hidden`, `Na__LeModelLayers__ExcludeTokens (~342) - '=' + key; used only by the projection path, NOT by site plans`, `Na__LeModelLayers__EdgeDefault (~202) / BuildEdgeIndex (~170)`, `Na__LeModelLayers__Generated (~211) - strips 'TrueVision__', __ -> ' - ', camel split`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__Config__.json`
*Version:* 1.1.1

SketchUp tag -> runtime category -> label -> default edge style, in 6 groups. Site plan layers are deliberately NOT here (their style travels with the export).

*Key symbols:* `LayoutEditor__ModelLayers__EdgeDefaults - EdgeDefaults__WeightFactor 1.00, EdgeDefaults__Colour black, EdgeDefaults__LineType solid`, `LayoutEditor__ModelLayers__Groups - Group__Id / Group__Label / Group__Layers`, `Row fields: Layer__CategoryKey, Layer__SketchUpTags, Layer__TagNumbers, Layer__Label, Layer__EdgeWeightFactor, Layer__EdgeColour, Layer__EdgeLineType`, `Groups: proposed, existing, furnishing, site (TrueVision__LandscapeEnvironment / SiteBoundaries / SiteVegetation2D / Vegetation), annotation, context`, `LayoutEditor__ModelLayers__Fallback - Fallback__GroupLabel 'Other', Fallback__StripPrefix 'TrueVision__', Fallback__SplitOnDouble ' - '`, `Meta__SsotSource = Na__DataLib__CoreIndex__Tags__.json, Meta__SsotVersionRead 2.3.2`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`
*Version:* 1.0.1 (14-Sep-2026)

Finds and loads the project's site plan data. THIS is where Layer__DrawOrder is read and applied, and where a second (Existing/Proposed) store would have to be introduced - today there is exactly one folder and one module-level descriptor.

*Key symbols:* `Na__SpStore__DATA_KEY = 'SitePlan__DataStore' (~80); CDN_BASE 'https://cdn.noble-architecture.com/NaProjectPortal'; PORTAL_DIR 'na-project-portal'; CONTENT_DIR '30__TrueVision__AppContent'; FOLDER 'SitePlan__DrawingData'; MANIFEST 'TrueVision__SitePlanData__Manifest__.json'; SCHEMA 1; RED_LINE_KEY 'TrueVision__SitePlan__RedLineBoundary'`, `Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed' (dispatched on a microtask by Na__SpStore__Dispatch)`, `Na__SpStore__Layer (~234) - reads Layer__DrawOrder, DEFAULTING TO 50 (~246)`, `Na__SpStore__Describe (~261) - .sort((a,b) => a.Layer__DrawOrder - b.Layer__DrawOrder) at ~267: THE ONLY place draw order is applied`, `Na__SpStore__Style (~215) - LineColourId, LineHex, LineType, LineWeightMm (default 0.25), FillColourId, FillHex, FillOpacity`, `Na__SpStore__Find (~282) - localhost manifest, then SitePlan__DataStore project-data key, then CDN manifest`, `Na__SpStore__Resolve (~334) / Reload (~362) / LoadLayer (~384) / LoadAll (~434)`, `Na__SpStore__GetStatus / GetNote / GetDescriptor / GetLayers / GetLayerData (~445-449)`, `Na__SpStore__GetFocusBoundsMm (~455)`, `Module state: Na__SpStore__Descriptor, LayerPromises (key = categoryKey + '|' + exportedIso), LayerData (categoryKey -> geometry), Generation`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__GlbParse__.js`
*Version:* 1.0.0

Reads the exported GLBs by hand (no three.js, no DOM, no network - a Node harness can import it). This is what an 'Export Polygon Faces' toggle writing 2D face MESHES would have to be read by: it currently understands LINES (mode 1) and LINE_LOOP (mode 2) only.

*Key symbols:* `Na__SpGlb__MODE_LINES = 1, Na__SpGlb__MODE_LOOP = 2, Na__SpGlb__MODE_DEFAULT = 4 (triangles - explicitly noted as 'which a site plan never has')`, `Na__SpGlb__ParseLinework (~280) -> { segments Float64Array [x0,y0,x1,y1,...], segmentCount, boundsMm }`, `Na__SpGlb__ParseFill (~320) -> { rings [{ face, outer, points }], ringCount, boundsMm }; reads primitive.extras.Na__SitePlanFace (int) and extras.Na__SitePlanRing === 'outer'`, `Na__SpGlb__DrawingPoints (~230) - drawX = worldX * 1000, drawY = +worldZ * 1000 (drawing y IS +world Z, not -Z)`, `Na__SpGlb__Primitives (~213) - filters by mode; a triangle mode would need a new call site`, `Na__SpGlb__ReadContainer / ReadVec3 / ReadIndices / MeshInstances / NodeMatrix`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js`

The paper twin of the screen paint. Any new fill/pattern layer must be printed here too or the PDF silently loses it.

*Key symbols:* `Na__LePdf__DrawViewport (~268) - site plan branch ~274-282`, `Na__LePdf__DrawSitePlanFills (~246) - OUTER rings only, Na__LeChrome__PushPolyline(primitives, points, null, 0, fill.hex, true, null, { fillOpacity }) then Na__LeChrome__DrawToPdf`, `Na__LePdf__DrawLinework (~203) - reuses Na__LeVp2d__StyleBands; widths/dashes unscaled; skips chords under setup.minSegmentPaperMm; skips segments wholly outside the frame`, `Na__LePdf__BuildDocument (~341)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js`

The record normaliser. Anything new stored on a viewport MUST be handled here or it is silently stripped on the next save/undo/restore.

*Key symbols:* `Na__LeRec__STYLE_KEYS (~261) = [ 'baseImage', 'projectedLinework', 'profileLinework', 'glassOpaque', 'whitecard', 'hiddenLines', 'enhanceWhitecard', 'contextLayer' ] - a new composite toggle must join this list`, `Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__' (~268)`, `Na__LeRec__IsSitePlanViewport (~413) - truthy non-array object at Viewport__SitePlan`, `Na__LeRec__NormaliseViewport (~422) - rebuilds Viewport__SitePlan as Object.assign({}, ...) (unknown sub-keys survive), forces Kind 2D and DrawingId null, deletes Viewport__SitePlan on any other viewport`, `Na__LeRec__NormaliseProjectedEdges (~349) - REBUILDS each entry from exactly four fields; a new fill/pattern field added to the entry is DROPPED unless added here; site plan keys are exempt from the prune (~368)`, `Na__LeRec__NormaliseCompositeWeights (~about 395-407) - keeps only keys Na__LeComposite__Row knows with weight.kind !== 'none'`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Viewports__.js`

UpdateViewport's patch vocabulary. A new per-viewport setting needs a patch key here AND a normaliser clause.

*Key symbols:* `Na__LeModel__UpdateViewport (~248 onward) - patch keys: rect, pan, imageMm, imageOffset, imageZoom, styles, modelLayers (merged, booleans only), projectedEdges (merged, null clears, stamps Edges__UpdatedIso), compositeWeights (merged, clamped), scaleDenominator, markupMode, name, layerId, sceneId, drawingId, kind, showScaleLabel, showFrame, closedDoors, locked, snapshotAsset, modelSourceId`, `calls Na__LeRec__NormaliseViewport then Na__LeModel__Touch('viewport', sheetId, viewportId) (or AssignDirty when silent)`, `Na__LeModel__IsSitePlanViewport (~169)`, `Na__LeModel__ResolveViewportSource (~324) - site plan returns { kind:'2d', scene:null, plan:null, elevation:null, sitePlan : viewport.Viewport__SitePlan, label }`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js`
*Version:* 1.1.0

The inventory of picture layers and their weights, and the per-viewport record Viewport__CompositeWeights. This is the existing pattern a 'Site Plan Render Composites' dropdown should copy or extend.

*Key symbols:* `Na__LeComposite__FIELD = 'Viewport__CompositeWeights' (~82)`, `Na__LeComposite__Rows (~147) - from LayoutEditor__RenderComposites__Layers; fields Composite__Key / Composite__Label / Composite__TwoDOnly / Composite__Toggle / Composite__Note / Composite__Order / Composite__Weight { Weight__Kind (factor|pixels|none), Weight__TwoDOnly, Weight__Default, Weight__Min, Weight__Max, Weight__Step, Weight__Label }`, `Na__LeComposite__ToggleRows (~190) / WeightRows (~198)`, `Na__LeComposite__Weight (~228) / Factor (~243, never null) / Clamp (~212) / IsOverridden (~252)`, `Na__LeComposite__Token (~289) - every stored weight; feeds StyleToken`, `Na__LeComposite__RasterToken (~271) - PIXEL weights only; feeds the underlay key (a site plan has no underlay)`, `FALLBACK inventory (~99-108): projectedLinework, profileLinework, sectionOutline, hiddenLines, glassOpaque, whitecard, enhanceWhitecard, baseImage`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ModelLayers__.js`
*Version:* 1.3.0

The left-column panel that lists a site plan viewport's layers and, under an Advanced fold, their colour/line type/weight. Any per-layer fill or pattern control belongs beside these rows.

*Key symbols:* `Na__LePanelModelLayers__Register (~around 300-412) - Na__LePanels__RegisterSection('left', { id, title : GetLabel('ModelLayersTitle','Model Layers'), build, refresh, defaultOpen : false })`, `controls: 'model-layer' toggle, 'model-layer-bulk', 'edge-colour', 'edge-type', 'edge-weight', 'edge-reset', 'edge-reset-all' (all via Na__LePanels__OnControl)`, `listens to Na__SpStore__CHANGED_EVENT to rebuild when site plan data lands`, `Na__LePanelModelLayers__Apply / ApplyEdge -> Na__LeModel__UpdateViewport(sheet, id, { modelLayers } | { projectedEdges })`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js`
*Version:* 1.6.1

The existing LEFT-column 'Render Composites' section - the literal neighbour a 'Site Plan Render Composites' dropdown would sit in or beside. Known gap: it still shows raster-only rows on a site plan viewport.

*Key symbols:* `Na__LePanelStyles__Register (~369) - Na__LePanels__RegisterSection('left', { id, title : GetLabel('StylesTitle','Render Composites'), build, refresh })`, `controls: style toggles, style weights, 'style-force' (Na__LeForce__Viewport / Na__LeForce__Sheet)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__PanelHost__.js`
*Version:* 1.4.0 (19-Sep-2026)

The two columns, their foldable sections, and the right column's TABS. A 'Patterns' right-column panel is a RegisterTab/RegisterSection job exactly like the Scrapbook tab.

*Key symbols:* `Na__LePanels__RegisterTab(side, spec) (~302) - spec { id, title }`, `Na__LePanels__RegisterSection(side, spec) (~387) - spec { id, title, build, refresh, defaultOpen, tab, collapseOthersOnOpen }`, `Na__LePanels__OnControl(type, name, handler) - declared controls via data-na-control`, `Na__LePanels__Refresh, SetSectionVisible, SetFolded, FocusSection, SetActiveTab, GetActiveTab, IsEditable, Row, SliderRow, LinkedPairRow`, `Na__LePanels__VAR_LEFT '--Vale_LayoutLeftPanelWidth', VAR_RIGHT '--Vale_LayoutRightPanelWidth', STORE_PREFIX 'na-layouteditor-panel:'`, `a section off its tab is hidden with class is-off-tab, never the hidden attribute`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\05__Core__ModeController\Na__LayoutEditor__ModeController__.js`

Where every panel is registered, in order. A new panel must be added here or it never appears.

*Key symbols:* `left column order (~368-372): Na__LePanelSheet__Register, Na__LePanelMargin__Register, Na__LePanelLayers__Register, Na__LePanelStyles__Register (Render Composites), Na__LePanelModelLayers__Register`, `right column (~374-385): RegisterTab('right', {id:'properties'}), Na__LePanelScrap__RegisterTab, Na__LePanelParam__RegisterProperties, Na__LePanelViewport__Register, Text, Leaders, Dims, Shapes, then the Scrapbook tab's three libraries`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js`

The Add-viewport flow, including the site plan one that presets Model Layers from VisibleAtScales. An Existing/Proposed store choice would surface here.

*Key symbols:* `Na__LePanelViewport__AddSitePlan(sheet, denominator) (~247) - Na__SpStore__Resolve(), Na__LeScale__ListDenominators(true), presets off[] from Layer__VisibleAtScales (~258), CreateViewport({ kind:'2d', sitePlan : {}, scaleDenominator, modelLayers : off, name : 'Location Plan' | 'Block Plan', rect }), then pans to GetFocusBoundsMm`, `Na__LePanelViewport__ExportDate (~276)`, `Na__LePanels__RegisterSection('right', ...) (~642)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\10__Core__SheetSurface\Na__LayoutEditor__Styles__Main__Paper__.css`

The frame's layer stack. No z-index anywhere - DOM order IS paint order.

*Key symbols:* `.na-le-frame / .na-le-frame__body (~104-118)`, `.na-le-frame__underlay, .na-le-frame__snapshot (~121)`, `.na-le-frame__linework, .na-le-frame__markup (~138) - position absolute, inset 0, pointer-events none`, `.na-le-frame__linework-svg, .na-le-frame__markup-svg (~145)`, `.na-le-frame__linework-svg path { shape-rendering : geometricPrecision } (~154)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\50__System__ProjectedLinework\Na__ProjectedLinework__Owners__.js`

The per-segment category tagging the site plan build reuses.

*Key symbols:* `Na__PlOwners__CLASSES (~77) = [ 'visible', 'hidden', 'authored', 'section' ]`, `Na__PlOwners__CreateTable (~89) -> { Keys : [''], Index : Map }`, `Na__PlOwners__IdFor (~97)`, `Na__PlOwners__KeyFor (~112)`, `Na__PlOwners__Attach (~180) - writes classes.Owners and classes.OwnerKeys`, `Na__PlOwners__Read (~209) / Na__PlOwners__Has (~218)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanDrawings__.md`

The existing plan doc. Section 5 is the tag schema (the tags being renamed/added), 5.3 the SitePlan__ field vocabulary, 6.5 the manifest schema, 8.4 the built site plan viewport, 13 the progress ledger.

*Key symbols:* `5.2 the 18 tags across ranges 71-75 and their stems`, `5.3 SitePlan__DrawOrder, SitePlan__ExportFills, SitePlan__LineColourId, SitePlan__LineType, SitePlan__LineWeightMm, SitePlan__FillColourId, SitePlan__FillOpacity, SitePlan__VisibleAtScales, SitePlan__ExportFileNameStem, SitePlan__LayerLabel, SitePlan__LayerGroup`, `6.5 manifest v1: SitePlanData__SchemaVersion, SitePlanData__ExportedIso, SitePlanData__NorthAngleDeg, SitePlanData__BoundsMm, SitePlanData__Layers[]`, `13 ledger: Phases 0-5 x, Phase 6 ~, Phase 7 ~`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools`

AN EMPTY FOLDER, created 20-Sep-2026 13:02, no files in it. Somebody has already staked out the home for the hatch pattern library. There is NO hatch/pattern code anywhere in the app today (grep for 'hatch' returns only vendored three.js and unrelated prose).

### Conventions observed

- FILE NAMING: Na__<Area>__<Thing>__.js, trailing double underscore. A module's config is its sibling Na__<Area>__<Thing>__Config__.json. Styles are Na__LayoutEditor__Styles__<Scope>__.css.
- NAMESPACE PREFIXES: every exported symbol is Na__<Ns>__<Name>. Live namespaces here: Na__LeVp2d (viewport 2D), Na__LeEdge (edge styles), Na__LeModelLayers, Na__LeComposite, Na__LeModel / Na__LeRec (sheet model / records), Na__LePanels (panel host), Na__LePanel<X> (a panel), Na__LePdf, Na__SpStore (site plan store), Na__SpGlb (site plan GLB parser), Na__PlOwners / Na__PlPipe / Na__PlView (projected linework).
- JSON KEY SHAPE: double-underscore compound keys, PascalCase halves - Block__Field. Records: Viewport__ModelLayers, Viewport__ProjectedEdges, Viewport__CompositeWeights, Viewport__SitePlan, Viewport__Styles, Viewport__ScaleDenominator, Viewport__FrameMm, Viewport__PanMm. Config blocks: LayoutEditor__<Module>__<Section>. Rows: Layer__CategoryKey, Layer__Label, Layer__Group, Layer__DrawOrder, Layer__Style, Colour__Alias, LineType__PatternMm, Composite__Key, Weight__Min.
- HEADER BLOCK: every .js opens with a banner - FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED, then DESCRIPTION, INTEGRATION, a PORT NOTE (Ported from / Ported on / Parity / Divergences / Back-port) and a reverse-chronological DEVELOPMENT LOG with a semver and a date. Config JSON carries a <Block>__Meta with Meta__FileName, Meta__Description, Meta__Version, Meta__Created, Meta__Author, Meta__SsotSource, Meta__SsotPath, Meta__SsotVersionRead and prose Meta__Why... keys.
- CODE LAYOUT: // REGION | ... / // endregion blocks; every function preceded by // FUNCTION | or // HELPER FUNCTION | with a dashed rule; exports collected in a final 'REGION | Module Exports' block. Explanatory prose lives in comments in full sentences, often with a capitalised opening clause stating the rule.
- UNITS: paper millimetres for anything printed (line widths, dash patterns, frame size), drawing millimetres for model space; a screen SVG multiplies paper mm by win.Denominator, the PDF does not. Weights are FACTORS on the sheet master (Sheet__Lineweights.ViewportPt), never widths - except composite 'pixels' weights, which are real buffer pixels.
- ABSENT MEANS DEFAULT: a viewport record stores only dissent. Model Layers stores only `false`; ProjectedEdges stores only restyled categories, each written out in FULL (label + all three values) so a project file audits without the config; CompositeWeights stores only overridden weights. Every module exposes a Token() that returns '' when nothing is stored, so an untouched viewport keys exactly as it did before the feature existed and its caches survive.
- CONFIG-DRIVEN UI: a panel is built from a fetched JSON inventory, not a list in its source, so adding a row is a config edit. Config fetches use { cache : 'no-store' }, warn on failure, and fall back to a built-in constant array so a failed fetch leaves a working (uglier) panel rather than a blank one.
- SITE PLAN CATEGORY KEYS are always 'TrueVision__SitePlan__' + the export's stem, kept distinct from model categories so Model Layers and Edge Styles can never collide. The prefix is hard-coded in TWO places: Na__LeEdge__SITEPLAN_PREFIX and Na__LeRec__SITEPLAN_CATEGORY_PREFIX.
- VERSIONING: each module carries its own semver in its DEVELOPMENT LOG; the app version is bumped in TrueVision__DEVLOG__.md with a dated, titled entry.

### Extension points

**A solid fill BASE layer, then a PATTERN layer, then the linework - three toggleable layers**

- *Where:* Na__LayoutEditor__Viewport2d__SitePlan__.js -> Na__LeVp2d__PaintSitePlan (~205), the `let body = ''` concatenation
- *How:* The three layers are already ordered correctly in that one string: fills first (~212-215), bands second (~216-224). The minimal build wraps each in its own <g> - e.g. <g data-na-layer="fill">, <g data-na-layer="pattern">, <g data-na-layer="linework"> - inside the SAME single <svg>, and inserts the pattern group between them. Patterns need an <defs> block at the head of the SVG string holding one <pattern> per hatch (SVG <pattern> with patternUnits='userSpaceOnUse' and a patternTransform scaled by win.Denominator so the hatch measures true on paper at any scale), and the fill paths then reference fill="url(#id)". Toggling becomes either (a) CSS/`hidden` on the three <g> elements, cheapest and no repaint, or (b) three booleans folded into Na__LeVp2d__SitePlanPaintKey so the SVG is rebuilt. Prefer (a) for the toggle and (b) only if the pattern definitions themselves change.
- *Risk:* Pattern ids must be unique per FRAME, not per document - the same viewport id appears on every sheet and several frames are in the DOM at once (the sheet surface parks rather than destroys frames). Collide and every frame gets the first frame's hatch. Also: the SVG is written with innerHTML as a string, so any id, colour or label interpolated in must be escaped.

**A 1..10 Z-index replacing Layer__DrawOrder / SitePlan__DrawOrder**

- *Where:* Na__SitePlan__Store__.js -> Na__SpStore__Layer (~246, the `Layer__DrawOrder ... : 50` default) and Na__SpStore__Describe (~267, the single `.sort((a,b) => a.Layer__DrawOrder - b.Layer__DrawOrder)`)
- *How:* Draw order is applied in EXACTLY ONE place: that sort, once, when the descriptor is built. Everything downstream - Na__SpStore__GetLayers(), SitePlanBuild's segment concatenation, the fills array, Na__LeModelLayers__Groups's site plan block, LoadAll's order - just inherits the sorted array. To move to a 1..10 Z-index, change the field read in Na__SpStore__Layer and the comparator in Describe, and decide the tie-break (today two layers with the same number keep manifest order, because Array.prototype.sort is stable). Note the fills array order is the SAME order as the lines, so a Z-index that means 'fills stack in this order' and 'lines stack in this order' comes free; a Z-index that means something different for fills than for lines needs a second sort inside SitePlanBuild.
- *Risk:* Layer__DrawOrder's default of 50 and the plan doc's values (71, 90) are a 0-100 scale. A 1..10 scale silently collides with that default unless the default changes too - every layer whose manifest predates the change would sort to 50, i.e. above every new 1-10 value.

**A 'Patterns' right-column panel**

- *Where:* Na__LayoutEditor__PanelHost__.js -> Na__LePanels__RegisterTab('right', { id, title }) and Na__LePanels__RegisterSection('right', { ..., tab : <id> }); registered from Na__LayoutEditor__ModeController__.js (~374-385)
- *How:* Copy the Scrapbook tab pattern exactly: Na__LePanelScrap__RegisterTab() at ~375 adds the tab, and the three library sections at ~383-385 name it with spec.tab. A Patterns panel is a new module under 36__System__HatchPatternTools (the empty folder already exists) exporting a Register() that calls RegisterTab then RegisterSection, plus a Register() call added to the mode controller's list. Controls are declared with data-na-control and wired with Na__LePanels__OnControl(type, name, handler).
- *Risk:* A section registered without spec.tab lands on the FIRST tab of that column ('properties'). Refresh skips sections that are off-tab, so a panel's data is not read until its tab is first opened - a pattern library that assumes it has been refreshed will be empty.

**A 'Site Plan Render Composites' left-column dropdown layering fill / pattern / linework**

- *Where:* Na__LayoutEditor__RenderComposites__.js + Na__LayoutEditor__RenderComposites__Config__.json, surfaced by Na__LayoutEditor__Panel__Styles__.js (registered left, title 'Render Composites')
- *How:* Two credible routes. (1) Add rows to LayoutEditor__RenderComposites__Layers with Composite__Key of e.g. sitePlanFill / sitePlanPattern / sitePlanLinework, Composite__Toggle true, Composite__Weight { Weight__Kind : 'none' } - then the toggles persist through the existing Viewport__Styles path, PROVIDED each key is also added to Na__LeRec__STYLE_KEYS (SheetRecords ~261); without that the normaliser drops them. (2) A composite PRESET dropdown that writes several style booleans at once, which is closer to the brief's wording ('layering fill / pattern / linework') - that needs a new record field and a new normaliser clause.
- *Risk:* The header of Panel__Styles__ states the rule explicitly: 'A composite row that carries a toggle still needs its key in the record layer's style list to persist; a config row alone gives a working label and weight, not a new render path.' Also the panel still shows its raster-only rows on a site plan viewport (a known open item in plan doc 8.4) - adding site plan rows without filtering by IsSitePlanViewport makes that worse.

**Per-layer fill colour / opacity / pattern overrides per viewport**

- *Where:* Na__LayoutEditor__EdgeStyles__.js -> Na__LeEdge__Effective / Na__LeEdge__Patch, and Na__LayoutEditor__SheetRecords__.js -> Na__LeRec__NormaliseProjectedEdges (~349)
- *How:* Plan doc 8.4 already nominates this: fill overrides join the Viewport__ProjectedEdges category record. Today Na__LeEdge__Effective returns { weight, colour, lineType, hex, patternMm, overridden } and Na__LeEdge__Default falls through Na__LeEdge__SitePlanDefault -> Na__LeModelLayers__EdgeDefault -> Fallback. A fill/pattern default would be added to SitePlanDefault (from layer.Layer__Style.FillHex / FillOpacity / a new FillPatternId) and to Effective's return; the patch shape in Na__LeEdge__Patch gains the new Category__Fill* fields.
- *Risk:* Na__LeRec__NormaliseProjectedEdges REBUILDS each kept entry from exactly four named fields (Category__Label, Category__EdgeWeightFactor, Category__EdgeColour, Category__EdgeLineType). Any new field is silently thrown away on the next normalise unless it is added there. The plan doc flags this too: 'Its normaliser rebuilds entries, so the two fields must be added there.'

**2D face meshes from a new 'Export Polygon Faces' exporter toggle**

- *Where:* Na__SitePlan__GlbParse__.js -> Na__SpGlb__Primitives (~213) and Na__SpGlb__ParseFill (~320); Na__SitePlan__Store__.js -> Na__SpStore__LoadLayer (~384) and Na__SpStore__Layer's url() helper (~237)
- *How:* The parser understands LINES (mode 1) and LINE_LOOP (mode 2) only; Na__SpGlb__MODE_DEFAULT = 4 (triangles) is defined and explicitly commented as 'which a site plan never has'. A face mesh needs a new public parse function (e.g. Na__SpGlb__ParseFaces) reading mode 4 with its indices, plus a manifest key beside Layer__FillFile (the store reads Layer__FillUrl from the project data key and Layer__FillFile from the manifest - both go through the same url(urlKey, fileKey) helper) and a third field on the geometry record that LoadLayer resolves alongside segments and rings.
- *Risk:* A fill GLB that fails to load is swallowed with a console.warn and the layer draws its lines alone (LoadLayer ~398-405); a face GLB should follow the same rule or a bad export blanks a drawing. Also the drawing mapping is drawX = X*1000, drawY = +Z*1000 - any new reader must use the SAME +Z, not -Z, or the site mirrors.

**Existing vs Proposed site plan folders (two R2 stores) auto-detected by folder**

- *Where:* Na__SitePlan__Store__.js - the whole module; particularly Na__SpStore__FOLDER (~84), Na__SpStore__FolderUrls (~145), Na__SpStore__Find (~282), and the module-level singletons Na__SpStore__Descriptor / LayerPromises / LayerData / Status / Generation (~102-108)
- *How:* The store is a SINGLETON today: one status, one descriptor, one layer-data Map, one CHANGED_EVENT. Two stores means either keying every piece of that state by a store id, or instantiating the module twice. The viewport then needs to say which store it draws - the natural home is the already-normalised, already-persisted open object Viewport__SitePlan (SheetRecords ~433 does Object.assign({}, viewport.Viewport__SitePlan), so an added sub-key survives the normaliser with no code change; the record comment says it is 'an object with room for the settings still to come').
- *Risk:* Na__LeVp2d__SitePlanToken embeds only descriptor.SitePlan__ExportedIso; two stores exporting at the same instant would produce identical tokens and one viewport would paint the other's cached SVG. The store id must go into the token. Also the PDF exporter calls Na__LeVp2d__SitePlanDrawing(viewport) which calls the module-level Resolve/LoadAll with no store argument.

### Traps

- THE PAINT CACHE KEY IS Na__LeVp2d__SitePlanPaintKey (SitePlan unit ~124) AND IT HAS FOUR PARTS ONLY: Na__LeVp2d__SitePlanToken(viewport) + '|' + viewport.Viewport__ScaleDenominator + '|' + masterPt + '|' + Na__LeVp2d__StyleToken(viewport). SitePlanToken (~115) = 'siteplan:' + descriptor.SitePlan__ExportedIso + ':' + Na__LeModelLayers__Token(viewport). StyleToken (Linework ~183) = Na__LeEdge__Token(viewport) + '#' + Na__LeComposite__Token(viewport). SO: the export time, the layers switched OFF, the scale denominator, the sheet master lineweight, every per-category edge override, and every composite weight. A new fill or pattern setting that is NOT in one of those tokens will paint stale forever, because FillSitePlan's fast path (~270) sees lineworkKey === paintKey and only re-writes the viewBox. Note what is deliberately ABSENT: the pan and the frame size (the viewBox handles them) and the store identity (there is only one store today).
- A SECOND CACHE SITS BEHIND THE FIRST: Na__LeVp2d__BandPaths (Linework ~338) is called with the key built.key + '@false@' + styleToken and files the path STRINGS in Na__LeVp2d__PathCache, a 16-entry FIFO shared with every architectural viewport. built.key is only SitePlanToken - NOT the scale, NOT the master weight. That is correct today because a band's path data does not depend on scale (widths are applied as attributes), but a pattern whose geometry is generated per scale must NOT be cached under that key. Na__LeVp2d__ForgetPaths(key) (~324) is the only way to clear it and is called only from a forced EnsureLinework - the site plan force path (Viewport2d__ ~417-424) does NOT call it, it nulls state.lineworkKey and relies on built.key changing because Na__SpStore__Reload produces a new descriptor. If a new export has the SAME SitePlan__ExportedIso, Force Render will re-fetch the GLBs and then paint the cached old paths.
- THE THIRD CACHE IS THE STORE ITSELF: Na__SpStore__LayerPromises is keyed categoryKey + '|' + exportedIso and Na__SpStore__LayerData by categoryKey alone. Only Na__SpStore__Reload() clears them (it also bumps Na__SpStore__Generation so a slower in-flight read is dropped). A second store sharing this Map would collide on categoryKey.
- Na__LeRec__NormaliseProjectedEdges (SheetRecords ~349) REBUILDS every kept entry from four named fields and drops everything else. Add a fill hex, a fill opacity or a pattern id to a category entry without adding it here and it vanishes on the next save, undo or draft restore - not at write time, so it looks like it worked.
- Na__LeRec__STYLE_KEYS (SheetRecords ~261) is the closed list of viewport style booleans. A new Render Composites toggle row gives you a label and a control but no persistence until its key joins that array (Na__LeModel__UpdateViewport's styles clause iterates STYLE_KEYS, SheetModel__Viewports__ ~259).
- THE EDGE STYLE PRUNER IS GATED ON BOTH CONFIGS. Na__LeEdge__IsLoaded() requires Na__LeEdge__Config !== null AND Na__LeModelLayers__IsLoaded(); until both fetches land, stored entries are cleaned but never dropped. Site plan categories are exempt from the prune entirely (SheetRecords ~368, keyed on Na__LeRec__SITEPLAN_CATEGORY_PREFIX) BECAUSE their default is not knowable until the site plan data has loaded. A fill/pattern default that also comes from the export inherits exactly this hazard.
- CONFIG LOAD ORDER: Na__LeEdge__Ready() awaits Na__LeModelLayers__Ready() before fetching its own file (~154). Na__LeEdge__SitePlanDefault additionally needs Na__SpStore__GetLayers() to be populated - it returns null before the site plan data has loaded, so an edge style resolved too early silently falls back to black/solid/1.00. Any pattern library config must be added to this readiness chain or a first paint will use fallbacks and the second will not, and the paint key will not change between them.
- THE SITE PLAN SVG CARRIES NO IDENTITY. No <g>, no id, no class, no data- attribute on any path in Na__LeVp2d__PaintSitePlan. Nothing downstream can find a layer's paths in the DOM. Any toggle that works by hiding elements has to add that grouping first.
- THE LAYER STACK IS DOM ORDER, NOT z-index (Na__LayoutEditor__Styles__Main__Paper__.css ~121-155 sets no z-index at all). Na__LeVp2d__State (Frame ~147) appends underlay, linework, markup, empty, progress in that order and does body.innerHTML = '' first. Inserting a new sibling DIV layer means editing State, and every existing state object in memory (and every PARKED one held by the sheet surface) was built without it - State only rebuilds when state.body !== body.
- PARKED STATES ARE NOT IN Na__LeVp2d__States. Na__LeVp2d__Park (Frame ~261) deletes the entry and hands the state to the sheet surface; viewport ids repeat on every sheet. Every async continuation in the site plan unit guards with Na__LeVp2d__States.get(viewportId) !== state (RefillSitePlan ~291) - which means a site plan repaint that completes while its sheet is parked is DROPPED, unlike the architectural linework path which explicitly allows state.parked (Viewport2d__ ~348). Adding an async pattern generator will hit this.
- NA__SPSTORE ANNOUNCES ON A MICROTASK ON PURPOSE. Na__SpStore__Dispatch (~126) queueMicrotasks the CustomEvent because a synchronous announce caused an infinite recursion (the Model Layers panel refreshed on 'loading' and called Resolve again) - fixed in store 1.0.1. Any new listener on na-siteplan-store-changed must not call Resolve synchronously in a way that can re-enter.
- THE PDF IS A SEPARATE PAINTER AND WILL SILENTLY LOSE A NEW LAYER. Na__LePdf__DrawSitePlanFills (PdfExporter ~246) draws ONLY ring.outer rings as separate polygons, so holes are not cut on paper (screen uses evenodd and does cut them) - a known, documented divergence. Na__LePdf__DrawLinework drops chords under setup.minSegmentPaperMm (0.05 mm, i.e. 25 mm of site at 1:500). jsPDF has no SVG <pattern>: a hatch must be printed as real vectors or a raster, and per memory, jsPDF 4.1.0 'RGBA' addImage drops alpha, so a translucent pattern raster prints opaque - use a PNG data URL.
- THE PLAN DOC'S LINE NUMBERS ARE STALE. Section 8.4 cites 'Viewport2d__ Fill ~596', 'PaintLinework / StyleBands ~348-492', 'GetSnapSource ~738-747' - all from BEFORE the 15-Sep-2026 four-way split into Window / Frame / Linework / SitePlan units. Section 8.4 also claims 'Segments are culled to the window' and that the segments go in the AUTHORED class; the built code culls nothing and puts everything in VISIBLE. Read the code, not the plan, for what is there.
- Na__LeModelLayers__ExcludeTokens is NOT how a site plan hides a layer. A site plan layer is filtered by OWNER in Na__LeVp2d__SitePlanBuild (~146, the Na__LeModelLayers__IsOn filter) before the segments are ever concatenated - the exclusion-token route is projection-only. So switching a layer off changes built.key (via Na__LeModelLayers__Token inside SitePlanToken) and rebuilds the whole SVG. A fill or pattern that is built elsewhere must apply the same IsOn filter itself.
- 36__System__HatchPatternTools EXISTS AND IS EMPTY (created 20-Sep-2026 13:02). There is no hatch or pattern code anywhere in the app - a repo-wide grep for 'hatch' returns only vendored three.js and unrelated prose about 'escape hatches'. Do not assume a partial implementation is waiting there.
- GIT STATE AT SURVEY TIME: the working tree is dirty with ~25 modified files across the drawing view, floor plan, elevation, north direction, drawing planes and layout editor mode controller (v2.82.0-2.87.0 work, uncommitted). None of the eight files this survey was asked to read in full is among them - the site plan paint path is clean and matches HEAD.

### Open questions raised by this survey

- Layer__DrawOrder defaults to 50 in Na__SpStore__Layer and the plan doc uses 71/90 - a 0-100 scale. Does the new 1..10 Z-index replace that field name, or is it a new field with Layer__DrawOrder kept for back-compatibility? If the field name is reused, every existing manifest (PS01's, exported 14-Sep) sorts every layer to 50.
- Is the Z-index meant to order the FILLS separately from the LINES? Today one sorted array drives both (fills in SitePlanBuild are derived from the same `loaded` array, so their order is the line order). 'Every fill is drawn under every line' (plan doc 5.2) is enforced structurally by PaintSitePlan writing all fills before all bands - a per-layer Z-index that interleaves them would break that rule.
- Are the three composite layers (fill / pattern / linework) per-VIEWPORT or per-SHEET? Viewport__Styles and Viewport__CompositeWeights are both per-viewport, and 'a left-column dropdown' in this app means the selected viewport (the Render Composites panel edits Na__LeModel__GetSelectedViewport()). Confirm before choosing the record field.
- Which store does a viewport draw from, once there are two (Existing / Proposed)? Viewport__SitePlan is an object that already survives the normaliser untouched, so a sub-key there is the cheapest home - but the store module is a singleton and the PDF's Na__LeVp2d__SitePlanDrawing(viewport) has no way to pass a store id today.
- Does a hatch pattern belong to the LAYER (from the SSOT / manifest, like LineHex and FillHex do) or to the VIEWPORT (an override in Viewport__ProjectedEdges)? The existing site plan convention is that style travels with the data and the viewport may override - following it means a new SitePlan__FillPatternId in the SSOT and a Layer__Style.FillPatternId in the manifest, which is an exporter change, not a TrueVision one.
- Does the hatch measure in PAPER millimetres (like LineType__PatternMm, which is multiplied by the denominator at paint time) or in DRAWING millimetres (real site dimensions)? A 45-degree hatch on a 1:1250 location plan is a very different object under the two answers, and the SVG <pattern> patternTransform has to be written accordingly.
- Should the PDF print a pattern as real vectors (slow, large file, exact) or as a raster tile (fast, but jsPDF 4.1.0's RGBA path prints transparent images opaque - it would need a PNG data URL)? This decides whether Na__LePdf__DrawSitePlanFills gains a pattern pass or a whole new printer.
- Plan doc 8.4 lists three still-open site plan items - the Styles panel showing raster-only rows on a site plan viewport, PDF fill holes, and per-viewport fill overrides. Are any of those in scope for this build, or does the new work go on top of them?

---

<a id="area-8"></a>
## 8. TrueVision vector fill / pattern / tiling mechanisms, the sheet SVG + <defs>, gradient-to-PDF survival, and the scale/rotate levers a hatch pattern panel can reuse

### Summary

LINE NUMBERS BELOW ARE POINTERS ONLY — find every symbol by name, not by line.

**The one-list architecture.** Everything printed on a sheet is described once as a flat list of paper-millimetre primitives and then painted twice, by two painters that live side by side in `Na__LayoutEditor__SheetChrome__.js` (namespace `Na__LeChrome`). The primitive kinds are `rect`, `line`, `polyline`, `text`, `image`, `qr`, `group` (constants `Na__LeChrome__KIND_RECT` … `Na__LeChrome__KIND_GROUP`, ~line 151). `Na__LeChrome__ToSvgMarkup(primitives, pageWidthMm, pageHeightMm, cssClassName)` serialises the list to a standalone `<svg>` string whose viewBox IS the paper in millimetres; `Na__LeChrome__DrawToPdf(doc, primitives)` walks the same list into jsPDF, which is also in `mm`. This is the rule the hatch generator must obey: **anything new is a new primitive kind, or a new optional field on `polyline`, painted by BOTH `Na__LeChrome__ToSvg` and `Na__LeChrome__ToPdf`.** The `qr` primitive (v1.9.0, 19-Sep-2026) is the most recent worked example of adding a kind: the primitive carries the abstract symbol, not a picture of one, and each painter delegates to a leaf module (`Na__QrPaint__SvgGroup` / `Na__QrPaint__DrawPdf`). A hatch should follow that shape exactly.

**What already does vector fill.** There is exactly one general fill mechanism and one specialised one.

(1) THE GRADIENT — `Na__LayoutEditor__GradientTool__.js`, namespace `Na__LeGrad`, record key `Shape__Gradient` (constant `Na__LeGrad__FIELD`). This is the ONLY SVG-native paint-server in the app. `Na__LeGrad__SvgPaint(points, gradient)` returns `{ defs, fill }` where `defs` is a `<defs><linearGradient id="naLeGradN" gradientUnits="userSpaceOnUse" …>` fragment and `fill` is the matching `url(#naLeGradN)`. Ids come from a module counter `Na__LeGrad__IdCounter` that is deliberately **never reset** (chrome, markup and focus SVGs share one document). The gradient is fitted to the shape, not to a bounding box, via `Na__LeGrad__Axis(points, angleDeg)` which returns `{u, v, aMin, aMax, bMin, bMax}` — a rotated, shape-fitted extent solver the hatch generator can reuse verbatim for pattern tiling extents. Colour is one function, `Na__LeGrad__ColourAt(gradient, t)`, used by screen, PDF and the CSS swatch (`Na__LeGrad__PreviewCss`), so they cannot drift.

(2) THE SITE PLAN FILL — `Na__LayoutEditor__Viewport2d__SitePlan__.js`, namespace `Na__LeVp2d`. This is hand-built geometry, not a paint server. `Na__LeVp2d__SitePlanBuild` collects `fills` as `[{categoryKey, hex, opacity, rings}]` from each loaded layer's `Layer__Style.FillHex` / `Layer__Style.FillOpacity`; `Na__LeVp2d__RingPathData(rings)` concatenates every ring into ONE `d` string and `Na__LeVp2d__PaintSitePlan` writes `<path d="…" fill=hex fill-opacity=… fill-rule="evenodd" stroke="none"/>` (~line 214) into the frame's own linework SVG (`state.linework.innerHTML`), UNDER the styled line bands. This is the polygon stream the coming OS-mapping hatches will have to fill, and it already has even-odd hole cutting on screen.

**Where <defs> lives: nowhere central.** There is no document-level `<defs>`. `Na__LeChrome__ToSvg` emits a `<defs>` fragment inline immediately before the path that uses it (gradient case, ~line 584) and emits `<clipPath id="naLeClipN">` inline before the `<g clip-path>` that uses it (group case, ~line 612), with ids from a per-render `clipCounter` object `{n:0}` created in `Na__LeChrome__ToSvgMarkup`. The whole SVG is built as a STRING and swapped into the DOM by `Na__LeSurface__SwapSvg(current, markup, className, before)` in `Na__LayoutEditor__SheetSurface__.js` — three separate SVG layers on the paper (`Na__LeSurface__ChromeSvg`, `Na__LeSurface__MarkupSvg`, `Na__LeSurface__FocusSvg`), plus per-frame linework SVGs owned by the viewport modules. A `<pattern>` would therefore be emitted the same way the gradient's `<defs>` is, and **ids must be globally unique across all those layers**, i.e. a never-reset module counter like `Na__LeGrad__IdCounter`, not the per-render `clipCounter`.

**How a gradient survives the PDF.** It does not survive as a shading — it becomes a raster. `Na__LeGrad__DrawPdf(doc, points, gradient)`: builds a 2-row PNG strip by sampling `Na__LeGrad__ColourAt` across the axis (`Na__LeGrad__StripPng`, `Rendering__PdfSamplesPerMm` 4, clamped 64..2048), pads the strip ~2% + 1 mm on all four sides, sets the shape outline as a clip with `doc.lines(rel, x, y, [1,1], null, true)` + `doc.clip()` + `doc.discardPath()`, then `doc.addImage(png, 'PNG', cornerX, cornerY - bLen, aLen, bLen, undefined, undefined, angleDeg)` inside `saveGraphicsState`/`restoreGraphicsState`. It MUST be PNG: jsPDF 4.1.0's `processRGBA` returns alpha under a key the image writer never reads, so raw RGBA prints a fade as a solid block. `Na__LeChrome__ToPdf`'s polyline branch runs the gradient in THREE passes — solid fill, gradient clipped, edges on top (~line 720) — so the tone can never paint over an edge. Opacity generally goes through `Na__LeChrome__WithOpacity(doc, fillAlpha, strokeAlpha, draw)` using `doc.GState({'opacity', 'stroke-opacity'})` inside save/restore.

**The repeating-pattern precedents are the DASH machinery, not a pattern server.** `Na__LayoutEditor__LineStyleTool__.js` (namespace `Na__LeDash`, record `Shape__LineStyle`) is the app's model for "a named preset library + a per-use scale". Its config carries a `LayoutEditor__LineStyleTool__Kinds` array of presets with `Kind__Alias/Label/DashMm/GapMm/MarkMm/Note`, and `LineStyle__Scale` is a **multiplier applied at paint time** (`Na__LeDash__PatternMm`), never a rewrite of the stored millimetres — `Meta__WhereScaleGoes` in the config spells the rule out. `Na__LeDash__With` reloads a kind's figures on a kind change and KEEPS the scale. `Na__LeDash__PreviewMarkup` draws the swatch as an inline SVG at 4 px per paper mm. Both painters consume the result through `Na__LeChrome__DashList(primitive)` → SVG `stroke-dasharray` / jsPDF `setLineDashPattern`.

**The parametric scrapbook is the geometry generator to copy.** `Na__LayoutEditor__ScrapbookParametric__.js` (namespace `Na__LeParam`). A type is registered with `Na__LeParam__RegisterType(definition)` where `definition.build(params, tools)` is PURE — parameters in, `{records:[{kind, record}]}` out, in paper millimetres from an origin of (0,0), knowing nothing of sheets, ids, layers or the DOM. Anything the build needs from the editor is injected via `Na__LeParam__SetTools({measureTextMm})`. The scale bar (`Na__LeParamBar__Build`) is the closest cousin to a hatch generator: it emits N repeated closed `Shape__Points` rectangles from a division pitch and a count, with a parity alternation. Regeneration edits members in place slot-for-slot so ids survive and one change is one undo step.

**Empty scaffolding already on disk.** `02__Src__AppModules/51__System__LayoutEditor/36__System__HatchPatternTools/` exists and is EMPTY — the numbered slot is already reserved between `35__System__DrawingTools` and `40__Ui__Panels`. `52__LayoutEditor__HatchPatternLibrary/` at the app root holds two reference PNGs (`OS_Symbol__Examples__.png`, `OS_Symbol__Examples__Woodland&Water__.png`) and five empty pack folders: `01__GeometricHatches`, `02__ConstructionMaterialHatches`, `03__Placeholder`, `04__Placeholder`, `05__SitePlanHatches`. That naming mirrors `51__LayoutEditor__UserScrapbookContent/` (`01__ScrapbookItems__General` … `05__ScrapbookItems__GeneralNotes`), whose serving contract is fully specified in `Na__LayoutEditor__ScrapbookCustom__Config__.json` → `LayoutEditor__ScrapbookCustom__Library`: `Library__ContentFolder`, `Library__IndexFile` (`UserScrapbook__Index__.json`), `Library__ApiPath` (`/api/truevision/scrapbook`), `Library__Categories[].Category__Folder/Category__Name`. `Na__LayoutEditor__ScrapbookCustom__Transport__.js` is the only module that knows where files live: it resolves the app root with `new URL('../../../', import.meta.url)`, reads the index from the API on the ProjectVision local server and from the flat index file everywhere else (static server, live site), and treats a server answering `/api/health` but not the library routes as "needs a restart".

**Draw order already exists for site plan layers.** `Na__SitePlan__Store__.js` → `Na__SpStore__Layer` reads `Layer__DrawOrder` (default 50) and `Na__SpStore__Describe` sorts layers by it, lowest first ("so the red line ends on top"). The coming 1..10 Z-index is a re-expression of this field, not a new concept. `Na__SpStore__Style` is the style normaliser and it STRIPS anything it does not name — today `LineColourId, LineHex, LineType, LineWeightMm, FillColourId, FillHex, FillOpacity`. A `HatchId` / `HatchScale` / `HatchRotation` added to the SSOT and the manifest will be silently dropped unless it is added there too.

**Render Composites already exists** (`25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js` + `__Config__.json`, namespace `Na__LeComposite`, record `Viewport__CompositeWeights`), and its panel is registered on the LEFT column as `Na__LayoutEditor__Panel__Styles__.js` with the title label `StylesTitle` → "Render Composites". The config is a list of `Composite__Key/Label/TwoDOnly/Toggle/Order/Note/Weight{Weight__Kind|Default|Min|Max|Step|Label}` rows, and `Composite__Key` is explicitly declared un-renameable (saved viewports hold it). The "Site Plan Render Composites" dropdown belongs here, as rows in this config.

### Files that matter

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\10__Core__SheetSurface\Na__LayoutEditor__SheetChrome__.js`
*Version:* 1.9.0 (19-Sep-2026)

THE hub. Defines the primitive list and both painters (SVG string + jsPDF). Every fill, pattern or tile must be paintable from here or it exists on only one surface. 881 lines, version 1.9.0.

*Key symbols:* `Na__LeChrome__KIND_RECT`, `Na__LeChrome__KIND_LINE`, `Na__LeChrome__KIND_POLYLINE`, `Na__LeChrome__KIND_TEXT`, `Na__LeChrome__KIND_IMAGE`, `Na__LeChrome__KIND_QR`, `Na__LeChrome__KIND_GROUP`, `Na__LeChrome__PushPolyline(list, points, strokeColour, strokeMm, fillColour, closed, gradient, extra)`, `Na__LeChrome__PushRect`, `Na__LeChrome__PushGroup(list, clipRect, children)`, `Na__LeChrome__PushQr`, `Na__LeChrome__Alpha(value)`, `Na__LeChrome__DashList(primitive)`, `Na__LeChrome__ToSvg(primitive, style, clipCounter)`, `Na__LeChrome__ToSvgMarkup(primitives, pageWidthMm, pageHeightMm, cssClassName)`, `Na__LeChrome__ToPdf(doc, primitive, style)`, `Na__LeChrome__DrawToPdf(doc, primitives)`, `Na__LeChrome__WithOpacity(doc, fillAlpha, strokeAlpha, draw)`, `Na__LeChrome__Rgb(hexColour)`, `Na__LeChrome__R(value)`, `Na__LeChrome__Escape(value)`, `Na__LeChrome__MeasureTextMm`, `Na__LeChrome__LoadAsset`, `Na__LeChrome__CachedAsset`, `Na__LeChrome__ASSET_EVENT`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__GradientTool__.js`
*Version:* 1.0.0 (13-Sep-2026)

The ONLY SVG-native paint server in the app, and the only existing 'one colour function, two surfaces' fill. Its SvgPaint/DrawPdf pair is the exact template for a hatch. 787 lines.

*Key symbols:* `Na__LeGrad__FIELD ('Shape__Gradient')`, `Na__LeGrad__BLOCK ('gradient')`, `Na__LeGrad__CONTROLS`, `Na__LeGrad__ConfigUrl`, `Na__LeGrad__IdCounter (never reset)`, `Na__LeGrad__Ready()`, `Na__LeGrad__Block(name)`, `Na__LeGrad__Defaults()`, `Na__LeGrad__Rendering()`, `Na__LeGrad__Label(key, fallback)`, `Na__LeGrad__Normalise(raw)`, `Na__LeGrad__Create()`, `Na__LeGrad__With(gradient, patch)`, `Na__LeGrad__Exponent(gradient)`, `Na__LeGrad__Mix(gradient, weight)`, `Na__LeGrad__ColourAt(gradient, t)`, `Na__LeGrad__Stops(gradient)`, `Na__LeGrad__Axis(points, angleDeg)`, `Na__LeGrad__SvgPaint(points, gradient)`, `Na__LeGrad__StripPng(gradient, axis, aStart, aLen)`, `Na__LeGrad__DrawPdf(doc, points, gradient)`, `Na__LeGrad__PreviewCss(gradient)`, `Na__LeGrad__BuildRows(body)`, `Na__LeGrad__RefreshRows(body, state)`, `Na__LeGrad__RegisterControls(host)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__GradientTool__Config__.json`
*Version:* 1.0.0

The config-file shape a hatch config should copy: Meta / Defaults / Rendering / Labels blocks, all keys prefixed 'LayoutEditor__GradientTool__'. Meta__WhyThePdfIsAStrip states the jsPDF alpha rule. 49 lines.

*Key symbols:* `LayoutEditor__GradientTool__Meta`, `LayoutEditor__GradientTool__Defaults`, `LayoutEditor__GradientTool__Rendering`, `LayoutEditor__GradientTool__Labels`, `Rendering__CurveStops (32)`, `Rendering__PdfSamplesPerMm (4)`, `Rendering__PdfMinSamples (64)`, `Rendering__PdfMaxSamples (2048)`, `Meta__WhyThePdfIsAStrip`, `Meta__WhereTheEndsSit`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__LineStyleTool__.js`
*Version:* 1.0.0 (14-Sep-2026)

The app's existing 'preset library + per-use SCALE multiplier' pattern. The closest thing to a repeating-fill library that already ships, and the precedent for Adam's per-use scale. 561 lines.

*Key symbols:* `Na__LeDash__FIELD ('Shape__LineStyle')`, `Na__LeDash__BLOCK ('dash')`, `Na__LeDash__KINDS ['dashed','dotted','centre','hidden']`, `Na__LeDash__Ready()`, `Na__LeDash__Defaults()`, `Na__LeDash__Bounds()`, `Na__LeDash__Kinds()`, `Na__LeDash__Preset(kind)`, `Na__LeDash__Normalise(raw)`, `Na__LeDash__Create(kind)`, `Na__LeDash__With(style, patch)`, `Na__LeDash__PatternMm(raw)`, `Na__LeDash__PreviewMarkup(style)`, `Na__LeDash__BuildRows(body)`, `Na__LeDash__RefreshRows(body, state)`, `Na__LeDash__RegisterControls(host)`, `LineStyle__Kind`, `LineStyle__Scale`, `LineStyle__DashMm`, `LineStyle__GapMm`, `LineStyle__MarkMm`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\35__System__DrawingTools\Na__LayoutEditor__LineStyleTool__Config__.json`
*Version:* 1.0.0

The preset-library config shape a hatch pattern library should copy verbatim: a Kinds ARRAY of presets, a Bounds block with min/max/step for both millimetres and scale, and a Labels block. 56 lines.

*Key symbols:* `LayoutEditor__LineStyleTool__Kinds`, `Kind__Alias`, `Kind__Label`, `Kind__DashMm`, `Kind__GapMm`, `Kind__MarkMm`, `Kind__Note`, `LayoutEditor__LineStyleTool__Bounds`, `Bounds__MinMm (0.1)`, `Bounds__MaxMm (40)`, `Bounds__MinScale (0.25)`, `Bounds__MaxScale (4)`, `Bounds__StepScale (0.05)`, `Meta__WhereScaleGoes`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\15__Core__Markup\Na__LayoutEditor__ShapeGeometry__.js`
*Version:* 1.5.0 (14-Sep-2026)

Turns a shape record into ONE polyline primitive and decides what counts as a fill for hit testing. Any hatch on a vector shape passes through Push and Hit. 303 lines.

*Key symbols:* `Na__LeShapeGeo__Points(shape)`, `Na__LeShapeGeo__Segments(shape)`, `Na__LeShapeGeo__Bounds(shape)`, `Na__LeShapeGeo__Translated(points, dx, dy)`, `Na__LeShapeGeo__Contains(shape, point)`, `Na__LeShapeGeo__Hit(shape, point, toleranceMm)`, `Na__LeShapeGeo__ClosestOnEdge(shape, point)`, `Na__LeShapeGeo__InsertPoint(points, edgeIndex, pt)`, `Na__LeShapeGeo__StrokeMm(shape)`, `Na__LeShapeGeo__Push(list, shape)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\10__Core__SheetSurface\Na__LayoutEditor__SheetSurface__.js`
*Version:* 1.6.0 (18-Sep-2026)

Where the SVG strings become DOM. Three paper-level SVG layers, each rebuilt whole and swapped in. Explains why pattern ids must be unique across layers, and holds the viewport cache that parks frames. 697 lines.

*Key symbols:* `Na__LeSurface__SwapSvg(current, markup, className, before)`, `Na__LeSurface__ChromeSvg`, `Na__LeSurface__MarkupSvg`, `Na__LeSurface__FocusSvg`, `Na__LeSurface__Handles`, `Na__LeSurface__Paper`, `Na__LeSurface__Frames`, `Na__LeSurface__Layout`, `Na__LeChrome__ToSvgMarkup (called 3x)`, `Na__LeMarkup__BuildSheetPrimitives`, `Na__LeMarkup__BuildItemPrimitives`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js`
*Version:* 1.0.0 (15-Sep-2026)

THE site plan fill today: hand-built even-odd ring paths under the styled line bands, written into the frame's own linework SVG. This is where OS-mapping hatch fills will have to land on screen. 300+ lines.

*Key symbols:* `Na__LeVp2d__SitePlanToken(viewport)`, `Na__LeVp2d__SitePlanPaintKey(viewport, masterPt)`, `Na__LeVp2d__SitePlanBuild(viewport, allowMissing)`, `Na__LeVp2d__SitePlanDrawing(viewport)`, `Na__LeVp2d__RingPathData(rings)`, `Na__LeVp2d__PaintSitePlan(state, viewport, built, ppm)`, `Na__LeVp2d__FillSitePlan(state, sheet, viewport, ppm)`, `Na__LeVp2d__RefillSitePlan`, `built.fills = [{categoryKey, hex, opacity, rings}]`, `state.linework.innerHTML`, `state.lineworkKey`, `state.classes`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js`

The site plan SSOT reader. Its style normaliser strips unknown keys; its layer normaliser holds Layer__DrawOrder, the existing draw-order field the 1..10 Z-index replaces.

*Key symbols:* `Na__SpStore__Style(raw)`, `Na__SpStore__Layer(raw, source, folderUrls)`, `Na__SpStore__Describe(raw, source, folderUrls)`, `Na__SpStore__Bounds(raw)`, `Na__SpStore__Resolve()`, `Na__SpStore__LoadAll()`, `Na__SpStore__GetStatus()`, `Na__SpStore__GetNote()`, `Na__SpStore__GetDescriptor()`, `Na__SpStore__GetLayerData(categoryKey)`, `Na__SpStore__STATUS_READY`, `Na__SpStore__STATUS_EMPTY`, `Layer__CategoryKey`, `Layer__TagName`, `Layer__Label`, `Layer__Group`, `Layer__DrawOrder`, `Layer__LineworkUrl`, `Layer__FillUrl`, `Layer__Style`, `Layer__VisibleAtScales`, `Layer__SegmentCount`, `Layer__BoundsMm`, `LineColourId`, `LineHex`, `LineType`, `LineWeightMm`, `FillColourId`, `FillHex`, `FillOpacity`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__GlbParse__.js`

Parses the exporter's GLBs. ParseFill reads LINE_LOOP rings; this is where the coming 'Export Polygon Faces' 2D face meshes will need a reader (today faces are rings, never triangles).

*Key symbols:* `Na__SpGlb__ParseFill(bytes)`, `Na__SpGlb__CloseBounds(bounds)`, `rings [{face, outer, points[x,y,...]}]`, `ringCount`, `boundsMm`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\60__Feature__PdfExport\Na__LayoutEditor__PdfExporter__.js`

How a site plan fill reaches paper today, and where the compress flag lives. 415 lines.

*Key symbols:* `Na__LePdf__DrawSitePlanFills(doc, viewport, described, fills)`, `Na__LePdf__DrawLinework(doc, sheet, viewport, described, classes)`, `Na__LePdf__DrawViewport(doc, sheet, viewport, options)`, `Na__LePdf__BeginClip(doc, rect)`, `Na__LePdf__EndClip(doc, clipped)`, `Na__LePdf__Rgb(hex)`, `Na__LePdf__Offset`, `Na__LePdf__Filename(sheet, layout)`, `new JsPdf({... compress : true, putOnlyUsedFonts : true})`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\57__Feature__ScrapbookParametric\Na__LayoutEditor__ScrapbookParametric__.js`
*Version:* 1.2.0 (20-Sep-2026)

The scripted-geometry engine. Pure build(params, tools) -> records, in-place regeneration, tools injection. The hatch generator is the same species. 744 lines.

*Key symbols:* `Na__LeParam__FIELD ('Group__Parametric')`, `Na__LeParam__BLOCK_VERSION`, `Na__LeParam__PREFIX`, `Na__LeParam__RegisterType(definition)`, `Na__LeParam__GetType(type)`, `Na__LeParam__SetTools(tools)`, `Na__LeParam__Ready()`, `Na__LeParam__GetStatus()`, `Na__LeParam__Block(name)`, `Na__LeParam__Label(key, fallback, tokens)`, `Na__LeParam__ElementsFor(sheet)`, `Na__LeParam__ElementId/ElementName/ElementParams/ElementPreviewParams`, `Na__LeParam__TypeName(type)`, `Na__LeParam__GetBlock(group)`, `Na__LeParam__GetParams(sheet, groupId)`, `Na__LeParam__MakeBlock(type, params, link)`, `Na__LeParam__Portable(groupRecord)`, `Na__LeParam__BuildSet`, `Na__LeParam__Insert`, `Na__LeParam__Regenerate`, `Na__LeParam__AnchorOf`, `Parametric__Type`, `Parametric__Version`, `Parametric__Params`, `Parametric__Link`, `definition.defaults(denominator)`, `definition.normalise(params)`, `definition.build(params, tools)`, `definition.handles(params)`, `definition.stretchTo(params,xMm,yMm)`, `definition.describe(params)`, `definition.facts`, `definition.keep`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\57__Feature__ScrapbookParametric\Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js`

The worked example of repeated geometry from a pitch and a count — the nearest existing code to a hatch tile generator. 437 lines.

*Key symbols:* `Na__LeParamBar__Normalise(config, params)`, `Na__LeParamBar__Metrics(config, params)`, `Na__LeParamBar__Build(config, params)`, `Na__LeParamBar__Numeral(realMm, units)`, `Na__LeParamBar__LabelledDivisions(config, params, metrics)`, `Na__LeParamBar__Handles`, `Na__LeParamBar__StretchTo`, `Na__LeParamBar__EPSILON`, `Na__LeParamBar__STEPS`, `Na__LeParamBar__UNITS`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\57__Feature__ScrapbookParametric\Na__LayoutEditor__ScrapbookParametric__Config__.json`

How a scripted-element library is declared in config: an Elements__List of presets, each naming a registered type. 210 lines.

*Key symbols:* `LayoutEditor__ScrapbookParametric__Elements`, `Elements__List`, `Elements__TypeNames`, `Element__Id`, `Element__Type`, `Element__Name`, `Element__Params`, `Element__PreviewParams`, `Element__DrawingTypes`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\56__Feature__ScrapbookCustom\Na__LayoutEditor__ScrapbookCustom__Transport__.js`
*Version:* 1.0.0 (19-Sep-2026)

The ONLY module that knows where a content library lives on disk and whether a server is involved. A Patterns library that ships files must copy this, not reinvent it.

*Key symbols:* `Na__LeScrapCustomIo__AppRootUrl (new URL('../../../', import.meta.url))`, `Na__LeScrapCustomIo__ServerService ('na-projectvision-local-dev')`, `Na__LeScrapCustomIo__SOURCE_API/SOURCE_FILE/SOURCE_NONE`, `Na__LeScrapCustomIo__WHY_NO_SERVER`, `Na__LeScrapCustomIo__WHY_RESTART`, `Na__LeScrapCustomIo__INDEX_ITEMS`, `Na__LeScrapCustomIo__Place`, `Na__LeScrapCustomIo__Configure(library)`, `Na__LeScrapCustomIo__FileUrl(relativePath)`, `Na__LeScrapCustomIo__ApiUrl(suffix)`, `Na__LeScrapCustomIo__IsProjectVisionServer()`, `Na__LeScrapCustomIo__ReadIndex`, `Na__LeScrapCustomIo__ReadItem`, `Na__LeScrapCustomIo__Save`, `Na__LeScrapCustomIo__Delete`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\56__Feature__ScrapbookCustom\Na__LayoutEditor__ScrapbookCustom__Config__.json`
*Version:* 1.0.0

The folder + index + API contract for a file-backed content library, and the exact folder-naming convention the hatch pack folders already copy.

*Key symbols:* `LayoutEditor__ScrapbookCustom__Library`, `Library__ContentFolder ('51__LayoutEditor__UserScrapbookContent')`, `Library__IndexFile ('UserScrapbook__Index__.json')`, `Library__ApiPath ('/api/truevision/scrapbook')`, `Library__MaxNameLength`, `Library__AllowedKinds`, `Library__Categories`, `Category__Folder`, `Category__Name`, `Meta__Files`, `Meta__Saving`, `Meta__Portable`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\55__Feature__Scrapbook\Na__LayoutEditor__Scrapbook__.js`

The Standard library and, crucially, PreviewSvg — how a library tile draws a real preview by running the sheet markup builder over a throwaway sheet. A pattern swatch should do exactly this.

*Key symbols:* `Na__LeScrap__TAB_ID`, `Na__LeScrap__Ready()`, `Na__LeScrap__GetStatus()`, `Na__LeScrap__Label`, `Na__LeScrap__ItemsFor(sheet)`, `Na__LeScrap__GetItem`, `Na__LeScrap__ItemName`, `Na__LeScrap__Bounds`, `Na__LeScrap__BuildSet(itemId)`, `Na__LeScrap__PreviewSvg(set, className)`, `Na__LeScrap__Insert(sheet, itemId, centreMm)`, `Na__LeScrap__PREVIEW_PAD_MM`, `Na__LeScrap__KIND_SHAPE/KIND_ANNOTATION/KIND_LEADER/KIND_DIMENSION`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__PanelHost__.js`
*Version:* 1.4.0 (19-Sep-2026)

The panel/tab framework. A 'Patterns' right-column panel registers here; the Scrapbook TAB already exists and is the natural home.

*Key symbols:* `Na__LePanels__RegisterTab(side, spec)`, `Na__LePanels__SetActiveTab(side, id)`, `Na__LePanels__GetActiveTab(side)`, `Na__LePanels__RegisterSection(side, spec) // spec: {id, title, build(body, context), refresh(body, context), defaultOpen, tab}`, `Na__LePanels__Refresh`, `Na__LePanels__SetFolded`, `Na__LePanels__FocusSection`, `Na__LePanels__SetSectionVisible`, `Na__LePanels__OnControl(eventType, controlName, handler)`, `Na__LePanels__IsEditable`, `Na__LePanels__GetContext`, `Na__LePanels__SelectedOfKind`, `Na__LePanels__ApplyToSelection`, `Na__LePanels__Row`, `Na__LePanels__Input(type, controlName, attrs)`, `Na__LePanels__Select`, `Na__LePanels__FillSelect`, `Na__LePanels__Button`, `Na__LePanels__Note`, `Na__LePanels__SliderRow`, `Na__LePanels__ShowSlider`, `Na__LePanels__LinkedPairRow`, `Na__LePanels__AdvancedToggle`, `data-na-control`, `is-off-tab`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Shapes__.js`

The Vectors panel — host for the gradient and dash blocks. A hatch block on a vector shape goes here, and this file owns the cross-rules (a gradient replaces the solid fill; a shape never ends up with nothing to show). 455+ lines.

*Key symbols:* `Na__LePanelShapes__Build`, `Na__LePanelShapes__Refresh`, `gradient host {read(), toggle(on, gradient), write(gradient, live)}`, `dash host`, `Na__LePanels__RegisterSection('right', …)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js`

THE normaliser. A new shape key that is not added here is silently dropped from every save, draft and undo snapshot. Shape__Gradient and Shape__LineStyle are normalised around line 638-641.

*Key symbols:* `Na__LeRec__NormaliseShape(item)`, `Na__LeRec__NormaliseAnnotation(item)`, `Na__LeRec__NormaliseGroup`, `item.Shape__Gradient = Na__LeGrad__Normalise(item.Shape__Gradient)`, `item.Shape__LineStyle = Na__LeDash__Normalise(item.Shape__LineStyle)`, `const filled = item.Shape__FillColour !== null || item.Shape__Gradient !== null`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\07__Core__SheetData\Na__LayoutEditor__SheetModel__Shapes__.js`

Create/Update for shapes. The opts/patch key names ('gradient', 'dash') are the short aliases the model takes; a hatch needs its own around lines 136-152.

*Key symbols:* `Shape__Gradient : (opts.gradient …)`, `Shape__LineStyle : (opts.dash …)`, `if (patch.gradient !== undefined) …`, `if (patch.dash !== undefined) …`, `Na__LeModel__CreateShape`, `Na__LeModel__UpdateShape`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\30__System__SheetTools\Na__LayoutEditor__Eyedropper__.js`

Copies vector traits between shapes via a declarative trait table (~line 300). A hatch must be added there or it will not be picked up by the eyedropper.

*Key symbols:* `{ patch : 'gradient', field : 'Shape__Gradient', nullable : true, palette : 'gradientOn' }`, `{ patch : 'dash', field : 'Shape__LineStyle', nullable : true, palette : 'dashOn' }`, `Na__LeDropper__ApplyMany`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\30__System__SheetTools\Na__LayoutEditor__SelectionBox__.js`

Decides whether a shape is 'filled' for crossing/window selection (~line 295) — the same rule as the hit test, and another place a hatch must register.

*Key symbols:* `const filled = !!shape.Shape__FillColour || !!shape.Shape__Gradient`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js`
*Version:* 1.1.0 (13-Sep-2026)

The existing composite-layer inventory and per-viewport weight record. The 'Site Plan Render Composites' dropdown is an extension of this, not a new system.

*Key symbols:* `Na__LeComposite__FIELD ('Viewport__CompositeWeights')`, `Na__LeComposite__Ready()`, `Na__LeComposite__Rows()`, `Na__LeComposite__Row(key)`, `Na__LeComposite__ToggleRows()`, `Na__LeComposite__WeightRows()`, `Na__LeComposite__Clamp`, `Na__LeComposite__Weight(viewport, key)`, `Na__LeComposite__Factor`, `Na__LeComposite__IsOverridden`, `Na__LeComposite__RasterToken(viewport, forThreeD)`, `Na__LeComposite__Token`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__Config__.json`
*Version:* 1.2.0

The config a site plan composite row must be added to. Composite__Key is declared un-renameable.

*Key symbols:* `LayoutEditor__RenderComposites__Layers`, `Composite__Key`, `Composite__Label`, `Composite__TwoDOnly`, `Composite__Toggle`, `Composite__Order`, `Composite__Note`, `Composite__Weight`, `Weight__Kind ('factor'|'pixels'|'none')`, `Weight__Default`, `Weight__Min`, `Weight__Max`, `Weight__Step`, `Weight__Label`, `Weight__TwoDOnly`, `Meta__KeyStability`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\40__Ui__Panels\Na__LayoutEditor__Panel__Styles__.js`

The LEFT-column 'Render Composites' panel (registered ~line 369). The Site Plan Render Composites dropdown belongs in this panel.

*Key symbols:* `Na__LePanelStyles__ID`, `Na__LePanelStyles__Build`, `Na__LePanelStyles__Refresh`, `Na__LePanels__RegisterSection('left', { id, title : Na__LeCfg__GetLabel('StylesTitle', 'Render Composites'), … })`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__.js`

Per-viewport layer on/off, which site plan layers already route through. A per-layer hatch override would sit beside this.

*Key symbols:* `Na__LeModelLayers__Token(viewport)`, `Na__LeModelLayers__IsOn(viewport, categoryKey)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__Config__.json`

The per-category line alphabet the site plan layers are styled from, and the file the LineStyleTool config says its millimetre figures match.

*Key symbols:* `EdgeStyles config categories`, `LineType`, `LineWeightMm`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js`

StyleBands/BandPaths — the band-to-path cache the site plan viewport shares. A hatch over site plan polygons must not disturb its keys.

*Key symbols:* `Na__LeVp2d__StyleToken(viewport)`, `Na__LeVp2d__StyleBands(viewport, masterPt, classes, showHidden)`, `Na__LeVp2d__BandPaths(cacheKey, bands, classes)`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\90__System__PageLayoutSystem\01__Dependencies__VersionLocked\jspdf.umd.js`
*Version:* 4.1.0

The vendored jsPDF 4.1.0. It HAS TilingPattern / ShadingPattern but only in 'advanced' API mode, which the app never enters.

*Key symbols:* `TilingPattern(boundingBox, xStep, yStep, gState, matrix)`, `ShadingPattern(type, coords, colors, gState, matrix)`, `API.addShadingPattern(key, pattern)`, `API.beginTilingPattern(pattern)`, `API.endTilingPattern(key, pattern)`, `API.advancedAPI(body)`, `API.compatAPI`, `advancedApiModeTrap(methodName)`, `putTilingPattern`, `putShadingPattern`, `API.GState`, `API.setGState`, `API.setLineDashPattern`, `API.lines`, `API.clip`, `API.discardPath`, `API.addImage`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary\`

The hatch library folder as it stands: two reference PNGs and five EMPTY pack folders, named on the same convention as the scrapbook content folder. No index file, no config, no server route yet.

*Key symbols:* `01__GeometricHatches`, `02__ConstructionMaterialHatches`, `03__Placeholder`, `04__Placeholder`, `05__SitePlanHatches`, `OS_Symbol__Examples__.png`, `OS_Symbol__Examples__Woodland&Water__.png`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\`

EMPTY reserved module folder, already numbered between 35__System__DrawingTools and 40__Ui__Panels. This is where the hatch tool module is meant to go.

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanDrawings__.md`

The existing ledger. Section 5.3 defines the SitePlan__ prefixed SSOT fields; 5.2 the tag table with a Fill column; 6.5 the manifest schema; 8.4 the viewport; 13 the progress ledger. Decision SP10 ('faces export as polygon rings, TrueVision paints from layer style not SketchUp materials') is still marked ASK.

*Key symbols:* `SitePlan__ExportFills`, `SitePlan__FillColourId`, `SitePlan__FillOpacity`, `TagNamePatternRegex ^\d{2}__SitePlan__`, `FillFileSuffix __FillModel__`, `SitePlanData__Layers`, `Layer__FillFile`, `Layer__Style`, `SP10`, `section 13 progress ledger`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\50__System__ProjectedLinework\Na__ProjectedLinework__SvgOverlay__.js`

The only place in the app that builds SVG with real DOM nodes (createElementNS) rather than strings — a live 3D-view overlay, NOT part of the sheet. Do not confuse it with the sheet SVG.

*Key symbols:* `Na__PlOverlay__SVG_NS`, `document.createElementNS(… 'svg'|'g'|'path')`

### Conventions observed

- NAMESPACE PREFIX ON EVERY SYMBOL. Every function, constant and variable in a module is prefixed with that module's short namespace, declared in the header block as NAMESPACE (e.g. Na__LeGrad, Na__LeDash, Na__LeChrome, Na__LeShapeGeo, Na__LeParam, Na__LeVp2d, Na__SpStore, Na__LeComposite, Na__LePanels). A hatch tool would be something like Na__LeHatch__ / Na__LeHatchLib__.
- FILE NAMES. Na__LayoutEditor__<Thing>__.js for layout editor modules, Na__LayoutEditor__<Thing>__Config__.json for its sibling config, Na__LayoutEditor__Styles__<Thing>__.css for its stylesheet, Na__LayoutEditor__Panel__<Thing>__.js for its panel. Outside the layout editor: Na__<System>__<Thing>__.js (Na__SitePlan__Store__.js, Na__ProjectQr__Painter__.js).
- FULL HEADER BLOCK on every file: FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED, then DESCRIPTION, INTEGRATION, a PORT NOTE section (Ported from / Ported to / Ported on / Parity / Divergences / Back-port), then a reverse-chronological DEVELOPMENT LOG with a version number per entry.
- REGION MARKERS. Code is divided by '// ---' / '// REGION | Name' ... '// endregion ---' blocks, and each function is introduced by a '// FUNCTION |' or '// HELPER FUNCTION |' comment banner with an explanatory paragraph and a '// ---' rule underneath.
- CONFIG JSON SHAPE. Top-level keys are '<App>__<Module>__<Block>' (e.g. LayoutEditor__GradientTool__Defaults). Every block starts with a __Description field. Inside a block, keys are '<Block>__<Field>' (Defaults__On, Rendering__CurveStops, Bounds__MinMm, Labels__Gradient). A Meta block carries Meta__FileName, Meta__Description, Meta__Version, Meta__Created, Meta__Author plus free-form Meta__WhyXyz prose explaining decisions.
- CONFIG IS FETCHED, NEVER IMPORTED. Each tool owns its config via `const X__ConfigUrl = new URL('./Na__...__Config__.json', import.meta.url)` and an `X__Ready()` that fetches once with { cache : 'no-store' }, NEVER rejects, and falls back to a frozen X__FALLBACK_* object that mirrors the shipped values. The mode controller awaits all the Ready() promises together.
- RECORD KEYS. Sheet record fields are '<Kind>__<Field>': Shape__Points, Shape__Closed, Shape__Stroked, Shape__FillColour, Shape__StrokePt, Shape__StrokeColour, Shape__FillOpacity, Shape__StrokeOpacity, Shape__Gradient, Shape__LineStyle; Viewport__FrameMm, Viewport__ScaleDenominator, Viewport__CompositeWeights, Viewport__SitePlan, Viewport__ShowFrame; Annotation__Text, Annotation__RotationDeg; Group__Parametric; Layer__CategoryKey, Layer__Style, Layer__DrawOrder.
- SUB-RECORD KEYS repeat the sub-record's own name: Gradient__StartColour, Gradient__AngleDeg, LineStyle__Kind, LineStyle__Scale, Parametric__Type, Parametric__Params.
- NULL MEANS NONE AND IS BACKWARD-COMPATIBLE. Every optional trait is null for 'off', and every normaliser returns a BRAND NEW object so two records can never share one. A record written before a trait existed has no key at all and must paint exactly as it always did.
- OPTIONAL LAST ARGUMENT. New capability is added to an existing function as an optional trailing argument or an `extra` options object (Na__LeChrome__PushPolyline's gradient then extra {dashMm, dashArray, fillOpacity, strokeOpacity}) so every earlier caller is untouched.
- ONE FUNCTION, TWO SURFACES. Screen and PDF must be driven from one source of truth (Na__LeGrad__ColourAt, Na__LeChrome__DashList, Na__LeVp2d__StyleBands) so 'the screen and the paper cannot drift apart' - the phrase recurs verbatim in headers.
- PAPER MILLIMETRES, Y DOWN is the sheet unit everywhere; drawing millimetres are viewport-local and divided by the scale denominator (D) to reach paper.
- PANEL ROWS ARE BUILT BY THE TOOL, NOT THE PANEL. A tool exports BuildRows(body) / RefreshRows(body, state) / RegisterControls(host) and the panel calls them; controls are declared with data-na-control names and wired through Na__LePanels__OnControl. Long explanations go in `title` tooltips, never in visible note rows.
- LIVE vs COMMITTED. Sliders write live on 'input' (silent redraw) and announce once on 'change', so a whole drag is one undo step.
- A CONTROL WITH FOCUS IS NEVER OVERWRITTEN by a refresh (`document.activeElement !== e` guard in every Show function).

### Extension points

**Add a hatch to the shape record so a drawn vector polygon can carry one**

- *Where:* Na__LayoutEditor__SheetRecords__.js (Na__LeRec__NormaliseShape, ~638), Na__LayoutEditor__SheetModel__Shapes__.js (~136 create, ~151 update), Na__LayoutEditor__ShapeGeometry__.js (Na__LeShapeGeo__Push ~271 and Na__LeShapeGeo__Hit ~192), Na__LayoutEditor__SheetChrome__.js (Na__LeChrome__PushPolyline ~312, Na__LeChrome__ToSvg polyline branch ~581, Na__LeChrome__ToPdf polyline branch ~720), Na__LayoutEditor__Eyedropper__.js (trait table ~300), Na__LayoutEditor__SelectionBox__.js (~295), Na__LayoutEditor__Panel__Shapes__.js (~248), Na__LayoutEditor__ScrapbookParametric__.js (~579 the portable field list), Na__LayoutEditor__ModeController__.js (await the new Ready())
- *How:* Copy Shape__Gradient exactly. Grep for 'Shape__Gradient' across 02__Src__AppModules and mirror every one of the ten sites; that grep IS the checklist.
- *Risk:* Miss Na__LeRec__NormaliseShape and the key is silently stripped from every save, draft and undo snapshot with no error. Miss the Eyedropper table and the trait does not copy. Miss SelectionBox and the shape stops being window-selectable by its interior.

**Emit an SVG <pattern> on the sheet**

- *Where:* Na__LayoutEditor__SheetChrome__.js, Na__LeChrome__ToSvg, the polyline branch that currently does `return paint.defs + solid + '<path … fill="' + paint.fill + '"' + edges;` (~584)
- *How:* A hatch module exports a SvgPaint(points, hatch) returning { defs, fill } exactly as Na__LeGrad__SvgPaint does, where defs is '<defs><pattern id=… patternUnits="userSpaceOnUse" patternTransform="rotate(a) scale(s)" …>…</pattern></defs>'. The chrome needs no new kind, only a second paint source in that branch, and an ordering rule (solid fill, then hatch, then gradient?, then edges).
- *Risk:* Ids must come from a NEVER-RESET module counter like Na__LeGrad__IdCounter, not the per-render clipCounter: the chrome, markup and focus SVGs are three separate strings swapped into ONE document, and a repeated id makes one layer's pattern leak into another.

**Paint the hatch in the PDF**

- *Where:* Na__LayoutEditor__SheetChrome__.js, Na__LeChrome__ToPdf polyline branch (~709-736), beside the existing three-pass gradient block
- *How:* A DrawPdf(doc, points, hatch) mirroring Na__LeGrad__DrawPdf: saveGraphicsState, doc.lines(rel, x, y, [1,1], null, closed) with a null paint operator, doc.clip(), doc.discardPath(), emit the tile geometry as real doc.lines/doc.rect calls across the clipped extent, restoreGraphicsState in a finally.
- *Risk:* A clip left open crops everything drawn after it — the gradient's `finally { doc.restoreGraphicsState(); }` comment says exactly this. jsPDF's native TilingPattern is NOT usable without advancedAPI().

**Fill site plan polygons with a hatch on screen**

- *Where:* Na__LayoutEditor__Viewport2d__SitePlan__.js, Na__LeVp2d__SitePlanBuild (the fills array, ~164) and Na__LeVp2d__PaintSitePlan (~205-233)
- *How:* fills entries gain a hatch descriptor beside hex/opacity; PaintSitePlan emits the <defs><pattern> into the frame's own SVG string before the fill <path>, and may emit fill, pattern and linework as three separately-keyed layers for the Render Composites dropdown.
- *Risk:* The frame linework SVG is a SEPARATE document from the sheet chrome SVG, written via state.linework.innerHTML. Pattern ids must still be globally unique because the same page holds all of them. Also state.lineworkKey / Na__LeVp2d__SitePlanPaintKey must take the hatch into account or a hatch change will not repaint, and the viewport PARK cache (SheetSurface 1.6.0) will serve a stale frame on a tab change.

**Paint site plan hatch fills in the PDF**

- *Where:* Na__LayoutEditor__PdfExporter__.js, Na__LePdf__DrawSitePlanFills (~246)
- *How:* It currently pushes one Na__LeChrome__PushPolyline per OUTER ring only and sends the batch through Na__LeChrome__DrawToPdf. A hatch either rides on that primitive (preferred, one code path) or needs a parallel builder.
- *Risk:* Holes are NOT cut out in the PDF today — only ring.outer is drawn, and the header comment says so. A hatch clipped to outer rings only will bleed through courtyards and lakes that read correctly on screen. Fixing this means even-odd multi-ring clipping in jsPDF, which the current polyline primitive cannot express.

**Per-layer Z-index / draw-order 1..10**

- *Where:* Na__SitePlan__Store__.js, Layer__DrawOrder in Na__SpStore__Layer (~246) and the sort in Na__SpStore__Describe (~267)
- *How:* Layer__DrawOrder already exists (default 50, lowest first). Map the 1..10 hierarchy onto it, or add a second field and sort by both.
- *Risk:* Na__SpStore__Style and Na__SpStore__Layer are whitelist normalisers: any new key not named there is dropped on load, so the manifest and the SSOT can both be right while TrueVision sees nothing.

**A 'Patterns' right-column panel**

- *Where:* Na__LayoutEditor__PanelHost__.js (Na__LePanels__RegisterSection('right', {id, title, build, refresh, tab})), registered from Na__LayoutEditor__ModeController__.js beside Na__LePanelScrap__Register (~374-375)
- *How:* Register it on the existing Scrapbook tab (Na__LeScrap__TAB_ID) if it is a library, or on the Properties tab if it is a property of the selected shape. Tiles render via Na__LeScrapDrag__Tile with a preview built the way Na__LeScrap__PreviewSvg builds one.
- *Risk:* A section off its tab is hidden with the is-off-tab class and Refresh PASSES IT BY, so a library's files are not read until its tab is first opened — do not assume refresh() runs.

**'Site Plan Render Composites' left-column dropdown**

- *Where:* Na__LayoutEditor__RenderComposites__Config__.json (LayoutEditor__RenderComposites__Layers array) and Na__LayoutEditor__Panel__Styles__.js (the left 'Render Composites' section)
- *How:* Add fill / pattern / linework rows with Composite__Key, Composite__Order and a Composite__Weight block. The panel builds itself from the config, so adding a composite is a config edit.
- *Risk:* Composite__Key is stored in saved viewports (Viewport__CompositeWeights) and is explicitly declared un-renameable in Meta__KeyStability.

**The hatch pattern library on disk and how it is served**

- *Where:* 52__LayoutEditor__HatchPatternLibrary/ (five empty pack folders), served the way Na__LayoutEditor__ScrapbookCustom__Transport__.js serves 51__LayoutEditor__UserScrapbookContent/
- *How:* Copy the Library block contract: Library__ContentFolder, Library__IndexFile, Library__ApiPath, Library__Categories[{Category__Folder, Category__Name}]. Resolve the app root with new URL('../../../', import.meta.url). Read the index from the API on the ProjectVision server, from the flat index file everywhere else.
- *Risk:* The live website has NO directory listing — the index file is the only way the library is readable there, and it is only as fresh as the last push. A new Flask route will answer 405 until Adam restarts his 8090 server (the server never reloads routes).

**A hatch as scripted geometry rather than an SVG pattern**

- *Where:* Na__LayoutEditor__ScrapbookParametric__.js, Na__LeParam__RegisterType(definition)
- *How:* A hatch type whose build(params, tools) returns tile records from (0,0). Reuse Na__LeGrad__Axis(points, angleDeg) to get the rotated extent to tile across.
- *Risk:* The parametric engine makes a GROUP of real records the user can select, move and ungroup. For an OS-mapping woodland polygon that is tens of thousands of records in the sheet model, the undo snapshot and the browser draft. This path suits ONE authored hatch in a drawn shape, never a site plan layer fill.

### Traps

- THERE IS NO SHARED <defs>. Na__LeChrome__ToSvg emits a <defs> fragment inline before each gradient path and a <clipPath> inline before each clipped group. Gradient ids come from Na__LeGrad__IdCounter, a module-level counter the header explicitly marks 'Never reset: the chrome and markup SVGs share one document, so an id may never repeat'. The clip counter, by contrast, is a per-render { n : 0 } created fresh in Na__LeChrome__ToSvgMarkup — it is safe ONLY because a clipPath is consumed by the very next element. A <pattern> is referenced by url() like a gradient, so it MUST use the never-reset style of counter.
- THE SHEET HAS FOUR-PLUS SEPARATE SVG DOCUMENTS ON ONE PAGE: chrome, markup, focus (all built as strings and swapped by Na__LeSurface__SwapSvg) plus one linework SVG per viewport frame (state.linework.innerHTML). Ids collide across all of them.
- jsPDF 4.1.0 HAS TilingPattern, beginTilingPattern, endTilingPattern and addShadingPattern — and every one is behind advancedApiModeTrap, which THROWS unless doc.advancedAPI() has been called. The whole app draws in compat mode (y down, mm). Switching modes flips the coordinate system and the docs warn that some plugins do not support advanced mode. Treat jsPDF native patterns as unavailable.
- THE PDF IS BUILT WITH compress : true (Na__LayoutEditor__PdfExporter__.js ~345). Memory note: jsPDF raw operators need an uncompressed build to be inspectable/valid. Anything that writes content-stream operators by hand must be checked against this flag.
- jsPDF's addImage with 'RGBA' SILENTLY DROPS THE ALPHA (processRGBA returns it under a key the image writer never reads) — a fade prints as a solid block. Anything rasterised for the PDF must be encoded as a PNG data URL. This is stated in Na__LeGrad__StripPng and in Meta__WhyThePdfIsAStrip.
- A CLIP LEFT OPEN CROPS EVERYTHING AFTER IT. Na__LeGrad__DrawPdf restores in a `finally`; Na__LePdf__BeginClip/EndClip and the group branch of Na__LeChrome__ToPdf do the same. Any new clipped hatch pass must too.
- A DASH PATTERN CARRIES INTO THE NEXT PRIMITIVE. Na__LeChrome__ToPdf explicitly resets with setDash({DashMm:0, DashArray:null}) after any dashed polyline. Any new PDF state a hatch sets (fill colour, line width, GState) has the same problem.
- NORMALISERS STRIP UNKNOWN KEYS. Na__LeRec__NormaliseShape rebuilds a shape record; Na__SpStore__Style and Na__SpStore__Layer rebuild a site plan layer from a fixed whitelist. A new key added to the SketchUp SSOT, the manifest or a saved sheet vanishes on load with no warning until it is named in the normaliser.
- THE SITE PLAN PDF DRAWS OUTER RINGS ONLY — holes are not cut out on paper today (comment in Na__LePdf__DrawSitePlanFills, confirmed in the plan doc section 8.4). On screen the same rings ARE even-odd. A hatch will make this existing divergence highly visible.
- THE VIEWPORT CACHE PARKS FRAMES. SheetSurface 1.6.0 lifts a whole sheet's frames container off the paper on a tab change and puts it back without re-rendering, comparing keys. A hatch that does not join Na__LeVp2d__SitePlanPaintKey / Na__LeVp2d__SitePlanToken / Na__LeVp2d__StyleToken will show stale paint after a tab change and will not repaint on a setting change.
- A PANEL SECTION OFF ITS TAB IS SKIPPED BY Refresh (is-off-tab class, PanelHost 1.4.0) — deliberately, so a library's files are not read until its tab is opened. Do not put work a panel depends on inside refresh() and assume it runs.
- Composite__Key and Layer__CategoryKey ARE PERSISTED IDENTIFIERS. Renaming either orphans saved viewports and saved layer toggles. The Render Composites config says so outright in Meta__KeyStability.
- THE THREE-PASS RULE. A polyline with a gradient is drawn in the PDF as solid fill, then gradient clipped, then edges — never fill-and-stroke in one call — 'so the gradient's solid end can never paint over an edge'. A hatch adds a fourth pass and the ordering must be decided deliberately, and matched exactly in the SVG branch.
- A GRADIENT COUNTS AS A FILL FOR HIT TESTING over its whole area, alpha end included (Na__LeShapeGeo__Hit). A hatch with lots of white space will feel wrong if it does not make the same choice, and inconsistent if the two rules differ.
- THE APP'S ONLY ROTATION TODAY IS ON TEXT (Annotation__RotationDeg, RotateDeg on a text primitive). There is NO rotate or scale transform for vector shapes, groups or fills — no transform attribute is ever written into the sheet SVG for geometry. Per-use rotation must therefore be a property of the HATCH record (like Gradient__AngleDeg), resolved into geometry or into a patternTransform, not a transform on the shape.
- Run Na__Verify__Exports__.mjs at 80__Testing__PrototypeEnvironment/ after any JS edit: it catches a Na__ helper used but never imported, which node --check cannot see.
- PWA TOKEN. A release whose new import names an export a warm cache lacks breaks the editor until the second visit; TrueVision bumps its own token in Na__Pwa__ServiceWorker__.js.

### Open questions raised by this survey

- Decision SP10 in the plan doc is still marked ASK: 'Faces on fill tags export as polygon rings in a __FillModel__ GLB; TrueVision paints them from the layer style, not from SketchUp materials'. The coming build adds real SketchUp FACE MATERIALS for the fills. Does the manifest now carry the material colour per layer (so the SSOT FillColourId/FillHex becomes advisory), or does TrueVision keep painting from the layer style and the SketchUp material is presentation-only in SketchUp? The answer decides whether Na__SpStore__Style grows fields or not.
- The new 'Export Polygon Faces' toggle writes 2D FACE MESHES. Today Na__SpGlb__ParseFill reads LINE_LOOP RINGS, and the plan doc says explicitly 'Rings, not triangles, because a triangulated fill shows hairline seams in PDF viewers.' Are the new face meshes an ADDITION alongside the rings (a second reader in Na__SitePlan__GlbParse__.js), or a replacement? If a replacement, the seam problem the ring decision was made to avoid comes back, and it comes back worst in exactly the PDF the drawings are issued as.
- Does a hatch belong to a SITE PLAN LAYER (a style field in the SSOT/manifest, painted per category), to a DRAWN VECTOR SHAPE (a Shape__Hatch record like Shape__Gradient), or to both? The two have completely different performance profiles and different panels. The brief implies both (a per-layer fill AND a Patterns panel with per-use scale and rotation), which means two record homes sharing one pattern library and one painter.
- Per-use scale and rotation: are they per LAYER (one scale for every woodland polygon on a drawing), per VIEWPORT (so the same layer hatches differently at 1:1250 and 1:500), or per SHAPE? Layer__VisibleAtScales already exists, and the LineStyleTool's Scale is per-record; a viewport-level override would be a new Viewport__ record key alongside Viewport__CompositeWeights.
- The hatch pack folders 03__Placeholder and 04__Placeholder are unnamed. What are they for, and does the index/config need to tolerate a folder with no items (the scrapbook config's Library__CategoriesNote says 'Category__Folder must be a folder that exists: the server saves into the folders that are there and never makes one')?
- Does the Patterns library need a WRITE route (so Adam can save a pattern from the app, as the Custom Scrapbook does), or is it read-only shipped content? Read-only removes the whole ProjectVision Flask blueprint and the server-restart trap.
- Existing vs Proposed site plan folders (two R2 stores auto-detected by folder): Na__SpStore__Resolve/Describe today resolves ONE descriptor and Na__SpStore__GetLayerData is keyed by categoryKey alone. Two simultaneous stores means either two store instances or a store-qualified key, and Na__LeVp2d__SitePlanToken must include which store a viewport reads or the paint guard will not repaint on a switch.
- Should the hatch be written as a fourth paint pass in the existing polyline primitive, or as a NEW primitive kind ('hatch') the way 'qr' was added? The qr precedent exists precisely because a QR code needed to sit ABOVE the viewports where images sit below; a hatch has a similar ordering question against fills and linework.

---

<a id="area-9"></a>
## 9. SketchUp GLB Builder — Site Plan Export (Na__TrueVision__GlbBuilder__SitePlanExport__.rb and its host plugin)

### Summary

ALL LINE NUMBERS BELOW ARE POINTERS ONLY — find every symbol by NAME, not by line.

WHAT THE MODULE IS. `Na__TrueVision__GlbBuilder__SitePlanExport__.rb` (795 lines, 14-Sep-2026, module version `NA__SITEPLAN__EXPORTER_VERSION = '1.1.1'`) lives in `TrueVision3D::GlbBuilderUtility` — a FLAT re-opening of the same two modules every other file in the plugin re-opens. There is no sub-namespace. It is required from `Main__.rb` inside a `begin/rescue ScriptError, StandardError` guard (~line 92-96) so a fault here can never stop the model export loading.

CALL ORDER. `Na__SitePlan__Run(model = Sketchup.active_model)` (~732) is the only real entry point, reached from `Na__PublicApi__ExportSitePlanData` (Main__.rb ~639, which guards on `respond_to?(:Na__SitePlan__Run)`), reached in turn from the Extensions menu item "Export Site Plan Data" (`Na__DynamicReloader__RegisterMenu`, DynamicReloaderPluginUtil__.rb ~40) and from the HTML dialog card `naTvgbExportSitePlanCard` → action id `export_site_plan` → `Na__UserInterface__HandleAction` (~216/219) → `Na__UserInterface__ActionExportSitePlan(dialog)` (~291). Run: (1) refuses if `model.active_path` is non-nil ("Close the group or component you are editing"); (2) `Na__SitePlan__Scan(model)`; (3) bails with a message if `scan[:layers]` empty (SSOT has no site plan tags) or `scan[:buckets]` empty (nothing tagged), the latter adding a skipped-edge note; (4) `Na__SitePlan__ProjectPrefix(model)`; (5) `Na__SitePlan__SummaryText(scan, prefix)` in a MB_YESNO box; (6) `Na__SitePlan__ChooseFolder(scan[:config])`; (7) `Na__SitePlan__Write(model, scan, prefix, export_dir)`; (8) `Na__Helpers__OpenFolder(export_dir)` then a completion `UI.messagebox` listing up to 8 checks and the log filename, ending "Next: run the ProjectVision build pipeline (option 3) to publish it."

HOW LAYERS ARE DECIDED. A site plan layer is ANY Tags-SSOT entry carrying a String `SitePlan__ExportFileNameStem`. NOT a number range, NOT `SITE_PLAN_TAG_PATTERN`. `Na__SitePlan__BuildLayerDefinitions(tags_data, edge_data)` (~129) walks `tags_data['Na__DataLib__CoreIndex__Tags']` → each section → each entry, keyed by `Tag__SketchUpName`. It reads `SitePlan__LayerLabel` (fallback: stem with `TrueVision__SitePlan__` stripped), `SitePlan__LayerGroup`, `SitePlan__DrawOrder`, `SitePlan__ExportFills == true`, `SitePlan__VisibleAtScales`, and a style hash from `SitePlan__LineColourId`/`LineType`/`LineWeightMm`/`FillColourId`/`FillOpacity`, with MTE ids resolved to hex through `Na__SitePlan__EdgeHexIndex(edge_data)` (~111), which flattens `Na__DataLib__CoreIndex__EdgeMaterials` → series → entry`['HexValue']`. Both SSOT files load via `Na__SitePlan__LoadDataLibFile(file_name, file_key)` (~93): the plugins-folder sibling `../Na__Common__DataLib__CoreSuEntityStandards/<file>` wins, `Na__DataLib__CacheData.Na__Cache__LoadData(:tags | :edge_materials)` is the fallback. Config merges `SitePlanExportConfig` over `NA__SITEPLAN__CONFIG_DEFAULTS` in `Na__SitePlan__Config` (~173) — only the five default keys are honoured, anything new in the SSOT block is IGNORED.

THE WALK. `Na__SitePlan__Collect(entities, transform, current_tag, ctx, depth = 0)` (~297), started from `model.entities` with `Z_UP_TO_Y_UP_MATRIX` and `current_tag = nil`, depth-capped at `NA__SITEPLAN__MAX_DEPTH` (64). Per entity: skip unless `respond_to?(:layer)`; skip if tag in `ctx[:excluded]`; skip if tag matches `ctx[:exclusion_pattern]` (`ExportExclusions.PatternExclusionRegex`, currently `^TrueVision_.*_DoNotExportGLTF$`); skip if visibility matters and the layer is off (dead by default, `ExportIgnoresTagVisibility: true`). `owner = ctx[:layers].key?(tag_name) ? tag_name : current_tag` — inheritance from the nearest site plan tag above. Hidden entities are COUNTED against owner then skipped. Edges: skipped (and counted) if `soft?` or `smooth?`; otherwise `Na__SitePlan__AddEdge`. Faces: `Na__SitePlan__AddFace` only when `bucket[:defn][:fills]`, else `faces_ignored += 1`. Groups and ComponentInstances recurse with `transform * entity.transformation`, carrying `owner` down. Crucially `ctx[:excluded]` is `Array(ExportExclusions['FullyExcludedTagNames']).reject { |n| layer_defs.key?(n) }` (~360) — every site plan tag is listed in that SSOT array (so the model export skips it) and is subtracted here so the site plan export still sees it.

GLB PATHS. Linework: `Na__SitePlan__WriteLinework(bucket, path)` (~543) calls the shared `Na__LineworkEngine__BuildGltfFromEdgeData(positions, colors)` (LineworkModelHandling__.rb ~130) — one mesh, one primitive, `mode 1` (LINES), non-indexed, `POSITION` (5126/VEC3/34962) + `COLOR_0` (5126/VEC4/34962) via `Na__GltfHelpers__AddAccessor` (GeometryHandling__.rb), then overwrites `asset.generator`, sets `asset.extras = { 'Na__SitePlanTag', 'Na__SitePlanStem' }`, renames `meshes[0].name` to the stem, and writes with `Na__GlbEngine__WriteGlbFile` (EngineCore__.rb ~194). Fill: `Na__SitePlan__WriteFill(bucket, path)` (~558) hand-builds the glTF — one mesh `"#{stem}__FillRings"`, ONE PRIMITIVE PER RING, `mode 2` (LINE_LOOP), POSITION only, no COLOR_0, no materials, per-primitive `extras { 'Na__SitePlanFace' => ring[:face], 'Na__SitePlanRing' => 'outer'|'inner' }`. Returns false (and writes nothing) if no ring produced an accessor. Units: SketchUp inches × `INCHES_TO_METERS` (0.0254) → metres. Frame: `Z_UP_TO_Y_UP_MATRIX` applied at the ROOT of the walk, so stored coords are already glTF Y-up (SketchUp x,y,z → x,z,-y) — the same frame as the model GLBs. Edge colour comes from `edge.material.color` (RGBA/255), black opaque when unmaterialed. Face fills carry NO colour in the GLB; colour is manifest-only.

MANIFEST. Written by `Na__SitePlan__Write` (~609), inline, not by a separate writer. See extensionPoints/traps for the exact key list and the divergences from the plan doc.

### Files that matter

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb`
*Version:* NA__SITEPLAN__EXPORTER_VERSION = '1.1.1' (~line 69); NA__SITEPLAN__SCHEMA_VERSION = 1 (~70)

THE file. Whole site plan export: SSOT load, layer definitions, model walk, bucket collection, warnings, folder choice, linework GLB, fill GLB, manifest, stale deletion, entry point. 795 lines. Written 14-Sep-2026, untouched since.

*Key symbols:* `NA__SITEPLAN__CONFIG_DEFAULTS (~62: ExportFolderName, ManifestFileName, LineworkFileSuffix, FillFileSuffix, ExportIgnoresTagVisibility)`, `NA__SITEPLAN__EXPORTER_VERSION (~69)`, `NA__SITEPLAN__SCHEMA_VERSION (~70)`, `NA__SITEPLAN__MAX_DEPTH = 64 (~71)`, `NA__SITEPLAN__FLAT_TOLERANCE_M = 0.5 (~72)`, `NA__SITEPLAN__FAR_WARNING_M = 2000.0 (~73)`, `NA__SITEPLAN__OLD_FILE_PATTERN (~74)`, `NA__SITEPLAN__PREFS_SECTION = 'TrueVision3D_GlbBuilder' (~75)`, `NA__SITEPLAN__PREFS_KEY_DIR = 'SitePlanExportDir' (~76)`, `NA__SITEPLAN__TV_CONTENT_FOLDER = '30__TrueVision__AppContent' (~77)`, `self.Na__SitePlan__LoadDataLibFile(file_name, file_key) (~93)`, `self.Na__SitePlan__EdgeHexIndex(edge_data) (~111)`, `self.Na__SitePlan__BuildLayerDefinitions(tags_data, edge_data) (~129)`, `self.Na__SitePlan__Config(tags_data) (~173)`, `self.Na__SitePlan__NewBucket(definition) (~193)`, `self.Na__SitePlan__Grow(bucket, x, y, z) (~209)`, `self.Na__SitePlan__AddEdge(bucket, edge, transform) (~223)`, `self.Na__SitePlan__AddFace(bucket, face, transform) (~257)`, `self.Na__SitePlan__CountSkipped(ctx, owner, entity) (~279)`, `self.Na__SitePlan__Collect(entities, transform, current_tag, ctx, depth = 0) (~297)`, `self.Na__SitePlan__Scan(model) (~346)`, `self.Na__SitePlan__Warnings(buckets, skipped = {}) (~388)`, `self.Na__SitePlan__BoundsMm(min, max) (~439)`, `self.Na__SitePlan__ProjectPrefix(model) (~455)`, `self.Na__SitePlan__SummaryText(scan, prefix) (~468)`, `self.Na__SitePlan__ChooseFolder(config) (~512)`, `self.Na__SitePlan__WriteLinework(bucket, path) (~543)`, `self.Na__SitePlan__WriteFill(bucket, path) (~558)`, `self.Na__SitePlan__NorthAngleDeg(model) (~597)`, `self.Na__SitePlan__Write(model, scan, prefix, export_dir) (~609)`, `self.Na__SitePlan__Run(model = Sketchup.active_model) (~732)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Main__.rb`
*Version:* No Ruby version constant exists anywhere in the plugin. The plugin version lives ONLY in the DevLog markdown (currently 2.10.1, 20-Sep-2026).

Orchestrator. Requires every module (SitePlanExport guarded, ~92-96). Holds the shared constants the site plan export depends on, the DataLib config loader, and the public API entry point.

*Key symbols:* `SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/ (~117)`, `EXCLUDED_LAYER_PATTERN = /^TrueVision_.*_DoNotExportGLTF$/ (~115)`, `ALWAYS_EXCLUDED_LAYER_NAMES (~118)`, `LINEWORK_HIDDEN_DEFAULTS (~124)`, `INCHES_TO_METERS = 0.0254 (~132)`, `GLB_FILE_EXTENSION, MESH_MODEL_SUFFIX, LINEWORK_MODEL_SUFFIX (~134-136)`, `GLB_MAGIC / GLB_VERSION / GLB_CHUNK_TYPE_JSON / GLB_CHUNK_TYPE_BIN (~552-555)`, `NA_PLUGIN_ROOT (~560)`, `@menu_registered (~578)`, `self.Na__ExportConfig__LoadFromDataLib (~174)`, `self.Na__ExportConfig__ForceReload (~166)`, `self.Na__ExportConfig__OverlayLocalAppConfig (~263)`, `self.Na__ExportConfig__BuildHashesFromTagEntries(tags_data) (~285)`, `self.Na__ExportConfig__FullyExcludedTagNames (~342)`, `self.Na__ExportConfig__ExclusionPattern (~410)`, `self.Na__ExportConfig__SkipRanges (~418)`, `self.Na__PublicApi__ExportSitePlanData (~639)`, `self.Na__PublicApi__StartExport (~589)`, `self.Na__PublicApi__CreateStandardisedTags (~615)`, `self.Na__PublicApi__RegisterToolbar (~625)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__CoreExport__.rb`

Model (non-site-plan) export core. Two methods matter here: the excluded-layer identification that keeps site plan tags OUT of model GLBs, and the fallback project prefix.

*Key symbols:* `self.Na__ExportCore__IdentifyExcludedLayers(model) (~470) — matches exclusion_pattern OR SITE_PLAN_TAG_PATTERN OR fully_excluded_names; fills @excluded_layers / @treat_as_untagged_layers / @linework_hidden_layers`, `self.Na__ExportCore__OrganizeEntitiesByTags(model) (~500) — walks model.active_entities ONLY (top level), parses /^(\d{2})__/, drops SkipRanges, buckets by Na__ExportConfig__TagRanges; site plan tags never reach it because Na__Helpers__EntityExcluded? filters them`, `self.Na__Helpers__EntityExcluded?(entity) (~129)`, `self.Na__Helpers__LayerLineworkHidden?(layer_name) (~148)`, `self.Na__Helpers__EntityProfileLineExcluded?(entity) (~183)`, `self.Na__Helpers__ExtractProjectPrefix(model) (~253) — /^([^_]+)__/ on the basename; the SitePlan prefix falls back to this`, `self.Na__Helpers__OpenFolder(path) (~293)`, `self.Na__ExportCore__PerformExport(export_dir, quiet: false) (~700)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__EngineCore__LineworkModelHandling__.rb`
*Version:* generator string hardcoded 'TrueVision3D GLB Builder Linework v1.5.0' (~132, ~286)

Shared linework glTF builder. The site plan export reuses ONLY Na__LineworkEngine__BuildGltfFromEdgeData; it does NOT use TraverseEdges or ExportLineworkToGlb (those apply model-export filters the site plan walk deliberately replaces).

*Key symbols:* `self.Na__LineworkEngine__BuildGltfFromEdgeData(positions, colors) (~130) — returns [gltf, bin_buffer]; mesh name 'Linework', mode 1 (LINES), POSITION 5126/VEC3/34962 + COLOR_0 5126/VEC4/34962`, `self.Na__LineworkEngine__TraverseEdges(...) (~48) — model export only`, `self.Na__LineworkEngine__ExportLineworkToGlb(entities, filepath, parent_transform = nil) (~183) — model export only`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__EngineCore__GeometryHandling__.rb`

Holds the coordinate matrix and the binary accessor packer both GLB writers depend on.

*Key symbols:* `Z_UP_TO_Y_UP_MATRIX (~43) — Geom::Transformation, column-major [1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0,0,1]; maps SketchUp (x,y,z) to glTF (x,z,-y); determinant +1`, `MESH_MODEL_INCLUDE_EDGES = false (~56)`, `self.Na__GltfHelpers__AddAccessor(gltf, bin_buffer, data_array, component_type, accessor_type, buffer_target) — packs 5126 'e*' / 5123 'v*' / 5125 'V*', 4-byte aligns, pushes bufferView {buffer:0, byteOffset, byteLength, target} and accessor {bufferView, byteOffset:0, componentType, count, type, min, max}; returns nil for empty data`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__EngineCore__.rb`

GLB container writer and validator.

*Key symbols:* `self.Na__GlbEngine__WriteGlbFile(filepath, gltf, bin_buffer) (~194) — deletes empty images/textures/samplers, pads BIN with 0x00 and JSON with 0x20 to 4 bytes, rewrites gltf['buffers'] = [{byteLength}], writes 12-byte header + JSON chunk + BIN chunk, then calls the validator`, `self.Na__GlbEngine__ValidateGlbStructure(filepath) (~244)`, `self.Na__GlbEngine__SanitizeEntityName(entity)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__TagsManager__.rb`

Creates the standardised SketchUp tags from the SSOT. This is where a NEW site plan tag becomes a real SketchUp layer, and where its folder and styling are applied.

*Key symbols:* `NA__TAGS_MANAGER__CREATE_PREFIX_RANGES (~50) — [(1..1),(2..2),(7..9),(10..29),(60..61),(71..75),(90..93)]; a new site plan tag numbered outside 71-75 would NOT be created`, `self.Na__TagsManager__TagEligibleForCreation?(tag_name) (~72)`, `self.Na__TagsManager__BuildTagsFromDataLib(tags_data) (~84) — is_site_plan = entry['SitePlan__ExportFileNameStem'].is_a?(String); folder from SitePlanExportConfig['SketchUpTagFolderName'] default 'Site Plan'; emits {'name','description','line_style_name','edge_colour_rgb','folder_name'}`, `self.Na__TagsManager__LoadLocalDataLibFile (~167)`, `self.Na__TagsManager__LoadLocalTagsIndex (~139)`, `self.Na__TagsManager__LoadTagsIndex (~196)`, `self.Na__TagsManager__ApplyTagStyling(layer, tag_entry) (~225) — Layout__LineStyleName via model.line_styles[name]; Layout__EdgeColourRGB via Sketchup::Color`, `self.Na__TagsManager__FileTagInFolder(model, layer, folder_name) (~256)`, `self.Na__TagsManager__CreateStandardisedTags (~273) — one start_operation('Create Standardised Tags', true)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__TagsIndex__.json`

LOCAL FALLBACK tag list only — a flat {"tags":[{name, description}, ...]} array with NO SitePlan__ fields at all. Used only when both the local DataLib file and the cache fail. Currently carries 17 site plan tag names (71-75) and is ALREADY STALE against the SSOT (it lists 75__SitePlan__SoftLandscape__RootProtectionAreas etc. but has no styling, order or fill data).

*Key symbols:* `tags[] entries: 71__SitePlan__BaseMap__OsMapping, __Amendments, __Contours; 72__SitePlan__Boundary__RedLine, __BlueLine, __WallsAndFences, __SettingOutLines; 73__SitePlan__Buildings__Existing, __ToBeDemolished, __Proposed, __ProposedSecondary; 74__SitePlan__ExternalWorks__HardSurfaces, __ParkingAndAccess, __DrainageAndServices; 75__SitePlan__SoftLandscape__Trees, __HedgesAndPlanting, __TreesToRemove, __RootProtectionAreas`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__AppConfig__.json`

Local plugin override for GlbBuilderConfig. ONLY the Logging sub-object is read (Na__ExportConfig__OverlayLocalAppConfig). Nothing site-plan-specific is read from it today.

*Key symbols:* `_documentation`, `Logging.ConsoleVerbose (false)`, `Logging.TextFileEnabled (true)`, `Logging.TextFileNamePattern ('GlbBuilder__ExportLog__%TIMESTAMP%.txt')`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json`
*Version:* meta.version = "2.3.2"

THE Tags SSOT. meta.version 2.3.2, lastUpdated 18-Sep-2026. Section 71_75__SitePlanTags__ (~586) holds the 17 site plan entries; SitePlanExportConfig (~1094) holds the runtime config; ExportExclusions.FullyExcludedTagNames (~1015 area) lists every site plan tag; PatternExclusionRegex (~977).

*Key symbols:* `meta.version, meta.skipRanges ([0,2,3,4,5,6])`, `Na__DataLib__CoreIndex__Tags → "71_75__SitePlanTags__"`, `per-entry: Tag__SketchUpName, Tag__Description, Glb__ExportRangeNumbers (null), Glb__FullyExcluded (true), EdgePainting__AdvancedSwapOff (true), Layout__EdgeColourRGB, SitePlan__ExportFileNameStem, SitePlan__LayerLabel, SitePlan__LayerGroup, SitePlan__DrawOrder, SitePlan__ExportFills, SitePlan__LineColourId, SitePlan__LineType, SitePlan__LineWeightMm, SitePlan__FillColourId, SitePlan__FillOpacity, SitePlan__VisibleAtScales`, `SitePlanExportConfig: TagNumberRange [71,75], TagNamePatternRegex "^\\d{2}__SitePlan__", ExportFolderName "SitePlan__DrawingData", ManifestFileName, LineworkFileSuffix "__LineworkModel__", FillFileSuffix "__FillModel__", ExportIgnoresTagVisibility true, SupportedScaleDenominators [500,1250], SketchUpTagFolderName "Site Plan", StyleUnitsNote`, `ExportExclusions.FullyExcludedTagNames, .PatternExclusionRegex, .TreatAsUntaggedTagNames, .LineworkHiddenTagNames`, `LinetypeExportConfig, GlbBuilderConfig, LineStyleReference`, `Existing DrawOrder values in use: Contours 10, OsMapping 20, MapAmendments 21, HardSurfaces 30, ExistingBuildings 40, BuildingsToBeDemolished 41, WallsAndFences 45, ParkingAndAccess 50, HedgesAndPlanting 55, Trees 56, TreesToRemove 57, RootProtectionAreas 58, DrainageAndServices 60, ProposedBuildingsSecondary 70, ProposedBuildings 71, BlueLineBoundary 89, RedLineBoundary 90, SettingOutLines 95`, `Existing LayerGroup values: "Base Map", "Boundaries", "Buildings", "External Works", "Soft Landscape"`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__EdgeMaterials__.json`

Edge/line colour SSOT. Site plan LineColourId / FillColourId are keys in here; the exporter reads only HexValue.

*Key symbols:* `Na__DataLib__CoreIndex__EdgeMaterials → <series> → <MTE key> → HexValue`, `MTE102__LineColour__SoftBlack__L20, MTE103__LineColour__DarkGrey__L40, MTE107__LineColour__LightGrey__L85, MTE201__LineColour__Red, MTE202__LineColour__Green, MTE205__LineColour__Blue`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CacheData__.rb`

GitHub-first / 30-minute cache / local-fallback loader for the SSOT files.

*Key symbols:* `Na__DataLib__CacheData.Na__Cache__LoadData(key)`, `key map (~49-52): :materials => 'Materials', :edge_materials => 'Edge Materials', :tags => 'Tags', :components => 'Components'`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__DynamicReloaderPluginUtil__.rb`

Menu registration and hot reload. The Extensions menu is built here, NOT in Main__.rb and NOT in the loader.

*Key symbols:* `self.Na__DynamicReloader__RegisterMenu (~12) — UI.menu('Extensions').add_submenu('Na__TrueVision3D'); add_item 'Na__TrueVision3D__GlbBuilderUtility' (~30), 'Create Standardised Tags From Index' (~35), 'Export Site Plan Data' (~40); guarded by @menu_registered`, `self.Na__DynamicReloader__ReloadAllScripts (~59) — Dir.glob(NA_PLUGIN_ROOT/*.rb) + load`, `self.Na__PublicApi__RegisterMenu (~133) — wrapper`, `self.Na__DevTools__ReloadScripts (~137) — wrapper`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__.rb`

HtmlDialog host and action router. The dialog's site plan card lands here.

*Key symbols:* `self.Na__UserInterface__AddDialogCallbacks(dialog) (~190) — registers 'na_tvgb_dialog_ready' and 'na_tvgb_run_action'`, `self.Na__UserInterface__HandleAction(dialog, action_id, params_json) (~216) — case dispatch; 'export_site_plan' at ~219`, `self.Na__UserInterface__ActionExportSitePlan(dialog) (~291) — TAKES NO params_json today`, `self.Na__UserInterface__ActionExportModel(dialog, params_json) (~256) — the params-carrying pattern to copy`, `self.Na__UserInterface__ApplyExportParams(params_json)`, `self.Na__UserInterface__ParseParams(params_json)`, `self.Na__UserInterface__PushStatus / PushReport / PushModelStatus / PushProjectStatus`, `site_plan_tag_count (~510, via model.layers.count { |l| l.name =~ SITE_PLAN_TAG_PATTERN })`, `can_export_site_plan (~593)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiLayout__.html`

Dialog markup. The site plan action card and the status row live here.

*Key symbols:* `#naTvgbSitePlanCount (~102)`, `#naTvgbExportSitePlanCard (~191) with onclick="Na__Tvgb__RunExportAction('export_site_plan')" (~192)`, `label 'Export Site Plan Data' (~195), description (~196)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiBridge__.js`

Dialog JS bridge. Holds naTvgbState and the action gate.

*Key symbols:* `naTvgbState.canExportSitePlan (~31)`, `action gate for 'export_site_plan' (~167)`, `status.can_export_site_plan / status.site_plan_tag_count applied (~302, ~308)`, `card disable logic for naTvgbExportSitePlanCard (~578)`, `published surface Na__Tvgb__Confirm, Na__Tvgb__SetStatus, Na__Tvgb__ProjectCode`, `Na__Tvgb__RunExportAction(actionId, params)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Logging__.rb`

Export log session. The site plan export opens its own session around the write phase.

*Key symbols:* `self.Na__Log__OpenSession(export_dir) (~73) — writes GlbBuilder__ExportLog__%TIMESTAMP%.txt into the export folder`, `self.Na__Log__CloseSession (~115) — returns the log path`, `self.Na__Log__Puts(message) (~156) — file always, console only when ConsoleVerbose`, `self.Na__Log__Warn(message) (~170) — file AND console always`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Doc__DevLog__.md`
*Version:* GLB Builder Utility 2.10.1

THE changelog. Newest entry at the TOP. Site plan entries: 2.7.0 (~461, new module 1.0.0), 2.7.1 (~441, module 1.1.0), 2.7.2 (~424, module 1.1.1), 2.7.3 (~349, linetype export). Current head is 2.10.1 - 20-Sep-2026.

*Key symbols:* `Entry format: '# ---------------------------------------------------------' then '### GLB Builder Utility - Version X.Y.Z - DD-Mmm-YYYY' then '#### Title Case Headline' then **Why** / **New:** / **Changed:** `file` (module version) / **Not run in SketchUp.**`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Doc__ReadMe__.md`

User-facing reference. Site plan section at ~176-186; tag range table lists NaModel__SitePlan__{Layer} = 71-75 at ~61. No version numbers recorded here.

*Key symbols:* `'## Site Plan Export (Tags 71-75)' (~176)`, `'#### Tag Range Definitions for Segmentation' (~33)`, `'#### Linetype Linework Export' (~27)`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__LinetypeLineworkExport__.rb`

The SIBLING pattern. A second per-tag linework exporter, written 18-Sep-2026 four days after the site plan one, driven by Glb__LineworkOnly and LinetypeExportConfig, running as PHASE 3 of the model export with no manifest. Read it before adding a third exporter: it is the house's own answer to 'how do I add another tag-driven GLB stream'.

*Key symbols:* `Na__LinetypeLinework__* methods`, `LinetypeExportConfig in the Tags SSOT`, `called from Na__ExportCore__PlanLinetypeLinework (~991) and Na__ExportCore__ExportLinetypeLinework (~1002) in CoreExport__.rb`

#### `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__PLAN__SitePlanDrawings__.md`

The plan/ledger doc. Section around line 84 (SP04) claims the manifest DONE at 2.7.0; the worked manifest example sits around lines 418-449; the build-script descriptor example around 517-521; section 13 is the progress ledger. ITS MANIFEST EXAMPLE DIVERGES FROM THE CODE — see traps.

*Key symbols:* `SP04 row (~84)`, `manifest example (~418-443)`, `'Layer__Style is resolved from the SSOT at export time: MTE ids become hex.' (~449)`, `build descriptor with Layer__LineworkUrl / Layer__FillUrl (~517-521)`, `(~633) Na__LeEdge__Effective default layer becomes the store's Layer__Style for site plan categories`

### Conventions observed

- HEADER BLOCK. Every .rb opens with a banner: a line of '# ====' (77 '='), the title in CAPS, another '# ====', then a blank '#', then aligned key/value comment lines FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / CREATED, then 'DESCRIPTION:' bullets, then 'DEPENDENCIES:' bullets, then 'DEVELOPMENT LOG:' with newest-first dated version bullets, then '# ===='. Files close with '# ====', '# END OF FILE', '# ===='.
- REGIONS. Code is divided by '    # ----- (77 dashes)' / '    # REGION | Title' / '    # -----' and closed with '    # endregion -----------------'. SitePlanExport has five: Constants, Standards Data, Geometry Collection, Checks and Summary, Writing, Entry Point.
- METHOD BANNERS. Each method is preceded by one of 'FUNCTION | ', 'HELPER FUNCTION | ', 'SUB FUNCTION | ', 'ACTION HANDLER | ', 'MODULE CONSTANTS | ', 'MODULE VARIABLES | ' in caps, wrapped by '        # ------------------------------------------------------------' or '        # ---------------------------------------------------------------' lines above and below the whole comment+method. Longer explanations sit between the banner and the method, as ordinary '#' prose in full sentences.
- PARAM DOCS. Where a method takes several arguments, '# @param name [Type] Description' lines are aligned, followed by '# @return [Type] Description'. Not universal — only on the walk and the export entry points.
- METHOD NAMING. Strictly `self.Na__<Domain>__<VerbPhrase>` with DOUBLE underscores between all three parts and Pascal-cased verb phrases. Domains actually in use: Na__SitePlan__, Na__ExportCore__, Na__ExportConfig__, Na__Helpers__, Na__GlbEngine__, Na__GltfHelpers__, Na__LineworkEngine__, Na__Instancing__, Na__TagsManager__, Na__DoorHandler__, Na__CameraFollowHandler__, Na__PortalMapper__, Na__DynamicReloader__, Na__UserInterface__, Na__PublicApi__, Na__Log__, Na__ToolbarIconLoader__, Na__LinetypeLinework__. A new exporter gets its own domain token.
- MODULE NESTING. Every file is `module TrueVision3D` / `  module GlbBuilderUtility` re-opened flat, 4-space indent per level, closed with `end  # module GlbBuilderUtility` / `end  # module TrueVision3D`. No classes anywhere. Everything is `def self.`. State lives in module instance variables (@na_...) on GlbBuilderUtility.
- CONSTANT NAMING. Module-wide shared constants are bare SCREAMING_SNAKE (INCHES_TO_METERS, GLB_MAGIC, SITE_PLAN_TAG_PATTERN). Constants private to one module file are prefixed NA__<DOMAIN>__NAME (NA__SITEPLAN__MAX_DEPTH, NA__TAGS_MANAGER__CREATE_PREFIX_RANGES). Hashes and arrays are .freeze'd. Every constant carries an inline '# <-- explanation' comment aligned in a column.
- INLINE COMMENTS. '# <-- text' is the house marker for an explanatory trailing comment, aligned into a column. Plain '#' trailing comments are used inside method bodies.
- JSON KEY NAMING. Domain-prefixed with double underscores: Tag__, Glb__, Storey__, Layout__, SitePlan__, EdgePainting__ in the SSOT; SitePlanData__ and Layer__ in the manifest. Values in the SSOT are aligned on a colon column. Every config block opens with a 'Description' key and carries 'XxxNote' sibling keys for prose.
- LOGGING. Na__Log__Puts for ordinary lines (file always, console only when ConsoleVerbose), Na__Log__Warn for anything that must be seen (file AND console). The site plan export prefixes every line '  [SitePlan] '. Bare `puts` is used only outside a log session (module load errors, TagsManager, config loaders), prefixed '    [GlbBuilder] ' or '  [TagsManager] ' and often with ✓ / ✗ / ⚠ glyphs.
- USER MESSAGES. Plain English sentences, lower-case after the first word, no jargon, telling the person what to do: 'Close the group or component you are editing, then export the site plan again.' Multi-line built with \n and Ruby's ' \' line continuation inside the string.
- DIALOGS. UI.messagebox(text, MB_YESNO) compared against IDYES for every confirm; UI.select_directory(options_hash) for folders; Sketchup.read_default / write_default(SECTION, KEY, value) for remembered state.
- ERROR HANDLING. Method-level `rescue => e` returning a safe default, with the message logged; `begin/ensure` where a resource must close (the log session). Never a bare rescue that swallows silently without a log line.
- VERSIONING. No Ruby version constant for the plugin. Each MODULE carries its own NA__<DOMAIN>__EXPORTER_VERSION string and repeats it in the header DEVELOPMENT LOG. The PLUGIN version is recorded only in Na__TrueVision__GlbBuilder__Doc__DevLog__.md, newest entry at the top, and the DevLog entry names the module file and its new module version in a '**Changed:** `file` (1.1.1)' line.

### Extension points

**New site plan tags (OS main roads / minor streets / minor feature, neighbouring buildings, site feature access + paths, mixed woodland trees, hedges and planting, waterbodies) and the three renames**

- *Where:* Na__DataLib__CoreIndex__Tags__.json → "Na__DataLib__CoreIndex__Tags" → "71_75__SitePlanTags__" (~586), AND ExportExclusions.FullyExcludedTagNames (~1015 area)
- *How:* Add one entry per tag keyed by its Tag__SketchUpName, carrying the full SitePlan__ field set (ExportFileNameStem, LayerLabel, LayerGroup, DrawOrder, ExportFills, LineColourId, LineType, LineWeightMm, FillColourId, FillOpacity, VisibleAtScales) plus Glb__ExportRangeNumbers: null, Glb__FullyExcluded: true, EdgePainting__AdvancedSwapOff: true, Layout__EdgeColourRGB. Bump meta.version and meta.lastUpdated. ALSO add every new name to ExportExclusions.FullyExcludedTagNames or the model export will write it into a category GLB. No exporter code change is needed for new tags — Na__SitePlan__BuildLayerDefinitions is data-driven.
- *Risk:* A rename breaks two things silently: (a) any model already tagged with the old name loses its geometry — the site plan export has NO legacy-name mechanism, unlike the linetype export's Glb__LineworkLegacyTagNames; (b) the old name stays in FullyExcludedTagNames and the new one does not, so the RENAMED tag's geometry starts landing in model GLBs. The local fallback Na__TrueVision__GlbBuilder__TagsIndex__.json also holds the old names and is already stale.

**Per-layer Z-INDEX / height hierarchy (1..10)**

- *Where:* New SitePlan__ field in the SSOT entries; read in Na__SitePlan__BuildLayerDefinitions (~147-164, the layers[name] hash); written in Na__SitePlan__Write's records << {...} (~652-666)
- *How:* Add e.g. SitePlan__ZIndex to each SSOT entry, pull it into the definition hash alongside :draw_order, and emit it as Layer__ZIndex in the manifest record. Decide explicitly whether it REPLACES SitePlan__DrawOrder (currently 10..95, used as the manifest sort key at ~669: records.sort_by! { [DrawOrder || 0, TagName] }) or sits beside it — two orderings that disagree is the failure mode.
- *Risk:* DrawOrder is already the de-facto z-order and the manifest is already sorted by it; readers downstream (ProjectVision build script, TrueVision site plan drawings) consume that order. A 1..10 index cannot express the current 18 distinct DrawOrder values without collisions, so the sort must stay deterministic (keep TagName as the tiebreak).

**"Export Polygon Faces" toggle — the toggle itself**

- *Where:* UI: 05__Plugin__UserInterface/Na__TrueVision__GlbBuilder__UiLayout__.html near #naTvgbExportSitePlanCard (~191) and Na__TrueVision__GlbBuilder__UiBridge__.js naTvgbState (~31) / Na__Tvgb__RunExportAction. Ruby: Na__UserInterface__HandleAction 'export_site_plan' branch (UserInterface__.rb ~219) and Na__UserInterface__ActionExportSitePlan (~291).
- *How:* Na__UserInterface__ActionExportSitePlan currently takes only (dialog) and passes nothing. To carry a toggle, change the dispatch at ~219 to pass params_json, change the handler signature to (dialog, params_json), parse with Na__UserInterface__ParseParams, and copy the pattern from Na__UserInterface__ActionExportModel (~256) / Na__UserInterface__ApplyExportParams. Then widen Na__PublicApi__ExportSitePlanData (Main__.rb ~639) and Na__SitePlan__Run (~732) to take an options hash. For the MENU path (DynamicReloaderPluginUtil__.rb ~40) there is no params channel at all — either persist the toggle with Sketchup.write_default(NA__SITEPLAN__PREFS_SECTION, 'SitePlanExportFaces', bool) the way NA__SITEPLAN__PREFS_KEY_DIR persists the folder, or add a second menu item.
- *Risk:* Two entry points (menu and dialog) with one option means the menu path silently uses a default. The Sketchup.read_default route keeps both in step.

**"Export Polygon Faces" toggle — the geometry and the file**

- *Where:* Na__SitePlan__NewBucket (~193), Na__SitePlan__AddFace (~257), a new writer beside Na__SitePlan__WriteFill (~558), the per-layer loop in Na__SitePlan__Write (~624-667), NA__SITEPLAN__CONFIG_DEFAULTS (~62), NA__SITEPLAN__OLD_FILE_PATTERN (~74), SitePlanExportConfig in the Tags SSOT (~1094)
- *How:* Na__SitePlan__AddFace today only walks face.loops and stores ring point lists — no triangulation. For 2D face meshes, add a triangulated accumulator to the bucket (e.g. mesh_positions + mesh_indices) filled from face.mesh (Geom::PolygonMesh: .points, .polygons, 1-based signed indices), transformed and scaled identically (transform * point, × INCHES_TO_METERS). Write a third GLB with mode 4 (TRIANGLES), POSITION 5126/VEC3/34962 and an indices accessor 5123 or 5125 with target 34963 via Na__GltfHelpers__AddAccessor. Add 'FaceFileSuffix' => '__FaceModel__' (or similar) to NA__SITEPLAN__CONFIG_DEFAULTS and the matching key to SitePlanExportConfig — Na__SitePlan__Config only copies keys already present in the defaults hash, so a SSOT-only key is ignored. Add a Layer__FaceFile key to the manifest record (~652-666).
- *Risk:* NA__SITEPLAN__OLD_FILE_PATTERN only matches (?:LineworkModel|FillModel) — a new suffix is invisible to stale detection, so old face GLBs from a previous export are never offered for deletion and the pipeline keeps publishing them. Widen the regex in the same change. Also note face.mesh polygon indices are 1-based and negative for soft edges — take .abs - 1.

**Existing vs Proposed site plan variant selector**

- *Where:* Na__SitePlan__ChooseFolder (~512), NA__SITEPLAN__TV_CONTENT_FOLDER (~77), NA__SITEPLAN__PREFS_KEY_DIR (~76), Na__SitePlan__ProjectPrefix (~455), the manifest hash in Na__SitePlan__Write (~671-684), the stale scan (~690-692)
- *How:* Na__SitePlan__ChooseFolder is the single folder decision: it offers UI.select_directory seeded from the remembered dir, special-cases a folder basename of '30__TrueVision__AppContent' by descending into config['ExportFolderName'] and mkdir_p'ing it, then warns via MB_YESNO if the final basename is not ExportFolderName. Auto-detection by folder belongs exactly here — read the chosen basename (or the .skp filename token) and set a variant, e.g. SitePlan__DrawingData__Existing / __Proposed. NA__SITEPLAN__PREFS_KEY_DIR remembers ONE directory; a second key per variant, or a variant-qualified key, is needed or the two variants fight over the remembered folder. Na__SitePlan__ProjectPrefix already parses the model basename ('PS01_M10__SitePlanModel.skp' → 'PS01__') and discards everything after the code — that discarded token (M10) is the natural variant signal. Emit a new SitePlanData__Variant key in the manifest.
- *Risk:* The stale scan uses Dir.children(export_dir) against NA__SITEPLAN__OLD_FILE_PATTERN, which matches a leading '(?:.*?__)?' — so if both variants ever share a folder, exporting one variant offers to DELETE the other variant's GLBs. Keep the variants in separate folders, or make the pattern variant-aware.

**SketchUp FACE MATERIALS for the fills (opaque in SketchUp, alpha only in TrueVision)**

- *Where:* Na__SitePlan__AddFace (~257) and Na__SitePlan__WriteFill (~558) read NO material at all; Na__DataLib__CoreIndex__Materials__.json is the materials SSOT; TagsManager only applies Layout__LineStyleName and Layout__EdgeColourRGB to the LAYER (Na__TagsManager__ApplyTagStyling ~225)
- *How:* Today the fill GLB carries geometry only — colour and opacity reach TrueVision exclusively through the manifest's Layer__Style.FillHex / FillOpacity, resolved from SitePlan__FillColourId via the EdgeMaterials SSOT. If SketchUp face materials are to drive the fill instead, face.material must be read inside Na__SitePlan__AddFace and either written as COLOR_0 / a glTF material on the new face primitive, or resolved back to a SitePlan__FillColourId. Note the DELIBERATE split the brief describes (opaque in SketchUp, alpha only in TrueVision) is already how it works: opacity is a manifest number, never baked into the GLB.
- *Risk:* Adding a glTF material to the fill GLB would make the SketchUp material authoritative and silently override SitePlan__FillOpacity from the SSOT. Keep one source of truth and say which.

**SVG hatch library / pattern generator / "Patterns" panel / "Site Plan Render Composites" dropdown**

- *Where:* Nothing in the SketchUp plugin. These are TrueVision app-side (D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode). The plugin's only contribution would be a new SitePlan__ field per tag.
- *How:* If a layer needs to name a hatch pattern, add e.g. SitePlan__HatchPatternId to the SSOT entries and carry it into the definition hash in Na__SitePlan__BuildLayerDefinitions and into Layer__Style in Na__SitePlan__Write. Layer__Style is a free-form hash built at ~155-163 and copied verbatim into the manifest at ~663, so a new style key costs two lines and no schema machinery.
- *Risk:* Layer__Style is consumed downstream by the ProjectVision build script and the TrueVision site plan store (plan doc ~633: 'Na__LeEdge__Effective's default layer becomes the store's Layer__Style for site plan categories'). Adding a key is safe; renaming or removing one is not.

### Traps

- MANIFEST KEY LIST, AS THE CODE ACTUALLY WRITES IT (Na__SitePlan__Write ~671-684). Top level, in this order: SitePlanData__Description (a long fixed sentence ending '...Read by the ProjectVision build script and TrueVision3D site plan drawings.'), SitePlanData__SchemaVersion (integer 1), SitePlanData__ProjectPrefix (prefix with the trailing '__' stripped, e.g. 'PS01'), SitePlanData__SourceModelFile (File.basename of model.path, or null when unsaved), SitePlanData__ExportedIso (Time.now.utc.strftime('%Y-%m-%dT%H:%M:%SZ')), SitePlanData__ExporterVersion, SitePlanData__TagsSsotVersion (tags_data['meta']['version']), SitePlanData__Units ('metres'), SitePlanData__UpAxis ('Y'), SitePlanData__NorthAngleDeg (model.shadow_info['NorthAngle'].to_f, 0.0 on any error), SitePlanData__BoundsMm, SitePlanData__Layers (array). Written with JSON.pretty_generate + "\n", mode 'w:UTF-8'.
- MANIFEST PER-LAYER KEYS, AS THE CODE ACTUALLY WRITES THEM: Layer__TagName, Layer__CategoryKey (= the stem, e.g. 'TrueVision__SitePlan__ProposedBuildings'), Layer__Label, Layer__Group, Layer__DrawOrder, Layer__LineworkFile (bare filename, not a path or URL), Layer__FillFile (nil when no fill), Layer__SegmentCount (positions.length / 6), Layer__RingCount, Layer__BoundsMm, Layer__Style, Layer__VisibleAtScales, Layer__Warnings (always present, [] when none). Records are sorted by [Layer__DrawOrder || 0, Layer__TagName].
- Layer__Style AS THE CODE WRITES IT has SEVEN keys, not five: LineColourId, LineHex, LineType, LineWeightMm, FillColourId, FillHex, FillOpacity. The plan doc's worked example (TrueVision__PLAN__SitePlanDrawings__.md ~441) shows only LineHex/LineType/LineWeightMm/FillHex/FillOpacity. The two Id keys are real and are written. Hex resolution: LineHex = hex_by_id[LineColourId] or nil if the id is absent from the EdgeMaterials SSOT — a typo'd MTE id yields a null hex with NO warning.
- SitePlanData__ExporterVersion IS THE MODULE VERSION ('1.1.1'), NOT the GLB Builder version. The plan doc example shows '2.7.0' (the plugin version). Anything reading that field to gate behaviour is reading a different number than the doc implies.
- THE FILL GLB IS NOT FILLED. Despite the name FillModel, it contains one LINE_LOOP primitive (mode 2) PER RING — outlines, not surfaces. There are no triangles, no indices, no COLOR_0 and no materials anywhere in it. The 'Export Polygon Faces' work is the first time real face meshes would exist. Any downstream code that already treats FillModel as a mesh is wrong today.
- STALE DETECTION IS SUFFIX-BLIND. NA__SITEPLAN__OLD_FILE_PATTERN = /\A(?:.*?__)?TrueVision__SitePlan__[A-Za-z0-9]+__(?:LineworkModel|FillModel)__\.glb\z/i. It only matches an ALPHANUMERIC stem tail — a stem with a digit-free name is fine, but a stem containing an underscore or hyphen after 'TrueVision__SitePlan__' will NOT match and its old file will never be cleaned up. And a new file suffix (a face model) is invisible to it. It runs with Dir.children(export_dir), matched against the `written` array of bare filenames from THIS run only.
- SITE PLAN TAGS ARE IN THE FULLY-EXCLUDED LIST ON PURPOSE, AND SUBTRACTED ON PURPOSE. Na__SitePlan__Scan (~360) does `excluded.reject { |name| layer_defs.key?(name) }`. If a new tag is added to FullyExcludedTagNames but its entry lacks SitePlan__ExportFileNameStem (a typo, a null), it is NOT a layer def, so it is NOT subtracted, so the site plan walk prunes it — the geometry vanishes from BOTH exports with no warning at all.
- TAG CREATION IS RANGE-GATED. NA__TAGS_MANAGER__CREATE_PREFIX_RANGES includes (71..75) only. A new site plan tag numbered 76 or 70 would be exported correctly by SitePlanExport (which is name-pattern-free and reads only SitePlan__ExportFileNameStem) but would NEVER be created by 'Create Standardised Tags From Index'. Two different rules for the same tag set.
- SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/ is used ONLY by the MODEL export (Na__ExportCore__IdentifyExcludedLayers) and by the dialog's site_plan_tag_count. The site plan exporter itself never uses it. A tag renamed away from the 'NN__SitePlan__' shape would still export as site plan data but would stop being excluded from the model GLBs by pattern (only by the explicit FullyExcludedTagNames list).
- COORDINATE FRAME. The walk starts at Z_UP_TO_Y_UP_MATRIX, so every stored coordinate is ALREADY glTF Y-up: bucket index 0 = SketchUp X, index 1 = SketchUp Z (height), index 2 = SketchUp -Y. The flatness check (~393) uses index 1 (correct: height). Na__SitePlan__BoundsMm (~439) uses indices 0 and 2 and emits MinX/MinZ/MaxX/MaxZ in MILLIMETRES (× 1000, rounded to 1dp) — so the manifest mixes units: metres in the GLBs, millimetres in the bounds. Nothing labels this.
- SOFT AND SMOOTH EDGES ARE DROPPED. Na__SitePlan__Collect skips edge.soft? || edge.smooth? and counts them. A site plan drawn with smoothed arcs exports almost nothing. Same for anything hidden? (entity level) at any depth. Both are counted per layer and surfaced in three places (summary, log 'Check {tag}: {text}', manifest Layer__Warnings).
- LAYER VISIBILITY IS IGNORED BY DESIGN (ExportIgnoresTagVisibility: true). The visibility branch in Na__SitePlan__Collect (~307) is dead code under the shipped config. Do not 'fix' it.
- THE OWNER IS THE NEAREST SITE PLAN TAG ABOVE, NOT THE ENTITY'S OWN TAG. A group tagged 73__SitePlan__Buildings__Existing whose children are Untagged puts every child edge on that layer. A child explicitly tagged with a DIFFERENT site plan tag re-owns itself and everything below it. An edge with no site plan tag anywhere above is silently dropped (`next if owner.nil?`).
- NO RUBY INTERPRETER ON THE STUDIO PC. Nothing here can be run or syntax-checked outside SketchUp (see the DevLog's repeated 'Not run in SketchUp. Block-balance check only.'). Every site plan release so far shipped on a block-balance check and Adam's manual Reload Scripts + export.
- A NEW SitePlanExportConfig KEY IS IGNORED UNLESS IT IS ALSO IN NA__SITEPLAN__CONFIG_DEFAULTS. Na__SitePlan__Config (~177) iterates NA__SITEPLAN__CONFIG_DEFAULTS.each_key — SSOT keys with no default counterpart are dropped on the floor. SupportedScaleDenominators, TagNumberRange, TagNamePatternRegex and SketchUpTagFolderName are all in the SSOT block today and all invisible to the exporter for exactly this reason.
- THE LOG SESSION ONLY WRAPS THE WRITE PHASE. Na__Log__OpenSession is called inside Na__SitePlan__Write (~617) and closed in its ensure (~715). Everything in Scan — including the 'Local file unreadable, using the DataLib cache' warnings from Na__SitePlan__LoadDataLibFile — happens before any log file exists, so it reaches the Ruby Console only (via Na__Log__Warn's unconditional puts).
- MENU REGISTRATION IS GUARDED BY @menu_registered AND LIVES IN THE RELOADER, NOT THE LOADER. The copy of the loader inside the modules folder (THIS__GOES__IN__PLUGINS__FOLDER__--_...) points at a NON-EXISTENT folder name ('Na__TrueVision__WhitecardModel__GlbBuilderUtility__Modules__') and is stale — it is not the live loader. Adding a menu item means editing Na__DynamicReloader__RegisterMenu.
- truevision_cloud_manager.rb is required LAST from Main__.rb on purpose (it overrides Na__CloudSync__Execute and Na__CloudSync__RunR2Sync). Do not reorder the require block.
- THE LOCAL FALLBACK TagsIndex__.json IS ALREADY OUT OF DATE with the SSOT and carries no SitePlan__ fields. If it is ever reached (both the local SSOT file and the cache fail), tag creation produces bare unstyled, unfoldered tags — and Na__SitePlan__BuildLayerDefinitions returns EMPTY, because it reads Na__DataLib__CoreIndex__Tags, which that file does not have. The export then shows 'The Tags SSOT has no site plan tags.'

### Open questions raised by this survey

- Does the new Z-INDEX (1..10) REPLACE SitePlan__DrawOrder (currently 10..95 across 18 layers, and the manifest's sort key) or sit beside it? Two orderings that can disagree is the failure mode, and downstream readers already consume the DrawOrder sort.
- Are the three tag RENAMES rename-in-place (old name dead) or aliases? The site plan export has no legacy-name mechanism, unlike the linetype export's Glb__LineworkLegacyTagNames. Models already tagged with the old names (PS01 at minimum) lose that geometry silently. Which three tags are they?
- Do the new tags stay inside 71-75? NA__TAGS_MANAGER__CREATE_PREFIX_RANGES only auto-creates 71..75, while the exporter itself is number-blind. Anything outside that range exports but is never created by the Tag Manager.
- With face materials on the fills, which becomes authoritative for colour and opacity — the SketchUp material, or SitePlan__FillColourId / SitePlan__FillOpacity in the SSOT (the only source today)? The brief says 'opaque in SketchUp, alpha only in TrueVision', which is exactly the current split, so the materials may be for SketchUp legibility only and may not need to reach the GLB at all.
- Does the polygon-face export REPLACE the LINE_LOOP FillModel or add a third file per layer? Replacing changes the meaning of Layer__FillFile for every existing reader; adding needs a new manifest key, a new config suffix and a widened NA__SITEPLAN__OLD_FILE_PATTERN.
- Existing vs Proposed: two sibling folders under 30__TrueVision__AppContent, or one folder with variant-suffixed filenames? The stale-file scan is folder-wide and will offer to delete the other variant's GLBs if they share a folder.
- Should SitePlanData__ExporterVersion start reporting the GLB Builder version (2.10.x) instead of the module version (1.1.1)? The plan doc already documents it as the plugin version. Changing it is a schema-visible change; bumping SitePlanData__SchemaVersion past 1 may be warranted anyway once new keys land.
- Is the local fallback Na__TrueVision__GlbBuilder__TagsIndex__.json still wanted? It is stale, has no SitePlan__ data, and cannot produce layer definitions at all — it only makes bare tags.

---

<a id="area-10"></a>
## 10. SketchUp SSOT data library (Na__Common__DataLib__CoreSuEntityStandards) - tags, edge materials, face materials, and every plugin that reads them

### Summary

LINE NUMBERS BELOW ARE POINTERS ONLY - always locate by key/function name, not by line.

SHAPE OF THE LIBRARY. Six files live in C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards: three JSON SSOTs (Tags 1167 lines, EdgeMaterials 445, Materials 388, plus a fourth Components file not in scope) and three Ruby loaders (CacheData 376, UrlGenerator 81, LocalFallback 119). The loaders are a three-stage chain: Na__DataLib__CacheData.Na__Cache__LoadData(file_key, force_reload=false) reads a 30-minute temp-dir cache (CACHE_MAX_AGE_SECONDS=1800, CACHE_SUBFOLDER_NAME="Na__DataLib__Cache", CACHE_FILE_PREFIX="Na__DataLib__Cache__"), else HTTPS-fetches the GitHub raw URL built by Na__DataLib__UrlGenerator.Na__Url__BuildRawUrl, else falls back to the plugins-folder copy via Na__DataLib__LocalFallback.Na__Fallback__LoadLocal (which pops a UI.messagebox once per session). FILE_KEYS in UrlGenerator maps :materials, :edge_materials, :tags, :components to the four filenames; GITHUB_RAW_BASE is https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/. A NEW FILE (e.g. a hatch-pattern SSOT) must be registered in BOTH UrlGenerator::FILE_KEYS and CacheData::FILE_KEY_LABELS or it can never be loaded or reported.

CRITICAL: GitHub is the primary source, the plugins folder is only the last-resort fallback - EXCEPT that the two exporters that matter most (SitePlanExport, LinetypeLineworkExport) and TagsManager deliberately invert this and read the LOCAL plugins-folder file FIRST (Na__SitePlan__LoadDataLibFile, Na__Linetype__LoadTagsData, Na__TagsManager__LoadLocalDataLibFile). So an SSOT edit made locally takes effect immediately for the exporters but NOT for the Edge Paint plugin, GlbBuilder Main's exclusion loading, Noble3dModellingTools or AssemblyStudio, which all go through the cache/URL path and will keep serving the old GitHub copy for up to 30 minutes (or indefinitely if GitHub is not updated).

TAGS SSOT. Top-level keys in order: meta, Na__DataLib__CoreIndex__Tags, ExportExclusions, SitePlanExportConfig, LinetypeExportConfig, GlbBuilderConfig, LineStyleReference. meta.version is "2.3.2", meta.lastUpdated "18-Sep-2026". meta.fieldPrefixes has six entries: "Tag__", "Glb__", "Storey__", "Glb__Linework", "Layout__", "SitePlan__" (the SitePlan__ prose states that an entry carrying SitePlan__ExportFileNameStem IS a site plan layer and that such entries carry no Glb__ExportFileNameStem). meta.skipRanges is [0, 2, 3, 4, 5, 6] with skipRangesNote "Tags with these numeric IDs are ignored by the GLB exporter and not exported." The library has nine sections: 00__ModelFlagTags__, 00__SystemAndUtilityTags__, 03__LayoutDrawingLineworkTags__, 07__EnvironmentTags__, 10_19__ExistingBuildingTags__, 20_29__ProposedBuildingTags__, 30_70__FurnitureAndContextTags__, 71_75__SitePlanTags__ (line ~586, 18 tags + a section-level Tag__Description), 90_93__StoreyContainerTags__. Across all entries only these 31 field names are ever used: Tag__SketchUpName, Tag__Description, Tag__EdgeMaterial__Config, Tag__LineStyle__Config, Glb__ExportRangeNumbers, Glb__ExportFileNameStem, Glb__FullyExcluded, Glb__LineworkHidden, Glb__LineworkOnly, Glb__LineworkLabel, Glb__LineworkLineType, Glb__LineworkLegacyTagNames, Layout__EdgeColourID, Layout__EdgeColourRGB, Layout__LineStyleName, Layout__UsageNote, EdgePainting__AdvancedSwapOff, Storey__IsContainer, Storey__ContainerExportName, Storey__ElementExportName, and the twelve SitePlan__ fields. There is NO z-index/height field today - SitePlan__DrawOrder (integers 10..95, currently 10,20,21,30,40,41,45,50,55,56,57,58,60,70,71,89,90,95) is the only ordering key, and it is carried straight into the manifest as Layer__DrawOrder and used to sort the manifest records.

EDGE MATERIALS SSOT (version 2.1.0, 14-Sep-2026). Two root blocks: Na__DataLib__CoreIndex__EdgeMaterials (series MTE000__DefaultSeries__, MTE100__GreyscaleSeries__, MTE200__AccentColourSeries__) and a separate Na__DataLib__CoreIndex__ConstructionLinework (its own meta + MTE300__ConstructionLineSeries__, Vale lantern setting-out, 14 entries MTE301-306/311-313/321-325). indexPattern "^MTE\\d{3}__". MTE201 red #E53935, MTE202 green #43A047, MTE205 blue #1E88E5 all exist. Site plan layers reference MTE ids only - Na__SitePlan__EdgeHexIndex walks EVERY series of Na__DataLib__CoreIndex__EdgeMaterials and indexes key -> HexValue, so any new colour must live under that root (NOT under ConstructionLinework, which it does not read) to resolve.

MATERIALS SSOT (version 1.4.3, 11-Sep-2026). Root Na__DataLib__CoreIndex__Materials with eight series; note MAT700__GlassSeries__ is placed BEFORE MAT600__MetalSeries__, so the file is not strictly numerically ordered. indexPattern "^MAT\\d{3}__", exemptPrefix "MAT000E__". MAT001__Default is the reference template listing every possible key; every other entry only states what differs and inherits the rest at render time. Colour is the string form "rgb(R, G, B)"; Opacity is a 0.0-1.0 float. Four plugins create real SketchUp materials from this file; the GlbBuilder reads it at export to enrich glTF materials.

THE SITE-PLAN PIPELINE IS EDGE-COLOUR-ONLY TODAY. Na__SitePlan__BuildLayerDefinitions resolves SitePlan__LineColourId and SitePlan__FillColourId against the EdgeMaterials hex index and writes them into the manifest as Layer__Style {LineColourId, LineHex, LineType, LineWeightMm, FillColourId, FillHex, FillOpacity}. Nothing in the site plan export touches the Materials SSOT, and the fill GLB carries no materials at all (one LINE_LOOP primitive per face ring, extras Na__SitePlanFace / Na__SitePlanRing). So the coming "Export Polygon Faces" toggle and any MAT-based fill will need Na__SitePlan__BuildLayerDefinitions and Na__SitePlan__WriteFill changed, plus a new hex index over the Materials SSOT if fills stop being MTE-keyed.

### Files that matter

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json`
*Version:* 2.3.2

Tags SSOT. 1167 lines, LF endings, no BOM, 4-space indent. Top-level keys in file order: meta, Na__DataLib__CoreIndex__Tags, ExportExclusions, SitePlanExportConfig, LinetypeExportConfig, GlbBuilderConfig, LineStyleReference. The 71_75__SitePlanTags__ section (~line 586-936) is where the seven new tags and three renames land; ExportExclusions (~975-1092) and SitePlanExportConfig (~1094-1107) must be updated in the same edit.

*Key symbols:* `meta.version = "2.3.2"`, `meta.lastUpdated = "18-Sep-2026"`, `meta.fieldPrefixes (Tag__, Glb__, Storey__, Glb__Linework, Layout__, SitePlan__)`, `meta.skipRanges = [0, 2, 3, 4, 5, 6]`, `meta.namingConvention = "{NN}__{Category}__{Subcategory}"`, `meta.GitHub__RepoUrl`, `meta.Data__URL`, `Na__DataLib__CoreIndex__Tags`, `00__ModelFlagTags__`, `00__SystemAndUtilityTags__`, `03__LayoutDrawingLineworkTags__`, `07__EnvironmentTags__`, `10_19__ExistingBuildingTags__`, `20_29__ProposedBuildingTags__`, `30_70__FurnitureAndContextTags__`, `71_75__SitePlanTags__`, `90_93__StoreyContainerTags__`, `ExportExclusions.PatternExclusionRegex`, `ExportExclusions.FullyExcludedTagNames`, `ExportExclusions.LineworkHiddenTagNames`, `ExportExclusions.AdvancedSwapOffTagNames`, `ExportExclusions.TreatAsUntaggedTagNames`, `SitePlanExportConfig`, `LinetypeExportConfig`, `GlbBuilderConfig.Logging`, `LineStyleReference.AvailableLineStyles`, `LineStyleReference.TagTemplate__Example`, `SitePlan__ExportFileNameStem`, `SitePlan__LayerLabel`, `SitePlan__LayerGroup`, `SitePlan__DrawOrder`, `SitePlan__ExportFills`, `SitePlan__LineColourId`, `SitePlan__LineType`, `SitePlan__LineWeightMm`, `SitePlan__FillColourId`, `SitePlan__FillOpacity`, `SitePlan__VisibleAtScales`, `EdgePainting__AdvancedSwapOff`, `Layout__EdgeColourRGB`, `Layout__EdgeColourID`, `Layout__LineStyleName`, `Glb__FullyExcluded`, `Glb__ExportRangeNumbers`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__EdgeMaterials__.json`
*Version:* 2.1.0

Edge (linework) colour SSOT. 445 lines. TWO independent roots: Na__DataLib__CoreIndex__EdgeMaterials (the one the site plan export indexes) and Na__DataLib__CoreIndex__ConstructionLinework (Vale lantern setting out, has its own nested meta block). Every SitePlan__LineColourId / SitePlan__FillColourId value must be a key under the FIRST root.

*Key symbols:* `meta.version = "2.1.0"`, `meta.namingConvention = "MTE{NNN}__{Category}__{Variant}"`, `meta.indexPattern = "^MTE\\d{3}__"`, `meta.uiDefaults.DefaultColourKey`, `meta.uiDefaults.DynamicPaletteSlotCount`, `meta.uiDefaults.DynamicPaletteDefaultKey`, `meta.uiDefaults.AssemblyStudioEdgeColourSwatchKeys`, `meta.uiDefaults.AssemblyStudioEdgeColourSwatchLabels`, `meta.uiDefaults.AssemblyStudioEdgeColourPartDefaults`, `NamingRationale.PrefixBreakdown (M/T/E = Material Type Edge)`, `NamingRationale.NumberingLogic`, `Na__DataLib__CoreIndex__EdgeMaterials`, `MTE000__DefaultSeries__`, `MTE100__GreyscaleSeries__`, `MTE200__AccentColourSeries__`, `Na__DataLib__CoreIndex__ConstructionLinework`, `MTE300__ConstructionLineSeries__`, `SketchUpName`, `HexValue`, `RgbValue`, `HsbValue`, `Description`, `SwatchName`, `IsDefault`, `IsReserved`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Materials__.json`
*Version:* 1.4.3

Face (surface) material SSOT + PBR render settings. 388 lines. Where the new site plan FACE materials go. Series are MAT000__DefaultSeries__, MAT010__ModelingUtilitySeries__, MAT100__BasicSeries__, MAT300__PaintSeries__, MAT500__TimberSeries__, MAT700__GlassSeries__, MAT600__MetalSeries__, MAT900__SceneEntourageSeries__ (700 sits before 600 in the file).

*Key symbols:* `meta.version = "1.4.3"`, `meta.namingConvention = "MAT{NNN}__{Category}__{Variant}"`, `meta.indexPattern = "^MAT\\d{3}__"`, `meta.exemptPrefix = "MAT000E__"`, `meta.exemptNote`, `meta.isExemptNote`, `meta.defaultMaterial = "MAT001__Default is the reference template"`, `meta.divergenceNote`, `meta.Na__DataLib__SketchUpApiMapping`, `Na__DataLib__SketchUpApiMapping__IdentityAndControl`, `Na__DataLib__SketchUpApiMapping__CoreMaterialFields`, `Na__DataLib__SketchUpApiMapping__PbrFactorFields`, `Na__DataLib__SketchUpApiMapping__TextureMapFields`, `Na__DataLib__SketchUpApiMapping__MetadataOnlyRendererFields`, `meta.Na__DataLib__UiDefaults`, `Na__DataLib__CoreIndex__Materials`, `MAT001__Default`, `SketchUpName`, `Description`, `IsDefault`, `IsExempt`, `BaseColor`, `Opacity`, `Transparent`, `IsDoubleSided`, `PbrRoughness`, `PbrMetallic`, `EmissiveFactor`, `EmissiveIntensity`, `NormalScale`, `OcclusionStrength`, `AlphaTest`, `DepthWrite`, `EnvMapIntensity`, `AoExclude`, `ProfileLineExclude`, `TextureMaps.BaseColorUrl`, `TextureMaps.NormalUrl`, `TextureMaps.RoughnessUrl`, `TextureMaps.MetallicUrl`, `TextureMaps.EmissiveUrl`, `TextureMaps.OcclusionUrl`, `TextureMaps.AlphaUrl`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CacheData__.rb`

Three-stage loader: 30-minute temp cache -> GitHub raw URL -> local plugins-folder fallback. Every non-exporter reader goes through this, so edits to a local JSON are invisible to them until GitHub is updated or the cache is purged.

*Key symbols:* `Na__DataLib__CacheData`, `CACHE_MAX_AGE_SECONDS = 1800`, `CACHE_SUBFOLDER_NAME = "Na__DataLib__Cache"`, `CACHE_FILE_PREFIX = "Na__DataLib__Cache__"`, `HTTP_OPEN_TIMEOUT = 10`, `HTTP_READ_TIMEOUT = 15`, `FILE_KEY_LABELS { :materials, :edge_materials, :tags, :components }`, `Na__Cache__SetVerboseLogging`, `Na__Cache__SetCacheDirOverride`, `Na__Cache__ClearCacheDirOverride`, `Na__Cache__CacheDir`, `Na__Cache__CacheFilePath`, `Na__Cache__ReadIfFresh`, `Na__Cache__WriteToCache`, `Na__Cache__PurgeCacheFile`, `Na__Cache__FetchFromUrl`, `Na__Cache__LoadData`, `Na__Cache__LoadDataForceReload`, `Na__Cache__ReadAnyCache`, `Na__Cache__LastSource`, `Na__Cache__PrintStartupReport`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__UrlGenerator__.rb`

The only place that knows the GitHub repo layout and the four registered data-file keys. A new SSOT file must be added to FILE_KEYS here (and to FILE_KEY_LABELS in CacheData) before it can be loaded.

*Key symbols:* `Na__DataLib__UrlGenerator`, `GITHUB_RAW_BASE = "https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/"`, `FILE_KEYS = { :materials, :edge_materials, :tags, :components }`, `Na__Url__BuildRawUrl`, `Na__Url__FileNameForKey`, `Na__Url__AllFileKeys`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__LocalFallback__.rb`

Last-resort reader of the plugins-folder JSON copy. Prints a console warning on every fallback load and shows one UI.messagebox per SketchUp session.

*Key symbols:* `Na__DataLib__LocalFallback`, `Na__Fallback__LoadLocal`, `Na__Fallback__NotifyUserOnce`, `Na__Fallback__ResetNotification`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__SitePlanExport__.rb`
*Version:* 1.1.1

READER OF THE TAGS SSOT + EDGE MATERIALS SSOT. The Site Plan Export itself: walks the model, buckets edges/faces by nearest site plan tag, writes one linework GLB per tag (plus a fill GLB for SitePlan__ExportFills tags) and the manifest. A new site plan tag is picked up automatically the moment it carries SitePlan__ExportFileNameStem; a renamed tag orphans any geometry still on the old SketchUp name (there is NO legacy-name mechanism here, unlike the linetype export's Glb__LineworkLegacyTagNames).

*Key symbols:* `NA__SITEPLAN__CONFIG_DEFAULTS`, `NA__SITEPLAN__EXPORTER_VERSION = '1.1.1'`, `NA__SITEPLAN__SCHEMA_VERSION = 1`, `NA__SITEPLAN__MAX_DEPTH = 64`, `NA__SITEPLAN__FLAT_TOLERANCE_M = 0.5`, `NA__SITEPLAN__FAR_WARNING_M = 2000.0`, `NA__SITEPLAN__OLD_FILE_PATTERN`, `NA__SITEPLAN__PREFS_SECTION = 'TrueVision3D_GlbBuilder'`, `NA__SITEPLAN__PREFS_KEY_DIR = 'SitePlanExportDir'`, `NA__SITEPLAN__TV_CONTENT_FOLDER = '30__TrueVision__AppContent'`, `Na__SitePlan__LoadDataLibFile`, `Na__SitePlan__EdgeHexIndex`, `Na__SitePlan__BuildLayerDefinitions`, `Na__SitePlan__Config`, `Na__SitePlan__NewBucket`, `Na__SitePlan__AddEdge`, `Na__SitePlan__AddFace`, `Na__SitePlan__CountSkipped`, `Na__SitePlan__Collect`, `Na__SitePlan__Scan`, `Na__SitePlan__Warnings`, `Na__SitePlan__BoundsMm`, `Na__SitePlan__ProjectPrefix`, `Na__SitePlan__SummaryText`, `Na__SitePlan__ChooseFolder`, `Na__SitePlan__WriteLinework`, `Na__SitePlan__WriteFill`, `Na__SitePlan__NorthAngleDeg`, `Na__SitePlan__Write`, `Na__SitePlan__Run`, `Layer__TagName`, `Layer__CategoryKey`, `Layer__Label`, `Layer__Group`, `Layer__DrawOrder`, `Layer__LineworkFile`, `Layer__FillFile`, `Layer__SegmentCount`, `Layer__RingCount`, `Layer__BoundsMm`, `Layer__Style`, `Layer__VisibleAtScales`, `Layer__Warnings`, `SitePlanData__SchemaVersion`, `SitePlanData__Layers`, `Na__SitePlanFace`, `Na__SitePlanRing`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__TagsManager__.rb`

READER OF THE TAGS SSOT. Creates the standardised SketchUp tags in the model. This is what puts a new site plan tag into SketchUp, styles it (Layout__LineStyleName, Layout__EdgeColourRGB) and files it in the 'Site Plan' tag folder. It NEVER renames or deletes an existing tag - a renamed SSOT tag simply adds a second SketchUp layer alongside the old one.

*Key symbols:* `NA__TAGS_MANAGER__CREATE_PREFIX_RANGES = [(1..1),(2..2),(7..9),(10..29),(60..61),(71..75),(90..93)]`, `Na__TagsManager__TagsIndexPath`, `Na__TagsManager__TagEligibleForCreation?`, `Na__TagsManager__BuildTagsFromDataLib`, `Na__TagsManager__LoadLocalTagsIndex`, `Na__TagsManager__LoadLocalDataLibFile`, `Na__TagsManager__LoadTagsIndex`, `Na__TagsManager__ApplyTagStyling`, `Na__TagsManager__FileTagInFolder`, `Na__TagsManager__CreateStandardisedTags`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__Main__.rb`

READER OF THE TAGS SSOT. Loads ExportExclusions (PatternExclusionRegex, FullyExcludedTagNames, TreatAsUntaggedTagNames, LineworkHiddenTagNames) and GlbBuilderConfig.Logging, and builds the Glb__ExportRangeNumbers / Storey maps. Also holds a HARDCODED site plan regex that duplicates SitePlanExportConfig.TagNamePatternRegex.

*Key symbols:* `SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/ (line ~117)`, `Na__ExportConfig__LoadFromDataLib (line ~174)`, `Na__ExportConfig__BuildHashesFromTagEntries (line ~283)`, `@na_datalib_exclusion_pattern`, `@na_datalib_fully_excluded`, `@na_datalib_treat_as_untagged`, `@na_datalib_linework_hidden`, `@na_datalib_tag_ranges`, `@na_datalib_storey_tag_map`, `@na_datalib_storey_element_map`, `INCHES_TO_METERS`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__CoreExport__.rb`

READER (indirect). Na__ExportCore__IdentifyExcludedLayers tests every model layer against exclusion_pattern, SITE_PLAN_TAG_PATTERN and fully_excluded_names (~line 483) - this is the belt-and-braces that keeps site plan tags out of the model GLBs even when the GitHub SSOT is older than the tag.

*Key symbols:* `Na__ExportCore__IdentifyExcludedLayers`, `Na__ExportCore__OrganizeEntitiesByTags`, `Na__ExportCore__PlanLinetypeLinework`, `Na__ExportCore__DetectStoreyContainers`, `Na__ExportCore__PerformExport`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__LinetypeLineworkExport__.rb`

READER OF THE TAGS SSOT. Sibling exporter for Glb__LineworkOnly tags. Worth copying from: it is the only exporter with a legacy-rename mechanism (Glb__LineworkLegacyTagNames) and it keys buckets by STEM not by tag name, so two SketchUp names can feed one file. The site plan renames coming in the build have no equivalent safety net.

*Key symbols:* `NA__LINETYPE__CONFIG_DEFAULTS`, `NA__LINETYPE__MAX_DEPTH = 64`, `Na__Linetype__LoadTagsData`, `Na__Linetype__Config`, `Na__Linetype__BuildDefinitions`, `Na__Linetype__Scan`, `Na__Linetype__CloseOpenContexts`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__UserInterface__.rb`

READER (indirect). Counts site plan tags in the model with SITE_PLAN_TAG_PATTERN (line ~510) to drive the 'Site Plan Tags' status figure and the can_export_site_plan gate. A new tag whose name does not match ^\d{2}__SitePlan__ will not be counted and the Export Site Plan Data card stays disabled.

*Key symbols:* `Na__UserInterface__BuildModelStatus`, `site_plan_tag_count`, `can_export_site_plan`, `Na__UserInterface__ActionExportSitePlan`, `Na__UserInterface__BuildManifestNotes`, `Na__UserInterface__EmptyModelStatus`, `Na__PublicApi__ExportSitePlanData`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiLayout__.html`

GLB Builder dialog markup. Carries the 'Site Plan Tags' status row (id naTvgbSitePlanCount, ~line 102) and the 'Export Site Plan Data' action card (id naTvgbExportSitePlanCard, ~line 191) whose description text hardcodes '71-75'. The new 'Export Polygon Faces' toggle would be added here.

*Key symbols:* `naTvgbSitePlanCount`, `naTvgbExportSitePlanCard`, `naTvgb__ActionCard__Label`, `naTvgb__ActionCard__Desc`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\05__Plugin__UserInterface\Na__TrueVision__GlbBuilder__UiBridge__.js`

Dialog JS bridge. na__tvgb__setText('naTvgbSitePlanCount', status.site_plan_tag_count) at ~line 308.

*Key symbols:* `na__tvgb__setText`, `status.site_plan_tag_count`, `status.can_export_site_plan`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__EngineCore__MaterialLookupSystem__.rb`

READER OF THE MATERIALS SSOT. Builds the MAT index and enriches glTF materials at export. Does NOT create materials in the model. Owns the alpha of every indexed MAT###__ material.

*Key symbols:* `EXEMPT_MATERIAL_REGEX = /^MAT000E__/`, `Na__MaterialLookup__FetchLibrary`, `Na__MaterialLookup__BuildIndex`, `Na__MaterialLookup__IsIndexedMaterial?`, `Na__MaterialLookup__IsExemptMaterial?`, `Na__MaterialLookup__InLibrary?`, `Na__MaterialLookup__GetConfig`, `Na__MaterialLookup__EnrichGltfMaterial`, `Na__MaterialLookup__ParseRgbString`, `Na__MaterialLookup__ClearCache`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Modules__\Na__TrueVision__GlbBuilder__EngineCore__MaterialHandling__.rb`

READER (via MaterialLookupSystem). Decides whose alpha wins: MAT000E__ exempt materials take the SketchUp Materials-tray Opacity slider; indexed MAT###__ materials take the SSOT Opacity and are deliberately excluded from tray passthrough.

*Key symbols:* `Na__MaterialEngine__ResolveSketchUpAlpha`, `is_indexed`, `is_exempt`, `alphaMode BLEND`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__EdgeUtil__PaintDeepNestedEdges__Modules__\Na__EdgeUtil__PaintDeepNestedEdges__ApplyLineThicknessTags__.rb`

READER OF THE TAGS SSOT. Builds the MTE-colour -> line-thickness-tag lookup from 03__LayoutDrawingLineworkTags__ (via Layout__EdgeColourID), and reads ExportExclusions.AdvancedSwapOffTagNames as the fast path for 'do not re-tag this edge'. Fallback path scans every entry for EdgePainting__AdvancedSwapOff == true.

*Key symbols:* `Na__LineTags__LoadLookup`, `Na__LineTags__Lookup`, `Na__LineTags__TagEntries`, `Na__LineTags__LoadProtectedTagNames`, `@na_colour_to_tag_lookup`, `@na_tag_entries`, `@na_protected_tag_names`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__EdgeUtil__PaintDeepNestedEdges__Modules__\Na__EdgeUtil__PaintDeepNestedEdges__RefreshPluginData__.rb`

READER. Force-reloads :edge_materials and :tags from the URL (na_force_reload_file_key(:tags), ~line 41) - the manual way to make an Edge Paint session see a changed SSOT.

*Key symbols:* `na_force_reload_file_key`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Noble3dModellingTools__Modules__\10__PluginModules\09__SourceCode__TagUtils\Na__Noble3dModellingTools__TagUtils__Run__.rb`

READER OF THE TAGS SSOT. A second, independent tag creator with its own menu entries, driven by HARDCODED SECTION-KEY LISTS. 71_75__SitePlanTags__ is in none of them, so site plan tags are only created here by 'Load All Tags'. It also reads alternate field names (Tag__LineStyle__Config, Tag__EdgeMaterial__Config, Layout__EdgeColourID) before falling back to the Layout__ ones.

*Key symbols:* `NA_TAGS_ROOT_KEY = 'Na__DataLib__CoreIndex__Tags'`, `NA_EDGE_MATERIALS_ROOT_KEY`, `NA_MODELING_HELPER_GROUP_KEYS = ['00__SystemAndUtilityTags__']`, `NA_LINE_THICKNESS_GROUP_KEYS = ['03__LayoutDrawingLineworkTags__']`, `NA_TRUEVISION_ALL_GROUP_KEYS = ['07__EnvironmentTags__','10_19__ExistingBuildingTags__','20_29__ProposedBuildingTags__','30_70__FurnitureAndContextTags__','90_93__StoreyContainerTags__']`, `NA_TRUEVISION_MINIMAL_TAG_NAMES`, `Na__TagUtils__LoadAllTags`, `Na__TagUtils__LoadStandardTags`, `Na__TagUtils__LoadModelingHelperTags`, `Na__TagUtils__LoadLineThicknessTags`, `Na__TagUtils__LoadTrueVisionMinimalTags`, `Na__TagUtils__LoadTrueVisionAllTags`, `na_load_tag_set`, `na_tag_entries_for_selection`, `na_create_or_update_tag`, `na_resolve_line_style_name`, `na_resolve_edge_colour_key`, `na_apply_tag_colour`, `na_write_tag_metadata`, `NA_ATTRIBUTE_DICTIONARY_NAME = 'Na__Noble3dModellingTools__TagUtils'`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Noble3dModellingTools__Modules__\10__PluginModules\08__SourceCode__MaterialUtils\Na__Noble3dModellingTools__MaterialUtils__Run__.rb`

READER OF THE MATERIALS SSOT AND THE MAIN MATERIAL CREATOR. This is the code that turns a new MAT entry into a real SketchUp material: adds by SketchUpName, sets colour from BaseColor, sets material.alpha from Opacity, applies texture maps and best-effort PBR setters, and writes an attribute dictionary of provenance onto the material. 'Load All Noble Architecture Materials' creates every series except MAT000__DefaultSeries__, so a new MAT800__SitePlanSeries__ is picked up with no code change - but only by that menu entry.

*Key symbols:* `NA_MATERIALS_ROOT_KEY = 'Na__DataLib__CoreIndex__Materials'`, `NA_DEFAULT_SERIES_KEY = 'MAT000__DefaultSeries__'`, `NA_DEFAULT_MATERIAL_KEY = 'MAT001__Default'`, `NA_DEFAULT_TEMPLATE_EXCLUDED_KEYS = ['SketchUpName','Description','IsDefault']`, `NA_MODELLING_UTILITY_SERIES_KEY = 'MAT010__ModelingUtilitySeries__'`, `NA_TRUEVISION_PALETTE_SERIES_KEY = 'MAT100__BasicSeries__'`, `NA_METADATA_ONLY_KEYS`, `NA_TEXTURE_MAP_SETTER_BY_KEY`, `Na__MaterialUtils__LoadModelingUtilityMaterials`, `Na__MaterialUtils__LoadTrueVisionMaterialsPalette`, `Na__MaterialUtils__LoadAllNobleArchitectureMaterials`, `na_load_material_set`, `na_resolve_series_selection`, `na_series_numeric_prefix`, `na_default_material_template`, `na_skip_reason_for_raw_material`, `na_create_or_update_material`, `na_apply_base_color`, `na_apply_opacity`, `na_apply_texture_maps`, `na_apply_best_effort_pbr_values`, `na_write_material_metadata`, `na_parse_rgb_string`, `NA_ATTRIBUTE_DICTIONARY_NAME = 'Na__Noble3dModellingTools__MaterialUtils'`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Noble3dModellingTools__Modules__\03__Plugin__CoreAppLogic\Na__Noble3dModellingTools__CoreAppLogic__StandardDataCache__.rb`

READER. Noble3dModellingTools' own wrapper over Na__DataLib__CacheData, preloading :tags among its keys.

*Key symbols:* `Na__StandardDataCache`, `Na__Noble3dModellingTools__LoadStandardData`, `Na__Noble3dModellingTools__LastSource`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ArchTools__ElementAssemblyStudioPro__Modules__\02__Src__AppModules\03__AppUtils\Na__AssemblyStudio__AppUtils__TagManager__.rb`

READER OF THE TAGS SSOT. Resolves three hardcoded roles to tag keys ('02__Linetype__DoorSwings', '25__ProposedBuilding__Doors', '25__ProposedBuilding__Windows') and reads their Layout__LineStyleName. Indifferent to site plan tags - a new one changes nothing here.

*Key symbols:* `na_resolve_from_datalib`, `na_load_tags_data`, `na_role_to_datalib_keys`, `na_find_tag_in_datalib`, `na_find_tag_node_in_datalib`, `na_resolve_line_style_from_datalib`, `NA_ROLE_FALLBACKS`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ArchTools__ElementAssemblyStudioPro__Modules__\02__Src__AppModules\02__AppData\Na__AssemblyStudio__AppData__MaterialManager__.rb`

READER OF THE MATERIALS SSOT + MATERIAL CREATOR (second one). Creates/updates SketchUp materials from BaseColor + Opacity only (no PBR). Hardcodes NA_SAFETY_GLASS_COLOR / NA_SAFETY_GLASS_ALPHA as a fallback for MAT101 - the Materials meta.divergenceNote says to keep those in sync.

*Key symbols:* `NA_MATERIALS_ROOT_KEY`, `na_load_materials_library`, `na_force_refresh_from_url`, `na_ensure_safety_materials`, `na_initialize_standard_materials`, `na_should_skip_material?`, `na_create_or_update_material`, `na_parse_rgb_string`, `na_get_material_by_id`, `na_get_material_by_sketchup_name`, `na_get_material_id_from_name`, `NA_SAFETY_GLASS_NAME`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__InsertPrimatives__Modules__\03__AppUtils\Na__InsertPrimatives__AppUtils__StandardMaterials__.rb`

READER OF THE MATERIALS SSOT + MATERIAL CREATOR (third one). Hunts an entry by its SketchUpName (recursively, because a key can appear more than once) rather than by its MAT key, then model.materials.add + BaseColor + Opacity. Carries a hardcoded inline recipe fallback for the transparent utility material.

*Key symbols:* `NA_STD_MAT_TRANSPARENT`, `Na__StdMaterial__LibraryPath`, `Na__StdMaterial__Library`, `Na__StdMaterial__FindRecipe`, `Na__StdMaterial__Recipe`, `Na__StdMaterial__ParseRgb`, `Na__StdMaterial__Resolve`, `Na__StdMaterial__ApplyToContainer`, `Na__StdMaterial__ApplyTransparent`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ProfileTools__ProfilePathTracer__Modules__\02__Src__AppModules\03__AppUtils\Na__ProfileTools__AppUtils__TagApplier__.rb`

READER OF THE TAGS SSOT. Generic recursive lookup of any tag entry by Tag__SketchUpName (Na__TagApplier__FindTagNodeRecursive), then applies layer attributes. Name-keyed, so a renamed tag silently stops resolving for anything that asks for the old name.

*Key symbols:* `Na__TagApplier__FindTagEntryByName`, `Na__TagApplier__FindTagNodeRecursive`, `NA_DATALIB_CACHE_KEY_TAGS = :tags`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ValeVisionCloudSync__Modules__\04__Plugin__SyncFeatures\02__CameraDataCapture\Na__ValeVisionCloudSync__TagVisibilityCapture__.rb`

READER OF THE TAGS SSOT. Flattens the whole index into a tag-name -> Glb__ExportFileNameStem map for ValeVision tag-visibility capture. Site plan entries are invisible to it ONLY because they deliberately carry no Glb__ExportFileNameStem - giving a new site plan tag one would wrongly register it as a 3D layer.

*Key symbols:* `na_tag_to_glb_stem_map`, `na_flatten_tags_index`, `na_category_key_from_stem`, `VALEVISION_KEY_PREFIX`, `TRUEVISION_STEM_PREFIX`, `@na_cached_stem_map`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ValeVisionCloudSync__Modules__\03__Plugin__CoreAppLogic\Na__ValeVisionCloudSync__CoreAppLogic__PathResolver__.rb`

READER (path only). Resolves the on-disk path of Na__DataLib__CoreIndex__Tags__.json for the tag-visibility capture (~line 103) - it reads the plugins-folder file directly, bypassing CacheData entirely.

*Key symbols:* `Na__ValeVisionCloudSync__TagsDataLibFilePath`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ValeTools__LanternImporter__Modules__\02__Src__AppModules\02__AppData\Na__ValeLantern__Importer__DataLibBridge__.rb`

READER (EdgeMaterials, and references the Tags SSOT in comments ~line 47). Creates the MTE300 construction-line edge materials and their 05__SetOut__* tags. Reminds that those tag names must also appear in ExportExclusions.AdvancedSwapOffTagNames.

*Key symbols:* `Na__ValeLantern__Importer__DataLibBridge`, `Na__DataLib__CoreIndex__ConstructionLinework`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__TrueVision__GlbBuilderUtility__Loader__.rb`

Loader. Preloads :tags and :materials at startup and prints the DataLib status report (Na__Cache__PrintStartupReport([:tags, :materials]), ~line 72-74).

*Key symbols:* `Na__Cache__LoadData(:tags)`, `Na__Cache__PrintStartupReport`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__EdgeUtil__PaintDeepNestedEdges__Loader__.rb`

Loader. Preloads :edge_materials and :tags (~line 66-67).

*Key symbols:* `Na__Cache__LoadData(:tags)`, `Na__Cache__PrintStartupReport([:edge_materials, :tags])`

#### `C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__ProfileTools__ProfilePathTracer__Loader__.rb`

Loader. Preloads :tags (~line 63).

*Key symbols:* `Na__Cache__LoadData(:tags)`

### Conventions observed

- JSON FILE MECHANICS: LF line endings only (verified 1167 LF, 0 CRLF in the Tags file), no BOM, UTF-8, file ends with a newline. Indentation is 4 spaces per level, spaces only.
- KEY/COLON ALIGNMENT: a key that OPENS a nested object is written flush - "71__SitePlan__BaseMap__OsMapping": { - with no padding before the colon. A LEAF key is right-padded with spaces so that every colon in that sibling block lands on the same column, then a single space, then the value. The column is set by the longest leaf key in the block: in the 71_75 site plan entries the longest is "EdgePainting__AdvancedSwapOff" (31 chars incl. quotes) at indent 16, so the colon sits at column 47 (0-based) with ZERO space after that key and every other key padded out to meet it. Adding a longer leaf key to a block means re-padding the WHOLE block.
- ALIGNMENT COLUMNS ACTUALLY IN USE (0-based colon column): Tags 71_75 tag entries (indent 16) = 47; Tags 71_75 section-level Tag__Description (indent 12) = 45; Tags ExportExclusions (indent 8) = 35; Tags SitePlanExportConfig and LinetypeExportConfig (indent 8) = 37; Tags meta (indent 8) = 25/28; EdgeMaterials MTE100/MTE200 entries (indent 16) = 33; EdgeMaterials MTE300 ConstructionLinework entries (indent 16) = 48; Materials MAT001__Default (indent 16) = 36; Materials MAT901 (indent 16) = 37; Materials MAT704 (indent 16) = 41. Alignment is per-block, NOT global - match the block you are editing.
- BLANK LINES: one blank line between top-level blocks and between sections inside Na__DataLib__CoreIndex__Tags; no blank line between sibling tag entries inside a section. There are NO comments anywhere (strict JSON); explanatory prose lives in *Note / *Description sibling string keys instead (e.g. FullyExcludedNote, AdvancedSwapOffNote, StyleUnitsNote, PatternExclusionNote, TagNumberRangeNote, skipRangesNote).
- ARRAYS: inline with a space after each comma - [500, 1250], [229, 57, 53], [71, 75]. Long string arrays (FullyExcludedTagNames etc.) are one element per line at the next indent level, with the closing ] back at the key's indent.
- NUMBERS: line weights are written with trailing zeros to two decimals where the value warrants it - 0.50, 0.35, 0.25, 0.18, 0.13. Opacities are two decimals - 0.45, 0.20, 0.35, 0.25. Draw orders are bare integers.
- NULLS: an absent value is explicit null, never omitted - SitePlan__FillColourId and SitePlan__FillOpacity are null on every non-fill layer, and Glb__ExportRangeNumbers is null on every site plan tag. Every site plan entry carries all 17 keys in the same order.
- FIELD ORDER inside a site plan tag entry is fixed: Tag__SketchUpName, Tag__Description, Glb__ExportRangeNumbers, Glb__FullyExcluded, EdgePainting__AdvancedSwapOff, [Layout__LineStyleName - only when non-solid], Layout__EdgeColourRGB, SitePlan__ExportFileNameStem, SitePlan__LayerLabel, SitePlan__LayerGroup, SitePlan__DrawOrder, SitePlan__ExportFills, SitePlan__LineColourId, SitePlan__LineType, SitePlan__LineWeightMm, SitePlan__FillColourId, SitePlan__FillOpacity, SitePlan__VisibleAtScales.
- TAG NAMING: {NN}__{Category}__{Subcategory}, double underscores between every part, two-digit zero-padded numeric prefix. Site plan tags share a number and differ by name (71 Base Map, 72 Boundary, 73 Buildings, 74 ExternalWorks, 75 SoftLandscape); the NAME picks the GLB, never the number. The JSON entry KEY and Tag__SketchUpName are identical strings in every site plan entry.
- EXPORT STEM NAMING: SitePlan__ExportFileNameStem is always TrueVision__SitePlan__{PascalCaseLabel} with no numeric prefix, and it is NOT mechanically derived from the tag name - e.g. 72__SitePlan__Boundary__RedLine -> TrueVision__SitePlan__RedLineBoundary, 73__SitePlan__Buildings__ToBeDemolished -> TrueVision__SitePlan__BuildingsToBeDemolished, 73__SitePlan__Buildings__ProposedSecondary -> TrueVision__SitePlan__ProposedBuildingsSecondary. The exported file is {prefix}{stem}__LineworkModel__.glb and {prefix}{stem}__FillModel__.glb.
- LABEL STYLE: SitePlan__LayerLabel is Title Case with lowercase conjunctions - "Walls and Fences", "Hedges and Planting", "Parking and Access", "Drainage and Services" - but "Buildings To Be Demolished", "Trees To Remove", "Setting Out Lines", "Root Protection Areas", "Proposed Buildings - Secondary" (space-hyphen-space for a qualifier).
- MTE NAMING: MTE{NNN}__{Category}__{Variant}, 3-digit zero-padded; series in hundreds (000 reserved/default, 100 greyscale, 200 accents, 300 construction lines). A greyscale entry appends the lightness, __L20 / __L40 / __L85. Fields on an MTE entry: SketchUpName, HexValue (uppercase hex with leading #), RgbValue [r,g,b], HsbValue [h,s,b], Description, SwatchName. The MTE300 series additionally carries SourceStyleKey, SourceApplication, Tag__SketchUpName, Layout__LineStyleName, Layout__EdgeColourRGB, LineStyle__PatternKey, EdgePainting__AdvancedSwapOff, Glb__FullyExcluded.
- MAT NAMING: MAT{NNN}__{Category}__{Variant}. SketchUpName must match the SketchUp material display_name EXACTLY and may legitimately differ from the JSON key (MAT101__GenericGlass -> "MAT101__Glass__ClearDefault"; MAT301__Paint__FarrowAndBall__Ammonite -> "MAT301__Paint__Farrow&Ball__Ammonite"). Colour is the string "rgb(R, G, B)"; Opacity is a 0.0-1.0 float.
- LINE TYPE VOCABULARY (shared by SitePlan__LineType and Glb__LineworkLineType, listed in LinetypeExportConfig.LineTypeAliases): solid, dashed, dashed-fine, centre, centre-fine, phantom, dotted. Currently used by site plan layers: solid, dashed, dashed-fine, centre-fine, dotted.
- SKETCHUP LINE STYLE NAMES (Layout__LineStyleName) are CASE SENSITIVE and must come from LineStyleReference.AvailableLineStyles: Solid Basic, Short dash, Dash, Dot, Dash dot, Dash double-dot, Dash triple-dot, Double-dash dot, Double-dash double-dot, Double-dash triple-dot, Long-dash dash, Long-dash double-dash. 'Dash Dot' is silently ignored and leaves the tag solid.
- VERSIONING: meta.version is semver as a string; meta.lastUpdated is DD-MMM-YYYY (e.g. "18-Sep-2026"). Every SSOT carries meta.GitHub__RepoUrl and meta.Data__URL pointing at the Adam-Noble-01/Plugins repo. The Tags meta.version is read by the site plan exporter and written into the manifest as SitePlanData__TagsSsotVersion, so bump it.
- RUBY HOUSE STYLE in the loaders: `# REGION | ...` / `# endregion ---` banners, `# FUNCTION | ...` and `# HELPER FUNCTION | ...` headers with dashed rules, module-level constants in SCREAMING_SNAKE with a trailing `.freeze`, public functions named Na__{Domain}__{PascalCase}, private helpers named na_snake_case, and `# <--` trailing comments.

### Extension points

**ITEM 1a - Full current contents of 71_75__SitePlanTags__, group 'Base Map' (three tags, all Glb__ExportRangeNumbers null, Glb__FullyExcluded true, EdgePainting__AdvancedSwapOff true, no Layout__LineStyleName, SitePlan__FillColourId null, SitePlan__FillOpacity null, SitePlan__ExportFills false)**

- *Where:* Na__DataLib__CoreIndex__Tags__.json -> Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__, pointer lines 586-644. Section-level Tag__Description (line ~587) reads: "Site plan drawing tags (71-75). Geometry on these tags is 2D site plan linework, with fills from closed faces on fill tags, exported ONLY by the GlbBuilder Site Plan Export - one GLB per tag NAME - into the project's 30__TrueVision__AppContent/SitePlan__DrawingData folder, for TrueVision3D Site Plan drawings at 1:500 and 1:1250. Similar layers share a number and differ by name (agreed 14-Sep-2026). Every tag is listed in ExportExclusions.FullyExcludedTagNames, so the model export never writes it, and in AdvancedSwapOffTagNames, so Edge Paint leaves its edges alone. Deliberately no Glb__ExportFileNameStem: the ValeVision Cloud Sync stem map must not treat these as 3D layers."
- *How:* (1) 71__SitePlan__BaseMap__OsMapping | Tag__Description "OS or map-provider mapping imported as DXF: roads and kerbs, plot boundaries, neighbouring buildings. Group the import and tag the group; the raw edges inside stay Untagged." | Layout__EdgeColourRGB [102, 102, 102] | Stem TrueVision__SitePlan__OsMapping | Label "OS Mapping" | Group "Base Map" | DrawOrder 20 | ExportFills false | LineColourId MTE103__LineColour__DarkGrey__L40 | LineType solid | LineWeightMm 0.13 | VisibleAtScales [500, 1250].  (2) 71__SitePlan__BaseMap__Amendments | Tag__Description "Linework added or corrected where the OS mapping is out of date - a neighbour's extension, a surveyed boundary. Drawn to match the OS mapping." | Layout__EdgeColourRGB [102, 102, 102] | Stem TrueVision__SitePlan__MapAmendments | Label "Map Amendments" | Group "Base Map" | DrawOrder 21 | ExportFills false | LineColourId MTE103__LineColour__DarkGrey__L40 | LineType solid | LineWeightMm 0.13 | VisibleAtScales [500, 1250].  (3) 71__SitePlan__BaseMap__Contours | Tag__Description "Contours and level breaks from a topographical survey. Off by default at both scales." | Layout__EdgeColourRGB [217, 217, 217] | Stem TrueVision__SitePlan__Contours | Label "Contours" | Group "Base Map" | DrawOrder 10 | ExportFills false | LineColourId MTE107__LineColour__LightGrey__L85 | LineType solid | LineWeightMm 0.13 | VisibleAtScales [] (empty array = off by default at every scale).
- *Risk:* The build's new OS mapping split (main roads / minor streets / minor feature) almost certainly RENAMES or replaces 71__SitePlan__BaseMap__OsMapping. Any existing model geometry already tagged with the old name is orphaned: the site plan exporter matches by exact SketchUp layer name and has no legacy-alias mechanism.

**ITEM 1b - Group 'Boundaries' (four tags, all Glb__ExportRangeNumbers null, Glb__FullyExcluded true, EdgePainting__AdvancedSwapOff true, ExportFills false, FillColourId null, FillOpacity null)**

- *Where:* Na__DataLib__CoreIndex__Tags__.json, pointer lines 645-721
- *How:* (4) 72__SitePlan__Boundary__RedLine | Tag__Description "The application site boundary (the red line). A closed loop of edges at ground level." | Layout__EdgeColourRGB [229, 57, 53] | Stem TrueVision__SitePlan__RedLineBoundary | Label "Red Line Boundary" | Group "Boundaries" | DrawOrder 90 | LineColourId MTE201__LineColour__Red | LineType solid | LineWeightMm 0.50 | VisibleAtScales [500, 1250].  (5) 72__SitePlan__Boundary__BlueLine | Tag__Description "Other land owned by the applicant (the blue line). A closed loop of edges at ground level." | Layout__EdgeColourRGB [30, 136, 229] | Stem TrueVision__SitePlan__BlueLineBoundary | Label "Blue Line Boundary" | Group "Boundaries" | DrawOrder 89 | LineColourId MTE205__LineColour__Blue | LineType solid | LineWeightMm 0.50 | VisibleAtScales [500, 1250].  (6) 72__SitePlan__Boundary__WallsAndFences | Tag__Description "Boundary treatments the drawing needs beyond the OS lines: walls, fences, gates and piers." | Layout__EdgeColourRGB [51, 51, 51] | Stem TrueVision__SitePlan__WallsAndFences | Label "Walls and Fences" | Group "Boundaries" | DrawOrder 45 | LineColourId MTE102__LineColour__SoftBlack__L20 | LineType solid | LineWeightMm 0.25 | VisibleAtScales [500].  (7) 72__SitePlan__Boundary__SettingOutLines | Tag__Description "Setting-out and test lines: distances to boundaries, building lines, 45 and 25 degree lines. Off by default at both scales." | Layout__LineStyleName "Dash dot" | Layout__EdgeColourRGB [229, 57, 53] | Stem TrueVision__SitePlan__SettingOutLines | Label "Setting Out Lines" | Group "Boundaries" | DrawOrder 95 | LineColourId MTE201__LineColour__Red | LineType centre-fine | LineWeightMm 0.13 | VisibleAtScales [].
- *Risk:* DrawOrder 89/90/95 are the top of the current stack. A 1..10 z-index hierarchy will have to coexist with, or replace, these 10..95 values - every consumer (manifest Layer__DrawOrder, the record sort in Na__SitePlan__Write) reads the raw integer.

**ITEM 1c - Group 'Buildings' (four tags, all Glb__ExportRangeNumbers null, Glb__FullyExcluded true, EdgePainting__AdvancedSwapOff true)**

- *Where:* Na__DataLib__CoreIndex__Tags__.json, pointer lines 722-798
- *How:* (8) 73__SitePlan__Buildings__Existing | Tag__Description "Existing buildings on the site that stay. Closed faces export as fills, which draw only once a style gives them a colour." | Layout__EdgeColourRGB [51, 51, 51] | Stem TrueVision__SitePlan__ExistingBuildings | Label "Existing Buildings" | Group "Buildings" | DrawOrder 40 | ExportFills TRUE | LineColourId MTE102__LineColour__SoftBlack__L20 | LineType solid | LineWeightMm 0.25 | FillColourId null | FillOpacity null | VisibleAtScales [500, 1250].  (9) 73__SitePlan__Buildings__ToBeDemolished | Tag__Description "Existing structures to be removed." | Layout__LineStyleName "Dash" | Layout__EdgeColourRGB [51, 51, 51] | Stem TrueVision__SitePlan__BuildingsToBeDemolished | Label "Buildings To Be Demolished" | Group "Buildings" | DrawOrder 41 | ExportFills false | LineColourId MTE102__LineColour__SoftBlack__L20 | LineType dashed | LineWeightMm 0.25 | FillColourId null | FillOpacity null | VisibleAtScales [500].  (10) 73__SitePlan__Buildings__Proposed | Tag__Description "Proposed buildings and extensions as a roof outline. Draw closed FACES at ground level: the face is the fill, its edges the outline." | Layout__EdgeColourRGB [229, 57, 53] | Stem TrueVision__SitePlan__ProposedBuildings | Label "Proposed Buildings" | Group "Buildings" | DrawOrder 71 | ExportFills TRUE | LineColourId MTE201__LineColour__Red | LineType solid | LineWeightMm 0.35 | FillColourId MTE201__LineColour__Red | FillOpacity 0.45 | VisibleAtScales [500, 1250].  (11) 73__SitePlan__Buildings__ProposedSecondary | Tag__Description "A second part of the proposal shown lighter, such as a single-storey element beside a two-storey one. Closed faces at ground level." | Layout__EdgeColourRGB [229, 57, 53] | Stem TrueVision__SitePlan__ProposedBuildingsSecondary | Label "Proposed Buildings - Secondary" | Group "Buildings" | DrawOrder 70 | ExportFills TRUE | LineColourId MTE201__LineColour__Red | LineType solid | LineWeightMm 0.25 | FillColourId MTE201__LineColour__Red | FillOpacity 0.20 | VisibleAtScales [500, 1250].
- *Risk:* Only two layers in the whole SSOT currently set a FillColourId/FillOpacity, and both point at an MTE (edge) colour. The new neighbouring-buildings tag and the new face materials will need a decision: keep MTE ids (works today, no code change) or move to MAT ids (needs Na__SitePlan__BuildLayerDefinitions + a new Materials hex index).

**ITEM 1d - Group 'External Works' (three tags) and group 'Soft Landscape' (four tags), all Glb__ExportRangeNumbers null, Glb__FullyExcluded true, EdgePainting__AdvancedSwapOff true**

- *Where:* Na__DataLib__CoreIndex__Tags__.json, pointer lines 799-935 (section closes at line 936)
- *How:* (12) 74__SitePlan__ExternalWorks__HardSurfaces | Tag__Description "Driveways, parking areas, paths, patios, terraces and tracks. Closed faces export as fills, which draw only once a style gives them a colour." | Layout__EdgeColourRGB [102, 102, 102] | Stem TrueVision__SitePlan__HardSurfaces | Label "Hard Surfaces" | Group "External Works" | DrawOrder 30 | ExportFills TRUE | LineColourId MTE103__LineColour__DarkGrey__L40 | LineType solid | LineWeightMm 0.13 | FillColourId null | FillOpacity null | VisibleAtScales [500].  (13) 74__SitePlan__ExternalWorks__ParkingAndAccess | Tag__Description "Parking bays, turning heads, visibility splays and access widths." | Layout__LineStyleName "Short dash" | Layout__EdgeColourRGB [102, 102, 102] | Stem TrueVision__SitePlan__ParkingAndAccess | Label "Parking and Access" | Group "External Works" | DrawOrder 50 | ExportFills false | LineColourId MTE103__LineColour__DarkGrey__L40 | LineType dashed-fine | LineWeightMm 0.18 | FillColourId null | FillOpacity null | VisibleAtScales [500].  (14) 74__SitePlan__ExternalWorks__DrainageAndServices | Tag__Description "Soakaways, drainage runs, manholes, trial pits and service routes. Off by default at both scales." | Layout__LineStyleName "Dot" | Layout__EdgeColourRGB [30, 136, 229] | Stem TrueVision__SitePlan__DrainageAndServices | Label "Drainage and Services" | Group "External Works" | DrawOrder 60 | ExportFills false | LineColourId MTE205__LineColour__Blue | LineType dotted | LineWeightMm 0.18 | FillColourId null | FillOpacity null | VisibleAtScales [].  (15) 75__SitePlan__SoftLandscape__Trees | Tag__Description "Tree canopies as closed faces, each with a small stem mark." | Layout__EdgeColourRGB [67, 160, 71] | Stem TrueVision__SitePlan__Trees | Label "Trees" | Group "Soft Landscape" | DrawOrder 56 | ExportFills TRUE | LineColourId MTE202__LineColour__Green | LineType solid | LineWeightMm 0.18 | FillColourId MTE202__LineColour__Green | FillOpacity 0.35 | VisibleAtScales [500].  (16) 75__SitePlan__SoftLandscape__HedgesAndPlanting | Tag__Description "Hedges and planting beds as closed faces." | Layout__EdgeColourRGB [67, 160, 71] | Stem TrueVision__SitePlan__HedgesAndPlanting | Label "Hedges and Planting" | Group "Soft Landscape" | DrawOrder 55 | ExportFills TRUE | LineColourId MTE202__LineColour__Green | LineType solid | LineWeightMm 0.18 | FillColourId MTE202__LineColour__Green | FillOpacity 0.25 | VisibleAtScales [500].  (17) 75__SitePlan__SoftLandscape__TreesToRemove | Tag__Description "Trees and hedges to be removed." | Layout__LineStyleName "Dash" | Layout__EdgeColourRGB [229, 57, 53] | Stem TrueVision__SitePlan__TreesToRemove | Label "Trees To Remove" | Group "Soft Landscape" | DrawOrder 57 | ExportFills false | LineColourId MTE201__LineColour__Red | LineType dashed | LineWeightMm 0.18 | FillColourId null | FillOpacity null | VisibleAtScales [500].  (18) 75__SitePlan__SoftLandscape__RootProtectionAreas | Tag__Description "BS 5837 root protection areas and protective fencing." | Layout__LineStyleName "Dash" | Layout__EdgeColourRGB [67, 160, 71] | Stem TrueVision__SitePlan__RootProtectionAreas | Label "Root Protection Areas" | Group "Soft Landscape" | DrawOrder 58 | ExportFills false | LineColourId MTE202__LineColour__Green | LineType dashed | LineWeightMm 0.18 | FillColourId null | FillOpacity null | VisibleAtScales [500].
- *Risk:* 75__SitePlan__SoftLandscape__Trees and __HedgesAndPlanting are the obvious rename candidates for 'mixed woodland trees' and 'hedges and planting'. Both already carry fills, so a rename changes the exported FILE NAME too (stem) and every previously published GLB in a project's SitePlan__DrawingData folder becomes stale - Na__SitePlan__Write offers to delete files matching NA__SITEPLAN__OLD_FILE_PATTERN that this run did not write, which will sweep them up on the next export.

**ITEM 2 - The SitePlanExportConfig top-level block, verbatim**

- *Where:* Na__DataLib__CoreIndex__Tags__.json, pointer lines 1094-1107, indent 4, leaf colon column 37
- *How:* "SitePlanExportConfig": {\n  "Description" : "Runtime config for the GlbBuilder Site Plan Export and for the readers of its output (the ProjectVision build script, TrueVision3D site plan drawings). Site plan layers are the Na__DataLib__CoreIndex__Tags entries that carry SitePlan__ExportFileNameStem.",\n  "TagNumberRange" : [71, 75],\n  "TagNumberRangeNote" : "71-75 hold the site plan tags. Similar layers share a number and differ by name: the NAME picks the GLB, never the number (unlike 10-29).",\n  "TagNamePatternRegex" : "^\\\\d{2}__SitePlan__",\n  "ExportFolderName" : "SitePlan__DrawingData",\n  "ManifestFileName" : "TrueVision__SitePlanData__Manifest__.json",\n  "LineworkFileSuffix" : "__LineworkModel__",\n  "FillFileSuffix" : "__FillModel__",\n  "ExportIgnoresTagVisibility" : true,\n  "SupportedScaleDenominators" : [500, 1250],\n  "SketchUpTagFolderName" : "Site Plan",\n  "StyleUnitsNote" : "SitePlan__LineWeightMm is paper millimetres. SitePlan__LineType takes the TrueVision EdgeStyles aliases: solid, dashed, dashed-fine, centre, centre-fine, phantom, dotted. Colour ids are Na__DataLib__CoreIndex__EdgeMaterials keys. SitePlan__VisibleAtScales lists the scale denominators a layer is switched on at when a site plan viewport is created."\n}  -- NOTE: in the file the regex is the 20-character JSON string ^\\d{2}__SitePlan__ (a single backslash escaped once for JSON).
- *Risk:* Only FIVE of these keys are actually honoured by the exporter: NA__SITEPLAN__CONFIG_DEFAULTS in Na__TrueVision__GlbBuilder__SitePlanExport__.rb lists ExportFolderName, ManifestFileName, LineworkFileSuffix, FillFileSuffix, ExportIgnoresTagVisibility, and Na__SitePlan__Config copies ONLY keys already present in that defaults hash. TagNumberRange, TagNamePatternRegex and SupportedScaleDenominators are documentation - nothing in the Plugins folder reads them. SketchUpTagFolderName IS read, but by TagsManager (Na__TagsManager__BuildTagsFromDataLib), not by the exporter. So a new config key (e.g. an 'ExportPolygonFaces' default) MUST be added to NA__SITEPLAN__CONFIG_DEFAULTS or it is silently ignored.

**ITEM 4 - ExportExclusions, and which site plan names appear in each list**

- *Where:* Na__DataLib__CoreIndex__Tags__.json, pointer lines 975-1092
- *How:* PatternExclusionRegex = "^TrueVision_.*_DoNotExportGLTF$" - matches NO site plan name. FullyExcludedTagNames (34 entries) - contains ALL 18 site plan tag names, listed last, in the order OsMapping, Amendments, Contours, RedLine, BlueLine, WallsAndFences, SettingOutLines, Existing, ToBeDemolished, Proposed, ProposedSecondary, HardSurfaces, ParkingAndAccess, DrainageAndServices, Trees, HedgesAndPlanting, TreesToRemove, RootProtectionAreas (pointer lines 996-1013). AdvancedSwapOffTagNames (52 entries) - contains ALL 18 site plan tag names, again listed last in the same order (pointer lines 1060-1077). LineworkHiddenTagNames (6 entries: the three ModelFlag indicator-line pairs plus 61__Scene__Entourage__Silhouette) - contains NO site plan name. TreatAsUntaggedTagNames (9 entries, all 03__LineThickness__*) - contains NO site plan name. FullyExcludedNote explains the site plan entries are listed "so the model export never writes them; the Site Plan Export reads them through SitePlanExportConfig".
- *Risk:* Each of the seven new tags must be added to BOTH FullyExcludedTagNames AND AdvancedSwapOffTagNames, and each of the three renames must be changed in BOTH. Miss FullyExcludedTagNames and the tag's 2D linework leaks into the 3D model GLBs (though SITE_PLAN_TAG_PATTERN in CoreExport is a second net that catches anything named ^\d{2}__SitePlan__). Miss AdvancedSwapOffTagNames and Edge Paint's Apply Line Thickness Tags will move the edges to Untagged, stripping the site plan tag off the geometry - the fallback per-tag EdgePainting__AdvancedSwapOff scan only runs when the curated array is EMPTY, so a partially-updated array does NOT fall back.

**ITEM 5 - EdgeMaterials: the full MTE id list with hex/RGB and SketchUp names, plus the entry convention**

- *Where:* Na__DataLib__CoreIndex__EdgeMaterials__.json -> Na__DataLib__CoreIndex__EdgeMaterials (pointer lines 57-195) and Na__DataLib__CoreIndex__ConstructionLinework -> MTE300__ConstructionLineSeries__ (pointer lines 215-442)
- *How:* MTE000__DefaultSeries__: key 'Default' | SketchUpName "Default" | HexValue null | no RgbValue | IsDefault true | IsReserved true | Description "Reserved key - resets edge to SketchUp default colour. No material is created in the model.". MTE100__GreyscaleSeries__ (all SketchUpName == key unless noted): MTE101__LineColour__AbsoluteBlack #000000 [0,0,0] HSB[0,0,0] swatch "Absolute Black"; MTE102__LineColour__SoftBlack__L20 #333333 [51,51,51] HSB[0,0,20] "Soft Black"; MTE103__LineColour__DarkGrey__L40 #666666 [102,102,102] HSB[0,0,40] "Dark Grey"; MTE103__LineColour__MediumDarkGrey__L50 #737373 [115,115,115] HSB[0,0,45] "Medium Dark Grey" -- NOTE its SketchUpName is "MTE103__LineColour__MediumDarkGrey__L45", which does NOT match the key (L50 vs L45); MTE104__LineColour__MidGrey__L60 #999999 [153,153,153] HSB[0,0,60] "Mid Grey"; MTE105__LineColour__LightMidGrey__L70 #B4B4B4 [180,180,180] HSB[0,0,71] "Light Mid Grey"; MTE106__LineColour__NearWhiteGrey__L80 #CCCCCC [204,204,204] HSB[0,0,80] "Near White Grey"; MTE107__LineColour__LightGrey__L85 #D9D9D9 [217,217,217] HSB[0,0,85] "Light Grey"; MTE108__LineColour__VeryLightGrey__L95 #F2F2F2 [242,242,242] HSB[0,0,95] "Very Light Grey"; MTE109__LineColour__White #FFFFFF [255,255,255] HSB[0,0,100] "White". MTE200__AccentColourSeries__: MTE201__LineColour__Red #E53935 [229,57,53] HSB[2,77,90] "Red" (CONFIRMED, Material Design Red 600); MTE202__LineColour__Green #43A047 [67,160,71] HSB[123,58,63] "Green" (CONFIRMED, MD Green 600); MTE203__LineColour__Yellow #FDD835 [253,216,53] HSB[51,79,99] "Yellow"; MTE204__LineColour__Purple #8E24AA [142,36,170] HSB[288,79,67] "Purple"; MTE205__LineColour__Blue #1E88E5 [30,136,229] HSB[208,87,90] "Blue" (CONFIRMED, MD Blue 600, Description names it as the site plan blue line and drainage colour). MTE300__ConstructionLineSeries__ (separate root, 14 entries, NOT read by the site plan exporter): MTE301 DatumUpstand #1F7FA8 [31,127,168]; MTE302 DatumHeadBeam #D4762A [212,118,42]; MTE303 DatumEaves #B0349B [176,52,155]; MTE304 DatumRidge #CC3333 [204,51,51]; MTE305 DatumRoofDeck #6B7480 [107,116,128]; MTE306 DatumGlazingPlane #3FA9C9 [63,169,201]; MTE311 TriangleRoof #E0B400 [224,180,0]; MTE312 TriangleHipEnd #E0B400 [224,180,0]; MTE313 TriangleHip #2E9E4F [46,158,79]; MTE321 CentrelineRidge #7B3FB0 [123,63,176]; MTE322 CentrelineHip #7B3FB0 [123,63,176]; MTE323 CentrelineEaves #9B6FC4 [155,111,196]; MTE324 CentrelineGlazeBar #8E44C8 [142,68,200]; MTE325 CentrelineTransom #A06BD4 [160,107,212]. CONVENTION for a standard MTE entry: key == SketchUpName == "MTE{NNN}__{Category}__{Variant}", and the six fields are SketchUpName, HexValue (uppercase, leading #), RgbValue [r,g,b], HsbValue [h,s,b], Description (plain sentence, en-dash written as a hyphen), SwatchName (short Title Case UI label). Series blocks are named "MTE{NNN}00__{Name}Series__" style, i.e. MTE000__DefaultSeries__, MTE100__GreyscaleSeries__, MTE200__AccentColourSeries__, MTE300__ConstructionLineSeries__.
- *Risk:* Na__SitePlan__EdgeHexIndex only walks data['Na__DataLib__CoreIndex__EdgeMaterials'] - a new colour added under Na__DataLib__CoreIndex__ConstructionLinework would parse fine but resolve to a nil LineHex in the manifest with no warning. The MTE103 MediumDarkGrey key/SketchUpName mismatch (L50 vs L45) is a live inconsistency: the hex index is keyed by the JSON KEY, but any SketchUp material lookup would use SketchUpName. meta.uiDefaults.AssemblyStudioEdgeColourSwatchKeys / SwatchLabels are hand-maintained lists that do NOT auto-pick-up new colours.

**ITEM 6 - The Materials SSOT structure: how a SketchUp FACE material is defined, and exactly what a new site plan face material needs**

- *Where:* Na__DataLib__CoreIndex__Materials__.json. meta at lines 2-97; MAT001__Default (the full reference template) at pointer lines 102-129; example fill-type entries MAT012__DiscussionMarker__Red (~150), MAT901__Entourage__Silhouette__MidGrey (~371), MAT105__GenericGlass__WhitecardTranslucent (~209).
- *How:* STRUCTURE: two top-level keys, meta and Na__DataLib__CoreIndex__Materials. Under the root are eight SERIES blocks, each a plain object of entries: MAT000__DefaultSeries__, MAT010__ModelingUtilitySeries__, MAT100__BasicSeries__, MAT300__PaintSeries__, MAT500__TimberSeries__, MAT700__GlassSeries__, MAT600__MetalSeries__, MAT900__SceneEntourageSeries__ (700 precedes 600 in the file - do not 'fix' it blindly). KEY NAMING: MAT{NNN}__{Category}__{Variant}; meta.indexPattern ^MAT\d{3}__; meta.exemptPrefix MAT000E__. A NEW ENTRY NEEDS, at minimum, SketchUpName (must equal the SketchUp material display_name exactly; may differ from the JSON key) and whatever differs from MAT001__Default. MAT001__Default lists every possible key with its default: SketchUpName "__SKETCHUP_DEFAULT__", Description, IsDefault true, BaseColor "rgb(255, 255, 255)", Opacity 1.0, Transparent false, IsDoubleSided false, PbrRoughness 1.0, PbrMetallic 0.0, EmissiveFactor "rgb(0, 0, 0)", EmissiveIntensity 0.0, NormalScale 1.0, OcclusionStrength 1.0, AlphaTest 0.0, DepthWrite true, EnvMapIntensity 0.0, AoExclude false, and a TextureMaps object with BaseColorUrl, NormalUrl, RoughnessUrl, MetallicUrl, EmissiveUrl, OcclusionUrl, AlphaUrl all null. Two further fields appear on real entries but not in the template: ProfileLineExclude (bool) and IsExempt (bool). COLOUR is the string "rgb(R, G, B)" - never hex, never an array. ALPHA is Opacity as a 0.0-1.0 float; Transparent is metadata only. TEXTURES are URLs/paths in TextureMaps; meta.Na__DataLib__SketchUpApiMapping maps each field to its Sketchup::Material setter (color=, alpha=, roughness_factor=, metallic_factor=, normal_scale=, ao_strength=, texture=, normal_texture=, roughness_texture=, metallic_texture=, ao_texture=) and marks EmissiveUrl/AlphaUrl/Transparent/IsDoubleSided/DepthWrite/AlphaTest/EnvMapIntensity/EmissiveFactor/EmissiveIntensity as metadata-only. CODE THAT CREATES MATERIALS IN THE MODEL FROM THIS FILE - three creators and one read-only consumer: (a) Na__Noble3dModellingTools__MaterialUtils__Run__.rb - the full creator: na_create_or_update_material does materials[SketchUpName] || materials.add(SketchUpName), na_apply_base_color (parses "rgb(...)" -> Sketchup::Color), na_apply_opacity (material.alpha = clamp(Opacity,0,1)), na_apply_texture_maps, na_apply_best_effort_pbr_values, then na_write_material_metadata into the attribute dictionary 'Na__Noble3dModellingTools__MaterialUtils'. Its menu entries are Load Modelling Utility Materials (MAT010 only), Load TrueVision Materials Palette (MAT100 only), and Load All Noble Architecture Materials (:all_non_default = every series except MAT000__DefaultSeries__). (b) Na__AssemblyStudio__AppData__MaterialManager__.rb - na_initialize_standard_materials / na_create_or_update_material: BaseColor + Opacity only. (c) Na__InsertPrimatives__AppUtils__StandardMaterials__.rb - Na__StdMaterial__Resolve: finds a recipe by SketchUpName with a recursive walk, model.materials.add, BaseColor + Opacity. (d) Na__TrueVision__GlbBuilder__EngineCore__MaterialLookupSystem__.rb - read-only at export: Na__MaterialLookup__EnrichGltfMaterial writes metallicFactor, roughnessFactor, baseColorFactor (with Opacity as alpha and alphaMode BLEND when Opacity < 1.0), doubleSided and emissiveFactor into the glTF material.
- *Risk:* THE OPAQUE-IN-SKETCHUP / ALPHA-ONLY-IN-TRUEVISION REQUIREMENT HAS NO FIELD TODAY. There is exactly one Opacity, and na_apply_opacity writes it straight to material.alpha, so an SSOT entry with Opacity 0.35 produces a 35%-transparent SketchUp material too. The only existing escape hatch is the MAT000E__ exempt prefix, which does the OPPOSITE (SketchUp tray opacity wins, SSOT is only a build recipe). The build will need either a new field (e.g. SketchUp__Opacity vs Opacity) honoured in na_apply_opacity, or a convention that site plan face materials are created opaque and the alpha lives only in SitePlan__FillOpacity in the Tags SSOT. Also note nothing in the site plan export path reads the Materials SSOT at all today - the fill GLB has no materials, so a new MAT entry is currently only an authoring aid inside SketchUp unless Na__SitePlan__BuildLayerDefinitions is extended.

**ITEM 7 - Complete list of Tags SSOT readers under the Plugins folder, and what each does with a new or renamed tag**

- *Where:* Grep hits for 'Na__DataLib__', 'CoreIndex__Tags', ':tags', 'ExportExclusions', 'SitePlanExportConfig' across C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins (excluding the four 90__AppCache__TempFilesCache copies, which are stale snapshots, not code)
- *How:* (1) Na__TrueVision__GlbBuilder__TagsManager__.rb - CREATES the SketchUp layer. Na__TagsManager__BuildTagsFromDataLib walks every section, keeps any entry whose Tag__SketchUpName matches NA__TAGS_MANAGER__CREATE_PREFIX_RANGES ((1..1),(2..2),(7..9),(10..29),(60..61),(71..75),(90..93)), and lets a Glb__FullyExcluded entry through when is_site_plan (SitePlan__ExportFileNameStem is a String). Applies Layout__LineStyleName and Layout__EdgeColourRGB, files it in SitePlanExportConfig.SketchUpTagFolderName. NEW TAG: created automatically. RENAMED TAG: a second layer is added; the old one is left in the model untouched. (2) Na__TrueVision__GlbBuilder__SitePlanExport__.rb - EXPORTS it. Na__SitePlan__BuildLayerDefinitions keys layer definitions by Tag__SketchUpName and reads all twelve SitePlan__ fields plus the two colour ids resolved against EdgeMaterials. NEW TAG: exported as soon as it has a stem. RENAMED TAG: geometry still on the old SketchUp layer name is not collected, and the old stem's GLB becomes a 'stale' file the exporter offers to delete. (3) Na__TrueVision__GlbBuilder__Main__.rb - Na__ExportConfig__LoadFromDataLib caches the four ExportExclusions arrays + the pattern; Na__ExportConfig__BuildHashesFromTagEntries builds Glb__ExportFileNameStem -> Glb__ExportRangeNumbers and the storey maps (site plan entries contribute nothing, having no stem and null ranges). Also owns SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/. (4) Na__TrueVision__GlbBuilder__CoreExport__.rb - Na__ExportCore__IdentifyExcludedLayers ORs exclusion_pattern, SITE_PLAN_TAG_PATTERN and fully_excluded_names, so any correctly-named new tag is kept out of the model GLBs even before the SSOT reaches GitHub. (5) Na__TrueVision__GlbBuilder__UserInterface__.rb - counts model layers against SITE_PLAN_TAG_PATTERN for the status panel and the can_export_site_plan gate. (6) Na__TrueVision__GlbBuilder__LinetypeLineworkExport__.rb - only cares about Glb__LineworkOnly entries; ignores site plan tags, but reads ExportExclusions.FullyExcludedTagNames for its own walk. (7) Na__EdgeUtil__PaintDeepNestedEdges__ApplyLineThicknessTags__.rb - Na__LineTags__LoadLookup reads ONLY the 03__LayoutDrawingLineworkTags__ section (colour -> tag), and Na__LineTags__LoadProtectedTagNames reads ExportExclusions.AdvancedSwapOffTagNames. A new site plan tag absent from that array WILL have its edges re-tagged away by Advanced mode. (8) Na__EdgeUtil__PaintDeepNestedEdges__RefreshPluginData__.rb - force-reloads :tags from the URL. (9) Na__Noble3dModellingTools__TagUtils__Run__.rb - a second tag creator driven by hardcoded section-key arrays; 71_75__SitePlanTags__ is in NONE of them, so site plan tags only appear via 'Load All Tags'. It reads Tag__LineStyle__Config / Tag__EdgeMaterial__Config first, then Layout__LineStyleName / Layout__EdgeColourID, then Layout__EdgeColourRGB, and writes provenance into the 'Na__Noble3dModellingTools__TagUtils' attribute dictionary. (10) Na__Noble3dModellingTools__CoreAppLogic__StandardDataCache__.rb - preloads :tags. (11) Na__ProfileTools__AppUtils__TagApplier__.rb - Na__TagApplier__FindTagEntryByName does a generic recursive lookup by Tag__SketchUpName; harmless for site plan tags but breaks for any caller naming a renamed tag. (12) Na__ProfileTools__AppCore__DependencyBootstrap__.rb - declares NA_DATALIB_CACHE_KEY_TAGS = :tags. (13) Na__ProfileTools__ProfilePathTracer__Loader__.rb, Na__EdgeUtil__PaintDeepNestedEdges__Loader__.rb, Na__TrueVision__GlbBuilderUtility__Loader__.rb - preload :tags at startup. (14) Na__AssemblyStudio__AppUtils__TagManager__.rb - resolves only three hardcoded tag keys ('02__Linetype__DoorSwings', '25__ProposedBuilding__Doors', '25__ProposedBuilding__Windows') and their Layout__LineStyleName; site-plan-indifferent. (15) Na__ValeVisionCloudSync__TagVisibilityCapture__.rb - na_flatten_tags_index builds tag-name -> Glb__ExportFileNameStem for the ValeVision layer toggles; a site plan tag is excluded ONLY because it has no Glb__ExportFileNameStem. (16) Na__ValeVisionCloudSync__CoreAppLogic__PathResolver__.rb - Na__ValeVisionCloudSync__TagsDataLibFilePath resolves the plugins-folder Tags JSON path directly, bypassing CacheData. (17) Na__ValeLantern__Importer__DataLibBridge__.rb - EdgeMaterials/ConstructionLinework consumer; documents the requirement that its 05__SetOut__* tag names also appear in AdvancedSwapOffTagNames. (18) Na__TrueVision__GlbBuilder__UiLayout__.html / UiBridge__.js - display-only site plan tag count and the Export Site Plan Data card.
- *Risk:* Three of these readers hold HARDCODED lists that will not see new data: NA__TAGS_MANAGER__CREATE_PREFIX_RANGES (numeric ranges - fine for 71-75, but a new range, say 76, would silently never be created), NA_TRUEVISION_ALL_GROUP_KEYS in Noble3d TagUtils (section keys - omits 71_75__SitePlanTags__ entirely), and NA__SITEPLAN__CONFIG_DEFAULTS (config keys - any new SitePlanExportConfig key is dropped).

**Where a per-layer Z-INDEX / height hierarchy (1..10) would attach**

- *Where:* Tags SSOT: a new SitePlan__ field alongside SitePlan__DrawOrder in each 71_75 entry. Exporter: Na__SitePlan__BuildLayerDefinitions (layers[name][:draw_order]) and the manifest record key 'Layer__DrawOrder' plus the sort in Na__SitePlan__Write (records.sort_by! { |r| [r['Layer__DrawOrder'] || 0, r['Layer__TagName']] }).
- *How:* Either overload SitePlan__DrawOrder onto a 1..10 scale (breaks every already-published manifest and every consumer that assumes the 10..95 spread) or add a second field, e.g. SitePlan__ZIndex, carried into the manifest as a new Layer__ key. Adding a field means: add it to all 18+7 entries, re-pad the whole 71_75 block if the new key is longer than 29 chars ("EdgePainting__AdvancedSwapOff"), thread it through Na__SitePlan__BuildLayerDefinitions into the definition hash, and emit it in the records hash in Na__SitePlan__Write. Also add a describing line to meta.fieldPrefixes["SitePlan__"] and to SitePlanExportConfig.StyleUnitsNote, both of which currently enumerate the SitePlan__ fields in prose.
- *Risk:* Manifest schema change - NA__SITEPLAN__SCHEMA_VERSION is currently 1 and is written as SitePlanData__SchemaVersion; downstream readers (ProjectVision build script, TrueVision site plan drawings) key off it.

**Where an 'Export Polygon Faces' toggle would attach**

- *Where:* Na__TrueVision__GlbBuilder__SitePlanExport__.rb (NA__SITEPLAN__CONFIG_DEFAULTS, Na__SitePlan__Config, Na__SitePlan__AddFace, Na__SitePlan__WriteFill, Na__SitePlan__Write), Na__TrueVision__GlbBuilder__UiLayout__.html (a new control near naTvgbExportSitePlanCard), Na__TrueVision__GlbBuilder__UiBridge__.js, Na__TrueVision__GlbBuilder__UserInterface__.rb (action dispatch, ~line 219 'export_site_plan').
- *How:* Today Na__SitePlan__AddFace records only the RINGS of each face loop (outer + holes) and Na__SitePlan__WriteFill emits one LINE_LOOP primitive (mode 2) per ring with extras Na__SitePlanFace and Na__SitePlanRing - there is no triangulation and no POSITION-indexed mesh. A real 2D face MESH needs face.mesh (Geom::PolygonMesh) walked into POSITION + indices with mode 4 (TRIANGLES), written either into the existing __FillModel__ file or a new suffix registered in NA__SITEPLAN__CONFIG_DEFAULTS and SitePlanExportConfig. Whether a layer participates is currently the boolean SitePlan__ExportFills (true on exactly six layers: ExistingBuildings, ProposedBuildings, ProposedBuildingsSecondary, HardSurfaces, Trees, HedgesAndPlanting).
- *Risk:* NA__SITEPLAN__OLD_FILE_PATTERN (/\A(?:.*?__)?TrueVision__SitePlan__[A-Za-z0-9]+__(?:LineworkModel|FillModel)__\.glb\z/i) hardcodes the two suffixes. A new third file suffix will NOT be recognised as a site plan file, so stale ones are never offered for deletion - and note the pattern's [A-Za-z0-9]+ means a stem containing an underscore or a hyphen is invisible to the cleanup.

**Where Existing vs Proposed site plan folders (two R2 stores) would attach on the SketchUp side**

- *Where:* Na__SitePlan__ChooseFolder in Na__TrueVision__GlbBuilder__SitePlanExport__.rb, plus SitePlanExportConfig.ExportFolderName and NA__SITEPLAN__TV_CONTENT_FOLDER = '30__TrueVision__AppContent'.
- *How:* Today there is exactly ONE folder name, SitePlan__DrawingData. Picking the folder named 30__TrueVision__AppContent auto-creates and descends into it; any other basename triggers a yes/no warning. The last-used directory is remembered in Sketchup defaults section 'TrueVision3D_GlbBuilder', key 'SitePlanExportDir'. Two stores means either two ExportFolderName values in SitePlanExportConfig or a folder-name suffix chosen at export time, and the manifest (one per folder) would need to say which it is - SitePlanData__* has no such field today.
- *Risk:* NA__SITEPLAN__PREFS_KEY_DIR is a single remembered path, so a two-folder workflow will keep re-offering the wrong one.

### Traps

- CACHE: Na__DataLib__CacheData holds a 30-minute TTL cache in Sketchup.temp_dir/Na__DataLib__Cache (files Na__DataLib__Cache__tags.json etc.). Editing the local plugins-folder JSON does NOT reach Edge Paint, GlbBuilder Main's exclusions, Noble3dModellingTools, ProfileTools or AssemblyStudio until GitHub is updated AND the cache expires - or Na__Cache__LoadData(key, true) / Na__Cache__PurgeCacheFile is called. The exporters (SitePlanExport, LinetypeLineworkExport) and TagsManager read the LOCAL file FIRST, so during a build the two halves of the plugin can be running on DIFFERENT versions of the same SSOT.
- STALE CACHE COPIES ON DISK: three plugins ship a 90__AppCache__TempFilesCache folder containing Na__DataLib__Cache__tags.json / __materials.json / __edge_materials.json / __components.json (under Na__ArchTools__ElementAssemblyStudioPro__Modules__, Na__Noble3dModellingTools__Modules__, Na__ProfileTools__ProfilePathTracer__Modules__). These are cached snapshots wrapped as {"cached_at":…,"data":…}. Do NOT edit them and do not mistake them for the SSOT; they will be silently overwritten.
- BLOCK RE-PADDING: any new leaf key longer than "EdgePainting__AdvancedSwapOff" (31 chars with quotes) added to a 71_75 tag entry moves the colon column for the WHOLE block - all 18 (soon 25) entries must be re-padded or the file stops matching house style. Same rule in ExportExclusions (current longest "AdvancedSwapOffTagNames") and SitePlanExportConfig (current longest "SupportedScaleDenominators").
- SITE PLAN LAYERS ARE KEYED BY SKETCHUP TAG NAME, NOT BY STEM. Na__SitePlan__BuildLayerDefinitions builds layers[Tag__SketchUpName]. There is NO legacy-alias field for site plan tags - the linetype exporter has Glb__LineworkLegacyTagNames, the site plan exporter has nothing equivalent. The three renames in this build will orphan geometry in every existing model unless a migration re-tags it or a legacy mechanism is added.
- RENAMING A TAG USUALLY RENAMES ITS EXPORTED FILE. If SitePlan__ExportFileNameStem changes, the published {prefix}{stem}__LineworkModel__.glb and __FillModel__.glb names change, every manifest Layer__CategoryKey changes, and the next export offers to delete the old files as stale (NA__SITEPLAN__OLD_FILE_PATTERN). Downstream TrueVision site plan drawings keyed on the old CategoryKey will go blank.
- EXPORTEXCLUSIONS IS ALL-OR-NOTHING FOR EDGE PAINT: Na__LineTags__LoadProtectedTagNames only falls back to scanning per-entry EdgePainting__AdvancedSwapOff when AdvancedSwapOffTagNames is EMPTY. A partially-updated array means a new tag is unprotected and Apply Line Thickness Tags will strip its edges to Untagged - the exact failure the Vale importer's edgePaintingNote warns about.
- HARDCODED REGEX DUPLICATION: SitePlanExportConfig.TagNamePatternRegex ("^\\d{2}__SitePlan__") is documentation - nothing reads it. The real gate is SITE_PLAN_TAG_PATTERN = /^\d{2}__SitePlan__/ hardcoded in Na__TrueVision__GlbBuilder__Main__.rb (~line 117) and used by CoreExport (~483) and UserInterface (~510). A new site plan tag that does not literally start with two digits and __SitePlan__ will be counted as zero in the UI, will not disable the Export Site Plan card correctly, and may leak into the model GLBs.
- NA__SITEPLAN__CONFIG_DEFAULTS IS A WHITELIST: Na__SitePlan__Config copies from SitePlanExportConfig ONLY the five keys already present in the defaults hash (ExportFolderName, ManifestFileName, LineworkFileSuffix, FillFileSuffix, ExportIgnoresTagVisibility). Any new config key added to the JSON is silently ignored until the constant is extended. LinetypeExportConfig has the same guard (config.key?(key)).
- NOBLE3D TAGUTILS SECTION-KEY LISTS: NA_TRUEVISION_ALL_GROUP_KEYS omits '71_75__SitePlanTags__'. If a new SSOT section is created (rather than adding to 71_75), it is invisible to every Noble3dModellingTools menu entry except 'Load All Tags', and invisible to TagsManager unless the numeric prefix falls in NA__TAGS_MANAGER__CREATE_PREFIX_RANGES.
- NOBLE3D TAGUTILS READS FIELD NAMES THAT DO NOT EXIST IN THE SSOT: it looks for Tag__LineStyle__Config and Tag__EdgeMaterial__Config before Layout__LineStyleName / Layout__EdgeColourID. Two spellings of the edge colour id are live in the codebase - Layout__EdgeColourID (03 section, read by Edge Paint and TagUtils) and SitePlan__LineColourId / SitePlan__FillColourId (71_75 section, lowercase 'd'). Copy the spelling of the block you are editing.
- GIVING A SITE PLAN TAG A Glb__ExportFileNameStem WOULD BREAK VALEVISION: Na__ValeVisionCloudSync__TagVisibilityCapture__.rb's na_flatten_tags_index registers every tag that has one as a 3D layer toggle. The 71_75 section header says this explicitly. Keep site plan stems in SitePlan__ExportFileNameStem only.
- MATERIALS: for an indexed MAT###__ material the SSOT Opacity owns the glTF alpha and the SketchUp Materials-tray opacity is deliberately ignored (Na__TrueVision__GlbBuilder__EngineCore__MaterialHandling__.rb, ~lines 168-178). But the material CREATOR (Na__Noble3dModellingTools na_apply_opacity) also writes that same Opacity to material.alpha, so an SSOT entry cannot currently be opaque in SketchUp and translucent in TrueVision. Only the MAT000E__ exempt prefix decouples them, and it decouples them the wrong way round.
- MATERIALS: MAT101 has a hardcoded twin. Na__AssemblyStudio__AppData__MaterialManager__.rb keeps NA_SAFETY_GLASS_COLOR / NA_SAFETY_GLASS_ALPHA as a last-resort fallback; meta.divergenceNote says those two constants must stay in sync with MAT101 here.
- MATERIALS: Na__InsertPrimatives__AppUtils__StandardMaterials__.rb hunts a recipe by SketchUpName with a recursive walk 'because the entry can appear more than once', and carries its own inline hardcoded recipe for the transparent utility material - a change to that entry needs the inline copy changed too.
- EDGE MATERIALS: MTE103__LineColour__MediumDarkGrey__L50's SketchUpName is "MTE103__LineColour__MediumDarkGrey__L45" - key and SketchUp name disagree. Anything matching by key vs by name will behave differently on that one entry.
- EDGE MATERIALS: the file has TWO roots. Na__SitePlan__EdgeHexIndex reads only Na__DataLib__CoreIndex__EdgeMaterials; a colour added under Na__DataLib__CoreIndex__ConstructionLinework resolves to nil LineHex in the manifest with no error.
- META VERSION IS PUBLISHED: Na__SitePlan__Scan reads tags_data['meta']['version'] and writes it into the manifest as SitePlanData__TagsSsotVersion. Bump meta.version and meta.lastUpdated with every SSOT edit or the published data lies about its provenance.
- THE PLUGINS FOLDER IS A SEPARATE GIT REPO (Adam-Noble-01/Plugins) from the website repo this session is rooted in. An SSOT edit is not live for the cache/URL readers until it is pushed there; the harness's no-branch / commit-to-main rule applies to a different repository than the one in the environment header.
- NO RUBY INTERPRETER LOCALLY (per memory): nothing under the Plugins folder can be run or syntax-checked on this PC. Any Ruby change must be reasoned through statically and tried inside SketchUp.
- JSON VALIDITY: these files are strict JSON - no trailing commas, no comments. All explanation must go in sibling *Note / *Description string keys, which is why the files read as documented as they do.

### Open questions raised by this survey

- Z-index 1..10: does it REPLACE SitePlan__DrawOrder (breaking the published manifest contract and every 10..95 value) or sit alongside it as a second field? And does the manifest schema version (SitePlanData__SchemaVersion, currently 1) get bumped?
- The three tags being renamed - which three? The likely candidates by subject are 71__SitePlan__BaseMap__OsMapping (splitting into main roads / minor streets / minor feature), 75__SitePlan__SoftLandscape__Trees (-> mixed woodland trees) and 75__SitePlan__SoftLandscape__HedgesAndPlanting. Every rename changes the exported file name via SitePlan__ExportFileNameStem unless the stem is deliberately held constant - is the stem to be held?
- Should site plan renames gain a legacy-alias mechanism modelled on Glb__LineworkLegacyTagNames (e.g. SitePlan__LegacyTagNames), so existing models keep exporting? Today there is none and geometry on an old layer name is silently dropped.
- Do the new face materials become site plan FILL colour sources (SitePlan__FillColourId pointing at a MAT id) or do they stay SketchUp-authoring-only? Today FillColourId is resolved ONLY against EdgeMaterials, so a MAT id would silently produce a null FillHex.
- How is 'opaque in SketchUp, alpha only in TrueVision' to be expressed? There is one Opacity field and the material creator writes it to material.alpha. Options: a new field (SketchUp__Opacity / Render__Opacity) honoured in na_apply_opacity, or keep alpha exclusively in SitePlan__FillOpacity in the Tags SSOT and leave the MAT entry fully opaque.
- Where does the new SVG hatch pattern library live - a fourth SSOT JSON in Na__Common__DataLib__CoreSuEntityStandards (needing registration in UrlGenerator::FILE_KEYS and CacheData::FILE_KEY_LABELS), or purely inside the TrueVision app? Nothing in the Plugins folder knows about hatch patterns today.
- Do the new site plan tags stay inside the 71-75 numeric band (and inside the single 71_75__SitePlanTags__ section), or open a new number? A new number outside 71..75 would need NA__TAGS_MANAGER__CREATE_PREFIX_RANGES extended, and a new SECTION key would need adding to Noble3d TagUtils' hardcoded group lists.
- Existing vs Proposed as two R2 stores: is the split expressed on the SketchUp side at all (two ExportFolderName values, a manifest field naming the store) or purely downstream in ProjectVision? Today the exporter knows one folder name and remembers one last-used directory.
- The 'Export Polygon Faces' toggle - is it a per-export UI switch, a per-layer SSOT field, or both? SitePlan__ExportFills already exists as the per-layer boolean; a UI toggle plus that field means two gates.
- Should the six SitePlan__ExportFills layers that currently have FillColourId null (ExistingBuildings, HardSurfaces) be given explicit fill colours as part of this build? Their Tag__Description says the fill 'draws only once a style gives them a colour'.

---

<a id="seams"></a>
## Cross-cutting findings: the seams between subsystems

### Findings

All line numbers are POINTERS. Every symbol below was located and read by name; find it by name.

================================================================
1. Z-INDEX 1..10 — WHERE SITE PLAN DRAW ORDER IS DECIDED TODAY
================================================================

There is exactly ONE sort, and it happens in the STORE, not the painter.

FILE: D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__Store__.js
FUNCTION: Na__SpStore__Describe

    const layers = (Array.isArray(pick('SitePlanData__Layers', 'SitePlan__Layers')) ? pick(...) : [])
        .map((entry) => Na__SpStore__Layer(entry, source, folderUrls))
        .filter(Boolean)
        .sort((a, b) => a.Layer__DrawOrder - b.Layer__DrawOrder);           // <-- Lowest draws first, so the red line ends on top

The default lives in Na__SpStore__Layer, same file:

    Layer__DrawOrder : Number.isFinite(raw.Layer__DrawOrder) ? raw.Layer__DrawOrder : 50,

Real PS01 values (read from na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\TrueVision__SitePlanData__Manifest__.json): 20 OsMapping, 40 ExistingBuildings, 70 ProposedBuildingsSecondary, 71 ProposedBuildings, 90 RedLineBoundary. So today's scale is 0–100-ish, defaulting to 50.

IS A SINGLE GLOBAL SORT ENOUGH? NO — and not for the reason the brief assumes. Three separate facts:

(a) THE FILLS DO inherit the sort. In Na__LayoutEditor__Viewport2d__SitePlan__.js, Na__LeVp2d__SitePlanBuild walks `descriptor.SitePlan__Layers` (already sorted) filtered by Na__LeModelLayers__IsOn, pushes into `loaded` in that order, and `fills` is `loaded.filter(...).map(...)` — so fills are painted in DrawOrder order by Na__LeVp2d__PaintSitePlan's first loop.

(b) THE LINEWORK DOES NOT. Every site plan segment is concatenated into ONE Float32Array in the `visible` class and tagged only with an owner id:

    const classes = { visible : segments, hidden : new Float32Array(0), authored : new Float32Array(0), section : new Float32Array(0) };
    Na__PlOwners__Attach(classes, { visible : owners, ... }, table.Keys);

Painting order is then decided by Na__LeVp2d__StyleBands (Na__LayoutEditor__Viewport2d__Linework__.js), which buckets by RESOLVED STYLE and sorts by stroke width:

    // HEAVIEST LAST INSIDE A CLASS. Two lines of different weight meeting
    // at a corner read better with the heavier one drawn over the lighter,
    Array.from(buckets.values())
        .sort((a, b) => a.style.widthMm - b.style.widthMm)

and, critically, layers that resolve to the same style collapse into one band:

    if (buckets.size === 1) {                                             // <-- Every category agrees: one path, as before

So DrawOrder currently has NO effect at all on line-over-line order. PS01 works by accident: the red line is 0.50 mm (heaviest) and therefore last. Give two layers the same weight+colour+linetype and they merge into one path with no order between them.

(c) FILLS ARE STRUCTURALLY UNDER ALL LINES. Na__LeVp2d__PaintSitePlan writes one string: every fill path first, then every band path. There is no interleaving mechanism, no <g>, no per-layer id, no data- attribute. "Fill of layer 6 above linework of layer 3" is not expressible today.

VERDICT: a 1..10 Z-index needs THREE ordering passes if composites are to mean anything — fills, patterns, linework — and PaintSitePlan's `let body = ''` concatenation is the single place all three are decided. A one-key sort in Na__SpStore__Describe cannot reach the linework at all while StyleBands owns line order.

WHAT HAPPENS TO THE PDF ORDER: the same shape, from the same build. Na__LayoutEditor__PdfExporter__.js, Na__LePdf__DrawViewport:

    if (Na__LeModel__IsSitePlanViewport(viewport)) {
        const drawing = await Na__LeVp2d__SitePlanDrawing(viewport);
        if (drawing) {
            Na__LePdf__DrawSitePlanFills(doc, viewport, described, drawing.fills);
            Na__LePdf__DrawLinework(doc, sheet, viewport, described, drawing.classes);
        }
        return;
    }

Na__LePdf__DrawSitePlanFills iterates `fills` in DrawOrder order, but drops inner rings:

    fill.rings.forEach((ring) => {
        if (!ring.outer || !ring.points || ring.points.length < 6) return;

and Na__LePdf__DrawLinework re-calls the SAME Na__LeVp2d__StyleBands, so the PDF inherits the width-ascending band order too. Conclusion: screen and paper already agree on ORDER and disagree on HOLES. Any z-index work must be done once in the shared build and twice in the two painters, or they will diverge.

DO NOT REUSE THE FIELD NAME. Na__SpStore__Layer defaults a missing Layer__DrawOrder to 50. If Layer__DrawOrder is redefined as 1..10, every already-published manifest (PS01, exported 2026-09-17) keeps 20/40/70/71/90 and sorts entirely above any new 1..10 value — the red line at 90 would end up on top of nothing, and new layers would all draw first. A new key (e.g. Layer__ZIndex) read with a fallback to a band derived from Layer__DrawOrder is the only safe shape.

================================================================
2. FACES AS MESH — DOES THE PARSER UNDERSTAND TRIANGLES?
================================================================

NO. Categorically not. Triangles are named in the parser only to be ignored.

FILE: ...\02__Src__AppModules\52__System__SitePlanData\Na__SitePlan__GlbParse__.js

    const Na__SpGlb__MODE_LINES   = 1;
    const Na__SpGlb__MODE_LOOP    = 2;
    const Na__SpGlb__MODE_DEFAULT = 4;                                          // <-- glTF's default: triangles, which a site plan never has

MODE_DEFAULT exists ONLY to interpret a primitive with no `mode` field, and it is then compared for equality against the mode asked for:

    function Na__SpGlb__Primitives(container, mode) {
        ...
                const primitiveMode = Number.isInteger(primitive.mode) ? primitive.mode : Na__SpGlb__MODE_DEFAULT;
                if (primitiveMode === mode) list.push({ primitive : primitive, matrix : instance.matrix });

Only two callers exist, `Na__SpGlb__Primitives(container, Na__SpGlb__MODE_LINES)` in ParseLinework and `Na__SpGlb__Primitives(container, Na__SpGlb__MODE_LOOP)` in ParseFill. The module exports exactly three things:

    export {
        Na__SpGlb__ReadContainer,
        Na__SpGlb__ParseLinework,
        Na__SpGlb__ParseFill
    };

A triangle GLB fed to this today produces an EMPTY result with no thrown error — it reads as "the export wrote nothing", which is the hardest failure mode to diagnose.

MINIMUM CHANGE (small, and genuinely small):
 - Na__SitePlan__GlbParse__.js: add `Na__SpGlb__ParseFaces(buffer)` — a near-copy of ParseLinework that calls `Na__SpGlb__Primitives(container, Na__SpGlb__MODE_DEFAULT)` (4) and walks indices in threes instead of twos. Na__SpGlb__DrawingPoints, Na__SpGlb__ReadVec3, Na__SpGlb__ReadIndices, Na__SpGlb__MeshInstances and the bounds helpers are all mode-agnostic and need no change. Export it.
 - Na__SitePlan__Store__.js: Na__SpStore__Layer whitelists URLs — add a third (`Layer__FaceUrl` / `Layer__FaceFile`) to its `url()` helper; Na__SpStore__LoadLayer adds a third guarded fetch beside the fill one and puts `faces` on the resolved data object.
 - Na__LeVp2d__SitePlanBuild: build the face path data from triangles.
Hard constraints the parser imposes on whatever SketchUp writes: POSITION must be a float VEC3 (`if (!accessor || accessor.type !== 'VEC3' || accessor.componentType !== Na__SpGlb__FLOAT) throw new Error(label + ' is not a float VEC3')`), indices must be unsigned SCALAR 1/2/4 bytes, no sparse accessors, no quantised/normalized attributes, GLB v2 only, and COLOR_0 is never read (colour comes only from Layer__Style).

VERDICT — KEEP RINGS, DO NOT SWITCH TO TRIANGLES:
 1. SVG. Rings give the browser one `d` string and `fill-rule="evenodd"`, which cuts holes for free (Na__LeVp2d__RingPathData + the `fill-rule="evenodd"` attribute in Na__LeVp2d__PaintSitePlan). A triangle soup in SVG is thousands of `<path>`s or one giant path, and shows hairline seams between adjacent triangles at every zoom level — this is exactly what plan doc decision SP10 says the rings were chosen to avoid.
 2. jsPDF. The PDF draws polygons through Na__LeChrome__PushPolyline; a triangulated fill would be N polygons with N shared edges, each anti-aliased by the reader — visible seams in the issued drawing, which is the deliverable. It would also multiply the primitive count by roughly the triangle count.
 3. HATCHING NEEDS A CLOSED OUTLINE, NOT A MESH. An SVG `<pattern>` fill and a clipped hatch both want the ring path. Triangles would have to be re-stitched into an outline before a hatch could be clipped to it — work the exporter has already done.
 4. The one thing triangles buy you — a GPU/canvas fill — is not how any of this paints; both painters are vector.
RECOMMENDATION: if Adam wants "Export Polygon Faces", write the face mesh as a THIRD file alongside the rings (a new suffix), and have TrueVision keep painting from the rings. Note the cost: a new suffix must be added to NA__SITEPLAN__CONFIG_DEFAULTS and NA__SITEPLAN__OLD_FILE_PATTERN in the Ruby, and to SITEPLAN_FILE_PATTERN in CloudflareR2__ModelSync__Main__.py, or stale files are never swept and the new file is never uploaded by the no-manifest fallback path.

FIELD EVIDENCE THAT THE FILL PATH IS UNTESTED: in PS01's manifest the ONLY layer with a __FillModel__ GLB is ExistingBuildings, and its style is `FillColourId: None, FillHex: None, FillOpacity: None`. Na__LeVp2d__SitePlanBuild filters fills on `data.layer.Layer__Style.FillHex && Number.isFinite(...FillOpacity) && ...FillOpacity > 0` — so it is discarded. The two layers that DO have FillHex/FillOpacity (ProposedBuildings 0.45, ProposedBuildingsSecondary 0.2) both carry `Layer__Warnings: ['no faces, so no fill; draw the outline as a closed face']` and have no fill GLB. NOT ONE FILL IS PAINTED IN PS01 TODAY, on screen or on paper. Whatever is built here is being built against a code path that has never drawn a pixel in the live project.

================================================================
3. TWO STORES — EVERY PLACE THAT ASSUMES EXACTLY ONE
================================================================

A. THE STORE MODULE ITSELF — ...\52__System__SitePlanData\Na__SitePlan__Store__.js. Every one of these is module-level singleton state, not per-store:
   - const Na__SpStore__FOLDER = 'SitePlan__DrawingData';   (one folder name)
   - const Na__SpStore__DATA_KEY = 'SitePlan__DataStore';   (one project-data key)
   - const Na__SpStore__MANIFEST, Na__SpStore__CDN_BASE, Na__SpStore__PORTAL_DIR, Na__SpStore__CONTENT_DIR
   - const Na__SpStore__RED_LINE_KEY = 'TrueVision__SitePlan__RedLineBoundary'
   - let Na__SpStore__Status / Note / Descriptor / Pending / Generation
   - const Na__SpStore__LayerPromises = new Map();   keyed `categoryKey + '|' + exportedIso`
   - const Na__SpStore__LayerData     = new Map();   keyed by BARE categoryKey  <-- THE SHARPEST TRAP
   - Na__SpStore__FolderUrls()  — builds one {local, cdn} pair, no store argument
   - Na__SpStore__Find()        — fixed 3-step order (local manifest, project-data key, CDN manifest)
   - Na__SpStore__Resolve() / Reload() / LoadLayer() / LoadAll() / GetStatus() / GetNote() / GetDescriptor() / GetLayers() / GetLayerData(categoryKey) / GetFocusBoundsMm()  — NONE takes a store id.
   Two stores publishing the same Layer__CategoryKey would overwrite each other in Na__SpStore__LayerData silently.

B. PAINTER — ...\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__SitePlan__.js
   - Na__LeVp2d__SitePlanToken(viewport): `'siteplan:' + (descriptor ? descriptor.SitePlan__ExportedIso : 'none') + ':' + Na__LeModelLayers__Token(viewport)` — no store identity, so switching store would NOT repaint.
   - Na__LeVp2d__SitePlanPaintKey(viewport, masterPt) — same omission.
   - Na__LeVp2d__SitePlanBuild(viewport, allowMissing) — `Na__SpStore__GetDescriptor()` with no viewport/store argument.
   - Na__LeVp2d__SitePlanDrawing(viewport) — `Na__SpStore__Resolve()` then `Na__SpStore__LoadAll()`; the PDF has no way to name a store.
   - Na__LeVp2d__FillSitePlan — `Na__SpStore__GetStatus()` / `GetNote()`, one global status drives every site plan frame on every sheet.

C. VIEWPORT HOST — ...\20__System__Viewports\Na__LayoutEditor__Viewport2d__.js
   - Na__LeVp2d__CentreOnDrawing → `const bounds = Na__SpStore__GetFocusBoundsMm();`
   - Na__LeVp2d__ForceRender → `await Na__SpStore__Reload(); await Na__SpStore__LoadAll();` — reloads EVERY store, clears the shared caches.

D. LAYER TOGGLES — ...\25__System__RenderStyles\Na__LayoutEditor__ModelLayers__.js
   - Na__LeModelLayers__Groups: `Na__SpStore__GetLayers().forEach((layer) => { ... })` builds the site plan groups. Two stores would produce duplicate rows or one row governing both.
   - Na__LeModelLayers__IsOn(viewport, categoryKey): `return stored[categoryKey] !== false;` — Viewport__ModelLayers is keyed by BARE category key.
   - Na__LeModelLayers__Token(viewport) — the hidden-key list, also bare keys.

E. EDGE STYLES — ...\25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js
   - Na__LeEdge__SitePlanDefault(categoryKey): `const layer = Na__SpStore__GetLayers().find((entry) => entry.Layer__CategoryKey === categoryKey);` — takes NO viewport, so a per-store default style is impossible without changing this signature.
   - Na__LeEdge__SITEPLAN_PREFIX = 'TrueVision__SitePlan__' (literal).

F. MODEL SOURCE — ...\20__System__Viewports\Na__LayoutEditor__ModelSource__.js
   - `if (marker && typeof marker === 'object') return Na__SpStore__GetLayers().map((layer) => layer.Layer__CategoryKey);`

G. PANELS — ...\40__Ui__Panels\
   - Na__LayoutEditor__Panel__ViewportSettings__.js: Na__LePanelViewport__AddSitePlan uses `await Na__SpStore__Resolve()`, `descriptor.SitePlan__Layers.forEach(...)` to build the off-map, and `Na__SpStore__GetFocusBoundsMm()`; Refresh reads `Na__SpStore__GetStatus()` / `GetDescriptor()` and disables the Add button on one global status. The add-siteplan block has NO store control.
   - Na__LayoutEditor__Panel__ModelLayers__.js: one listener on Na__SpStore__CHANGED_EVENT rebuilds everything.

H. RECORDS — ...\07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js
   - Na__LeRec__SITEPLAN_CATEGORY_PREFIX = 'TrueVision__SitePlan__' — the no-prune exemption in Na__LeRec__NormaliseProjectedEdges keys on the bare category key, so an override written for the Existing store leaks onto the Proposed one.
   - Na__LeRec__IsSitePlanViewport reads only "is Viewport__SitePlan a non-array object".

I. THE ONE PIECE OF GOOD NEWS, AND ITS CATCH. Na__LeRec__NormaliseViewport does `viewport.Viewport__SitePlan = Object.assign({}, viewport.Viewport__SitePlan);` — a shallow copy, so a new sub-key (e.g. SitePlan__StoreId) survives save/load/undo with no normaliser change. BUT Na__LeModel__UpdateViewport (Na__LayoutEditor__SheetModel__Viewports__.js) has NO `patch.sitePlan` branch — I read the whole patch list (rect, pan, imageMm, imageOffset, imageZoom, styles, modelLayers, projectedEdges, compositeWeights, scaleDenominator, markupMode, name, layerId, sceneId, drawingId, kind, showScaleLabel, showFrame, closedDoors, locked, snapshotAsset, modelSourceId). A store can be set at CREATE time (`Na__LeModel__CreateViewport` does honour `opts.sitePlan`) and then never changed. A new patch branch is required.

J. PRODUCER SIDE (for completeness): ProjectVision__BuildScript__.py SITEPLAN_FOLDER_NAME + discover_truevision_siteplan_store + `data['SitePlan__DataStore']`; CloudflareR2__ModelSync__Main__.py SITEPLAN_FOLDER_NAME + its manifest gate in discover_model_groups. Four files hold that folder name by hand.

================================================================
4. LOCATION PLAN RULE — WHERE IS THE DENOMINATOR AT PAINT TIME?
================================================================

It is available in three places, all synchronous, all free.

(a) STRAIGHT OFF THE RECORD. In ...\20__System__Viewports\Na__LayoutEditor__Viewport2d__Window__.js:

    function Na__LeVp2d__Window(viewport) {
        const frame = viewport.Viewport__FrameMm;
        const D     = viewport.Viewport__ScaleDenominator;
        ...
        const win = {
            CentreX : cx, CentreY : cy, WidthMm : w, HeightMm : h, OriginX : ox, OriginY : oy, Denominator : D, Frame : frame,

Note it reads the RAW field, never through Na__LeScale__Coerce.

(b) IN THE PAINTER. Na__LeVp2d__PaintSitePlan already does `const win = Na__LeVp2d__Window(viewport); const D = win.Denominator;` and uses D to multiply every stroke width and dash. Na__LeVp2d__FillSitePlan also calls Na__LeVp2d__Window. And Na__LeVp2d__SitePlanPaintKey already folds the denominator into the repaint guard: `... + '|' + viewport.Viewport__ScaleDenominator + '|' + masterPt + ...`.

(c) IN THE BUILD — this is the place the rule belongs. Na__LeVp2d__SitePlanBuild(viewport, allowMissing) is handed the viewport, so `viewport.Viewport__ScaleDenominator` is directly in scope where `fills` is assembled:

    const fills = loaded
        .filter((data) => data.rings.length > 0 && data.layer.Layer__Style.FillHex && Number.isFinite(data.layer.Layer__Style.FillOpacity) && data.layer.Layer__Style.FillOpacity > 0)
        .map((data) => ({ categoryKey : data.categoryKey, hex : ..., opacity : ..., rings : data.rings }));

Adding the rule there gets the PDF for free, because Na__LePdf__DrawViewport takes its fills from Na__LeVp2d__SitePlanDrawing → Na__LeVp2d__SitePlanBuild. Adding it in PaintSitePlan instead would fix the screen and silently NOT fix the paper. The PDF also has D to hand: `Na__LePdf__DrawSitePlanFills` opens `const win = described.window; const D = win.Denominator;`.

THE RULE AS BRIEFED CONTRADICTS THE SHIPPED NAMING, AT EXACTLY 1:500. ...\40__Ui__Panels\Na__LayoutEditor__Panel__ViewportSettings__.js, Na__LePanelViewport__AddSitePlan:

    name : scale >= 1000 ? Na__LeCfg__GetLabel('SitePlanLocationPlan', 'Location Plan') : Na__LeCfg__GetLabel('SitePlanBlockPlan', 'Block Plan'),

and its own comment: "A 1:500 viewport is named Block Plan and a 1:1250 one Location Plan." The brief says "viewports at 1:500 or coarser are Location Plans". At 500 the app calls it a Block Plan. Adam must settle whether the fill-suppression threshold is `>= 500` (catching what the app names a Block Plan) or `>= 1000` (matching the existing naming).

SUPPORTING FACTS. The only scales that exist for a site plan viewport are [500, 1250] — ...\07__Core__SheetData\Na__LayoutEditor__ScaleManager__.js, Na__LeScale__SitePlanSetup: `const list = (Array.isArray(setup.sitePlanDenominators) && setup.sitePlanDenominators.length) ? setup.sitePlanDenominators : [ 500, 1250 ];`. There is no Na__LeScale__IsLocationPlan today; ScaleManager exports only ListDenominators, Coerce, IsListed, Next, PaperToModelMm, ModelToPaperMm, FormatLabel, SheetLabel. Note also that the EXISTING coarse-scale mechanism is per-layer and set ONCE at creation: AddSitePlan writes `descriptor.SitePlan__Layers.forEach((layer) => { if (layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[layer.Layer__CategoryKey] = false; });` — in PS01 every layer lists [500, 1250], so nothing is currently switched off at either scale, and changing a viewport's scale afterwards does NOT re-run that.

================================================================
5. THE PATTERN PANEL — CAN IT LOAD JSON FROM 52__LayoutEditor__HatchPatternLibrary?
================================================================

YES, in all three environments, by plain relative-URL GET. It is NOT a special case. Evidence:

THE FOLDER IS INSIDE THE APP. D:\...\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary — a sibling of Index.html, exactly like 51__LayoutEditor__UserScrapbookContent. Verified contents: five pack folders (01__GeometricHatches, 02__ConstructionMaterialHatches, 03__Placeholder, 04__Placeholder, 05__SitePlanHatches), ALL COMPLETELY EMPTY (no files, not even a placeholder), plus two reference PNGs at the folder root. And ...\02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools is EMPTY (`total 4`, only . and ..). There is no loader, no index, no config, no code anywhere.

WHAT SERVES IT IN EACH CASE:
 - LOCALHOST via ProjectVision (8090/8095): D:\...\na-apps\ProjectVision__LocalServer__Main__.py, the catch-all `@app.route('/<path:filepath>')` / `def serve_static(filepath)` with `REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))` and `send_from_directory(directory, filename)`. It serves the entire repo. No new Flask route is needed to READ.
 - LOCALHOST via a plain `python -m http.server`: static file, served.
 - DEPLOYED (GitHub Pages / the live site): the repo IS the site, so /na-apps/30__TrueVision__CoreAppCode/52__LayoutEditor__HatchPatternLibrary/<pack>/<file>.json is a plain GET.
 - The URL is resolved the house way, with no environment test: Na__LayoutEditor__ScrapbookCustom__Transport__.js does `const Na__LeScrapCustomIo__AppRootUrl = new URL('../../../', import.meta.url);` from a 51__System__LayoutEditor/NN__Feature module and `new URL(contentFolder + '/' + parts.join('/'), AppRootUrl).href`. Copy that exactly.

THE ONE REAL CONSTRAINT: NO DIRECTORY LISTING ANYWHERE. Flask's serve_static, given a directory, returns index.html/Index.html or 404 — it never lists. GitHub Pages does not list. The Custom Scrapbook config states this outright (Na__LayoutEditor__ScrapbookCustom__Config__.json, Meta__Files): "The live website has no directory listing: the index is what makes the library readable there once the repository is pushed." So the Patterns panel needs a CHECKED-IN index JSON (the precedent is Library__IndexFile = "UserScrapbook__Index__.json"). Reading needs no server. Only WRITING (a pattern generator that saves a pack from the browser) needs a Flask blueprint — and then the 8090 route-reload trap applies: a new route answers 404/405 until Adam restarts the server.

SERVICE WORKER — I read D:\...\30__TrueVision__CoreAppCode\Na__Pwa__ServiceWorker__.js (a 50-line stub that importScripts '02__Src__AppModules/62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js') and the logic file. The verdict is favourable:
 - OWNED: `const PWA_SW_SAME_ORIGIN_FOLDER_TOKENS = ['/na-apps/30__TrueVision__CoreAppCode/', '/na-apps/01__Assets__NaApps__CommonAssets/'];` — the hatch library is inside the first token, so the worker handles it.
 - A .json PACK IS CLASSIFIED 'data': `const PWA_SW_PATTERN_DATA_JSON = /\.json(\?.*)?$/i;` → `TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_DATA)`. Network-first, so an edited pack is picked up on the next load. That is the behaviour you want.
 - TRAP IF YOU SHIP .svg PATTERN TILES INSTEAD OF .json: `PWA_SW_PATTERN_SHELL_ASSET = /\.(css|js|mjs|webmanifest|ico|png|jpe?g|svg|webp|woff2?)(\?.*)?$/i` → the SHELL bucket, stale-while-revalidate in production. An edited tile would then serve the previous version until a second reload. Keep patterns as .json.
 - DO NOT add packs to `PWA_SW_SHELL_PRECACHE_RELATIVE` (five entries only: Index.html, the CSS index, Na__AppConfig__Main.json, Na__AppConfig__Hotkeys.json, the manifest fallback). Its comment warns precaching into the wrong bucket "would look right and do nothing".
 - Current token: `const PWA_SW_VERSION_TOKEN = '2026-09-20-3';` — bump it (and add the matching DEVELOPMENT LOG line in that file) if the release adds a new module export that a new import names.

PANEL PLUMBING, CONFIRMED BY READING ...\05__Core__ModeController\Na__LayoutEditor__ModeController__.js:
 - Right column is registered as: RegisterTab('right', {id:'properties'}) FIRST, then Na__LePanelScrap__RegisterTab(), then Na__LePanelParam__RegisterProperties(), Viewport, Text, Leaders, Dims, Shapes, then under the comment "THE SCRAPBOOK TAB | Three libraries, one way of dropping": Na__LePanelScrap__Register(), Na__LePanelParam__RegisterLibrary(), Na__LePanelScrapCustom__Register(). A Patterns section added immediately after Na__LePanelScrapCustom__Register(), naming the scrapbook tab, lands last in the right column. Order is call order; there is no priority field.
 - Left column is Sheet, Margin, Layers, Styles (= Render Composites), ModelLayers.
 - A new config's Ready() must join `Na__LeMode__ReadyOnce = Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load() ])` or it is not awaited before the first sheet is normalised.

================================================================
6. LAUNCH.JSON AND THE LOCAL TEST URL
================================================================

FILE: D:\WE10_--_Public-Repo_--_Live-Website\.claude\launch.json (repo ROOT, not the app folder). 22 entries, read in full.

YES, there are working TrueVision static entries — sixteen of them, all identical in shape, all `python -m http.server <port>` with no cwd override, so they serve the REPO ROOT (the folder holding .claude\). Ports: truevision-static 8433, -verify 8444, -snapmove 8457, -alt 8442, -leaders 8463, -boxselect 8471, -spec 8481, -linework 8479, -frames 8491, -colourpick 8497, -vcb 8503, -doors 8511, -extlines 8517, **-siteplan 8523**, -elevdoors 8531, -specread 8537, -3dzoom 8541, -textrotate 8553, -marginspace 8563. Plus site-root 8421, projectvision-dev 8095 (ProjectVision__LocalServer__Main__.py --no-browser --port 8095), projectadmin-dev 8096.

Use `truevision-static-siteplan` (8523) for this work — the DEVLOG already records a session on `127.0.0.1:8523`.

THE URL. Because the server root is the repo root:

    http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26

BOTH ?project= AND ?project-folder= ARE REQUIRED. The DEVLOG states the failure explicitly: "The project path is gated on BOTH url parameters ... With only `project-folder` the app falls through to a default document pointing at ValeVision's Clough GLBs, loads zero categories, and reads exactly like a dead build." ?year= defaults to '26' (Na__AppUtils__GetYearFromUrl: `return urlParams.get('year') || '26';`) but pass it anyway.

HOSTNAME MATTERS FOR THE SITE PLAN SPECIFICALLY. ...\03__AppUtils\Na__AppUtils__ProjectLoader.js:

    function Na__AppUtils__IsRunningOnLocalhost() {
        const hostname = window.location.hostname;
        const port = window.location.port;
        return hostname === 'localhost' || hostname === '127.0.0.1' || port === '8000' || port === '8090';
    }

Na__SpStore__FolderUrls gates the LOCAL repo manifest on that test (`local : Na__AppUtils__IsRunningOnLocalhost() ? ... : null`), and Na__SpStore__Find tries the local manifest FIRST. So on localhost/127.0.0.1 you read D:\...\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\TrueVision__SitePlanData__Manifest__.json directly — a fresh SketchUp export draws with no build and no sync. On app.localhost the hostname test fails exactly and you silently fall through to the project-data key / CDN. Test site plan work on 127.0.0.1 or localhost, never app.localhost.

### Contradictions found in the other surveys (these corrections WIN)

- THE BRIEF'S LOCATION PLAN THRESHOLD CONTRADICTS THE SHIPPED APP AT EXACTLY 1:500. The brief says 'viewports at 1:500 or coarser are Location Plans'. Na__LePanelViewport__AddSitePlan (Na__LayoutEditor__Panel__ViewportSettings__.js) names a 1:500 viewport 'Block Plan': `name : scale >= 1000 ? ... 'Location Plan' : ... 'Block Plan'`, with the comment 'A 1:500 viewport is named Block Plan and a 1:1250 one Location Plan.' Since the only two site plan scales are [500, 1250], the rule as briefed applies to BOTH, i.e. it would suppress existing-site fills on every site plan drawing in the app.

- THE SURVEY SAYS 'Layer__DrawOrder ... the painter has exactly two passes (all fills, then all lines)' and implies DrawOrder governs line order. IT DOES NOT. Line order is decided by Na__LeVp2d__StyleBands, which buckets by RESOLVED STYLE and sorts `.sort((a, b) => a.style.widthMm - b.style.widthMm)`, collapsing same-styled layers into ONE path (`if (buckets.size === 1)`). Layer__DrawOrder reaches the fills only. PS01's red line ends on top because it is 0.50 mm, not because it is DrawOrder 90.

- THE SURVEY SAYS the site plan fill path works today. IT PAINTS NOTHING IN PS01. The only layer with a __FillModel__ GLB (ExistingBuildings) has FillHex null, and Na__LeVp2d__SitePlanBuild filters on `data.layer.Layer__Style.FillHex && Number.isFinite(...FillOpacity) && ...FillOpacity > 0`. The two layers that DO carry FillHex/FillOpacity have no fill GLB and carry Layer__Warnings 'no faces, so no fill; draw the outline as a closed face'. Zero fills are drawn on screen or on paper in the live project.

- ONE SURVEY SECTION SAYS 'Na__SpGlb__ParseFill ... boundsMm/ringCount thrown away' and another implies the store keeps the fill bounds. Confirmed: Na__SpStore__LoadLayer keeps only `rings = Na__SpGlb__ParseFill(fillBytes).rings;` and sets `boundsMm : lines.boundsMm` from the LINEWORK parse. A fill that extends past the linework is outside the recorded bounds.

- THE SURVEY LISTS pointer line ~246 for Na__SpStore__Layer's Layer__DrawOrder and ~267 for the sort; in the file as it stands they are inside Na__SpStore__Layer and Na__SpStore__Describe at roughly 240 and 265. The file is 494 lines, not the ~400 the pointers imply in places. Find by name.


### Gaps still open

**Which three SketchUp tags are being renamed, and whether SitePlan__ExportFileNameStem is held constant across the rename.**

- *Why it matters:* Layer__CategoryKey IS the stem. It is the identity key in Viewport__ModelLayers (the off-map), in Viewport__ProjectedEdges->Edges__Categories, in the per-paint owner table, in Na__LeEdge__SitePlanDefault and in Na__LeModelLayers__Groups. If a stem changes, every saved site plan viewport loses its layer toggles and its edge overrides silently, and the published GLB filenames change. If the stem is held constant while only the SketchUp tag name changes, TrueVision is untouched and the whole problem is a SketchUp-side migration.
- *Where to look:* Ask Adam. Then C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json -> Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__, the SitePlan__ExportFileNameStem of each entry.

**Whether the 1..10 Z-index is meant to interleave fills, patterns and linework per band, or only to re-scale the existing single fill/line split.**

- *Why it matters:* Na__LeVp2d__PaintSitePlan writes all fills then all bands into one string. A hierarchy that puts layer 6's fill above layer 3's linework cannot be expressed without restructuring that function AND abandoning the StyleBands merge (which is what makes a 30-category drawing one path instead of thirty). The performance and the feature are in direct tension and Adam should be told so before it is built.
- *Where to look:* Ask Adam with the two pictures side by side. Code: Na__LayoutEditor__Viewport2d__SitePlan__.js -> Na__LeVp2d__PaintSitePlan (the `let body = ''` concatenation) and Na__LayoutEditor__Viewport2d__Linework__.js -> Na__LeVp2d__StyleBands.

**Whether a hatch pattern belongs to the LAYER (travelling in the SSOT/manifest beside LineHex and FillHex) or to the VIEWPORT (an override like Viewport__ProjectedEdges).**

- *Why it matters:* It decides whether this is an exporter change or a TrueVision change. Layer-owned means a new SitePlan__ field in the Tags SSOT, a new Layer__Style key in the manifest, a new key in Na__SpStore__Style's whitelist (which STRIPS anything it does not name), and a new key in the build script's closed list. Viewport-owned means Na__LeRec__NormaliseProjectedEdges, which rebuilds every category entry as exactly four keys and would silently drop a fifth.
- *Where to look:* Ask Adam. Code: Na__SitePlan__Store__.js -> Na__SpStore__Style; Na__LayoutEditor__SheetRecords__.js -> Na__LeRec__NormaliseProjectedEdges; ProjectVision__BuildScript__.py -> discover_truevision_siteplan_store.

**Whether the hatch measures in PAPER millimetres (scaled by the denominator at paint time, like LineType__PatternMm) or in DRAWING millimetres (real site dimensions).**

- *Why it matters:* It is the difference between a hatch that looks identical at 1:500 and 1:1250 and one that is 2.5x coarser on the location plan. It also decides whether the generated geometry can be cached: Na__LeVp2d__BandPaths files path strings under `built.key + '@false@' + styleToken`, and built.key (Na__LeVp2d__SitePlanToken) contains NO scale. A pattern whose geometry depends on scale must not be cached under that key or a scale change will paint the old pattern.
- *Where to look:* Ask Adam. Precedent: Na__LayoutEditor__LineStyleTool__Config__.json -> Meta__WhereScaleGoes, and Na__LeDash__PatternMm. Cache: Na__LayoutEditor__Viewport2d__Linework__.js -> Na__LeVp2d__BandPaths / Na__LeVp2d__PathCache (16-entry FIFO shared with every architectural viewport).

**Whether Existing and Proposed stores publish the SAME Layer__CategoryKey values.**

- *Why it matters:* This single answer decides whether the two-store build is small or large. Distinct stems per store = Na__SpStore__LayerData, Viewport__ModelLayers, Viewport__ProjectedEdges and the owner table all keep working unchanged. Shared stems = every one of those needs a store-qualified composite key, plus a migration for existing sheets, plus a store id folded into Na__LeVp2d__SitePlanToken or the viewport will never repaint on a store switch.
- *Where to look:* Ask Adam / decide on the SketchUp side. Code affected: Na__SitePlan__Store__.js (Na__SpStore__LayerData keyed by bare categoryKey), Na__LayoutEditor__ModelLayers__.js (Na__LeModelLayers__IsOn), Na__LayoutEditor__SheetRecords__.js (Na__LeRec__SITEPLAN_CATEGORY_PREFIX), Na__LayoutEditor__Viewport2d__SitePlan__.js (Na__LeVp2d__SitePlanToken).

**Whether the PDF should print a hatch as real vectors or as a raster tile.**

- *Why it matters:* jsPDF's native tiling patterns are unusable here (beginTilingPattern / endTilingPattern / addShadingPattern all sit behind advancedApiModeTrap and throw outside doc.advancedAPI(), and the whole exporter runs in compat mode, y-down millimetres). Vectors mean the hatch must survive Na__LePdf__DrawLinework's minSegmentPaperMm cull (0.05 mm = 25 mm of site at 1:500). A raster must be a PNG data URL because this jsPDF build drops alpha on the 'RGBA' addImage path. Neither is a small decision and both change which function is written.
- *Where to look:* Na__LayoutEditor__PdfExporter__.js -> Na__LePdf__DrawSitePlanFills and Na__LePdf__DrawLinework; the working precedent is Na__LayoutEditor__GradientTool__.js -> Na__LeGrad__DrawPdf / Na__LeGrad__StripPng; jsPDF is vendored at 02__Src__AppModules\90__System__PageLayoutSystem\01__Dependencies__VersionLocked\jspdf.umd.js.

**Whether the app should be able to SAVE a generated hatch pack, or the library is read-only shipped content.**

- *Why it matters:* Read-only needs no Flask blueprint at all — plain GETs already work on localhost, a static server and the live site. Writeable needs a new blueprint beside ProjectVision__TrueVisionScrapbook__Api__.py, its registration in ProjectVision__LocalServer__Main__.py, and an 8090 restart by Adam before any route answers. It also needs the index to be server-rebuilt rather than hand-maintained.
- *Where to look:* Ask Adam. Precedent: D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__TrueVisionScrapbook__Api__.py (_rebuild_index, routes under /api/truevision/scrapbook) and Na__LayoutEditor__ScrapbookCustom__Transport__.js (ReadIndex: API on localhost, checked-in index everywhere else).

**What 03__Placeholder and 04__Placeholder in 52__LayoutEditor__HatchPatternLibrary are for.**

- *Why it matters:* All five pack folders are completely empty and nothing in the codebase references the folder name. The Custom Scrapbook's Library__CategoriesNote says 'Category__Folder must be a folder that exists: the server saves into the folders that are there and never makes one' — so an index/config that lists an unnamed, empty category will show an empty section in the panel. Naming them now is cheaper than renaming folders later.
- *Where to look:* Ask Adam. Folder: D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\52__LayoutEditor__HatchPatternLibrary (verified: 01__GeometricHatches, 02__ConstructionMaterialHatches, 03__Placeholder, 04__Placeholder, 05__SitePlanHatches, all empty, plus two reference PNGs).

**Whether the existing fill path has EVER been seen working by Adam.**

- *Why it matters:* Zero fills are painted in PS01 today (ExistingBuildings has a fill GLB but FillHex null; both Proposed layers have FillHex but no faces). Everything in this build sits on top of a code path with no working evidence behind it. Before any of it is designed, one layer needs a real fill drawn on screen and in a PDF, so screen-vs-paper hole behaviour and opacity are observed rather than assumed.
- *Where to look:* Give TrueVision__SitePlan__ExistingBuildings a SitePlan__FillColourId in the Tags SSOT, re-export, and open PS01 at http://127.0.0.1:8523/na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26 — the local manifest wins on 127.0.0.1, so no build or sync is needed.

**Whether a committed Node harness for the GLB parser should be part of this build.**

- *Why it matters:* Na__SitePlan__GlbParse__.js imports nothing (no three.js, no DOM, no network) precisely so a Node harness can import a copy, and its header says so. The Export Polygon Faces work is exactly the kind of change a harness protects, and there is no committed test for it — 80__Testing__PrototypeEnvironment holds Na__Verify__Exports__.mjs and Na__Verify__ModuleGraph__.mjs but no Na__Test__SitePlanGlbParse__.test.mjs.
- *Where to look:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\80__Testing__PrototypeEnvironment (existing test naming: Na__Test__<Thing>__.test.mjs); fixtures at na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData.

---

<a id="feasibility"></a>
## Cross-cutting findings: feasibility of each ask

### Findings

ALL LINE NUMBERS ARE POINTERS ONLY. Everything below was verified by reading the file or running the code, not inferred.

════════════════════════════════════════════════════════════════
1. THE END-TO-END TRACE OF ONE FIELD: LineWeightMm (8 hops, every function named)
════════════════════════════════════════════════════════════════
Worked example: 71__SitePlan__BaseMap__OsMapping, 0.13 mm.

HOP 1 - SSOT authoring.
  C:\Users\Administrator\AppData\Roaming\SketchUp\SketchUp 2026\SketchUp\Plugins\Na__Common__DataLib__CoreSuEntityStandards\Na__DataLib__CoreIndex__Tags__.json
  Na__DataLib__CoreIndex__Tags -> 71_75__SitePlanTags__ -> "71__SitePlan__BaseMap__OsMapping" -> "SitePlan__LineWeightMm" : 0.13  (pointer ~line 602)

HOP 2 - Ruby exporter, style hash.
  Na__TrueVision__GlbBuilder__SitePlanExport__.rb :: Na__SitePlan__BuildLayerDefinitions
  'LineWeightMm' => entry['SitePlan__LineWeightMm']   (pointer line 159). NO validation, NO clamp, NO type check. A string or a null passes straight through.

HOP 3 - Ruby exporter, manifest record.
  Na__SitePlan__Write, the records << {...} block: 'Layer__Style' => defn[:style]  (pointer line 663).
  VERIFIED ON DISK: PS01's manifest Layer__Style.LineWeightMm == 0.13.

HOP 4 - Python build script, whitelist copy.
  ProjectVision__BuildScript__.py :: discover_truevision_siteplan_store
  'Layer__Style' : entry.get('Layer__Style')  - copied WHOLE, unvalidated (pointer ~line 491). The whole Layer__Style object rides through, so NEW STYLE SUB-KEYS (a HatchId, a FillMaterialId) DO survive this hop. It is the per-layer TOP-LEVEL keys that are whitelisted, not the style block.

HOP 5 - TrueVision store, style normaliser (THIS is where a new style key dies).
  Na__SitePlan__Store__.js :: Na__SpStore__Style(raw)  (pointer line 215)
  LineWeightMm : num(style.LineWeightMm, 0.25)   (pointer line 223)
  Rebuilds exactly 7 keys. A HatchId added to the SSOT and carried faithfully through hops 2-4 is DELETED HERE.

HOP 6 - EdgeStyles default: millimetres become a FACTOR.
  Na__LayoutEditor__EdgeStyles__.js :: Na__LeEdge__SitePlanDefault(categoryKey)  (pointer line 363)
    weight = style.LineWeightMm / master, where master = Na__LeCfg__PtToMm(Na__LeCfg__GetLineweightSetup().viewportPt)
  VERIFIED: LayoutEditor__Lineweights__ViewportPt = 0.30 pt = 0.10584 mm, so 0.13 -> factor 1.228; 0.50 (red line) -> 4.724, which is exactly the "4.72 at the 0.30 pt master" the EdgeStyles config's Weight__Description cites.
  Then Na__LeEdge__Default -> Na__LeEdge__Effective(viewport, categoryKey)  (pointer line 411), which CLAMPS: Na__LeEdge__ClampWeight against Weight__Min 0.10 / Weight__Max 6.00 / Weight__Decimals 2.

HOP 7 - Band width.
  Na__LayoutEditor__Viewport2d__Linework__.js :: Na__LeVp2d__StrokeRules(viewport, masterPt) (pointer 207) gives
    base.widthMm = setup.visibleWidthMm * (PtToMm(sheet masterPt) / setup.visibleWidthMm) * vector = PtToMm(sheet masterPt) * Na__LeComposite__Factor(viewport,'projectedLinework')
  Then Na__LeVp2d__StyleBands's resolve(): widthMm = base.widthMm * effective.weight  (pointer ~271).

HOP 8 - The SVG attribute.
  Na__LayoutEditor__Viewport2d__SitePlan__.js :: Na__LeVp2d__PaintSitePlan
    stroke-width = band.widthMm * D, D = Na__LeVp2d__Window(viewport).Denominator.
  So 0.13 paper mm at 1:500 is written as stroke-width="65" into a viewBox measured in model millimetres.

════════════════════════════════════════════════════════════════
2. THE SURVEY MISSED THIS: THE COLOUR HOP IS AN ALIAS WHITELIST. THE MANIFEST HEX NEVER REACHES THE SVG.
════════════════════════════════════════════════════════════════
Every survey said "the style travels with the data". For the WEIGHT that is true. For the COLOUR it is not.

Na__LeEdge__SitePlanDefault does:
    colour : Na__LeEdge__AliasForHex(style.LineHex) || fall.colour
Na__LeEdge__AliasForHex (pointer line 345) looks the hex up in Na__LeEdge__Colours(), i.e. LayoutEditor__EdgeStyles__Colours in Na__LayoutEditor__EdgeStyles__Config__.json. Na__LeEdge__Effective then does hex : Na__LeEdge__Hex(colour), converting the alias BACK to a hex (pointer 289) - and Na__LeEdge__Hex falls back to Fallback__ColourAlias when the alias is unknown.

THAT PALETTE HAS EXACTLY NINE ROWS (verified, EdgeStyles config pointer lines 22-30):
  black #000000, soft-black #333333, dark-grey #666666, mid-dark-grey #737373,
  mid-grey #999999, light-grey #D9D9D9, red #E53935, green #43A047, blue #1E88E5

The EdgeMaterials SSOT has SIX MORE colours that are NOT in that list and therefore CANNOT be used by a new site plan tag:
  MTE105 #B4B4B4, MTE106 #CCCCCC, MTE108 #F2F2F2, MTE109 #FFFFFF, MTE203 Yellow #FDD835, MTE204 Purple #8E24AA

CONSEQUENCE FOR THE COMING BUILD: the brief adds waterbodies, mixed woodland, hedges, minor streets, minor features, neighbouring buildings, access and paths. Any of those given a colour outside the nine will paint BLACK (Fallback__ColourAlias is "black", Fallback__WeightFactor 1.00), silently, with a perfectly correct LineHex sitting in the manifest. The comparison is also case-normalised via toUpperCase, so case is not the hazard - absence is.
FIX POINT: add rows to LayoutEditor__EdgeStyles__Colours (Colour__Alias / Colour__Label / Colour__Hex / Colour__SsotKey / Colour__Note) IN THE SAME COMMIT as any new MTE the site plan tags reference. Colour__Alias is persisted in records, so pick it once.

════════════════════════════════════════════════════════════════
3. THE SURVEY MISSED THIS: THERE IS A HARD CEILING ON SITE PLAN LINE WEIGHT AT 0.635 mm
════════════════════════════════════════════════════════════════
Weight__Max = 6.00 (Na__LayoutEditor__EdgeStyles__Config__.json, LayoutEditor__EdgeStyles__Weight). The factor is LineWeightMm / 0.10584. So the maximum expressible SitePlan__LineWeightMm at the shipped 0.30 pt master is 6.00 x 0.10584 = 0.635 mm. Anything heavier is silently clamped by Na__LeEdge__ClampWeight and rounded to 2 dp.
The heaviest site plan weight today is 0.50 (red line) = 4.72, which is why nobody has hit it. An "OS mapping main roads" layer authored at 0.70 mm would print at 0.635 mm and nothing would say so. Weight__Min 0.10 sets a floor of 0.0106 mm, which is not a practical constraint.

════════════════════════════════════════════════════════════════
4. THE SURVEY GOT THE Z-INDEX PREMISE WRONG: LINEWORK PAINT ORDER IS BY STROKE WIDTH, NOT BY Layer__DrawOrder
════════════════════════════════════════════════════════════════
Every one of the nine areas said Layer__DrawOrder controls draw order and that a 1..10 Z-index re-expresses it. For FILLS that is true. For LINEWORK it is false.

Na__LayoutEditor__Viewport2d__Linework__.js :: Na__LeVp2d__StyleBands (pointer ~236-305), read in full:
  (a) resolve(ownerId) builds a style whose identity is key = effective.hex + '|' + round(widthMm,4) + '|' + dash.join(',')
  (b) segments are bucketed by THAT key
  (c) if buckets.size === 1, one band
  (d) otherwise: Array.from(buckets.values()).sort((a,b) => a.style.widthMm - b.style.widthMm).forEach(...)  <-- "HEAVIEST LAST INSIDE A CLASS"

So the painted order of site plan lines is ASCENDING STROKE WIDTH. Layer__DrawOrder decides only the order segments sit inside the concatenated classes.visible array (Na__LeVp2d__SitePlanBuild), which matters solely for ordering WITHIN one band. The red line appears on top because it is the heaviest (0.50), not because DrawOrder is 90.

TWO CONSEQUENCES:
  * A 1..10 Z-index wired to Layer__DrawOrder alone will not change what covers what for linework. To make a z-index real, Na__LeVp2d__StyleBands's width sort must become a z-order sort (and that function is shared with every architectural viewport, so it needs a site-plan-only branch or an explicit order field on the band).
  * BANDS MERGE. Two site plan layers with the same hex, the same weight and the same line type collapse into ONE <path> with no way to separate them. Today ProposedBuildings (0.35), ProposedBuildingsSecondary (0.25) and RedLineBoundary (0.50) are all red but differ in weight, so they survive as three. The new tags (main roads / minor streets / minor feature, all greyscale; woodland / hedges, both green) will collide the moment two share colour+weight+linetype. This compounds the "the SVG carries no identity" trap: it is not merely that paths lack a data- attribute, it is that the geometry of two layers is genuinely in one path string.

════════════════════════════════════════════════════════════════
5. GROUND TRUTH: PS01 PAINTS ZERO FILLS TODAY. THE FILL PATH IS UNEXERCISED.
════════════════════════════════════════════════════════════════
Folder listed: D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\
  5 linework GLBs, 1 fill GLB, 4 GlbBuilder__ExportLog__*.txt, 1 zero-byte .note, 1 manifest. Exported 2026-09-17T19:30:36Z, SitePlanData__TagsSsotVersion "2.3.0", SitePlanData__ExporterVersion "1.1.1", SchemaVersion 1, NorthAngleDeg 0.0.

I ran the REAL parser (Na__SitePlan__GlbParse__.js, copied to .mjs) over every GLB:
  ExistingBuildings__FillModel      modes=[2]  rings=1  [{face:0, outer:true, pts:5}]
  ExistingBuildings__LineworkModel  modes=[1]  segs=10
  OsMapping__LineworkModel          modes=[1]  segs=364
  ProposedBuildingsSecondary        modes=[1]  segs=394
  ProposedBuildings__LineworkModel  modes=[1]  segs=3
  RedLineBoundary__LineworkModel    modes=[1]  segs=14
  Every file's asset.extras carries {Na__SitePlanTag, Na__SitePlanStem}.

Now cross that against the fills filter in Na__LeVp2d__SitePlanBuild:
  .filter(d => d.rings.length > 0 && d.layer.Layer__Style.FillHex && Number.isFinite(FillOpacity) && FillOpacity > 0)

  ExistingBuildings           : rings = 1  BUT FillHex = null  -> DROPPED
  ProposedBuildings           : FillHex #E53935 @ 0.45  BUT rings = 0  -> DROPPED
  ProposedBuildingsSecondary  : FillHex #E53935 @ 0.20  BUT rings = 0  -> DROPPED
  OsMapping, RedLineBoundary  : neither -> DROPPED

NO SITE PLAN FILL HAS EVER BEEN PAINTED IN TRUEVISION. Confirmed in the SSOT: 73__SitePlan__Buildings__Existing has SitePlan__ExportFills true and SitePlan__FillColourId null (pointers ~733/737); the two Proposed tags have fill colours but their manifest Layer__Warnings say "no faces, so no fill; draw the outline as a closed face".
The single existing ring is a 5-point outer ring with no inner ring, so the fill-rule="evenodd" hole cutting (screen) and the ring.outer skip (PDF) have never been exercised against real data either. Treat every claim about how fills behave today as untested.

════════════════════════════════════════════════════════════════
6. A LAYER WITH FACES BUT NO EDGES EXPORTS NOTHING AT ALL
════════════════════════════════════════════════════════════════
Na__SitePlan__Write, the per-layer loop (pointer ~629):
    if bucket[:positions].empty?
        Na__Log__Warn "  [SitePlan] #{tag_name}: no visible edges - skipped"
        next
    end
The linework file is written unconditionally first; the fill file only when defn[:fills] && !bucket[:rings].empty?. So a woodland or waterbody polygon authored as a face whose boundary edges are SOFT or SMOOTH (both dropped by Na__SitePlan__Collect) yields: no linework, therefore no record, therefore no fill, therefore no manifest entry, therefore nothing in SitePlan__DataStore. The Export Polygon Faces work must move or relax this gate, or every face-only layer silently vanishes. Downstream reinforces it twice more: the build script does `if linework not in present: continue`, and Na__SpStore__Layer drops any layer with no linework URL.

════════════════════════════════════════════════════════════════
7. VALEVISION: THE SHARED FILES EXIST, THE SITE PLAN CODE DOES NOT. A COPY-PASTE PORT WILL BREAK IT.
════════════════════════════════════════════════════════════════
Repo: D:\06__Cloud__Repo__NaCodebase__Puiblic\ValeCodebase\WebApps\ValeVision3D
PRESENT (so a TrueVision edit to them creates a port obligation):
  51__System__LayoutEditor\25__System__RenderStyles\Na__LayoutEditor__RenderComposites__.js (+ __Config__.json, same 8 Composite__Key values: projectedLinework, profileLinework, sectionOutline, hiddenLines, glassOpaque, whitecard, enhanceWhitecard, baseImage)
  25__System__RenderStyles\Na__LayoutEditor__EdgeStyles__.js
  40__Ui__Panels\Na__LayoutEditor__PanelHost__.js
  10__Core__SheetSurface\Na__LayoutEditor__SheetChrome__.js
  07__Core__SheetData\Na__LayoutEditor__SheetRecords__.js
  07__Core__SheetData\Na__LayoutEditor__ScaleManager__.js
  35__System__DrawingTools\Na__LayoutEditor__GradientTool__.js
ABSENT: Na__LayoutEditor__Viewport2d__SitePlan__.js, the whole 52__System__SitePlanData folder, 36__System__HatchPatternTools, 52__LayoutEditor__HatchPatternLibrary.

CRITICAL: ValeVision's copies of EdgeStyles, SheetRecords and ScaleManager contain ZERO occurrences of "SitePlan", "sitePlan" or "SITEPLAN" (grepped all three, no hits). So VV has no Na__LeEdge__SITEPLAN_PREFIX, no Na__LeEdge__SitePlanDefault, no Na__LeRec__SITEPLAN_CATEGORY_PREFIX, no Na__LeRec__IsSitePlanViewport, and Na__LeScale__Coerce has no sitePlan argument. Whole-file copies of any of those four from TrueVision would import Na__SpStore__* symbols that do not exist in VV and fail Na__Verify__Exports__.mjs immediately. A hatch/composites port into VV is a surgical merge of the non-site-plan parts only.
The only "SitePlan" string anywhere in ValeVision is a comment in Na__LayoutEditor__PdfFilename__.js line 92 ('// "SITE PLAN" read SitePlan.') - a filename-slug note, not code.

════════════════════════════════════════════════════════════════
8. TESTS AND HARNESSES THAT MUST STILL PASS - AND THE ONE THAT CANNOT BE WRITTEN AS-IS
════════════════════════════════════════════════════════════════
80__Testing__PrototypeEnvironment holds, verified by listing:
  Na__Verify__Exports__.mjs        - RAN IT NOW: "385 files ... PASS", exit 0. Working tree is dirty with the v2.82-2.87 work and still passes.
  Na__Verify__ModuleGraph__.mjs
  Na__Test__CrossSheetClipboard__.test.cjs, Na__Test__DrawingDrafts__.test.mjs, Na__Test__DrawingPlanes__.test.mjs,
  Na__Test__FloorPlanStoreyLevel__.test.mjs, Na__Test__GroupMoveSnapping__.test.cjs, Na__Test__NorthCompass__.test.mjs,
  Na__Test__ProjectQr__.test.mjs (+ __Decode__.py), Na__Test__ScrapbookApi__.test.py, Na__Test__ScrapbookDrawingTitle__.test.mjs,
  Na__Test__ScrapbookScaleBar__.test.mjs, Na__Test__TitleBlockCells__.test.mjs, Na__Test__ViewportTitleText__.test.mjs
NONE of them touches the site plan. There is no site plan regression test of any kind.

BLOCKER FOR WRITING ONE: Na__SitePlan__GlbParse__.js cannot be imported by a .test.mjs directly. Node resolves a .js file in this tree as CommonJS (no package.json with "type":"module" anywhere under the app root), so `import { Na__SpGlb__ParseFill } from '.../Na__SitePlan__GlbParse__.js'` fails with "Named export not found ... is a CommonJS module". I got the probe working by copying the file to .mjs. Whoever writes Na__Test__SitePlanGlbParse__.test.mjs must read the source and re-export it, or copy it to a temp .mjs, exactly as I did - the module being import-free does not make it importable.

════════════════════════════════════════════════════════════════
9. VERSION DRIFT ALREADY ON DISK (three separate stale declarations)
════════════════════════════════════════════════════════════════
  Tags SSOT meta.version = "2.3.2", lastUpdated "18-Sep-2026". PS01's manifest was exported against "2.3.0". PS01 is two SSOT revisions behind; any comparison of PS01's data against the SSOT will show phantom differences until Adam re-exports.
  EdgeMaterials SSOT version = "2.1.0". Na__LayoutEditor__EdgeStyles__Config__.json declares Meta__SsotVersionRead "2.0.0" - STALE by one minor.
  Na__LayoutEditor__ModelLayers__Config__.json declares Meta__SsotVersionRead "2.3.2" - correct.
  Also inside EdgeMaterials: a SECOND nested "version" : "1.0.0" at pointer line 201 (the ConstructionLinework root's own meta). Do not mistake it for the file version.

════════════════════════════════════════════════════════════════
10. TWO MORE SINGLETON-STORE CONSUMERS NO SURVEY LISTED FOR THE EXISTING/PROPOSED WORK
════════════════════════════════════════════════════════════════
  Na__LayoutEditor__ModelSource__.js :: Na__LeSource__CategoryKeys(viewport) (pointer 191) - for a site plan viewport it returns Na__SpStore__GetLayers().map(l => l.Layer__CategoryKey) from the module singleton, with no store argument. This is THE function that decides which layers the Model Layers panel lists for a site plan viewport.
  Na__LayoutEditor__Panel__ModelLayers__.js - calls Na__LeModelLayers__Groups(Na__LeSource__CategoryKeys(viewport)) at pointer ~288 and again in the all-on/all-off patch at ~383.
  Na__LayoutEditor__ModelLayers__.js :: Na__LeModelLayers__Groups (pointer 242) - the site plan branch reads Na__SpStore__GetLayers() directly and only emits a row when the key is in the passed list, grouping by Layer__Group.
With two stores sharing category keys, all three collapse the two stores into one list and one set of toggles.

════════════════════════════════════════════════════════════════
11. WHAT SitePlan__DataStore ACTUALLY LOOKS LIKE ON DISK (the manifest and the store key are NOT the same shape)
════════════════════════════════════════════════════════════════
Verified by loading PS01's TrueVision__ProjectData__.json. Top-level keys, in order:
  projectCode, projectName, activeGroupIndex, modelGroups, Camera__DefaultPosition, SitePlan__DataStore, PresentationMode__SavedCameraScenes, Navmode__EnabledModes, OrbitHelperCube__Position, LayoutEditor__DrawingsData
SitePlan__DataStore has SIX keys: SitePlan__FolderName ("SitePlan__DrawingData"), SitePlan__ManifestUrl, SitePlan__ExportedIso, SitePlan__NorthAngleDeg, SitePlan__BoundsMm, SitePlan__Layers.
Each layer has ELEVEN keys and the manifest's Layer__RingCount and Layer__Warnings ARE DROPPED (the whitelist in discover_truevision_siteplan_store, pointer ~483-494). Layer__LineworkFile/Layer__FillFile become absolute Layer__LineworkUrl/Layer__FillUrl.
IMPORTANT NUANCE the surveys got half-right: Layer__Style is copied WHOLE (`entry.get('Layer__Style')`), so a new key inside the style block DOES survive the build script. It dies later, at Na__SpStore__Style. Only the per-layer top-level keys are whitelisted at the build script.

Dev-key lists confirmed verbatim - SitePlan__DataStore is in NEITHER, correctly:
  ProjectVision__BuildScript__.py :: TRUEVISION_DEV_OWNED_KEYS (pointer 74) = PresentationMode__SavedCameraScenes, Navmode__EnabledModes, Navmode__OrbitMaxDistanceMm, RenderEffect__AssetCullDistanceMm, Navmode__FovOverrides, Camera__DefaultPosition, OrbitHelperCube__Position, LayoutEditor__DrawingsData
  CloudflareR2__ModelSync__Main__.py :: DEV_OWNED_PROJECT_DATA_KEYS (pointer 115) = the identical eight.
GLB_FILE_PATTERN is `^.+\.glb$` (case-insensitive) in BOTH Python files - it is not restrictive, so a new face-mesh GLB file would be discovered and uploaded. It is SITEPLAN_FILE_PATTERN (build script pointer 60) that is restrictive, and it is used ONLY on the no-manifest fallback path.

════════════════════════════════════════════════════════════════
12. THE FIXTURES THAT ACTUALLY EXIST
════════════════════════════════════════════════════════════════
Scanned every project folder for 30__TrueVision__AppContent\SitePlan__DrawingData:
  26-Projects\AA00__ExampleProjectStructure  - 1 file (the zero-byte .note only). No GLBs, so discover_truevision_siteplan_store returns None and no key is written.
  26-Projects\PS01__MustersRoad              - 12 files (the real export).
  26-Projects\PS02__MustersRoad__OfficialPdPack - 12 files, byte-identical copies still named PS01__*.
  No other year folder (20- to 25-Projects) has one.
PS02 IS A GENUINELY USABLE SECOND FIXTURE, not merely misleading: its manifest still says SitePlanData__ProjectPrefix "PS01" and SourceModelFile "PS01_M10__SitePlanModel__0.1.0__.skp", but its built SitePlan__DataStore URLs correctly point at .../PS02__MustersRoad__OfficialPdPack/... . The filename prefix is decorative - only SITEPLAN_FILE_PATTERN's optional `(?:.*?__)?` group ever looks at it, and only on the fallback path. So PS02 already proves a store works with a foreign prefix.

════════════════════════════════════════════════════════════════
13. AN UNUSED IDENTITY CHANNEL THAT ALREADY EXISTS IN EVERY GLB
════════════════════════════════════════════════════════════════
Every PS01 GLB (linework AND fill) carries asset.extras = {"Na__SitePlanTag": "<SketchUp tag name>", "Na__SitePlanStem": "<stem>"} - written by Na__SitePlan__WriteLinework / Na__SitePlan__WriteFill, verified by parsing the files. Na__SpGlb__ReadContainer exposes it as container.json.asset.extras and NOTHING in TrueVision reads it. For the Existing/Proposed build this is a free self-identifying channel already in the bytes: a store could stamp asset.extras with its variant and the app could verify a layer against the store it thinks it loaded, instead of trusting the URL. Costs one line in Ruby and one read in Na__SpStore__LoadLayer.

════════════════════════════════════════════════════════════════
14. SCAFFOLDING - CONFIRMED EMPTY, EXACT CONTENTS
════════════════════════════════════════════════════════════════
  02__Src__AppModules\51__System__LayoutEditor\36__System__HatchPatternTools\  - completely empty, created 20-Sep-2026 13:02.
  52__LayoutEditor__HatchPatternLibrary\ - exactly two PNGs (OS_Symbol__Examples__.png, OS_Symbol__Examples__Woodland&Water__.png) and five EMPTY folders: 01__GeometricHatches, 02__ConstructionMaterialHatches, 03__Placeholder, 04__Placeholder, 05__SitePlanHatches. No JSON, no index.
  NOTE the "&" in OS_Symbol__Examples__Woodland&Water__.png - if that file is ever served by URL it must be percent-encoded; the ScrapbookCustom transport's FileUrl already encodeURIComponent's path parts, a hand-built URL would not.
  PWA_SW_VERSION_TOKEN is currently '2026-09-20-3' (TrueVision__Pwa__ServiceWorker__Logic__.js pointer 166). The service worker has PWA_SW_PATTERN_MODEL_GLB = /\.(glb|gltf)(\?.*)?$/i (pointer 179) and PWA_SW_REMOTE_ORIGIN_CDN (pointer 194) - so GLBs ARE classified (into the tv-models- bucket), contradicting the tv-store survey's claim that "the service worker does not cache GLBs at all (no .glb or cdn rule)". Check the actual caching branch before relying on ?v= alone for cache-busting.

### Contradictions found in the other surveys (these corrections WIN)

- tv-store survey says 'The service worker does not cache GLBs at all (no .glb or cdn rule in Na__Pwa__ServiceWorker__.js) - cache-busting rests entirely on the ?v= export time'. FALSE as stated: TrueVision__Pwa__ServiceWorker__Logic__.js defines PWA_SW_PATTERN_MODEL_GLB = /\.(glb|gltf)(\?.*)?$/i (pointer 179), PWA_SW_REMOTE_ORIGIN_CDN = 'https://cdn.noble-architecture.com' (pointer 194) and a tv-models- cache bucket. GLBs are classified by the worker. Whether they are STORED needs the fetch handler read, but the premise that no rule exists is wrong.

- Every survey (tv-store, tv-viewport, tv-sheetdata-pdf, glb-siteplan-export, pipeline, tv-svg-hatch-precedent) states that Layer__DrawOrder controls site plan draw order and that the 1..10 Z-index 're-expresses' it. For LINEWORK this is false. Na__LeVp2d__StyleBands sorts its buckets by ascending style.widthMm ('HEAVIEST LAST INSIDE A CLASS'), so stroke width decides what covers what. DrawOrder only orders segments inside the concatenated array and orders the fills. The red line is on top because it is 0.50 mm, not because DrawOrder is 90.

- ssot-tags survey says 'MTE103__LineColour__MediumDarkGrey__L50's SketchUpName is MTE103__LineColour__MediumDarkGrey__L45 - key and SketchUp name disagree' and implies MTE103 is one entry. There are TWO separate MTE103 entries in the SSOT: MTE103__LineColour__DarkGrey__L40 (#666666, name agrees) and MTE103__LineColour__MediumDarkGrey__L50 (#737373, name says L45). The site plan tags use the FIRST one. The duplicated numeric prefix is itself the hazard, not just the name mismatch.

- ssot-tags survey implies the six fill layers are the problem set and asks whether 'ExistingBuildings, HardSurfaces' should get colours. It understates the severity: because ExistingBuildings (the only layer that has ever produced a fill GLB) has FillColourId null, and the only two layers with fill colours produced no rings, PS01 renders ZERO fills. The fill rendering path has never run against real data at all.

- pipeline survey says 'discover_truevision_siteplan_store copies a closed list of keys. Every new manifest field is dropped unless explicitly added.' True for per-layer TOP-LEVEL keys and for the six store-level keys, but NOT for Layer__Style: the build script copies that object whole with entry.get('Layer__Style'). A new style sub-key survives the build script and dies one hop later at Na__SpStore__Style. That matters because it changes which file needs editing for a HatchId.

- tv-store survey lists the site plan consumers but omits Na__LayoutEditor__ModelSource__.js :: Na__LeSource__CategoryKeys, which is the function that feeds the Model Layers panel for a site plan viewport by calling the store singleton with no store argument. tv-composites-panels explicitly says 'this survey did not cover 52__System__SitePlanData's loader'. Between them the ModelSource seam is unowned.

- tv-conventions survey says 'The SSOT files under the SketchUp Plugins path were not read in this survey - their current versions need checking'. Checked: Tags SSOT is 2.3.2 (matches ModelLayers config's Meta__SsotVersionRead), EdgeMaterials SSOT is 2.1.0 but EdgeStyles config declares 2.0.0 - stale and needs bumping as part of this build.


### Gaps still open

**Whether the service worker actually STORES site plan GLBs in tv-models-, and what evicts them when a re-export keeps the same ExportedIso**

- *Why it matters:* If GLBs are cached and the ?v= token is the only buster, a re-export with an unchanged SitePlanData__ExportedIso serves stale geometry from the worker AND paints stale band paths from Na__LeVp2d__PathCache - two caches agreeing on the wrong answer, which reads as 'the exporter did nothing'.
- *Where to look:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\62__Feature__AppInstallability\TrueVision__Pwa__ServiceWorker__Logic__.js - the fetch handler branch that tests PWA_SW_PATTERN_MODEL_GLB and PWA_SW_REMOTE_ORIGIN_CDN (pointers 179 and 194), and the tv-models- bucket's eviction rule.

**What Na__LeVp2d__BandPaths does with band.indices for a merged multi-layer band, and whether a per-layer <g> can be introduced without changing the 16-entry FIFO path cache contract**

- *Why it matters:* The Patterns panel, the Render Composites dropdown and any per-layer toggle that works by hiding DOM need per-layer identity in the SVG. Because bands MERGE geometry from several layers into one path string, adding a data- attribute is not enough - the merge itself has to be suppressed for site plan viewports, and that changes the cache key shape.
- *Where to look:* D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\51__System__LayoutEditor\20__System__Viewports\Na__LayoutEditor__Viewport2d__Linework__.js :: Na__LeVp2d__BandPaths and Na__LeVp2d__PathCache (pointer ~338), plus Na__LeVp2d__ForgetPaths (~324).

**Whether the Model Layers all-on/all-off patch and Viewport__ModelLayers keying can tolerate two stores, read in the actual code rather than inferred**

- *Why it matters:* Viewport__ModelLayers stores only entries whose value is exactly false, keyed by bare Layer__CategoryKey. With Existing and Proposed publishing the same keys, one toggle switches both stores off, and Na__LeRec__NormaliseViewport will keep the ambiguous entry forever because site plan categories are exempt from pruning.
- *Where to look:* Na__LayoutEditor__Panel__ModelLayers__.js pointer ~383 (the patch loop), Na__LayoutEditor__ModelLayers__.js :: Na__LeModelLayers__IsOn / __Token / __HiddenKeys, and Na__LayoutEditor__SheetRecords__.js :: Na__LeRec__NormaliseViewport's Viewport__ModelLayers rebuild.

**Adam's actual intent on the three renames and on the Z-index scale - neither can be resolved from code**

- *Why it matters:* The site plan exporter keys layers by Tag__SketchUpName and has NO legacy-alias field (unlike the linetype exporter's Glb__LineworkLegacyTagNames), so a rename silently orphans geometry in PS01's and PS02's models. And because linework order is by stroke width, a 1..10 Z-index needs a painter change, not a field rename - the cost depends entirely on whether it replaces Layer__DrawOrder or sits beside it.
- *Where to look:* Ask Adam directly. The candidates by subject are 71__SitePlan__BaseMap__OsMapping, 75__SitePlan__SoftLandscape__Trees and 75__SitePlan__SoftLandscape__HedgesAndPlanting (stems TrueVision__SitePlan__OsMapping / __Trees / __HedgesAndPlanting, confirmed in the SSOT at pointers ~595, ~865, ~884).

**Whether the ProjectVision 8090 server is currently running and which site plan routes it answers**

- *Why it matters:* A hatch pattern library that needs a write route will answer 405 until Adam restarts 8090, and the transport layer is expected to distinguish 'restart it' from 'no server'. This also gates whether the pattern generator can save packs at all during the build.
- *Where to look:* OPTIONS against http://localhost:8090 and read the Allow header (never a test POST). Route registration is in D:\WE10_--_Public-Repo_--_Live-Website\na-apps\ProjectVision__LocalServer__Main__.py; the blueprint pattern to copy is ProjectVision__TrueVisionScrapbook__Api__.py.

**What the SketchUp model PS01_M10__SitePlanModel__0.1.0__.skp actually contains for the fill tags - are the proposal outlines closed faces or open loops**

- *Why it matters:* Both Proposed layers carry Layer__Warnings 'no faces, so no fill'. If the model has no closed faces at all, the Export Polygon Faces work has nothing to export from PS01 and will need new authoring in SketchUp before it can be tested end to end. This decides whether the build can be verified against a real project or needs a fixture built first.
- *Where to look:* The .skp itself (only openable in SketchUp - no Ruby interpreter on this PC), or the export logs already on disk: D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\PS01__MustersRoad\30__TrueVision__AppContent\SitePlan__DrawingData\GlbBuilder__ExportLog__2026-09-17_203036.txt, which records the per-layer face and skipped-edge counts.

---
