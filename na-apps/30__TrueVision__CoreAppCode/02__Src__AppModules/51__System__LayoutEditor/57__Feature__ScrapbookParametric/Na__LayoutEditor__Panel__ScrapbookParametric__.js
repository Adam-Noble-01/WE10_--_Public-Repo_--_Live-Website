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
// - THE LIBRARY, in the left column under the Scrapbook: one tile per
//   element the config offers on the active sheet's drawing type. A tile is
//   dragged onto the paper or double-clicked, exactly like every other
//   scrapbook tile (Na__LayoutEditor__Scrapbook__TileDrag__). The element
//   lands linked to the viewport nearest the drop and at that viewport's
//   scale.
// - THE SETTINGS, at the TOP of the right column, shown only while one
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
//   Viewport section (so it sits first in the right column) and
//   RegisterLibrary after the Scrapbook section.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__Grips__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported; see Na__LayoutEditor__ScrapbookParametric__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
        Na__LeParam__ElementsFor,
        Na__LeParam__ElementName,
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
        Na__LeParamLink__Attach,
        Na__LeParamLink__Candidates,
        Na__LeParamLink__ViewportName,
        Na__LeParamLink__ResolveById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__InsertLinked
    } from './Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    import { Na__LeParamGrips__Attach } from './Na__LayoutEditor__ScrapbookParametric__Grips__.js';
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
        Na__LeParamLink__Attach();
        Na__LeParamGrips__Attach();
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LePanelParam__OnModelChanged);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Library Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element as the Tile Drag's Spec
    // ------------------------------------------------------------
    // The tile and the ghost draw the element at its type's default scale. The
    // drop is the link module's: it reads the scale off the nearest viewport.
    // ------------------------------------------------------------
    function Na__LePanelParam__Spec(element, editable) {
        const name = Na__LeParam__ElementName(element);
        const hint = (typeof element.Element__Description === 'string' && element.Element__Description !== '') ? element.Element__Description : '';
        const drag = Na__LeParam__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view.', { name : name });
        return {
            id       : 'parametric:' + element.Element__Type,
            name     : name,
            title    : editable ? (hint !== '' ? hint + '\n\n' + drag : drag) : name,
            editable : editable,
            modifier : 'na-le-scrap__item--param',
            buildSet : () => Na__LeParam__BuildSet(element.Element__Type, null, null),
            place    : (sheet, centreMm) => Na__LeParamLink__InsertLinked(sheet, element.Element__Type, centreMm)
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
        const signature = [ status, editable ? 'edit' : 'view' ].concat(elements.map((element) => element.Element__Type)).join('|');
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
        body.appendChild(Na__LePanels__Row(L('PropsScale', 'Scale'), Na__LePanels__Select('param-scale', [], null)));
        body.appendChild(Na__LePanels__Row(L('PropsDivisions', 'Divisions'), Na__LePanels__Input('number', 'param-divisions', { min : 1, max : 40, step : 1 })));

        const length = Na__LePanels__Note('');
        length.setAttribute('data-na-param', 'length');
        body.appendChild(length);

        body.appendChild(Na__LePanels__Row(L('PropsSubdivide', 'Split first division'), Na__LePanels__Input('checkbox', 'param-subdivide'), 'na-le-row--toggle'));
        const into = Na__LePanels__Row(L('PropsSubdivision', 'Into'), Na__LePanels__Select('param-subdivision', [], null));
        into.setAttribute('data-na-param', 'into');
        body.appendChild(into);
        body.appendChild(Na__LePanels__Row(L('PropsUnits', 'Show units'), Na__LePanels__Input('checkbox', 'param-units'), 'na-le-row--toggle'));

        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Button(L('PropsReset', 'Reset to standard'), 'param-reset', ''));
        body.appendChild(bar);

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

        const linked   = Na__LeParamLink__ResolveById(picked.sheet, picked.groupId);
        const linkable = Na__LeParamLink__Candidates(picked.sheet);
        Na__LePanels__FillSelect(el('param-link'),
            [ { value : Na__LePanelParam__NO_LINK, label : L('PropsLinkNone', 'Not linked') } ].concat(linkable.map((viewport) => ({ value : viewport.Viewport__Id, label : Na__LeParamLink__ViewportName(viewport) }))),
            linked ? linked.Viewport__Id : Na__LePanelParam__NO_LINK);

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

        [ 'param-link', 'param-scale', 'param-divisions', 'param-subdivide', 'param-subdivision', 'param-units', 'param-reset' ].forEach((name) => { el(name).disabled = !usable; });
        part('foot').textContent = locked ? L('PropsLocked', 'Its layer is locked.') : L('PropsExplode', 'Ungroup it (Ctrl+Shift+G) to explode it into plain vectors and text.');
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
        on('change', 'param-link',        guarded((picked, el) => Na__LeParamLink__SetLink(picked.sheet, picked.groupId, el.value === Na__LePanelParam__NO_LINK ? null : el.value)));
        on('change', 'param-scale',       guarded((picked, el) => { const d = parseFloat(el.value); if (Number.isFinite(d) && d > 0) Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, d, { link : null }); }));
        on('change', 'param-divisions',   guarded((picked, el) => { const n = parseInt(el.value, 10); if (Number.isFinite(n)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Divisions : n }); }));
        on('change', 'param-subdivide',   guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivideFirst : el.checked })));
        on('change', 'param-subdivision', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivisionMm : mm }); }));
        on('change', 'param-units',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowUnits : el.checked })));
        on('click',  'param-reset',       guarded((picked) => Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, picked.params.ScaleDenominator)));
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


    // FUNCTION | Register the Library Section (left column)
    // ------------------------------------------------------------
    function Na__LePanelParam__RegisterLibrary() {
        Na__LePanelParam__Wire();
        const entry = Na__LePanels__RegisterSection('left', {
            id : Na__LePanelParam__LIBRARY_ID, title : Na__LeParam__Label('LibraryTitle', 'Parametric Scrapbook'),
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
