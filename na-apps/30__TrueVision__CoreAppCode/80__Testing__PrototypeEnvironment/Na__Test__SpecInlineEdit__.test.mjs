// =============================================================================
// TRUEVISION3D - TEST - SPECIFICATION NOTE EDITED IN THE DRAWING
// =============================================================================
//
// FILE       : Na__Test__SpecInlineEdit__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Specification Inline Edit Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a note reworded in the drawing's Specification tab reaches the specification, the local file and - with Save Sheets - R2, and nothing is lost on the way
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE REAL SPECIFICATION. The shipped State, Document, Draft, Editing and
//   Transport units and Na__LayoutEditor__SpecData__.js are loaded WIRED TO
//   EACH OTHER, exactly as the browser loads them; only the world outside
//   them is stubbed: the config, the project code, localhost, the confirm
//   dialog, R2 through the Worker (a map standing in for the bucket) and the
//   ProjectVision local server (a map standing in for the disk, served back
//   over fetch as the Flask static route serves it).
// - THE SAVE: UpdateNote takes the note, one undo step; the draft is written
//   at once; WriteLocalCopy writes the file, reads it back and says verified,
//   and changes none of the cloud bookkeeping - the specification is still
//   unsynced, so Save Sheets still syncs it.
// - WHAT CAN GO WRONG: off localhost it is skipped; a server that refuses is
//   reported; a disk that does not hold what was written is reported; two
//   writes in flight land in the order they were asked for, a slow first
//   write included; Sync's copy waits its turn behind them.
// - THE NEXT SESSION: fresh units, the same disk and bucket - the edit comes
//   back from the local file, unsynced against the cloud, and Save Sheets'
//   Sync writes it to R2 and the local file.
// - THE ROW EDITOR'S RULES (the shipped RowEditor): a title kept to one line,
//   a text trimmed at its ends with its line breaks kept, and only a field
//   that was typed into is written - never a field left alone.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SpecInlineEdit__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with editing a note in the drawing's Specification tab (TrueVision3D v2.144.0).
//
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.resolve(HERE, '..', '02__Src__AppModules');
const SPEC = path.resolve(SRC, '51__System__LayoutEditor', '50__Feature__Specification');
const SCRAP = path.resolve(SRC, '51__System__LayoutEditor', '58__Feature__ScrapbookSpecification');

let failures = 0;
function check(name, got, want) {
    const passed = JSON.stringify(got) === JSON.stringify(want);
    if (!passed) failures++;
    console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
    if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
}
const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 0));

// -----------------------------------------------------------------------------
// REGION | Loading the Units Wired to Each Other, the World Stubbed
// -----------------------------------------------------------------------------

    const IMPORT = /^[ \t]*import\s+(\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'([^']+)';[ \t]*(?:\/\/[^\n]*)?$/gm;
    const UNITS  = [ 'State', 'Document', 'Draft', 'Editing', 'Transport' ];

    // One session: every unit transformed once and written to its own folder,
    // so the units of one session share each other's instances and a second
    // session starts from nothing.
    let sessions = 0;
    async function loadSession() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'na_spec_inline_' + (++sessions) + '_'));
        const url = (name) => pathToFileURL(path.join(dir, name)).href;
        const transform = (file) => {
            let src = fs.readFileSync(path.join(SPEC, file), 'utf8').replace(/\r\n/g, '\n');
            const stubbed = [];
            src = src.replace(IMPORT, (whole, names, spec) => {
                const unit = /^\.\/(Na__LayoutEditor__SpecData__(?:\w+__)?\.js)$/.exec(spec);
                if (unit) return 'import ' + names + ' from ' + JSON.stringify(url(unit[1])) + ';';
                names.trim().slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => stubbed.push(s.split(/\s+as\s+/).pop()));
                return '';
            });
            const head = stubbed.map((n) => 'const ' + n + ' = (...args) => globalThis.__spec[' + JSON.stringify(n) + '](...args);').join('\n');
            fs.writeFileSync(path.join(dir, file), head + '\n' + src, 'utf8');
        };
        UNITS.forEach((unit) => transform('Na__LayoutEditor__SpecData__' + unit + '__.js'));
        transform('Na__LayoutEditor__SpecData__.js');
        return import(url('Na__LayoutEditor__SpecData__.js'));
    }

    // A few stubs are values, not functions: an event name.
    function valueStub(name, value) {
        // The transformed units call every stubbed name as a function; the
        // event names are the exception and are read as values, so they are
        // given as functions that also carry the value when coerced.
        return Object.assign(() => value, { toString : () => value, valueOf : () => value });
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The World: Config, Browser, R2 and the Disk
// -----------------------------------------------------------------------------

    const SETUP = {
        fileName : 'TrueVision__DrawingNotes__.json', legacyFileName : '', loadTimeoutMs : 2000,
        numberDigits : 2, prefixMaxLength : 4, defaultRevision : 'A', documentNumberSuffix : '_SPEC',
        historySteps : 50, draftEnabled : true, draftDebounceMs : 50, confirmOverwrite : true, starterGroups : []
    };
    const REPO_URL = 'http://localhost:8090/na-project-portal/26-Projects/TT01__Test/30__TrueVision__AppContent/TrueVision__DrawingNotes__.json';
    const world = {
        localhost : true,
        bucket    : new Map(),          // <-- R2: file name -> document
        disk      : new Map(),          // <-- the repository: file name -> document
        writes    : [],                 // <-- every local write asked for, in the order it LANDED
        mirror    : null,               // <-- overrides the local server's answer
        toasts    : [],
        store     : new Map()
    };

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    const announced = [];
    globalThis.window = {
        location            : { origin : 'http://localhost:8090', hostname : 'localhost', port : '8090' },
        dispatchEvent       : (event) => { announced.push(event.detail); return true; },
        addEventListener    : () => {}, removeEventListener : () => {},
        setTimeout          : (fn, ms) => setTimeout(fn, ms),
        clearTimeout        : (id) => clearTimeout(id),
        localStorage        : { getItem : (k) => (world.store.has(k) ? world.store.get(k) : null), setItem : (k, v) => world.store.set(k, String(v)), removeItem : (k) => world.store.delete(k) }
    };
    globalThis.document = { addEventListener : () => {} };
    globalThis.fetch = async (where) => {
        if (String(where) === REPO_URL) {
            const doc = world.disk.get(SETUP.fileName);
            return doc ? { ok : true, status : 200, json : async () => JSON.parse(JSON.stringify(doc)) } : { ok : false, status : 404, json : async () => null };
        }
        return { ok : false, status : 404, json : async () => null };
    };

    globalThis.__spec = {
        Na__LeCfg__GetSpecificationSetup : () => SETUP,
        Na__LeCfg__GetLabel              : (key, fallback) => fallback,
        Na__LeCfg__FormatLabel           : (key, fallback, tokens) => Object.keys(tokens || {}).reduce((t, n) => t.split('{' + n + '}').join(String(tokens[n])), fallback),
        Na__DrawData__GetProjectCode     : () => 'TT01',
        Na__DrawData__CHANGED_EVENT      : valueStub('Na__DrawData__CHANGED_EVENT', 'na-drawdata-changed'),
        Na__AppUtils__IsRunningOnLocalhost : () => world.localhost,
        Na__DevGate__IsAuthoringEnabled  : () => false,
        Na__AppUtils__ConfirmDialog__Show : async () => true,
        Na__CfApi__IsConfigured          : () => true,
        Na__CfApi__ProjectFileLocation   : (name) => ({ repoUrl : REPO_URL, cdnUrl : 'https://cdn.example/' + name }),
        Na__CfApi__ReadProjectFile       : async (name) => (world.bucket.has(name) ? { ok : true, missing : false, data : JSON.parse(JSON.stringify(world.bucket.get(name))) } : { ok : true, missing : true, data : null }),
        Na__CfApi__WriteProjectFile      : async (name, doc) => { world.bucket.set(name, JSON.parse(JSON.stringify(doc))); return { ok : true }; },
        Na__LocalMirror__WriteSiblingFile : async (name, doc) => {
            if (!world.localhost) return { ok : false, skipped : true, error : null };
            const answer = world.mirror ? await world.mirror(name, doc) : { ok : true, skipped : false, error : null, store : true };
            if (answer.store !== false && answer.ok) world.disk.set(name, JSON.parse(JSON.stringify(doc)));
            if (answer.ok) world.writes.push(doc.ProjectSpecification__Groups[0].Group__Notes[0].Note__Body);
            return { ok : answer.ok, skipped : false, error : answer.error || null };
        }
    };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Project's Specification, in the Cloud and on Disk
// -----------------------------------------------------------------------------

    const T0 = '2026-09-20T10:00:00.000Z';
    const CLOUD = {
        ProjectSpecification__Description : 'x', ProjectSpecification__Version : 1, ProjectSpecification__ProjectCode : 'TT01',
        ProjectSpecification__UpdatedIso : T0, ProjectSpecification__NumberDigits : 2, ProjectSpecification__LastIdNumber : 3,
        ProjectSpecification__Revision : 'A', ProjectSpecification__DocumentNumber : '',
        ProjectSpecification__Groups : [ { Group__Id : 'SpecGroup_001', Group__Prefix : 'EW', Group__Title : 'External Walls', Group__IsGeneral : false,
            Group__Notes : [
                { Note__Id : 'SpecNote_002', Note__Code : 'EW01', Note__Title : 'Loggia Arcade', Note__Body : 'Three arched openings in a recessed bay.', Note__UpdatedIso : T0 },
                { Note__Id : 'SpecNote_003', Note__Code : 'EW02', Note__Title : 'Flanking Windows', Note__Body : 'Larger windows flank the arcade.', Note__UpdatedIso : T0 }
            ] } ]
    };
    world.bucket.set(SETUP.fileName, CLOUD);
    world.disk.set(SETUP.fileName, CLOUD);

// endregion -------------------------------------------------------------------


console.log('\nTrueVision3D - a specification note edited in the drawing\n\n  The save');
const S = await loadSession();
S.Na__LeSpec__Initialize({ editable : true, showToast : (message, isError) => world.toasts.push([ message, isError ]) });
await S.Na__LeSpec__EnsureLoaded();
check('the specification loads from the cloud, in step with the disk, synced', [ S.Na__LeSpec__GetState().status, S.Na__LeSpec__GetState().source, S.Na__LeSpec__IsDirty() ], [ 'ready', 'cloud', false ]);

const EDITED = 'Three arched openings in a recessed bay, with Kingspan K15 behind.';
check('UpdateNote takes the edit (the Project Specification tab\'s own commit)', S.Na__LeSpec__UpdateNote('SpecNote_002', { body : EDITED }, false), true);
check('...and the specification is now unsynced', S.Na__LeSpec__IsDirty(), true);
check('...one undo step on the Project Specification tab', S.Na__LeSpec__CanUndo(), true);
check('...the change is announced as a note change, no code moved', announced.filter((d) => d.reason === 'note').map((d) => [ d.noteId, d.codesChanged ]), [ [ 'SpecNote_002', false ] ]);
S.Na__LeSpec__FlushDraft();
const draft = JSON.parse(world.store.get('Na__LayoutEditor__SpecDraft__TT01') || 'null');
check('the browser draft is written at once, holding the edit', draft ? draft.doc.ProjectSpecification__Groups[0].Group__Notes[0].Note__Body : null, EDITED);

const liveStampBefore = S.Na__LeSpec__GetDocument().ProjectSpecification__UpdatedIso;
let result = await S.Na__LeSpec__WriteLocalCopy();
const onDisk = world.disk.get(SETUP.fileName);
check('WriteLocalCopy: written, read back, verified', result, { ok : true, skipped : false, verified : true, error : null });
check('...the local file holds the edit', onDisk.ProjectSpecification__Groups[0].Group__Notes[0].Note__Body, EDITED);
check('...stamped later than the cloud copy it started from', onDisk.ProjectSpecification__UpdatedIso > T0, true);
check('...with the id counter kept', onDisk.ProjectSpecification__LastIdNumber >= 3, true);
check('...the other note untouched', onDisk.ProjectSpecification__Groups[0].Group__Notes[1].Note__Body, 'Larger windows flank the arcade.');
check('the LIVE document is never stamped (its undo history stays true)', S.Na__LeSpec__GetDocument().ProjectSpecification__UpdatedIso, liveStampBefore);
check('R2 is not touched', world.bucket.get(SETUP.fileName).ProjectSpecification__Groups[0].Group__Notes[0].Note__Body, 'Three arched openings in a recessed bay.');
check('the specification is STILL unsynced, so Save Sheets still syncs it', [ S.Na__LeSpec__IsDirty(), S.Na__LeSpec__GetState().canSync ], [ true, true ]);

console.log('\n  What can go wrong');
world.localhost = false;
check('off localhost it is skipped (the web build has no local file)', await S.Na__LeSpec__WriteLocalCopy(), { ok : false, skipped : true, verified : false, error : null });
world.localhost = true;

world.mirror = async () => ({ ok : false, error : 'the ProjectVision local server refused this write (405)' });
result = await S.Na__LeSpec__WriteLocalCopy();
check('a server that refuses is reported, with its reason', [ result.ok, result.skipped, result.error ], [ false, false, 'the ProjectVision local server refused this write (405)' ]);

world.mirror = async () => ({ ok : true, store : false });                  // <-- The server says ok, and the disk does not change
S.Na__LeSpec__UpdateNote('SpecNote_002', { body : EDITED + ' Again.' }, false);
result = await S.Na__LeSpec__WriteLocalCopy();
check('a disk that does not hold what was written is caught by the read-back', [ result.ok, result.verified, result.error ], [ false, false, 'the file on disk does not hold what was written' ]);
world.mirror = null;

world.writes.length = 0;
let slow = true;
world.mirror = async () => { if (slow) { slow = false; await tick(80); } return { ok : true }; };   // <-- The first write is slow, the second is not
S.Na__LeSpec__UpdateNote('SpecNote_002', { body : 'First edit.' }, false);
const first  = S.Na__LeSpec__WriteLocalCopy();
S.Na__LeSpec__UpdateNote('SpecNote_002', { body : 'Second edit.' }, false);
const second = S.Na__LeSpec__WriteLocalCopy();
const both   = await Promise.all([ first, second ]);
check('two writes in flight land in the order they were asked for, the slow first one included', world.writes, [ 'First edit.', 'Second edit.' ]);
check('...both verified, and the disk holds the second', [ both[0].verified, both[1].verified, world.disk.get(SETUP.fileName).ProjectSpecification__Groups[0].Group__Notes[0].Note__Body ], [ true, true, 'Second edit.' ]);
world.mirror = null;

S.Na__LeSpec__UpdateNote('SpecNote_002', { body : EDITED }, false);        // <-- The row editor's own order: the change, the draft at once, the file
S.Na__LeSpec__FlushDraft();
await S.Na__LeSpec__WriteLocalCopy();

console.log('\n  The next session (fresh units, the same disk and bucket)');
announced.length = 0;
const toastsBefore = world.toasts.length;
const S2 = await loadSession();
S2.Na__LeSpec__Initialize({ editable : true, showToast : (message) => world.toasts.push([ message ]) });
await S2.Na__LeSpec__EnsureLoaded();
check('the edit comes back from the local file, newer than R2', [ S2.Na__LeSpec__GetState().source, S2.Na__LeSpec__GetNoteEntry('SpecNote_002').note.Note__Body ], [ 'repository', EDITED ]);
check('...the browser draft agrees with the file, so nothing is "restored" over it', [ world.toasts.length - toastsBefore, world.store.has('Na__LayoutEditor__SpecDraft__TT01') ], [ 0, false ]);
check('...and reads as unsynced against the cloud: Save Sheets lights up', S2.Na__LeSpec__IsDirty(), true);
const synced = await S2.Na__LeSpec__Sync({ showToast : () => {} });
check('Save Sheets\' Sync writes it to R2, asking nothing (the cloud is where it was read)', [ synced, world.bucket.get(SETUP.fileName).ProjectSpecification__Groups[0].Group__Notes[0].Note__Body ], [ true, EDITED ]);
check('...and the local file carries the same stamp as R2', world.disk.get(SETUP.fileName).ProjectSpecification__UpdatedIso, world.bucket.get(SETUP.fileName).ProjectSpecification__UpdatedIso);
check('...and nothing is unsynced any more', S2.Na__LeSpec__IsDirty(), false);

// -----------------------------------------------------------------------------
// THE ROW EDITOR'S RULES
// -----------------------------------------------------------------------------
console.log('\n  The row editor\'s rules (the shipped RowEditor)');
{
    let src = fs.readFileSync(path.join(SCRAP, 'Na__LayoutEditor__ScrapbookSpecification__RowEditor__.js'), 'utf8').replace(/\r\n/g, '\n');
    src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
    const names = [ 'Na__LeSpec__IsLoaded', 'Na__LeSpec__IsEditable', 'Na__LeSpec__GetNoteEntry', 'Na__LeSpec__UpdateNote', 'Na__LeSpec__FlushDraft', 'Na__LeSpec__WriteLocalCopy', 'Na__LeSurface__GetElements', 'Na__LePanels__IsEditable', 'Na__LePanels__GetContext', 'Na__LeScrapSpec__Label', 'Na__SpellCheck__Field', 'Na__SpellCheck__WordBar' ];
    const tmp = path.join(os.tmpdir(), 'Na__Test__SpecInlineEdit__RowEditor__.mjs');
    fs.writeFileSync(tmp, names.map((n) => 'const ' + n + ' = () => undefined;').join('\n') + '\n' + src, 'utf8');
    const E = await import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
    const O = { title : 'Loggia Arcade', body : 'Three arched openings.' };

    check('a title is one line, trimmed', E.Na__LeScrapSpecEd__TidyTitle('  Loggia\nArcade \r\n '), 'Loggia Arcade');
    check('a text keeps its line breaks, trimmed at its ends and of trailing spaces', E.Na__LeScrapSpecEd__TidyBody('  First line.   \r\nSecond line.\n\n'), 'First line.\nSecond line.');
    check('nothing typed: nothing written', E.Na__LeScrapSpecEd__Patch(O, O, O), null);
    check('only the text typed into: only the text written', E.Na__LeScrapSpecEd__Patch(O, { title : O.title, body : 'Four openings.' }, O), { body : 'Four openings.' });
    check('a field left alone is never written back over a change made meanwhile',
        E.Na__LeScrapSpecEd__Patch(O, { title : O.title, body : 'Four openings.' }, { title : 'Renamed Elsewhere', body : O.body }), { body : 'Four openings.' });
    check('typed back to what the note already says: nothing written', E.Na__LeScrapSpecEd__Patch(O, { title : ' Loggia Arcade ', body : O.body }, O), null);
    check('both typed into: both written, tidied', E.Na__LeScrapSpecEd__Patch(O, { title : 'Loggia\nArcade East ', body : 'A.  \nB.' }, O), { title : 'Loggia Arcade East', body : 'A.\nB.' });
}

console.log('\n  ' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED') + '\n');
process.exit(failures === 0 ? 0 : 1);
