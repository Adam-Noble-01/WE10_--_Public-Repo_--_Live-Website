// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - FLOOR AREAS - LABEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__FloorAreas__Paint__.js
// NAMESPACE  : Na__LeAreaPaint
// MODULE     : Layout Editor - Floor Areas - Label
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The name and the figure written in the middle of a measured room
//
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE LABEL IS NOT A TEXT RECORD, and that is the point. It is painted from
//   the shape every time the sheet is drawn, so it follows a corner as the
//   corner is dragged - a record would only catch up when the drag was let go,
//   because a drag writes silently until then. It also means a room can never
//   be found with somebody else's figure under it, and that deleting a room
//   takes its label with it.
// - IT GOES THROUGH THE ONE PAINTER the whole editor draws through
//   (Na__LayoutEditor__MarkupBridge__, in the shapes pass), so the screen, the
//   PDF, the read-only web viewer and the scrapbook's tile previews all show
//   the same label with no second code path to keep in step.
// - IT SITS IN THE MIDDLE OF THE ROOM'S BOX, the standard Adam asked for,
//   unless that middle is not inside the room (an L, a U), when it sits at
//   the room's visual centre instead - the middle of the largest circle that
//   fits inside it - so an L-shaped room is still labelled inside the L. A
//   label DRAGGED somewhere else (the room's edit mode,
//   Na__LayoutEditor__FloorAreas__LabelGrip__) sits that far from there.
// - Where the words are wider than the room's largest circle they are set
//   smaller rather than allowed to run across the room next door. It is the
//   ROOM's circle, not the circle round wherever the label happens to be, so
//   dragging the label about never changes its size.
//
// INTEGRATION:
// - Called by Na__LayoutEditor__MarkupBridge__ for every shape carrying
//   Shape__Area, straight after the shape itself is pushed.
// - LabelBox is the box the label grip draws and takes presses in.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of Floor Areas.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - The label is centred on Measure's labelAt, which now starts from the
//   middle of the room's box rather than its visual centre (see the Floor
//   Areas module, 1.2.0). The shrink to fit still measures the room's own
//   largest circle, so where the label sits never changes how big it is.
// - LabelBox has its first caller: the label grip, which drags the label in
//   the room's edit mode.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the two lines, the shrink to fit and the box.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Chrome's Text, and What a Room Knows About Itself
    // ------------------------------------------------------------
    import { Na__LeChrome__MeasureTextMm, Na__LeChrome__PushText } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__LeArea__LABEL_NAME,
        Na__LeArea__LABEL_VALUE,
        Na__LeArea__LABEL_NONE,
        Na__LeArea__Value,
        Na__LeArea__Is,
        Na__LeArea__NameOf,
        Na__LeArea__LabelModeOf,
        Na__LeArea__TextSizeOf,
        Na__LeArea__Measure,
        Na__LeArea__FormatArea
    } from './Na__LayoutEditor__FloorAreas__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typography
    // ------------------------------------------------------------
    const Na__LeAreaPaint__CAP_HEIGHT = 0.72;    // <-- The fraction of a font size its capitals stand, as the rest of the editor reads it
    const Na__LeAreaPaint__FIT_MARGIN = 0.92;    // <-- How much of the circle inside the room the words may fill before they are set smaller
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Label
// -----------------------------------------------------------------------------

    // FUNCTION | What a Room's Label Says, and How It Is Set
    // ------------------------------------------------------------
    // Returns null when there is nothing to draw - a run that encloses
    // nothing, or a room whose label has been switched off. Otherwise:
    //     { lines : [ { text, sizeMm, weight, colour } ], at : { x, y },
    //       widthMm, heightMm }
    // The lines are in the order they are stacked; `at` is where the block is
    // centred, both ways.
    //
    // A NAME TOO WIDE FOR THE ROOM IS SET SMALLER, down to the configured
    // floor, rather than written across whatever is beside it. The room's own
    // circle is what it is measured against, so a cupboard labels itself in
    // small type and a hall in full size.
    // ------------------------------------------------------------
    function Na__LeAreaPaint__Layout(sheet, shape) {
        if (!Na__LeArea__Is(shape)) return null;
        const mode = Na__LeArea__LabelModeOf(shape);
        if (mode === Na__LeArea__LABEL_NONE) return null;
        const measured = Na__LeArea__Measure(sheet, shape);
        if (!measured.encloses) return null;

        const nameSizeMm  = Na__LeArea__TextSizeOf(shape);
        const baseNameMm  = Na__LeArea__Value('Label', 'Label__NameSizeMm', 2.4);
        const baseValueMm = Na__LeArea__Value('Label', 'Label__ValueSizeMm', 2.1);
        const ratio       = baseNameMm > 0 ? (baseValueMm / baseNameMm) : 1;      // <-- Change the label's size and the figure keeps its place under the name
        const valueSizeMm = nameSizeMm * ratio;
        const gapMm       = Na__LeArea__Value('Label', 'Label__LineGapMm', 0.9);

        const name  = Na__LeArea__NameOf(shape) || Na__LeArea__Value('Label', 'Label__UnnamedText', 'Unnamed');
        const value = measured.crossing
            ? Na__LeArea__Value('Label', 'Label__CrossedText', 'outline crosses itself')
            : Na__LeArea__FormatArea(measured.m2);

        const lines = [];
        if (mode !== Na__LeArea__LABEL_VALUE) {
            lines.push({ text : name, sizeMm : nameSizeMm, weight : Na__LeArea__Value('Label', 'Label__NameWeight', 600), colour : Na__LeArea__Value('Label', 'Label__NameColour', '#172b3a') });
        }
        if (mode !== Na__LeArea__LABEL_NAME) {
            lines.push({ text : value, sizeMm : valueSizeMm, weight : Na__LeArea__Value('Label', 'Label__ValueWeight', 400), colour : Na__LeArea__Value('Label', 'Label__ValueColour', '#172b3a') });
        }
        if (!lines.length) return null;

        // SET SMALLER TO FIT | Measured against the circle that fits in the
        // room, which is what the visual centre already worked out - the
        // room's circle, wherever the label sits, so a label dragged towards
        // a wall keeps its size.
        let scale = 1;
        if (Na__LeArea__Value('Label', 'Label__ShrinkToFit', true) && measured.centre.clearMm > 0) {
            const room = measured.centre.clearMm * 2 * Na__LeAreaPaint__FIT_MARGIN;
            let widest = 0;
            lines.forEach((line) => { widest = Math.max(widest, Na__LeChrome__MeasureTextMm(line.text, line.sizeMm, line.weight)); });
            if (widest > room && widest > 0) {
                const floorMm = Na__LeArea__Value('Label', 'Label__MinTextSizeMm', 1.2);
                const wanted  = room / widest;
                const least   = floorMm / Math.max(nameSizeMm, valueSizeMm);      // <-- Never below the floor, however narrow the room
                scale = Math.max(least, wanted);
                if (scale > 1) scale = 1;
            }
        }

        let widthMm  = 0;
        let heightMm = 0;
        lines.forEach((line, index) => {
            line.sizeMm = line.sizeMm * scale;
            widthMm  = Math.max(widthMm, Na__LeChrome__MeasureTextMm(line.text, line.sizeMm, line.weight));
            heightMm += (line.sizeMm * Na__LeAreaPaint__CAP_HEIGHT) + (index > 0 ? gapMm * scale : 0);
        });

        return { lines : lines, at : measured.labelAt, widthMm : widthMm, heightMm : heightMm, gapMm : gapMm * scale, crossing : measured.crossing };
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Room's Label Into the Primitive List
    // ------------------------------------------------------------
    // The block is centred on the label's point both ways, so a room reads
    // with its name over its figure and the pair sitting in the middle of it.
    // ------------------------------------------------------------
    function Na__LeAreaPaint__Push(list, sheet, shape) {
        const layout = Na__LeAreaPaint__Layout(sheet, shape);
        if (!layout) return false;
        let baseline = layout.at.y - (layout.heightMm / 2);
        layout.lines.forEach((line, index) => {
            baseline += (line.sizeMm * Na__LeAreaPaint__CAP_HEIGHT) + (index > 0 ? layout.gapMm : 0);
            Na__LeChrome__PushText(list, {
                X : layout.at.x, BaselineY : baseline, Text : line.text,
                FontMm : line.sizeMm, Weight : line.weight, Colour : line.colour, Align : 'center'
            });
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Paper Box a Room's Label Occupies
    // ------------------------------------------------------------
    // For the grip that drags the label, and for anything else that has to
    // know where the words are. Null when the room has no label.
    // ------------------------------------------------------------
    function Na__LeAreaPaint__LabelBox(sheet, shape) {
        const layout = Na__LeAreaPaint__Layout(sheet, shape);
        if (!layout) return null;
        return {
            X        : layout.at.x - (layout.widthMm / 2),
            Y        : layout.at.y - (layout.heightMm / 2),
            WidthMm  : layout.widthMm,
            HeightMm : layout.heightMm
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Floor Area Label API
    // ------------------------------------------------------------
    export {
        Na__LeAreaPaint__Layout,
        Na__LeAreaPaint__Push,
        Na__LeAreaPaint__LabelBox
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
