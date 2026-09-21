// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - LEADER TOOL
// =============================================================================
//
// FILE       : Na__LayoutEditor__LeaderTool__.js
// NAMESPACE  : Na__LeLeader
// MODULE     : Layout Editor - Leader Tool
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place a leader - a note or a specification bubble - by the point it marks and where its head goes, and edit its text inline
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - TWO CLICKS, OR ONE DRAG. The first click picks the point the leader marks
//   (it snaps, like a dimension's ends); the second places the head. Or press
//   on the point, drag to where the head goes and let go. While the head
//   follows the cursor the leader is drawn as it will land - curve, endpoint,
//   bubble and all - so its handing is visible before it is placed: head to
//   the right of the point and a note reads away from it left-justified, to
//   the left and it is right-justified.
// - THE TEXT OPENS AT ONCE. A note opens a multi-line field over its text
//   (Enter for a new line, Ctrl+Enter or a click away to finish); a bubble
//   opens a one-line field for its code. Emptying the text deletes the
//   leader, as it does a text item.
// - THE NEXT BUBBLE CODE. BubbleTextRule decides what a new bubble's field
//   starts with: 'increment' takes the newest bubble on the sheet and adds one
//   to its number (EE07 becomes EE08, prefix and zero padding kept); 'repeat'
//   offers that code again; 'fixed' always offers DefaultBubbleText. The field
//   opens with it selected, so typing a different code simply replaces it.
// - Nothing reaches the undo history until the head lands: the leader being
//   placed is a silent record, and abandoning it (Esc, Space, a right click,
//   another tool) removes it without a trace. Landing it is one undo step and
//   the text typed into it another, as with a text item.
// - Double-click a leader with the Select tool, or use Edit text on its panel
//   or its right-click menu, to open the field again.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the pointer and the keys and hands the
//   press, the move and the release here, as it does for the Rectangle tool.
// - Na__LayoutEditor__LeaderGeometry__ lays the leader out;
//   Na__LayoutEditor__TextTool__ owns the inline field.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : 1.0.0 ported 14-Sep-2026 as ValeVision v2.32.0, verbatim
//                   below the header. Nothing here is app-specific. Later
//                   versions wait for their own sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - The head (the note or bubble end) follows the drawing grid while Grid
//   Snap is on (F7, Na__LayoutEditor__DrawingGrid__), as it is drawn out and
//   where it lands; the tip reaches the grid through Na__LeOsnap__Snap.
//
// 14-Sep-2026 - Version 1.1.0
// - Project Specification: a bubble committed with a code links to the note
//   that has it, and reads that code exactly ("ee2" becomes EE02); a code no
//   note has leaves it unlinked, as typed. A new bubble whose suggested code a
//   note already has is placed linked. A linked bubble's field opens on the
//   code it shows. Note leaders, and bubbles when no note matches, commit
//   exactly as before (Na__LayoutEditor__SpecLinks__).
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: two-click and drag placement with a live leader,
//   the inline note and bubble fields, and the next bubble code.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Snapping, Text Field and Leader Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup, Na__LeCfg__GetLeaderSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetLeaders,
        Na__LeModel__CreateLeader,
        Na__LeModel__UpdateLeader,
        Na__LeModel__DeleteLeader,
        Na__LeModel__SetSelection
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../30__System__SheetTools/Na__LayoutEditor__Snapping__.js';
    import { Na__LeGrid__SnapPoint } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';   // <-- Grid Snap (F7): a leaf, the nearest grid point
    import { Na__LeText__OpenField } from './Na__LayoutEditor__TextTool__.js';
    import { Na__LeLeadGeo__TYPE_BUBBLE, Na__LeLeadGeo__Layout, Na__LeLeadGeo__Lines } from '../15__Core__Markup/Na__LayoutEditor__LeaderGeometry__.js';
    import { Na__LeSpecLink__PatchForText, Na__LeSpecLink__StartFor, Na__LeSpecLink__NoteIdOf } from '../50__Feature__Specification/Na__LayoutEditor__SpecLinks__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Leader Being Placed
    // ------------------------------------------------------------
    let Na__LeLeader__Placement = null;   // <-- { tipMm, id, pressMm, pointerId, dragging, defaults }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // FUNCTION | The Code After One: EE07 -> EE08, A9 -> A10, DV099 -> DV100
    // ------------------------------------------------------------
    // The number at the end goes up by one and keeps its zero padding; the
    // rest is kept as it is. Null when the code does not end in a number.
    // ------------------------------------------------------------
    function Na__LeLeader__NextCode(code) {
        const match = String(code || '').match(/^(.*?)(\d+)$/);
        if (!match) return null;
        return match[1] + String(parseInt(match[2], 10) + 1).padStart(match[2].length, '0');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a New Leader's Text Starts As
    // ------------------------------------------------------------
    function Na__LeLeader__InitialText(sheet, type) {
        const setup = Na__LeCfg__GetLeaderSetup();
        if ((type || setup.defaultType) !== Na__LeLeadGeo__TYPE_BUBBLE) return setup.defaultText;
        if (setup.bubbleTextRule === 'fixed') return setup.defaultBubbleText;
        const leaders = Na__LeModel__GetLeaders(sheet);
        for (let i = leaders.length - 1; i >= 0; i--) {                        // <-- The newest bubble on the sheet that has a code
            if (leaders[i].Leader__Type !== Na__LeLeadGeo__TYPE_BUBBLE) continue;
            const code = Na__LeLeadGeo__Lines(leaders[i])[0] || '';
            if (!code) continue;
            return setup.bubbleTextRule === 'repeat' ? code : (Na__LeLeader__NextCode(code) || code);
        }
        return setup.defaultBubbleText;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Options a New Leader Is Created With, From the Panel's Settings
    // ------------------------------------------------------------
    // The settings keep the fill as a switch beside its colour, as the Vectors
    // panel does; the record keeps a colour or null.
    // ------------------------------------------------------------
    function Na__LeLeader__Options(sheet, defaults) {
        const d     = defaults || {};
        const start = Na__LeSpecLink__StartFor(d.type || Na__LeCfg__GetLeaderSetup().defaultType, Na__LeLeader__InitialText(sheet, d.type));   // <-- A bubble whose first code a note has starts linked to it
        return {
            type : d.type, text : start.text, specNoteId : start.specNoteId,
            textSizeMm : d.textSizeMm, fontWeight : d.fontWeight, textColour : d.textColour,
            lineColour : d.lineColour, linePt : d.linePt, lineStyle : d.lineStyle, lineOpacity : d.lineOpacity,
            endpointFilled : d.endpointFilled, endpointPt : d.endpointPt, endpointSizeMm : d.endpointSizeMm,
            bubbleSizeMm : d.bubbleSizeMm, bubbleEdgePt : d.bubbleEdgePt,
            fillColour : (typeof d.filled === 'boolean') ? (d.filled ? d.fillColour : null) : undefined,
            fillOpacity : d.fillOpacity,
            silent : true                                                     // <-- Announced once, when the head lands
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Head Far Enough From the Point to Be a Leader
    // ------------------------------------------------------------
    function Na__LeLeader__Far(tipMm, pointMm) {
        return Math.hypot(pointMm.x - tipMm.x, pointMm.y - tipMm.y) >= Na__LeCfg__GetLeaderSetup().minLengthMm;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // FUNCTION | A Press With the Leader Tool
    // ------------------------------------------------------------
    // defaults: the Leaders panel's settings for new leaders, copied at the
    // first press. The first press fixes the point, snapped; a second press
    // lands the head.
    // ------------------------------------------------------------
    function Na__LeLeader__Press(sheet, pointMm, defaults, pointerId) {
        if (!sheet || !pointMm) return false;
        if (Na__LeLeader__Placement) return Na__LeLeader__Land(sheet, pointMm);
        const snap = Na__LeOsnap__Snap(sheet, pointMm, null);
        Na__LeLeader__Placement = {
            tipMm     : { x : snap.x, y : snap.y },
            id        : null,
            pressMm   : { x : pointMm.x, y : pointMm.y },
            pointerId : pointerId,
            dragging  : false,
            defaults  : Object.assign({}, defaults || {})
        };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With the Leader Tool
    // ------------------------------------------------------------
    // Before the first press the snap marker shows where the point would land.
    // After it the head follows the cursor, drawn as it will be. pressed says
    // the button is still down: a move past the drag threshold turns the press
    // into a drag, and then the release lands the head.
    // ------------------------------------------------------------
    function Na__LeLeader__Move(sheet, pointMm, pressed) {
        if (!sheet || !pointMm) return false;
        const p = Na__LeLeader__Placement;
        if (!p) { Na__LeOsnap__Snap(sheet, pointMm, null); return false; }
        pointMm = Na__LeGrid__SnapPoint(pointMm);                               // <-- Grid Snap (F7): the head follows the grid; the tip already snapped to it
        if (pressed && !p.dragging) {
            const slop = Na__LeCfg__GetSelectionSetup().dragThresholdMm / Na__LeSurface__GetZoom();
            if (Math.hypot(pointMm.x - p.pressMm.x, pointMm.y - p.pressMm.y) >= slop) p.dragging = true;
        }
        Na__LeOsnap__HideMarker();
        if (!p.id) {
            if (!Na__LeLeader__Far(p.tipMm, pointMm)) return true;              // <-- Too short to be a leader yet
            const item = Na__LeModel__CreateLeader(sheet, p.tipMm, pointMm, Na__LeLeader__Options(sheet, p.defaults));
            if (!item) { Na__LeLeader__Placement = null; return false; }
            p.id = item.Leader__Id;
        } else {
            Na__LeModel__UpdateLeader(sheet, p.id, { anchorXMm : pointMm.x, anchorYMm : pointMm.y }, true);
        }
        Na__LeSurface__Refresh('markup');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Comes Up Over a Leader Being Placed
    // ------------------------------------------------------------
    // Lands the head only when the press was dragged out. A plain click leaves
    // the leader following the cursor for the second click.
    // ------------------------------------------------------------
    function Na__LeLeader__Release(sheet, pointMm, pointerId) {
        const p = Na__LeLeader__Placement;
        if (!p || !p.dragging || !sheet || !pointMm) return false;
        if (pointerId !== undefined && pointerId !== null && p.pointerId !== pointerId) return false;
        return Na__LeLeader__Land(sheet, pointMm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land the Head, Announce the Leader Once and Open Its Text
    // ------------------------------------------------------------
    // The field opens on the next task rather than inside the pointer event: a
    // field focused during a press can lose its focus to the browser's own
    // handling of that same press, which would commit it before a key was
    // typed.
    // ------------------------------------------------------------
    function Na__LeLeader__Land(sheet, pointMm) {
        const p = Na__LeLeader__Placement;
        if (!p || !Na__LeLeader__Far(p.tipMm, pointMm)) return false;          // <-- Not a leader yet: keep placing
        pointMm = Na__LeGrid__SnapPoint(pointMm);                               // <-- The head lands where the band showed it
        Na__LeLeader__Placement = null;
        Na__LeOsnap__HideMarker();
        let id = p.id;
        if (!id) {
            const item = Na__LeModel__CreateLeader(sheet, p.tipMm, pointMm, Na__LeLeader__Options(sheet, p.defaults));
            if (!item) return false;
            id = item.Leader__Id;
        }
        Na__LeModel__UpdateLeader(sheet, id, { anchorXMm : pointMm.x, anchorYMm : pointMm.y }, false);   // <-- One announcement: one history step
        Na__LeModel__SetSelection({ kind : 'leader', id : id });
        window.setTimeout(() => { Na__LeLeader__BeginEdit(id); }, 0);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon a Half-Placed Leader
    // ------------------------------------------------------------
    function Na__LeLeader__Cancel(sheet) {
        const p = Na__LeLeader__Placement;
        Na__LeLeader__Placement = null;
        Na__LeOsnap__HideMarker();
        const live = sheet || Na__LeModel__GetActiveSheet();
        if (p && p.id && live) Na__LeModel__DeleteLeader(live, p.id);           // <-- Never announced as created, so nothing to undo
        return !!p;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Leader Being Placed
    // ------------------------------------------------------------
    function Na__LeLeader__IsPlacing() { return !!Na__LeLeader__Placement; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Inline Text
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Field Over a Leader's Text
    // ------------------------------------------------------------
    // A note gets a multi-line field over its text, laid from the justified
    // edge so a right-handed note is typed right-aligned; a bubble gets a
    // one-line field centred on its circle. An empty commit deletes the
    // leader, as it does a text item.
    // ------------------------------------------------------------
    function Na__LeLeader__BeginEdit(itemId) {
        const sheet  = Na__LeModel__GetActiveSheet();
        const leader = sheet ? Na__LeModel__GetLeaders(sheet).find((l) => l.Leader__Id === itemId) : null;
        if (!leader) return false;
        const head   = Na__LeLeadGeo__Layout(leader).head;
        const commit = (text) => {
            const live = Na__LeModel__GetActiveSheet();
            if (!live) return;
            if (text === '') { Na__LeModel__DeleteLeader(live, itemId); return; }   // <-- An emptied leader is a deleted leader
            const current = Na__LeModel__GetLeaders(live).find((l) => l.Leader__Id === itemId);
            Na__LeModel__UpdateLeader(live, itemId, current ? Na__LeSpecLink__PatchForText(current, text) : { text : text }, false);   // <-- A bubble typed with a note's code links to it
        };
        const shown  = (head.type === Na__LeLeadGeo__TYPE_BUBBLE && Na__LeSpecLink__NoteIdOf(leader) && head.lines.length) ? head.lines[0].text : leader.Leader__Text;   // <-- A linked bubble is edited from the code it shows
        const common = { fontMm : head.fontMm, weight : head.weight, colour : leader.Leader__TextColour, value : shown, onCommit : commit };

        if (head.type === Na__LeLeadGeo__TYPE_BUBBLE) {
            const widthMm = Math.max(head.radius * 2, head.fontMm * 4);
            const fieldMm = Math.max(widthMm + 4, 30);                         // <-- The width the field actually takes, so it can be centred
            return Na__LeText__OpenField(Object.assign(common, {
                xMm : head.centre.x - (fieldMm / 2), yMm : head.centre.y - (head.fontMm * 0.6), widthMm : widthMm, align : 'center'
            }));
        }

        const box     = head.textBox;
        const lineMm  = head.fontMm * Na__LeCfg__GetLeaderSetup().lineSpacing;
        const widthMm = box.WidthMm + (head.fontMm * 6);                       // <-- Room to type before the field needs to be wider
        const fieldMm = Math.max(widthMm + 4, 30);
        return Na__LeText__OpenField(Object.assign(common, {
            xMm : head.side > 0 ? box.X : (box.X + box.WidthMm) - fieldMm, yMm : box.Y - ((lineMm - head.fontMm) / 2) - (head.fontMm * 0.2),
            widthMm : widthMm, align : head.align, multiline : true, lineHeightMm : lineMm
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Leader Tool API
    // ------------------------------------------------------------
    export {
        Na__LeLeader__Press,
        Na__LeLeader__Move,
        Na__LeLeader__Release,
        Na__LeLeader__Cancel,
        Na__LeLeader__IsPlacing,
        Na__LeLeader__BeginEdit,
        Na__LeLeader__NextCode
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
