// =============================================================================
// TRUEVISION3D - VEGETATION - THE PALETTE EDITOR
// =============================================================================
//
// FILE       : Na__Vegetation__PaletteEditor__.js
// NAMESPACE  : Na__VegPalUi
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Named mixes of plants, each with a probability slider: the one editor
//              shared by the Linear Tool and the Bush Tool
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "creates a pallette and you can assign proibability for the items in
//   the selection so you can mix and match". Named, several per project (plan, D22), saved
//   in the project's object. The percentages shown are each weight's share, live.
// - ONE PROJECT, ONE LIST OF PALETTES. A new project gets one, Mixed Planting, with every
//   asset at its own default weight, so a tool is ready as soon as it opens.
// - A PATH IS DRAWN FROM ITS PALETTE, so moving a slider redraws the paths that use it, and
//   a palette in use cannot be deleted out from under them.
// - EACH ITEM HAS A SCALE, on top of the tool's own, for the one plant in a mix that is too big.
// - AN ASSET WITH A DEFAULT WEIGHT OF 0 STAYS OUT OF THE FIRST MIX: a clipped hedge is not one
//   plant among others in a bed. A palette of just that plant is one click from its card.
// - STANDARD PALETTES (Adam, 12-Nov-2026: "Make this into a standard pallette named Small Planting
//   Bed Shrubs"). The library's mixes are listed under the project's own in the palette list.
//   Choosing one copies it into the project, marked with Vegetation__Palette__StandardId so a
//   second choice finds that copy again, and tells the tool its proven plant scale and spacing.
// - A PICTURE OF EVERY PLANT (Adam, 12-Nov-2026: "Actually show small thumbnail graphics for the
//   plants used in the pallette as there is no visual representation currently so its horrible
//   to use"). Each item has its plant drawn small beside its name, by the same code as the cards
//   (the drawer is handed in by the asset browser), and Add a Plant is a grid of pictures.
//
// INTEGRATION:
// - Used by ../20__System__Tools/Na__Vegetation__LinearTool__.js and
//   ../20__System__Tools/Na__Vegetation__BushTool__.js. The + on a card in
//   ./Na__Vegetation__AssetBrowser__.js adds to the palette last worked on.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__PaletteEditor__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Nov-2026 - Version 1.3.0 (ValeVision3D v2.99.0, TrueVision3D v2.189.0)
// - A standard palette's own brush (Palette__BrushDensityPerSquareM, __BrushMinSpacingMm) goes
//   to the tool with its layout, and the toast and the hint say it.
//
// 12-Nov-2026 - Version 1.2.0 (ValeVision3D v2.97.0)
// - Standard palettes in the palette list, copied in on choice with their plant scale and spacing.
//   A picture beside each plant, and Add a Plant as picture tiles in place of a list of names.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - A scale on each item. A palette of one plant, for a card's Draw Path. A default weight of 0.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 6 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Shell, Runtime, Data and Sums
    // ------------------------------------------------------------
    import {
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__MarkChanged,
        Na__VegShell__BeforeChange,
        Na__VegShell__Toast,
        Na__VegShell__Config
    } from './Na__Vegetation__PanelShell__.js';
    import {
        Na__VegRun__GetSceneData,
        Na__VegRun__SyncPlants,
        Na__VegRun__EnsureRecipe
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    import { Na__VegData__NextUid, Na__VegData__FindPalette } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import { Na__VegLib__LoadCatalogue, Na__VegLib__LoadAllAssets, Na__VegLib__LoadStandardPalettes } from '../02__Core__Data/Na__Vegetation__Library__.js';
    import { Na__VegBrush__SharesOf } from '../01__Core__Engine/Na__Vegetation__BrushModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Slider's Range, and What a New Palette Is Called
    // ------------------------------------------------------------
    const Na__VegPalUi__WEIGHT_MAX   = 100;
    const Na__VegPalUi__FIRST_NAME   = 'Mixed Planting';
    const Na__VegPalUi__ADDED_WEIGHT = 25;
    const Na__VegPalUi__ONLY_WEIGHT  = 100;
    const Na__VegPalUi__STD_PREFIX   = 'STD:';                                 // <-- A standard palette's option in the list, not yet in the project
    const Na__VegPalUi__ITEM_PIC     = { w : 58, h : 50 };                // <-- Beside a plant in the mix
    const Na__VegPalUi__TILE_PIC     = { w : 78, h : 52 };                     // <-- A tile of Add a Plant
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Palette Last Worked On, and the Editors on the Page
    // ------------------------------------------------------------
    const Na__VegPalUi__State = {
        currentUid  : '',
        editors     : new Set(),                                               // <-- Each is a function that draws it again
        drawPicture : null,                                                    // <-- (canvas, recipe, size), the cards' own: handed in by the asset browser
        pictures    : new Map(),                                               // <-- 'assetId|wxh' -> a drawn canvas, copied rather than drawn again
        addOpen     : true                                                     // <-- Add a Plant unfolded, kept across redraws
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Data
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell Every Editor on the Page to Draw Itself Again
    // ------------------------------------------------------------
    function Na__VegPalUi__RefreshAll() {
        Na__VegPalUi__State.editors.forEach((draw) => draw());
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Sure the Project Has a Palette, and Say Which Is Current
    // ------------------------------------------------------------
    async function Na__VegPalUi__Ensure() {
        const sceneData = Na__VegRun__GetSceneData();
        const palettes  = sceneData.Vegetation__SceneData__Palettes;
        if (palettes.length === 0) {
            const assets = await Na__VegLib__LoadAllAssets();
            palettes.push({
                Vegetation__Palette__Uid   : Na__VegData__NextUid('PAL', palettes, 'Vegetation__Palette__Uid'),
                Vegetation__Palette__Name  : Na__VegPalUi__FIRST_NAME,
                Vegetation__Palette__Items : assets
                    .filter((asset) => !asset.Asset__Placement || asset.Asset__Placement.Placement__DefaultWeight !== 0)
                    .map((asset) => ({
                        Vegetation__PaletteItem__AssetId : asset.Asset__Id,
                        Vegetation__PaletteItem__Weight  : (asset.Asset__Placement && asset.Asset__Placement.Placement__DefaultWeight) || Na__VegPalUi__ADDED_WEIGHT
                    }))
            });                                                                // <-- Not marked as a change: only looking at a tool asks no question on leaving. It saves with whatever is planted from it
        }
        if (!Na__VegData__FindPalette(sceneData, Na__VegPalUi__State.currentUid)) {
            Na__VegPalUi__State.currentUid = palettes[0].Vegetation__Palette__Uid;
        }
        return Na__VegPalUi__State.currentUid;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Palette Last Worked On
    // ------------------------------------------------------------
    function Na__VegPalUi__CurrentUid() {
        return Na__VegPalUi__State.currentUid;
    }
    function Na__VegPalUi__SetCurrentUid(uid) {
        Na__VegPalUi__State.currentUid = uid;
        Na__VegPalUi__RefreshAll();
    }
    // ------------------------------------------------------------


    // FUNCTION | Add an Asset to the Palette Last Worked On
    // ------------------------------------------------------------
    // What the + on a card does. Already there, it says so rather than doubling it.
    // ------------------------------------------------------------
    async function Na__VegPalUi__AddAsset(assetId, assetName) {
        await Na__VegPalUi__Ensure();
        const sceneData = Na__VegRun__GetSceneData();
        const palette = Na__VegData__FindPalette(sceneData, Na__VegPalUi__State.currentUid);
        const items = palette.Vegetation__Palette__Items;
        if (items.some((item) => item.Vegetation__PaletteItem__AssetId === assetId)) {
            Na__VegShell__Toast((assetName || assetId) + ' is already in ' + palette.Vegetation__Palette__Name + '.', false);
            return false;
        }
        Na__VegShell__BeforeChange('');
        items.push({ Vegetation__PaletteItem__AssetId : assetId, Vegetation__PaletteItem__Weight : Na__VegPalUi__ADDED_WEIGHT });
        Na__VegShell__MarkChanged();
        await Na__VegRun__EnsureRecipe(assetId);
        await Na__VegRun__SyncPlants();
        Na__VegPalUi__RefreshAll();
        Na__VegShell__Toast((assetName || assetId) + ' added to ' + palette.Vegetation__Palette__Name + '.', false);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Standard Palette Was Proven At, for a Tool's onPick
    // ------------------------------------------------------------
    // { plantScale, spacingMm }, and from v1.3.0 brushDensity and brushSpacingMm where the palette
    // has its own brush (Palette__BrushDensityPerSquareM, Palette__BrushMinSpacingMm).
    // ------------------------------------------------------------
    function Na__VegPalUi__LayoutOf(standard) {
        const layout = { plantScale : standard.Palette__PlantScale, spacingMm : standard.Palette__SpacingMm };
        if (standard.Palette__BrushDensityPerSquareM > 0) layout.brushDensity   = standard.Palette__BrushDensityPerSquareM;
        if (standard.Palette__BrushMinSpacingMm > 0)      layout.brushSpacingMm = standard.Palette__BrushMinSpacingMm;
        return layout;
    }
    function Na__VegPalUi__BrushWords(standard) {
        if (!(standard.Palette__BrushDensityPerSquareM > 0) || !(standard.Palette__BrushMinSpacingMm > 0)) return '';
        return ', brushed at ' + Number(standard.Palette__BrushDensityPerSquareM).toFixed(1) + ' per sq m, ' + Math.round(standard.Palette__BrushMinSpacingMm) + ' mm apart';
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Standard Palette into the Project, Found or Copied, and Made Current
    // ------------------------------------------------------------
    // A copy made earlier is found by its StandardId and used as it now stands, so a project's
    // own changes to it are kept. Returns its uid.
    // ------------------------------------------------------------
    async function Na__VegPalUi__TakeStandard(standard) {
        await Na__VegPalUi__Ensure();
        const sceneData = Na__VegRun__GetSceneData();
        const palettes  = sceneData.Vegetation__SceneData__Palettes;
        let palette = palettes.find((row) => row.Vegetation__Palette__StandardId === standard.Palette__Id);
        if (!palette) {
            Na__VegShell__BeforeChange('');
            palette = {
                Vegetation__Palette__Uid        : Na__VegData__NextUid('PAL', palettes, 'Vegetation__Palette__Uid'),
                Vegetation__Palette__Name       : standard.Palette__Name,
                Vegetation__Palette__StandardId : standard.Palette__Id,
                Vegetation__Palette__Items      : (standard.Palette__Items || []).map((item) => ({
                    Vegetation__PaletteItem__AssetId : item.Item__AssetId,
                    Vegetation__PaletteItem__Weight  : item.Item__Weight
                }))
            };
            palettes.push(palette);
            Na__VegShell__MarkChanged();
        }
        for (const item of palette.Vegetation__Palette__Items) await Na__VegRun__EnsureRecipe(item.Vegetation__PaletteItem__AssetId);
        Na__VegPalUi__State.currentUid = palette.Vegetation__Palette__Uid;
        return palette.Vegetation__Palette__Uid;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Palette of Just One Plant, Found or Made, and Made Current
    // ------------------------------------------------------------
    // Called by a card's Draw Path. Returns its uid.
    // ------------------------------------------------------------
    async function Na__VegPalUi__OnlyThis(assetId, assetName) {
        await Na__VegPalUi__Ensure();
        const sceneData = Na__VegRun__GetSceneData();
        const palettes  = sceneData.Vegetation__SceneData__Palettes;
        let palette = palettes.find((row) => {
            const items = row.Vegetation__Palette__Items || [];
            return items.length === 1 && items[0].Vegetation__PaletteItem__AssetId === assetId;
        });
        if (!palette) {
            Na__VegShell__BeforeChange('');
            palette = {
                Vegetation__Palette__Uid   : Na__VegData__NextUid('PAL', palettes, 'Vegetation__Palette__Uid'),
                Vegetation__Palette__Name  : assetName || assetId,
                Vegetation__Palette__Items : [{ Vegetation__PaletteItem__AssetId : assetId, Vegetation__PaletteItem__Weight : Na__VegPalUi__ONLY_WEIGHT }]
            };
            palettes.push(palette);
            Na__VegShell__MarkChanged();
        }
        await Na__VegRun__EnsureRecipe(assetId);
        Na__VegPalUi__State.currentUid = palette.Vegetation__Palette__Uid;
        Na__VegPalUi__RefreshAll();
        return palette.Vegetation__Palette__Uid;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plants' Pictures
// -----------------------------------------------------------------------------

    // FUNCTION | Be Given the Cards' Picture Drawer
    // ------------------------------------------------------------
    // The asset browser hands in its own, so a plant looks the same here as on its card.
    // ------------------------------------------------------------
    function Na__VegPalUi__SetPictureDrawer(drawPicture) {
        Na__VegPalUi__State.drawPicture = drawPicture;
        Na__VegPalUi__State.pictures.clear();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Small Picture of One Plant, Drawn Once and Copied After
    // ------------------------------------------------------------
    // Returns the canvas at once; it fills in when the plant's recipe has been read. With no
    // drawer yet it stays an empty frame, which is all a list needs to keep its shape.
    // ------------------------------------------------------------
    function Na__VegPalUi__Picture(assetId, size) {
        const state  = Na__VegPalUi__State;
        const canvas = Na__VegShell__El('canvas', 'na-veg-palette-pic');
        canvas.style.width  = size.w + 'px';
        canvas.style.height = size.h + 'px';
        canvas.setAttribute('aria-hidden', 'true');
        const key   = assetId + '|' + size.w + 'x' + size.h;
        const paint = (source) => {
            canvas.width  = source.width;
            canvas.height = source.height;
            canvas.getContext('2d').drawImage(source, 0, 0);
        };
        if (state.pictures.has(key)) {
            paint(state.pictures.get(key));
            return canvas;
        }
        if (!state.drawPicture) return canvas;
        Na__VegRun__EnsureRecipe(assetId).then((recipe) => {
            if (!recipe || !state.drawPicture) return;
            let source = state.pictures.get(key);
            if (!source) {
                source = document.createElement('canvas');
                state.drawPicture(source, recipe, size);
                state.pictures.set(key, source);
            }
            paint(source);
        }).catch(() => {});                                                    // <-- An asset that cannot be read keeps its empty frame; its name still says what it is
        return canvas;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Editor
// -----------------------------------------------------------------------------

    // FUNCTION | Mount a Palette Editor into a Panel
    // ------------------------------------------------------------
    // options: { holder, onPick(paletteUid, layout) }. onPick is told when another palette is
    // chosen here, so a tool can move its path or its brush to it. layout is given only when a
    // standard palette is chosen: { plantScale, spacingMm }, what its mix was proven at.
    // Returns a function that takes the editor away again.
    // ------------------------------------------------------------
    async function Na__VegPalUi__Mount(options) {
        await Na__VegPalUi__Ensure();
        const catalogue = await Na__VegLib__LoadCatalogue();
        const standards = await Na__VegLib__LoadStandardPalettes();
        const nameOf = (assetId) => {
            const row = catalogue.find((candidate) => candidate.Asset__Id === assetId);
            return row ? row.Asset__Name : assetId;
        };

        const holder = options.holder;

        function draw() {
            const sceneData = Na__VegRun__GetSceneData();
            const palettes  = sceneData.Vegetation__SceneData__Palettes;
            const palette   = Na__VegData__FindPalette(sceneData, Na__VegPalUi__State.currentUid) || palettes[0];
            holder.textContent = '';
            if (!palette) return;

            // WHICH PALETTE | A list, a name, and new or delete
            const picker = Na__VegShell__El('select', 'na-veg-field');
            picker.setAttribute('aria-label', 'Palette');
            const own = Na__VegShell__El('optgroup');
            own.label = 'In this project';
            palettes.forEach((row) => {
                const option = Na__VegShell__El('option', '', row.Vegetation__Palette__Name);
                option.value = row.Vegetation__Palette__Uid;
                option.selected = row === palette;
                own.appendChild(option);
            });
            picker.appendChild(own);
            const notTaken = standards.filter((standard) => !palettes.some((row) => row.Vegetation__Palette__StandardId === standard.Palette__Id));
            if (notTaken.length > 0) {
                const library = Na__VegShell__El('optgroup');
                library.label = 'Standard palettes';
                notTaken.forEach((standard) => {
                    const option = Na__VegShell__El('option', '', standard.Palette__Name);
                    option.value = Na__VegPalUi__STD_PREFIX + standard.Palette__Id;
                    option.title = standard.Palette__Description || '';
                    library.appendChild(option);
                });
                picker.appendChild(library);
            }
            picker.addEventListener('change', async () => {
                if (picker.value.startsWith(Na__VegPalUi__STD_PREFIX)) {
                    const standard = standards.find((row) => Na__VegPalUi__STD_PREFIX + row.Palette__Id === picker.value);
                    const uid = await Na__VegPalUi__TakeStandard(standard);
                    if (options.onPick) options.onPick(uid, Na__VegPalUi__LayoutOf(standard));
                    Na__VegShell__Toast(standard.Palette__Name + ' added to this project, at plant scale ' + Number(standard.Palette__PlantScale).toFixed(2) + ' and ' + Math.round(standard.Palette__SpacingMm) + ' mm spacing' + Na__VegPalUi__BrushWords(standard) + '.', false);
                } else {
                    Na__VegPalUi__State.currentUid = picker.value;
                    if (options.onPick) options.onPick(picker.value);
                }
                Na__VegPalUi__RefreshAll();
            });
            holder.appendChild(picker);

            // WHERE IT CAME FROM | A standard palette's copy says so, with its proven layout
            const standard = standards.find((row) => row.Palette__Id === palette.Vegetation__Palette__StandardId);
            if (standard) {
                const from = Na__VegShell__El('p', 'na-veg-panel__hint', 'From the standard palette ' + standard.Palette__Name + ', made for plant scale ' + Number(standard.Palette__PlantScale).toFixed(2) + ' at ' + Math.round(standard.Palette__SpacingMm) + ' mm spacing' + Na__VegPalUi__BrushWords(standard) + '. Changes here stay in this project.');
                from.style.marginTop = '4px';
                holder.appendChild(from);
            }

            const nameRow = Na__VegShell__El('div', 'na-veg-row');
            nameRow.style.marginTop = '6px';
            const name = Na__VegShell__El('input', 'na-veg-field');
            name.type = 'text';
            name.value = palette.Vegetation__Palette__Name;
            name.setAttribute('aria-label', 'Palette name');
            name.addEventListener('change', () => {
                Na__VegShell__BeforeChange('');
                palette.Vegetation__Palette__Name = name.value.trim() || palette.Vegetation__Palette__Name;
                Na__VegShell__MarkChanged();
                Na__VegPalUi__RefreshAll();
            });
            nameRow.appendChild(name);
            holder.appendChild(nameRow);

            const actions = Na__VegShell__El('div', 'na-veg-row');
            actions.appendChild(Na__VegShell__Button('New Palette', '', () => {
                Na__VegShell__BeforeChange('');
                const uid = Na__VegData__NextUid('PAL', palettes, 'Vegetation__Palette__Uid');
                palettes.push({
                    Vegetation__Palette__Uid   : uid,
                    Vegetation__Palette__Name  : 'Palette ' + (palettes.length + 1),
                    Vegetation__Palette__Items : JSON.parse(JSON.stringify(palette.Vegetation__Palette__Items))
                });
                Na__VegPalUi__State.currentUid = uid;
                Na__VegShell__MarkChanged();
                if (options.onPick) options.onPick(uid);
                Na__VegPalUi__RefreshAll();
            }, 'A new palette, starting as a copy of this one'));
            const remove = Na__VegShell__Button('Delete', 'na-veg-btn--danger', () => {
                const used = sceneData.Vegetation__SceneData__Paths.filter((path) => path.Vegetation__Path__PaletteUid === palette.Vegetation__Palette__Uid).length;
                if (used > 0) {
                    Na__VegShell__Toast(palette.Vegetation__Palette__Name + ' draws ' + used + (used === 1 ? ' path' : ' paths') + ', so it stays. Move them to another palette first.', true);
                    return;
                }
                if (palettes.length === 1) {
                    Na__VegShell__Toast('The tools need at least one palette.', true);
                    return;
                }
                Na__VegShell__BeforeChange('');
                palettes.splice(palettes.indexOf(palette), 1);
                Na__VegPalUi__State.currentUid = palettes[0].Vegetation__Palette__Uid;
                Na__VegShell__MarkChanged();
                if (options.onPick) options.onPick(Na__VegPalUi__State.currentUid);
                Na__VegPalUi__RefreshAll();
            });
            actions.appendChild(remove);
            holder.appendChild(actions);

            // THE ITEMS | One slider each, the shares shown live
            const items  = palette.Vegetation__Palette__Items;
            const shares = Na__VegBrush__SharesOf(items.map((item) => ({ weight : item.Vegetation__PaletteItem__Weight })));
            const shareEls = [];
            items.forEach((item, index) => {
                const row = Na__VegShell__El('div', 'na-veg-palette-item');
                row.appendChild(Na__VegPalUi__Picture(item.Vegetation__PaletteItem__AssetId, Na__VegPalUi__ITEM_PIC));
                const side = Na__VegShell__El('div', 'na-veg-palette-item__side');    // <-- Name, share, scale and slider beside the picture
                row.appendChild(side);
                const top = Na__VegShell__El('div', 'na-veg-palette-item__top');
                const label = Na__VegShell__El('span', 'na-veg-palette-item__name', nameOf(item.Vegetation__PaletteItem__AssetId));
                label.title = nameOf(item.Vegetation__PaletteItem__AssetId);
                top.appendChild(label);
                const share = Na__VegShell__El('span', 'na-veg-palette-item__share', Math.round(shares[index]) + '%');
                shareEls.push(share);
                top.appendChild(share);

                // ITS OWN SCALE | On top of the tool's, for the one plant too big for the bed
                const scale = Na__VegShell__El('input', 'na-veg-field na-veg-field--number na-veg-palette-item__scale');
                const scaleConfig = Na__VegShell__Config().Vegetation__DevTools__Config;
                scale.type  = 'number';
                scale.min   = String(scaleConfig.Vegetation__DevTools__PlantScaleMin);
                scale.max   = String(scaleConfig.Vegetation__DevTools__PlantScaleMax);
                scale.step  = String(scaleConfig.Vegetation__DevTools__PlantScaleStep);
                scale.value = Number(item.Vegetation__PaletteItem__PlantScale > 0 ? item.Vegetation__PaletteItem__PlantScale : 1).toFixed(2);
                scale.title = 'This plant\'s own scale in the mix, on top of the tool\'s Plant scale';
                scale.setAttribute('aria-label', 'Scale of ' + nameOf(item.Vegetation__PaletteItem__AssetId));
                scale.addEventListener('change', async () => {
                    const value = Math.min(scaleConfig.Vegetation__DevTools__PlantScaleMax, Math.max(scaleConfig.Vegetation__DevTools__PlantScaleMin, Number(scale.value) || 1));
                    scale.value = value.toFixed(2);
                    Na__VegShell__BeforeChange('');
                    if (value === 1) delete item.Vegetation__PaletteItem__PlantScale;
                    else item.Vegetation__PaletteItem__PlantScale = value;
                    Na__VegShell__MarkChanged();
                    await Na__VegRun__SyncPlants();
                });
                top.appendChild(scale);

                const out = Na__VegShell__El('button', 'na-veg-palette-item__remove', '×');
                out.type = 'button';
                out.title = 'Take this out of the palette';
                out.addEventListener('click', async () => {
                    if (items.length === 1) {
                        Na__VegShell__Toast('A palette needs at least one plant.', true);
                        return;
                    }
                    Na__VegShell__BeforeChange('');
                    items.splice(items.indexOf(item), 1);
                    Na__VegShell__MarkChanged();
                    Na__VegPalUi__RefreshAll();
                    await Na__VegRun__SyncPlants();
                });
                top.appendChild(out);
                side.appendChild(top);

                const slider = Na__VegShell__El('input', 'na-veg-slider__input');
                slider.type = 'range';
                slider.min = '0';
                slider.max = String(Na__VegPalUi__WEIGHT_MAX);
                slider.step = '1';
                slider.value = String(item.Vegetation__PaletteItem__Weight);
                slider.setAttribute('aria-label', 'Probability of ' + nameOf(item.Vegetation__PaletteItem__AssetId));
                slider.addEventListener('input', () => {
                    Na__VegShell__BeforeChange('palette-weight');
                    item.Vegetation__PaletteItem__Weight = Number(slider.value);
                    Na__VegShell__MarkChanged();
                    const live = Na__VegBrush__SharesOf(items.map((row2) => ({ weight : row2.Vegetation__PaletteItem__Weight })));
                    shareEls.forEach((el, k) => { el.textContent = Math.round(live[k]) + '%'; });
                });
                slider.addEventListener('change', () => { Na__VegRun__SyncPlants(); });
                side.appendChild(slider);
                holder.appendChild(row);
            });

            // ADD WITHOUT THE BROWSER | A tile with its picture for each plant not yet in the mix.
            // The + on a card does this too.
            const missing = catalogue.filter((row) => !items.some((item) => item.Vegetation__PaletteItem__AssetId === row.Asset__Id));
            if (missing.length > 0) {
                const add = Na__VegShell__El('details', 'na-veg-palette-add');
                add.open = Na__VegPalUi__State.addOpen;
                add.addEventListener('toggle', () => { Na__VegPalUi__State.addOpen = add.open; });
                add.appendChild(Na__VegShell__El('summary', 'na-veg-palette-add__title', 'Add a plant'));
                const grid = Na__VegShell__El('div', 'na-veg-palette-add__grid');
                missing.forEach((row) => {
                    const tile = Na__VegShell__El('button', 'na-veg-palette-tile');
                    tile.type  = 'button';
                    tile.title = 'Add ' + row.Asset__Name + ' to ' + palette.Vegetation__Palette__Name;
                    tile.appendChild(Na__VegPalUi__Picture(row.Asset__Id, Na__VegPalUi__TILE_PIC));
                    tile.appendChild(Na__VegShell__El('span', 'na-veg-palette-tile__name', row.Asset__Name));
                    tile.addEventListener('click', () => { Na__VegPalUi__AddAsset(row.Asset__Id, row.Asset__Name); });
                    grid.appendChild(tile);
                });
                add.appendChild(grid);
                holder.appendChild(add);
            }
        }

        Na__VegPalUi__State.editors.add(draw);
        draw();
        return () => { Na__VegPalUi__State.editors.delete(draw); };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Palette Editor API
    // ------------------------------------------------------------
    export {
        Na__VegPalUi__Ensure,
        Na__VegPalUi__CurrentUid,
        Na__VegPalUi__SetCurrentUid,
        Na__VegPalUi__AddAsset,
        Na__VegPalUi__OnlyThis,
        Na__VegPalUi__TakeStandard,
        Na__VegPalUi__SetPictureDrawer,
        Na__VegPalUi__RefreshAll,
        Na__VegPalUi__Mount
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
