// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: STYLES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Styles__.js
// NAMESPACE  : Na__LePanelStyles
// MODULE     : Layout Editor - Panel Styles
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The per-viewport render composites: which layers and effects go into the picture a viewport shows
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The same four toggles a plan or elevation record carries (D33) plus
//   Hidden Lines (D21), applied to the selected viewport only, so two
//   viewports of one drawing can look different on one sheet. A 3D
//   viewport hides the two that only mean something on a drawing.
//
// INTEGRATION:
// - Registered into the right column by the mode controller.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Styles__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.3.0
// - Context Layer toggle, last in the list. The section is called Render Composites.
//
// 10-Sep-2026 - Version 1.2.0
// - Base Image toggle: the rendered picture behind a viewport, off for vector-only 2D linework.
//
// 10-Sep-2026 - Version 1.1.0
// - Enhance Whitecard toggle (levels and sharpen on the viewport render).
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectedViewport, Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Note
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id and the Toggle Set
    // ------------------------------------------------------------
    const Na__LePanelStyles__ID = 'styles';
    // THE LIST IS IN DRAWING ORDER, and Context Layer sits last because it is
    // the layer furthest back: the rendered picture everything else is drawn
    // over. Switching it off leaves the projected linework alone on the paper,
    // which is the vector drawing a technical sheet usually wants.
    //
    // ITS KEY IS STILL `baseImage`, deliberately. Renaming the key would need a
    // migration of every saved viewport for no gain; the label is what people
    // read and the key is what the records already hold. The old `contextLayer`
    // toggle - which hid the existing building and the landscape categories -
    // is gone from the panel: two controls both claiming to be the context, one
    // of which emptied a renovation drawing entirely, was worse than one that
    // does the obvious thing. The key and its mechanism remain in the record
    // layer, defaulting on, so nothing saved changes meaning.
    const Na__LePanelStyles__TOGGLES = [
        { key : 'projectedLinework', label : 'Projected Linework',      twoDOnly : true },
        { key : 'profileLinework',   label : 'Profile Linework Effect', twoDOnly : false },
        { key : 'glassOpaque',       label : 'Glass Transparency Off',  twoDOnly : false },
        { key : 'whitecard',         label : 'Whitecard',               twoDOnly : false },
        { key : 'enhanceWhitecard',  label : 'Enhance Whitecard',       twoDOnly : false },
        { key : 'hiddenLines',       label : 'Hidden Lines',            twoDOnly : true },
        { key : 'baseImage',         label : 'Context Layer',           twoDOnly : false }
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Toggles
    // ------------------------------------------------------------
    function Na__LePanelStyles__Build(body) {
        const note = Na__LePanels__Note(Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.'));
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);
        Na__LePanelStyles__TOGGLES.forEach((toggle) => {
            const input = Na__LePanels__Input('checkbox', 'style-toggle');
            input.setAttribute('data-na-role', toggle.key);
            const row = Na__LePanels__Row(Na__LeCfg__GetLabel('Style' + toggle.key.charAt(0).toUpperCase() + toggle.key.slice(1), toggle.label), input, 'na-le-row--toggle');
            row.setAttribute('data-na-toggle', toggle.key);
            body.appendChild(row);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelStyles__Refresh(body) {
        const viewport = Na__LeModel__GetSelectedViewport();
        body.querySelector('[data-na-block="note"]').hidden = !!viewport;
        Na__LePanelStyles__TOGGLES.forEach((toggle) => {
            const row = body.querySelector('[data-na-toggle="' + toggle.key + '"]');
            row.hidden = !viewport || (toggle.twoDOnly && viewport.Viewport__Kind !== Na__LeModel__KIND_2D);
            const input = row.querySelector('input');
            if (viewport) input.checked = viewport.Viewport__Styles[toggle.key] === true;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelStyles__Register() {
        Na__LePanels__OnControl('change', 'style-toggle', (e, el, key) => {
            const sheet = Na__LeModel__GetActiveSheet();
            const viewport = Na__LeModel__GetSelectedViewport();
            if (!sheet || !viewport) return;
            const styles = {};
            styles[key] = el.checked;
            Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { styles : styles });
        });
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelStyles__ID, title : Na__LeCfg__GetLabel('StylesTitle', 'Render Composites'),
            build : Na__LePanelStyles__Build, refresh : Na__LePanelStyles__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Styles Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelStyles__Register
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
