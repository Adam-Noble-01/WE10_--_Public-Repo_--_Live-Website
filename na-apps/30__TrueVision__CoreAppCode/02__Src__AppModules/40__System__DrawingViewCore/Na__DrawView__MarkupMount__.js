// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - MARKUP MOUNT
// =============================================================================
//
// FILE       : Na__DrawView__MarkupMount__.js
// NAMESPACE  : Na__DrawMarkup
// MODULE     : Drawing View Core - Markup Mount
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Raise and lower the whole markup stack over any 2D drawing
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Eleven modules have to be switched on in the right order for a drawing to
//   be annotated and dimensioned, and switched off in the reverse order when
//   it closes. This is that sequence, written once, so a floor plan and an
//   elevation cannot drift apart in what they mount or - far worse - in what
//   they forget to unmount.
//
// - THE ORDER IS THE POINT, and it is not arbitrary:
//     the working plane is established BEFORE the dimension layer mounts, so
//     the first pick already has an extent to be clamped against;
//     the layers mount BEFORE their editors, because whether a node is
//     interactive is decided when the node is built;
//     undo histories bind AFTER the arrays they watch, so an undo stack can
//     never outlive the drawing it belongs to;
//     and unmount runs in the mirror order, listeners first.
//
// - ONE LIVE ARRAY, NEVER A COPY. The caller passes the annotation and
//   dimension arrays straight off its own record. The overlay, the undo stack
//   and the saved record then all hold one object rather than three, which is
//   the only reason an edit made on screen is the edit that gets saved.
//
// - THE CLIENT BRANCH IS THE SAME ENGINE, GATED. When markup is NOT being
//   authored and the project grants client measuring, the dimension editor is
//   still enabled - but bound to an ephemeral session array that no drawing
//   record points at, so a visitor's measurements are structurally unsaveable
//   rather than merely un-saved.
//
// - Only ONE drawing's markup can be up at a time: every module below is a
//   singleton bound to whatever mounted it last. The view broker enforces the
//   handover; this module simply assumes it has already happened.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ and Na__Elevation__ModeController__ call
//   Mount on entering their drawing and Unmount on leaving or switching.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Extracted from Na__FloorPlan__ModeController__ (31-Aug-2026) when the
//   elevation system needed the identical sequence. The behaviour is that
//   controller's, unchanged; what is new is that the drawing supplies its own
//   arrays, plane height and extent rather than the mount reaching into a
//   floor plan record for them.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Annotation Layer, Editor, Toolbar, History and Hotkeys
    // ------------------------------------------------------------
    // @delegate: ../43__System__PlanAnnotations/
    // ------------------------------------------------------------
    import {
        Na__PlanAnnoLayer__Mount,
        Na__PlanAnnoLayer__Unmount,
        Na__PlanAnnoLayer__Sync,
        Na__PlanAnnoLayer__SyncLayerBox
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Overlay__.js';
    import {
        Na__PlanAnnoEdit__Enable,
        Na__PlanAnnoEdit__Disable,
        Na__PlanAnnoEdit__AttachNode
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Editor__.js';
    import {
        Na__PlanAnnoBar__Mount,
        Na__PlanAnnoBar__Unmount,
        Na__PlanAnnoBar__Refresh
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Toolbar__.js';
    import {
        Na__PlanAnnoHist__Begin,
        Na__PlanAnnoHist__End
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__History__.js';
    import {
        Na__PlanAnnoKeys__Attach,
        Na__PlanAnnoKeys__Detach
    } from '../43__System__PlanAnnotations/Na__PlanAnnotations__Hotkeys__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Layer, Editor, Grid, History, Locks and Client Mode
    // ------------------------------------------------------------
    // @delegate: ../44__System__PlanDimensions/
    // ------------------------------------------------------------
    import {
        Na__PlanDim__GetLayerSetup,
        Na__PlanDim__GetSessionDimensions,
        Na__PlanDim__SetAuthoringMode,
        Na__PlanDim__AUTHOR_DEV
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimLayer__Mount,
        Na__PlanDimLayer__Unmount,
        Na__PlanDimLayer__Sync,
        Na__PlanDimLayer__SyncLayerBox
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Overlay__.js';
    import {
        Na__PlanDimEdit__Enable,
        Na__PlanDimEdit__Disable,
        Na__PlanDimEdit__AttachNode
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Editor__.js';
    import {
        Na__PlanDimGrid__EstablishPlane,
        Na__PlanDimGrid__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Grid__.js';
    import {
        Na__PlanDimHist__Begin,
        Na__PlanDimHist__End
    } from '../44__System__PlanDimensions/Na__PlanDimensions__History__.js';
    import {
        Na__PlanDimKeys__Attach,
        Na__PlanDimKeys__Detach
    } from '../44__System__PlanDimensions/Na__PlanDimensions__Hotkeys__.js';
    import {
        Na__PlanDimAxis__Configure,
        Na__PlanDimAxis__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__AxisLock__.js';
    import {
        Na__PlanDimVert__Sync,
        Na__PlanDimVert__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__VertexEditor__.js';
    import {
        Na__PlanDimClient__SetAllowed,
        Na__PlanDimClient__IsAllowed,
        Na__PlanDimClient__Mount,
        Na__PlanDimClient__Refresh,
        Na__PlanDimClient__Unmount,
        Na__PlanDimClient__Dispose
    } from '../44__System__PlanDimensions/Na__PlanDimensions__ClientMode__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Whether Anything Is Currently Mounted
    // ------------------------------------------------------------
    // Unmount is called defensively from several places, so it has to be idem-
    // potent rather than assuming a matching Mount happened.
    // ------------------------------------------------------------
    let Na__DrawMarkup__Mounted = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Mount Paths
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Mount the Client Measuring Branch
    // ------------------------------------------------------------
    // Not authoring, but the project grants measuring. The editor is bound to
    // the SESSION array - the one no drawing record points at - and placement
    // is gated behind the disclaimer the client mode module registers.
    // ------------------------------------------------------------
    function Na__DrawMarkup__MountClientBranch(context) {
        Na__PlanDimClient__Mount({
            hostElement : context.canvas.parentElement || document.body,
            onChanged   : () => Na__PlanDimLayer__Sync()
        });

        const sessionList = Na__PlanDim__GetSessionDimensions();

        // The bar reads its labels from the tool state, so every change has to
        // reach it - otherwise Measure stays stuck on Cancel once a dimension
        // completes.
        const refreshClient = () => {
            Na__PlanDimLayer__Sync();
            Na__PlanDimClient__Refresh();
        };

        Na__PlanDimEdit__Enable({
            canvas     : context.canvas,
            dimensions : sessionList,
            onChanged  : refreshClient
        });
        Na__PlanDimHist__Begin(sessionList);
        Na__PlanDimAxis__Configure(null);
        Na__PlanDimKeys__Attach({ onAction: refreshClient });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mount the Developer Authoring Branch
    // ------------------------------------------------------------
    // Dimension undo is its own stack, bound to the same live array the layer
    // and the drawing record share. Separate from the annotation stack so one
    // Ctrl+Z never steps both.
    // ------------------------------------------------------------
    function Na__DrawMarkup__MountAuthoringBranch(context, annotations, dimensions) {
        const notify = () => {
            Na__PlanAnnoBar__Refresh();
            if (typeof context.onChanged === 'function') context.onChanged();
        };

        Na__PlanDimEdit__Enable({
            canvas     : context.canvas,
            dimensions : dimensions,
            onChanged  : notify
        });
        Na__PlanDimHist__Begin(dimensions);
        Na__PlanDimAxis__Configure(Na__PlanAnnoBar__Refresh);
        Na__PlanDimKeys__Attach({ onAction: notify });

        // Undo history is per drawing. Binding here also clears it, because
        // one drawing's undo stack has no meaning over another's markup.
        Na__PlanAnnoHist__Begin(annotations);

        Na__PlanAnnoEdit__Enable({
            canvas    : context.canvas,
            onChanged : notify
        });
        Na__PlanAnnoBar__Mount({
            hostElement : context.canvas.parentElement || document.body,
            onDone      : (typeof context.onAnnotateDone === 'function') ? context.onAnnotateDone : () => {}
        });
        Na__PlanAnnoKeys__Attach({ onAction: notify });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Raise the Markup Stack Over the Drawing on Screen
    // ------------------------------------------------------------
    // context: {
    //   canvas          - the render canvas the layers track
    //   modelRoot       - measured to size the dimension working plane
    //   annotations     - LIVE array off the drawing record
    //   dimensions      - LIVE array off the drawing record
    //   editMode        - true while the developer is authoring
    //   clientAllowed   - the per-project client measuring grant
    //   planeHeightMm   - reference height for the dimension working plane
    //   planeExtentMm   - optional extent in the DRAWING's axes; supplied by
    //                     an elevation, where the model footprint would be the
    //                     wrong shape entirely
    //   onChanged       - called after any markup mutation
    //   onAnnotateDone  - the annotation toolbar's Done button
    // }
    // ------------------------------------------------------------
    function Na__DrawMarkup__Mount(context) {
        if (!context || !context.canvas) return false;

        Na__DrawMarkup__Unmount();                                               // <-- Never stack two drawings' markup

        const annotations = Array.isArray(context.annotations) ? context.annotations : [];
        const dimensions  = Array.isArray(context.dimensions)  ? context.dimensions  : [];
        const layerCfg    = Na__PlanDim__GetLayerSetup();

        // Read the per-project grant before anything mounts, so the branch
        // below knows whether client measuring exists at all.
        Na__PlanDimClient__SetAllowed(context.clientAllowed === true);

        Na__PlanAnnoLayer__Mount({
            hostElement   : context.canvas,
            annotations   : annotations,
            onNodeCreated : context.editMode ? Na__PlanAnnoEdit__AttachNode : null
        });

        // The working plane is established from the model BEFORE the dimension
        // layer mounts, so the first pick already has an extent to be clamped
        // against. It sits fractionally in front of the annotation text so a
        // label placed over a dimension line stays readable.
        Na__PlanDimGrid__EstablishPlane(
            context.modelRoot || null,
            (Number.isFinite(context.planeHeightMm) ? context.planeHeightMm : 0) - layerCfg.planeOffsetMm,
            context.planeExtentMm || null
        );

        // The client branch needs interaction wired too - onto their OWN
        // records only, which the editor decides per record rather than here.
        const clientMayMeasure = Na__PlanDimClient__IsAllowed();

        Na__PlanDimLayer__Mount({
            hostElement       : context.canvas,
            dimensions        : dimensions,
            sessionDimensions : Na__PlanDim__GetSessionDimensions(),
            onNodeCreated     : (context.editMode || clientMayMeasure)
                ? Na__PlanDimEdit__AttachNode
                : null
        });

        Na__DrawMarkup__Mounted = true;

        if (!context.editMode) {
            if (clientMayMeasure) Na__DrawMarkup__MountClientBranch(context);
            Na__PlanAnnoLayer__Sync();
            return true;
        }

        Na__DrawMarkup__MountAuthoringBranch(context, annotations, dimensions);
        Na__PlanAnnoLayer__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Whole Markup Stack Down
    // ------------------------------------------------------------
    // The mirror of Mount, listeners first: a shortcut or a pointer handler
    // that outlives the drawing it edits would write into an array nothing is
    // showing any more.
    // ------------------------------------------------------------
    function Na__DrawMarkup__Unmount() {
        Na__PlanDimClient__Unmount();                                            // <-- Session measurements are discarded here
        Na__PlanDim__SetAuthoringMode(Na__PlanDim__AUTHOR_DEV);

        Na__PlanAnnoKeys__Detach();                                              // <-- Shortcuts must never outlive the drawing they edit
        Na__PlanAnnoHist__End();
        Na__PlanAnnoBar__Unmount();
        Na__PlanAnnoEdit__Disable();
        Na__PlanAnnoLayer__Unmount();

        Na__PlanDimKeys__Detach();                                               // <-- Same rule for the dimension listeners
        Na__PlanDimHist__End();
        Na__PlanDimVert__Dispose();
        Na__PlanDimAxis__Dispose();
        Na__PlanDimClient__Dispose();
        Na__PlanDimEdit__Disable();
        Na__PlanDimLayer__Unmount();
        Na__PlanDimGrid__Dispose();                                              // <-- Plane belonged to the drawing that is closing

        Na__DrawMarkup__Mounted = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Markup Stack Currently Up?
    // ------------------------------------------------------------
    function Na__DrawMarkup__IsMounted() {
        return Na__DrawMarkup__Mounted;
    }
    // ------------------------------------------------------------


    // FUNCTION | Reproject Every Piece of Markup Onto the Current View
    // ------------------------------------------------------------
    // Called once per rendered frame while a drawing is on screen. This is
    // what makes a label stay planted over the room it names, and a dimension
    // over the wall it measures, as the sheet is panned and zoomed.
    // ------------------------------------------------------------
    function Na__DrawMarkup__SyncFrame() {
        if (!Na__DrawMarkup__Mounted) return;
        Na__PlanAnnoLayer__Sync();
        Na__PlanDimLayer__Sync();                                                // <-- Dimensions reproject in the same pass
        Na__PlanDimVert__Sync();                                                 // <-- Vertex handles stay planted on their points
    }
    // ------------------------------------------------------------


    // FUNCTION | Re-Fit the Layer Boxes After a Viewport Resize
    // ------------------------------------------------------------
    // The layers are positioned from the canvas's own offset box rather than
    // stretched across its parent, so a resize has to move them explicitly
    // before anything is reprojected into them.
    // ------------------------------------------------------------
    function Na__DrawMarkup__SyncLayerBox() {
        if (!Na__DrawMarkup__Mounted) return;
        Na__PlanAnnoLayer__SyncLayerBox();
        Na__PlanDimLayer__SyncLayerBox();
        Na__DrawMarkup__SyncFrame();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Markup Mount API
    // ------------------------------------------------------------
    export {
        Na__DrawMarkup__Mount,
        Na__DrawMarkup__Unmount,
        Na__DrawMarkup__IsMounted,
        Na__DrawMarkup__SyncFrame,
        Na__DrawMarkup__SyncLayerBox
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
