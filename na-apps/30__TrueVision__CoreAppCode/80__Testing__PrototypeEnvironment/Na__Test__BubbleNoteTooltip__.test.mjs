// =============================================================================
// TRUEVISION3D - TEST - A BUBBLE NAMES ITS NOTE, AND FINDS IT
// =============================================================================
//
// FILE       : Na__Test__BubbleNoteTooltip__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Bubble Note Tooltip and Show in Specification Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a specification bubble names its note after a moment, and its right-click menu shows the note in the Specification tab
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE NOTE RESOLVER (the shipped LeaderGeometry and SpecLinks): a linked
//   bubble and an unlinked one reading a note's code resolve to the note -
//   with a locate() that raises LOCATE_EVENT for it - and a broken, a
//   pending and a plain leader do not; a resolver that throws reads as none.
// - THE TOOLTIP (the shipped NoteTooltip, the shipped LeaderGeometry's hit
//   test, a clock the test turns): nothing at once, the code and the title
//   after NoteTooltipMs; the label follows the pointer; the circle only, not
//   the tail; a bubble in a group, on a locked layer, but not on a reference
//   layer; straight on to the next bubble names it at once; a tool picked up
//   meanwhile stops it; a press takes it down; "Untitled note"; off in the
//   config; 0 ms.
// - THE MENU (the shipped SheetTools ContextMenu, producing its items): a
//   specification bubble's menu leads with Show in Specification, its code as
//   the hint, and choosing it locates the note; a plain leader's does not; a
//   bubble right-clicked in a group, or as one of several selected, still
//   leads with it.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__BubbleNoteTooltip__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the bubble note tooltip and Show in Specification (TrueVision3D v2.144.0).
//
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LE   = path.resolve(HERE, '..', '02__Src__AppModules', '51__System__LayoutEditor');

let failures = 0;
function check(name, got, want) {
    const passed = JSON.stringify(got) === JSON.stringify(want);
    if (!passed) failures++;
    console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
    if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
}

// THE SHIPPED FILE, every name it imports given the test's stub when there is
// one, else a function returning undefined (the Hide Swings test's loader).
const IMPORT = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;
let loads = 0;
async function load(relative, stubs) {
    let src = fs.readFileSync(path.join(LE, relative), 'utf8').replace(/\r\n/g, '\n');
    const names = [];
    let m;
    IMPORT.lastIndex = 0;
    while ((m = IMPORT.exec(src)) !== null) {
        const list = m[1].trim();
        if (list.charAt(0) !== '{') continue;
        list.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
    }
    src = src.replace(IMPORT, '');
    if (/^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
    const key = '__NoteTipStubs' + (++loads);
    globalThis[key] = stubs || {};
    const head = names.map((n) => 'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };').join('\n');
    const tmp = path.join(os.tmpdir(), 'Na__Test__BubbleNoteTooltip__' + loads + '__.mjs');
    fs.writeFileSync(tmp, head + '\n' + src, 'utf8');
    return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
}

// -----------------------------------------------------------------------------
// A browser's worth of globals, and a clock the test turns
// -----------------------------------------------------------------------------
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
const dispatched = [];
let timers = [], nextTimer = 1, now = 1000;
globalThis.window = {
    dispatchEvent       : (event) => { dispatched.push({ type : event.type, detail : event.detail }); return true; },
    addEventListener    : () => {}, removeEventListener : () => {},
    setTimeout          : (fn, ms) => { const id = nextTimer++; timers.push({ id : id, at : now + (ms || 0), fn : fn }); return id; },
    clearTimeout        : (id) => { timers = timers.filter((t) => t.id !== id); }
};
const realNow = Date.now;
Date.now = () => now;
function advance(ms) {
    now += ms;
    const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at);
    timers = timers.filter((t) => t.at > now);
    due.forEach((t) => t.fn());
}

// -----------------------------------------------------------------------------
// THE LEADER GEOMETRY (shipped): a bubble to the right of its tip
// -----------------------------------------------------------------------------
const LEADER_SETUP = { bubblePaddingMm : 1.2, curveTension : 0.5, dashMm : 0.8, lineSpacing : 1.3, stubMaxFraction : 0.25, stubMm : 3, textAttach : 'first-line', textGapMm : 1, textPaddingMm : 1, noteTooltip : true, noteTooltipMs : 500 };
const G = await load('15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js', {
    Na__LeCfg__GetLeaderSetup : () => LEADER_SETUP,
    Na__LeCfg__GetTextSetup   : () => ({}),
    Na__LeCfg__PtToMm         : (pt) => pt * 0.3528,
    Na__LeChrome__MeasureTextMm : (text, fontMm) => String(text).length * fontMm * 0.6
});
const bubble = (id, extra) => Object.assign({ Leader__Id : id, Leader__Type : 'bubble', Leader__Text : 'EW01', Leader__TextSizeMm : 2.5, Leader__FontWeight : 600,
    Leader__BubbleSizeMm : 9, Leader__EndpointSizeMm : 1.6, Leader__TipXMm : 0, Leader__TipYMm : 0, Leader__AnchorXMm : 20, Leader__AnchorYMm : 0, Leader__LayerId : 'Layer_Text' }, extra || {});
const HEAD = { x : 24.5, y : 0 }, TAIL = { x : 10, y : 0 }, AWAY = { x : 80, y : 80 };

console.log('\nTrueVision3D - a bubble names its note, and finds it\n\n  The note resolver (the shipped LeaderGeometry and SpecLinks)');
check('the geometry: the circle, the tail and the tip are told apart', [ G.Na__LeLeadGeo__Hit(bubble('a'), HEAD, 1), G.Na__LeLeadGeo__Hit(bubble('a'), TAIL, 1), G.Na__LeLeadGeo__Hit(bubble('a'), { x : 0, y : 0 }, 1) ], [ 'head', 'line', 'tip' ]);
check('with nothing registered a bubble stands for no note', G.Na__LeLeadGeo__NoteFor(bubble('a')), null);

// SPECLINKS, on a specification with two notes, EW01 and EW02.
const notes = {
    SpecNote_002 : { note : { Note__Id : 'SpecNote_002', Note__Title : 'Loggia Arcade', Note__Body : 'Three arched openings.' }, group : { Group__Id : 'G1' }, code : 'EW01' },
    SpecNote_003 : { note : { Note__Id : 'SpecNote_003', Note__Title : '', Note__Body : 'Larger windows.' }, group : { Group__Id : 'G1' }, code : 'EW02' }
};
let specLoaded = true, registered = null;
const L = await load('50__Feature__Specification/Na__LayoutEditor__SpecLinks__.js', {
    Na__LeSpec__CHANGED_EVENT  : 'na-layouteditor-spec-changed',
    Na__LeSpec__LOCATE_EVENT   : 'na-layouteditor-spec-locate',
    Na__LeSpec__IsLoaded       : () => specLoaded,
    Na__LeSpec__GetNoteEntry   : (id) => notes[id] || null,
    Na__LeSpec__CodeFor        : (id) => (notes[id] ? notes[id].code : null),
    Na__LeSpec__FindByCode     : (text) => Object.values(notes).find((entry) => entry.code === String(text).toUpperCase()) || null,
    Na__LeSpec__NormaliseCode  : (text) => (/^[A-Z]{1,4}\d{1,3}$/i.test(String(text)) ? String(text).toUpperCase() : null),
    Na__LeModel__CHANGED_EVENT : 'na-layouteditor-model-changed',
    Na__LeLeadGeo__TYPE_BUBBLE : 'bubble',
    Na__LeLeadGeo__Lines       : (leader) => [ leader.Leader__Text ],
    Na__LeLeadGeo__SetCodeResolver   : () => {},
    Na__LeLeadGeo__SetBrokenResolver : () => {},
    Na__LeLeadGeo__SetNoteResolver   : (fn) => { registered = fn; }
});
L.Na__LeSpecLink__Initialize();
check('SpecLinks registers NoteOf as the note resolver', registered === L.Na__LeSpecLink__NoteOf, true);
G.Na__LeLeadGeo__SetNoteResolver(registered);

const linked  = G.Na__LeLeadGeo__NoteFor(bubble('b1', { Leader__SpecNoteId : 'SpecNote_002' }));
check('a linked bubble: its note, its code, its title, linked', [ linked.noteId, linked.code, linked.title, linked.linked, typeof linked.locate ], [ 'SpecNote_002', 'EW01', 'Loggia Arcade', true, 'function' ]);
dispatched.length = 0;
linked.locate();
check('locate() asks for the note to be shown in the Specification tab', dispatched, [ { type : 'na-layouteditor-spec-locate', detail : { noteId : 'SpecNote_002', leaderId : 'b1' } } ]);
const reads = G.Na__LeLeadGeo__NoteFor(bubble('b2', { Leader__Text : 'ew02' }));
check('an unlinked bubble reading a note\'s code: that note, not linked', [ reads.noteId, reads.code, reads.linked ], [ 'SpecNote_003', 'EW02', false ]);
check('a broken bubble (its note deleted) stands for none', G.Na__LeLeadGeo__NoteFor(bubble('b3', { Leader__SpecNoteId : 'SpecNote_099' })), null);
check('a bubble reading a code no note has stands for none', G.Na__LeLeadGeo__NoteFor(bubble('b4', { Leader__Text : 'ZZ09' })), null);
check('a note leader, not a bubble, stands for none', G.Na__LeLeadGeo__NoteFor(bubble('b5', { Leader__Type : 'text', Leader__SpecNoteId : 'SpecNote_002' })), null);
specLoaded = false;
check('before the specification has loaded, none', G.Na__LeLeadGeo__NoteFor(bubble('b6', { Leader__SpecNoteId : 'SpecNote_002' })), null);
specLoaded = true;
G.Na__LeLeadGeo__SetNoteResolver(() => { throw new Error('boom'); });
check('a resolver that throws reads as no note', G.Na__LeLeadGeo__NoteFor(bubble('b1', { Leader__SpecNoteId : 'SpecNote_002' })), null);
G.Na__LeLeadGeo__SetNoteResolver(registered);

// -----------------------------------------------------------------------------
// THE TOOLTIP
// -----------------------------------------------------------------------------
console.log('\n  The tooltip (the shipped NoteTooltip, a clock the test turns)');
const shows = [], hides = [];
const layers = { Layer_Text : { locked : false, reference : false }, Layer_Locked : { locked : true, reference : false }, Layer_Ref : { locked : true, reference : true } };
const sheet = {
    Sheet__Id : 'Sheet_001',
    Sheet__Layers : Object.keys(layers).map((id) => ({ Layer__Id : id })),
    Sheet__Leaders : [
        bubble('L1', { Leader__SpecNoteId : 'SpecNote_002' }),
        bubble('L2', { Leader__SpecNoteId : 'SpecNote_003', Leader__AnchorYMm : 40, Leader__TipYMm : 40 }),
        bubble('L3', { Leader__SpecNoteId : 'SpecNote_002', Leader__AnchorYMm : 80, Leader__TipYMm : 80, Leader__LayerId : 'Layer_Locked' }),
        bubble('L4', { Leader__SpecNoteId : 'SpecNote_002', Leader__AnchorYMm : 120, Leader__TipYMm : 120, Leader__LayerId : 'Layer_Ref' })
    ]
};
const at = (id) => { const l = sheet.Sheet__Leaders.find((x) => x.Leader__Id === id); return { x : l.Leader__AnchorXMm + 4.5, y : l.Leader__AnchorYMm }; };
let rawHit = null;
const T = await load('30__System__SheetTools/Na__LayoutEditor__SheetTools__NoteTooltip__.js', {
    Na__LeCfg__GetLeaderSetup     : () => LEADER_SETUP,
    Na__LeCfg__GetLabel           : (key, fallback) => fallback,
    Na__LeModel__IsLayerVisible   : () => true,
    Na__LeModel__IsLayerLocked    : (s, id) => !!(layers[id] && layers[id].locked),
    Na__LeModel__IsLayerSelectable : (s, id) => !(layers[id] && layers[id].reference),
    Na__LeLeadGeo__TYPE_BUBBLE    : 'bubble',
    Na__LeLeadGeo__Hit            : G.Na__LeLeadGeo__Hit,
    Na__LeLeadGeo__NoteFor        : G.Na__LeLeadGeo__NoteFor,
    Na__LeHoverTip__Show          : (text, x, y, options) => shows.push([ text, x, y, options ? options.lead : null ]),
    Na__LeHoverTip__Hide          : () => hides.push(now),
    Na__LeTools__Tolerance        : () => 1,
    Na__LeTools__Record           : (s, found) => s.Sheet__Leaders.find((l) => l.Leader__Id === found.id) || null,
    Na__LeTools__RawHit           : () => rawHit
});
let wanted = true;
const hover = (found, point, x) => T.Na__LeNoteTip__Hover(sheet, found, point, x || 100, 200, () => wanted);

hover({ kind : 'leader', id : 'L1' }, at('L1'));
check('resting on a bubble shows nothing at once', [ shows.length, T.Na__LeNoteTip__State() ], [ 0, { shown : null, pending : 'L1|SpecNote_002|EW01|Loggia Arcade' } ]);
advance(499);
check('...nor a moment short of NoteTooltipMs', shows.length, 0);
advance(1);
check('...then the code in bold and the note\'s title, beside the pointer', shows.pop(), [ 'Loggia Arcade', 100, 200, 'EW01' ]);
hover({ kind : 'leader', id : 'L1' }, at('L1'), 140);
check('moving on the same bubble, the label follows the pointer', shows.pop(), [ 'Loggia Arcade', 140, 200, 'EW01' ]);

hover(null, AWAY);
check('off the bubble it is let go (the hover pass has already hidden it)', [ T.Na__LeNoteTip__State().shown, hides.length ], [ null, 0 ]);
hover({ kind : 'leader', id : 'L2' }, at('L2'));
check('straight on to the next bubble names it at once, "Untitled note" for a note with no title', shows.pop(), [ 'Untitled note', 100, 200, 'EW02' ]);

hover(null, AWAY); advance(1000);
hover({ kind : 'leader', id : 'L1' }, { x : 10, y : 0 });
advance(600);
check('the tail is not the bubble: nothing', [ shows.length, T.Na__LeNoteTip__State() ], [ 0, { shown : null, pending : null } ]);

rawHit = { kind : 'leader', id : 'L1' };
hover({ kind : 'group', id : 'Group_001' }, at('L1'));
advance(500);
check('a bubble inside a group is found through it', shows.pop(), [ 'Loggia Arcade', 100, 200, 'EW01' ]);
rawHit = null;

hover(null, AWAY); advance(1000);
hover(null, at('L3'));
advance(500);
check('a bubble on a LOCKED layer, which clicks pass over, still names its note', shows.pop(), [ 'Loggia Arcade', 100, 200, 'EW01' ]);
hover(null, AWAY); advance(1000);
hover({ kind : 'viewport', id : 'VP1' }, at('L4'));
advance(500);
check('one on a REFERENCE layer does not: nothing on it answers the pointer', [ shows.length, T.Na__LeNoteTip__State().shown ], [ 0, null ]);

hover({ kind : 'leader', id : 'L1' }, at('L1'));
wanted = false;
advance(500);
check('a tool picked up while it waited: nothing is shown', [ shows.length, T.Na__LeNoteTip__State() ], [ 0, { shown : null, pending : null } ]);
wanted = true;

hover({ kind : 'leader', id : 'L1' }, at('L1'));
advance(500);
shows.length = 0; hides.length = 0;
T.Na__LeNoteTip__Cancel(true);
check('a press (or a key, a wheel turn, the pointer leaving) takes it down', [ hides.length, T.Na__LeNoteTip__State().shown ], [ 1, null ]);
T.Na__LeNoteTip__Cancel(true);
check('...and taking down nothing hides nothing (a broken bubble\'s message is left alone)', hides.length, 1);

LEADER_SETUP.noteTooltip = false;
advance(1000);
hover({ kind : 'leader', id : 'L1' }, at('L1')); advance(1000);
check('NoteTooltip false in the config: never', shows.length, 0);
LEADER_SETUP.noteTooltip = true; LEADER_SETUP.noteTooltipMs = 0;
hover(null, AWAY); advance(1000);
hover({ kind : 'leader', id : 'L1' }, at('L1'));
check('NoteTooltipMs 0: at once', shows.pop(), [ 'Loggia Arcade', 100, 200, 'EW01' ]);
LEADER_SETUP.noteTooltipMs = 500;
notes.SpecNote_002.note.Note__Title = 'Loggia Arcade, Renamed';
hover({ kind : 'leader', id : 'L1' }, at('L1'));
check('a note renamed while its label is up is named afresh', shows.pop(), [ 'Loggia Arcade, Renamed', 100, 200, 'EW01' ]);
notes.SpecNote_002.note.Note__Title = 'Loggia Arcade';

// -----------------------------------------------------------------------------
// THE MENU
// -----------------------------------------------------------------------------
console.log('\n  The menu (the shipped SheetTools ContextMenu)');
let opened = null, found = null, selection = [], underPointer = null;
const M = await load('30__System__SheetTools/Na__LayoutEditor__SheetTools__ContextMenu__.js', {
    Na__LeCfg__GetLabel          : (key, fallback) => fallback,
    Na__LeCfg__FormatLabel       : (key, fallback) => fallback,
    Na__LeCfg__GetGuards         : () => ({ contextMenuKeepSelector : '.na-le-textedit' }),
    Na__LeModel__GetActiveSheet  : () => sheet,
    Na__LeModel__GetSelectionItems : () => selection,
    Na__LeModel__IsSelected      : (kind, id) => selection.some((item) => item.kind === kind && item.id === id),
    Na__LeSurface__ClientToPaperMm : () => ({ x : 24.5, y : 0 }),
    Na__LeDrop__CanApply         : () => ({ ok : false }),
    Na__LeDrop__PaletteMenuLabel : () => 'Use for new leaders',
    Na__LeDrop__PaintableIn      : () => [],
    Na__LeDrop__StyleKeys        : () => [],
    Na__LeLayerMenu__MenuItems   : () => [],
    Na__LeClip__MenuItems        : () => [],
    Na__LeGroup__Expand          : () => [],
    Na__LeMenu__Open             : (x, y, items) => { opened = items; return true; },
    Na__LeTools__MENU_SLOP_PX    : 4,
    Na__LeTools__TOOL_AREA       : 'area',
    Na__LeTools__Editable        : true,
    Na__LeTools__RightPress      : null,
    Na__LeTools__Tool            : 'select',
    Na__LeTools__Resolve         : () => found,
    Na__LeTools__Record          : (s, hit) => (hit ? s.Sheet__Leaders.find((l) => l.Leader__Id === hit.id) || null : null),
    Na__LeTools__RawHit          : () => underPointer,
    Na__LeLeadGeo__NoteFor       : G.Na__LeLeadGeo__NoteFor
});
const rightClick = () => { opened = null; M.Na__LeTools__OnContextMenu({ target : { closest : () => null }, preventDefault () {}, clientX : 300, clientY : 200 }); return opened || []; };
const labels = (items) => items.map((item) => (item.separator ? '---' : item.label));

found = { kind : 'leader', id : 'L1' };
let items = rightClick();
check('a specification bubble\'s menu leads with Show in Specification, its code as the hint', [ items[0].label, items[0].hint, items[1].separator === true, items[2].label ], [ 'Show in Specification', 'EW01', true, 'Edit leader text' ]);
dispatched.length = 0;
items[0].onSelect();
check('...and choosing it asks for the note in the Specification tab', dispatched, [ { type : 'na-layouteditor-spec-locate', detail : { noteId : 'SpecNote_002', leaderId : 'L1' } } ]);

sheet.Sheet__Leaders.push(bubble('L5', { Leader__Text : 'Note', Leader__Type : 'text' }));
found = { kind : 'leader', id : 'L5' };
check('a note leader\'s menu is as it was', labels(rightClick()).slice(0, 2), [ 'Edit leader text', '---' ]);

found = { kind : 'group', id : 'Group_001' };
underPointer = { kind : 'leader', id : 'L1' };
check('a bubble right-clicked inside a group: the group\'s menu leads with the bubble\'s note', labels(rightClick()).slice(0, 3), [ 'Show in Specification', '---', 'Edit inside group' ]);
underPointer = null;
check('...and a group right-clicked away from any bubble is as it was', labels(rightClick())[0], 'Edit inside group');

found = { kind : 'leader', id : 'L1' };
selection = [ { kind : 'leader', id : 'L1' }, { kind : 'leader', id : 'L2' } ];
underPointer = { kind : 'leader', id : 'L1' };
items = rightClick();
check('one of several selected, right-clicked: still leads with its note', [ items[0].label, items[0].hint ], [ 'Show in Specification', 'EW01' ]);

Date.now = realNow;
console.log('\n  ' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED') + '\n');
process.exit(failures === 0 ? 0 : 1);
