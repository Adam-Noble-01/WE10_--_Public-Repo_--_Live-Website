// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PAINT ORDER
// =============================================================================
//
// FILE       : Na__LayoutEditor__PaintOrder__.js
// NAMESPACE  : Na__LePaint
// MODULE     : Layout Editor - Paint Order
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The one back-to-front order a sheet is painted in: the Layers list, top of the list frontmost, for every kind of item
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE LAYERS LIST IS THE STACK. Decision D31 of the Layout Editor has always
//   said "top of the list draws frontmost", and until this module only the
//   viewports obeyed it - and only against each other. The screen painted
//   every viewport in one box under every piece of markup, the markup itself
//   went kind by kind (all the vectors, then all the text, then the
//   dimensions, then the leaders) without looking at the list, and the PDF did
//   the same. A layer dragged under the Viewports layer still drew over the
//   drawing. Now one plan decides, and the screen, the PDF and the web viewer
//   all paint from it.
// - Plan(sheet) is the order, back to front, as a list of steps:
//       { kind : 'viewport', viewport, layerId }   one viewport: its picture,
//                                                  then its own frame line and
//                                                  caption, which belong to it
//       { kind : 'sheet' }                         the sheet's own paper: the
//                                                  border, the title block and
//                                                  the notes margin
//       { kind : 'layer', layerId }                one layer's markup
// - Layers are walked from the bottom of the list to the top, and each gives
//   its viewports (earlier in the sheet's array further back, the order the
//   frames have always stacked in) and then its markup. Inside one layer the
//   kinds keep the order they always had - vectors, text, dimensions,
//   leaders - so a layer holding several kinds looks as it did.
// - THE SHEET'S OWN PAPER sits directly above the frontmost layer that shows a
//   viewport. That is exactly where it has always been on a sheet whose
//   pictures are under its markup: over every drawing, so the title block and
//   the notes column mask a viewport that strays under them, and under every
//   note and dimension placed over them. With no viewport shown it goes first.
// - AN ITEM ON A LAYER THE LIST DOES NOT HAVE is drawn after everything else,
//   in front - an unknown layer has always read as shown. A loaded sheet never
//   has one (the normaliser re-homes them); the scrapbook's previews, which
//   build a sheet with no layers at all, have nothing else.
// - Hidden layers are left out of the plan altogether, with their viewports.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetSurface__ builds its interleaved stack from Plan,
//   Na__LayoutEditor__PdfExporter__ draws a page from it, and
//   Na__LayoutEditor__MarkupBridge__ paints and hit tests markup layer by layer
//   through MarkupBackToFront and MarkupFrontToBack.
// - Reads the layers through Na__LayoutEditor__SheetModel__ only.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: Plan, MarkupBackToFront, MarkupFrontToBack and
//   IsKnownLayer. Adam's first floor area sat under the Viewports layer in the
//   list and was still drawn over the plan's linework.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model
    // ------------------------------------------------------------
    import { Na__LeModel__GetLayers } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Step Kinds
    // ------------------------------------------------------------
    const Na__LePaint__STEP_VIEWPORT = 'viewport';
    const Na__LePaint__STEP_SHEET    = 'sheet';
    const Na__LePaint__STEP_LAYER    = 'layer';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Ids the Sheet's Layers List Holds
    // ------------------------------------------------------------
    function Na__LePaint__KnownIds(sheet) {
        return new Set(Na__LeModel__GetLayers(sheet).map((layer) => layer.Layer__Id));
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the List Hold This Layer
    // ------------------------------------------------------------
    // An item whose layer this answers false for is one of the "unknown
    // layer" items, drawn in front of everything and never hidden.
    // ------------------------------------------------------------
    function Na__LePaint__IsKnownLayer(sheet, layerId) {
        return Na__LeModel__GetLayers(sheet).some((layer) => layer.Layer__Id === layerId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Shown Layers, Back to Front, With Room for Their Viewports
    // ------------------------------------------------------------
    // The last group is the unknown-layer one (layerId null), frontmost.
    // ------------------------------------------------------------
    function Na__LePaint__Groups(sheet) {
        const shown  = Na__LeModel__GetLayers(sheet).filter((layer) => layer.Layer__Visible !== false);
        const groups = shown.slice().reverse().map((layer) => ({ layerId : layer.Layer__Id, viewports : [] }));
        groups.push({ layerId : null, viewports : [] });
        return groups;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Whole Sheet, Back to Front
    // ------------------------------------------------------------
    // See the header for the three kinds of step. A viewport on a hidden layer
    // is not in the plan; one on a layer the list does not have is in the
    // front group with the other unknown-layer items.
    // ------------------------------------------------------------
    function Na__LePaint__Plan(sheet) {
        const steps = [];
        if (!sheet) return steps;
        const known  = Na__LePaint__KnownIds(sheet);
        const groups = Na__LePaint__Groups(sheet);
        const byId   = new Map(groups.map((group) => [ group.layerId, group ]));
        (Array.isArray(sheet.Sheet__Viewports) ? sheet.Sheet__Viewports : []).forEach((viewport) => {
            const group = byId.get(known.has(viewport.Viewport__LayerId) ? viewport.Viewport__LayerId : null);   // <-- No group: its layer is hidden
            if (group) group.viewports.push(viewport);
        });

        // THE SHEET'S OWN PAPER goes directly over the frontmost group showing
        // a viewport - or first of all when none shows one.
        let top = -1;
        groups.forEach((group, index) => { if (group.viewports.length > 0) top = index; });
        if (top === -1) steps.push({ kind : Na__LePaint__STEP_SHEET });

        groups.forEach((group, index) => {
            group.viewports.forEach((viewport) => steps.push({ kind : Na__LePaint__STEP_VIEWPORT, viewport : viewport, layerId : group.layerId }));
            if (index === top) steps.push({ kind : Na__LePaint__STEP_SHEET });
            steps.push({ kind : Na__LePaint__STEP_LAYER, layerId : group.layerId });
        });
        return steps;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layers Markup Is Painted In, Back to Front
    // ------------------------------------------------------------
    // Shown layers only, bottom of the list first, then null for the
    // unknown-layer items - the order the painter walks.
    // ------------------------------------------------------------
    function Na__LePaint__MarkupBackToFront(sheet) {
        return sheet ? Na__LePaint__Groups(sheet).map((group) => group.layerId) : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layers a Click Is Answered In, Front to Back
    // ------------------------------------------------------------
    // The reverse of the painting: what is drawn on top is found first.
    // ------------------------------------------------------------
    function Na__LePaint__MarkupFrontToBack(sheet) {
        return Na__LePaint__MarkupBackToFront(sheet).reverse();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Paint Order API
    // ------------------------------------------------------------
    export {
        Na__LePaint__STEP_VIEWPORT,
        Na__LePaint__STEP_SHEET,
        Na__LePaint__STEP_LAYER,
        Na__LePaint__Plan,
        Na__LePaint__MarkupBackToFront,
        Na__LePaint__MarkupFrontToBack,
        Na__LePaint__IsKnownLayer
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
