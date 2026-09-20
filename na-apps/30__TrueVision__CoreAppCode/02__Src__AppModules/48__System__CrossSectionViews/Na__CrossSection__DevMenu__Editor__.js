// =============================================================================
// TRUEVISION3D - CROSS SECTION VIEWS - DEV MENU EDITOR (PLACEHOLDER)
// =============================================================================
//
// FILE       : Na__CrossSection__DevMenu__Editor__.js
// NAMESPACE  : Na__XSecDev
// MODULE     : Cross Section Views - Dev Menu Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the Cross Sections place in the Dev Tools menu, in the same shape as Floor Plans and Elevations, until the system is built
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - A PLACEHOLDER, ON PURPOSE. Adam, 20-Sep-2026: "Add a cross-sections section
//   to the menu as well. We will add the full system, but I just want the
//   placeholder added there now... the cross-sections menu will use the same
//   style of menu as the elevations and plans because it's effectively just
//   another take using the cross-sections (but allowing you to cut anywhere
//   through the building, rather than an elevation or a plan)."
// - So this is the third panel of the family and nothing more: the shared head
//   with its + (switched off, and saying why), and a note that says what the
//   panel will do and where a section is drawn in the meantime. It authors
//   nothing, stores nothing and saves nothing.
// - IT LISTS WHAT ALREADY EXISTS. A section can be drawn today - it is an
//   elevation whose Drawing type is Section - so the panel names those, which
//   stops it reading as "this project has no sections" on a project that has
//   three. They are edited in Elevations; the list is not a second editor.
//
// WHEN THE SYSTEM IS BUILT:
// - Rows fold through Na__DrawView__RowAccordion__, an open row is a draft
//   through Na__DrawView__DraftGuard__ (register an owner for the new type),
//   and the head, the chips, Update / Revert, the danger zone and the two
//   dialogs all come from Na__DrawView__DevRowShell__ - exactly as the other
//   two panels do. A free cut needs a plane with a bearing AND a tilt, which
//   is what 47__System__DrawingPlanes's source adapter was shaped to allow.
//
// INTEGRATION:
// - Initialized from Index.html beside the Floor Plans and Elevations editors.
// // @delegate: ../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 0.1.0
// - Placeholder panel: the menu entry, the shared head, the note, and the list
//   of sections already drawn as elevations.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Shared Panel Head, and the Sections That Exist Today
    // ------------------------------------------------------------
    import { Na__DrawShell__BuildPanelHead } from '../40__System__DrawingViewCore/Na__DrawView__DevRowShell__.js';
    import { Na__DrawData__CHANGED_EVENT } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import {
        Na__ElevData__GetElevations,
        Na__ElevData__IsSection
    } from '../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers and Wording
    // ------------------------------------------------------------
    const Na__XSecDev__PANEL_ID  = 'naCrossSectionDevPanel';
    const Na__XSecDev__ITEM_ID   = 'naCrossSectionDevItem';
    const Na__XSecDev__TOGGLE_ID = 'naCrossSectionDevToggle';

    const Na__XSecDev__TITLE     = 'Cross Sections';
    const Na__XSecDev__ADD_TITLE = 'Cross sections are not built yet. Until they are, add an elevation and set its Drawing type to Section.';
    const Na__XSecDev__NOTE      = 'Coming next: a section cut anywhere through the building - at any bearing, not only square to a '
                                 + 'face - authored here the way floor plans and elevations are: one drawing open at a time, a plane '
                                 + 'you can see and drag in the 3D view, and a green Update that asks before it keeps anything.';
    const Na__XSecDev__MEANWHILE = 'Until then a section is drawn in Elevations: open an elevation and set its Drawing type to Section.';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Panel
    // ------------------------------------------------------------
    let Na__XSecDev__Panel = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Quiet Paragraph
    // ------------------------------------------------------------
    function Na__XSecDev__Note(text) {
        const note = document.createElement('p');
        note.className   = 'na-fp-dev__empty';
        note.textContent = text;
        return note;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Placeholder Panel
    // ------------------------------------------------------------
    function Na__XSecDev__Render() {
        if (!Na__XSecDev__Panel) return;
        Na__XSecDev__Panel.innerHTML = '';

        Na__XSecDev__Panel.appendChild(Na__DrawShell__BuildPanelHead({
            title       : Na__XSecDev__TITLE,
            addTitle    : Na__XSecDev__ADD_TITLE,
            addDisabled : true
        }));

        Na__XSecDev__Panel.appendChild(Na__XSecDev__Note(Na__XSecDev__NOTE));
        Na__XSecDev__Panel.appendChild(Na__XSecDev__Note(Na__XSecDev__MEANWHILE));

        // WHAT EXISTS TODAY | Named, not editable: Elevations owns them.
        const sections = Na__ElevData__GetElevations(null).filter((elevation) => Na__ElevData__IsSection(elevation));
        if (sections.length > 0) {
            const caption = document.createElement('div');
            caption.className   = 'na-draw-dev__caption';
            caption.textContent = 'Sections on this project (edit them in Elevations)';
            Na__XSecDev__Panel.appendChild(caption);

            const list = document.createElement('ul');
            list.className = 'na-draw-dev__placeholder-list';
            sections.forEach((section) => {
                const item = document.createElement('li');
                item.textContent = section.Elevation__Name;
                list.appendChild(item);
            });
            Na__XSecDev__Panel.appendChild(list);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Localhost-Only Cross Sections Placeholder
    // ------------------------------------------------------------
    // Mirrors the other drawing panels: the wrapper is revealed, the toggle
    // opens the panel, and the panel rebuilds on every open.
    // ------------------------------------------------------------
    function Na__CrossSection__DevMenu__Initialize() {
        const menuItem = document.getElementById(Na__XSecDev__ITEM_ID);
        const toggle   = document.getElementById(Na__XSecDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__XSecDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                        // <-- Markup absent: nothing to mount into

        Na__XSecDev__Panel     = panel;
        menuItem.style.display = '';                                             // <-- Reveal alongside the other dev tools

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) Na__XSecDev__Render();
        });

        window.addEventListener(Na__DrawData__CHANGED_EVENT, () => {
            if (panel.classList.contains('is-open')) Na__XSecDev__Render();      // <-- A section was added, renamed or deleted in Elevations
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Cross Sections Dev Menu API
    // ------------------------------------------------------------
    export {
        Na__CrossSection__DevMenu__Initialize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
