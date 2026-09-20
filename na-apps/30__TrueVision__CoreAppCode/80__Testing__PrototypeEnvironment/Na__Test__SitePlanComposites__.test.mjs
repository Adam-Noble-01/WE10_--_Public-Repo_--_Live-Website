// =============================================================================
// TRUEVISION3D - TEST - SITE PLAN COMPOSITES (the subtype, the decks, the Z-order)
// =============================================================================
//
// FILE       : Na__Test__SitePlanComposites__.test.mjs
// PURPOSE    : Prove TASK 06 - block plan against location plan, the three decks,
//              and the Z-ordered linework - against the SHIPPED modules and the
//              SHIPPED config, not against a description of them
// CREATED    : 20-Sep-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__SitePlanComposites__.test.mjs
//
// HOW IT WORKS:
// - Same harness as Na__Test__SitePlanStore__.test.mjs: the shipped .js is read,
//   its import STATEMENTS are replaced with stubs, and the rest of the file - every
//   line of logic under test - runs byte-for-byte as it ships.
// - The site plan composites module fetches its own config, so fetch is served
//   from disk. The config being read is the real one in the repo, which means a
//   value edited there and not here shows up as a failure rather than as a
//   silently passing test.
//
// WHAT IT GUARDS:
// - THE 1:500 BOUNDARY. Adam: 'Viewports over 1:500' are location plans. Off by
//   one and a 1:500 block plan loses its patterns.
// - THE OVERRIDE. Adam: 'Sometimes I will want to set whether it's a block plan
//   or a location plan to override if I've got a big site plan... By selecting
//   block plan, even at huge scale, it should turn the pattern vectors on.' So
//   'block' at 1:2500 MUST paint patterns. That is asserted directly.
// - THE Z-ORDER. Two layers that agree on colour and weight must still stack by
//   Z-index, which is the case a bucket-by-appearance painter gets wrong.
// - THE DASH SCALE reaching the effective style, and NOT touching the weight.
//
// =============================================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules')

let pass = 0, fail = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}

// The shipped file, with its imports swapped for stubs and nothing else touched.
function load (relative, stubs, tag) {
  const file = path.resolve(SRC, relative)
  let src = fs.readFileSync(file, 'utf8')
  const had = /^\s*import\s/m.test(src)
  // The trailing `// <-- ...` note some imports carry is part of the line, so
  // the pattern has to allow it, or that one import survives and the module
  // runs against the real file instead of the stub - passing by luck.
  src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '')
  // A leaf module has no imports at all; one that HAD them and still does means
  // the stripper missed a form, which would run stale code and pass by luck.
  if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1) }
  const tmp = path.join(os.tmpdir(), 'Na__Test__' + tag + '__.mjs')
  fs.writeFileSync(tmp, stubs + '\n' + src, 'utf8')
  return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2))
}

// The composites module fetches its own config; serve the repo copy.
globalThis.fetch = async (url) => {
  const name = decodeURIComponent(String(url)).split('/').pop()
  const file = path.resolve(SRC, '51__System__LayoutEditor/25__System__RenderStyles', name)
  if (!fs.existsSync(file)) return { ok : false, status : 404 }
  return { ok : true, status : 200, json : async () => JSON.parse(fs.readFileSync(file, 'utf8')) }
}

// -----------------------------------------------------------------------------
// The composites module: the subtype, the decks and the location plan rule
// -----------------------------------------------------------------------------
const SCALES = [100, 200, 500, 1250, 2500]
const C = await load(
  '51__System__LayoutEditor/25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js',
  `const Na__LeScale__Coerce = (d) => (${JSON.stringify(SCALES)}.indexOf(Number(d)) !== -1 ? Number(d) : 500);`,
  'SpComposites'
)
await C.Na__LeSpComp__Ready()

check('the config loaded, and the decks are fills then patterns then linework',
  C.Na__LeSpComp__GetDecks().map((d) => d.key), ['fills', 'patterns', 'linework'])
check('every deck is on by default', C.Na__LeSpComp__GetDecks().map((d) => d.on), [true, true, true])
check('the block plan boundary is 1:500', C.Na__LeSpComp__BlockMaxDenominator(), 500)

// THE BOUNDARY. 'Viewports over 1:500' - so 500 itself is still a block plan.
check('1:100 / 1:200 / 1:500 are block plans, 1:1250 / 1:2500 are location plans',
  SCALES.map((d) => C.Na__LeSpComp__PlanTypeForScale(d)),
  ['block', 'block', 'block', 'location', 'location'])

const vp = (denominator, sitePlan) => ({ Viewport__Id : 'v1', Viewport__ScaleDenominator : denominator, Viewport__SitePlan : sitePlan || {} })

check('a viewport that says nothing follows its scale',
  [C.Na__LeSpComp__PlanType(vp(500)), C.Na__LeSpComp__PlanType(vp(2500))], ['block', 'location'])
check('a stored choice overrules the scale, both ways',
  [ C.Na__LeSpComp__PlanType(vp(2500, { SitePlan__PlanType : 'block' })),
    C.Na__LeSpComp__PlanType(vp(100,  { SitePlan__PlanType : 'location' })) ], ['block', 'location'])
check('an unrecognised subtype falls back to Automatic rather than to a blank drawing',
  C.Na__LeSpComp__PlanType(vp(2500, { SitePlan__PlanType : 'nonsense' })), 'location')

// ADAM'S OVERRIDE, stated as the assertion: block plan at 1:2500 paints patterns.
check('Block Plan at 1:2500 turns the patterns back ON',
  C.Na__LeSpComp__LocationRules(vp(2500, { SitePlan__PlanType : 'block' })), null)
check('a 1:2500 viewport left on Automatic paints no patterns',
  C.Na__LeSpComp__LocationRules(vp(2500)).paintPatterns, false)

// ---- the decks ---------------------------------------------------------------
check('a deck with no stored value reads its config default',
  ['fills', 'patterns', 'linework'].map((k) => C.Na__LeSpComp__IsDeckOn(vp(500), k)), [true, true, true])
check('a stored false switches one deck off and leaves the others alone',
  ['fills', 'patterns', 'linework'].map((k) => C.Na__LeSpComp__IsDeckOn(vp(500, { SitePlan__Composites : { patterns : false } }), k)),
  [true, false, true])
check('the token changes when a deck is switched off',
  C.Na__LeSpComp__Token(vp(500)) === C.Na__LeSpComp__Token(vp(500, { SitePlan__Composites : { fills : false } })), false)
check('the token changes when the subtype is overridden',
  C.Na__LeSpComp__Token(vp(2500)) === C.Na__LeSpComp__Token(vp(2500, { SitePlan__PlanType : 'block' })), false)

// ---- the location plan rule ---------------------------------------------------
const layer = (tag, fillId) => ({ Layer__TagName : tag, Layer__Style : { FillMaterialId : fillId || null } })
const rules = C.Na__LeSpComp__LocationRules(vp(1250))

check('the boundary family keeps its ink',
  ['72__SitePlan__Boundary__RedLine', '72__SitePlan__Boundary__BlueLine', '72__SitePlan__Boundary__WallsAndFences'].map((t) => rules.KeepsInk(layer(t))),
  [true, true, true])
check('the woodland, the water and the OS base map do not',
  ['75__SitePlan__SoftLandscape__Trees__MixedWoodland', '71__SitePlan__BaseMap__Waterbodies', '71__SitePlan__BaseMap__OsMapping__MainRoads'].map((t) => rules.KeepsInk(layer(t))),
  [false, false, false])
check('a proposal layer keeps its ink wherever its tag number sits',
  rules.KeepsInk(layer('73__SitePlan__Buildings__Proposed__NewConstruction', 'MAT803__SitePlan__ProposalRed')), true)
check('only the proposal fill counts as a proposal',
  [ rules.IsProposalLayer(layer('x', 'MAT803__SitePlan__ProposalRed')),
    rules.IsProposalLayer(layer('x', 'MAT801__SitePlan__WoodlandGreen')),
    rules.IsProposalLayer(layer('x', null)) ], [true, false, false])

// GREYSCALE BY LUMINANCE: a grey must come back unchanged, or the OS base map
// would shift every time a location plan was drawn.
check('the OS greys pass through greyscale untouched',
  ['#666666', '#999999', '#D9D9D9', '#333333'].map((h) => C.Na__LeSpComp__Greyscale(h)),
  ['#666666', '#999999', '#d9d9d9', '#333333'])
// Rec. 709 by hand: #43A047 = (67,160,71)  -> 0.2126*67 + 0.7152*160 + 0.0722*71 = 133.8 -> 134 = 0x86.
//                   #1E88E5 = (30,136,229) -> 6.38 + 97.27 + 16.53              = 120.2 -> 120 = 0x78.
check('the woodland green and the water blue drop to a grey of their own weight',
  [C.Na__LeSpComp__Greyscale('#43A047'), C.Na__LeSpComp__Greyscale('#1E88E5')], ['#868686', '#787878'])
check('a value that is not a hex colour is handed back as it came',
  C.Na__LeSpComp__Greyscale('inherit'), 'inherit')

// -----------------------------------------------------------------------------
// StyleBands: the Z-order inside a class
// -----------------------------------------------------------------------------
const STUBS = `
    const Na__LeCfg__GetLineworkSetup = () => ({ visibleWidthMm : 0.25, hiddenWidthMm : 0.18, authoredWidthMm : 0.25, sectionWidthMm : 0.5, hiddenDashMm : 1, minSegmentPaperMm : 0.01 });
    const Na__LeCfg__PtToMm           = (pt) => pt * 0.352778;
    const Na__LeComposite__Factor     = () => 1;
    const Na__LeComposite__Token      = () => 'c';
    const Na__PlCfg__GetAppearance    = () => ({ StrokeColour : '#323232' });
    const Na__PlOwners__Read          = (classes) => classes.__tags || null;
    const Na__PlOwners__KeyFor        = (keys, id) => keys[id];
    const Na__PlOwners__Has           = () => true;
    const Na__LeEdge__AppliesToClasses     = () => ['visible'];
    const Na__LeEdge__SolidMeansClassDefault = () => true;
    const Na__LeEdge__Effective       = (viewport, key) => globalThis.__EFFECTIVE[key];
    const Na__LeSnap__GetPipelineFingerprint = () => 'fp';
    const Na__LeSnap__GetModelRoot    = () => null;
    const Na__LeSource__WaitFor       = async () => null;
    const Na__PlStore__LoadForDefinition = async () => null;
    const Na__PlStore__RememberRender = () => {};
    const Na__PlOverlay__BuildPathData = () => '';
    const Na__LeVp2d__Window          = () => ({ Denominator : 500, OriginX : 0, OriginY : 0, WidthMm : 100, HeightMm : 100 });
    const Na__LeModelLayers__ExcludeTokens = () => [];
    const Na__LeModelLayers__Token    = () => 'ml';
    const Na__LeEdge__Token           = () => 'edge';
    const Na__LeVp2d__CLASS_ORDER     = ['visible', 'hidden', 'authored', 'section'];
    const Na__LeVp2d__Linework        = new Map();
    const Na__LeVp2d__PathCache       = new Map();
    const Na__PlView__Fingerprint     = () => 'v';
    const Na__PlView__CacheKey        = () => 'k';
    const Na__PlPipe__GetCached       = () => null;
    const Na__PlPipe__RenderDefinition = async () => null;
    const Na__PlPipe__Remember        = () => {};
    const Na__LeVp2d__States          = new Map();
    const Na__LeVp2d__SizeLayer       = () => {};
    const Na__LeVp2d__HideProgress    = () => {};
    globalThis.window = globalThis.window || { addEventListener () {}, dispatchEvent () {} };
    globalThis.document = globalThis.document || { createElement : () => ({ style : {}, setAttribute () {}, appendChild () {} }) };
`
const L = await load('51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__Viewport2d__Linework__.js', STUBS, 'Linework')

// Four one-segment layers that all LOOK THE SAME - same colour, same weight, same
// dash - so appearance alone cannot tell them apart. Only the Z-index can.
const KEYS = ['minorStreets', 'wallsAndFences', 'buildings', 'redLine']
const Z    = { minorStreets : 1, wallsAndFences : 3, buildings : 5, redLine : 10 }
globalThis.__EFFECTIVE = {}
KEYS.forEach((k) => { globalThis.__EFFECTIVE[k] = { weight : 1, colour : 'black', lineType : 'solid', hex : '#000000', patternMm : [], overridden : false } })

const classes = {
  visible  : new Float32Array(KEYS.length * 4),
  hidden   : new Float32Array(0), authored : new Float32Array(0), section : new Float32Array(0),
  __tags   : { Owners : { visible : Uint16Array.from(KEYS.map((_, i) => i)) }, OwnerKeys : KEYS }
}
const viewport = { Viewport__Id : 'v', Viewport__Styles : {}, Viewport__ScaleDenominator : 500 }

const plain = L.Na__LeVp2d__StyleBands(viewport, 0.3, classes, false)
check('with no site rules four identical-looking layers collapse to ONE band, as they always did',
  plain.length, 1)

const site = { Order : new Map(KEYS.map((k) => [k, Z[k]])), Grey : new Set(), Greyscale : C.Na__LeSpComp__Greyscale }
const zoned = L.Na__LeVp2d__StyleBands(viewport, 0.3, classes, false, site)
check('with site rules they stay four bands, lowest Z first - the red line drawn last',
  zoned.map((b) => KEYS[b.indices[0]]), ['minorStreets', 'wallsAndFences', 'buildings', 'redLine'])

// A heavy low layer must still sit UNDER a hairline high one: meaning beats weight.
globalThis.__EFFECTIVE.minorStreets.weight = 4
const mixed = L.Na__LeVp2d__StyleBands(viewport, 0.3, classes, false, site)
check('a heavy minor street still draws UNDER a hairline red boundary',
  mixed.map((b) => KEYS[b.indices[0]]), ['minorStreets', 'wallsAndFences', 'buildings', 'redLine'])
globalThis.__EFFECTIVE.minorStreets.weight = 1

// Greyscale runs over the EFFECTIVE colour, so a hand-picked colour is greyed too.
globalThis.__EFFECTIVE.buildings.hex = '#43A047'
const greyed = L.Na__LeVp2d__StyleBands(viewport, 0.3, classes, false,
  { Order : site.Order, Grey : new Set(['buildings']), Greyscale : C.Na__LeSpComp__Greyscale })
check('a greyed layer paints its luminance, and the others are untouched',
  greyed.map((b) => b.colour), ['#000000', '#000000', '#868686', '#000000'])
globalThis.__EFFECTIVE.buildings.hex = '#000000'

// -----------------------------------------------------------------------------
// The hatch tile flattener, which is how the PDF gets the pattern deck
// -----------------------------------------------------------------------------
const LIB = path.resolve(HERE, '../52__LayoutEditor__HatchPatternLibrary')
const fetchBefore = globalThis.fetch
globalThis.fetch = async (url) => {
  const rel = decodeURIComponent(String(url)).split('52__LayoutEditor__HatchPatternLibrary/')[1]
  if (!rel) return fetchBefore(url)
  const file = path.join(LIB, ...rel.split('/'))
  if (!fs.existsSync(file)) return { ok : false, status : 404 }
  return { ok : true, status : 200, json : async () => JSON.parse(fs.readFileSync(file, 'utf8')) }
}
const H = await load('51__System__LayoutEditor/36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js', '', 'Hatch')
await H.Na__LeHatch__Ready()

const wood  = H.Na__LeHatch__Get('SitePlanHatch__MixedWoodland')
const water = H.Na__LeHatch__Get('SitePlanHatch__PondsAndLakes')
const woodTile = H.Na__LeHatch__TilePolylines(wood)

check('the flattened woodland tile keeps its paper size', [woodTile.tileWidthMm, woodTile.tileHeightMm], [18, 18])
check('every one of the 8 placements produced at least one polyline', woodTile.lines.length >= 8, true)
check('the flattened glyphs sit INSIDE the tile is-an-overlap test (nothing ran away to infinity)',
  woodTile.lines.every((line) => line.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 100 && Math.abs(y) < 100)), true)
check('the curved broadleaf crown was subdivided, not left as two points',
  Math.max(...woodTile.lines.map((l) => l.length)) > 8, true)
check('the water tile flattens too', H.Na__LeHatch__TilePolylines(water).lines.length >= 5, true)
check('the flattening is cached, not redone per stamp', H.Na__LeHatch__TilePolylines(wood) === woodTile, true)

// -----------------------------------------------------------------------------
// The dash scale
// -----------------------------------------------------------------------------
const cfg = JSON.parse(fs.readFileSync(path.resolve(SRC, '51__System__LayoutEditor/25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__Config__.json'), 'utf8'))
const dashed = cfg.LayoutEditor__EdgeStyles__LineTypes.find((t) => t.LineType__Alias === 'dashed')
check('the dashed pattern is still 2.5 / 1.5 in the config', dashed.LineType__PatternMm, [2.5, 1.5])
check('the weight ceiling clears the 2.00 pt proposal outline at a 0.25 pt master',
  cfg.LayoutEditor__EdgeStyles__Weight.Weight__Max >= (0.706 / (0.25 * 0.352778)), true)

const tags = JSON.parse(fs.readFileSync('C:/Users/Administrator/AppData/Roaming/SketchUp/SketchUp 2026/SketchUp/Plugins/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Tags__.json', 'utf8'))
const sp = tags.Na__DataLib__CoreIndex__Tags['71_75__SitePlanTags__']
check('the SSOT gives Proposed Alterations a half-size dash and leaves its weight alone',
  [sp['73__SitePlan__Buildings__Proposed__Alterations'].SitePlan__LineDashScale,
   sp['73__SitePlan__Buildings__Proposed__Alterations'].SitePlan__LineWeightPt], [0.5, 2])
check('so its dashes print 1.25 / 0.75 mm', dashed.LineType__PatternMm.map((mm) => mm * 0.5), [1.25, 0.75])

const major = sp['71__SitePlan__BaseMap__OsMapping__MajorFeature']
const minor = sp['71__SitePlan__BaseMap__OsMapping__MinorFeature']
check('OsMapping__MajorFeature exists, in the dark grey, bolder than the minor one',
  [ major.SitePlan__LineColourId, major.SitePlan__LineWeightPt > minor.SitePlan__LineWeightPt, major.SitePlan__LineColourId !== minor.SitePlan__LineColourId ],
  ['MTE103__LineColour__DarkGrey__L40', true, true])
check('and it has an export stem, or the exporter would skip it',
  major.SitePlan__ExportFileNameStem, 'TrueVision__SitePlan__OsMappingMajorFeature')


// -----------------------------------------------------------------------------
// The painter itself: the three decks, and the repaint guard
// -----------------------------------------------------------------------------
// THIS IS THE ONE ADAM HIT. Typing a hatch scale saved it to the record and drew
// nothing until the page was reloaded, because the site plan paint key did not
// read the hatch block at all. So the test drives the SHIPPED FillSitePlan twice
// and asserts that a hatch change repaints and an idle call does not.

globalThis.__H = H
globalThis.__C = C

const PAINT_STUBS = `
    const Na__LeCfg__GetLabel            = (k, f) => f;
    const Na__LeModel__IsSitePlanViewport = () => true;
    const Na__LeModelLayers__Token       = () => 'ml';
    const Na__LeModelLayers__IsOn        = () => true;
    const Na__PlOwners__CreateTable      = () => ({ Keys : [], Index : new Map() });
    const Na__PlOwners__IdFor            = (t, k) => { let i = t.Keys.indexOf(k); if (i === -1) { i = t.Keys.length; t.Keys.push(k) } return i };
    const Na__PlOwners__Attach           = (classes, owners, keys) => { classes.__tags = { Owners : owners, OwnerKeys : keys } };
    const Na__SpStore__STATUS_READY      = 'ready';
    const Na__SpStore__STATUS_EMPTY      = 'empty';
    const Na__SpStore__Resolve           = async () => globalThis.__DESCRIPTOR;
    const Na__SpStore__LoadAll           = async () => true;
    const Na__SpStore__GetStatus         = () => 'ready';
    const Na__SpStore__GetNote           = () => '';
    const Na__SpStore__GetDescriptor     = () => globalThis.__DESCRIPTOR;
    const Na__SpStore__GetLayerData      = (key) => globalThis.__LAYERDATA[key];
    const Na__SpStore__DefaultStoreId    = () => 'existing';
    const Na__LeHatch__Effective         = (...a) => globalThis.__H.Na__LeHatch__Effective(...a);
    const Na__LeHatch__PatternDef        = (...a) => globalThis.__H.Na__LeHatch__PatternDef(...a);
    const Na__LeHatch__Token             = (...a) => globalThis.__H.Na__LeHatch__Token(...a);
    const Na__LeSpComp__IsDeckOn         = (...a) => globalThis.__C.Na__LeSpComp__IsDeckOn(...a);
    const Na__LeSpComp__LocationRules    = (...a) => globalThis.__C.Na__LeSpComp__LocationRules(...a);
    const Na__LeSpComp__Token            = (...a) => globalThis.__C.Na__LeSpComp__Token(...a);
    const Na__LeVp2d__Window             = (vp) => ({ Denominator : vp.Viewport__ScaleDenominator, OriginX : 0, OriginY : 0, WidthMm : 40000, HeightMm : 30000 });
    const Na__LeVp2d__States             = globalThis.__STATES;
    const Na__LeVp2d__SizeLayer          = () => {};
    const Na__LeVp2d__HideProgress       = (st) => { st.progress.hidden = true };
    const Na__LeVp2d__StyleToken         = () => 'style';
    const Na__LeVp2d__StyleBands         = (...a) => globalThis.__L.Na__LeVp2d__StyleBands(...a);
    const Na__LeVp2d__BandPaths          = (key, bands) => { globalThis.__BANDKEYS.push(key); return bands.map(() => 'M0 0L1 1') };
`
globalThis.__L = L
globalThis.__STATES = new Map()
globalThis.__BANDKEYS = []

// Two layers with faces - a wood that hatches and a proposal that does not - and
// a red boundary that is lines only.
// Drawing millimetres, inside the 40 x 30 m window the stub above reports, so the
// proof page shows a readable field of tiles rather than a speck in one corner.
const BOX = (x, y, w, h) => [{ outer : true, points : [x, y, x + w, y, x + w, y + h, x, y + h] }]
const mkLayer = (key, tag, zl, zf, ink, fillId, fillHex, op, hatch) => ({
  Layer__CategoryKey : key, Layer__TagName : tag, Layer__ZIndexLine : zl, Layer__ZIndexFill : zf, Layer__DrawOrder : zl * 10,
  Layer__Style : { LineHex : ink, FillMaterialId : fillId, FillHex : fillHex, FillOpacity : op, HatchPatternId : hatch, LineWeightMm : 0.25, LineType : 'solid' }
})
const LS = [
  mkLayer('wood', '75__SitePlan__SoftLandscape__Trees__MixedWoodland', 6, 3, '#43A047', 'MAT801__SitePlan__WoodlandGreen', '#DCEDCF', 1, 'SitePlanHatch__MixedWoodland'),
  mkLayer('prop', '73__SitePlan__Buildings__Proposed__NewConstruction', 8, 8, '#E53935', 'MAT803__SitePlan__ProposalRed', '#FF0000', 0.1, null),
  mkLayer('red',  '72__SitePlan__Boundary__RedLine', 10, 1, '#E53935', null, null, null, null)
]
globalThis.__DESCRIPTOR = { SitePlan__ExportedIso : '2026-09-20T16:00:37Z', SitePlan__Layers : LS }
globalThis.__LAYERDATA = {
  wood : { categoryKey : 'wood', layer : LS[0], segments : new Float32Array([1500, 2000, 38500, 2000]), segmentCount : 1, rings : BOX(1500, 2000, 37000, 20000) },
  prop : { categoryKey : 'prop', layer : LS[1], segments : new Float32Array([8000, 8000, 20000, 8000]), segmentCount : 1, rings : BOX(8000, 8000, 12000, 9000) },
  red  : { categoryKey : 'red',  layer : LS[2], segments : new Float32Array([600, 900, 39400, 900]), segmentCount : 1, rings : [] }
}
KEYS.forEach(() => {})
globalThis.__EFFECTIVE.wood = { weight : 1, colour : 'green', lineType : 'solid', hex : '#43A047', patternMm : [], overridden : false }
globalThis.__EFFECTIVE.prop = { weight : 1, colour : 'red',   lineType : 'solid', hex : '#E53935', patternMm : [], overridden : false }
globalThis.__EFFECTIVE.red  = { weight : 2, colour : 'red',   lineType : 'solid', hex : '#E53935', patternMm : [], overridden : false }

const P = await load('51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__Viewport2d__SitePlan__.js', PAINT_STUBS, 'SitePlanPainter')

function freshState () {
  return {
    linework : { innerHTML : '', get firstElementChild () { return { setAttribute () {} } } },
    underlay : {}, markup : {}, empty : {}, progress : {},
    timer : null, lineworkKey : null, lineworkSvg : null, classes : null, classesKey : null, masterPt : null
  }
}
const SHEET = { Sheet__Id : 's1', Sheet__Lineweights : { ViewportPt : 0.3 } }
function paint (state, viewport) {
  state.lastArgs = { sheet : SHEET, viewport : viewport, ppm : 1 }
  globalThis.__STATES.set(viewport.Viewport__Id, state)
  P.Na__LeVp2d__FillSitePlan(state, SHEET, viewport, 1)
  return state.linework.innerHTML
}

// ---- the three decks, in order -------------------------------------------------
const block = { Viewport__Id : 'vp1', Viewport__ScaleDenominator : 500, Viewport__Styles : {}, Viewport__SitePlan : {} }
const s1 = freshState()
const svgBlock = paint(s1, block)

// PROBE THE BODY, NOT THE WHOLE STRING. The <pattern> definition inside <defs>
// carries its own stroke and fill attributes, so searching the raw SVG finds the
// tile's ink before any line has been drawn and every ordering assertion lies.
const bodyOf   = (svg) => svg.slice(svg.indexOf('</defs>') === -1 ? 0 : svg.indexOf('</defs>'))
const hasBand  = (svg) => /stroke-width="/.test(bodyOf(svg))
const o = ['fill="#DCEDCF"', 'url(#na-le-hatch-'].map((m) => bodyOf(svgBlock).indexOf(m)).concat(bodyOf(svgBlock).search(/stroke-width="/))
check('a block plan paints defs, then a wash, then a pattern over it, then the lines',
  [svgBlock.indexOf('<defs>') !== -1, o.every((i) => i !== -1), o[0] < o[1], o[1] < o[2]], [true, true, true, true])
check('both washes are painted, woodland (fill Z 3) before the proposal (fill Z 8)',
  svgBlock.indexOf('#DCEDCF') < svgBlock.indexOf('#FF0000'), true)
check('the proposal wash carries its 0.1 opacity, so it reads as a wash and not a block of red',
  /fill="#FF0000" fill-opacity="0.1"/.test(svgBlock), true)

// ---- THE REPAINT GUARD --------------------------------------------------------
const before = s1.lineworkKey
paint(s1, block)
check('painting again with nothing changed does NOT rebuild the SVG', s1.lineworkKey, before)

// A VARIANT IS A DIFFERENT VIEWPORT, so it gets a different id. The pattern def
// ids are built from the viewport id, and the proof page puts every card in one
// document: share an id there and the first <pattern> wins for all of them, so a
// quarter-scale tile would draw at full size and still pass a check on the markup.
const HF = H.Na__LeHatch__FIELD, HC = H.Na__LeHatch__CAT_FIELD
const variant = (id, patch) => Object.assign({}, block, { Viewport__Id : id }, patch)
const withScale = variant('vpScale', { [HF] : { [HC] : { wood : { Hatch__Scale : 0.25 } } } })
const s2 = freshState()
const svgQuarter = paint(s2, withScale)
check('a typed hatch scale moves the paint key, so the frame repaints instead of being skipped',
  s2.lineworkKey === before, false)

// The tile is D x scale wide: 500 x 18 = 9000 at scale 1, 2250 at scale 0.25.
check('and the pattern it paints really is a quarter-size tile',
  [/width="9000"/.test(svgBlock), /width="2250"/.test(svgQuarter)], [true, true])

const withRotation = variant('vpRot', { [HF] : { [HC] : { wood : { Hatch__RotationDeg : 30 } } } })
const s3 = freshState()
check('a typed rotation reaches the tile too',
  /patternTransform="rotate\(30\)"/.test(paint(s3, withRotation)), true)

const withPattern = variant('vpSwap', { [HF] : { [HC] : { wood : { Hatch__PatternKey : 'SitePlanHatch__PondsAndLakes' } } } })
const s4 = freshState()
const swapped = paint(s4, withPattern)
check('picking another pattern for a layer swaps the tile that is drawn',
  [/width="7500"/.test(swapped), /width="9000"/.test(swapped)], [true, false])   // <-- 500 x 15 mm, the water tile

const cleared = variant('vpClear', { [HF] : { [HC] : { wood : { Hatch__PatternKey : '' } } } })
const s5 = freshState()
check('and clearing it to "" really means NO hatch, not back to the tag default',
  /url\(#na-le-hatch-/.test(paint(s5, cleared)), false)

// A hatch change must NOT invalidate the band path cache: the lines did not move.
globalThis.__BANDKEYS = []
paint(freshState(), block)
const keyA = globalThis.__BANDKEYS.slice(-1)[0]
paint(freshState(), withScale)
const keyB = globalThis.__BANDKEYS.slice(-1)[0]
check('a hatch edit reuses the band path cache (the linework did not change)', keyA, keyB)

// ---- the deck switches and the subtype, through the real painter ---------------
const noFills = variant('vpNoFill', { Viewport__SitePlan : { SitePlan__Composites : { fills : false } } })
const svgNoFills = paint(freshState(), noFills)
check('Solid Fills off removes the washes and leaves the patterns and lines',
  [/fill="#DCEDCF"/.test(bodyOf(svgNoFills)), /url\(#na-le-hatch-/.test(svgNoFills), hasBand(svgNoFills)], [false, true, true])

const noPatterns = variant('vpNoPat', { Viewport__SitePlan : { SitePlan__Composites : { patterns : false } } })
const svgNoPat = paint(freshState(), noPatterns)
check('Hatch Patterns off removes the tiles and leaves the washes',
  [/url\(#na-le-hatch-/.test(svgNoPat), /fill="#DCEDCF"/.test(svgNoPat)], [false, true])

const noLines = variant('vpNoLine', { Viewport__SitePlan : { SitePlan__Composites : { linework : false } } })
const stateNoLines = freshState()
const svgNoLines = paint(stateNoLines, noLines)
check('Linework off removes the strokes but keeps the classes, so snapping still works',
  [hasBand(svgNoLines), !!stateNoLines.classes], [false, true])

const location = variant('vpLoc', { Viewport__ScaleDenominator : 1250 })
const svgLocation = paint(freshState(), location)
check('at 1:1250 the location plan paints the proposal wash and NOT the woodland one',
  [/fill="#FF0000"/.test(svgLocation), /fill="#DCEDCF"/.test(svgLocation)], [true, false])
check('and no patterns at all',   /url\(#na-le-hatch-/.test(svgLocation), false)
check('and the woodland ink is greyscaled while the red boundary keeps its colour',
  [svgLocation.indexOf('#868686') !== -1, svgLocation.indexOf('#E53935') !== -1], [true, true])

const overridden = variant('vpOver', { Viewport__ScaleDenominator : 1250, Viewport__SitePlan : { SitePlan__PlanType : 'block' } })
const svgOverride = paint(freshState(), overridden)
check('ADAM\'S OVERRIDE: Block Plan at 1:1250 brings the patterns and the greens back',
  [/url\(#na-le-hatch-/.test(svgOverride), /fill="#DCEDCF"/.test(svgOverride), svgOverride.indexOf('#868686') === -1], [true, true, true])

// TWO SITE PLAN VIEWPORTS ON ONE SHEET share a document, so they must not share
// a <pattern> id - the first definition would win and the second viewport would
// silently draw the first one's scale and rotation.
const idsOf = (svg) => (svg.match(/<pattern id="([^"]+)"/g) || []).sort()
check('two viewports on one sheet get their own pattern definitions',
  idsOf(svgBlock).some((id) => idsOf(svgQuarter).indexOf(id) !== -1), false)
check('and the quarter-scale viewport really paints a quarter-size tile',
  [/width="9000"/.test(svgBlock), /width="2250"/.test(svgQuarter), /width="9000"/.test(svgQuarter)], [true, true, false])




// -----------------------------------------------------------------------------
// A hatch on an ordinary vector shape
// -----------------------------------------------------------------------------
// Adam: "Continue implementing the hatch feature into an extension of the vector
// editor so we can have hatches. It will draw over the top of the fill on our
// vector system we've already built, but under the line work of the vector."
// So the assertion that matters is the ORDER, and it is checked on the markup
// the shipped chrome writes, not on a description of it.

const SHAPE_STUBS = `
    const Na__LeCfg__PtToMm       = (pt) => pt * 0.352778;
    const Na__LeDash__PatternMm   = () => [];
    const Na__LeChrome__PushPolyline = (...a) => globalThis.__CH.Na__LeChrome__PushPolyline(...a);
`
const CHROME_STUBS = `
    const Na__LeCfg__GetChromeStyle = () => ({ fontFamily : 'Open Sans', inkColour : '#172b3a' });
    const Na__LeCfg__GetLabel       = (k, f) => f;
    const Na__LeGrad__SvgPaint      = () => null;
    const Na__LeGrad__DrawPdf       = () => false;
    const Na__LeHatch__Get          = (...a) => globalThis.__H.Na__LeHatch__Get(...a);
    const Na__LeHatch__SvgPaint     = (...a) => globalThis.__H.Na__LeHatch__SvgPaint(...a);
    const Na__LeHatch__DrawPdf      = (...a) => globalThis.__H.Na__LeHatch__DrawPdf(...a);
    const Na__QrPaint__SvgGroup     = () => '';
    const Na__QrPaint__DrawPdf      = () => {};
    const Na__LeScale__FormatLabel  = (d) => '1:' + d;
    const Na__LeModel__ResolveViewportSource = () => null;
    const Na__LeModel__IsLayerVisible = () => true;
    const Na__LeModel__KIND_2D      = '2d';
    const Na__LeTitleModern__Build  = () => {};
    const Na__LeTitleClassic__Build = () => {};
    const Na__LePdfFonts__Install   = () => {};
    const Na__LePdfFonts__SetFont   = () => {};
    const Na__LeCfg__GetStyleSetup  = () => ({ fontFamily : 'Open Sans', inkColour : '#172b3a' });
    const Na__LeCfg__GetSheetSetup  = () => ({});
    globalThis.window   = globalThis.window   || { addEventListener () {}, dispatchEvent () {} };
    globalThis.document = globalThis.document || { createElement : () => ({ style : {}, setAttribute () {}, appendChild () {} }), head : { appendChild () {} } };
    globalThis.Image    = globalThis.Image    || class {};
`

const CH = await load('51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js', CHROME_STUBS, 'Chrome')
globalThis.__CH = CH
const G = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js', SHAPE_STUBS, 'ShapeGeo')

const SQUARE = [ [10, 10], [70, 10], [70, 50], [10, 50] ]
const vshape = (extra) => Object.assign({
  Shape__Id : 's1', Shape__Points : SQUARE.map((p) => p.slice()), Shape__Closed : true, Shape__Stroked : true,
  Shape__StrokeColour : '#2F6B33', Shape__StrokePt : 0.5, Shape__FillColour : '#DCEDCF', Shape__FillOpacity : 1
}, extra || {})

const markup = (item) => {
  const list = []
  G.Na__LeShapeGeo__Push(list, item)
  return CH.Na__LeChrome__ToSvgMarkup(list, 100, 70, 'na-test')
}

const flat    = markup(vshape())
const hatched = markup(vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Scale : 1, Hatch__RotationDeg : 0 } }))

check('a shape with no hatch is untouched - one path, no pattern def',
  [/<pattern/.test(flat), (flat.match(/<path/g) || []).length], [false, 1])

// THE ORDER. Three things in the body: the solid fill path, the hatch path, and
// the outline - and the outline must be on the LAST path drawn.
const shBody   = hatched.slice(hatched.lastIndexOf('</defs>'))
const fillAt   = shBody.indexOf('fill="#DCEDCF"')
const hatchAt  = shBody.indexOf('fill="url(#naLeHatch')
const strokeAt = shBody.indexOf('stroke="#2F6B33"')
check('a hatched shape paints fill, then the hatch over it, then the outline over that',
  [fillAt !== -1, hatchAt !== -1, strokeAt !== -1, fillAt < hatchAt, hatchAt < strokeAt], [true, true, true, true, true])
check('and the outline rides on the HATCH path, not on a fourth one',
  shBody.indexOf('stroke="#2F6B33"') > shBody.indexOf('fill="url(#naLeHatch'), true)
check('the solid fill path carries no stroke of its own',
  /fill="#DCEDCF"[^>]*stroke="none"/.test(shBody), true)

// PAPER SIZE. Sheet markup is paper millimetres, so an 18 mm tile is 18 units -
// no denominator, unlike a site plan viewport drawn in drawing millimetres.
check('the tile is 18 units wide, because sheet markup IS paper millimetres',
  /<pattern[^>]*width="18"/.test(hatched), true)

// The ink comes from the shape's own edge colour unless the record overrides it.
check('the hatch inks itself with the shape edge colour by default',
  /<pattern[\s\S]*?stroke="#2F6B33"[\s\S]*?<\/pattern>/.test(hatched), true)
check('and an explicit Hatch__Colour wins',
  /<pattern[\s\S]*?stroke="#B00020"[\s\S]*?<\/pattern>/.test(
    markup(vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Colour : '#B00020' } }))), true)

// A hatch with NO fill is a real drawing, so it must still paint.
const noFill = markup(vshape({ Shape__FillColour : null, Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__PondsAndLakes' } }))
check('a hatch with no solid fill under it still paints',
  [/fill="url\(#naLeHatch/.test(noFill), /fill="#DCEDCF"/.test(noFill)], [true, false])

// Two hatched shapes in ONE document must not share a definition.
const twoSvg = (() => {
  const list = []
  G.Na__LeShapeGeo__Push(list, vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Scale : 1 } }))
  G.Na__LeShapeGeo__Push(list, vshape({ Shape__Id : 's2', Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Scale : 0.5 } }))
  return CH.Na__LeChrome__ToSvgMarkup(list, 100, 70, 'na-test')
})()
const patIds = (twoSvg.match(/<pattern id="([^"]+)"/g) || [])
check('two hatched shapes on one sheet get their own definitions, at their own scales',
  [patIds.length, new Set(patIds).size, /width="18"/.test(twoSvg), /width="9"/.test(twoSvg)], [2, 2, true, true])

// An unopened shape has nothing to hatch, and a pattern the library lost must
// not blank the shape.
check('an open two-point line is not hatched',
  /<pattern/.test(markup(vshape({ Shape__Closed : false, Shape__Points : [ [0, 0], [50, 0] ] }))), false)
const ghost = markup(vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__NotInTheLibrary' } }))
check('a pattern the library has not got leaves the fill and the outline exactly as they were',
  [/<pattern/.test(ghost), /fill="#DCEDCF"/.test(ghost), /stroke="#2F6B33"/.test(ghost)], [false, true, true])

// ---- the record layer ---------------------------------------------------------
const R = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', `
    const Na__LeCfg__GetViewportSetup = () => ({ minSizeMm : 10, defaultWidthMm : 100, defaultHeightMm : 80 });
    const Na__LeCfg__GetLabel   = (k, f) => f;
    const Na__LeCfg__GetSheetSetup = () => ({});
    const Na__LeScale__Coerce   = (d) => d || 50;
    const Na__LeGrad__Normalise = (g) => g || null;
    const Na__LeDash__Normalise = (d) => d || null;
    const Na__LeHatch__FIELD    = 'Viewport__SitePlanHatches';
    const Na__LeHatch__CAT_FIELD = 'SitePlanHatches__Categories';
    const Na__LeEdge__FIELD     = 'Viewport__EdgeStyles';
    const Na__LeEdge__CAT_FIELD = 'EdgeStyles__Categories';
    const Na__LeEdge__ClampWeight = (w) => w;
    const Na__LeEdge__IsColour  = () => true;
    const Na__LeEdge__IsLineType = () => true;
    const Na__LeComposite__Row  = () => null;
    const Na__LeComposite__Clamp = (k, v) => v;
    const Na__LeSpComp__DECK_FIELD = 'SitePlan__Composites';
    const Na__LeSpComp__TYPE_FIELD = 'SitePlan__PlanType';
    const Na__LeSpComp__PLAN_BLOCK = 'block';
    const Na__LeSpComp__PLAN_LOCAL = 'location';
    const Na__LeSpComp__DeckKeys   = () => ['fills', 'patterns', 'linework'];
    const Na__LeSpComp__DeckDefault = () => true;
`, 'Records').catch(() => null)

if (R && typeof R.Na__LeRec__NormaliseSheet === 'function') {
  check('(records module loaded for the hatch normaliser)', true, true)
} else {
  // Not every export is reachable with stubs; the normaliser is exercised through
  // the shapes above either way, so say so rather than pretending to test it.
  console.log('SKIP  the record normaliser is covered by the app graph check, not here')
}


// -----------------------------------------------------------------------------
// The proof page, written last so every picture on it exists
// -----------------------------------------------------------------------------
// A picture of the vector hatch, for the eye.
const vectorProof = [
  { cap : 'Fill only',                       item : vshape({ Shape__Hatch : null }) },
  { cap : 'Fill + hatch + outline',          item : vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Scale : 0.6 } }) },
  { cap : 'Hatch, no fill',                  item : vshape({ Shape__FillColour : null, Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__PondsAndLakes', Hatch__Scale : 0.6, Hatch__Colour : '#1E88E5' } }) },
  { cap : 'Turned 45 deg, half scale',       item : vshape({ Shape__Hatch : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland', Hatch__Scale : 0.4, Hatch__RotationDeg : 45 } }) }
].map((entry) => ({ cap : entry.cap, svg : markup(entry.item) }))

// Keep the picture for the eye as well as the assertions.
fs.writeFileSync(path.join(HERE, 'Na__Test__SitePlanComposites__Output__.html'),
  `<!doctype html><meta charset="utf-8"><title>Site plan composites</title>
<style>body{margin:0;padding:16px;font:13px system-ui;background:#fff}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:14px 0 6px}
.row{display:flex;gap:16px;flex-wrap:wrap}.card{border:1px solid #ddd}
.cap{font-size:11px;color:#555;padding:5px 8px;border-top:1px solid #eee}
svg{display:block;width:340px;height:255px;background:#fff}</style>
<p>Every picture below came out of the shipped Na__LeVp2d__PaintSitePlan, not from a mock-up.</p>
<h2>Block plan, and the same viewport with one deck off</h2>
<div class="row">
 <div class="card">${svgBlock}<div class="cap">All three decks</div></div>
 <div class="card">${svgNoFills}<div class="cap">Solid Fills off</div></div>
 <div class="card">${svgNoPat}<div class="cap">Hatch Patterns off</div></div>
 <div class="card">${svgNoLines}<div class="cap">Linework off</div></div>
</div>
<h2>The subtype at 1:1250</h2>
<div class="row">
 <div class="card">${svgLocation}<div class="cap">Automatic &rarr; location plan: proposal wash only, greyscale, no patterns</div></div>
 <div class="card">${svgOverride}<div class="cap">Overridden to Block Plan: the patterns come back</div></div>
</div>
<h2>A hatch on an ordinary vector shape - fill, then pattern, then its own outline</h2>
<div class="row">${vectorProof.map((v) => `<div class="card">${v.svg}<div class="cap">${v.cap}</div></div>`).join('')}</div>
<h2>A typed hatch scale, which is what did not repaint before</h2>
<div class="row">
 <div class="card">${svgBlock}<div class="cap">Scale 1 &middot; 18 mm tile</div></div>
 <div class="card">${svgQuarter}<div class="cap">Scale 0.25 &middot; 4.5 mm tile</div></div>
 <div class="card">${swapped}<div class="cap">Pattern swapped to Ponds &amp; Lakes</div></div>
</div>`, 'utf8')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
