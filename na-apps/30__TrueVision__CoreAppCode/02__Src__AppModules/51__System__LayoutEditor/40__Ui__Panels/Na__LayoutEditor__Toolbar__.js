// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TOOLBAR
// =============================================================================
//
// FILE       : Na__LayoutEditor__Toolbar__.js
// NAMESPACE  : Na__LeToolbar
// MODULE     : Layout Editor - Toolbar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The strip above the stage: tools, raster, save and Download PDF
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Tool buttons (Select, Text, Dimension) and Save exist only when the
//   session can edit; the Raster list and Download PDF are for everyone, so
//   a web viewer can read a sheet and take the PDF away.
// - Undo, Redo, Zoom to Fit and the zoom readout have no buttons here: they
//   are keys (Ctrl+Z, Ctrl+Y, and the key map's zoom bindings), and Zoom to
//   fit is on the right-click menu as well.
//
// INTEGRATION:
// - Mounted by the mode controller into the centre column.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Toolbar__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.22.0
// - Axes: a toggle after Ortho switches the Drawing Axes Overlay (F9,
//   Na__LayoutEditor__DrawingAxes__) - SketchUp's red and green axes carried
//   by the cursor out to the edges of the sheet - in the same plain button as
//   Grid and Ortho, lit while it is on. Adam had its words shortened from the
//   feature's full name, which made it the widest button on the strip; the
//   full name opens its hover text. Both come from the axes config and are
//   re-read on every sync; the toolbar re-syncs on Na__LeAxes__CHANGED_EVENT,
//   listened for on a line of its own.
//
// 21-Sep-2026 - Version 1.21.0
// - Circle and Arc buttons, straight after Rectangle (37__System__VectorTools).
//   They draw, so they sit with the tools that draw; Trim, Extend, Join, Split,
//   Offset, Fillet and Chamfer are in the Vector Tools panel, on their keys and
//   on a vector's right-click menu, and take no room here.
//
// 21-Sep-2026 - Version 1.20.0
// - The Snap button grew an ARROW: AutoCAD's status bar button, which toggles
//   object snap on a click (F3) and drops the running snap modes from the
//   arrow beside it. The arrow opens the snap options menu
//   (Na__LayoutEditor__ObjectSnap__Menu__): Endpoint, Midpoint, Intersection,
//   Perpendicular, Centre and Nearest, each with a picture of what it finds,
//   and the kinds of object they are found on, each with its marker colour.
//   The two are one joined control (na-le-toolbar__split), so the strip gives
//   up an arrow's width. The button's words now come from the object snap
//   config and are re-read on every sync, like Ortho's and the grid's.
// - Object snap moved to its own folder (28__System__ObjectSnap); the imports
//   follow.
//
// 21-Sep-2026 - Version 1.19.0
// - Undo, Redo, Fit and the zoom readout (the button that zoomed to 100%)
//   are gone, with the two separators that fenced them, to make room on a
//   strip that is tight for tools. Adam never used them. The keys stay:
//   Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z, and the key map's Nav__ZoomFit and
//   Nav__ZoomActualSize; Zoom to fit is on the right-click menu too.
// - Nothing left on the strip reads the undo depth or the zoom, so the
//   toolbar no longer listens for Na__LeHist__CHANGED_EVENT or
//   Na__LeSurface__ZOOM_EVENT, and SyncZoom is gone. An undo still re-syncs
//   it, through the model change the undo announces - one full sync per
//   edit where there were two.
//
// 21-Sep-2026 - Version 1.18.0
// - Image: a button after the tool buttons that asks for picture files and
//   places them on the sheet (Na__LayoutEditor__SheetImages__Insert__), the
//   same as dragging them onto it.
//
// 21-Sep-2026 - Version 1.17.0
// - The Notes toggle is gone from the toolbar: the Margin Notes section is
//   always in the left column (Na__LayoutEditor__Panel__MarginNotes__), so the
//   toolbar carried a second switch for a setting that already had a home,
//   spending a button's worth of a strip that is tight for tools. Show notes
//   margin there is the only way to switch it now.
//
// 21-Sep-2026 - Version 1.16.0
// - Grid and Grid Snap: two toggles after Draft switch the drawing grid
//   (F6, Show Grid) and its snap (F7, Grid Snap), SketchUp LayOut's pair
//   (Na__LayoutEditor__DrawingGrid__), in the same plain button as Snap,
//   Notes, Draft and Ortho, each lit while it is on. Their words come from the
//   grid config and are re-read on every sync; the toolbar re-syncs on
//   Na__LeGrid__CHANGED_EVENT.
//
// 21-Sep-2026 - Version 1.15.0
// - Ortho: a toggle after the other drafting toggles switches Ortho mode (F8,
//   Na__LayoutEditor__OrthoMode__) and is lit while it is on - AutoCAD's Ortho
//   Mode button - in the same plain toolbar button as Snap, Notes and Draft.
//   Its words come from the ortho config and are re-read on every sync; it
//   re-syncs on Na__LeOrtho__CHANGED_EVENT, listened for on a line of its own.
//
// 21-Sep-2026 - Version 1.14.0
// - A zoom step updates the zoom readout and nothing else (SyncZoom). The full
//   Sync used to run on every wheel notch, and it reads the active sheet four
//   times over, each read normalising every sheet in the set - about 2.4 ms a
//   notch on RB05 for one number.
//
// 21-Sep-2026 - Version 1.13.0
// - Draft: a toggle after Notes switches Draft mode (K,
//   Na__LayoutEditor__DraftMode__) and is lit while it is on. Its words come
//   from the draft config and are re-read on every sync, because that config
//   can land after the toolbar is built.
//
// 19-Sep-2026 - Version 1.12.0
// - The sheet's name on the toolbar is what its tab reads
//   (Na__LeModel__GetTabLabel, "D03 - 3D Images"): the register's short code,
//   then the short name, so a renumber reaches the toolbar with the tab.
//
// 17-Sep-2026 - Version 1.11.0
// - The Move button (M), beside Select, and a tooltip on Select that says a
//   drag no longer moves anything.
// - The state hint: which container is open and how to leave it. It is
//   invisible otherwise, and a faded sheet reads as a broken editor.
//
//
// 14-Sep-2026 - Version 1.10.0
// - Save Sheets finishes with one toast that says where the sheets went (R2 and
//   locally) and, when the specification was synced too, says that as well,
//   rather than letting the specification's toast replace the sheets' a moment
//   later. An error from either step turns the toast red.
//
// 14-Sep-2026 - Version 1.9.0
// - Notes: a toggle after Snap switches the active sheet's notes margin on and
//   off (Na__LeModel__UpdateMarginNotes), lit while it is on.
// - Save Sheets also syncs the project specification when it has changes, so
//   the codes the sheets show and the notes they come from reach the cloud
//   together, and the button asks for attention while either is unsaved.
//
// 14-Sep-2026 - Version 1.8.0
// - Leader tool button (E), after Text; its tooltip comes from ToolLeaderTitle.
//
// 13-Sep-2026 - Version 1.7.0
// - The Dimension button's tooltip comes from the ToolDimensionTitle label and
//   says that Shift makes the dimension horizontal or vertical.
//
// 13-Sep-2026 - Version 1.6.0
// - Shift+click on the Eyedropper button arms the palette, as Shift+B does.
//
// 13-Sep-2026 - Version 1.5.0
// - Rectangle tool button (R), beside Draw.
//
// 10-Sep-2026 - Version 1.4.0
// - Raster select: the working resolution of the viewport pictures (Low, Medium, High).
//
// 10-Sep-2026 - Version 1.3.0
// - Draw tool button; the dimension tool is three clicks.
//
// 10-Sep-2026 - Version 1.2.0
// - Undo and Redo buttons, enabled by the history depth.
//
// 10-Sep-2026 - Version 1.1.0
// - Snap toggle button.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Tools, PDF
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__GetTabLabel, Na__LeModel__IsDirty, Na__LeModel__Save } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSpec__CHANGED_EVENT, Na__LeSpec__IsDirty, Na__LeSpec__GetState, Na__LeSpec__Sync } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_MOVE,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__TOOL_RECT,
        Na__LeTools__TOOL_AREA,
        Na__LeTools__TOOL_EYEDROP,
        Na__LeTools__TOOL_LEADER,
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__SetTool,
        Na__LeTools__GetTool,
        Na__LeTools__ArmEyedropper,
        Na__LeTools__ArmPalette
    } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeVec__TOOL_CIRCLE, Na__LeVec__TOOL_ARC } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__State__.js';   // <-- The two vector tools that DRAW sit beside Draw and Rectangle; the seven that edit live in the Vector Tools panel
    import { Na__LeVecCfg__Label } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__Setup__.js';
    import { Na__LeDrop__CHANGED_EVENT, Na__LeDrop__GetHint } from '../30__System__SheetTools/Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeScope__CHANGED_EVENT, Na__LeScope__Get, Na__LeScope__GetVectorId, Na__LeScope__GetDimensionId } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';
    import { Na__LeOsnap__CHANGED_EVENT, Na__LeOsnap__IsEnabled, Na__LeOsnap__Toggle, Na__LeOsnap__Label } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__.js';
    import { Na__LeOsnap__ToggleMenu, Na__LeOsnap__CloseMenu } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Menu__.js';   // <-- The snap options dropdown, on the arrow beside the Snap button
    import { Na__LeOrtho__CHANGED_EVENT, Na__LeOrtho__IsOn, Na__LeOrtho__Toggle, Na__LeOrtho__Label } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__.js';
    import { Na__LePdf__ExportSheet } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import { Na__LeRaster__LEVELS, Na__LeRaster__CHANGED_EVENT, Na__LeRaster__Get, Na__LeRaster__Set } from '../20__System__Viewports/Na__LayoutEditor__RasterQuality__.js';
    import { Na__LeVectorQ__LEVELS, Na__LeVectorQ__CHANGED_EVENT, Na__LeVectorQ__Get, Na__LeVectorQ__Set } from '../20__System__Viewports/Na__LayoutEditor__VectorQuality__.js';   // <-- Vector: how clean the linework is drawn against how fast the editing is
    import { Na__LeDraft__CHANGED_EVENT, Na__LeDraft__IsOn, Na__LeDraft__Toggle, Na__LeDraft__Label } from '../26__System__DraftMode/Na__LayoutEditor__DraftMode__.js';
    import { Na__LeGrid__CHANGED_EVENT, Na__LeGrid__IsShowing, Na__LeGrid__IsSnapping, Na__LeGrid__ToggleShow, Na__LeGrid__ToggleSnap, Na__LeGrid__Label } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__.js';
    import { Na__LeAxes__CHANGED_EVENT, Na__LeAxes__IsOn, Na__LeAxes__Toggle, Na__LeAxes__Label } from '../33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__.js';
    import { Na__LeImgIns__Pick } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Insert__.js';   // <-- The Image button: pictures onto the sheet
    import { Na__LeImgCfg__Label } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Setup__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Root and Handlers
    // ------------------------------------------------------------
    let Na__LeToolbar__Root      = null;
    let Na__LeToolbar__Editable  = false;
    let Na__LeToolbar__ShowToast = null;
    let Na__LeToolbar__Listeners = null;
    let Na__LeToolbar__Busy      = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Toolbar Button
    // ------------------------------------------------------------
    function Na__LeToolbar__Button(text, name, title, onClick) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-le-toolbar__btn';
        button.textContent = text;
        button.title       = title || text;
        button.setAttribute('data-na-toolbar', name);
        button.addEventListener('click', onClick);
        return button;
    }
    function Na__LeToolbar__Gap() {
        const gap = document.createElement('span');
        gap.className = 'na-le-toolbar__gap';
        return gap;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect Tool, Sheet Name and Dirty State
    // ------------------------------------------------------------
    function Na__LeToolbar__Sync() {
        if (!Na__LeToolbar__Root) return;
        const tool = Na__LeTools__GetTool();
        Na__LeToolbar__Root.querySelectorAll('[data-na-tool]').forEach((button) => {
            const active = button.getAttribute('data-na-tool') === tool;
            button.classList.toggle('na-le-toolbar__btn--active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const snap = Na__LeToolbar__Root.querySelector('[data-na-toolbar="snap"]');
        if (snap) {
            snap.classList.toggle('na-le-toolbar__btn--active', Na__LeOsnap__IsEnabled());
            snap.setAttribute('aria-pressed', String(Na__LeOsnap__IsEnabled()));
            // Re-read for the same reason as Ortho's and Draft's words below:
            // the object snap config can land after the toolbar is built.
            const snapText  = Na__LeOsnap__Label('Toggle', Na__LeCfg__GetLabel('SnapToggle', 'Snap'));
            const snapTitle = Na__LeOsnap__Label('ToggleTitle', 'Object snap (F3): new points, dragged points and moved items land on the corners, middles, crossings and perpendiculars of the drawing and of everything drawn on the sheet. The arrow beside it chooses which.');
            if (snap.textContent !== snapText) snap.textContent = snapText;
            if (snap.title !== snapTitle) snap.title = snapTitle;
        }
        const snapMenu = Na__LeToolbar__Root.querySelector('[data-na-toolbar="snap-menu"]');
        if (snapMenu) {
            const menuTitle = Na__LeOsnap__Label('MenuButtonTitle', 'Snap options: which kinds of point are found, and which kinds of object they are found on');
            if (snapMenu.title !== menuTitle) { snapMenu.title = menuTitle; snapMenu.setAttribute('aria-label', menuTitle); }
        }
        const ortho = Na__LeToolbar__Root.querySelector('[data-na-toolbar="ortho"]');
        if (ortho) {
            ortho.classList.toggle('na-le-toolbar__btn--active', Na__LeOrtho__IsOn());
            ortho.setAttribute('aria-pressed', String(Na__LeOrtho__IsOn()));
            // Re-read for the same reason as Draft's words below: the ortho
            // config can land after the toolbar is built. Written only when
            // they differ, because this sync runs often.
            const orthoText  = Na__LeOrtho__Label('Toggle', 'Ortho');
            const orthoTitle = Na__LeOrtho__Label('ToggleTitle', 'Ortho Mode (F8): restricts the cursor to horizontal and vertical from the last point. Hold Shift to draw one at an angle.');
            if (ortho.textContent !== orthoText) ortho.textContent = orthoText;
            if (ortho.title !== orthoTitle) ortho.title = orthoTitle;
        }
        const draft = Na__LeToolbar__Root.querySelector('[data-na-toolbar="draft"]');
        if (draft) {
            draft.classList.toggle('na-le-toolbar__btn--active', Na__LeDraft__IsOn());
            draft.setAttribute('aria-pressed', String(Na__LeDraft__IsOn()));
            // THE WORDS ARE RE-READ because the draft config may land after the
            // toolbar is built - and written only when they differ, because this
            // sync runs often.
            const text  = Na__LeDraft__Label('Toggle', 'Draft');
            const title = Na__LeDraft__Label('ToggleTitle', 'Draft mode (K): only the vector linework, every line a hairline, no fills and no raster pictures.');
            if (draft.textContent !== text) draft.textContent = text;
            if (draft.title !== title) draft.title = title;
        }
        // GRID AND GRID SNAP | Lit while on; the words re-read, because the grid
        // config can land after the toolbar is built, and written only when
        // they differ.
        [ [ 'grid', Na__LeGrid__IsShowing(), 'ToolbarGrid', 'Grid', 'ToolbarGridTitle' ],
          [ 'grid-snap', Na__LeGrid__IsSnapping(), 'ToolbarSnap', 'Grid Snap', 'ToolbarSnapTitle' ] ].forEach((entry) => {
            const button = Na__LeToolbar__Root.querySelector('[data-na-toolbar="' + entry[0] + '"]');
            if (!button) return;
            button.classList.toggle('na-le-toolbar__btn--active', entry[1]);
            button.setAttribute('aria-pressed', String(entry[1]));
            const words = Na__LeGrid__Label(entry[2], entry[3]);
            const title = Na__LeGrid__Label(entry[4], button.title);
            if (button.textContent !== words) button.textContent = words;
            if (button.title !== title) button.title = title;
        });
        // DRAWING AXES OVERLAY | Lit while on; the words re-read, because the
        // axes config can land after the toolbar is built, and written only
        // when they differ.
        const axes = Na__LeToolbar__Root.querySelector('[data-na-toolbar="axes"]');
        if (axes) {
            axes.classList.toggle('na-le-toolbar__btn--active', Na__LeAxes__IsOn());
            axes.setAttribute('aria-pressed', String(Na__LeAxes__IsOn()));
            const axesText  = Na__LeAxes__Label('Toggle', 'Axes');
            const axesTitle = Na__LeAxes__Label('ToggleTitle', axes.title);
            if (axes.textContent !== axesText) axes.textContent = axesText;
            if (axes.title !== axesTitle) axes.title = axesTitle;
        }
        const raster = Na__LeToolbar__Root.querySelector('[data-na-toolbar="raster"]');
        if (raster && raster.value !== Na__LeRaster__Get()) raster.value = Na__LeRaster__Get();
        const vector = Na__LeToolbar__Root.querySelector('[data-na-toolbar="vector"]');
        if (vector && vector.value !== Na__LeVectorQ__Get()) vector.value = Na__LeVectorQ__Get();
        const hint = Na__LeToolbar__Root.querySelector('[data-na-toolbar="dropper-hint"]');
        if (hint) {
            const armed = tool === Na__LeTools__TOOL_EYEDROP;
            hint.hidden = !armed;
            if (armed) { hint.textContent = Na__LeDrop__GetHint(); hint.title = hint.textContent; }
        }
        // WHICH CONTAINER IS OPEN, IN WORDS. It is invisible otherwise, and
        // "the sheet has faded and only this one thing answers a press" reads as
        // the editor being broken unless something says so.
        // ------------------------------------
        const scope = Na__LeToolbar__Root.querySelector('[data-na-toolbar="scope-hint"]');
        if (scope) {
            const open  = Na__LeScope__Get();
            const where = Na__LeScope__GetVectorId() ? Na__LeCfg__GetLabel('ScopeVector', 'Editing vector')
                        : (Na__LeScope__GetDimensionId() ? Na__LeCfg__GetLabel('ScopeDimension', 'Editing dimension')
                        : Na__LeCfg__GetLabel('ScopeGroup', 'Inside group'));
            const text  = open ? Na__LeCfg__FormatLabel('ScopeHint', '{where} - click outside to close, Esc to stop', { where : where }) : '';
            scope.hidden      = !text;
            scope.textContent = text;
            scope.title       = text;
            scope.classList.toggle('na-le-toolbar__hint--scope', !!open);
        }
        const sheet = Na__LeModel__GetActiveSheet();
        const name  = Na__LeToolbar__Root.querySelector('.na-le-toolbar__name');
        if (name) name.textContent = sheet ? Na__LeModel__GetTabLabel(sheet) : '';   // <-- What the tab reads: the register's short code, then the short name
        const save = Na__LeToolbar__Root.querySelector('[data-na-toolbar="save"]');
        if (save) { save.classList.toggle('na-le-toolbar__btn--attention', Na__LeModel__IsDirty() || Na__LeSpec__IsDirty()); save.disabled = Na__LeToolbar__Busy; }
        const pdf = Na__LeToolbar__Root.querySelector('[data-na-toolbar="pdf"]');
        if (pdf) pdf.disabled = Na__LeToolbar__Busy || !sheet;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save and Export Actions
    // ------------------------------------------------------------
    // Save is exported as well as wired to its button, so Ctrl+S is the SAME
    // action rather than a second one that drifts from it: the busy guard, the
    // specification sync and the one combined toast all come with it.
    // ------------------------------------------------------------
    async function Na__LeToolbar__Save() {
        if (Na__LeToolbar__Busy) return;
        Na__LeToolbar__Busy = true; Na__LeToolbar__Sync();

        // ONE TOAST, AT THE END. The app has a single toast, so the specification's
        // message would replace the sheets' confirmation a moment after it showed.
        // Both are collected and shown together, red if either step failed.
        const notes = [];
        let failed  = false;
        const note  = (message, isError) => {
            if (message) notes.push(/[.!?]$/.test(message) ? message : message + '.');
            if (isError) failed = true;
        };
        try {
            await Na__LeModel__Save(note);
            const spec = Na__LeSpec__GetState();
            if (spec.dirty && spec.canSync) await Na__LeSpec__Sync({ showToast : note });   // <-- The notes the sheets' codes come from go up with them
        }
        finally {
            Na__LeToolbar__Busy = false; Na__LeToolbar__Sync();
            if (notes.length > 0 && typeof Na__LeToolbar__ShowToast === 'function') Na__LeToolbar__ShowToast(notes.join(' '), failed);
        }
    }
    async function Na__LeToolbar__Pdf() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (Na__LeToolbar__Busy || !sheet) return;
        Na__LeToolbar__Busy = true; Na__LeToolbar__Sync();
        try { await Na__LePdf__ExportSheet(sheet, Na__LeToolbar__ShowToast); }
        finally { Na__LeToolbar__Busy = false; Na__LeToolbar__Sync(); }
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Toolbar Into a Container
    // ------------------------------------------------------------
    function Na__LeToolbar__Mount(container, options) {
        if (!container) return false;
        Na__LeToolbar__Unmount();
        Na__LeToolbar__Editable  = !!(options && options.editable);
        Na__LeToolbar__ShowToast = (options && options.showToast) || null;
        const root = document.createElement('div');
        root.className = 'na-le-toolbar';

        const name = document.createElement('span');
        name.className = 'na-le-toolbar__name';
        root.appendChild(name);
        root.appendChild(Na__LeToolbar__Gap());

        if (Na__LeToolbar__Editable) {
            [ [ Na__LeTools__TOOL_SELECT, Na__LeCfg__GetLabel('ToolSelect', 'Select'),
                  Na__LeCfg__GetLabel('ToolSelectTitle', 'Select (V or space): click to pick, drag from bare paper to box-select. Picking text, a vector, a leader\'s bubble or a group picks the Move tool up too, so the next drag moves it. Double-click a group, a vector or a dimension to edit inside it, or text to type in it. Press M to move a viewport or a dimension.') ],
              [ Na__LeTools__TOOL_MOVE, Na__LeCfg__GetLabel('ToolMove', 'Move'),
                  Na__LeCfg__GetLabel('ToolMoveTitle', 'Move tool (M): drag to move whatever is under the pointer. It comes up by itself when Select picks text, a vector, a leader\'s bubble or a group, and goes back to Select when you click anything else. Viewports and dimensions only move once M is pressed, so a drawing is never shifted by accident; Escape goes back to Select.') ],
              [ Na__LeTools__TOOL_TEXT, Na__LeCfg__GetLabel('ToolText', 'Text'), 'Place text (T)' ],
              [ Na__LeTools__TOOL_LEADER, Na__LeCfg__GetLabel('ToolLeader', 'Leader'), Na__LeCfg__GetLabel('ToolLeaderTitle', 'Place a leader (E): click the point it marks, then where its note or bubble goes - or drag from one to the other.') ],
              [ Na__LeTools__TOOL_DIMENSION, Na__LeCfg__GetLabel('ToolDimension', 'Dimension'), Na__LeCfg__GetLabel('ToolDimensionTitle', 'Place a dimension in three clicks (D): start, end, then where the line sits. Hold Shift while placing the line for a horizontal or vertical dimension.') ],
              [ Na__LeTools__TOOL_DRAW, Na__LeCfg__GetLabel('ToolDraw', 'Draw'), 'Draw lines and polygons: click points, click the first point to close, Enter to finish (L)' ],
              [ Na__LeTools__TOOL_RECT, Na__LeCfg__GetLabel('ToolRectangle', 'Rectangle'), Na__LeCfg__GetLabel('ToolRectangleTitle', 'Draw a rectangle (R): click one corner then the opposite corner, or drag from one to the other. Shift keeps it square, Esc abandons it.') ],
              [ Na__LeVec__TOOL_CIRCLE, Na__LeVecCfg__Label('ToolCircle', 'Circle'), Na__LeVecCfg__Label('ToolCircleTitle', 'Circle (C): click the centre, then the radius - or drag from one to the other. Type a radius (1500), a diameter (3000d) or a number of sides (6s) and press Enter; typed straight after it lands, it resizes that circle.') ],
              [ Na__LeVec__TOOL_ARC, Na__LeVecCfg__Label('ToolArc', 'Arc'), Na__LeVecCfg__Label('ToolArcTitle', 'Arc (Shift+A): as set in the Vector Tools panel - 2 Point draws start, end, then the bulge. Type the bulge, or a radius (750r), and press Enter.') ],
              [ Na__LeTools__TOOL_AREA, Na__LeCfg__GetLabel('ToolFloorArea', 'Floor Area'), Na__LeCfg__GetLabel('ToolFloorAreaTitle', 'Measure a room (A): draw round it and click the first corner again to close - or switch to rectangles in the Floor Areas panel. It lands on the Floor Areas layer, named and coloured, with its area written in the middle of it.') ],
              [ Na__LeTools__TOOL_EYEDROP, Na__LeCfg__GetLabel('ToolEyedropper', 'Eyedropper'), Na__LeCfg__GetLabel('ToolEyedropperTitle', 'Match properties (B): click the object to copy FROM, then each object to copy ONTO. Alt+click picks a new source, Esc finishes.') ] ].forEach((entry) => {
                // The eyedropper arms through its own call so the button behaves
                // exactly as the B key does: with something selected it comes up
                // already loaded from that selection. Shift+click is Shift+B, the
                // palette.
                // ------------------------------------
                const pick   = (event) => (entry[0] !== Na__LeTools__TOOL_EYEDROP ? Na__LeTools__SetTool(entry[0]) : ((event && event.shiftKey) ? Na__LeTools__ArmPalette() : Na__LeTools__ArmEyedropper()));
                const button = Na__LeToolbar__Button(entry[1], 'tool-' + entry[0], entry[2], pick);
                button.setAttribute('data-na-tool', entry[0]);
                root.appendChild(button);
            });
            // IMAGE | Places pictures: asks for files and centres them in the
            // view. Not a tool that stays up - the pictures arrive selected,
            // with Move picked up - and dragging files onto the sheet does
            // the same without the button.
            // ------------------------------------
            root.appendChild(Na__LeToolbar__Button(Na__LeImgCfg__Label('ToolImage', 'Image'), 'image', Na__LeImgCfg__Label('ToolImageTitle', 'Place a picture (CGI, photograph) on this sheet. You can also drag picture files straight onto the sheet.'), () => Na__LeImgIns__Pick()));
            // SNAP, AND ITS ARROW | AutoCAD's status bar button: a click switches
            // object snap (F3), the arrow beside it drops the snap options - the
            // running modes, each with a picture of what it finds, and the kinds
            // of object they are found on, each with the colour its snaps are
            // marked in (28__System__ObjectSnap). Two buttons joined into one, so
            // the strip gives up an arrow's width and no more.
            // ------------------------------------
            const snapSplit = document.createElement('span');
            snapSplit.className = 'na-le-toolbar__split';
            snapSplit.appendChild(Na__LeToolbar__Button(Na__LeOsnap__Label('Toggle', Na__LeCfg__GetLabel('SnapToggle', 'Snap')), 'snap', Na__LeOsnap__Label('ToggleTitle', 'Object snap (F3)'), () => Na__LeOsnap__Toggle()));
            const snapCaret = Na__LeToolbar__Button('', 'snap-menu', Na__LeOsnap__Label('MenuButtonTitle', 'Snap options'), () => Na__LeOsnap__ToggleMenu(snapCaret));
            snapCaret.classList.add('na-le-toolbar__btn--caret');
            snapCaret.setAttribute('aria-haspopup', 'menu');
            snapCaret.setAttribute('aria-expanded', 'false');
            snapSplit.appendChild(snapCaret);
            root.appendChild(snapSplit);
            // DRAFT | K, as in LayOut: a view of the sheet, not a setting of it,
            // so it sits with the other toggles and is lit while it is on.
            // ------------------------------------
            root.appendChild(Na__LeToolbar__Button(Na__LeDraft__Label('Toggle', 'Draft'), 'draft', Na__LeDraft__Label('ToggleTitle', 'Draft mode (K): only the vector linework, every line a hairline, no fills and no raster pictures.'), () => Na__LeDraft__Toggle()));
            // GRID AND GRID SNAP | F6 and F7, SketchUp LayOut's Show Grid and
            // Grid Snap: two switches, as there, each lit while it is on.
            // ------------------------------------
            root.appendChild(Na__LeToolbar__Button(Na__LeGrid__Label('ToolbarGrid', 'Grid'), 'grid', Na__LeGrid__Label('ToolbarGridTitle', 'Show grid (F6): points every millimetre across the whole sheet, heavier every 10 mm. Never printed.'), () => Na__LeGrid__ToggleShow()));
            root.appendChild(Na__LeToolbar__Button(Na__LeGrid__Label('ToolbarSnap', 'Grid Snap'), 'grid-snap', Na__LeGrid__Label('ToolbarSnapTitle', 'Grid snap (F7): every point placed or dragged lands on the nearest grid point.'), () => Na__LeGrid__ToggleSnap()));
            // ORTHO | F8, as in AutoCAD: a way of drawing, lit while it is on,
            // like AutoCAD's Ortho Mode button on its status bar.
            // ------------------------------------
            root.appendChild(Na__LeToolbar__Button(Na__LeOrtho__Label('Toggle', 'Ortho'), 'ortho', Na__LeOrtho__Label('ToggleTitle', 'Ortho Mode (F8): restricts the cursor to horizontal and vertical from the last point. Hold Shift to draw one at an angle.'), () => Na__LeOrtho__Toggle()));
            // AXES | F9, the key after Ortho's: the Drawing Axes Overlay,
            // SketchUp's red and green axes carried by the cursor out to the
            // edges of the sheet, lit while it is on, like the grid and Ortho
            // beside it. One short word on the strip; the full name opens its
            // hover text.
            // ------------------------------------
            root.appendChild(Na__LeToolbar__Button(Na__LeAxes__Label('Toggle', 'Axes'), 'axes', Na__LeAxes__Label('ToggleTitle', 'Drawing Axes Overlay (F9): a red horizontal and a green vertical line through the cursor, run out to the edges of the sheet, as SketchUp draws its red and green axes. Never printed.'), () => Na__LeAxes__Toggle()));

            // EYEDROPPER HINT | What the dropper is holding and what to do next.
            // It lives beside the tool buttons because that is where the eye
            // already is when the tool is picked up, and it shrinks rather than
            // pushing the rest of the toolbar off the end.
            // ------------------------------------
            const hint = document.createElement('span');
            hint.className = 'na-le-toolbar__hint';
            hint.setAttribute('data-na-toolbar', 'dropper-hint');
            hint.hidden = true;
            root.appendChild(hint);

            // THE CONTAINER AND NO-TOOL HINT | Beside the dropper's, for the
            // same reason: it belongs where the tool buttons are.
            // ------------------------------------
            const scopeHint = document.createElement('span');
            scopeHint.className = 'na-le-toolbar__hint';
            scopeHint.setAttribute('data-na-toolbar', 'scope-hint');
            scopeHint.hidden = true;
            root.appendChild(scopeHint);
            root.appendChild(Na__LeToolbar__Gap());
        }

        // RASTER | The working resolution of the viewport pictures; the PDF ignores it
        const rasterLabel = document.createElement('span');
        rasterLabel.className   = 'na-le-toolbar__label';
        rasterLabel.textContent = Na__LeCfg__GetLabel('RasterLabel', 'Raster');
        root.appendChild(rasterLabel);
        const raster = document.createElement('select');
        raster.className = 'na-le-toolbar__select';
        raster.title     = Na__LeCfg__GetLabel('RasterTitle', 'Working resolution of the viewport pictures on screen. The PDF always exports at High.');
        raster.setAttribute('data-na-toolbar', 'raster');
        Na__LeRaster__LEVELS.forEach((level) => {
            const option = document.createElement('option');
            option.value       = level;
            option.textContent = Na__LeCfg__GetLabel('Raster' + level.charAt(0).toUpperCase() + level.slice(1), level.charAt(0).toUpperCase() + level.slice(1));
            raster.appendChild(option);
        });
        raster.value = Na__LeRaster__Get();
        raster.addEventListener('change', () => Na__LeRaster__Set(raster.value));
        root.appendChild(raster);

        // VECTOR | How the drawings' linework is drawn while the sheet is worked
        // on: clean against fast. A control of its own, beside Raster and not
        // part of it, because Raster renders every viewport picture again when
        // it changes and this renders nothing: it can be flicked mid-task.
        const vectorLabel = document.createElement('span');
        vectorLabel.className   = 'na-le-toolbar__label';
        vectorLabel.textContent = Na__LeCfg__GetLabel('VectorLabel', 'Vector');
        root.appendChild(vectorLabel);
        const vector = document.createElement('select');
        vector.className = 'na-le-toolbar__select';
        vector.title     = Na__LeCfg__GetLabel('VectorTitle', 'How the drawings\' linework is drawn while you work. High: always the cleanest, and a heavy plan is slow to dimension. Medium: fast while you edit, clean again a moment after you stop. Low: fastest, always a touch soft. Nothing is re-rendered when this changes, and the PDF ignores it.');
        vector.setAttribute('data-na-toolbar', 'vector');
        Na__LeVectorQ__LEVELS.forEach((level) => {
            const option = document.createElement('option');
            option.value       = level;
            option.textContent = Na__LeCfg__GetLabel('Vector' + level.charAt(0).toUpperCase() + level.slice(1), level.charAt(0).toUpperCase() + level.slice(1));
            vector.appendChild(option);
        });
        vector.value = Na__LeVectorQ__Get();
        vector.addEventListener('change', () => { Na__LeVectorQ__Set(vector.value); vector.blur(); });   // <-- Blur: the keys go back to the sheet, where the next one is meant
        root.appendChild(vector);
        root.appendChild(Na__LeToolbar__Gap());

        if (Na__LeToolbar__Editable) {
            root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('SaveSheets', 'Save Sheets'), 'save', Na__LeCfg__GetLabel('SaveSheetsTitle', 'Save every sheet to the project, and sync the project specification when it has changes'), () => { void Na__LeToolbar__Save(); }));
        } else {
            const note = document.createElement('span');
            note.className   = 'na-le-toolbar__note';
            note.textContent = Na__LeCfg__GetLabel('ReadOnlyNote', 'Read-only on the web build.');
            root.appendChild(note);
        }
        root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('DownloadPdf', 'Download PDF'), 'pdf', 'Export this sheet as a PDF at paper size', () => { void Na__LeToolbar__Pdf(); }));

        container.appendChild(root);
        Na__LeToolbar__Root = root;
        Na__LeToolbar__Listeners = () => Na__LeToolbar__Sync();
        [ Na__LeTools__CHANGED_EVENT, Na__LeModel__CHANGED_EVENT, Na__LeOsnap__CHANGED_EVENT, Na__LeRaster__CHANGED_EVENT, Na__LeDrop__CHANGED_EVENT, Na__LeScope__CHANGED_EVENT, Na__LeSpec__CHANGED_EVENT, Na__LeDraft__CHANGED_EVENT, Na__LeGrid__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeToolbar__Listeners));
        window.addEventListener(Na__LeOrtho__CHANGED_EVENT, Na__LeToolbar__Listeners);     // <-- F8 lights the Ortho button, whoever switched it
        window.addEventListener(Na__LeAxes__CHANGED_EVENT, Na__LeToolbar__Listeners);      // <-- F9 lights the Axes button, whoever switched it
        window.addEventListener(Na__LeVectorQ__CHANGED_EVENT, Na__LeToolbar__Listeners);   // <-- The Vector control reads the level, whoever set it
        Na__LeToolbar__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Toolbar
    // ------------------------------------------------------------
    function Na__LeToolbar__Unmount() {
        Na__LeOsnap__CloseMenu();                                                // <-- The snap options hang off a button that is about to go
        if (Na__LeToolbar__Listeners) {
            [ Na__LeTools__CHANGED_EVENT, Na__LeModel__CHANGED_EVENT, Na__LeOsnap__CHANGED_EVENT, Na__LeRaster__CHANGED_EVENT, Na__LeDrop__CHANGED_EVENT, Na__LeScope__CHANGED_EVENT, Na__LeSpec__CHANGED_EVENT, Na__LeDraft__CHANGED_EVENT, Na__LeGrid__CHANGED_EVENT ].forEach((name) => window.removeEventListener(name, Na__LeToolbar__Listeners));
        }
        if (Na__LeToolbar__Listeners) window.removeEventListener(Na__LeOrtho__CHANGED_EVENT, Na__LeToolbar__Listeners);
        if (Na__LeToolbar__Listeners) window.removeEventListener(Na__LeAxes__CHANGED_EVENT, Na__LeToolbar__Listeners);
        if (Na__LeToolbar__Listeners) window.removeEventListener(Na__LeVectorQ__CHANGED_EVENT, Na__LeToolbar__Listeners);
        if (Na__LeToolbar__Root && Na__LeToolbar__Root.parentNode) Na__LeToolbar__Root.parentNode.removeChild(Na__LeToolbar__Root);
        Na__LeToolbar__Root = Na__LeToolbar__Listeners = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Toolbar API
    // ------------------------------------------------------------
    export {
        Na__LeToolbar__Mount,
        Na__LeToolbar__Unmount,
        Na__LeToolbar__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
