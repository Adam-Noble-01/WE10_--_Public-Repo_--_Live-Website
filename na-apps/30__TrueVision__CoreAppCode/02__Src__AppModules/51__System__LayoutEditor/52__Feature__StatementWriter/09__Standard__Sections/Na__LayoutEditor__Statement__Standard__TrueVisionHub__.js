// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - TRUEVISION HUB
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__TrueVisionHub__.js
// NAMESPACE  : Na__LeStmtHub
// MODULE     : Layout Editor - Statement Writer - Standard Section: TrueVision 3D Project Hub
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw the boxed section that sends a statement's reader into the project's live 3D model
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE ULTIMATE NUDGE. Adam, 29-Sep-2026: a standard section, switched on in
//   any statement, that makes it "seamlessly easy" to get from the page to the
//   project in TrueVision - and sells the hub while it does it: the 3D model
//   first and loudest, then the carousel for anyone wary of the controls, then
//   the drawings, the specification, the register and the statements, all in
//   any web browser with nothing to download. Built on the EB03 statement's
//   section 18.0, which did the same with a button and no code.
// - WHAT IT DRAWS, top to bottom: a navy band (kicker and title); the access
//   panel - the project's QR code beside a heading, a line of words, the
//   button that opens the project and a line of facts; then the quick
//   reference points, the lead paragraphs, four tiles in two rows and the
//   closing paragraph. The way in comes before the case for it, so a reader
//   who stops at the band still has it. Adam, 29-Sep-2026, over the second
//   cut: the band's strap line moved down to be a bold lead-in, and the
//   printed short address under the button went ("remove this"); over the
//   third, the lead-in "reads as one strangely structured sentence" - "make
//   them quick-reference bullet points". Four short points in two columns.
// - ITS OWN SECTION. Like every section of a statement it sits between two
//   major dividers; the registry puts them there when it is switched on and
//   keeps them there when it is moved. It lands after the Contents, or at the
//   top of the statement straight after the header's divider when there is
//   no Contents - the order Adam set for every statement: header, header
//   information, contents, this section, the introduction.
// - THE CODE IS THE DRAWINGS' CODE. The symbol comes from the Project QR Code
//   system (53__Feature__ProjectQrCode) exactly as the title block and the
//   Project Portal block get it: the same short address (/q/?RB05), the same
//   encoder, the same one-path SVG painter. Only its size and ink are this
//   section's: TrueVisionHub__QrSizeMm, laid out for an A4 page and reported
//   to CheckPrint like every other document's code, and the house navy
//   (#172b3a) the section is drawn in, with the Portal grey as the fallback.
// - THE BLUE SCHEME. Adam, 29-Sep-2026, over the first cut in olive: "don't use
//   the brown colour scheme ... use the new blue colour scheme that we use" -
//   the drawings' ink and the drawing register's tints and rules. And "remove
//   these little numbers": the tiles carry no 01 to 04.
// - NO SYMBOL, NO ACCESS PANEL. With no project on the address bar, or codes
//   switched off, the panel is left out entirely - a sentence telling people to
//   scan a code that is not there is worse than neither. The rest still draws.
// - WORDS LIVE IN THE CONFIG. Na__LayoutEditor__Statement__Standard__Config__.json
//   holds every sentence; this file mirrors them as built-in defaults so a
//   failed fetch still draws the section. Change the words there and every
//   statement carrying the section changes with them.
//
// INTEGRATION:
// - Registered with the standard sections registry
//   (Na__LayoutEditor__Statement__Standard__Registry__), which is the only
//   caller. Build() returns a string of HTML styled by the statement document
//   stylesheet's Standard Sections region.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026).
// - ValeVision    : not yet ported (ValeVision has no statement tab).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.1.0
// - The bold lead-in line is four quick-reference points (LeadInPoints).
// - The words are site-neutral: "from ground level and from a bird's-eye
//   view" in place of the street, the garden and the boundaries (Adam).
//
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Project QR Code System
    // ------------------------------------------------------------
    import { Na__ProjectQr__GetSymbol, Na__ProjectQr__GetUrl, Na__ProjectQr__GetSetup, Na__ProjectQr__CheckPrint }
        from '../../53__Feature__ProjectQrCode/Na__ProjectQr__Symbol__.js';
    import { Na__QrPaint__SvgDocument } from '../../53__Feature__ProjectQrCode/Na__ProjectQr__Painter__.js';
    import { Na__QrLink__CurrentProject } from '../../53__Feature__ProjectQrCode/Na__ProjectQr__ProjectLink__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtHub__ID     = 'TrueVisionHub';
    const Na__LeStmtHub__BLOCK  = 'StatementStandard__TrueVisionHub__Config';
    const Na__LeStmtHub__PREFIX = 'TrueVisionHub__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtHub__FALLBACKS = {
        Label                      : 'TrueVision 3D Project Hub',
        PlaceAfter                 : [ 'Standard:Contents', 'HeaderDivider' ],
        QrSizeMm                   : 28,
        QrDarkColour               : '#172b3a',
        KickerText                 : 'The Project Hub',
        TitleText                  : 'Explore This Proposal In TrueVision 3D',
        LeadInPoints               : [
            'The complete 3D model of {ProjectName}',
            'Every drawing and every document in one place',
            'Opens in any web browser',
            'Nothing to download or install'
        ],
        LeadParagraphs             : [
            'Every part of this proposal has been built as a complete three dimensional model and published through TrueVision 3D, Noble Architecture\'s own project platform. TrueVision is the single home of the whole project. The live model sits alongside a digital copy of every drawing in the pack, the drawing specification, the document register and this statement itself. There is nothing to download and nothing to install. It opens in seconds in any modern web browser on a phone, a tablet or a desktop computer.',
            'This is not a fixed fly through and it is not a reel of flattering viewpoints. The reader is in complete control. The model can be orbited, panned and zoomed without limit and viewed from any direction, both from ground level and from a bird\'s-eye view. It can be walked round at eye level or taken in whole from the air. Nothing is hidden and nothing is staged. Every roof plane, every eaves line and every elevation is there to be inspected at will.'
        ],
        Tiles                      : [
            { Heading : 'Walk Round It Freely',         Text : 'Orbit, pan and zoom round the whole scheme, or step down to eye level and walk through it in any direction you choose.' },
            { Heading : 'Or Simply Click Through',      Text : 'Not confident with 3D controls? A carousel of prepared scenes steps through the key views of the proposal one click at a time.' },
            { Heading : 'Every Drawing In Full Detail', Text : 'A digital copy of every sheet in the pack, sharp at any zoom and far closer than paper will ever allow.' },
            { Heading : 'Everything In One Place',      Text : 'Drawings, specification, document register and statements kept together, so nothing has to be hunted for.' }
        ],
        CloseParagraphs            : [
            'The value of this to anyone assessing the scheme is simple. Every claim this statement makes about scale massing and appearance can be confirmed with one\'s own eyes in a few unhurried minutes rather than taken from the page. Reading a building from flat elevations takes years of training. Walking round it in TrueVision takes seconds. There is no easier way to understand this proposal and no good reason to judge it from paper alone.'
        ],
        AccessHeadingText          : 'Scan To Step Inside The Model',
        AccessBodyText             : 'Point any phone camera at the code, or select the button. It opens {ProjectName} directly and can be returned to at any time.',
        ButtonText                 : 'Open {ProjectName} In TrueVision 3D',
        FactsText                  : 'Any web browser  ·  Nothing to download  ·  Phone, tablet or desktop',
        FallbackText               : 'Standard Section: TrueVision 3D Project Hub. It is drawn with the project\'s live link and QR code by TrueVision\'s Statement Writer; this line is all an editor without it can show.'
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtHub__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill the Tokens of One Piece of Text, Then Escape It
    // ------------------------------------------------------------
    // Two spaces either side of a middle dot are the house spacing for a run
    // of facts; HTML would fold them to one, so they are kept as en spaces.
    // ------------------------------------------------------------
    function Na__LeStmtHub__Words(text, project) {
        const filled = String(text || '')
            .split('{ProjectName}').join(project.name)
            .split('{ProjectCode}').join(project.code)
            .split('{ShortUrlText}').join(project.shortUrlText);
        return Na__LeStmtHub__Escape(filled).replace(/ {2}· {2}/g, '&ensp;&middot;&ensp;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    // config is the whole standard sections config (or null). A value of the
    // wrong type in the file is ignored for that key only.
    // ------------------------------------------------------------
    function Na__LeStmtHub__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtHub__BLOCK] && typeof config[Na__LeStmtHub__BLOCK] === 'object')
            ? config[Na__LeStmtHub__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtHub__FALLBACKS)) {
            const fallback = Na__LeStmtHub__FALLBACKS[key];
            const value    = block[Na__LeStmtHub__PREFIX + key];
            if (Array.isArray(fallback))            setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else if (typeof fallback === 'number')  setup[key] = Number.isFinite(value) && value > 0 ? value : fallback;
            else if (typeof fallback === 'boolean') setup[key] = typeof value === 'boolean' ? value : fallback;
            else                                    setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Project This Statement Belongs To
    // ------------------------------------------------------------
    // The name is the one the app shows in its title and install prompt
    // (TrueVision__Pwa__ProjectContext); a marker may override it with
    // data-na-std-name when the app's name for the project is not the one the
    // statement uses. The short address comes from the QR system, so the link
    // and the code can never disagree.
    // ------------------------------------------------------------
    function Na__LeStmtHub__Project(overrides) {
        const current = Na__QrLink__CurrentProject();
        const context = (typeof window !== 'undefined' && window.TrueVision__Pwa__ProjectContext && typeof window.TrueVision__Pwa__ProjectContext.get === 'function')
            ? window.TrueVision__Pwa__ProjectContext.get() : null;
        const override = overrides && typeof overrides.name === 'string' ? overrides.name.trim() : '';
        const appName  = context && typeof context.displayName === 'string' ? context.displayName.trim() : '';
        const code     = current.projectCode;
        const shortUrl = Na__ProjectQr__GetUrl();
        return {
            code         : code,
            name         : override || appName || code || 'this project',
            shortUrl     : shortUrl,
            shortUrlText : shortUrl.replace(/^https?:\/\/(www\.)?/i, '')
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // config    : the standard sections config, or null for the defaults.
    // overrides : { name } from the marker's attributes, or null.
    // ------------------------------------------------------------
    function Na__LeStmtHub__Build(config, overrides) {
        const setup   = Na__LeStmtHub__Setup(config);
        const project = Na__LeStmtHub__Project(overrides);
        const W       = (text) => Na__LeStmtHub__Words(text, project);
        const C       = 'na-le-stmt-std-tvh';

        const paragraphs = (list) => list.map((text) => '<p>' + W(text) + '</p>').join('');

        const tiles = setup.Tiles.slice(0, 4).map((tile) =>
            '<div class="' + C + '__tile">' +
                '<div class="' + C + '__tile-heading">' + W(tile && tile.Heading) + '</div>' +
                '<div class="' + C + '__tile-text">' + W(tile && tile.Text) + '</div>' +
            '</div>').join('');

        // The access panel draws only with a code to scan and an address to open.
        const symbol = Na__ProjectQr__GetSymbol();
        let access = '';
        if (symbol && project.shortUrl !== '') {
            const qrSetup = Na__ProjectQr__GetSetup().symbol;
            const quiet   = qrSetup.quietZoneModules;
            const sizeMm  = setup.QrSizeMm;
            const boxMm   = sizeMm * (symbol.Size + quiet * 2) / symbol.Size;       // <-- The SVG carries its quiet zone in its own viewBox
            Na__ProjectQr__CheckPrint(symbol, sizeMm, sizeMm * quiet / symbol.Size, 'Statement TrueVision hub');
            const svg = Na__QrPaint__SvgDocument(symbol, {
                darkColour   : /^#[0-9a-f]{6}$/i.test(setup.QrDarkColour) ? setup.QrDarkColour : qrSetup.portalDarkColour,
                lightColour  : qrSetup.lightColour,
                quietModules : quiet,
                cssClass     : C + '__qr-svg',
                title        : 'QR code: ' + project.shortUrlText
            });
            const href = Na__LeStmtHub__Escape(project.shortUrl);
            access =
                '<div class="' + C + '__access">' +
                    '<a class="' + C + '__qr" href="' + href + '" style="width:' + boxMm.toFixed(2) + 'mm; height:' + boxMm.toFixed(2) + 'mm;">' + svg + '</a>' +
                    '<div class="' + C + '__cta">' +
                        '<div class="' + C + '__cta-heading">' + W(setup.AccessHeadingText) + '</div>' +
                        '<div class="' + C + '__cta-text">' + W(setup.AccessBodyText) + '</div>' +
                        '<a class="' + C + '__button" href="' + href + '">' + W(setup.ButtonText) + '</a>' +
                        '<div class="' + C + '__facts">' + W(setup.FactsText) + '</div>' +
                    '</div>' +
                '</div>';
        }

        return '<section class="na-le-stmt-std ' + C + '">' +
                   '<div class="' + C + '__band">' +
                       '<div class="' + C + '__kicker">' + W(setup.KickerText) + '</div>' +
                       '<h3 class="' + C + '__title">' + W(setup.TitleText) + '</h3>' +
                   '</div>' +
                   '<div class="' + C + '__body">' +
                       access +                                                 // <-- The way in comes first: a reader who reads nothing else still finds it
                       '<ul class="' + C + '__points">' + setup.LeadInPoints.map((point) => '<li>' + W(point) + '</li>').join('') + '</ul>' +
                       paragraphs(setup.LeadParagraphs) +
                       '<div class="' + C + '__tiles">' + tiles + '</div>' +
                       paragraphs(setup.CloseParagraphs) +
                   '</div>' +
               '</section>';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtHub__Definition() {
        return {
            Id            : Na__LeStmtHub__ID,
            Label         : (config) => Na__LeStmtHub__Setup(config).Label,
            Fallback      : (config) => Na__LeStmtHub__Setup(config).FallbackText,
            PlaceAfter    : (config) => Na__LeStmtHub__Setup(config).PlaceAfter,
            ContentsTitle : (config) => Na__LeStmtHub__Setup(config).TitleText,
            Build         : Na__LeStmtHub__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: TrueVision 3D Project Hub
    // ------------------------------------------------------------
    export {
        Na__LeStmtHub__ID,
        Na__LeStmtHub__Build,
        Na__LeStmtHub__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
