// =============================================================================
// TRUEVISION3D - TEST - LEADERLESS NOTES
// =============================================================================
//
// FILE       : Na__Test__LeaderlessNotes__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Leaderless Notes Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that whole specification groups can be listed on a sheet without bubbles, first and in the sheet's order, that the record and the model keep them, and that a sheet without them is untouched
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE RECORD (the shipped SheetRecords and its LeaderlessNotes leaf): a
//   margin record without them gains no key; LeaderlessOn is kept only as
//   true and LeaderlessGroups only when there is one, strings only, in order,
//   no repeats, an id the specification does not know kept; a tick joins the
//   foot of the list; a move lands where the Layers grip's does.
// - THE MODEL (the shipped Sheets unit): UpdateMarginNotes' leaderlessOn,
//   leaderlessGroup and leaderlessMove, one 'margin' announcement each; the
//   switch off keeps the list.
// - WHAT THE SHEET LISTS (the shipped SpecMargin, its Column and
//   NoteRegions, the real sheet layout, the shipped config): the groups come
//   FIRST, whole, in the sheet's order, bubble or not, a note a bubble links
//   to listed once; a general group ticked moves to the front and is not
//   listed again at the foot; the counts add up; group headings; a region
//   ticking the group takes its notes, the overspill carries them first, and
//   with nowhere to go they are not listed; a group the specification lost
//   lists nothing; the switch off, or none ticked, plans exactly as before.
// - RB05's D01 (Project Introduction), as the project file has it today:
//   ticking the IN group puts IN01-IN09 at the top of its margin.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__LeaderlessNotes__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with Leaderless Notes (TrueVision3D v2.147.0).
//
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | A Browser Just Big Enough
// -----------------------------------------------------------------------------

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        addEventListener    : () => {},
        removeEventListener : () => {},
        dispatchEvent       : () => true,
        localStorage        : { getItem : () => null, setItem : () => {}, removeItem : () => {} },
        setTimeout, clearTimeout
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading a Module With Its Imports Stubbed
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const SRC        = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const LE         = '51__System__LayoutEditor/';
    const IMPORT     = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;

    // The Note Regions test's loader: every name a module imports gets the
    // test's stub when it gives one, else a function returning undefined.
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
        const key = '__LeaderlessStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__LeaderlessNotes__' + loadCount + '__.mjs');
        writeFileSync(tmp, head + '\n' + src, 'utf8');
        return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks, the Config and the Modules
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, got, want) {
        const passed = JSON.stringify(got) === JSON.stringify(want);
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
        if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
    }

    // THE SHIPPED JSON, read through the shipped EditorSetup unit.
    const CONFIG = JSON.parse(readFileSync(resolve(SRC, LE + '03__Core__Config/Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const Val = (block, key, fallback) => { const b = CONFIG['LayoutEditor__' + block + '__Config']; const v = b ? b['LayoutEditor__' + block + '__' + key] : undefined; return (v === undefined || v === null) ? fallback : v; };
    const Num = (block, key, fallback) => { const v = Val(block, key, undefined); return (typeof v === 'number' && Number.isFinite(v)) ? v : fallback; };
    const Setup = await load(LE + '03__Core__Config/Na__LayoutEditor__ConfigState__EditorSetup__.js', { Na__LeCfg__Val : Val, Na__LeCfg__Num : Num });

    const cfg = {
        Na__LeCfg__GetMarginNotesSetup : Setup.Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetStyleSetup       : () => ({ inkColour : '#172b3a', mutedTextColour : '#6c757d', paperColour : '#ffffff' }),
        Na__LeCfg__GetTextSetup        : () => ({ fontFamily : 'Open Sans' }),
        Na__LeCfg__GetSheetSetup       : () => ({ marginMm : 5, blockGapMm : 4, borderStrokeMm : 0.5, paperSizes : { A3 : { Label : 'ISO A3', WidthMm : 420, HeightMm : 297 } }, defaultPaperSize : 'A3', defaultOrientation : 'landscape', screenPixelsPerMm : 3.2 }),
        Na__LeCfg__GetTitleBlockSetup  : () => ({ heightMm : 20, defaultStyle : 'modern' }),
        Na__LeCfg__PtToMm              : (pt) => pt * 25.4 / 72
    };

    // TEXT MEASURES AS THE CHROME'S OWN FALLBACK DOES (no jsPDF in Node), a
    // touch wider in bold, so the wraps and the overflow are deterministic.
    const chrome = {
        Na__LeChrome__MeasureTextMm : (text, fontMm, weight, tracking) => { const v = String(text == null ? '' : text); if (!v) return 0; return (v.length * fontMm * (weight === 'bold' ? 0.56 : 0.52)) + ((typeof tracking === 'number' && tracking > 0) ? tracking * v.length : 0); },
        Na__LeChrome__PushRect : (list, x, y, w, h, sc, sm, fc) => list.push({ Kind : 'rect', X : x, Y : y, WidthMm : w, HeightMm : h, StrokeColour : sc || null, StrokeMm : typeof sm === 'number' ? sm : 0, FillColour : fc || null }),
        Na__LeChrome__PushLine : (list, x1, y1, x2, y2, sc, sm) => list.push({ Kind : 'line', X1 : x1, Y1 : y1, X2 : x2, Y2 : y2, StrokeColour : sc, StrokeMm : sm }),
        Na__LeChrome__PushText : (list, s) => { if (String(s.Text || '')) list.push({ Kind : 'text', X : s.X, BaselineY : s.BaselineY, Text : String(s.Text), FontMm : s.FontMm, Weight : s.Weight }); }
    };

    const Layout    = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js', cfg);
    const RegionRec = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__NoteRegions__.js', cfg);
    const LeadRec   = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js', {});
    const Records   = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', Object.assign({}, cfg, RegionRec, LeadRec));

    // THE SPECIFICATION, RB05-shaped: an introduction group first (IN, 4
    // notes, never pointed at), General Notes (general, 2), Structural Notes
    // (3) and Finishes (3). This sheet's bubbles link to SN01, SN03 and FN02.
    // Swappable, so the RB05 check below can put the real one in.
    const TEXT = 'Walls in coursed natural stone to match the existing, laid in lime mortar and pointed flush, with every opening dressed in cut ashlar.';
    function Specification(groups, counts, linkedCodes) {
        const entries = [];
        groups.forEach((group, g) => {
            group.Group__Notes = [];
            for (let i = 0; i < counts[g]; i++) {
                const k    = entries.length;
                const note = { Note__Id : 'SpecNote_' + String(k + 1).padStart(3, '0'), Note__Title : 'Note ' + (k + 1), Note__Body : TEXT };
                group.Group__Notes.push(note);
                entries.push({ group : group, groupIndex : g, index : i, order : k, code : group.Group__Prefix + String(i + 1).padStart(2, '0'), note : note });
            }
        });
        return { groups : groups, entries : entries, linked : new Set(entries.filter((e) => linkedCodes.indexOf(e.code) !== -1).map((e) => e.note.Note__Id)) };
    }
    let SPEC = Specification([
        { Group__Id : 'SpecGroup_091', Group__Prefix : 'IN', Group__Title : 'Project Introduction Notes', Group__IsGeneral : false },
        { Group__Id : 'SpecGroup_001', Group__Prefix : 'GN', Group__Title : 'General Notes',              Group__IsGeneral : true  },
        { Group__Id : 'SpecGroup_002', Group__Prefix : 'SN', Group__Title : 'Structural Notes',           Group__IsGeneral : false },
        { Group__Id : 'SpecGroup_003', Group__Prefix : 'FN', Group__Title : 'Finishes',                   Group__IsGeneral : false }
    ], [ 4, 2, 3, 3 ], [ 'SN01', 'SN03', 'FN02' ]);
    let LOADED = true;
    const spec = {
        Na__LeSpec__IsLoaded      : () => LOADED,
        Na__LeSpec__ListNotes     : () => SPEC.entries,
        Na__LeSpec__GetGroupById  : (id) => SPEC.groups.find((g) => g.Group__Id === id) || null,
        Na__LeSpecLink__LinkedNoteIds : () => SPEC.linked
    };
    const common  = Object.assign({}, cfg, chrome, Layout, Records, RegionRec, LeadRec, spec);
    const Column  = await load(LE + '50__Feature__Specification/Na__LayoutEditor__SpecMargin__Column__.js', common);
    const Regions = await load(LE + '50__Feature__Specification/Na__LayoutEditor__NoteRegions__.js', Object.assign({}, common, Column));
    const Margin  = await load(LE + '50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js', Object.assign({}, common, Column, Regions));

    const IN = 'SpecGroup_091', GN = 'SpecGroup_001', SN = 'SpecGroup_002', FN = 'SpecGroup_003';
    const listed    = (sheet) => Margin.Na__LeMargin__Entries(sheet).entries.map((e) => e.code);
    const sheetWith = (notes) => { const s = { Sheet__Id : 'Sheet_005', Sheet__PaperSize : 'A3', Sheet__Orientation : 'landscape', Sheet__MarginNotes : notes }; Records.Na__LeRec__NormaliseMarginNotes(s); return s; };
    const margin    = (extra) => Object.assign({ Enabled : true, WidthMm : 90, Heading : null, TextSizeMm : 2, IncludeGeneral : true, GroupHeadings : false }, extra || {});
    const region    = (id, frame, extra) => Object.assign({ Region__Id : id, Region__FrameMm : frame, Region__Overspill : false, Region__Groups : [], Region__Borders : { Top : true, Right : true, Bottom : true, Left : true } }, extra || {});
    const BIG       = { X : 20, Y : 20, WidthMm : 220, HeightMm : 240 };
    const place     = (sheet) => Margin.Na__LeMargin__PlanAll(sheet, null).place;
    const codesOf   = (sheet, indices) => { const all = Margin.Na__LeMargin__Entries(sheet).entries; return indices.map((i) => all[i].code); };

// endregion -------------------------------------------------------------------


console.log('TrueVision3D - leaderless notes: the record, the model, and what the sheet lists');


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    console.log('\n  The record (the shipped SheetRecords and its LeaderlessNotes leaf)');
    const plain = sheetWith(margin());
    check('a margin record without them gains no key', Object.keys(plain.Sheet__MarginNotes), [ 'Enabled', 'WidthMm', 'Heading', 'TextSizeMm', 'IncludeGeneral', 'GroupHeadings' ]);
    const off = sheetWith(margin({ LeaderlessOn : false, LeaderlessGroups : [] }));
    check('LeaderlessOn false and an empty list are both dropped', [ 'LeaderlessOn' in off.Sheet__MarginNotes, 'LeaderlessGroups' in off.Sheet__MarginNotes ], [ false, false ]);
    const kept = sheetWith(margin({ LeaderlessGroups : [ IN ] }));
    check('the groups are kept with the switch off, so switching on puts them back', [ 'LeaderlessOn' in kept.Sheet__MarginNotes, kept.Sheet__MarginNotes.LeaderlessGroups ], [ false, [ IN ] ]);
    const messy = sheetWith(margin({ LeaderlessOn : 'yes', LeaderlessGroups : [ SN, '', 7, null, IN, SN, 'SpecGroup_999', { id : FN } ] }));
    check('only a real true switches it on', 'LeaderlessOn' in messy.Sheet__MarginNotes, false);
    check('strings only, in their order, no repeats; an id the specification lacks is KEPT', messy.Sheet__MarginNotes.LeaderlessGroups, [ SN, IN, 'SpecGroup_999' ]);
    const both = sheetWith(margin({ RegionsOn : true, Regions : [ region('Region_001', BIG) ], LeaderlessOn : true, LeaderlessGroups : [ IN ] }));
    check('beside the regions: both kept, the regions first', Object.keys(both.Sheet__MarginNotes).slice(6), [ 'RegionsOn', 'Regions', 'LeaderlessOn', 'LeaderlessGroups' ]);
    const again = JSON.parse(JSON.stringify(both));
    Records.Na__LeRec__NormaliseMarginNotes(again);
    check('a normalised record normalises byte-identical', JSON.stringify(again), JSON.stringify(both));
    check('the readers: on, kept, and listed only while on', [ LeadRec.Na__LeRec__LeaderlessOn(both), LeadRec.Na__LeRec__LeaderlessGroups(kept), LeadRec.Na__LeRec__ListedLeaderlessGroups(kept), LeadRec.Na__LeRec__ListedLeaderlessGroups(both) ], [ true, [ IN ], [], [ IN ] ]);
    check('the readers on a sheet with no margin record', [ LeadRec.Na__LeRec__LeaderlessOn({}), LeadRec.Na__LeRec__LeaderlessGroups({}), LeadRec.Na__LeRec__ListedLeaderlessGroups(null) ], [ false, [], [] ]);
    const readBack = LeadRec.Na__LeRec__LeaderlessGroups(both);
    readBack.push('SpecGroup_X');
    check('the reader hands back a copy: changing it changes nothing', both.Sheet__MarginNotes.LeaderlessGroups, [ IN ]);

    const T = LeadRec.Na__LeRec__LeaderlessToggled;
    check('a tick joins the foot of the list', T([ SN, FN ], IN, true), [ SN, FN, IN ]);
    check('a group ticked twice stays where it is', T([ SN, IN, FN ], IN, true), [ SN, IN, FN ]);
    check('an untick takes it out and keeps the rest in order', T([ SN, IN, FN ], IN, false), [ SN, FN ]);
    check('a tick with no id changes nothing', T([ SN ], '', true), [ SN ]);

    const M = LeadRec.Na__LeRec__LeaderlessMoved;
    check('dropped on a later group it lands after it (the Layers grip\'s rule)', M([ IN, SN, FN, GN ], IN, 2), [ SN, FN, IN, GN ]);
    check('dropped on an earlier group it lands before it', M([ IN, SN, FN, GN ], GN, 1), [ IN, GN, SN, FN ]);
    check('to the very top and the very foot', [ M([ IN, SN, FN ], FN, 0), M([ IN, SN, FN ], IN, 2) ], [ [ FN, IN, SN ], [ SN, FN, IN ] ]);
    check('an index past either end is held to it', [ M([ IN, SN, FN ], FN, -5), M([ IN, SN, FN ], IN, 99) ], [ [ FN, IN, SN ], [ SN, FN, IN ] ]);
    check('a group the list lacks, no move, or no index: unchanged', [ M([ IN, SN ], FN, 0), M([ IN, SN ], SN, 1), M([ IN, SN ], IN, NaN) ], [ [ IN, SN ], [ IN, SN ], [ IN, SN ] ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Model
// -----------------------------------------------------------------------------

    console.log('\n  The model (the shipped Sheets unit)');
    const announced = [];
    const Sheets = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Sheets__.js', Object.assign({}, Records, RegionRec, LeadRec, {
        Na__LeModel__Touch       : (reason, sheetId) => announced.push(reason + ':' + sheetId),
        Na__LeModel__AssignDirty : () => {}
    }));
    const U = (s, patch) => Sheets.Na__LeModel__UpdateMarginNotes(s, patch);
    const bare = { Sheet__Id : 'Sheet_009' };
    U(bare, { leaderlessOn : true });
    check('the switch on a sheet with no margin record makes one, the margin OFF', [ bare.Sheet__MarginNotes.Enabled, bare.Sheet__MarginNotes.LeaderlessOn, 'LeaderlessGroups' in bare.Sheet__MarginNotes ], [ false, true, false ]);
    check('...announced once as margin', announced.splice(0), [ 'margin:Sheet_009' ]);
    U(bare, { leaderlessGroup : { id : SN, on : true } });
    U(bare, { leaderlessGroup : { id : IN, on : true } });
    U(bare, { leaderlessGroup : { id : FN, on : true } });
    check('three ticks: in the order ticked, each one announcement', [ bare.Sheet__MarginNotes.LeaderlessGroups, announced.splice(0).length ], [ [ SN, IN, FN ], 3 ]);
    U(bare, { leaderlessMove : { id : IN, index : 0 } });
    check('a move: the introduction to the top', bare.Sheet__MarginNotes.LeaderlessGroups, [ IN, SN, FN ]);
    U(bare, { leaderlessGroup : { id : SN, on : false } });
    check('an untick: the rest keep their order', bare.Sheet__MarginNotes.LeaderlessGroups, [ IN, FN ]);
    U(bare, { leaderlessOn : false });
    check('the switch off drops LeaderlessOn and keeps the list', [ 'LeaderlessOn' in bare.Sheet__MarginNotes, bare.Sheet__MarginNotes.LeaderlessGroups ], [ false, [ IN, FN ] ]);
    U(bare, { leaderlessOn : true, leaderlessGroup : { id : IN, on : false } });
    U(bare, { leaderlessGroup : { id : FN, on : false } });
    check('unticking the last drops the list and leaves the switch on', [ bare.Sheet__MarginNotes.LeaderlessOn, 'LeaderlessGroups' in bare.Sheet__MarginNotes ], [ true, false ]);
    check('...every change one announcement', announced.splice(0).length, 5);
    const other = { Sheet__Id : 'Sheet_010', Sheet__MarginNotes : { Enabled : true, WidthMm : 70, Heading : null, TextSizeMm : 2, IncludeGeneral : true, GroupHeadings : false } };
    const before = JSON.stringify(other);
    U(other, { widthMm : 75 });
    check('an ordinary margin change adds no leaderless key', Object.keys(other.Sheet__MarginNotes), Object.keys(JSON.parse(before).Sheet__MarginNotes));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Sheet Lists
// -----------------------------------------------------------------------------

    console.log('\n  What the sheet lists (the shipped SpecMargin, Column and NoteRegions)');

    // NONE, OR SWITCHED OFF | Exactly what the margin listed before
    const none = sheetWith(margin());
    check('no leaderless groups: the linked notes, then the general notes', listed(none), [ 'SN01', 'SN03', 'FN02', 'GN01', 'GN02' ]);
    const switchedOff = sheetWith(margin({ LeaderlessGroups : [ IN ] }));
    check('the switch off: the same list, the same plan, the same report bar the switch', [ listed(switchedOff), JSON.stringify(Margin.Na__LeMargin__Plan(switchedOff, null)) === JSON.stringify(Margin.Na__LeMargin__Plan(none, null)) ], [ listed(none), true ]);
    const offReport = Margin.Na__LeMargin__Report(switchedOff, null);
    check('...and the report counts none', [ offReport.leaderlessOn, offReport.leaderless, offReport.total ], [ false, 0, 5 ]);
    const onEmpty = sheetWith(margin({ LeaderlessOn : true }));
    check('switched on with nothing ticked: the same list again', listed(onEmpty), listed(none));

    // THE INTRODUCTION FIRST | Bubble or not, before the notes the bubbles link to
    const intro = sheetWith(margin({ LeaderlessOn : true, LeaderlessGroups : [ IN ] }));
    check('the introduction group is listed whole, first', listed(intro), [ 'IN01', 'IN02', 'IN03', 'IN04', 'SN01', 'SN03', 'FN02', 'GN01', 'GN02' ]);
    const introReport = Margin.Na__LeMargin__Report(intro, null);
    check('the counts: 4 without leaders, 3 linked, 2 general, 9 in all', [ introReport.leaderlessOn, introReport.leaderless, introReport.linked, introReport.general, introReport.total ], [ true, 4, 3, 2, 9 ]);
    check('...and the margin prints them first', Margin.Na__LeMargin__Plan(intro, null).runs.filter((r) => r.weight === 'bold' && /^[A-Z]{2}\d{2}/.test(r.text)).slice(0, 5).map((r) => r.text.slice(0, 4)), [ 'IN01', 'IN02', 'IN03', 'IN04', 'SN01' ]);

    // THE STACK'S ORDER WINS | Not the specification's
    const stacked = sheetWith(margin({ LeaderlessOn : true, LeaderlessGroups : [ FN, IN ] }));
    check('two groups print in the sheet\'s order, each whole, before the linked notes', listed(stacked), [ 'FN01', 'FN02', 'FN03', 'IN01', 'IN02', 'IN03', 'IN04', 'SN01', 'SN03', 'GN01', 'GN02' ]);
    check('a linked note of a listed group is listed once, in its group\'s place', listed(stacked).filter((c) => c === 'FN02').length, 1);
    const stackedReport = Margin.Na__LeMargin__Report(stacked, null);
    check('...counted as linked, not as leaderless: the counts still add up', [ stackedReport.leaderless, stackedReport.linked, stackedReport.general, stackedReport.total ], [ 6, 3, 2, 11 ]);

    // A GENERAL GROUP TICKED | Moves to the front; not listed again at the foot
    const gen = sheetWith(margin({ LeaderlessOn : true, LeaderlessGroups : [ GN ] }));
    check('a general group ticked leads, and is not listed again at the foot', listed(gen), [ 'GN01', 'GN02', 'SN01', 'SN03', 'FN02' ]);
    const genReport = Margin.Na__LeMargin__Report(gen, null);
    check('...counted as leaderless, not general', [ genReport.leaderless, genReport.general, genReport.total ], [ 2, 0, 5 ]);
    const genOff = sheetWith(margin({ IncludeGeneral : false, LeaderlessOn : true, LeaderlessGroups : [ GN ] }));
    check('...even with List general notes off', listed(genOff), [ 'GN01', 'GN02', 'SN01', 'SN03', 'FN02' ]);

    // A GROUP THE SPECIFICATION LOST | Lists nothing, breaks nothing
    const lost = sheetWith(margin({ LeaderlessOn : true, LeaderlessGroups : [ 'SpecGroup_999', IN ] }));
    check('a group id the specification does not have lists nothing', listed(lost), listed(intro));

    // THE SPECIFICATION STILL LOADING | Nothing to list yet
    LOADED = false;
    const pending = Margin.Na__LeMargin__Entries(intro);
    LOADED = true;
    check('while the specification loads: pending, nothing listed, none counted', [ pending.pending, pending.entries.length, pending.leaderless ], [ true, 0, 0 ]);

    // GROUP HEADINGS | The introduction's heading first
    const heads = sheetWith(margin({ GroupHeadings : true, LeaderlessOn : true, LeaderlessGroups : [ IN ] }));
    check('with group headings: the introduction\'s heading comes first', Margin.Na__LeMargin__Plan(heads, null).runs.filter((r) => r.colour === '#6c757d').map((r) => r.text), [ 'PROJECT INTRODUCTION NOTES', 'STRUCTURAL NOTES', 'FINISHES', 'GENERAL NOTES' ]);

    // REGIONS | Claim the group like any other; the overspill carries it first
    const claimed = sheetWith(margin({ LeaderlessOn : true, LeaderlessGroups : [ IN ], RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Groups : [ IN ] }) ] }));
    const cp = place(claimed);
    check('a region ticking the group takes all of its notes, which leave the margin', [ codesOf(claimed, cp.regions[0].list), codesOf(claimed, cp.marginList) ], [ [ 'IN01', 'IN02', 'IN03', 'IN04' ], [ 'SN01', 'SN03', 'FN02', 'GN01', 'GN02' ] ]);
    const tight = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4, LeaderlessOn : true, LeaderlessGroups : [ IN ], RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Overspill : true }) ] }));
    const tp = place(tight);
    const all = Margin.Na__LeMargin__Entries(tight).entries.map((e) => e.code);
    check('a narrow margin starts with the introduction and the overspill carries on in the same order', [ tp.margin.shown > 0, all.slice(0, tp.margin.shown).concat(codesOf(tight, tp.regions[0].list)) ], [ true, all ]);
    check('...nothing lost', [ tp.lost, tp.margin.shown + tp.inRegions ], [ 0, all.length ]);
    const nowhere = sheetWith(margin({ Enabled : false, LeaderlessOn : true, LeaderlessGroups : [ IN ], RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Groups : [ FN ] }) ] }));
    const nw = place(nowhere);
    check('the margin off and no overspill region: the group is not listed, which is not lost', [ codesOf(nowhere, nw.regions[0].list), nw.unlisted, nw.lost ], [ [ 'FN02' ], 8, 0 ]);   // <-- IN01-04, SN01, SN03, GN01, GN02

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | RB05 D01, as the Project File Has It
// -----------------------------------------------------------------------------

    console.log('\n  RB05 D01 (Project Introduction), from the project file on this machine');
    const PORTAL = [
        process.env.NA_PROJECT_PORTAL,
        resolve(SCRIPT_DIR, '..', '..', '..', 'na-project-portal'),
        'D:/11_RefLib__StudioRepository__RemoteSystem/NaWeb/na-project-portal',
        'D:/WE10_--_Public-Repo_--_Live-Website/na-project-portal'
    ].filter(Boolean).find((dir) => existsSync(join(dir, '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent', 'TrueVision__DrawingNotes__.json')));
    if (!PORTAL) {
        console.log('  SKIP  RB05 is not on this machine');
    } else {
        const content = join(PORTAL, '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent');
        const notes   = JSON.parse(readFileSync(join(content, 'TrueVision__DrawingNotes__.json'), 'utf8'));
        const project = JSON.parse(readFileSync(join(content, 'TrueVision__ProjectData__.json'), 'utf8'));
        const d01     = JSON.parse(JSON.stringify(project.LayoutEditor__DrawingsData.LayoutEditor__DrawingsData__Sheets.find((s) => s.Sheet__Id === 'Sheet_005')));
        const groups  = notes.ProjectSpecification__Groups;
        const entries = [];
        groups.forEach((group, g) => group.Group__Notes.forEach((note, i) => entries.push({ group : group, groupIndex : g, index : i, order : entries.length, code : note.Note__Code, note : note })));
        const linkedIds = new Set((d01.Sheet__Leaders || []).filter((l) => l.Leader__Type === 'bubble').map((l) => l.Leader__SpecNoteId).filter(Boolean));   // <-- Its bubbles' links, as SpecLinks reads them (every D01 layer is shown)
        SPEC = { groups : groups, entries : entries, linked : linkedIds };
        const intro   = groups.find((g) => g.Group__Prefix === 'IN');
        const before  = listed(d01);
        d01.Sheet__MarginNotes = Object.assign({}, d01.Sheet__MarginNotes, { LeaderlessOn : true, LeaderlessGroups : [ intro.Group__Id ] });
        Records.Na__LeRec__NormaliseMarginNotes(d01);
        const after   = listed(d01);
        check('D01 lists no IN note today (no bubble points at one)', before.filter((c) => /^IN/.test(c)), []);
        check('ticked: IN01-IN09 lead its list, then everything it listed before, in the same order', after, intro.Group__Notes.map((n) => n.Note__Code).concat(before));
        const d01Place = place(d01);
        check('...and they are the margin\'s (its region takes only the FN group)', codesOf(d01, d01Place.marginList).slice(0, 9), intro.Group__Notes.map((n) => n.Note__Code));
    }

// endregion -------------------------------------------------------------------


console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'Every check passed'));
process.exit(failures ? 1 : 0);
