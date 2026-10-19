// =============================================================================
// TRUEVISION3D - TEST - LEADER LINE OFF
// =============================================================================
//
// FILE       : Na__Test__LeaderLineOff__.test.mjs
// PURPOSE    : Prove a leader with its line switched off (Leader__HideLine) is
//              its bubble or note on its own: no line and no endpoint drawn,
//              bounded, selected or hit, its tip kept for when the line comes
//              back, and every leader saved before it exactly as it was
// CREATED    : 19-Oct-2026 (TrueVision v2.179.0)
//
// RUN        : node 80__Testing__PrototypeEnvironment/Na__Test__LeaderLineOff__.test.mjs
//
// HOW IT WORKS:
// - The Scene Sync test's loader: each SHIPPED module is read, its imports
//   are removed and replaced with this test's stubs (or the real modules this
//   test loaded first), and the rest runs byte for byte as it ships.
// - The records, the leader model, the leader geometry and the grips are the
//   real modules. The sheet chrome is stubbed to record what Push draws, and
//   its text measure is a plain average width.
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const EDITOR     = '51__System__LayoutEditor/';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    let loadCount = 0;
    async function load(relative, stubs) {
        let src = readFileSync(resolve(SRC, relative), 'utf8').replace(/\r\n/g, '\n');
        const names = [];
        let m;
        IMPORT.lastIndex = 0;
        while ((m = IMPORT.exec(src)) !== null) {
            const list = m[1].trim();
            if (list.charAt(0) !== '{') continue;
            list.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => names.push(s.split(/\s+as\s+/).pop()));
        }
        const had = /^\s*import\s/m.test(src);
        src = src.replace(IMPORT, '');
        if (had && /^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + relative); process.exit(1); }
        const key = '__LeaderLineOffStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const body = src.replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(resolve(SRC, relative)).href));
        const tmp  = join(tmpdir(), 'Na__Test__LeaderLineOff__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + body, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks, the Leader Setup and the Chrome Stub
// -----------------------------------------------------------------------------

    let failures = 0, passes = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        passed ? passes++ : failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }
    const clone = (value) => JSON.parse(JSON.stringify(value));

    globalThis.window = { dispatchEvent () {}, addEventListener () {}, setTimeout : (fn) => fn() };
    globalThis.CustomEvent = class { constructor (type, init) { this.type = type; Object.assign(this, init); } };

    // The shipped config's leader block, read the way the setup reads it
    const CONFIG = JSON.parse(readFileSync(resolve(SRC, EDITOR + '03__Core__Config/Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const block  = Object.keys(CONFIG).map((k) => CONFIG[k]).find((b) => b && typeof b === 'object' && 'LayoutEditor__Leader__HideLine' in b) || {};
    const val    = (key, fallback) => (block['LayoutEditor__Leader__' + key] !== undefined ? block['LayoutEditor__Leader__' + key] : fallback);
    const SETUP  = {
        defaultType : val('DefaultType', 'bubble'), defaultText : 'Note', defaultBubbleText : 'EE01',
        textSizeMm : 2.5, fontWeight : 600, textColour : '#172b3a', lineColour : '#172b3a', linePt : 0.35, lineStyle : 'dashed', dashMm : 0.8,
        lineOpacity : 1, transparentOpacity : 0.5, hideLine : val('HideLine', null) === true, endpointFilled : false, endpointPt : 0.35,
        endpointSizeMm : 1.6, bubbleSizeMm : 9, bubbleEdgePt : 0.35, bubblePaddingMm : 1.2, filled : true, fillColour : '#f2f4f5', fillOpacity : 1,
        textGapMm : 1, textPaddingMm : 1, lineSpacing : 1.3, textAttach : 'first-line', stubMm : 3, stubMaxFraction : 0.25, curveTension : 0.5, minLengthMm : 2
    };

    const drawn = [];
    const chrome = {
        Na__LeCfg__GetLeaderSetup : () => SETUP,
        Na__LeCfg__GetTextSetup   : () => ({ fontFamily : 'Open Sans' }),
        Na__LeCfg__PtToMm         : (pt) => pt * 25.4 / 72,
        Na__LeChrome__MeasureTextMm : (text, sizeMm) => String(text || '').length * sizeMm * 0.6,
        Na__LeChrome__PushPolyline  : (list, points, stroke, strokeMm, fill, closed) => { list.push({ kind : 'poly', n : points.length, stroke : stroke, strokeMm : strokeMm, fill : fill, closed : closed }); },
        Na__LeChrome__PushText      : (list, text) => { list.push({ kind : 'text', text : text.Text }); }
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Modules
// -----------------------------------------------------------------------------

    const Rec   = await load(EDITOR + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', { Na__LeCfg__GetLeaderSetup : () => SETUP });
    const Geo   = await load(EDITOR + '15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js', chrome);
    const Model = await load(EDITOR + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Leaders__.js', Object.assign({}, Rec, {
        Na__LeModel__DefaultLayerId : () => 'Layer_002',
        Na__LeModel__GetLayerById   : () => ({ Layer__Id : 'Layer_002' }),
        Na__LeModel__Touch          : () => {},
        Na__LeModel__AssignDirty    : () => {},
        Na__LeModel__Unselect       : () => {},
        Na__LeModel__PruneGroups    : () => {}
    }));
    const Grips = await load(EDITOR + '30__System__SheetTools/Na__LayoutEditor__Grips__.js', {
        Na__LeLeadGeo__Hit         : Geo.Na__LeLeadGeo__Hit,
        Na__LeLeadGeo__IsLineShown : Geo.Na__LeLeadGeo__IsLineShown
    });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    console.log('\nTrueVision3D - Leader Line Off\n\n  The record');
    check('the shipped config starts new leaders with their line', SETUP.hideLine, false);

    const saved = { Leader__Id : 'Leader_001', Leader__Type : 'bubble', Leader__TipXMm : 100, Leader__TipYMm : 120, Leader__AnchorXMm : 130, Leader__AnchorYMm : 100, Leader__Text : 'SP01' };
    const before = clone(saved);
    Rec.Na__LeRec__NormaliseLeader(before, 'Layer_002');
    const again = clone(before);
    Rec.Na__LeRec__NormaliseLeader(again, 'Layer_002');
    check('a leader saved before the switch gains no key and normalises byte identical', [ 'Leader__HideLine' in before, JSON.stringify(again) === JSON.stringify(before) ], [ false, true ]);
    const off = Object.assign(clone(before), { Leader__HideLine : true });
    Rec.Na__LeRec__NormaliseLeader(off, 'Layer_002');
    check('true is kept', off.Leader__HideLine, true);
    const junk = Object.assign(clone(before), { Leader__HideLine : false });
    Rec.Na__LeRec__NormaliseLeader(junk, 'Layer_002');
    check('false (or anything but true) is not stored', 'Leader__HideLine' in junk, false);

    const sheet = { Sheet__Id : 'Sheet_001', Sheet__Leaders : [] };
    const made  = Model.Na__LeModel__CreateLeader(sheet, { x : 100, y : 120 }, { x : 130, y : 100 }, { type : 'bubble', text : 'SP02', hideLine : true });
    check('a leader created with the line off stores it', made.Leader__HideLine, true);
    const plain = Model.Na__LeModel__CreateLeader(sheet, { x : 10, y : 20 }, { x : 40, y : 0 }, { type : 'bubble', text : 'SP03' });
    check('one created without it has no key', 'Leader__HideLine' in plain, false);
    Model.Na__LeModel__UpdateLeader(sheet, made.Leader__Id, { hideLine : false });
    check('switching the line back on removes the key, and the tip is where it was',
        [ 'Leader__HideLine' in made, made.Leader__TipXMm, made.Leader__TipYMm ], [ false, 100, 120 ]);
    Model.Na__LeModel__UpdateLeader(sheet, made.Leader__Id, { hideLine : true });
    check('and off again stores it again', made.Leader__HideLine, true);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing, Bounds and Hits
// -----------------------------------------------------------------------------

    console.log('\n  Drawing, bounds and hits');
    const draw = (leader) => { drawn.length = 0; Geo.Na__LeLeadGeo__Push(drawn, leader); return drawn.map((p) => (p.kind === 'text' ? 'text:' + p.text : (p.fill && !p.stroke ? 'fill' : (p.closed ? 'ring' : 'line')))); };
    const withLine = clone(before), alone = clone(off);
    check('with its line: fill, line, endpoint ring, bubble edge, code', draw(withLine), [ 'fill', 'line', 'ring', 'ring', 'text:SP01' ]);
    check('line off: the bubble on its own, fill, edge and code only', draw(alone), [ 'fill', 'ring', 'text:SP01' ]);

    const layout = Geo.Na__LeLeadGeo__Layout(alone);
    check('its layout has no path and no endpoint, and says so', [ layout.path.length, layout.tipRadius, layout.lineShown ], [ 0, 0, false ]);
    check('but still reports the tip, which the record keeps', layout.tip, { x : 100, y : 120 });

    const head = Geo.Na__LeLeadGeo__Layout(withLine).head;
    const box  = Geo.Na__LeLeadGeo__Bounds(alone);
    const r    = (v) => Math.round(v * 1000) / 1000;
    check('its bounds are the bubble alone, not out to the hidden tip',
        [ r(box.X), r(box.Y), r(box.WidthMm), r(box.HeightMm) ], [ r(head.box.X), r(head.box.Y), r(head.box.WidthMm), r(head.box.HeightMm) ]);
    const lineBox = Geo.Na__LeLeadGeo__Bounds(withLine);
    check('while with its line they reach the tip', lineBox.X <= 100 - 0.8 && lineBox.Y + lineBox.HeightMm >= 120 + 0.8, true);

    check('a press on the hidden tip hits nothing', Geo.Na__LeLeadGeo__Hit(alone, { x : 100, y : 120 }, 1.5), null);
    check('a press on the shown tip hits the tip', Geo.Na__LeLeadGeo__Hit(withLine, { x : 100, y : 120 }, 1.5), 'tip');
    const mid = Geo.Na__LeLeadGeo__Layout(withLine).path[Math.floor(Geo.Na__LeLeadGeo__Layout(withLine).path.length / 2)];
    check('a press where the line would run hits it only when it is drawn',
        [ Geo.Na__LeLeadGeo__Hit(withLine, { x : mid[0], y : mid[1] }, 1.5), Geo.Na__LeLeadGeo__Hit(alone, { x : mid[0], y : mid[1] }, 1.5) ], [ 'line', null ]);
    check('a press on the bubble still finds the head', Geo.Na__LeLeadGeo__Hit(alone, { x : head.centre.x, y : head.centre.y }, 1.5), 'head');

    check('grabbing a bubble on its own moves it whole, its hidden tip with it',
        [ Grips.Na__LeGrips__LeaderGrab(alone, { x : head.centre.x, y : head.centre.y }, 1), Grips.Na__LeGrips__LeaderGrab(alone, { x : 100, y : 120 }, 1) ], [ 'whole', 'whole' ]);
    check('with its line the tip and the head are grabbed as before',
        [ Grips.Na__LeGrips__LeaderGrab(withLine, { x : 100, y : 120 }, 1), Grips.Na__LeGrips__LeaderGrab(withLine, { x : head.centre.x, y : head.centre.y }, 1) ], [ 'tip', 'anchor' ]);

    const note = Object.assign(clone(before), { Leader__Type : 'text', Leader__Text : 'Timber cladding', Leader__HideLine : true });
    Rec.Na__LeRec__NormaliseLeader(note, 'Layer_002');
    check('a note with its line off is its text and fill alone', draw(note), [ 'fill', 'text:Timber cladding' ]);

// endregion -------------------------------------------------------------------


    console.log('\n' + passes + ' passed, ' + failures + ' failed');
    process.exit(failures ? 1 : 0);
