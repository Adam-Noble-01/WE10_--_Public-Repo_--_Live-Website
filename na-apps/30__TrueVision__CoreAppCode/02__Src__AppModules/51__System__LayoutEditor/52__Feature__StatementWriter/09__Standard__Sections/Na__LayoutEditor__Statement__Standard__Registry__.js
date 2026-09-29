// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTIONS - REGISTRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__Registry__.js
// NAMESPACE  : Na__LeStmtStd
// MODULE     : Layout Editor - Statement Writer - Standard Sections Registry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one list of standard sections, the marker that stands for each in the markdown, where each lands, and its expansion
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHAT A STANDARD SECTION IS. Something every statement may carry, switched
//   on from edit mode, placed automatically and drawn by the app. Adam,
//   29-Sep-2026: "a subsystem that handles these kinds of bespoke but general
//   things that will crop up on each job". Three so far, in the order a
//   statement always opens (Adam: "1. the header, 2. all of that important
//   header information, 3. the table of contents, 4. the TrueVision section,
//   5. the introduction"):
//     DocumentHeader - the logo, title and header fields, in spacing of its own
//     Contents       - drawn from the statement's own headings, never stale
//     TrueVisionHub  - the project's QR code, link and the case for using them
// - ONE MARKER IN THE FILE. A standard section is stored as
//       <div class="na-le-stmt-std-marker" data-na-standard-section="TrueVisionHub">Fallback sentence.</div>
//   and nothing else - or, for a section with words of its own (the header),
//   that div with the words on the lines between its tags. The tokeniser reads
//   it as one raw HTML block, so the editor freezes it and serialises it as it
//   does a picture, and the file still round-trips byte for byte.
// - DRAWN FRESH EVERY TIME. The renderer hands every raw HTML block to the
//   expander this module registers, with the statement's own blocks as
//   context; a marker comes back as its section, built from the config and
//   the project on screen. One sentence improved in the config reaches every
//   statement carrying the section; the Contents always matches the headings.
// - EACH IS ITS OWN SECTION, between two major dividers (Adam: "an HR above
//   and below it in my standard HR style"). Switching a section on puts it
//   straight after the divider its placement names and adds a divider under
//   it unless one is already there; switching it off takes that divider away
//   again, so on and off leave the file as it was. The editor's Move keeps
//   the same rule when a section is dragged.
// - PLACEMENT, tried in order per section (PlaceAfter):
//     'Top'           - the very top of the file
//     'HeaderDivider' - the first major divider above the first numbered
//                       section: the one that closes the header
//     'Standard:<Id>' - after that standard section and the divider under it
//   then, failing all of them, just above the first numbered section, and
//   failing that, the end of the file.
//
// INTEGRATION:
// - Registers its expander with Na__LayoutEditor__Statement__Md__Render__ on
//   import. Imported by the Statement Writer page (for the menu), the editor
//   (switching on and off, the document source for redraws) and the cards
//   (whether a section may move), and by the tests.
// - A section module hands over a definition: { Id, Label, Fallback,
//   PlaceAfter, ContentsTitle, Build, and optionally NewBody, Unit ('none'
//   for no divider of its own), Movable, DependsOnDocument, Adopt, Unwrap }.
//   Adding one is a new file and one line in Na__LeStmtStd__DEFINITIONS.
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
// - Document Header and Contents join the TrueVision 3D Project Hub.
// - Every section is placed between major dividers, by named anchors, on the
//   tokeniser's blocks; the hub now lands after the Contents.
// - Expanders get the statement's blocks as context (the Contents lists the
//   headings from them); a page can register a document source for redraws
//   made outside a full render.
//
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation, with the TrueVision 3D Project Hub.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Markdown Engine and the Sections Themselves
    // ------------------------------------------------------------
    import { Na__LeStmtRnd__RegisterExpander } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtMd__Tokenise, Na__LeStmtMd__Join, Na__LeStmtMd__TrailingBlanks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtHead__Definition } from './Na__LayoutEditor__Statement__Standard__Header__.js';
    import { Na__LeStmtToc__Definition } from './Na__LayoutEditor__Statement__Standard__Contents__.js';
    import { Na__LeStmtHub__Definition } from './Na__LayoutEditor__Statement__Standard__TrueVisionHub__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Every Standard Section, in Menu (and Document) Order
    // ------------------------------------------------------------
    const Na__LeStmtStd__DEFINITIONS = [
        Na__LeStmtHead__Definition(),
        Na__LeStmtToc__Definition(),
        Na__LeStmtHub__Definition()
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Config File and the Event Raised When It Lands
    // ------------------------------------------------------------
    const Na__LeStmtStd__CONFIG_URL  = new URL('./Na__LayoutEditor__Statement__Standard__Config__.json', import.meta.url);
    const Na__LeStmtStd__READY_EVENT = 'na-le-stmt-std:ready';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | How a Marker and a Divider Are Recognised
    // ------------------------------------------------------------
    // A block is a marker only when it OPENS with the div that carries the
    // attribute, so a writer's own HTML that merely mentions it is left alone.
    // ------------------------------------------------------------
    const Na__LeStmtStd__MARKER_OPEN = /^\s*<div\b[^>]*\bdata-na-standard-section\s*=\s*"([A-Za-z0-9_-]+)"[^>]*>/i;
    const Na__LeStmtStd__NAME_ATTR   = /\bdata-na-std-name\s*=\s*"([^"]*)"/i;
    const Na__LeStmtStd__DIVIDER     = /^<div style=" \/\* \| - - - .*Horizontal Page Divider Line/;
    const Na__LeStmtStd__NUMBERED    = /^\d+\.0\s*\|/;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The House Major Divider, for a Statement That Has None to Copy
    // ------------------------------------------------------------
    const Na__LeStmtStd__DIVIDER_LINES = [
        '<div style=" /* | - - - - - - - - - - - -->|  Horizontal Page Divider Line   |<-- - - - - - - - - - - - - - - - -|  */ ',
        '    text-align           :     center;    ',
        '    padding-top          :    05.00mm;    /*  <--- Space Above The Divider Line  */',
        '    padding-bottom       :    05.00mm;    /*  <--- Space Below The Divider Line  */',
        '    margin-top           :    00.00mm;    ',
        '    margin-bottom        :    00.00mm;    ',
        '    ">                                   ',
        '    <div style="                         ',
        '        width            :       100%;    ',
        '        border-style     :      solid;    ',
        '        border-width     :     0.01pt;    ',
        '        border-color     :    #ebebeb;    ',
        '        ">                               ',
        '    </div>                                ',
        '</div>  '
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Config, Once Read, and Where the Document Comes From
    // ------------------------------------------------------------
    let Na__LeStmtStd__Config      = null;
    let Na__LeStmtStd__LoadPromise = null;
    let Na__LeStmtStd__DocSource   = null;                                     // <-- () => blocks, for a redraw made outside a full render
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Definition by Its Id
    // ------------------------------------------------------------
    function Na__LeStmtStd__Find(id) {
        return Na__LeStmtStd__DEFINITIONS.find((definition) => definition.Id === id) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape and Unescape Text in a Marker
    // ------------------------------------------------------------
    function Na__LeStmtStd__Escape(text) {
        return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function Na__LeStmtStd__Unescape(text) {
        return String(text || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Words Between a Marker's Tags
    // ------------------------------------------------------------
    function Na__LeStmtStd__Body(html) {
        const text  = String(html || '');
        const open  = Na__LeStmtStd__MARKER_OPEN.exec(text);
        const close = text.lastIndexOf('</div>');
        if (!open || close < 0) return '';
        return Na__LeStmtStd__Unescape(text.slice(open.index + open[0].length, close)).replace(/^\n/, '').replace(/\n$/, '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Kind of Block This Is
    // ------------------------------------------------------------
    function Na__LeStmtStd__IsDivider(block) {
        return !!block && block.Kind === 'html' && Na__LeStmtStd__DIVIDER.test(block.Html || '');
    }
    function Na__LeStmtStd__MarkerId(block) {
        return block && block.Kind === 'html' ? Na__LeStmtStd__Detect(block.Html) : null;
    }
    function Na__LeStmtStd__IsNumbered(block) {
        return !!block && block.Kind === 'heading' && block.Level === 3 && Na__LeStmtStd__NUMBERED.test(String(block.Text || '').trim());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A New Block From Its Lines
    // ------------------------------------------------------------
    // Always one blank line under it, so it never glues to what follows.
    // ------------------------------------------------------------
    function Na__LeStmtStd__NewBlock(lines) {
        const html = lines.join('\n');
        return { Kind : 'html', Lines : [ ...lines, '' ], Html : html };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make a Block End With a Blank Line
    // ------------------------------------------------------------
    function Na__LeStmtStd__EndWithBlank(block) {
        if (block && Array.isArray(block.Lines) && Na__LeStmtMd__TrailingBlanks(block) === 0) block.Lines.push('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Divider This Statement Uses, as Lines
    // ------------------------------------------------------------
    // Copied from the statement's own first divider, so a new one matches its
    // neighbours to the byte; the house divider when there is none.
    // ------------------------------------------------------------
    function Na__LeStmtStd__DividerLines(blocks) {
        const first = blocks.find(Na__LeStmtStd__IsDivider);
        return first ? String(first.Html).split('\n') : Na__LeStmtStd__DIVIDER_LINES.slice();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve One Placement Anchor to "Insert After Block N"
    // ------------------------------------------------------------
    // Returns the index of the block to insert after, -1 for the very top, or
    // null when the anchor is not in this statement.
    // ------------------------------------------------------------
    function Na__LeStmtStd__Anchor(blocks, anchor) {
        if (anchor === 'Top') {
            let at = -1;
            while (at + 1 < blocks.length && (blocks[at + 1].Kind === 'frontmatter' || blocks[at + 1].Kind === 'blank')) at++;
            return at;
        }
        const first = blocks.findIndex(Na__LeStmtStd__IsNumbered);
        if (anchor === 'HeaderDivider') {
            const limit = first === -1 ? blocks.length : first;
            for (let i = 0; i < limit; i++) if (Na__LeStmtStd__IsDivider(blocks[i])) return i;
            return null;
        }
        const standard = /^Standard:(.+)$/.exec(String(anchor || ''));
        if (standard) {
            const at = blocks.findIndex((block) => Na__LeStmtStd__MarkerId(block) === standard[1]);
            if (at === -1) return null;
            return Na__LeStmtStd__IsDivider(blocks[at + 1]) ? at + 1 : at;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Config, Menu and Document Source
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Config Once
    // ------------------------------------------------------------
    // Never rejects. Resolves true when the file was read. Raises
    // na-le-stmt-std:ready on window either way, so a page that drew before
    // the words landed can draw again.
    // ------------------------------------------------------------
    function Na__LeStmtStd__Ready() {
        if (!Na__LeStmtStd__LoadPromise) {
            Na__LeStmtStd__LoadPromise = (async () => {
                let landed = false;
                try {
                    const response = await fetch(Na__LeStmtStd__CONFIG_URL, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeStmtStd__Config = await response.json();
                    landed = true;
                } catch (error) {
                    console.warn('[TrueVision3D Statement] Standard sections config unreadable - using the built-in words.', error);
                    Na__LeStmtStd__Config = null;
                }
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                    window.dispatchEvent(new CustomEvent(Na__LeStmtStd__READY_EVENT, { detail : { landed : landed } }));
                }
                return landed;
            })();
        }
        return Na__LeStmtStd__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Standard Section, for a Menu
    // ------------------------------------------------------------
    // [{ Id, Label, Movable }] in menu order.
    // ------------------------------------------------------------
    function Na__LeStmtStd__List() {
        return Na__LeStmtStd__DEFINITIONS.map((definition) => ({
            Id      : definition.Id,
            Label   : definition.Label(Na__LeStmtStd__Config),
            Movable : definition.Movable !== false
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Section May Be Dragged, and Whether It Follows the Document
    // ------------------------------------------------------------
    function Na__LeStmtStd__IsMovable(id) {
        const definition = Na__LeStmtStd__Find(id);
        return !!definition && definition.Movable !== false;
    }
    function Na__LeStmtStd__DependsOnDocument(id) {
        const definition = Na__LeStmtStd__Find(id);
        return !!definition && definition.DependsOnDocument === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Redraw Outside a Full Render Reads the Document From
    // ------------------------------------------------------------
    // fn() returns the statement's tokenised blocks. The editor registers one
    // so a Contents card redrawn after typing lists the headings as they are.
    // ------------------------------------------------------------
    function Na__LeStmtStd__SetDocumentSource(fn) {
        Na__LeStmtStd__DocSource = (typeof fn === 'function') ? fn : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Markers
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Section a Raw HTML Block Stands For (null when none)
    // ------------------------------------------------------------
    function Na__LeStmtStd__Detect(html) {
        const match = Na__LeStmtStd__MARKER_OPEN.exec(String(html || ''));
        return match && Na__LeStmtStd__Find(match[1]) ? match[1] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Marker That Stands for a Section in the Markdown
    // ------------------------------------------------------------
    // body: the section's own words (the header's fields), written on the
    // lines between the tags. Without one the fallback sentence goes inside.
    // ------------------------------------------------------------
    function Na__LeStmtStd__MarkerLine(id, body) {
        const definition = Na__LeStmtStd__Find(id);
        if (!definition) return '';
        const open = '<div class="na-le-stmt-std-marker" data-na-standard-section="' + id + '">';
        if (typeof body === 'string' && body.trim() !== '') {
            const lines = body.split('\n').filter((line) => line.trim() !== '');   // <-- A blank line would end the block in Typora
            return open + '\n' + Na__LeStmtStd__Escape(lines.join('\n')) + '\n</div>';
        }
        return open + Na__LeStmtStd__Escape(definition.Fallback(Na__LeStmtStd__Config)) + '</div>';
    }
    // ------------------------------------------------------------


    // FUNCTION | Expand a Raw HTML Block (the renderer's hook)
    // ------------------------------------------------------------
    // Returns { Id, Html } for a marker, null for anything else. context:
    // { Blocks } from the renderer; without it the document source is asked.
    // ------------------------------------------------------------
    function Na__LeStmtStd__Expand(html, context) {
        const id = Na__LeStmtStd__Detect(html);
        if (!id) return null;
        const open   = Na__LeStmtStd__MARKER_OPEN.exec(String(html))[0];
        const name   = Na__LeStmtStd__NAME_ATTR.exec(open);
        const blocks = (context && Array.isArray(context.Blocks)) ? context.Blocks
                     : (Na__LeStmtStd__DocSource ? (Na__LeStmtStd__DocSource() || []) : []);
        const titleOf = (other) => {
            const otherId = Na__LeStmtStd__Detect(other);
            if (!otherId || otherId === id) return '';
            const definition = Na__LeStmtStd__Find(otherId);
            return definition && typeof definition.ContentsTitle === 'function' ? (definition.ContentsTitle(Na__LeStmtStd__Config) || '') : '';
        };
        const built = Na__LeStmtStd__Find(id).Build(
            Na__LeStmtStd__Config,
            { name : name ? Na__LeStmtStd__Unescape(name[1]) : '', body : Na__LeStmtStd__Body(html) },
            { Blocks : blocks, TitleOf : titleOf });
        return { Id : id, Html : built.replace(/^<(section|div|header)\b/, '<$1 data-na-standard-section="' + id + '"') };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Switching a Section On and Off in the Markdown
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Sections a Statement Carries
    // ------------------------------------------------------------
    // Ids in document order (one carried twice is listed twice).
    // ------------------------------------------------------------
    function Na__LeStmtStd__Present(markdown) {
        return Na__LeStmtMd__Tokenise(String(markdown || '')).map(Na__LeStmtStd__MarkerId).filter(Boolean);
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch a Section On
    // ------------------------------------------------------------
    // Returns the new markdown, or the same text when the section is already
    // carried or unknown.
    // - A section that can take over what the file already has (the header)
    //   does so, in place.
    // - Otherwise it goes after the first placement anchor the statement has,
    //   with a major divider under it unless one is already there.
    // ------------------------------------------------------------
    function Na__LeStmtStd__InsertInto(markdown, id) {
        const text       = String(markdown || '');
        const definition = Na__LeStmtStd__Find(id);
        if (!definition) return text;
        const blocks = Na__LeStmtMd__Tokenise(text);
        if (blocks.some((block) => Na__LeStmtStd__MarkerId(block) === id)) return text;

        // TAKE OVER what is there
        if (typeof definition.Adopt === 'function') {
            const adopted = definition.Adopt(blocks);
            if (adopted) {
                const last   = blocks[adopted.End - 1];
                const marker = Na__LeStmtStd__NewBlock(Na__LeStmtStd__MarkerLine(id, adopted.Body).split('\n'));
                marker.Lines = marker.Lines.slice(0, -1).concat(Array(Math.max(1, Na__LeStmtMd__TrailingBlanks(last))).fill(''));
                blocks.splice(adopted.Start, adopted.End - adopted.Start, marker);
                return Na__LeStmtMd__Join(blocks);
            }
        }

        // OR PUT IT WHERE ITS PLACEMENT SAYS
        const body   = typeof definition.NewBody === 'function' ? definition.NewBody(Na__LeStmtStd__Config) : '';
        const marker = Na__LeStmtStd__NewBlock(Na__LeStmtStd__MarkerLine(id, body).split('\n'));
        const unit   = definition.Unit !== 'none';

        let after = null;
        for (const anchor of (definition.PlaceAfter(Na__LeStmtStd__Config) || [])) {
            after = Na__LeStmtStd__Anchor(blocks, anchor);
            if (after !== null) break;
        }

        const insert = [ marker ];
        if (after === null) {
            // No anchor: just above the first numbered section, or at the end,
            // with a divider on each side so it is still a section of its own.
            const first = blocks.findIndex(Na__LeStmtStd__IsNumbered);
            after = first === -1 ? blocks.length - 1 : first - 1;
            while (after >= 0 && blocks[after].Kind === 'blank' && after === blocks.length - 1) after--;
            if (unit && !Na__LeStmtStd__IsDivider(blocks[after])) insert.unshift(Na__LeStmtStd__NewBlock(Na__LeStmtStd__DividerLines(blocks)));
        }
        if (unit && !Na__LeStmtStd__IsDivider(blocks[after + 1])) insert.push(Na__LeStmtStd__NewBlock(Na__LeStmtStd__DividerLines(blocks)));
        if (after >= 0) Na__LeStmtStd__EndWithBlank(blocks[after]);
        blocks.splice(after + 1, 0, ...insert);
        return Na__LeStmtMd__Join(blocks);
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch a Section Off
    // ------------------------------------------------------------
    // - A section that took over what was there (the header) writes it back.
    // - Otherwise the marker goes, and when it stood between two dividers the
    //   one under it goes with it, so switching on and off leaves the file as
    //   it was.
    // ------------------------------------------------------------
    function Na__LeStmtStd__RemoveFrom(markdown, id) {
        const definition = Na__LeStmtStd__Find(id);
        const blocks     = Na__LeStmtMd__Tokenise(String(markdown || ''));
        for (let i = blocks.length - 1; i >= 0; i--) {
            if (Na__LeStmtStd__MarkerId(blocks[i]) !== id) continue;
            if (definition && typeof definition.Unwrap === 'function') {
                const back   = Na__LeStmtMd__Tokenise(definition.Unwrap(Na__LeStmtStd__Body(blocks[i].Html), Na__LeStmtStd__Config));
                const blanks = Na__LeStmtMd__TrailingBlanks(blocks[i]);
                const last   = back[back.length - 1];
                if (last) last.Lines = last.Lines.slice(0, last.Lines.length - Na__LeStmtMd__TrailingBlanks(last)).concat(Array(blanks).fill(''));
                blocks.splice(i, 1, ...back);
                continue;
            }
            let before = i - 1;
            while (before >= 0 && blocks[before].Kind === 'blank') before--;
            const between = Na__LeStmtStd__IsDivider(blocks[before]) && Na__LeStmtStd__IsDivider(blocks[i + 1]);
            blocks.splice(i, between ? 2 : 1);
        }
        return Na__LeStmtMd__Join(blocks);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    Na__LeStmtRnd__RegisterExpander(Na__LeStmtStd__Expand);                    // <-- Every renderer on the page now draws markers as their sections

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Sections Registry API
    // ------------------------------------------------------------
    export {
        Na__LeStmtStd__READY_EVENT,
        Na__LeStmtStd__Ready,
        Na__LeStmtStd__List,
        Na__LeStmtStd__IsMovable,
        Na__LeStmtStd__DependsOnDocument,
        Na__LeStmtStd__SetDocumentSource,
        Na__LeStmtStd__Detect,
        Na__LeStmtStd__MarkerLine,
        Na__LeStmtStd__Expand,
        Na__LeStmtStd__Present,
        Na__LeStmtStd__InsertInto,
        Na__LeStmtStd__RemoveFrom
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
