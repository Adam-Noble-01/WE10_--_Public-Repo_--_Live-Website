// =============================================================================
// TRUEVISION3D - TEST - SPECIFICATION LOCKSTEP WITH ITS LOCAL FILE
// =============================================================================
//
// FILE       : Na__Test__SpecLockstep__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Specification Lockstep Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the specification never writes over its local file when an agent has changed it, asks instead, and loses nothing whichever copy is kept
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE REAL SPECIFICATION, lockstep ON. The shipped State, Document, Draft,
//   Lockstep, Editing and Transport units and Na__LayoutEditor__SpecData__.js
//   are loaded wired to each other, with the Statement Writer's REAL pure
//   lockstep rules; only the world outside them is stubbed - the config, the
//   project code, localhost, the confirm dialog, R2 (a map standing in for
//   the bucket) and the ProjectVision local server (a map standing in for the
//   disk, served back over fetch with a Last-Modified header).
// - "The agent" is this test writing the local file directly, as tv_notes.py
//   does: behind the app's back, with a fresh stamp.
// - WHAT IS PROVED
//   - The autosave writes the app's copy to the file once the editing pauses;
//     the cloud bookkeeping does not move (still unsynced).
//   - An agent's edit is SEEN by a look (file-ahead), is never written over by
//     the autosave, Enter (WriteLocalCopy) or Sync, and Sync touches neither
//     R2 nor the disk while the question stands.
//   - "Load the file" takes the agent's copy, puts the app's aside in this
//     browser, and leaves it UNSYNCED so Save Sheets sends it to R2.
//   - Both moved: the autosave is held; "Keep the app's copy" writes it and
//     puts the file's aside.
//   - Both arrived at the same content: taken as saved, nothing asked.
//   - A file that moves during Sync's R2 write is not written over on disk.
//   - On load, a browser draft that differs from the file is ASKED about,
//     both ways, instead of being put back with a toast.
//   - Reload Local asks nothing when nothing would be lost, and leaves an
//     agent's file unsynced against R2 (it used to mark it synced).
//   - A hand-written note with no id never makes the watch ask again and
//     again: the file's key ignores this session's id floor.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SpecLockstep__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Written with the specification lockstep (TrueVision3D v2.162.0).
//
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE      = path.dirname(fileURLToPath(import.meta.url));
const SRC       = path.resolve(HERE, '..', '02__Src__AppModules');
const SPEC      = path.resolve(SRC, '51__System__LayoutEditor', '50__Feature__Specification');
const STMT_LOCK = path.resolve(SRC, '51__System__LayoutEditor', '52__Feature__StatementWriter', '01__Core__Data', 'Na__LayoutEditor__Statement__Lockstep__.js');

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
    const UNITS  = [ 'State', 'Document', 'Draft', 'Lockstep', 'Editing', 'Transport' ];

    let sessions = 0;
    async function loadSession() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'na_spec_lock_' + (++sessions) + '_'));
        fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}', 'utf8');
        fs.copyFileSync(STMT_LOCK, path.join(dir, 'Na__LayoutEditor__Statement__Lockstep__.js'));
        const url = (name) => pathToFileURL(path.join(dir, name)).href;
        const transform = (file) => {
            let src = fs.readFileSync(path.join(SPEC, file), 'utf8').replace(/\r\n/g, '\n');
            const stubbed = [];
            src = src.replace(IMPORT, (whole, names, spec) => {
                const unit = /^\.\/(Na__LayoutEditor__SpecData__(?:\w+__)?\.js)$/.exec(spec);
                if (unit) return 'import ' + names + ' from ' + JSON.stringify(url(unit[1])) + ';';
                if (/Na__LayoutEditor__Statement__Lockstep__\.js$/.test(spec)) return 'import ' + names + ' from ' + JSON.stringify(url('Na__LayoutEditor__Statement__Lockstep__.js')) + ';';
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

    function valueStub(value) {
        return Object.assign(() => value, { toString : () => value, valueOf : () => value });
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The World: Config, Browser, R2 and the Disk
// -----------------------------------------------------------------------------

    const SETUP = {
        fileName : 'TrueVision__DrawingNotes__.json', legacyFileName : '', loadTimeoutMs : 2000,
        numberDigits : 2, prefixMaxLength : 4, defaultRevision : 'A', documentNumberSuffix : '_SPEC',
        historySteps : 50, draftEnabled : true, draftDebounceMs : 20, confirmOverwrite : true, starterGroups : [],
        lockstepEnabled : true, lockstepPollMs : 1000, autoSaveLocalMs : 40
    };
    const FILE     = SETUP.fileName;
    const REPO_URL = 'http://localhost:8090/na-project-portal/26-Projects/TT01__Test/30__TrueVision__AppContent/TrueVision__DrawingNotes__.json';
    const world = {
        localhost : true,
        bucket    : new Map(),
        disk      : new Map(),
        mtime     : new Map(),          // <-- the server's Last-Modified per file, as an HTTP date
        clock     : Date.now(),                 // <-- The app stamps real time, so the agent does too
        appWrites : 0,
        r2Writes  : 0,
        onR2Write : null,
        confirms  : 0,
        toasts    : [],
        store     : new Map()
    };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const touch = (name) => { world.clock += 5000; world.mtime.set(name, new Date(world.clock).toUTCString()); };

    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    const announced = [];
    globalThis.window = {
        location            : { origin : 'http://localhost:8090', hostname : 'localhost', port : '8090' },
        dispatchEvent       : (event) => { announced.push(event.detail); return true; },
        addEventListener    : () => {}, removeEventListener : () => {},
        setTimeout          : (fn, ms) => setTimeout(fn, ms),
        clearTimeout        : (id) => clearTimeout(id),
        setInterval         : (fn, ms) => setInterval(fn, ms),
        clearInterval       : (id) => clearInterval(id),
        localStorage        : { getItem : (k) => (world.store.has(k) ? world.store.get(k) : null), setItem : (k, v) => world.store.set(k, String(v)), removeItem : (k) => world.store.delete(k) }
    };
    globalThis.document = { addEventListener : () => {}, visibilityState : 'visible' };
    globalThis.fetch = async (where) => {
        if (String(where) === REPO_URL) {
            const doc = world.disk.get(FILE);
            if (!doc) return { ok : false, status : 404, headers : { get : () => null }, json : async () => null };
            return { ok : true, status : 200, headers : { get : (h) => (h === 'Last-Modified' ? world.mtime.get(FILE) || null : null) }, json : async () => clone(doc) };
        }
        return { ok : false, status : 404, headers : { get : () => null }, json : async () => null };
    };

    globalThis.__spec = {
        Na__LeCfg__GetSpecificationSetup : () => SETUP,
        Na__LeCfg__GetLabel              : (key, fallback) => fallback,
        Na__LeCfg__FormatLabel           : (key, fallback, tokens) => Object.keys(tokens || {}).reduce((t, n) => t.split('{' + n + '}').join(String(tokens[n])), fallback),
        Na__DrawData__GetProjectCode     : () => 'TT01',
        Na__DrawData__CHANGED_EVENT      : valueStub('na-drawdata-changed'),
        Na__AppUtils__IsRunningOnLocalhost : () => world.localhost,
        Na__DevGate__IsAuthoringEnabled  : () => false,
        Na__AppUtils__ConfirmDialog__Show : async () => { world.confirms++; return true; },
        Na__CfApi__IsConfigured          : () => true,
        Na__CfApi__ProjectFileLocation   : (name) => ({ repoUrl : REPO_URL, cdnUrl : 'https://cdn.example/' + name }),
        Na__CfApi__ReadProjectFile       : async (name) => (world.bucket.has(name) ? { ok : true, missing : false, data : clone(world.bucket.get(name)) } : { ok : true, missing : true, data : null }),
        Na__CfApi__WriteProjectFile      : async (name, doc) => {
            world.r2Writes++;
            world.bucket.set(name, clone(doc));
            if (world.onR2Write) { const hook = world.onR2Write; world.onR2Write = null; await hook(); }
            return { ok : true };
        },
        Na__LocalMirror__WriteSiblingFile : async (name, doc) => {
            if (!world.localhost) return { ok : false, skipped : true, error : null };
            world.appWrites++;
            world.disk.set(name, clone(doc));
            touch(name);
            return { ok : true, skipped : false, error : null };
        }
    };

    // THE AGENT. Reads the file on disk, changes it, stamps it and writes it
    // back - never through the app.
    function agentWrite(change) {
        const doc = clone(world.disk.get(FILE));
        change(doc);
        world.clock += 5000;
        doc.ProjectSpecification__UpdatedIso = new Date(world.clock).toISOString();
        world.disk.set(FILE, doc);
        touch(FILE);
        return doc;
    }
    const notesOf  = (doc) => doc.ProjectSpecification__Groups.flatMap((g) => g.Group__Notes);
    const bodyOf   = (doc, id) => { const note = notesOf(doc).find((n) => n.Note__Id === id); return note ? note.Note__Body : null; };
    const diskBody = (id) => bodyOf(world.disk.get(FILE), id);
    const r2Body   = (id) => bodyOf(world.bucket.get(FILE), id);
    const discarded = () => { const raw = world.store.get('Na__LayoutEditor__SpecDiscarded__TT01'); return raw ? JSON.parse(raw) : null; };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Project's Specification, in the Cloud and on Disk
// -----------------------------------------------------------------------------

    const T0 = '2026-09-29T08:00:00.000Z';
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
    world.bucket.set(FILE, clone(CLOUD));
    world.disk.set(FILE, clone(CLOUD));
    touch(FILE);

// endregion -------------------------------------------------------------------


console.log('\nTrueVision3D - the specification in lockstep with its local file\n\n  Loading and the autosave');
let S = await loadSession();
const toast = (message, isError) => world.toasts.push([ message, isError === true ]);
S.Na__LeSpec__Initialize({ editable : true, showToast : toast });
await S.Na__LeSpec__EnsureLoaded();
let state = S.Na__LeSpec__GetState();
check('the lockstep is on (localhost, editable, LockstepEnabled)', state.lockstep, true);
check('loaded in step with the file: nothing asked, nothing unsaved', [ state.conflict, state.fileKnown, state.inStepWithFile, state.dirty ], [ false, true, true, false ]);
check('...and the file\'s own date is known (the server\'s Last-Modified)', state.fileIso, new Date(Date.parse(world.mtime.get(FILE))).toISOString());
check('a look finds it in step', await S.Na__LeSpec__CheckFile(), 'in-step');

const TYPED = 'Three arched openings in a recessed bay, with Kingspan K15 behind.';
S.Na__LeSpec__UpdateNote('SpecNote_002', { body : TYPED }, false);
check('an edit: the app is ahead of the file until the autosave', S.Na__LeSpec__GetState().inStepWithFile, false);
let writesBefore = world.appWrites;
await tick(SETUP.autoSaveLocalMs + 60);
check('the autosave writes it to the file once the editing pauses', [ diskBody('SpecNote_002'), world.appWrites - writesBefore ], [ TYPED, 1 ]);
state = S.Na__LeSpec__GetState();
check('...in step with the file now, and STILL unsynced against the cloud', [ state.inStepWithFile, state.dirty, state.canSync ], [ true, true, true ]);
check('...R2 is not touched by the autosave', r2Body('SpecNote_002'), 'Three arched openings in a recessed bay.');


console.log('\n  An agent writes the file (the app has nothing unsaved)');
agentWrite((doc) => {
    doc.ProjectSpecification__Groups[0].Group__Notes.push({ Note__Id : 'SpecNote_004', Note__Code : 'EW03', Note__Title : 'Quoins', Note__Body : 'Ashlar quoins to every corner.', Note__UpdatedIso : null });
    doc.ProjectSpecification__LastIdNumber = 4;
});
writesBefore = world.appWrites;
check('the next look sees it: file ahead', await S.Na__LeSpec__CheckFile(), 'file-ahead');
let asked = S.Na__LeSpec__GetConflict();
check('...and asks: kind file, the file badged newer', [ !!asked, asked && asked.kind, asked && asked.newer ], [ true, 'file', 'file' ]);
check('...saying which note only the file holds', asked.summary.onlyInFile, [ 'EW03' ]);
check('...the question is announced', announced.some((d) => d.reason === 'conflict'), true);
check('...Sync is off while it stands', S.Na__LeSpec__GetState().canSync, false);

S.Na__LeSpec__UpdateNote('SpecNote_003', { body : 'Typed while asked.' }, false);   // <-- Nothing should be written while the question stands
await tick(SETUP.autoSaveLocalMs + 60);
let held = await S.Na__LeSpec__WriteLocalCopy();
check('Enter (WriteLocalCopy) is held, not written', [ held.ok, held.held ], [ false, true ]);
const r2Before = world.r2Writes;
check('Sync refuses', await S.Na__LeSpec__Sync({ showToast : () => {} }), false);
check('...nothing written anywhere: the agent\'s file is intact, R2 untouched', [ world.appWrites - writesBefore, world.r2Writes - r2Before, notesOf(world.disk.get(FILE)).length ], [ 0, 0, 3 ]);
S.Na__LeSpec__Undo();                                                           // <-- Back to what was shown when asked

check('"Load the file"', await S.Na__LeSpec__ResolveConflict('file'), true);
check('...the app now holds the agent\'s note', !!S.Na__LeSpec__GetNoteEntry('SpecNote_004'), true);
check('...the question is gone, in step with the file', [ S.Na__LeSpec__GetConflict(), S.Na__LeSpec__GetState().inStepWithFile ], [ null, true ]);
check('...the app\'s copy it replaced is kept in this browser', discarded() && notesOf(discarded().Doc).length, 2);
state = S.Na__LeSpec__GetState();
check('...and it reads as UNSYNCED, so Save Sheets sends the agent\'s note to R2', [ state.dirty, state.canSync ], [ true, true ]);
check('Save Sheets\' Sync writes it to R2, and the file', [ await S.Na__LeSpec__Sync({ showToast : () => {} }), notesOf(world.bucket.get(FILE)).length, notesOf(world.disk.get(FILE)).length ], [ true, 3, 3 ]);
check('...nothing unsynced, in step with the file', [ S.Na__LeSpec__IsDirty(), S.Na__LeSpec__GetState().inStepWithFile ], [ false, true ]);


console.log('\n  Both move');
S.Na__LeSpec__UpdateNote('SpecNote_003', { body : 'The app\'s own wording.' }, false);
agentWrite((doc) => { doc.ProjectSpecification__Groups[0].Group__Notes[0].Note__Body = 'The agent\'s wording.'; });
writesBefore = world.appWrites;
await tick(SETUP.autoSaveLocalMs + 60);
check('the autosave looks first and writes nothing', [ world.appWrites - writesBefore, diskBody('SpecNote_002') ], [ 0, 'The agent\'s wording.' ]);
asked = S.Na__LeSpec__GetConflict();
check('...asked: both moved', asked && asked.kind, 'both');
check('...the note worded differently is named', asked.summary.changed.map((c) => c.app), [ 'EW01', 'EW02' ]);
check('"Keep the app\'s copy"', await S.Na__LeSpec__ResolveConflict('app'), true);
check('...the file now holds the app\'s copy', [ diskBody('SpecNote_003'), diskBody('SpecNote_002') ], [ 'The app\'s own wording.', TYPED ]);
check('...the file\'s version it replaced is kept in this browser', discarded() && bodyOf(discarded().Doc, 'SpecNote_002'), 'The agent\'s wording.');
check('...in step, nothing asked', [ S.Na__LeSpec__GetConflict(), S.Na__LeSpec__GetState().inStepWithFile ], [ null, true ]);


console.log('\n  Both arrive at the same words');
S.Na__LeSpec__UpdateNote('SpecNote_003', { body : 'Agreed wording.' }, false);
agentWrite((doc) => { doc.ProjectSpecification__Groups[0].Group__Notes[1].Note__Body = 'Agreed wording.'; });
check('a look takes the file as saved: nothing asked', [ await S.Na__LeSpec__CheckFile(), S.Na__LeSpec__GetConflict(), S.Na__LeSpec__GetState().inStepWithFile ], [ 'in-step', null, true ]);


console.log('\n  The file moves while Sync is writing R2');
await tick(SETUP.autoSaveLocalMs + 60);
S.Na__LeSpec__UpdateNote('SpecNote_003', { body : 'Sent to the cloud.' }, false);
await tick(SETUP.autoSaveLocalMs + 60);
world.onR2Write = async () => { agentWrite((doc) => { doc.ProjectSpecification__Revision = 'B'; }); };
const synced = await S.Na__LeSpec__Sync({ showToast : () => {} });
check('R2 is written', [ synced, r2Body('SpecNote_003') ], [ true, 'Sent to the cloud.' ]);
check('...but the file the agent wrote meanwhile is not written over', world.disk.get(FILE).ProjectSpecification__Revision, 'B');
asked = S.Na__LeSpec__GetConflict();
check('...it is asked about instead, naming the revision', [ asked && asked.kind, asked && asked.summary.revision ], [ 'file', { app : 'A', file : 'B' } ]);
await S.Na__LeSpec__ResolveConflict('file');
check('"Load the file": revision B, and unsynced (R2 still has A)', [ S.Na__LeSpec__GetRevision(), S.Na__LeSpec__IsDirty() ], [ 'B', true ]);
await S.Na__LeSpec__Sync({ showToast : () => {} });


console.log('\n  The next session: a draft this browser kept, and a file an agent changed since');
SETUP.autoSaveLocalMs = 1e6;                                                    // <-- The tab is closed before its autosave runs
S.Na__LeSpec__UpdateNote('SpecNote_003', { body : 'Typed, then the tab was closed.' }, false);
S.Na__LeSpec__FlushDraft();                                                     // <-- The draft is written; the autosave never got to run
agentWrite((doc) => { doc.ProjectSpecification__Groups[0].Group__Title = 'External Walls and Quoins'; });
const diskBeforeLoad = JSON.stringify(world.disk.get(FILE));
announced.length = 0;
world.toasts.length = 0;
S = await loadSession();
S.Na__LeSpec__Initialize({ editable : true, showToast : toast });
await S.Na__LeSpec__EnsureLoaded();
asked = S.Na__LeSpec__GetConflict();
check('the draft is ASKED about, not put back', [ asked && asked.kind, asked && asked.appFrom ], [ 'open', 'draft' ]);
check('...no "restored" toast', world.toasts.length, 0);
check('...the app shows the file meanwhile, and the file is untouched', [ S.Na__LeSpec__GetGroups()[0].Group__Title, JSON.stringify(world.disk.get(FILE)) === diskBeforeLoad ], [ 'External Walls and Quoins', true ]);
check('...the question is announced after the load', announced.map((d) => d.reason).slice(-2), [ 'loaded', 'conflict' ]);
check('"Keep the app\'s copy": the draft goes in and reaches the file', [ await S.Na__LeSpec__ResolveConflict('app'), diskBody('SpecNote_003') ], [ true, 'Typed, then the tab was closed.' ]);
check('...the agent\'s file is kept in this browser', discarded() && discarded().Doc.ProjectSpecification__Groups[0].Group__Title, 'External Walls and Quoins');

S.Na__LeSpec__UpdateNote('SpecNote_002', { body : 'A second draft.' }, false);
S.Na__LeSpec__FlushDraft();
S = await loadSession();
S.Na__LeSpec__Initialize({ editable : true, showToast : toast });
await S.Na__LeSpec__EnsureLoaded();
check('asked again for another draft; "Load the file" keeps the file', [ S.Na__LeSpec__GetConflict() && S.Na__LeSpec__GetConflict().kind, await S.Na__LeSpec__ResolveConflict('file'), S.Na__LeSpec__GetNoteEntry('SpecNote_002').note.Note__Body ], [ 'open', true, TYPED ]);
check('...and the draft it did not take is kept in this browser', discarded() && bodyOf(discarded().Doc, 'SpecNote_002'), 'A second draft.');
SETUP.autoSaveLocalMs = 40;


console.log('\n  Reload Local');
await S.Na__LeSpec__Sync({ showToast : () => {} });
agentWrite((doc) => { doc.ProjectSpecification__Groups[0].Group__Notes[1].Note__Body = 'Reloaded by hand.'; });
world.confirms = 0;
check('reloads with no question when nothing in the app would be lost', [ await S.Na__LeSpec__ReloadFromLocal(), world.confirms ], [ true, 0 ]);
state = S.Na__LeSpec__GetState();
check('...and the agent\'s edit reads UNSYNCED, so Sync is on (it used to read as synced)', [ state.dirty, state.canSync, S.Na__LeSpec__GetNoteEntry('SpecNote_003').note.Note__Body ], [ true, true, 'Reloaded by hand.' ]);


console.log('\n  A note written by hand with no id');
agentWrite((doc) => { doc.ProjectSpecification__Groups[0].Group__Notes.push({ Note__Title : 'Hand Written', Note__Body : 'No id was given.' }); });
check('asked once', await S.Na__LeSpec__CheckFile(), 'file-ahead');
await S.Na__LeSpec__ResolveConflict('file');
await tick(SETUP.autoSaveLocalMs + 60);
const handNote = notesOf(world.disk.get(FILE)).find((n) => n.Note__Title === 'Hand Written');
check('the autosave gives the file its id', !!(handNote && handNote.Note__Id), true);
check('...and the watch does not ask again, look after look', [ await S.Na__LeSpec__CheckFile(), await S.Na__LeSpec__CheckFile(), S.Na__LeSpec__GetConflict() ], [ 'in-step', 'in-step', null ]);


console.log('\n  Off localhost');
world.localhost = false;
check('no lockstep and no local file: WriteLocalCopy is skipped, as before', [ S.Na__LeSpec__GetState().lockstep, await S.Na__LeSpec__WriteLocalCopy() ], [ false, { ok : false, skipped : true, verified : false, error : null } ]);
world.localhost = true;

console.log('\n  ' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED') + '\n');
process.exit(failures === 0 ? 0 : 1);
