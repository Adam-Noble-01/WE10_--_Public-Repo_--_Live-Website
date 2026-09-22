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
// - WHAT IS PLACED INSIDE AN OPEN GROUP JOINS IT, as in LayOut and SketchUp.
//   An adoption window (BeginAdopting, WithAdoption) remembers what was on the
//   sheet when it opened, and a before-announce hook puts anything NEW that is
//   announced while it is open into the innermost open group - just before
//   the announcement, so the history's one step holds the item and its
//   membership. An edit to an older item is never taken for a placement.
//   AdoptIntoOpenGroup does the same at once for a paste, which knows what it
//   put down.
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
// - Adoption: Na__LayoutEditor__SheetTools__ToolState__ opens a window while
//   the Text, Leader or Dimension tool is up; Na__LayoutEditor__ItemClipboard__
//   adopts a paste, a duplicate and a scrapbook drop; Sheet Images' Insert a
//   dropped picture and the Viewport panel a viewport it adds (WithAdoption).
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
// 22-Sep-2026 - Version 1.4.0
// - WHAT IS PLACED INSIDE AN OPEN GROUP JOINS IT (Adam: a leader, text or
//   dimension placed while a group was open landed outside it). The What Is
//   Placed Inside an Open Group region: BeginAdopting, EndAdopting,
//   WithAdoption, AdoptIntoOpenGroup and the before-announce hook
//   AdoptAnnounced. Only what is new since the window opened can join.
// - Contents lists an open group's viewports too, now that a group may hold
//   them (Na__LayoutEditor__Groups__ 1.4.0); the surface keeps their frames
//   at full strength while the rest of the sheet is faded.
//
// 22-Sep-2026 - Version 1.3.0
// - Contents hands the focus layer a group's leaders and dimensions too, now
//   that a group may hold them (Na__LayoutEditor__Groups__ 1.3.0): it only
//   looked for vectors and text, so an open group's bubbles would have been
//   left faded with the sheet behind it.
//
// 21-Sep-2026 - Version 1.2.0
// - Prune closes an open vector or dimension whose layer is hidden or made a
//   REFERENCE layer (the Layers panel's Ref): its points could otherwise go
//   on being dragged about while it could be neither seen nor picked. It runs
//   on every model change, so the switch in the panel closes it at once.
//
// 21-Sep-2026 - Version 1.1.1
// - A picture (a shape carrying Shape__Image) is not a container: CanEnter
//   answers null, so neither a double click nor Enter opens it for vertex
//   editing. Its corner grips and its crop are how it is edited.
//
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
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetLeaderById,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerSelectable,
        Na__LeModel__AddGroupMember,
        Na__LeModel__RegisterBeforeAnnounce
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeGroup__IsKind, Na__LeGroup__ParentOf, Na__LeGroup__Resolve, Na__LeGroup__Descendants } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
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
    let Na__LeScope__Adopting = null;  // <-- The adoption window: { sheetId, kinds, before : { kind : Set of ids } }, or null
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Where Each Kind Lives, and the Kind Each Announcement Names
    // ------------------------------------------------------------
    // A creation announces the plural reason; a leader or a dimension, made
    // silently while it is placed, announces the singular one when it lands.
    // Both name the item, and both are read.
    // ------------------------------------------------------------
    const Na__LeScope__KIND_LISTS = Object.freeze({
        viewport   : [ 'Sheet__Viewports',   'Viewport__Id'   ],
        shape      : [ 'Sheet__Shapes',      'Shape__Id'      ],
        annotation : [ 'Sheet__Annotations', 'Annotation__Id' ],
        leader     : [ 'Sheet__Leaders',     'Leader__Id'     ],
        dimension  : [ 'Sheet__Dimensions',  'Dimension__Id'  ]
    });
    const Na__LeScope__REASON_KINDS = Object.freeze({
        viewports   : 'viewport',   viewport   : 'viewport',
        shapes      : 'shape',      shape      : 'shape',
        annotations : 'annotation', annotation : 'annotation',
        leaders     : 'leader',     leader     : 'leader',
        dimensions  : 'dimension',  dimension  : 'dimension'
    });
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
        if (found.kind === Na__LeScope__KIND_VECTOR) {
            const shape = Na__LeModel__GetShapeById(sheet, found.id);
            return (shape && !shape.Shape__Image) ? { kind : Na__LeScope__KIND_VECTOR, id : found.id } : null;   // <-- A picture has no points to edit: its box is scaled by its corner grips and cut by its crop
        }
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


    // FUNCTION | Drop a Container Whose Record Has Gone (an undo, a delete, a new sheet) or Is Out of Reach
    // ------------------------------------------------------------
    // A vector or a dimension whose layer has been hidden, or made a
    // reference layer, closes as well: open, its points could still be
    // dragged while the thing itself could be neither seen nor picked.
    // ------------------------------------------------------------
    function Na__LeScope__Prune(sheet) {
        if (!Na__LeScope__Stack.length) return false;
        const reachable = (record, layerKey) => !!record && Na__LeModel__IsLayerVisible(sheet, record[layerKey]) && Na__LeModel__IsLayerSelectable(sheet, record[layerKey]);
        const alive = Na__LeScope__Stack.every((entry) => {
            if (entry.kind === Na__LeScope__KIND_GROUP)  return !!Na__LeModel__GetGroupById(sheet, entry.id);
            if (entry.kind === Na__LeScope__KIND_DIM)    return reachable(Na__LeScope__DimensionById(sheet, entry.id), 'Dimension__LayerId');
            return reachable(Na__LeModel__GetShapeById(sheet, entry.id), 'Shape__LayerId');
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
    // vector it is that vector; for a group it is every item inside it, at any
    // depth, that is still there. The markup is drawn again from this list;
    // a viewport's frame is kept at full strength by the surface instead.
    // ------------------------------------------------------------
    function Na__LeScope__Contents(sheet) {
        const open = Na__LeScope__Get();
        if (!sheet || !open) return [];
        if (Na__LeScope__LEAF_KINDS.indexOf(open.kind) !== -1) return [ { kind : open.kind, id : open.id } ];
        const exists = (member) => {
            if (member.kind === 'viewport')               return !!Na__LeModel__GetViewportById(sheet, member.id);
            if (member.kind === Na__LeScope__KIND_VECTOR) return !!Na__LeModel__GetShapeById(sheet, member.id);
            if (member.kind === 'annotation')             return !!Na__LeModel__GetAnnotationById(sheet, member.id);
            if (member.kind === 'leader')                 return !!Na__LeModel__GetLeaderById(sheet, member.id);
            if (member.kind === Na__LeScope__KIND_DIM)    return !!Na__LeScope__DimensionById(sheet, member.id);
            return false;
        };
        return Na__LeGroup__Descendants(sheet, open.id)
            .filter((member) => member.kind !== Na__LeScope__KIND_GROUP)
            .filter(exists);
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
// REGION | What Is Placed Inside an Open Group
// -----------------------------------------------------------------------------
//
// LayOut's rule, and SketchUp's: while a group is open for editing, what is
// placed goes into it. It used to land on the sheet outside the group - faded
// with everything else out there, and out of reach until the group was closed.
//
// ONLY WHAT IS NEW. A window remembers what was already on the sheet when it
// opened, so an announcement about anything else - an edit to an older item,
// the eyedropper painting something outside the group - is never taken for a
// placement. An item already in a group keeps its own.
//

    // HELPER FUNCTION | Is This Item on the Sheet
    // ------------------------------------------------------------
    function Na__LeScope__Exists(sheet, kind, id) {
        if (kind === Na__LeScope__KIND_GROUP) return !!Na__LeModel__GetGroupById(sheet, id);
        const row  = Na__LeScope__KIND_LISTS[kind];
        const list = (row && sheet && Array.isArray(sheet[row[0]])) ? sheet[row[0]] : [];
        return list.some((record) => !!record && record[row[1]] === id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Items Into the Innermost Open Group, Silently
    // ------------------------------------------------------------
    // items: [{ kind, id }]. Only while a GROUP is innermost (a vector or a
    // dimension open inside one holds points, not items). Each item must be
    // on the sheet and in no group yet, and a group is never put inside one of
    // its own members. Silent: the caller's announcement carries it. Returns
    // how many joined.
    // ------------------------------------------------------------
    function Na__LeScope__AdoptIntoOpenGroup(sheet, items) {
        const groupId = Na__LeScope__GetGroupId();
        if (!sheet || !groupId || !Array.isArray(items)) return 0;
        let joined = 0;
        items.forEach((item) => {
            if (!item || !item.id || !Na__LeGroup__IsKind(item.kind) || !Na__LeScope__Exists(sheet, item.kind, item.id)) return;
            if (Na__LeGroup__ParentOf(sheet, item.kind, item.id)) return;       // <-- In a group already: it keeps its own
            if (item.kind === Na__LeScope__KIND_GROUP && (item.id === groupId
                || Na__LeGroup__Descendants(sheet, item.id).some((member) => member.kind === Na__LeScope__KIND_GROUP && member.id === groupId))) return;   // <-- Never a group inside itself
            if (Na__LeModel__AddGroupMember(sheet, groupId, { kind : item.kind, id : item.id }, true)) joined += 1;
        });
        return joined;
    }
    // ------------------------------------------------------------


    // FUNCTION | Open an Adoption Window: What Is Placed From Now On Joins the Open Group
    // ------------------------------------------------------------
    // kinds: those that may join ('viewport', 'shape', 'annotation', 'leader',
    // 'dimension'). Only while a GROUP is innermost; with none open any window
    // closes and the answer is false. The hook is registered with the model
    // the first time, and a second registration is refused, so this can be
    // asked as often as a tool is picked up.
    // ------------------------------------------------------------
    function Na__LeScope__BeginAdopting(sheet, kinds) {
        const wanted = (Array.isArray(kinds) ? kinds : []).filter((kind) => !!Na__LeScope__KIND_LISTS[kind]);
        if (!sheet || !Na__LeScope__GetGroupId() || !wanted.length) { Na__LeScope__Adopting = null; return false; }
        const before = {};
        wanted.forEach((kind) => {
            const row = Na__LeScope__KIND_LISTS[kind];
            before[kind] = new Set((Array.isArray(sheet[row[0]]) ? sheet[row[0]] : []).filter(Boolean).map((record) => record[row[1]]));
        });
        Na__LeScope__Adopting = { sheetId : sheet.Sheet__Id, kinds : wanted, before : before };
        Na__LeModel__RegisterBeforeAnnounce(Na__LeScope__AdoptAnnounced);
        return true;
    }
    function Na__LeScope__EndAdopting() { Na__LeScope__Adopting = null; }
    function Na__LeScope__IsAdopting()  { return !!Na__LeScope__Adopting; }
    // ------------------------------------------------------------


    // FUNCTION | Place Something Inside a Window of Its Own (a dropped picture, an added viewport)
    // ------------------------------------------------------------
    // Opens a window for kinds, runs place() - which creates and announces as
    // it always did - and puts back whatever window was open before, whatever
    // happens. Returns what place() returns.
    // ------------------------------------------------------------
    function Na__LeScope__WithAdoption(sheet, kinds, place) {
        const previous = Na__LeScope__Adopting;
        Na__LeScope__BeginAdopting(sheet, kinds);
        try { return place(); }
        finally { Na__LeScope__Adopting = previous; }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Before-Announce Hook: an Announced New Item Joins the Open Group
    // ------------------------------------------------------------
    // Runs ahead of every listener, the history's included
    // (Na__LeModel__RegisterBeforeAnnounce), so the one snapshot of the change
    // holds the item and its membership. A restore - undo, redo - runs no
    // hooks at all.
    // ------------------------------------------------------------
    function Na__LeScope__AdoptAnnounced(reason, sheetId, itemId) {
        const open = Na__LeScope__Adopting;
        const kind = Na__LeScope__REASON_KINDS[reason];
        if (!open || !kind || !itemId || sheetId !== open.sheetId || open.kinds.indexOf(kind) === -1) return;
        if (open.before[kind].has(itemId)) return;                             // <-- On the sheet before the window opened: an edit, never a placement
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || sheet.Sheet__Id !== sheetId) return;
        Na__LeScope__AdoptIntoOpenGroup(sheet, [ { kind : kind, id : itemId } ]);
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
        Na__LeScope__BoxCandidates,
        Na__LeScope__AdoptIntoOpenGroup,
        Na__LeScope__BeginAdopting,
        Na__LeScope__EndAdopting,
        Na__LeScope__IsAdopting,
        Na__LeScope__WithAdoption
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
