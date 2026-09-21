// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - TARGETS
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Targets__.js
// NAMESPACE  : Na__LeVecAim
// MODULE     : Layout Editor - Vector Tools - Targets
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which vector an edit tool may work on from where the editor is, what cuts it, and writing the result back as one undo step
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT MAY BE EDITED FOLLOWS THE OPEN CONTAINER, exactly as what may be
//   selected does. Out on the sheet it is the loose vectors - one inside a
//   group answers as the group, which is one piece, so step inside first.
//   Inside a group it is that group's own vectors. Inside a vector it is that
//   vector and nothing else. Inside a dimension it is nothing.
// - WHAT CUTS IS EVERYTHING THAT CAN BE SEEN. A cutting edge is not edited, so
//   it does not have to be reachable: every vector on a visible, snappable
//   layer cuts, grouped or not, locked or not - "a lock stops an edit, not an
//   alignment", the rule the snaps already keep. Pictures and QR boxes are
//   not linework and cut nothing. With Stop at the drawing's linework on, the
//   painted lines of the 2D viewports cut as well, read from the same source
//   the snaps read and only inside the box that matters.
// - ONLY PLAIN VECTORS ARE EDITED. A picture's points are its frame, a QR
//   box's are its code's, and a measured room is held closed by its record -
//   trimming one would open a room that cannot be open. Each is refused with
//   a reason rather than ignored, so the hint can say why.
// - WRITING BACK. Replace swaps one vector for the pieces left of it: the
//   first piece keeps the record - its id, its style, its place in the paint
//   order, its group - and every other piece is a copy of that record put
//   straight after it, in the same group. Every write is silent and ONE
//   announcement follows them (Na__LeModel__AnnounceShapes), so the history
//   takes one step and one Ctrl+Z puts the whole vector back; a fence, which
//   trims several, keeps even that for itself and announces once at the end.
//   Absorb is the other way about, for Join: one vector takes new points and
//   the ones it swallowed go, as one step. AddBeside is Offset's: a copy of
//   the record with new points, straight after the one it came from.
// - A piece keeps the record's Shape__Curve hint. It costs nothing when the
//   piece is no longer a curve: the hint is only ever a reason to LOOK
//   (Na__LeVecCurve__Describe reads the points and decides).
//
// INTEGRATION:
// - The Trim, Join, Split, Offset and Fillet tools call in.
// - Reads Na__LayoutEditor__EditScope__, Na__LayoutEditor__Groups__, the sheet
//   model and Na__LayoutEditor__Viewport2d__ (GetSnapSource).
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

    // MODULE IMPORTS | Config, Model, Surface, Groups, Scope, Viewports and Geometry
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSelectionSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerSelectable,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__GetShapeById,
        Na__LeModel__InsertShape,
        Na__LeModel__UpdateShape,
        Na__LeModel__DeleteItems,
        Na__LeModel__AddGroupMember,
        Na__LeModel__AnnounceShapes
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGroup__ParentOf } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeScope__Get, Na__LeScope__KIND_GROUP, Na__LeScope__KIND_VECTOR } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';
    import { Na__LeVp2d__GetSnapSource } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVecGeo__Path, Na__LeVecGeo__NearestStation, Na__LeVecGeo__Cutters } from './Na__LayoutEditor__VectorTools__Geometry__.js';
    import { Na__LeVec__GetSetting } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Why a Vector Is Refused, and the Viewport Line Classes That Cut
    // ------------------------------------------------------------
    const Na__LeVecAim__REFUSE_LOCKED = 'locked';
    const Na__LeVecAim__REFUSE_KIND   = 'kind';
    const Na__LeVecAim__LINE_CLASSES  = [ 'visible', 'section', 'authored' ];    // <-- The classes the snaps offer: what is drawn solid on the sheet
    const Na__LeVecAim__PICK_FACTOR   = 1.5;                                     // <-- A tool's reach for a line, as a multiple of the Select tool's: there is no fill to fall back on, so the line itself is the whole target
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drawing's Linework Last Gathered
    // ------------------------------------------------------------
    // One box at a time: a hover stays over one line for many moves, and a box
    // that has not changed over a drawing that has not changed gives the same
    // edges.
    // ------------------------------------------------------------
    let Na__LeVecAim__LineCache = null;    // <-- { key, edges }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What May Be Edited
// -----------------------------------------------------------------------------

    // FUNCTION | How Near a Line the Pointer Must Be, in Paper Millimetres at This Zoom
    // ------------------------------------------------------------
    function Na__LeVecAim__ReachMm() {
        return (Na__LeCfg__GetSelectionSetup().hitToleranceMm / Math.max(1e-6, Na__LeSurface__GetZoom())) * Na__LeVecAim__PICK_FACTOR;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is This Vector Within Reach of the Level the Editor Is At
    // ------------------------------------------------------------
    function Na__LeVecAim__InScope(sheet, shape) {
        const open   = Na__LeScope__Get();
        const parent = Na__LeGroup__ParentOf(sheet, 'shape', shape.Shape__Id);
        if (!open) return !parent;                                               // <-- On the sheet: the loose ones. A grouped one is its group's
        if (open.kind === Na__LeScope__KIND_VECTOR) return open.id === shape.Shape__Id;
        if (open.kind === Na__LeScope__KIND_GROUP)  return !!parent && parent.Group__Id === open.id;
        return false;                                                            // <-- A dimension is open: it holds no vectors
    }
    // ------------------------------------------------------------


    // FUNCTION | Why a Vector Cannot Be Edited, or Null When It Can
    // ------------------------------------------------------------
    function Na__LeVecAim__Refusal(sheet, shape) {
        if (!shape) return Na__LeVecAim__REFUSE_KIND;
        if (shape.Shape__Image || shape.Shape__Qr || shape.Shape__Area) return Na__LeVecAim__REFUSE_KIND;
        if (Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return Na__LeVecAim__REFUSE_LOCKED;
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Vector Whose LINE Is Nearest a Point, From Where the Editor Is
    // ------------------------------------------------------------
    // Returns { shape, path, at : { station, x, y, distance, index, t }, refusal }
    // or null when no line is within reach. refusal is null for a vector that
    // may be edited, else why not - the tools show that rather than nothing.
    // options.except: a shape id to leave out (the one a tool is holding).
    // Only the LINE counts, never the fill: these tools work on edges, and a
    // big filled shape would otherwise answer for every line drawn over it.
    // ------------------------------------------------------------
    function Na__LeVecAim__At(sheet, pointMm, options) {
        if (!sheet || !pointMm) return null;
        const reach  = Na__LeVecAim__ReachMm();
        const except = options && options.except ? options.except : null;
        let best = null;
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (!shape || shape.Shape__Id === except) return;
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId) || !Na__LeModel__IsLayerSelectable(sheet, shape.Shape__LayerId)) return;
            if (!Na__LeVecAim__InScope(sheet, shape)) return;
            const path = Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed);
            const at   = Na__LeVecGeo__NearestStation(path, pointMm);
            if (!at || at.distance > reach) return;
            if (!best || at.distance <= best.at.distance) best = { shape : shape, path : path, at : at, refusal : null };   // <-- A tie goes to the later one, which is drawn on top
        });
        if (best) best.refusal = Na__LeVecAim__Refusal(sheet, best.shape);
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Vector Within Reach of the Level the Editor Is At, That May Be Edited
    // ------------------------------------------------------------
    // What a fence is tested against. Each is { shape, path }.
    // ------------------------------------------------------------
    function Na__LeVecAim__All(sheet) {
        const out = [];
        if (!sheet) return out;
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (!shape) return;
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId) || !Na__LeModel__IsLayerSelectable(sheet, shape.Shape__LayerId)) return;
            if (!Na__LeVecAim__InScope(sheet, shape) || Na__LeVecAim__Refusal(sheet, shape)) return;
            out.push({ shape : shape, path : Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed) });
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Cuts
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Drawing's Own Lines Inside a Paper Box
    // ------------------------------------------------------------
    // box: { minX, minY, maxX, maxY } paper mm. Every painted line of every
    // visible, snappable 2D viewport whose frame meets the box, turned into
    // paper millimetres and kept only where its own box meets the asked one.
    // ------------------------------------------------------------
    function Na__LeVecAim__DrawingEdges(sheet, box) {
        const viewports = (sheet.Sheet__Viewports || []).filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D
            && Na__LeModel__IsLayerVisible(sheet, v.Viewport__LayerId) && Na__LeModel__IsLayerSelectable(sheet, v.Viewport__LayerId));
        const sources = [];
        let key = [ box.minX, box.minY, box.maxX, box.maxY ].map((n) => Math.round(n * 100)).join(',');
        viewports.forEach((viewport) => {
            const frame = viewport.Viewport__FrameMm;
            if (!frame || frame.X > box.maxX || frame.X + frame.WidthMm < box.minX || frame.Y > box.maxY || frame.Y + frame.HeightMm < box.minY) return;
            const source = Na__LeVp2d__GetSnapSource(viewport.Viewport__Id);
            if (!source || !source.classes || !source.window) return;
            sources.push(source);
            key += '|' + viewport.Viewport__Id + ':' + source.key;
        });
        if (Na__LeVecAim__LineCache && Na__LeVecAim__LineCache.key === key) return Na__LeVecAim__LineCache.edges;
        const edges = [];
        sources.forEach((source) => {
            const frame = source.window.Frame;
            Na__LeVecAim__LINE_CLASSES.forEach((name) => {
                const segments = source.classes[name];
                if (!segments || segments.length < 4) return;
                for (let i = 0; i + 3 < segments.length; i += 4) {
                    const a = source.window.ToPaper(segments[i], segments[i + 1]);
                    const b = source.window.ToPaper(segments[i + 2], segments[i + 3]);
                    if ((a.x < box.minX && b.x < box.minX) || (a.x > box.maxX && b.x > box.maxX) || (a.y < box.minY && b.y < box.minY) || (a.y > box.maxY && b.y > box.maxY)) continue;
                    if (frame && ((a.x < frame.X && b.x < frame.X) || (a.x > frame.X + frame.WidthMm && b.x > frame.X + frame.WidthMm)
                        || (a.y < frame.Y && b.y < frame.Y) || (a.y > frame.Y + frame.HeightMm && b.y > frame.Y + frame.HeightMm))) continue;   // <-- Cropped out of the frame: it is not on the sheet
                    edges.push([ a.x, a.y, b.x, b.y ]);
                }
            });
        });
        Na__LeVecAim__LineCache = { key : key, edges : edges };
        return edges;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Edge That May Cut a Vector, Inside a Paper Box
    // ------------------------------------------------------------
    // shapeId is the vector being cut, whose own edges are left out (its own
    // crossings are the geometry's to find, and only when asked). box is
    // { minX, minY, maxX, maxY }; an edge wholly outside it cannot matter.
    // ------------------------------------------------------------
    function Na__LeVecAim__CuttersFor(sheet, shapeId, box) {
        const out = [];
        if (!sheet || !box) return out;
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (!shape || shape.Shape__Id === shapeId || shape.Shape__Image || shape.Shape__Qr) return;
            if (!Na__LeModel__IsLayerVisible(sheet, shape.Shape__LayerId) || !Na__LeModel__IsLayerSelectable(sheet, shape.Shape__LayerId)) return;
            Na__LeVecGeo__Cutters(Na__LeVecGeo__Path(shape.Shape__Points, shape.Shape__Closed)).forEach((c) => {
                if ((c[0] < box.minX && c[2] < box.minX) || (c[0] > box.maxX && c[2] > box.maxX) || (c[1] < box.minY && c[3] < box.minY) || (c[1] > box.maxY && c[3] > box.maxY)) return;
                out.push(c);
            });
        });
        if (Na__LeVec__GetSetting('cutToDrawing') === true) Na__LeVecAim__DrawingEdges(sheet, box).forEach((c) => out.push(c));
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box Round a Run of Points, Grown by a Margin
    // ------------------------------------------------------------
    function Na__LeVecAim__BoxOf(points, marginMm) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        (points || []).forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        const m = Number.isFinite(marginMm) ? marginMm : 0;
        return { minX : minX - m, minY : minY - m, maxX : maxX + m, maxY : maxY + m };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing Back
// -----------------------------------------------------------------------------

    // FUNCTION | Swap One Vector for the Pieces Left of It (one undo step)
    // ------------------------------------------------------------
    // pieces: [{ points, closed }]. None at all deletes the vector. Returns the
    // ids of what is there afterwards, the record's own first. Every write is
    // silent and ONE announcement follows them, which is the history's one
    // step; options.silent leaves even that to the caller, so a fence that
    // trims six lines is still one Ctrl+Z (Announce below).
    // ------------------------------------------------------------
    function Na__LeVecAim__Replace(sheet, shape, pieces, options) {
        if (!sheet || !shape) return [];
        const quiet = !!(options && options.silent === true);
        const list  = (Array.isArray(pieces) ? pieces : []).filter((piece) => piece && Array.isArray(piece.points) && piece.points.length > 1);
        if (!list.length) {
            Na__LeModel__DeleteItems(sheet, [ { kind : 'shape', id : shape.Shape__Id } ], true);
            if (!quiet) Na__LeModel__AnnounceShapes(sheet, null);
            return [];
        }
        const ids    = [ shape.Shape__Id ];
        const parent = Na__LeGroup__ParentOf(sheet, 'shape', shape.Shape__Id);
        let after = shape.Shape__Id;
        for (let i = 1; i < list.length; i++) {
            const copy = JSON.parse(JSON.stringify(shape));
            copy.Shape__Points = list[i].points.map((p) => [ p[0], p[1] ]);
            copy.Shape__Closed = list[i].closed === true;
            const made = Na__LeModel__InsertShape(sheet, copy, true, after);      // <-- Straight after the piece before it: the paint order is kept
            if (!made) continue;
            if (parent) Na__LeModel__AddGroupMember(sheet, parent.Group__Id, { kind : 'shape', id : made.Shape__Id }, true);
            ids.push(made.Shape__Id);
            after = made.Shape__Id;
        }
        Na__LeModel__UpdateShape(sheet, shape.Shape__Id, { points : list[0].points, closed : list[0].closed === true }, true);
        if (!quiet) Na__LeModel__AnnounceShapes(sheet, shape.Shape__Id);
        return ids;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a New Vector on the Sheet Beside the One It Came From (one undo step)
    // ------------------------------------------------------------
    // A copy of the source's record - style, layer, group - with new points,
    // placed straight after it. What Offset makes. Returns the new record.
    // ------------------------------------------------------------
    function Na__LeVecAim__AddBeside(sheet, shape, piece) {
        if (!sheet || !shape || !piece || !Array.isArray(piece.points) || piece.points.length < 2) return null;
        const copy = JSON.parse(JSON.stringify(shape));
        copy.Shape__Points = piece.points.map((p) => [ p[0], p[1] ]);
        copy.Shape__Closed = piece.closed === true;
        const parent = Na__LeGroup__ParentOf(sheet, 'shape', shape.Shape__Id);
        const made   = Na__LeModel__InsertShape(sheet, copy, true, shape.Shape__Id);
        if (!made) return null;
        if (parent) Na__LeModel__AddGroupMember(sheet, parent.Group__Id, { kind : 'shape', id : made.Shape__Id }, true);
        Na__LeModel__AnnounceShapes(sheet, made.Shape__Id);                       // <-- The shape and its place in the group are one step
        return made;
    }
    // ------------------------------------------------------------


    // FUNCTION | Give One Vector New Points and Take Away the Ones It Swallowed (one undo step)
    // ------------------------------------------------------------
    // What Join and a two-line Fillet do. goneIds may be empty.
    // ------------------------------------------------------------
    function Na__LeVecAim__Absorb(sheet, keepId, piece, goneIds, options) {
        if (!sheet || !keepId || !piece) return false;
        const gone = (Array.isArray(goneIds) ? goneIds : []).filter((id) => id && id !== keepId).map((id) => ({ kind : 'shape', id : id }));
        if (gone.length) Na__LeModel__DeleteItems(sheet, gone, true);
        const ok = Na__LeModel__UpdateShape(sheet, keepId, { points : piece.points, closed : piece.closed === true }, true);
        if (ok && !(options && options.silent === true)) Na__LeModel__AnnounceShapes(sheet, keepId);
        return ok;
    }
    // ------------------------------------------------------------


    // FUNCTION | Announce a Run of Silent Writes (the one undo step a fence or a weld makes)
    // ------------------------------------------------------------
    function Na__LeVecAim__Announce(sheet, itemId) {
        return Na__LeModel__AnnounceShapes(sheet, itemId || null);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Record of a Vector by Id, Fresh From the Sheet
    // ------------------------------------------------------------
    function Na__LeVecAim__Shape(sheet, shapeId) {
        return sheet ? Na__LeModel__GetShapeById(sheet, shapeId) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Targets API
    // ------------------------------------------------------------
    export {
        Na__LeVecAim__REFUSE_LOCKED,
        Na__LeVecAim__REFUSE_KIND,
        Na__LeVecAim__ReachMm,
        Na__LeVecAim__Refusal,
        Na__LeVecAim__At,
        Na__LeVecAim__All,
        Na__LeVecAim__CuttersFor,
        Na__LeVecAim__BoxOf,
        Na__LeVecAim__Replace,
        Na__LeVecAim__AddBeside,
        Na__LeVecAim__Absorb,
        Na__LeVecAim__Announce,
        Na__LeVecAim__Shape
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
