// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__.js
// NAMESPACE  : Na__LeVec
// MODULE     : Layout Editor - Vector Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one door the sheet tools knock on for every vector tool: Circle, Arc, Trim, Extend, Join, Split, Offset, Fillet and Chamfer
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ONE ADAPTER, SIX DISPATCH SITES - the Floor Area tool's lesson. The sheet
//   tools hand a tool its press, its move, its release, its right click, its
//   keys and its typed values in six different files. Nine new tools routed
//   from each of them would be fifty-four branches, and the tenth tool would
//   be quietly wrong in whichever file was forgotten. Every one of those files
//   asks HERE instead, with the name of the tool that is up, and this module
//   is the only thing that knows which unit answers. A new vector tool is a
//   new unit and a row in each switch below; no sheet tools file changes.
// - IT NEVER IMPORTS THE SHEET TOOLS BACK. The tool that is up, the Vectors
//   panel's defaults and Shift all arrive as arguments, so the sheet tools can
//   import this module with no circle. What it remembers is only what it is
//   told: the tool last picked up (Arm), for the one thing that needs it
//   between events - adopting what is drawn into an open group.
// - A GROUP OPEN FOR EDITING IS DRAWN INTO, as in LayOut. KeepsContainer is
//   the rule the sheet tools ask: an edit tool works inside whatever is open
//   and never closes it; a tool that draws a plain vector keeps a GROUP open
//   and what it draws joins that group (AdoptIntoOpenGroup, run just before
//   the change is announced so the history's one step holds the shape AND its
//   membership); every other placing tool closes the container as before.
// - TYPED VALUES. Reading tells the Measurements box what to show - a radius,
//   a bulge, an angle, a distance - and where the drawing's scale is read
//   from; TypeValue takes what was typed, as text, because only the tool knows
//   whether 90 is millimetres or degrees. 6s is a count of sides, 3000d a
//   diameter and 750r a radius: TypingExtras names the letters those need, so
//   the box lets them through for these tools and for no others.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__PointerPress__ (Press),
//   __PointerDrag__ (Move, Release), __Keyboard__ (ToolForAction, StepBack,
//   TakesAxis, Move for a redraw), __ContextMenu__ (RightClick, MenuItems),
//   __ToolState__ (Arm, Cancel, KeepsContainer) and, through the sheet tools'
//   context, Na__LayoutEditor__Measurements__ (Reading, TypeValue,
//   TypingExtras). The mode controller runs Initialize once.
// // @delegate: ./Na__LayoutEditor__VectorTools__CircleTool__.js
// // @delegate: ./Na__LayoutEditor__VectorTools__ArcTool__.js
// // @delegate: ./Na__LayoutEditor__VectorTools__TrimTool__.js
// // @delegate: ./Na__LayoutEditor__VectorTools__JoinTool__.js
// // @delegate: ./Na__LayoutEditor__VectorTools__OffsetTool__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scale, Parsing, Scope and the Surface
    // ------------------------------------------------------------
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetShapeById, Na__LeModel__AddGroupMember, Na__LeModel__RegisterBeforeAnnounce } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__DenominatorAt } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMParse__Length } from '../15__Core__Markup/Na__LayoutEditor__MeasureParse__.js';
    import { Na__LeGroup__ParentOf } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeScope__Get, Na__LeScope__GetGroupId, Na__LeScope__GetVectorId, Na__LeScope__KIND_GROUP } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Vector Tools' Own Units
    // ------------------------------------------------------------
    import {
        Na__LeVec__TOOL_CIRCLE,
        Na__LeVec__TOOL_ARC,
        Na__LeVec__TOOL_TRIM,
        Na__LeVec__TOOL_EXTEND,
        Na__LeVec__TOOL_JOIN,
        Na__LeVec__TOOL_SPLIT,
        Na__LeVec__TOOL_OFFSET,
        Na__LeVec__TOOL_FILLET,
        Na__LeVec__TOOL_CHAMFER,
        Na__LeVec__GROUP_DRAW_TOOLS,
        Na__LeVec__IsTool,
        Na__LeVec__IsEditTool,
        Na__LeVec__IsDrawTool,
        Na__LeVec__SetSettings,
        Na__LeVec__SetHint
    } from './Na__LayoutEditor__VectorTools__State__.js';
    import { Na__LeVecCfg__Value, Na__LeVecCfg__Label, Na__LeVecCfg__Format } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVecPrev__Clear } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCircle__Arm, Na__LeVecCircle__Press, Na__LeVecCircle__Move, Na__LeVecCircle__Release, Na__LeVecCircle__Cancel, Na__LeVecCircle__IsBusy, Na__LeVecCircle__Measure, Na__LeVecCircle__Type } from './Na__LayoutEditor__VectorTools__CircleTool__.js';
    import { Na__LeVecArc__Arm, Na__LeVecArc__Press, Na__LeVecArc__Move, Na__LeVecArc__StepBack, Na__LeVecArc__Cancel, Na__LeVecArc__IsBusy, Na__LeVecArc__TakesAxis, Na__LeVecArc__Measure, Na__LeVecArc__Type } from './Na__LayoutEditor__VectorTools__ArcTool__.js';
    import { Na__LeVecTrim__Arm, Na__LeVecTrim__Press, Na__LeVecTrim__Move, Na__LeVecTrim__Release, Na__LeVecTrim__Cancel, Na__LeVecTrim__IsBusy } from './Na__LayoutEditor__VectorTools__TrimTool__.js';
    import { Na__LeVecJoin__Arm, Na__LeVecJoin__Press, Na__LeVecJoin__Move, Na__LeVecJoin__Cancel, Na__LeVecJoin__IsBusy, Na__LeVecJoin__SplitPress, Na__LeVecJoin__SplitMove, Na__LeVecJoin__SplitShapeAt } from './Na__LayoutEditor__VectorTools__JoinTool__.js';
    import {
        Na__LeVecSize__Arm,
        Na__LeVecSize__Cancel,
        Na__LeVecSize__IsBusy,
        Na__LeVecSize__OffsetPress,
        Na__LeVecSize__OffsetMove,
        Na__LeVecSize__OffsetMeasure,
        Na__LeVecSize__OffsetType,
        Na__LeVecSize__CornerPress,
        Na__LeVecSize__CornerMove,
        Na__LeVecSize__CornerMeasure
    } from './Na__LayoutEditor__VectorTools__OffsetTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Key Map's Actions, and the Letters a Typed Value May Hold
    // ------------------------------------------------------------
    const Na__LeVec__ACTIONS = Object.freeze({
        Tool__Circle  : Na__LeVec__TOOL_CIRCLE,
        Tool__Arc     : Na__LeVec__TOOL_ARC,
        Tool__Trim    : Na__LeVec__TOOL_TRIM,
        Tool__Extend  : Na__LeVec__TOOL_EXTEND,
        Tool__Join    : Na__LeVec__TOOL_JOIN,
        Tool__Split   : Na__LeVec__TOOL_SPLIT,
        Tool__Offset  : Na__LeVec__TOOL_OFFSET,
        Tool__Fillet  : Na__LeVec__TOOL_FILLET,
        Tool__Chamfer : Na__LeVec__TOOL_CHAMFER
    });
    const Na__LeVec__EXTRAS_CIRCLE = 'sSdD';    // <-- 6s sides, 3000d a diameter
    const Na__LeVec__EXTRAS_ARC    = 'sSrR°';   // <-- 6s sides, 750r a radius, 90 degrees with its sign
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Tool Last Picked Up, and Whether the Group Hook Is In
    // ------------------------------------------------------------
    let Na__LeVec__ActiveTool  = null;
    let Na__LeVec__Initialised = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Tool, and the Container It Works In
// -----------------------------------------------------------------------------

    // FUNCTION | The Tool a Key Map Action Picks Up, or Null
    // ------------------------------------------------------------
    function Na__LeVec__ToolForAction(action) {
        return Object.prototype.hasOwnProperty.call(Na__LeVec__ACTIONS, action) ? Na__LeVec__ACTIONS[action] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does Picking This Tool Up Leave the Open Container Open
    // ------------------------------------------------------------
    // Asked by the sheet tools for every tool that is not Select or Move.
    // An EDIT tool works on what is inside, so always. A tool that DRAWS a
    // plain vector - Draw and Rectangle as well as Circle and Arc - keeps a
    // GROUP open and draws into it, LayOut's behaviour, unless the config says
    // otherwise; a vector or a dimension holds points, not things, and closes.
    // ------------------------------------------------------------
    function Na__LeVec__KeepsContainer(tool) {
        if (Na__LeVec__IsEditTool(tool)) return true;
        if (Na__LeVec__GROUP_DRAW_TOOLS.indexOf(tool) === -1) return false;
        if (!Na__LeVecCfg__Value('Behaviour', 'DrawInsideOpenGroup', true)) return false;
        const open = Na__LeScope__Get();
        return !!open && open.kind === Na__LeScope__KIND_GROUP;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Newly Drawn Vector Into the Group That Is Open
    // ------------------------------------------------------------
    // Silent: the caller's own announcement carries it. Only while a drawing
    // tool is up and a GROUP is innermost, and only a plain vector that is in
    // no group yet. The Draw tool calls it for its first point as well, so a
    // line being drawn inside a group is drawn at full strength, not faded
    // with the sheet outside it.
    // ------------------------------------------------------------
    function Na__LeVec__AdoptIntoOpenGroup(sheet, shapeId) {
        if (!sheet || !shapeId || Na__LeVec__GROUP_DRAW_TOOLS.indexOf(Na__LeVec__ActiveTool) === -1) return false;
        if (!Na__LeVecCfg__Value('Behaviour', 'DrawInsideOpenGroup', true)) return false;
        const groupId = Na__LeScope__GetGroupId();
        if (!groupId) return false;
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        if (!shape || shape.Shape__Image || shape.Shape__Qr || shape.Shape__Area) return false;
        if (Na__LeGroup__ParentOf(sheet, 'shape', shapeId)) return false;
        return Na__LeModel__AddGroupMember(sheet, groupId, { kind : 'shape', id : shapeId }, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Adopting What Is Drawn Inside an Open Group (once)
    // ------------------------------------------------------------
    // A before-announce hook, not a listener: the history listens first and
    // would have taken its snapshot before any listener could add the member.
    // ------------------------------------------------------------
    function Na__LeVec__Initialize() {
        if (Na__LeVec__Initialised) return true;
        Na__LeVec__Initialised = true;
        Na__LeModel__RegisterBeforeAnnounce((reason, sheetId, itemId) => {
            if ((reason !== 'shapes' && reason !== 'shape') || !itemId) return;
            const sheet = Na__LeModel__GetActiveSheet();
            if (sheet && sheet.Sheet__Id === sheetId) Na__LeVec__AdoptIntoOpenGroup(sheet, itemId);
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Picking Up and Putting Down
// -----------------------------------------------------------------------------

    // FUNCTION | A Tool Has Just Been Picked Up (any tool: this is how the adapter knows which)
    // ------------------------------------------------------------
    // For a vector tool its unit is armed - it says what it wants, and Join
    // joins a selection there and then. For any other tool the hint is put
    // away.
    // ------------------------------------------------------------
    function Na__LeVec__Arm(tool, sheet) {
        Na__LeVec__ActiveTool = tool;
        if (!Na__LeVec__IsTool(tool)) { Na__LeVec__SetHint(''); return false; }
        if (tool === Na__LeVec__TOOL_CIRCLE)      Na__LeVecCircle__Arm();
        else if (tool === Na__LeVec__TOOL_ARC)    Na__LeVecArc__Arm();
        else if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) Na__LeVecTrim__Arm(tool);
        else if (tool === Na__LeVec__TOOL_JOIN)   Na__LeVecJoin__Arm(sheet);
        else if (tool === Na__LeVec__TOOL_SPLIT)  Na__LeVec__SetHint(Na__LeVecCfg__Label('HintSplit', 'Split: click where to cut.'));
        else Na__LeVecSize__Arm(tool);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon Whatever Any Vector Tool Has Half Done
    // ------------------------------------------------------------
    function Na__LeVec__Cancel() {
        const had = [ Na__LeVecCircle__Cancel(), Na__LeVecArc__Cancel(), Na__LeVecTrim__Cancel(), Na__LeVecJoin__Cancel(), Na__LeVecSize__Cancel() ].some((flag) => flag === true);
        Na__LeVecPrev__Clear();
        return had;
    }
    // ------------------------------------------------------------


    // FUNCTION | Has the Tool That Is Up Something Half Done
    // ------------------------------------------------------------
    function Na__LeVec__IsBusy(tool) {
        if (tool === Na__LeVec__TOOL_CIRCLE) return Na__LeVecCircle__IsBusy();
        if (tool === Na__LeVec__TOOL_ARC)    return Na__LeVecArc__IsBusy();
        if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) return Na__LeVecTrim__IsBusy();
        if (tool === Na__LeVec__TOOL_JOIN)   return Na__LeVecJoin__IsBusy();
        if (tool === Na__LeVec__TOOL_OFFSET || tool === Na__LeVec__TOOL_FILLET || tool === Na__LeVec__TOOL_CHAMFER) return Na__LeVecSize__IsBusy();
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Pointer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What a Unit Is Handed
    // ------------------------------------------------------------
    // input: { shift, ctrl, alt, pointerId, pressed, cancelled }. defaults are
    // the Vectors panel's. denominatorAt is the drawing's scale at a place
    // while Draw at scale is on, and 1 while it is off - what turns a size kept
    // as typed into paper millimetres where it is used.
    // ------------------------------------------------------------
    function Na__LeVec__Context(tool, sheet, pointMm, input, defaults) {
        const more    = input || {};
        const atScale = !defaults || defaults.atScale !== false;
        return {
            tool : tool, sheet : sheet, pointMm : pointMm, defaults : defaults || {},
            shift : more.shift === true, ctrl : more.ctrl === true, alt : more.alt === true,
            pointerId : more.pointerId, pressed : more.pressed === true, cancelled : more.cancelled === true,
            denominatorAt : (point) => (atScale && point) ? (Na__LeDrawScale__DenominatorAt(sheet, point) || 1) : 1
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Left Press With a Vector Tool Up
    // ------------------------------------------------------------
    function Na__LeVec__Press(tool, sheet, pointMm, input, defaults) {
        if (!sheet || !pointMm || !Na__LeVec__IsTool(tool)) return false;
        const ctx = Na__LeVec__Context(tool, sheet, pointMm, input, defaults);
        if (tool === Na__LeVec__TOOL_CIRCLE) return Na__LeVecCircle__Press(ctx);
        if (tool === Na__LeVec__TOOL_ARC)    return Na__LeVecArc__Press(ctx);
        if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) return Na__LeVecTrim__Press(ctx);
        if (tool === Na__LeVec__TOOL_JOIN)   return Na__LeVecJoin__Press(ctx);
        if (tool === Na__LeVec__TOOL_SPLIT)  return Na__LeVecJoin__SplitPress(ctx);
        if (tool === Na__LeVec__TOOL_OFFSET) return Na__LeVecSize__OffsetPress(ctx);
        return Na__LeVecSize__CornerPress(ctx);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With a Vector Tool Up
    // ------------------------------------------------------------
    // Returns the cursor the stage should carry ('crosshair', 'not-allowed'),
    // or null to leave it.
    // ------------------------------------------------------------
    function Na__LeVec__Move(tool, sheet, pointMm, input, defaults) {
        if (!sheet || !pointMm || !Na__LeVec__IsTool(tool)) return null;
        const ctx = Na__LeVec__Context(tool, sheet, pointMm, input, defaults);
        if (tool === Na__LeVec__TOOL_CIRCLE) { Na__LeVecCircle__Move(ctx); return 'crosshair'; }
        if (tool === Na__LeVec__TOOL_ARC)    { Na__LeVecArc__Move(ctx); return 'crosshair'; }
        if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) return Na__LeVecTrim__Move(ctx);
        if (tool === Na__LeVec__TOOL_JOIN)   return Na__LeVecJoin__Move(ctx);
        if (tool === Na__LeVec__TOOL_SPLIT)  return Na__LeVecJoin__SplitMove(ctx);
        if (tool === Na__LeVec__TOOL_OFFSET) return Na__LeVecSize__OffsetMove(ctx);
        return Na__LeVecSize__CornerMove(ctx);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Button Comes Up With a Vector Tool Up
    // ------------------------------------------------------------
    // Only what can be DRAGGED out has anything to land on a release: a circle
    // from its centre, a fence from its first point.
    // ------------------------------------------------------------
    function Na__LeVec__Release(tool, sheet, pointMm, input, defaults) {
        if (!Na__LeVec__IsTool(tool)) return false;
        const ctx = Na__LeVec__Context(tool, sheet, pointMm, input, defaults);
        if (tool === Na__LeVec__TOOL_CIRCLE) return (sheet && pointMm) || ctx.cancelled ? Na__LeVecCircle__Release(ctx) : false;
        if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) return (sheet && pointMm) || ctx.cancelled ? Na__LeVecTrim__Release(ctx) : false;
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Right Click With a Vector Tool Up (true when it was spent)
    // ------------------------------------------------------------
    // As in CAD, a right click abandons what is half done. With nothing in
    // hand it is not spent, and the sheet's own menu opens as it always has.
    // ------------------------------------------------------------
    function Na__LeVec__RightClick(tool) {
        if (!Na__LeVec__IsTool(tool) || !Na__LeVec__IsBusy(tool)) return false;
        Na__LeVec__Cancel();
        Na__LeVec__Arm(tool, null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Something Half DRAWN (a circle, an arc, a fence), as Against Merely Held
    // ------------------------------------------------------------
    // What Ctrl+Z and Ctrl+Y ask. A circle from its centre, an arc from its
    // first point and a fence from its first click are work in progress that
    // is not on the sheet yet, so undo belongs to THEM first. A line that
    // Join, Offset or Fillet is holding is nothing of the kind: it is already
    // on the sheet, and the last join made with it is exactly what Ctrl+Z
    // should take back - so those never stand between the key and the history.
    // ------------------------------------------------------------
    function Na__LeVec__IsDrawing(tool) {
        if (tool === Na__LeVec__TOOL_CIRCLE) return Na__LeVecCircle__IsBusy();
        if (tool === Na__LeVec__TOOL_ARC)    return Na__LeVecArc__IsBusy();
        if (tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND) return Na__LeVecTrim__IsBusy();
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Ctrl+Z With a Vector Tool Up (true when the key was spent)
    // ------------------------------------------------------------
    // An arc gives back its last point; a circle or a fence half drawn is
    // abandoned, as a rubber rectangle is. With nothing half drawn the key is
    // not spent and the sheet's history steps - a held line is re-read from the
    // sheet on the next move, and let go of if the undo took it away.
    // ------------------------------------------------------------
    function Na__LeVec__StepBack(tool) {
        if (!Na__LeVec__IsTool(tool) || !Na__LeVec__IsDrawing(tool)) return false;
        if (tool === Na__LeVec__TOOL_ARC) return Na__LeVecArc__StepBack();
        Na__LeVec__Cancel();
        Na__LeVec__Arm(tool, null);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Would an Arrow Key Lock an Axis Right Now, and Should It Be Kept From the Nudge
    // ------------------------------------------------------------
    // TakesAxis: a straight run is being placed (an arc's chord or its radius).
    // SwallowsArrows: something is half done, so an arrow must not nudge the
    // old selection out from under it.
    // ------------------------------------------------------------
    function Na__LeVec__TakesAxis(tool)      { return tool === Na__LeVec__TOOL_ARC && Na__LeVecArc__TakesAxis(); }
    function Na__LeVec__SwallowsArrows(tool) { return Na__LeVec__IsTool(tool) && Na__LeVec__IsBusy(tool); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Measurements Box
// -----------------------------------------------------------------------------

    // FUNCTION | What the Measurements Box Reads for the Tool That Is Up, or Null
    // ------------------------------------------------------------
    // Returns { label, title, anchor : { x, y } or null, valueMm (paper mm) or
    // null, text (shown as it is, for an angle), extras }. Null for a tool that
    // takes no typed value - Trim, Extend, Join and Split - which leaves the
    // box resting.
    // ------------------------------------------------------------
    function Na__LeVec__Reading(tool, sheet, cursorMm, defaults) {
        if (!sheet || !Na__LeVec__IsTool(tool)) return null;
        let reading = null;
        if (tool === Na__LeVec__TOOL_CIRCLE)      reading = Na__LeVecCircle__Measure(sheet, cursorMm);
        else if (tool === Na__LeVec__TOOL_ARC)    reading = Na__LeVecArc__Measure(sheet, cursorMm);
        else if (tool === Na__LeVec__TOOL_OFFSET) reading = Na__LeVecSize__OffsetMeasure(sheet, Na__LeVec__Context(tool, sheet, cursorMm, null, defaults));
        else if (tool === Na__LeVec__TOOL_FILLET || tool === Na__LeVec__TOOL_CHAMFER) reading = Na__LeVecSize__CornerMeasure(tool, Na__LeVec__Context(tool, sheet, cursorMm, null, defaults), cursorMm);
        if (!reading) return null;
        reading.extras = Na__LeVec__TypingExtras(tool);
        return reading;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Letters a Typed Value May Hold for This Tool, Beyond a Length's Own
    // ------------------------------------------------------------
    function Na__LeVec__TypingExtras(tool) {
        if (tool === Na__LeVec__TOOL_CIRCLE) return Na__LeVec__EXTRAS_CIRCLE;
        if (tool === Na__LeVec__TOOL_ARC)    return Na__LeVec__EXTRAS_ARC;
        return '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read What Was Typed: Sides, a Diameter, a Radius, or a Length
    // ------------------------------------------------------------
    // Returns { sides }, { lengthMm, suffix : 'd' | 'r' | '' } in millimetres AS
    // TYPED, or { error }.
    // ------------------------------------------------------------
    function Na__LeVec__ParseTyped(text) {
        const src = String(text === undefined || text === null ? '' : text).trim();
        const sides = /^(\d{1,3})\s*[sS]$/.exec(src);
        if (sides) { const n = parseInt(sides[1], 10); return (n === 0 || (n >= 3 && n <= 720)) ? { sides : n } : { error : true }; }   // <-- 0s is Auto again: as many as the size needs
        const tail   = /[dDrR]$/.test(src) ? src.slice(-1).toLowerCase() : '';
        const length = Na__LeMParse__Length(tail ? src.slice(0, -1) : src);
        if (!length.ok || !(length.valueMm >= 0)) return { error : true };
        return { lengthMm : length.valueMm, suffix : tail };
    }
    // ------------------------------------------------------------


    // FUNCTION | Use What Was Typed Into the Measurements Box
    // ------------------------------------------------------------
    // Returns { ok : true, message } or { ok : false, message }.
    // ------------------------------------------------------------
    function Na__LeVec__TypeValue(tool, sheet, text, defaults, cursorMm) {
        const bad  = (key, fallback) => ({ ok : false, message : Na__LeVecCfg__Label(key, fallback) });
        const fine = (message) => ({ ok : true, message : message || '' });
        if (!sheet || !Na__LeVec__IsTool(tool)) return bad('SayNeedPoint', 'Click a point first, then type.');
        const reading = Na__LeVec__Reading(tool, sheet, cursorMm, defaults);
        if (!reading || reading.readOnly === true) return bad('SayNeedPoint', 'Click a point first, then type.');
        const ctx         = Na__LeVec__Context(tool, sheet, cursorMm, null, defaults);
        const denominator = ctx.denominatorAt(reading.anchor || cursorMm);

        // AN ANGLE | The one reading that is not a length: a Centre arc's or a
        // Pie's sweep, in degrees.
        if (reading.angle === true) {
            const degrees = parseFloat(String(text).replace('°', ''));
            if (!Number.isFinite(degrees)) return bad('SayBadAngle', 'Not an angle. Type degrees, such as 90.');
            return Na__LeVec__Outcome(Na__LeVecArc__Type(sheet, { degrees : degrees }));
        }

        const typed = Na__LeVec__ParseTyped(text);
        if (typed.error) return bad('SayBadValue', 'Not a size. Type 1500, 1.5m, 3000d for a diameter, 750r for a radius or 6s for sides.');
        if (Number.isFinite(typed.sides)) {
            Na__LeVec__SetSettings({ circleSegments : typed.sides });
            const result = tool === Na__LeVec__TOOL_CIRCLE ? Na__LeVecCircle__Type(sheet, { sides : typed.sides }) : (tool === Na__LeVec__TOOL_ARC ? Na__LeVecArc__Type(sheet, { sides : typed.sides }) : { ok : true });
            if (!result.ok) return Na__LeVec__Outcome(result);
            return fine(typed.sides >= 3 ? Na__LeVecCfg__Format('SaySegments', 'Circles and arcs: {count} sides.', { count : typed.sides }) : Na__LeVecCfg__Label('SaySegmentsAuto', 'Circles and arcs: as many sides as they need.'));
        }
        const paperMm = typed.lengthMm / Math.max(1e-9, denominator);
        if (tool === Na__LeVec__TOOL_CIRCLE) return Na__LeVec__Outcome(Na__LeVecCircle__Type(sheet, { radiusMm : typed.suffix === 'd' ? paperMm / 2 : paperMm }));
        if (tool === Na__LeVec__TOOL_ARC)    return Na__LeVec__Outcome(Na__LeVecArc__Type(sheet, typed.suffix === 'r' ? { radiusMm : paperMm } : { lengthMm : paperMm }));
        if (typed.suffix) return bad('SayBadValue', 'Not a size. Type 1500, 1.5m, 3000d for a diameter, 750r for a radius or 6s for sides.');
        if (tool === Na__LeVec__TOOL_OFFSET) {
            Na__LeVec__SetSettings({ offsetDistance : typed.lengthMm });     // <-- Kept as typed, for the panel and for next time
            return Na__LeVec__Outcome(Na__LeVecSize__OffsetType(sheet, paperMm));
        }
        Na__LeVec__SetSettings(tool === Na__LeVec__TOOL_FILLET ? { filletRadius : typed.lengthMm } : { chamferDistance : typed.lengthMm });
        return fine();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Unit's Answer as the Measurements Box Wants It
    // ------------------------------------------------------------
    function Na__LeVec__Outcome(result) {
        if (result && result.ok) return { ok : true, message : '' };
        const reason = result ? result.reason : 'point';
        if (reason === 'radius')    return { ok : false, message : Na__LeVecCfg__Label('SayRadiusSmall', 'That radius is too small to reach between the two ends.') };
        if (reason === 'angle')     return { ok : false, message : Na__LeVecCfg__Label('SayBadAngle', 'Not an angle. Type degrees, such as 90.') };
        if (reason === 'gone')      return { ok : false, message : Na__LeVecCfg__Label('SayOffsetGone', 'Offset that far, nothing of the shape is left.') };
        if (reason === 'size')      return { ok : false, message : Na__LeVecCfg__Label('SayBadValue', 'Not a size. Type 1500, 1.5m, 3000d for a diameter, 750r for a radius or 6s for sides.') };
        if (reason === 'direction') return { ok : false, message : Na__LeVecCfg__Label('SayNeedPoint', 'Click a point first, then type.') };
        return { ok : false, message : Na__LeVecCfg__Label('SayNeedPoint', 'Click a point first, then type.') };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Right-Click Menu
// -----------------------------------------------------------------------------

    // FUNCTION | The Row a Vector Offers for Its Tools
    // ------------------------------------------------------------
    // Handed to the sheet tools' menu for a plain vector, inside a container or
    // out: ONE row, Vector tools, opening a flyout of the edit tools by name -
    // each with its key at the far end and the one that is up ticked - and
    // Split here, which needs no tool at all. One row because a vector's menu
    // is long enough already; a flyout because that is what the Layer row
    // beside it does. pick(tool) is the sheet tools' own SetTool, handed in so
    // this module never imports it. Returns [] for anything that is not a
    // plain vector. The row brings the rule that closes its section.
    // ------------------------------------------------------------
    function Na__LeVec__MenuItems(sheet, shape, pointMm, activeTool, pick) {
        if (!sheet || !shape || shape.Shape__Image || shape.Shape__Qr || shape.Shape__Area || typeof pick !== 'function') return [];
        const row    = (tool, key, fallback, hotkey) => ({ label : Na__LeVecCfg__Label(key, fallback), hint : hotkey || '', checked : activeTool === tool, onSelect : () => pick(tool) });
        const inside = !!(Na__LeScope__GetVectorId() || Na__LeScope__GetGroupId());
        const flyout = [
            row(Na__LeVec__TOOL_TRIM,    'ToolTrim',    'Trim',    inside ? 'T' : ''),   // <-- T is the Text tool out on the sheet, so no key is promised there
            row(Na__LeVec__TOOL_EXTEND,  'ToolExtend',  'Extend',  'Shift+T'),
            row(Na__LeVec__TOOL_JOIN,    'ToolJoin',    'Join',    'J'),
            row(Na__LeVec__TOOL_SPLIT,   'ToolSplit',   'Split',   'U'),
            row(Na__LeVec__TOOL_OFFSET,  'ToolOffset',  'Offset',  'F'),
            row(Na__LeVec__TOOL_FILLET,  'ToolFillet',  'Fillet',  'Shift+F'),
            row(Na__LeVec__TOOL_CHAMFER, 'ToolChamfer', 'Chamfer', 'Shift+C'),
            { separator : true },
            { label : Na__LeVecCfg__Label('MenuSplitHere', 'Split here'), onSelect : () => { Na__LeVecJoin__SplitShapeAt(sheet, shape.Shape__Id, pointMm); } }
        ];
        return [ { label : Na__LeVecCfg__Label('MenuTools', 'Vector tools'), submenu : flyout }, { separator : true } ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools API
    // ------------------------------------------------------------
    export {
        Na__LeVec__IsTool,
        Na__LeVec__IsEditTool,
        Na__LeVec__IsDrawTool,
        Na__LeVec__ToolForAction,
        Na__LeVec__KeepsContainer,
        Na__LeVec__AdoptIntoOpenGroup,
        Na__LeVec__Initialize,
        Na__LeVec__Arm,
        Na__LeVec__Cancel,
        Na__LeVec__IsBusy,
        Na__LeVec__IsDrawing,
        Na__LeVec__Press,
        Na__LeVec__Move,
        Na__LeVec__Release,
        Na__LeVec__RightClick,
        Na__LeVec__StepBack,
        Na__LeVec__TakesAxis,
        Na__LeVec__SwallowsArrows,
        Na__LeVec__Reading,
        Na__LeVec__TypingExtras,
        Na__LeVec__TypeValue,
        Na__LeVec__MenuItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
