// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT SHARING - THE SHARE LINK MANIFEST
// =============================================================================
//
// FILE       : Na__LayoutEditor__Share__Manifest__.js
// NAMESPACE  : Na__LeShareMf
// MODULE     : Layout Editor - Document Sharing - Share Link Manifest
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Record every shareable document's link when a project is published, and read that record back wherever a link is handed out or answered
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY A RECORD AND NOT JUST THE RULES. Adam, 29-Sep-2026: "saving them in a
//   dynamic manifest is probably the best thing, so in the future, it doesn't
//   fuck it up if I change the logic or any of the placement for new jobs, or
//   how I put things in folders." So the address each document is shared as is
//   WRITTEN DOWN at the moment of publishing, in
//       06__Layout__PublishedDocuments/PublishedDocuments__ShareLinks__.json
//   beside the index, locally and on R2. A Share button reads the address from
//   there; the app reads what an address OPENS from there before it falls back
//   on its own rules. When the rules change, a project published under the old
//   ones goes on handing out - and answering - exactly the links it always did.
// - WHAT IS IN IT: one entry per document a person can be sent - every drawing
//   in register order, the Project Specification, the Document Register, and
//   every Design Statement - each with its key, its address, what it was called
//   when it was recorded, and the identity of what it opens (a drawing's sheet
//   id, document id and number; a statement's id, folder and file). Plus the
//   resolver the addresses were built against, and an Aliases block reserved
//   for the day a key has to be renamed: an old key listed there goes on
//   opening its document.
// - WHAT IS NOT IN IT, ON PURPOSE: whether each drawing is published. That
//   goes stale the moment a local-only publish runs, and this file also rides
//   to R2 with a statement publish; a record saying "published" for a drawing
//   R2 does not hold would be a lie told to a client. Publication is read from
//   the index at the moment it matters (DrawingState).
// - WHEN IT IS WRITTEN: by Publish Drawings, just before the index (to R2 when
//   "Also push to R2" is ticked, locally always); and whenever a statement is
//   published, locally and to R2, so a new statement's link is recorded the day
//   it goes out rather than at the next drawings publish. Never by a Share
//   button: handing a link out writes nothing.
// - READING NEVER THROWS and never fails loudly: with no record the Share
//   buttons build the same address from the rules, and the app resolves a key
//   from the project it has.
//
// INTEGRATION:
// - Na__LayoutEditor__Publish__ calls Record() with its own JSON formatter.
// - Na__LayoutEditor__Share__Button__ and Na__LayoutEditor__Share__Open__ call
//   Load() and Find().
// - Na__LayoutEditor__Share__Open__ calls Initialize(), which is what listens
//   for a statement being published.
// - Reads through 52's Urls (R2 first on the live site, the repository copy
//   first on localhost - the reader's own rule) and writes through 65's
//   transport (the same local route and R2 client as every published file).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : candidate (ValeVision has no publishing system yet).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.166.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Published Schema, the Reader's Urls and the Publisher's Transport
    // ------------------------------------------------------------
    import {
        Na__PubSchema__Ready, Na__PubSchema__Get, Na__PubSchema__ShareLinksPath, Na__PubSchema__IndexPath, Na__PubSchema__States
    } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';
    import { Na__PubVer__Stamp } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Version__.js';
    import {
        Na__PubDoc__Urls__Ready, Na__PubDoc__Urls__Project, Na__PubDoc__Urls__FromPage, Na__PubDoc__Urls__Fetch
    } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Urls__.js';
    import {
        Na__LePubNet__WriteLocal, Na__LePubNet__ReadLocal, Na__LePubNet__R2Ready, Na__LePubNet__PushR2
    } from '../65__Feature__DocumentPublishing/Na__LayoutEditor__Publish__Transport__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Documents: Sheets, Statements, the Project Code
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetSheets, Na__LeModel__GetTabLabel, Na__LeModel__GetDocumentId, Na__LeModel__GetShortCode
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeStmt__CHANGED_EVENT, Na__LeStmt__EnsureLoaded, Na__LeStmt__List
    } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__GetProjectFolderFromUrl, Na__AppUtils__GetYearFromUrl } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Link Builder
    // ------------------------------------------------------------
    import {
        Na__LeShareLink__KIND_DRAWING, Na__LeShareLink__KIND_SPEC, Na__LeShareLink__KIND_REGISTER, Na__LeShareLink__KIND_STATEMENT,
        Na__LeShareLink__Ready, Na__LeShareLink__GetSetup, Na__LeShareLink__Label, Na__LeShareLink__KeyFor,
        Na__LeShareLink__SameKey, Na__LeShareLink__CurrentProject, Na__LeShareLink__BuildUrl
    } from './Na__LayoutEditor__Share__Links__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Record's Own Version and the App That Wrote It
    // ------------------------------------------------------------
    const Na__LeShareMf__VERSION     = 1;                                        // <-- The shape of this file; a reader skips keys it does not know
    const Na__LeShareMf__APP_VERSION = 'v2.166.0';                               // <-- Stamped when the caller does not hand in its own (a statement publish)
    const Na__LeShareMf__SCHEMA_REF  = 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Record for the Project on Screen
    // ------------------------------------------------------------
    let Na__LeShareMf__Cache     = null;                                         // <-- { Folder, Result : { Ok, Manifest, Reason, Url } }
    let Na__LeShareMf__Loading   = null;
    let Na__LeShareMf__Listening = false;
    let Na__LeShareMf__Queue     = Promise.resolve();                            // <-- Writes one after another, never two at once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Which Project the Reader's Urls Point At (set from the page if nothing has)
    // ------------------------------------------------------------
    // The viewer sets it before it loads the index; the editor on localhost
    // may never have. A folder already set is left alone, so a harness that
    // pointed the reader somewhere keeps its choice.
    // ------------------------------------------------------------
    function Na__LeShareMf__Folder() {
        return Na__PubDoc__Urls__Project() || Na__PubDoc__Urls__FromPage();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Something This Module Can Read
    // ------------------------------------------------------------
    function Na__LeShareMf__Readable(value) {
        if (!value || typeof value !== 'object') return 'it is not a JSON object';
        if (!Array.isArray(value['ShareLinks__Documents'])) return 'it has no ShareLinks__Documents list';
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Project's Share Link Record (once per project; never throws)
    // ------------------------------------------------------------
    // Resolves { Ok, Manifest, Reason, Url }. Ok false with a reason is the
    // ordinary answer for a project published before v2.166.0 or never
    // published at all, and every caller carries on without it.
    // ------------------------------------------------------------
    function Na__LeShareMf__Load(force) {
        const folder = Na__LeShareMf__Folder();
        if (!force && Na__LeShareMf__Cache && Na__LeShareMf__Cache.Folder === folder) return Promise.resolve(Na__LeShareMf__Cache.Result);
        if (!force && Na__LeShareMf__Loading) return Na__LeShareMf__Loading;
        Na__LeShareMf__Loading = (async () => {
            let result;
            try {
                await Na__PubSchema__Ready();
                await Na__PubDoc__Urls__Ready();
                if (!Na__LeShareMf__Folder()) {
                    result = { Ok : false, Manifest : null, Reason : 'the page has no project in its address' };
                } else {
                    const got = await Na__PubDoc__Urls__Fetch(Na__PubSchema__ShareLinksPath(), 'json', false);
                    const why = got.Ok ? Na__LeShareMf__Readable(got.Value) : null;
                    if (!got.Ok)  result = { Ok : false, Manifest : null, Reason : 'no share link record yet (' + got.Reason + ')' };
                    else if (why) result = { Ok : false, Manifest : null, Reason : 'the share link record was not read: ' + why };
                    else          result = { Ok : true,  Manifest : got.Value, Reason : null, Url : got.Url };
                }
            } catch (error) {
                result = { Ok : false, Manifest : null, Reason : 'the share link record could not be read (' + error.message + ')' };
            }
            Na__LeShareMf__Cache   = { Folder : Na__LeShareMf__Folder(), Result : result };
            Na__LeShareMf__Loading = null;
            return result;
        })();
        return Na__LeShareMf__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Record Held for the Project on Screen (null until loaded, or when there is none)
    // ------------------------------------------------------------
    function Na__LeShareMf__Current() {
        return (Na__LeShareMf__Cache && Na__LeShareMf__Cache.Result && Na__LeShareMf__Cache.Result.Ok) ? Na__LeShareMf__Cache.Result.Manifest : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Entry a Key Names in a Record (its aliases followed), or null
    // ------------------------------------------------------------
    // manifest defaults to the one held. Keys compare as links do: case and a
    // sheet id's leading zeros never matter.
    // ------------------------------------------------------------
    function Na__LeShareMf__Find(key, manifest) {
        const record = manifest || Na__LeShareMf__Current();
        if (!record || !key) return null;
        const documents = Array.isArray(record['ShareLinks__Documents']) ? record['ShareLinks__Documents'] : [];
        const match = (wanted) => documents.find((entry) => entry && Na__LeShareLink__SameKey(entry['Share__Key'], wanted)) || null;
        const direct = match(key);
        if (direct) return direct;
        const aliases = (record['ShareLinks__Aliases'] && typeof record['ShareLinks__Aliases'] === 'object') ? record['ShareLinks__Aliases'] : {};
        for (const from of Object.keys(aliases)) {
            if (from.indexOf('Aliases__') === 0) continue;                       // <-- The block's own note
            if (Na__LeShareLink__SameKey(from, key)) { const hit = match(aliases[from]); if (hit) return hit; }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Record Just Written in Front of Every Reader in This Tab
    // ------------------------------------------------------------
    function Na__LeShareMf__Remember(manifest) {
        const readable = !Na__LeShareMf__Readable(manifest);
        Na__LeShareMf__Cache = { Folder : Na__LeShareMf__Folder(), Result : readable ? { Ok : true, Manifest : manifest, Reason : null } : { Ok : false, Manifest : null, Reason : 'unreadable' } };
        return readable;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Drawing Published, as the Index Says Now ('published' | 'unpublished' | null)
    // ------------------------------------------------------------
    // Read from the index at the moment it is asked - R2's on the live site,
    // this disk's on localhost - because that is what a reader following the
    // link will see. null when the index cannot be read (never published).
    // ------------------------------------------------------------
    async function Na__LeShareMf__DrawingState(documentId) {
        try {
            await Na__PubSchema__Ready();
            await Na__PubDoc__Urls__Ready();
            if (!Na__LeShareMf__Folder()) return null;
            const got = await Na__PubDoc__Urls__Fetch(Na__PubSchema__IndexPath(), 'json', false);
            if (!got.Ok || !got.Value) return 'unpublished';
            const rows = Array.isArray(got.Value['PublishedDocuments__Documents']) ? got.Value['PublishedDocuments__Documents'] : [];
            const row  = rows.find((one) => one && one['Document__Id'] === documentId);
            return (row && row['Document__State'] === Na__PubSchema__States().published) ? 'published' : 'unpublished';
        } catch (error) {
            return null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Entry
    // ------------------------------------------------------------
    function Na__LeShareMf__Entry(setup, projectCode, target, label, identity, recordedIso) {
        const key = Na__LeShareLink__KeyFor(target);
        const url = key ? Na__LeShareLink__BuildUrl(setup.link, projectCode, key) : '';
        if (!key || !url) return null;
        return {
            'Share__Key'         : key,
            'Share__Kind'        : target.kind,
            'Share__Url'         : url,
            'Share__Label'       : String(label || key),
            'Share__Target'      : identity,
            'Share__RecordedIso' : recordedIso
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Record From the Documents the Project Has Now
    // ------------------------------------------------------------
    // options: { appVersion, reason, previous (the record being replaced) }
    // Resolves the record, or null when the page has no project to name.
    // Every sheet is listed, published or not: a key never depends on whether
    // its document has reached R2, and a link sent before the publish opens
    // the document the moment it has.
    // ------------------------------------------------------------
    async function Na__LeShareMf__Build(options) {
        const o = options || {};
        await Na__LeShareLink__Ready();
        await Na__PubSchema__Ready();
        const setup   = Na__LeShareLink__GetSetup();
        const project = Na__LeShareLink__CurrentProject();
        const code    = project.projectCode || String(Na__DrawData__GetProjectCode() || '').trim().toUpperCase();
        const folder  = Na__AppUtils__GetProjectFolderFromUrl();
        if (!code || !folder) return null;

        const stamp     = Na__PubVer__Stamp(o.appVersion || Na__LeShareMf__APP_VERSION);
        const recorded  = stamp['Publish__AtIso'];
        const documents = [];
        const add = (entry) => { if (entry) documents.push(entry); };

        // THE DRAWINGS, in register order
        Na__LeModel__GetSheets().forEach((sheet) => {
            add(Na__LeShareMf__Entry(setup, code, { kind : Na__LeShareLink__KIND_DRAWING, sheetId : sheet.Sheet__Id }, Na__LeModel__GetTabLabel(sheet), {
                'Target__SheetId'    : sheet.Sheet__Id,
                'Target__DocumentId' : Na__LeModel__GetDocumentId(sheet) || null,
                'Target__Number'     : Na__LeModel__GetShortCode(sheet) || null
            }, recorded));
        });

        // THE TWO DOCUMENTS EVERY PROJECT HAS
        add(Na__LeShareMf__Entry(setup, code, { kind : Na__LeShareLink__KIND_SPEC }, Na__LeShareLink__Label('Specification', 'Project Specification'), {}, recorded));
        add(Na__LeShareMf__Entry(setup, code, { kind : Na__LeShareLink__KIND_REGISTER }, Na__LeShareLink__Label('Register', 'Document Register'), {}, recorded));

        // THE STATEMENTS - read from their own index; a project without the
        // statements folder simply has none, and is not held up by it.
        let statements = [];
        try { await Na__LeStmt__EnsureLoaded(); statements = Na__LeStmt__List(); } catch (error) { statements = []; }
        statements.forEach((record) => {
            add(Na__LeShareMf__Entry(setup, code, { kind : Na__LeShareLink__KIND_STATEMENT, statementId : record.Doc__Id }, record.Doc__Title, {
                'Target__StatementId' : record.Doc__Id,
                'Target__Folder'      : record.Doc__Folder || null,
                'Target__File'        : record.Doc__File || null
            }, recorded));
        });

        // THE ALIASES ARE CARRIED FORWARD, never rebuilt: they are the promise
        // made to links sent under a key that has since been renamed.
        const previous = (o.previous && typeof o.previous === 'object') ? o.previous : null;
        const carried  = (previous && previous['ShareLinks__Aliases'] && typeof previous['ShareLinks__Aliases'] === 'object') ? previous['ShareLinks__Aliases'] : {};
        const aliases  = {
            'Aliases__Note' : 'Reserved. An old key listed here as "old key" : "current key" goes on opening the current key\'s document. Carried from record to record, never rebuilt; nothing writes one yet.'
        };
        Object.keys(carried).forEach((from) => {
            if (from.indexOf('Aliases__') === 0) return;                         // <-- The block's own words are this version's, never the old record's
            if (typeof carried[from] === 'string' && carried[from] !== '') aliases[from] = carried[from];
        });

        return {
            'ShareLinks__Meta' : {
                'Meta__FileName'  : Na__PubSchema__Get().files.shareLinks,
                'Meta__Version'   : Na__LeShareMf__VERSION,
                'Meta__Note'      : 'Every document of this project a person can be sent, and the link its Share button hands out - recorded when the project was published, so a link already sent keeps working when the app\'s rules, the folders or the numbering change. The Share buttons read Share__Url from here; the app reads Share__Target to know what a link opens, and falls back on its own rules only for a key not listed. Whether a drawing is published is NOT recorded: the index says that. Written by 51__System__LayoutEditor/66__Feature__DocumentSharing.',
                'Meta__SchemaRef' : Na__LeShareMf__SCHEMA_REF
            },
            'ShareLinks__Project' : {
                'Project__Code'   : code,
                'Project__Folder' : Na__AppUtils__GetYearFromUrl() + '-Projects/' + folder
            },
            'ShareLinks__Publish' : Object.assign(stamp, {
                'Publish__Reason'        : o.reason || 'drawings',
                'Publish__DocumentCount' : documents.length
            }),
            'ShareLinks__Resolver' : {
                'Resolver__BaseUrl'      : setup.link.baseUrl,
                'Resolver__QueryPattern' : setup.link.queryPattern,
                'Resolver__OpenParam'    : setup.link.openParam,
                'Resolver__Note'         : 'What the addresses above were built against. s/index.html at the website root looks the project code up in q/index.json and opens the project with the key handed through; that page must never move, and must go on answering every form listed in a record like this one.'
            },
            'ShareLinks__Documents' : documents,
            'ShareLinks__Aliases'   : aliases
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing the Record
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Publisher's Own JSON Layout (colons aligned), Without Importing the Publisher
    // ------------------------------------------------------------
    // The publisher imports this module, so importing it back would make a
    // cycle. Asked for only when a caller has not handed its formatter in -
    // a statement publish - by which time the editor has long since loaded it.
    // ------------------------------------------------------------
    async function Na__LeShareMf__Formatter() {
        try {
            const publisher = await import('../65__Feature__DocumentPublishing/Na__LayoutEditor__Publish__.js');
            if (typeof publisher.Na__LePub__Json === 'function') return publisher.Na__LePub__Json;
        } catch (error) { /* the plain layout below is still valid JSON */ }
        return (value) => JSON.stringify(value, null, 4) + '\n';
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Record: This Disk First, Then R2 When Asked
    // ------------------------------------------------------------
    // options: { toR2, json }. Resolves { Ok, Local, R2, Bytes, Reason }.
    // The local copy is the authority, as for every published file: nothing
    // reaches R2 that is not on this disk first.
    // ------------------------------------------------------------
    async function Na__LeShareMf__Write(manifest, options) {
        const o    = options || {};
        const json = (typeof o.json === 'function') ? o.json : await Na__LeShareMf__Formatter();
        const blob = new Blob([ json(manifest) ], { type : 'application/json' });
        const path = Na__PubSchema__Get().files.shareLinks;                      // <-- Relative to the published root, as the transport takes every path

        const local = await Na__LePubNet__WriteLocal(path, blob);
        if (!local.Ok) return { Ok : false, Local : false, R2 : false, Bytes : blob.size, Reason : 'the share link record was not written (' + local.Reason + ')' };
        Na__LeShareMf__Remember(manifest);

        if (!o.toR2) return { Ok : true, Local : true, R2 : false, Bytes : blob.size, Reason : null };
        const ready = Na__LePubNet__R2Ready();
        const r2    = ready.Ok ? await Na__LePubNet__PushR2(path, blob) : ready;
        return r2.Ok
            ? { Ok : true,  Local : true, R2 : true,  Bytes : blob.size, Reason : null }
            : { Ok : false, Local : true, R2 : false, Bytes : blob.size, Reason : 'the share link record was not pushed to R2 (' + r2.Reason + ')' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Record the Project's Share Links Now
    // ------------------------------------------------------------
    // options: { toR2, json, appVersion, reason }. Resolves
    // { Ok, Count, Local, R2, Bytes, Reason, Manifest }. One record at a time:
    // a statement published while the drawings are publishing waits its turn.
    // ------------------------------------------------------------
    function Na__LeShareMf__Record(options) {
        const run = async () => {
            const o = options || {};
            const previous = await Na__LePubNet__ReadLocal(Na__PubSchema__Get().files.shareLinks);   // <-- Its aliases are carried forward
            const manifest = await Na__LeShareMf__Build({ appVersion : o.appVersion, reason : o.reason, previous : previous });
            if (!manifest) return { Ok : false, Count : 0, Local : false, R2 : false, Reason : 'the page has no project in its address, so there is nothing to record' };
            const written = await Na__LeShareMf__Write(manifest, { toR2 : o.toR2 === true, json : o.json });
            return Object.assign({ Count : manifest['ShareLinks__Documents'].length, Manifest : manifest }, written);
        };
        const next = Na__LeShareMf__Queue.then(run, run);
        Na__LeShareMf__Queue = next.catch(() => null);
        return next.catch((error) => ({ Ok : false, Count : 0, Local : false, R2 : false, Reason : 'the share link record failed (' + error.message + ')' }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Listening for a Statement Being Published (authoring only; once)
    // ------------------------------------------------------------
    // A statement published today should have its link on record today, not at
    // the next drawings publish. Its publish has just sent it to R2, so the
    // record goes there too.
    // ------------------------------------------------------------
    function Na__LeShareMf__Initialize(options) {
        const editable = !!(options && options.editable);
        if (!editable || Na__LeShareMf__Listening) return false;
        Na__LeShareMf__Listening = true;
        window.addEventListener(Na__LeStmt__CHANGED_EVENT, (event) => {
            if (!event || !event.detail || event.detail.reason !== 'published') return;
            void Na__LeShareMf__Record({ toR2 : true, reason : 'statement' }).then((result) => {
                if (result.Ok) console.log('[TrueVision3D Share] Share links recorded after a statement publish (' + result.Count + ' documents, locally and on R2).');
                else console.warn('[TrueVision3D Share] ' + result.Reason + '. The Share buttons build the same links meanwhile.');
            });
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Document Sharing Manifest API
    // ------------------------------------------------------------
    export {
        Na__LeShareMf__Load,
        Na__LeShareMf__Current,
        Na__LeShareMf__Find,
        Na__LeShareMf__Remember,
        Na__LeShareMf__DrawingState,
        Na__LeShareMf__Build,
        Na__LeShareMf__Write,
        Na__LeShareMf__Record,
        Na__LeShareMf__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
