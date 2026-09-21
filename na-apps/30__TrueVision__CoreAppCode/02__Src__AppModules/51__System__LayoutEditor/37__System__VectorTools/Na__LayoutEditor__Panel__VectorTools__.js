// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL - VECTOR TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__VectorTools__.js
// NAMESPACE  : Na__LePanelVec
// MODULE     : Layout Editor - Panel - Vector Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Vector Tools section under Vectors: every vector tool as a button, what the one that is up wants next, and its settings
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHERE ADAM DREW IT: the space under the Vectors settings in the right-hand
//   Properties column (his marked-up screenshot, 21-Sep-2026). It is a section
//   of its own, straight after Vectors, rather than rows at the foot of it,
//   because Vectors folds away whenever text or a dimension is selected and a
//   palette of tools must not fold away with it. It is not in the accordion
//   group, so no selection ever closes it.
// - THE TOOLS. Draw: Line, Rectangle, Circle, Arc - the two the editor had and
//   the two that are new, together because that is how they are reached for.
//   Edit: Trim, Extend, Join, Split, Offset, Fillet, Chamfer. The one that is
//   up is lit, exactly as its toolbar button is, and every button's tooltip is
//   its whole instruction, key included - so the panel itself carries no
//   paragraphs (the Vectors panel took its own out for the same reason).
// - ONE LINE SAYS WHAT THE TOOL WANTS NEXT ("Arc: click where it ends."). It
//   comes from the tool (Na__LeVec__GetHint) and changes as the clicks land.
// - ONLY THE SETTINGS THAT MATTER NOW ARE SHOWN: the count of sides for Circle
//   and Arc, the way of drawing for Arc, Stop at the drawing's linework for
//   Trim and Extend, Bridge ends for Join, and the size for Offset, Fillet or
//   Chamfer - which is the same figure the Measurements box types into, shown
//   as it was typed. With no vector tool up there are none, and the section is
//   two rows of buttons.
// - A SELECTED CIRCLE OR ARC CAN BE RESIZED HERE. Its radius and its count of
//   sides are read back from its points (Na__LeVecCurve__Describe) at the
//   scale the Measurements box works at, and changing either redraws it about
//   the same centre - an arc between the same two angles.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__ModeController__ straight after the
//   Vectors panel. Picks tools up through Na__LayoutEditor__SheetTools__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scale, Tools, Panel Host and the Vector Tools' Units
    // ------------------------------------------------------------
    import { Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection, Na__LeModel__UpdateShape, Na__LeModel__IsLayerLocked } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__DenominatorAt } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeTools__CHANGED_EVENT, Na__LeTools__SetTool, Na__LeTools__GetTool, Na__LeTools__GetShapeDefaults } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeVec__TOOL_CIRCLE,
        Na__LeVec__TOOL_ARC,
        Na__LeVec__TOOL_TRIM,
        Na__LeVec__TOOL_EXTEND,
        Na__LeVec__TOOL_JOIN,
        Na__LeVec__TOOL_SPLIT,
        Na__LeVec__TOOL_OFFSET,
        Na__LeVec__TOOL_FILLET,
        Na__LeVec__TOOL_CHAMFER,
        Na__LeVec__ARC_MODES,
        Na__LeVec__SETTINGS_EVENT,
        Na__LeVec__HINT_EVENT,
        Na__LeVec__GetSettings,
        Na__LeVec__SetSettings,
        Na__LeVec__GetHint
    } from './Na__LayoutEditor__VectorTools__State__.js';
    import { Na__LeVecCfg__Label, Na__LeVecCfg__Ready } from './Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeVecCurve__KIND_CIRCLE, Na__LeVecCurve__CirclePoints, Na__LeVecCurve__ArcPoints, Na__LeVecCurve__Describe } from './Na__LayoutEditor__VectorTools__Curves__.js';
    import { Na__LeVecSize__WholeSides, Na__LeVecSize__ArcSides } from './Na__LayoutEditor__VectorTools__OffsetTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section, and the Tools in the Order They Are Shown
    // ------------------------------------------------------------
    // 'draw' and 'rectangle' are the sheet tools' own names for the two drawing
    // tools the editor already had; they sit beside Circle and Arc here.
    // ------------------------------------------------------------
    const Na__LePanelVec__ID   = 'vector-tools';
    const Na__LePanelVec__DRAW = [ [ 'draw', 'ToolDraw', 'Line' ], [ 'rectangle', 'ToolRectangle', 'Rectangle' ], [ Na__LeVec__TOOL_CIRCLE, 'ToolCircle', 'Circle' ], [ Na__LeVec__TOOL_ARC, 'ToolArc', 'Arc' ] ];
    const Na__LePanelVec__EDIT = [ [ Na__LeVec__TOOL_TRIM, 'ToolTrim', 'Trim' ], [ Na__LeVec__TOOL_EXTEND, 'ToolExtend', 'Extend' ], [ Na__LeVec__TOOL_JOIN, 'ToolJoin', 'Join' ], [ Na__LeVec__TOOL_SPLIT, 'ToolSplit', 'Split' ],
                                   [ Na__LeVec__TOOL_OFFSET, 'ToolOffset', 'Offset' ], [ Na__LeVec__TOOL_FILLET, 'ToolFillet', 'Fillet' ], [ Na__LeVec__TOOL_CHAMFER, 'ToolChamfer', 'Chamfer' ] ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | Wired Once a Session
    // ------------------------------------------------------------
    let Na__LePanelVec__Wired = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Row of Tool Buttons Under a Subhead
    // ------------------------------------------------------------
    function Na__LePanelVec__ToolRow(body, headingKey, headingFallback, tools) {
        const heading = Na__LePanels__Note(Na__LeVecCfg__Label(headingKey, headingFallback));
        heading.className += ' na-le-note--heading';
        heading.setAttribute('data-na-block', 'vec-heading-' + headingKey);
        body.appendChild(heading);
        const row = document.createElement('div');
        row.className = 'na-le-vectools__row';
        tools.forEach((entry) => {
            const button = document.createElement('button');
            button.type      = 'button';
            button.className = 'na-le-btn na-le-vectools__btn';
            button.setAttribute('data-na-control', 'vec-tool');
            button.setAttribute('data-na-role', entry[0]);
            button.setAttribute('data-na-label', entry[1]);
            button.textContent = Na__LeVecCfg__Label(entry[1], entry[2]);
            button.title       = Na__LeVecCfg__Label(entry[1] + 'Title', entry[2]);
            if (!Na__LePanels__IsEditable()) button.disabled = true;
            row.appendChild(button);
        });
        body.appendChild(row);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Settings Row That Is Shown Only for the Tools It Matters To
    // ------------------------------------------------------------
    function Na__LePanelVec__OptionRow(body, block, labelKey, labelFallback, control, titleKey, titleFallback, className) {
        const row = Na__LePanels__Row(Na__LeVecCfg__Label(labelKey, labelFallback), control, className);
        row.setAttribute('data-na-block', block);
        if (titleKey) row.title = Na__LeVecCfg__Label(titleKey, titleFallback);
        row.hidden = true;
        body.appendChild(row);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelVec__Build(body) {
        body.classList.add('na-le-vectools');
        Na__LePanelVec__ToolRow(body, 'GroupDraw', 'Draw', Na__LePanelVec__DRAW);
        Na__LePanelVec__ToolRow(body, 'GroupEdit', 'Edit', Na__LePanelVec__EDIT);

        const hint = Na__LePanels__Note('');
        hint.className += ' na-le-vectools__hint';
        hint.setAttribute('data-na-block', 'vec-hint');
        hint.setAttribute('aria-live', 'polite');
        hint.hidden = true;
        body.appendChild(hint);

        const sizeTitle = [ 'OptionSizeTitle', 'As typed into the Measurements box: real millimetres at the drawing\'s scale while Draw at scale is ticked, paper millimetres while it is not.' ];
        Na__LePanelVec__OptionRow(body, 'vec-arc-mode', 'OptionArcMode', 'Arc drawn by',
            Na__LePanels__Select('vec-arc-mode', Na__LeVec__ARC_MODES.map((mode) => ({ value : mode, label : Na__LeVecCfg__Label('ArcMode_' + mode, mode) })), Na__LeVec__GetSettings().arcMode));
        Na__LePanelVec__OptionRow(body, 'vec-segments', 'OptionSegments', 'Circle sides',
            Na__LePanels__Input('number', 'vec-segments', { min : 0, max : 720, step : 1, placeholder : Na__LeVecCfg__Label('OptionSegmentsAuto', 'Auto (smooth)') }),
            'OptionSegmentsTitle', 'How many straight edges a circle or an arc is drawn with. Auto gives as many as its size on paper needs to print as a true curve. A number draws exactly that many, so 6 is a hexagon; typing 6s while drawing sets it too.');
        Na__LePanelVec__OptionRow(body, 'vec-cut-drawing', 'OptionCutToDrawing', 'Stop at the drawing\'s linework', Na__LePanels__Input('checkbox', 'vec-cut-drawing'),
            'OptionCutToDrawingTitle', 'On: Trim and Extend stop at the lines of the drawings under the sheet as well as at the sheet\'s own vectors. Off: only vectors cut vectors, as in LayOut.', 'na-le-row--toggle');
        Na__LePanelVec__OptionRow(body, 'vec-join-bridges', 'OptionJoinBridges', 'Bridge ends that do not meet', Na__LePanels__Input('checkbox', 'vec-join-bridges'),
            'OptionJoinBridgesTitle', 'On: Join links the two nearest ends with a straight edge however far apart they are. Off: ends must meet, as in LayOut.', 'na-le-row--toggle');
        Na__LePanelVec__OptionRow(body, 'vec-offset',  'OptionOffset',  'Offset by',        Na__LePanels__Input('number', 'vec-offset',  { min : 0, step : 'any' }), sizeTitle[0], sizeTitle[1]);
        Na__LePanelVec__OptionRow(body, 'vec-fillet',  'OptionFillet',  'Fillet radius',    Na__LePanels__Input('number', 'vec-fillet',  { min : 0, step : 'any' }), sizeTitle[0], sizeTitle[1]);
        Na__LePanelVec__OptionRow(body, 'vec-chamfer', 'OptionChamfer', 'Chamfer distance', Na__LePanels__Input('number', 'vec-chamfer', { min : 0, step : 'any' }), sizeTitle[0], sizeTitle[1]);

        // THE SELECTED CURVE | Its own subhead and two figures, shown only while
        // a circle or an arc the tools drew is selected and still reads as one.
        const curveHead = Na__LePanels__Note('');
        curveHead.className += ' na-le-note--heading';
        curveHead.setAttribute('data-na-block', 'vec-curve-heading');
        curveHead.hidden = true;
        body.appendChild(curveHead);
        Na__LePanelVec__OptionRow(body, 'vec-curve-radius', 'CurveRadius', 'Radius', Na__LePanels__Input('number', 'vec-curve-radius', { min : 0, step : 'any' }),
            'CurveRadiusTitle', 'The radius of the selected circle or arc, at the scale the Measurements box is working at. Change it and the curve is redrawn about the same centre.');
        Na__LePanelVec__OptionRow(body, 'vec-curve-sides', 'CurveSides', 'Sides', Na__LePanels__Input('number', 'vec-curve-sides', { min : 0, max : 720, step : 1 }),
            'CurveSidesTitle', 'How many edges the selected curve is drawn with. 0 gives it as many as its size needs.');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Refreshing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Selected Curve, Read Back From Its Points, or Null
    // ------------------------------------------------------------
    // Returns { sheet, shape, read, denominator }. Only a shape carrying the
    // tools' hint is looked at, and only while its points still lie on one
    // circle; a locked layer's is shown but cannot be changed.
    // ------------------------------------------------------------
    function Na__LePanelVec__SelectedCurve() {
        const sheet     = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'shape') return null;
        const shape = (sheet.Sheet__Shapes || []).find((s) => s.Shape__Id === selection.id) || null;
        if (!shape || !shape.Shape__Curve) return null;
        const read = Na__LeVecCurve__Describe(shape.Shape__Points, shape.Shape__Closed === true);
        if (!read) return null;
        const atScale = Na__LeTools__GetShapeDefaults().atScale !== false;
        return { sheet : sheet, shape : shape, read : read, denominator : atScale ? (Na__LeDrawScale__DenominatorAt(sheet, { x : read.cx, y : read.cy }) || 1) : 1 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Figure as a Number Box Shows It (no trailing noise)
    // ------------------------------------------------------------
    function Na__LePanelVec__Figure(value) {
        return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring the Section Up to Date
    // ------------------------------------------------------------
    function Na__LePanelVec__Refresh(body) {
        const tool     = Na__LeTools__GetTool();
        const settings = Na__LeVec__GetSettings();
        const find     = (block) => body.querySelector('[data-na-block="' + block + '"]');
        const set      = (control, value) => { const el = body.querySelector('[data-na-control="' + control + '"]'); if (el && document.activeElement !== el && el.value !== value) el.value = value; };   // <-- A box being typed into is left alone
        const tick     = (control, on) => { const el = body.querySelector('[data-na-control="' + control + '"]'); if (el) el.checked = on === true; };

        body.querySelectorAll('[data-na-control="vec-tool"]').forEach((button) => {
            const active = button.getAttribute('data-na-role') === tool;
            button.classList.toggle('na-le-btn--active', active);
            button.setAttribute('aria-pressed', String(active));
            // THE WORDS ARE RE-READ: the config can land after the section is built.
            const key   = button.getAttribute('data-na-label');
            const words = Na__LeVecCfg__Label(key, button.textContent);
            const title = Na__LeVecCfg__Label(key + 'Title', button.title);
            if (button.textContent !== words) button.textContent = words;
            if (button.title !== title) button.title = title;
        });

        const hint = find('vec-hint');
        const text = Na__LeVec__GetHint();
        if (hint) { hint.hidden = !text; if (hint.textContent !== text) hint.textContent = text; }

        const shows = {
            'vec-arc-mode'     : tool === Na__LeVec__TOOL_ARC,
            'vec-segments'     : tool === Na__LeVec__TOOL_CIRCLE || tool === Na__LeVec__TOOL_ARC || tool === Na__LeVec__TOOL_FILLET,
            'vec-cut-drawing'  : tool === Na__LeVec__TOOL_TRIM || tool === Na__LeVec__TOOL_EXTEND,
            'vec-join-bridges' : tool === Na__LeVec__TOOL_JOIN,
            'vec-offset'       : tool === Na__LeVec__TOOL_OFFSET,
            'vec-fillet'       : tool === Na__LeVec__TOOL_FILLET,
            'vec-chamfer'      : tool === Na__LeVec__TOOL_CHAMFER
        };
        Object.keys(shows).forEach((block) => { const row = find(block); if (row) row.hidden = !shows[block]; });
        set('vec-arc-mode', settings.arcMode);
        set('vec-segments', settings.circleSegments >= 3 ? String(settings.circleSegments) : '');
        tick('vec-cut-drawing', settings.cutToDrawing);
        tick('vec-join-bridges', settings.joinBridges);
        set('vec-offset',  Na__LePanelVec__Figure(settings.offsetDistance));
        set('vec-fillet',  Na__LePanelVec__Figure(settings.filletRadius));
        set('vec-chamfer', Na__LePanelVec__Figure(settings.chamferDistance));

        const curve = Na__LePanelVec__SelectedCurve();
        const head  = find('vec-curve-heading');
        if (head) {
            head.hidden = !curve;
            if (curve) head.textContent = curve.read.kind === Na__LeVecCurve__KIND_CIRCLE ? Na__LeVecCfg__Label('CurveCircle', 'Selected circle') : Na__LeVecCfg__Label('CurveArc', 'Selected arc');
        }
        [ 'vec-curve-radius', 'vec-curve-sides' ].forEach((block) => { const row = find(block); if (row) row.hidden = !curve; });
        if (curve) {
            const locked = Na__LeModel__IsLayerLocked(curve.sheet, curve.shape.Shape__LayerId) || !Na__LePanels__IsEditable();
            set('vec-curve-radius', Na__LePanelVec__Figure(curve.read.r * curve.denominator));
            set('vec-curve-sides', String(curve.read.kind === Na__LeVecCurve__KIND_CIRCLE ? curve.read.segments : curve.read.wholeSegments));
            [ 'vec-curve-radius', 'vec-curve-sides' ].forEach((control) => { const el = body.querySelector('[data-na-control="' + control + '"]'); if (el) el.disabled = locked; });
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Redraw the Selected Curve With a New Radius or Count
    // ------------------------------------------------------------
    // sides is the count a WHOLE circle would have; an arc gets its share. 0,
    // or nothing, is as many as the size needs. One announced update, so one
    // undo step.
    // ------------------------------------------------------------
    function Na__LePanelVec__Redraw(radiusTyped, sidesTyped) {
        const curve = Na__LePanelVec__SelectedCurve();
        if (!curve || Na__LeModel__IsLayerLocked(curve.sheet, curve.shape.Shape__LayerId)) return false;
        const read   = curve.read;
        const radius = (Number.isFinite(radiusTyped) && radiusTyped > 0) ? radiusTyped / curve.denominator : read.r;
        if (!(radius >= 1e-3)) return false;
        const circle = read.kind === Na__LeVecCurve__KIND_CIRCLE;
        let whole = circle ? read.segments : read.wholeSegments;
        if (sidesTyped !== undefined) whole = (Number.isFinite(sidesTyped) && sidesTyped >= 3) ? Math.round(sidesTyped) : 0;
        else if (Number.isFinite(radiusTyped)) whole = 0;                        // <-- A new size: as many as that size needs, unless the panel's own count says otherwise
        let points;
        if (circle) points = Na__LeVecCurve__CirclePoints(read.cx, read.cy, radius, whole >= 3 ? whole : Na__LeVecSize__WholeSides(radius), read.start);
        else {
            const count = whole >= 3 ? Math.max(2, Math.round(whole * (Math.abs(read.sweep) / (Math.PI * 2)))) : Na__LeVecSize__ArcSides(radius, read.sweep);
            points = Na__LeVecCurve__ArcPoints(read.cx, read.cy, radius, read.start, read.sweep, count);
        }
        return Na__LeModel__UpdateShape(curve.sheet, curve.shape.Shape__Id, { points : points });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Section and Its Controls (right column, straight after Vectors)
    // ------------------------------------------------------------
    function Na__LePanelVec__Register() {
        const again = () => Na__LePanels__Refresh(Na__LePanelVec__ID);
        if (!Na__LePanelVec__Wired) {                                           // <-- Once a session, however often the columns are rebuilt: one stylesheet, one set of listeners
            Na__LePanelVec__Wired = true;
            const link = document.createElement('link');
            link.rel  = 'stylesheet';
            link.href = new URL('./Na__LayoutEditor__Styles__VectorTools__.css', import.meta.url).href;
            document.head.appendChild(link);
            // WHAT CHANGES WITHOUT THE SHEET CHANGING: the tool that is up, the
            // settings (a size typed into the Measurements box), what the tool
            // wants next, and the words, once the config has landed.
            [ Na__LeTools__CHANGED_EVENT, Na__LeVec__SETTINGS_EVENT, Na__LeVec__HINT_EVENT ].forEach((name) => window.addEventListener(name, again));
            void Na__LeVecCfg__Ready().then(again);
        }

        const on     = Na__LePanels__OnControl;
        const number = (el) => { const v = parseFloat(el.value); return Number.isFinite(v) ? v : NaN; };

        on('click',  'vec-tool', (event, el, role) => { Na__LeTools__SetTool(role); again(); });
        on('change', 'vec-arc-mode',     (event, el) => { Na__LeVec__SetSettings({ arcMode : el.value }); Na__LeTools__SetTool(Na__LeVec__TOOL_ARC); });   // <-- Picked up again, so an arc half drawn the old way is dropped and the hint is the new way's
        on('change', 'vec-segments',     (event, el) => { Na__LeVec__SetSettings({ circleSegments : number(el) }); });
        on('change', 'vec-cut-drawing',  (event, el) => { Na__LeVec__SetSettings({ cutToDrawing : el.checked }); });
        on('change', 'vec-join-bridges', (event, el) => { Na__LeVec__SetSettings({ joinBridges : el.checked }); });
        on('change', 'vec-offset',       (event, el) => { Na__LeVec__SetSettings({ offsetDistance : number(el) }); });
        on('change', 'vec-fillet',       (event, el) => { Na__LeVec__SetSettings({ filletRadius : number(el) }); });
        on('change', 'vec-chamfer',      (event, el) => { Na__LeVec__SetSettings({ chamferDistance : number(el) }); });
        on('change', 'vec-curve-radius', (event, el) => { Na__LePanelVec__Redraw(number(el), undefined); again(); });
        on('change', 'vec-curve-sides',  (event, el) => { Na__LePanelVec__Redraw(NaN, number(el)); again(); });

        return Na__LePanels__RegisterSection('right', {
            id          : Na__LePanelVec__ID,
            title       : Na__LeVecCfg__Label('PanelTitle', 'Vector Tools'),
            defaultOpen : true,
            build       : Na__LePanelVec__Build,
            refresh     : Na__LePanelVec__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelVec__ID,
        Na__LePanelVec__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
