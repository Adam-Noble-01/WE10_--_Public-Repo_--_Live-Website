// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT SHARING - LINKS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Share__Links__.js
// NAMESPACE  : Na__LeShareLink
// MODULE     : Layout Editor - Document Sharing - Links
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The share link builder: which key names a document, what address a key is sent as, and what a key read back means
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE ADDRESS HANDED OUT IS A SHORT ONE, AND A PAGE AT THE WEBSITE ROOT
//   RESOLVES IT, exactly as the printed QR code's is:
//       https://www.noble-architecture.com/s/?RB05&open=Sheet_004
//   s/index.html looks RB05 up in q/index.json - the index the QR resolver
//   already reads - and sends the reader on to
//       .../na-apps/30__TrueVision__CoreAppCode/Index.html
//           ?project=RB05&project-folder=RB05__WestFarm&year=26&open=Sheet_004
//   where Na__LayoutEditor__Share__Open__ opens that document's read view.
//   The link carries the project's CODE and the document's KEY and nothing
//   else - no folder, no year, no app path - so moving the app, renaming the
//   project folder or changing how a job is filed changes none of it.
// - A KEY IS A PERMANENT NAME FOR ONE DOCUMENT OF ONE PROJECT, and it is chosen
//   from the one identity that does not move:
//     a drawing       its sheet id, verbatim ("Sheet_004"). NOT its drawing
//                     number: D02 is worked out from the register's order, so
//                     dragging one row renumbers every drawing below it, and a
//                     link carrying D02 would quietly open a different drawing.
//                     The sheet id survives renaming, renumbering, a new phase
//                     and a new revision.
//     a statement     "Statement_" + its Doc__Id, which the statement index
//                     hands out once and never reuses.
//     the two singles "Specification" and "Register".
//   THESE ARE RULES IN CODE, NOT SETTINGS. A key is what an already-sent link
//   carries; if a file could rename it, editing that file would break links in
//   inboxes nobody can reach.
// - PARSING IS LIBERAL AND BUILDING IS STRICT. A key is always BUILT in exactly
//   one form, and READ back in every form a person might type or a messaging
//   app might mangle - "spec", "statement-2", "sheet_4" - and, as a last
//   resort, a drawing's document id or number, which the opener then looks for
//   among the drawings. Whatever cannot be parsed is refused, never guessed.
// - THE ADDRESS IS THE LIVE ONE, NEVER THE ONE IN THE ADDRESS BAR. Documents
//   are authored on localhost, so window.location is exactly the address a
//   shared link must NOT carry. The base is a config value; only the project's
//   identity is read off the address bar, by the loader's own three functions.
// - Nothing here touches the DOM, and nothing touches the network except
//   Ready(), which reads the config beside this file once.
//
// INTEGRATION:
// - Na__LayoutEditor__Share__Manifest__ records these addresses at publish.
// - Na__LayoutEditor__Share__Button__ hands one out when there is no record.
// - Na__LayoutEditor__Share__Open__ reads a key off the address bar.
// - s/index.html (website root) is the other half of the address: keep the
//   two in step, and never make either stop answering a form already sent.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original, after the Project QR Code's
//                   Na__ProjectQr__ProjectLink__ (the same base-plus-pattern
//                   builder, and the same rule that the live address is config).
// - Back-port     : candidate (ValeVision has no web viewer and no q folder).
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

    // MODULE IMPORTS | The Project the Application Is Showing
    // ------------------------------------------------------------
    import {
        Na__AppUtils__GetProjectCodeFromUrl,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants - the Permanent Key Rules
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Kinds of Document a Link Can Name
    // ------------------------------------------------------------
    const Na__LeShareLink__KIND_DRAWING   = 'drawing';
    const Na__LeShareLink__KIND_SPEC      = 'specification';
    const Na__LeShareLink__KIND_REGISTER  = 'register';
    const Na__LeShareLink__KIND_STATEMENT = 'statement';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Keys, as They Are Built
    // ------------------------------------------------------------
    // PERMANENT. Every one of these is inside links that have been sent. A new
    // spelling may be ADDED to Parse; none of these may ever change.
    // ------------------------------------------------------------
    const Na__LeShareLink__KEY_SPEC         = 'Specification';
    const Na__LeShareLink__KEY_REGISTER     = 'Register';
    const Na__LeShareLink__PREFIX_STATEMENT = 'Statement_';
    const Na__LeShareLink__PREFIX_SHEET     = 'Sheet_';                          // <-- The sheet model's own id prefix (Na__LeRec__NextId)
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Key and a Project Code May Look Like
    // ------------------------------------------------------------
    // A key is written only with characters a URL carries as they are, so a
    // link is never percent-encoded into something a person cannot read back.
    // ------------------------------------------------------------
    const Na__LeShareLink__KEY_PATTERN  = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,63}$/;
    const Na__LeShareLink__CODE_PATTERN = /^[A-Za-z0-9]{2,12}$/;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Built-In Floor (mirrors Na__LayoutEditor__Share__Config__.json)
    // ------------------------------------------------------------
    const Na__LeShareLink__ConfigUrl = new URL('./Na__LayoutEditor__Share__Config__.json', import.meta.url);
    const Na__LeShareLink__F = {
        link : {
            baseUrl      : 'https://www.noble-architecture.com/s/',
            queryPattern : '?{projectCode}&open={documentKey}',
            openParam    : 'open'
        },
        open : {
            waitForSheetsMs   : 60000,
            liftLoadingScreen : true
        },
        labels : {}
    };
    const Na__LeShareLink__OPEN_PARAM_FLOOR = 'open';                            // <-- Read as well as the configured key, so renaming it in config never strands a sent link
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    let Na__LeShareLink__Setup   = null;
    let Na__LeShareLink__Loading = null;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fold the Config JSON Onto the Built-In Floor
    // ------------------------------------------------------------
    function Na__LeShareLink__Fold(whole) {
        const setup = JSON.parse(JSON.stringify(Na__LeShareLink__F));
        if (!whole || typeof whole !== 'object') return setup;
        const link = whole['LayoutEditor__Share__Link'] || {};
        if (typeof link['Link__BaseUrl'] === 'string' && link['Link__BaseUrl'].trim() !== '')      setup.link.baseUrl      = link['Link__BaseUrl'].trim();
        if (typeof link['Link__QueryPattern'] === 'string' && link['Link__QueryPattern'] !== '')   setup.link.queryPattern = link['Link__QueryPattern'];
        if (typeof link['Link__OpenParam'] === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(link['Link__OpenParam'])) setup.link.openParam = link['Link__OpenParam'];
        const open = whole['LayoutEditor__Share__Open'] || {};
        if (Number.isFinite(Number(open['Open__WaitForSheetsMs'])) && Number(open['Open__WaitForSheetsMs']) > 0) setup.open.waitForSheetsMs = Number(open['Open__WaitForSheetsMs']);
        if (typeof open['Open__LiftLoadingScreen'] === 'boolean') setup.open.liftLoadingScreen = open['Open__LiftLoadingScreen'];
        const labels = whole['LayoutEditor__Share__Labels'];
        if (labels && typeof labels === 'object') setup.labels = Object.assign({}, labels);
        return setup;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Sharing Settings Once (never throws; falls back to the floor)
    // ------------------------------------------------------------
    function Na__LeShareLink__Ready() {
        if (Na__LeShareLink__Setup)   return Promise.resolve(Na__LeShareLink__Setup);
        if (Na__LeShareLink__Loading) return Na__LeShareLink__Loading;
        Na__LeShareLink__Loading = (async () => {
            let whole = null;
            try {
                const response = await fetch(Na__LeShareLink__ConfigUrl, { cache : 'no-store' });
                if (response.ok) whole = await response.json();
            } catch (error) {
                console.warn('[TrueVision3D Share] Sharing config unreadable (' + error.message + '); using the built-in settings.');
            }
            Na__LeShareLink__Setup   = Na__LeShareLink__Fold(whole);
            Na__LeShareLink__Loading = null;
            return Na__LeShareLink__Setup;
        })();
        return Na__LeShareLink__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Settings, Synchronously (the floor until Ready has run)
    // ------------------------------------------------------------
    function Na__LeShareLink__GetSetup() {
        return Na__LeShareLink__Setup || Na__LeShareLink__Fold(null);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {Tokens} Filled
    // ------------------------------------------------------------
    function Na__LeShareLink__Label(key, fallback, tokens) {
        const labels = Na__LeShareLink__GetSetup().labels || {};
        let text = (typeof labels['Labels__' + key] === 'string') ? labels['Labels__' + key] : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keys
// -----------------------------------------------------------------------------

    // FUNCTION | The Key That Names a Document ('' when it cannot be named)
    // ------------------------------------------------------------
    // target: { kind : 'drawing', sheetId } | { kind : 'specification' }
    //       | { kind : 'register' }         | { kind : 'statement', statementId }
    // ------------------------------------------------------------
    function Na__LeShareLink__KeyFor(target) {
        const t = (target && typeof target === 'object') ? target : {};
        if (t.kind === Na__LeShareLink__KIND_DRAWING) {
            const id = String(t.sheetId == null ? '' : t.sheetId).trim();
            return Na__LeShareLink__KEY_PATTERN.test(id) ? id : '';
        }
        if (t.kind === Na__LeShareLink__KIND_SPEC)     return Na__LeShareLink__KEY_SPEC;
        if (t.kind === Na__LeShareLink__KIND_REGISTER) return Na__LeShareLink__KEY_REGISTER;
        if (t.kind === Na__LeShareLink__KIND_STATEMENT) {
            const id = Number(t.statementId);
            return (Number.isInteger(id) && id > 0) ? Na__LeShareLink__PREFIX_STATEMENT + id : '';
        }
        return '';
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Key Read Back Means (null when it is not a key at all)
    // ------------------------------------------------------------
    // Returns { kind, key, id, loose }. key is the BUILT spelling of what was
    // read, so "spec" comes back as "Specification" and a manifest can be
    // searched with it. A drawing key the rules do not recognise is still a
    // drawing, marked loose: it may be a document id ("RB05_T01_D02") or a
    // drawing number ("D02") from a link typed by hand, and the opener looks
    // for it among the drawings rather than refusing it.
    // ------------------------------------------------------------
    function Na__LeShareLink__Parse(key) {
        const text = String(key == null ? '' : key).trim();
        if (!Na__LeShareLink__KEY_PATTERN.test(text)) return null;
        if (/^spec(ification)?$/i.test(text)) {
            return { kind : Na__LeShareLink__KIND_SPEC, key : Na__LeShareLink__KEY_SPEC, id : null, loose : false };
        }
        if (/^((document|drawing)[-_.]?)?register$/i.test(text)) {
            return { kind : Na__LeShareLink__KIND_REGISTER, key : Na__LeShareLink__KEY_REGISTER, id : null, loose : false };
        }
        let match = /^statement[-_.]?(\d{1,9})$/i.exec(text);
        if (match && parseInt(match[1], 10) > 0) {
            const id = parseInt(match[1], 10);
            return { kind : Na__LeShareLink__KIND_STATEMENT, key : Na__LeShareLink__PREFIX_STATEMENT + id, id : id, loose : false };
        }
        match = /^sheet[-_.]?(\d{1,9})$/i.exec(text);
        if (match) {
            const id = Na__LeShareLink__PREFIX_SHEET + match[1];
            return { kind : Na__LeShareLink__KIND_DRAWING, key : id, id : id, loose : false };
        }
        return { kind : Na__LeShareLink__KIND_DRAWING, key : text, id : null, loose : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Do Two Keys Name the Same Thing
    // ------------------------------------------------------------
    // Case never matters, and a sheet id's leading zeros never matter
    // ("Sheet_4" is "Sheet_004"), because both are the kind of thing a link
    // loses on its way through a person or a messaging app.
    // ------------------------------------------------------------
    function Na__LeShareLink__SameKey(left, right) {
        const a = Na__LeShareLink__Parse(left);
        const b = Na__LeShareLink__Parse(right);
        if (!a || !b || a.kind !== b.kind) return false;
        if (a.kind === Na__LeShareLink__KIND_DRAWING && !a.loose && !b.loose) {
            return parseInt(a.id.slice(Na__LeShareLink__PREFIX_SHEET.length), 10) === parseInt(b.id.slice(Na__LeShareLink__PREFIX_SHEET.length), 10);
        }
        return a.key.toLowerCase() === b.key.toLowerCase();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Addresses
// -----------------------------------------------------------------------------

    // FUNCTION | The Identity of the Project the Application Is Showing
    // ------------------------------------------------------------
    // { projectCode, projectFolder, year }, read off the address bar by the
    // loader's own functions. The code is upper-cased, because the indexes
    // that resolve a link are keyed that way ("rb05" in an address still
    // shares as "RB05").
    // ------------------------------------------------------------
    function Na__LeShareLink__CurrentProject() {
        const text = (value) => String(value === undefined || value === null ? '' : value).trim();
        const code = text(Na__AppUtils__GetProjectCodeFromUrl()).toUpperCase();
        return {
            projectCode   : Na__LeShareLink__CODE_PATTERN.test(code) ? code : '',
            projectFolder : text(Na__AppUtils__GetProjectFolderFromUrl()),
            year          : text(Na__AppUtils__GetYearFromUrl())
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Address That Opens One Document of One Project
    // ------------------------------------------------------------
    // link : { baseUrl, queryPattern }, from the config.
    // Returns '' when anything the pattern asks for is missing: a link that
    // opens nothing is worse than no link, because nobody finds out until the
    // person it was sent to tries it.
    // ------------------------------------------------------------
    function Na__LeShareLink__BuildUrl(link, projectCode, documentKey) {
        const setup   = (link && typeof link === 'object') ? link : {};
        const baseUrl = String(setup.baseUrl || '').trim();
        const pattern = String(setup.queryPattern || '');
        if (baseUrl === '') return '';
        const code = String(projectCode == null ? '' : projectCode).trim();
        const key  = String(documentKey == null ? '' : documentKey).trim();
        if (code !== '' && !Na__LeShareLink__CODE_PATTERN.test(code)) return '';
        if (key !== '' && !Na__LeShareLink__KEY_PATTERN.test(key)) return '';

        const tokens = [ [ '{projectCode}', code ], [ '{documentKey}', key ] ];
        let query = pattern;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i][0];
            if (query.indexOf(token) === -1) continue;
            if (tokens[i][1] === '') return '';                                  // <-- The pattern needs it and there is none: no link
            query = query.split(token).join(encodeURIComponent(tokens[i][1]));
        }
        return baseUrl + query;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Address of One Document of the Project on Screen ('' when none)
    // ------------------------------------------------------------
    // A project is only on screen when the loader has BOTH its code and its
    // folder (Na__AppFlow__LoadingSequence gates on the pair), so an address
    // bar with half a project on it shares nothing - exactly as the QR code
    // draws nothing for one.
    // ------------------------------------------------------------
    function Na__LeShareLink__UrlFor(target) {
        const project = Na__LeShareLink__CurrentProject();
        const key     = Na__LeShareLink__KeyFor(target);
        if (project.projectCode === '' || project.projectFolder === '' || key === '') return '';
        return Na__LeShareLink__BuildUrl(Na__LeShareLink__GetSetup().link, project.projectCode, key);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Document Key the App Was Opened With ('' when none)
    // ------------------------------------------------------------
    // The configured key first, then the built-in one, so renaming it in the
    // config can never strand a link already sent. A value that is not a key
    // is ignored, never guessed at.
    // ------------------------------------------------------------
    function Na__LeShareLink__ReadOpenParam() {
        if (typeof window === 'undefined' || !window.location) return '';
        let params = null;
        try { params = new URLSearchParams(window.location.search || ''); } catch (error) { return ''; }
        const names = [ Na__LeShareLink__GetSetup().link.openParam, Na__LeShareLink__OPEN_PARAM_FLOOR ];
        for (let i = 0; i < names.length; i++) {
            const value = String(params.get(names[i]) || '').trim();
            if (value !== '' && Na__LeShareLink__KEY_PATTERN.test(value)) return value;
        }
        return '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Document Sharing Links API
    // ------------------------------------------------------------
    export {
        Na__LeShareLink__KIND_DRAWING,
        Na__LeShareLink__KIND_SPEC,
        Na__LeShareLink__KIND_REGISTER,
        Na__LeShareLink__KIND_STATEMENT,
        Na__LeShareLink__KEY_SPEC,
        Na__LeShareLink__KEY_REGISTER,
        Na__LeShareLink__PREFIX_STATEMENT,
        Na__LeShareLink__PREFIX_SHEET,
        Na__LeShareLink__KEY_PATTERN,
        Na__LeShareLink__Ready,
        Na__LeShareLink__GetSetup,
        Na__LeShareLink__Label,
        Na__LeShareLink__KeyFor,
        Na__LeShareLink__Parse,
        Na__LeShareLink__SameKey,
        Na__LeShareLink__CurrentProject,
        Na__LeShareLink__BuildUrl,
        Na__LeShareLink__UrlFor,
        Na__LeShareLink__ReadOpenParam
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
