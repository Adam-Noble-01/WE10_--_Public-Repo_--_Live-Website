// =============================================================================
// TRUEVISION3D - TEST - SITE PLAN COMPOSITES (the subtype, the decks, the Z-order)
// =============================================================================
//
// FILE       : Na__Test__SitePlanComposites__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Site Plan Composites Test
// AUTHOR     : Adam Noble - Noble Architecture
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
// - The SketchUp SSOT (Tags, Materials, Edge Materials) is read where the
//   plugin installs it, under the signed-in user's APPDATA, so the PC that
//   runs this needs Na__Common__DataLib__CoreSuEntityStandards installed.
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
// - A PATTERN'S OWN INK (21-Sep-2026). Grass tufts stay green on the grey-edged
//   Grassland layer, and an inheriting pattern still takes its layer's colour.
// - THE SEAM. No glyph in any library pattern is cut at a tile edge without its
//   other half across it - the browser clips a <pattern>, the PDF does not.
// - THE SSOT AGAINST THE LIBRARY. Every hatch id and face material a site plan tag
//   names really exists. The SSOT is in another repository, so nothing else would
//   notice a typo until a wash or a hatch silently failed to paint.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.1
// - The three SSOT files were read from C:/Users/Administrator, one PC's
//   user folder, so on the other PC the file stopped at the first of them.
//   They are now found under APPDATA (the user's AppData/Roaming where that
//   is not set), which names the right user folder on either machine.
//
// 20-Sep-2026 - Version 1.0.0
// - Written with the site plan composites (TASK 06). The checks added since
//   carry their dates in the comments above them; there was no log before
//   1.0.1.
//
// =============================================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules')

// The SketchUp SSOT is installed under the signed-in user's Roaming AppData, and
// the studio's two PCs have different user folders, so it is found from APPDATA
// and never written out for one of them.
const SSOT = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'),
  'SketchUp/SketchUp 2026/SketchUp/Plugins/Na__Common__DataLib__CoreSuEntityStandards')

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
    const Na__LeModelLayers__IsOn     = () => true;                             // <-- StyleBands has asked per owner since the linework modifiers (62dade1); without it this whole test died at load
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

// ---- the grass patterns (21-Sep-2026) --------------------------------------------
// Adam: "Build out the grassland and rough grassland materials". Both load through
// the shipped loader and both carry their OWN ink: their tags draw grey OS edges,
// so an inherited ink would paint grey grass.
const grass = H.Na__LeHatch__Get('SitePlanHatch__Grassland')
const rough = H.Na__LeHatch__Get('SitePlanHatch__RoughGrassland')
const sitePack = H.Na__LeHatch__GetPacks().find((pk) => pk.Pack__Key === 'SitePlanHatches')
check('Grassland and Rough Grassland load from the site plan pack, after the first two',
  sitePack.Pack__Patterns.map((p) => p.Pattern__Key),
  ['SitePlanHatch__MixedWoodland', 'SitePlanHatch__PondsAndLakes', 'SitePlanHatch__Grassland', 'SitePlanHatch__RoughGrassland'])
check('their tiles keep their paper size',
  [grass.Pattern__TileWidthMm, grass.Pattern__TileHeightMm, rough.Pattern__TileWidthMm, rough.Pattern__TileHeightMm], [28, 26, 32, 30])
check('every placement found its glyph (10 tufts, and 9 in two shapes)',
  [grass.Pattern__Marks.length, rough.Pattern__Marks.length, new Set(rough.Pattern__Marks.map((m) => m.Mark__Glyph.Glyph__Name)).size], [10, 9, 2])
check('a pattern that names a hex carries it as its own ink, and "inherit" parses to null',
  [grass.Pattern__Ink, rough.Pattern__Ink, wood.Pattern__Ink, water.Pattern__Ink], ['#43A047', '#43A047', null, null])

// One mark's flattened centreline box, through the SHIPPED flattener: a throwaway
// pattern holding that mark alone.
const markBox = (pattern, mark) => {
  const flat = H.Na__LeHatch__TilePolylines({ Pattern__Marks : [mark], Pattern__TileWidthMm : pattern.Pattern__TileWidthMm,
    Pattern__TileHeightMm : pattern.Pattern__TileHeightMm, Pattern__StrokeMm : pattern.Pattern__StrokeMm, Pattern__Opacity : 1 })
  const pts = flat.lines.flat()
  return { minX : Math.min(...pts.map((p) => p[0])), maxX : Math.max(...pts.map((p) => p[0])),
           minY : Math.min(...pts.map((p) => p[1])), maxY : Math.max(...pts.map((p) => p[1])) }
}
const tallest = (pattern) => Math.max(...pattern.Pattern__Marks.map((m) => { const b = markBox(pattern, m); return b.maxY - b.minY }))
check('a rough tuft stands taller than a grass tuft, so the two read apart at a glance',
  tallest(rough) > tallest(grass) * 1.2, true)

// THE SEAM GUARD, over EVERY pattern in the library. A browser clips a <pattern> at
// its tile edge; the PDF stamper does not. So a glyph crossing the seam must have its
// other half one tile away - then screen and paper agree - or it is cut on screen and
// whole on paper. Mixed Woodland shipped that way: one conifer reached 0.55 mm past
// the right edge and lost its three right-hand arms in every wood on screen. Checked
// on the centreline; a round cap a tenth of a millimetre over the edge is invisible.
const seamCuts = []
H.Na__LeHatch__GetPacks().forEach((pk) => pk.Pack__Patterns.forEach((p) => {
  const W = p.Pattern__TileWidthMm, TH = p.Pattern__TileHeightMm, eps = 1e-6
  const has = (m, dx, dy) => p.Pattern__Marks.some((o) => o.Mark__Glyph === m.Mark__Glyph
    && Math.abs(o.Mark__XMm - (m.Mark__XMm + dx)) < eps && Math.abs(o.Mark__YMm - (m.Mark__YMm + dy)) < eps)
  p.Pattern__Marks.forEach((m) => {
    const b = markBox(p, m)
    const needs = []
    if (b.minX < -eps)     needs.push([W, 0])
    if (b.maxX > W + eps)  needs.push([-W, 0])
    if (b.minY < -eps)     needs.push([0, TH])
    if (b.maxY > TH + eps) needs.push([0, -TH])
    needs.forEach(([dx, dy]) => { if (!has(m, dx, dy)) seamCuts.push(`${p.Pattern__Key} ${m.Mark__Glyph.Glyph__Name} at ${m.Mark__XMm},${m.Mark__YMm}`) })
  })
}))
check('no glyph in any pattern is cut at a tile seam without its other half across it', seamCuts, [])

// -----------------------------------------------------------------------------
// The dash scale
// -----------------------------------------------------------------------------
const cfg = JSON.parse(fs.readFileSync(path.resolve(SRC, '51__System__LayoutEditor/25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__Config__.json'), 'utf8'))
const dashed = cfg.LayoutEditor__EdgeStyles__LineTypes.find((t) => t.LineType__Alias === 'dashed')
check('the dashed pattern is still 2.5 / 1.5 in the config', dashed.LineType__PatternMm, [2.5, 1.5])
check('the weight ceiling clears the 2.00 pt proposal outline at a 0.25 pt master',
  cfg.LayoutEditor__EdgeStyles__Weight.Weight__Max >= (0.706 / (0.25 * 0.352778)), true)

const tags = JSON.parse(fs.readFileSync(path.join(SSOT, 'Na__DataLib__CoreIndex__Tags__.json'), 'utf8'))
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

// ---- the grass and hard standing tags (21-Sep-2026), against the SSOT AND the library
// Adam: "Find the SSOT and add new tags and materials for those as well... If there is
// a hard standing tag, make a material so I can make the driveway a very light grey."
// The SSOT lives in another repository, so these are the checks that catch a hatch id
// or a MAT id that names nothing - which paints no hatch, or no wash, and says nothing.
const matsDoc = JSON.parse(fs.readFileSync(path.join(SSOT, 'Na__DataLib__CoreIndex__Materials__.json'), 'utf8'))
const matById = {}
Object.values(matsDoc.Na__DataLib__CoreIndex__Materials).forEach((series) => Object.entries(series).forEach(([k, v]) => { matById[k] = v }))
const rgbOf = (id) => (matById[id] && /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(matById[id].BaseColor)) ? matById[id].BaseColor.replace(/\s+/g, '') : null
const GRASS_TAG = sp['75__SitePlan__SoftLandscape__Grassland']
const ROUGH_TAG = sp['75__SitePlan__SoftLandscape__RoughGrassland']
const osGeneral = sp['71__SitePlan__BaseMap__OsMapping__General']
const lineOf = (t) => [t.SitePlan__LineColourId, t.SitePlan__LineType, t.SitePlan__LineWeightPt, t.SitePlan__LineWeightMm, t.SitePlan__ZIndexLine]
check('Grassland and Rough Grassland are site plan tags with stems of their own',
  [GRASS_TAG && GRASS_TAG.SitePlan__ExportFileNameStem, ROUGH_TAG && ROUGH_TAG.SitePlan__ExportFileNameStem],
  ['TrueVision__SitePlan__Grassland', 'TrueVision__SitePlan__RoughGrassland'])
check('their edges draw EXACTLY like the OS base map, so a field traced over its OS boundary merges into the same line',
  [lineOf(GRASS_TAG), lineOf(ROUGH_TAG)], [lineOf(osGeneral), lineOf(osGeneral)])
check('they export faces, opaque, at the bottom of the fill stack (fill Z 1)',
  [GRASS_TAG, ROUGH_TAG].map((t) => [t.SitePlan__ExportFills, t.SitePlan__FillOpacity, t.SitePlan__ZIndexFill]), [[true, 1, 1], [true, 1, 1]])
check('every other wash sits above grass, so a drive or a wood painted over a field wins',
  Object.values(sp).filter((t) => t && t.SitePlan__ExportFills === true && t !== GRASS_TAG && t !== ROUGH_TAG).every((t) => t.SitePlan__ZIndexFill > 1), true)
check('each names a hatch the library really has, and a face material the Materials SSOT really has',
  [ !!H.Na__LeHatch__Get(GRASS_TAG.SitePlan__FillHatchId), !!H.Na__LeHatch__Get(ROUGH_TAG.SitePlan__FillHatchId),
    rgbOf(GRASS_TAG.SitePlan__FillMaterialId), rgbOf(ROUGH_TAG.SitePlan__FillMaterialId) ],
  [true, true, 'rgb(229,242,214)', 'rgb(231,235,217)'])
check('EVERY site plan tag that names a hatch names one the library has',
  Object.values(sp).filter((t) => t && t.SitePlan__FillHatchId).filter((t) => !H.Na__LeHatch__Get(t.SitePlan__FillHatchId)).map((t) => t.Tag__SketchUpName), [])
check('EVERY site plan tag that names a face material names one the Materials SSOT has, as rgb()',
  Object.values(sp).filter((t) => t && t.SitePlan__FillMaterialId).filter((t) => !rgbOf(t.SitePlan__FillMaterialId)).map((t) => t.Tag__SketchUpName), [])

// TWO HARD STANDING GREYS (21-Sep-2026). Adam: "We need a tag specifically for hard
// standing and paved driveways ... two types of very light grey fill, so I can mark
// paths properly on the models, too, and paving areas." Drives are the neutral grey,
// paths and paving the warm one - on the two new FILL tags and on the older tags that
// can hold the same surfaces.
const DRIVE_TAGS  = ['74__SitePlan__ExternalWorks__HardStandingAndDriveways', '73__SitePlan__SiteFeature__Access', '74__SitePlan__ExternalWorks__HardSurfaces']
const PAVING_TAGS = ['74__SitePlan__ExternalWorks__PathsAndPaving', '73__SitePlan__SiteFeature__Paths']
const HARD = DRIVE_TAGS.concat(PAVING_TAGS)
check('Hard Standing and Driveways, and Paths and Paving, are site plan tags with stems of their own',
  [sp[DRIVE_TAGS[0]] && sp[DRIVE_TAGS[0]].SitePlan__ExportFileNameStem, sp[PAVING_TAGS[0]] && sp[PAVING_TAGS[0]].SitePlan__ExportFileNameStem],
  ['TrueVision__SitePlan__HardStandingAndDriveways', 'TrueVision__SitePlan__PathsAndPaving'])
check('drives, access and hard surfaces wash in the drive grey; paths and paving in the paving grey - opaque, fill Z 2',
  HARD.map((k) => [sp[k].SitePlan__ExportFills, sp[k].SitePlan__FillMaterialId, sp[k].SitePlan__FillOpacity, sp[k].SitePlan__ZIndexFill]),
  DRIVE_TAGS.map(() => [true, 'MAT806__SitePlan__HardStandingGrey', 1, 2]).concat(PAVING_TAGS.map(() => [true, 'MAT807__SitePlan__PavingGrey', 1, 2])))
check('the two greys are very light, the drive neutral and darker, the paving warm and lighter',
  [rgbOf('MAT806__SitePlan__HardStandingGrey'), rgbOf('MAT807__SitePlan__PavingGrey')], ['rgb(228,228,228)', 'rgb(240,238,233)'])
check('no hatch on hard standing - plain washes', HARD.map((k) => sp[k].SitePlan__FillHatchId), HARD.map(() => null))
const pathsLine = lineOf(sp['73__SitePlan__SiteFeature__Paths'])
check('the two fill tags\' own edges (when they have any) draw EXACTLY like Site Paths, so a traced drive merges into its line',
  [lineOf(sp[DRIVE_TAGS[0]]), lineOf(sp[PAVING_TAGS[0]])], [pathsLine, pathsLine])

const EX = tags.ExportExclusions
check('the new tags are in BOTH exclusion lists (the model export never writes them; Edge Paint leaves their edges alone)',
  [GRASS_TAG, ROUGH_TAG, sp[DRIVE_TAGS[0]], sp[PAVING_TAGS[0]]].map((t) => [EX.FullyExcludedTagNames.includes(t.Tag__SketchUpName), EX.AdvancedSwapOffTagNames.includes(t.Tag__SketchUpName)]),
  [[true, true], [true, true], [true, true], [true, true]])
// ---- still water and removed hard surfaces (22-Sep-2026) --------------------------
// Adam: "Add a still water because I've got a pool to do on this project. Use the water
// texture we've already used, but just without the hatching." And: "a new tag for
// 74__SitePlan__ExternalWorks__HardSurfaces__Removed ... paths, roads, etc., that are being
// removed from within the site, so this should be a mid-grey dotted line."
const STILL   = sp['74__SitePlan__ExternalWorks__StillWater']
const WATER   = sp['71__SitePlan__BaseMap__Waterbodies']
const REMOVED = sp['74__SitePlan__ExternalWorks__HardSurfaces__Removed']
check('Still Water washes in the SAME water blue as Waterbodies, with NO ripple hatch, level with it at fill Z 4',
  [STILL && STILL.SitePlan__FillMaterialId === WATER.SitePlan__FillMaterialId, STILL && STILL.SitePlan__FillHatchId, STILL && STILL.SitePlan__ExportFills, STILL && STILL.SitePlan__ZIndexFill],
  [true, null, true, 4])
check('and its edges draw exactly like Waterbodies', STILL && lineOf(STILL), lineOf(WATER))
check('Hard Surfaces To Be Removed is a MID GREY DOTTED line, and no fill',
  REMOVED && [REMOVED.SitePlan__LineColourId, REMOVED.SitePlan__LineType, REMOVED.SitePlan__ExportFills, REMOVED.SitePlan__FillMaterialId, REMOVED.Layout__LineStyleName],
  ['MTE104__LineColour__MidGrey__L60', 'dotted', false, null, 'Dot'])

// Adam, 22-Sep-2026: "Add fences removed". Named as he named the last one - the tag the fences are
// on, plus __Removed - so it sorts directly under Walls and Fences in SketchUp's tag list.
const FENCES   = sp['72__SitePlan__Boundary__WallsAndFences']
const FENCES_X = sp['72__SitePlan__Boundary__WallsAndFences__Removed']
check('Walls and Fences To Be Removed draws the SAME mid grey dotted line as removed hard surfaces - everything being taken out reads alike',
  FENCES_X && [FENCES_X.SitePlan__LineColourId, FENCES_X.SitePlan__LineType, FENCES_X.Layout__LineStyleName, FENCES_X.SitePlan__ExportFills],
  [REMOVED.SitePlan__LineColourId, REMOVED.SitePlan__LineType, REMOVED.Layout__LineStyleName, false])
check('at the weight and line Z of the fences it removes',
  FENCES_X && [FENCES_X.SitePlan__LineWeightPt, FENCES_X.SitePlan__LineWeightMm, FENCES_X.SitePlan__ZIndexLine, FENCES_X.SitePlan__LayerGroup],
  [FENCES.SitePlan__LineWeightPt, FENCES.SitePlan__LineWeightMm, FENCES.SitePlan__ZIndexLine, FENCES.SitePlan__LayerGroup])

// Adam, 22-Sep-2026: "73__SitePlan__Buildings__Existing__Removed ... a blue, small dotted line
// showing the removed building, no fill." SMALL is the layer's dash scale - the lever built for the
// Proposed Alterations dashes - on the dotted type, at 0.5 pt: dots on a 0.8 mm repeat, not 1.6.
const BLD   = sp['73__SitePlan__Buildings__Existing']
const BLD_X = sp['73__SitePlan__Buildings__Existing__Removed']
const dottedMm = cfg.LayoutEditor__EdgeStyles__LineTypes.find((t) => t.LineType__Alias === 'dotted').LineType__PatternMm
check('Existing Buildings To Be Removed is a BLUE dotted line with no fill, level with the buildings',
  BLD_X && [BLD_X.SitePlan__LineColourId, BLD_X.SitePlan__LineType, BLD_X.SitePlan__ExportFills, BLD_X.SitePlan__FillMaterialId, BLD_X.SitePlan__ZIndexLine, BLD_X.SitePlan__LayerGroup, BLD_X.Layout__LineStyleName],
  ['MTE205__LineColour__Blue', 'dotted', false, null, BLD.SitePlan__ZIndexLine, BLD.SitePlan__LayerGroup, 'Dot'])
check('and SMALL: dots at half the spacing of the other removal lines, on a finer line',
  BLD_X && [dottedMm.map((mm) => mm * BLD_X.SitePlan__LineDashScale), BLD_X.SitePlan__LineWeightPt < REMOVED.SitePlan__LineWeightPt, REMOVED.SitePlan__LineDashScale === undefined],
  [[0.2, 0.6], true, true])

// THREE GUARDS OVER EVERY SITE PLAN TAG. The first would have caught OsMapping__MajorFeature,
// which sat out of both exclusion lists until Tags 2.7.1; the third is finding F4 - a line
// colour missing from the EdgeStyles palette paints BLACK, silently.
const siteTags = Object.values(sp).filter((t) => t && t.SitePlan__ExportFileNameStem)
check('EVERY site plan tag is in BOTH exclusion lists',
  siteTags.filter((t) => !(tags.ExportExclusions.FullyExcludedTagNames.includes(t.Tag__SketchUpName) && tags.ExportExclusions.AdvancedSwapOffTagNames.includes(t.Tag__SketchUpName))).map((t) => t.Tag__SketchUpName), [])
const aliases = cfg.LayoutEditor__EdgeStyles__LineTypes.map((t) => t.LineType__Alias)
check('EVERY site plan line type is a TrueVision EdgeStyles line type',
  siteTags.filter((t) => !aliases.includes(t.SitePlan__LineType)).map((t) => t.Tag__SketchUpName + ' ' + t.SitePlan__LineType), [])
const edgeDoc = JSON.parse(fs.readFileSync(path.join(SSOT, 'Na__DataLib__CoreIndex__EdgeMaterials__.json'), 'utf8'))
const edgeHex = {}
Object.values(edgeDoc.Na__DataLib__CoreIndex__EdgeMaterials).forEach((series) => { if (series && typeof series === 'object') Object.entries(series).forEach(([k, v]) => { if (v && v.HexValue) edgeHex[k] = String(v.HexValue).toUpperCase() }) })
const palette = cfg.LayoutEditor__EdgeStyles__Colours.map((c) => String(c.Colour__Hex).toUpperCase())
check('EVERY site plan line colour is in the EdgeStyles palette, so none paints black (F4)',
  siteTags.filter((t) => !palette.includes(edgeHex[t.SitePlan__LineColourId])).map((t) => t.Tag__SketchUpName + ' ' + t.SitePlan__LineColourId), [])

const stems = Object.values(sp).filter((t) => t && t.SitePlan__ExportFileNameStem).map((t) => t.SitePlan__ExportFileNameStem)
check('no two site plan tags share a stem (a shared stem would overwrite one GLB with the other)', stems.length, new Set(stems).size)
check('every site plan weight in points matches its millimetres',
  Object.values(sp).filter((t) => t && Number.isFinite(t.SitePlan__LineWeightPt))
    .filter((t) => Math.abs(t.SitePlan__LineWeightPt * 0.352778 - t.SitePlan__LineWeightMm) > 0.0015).map((t) => t.Tag__SketchUpName), [])


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

// ---- a pattern's OWN INK, through the shipped painter (21-Sep-2026) --------------
// The Grassland and Rough Grassland tags draw their edges in the OS base map grey.
// Their tufts must still be green: a pattern that names a hex keeps it. A pattern
// that inherits must still take the layer's ink, or every existing wood would move.
LS.push(mkLayer('grass', '75__SitePlan__SoftLandscape__Grassland',      1, 1, '#666666', 'MAT804__SitePlan__GrasslandGreen',      '#E5F2D6', 1, 'SitePlanHatch__Grassland'))
LS.push(mkLayer('rough', '75__SitePlan__SoftLandscape__RoughGrassland', 1, 1, '#666666', 'MAT805__SitePlan__RoughGrasslandOlive', '#E7EBD9', 1, 'SitePlanHatch__RoughGrassland'))
globalThis.__LAYERDATA.grass = { categoryKey : 'grass', layer : LS[3], segments : new Float32Array([1500, 22500, 19500, 22500]), segmentCount : 1, rings : BOX(1500, 22500, 18000, 6500) }
globalThis.__LAYERDATA.rough = { categoryKey : 'rough', layer : LS[4], segments : new Float32Array([20000, 22500, 38500, 22500]), segmentCount : 1, rings : BOX(20000, 22500, 18500, 6500) }
globalThis.__EFFECTIVE.grass = { weight : 1, colour : 'dark-grey', lineType : 'solid', hex : '#666666', patternMm : [], overridden : false }
globalThis.__EFFECTIVE.rough = { weight : 1, colour : 'dark-grey', lineType : 'solid', hex : '#666666', patternMm : [], overridden : false }

// The pattern list is sorted by fill Z, so grass (1) and rough (1) come before the
// wood (3): pattern ids end -0, -1, -2 in that order.
const patternInk = (svg, id) => { const m = new RegExp('<pattern id="' + id + '"[^>]*><g[^>]*stroke="([^"]+)"').exec(svg); return m ? m[1] : null }
const svgGrass = paint(freshState(), variant('vpGrass', {}))
check('the grass and rough tufts paint in their OWN green on layers whose lines are grey',
  [patternInk(svgGrass, 'na-le-hatch-vpGrass-0'), patternInk(svgGrass, 'na-le-hatch-vpGrass-1')], ['#43A047', '#43A047'])
check('their tiles print at paper size: 28 and 32 mm, which is 14000 and 16000 drawing mm at 1:500',
  [/<pattern id="na-le-hatch-vpGrass-0"[^>]*width="14000"/.test(svgGrass), /<pattern id="na-le-hatch-vpGrass-1"[^>]*width="16000"/.test(svgGrass)], [true, true])
check('the grass washes paint first (fill Z 1), under the woodland wash (fill Z 3)',
  [bodyOf(svgGrass).indexOf('fill="#E5F2D6"') !== -1, bodyOf(svgGrass).indexOf('fill="#E5F2D6"') < bodyOf(svgGrass).indexOf('fill="#DCEDCF"')], [true, true])
const svgGrassAsWood = paint(freshState(), variant('vpGrassWood', { [HF] : { [HC] : { grass : { Hatch__PatternKey : 'SitePlanHatch__MixedWoodland' } } } }))
check('an INHERITING pattern put on the grey grass layer takes the layer\'s grey - inheritance is untouched',
  patternInk(svgGrassAsWood, 'na-le-hatch-vpGrassWood-0'), '#666666')
const svgGrassLocation = paint(freshState(), variant('vpGrassLoc', { Viewport__ScaleDenominator : 1250 }))
check('a location plan paints no grass wash - the proposal is its only fill',
  [/fill="#E5F2D6"/.test(svgGrassLocation), /fill="#E7EBD9"/.test(svgGrassLocation), /fill="#FF0000"/.test(svgGrassLocation)], [false, false, true])

// ---- a LAYER'S OWN line weight and colour, through the shipped painter (21-Sep-2026) --
// Adam: "A line thickness control for the pattern. A line colour for the pattern."
// The Patterns panel stores them per layer on the viewport; the painter must paint
// them, and a viewport that stores neither must paint exactly as it did.
const paperStroke = (svg, id) => {
  const m = new RegExp('<pattern id="' + id + '"[^>]*><g transform="scale\\(([^)]+)\\)"[^>]*stroke-width="([^"]+)"').exec(svg)
  return m ? (parseFloat(m[1]) * parseFloat(m[2])) / 500 : null               // <-- Drawing millimetres at 1:500, back to paper
}
const closeTo = (a, b) => a !== null && Math.abs(a - b) < 1e-9
const svgOwn = paint(freshState(), variant('vpOwn', { [HF] : { [HC] : { wood : { Hatch__StrokePt : 0.6, Hatch__Colour : '#737373' }, grass : { Hatch__Colour : '#960000' } } } }))
check('a colour set on a layer\'s hatch beats the layer\'s line colour (wood) AND the pattern\'s own ink (grass)',
  [patternInk(svgOwn, 'na-le-hatch-vpOwn-2'), patternInk(svgOwn, 'na-le-hatch-vpOwn-0'), patternInk(svgOwn, 'na-le-hatch-vpOwn-1')], ['#737373', '#960000', '#43A047'])
check('a typed 0.60 pt paints at 0.60 pt of PAPER at 1:500, and the layers beside it keep the pattern\'s standard 0.18 mm',
  [closeTo(paperStroke(svgOwn, 'na-le-hatch-vpOwn-2'), 0.6 * 25.4 / 72), closeTo(paperStroke(svgOwn, 'na-le-hatch-vpOwn-0'), 0.18), closeTo(paperStroke(svgOwn, 'na-le-hatch-vpOwn-1'), 0.18)], [true, true, true])
const svgOwnHalf = paint(freshState(), variant('vpOwnHalf', { [HF] : { [HC] : { wood : { Hatch__Scale : 0.5, Hatch__StrokePt : 0.6 } } } }))
check('and it stays 0.60 pt when the pattern is drawn at half scale - a typed weight does not shrink with the tile',
  [closeTo(paperStroke(svgOwnHalf, 'na-le-hatch-vpOwnHalf-2'), 0.6 * 25.4 / 72), /<pattern id="na-le-hatch-vpOwnHalf-2"[^>]*width="4500"/.test(svgOwnHalf)], [true, true])
const sOwn = freshState()
paint(sOwn, variant('vpOwnKey', {}))
const keyPlain = sOwn.lineworkKey
paint(sOwn, variant('vpOwnKey', { [HF] : { [HC] : { wood : { Hatch__StrokePt : 0.6 } } } }))
const keyWeighted = sOwn.lineworkKey
paint(sOwn, variant('vpOwnKey', { [HF] : { [HC] : { wood : { Hatch__StrokePt : 0.6, Hatch__Colour : '#737373' } } } }))
check('each of the two moves the paint key, so the frame repaints the moment one is set',
  [keyPlain === keyWeighted, keyWeighted === sOwn.lineworkKey], [false, false])
const svgOwnLocation = paint(freshState(), variant('vpOwnLoc', { Viewport__ScaleDenominator : 1250, Viewport__SitePlan : { SitePlan__PlanType : 'block' },
  [HF] : { [HC] : { wood : { Hatch__Colour : '#1E88E5' } } } }))
check('a set colour is still an ink like any other: it paints where the patterns paint', /stroke="#1E88E5"/.test(svgOwnLocation), true)




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
</div>
<h2>Grassland and Rough Grassland (the bottom strip) - green tufts on layers whose edges are grey</h2>
<div class="row">
 <div class="card">${svgGrass}<div class="cap">Grassland left, Rough Grassland right, under the wood</div></div>
 <div class="card">${svgGrassAsWood}<div class="cap">An inheriting pattern on the grass layer takes its grey</div></div>
</div>`, 'utf8')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
