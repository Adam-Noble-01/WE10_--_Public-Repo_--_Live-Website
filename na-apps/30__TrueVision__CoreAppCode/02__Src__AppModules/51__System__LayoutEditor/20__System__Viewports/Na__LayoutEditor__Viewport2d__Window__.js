// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 2D - WINDOW
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport2d__Window__.js
// NAMESPACE  : Na__LeVp2d
// MODULE     : Layout Editor - Viewport 2D - Window
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The model window a 2D viewport looks through, and the projection definition it draws
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Window: the frame's paper size times the scale denominator, in drawing
//   millimetres, centred on the viewport's pan, with its local, paper and
//   from-paper mappings. Everything in the frame is placed from that one
//   rectangle.
// - Describe: the source records, the projection definition (the viewport's
//   own Render Composites toggles, Model Layers exclusion tokens and door
//   pose folded in), the window and the viewport's Model Source, in one go.
// - Imports no other Viewport 2D unit, so the Frame, Linework and SitePlan
//   units and Na__LayoutEditor__Viewport2d__ can all import it without a
//   cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__Viewport2d__ re-exports Window and Describe and calls
//   them from CentreOnDrawing, Fill, GetSnapSource, ForceRender and
//   RenderForExport. The Frame unit reads both for the debounced underlay
//   render; the Linework unit reads Window to lay out the linework SVG, and
//   the SitePlan unit to lay out the site plan SVG.
// - Every other module imports Na__LayoutEditor__Viewport2d__.js, never
//   this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header and import paths; Describe's door pose
//                   (Na__LayoutEditor__PlanDoors__: a plan's doors open bar the
//                   ones the viewport closed, every door shut on an elevation or
//                   section), its Model Source (Na__LayoutEditor__ModelSource__),
//                   and its comments and blank lines.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Viewport2d__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Model Source, Model Layers and Plan Doors
    // ------------------------------------------------------------
    import { Na__LeModel__ResolveViewportSource } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSource__Resolve } from './Na__LayoutEditor__ModelSource__.js';
    import { Na__LeModelLayers__ExcludeTokens } from '../25__System__RenderStyles/Na__LayoutEditor__ModelLayers__.js';
    import { Na__LeDoors__PoseFor, Na__LeDoors__ShutPoseFor } from './Na__LayoutEditor__PlanDoors__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Projected Linework (definitions)
    // ------------------------------------------------------------
    import {
        Na__PlView__FromPlan,
        Na__PlView__FromElevation
    } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Window and Definition
// -----------------------------------------------------------------------------

    // FUNCTION | The Model Window of a Viewport, With Its Paper Mappings
    // ------------------------------------------------------------
    function Na__LeVp2d__Window(viewport) {
        const frame = viewport.Viewport__FrameMm;
        const D     = viewport.Viewport__ScaleDenominator;
        const w     = frame.WidthMm  * D;
        const h     = frame.HeightMm * D;
        const cx    = viewport.Viewport__PanMm.X;
        const cy    = viewport.Viewport__PanMm.Y;
        const ox    = cx - (w / 2);
        const oy    = cy - (h / 2);
        const win = {
            CentreX : cx, CentreY : cy, WidthMm : w, HeightMm : h, OriginX : ox, OriginY : oy, Denominator : D, Frame : frame,
            ToLocal   : (dx, dy) => ({ x : (dx - ox) / D, y : (dy - oy) / D }),
            ToPaper   : (dx, dy) => ({ x : frame.X + ((dx - ox) / D), y : frame.Y + ((dy - oy) / D) }),
            FromPaper : (px, py) => ({ x : ox + ((px - frame.X) * D), y : oy + ((py - frame.Y) * D) })
        };
        return win;
    }
    // ------------------------------------------------------------


    // FUNCTION | Source Records, Projection Definition and Window in One Go
    // ------------------------------------------------------------
    function Na__LeVp2d__Describe(viewport) {
        const source = Na__LeModel__ResolveViewportSource(viewport);
        // The viewport's own Render Composites toggles override the drawing
        // record's, so a sheet can show the same drawing two ways - and so a
        // toggle in the panel governs the linework as well as the raster.
        const override   = viewport.Viewport__Styles || null;
        // AND THE MODEL LAYERS PANEL GOES IN AS EXCLUSION TOKENS, which is the
        // whole of how a hidden category leaves the vectors. The tokens are
        // part of the definition, so they are part of its RecordHash, so two
        // viewports of one drawing that hide different things key differently
        // and cache separately without another word being said about it.
        const exclude    = Na__LeModelLayers__ExcludeTokens(viewport);
        // A PLAN DRAWS ITS DOORS OPEN, bar the ones this viewport closed, AND AN
        // ELEVATION OR SECTION DRAWS EVERY DOOR SHUT, whatever the 3D view shows.
        // The pose is part of the definition, so it keys everything the
        // definition keys.
        const definition = source.plan
            ? Na__PlView__FromPlan(source.plan, override, exclude, Na__LeDoors__PoseFor(viewport))
            : (source.elevation ? Na__PlView__FromElevation(source.elevation, override, exclude, Na__LeDoors__ShutPoseFor(viewport)) : null);
        return { source : source, definition : definition, window : Na__LeVp2d__Window(viewport), modelSource : Na__LeSource__Resolve(viewport) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 2D Window Unit
    // ------------------------------------------------------------
    export {
        Na__LeVp2d__Window,
        Na__LeVp2d__Describe
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
