// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DATA - DOCUMENT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecData__Document__.js
// NAMESPACE  : Na__LeSpec
// MODULE     : Layout Editor - Specification Data - Document
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The specification document's shape and every read of it: normalisation, the codes, the index, the lookups and the lifecycle state the tab and panels show
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - NORMALISATION. Any document, hand-edited or partial, is made whole: a
//   fresh copy with every field present, unknown keys carried, a missing or
//   repeated id replaced from the counter, prefixes cleaned to letters, and
//   every note's code recomputed from its group and its place (Renumber).
// - THE INDEX. Every note in order, with lookups by id and by code, built on
//   the first read after a change and kept in the State unit until the next
//   change clears it.
// - READING. The groups and notes, a note's code, typed codes read forgivingly
//   (ParseCode, FindByCode, NormaliseCode), the prefix checks, and GetState,
//   the lifecycle summary the tab and the panels are drawn from. Its canSync
//   also needs the Cloudflare Worker configured (Na__CfApi__IsConfigured).
// - Nothing here changes the document. The only state it writes is the index
//   and, through NextId, the id floor a normalisation raises.
//
// INTEGRATION:
// - Imports the State unit, the config state and the Cloudflare API client
//   (for GetState). Imported by the Draft, Editing and Transport units and by
//   Na__LayoutEditor__SpecData__.js, which exports the reads and Normalise.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : BuildIndex stores the index through Na__LeSpec__SetIndex.
//                   Against ValeVision's unit, GetState also requires
//                   Na__CfApi__IsConfigured for canSync, so this unit imports
//                   the Cloudflare API client; the header and paths differ.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SpecData__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, R2 Client and the Specification State
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__CfApi__IsConfigured } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import {
        Na__LeSpec__VERSION,
        Na__LeSpec__STATUS_IDLE,
        Na__LeSpec__STATUS_LOADING,
        Na__LeSpec__K_DESCRIPTION,
        Na__LeSpec__K_VERSION,
        Na__LeSpec__K_PROJECT,
        Na__LeSpec__K_UPDATED,
        Na__LeSpec__K_DIGITS,
        Na__LeSpec__K_LAST_ID,
        Na__LeSpec__K_GROUPS,
        Na__LeSpec__K_REVISION,
        Na__LeSpec__K_DOCNUMBER,
        Na__LeSpec__DESCRIPTION,
        Na__LeSpec__Doc,
        Na__LeSpec__Index,
        Na__LeSpec__Status,
        Na__LeSpec__Source,
        Na__LeSpec__Error,
        Na__LeSpec__BaseStamp,
        Na__LeSpec__SyncedJson,
        Na__LeSpec__Syncing,
        Na__LeSpec__LastSyncIso,
        Na__LeSpec__Editable,
        Na__LeSpec__ProjectCode,
        Na__LeSpec__SetIndex,
        Na__LeSpec__CleanPrefix,
        Na__LeSpec__IdNumber,
        Na__LeSpec__NextId,
        Na__LeSpec__Code
    } from './Na__LayoutEditor__SpecData__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Normalisation, Codes and the Index
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Empty Document
    // ------------------------------------------------------------
    function Na__LeSpec__Skeleton() {
        const doc = {};
        doc[Na__LeSpec__K_DESCRIPTION] = Na__LeSpec__DESCRIPTION;
        doc[Na__LeSpec__K_VERSION]     = Na__LeSpec__VERSION;
        doc[Na__LeSpec__K_PROJECT]     = null;
        doc[Na__LeSpec__K_UPDATED]     = null;
        doc[Na__LeSpec__K_DIGITS]      = Na__LeCfg__GetSpecificationSetup().numberDigits;
        doc[Na__LeSpec__K_LAST_ID]     = 0;
        doc[Na__LeSpec__K_REVISION]    = Na__LeCfg__GetSpecificationSetup().defaultRevision;
        doc[Na__LeSpec__K_DOCNUMBER]   = '';                                      // <-- Blank means "follow the project code"; DocumentNumber() decides
        doc[Na__LeSpec__K_GROUPS]      = [];
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Every Note's Code From Its Group and Its Place
    // ------------------------------------------------------------
    function Na__LeSpec__Renumber(doc) {
        const digits = doc[Na__LeSpec__K_DIGITS];
        doc[Na__LeSpec__K_GROUPS].forEach((group) => {
            group.Group__Notes.forEach((note, i) => { note.Note__Code = Na__LeSpec__Code(group.Group__Prefix, i + 1, digits); });
        });
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Any Document Whole: a Fresh Copy, Every Field Present, Codes Recomputed
    // ------------------------------------------------------------
    // A hand-edited or partial file still reads: unknown keys are carried so a
    // field some later tool writes survives a round trip, a missing or repeated
    // id is replaced from the counter, a prefix is cleaned to letters, and the
    // counter is raised past every id actually present.
    // ------------------------------------------------------------
    function Na__LeSpec__Normalise(raw) {
        const setup  = Na__LeCfg__GetSpecificationSetup();
        const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? JSON.parse(JSON.stringify(raw)) : {};
        const doc    = Na__LeSpec__Skeleton();
        Object.keys(source).forEach((key) => { if (!(key in doc)) doc[key] = source[key]; });

        const digits = source[Na__LeSpec__K_DIGITS];
        doc[Na__LeSpec__K_DIGITS]  = (Number.isFinite(digits) && digits >= 1 && digits <= 4) ? Math.round(digits) : setup.numberDigits;
        doc[Na__LeSpec__K_UPDATED] = typeof source[Na__LeSpec__K_UPDATED] === 'string' ? source[Na__LeSpec__K_UPDATED] : null;
        doc[Na__LeSpec__K_PROJECT] = typeof source[Na__LeSpec__K_PROJECT] === 'string' ? source[Na__LeSpec__K_PROJECT] : null;

        // REVISION AND DOCUMENT NUMBER. A specification written before these existed
        // has neither, and opens at the configured revision rather than at nothing:
        // a document that is issued has a revision even if nobody has typed one yet.
        const revision = source[Na__LeSpec__K_REVISION];
        doc[Na__LeSpec__K_REVISION]  = (typeof revision === 'string' && revision.trim() !== '') ? revision.trim() : setup.defaultRevision;
        doc[Na__LeSpec__K_DOCNUMBER] = typeof source[Na__LeSpec__K_DOCNUMBER] === 'string' ? source[Na__LeSpec__K_DOCNUMBER].trim() : '';

        const groups = Array.isArray(source[Na__LeSpec__K_GROUPS]) ? source[Na__LeSpec__K_GROUPS].filter((g) => g && typeof g === 'object') : [];
        let highest = Number.isFinite(source[Na__LeSpec__K_LAST_ID]) ? Math.max(0, Math.round(source[Na__LeSpec__K_LAST_ID])) : 0;
        groups.forEach((g) => {
            highest = Math.max(highest, Na__LeSpec__IdNumber(g.Group__Id));
            (Array.isArray(g.Group__Notes) ? g.Group__Notes : []).forEach((n) => { if (n && typeof n === 'object') highest = Math.max(highest, Na__LeSpec__IdNumber(n.Note__Id)); });
        });
        doc[Na__LeSpec__K_LAST_ID] = highest;

        const seen = new Set();
        const idOr = (value, prefix) => {
            const ok = typeof value === 'string' && value.trim() !== '' && !seen.has(value.trim());
            const id = ok ? value.trim() : Na__LeSpec__NextId(doc, prefix);
            seen.add(id);
            return id;
        };
        doc[Na__LeSpec__K_GROUPS] = groups.map((g) => {
            const group = {
                Group__Id        : idOr(g.Group__Id, 'SpecGroup_'),
                Group__Prefix    : Na__LeSpec__CleanPrefix(g.Group__Prefix) || 'X',
                Group__Title     : typeof g.Group__Title === 'string' ? g.Group__Title : '',
                Group__IsGeneral : g.Group__IsGeneral === true,
                Group__Notes     : []
            };
            Object.keys(g).forEach((key) => { if (!(key in group)) group[key] = g[key]; });
            group.Group__Notes = (Array.isArray(g.Group__Notes) ? g.Group__Notes : []).filter((n) => n && typeof n === 'object').map((n) => {
                const note = {
                    Note__Id         : idOr(n.Note__Id, 'SpecNote_'),
                    Note__Code       : '',
                    Note__Title      : typeof n.Note__Title === 'string' ? n.Note__Title : '',
                    Note__Body       : typeof n.Note__Body === 'string' ? n.Note__Body : '',
                    Note__UpdatedIso : typeof n.Note__UpdatedIso === 'string' ? n.Note__UpdatedIso : null
                };
                Object.keys(n).forEach((key) => { if (!(key in note)) note[key] = n[key]; });
                return note;
            });
            return group;
        });
        return Na__LeSpec__Renumber(doc);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Issued Revision, and the Number the Document Carries
    // ------------------------------------------------------------
    // Both are answered before the document has loaded, because the bar and the
    // reading page ask for them on their first paint: the revision falls back to
    // the configured default, and the number to the project code with the
    // configured suffix, which is what an untouched specification is called.
    // ------------------------------------------------------------
    function Na__LeSpec__GetRevision() {
        const setup = Na__LeCfg__GetSpecificationSetup();
        const value = Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_REVISION] : null;
        return (typeof value === 'string' && value.trim() !== '') ? value.trim() : setup.defaultRevision;
    }

    function Na__LeSpec__GetDocumentNumber(projectCode) {
        const setup = Na__LeCfg__GetSpecificationSetup();
        const value = Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_DOCNUMBER] : null;
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
        const code = String(projectCode || Na__LeSpec__ProjectCode || '').trim();
        return code === '' ? setup.documentNumberSuffix : code + setup.documentNumberSuffix;   // <-- PS01 gives PS01_SPEC; type PS01_T02_SPEC over it to match the sheets
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Part of a Document That Counts as Its Content
    // ------------------------------------------------------------
    // The revision and the document number are CONTENT, not bookkeeping: changing
    // either has to mark the document unsynced, or Sync stays off and the issued
    // revision never reaches the cloud copy the next person reads.
    function Na__LeSpec__ContentJson(doc) {
        return doc ? JSON.stringify([ doc[Na__LeSpec__K_DIGITS], doc[Na__LeSpec__K_REVISION], doc[Na__LeSpec__K_DOCNUMBER], doc[Na__LeSpec__K_GROUPS] ]) : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Lookups (a flat list in order, by id and by code)
    // ------------------------------------------------------------
    // Several groups may share a prefix in a hand-edited file; the first in
    // order owns the code, and PrefixClashes reports the rest.
    // ------------------------------------------------------------
    function Na__LeSpec__BuildIndex() {
        const list = [], byId = new Map(), byCode = new Map();
        (Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_GROUPS] : []).forEach((group, groupIndex) => {
            group.Group__Notes.forEach((note, index) => {
                const entry = { note : note, group : group, groupIndex : groupIndex, index : index, order : list.length, code : note.Note__Code };
                list.push(entry);
                byId.set(note.Note__Id, entry);
                if (!byCode.has(entry.code)) byCode.set(entry.code, entry);
            });
        });
        Na__LeSpec__SetIndex({ list : list, byId : byId, byCode : byCode });
        return Na__LeSpec__Index;
    }
    function Na__LeSpec__Lookups() { return Na__LeSpec__Index || Na__LeSpec__BuildIndex(); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Note's Id and Code as One String
    // ------------------------------------------------------------
    function Na__LeSpec__CodeSignature() {
        return Na__LeSpec__Lookups().list.map((entry) => entry.note.Note__Id + '=' + entry.code).join('|');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // FUNCTION | The Groups in Order (the live array: read, never write)
    // ------------------------------------------------------------
    function Na__LeSpec__GetGroups() { return Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_GROUPS] : []; }
    // ------------------------------------------------------------


    // FUNCTION | One Group by Id
    // ------------------------------------------------------------
    function Na__LeSpec__GetGroupById(groupId) {
        return Na__LeSpec__GetGroups().find((group) => group.Group__Id === groupId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Note in Order: [{ note, group, groupIndex, index, order, code }]
    // ------------------------------------------------------------
    function Na__LeSpec__ListNotes() { return Na__LeSpec__Lookups().list; }
    // ------------------------------------------------------------


    // FUNCTION | One Note by Id, With Its Group, Place and Code (null when absent)
    // ------------------------------------------------------------
    function Na__LeSpec__GetNoteEntry(noteId) {
        return (typeof noteId === 'string' && Na__LeSpec__Doc) ? (Na__LeSpec__Lookups().byId.get(noteId) || null) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Note's Current Code (null when the note is not in the specification)
    // ------------------------------------------------------------
    function Na__LeSpec__CodeFor(noteId) {
        const entry = Na__LeSpec__GetNoteEntry(noteId);
        return entry ? entry.code : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read Typed Text as a Code: { prefix, number } or Null
    // ------------------------------------------------------------
    // Forgiving about case, spaces, a hyphen or a dot and zero padding, so
    // "ee2", "EE-02" and "EE 002" all read as EE and 2. Places start at 1.
    // ------------------------------------------------------------
    function Na__LeSpec__ParseCode(text) {
        const compact = String(text === undefined || text === null ? '' : text).toUpperCase().replace(/\s+/g, '');
        const match   = compact.match(/^([A-Z]{1,6})[-.]?(\d{1,4})$/);
        if (!match) return null;
        const number = parseInt(match[2], 10);
        return number >= 1 ? { prefix : match[1], number : number } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Note a Typed Code Names (null when none does)
    // ------------------------------------------------------------
    function Na__LeSpec__FindByCode(text) {
        const parsed = Na__LeSpec__ParseCode(text);
        if (!parsed || !Na__LeSpec__Doc) return null;
        return Na__LeSpec__Lookups().byCode.get(Na__LeSpec__Code(parsed.prefix, parsed.number, Na__LeSpec__Doc[Na__LeSpec__K_DIGITS])) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Canonical Form of a Typed Code, Whether or Not a Note Has It
    // ------------------------------------------------------------
    function Na__LeSpec__NormaliseCode(text) {
        const parsed = Na__LeSpec__ParseCode(text);
        const digits = Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_DIGITS] : Na__LeCfg__GetSpecificationSetup().numberDigits;
        return parsed ? Na__LeSpec__Code(parsed.prefix, parsed.number, digits) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Prefixes More Than One Group Uses (a hand-edited file's clash)
    // ------------------------------------------------------------
    function Na__LeSpec__PrefixClashes() {
        const counts = new Map();
        Na__LeSpec__GetGroups().forEach((group) => counts.set(group.Group__Prefix, (counts.get(group.Group__Prefix) || 0) + 1));
        return new Set(Array.from(counts.keys()).filter((prefix) => counts.get(prefix) > 1));
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Prefix Acceptable for a Group: { ok, value, reason, message }
    // ------------------------------------------------------------
    // Letters only, at most PrefixMaxLength of them, and not another group's.
    // Nothing clashing is ever created: codes are unique by construction once
    // prefixes are.
    // ------------------------------------------------------------
    function Na__LeSpec__ValidatePrefix(value, groupId) {
        const max = Na__LeCfg__GetSpecificationSetup().prefixMaxLength;
        const raw = String(value === undefined || value === null ? '' : value).trim().toUpperCase();
        if (!raw) return { ok : false, value : raw, reason : 'empty', message : Na__LeCfg__GetLabel('SpecPrefixEmpty', 'A prefix needs at least one letter.') };
        if (!/^[A-Z]+$/.test(raw)) return { ok : false, value : raw, reason : 'letters', message : Na__LeCfg__GetLabel('SpecPrefixLetters', 'A prefix is letters only, A to Z.') };
        if (raw.length > max) return { ok : false, value : raw, reason : 'length', message : Na__LeCfg__FormatLabel('SpecPrefixLength', 'A prefix is at most {max} letters.', { max : max }) };
        const other = Na__LeSpec__GetGroups().find((group) => group.Group__Prefix === raw && group.Group__Id !== groupId);
        if (other) return { ok : false, value : raw, reason : 'clash', message : Na__LeCfg__FormatLabel('SpecPrefixClash', '{prefix} is already the prefix of {title}.', { prefix : raw, title : other.Group__Title || raw }) };
        return { ok : true, value : raw, reason : null, message : '' };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Code Width in Digits
    // ------------------------------------------------------------
    function Na__LeSpec__NumberDigits() {
        return Na__LeSpec__Doc ? Na__LeSpec__Doc[Na__LeSpec__K_DIGITS] : Na__LeCfg__GetSpecificationSetup().numberDigits;
    }
    // ------------------------------------------------------------


    // FUNCTION | Lifecycle State for the Tab and the Panels
    // ------------------------------------------------------------
    // { status, source, error, dirty, syncing, lastSyncIso, cloudStamp, loaded,
    //   editable, canSync }
    // ------------------------------------------------------------
    function Na__LeSpec__GetState() {
        const loaded = !!Na__LeSpec__Doc && Na__LeSpec__Status !== Na__LeSpec__STATUS_IDLE && Na__LeSpec__Status !== Na__LeSpec__STATUS_LOADING;
        return {
            status      : Na__LeSpec__Status,
            source      : Na__LeSpec__Source,
            error       : Na__LeSpec__Error,
            dirty       : Na__LeSpec__IsDirty(),
            syncing     : Na__LeSpec__Syncing,
            lastSyncIso : Na__LeSpec__LastSyncIso,
            cloudStamp  : Na__LeSpec__BaseStamp,
            loaded      : loaded,
            editable    : Na__LeSpec__Editable,
            canSync     : loaded && Na__LeSpec__Editable && !Na__LeSpec__Syncing && Na__CfApi__IsConfigured()
        };
    }
    function Na__LeSpec__IsLoaded()   { return Na__LeSpec__GetState().loaded; }
    function Na__LeSpec__IsDirty()    { return !!Na__LeSpec__Doc && Na__LeSpec__ContentJson(Na__LeSpec__Doc) !== Na__LeSpec__SyncedJson; }
    function Na__LeSpec__IsEditable() { return Na__LeSpec__Editable; }
    function Na__LeSpec__GetDocument() { return Na__LeSpec__Doc; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Data Document: Normalisation, Codes, the Index and Reading
    // ------------------------------------------------------------
    export {
        Na__LeSpec__GetRevision,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__Skeleton,
        Na__LeSpec__Renumber,
        Na__LeSpec__Normalise,
        Na__LeSpec__ContentJson,
        Na__LeSpec__CodeSignature,
        Na__LeSpec__GetGroups,
        Na__LeSpec__GetGroupById,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__CodeFor,
        Na__LeSpec__ParseCode,
        Na__LeSpec__FindByCode,
        Na__LeSpec__NormaliseCode,
        Na__LeSpec__PrefixClashes,
        Na__LeSpec__ValidatePrefix,
        Na__LeSpec__NumberDigits,
        Na__LeSpec__GetState,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__IsDirty,
        Na__LeSpec__IsEditable,
        Na__LeSpec__GetDocument
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
