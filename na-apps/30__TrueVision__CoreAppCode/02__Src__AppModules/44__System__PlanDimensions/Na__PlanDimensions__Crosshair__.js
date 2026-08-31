// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - PLACEMENT CROSSHAIR
// =============================================================================
//
// FILE       : Na__PlanDimensions__Crosshair__.js
// NAMESPACE  : Na__PlanDimCross
// MODULE     : Plan Dimensions - Placement Crosshair
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Full-span dotted crosshair tracking the cursor during placement
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Two dotted lines - one full width, one full height - crossing at the
//   cursor while a dimension is being placed. They exist to make a corner easy
//   to hit: the eye lines the crosshair up against a wall face rather than
//   judging a bare cursor tip against the drawing.
//
// - DELIBERATELY FAINT. Thin, half opacity and neutral in colour, so it reads
//   as an aid rather than as linework. The axis lock guide is the stronger,
//   coloured line and must stay the thing that draws the eye; a crosshair
//   competing with it would make the constraint harder to see, not easier.
//
// - Drawn at the CURSOR, not at the snapped grid point. The snap is only 5 mm,
//   so at any usable zoom the two are within a pixel of each other, and
//   tracking the raw pointer keeps the crosshair perfectly smooth instead of
//   stepping as it crosses grid boundaries.
//
// - Lives in the dimension SVG layer, so it inherits that layer's canvas box
//   and needs no positioning logic of its own. It is inserted FIRST among the
//   layer's children so every dimension and the axis guide draw over it.
//
// INTEGRATION:
// - Na__PlanDimensions__Editor__ shows it while a placement is armed, tracks
//   it on pointer move, and hides it when the placement ends or is cancelled.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Dimension Config and Overlay Host
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Data__.js
    // @delegate: ./Na__PlanDimensions__Overlay__.js
    // ------------------------------------------------------------
    import { Na__PlanDim__GetCrosshairSetup } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__GetHost
    } from './Na__PlanDimensions__Overlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | SVG and Identifiers
    // ------------------------------------------------------------
    const Na__PlanDimCross__SVG_NS   = 'http://www.w3.org/2000/svg';
    const Na__PlanDimCross__GROUP_ID = 'naPlanDimCrosshair';
    const Na__PlanDimCross__CLASS    = 'na-plan-dim__crosshair';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Elements and Visibility
    // ------------------------------------------------------------
    let Na__PlanDimCross__Group    = null;
    let Na__PlanDimCross__LineH    = null;
    let Na__PlanDimCross__LineV    = null;
    let Na__PlanDimCross__Visible  = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Crosshair Elements Exist
    // ------------------------------------------------------------
    // Inserted as the FIRST child of the layer so dimensions, the axis guide
    // and the vertex handles all paint over it rather than under it.
    // ------------------------------------------------------------
    function Na__PlanDimCross__Ensure() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return false;

        if (Na__PlanDimCross__Group && Na__PlanDimCross__Group.parentNode === root) return true;

        const group = document.createElementNS(Na__PlanDimCross__SVG_NS, 'g');
        group.setAttribute('id', Na__PlanDimCross__GROUP_ID);
        group.setAttribute('class', Na__PlanDimCross__CLASS);
        group.setAttribute('pointer-events', 'none');                            // <-- Must never intercept a pick
        group.style.display = 'none';

        const lineH = document.createElementNS(Na__PlanDimCross__SVG_NS, 'line');
        const lineV = document.createElementNS(Na__PlanDimCross__SVG_NS, 'line');
        group.appendChild(lineH);
        group.appendChild(lineV);

        root.insertBefore(group, root.firstChild);

        Na__PlanDimCross__Group = group;
        Na__PlanDimCross__LineH = lineH;
        Na__PlanDimCross__LineV = lineV;

        Na__PlanDimCross__ApplyStyle();
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push the Configured Appearance Onto Both Lines
    // ------------------------------------------------------------
    function Na__PlanDimCross__ApplyStyle() {
        const setup = Na__PlanDim__GetCrosshairSetup();

        [Na__PlanDimCross__LineH, Na__PlanDimCross__LineV].forEach((line) => {
            if (!line) return;
            line.setAttribute('stroke', setup.color);
            line.setAttribute('stroke-width', String(setup.strokePx));
            line.setAttribute('stroke-dasharray', setup.dash);
            line.setAttribute('opacity', String(setup.opacity));
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Move the Crosshair to a Canvas-Local Point
    // ------------------------------------------------------------
    // pointPx must already be canvas-local; the layer shares the canvas box, so
    // viewport coordinates would sit the crosshair a header-height too low.
    // ------------------------------------------------------------
    function Na__PlanDimCross__MoveTo(pointPx) {
        if (!Na__PlanDim__GetCrosshairSetup().enabled) return false;
        if (!pointPx || !Number.isFinite(pointPx.x) || !Number.isFinite(pointPx.y)) return false;
        if (!Na__PlanDimCross__Ensure()) return false;

        const host = Na__PlanDimLayer__GetHost();
        if (!host) return false;

        const width  = host.clientWidth  || 0;
        const height = host.clientHeight || 0;

        Na__PlanDimCross__LineH.setAttribute('x1', '0');
        Na__PlanDimCross__LineH.setAttribute('y1', String(pointPx.y));
        Na__PlanDimCross__LineH.setAttribute('x2', String(width));
        Na__PlanDimCross__LineH.setAttribute('y2', String(pointPx.y));

        Na__PlanDimCross__LineV.setAttribute('x1', String(pointPx.x));
        Na__PlanDimCross__LineV.setAttribute('y1', '0');
        Na__PlanDimCross__LineV.setAttribute('x2', String(pointPx.x));
        Na__PlanDimCross__LineV.setAttribute('y2', String(height));

        if (!Na__PlanDimCross__Visible) Na__PlanDimCross__Show();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Crosshair
    // ------------------------------------------------------------
    function Na__PlanDimCross__Show() {
        if (!Na__PlanDim__GetCrosshairSetup().enabled) return false;
        if (!Na__PlanDimCross__Ensure()) return false;

        Na__PlanDimCross__ApplyStyle();                                          // <-- Config may have changed since the last show
        Na__PlanDimCross__Group.style.display = '';
        Na__PlanDimCross__Visible = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Crosshair
    // ------------------------------------------------------------
    function Na__PlanDimCross__Hide() {
        if (Na__PlanDimCross__Group) Na__PlanDimCross__Group.style.display = 'none';
        Na__PlanDimCross__Visible = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Crosshair Currently Shown?
    // ------------------------------------------------------------
    function Na__PlanDimCross__IsVisible() {
        return Na__PlanDimCross__Visible;
    }
    // ------------------------------------------------------------


    // FUNCTION | Should It Appear Before the First Click?
    // ------------------------------------------------------------
    function Na__PlanDimCross__ShowsBeforeFirstClick() {
        return Na__PlanDim__GetCrosshairSetup().showBeforeFirstClick === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear Down Entirely (plan unmounted)
    // ------------------------------------------------------------
    function Na__PlanDimCross__Dispose() {
        if (Na__PlanDimCross__Group && Na__PlanDimCross__Group.parentNode) {
            Na__PlanDimCross__Group.parentNode.removeChild(Na__PlanDimCross__Group);
        }
        Na__PlanDimCross__Group   = null;
        Na__PlanDimCross__LineH   = null;
        Na__PlanDimCross__LineV   = null;
        Na__PlanDimCross__Visible = false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Placement Crosshair API
    // ------------------------------------------------------------
    export {
        Na__PlanDimCross__MoveTo,
        Na__PlanDimCross__Show,
        Na__PlanDimCross__Hide,
        Na__PlanDimCross__IsVisible,
        Na__PlanDimCross__ShowsBeforeFirstClick,
        Na__PlanDimCross__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
