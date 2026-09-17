// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - EDIT SCOPE
// =============================================================================
//
// FILE       : Na__LayoutEditor__EditScope__.js
// NAMESPACE  : Na__LeScope
// MODULE     : Layout Editor - Edit Scope
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The container being edited - a group, a vector or a dimension - and the points picked inside it
// CREATED    : 17-Sep-2026
//
// DESCRIPTION:
// - THE CONTEXT STACK, as SketchUp has one. Double-click (or Enter) on a group
//   steps inside it; double-click a vector or a dimension steps inside THAT,
//   and from there the only things on the sheet that answer a press are its own
//   points. Everything outside the open container is faded and inert until the
//   container is closed, so a vector is edited without any chance of dragging
//   the drawing behind it.
// - The stack is [{ kind : 'group' | 'shape' | 'dimension', id }], outermost
//   first. Empty is the sheet itself, which is how the editor has always
//   behaved. Groups nest, so the stack can be group, group, vector.
// - LEAF_KINDS are the containers that hold POINTS rather than items - a vector
//   and a dimension - so nothing opens inside them and they can only ever be
//   innermost. A dimension is a container for the same reason a vector is: the
//   two points it measures, the offset of its line and the place its value sits
//   are its insides, and reaching them by accident was what made a dimension
//   feel like something to delete and redraw rather than edit.
// - Resolve is the scope's answer to "what did this press land on": outside the
//   open container it is null, whatever is actually under the pointer, and
//   inside it the hit is remapped to the item that is selectable AT THIS LEVEL
//   (a member of the open group, or a nested group as one piece). With no
//   scope open it is exactly Na__LeGroup__Resolve, unchanged.
// - THE POINTS PICKED INSIDE A CONTAINER live here too, because they belong to
//   it and to nothing else: a list of vertex indices for a vector, the name of
//   one grip ('start', 'end', 'offset', 'text') for a dimension. A box drawn
//   inside a vector takes vertices rather than sheet items (BoxCandidates), a
//   drag of one picked vertex carries every picked vertex, and whatever is
//   picked is drawn red rather than blue.
// - Nothing here draws or reads the screen. The module announces CHANGED_EVENT
//   and the sheet tools book the redraw, which keeps the scope out of the
//   surface's import graph.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__HitResolution__ resolves presses through it,
//   and only offers vertex grabs on the open vector.
// - Na__LayoutEditor__SheetTools__PointerPress__ enters a container on a double
//   click, leaves it on a click outside, and drags vertices inside it.
// - Na__LayoutEditor__Grips__ draws vertex grips only for the open vector.
// - Na__LayoutEditor__SelectionBox__ asks it what a box may take.
// - Na__LayoutEditor__SheetSurface__ fades everything outside it and redraws
//   its contents crisply in the focus layer.
// - Na__LayoutEditor__SheetTools__ clears it on detach and books the redraw.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (17-Sep-2026, v2.59.0)
// - ValeVision    : ported 17-Sep-2026 as ValeVision3D v2.52.0 (verbatim)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.1.0
// - Dimensions are containers too (KIND_DIM, LEAF_KINDS): entering one is what
//   puts its grips on screen and makes its measured points draggable.
// - The picked grip (GetGrip / SetGrip / HasGrip), the dimension's counterpart
//   of the vertex selection: one name rather than a list, cleared with the
//   container. The grip drawing paints it red.
//
//
// 17-Sep-2026 - Version 1.0.0
// - The context stack, entering and leaving, scope-aware hit resolution, the
//   vertex selection and the box candidates inside a container.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Groups and Shape Geometry
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetGroupById,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeGroup__ParentOf, Na__LeGroup__Resolve, Na__LeGroup__Descendants } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeShapeGeo__Points } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Kinds and the Event
    // ------------------------------------------------------------
    const Na__LeScope__KIND_GROUP   = 'group';
    const Na__LeScope__KIND_VECTOR  = 'shape';
    const Na__LeScope__KIND_DIM     = 'dimension';
    const Na__LeScope__KIND_VERTEX  = 'vertex';                              // <-- What a box inside a vector takes
    const Na__LeScope__LEAF_KINDS   = Object.freeze([ Na__LeScope__KIND_VECTOR, Na__LeScope__KIND_DIM ]);   // <-- Containers of POINTS: nothing opens inside them
    const Na__LeScope__CHANGED_EVENT = 'na-layouteditor-scope-changed';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Open Containers and the Vertices Picked Inside One
    // ------------------------------------------------------------
    let Na__LeScope__Stack    = [];    // <-- Outermost first; empty is the sheet
    let Na__LeScope__Vertices = [];    // <-- Indices into the open vector's points
    let Na__LeScope__Grip     = null;  // <-- The grip picked inside the open dimension: 'start', 'end', 'offset' or 'text'
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Stack
// -----------------------------------------------------------------------------

    // FUNCTION | The Open Container, or Null for the Sheet Itself
    // ------------------------------------------------------------
    function Na__LeScope__Get() {
        return Na__LeScope__Stack.length ? Na__LeScope__Stack[Na__LeScope__Stack.length - 1] : null;
    }
    function Na__LeScope__Path()     { return Na__LeScope__Stack.map((entry) => ({ kind : entry.kind, id : entry.id })); }
    function Na__LeScope__Depth()    { return Na__LeScope__Stack.length; }
    function Na__LeScope__IsActive() { return Na__LeScope__Stack.length > 0; }
    // ------------------------------------------------------------


    // FUNCTION | The Vector Being Edited, or Null
    // ------------------------------------------------------------
    // Only the INNERMOST container can be a vector: a vector holds points, not
    // items, so nothing can be opened inside it.
    // ------------------------------------------------------------
    function Na__LeScope__GetVectorId() {
        const open = Na__LeScope__Get();
        return (open && open.kind === Na__LeScope__KIND_VECTOR) ? open.id : null;
    }
    function Na__LeScope__IsVectorEdit() { return Na__LeScope__GetVectorId() !== null; }
    // ------------------------------------------------------------


    // FUNCTION | The Dimension Being Edited, or Null
    // ------------------------------------------------------------
    // A dimension is a container in exactly the same sense a vector is: the
    // points it measures from, the line's offset and the place its value sits
    // are its insides, and they are only reachable from within it. Outside, a
    // dimension is one object that selects, moves and deletes as a whole.
    // ------------------------------------------------------------
    function Na__LeScope__GetDimensionId() {
        const open = Na__LeScope__Get();
        return (open && open.kind === Na__LeScope__KIND_DIM) ? open.id : null;
    }
    function Na__LeScope__IsDimensionEdit() { return Na__LeScope__GetDimensionId() !== null; }
    // ------------------------------------------------------------


    // FUNCTION | Is a Container of Points Open (a vector, or a dimension)
    // ------------------------------------------------------------
    function Na__LeScope__IsLeafOpen() {
        const open = Na__LeScope__Get();
        return !!open && Na__LeScope__LEAF_KINDS.indexOf(open.kind) !== -1;
    }
    function Na__LeScope__IsOpen(kind, id) {
        const open = Na__LeScope__Get();
        return !!open && open.kind === kind && open.id === id;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Group Being Edited, or Null
    // ------------------------------------------------------------
    function Na__LeScope__GetGroupId() {
        const open = Na__LeScope__Get();
        return (open && open.kind === Na__LeScope__KIND_GROUP) ? open.id : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce That the Open Container Changed
    // ------------------------------------------------------------
    function Na__LeScope__Announce() {
        window.dispatchEvent(new CustomEvent(Na__LeScope__CHANGED_EVENT, { detail : { scope : Na__LeScope__Get(), depth : Na__LeScope__Stack.length } }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entering and Leaving
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Dimension Record by Its Id
    // ------------------------------------------------------------
    // Read straight off the sheet, the way the hit resolution reads it: the
    // model has no by-id getter for dimensions and this module needs no more
    // than the record's existence.
    // ------------------------------------------------------------
    function Na__LeScope__DimensionById(sheet, itemId) {
        if (!sheet || !itemId) return null;
        return (sheet.Sheet__Dimensions || []).find((dim) => dim.Dimension__Id === itemId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Double Click on This Item Would Open, or Null
    // ------------------------------------------------------------
    // A group opens as a group; a vector opens as a vector. Anything else - a
    // dimension, a text item, a leader, a viewport - has no inside, and those
    // keep the double click they already had (edit the words, enter a
    // viewport's content).
    // ------------------------------------------------------------
    function Na__LeScope__CanEnter(sheet, found) {
        if (!sheet || !found || !found.id) return null;
        if (found.kind === Na__LeScope__KIND_GROUP)  return Na__LeModel__GetGroupById(sheet, found.id)     ? { kind : Na__LeScope__KIND_GROUP,  id : found.id } : null;
        if (found.kind === Na__LeScope__KIND_VECTOR) return Na__LeModel__GetShapeById(sheet, found.id)     ? { kind : Na__LeScope__KIND_VECTOR, id : found.id } : null;
        if (found.kind === Na__LeScope__KIND_DIM)    return Na__LeScope__DimensionById(sheet, found.id) ? { kind : Na__LeScope__KIND_DIM,    id : found.id } : null;
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Inside a Container
    // ------------------------------------------------------------
    // The item must be reachable from where we already are, so a stack can only
    // ever describe one nest: sheet, group, nested group, vector.
    // ------------------------------------------------------------
    function Na__LeScope__Enter(sheet, found) {
        const target = Na__LeScope__CanEnter(sheet, found);
        if (!target) return false;
        if (Na__LeScope__IsLeafOpen()) return false;                         // <-- A vector and a dimension hold points, not rooms
        const open = Na__LeScope__Get();
        if (open && !Na__LeScope__IsMemberOf(sheet, open, target)) return false;
        Na__LeScope__Stack.push(target);
        Na__LeScope__Vertices = [];
        Na__LeScope__Grip     = null;
        Na__LeScope__Announce();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step Back Out One Level (true when it moved)
    // ------------------------------------------------------------
    function Na__LeScope__Exit() {
        if (!Na__LeScope__Stack.length) return false;
        Na__LeScope__Stack.pop();
        Na__LeScope__Vertices = [];
        Na__LeScope__Grip     = null;
        Na__LeScope__Announce();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close Every Container (true when one was open)
    // ------------------------------------------------------------
    function Na__LeScope__Clear() {
        if (!Na__LeScope__Stack.length && !Na__LeScope__Vertices.length && !Na__LeScope__Grip) return false;
        Na__LeScope__Stack    = [];
        Na__LeScope__Vertices = [];
        Na__LeScope__Grip     = null;
        Na__LeScope__Announce();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Containers a Press Landed Outside Of (true when it moved)
    // ------------------------------------------------------------
    // Walks out from the innermost container until the press is inside one, or
    // until there is nothing left open. found is the UNSCOPED hit - what is
    // really under the pointer - so a click on a vector two levels out lands
    // where it looks like it should.
    // ------------------------------------------------------------
    function Na__LeScope__ExitTo(sheet, found) {
        let moved = false;
        while (Na__LeScope__Stack.length) {
            const open = Na__LeScope__Get();
            if (found && Na__LeScope__IsInside(sheet, open, found)) break;   // <-- The press belongs to this container: stop here
            Na__LeScope__Stack.pop();
            moved = true;
        }
        if (moved) { Na__LeScope__Vertices = []; Na__LeScope__Grip = null; Na__LeScope__Announce(); }
        return moved;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop a Container Whose Record Has Gone (an undo, a delete, a new sheet)
    // ------------------------------------------------------------
    function Na__LeScope__Prune(sheet) {
        if (!Na__LeScope__Stack.length) return false;
        const alive = Na__LeScope__Stack.every((entry) => {
            if (entry.kind === Na__LeScope__KIND_GROUP)  return !!Na__LeModel__GetGroupById(sheet, entry.id);
            if (entry.kind === Na__LeScope__KIND_DIM)    return !!Na__LeScope__DimensionById(sheet, entry.id);
            return !!Na__LeModel__GetShapeById(sheet, entry.id);
        });
        if (alive) return Na__LeScope__ClampVertices(sheet);
        return Na__LeScope__Clear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Membership
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Item a DIRECT Member of That Container
    // ------------------------------------------------------------
    function Na__LeScope__IsMemberOf(sheet, container, item) {
        if (!container || !item) return false;
        if (container.kind !== Na__LeScope__KIND_GROUP) return false;
        const parent = Na__LeGroup__ParentOf(sheet, item.kind, item.id);
        return !!parent && parent.Group__Id === container.id;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Item Inside That Container, However Deeply
    // ------------------------------------------------------------
    // A vector container holds only itself: its points are not items.
    // ------------------------------------------------------------
    function Na__LeScope__IsInside(sheet, container, item) {
        if (!container || !item) return false;
        if (Na__LeScope__LEAF_KINDS.indexOf(container.kind) !== -1) return item.kind === container.kind && item.id === container.id;
        if (item.kind === Na__LeScope__KIND_GROUP && item.id === container.id) return false;   // <-- The group itself is not inside itself
        return !!Na__LeScope__MemberChain(sheet, container, item);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Direct Member of a Container That Holds an Item
    // ------------------------------------------------------------
    // Walks up the group chain from the item until the step before the
    // container. The item itself is returned when it sits in the container
    // directly. Null when the item is somewhere else on the sheet.
    // ------------------------------------------------------------
    function Na__LeScope__MemberChain(sheet, container, item) {
        if (!sheet || !container || !item || container.kind !== Na__LeScope__KIND_GROUP) return null;
        let current = { kind : item.kind, id : item.id };
        const seen  = new Set();
        while (current && !seen.has(current.kind + ':' + current.id)) {
            seen.add(current.kind + ':' + current.id);
            const parent = Na__LeGroup__ParentOf(sheet, current.kind, current.id);
            if (!parent) return null;                                        // <-- Ran out of groups without meeting the container
            if (parent.Group__Id === container.id) return current;
            current = { kind : Na__LeScope__KIND_GROUP, id : parent.Group__Id };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Items the Open Container Holds, Nested Groups Opened Up
    // ------------------------------------------------------------
    // Used to redraw what is being edited crisply over the faded sheet. For a
    // vector it is that vector; for a group it is every vector and text item
    // inside it, at any depth.
    // ------------------------------------------------------------
    function Na__LeScope__Contents(sheet) {
        const open = Na__LeScope__Get();
        if (!sheet || !open) return [];
        if (Na__LeScope__LEAF_KINDS.indexOf(open.kind) !== -1) return [ { kind : open.kind, id : open.id } ];
        return Na__LeGroup__Descendants(sheet, open.id)
            .filter((member) => member.kind !== Na__LeScope__KIND_GROUP)
            .filter((member) => (member.kind === Na__LeScope__KIND_VECTOR
                ? !!Na__LeModel__GetShapeById(sheet, member.id)
                : !!Na__LeModel__GetAnnotationById(sheet, member.id)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scope-Aware Hit Resolution
// -----------------------------------------------------------------------------

    // FUNCTION | Remap a Hit to What Is Selectable at This Level, or Null Outside
    // ------------------------------------------------------------
    // With nothing open this is Na__LeGroup__Resolve: a member of a group
    // answers as the outermost group that holds it, exactly as before.
    //
    // With a group open, a hit on one of its members answers as that member (a
    // nested group answers as the nested group, one piece, which is what a
    // second double click then opens). A hit on anything outside the group
    // answers null, so nothing outside can be picked up by mistake.
    //
    // With a vector open, only that vector answers.
    // ------------------------------------------------------------
    function Na__LeScope__Resolve(sheet, found) {
        const open = Na__LeScope__Get();
        if (!open) return Na__LeGroup__Resolve(sheet, found);
        if (!found) return null;
        if (Na__LeScope__LEAF_KINDS.indexOf(open.kind) !== -1) {
            return (found.kind === open.kind && found.id === open.id) ? found : null;
        }
        const member = Na__LeScope__MemberChain(sheet, open, found);
        if (!member) return null;
        return Object.assign({}, found, { kind : member.kind, id : member.id });
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Item Allowed to Be Selected Where We Are
    // ------------------------------------------------------------
    function Na__LeScope__Allows(sheet, kind, id) {
        const open = Na__LeScope__Get();
        if (!open) return true;
        return Na__LeScope__IsInside(sheet, open, { kind : kind, id : id });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Vertex Selection Inside a Vector
// -----------------------------------------------------------------------------

    // FUNCTION | The Vertices Picked Inside the Open Vector
    // ------------------------------------------------------------
    function Na__LeScope__GetVertices()      { return Na__LeScope__Vertices.slice(); }
    function Na__LeScope__VertexCount()      { return Na__LeScope__Vertices.length; }
    function Na__LeScope__HasVertex(index)   { return Na__LeScope__Vertices.indexOf(index) !== -1; }
    // ------------------------------------------------------------


    // FUNCTION | Replace the Vertex Selection (indices are tidied and sorted)
    // ------------------------------------------------------------
    function Na__LeScope__SetVertices(indices) {
        if (!Na__LeScope__IsVectorEdit()) return false;
        const seen = new Set();
        (Array.isArray(indices) ? indices : []).forEach((value) => {
            const index = Math.trunc(Number(value));
            if (Number.isFinite(index) && index >= 0) seen.add(index);
        });
        const next = Array.from(seen).sort((a, b) => a - b);
        if (next.length === Na__LeScope__Vertices.length && next.every((value, i) => value === Na__LeScope__Vertices[i])) return false;
        Na__LeScope__Vertices = next;
        Na__LeScope__Announce();
        return true;
    }
    function Na__LeScope__ClearVertices() { return Na__LeScope__SetVertices([]); }
    // ------------------------------------------------------------


    // FUNCTION | The Grip Picked Inside the Open Dimension
    // ------------------------------------------------------------
    // A dimension has named grips, not a run of points, so what is picked
    // inside one is a name: 'start' or 'end' (the two measured points),
    // 'offset' (the dimension line) or 'text' (the value). It is set by the
    // press that takes hold of a grip and read by the grip drawing, which
    // paints the picked one red - the same signal a picked vertex gives, in the
    // one place a dimension can be edited from.
    // ------------------------------------------------------------
    function Na__LeScope__GetGrip() { return Na__LeScope__Grip; }
    function Na__LeScope__HasGrip(name) { return !!name && Na__LeScope__Grip === name; }
    function Na__LeScope__SetGrip(name) {
        const next = (typeof name === 'string' && name && name !== 'whole') ? name : null;
        if (next === Na__LeScope__Grip) return false;
        Na__LeScope__Grip = next;
        Na__LeScope__Announce();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop Indices the Vector No Longer Has (a vertex was deleted, or an undo)
    // ------------------------------------------------------------
    function Na__LeScope__ClampVertices(sheet) {
        const shapeId = Na__LeScope__GetVectorId();
        if (!shapeId || !Na__LeScope__Vertices.length) return false;
        const shape = Na__LeModel__GetShapeById(sheet, shapeId);
        const count = shape ? Na__LeShapeGeo__Points(shape).length : 0;
        return Na__LeScope__SetVertices(Na__LeScope__Vertices.filter((index) => index < count));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Indices a Drag on This Vertex Should Carry
    // ------------------------------------------------------------
    // A press on a vertex that is part of the picked set carries the whole set;
    // a press on any other vertex takes just that one, and picks it.
    // ------------------------------------------------------------
    function Na__LeScope__VerticesForDrag(index) {
        if (!Na__LeScope__IsVectorEdit()) return [ index ];
        if (Na__LeScope__HasVertex(index) && Na__LeScope__Vertices.length > 1) return Na__LeScope__GetVertices();
        Na__LeScope__SetVertices([ index ]);
        return [ index ];
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Box Drawn Inside the Open Container May Take, or Null
    // ------------------------------------------------------------
    // Null means "no container is open": the selection box then looks at the
    // whole sheet, as it always did.
    //
    // Inside a VECTOR each vertex is a candidate of its own, a single point,
    // which the box's window and crossing rules already handle. Inside a GROUP
    // the candidates are its direct members, so a box takes what is in the
    // group and never the drawing behind it; a nested group is offered whole.
    //
    // describe(sheet, item) is handed in by the selection box, the one place
    // that knows what each kind is made of. It returns { parts, bounds } or
    // null, so this module never imports the box back.
    // ------------------------------------------------------------
    function Na__LeScope__BoxCandidates(sheet, describe) {
        const open = Na__LeScope__Get();
        if (!sheet || !open) return null;
        if (open.kind === Na__LeScope__KIND_DIM) return [];                  // <-- A dimension has grips, not a run of points: a box takes nothing
        if (open.kind === Na__LeScope__KIND_VECTOR) {
            const shape = Na__LeModel__GetShapeById(sheet, open.id);
            if (!shape) return [];
            return Na__LeShapeGeo__Points(shape).map((point, index) => ({
                kind   : Na__LeScope__KIND_VERTEX,
                id     : index,
                parts  : [ { points : [ [ point[0], point[1] ] ], closed : false, area : false } ],
                bounds : { X : point[0], Y : point[1], WidthMm : 0, HeightMm : 0 }
            }));
        }
        const out = [];
        if (typeof describe !== 'function') return out;
        (Na__LeGroup__Descendants(sheet, open.id) || []).forEach((member) => {
            if (!Na__LeScope__IsMemberOf(sheet, open, member)) return;       // <-- Direct members only: a nested group is taken whole
            const described = describe(sheet, member);
            if (described && Array.isArray(described.parts) && described.parts.length) {
                out.push({ kind : member.kind, id : member.id, parts : described.parts, bounds : described.bounds });
            }
        });
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Edit Scope API
    // ------------------------------------------------------------
    export {
        Na__LeScope__KIND_GROUP,
        Na__LeScope__KIND_VECTOR,
        Na__LeScope__KIND_DIM,
        Na__LeScope__KIND_VERTEX,
        Na__LeScope__LEAF_KINDS,
        Na__LeScope__CHANGED_EVENT,
        Na__LeScope__Get,
        Na__LeScope__Path,
        Na__LeScope__Depth,
        Na__LeScope__IsActive,
        Na__LeScope__GetVectorId,
        Na__LeScope__GetDimensionId,
        Na__LeScope__GetGroupId,
        Na__LeScope__IsVectorEdit,
        Na__LeScope__IsDimensionEdit,
        Na__LeScope__IsLeafOpen,
        Na__LeScope__IsOpen,
        Na__LeScope__CanEnter,
        Na__LeScope__Enter,
        Na__LeScope__Exit,
        Na__LeScope__ExitTo,
        Na__LeScope__Clear,
        Na__LeScope__Prune,
        Na__LeScope__IsInside,
        Na__LeScope__Contents,
        Na__LeScope__Resolve,
        Na__LeScope__Allows,
        Na__LeScope__GetVertices,
        Na__LeScope__VertexCount,
        Na__LeScope__HasVertex,
        Na__LeScope__SetVertices,
        Na__LeScope__ClearVertices,
        Na__LeScope__VerticesForDrag,
        Na__LeScope__GetGrip,
        Na__LeScope__HasGrip,
        Na__LeScope__SetGrip,
        Na__LeScope__BoxCandidates
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
