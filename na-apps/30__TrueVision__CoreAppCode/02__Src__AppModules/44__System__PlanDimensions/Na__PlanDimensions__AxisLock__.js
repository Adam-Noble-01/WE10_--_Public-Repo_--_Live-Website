// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - AXIS CONSTRAINT SYSTEM
// =============================================================================
//
// FILE       : Na__PlanDimensions__AxisLock__.js
// NAMESPACE  : Na__PlanDimAxis
// MODULE     : Plan Dimensions - Axis Constraint System
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : SketchUp Layout style direction locking, with a visible guide
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - The dimension tool without this is accurate but wild: every pick is free to
//   wander a few degrees off square. This module is the taming. It answers one
//   question - given where the pointer is and what the author is holding, which
//   axis is this dimension on - and it answers it the way SketchUp does.
//
// - THE PRIORITY ORDER IS THE WHOLE DESIGN. From strongest to weakest:
//     1. An ARROW KEY lock. Explicit and deliberate, so it outranks everything.
//     2. SHIFT held, which constrains to whichever direction the drag is
//        currently dominated by. Transient, and released the moment Shift is.
//     3. ORTHO MODE, the persistent toggle. Never yields a diagonal at all.
//     4. The ALT override, which forces a true aligned (diagonal) dimension.
//     5. The automatic near-square tolerance the tool already had.
//   A weaker rule can never overturn a stronger one, which is what stops the
//   constraints fighting each other when two are active at once.
//
// - SHIFT NOW CONSTRAINS RATHER THAN RELEASES. It previously overrode the
//   automatic lock to allow a diagonal; that override moved to Alt. This is a
//   deliberate behaviour change, made because Shift-to-constrain is what every
//   SketchUp user's hands already expect.
//
// - The guide is not decoration. A constraint the author cannot see is a
//   constraint they will fight, so whichever axis is locked gets a faint dotted
//   line drawn through the anchor point across the whole sheet - red for X,
//   green for the sheet Y, matching SketchUp's axis colours.
//
// - Sheet Y is world Z. On a plan the camera looks down the world Y axis, so
//   "up the sheet" is world -Z. The naming follows the drawing, not the scene.
//
// INTEGRATION:
// - Na__PlanDimensions__Editor__ resolves every pick through Resolve().
// - Na__PlanDimensions__VertexEditor__ uses the same call for vertex drags, so
//   a vertex is constrained exactly like a first placement.
// - Na__PlanDimensions__Hotkeys__ feeds it arrow keys and the ortho toggle.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation. Ortho mode, Shift constrain, arrow key locks and
//   the dotted axis guide.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Grid Axis Constants and Dimension Config
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Grid__.js
    // @delegate: ./Na__PlanDimensions__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimGrid__AXIS_X,
        Na__PlanDimGrid__AXIS_Z,
        Na__PlanDimGrid__AXIS_FREE,
        Na__PlanDimGrid__ChooseAxis
    } from './Na__PlanDimensions__Grid__.js';
    import {
        Na__PlanDim__GetAxisLockSetup,
        Na__PlanDim__GetInteractionSetup
    } from './Na__PlanDimensions__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Dimension Overlay (guide is drawn into its SVG root)
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Overlay__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__GetHost
    } from './Na__PlanDimensions__Overlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | SVG and Guide Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimAxis__SVG_NS     = 'http://www.w3.org/2000/svg';
    const Na__PlanDimAxis__GUIDE_ID   = 'naPlanDimAxisGuide';
    const Na__PlanDimAxis__GUIDE_CLASS = 'na-plan-dim__axis-guide';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Arrow Key Names
    // ------------------------------------------------------------
    // Left and Right run across the sheet (world X). Up and Down run up it,
    // which on a plan is world Z.
    // ------------------------------------------------------------
    const Na__PlanDimAxis__KEYS_X = ['arrowleft', 'arrowright'];
    const Na__PlanDimAxis__KEYS_Z = ['arrowup', 'arrowdown'];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Constraint State
    // ------------------------------------------------------------
    let Na__PlanDimAxis__OrthoMode  = false;   // <-- Persistent toggle
    let Na__PlanDimAxis__LockedAxis = null;    // <-- Arrow key lock: null, AXIS_X or AXIS_Z
    let Na__PlanDimAxis__Configured = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Guide Element and Its Anchor
    // ------------------------------------------------------------
    let Na__PlanDimAxis__GuideEl   = null;   // <-- One SVG line, re-pointed as the axis changes
    let Na__PlanDimAxis__AnchorPx  = null;   // <-- Canvas-local point the guide passes through
    // ------------------------------------------------------------

    // MODULE VARIABLES | Change Notification
    // ------------------------------------------------------------
    let Na__PlanDimAxis__OnChanged = null;   // <-- Host callback so a toolbar can reflect the state
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // FUNCTION | Apply the Config Defaults Once
    // ------------------------------------------------------------
    // Called after the dimension AppConfig has loaded. Ortho mode picks up its
    // configured default only the first time, so re-entering a plan does not
    // silently undo a toggle the author made.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__Configure(onChanged) {
        Na__PlanDimAxis__OnChanged = (typeof onChanged === 'function') ? onChanged : null;

        if (!Na__PlanDimAxis__Configured) {
            Na__PlanDimAxis__OrthoMode  = Na__PlanDim__GetAxisLockSetup().orthoDefault === true;
            Na__PlanDimAxis__Configured = true;
        }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Report a State Change to the Host
    // ------------------------------------------------------------
    function Na__PlanDimAxis__Notify() {
        if (typeof Na__PlanDimAxis__OnChanged === 'function') Na__PlanDimAxis__OnChanged();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Ortho Mode
// -----------------------------------------------------------------------------

    // FUNCTION | Is Ortho Mode On?
    // ------------------------------------------------------------
    function Na__PlanDimAxis__IsOrthoMode() {
        return Na__PlanDimAxis__OrthoMode === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set Ortho Mode Explicitly
    // ------------------------------------------------------------
    function Na__PlanDimAxis__SetOrthoMode(enabled) {
        const next = (enabled === true);
        if (next === Na__PlanDimAxis__OrthoMode) return false;

        Na__PlanDimAxis__OrthoMode = next;
        Na__PlanDimAxis__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Flip Ortho Mode
    // ------------------------------------------------------------
    function Na__PlanDimAxis__ToggleOrthoMode() {
        Na__PlanDimAxis__SetOrthoMode(!Na__PlanDimAxis__OrthoMode);
        return Na__PlanDimAxis__OrthoMode;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Arrow Key Locking
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Explicit Arrow Key Lock (null When None)
    // ------------------------------------------------------------
    function Na__PlanDimAxis__GetLockedAxis() {
        return Na__PlanDimAxis__LockedAxis;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Explicit Lock
    // ------------------------------------------------------------
    function Na__PlanDimAxis__SetLockedAxis(axis) {
        const next = (axis === Na__PlanDimGrid__AXIS_X || axis === Na__PlanDimGrid__AXIS_Z)
            ? axis
            : null;

        if (next === Na__PlanDimAxis__LockedAxis) return false;
        Na__PlanDimAxis__LockedAxis = next;

        if (next === null) {
            Na__PlanDimAxis__HideGuide();
        } else {
            Na__PlanDimAxis__RefreshGuide();
        }
        Na__PlanDimAxis__Notify();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release Any Explicit Lock
    // ------------------------------------------------------------
    function Na__PlanDimAxis__ClearLock() {
        return Na__PlanDimAxis__SetLockedAxis(null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Handle One Arrow Key Press
    // ------------------------------------------------------------
    // Pressing the direction already locked releases it, which is how SketchUp
    // behaves and means the same key both applies and cancels the constraint.
    // Returns true when the key was consumed.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__HandleArrowKey(keyName) {
        if (!Na__PlanDim__GetAxisLockSetup().arrowLock) return false;

        const key = String(keyName || '').toLowerCase();
        let   axis = null;

        if (Na__PlanDimAxis__KEYS_X.indexOf(key) !== -1)      axis = Na__PlanDimGrid__AXIS_X;
        else if (Na__PlanDimAxis__KEYS_Z.indexOf(key) !== -1) axis = Na__PlanDimGrid__AXIS_Z;
        else return false;

        Na__PlanDimAxis__SetLockedAxis(Na__PlanDimAxis__LockedAxis === axis ? null : axis);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Axis Resolution
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Which Axis Does This Drag Mostly Run Along?
    // ------------------------------------------------------------
    function Na__PlanDimAxis__DominantAxis(deltaXPx, deltaYPx) {
        return (Math.abs(deltaXPx) >= Math.abs(deltaYPx))
            ? Na__PlanDimGrid__AXIS_X
            : Na__PlanDimGrid__AXIS_Z;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Axis for the Current Pick
    // ------------------------------------------------------------
    // context: { deltaXPx, deltaYPx, shiftKey, altKey }
    // The deltas are screen-space travel from the anchor point. See the header
    // for why the order of these tests is the whole design.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__Resolve(context) {
        const ctx   = context || {};
        const setup = Na__PlanDim__GetAxisLockSetup();
        const inter = Na__PlanDim__GetInteractionSetup();

        // 1 | EXPLICIT ARROW KEY LOCK - deliberate, so nothing overrules it
        if (Na__PlanDimAxis__LockedAxis) return Na__PlanDimAxis__LockedAxis;

        // 2 | SHIFT - constrain to whichever way the drag currently runs
        if (setup.shiftConstrains && ctx.shiftKey === true) {
            return Na__PlanDimAxis__DominantAxis(ctx.deltaXPx || 0, ctx.deltaYPx || 0);
        }

        // 3 | ORTHO MODE - a diagonal is simply not on offer
        if (Na__PlanDimAxis__OrthoMode) {
            return Na__PlanDimAxis__DominantAxis(ctx.deltaXPx || 0, ctx.deltaYPx || 0);
        }

        // 4 | ALT OVERRIDE - force a true aligned dimension
        const overrideHeld = (inter.axisOverrideKey === 'Alt'     && ctx.altKey   === true)
                          || (inter.axisOverrideKey === 'Control' && ctx.ctrlKey  === true)
                          || (inter.axisOverrideKey === 'Shift'   && ctx.shiftKey === true);
        if (overrideHeld) return Na__PlanDimGrid__AXIS_FREE;

        // 5 | AUTOMATIC near-square tolerance, as the tool always behaved
        return Na__PlanDimGrid__ChooseAxis(
            ctx.deltaXPx || 0,
            ctx.deltaYPx || 0,
            inter.axisLockTolPx,
            inter.axisLockEnabled
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Any Constraint Currently Active?
    // ------------------------------------------------------------
    // Used by the toolbar hint and by the guide, which should only appear when
    // something is actually holding the pick.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__IsConstrained() {
        return Na__PlanDimAxis__LockedAxis !== null || Na__PlanDimAxis__OrthoMode;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Guide Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Guide Line Element Exists
    // ------------------------------------------------------------
    // Lives inside the dimension SVG layer, so it shares that layer's canvas
    // box and needs no positioning logic of its own.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__EnsureGuide() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return null;

        if (Na__PlanDimAxis__GuideEl && Na__PlanDimAxis__GuideEl.parentNode === root) {
            return Na__PlanDimAxis__GuideEl;
        }

        const line = document.createElementNS(Na__PlanDimAxis__SVG_NS, 'line');
        line.setAttribute('id', Na__PlanDimAxis__GUIDE_ID);
        line.setAttribute('class', Na__PlanDimAxis__GUIDE_CLASS);
        line.setAttribute('pointer-events', 'none');                             // <-- Never intercept a pick
        line.style.display = 'none';

        root.appendChild(line);
        Na__PlanDimAxis__GuideEl = line;
        return line;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Point the Guide Passes Through
    // ------------------------------------------------------------
    // anchorPx is CANVAS-LOCAL, matching the SVG layer's own coordinate space.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__SetAnchorPx(anchorPx) {
        Na__PlanDimAxis__AnchorPx = (anchorPx && Number.isFinite(anchorPx.x) && Number.isFinite(anchorPx.y))
            ? { x: anchorPx.x, y: anchorPx.y }
            : null;
        Na__PlanDimAxis__RefreshGuide();
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw or Hide the Guide for the Current State
    // ------------------------------------------------------------
    // The guide only appears when an axis is genuinely held AND there is an
    // anchor to draw it through, so it never floats over an idle plan.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__RefreshGuide() {
        const setup = Na__PlanDim__GetAxisLockSetup();
        if (!setup.guideEnabled) return Na__PlanDimAxis__HideGuide();

        const axis = Na__PlanDimAxis__LockedAxis;
        if (!axis || !Na__PlanDimAxis__AnchorPx) return Na__PlanDimAxis__HideGuide();

        const line = Na__PlanDimAxis__EnsureGuide();
        const host = Na__PlanDimLayer__GetHost();
        if (!line || !host) return false;

        const width  = host.clientWidth  || 0;
        const height = host.clientHeight || 0;
        const anchor = Na__PlanDimAxis__AnchorPx;

        // Spans the full sheet through the anchor, so the constraint reads as
        // an axis rather than as a short tick near the cursor.
        if (axis === Na__PlanDimGrid__AXIS_X) {
            line.setAttribute('x1', '0');
            line.setAttribute('y1', String(anchor.y));
            line.setAttribute('x2', String(width));
            line.setAttribute('y2', String(anchor.y));
            line.setAttribute('stroke', setup.guideColorX);
        } else {
            line.setAttribute('x1', String(anchor.x));
            line.setAttribute('y1', '0');
            line.setAttribute('x2', String(anchor.x));
            line.setAttribute('y2', String(height));
            line.setAttribute('stroke', setup.guideColorZ);
        }

        line.setAttribute('stroke-width', String(setup.guideStrokePx));
        line.setAttribute('stroke-dasharray', setup.guideDash);
        line.setAttribute('opacity', String(setup.guideOpacity));
        line.style.display = '';
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Guide
    // ------------------------------------------------------------
    function Na__PlanDimAxis__HideGuide() {
        if (Na__PlanDimAxis__GuideEl) Na__PlanDimAxis__GuideEl.style.display = 'none';
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop the Guide and Every Transient Lock
    // ------------------------------------------------------------
    // Ortho mode deliberately SURVIVES: it is a mode the author chose, not a
    // per-pick constraint, so finishing one dimension does not silently switch
    // it off.
    // ------------------------------------------------------------
    function Na__PlanDimAxis__Reset() {
        Na__PlanDimAxis__LockedAxis = null;
        Na__PlanDimAxis__AnchorPx   = null;
        Na__PlanDimAxis__HideGuide();
        Na__PlanDimAxis__Notify();
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear Down Entirely (plan unmounted)
    // ------------------------------------------------------------
    function Na__PlanDimAxis__Dispose() {
        if (Na__PlanDimAxis__GuideEl && Na__PlanDimAxis__GuideEl.parentNode) {
            Na__PlanDimAxis__GuideEl.parentNode.removeChild(Na__PlanDimAxis__GuideEl);
        }
        Na__PlanDimAxis__GuideEl    = null;
        Na__PlanDimAxis__AnchorPx   = null;
        Na__PlanDimAxis__LockedAxis = null;
        Na__PlanDimAxis__OnChanged  = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Axis Constraint API
    // ------------------------------------------------------------
    export {
        Na__PlanDimAxis__Configure,
        Na__PlanDimAxis__IsOrthoMode,
        Na__PlanDimAxis__SetOrthoMode,
        Na__PlanDimAxis__ToggleOrthoMode,
        Na__PlanDimAxis__GetLockedAxis,
        Na__PlanDimAxis__SetLockedAxis,
        Na__PlanDimAxis__ClearLock,
        Na__PlanDimAxis__HandleArrowKey,
        Na__PlanDimAxis__Resolve,
        Na__PlanDimAxis__IsConstrained,
        Na__PlanDimAxis__SetAnchorPx,
        Na__PlanDimAxis__RefreshGuide,
        Na__PlanDimAxis__HideGuide,
        Na__PlanDimAxis__Reset,
        Na__PlanDimAxis__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
