// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE ASSET BROWSER
// =============================================================================
//
// FILE       : Na__Entourage__AssetBrowser__.js
// NAMESPACE  : Na__EntCards
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Entourage Assets: the library as cards to drag on, everything this project
//              holds, to select, focus, scale, replace or take out, and who changed what
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "Use a asset browser and drag and drop system similar to the new plant
//   system". The plants' Assets drawer, with cards tall enough for a person.
// - DRAG A CARD ON. Further than the threshold is a drag, and a figure follows the pointer. Less is
//   a click, which arms the card for the next click on the model (NPR's gesture). Pointer events,
//   as NPR's, not HTML drag and drop: the drag runs over a WebGL canvas with its own listeners.
// - CARDS ARE DRAWN LIVE BY THE SAME CODE AS THE SCENE, so nothing can go stale.
// - WHILE THIS PANEL IS OPEN THE TOOL IS ON THE MODEL: ring on hover, drag to move, right-click.
//   Closed, the model behaves as normal (Adam's answer).
// - A PROJECT'S OWN COPY OF EACH ASSET. Improving the library changes nothing here until Update to
//   Latest is pressed for that asset, which only an admin is offered: every viewer's picture changes.
// - WHO DID WHAT (Adam, 05-Nov-2026: "who inserted what etc"). In This Project says it on each row,
//   and whether it is waiting for an admin, with a tick for only your own. The Changes tab is
//   ../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js.
// - ONE PANEL, AS DROPDOWN SECTIONS (Adam, 06-Nov-2026: "make the new menu on the left feel more like
//   the sestablished style of the right each with dropdown sections and graphics etc"). The panel is
//   called Entourage, and holds Assets, In This Project and Changes, one open at a time
//   (../../22__System__SceneAssets/Na__SceneAssets__Hub__.js), as the Vegetation panel does.
// - IT OPENS ON ASSETS WHEN ENTOURAGE IS UNFOLDED IN TOOLS & SETTINGS, AND GOES WHEN IT IS FOLDED
//   (Adam: "people would expect those sections are the entry point for their respective asset
//   browsers"). Closing it here folds the menu's section too.
//
// INTEGRATION:
// - Opened and closed by Tools & Settings > Entourage (./Na__Entourage__MenuSection__.js).
// - @delegate: ../../22__System__SceneAssets/Na__SceneAssets__Hub__.js
// - @delegate: ../20__System__Tools/Na__Entourage__FigureTool__.js
// - @delegate: ./Na__Entourage__FigurePicture__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/10__Ui__Panels/Na__Entourage__AssetBrowser__.js 1.3.0 (v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : diverged (one section fewer)
// - Divergences   : No Changes section: TrueVision keeps no list of who did what (one
//                   author, every save straight in), so it would only ever say that list
//                   could not be read. Its drawing code stays, unused, so a later port
//                   from ValeVision still lines up. Header and console prefix.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.3.0-tv.1 (TrueVision3D v2.185.0)
// - Ported from ValeVision 3D without the Changes section (PORT NOTE).
//
// 11-Nov-2026 - Version 1.3.0 (ValeVision3D v2.95.0)
// - The Jamesification slider under Scale stretches the selected figure's height only, 1 to 1.50.
//
// 11-Nov-2026 - Version 1.2.1 (ValeVision3D v2.94.2)
// - In This Project no longer shows the selected figure's saved record (What It Saves). Adam: "remove
//   the section showing the code thats no longer needed".
//
// 06-Nov-2026 - Version 1.2.0 (ValeVision3D v2.91.0)
// - The panel is Entourage, as dropdown sections: Assets, In This Project and Changes. Open and Close
//   for the menu section.
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - The tabs have their icons, and there is a Changes tab. Rows say who did it. Open on a named tab.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build, after Na__Vegetation__AssetBrowser__.js.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Data and Runtime
    // ------------------------------------------------------------
    import { Na__EntLib__LoadCatalogue, Na__EntLib__LoadAsset, Na__EntLib__PinAsset } from '../02__Core__Data/Na__Entourage__Library__.js';
    import {
        Na__EntData__WORK_EVENT,
        Na__EntData__SYSTEM,
        Na__EntData__Work,
        Na__EntData__TakeAnswer,
        Na__EntData__IsDirty
    } from '../02__Core__Data/Na__Entourage__SceneData__.js';
    import {
        Na__SceneChanges__AddStyles,
        Na__SceneChanges__Icon,
        Na__SceneChanges__CountWaiting,
        Na__SceneChanges__WhoDid,
        Na__SceneChanges__WhoLine,
        Na__SceneChanges__Draw
    } from '../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js';
    import { Na__SceneHub__Create } from '../../22__System__SceneAssets/Na__SceneAssets__Hub__.js';
    import {
        Na__EntRun__GetSceneData,
        Na__EntRun__GetContext,
        Na__EntRun__SyncFigures,
        Na__EntRun__RefreshAsset,
        Na__EntRun__SizeOf
    } from '../03__System__SceneLayer/Na__Entourage__Runtime__.js';
    import { Na__RenderLoop__RequestRender } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Shell, Picture and Tool
    // ------------------------------------------------------------
    import {
        Na__EntShell__El,
        Na__EntShell__Button,
        Na__EntShell__ScaleSlider,
        Na__EntShell__JamesificationSlider,
        Na__EntShell__Open,
        Na__EntShell__Close,
        Na__EntShell__IsOpen,
        Na__EntShell__MarkChanged,
        Na__EntShell__BeforeChange,
        Na__EntShell__Config,
        Na__EntShell__Prepare,
        Na__EntShell__Save,
        Na__EntShell__AfterReplaced,
        Na__EntShell__Toast
    } from './Na__Entourage__PanelShell__.js';
    import { Na__EntPic__Draw } from './Na__Entourage__FigurePicture__.js';
    import {
        Na__EntTool__Start,
        Na__EntTool__Stop,
        Na__EntTool__Select,
        Na__EntTool__SelectedFigure,
        Na__EntTool__ArmCard,
        Na__EntTool__ArmedId,
        Na__EntTool__BeginCardDrag,
        Na__EntTool__MoveCardDrag,
        Na__EntTool__EndCardDrag,
        Na__EntTool__CarrySelected,
        Na__EntTool__CopySelected,
        Na__EntTool__RemoveSelected,
        Na__EntTool__SwapSelected,
        Na__EntTool__WriteScale,
        Na__EntTool__WriteHeightStretch
    } from '../20__System__Tools/Na__Entourage__FigureTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Panel and Its Pictures
    // ------------------------------------------------------------
    const Na__EntCards__PANEL_ID   = 'naEntourageAssetsPanel';
    const Na__EntCards__CARD       = { w : 78, h : 118 };
    const Na__EntCards__SWAP       = { w : 46, h : 72 };
    const Na__EntCards__SEED_RANGE = 1000000000;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Open Panel Holds
    // ------------------------------------------------------------
    const Na__EntCards__State = {
        context   : null,
        tab       : 'assets',                                                  // <-- The open section's key, '' with all folded
        hub       : null,                                                      // <-- The sections, while the panel is open
        opening   : null,                                                      // <-- The panel being built: a second ask waits for it
        search    : '',
        chips     : new Set(),
        chipsOpen : false,
        catalogue : [],
        recipes   : new Map(),
        cardEls   : new Map(),
        listEl    : null,
        hintEl    : null,
        onlyMine  : false
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Project's Line Rules, for a Picture
    // ------------------------------------------------------------
    function Na__EntCards__Rules() {
        return Na__EntRun__GetSceneData().Entourage__SceneData__LineRules;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Scale the Next Card Drops At
    // ------------------------------------------------------------
    function Na__EntCards__PlaceBlock() {
        return Na__EntRun__GetSceneData().Entourage__SceneData__Tools.Entourage__Tools__Place;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Asset's Name from the Catalogue
    // ------------------------------------------------------------
    function Na__EntCards__AssetName(assetId) {
        const row = Na__EntCards__State.catalogue.find((candidate) => candidate.Asset__Id === assetId);
        return row ? row.Asset__Name : assetId;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say What the Model Will Do
    // ------------------------------------------------------------
    function Na__EntCards__WriteHint() {
        const hint = Na__EntCards__State.hintEl;
        if (!hint) return;
        hint.textContent = Na__EntTool__ArmedId()
            ? 'Click the model to drop one. Escape or the card again to stop.'
            : 'Drag a card onto the model, or click a card then click the model. Drag a person to move them, and right-click to replace or delete.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show Which Card Is Armed
    // ------------------------------------------------------------
    function Na__EntCards__PaintArmed() {
        const armed = Na__EntTool__ArmedId();
        Na__EntCards__State.cardEls.forEach((card, id) => card.classList.toggle('na-veg-card--armed', id === armed));
        Na__EntCards__WriteHint();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Cards
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Dragging from a Card
    // ------------------------------------------------------------
    function Na__EntCards__WireCard(card, assetId) {
        const state = Na__EntCards__State;
        card.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const threshold = Na__EntShell__Config().Entourage__DevTools__Config.Entourage__DevTools__DragThresholdPx;
            const fromX = event.clientX, fromY = event.clientY;
            let dragging = false;

            const onMove = (moved) => {
                if (!dragging && Math.hypot(moved.clientX - fromX, moved.clientY - fromY) >= threshold) {
                    dragging = true;
                    const ghostPx = Na__EntShell__Config().Entourage__DevTools__Config.Entourage__DevTools__GhostPx;
                    const canvas = document.createElement('canvas');
                    Na__EntPic__Draw(canvas, state.recipes.get(assetId), Na__EntCards__Rules(), { w : ghostPx, h : Math.round(ghostPx * 1.5) });
                    Na__EntTool__BeginCardDrag(assetId, moved, canvas);
                } else if (dragging) {
                    Na__EntTool__MoveCardDrag(moved);
                }
            };
            const onUp = (released) => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                if (dragging) {
                    Na__EntTool__EndCardDrag(released);
                } else {
                    Na__EntTool__ArmCard(assetId);
                    Na__EntCards__PaintArmed();
                }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The Cards the Search and Chips Leave, by Type
    // ------------------------------------------------------------
    function Na__EntCards__DrawMatches(holder) {
        const state = Na__EntCards__State;
        holder.textContent = '';
        state.cardEls.clear();
        const needle = state.search.trim().toLowerCase();
        const rows = state.catalogue.filter((row) => {
            if (row.Asset__Status === 'Retired') return false;
            const words = row.Asset__Keywords || [];
            for (const chip of state.chips) {
                if (!words.includes(chip)) return false;
            }
            if (!needle) return true;
            return (row.Asset__Name + ' ' + row.Asset__Id + ' ' + row.Asset__TypeLabel + ' ' + words.join(' ')).toLowerCase().includes(needle);
        });
        if (rows.length === 0) {
            holder.appendChild(Na__EntShell__El('p', 'na-veg-panel__hint', 'No assets match.'));
            return;
        }

        let lastHeading = '';
        let grid = null;
        rows.forEach((row) => {
            if (row.Asset__TypeLabel !== lastHeading) {
                holder.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', row.Asset__TypeLabel));
                grid = Na__EntShell__El('div', 'na-ent-cards');
                holder.appendChild(grid);
                lastHeading = row.Asset__TypeLabel;
            }
            const card = Na__EntShell__El('div', 'na-veg-card na-ent-card' + (Na__EntTool__ArmedId() === row.Asset__Id ? ' na-veg-card--armed' : ''));
            card.setAttribute('role', 'button');
            card.dataset.assetId = row.Asset__Id;
            const recipe = state.recipes.get(row.Asset__Id);
            card.title = (recipe ? recipe.Asset__Description + ' ' : '') + row.Asset__Id;
            const canvas = document.createElement('canvas');
            card.appendChild(canvas);
            Na__EntPic__Draw(canvas, recipe, Na__EntCards__Rules(), Na__EntCards__CARD);
            card.appendChild(Na__EntShell__El('div', 'na-veg-card__name', row.Asset__Name));
            card.appendChild(Na__EntShell__El('div', 'na-veg-card__meta', (row.Asset__HeightMm / 1000).toFixed(2) + ' m'));
            Na__EntCards__WireCard(card, row.Asset__Id);
            state.cardEls.set(row.Asset__Id, card);
            grid.appendChild(card);
        });
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The Assets Tab
    // ------------------------------------------------------------
    function Na__EntCards__DrawCards() {
        const state = Na__EntCards__State;
        const holder = state.listEl;
        if (!holder) return;
        holder.textContent = '';
        const matches = Na__EntShell__El('div', '');

        // THE FINDING ROW | A search and a funnel
        const finding = Na__EntShell__El('div', 'na-veg-row');
        const search = Na__EntShell__El('input', 'na-veg-field');
        search.type = 'search';
        search.placeholder = 'Search people';
        search.value = state.search;
        search.style.flex = '1 1 auto';
        search.style.width = 'auto';
        search.addEventListener('input', () => {
            state.search = search.value;
            Na__EntCards__DrawMatches(matches);
        });
        finding.appendChild(search);
        finding.appendChild(Na__EntShell__Button('Filter', state.chipsOpen || state.chips.size > 0 ? 'na-veg-btn--strong' : '', () => {
            state.chipsOpen = !state.chipsOpen;
            Na__EntCards__DrawCards();
        }, 'Filter by keyword'));
        holder.appendChild(finding);

        if (state.chipsOpen) {
            const chips = Na__EntShell__El('div', 'na-veg-chips');
            const words = new Set();
            state.catalogue.forEach((row) => (row.Asset__Keywords || []).forEach((word) => words.add(word)));
            Array.from(words).sort().forEach((word) => {
                const chip = Na__EntShell__El('button', 'na-veg-chip' + (state.chips.has(word) ? ' na-veg-chip--on' : ''), word);
                chip.type = 'button';
                chip.addEventListener('click', () => {
                    if (state.chips.has(word)) state.chips.delete(word); else state.chips.add(word);
                    Na__EntCards__DrawCards();
                });
                chips.appendChild(chip);
            });
            holder.appendChild(chips);
        }

        holder.appendChild(Na__EntShell__ScaleSlider({
            label   : 'Scale of the next one',
            value   : Na__EntCards__PlaceBlock().Entourage__Place__Scale,
            title   : 'The next figure dropped from a card: 0.90 is a tenth smaller in every way',
            onInput : (value) => {
                Na__EntShell__BeforeChange('place-scale');
                Na__EntCards__PlaceBlock().Entourage__Place__Scale = value;
                Na__EntShell__MarkChanged();
            }
        }).row);

        state.hintEl = Na__EntShell__El('p', 'na-veg-panel__hint');
        holder.appendChild(state.hintEl);
        Na__EntCards__WriteHint();

        holder.appendChild(matches);
        Na__EntCards__DrawMatches(matches);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | In This Project
// -----------------------------------------------------------------------------

    // FUNCTION | Bring the Selection to the Middle of the View
    // ------------------------------------------------------------
    function Na__EntCards__FocusSelected() {
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;
        const dev = Na__EntShell__Config().Entourage__DevTools__Config;
        const { camera, controls } = Na__EntRun__GetContext();
        const size = Na__EntRun__SizeOf(figure);
        const position = figure.Entourage__Figure__PositionMm;
        const reachM = Math.max(dev.Entourage__DevTools__FocusMinM, (size[1] / 1000) * dev.Entourage__DevTools__FocusFactor);
        const offset = camera.position.clone().sub(controls.target).setLength(reachM);
        controls.target.set(position[0] / 1000, (position[1] + size[1] / 2) / 1000, position[2] / 1000);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Selected Figure Can Do, and What It Saves
    // ------------------------------------------------------------
    function Na__EntCards__AppendDetail(holder) {
        const state = Na__EntCards__State;
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;

        holder.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', Na__EntCards__AssetName(figure.Entourage__Figure__AssetId)));
        const actions = Na__EntShell__El('div', 'na-veg-row');
        actions.style.flexWrap = 'wrap';
        actions.appendChild(Na__EntShell__Button('Focus', '', Na__EntCards__FocusSelected, 'Bring it to the middle of the view'));
        actions.appendChild(Na__EntShell__Button('Move', '', Na__EntTool__CarrySelected, 'It follows the pointer until the next click. M does the same'));
        actions.appendChild(Na__EntShell__Button('Copy', '', Na__EntTool__CopySelected, 'Another beside it. Ctrl+D does the same'));
        actions.appendChild(Na__EntShell__Button('New Seed', '', async () => {
            Na__EntShell__BeforeChange('');
            figure.Entourage__Figure__Seed = Math.floor(Math.random() * Na__EntCards__SEED_RANGE);
            Na__EntShell__MarkChanged();
            await Na__EntRun__SyncFigures();
            Na__EntCards__DrawProject();
        }, 'The same character, with the pen lifted in different places'));
        actions.appendChild(Na__EntShell__Button('Delete', 'na-veg-btn--danger', Na__EntTool__RemoveSelected, 'Delete does the same'));
        holder.appendChild(actions);

        const scale = Na__EntShell__ScaleSlider({
            value   : figure.Entourage__Figure__Scale,
            title   : 'The whole figure: 0.90 is a tenth smaller in every way, and the same character',
            onInput : (value) => {
                Na__EntShell__BeforeChange('figure-scale');
                Na__EntTool__WriteScale(figure, value);
                Na__EntShell__MarkChanged();
                Na__EntRun__SyncFigures();
            },
            onChange : () => { Na__EntCards__DrawProject(); }
        });
        scale.row.style.marginTop = '8px';
        holder.appendChild(scale.row);

        const sizeLine = Na__EntShell__El('p', 'na-veg-panel__hint', '');
        const writeSize = () => {
            const measured = Na__EntRun__SizeOf(figure);
            sizeLine.textContent = 'Stands ' + (measured[1] / 1000).toFixed(2) + ' m tall and ' + measured[0] + ' mm wide.';
        };

        const stretch = Na__EntShell__JamesificationSlider({
            value   : figure.Entourage__Figure__HeightStretch,
            title   : 'Taller only: 1.20 is a fifth taller and no wider',
            onInput : (value) => {
                Na__EntShell__BeforeChange('figure-height-stretch');
                Na__EntTool__WriteHeightStretch(figure, value);
                Na__EntShell__MarkChanged();
                Na__EntRun__SyncFigures();
                writeSize();
            },
            onChange : () => { Na__EntCards__DrawProject(); }
        });
        stretch.row.style.marginTop = '8px';
        holder.appendChild(stretch.row);

        writeSize();
        holder.appendChild(sizeLine);

        holder.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', 'Replace with'));
        const swaps = Na__EntShell__El('div', 'na-ent-swaps');
        state.catalogue.forEach((row) => {
            if (row.Asset__Id === figure.Entourage__Figure__AssetId || row.Asset__Status === 'Retired') return;
            const button = Na__EntShell__El('button', 'na-ent-swap');
            button.type = 'button';
            button.title = row.Asset__Name;
            const canvas = document.createElement('canvas');
            button.appendChild(canvas);
            Na__EntPic__Draw(canvas, state.recipes.get(row.Asset__Id), Na__EntCards__Rules(), Na__EntCards__SWAP);
            button.addEventListener('click', () => Na__EntTool__SwapSelected(row.Asset__Id));
            swaps.appendChild(button);
        });
        holder.appendChild(swaps);                                             // <-- The saved record is no longer shown under it (Adam, 11-Nov-2026)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Update to Latest, for an Asset the Library Has Since Improved
    // ------------------------------------------------------------
    function Na__EntCards__AppendPinned(holder) {
        const state = Na__EntCards__State;
        const sceneData = Na__EntRun__GetSceneData();
        const pinned = sceneData.Entourage__SceneData__Assets;
        const ids = Object.keys(pinned);
        if (ids.length === 0) return;
        holder.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', 'This project\'s copies of its assets'));
        ids.forEach((assetId) => {
            const row = Na__EntShell__El('div', 'na-veg-row na-veg-row--between');
            const mine = pinned[assetId].Asset__Meta ? pinned[assetId].Asset__Meta.Meta__Version : '?';
            const catalogueRow = state.catalogue.find((candidate) => candidate.Asset__Id === assetId);
            row.appendChild(Na__EntShell__El('span', '', Na__EntCards__AssetName(assetId) + ' ' + mine));
            if (Na__EntData__Work().isAdmin && catalogueRow && catalogueRow.Asset__Version !== mine) {
                row.appendChild(Na__EntShell__Button('Update to ' + catalogueRow.Asset__Version, '', async () => {
                    Na__EntShell__BeforeChange('');
                    delete pinned[assetId];
                    await Na__EntLib__PinAsset(sceneData, assetId);
                    Na__EntShell__MarkChanged();
                    await Na__EntRun__RefreshAsset(assetId);
                    Na__EntCards__DrawProject();
                }, 'Its figures draw again from the library\'s newer drawing'));
            }
            holder.appendChild(row);
        });
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The In This Project Tab
    // ------------------------------------------------------------
    function Na__EntCards__DrawProject() {
        const state = Na__EntCards__State;
        const holder = state.listEl;
        if (!holder) return;
        holder.textContent = '';
        const figures = Na__EntRun__GetSceneData().Entourage__SceneData__Figures;
        const selected = Na__EntTool__SelectedFigure();
        const work = Na__EntData__Work();
        const myCode = work.me ? work.me.code : '';

        if (figures.length === 0) {
            holder.appendChild(Na__EntShell__El('p', 'na-veg-panel__hint', 'Nobody placed yet. Open Assets above and drag a card onto the model.'));
        } else {
            const mine = Na__EntShell__El('label', 'na-scene-mine');
            const tick = Na__EntShell__El('input', 'na-veg-tick__input');
            tick.type = 'checkbox';
            tick.id = 'naEntourageOnlyMine';
            tick.checked = state.onlyMine;
            tick.addEventListener('change', () => {
                state.onlyMine = tick.checked;
                Na__EntCards__DrawProject();
            });
            mine.appendChild(tick);
            mine.appendChild(Na__EntShell__El('span', '', 'Only mine'));
            holder.appendChild(mine);

            holder.appendChild(Na__EntShell__El('div', 'na-veg-panel__section', 'Figures'));
            figures.forEach((figure) => {
                const who = Na__SceneChanges__WhoDid(work.summary, 'figure:' + figure.Entourage__Figure__Uid, myCode);
                if (state.onlyMine && !who.mine) return;
                const isSelected = selected === figure;
                const row = Na__EntShell__El('button', 'na-veg-list-row na-scene-list-row' + (isSelected ? ' na-veg-list-row--selected' : ''));
                row.type = 'button';
                row.appendChild(Na__EntShell__El('span', '', Na__EntCards__AssetName(figure.Entourage__Figure__AssetId)));
                row.appendChild(Na__EntShell__El('span', 'na-veg-list-row__meta', figure.Entourage__Figure__Uid));
                if (who.name || who.waiting) row.appendChild(Na__SceneChanges__WhoLine(who));
                row.addEventListener('click', () => Na__EntTool__Select(isSelected ? '' : figure.Entourage__Figure__Uid));
                holder.appendChild(row);
            });
        }
        if (selected) Na__EntCards__AppendDetail(holder);
        Na__EntCards__AppendPinned(holder);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // SUB FUNCTION | The Changes Tab
    // ------------------------------------------------------------
    function Na__EntCards__DrawChanges() {
        const state = Na__EntCards__State;
        if (!state.listEl) return;
        const work = Na__EntData__Work();
        Na__SceneChanges__Draw(state.listEl, {
            system    : Na__EntData__SYSTEM,
            summary   : work.summary,
            isAdmin   : work.isAdmin,
            nameOf    : (what) => (what ? Na__EntCards__AssetName(what) : ''),
            saveFirst : async () => (Na__EntData__IsDirty() ? Na__EntShell__Save() : true),
            onAnswer  : async (answer) => {
                Na__EntTool__Select('');
                await Na__EntData__TakeAnswer(answer);
                await Na__EntShell__AfterReplaced();
            },
            onItem    : (item) => Na__EntTool__Select(item.Uid),
            toast     : Na__EntShell__Toast,
            redraw    : Na__EntCards__DrawChanges
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Changes Row Says How Many Are Waiting
    // ------------------------------------------------------------
    // An admin's count is everyone's. Anyone else's is their own.
    // ------------------------------------------------------------
    function Na__EntCards__PaintCount() {
        const hub = Na__EntCards__State.hub;
        if (!hub) return;
        const work = Na__EntData__Work();
        hub.setCount('changes', Na__SceneChanges__CountWaiting(work.summary, work.isAdmin ? '' : (work.me && work.me.code)));
    }
    // ------------------------------------------------------------


    // HANDLER | Who Did What Has Changed
    // ------------------------------------------------------------
    function Na__EntCards__OnWorkChanged() {
        const state = Na__EntCards__State;
        Na__EntCards__PaintCount();
        if (!state.listEl) return;
        if (state.tab === 'project') Na__EntCards__DrawProject();
        if (state.tab === 'changes') Na__EntCards__DrawChanges();
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Section, Folding the One That Was Open
    // ------------------------------------------------------------
    // 'assets', 'project' or 'changes'. Resolves once it is drawn.
    // ------------------------------------------------------------
    function Na__EntCards__ShowTab(tab) {
        const hub = Na__EntCards__State.hub;
        return hub ? hub.open(tab) : Promise.resolve();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Open Section Again
    // ------------------------------------------------------------
    function Na__EntCards__Redraw() {
        const state = Na__EntCards__State;
        if (!state.listEl) return;
        if (state.tab === 'project') Na__EntCards__DrawProject();
        else if (state.tab === 'changes') Na__EntCards__DrawChanges();
        else if (state.tab === 'assets') Na__EntCards__DrawCards();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Section That Is a List: It Draws into Its Body While Open
    // ------------------------------------------------------------
    function Na__EntCards__ListSection(key, draw) {
        return (body) => {
            const state = Na__EntCards__State;
            state.tab    = key;
            state.listEl = body;
            draw();
            return () => {
                if (state.listEl !== body) return;                             // <-- A section opened since owns the list now
                state.listEl = null;
                state.hintEl = null;
            };
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Panel's Sections, in Order
    // ------------------------------------------------------------
    function Na__EntCards__Sections() {
        const state = Na__EntCards__State;
        return [
            {
                key   : 'assets',
                label : 'Assets',
                icon  : 'Entourage',
                title : 'The library as cards: drag a card onto the model, or click a card then the model',
                mount : (body) => {
                    Na__EntTool__Select('');                                   // <-- Back to the cards is letting go of who was selected
                    const stop = Na__EntCards__ListSection('assets', Na__EntCards__DrawCards)(body);
                    return () => {
                        const armed = Na__EntTool__ArmedId();
                        if (armed) Na__EntTool__ArmCard(armed);                // <-- The card again disarms it: a card left armed would still drop people
                        state.cardEls.clear();
                        stop();
                    };
                }
            },
            {
                key   : 'project',
                label : 'In This Project',
                icon  : 'InThisProject',
                title : 'Everyone placed here: select, focus, scale, replace or take out',
                mount : Na__EntCards__ListSection('project', Na__EntCards__DrawProject)
            }
            // TRUEVISION | No Changes section: there is no list of who did what (PORT NOTE)
        ];
    }
    // ------------------------------------------------------------


    // HANDLER | The Tool Changed Something: What Shows Follows It
    // ------------------------------------------------------------
    function Na__EntCards__OnToolChanged() {
        const state = Na__EntCards__State;
        if (!state.listEl) return;
        if (state.tab === 'project') Na__EntCards__DrawProject();
        else if (state.tab === 'assets') Na__EntCards__PaintArmed();
    }
    // ------------------------------------------------------------


    // HANDLER | A Figure Was Taken on the Model: Its Details Come Up
    // ------------------------------------------------------------
    // As a plant selected does. Dropping one from a card leaves the cards up, for the next.
    // ------------------------------------------------------------
    function Na__EntCards__OnPicked() {
        const state = Na__EntCards__State;
        if (state.hub && state.tab !== 'project') Na__EntCards__ShowTab('project');
    }
    // ------------------------------------------------------------


    // HANDLER | The Object Was Replaced by an Undo: Read It Again
    // ------------------------------------------------------------
    function Na__EntCards__OnReplaced() {
        Na__EntCards__Redraw();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Panel Was Doing
    // ------------------------------------------------------------
    function Na__EntCards__OnClose() {
        const state = Na__EntCards__State;
        if (state.hub) {
            const hub = state.hub;
            state.hub = null;
            hub.destroy();                                                     // <-- The open section stops first
        }
        Na__EntTool__Stop();
        state.listEl = null;
        state.hintEl = null;
        state.cardEls.clear();
        window.removeEventListener('na-entourage-object-replaced', Na__EntCards__OnReplaced);
        window.removeEventListener(Na__EntData__WORK_EVENT, Na__EntCards__OnWorkChanged);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Panel, Opening on a Section
    // ------------------------------------------------------------
    // A second ask while the first is still loading the library waits for it, so there is only
    // ever one panel and one set of sections.
    // ------------------------------------------------------------
    async function Na__EntCards__Build(context, tab) {
        const state = Na__EntCards__State;
        if (Na__EntShell__IsOpen(Na__EntCards__PANEL_ID)) return;
        if (!state.opening) {
            state.opening = Na__EntCards__BuildNow(context, tab).finally(() => { state.opening = null; });
        }
        await state.opening;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Build It Now
    // ------------------------------------------------------------
    async function Na__EntCards__BuildNow(context, tab) {
        await Na__EntShell__Prepare(context);
        const state = Na__EntCards__State;
        state.context = context;

        state.catalogue = await Na__EntLib__LoadCatalogue();
        for (const row of state.catalogue) {
            if (!state.recipes.has(row.Asset__Id)) state.recipes.set(row.Asset__Id, await Na__EntLib__LoadAsset(row.Asset__Id));
        }

        Na__SceneChanges__AddStyles();
        const panel = Na__EntShell__Open({
            id      : Na__EntCards__PANEL_ID,
            title   : 'Entourage',
            side    : 'left',
            hub     : true,
            icon    : Na__SceneChanges__Icon('Entourage', 'na-scene-hub__title-icon'),
            onClose : Na__EntCards__OnClose
        });
        state.hub = Na__SceneHub__Create(panel.body, {
            sections : Na__EntCards__Sections(),
            onOpened : (key) => {
                if (!key) state.tab = '';
            }
        });

        state.listEl = null;
        window.addEventListener('na-entourage-object-replaced', Na__EntCards__OnReplaced);
        window.addEventListener(Na__EntData__WORK_EVENT, Na__EntCards__OnWorkChanged);
        Na__EntCards__PaintCount();
        await Na__EntTool__Start(context, {
            onChanged : Na__EntCards__OnToolChanged,
            onPicked  : Na__EntCards__OnPicked,
            catalogue : () => state.catalogue,
            recipeOf  : (assetId) => state.recipes.get(assetId) || null
        });
        await Na__EntCards__ShowTab(tab || 'assets');
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel on Assets, If It Is Not Open
    // ------------------------------------------------------------
    // What unfolding Entourage in Tools & Settings does.
    // ------------------------------------------------------------
    async function Na__EntCards__Open(context) {
        await Na__EntCards__Build(context, 'assets');
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Panel, If It Is Open
    // ------------------------------------------------------------
    // What folding Entourage in Tools & Settings does.
    // ------------------------------------------------------------
    function Na__EntCards__Close() {
        Na__EntShell__Close(Na__EntCards__PANEL_ID);
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel, or Close It If It Is Open
    // ------------------------------------------------------------
    async function Na__EntCards__Toggle(context) {
        if (Na__EntShell__IsOpen(Na__EntCards__PANEL_ID)) {
            Na__EntCards__Close();
            return;
        }
        await Na__EntCards__Build(context, 'assets');
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel on a Section, or Go to That Section If It Is Open
    // ------------------------------------------------------------
    async function Na__EntCards__OpenOn(context, tab) {
        await Na__EntCards__Build(context, tab);
        await Na__EntCards__ShowTab(tab);                                     // <-- Already open, or opened by an ask before this one
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Asset Browser API
    // ------------------------------------------------------------
    export {
        Na__EntCards__Open,
        Na__EntCards__Close,
        Na__EntCards__Toggle,
        Na__EntCards__OpenOn
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
