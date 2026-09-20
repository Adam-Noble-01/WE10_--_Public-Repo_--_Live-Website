// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT DATA
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Data__.js
// NAMESPACE  : Na__LeStmt
// MODULE     : Layout Editor - Statement Writer - Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the project's statements: which there are, which is open, what it says, and where each copy of it lives
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE DOCUMENT IS A FILE, NOT A RECORD. Every other document this app owns -
//   the drawing notes, the register - is JSON it invented. A statement is a
//   markdown file, because Adam writes them in Typora as often as in here, and
//   a format only this app can open would take that away. So this module holds
//   a string, and the index beside it only remembers which file that string
//   came out of.
// - THREE COPIES, AND WHICH ONE WINS. The file in the project folder is the
//   working copy and is written whenever the typing pauses. R2 is the record
//   and is written by Publish. A browser draft catches whatever was typed
//   between the two. On load the newest of them is put in front of you and
//   said so - nothing is silently preferred.
// - AN UNPUBLISHED EDIT IS NOT A LOST EDIT. The status says, in words, whether
//   what is on screen has reached the disk and whether it has reached the
//   cloud, because those are different questions and a writer is entitled to
//   know the answer to both.
// - WHAT THIS MODULE WILL NOT DO. It does not render, it does not parse and it
//   does not publish. It hands the markdown out and takes it back; the editor
//   owns what happens in between and the publisher owns what happens after.
//
// INTEGRATION:
// - Initialised by the mode controller with the editable flag and the toast,
//   and loaded on the first entry into the Statements tab.
// - Read by the page, the manager, the editor, the reader and the publisher.
//   Import this file, never its transport unit: this export list is the API.
// - CHANGED_EVENT carries { reason } and is raised for every change worth
//   redrawing for: 'loaded', 'opened', 'typed', 'saved', 'published',
//   'created', 'renamed', 'deleted', 'status'.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code, the Index Shape and the Transport
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetProjectCode } from '../../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__GetProjectFolderFromUrl } from '../../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import {
        Na__LeStmtIdx__K_PROJECT,
        Na__LeStmtIdx__K_UPDATED,
        Na__LeStmtIdx__K_LAST_ID,
        Na__LeStmtIdx__K_DOCUMENTS,
        Na__LeStmtIdx__Skeleton,
        Na__LeStmtIdx__Normalise,
        Na__LeStmtIdx__ContentJson,
        Na__LeStmtIdx__NameFor,
        Na__LeStmtIdx__Unknown,
        Na__LeStmtIdx__FolderNames,
        Na__LeStmtIdx__FileNames
    } from './Na__LayoutEditor__Statement__Data__Index__.js';
    import {
        Na__LeStmtIo__PathOf,
        Na__LeStmtIo__ReadIndex,
        Na__LeStmtIo__ReadIndexCloud,
        Na__LeStmtIo__WriteIndexLocal,
        Na__LeStmtIo__WriteIndexCloud,
        Na__LeStmtIo__ReadStatement,
        Na__LeStmtIo__WriteStatementLocal,
        Na__LeStmtIo__ImageBase,
        Na__LeStmtIo__Tree,
        Na__LeStmtIo__MakeFolders,
        Na__LeStmtIo__Move,
        Na__LeStmtIo__DeleteFolder
    } from './Na__LayoutEditor__Statement__Data__Transport__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Event and the Statuses
    // ------------------------------------------------------------
    const Na__LeStmt__CHANGED_EVENT = 'na-le-statement-changed';
    const Na__LeStmt__OPEN_EVENT    = 'na-le-statement-open';                   // <-- A request the mode controller answers: show the tab

    const Na__LeStmt__STATUS_IDLE    = 'idle';
    const Na__LeStmt__STATUS_LOADING = 'loading';
    const Na__LeStmt__STATUS_READY   = 'ready';
    const Na__LeStmt__STATUS_NEW     = 'new';
    const Na__LeStmt__STATUS_FAILED  = 'failed';

    const Na__LeStmt__DRAFT_PREFIX   = 'Na__TrueVision__StatementDraft__';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Brand New Statement Opens With
    // ------------------------------------------------------------
    // The company mark, the title and the standard front sheet fields, so a
    // new statement starts as a Noble Architecture document rather than as an
    // empty page somebody has to remember the house style for.
    // ------------------------------------------------------------
    const Na__LeStmt__STARTER = [
        '<img src="https://www.noble-architecture.com/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png" style="width:75mm; margin-left: -3mm; " />',
        '',
        '## {title}',
        '',
        '',
        '',
        '##### Applicant:',
        '',
        '{client}',
        '',
        '',
        '#### Site Address:',
        '',
        '{address}',
        '',
        '#### Local Planning Authority:',
        '',
        '',
        '##### Prepared By:',
        '',
        'Mr Adam Noble of Noble Architecture',
        '',
        '',
        '##### **Document Version**',
        '',
        'Revision A',
        '',
        '---',
        '',
        '### 1.0 |  Introduction',
        '',
        ''
    ].join('\n');
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Index, the Open Statement and How They Stand
    // ------------------------------------------------------------
    let Na__LeStmt__Doc         = Na__LeStmtIdx__Skeleton();
    let Na__LeStmt__Status      = Na__LeStmt__STATUS_IDLE;
    let Na__LeStmt__Source      = null;
    let Na__LeStmt__Error       = null;
    let Na__LeStmt__ProjectCode = null;
    let Na__LeStmt__LoadPromise = null;
    let Na__LeStmt__Tree        = [];                                           // <-- What is on disk, when a local server answered
    let Na__LeStmt__Unknown     = [];                                           // <-- Statements on disk the index has not heard of

    let Na__LeStmt__OpenId      = 0;
    let Na__LeStmt__SavedText   = '';                                           // <-- What is on disk, as far as this browser knows
    let Na__LeStmt__LiveText    = '';                                           // <-- What is on screen
    let Na__LeStmt__TextStatus  = Na__LeStmt__STATUS_IDLE;
    let Na__LeStmt__TextError   = null;

    let Na__LeStmt__Editable    = false;
    let Na__LeStmt__ShowToast   = null;
    let Na__LeStmt__SaveTimer   = 0;
    let Na__LeStmt__DraftTimer  = 0;
    let Na__LeStmt__Saving      = false;
    let Na__LeStmt__Initialised = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Raise the Change Event
    // ------------------------------------------------------------
    function Na__LeStmt__Dispatch(reason, detail) {
        window.dispatchEvent(new CustomEvent(Na__LeStmt__CHANGED_EVENT, {
            detail : Object.assign({ reason : reason }, detail || {})
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something to the Person, If Anyone Is Listening
    // ------------------------------------------------------------
    function Na__LeStmt__Toast(message, isError) {
        if (typeof Na__LeStmt__ShowToast === 'function') Na__LeStmt__ShowToast(message, isError);
        else if (isError) console.warn('[TrueVision3D] Statement Writer: ' + message);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Time, As Every Other Document Writes It
    // ------------------------------------------------------------
    function Na__LeStmt__Now() {
        return new Date().toISOString();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Record for an Id
    // ------------------------------------------------------------
    function Na__LeStmt__Record(id) {
        const want = Number(id);
        return (Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS] || []).find((record) => record.Doc__Id === want) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where This Browser Keeps the Draft of a Statement
    // ------------------------------------------------------------
    function Na__LeStmt__DraftKey(id) {
        return Na__LeStmt__DRAFT_PREFIX + (Na__AppUtils__GetProjectFolderFromUrl() || 'unknown') + '__' + id;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read, Write and Clear the Browser Draft
    // ------------------------------------------------------------
    // Storage can be blocked or full, and a statement is the writer's work, so
    // every access is guarded and a failure is reported once rather than
    // throwing into whatever was being typed.
    // ------------------------------------------------------------
    function Na__LeStmt__ReadDraft(id) {
        try {
            const raw = window.localStorage.getItem(Na__LeStmt__DraftKey(id));
            if (!raw) return null;
            const data = JSON.parse(raw);
            return (data && typeof data.Text === 'string') ? data : null;
        } catch (error) { return null; }
    }

    function Na__LeStmt__WriteDraft(id, text) {
        try {
            window.localStorage.setItem(Na__LeStmt__DraftKey(id), JSON.stringify({ Text : text, Iso : Na__LeStmt__Now() }));
        } catch (error) {
            console.warn('[TrueVision3D] Statement Writer: the browser draft could not be written:', (error && error.message) || error);
        }
    }

    function Na__LeStmt__ClearDraft(id) {
        try { window.localStorage.removeItem(Na__LeStmt__DraftKey(id)); } catch (error) { /* nothing to do */ }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Statement Index Once per Project
    // ------------------------------------------------------------
    // Never rejects: a failure leaves the status 'failed' and an empty index,
    // and the tab says so rather than offering to start a statement over the
    // top of one it could not read.
    // ------------------------------------------------------------
    function Na__LeStmt__EnsureLoaded() {
        const code = Na__DrawData__GetProjectCode();
        if (Na__LeStmt__LoadPromise && Na__LeStmt__ProjectCode === code) return Na__LeStmt__LoadPromise;

        Na__LeStmt__ProjectCode = code;
        Na__LeStmt__Status      = Na__LeStmt__STATUS_LOADING;
        Na__LeStmt__Dispatch('status');

        Na__LeStmt__LoadPromise = (async () => {
            const read = await Na__LeStmtIo__ReadIndex();
            if (Na__LeStmt__ProjectCode !== code) return Na__LeStmt__Doc;       // <-- Another project arrived meanwhile

            Na__LeStmt__Doc    = Na__LeStmtIdx__Normalise(read.data);
            Na__LeStmt__Status = (read.status === 'failed') ? Na__LeStmt__STATUS_FAILED
                               : (read.status === 'new')    ? Na__LeStmt__STATUS_NEW
                               : Na__LeStmt__STATUS_READY;
            Na__LeStmt__Source = read.source || null;
            Na__LeStmt__Error  = read.error || null;

            await Na__LeStmt__RefreshTree();

            if (read.seedLocal && Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS].length) {
                void Na__LeStmtIo__WriteIndexLocal(Na__LeStmt__Doc);            // <-- The cloud index reached this machine; put it on disk too
            }

            console.log('[TrueVision3D] Statement Writer: '
                + (Na__LeStmt__Status === Na__LeStmt__STATUS_FAILED
                    ? 'the index could not be read (' + (Na__LeStmt__Error || 'unknown') + ')'
                    : Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS].length + ' statement(s) from the ' + (Na__LeStmt__Source || 'index'))
                + (Na__LeStmt__Unknown.length ? ', ' + Na__LeStmt__Unknown.length + ' on disk not in the index' : ''));

            Na__LeStmt__Dispatch('loaded');
            return Na__LeStmt__Doc;
        })().catch((error) => {
            console.error('[TrueVision3D] Statement Writer: index load error:', error);
            Na__LeStmt__Doc    = Na__LeStmtIdx__Skeleton();
            Na__LeStmt__Status = Na__LeStmt__STATUS_FAILED;
            Na__LeStmt__Error  = (error && error.message) || 'error';
            Na__LeStmt__Dispatch('loaded');
            return Na__LeStmt__Doc;
        });

        return Na__LeStmt__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Folder Again and See What Is Actually There
    // ------------------------------------------------------------
    async function Na__LeStmt__RefreshTree() {
        const tree = await Na__LeStmtIo__Tree();
        Na__LeStmt__Tree    = (tree && tree.ok && Array.isArray(tree.entries)) ? tree.entries : [];
        Na__LeStmt__Unknown = Na__LeStmt__Tree.length ? Na__LeStmtIdx__Unknown(Na__LeStmt__Doc, Na__LeStmt__Tree) : [];
        return Na__LeStmt__Tree;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open One Statement and Read Its Markdown
    // ------------------------------------------------------------
    // Resolves to the markdown, or '' when it could not be read. A draft this
    // browser holds that differs from the file is put in front of you and
    // said so: it is your typing, and the file is not.
    // ------------------------------------------------------------
    async function Na__LeStmt__Open(id) {
        const record = Na__LeStmt__Record(id);
        if (!record) return '';

        Na__LeStmt__OpenId     = record.Doc__Id;
        Na__LeStmt__TextStatus = Na__LeStmt__STATUS_LOADING;
        Na__LeStmt__TextError  = null;
        Na__LeStmt__Dispatch('status');

        const read = await Na__LeStmtIo__ReadStatement(record);

        if (!read.ok) {
            Na__LeStmt__TextStatus = Na__LeStmt__STATUS_FAILED;
            Na__LeStmt__TextError  = read.error || 'could not be read';
            Na__LeStmt__SavedText  = '';
            Na__LeStmt__LiveText   = '';
            Na__LeStmt__Dispatch('opened', { failed : true });
            return '';
        }

        Na__LeStmt__SavedText  = (typeof read.text === 'string') ? read.text : '';
        Na__LeStmt__LiveText   = Na__LeStmt__SavedText;
        Na__LeStmt__TextStatus = read.missing ? Na__LeStmt__STATUS_NEW : Na__LeStmt__STATUS_READY;

        const draft = Na__LeStmt__ReadDraft(record.Doc__Id);
        if (draft && draft.Text !== Na__LeStmt__SavedText) {
            Na__LeStmt__LiveText = draft.Text;
            Na__LeStmt__Toast('Unsaved changes from this browser were put back. The file on disk is older.', false);
        }

        Na__LeStmt__Dispatch('opened');
        return Na__LeStmt__LiveText;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Typing and Saving
// -----------------------------------------------------------------------------

    // FUNCTION | The Editor Hands Back What Is On Screen
    // ------------------------------------------------------------
    // Called whenever the document changes. The draft is written a moment
    // after the typing pauses and the local file a little after that, so a
    // long statement is not rewritten on every keystroke.
    // ------------------------------------------------------------
    function Na__LeStmt__SetText(text) {
        if (typeof text !== 'string') return;
        if (text === Na__LeStmt__LiveText) return;
        Na__LeStmt__LiveText = text;

        const setup = Na__LeCfg__GetStatementSetup();
        const id    = Na__LeStmt__OpenId;

        if (setup.draftEnabled) {
            window.clearTimeout(Na__LeStmt__DraftTimer);
            Na__LeStmt__DraftTimer = window.setTimeout(() => Na__LeStmt__WriteDraft(id, Na__LeStmt__LiveText), setup.draftDebounceMs);
        }
        if (Na__LeStmt__Editable) {
            window.clearTimeout(Na__LeStmt__SaveTimer);
            Na__LeStmt__SaveTimer = window.setTimeout(() => { void Na__LeStmt__SaveLocal({ quiet : true }); }, setup.autoSaveLocalMs);
        }

        Na__LeStmt__Dispatch('typed');
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Open Statement to the File in the Project Folder
    // ------------------------------------------------------------
    // Resolves true when the file was written. The R2 copy is NOT touched -
    // that is Publish's job, and the difference between the two is the whole
    // point of having both.
    // ------------------------------------------------------------
    async function Na__LeStmt__SaveLocal(options) {
        const opts   = options || {};
        const record = Na__LeStmt__Record(Na__LeStmt__OpenId);
        if (!record || !Na__LeStmt__Editable || Na__LeStmt__Saving) return false;
        if (Na__LeStmt__LiveText === Na__LeStmt__SavedText) return true;

        Na__LeStmt__Saving = true;
        Na__LeStmt__Dispatch('status');
        try {
            const written = Na__LeStmt__LiveText;
            const result  = await Na__LeStmtIo__WriteStatementLocal(record, written);
            if (!result.ok) {
                if (!result.skipped && !opts.quiet) {
                    Na__LeStmt__Toast('The statement could not be written to disk: ' + (result.error || 'unknown') + '. Your changes are kept in this browser.', true);
                }
                return false;
            }

            Na__LeStmt__SavedText  = written;
            record.Doc__UpdatedIso = Na__LeStmt__Now();
            Na__LeStmt__ClearDraft(record.Doc__Id);
            void Na__LeStmt__SaveIndex({ cloud : false });
            if (!opts.quiet) Na__LeStmt__Toast('Statement saved.', false);
            Na__LeStmt__Dispatch('saved');
            return true;
        } finally {
            Na__LeStmt__Saving = false;
            Na__LeStmt__Dispatch('status');
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Index
    // ------------------------------------------------------------
    // options: { cloud } - the local copy always, R2 only when asked. Asks
    // before replacing a cloud index that changed since this browser read it.
    // ------------------------------------------------------------
    async function Na__LeStmt__SaveIndex(options) {
        const opts  = options || {};
        const setup = Na__LeCfg__GetStatementSetup();

        Na__LeStmt__Doc[Na__LeStmtIdx__K_PROJECT] = Na__LeStmt__ProjectCode || Na__DrawData__GetProjectCode() || null;
        Na__LeStmt__Doc[Na__LeStmtIdx__K_UPDATED] = Na__LeStmt__Now();

        const local = await Na__LeStmtIo__WriteIndexLocal(Na__LeStmt__Doc);
        if (!local.ok && !local.skipped) {
            console.warn('[TrueVision3D] Statement Writer: the local index was not written:', local.error);
        }
        if (!opts.cloud) return local.ok || local.skipped;

        if (setup.confirmOverwrite) {
            const read = await Na__LeStmtIo__ReadIndexCloud();
            if (read && read.ok && !read.missing && read.data) {
                const theirs = Na__LeStmtIdx__ContentJson(Na__LeStmtIdx__Normalise(read.data));
                const mine   = Na__LeStmtIdx__ContentJson(Na__LeStmt__Doc);
                if (theirs !== mine && read.data[Na__LeStmtIdx__K_UPDATED] && read.data[Na__LeStmtIdx__K_UPDATED] > (Na__LeStmt__Doc[Na__LeStmtIdx__K_UPDATED] || '')) {
                    const ok = await Na__AppUtils__ConfirmDialog__Show({
                        title         : 'Replace the cloud statement index?',
                        message       : 'The statement index in the cloud has changed since this browser read it. Publishing replaces it with the copy in this browser.',
                        confirmLabel  : 'Replace',
                        isDestructive : true
                    });
                    if (!ok) return false;
                }
            }
        }

        const cloud = await Na__LeStmtIo__WriteIndexCloud(Na__LeStmt__Doc);
        if (!cloud || !cloud.ok) {
            Na__LeStmt__Toast('The statement index could not be written to the cloud: ' + ((cloud && cloud.error) || 'unknown') + '.', true);
            return false;
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Creating, Renaming and Deleting
// -----------------------------------------------------------------------------

    // FUNCTION | What a New Statement Would Be Called
    // ------------------------------------------------------------
    // Shown under the title field as it is typed, so the naming is never a
    // surprise after the fact.
    // ------------------------------------------------------------
    function Na__LeStmt__NameFor(title) {
        return Na__LeStmtIdx__NameFor(Na__LeStmt__Doc, {
            title       : title,
            projectCode : Na__LeStmt__ProjectCode || Na__DrawData__GetProjectCode(),
            projectName : (Na__AppUtils__GetProjectFolderFromUrl() || '').replace(/^[A-Z]{2}\d{2}__/, ''),
            setup       : Na__LeCfg__GetStatementSetup(),
            folderNames : Na__LeStmtIdx__FolderNames(Na__LeStmt__Tree),
            fileNames   : Na__LeStmtIdx__FileNames(Na__LeStmt__Tree)
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Statement: Its Folders, Its File and Its Entry
    // ------------------------------------------------------------
    // Resolves to the new record, or null. The markdown file is written first:
    // an index entry pointing at a file that was never created is the one
    // failure that would leave the tab unable to open its own statement.
    // ------------------------------------------------------------
    async function Na__LeStmt__Create(title, seedText) {
        if (!Na__LeStmt__Editable) return null;
        const clean = String(title || '').trim();
        if (!clean) { Na__LeStmt__Toast('A statement needs a title.', true); return null; }

        const naming = Na__LeStmt__NameFor(clean);
        const record = {
            Doc__Id           : ++Na__LeStmt__Doc[Na__LeStmtIdx__K_LAST_ID],
            Doc__Title        : clean,
            Doc__Folder       : naming.folder,
            Doc__File         : naming.file,
            Doc__Number       : naming.number,
            Doc__Revision     : 'A',
            Doc__CreatedIso   : Na__LeStmt__Now(),
            Doc__UpdatedIso   : Na__LeStmt__Now(),
            Doc__PublishedIso : null,
            Doc__PublishedUrl : null,
            Doc__Images       : []
        };

        const folders = await Na__LeStmtIo__MakeFolders(record.Doc__Folder);
        if (!folders.ok && !folders.skipped) {
            Na__LeStmt__Doc[Na__LeStmtIdx__K_LAST_ID]--;                        // <-- Nothing was made, so nothing spent the id
            Na__LeStmt__Toast('The statement folder could not be created: ' + (folders.error || 'unknown'), true);
            return null;
        }

        const text  = (typeof seedText === 'string') ? seedText : Na__LeStmt__Starter(clean);
        const wrote = await Na__LeStmtIo__WriteStatementLocal(record, text);
        if (!wrote.ok && !wrote.skipped) {
            Na__LeStmt__Doc[Na__LeStmtIdx__K_LAST_ID]--;
            Na__LeStmt__Toast('The statement file could not be written: ' + (wrote.error || 'unknown'), true);
            return null;
        }

        Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS].push(record);
        await Na__LeStmt__SaveIndex({ cloud : false });
        await Na__LeStmt__RefreshTree();

        Na__LeStmt__SavedText = text;
        Na__LeStmt__LiveText  = text;
        Na__LeStmt__OpenId    = record.Doc__Id;
        Na__LeStmt__TextStatus = Na__LeStmt__STATUS_READY;

        Na__LeStmt__Dispatch('created', { id : record.Doc__Id });
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Markdown a New Statement Opens With
    // ------------------------------------------------------------
    function Na__LeStmt__Starter(title) {
        return Na__LeStmt__STARTER
            .replace('{title}', title || 'Statement')
            .replace('{client}', '')
            .replace('{address}', '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Rename a Statement
    // ------------------------------------------------------------
    // The title alone, by default: the folder and the file keep the names they
    // were created with, because renaming them breaks every link anyone has
    // already been given. Pass moveFiles to rename those too.
    // ------------------------------------------------------------
    async function Na__LeStmt__Rename(id, title, moveFiles) {
        const record = Na__LeStmt__Record(id);
        if (!record || !Na__LeStmt__Editable) return false;
        const clean = String(title || '').trim();
        if (!clean) return false;

        if (moveFiles) {
            const naming = Na__LeStmtIdx__NameFor(Na__LeStmt__Doc, {
                title       : clean,
                projectCode : Na__LeStmt__ProjectCode || Na__DrawData__GetProjectCode(),
                projectName : (Na__AppUtils__GetProjectFolderFromUrl() || '').replace(/^[A-Z]{2}\d{2}__/, ''),
                setup       : Na__LeCfg__GetStatementSetup(),
                folderNames : [],
                fileNames   : []
            });
            const wanted = record.Doc__Folder + '/' + naming.file;
            const moved  = await Na__LeStmtIo__Move(Na__LeStmtIo__PathOf(record), wanted);
            if (!moved.ok && !moved.skipped) {
                Na__LeStmt__Toast('The statement file could not be renamed: ' + (moved.error || 'unknown'), true);
                return false;
            }
            if (moved.ok) record.Doc__File = naming.file;
        }

        record.Doc__Title      = clean;
        record.Doc__UpdatedIso = Na__LeStmt__Now();
        await Na__LeStmt__SaveIndex({ cloud : false });
        Na__LeStmt__Dispatch('renamed', { id : record.Doc__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Statement
    // ------------------------------------------------------------
    // options: { files } - the entry always, the folder on disk only when
    // asked. The caller has already put the question to the person; this does
    // not ask again, and it does not touch R2: a statement already published
    // stays published until it is replaced.
    // ------------------------------------------------------------
    async function Na__LeStmt__Delete(id, options) {
        const record = Na__LeStmt__Record(id);
        if (!record || !Na__LeStmt__Editable) return false;

        if (options && options.files) {
            const removed = await Na__LeStmtIo__DeleteFolder(record.Doc__Folder);
            if (!removed.ok && !removed.skipped) {
                Na__LeStmt__Toast('The statement folder could not be deleted: ' + (removed.error || 'unknown'), true);
                return false;
            }
        }

        Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS] =
            Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS].filter((entry) => entry.Doc__Id !== record.Doc__Id);
        Na__LeStmt__ClearDraft(record.Doc__Id);
        if (Na__LeStmt__OpenId === record.Doc__Id) {
            Na__LeStmt__OpenId    = 0;
            Na__LeStmt__SavedText = '';
            Na__LeStmt__LiveText  = '';
        }

        await Na__LeStmt__SaveIndex({ cloud : false });
        await Na__LeStmt__RefreshTree();
        Na__LeStmt__Dispatch('deleted', { id : record.Doc__Id });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Statement Found on Disk Into the Index
    // ------------------------------------------------------------
    // candidate comes from Na__LeStmtIdx__Unknown: a folder holding a markdown
    // file that the index has never heard of.
    // ------------------------------------------------------------
    async function Na__LeStmt__Adopt(candidate) {
        if (!candidate || !Na__LeStmt__Editable) return null;
        const record = {
            Doc__Id           : ++Na__LeStmt__Doc[Na__LeStmtIdx__K_LAST_ID],
            Doc__Title        : candidate.Doc__Title || candidate.Doc__Folder,
            Doc__Folder       : candidate.Doc__Folder,
            Doc__File         : candidate.Doc__File,
            Doc__Number       : '',
            Doc__Revision     : 'A',
            Doc__CreatedIso   : Na__LeStmt__Now(),
            Doc__UpdatedIso   : Na__LeStmt__Now(),
            Doc__PublishedIso : null,
            Doc__PublishedUrl : null,
            Doc__Images       : []
        };
        Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS].push(record);
        await Na__LeStmt__SaveIndex({ cloud : false });
        await Na__LeStmt__RefreshTree();
        Na__LeStmt__Dispatch('created', { id : record.Doc__Id, adopted : true });
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember That a Statement Reached the Cloud
    // ------------------------------------------------------------
    async function Na__LeStmt__MarkPublished(id, detail) {
        const record = Na__LeStmt__Record(id);
        if (!record) return false;
        record.Doc__PublishedIso = Na__LeStmt__Now();
        record.Doc__PublishedUrl = (detail && detail.url) || record.Doc__PublishedUrl;
        record.Doc__Images       = (detail && Array.isArray(detail.images)) ? detail.images : record.Doc__Images;
        await Na__LeStmt__SaveIndex({ cloud : true });
        Na__LeStmt__Dispatch('published', { id : record.Doc__Id });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reads
// -----------------------------------------------------------------------------

    // FUNCTION | How the Statements Stand
    // ------------------------------------------------------------
    function Na__LeStmt__GetState() {
        const record = Na__LeStmt__Record(Na__LeStmt__OpenId);
        return {
            status      : Na__LeStmt__Status,
            source      : Na__LeStmt__Source,
            error       : Na__LeStmt__Error,
            editable    : Na__LeStmt__Editable,
            count       : (Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS] || []).length,
            unknown     : Na__LeStmt__Unknown.slice(),
            openId      : Na__LeStmt__OpenId,
            open        : record,
            textStatus  : Na__LeStmt__TextStatus,
            textError   : Na__LeStmt__TextError,
            dirty       : Na__LeStmt__LiveText !== Na__LeStmt__SavedText,
            saving      : Na__LeStmt__Saving,
            published   : record ? record.Doc__PublishedIso : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Statements, in Folder Order
    // ------------------------------------------------------------
    function Na__LeStmt__List() {
        return (Na__LeStmt__Doc[Na__LeStmtIdx__K_DOCUMENTS] || [])
            .slice()
            .sort((left, right) => String(left.Doc__Folder).localeCompare(String(right.Doc__Folder)));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Open Statement's Markdown, and Its Record
    // ------------------------------------------------------------
    function Na__LeStmt__GetText()   { return Na__LeStmt__LiveText; }
    function Na__LeStmt__GetSaved()  { return Na__LeStmt__SavedText; }
    function Na__LeStmt__GetOpen()   { return Na__LeStmt__Record(Na__LeStmt__OpenId); }
    function Na__LeStmt__IsDirty()   { return Na__LeStmt__LiveText !== Na__LeStmt__SavedText; }
    function Na__LeStmt__IsEditable(){ return Na__LeStmt__Editable; }
    function Na__LeStmt__GetTree()   { return Na__LeStmt__Tree.slice(); }
    // ------------------------------------------------------------


    // FUNCTION | Where the Open Statement's Relative Picture Links Hang Off
    // ------------------------------------------------------------
    function Na__LeStmt__ImageBase() {
        const record = Na__LeStmt__Record(Na__LeStmt__OpenId);
        return record ? Na__LeStmtIo__ImageBase(record) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialisation
// -----------------------------------------------------------------------------

    // FUNCTION | Hand In the Editable Flag and the Toast
    // ------------------------------------------------------------
    function Na__LeStmt__Initialize(options) {
        const opts = options || {};
        Na__LeStmt__Editable  = opts.editable === true;
        Na__LeStmt__ShowToast = (typeof opts.showToast === 'function') ? opts.showToast : null;
        if (Na__LeStmt__Initialised) return;
        Na__LeStmt__Initialised = true;

        // THE TAB CLOSING is the last chance to keep what was typed. The draft
        // is written straight out rather than waiting for its timer.
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && Na__LeStmt__IsDirty() && Na__LeStmt__OpenId) {
                Na__LeStmt__WriteDraft(Na__LeStmt__OpenId, Na__LeStmt__LiveText);
            }
        });
        window.addEventListener('pagehide', () => {
            if (Na__LeStmt__IsDirty() && Na__LeStmt__OpenId) Na__LeStmt__WriteDraft(Na__LeStmt__OpenId, Na__LeStmt__LiveText);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Writer Data API
    // ------------------------------------------------------------
    export {
        Na__LeStmt__CHANGED_EVENT,
        Na__LeStmt__OPEN_EVENT,
        Na__LeStmt__STATUS_IDLE,
        Na__LeStmt__STATUS_LOADING,
        Na__LeStmt__STATUS_READY,
        Na__LeStmt__STATUS_NEW,
        Na__LeStmt__STATUS_FAILED,
        Na__LeStmt__Initialize,
        Na__LeStmt__EnsureLoaded,
        Na__LeStmt__RefreshTree,
        Na__LeStmt__Open,
        Na__LeStmt__SetText,
        Na__LeStmt__SaveLocal,
        Na__LeStmt__SaveIndex,
        Na__LeStmt__Create,
        Na__LeStmt__Rename,
        Na__LeStmt__Delete,
        Na__LeStmt__Adopt,
        Na__LeStmt__MarkPublished,
        Na__LeStmt__NameFor,
        Na__LeStmt__GetState,
        Na__LeStmt__List,
        Na__LeStmt__GetText,
        Na__LeStmt__GetSaved,
        Na__LeStmt__GetOpen,
        Na__LeStmt__GetTree,
        Na__LeStmt__IsDirty,
        Na__LeStmt__IsEditable,
        Na__LeStmt__ImageBase
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
