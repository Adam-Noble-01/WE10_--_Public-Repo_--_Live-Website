// =============================================================================
// TRUEVISION3D - TEST - SITE PLAN FACES (a face's outer ring with its holes behind it)
// =============================================================================
//
// FILE       : Na__Test__SitePlanFaces__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Site Plan Faces Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove Na__LeRings__FacesFromRings - the grouping the PDF exporter
//              and the document publisher paint a site plan's washes and hatches
//              through - against the SHIPPED module and, where it is on disk,
//              RB05's real fill data
// CREATED    : 23-Sep-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__SitePlanFaces__.test.mjs
//
// HOW IT WORKS:
// - Same harness as Na__Test__SitePlanComposites__.test.mjs: the shipped .js is
//   read, its import statements (it has none - ShapeRings is a leaf) are
//   replaced with stubs, and the file runs byte-for-byte as it ships.
// - The second half reads RB05's proposed site plan fill GLBs straight off
//   the repository (a fill GLB is LINE_LOOP rings tagged Na__SitePlanFace and
//   Na__SitePlanRing in their extras) and checks the invariant the painters
//   rely on: every inner ring lands on a face that has an outline, and no
//   ring is lost. Skipped, not failed, when the project is not on this PC.
//
// WHAT IT GUARDS:
// - THE HOLE. A face's inner rings ride behind its outer ring as one run of
//   points with the hole starts - the shape a holed vector carries and the
//   polyline primitive fills even-odd. Painted as outer rings alone, RB05's
//   published D13 hatched grass across the lake and ripples across the island
//   (23-Sep-2026).
// - A ring with no face index, or a second outline under one index, is a face
//   of its own; a ring under three corners is dropped; a face with only holes
//   is dropped; the point mapper reaches every point.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Written with ShapeRings 1.1.0 (TrueVision3D v2.160.0).
//
// =============================================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules')
const RB05 = path.resolve(HERE, '../../../na-project-portal/26-Projects/RB05__WestFarm/30__TrueVision__AppContent/SitePlan__DrawingData__Proposed')

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
  src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '')
  if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1) }
  const tmp = path.join(os.tmpdir(), 'Na__Test__' + tag + '__.mjs')
  fs.writeFileSync(tmp, stubs + '\n' + src, 'utf8')
  return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2))
}

const rings = await load('51__System__LayoutEditor/15__Core__Markup/Na__LayoutEditor__ShapeRings__.js', '', 'SitePlanFacesRings')
const faces = rings.Na__LeRings__FacesFromRings

// -----------------------------------------------------------------------------
// REGION | Hand-built rings
// -----------------------------------------------------------------------------

const square = (x, y, s) => [ x, y, x + s, y, x + s, y + s, x, y + s ]

// A field with a lake in it, then the lake as a face of its own.
{
  const got = faces([
    { face : 0, outer : true,  points : square(0, 0, 100) },
    { face : 0, outer : false, points : square(30, 30, 20) },
    { face : 1, outer : true,  points : square(30, 30, 20) }
  ])
  check('a face with a hole is one run: outline then hole, the hole start named',
    got.map((f) => [ f.points.length, f.holes ]), [ [ 8, [ 4 ] ], [ 4, [] ] ])
  check('the hole\'s points follow the outline\'s in the run', got[0].points.slice(4), [ [ 30, 30 ], [ 50, 30 ], [ 50, 50 ], [ 30, 50 ] ])
  check('Spans splits the run back into its rings', rings.Na__LeRings__Spans(got[0].points.length, got[0].holes), [ [ 0, 4 ], [ 4, 8 ] ])
}

// Three holes on one face (RB05's Grassland), in whatever order the file has them.
{
  const got = faces([
    { face : 2, outer : false, points : square(10, 10, 5) },
    { face : 2, outer : true,  points : square(0, 0, 100) },
    { face : 2, outer : false, points : square(40, 40, 5) },
    { face : 2, outer : false, points : square(70, 70, 5) }
  ])
  check('three holes, the outline arriving second, give one face with three hole starts', got.map((f) => f.holes), [ [ 4, 8, 12 ] ])
}

// Faces of their own.
{
  const got = faces([
    { outer : true, points : square(0, 0, 10) },                                  // <-- no index at all
    { outer : true, points : square(20, 0, 10) },
    { face : 7, outer : true, points : square(40, 0, 10) },
    { face : 7, outer : true, points : square(60, 0, 10) }                        // <-- a second outline under one index
  ])
  check('a ring with no face index, and a second outline under one index, are faces of their own', got.length, 4)
  check('none of them carries a hole', got.map((f) => f.holes), [ [], [], [], [] ])
}

// What is dropped.
{
  const got = faces([
    { face : 0, outer : true,  points : [ 0, 0, 10, 0 ] },                          // <-- two corners: not a ring
    { face : 1, outer : false, points : square(0, 0, 10) },                          // <-- a hole with no outline
    { face : 2, outer : true,  points : square(0, 0, 10) },
    { face : 2, outer : false, points : [ 1, 1, 2, 1 ] },                            // <-- a hole too short to be one
    null
  ])
  check('a ring under three corners, a face with only holes, and a null are dropped', got.map((f) => [ f.points.length, f.holes ]), [ [ 4, [] ] ])
  check('nothing at all gives nothing', faces(undefined), [])
}

// The point mapper reaches every point of every ring.
{
  const got = faces([
    { face : 0, outer : true,  points : square(0, 0, 100) },
    { face : 0, outer : false, points : square(30, 30, 20) }
  ], (x, y) => [ x / 10, -y / 10 ])
  check('toPoint maps the outline and the hole alike', got[0].points, [ [ 0, -0 ], [ 10, -0 ], [ 10, -10 ], [ 0, -10 ], [ 3, -3 ], [ 5, -3 ], [ 5, -5 ], [ 3, -5 ] ])
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | RB05's real fill data, when it is on this PC
// -----------------------------------------------------------------------------

// A site plan fill GLB: LINE_LOOP primitives, one per ring, tagged in extras.
function readFillGlb (file) {
  const buf   = fs.readFileSync(file)
  const view  = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const total = view.getUint32(8, true)
  let at = 12, json = null, bin = null
  while (at < total) {
    const len = view.getUint32(at, true), type = view.getUint32(at + 4, true)
    const chunk = buf.subarray(at + 8, at + 8 + len)
    if (type === 0x4E4F534A) json = JSON.parse(chunk.toString('utf8'))
    else if (type === 0x004E4942) bin = chunk
    at += 8 + len
  }
  const out = []
  json.meshes.forEach((mesh) => mesh.primitives.forEach((prim, index) => {
    if (prim.mode !== 2) return
    const acc = json.accessors[prim.attributes.POSITION]
    const bv  = json.bufferViews[acc.bufferView]
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const pts = []
    for (let i = 0; i < acc.count; i++) {
      const o = base + i * (bv.byteStride || 12)
      pts.push(bin.readFloatLE(o), bin.readFloatLE(o + 8))                       // <-- x and z: the plan, in metres
    }
    const extras = prim.extras || {}
    out.push({ face : Number.isInteger(extras.Na__SitePlanFace) ? extras.Na__SitePlanFace : index, outer : extras.Na__SitePlanRing !== 'inner', points : pts })
  }))
  return out
}

if (fs.existsSync(RB05)) {
  const files = fs.readdirSync(RB05).filter((name) => /__FillModel__\.glb$/.test(name))
  let facesWithHoles = 0
  files.forEach((name) => {
    const ringsIn = readFillGlb(path.join(RB05, name))
    const got     = faces(ringsIn)
    const inner   = ringsIn.filter((r) => !r.outer && r.points.length >= 6).length
    const outer   = ringsIn.filter((r) => r.outer && r.points.length >= 6).length
    const holes   = got.reduce((n, f) => n + f.holes.length, 0)
    const points  = got.reduce((n, f) => n + f.points.length, 0)
    facesWithHoles += got.filter((f) => f.holes.length > 0).length
    check(`${name}: every outer ring is a face and every inner ring is a hole on one`, [ got.length, holes ], [ outer, inner ])
    check(`${name}: no point is lost`, points, ringsIn.reduce((n, r) => n + (r.points.length >= 6 ? r.points.length / 2 : 0), 0))
  })
  check('RB05 has at least one face with a hole (the lake in the field, the island in the lake)', facesWithHoles > 0, true)
} else {
  console.log('SKIP  RB05 proposed site plan data is not on this PC: ' + RB05)
}

// endregion -------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
