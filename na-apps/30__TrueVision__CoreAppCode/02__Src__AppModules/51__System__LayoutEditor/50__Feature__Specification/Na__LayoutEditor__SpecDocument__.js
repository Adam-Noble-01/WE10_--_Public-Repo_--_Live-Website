// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION DOCUMENT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecDocument__.js
// NAMESPACE  : Na__LeSpecDoc
// MODULE     : Layout Editor - Specification Document
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay the project specification out as A4 pages - the Project Specification tab's reading mode - and print them
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - THE DOCUMENT. The specification as it prints: A4 portrait pages, each with
//   the logo and the document's name along its head, and the company and the
//   page number along its foot. The first page opens with the title - Project
//   Specification, the project's name, its code, the date and what the
//   document holds - and the groups follow in order: a group's prefix and
//   title over a rule, then its notes, each a code in a hanging column with
//   its title beside it and its text under the title.
// - REAL PAGES. Nothing is scaled to fit and nothing is cut off. Blocks are
//   placed one after another into a page's body and measured where they land;
//   the first block that crosses the foot starts the next page. A group's
//   heading stays with its first note, and a note's heading with the first
//   paragraph of its text. What does not fit moves on whole, unless it is
//   taller than a third of a page: that breaks where it starts, between
//   words, never leaving one line alone on either side of the break. Every
//   block ends at least 2 px above the foot, so paper never cuts a line off.
// - READ ALOUD. The text is real text in headings and paragraphs, so a
//   browser's Read Aloud reads the specification from the top and a selection
//   can be read from anywhere. What repeats on every page - the running head,
//   the company, the page number - is painted from attributes and hidden from
//   assistive technology: it prints, but it is never read out page after page.
// - PRINT. Print, or the browser's own print while the tab is showing, lays
//   the pages out again at full size in a container of their own, shows only
//   that container on paper and sets the paper to A4 with no margins, so the
//   printed pages are the pages on screen. Save as PDF in the print dialog
//   makes the PDF.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecEditor__ hands in the desk the reading mode's pages
//   lie on, asks for them to be laid out again and fitted to its width, and
//   says whether the tab is showing, which decides whether a print is the
//   specification's.
// - Reads the live specification (Na__LayoutEditor__SpecData__), the project
//   code, the project's name (window.TrueVision__Pwa__ProjectContext: the
//   project folder's name, refined by the project data's projectName), and
//   from the config the drawing style, the title block's logo and the PDF
//   author.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. The logo and the company come from each
//                   app's own config. The project's name is the one part to
//                   adapt: TrueVision reads it from its PWA project context.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Specification and Project Code
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetLabel,
        Na__LeCfg__FormatLabel,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTitleBlockSetup,
        Na__LeCfg__GetPdfSetup
    } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSpec__GetState, Na__LeSpec__GetGroups, Na__LeSpec__ListNotes } from './Na__LayoutEditor__SpecData__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Paper, Print and Dates
    // ------------------------------------------------------------
    const Na__LeSpecDoc__PAGE_WIDTH_PX = 210 * 96 / 25.4;                          // <-- A4's width in CSS pixels: what the desk fits to its width
    const Na__LeSpecDoc__MIN_ZOOM      = 0.35;
    const Na__LeSpecDoc__PRINT_CLASS   = 'na-le-spec-printing';                    // <-- On the root element while the specification prints
    const Na__LeSpecDoc__PAGE_STYLE_ID = 'naLeSpecPrintPaper';
    const Na__LeSpecDoc__PAGE_RULE     = '@page { size: A4 portrait; margin: 0; }';   // <-- Only in the document while printing, so no other print is touched
    const Na__LeSpecDoc__MONTHS        = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Printing
    // ------------------------------------------------------------
    let Na__LeSpecDoc__IsPrintable = null;    // <-- () => true while the Project Specification tab is showing
    let Na__LeSpecDoc__PrintRoot   = null;    // <-- The container the pages are laid out in for paper, while printing
    let Na__LeSpecDoc__Initialised = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element With a Class and Optional Text
    // ------------------------------------------------------------
    function Na__LeSpecDoc__El(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined && text !== null) el.textContent = text;
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Page Furniture: Text Painted From an Attribute, So It Prints but Is Never Read
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Painted(className, text) {
        const el = Na__LeSpecDoc__El('span', className);
        el.setAttribute('data-na-spec-paint', text || '');
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Count in Words: "1 note", "3 notes"
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Count(count, oneKey, oneText, manyKey, manyText) {
        return count === 1 ? Na__LeCfg__FormatLabel(oneKey, oneText, { count : count }) : Na__LeCfg__FormatLabel(manyKey, manyText, { count : count });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Date the Way the Title Blocks Write It: "14 Sep 2026"
    // ------------------------------------------------------------
    function Na__LeSpecDoc__DateText(date) {
        return String(date.getDate()).padStart(2, '0') + ' ' + Na__LeSpecDoc__MONTHS[date.getMonth()] + ' ' + date.getFullYear();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Every Page Says About the Project
    // ------------------------------------------------------------
    // The name is the PWA project context's display name: the project folder's
    // ("PS01__MustersRoad" reads "Musters Road"), refined by the project data's
    // projectName once it has loaded. A context that only knows the code has
    // no name to add.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Project() {
        const code    = Na__DrawData__GetProjectCode() || '';
        const context = window.TrueVision__Pwa__ProjectContext;
        let name = '';
        try { name = (context && typeof context.get === 'function' && context.get().displayName) || ''; } catch (e) { name = ''; }
        return {
            code    : code,
            name    : (name && name !== code) ? name : '',
            company : Na__LeCfg__GetPdfSetup().author || '',
            logo    : Na__LeCfg__GetTitleBlockSetup().logoAssetPath || '',
            date    : Na__LeSpecDoc__DateText(new Date())
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Blocks
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Title That Opens the First Page
    // ------------------------------------------------------------
    function Na__LeSpecDoc__BuildTitle(project, state) {
        const L     = Na__LeCfg__GetLabel;
        const title = Na__LeSpecDoc__El('div', 'na-le-spec-doc__title');
        title.appendChild(Na__LeSpecDoc__El('h1', 'na-le-spec-doc__heading', L('SpecDocTitle', 'Project Specification')));
        if (project.name) title.appendChild(Na__LeSpecDoc__El('p', 'na-le-spec-doc__project', project.name));

        const meta = Na__LeSpecDoc__El('dl', 'na-le-spec-doc__meta');
        const add  = (label, value) => {
            if (!value) return;
            const item = Na__LeSpecDoc__El('div', 'na-le-spec-doc__meta-item');
            item.appendChild(Na__LeSpecDoc__El('dt', '', label));
            item.appendChild(Na__LeSpecDoc__El('dd', '', value));
            meta.appendChild(item);
        };
        add(L('SpecDocProject', 'Project'), project.code);
        add(L('SpecDocDate', 'Date'), project.date);
        if (state.loaded) {
            add(L('SpecDocContents', 'Contents'), Na__LeSpecDoc__Count(Na__LeSpec__ListNotes().length, 'SpecNotesOne', '{count} note', 'SpecNotesMany', '{count} notes')
                + ' ' + Na__LeSpecDoc__Count(Na__LeSpec__GetGroups().length, 'SpecInGroupsOne', 'in {count} group', 'SpecInGroupsMany', 'in {count} groups'));
        }
        title.appendChild(meta);
        return title;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Group's Heading, and the Line Under a General Group's
    // ------------------------------------------------------------
    function Na__LeSpecDoc__GroupBlocks(group) {
        const heading = Na__LeSpecDoc__El('h2', 'na-le-spec-doc__group');
        heading.appendChild(Na__LeSpecDoc__El('span', 'na-le-spec-doc__group-prefix', group.Group__Prefix));
        heading.appendChild(document.createTextNode(' '));                        // <-- Read and copied as "GN General Notes", not "GNGeneral Notes"
        heading.appendChild(Na__LeSpecDoc__El('span', 'na-le-spec-doc__group-title', group.Group__Title.trim()));
        const blocks = [ heading ];
        if (group.Group__IsGeneral) blocks.push(Na__LeSpecDoc__El('p', 'na-le-spec-doc__caption', Na__LeCfg__GetLabel('SpecDocGeneral', 'These notes apply to every drawing.')));
        return blocks;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Note's Heading: Its Code, Then Its Title
    // ------------------------------------------------------------
    function Na__LeSpecDoc__NoteHeading(note) {
        const heading = Na__LeSpecDoc__El('h3', 'na-le-spec-doc__note');
        heading.appendChild(Na__LeSpecDoc__El('span', 'na-le-spec-doc__code', note.Note__Code));
        heading.appendChild(document.createTextNode(' '));
        heading.appendChild(Na__LeSpecDoc__El('span', 'na-le-spec-doc__note-title', note.Note__Title.trim()));
        return heading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Note's Text as Paragraphs: One per Typed Line
    // ------------------------------------------------------------
    // A blank line typed above a line gives that paragraph more room, the way
    // the notes margin keeps it.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Paragraphs(text) {
        const paragraphs = [];
        let gap = false;
        String(text || '').split(/\r?\n/).forEach((line) => {
            const clean = line.trim();
            if (!clean) { gap = paragraphs.length > 0; return; }
            paragraphs.push(Na__LeSpecDoc__El('p', 'na-le-spec-doc__text' + (gap ? ' is-spaced' : ''), clean));
            gap = false;
        });
        return paragraphs;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Specification as Chunks: the Blocks That Must Share a Page
    // ------------------------------------------------------------
    // A chunk is laid on one page or moved to the next whole: a group's heading
    // with its first note's heading and first paragraph, a note's heading with
    // its first paragraph, and each paragraph after that on its own.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Chunks() {
        const chunks = [];
        Na__LeSpec__GetGroups().forEach((group) => {
            const lead = Na__LeSpecDoc__GroupBlocks(group);
            if (!group.Group__Notes.length) {
                chunks.push(lead.concat([ Na__LeSpecDoc__El('p', 'na-le-spec-doc__empty', Na__LeCfg__GetLabel('SpecGroupEmpty', 'No notes in this group yet.')) ]));
                return;
            }
            group.Group__Notes.forEach((note, index) => {
                const text = Na__LeSpecDoc__Paragraphs(note.Note__Body);
                chunks.push((index === 0 ? lead : []).concat([ Na__LeSpecDoc__NoteHeading(note) ], text.slice(0, 1)));
                text.slice(1).forEach((paragraph) => chunks.push([ paragraph ]));
            });
        });
        return chunks;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pages
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Start a Page: Its Head, Its Body and Its Foot
    // ------------------------------------------------------------
    function Na__LeSpecDoc__AddSheet(flow) {
        const L     = Na__LeCfg__GetLabel;
        const sheet = Na__LeSpecDoc__El('section', 'na-le-spec-sheet');

        const head = Na__LeSpecDoc__El('header', 'na-le-spec-sheet__head');
        head.setAttribute('aria-hidden', 'true');
        if (flow.project.logo) {
            const logo = Na__LeSpecDoc__El('img', 'na-le-spec-sheet__logo');
            logo.alt       = '';
            logo.draggable = false;
            logo.src       = flow.project.logo;
            head.appendChild(logo);
        }
        const running = [ flow.project.code, flow.project.name ].filter(Boolean).join(' ');
        head.appendChild(Na__LeSpecDoc__Painted('na-le-spec-sheet__running', [ L('SpecDocTitle', 'Project Specification'), running ].filter(Boolean).join(' · ')));

        const body = Na__LeSpecDoc__El('div', 'na-le-spec-sheet__body');
        const foot = Na__LeSpecDoc__El('footer', 'na-le-spec-sheet__foot');
        foot.setAttribute('aria-hidden', 'true');
        foot.appendChild(Na__LeSpecDoc__Painted('na-le-spec-sheet__company', flow.project.company));
        const number = Na__LeSpecDoc__Painted('na-le-spec-sheet__number', '');
        foot.appendChild(number);

        sheet.appendChild(head);
        sheet.appendChild(body);
        sheet.appendChild(foot);
        flow.target.appendChild(sheet);
        flow.body = body;
        flow.sheets.push({ sheet : sheet, number : number });
        return body;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does the Last Block on a Page End Above Its Foot
    // ------------------------------------------------------------
    // With 2 px (about half a millimetre) to spare: a page laid out again for
    // paper can round a line a fraction lower, and the body would cut it off.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Fits(body) {
        const last = body.lastElementChild;
        if (!last) return true;
        return last.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom - 2;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay a Chunk on the Page, or Start the Next Page With It
    // ------------------------------------------------------------
    // A chunk that does not fit moves to the next page whole, unless it is
    // taller than a third of a page: then it breaks where it starts, rather
    // than leave that much paper blank above it.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Place(flow, chunk) {
        chunk.forEach((el) => flow.body.appendChild(el));
        if (Na__LeSpecDoc__Fits(flow.body)) return;
        const fresh = flow.body.firstElementChild === chunk[0];                  // <-- Nothing above it on this page
        const last  = chunk[chunk.length - 1];
        const tall  = last.classList.contains('na-le-spec-doc__text')
                   && (last.getBoundingClientRect().bottom - chunk[0].getBoundingClientRect().top) > flow.body.clientHeight / 3;
        if (!fresh && !tall) {
            chunk.forEach((el) => el.remove());
            Na__LeSpecDoc__AddSheet(flow);
            Na__LeSpecDoc__Place(flow, chunk);
            return;
        }
        Na__LeSpecDoc__Split(flow, chunk, fresh);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Break a Chunk Between Words Across the Foot of the Page
    // ------------------------------------------------------------
    // Only its last block, a paragraph, is broken: as many of its words as fit
    // stay under the headings above it, and the rest carries on at the top of
    // the next page. Never one line alone on either side: with fewer than two
    // lines left here the whole chunk starts the next page, and a last line
    // that would carry over alone takes one more with it.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Split(flow, chunk, fresh) {
        const last  = chunk[chunk.length - 1];
        const words = last.classList.contains('na-le-spec-doc__text') ? last.textContent.split(/\s+/).filter(Boolean) : [];
        const again = () => { chunk.forEach((el) => el.remove()); Na__LeSpecDoc__AddSheet(flow); Na__LeSpecDoc__Place(flow, chunk); };
        if (words.length < 2) { if (!fresh) again(); return; }                   // <-- Nothing to break between: on a page of its own it stays, cut off at the foot

        const lineHeight = parseFloat(window.getComputedStyle(last).lineHeight) || 1;
        const lines = () => Math.max(1, Math.round(last.getBoundingClientRect().height / lineHeight));
        const most  = (maxLines) => {                                            // <-- The most words that end above the foot within maxLines lines
            let best = 0, low = 1, high = words.length - 1;
            while (low <= high) {
                const mid = (low + high) >> 1;
                last.textContent = words.slice(0, mid).join(' ');
                if (Na__LeSpecDoc__Fits(flow.body) && lines() <= maxLines) { best = mid; low = mid + 1; } else { high = mid - 1; }
            }
            return best;
        };
        const total = lines();                                                   // <-- Measured while the paragraph is still whole
        let fit  = most(Infinity);
        let here = 0;
        if (fit) { last.textContent = words.slice(0, fit).join(' '); here = lines(); }
        if (here > 2 && total - here < 2) {                                      // <-- One line would carry over alone: take another with it
            fit  = most(here - 1);
            here = fit ? here - 1 : 0;
        }
        if (!fresh && here < 2) { last.textContent = words.join(' '); again(); return; }

        const rest = Na__LeSpecDoc__El('p', 'na-le-spec-doc__text is-continued');
        if (fit === 0) {
            if (chunk.length === 1) { last.textContent = words.join(' '); return; }   // <-- A page too short for one line: cut off, rather than loop
            last.remove();                                                       // <-- The headings fill the page; the paragraph starts the next
            rest.textContent = words.join(' ');
        } else {
            last.textContent = words.slice(0, fit).join(' ');
            rest.textContent = words.slice(fit).join(' ');
        }
        Na__LeSpecDoc__AddSheet(flow);
        Na__LeSpecDoc__Place(flow, [ rest ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay the Whole Document Out Into a Container: the Number of Pages
    // ------------------------------------------------------------
    // The container must be laid out (not display: none) - blocks are measured
    // where they land. The drawing style's font and colours are handed to the
    // pages as custom properties.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Layout(target) {
        const L     = Na__LeCfg__GetLabel;
        const state = Na__LeSpec__GetState();
        const style = Na__LeCfg__GetStyleSetup();
        target.innerHTML = '';
        target.style.setProperty('--na-spec-font', style.fontFamily);
        target.style.setProperty('--na-spec-ink', style.inkColour);
        target.style.setProperty('--na-spec-muted', style.mutedTextColour);
        target.style.setProperty('--na-spec-rule', style.frameLineColour);

        const flow = { target : target, project : Na__LeSpecDoc__Project(), body : null, sheets : [] };
        Na__LeSpecDoc__AddSheet(flow);
        Na__LeSpecDoc__Place(flow, [ Na__LeSpecDoc__BuildTitle(flow.project, state) ]);
        if (!state.loaded) {
            Na__LeSpecDoc__Place(flow, [ Na__LeSpecDoc__El('p', 'na-le-spec-doc__message', L('SpecLoadingPage', 'Loading the project specification...')) ]);
        } else if (!Na__LeSpec__GetGroups().length) {
            Na__LeSpecDoc__Place(flow, [ Na__LeSpecDoc__El('p', 'na-le-spec-doc__message', L('SpecDocEmpty', 'This project has no specification yet.')) ]);
        } else {
            Na__LeSpecDoc__Chunks().forEach((chunk) => Na__LeSpecDoc__Place(flow, chunk));
        }
        flow.sheets.forEach((entry, index) => {
            entry.number.setAttribute('data-na-spec-paint', Na__LeCfg__FormatLabel('SpecDocPage', 'Page {page} of {count}', { page : index + 1, count : flow.sheets.length }));
        });
        return flow.sheets.length;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Print
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Before a Print: Lay the Pages Out for Paper When the Tab Is Showing
    // ------------------------------------------------------------
    // The container is fixed at the top left, laid out but out of sight; the
    // print stylesheet shows it alone. Laid out afresh every time, so a print
    // whose afterprint never came does not print old pages.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__BeforePrint() {
        if (typeof Na__LeSpecDoc__IsPrintable !== 'function' || !Na__LeSpecDoc__IsPrintable()) return false;
        if (!Na__LeSpecDoc__PrintRoot) {
            Na__LeSpecDoc__PrintRoot = Na__LeSpecDoc__El('div', 'na-le-spec-print');
            Na__LeSpecDoc__PrintRoot.setAttribute('aria-hidden', 'true');          // <-- A copy of the reading mode's pages: never read twice
            document.body.appendChild(Na__LeSpecDoc__PrintRoot);
        }
        Na__LeSpecDoc__Layout(Na__LeSpecDoc__PrintRoot);
        if (!document.getElementById(Na__LeSpecDoc__PAGE_STYLE_ID)) {
            const paper = document.createElement('style');
            paper.id          = Na__LeSpecDoc__PAGE_STYLE_ID;
            paper.textContent = Na__LeSpecDoc__PAGE_RULE;
            document.head.appendChild(paper);
        }
        document.documentElement.classList.add(Na__LeSpecDoc__PRINT_CLASS);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | After a Print: Take the Paper Pages Away
    // ------------------------------------------------------------
    function Na__LeSpecDoc__AfterPrint() {
        if (!Na__LeSpecDoc__PrintRoot) return false;
        document.documentElement.classList.remove(Na__LeSpecDoc__PRINT_CLASS);
        const paper = document.getElementById(Na__LeSpecDoc__PAGE_STYLE_ID);
        if (paper) paper.remove();
        Na__LeSpecDoc__PrintRoot.remove();
        Na__LeSpecDoc__PrintRoot = null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Listen for Prints (once): options { isPrintable }
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Initialize(options) {
        Na__LeSpecDoc__IsPrintable = (options && typeof options.isPrintable === 'function') ? options.isPrintable : null;
        if (Na__LeSpecDoc__Initialised) return true;
        Na__LeSpecDoc__Initialised = true;
        window.addEventListener('beforeprint', Na__LeSpecDoc__BeforePrint);
        window.addEventListener('afterprint', Na__LeSpecDoc__AfterPrint);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Lay the Reading Mode's Pages Out on a Desk: { pages }
    // ------------------------------------------------------------
    // At full size: Fit shrinks them to the desk's width afterwards.
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Render(desk) {
        if (!desk) return { pages : 0 };
        desk.style.setProperty('--na-spec-zoom', '1');
        return { pages : Na__LeSpecDoc__Layout(desk) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Shrink the Pages to a Scroller Narrower Than A4 (never enlarge): the Zoom Used
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Fit(scroller, desk) {
        if (!scroller || !desk || !scroller.clientWidth) return 1;
        const pad  = window.getComputedStyle(desk);
        const room = scroller.clientWidth - (parseFloat(pad.paddingLeft) || 0) - (parseFloat(pad.paddingRight) || 0);
        const zoom = Math.max(Na__LeSpecDoc__MIN_ZOOM, Math.min(1, room / Na__LeSpecDoc__PAGE_WIDTH_PX));
        desk.style.setProperty('--na-spec-zoom', String(Math.round(zoom * 1000) / 1000));
        return zoom;
    }
    // ------------------------------------------------------------


    // FUNCTION | Print the Specification (the print dialog also saves a PDF)
    // ------------------------------------------------------------
    function Na__LeSpecDoc__Print() {
        Na__LeSpecDoc__BeforePrint();                                              // <-- beforeprint lays them out again; this is for a browser that does not send it
        window.print();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Document API
    // ------------------------------------------------------------
    export {
        Na__LeSpecDoc__Initialize,
        Na__LeSpecDoc__Render,
        Na__LeSpecDoc__Fit,
        Na__LeSpecDoc__Print
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
