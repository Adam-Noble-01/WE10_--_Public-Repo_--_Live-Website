// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: SITE PLAN RENDER COMPOSITES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__SitePlanComposites__.js
// NAMESPACE  : Na__LePanelSpComp
// MODULE     : Layout Editor - Panel Site Plan Render Composites
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The three decks a site plan viewport's picture is made of - solid fills, hatch patterns, linework - switched per viewport
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - Adam, TASK 06: 'In the left menu add a Site Plan Render Composites
//   dropdown, which functions exactly like the other render composites, with
//   the same kind of controls, so you can flip off the coloured underlying
//   filled polygon and hatched polygon layers.'
// - So it IS the other panel, with the site plan's decks instead of the 3D
//   picture's layers: the same section, the same checkbox rows, the same
//   "select a viewport" note, built from
//   Na__LayoutEditor__SitePlanComposites__Config__.json rather than a list
//   in this file.
// - It also says which subtype the selected viewport is drawing as, and why:
//   a location plan paints no patterns whatever the pattern switch says, and
//   a reader who cannot see that written down will think the switch is broken.
//
// INTEGRATION:
// - Registered into the LEFT column immediately after Render Composites, so
//   the two panels that say what a picture is made of sit together, and
//   before Model Layers, which says which layers go into it.
// - HIDDEN ENTIRELY off a site plan sheet. An architectural sheet has no site
//   plan viewport to switch, and an empty panel in the left column is worse
//   than no panel: every other section moves down for nothing.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none (TrueVision-only: site plan drawings)
// - Parity        : n/a
// - Divergences   : n/a
// - Back-port     : goes to ValeVision3D with the site plan feature, if that is ever ported
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for TASK 06.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and the Deck Inventory
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__UpdateViewport
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSpComp__PLAN_LOCAL,
        Na__LeSpComp__Ready,
        Na__LeSpComp__GetDecks,
        Na__LeSpComp__IsDeckOn,
        Na__LeSpComp__PlanType
    } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Refresh,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelSpComp__ID = 'siteplan-composites';
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Rows Were Last Built From
    // ------------------------------------------------------------
    let Na__LePanelSpComp__BuiltKey = null;
    let Na__LePanelSpComp__IdSeed   = 0;
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Site Plan Viewport, or null
    // ------------------------------------------------------------
    function Na__LePanelSpComp__Selected() {
        const viewport = Na__LeModel__GetSelectedViewport();
        return (viewport && Na__LeModel__IsSitePlanViewport(viewport)) ? viewport : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Deck Rows From the Config
    // ------------------------------------------------------------
    // Bottom to top, exactly as they paint: solid fills, then patterns, then
    // linework. An ordinary checkbox row apiece, the same control the Render
    // Composites panel uses for a 3D picture's layers.
    // ------------------------------------------------------------
    function Na__LePanelSpComp__Fill(list) {
        list.innerHTML = '';
        Na__LeSpComp__GetDecks().forEach((deck) => {
            const label = Na__LeCfg__GetLabel('SitePlanDeck' + deck.key.charAt(0).toUpperCase() + deck.key.slice(1), deck.label);
            const input = Na__LePanels__Input('checkbox', 'spcomp-toggle');
            input.setAttribute('data-na-role', deck.key);
            input.id = 'na-le-spc-' + (++Na__LePanelSpComp__IdSeed);

            const element = Na__LePanels__Row(label, input, 'na-le-row--toggle');
            element.htmlFor = input.id;
            element.setAttribute('data-na-toggle', deck.key);
            if (deck.note) element.title = deck.note;
            list.appendChild(element);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shell: Note, List, Subtype Line
    // ------------------------------------------------------------
    function Na__LePanelSpComp__Build(body) {
        const note = Na__LePanels__Note(Na__LeCfg__GetLabel('SitePlanCompositesNoSelection', 'Select a site plan viewport on the sheet.'));
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);

        const list = document.createElement('div');
        list.setAttribute('data-na-block', 'list');
        body.appendChild(list);

        // WHY A SWITCH IS NOT DOING WHAT IT SAYS. A location plan paints no
        // patterns whatever the pattern deck is set to, and the only honest way
        // to show a control that is being overruled is to say so beside it.
        const why = Na__LePanels__Note('');
        why.setAttribute('data-na-block', 'why');
        body.appendChild(why);

        Na__LeSpComp__Ready().then(() => {
            Na__LePanelSpComp__BuiltKey = null;
            Na__LePanels__Refresh(Na__LePanelSpComp__ID);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelSpComp__Refresh(body) {
        // OFF A SITE PLAN SHEET THE SECTION IS NOT THERE AT ALL.
        const sheet = Na__LeModel__GetActiveSheet();
        Na__LePanels__SetSectionVisible(Na__LePanelSpComp__ID, !!sheet && Na__LeModel__IsSitePlanSheet(sheet));

        const viewport = Na__LePanelSpComp__Selected();
        const decks    = Na__LeSpComp__GetDecks();
        const list     = body.querySelector('[data-na-block="list"]');
        body.querySelector('[data-na-block="note"]').hidden = !!viewport;

        const key = decks.map((deck) => deck.key).join('|');
        if (key !== Na__LePanelSpComp__BuiltKey) {
            Na__LePanelSpComp__Fill(list);
            Na__LePanelSpComp__BuiltKey = key;
        }

        const isLocation = !!viewport && Na__LeSpComp__PlanType(viewport) === Na__LeSpComp__PLAN_LOCAL;
        decks.forEach((deck) => {
            const element = list.querySelector('[data-na-toggle="' + deck.key + '"]');
            if (!element) return;
            element.hidden = !viewport;
            if (!viewport) return;
            const toggle = element.querySelector('[data-na-control="spcomp-toggle"]');
            if (toggle) toggle.checked = Na__LeSpComp__IsDeckOn(viewport, deck.key);
            // A deck the subtype overrules reads as overridden, the same way an
            // edge style that disagrees with its default does.
            element.classList.toggle('is-overridden', isLocation && deck.key === 'patterns');
        });

        const why = body.querySelector('[data-na-block="why"]');
        why.hidden = !viewport || !isLocation;
        if (viewport && isLocation) {
            why.textContent = Na__LeCfg__GetLabel(
                'SitePlanCompositesLocationNote',
                'This viewport draws as a location plan: only the proposed fills are painted, no patterns, and every line but the boundary is greyscale. Change it under Plan type on the Viewport panel.'
            );
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelSpComp__Register() {
        Na__LePanels__OnControl('change', 'spcomp-toggle', (e, el, key) => {
            const sheet    = Na__LeModel__GetActiveSheet();
            const viewport = Na__LePanelSpComp__Selected();
            if (!sheet || !viewport) return;
            const decks = {};
            decks[key]  = el.checked;
            Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { sitePlanComposites : decks });
        });
        const entry = Na__LePanels__RegisterSection('left', {
            id    : Na__LePanelSpComp__ID,
            title : Na__LeCfg__GetLabel('SitePlanCompositesTitle', 'Site Plan Render Composites'),
            build : Na__LePanelSpComp__Build,
            refresh : Na__LePanelSpComp__Refresh
        });
        Na__LePanels__SetSectionVisible(Na__LePanelSpComp__ID, false);            // <-- Hidden until a site plan sheet is announced
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan Composites Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelSpComp__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
