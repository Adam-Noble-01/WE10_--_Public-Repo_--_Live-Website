// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TOOLBAR
// =============================================================================
//
// FILE       : Na__LayoutEditor__Toolbar__.js
// NAMESPACE  : Na__LeToolbar
// MODULE     : Layout Editor - Toolbar
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The strip above the stage: tools, zoom, save and Download PDF
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Tool buttons (Select, Text, Dimension) and Save exist only when the
//   session can edit; Zoom to Fit, the zoom readout and Download PDF are
//   for everyone, so a web viewer can read a sheet and take the PDF away.
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

    // MODULE IMPORTS | Config, Model, Tools, Navigation, Surface, PDF
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__IsDirty, Na__LeModel__Save } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeTools__TOOL_SELECT,
        Na__LeTools__TOOL_TEXT,
        Na__LeTools__TOOL_DIMENSION,
        Na__LeTools__TOOL_DRAW,
        Na__LeTools__CHANGED_EVENT,
        Na__LeTools__SetTool,
        Na__LeTools__GetTool
    } from './Na__LayoutEditor__SheetTools__.js';
    import { Na__LeNav__Fit, Na__LeNav__ZoomTo } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LeOsnap__CHANGED_EVENT, Na__LeOsnap__IsEnabled, Na__LeOsnap__Toggle } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeHist__CHANGED_EVENT, Na__LeHist__CanUndo, Na__LeHist__CanRedo, Na__LeHist__Undo, Na__LeHist__Redo } from './Na__LayoutEditor__History__.js';
    import { Na__LeSurface__ZOOM_EVENT, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LePdf__ExportSheet } from './Na__LayoutEditor__PdfExporter__.js';
    import { Na__LeRaster__LEVELS, Na__LeRaster__CHANGED_EVENT, Na__LeRaster__Get, Na__LeRaster__Set } from './Na__LayoutEditor__RasterQuality__.js';
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


    // HELPER FUNCTION | Reflect Tool, Zoom, Sheet Name and Dirty State
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
        if (snap) { snap.classList.toggle('na-le-toolbar__btn--active', Na__LeOsnap__IsEnabled()); snap.setAttribute('aria-pressed', String(Na__LeOsnap__IsEnabled())); }
        const undo = Na__LeToolbar__Root.querySelector('[data-na-toolbar="undo"]');
        if (undo) undo.disabled = !Na__LeHist__CanUndo();
        const redo = Na__LeToolbar__Root.querySelector('[data-na-toolbar="redo"]');
        if (redo) redo.disabled = !Na__LeHist__CanRedo();
        const raster = Na__LeToolbar__Root.querySelector('[data-na-toolbar="raster"]');
        if (raster && raster.value !== Na__LeRaster__Get()) raster.value = Na__LeRaster__Get();
        const zoom = Na__LeToolbar__Root.querySelector('[data-na-toolbar="zoom"]');
        if (zoom) zoom.textContent = Math.round(Na__LeSurface__GetZoom() * 100) + '%';
        const sheet = Na__LeModel__GetActiveSheet();
        const name  = Na__LeToolbar__Root.querySelector('.na-le-toolbar__name');
        if (name) name.textContent = sheet ? sheet.Sheet__Name : '';
        const save = Na__LeToolbar__Root.querySelector('[data-na-toolbar="save"]');
        if (save) { save.classList.toggle('na-le-toolbar__btn--attention', Na__LeModel__IsDirty()); save.disabled = Na__LeToolbar__Busy; }
        const pdf = Na__LeToolbar__Root.querySelector('[data-na-toolbar="pdf"]');
        if (pdf) pdf.disabled = Na__LeToolbar__Busy || !sheet;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Save and Export Actions
    // ------------------------------------------------------------
    async function Na__LeToolbar__Save() {
        if (Na__LeToolbar__Busy) return;
        Na__LeToolbar__Busy = true; Na__LeToolbar__Sync();
        try { await Na__LeModel__Save(Na__LeToolbar__ShowToast); }
        finally { Na__LeToolbar__Busy = false; Na__LeToolbar__Sync(); }
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
            [ [ Na__LeTools__TOOL_SELECT, Na__LeCfg__GetLabel('ToolSelect', 'Select'), 'Select and move (V)' ],
              [ Na__LeTools__TOOL_TEXT, Na__LeCfg__GetLabel('ToolText', 'Text'), 'Place text (T)' ],
              [ Na__LeTools__TOOL_DIMENSION, Na__LeCfg__GetLabel('ToolDimension', 'Dimension'), 'Place a dimension in three clicks: start, end, then where the line sits (D)' ],
              [ Na__LeTools__TOOL_DRAW, Na__LeCfg__GetLabel('ToolDraw', 'Draw'), 'Draw lines and polygons: click points, click the first point to close, Enter to finish (L)' ] ].forEach((entry) => {
                const button = Na__LeToolbar__Button(entry[1], 'tool-' + entry[0], entry[2], () => Na__LeTools__SetTool(entry[0]));
                button.setAttribute('data-na-tool', entry[0]);
                root.appendChild(button);
            });
            root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('SnapToggle', 'Snap'), 'snap', Na__LeCfg__GetLabel('SnapToggleTitle', 'Snap dimensions to the linework endpoints and midpoints (F3)'), () => Na__LeOsnap__Toggle()));
            root.appendChild(Na__LeToolbar__Gap());
            root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('Undo', 'Undo'), 'undo', 'Undo the last change to this sheet (Ctrl+Z)', () => Na__LeHist__Undo()));
            root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('Redo', 'Redo'), 'redo', 'Redo the change just undone (Ctrl+Y)', () => Na__LeHist__Redo()));
            root.appendChild(Na__LeToolbar__Gap());
        }

        root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('ZoomFit', 'Fit'), 'fit', 'Zoom to fit the sheet', () => Na__LeNav__Fit()));
        root.appendChild(Na__LeToolbar__Button('100%', 'zoom', 'Zoom to 100 percent (one paper millimetre per screen unit)', () => Na__LeNav__ZoomTo(1)));
        root.appendChild(Na__LeToolbar__Gap());

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
        root.appendChild(Na__LeToolbar__Gap());

        if (Na__LeToolbar__Editable) {
            root.appendChild(Na__LeToolbar__Button(Na__LeCfg__GetLabel('SaveSheets', 'Save Sheets'), 'save', 'Save every sheet to the project', () => { void Na__LeToolbar__Save(); }));
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
        [ Na__LeTools__CHANGED_EVENT, Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT, Na__LeOsnap__CHANGED_EVENT, Na__LeHist__CHANGED_EVENT, Na__LeRaster__CHANGED_EVENT ].forEach((name) => window.addEventListener(name, Na__LeToolbar__Listeners));
        Na__LeToolbar__Sync();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Toolbar
    // ------------------------------------------------------------
    function Na__LeToolbar__Unmount() {
        if (Na__LeToolbar__Listeners) {
            [ Na__LeTools__CHANGED_EVENT, Na__LeSurface__ZOOM_EVENT, Na__LeModel__CHANGED_EVENT, Na__LeOsnap__CHANGED_EVENT, Na__LeHist__CHANGED_EVENT, Na__LeRaster__CHANGED_EVENT ].forEach((name) => window.removeEventListener(name, Na__LeToolbar__Listeners));
        }
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
        Na__LeToolbar__Unmount
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
