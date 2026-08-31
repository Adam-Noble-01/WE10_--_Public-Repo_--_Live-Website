// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - PLACEMENT AND EDITING
// =============================================================================
//
// FILE       : Na__PlanDimensions__Editor__.js
// NAMESPACE  : Na__PlanDimEdit
// MODULE     : Plan Dimensions - Placement and Editing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Two-click dimension placement, selection and offset dragging
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Placement is two clicks on the plan: the first sets the start, the second
//   the end. Both are snapped onto the grid the moment they are taken, so what
//   is previewed is exactly what gets stored - there is no separate "tidy up
//   on commit" pass that could move a dimension after the author accepted it.
//
// - Between the two clicks a live preview follows the pointer showing the span
//   that would be created, already snapped and already axis-locked. Reading
//   the figure before committing is the whole point: an author sizing a room
//   opening watches the number, not the cursor.
//
// - Axis lock is decided in SCREEN space, not world space. A pick within the
//   configured pixel tolerance of horizontal or vertical is straightened onto
//   that axis, because a plan dimension a few pixels off square is virtually
//   always meant to be square. Holding the override key places a true aligned
//   dimension instead.
//
// - Dragging a placed dimension moves its OFFSET only, never its endpoints.
//   The endpoints are the measurement and must not move by accident; the
//   offset is presentation, and wanting it further off the wall is the common
//   edit. Endpoint edits go through the data module explicitly.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ enables this alongside the overlay when a
//   plan is opened in edit mode, and disables it on leaving.
// - Na__PlanDimensions__Overlay__ calls AttachNode for every node it builds.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder dimensioning system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Snap Grid
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Grid__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimGrid__AXIS_FREE,
        Na__PlanDimGrid__SnapPointMm,
        Na__PlanDimGrid__ResolveSpan,
        Na__PlanDimGrid__ClampToPlane
    } from './Na__PlanDimensions__Grid__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Data
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDim__F_ID,
        Na__PlanDim__F_OFFSET,
        Na__PlanDim__F_START_X,
        Na__PlanDim__F_START_Z,
        Na__PlanDim__F_END_X,
        Na__PlanDim__F_END_Z,
        Na__PlanDim__Create,
        Na__PlanDim__Delete,
        Na__PlanDim__FindById,
        Na__PlanDim__SetOffsetMm,
        Na__PlanDim__MeasureLengthMm,
        Na__PlanDim__FormatLength,
        Na__PlanDim__GetInteractionSetup,
        Na__PlanDim__GetLineSetup
    } from './Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Overlay Layer
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Overlay__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimLayer__Rebuild,
        Na__PlanDimLayer__Sync,
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__ScreenToWorldMm,
        Na__PlanDimLayer__WorldToScreenMm,
        Na__PlanDimLayer__MmToPx
    } from './Na__PlanDimensions__Overlay__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Axis Constraints, Vertex Editing, History and Focus
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__AxisLock__.js
    // @delegate: ./Na__PlanDimensions__VertexEditor__.js
    // @delegate: ./Na__PlanDimensions__History__.js
    // @delegate: ../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimAxis__Resolve,
        Na__PlanDimAxis__SetAnchorPx,
        Na__PlanDimAxis__Reset
    } from './Na__PlanDimensions__AxisLock__.js';
    import {
        Na__PlanDimVert__Enter,
        Na__PlanDimVert__Exit,
        Na__PlanDimVert__IsActive,
        Na__PlanDimVert__GetRecord,
        Na__PlanDimVert__Sync
    } from './Na__PlanDimensions__VertexEditor__.js';
    import {
        Na__PlanDimHist__BeginPending,
        Na__PlanDimHist__CommitPending,
        Na__PlanDimHist__DiscardPending,
        Na__PlanDimHist__CaptureNow
    } from './Na__PlanDimensions__History__.js';
    import {
        Na__PlanDim__GetEditingSetup,
        Na__PlanDim__GetNewDefaults,
        Na__PlanDim__GetLayerSetup,
        Na__PlanDim__IsRecordEditable,
        Na__PlanDim__IsClientAuthoring
    } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimCross__MoveTo,
        Na__PlanDimCross__Hide,
        Na__PlanDimCross__ShowsBeforeFirstClick,
        Na__PlanDimCross__Dispose
    } from './Na__PlanDimensions__Crosshair__.js';
    import {
        Na__FpFocus__DIMENSIONS,
        Na__FpFocus__Claim,
        Na__FpFocus__Release
    } from '../42__System__FloorPlanViews/Na__FloorPlan__MarkupFocus__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Placement States
    // ------------------------------------------------------------
    const Na__PlanDimEdit__IDLE          = 'idle';           // <-- Not placing
    const Na__PlanDimEdit__AWAITING_START = 'awaiting-start'; // <-- Armed, waiting for the first click
    const Na__PlanDimEdit__AWAITING_END   = 'awaiting-end';   // <-- Start taken, rubber-banding
    // ------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identity
    // ------------------------------------------------------------
    const Na__PlanDimEdit__SVG_NS        = 'http://www.w3.org/2000/svg';
    const Na__PlanDimEdit__PLACING_CLASS = 'na-plan-dim--placing';   // <-- Crosshair cursor on the canvas
    const Na__PlanDimEdit__SELECTED_CLASS = 'is-selected';
    const Na__PlanDimEdit__DATA_ATTR     = 'data-na-dimension-id';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Session Bindings
    // ------------------------------------------------------------
    let Na__PlanDimEdit__Enabled    = false;
    let Na__PlanDimEdit__Canvas     = null;   // <-- Render canvas events are taken from
    let Na__PlanDimEdit__Dimensions = null;   // <-- LIVE array off the plan record
    let Na__PlanDimEdit__OnChanged  = null;   // <-- Host callback for unsaved-change tracking
    let Na__PlanDimEdit__CutHeightMm = 0;     // <-- Plan cut height, handed to the vertex editor
    let Na__PlanDimEdit__PlacementGate = null; // <-- Must pass before placement arms (client disclaimer)
    // ------------------------------------------------------------

    // MODULE VARIABLES | Placement and Selection State
    // ------------------------------------------------------------
    let Na__PlanDimEdit__State        = Na__PlanDimEdit__IDLE;
    let Na__PlanDimEdit__PendingStart = null;  // <-- Snapped world point of the first click
    let Na__PlanDimEdit__PendingStartPx = null; // <-- Screen point of the first click (axis lock reference)
    let Na__PlanDimEdit__SelectedId   = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Offset Drag State
    // ------------------------------------------------------------
    let Na__PlanDimEdit__DragRecord   = null;
    let Na__PlanDimEdit__DragStartPx  = null;
    let Na__PlanDimEdit__DragStartOffset = 0;
    let Na__PlanDimEdit__DragMoved    = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Preview Nodes
    // ------------------------------------------------------------
    let Na__PlanDimEdit__PreviewLine = null;
    let Na__PlanDimEdit__PreviewText = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Preview Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create the Rubber-Band Preview Nodes
    // ------------------------------------------------------------
    function Na__PlanDimEdit__EnsurePreview() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return false;

        if (!Na__PlanDimEdit__PreviewLine) {
            Na__PlanDimEdit__PreviewLine = document.createElementNS(Na__PlanDimEdit__SVG_NS, 'line');
            Na__PlanDimEdit__PreviewLine.setAttribute('class', 'na-plan-dim__preview-line');
        }
        if (!Na__PlanDimEdit__PreviewText) {
            Na__PlanDimEdit__PreviewText = document.createElementNS(Na__PlanDimEdit__SVG_NS, 'text');
            Na__PlanDimEdit__PreviewText.setAttribute('class', 'na-plan-dim__preview-text');
            Na__PlanDimEdit__PreviewText.setAttribute('text-anchor', 'middle');
        }

        if (Na__PlanDimEdit__PreviewLine.parentElement !== root) root.appendChild(Na__PlanDimEdit__PreviewLine);
        if (Na__PlanDimEdit__PreviewText.parentElement !== root) root.appendChild(Na__PlanDimEdit__PreviewText);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remove the Preview Nodes
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ClearPreview() {
        [Na__PlanDimEdit__PreviewLine, Na__PlanDimEdit__PreviewText].forEach((node) => {
            if (node && node.parentElement) node.parentElement.removeChild(node);
        });
        Na__PlanDimEdit__PreviewLine = null;
        Na__PlanDimEdit__PreviewText = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Preview for a Candidate Span
    // ------------------------------------------------------------
    // Shows the span exactly as it would be stored - snapped and axis-locked -
    // with its measured figure, so the author commits to a number they have
    // already read rather than to a cursor position.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__DrawPreview(startPx, endPx, lengthMm) {
        if (!Na__PlanDimEdit__EnsurePreview()) return;

        Na__PlanDimEdit__PreviewLine.setAttribute('x1', startPx.x);
        Na__PlanDimEdit__PreviewLine.setAttribute('y1', startPx.y);
        Na__PlanDimEdit__PreviewLine.setAttribute('x2', endPx.x);
        Na__PlanDimEdit__PreviewLine.setAttribute('y2', endPx.y);

        const midX = (startPx.x + endPx.x) / 2;
        const midY = (startPx.y + endPx.y) / 2;
        // PREVIEW AT THE SIZE IT WILL BE CREATED AT.
        // The text used to be a flat 12px while the committed dimension sized
        // itself in real millimetres, so the number leapt in size the instant
        // the second click landed. Both now run through the same mm-to-pixel
        // conversion and read from the same live defaults, so the preview is
        // an honest picture of the result.
        const defaults = Na__PlanDim__GetNewDefaults();
        const layer    = Na__PlanDim__GetLayerSetup();
        const fontPx   = Math.min(
            Math.max(Na__PlanDimLayer__MmToPx(defaults.sizeMm), 1),
            layer.maxRenderedPx
        );

        Na__PlanDimEdit__PreviewText.setAttribute('x', midX);
        Na__PlanDimEdit__PreviewText.setAttribute('y', midY - (fontPx * 0.4));
        Na__PlanDimEdit__PreviewText.setAttribute('font-size', fontPx);
        Na__PlanDimEdit__PreviewText.setAttribute('font-weight', String(defaults.fontWeight));
        Na__PlanDimEdit__PreviewText.setAttribute('fill', defaults.color);
        Na__PlanDimEdit__PreviewLine.setAttribute('stroke', defaults.color);
        Na__PlanDimEdit__PreviewText.textContent = Number.isFinite(lengthMm)
            ? Na__PlanDim__FormatLength(lengthMm, null)
            : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert Viewport Coordinates to Canvas-Local Ones
    // ------------------------------------------------------------
    // The canvas starts below the app header, so a pointer clientY is not its
    // position on the drawing. The axis guide is drawn in canvas space and
    // would sit at the wrong height without this.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ClientToLocal(clientX, clientY) {
        if (!Na__PlanDimEdit__Canvas) return { x: clientX, y: clientY };
        const rect = Na__PlanDimEdit__Canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Snap a Pointer Event to a World Grid Point
    // ------------------------------------------------------------
    function Na__PlanDimEdit__PickWorld(event) {
        const raw = Na__PlanDimLayer__ScreenToWorldMm(event.clientX, event.clientY);
        if (!raw) return null;
        return Na__PlanDimGrid__ClampToPlane(Na__PlanDimGrid__SnapPointMm(raw));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Axis Lock for the Current Pointer
    // ------------------------------------------------------------
    // Delegated wholesale to the axis constraint system, which owns the
    // priority order: an arrow key lock beats Shift, which beats ortho mode,
    // which beats the Alt override, which beats the automatic tolerance. The
    // vertex editor resolves through the same call, so a vertex drag is
    // constrained exactly like a first placement.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ResolveAxis(event) {
        if (!Na__PlanDimEdit__PendingStartPx) return Na__PlanDimGrid__AXIS_FREE;

        return Na__PlanDimAxis__Resolve({
            deltaXPx : event.clientX - Na__PlanDimEdit__PendingStartPx.x,
            deltaYPx : event.clientY - Na__PlanDimEdit__PendingStartPx.y,
            shiftKey : event.shiftKey === true,
            altKey   : event.altKey   === true,
            ctrlKey  : event.ctrlKey  === true
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm the Two-Click Placement, Honouring Any Gate
    // ------------------------------------------------------------
    // THE GATE IS WHY THIS IS SPLIT IN TWO. Client measuring must not begin
    // until the disclaimer has been accepted, and placement can be started
    // from the toolbar, the client bar or the D hotkey. Routing every one of
    // them through here - and letting the gate arm the tool itself once the
    // notice is agreed - means a new entry point cannot accidentally bypass
    // the notice, because arming is simply not reachable any other way.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__BeginPlacement() {
        if (!Na__PlanDimEdit__Enabled) return false;

        if (typeof Na__PlanDimEdit__PlacementGate === 'function') {
            return Na__PlanDimEdit__PlacementGate() === true;
        }
        return Na__PlanDimEdit__ArmPlacement();
    }
    // ------------------------------------------------------------


    // FUNCTION | Register a Gate That Must Pass Before Placement Arms
    // ------------------------------------------------------------
    // The gate is responsible for calling ArmPlacement once it is satisfied.
    // Passing null removes it, which is what the developer path does.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__SetPlacementGate(fn) {
        Na__PlanDimEdit__PlacementGate = (typeof fn === 'function') ? fn : null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm Placement Outright, Bypassing the Gate
    // ------------------------------------------------------------
    // Only the gate itself should call this.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ArmPlacement() {
        if (!Na__PlanDimEdit__Enabled) return false;

        Na__PlanDimEdit__State          = Na__PlanDimEdit__AWAITING_START;
        Na__PlanDimEdit__PendingStart   = null;
        Na__PlanDimEdit__PendingStartPx = null;

        if (Na__PlanDimEdit__Canvas) {
            Na__PlanDimEdit__Canvas.classList.add(Na__PlanDimEdit__PLACING_CLASS);
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Abandon an In-Progress Placement
    // ------------------------------------------------------------
    function Na__PlanDimEdit__CancelPlacement() {
        Na__PlanDimEdit__State          = Na__PlanDimEdit__IDLE;
        Na__PlanDimEdit__PendingStart   = null;
        Na__PlanDimEdit__PendingStartPx = null;
        Na__PlanDimEdit__ClearPreview();
        Na__PlanDimCross__Hide();                                            // <-- Crosshair belonged to this placement
        Na__PlanDimAxis__Reset();                                            // <-- Guide and arrow lock belonged to this pick

        if (Na__PlanDimEdit__Canvas) {
            Na__PlanDimEdit__Canvas.classList.remove(Na__PlanDimEdit__PLACING_CLASS);
        }

        // STANDING DOWN IS A STATE CHANGE, so it has to be announced. Without
        // this the toolbars kept showing Cancel and "click the start point"
        // after a dimension had already been completed - the second click
        // notified BEFORE this ran, so the only refresh they got still read
        // as mid-placement. Announcing here covers finishing a dimension,
        // Escape, and the Cancel button alike.
        Na__PlanDimEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Placement Currently in Progress?
    // ------------------------------------------------------------
    function Na__PlanDimEdit__IsPlacing() {
        return Na__PlanDimEdit__State !== Na__PlanDimEdit__IDLE;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Event Handlers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Notify the Host That Something Changed
    // ------------------------------------------------------------
    function Na__PlanDimEdit__NotifyChanged() {
        if (typeof Na__PlanDimEdit__OnChanged === 'function') Na__PlanDimEdit__OnChanged();
    }
    // ------------------------------------------------------------


    // HANDLER | Canvas Pointer Down - Takes Each Placement Click
    // ------------------------------------------------------------
    // Only consumes the event while a placement is armed, so panning and every
    // other canvas interaction is untouched the rest of the time.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__HandleCanvasPointerDown(event) {
        if (Na__PlanDimEdit__State === Na__PlanDimEdit__IDLE) return;
        if (event.button !== 0) return;

        const point = Na__PlanDimEdit__PickWorld(event);
        if (!point) return;

        event.preventDefault();
        event.stopPropagation();                                             // <-- Do not let this also start a pan

        if (Na__PlanDimEdit__State === Na__PlanDimEdit__AWAITING_START) {
            Na__PlanDimEdit__PendingStart   = point;
            Na__PlanDimEdit__PendingStartPx = { x: event.clientX, y: event.clientY };
            Na__PlanDimEdit__State          = Na__PlanDimEdit__AWAITING_END;

            // The first click is the origin every constraint measures from, so
            // it is also where the axis guide is drawn through.
            Na__PlanDimAxis__SetAnchorPx(
                Na__PlanDimEdit__ClientToLocal(event.clientX, event.clientY)
            );
            return;
        }

        // SECOND CLICK | Resolve, store, and stand down
        const axis = Na__PlanDimEdit__ResolveAxis(event);
        const span = Na__PlanDimGrid__ResolveSpan(Na__PlanDimEdit__PendingStart, point, axis);

        if (span) {
            Na__PlanDimHist__CaptureNow();                                   // <-- BEFORE the mutation
            const record = Na__PlanDim__Create(Na__PlanDimEdit__Dimensions, span, null);
            if (record) {
                Na__PlanDimEdit__SelectedId = record[Na__PlanDim__F_ID];
                Na__FpFocus__Claim(Na__FpFocus__DIMENSIONS);                 // <-- Shared keys now belong to this layer
                Na__PlanDimLayer__Rebuild();
                Na__PlanDimLayer__Sync();
                Na__PlanDimEdit__ApplySelectionClass();
                Na__PlanDimEdit__NotifyChanged();
            }
        }

        Na__PlanDimEdit__CancelPlacement();                                  // <-- Degenerate picks simply place nothing
    }
    // ------------------------------------------------------------


    // HANDLER | Canvas Pointer Move - Rubber-Band Preview and Offset Drag
    // ------------------------------------------------------------
    function Na__PlanDimEdit__HandleCanvasPointerMove(event) {
        // OFFSET DRAG | Takes priority over placement preview
        if (Na__PlanDimEdit__DragRecord) {
            Na__PlanDimEdit__UpdateOffsetDrag(event);
            return;
        }

        // CROSSHAIR | Tracks the cursor for the whole placement, including
        // before the first click, which is when lining up on a corner matters
        // most. Follows the raw pointer rather than the snapped point so it
        // stays smooth instead of stepping across grid boundaries.
        if (Na__PlanDimEdit__State !== Na__PlanDimEdit__IDLE) {
            const showNow = (Na__PlanDimEdit__State === Na__PlanDimEdit__AWAITING_END)
                         || Na__PlanDimCross__ShowsBeforeFirstClick();
            if (showNow) {
                Na__PlanDimCross__MoveTo(
                    Na__PlanDimEdit__ClientToLocal(event.clientX, event.clientY)
                );
            }
        }

        if (Na__PlanDimEdit__State !== Na__PlanDimEdit__AWAITING_END) return;
        if (!Na__PlanDimEdit__PendingStart) return;

        const setup = Na__PlanDim__GetInteractionSetup();
        if (!setup.showSnapPreview) return;

        const point = Na__PlanDimEdit__PickWorld(event);
        if (!point) return;

        const axis = Na__PlanDimEdit__ResolveAxis(event);
        const span = Na__PlanDimGrid__ResolveSpan(Na__PlanDimEdit__PendingStart, point, axis);
        if (!span) return;                                                   // <-- Still inside one grid cell

        // THE PREVIEW MUST FOLLOW THE CONSTRAINT, NOT THE CURSOR.
        // span.start and span.end are the RESOLVED world points - the axis
        // lock has already collapsed the off-axis component into them. Drawing
        // the rubber band from the raw pointer instead would let it wander off
        // the guide line while the dimension it is previewing snaps square,
        // which is the one thing a preview must never do.
        const startPx = Na__PlanDimLayer__WorldToScreenMm(span.start.posXMm, span.start.posZMm);
        const endPx   = Na__PlanDimLayer__WorldToScreenMm(span.end.posXMm,   span.end.posZMm);
        if (!startPx || !endPx) return;

        Na__PlanDimEdit__DrawPreview(startPx, endPx, span.lengthMm);
    }
    // ------------------------------------------------------------



// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Selection and Offset Dragging
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Reflect the Selected Id in the DOM
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ApplySelectionClass() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return;

        const groups = root.querySelectorAll('[' + Na__PlanDimEdit__DATA_ATTR + ']');
        groups.forEach((group) => {
            const id = Number(group.getAttribute(Na__PlanDimEdit__DATA_ATTR));
            group.classList.toggle(Na__PlanDimEdit__SELECTED_CLASS, id === Na__PlanDimEdit__SelectedId);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Wire Interaction onto One Dimension Node
    // ------------------------------------------------------------
    // Called by the overlay for every node it builds. Selection happens on
    // pointer down; a drag beyond the threshold turns into an offset change.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__AttachNode(groupElement, record) {
        if (!groupElement || !record) return;

        // ISSUED DIMENSIONS ARE READ-ONLY TO A CLIENT. Enforced once, here,
        // by simply not wiring any interaction onto the node - so there is no
        // handler that could later be reached by a path that forgot to check.
        // The node still renders; it just cannot be selected, dragged,
        // restyled or deleted from a browser.
        if (!Na__PlanDim__IsRecordEditable(record)) {
            groupElement.classList.add('is-readonly');
            groupElement.setAttribute('pointer-events', 'none');
            return;
        }

        groupElement.addEventListener('pointerdown', (event) => {
            if (!Na__PlanDimEdit__Enabled) return;
            if (Na__PlanDimEdit__IsPlacing()) return;                        // <-- Placement owns the pointer
            if (event.button !== 0) return;

            event.preventDefault();
            event.stopPropagation();

            Na__PlanDimEdit__SelectedId      = record[Na__PlanDim__F_ID];
            Na__PlanDimEdit__DragRecord      = record;
            Na__PlanDimEdit__DragStartPx     = { x: event.clientX, y: event.clientY };
            Na__PlanDimEdit__DragStartOffset = Number.isFinite(record[Na__PlanDim__F_OFFSET])
                ? record[Na__PlanDim__F_OFFSET]
                : Na__PlanDim__GetLineSetup().defaultOffsetMm;
            Na__PlanDimEdit__DragMoved       = false;

            Na__FpFocus__Claim(Na__FpFocus__DIMENSIONS);                     // <-- Shared keys now belong to this layer
            Na__PlanDimHist__BeginPending();                                 // <-- Baseline before the offset can move
            Na__PlanDimEdit__ApplySelectionClass();
        });

        // DOUBLE CLICK | Open the two end points for editing. This is the
        // difference between a dimension you must delete and redraw and one
        // you can simply correct.
        groupElement.addEventListener('dblclick', (event) => {
            if (!Na__PlanDimEdit__Enabled) return;
            if (!Na__PlanDim__GetEditingSetup().dblClickVerts) return;

            event.preventDefault();
            event.stopPropagation();

            // An offset drag was armed by the first click of this double
            // click; drop it so it cannot commit an accidental history step.
            Na__PlanDimEdit__DragRecord = null;
            Na__PlanDimHist__DiscardPending();

            Na__PlanDimEdit__SelectedId = record[Na__PlanDim__F_ID];
            Na__FpFocus__Claim(Na__FpFocus__DIMENSIONS);
            Na__PlanDimEdit__ApplySelectionClass();

            Na__PlanDimVert__Enter(record, {
                cutHeightMm : Na__PlanDimEdit__CutHeightMm,
                onChanged   : Na__PlanDimEdit__NotifyChanged
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Pointer Travel Into an Offset Change
    // ------------------------------------------------------------
    // The drag is projected onto the dimension's own perpendicular, so pushing
    // the pointer away from the wall increases the offset whatever direction
    // that wall happens to run in.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__UpdateOffsetDrag(event) {
        const record = Na__PlanDimEdit__DragRecord;
        if (!record || !Na__PlanDimEdit__DragStartPx) return;

        const setup    = Na__PlanDim__GetInteractionSetup();
        const travelPx = Math.abs(event.clientX - Na__PlanDimEdit__DragStartPx.x)
                       + Math.abs(event.clientY - Na__PlanDimEdit__DragStartPx.y);
        if (!Na__PlanDimEdit__DragMoved && travelPx < setup.dragThresholdPx) return;
        Na__PlanDimEdit__DragMoved = true;

        const startWorld = Na__PlanDimLayer__ScreenToWorldMm(
            Na__PlanDimEdit__DragStartPx.x, Na__PlanDimEdit__DragStartPx.y
        );
        const nowWorld = Na__PlanDimLayer__ScreenToWorldMm(event.clientX, event.clientY);
        if (!startWorld || !nowWorld) return;

        // PERPENDICULAR | Rebuilt from the record's own endpoints each move
        const dx  = record[Na__PlanDim__F_END_X] - record[Na__PlanDim__F_START_X];
        const dz  = record[Na__PlanDim__F_END_Z] - record[Na__PlanDim__F_START_Z];
        const len = Math.sqrt((dx * dx) + (dz * dz));
        if (len <= 0) return;

        const perpX = -dz / len;
        const perpZ =  dx / len;

        const movedX = nowWorld.posXMm - startWorld.posXMm;
        const movedZ = nowWorld.posZMm - startWorld.posZMm;
        const along  = (movedX * perpX) + (movedZ * perpZ);                  // <-- Project travel onto the perpendicular

        Na__PlanDim__SetOffsetMm(record, Na__PlanDimEdit__DragStartOffset + along);
        Na__PlanDimLayer__Sync();
    }
    // ------------------------------------------------------------


    // HANDLER | Pointer Up Ends an Offset Drag
    // ------------------------------------------------------------
    function Na__PlanDimEdit__HandlePointerUp() {
        if (!Na__PlanDimEdit__DragRecord) return;

        const moved = Na__PlanDimEdit__DragMoved;
        Na__PlanDimEdit__DragRecord  = null;
        Na__PlanDimEdit__DragStartPx = null;
        Na__PlanDimEdit__DragMoved   = false;

        if (moved) {
            Na__PlanDimHist__CommitPending();                                // <-- One drag is one undo step
            Na__PlanDimEdit__NotifyChanged();
        } else {
            Na__PlanDimHist__DiscardPending();                               // <-- A pure click selects but changes nothing
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Currently Selected Dimension Id (or Null)
    // ------------------------------------------------------------
    function Na__PlanDimEdit__GetSelectedId() {
        return Na__PlanDimEdit__SelectedId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Currently Selected Record (or Null)
    // ------------------------------------------------------------
    function Na__PlanDimEdit__GetSelectedRecord() {
        if (Na__PlanDimEdit__SelectedId === null) return null;
        return Na__PlanDim__FindById(Na__PlanDimEdit__Dimensions, Na__PlanDimEdit__SelectedId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Clear the Selection
    // ------------------------------------------------------------
    function Na__PlanDimEdit__ClearSelection() {
        if (Na__PlanDimVert__IsActive()) Na__PlanDimVert__Exit();
        Na__PlanDimEdit__SelectedId = null;
        Na__FpFocus__Release(Na__FpFocus__DIMENSIONS);
        Na__PlanDimEdit__ApplySelectionClass();
    }


    // FUNCTION | Rebuild and Revalidate After an Undo or Redo
    // ------------------------------------------------------------
    // The restored array may no longer contain the selected dimension, and a
    // dangling id would leave the toolbar acting on something that is gone.
    // ------------------------------------------------------------
    function Na__PlanDimEdit__RefreshAfterHistory() {
        if (Na__PlanDimVert__IsActive()) {
            const open = Na__PlanDimVert__GetRecord();
            if (!open || !Na__PlanDim__FindById(Na__PlanDimEdit__Dimensions, open[Na__PlanDim__F_ID])) {
                Na__PlanDimVert__Exit();                                     // <-- Its dimension was undone away
            }
        }

        if (Na__PlanDimEdit__SelectedId !== null
            && !Na__PlanDim__FindById(Na__PlanDimEdit__Dimensions, Na__PlanDimEdit__SelectedId)) {
            Na__PlanDimEdit__SelectedId = null;
        }

        Na__PlanDimLayer__Rebuild();
        Na__PlanDimLayer__Sync();
        Na__PlanDimVert__Sync();
        Na__PlanDimEdit__ApplySelectionClass();
        Na__PlanDimEdit__NotifyChanged();
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Selected Dimension
    // ------------------------------------------------------------
    function Na__PlanDimEdit__DeleteSelected() {
        if (Na__PlanDimEdit__SelectedId === null) return false;
        if (!Na__PlanDim__IsRecordEditable(Na__PlanDimEdit__GetSelectedRecord())) return false;

        // Deleting the dimension whose vertices are open would strand the
        // handles over nothing, so close that first.
        if (Na__PlanDimVert__IsActive()) Na__PlanDimVert__Exit();

        Na__PlanDimHist__CaptureNow();                                       // <-- BEFORE the mutation
        const removed = Na__PlanDim__Delete(Na__PlanDimEdit__Dimensions, Na__PlanDimEdit__SelectedId);
        if (!removed) {
            Na__PlanDimHist__DiscardPending();
            return false;
        }

        Na__PlanDimEdit__SelectedId = null;
        Na__FpFocus__Release(Na__FpFocus__DIMENSIONS);
        Na__PlanDimLayer__Rebuild();
        Na__PlanDimLayer__Sync();
        Na__PlanDimEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Nudge the Selected Dimension's Offset by One Step
    // ------------------------------------------------------------
    function Na__PlanDimEdit__NudgeSelectedOffset(direction) {
        const record = Na__PlanDimEdit__GetSelectedRecord();
        if (!record) return false;
        if (!Na__PlanDim__IsRecordEditable(record)) return false;

        const setup   = Na__PlanDim__GetLineSetup();
        const current = Number.isFinite(record[Na__PlanDim__F_OFFSET])
            ? record[Na__PlanDim__F_OFFSET]
            : setup.defaultOffsetMm;

        Na__PlanDim__SetOffsetMm(record, current + (setup.offsetStepMm * (direction >= 0 ? 1 : -1)));
        Na__PlanDimLayer__Sync();
        Na__PlanDimEdit__NotifyChanged();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Measured Length of the Selection, for a Toolbar Readout
    // ------------------------------------------------------------
    function Na__PlanDimEdit__GetSelectedLengthMm() {
        const record = Na__PlanDimEdit__GetSelectedRecord();
        return record ? Na__PlanDim__MeasureLengthMm(record) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Enable and Disable
// -----------------------------------------------------------------------------

    // FUNCTION | Enable Editing for the Open Plan
    // ------------------------------------------------------------
    function Na__PlanDimEdit__Enable(context) {
        if (!context || !context.canvas) return false;

        Na__PlanDimEdit__Disable();                                          // <-- Never stack two plans' listeners

        Na__PlanDimEdit__Enabled    = true;
        Na__PlanDimEdit__Canvas     = context.canvas;
        Na__PlanDimEdit__Dimensions = Array.isArray(context.dimensions) ? context.dimensions : [];
        Na__PlanDimEdit__OnChanged  = (typeof context.onChanged === 'function') ? context.onChanged : null;
        Na__PlanDimEdit__CutHeightMm = Number.isFinite(context.cutHeightMm) ? context.cutHeightMm : 0;

        // Capture phase on the canvas so a placement click is taken before the
        // pan controls see it; the handler stands down instantly when idle.
        Na__PlanDimEdit__Canvas.addEventListener('pointerdown', Na__PlanDimEdit__HandleCanvasPointerDown, true);
        window.addEventListener('pointermove', Na__PlanDimEdit__HandleCanvasPointerMove);
        window.addEventListener('pointerup',   Na__PlanDimEdit__HandlePointerUp);

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Disable Editing and Detach Every Listener
    // ------------------------------------------------------------
    function Na__PlanDimEdit__Disable() {
        if (Na__PlanDimEdit__Canvas) {
            Na__PlanDimEdit__Canvas.removeEventListener('pointerdown', Na__PlanDimEdit__HandleCanvasPointerDown, true);
            Na__PlanDimEdit__Canvas.classList.remove(Na__PlanDimEdit__PLACING_CLASS);
        }
        window.removeEventListener('pointermove', Na__PlanDimEdit__HandleCanvasPointerMove);
        window.removeEventListener('pointerup',   Na__PlanDimEdit__HandlePointerUp);

        Na__PlanDimEdit__ClearPreview();
        Na__PlanDimCross__Dispose();
        Na__PlanDimVert__Exit();                                             // <-- Handles must never outlive the plan
        Na__PlanDimAxis__Reset();

        Na__PlanDimEdit__Enabled       = false;
        Na__PlanDimEdit__PlacementGate = null;
        Na__PlanDimEdit__Canvas        = null;
        Na__PlanDimEdit__Dimensions   = null;
        Na__PlanDimEdit__OnChanged    = null;
        Na__PlanDimEdit__State        = Na__PlanDimEdit__IDLE;
        Na__PlanDimEdit__PendingStart = null;
        Na__PlanDimEdit__PendingStartPx = null;
        Na__PlanDimEdit__SelectedId   = null;
        Na__PlanDimEdit__DragRecord   = null;

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Editing Currently Enabled?
    // ------------------------------------------------------------
    function Na__PlanDimEdit__IsEnabled() {
        return Na__PlanDimEdit__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Client Doing the Authoring?
    // ------------------------------------------------------------
    function Na__PlanDimEdit__IsClientMode() {
        return Na__PlanDim__IsClientAuthoring();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimensions Editor API
    // ------------------------------------------------------------
    export {
        Na__PlanDimEdit__Enable,
        Na__PlanDimEdit__Disable,
        Na__PlanDimEdit__IsEnabled,
        Na__PlanDimEdit__IsClientMode,
        Na__PlanDimEdit__AttachNode,
        Na__PlanDimEdit__BeginPlacement,
        Na__PlanDimEdit__ArmPlacement,
        Na__PlanDimEdit__SetPlacementGate,
        Na__PlanDimEdit__CancelPlacement,
        Na__PlanDimEdit__IsPlacing,
        Na__PlanDimEdit__GetSelectedId,
        Na__PlanDimEdit__GetSelectedRecord,
        Na__PlanDimEdit__GetSelectedLengthMm,
        Na__PlanDimEdit__ClearSelection,
        Na__PlanDimEdit__DeleteSelected,
        Na__PlanDimEdit__RefreshAfterHistory,
        Na__PlanDimEdit__NudgeSelectedOffset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
