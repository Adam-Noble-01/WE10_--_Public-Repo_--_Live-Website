// =============================================================================
// TRUEVISION3D - PROJECT QR CODE - PROJECT LINK
// =============================================================================
//
// FILE       : Na__ProjectQr__ProjectLink__.js
// NAMESPACE  : Na__QrLink
// MODULE     : Project QR Code - Project Link
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the address a project's QR code carries
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Composes the address a scanned code opens: a base address plus a query
//   pattern with the project's identity filled in. Both come from
//   Na__ProjectQr__Config__.json; nothing in this file knows what they are.
// - The project is whichever one the application is showing, read off the
//   address bar by the same three functions the project loader uses, so the
//   code on a drawing cannot name a different project from the one drawn.
//
// INTEGRATION:
// - Read by Na__ProjectQr__Symbol__, which encodes what this returns.
//
// -----------------------------------------------------------------------------
//
// THE ADDRESS IS A SHORT ONE, AND A PAGE AT THE WEBSITE ROOT RESOLVES IT:
//     https://www.noble-architecture.com/q/?PS01
// q/index.html looks PS01 up in q/index.json and sends the phone on to
//     .../na-apps/30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26
// The long address is what the app answers; the short one is what is printed.
//
// WHY: the symbol's module count is decided by the address's length, and the
// printed module's size is what decides whether a phone reads it. The long
// address is 135 bytes - a 49 module symbol, which needed a 20 mm title block
// to print a readable module, and Adam judged that strip "too tall, too
// portrait-feeling, and stretched" (20-Sep-2026). The short one is 42 bytes,
// which is EXACTLY what a 29 module symbol holds: a readable 0.30 mm module in
// the 10 mm strip the drawings already had. There is not a character to spare,
// which is why the folder is one letter and the query is the bare code.
//
// THE ADDRESS IS THE LIVE ONE, NEVER THE ONE IN THE ADDRESS BAR:
// Drawings are authored and exported on localhost - the editor is read-only on
// the web - so window.location is exactly the address a printed code must NOT
// carry. A code reading http://localhost:8090/... works on the authoring
// machine and on no phone in the world. The host and path are therefore a
// config value, and only the project's identity is read off the address bar.
//
// A PRINTED CODE OUTLIVES EVERYTHING IN THIS REPOSITORY:
// A code on an issued drawing sits in a site bag or a planning file for years
// and has no idea anything moved on. So the q folder must never be moved,
// renamed or removed, and if the pattern printed here ever changes, the
// resolver must go on answering the old one. The resolver is also what keeps
// old paper alive when the APP moves: the TrueVision address lives in that one
// page, and changing it there re-points every code ever printed.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026), after the Lantern
//                   Designer's VghLantern__Terms__QrLink__.js, which learned
//                   both lessons first: the scanned address must open on a
//                   phone that has never seen this system, and its length is
//                   what decides whether the code can be read at all.
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - The link setup's base is baseUrl (it was liveAppUrl): it is the resolver's
//   address now, not the app's. BuildUrl itself is unchanged - the short
//   address is config, as the long one was.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
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
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Pattern Tokens
    // ------------------------------------------------------------
    const Na__QrLink__TOKEN_CODE   = '{projectCode}';
    const Na__QrLink__TOKEN_FOLDER = '{projectFolder}';
    const Na__QrLink__TOKEN_YEAR   = '{year}';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Identity of the Project the Application Is Showing
    // ------------------------------------------------------------
    // { projectCode, projectFolder, year }, each a trimmed string, empty when
    // the address bar does not carry it (the year never is: the loader
    // defaults it, and so does this).
    // ------------------------------------------------------------
    function Na__QrLink__CurrentProject() {
        const text = (value) => String(value === undefined || value === null ? '' : value).trim();
        return {
            projectCode   : text(Na__AppUtils__GetProjectCodeFromUrl()),
            projectFolder : text(Na__AppUtils__GetProjectFolderFromUrl()),
            year          : text(Na__AppUtils__GetYearFromUrl())
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Address a Project's Code Carries
    // ------------------------------------------------------------
    // link    : { baseUrl, queryPattern }, from the config.
    // project : { projectCode, projectFolder, year }.
    //
    // Returns an empty string when any token the pattern asks for has no
    // value, which the caller treats as "draw no code". A code that scans to a
    // broken address is worse than no code, because nobody finds out until
    // they are standing on site with it.
    // ------------------------------------------------------------
    function Na__QrLink__BuildUrl(link, project) {
        const setup   = (link && typeof link === 'object') ? link : {};
        const parts   = (project && typeof project === 'object') ? project : {};
        const baseUrl = String(setup.baseUrl || '').trim();
        const pattern = String(setup.queryPattern || '');
        if (baseUrl === '') return '';

        const tokens = [
            [ Na__QrLink__TOKEN_CODE,   parts.projectCode ],
            [ Na__QrLink__TOKEN_FOLDER, parts.projectFolder ],
            [ Na__QrLink__TOKEN_YEAR,   parts.year ]
        ];

        let query = pattern;
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i][0];
            if (query.indexOf(token) === -1) continue;
            const value = String(tokens[i][1] === undefined || tokens[i][1] === null ? '' : tokens[i][1]).trim();
            if (value === '') return '';                                         // <-- The pattern needs it and the project has none: no code
            query = query.split(token).join(encodeURIComponent(value));
        }
        return baseUrl + query;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Address the Code of the Project on Screen Carries
    // ------------------------------------------------------------
    // A project is only on screen when the loader has BOTH its code and its
    // folder (Na__AppFlow__LoadingSequence gates on the pair), so a short
    // pattern that names the code alone still draws nothing for an address
    // bar with half a project on it.
    // ------------------------------------------------------------
    function Na__QrLink__CurrentUrl(link) {
        const project = Na__QrLink__CurrentProject();
        if (project.projectCode === '' || project.projectFolder === '') return '';
        return Na__QrLink__BuildUrl(link, project);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project QR Code Project Link API
    // ------------------------------------------------------------
    export {
        Na__QrLink__CurrentProject,
        Na__QrLink__BuildUrl,
        Na__QrLink__CurrentUrl
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
