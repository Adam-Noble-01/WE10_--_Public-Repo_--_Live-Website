// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - NOTE TOOLTIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__NoteTooltip__.js
// NAMESPACE  : Na__LeNoteTip
// MODULE     : Layout Editor - Sheet Tools - Specification Bubble Note Tooltip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A specification bubble names its note when the pointer rests on it: its code and its note's title, beside the pointer
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 22-Sep: zoomed in on a drawing, the notes margin is off the
//   screen and EW01 is only four letters in a circle. Rest the pointer on the
//   bubble a moment and it says "EW01  Loggia Arcade" - no panning out to the
//   margin, no trip to another tab.
// - AFTER A MOMENT, NOT AT ONCE: the Leader config's NoteTooltipMs (500 ms),
//   the wait a tooltip keeps everywhere, so sweeping the pointer across a
//   drawing crowded with bubbles does not flicker a label under it. Moving
//   from one bubble straight onto the next, while a label is up, names the
//   next at once, as a menu bar's tooltips do.
// - THE BUBBLE ITSELF. The circle with the code, not its tail or its tip:
//   those lie on the drawing, and a label over the drawing every time the
//   pointer crosses a leader would be in the way.
// - WHICH BUBBLES. One linked to a note, and an unlinked one that reads a
//   note's code - the note is asked of the leader geometry's note resolver,
//   which the specification registers, so this module imports nothing of the
//   specification. A bubble inside a group is found through the group. A
//   bubble on a LOCKED layer still names its note: reading is not editing.
//   One on a REFERENCE layer does not - the layer model's rule is that no
//   click, box, hover or snap finds anything there. A broken bubble keeps the
//   message the hover pass already gives it (RefreshBrokenTooltip).
// - OFF AGAIN on a press, a wheel turn, a key, the pointer leaving the sheet,
//   the window losing the focus, a drag, or another tool: the label is a
//   courtesy and never stands over something being worked on.
// - The label is the shared hover tooltip (Na__LayoutEditor__SheetTools__HoverTooltip__),
//   the code in bold before the title.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerDrag__ hands every Select or Move
//   hover to Hover, and Cancel on the way into a drag.
// - Na__LayoutEditor__SheetTools__ attaches and detaches the stage listeners
//   with the tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.144.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Layers, Leader Geometry, the Shared Tooltip and Hit Resolution
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLeaderSetup, Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__IsLayerVisible, Na__LeModel__IsLayerLocked, Na__LeModel__IsLayerSelectable } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLeadGeo__TYPE_BUBBLE, Na__LeLeadGeo__Hit, Na__LeLeadGeo__NoteFor } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeHoverTip__Show, Na__LeHoverTip__Hide } from './Na__LayoutEditor__SheetTools__HoverTooltip__.js';
    import { Na__LeTools__Tolerance, Na__LeTools__Record, Na__LeTools__RawHit } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Long a Label Stays "Warm" for the Next Bubble
    // ------------------------------------------------------------
    const Na__LeNoteTip__WARM_MS   = 400;                                       // <-- A label dropped for another bubble names that one at once, within this
    const Na__LeNoteTip__MODIFIERS = Object.freeze([ 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock' ]);   // <-- Held, not pressed: they leave the label up
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Label Waiting, the Label Up, and the Stage Listened To
    // ------------------------------------------------------------
    let Na__LeNoteTip__Pending   = null;    // <-- { key, lead, text, clientX, clientY, timer, stillWanted }
    let Na__LeNoteTip__Shown     = null;    // <-- { key, lead, text }
    let Na__LeNoteTip__WarmUntil = 0;
    let Na__LeNoteTip__Stage     = null;
    let Na__LeNoteTip__Handlers  = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Bubble, Which Note
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Bubble on a Locked Layer Under a Paper Point (the pick passes those by)
    // ------------------------------------------------------------
    // Only layers that are shown, locked and not reference layers are looked
    // at, and a sheet with none - the usual sheet - costs one pass over its
    // layers. Front to back: the last leader drawn is the one on top.
    // ------------------------------------------------------------
    function Na__LeNoteTip__LockedBubbleAt(sheet, pointMm, tol) {
        const layers = Array.isArray(sheet.Sheet__Layers) ? sheet.Sheet__Layers : [];
        const held   = new Set();
        layers.forEach((layer) => {
            const id = layer ? layer.Layer__Id : null;
            if (id && Na__LeModel__IsLayerLocked(sheet, id) && Na__LeModel__IsLayerVisible(sheet, id) && Na__LeModel__IsLayerSelectable(sheet, id)) held.add(id);
        });
        if (!held.size) return null;
        const leaders = sheet.Sheet__Leaders || [];
        for (let i = leaders.length - 1; i >= 0; i--) {
            const leader = leaders[i];
            if (!leader || leader.Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE || !held.has(leader.Leader__LayerId)) continue;
            if (Na__LeLeadGeo__Hit(leader, pointMm, tol) === 'head') return leader;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bubble Whose Circle Is Under a Paper Point, or Null
    // ------------------------------------------------------------
    // found is the hover pass's own hit (Na__LeTools__Resolve), used first so
    // the common case costs nothing more: a leader is itself; a group is
    // looked into for the member really under the point; bare paper or a
    // drawing may still have a bubble on a locked layer above it.
    // ------------------------------------------------------------
    function Na__LeNoteTip__BubbleAt(sheet, found, pointMm) {
        if (!sheet || !pointMm) return null;
        const tol = Na__LeTools__Tolerance();
        let leader = null;
        if (found && found.kind === 'leader') leader = Na__LeTools__Record(sheet, found);
        else if (found && found.kind === 'group') {
            const raw = Na__LeTools__RawHit(sheet, pointMm);
            if (raw && raw.kind === 'leader') leader = Na__LeTools__Record(sheet, raw);
        } else if (!found || found.kind === 'viewport') {
            leader = Na__LeNoteTip__LockedBubbleAt(sheet, pointMm, tol);
        }
        if (!leader || leader.Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE) return null;
        return Na__LeLeadGeo__Hit(leader, pointMm, tol) === 'head' ? leader : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Bubble's Label Says: { key, lead, text } or Null
    // ------------------------------------------------------------
    // lead is the code, in bold; text is the note's title - or "Untitled
    // note" for a note with none. key changes with any of them, so a label up
    // while its note is renamed is written again.
    // ------------------------------------------------------------
    function Na__LeNoteTip__Describe(leader) {
        const note = Na__LeLeadGeo__NoteFor(leader);
        if (!note) return null;
        const title = note.title.trim() !== '' ? note.title.trim() : Na__LeCfg__GetLabel('LeaderNoteUntitled', 'Untitled note');
        return { key : [ leader.Leader__Id, note.noteId, note.code, title ].join('|'), lead : note.code, text : title };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Showing and Hiding
// -----------------------------------------------------------------------------

    // FUNCTION | Stop Waiting and Take the Label Down
    // ------------------------------------------------------------
    // hide false leaves the shared tooltip alone: the hover pass has already
    // hidden it on this move, and may have put up a broken bubble's message
    // since, which is not this module's to take down.
    // ------------------------------------------------------------
    function Na__LeNoteTip__Cancel(hide) {
        if (Na__LeNoteTip__Pending) { window.clearTimeout(Na__LeNoteTip__Pending.timer); Na__LeNoteTip__Pending = null; }
        if (Na__LeNoteTip__Shown) {
            Na__LeNoteTip__Shown = null;
            if (hide !== false) Na__LeHoverTip__Hide();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Hover With Select or Move Up: Wait, Show, Follow or Stop
    // ------------------------------------------------------------
    // Called on every such pointer move, after the hover pass has hidden the
    // shared tooltip. stillWanted() is asked again when the wait is over - is
    // Select or Move still up, and nothing being dragged - since a key or a
    // toolbar button can change that without a pointer move.
    // ------------------------------------------------------------
    function Na__LeNoteTip__Hover(sheet, found, pointMm, clientX, clientY, stillWanted) {
        const setup  = Na__LeCfg__GetLeaderSetup();
        const leader = setup.noteTooltip ? Na__LeNoteTip__BubbleAt(sheet, found, pointMm) : null;
        const said   = leader ? Na__LeNoteTip__Describe(leader) : null;
        if (!said) {
            if (Na__LeNoteTip__Shown) Na__LeNoteTip__WarmUntil = Date.now() + Na__LeNoteTip__WARM_MS;
            Na__LeNoteTip__Cancel(false);
            return false;
        }
        if (Na__LeNoteTip__Shown && Na__LeNoteTip__Shown.key === said.key) {   // <-- Up already: it follows the pointer
            Na__LeHoverTip__Show(said.text, clientX, clientY, { lead : said.lead });
            return true;
        }
        if (Na__LeNoteTip__Pending && Na__LeNoteTip__Pending.key === said.key) {
            Na__LeNoteTip__Pending.clientX = clientX;
            Na__LeNoteTip__Pending.clientY = clientY;
            return false;
        }
        const warm = !!Na__LeNoteTip__Shown || Date.now() < Na__LeNoteTip__WarmUntil;
        Na__LeNoteTip__Cancel(false);
        if (warm || setup.noteTooltipMs <= 0) {                                 // <-- Straight from one bubble onto the next
            Na__LeNoteTip__Shown = { key : said.key, lead : said.lead, text : said.text };
            Na__LeHoverTip__Show(said.text, clientX, clientY, { lead : said.lead });
            return true;
        }
        const pending = { key : said.key, lead : said.lead, text : said.text, clientX : clientX, clientY : clientY, timer : 0, stillWanted : stillWanted };
        pending.timer = window.setTimeout(() => {
            if (Na__LeNoteTip__Pending !== pending) return;
            Na__LeNoteTip__Pending = null;
            if (typeof pending.stillWanted === 'function' && !pending.stillWanted()) return;
            Na__LeNoteTip__Shown = { key : pending.key, lead : pending.lead, text : pending.text };
            Na__LeHoverTip__Show(pending.text, pending.clientX, pending.clientY, { lead : pending.lead });
        }, setup.noteTooltipMs);
        Na__LeNoteTip__Pending = pending;
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Label Up, or Waiting (for tests and the hover pass)
    // ------------------------------------------------------------
    function Na__LeNoteTip__State() {
        return { shown : Na__LeNoteTip__Shown ? Na__LeNoteTip__Shown.key : null, pending : Na__LeNoteTip__Pending ? Na__LeNoteTip__Pending.key : null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach
// -----------------------------------------------------------------------------

    // FUNCTION | Listen on the Stage for What Takes the Label Down
    // ------------------------------------------------------------
    function Na__LeNoteTip__Attach(stage) {
        Na__LeNoteTip__Detach();
        if (!stage) return false;
        const off = () => Na__LeNoteTip__Cancel(true);
        Na__LeNoteTip__Stage    = stage;
        Na__LeNoteTip__Handlers = {
            off   : off,
            key   : (event) => { if (Na__LeNoteTip__MODIFIERS.indexOf(event.key) === -1) off(); }
        };
        stage.addEventListener('pointerdown', off, true);                      // <-- Capture: before the press does anything else
        stage.addEventListener('pointerleave', off);
        stage.addEventListener('wheel', off, { passive : true });
        window.addEventListener('keydown', Na__LeNoteTip__Handlers.key, true);
        window.addEventListener('blur', off);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening, and Take Down Anything Up or Waiting
    // ------------------------------------------------------------
    function Na__LeNoteTip__Detach() {
        Na__LeNoteTip__Cancel(true);
        Na__LeNoteTip__WarmUntil = 0;
        const stage = Na__LeNoteTip__Stage, handlers = Na__LeNoteTip__Handlers;
        Na__LeNoteTip__Stage = Na__LeNoteTip__Handlers = null;
        if (!stage || !handlers) return;
        stage.removeEventListener('pointerdown', handlers.off, true);
        stage.removeEventListener('pointerleave', handlers.off);
        stage.removeEventListener('wheel', handlers.off, { passive : true });
        window.removeEventListener('keydown', handlers.key, true);
        window.removeEventListener('blur', handlers.off);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Note Tooltip API
    // ------------------------------------------------------------
    export {
        Na__LeNoteTip__BubbleAt,
        Na__LeNoteTip__Describe,
        Na__LeNoteTip__Hover,
        Na__LeNoteTip__Cancel,
        Na__LeNoteTip__State,
        Na__LeNoteTip__Attach,
        Na__LeNoteTip__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
