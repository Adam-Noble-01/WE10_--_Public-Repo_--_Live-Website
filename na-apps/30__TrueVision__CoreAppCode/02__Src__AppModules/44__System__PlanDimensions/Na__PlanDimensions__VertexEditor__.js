// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - VERTEX EDITOR
// =============================================================================
//
// FILE       : Na__PlanDimensions__VertexEditor__.js
// NAMESPACE  : Na__PlanDimVert
// MODULE     : Plan Dimensions - Vertex Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Post-placement editing of a dimension's two end points
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Double-clicking a placed dimension opens it for vertex editing: an X marker
//   appears at each end and either can be dragged to a new position. That is
//   the difference between a dimension you have to delete and redraw and one
//   you can simply correct.
//
// - EVERY DRAG LANDS ON THE SNAP GRID. The endpoint setter rounds through the
//   same 5 mm grid the original placement used, so a corrected vertex sits on
//   exactly the coordinates a freshly placed one would - no half-step drift
//   that would make two dimensions of the same wall disagree.
//
// - THE CONSTRAINTS ARE THE SAME ONES, ANCHORED DIFFERENTLY. Dragging the start
//   vertex constrains against the END vertex, and vice versa. That is what makes
//   "grab the start and pull it square with the other end" work: the fixed end
//   is the origin the axis lock, Shift and ortho mode all measure from, exactly
//   as the first click is during placement.
//
// - The handles are drawn into the dimension SVG layer and reprojected every
//   frame alongside it, so they stay planted on their world points while the
//   plan is panned or zoomed underneath them.
//
// - Only one dimension is ever open for vertex editing. Opening another closes
//   the first, so there is never an ambiguous set of handles on screen.
//
// INTEGRATION:
// - Na__PlanDimensions__Editor__ opens this on a double click.
// - Na__FloorPlan__ModeController__ calls Sync each frame and Dispose on exit.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the dimension editing controls.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Math and Plan Camera Projection
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__FpCam__ProjectWorldToScreen } from '../42__System__FloorPlanViews/Na__FloorPlan__OrthoCamera__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Data, Grid, Overlay, Axis Lock and History
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // @delegate: ./Na__PlanDimensions__Grid__.js
    // @delegate: ./Na__PlanDimensions__AxisLock__.js
    // @delegate: ./Na__PlanDimensions__History__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDim__F_START_X,
        Na__PlanDim__F_START_Z,
        Na__PlanDim__F_END_X,
        Na__PlanDim__F_END_Z,
        Na__PlanDim__SetEndpoint,
        Na__PlanDim__GetEditingSetup,
        Na__PlanDim__GetLayerSetup
    } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimGrid__AXIS_X,
        Na__PlanDimGrid__AXIS_Z,
        Na__PlanDimGrid__SnapPointMm,
        Na__PlanDimGrid__ClampToPlane
    } from './Na__PlanDimensions__Grid__.js';
    import {
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__GetHost,
        Na__PlanDimLayer__Sync,
        Na__PlanDimLayer__ScreenToWorldMm
    } from './Na__PlanDimensions__Overlay__.js';
    import {
        Na__PlanDimAxis__Resolve,
        Na__PlanDimAxis__SetAnchorPx,
        Na__PlanDimAxis__Reset
    } from './Na__PlanDimensions__AxisLock__.js';
    import {
        Na__PlanDimHist__BeginPending,
        Na__PlanDimHist__CommitPending,
        Na__PlanDimHist__DiscardPending
    } from './Na__PlanDimensions__History__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | SVG and Class Names
    // ------------------------------------------------------------
    const Na__PlanDimVert__SVG_NS      = 'http://www.w3.org/2000/svg';
    const Na__PlanDimVert__GROUP_ID    = 'naPlanDimVertexHandles';
    const Na__PlanDimVert__GROUP_CLASS = 'na-plan-dim__vertices';
    const Na__PlanDimVert__HANDLE_CLASS = 'na-plan-dim__vertex';
    const Na__PlanDimVert__ACTIVE_CLASS = 'is-dragging';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Vertex Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimVert__START = 'start';
    const Na__PlanDimVert__END   = 'end';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Open Record and Its Handles
    // ------------------------------------------------------------
    let Na__PlanDimVert__Record  = null;   // <-- LIVE record being vertex-edited
    let Na__PlanDimVert__Group   = null;   // <-- SVG <g> holding both handles
    let Na__PlanDimVert__Handles = null;   // <-- { start: {...}, end: {...} }
    let Na__PlanDimVert__OnChanged = null; // <-- Host callback for unsaved-change tracking
    // ------------------------------------------------------------

    // MODULE VARIABLES | Active Vertex Drag
    // ------------------------------------------------------------
    let Na__PlanDimVert__DragWhich = null;    // <-- 'start' or 'end'
    let Na__PlanDimVert__DragMoved = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Plane Height the Handles Project At
    // ------------------------------------------------------------
    // Matched to the dimension layer's own plane so a handle sits exactly on
    // the line it belongs to rather than a fraction in front of it.
    // ------------------------------------------------------------
    let Na__PlanDimVert__PlaneHeightMm = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Canvas Size of the Dimension Layer Host
    // ------------------------------------------------------------
    function Na__PlanDimVert__GetSize() {
        const host = Na__PlanDimLayer__GetHost();
        if (!host) return { width: 0, height: 0 };
        return { width: host.clientWidth || 0, height: host.clientHeight || 0 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Project One World Millimetre Point to Canvas Pixels
    // ------------------------------------------------------------
    function Na__PlanDimVert__ProjectMm(xMm, zMm) {
        const size = Na__PlanDimVert__GetSize();
        if (!size.width || !size.height) return null;

        const worldY = Na__Math__ConvertMmToUnits(Na__PlanDimVert__PlaneHeightMm);
        return Na__FpCam__ProjectWorldToScreen(
            Na__Math__ConvertMmToUnits(xMm),
            worldY,
            Na__Math__ConvertMmToUnits(zMm),
            size.width,
            size.height
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Vertex of the Open Record
    // ------------------------------------------------------------
    function Na__PlanDimVert__ReadVertex(which) {
        const r = Na__PlanDimVert__Record;
        if (!r) return null;

        return (which === Na__PlanDimVert__START)
            ? { posXMm: r[Na__PlanDim__F_START_X], posZMm: r[Na__PlanDim__F_START_Z] }
            : { posXMm: r[Na__PlanDim__F_END_X],   posZMm: r[Na__PlanDim__F_END_Z] };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Vertex a Drag Is Measured Against
    // ------------------------------------------------------------
    // Dragging the start is anchored on the end and vice versa. This is what
    // makes an axis lock during a vertex drag mean the same thing it means
    // during placement.
    // ------------------------------------------------------------
    function Na__PlanDimVert__ReadAnchor(which) {
        return Na__PlanDimVert__ReadVertex(
            which === Na__PlanDimVert__START ? Na__PlanDimVert__END : Na__PlanDimVert__START
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Handle Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build One X Marker With a Generous Hit Target
    // ------------------------------------------------------------
    // The visible mark is two crossing strokes; the pointer target is a much
    // larger invisible circle, because an X drawn at handle size is far too
    // thin to grab reliably.
    // ------------------------------------------------------------
    function Na__PlanDimVert__BuildHandle(which) {
        const setup = Na__PlanDim__GetEditingSetup();
        const half  = setup.vertexSizePx / 2;

        const group = document.createElementNS(Na__PlanDimVert__SVG_NS, 'g');
        group.setAttribute('class', Na__PlanDimVert__HANDLE_CLASS);
        group.setAttribute('data-na-vertex', which);

        const hit = document.createElementNS(Na__PlanDimVert__SVG_NS, 'circle');
        hit.setAttribute('r', String(setup.vertexHitPx));
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('stroke', 'none');

        const armA = document.createElementNS(Na__PlanDimVert__SVG_NS, 'line');
        const armB = document.createElementNS(Na__PlanDimVert__SVG_NS, 'line');
        [armA, armB].forEach((arm) => {
            arm.setAttribute('stroke', setup.vertexColor);
            arm.setAttribute('stroke-width', String(setup.vertexStrokePx));
            arm.setAttribute('stroke-linecap', 'round');
            arm.setAttribute('pointer-events', 'none');
        });

        armA.setAttribute('x1', String(-half)); armA.setAttribute('y1', String(-half));
        armA.setAttribute('x2', String(half));  armA.setAttribute('y2', String(half));
        armB.setAttribute('x1', String(-half)); armB.setAttribute('y1', String(half));
        armB.setAttribute('x2', String(half));  armB.setAttribute('y2', String(-half));

        group.appendChild(hit);
        group.appendChild(armA);
        group.appendChild(armB);

        Na__PlanDimVert__AttachHandleEvents(group, which);
        return { group, armA, armB };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Ensure the Handle Group Exists in the Layer
    // ------------------------------------------------------------
    function Na__PlanDimVert__EnsureHandles() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return false;

        if (Na__PlanDimVert__Group && Na__PlanDimVert__Group.parentNode === root) return true;

        const group = document.createElementNS(Na__PlanDimVert__SVG_NS, 'g');
        group.setAttribute('id', Na__PlanDimVert__GROUP_ID);
        group.setAttribute('class', Na__PlanDimVert__GROUP_CLASS);

        const start = Na__PlanDimVert__BuildHandle(Na__PlanDimVert__START);
        const end   = Na__PlanDimVert__BuildHandle(Na__PlanDimVert__END);

        group.appendChild(start.group);
        group.appendChild(end.group);
        root.appendChild(group);

        Na__PlanDimVert__Group   = group;
        Na__PlanDimVert__Handles = { start, end };
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paint One Handle in Its Active or Idle Colour
    // ------------------------------------------------------------
    function Na__PlanDimVert__PaintHandle(which, active) {
        if (!Na__PlanDimVert__Handles) return;

        const setup  = Na__PlanDim__GetEditingSetup();
        const handle = Na__PlanDimVert__Handles[which];
        if (!handle) return;

        const colour = active ? setup.vertexActive : setup.vertexColor;
        handle.armA.setAttribute('stroke', colour);
        handle.armB.setAttribute('stroke', colour);
        handle.group.classList.toggle(Na__PlanDimVert__ACTIVE_CLASS, active === true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drag Handling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Wire Pointer Events onto One Handle
    // ------------------------------------------------------------
    function Na__PlanDimVert__AttachHandleEvents(handleGroup, which) {
        handleGroup.addEventListener('pointerdown', (event) => {
            if (!Na__PlanDimVert__Record) return;
            if (event.button !== 0) return;

            event.preventDefault();
            event.stopPropagation();                                             // <-- Never let this also pan the plan

            Na__PlanDimVert__DragWhich = which;
            Na__PlanDimVert__DragMoved = false;

            // The FIXED end becomes the guide origin, so a locked axis is drawn
            // through the point the drag is actually measured from.
            Na__PlanDimVert__AnchorGuideToOppositeVertex(which);
            Na__PlanDimHist__BeginPending();

            Na__PlanDimVert__PaintHandle(which, true);
            if (handleGroup.setPointerCapture) handleGroup.setPointerCapture(event.pointerId);
        });

        handleGroup.addEventListener('pointermove', (event) => {
            if (Na__PlanDimVert__DragWhich !== which) return;
            Na__PlanDimVert__UpdateDrag(event);
        });

        const finish = (event) => {
            if (Na__PlanDimVert__DragWhich !== which) return;

            if (handleGroup.releasePointerCapture) {
                try {
                    handleGroup.releasePointerCapture(event.pointerId);
                } catch (error) {
                    // Capture may already have been lost; nothing to release.
                }
            }
            Na__PlanDimVert__EndDrag();
        };
        handleGroup.addEventListener('pointerup', finish);
        handleGroup.addEventListener('pointercancel', finish);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Point the Axis Guide at the Fixed End
    // ------------------------------------------------------------
    function Na__PlanDimVert__AnchorGuideToOppositeVertex(which) {
        const anchor = Na__PlanDimVert__ReadAnchor(which);
        if (!anchor) return;

        const px = Na__PlanDimVert__ProjectMm(anchor.posXMm, anchor.posZMm);
        if (px) Na__PlanDimAxis__SetAnchorPx(px);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply One Pointer Move to the Dragged Vertex
    // ------------------------------------------------------------
    // The constraint is resolved against the FIXED end, then applied by
    // collapsing the off-axis component - the same collapse the grid performs
    // when a span is resolved during placement.
    // ------------------------------------------------------------
    function Na__PlanDimVert__UpdateDrag(event) {
        const which = Na__PlanDimVert__DragWhich;
        if (!which || !Na__PlanDimVert__Record) return;

        const raw = Na__PlanDimLayer__ScreenToWorldMm(event.clientX, event.clientY);
        if (!raw) return;

        let point = Na__PlanDimGrid__ClampToPlane(Na__PlanDimGrid__SnapPointMm(raw));
        if (!point) return;

        const anchor = Na__PlanDimVert__ReadAnchor(which);
        if (!anchor) return;

        // Screen travel is measured from the FIXED end, so Shift and ortho
        // resolve the same way they do from a placement's first click.
        const anchorPx = Na__PlanDimVert__ProjectMm(anchor.posXMm, anchor.posZMm);
        const rect     = Na__PlanDimLayer__GetHost()
            ? Na__PlanDimLayer__GetHost().getBoundingClientRect()
            : { left: 0, top: 0 };

        const axis = Na__PlanDimAxis__Resolve({
            deltaXPx : anchorPx ? (event.clientX - rect.left) - anchorPx.x : 0,
            deltaYPx : anchorPx ? (event.clientY - rect.top)  - anchorPx.y : 0,
            shiftKey : event.shiftKey === true,
            altKey   : event.altKey === true,
            ctrlKey  : event.ctrlKey === true
        });

        if (axis === Na__PlanDimGrid__AXIS_X) {
            point = { posXMm : point.posXMm, posZMm : anchor.posZMm };            // <-- Pure horizontal run
        } else if (axis === Na__PlanDimGrid__AXIS_Z) {
            point = { posXMm : anchor.posXMm, posZMm : point.posZMm };            // <-- Pure vertical run
        }

        Na__PlanDimVert__DragMoved = true;
        Na__PlanDim__SetEndpoint(Na__PlanDimVert__Record, which, point);          // <-- Snaps onto the grid on the way in

        Na__PlanDimLayer__Sync();
        Na__PlanDimVert__Sync();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close Off a Vertex Drag
    // ------------------------------------------------------------
    function Na__PlanDimVert__EndDrag() {
        const which = Na__PlanDimVert__DragWhich;
        const moved = Na__PlanDimVert__DragMoved;

        Na__PlanDimVert__DragWhich = null;
        Na__PlanDimVert__DragMoved = false;

        if (which) Na__PlanDimVert__PaintHandle(which, false);

        if (moved) {
            Na__PlanDimHist__CommitPending();                                    // <-- One drag is one undo step
            if (typeof Na__PlanDimVert__OnChanged === 'function') Na__PlanDimVert__OnChanged();
        } else {
            Na__PlanDimHist__DiscardPending();                                   // <-- A click on a handle changed nothing
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Open One Dimension for Vertex Editing
    // ------------------------------------------------------------
    // context: { onChanged, cutHeightMm }
    // ------------------------------------------------------------
    function Na__PlanDimVert__Enter(record, context) {
        if (!record) return false;
        if (!Na__PlanDim__GetEditingSetup().dblClickVerts) return false;

        Na__PlanDimVert__Record    = record;
        Na__PlanDimVert__OnChanged = (context && typeof context.onChanged === 'function')
            ? context.onChanged
            : Na__PlanDimVert__OnChanged;

        if (context && Number.isFinite(context.cutHeightMm)) {
            // Handles sit on the dimension plane, a touch below the cut, so
            // they land exactly on the line rather than in front of it.
            Na__PlanDimVert__PlaneHeightMm = context.cutHeightMm - Na__PlanDim__GetLayerSetup().planeOffsetMm;
        }

        if (!Na__PlanDimVert__EnsureHandles()) return false;

        Na__PlanDimVert__Group.style.display = '';
        Na__PlanDimVert__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close Vertex Editing
    // ------------------------------------------------------------
    function Na__PlanDimVert__Exit() {
        if (Na__PlanDimVert__DragWhich) Na__PlanDimVert__EndDrag();

        Na__PlanDimVert__Record = null;
        if (Na__PlanDimVert__Group) Na__PlanDimVert__Group.style.display = 'none';

        Na__PlanDimAxis__Reset();                                                // <-- The guide belonged to this edit
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Dimension Open for Vertex Editing?
    // ------------------------------------------------------------
    function Na__PlanDimVert__IsActive() {
        return Na__PlanDimVert__Record !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Record Currently Open (or Null)
    // ------------------------------------------------------------
    function Na__PlanDimVert__GetRecord() {
        return Na__PlanDimVert__Record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Vertex Being Dragged Right Now?
    // ------------------------------------------------------------
    function Na__PlanDimVert__IsDragging() {
        return Na__PlanDimVert__DragWhich !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reproject Both Handles onto the Current View
    // ------------------------------------------------------------
    // Called every frame alongside the dimension layer, so the handles stay
    // planted on their world points while the plan pans beneath them.
    // ------------------------------------------------------------
    function Na__PlanDimVert__Sync() {
        if (!Na__PlanDimVert__Record || !Na__PlanDimVert__Handles) return;

        const layer = Na__PlanDim__GetLayerSetup();

        [Na__PlanDimVert__START, Na__PlanDimVert__END].forEach((which) => {
            const vertex = Na__PlanDimVert__ReadVertex(which);
            const handle = Na__PlanDimVert__Handles[which];
            if (!vertex || !handle) return;

            const px = Na__PlanDimVert__ProjectMm(vertex.posXMm, vertex.posZMm);
            if (!px) {
                handle.group.style.display = 'none';
                return;
            }

            // Off-sheet handles are hidden rather than clamped to the edge,
            // where they would invite a drag that jumps the vertex.
            const size = Na__PlanDimVert__GetSize();
            const out  = px.x < -layer.minRenderedPx || px.y < -layer.minRenderedPx
                      || px.x > size.width + layer.minRenderedPx
                      || px.y > size.height + layer.minRenderedPx;

            handle.group.style.display = out ? 'none' : '';
            handle.group.setAttribute('transform', 'translate(' + px.x + ',' + px.y + ')');
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear Down Entirely (plan unmounted)
    // ------------------------------------------------------------
    function Na__PlanDimVert__Dispose() {
        Na__PlanDimVert__Exit();

        if (Na__PlanDimVert__Group && Na__PlanDimVert__Group.parentNode) {
            Na__PlanDimVert__Group.parentNode.removeChild(Na__PlanDimVert__Group);
        }
        Na__PlanDimVert__Group     = null;
        Na__PlanDimVert__Handles   = null;
        Na__PlanDimVert__OnChanged = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Dimension Vertex Editor API
    // ------------------------------------------------------------
    export {
        Na__PlanDimVert__Enter,
        Na__PlanDimVert__Exit,
        Na__PlanDimVert__IsActive,
        Na__PlanDimVert__IsDragging,
        Na__PlanDimVert__GetRecord,
        Na__PlanDimVert__Sync,
        Na__PlanDimVert__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
