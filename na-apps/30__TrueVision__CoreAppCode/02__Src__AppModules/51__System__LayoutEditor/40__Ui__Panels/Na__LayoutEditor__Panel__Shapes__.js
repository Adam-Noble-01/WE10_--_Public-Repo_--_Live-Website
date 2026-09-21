// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTORS PANEL
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Shapes__.js
// NAMESPACE  : Na__LePanelShapes
// MODULE     : Layout Editor - Vectors Panel
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Edges, edge colour and weight, fill, gradient and closure for the selected shape, or the defaults for the next one
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - With a shape selected the controls edit it; with nothing selected they
//   set what the Draw tool uses next, the same way the Text and Dimensions
//   panels work.
// - Weights are printed points because that is what a drawing office
//   reads; the geometry converts to paper millimetres.
// - Edges and fill are either-or at the least, which gives the three
//   states a drawing wants: edges alone (a line or an outline), edges with
//   a fill, or a fill alone (a solid, a mask, a block of tone). Switching
//   one off switches the other on, so a shape is never invisible.
// - A GRADIENT IS A FILL. Its rows and everything about the gradient itself
//   belong to Na__LayoutEditor__GradientTool__; this panel keeps only how it
//   sits beside the rest of the shape. Switching the gradient on switches the
//   solid fill off and the other way round, and it counts as the fill for
//   the either-or rule - so edges off with a gradient on leaves a gradient
//   alone, the fade-a-drawing-out case, instead of bringing a grey fill back.
// - The edge colour and weight rows go away while the edges are off, the
//   fill colour while there is no fill and the gradient settings while there
//   is no gradient, so the panel only ever shows what is in play.
// - DASHED EDGES. Off unless asked for. Ticking it opens a block for the
//   pattern - dashed, dotted, dash-dot (centre lines), hidden - the scale of
//   the sections and their paper-millimetre lengths. It sits with the other
//   edge rows, so a two-point line can take a centre line; it goes away while
//   the edges are off.
// - OPACITY. A fill has a Fill opacity slider while it is on. The edges are
//   solid unless Transparent edges is ticked, which brings up Edge opacity,
//   starting at the Shapes setup's TransparentEdgeOpacity. A gradient keeps
//   its own alpha. Both sliders are one undo step per drag, like the
//   gradient's.
// - DRAW AT SCALE, the first control, is the drawing tools' own switch and
//   never the selected shape's: on, the sizes typed into the Measurements box
//   while the Draw or Rectangle tool is up are real sizes at the drawing's
//   scale (Na__LayoutEditor__DrawingScale__), which its label quotes; off,
//   they are paper millimetres. It shows and works whatever is selected.
//
// INTEGRATION:
// - Registered by the mode controller in the right column.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Shapes__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only. The gradient
//                   rows (1.3.0) were authored here and went to ValeVision v2.26.0.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.9.0
// - The hatch block gains Pattern line pt and Pattern colour, under Pattern
//   deg, and a Standard button that shows once either is set. The boxes show
//   what the hatch is drawn with: the pattern's standard (its own stroke at
//   the scale in use; its own ink, else the shape's edge colour) until a value
//   is set, which is then stored on the shape as Hatch__StrokePt (printed
//   points, not scaled with the pattern) and Hatch__Colour. Choosing another
//   pattern clears both, so each pattern starts from its own standards. The
//   colour box opens the Colour Palette like every other colour field.
//
// 21-Sep-2026 - Version 1.8.2
// - Pictures (Sheet Images) are left out of what this panel reads and edits:
//   a picture has no edge, fill or hatch, and its settings are the Images
//   panel's.
//
// 21-Sep-2026 - Version 1.8.1
// - Edges off with SEVERAL vectors selected takes the edges off and nothing
//   else. It used to write a fill as well, so that no shape was left with
//   nothing to show - but one fill colour for all of them, the new-shape
//   default, which repainted every selected shape in it: select a floor's
//   coloured rooms and a plain line, untick Edges, and every room came out
//   the same blue. A shape with no fill of its own now keeps its edges, which
//   the normaliser has always guaranteed. One vector selected is unchanged.
//
// 17-Sep-2026 - Version 1.8.0
// - Several selected: the panel reads the first vector and writes all of them,
//   the fill, gradient and dashed-edge rows included. Open or closed stays a
//   single-selection edit - it is geometry, not style.
//
// 14-Sep-2026 - Version 1.7.0
// - Dashed edges, the toggle after Edge opacity: off by default, and opening
//   it brings up the pattern (dashed, dotted, dash-dot, hidden), the scale
//   and the millimetre section lengths from Na__LayoutEditor__LineStyleTool__.
//   It sits with the other edge rows, so a two-point centre line can take it,
//   and it goes away while the edges are off.
//
// 14-Sep-2026 - Version 1.6.0
// - Draw at scale, the first control: the Draw and Rectangle tools' atScale
//   setting, quoting the sheet's scale in its label. It never edits a shape.
//
// 14-Sep-2026 - Version 1.5.0
// - With several items selected the note says how many, and that these are the
//   settings for new shapes until one shape is selected on its own.
//
// 14-Sep-2026 - Version 1.4.0
// - Fill opacity (under Fill colour, while there is a fill) and Transparent
//   edges with its Edge opacity slider (under Edge pt, while the edges are on).
//   The sliders redraw silently as they move and announce once on release.
//
// 13-Sep-2026 - Version 1.3.0
// - The Gradient toggle and its rows, from Na__LayoutEditor__GradientTool__. A
//   gradient replaces the solid fill and counts as the fill for the either-or
//   rule. Its sliders redraw the shape silently while they move and announce
//   once on release, so a whole drag is one undo step.
// - The gradient rows sit last, after the fills and Closed (Adam's call at
//   sign-off), so opening the block moves no other control.
//
// 12-Sep-2026 - Version 1.2.0
// - The draw-tool and axis-lock instruction paragraphs are gone from the
//   panel body; they took more height than the controls they explained.
//
// 10-Sep-2026 - Version 1.1.0
// - The Edges toggle, the either-or rule that keeps a shape visible, and
//   rows that hide when they have nothing to say.
//
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Tools, Surface, Gradient Tool and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetLineweightSetup, Na__LeCfg__GetShapeSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeHatch__Get, Na__LeHatch__GetPacks, Na__LeHatch__ClampScale, Na__LeHatch__ClampRotation, Na__LeHatch__ClampStrokePt, Na__LeHatch__CleanColour, Na__LeHatch__StandardStrokePt, Na__LeHatch__StandardColour } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__GetSelectionItems, Na__LeModel__UpdateShape } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeTools__GetShapeDefaults, Na__LeTools__SetShapeDefaults } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGrad__BuildRows, Na__LeGrad__RefreshRows, Na__LeGrad__RegisterControls } from '../35__System__DrawingTools/Na__LayoutEditor__GradientTool__.js';
    import { Na__LeDash__BuildRows, Na__LeDash__RefreshRows, Na__LeDash__RegisterControls } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import { Na__LeDrawScale__SheetDenominator, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMeasure__Refresh } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__SelectedOfKind,
        Na__LePanels__ApplyToSelection,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__SliderRow,
        Na__LePanels__ShowSlider
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelShapes__ID = 'shapes';
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Shape, if Any
    // ------------------------------------------------------------
    function Na__LePanelShapes__Selected() {
        const sheet = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'shape') return null;
        const item = sheet.Sheet__Shapes.find((s) => s.Shape__Id === selection.id) || null;
        return (item && !item.Shape__Image) ? { sheet : sheet, item : item } : null;   // <-- A picture is the Images panel's: it has no edge or fill to set here
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Selected Vector, When There Is More Than One
    // ------------------------------------------------------------
    // Reading is what the panel shows; writing is what it changes. With one
    // thing selected the two are the same item. With several, the panel reads
    // the FIRST of them and writes ALL of them - a box showing the setting for
    // new objects while nine are selected is what sent an edit somewhere
    // nobody expected.
    // ------------------------------------------------------------
    function Na__LePanelShapes__Many() {
        const sheet = Na__LeModel__GetActiveSheet();
        const shapes = sheet ? (sheet.Sheet__Shapes || []) : [];
        const items  = Na__LePanels__SelectedOfKind(sheet, 'shape').filter((entry) => { const s = shapes.find((x) => x.Shape__Id === entry.id); return !!s && !s.Shape__Image; });   // <-- Pictures in the selection are not vectors to restyle
        if (!items.length) return null;
        const item = shapes.find((s) => s.Shape__Id === items[0].id) || null;
        return item ? { sheet : sheet, item : item, count : items.length } : null;
    }
    function Na__LePanelShapes__Reading() { return Na__LePanelShapes__Selected() || Na__LePanelShapes__Many(); }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Draw at Scale Label, Quoting the Sheet's Scale
    // ------------------------------------------------------------
    // Off every viewport a typed size is drawn at the sheet's scale; over a
    // viewport at another scale it takes that viewport's, as the title says.
    // ------------------------------------------------------------
    function Na__LePanelShapes__AtScaleCaption() {
        const scale = Na__LeDrawScale__Label(Na__LeDrawScale__SheetDenominator(Na__LeModel__GetActiveSheet()));
        return Na__LeCfg__FormatLabel('ShapeAtScale', 'Draw at scale ({scale})', { scale : scale });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelShapes__Build(body) {
        const lw = Na__LeCfg__GetLineweightSetup();
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);
        // DRAW AT SCALE | First, because it decides what every size typed while
        // drawing means; a setting of the drawing tools, shown whatever is selected
        const atScale = Na__LePanels__Row(Na__LePanelShapes__AtScaleCaption(), Na__LePanels__Input('checkbox', 'shape-at-scale'), 'na-le-row--toggle');
        atScale.title = Na__LeCfg__GetLabel('ShapeAtScaleTitle', "On: sizes typed into the Measurements box are real sizes at the drawing's scale - the scale of the viewport under the first point, or the sheet's elsewhere. Off: they are paper millimetres.");
        body.appendChild(atScale);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStroked', 'Edges'), Na__LePanels__Input('checkbox', 'shape-stroked')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStroke', 'Edge colour'), Na__LePanels__Input('color', 'shape-stroke')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeStrokePt', 'Edge pt'), Na__LePanels__Input('number', 'shape-pt', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt })));
        // TRANSPARENT EDGES | Off unless asked for; ticking it brings up the slider
        const clear = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeTransparentEdges', 'Transparent edges'), Na__LePanels__Input('checkbox', 'shape-edge-transparent'), 'na-le-row--toggle');
        clear.title = Na__LeCfg__GetLabel('ShapeTransparentEdgesTitle', 'Let the edges show what is beneath them.');
        body.appendChild(clear);
        body.appendChild(Na__LePanels__SliderRow(Na__LeCfg__GetLabel('ShapeEdgeOpacity', 'Edge opacity'), 'shape-edge-opacity'));
        // DASHED EDGES | Off unless asked for; ticking it opens the pattern block
        // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
        Na__LeDash__BuildRows(body);
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeFill', 'Fill'), Na__LePanels__Input('checkbox', 'shape-filled')));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeFillColour', 'Fill colour'), Na__LePanels__Input('color', 'shape-fill')));
        body.appendChild(Na__LePanels__SliderRow(Na__LeCfg__GetLabel('ShapeFillOpacity', 'Fill opacity'), 'shape-fill-opacity'));
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeClosed', 'Closed'), Na__LePanels__Input('checkbox', 'shape-closed')));
        // THE GRADIENT GOES LAST, after the fills and Closed. Opening it moves
        // no other control out from under the pointer. Dashed edges open among
        // the edge rows, because a two-point centre line has no fill.
        Na__LeGrad__BuildRows(body);
        // THE HATCH GOES LAST OF ALL, after the gradient. Adam: 'add a toggle
        // that's default off, but within vectors at the bottom, which can switch
        // on patterns to draw over the top of the fill on that vector, just like
        // how layout works in SketchUp.' Off, the block is one row; ticking it
        // opens the three controls under it and moves nothing above it.
        const hatchRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatch', 'Hatch'), Na__LePanels__Input('checkbox', 'shape-hatch-on'), 'na-le-row--toggle');
        hatchRow.title = Na__LeCfg__GetLabel('ShapeHatchTitle', 'A repeating pattern over this shape, drawn above its fill and below its own outline. Paper size: a tile prints the same however the sheet is scaled.');
        body.appendChild(hatchRow);
        const hatchPattern = Na__LePanels__Select('shape-hatch-pattern', [], '');
        const hatchPatternRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatchPattern', 'Pattern'), hatchPattern);
        hatchPatternRow.setAttribute('data-na-block', 'shape-hatch-pattern-row');
        body.appendChild(hatchPatternRow);
        const hatchScale = Na__LePanels__Input('number', 'shape-hatch-scale', { min : 0.1, max : 10, step : 0.05 });
        hatchScale.title = Na__LeCfg__GetLabel('ShapeHatchScaleTitle', 'How large the pattern draws on the sheet. 1 is the size it was drawn at.');
        const hatchScaleRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatchScale', 'Pattern scale'), hatchScale);
        hatchScaleRow.setAttribute('data-na-block', 'shape-hatch-scale-row');
        body.appendChild(hatchScaleRow);
        const hatchRot = Na__LePanels__Input('number', 'shape-hatch-rotation', { min : 0, max : 345, step : 15 });
        hatchRot.title = Na__LeCfg__GetLabel('ShapeHatchRotationTitle', 'Turns the whole tiled field, not each mark.');
        const hatchRotRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatchRotation', 'Pattern deg'), hatchRot);
        hatchRotRow.setAttribute('data-na-block', 'shape-hatch-rotation-row');
        body.appendChild(hatchRotRow);
        // THE HATCH'S OWN LINE WEIGHT AND LINE COLOUR. Adam: 'A line thickness
        // control for the pattern. A line colour for the pattern ... Pull the
        // standard ones in for when you first load that, but then have controls
        // to be able to modify it.' Both boxes always show what the hatch is
        // DRAWN with - the pattern's standard until one is set, the set value
        // after - and Standard, which only shows once one is set, puts both
        // back. The weight is printed points, like Edge pt above it.
        const hatchPt = Na__LePanels__Input('number', 'shape-hatch-pt', { min : lw.minPt, max : lw.maxPt, step : lw.stepPt });
        hatchPt.title = Na__LeCfg__GetLabel('ShapeHatchPtTitle', "The printed weight of the pattern's lines, in points. It starts at the pattern's standard, which grows with the pattern scale; a weight typed here stays as typed at any scale. Empty the box to go back to the standard.");
        const hatchPtRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatchPt', 'Pattern line pt'), hatchPt);
        hatchPtRow.setAttribute('data-na-block', 'shape-hatch-pt-row');
        body.appendChild(hatchPtRow);
        const hatchColour = Na__LePanels__Input('color', 'shape-hatch-colour');
        hatchColour.title = Na__LeCfg__GetLabel('ShapeHatchColourTitle', "The colour of the pattern's lines. It starts at the pattern's standard: its own ink if it has one, else this shape's edge colour.");
        const hatchColourRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShapeHatchColour', 'Pattern colour'), hatchColour);
        hatchColourRow.setAttribute('data-na-block', 'shape-hatch-colour-row');
        body.appendChild(hatchColourRow);
        const hatchStandard = document.createElement('div');
        hatchStandard.className = 'na-le-bar';
        hatchStandard.setAttribute('data-na-block', 'shape-hatch-standard-row');
        const hatchStandardBtn = Na__LePanels__Button(Na__LeCfg__GetLabel('ShapeHatchStandard', 'Standard line and colour'), 'shape-hatch-standard');
        hatchStandardBtn.title = Na__LeCfg__GetLabel('ShapeHatchStandardTitle', "Put the pattern's line weight and colour back to its standard.");
        hatchStandard.appendChild(hatchStandardBtn);
        body.appendChild(hatchStandard);
        const hatchNote = Na__LePanels__Note('');
        hatchNote.setAttribute('data-na-block', 'shape-hatch-note');
        body.appendChild(hatchNote);
        const either = Na__LePanels__Note(Na__LeCfg__GetLabel('ShapeEitherNote', 'Edges and fill are either or: switching one off switches the other on, so a shape always shows.'));
        either.setAttribute('data-na-block', 'either');
        body.appendChild(either);
        // THE DRAW AND AXIS INSTRUCTIONS ARE NOT PRINTED HERE ANY MORE. Two
        // paragraphs of prose pushed the actual controls off the top of a
        // short panel, and they are reference material read once - they live
        // in the labels config (ShapeDrawNote, ShapeAxisNote) and in the
        // module headers, where they can be read without costing panel height
        // on every session.
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Gradient in Play: the Selected Shape's, or the Defaults'
    // ------------------------------------------------------------
    // Returns { on, gradient }. gradient is a record even while on is false - the
    // defaults keep their settings through the toggle - so switching a shape's
    // gradient on starts from the last settings used rather than from scratch.
    // ------------------------------------------------------------
    function Na__LePanelShapes__Gradient() {
        const selected = Na__LePanelShapes__Reading();
        const d = Na__LeTools__GetShapeDefaults();
        if (selected) return { on : !!selected.item.Shape__Gradient, gradient : selected.item.Shape__Gradient || d.gradient };
        return { on : d.gradientOn === true, gradient : d.gradient };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Hatch in Play: the Selected Shape's, or the Defaults'
    // ------------------------------------------------------------
    // Returns { on, hatch }. hatch is a record even while on is false - the
    // defaults keep their settings through the toggle - so switching a shape's
    // hatch back on restores the pattern it had rather than starting blank.
    //
    // A SHAPE'S HATCH IS ON WHEN IT NAMES A PATTERN. There is no separate stored
    // flag: the record layer drops Shape__Hatch entirely unless a pattern is
    // named, so "on with nothing chosen" is not a state a saved shape can be in.
    // ------------------------------------------------------------
    function Na__LePanelShapes__Hatch() {
        const selected = Na__LePanelShapes__Reading();
        const d = Na__LeTools__GetShapeDefaults();
        const fallback = d.hatch || { Hatch__PatternKey : '', Hatch__Scale : 1, Hatch__RotationDeg : 0 };
        if (selected) return { on : !!selected.item.Shape__Hatch, hatch : selected.item.Shape__Hatch || fallback };
        return { on : d.hatchOn === true, hatch : fallback };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One Field of the Hatch, Merged
    // ------------------------------------------------------------
    function Na__LePanelShapes__ApplyHatch(changes) {
        const now  = Na__LePanelShapes__Hatch().hatch;
        const next = Object.assign({}, now, changes);
        Na__LePanelShapes__Apply({ hatch : next }, { hatchOn : !!next.Hatch__PatternKey, hatch : next });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dashed Edge in Play: the Selected Shape's, or the Defaults'
    // ------------------------------------------------------------
    // Returns { on, style }. style is a record even while on is false - the
    // defaults keep their settings through the toggle - so switching a shape's
    // dashed edges on starts from the last settings used rather than from scratch.
    // ------------------------------------------------------------
    function Na__LePanelShapes__Dash() {
        const selected = Na__LePanelShapes__Reading();
        const d = Na__LeTools__GetShapeDefaults();
        if (selected) return { on : !!selected.item.Shape__LineStyle, style : selected.item.Shape__LineStyle || d.dash };
        return { on : d.dashOn === true, style : d.dash };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelShapes__Refresh(body) {
        const selected = Na__LePanelShapes__Selected();
        const many     = selected ? null : Na__LePanelShapes__Many();
        const reading  = selected || many;                                      // <-- One selected, or the first of several
        const d = Na__LeTools__GetShapeDefaults();
        const values = reading
            ? { strokeColour : reading.item.Shape__StrokeColour, strokePt : reading.item.Shape__StrokePt, stroked : reading.item.Shape__Stroked !== false, filled : !!reading.item.Shape__FillColour, fillColour : reading.item.Shape__FillColour || d.fillColour, closed : reading.item.Shape__Closed === true }
            : { strokeColour : d.strokeColour, strokePt : d.strokePt, stroked : d.stroked !== false, filled : d.filled === true, fillColour : d.fillColour, closed : false };
        const canFill = !reading || reading.item.Shape__Points.length > 2;     // <-- A two-point line encloses nothing, so its edges have to stay
        const el  = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const set = (name, value) => { const e = el(name); if (e && document.activeElement !== e) e.value = String(value); };
        const hex = (value, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(value)) ? value : fallback);
        set('shape-stroke', hex(values.strokeColour, '#172b3a'));
        set('shape-pt', values.strokePt);
        set('shape-fill', hex(values.fillColour, '#e4e8ec'));
        el('shape-at-scale').checked = d.atScale !== false;                  // <-- The drawing tools' setting, never the selected shape's
        el('shape-at-scale').parentNode.querySelector('.na-le-row__label').textContent = Na__LePanelShapes__AtScaleCaption();
        el('shape-stroked').checked = values.stroked;
        el('shape-filled').checked = values.filled;
        el('shape-closed').checked = values.closed;
        el('shape-closed').parentNode.hidden  = !selected;

        // THE HATCH BLOCK. A hatch needs an enclosed shape, so it follows the
        // same canFill rule the solid fill does - a two-point line has nothing
        // to hatch. Its three controls are only there once the toggle is on.
        const hatchState = Na__LePanelShapes__Hatch();
        const hatchOn    = hatchState.on && canFill;
        el('shape-hatch-on').checked = hatchOn;
        el('shape-hatch-on').parentNode.hidden = !canFill;
        [ 'shape-hatch-pattern-row', 'shape-hatch-scale-row', 'shape-hatch-rotation-row', 'shape-hatch-pt-row', 'shape-hatch-colour-row', 'shape-hatch-standard-row' ]
            .forEach((block) => { const row = body.querySelector('[data-na-block="' + block + '"]'); if (row) row.hidden = !hatchOn; });

        const hatchNote = body.querySelector('[data-na-block="shape-hatch-note"]');
        if (hatchNote) {
            const missing = hatchOn && hatchState.hatch.Hatch__PatternKey && !Na__LeHatch__Get(hatchState.hatch.Hatch__PatternKey);
            hatchNote.textContent = missing
                ? Na__LeCfg__GetLabel('ShapeHatchMissing', 'This shape names a pattern the library has not got. Its fill and outline are unchanged; choose another pattern to replace it.')
                : '';
            hatchNote.hidden = !hatchNote.textContent;
        }

        if (hatchOn) {
            const options = [ { value : '', label : Na__LeCfg__GetLabel('ShapeHatchNone', 'None') } ];
            Na__LeHatch__GetPacks().forEach((pack) => {
                pack.Pack__Patterns.forEach((pattern) => options.push({ value : pattern.Pattern__Key, label : pattern.Pattern__Label + '  (' + pack.Pack__Label + ')' }));
            });
            Na__LePanels__FillSelect(el('shape-hatch-pattern'), options, hatchState.hatch.Hatch__PatternKey || '');
            set('shape-hatch-scale',    Number.isFinite(hatchState.hatch.Hatch__Scale) ? hatchState.hatch.Hatch__Scale : 1);
            set('shape-hatch-rotation', Number.isFinite(hatchState.hatch.Hatch__RotationDeg) ? hatchState.hatch.Hatch__RotationDeg : 0);
            // WHAT THE HATCH IS DRAWN WITH: its own weight and colour once set,
            // the pattern's standard until then - the standard weight quoted at
            // the scale in use, the standard colour against THIS shape's edges.
            const hatchPattern  = Na__LeHatch__Get(hatchState.hatch.Hatch__PatternKey);
            const ownPt         = Na__LeHatch__ClampStrokePt(hatchState.hatch.Hatch__StrokePt);
            const ownColour     = Na__LeHatch__CleanColour(hatchState.hatch.Hatch__Colour);
            const standardPt    = Na__LeHatch__StandardStrokePt(hatchPattern, hatchState.hatch.Hatch__Scale);
            set('shape-hatch-pt',     ownPt !== null ? ownPt : (standardPt !== null ? standardPt : ''));
            set('shape-hatch-colour', hex(ownColour || Na__LeHatch__StandardColour(hatchPattern, values.strokeColour), '#172b3a'));
            const standardRow = body.querySelector('[data-na-block="shape-hatch-standard-row"]');
            if (standardRow) standardRow.hidden = (ownPt === null && !ownColour);   // <-- Nothing set, nothing to put back
        }
        el('shape-stroked').parentNode.hidden = !canFill;
        el('shape-filled').parentNode.hidden  = !canFill;
        el('shape-stroke').parentNode.hidden  = !values.stroked;
        el('shape-pt').parentNode.hidden      = !values.stroked;
        el('shape-fill').parentNode.hidden    = !values.filled;
        // OPACITY | A slider for the fill while there is one; the edges' only once Transparent edges is ticked
        const fillOpacity = reading ? reading.item.Shape__FillOpacity   : d.fillOpacity;
        const edgeOpacity = reading ? reading.item.Shape__StrokeOpacity : d.strokeOpacity;
        const percent     = (value) => Math.round((Number.isFinite(value) ? value : 1) * 100);
        const clearEdges  = Number.isFinite(edgeOpacity) && edgeOpacity < 1;
        el('shape-edge-transparent').checked           = clearEdges;
        el('shape-edge-transparent').parentNode.hidden = !values.stroked;
        el('shape-edge-opacity').parentNode.hidden     = !values.stroked || !clearEdges;
        el('shape-fill-opacity').parentNode.hidden     = !values.filled;
        Na__LePanels__ShowSlider(body, 'shape-fill-opacity', percent(fillOpacity), percent(fillOpacity) + '%');
        Na__LePanels__ShowSlider(body, 'shape-edge-opacity', percent(edgeOpacity), percent(edgeOpacity) + '%');
        Na__LeDash__RefreshRows(body, Object.assign({ stroked : values.stroked }, Na__LePanelShapes__Dash()));
        Na__LeGrad__RefreshRows(body, Object.assign({ canFill : canFill }, Na__LePanelShapes__Gradient()));
        body.querySelector('[data-na-block="either"]').hidden = !canFill;
        const picked = Na__LeModel__GetSelectionItems().length;
        body.querySelector('[data-na-block="note"]').textContent = selected
            ? Na__LeCfg__GetLabel('ShapeSelectedNote', 'Editing the selected shape.')
            : (many
                ? Na__LeCfg__FormatLabel('ShapeManyNote', 'Editing {count} selected vectors: a change here goes to all of them.', { count : many.count })
                : (picked > 1
                    ? Na__LeCfg__GetLabel('ShapeNoneOfKindNote', 'Nothing selected is a vector: these settings apply to new shapes.')
                    : Na__LeCfg__GetLabel('ShapeDefaultsNote', 'Nothing selected: these settings apply to new shapes.')));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fill Colour a Shape Would Take, Selected or Not
    // ------------------------------------------------------------
    function Na__LePanelShapes__FillColour() {
        const selected = Na__LePanelShapes__Selected();
        if (selected && selected.item.Shape__FillColour) return selected.item.Shape__FillColour;
        return Na__LeTools__GetShapeDefaults().fillColour;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change to the Selection or the Defaults
    // ------------------------------------------------------------
    function Na__LePanelShapes__Apply(patch, defaultsPatch) {
        const selected = Na__LePanelShapes__Selected();
        if (selected) { Na__LeModel__UpdateShape(selected.sheet, selected.item.Shape__Id, patch); return; }   // <-- The model announces, and the panel refreshes with it
        if (Na__LePanels__ApplyToSelection(Na__LeModel__GetActiveSheet(), 'shape', patch)) return;   // <-- Several selected: the style traits go to every one of them
        if (!defaultsPatch) return;
        Na__LeTools__SetShapeDefaults(defaultsPatch);
        Na__LePanels__Refresh(Na__LePanelShapes__ID);                        // <-- Nothing announces a defaults change, so show it here
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply a Change Silently While a Slider Is Moving
    // ------------------------------------------------------------
    // The selected shape is updated without an announcement and only the markup
    // is redrawn, so the history does not take a step for every pixel of drag.
    // The release sends the same change through Apply, which announces it once,
    // and the whole drag becomes one undo step.
    // ------------------------------------------------------------
    function Na__LePanelShapes__ApplyLive(patch, defaultsPatch) {
        const selected = Na__LePanelShapes__Selected();
        if (selected) { Na__LeModel__UpdateShape(selected.sheet, selected.item.Shape__Id, patch, true); Na__LeSurface__Refresh('markup'); return; }
        if (defaultsPatch) Na__LeTools__SetShapeDefaults(defaultsPatch);        // <-- Nothing on the paper to redraw; the preview swatch already shows it
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Switch the Gradient On or Off
    // ------------------------------------------------------------
    // On: the gradient is the fill now, so a solid fill steps aside. Off: if no
    // solid fill is left either, the edges come back, exactly as they do when
    // the fill is switched off - a shape is never left with nothing to show.
    // ------------------------------------------------------------
    function Na__LePanelShapes__ToggleGradient(on, gradient) {
        if (on) { Na__LePanelShapes__Apply({ gradient : gradient, fillColour : null }, { gradientOn : true, gradient : gradient, filled : false }); return; }
        const selected  = Na__LePanelShapes__Selected();
        const keepsFill = selected ? !!selected.item.Shape__FillColour : Na__LeTools__GetShapeDefaults().filled === true;
        if (keepsFill) { Na__LePanelShapes__Apply({ gradient : null }, { gradientOn : false }); return; }
        Na__LePanelShapes__Apply({ gradient : null, stroked : true }, { gradientOn : false, stroked : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelShapes__Register() {
        Na__LePanels__OnControl('change', 'shape-stroke', (e, el) => Na__LePanelShapes__Apply({ strokeColour : el.value }, { strokeColour : el.value }));
        Na__LePanels__OnControl('change', 'shape-pt',     (e, el) => { const v = parseFloat(el.value); if (Number.isFinite(v)) Na__LePanelShapes__Apply({ strokePt : v }, { strokePt : v }); });
        Na__LePanels__OnControl('change', 'shape-fill',   (e, el) => Na__LePanelShapes__Apply({ fillColour : el.value }, { fillColour : el.value }));
        Na__LePanels__OnControl('change', 'shape-filled', (e, el) => {
            const colour = Na__LePanelShapes__FillColour();
            if (el.checked) { Na__LePanelShapes__Apply({ fillColour : colour, gradient : null }, { filled : true, gradientOn : false }); return; }   // <-- A solid fill replaces a gradient
            if (Na__LePanelShapes__Gradient().on) { Na__LePanelShapes__Apply({ fillColour : null }, { filled : false }); return; }                 // <-- A gradient still fills it
            Na__LePanelShapes__Apply({ fillColour : null, stroked : true }, { filled : false, stroked : true });   // <-- No fill left, so the edges come back
        });
        Na__LePanels__OnControl('change', 'shape-stroked', (e, el) => {
            if (el.checked) { Na__LePanelShapes__Apply({ stroked : true }, { stroked : true }); return; }
            if (Na__LePanelShapes__Gradient().on) { Na__LePanelShapes__Apply({ stroked : false }, { stroked : false }); return; }   // <-- The gradient is the fill: a gradient alone is the fade
            // SEVERAL SELECTED: the edges come off and nothing else changes. The
            // fill written below is ONE colour - the new-shape default, as no one
            // shape speaks for the rest - so it used to repaint every selected
            // shape in it, a plan's coloured rooms included. A shape with no fill
            // of its own keeps its edges instead: the normaliser never lets one
            // go invisible.
            if (!Na__LePanelShapes__Selected() && Na__LePanels__ApplyToSelection(Na__LeModel__GetActiveSheet(), 'shape', { stroked : false })) return;
            const colour = Na__LePanelShapes__FillColour();
            Na__LePanelShapes__Apply({ stroked : false, fillColour : colour }, { stroked : false, filled : true, fillColour : colour });   // <-- No edges left, so the fill comes on
        });
        Na__LePanels__OnControl('change', 'shape-closed', (e, el) => Na__LePanelShapes__Apply({ closed : el.checked }, null));
        // THE HATCH. Switching it on with nothing chosen yet picks the first
        // pattern in the library, because an empty dropdown under a ticked box
        // reads as broken; switching it off clears the record entirely.
        Na__LePanels__OnControl('change', 'shape-hatch-on', (e, el) => {
            if (!el.checked) { Na__LePanelShapes__Apply({ hatch : null }, { hatchOn : false }); return; }
            const now = Na__LePanelShapes__Hatch().hatch;
            let key = now.Hatch__PatternKey;
            if (!key || !Na__LeHatch__Get(key)) {
                const packs = Na__LeHatch__GetPacks();
                const first = packs.length && packs[0].Pack__Patterns.length ? packs[0].Pack__Patterns[0] : null;
                key = first ? first.Pattern__Key : '';
            }
            if (!key) { Na__LePanels__Refresh(Na__LePanelShapes__ID); return; }   // <-- An empty library: nothing to switch on
            Na__LePanelShapes__ApplyHatch({ Hatch__PatternKey : key });
        });
        // ANOTHER PATTERN BRINGS ITS OWN STANDARDS IN. A line weight set for brick
        // diagonals is the wrong weight for a concrete stipple, so choosing a
        // pattern clears the weight and colour set on the last one ('Pull the
        // standard ones in for when you first load that'). Scale and rotation
        // stay: they are how the hatch sits on THIS shape, not how it is drawn.
        Na__LePanels__OnControl('change', 'shape-hatch-pattern', (e, el) => {
            if (!el.value) { Na__LePanelShapes__Apply({ hatch : null }, { hatchOn : false }); return; }
            Na__LePanelShapes__ApplyHatch({ Hatch__PatternKey : el.value, Hatch__StrokePt : null, Hatch__Colour : null });
        });
        // THE HATCH'S OWN LINE WEIGHT AND COLOUR. An emptied weight box clamps to
        // null, which the record layer drops - so it goes back to the standard
        // rather than to a weight of nothing. A typed weight is held to the
        // editor's lineweight range, the one Edge pt works in.
        Na__LePanels__OnControl('change', 'shape-hatch-pt', (e, el) => {
            const lw = Na__LeCfg__GetLineweightSetup();
            const pt = Na__LeHatch__ClampStrokePt(el.value);
            Na__LePanelShapes__ApplyHatch({ Hatch__StrokePt : pt === null ? null : Math.min(lw.maxPt, Math.max(lw.minPt, pt)) });
        });
        Na__LePanels__OnControl('change', 'shape-hatch-colour', (e, el) => {
            Na__LePanelShapes__ApplyHatch({ Hatch__Colour : Na__LeHatch__CleanColour(el.value) });
        });
        Na__LePanels__OnControl('click', 'shape-hatch-standard', () => {
            Na__LePanelShapes__ApplyHatch({ Hatch__StrokePt : null, Hatch__Colour : null });
        });
        Na__LePanels__OnControl('change', 'shape-hatch-scale', (e, el) => {
            const pattern = Na__LeHatch__Get(Na__LePanelShapes__Hatch().hatch.Hatch__PatternKey);
            Na__LePanelShapes__ApplyHatch({ Hatch__Scale : Na__LeHatch__ClampScale(pattern, el.value) });
        });
        Na__LePanels__OnControl('change', 'shape-hatch-rotation', (e, el) => {
            Na__LePanelShapes__ApplyHatch({ Hatch__RotationDeg : Na__LeHatch__ClampRotation(el.value) });
        });
        const hatchCommit = (event, el) => { if (event.key === 'Enter') { event.preventDefault(); el.blur(); } };
        Na__LePanels__OnControl('keydown', 'shape-hatch-scale',    hatchCommit);
        Na__LePanels__OnControl('keydown', 'shape-hatch-rotation', hatchCommit);
        Na__LePanels__OnControl('keydown', 'shape-hatch-pt',       hatchCommit);

        // DRAW AT SCALE | A setting of the drawing tools, so it goes to the defaults
        // even with a shape selected, and the Measurements box reads it at once
        Na__LePanels__OnControl('change', 'shape-at-scale', (e, el) => {
            Na__LeTools__SetShapeDefaults({ atScale : el.checked });
            Na__LePanels__Refresh(Na__LePanelShapes__ID);
            Na__LeMeasure__Refresh();
        });

        // OPACITY | Transparent edges starts the edges at the configured see-through
        // and makes them solid again when unticked; the sliders are live while
        // they move and announce once on release.
        Na__LePanels__OnControl('change', 'shape-edge-transparent', (e, el) => {
            const value = el.checked ? Na__LeCfg__GetShapeSetup().transparentEdgeOpacity : 1;
            Na__LePanelShapes__Apply({ strokeOpacity : value }, { strokeOpacity : value });
        });
        [ [ 'shape-fill-opacity', 'fillOpacity' ], [ 'shape-edge-opacity', 'strokeOpacity' ] ].forEach((pair) => {
            const patchFor = (el) => {
                const value = parseFloat(el.value) / 100;
                if (!Number.isFinite(value)) return null;
                const patch = {};
                patch[pair[1]] = value;
                return patch;
            };
            Na__LePanels__OnControl('input', pair[0], (e, el) => {
                const patch = patchFor(el);
                if (!patch) return;
                const reading = el.parentNode ? el.parentNode.querySelector('[data-na-reading]') : null;
                if (reading) reading.textContent = Math.round(parseFloat(el.value)) + '%';
                Na__LePanelShapes__ApplyLive(patch, Object.assign({}, patch));
            });
            Na__LePanels__OnControl('change', pair[0], (e, el) => {
                const patch = patchFor(el);
                if (patch) Na__LePanelShapes__Apply(patch, Object.assign({}, patch));
            });
        });
        Na__LeDash__RegisterControls({
            read   : Na__LePanelShapes__Dash,
            toggle : (on, style) => Na__LePanelShapes__Apply({ dash : on ? style : null }, { dashOn : on === true, dash : style }),
            write  : (style, live) => (live ? Na__LePanelShapes__ApplyLive : Na__LePanelShapes__Apply)({ dash : style }, { dash : style })
        });
        Na__LeGrad__RegisterControls({
            read   : Na__LePanelShapes__Gradient,
            toggle : Na__LePanelShapes__ToggleGradient,
            write  : (gradient, live) => (live ? Na__LePanelShapes__ApplyLive : Na__LePanelShapes__Apply)({ gradient : gradient }, { gradient : gradient })
        });
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelShapes__ID, title : Na__LeCfg__GetLabel('ShapesTitle', 'Vectors'),
            build : Na__LePanelShapes__Build, refresh : Na__LePanelShapes__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Vectors Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelShapes__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
