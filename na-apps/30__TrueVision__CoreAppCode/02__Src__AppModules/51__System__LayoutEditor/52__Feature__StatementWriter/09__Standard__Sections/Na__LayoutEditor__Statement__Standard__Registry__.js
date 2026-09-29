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
//   things that will crop up on each job". Three open a statement, in the
//   order it always opens (Adam: "1. the header, 2. all of that important
//   header information, 3. the table of contents, 4. the TrueVision section,
//   5. the introduction"), and two close it:
//     DocumentHeader  - the logo, title and header fields, in spacing of its own
//     Contents        - drawn from the statement's own headings, never stale
//     TrueVisionHub   - the project's QR code, link and the case for using them
//     DrawingSchedule - the drawings that go with it: a copy of the Drawing
//                       Register taken by its card's Sync button, then edited
//                       like any words (it never follows the register by itself)
//     DocumentFooter  - the end-of-statement note and the copyright, always last
//   and one sits inside a section, wherever the writer's heading is:
//     FinishesComparison - the existing-versus-proposed materials, drawn
//                       element by element from the writer's own table
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
//   the same rule when a section is dragged. The footer is the one the other
//   way up (Unit 'above'): a divider over it and none under, because nothing
//   comes after it.
// - PLACEMENT, tried in order per section (PlaceAfter):
//     'Top'                 - the very top of the file
//     'HeaderDivider'       - the first major divider above the first numbered
//                             section: the one that closes the header
//     'Standard:<Id>'       - after that standard section and the divider under it
//     'BeforeStandard:<Id>' - straight above that standard section (the
//                             Drawing Schedule goes above the footer)
//     'SectionsEnd'         - after the divider that closes the last numbered
//                             section (the Conclusion)
//     'End'                 - after the last thing in the file
//     'Caret'               - under the block the writer's caret is in; the
//                             editor hands its line over as options.CaretLine,
//                             and without one the anchor is not there
//   then, failing all of them, just above the first numbered section, and
//   failing that, the end of the file. A section put down by 'End' or
//   'BeforeStandard' gets a divider over it too when the file has none there.
// - A SECTION CAN BE SYNCED. One whose words are a copy of something live
//   (the Drawing Schedule, of the Drawing Register) defines Merge and
//   Describe, and a module that can read the live thing registers itself as
//   its source (RegisterSource). Its card then has a Sync button: Fetch
//   reads the source, ApplySync writes what it read into the marker and
//   stamps the marker with when (data-na-std-synced). Nothing else ever
//   writes to it, so between syncs it is the statement's own. The source
//   lives outside this folder's pure modules because it needs the running
//   app; this registry only keeps the list.
//
// INTEGRATION:
// - Registers its expander with Na__LayoutEditor__Statement__Md__Render__ on
//   import. Imported by the Statement Writer page (for the menu), the editor
//   (switching on and off, the document source for redraws) and the cards
//   (whether a section may move), and by the tests.
// - A section module hands over a definition: { Id, Label, Fallback,
//   PlaceAfter, ContentsTitle(config, { body }), Build, and optionally
//   NewBody, Unit ('none' for no divider of its own, 'above' for one over it
//   only), Movable, DependsOnDocument, Adopt, Unwrap, EditHint, and for a
//   section that syncs, Merge and Describe }. Adding one is a new file and
//   one line in Na__LeStmtStd__DEFINITIONS.
// - Na__LayoutEditor__Statement__Standard__DrawingSchedule__Live__ (imported
//   by the page, never by this file) registers the Drawing Register as the
//   Drawing Schedule's source.
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
// 29-Sep-2026 - Version 1.3.0 (TrueVision3D v2.168.0)
// - The Finishes Comparison joins the list, between the hub and the Drawing
//   Schedule (document order: it sits in the body). Unit 'none', not movable.
// - Placement anchor 'Caret': InsertInto takes an optional third argument,
//   { CaretLine }, the line the block the caret is in ends on; the other
//   sections never ask for it and place exactly as before.
//
// 29-Sep-2026 - Version 1.2.0 (TrueVision3D v2.167.0)
// - The Drawing Schedule and the Document Footer join the list.
// - Placement anchors 'BeforeStandard:<Id>', 'SectionsEnd' and 'End'; Unit
//   'above' (the footer: a divider over it, none under), including when it
//   takes over the house footer.
// - A section can sync: RegisterSource, CanSync, Fetch, ApplySync, SyncedIso.
// - The Contents asks another section for its line WITH that section's own
//   words (ContentsTitle(config, { body })), so the Drawing Schedule is
//   listed under its own heading; EditHint gives each card's Edit its words.
//
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
    import { Na__LeStmtSched__Definition } from './Na__LayoutEditor__Statement__Standard__DrawingSchedule__.js';
    import { Na__LeStmtFoot__Definition } from './Na__LayoutEditor__Statement__Standard__Footer__.js';
    import { Na__LeStmtFin__Definition } from './Na__LayoutEditor__Statement__Standard__Finishes__.js';
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
        Na__LeStmtHub__Definition(),
        Na__LeStmtFin__Definition(),                                            // <-- In the body, under the writer's own heading
        Na__LeStmtSched__Definition(),
        Na__LeStmtFoot__Definition()
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
    const Na__LeStmtStd__SYNC_ATTR   = /\sdata-na-std-synced\s*=\s*"([^"]*)"/i;
    const Na__LeStmtStd__DIVIDER     = /^<div style=" \/\* \| - - - .*Horizontal Page Divider Line/;
    const Na__LeStmtStd__NUMBERED    = /^\d+\.0\s*\|/;
    const Na__LeStmtStd__OPEN_ENDED  = /^(End|BeforeStandard:.+)$/;             // <-- Anchors that can land where the file has no divider
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
    const Na__LeStmtStd__Sources   = new Map();                                // <-- Id -> (config) => the live data a section syncs from
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
    // IsAnyDivider also knows the house template's other rules - the one it
    // draws over the copyright line, the thin ones between drawing notes -
    // by their shape: a styled div with a border and no words in it. It is
    // asked only where a section wants a line over it, so an old statement's
    // own rule is never doubled.
    // ------------------------------------------------------------
    function Na__LeStmtStd__IsDivider(block) {
        return !!block && block.Kind === 'html' && Na__LeStmtStd__DIVIDER.test(block.Html || '');
    }
    function Na__LeStmtStd__IsAnyDivider(block) {
        if (Na__LeStmtStd__IsDivider(block)) return true;
        if (!block || block.Kind !== 'html') return false;
        const html = String(block.Html || '');
        return /^\s*<div\s+style\s*=\s*"/i.test(html)
            && /border(-top|-style|-width)?\s*:/i.test(html)
            && html.replace(/<[^>]*>/g, '').trim() === '';
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


    // HELPER FUNCTION | Put a Divider Over Block N Unless One Is Already There
    // ------------------------------------------------------------
    // For the footer when it takes over the house footer, which on RB05 sat
    // straight under a table with no line over it. Returns 1 when a divider
    // went in (block N is then N + 1), else 0.
    // ------------------------------------------------------------
    function Na__LeStmtStd__DividerAbove(blocks, at) {
        let before = at - 1;
        while (before >= 0 && blocks[before].Kind === 'blank') before--;
        if (before < 0 || Na__LeStmtStd__IsAnyDivider(blocks[before])) return 0;
        Na__LeStmtStd__EndWithBlank(blocks[before]);
        blocks.splice(before + 1, 0, Na__LeStmtStd__NewBlock(Na__LeStmtStd__DividerLines(blocks)));
        return 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether Only the File's Own Last Newline Follows Block N
    // ------------------------------------------------------------
    // A block put in at the very end gives up its blank line, so the file
    // still ends with one newline rather than an empty line.
    // ------------------------------------------------------------
    function Na__LeStmtStd__AtFileEnd(blocks, at) {
        return at < blocks.length - 1 && blocks.slice(at + 1).every((block) => block.Kind === 'blank');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Marker From Its Opening Tag and Its Words
    // ------------------------------------------------------------
    // The words go on the lines between the tags, escaped, never a blank
    // line among them - one would end the block in Typora.
    // ------------------------------------------------------------
    function Na__LeStmtStd__Wrap(open, body) {
        const lines = String(body || '').split('\n').filter((line) => line.trim() !== '');
        return open + '\n' + Na__LeStmtStd__Escape(lines.join('\n')) + '\n</div>';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set One Attribute on a Marker's Opening Tag
    // ------------------------------------------------------------
    function Na__LeStmtStd__SetAttr(open, name, value) {
        const safe    = Na__LeStmtStd__Escape(value).replace(/"/g, '&quot;');
        const pattern = new RegExp('(\\s' + name + '\\s*=\\s*")[^"]*(")', 'i');
        return pattern.test(open)
            ? open.replace(pattern, (whole, head, tail) => head + safe + tail)
            : open.replace(/\s*>$/, () => ' ' + name + '="' + safe + '">');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve One Placement Anchor to "Insert After Block N"
    // ------------------------------------------------------------
    // Returns the index of the block to insert after, -1 for the very top, or
    // null when the anchor is not in this statement. options.CaretLine, for
    // 'Caret': the line the caret's block ends on, counted from one.
    // ------------------------------------------------------------
    function Na__LeStmtStd__Anchor(blocks, anchor, options) {
        if (anchor === 'Caret') {
            const line = options && Number.isFinite(options.CaretLine) ? Math.floor(options.CaretLine) : 0;
            if (line <= 0) return null;                                         // <-- No caret in the page: the next anchor decides
            let run = 0;
            for (let i = 0; i < blocks.length; i++) {
                run += (blocks[i].Lines || []).length;
                if (run >= line) return i;                                      // <-- The block that holds that line: the caret's own
            }
            return blocks.length - 1;
        }
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
        const beforeStandard = /^BeforeStandard:(.+)$/.exec(String(anchor || ''));
        if (beforeStandard) {
            const at = blocks.findIndex((block) => Na__LeStmtStd__MarkerId(block) === beforeStandard[1]);
            if (at === -1) return null;
            let before = at - 1;                                                // <-- The block over that section: its divider, when it has one
            while (before >= 0 && blocks[before].Kind === 'blank') before--;
            return before;
        }
        if (anchor === 'SectionsEnd') {
            let last = -1;
            for (let i = 0; i < blocks.length; i++) if (Na__LeStmtStd__IsNumbered(blocks[i])) last = i;
            if (last === -1) return null;
            for (let i = last + 1; i < blocks.length; i++) if (Na__LeStmtStd__IsDivider(blocks[i])) return i;
            return null;
        }
        if (anchor === 'End') {
            let at = blocks.length - 1;
            while (at >= 0 && blocks[at].Kind === 'blank') at--;
            return at;
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


    // FUNCTION | What a Section's Edit Button Says It Opens
    // ------------------------------------------------------------
    // '' for a section that says nothing of its own: the card has a default.
    // ------------------------------------------------------------
    function Na__LeStmtStd__EditHint(id) {
        const definition = Na__LeStmtStd__Find(id);
        return definition && typeof definition.EditHint === 'string' ? definition.EditHint : '';
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
            return Na__LeStmtStd__Wrap(open, body);                             // <-- No blank line among the words: one would end the block in Typora
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
            return definition && typeof definition.ContentsTitle === 'function'
                ? (definition.ContentsTitle(Na__LeStmtStd__Config, { body : Na__LeStmtStd__Body(other) }) || '')   // <-- Its own words: the Drawing Schedule's heading is the writer's
                : '';
        };
        const built = Na__LeStmtStd__Find(id).Build(
            Na__LeStmtStd__Config,
            { name : name ? Na__LeStmtStd__Unescape(name[1]) : '', body : Na__LeStmtStd__Body(html) },
            { Blocks : blocks, TitleOf : titleOf });
        return { Id : id, Html : built.replace(/^<(section|div|header|footer)\b/, '<$1 data-na-standard-section="' + id + '"') };
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
    // - A section that can take over what the file already has (the header,
    //   a comparison table) does so, in place.
    // - Otherwise it goes after the first placement anchor the statement has,
    //   with a major divider under it unless one is already there.
    // options: { CaretLine } from the editor, for a section placed 'Caret'.
    // ------------------------------------------------------------
    function Na__LeStmtStd__InsertInto(markdown, id, options) {
        const text       = String(markdown || '');
        const definition = Na__LeStmtStd__Find(id);
        if (!definition) return text;
        const blocks = Na__LeStmtMd__Tokenise(text);
        if (blocks.some((block) => Na__LeStmtStd__MarkerId(block) === id)) return text;
        const over = definition.Unit === 'above';                                // <-- The footer: a divider over it and none under

        // TAKE OVER what is there
        if (typeof definition.Adopt === 'function') {
            const adopted = definition.Adopt(blocks);
            if (adopted) {
                const last   = blocks[adopted.End - 1];
                const blanks = Na__LeStmtMd__TrailingBlanks(last);
                const atEnd  = over && Na__LeStmtStd__AtFileEnd(blocks, adopted.End - 1);   // <-- The file's own last newline stays its last
                const marker = Na__LeStmtStd__NewBlock(Na__LeStmtStd__MarkerLine(id, adopted.Body).split('\n'));
                marker.Lines = marker.Lines.slice(0, -1).concat(Array(atEnd ? blanks : Math.max(1, blanks)).fill(''));
                blocks.splice(adopted.Start, adopted.End - adopted.Start, marker);
                if (over) Na__LeStmtStd__DividerAbove(blocks, adopted.Start);   // <-- RB05's copyright sat under a table with no line over it
                return Na__LeStmtMd__Join(blocks);
            }
        }

        // OR PUT IT WHERE ITS PLACEMENT SAYS
        const body    = typeof definition.NewBody === 'function' ? definition.NewBody(Na__LeStmtStd__Config) : '';
        const marker  = Na__LeStmtStd__NewBlock(Na__LeStmtStd__MarkerLine(id, body).split('\n'));
        const unit    = definition.Unit !== 'none' && !over;
        const divider = () => Na__LeStmtStd__NewBlock(Na__LeStmtStd__DividerLines(blocks));

        let after = null;
        let used  = '';
        for (const anchor of (definition.PlaceAfter(Na__LeStmtStd__Config) || [])) {
            after = Na__LeStmtStd__Anchor(blocks, anchor, options);
            if (after !== null) { used = String(anchor); break; }
        }

        const insert = [ marker ];
        if (after === null) {
            // No anchor: just above the first numbered section, or at the end,
            // with a divider on each side so it is still a section of its own.
            const first = blocks.findIndex(Na__LeStmtStd__IsNumbered);
            after = first === -1 ? blocks.length - 1 : first - 1;
            while (after >= 0 && blocks[after].Kind === 'blank' && after === blocks.length - 1) after--;
            if ((unit || over) && !Na__LeStmtStd__IsDivider(blocks[after])) insert.unshift(divider());
        } else if ((over || (unit && Na__LeStmtStd__OPEN_ENDED.test(used))) && after >= 0 && !Na__LeStmtStd__IsAnyDivider(blocks[after])) {
            insert.unshift(divider());                                          // <-- Put down where the file had no line: it still gets one over it
        }
        if (unit && !Na__LeStmtStd__IsDivider(blocks[after + 1])) insert.push(divider());
        const atEnd = (over || Na__LeStmtStd__OPEN_ENDED.test(used)) && Na__LeStmtStd__AtFileEnd(blocks, after);
        if (after >= 0) Na__LeStmtStd__EndWithBlank(blocks[after]);
        if (atEnd) {
            const tail = insert[insert.length - 1];
            if (tail.Lines[tail.Lines.length - 1] === '') tail.Lines.pop();     // <-- The file still ends with one newline, not an empty line
        }
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
// REGION | Public API - Syncing a Section From Something Live
// -----------------------------------------------------------------------------

    // FUNCTION | Name the Live Thing a Section Syncs From
    // ------------------------------------------------------------
    // fn(config) resolves to { ok, reason, Rows, ProjectCode, Source } - the
    // Drawing Schedule's source reads the Drawing Register. Registered by a
    // module that runs inside the app; under node nothing registers, so
    // nothing can sync and no card offers to.
    // ------------------------------------------------------------
    function Na__LeStmtStd__RegisterSource(id, fn) {
        if (typeof fn === 'function' && Na__LeStmtStd__Find(id)) Na__LeStmtStd__Sources.set(id, fn);
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Section's Card Should Offer Sync
    // ------------------------------------------------------------
    function Na__LeStmtStd__CanSync(id) {
        const definition = Na__LeStmtStd__Find(id);
        return !!definition && typeof definition.Merge === 'function' && Na__LeStmtStd__Sources.has(id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read What a Section Syncs From
    // ------------------------------------------------------------
    // Never rejects: { ok : false, reason } when the source cannot be read.
    // Kept apart from ApplySync so the caller reads the statement AFTER the
    // wait - anything typed meanwhile is not written over.
    // ------------------------------------------------------------
    async function Na__LeStmtStd__Fetch(id) {
        if (!Na__LeStmtStd__CanSync(id)) return { ok : false, reason : 'This section has nothing to sync from here.' };
        try {
            const out = await Na__LeStmtStd__Sources.get(id)(Na__LeStmtStd__Config);
            if (!out || out.ok === false) return { ok : false, reason : (out && out.reason) || 'What this section syncs from could not be read.' };
            return Object.assign({ ok : true }, out);
        } catch (error) {
            return { ok : false, reason : 'What this section syncs from could not be read (' + ((error && error.message) || error) + ').' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Write What Was Read Into a Statement's Marker
    // ------------------------------------------------------------
    // Returns { ok, changed, markdown, summary, text, reason }: text is the
    // section's own account of what changes (Describe), for the question the
    // editor asks first. The marker keeps its opening tag and every attribute
    // on it, gains data-na-std-synced (when), and keeps the blank lines under
    // it. Nothing is written when nothing would change - not even the stamp.
    // ------------------------------------------------------------
    function Na__LeStmtStd__ApplySync(markdown, id, data) {
        const text       = String(markdown || '');
        const definition = Na__LeStmtStd__Find(id);
        if (!definition || typeof definition.Merge !== 'function') return { ok : false, changed : false, markdown : text, reason : 'This section has nothing to sync.' };
        const blocks = Na__LeStmtMd__Tokenise(text);
        const at     = blocks.findIndex((block) => Na__LeStmtStd__MarkerId(block) === id);
        if (at === -1) return { ok : false, changed : false, markdown : text, reason : 'The statement does not carry this section.' };

        const merged  = definition.Merge(Na__LeStmtStd__Body(blocks[at].Html), data || {}, Na__LeStmtStd__Config);
        const summary = merged.Summary || {};
        const words   = typeof definition.Describe === 'function' ? definition.Describe(summary) : '';
        if (summary.Same) return { ok : true, changed : false, markdown : text, summary : summary, text : words };

        const open  = Na__LeStmtStd__MARKER_OPEN.exec(blocks[at].Html)[0].replace(/^\s+/, '');
        const html  = Na__LeStmtStd__Wrap(Na__LeStmtStd__SetAttr(open, 'data-na-std-synced', (data && data.SyncedIso) || new Date().toISOString()), merged.Body);
        blocks[at]  = { Kind : 'html', Lines : html.split('\n').concat(Array(Na__LeStmtMd__TrailingBlanks(blocks[at])).fill('')), Html : html };
        return { ok : true, changed : true, markdown : Na__LeStmtMd__Join(blocks), summary : summary, text : words };
    }
    // ------------------------------------------------------------


    // FUNCTION | When a Marker Was Last Synced ('' for never)
    // ------------------------------------------------------------
    function Na__LeStmtStd__SyncedIso(html) {
        const open  = Na__LeStmtStd__MARKER_OPEN.exec(String(html || ''));
        const match = open ? Na__LeStmtStd__SYNC_ATTR.exec(open[0]) : null;
        return match ? Na__LeStmtStd__Unescape(match[1]) : '';
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
        Na__LeStmtStd__EditHint,
        Na__LeStmtStd__SetDocumentSource,
        Na__LeStmtStd__Detect,
        Na__LeStmtStd__MarkerLine,
        Na__LeStmtStd__Expand,
        Na__LeStmtStd__Present,
        Na__LeStmtStd__InsertInto,
        Na__LeStmtStd__RemoveFrom,
        Na__LeStmtStd__RegisterSource,
        Na__LeStmtStd__CanSync,
        Na__LeStmtStd__Fetch,
        Na__LeStmtStd__ApplySync,
        Na__LeStmtStd__SyncedIso
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
