// =============================================================================
// TRUEVISION3D - TEST - HATCH LINE CONTROLS AND THE CONSTRUCTION MATERIALS PACK
// =============================================================================
//
// FILE       : Na__Test__HatchLineControls__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Hatch Line Controls Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a hatch's own line weight and colour reach the screen, the PDF and the record, and that every construction pattern obeys the seam rules
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Runs the SHIPPED hatch module against the SHIPPED library on disk, and the
//   shipped sheet chrome, shape geometry and record layer with their imports
//   swapped for stubs, the way Na__Test__SitePlanComposites__ does.
// - THE LINE WEIGHT. Hatch__StrokePt is printed points and does not grow with
//   the pattern scale; left out, the pattern's own stroke is used and does.
//   Checked on the SVG the module writes and on the line width a PDF is given.
// - THE COLOUR ORDER on a vector: the hatch's own, else the pattern's own ink,
//   else the shape's edge colour.
// - SEAM COPIES. A mark inside its tile adds nothing (so every earlier pattern's
//   markup is unchanged); a line that crosses a seam is drawn again from the
//   neighbouring tiles; a knit copy somebody placed by hand is not doubled.
// - THE CONSTRUCTION MATERIALS PACK, every pattern: it loads; nothing but
//   strokes the PDF can stamp; no centreline leaves the tile; no line runs
//   through a tile corner or along an edge; and every line that ends on a seam
//   meets its continuation on the opposite edge, travelling the same way.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__HatchLineControls__.test.mjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the hatch line controls and the Construction Materials pack.
//
// =============================================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules')
const LIB  = path.resolve(HERE, '../52__LayoutEditor__HatchPatternLibrary')
const PT   = 25.4 / 72

let pass = 0, fail = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol)

// The shipped file, with its imports swapped for stubs and nothing else touched.
function load (relative, stubs, tag) {
  const file = path.resolve(SRC, relative)
  let src = fs.readFileSync(file, 'utf8')
  const had = /^\s*import\s/m.test(src)
  src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '')
  if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1) }
  const tmp = path.join(os.tmpdir(), 'Na__Test__HatchLine__' + tag + '__.mjs')
  fs.writeFileSync(tmp, stubs + '\n' + src, 'utf8')
  return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2))
}

globalThis.fetch = async (url) => {
  const rel = decodeURIComponent(String(url)).split('52__LayoutEditor__HatchPatternLibrary/')[1]
  if (!rel) return { ok : false, status : 404 }
  const file = path.join(LIB, ...rel.split('/'))
  if (!fs.existsSync(file)) return { ok : false, status : 404 }
  return { ok : true, status : 200, json : async () => JSON.parse(fs.readFileSync(file, 'utf8')) }
}
const logWas = console.log
console.log = () => {}
const H = await load('51__System__LayoutEditor/36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js', '', 'Hatch')
await H.Na__LeHatch__Ready()
console.log = logWas
globalThis.__H = H

// -----------------------------------------------------------------------------
// The library: both packs, in folder order
// -----------------------------------------------------------------------------
const packs = H.Na__LeHatch__GetPacks()
check('the library lists Construction Materials, then the Site Plan hatches - the order of their folders',
  packs.map((p) => p.Pack__Key), ['ConstructionMaterialHatches', 'SitePlanHatches'])
const pack = packs[0]
const KEYS = ['Brickwork', 'Blockwork', 'Concrete', 'Hardcore', 'Earth', 'ScreedAndRender', 'InsulationQuilt', 'InsulationRigid',
              'TimberGrain', 'Metal', 'BrickCoursing', 'BlockCoursing', 'RoofTilesPlain', 'CladdingBoards'].map((k) => 'ConstructionHatch__' + k)
check('every pattern file the pack lists loaded, in the order listed', pack.Pack__Patterns.map((p) => p.Pattern__Key), KEYS)
check('every file in the pack folder is listed in its index (nothing lists a directory, so an unlisted file does not exist)',
  fs.readdirSync(path.join(LIB, '02__ConstructionMaterialHatches')).filter((f) => f.startsWith('Na__HatchPattern__')).sort(),
  JSON.parse(fs.readFileSync(path.join(LIB, '02__ConstructionMaterialHatches/HatchPack__Index__.json'), 'utf8'))
    .HatchPack__ConstructionMaterialHatches__Patterns.map((row) => row.Pattern__File).sort())
check('the index row and the file agree on every key',
  JSON.parse(fs.readFileSync(path.join(LIB, '02__ConstructionMaterialHatches/HatchPack__Index__.json'), 'utf8'))
    .HatchPack__ConstructionMaterialHatches__Patterns.map((row) => row.Pattern__Key), KEYS)
check('the pack names its swatch ink, and the site plan pack keeps the woodland green by naming none',
  [pack.Pack__SwatchInk, packs[1].Pack__SwatchInk], ['#333333', null])
check('every construction pattern inherits its colour - none carries an ink of its own',
  pack.Pack__Patterns.filter((p) => p.Pattern__Ink !== null).map((p) => p.Pattern__Key), [])

const brick = H.Na__LeHatch__Get('ConstructionHatch__Brickwork')
const block = H.Na__LeHatch__Get('ConstructionHatch__Blockwork')
const grass = H.Na__LeHatch__Get('SitePlanHatch__Grassland')
const ponds = H.Na__LeHatch__Get('SitePlanHatch__PondsAndLakes')
const wood  = H.Na__LeHatch__Get('SitePlanHatch__MixedWoodland')

// -----------------------------------------------------------------------------
// The line weight
// -----------------------------------------------------------------------------
const strokeOf = (def) => parseFloat(/stroke-width="([^"]+)"/.exec(def)[1])
const scaleOf  = (def) => parseFloat(/<g transform="scale\(([^)]+)\)"/.exec(def)[1])
const drawn    = (def) => strokeOf(def) * scaleOf(def)                          // <-- What the browser paints, in the space the pattern is used in

check('the standard weight is the pattern\'s own 0.25 pt, and the panel is told so in points', H.Na__LeHatch__StandardStrokePt(brick, 1), 0.25)
check('the standard GROWS with the pattern scale, as it always has', [H.Na__LeHatch__StandardStrokePt(brick, 2), H.Na__LeHatch__StandardStrokePt(brick, 0.5)], [0.5, 0.13])
check('with no weight set the markup is what it was: the pattern\'s own stroke, in tile millimetres',
  [strokeOf(H.Na__LeHatch__PatternDef('a', brick, { scale : 1 })), near(drawn(H.Na__LeHatch__PatternDef('a', brick, { scale : 2 })), 0.0882 * 2)], [0.0882, true])
check('a typed 0.50 pt paints at 0.50 pt on paper at scale 1, at scale 2 and at scale 0.25 - it does NOT grow with the scale',
  [1, 2, 0.25].map((scale) => near(drawn(H.Na__LeHatch__PatternDef('a', brick, { scale : scale, strokePt : 0.5 })), 0.5 * PT, 1e-9)), [true, true, true])
check('and at a site plan viewport\'s 1:500 it is 0.50 pt of PAPER, which is 500 times that in drawing millimetres',
  near(drawn(H.Na__LeHatch__PatternDef('a', brick, { scale : 1, denominator : 500, strokePt : 0.5 })), 0.5 * PT * 500, 1e-6), true)
check('an emptied box, a zero, a minus and a word all mean "the standard", never a weight of nothing',
  ['', null, undefined, 0, -1, 'abc', NaN].map(H.Na__LeHatch__ClampStrokePt), [null, null, null, null, null, null, null])
check('a typed weight is kept to two places', [H.Na__LeHatch__ClampStrokePt('0.333'), H.Na__LeHatch__ClampStrokePt(1)], [0.33, 1])
check('a colour is a six-digit hex or it is "the standard"',
  ['#960000', '#96000', 'red', null, ''].map(H.Na__LeHatch__CleanColour), ['#960000', null, null, null, null])
check('the standard colour is the pattern\'s own ink when it has one, else whatever carries it',
  [H.Na__LeHatch__StandardColour(grass, '#666666'), H.Na__LeHatch__StandardColour(brick, '#666666'), H.Na__LeHatch__StandardColour(brick, null)],
  ['#43A047', '#666666', '#000000'])

// The PDF is given the same two cases, in the same order.
const fakeDoc = () => {
  const calls = { width : [], colour : [], lines : 0 }
  return { calls,
    saveGraphicsState () {}, restoreGraphicsState () {}, moveTo () {}, lineTo () {}, clip () {}, discardPath () {},
    setDrawColor (r, g, b) { calls.colour.push([r, g, b]) }, setLineWidth (w) { calls.width.push(w) }, setLineCap () {}, setLineJoin () {},
    setLineDashPattern () {}, line () { calls.lines++ } }
}
const AREA = [ [10, 10], [70, 10], [70, 50], [10, 50] ]
const pdf = (options) => { const doc = fakeDoc(); const ok = H.Na__LeHatch__DrawPdf(doc, AREA, Object.assign({ pattern : brick }, options)); return Object.assign(doc.calls, { ok }) }
check('the PDF prints the standard weight at the scale in use', [near(pdf({ scale : 1 }).width[0], 0.0882), near(pdf({ scale : 2 }).width[0], 0.1764)], [true, true])
check('and a typed 0.50 pt as 0.50 pt whatever the scale, in the colour it shows in',
  [near(pdf({ scale : 1, strokePt : 0.5 }).width[0], 0.5 * PT), near(pdf({ scale : 2, strokePt : 0.5 }).width[0], 0.5 * PT), pdf({ colour : '#960000' }).colour[0]],
  [true, true, [150, 0, 0]])
check('a line hatch really stamps lines into the PDF', pdf({ scale : 1 }).ok && pdf({ scale : 1 }).lines > 100, true)

// -----------------------------------------------------------------------------
// A site plan layer: Effective and the repaint token
// -----------------------------------------------------------------------------
const F = H.Na__LeHatch__FIELD, C = H.Na__LeHatch__CAT_FIELD
const vp = (entry) => ({ [F] : { [C] : { wood : entry } } })
const plain = H.Na__LeHatch__Effective(vp({ Hatch__Scale : 0.5 }), 'wood', 'SitePlanHatch__MixedWoodland')
check('a viewport saved before the two controls reads both as null - the pattern\'s standard', [plain.Hatch__StrokePt, plain.Hatch__Colour], [null, null])
const own = H.Na__LeHatch__Effective(vp({ Hatch__StrokePt : 0.4, Hatch__Colour : '#737373' }), 'wood', 'SitePlanHatch__MixedWoodland')
check('a layer\'s own weight and colour are read back', [own.Hatch__StrokePt, own.Hatch__Colour], [0.4, '#737373'])
check('and either one moves the paint key, so the frame repaints (the fault the Patterns panel once had with a typed scale)',
  [H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5 })) === H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5, Hatch__StrokePt : 0.4 })),
   H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5 })) === H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5, Hatch__Colour : '#737373' })),
   H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5 })) === H.Na__LeHatch__Token(vp({ Hatch__Scale : 0.5 }))], [false, false, true])

// -----------------------------------------------------------------------------
// Seam copies
// -----------------------------------------------------------------------------
const paths = (def) => (def.match(/<path /g) || []).length
check('a pattern whose marks sit inside their tile gets NOTHING added: ten grass tufts, ten paths',
  [grass.Pattern__Marks.length, paths(H.Na__LeHatch__PatternDef('a', grass, { scale : 1 }))], [10, 10])
check('a knit copy somebody placed by hand is not doubled: the wood\'s conifer and its knit stay one path each',
  paths(H.Na__LeHatch__PatternDef('a', wood, { scale : 1 })), wood.Pattern__Marks.length)
// THE POND IS THE ONE EARLIER PATTERN THAT CHANGES, AND RIGHTLY. Its two lowest
// ripples (y 10.4 on an 11 mm tile, troughs 0.6 mm deep) touch the BOTTOM seam,
// which nobody had knitted: the screen has always shaved half a line width off
// those troughs and the PDF never has. Each now gets its copy from the tile above,
// and its corner copy - four paths - while the sideways knit placed by hand is
// still not doubled.
const pondDef = H.Na__LeHatch__PatternDef('a', ponds, { scale : 1 })
const movesOf = (def) => (def.match(/translate\(([^)]+)\)/g) || []).map((t) => t.slice(10, -1))
check('the pond\'s ripples gain the four copies its bottom seam was always missing, and no second sideways knit',
  [paths(pondDef), movesOf(pondDef).filter((m) => m === '14.2 10.4' || m === '-0.8 10.4').length, movesOf(pondDef).filter((m) => / -0\.6/.test(m)).length], [9, 2, 4])
check('a line hatch is drawn again from its neighbours: brickwork\'s one glyph from all eight tiles round it',
  paths(H.Na__LeHatch__PatternDef('a', brick, { scale : 1 })), 9)
const tuftAtFoot = (strokePt) => paths(H.Na__LeHatch__PatternDef('a', grass, { scale : 1, strokePt : strokePt }))
check('and the copies follow the WEIGHT: a tuft 0.3 mm from the foot of its tile stays alone at 1 pt, and is met from below at 3 pt',
  [tuftAtFoot(1), tuftAtFoot(3) > 10], [10, true])

// -----------------------------------------------------------------------------
// Every construction pattern against the seam rules
// -----------------------------------------------------------------------------
// Flatten one mark through the SHIPPED flattener: a throwaway pattern of one mark.
const linesOf = (pattern, mark) => H.Na__LeHatch__TilePolylines({ Pattern__Marks : [mark], Pattern__TileWidthMm : pattern.Pattern__TileWidthMm,
  Pattern__TileHeightMm : pattern.Pattern__TileHeightMm, Pattern__StrokeMm : pattern.Pattern__StrokeMm, Pattern__Opacity : 1 }).lines
const EPS = 1e-6

// THE TRUE ENDS OF A GLYPH'S SUBPATHS: where each open one starts and stops, and
// the way it is heading OUT of itself there, read from the path data - a curve's
// control points - not from the flattened chords. A smooth curve that peaks on a
// seam is level there, but its first chord is not, and judging the chord would
// call a perfect join a kink. M L H V C S Z, absolute or relative.
const endsOf = (d, ox, oy) => {
  const tok = String(d).match(/[MmLlHhVvCcSsZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []
  const out = []
  let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, lastC2 = null, first = null, last = null, open = false
  const num = () => parseFloat(tok[i++])
  const unit = (dx, dy) => { const len = Math.hypot(dx, dy); return len > 0 ? [dx / len, dy / len] : null }
  const leg = (fromX, fromY, startDir, endDir) => { if (!first && startDir) first = { x : fromX, y : fromY, dir : startDir }; if (endDir) last = endDir }
  const close = (closed) => {
    if (open && !closed && first && last) {
      out.push({ x : first.x + ox, y : first.y + oy, ux : -first.dir[0], uy : -first.dir[1] })   // <-- Heading out of the START is backwards along it
      out.push({ x : x + ox, y : y + oy, ux : last[0], uy : last[1] })
    }
    open = false; first = null; last = null
  }
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++]
    else if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'
    const rel = cmd === cmd.toLowerCase(), bx = rel ? x : 0, by = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M': close(false); x = bx + num(); y = by + num(); sx = x; sy = y; open = true; lastC2 = null; break
      case 'L': { const nx = bx + num(), ny = by + num(); const dir = unit(nx - x, ny - y); leg(x, y, dir, dir); x = nx; y = ny; lastC2 = null; break }
      case 'H': { const nx = bx + num(); const dir = unit(nx - x, 0); leg(x, y, dir, dir); x = nx; lastC2 = null; break }
      case 'V': { const ny = by + num(); const dir = unit(0, ny - y); leg(x, y, dir, dir); y = ny; lastC2 = null; break }
      case 'C': case 'S': {
        const c1 = cmd.toUpperCase() === 'C' ? [bx + num(), by + num()] : (lastC2 ? [(2 * x) - lastC2[0], (2 * y) - lastC2[1]] : [x, y])
        const c2 = [bx + num(), by + num()], p3 = [bx + num(), by + num()]
        const startDir = unit(c1[0] - x, c1[1] - y) || unit(c2[0] - x, c2[1] - y) || unit(p3[0] - x, p3[1] - y)
        const endDir   = unit(p3[0] - c2[0], p3[1] - c2[1]) || unit(p3[0] - c1[0], p3[1] - c1[1]) || unit(p3[0] - x, p3[1] - y)
        leg(x, y, startDir, endDir); x = p3[0]; y = p3[1]; lastC2 = c2; break
      }
      case 'Z': close(true); x = sx; y = sy; lastC2 = null; break
      default: return out
    }
  }
  close(false)
  return out
}
const faults = { unreadable : [], outside : [], corner : [], alongEdge : [], unmet : [], filled : [] }
pack.Pack__Patterns.forEach((pattern) => {
  const W = pattern.Pattern__TileWidthMm, TH = pattern.Pattern__TileHeightMm
  const ends = []                                                               // <-- Every polyline end that lies on a tile edge
  pattern.Pattern__Marks.forEach((mark) => {
    if (mark.Mark__Glyph.Glyph__Fill !== 'none') faults.filled.push(pattern.Pattern__Key + ' ' + mark.Mark__Glyph.Glyph__Name)
    const lines = linesOf(pattern, mark)
    if (!lines.length) { faults.unreadable.push(pattern.Pattern__Key + ' ' + mark.Mark__Glyph.Glyph__Name); return }
    lines.forEach((line) => {
      line.forEach(([x, y]) => { if (x < -EPS || x > W + EPS || y < -EPS || y > TH + EPS) faults.outside.push(`${pattern.Pattern__Key} (${x}, ${y})`) })
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1], [bx, by] = line[i]
        // Along an edge: both ends of a piece on the same edge.
        if ((near(ax, 0, EPS) && near(bx, 0, EPS)) || (near(ax, W, EPS) && near(bx, W, EPS)) || (near(ay, 0, EPS) && near(by, 0, EPS)) || (near(ay, TH, EPS) && near(by, TH, EPS))) {
          faults.alongEdge.push(`${pattern.Pattern__Key} (${ax}, ${ay})-(${bx}, ${by})`)
        }
        // Through a corner: the piece passes within a hair of one.
        ;[[0, 0], [W, 0], [0, TH], [W, TH]].forEach(([cx, cy]) => {
          const dx = bx - ax, dy = by - ay, len2 = (dx * dx) + (dy * dy)
          const t = len2 > 0 ? Math.max(0, Math.min(1, (((cx - ax) * dx) + ((cy - ay) * dy)) / len2)) : 0
          if (Math.hypot(ax + (t * dx) - cx, ay + (t * dy) - cy) < 0.3) faults.corner.push(`${pattern.Pattern__Key} near (${cx}, ${cy})`)
        })
      }
    })
    endsOf(mark.Mark__Glyph.Glyph__Path, mark.Mark__XMm, mark.Mark__YMm)
      .filter((end) => near(end.x, 0, EPS) || near(end.x, W, EPS) || near(end.y, 0, EPS) || near(end.y, TH, EPS))
      .forEach((end) => ends.push(end))                                         // <-- Where it meets a seam, and the way it is travelling as it LEAVES the tile
  })
  // Every end on a seam must meet an end on the opposite edge, in the same place
  // along it, travelling the opposite way out - which is the same line carrying on.
  ends.forEach((end) => {
    const partner = ends.find((other) => other !== end
      && ((near(end.x, 0, EPS) && near(other.x, W, EPS) && near(end.y, other.y, 1e-4)) || (near(end.x, W, EPS) && near(other.x, 0, EPS) && near(end.y, other.y, 1e-4))
       || (near(end.y, 0, EPS) && near(other.y, TH, EPS) && near(end.x, other.x, 1e-4)) || (near(end.y, TH, EPS) && near(other.y, 0, EPS) && near(end.x, other.x, 1e-4)))
      && near(end.ux, -other.ux, 0.02) && near(end.uy, -other.uy, 0.02))
    if (!partner) faults.unmet.push(`${pattern.Pattern__Key} (${end.x}, ${end.y})`)
  })
})
check('every glyph is strokes only - the PDF stamps lines and never fills one', faults.filled, [])
check('every glyph flattens - nothing uses a path command the PDF stamper cannot read', faults.unreadable, [])
check('no centreline leaves its tile', faults.outside, [])
check('no line runs along a tile edge, where two tiles would each have to draw half of it', faults.alongEdge, [])
check('no line passes through a tile corner, where four would', [...new Set(faults.corner)], [])
check('every line that ends on a seam meets its continuation on the opposite edge, in the same place and travelling the same way (no step, no kink)', faults.unmet, [])

// THE CHECK ABOVE MUST BE ABLE TO FAIL. The first timber grain drawn for this pack
// left its tile heading slightly up and came into the next heading slightly down -
// a kink at every seam, found by eye on a render. The same two ends, given to the
// same test, have to be refused.
const kinked = endsOf('M0,0 C6,-0.9 8,0.9 12,0.2 S19,-0.8 24,0', 0, 1.9)
check('a line that kinks at the seam is caught: its two ends do not head opposite ways', near(kinked[0].uy, -kinked[1].uy, 0.02), false)
const level = endsOf('M0,0 C5,0 7,-0.9 12,-0.3 S19,0 24,0', 0, 1.9)
check('and the level one that replaced it is passed', [near(level[0].ux, -level[1].ux, 0.02), near(level[0].uy, -level[1].uy, 0.02)], [true, true])

check('brickwork is diagonals one way and blockwork is the same crossed: one glyph against two', [brick.Pattern__Marks.length, block.Pattern__Marks.length], [1, 2])
check('the coursing tiles are whole bricks, blocks and tiles at 1:50 (225 x 75, 450 x 225, 165 x 100 gauge)',
  ['BrickCoursing', 'BlockCoursing', 'RoofTilesPlain'].map((k) => { const p = H.Na__LeHatch__Get('ConstructionHatch__' + k); return [p.Pattern__TileWidthMm, p.Pattern__TileHeightMm] }),
  [[9, 6], [18, 9], [6.6, 4]])
check('an elevation texture can be scaled from 1:500 to 1:5; a section hatch keeps the usual bounds',
  [H.Na__LeHatch__Get('ConstructionHatch__BrickCoursing').Pattern__MinScale, H.Na__LeHatch__Get('ConstructionHatch__BrickCoursing').Pattern__MaxScale, brick.Pattern__MinScale, brick.Pattern__MaxScale],
  [0.1, 10, 0.25, 4])

// -----------------------------------------------------------------------------
// A vector's hatch, through the shipped chrome and shape geometry
// -----------------------------------------------------------------------------
const CHROME_STUBS = `
    const Na__LeGrad__SvgPaint      = () => null;
    const Na__LeGrad__DrawPdf       = () => false;
    const Na__LeHatch__Get          = (...a) => globalThis.__H.Na__LeHatch__Get(...a);
    const Na__LeHatch__SvgPaint     = (...a) => globalThis.__H.Na__LeHatch__SvgPaint(...a);
    const Na__LeHatch__DrawPdf      = (...a) => globalThis.__H.Na__LeHatch__DrawPdf(...a);
    const Na__QrPaint__SvgGroup     = () => '';
    const Na__QrPaint__DrawPdf      = () => {};
    const Na__LeImgPaint__KIND      = 'picture';
    const Na__LeImgPaint__Svg       = () => '';
    const Na__LeImgPaint__DrawPdf   = () => {};
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
const SHAPE_STUBS = `
    const Na__LeCfg__PtToMm       = (pt) => pt * 25.4 / 72;
    const Na__LeDash__PatternMm   = () => [];
    const Na__LeChrome__PushPolyline = (...a) => globalThis.__CH.Na__LeChrome__PushPolyline(...a);
    const Na__LeChrome__PushQr    = () => {};
    const Na__ProjectQr__GetSymbol = () => null;
    const Na__ProjectQr__GetSetup  = () => ({ symbol : {} });
    const Na__ProjectQr__CheckPrint = () => {};
    const Na__LeImgDraw__Push     = () => false;
`
const CH = await load('51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js', CHROME_STUBS, 'Chrome')
globalThis.__CH = CH
const G = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js', SHAPE_STUBS, 'ShapeGeo')
const vshape = (hatch) => ({ Shape__Id : 's1', Shape__Points : AREA.map((p) => p.slice()), Shape__Closed : true, Shape__Stroked : true,
  Shape__StrokeColour : '#2F6B33', Shape__StrokePt : 0.5, Shape__FillColour : null, Shape__Hatch : hatch })
const markup = (hatch) => { const list = []; G.Na__LeShapeGeo__Push(list, vshape(hatch)); return CH.Na__LeChrome__ToSvgMarkup(list, 100, 70, 'na-test') }
const inkOf = (svg) => /<pattern[\s\S]*?<g [^>]*stroke="([^"]+)"/.exec(svg)[1]

check('a brick hatch on a vector takes the shape\'s edge colour until a pattern colour is picked', inkOf(markup({ Hatch__PatternKey : 'ConstructionHatch__Brickwork' })), '#2F6B33')
check('a picked pattern colour wins', inkOf(markup({ Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__Colour : '#737373' })), '#737373')
check('a pattern with an ink of its own keeps it on a vector, as it does on the site plan: grass is green on a shape with dark edges',
  inkOf(markup({ Hatch__PatternKey : 'SitePlanHatch__Grassland' })), '#43A047')
check('and a picked colour still beats the pattern\'s own ink', inkOf(markup({ Hatch__PatternKey : 'SitePlanHatch__Grassland', Hatch__Colour : '#960000' })), '#960000')
check('the vector\'s typed Pattern line pt reaches the sheet markup, as paper millimetres',
  near(drawn(markup({ Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__Scale : 2, Hatch__StrokePt : 0.75 })), 0.75 * PT, 1e-9), true)
const pdfDoc = fakeDoc()
Object.assign(pdfDoc, { setFillColor () {}, setGState () {}, GState : (o) => o, lines () {}, rect () {}, path () {}, stroke () {}, fill () {}, fillStroke () {}, close () {}, setLineDash () {} })
let pdfWidths = null
try {
  const list = []; G.Na__LeShapeGeo__Push(list, vshape({ Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__Scale : 2, Hatch__StrokePt : 0.75, Hatch__Colour : '#960000' }))
  CH.Na__LeChrome__DrawToPdf(pdfDoc, list)
  pdfWidths = pdfDoc.calls
} catch (error) { pdfWidths = { error : String(error && error.message) } }
check('and the PDF of the same shape: the hatch at 0.75 pt in the picked colour',
  [pdfWidths.error || null, (pdfWidths.width || []).some((w) => near(w, 0.75 * PT, 1e-9)), (pdfWidths.colour || []).some((c) => JSON.stringify(c) === '[150,0,0]')], [null, true, true])

// -----------------------------------------------------------------------------
// The record layer keeps both, and only once set
// -----------------------------------------------------------------------------
const R = await load('51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', `
    const Na__LeCfg__GetViewportSetup = () => ({ minSizeMm : 10, defaultWidthMm : 100, defaultHeightMm : 80 });
    const Na__LeCfg__GetLabel   = (k, f) => f;
    const Na__LeCfg__GetSheetSetup = () => ({});
    const Na__LeScale__Coerce   = (d) => d || 50;
    const Na__LeGrad__Normalise = (g) => g || null;
    const Na__LeDash__Normalise = (d) => d || null;
    const Na__LeHatch__FIELD    = 'Viewport__SitePlanHatches';
    const Na__LeHatch__CAT_FIELD = 'Hatches__Categories';
`, 'Records').catch(() => null)
const recSource = fs.readFileSync(path.resolve(SRC, '51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js'), 'utf8')
// The two normalisers are module-private, so they are run from their own source
// text: the function body as shipped, evaluated on its own.
const privateFn = (name, prelude) => {
  const at = recSource.indexOf('function ' + name + '(')
  let depth = 0, end = -1
  for (let i = recSource.indexOf('{', at); i < recSource.length; i++) {
    if (recSource[i] === '{') depth++
    else if (recSource[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  return new Function((prelude || '') + '\n' + recSource.slice(at, end) + '\nreturn ' + name + ';')()
}
void R
const normShape = privateFn('Na__LeRec__NormaliseShapeHatch')
const tidyShape = (hatch) => { const item = { Shape__Hatch : hatch }; normShape(item); return item.Shape__Hatch }
check('a shape\'s hatch keeps its own weight and colour once set',
  tidyShape({ Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__Scale : 1, Hatch__StrokePt : 0.5, Hatch__Colour : '#960000' }),
  { Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__Scale : 1, Hatch__Colour : '#960000', Hatch__StrokePt : 0.5 })
check('null, zero and a word are "the standard" and store nothing - so a hatch from before the controls saves byte for byte as it did',
  [null, 0, 'x', undefined].map((value) => tidyShape({ Hatch__PatternKey : 'ConstructionHatch__Brickwork', Hatch__StrokePt : value, Hatch__Colour : null })),
  [1, 2, 3, 4].map(() => ({ Hatch__PatternKey : 'ConstructionHatch__Brickwork' })))
const normSite = privateFn('Na__LeRec__NormaliseSitePlanHatches', `const Na__LeHatch__FIELD = 'Viewport__SitePlanHatches'; const Na__LeHatch__CAT_FIELD = 'Hatches__Categories';`)
const tidySite = (entry) => { const viewport = { Viewport__SitePlanHatches : { Hatches__Categories : { wood : entry } } }; normSite(viewport); return viewport.Viewport__SitePlanHatches || null }
check('a site plan layer keeps them too', tidySite({ Hatch__Scale : 0.5, Hatch__StrokePt : 0.4, Hatch__Colour : '#737373' }),
  { Hatches__Categories : { wood : { Hatch__Scale : 0.5, Hatch__StrokePt : 0.4, Hatch__Colour : '#737373' } } })
check('and a layer whose weight and colour were put back to standard leaves nothing behind', tidySite({ Hatch__StrokePt : null, Hatch__Colour : null }), null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
