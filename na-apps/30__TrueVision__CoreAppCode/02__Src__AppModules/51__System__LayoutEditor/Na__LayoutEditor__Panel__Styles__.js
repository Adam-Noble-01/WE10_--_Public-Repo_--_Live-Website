// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: STYLES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Styles__.js
// NAMESPACE  : Na__LePanelStyles
// MODULE     : Layout Editor - Panel Styles
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The per-viewport render composites: which layers and effects go into the picture a viewport shows, and how thick their lines draw
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The same four toggles a plan or elevation record carries (D33) plus
//   Hidden Lines (D21), applied to the selected viewport only, so two
//   viewports of one drawing can look different on one sheet. A 3D
//   viewport hides the two that only mean something on a drawing.
// - Built from Na__LayoutEditor__RenderComposites__Config__.json rather than a
//   list in this file, so the wording, the order and the weights are config.
// - An Advanced fold under the title reveals a weight beside every composite
//   that actually draws a line. Folded, the panel is exactly the panel it was.
//
// INTEGRATION:
// - Registered into the LEFT column by the mode controller, under Drawing
//   Layers and above Model Layers: the three panels that together say what
//   a viewport's picture is made of.
// - A composite row that carries a toggle still needs its key in the record
//   layer's style list to persist; a config row alone gives a working label
//   and weight, not a new render path.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__Styles__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim until 1.6.0; 1.6.0 and 1.6.1 authored in TrueVision3D
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : 1.6.0 and 1.6.1 ported 13-Sep-2026 as ValeVision3D v2.28.0 (verbatim below the header).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.6.1
// - The Section Outline weight lines up with the weights above and below it:
//   its row keeps an empty slot where a checkbox would be. Base Image gains a
//   weight from the config - how thick the model's own edges draw in the picture.
//
// 12-Sep-2026 - Version 1.6.0
// - The toggle list comes from the Render Composites config, and an Advanced
//   fold reveals a line weight per composite: Projected Linework and Hidden
//   Lines as factors of the sheet master, Profile Linework and Section Outline
//   in buffer pixels. The 2D profile edge width that used to be one global
//   number in the main app config is now the Profile Linework weight here,
//   overridable per viewport.
//
// 12-Sep-2026 - Version 1.5.0
// - A force render button, scoped by the selection: the selected viewport
//   when there is one, every viewport on the sheet when there is not.
//
// 12-Sep-2026 - Version 1.4.0
// - Moved to the left column, under Drawing Layers. It belongs with the
//   other two "what goes in the picture" panels, not with the property
//   editors for whatever happens to be selected.
//
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

    // MODULE IMPORTS | Config, Model, Composites and Panel Host
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelectedViewport, Na__LeModel__UpdateViewport } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeForce__CHANGED_EVENT, Na__LeForce__IsRunning, Na__LeForce__GetProgress, Na__LeForce__Viewport, Na__LeForce__Sheet } from './Na__LayoutEditor__ForceRender__.js';
    import {
        Na__LeComposite__Ready,
        Na__LeComposite__Rows,
        Na__LeComposite__Weight,
        Na__LeComposite__IsOverridden
    } from './Na__LayoutEditor__RenderComposites__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Button,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable,
        Na__LePanels__Note,
        Na__LePanels__AdvancedToggle,
        Na__LePanels__IsAdvanced
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id
    // ------------------------------------------------------------
    const Na__LePanelStyles__ID = 'styles';
    let   Na__LePanelStyles__Listening = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Rows Were Last Built From
    // ------------------------------------------------------------
    // THE LIST IS IN DRAWING ORDER, set by Composite__Order in the config, and
    // Context Layer sits last because it is the layer furthest back: the
    // rendered picture everything else is drawn over.
    //
    // ITS KEY IS STILL `baseImage`, deliberately. Renaming the key would need a
    // migration of every saved viewport for no gain; the label is what people
    // read and the key is what the records already hold.
    // ------------------------------------------------------------
    let Na__LePanelStyles__BuiltKey = null;
    let Na__LePanelStyles__IdSeed   = 0;
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Unit a Weight Is Measured In, for Its Suffix
    // ------------------------------------------------------------
    function Na__LePanelStyles__Unit(kind) {
        return kind === 'pixels' ? 'px' : '×';                               // <-- A multiplication sign: "times the master"
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Inline Weight Cluster for One Composite
    // ------------------------------------------------------------
    function Na__LePanelStyles__WeightCluster(row) {
        const cluster = document.createElement('span');
        cluster.className = 'na-le-row__adv na-le-adv';

        const input = Na__LePanels__Input('number', 'style-weight', { min : row.weight.min, max : row.weight.max, step : row.weight.step });
        input.classList.add('na-le-adv-weight');
        input.setAttribute('data-na-role', row.key);
        input.title = row.weight.kind === 'pixels'
            ? Na__LeCfg__GetLabel('CompositeWeightPixelsHint', 'Line width in render pixels')
            : Na__LeCfg__GetLabel('CompositeWeightFactorHint', 'Multiplier on the sheet viewport lineweight');
        cluster.appendChild(input);

        const unit = document.createElement('span');
        unit.className   = 'na-le-adv-unit';
        unit.textContent = Na__LePanelStyles__Unit(row.weight.kind);
        cluster.appendChild(unit);

        const reset = Na__LePanels__Button('↺', 'style-weight-reset', 'na-le-adv-reset', row.key);
        reset.title = Na__LeCfg__GetLabel('ResetToDefault', 'Back to the config default');
        cluster.appendChild(reset);

        return cluster;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Composite Rows From the Config
    // ------------------------------------------------------------
    // A composite with a toggle is an ordinary checkbox row with its weight
    // inline. A composite with a weight but no toggle - the section outline,
    // which a drawing either has or has not - is a whole row that only exists
    // inside the Advanced fold, because without its weight it has nothing to say.
    //
    // THAT ROW KEEPS AN EMPTY CHECKBOX SLOT. The weights only line up as a
    // column because each sits just before its row's checkbox; take the
    // checkbox away and the weight slides right by its width and gap.
    // ------------------------------------------------------------
    function Na__LePanelStyles__Fill(list) {
        list.innerHTML = '';
        Na__LePanelStyles__Rows().forEach((row) => {
            const hasWeight = row.weight.kind !== 'none';
            if (!row.toggle && !hasWeight) return;

            const label = Na__LeCfg__GetLabel('Style' + row.key.charAt(0).toUpperCase() + row.key.slice(1), row.label);

            if (row.toggle) {
                const input = Na__LePanels__Input('checkbox', 'style-toggle');
                input.setAttribute('data-na-role', row.key);
                input.id = 'na-le-st-' + (++Na__LePanelStyles__IdSeed);

                const element = Na__LePanels__Row(label, input, 'na-le-row--toggle');
                element.htmlFor = input.id;                                       // <-- The checkbox stays the labelled control with the cluster in front of it
                element.setAttribute('data-na-toggle', row.key);
                if (row.note) element.title = row.note;
                if (hasWeight) element.insertBefore(Na__LePanelStyles__WeightCluster(row), input);
                list.appendChild(element);
                return;
            }

            const element = document.createElement('div');
            element.className = 'na-le-row na-le-row--toggle na-le-adv';
            element.setAttribute('data-na-toggle', row.key);
            if (row.note) element.title = row.note;
            const caption = document.createElement('span');
            caption.className   = 'na-le-row__label';
            caption.textContent = label;
            element.appendChild(caption);
            element.appendChild(Na__LePanelStyles__WeightCluster(row));
            const slot = document.createElement('span');
            slot.className = 'na-le-row__check-slot';
            slot.setAttribute('aria-hidden', 'true');
            element.appendChild(slot);
            list.appendChild(element);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rows, Read Once per Refresh
    // ------------------------------------------------------------
    function Na__LePanelStyles__Rows() {
        return Na__LeComposite__Rows();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shell: Advanced Fold, Note, List, Force Render
    // ------------------------------------------------------------
    function Na__LePanelStyles__Build(body) {
        Na__LePanels__AdvancedToggle(body, Na__LePanelStyles__ID, Na__LeCfg__GetLabel('AdvancedToggle', 'Advanced'));

        const note = Na__LePanels__Note(Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.'));
        note.setAttribute('data-na-block', 'note');
        body.appendChild(note);

        const list = document.createElement('div');
        list.setAttribute('data-na-block', 'list');
        body.appendChild(list);

        // THE WAY OUT WHEN A PICTURE IS WRONG AND THE VIEWPORT DISAGREES.
        // It sits under the toggles because that is what it rebuilds, and its
        // wording changes with the selection rather than the button moving or
        // doubling: one button, two scopes, and the label says which you are
        // about to get before you press it.
        const row = document.createElement('div');
        row.className = 'na-le-row na-le-row--buttons';
        row.setAttribute('data-na-block', 'force');
        row.appendChild(Na__LePanels__Button('', 'style-force', 'na-le-btn--wide'));
        body.appendChild(row);

        if (!Na__LePanelStyles__Listening) {                                       // <-- One listener for the module, not one per build
            window.addEventListener(Na__LeForce__CHANGED_EVENT, () => Na__LePanels__Refresh(Na__LePanelStyles__ID));
            Na__LePanelStyles__Listening = true;
        }

        // THE CONFIG ARRIVES LATE AND THAT IS FINE. Until it does the rows build
        // from the module's built-in inventory - the same seven toggles this
        // panel always had - and the real wording and weights replace them.
        Na__LeComposite__Ready().then(() => {
            Na__LePanelStyles__BuiltKey = null;
            Na__LePanels__Refresh(Na__LePanelStyles__ID);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Button Says Right Now
    // ------------------------------------------------------------
    function Na__LePanelStyles__ForceLabel(viewport) {
        if (Na__LeForce__IsRunning()) {
            const p = Na__LeForce__GetProgress();
            return Na__LeCfg__GetLabel('ForceRenderBusy', 'Rendering') + ' ' + Math.min(p.done + 1, p.total) + '/' + p.total + '...';
        }
        return viewport
            ? Na__LeCfg__GetLabel('ForceRenderViewport', 'Render Selected Viewport')
            : Na__LeCfg__GetLabel('ForceRenderDocument', 'Render Document Viewports');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelStyles__Refresh(body) {
        const viewport = Na__LeModel__GetSelectedViewport();
        const rows     = Na__LePanelStyles__Rows();
        const list     = body.querySelector('[data-na-block="list"]');
        body.querySelector('[data-na-block="note"]').hidden = !!viewport;

        const key = rows.map((r) => r.key + ':' + r.toggle + ':' + r.weight.kind).join('|');
        if (key !== Na__LePanelStyles__BuiltKey) {
            Na__LePanelStyles__Fill(list);
            Na__LePanelStyles__BuiltKey = key;
        }

        const force  = body.querySelector('[data-na-block="force"]');
        const button = force.querySelector('[data-na-control="style-force"]');
        button.textContent = Na__LePanelStyles__ForceLabel(viewport);
        button.disabled    = Na__LeForce__IsRunning() || !Na__LePanels__IsEditable();
        force.hidden       = !Na__LePanels__IsEditable();

        const advanced = Na__LePanels__IsAdvanced(Na__LePanelStyles__ID);
        rows.forEach((row) => {
            const element = list.querySelector('[data-na-toggle="' + row.key + '"]');
            if (!element) return;
            element.hidden = !viewport || (row.twoDOnly && viewport.Viewport__Kind !== Na__LeModel__KIND_2D);
            if (!viewport) return;

            const toggle = element.querySelector('[data-na-control="style-toggle"]');
            if (toggle) toggle.checked = viewport.Viewport__Styles[row.key] === true;

            // A WEIGHT CAN BE 2D-ONLY WHEN ITS TOGGLE IS NOT. The profile effect
            // switches on in 3D as well, but its 3D width is the composer's own
            // distance-scaled number, so a 3D viewport shows the toggle alone.
            const cluster       = element.querySelector('.na-le-row__adv');
            const weightApplies = row.weight.kind !== 'none' && !(row.weight.twoDOnly && viewport.Viewport__Kind !== Na__LeModel__KIND_2D);
            if (cluster) cluster.classList.toggle('na-le-adv--off', !weightApplies);
            if (!advanced || !weightApplies) return;                              // <-- Only fill controls a person can see
            const weight = element.querySelector('[data-na-control="style-weight"]');
            if (weight && document.activeElement !== weight) weight.value = String(Na__LeComposite__Weight(viewport, row.key));
            element.classList.toggle('is-overridden', Na__LeComposite__IsOverridden(viewport, row.key));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One Composite Weight Patch to the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelStyles__ApplyWeight(key, value) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        if (!sheet || !viewport) return;
        const weights = {};
        weights[key]  = value;
        Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { compositeWeights : weights });
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
        Na__LePanels__OnControl('change', 'style-weight', (e, el, key) => {
            const value = parseFloat(el.value);
            if (Number.isFinite(value)) Na__LePanelStyles__ApplyWeight(key, value);
        });
        Na__LePanels__OnControl('click', 'style-weight-reset', (e, el, key) => {
            e.preventDefault();                                                   // <-- Inside a label: do not let the click reach the checkbox
            Na__LePanelStyles__ApplyWeight(key, null);
        });
        Na__LePanels__OnControl('click', 'style-force', () => {
            const sheet = Na__LeModel__GetActiveSheet();
            if (!sheet || Na__LeForce__IsRunning()) return;
            const viewport = Na__LeModel__GetSelectedViewport();
            void (viewport ? Na__LeForce__Viewport(sheet, viewport.Viewport__Id) : Na__LeForce__Sheet(sheet));
        });
        return Na__LePanels__RegisterSection('left', {
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
