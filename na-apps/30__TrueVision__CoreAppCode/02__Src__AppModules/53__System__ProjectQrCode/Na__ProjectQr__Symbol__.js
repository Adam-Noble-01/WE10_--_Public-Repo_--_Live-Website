// =============================================================================
// TRUEVISION3D - PROJECT QR CODE - SYMBOL
// =============================================================================
//
// FILE       : Na__ProjectQr__Symbol__.js
// NAMESPACE  : Na__ProjectQr
// MODULE     : Project QR Code - Symbol
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hand any document the QR symbol of the project on screen, and the words that go with it
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE ONE DOOR INTO THIS SYSTEM. A document that wants the project's code
//   asks GetSymbol for it and paints what it is given, through
//   Na__ProjectQr__Painter__ or the sheet chrome's 'qr' primitive. It never
//   builds an address and never encodes anything itself, so every document in
//   a pack carries the identical symbol.
// - ONE SYMBOL PER PROJECT, encoded once. The symbol is cached against the
//   address it was made from, so a sheet repainting on every pointer move is
//   reading a field, not running Reed-Solomon.
// - NO PROJECT, NO SYMBOL. With nothing on the address bar to name a project,
//   or with the system switched off, GetSymbol answers null and a document
//   draws neither the code nor the note that tells people to scan it.
// - THE CODE CARRIES A SHORT ADDRESS, /q/?PS01, which a page at the website
//   root resolves through an index the ProjectVision build script writes. On
//   the authoring machine that index is read once per project, and a project
//   missing from it - or listed under another folder or year - is reported,
//   because a drawing exported then would carry a code that opens nothing.
// - Owns Na__ProjectQr__Config__.json. The fallbacks mirror the shipped file,
//   so a failed fetch degrades to a working code rather than a missing one.
//   The fetch starts when this module is first imported and never rejects;
//   na-projectqr-ready goes out when it lands, for a sheet already on screen.
//
// INTEGRATION:
// - Na__LayoutEditor__TitleBlock__Modern__ draws the symbol and the note in the
//   title block's right-hand cell, which puts it on the screen sheet, in the
//   web viewer and in every exported drawing PDF at once.
// - Next: the Drawing Register PDF (raw jsPDF: Na__QrPaint__DrawPdf) and the
//   Project Specification (chrome primitive in its PDF, Na__QrPaint__SvgDocument
//   in its HTML reading view). See README__ProjectQrCode__.md.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026).
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - The code carries the resolver's short address (Link BaseUrl and
//   QueryPattern; LiveAppUrl is gone): a 29 module symbol for a 49 module one.
// - VerifyEntry, and the check GetSymbol starts on the authoring machine: the
//   project on screen has to be in the resolver's index, under the folder and
//   year it is being drawn from.
// - GetNote answers compact, the caption for a place with room for the code
//   and a few words and no more.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Encoder, the Project's Address and Where the App Is Running
    // ------------------------------------------------------------
    import { Na__QrEnc__Encode } from './Na__ProjectQr__Encoder__.js';
    import { Na__QrLink__CurrentUrl, Na__QrLink__CurrentProject } from './Na__ProjectQr__ProjectLink__.js';
    import { Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Key Prefix and the Ready Event
    // ------------------------------------------------------------
    const Na__ProjectQr__ConfigUrl   = new URL('./Na__ProjectQr__Config__.json', import.meta.url);
    const Na__ProjectQr__PREFIX      = 'ProjectQr__';
    const Na__ProjectQr__READY_EVENT = 'na-projectqr-ready';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks (mirror the shipped JSON)
    // ------------------------------------------------------------
    const Na__ProjectQr__FALLBACKS = Object.freeze({
        baseUrl             : 'https://www.noble-architecture.com/q/',             // <-- The resolver at the website root, never the address bar: drawings are made on localhost
        queryPattern        : '?{projectCode}',                                  // <-- 42 bytes with the base: exactly a 29 module symbol, and not a character to spare
        indexUrl            : '../../../../q/index.json',                        // <-- The resolver's index, relative to this folder; the ProjectVision build script writes it
        darkColour          : '#000000',                                         // <-- Black, not the sheet's ink: a mono laser screens a colour and prints black solid
        lightColour         : '#ffffff',
        quietZoneModules    : 2,                                                 // <-- What a document sizes its code from: Lantern Designer's 0.6 mm in a 10 mm strip
        minModuleMm         : 0.28,
        headingText         : 'Navigate This Building in 3D',
        bodyText            : 'Scan this {document} to enter the 3D model and view the building in full 3D, and to freely navigate and take a tour.',
        compactText         : '3D Model',                                        // <-- All there is room for where a document can spare the code a caption and no more
        defaultDocumentNoun : 'drawing'
    });
    const Na__ProjectQr__NOUN_TOKEN = '{document}';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config, the Cached Symbol, What Has Been Warned About and What Has Been Checked
    // ------------------------------------------------------------
    let   Na__ProjectQr__Config      = null;
    let   Na__ProjectQr__LoadPromise = null;
    let   Na__ProjectQr__Cached      = { url : null, symbol : null };           // <-- url null: nothing encoded yet. symbol null with a url: that address would not encode
    const Na__ProjectQr__Warned      = new Set();
    const Na__ProjectQr__Verified    = new Map();                               // <-- project code -> the promise of its index check, so a project is looked up once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Value From a Block (fallback when absent)
    // ------------------------------------------------------------
    function Na__ProjectQr__Val(blockName, keyName, fallback) {
        const block = Na__ProjectQr__Config ? Na__ProjectQr__Config[Na__ProjectQr__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__ProjectQr__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    function Na__ProjectQr__Num(blockName, keyName, fallback) {
        const value = Na__ProjectQr__Val(blockName, keyName, undefined);
        return (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : fallback;
    }
    function Na__ProjectQr__Text(blockName, keyName, fallback) {
        const value = Na__ProjectQr__Val(blockName, keyName, undefined);
        return (typeof value === 'string' && value.trim() !== '') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing or broken file is the built-in defaults, not a
    // drawing without its code. Resolves true when the file was read.
    // ------------------------------------------------------------
    function Na__ProjectQr__Ready() {
        if (!Na__ProjectQr__LoadPromise) {
            Na__ProjectQr__LoadPromise = (async () => {
                let landed = false;
                try {
                    const response = await fetch(Na__ProjectQr__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__ProjectQr__Config = await response.json();
                    landed = true;
                } catch (error) {
                    console.warn('[TrueVision3D ProjectQr] Config unreadable - using built-in defaults.', error);
                    Na__ProjectQr__Config = null;
                }
                // A sheet painted before this landed drew the defaults. They
                // mirror the file, so this repaint changes nothing unless the
                // file has been edited - which is exactly when it matters.
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                    window.dispatchEvent(new CustomEvent(Na__ProjectQr__READY_EVENT, { detail : { landed : landed } }));
                }
                return landed;
            })();
        }
        return Na__ProjectQr__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether Codes Are Drawn at All
    // ------------------------------------------------------------
    function Na__ProjectQr__IsEnabled() {
        return !Na__ProjectQr__Config || Na__ProjectQr__Config[Na__ProjectQr__PREFIX + 'Enabled'] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Setup
    // ------------------------------------------------------------
    function Na__ProjectQr__GetSetup() {
        const F = Na__ProjectQr__FALLBACKS;
        const indexUrl = Na__ProjectQr__Val('Link', 'IndexUrl', F.indexUrl);
        return {
            enabled : Na__ProjectQr__IsEnabled(),
            link    : {
                baseUrl      : Na__ProjectQr__Text('Link', 'BaseUrl', F.baseUrl),
                queryPattern : Na__ProjectQr__Text('Link', 'QueryPattern', F.queryPattern),
                indexUrl     : (typeof indexUrl === 'string') ? indexUrl.trim() : F.indexUrl   // <-- An empty string is an answer: no index, no check
            },
            symbol  : {
                darkColour       : Na__ProjectQr__Text('Symbol', 'DarkColour', F.darkColour),
                lightColour      : Na__ProjectQr__Text('Symbol', 'LightColour', F.lightColour),
                quietZoneModules : Na__ProjectQr__Num('Symbol', 'QuietZoneModules', F.quietZoneModules),
                minModuleMm      : Na__ProjectQr__Num('Symbol', 'MinModuleMm', F.minModuleMm)
            },
            note    : {
                headingText         : Na__ProjectQr__Text('Note', 'HeadingText', F.headingText),
                bodyText            : Na__ProjectQr__Text('Note', 'BodyText', F.bodyText),
                compactText         : Na__ProjectQr__Text('Note', 'CompactText', F.compactText),
                defaultDocumentNoun : Na__ProjectQr__Text('Note', 'DefaultDocumentNoun', F.defaultDocumentNoun)
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Resolver's Index
// -----------------------------------------------------------------------------

    // FUNCTION | Check the Project on Screen Against the Resolver's Index
    // ------------------------------------------------------------
    // Resolves { ok, code, reason }. ok is true when the index lists this
    // project's code under the very folder and year it is being drawn from -
    // which is what the scanned code will open - and also when there is nothing
    // to check (no project, or no index configured). Never rejects.
    //
    // A project is looked up once per page: the index only changes when the
    // build script runs, and a drawing session does not outlive many of those.
    // ------------------------------------------------------------
    function Na__ProjectQr__VerifyEntry() {
        const project  = Na__QrLink__CurrentProject();
        const indexUrl = Na__ProjectQr__GetSetup().link.indexUrl;
        if (project.projectCode === '' || indexUrl === '') return Promise.resolve({ ok : true, code : project.projectCode, reason : 'nothing to check' });
        if (Na__ProjectQr__Verified.has(project.projectCode)) return Na__ProjectQr__Verified.get(project.projectCode);

        const check = (async () => {
            const code = project.projectCode;
            const fail = (reason) => {
                console.warn('[TrueVision3D ProjectQr] ' + code + ': ' + reason + ' The QR code on this project\'s drawings will not open its model. ' +
                             'Run ProjectVision__BuildScript__.py (or with --qr-index-only) and publish the q folder.');
                return { ok : false, code : code, reason : reason };
            };
            try {
                const response = await fetch(new URL(indexUrl, import.meta.url), { cache : 'no-store' });
                if (!response.ok) return fail('the resolver index could not be read (HTTP ' + response.status + ').');
                const index = await response.json();
                const entry = index && index.projects ? index.projects[code] : null;
                if (!entry) return fail('it is not in the resolver index (q/index.json).');
                if (String(entry.projectFolder) !== project.projectFolder || String(entry.projectYear) !== project.year) {
                    // Worded so no quote follows the word "from": the module graph
                    // verifier reads that pair as an import specifier, in any string.
                    const listed  = entry.projectYear + '-Projects/' + entry.projectFolder;
                    const onSheet = project.year + '-Projects/' + project.projectFolder;
                    return fail('the resolver index lists it as ' + listed + ', but the project open here is ' + onSheet + '.');
                }
                return { ok : true, code : code, reason : 'listed' };
            } catch (error) {
                return fail('the resolver index could not be read (' + (error && error.message ? error.message : 'unknown error') + ').');
            }
        })();
        Na__ProjectQr__Verified.set(project.projectCode, check);
        return check;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Symbol and Its Note
// -----------------------------------------------------------------------------

    // FUNCTION | The Short Address of the Project on Screen ('' when there is none)
    // ------------------------------------------------------------
    function Na__ProjectQr__GetUrl() {
        if (!Na__ProjectQr__IsEnabled()) return '';
        return Na__QrLink__CurrentUrl(Na__ProjectQr__GetSetup().link);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Symbol of the Project on Screen (null when there is none)
    // ------------------------------------------------------------
    // { Text, Version, Size, Modules, Runs } from the encoder. The same object
    // comes back until the address changes, so a caller may compare by identity.
    // ------------------------------------------------------------
    function Na__ProjectQr__GetSymbol() {
        const url = Na__ProjectQr__GetUrl();
        if (url === '') return null;
        if (Na__ProjectQr__Cached.url !== url) {
            Na__ProjectQr__Cached = { url : url, symbol : Na__QrEnc__Encode(url) };   // <-- null when the address is too long; the encoder has said so
            // Drawings are made on the authoring machine, so that is where a
            // project missing from the index has to be caught: before a sheet is
            // exported, not by a client on site. The web viewer has no use for it.
            if (Na__AppUtils__IsRunningOnLocalhost()) void Na__ProjectQr__VerifyEntry();
        }
        return Na__ProjectQr__Cached.symbol;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Words That Go Beside the Code
    // ------------------------------------------------------------
    // documentNoun is what the reader is holding - 'drawing register',
    // 'specification'. A drawing sheet passes nothing. compact is the caption
    // for a place with room for the code and a few words and no more.
    // ------------------------------------------------------------
    function Na__ProjectQr__GetNote(documentNoun) {
        const note = Na__ProjectQr__GetSetup().note;
        const noun = (typeof documentNoun === 'string' && documentNoun.trim() !== '') ? documentNoun.trim() : note.defaultDocumentNoun;
        return {
            heading : note.headingText,
            body    : note.bodyText.split(Na__ProjectQr__NOUN_TOKEN).join(noun),
            compact : note.compactText
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Check a Printed Size Against What a Phone Can Read
    // ------------------------------------------------------------
    // A document that lays the symbol out reports the square it drew and the
    // clear paper it left round it, both in millimetres. Returns
    // { moduleMm, quietModules, ok }, and says so on the console - once per
    // document and symbol size - when either is under the config's floor.
    //
    // This is the guard on every future change that does not know it is
    // touching the code: a title block made lower, a cell made narrower, a
    // project code given a fifth character. Each shrinks the module silently,
    // and the first anyone would otherwise hear of it is a client on site whose
    // phone will not read the drawing.
    // ------------------------------------------------------------
    function Na__ProjectQr__CheckPrint(symbol, sizeMm, marginMm, where) {
        if (!symbol || !(symbol.Size > 0) || !(sizeMm > 0)) return { moduleMm : 0, quietModules : 0, ok : false };
        const limits       = Na__ProjectQr__GetSetup().symbol;
        const moduleMm     = sizeMm / symbol.Size;
        const quietModules = (Number.isFinite(marginMm) && marginMm > 0) ? marginMm / moduleMm : 0;
        const smallModule  = moduleMm + 1e-9 < limits.minModuleMm;
        const thinMargin   = quietModules + 1e-9 < limits.quietZoneModules;
        const ok           = !smallModule && !thinMargin;

        if (!ok) {
            const key = String(where || 'document') + '|' + symbol.Size + '|' + sizeMm.toFixed(2) + '|' + (marginMm || 0).toFixed(2);
            if (!Na__ProjectQr__Warned.has(key)) {
                Na__ProjectQr__Warned.add(key);
                const parts = [];
                if (smallModule) parts.push('the module prints at ' + moduleMm.toFixed(3) + ' mm, under the ' + limits.minModuleMm + ' mm floor - it needs a ' +
                                            (limits.minModuleMm * symbol.Size).toFixed(1) + ' mm square for this ' + symbol.Size + ' module symbol');
                if (thinMargin)  parts.push('the clear margin is ' + quietModules.toFixed(1) + ' modules, under the ' + limits.quietZoneModules + ' asked for');
                console.warn('[TrueVision3D ProjectQr] ' + String(where || 'A document') + ': ' + parts.join('; ') + '. A phone may not read it.');
            }
        }
        return { moduleMm : moduleMm, quietModules : quietModules, ok : ok };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Start
// -----------------------------------------------------------------------------

    // The config is small and every consumer wants it, so it is asked for as
    // soon as anything imports this module rather than by each of them.
    void Na__ProjectQr__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project QR Code Symbol API
    // ------------------------------------------------------------
    export {
        Na__ProjectQr__READY_EVENT,
        Na__ProjectQr__Ready,
        Na__ProjectQr__IsEnabled,
        Na__ProjectQr__GetSetup,
        Na__ProjectQr__GetUrl,
        Na__ProjectQr__GetSymbol,
        Na__ProjectQr__GetNote,
        Na__ProjectQr__VerifyEntry,
        Na__ProjectQr__CheckPrint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
