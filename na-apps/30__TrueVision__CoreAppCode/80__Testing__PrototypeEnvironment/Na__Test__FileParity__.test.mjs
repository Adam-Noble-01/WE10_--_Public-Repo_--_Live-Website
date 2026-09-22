// =============================================================================
// TRUEVISION3D - TEST - LOCAL FILE PARITY (LOGIC AND REGISTRY)
// =============================================================================
//
// FILE       : Na__Test__FileParity__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Local File Parity Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that the parity guard tells a change on disk from this window's own write, a conflict from a harmless change, and a draft that may come back from one that must ask - and that it says so in plain words
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - The logic unit imports nothing and runs here exactly as the app runs it.
//   The registry imports the project URL helpers, so both are copied into a
//   temporary folder that mirrors the app's layout, with a package.json that
//   makes .js files ES modules; window, localStorage and CustomEvent are
//   stood in for before the registry is imported.
// - THE FIXTURE is RB05 as it stood when the guard was written: the drawing
//   notes went from 73 notes in 15 groups to 82 in 16 when an agent added the
//   Project Introduction Notes group - the edit Adam then nearly saved over.
// - WHAT MUST NEVER REGRESS:
//     1. A file this window never read is nobody's business here.
//     2. This window's own write is adopted, never announced as a change.
//     3. Model groups moved by a build sync are not a conflict for the
//        drawings save; drawings moved by an agent are.
//     4. A draft made against another version than the one on disk asks,
//        unless this browser wrote what is on disk.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__FileParity__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the Local File Parity guard.
//
// =============================================================================

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test, and a Browser Stood In For
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const MODULES    = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-file-parity-'));
    writeFileSync(join(SCRATCH, 'package.json'), '{ "type": "module" }\n');

    function copy(folder, file) {
        mkdirSync(join(SCRATCH, folder), { recursive : true });
        copyFileSync(join(MODULES, folder, file), join(SCRATCH, folder, file));
        return pathToFileURL(join(SCRATCH, folder, file)).href;
    }

    const storage = new Map();
    const events  = [];
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
    globalThis.window = {
        location     : { hostname : 'localhost', port : '8090', origin : 'http://localhost:8090', href : 'http://localhost:8090/na-apps/30__TrueVision__CoreAppCode/Index.html?project=RB05&project-folder=RB05__WestFarm&year=26', search : '?project=RB05&project-folder=RB05__WestFarm&year=26' },
        localStorage : { getItem : (k) => (storage.has(k) ? storage.get(k) : null), setItem : (k, v) => storage.set(k, String(v)), removeItem : (k) => storage.delete(k) },
        dispatchEvent : (event) => { events.push(event); return true; }
    };

    copy('03__AppUtils', 'Na__AppUtils__ProjectLoader.js');
    const logic    = await import(copy('63__System__LocalFileParity', 'Na__FileParity__Logic__.js'));
    const registry = await import(copy('63__System__LocalFileParity', 'Na__FileParity__Registry__.js'));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failed = 0;
    function check(label, condition, detail) {
        if (condition) { console.log(`  PASS  ${label}`); return; }
        failed++;
        console.log(`  FAIL  ${label}` + (detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''));
    }

    const V1 = 'aaaaaaaaaaaaaaaa';
    const V2 = 'bbbbbbbbbbbbbbbb';
    const V3 = 'cccccccccccccccc';
    const DRAWINGS_KEYS = ['LayoutEditor__DrawingsData', 'PresentationMode__SavedCameraScenes', 'CrossSection__SceneData'];

    try {
        console.log('\nKEYS THAT MOVED');
        check('unknown key maps answer null, not "nothing moved"', logic.Na__FileParity__DiffKeys(null, { a : '1' }) === null);
        check('a changed, an added and a removed key are all named, sorted', JSON.stringify(logic.Na__FileParity__DiffKeys({ a : '1', b : '2', c : '3' }, { a : '1', b : '9', d : '4' })) === '["b","c","d"]');

        console.log('\nFINDING CHANGES');
        const files = [
            { key : 'project-data', kind : 'data', name : 'TrueVision__ProjectData__.json', version : V2, exists : true, valid : true, mtimeMs : 1000,
              keys : { modelGroups : 'm2', LayoutEditor__DrawingsData : 'd1' }, baseKeys : { modelGroups : 'm1', LayoutEditor__DrawingsData : 'd1' },
              summary : { sheets : 14 }, baseSummary : { sheets : 14 }, lastAppWrite : null },
            { key : 'drawing-notes', kind : 'data', name : 'TrueVision__DrawingNotes__.json', version : V2, exists : true, valid : true, mtimeMs : 2000,
              summary : { groups : 16, notes : 82 }, baseSummary : { groups : 15, notes : 73 }, lastAppWrite : { version : V1, atMs : 10, clientId : 'tv_me' } },
            { key : 'statement-index', kind : 'data', name : 'TrueVision__StatementDocs__.json', version : V3, exists : true, valid : true, lastAppWrite : { version : V3, atMs : 10, clientId : 'tv_me' } },
            { key : 'statement:01__PreApp__Statement/RB05_T01_S01__WestFarm__PreApplicationStatement__.md', kind : 'statement', name : 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md',
              version : V2, exists : true, valid : true, size : 85254, baseSize : 84026, lastAppWrite : { version : V2, atMs : 10, clientId : 'tv_other' } },
            { key : 'statement:01__PreApp__Statement/Never__Opened__.md', kind : 'statement', name : 'Never__Opened__.md', version : V2, exists : true, valid : true }
        ];
        const baselines = {
            'project-data'    : { version : V1 },
            'drawing-notes'   : { version : V1 },
            'statement-index' : { version : V1 },
            'statement:01__preapp__statement/rb05_t01_s01__westfarm__preapplicationstatement__.md' : { version : V1 }
        };
        const changes = logic.Na__FileParity__FindChanges(files, baselines, 'tv_me');
        const byKey   = Object.fromEntries(changes.map((change) => [change.key, change]));
        check('a file this window never read is not a change here', !changes.some((change) => change.name === 'Never__Opened__.md'));
        check('this window\'s own write it had not heard about is adopted, not announced', byKey['statement-index'] && byKey['statement-index'].adopt === true);
        check('an agent\'s edit to the notes is a change, blamed outside TrueVision', byKey['drawing-notes'] && !byKey['drawing-notes'].adopt && byKey['drawing-notes'].byOtherWindow === false);
        const statementKey = 'statement:01__preapp__statement/rb05_t01_s01__westfarm__preapplicationstatement__.md';
        check('a statement is matched whatever the case of its name', !!byKey[statementKey]);
        check('another TrueVision window\'s save is named as such', byKey[statementKey] && byKey[statementKey].byOtherWindow === true);
        check('the project data names the keys that moved', JSON.stringify(byKey['project-data'].changedKeys) === '["modelGroups"]');

        console.log('\nCONFLICT OR NOT');
        check('model groups moved by a build sync do not stop the drawings save', logic.Na__FileParity__IsConflict(byKey['project-data'], DRAWINGS_KEYS) === false);
        check('drawings moved by an agent do', logic.Na__FileParity__IsConflict(Object.assign({}, byKey['project-data'], { changedKeys : ['LayoutEditor__DrawingsData'] }), DRAWINGS_KEYS) === true);
        check('keys that cannot be told are treated as a conflict', logic.Na__FileParity__IsConflict(Object.assign({}, byKey['project-data'], { changedKeys : null }), DRAWINGS_KEYS) === true);
        check('any change to the notes is a conflict: Sync writes the whole file', logic.Na__FileParity__IsConflict(byKey['drawing-notes'], null) === true);
        check('a file deleted on disk is a conflict', logic.Na__FileParity__IsConflict(Object.assign({}, byKey['project-data'], { exists : false }), DRAWINGS_KEYS) === true);
        check('a file caught mid-write is a conflict', logic.Na__FileParity__IsConflict(Object.assign({}, byKey['project-data'], { valid : false }), DRAWINGS_KEYS) === true);
        check('an adopted write is never a conflict', logic.Na__FileParity__IsConflict(byKey['statement-index'], null) === false);

        console.log('\nWORDS');
        const notesWhat = logic.Na__FileParity__WhatMoved(byKey['drawing-notes']).join(' | ');
        check('the notes say what moved, before and after', notesWhat === 'Notes 73 → 82 · groups 15 → 16', notesWhat);
        const dataWhat = logic.Na__FileParity__WhatMoved(byKey['project-data']).join(' | ');
        check('the project data names the part that moved in the app\'s words', dataWhat.includes('Changed: model groups.') && dataWhat.includes('14 sheets'), dataWhat);
        const statementWhat = logic.Na__FileParity__WhatMoved(byKey[statementKey]).join(' | ');
        check('a statement says how much its text grew', statementWhat === 'Text changed (+1.2 KB).', statementWhat);
        check('a deleted file says so', logic.Na__FileParity__WhatMoved({ exists : false })[0] === 'Deleted from disk.');
        check('a half-written file says to wait', logic.Na__FileParity__WhatMoved({ exists : true, valid : false, key : 'drawing-notes' })[0].startsWith('Not valid JSON right now'));
        check('a statement is titled by its file name', logic.Na__FileParity__FileTitle(statementKey, 'RB05_T01_S01.md') === 'Statement - RB05_T01_S01.md');
        check('the notes are titled as the specification', logic.Na__FileParity__FileTitle('drawing-notes') === 'Project specification (drawing notes)');
        const at = new Date(2026, 8, 22, 10, 4, 31).getTime();
        check('a time reads as a clock and how long ago', logic.Na__FileParity__When(at, at + 125000) === '10:04:31, 2 min ago', logic.Na__FileParity__When(at, at + 125000));
        const described = logic.Na__FileParity__Describe(byKey['drawing-notes'], { dirty : true });
        check('a row carries its title, who, conflict and dirty flags', described.title.startsWith('Project specification') && described.who.startsWith('outside TrueVision') && described.conflict && described.dirty);

        console.log('\nWHICH FILE A URL READS');
        const base = 'http://localhost:8090/na-project-portal/26-Projects';
        check('the project data of this project', registry.Na__FileParity__KeyForUrl(`${base}/RB05__WestFarm/30__TrueVision__AppContent/TrueVision__ProjectData__.json`) === 'project-data');
        check('another project\'s file is not this window\'s business', registry.Na__FileParity__KeyForUrl(`${base}/PS01__MustersRoad/30__TrueVision__AppContent/TrueVision__ProjectData__.json`) === null);
        check('a statement with spaces in its path, lower-cased', registry.Na__FileParity__KeyForUrl(`${base}/RB05__WestFarm/30__TrueVision__AppContent/10__StatementDocs/01__PreApp%20Statement/My%20Doc.md`) === 'statement:01__preapp statement/my doc.md');
        check('the sibling-file route for the notes', registry.Na__FileParity__KeyForUrl('/api/projects/RB05/files/TrueVision__DrawingNotes__.json?project-folder=RB05__WestFarm&year=26') === 'drawing-notes');
        check('a picture is not watched', registry.Na__FileParity__KeyForUrl(`${base}/RB05__WestFarm/30__TrueVision__AppContent/05__Layout__DrawingDocs__Images/a.png`) === null);
        check('another origin is not watched', registry.Na__FileParity__KeyForUrl('https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/RB05__WestFarm/30__TrueVision__AppContent/TrueVision__ProjectData__.json') === null);

        console.log('\nHEADERS ON A LOCAL WRITE');
        const before = registry.Na__FileParity__WriteHeaders('drawing-notes');
        check('before the file is read: the window\'s id and no base', before['X-Na-Client-Id'] === registry.Na__FileParity__ClientId && !('X-Na-Base-Version' in before));
        registry.Na__FileParity__NoteRead('drawing-notes', V1, 1000);
        check('after the read: the version it was read at', registry.Na__FileParity__WriteHeaders('drawing-notes')['X-Na-Base-Version'] === V1);
        check('a read is announced for the watcher', events.some((event) => event.type === registry.Na__FileParity__EVENT && event.detail.reason === 'read' && event.detail.key === 'drawing-notes'));
        const fakeResponse = { headers : { get : (name) => ({ 'X-Na-File-Version' : V2, 'X-Na-File-Mtime-Ms' : '2000' })[name] || null } };
        check('a successful write\'s version becomes the base', registry.Na__FileParity__AdoptWriteResponse('drawing-notes', fakeResponse) === V2 && registry.Na__FileParity__BaseVersion('drawing-notes') === V2);
        check('and is remembered as this browser\'s own', registry.Na__FileParity__IsOwnVersion('drawing-notes', V2) && !registry.Na__FileParity__IsOwnVersion('drawing-notes', V1));

        console.log('\nMAY A BROWSER DRAFT SIMPLY COME BACK');
        check('with no baseline (web build, older server): as before', registry.Na__FileParity__DraftVerdict('project-data', { fileVersion : V1 }) === 'restore');
        registry.Na__FileParity__NoteRead('project-data', V3, 5000);
        check('made against the version on disk: yes', registry.Na__FileParity__DraftVerdict('project-data', { fileVersion : V3 }) === 'restore');
        check('made against another version someone else wrote since: ask', registry.Na__FileParity__DraftVerdict('project-data', { fileVersion : V1 }) === 'ask');
        registry.Na__FileParity__NoteOwnWrite('project-data', V3, 5000);
        check('made before a save this browser made: yes', registry.Na__FileParity__DraftVerdict('project-data', { fileVersion : V1 }) === 'restore');
        registry.Na__FileParity__NoteRead('drawing-notes', V3, 90000);
        check('an old draft (no version) older than the file: ask', registry.Na__FileParity__DraftVerdict('drawing-notes', { savedAt : 10000 }) === 'ask');
        check('an old draft newer than the file: yes', registry.Na__FileParity__DraftVerdict('drawing-notes', { savedAt : 95000 }) === 'restore');

        console.log('\nTHE WATCHER\'S DECISIONS, INSTALLED OR NOT');
        check('with no watcher a save goes ahead', await registry.Na__FileParity__ConfirmSave('drawing-notes', {}) === true);
        check('with no watcher a draft comes back', await registry.Na__FileParity__AskDraft('drawing-notes', {}) === 'restore');
        registry.Na__FileParity__InstallImpl({ confirmSave : async () => false, askDraft : async () => 'discard' });
        check('a watcher that says no stops the save', await registry.Na__FileParity__ConfirmSave('drawing-notes', {}) === false);
        check('a watcher that says discard is obeyed', await registry.Na__FileParity__AskDraft('drawing-notes', {}) === 'discard');
        registry.Na__FileParity__InstallImpl({ confirmSave : async () => { throw new Error('boom'); } });
        check('a watcher that fails lets the save go', await registry.Na__FileParity__ConfirmSave('drawing-notes', {}) === true);

        console.log('\nFORGETTING WHAT THIS WINDOW MOVED');
        registry.Na__FileParity__NoteRead('statement:01__PreApp__Statement/A.md', V1, 1);
        registry.Na__FileParity__NoteRead('statement:01__PreApp__Statement/B.md', V1, 1);
        registry.Na__FileParity__NoteRead('statement:02__Other/C.md', V1, 1);
        check('a folder forgets everything under it', registry.Na__FileParity__Forget(registry.Na__FileParity__StatementKey('01__PreApp__Statement') + '/') === 2);
        check('and nothing else', registry.Na__FileParity__BaseVersion('statement:02__other/c.md') === V1);
    } finally {
        rmSync(SCRATCH, { recursive : true, force : true });
    }

    console.log('');
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
