// =============================================================================
// TRUEVISION3D - VEGETATION - RUNTIME
// =============================================================================
//
// FILE       : Na__Vegetation__Runtime__.js
// NAMESPACE  : Na__VegRun
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Join the scene layer to the app: give it what it needs from the render
//              loop, the line weights and the section cuts, and keep its plants the
//              same as the project's object
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - THE ONLY VEGETATION MODULE THAT IMPORTS THE APP'S RENDERING. The scene layer takes
//   these as a small host object, so the test bench can draw through it with none of
//   them. Everything here is already on the start-up path, so loading this adds only
//   the vegetation modules themselves, and only on an enabled project.
// - THE GROUP SITS IN THE SCENE, NOT UNDER Na__ModelGroup__Root. Walk collision, layer
//   toggles, bounds and the phase library never see a plant.
// - A SAVED PLANT THAT CANNOT BE DRAWN IS LEFT OUT AND SAID SO. Its record is untouched,
//   and everything else still draws.
// - BUILT A SLICE AT A TIME. A plant takes about 2.3 ms to build from its rules and seed,
//   so a thousand would stop the page for over two seconds. The page keeps going, and
//   the plants arrive over a few frames.
// - THE PICTURE IS BROUGHT INTO LINE, NOT REBUILT. What should be drawn is worked out
//   afresh from the object (its plops, and each path's plants from its rules and seed),
//   and compared by what each would draw with what is in the scene. Only the difference
//   is built or taken out, so every edit, from a dragged grip to an undo, goes this one
//   way, and a long path stays smooth.
//
// INTEGRATION:
// - Started by Na__Vegetation__.js when a project is enabled, or switched on.
// - Called by the panels in ../10__Ui__Panels and the tools in ../20__System__Tools.
// - @delegate: ./Na__Vegetation__SceneLayer__.js
// - @delegate: ../01__Core__Engine/Na__Vegetation__PathModel__.js
// - @delegate: ../02__Core__Data/Na__Vegetation__SceneData__.js
// - @delegate: ../02__Core__Data/Na__Vegetation__Library__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/03__System__SceneLayer/Na__Vegetation__Runtime__.js 1.4.0 (v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : adapted
// - Divergences   : Also refreshes TrueVision's drawing profile cache
//                   (Na__DrawProfile__InvalidateSceneCache, 40__System__DrawingViewCore) when the
//                   layer's root arrives: TrueVision draws a live plan or elevation without a
//                   composer, through a pass that caches the scene's fat lines, which ValeVision
//                   does not have. isAoRunning answers false for an orthographic camera:
//                   every one in TrueVision is a drawing's, drawn flat with the AO pass still
//                   flagged on, where the fill's alpha-0 mark would leave it transparent.
//                   Linework Settings is TrueVision's stand-in (no user line weight, no export
//                   scale). On TrueVision's Existing and Proposed line the plants stand down
//                   while the existing building is drawn: for now they are the proposal's.
//                   Header and console prefix.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - TrueVision3D v2.186.2
// - Plants only on the proposed side of the Existing and Proposed line (Adam: "For now, we
//   will just do proposed"), through Na__PhaseCompare__AddSideHook.
//
// 15-Nov-2026 - TrueVision3D v2.185.0
// - Ported from ValeVision 3D (PORT NOTE).
//
// 13-Nov-2026 - ValeVision3D v2.98.5
// - Line resolution starts at the 3D view's own size, which now stops under the top
//   bar, not at the window's bottom edge.
//
// 05-Nov-2026 - Version 1.4.0 (ValeVision3D v2.89.0)
// - A path's plant swapped by hand counts among the assets named, and PathPlants hands the model the recipes to swap with.
//
// 05-Nov-2026 - Version 1.3.0 (ValeVision3D v2.88.0)
// - The layer's render hook shares scene.onBeforeRender with the figures, through Na__SceneHooks.
//
// 04-Nov-2026 - Version 1.2.0 (ValeVision3D v2.86.0)
// - The walls' colour goes to the layer, with its share from the line rules, for a fill
//   that has their brightness. A palette item's plant scale goes to the models.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.85.0)
// - Paths draw from their rules and seed. Everything goes through one comparison, so only
//   what changed is built. Show, transparency, Rendered / Proxy / Both, the line rules
//   applied live, and an asset's plants brought up to date when its copy changes.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.84.0)
// - Initial build: Stage 2 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import { Na__ViewportSize__Get } from '../../01__AppCore/Na__AppCore__ViewportSize__.js';
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The App's Rendering
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__SceneHooks__Add } from '../../05__RenderPipeline/Na__RenderLoop__SceneRenderHooks__.js';
    import {
        Na__InteractiveOverlays__Register,
        Na__InteractiveOverlays__SetWanted,
        Na__InteractiveOverlays__GetLiveFrameNumber
    } from '../../05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__.js';
    import {
        Na__LineworkSettings__GetLineworkExportScale,
        Na__LineworkSettings__GetLineworkFactor,
        Na__LineworkSettings__SetLineworkFactor
    } from '../../05__RenderPipeline/Na__RenderEffect__LineworkSettings__State.js';
    import { Na__SectionClipping__GetClipList } from '../../05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js';
    import { Na__DrawProfile__InvalidateSceneCache } from '../../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js';   // <-- TrueVision: its live drawings' own profile pass caches the scene's fat lines
    // ------------------------------------------------------------

    // MODULE IMPORTS | Vegetation
    // ------------------------------------------------------------
    import { Na__VegLayer__Create } from './Na__Vegetation__SceneLayer__.js';
    import { Na__VegPath__PlantsFor } from '../01__Core__Engine/Na__Vegetation__PathModel__.js';
    import {
        Na__VegData__LoadConfig,
        Na__VegData__PlopToBuild,
        Na__VegData__PlopSizeMm,
        Na__VegData__FindPalette,
        Na__VegData__LineRulesToStyle,
        Na__VegData__LineRulesToFactors
    } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import { Na__VegLib__ResolveRecipe, Na__VegLib__PinAsset } from '../02__Core__Data/Na__Vegetation__Library__.js';
    import {
        Na__Vegetation__SetContentStamp,
        Na__Vegetation__AreDrawingsHeld,
        Na__Vegetation__SetDrawingLayer
    } from '../Na__Vegetation__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Long Building May Hold the Page at a Time
    // ------------------------------------------------------------
    const Na__VegRun__BUILD_SLICE_MS = 12;
    const Na__VegRun__UNKNOWN_SIZE_MM = [1200, 1000, 1000];                    // <-- A plant whose asset cannot be read still shows somewhere to select
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Running on This Page
    // ------------------------------------------------------------
    const Na__VegRun__State = {
        context      : null,
        layer        : null,
        sceneData    : null,
        recipes      : new Map(),
        syncRun      : 0,                                                      // <-- A newer sync stops an older one still building
        shown        : true,
        mode         : 'rendered',
        transparency : 0,
        sideHeld     : null                                                    // <-- TrueVision: the root as the line's existing side found it, or null
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Recipes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Make Sure These Assets Have Their Recipes Read
    // ------------------------------------------------------------
    // A project's own copy first, else the library. One that neither holds is said
    // once, and its plants are left out by the layer, which finds no recipe for them.
    // ------------------------------------------------------------
    async function Na__VegRun__ReadRecipes(ids) {
        for (const id of ids) {
            if (Na__VegRun__State.recipes.has(id)) continue;
            try {
                Na__VegRun__State.recipes.set(id, await Na__VegLib__ResolveRecipe(Na__VegRun__State.sceneData, id));
            } catch (error) {
                Na__VegRun__State.recipes.set(id, null);
                console.warn('[TrueVision3D Vegetation] ' + id + ' cannot be drawn, so its plants are left out:', error && error.message);
            }
        }
        if (Na__VegRun__State.layer) {
            Na__VegRun__State.layer.setRecipes(Array.from(Na__VegRun__State.recipes.values()).filter(Boolean));
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Asset the Object Names
    // ------------------------------------------------------------
    function Na__VegRun__NamedAssets() {
        const sceneData = Na__VegRun__State.sceneData;
        const ids = new Set();
        sceneData.Vegetation__SceneData__Plops.forEach((plop) => { ids.add(plop.Vegetation__Plop__AssetId); });
        sceneData.Vegetation__SceneData__Palettes.forEach((palette) => {
            (palette.Vegetation__Palette__Items || []).forEach((item) => { ids.add(item.Vegetation__PaletteItem__AssetId); });
        });
        sceneData.Vegetation__SceneData__Paths.forEach((path) => {
            Object.values(path.Vegetation__Path__PlantChanges || {}).forEach((change) => {
                if (change.Vegetation__PlantChange__AssetId) ids.add(change.Vegetation__PlantChange__AssetId);
            });
        });
        return ids;
    }
    // ------------------------------------------------------------


    // FUNCTION | An Asset's Recipe, Once Read, or Null
    // ------------------------------------------------------------
    function Na__VegRun__RecipeFor(assetId) {
        return Na__VegRun__State.recipes.get(assetId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Plant Really Measures, in Mm, Its Recipe Read or Not
    // ------------------------------------------------------------
    function Na__VegRun__SizeOf(plop) {
        const recipe = Na__VegRun__RecipeFor(plop.Vegetation__Plop__AssetId);
        const own = recipe ? [recipe.Asset__Size.Size__WidthMm, recipe.Asset__Size.Size__DepthMm, recipe.Asset__Size.Size__HeightMm] : Na__VegRun__UNKNOWN_SIZE_MM;
        return Na__VegData__PlopSizeMm(plop, own);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Plant's Proxy with a Tool's Pen
    // ------------------------------------------------------------
    // At the size it really is, and the shape its asset asks for.
    // ------------------------------------------------------------
    function Na__VegRun__PaintProxy(pen, plop, colour) {
        const recipe = Na__VegRun__RecipeFor(plop.Vegetation__Plop__AssetId);
        const shape  = recipe && recipe.Asset__Proxy ? recipe.Asset__Proxy.Proxy__Shape : 'Dome';
        pen.dome(plop.Vegetation__Plop__PositionMm, Na__VegRun__SizeOf(plop), plop.Vegetation__Plop__YawDeg, colour, shape);
    }
    // ------------------------------------------------------------


    // FUNCTION | Read an Asset's Recipe If It Has Not Been, and Hand It Over
    // ------------------------------------------------------------
    async function Na__VegRun__EnsureRecipe(assetId) {
        await Na__VegRun__ReadRecipes([assetId]);
        return Na__VegRun__RecipeFor(assetId);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Palette's Items, with Their Recipes, as the Models Want Them
    // ------------------------------------------------------------
    function Na__VegRun__PaletteItems(paletteUid) {
        const palette = Na__VegData__FindPalette(Na__VegRun__State.sceneData, paletteUid);
        if (!palette) return [];
        return (palette.Vegetation__Palette__Items || []).map((item) => ({
            assetId : item.Vegetation__PaletteItem__AssetId,
            weight  : item.Vegetation__PaletteItem__Weight,
            scale   : item.Vegetation__PaletteItem__PlantScale,
            recipe  : Na__VegRun__RecipeFor(item.Vegetation__PaletteItem__AssetId)
        }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Copy of Every Asset the Object Now Uses
    // ------------------------------------------------------------
    // Called by whatever has just planted something (plan, D14). An asset only on a
    // palette no plant has drawn from is copied too: a path can draw from it at any time.
    // ------------------------------------------------------------
    async function Na__VegRun__PinInUse() {
        const sceneData = Na__VegRun__State.sceneData;
        for (const id of Na__VegRun__NamedAssets()) {
            await Na__VegLib__PinAsset(sceneData, id);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping the Plants the Same as the Project's Object
// -----------------------------------------------------------------------------

    // FUNCTION | One Path's Plants, Worked Out from Its Rules and Seed
    // ------------------------------------------------------------
    function Na__VegRun__PathPlants(path) {
        return Na__VegPath__PlantsFor(path, Na__VegRun__PaletteItems(path.Vegetation__Path__PaletteUid), Na__VegRun__RecipeFor);
    }
    // ------------------------------------------------------------


    // FUNCTION | Everything That Should Be Drawn, in the Shape of Saved Plops
    // ------------------------------------------------------------
    // Recipes must have been read: a path's plants cannot be worked out without them.
    // ------------------------------------------------------------
    function Na__VegRun__WantedPlants() {
        const sceneData = Na__VegRun__State.sceneData;
        const wanted = sceneData.Vegetation__SceneData__Plops.slice();
        sceneData.Vegetation__SceneData__Paths.forEach((path) => {
            wanted.push(...Na__VegRun__PathPlants(path));
        });
        return wanted;
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Picture into Line with the Project's Object
    // ------------------------------------------------------------
    async function Na__VegRun__SyncPlants() {
        const layer = Na__VegRun__State.layer;
        if (!layer) return;
        const run = ++Na__VegRun__State.syncRun;
        await Na__VegRun__ReadRecipes(Na__VegRun__NamedAssets());
        if (run !== Na__VegRun__State.syncRun) return;

        // THE DIFFERENCE | A plant already drawing what is wanted stays, and is told its
        // current name: a path's plants renumber when an earlier one goes.
        const missing = new Map();
        Na__VegRun__WantedPlants().forEach((plop) => {
            const build = Na__VegData__PlopToBuild(plop);
            missing.set(build.key, build);
        });
        const stale = [];
        layer.plops().forEach((existing) => {
            const wanted = missing.get(existing.key);
            if (wanted) {
                existing.uid       = wanted.uid;
                existing.pathUid   = wanted.pathUid;
                existing.strokeUid = wanted.strokeUid;
                missing.delete(existing.key);
            } else {
                stale.push(existing);
            }
        });
        if (stale.length > 0) layer.removePlops(stale);

        let sliceStartedAt = performance.now();
        for (const build of missing.values()) {
            layer.addPlops([build]);
            if (performance.now() - sliceStartedAt >= Na__VegRun__BUILD_SLICE_MS) {
                Na__RenderLoop__RequestRender();
                await new Promise((resolve) => { setTimeout(resolve, 0); });
                if (run !== Na__VegRun__State.syncRun) return;
                sliceStartedAt = performance.now();
            }
        }
        Na__VegRun__NoteContent();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say What the Plants on the Page Add Up To
    // ------------------------------------------------------------
    // Kept by the door for a sheet to read. Nothing drawn is an empty stamp.
    // ------------------------------------------------------------
    function Na__VegRun__NoteContent() {
        const state = Na__VegRun__State;
        const layer = state.layer;
        const keys  = layer && state.shown ? layer.plops().map((plop) => plop.key).sort() : [];
        if (keys.length === 0) {
            Na__Vegetation__SetContentStamp('');
            return;
        }
        const text = keys.join(';') + JSON.stringify(state.sceneData.Vegetation__SceneData__LineRules) + state.transparency;
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
        Na__Vegetation__SetContentStamp(keys.length + '-' + (hash >>> 0).toString(16));
    }
    // ------------------------------------------------------------


    // FUNCTION | An Asset's Copy Has Changed: Draw Its Plants Again
    // ------------------------------------------------------------
    // The comparison above reads what a plant was asked to draw, not what from.
    // ------------------------------------------------------------
    async function Na__VegRun__RefreshAsset(assetId) {
        const layer = Na__VegRun__State.layer;
        if (!layer) return;
        Na__VegRun__State.recipes.delete(assetId);
        layer.removePlops(layer.plops().filter((plop) => plop.assetId === assetId));
        await Na__VegRun__SyncPlants();
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply the Object's Line Rules to What Is Drawn
    // ------------------------------------------------------------
    // Called as a Linework slider moves. The two that change the plants themselves rebuild
    // every plant, so the panel asks for those when the slider is let go.
    // ------------------------------------------------------------
    function Na__VegRun__ApplyLineRules() {
        const layer = Na__VegRun__State.layer;
        if (!layer) return;
        const rules    = Na__VegRun__State.sceneData.Vegetation__SceneData__LineRules;
        const advanced = rules.Vegetation__LineRules__Advanced;
        const weight   = rules.Vegetation__LineRules__LineWeightPx;

        Object.assign(layer.style, Na__VegData__LineRulesToStyle(rules));
        layer.setLineWeights(weight, weight * rules.Vegetation__LineRules__InnerWeightShare);
        layer.setDepthBias(advanced.Vegetation__LineRulesAdvanced__DepthBias);
        layer.setFillTone(advanced.Vegetation__LineRulesAdvanced__FillTone);
        layer.setFillWallShare(advanced.Vegetation__LineRulesAdvanced__FillWallShare);
        Na__LineworkSettings__SetLineworkFactor(Na__LineworkSettings__GetLineworkFactor());   // <-- The user's own line weight, on top of the new base

        const factors = Na__VegData__LineRulesToFactors(rules);
        const rebuilt = factors.scallop !== layer.factors.scallop || factors.nubs !== layer.factors.nubs;
        Object.assign(layer.factors, factors);
        if (rebuilt) layer.rebuildAll(); else layer.markDirty();
        Na__VegRun__NoteContent();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | TrueVision: the Existing and Proposed Line
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Stand Down While the Line Draws the Existing Building
    // ------------------------------------------------------------
    // Adam, 15-Nov-2026: "For now, we will just do proposed". Plants stand in the scene, not
    // in a design phase, so the line would draw them over both buildings. It says which side
    // it is about to draw ('before', the existing building; 'after', the proposal), then null
    // when the frame is done, all inside one frame: the root goes off for the existing side
    // and back to exactly what it was. Show, the content stamp and the saved object are not
    // touched, and nothing is rebuilt. Later each plant may be marked existing or proposed
    // (the README's In TrueVision section).
    // ------------------------------------------------------------
    function Na__VegRun__OnCompareSide(side) {
        const layer = Na__VegRun__State.layer;
        if (!layer || !layer.root) return;
        if (side === 'before') {
            if (Na__VegRun__State.sideHeld === null) Na__VegRun__State.sideHeld = layer.root.visible;
            layer.root.visible = false;
        } else if (Na__VegRun__State.sideHeld !== null) {
            layer.root.visible = Na__VegRun__State.sideHeld;                  // <-- The proposal, or the frame done: as it was
            Na__VegRun__State.sideHeld = null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Join the Line, Once
    // ------------------------------------------------------------
    // Asked for, not imported: the line is TrueVision v2.186.0's, loaded with the model, and an
    // app without it has no line to stand down for.
    // ------------------------------------------------------------
    function Na__VegRun__JoinCompare() {
        import('../../26__System__ToggleModelElements/Na__UiFeature__PhaseCompare__.js')
            .then((compare) => {
                if (typeof compare.Na__PhaseCompare__AddSideHook === 'function') compare.Na__PhaseCompare__AddSideHook(Na__VegRun__OnCompareSide);
            })
            .catch(() => {});
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Starting and Stopping
// -----------------------------------------------------------------------------

    // FUNCTION | Put the Project's Plants in the Scene
    // ------------------------------------------------------------
    // context : { scene, camera, renderer, modelRoot, lineColour, wallColour, getPipeline, showToast }
    // starting: { shown, transparencyPercent }, what this device starts from
    // ------------------------------------------------------------
    async function Na__VegRun__Start(context, sceneData, starting) {
        Na__VegRun__State.context   = context;
        Na__VegRun__State.sceneData = sceneData;

        if (!Na__VegRun__State.layer) {
            const config = await Na__VegData__LoadConfig();
            const viewSize = Na__ViewportSize__Get();                        // <-- The 3D view's box (under the top bar), not the window
            Na__VegRun__State.layer = Na__VegLayer__Create({
                scene             : context.scene,
                recipes           : [],
                lineRules         : sceneData.Vegetation__SceneData__LineRules,
                lineColour        : context.lineColour,
                wallColour        : context.wallColour,
                resolution        : new THREE.Vector2(viewSize.width, viewSize.height),
                frameBudget       : config.Vegetation__FrameBudget__Config,
                seeThroughPercent : config.Vegetation__Transparency__Config.Vegetation__Transparency__SeeThroughFromPercent,
                host              : {
                    addRenderHook    : (hook) => Na__SceneHooks__Add(context.scene, hook),
                    getLiveFrame     : Na__InteractiveOverlays__GetLiveFrameNumber,
                    getExportScale   : Na__LineworkSettings__GetLineworkExportScale,
                    getClipList      : Na__SectionClipping__GetClipList,
                    requestFrame     : Na__RenderLoop__RequestRender,
                    isAoRunning      : (camera) => {
                        if (camera && camera.isOrthographicCamera) return false;   // <-- TrueVision: a drawing's camera, drawn flat outside the composer: no AO will clear the mark
                        const pipeline = context.getPipeline ? context.getPipeline() : null;
                        return !!(pipeline && pipeline.aoPassRef && pipeline.aoPassRef.enabled);
                    },
                    registerOverlay  : Na__InteractiveOverlays__Register,
                    setOverlayWanted : Na__InteractiveOverlays__SetWanted,
                    liveDrawingsWantPlants : () => !Na__Vegetation__AreDrawingsHeld() && Na__VegRun__State.sceneData.Vegetation__SceneData__ShowOnLiveDrawings === true
                }
            });
            Na__VegRun__State.layer.installRenderHook();
            Na__Vegetation__SetDrawingLayer((camera) => Na__VegRun__State.layer.renderDrawingLayer(context.renderer, camera));

            // TWO THINGS THAT ALREADY RAN WITHOUT US | The user's line weight, which the
            // lines have just missed, and the profile pass's list of the scene's objects.
            Na__LineworkSettings__SetLineworkFactor(Na__LineworkSettings__GetLineworkFactor());
            const pipeline = context.getPipeline ? context.getPipeline() : null;
            if (pipeline && pipeline.invalidateProfileLinesCache) pipeline.invalidateProfileLinesCache();
            Na__DrawProfile__InvalidateSceneCache();                           // <-- TrueVision: and its live drawings' pass, or their fat lines draw as solid quads in its normals
            Na__VegRun__JoinCompare();                                         // <-- TrueVision: off while the line draws the existing building
        }

        const shown        = starting ? starting.shown !== false : sceneData.Vegetation__SceneData__ShowByDefault !== false;
        const transparency = starting ? starting.transparencyPercent : sceneData.Vegetation__SceneData__DefaultTransparencyPercent;
        Na__VegRun__SetShown(shown);
        Na__VegRun__SetTransparency(transparency);
        await Na__VegRun__SyncPlants();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Plants Off the Screen
    // ------------------------------------------------------------
    function Na__VegRun__Stop() {
        if (Na__VegRun__State.layer) Na__VegRun__State.layer.setVisible(false);
        Na__Vegetation__SetContentStamp('');
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // FUNCTION | Show or Hide the Plants, for This Device
    // ------------------------------------------------------------
    function Na__VegRun__SetShown(shown) {
        Na__VegRun__State.shown = (shown === true);
        if (Na__VegRun__State.layer) Na__VegRun__State.layer.setVisible(Na__VegRun__State.shown);
        Na__VegRun__NoteContent();
        Na__RenderLoop__RequestRender();
    }
    function Na__VegRun__IsShown() {
        return Na__VegRun__State.shown;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fade the Plants, for This Device
    // ------------------------------------------------------------
    function Na__VegRun__SetTransparency(percent) {
        Na__VegRun__State.transparency = Number(percent) || 0;
        if (Na__VegRun__State.layer) Na__VegRun__State.layer.setTransparency(Na__VegRun__State.transparency);
        Na__VegRun__NoteContent();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // FUNCTION | Rendered, Proxy or Both in the Model
    // ------------------------------------------------------------
    function Na__VegRun__SetMode(mode) {
        Na__VegRun__State.mode = mode;
        if (Na__VegRun__State.layer) Na__VegRun__State.layer.setMode(mode);
        Na__RenderLoop__RequestRender();
    }
    function Na__VegRun__GetMode() {
        return Na__VegRun__State.mode;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Layer Is Doing, for the Panel and for Checks
    // ------------------------------------------------------------
    function Na__VegRun__GetStats() {
        return Na__VegRun__State.layer ? Na__VegRun__State.layer.stats : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layer Itself, for a Panel and for Checks
    // ------------------------------------------------------------
    function Na__VegRun__GetLayer() {
        return Na__VegRun__State.layer;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Door Was Given, for a Panel and for Checks
    // ------------------------------------------------------------
    function Na__VegRun__GetContext() {
        return Na__VegRun__State.context;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Object the Picture Is Drawn From
    // ------------------------------------------------------------
    function Na__VegRun__GetSceneData() {
        return Na__VegRun__State.sceneData;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Runtime API
    // ------------------------------------------------------------
    export {
        Na__VegRun__Start,
        Na__VegRun__Stop,
        Na__VegRun__SyncPlants,
        Na__VegRun__RefreshAsset,
        Na__VegRun__ApplyLineRules,
        Na__VegRun__RecipeFor,
        Na__VegRun__EnsureRecipe,
        Na__VegRun__SizeOf,
        Na__VegRun__PaintProxy,
        Na__VegRun__PaletteItems,
        Na__VegRun__PinInUse,
        Na__VegRun__PathPlants,
        Na__VegRun__WantedPlants,
        Na__VegRun__SetShown,
        Na__VegRun__IsShown,
        Na__VegRun__SetTransparency,
        Na__VegRun__SetMode,
        Na__VegRun__GetMode,
        Na__VegRun__GetStats,
        Na__VegRun__GetLayer,
        Na__VegRun__GetContext,
        Na__VegRun__GetSceneData
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
