// =============================================================================
// TRUEVISION3D - VEGETATION - THE RIGHT-CLICK MENU
// =============================================================================
//
// FILE       : Na__Vegetation__PlantMenu__.js
// NAMESPACE  : Na__VegPlantMenu
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a right-click on a plant opens: replace it with pictures of the other
//              plants, delete it, and the few other moves. A plant of a path changes alone
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "Add the same right click swap for vegetation too". The same menu as the
//   people's (../../28__System__Entourage/10__Ui__Panels/Na__Entourage__FigureMenu__.js), so the two
//   read as one. Resting on a picture shows that plant's proxy standing where this one is.
// - ONLY WHILE VEGETATION ASSETS IS OPEN AND NO OTHER TOOL HAS THE CLICKS. With it closed the model
//   behaves as normal, and a right press that travelled was a pan, so it opens nothing.
// - A SINGLE PLANT is its own record, and is simply changed. Its size follows the new asset's by
//   the ratio of its old size to the old asset's, so a plant varied to be taller stays taller.
// - A PLANT OF A PATH is worked out from the path's rules, so the record says only what is different
//   about that one plant: Vegetation__Path__PlantChanges, by its number. No other plant moves
//   (./../01__Core__Engine/Na__Vegetation__PathModel__.js).
// - A PLANT BEHIND THE MODEL IS NOT THERE TO TAKE. Nothing else may hear the click.
//
// INTEGRATION:
// - Started and stopped by ../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js with its panel.
// - Styles: the people's stylesheet, which the plants' shell adds to the page.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__PlantMenu__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : The right-click listens in the capture phase and, when it opens this menu,
//                   stops the event, so TrueVision's model context menu (27__System__ContextMenuSystem,
//                   which ValeVision has not) does not open over it. A right-click on anything
//                   else still reaches that menu. Entourage is 28__System__Entourage in TrueVision.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - TrueVision3D v2.185.0
// - The right-click is heard before TrueVision's model menu, and keeps it shut over this one.
//
// 11-Nov-2026 - Version 1.1.0 (ValeVision3D v2.96.0)
// - The menu says who added the plant (or its path) and when, and who changed it last.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.89.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Menu, the Pick and the Plants
    // ------------------------------------------------------------
    import { Na__EntPopup__Open, Na__EntPopup__Close } from '../../28__System__Entourage/10__Ui__Panels/Na__Entourage__FigureMenu__.js';
    import { Na__VegPick__AtPointer, Na__VegPick__RayAt } from './Na__Vegetation__SurfacePick__.js';
    import { Na__VegOverlay__ToScreen } from './Na__Vegetation__ToolOverlay__.js';
    import { Na__VegTools__Repaint } from './Na__Vegetation__ToolHost__.js';
    import { Na__VegData__FindPath, Na__VegData__NextUid, Na__VegData__Work, Na__VegData__IsOnServer } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import { Na__SceneChanges__OwnerLines } from '../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js';
    import {
        Na__VegRun__GetContext,
        Na__VegRun__GetLayer,
        Na__VegRun__GetSceneData,
        Na__VegRun__PathPlants,
        Na__VegRun__PaintProxy,
        Na__VegRun__PinInUse,
        Na__VegRun__RecipeFor,
        Na__VegRun__SizeOf,
        Na__VegRun__SyncPlants
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    import {
        Na__VegShell__BeforeChange,
        Na__VegShell__Config,
        Na__VegShell__MarkChanged
    } from '../10__Ui__Panels/Na__Vegetation__PanelShell__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Pictures, the Gap from the Plant, and What Counts as Behind the Model
    // ------------------------------------------------------------
    const Na__VegPlantMenu__THUMB       = { w : 70, h : 54 };
    const Na__VegPlantMenu__COLUMNS     = 3;
    const Na__VegPlantMenu__MENU_GAP_PX = 14;
    const Na__VegPlantMenu__BEHIND_M    = 0.1;
    const Na__VegPlantMenu__SEED_RANGE  = 1000000000;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Going On
    // ------------------------------------------------------------
    const Na__VegPlantMenu__State = {
        running   : false,
        hooks     : {},                                                        // <-- { hasTheClicks(), onPicked(kind, uid), onChanged(), catalogue(), drawPicture(canvas, recipe, size), startMove() }
        rightAt   : null,
        plant     : null,                                                      // <-- The plant the menu was opened on, in the shape of a saved plop: its rows run after it has closed
        showing   : false,                                                     // <-- The menu is up, so that plant is what shows on the model
        pathUid   : '',
        number    : '',                                                        // <-- Its number along its path, as PlantChanges keys it
        previewId : ''
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Which Plant
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Plant Under the Pointer, in the Shape of a Saved Plop, or Null
    // ------------------------------------------------------------
    // Returns { plant, pathUid, number }. Its number is what its uid ends in, P0001-007 being 7.
    // ------------------------------------------------------------
    function Na__VegPlantMenu__PlantAt(event) {
        const ray   = Na__VegPick__RayAt(event.clientX, event.clientY);
        const layer = Na__VegRun__GetLayer();
        if (!ray || !layer) return null;
        const hit = layer.pick(ray.origin, ray.direction);
        if (!hit) return null;

        const sceneData = Na__VegRun__GetSceneData();
        let found = null;
        if (hit.pathUid) {
            const path = Na__VegData__FindPath(sceneData, hit.pathUid);
            const plant = path ? Na__VegRun__PathPlants(path).find((row) => row.Vegetation__Plop__Uid === hit.uid) : null;
            if (!plant) return null;
            found = { plant, pathUid : hit.pathUid, number : String(parseInt(hit.uid.slice(hit.uid.lastIndexOf('-') + 1), 10)) };
        } else {
            const plant = sceneData.Vegetation__SceneData__Plops.find((row) => row.Vegetation__Plop__Uid === hit.uid);
            if (!plant) return null;
            found = { plant, pathUid : '', number : '' };
        }

        // NOT THROUGH A WALL | The model's surface against the near side of the plant
        const surface = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (surface) {
            const at = found.plant.Vegetation__Plop__PositionMm;
            const size = Na__VegRun__SizeOf(found.plant);
            const middle = Math.hypot(at[0] / 1000 - ray.origin.x, (at[1] + size[2] / 2) / 1000 - ray.origin.y, at[2] / 1000 - ray.origin.z);
            const reach  = Math.max(size[0], size[1], size[2]) / 2000;
            if (surface.point.distanceTo(ray.origin) < middle - reach - Na__VegPlantMenu__BEHIND_M) return null;
        }
        return found;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Each Row Does
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Object Has Changed: Draw It Again and Tell the Panel
    // ------------------------------------------------------------
    async function Na__VegPlantMenu__Done() {
        Na__VegShell__MarkChanged();
        await Na__VegRun__PinInUse();
        await Na__VegRun__SyncPlants();
        if (Na__VegPlantMenu__State.hooks.onChanged) Na__VegPlantMenu__State.hooks.onChanged();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Plant of a Path: What Is Different About It, Tidied
    // ------------------------------------------------------------
    // edit(change) writes on the plant's entry. An entry left empty goes, and a map left empty goes.
    // ------------------------------------------------------------
    function Na__VegPlantMenu__EditPathPlant(pathUid, number, edit) {
        const path = Na__VegData__FindPath(Na__VegRun__GetSceneData(), pathUid);
        if (!path) return;
        const changes = path.Vegetation__Path__PlantChanges || {};
        const change = changes[number] || {};
        edit(change);
        if (Object.keys(change).length > 0) changes[number] = change;
        else delete changes[number];
        if (Object.keys(changes).length > 0) path.Vegetation__Path__PlantChanges = changes;
        else delete path.Vegetation__Path__PlantChanges;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Scale Within What the Sliders Allow
    // ------------------------------------------------------------
    function Na__VegPlantMenu__Limit(scale) {
        const dev = Na__VegShell__Config().Vegetation__DevTools__Config;
        return Math.max(dev.Vegetation__DevTools__PlantScaleMin, Math.min(dev.Vegetation__DevTools__PlantScaleMax, Math.round(scale * 100) / 100));
    }
    // ------------------------------------------------------------


    // FUNCTION | Bigger or Smaller by a Factor
    // ------------------------------------------------------------
    async function Na__VegPlantMenu__Scale(factor) {
        const state = Na__VegPlantMenu__State;
        Na__VegShell__BeforeChange('');
        if (state.pathUid) {
            Na__VegPlantMenu__EditPathPlant(state.pathUid, state.number, (change) => {
                const now = Na__VegPlantMenu__Limit((change.Vegetation__PlantChange__Scale > 0 ? change.Vegetation__PlantChange__Scale : 1) * factor);
                if (now === 1) delete change.Vegetation__PlantChange__Scale;
                else change.Vegetation__PlantChange__Scale = now;
            });
        } else {
            const plop = state.plant;
            const now = Na__VegPlantMenu__Limit((plop.Vegetation__Plop__Scale > 0 ? plop.Vegetation__Plop__Scale : 1) * factor);
            if (now === 1) delete plop.Vegetation__Plop__Scale;
            else plop.Vegetation__Plop__Scale = now;
        }
        await Na__VegPlantMenu__Done();
    }
    // ------------------------------------------------------------


    // FUNCTION | Swap for Another Plant
    // ------------------------------------------------------------
    // A single plant keeps its spot, its Uid, its seed, its scale and how far it was varied from its
    // asset's size. A plant of a path takes its size from the path's own sums.
    // ------------------------------------------------------------
    async function Na__VegPlantMenu__Swap(assetId) {
        const state = Na__VegPlantMenu__State;
        const hooks = state.hooks;
        Na__VegShell__BeforeChange('');
        if (state.pathUid) {
            Na__VegPlantMenu__EditPathPlant(state.pathUid, state.number, (change) => {
                change.Vegetation__PlantChange__AssetId = assetId;
            });
        } else {
            const plop  = state.plant;
            const was   = Na__VegRun__RecipeFor(plop.Vegetation__Plop__AssetId);
            const other = hooks.recipeOf ? hooks.recipeOf(assetId) : null;
            if (other) {
                const from = was ? was.Asset__Size : null;
                const to   = other.Asset__Size;
                const saved = plop.Vegetation__Plop__SizeMm;
                const ratio = (index, ownOld) => (saved && from && ownOld > 0 ? saved[index] / ownOld : 1);
                plop.Vegetation__Plop__SizeMm = [
                    Math.round(to.Size__WidthMm * ratio(0, from ? from.Size__WidthMm : 0)),
                    Math.round(to.Size__DepthMm * ratio(1, from ? from.Size__DepthMm : 0)),
                    Math.round(to.Size__HeightMm * ratio(2, from ? from.Size__HeightMm : 0))
                ];
            }
            plop.Vegetation__Plop__AssetId = assetId;
        }
        await Na__VegPlantMenu__Done();
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Plant
    // ------------------------------------------------------------
    async function Na__VegPlantMenu__Delete() {
        const state = Na__VegPlantMenu__State;
        const sceneData = Na__VegRun__GetSceneData();
        Na__VegShell__BeforeChange('');
        if (state.pathUid) {
            Na__VegPlantMenu__EditPathPlant(state.pathUid, state.number, (change) => {
                change.Vegetation__PlantChange__Removed = true;
            });
        } else {
            sceneData.Vegetation__SceneData__Plops = sceneData.Vegetation__SceneData__Plops.filter((row) => row !== state.plant);
            if (state.hooks.onPicked) state.hooks.onPicked(null, '');
        }
        await Na__VegPlantMenu__Done();
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy a Single Plant Beside Itself
    // ------------------------------------------------------------
    // To its right as seen from here, at its own height. A new seed, so it is drawn its own way.
    // ------------------------------------------------------------
    async function Na__VegPlantMenu__Copy() {
        const state = Na__VegPlantMenu__State;
        const sceneData = Na__VegRun__GetSceneData();
        const dev = Na__VegShell__Config().Vegetation__DevTools__Config;
        const e = Na__VegRun__GetContext().camera.matrixWorld.elements;
        const position = state.plant.Vegetation__Plop__PositionMm;
        const across = Math.max(dev.Vegetation__DevTools__CopyOffsetMm, Na__VegRun__SizeOf(state.plant)[0]);
        Na__VegShell__BeforeChange('');
        const copy = JSON.parse(JSON.stringify(state.plant));
        copy.Vegetation__Plop__Uid  = Na__VegData__NextUid('A', sceneData.Vegetation__SceneData__Plops, 'Vegetation__Plop__Uid');
        copy.Vegetation__Plop__Seed = Math.floor(Math.random() * Na__VegPlantMenu__SEED_RANGE);
        copy.Vegetation__Plop__PositionMm = [Math.round(position[0] + e[0] * across), position[1], Math.round(position[2] + e[2] * across)];
        delete copy.Vegetation__Plop__StrokeUid;                               // <-- A plant of its own: a stroke is what was brushed together
        sceneData.Vegetation__SceneData__Plops.push(copy);
        if (state.hooks.onPicked) state.hooks.onPicked('plop', copy.Vegetation__Plop__Uid);
        await Na__VegPlantMenu__Done();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Menu
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open the Menu on a Plant
    // ------------------------------------------------------------
    function Na__VegPlantMenu__Open(found, x, y) {
        const state = Na__VegPlantMenu__State;
        const hooks = state.hooks;
        state.plant   = found.plant;
        state.showing = true;
        state.pathUid = found.pathUid;
        state.number  = found.number;

        const dev  = Na__VegShell__Config().Vegetation__DevTools__Config;
        const step = dev.Vegetation__DevTools__MenuScaleStep;
        const percent = Math.round((step - 1) * 100);
        const assetId = found.plant.Vegetation__Plop__AssetId;
        const catalogue = hooks.catalogue ? hooks.catalogue() : [];
        const here = catalogue.find((row) => row.Asset__Id === assetId);
        const name = here ? here.Asset__Name : assetId;

        // BESIDE THE PLANT, NOT OVER IT | Resting on a picture shows that plant standing there.
        // To its right as seen from here.
        const camera = Na__VegRun__GetContext().camera;
        const renderer = Na__VegRun__GetContext().renderer;
        const e = camera.matrixWorld.elements;
        const size = Na__VegRun__SizeOf(found.plant);
        const position = found.plant.Vegetation__Plop__PositionMm;
        const edge = Na__VegOverlay__ToScreen(
            (position[0] + (e[0] * size[0]) / 2) / 1000,
            (position[1] + size[2] / 2) / 1000,
            (position[2] + (e[2] * size[0]) / 2) / 1000
        );
        const canvasLeft = renderer.domElement.getBoundingClientRect().left;
        const besideX = edge ? Math.max(x, canvasLeft + edge.x + Na__VegPlantMenu__MENU_GAP_PX) : x;

        const rows = [];
        if (!state.pathUid) rows.push({ id : 'naVegetationMenuMove', label : 'Move', hint : 'then click', action : () => { if (hooks.startMove) hooks.startMove(); } });
        rows.push({ id : 'naVegetationMenuBigger', label : 'Bigger', hint : '+' + percent + '%', action : () => Na__VegPlantMenu__Scale(step) });
        rows.push({ id : 'naVegetationMenuSmaller', label : 'Smaller', hint : '-' + percent + '%', action : () => Na__VegPlantMenu__Scale(1 / step) });
        if (!state.pathUid) rows.push({ id : 'naVegetationMenuCopy', label : 'Copy beside it', action : Na__VegPlantMenu__Copy });

        const lastRows = [
            { id : 'naVegetationMenuDelete', label : state.pathUid ? 'Delete this plant' : 'Delete', hint : state.pathUid ? '' : 'Del', danger : true, action : Na__VegPlantMenu__Delete }
        ];
        if (state.pathUid) {
            lastRows.unshift({ id : 'naVegetationMenuWholePath', label : 'Select the whole path', action : () => { if (hooks.onPicked) hooks.onPicked('path', state.pathUid); } });
        }

        // WHO ADDED IT AND WHEN | A path's plant is the path's: it was drawn as one (Adam, 11-Nov-2026:
        // "ownership / accountability")
        const work = Na__VegData__Work();
        const kind = state.pathUid ? 'path' : 'plop';
        const uid  = state.pathUid || found.plant.Vegetation__Plop__Uid;
        const owner = Na__SceneChanges__OwnerLines(work.summary, kind + ':' + uid, work.me && work.me.code, Na__VegData__IsOnServer(kind, uid));
        if (state.pathUid && owner.length > 0) owner[0] = owner[0].replace(/^Added /, 'Path added ');

        Na__EntPopup__Open({
            title : state.pathUid ? name + ', plant ' + state.number + ' of ' + state.pathUid : name,
            owner,
            x : besideX, y,
            rows,
            swaps : catalogue
                .filter((row) => row.Asset__Id !== assetId && row.Asset__Status !== 'Retired')
                .map((row) => ({ assetId : row.Asset__Id, name : row.Asset__Name, recipe : hooks.recipeOf ? hooks.recipeOf(row.Asset__Id) : null }))
                .filter((swap) => swap.recipe),
            thumb    : Na__VegPlantMenu__THUMB,
            columns  : Na__VegPlantMenu__COLUMNS,
            drawSwap : (canvas, swap, picture) => hooks.drawPicture(canvas, swap.recipe, picture),
            onSwap   : Na__VegPlantMenu__Swap,
            onPreview : (previewId) => {
                state.previewId = previewId;
                Na__VegTools__Repaint();
            },
            lastRows,
            onClose : () => {
                state.previewId = '';
                state.showing = false;
                Na__VegTools__Repaint();
            }
        });
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HANDLERS | A Right Press, and What It Becomes
    // ------------------------------------------------------------
    function Na__VegPlantMenu__OnRightDown(event) {
        if (event.button === 2) Na__VegPlantMenu__State.rightAt = { x : event.clientX, y : event.clientY };
    }
    function Na__VegPlantMenu__OnContextMenu(event) {
        const state = Na__VegPlantMenu__State;
        const from = state.rightAt;
        state.rightAt = null;
        if (!state.hooks.hasTheClicks || !state.hooks.hasTheClicks()) return;
        const slop = Na__VegShell__Config().Vegetation__DevTools__Config.Vegetation__DevTools__RightClickSlopPx;
        if (from && (Math.abs(event.clientX - from.x) > slop || Math.abs(event.clientY - from.y) > slop)) return;
        const found = Na__VegPlantMenu__PlantAt(event);
        if (!found) return;
        event.preventDefault();
        event.stopImmediatePropagation();                                      // <-- TrueVision: its model menu must not open over this one
        if (state.hooks.onPicked) state.hooks.onPicked(found.pathUid ? 'path' : 'plop', found.pathUid || found.plant.Vegetation__Plop__Uid);
        Na__VegPlantMenu__Open(found, event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Plant the Menu Is About, and What Is Being Rested On
    // ------------------------------------------------------------
    // True while the menu is open, so a whole path selected does not hide which plant it is about.
    // ------------------------------------------------------------
    function Na__VegPlantMenu__Paint(pen) {
        const state = Na__VegPlantMenu__State;
        if (!state.showing || !state.plant) return false;
        Na__VegRun__PaintProxy(pen, state.plant, pen.SELECTED);
        if (!state.previewId || !state.hooks.recipeOf) return true;
        const other = state.hooks.recipeOf(state.previewId);
        if (!other) return true;
        const size = other.Asset__Size;
        const zoom = state.plant.Vegetation__Plop__Scale > 0 ? state.plant.Vegetation__Plop__Scale : 1;
        pen.dome(
            state.plant.Vegetation__Plop__PositionMm,
            [size.Size__WidthMm, size.Size__DepthMm, size.Size__HeightMm].map((mm) => Math.round(mm * zoom)),
            state.plant.Vegetation__Plop__YawDeg,
            null,
            other.Asset__Proxy ? other.Asset__Proxy.Proxy__Shape : 'Dome'
        );
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Starting and Stopping
// -----------------------------------------------------------------------------

    // FUNCTION | The Panel Has Opened
    // ------------------------------------------------------------
    // hooks: { hasTheClicks(), onPicked(kind, uid), onChanged(), catalogue(), recipeOf(assetId),
    //          drawPicture(canvas, recipe, size), startMove() }
    // ------------------------------------------------------------
    function Na__VegPlantMenu__Start(context, hooks) {
        const state = Na__VegPlantMenu__State;
        if (state.running) return;
        state.running = true;
        state.hooks   = hooks;
        const canvas = context.renderer.domElement;
        canvas.addEventListener('pointerdown', Na__VegPlantMenu__OnRightDown);
        canvas.addEventListener('contextmenu', Na__VegPlantMenu__OnContextMenu, true);   // <-- Capture: heard before TrueVision's model menu
    }
    // ------------------------------------------------------------


    // FUNCTION | The Panel Has Closed
    // ------------------------------------------------------------
    function Na__VegPlantMenu__Stop(context) {
        const state = Na__VegPlantMenu__State;
        if (!state.running) return;
        state.running = false;
        Na__EntPopup__Close();
        const canvas = context.renderer.domElement;
        canvas.removeEventListener('pointerdown', Na__VegPlantMenu__OnRightDown);
        canvas.removeEventListener('contextmenu', Na__VegPlantMenu__OnContextMenu, true);
        state.hooks = {};
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plant Menu API
    // ------------------------------------------------------------
    export {
        Na__VegPlantMenu__Start,
        Na__VegPlantMenu__Stop,
        Na__VegPlantMenu__Paint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
