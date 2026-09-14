// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TAB STRIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__TabStrip__.js
// NAMESPACE  : Na__LeTabs
// MODULE     : Layout Editor - Tab Strip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The row of tabs under the header: 3D Model, one per sheet, and a plus on localhost
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Shown whenever the project has a sheet (or the session can make one).
//   Its height is published as --Vale_LayoutTabStripHeight and the body
//   carries na-layout-tabs--visible, so the canvas, menus, breadcrumb and
//   carousel shift down by the same amount (D22, D23, D24).
// - The 3D Model tab leaves the editor; a sheet tab enters it on that
//   sheet; the plus tab makes a sheet and opens it. Double-click a sheet
//   tab to rename it (localhost). Web viewers switch tabs but cannot add,
//   rename or reorder.
// - ORDER: 3D Model | architectural sheets | + | site plan sheets | Project
//   Specification. A site plan sheet (Sheet__DrawingType) sits after the
//   plus, so a new sheet lands beside it and site plans stay beside the
//   specification. A drag reorders only within its own group.
//
// INTEGRATION:
// - Initialized from index.html after the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__TabStrip__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (Sheet__DrawingType), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.3.1
// - The green mark on site plan tabs is gone (Adam): beside tabs without one it
//   read as more important. The na-le-tabs__tab--siteplan class stays, unstyled.
//
// 14-Sep-2026 - Version 1.3.0
// - Site plan drawings: the strip reads 3D Model | architectural sheets | + |
//   site plan sheets | Project Specification. A site plan tab carries a small
//   green mark and a drag reorders only within its own group. The rebuild
//   signature includes each sheet's drawing type.
//
// 14-Sep-2026 - Version 1.2.0
// - Project Specification: while a drawing tab is open, a Project
//   Specification tab sits at the end of the strip (Na__LeMode__OpenSpecification).
//   It is the active tab while its page is showing, and carries an amber dot
//   while the specification holds changes the cloud has not got.
//
// 13-Sep-2026 - Version 1.1.0
// - A model change rebuilds the strip only when a tab would look different - a
//   sheet added, removed, renamed, reordered or opened - instead of on every edit.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and Mode Controller
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__IsEnabled } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetSheets,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__CreateSheet,
        Na__LeModel__UpdateSheet,
        Na__LeModel__ReorderSheet,
        Na__LeModel__IsSitePlanSheet
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeMode__CHANGED_EVENT,
        Na__LeMode__Enter,
        Na__LeMode__Leave,
        Na__LeMode__IsActive,
        Na__LeMode__IsEditable,
        Na__LeMode__Ready,
        Na__LeMode__VIEW_SPEC,
        Na__LeMode__GetView,
        Na__LeMode__OpenSpecification
    } from './Na__LayoutEditor__ModeController__.js';
    import { Na__LeSpec__CHANGED_EVENT, Na__LeSpec__IsDirty } from './Na__LayoutEditor__SpecData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Ids, Classes and the Published Height
    // ------------------------------------------------------------
    const Na__LeTabs__NAV_ID     = 'naLayoutEditorTabStrip';
    const Na__LeTabs__BODY_CLASS = 'na-layout-tabs--visible';
    const Na__LeTabs__CSS_VAR    = '--Vale_LayoutTabStripHeight';
    const Na__LeTabs__HEIGHT_PX  = 36;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Root and Drag State
    // ------------------------------------------------------------
    let Na__LeTabs__Root    = null;
    let Na__LeTabs__DragId  = null;
    let Na__LeTabs__DragSitePlan = false;    // <-- The dragged tab's group; a drop lands only inside it
    let Na__LeTabs__Signature = null;    // <-- What the strip last drew, so a change that alters no tab skips the rebuild
    let Na__LeTabs__Visible = null;    // <-- Last published state; the resize only fires on a change
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Tab Button
    // ------------------------------------------------------------
    function Na__LeTabs__Tab(text, active, onClick, modifier) {
        const button = document.createElement('button');
        button.type        = 'button';
        button.className   = 'na-le-tabs__tab' + (active ? ' na-le-tabs__tab--active' : '') + (modifier ? ' ' + modifier : '');
        button.textContent = text;
        button.setAttribute('aria-pressed', String(!!active));
        button.addEventListener('click', onClick);
        return button;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Inline Rename of a Sheet Tab
    // ------------------------------------------------------------
    function Na__LeTabs__Rename(button, sheet) {
        const input = document.createElement('input');
        input.type      = 'text';
        input.className = 'na-le-tabs__rename';
        input.value     = sheet.Sheet__Name;
        const commit = () => { const v = input.value.trim(); if (v && v !== sheet.Sheet__Name) Na__LeModel__UpdateSheet(sheet, { name : v }); else Na__LeTabs__Render(); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } if (e.key === 'Escape') { input.value = sheet.Sheet__Name; input.blur(); } e.stopPropagation(); });
        input.addEventListener('blur', commit);
        button.replaceWith(input);
        input.focus(); input.select();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Publish Visibility to the Rest of the Shell
    // ------------------------------------------------------------
    function Na__LeTabs__Publish(visible) {
        document.documentElement.style.setProperty(Na__LeTabs__CSS_VAR, (visible ? Na__LeTabs__HEIGHT_PX : 0) + 'px');
        document.body.classList.toggle(Na__LeTabs__BODY_CLASS, visible);
        if (Na__LeTabs__Root) Na__LeTabs__Root.hidden = !visible;
        if (visible === Na__LeTabs__Visible) return;
        Na__LeTabs__Visible = visible;
        window.dispatchEvent(new Event('resize'));                               // <-- Canvas-sized listeners re-measure once per change
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Tabs
    // ------------------------------------------------------------
    function Na__LeTabs__Render() {
        if (!Na__LeTabs__Root) return;
        Na__LeTabs__Signature = Na__LeTabs__Sig();                              // <-- Recorded by every build, direct or gated, so the gate can never go stale
        const sheets   = Na__LeModel__GetSheets();
        const editable = Na__LeMode__IsEditable();
        const onSpec   = Na__LeMode__IsActive() && Na__LeMode__GetView() === Na__LeMode__VIEW_SPEC;
        const active   = (Na__LeMode__IsActive() && !onSpec) ? Na__LeModel__GetActiveSheet() : null;   // <-- No sheet tab is the open one while the specification is
        const visible  = Na__LeCfg__IsEnabled() && (sheets.length > 0 || editable);
        Na__LeTabs__Root.innerHTML = '';
        Na__LeTabs__Publish(visible);
        if (!visible) return;

        Na__LeTabs__Root.appendChild(Na__LeTabs__Tab(Na__LeCfg__GetLabel('ModelTab', '3D Model'), !Na__LeMode__IsActive(), () => Na__LeMode__Leave(), 'na-le-tabs__tab--model'));
        const sitePlanTitle = Na__LeCfg__GetLabel('SitePlanTabTitle', 'Site plan drawing');
        const addSheetTab = (sheet) => {
            const sitePlan = Na__LeModel__IsSitePlanSheet(sheet);
            const tab = Na__LeTabs__Tab(sheet.Sheet__Name, !!active && active.Sheet__Id === sheet.Sheet__Id, () => Na__LeMode__Enter(sheet.Sheet__Id), sitePlan ? 'na-le-tabs__tab--siteplan' : '');
            tab.setAttribute('data-na-sheet-id', sheet.Sheet__Id);
            if (sitePlan) tab.title = sitePlanTitle;
            if (editable) {
                tab.title = (sitePlan ? sitePlanTitle + '. ' : '') + 'Double-click to rename, drag to reorder';
                tab.addEventListener('dblclick', () => Na__LeTabs__Rename(tab, sheet));
                tab.draggable = true;
                tab.addEventListener('dragstart', (e) => { Na__LeTabs__DragId = sheet.Sheet__Id; Na__LeTabs__DragSitePlan = sitePlan; e.dataTransfer.effectAllowed = 'move'; });
                tab.addEventListener('dragover', (e) => { if (Na__LeTabs__DragId && Na__LeTabs__DragId !== sheet.Sheet__Id && Na__LeTabs__DragSitePlan === sitePlan) e.preventDefault(); });   // <-- Only inside its own group
                tab.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (!Na__LeTabs__DragId || Na__LeTabs__DragId === sheet.Sheet__Id || Na__LeTabs__DragSitePlan !== sitePlan) return;
                    Na__LeModel__ReorderSheet(Na__LeTabs__DragId, Na__LeModel__GetSheets().findIndex((s) => s.Sheet__Id === sheet.Sheet__Id));
                    Na__LeTabs__DragId = null;
                });
                tab.addEventListener('dragend', () => { Na__LeTabs__DragId = null; });
            }
            Na__LeTabs__Root.appendChild(tab);
        };
        sheets.filter((sheet) => !Na__LeModel__IsSitePlanSheet(sheet)).forEach(addSheetTab);   // <-- Architectural drawings, before the plus
        if (editable) {
            const plus = Na__LeTabs__Tab(Na__LeCfg__GetLabel('AddSheetTab', '+'), false, () => {
                const sheet = Na__LeModel__CreateSheet({});
                if (sheet) Na__LeMode__Enter(sheet.Sheet__Id);
            }, 'na-le-tabs__tab--add');
            plus.title = Na__LeCfg__GetLabel('AddSheetTitle', 'New sheet');
            Na__LeTabs__Root.appendChild(plus);
        }
        sheets.filter((sheet) => Na__LeModel__IsSitePlanSheet(sheet)).forEach(addSheetTab);    // <-- Site plan drawings last, beside the Project Specification

        // PROJECT SPECIFICATION | Last, and only while a drawing tab is open
        if (Na__LeMode__IsActive()) {
            const unsynced = Na__LeSpec__IsDirty();
            const spec = Na__LeTabs__Tab(Na__LeCfg__GetLabel('SpecificationTab', 'Project Specification'), onSpec, () => Na__LeMode__OpenSpecification(),
                'na-le-tabs__tab--spec' + (unsynced ? ' na-le-tabs__tab--unsynced' : ''));
            spec.title = unsynced
                ? Na__LeCfg__GetLabel('SpecificationTabUnsynced', 'Project Specification - changes kept in this browser, not yet synced')
                : Na__LeCfg__GetLabel('SpecificationTabTitle', 'Every drawing note of the project, grouped and numbered');
            Na__LeTabs__Root.appendChild(spec);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Everything a Tab Shows, as One Comparable String
    // ------------------------------------------------------------
    function Na__LeTabs__Sig() {
        const sheets = Na__LeModel__GetSheets();
        const active = Na__LeMode__IsActive() ? Na__LeModel__GetActiveSheet() : null;
        return sheets.map((sheet) => sheet.Sheet__Id + '\u0001' + sheet.Sheet__Name + '\u0001' + Na__LeModel__IsSitePlanSheet(sheet)).join('\u0002')   // <-- A change of drawing type moves the tab
            + '|' + (active ? active.Sheet__Id : '') + '|' + Na__LeMode__IsActive() + '|' + Na__LeMode__IsEditable() + '|' + Na__LeCfg__IsEnabled()
            + '|' + Na__LeMode__GetView() + '|' + Na__LeSpec__IsDirty();          // <-- The specification tab: open or not, synced or not
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives: Rebuild Only if a Tab Would Change
    // ------------------------------------------------------------
    // The strip used to be torn down and rebuilt on EVERY model change - each
    // nudge, each style paint, each vertex of a shape - although a tab only
    // shows a sheet's name and whether it is the open one. Rebuilding also
    // threw away a rename field half-typed whenever something else on the
    // sheet changed underneath it. Render records the signature of what it
    // drew, so the comparison is always against the strip actually on screen.
    // ------------------------------------------------------------
    function Na__LeTabs__OnModelChanged() {
        if (Na__LeTabs__Root && Na__LeTabs__Root.childElementCount > 0 && Na__LeTabs__Sig() === Na__LeTabs__Signature) return;
        Na__LeTabs__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Strip Under the Header
    // ------------------------------------------------------------
    function Na__LeTabs__Initialize() {
        if (Na__LeTabs__Root) return true;
        const header = document.querySelector('.app-header');
        const nav = document.createElement('nav');
        nav.id        = Na__LeTabs__NAV_ID;
        nav.className = 'na-le-tabs';
        nav.setAttribute('aria-label', 'Drawing sheets');
        nav.hidden = true;
        if (header && header.parentNode) header.parentNode.insertBefore(nav, header.nextSibling);
        else document.body.insertBefore(nav, document.body.firstChild);
        Na__LeTabs__Root = nav;
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeTabs__OnModelChanged);   // <-- Only when a tab would look different
        window.addEventListener(Na__LeSpec__CHANGED_EVENT,  Na__LeTabs__OnModelChanged);   // <-- The specification tab's unsynced dot
        window.addEventListener(Na__LeMode__CHANGED_EVENT,  () => Na__LeTabs__Render());
        Na__LeMode__Ready().then(() => Na__LeTabs__Render());
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Tab Strip API
    // ------------------------------------------------------------
    export {
        Na__LeTabs__Initialize,
        Na__LeTabs__Render
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
