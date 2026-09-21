// =============================================================================
// TRUEVISION3D - TEST - COLOUR PALETTE
// =============================================================================
//
// FILE       : Na__Test__ColourPalette__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Colour Palette Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Colour Palette Manager reads its config as written, and that every colour field has the palette
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Runs the SHIPPED modules of 54__Feature__ColourPalette in Node: the
//   manager as it stands (it is a leaf), the picker with its one import
//   swapped for the manager just loaded. No browser, no server.
// - THE CONFIG. The standard palette holds Monochrome then Dimensions; the ten
//   greys are the Edge Materials SSOT's MTE100 series value for value (checked
//   against the SSOT file itself when this machine has it); the dimension
//   colours are the three Adam gave; every hex agrees with its rgb; every
//   technical name is three-stage, unique and the same as its key.
// - THE MANAGER. Colours in any written form come out as one lower case hex;
//   lookup by technical name and by hex; the palette on show is remembered.
// - THE PICKER'S PLACING, which is pure arithmetic: over the field with room
//   below, moved up near the foot of the window, moved down near its top.
// - THE WIRING. Every <input type="color"> this codebase makes either comes
//   from Na__LePanels__Input (which attaches the palette itself) or is handed
//   to Na__ColourPalette__Attach in the same file. A colour field added later
//   without the palette fails here, by file name.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ColourPalette__.test.mjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - For TrueVision3D v2.133.0: the mixer-on-top-of-the-palette stack (above,
//   beside, over), the page zoom estimate, Special as the green, and the click
//   against a stand-in page that records the ORDER of events - the check that
//   would have caught the mixer opening in the corner of Adam's window. It
//   fails if the proxy's measuring line is taken out of the shipped picker.
//
// 21-Sep-2026 - Version 1.0.0
// - Written with the Colour Palette (TrueVision3D v2.126.0).
//
// =============================================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const SRC  = path.resolve(HERE, '../02__Src__AppModules')
const DIR  = path.resolve(SRC, '54__Feature__ColourPalette')

let pass = 0, fail = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}

// The shipped file, with its imports swapped for stubs and nothing else touched.
function load (file, stubs, tag) {
  let src = fs.readFileSync(file, 'utf8')
  const had = /^\s*import\s/m.test(src)
  src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '')
  if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + file); process.exit(1) }
  const tmp = path.join(os.tmpdir(), 'Na__Test__' + tag + '__.mjs')
  fs.writeFileSync(tmp, stubs + '\n' + src, 'utf8')
  return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2))
}

// -----------------------------------------------------------------------------
// A browser's worth of globals: the config over fetch, and a localStorage
// -----------------------------------------------------------------------------
const CONFIG_FILE = path.join(DIR, 'Na__ColourPalette__Config__.json')
const store = new Map()
const events = []
globalThis.window = {
  localStorage : { getItem : (k) => (store.has(k) ? store.get(k) : null), setItem : (k, v) => store.set(k, String(v)) },
  dispatchEvent : (event) => { events.push(event); return true },
  addEventListener () {}, removeEventListener () {}
}
globalThis.CustomEvent = class { constructor (type, init) { this.type = type; this.detail = init ? init.detail : null } }
let served = null                                       // <-- null serves the repo's own config
globalThis.fetch = async (url) => {
  if (!/Na__ColourPalette__Config__\.json$/.test(decodeURIComponent(String(url)))) return { ok : false, status : 404 }
  return { ok : true, status : 200, json : async () => (served || JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))) }
}
const quiet = (fn) => { const w = console.warn, l = console.log; const said = []; console.warn = (...a) => said.push(a.join(' ')); console.log = () => {}; return Promise.resolve(fn()).finally(() => { console.warn = w; console.log = l }).then(() => said) }

// -----------------------------------------------------------------------------
// The config, read by the shipped manager
// -----------------------------------------------------------------------------
const M = await load(path.join(DIR, 'Na__ColourPalette__Manager__.js'), '', 'PaletteManager')
check('nothing is available before the config has loaded', M.Na__ColourPalette__IsAvailable(), false)
check('and a standard colour asked for early gives its fallback, not undefined',
  M.Na__ColourPalette__Hex('ColourPalette__Dimensions__Proposed', '#960000'), '#960000')
const loadWarnings = await quiet(() => M.Na__ColourPalette__Ready())
check('the shipped config loads without a single warning', loadWarnings, [])
check('and then the palette is available', M.Na__ColourPalette__IsAvailable(), true)
check('loading is announced once, as "loaded"', events.map((e) => e.detail.reason), ['loaded'])

const palettes = M.Na__ColourPalette__GetPalettes()
const standard = M.Na__ColourPalette__GetActivePalette()
check('one palette to start with, and it is the one on show', [palettes.length, standard.Palette__Key], [1, 'ColourPalette__Standard'])
check('its groups are Monochrome then Dimensions, in the order written',
  standard.Palette__Groups.map((g) => [g.Group__Key, g.Group__MenuName]),
  [['ColourPalette__Monochrome', 'Monochrome'], ['ColourPalette__Dimensions', 'Dimensions']])

const mono = standard.Palette__Groups[0].Group__Colours
const dims = standard.Palette__Groups[1].Group__Colours
check('Monochrome is the ten SSOT greys, black to white',
  mono.map((c) => c.Colour__Hex),
  ['#000000', '#333333', '#666666', '#737373', '#999999', '#b4b4b4', '#cccccc', '#d9d9d9', '#f2f2f2', '#ffffff'])
// Adam, on seeing the first build's row of red, black and blue: "the special colour is
// like a black, but I meant for it to be a green. It's effectively the 150 RGB equivalent
// of the other two that have 150 values, but the green, because the others are red and blue."
check('Dimensions are Proposed red, Existing blue and Special GREEN, each at 150 - no black in the row',
  dims.map((c) => [c.Colour__TechnicalName, c.Colour__MenuName, c.Colour__Rgb]),
  [['ColourPalette__Dimensions__Proposed', 'Proposed', [150, 0, 0]],
   ['ColourPalette__Dimensions__Existing', 'Existing', [0, 0, 150]],
   ['ColourPalette__Dimensions__Special',  'Special',  [0, 150, 0]]])
check('the three are one family: every one has a single channel at 150 and the rest at nothing',
  dims.map((c) => c.Colour__Rgb.slice().sort((a, b) => a - b)), [[0, 0, 150], [0, 0, 150], [0, 0, 150]])
check('every colour carries a menu name, a technical name and the menu name of its group',
  mono.concat(dims).every((c) => c.Colour__MenuName && c.Colour__TechnicalName === c.Colour__Key && c.Colour__MenuGroup), true)

// The file itself, not the manager's reading of it: a slip the loader forgives
// (and warns about) must still fail here, where somebody will see it.
const doc = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
const written = []
Object.values(doc.ColourPalette__Palettes).forEach((p) => Object.entries(p.Palette__Groups).forEach(([gKey, g]) =>
  Object.entries(g.Group__Colours).forEach(([cKey, c]) => written.push({ gKey, g, cKey, c }))))
check('every technical name is three-stage, ColourPalette__{Group}__{Colour}, and sits under its own group',
  written.filter((w) => !/^ColourPalette__[A-Za-z0-9]+__[A-Za-z0-9]+$/.test(w.cKey) || !w.cKey.startsWith(w.gKey + '__')).map((w) => w.cKey), [])
check('every block names itself as its key does', written.filter((w) => w.c.Colour__TechnicalName !== w.cKey).map((w) => w.cKey), [])
check('every block names the group it sits in', written.filter((w) => w.c.Colour__MenuGroup !== w.g.Group__MenuName).map((w) => w.cKey), [])
check('every hex agrees with the rgb written beside it',
  written.filter((w) => M.Na__ColourPalette__ToHex(w.c.Colour__Hex) !== M.Na__ColourPalette__ToHex(w.c.Colour__Rgb)).map((w) => w.cKey), [])
check('no technical name is used twice', written.length, new Set(written.map((w) => w.cKey)).size)

// THE SSOT. The greys were copied from another repository's file, so the copy is
// checked against the original wherever the original is installed.
const SSOT = path.join(process.env.APPDATA || '', 'SketchUp/SketchUp 2026/SketchUp/Plugins/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__EdgeMaterials__.json')
if (fs.existsSync(SSOT)) {
  const series = JSON.parse(fs.readFileSync(SSOT, 'utf8')).Na__DataLib__CoreIndex__EdgeMaterials.MTE100__GreyscaleSeries__
  check('the Monochrome group IS the SSOT greyscale series: same keys, same order, same values',
    mono.map((c) => [c.Colour__SsotKey, c.Colour__Hex, c.Colour__MenuName]),
    Object.entries(series).map(([key, entry]) => [key, entry.HexValue.toLowerCase(), entry.SwatchName]))
} else {
  console.log('SKIP  the Edge Materials SSOT is not installed on this machine; the greys were checked against the values written above')
}

// -----------------------------------------------------------------------------
// Colour values, lookups and the palette on show
// -----------------------------------------------------------------------------
check('a colour written any of the ways this codebase writes one comes out as one lower case hex',
  ['#D9D9D9', '#abc', 'rgb(150, 0, 0)', 'rgb(0,0,150)', [242, 242, 242]].map(M.Na__ColourPalette__ToHex),
  ['#d9d9d9', '#aabbcc', '#960000', '#000096', '#f2f2f2'])
check('and anything that is not a colour is null, never black',
  ['red', '#12345', 'rgb(300,0,0)', 'rgba(0,0,0,0.5)', [0, 0], null, undefined, ''].map(M.Na__ColourPalette__ToHex),
  [null, null, null, null, null, null, null, null])
check('a standard colour by its technical name', M.Na__ColourPalette__Hex('ColourPalette__Dimensions__Special', '#123456'), '#009600')
check('a name the file has not got gives the fallback', M.Na__ColourPalette__Hex('ColourPalette__Dimensions__Nope', '#123456'), '#123456')
check('a field\'s colour is named from the palette, whatever case it was written in',
  [M.Na__ColourPalette__FindByHex('#000000').Colour__TechnicalName, M.Na__ColourPalette__FindByHex('#009600').Colour__MenuName], ['ColourPalette__Monochrome__AbsoluteBlack', 'Special'])
check('a colour the palette has not got is null', M.Na__ColourPalette__FindByHex('#172b3a'), null)

// A second palette, a broken colour and a duplicate, through the same loader.
const M2 = await load(path.join(DIR, 'Na__ColourPalette__Manager__.js'), '', 'PaletteManagerTwo')
served = JSON.parse(JSON.stringify(doc))
served.ColourPalette__Palettes.ColourPalette__Second = { Palette__MenuName : 'Second', Palette__Groups : {
  ColourPalette__Odd : { Group__MenuName : 'Odd', Group__Colours : {
    ColourPalette__Odd__RgbOnly   : { Colour__MenuName : 'Rgb only', Colour__Rgb : [1, 2, 3] },
    ColourPalette__Odd__Broken    : { Colour__MenuName : 'Broken', Colour__Hex : 'not a colour' },
    ColourPalette__Odd__Disagrees : { Colour__MenuName : 'Disagrees', Colour__Hex : '#112233', Colour__Rgb : [9, 9, 9] },
    ColourPalette__Monochrome__White : { Colour__MenuName : 'A second white', Colour__Hex : '#FFFFFF' }
  } },
  ColourPalette__Empty : { Group__MenuName : 'Empty', Group__Colours : {} }
} }
const oddWarnings = await quiet(() => M2.Na__ColourPalette__Ready())
served = null
const second = M2.Na__ColourPalette__GetPalettes()[1]
check('a colour given as rgb alone gets its hex; a broken one and a duplicate name are skipped; an empty group is dropped',
  [second.Palette__Groups.length, second.Palette__Groups[0].Group__Colours.map((c) => [c.Colour__Key, c.Colour__Hex])],
  [1, [['ColourPalette__Odd__RgbOnly', '#010203'], ['ColourPalette__Odd__Disagrees', '#112233']]])
check('and each slip is said on the console: no colour, a disagreement, a name used twice',
  [/Odd__Broken has no readable/.test(oddWarnings.join('|')), /Odd__Disagrees: Colour__Hex #112233 and Colour__Rgb #090909 disagree/.test(oddWarnings.join('|')), /Monochrome__White is used twice/.test(oddWarnings.join('|'))],
  [true, true, true])
check('the palette on show starts as the config\'s default', M2.Na__ColourPalette__GetActivePalette().Palette__Key, 'ColourPalette__Standard')
check('another can be put up, once; it is remembered; a key the file has not got is refused',
  [M2.Na__ColourPalette__SetActivePalette('ColourPalette__Second'), M2.Na__ColourPalette__SetActivePalette('ColourPalette__Second'),
   M2.Na__ColourPalette__SetActivePalette('ColourPalette__Nope'), M2.Na__ColourPalette__GetActivePalette().Palette__Key, store.get('na-colourpalette-active')],
  [true, false, false, 'ColourPalette__Second', 'ColourPalette__Second'])
check('a remembered palette the file no longer has falls back to the default',
  (store.set('na-colourpalette-active', 'ColourPalette__Second'), M.Na__ColourPalette__GetActivePalette().Palette__Key), 'ColourPalette__Standard')

// -----------------------------------------------------------------------------
// The picker's placing
// -----------------------------------------------------------------------------
globalThis.__M = M
const P = await load(path.join(DIR, 'Na__ColourPalette__Picker__.js'),
  ['Na__ColourPalette__CHANGED_EVENT', 'Na__ColourPalette__Ready', 'Na__ColourPalette__IsAvailable', 'Na__ColourPalette__GetDisplay', 'Na__ColourPalette__GetLabel',
   'Na__ColourPalette__GetPalettes', 'Na__ColourPalette__GetActivePalette', 'Na__ColourPalette__SetActivePalette', 'Na__ColourPalette__FindColour',
   'Na__ColourPalette__FindByHex', 'Na__ColourPalette__ToHex'].map((name) => `const ${name} = globalThis.__M.${name};`).join('\n'), 'PalettePicker')
// ONE STACK: THE BROWSER'S MIXER ON TOP, THE PALETTE UNDER IT. Adam, over a screenshot
// with the mixer in the far corner of the window and a box drawn on top of the palette:
// "The custom colour mixer is miles away. You need to move it so it's above our main one."
// The browser hangs its mixer UNDER the box it is opened from, left edges together, so
// the proxy's FOOT is where the mixer's top will be.
const view  = { width : 1600, height : 900 }
const size  = { width : 277, height : 145 }
const mixer = { width : 232, height : 250, gap : 4, reserve : true }
const field = (top, left) => ({ left : left === undefined ? 1500 : left, right : (left === undefined ? 1500 : left) + 44, top : top, bottom : top + 24, width : 44, height : 24 })
const stack = (spot) => ({ where : spot.where, mixerTop : spot.proxy.top + spot.proxy.height, mixerLeft : spot.proxy.left,
  mixerFoot : spot.proxy.top + spot.proxy.height + mixer.height, paletteTop : spot.palette.top, paletteLeft : spot.palette.left, paletteFoot : spot.palette.top + size.height })

const above = stack(P.Na__ColourPicker__Place(field(600), size, view, mixer))
check('with room above the field the stack sits over it: palette 6 px above the field, right edges together',
  [above.where, above.paletteFoot, above.paletteLeft + size.width], ['above', 600 - 6, 1544])
check('and the mixer is hung to END 4 px above the palette, its left edge on the palette\'s - where Adam drew the box',
  [above.mixerFoot, above.mixerLeft, above.mixerTop], [above.paletteTop - 4, above.paletteLeft, 600 - 6 - 145 - 4 - 250])

const beside = stack(P.Na__ColourPicker__Place(field(400), size, view, mixer))
check('too near the top for both, the stack goes BESIDE the field - to its left, as the panels are down the right - foot level with the field\'s',
  [beside.where, beside.paletteLeft + size.width, beside.paletteFoot], ['beside', 1500 - 6, 424])
check('and the order has not changed: the mixer is still on top of the palette, never under the field',
  [beside.mixerFoot, beside.mixerLeft, beside.mixerTop >= 8], [beside.paletteTop - 4, beside.paletteLeft, true])
const besideHigh = stack(P.Na__ColourPicker__Place(field(40), size, view, mixer))
check('a field at the very top keeps the whole stack inside the window', [besideHigh.where, besideHigh.mixerTop, besideHigh.paletteFoot], ['beside', 8, 8 + 250 + 4 + 145])
const leftPanel = stack(P.Na__ColourPicker__Place(field(200, 120), size, view, mixer))
check('in the LEFT panel there is no room to the field\'s left, so the stack goes to its right',
  [leftPanel.where, leftPanel.paletteLeft], ['beside', 120 + 44 + 6])
const tiny = P.Na__ColourPicker__Place(field(200, 120), size, { width : 420, height : 900 }, mixer)
check('in a window too narrow for either side it is kept inside the window, over whatever it must be',
  [tiny.where, tiny.palette.left >= 8, tiny.palette.left + size.width <= 420 - 8], ['over', true, true])
check('nothing ever lands outside the window, wherever the field is',
  [20, 200, 420, 600, 860].flatMap((top) => [40, 700, 1500].map((left) => { const s = stack(P.Na__ColourPicker__Place(field(top, left), size, view, mixer))
    return s.mixerTop >= 8 && s.paletteLeft >= 8 && s.paletteLeft + size.width <= 1600 - 8 && s.paletteFoot <= 900 - 8 && s.mixerFoot === s.paletteTop - 4 })), new Array(15).fill(true))
const off = P.Na__ColourPicker__Place(field(600), size, view, Object.assign({}, mixer, { reserve : false }))
check('with the mixer switched off no room is kept for it: the palette alone sits over the field, and a mixer asked for later still goes on top',
  [off.palette.top, off.proxy.top + 1], [600 - 6 - 145, 600 - 6 - 145 - 4 - 250])

// THE PAGE ZOOM. The mixer is a window of the browser's and does not zoom with the page.
check('a maximised window at 100 % reads as 100 %, hidden window edges and all', P.Na__ColourPicker__PageZoom(2576, 2560, 1), 1)
check('125 % and 80 % are read off the two widths', [P.Na__ColourPicker__PageZoom(2576, 2048, 1.25), P.Na__ColourPicker__PageZoom(2576, 3200, 0.8)], [1.25, 0.8])
check('a display set to 150 % at 100 % zoom is NOT mistaken for zoom', P.Na__ColourPicker__PageZoom(1723, 1707, 1.5), 1)
check('a docked side panel narrows the page like a zoom would; it is only believed if the pixel ratio agrees',
  [P.Na__ColourPicker__PageZoom(2576, 1900, 1), P.Na__ColourPicker__PageZoom(2576, 2061, 1)], [1, 1])
check('a test pane emulating a 1400 px page in a 1024 px window (seen 21-Sep-2026, where it read as 75 % and left an 87 px gap) is not a zoom step',
  P.Na__ColourPicker__PageZoom(1024, 1400, 1.5), 1)
check('anything unreadable is 100 %', [P.Na__ColourPicker__PageZoom(0, 0, 0), P.Na__ColourPicker__PageZoom(undefined, 100, 1)], [1, 1])

check('a field is only attached if it IS a colour input', [P.Na__ColourPicker__Attach(null), P.Na__ColourPicker__Attach({ tagName : 'INPUT', type : 'text' })], [false, false])

// -----------------------------------------------------------------------------
// The click, against a stand-in page that records the ORDER things happen in
// -----------------------------------------------------------------------------
// THE FAULT THIS IS HERE FOR. The browser hangs its mixer from the proxy's box AS LAST
// LAID OUT - showPicker does not lay the page out first. The first build appended the
// proxy, measured the field (which laid the proxy out at the end of the page), THEN
// placed it and asked for the mixer, which opened in the bottom left corner of Adam's
// window. It passed every check, because the in-app stand-in for showPicker measured the
// proxy - the cure. So what is asserted is the order: placed BEFORE it enters the page,
// and measured after the last change to it and before showPicker.
const log = []
class FakeElement {
  constructor (tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.listeners = {}; this.attributes = {}
    this.hidden = false; this.className = ''; this.value = ''; this.textContent = ''
    const owner = this
    this.style = new Proxy({ setProperty () {} }, { set (target, key, value) { target[key] = value; if (owner.className === 'na-colour-palette__proxy') log.push('style.' + String(key)); return true } })
    this.classList = { toggle () {}, add () {}, remove () {}, contains : () => false }
  }
  get isConnected () { let node = this; while (node.parentNode) node = node.parentNode; return node === fakeBody }
  get offsetWidth () { return this.className === 'na-colour-palette' ? 277 : 44 }
  get offsetHeight () { return this.className === 'na-colour-palette' ? 145 : 24 }
  setAttribute (k, v) { this.attributes[k] = String(v) }
  getAttribute (k) { return this.attributes[k] === undefined ? null : this.attributes[k] }
  addEventListener (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn) }
  removeEventListener () {}
  dispatchEvent (event) { (this.listeners[event.type] || []).forEach((fn) => fn(event)); return true }
  appendChild (child) { child.parentNode = this; this.children.push(child); if (child.className === 'na-colour-palette__proxy') log.push('append'); return child }
  removeChild (child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child }
  querySelector () { return null }
  querySelectorAll () { return [] }
  contains () { return false }
  getBoundingClientRect () {
    if (this.className === 'na-colour-palette__proxy') log.push('measure')
    return this.rect || { left : 0, right : 0, top : 0, bottom : 0, width : 0, height : 0 }
  }
  showPicker () { log.push('showPicker') }
  blur () {}
}
const fakeBody = new FakeElement('body')
globalThis.document = { body : fakeBody, activeElement : null, createElement : (tag) => new FakeElement(tag), addEventListener () {}, removeEventListener () {} }
Object.assign(globalThis.window, { innerWidth : 1600, innerHeight : 900, outerWidth : 1616, devicePixelRatio : 1, top : null })
globalThis.window.top = globalThis.window

const colourField = new FakeElement('input')
colourField.type = 'color'; colourField.value = '#172b3a'; colourField.disabled = false
colourField.rect = field(600)
fakeBody.appendChild(colourField)
check('a colour input is attached, once', [P.Na__ColourPicker__Attach(colourField), P.Na__ColourPicker__Attach(colourField)], [true, false])
let prevented = false
colourField.listeners.click[0]({ currentTarget : colourField, preventDefault () { prevented = true } })
const proxyEl = fakeBody.children.find((c) => c.className === 'na-colour-palette__proxy')
const paletteEl = fakeBody.children.find((c) => c.className === 'na-colour-palette')
check('a click on the field is cancelled (or the browser would hang its mixer from the FIELD) and opens the palette', [prevented, P.Na__ColourPicker__IsOpen(), !!paletteEl && paletteEl.hidden === false], [true, true, true])
check('the proxy is given its whole box BEFORE it enters the page, so it is never laid out anywhere else',
  [log.indexOf('append') > -1, ['style.left', 'style.top', 'style.width', 'style.height'].every((w) => log.indexOf(w) > -1 && log.indexOf(w) < log.indexOf('append'))], [true, true])
check('and it is measured after the last change to it and straight before showPicker - the layout the browser hangs the mixer from is current',
  [log[log.length - 1], log[log.length - 2], log.slice(log.lastIndexOf('measure')).some((w) => w.startsWith('style.'))], ['showPicker', 'measure', false])
check('the proxy is the strip along the top of the stack, and carries the field\'s colour into the mixer',
  [proxyEl.style.left, proxyEl.style.top, proxyEl.style.height, proxyEl.value, paletteEl.style.top, paletteEl.getAttribute('data-na-colour-place')],
  ['1267px', (600 - 6 - 145 - 4 - 250 - 1) + 'px', '1px', '#172b3a', (600 - 6 - 145) + 'px', 'above'])
proxyEl.value = '#336699'
proxyEl.dispatchEvent({ type : 'input' })
check('what the mixer does to the proxy reaches the field', colourField.value, '#336699')
const heard = []
colourField.addEventListener('input', () => heard.push('input')); colourField.addEventListener('change', () => heard.push('change'))
check('a swatch pick puts the colour in the field, tells it as the browser would, and closes both',
  [P.Na__ColourPicker__Pick('ColourPalette__Dimensions__Special'), colourField.value, heard, P.Na__ColourPicker__IsOpen(), fakeBody.children.indexOf(proxyEl)],
  [true, '#009600', ['input', 'change'], false, -1])
proxyEl.value = '#ff00ff'
proxyEl.dispatchEvent({ type : 'change' })
check('and the mixer\'s late report as it closes cannot land over the colour just picked', colourField.value, '#009600')

// -----------------------------------------------------------------------------
// The wiring: no colour field without the palette
// -----------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', '01__Dependencies__VersionLocked', '00__ArchivedVersions'])
const jsFiles = (dir, acc = []) => { fs.readdirSync(dir).forEach((entry) => { if (SKIP_DIRS.has(entry)) return; const full = path.join(dir, entry); fs.statSync(full).isDirectory() ? jsFiles(full, acc) : (entry.endsWith('.js') && acc.push(full)) }); return acc }
const makesColourInput = /\.type\s*=\s*'color'|type\s*=\s*"color"|setAttribute\(\s*'type'\s*,\s*'color'\s*\)/
const bare = jsFiles(SRC)
  .filter((file) => !file.startsWith(DIR))                                     // <-- The picker's own proxy is a colour input by design
  .filter((file) => makesColourInput.test(fs.readFileSync(file, 'utf8')))
  .filter((file) => !/Na__ColourPalette__Attach\(/.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(SRC, file))
check('every file that makes its own <input type="color"> hands it to Na__ColourPalette__Attach', bare, [])
const host = fs.readFileSync(path.join(SRC, '51__System__LayoutEditor/40__Ui__Panels/Na__LayoutEditor__PanelHost__.js'), 'utf8')
check('and the panel host attaches every colour input its factory makes, which is every colour field in the editor\'s panels',
  /if \(type === 'color'\) Na__ColourPalette__Attach\(input\);/.test(host), true)
const index = fs.readFileSync(path.resolve(HERE, '../03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css'), 'utf8')
check('the stylesheet is imported by the style index, so the service worker\'s token governs it (never injected on first use)',
  /@import url\('\.\.\/02__Src__AppModules\/54__Feature__ColourPalette\/Na__ColourPalette__Styles__\.css'\);/.test(index), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
