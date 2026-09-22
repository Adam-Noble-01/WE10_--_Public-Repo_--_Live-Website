// =============================================================================
// TRUEVISION3D - TEST - OVERSPILL NOTE REGIONS
// =============================================================================
//
// FILE       : Na__Test__NoteRegions__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Overspill Note Regions Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove where every note goes once a sheet has regions, that the records and the model keep them, and that a sheet without them is untouched
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE RECORD (the shipped SheetRecords and its NoteRegions leaf): a margin
//   record without regions gains no key; RegionsOn is kept only as true and
//   Regions only when there is one; a region is filled with every default,
//   held to the least size, a duplicate id is given a new one past every id
//   on the list, and a group id the specification does not know is kept.
// - THE MODEL (the shipped Sheets unit): Add, Update and Delete keep the
//   regions on the margin record, announce 'margin' once (or nothing, when
//   silent), and the switch leaves the regions where they are.
// - WHERE A NOTE GOES (the shipped SpecMargin, its Column and NoteRegions,
//   the real sheet layout, the shipped config): a group ticked in a region
//   leaves the margin; the first region ticking a group takes it; the
//   margin's tail and a group region's tail carry on in the overspill regions
//   in specification order; an overspill region lists its own groups first;
//   the chain hands on what it cannot fit; with the margin off and no
//   overspill region a note no region claims is counted as not listed, not
//   lost; a region is kept on the paper and prints its title and its borders;
//   a title too wide for its box wraps; a region titled after its one group
//   does not print that group's heading again.
// - A SHEET WITHOUT REGIONS: the margin's plan and report are what they were
//   (the whole old-against-new comparison was run while this was written;
//   here the invariants that comparison rests on are kept checked).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__NoteRegions__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.1
// - Loads the Leaderless Notes record leaf beside the regions' one: the
//   margin imports it since v2.147.0. No sheet here lists a group that way,
//   so every check reads as it did.
//
// 22-Sep-2026 - Version 1.0.0
// - Written with Overspill Note Regions (TrueVision3D v2.143.0).
//
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
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

    // The Hide Swings test's loader: every name a module imports gets the
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
        const key = '__NoteRegionsStubs' + (++loadCount);
        globalThis[key] = stubs || {};
        const head = names.map((n) =>
            'const ' + n + ' = Object.prototype.hasOwnProperty.call(globalThis.' + key + ', "' + n + '") ? globalThis.' + key + '["' + n + '"] : function () { return undefined; };'
        ).join('\n');
        const tmp = join(tmpdir(), 'Na__Test__NoteRegions__' + loadCount + '__.mjs');
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

    // THE SHIPPED JSON, read the way Na__LayoutEditor__ConfigState__Readers__
    // reads it, through the shipped EditorSetup unit.
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
    const LeadRec   = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__LeaderlessNotes__.js', {});   // <-- The margin reads its leaderless groups too (v2.147.0); none are set here
    const Records   = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js', Object.assign({}, cfg, RegionRec, LeadRec));

    // THE SPECIFICATION: General Notes (general, 4), Structural Notes (6) and
    // Finishes (5), every note linked on the sheet, bodies long enough to fill
    // a box at the sizes used below.
    const TEXT   = 'Walls in coursed natural stone to match the existing, laid in lime mortar and pointed flush, with every opening dressed in cut ashlar.';
    const groups = [
        { Group__Id : 'SpecGroup_001', Group__Prefix : 'GN', Group__Title : 'General Notes',    Group__IsGeneral : true  },
        { Group__Id : 'SpecGroup_002', Group__Prefix : 'SN', Group__Title : 'Structural Notes', Group__IsGeneral : false },
        { Group__Id : 'SpecGroup_003', Group__Prefix : 'FN', Group__Title : 'Finishes',         Group__IsGeneral : false }
    ];
    const entries = [];
    [ [ 0, 4 ], [ 1, 6 ], [ 2, 5 ] ].forEach(([ g, count ]) => {
        for (let i = 0; i < count; i++) {
            const k = entries.length;
            entries.push({ group : groups[g], groupIndex : g, index : i, order : k, code : groups[g].Group__Prefix + String(i + 1).padStart(2, '0'),
                           note : { Note__Id : 'SpecNote_' + String(k + 1).padStart(3, '0'), Note__Title : 'Note ' + (k + 1), Note__Body : TEXT } });
        }
    });
    const spec = {
        Na__LeSpec__IsLoaded      : () => true,
        Na__LeSpec__ListNotes     : () => entries,
        Na__LeSpec__GetGroupById  : (id) => groups.find((g) => g.Group__Id === id) || null,
        Na__LeSpecLink__LinkedNoteIds : () => new Set(entries.filter((e) => !e.group.Group__IsGeneral).map((e) => e.note.Note__Id))
    };
    const common  = Object.assign({}, cfg, chrome, Layout, Records, RegionRec, LeadRec, spec);
    const Column  = await load(LE + '50__Feature__Specification/Na__LayoutEditor__SpecMargin__Column__.js', common);
    const Regions = await load(LE + '50__Feature__Specification/Na__LayoutEditor__NoteRegions__.js', Object.assign({}, common, Column));
    const Margin  = await load(LE + '50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js', Object.assign({}, common, Column, Regions));

    // THE SHEET'S LIST, NOT THE SPECIFICATION'S: Place counts in the order the
    // sheet lists its notes - linked ones first, the general notes last.
    const codes = (sheet, list) => { const listed = Margin.Na__LeMargin__Entries(sheet).entries; return list.map((i) => listed[i].code); };
    const sheetWith = (notes) => { const s = { Sheet__Id : 'Sheet_001', Sheet__PaperSize : 'A3', Sheet__Orientation : 'landscape', Sheet__MarginNotes : notes }; Records.Na__LeRec__NormaliseMarginNotes(s); return s; };
    const margin = (extra) => Object.assign({ Enabled : true, WidthMm : 90, Heading : null, TextSizeMm : 2, IncludeGeneral : true, GroupHeadings : false }, extra || {});
    const region = (id, frame, extra) => Object.assign({ Region__Id : id, Region__FrameMm : frame, Region__Overspill : false, Region__Groups : [], Region__Borders : { Top : true, Right : true, Bottom : true, Left : true } }, extra || {});
    const BIG   = { X : 20, Y : 20, WidthMm : 220, HeightMm : 240 };               // <-- Room for every note
    const place = (sheet) => Margin.Na__LeMargin__PlanAll(sheet, null).place;

// endregion -------------------------------------------------------------------


console.log('TrueVision3D - overspill note regions: the record, the model, and where every note goes');


// -----------------------------------------------------------------------------
// REGION | The Record
// -----------------------------------------------------------------------------

    console.log('\n  The record (the shipped SheetRecords and its NoteRegions leaf)');
    const plain = sheetWith(margin());
    check('a margin record with no regions gains no key', Object.keys(plain.Sheet__MarginNotes), [ 'Enabled', 'WidthMm', 'Heading', 'TextSizeMm', 'IncludeGeneral', 'GroupHeadings' ]);
    const off = sheetWith(margin({ RegionsOn : false, Regions : [] }));
    check('RegionsOn false and an empty list are both dropped', [ 'RegionsOn' in off.Sheet__MarginNotes, 'Regions' in off.Sheet__MarginNotes ], [ false, false ]);
    const kept = sheetWith(margin({ Regions : [ region('Region_004', { X : 1, Y : 2, WidthMm : 50, HeightMm : 60 }) ] }));
    check('regions are kept with the switch off, so switching on puts them back', [ 'RegionsOn' in kept.Sheet__MarginNotes, kept.Sheet__MarginNotes.Regions.length ], [ false, 1 ]);
    const messy = sheetWith(margin({ RegionsOn : true, Regions : [
        region('Region_002', { X : 10, Y : 10, WidthMm : 3, HeightMm : 'tall' }, { Region__Title : '   ', Region__Groups : [ 'SpecGroup_002', 'SpecGroup_002', 'SpecGroup_999', '', 7 ] }),
        region('Region_002', { X : 10, Y : 10, WidthMm : 80, HeightMm : 80 }, { Region__Borders : { Top : false } }),
        'not a region', null,
        { Region__Id : 'Region_009' },
        region('', BIG, { Region__Overspill : true, Region__Title : 'Specification' })
    ] }));
    const list = messy.Sheet__MarginNotes.Regions;
    check('RegionsOn is kept as true', messy.Sheet__MarginNotes.RegionsOn, true);
    check('what is not a region drops out; the rest keep their order', list.length, 4);
    check('a duplicate id and a missing one take new ids past EVERY id on the list', list.map((r) => r.Region__Id), [ 'Region_002', 'Region_010', 'Region_009', 'Region_011' ]);
    const least = Setup.Na__LeCfg__GetMarginNotesSetup().regionMinSizeMm;
    check('a frame is held to the least size and a size that is not a number takes it', [ list[0].Region__FrameMm.WidthMm, list[0].Region__FrameMm.HeightMm ], [ least, least ]);
    check('a blank title is the automatic one (null); a typed one is kept as typed', [ list[0].Region__Title, list[3].Region__Title ], [ null, 'Specification' ]);
    check('groups keep their order with no repeats; an id the specification lacks is KEPT', list[0].Region__Groups, [ 'SpecGroup_002', 'SpecGroup_999' ]);
    check('a border never written takes the default (all on as shipped)', list[1].Region__Borders, { Top : false, Right : true, Bottom : true, Left : true });
    check('a region that says nothing takes no overspill and no group', [ list[2].Region__Overspill, list[2].Region__Groups ], [ false, [] ]);
    const fresh = RegionRec.Na__LeRec__NewNoteRegion(list, { X : 5, Y : 6, WidthMm : 40, HeightMm : 50 });
    check('a new region: the next id, the overspill, no group, every border', [ fresh.Region__Id, fresh.Region__Overspill, fresh.Region__Groups, fresh.Region__Borders ], [ 'Region_012', true, [], { Top : true, Right : true, Bottom : true, Left : true } ]);
    check('the readers: on, kept, drawn, and one by id', [ RegionRec.Na__LeRec__NoteRegionsOn(messy), RegionRec.Na__LeRec__NoteRegions(kept).length, RegionRec.Na__LeRec__DrawnNoteRegions(kept).length, RegionRec.Na__LeRec__NoteRegionById(messy, 'Region_009').Region__Id ], [ true, 1, 0, 'Region_009' ]);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Model
// -----------------------------------------------------------------------------

    console.log('\n  The model (the shipped Sheets unit)');
    const announced = [];
    let dirty = 0;
    const Sheets = await load(LE + '07__Core__SheetData/Na__LayoutEditor__SheetModel__Sheets__.js', Object.assign({}, Records, RegionRec, {
        Na__LeModel__Touch       : (reason, sheetId) => announced.push(reason + ':' + sheetId),
        Na__LeModel__AssignDirty : () => { dirty += 1; }
    }));
    const bare = { Sheet__Id : 'Sheet_009' };
    const added = Sheets.Na__LeModel__AddNoteRegion(bare, { X : 30, Y : 40, WidthMm : 70, HeightMm : 90 });
    check('Add on a sheet with no margin record makes one, margin OFF, regions ON', [ bare.Sheet__MarginNotes.Enabled, bare.Sheet__MarginNotes.RegionsOn, added.Region__Id ], [ false, true, 'Region_001' ]);
    check('...announced once as margin', announced.splice(0), [ 'margin:Sheet_009' ]);
    Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_001', { frameMm : { X : 31, WidthMm : 72 } }, true);
    check('a silent update moves the frame, keeps what it was not given, announces nothing', [ bare.Sheet__MarginNotes.Regions[0].Region__FrameMm, announced.length, dirty ], [ { X : 31, Y : 40, WidthMm : 72, HeightMm : 90 }, 0, 1 ]);
    Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_001', { group : { id : 'SpecGroup_003', on : true } });
    Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_001', { group : { id : 'SpecGroup_002', on : true } });
    Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_001', { group : { id : 'SpecGroup_003', on : false }, borders : { Left : false, Nonsense : 'x' }, title : 'Structure', overspill : false });
    const r1 = bare.Sheet__MarginNotes.Regions[0];
    check('groups tick and untick one at a time; the sides given change; the title and overspill are set', [ r1.Region__Groups, r1.Region__Borders, r1.Region__Title, r1.Region__Overspill ], [ [ 'SpecGroup_002' ], { Top : true, Right : true, Bottom : true, Left : false }, 'Structure', false ]);
    check('...each an announced step', announced.splice(0).length, 3);
    Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_001', { title : '' });
    check('an empty title goes back to the automatic one', bare.Sheet__MarginNotes.Regions[0].Region__Title, null);
    check('updating a region the sheet does not have does nothing', [ Sheets.Na__LeModel__UpdateNoteRegion(bare, 'Region_404', { title : 'x' }), announced.splice(0).length ], [ false, 1 ]);
    Sheets.Na__LeModel__AddNoteRegion(bare, BIG, { overspill : false, groups : [ 'SpecGroup_001' ] });
    Sheets.Na__LeModel__UpdateMarginNotes(bare, { regionsOn : false });
    check('the switch off drops RegionsOn and keeps both regions', [ 'RegionsOn' in bare.Sheet__MarginNotes, bare.Sheet__MarginNotes.Regions.map((r) => r.Region__Id) ], [ false, [ 'Region_001', 'Region_002' ] ]);
    Sheets.Na__LeModel__UpdateMarginNotes(bare, { regionsOn : true });
    Sheets.Na__LeModel__DeleteNoteRegion(bare, 'Region_001');
    Sheets.Na__LeModel__DeleteNoteRegion(bare, 'Region_002');
    check('deleting the last region drops the list and leaves the switch on', [ bare.Sheet__MarginNotes.RegionsOn, 'Regions' in bare.Sheet__MarginNotes ], [ true, false ]);
    check('deleting one that is not there does nothing', Sheets.Na__LeModel__DeleteNoteRegion(bare, 'Region_001'), false);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Where Every Note Goes
// -----------------------------------------------------------------------------

    console.log('\n  Where every note goes (the shipped SpecMargin, Column and NoteRegions)');

    // NO REGIONS | The margin is what it always was
    const alone = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4 }));
    const aloneReport = Margin.Na__LeMargin__Report(alone, null);
    check('no regions: the margin lists every note, and what does not fit is overflow as before', [ aloneReport.total, aloneReport.shown + aloneReport.overflow === aloneReport.total, aloneReport.overflow > 0, aloneReport.marginLost === aloneReport.overflow, aloneReport.inRegions, aloneReport.regions.length ], [ 15, true, true, true, 0, 0 ]);
    const hidden = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4, Regions : [ region('Region_001', BIG, { Region__Overspill : true }) ] }));
    check('regions kept with the switch off change nothing', JSON.stringify(Margin.Na__LeMargin__Report(hidden, null)), JSON.stringify(Object.assign({}, aloneReport, { regionsOn : false, settings : hidden.Sheet__MarginNotes })));

    // OVERSPILL | The margin's tail carries on, in order
    const spill = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4, RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Overspill : true }) ] }));
    const sp = place(spill);
    check('the sheet lists its linked notes first and its general notes last', codes(spill, [ 0, 5, 6, 10, 11, 14 ]), [ 'SN01', 'SN06', 'FN01', 'FN05', 'GN01', 'GN04' ]);
    check('the overspill region lists exactly the margin\'s tail, in order', codes(spill, sp.regions[0].list), Margin.Na__LeMargin__Entries(spill).entries.slice(sp.margin.shown).map((e) => e.code));
    check('...and nothing is lost', [ sp.lost, sp.marginLost, sp.regions[0].lost, sp.inRegions + sp.margin.shown ], [ 0, 0, 0, 15 ]);
    const spRep = Margin.Na__LeMargin__Report(spill, null);
    check('the report: the margin\'s overflow carried on, none lost, the rest in regions', [ spRep.marginOverflow > 0, spRep.overflow, spRep.inRegions, spRep.regions[0].title ], [ true, 0, spRep.marginOverflow, 'NOTES (CONTINUED)' ]);

    // GROUP REGIONS | A ticked group leaves the margin; the first region ticking it takes it
    const grouped = sheetWith(margin({ RegionsOn : true, Regions : [
        region('Region_001', BIG, { Region__Groups : [ 'SpecGroup_002' ] }),
        region('Region_002', { X : 250, Y : 20, WidthMm : 60, HeightMm : 200 }, { Region__Groups : [ 'SpecGroup_002', 'SpecGroup_003' ] })
    ] }));
    const gp = place(grouped);
    check('the structural notes are the first region\'s, and nobody else\'s', codes(grouped, gp.regions[0].list), [ 'SN01', 'SN02', 'SN03', 'SN04', 'SN05', 'SN06' ]);
    check('the second region, ticking both, gets only the finishes', codes(grouped, gp.regions[1].own), [ 'FN01', 'FN02', 'FN03', 'FN04', 'FN05' ]);
    check('the margin keeps only what no region claims', codes(grouped, gp.marginList), [ 'GN01', 'GN02', 'GN03', 'GN04' ]);
    check('titles: a lone group\'s own, several groups NOTES', gp.regions.map((p) => p.title), [ 'Structural Notes', 'NOTES' ]);

    // MARGIN OFF | The overspill takes every unclaimed note; without one they are not listed
    const offSpill = sheetWith(margin({ Enabled : false, RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Overspill : true }) ] }));
    const os = place(offSpill);
    check('margin off: the overspill region lists every note, in order', [ os.margin, codes(offSpill, os.regions[0].list).length, os.unlisted, os.lost ], [ null, 15, 0, 0 ]);
    const offGroups = sheetWith(margin({ Enabled : false, RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Groups : [ 'SpecGroup_003' ] }) ] }));
    const og = place(offGroups);
    const ogRep = Margin.Na__LeMargin__Report(offGroups, null);
    check('margin off, a group region only: the rest are NOT LISTED, which is not lost', [ codes(offGroups, og.regions[0].list).length, og.unlisted, og.lost, ogRep.on, ogRep.total ], [ 5, 10, 0, false, 15 ]);

    // THE CHAIN | Two small overspill regions: the first fills, the second carries on
    const small = { WidthMm : 90, HeightMm : 60 };
    const chain = sheetWith(margin({ Enabled : false, RegionsOn : true, Regions : [
        region('Region_001', Object.assign({ X : 10, Y : 10 }, small), { Region__Overspill : true }),
        region('Region_002', Object.assign({ X : 110, Y : 10 }, small), { Region__Overspill : true })
    ] }));
    const ch = place(chain);
    const a = ch.regions[0], b = ch.regions[1];
    check('the first fills and hands on exactly what it could not fit', codes(chain, b.list), codes(chain, a.list.slice(a.shown)));
    check('...the first carries on into the second, which is the last', [ a.carriedTo.id, b.carriedTo, a.lost ], [ 'Region_002', null, 0 ]);
    check('...and what the last cannot fit is lost', [ ch.lost, b.lost, b.tail, a.shown + b.shown + ch.lost ], [ b.tail, b.tail, b.tail, 15 ]);

    // OWN GROUPS FIRST | An overspill region lists what it ticked before the overspill
    const both = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4, RegionsOn : true, Regions : [ region('Region_001', BIG, { Region__Overspill : true, Region__Groups : [ 'SpecGroup_003' ] }) ] }));
    const bt = place(both);
    check('its own finishes come first, then the margin\'s tail in order', codes(both, bt.regions[0].list), [ 'FN01', 'FN02', 'FN03', 'FN04', 'FN05' ].concat(codes(both, bt.marginList.slice(bt.margin.shown))));
    check('an overspill region with a group reads NOTES', bt.regions[0].title, 'NOTES');

    // A GROUP REGION'S TAIL | Carried on into the overspill, in specification order with the margin's
    const tails = sheetWith(margin({ WidthMm : 40, TextSizeMm : 4, RegionsOn : true, Regions : [
        region('Region_001', { X : 10, Y : 10, WidthMm : 90, HeightMm : 50 }, { Region__Groups : [ 'SpecGroup_002' ] }),
        region('Region_002', BIG, { Region__Overspill : true })
    ] }));
    const tl = place(tails);
    const expected = tl.marginList.slice(tl.margin.shown).concat(tl.regions[0].list.slice(tl.regions[0].shown)).sort((x, y) => x - y);
    check('the group region\'s tail is carried, not lost', [ tl.regions[0].tail > 0, tl.regions[0].lost, tl.regions[0].carriedTo.id ], [ true, 0, 'Region_002' ]);
    check('...and the overspill lists both tails merged in specification order', codes(tails, tl.regions[1].list), codes(tails, expected));

    // KEPT ON THE PAPER, TITLED AND BOXED
    const stray = sheetWith(margin({ Enabled : false, RegionsOn : true, Regions : [
        region('Region_001', { X : 500, Y : -40, WidthMm : 80, HeightMm : 60 }, { Region__Overspill : true, Region__Title : 'Notes Continued' }),
        region('Region_002', { X : 20, Y : 200, WidthMm : 80, HeightMm : 40 }, { Region__Groups : [ 'SpecGroup_001' ], Region__Borders : { Top : true, Right : false, Bottom : false, Left : false } })
    ] }));
    const st = place(stray);
    check('a region off the paper is moved back onto it, its size kept', st.regions[0].rect, { X : 340, Y : 0, WidthMm : 80, HeightMm : 60 });
    const pushed = [];
    Margin.Na__LeMargin__Push(pushed, stray, null);
    const lineMm = 0.5 * 25.4 / 72;
    const boxed  = pushed.filter((p) => p.Kind === 'rect' && p.X === 340);
    const topRule = pushed.filter((p) => p.Kind === 'line' && p.Y1 === 200 && p.Y2 === 200 && p.X1 === 20 && p.X2 === 100);
    check('all four borders: one outlined paper box in the divider\'s weight', boxed.map((p) => [ p.StrokeColour, Math.round(p.StrokeMm * 1000), p.FillColour ]), [ [ '#172b3a', Math.round(lineMm * 1000), '#ffffff' ] ]);
    check('the top border alone: one line along the top, and paper with no outline', [ topRule.length, pushed.filter((p) => p.Kind === 'rect' && p.X === 20 && p.Y === 200 && !p.StrokeColour).length ], [ 1, 1 ]);
    check('the titles print in tracked capitals: the typed one, a lone group\'s', pushed.filter((p) => p.Kind === 'text' && (p.Text === 'NOTES CONTINUED' || p.Text === 'GENERAL NOTES')).map((p) => p.Text), [ 'NOTES CONTINUED', 'GENERAL NOTES' ]);

    // A TITLE TOO WIDE FOR ITS BOX WRAPS, where it used to run past the edge
    const narrow = sheetWith(margin({ Enabled : false, RegionsOn : true, Regions : [
        region('Region_001', { X : 20, Y : 20, WidthMm : 40, HeightMm : 120 }, { Region__Overspill : true, Region__Title : 'Building Features - South West Elevation - Main House' })
    ] }));
    const np = place(narrow).regions[0];
    const titleRuns = np.plan.runs.filter((r) => r.fontMm === Setup.Na__LeCfg__GetMarginNotesSetup().headingSizeMm);
    const measure = chrome.Na__LeChrome__MeasureTextMm;
    check('a long title wraps onto several lines, every word kept', [ titleRuns.length > 1, titleRuns.map((r) => r.text).join(' ') ], [ true, 'BUILDING FEATURES - SOUTH WEST ELEVATION - MAIN HOUSE' ]);
    check('...each line inside the box, tracking and all', titleRuns.every((r) => r.x + measure(r.text, r.fontMm, 'bold', r.trackingMm) <= np.rect.X + np.rect.WidthMm), true);
    check('...and the notes start below the last of its lines', np.plan.runs[titleRuns.length].baselineY > titleRuns[titleRuns.length - 1].baselineY, true);
    check('a title that fits is still one run', place(stray).regions[0].plan.runs.filter((r) => r.text === 'NOTES CONTINUED').length, 1);

    // A REGION TITLED AFTER ITS ONE GROUP does not say the group again under its title
    const headings = (plan) => plan.runs.filter((r) => r.colour === '#6c757d').map((r) => r.text);
    const named = sheetWith(margin({ GroupHeadings : true, RegionsOn : true, Regions : [
        region('Region_001', BIG, { Region__Groups : [ 'SpecGroup_002' ] }),
        region('Region_002', { X : 250, Y : 20, WidthMm : 80, HeightMm : 200 }, { Region__Groups : [ 'SpecGroup_003' ], Region__Title : 'Finishes Schedule' })
    ] }));
    const nm = place(named);
    check('titled after its one group: the title once, and no group heading under it', [ nm.regions[0].title, headings(nm.regions[0].plan) ], [ 'Structural Notes', [] ]);
    check('...a typed title keeps the group heading', headings(nm.regions[1].plan), [ 'FINISHES' ]);
    check('...and the margin keeps its own', headings(nm.margin), [ 'GENERAL NOTES' ]);

// endregion -------------------------------------------------------------------


console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'Every check passed'));
process.exit(failures ? 1 : 0);
