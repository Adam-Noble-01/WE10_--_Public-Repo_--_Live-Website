// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT DATA - INDEX
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Data__Index__.js
// NAMESPACE  : Na__LeStmtIdx
// MODULE     : Layout Editor - Statement Writer - The Index Document
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shape the statement index, name a new statement, and read the folder back when the index has lost track
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT THE INDEX IS FOR. A statement is a folder holding a markdown file and
//   the pictures it uses. The folder alone cannot say which of its markdown
//   files is the statement - the RB05 pre-app folder holds the statement AND a
//   project notes file written for an agent to read - so one small JSON beside
//   the project data remembers: for each statement, its folder, its markdown
//   file, what it is called and when it was last published.
// - THE FOLDER IS THE TRUTH, THE INDEX IS THE MEMORY. If the index names a
//   file that is no longer on disk, the file wins and the entry is marked
//   missing rather than quietly recreated. If the folder holds a statement the
//   index has never heard of - one made by hand, or by another machine -
//   Adopt finds it and offers it. Nothing is ever written into a statement
//   folder to make it match the index.
// - NAMING IS DERIVED, NOT TYPED. "Design & Access Statement" in project RB05
//   gives the folder 02__DaStatement's successor and the file
//   RB05_T01_S02__WestFarm__DesignAccessStatement__.md: the next free two-digit
//   folder prefix, and the project code, tranche and an S-number counted
//   across the project's own statements. Both can be renamed afterwards; this
//   only decides what they start as.
// - IDS NEVER COME ROUND AGAIN. Doc__Id comes from a counter in the file that
//   only goes up, so a statement deleted and a new one made can never share an
//   id and inherit the other's publish history.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Statement__Data__ and its transport unit. Holds
//   no state of its own: every function here takes the document and returns a
//   new one or an answer about it.
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
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Index Document's Keys
    // ------------------------------------------------------------
    const Na__LeStmtIdx__VERSION      = '1.0.0';
    const Na__LeStmtIdx__DESCRIPTION  = 'TrueVision Statement Writer - the project\'s written documents. Each entry names a folder under 10__StatementDocs and the one markdown file in it that IS the statement. The words live in that markdown file, not here.';

    const Na__LeStmtIdx__K_DESC       = 'Statement__Description';
    const Na__LeStmtIdx__K_VERSION    = 'Statement__Version';
    const Na__LeStmtIdx__K_PROJECT    = 'Statement__Project';
    const Na__LeStmtIdx__K_UPDATED    = 'Statement__UpdatedIso';
    const Na__LeStmtIdx__K_LAST_ID    = 'Statement__LastId';
    const Na__LeStmtIdx__K_DOCUMENTS  = 'Statement__Documents';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Recognising a Statement Folder on Disk
    // ------------------------------------------------------------
    const Na__LeStmtIdx__RE_FOLDER    = /^(\d{2})__(.+)$/;                      // <-- "01__PreApp__Statement"
    const Na__LeStmtIdx__RE_NOTES     = /_N\d{2}__|__ProjectNotes__|__Notes__/i; // <-- A notes file is NOT a statement
    const Na__LeStmtIdx__RE_STATEMENT = /_S(\d{2})__/;                          // <-- The S-number inside a statement's file name
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shaping the Document
// -----------------------------------------------------------------------------

    // FUNCTION | An Empty Index
    // ------------------------------------------------------------
    function Na__LeStmtIdx__Skeleton() {
        return {
            [Na__LeStmtIdx__K_DESC]      : Na__LeStmtIdx__DESCRIPTION,
            [Na__LeStmtIdx__K_VERSION]   : Na__LeStmtIdx__VERSION,
            [Na__LeStmtIdx__K_PROJECT]   : null,
            [Na__LeStmtIdx__K_UPDATED]   : null,
            [Na__LeStmtIdx__K_LAST_ID]   : 0,
            [Na__LeStmtIdx__K_DOCUMENTS] : []
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Whatever Was Read Into a Whole Index
    // ------------------------------------------------------------
    // Never throws and never drops an entry it half understands: a record with
    // a folder and a file is a statement, however little else it carries.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__Normalise(data) {
        const source = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
        const out    = Na__LeStmtIdx__Skeleton();

        out[Na__LeStmtIdx__K_PROJECT] = (typeof source[Na__LeStmtIdx__K_PROJECT] === 'string') ? source[Na__LeStmtIdx__K_PROJECT] : null;
        out[Na__LeStmtIdx__K_UPDATED] = (typeof source[Na__LeStmtIdx__K_UPDATED] === 'string') ? source[Na__LeStmtIdx__K_UPDATED] : null;

        const documents = Array.isArray(source[Na__LeStmtIdx__K_DOCUMENTS]) ? source[Na__LeStmtIdx__K_DOCUMENTS] : [];
        let   highest   = Number(source[Na__LeStmtIdx__K_LAST_ID]);
        if (!Number.isFinite(highest) || highest < 0) highest = 0;

        out[Na__LeStmtIdx__K_DOCUMENTS] = documents
            .filter((record) => record && typeof record === 'object' && typeof record.Doc__Folder === 'string' && record.Doc__Folder)
            .map((record) => {
                const id = Number(record.Doc__Id);
                const kept = {
                    Doc__Id           : (Number.isFinite(id) && id > 0) ? Math.round(id) : 0,
                    Doc__Title        : (typeof record.Doc__Title === 'string' && record.Doc__Title) ? record.Doc__Title : record.Doc__Folder,
                    Doc__Folder       : record.Doc__Folder,
                    Doc__File         : (typeof record.Doc__File === 'string') ? record.Doc__File : '',
                    Doc__Number       : (typeof record.Doc__Number === 'string') ? record.Doc__Number : '',
                    Doc__Revision     : (typeof record.Doc__Revision === 'string' && record.Doc__Revision) ? record.Doc__Revision : 'A',
                    Doc__CreatedIso   : (typeof record.Doc__CreatedIso === 'string') ? record.Doc__CreatedIso : null,
                    Doc__UpdatedIso   : (typeof record.Doc__UpdatedIso === 'string') ? record.Doc__UpdatedIso : null,
                    Doc__PublishedIso : (typeof record.Doc__PublishedIso === 'string') ? record.Doc__PublishedIso : null,
                    Doc__PublishedUrl : (typeof record.Doc__PublishedUrl === 'string') ? record.Doc__PublishedUrl : null,
                    Doc__Images       : Array.isArray(record.Doc__Images) ? record.Doc__Images.slice() : []
                };
                if (kept.Doc__Id > highest) highest = kept.Doc__Id;
                return kept;
            });

        // AN ENTRY WITH NO ID gets one now, above every id ever spent
        for (const record of out[Na__LeStmtIdx__K_DOCUMENTS]) {
            if (record.Doc__Id === 0) record.Doc__Id = ++highest;
        }

        out[Na__LeStmtIdx__K_LAST_ID] = highest;
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Index's Content, Without Its Stamp
    // ------------------------------------------------------------
    // What is compared to decide whether anything actually changed. The stamp
    // is left out on purpose: a save writes a new one every time, and a file
    // that differs only by when it was written has not been edited.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__ContentJson(document) {
        const copy = JSON.parse(JSON.stringify(document || Na__LeStmtIdx__Skeleton()));
        delete copy[Na__LeStmtIdx__K_UPDATED];
        return JSON.stringify(copy);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Naming a New Statement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Typed Title as the Middle of a File Name
    // ------------------------------------------------------------
    // The words run together, letters and digits only, each capitalised:
    // "Design & Access Statement" gives "DesignAccessStatement".
    // ------------------------------------------------------------
    function Na__LeStmtIdx__TitlePart(title) {
        const words = String(title || '').match(/[A-Za-z0-9]+/g) || [];
        return words.map((word) => word[0].toUpperCase() + word.slice(1)).join('').slice(0, 60);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Zero-Pad a Number
    // ------------------------------------------------------------
    function Na__LeStmtIdx__Pad(value, digits) {
        return String(Math.max(0, Math.round(value))).padStart(Math.max(1, digits), '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free Two-Digit Folder Prefix
    // ------------------------------------------------------------
    // Counted from what is on disk as well as from the index, so a folder made
    // by hand is never written over by the next new statement.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__NextFolderIndex(document, folderNames) {
        let highest = 0;
        const consider = (name) => {
            const match = Na__LeStmtIdx__RE_FOLDER.exec(String(name || ''));
            if (match) highest = Math.max(highest, Number(match[1]));
        };
        for (const record of (document && document[Na__LeStmtIdx__K_DOCUMENTS]) || []) consider(record.Doc__Folder);
        for (const name of (folderNames || [])) consider(name);
        return highest + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Next Free S-Number
    // ------------------------------------------------------------
    // Counted from the S-numbers already used by the project's statement file
    // names, so the numbering follows the documents rather than the folders.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__NextStatementNumber(document, fileNames) {
        let highest = 0;
        const consider = (name) => {
            const match = Na__LeStmtIdx__RE_STATEMENT.exec(String(name || ''));
            if (match) highest = Math.max(highest, Number(match[1]));
        };
        for (const record of (document && document[Na__LeStmtIdx__K_DOCUMENTS]) || []) consider(record.Doc__File);
        for (const name of (fileNames || [])) consider(name);
        return highest + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a New Statement Will Be Called
    // ------------------------------------------------------------
    // context: { title, projectCode, projectName, tranche, folderNames,
    //            fileNames, setup }. Returns { folder, file, number, title }.
    // Nothing is created here - this is what the manager shows underneath the
    // title field while it is being typed, and what Create then uses.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__NameFor(document, context) {
        const setup    = context.setup || {};
        const digits   = Math.max(1, Math.min(4, Number(setup.numberDigits) || 2));
        const part     = Na__LeStmtIdx__TitlePart(context.title) || 'Statement';
        const index    = Na__LeStmtIdx__NextFolderIndex(document, context.folderNames);
        const number   = Na__LeStmtIdx__NextStatementNumber(document, context.fileNames);
        const tranche  = String(context.tranche || setup.defaultTranche || '01');
        const code     = String(context.projectCode || 'XX00');
        const project  = Na__LeStmtIdx__TitlePart(context.projectName) || code;

        const folder = String(setup.folderPattern || '{index}__{title}')
            .replace('{index}', Na__LeStmtIdx__Pad(index, 2))
            .replace('{title}', part);

        const file = String(setup.filePattern || '{code}_T{tranche}_S{number}__{project}__{title}__.md')
            .replace('{code}', code)
            .replace('{tranche}', tranche)
            .replace('{number}', Na__LeStmtIdx__Pad(number, digits))
            .replace('{project}', project)
            .replace('{title}', part);

        return { folder : folder, file : file, number : 'S' + Na__LeStmtIdx__Pad(number, digits), title : String(context.title || '').trim() };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Folder Back
// -----------------------------------------------------------------------------

    // FUNCTION | Is This File Name a Statement, or Something Beside One
    // ------------------------------------------------------------
    // A notes file sits in the same folder as the statement it was written to
    // help with, and it is not a document this app manages. It is recognised
    // by its N-number or by the words in its name, and left alone.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__LooksLikeStatement(fileName) {
        const name = String(fileName || '');
        if (!/\.md$/i.test(name)) return false;
        if (Na__LeStmtIdx__RE_NOTES.test(name)) return false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Statements on Disk the Index Has Never Heard Of
    // ------------------------------------------------------------
    // entries: the tree from the local server. Returns one candidate per
    // statement folder that has a markdown file and no entry in the index, so
    // the manager can offer to adopt a statement written by hand or brought
    // over from another machine. Nothing is adopted without being asked.
    // ------------------------------------------------------------
    function Na__LeStmtIdx__Unknown(document, entries) {
        const known = new Set(((document && document[Na__LeStmtIdx__K_DOCUMENTS]) || []).map((record) => record.Doc__Folder));
        const found = new Map();

        for (const entry of (entries || [])) {
            const folder = String(entry.folder || '').split('/')[0];
            if (!folder || known.has(folder)) continue;
            if (!Na__LeStmtIdx__RE_FOLDER.test(folder)) continue;
            if (String(entry.folder) !== folder) continue;                      // <-- Only a markdown file at the statement folder's own root
            if (!Na__LeStmtIdx__LooksLikeStatement(entry.name)) continue;
            if (found.has(folder)) continue;                                    // <-- The first one wins; a second is a second draft, not a second statement
            found.set(folder, {
                Doc__Folder : folder,
                Doc__File   : entry.name,
                Doc__Title  : folder.replace(Na__LeStmtIdx__RE_FOLDER, '$2').replace(/__/g, ' ').replace(/_/g, ' ').trim()
            });
        }

        return Array.from(found.values());
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Statement Folder Name on Disk
    // ------------------------------------------------------------
    function Na__LeStmtIdx__FolderNames(entries) {
        const names = new Set();
        for (const entry of (entries || [])) {
            const folder = String(entry.folder || '').split('/')[0];
            if (folder && Na__LeStmtIdx__RE_FOLDER.test(folder)) names.add(folder);
        }
        return Array.from(names);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Markdown File Name on Disk
    // ------------------------------------------------------------
    function Na__LeStmtIdx__FileNames(entries) {
        return (entries || []).filter((entry) => /\.md$/i.test(entry.name || '')).map((entry) => entry.name);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Index API
    // ------------------------------------------------------------
    export {
        Na__LeStmtIdx__VERSION,
        Na__LeStmtIdx__DESCRIPTION,
        Na__LeStmtIdx__K_DESC,
        Na__LeStmtIdx__K_VERSION,
        Na__LeStmtIdx__K_PROJECT,
        Na__LeStmtIdx__K_UPDATED,
        Na__LeStmtIdx__K_LAST_ID,
        Na__LeStmtIdx__K_DOCUMENTS,
        Na__LeStmtIdx__Skeleton,
        Na__LeStmtIdx__Normalise,
        Na__LeStmtIdx__ContentJson,
        Na__LeStmtIdx__TitlePart,
        Na__LeStmtIdx__NextFolderIndex,
        Na__LeStmtIdx__NextStatementNumber,
        Na__LeStmtIdx__NameFor,
        Na__LeStmtIdx__LooksLikeStatement,
        Na__LeStmtIdx__Unknown,
        Na__LeStmtIdx__FolderNames,
        Na__LeStmtIdx__FileNames
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
