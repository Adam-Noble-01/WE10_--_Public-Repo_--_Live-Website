// =============================================================================
// TRUEVISION3D - TEST - FLUSH JOINS (a seam between two flush faces is not a line)
// =============================================================================
//
// FILE       : Na__Test__FlushJoins__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Flush Joins Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove Na__PlFlush__CutFlushJoins on a hand-built view soup - the
//              seam between two coplanar faces is cut whether they meet to the
//              micron or to modelling tolerance, and a real step, a bare outline
//              and a face in front of the plane all keep their line
// CREATED    : 23-Sep-2026
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__FlushJoins__.test.mjs
//
// HOW IT WORKS:
// - The shipped module is a leaf (it imports nothing), so it is copied to a
//   temporary .mjs and imported as it ships.
// - The soup is built by hand in VIEW SPACE, the shape Na__PlSoup__BuildViewSoup
//   returns: the page is x and z, depth is y towards the viewer; Positions
//   are nine doubles per triangle, UpPlanes four (a normal facing the viewer
//   and its constant), FlatAreas the page area; the bounds tree is one leaf
//   holding every triangle, which is all the walker needs.
// - Every case is a wall of two rectangles in the plane y = 0 meeting along
//   z = 3.9, and the edge under test is the lower rectangle's top side, lifted
//   the 1e-6 the pipeline lifts every edge.
//
// WHAT IT GUARDS:
// - THE TOLERANCE (23-Sep-2026, v2.159.0). RB05's first floor walls start
//   0.0000134 m above the slab they stand on - a seam SketchUp itself (0.0254 mm
//   tolerance) cannot tell from flush - and at a 1e-6 line tolerance that
//   seam drew a line across every elevation. It is cut at 0.1 mm.
// - THE OTHER SIDE OF THE RULE. A 1 mm step is a step; an outline against
//   nothing keeps its line; a face 1 mm in front of the plane is another
//   surface; a join over half the edge leaves the other half.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Written with FlushJoins 1.1.0 (TrueVision3D v2.159.0).
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

function load (relative, tag) {
  const file = path.resolve(SRC, relative)
  const src  = fs.readFileSync(file, 'utf8')
  if (/^\s*import\s/m.test(src)) { console.error('FAIL: ' + relative + ' is no longer a leaf; this harness expects no imports'); process.exit(1) }
  const tmp = path.join(os.tmpdir(), 'Na__Test__' + tag + '__.mjs')
  fs.writeFileSync(tmp, src, 'utf8')
  return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2))
}

const flush = await load('50__System__ProjectedLinework/Na__ProjectedLinework__FlushJoins__.js', 'FlushJoins')
const cut   = flush.Na__PlFlush__CutFlushJoins

// -----------------------------------------------------------------------------
// REGION | A view soup by hand
// -----------------------------------------------------------------------------

// A rectangle on the page (x0..x1, z0..z1) at depth y, as two triangles.
function rect (x0, x1, z0, z1, y) {
  return [
    [ [ x0, y, z0 ], [ x1, y, z0 ], [ x1, y, z1 ] ],
    [ [ x0, y, z0 ], [ x1, y, z1 ], [ x0, y, z1 ] ]
  ]
}

function soup (tris) {
  const n = tris.length
  const positions = new Float64Array(n * 9)
  const upPlanes  = new Float64Array(n * 4)
  const flatAreas = new Float64Array(n)
  const bounds    = [ Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity ]
  tris.forEach((tri, t) => {
    tri.forEach((p, k) => {
      positions.set(p, (t * 9) + (k * 3))
      bounds[0] = Math.min(bounds[0], p[0]); bounds[3] = Math.max(bounds[3], p[0])
      bounds[1] = Math.min(bounds[1], p[1]); bounds[4] = Math.max(bounds[4], p[1])
      bounds[2] = Math.min(bounds[2], p[2]); bounds[5] = Math.max(bounds[5], p[2])
    })
    // Every triangle here lies in a plane y = d facing the viewer: (0, 1, 0, -d).
    upPlanes.set([ 0, 1, 0, -tri[0][1] ], t * 4)
    const [ a, b, c ] = tri
    flatAreas[t] = 0.5 * Math.abs(((b[0] - a[0]) * (c[2] - a[2])) - ((c[0] - a[0]) * (b[2] - a[2])))
  })
  return {
    Positions : positions,
    UpPlanes  : upPlanes,
    FlatAreas : flatAreas,
    Bvh       : { NodeBounds : new Float64Array(bounds), NodeData : new Int32Array([ 0, n ]), PrimIndex : new Int32Array(tris.map((_, i) => i)), NodeCount : 1 }
  }
}

const LIFT = 1e-6
const seam = (x0, x1, z) => ({ Count : 1, Verts : new Float64Array([ x0, LIFT, z, x1, LIFT, z ]), Owners : new Uint16Array([ 3 ]) })

const lower = rect(0, 10, 0, 3.9, 0)
const pieces = (result) => {
  const out = []
  for (let e = 0; e < result.Count; e++) out.push([ +result.Verts[e * 6].toFixed(6), +result.Verts[(e * 6) + 3].toFixed(6) ])
  return out
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The cases
// -----------------------------------------------------------------------------

{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 10, 3.9, 7, 0))), edges)
  check('two faces flush to the double: the seam is cut whole', [ got.Count, got.CutEdges ], [ 0, 1 ])
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 10, 3.9 + 0.0000134, 7, 0))), edges)
  check('the upper face 13.4 microns up (RB05\'s first floor wall): still a flush join, cut whole', [ got.Count, got.CutEdges ], [ 0, 1 ])
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 10, 3.9 + 0.00002, 7, 0))), edges)
  check('20 microns up (under SketchUp\'s own 0.0254 mm): cut', [ got.Count, got.CutEdges ], [ 0, 1 ])
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 10, 3.901, 7, 0))), edges)
  check('a 1 mm step is a step: the edge comes back untouched', got === edges, true)
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower), edges)
  check('an outline against nothing keeps its line', got === edges, true)
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 10, 3.9, 7, 0.001))), edges)
  check('a face 1 mm in front of the plane is another surface: kept', got === edges, true)
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(0, 4, 3.9 + 0.0000134, 7, 0))), edges)
  check('a join over the left 4 m leaves the right 6 m as a line', [ got.Count, pieces(got), Array.from(got.Owners) ], [ 1, [ [ 4, 10 ] ], [ 3 ] ])
}
{
  const edges = seam(0, 10, 3.9)
  const got   = cut(soup(lower.concat(rect(2, 4, 3.9, 7, 0)).concat(rect(6, 8, 3.9 + 0.00001, 7, 0))), edges)
  check('two joins leave three pieces, each with the owner tag', [ got.Count, pieces(got), Array.from(got.Owners) ], [ 3, [ [ 0, 2 ], [ 4, 6 ], [ 8, 10 ] ], [ 3, 3, 3 ] ])
}

// endregion -------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
