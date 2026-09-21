// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: PATTERNS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__Patterns__.js
// NAMESPACE  : Na__LePanelPatterns
// MODULE     : Layout Editor - Panel Patterns
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The hatch pattern library, and the hatch on each site plan layer
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The LAST panel in the right column, as asked for: a pattern library grouped
//   by pack, and - when a site plan viewport is selected - a row per fillable
//   layer saying which pattern it draws, at what scale and turned how far.
// - A layer's hatch comes from the Tags SSOT by default (SitePlan__FillHatchId),
//   so woodland is hatched with no user action at all. This panel OVERRIDES that
//   per viewport, which is what makes one pattern reusable at different sizes on
//   different drawings.
// - Choosing a pattern with no layer selected does nothing destructive: it only
//   highlights it. A pattern is applied to the layer chosen in the layer row.
//
// INTEGRATION:
// - Registered last in the right column by the mode controller.
// - Reads the library through Na__LayoutEditor__HatchPatterns__, and the layer
//   list through the site plan store.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Line pt and Line colour for the layer's hatch, under Rotation deg, and a
//   Standard button that shows once either is set - the same two controls, with
//   the same meaning, as a vector's hatch has in the Vectors panel. Stored on
//   the viewport per layer as Hatch__StrokePt and Hatch__Colour; choosing
//   another pattern clears both so it starts from its own standards. The colour
//   box opens the Colour Palette like every other colour field.
// - A library tile is drawn in its pack's own swatch ink (Pack__SwatchInk), so
//   the construction materials are not painted woodland green.
// - (20-Sep-2026, unrecorded here: the per-layer Fill switch and Enter to
//   commit a typed scale or rotation.)
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Panels, Model, Config
    // ------------------------------------------------------------
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__Refresh,
        Na__LePanels__Row,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Input,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__IsSitePlanViewport
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetLineweightSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Library and the Site Plan Store
    // ------------------------------------------------------------
    import {
        Na__LeHatch__Ready,
        Na__LeHatch__GetPacks,
        Na__LeHatch__Get,
        Na__LeHatch__Effective,
        Na__LeHatch__ClampScale,
        Na__LeHatch__ClampRotation,
        Na__LeHatch__ClampStrokePt,
        Na__LeHatch__CleanColour,
        Na__LeHatch__StandardStrokePt,
        Na__LeHatch__StandardColour,
        Na__LeHatch__SwatchMarkup
    } from './Na__LayoutEditor__HatchPatterns__.js';
    import { Na__SpStore__GetLayers, Na__SpStore__CHANGED_EVENT } from '../../52__System__SitePlanData/Na__SitePlan__Store__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Identity
    // ------------------------------------------------------------
    const Na__LePanelPatterns__ID = 'patterns';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__LePanelPatterns__Listening = false;
    let Na__LePanelPatterns__Category  = '';                                    // <-- The site plan layer being edited
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Selection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Selected Site Plan Viewport, or null
    // ------------------------------------------------------------
    function Na__LePanelPatterns__Viewport() {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return null;
        const viewport = Na__LeModel__GetSelectedViewport(sheet);
        return (viewport && Na__LeModel__IsSitePlanViewport(viewport)) ? { sheet : sheet, viewport : viewport } : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Layers a Hatch Can Be Put On
    // ------------------------------------------------------------
    // A hatch fills a bounded area, so only a layer whose export carries faces
    // can take one. A layer with no fill is left out rather than offered and
    // then silently doing nothing.
    // ------------------------------------------------------------
    function Na__LePanelPatterns__FillableLayers(viewport) {
        const storeId = viewport && viewport.Viewport__SitePlan ? viewport.Viewport__SitePlan.SitePlan__StoreId : null;
        return Na__SpStore__GetLayers(storeId || undefined)
            .filter((layer) => layer.Layer__Style && layer.Layer__Style.FillHex);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Panel
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Panel Body
    // ------------------------------------------------------------
    function Na__LePanelPatterns__Build(body) {
        // THE LIBRARY NOW HOLDS BUILDING HATCHES TOO (Construction Materials), and
        // those go on a drawn vector, which this panel does not set - so the
        // intro says where that is done instead of leaving the tiles a dead end.
        const intro = Na__LePanels__Note(Na__LeCfg__GetLabel('PatternsIntro',
            'Repeating hatches. On a site plan viewport a layer is hatched from the tag standards by default; change it here for this viewport only. A drawn vector takes its hatch in the Vectors panel: tick Hatch there and choose the pattern.'));
        body.appendChild(intro);

        const layerRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsLayer', 'Layer'), Na__LePanels__Select('patterns-layer', [], ''));
        layerRow.setAttribute('data-na-block', 'patterns-layer-row');
        body.appendChild(layerRow);

        const patternRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsPattern', 'Pattern'), Na__LePanels__Select('patterns-pattern', [], ''));
        patternRow.setAttribute('data-na-block', 'patterns-pattern-row');
        body.appendChild(patternRow);

        // THE WASH, PER LAYER. The Site Plan Render Composites panel switches every
        // wash on the viewport at once; this switches one layer's, which is what
        // "selectively turn off the fill" needs. It sits above Scale because it
        // applies whether or not a pattern is chosen.
        const filled = Na__LePanels__Input('checkbox', 'patterns-filled');
        filled.title = Na__LeCfg__GetLabel('PatternsFilledNote', 'The solid wash under the pattern. Off leaves this layer unfilled - the hatch, if it has one, draws straight onto the paper.');
        const filledRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsFilled', 'Fill'), filled, 'na-le-row--toggle');
        filledRow.setAttribute('data-na-block', 'patterns-filled-row');
        body.appendChild(filledRow);

        const scale = Na__LePanels__Input('number', 'patterns-scale', { step : 0.05, min : 0.25, max : 4 });
        scale.title = Na__LeCfg__GetLabel('PatternsScaleNote', 'How large the pattern draws on the sheet. 1 is the size it was drawn at.');
        const scaleRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsScale', 'Scale'), scale);
        scaleRow.setAttribute('data-na-block', 'patterns-scale-row');
        body.appendChild(scaleRow);

        const rot = Na__LePanels__Input('number', 'patterns-rotation', { step : 15, min : 0, max : 345 });
        rot.title = Na__LeCfg__GetLabel('PatternsRotationNote', 'Turns the whole tiled field, not each mark.');
        const rotRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsRotation', 'Rotation deg'), rot);
        rotRow.setAttribute('data-na-block', 'patterns-rotation-row');
        body.appendChild(rotRow);

        // THIS LAYER'S OWN LINE WEIGHT AND LINE COLOUR, the same two controls a
        // vector's hatch has in the Vectors panel and meaning the same: the box
        // shows the pattern's standard until a value is set, and Standard, which
        // only shows once one is, puts both back.
        const lw = Na__LeCfg__GetLineweightSetup();
        const linePt = Na__LePanels__Input('number', 'patterns-line-pt', { step : lw.stepPt, min : lw.minPt, max : lw.maxPt });
        linePt.title = Na__LeCfg__GetLabel('PatternsLinePtNote', "The printed weight of the pattern's lines, in points. It starts at the pattern's standard, which grows with the scale; a weight typed here stays as typed at any scale. Empty the box to go back to the standard.");
        const linePtRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsLinePt', 'Line pt'), linePt);
        linePtRow.setAttribute('data-na-block', 'patterns-line-pt-row');
        body.appendChild(linePtRow);

        const lineColour = Na__LePanels__Input('color', 'patterns-line-colour');
        lineColour.title = Na__LeCfg__GetLabel('PatternsLineColourNote', "The colour of the pattern's lines on this layer. It starts at the pattern's standard: its own ink if it has one, else the layer's line colour.");
        const lineColourRow = Na__LePanels__Row(Na__LeCfg__GetLabel('PatternsLineColour', 'Line colour'), lineColour);
        lineColourRow.setAttribute('data-na-block', 'patterns-line-colour-row');
        body.appendChild(lineColourRow);

        const standard = document.createElement('div');
        standard.className = 'na-le-bar';
        standard.setAttribute('data-na-block', 'patterns-standard-row');
        const standardBtn = Na__LePanels__Button(Na__LeCfg__GetLabel('PatternsStandard', 'Standard line and colour'), 'patterns-standard');
        standardBtn.title = Na__LeCfg__GetLabel('PatternsStandardNote', "Put the pattern's line weight and colour back to its standard.");
        standard.appendChild(standardBtn);
        body.appendChild(standard);

        const status = Na__LePanels__Note('');
        status.setAttribute('data-na-block', 'patterns-status');
        body.appendChild(status);

        const library = document.createElement('div');
        library.className = 'na-le-hatch-library';
        library.setAttribute('data-na-block', 'patterns-library');
        body.appendChild(library);
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh the Panel Body
    // ------------------------------------------------------------
    function Na__LePanelPatterns__Refresh(body) {
        const current  = Na__LePanelPatterns__Viewport();
        const viewport = current ? current.viewport : null;
        const layers   = viewport ? Na__LePanelPatterns__FillableLayers(viewport) : [];

        const show = (block, on) => {
            const el = body.querySelector(`[data-na-block="${block}"]`);
            if (el) el.hidden = !on;
        };
        const hasLayers = layers.length > 0;
        [ 'patterns-layer-row', 'patterns-pattern-row', 'patterns-filled-row', 'patterns-scale-row', 'patterns-rotation-row',
          'patterns-line-pt-row', 'patterns-line-colour-row', 'patterns-standard-row' ]
            .forEach((block) => show(block, hasLayers));

        const status = body.querySelector('[data-na-block="patterns-status"]');
        if (status) {
            status.textContent = !viewport
                ? Na__LeCfg__GetLabel('PatternsNoViewport', 'Select a site plan viewport to set its hatches. The library below is always here.')
                : (hasLayers ? '' : Na__LeCfg__GetLabel('PatternsNoFills', 'No layer in this site plan carries faces, so there is nothing to hatch. Tag the areas as closed faces and export again.'));
            status.hidden = !status.textContent;
        }

        if (hasLayers) {
            if (!layers.some((layer) => layer.Layer__CategoryKey === Na__LePanelPatterns__Category)) {
                Na__LePanelPatterns__Category = layers[0].Layer__CategoryKey;
            }
            Na__LePanels__FillSelect(
                body.querySelector('[data-na-control="patterns-layer"]'),
                layers.map((layer) => ({ value : layer.Layer__CategoryKey, label : layer.Layer__Label })),
                Na__LePanelPatterns__Category
            );

            const layer = layers.find((entry) => entry.Layer__CategoryKey === Na__LePanelPatterns__Category);
            const hatch = Na__LeHatch__Effective(viewport, Na__LePanelPatterns__Category, layer ? layer.Layer__Style.HatchPatternId : null);

            const options = [ { value : '', label : Na__LeCfg__GetLabel('PatternsNone', 'None - no pattern') } ];
            Na__LeHatch__GetPacks().forEach((pack) => {
                pack.Pack__Patterns.forEach((pattern) => {
                    options.push({ value : pattern.Pattern__Key, label : `${pattern.Pattern__Label}  (${pack.Pack__Label})` });
                });
            });
            Na__LePanels__FillSelect(body.querySelector('[data-na-control="patterns-pattern"]'), options, hatch.Hatch__PatternKey || '');

            const filledEl = body.querySelector('[data-na-control="patterns-filled"]');
            if (filledEl) filledEl.checked = hatch.Hatch__Filled;

            const scaleEl = body.querySelector('[data-na-control="patterns-scale"]');
            const rotEl   = body.querySelector('[data-na-control="patterns-rotation"]');
            if (scaleEl && document.activeElement !== scaleEl) scaleEl.value = String(hatch.Hatch__Scale);
            if (rotEl   && document.activeElement !== rotEl)   rotEl.value   = String(hatch.Hatch__RotationDeg);
            show('patterns-scale-row',    !!hatch.Hatch__Pattern);
            show('patterns-rotation-row', !!hatch.Hatch__Pattern);

            // WHAT THE LAYER'S HATCH IS DRAWN WITH: its own weight and colour
            // once set, the pattern's standard until then - the weight quoted at
            // the scale in use, the colour against this layer's own line colour.
            const lineHex   = (layer && layer.Layer__Style && typeof layer.Layer__Style.LineHex === 'string') ? layer.Layer__Style.LineHex : '#000000';
            const standard  = Na__LeHatch__StandardStrokePt(hatch.Hatch__Pattern, hatch.Hatch__Scale);
            const shown     = hatch.Hatch__Colour || Na__LeHatch__StandardColour(hatch.Hatch__Pattern, lineHex);
            const ptEl      = body.querySelector('[data-na-control="patterns-line-pt"]');
            const colourEl  = body.querySelector('[data-na-control="patterns-line-colour"]');
            if (ptEl && document.activeElement !== ptEl) ptEl.value = String(hatch.Hatch__StrokePt !== null ? hatch.Hatch__StrokePt : (standard !== null ? standard : ''));
            if (colourEl && document.activeElement !== colourEl) colourEl.value = /^#[0-9a-fA-F]{6}$/.test(shown) ? shown : '#000000';
            show('patterns-line-pt-row',     !!hatch.Hatch__Pattern);
            show('patterns-line-colour-row', !!hatch.Hatch__Pattern);
            show('patterns-standard-row',    !!hatch.Hatch__Pattern && (hatch.Hatch__StrokePt !== null || !!hatch.Hatch__Colour));   // <-- Nothing set, nothing to put back
        }

        Na__LePanelPatterns__RenderLibrary(body.querySelector('[data-na-block="patterns-library"]'));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Library Tiles, Grouped by Pack
    // ------------------------------------------------------------
    function Na__LePanelPatterns__RenderLibrary(host) {
        if (!host) return;
        const packs = Na__LeHatch__GetPacks();
        if (!packs.length) {
            host.innerHTML = `<p class="na-le-note">${Na__LeCfg__GetLabel('PatternsEmpty', 'The pattern library is empty.')}</p>`;
            return;
        }
        const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        host.innerHTML = packs.map((pack) => {
            const tiles = pack.Pack__Patterns.map((pattern) => `
                <button type="button" class="na-le-hatch-tile" data-na-control="patterns-pick"
                        data-na-role="${esc(pattern.Pattern__Key)}" title="${esc(pattern.Pattern__Note || pattern.Pattern__Label)}">
                    <span class="na-le-hatch-tile__art">${Na__LeHatch__SwatchMarkup(pattern, 92, 54, pack.Pack__SwatchInk || '#43A047')}</span>
                    <span class="na-le-hatch-tile__name">${esc(pattern.Pattern__Label)}</span>
                </button>`).join('');
            return `<div class="na-le-hatch-pack">
                <h4 class="na-le-hatch-pack__title">${esc(pack.Pack__Label)}</h4>
                <div class="na-le-hatch-pack__tiles">${tiles}</div>
            </div>`;
        }).join('');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write One Layer's Hatch Settings
    // ------------------------------------------------------------
    // Merged, never replaced, so the other layers' settings survive. One undo
    // step, and the frame repaints because this module's hatch token is part of
    // the site plan paint key - which it was NOT until 20-Sep-2026, and until
    // then a typed scale saved correctly and drew nothing until the next reload.
    // Adam: 'the menu doesn't seem to work in real time'.
    // ------------------------------------------------------------
    function Na__LePanelPatterns__Patch(changes) {
        const current = Na__LePanelPatterns__Viewport();
        if (!current || !Na__LePanelPatterns__Category) return;
        Na__LeModel__UpdateViewport(current.sheet, current.viewport.Viewport__Id, {
            sitePlanHatch : { categoryKey : Na__LePanelPatterns__Category, changes : changes }
        });
        Na__LePanels__Refresh(Na__LePanelPatterns__ID);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Panel, Last in the Right Column
    // ------------------------------------------------------------
    function Na__LePanelPatterns__Register() {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__Patterns__.css', import.meta.url).href;
        document.head.appendChild(link);

        Na__LePanels__OnControl('change', 'patterns-layer', (event, el) => {
            Na__LePanelPatterns__Category = el.value;
            Na__LePanels__Refresh(Na__LePanelPatterns__ID);
        });
        // ANOTHER PATTERN BRINGS ITS OWN STANDARDS IN: choosing one, from the list
        // or from a library tile, clears the line weight and colour set on the
        // last, exactly as the Vectors panel does for a shape's hatch. null is
        // dropped by the record layer, so nothing is stored for "standard".
        Na__LePanels__OnControl('change', 'patterns-pattern', (event, el) => {
            Na__LePanelPatterns__Patch({ Hatch__PatternKey : el.value, Hatch__StrokePt : null, Hatch__Colour : null });
        });
        Na__LePanels__OnControl('change', 'patterns-line-pt', (event, el) => {
            const lw = Na__LeCfg__GetLineweightSetup();
            const pt = Na__LeHatch__ClampStrokePt(el.value);
            Na__LePanelPatterns__Patch({ Hatch__StrokePt : pt === null ? null : Math.min(lw.maxPt, Math.max(lw.minPt, pt)) });   // <-- An emptied box goes back to the standard
        });
        Na__LePanels__OnControl('change', 'patterns-line-colour', (event, el) => {
            Na__LePanelPatterns__Patch({ Hatch__Colour : Na__LeHatch__CleanColour(el.value) });
        });
        Na__LePanels__OnControl('click', 'patterns-standard', () => {
            Na__LePanelPatterns__Patch({ Hatch__StrokePt : null, Hatch__Colour : null });
        });
        Na__LePanels__OnControl('change', 'patterns-scale', (event, el) => {
            const pattern = Na__LeHatch__Get(el.closest('.na-le-section__body')
                .querySelector('[data-na-control="patterns-pattern"]').value);
            Na__LePanelPatterns__Patch({ Hatch__Scale : Na__LeHatch__ClampScale(pattern, el.value) });
        });
        Na__LePanels__OnControl('change', 'patterns-filled', (event, el) => {
            Na__LePanelPatterns__Patch({ Hatch__Filled : el.checked });
        });
        Na__LePanels__OnControl('change', 'patterns-rotation', (event, el) => {
            Na__LePanelPatterns__Patch({ Hatch__RotationDeg : Na__LeHatch__ClampRotation(el.value) });
        });
        Na__LePanels__OnControl('click', 'patterns-pick', (event, el, role) => {
            Na__LePanelPatterns__Patch({ Hatch__PatternKey : role, Hatch__StrokePt : null, Hatch__Colour : null });
        });

        // ENTER COMMITS, WITHOUT WAITING FOR THE FIELD TO LOSE FOCUS. `change`
        // alone does fire on Enter in every browser here, but only when the
        // value has actually moved since the field was last committed - so
        // typing 1, trying 2, and going back to 1 leaves the drawing at 2 with
        // the box reading 1. Blurring is what commits, and it also puts the
        // caret somewhere sensible for the next edit.
        const commit = (event, el) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            el.blur();
        };
        Na__LePanels__OnControl('keydown', 'patterns-scale',    commit);
        Na__LePanels__OnControl('keydown', 'patterns-rotation', commit);
        Na__LePanels__OnControl('keydown', 'patterns-line-pt',  commit);

        if (!Na__LePanelPatterns__Listening) {
            Na__LePanelPatterns__Listening = true;
            window.addEventListener(Na__LeModel__CHANGED_EVENT, () => Na__LePanels__Refresh(Na__LePanelPatterns__ID));
            window.addEventListener(Na__SpStore__CHANGED_EVENT, (event) => {
                if (!event.detail || event.detail.reason !== 'layer-loaded') Na__LePanels__Refresh(Na__LePanelPatterns__ID);
            });
        }

        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelPatterns__ID, title : Na__LeCfg__GetLabel('PanelPatterns', 'Patterns'),
            build : Na__LePanelPatterns__Build, refresh : Na__LePanelPatterns__Refresh
        });

        // Hidden until the library has loaded, so it never flashes up empty -
        // the same guard the Scrapbook panel uses.
        Na__LePanels__SetSectionVisible(Na__LePanelPatterns__ID, false);
        Na__LeHatch__Ready().then(() => {
            Na__LePanels__SetSectionVisible(Na__LePanelPatterns__ID, true);
            Na__LePanels__Refresh(Na__LePanelPatterns__ID);
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Patterns Panel
    // ------------------------------------------------------------
    export { Na__LePanelPatterns__ID, Na__LePanelPatterns__Register };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
