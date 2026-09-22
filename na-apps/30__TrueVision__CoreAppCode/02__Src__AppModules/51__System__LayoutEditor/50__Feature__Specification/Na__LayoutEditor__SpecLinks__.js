// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION LINKS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecLinks__.js
// NAMESPACE  : Na__LeSpecLink
// MODULE     : Layout Editor - Specification Links
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Tie specification bubbles to project specification notes: link by typed code, keep every linked code current, and say where each note is used
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A LINK IS AN ID, NOT A CODE. A specification bubble linked to a note
//   carries Leader__SpecNoteId. Its code comes from the note's place in the
//   specification, so when a note is moved, moved to another group or its
//   group re-prefixed, every bubble linked to it on every sheet reads the new
//   code - nobody re-types a code on a drawing.
// - HOW A BUBBLE GETS LINKED. Typing a code into a bubble links it to the note
//   that has that code ("ee2" finds EE02, and the bubble then reads EE02); a
//   code no note has leaves the bubble unlinked, showing what was typed. A new
//   bubble whose suggested code a note already has starts linked. The Leaders
//   panel links or unlinks the selected bubble by choosing a note, and the
//   Project Specification tab links every unlinked bubble that already reads a
//   note's code. Nothing is linked behind anyone's back: a renumber never
//   captures an unlinked bubble that happens to read the new code.
// - STAMPED AS WELL AS RESOLVED. The code is resolved as the bubble is drawn
//   (the resolver registered with Na__LayoutEditor__LeaderGeometry__), so the
//   paper and the PDF are right the moment the specification changes. It is
//   also written into Leader__Text (Propagate), silently - a derived value, not
//   an edit, so it takes no undo step - so the saved drawings read correctly
//   to anything that opens them without the specification, and a bubble whose
//   note was deleted keeps the last code it showed.
// - USAGE. Where each note is used (which sheets, which bubbles), the unlinked
//   bubbles that read an existing code, the bubbles whose linked note has gone,
//   and the codes typed into bubbles that no note has.
//
// INTEGRATION:
// - Initialised by the mode controller. Read by Na__LayoutEditor__SpecMargin__,
//   __SpecEditor__, __Panel__Leaders__ and __LeaderTool__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.2.0
// - NoteOf, registered as the leader geometry's note resolver: the note a
//   bubble stands for - linked to it, or unlinked and reading its code - with
//   its id, code and title, and locate(), which raises LOCATE_EVENT for it. A
//   bubble's hover tooltip on the sheet names it, and the bubble's right-click
//   menu shows it in the drawing's Specification tab.
//
// 18-Sep-2026 - Version 1.1.0
// - Registers the leader geometry's broken-link resolver alongside the code
//   resolver, so a bubble linked to a deleted note can be asked about by
//   Na__LeLeadGeo__IsBroken - the paper halo and the hover tooltip both read
//   it, without either importing the specification.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model, Specification Data and Leader Geometry
    // ------------------------------------------------------------
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetSheets,
        Na__LeModel__GetLeaders,
        Na__LeModel__UpdateLeader,
        Na__LeModel__IsLayerVisible
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSpec__CHANGED_EVENT,
        Na__LeSpec__LOCATE_EVENT,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__GetNoteEntry,
        Na__LeSpec__CodeFor,
        Na__LeSpec__FindByCode,
        Na__LeSpec__NormaliseCode
    } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeLeadGeo__TYPE_BUBBLE, Na__LeLeadGeo__Lines, Na__LeLeadGeo__SetCodeResolver, Na__LeLeadGeo__SetBrokenResolver, Na__LeLeadGeo__SetNoteResolver } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Initialised Once
    // ------------------------------------------------------------
    let Na__LeSpecLink__Ready = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading a Leader
// -----------------------------------------------------------------------------

    // FUNCTION | Is a Leader a Specification Bubble
    // ------------------------------------------------------------
    function Na__LeSpecLink__IsBubble(leader) {
        return !!leader && leader.Leader__Type === Na__LeLeadGeo__TYPE_BUBBLE;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Note Id a Leader Links To (null when it links to none)
    // ------------------------------------------------------------
    function Na__LeSpecLink__NoteIdOf(leader) {
        return (leader && typeof leader.Leader__SpecNoteId === 'string' && leader.Leader__SpecNoteId) ? leader.Leader__SpecNoteId : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Everything About a Leader's Link: { state, entry, code, shown }
    // ------------------------------------------------------------
    // state:
    //   'none'      not a specification bubble
    //   'pending'   a linked bubble, and the specification has not loaded yet
    //   'linked'    linked to a note that exists; entry and code are that note's
    //   'broken'    linked to a note no longer in the specification; code is null
    //   'matches'   unlinked, and what it reads is a note's code (entry is that note)
    //   'unknown'   unlinked, and what it reads looks like a code no note has
    //   'unlinked'  unlinked, and what it reads is not a code at all
    // shown is the text the bubble displays.
    // ------------------------------------------------------------
    function Na__LeSpecLink__Describe(leader) {
        if (!Na__LeSpecLink__IsBubble(leader)) return { state : 'none', entry : null, code : null, shown : '' };
        const shown  = Na__LeLeadGeo__Lines(leader)[0] || '';
        const noteId = Na__LeSpecLink__NoteIdOf(leader);
        if (noteId) {
            if (!Na__LeSpec__IsLoaded()) return { state : 'pending', entry : null, code : null, shown : shown };
            const entry = Na__LeSpec__GetNoteEntry(noteId);
            return entry ? { state : 'linked', entry : entry, code : entry.code, shown : shown } : { state : 'broken', entry : null, code : null, shown : shown };
        }
        if (!Na__LeSpec__IsLoaded()) return { state : 'unlinked', entry : null, code : null, shown : shown };
        const entry = Na__LeSpec__FindByCode(shown);
        if (entry) return { state : 'matches', entry : entry, code : entry.code, shown : shown };
        return { state : Na__LeSpec__NormaliseCode(shown) ? 'unknown' : 'unlinked', entry : null, code : null, shown : shown };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Note a Bubble Stands For: { noteId, code, title, linked, locate } or null
    // ------------------------------------------------------------
    // A bubble linked to a note that exists, or an unlinked one that reads a
    // note's code (linked false): the two states that count as a use of the
    // note on the Project Specification tab. A broken link, a code no note has
    // and a specification not yet loaded all answer null. Registered with the
    // leader geometry as its note resolver (Na__LeLeadGeo__NoteFor).
    // locate() raises LOCATE_EVENT for the note - the drawing's Specification
    // tab answers it - so the sheet's menu can offer Show in Specification
    // without importing the specification to learn the event's name.
    // ------------------------------------------------------------
    function Na__LeSpecLink__NoteOf(leader) {
        const info = Na__LeSpecLink__Describe(leader);
        if ((info.state !== 'linked' && info.state !== 'matches') || !info.entry) return null;
        const noteId = info.entry.note.Note__Id;
        return {
            noteId : noteId,
            code   : info.code,
            title  : info.entry.note.Note__Title || '',
            linked : info.state === 'linked',
            locate : () => window.dispatchEvent(new CustomEvent(Na__LeSpec__LOCATE_EVENT, { detail : { noteId : noteId, leaderId : leader.Leader__Id } }))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Linking
// -----------------------------------------------------------------------------

    // FUNCTION | The Patch That Commits Text Typed Into a Leader
    // ------------------------------------------------------------
    // A note leader just takes the text. A bubble typed with a note's code
    // links to that note and reads its code exactly; a bubble typed with
    // anything else keeps the text and lets go of any note it was linked to.
    // Before the specification has loaded nothing can be matched, so a linked
    // bubble given DIFFERENT text lets go of its note rather than having the
    // next stamp write the old code back over what was typed.
    // ------------------------------------------------------------
    function Na__LeSpecLink__PatchForText(leader, text) {
        const patch = { text : text };
        if (!Na__LeSpecLink__IsBubble(leader)) return patch;
        const linked = Na__LeSpecLink__NoteIdOf(leader);
        if (!Na__LeSpec__IsLoaded()) {
            if (linked && text !== leader.Leader__Text) patch.specNoteId = null;
            return patch;
        }
        const entry = Na__LeSpec__FindByCode(text);
        if (entry) { patch.text = entry.code; patch.specNoteId = entry.note.Note__Id; }
        else if (linked) patch.specNoteId = null;
        return patch;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a New Leader Starts With: { text, specNoteId }
    // ------------------------------------------------------------
    // A bubble whose first code is already a note's starts linked to it.
    // ------------------------------------------------------------
    function Na__LeSpecLink__StartFor(type, text) {
        if (type !== Na__LeLeadGeo__TYPE_BUBBLE || !Na__LeSpec__IsLoaded()) return { text : text, specNoteId : undefined };
        const entry = Na__LeSpec__FindByCode(text);
        return entry ? { text : entry.code, specNoteId : entry.note.Note__Id } : { text : text, specNoteId : undefined };
    }
    // ------------------------------------------------------------


    // FUNCTION | Link a Bubble to a Note, or Unlink It (noteId null): One Undo Step
    // ------------------------------------------------------------
    function Na__LeSpecLink__Link(sheet, leaderId, noteId) {
        const leader = Na__LeModel__GetLeaders(sheet).find((l) => l.Leader__Id === leaderId);
        if (!leader || !Na__LeSpecLink__IsBubble(leader)) return false;
        if (!noteId) return Na__LeModel__UpdateLeader(sheet, leaderId, { specNoteId : null });
        const code = Na__LeSpec__CodeFor(noteId);
        if (!code) return false;
        return Na__LeModel__UpdateLeader(sheet, leaderId, { specNoteId : noteId, text : code });
    }
    // ------------------------------------------------------------


    // FUNCTION | Link Every Unlinked Bubble That Reads a Note's Code (only one note's, when named)
    // ------------------------------------------------------------
    // One announcement per sheet touched, the last link on it, so each sheet
    // takes one undo step however many of its bubbles were linked. Returns the
    // number linked.
    // ------------------------------------------------------------
    function Na__LeSpecLink__LinkMatching(noteId) {
        if (!Na__LeSpec__IsLoaded()) return 0;
        let total = 0;
        Na__LeModel__GetSheets().forEach((sheet) => {
            const found = [];
            Na__LeModel__GetLeaders(sheet).forEach((leader) => {
                if (!Na__LeSpecLink__IsBubble(leader) || Na__LeSpecLink__NoteIdOf(leader)) return;
                const entry = Na__LeSpec__FindByCode(Na__LeLeadGeo__Lines(leader)[0] || '');
                if (entry && (!noteId || entry.note.Note__Id === noteId)) found.push({ leader : leader, entry : entry });
            });
            found.forEach((item, i) => {
                Na__LeModel__UpdateLeader(sheet, item.leader.Leader__Id, { specNoteId : item.entry.note.Note__Id, text : item.entry.code }, i < found.length - 1);
            });
            total += found.length;
        });
        return total;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write Every Linked Bubble's Current Code Into Its Text (silent)
    // ------------------------------------------------------------
    // A derived value, not an edit: no announcement, no undo step, though the
    // sheets are marked unsaved so Save Sheets carries the new codes. A bubble
    // whose note has gone is left reading its last code. Returns how many
    // bubbles were re-stamped.
    // ------------------------------------------------------------
    function Na__LeSpecLink__Propagate() {
        if (!Na__LeSpec__IsLoaded()) return 0;
        let count = 0;
        Na__LeModel__GetSheets().forEach((sheet) => {
            Na__LeModel__GetLeaders(sheet).forEach((leader) => {
                const noteId = Na__LeSpecLink__IsBubble(leader) ? Na__LeSpecLink__NoteIdOf(leader) : null;
                const code   = noteId ? Na__LeSpec__CodeFor(noteId) : null;
                if (!code || leader.Leader__Text === code) return;
                Na__LeModel__UpdateLeader(sheet, leader.Leader__Id, { text : code }, true);
                count++;
            });
        });
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Usage
// -----------------------------------------------------------------------------

    // FUNCTION | The Note Ids a Sheet's Bubbles Link To (visibleOnly skips hidden layers)
    // ------------------------------------------------------------
    function Na__LeSpecLink__LinkedNoteIds(sheet, visibleOnly) {
        const ids = new Set();
        Na__LeModel__GetLeaders(sheet).forEach((leader) => {
            if (!Na__LeSpecLink__IsBubble(leader)) return;
            if (visibleOnly && !Na__LeModel__IsLayerVisible(sheet, leader.Leader__LayerId)) return;
            const noteId = Na__LeSpecLink__NoteIdOf(leader);
            if (noteId) ids.add(noteId);
        });
        return ids;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where Everything Is Used, Across Every Sheet
    // ------------------------------------------------------------
    // Returns {
    //   byNote     Map noteId -> [{ sheet, leader }]   bubbles linked to a note that exists
    //   matching   Map noteId -> [{ sheet, leader }]   unlinked bubbles reading that note's code
    //   broken     [{ sheet, leader, noteId }]         linked to a note no longer there
    //   unknown    Map code -> [{ sheet, leader }]     unlinked bubbles reading a code no note has
    // }
    // ------------------------------------------------------------
    function Na__LeSpecLink__Usage() {
        const usage = { byNote : new Map(), matching : new Map(), broken : [], unknown : new Map() };
        if (!Na__LeSpec__IsLoaded()) return usage;
        const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
        Na__LeModel__GetSheets().forEach((sheet) => {
            Na__LeModel__GetLeaders(sheet).forEach((leader) => {
                const info = Na__LeSpecLink__Describe(leader);
                if (info.state === 'linked')  add(usage.byNote, info.entry.note.Note__Id, { sheet : sheet, leader : leader });
                if (info.state === 'matches') add(usage.matching, info.entry.note.Note__Id, { sheet : sheet, leader : leader });
                if (info.state === 'broken')  usage.broken.push({ sheet : sheet, leader : leader, noteId : Na__LeSpecLink__NoteIdOf(leader) });
                if (info.state === 'unknown') add(usage.unknown, Na__LeSpec__NormaliseCode(info.shown), { sheet : sheet, leader : leader });
            });
        });
        return usage;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Resolver and Keep the Stamps Current (once)
    // ------------------------------------------------------------
    // Stamps after the specification loads or moves a code, and after the
    // sheets are loaded, restored from a draft, or undone and redone - an old
    // snapshot can carry an old code. Every one of those events already asks
    // for a redraw, and a redraw waits for the next animation frame, so the
    // stamps land before anything paints.
    // ------------------------------------------------------------
    function Na__LeSpecLink__Initialize() {
        if (Na__LeSpecLink__Ready) return true;
        Na__LeSpecLink__Ready = true;
        Na__LeLeadGeo__SetCodeResolver((leader) => (Na__LeSpec__IsLoaded() ? Na__LeSpec__CodeFor(leader.Leader__SpecNoteId) : null));
        Na__LeLeadGeo__SetBrokenResolver((leader) => Na__LeSpec__IsLoaded() && typeof leader.Leader__SpecNoteId === 'string' && !Na__LeSpec__GetNoteEntry(leader.Leader__SpecNoteId));
        Na__LeLeadGeo__SetNoteResolver(Na__LeSpecLink__NoteOf);             // <-- The bubble's hover tooltip and its Show in Specification row ask this
        window.addEventListener(Na__LeSpec__CHANGED_EVENT, (event) => {
            const detail = event.detail || {};
            if (detail.codesChanged) Na__LeSpecLink__Propagate();
        });
        window.addEventListener(Na__LeModel__CHANGED_EVENT, (event) => {
            const detail = event.detail || {};
            if (detail.reason === 'loaded' || detail.restore) Na__LeSpecLink__Propagate();
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Links API
    // ------------------------------------------------------------
    export {
        Na__LeSpecLink__Initialize,
        Na__LeSpecLink__IsBubble,
        Na__LeSpecLink__NoteIdOf,
        Na__LeSpecLink__Describe,
        Na__LeSpecLink__NoteOf,
        Na__LeSpecLink__PatchForText,
        Na__LeSpecLink__StartFor,
        Na__LeSpecLink__Link,
        Na__LeSpecLink__LinkMatching,
        Na__LeSpecLink__Propagate,
        Na__LeSpecLink__LinkedNoteIds,
        Na__LeSpecLink__Usage
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
