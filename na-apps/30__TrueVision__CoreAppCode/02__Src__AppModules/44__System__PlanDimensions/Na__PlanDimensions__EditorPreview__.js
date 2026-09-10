// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - EDITOR PREVIEW
// =============================================================================
//
// FILE       : Na__PlanDimensions__EditorPreview__.js
// NAMESPACE  : Na__PlanDimPreview
// MODULE     : Plan Dimensions - Editor Preview
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The rubber-band line and figure shown between the two placement clicks
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Between the two placement clicks a live preview follows the pointer
//   showing the span that would be created, already snapped and axis-locked,
//   with its measured figure. Reading the number before committing is the
//   whole point of the preview.
// - Renders at the size the dimension will be created at, from the same live
//   defaults, so the figure never leaps when the second click lands.
// - Owns only the two SVG nodes; the editor decides when to draw and clear.
//
// INTEGRATION:
// - Na__PlanDimensions__Editor__ calls Draw on every pointer move while a
//   placement is armed and Clear when the placement ends or editing stops.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 45__System__PlanDimensions/Na__PlanDimensions__EditorPreview__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial split from Na__PlanDimensions__Editor__.js during port Phase 2.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Overlay Layer, Data and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Overlay__.js
    // @delegate: ./Na__PlanDimensions__Data__.js
    // @delegate: ./Na__PlanDimensions__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimLayer__GetRoot,
        Na__PlanDimLayer__MmToPx
    } from './Na__PlanDimensions__Overlay__.js';
    import {
        Na__PlanDim__GetNewDefaults,
        Na__PlanDim__FormatLength
    } from './Na__PlanDimensions__Data__.js';
    import {
        Na__PlanDim__GetLayerSetup
    } from './Na__PlanDimensions__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identity
    // ------------------------------------------------------------
    const Na__PlanDimPreview__SVG_NS        = 'http://www.w3.org/2000/svg';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Preview Nodes
    // ------------------------------------------------------------
    let Na__PlanDimPreview__Line = null;
    let Na__PlanDimPreview__Text = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Preview Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create the Rubber-Band Preview Nodes
    // ------------------------------------------------------------
    function Na__PlanDimPreview__Ensure() {
        const root = Na__PlanDimLayer__GetRoot();
        if (!root) return false;

        if (!Na__PlanDimPreview__Line) {
            Na__PlanDimPreview__Line = document.createElementNS(Na__PlanDimPreview__SVG_NS, 'line');
            Na__PlanDimPreview__Line.setAttribute('class', 'na-plan-dim__preview-line');
        }
        if (!Na__PlanDimPreview__Text) {
            Na__PlanDimPreview__Text = document.createElementNS(Na__PlanDimPreview__SVG_NS, 'text');
            Na__PlanDimPreview__Text.setAttribute('class', 'na-plan-dim__preview-text');
            Na__PlanDimPreview__Text.setAttribute('text-anchor', 'middle');
        }

        if (Na__PlanDimPreview__Line.parentElement !== root) root.appendChild(Na__PlanDimPreview__Line);
        if (Na__PlanDimPreview__Text.parentElement !== root) root.appendChild(Na__PlanDimPreview__Text);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remove the Preview Nodes
    // ------------------------------------------------------------
    function Na__PlanDimPreview__Clear() {
        [Na__PlanDimPreview__Line, Na__PlanDimPreview__Text].forEach((node) => {
            if (node && node.parentElement) node.parentElement.removeChild(node);
        });
        Na__PlanDimPreview__Line = null;
        Na__PlanDimPreview__Text = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Preview for a Candidate Span
    // ------------------------------------------------------------
    // Shows the span exactly as it would be stored - snapped and axis-locked -
    // with its measured figure, so the author commits to a number they have
    // already read rather than to a cursor position.
    // ------------------------------------------------------------
    function Na__PlanDimPreview__Draw(startPx, endPx, lengthMm) {
        if (!Na__PlanDimPreview__Ensure()) return;

        Na__PlanDimPreview__Line.setAttribute('x1', startPx.x);
        Na__PlanDimPreview__Line.setAttribute('y1', startPx.y);
        Na__PlanDimPreview__Line.setAttribute('x2', endPx.x);
        Na__PlanDimPreview__Line.setAttribute('y2', endPx.y);

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

        Na__PlanDimPreview__Text.setAttribute('x', midX);
        Na__PlanDimPreview__Text.setAttribute('y', midY - (fontPx * 0.4));
        Na__PlanDimPreview__Text.setAttribute('font-size', fontPx);
        Na__PlanDimPreview__Text.setAttribute('font-weight', String(defaults.fontWeight));
        Na__PlanDimPreview__Text.setAttribute('fill', defaults.color);
        Na__PlanDimPreview__Line.setAttribute('stroke', defaults.color);
        Na__PlanDimPreview__Text.textContent = Number.isFinite(lengthMm)
            ? Na__PlanDim__FormatLength(lengthMm, null)
            : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimensions Editor Preview API
    // ------------------------------------------------------------
    export {
        Na__PlanDimPreview__Ensure,
        Na__PlanDimPreview__Clear,
        Na__PlanDimPreview__Draw
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
