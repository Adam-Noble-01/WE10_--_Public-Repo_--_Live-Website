// =============================================================================
// TRUEVISION3D - TEST - SITE PLAN STORE (two stores, and the keys that name them)
// =============================================================================
//
// FILE       : Na__Test__SitePlanStore__.test.mjs
// PURPOSE    : Prove the site plan store keeps Existing and Proposed apart, and
//              that a project built before the split still reads exactly as it did
// CREATED    : 20-Sep-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__SitePlanStore__.test.mjs
//
// HOW IT WORKS:
// - Na__SitePlan__Store__.js cannot be imported into Node as it stands: Node reads
//   a .js file in this tree as CommonJS (no package.json declares module type), and
//   the module imports the project-data client, the URL helpers and the GLB parser.
// - So the SHIPPED FILE is read, its import statements are removed, stubs are put in
//   their place, and the result is written to a temp .mjs and imported. Everything
//   below the imports is byte-for-byte the code that ships. Nothing is paraphrased.
// - fetch is stubbed to always throw, so only the project data is read and the test
//   never touches the network.
//
// WHAT IT GUARDS:
// - The DEFAULT store (proposed) publishes UNQUALIFIED category keys, so every
//   viewport saved before there were two stores keeps its layer toggles and its
//   edge overrides with no migration. This is the whole backward-compatibility
//   story and it is one easy line to break.
// - The two stores publish the SAME layer names, so without qualification they
//   would overwrite each other in the store's layer map.
// - A project holding only an Existing site plan - which is RB05 - still answers
//   DefaultStoreId, or nothing would draw.
//
// =============================================================================

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules/52__System__SitePlanData/Na__SitePlan__Store__.js')
const TMP = path.join(os.tmpdir(), 'Na__SitePlan__Store__UnderTest__.mjs')

let src = fs.readFileSync(SRC, 'utf8')

// Remove every import STATEMENT (single-line and braced multi-line) and prepend
// stubs. The module body itself is untouched, so what runs below is the shipped
// code, not a paraphrase of it.
const before = src
src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*$/gm, '')
if (src === before) { console.error('FAIL: no import statements were stubbed'); process.exit(1) }
if (/^\s*import\s/m.test(src)) { console.error('FAIL: an import statement survived'); process.exit(1) }

src = `
    const Na__CfApi__GetLoadedProjectData       = () => globalThis.__PROJECT_DATA;
    const Na__AppUtils__IsRunningOnLocalhost    = () => false;   // <-- no local manifest fetch in Node
    const Na__AppUtils__GetProjectFolderFromUrl = () => 'RB05__WestFarm';
    const Na__AppUtils__GetYearFromUrl          = () => '26';
    const Na__SpGlb__ParseLinework              = (b) => (globalThis.__PARSE_LINE || (() => ({ segments : new Float32Array(0), segmentCount : 0, boundsMm : null })))(b);
    const Na__SpGlb__ParseFill                  = (b) => (globalThis.__PARSE_FILL || (() => ({ rings : [] })))(b);
` + src
fs.writeFileSync(TMP, src, 'utf8')

globalThis.window = { location : { origin : 'http://127.0.0.1:8523' }, dispatchEvent () {}, addEventListener () {} }
globalThis.CustomEvent = class { constructor (t, o) { this.type = t; Object.assign(this, o) } }
globalThis.fetch = async () => { throw new Error('no network in this harness') }   // <-- project data only

const S = await import(pathToFileURL(TMP).href + '?v=' + Math.random().toString(36).slice(2))

let pass = 0, fail = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}

// ---- Key qualification: the whole backward-compatibility story ----------------
const STEM = 'TrueVision__SitePlan__OsMapping'

check('the DEFAULT store leaves a key unqualified (old sheets keep matching)',
  S.Na__SpStore__QualifyKey(STEM, 'proposed'), STEM)
check('no store id given also leaves it unqualified',
  S.Na__SpStore__QualifyKey(STEM, null), STEM)
check('the existing store suffixes it',
  S.Na__SpStore__QualifyKey(STEM, 'existing'), STEM + '@existing')

check('a bare key splits to the default store',
  S.Na__SpStore__SplitKey(STEM), { stem : STEM, storeId : 'proposed' })
check('a suffixed key splits back',
  S.Na__SpStore__SplitKey(STEM + '@existing'), { stem : STEM, storeId : 'existing' })
check('an @ that is NOT a store id stays part of the stem',
  S.Na__SpStore__SplitKey('TrueVision__SitePlan__Odd@thing'),
  { stem : 'TrueVision__SitePlan__Odd@thing', storeId : 'proposed' })
check('round trip, existing', S.Na__SpStore__SplitKey(S.Na__SpStore__QualifyKey(STEM, 'existing')).stem, STEM)
check('round trip, proposed', S.Na__SpStore__SplitKey(S.Na__SpStore__QualifyKey(STEM, 'proposed')).stem, STEM)

check('BOTH forms still start with the site plan prefix that SheetRecords tests',
  [STEM, STEM + '@existing'].every(k => k.indexOf('TrueVision__SitePlan__') === 0), true)

check('StoreIdForKey routes a load to the right store',
  [ S.Na__SpStore__StoreIdForKey(STEM), S.Na__SpStore__StoreIdForKey(STEM + '@existing') ],
  [ 'proposed', 'existing' ])

// ---- Reading the project data -------------------------------------------------
const layer = (key) => ({
  Layer__CategoryKey : key,
  Layer__Label : 'OS Mapping',
  Layer__DrawOrder : 20,
  Layer__LineworkUrl : 'https://cdn.noble-architecture.com/x/' + key + '.glb',
  Layer__Style : { LineHex : '#666666', LineWeightMm : 0.13 },
  Layer__VisibleAtScales : [ 500, 1250 ]
})

// A project built BEFORE the split: one legacy key, no array.
globalThis.__PROJECT_DATA = { SitePlan__DataStore : {
  SitePlan__FolderName : 'SitePlan__DrawingData',
  SitePlan__ExportedIso : '2026-09-17T19:30:36Z',
  SitePlan__Layers : [ layer(STEM) ]
} }
await S.Na__SpStore__ResolveAll()
check('a legacy single key resolves as the PROPOSED store',
  S.Na__SpStore__GetLayers('proposed').map(l => l.Layer__CategoryKey), [ STEM ])
check('and its keys are UNQUALIFIED, so a saved viewport still matches',
  S.Na__SpStore__GetLayers('proposed')[0].Layer__CategoryKey, STEM)
check('the existing store is empty', S.Na__SpStore__GetLayers('existing').length, 0)
check('the default store id is proposed', S.Na__SpStore__DefaultStoreId(), 'proposed')

// A project with BOTH stores. NOTE Reload() re-resolves immediately, so the new
// project data must be in place BEFORE it, not after.
globalThis.__PROJECT_DATA = { SitePlan__DataStores : [
  { SitePlan__StoreId : 'existing', SitePlan__FolderName : 'SitePlan__DrawingData__Existing',
    SitePlan__ExportedIso : '2026-09-20T15:00:00Z', SitePlan__Layers : [ layer(STEM) ] },
  { SitePlan__StoreId : 'proposed', SitePlan__FolderName : 'SitePlan__DrawingData__Proposed',
    SitePlan__ExportedIso : '2026-09-20T16:00:00Z', SitePlan__Layers : [ layer(STEM) ] },
] }
await S.Na__SpStore__Reload()

check('both stores resolve',
  S.Na__SpStore__GetStores().filter(s => s.Store__Available).map(s => s.Store__Id).sort(),
  [ 'existing', 'proposed' ])
check('THE COLLISION IS GONE: the same layer name yields two distinct keys',
  S.Na__SpStore__GetLayers().map(l => l.Layer__CategoryKey).sort(),
  [ STEM, STEM + '@existing' ])
check('GetLayers(store) is scoped to that store',
  [ S.Na__SpStore__GetLayers('existing').length, S.Na__SpStore__GetLayers('proposed').length ], [ 1, 1 ])
check('each layer remembers its store and stem',
  S.Na__SpStore__GetLayers('existing').map(l => [ l.Layer__StoreId, l.Layer__Stem ]), [ [ 'existing', STEM ] ])
check('each store keeps its own export time (so the paint tokens differ)',
  [ S.Na__SpStore__GetDescriptor('existing').SitePlan__ExportedIso,
    S.Na__SpStore__GetDescriptor('proposed').SitePlan__ExportedIso ],
  [ '2026-09-20T15:00:00Z', '2026-09-20T16:00:00Z' ])

// Existing ONLY - which is exactly RB05 today.
globalThis.__PROJECT_DATA = { SitePlan__DataStores : [
  { SitePlan__StoreId : 'existing', SitePlan__FolderName : 'SitePlan__DrawingData__Existing',
    SitePlan__ExportedIso : '2026-09-20T15:00:00Z', SitePlan__Layers : [ layer(STEM) ] },
] }
await S.Na__SpStore__Reload()
check('RB05 case: with only an Existing store, a viewport naming none gets it',
  S.Na__SpStore__DefaultStoreId(), 'existing')
check('and the aggregate status is ready, so the Add button enables',
  S.Na__SpStore__GetStatus(), S.Na__SpStore__STATUS_READY)

// ---- Z-index: authored wins, otherwise derived from the published draw order --
// PS01's manifest was written before the Z-index existed. It must still stack
// correctly, with no re-export, or the red line ends up under the trees.
const zLayer = (key, drawOrder, zl, zf) => {
  const l = layer(key)
  l.Layer__DrawOrder = drawOrder
  if (zl !== undefined) l.Layer__ZIndexLine = zl
  if (zf !== undefined) l.Layer__ZIndexFill = zf
  return l
}
globalThis.__PROJECT_DATA = { SitePlan__DataStore : {
  SitePlan__FolderName : 'SitePlan__DrawingData',
  SitePlan__ExportedIso : '2026-09-17T19:30:36Z',
  SitePlan__Layers : [
    zLayer('TrueVision__SitePlan__OsMapping', 20),                 // PS01, unauthored
    zLayer('TrueVision__SitePlan__ExistingBuildings', 40),
    zLayer('TrueVision__SitePlan__ProposedBuildingsSecondary', 70),
    zLayer('TrueVision__SitePlan__ProposedBuildings', 71),
    zLayer('TrueVision__SitePlan__RedLineBoundary', 90),
    zLayer('TrueVision__SitePlan__Waterbodies', 35, 7, 4),          // authored
    zLayer('TrueVision__SitePlan__TreesMixedWoodland', 56, 6, 3),
  ]
} }
await S.Na__SpStore__Reload()
const byKey = {}
S.Na__SpStore__GetLayers('proposed').forEach(l => { byKey[l.Layer__Stem] = l })

check("PS01's unauthored draw orders derive to a sane 1-10 hierarchy",
  [ 'OsMapping', 'ExistingBuildings', 'ProposedBuildingsSecondary', 'ProposedBuildings', 'RedLineBoundary' ]
    .map(s => byKey['TrueVision__SitePlan__' + s].Layer__ZIndexLine),
  [ 2, 4, 7, 8, 9 ])
check('and the red line still ends up highest of them',
  byKey['TrueVision__SitePlan__RedLineBoundary'].Layer__ZIndexLine
    > byKey['TrueVision__SitePlan__ProposedBuildings'].Layer__ZIndexLine, true)
check('an AUTHORED z-index wins over the derived one',
  [ byKey['TrueVision__SitePlan__Waterbodies'].Layer__ZIndexLine,
    byKey['TrueVision__SitePlan__Waterbodies'].Layer__ZIndexFill ], [ 7, 4 ])
check("REQ-10: water LINES sit above tree LINES...",
  byKey['TrueVision__SitePlan__Waterbodies'].Layer__ZIndexLine
    > byKey['TrueVision__SitePlan__TreesMixedWoodland'].Layer__ZIndexLine, true)
check('...and the two fills stack independently of the lines',
  byKey['TrueVision__SitePlan__Waterbodies'].Layer__ZIndexFill
    !== byKey['TrueVision__SitePlan__Waterbodies'].Layer__ZIndexLine, true)

// ---- The style whitelist: a new field must be named or it is deleted ---------
check('the style keeps the new fields (F8: this rebuild is a closed list)',
  Object.keys(S.Na__SpStore__GetLayers('proposed')[0].Layer__Style).sort(),
  [ 'FillColourId', 'FillHex', 'FillMaterialId', 'FillOpacity', 'HatchPatternId',
    'LineColourId', 'LineDashScale', 'LineHex', 'LineType', 'LineWeightMm', 'LineWeightPt' ])

// ---- A FILL LAYER WITH NO LINEWORK (21-Sep-2026, Site Plan Export 1.4.0) -------
// Adam tags just the FACE of a drive or a patio with a fill tag; its edges stay on
// the lines they belong to. The export then ships that layer's fill GLB alone.
// The store used to drop any layer without a linework URL, and to fetch linework
// before anything else - so the wash vanished twice over, with no error.
const HS  = 'TrueVision__SitePlan__HardStandingAndDriveways'
const OSM = 'TrueVision__SitePlan__OsMapping'
const fillOnly = { Layer__CategoryKey : HS, Layer__Label : 'Hard Standing and Driveways', Layer__DrawOrder : 32,
  Layer__LineworkUrl : null, Layer__FillUrl : 'https://cdn.noble-architecture.com/x/' + HS + '__FillModel__.glb',
  Layer__Style : { LineHex : '#999999', FillHex : '#E4E4E4', FillOpacity : 1 } }
const neither  = { Layer__CategoryKey : 'TrueVision__SitePlan__Nothing', Layer__LineworkUrl : null, Layer__FillUrl : null }
globalThis.__PROJECT_DATA = { SitePlan__DataStore : {
  SitePlan__FolderName : 'SitePlan__DrawingData', SitePlan__ExportedIso : '2026-09-21T15:00:00Z',
  SitePlan__Layers : [ layer(OSM), fillOnly, neither ]
} }
await S.Na__SpStore__Reload()
check('a layer with a fill and NO linework is kept; a layer with neither is still dropped',
  S.Na__SpStore__GetLayers('proposed').map(l => l.Layer__CategoryKey).sort(), [ HS, OSM ])

// Serve every URL; count what gets fetched and parsed.
const fetched = []
let lineParses = 0
globalThis.fetch = async (url) => { fetched.push(String(url)); return { ok : true, status : 200, arrayBuffer : async () => new ArrayBuffer(8) } }
globalThis.__PARSE_LINE = () => { lineParses++; return { segments : new Float64Array([0, 0, 1, 1]), segmentCount : 1, boundsMm : { MinX : 0, MinY : 0, MaxX : 1, MaxY : 1 } } }
globalThis.__PARSE_FILL = () => ({ rings : [ { face : 0, outer : true, points : new Float64Array([0, 0, 10, 0, 10, 10]) } ], boundsMm : { MinX : 0, MinY : 0, MaxX : 10, MaxY : 10 } })

const hsData = await S.Na__SpStore__LoadLayer(HS)
check('the faces-only layer LOADS: no segments, its rings, bounds taken from the fill',
  [ hsData.segmentCount, hsData.segments.length, hsData.rings.length, hsData.boundsMm && hsData.boundsMm.MaxX ], [ 0, 0, 1, 10 ])
check('and it never asked for, or parsed, a linework file',
  [ lineParses, fetched.some(u => u.indexOf('LineworkModel') !== -1), fetched.every(u => u.indexOf('FillModel') !== -1) ], [ 0, false, true ])
const osmData = await S.Na__SpStore__LoadLayer(OSM)
check('a normal layer still fetches and parses its linework', [ osmData.segmentCount, lineParses ], [ 1, 1 ])

// Its fill IS the layer, so a fill that fails must reject - not cache an empty layer.
globalThis.__PROJECT_DATA = { SitePlan__DataStore : {
  SitePlan__FolderName : 'SitePlan__DrawingData', SitePlan__ExportedIso : '2026-09-21T16:00:00Z',
  SitePlan__Layers : [ fillOnly ]
} }
await S.Na__SpStore__Reload()
globalThis.fetch = async () => ({ ok : false, status : 404 })
const failed = await S.Na__SpStore__LoadLayer(HS).then(() => 'resolved', () => 'rejected')
check('a faces-only layer whose fill fails to load REJECTS (retried next time), where a lined layer would draw on',
  [ failed, S.Na__SpStore__GetLayerData(HS) ], [ 'rejected', null ])
globalThis.fetch = async () => { throw new Error('no network in this harness') }
delete globalThis.__PARSE_LINE
delete globalThis.__PARSE_FILL

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
