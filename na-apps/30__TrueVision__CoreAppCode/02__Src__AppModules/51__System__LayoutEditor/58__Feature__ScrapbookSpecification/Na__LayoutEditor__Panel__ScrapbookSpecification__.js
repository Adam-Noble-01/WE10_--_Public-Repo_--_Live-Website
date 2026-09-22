// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SPECIFICATION SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ScrapbookSpecification__.js
// NAMESPACE  : Na__LePanelScrapSpec
// MODULE     : Layout Editor - Panel Specification Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The left column's Specification tab: the project specification's codes and notes, each code in an annotation bubble that is dragged onto the sheet
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHY IT EXISTS. The Project Specification is a tab of its own and cannot be
//   open beside a sheet, so tagging a complicated drawing meant remembering
//   what EX03 or RF02 stood for, or flicking between two tabs. This puts the
//   specification beside the paper in a concise form - the code and the note
//   and nothing else - on a second tab of the left column, the way the
//   scrapbooks are a second tab of the right one.
// - ONE ROW PER NOTE, every row styled alike: the note's code in its bubble,
//   drawn by the sheet's own markup builder so it is exactly the bubble that
//   lands, then the note's title and its text. The text is cut short after a
//   few lines (the whole note is in the row's tooltip) unless Show full notes
//   is ticked. Groups are headed by their prefix and title and do not fold: a
//   fold inside a fold is a maze, and the filter narrows a long specification
//   better than folding does.
// - A ROW IS A SCRAPBOOK TILE. It is dragged onto the paper, or double-clicked
//   to land in the middle of the view, by Na__LayoutEditor__Scrapbook__TileDrag__
//   - the one drag every scrapbook library shares. What lands is a
//   specification bubble linked to the note (Na__LayoutEditor__ScrapbookSpecification__).
// - IT SAYS WHAT IS ALREADY TAGGED. A note with bubbles on the active sheet
//   carries a quiet count beside its title, kept in step as bubbles are
//   placed, deleted, linked, unlinked, undone and redone.
// - NOTHING IS REBUILT THAT HAS NOT CHANGED. The rows are rebuilt only when
//   the specification's content, the look of a new bubble or the editable
//   flag changes; the counts and the filter are applied to the rows in place.
// - A ROW CAN BE EDITED WHERE IT IS (22-Sep-2026). Right-click it - Edit spec
//   item - or press F2 on it, and the row becomes its note's title and text,
//   spell-checked; Enter saves into the specification and the local
//   specification file, Save Sheets takes it to the cloud
//   (Na__LayoutEditor__ScrapbookSpecification__RowEditor__). The caret starts
//   in the word that was right-clicked. While a row is open the rows are not
//   rebuilt, so nothing on the sheet can take the editor away; they catch up
//   when it closes.
// - A BUBBLE CAN ASK TO BE FOUND HERE (22-Sep-2026). A specification bubble's
//   right-click menu on the sheet raises Na__LeSpec__LOCATE_EVENT; this tab
//   comes up, its section opens, a filter hiding the note is cleared, and the
//   note's row is scrolled to the middle of the column and pulses a halo
//   three times - "I am the note for that bubble".
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ calls RegisterTab straight after the
//   left column's first tab, and Register after that column's other sections.
//   It is the only module outside this folder that imports from it.
// // @delegate: ./Na__LayoutEditor__ScrapbookSpecification__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookSpecification__RowEditor__.js
// // @delegate: ../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - A row's right-click menu: Edit spec item (the row editor, with the caret
//   where the click was) and Open in Project Specification. F2 on a row
//   edits it too. The rows wait while one is open.
// - Locate: the answer to Na__LeSpec__LOCATE_EVENT - the tab up, the section
//   open, the filter cleared if it hid the note, the row centred and pulsing.
// - The hint and a row's hover text say a row can be right-clicked to edit.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation: the Specification tab, its one section, the rows,
//   the filter, Show full notes and the on-sheet counts.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Specification, the Menu, the Tile Drag, the Panel Host and the Library
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__OPEN_EVENT,
        Na__LeSpec__LOCATE_EVENT,
        Na__LeSpec__STATUS_FAILED,
        Na__LeSpec__GetState,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__EnsureLoaded,
        Na__LeSpec__GetNoteEntry
    } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeMenu__Open } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeScrapDrag__Tile, Na__LeScrapDrag__EndDrag } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LePanels__RegisterTab,
        Na__LePanels__RegisterSection,
        Na__LePanels__Refresh,
        Na__LePanels__SetActiveTab,
        Na__LePanels__SetFolded,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__GetContext,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeScrapSpec__TAB_ID,
        Na__LeScrapSpec__Ready,
        Na__LeScrapSpec__Label,
        Na__LeScrapSpec__Setup,
        Na__LeScrapSpec__Groups,
        Na__LeScrapSpec__UsageOnSheet,
        Na__LeScrapSpec__Look,
        Na__LeScrapSpec__BuildSet,
        Na__LeScrapSpec__Insert
    } from './Na__LayoutEditor__ScrapbookSpecification__.js';
    import {
        Na__LeScrapSpecEd__CanEdit,
        Na__LeScrapSpecEd__OffsetAtPoint,
        Na__LeScrapSpecEd__Open,
        Na__LeScrapSpecEd__Commit,
        Na__LeScrapSpecEd__Abandon,
        Na__LeScrapSpecEd__IsEditing,
        Na__LeScrapSpecEd__EditedNoteId,
        Na__LeScrapSpecEd__Element
    } from './Na__LayoutEditor__ScrapbookSpecification__RowEditor__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section, Storage and the Sheet Changes That Move a Count
    // ------------------------------------------------------------
    const Na__LePanelScrapSpec__ID            = 'scrapbook-specification';
    const Na__LePanelScrapSpec__COLUMN        = 'left';
    const Na__LePanelScrapSpec__FULL_KEY      = 'na-layouteditor-panel:scrapspec-full';   // <-- The panel host's prefix, so it sits with the other remembered panel states
    const Na__LePanelScrapSpec__TILE_MODIFIER = 'na-le-scrap__item--spec';
    const Na__LePanelScrapSpec__FILTER_WORD_MIN = 3;                            // <-- A shorter word is read as the start of a code, never searched for in the text
    const Na__LePanelScrapSpec__COUNT_REASONS = Object.freeze([ 'leader', 'leaders', 'active', 'loaded', 'sheet-created', 'sheet-deleted', 'sheet-updated' ]);   // <-- A bubble placed, deleted, linked or unlinked; another sheet; an undo or a redo
    const Na__LePanelScrapSpec__LOCATED_CLASS = 'is-located';                   // <-- The halo a located row pulses (the stylesheet's Na_LeScrapSpec_Locate)
    const Na__LePanelScrapSpec__LOCATED_ANIMATION = 'Na_LeScrapSpec_Locate';
    const Na__LePanelScrapSpec__LOCATED_MS    = 3200;                          // <-- The halo is taken off after this even if its animation never ended (a page the browser is not drawing runs none)
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Rows on Show, the Filter and the Wiring
    // ------------------------------------------------------------
    const Na__LePanelScrapSpec__Rows   = new Map();     // <-- noteId -> { tile, used, titleEl, bodyEl, note, count, code, text } - code and text in lower case, for the filter
    let   Na__LePanelScrapSpec__Heads  = [];            // <-- [{ heading, noteIds }], to put away a group the filter has emptied
    let   Na__LePanelScrapSpec__Signature = null;       // <-- What the rows were last built for, so a refresh per model change rebuilds nothing
    let   Na__LePanelScrapSpec__Filter = '';
    let   Na__LePanelScrapSpec__Full   = null;          // <-- null until first asked: the remembered choice, else the config's default
    let   Na__LePanelScrapSpec__Wired  = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Remembered Choices
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is Show Full Notes On (remembered, else the config's default)
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__IsFull() {
        if (Na__LePanelScrapSpec__Full !== null) return Na__LePanelScrapSpec__Full;
        let stored = null;
        try { stored = window.localStorage.getItem(Na__LePanelScrapSpec__FULL_KEY); } catch (error) { /* storage unavailable */ }
        return stored === null ? Na__LeScrapSpec__Setup().fullNotesDefault : stored === '1';   // <-- Not kept until it is chosen, so the config's default still reaches it
    }
    function Na__LePanelScrapSpec__SetFull(full) {
        Na__LePanelScrapSpec__Full = full === true;
        try { window.localStorage.setItem(Na__LePanelScrapSpec__FULL_KEY, Na__LePanelScrapSpec__Full ? '1' : '0'); } catch (error) { /* storage unavailable */ }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Notes as Rows
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Row's Tooltip: the Whole Note, What It Tags Here, and How to Place It
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__TitleFor(note, count, editable) {
        const L     = Na__LeScrapSpec__Label;
        const parts = [ L('RowTitle', '{code}  {title}\n\n{body}', { code : note.code, title : note.title || L('Untitled', 'Untitled note'), body : note.body }).trim() ];
        if (count === 1) parts.push(L('RowUsedOne', 'On this sheet: 1 bubble.'));
        if (count > 1)   parts.push(L('RowUsedMany', 'On this sheet: {count} bubbles.', { count : count }));
        if (editable)    parts.push(L('RowDrag', 'Drag onto the sheet, or double-click to place it in the middle of the view.') + '\n' + L('RowEdit', 'Right-click (or F2) to edit the note here.'));
        return parts.join('\n\n');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Note as the Tile Drag's Spec
    // ------------------------------------------------------------
    // The tile and the ghost draw the bubble bare; the drop is the library's,
    // which gives it its tail and its link. name is what a tile drag from
    // before captions would show, so an old cached copy still reads sensibly.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Spec(note, editable, row) {
        const L = Na__LeScrapSpec__Label;
        return {
            id       : 'specification:' + note.noteId,
            name     : note.title ? note.code + ' - ' + note.title : note.code,
            title    : Na__LePanelScrapSpec__TitleFor(note, 0, editable),
            editable : editable,
            modifier : Na__LePanelScrapSpec__TILE_MODIFIER,
            buildSet : () => Na__LeScrapSpec__BuildSet(note.noteId),
            place    : (sheet, centreMm) => Na__LeScrapSpec__Insert(sheet, note.noteId, centreMm),
            caption  : (element) => {
                const head  = document.createElement('span');
                head.className = 'na-le-scrapspec__head';
                const title = document.createElement('span');
                title.className   = 'na-le-scrapspec__title';
                title.textContent = note.title || L('Untitled', 'Untitled note');
                const used  = document.createElement('span');
                used.className = 'na-le-scrapspec__used';
                used.hidden    = true;
                head.appendChild(title);
                head.appendChild(used);
                element.appendChild(head);
                row.bodyEl = null;
                if (note.body.trim() !== '') {
                    const text = document.createElement('span');
                    text.className   = 'na-le-scrapspec__body';
                    text.textContent = note.body;
                    element.appendChild(text);
                    row.bodyEl = text;                                         // <-- Read by a right-click, to start the editor's caret on the word clicked
                }
                row.used    = used;
                row.titleEl = note.title ? title : null;                      // <-- "Untitled note" is not the note's text: no caret is found in it
            }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild Every Row From the Specification
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__BuildRows(list, groups, editable) {
        const L = Na__LeScrapSpec__Label;
        Na__LeScrapDrag__EndDrag();                                            // <-- A tile about to go must not be left holding a drag
        list.innerHTML = '';
        Na__LePanelScrapSpec__Rows.clear();
        Na__LePanelScrapSpec__Heads = [];
        groups.forEach((group) => {
            const heading = Na__LePanels__Note(L('GroupHeading', '{prefix} - {title}', { prefix : group.prefix, title : group.title || group.prefix }));
            heading.classList.add('na-le-note--heading');
            if (group.isGeneral) heading.title = L('GroupGeneral', 'A general group: its notes are listed in every sheet’s notes margin, tagged or not.');
            list.appendChild(heading);
            const head = { heading : heading, noteIds : [] };
            group.notes.forEach((note) => {
                const row = { tile : null, used : null, titleEl : null, bodyEl : null, note : note, count : 0,
                              code : String(note.code).toLowerCase(),
                              text : [ group.title, note.title, note.body ].join(' ').toLowerCase() };
                row.tile = Na__LeScrapDrag__Tile(Na__LePanelScrapSpec__Spec(note, editable, row));
                row.tile.setAttribute('data-na-scrapspec-note', note.noteId);
                // EDIT WHERE IT IS READ | The row's own menu, and F2 as for a
                // file name. Asked by note id, never by this row object: a save
                // rebuilds the rows.
                row.tile.addEventListener('contextmenu', (event) => Na__LePanelScrapSpec__OnRowMenu(event, note.noteId));
                row.tile.addEventListener('keydown', (event) => {
                    if (event.key !== 'F2' || event.repeat) return;
                    event.preventDefault();
                    event.stopPropagation();
                    Na__LePanelScrapSpec__Edit(note.noteId, null);
                });
                list.appendChild(row.tile);
                Na__LePanelScrapSpec__Rows.set(note.noteId, row);
                head.noteIds.push(note.noteId);
            });
            Na__LePanelScrapSpec__Heads.push(head);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Active Sheet's Counts Onto the Rows, in Place
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__ApplyCounts(editable) {
        const counts = Na__LeScrapSpec__UsageOnSheet(Na__LeModel__GetActiveSheet());
        Na__LePanelScrapSpec__Rows.forEach((row, noteId) => {
            const count = counts.get(noteId) || 0;
            if (count === row.count) return;
            row.count = count;
            row.tile.title = Na__LePanelScrapSpec__TitleFor(row.note, count, editable);
            if (!row.used) return;                                             // <-- A tile drag from before captions: the tooltip still says it
            row.used.hidden      = count === 0;
            row.used.textContent = count === 0 ? '' : Na__LeScrapSpec__Label('UsedMark', '×{count}', { count : count });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does One Typed Word Find a Row
    // ------------------------------------------------------------
    // THE START OF ITS CODE, or - for a word of FILTER_WORD_MIN letters or more
    // - anywhere in its group's title, its own title or its text. The length
    // rule is what makes a prefix useful: every prefix is two letters, and
    // "rf" or "ex" is inside half the words a specification is written in
    // (surface, interface, existing, extension), so matched against the text
    // a prefix found most of the list instead of its own group.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__WordFinds(row, word) {
        if (row.code.indexOf(word) === 0) return true;
        return word.length >= Na__LePanelScrapSpec__FILTER_WORD_MIN && row.text.indexOf(word) !== -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show Only the Rows the Filter Finds
    // ------------------------------------------------------------
    // Every word typed must find the row. A group with nothing left under it
    // is put away with its heading. active is false while the filter box is
    // not on show, so a filter left over from a longer specification never
    // hides a row unseen. Returns how many rows are on show.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__ApplyFilter(active) {
        const words = active ? Na__LePanelScrapSpec__Filter.toLowerCase().split(/\s+/).filter((word) => word !== '') : [];
        let shown = 0;
        Na__LePanelScrapSpec__Heads.forEach((head) => {
            let any = false;
            head.noteIds.forEach((noteId) => {
                const row = Na__LePanelScrapSpec__Rows.get(noteId);
                if (!row) return;
                const hit = words.every((word) => Na__LePanelScrapSpec__WordFinds(row, word));
                row.tile.hidden = !hit;
                if (hit) { any = true; shown++; }
            });
            head.heading.hidden = !any;
        });
        return shown;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editing a Row, and Finding One
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Toast(message, isError) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where in a Row a Client Point Is: { field, at }
    // ------------------------------------------------------------
    // The note's title or its text, and the character there - so the editor
    // opens with the caret in the word that was right-clicked. Anywhere else
    // on the row (the bubble, the gaps) is the end of the text.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__PointInRow(row, clientX, clientY) {
        const over = (el) => {
            if (!el) return false;
            const box = el.getBoundingClientRect();
            return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
        };
        if (over(row.titleEl)) {
            const at = Na__LeScrapSpecEd__OffsetAtPoint(row.titleEl, clientX, clientY);
            return { field : 'title', at : at === null ? 'end' : at };
        }
        if (over(row.bodyEl)) {
            const at = Na__LeScrapSpecEd__OffsetAtPoint(row.bodyEl, clientX, clientY);
            return { field : 'body', at : at === null ? 'end' : at };
        }
        return { field : 'body', at : 'end' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Row's Editor
    // ------------------------------------------------------------
    // where: { field, at } or null (the end of the text). A row open already
    // is saved first; its save rebuilds the rows, so the row is looked up by
    // its note afresh after it. Closing the editor lets the rows catch up and
    // keeps the note in view.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Edit(noteId, where) {
        const place = where || { field : 'body', at : 'end' };
        if (Na__LeScrapSpecEd__IsEditing() && Na__LeScrapSpecEd__EditedNoteId() !== noteId) {
            Na__LeScrapSpecEd__Commit('switch');
            if (Na__LeScrapSpecEd__IsEditing()) return false;                    // <-- It could not be saved: it stays open, and says why
        }
        const row = Na__LePanelScrapSpec__Rows.get(noteId);
        if (!row) return false;
        return Na__LeScrapSpecEd__Open(row, {
            field    : place.field,
            at       : place.at,
            onClosed : (closedId) => {
                Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);                 // <-- The rows held back while it was open catch up
                window.requestAnimationFrame(() => {                             // <-- After the save's own rebuild, which is announced straight after this
                    const again = Na__LePanelScrapSpec__Rows.get(closedId);
                    if (again && again.tile.isConnected && !again.tile.hidden) Na__LePanelScrapSpec__Reveal(again.tile, false);
                });
            }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Row's Right-Click Menu
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__OnRowMenu(event, noteId) {
        event.preventDefault();
        const row = Na__LePanelScrapSpec__Rows.get(noteId);
        if (!row) return;
        const L     = Na__LeScrapSpec__Label;
        const can   = Na__LeScrapSpecEd__CanEdit();
        const where = Na__LePanelScrapSpec__PointInRow(row, event.clientX, event.clientY);   // <-- Read now, while the row is where the pointer was
        Na__LeMenu__Open(event.clientX, event.clientY, [
            { label : L('MenuEdit', 'Edit spec item'), hint : can.ok ? row.note.code : L('MenuEditOff', 'read-only'), disabled : !can.ok,
              onSelect : () => { Na__LePanelScrapSpec__Edit(noteId, where); } },
            { separator : true },
            { label : L('MenuOpenSpec', 'Open in Project Specification'),
              onSelect : () => window.dispatchEvent(new CustomEvent(Na__LeSpec__OPEN_EVENT, { detail : { noteId : noteId } })) }
        ]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring a Row Into View, Pulsing a Halo When Asked
    // ------------------------------------------------------------
    // The halo is three soft pulses (the stylesheet's Na_LeScrapSpec_Locate),
    // started again if the same row is found twice, and taken off when the
    // animation ends - or after LOCATED_MS, should it never end. It pulses
    // whatever the operating system's animation setting, as the stylesheet
    // explains: the studio PC reports reduced motion, and a still wash there
    // would lose the very thing asked for.
    // ------------------------------------------------------------
    const Na__LePanelScrapSpec__Halos = new WeakMap();                          // <-- element -> the function that takes its halo off
    function Na__LePanelScrapSpec__Reveal(target, pulse) {
        if (!target || !target.isConnected) return;
        try { target.scrollIntoView({ block : pulse ? 'center' : 'nearest', behavior : pulse ? 'smooth' : 'auto' }); }
        catch (error) { target.scrollIntoView(); }
        if (!pulse) return;
        const earlier = Na__LePanelScrapSpec__Halos.get(target);
        if (earlier) earlier();                                                // <-- Found twice: the first halo goes, listener and timer with it
        const cls   = Na__LePanelScrapSpec__LOCATED_CLASS;
        let   timer = 0;
        const onEnd = (event) => { if (event.animationName === Na__LePanelScrapSpec__LOCATED_ANIMATION) off(); };
        const off   = () => {
            target.classList.remove(cls);
            target.removeEventListener('animationend', onEnd);
            window.clearTimeout(timer);
            if (Na__LePanelScrapSpec__Halos.get(target) === off) Na__LePanelScrapSpec__Halos.delete(target);
        };
        void target.offsetWidth;                                               // <-- A class taken off and put straight back starts the animation again
        target.classList.add(cls);
        target.addEventListener('animationend', onEnd);
        timer = window.setTimeout(off, Na__LePanelScrapSpec__LOCATED_MS);
        Na__LePanelScrapSpec__Halos.set(target, off);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show a Note in This Tab: the Tab Up, the Row Centred and Pulsing
    // ------------------------------------------------------------
    // The answer to Na__LeSpec__LOCATE_EVENT, raised by a specification
    // bubble's right-click menu on the sheet. A filter that hides the note is
    // cleared - a filter never keeps a note from being found. A note being
    // edited is found as its editor. Resolves true when it was shown.
    // ------------------------------------------------------------
    async function Na__LePanelScrapSpec__Locate(noteId) {
        const L = Na__LeScrapSpec__Label;
        if (typeof noteId !== 'string' || noteId === '') return false;
        Na__LePanels__SetActiveTab(Na__LePanelScrapSpec__COLUMN, Na__LeScrapSpec__TAB_ID);
        Na__LePanels__SetFolded(Na__LePanelScrapSpec__ID, false);
        if (!Na__LeSpec__IsLoaded()) await Na__LeSpec__EnsureLoaded();
        Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);
        let row = Na__LePanelScrapSpec__Rows.get(noteId);
        if (!row) {
            Na__LePanelScrapSpec__Toast(L('LocateMissing', 'That note is not in the project specification any more.'), true);
            return false;
        }
        if (row.tile.hidden && Na__LePanelScrapSpec__Filter !== '') {
            Na__LePanelScrapSpec__Filter = '';                                 // <-- The box shows it: Refresh writes the filter back into it
            Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);
            row = Na__LePanelScrapSpec__Rows.get(noteId) || row;
        }
        const editor = Na__LeScrapSpecEd__EditedNoteId() === noteId ? Na__LeScrapSpecEd__Element() : null;
        Na__LePanelScrapSpec__Reveal(editor || row.tile, true);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Section Body
    // ------------------------------------------------------------
    // The filter and the toggle are made by hand rather than by the host's
    // Input: that one is disabled with the sheets, and reading the
    // specification is never a thing to switch off.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Build(body) {
        const L    = Na__LeScrapSpec__Label;
        const part = (name, element) => { element.setAttribute('data-na-scrapspec', name); return element; };
        if (Na__LeScrapSpecEd__IsEditing()) Na__LeScrapSpecEd__Commit('switch');   // <-- A row left open in the body this one replaces: what was typed is kept, not stranded
        if (Na__LeScrapSpecEd__IsEditing()) Na__LeScrapSpecEd__Abandon();          // <-- ...and one that could not be kept is let go, rather than holding the new rows back for ever

        body.appendChild(part('note', Na__LePanels__Note('')));

        const tools  = part('tools', document.createElement('div'));
        tools.className = 'na-le-scrapspec__tools';
        const filter = part('filter', document.createElement('input'));
        filter.type         = 'search';
        filter.className    = 'na-le-input na-le-scrapspec__filter';
        filter.autocomplete = 'off';
        filter.spellcheck   = false;
        filter.setAttribute('data-na-control', 'scrapspec-filter');
        tools.appendChild(filter);

        const full  = part('full-row', document.createElement('label'));
        full.className = 'na-le-row na-le-row--toggle';
        const fullCaption = document.createElement('span');
        fullCaption.className = 'na-le-row__label';
        part('full-caption', fullCaption);
        const fullBox = document.createElement('input');
        fullBox.type      = 'checkbox';
        fullBox.className = 'na-le-input na-le-input--check';
        fullBox.setAttribute('data-na-control', 'scrapspec-full');
        full.appendChild(fullCaption);
        full.appendChild(fullBox);
        tools.appendChild(full);
        body.appendChild(tools);

        const list = part('list', document.createElement('div'));
        list.className = 'na-le-scrapspec';
        body.appendChild(list);

        body.appendChild(part('none', Na__LePanels__Note('')));

        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(part('open', Na__LePanels__Button(L('OpenSpec', 'Open Project Specification'), 'scrapspec-open', '')));
        body.appendChild(bar);

        Na__LePanelScrapSpec__Rows.clear();                                     // <-- A new body has no rows yet
        Na__LePanelScrapSpec__Heads     = [];
        Na__LePanelScrapSpec__Signature = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Line Above the List: What It Is, or Why It Is Empty
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Status(state, total, editable) {
        const L = Na__LeScrapSpec__Label;
        if (!state.loaded) {
            if (state.status === Na__LeSpec__STATUS_FAILED) return { text : L('Failed', 'The project specification could not be read, so there are no notes to list yet.'), warn : true };
            return { text : L('Loading', 'Loading the project specification...'), warn : false };
        }
        if (total === 0) return { text : L('Empty', 'This project’s specification has no notes yet. Write them on the Project Specification tab and they appear here, each as a bubble ready to drag onto a sheet.'), warn : false };
        let text = editable
            ? L('Hint', 'Drag a bubble onto the sheet: it lands as a specification bubble linked to that note. Then drag its square endpoint onto what it describes. Double-click a row to place one in the middle of the view. Right-click a row to edit its note here.')
            : L('ReadOnly', 'The project specification’s codes and notes. Bubbles can only be placed while sheets are editable.');
        if (state.status === Na__LeSpec__STATUS_FAILED) text += ' ' + L('Offline', 'The cloud copy could not be read: these are the notes kept in this browser.');
        return { text : text, warn : state.status === Na__LeSpec__STATUS_FAILED };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Specification, the Active Sheet and the Filter
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Refresh(body) {
        const L        = Na__LeScrapSpec__Label;
        const setup    = Na__LeScrapSpec__Setup();
        const state    = Na__LeSpec__GetState();
        const editable = Na__LePanels__IsEditable();
        const groups   = Na__LeScrapSpec__Groups();
        const total    = groups.reduce((sum, group) => sum + group.notes.length, 0);
        const el       = (name) => body.querySelector('[data-na-scrapspec="' + name + '"]');
        const list     = el('list');
        if (!list) return;

        // THE WORDS | Set on every refresh: the config may have arrived since the body was built
        const status = Na__LePanelScrapSpec__Status(state, total, editable);
        el('note').textContent = status.text;
        el('note').classList.toggle('na-le-note--warn', status.warn);
        el('filter').placeholder      = L('FilterHolder', 'Filter by code or words');
        el('filter').title            = L('FilterTitle', 'Type a code (RF02), a prefix (RF), or words from a note of three letters or more. Escape clears it.');
        el('full-caption').textContent = L('FullNotes', 'Show full notes');
        el('full-row').title          = L('FullNotesTitle', 'List every note in full, instead of its first few lines.');
        el('open').textContent        = L('OpenSpec', 'Open Project Specification');

        // THE ROWS | Rebuilt only when what they are built from has changed -
        // and never under a row being edited, which a rebuild would take away
        // with whatever was typed into it. They wait, and catch up when it
        // closes. A note that has gone from the specification meanwhile takes
        // its editor with it.
        const signature = JSON.stringify([ editable, Na__LeScrapSpec__Look(), groups ]);
        const editing   = Na__LeScrapSpecEd__EditedNoteId();
        if (signature !== Na__LePanelScrapSpec__Signature && editing && !Na__LeSpec__GetNoteEntry(editing)) Na__LeScrapSpecEd__Abandon();
        if (signature !== Na__LePanelScrapSpec__Signature && !Na__LeScrapSpecEd__IsEditing()) {
            Na__LePanelScrapSpec__Signature = signature;
            Na__LePanelScrapSpec__BuildRows(list, groups, editable);
        }
        Na__LePanelScrapSpec__ApplyCounts(editable);

        // THE CONTROLS | The toggle with any note at all; the filter once there are enough to need one
        const filtering = total >= setup.filterMinNotes && total > 0;
        const full      = Na__LePanelScrapSpec__IsFull();
        el('tools').hidden    = total === 0;
        el('filter').hidden   = !filtering;
        if (document.activeElement !== el('filter')) el('filter').value = Na__LePanelScrapSpec__Filter;
        el('full-row').querySelector('input').checked = full;
        list.classList.toggle('is-full', full);
        list.style.setProperty('--Na_LeScrapSpec_ClampLines', String(setup.bodyClampLines));

        const shown = Na__LePanelScrapSpec__ApplyFilter(filtering);
        const none  = el('none');
        none.hidden      = !(total > 0 && shown === 0);
        none.textContent = none.hidden ? '' : L('FilterNone', 'No note matches "{text}".', { text : Na__LePanelScrapSpec__Filter.trim() });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wiring and Registration
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Link the Stylesheet and Listen (once)
    // ------------------------------------------------------------
    // The stylesheet is this folder's own and is linked from here, as the
    // Drawing Register and the other scrapbooks link theirs. The specification
    // announces every change to its notes; the sheet model announces a bubble
    // placed, deleted, linked or unlinked under reasons the mode controller
    // routes to the Leaders panel alone, so this section asks for itself.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Wire() {
        if (Na__LePanelScrapSpec__Wired) return;
        Na__LePanelScrapSpec__Wired = true;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__ScrapbookSpecification__.css', import.meta.url).href;
        document.head.appendChild(link);
        window.addEventListener(Na__LeSpec__CHANGED_EVENT, () => Na__LePanels__Refresh(Na__LePanelScrapSpec__ID));
        window.addEventListener(Na__LeModel__CHANGED_EVENT, (event) => {
            const reason = (event && event.detail) ? event.detail.reason : '';
            if (Na__LePanelScrapSpec__COUNT_REASONS.indexOf(reason) !== -1) Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);
        });
        window.addEventListener(Na__LeSpec__LOCATE_EVENT, (event) => {          // <-- A bubble's Show in Specification, from the sheet's right-click menu
            void Na__LePanelScrapSpec__Locate(event && event.detail ? event.detail.noteId : null);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Add the Specification Tab to the Left Column
    // ------------------------------------------------------------
    // Called by the mode controller after the column's first tab, so the
    // sections that name no tab stay on that one. Its wording follows the
    // config once that has been read.
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__RegisterTab() {
        Na__LePanelScrapSpec__Wire();
        const L   = Na__LeScrapSpec__Label;
        const tab = Na__LePanels__RegisterTab(Na__LePanelScrapSpec__COLUMN, { id : Na__LeScrapSpec__TAB_ID, title : L('TabTitle', 'Specification'), hint : L('TabHint', 'The project specification’s codes and notes, as bubbles to drag onto the sheet.') });
        if (tab) Na__LeScrapSpec__Ready().then(() => {
            tab.button.textContent = L('TabTitle', 'Specification');
            tab.button.title       = L('TabHint', 'The project specification’s codes and notes, as bubbles to drag onto the sheet.');
        });
        return tab;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelScrapSpec__Register() {
        Na__LePanelScrapSpec__Wire();
        const L  = Na__LeScrapSpec__Label;
        const on = Na__LePanels__OnControl;
        on('input',   'scrapspec-filter', (event, el) => { Na__LePanelScrapSpec__Filter = el.value; Na__LePanels__Refresh(Na__LePanelScrapSpec__ID); });
        on('keydown', 'scrapspec-filter', (event, el) => {
            if (event.key !== 'Escape' || el.value === '') return;
            event.preventDefault();
            event.stopPropagation();                                            // <-- The filter's Escape, not the sheet tools'
            el.value = '';
            Na__LePanelScrapSpec__Filter = '';
            Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);
        });
        on('change',  'scrapspec-full',   (event, el) => { Na__LePanelScrapSpec__SetFull(el.checked); Na__LePanels__Refresh(Na__LePanelScrapSpec__ID); });
        on('click',   'scrapspec-open',   () => window.dispatchEvent(new CustomEvent(Na__LeSpec__OPEN_EVENT, { detail : {} })));
        const entry = Na__LePanels__RegisterSection(Na__LePanelScrapSpec__COLUMN, {
            id : Na__LePanelScrapSpec__ID, title : L('SectionTitle', 'Specification Scrapbook'), tab : Na__LeScrapSpec__TAB_ID,
            build : Na__LePanelScrapSpec__Build, refresh : Na__LePanelScrapSpec__Refresh
        });
        Na__LeScrapSpec__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = L('SectionTitle', 'Specification Scrapbook');
            Na__LePanels__Refresh(Na__LePanelScrapSpec__ID);                    // <-- The config's words, its clamp and its default for full notes
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Specification Scrapbook Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelScrapSpec__RegisterTab,
        Na__LePanelScrapSpec__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
