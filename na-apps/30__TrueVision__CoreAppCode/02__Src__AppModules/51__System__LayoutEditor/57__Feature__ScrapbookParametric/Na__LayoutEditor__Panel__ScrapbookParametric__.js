// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: PARAMETRIC SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ScrapbookParametric__.js
// NAMESPACE  : Na__LePanelParam
// MODULE     : Layout Editor - Panel Parametric Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Parametric Scrapbook's two panel sections - the library of elements to drag in, and the settings of the one that is selected - and the subsystem's one entry point
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE LIBRARY, on the right column's Scrapbook tab: one tile per
//   element the config offers on the active sheet's drawing type. A tile is
//   dragged onto the paper or double-clicked, exactly like every other
//   scrapbook tile (Na__LayoutEditor__Scrapbook__TileDrag__). The element
//   lands linked to the viewport nearest the drop and at that viewport's
//   scale.
// - THE SETTINGS, first on the right column's Properties tab, shown only while one
//   parametric element is selected: the viewport it is linked to, its scale,
//   its divisions, the split of its first division and its units. They are
//   the same choices the lookup grip's menu offers, laid out to be read.
//   Picking a scale by hand lets go of the viewport; picking a viewport
//   takes its scale.
// - THE ENTRY POINT. Whichever of the two Register functions the mode
//   controller calls first does the subsystem's wiring, once: it registers
//   the element types with the engine, starts the viewport follower and hands
//   the grips to the grips module. The mode controller is the only module
//   outside this folder that imports from it, bar the Custom Scrapbook, which
//   asks the engine to make a saved group portable.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ calls RegisterProperties before the
//   Viewport section (so it sits first on the Properties tab) and
//   RegisterLibrary after the Standard Scrapbook's, on the Scrapbook tab.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__Grips__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.2.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
// - Ahead of it   : 1.3.0 (the storey hint) and 1.4.0 (where a title's bar
//                   sits) are TrueVision only. ValeVision holds 1.2.0, its
//                   floor plans have no storey field and its bar is always
//                   below.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.4.0
// - Where a title's scale bar sits, and how far along it stands when it sits
//   to the right: two more of a title's own controls, the second shown only
//   for the first's second answer, stepping by whatever the config says.
//
// 20-Sep-2026 - Version 1.3.0
// - A title's one sentence of explanation asks the sentence where its subject
//   came from (Compose's source) where it used to look at ViewName: a typed
//   viewport name that gives way to the plan's storey is no longer reported
//   as the name in use. A title written from a storey says where that is set.
//
// 20-Sep-2026 - Version 1.2.0
// - The Drawing Title: registered beside the scale bar, with the viewport
//   identity module's words and the chrome's text measure handed to the
//   engine as a tool. Tiles are ELEMENTS now, not types - two may share a
//   type - so a tile is keyed by its element's id, drawn with its preview
//   parameters and dropped with its preset ones. The settings section shows
//   a title's controls for a title, a bar's for anything that has a bar, and
//   says in words why a title still holds a {{placeholder}}.
//
// 19-Sep-2026 - Version 1.1.0
// - The library moves to the right column's Scrapbook tab. Linked to offers
//   the sheet's own scale as well as the viewports, and the link noodle is
//   attached with the grips.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scale Labels, the Tile Drag, the Panel Host and the Subsystem
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeScrap__TAB_ID } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js';
    import { Na__LeScrapDrag__Tile, Na__LeScrapDrag__EndDrag } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__Refresh,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeParam__STATUS_FAILED,
        Na__LeParam__Ready,
        Na__LeParam__GetStatus,
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__RegisterType,
        Na__LeParam__GetType,
        Na__LeParam__SetTools,
        Na__LeParam__ElementsFor,
        Na__LeParam__ElementName,
        Na__LeParam__ElementId,
        Na__LeParam__ElementParams,
        Na__LeParam__ElementPreviewParams,
        Na__LeParam__TypeName,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__IsLocked,
        Na__LeParam__BuildSet,
        Na__LeParam__Regenerate,
        Na__LeParam__ResetToStandard
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    import { Na__LeParamBar__CreateType } from './Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js';
    import {
        Na__LeParamTitle__TYPE,
        Na__LeParamTitle__PLACE_BELOW,
        Na__LeParamTitle__PLACE_RIGHT,
        Na__LeParamTitle__CreateType
    } from './Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js';
    import { Na__LeViewId__Ready, Na__LeViewId__Words, Na__LeViewId__IsNorthSet } from '../20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js';
    import {
        Na__LeViewText__MODE_AUTO,
        Na__LeViewText__MODE_EXISTING,
        Na__LeViewText__MODE_PROPOSED,
        Na__LeViewText__MODE_NONE,
        Na__LeViewText__MISSING_DIRECTION,
        Na__LeViewText__MISSING_DRAWING,
        Na__LeViewText__SOURCE_NAME,
        Na__LeViewText__SOURCE_LEVEL
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportTitleText__.js';
    import { Na__LeChrome__MeasureTextMm } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__LeParamLink__KIND_VIEWPORT,
        Na__LeParamLink__KIND_SHEET,
        Na__LeParamLink__Attach,
        Na__LeParamLink__Candidates,
        Na__LeParamLink__ViewportName,
        Na__LeParamLink__DescribeById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__SetSheetLink,
        Na__LeParamLink__InsertLinked
    } from './Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    import { Na__LeDrawScale__SheetDenominator } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeParamGrips__Attach } from './Na__LayoutEditor__ScrapbookParametric__Grips__.js';
    import { Na__LeParamNoodle__Attach } from './Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sections, Controls and the Changes Each Section Answers To
    // ------------------------------------------------------------
    const Na__LePanelParam__LIBRARY_ID    = 'scrapbook-parametric';
    const Na__LePanelParam__PROPS_ID      = 'parametric-element';
    const Na__LePanelParam__NO_LINK       = '';
    const Na__LePanelParam__SHEET_LINK    = '@sheet';                           // <-- Never a viewport id: those are Viewport_nnn
    const Na__LePanelParam__BAR_CONTROLS   = Object.freeze([ 'param-scale', 'param-divisions', 'param-subdivide', 'param-subdivision', 'param-units', 'param-reset' ]);
    const Na__LePanelParam__TITLE_CONTROLS = Object.freeze([ 'param-title-text', 'param-title-phase', 'param-title-upper', 'param-title-underline', 'param-title-bar', 'param-title-bar-place', 'param-title-bar-offset' ]);
    const Na__LePanelParam__LIBRARY_SHOWS = Object.freeze([ 'active', 'loaded', 'sheet-created', 'sheet-deleted', 'sheet-updated' ]);   // <-- What can alter which sheet, or which drawing type, is up
    const Na__LePanelParam__PROPS_SHOWS   = Object.freeze([ 'selection', 'active', 'loaded', 'sheet-deleted', 'sheet-updated', 'groups', 'shape', 'shapes', 'annotation', 'annotations', 'viewport', 'viewports', 'layers' ]);   // <-- What can alter the selected element, its link or its lock
    // ------------------------------------------------------------

    // MODULE VARIABLES | Tiles, Listening and the Stylesheet
    // ------------------------------------------------------------
    let Na__LePanelParam__Signature = null;     // <-- What the tiles were last built for, so a refresh per model change rebuilds nothing
    let Na__LePanelParam__Wired     = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Subsystem's Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Register the Types, Start the Follower, Hand Over the Grips (once)
    // ------------------------------------------------------------
    // A type is registered with a reader for its config block rather than the
    // block itself, so it draws from the config whenever that arrives. The
    // stylesheet is this folder's own and is linked from here, as the Drawing
    // Register links its own.
    // ------------------------------------------------------------
    function Na__LePanelParam__Wire() {
        if (Na__LePanelParam__Wired) return;
        Na__LePanelParam__Wired = true;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__ScrapbookParametric__.css', import.meta.url).href;
        document.head.appendChild(link);
        Na__LeParam__RegisterType(Na__LeParamBar__CreateType(() => Na__LeParam__Block('ScaleBar')));
        Na__LeParam__RegisterType(Na__LeParamTitle__CreateType(() => Na__LeParam__Block('DrawingTitle'), () => Na__LeParam__Block('ScaleBar'), Na__LeViewId__Words));
        Na__LeParam__SetTools({ measureTextMm : (value, sizeMm, weight) => Na__LeChrome__MeasureTextMm(value, sizeMm, weight) });   // <-- A type is pure; the way to measure text is the chrome's, handed over
        void Na__LeViewId__Ready();
        Na__LeParamLink__Attach();
        Na__LeParamGrips__Attach();
        Na__LeParamNoodle__Attach();                                          // <-- After the grips, so the socket is drawn over the noodle it starts
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LePanelParam__OnModelChanged);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Library Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element as the Tile Drag's Spec
    // ------------------------------------------------------------
    // The tile and the ghost draw the element at its type's default scale,
    // with its preview parameters. The drop is the link module's: it reads
    // the scale, and the facts a title is written from, off the nearest
    // viewport, over the element's own preset parameters.
    // ------------------------------------------------------------
    function Na__LePanelParam__Spec(element, editable) {
        const name = Na__LeParam__ElementName(element);
        const hint = (typeof element.Element__Description === 'string' && element.Element__Description !== '') ? element.Element__Description : '';
        const drag = Na__LeParam__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view.', { name : name });
        return {
            id       : 'parametric:' + Na__LeParam__ElementId(element),
            name     : name,
            title    : editable ? (hint !== '' ? hint + '\n\n' + drag : drag) : name,
            editable : editable,
            modifier : 'na-le-scrap__item--param',
            buildSet : () => Na__LeParam__BuildSet(element.Element__Type, Na__LeParam__ElementPreviewParams(element), null),
            place    : (sheet, centreMm) => Na__LeParamLink__InsertLinked(sheet, element.Element__Type, centreMm, Na__LeParam__ElementParams(element))
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build and Reflect the Library
    // ------------------------------------------------------------
    function Na__LePanelParam__BuildLibrary(body) {
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-param', 'note');
        const grid = document.createElement('div');
        grid.className = 'na-le-scrap';
        grid.setAttribute('data-na-param', 'grid');
        body.appendChild(note);
        body.appendChild(grid);
        Na__LePanelParam__Signature = null;                                  // <-- A new body has no tiles yet
    }
    function Na__LePanelParam__RefreshLibrary(body) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const status   = Na__LeParam__GetStatus();
        const editable = Na__LePanels__IsEditable();
        const elements = Na__LeParam__ElementsFor(sheet);
        const note     = body.querySelector('[data-na-param="note"]');
        const grid     = body.querySelector('[data-na-param="grid"]');
        if (note) {
            if (status === Na__LeParam__STATUS_FAILED) note.textContent = Na__LeParam__Label('LibraryFailed', 'The parametric scrapbook could not be read, so it has no elements.');
            else if (editable) note.textContent = Na__LeParam__Label('LibraryHint', 'Dynamic elements. Drag one onto the sheet, or double-click it; select it afterwards for its grips and its settings.');
            else note.textContent = Na__LeParam__Label('LibraryReadOnly', 'Elements can only be placed while sheets are editable.');
        }
        if (!grid) return;
        const signature = [ status, editable ? 'edit' : 'view' ].concat(elements.map((element) => Na__LeParam__ElementId(element))).join('|');
        if (signature === Na__LePanelParam__Signature) return;
        Na__LePanelParam__Signature = signature;
        grid.innerHTML = '';
        elements.forEach((element) => grid.appendChild(Na__LeScrapDrag__Tile(Na__LePanelParam__Spec(element, editable))));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Library Only on a Sheet That Has Elements
    // ------------------------------------------------------------
    // A config that could not be read still shows, to say so.
    // ------------------------------------------------------------
    function Na__LePanelParam__SyncLibrary() {
        const sheet = Na__LeModel__GetActiveSheet();
        const show  = !!sheet && (Na__LeParam__ElementsFor(sheet).length > 0 || Na__LeParam__GetStatus() === Na__LeParam__STATUS_FAILED);
        Na__LePanels__SetSectionVisible(Na__LePanelParam__LIBRARY_ID, show);
        if (!show) { Na__LeScrapDrag__EndDrag(); return; }
        Na__LePanels__Refresh(Na__LePanelParam__LIBRARY_ID);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Settings Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The One Selected Parametric Element, or Null
    // ------------------------------------------------------------
    // { sheet, groupId, params, type }. Several selected is none, as it is
    // for every properties panel.
    // ------------------------------------------------------------
    function Na__LePanelParam__Selected() {
        const sheet     = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'group') return null;
        const block = Na__LeParam__GetBlockById(sheet, selection.id);
        if (!block) return null;
        return { sheet : sheet, groupId : selection.id, params : Na__LeParam__GetParams(sheet, selection.id), type : Na__LeParam__GetType(block.Parametric__Type) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelParam__BuildProps(body) {
        const L = Na__LeParam__Label;
        const name = Na__LePanels__Note('');
        name.setAttribute('data-na-param', 'name');
        name.classList.add('na-le-param__name');
        body.appendChild(name);

        body.appendChild(Na__LePanels__Row(L('PropsLink', 'Linked to'), Na__LePanels__Select('param-link', [], null)));

        // A TITLE'S OWN | Shown for a Drawing Title and for nothing else
        const title = document.createElement('div');
        title.setAttribute('data-na-param', 'title-block');
        const reads = Na__LePanels__Note('');
        reads.setAttribute('data-na-param', 'title-reads');
        reads.classList.add('na-le-param__reads');
        title.appendChild(reads);
        const why = Na__LePanels__Note('');
        why.setAttribute('data-na-param', 'title-why');
        title.appendChild(why);
        title.appendChild(Na__LePanels__Row(L('PropsPhase', 'Existing / Proposed'), Na__LePanels__Select('param-title-phase', [], null)));
        title.appendChild(Na__LePanels__Row(L('PropsTitleText', 'Title text'), Na__LePanels__Input('text', 'param-title-text', { maxlength : 200, placeholder : L('PropsTitleAuto', 'Automatic') })));
        title.appendChild(Na__LePanels__Row(L('PropsUppercase', 'Capitals'), Na__LePanels__Input('checkbox', 'param-title-upper'), 'na-le-row--toggle'));
        title.appendChild(Na__LePanels__Row(L('PropsUnderline', 'Underline (mm)'), Na__LePanels__Input('number', 'param-title-underline', { min : 10, max : 400, step : 5 })));
        title.appendChild(Na__LePanels__Row(L('PropsShowBar', 'Scale bar'), Na__LePanels__Input('checkbox', 'param-title-bar'), 'na-le-row--toggle'));

        // WHERE THAT BAR SITS | Under the title, or away along the same line. The
        // position is the second one's only, and is hidden with it.
        const place = Na__LePanels__Row(L('PropsBarPlace', 'Bar sits'), Na__LePanels__Select('param-title-bar-place', [], null));
        place.setAttribute('data-na-param', 'bar-place');
        title.appendChild(place);
        const across = Na__LePanels__Row(L('PropsBarOffset', 'Bar position (mm)'), Na__LePanels__Input('number', 'param-title-bar-offset', { min : 0, max : 1200, step : 50 }));
        across.setAttribute('data-na-param', 'bar-offset');
        title.appendChild(across);
        const acrossNote = Na__LePanels__Note('');
        acrossNote.setAttribute('data-na-param', 'bar-offset-note');
        title.appendChild(acrossNote);
        body.appendChild(title);

        // A BAR'S OWN | Shown for a scale bar, and for a title that carries one
        const barBlock = document.createElement('div');
        barBlock.setAttribute('data-na-param', 'bar-block');
        body.appendChild(barBlock);
        barBlock.appendChild(Na__LePanels__Row(L('PropsScale', 'Scale'), Na__LePanels__Select('param-scale', [], null)));
        barBlock.appendChild(Na__LePanels__Row(L('PropsDivisions', 'Divisions'), Na__LePanels__Input('number', 'param-divisions', { min : 1, max : 40, step : 1 })));

        const length = Na__LePanels__Note('');
        length.setAttribute('data-na-param', 'length');
        barBlock.appendChild(length);

        barBlock.appendChild(Na__LePanels__Row(L('PropsSubdivide', 'Split first division'), Na__LePanels__Input('checkbox', 'param-subdivide'), 'na-le-row--toggle'));
        const into = Na__LePanels__Row(L('PropsSubdivision', 'Into'), Na__LePanels__Select('param-subdivision', [], null));
        into.setAttribute('data-na-param', 'into');
        barBlock.appendChild(into);
        barBlock.appendChild(Na__LePanels__Row(L('PropsUnits', 'Show units'), Na__LePanels__Input('checkbox', 'param-units'), 'na-le-row--toggle'));

        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Button(L('PropsReset', 'Reset to standard'), 'param-reset', ''));
        barBlock.appendChild(bar);

        const foot = Na__LePanels__Note('');
        foot.setAttribute('data-na-param', 'foot');
        body.appendChild(foot);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Real-World Size as the Split List Writes It
    // ------------------------------------------------------------
    function Na__LePanelParam__SizeLabel(sizeMm) {
        return sizeMm >= 1000 ? (String(Math.round(sizeMm) / 1000) + ' m') : (String(Math.round(sizeMm)) + ' mm');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Element
    // ------------------------------------------------------------
    // A control being typed into is left alone, as in every panel.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshProps(body) {
        const picked = Na__LePanelParam__Selected();
        if (!picked || !picked.params) return;
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const locked = Na__LeParam__IsLocked(picked.sheet, picked.groupId);
        const usable = Na__LePanels__IsEditable() && !locked;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');

        part('name').textContent = Na__LeParam__TypeName(picked.type.type);
        const isTitle = picked.type.type === Na__LeParamTitle__TYPE;
        const hasBar  = (typeof picked.type.hasBar === 'function') ? picked.type.hasBar(params) : true;   // <-- A type that does not say is a bar
        part('title-block').hidden = !isTitle;
        part('bar-block').hidden   = !hasBar;
        if (isTitle) Na__LePanelParam__RefreshTitle(body, picked, usable);

        const tied     = Na__LeParamLink__DescribeById(picked.sheet, picked.groupId);
        const linkable = Na__LeParamLink__Candidates(picked.sheet);
        const sheetIs  = L('PropsLinkSheet', 'The sheet\'s scale ({scale})', { scale : Na__LeDrawScale__Label(Na__LeDrawScale__SheetDenominator(picked.sheet)) });
        Na__LePanels__FillSelect(el('param-link'),
            [ { value : Na__LePanelParam__NO_LINK, label : L('PropsLinkNone', 'Not linked') }, { value : Na__LePanelParam__SHEET_LINK, label : sheetIs } ]
                .concat(linkable.map((viewport) => ({ value : viewport.Viewport__Id, label : Na__LeParamLink__ViewportName(viewport) }))),
            tied.kind === Na__LeParamLink__KIND_VIEWPORT ? tied.viewport.Viewport__Id : (tied.kind === Na__LeParamLink__KIND_SHEET ? Na__LePanelParam__SHEET_LINK : Na__LePanelParam__NO_LINK));

        const listed = Na__LeParam__Block('ScaleBar').ScaleBar__MenuScaleDenominators;
        const scales = (Array.isArray(listed) ? listed : []).filter((d) => typeof d === 'number' && d > 0);
        if (scales.indexOf(params.ScaleDenominator) === -1) scales.push(params.ScaleDenominator);   // <-- A viewport's scale, or a solved one, that the list leaves out
        scales.sort((a, b) => a - b);
        Na__LePanels__FillSelect(el('param-scale'), scales.map((d) => ({ value : d, label : Na__LeDrawScale__Label(d) })), params.ScaleDenominator);

        const divisions = el('param-divisions');
        const bar       = Na__LeParam__Block('ScaleBar');
        if (Number.isFinite(bar.ScaleBar__MinDivisions)) divisions.min = String(bar.ScaleBar__MinDivisions);
        if (Number.isFinite(bar.ScaleBar__MaxDivisions)) divisions.max = String(bar.ScaleBar__MaxDivisions);
        if (document.activeElement !== divisions) divisions.value = String(params.Divisions);

        const told = (typeof picked.type.describe === 'function') ? picked.type.describe(params) : null;
        part('length').textContent = told ? L('PropsLength', '{real} long, {paper} mm on the paper.', told) : '';

        el('param-subdivide').checked = params.SubdivideFirst === true;
        const choices = (typeof picked.type.subdivisionChoices === 'function') ? picked.type.subdivisionChoices(params) : [];
        if (choices.indexOf(params.SubdivisionMm) === -1) choices.push(params.SubdivisionMm);
        choices.sort((a, b) => a - b);
        Na__LePanels__FillSelect(el('param-subdivision'), choices.map((sizeMm) => ({ value : sizeMm, label : Na__LePanelParam__SizeLabel(sizeMm) })), params.SubdivisionMm);
        part('into').hidden = params.SubdivideFirst !== true;
        el('param-units').checked = params.ShowUnits === true;

        [ 'param-link' ].concat(Na__LePanelParam__BAR_CONTROLS).forEach((name) => { el(name).disabled = !usable; });
        part('foot').textContent = locked ? L('PropsLocked', 'Its layer is locked.') : L('PropsExplode', 'Ungroup it (Ctrl+Shift+G) to explode it into plain vectors and text.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Drawing Title
    // ------------------------------------------------------------
    // What it reads, and - when it still holds a placeholder, or has stopped
    // following its drawing - the one sentence that says why and what to do.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshTitle(body, picked, usable) {
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');
        const told   = (typeof picked.type.titleText === 'function') ? picked.type.titleText(params) : { text : '', resolved : true, missing : [] };

        part('title-reads').textContent = L('PropsTitleReads', 'Reads: {text}', { text : told.text });
        let why = '';
        if (params.TitleText !== '') why = L('PropsTitleTyped', 'Typed by hand, so it no longer follows its drawing. Clear the box to go back to automatic.');
        else if (told.missing.indexOf(Na__LeViewText__MISSING_DRAWING) !== -1) why = L('PropsNeedsLink', 'Tie it to a drawing to fill {{Drawing}}: drag its round socket onto one.');
        else if (told.missing.indexOf(Na__LeViewText__MISSING_DIRECTION) !== -1 && !Na__LeViewId__IsNorthSet()) why = L('PropsNeedsNorth', '{{Direction}} fills itself in once north is set in the 3D model: Dev Tools, North Direction, Draw Compass.');
        else if (told.source === Na__LeViewText__SOURCE_NAME) why = L('PropsTitleNamed', 'The drawing\'s viewport has a typed name, which the title uses. Clear that name and the title is written from the model and north.');   // <-- Asked of the sentence, not of ViewName: a typed "Proposed Floor Plan" gives way to the plan's storey and is NOT what the title uses
        else if (told.source === Na__LeViewText__SOURCE_LEVEL) why = L('PropsTitleStorey', 'Written from the plan\'s storey, which is chosen per floor plan in the 3D view: Dev Tools, Floor Plans, Storey.');
        part('title-why').textContent = why;
        part('title-why').hidden      = why === '';

        Na__LePanels__FillSelect(el('param-title-phase'), [
            { value : Na__LeViewText__MODE_AUTO,     label : L('PropsPhaseAuto', 'Automatic (from the model)') },
            { value : Na__LeViewText__MODE_EXISTING, label : L('PropsPhaseExisting', 'Existing') },
            { value : Na__LeViewText__MODE_PROPOSED, label : L('PropsPhaseProposed', 'Proposed') },
            { value : Na__LeViewText__MODE_NONE,     label : L('PropsPhaseNone', 'Leave it out') }
        ], params.PhaseMode);
        const typed = el('param-title-text');
        if (document.activeElement !== typed) typed.value = params.TitleText;
        el('param-title-upper').checked = params.Uppercase === true;
        const underline = el('param-title-underline');
        const block     = Na__LeParam__Block('DrawingTitle');
        if (Number.isFinite(block.DrawingTitle__UnderlineMinMm))  underline.min  = String(block.DrawingTitle__UnderlineMinMm);
        if (Number.isFinite(block.DrawingTitle__UnderlineMaxMm))  underline.max  = String(block.DrawingTitle__UnderlineMaxMm);
        if (Number.isFinite(block.DrawingTitle__UnderlineStepMm)) underline.step = String(block.DrawingTitle__UnderlineStepMm);
        if (document.activeElement !== underline) underline.value = String(params.UnderlineMm);
        el('param-title-bar').checked = params.ShowScaleBar === true;

        const hasBar = params.ShowScaleBar === true;
        const right  = hasBar && params.BarPlacement === Na__LeParamTitle__PLACE_RIGHT;
        part('bar-place').hidden = !hasBar;                                     // <-- Nowhere for a bar to sit when there is no bar
        Na__LePanels__FillSelect(el('param-title-bar-place'), [
            { value : Na__LeParamTitle__PLACE_BELOW, label : L('PropsBarBelow', 'Under the title') },
            { value : Na__LeParamTitle__PLACE_RIGHT, label : L('PropsBarRight', 'To the right of it') }
        ], params.BarPlacement);
        part('bar-offset').hidden      = !right;
        part('bar-offset-note').hidden = !right;
        part('bar-offset-note').textContent = L('PropsBarOffsetNote', 'From the title\'s left edge to the bar\'s zero end, in 50 mm steps.');
        const across = el('param-title-bar-offset');
        if (Number.isFinite(block.DrawingTitle__BarOffsetMinMm))  across.min  = String(block.DrawingTitle__BarOffsetMinMm);
        if (Number.isFinite(block.DrawingTitle__BarOffsetMaxMm))  across.max  = String(block.DrawingTitle__BarOffsetMaxMm);
        if (Number.isFinite(block.DrawingTitle__BarOffsetStepMm)) across.step = String(block.DrawingTitle__BarOffsetStepMm);
        if (document.activeElement !== across) across.value = String(params.BarOffsetMm);

        Na__LePanelParam__TITLE_CONTROLS.forEach((name) => { el(name).disabled = !usable; });
        el('param-title-phase').disabled = !usable || params.TitleText !== '';   // <-- A typed title has no qualifier to choose
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Settings Only While One Parametric Element Is Selected
    // ------------------------------------------------------------
    function Na__LePanelParam__SyncProps() {
        const show = !!Na__LePanelParam__Selected();
        Na__LePanels__SetSectionVisible(Na__LePanelParam__PROPS_ID, show);
        if (show) Na__LePanels__Refresh(Na__LePanelParam__PROPS_ID);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives
    // ------------------------------------------------------------
    function Na__LePanelParam__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LePanelParam__LIBRARY_SHOWS.indexOf(reason) !== -1) Na__LePanelParam__SyncLibrary();
        if (Na__LePanelParam__PROPS_SHOWS.indexOf(reason) !== -1) Na__LePanelParam__SyncProps();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Settings Section and Its Controls (right column)
    // ------------------------------------------------------------
    // Every control is one undo step. A scale picked by hand lets go of the
    // viewport; a viewport picked takes its scale; either puts the element
    // back to its standard at the new scale, as the lookup grip's menu does.
    // ------------------------------------------------------------
    function Na__LePanelParam__RegisterProperties() {
        Na__LePanelParam__Wire();
        const on      = Na__LePanels__OnControl;
        const guarded = (run) => (event, el) => {
            const picked = Na__LePanelParam__Selected();
            if (!picked || !Na__LePanels__IsEditable() || Na__LeParam__IsLocked(picked.sheet, picked.groupId)) return;
            run(picked, el);
        };
        on('change', 'param-link',        guarded((picked, el) => {
            if (el.value === Na__LePanelParam__SHEET_LINK) Na__LeParamLink__SetSheetLink(picked.sheet, picked.groupId);
            else Na__LeParamLink__SetLink(picked.sheet, picked.groupId, el.value === Na__LePanelParam__NO_LINK ? null : el.value);
        }));
        on('change', 'param-scale',       guarded((picked, el) => { const d = parseFloat(el.value); if (Number.isFinite(d) && d > 0) Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, d, { link : null }); }));
        on('change', 'param-divisions',   guarded((picked, el) => { const n = parseInt(el.value, 10); if (Number.isFinite(n)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Divisions : n }); }));
        on('change', 'param-subdivide',   guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivideFirst : el.checked })));
        on('change', 'param-subdivision', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivisionMm : mm }); }));
        on('change', 'param-units',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowUnits : el.checked })));
        on('click',  'param-reset',       guarded((picked) => Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, picked.params.ScaleDenominator)));
        on('change', 'param-title-text',      guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TitleText : el.value })));
        on('change', 'param-title-phase',     guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { PhaseMode : el.value })));
        on('change', 'param-title-upper',     guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Uppercase : el.checked })));
        on('change', 'param-title-underline', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { UnderlineMm : mm }); }));
        on('change', 'param-title-bar',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowScaleBar : el.checked })));
        on('change', 'param-title-bar-place', guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { BarPlacement : el.value })));
        on('change', 'param-title-bar-offset', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { BarOffsetMm : mm }); }));
        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelParam__PROPS_ID, title : Na__LeParam__Label('PropsTitle', 'Parametric Element'),
            build : Na__LePanelParam__BuildProps, refresh : Na__LePanelParam__RefreshProps
        });
        Na__LePanels__SetSectionVisible(Na__LePanelParam__PROPS_ID, false);      // <-- Hidden until a parametric element is selected
        Na__LeParam__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeParam__Label('PropsTitle', 'Parametric Element');
            Na__LePanelParam__SyncProps();
        });
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Library Section (the right column's Scrapbook tab)
    // ------------------------------------------------------------
    function Na__LePanelParam__RegisterLibrary() {
        Na__LePanelParam__Wire();
        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelParam__LIBRARY_ID, title : Na__LeParam__Label('LibraryTitle', 'Parametric Scrapbook'), tab : Na__LeScrap__TAB_ID,
            build : Na__LePanelParam__BuildLibrary, refresh : Na__LePanelParam__RefreshLibrary
        });
        Na__LePanels__SetSectionVisible(Na__LePanelParam__LIBRARY_ID, false);    // <-- Hidden until the config says the active sheet has elements
        Na__LeParam__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeParam__Label('LibraryTitle', 'Parametric Scrapbook');
            Na__LePanelParam__SyncLibrary();
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelParam__RegisterProperties,
        Na__LePanelParam__RegisterLibrary
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
