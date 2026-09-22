// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - BOOLEAN TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__BooleanTool__.js
// NAMESPACE  : Na__LeVecOps
// MODULE     : Layout Editor - Vector Tools - Boolean Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Union, Subtract, Trim, Intersect, Split and Outer Shell - SketchUp's Solid Tools, for closed shapes on the sheet - by clicking two shapes, or at once on a selection
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE SIX, NAMED AND ORDERED AS ADAM ASKED ("union, subtract, trim etc"),
//   each doing what SketchUp's Solid Tool of the same name does, in the plane:
//     Union        the two become one shape; where they enclose a space
//                  between them it stays a hole.
//     Subtract     the FIRST shape clicked is cut out of the second, and goes.
//     Trim         the first is cut out of the second and STAYS - it is held,
//                  so one cutter trims shape after shape.
//     Intersect    only what both cover is left.
//     Split        the two become their three kinds of piece: each one's own
//                  part and the part they share.
//     Outer Shell  as Union, and every hole filled; a shape with holes clicked
//                  twice (or picked up selected) has its holes filled.
// - BY CLICKING, AS SKETCHUP'S: click the first shape - it is held, drawn
//   heavy blue - then hover the second and the result shows, dashed blue
//   (what a Subtract takes away, red); click and it is done, one undo step.
//   Union, Intersect and Outer Shell keep the result held, so a run of shapes
//   is gathered by clicking round them; Trim keeps its CUTTER held; Subtract
//   and Split let go. Bare paper or Esc lets go. A shape is found by its
//   edge, or anywhere inside its fill - an edge within reach wins, else the
//   frontmost shape the point is inside.
// - ON A SELECTION, AS ILLUSTRATOR'S PATHFINDER: picked up with two or more
//   closed shapes selected (or chosen from the right-click menu of a
//   selection) it acts on all of them at once, and the PAINT ORDER decides -
//   the shape furthest back is the one kept and cut: Subtract cuts every
//   selected shape in front of it out of it (Minus Front), Trim cuts each
//   shape by the ones in front of it and keeps them all, Union, Intersect and
//   Outer Shell keep its style and its place, and Split gives each piece the
//   style of the frontmost shape over it - what is seen there already.
// - WHAT IS KEPT. A result is written back through the targets' Rebuild: the
//   shape whose result it is keeps its record - its id, its style, its layer,
//   its group and its place in the paint order - and a result that comes
//   apart into several pieces is several vectors, copies of it straight after
//   it. A piece may have holes (Shape__Holes): the one kind of vector only
//   these tools make.
// - WHAT IS REFUSED, WITH A REASON: an open line (a Boolean is an area; close
//   it first), a picture, a QR box, a measured room, a locked layer, shapes
//   that do not overlap for the tools that need them to, and a Subtract that
//   would leave nothing. Nothing is ever deleted by a refusal.
//
// INTEGRATION:
// - Na__LayoutEditor__VectorTools__ (the adapter) hands in the press, the move,
//   Arm and Cancel, and asks SelectionItems for the right-click menu of
//   several selected shapes.
// - The maths is Na__LayoutEditor__VectorTools__Boolean__; the targets unit
//   says what may be edited from where the editor is and writes it back.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.1.0
// - THE KEYS (Adam): Shift+U Union, Shift+S Subtract and Shift+T Trim act on
//   the selection at once, and only while two or more closed shapes a Boolean
//   can take are selected. SelectionTakesBoolean is that test, for the key
//   map's BooleanSelection. Shift+O Outer Shell has its own,
//   SelectionTakesOuterShell (OuterShellSelection): two or more, or one with
//   holes. The Boolean row of the several-selected menu names the four keys
//   at its rows' far end.
// - Trim on a selection says how many shapes it cut back ("Trim: 1 of 2
//   shapes cut back by the ones in front.", SayBoolTrimmed): it keeps every
//   shape, so "2 shapes into 1" counted only the ones it cut.
//
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Paint Order, Shape Geometry and Snapping
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetSelectionItems,
        Na__LeModel__SetSelection,
        Na__LeModel__SetSelectionItems,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerSelectable
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LePaint__MarkupBackToFront } from '../15__Core__Markup/Na__LayoutEditor__PaintOrder__.js';
    import { Na__LeShapeGeo__Rings, Na__LeShapeGeo__DistanceToEdge, Na__LeShapeGeo__Contains } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Vector Tools' Own Units
    // ------------------------------------------------------------
    import {
        Na__LeVecBool__Union,
        Na__LeVecBool__OuterShell,
        Na__LeVecBool__Intersect,
        Na__LeVecBool__Subtract,
        Na__LeVecBool__Divide,
        Na__LeVecBool__Overlaps,
        Na__LeVecBool__ToRecord
    } from './Na__LayoutEditor__VectorTools__Boolean__.js';
    import {
        Na__LeVecAim__ReachMm,
        Na__LeVecAim__InScope,
        Na__LeVecAim__Refusal,
        Na__LeVecAim__RefusalText,
        Na__LeVecAim__IsHoled,
        Na__LeVecAim__Rebuild,
        Na__LeVecAim__Shape
    } from './Na__LayoutEditor__VectorTools__Targets__.js';
    import { Na__LeVecPrev__TONE_REMOVE, Na__LeVecPrev__TONE_ADD, Na__LeVecPrev__TONE_HELD, Na__LeVecPrev__Show, Na__LeVecPrev__Clear } from './Na__LayoutEditor__VectorTools__Preview__.js';
    import { Na__LeVecCfg__Label, Na__LeVecCfg__Format } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import {
        Na__LeVec__TOOL_UNION,
        Na__LeVec__TOOL_SUBTRACT,
        Na__LeVec__TOOL_BOOL_TRIM,
        Na__LeVec__TOOL_INTERSECT,
        Na__LeVec__TOOL_BOOL_SPLIT,
        Na__LeVec__TOOL_OUTER_SHELL,
        Na__LeVec__BOOLEAN_TOOLS,
        Na__LeVec__Say,
        Na__LeVec__SetHint
    } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Why a Shape Is Refused Here (beyond the targets' own reasons)
    // ------------------------------------------------------------
    const Na__LeVecOps__REFUSE_OPEN = 'open';                                     // <-- A line, or a run with no inside: a Boolean works on areas
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Shape Held, and the Last Result Worked Out for the Preview
    // ------------------------------------------------------------
    let Na__LeVecOps__HeldId = null;    // <-- The first shape clicked; after a Union, Intersect or Outer Shell, the result; after a Trim, the cutter
    let Na__LeVecOps__Cache  = null;    // <-- { key, planned }: a hover stays over one shape for many moves
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shapes as Areas
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This One of the Six
    // ------------------------------------------------------------
    function Na__LeVecOps__IsTool(tool) { return Na__LeVec__BOOLEAN_TOOLS.indexOf(tool) !== -1; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Vector as the Area the Boolean Geometry Works On
    // ------------------------------------------------------------
    // Its rings - the outline and any holes - read as the painters fill them:
    // even-odd for a holed one, non-zero for any other.
    // ------------------------------------------------------------
    function Na__LeVecOps__Area(shape) {
        return { rings : Na__LeShapeGeo__Rings(shape), evenOdd : Na__LeVecAim__IsHoled(shape) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Why a Shape Cannot Take Part, or Null When It Can
    // ------------------------------------------------------------
    // The targets' reasons - a picture, a QR box, a room, a locked layer - with
    // holes allowed, and one of this tool's own: an open run has no inside.
    // ------------------------------------------------------------
    function Na__LeVecOps__Refusal(sheet, shape) {
        const why = Na__LeVecAim__Refusal(sheet, shape, { holes : true });
        if (why) return why;
        const pts = Array.isArray(shape.Shape__Points) ? shape.Shape__Points : [];
        if (shape.Shape__Closed !== true || pts.length < 3) return Na__LeVecOps__REFUSE_OPEN;
        return null;
    }
    function Na__LeVecOps__RefusalText(refusal) {
        if (refusal === Na__LeVecOps__REFUSE_OPEN) return Na__LeVecCfg__Label('SayBoolOpen', 'Booleans work on closed shapes: close that line first (right click, Close shape).');
        return Na__LeVecAim__RefusalText(refusal);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Shape's Place in the Paint Order (higher is further in front)
    // ------------------------------------------------------------
    // The layers list is the stack (Na__LayoutEditor__PaintOrder__), and on one
    // layer the later shape paints over the earlier.
    // ------------------------------------------------------------
    function Na__LeVecOps__Rank(sheet, shape) {
        const layers = Na__LePaint__MarkupBackToFront(sheet);
        let layer = layers.indexOf(shape.Shape__LayerId);
        if (layer === -1) layer = layers.length;                                 // <-- An unknown layer paints in front of everything
        return (layer * 1e6) + (sheet.Sheet__Shapes || []).indexOf(shape);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Shape a Boolean Tool Would Take at a Point: { shape, refusal }, or Null
    // ------------------------------------------------------------
    // Only shapes within reach of the level the editor is at, on layers that
    // are seen and may be picked. An EDGE within reach wins, the nearest; else
    // the frontmost shape the point is inside - which is how a shape inside a
    // bigger one is still reached, by its edge. A shape that CAN take part
    // wins over one that cannot - a line drawn across a filled shape does not
    // hide the shape - and one that cannot is answered only when nothing else
    // is there, so the refusal can be said.
    // ------------------------------------------------------------
    function Na__LeVecOps__At(sheet, pointMm) {
        if (!sheet || !pointMm) return null;
        const reach = Na__LeVecAim__ReachMm();
        const best  = { edge : null, inside : null, refusedEdge : null, refusedInside : null };
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (!shape || shape.Shape__Image || shape.Shape__Qr) return;
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId) || !Na__LeModel__IsLayerSelectable(sheet, shape.Shape__LayerId)) return;
            if (!Na__LeVecAim__InScope(sheet, shape)) return;
            const refusal = Na__LeVecOps__Refusal(sheet, shape);
            const d = Na__LeShapeGeo__DistanceToEdge(shape, pointMm);
            if (d <= reach) {
                const key = refusal ? 'refusedEdge' : 'edge';
                if (!best[key] || d <= best[key].d) best[key] = { shape : shape, d : d, refusal : refusal };
            } else if (shape.Shape__Closed === true && Na__LeShapeGeo__Contains(shape, pointMm)) {
                const key  = refusal ? 'refusedInside' : 'inside';
                const rank = Na__LeVecOps__Rank(sheet, shape);
                if (!best[key] || rank > best[key].rank) best[key] = { shape : shape, rank : rank, refusal : refusal };
            }
        });
        const found = best.edge || best.inside || best.refusedEdge || best.refusedInside;
        return found ? { shape : found.shape, refusal : found.refusal } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Held Shape's Record, or Null Once It Has Gone
    // ------------------------------------------------------------
    function Na__LeVecOps__Held(sheet) {
        const shape = Na__LeVecOps__HeldId ? Na__LeVecAim__Shape(sheet, Na__LeVecOps__HeldId) : null;
        if (!shape || Na__LeVecOps__Refusal(sheet, shape) || !Na__LeVecAim__InScope(sheet, shape)) { Na__LeVecOps__HeldId = null; return null; }   // <-- Deleted, undone away, locked or opened since
        return shape;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Each Tool Makes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Worked-Out Result
    // ------------------------------------------------------------
    // { ok : true, plan : [{ shape, pieces }], gone : [ id ], kept : [ id ],
    //   result : [ piece ], removed : [ shape ] } - what Rebuild writes, what the
    // preview draws in blue, and what it draws in red because it goes - or
    // { ok : false, say }.
    // ------------------------------------------------------------
    function Na__LeVecOps__Refuse(key, fallback) { return { ok : false, say : Na__LeVecCfg__Label(key, fallback) }; }
    function Na__LeVecOps__Planned(plan, gone, removed) {
        const pieces = [];
        plan.forEach((entry) => entry.pieces.forEach((piece) => pieces.push(piece)));
        return { ok : true, plan : plan, gone : gone || [], result : pieces, removed : removed || [] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pieces in the Form Rebuild Writes ({ points, holes })
    // ------------------------------------------------------------
    function Na__LeVecOps__Records(pieces) {
        return (pieces || []).map((piece) => Na__LeVecBool__ToRecord(piece));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Split: Each Piece to the Frontmost of the Shapes Over It
    // ------------------------------------------------------------
    // shapes are back to front. Every shape is a donor - a shape left with no
    // piece of its own is deleted by Rebuild, which is right: all of it lay
    // under the shapes in front of it, and those pieces now carry their style.
    // ------------------------------------------------------------
    function Na__LeVecOps__SplitPlan(shapes) {
        const faces = Na__LeVecBool__Divide(shapes.map(Na__LeVecOps__Area));
        if (!faces.some((face) => face.owners.length > 1)) return Na__LeVecOps__Refuse('SayBoolApart', 'Those shapes do not overlap.');
        const plan = shapes.map((shape) => ({ shape : shape, pieces : [] }));
        faces.forEach((face) => {
            const donor = face.owners[face.owners.length - 1];                   // <-- Owners come sorted, and the shapes are back to front: the last is the frontmost
            Na__LeVecOps__Records(face.pieces).forEach((piece) => plan[donor].pieces.push(piece));
        });
        return Na__LeVecOps__Planned(plan, [], []);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Tool Makes of Shapes in Order: the Base First, Then the Rest
    // ------------------------------------------------------------
    // order is what each tool reads as first and second. By clicking: the
    // first clicked, then the second. On a selection: back to front. For
    // Subtract and Trim the base is the shape CUT, and the rest cut it.
    // ------------------------------------------------------------
    function Na__LeVecOps__Make(tool, base, rest) {
        const all = [ base ].concat(rest);
        // THE REST GO AS RECORDS BUT NOT AS AREAS for these three: what they
        // covered is in the result, so the preview draws nothing of them red.
        if (tool === Na__LeVec__TOOL_UNION || tool === Na__LeVec__TOOL_OUTER_SHELL) {
            const pieces = (tool === Na__LeVec__TOOL_UNION ? Na__LeVecBool__Union : Na__LeVecBool__OuterShell)(all.map(Na__LeVecOps__Area));
            if (!pieces.length) return Na__LeVecOps__Refuse('SayBoolNothing', 'That leaves nothing to draw.');
            return Na__LeVecOps__Planned([ { shape : base, pieces : Na__LeVecOps__Records(pieces) } ], rest.map((s) => s.Shape__Id), []);
        }
        if (tool === Na__LeVec__TOOL_INTERSECT) {
            const pieces = Na__LeVecBool__Intersect(all.map(Na__LeVecOps__Area));
            if (!pieces.length) return Na__LeVecOps__Refuse('SayBoolApart', 'Those shapes do not overlap.');
            return Na__LeVecOps__Planned([ { shape : base, pieces : Na__LeVecOps__Records(pieces) } ], rest.map((s) => s.Shape__Id), []);
        }
        if (tool === Na__LeVec__TOOL_SUBTRACT || tool === Na__LeVec__TOOL_BOOL_TRIM) {
            const area    = Na__LeVecOps__Area(base);
            const cutting = rest.filter((cutter) => Na__LeVecBool__Overlaps(area, Na__LeVecOps__Area(cutter)));
            if (!cutting.length) return Na__LeVecOps__Refuse('SayBoolApart', 'Those shapes do not overlap.');
            const pieces = Na__LeVecBool__Subtract(area, cutting.map(Na__LeVecOps__Area));
            if (!pieces.length) return Na__LeVecOps__Refuse('SayBoolNothingLeft', 'That would cut the whole shape away. Delete it instead, or pick the shapes the other way round.');
            const trim = tool === Na__LeVec__TOOL_BOOL_TRIM;
            return Na__LeVecOps__Planned([ { shape : base, pieces : Na__LeVecOps__Records(pieces) } ], trim ? [] : cutting.map((s) => s.Shape__Id), trim ? [] : cutting);
        }
        return Na__LeVecOps__SplitPlan(all);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Tool Makes of Two Clicked Shapes: the First, Then the Second
    // ------------------------------------------------------------
    // SketchUp's order. Subtract and Trim cut the FIRST out of the SECOND.
    // The same shape twice is Outer Shell's way of filling its holes; to any
    // other tool it is nothing.
    // ------------------------------------------------------------
    function Na__LeVecOps__PlanClicks(tool, sheet, first, second) {
        if (first.Shape__Id === second.Shape__Id) {
            if (tool !== Na__LeVec__TOOL_OUTER_SHELL) return Na__LeVecOps__Refuse('SayBoolSame', 'Click a second shape.');
            if (!Na__LeVecAim__IsHoled(first)) return Na__LeVecOps__Refuse('SayBoolNoHoles', 'That shape has no holes to fill.');
            return Na__LeVecOps__Make(tool, first, []);
        }
        if (tool === Na__LeVec__TOOL_SUBTRACT || tool === Na__LeVec__TOOL_BOOL_TRIM) return Na__LeVecOps__Make(tool, second, [ first ]);
        if (tool === Na__LeVec__TOOL_BOOL_SPLIT) {
            const pair = [ first, second ].sort((a, b) => Na__LeVecOps__Rank(sheet, a) - Na__LeVecOps__Rank(sheet, b));   // <-- The shared piece takes the style of whichever is in front
            return Na__LeVecOps__SplitPlan(pair);
        }
        return Na__LeVecOps__Make(tool, first, [ second ]);
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Tool Makes of Selected Shapes, Back to Front
    // ------------------------------------------------------------
    // Trim is Illustrator's: EVERY shape loses what the shapes in front of it
    // cover, and they are all kept (a shape wholly under the others goes, as
    // there is nothing left of it to see). The other five read the backmost as
    // the base (Make).
    // ------------------------------------------------------------
    function Na__LeVecOps__PlanSelection(tool, sheet, shapes) {
        if (tool === Na__LeVec__TOOL_BOOL_TRIM) {
            const plan = [];
            shapes.forEach((shape, i) => {
                const area  = Na__LeVecOps__Area(shape);
                const above = shapes.slice(i + 1).filter((other) => Na__LeVecBool__Overlaps(area, Na__LeVecOps__Area(other)));
                if (!above.length) return;
                plan.push({ shape : shape, pieces : Na__LeVecOps__Records(Na__LeVecBool__Subtract(area, above.map(Na__LeVecOps__Area))) });
            });
            if (!plan.length) return Na__LeVecOps__Refuse('SayBoolApart', 'Those shapes do not overlap.');
            return Na__LeVecOps__Planned(plan, [], []);
        }
        return Na__LeVecOps__Make(tool, shapes[0], shapes.slice(1));
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Result Back (one undo step) and Select What It Made
    // ------------------------------------------------------------
    function Na__LeVecOps__Apply(sheet, planned) {
        const made = Na__LeVecAim__Rebuild(sheet, planned.plan, planned.gone);
        Na__LeVecOps__Cache = null;
        Na__LeModel__SetSelectionItems(made.map((id) => ({ kind : 'shape', id : id })));
        return made;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | On a Selection
// -----------------------------------------------------------------------------

    // FUNCTION | The Selected Shapes a Boolean Can Take, Back to Front, and How Many Were Left Out
    // ------------------------------------------------------------
    // Returns { shapes, skipped }. Only vectors within reach of the level the
    // editor is at count; anything else selected - text, a dimension, an open
    // line, a picture - is left out and counted, so it can be said.
    // ------------------------------------------------------------
    function Na__LeVecOps__SelectionOperands(sheet) {
        const out = { shapes : [], skipped : 0 };
        if (!sheet) return out;
        (Na__LeModel__GetSelectionItems() || []).forEach((item) => {
            if (!item) return;
            const shape = item.kind === 'shape' ? Na__LeVecAim__Shape(sheet, item.id) : null;
            if (!shape || !Na__LeVecAim__InScope(sheet, shape) || Na__LeVecOps__Refusal(sheet, shape)) { out.skipped++; return; }
            out.shapes.push(shape);
        });
        out.shapes.sort((a, b) => Na__LeVecOps__Rank(sheet, a) - Na__LeVecOps__Rank(sheet, b));
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can a Tool Act on the Selection as It Stands
    // ------------------------------------------------------------
    // Two closed shapes or more - or, for Outer Shell, one with holes.
    // ------------------------------------------------------------
    function Na__LeVecOps__SelectionReady(tool, operands) {
        const n = operands.shapes.length;
        if (n >= 2) return true;
        return tool === Na__LeVec__TOOL_OUTER_SHELL && n === 1 && Na__LeVecAim__IsHoled(operands.shapes[0]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Are Two or More Shapes a Boolean Can Take Selected (what Shift+U, Shift+S and Shift+T wait for)
    // ------------------------------------------------------------
    // The key map's BooleanSelection: closed vectors within reach of the level
    // the editor is at, not locked, not pictures, QR boxes or rooms - the same
    // test the right-click menu's Boolean row is offered on. Two open lines
    // selected are NOT such a selection, so Shift+T is still Extend for them.
    // ------------------------------------------------------------
    function Na__LeVecOps__SelectionTakesBoolean(sheet) {
        return !!sheet && Na__LeVecOps__SelectionOperands(sheet).shapes.length >= 2;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can Outer Shell Act on the Selection (what Shift+O waits for)
    // ------------------------------------------------------------
    // The key map's OuterShellSelection: two or more closed shapes, as for the
    // other three, or ONE with holes - Outer Shell alone fills a shape's holes.
    // ------------------------------------------------------------
    function Na__LeVecOps__SelectionTakesOuterShell(sheet) {
        return !!sheet && Na__LeVecOps__SelectionReady(Na__LeVec__TOOL_OUTER_SHELL, Na__LeVecOps__SelectionOperands(sheet));
    }
    // ------------------------------------------------------------


    // FUNCTION | Act on the Selection at Once (true when anything changed)
    // ------------------------------------------------------------
    function Na__LeVecOps__ApplySelection(tool, sheet) {
        if (!sheet || !Na__LeVecOps__IsTool(tool)) return false;
        const operands = Na__LeVecOps__SelectionOperands(sheet);
        if (!Na__LeVecOps__SelectionReady(tool, operands)) {
            Na__LeVec__Say(Na__LeVecCfg__Label('SayBoolNeedTwo', 'Select two or more closed shapes, or click them one after the other.'));
            return false;
        }
        const planned = Na__LeVecOps__PlanSelection(tool, sheet, operands.shapes);
        if (!planned.ok) { Na__LeVec__Say(planned.say); return false; }
        const made = Na__LeVecOps__Apply(sheet, planned);
        // TRIM KEEPS EVERY SHAPE - the front ones as they were - so it says how
        // many it cut back; "2 shapes into 1" would count only the cut ones.
        const done = operands.shapes.length === 1                                // <-- Only Outer Shell acts on one shape: it fills its holes
            ? Na__LeVecCfg__Label('SayBoolFilled', 'Outer Shell: its holes are filled.')
            : tool === Na__LeVec__TOOL_BOOL_TRIM
                ? Na__LeVecCfg__Format('SayBoolTrimmed', 'Trim: {trimmed} of {count} shapes cut back by the ones in front.', { trimmed : planned.plan.length, count : operands.shapes.length })
                : Na__LeVecCfg__Format('SayBoolDone', '{tool}: {count} shapes into {left}.', { tool : Na__LeVecOps__Name(tool), count : operands.shapes.length, left : made.length });
        Na__LeVec__Say(operands.skipped
            ? done + ' ' + Na__LeVecCfg__Format('SayBoolSkipped', '{count} other selected items were left out: Booleans work on closed vectors.', { count : operands.skipped })
            : done);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | By Clicking
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Tool's Name as the Panel Shows It
    // ------------------------------------------------------------
    function Na__LeVecOps__Name(tool) {
        if (tool === Na__LeVec__TOOL_UNION)       return Na__LeVecCfg__Label('ToolUnion', 'Union');
        if (tool === Na__LeVec__TOOL_SUBTRACT)    return Na__LeVecCfg__Label('ToolSubtract', 'Subtract');
        if (tool === Na__LeVec__TOOL_BOOL_TRIM)   return Na__LeVecCfg__Label('ToolBoolTrim', 'Trim');
        if (tool === Na__LeVec__TOOL_INTERSECT)   return Na__LeVecCfg__Label('ToolIntersect', 'Intersect');
        if (tool === Na__LeVec__TOOL_BOOL_SPLIT)  return Na__LeVecCfg__Label('ToolBoolSplit', 'Split');
        return Na__LeVecCfg__Label('ToolOuterShell', 'Outer Shell');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say What the Tool Wants Next
    // ------------------------------------------------------------
    function Na__LeVecOps__Hint(tool) {
        const held = !!Na__LeVecOps__HeldId;
        const pick = {};
        pick[Na__LeVec__TOOL_UNION]       = held ? [ 'HintUnionNext', 'Union: click a shape to add to it. Esc finishes.' ]                 : [ 'HintUnionFirst', 'Union: click the first shape.' ];
        pick[Na__LeVec__TOOL_SUBTRACT]    = held ? [ 'HintSubtractNext', 'Subtract: click the shape to cut it out of.' ]                   : [ 'HintSubtractFirst', 'Subtract: click the shape to cut away.' ];
        pick[Na__LeVec__TOOL_BOOL_TRIM]   = held ? [ 'HintBoolTrimNext', 'Trim: click each shape to trim with it. Esc finishes.' ]          : [ 'HintBoolTrimFirst', 'Trim: click the shape that cuts - it stays.' ];
        pick[Na__LeVec__TOOL_INTERSECT]   = held ? [ 'HintIntersectNext', 'Intersect: click the shape it overlaps.' ]                      : [ 'HintIntersectFirst', 'Intersect: click the first shape.' ];
        pick[Na__LeVec__TOOL_BOOL_SPLIT]  = held ? [ 'HintBoolSplitNext', 'Split: click the shape it overlaps.' ]                          : [ 'HintBoolSplitFirst', 'Split: click the first shape.' ];
        pick[Na__LeVec__TOOL_OUTER_SHELL] = held ? [ 'HintOuterShellNext', 'Outer Shell: click a shape to add, or this one again to fill its holes.' ] : [ 'HintOuterShellFirst', 'Outer Shell: click a shape.' ];
        const words = pick[tool];
        return Na__LeVec__SetHint(words ? Na__LeVecCfg__Label(words[0], words[1]) : '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Shape's Rings as Preview Parts
    // ------------------------------------------------------------
    function Na__LeVecOps__Parts(rings, tone, dashed) {
        return (rings || []).map((ring) => ({ points : ring, closed : true, tone : tone, dashed : dashed === true }));
    }
    function Na__LeVecOps__PieceRings(piece) {
        return [ piece.points.slice(0, piece.holes.length ? piece.holes[0] : piece.points.length) ].concat(
            piece.holes.map((start, k) => piece.points.slice(start, k + 1 < piece.holes.length ? piece.holes[k + 1] : piece.points.length)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Result of the Held Shape and This One, Worked Out Once Per Pair
    // ------------------------------------------------------------
    function Na__LeVecOps__Signature(shape) {
        const pts = Array.isArray(shape.Shape__Points) ? shape.Shape__Points : [];
        const a = pts[0] || [ 0, 0 ], b = pts[pts.length - 1] || [ 0, 0 ];
        return shape.Shape__Id + ':' + pts.length + ':' + a[0] + ',' + a[1] + ':' + b[0] + ',' + b[1] + ':' + (Array.isArray(shape.Shape__Holes) ? shape.Shape__Holes.join('.') : '');
    }
    function Na__LeVecOps__Cached(tool, sheet, first, second) {
        const key = tool + '|' + Na__LeVecOps__Signature(first) + '|' + Na__LeVecOps__Signature(second);
        if (Na__LeVecOps__Cache && Na__LeVecOps__Cache.key === key) return Na__LeVecOps__Cache.planned;
        const planned = Na__LeVecOps__PlanClicks(tool, sheet, first, second);
        Na__LeVecOps__Cache = { key : key, planned : planned };
        return planned;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor Moves With a Boolean Tool Up
    // ------------------------------------------------------------
    function Na__LeVecOps__Move(ctx) {
        Na__LeOsnap__HideMarker();
        const held  = Na__LeVecOps__Held(ctx.sheet);
        const aim   = Na__LeVecOps__At(ctx.sheet, ctx.pointMm);
        const parts = held ? Na__LeVecOps__Parts(Na__LeShapeGeo__Rings(held), Na__LeVecPrev__TONE_HELD, false) : [];
        Na__LeVecOps__Hint(ctx.tool);
        if (!aim) { Na__LeVecPrev__Show(parts, []); return 'crosshair'; }
        if (aim.refusal) { Na__LeVecPrev__Show(parts, []); return 'not-allowed'; }
        if (!held) {
            Na__LeVecPrev__Show(Na__LeVecOps__Parts(Na__LeShapeGeo__Rings(aim.shape), Na__LeVecPrev__TONE_ADD, true), []);
            return 'crosshair';
        }
        if (held.Shape__Id === aim.shape.Shape__Id && !(ctx.tool === Na__LeVec__TOOL_OUTER_SHELL && Na__LeVecAim__IsHoled(held))) { Na__LeVecPrev__Show(parts, []); return 'crosshair'; }
        const planned = Na__LeVecOps__Cached(ctx.tool, ctx.sheet, held, aim.shape);
        if (!planned.ok) { Na__LeVecPrev__Show(parts, []); return 'not-allowed'; }
        const shown = [];
        planned.removed.forEach((shape) => Na__LeVecOps__Parts(Na__LeShapeGeo__Rings(shape), Na__LeVecPrev__TONE_REMOVE, true).forEach((part) => shown.push(part)));
        planned.result.forEach((piece) => Na__LeVecOps__Parts(Na__LeVecOps__PieceRings(piece), Na__LeVecPrev__TONE_ADD, true).forEach((part) => shown.push(part)));
        Na__LeVecPrev__Show(shown.concat(ctx.tool === Na__LeVec__TOOL_BOOL_TRIM ? parts : []), []);   // <-- Trim's cutter stays, so it stays drawn as held
        return 'crosshair';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Click With a Boolean Tool Up
    // ------------------------------------------------------------
    function Na__LeVecOps__Press(ctx) {
        const aim = Na__LeVecOps__At(ctx.sheet, ctx.pointMm);
        if (!aim) { Na__LeVecOps__HeldId = null; Na__LeVecPrev__Clear(); Na__LeVecOps__Hint(ctx.tool); return false; }   // <-- Bare paper lets go
        if (aim.refusal) { Na__LeVec__Say(Na__LeVecOps__RefusalText(aim.refusal)); return false; }
        const held = Na__LeVecOps__Held(ctx.sheet);
        if (!held) {
            Na__LeVecOps__HeldId = aim.shape.Shape__Id;
            Na__LeModel__SetSelection({ kind : 'shape', id : aim.shape.Shape__Id });   // <-- Its style is the one a Union keeps: the Vectors panel shows it
            Na__LeVecOps__Hint(ctx.tool);
            Na__LeVecOps__Move(ctx);
            return true;
        }
        const planned = Na__LeVecOps__PlanClicks(ctx.tool, ctx.sheet, held, aim.shape);
        if (!planned.ok) { Na__LeVec__Say(planned.say); return false; }
        const made = Na__LeVecOps__Apply(ctx.sheet, planned);
        // WHAT STAYS HELD. A Union, an Intersect or an Outer Shell leaves its
        // result in the held shape's own record, so it stays held and the next
        // click adds to it; Trim's cutter is untouched and trims on; Subtract's
        // cutter has gone, and a Split has made several things.
        const chain = ctx.tool === Na__LeVec__TOOL_UNION || ctx.tool === Na__LeVec__TOOL_INTERSECT || ctx.tool === Na__LeVec__TOOL_OUTER_SHELL;
        if (ctx.tool !== Na__LeVec__TOOL_BOOL_TRIM && (!chain || made.indexOf(held.Shape__Id) === -1)) Na__LeVecOps__HeldId = null;
        Na__LeVecOps__Hint(ctx.tool);
        Na__LeVecOps__Move(ctx);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Picked Up: Act on a Selection There and Then, or Hold the One Shape Selected
    // ------------------------------------------------------------
    function Na__LeVecOps__Arm(tool, sheet) {
        Na__LeVecOps__Cancel();
        if (sheet) {
            const operands = Na__LeVecOps__SelectionOperands(sheet);
            if (Na__LeVecOps__SelectionReady(tool, operands)) Na__LeVecOps__ApplySelection(tool, sheet);
            else if (operands.shapes.length === 1) Na__LeVecOps__HeldId = operands.shapes[0].Shape__Id;   // <-- One shape selected: it is the first, as if it had been clicked
        }
        Na__LeVecOps__Hint(tool);
    }
    // ------------------------------------------------------------


    // FUNCTION | Let Go, and Is a Shape Held
    // ------------------------------------------------------------
    function Na__LeVecOps__Cancel() { const had = !!Na__LeVecOps__HeldId; Na__LeVecOps__HeldId = null; Na__LeVecOps__Cache = null; Na__LeVecPrev__Clear(); return had; }
    function Na__LeVecOps__IsBusy() { return !!Na__LeVecOps__HeldId; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Right-Click Menu of Several Selected Shapes
// -----------------------------------------------------------------------------

    // FUNCTION | A Boolean Row Whose Flyout Acts on the Selection at Once, or []
    // ------------------------------------------------------------
    // Offered only while the selection holds what a Boolean can take: two or
    // more closed shapes (Outer Shell alone also for one with holes, but a
    // menu of one row would be a strange flyout, so one shape gets none). The
    // row brings the rule that closes its section.
    // ------------------------------------------------------------
    function Na__LeVecOps__SelectionItems(sheet) {
        if (!sheet) return [];
        const operands = Na__LeVecOps__SelectionOperands(sheet);
        if (operands.shapes.length < 2) return [];
        const row = (tool, key, fallback, hotkey) => ({ label : Na__LeVecCfg__Label(key, fallback), hint : hotkey || '', onSelect : () => { Na__LeVecOps__ApplySelection(tool, sheet); } });
        return [ { label : Na__LeVecCfg__Label('MenuBoolean', 'Boolean'), submenu : [
            row(Na__LeVec__TOOL_UNION,       'MenuUnion',      'Union',                                       'Shift+U'),   // <-- The three keys (Na__Hotkeys__DrawingTabs__.json, When BooleanSelection) - only ever this situation, so this is the one menu that names them
            row(Na__LeVec__TOOL_SUBTRACT,    'MenuSubtract',   'Subtract (the front ones from the back one)', 'Shift+S'),
            row(Na__LeVec__TOOL_BOOL_TRIM,   'MenuBoolTrim',   'Trim (each by the ones in front)',            'Shift+T'),
            row(Na__LeVec__TOOL_INTERSECT,   'MenuIntersect',  'Intersect'),
            row(Na__LeVec__TOOL_BOOL_SPLIT,  'MenuBoolSplit',  'Split'),
            row(Na__LeVec__TOOL_OUTER_SHELL, 'MenuOuterShell', 'Outer Shell',                                 'Shift+O')
        ] }, { separator : true } ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Boolean Tools API
    // ------------------------------------------------------------
    export {
        Na__LeVecOps__REFUSE_OPEN,
        Na__LeVecOps__IsTool,
        Na__LeVecOps__Refusal,
        Na__LeVecOps__At,
        Na__LeVecOps__Make,
        Na__LeVecOps__PlanClicks,
        Na__LeVecOps__PlanSelection,
        Na__LeVecOps__SelectionOperands,
        Na__LeVecOps__SelectionTakesBoolean,
        Na__LeVecOps__SelectionTakesOuterShell,
        Na__LeVecOps__ApplySelection,
        Na__LeVecOps__Move,
        Na__LeVecOps__Press,
        Na__LeVecOps__Arm,
        Na__LeVecOps__Cancel,
        Na__LeVecOps__IsBusy,
        Na__LeVecOps__SelectionItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
