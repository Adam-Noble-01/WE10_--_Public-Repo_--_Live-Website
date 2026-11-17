// =============================================================================
// TRUEVISION3D - VEGETATION - THE ASSET BROWSER
// =============================================================================
//
// FILE       : Na__Vegetation__AssetBrowser__.js
// NAMESPACE  : Na__VegCards
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Vegetation Assets: the library as cards to place from, everything this
//              project holds, to select, focus, move, turn or take out, and who changed what
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "Vegetation Assets (Opens a new asset browser panel) - For Dev Only",
//   after the Assets drawer in PainterlyNPR. Search, categories by collection then type,
//   filter chips behind a funnel, and a Rendered | Proxy picture on each card.
// - CARDS ARE DRAWN LIVE BY THE SAME CODE AS THE SCENE, on a 2D canvas, so there are no
//   picture files to go stale (plan, D13), and a card shows the project's own line rules.
// - CLICK A CARD, THEN CLICK THE MODEL (NPR's gesture). Escape, or the card again, stops.
//   The + on a card adds it to the palette last worked on instead.
// - IN THIS PROJECT. Every path, stroke and single plant. A click on a plant in the model selects
//   it here. Its saved record is no longer shown (Adam, 11-Nov-2026: "remove the section showing
//   the code thats no longer needed"), and what is selected is headed by its name.
// - A PLANT'S OWN COPY OF ITS ASSET (plan, D14). Improving the library changes nothing here
//   until Update to Latest is pressed for that asset.
// - SIZING WHAT IS PLANTED (Adam, 04-Nov-2026: "Add some controls to be able to size and scale
//   the assets"). The Assets tab has a Plant scale for the next plant dropped, with its proxy
//   shown under the pointer. A selected plant has a scale, and a width, depth and height
//   showing what it really measures; a stroke and a path have a scale for all their plants.
// - DRAW PATH ON A CARD. A hedge is drawn alone, so a card goes straight to the Linear Tool
//   with a palette of just that plant.
//
// - WHO DID WHAT (Adam, 05-Nov-2026: "who inserted what etc"). In This Project says it on each row,
//   and whether it is waiting for an admin, with a tick for only your own. The Changes tab is
//   ../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js.
// - RIGHT-CLICK A PLANT: ../20__System__Tools/Na__Vegetation__PlantMenu__.js, while this is open.
//
// - ONE PANEL FOR ALL OF IT, AS DROPDOWN SECTIONS (Adam, 06-Nov-2026: "make the new menu on the left
//   feel more like the sestablished style of the right each with dropdown sections and graphics etc",
//   "we currently have multiple places for creating things"). The panel is called Vegetation, and
//   holds Line Tool, Brush Tool, Assets, In This Project and Change Log, in that order (Adam,
//   11-Nov-2026), one open at a time (../../22__System__SceneAssets/Na__SceneAssets__Hub__.js). The
//   two tools draw into their section, and are armed on the model only while it is open.
// - IT OPENS WHEN VEGETATION IS UNFOLDED IN TOOLS & SETTINGS, AND GOES WHEN IT IS FOLDED (Adam:
//   "people would expect those sections are the entry point for their respective asset browsers").
//   It opens with every section folded (Adam, 11-Nov-2026: "When the menu first opens close the
//   vegtation assets as it makes it hard to navigate the menu"); a card's Draw Path, a path's Edit and
//   a plant picked on the model still open their own section. Closing it here folds the menu's too.
//
// INTEGRATION:
// - Opened and closed by Tools & Settings > Vegetation (Na__Vegetation__MenuSection__.js).
// - @delegate: ../../22__System__SceneAssets/Na__SceneAssets__Hub__.js
// - @delegate: ../20__System__Tools/Na__Vegetation__ToolHost__.js
// - @delegate: ../20__System__Tools/Na__Vegetation__LinearTool__.js
// - @delegate: ../20__System__Tools/Na__Vegetation__BushTool__.js
// - @delegate: ./Na__Vegetation__PaletteEditor__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/10__Ui__Panels/Na__Vegetation__AssetBrowser__.js 1.4.0 (v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : diverged (one section fewer)
// - Divergences   : No Change Log section: TrueVision keeps no list of who did what (one
//                   author, every save straight in), so it would only ever say that list
//                   could not be read. Its drawing code stays, unused, so a later port
//                   from ValeVision still lines up. Header and console prefix.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Nov-2026 - Version 1.5.0-tv.1 (TrueVision3D v2.189.0, with ValeVision3D v2.99.0's 1.5.0)
// - A card for a plant whose blades grow from inside it (bush.bladesUnder: stems, a grass) paints
//   every blade first, the furthest first, each its fill then its lines, then the balls' fill
//   and lines over them. Every other card is drawn as before.
//
// 15-Nov-2026 - Version 1.4.0-tv.1 (TrueVision3D v2.185.0)
// - Ported from ValeVision 3D without the Change Log section (PORT NOTE).
//
// 11-Nov-2026 - Version 1.4.0 (ValeVision3D v2.94.2)
// - Opens with every section folded. Sections in Adam's order: Line Tool, Brush Tool, Assets, In This
//   Project, Change Log (was Changes; its key is still 'changes'). In This Project no longer shows
//   the selected item's saved record: it is headed by its name instead of What It Saves.
//
// 06-Nov-2026 - Version 1.3.0 (ValeVision3D v2.91.0)
// - The panel is Vegetation, as dropdown sections: Assets, Line Tool, Brush Tool, In This Project and
//   Changes. Open, Close, FoldSection and CurrentSection for the menu section and the tools.
//
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.89.0)
// - The tabs have their icons, and there is a Changes tab. Rows say who did it. Open on a named tab.
//   Right-click a plant. Update to Latest is an admin's, as it changes every viewer's picture.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - Plant scale and sizes, a proxy under the pointer while a card is armed, Draw Path, and a box
//   for a hedge on a card.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 4 of ValeVision__PLAN__VegetationSystem__.md. The cards are the
//   prototype's, moved in.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Engine, Data and Runtime
    // ------------------------------------------------------------
    import { Na__VegBuild__BuildPlant } from '../01__Core__Engine/Na__Vegetation__BushBuilder__.js';
    import { Na__VegContour__CreateOut, Na__VegContour__ResetOut, Na__VegContour__DrawBush } from '../01__Core__Engine/Na__Vegetation__Contour__.js';
    import {
        Na__VegData__NextUid,
        Na__VegData__FindPath,
        Na__VegData__WORK_EVENT,
        Na__VegData__SYSTEM,
        Na__VegData__Work,
        Na__VegData__TakeAnswer,
        Na__VegData__IsDirty
    } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import {
        Na__SceneChanges__AddStyles,
        Na__SceneChanges__Icon,
        Na__SceneChanges__CountWaiting,
        Na__SceneChanges__WhoDid,
        Na__SceneChanges__WhoLine,
        Na__SceneChanges__Draw
    } from '../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js';
    import { Na__SceneHub__Create } from '../../22__System__SceneAssets/Na__SceneAssets__Hub__.js';
    import { Na__VegPath__SetPlantScale } from '../01__Core__Engine/Na__Vegetation__PathModel__.js';
    import { Na__VegLib__LoadCatalogue, Na__VegLib__LoadAsset, Na__VegLib__PinAsset } from '../02__Core__Data/Na__Vegetation__Library__.js';
    import {
        Na__VegRun__GetSceneData,
        Na__VegRun__GetLayer,
        Na__VegRun__GetContext,
        Na__VegRun__SyncPlants,
        Na__VegRun__PathPlants,
        Na__VegRun__EnsureRecipe,
        Na__VegRun__RecipeFor,
        Na__VegRun__SizeOf,
        Na__VegRun__PaintProxy,
        Na__VegRun__RefreshAsset,
        Na__VegRun__PinInUse,
        Na__VegRun__SetMode,
        Na__VegRun__GetMode
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    import { Na__RenderLoop__RequestRender } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Shell, Tools and Palettes
    // ------------------------------------------------------------
    import {
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__Choice,
        Na__VegShell__Slider,
        Na__VegShell__PlantScaleSlider,
        Na__VegShell__Open,
        Na__VegShell__Close,
        Na__VegShell__IsOpen,
        Na__VegShell__MarkChanged,
        Na__VegShell__BeforeChange,
        Na__VegShell__Toast,
        Na__VegShell__Config,
        Na__VegShell__Prepare,
        Na__VegShell__Save,
        Na__VegShell__AfterReplaced
    } from './Na__Vegetation__PanelShell__.js';
    import { Na__VegPalUi__AddAsset, Na__VegPalUi__OnlyThis, Na__VegPalUi__SetPictureDrawer } from './Na__Vegetation__PaletteEditor__.js';
    import {
        Na__VegTools__Prepare,
        Na__VegTools__Arm,
        Na__VegTools__Current,
        Na__VegTools__Repaint,
        Na__VegTools__SetFallback
    } from '../20__System__Tools/Na__Vegetation__ToolHost__.js';
    import { Na__VegPick__AtPointer, Na__VegPick__RayAt } from '../20__System__Tools/Na__Vegetation__SurfacePick__.js';
    import { Na__VegPlantMenu__Start, Na__VegPlantMenu__Stop, Na__VegPlantMenu__Paint } from '../20__System__Tools/Na__Vegetation__PlantMenu__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Panel and Its Cards
    // ------------------------------------------------------------
    const Na__VegCards__PANEL_ID      = 'naVegetationAssetsPanel';
    const Na__VegCards__CARD_W        = 262;
    const Na__VegCards__CARD_H        = 118;
    const Na__VegCards__SEED_RANGE    = 1000000000;
    const Na__VegCards__TEST_ROW      = 'TESTROW';                             // <-- The stand-in row of v2.84.0, should a project still hold one
    const Na__VegCards__FOCUS_MIN_M   = 5;
    const Na__VegCards__FOCUS_FACTOR  = 3.5;
    const Na__VegCards__HOVER_MS      = 40;
    const Na__VegCards__SIZE_MIN_MM   = 50;
    const Na__VegCards__SIZE_MAX_MM   = 30000;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Open Panel Holds
    // ------------------------------------------------------------
    const Na__VegCards__State = {
        context   : null,
        tab       : '',                                                        // <-- The open section's key, '' with all folded
        hub       : null,                                                      // <-- The sections, while the panel is open
        opening   : null,                                                      // <-- The panel being built: a second ask waits for it
        search    : '',
        chips     : new Set(),
        chipsOpen : false,
        pictures  : 'rendered',
        catalogue : [],
        recipes   : new Map(),
        cardEls   : new Map(),
        cardOut   : null,
        armedId   : null,
        moving    : false,
        selected  : null,                                                      // <-- { kind : 'plop' | 'path' | 'stroke', uid }
        hoverAt   : 0,
        hoverHit  : null,                                                      // <-- World metres under the pointer while a card is armed
        hintEl    : null,
        listEl    : null,
        resume    : null,
        onlyMine  : false
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Cards' Pictures
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Card's Seed: the Same Picture Every Time
    // ------------------------------------------------------------
    function Na__VegCards__CardSeed(assetId) {
        return 500 + assetId.charCodeAt(assetId.length - 2) * 37 + assetId.charCodeAt(assetId.length - 3) * 11;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Draw One Card's Picture from the Same Code as the Scene
    // ------------------------------------------------------------
    // A flat front view on a 2D canvas: no second GL context for a card each. size: { w, h }, for a
    // smaller picture than a card's, as in the right-click menu.
    // ------------------------------------------------------------
    function Na__VegCards__DrawPicture(canvas, recipe, size) {
        const state = Na__VegCards__State;
        const layer = Na__VegRun__GetLayer();
        const dpr   = Math.min(window.devicePixelRatio || 1, 2);
        const w = size ? size.w : Na__VegCards__CARD_W, h = size ? size.h : Na__VegCards__CARD_H;
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        canvas.style.height = h + 'px';
        if (size) canvas.style.width = w + 'px';

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = 'round';

        const own    = recipe.Asset__Size;
        const widthM = own.Size__WidthMm / 1000, highM = own.Size__HeightMm / 1000;
        const px     = size
            ? Math.min((w - 10) / (widthM * 1.08), (h - 10) / (highM * 1.08))
            : Math.min((w - 34) / (widthM * 1.08), (h - 26) / (highM * 1.08));
        const ox     = w / 2, oy = size ? h - 5 : h - 14;

        if (state.pictures === 'proxy' && recipe.Asset__Proxy && recipe.Asset__Proxy.Proxy__Shape === 'Box') {
            // THE PROXY | A box, the same one the scene places
            const rx = (widthM / 2) * px, ry = highM * px;
            ctx.fillStyle   = '#e6ede1';
            ctx.strokeStyle = '#5f7a66';
            ctx.lineWidth   = 1;
            ctx.fillRect(ox - rx, oy - ry, rx * 2, ry);
            ctx.strokeRect(ox - rx, oy - ry, rx * 2, ry);
        } else if (state.pictures === 'proxy') {
            // THE PROXY | A faceted dome, the same one the scene places
            const rx = (widthM / 2) * px, ry = highM * px;
            ctx.fillStyle   = '#e6ede1';
            ctx.strokeStyle = '#5f7a66';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            for (let a = 0; a <= 32; a++) {
                const t = (Math.PI * a) / 32;
                const x = ox - Math.cos(t) * rx, y = oy - Math.sin(t) * ry;
                if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            for (let ring = 1; ring < 5; ring++) {
                const lat = (Math.PI * 0.5 * ring) / 5;
                const y = oy - Math.sin(lat) * ry, half = Math.cos(lat) * rx;
                ctx.beginPath();
                ctx.moveTo(ox - half, y);
                ctx.lineTo(ox + half, y);
                ctx.stroke();
            }
            [-0.62, -0.25, 0.25, 0.62].forEach((share) => {
                ctx.beginPath();
                for (let a = 0; a <= 16; a++) {
                    const t = (Math.PI * 0.5 * a) / 16;
                    const x = ox + Math.cos(t) * rx * share, y = oy - Math.sin(t) * ry;
                    if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            });
        } else {
            // RENDERED | Flat parallel, from this card's own seed. A card has no depth test,
            // so it paints in order: the bush's own lines already hide themselves, a blade
            // behind the bush is left out, and a blade in front covers what it crosses.
            const bush = Na__VegBuild__BuildPlant(recipe, {
                seed : Na__VegCards__CardSeed(recipe.Asset__Id), positionMm : [0, 0, 0], yawDeg : 0, sizeMm : null
            }, layer.factors);
            const allBlades   = bush.blades;
            const frontBlades = bush.blades.filter((blade) => blade.p[2] >= 0);
            bush.blades = [];
            bush.core   = null;                                                // <-- A card draws lines only, so a box's core would only cover them

            if (!state.cardOut) state.cardOut = Na__VegContour__CreateOut(60000, 30000, 60000);
            const out  = state.cardOut;
            const view = {
                eyeX : 0, eyeY : 0, eyeZ : 30, fwdX : 0, fwdY : 0, fwdZ : -1, upX : 0, upY : 1, upZ : 0, rightX : 1, rightY : 0, rightZ : 0,
                isOrtho : true, focalPx : px, halfWidthPx : 1e5, halfHeightPx : 1e5
            };
            const stroke = (buffer, count) => {
                ctx.beginPath();
                for (let k = 0; k < count; k++) {
                    const b = k * 6;
                    ctx.moveTo(ox + buffer[b] * px, oy - buffer[b + 1] * px);
                    ctx.lineTo(ox + buffer[b + 3] * px, oy - buffer[b + 4] * px);
                }
                ctx.stroke();
            };

            const fill = () => {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                for (let v = 0; v + 2 < out.fillCount; v += 3) {
                    ctx.moveTo(ox + out.fill[v * 3] * px, oy - out.fill[v * 3 + 1] * px);
                    ctx.lineTo(ox + out.fill[v * 3 + 3] * px, oy - out.fill[v * 3 + 4] * px);
                    ctx.lineTo(ox + out.fill[v * 3 + 6] * px, oy - out.fill[v * 3 + 7] * px);
                    ctx.closePath();
                }
                ctx.fill();
            };

            if (bush.bladesUnder) {
                // BLADES THAT GROW FROM INSIDE THE PLANT (v1.5.0) | Stems and a grass's blades:
                // every blade first, the furthest first, each its own fill then its lines; then the
                // balls' fill over their feet, then the balls' lines
                const blades = allBlades.slice().sort((p, q) => (p.p[2] + p.p[5] + p.p[8] + p.p[11]) - (q.p[2] + q.p[5] + q.p[8] + q.p[11]));
                const balls  = bush.count;
                bush.count = 0;
                ctx.strokeStyle = '#141414';
                blades.forEach((blade) => {
                    bush.blades = [blade];
                    Na__VegContour__ResetOut(out);
                    Na__VegContour__DrawBush(bush, view, layer.style, out);
                    fill();
                    ctx.lineWidth = 0.9;
                    stroke(out.outer, out.outerCount);
                    ctx.lineWidth = 0.75;
                    stroke(out.inner, out.innerCount);
                });
                bush.count  = balls;
                bush.blades = [];
                Na__VegContour__ResetOut(out);
                Na__VegContour__DrawBush(bush, view, layer.style, out);
                fill();
                ctx.lineWidth = 0.9;
                stroke(out.outer, out.outerCount);
                ctx.lineWidth = 0.75;
                stroke(out.inner, out.innerCount);
            } else {
                Na__VegContour__ResetOut(out);
                Na__VegContour__DrawBush(bush, view, layer.style, out);
                ctx.strokeStyle = '#141414';
                ctx.lineWidth = 0.9;
                stroke(out.outer, out.outerCount);
                ctx.lineWidth = 0.75;
                stroke(out.inner, out.innerCount);

                // THE FRONT BLADES | Their own fill first, then their lines
                bush.count  = 0;
                bush.blades = frontBlades;
                Na__VegContour__ResetOut(out);
                Na__VegContour__DrawBush(bush, view, layer.style, out);
                fill();
                ctx.lineWidth = 0.9;
                stroke(out.outer, out.outerCount);
                ctx.lineWidth = 0.75;
                stroke(out.inner, out.innerCount);
            }
        }

        ctx.strokeStyle = '#141414';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(size ? 3 : 10, oy);
        ctx.lineTo(w - (size ? 3 : 10), oy);
        ctx.stroke();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placing, Selecting and Moving: the Tool on the Model
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Say What a Click on the Model Will Do
    // ------------------------------------------------------------
    function Na__VegCards__WriteHint() {
        const state = Na__VegCards__State;
        if (!state.hintEl) return;
        if (state.armedId) state.hintEl.textContent = 'Click the model to drop one. Escape or the card again to stop.';
        else if (state.moving) state.hintEl.textContent = 'Click the model where this plant should go. Escape cancels.';
        else state.hintEl.textContent = 'Click a card, then click the model to drop one. Draw Path draws a path of only that plant, as a hedge is. + adds it to the palette the tools draw from.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor for What a Click Will Do
    // ------------------------------------------------------------
    function Na__VegCards__SetCursor() {
        const state = Na__VegCards__State;
        const canvas = state.context.renderer.domElement;
        canvas.style.cursor = (state.armedId || state.moving) ? 'crosshair' : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Placing or Moving, and Hand Back Whatever Was Armed Before
    // ------------------------------------------------------------
    function Na__VegCards__StopPlacing() {
        const state = Na__VegCards__State;
        state.armedId = null;
        state.moving  = false;
        state.hoverHit = null;
        state.cardEls.forEach((entry) => entry.card.classList.remove('na-veg-card--armed'));
        Na__VegCards__SetCursor();
        Na__VegCards__WriteHint();
        if (state.resume) {
            const tool = state.resume;
            state.resume = null;
            Na__VegTools__Arm(tool);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Clicks, Remembering a Tool That Had Them
    // ------------------------------------------------------------
    function Na__VegCards__TakeClicks() {
        const current = Na__VegTools__Current();
        if (current && current !== Na__VegCards__Tool) Na__VegCards__State.resume = current;
        if (current !== Na__VegCards__Tool) Na__VegTools__Arm(Na__VegCards__Tool);
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm a Card, or Disarm It If It Is Armed
    // ------------------------------------------------------------
    function Na__VegCards__ArmCard(assetId) {
        const state = Na__VegCards__State;
        if (state.armedId === assetId) {
            Na__VegCards__StopPlacing();
            return;
        }
        state.moving  = false;
        state.armedId = assetId;
        state.cardEls.forEach((entry, id) => entry.card.classList.toggle('na-veg-card--armed', id === assetId));
        Na__VegCards__TakeClicks();
        Na__VegCards__SetCursor();
        Na__VegCards__WriteHint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Plant Scale the Next Card Drops At
    // ------------------------------------------------------------
    function Na__VegCards__PlaceBlock() {
        return Na__VegRun__GetSceneData().Vegetation__SceneData__Tools.Vegetation__Tools__Place;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Plant's Scale. Exactly 1 Is the Same as None
    // ------------------------------------------------------------
    function Na__VegCards__WriteScale(plop, value) {
        if (value === 1) delete plop.Vegetation__Plop__Scale;
        else plop.Vegetation__Plop__Scale = value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop a Plant Where the Pointer Is
    // ------------------------------------------------------------
    async function Na__VegCards__PlaceAt(event) {
        const state = Na__VegCards__State;
        const assetId = state.armedId;
        const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (!hit) return;                                                      // <-- The sky: stay armed

        const maxSlope = Na__VegShell__Config().Vegetation__DevTools__Config.Vegetation__DevTools__MaxPlaceSlopeDeg;
        if (hit.normal.y < Math.cos((maxSlope * Math.PI) / 180)) {
            Na__VegShell__Toast('That spot does not face up. Try the top of a planter, or the ground.', true);
            return;
        }

        const recipe = await Na__VegRun__EnsureRecipe(assetId);
        if (!recipe) return;
        const sceneData = Na__VegRun__GetSceneData();
        const size  = recipe.Asset__Size;
        const place = recipe.Asset__Placement || {};
        const vary  = (place.Placement__ScaleVariationPercent || 0) / 100;
        const scale = 1 + (Math.random() * 2 - 1) * vary;
        const turn  = place.Placement__RotationVariationDeg || 0;

        Na__VegShell__BeforeChange('');
        const plop = {
            Vegetation__Plop__Uid        : Na__VegData__NextUid('A', sceneData.Vegetation__SceneData__Plops, 'Vegetation__Plop__Uid'),
            Vegetation__Plop__AssetId    : assetId,
            Vegetation__Plop__Seed       : Math.floor(Math.random() * Na__VegCards__SEED_RANGE),
            Vegetation__Plop__PositionMm : [hit.point.x, hit.point.y, hit.point.z].map((m) => Math.round(m * 1000)),
            Vegetation__Plop__YawDeg     : Math.round((Math.random() * 2 - 1) * turn),
            Vegetation__Plop__SizeMm     : [size.Size__WidthMm, size.Size__DepthMm, size.Size__HeightMm].map((mm) => Math.round(mm * scale))
        };
        Na__VegCards__WriteScale(plop, Na__VegCards__PlaceBlock().Vegetation__Place__PlantScale || 1);
        sceneData.Vegetation__SceneData__Plops.push(plop);
        Na__VegShell__MarkChanged();
        await Na__VegRun__PinInUse();
        await Na__VegRun__SyncPlants();
        state.selected = { kind : 'plop', uid : plop.Vegetation__Plop__Uid };
        Na__VegCards__DrawList();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move the Selected Plant to Where the Pointer Is
    // ------------------------------------------------------------
    async function Na__VegCards__MoveTo(event) {
        const plop = Na__VegCards__SelectedPlop();
        const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (!plop || !hit) return;
        Na__VegShell__BeforeChange('');
        plop.Vegetation__Plop__PositionMm = [hit.point.x, hit.point.y, hit.point.z].map((m) => Math.round(m * 1000));
        Na__VegShell__MarkChanged();
        Na__VegCards__StopPlacing();
        await Na__VegRun__SyncPlants();
        Na__VegCards__DrawList();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Select Whatever Plant Is Under the Pointer
    // ------------------------------------------------------------
    function Na__VegCards__SelectAt(event) {
        const state = Na__VegCards__State;
        const ray = Na__VegPick__RayAt(event.clientX, event.clientY);
        const layer = Na__VegRun__GetLayer();
        if (!ray || !layer) return;
        const hit = layer.pick(ray.origin, ray.direction);
        if (!hit) {
            state.selected = null;
        } else if (hit.pathUid) {
            state.selected = { kind : 'path', uid : hit.pathUid };
        } else if (hit.strokeUid) {
            state.selected = { kind : 'plop', uid : hit.uid };
        } else {
            state.selected = { kind : 'plop', uid : hit.uid };
        }
        if (state.selected && state.tab !== 'project') Na__VegCards__ShowTab('project');
        else Na__VegCards__DrawList();
    }
    // ------------------------------------------------------------


    // MODULE VARIABLES | The Tool Itself
    // ------------------------------------------------------------
    const Na__VegCards__Tool = {
        name : 'cards',
        onClick(event) {
            const state = Na__VegCards__State;
            if (state.armedId) Na__VegCards__PlaceAt(event);
            else if (state.moving) Na__VegCards__MoveTo(event);
            else Na__VegCards__SelectAt(event);
        },
        onHover(event) {
            const state = Na__VegCards__State;
            if (!state.armedId) return;
            const now = performance.now();
            if (now - state.hoverAt < Na__VegCards__HOVER_MS) return;
            state.hoverAt  = now;
            const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
            state.hoverHit = hit ? hit.point : null;
            Na__VegTools__Repaint();
        },
        onKey(event) {
            const state = Na__VegCards__State;
            if (event.key === 'Escape') {
                if (state.armedId || state.moving) {
                    Na__VegCards__StopPlacing();
                    return true;
                }
                if (state.selected) {
                    state.selected = null;
                    Na__VegCards__DrawList();
                    return true;
                }
                return false;
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && state.selected) {
                Na__VegCards__RemoveSelected();
                return true;
            }
            return false;
        },
        paint(pen) {
            const state = Na__VegCards__State;
            if (!Na__VegPlantMenu__Paint(pen)) Na__VegCards__PaintSelected(pen);
            if (state.armedId && state.hoverHit) {
                const recipe = state.recipes.get(state.armedId);
                const size   = recipe.Asset__Size;
                const preview = {
                    Vegetation__Plop__AssetId    : state.armedId,
                    Vegetation__Plop__PositionMm : [state.hoverHit.x, state.hoverHit.y, state.hoverHit.z].map((m) => m * 1000),
                    Vegetation__Plop__YawDeg     : 0,
                    Vegetation__Plop__SizeMm     : [size.Size__WidthMm, size.Size__DepthMm, size.Size__HeightMm],
                    Vegetation__Plop__Scale      : Na__VegCards__PlaceBlock().Vegetation__Place__PlantScale || 1
                };
                pen.dome(preview.Vegetation__Plop__PositionMm, Na__VegRun__SizeOf(preview), 0, null, recipe.Asset__Proxy ? recipe.Asset__Proxy.Proxy__Shape : 'Dome');
            }
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Is Selected
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Selected Saved Plop, or Null
    // ------------------------------------------------------------
    function Na__VegCards__SelectedPlop() {
        const selected = Na__VegCards__State.selected;
        if (!selected || selected.kind !== 'plop') return null;
        return Na__VegRun__GetSceneData().Vegetation__SceneData__Plops.find((plop) => plop.Vegetation__Plop__Uid === selected.uid) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Plants the Selection Covers, in the Shape of Saved Plops
    // ------------------------------------------------------------
    function Na__VegCards__SelectedPlants() {
        const selected = Na__VegCards__State.selected;
        if (!selected) return [];
        const sceneData = Na__VegRun__GetSceneData();
        if (selected.kind === 'plop') {
            const plop = Na__VegCards__SelectedPlop();
            return plop ? [plop] : [];
        }
        if (selected.kind === 'stroke') {
            return sceneData.Vegetation__SceneData__Plops.filter((plop) => plop.Vegetation__Plop__StrokeUid === selected.uid);
        }
        const path = Na__VegData__FindPath(sceneData, selected.uid);
        return path ? Na__VegRun__PathPlants(path) : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Selection on the Model
    // ------------------------------------------------------------
    function Na__VegCards__PaintSelected(pen) {
        Na__VegCards__SelectedPlants().forEach((plop) => Na__VegRun__PaintProxy(pen, plop, pen.SELECTED));
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Selection Out of the Project
    // ------------------------------------------------------------
    async function Na__VegCards__RemoveSelected() {
        const state = Na__VegCards__State;
        const selected = state.selected;
        if (!selected) return;
        const sceneData = Na__VegRun__GetSceneData();
        Na__VegShell__BeforeChange('');
        if (selected.kind === 'plop') {
            sceneData.Vegetation__SceneData__Plops = sceneData.Vegetation__SceneData__Plops.filter((plop) => plop.Vegetation__Plop__Uid !== selected.uid);
        } else if (selected.kind === 'stroke') {
            sceneData.Vegetation__SceneData__Plops = sceneData.Vegetation__SceneData__Plops.filter((plop) => plop.Vegetation__Plop__StrokeUid !== selected.uid);
        } else {
            sceneData.Vegetation__SceneData__Paths = sceneData.Vegetation__SceneData__Paths.filter((path) => path.Vegetation__Path__Uid !== selected.uid);
        }
        state.selected = null;
        Na__VegShell__MarkChanged();
        await Na__VegRun__SyncPlants();
        Na__VegCards__DrawList();
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Selection to the Middle of the View
    // ------------------------------------------------------------
    function Na__VegCards__FocusSelected() {
        const plants = Na__VegCards__SelectedPlants();
        if (plants.length === 0) return;
        let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        plants.forEach((plop) => {
            const [x, y, z] = plop.Vegetation__Plop__PositionMm;
            const reach = Na__VegRun__SizeOf(plop)[0];
            minX = Math.min(minX, x - reach); maxX = Math.max(maxX, x + reach);
            minY = Math.min(minY, y);         maxY = Math.max(maxY, y + reach);
            minZ = Math.min(minZ, z - reach); maxZ = Math.max(maxZ, z + reach);
        });
        const { camera, controls } = Na__VegRun__GetContext();
        const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2000;
        const reachM = Math.max(Na__VegCards__FOCUS_MIN_M, radius * Na__VegCards__FOCUS_FACTOR);
        const offset = camera.position.clone().sub(controls.target).setLength(reachM);
        controls.target.set((minX + maxX) / 2000, (minY + maxY) / 2000, (minZ + maxZ) / 2000);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Lists
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Asset's Name from the Catalogue
    // ------------------------------------------------------------
    function Na__VegCards__AssetName(assetId) {
        const row = Na__VegCards__State.catalogue.find((candidate) => candidate.Asset__Id === assetId);
        return row ? row.Asset__Name : assetId;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Row of In This Project
    // ------------------------------------------------------------
    function Na__VegCards__Row(kind, uid, text, meta, who) {
        const state = Na__VegCards__State;
        const isSelected = state.selected && state.selected.kind === kind && state.selected.uid === uid;
        const row = Na__VegShell__El('button', 'na-veg-list-row na-scene-list-row' + (isSelected ? ' na-veg-list-row--selected' : ''));
        row.type = 'button';
        row.appendChild(Na__VegShell__El('span', '', text));
        row.appendChild(Na__VegShell__El('span', 'na-veg-list-row__meta', meta));
        if (who && (who.name || who.waiting)) row.appendChild(Na__SceneChanges__WhoLine(who));
        row.addEventListener('click', () => {
            state.selected = isSelected ? null : { kind, uid };
            Na__VegCards__DrawList();
        });
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Selected Plant's Scale and Size
    // ------------------------------------------------------------
    // Scale is the whole plant, the same bush, smaller. Width, depth and height show what it
    // really measures and fit it to a space, and there its clumps keep their own size, as a
    // stretched run's do. So what is saved is the number typed, over the scale.
    // ------------------------------------------------------------
    function Na__VegCards__AppendPlantSize(holder, plop) {
        const recipe  = Na__VegRun__RecipeFor(plop.Vegetation__Plop__AssetId);
        const own     = recipe ? [recipe.Asset__Size.Size__WidthMm, recipe.Asset__Size.Size__DepthMm, recipe.Asset__Size.Size__HeightMm] : null;
        const fields  = [];
        const showSize = () => {
            const measured = Na__VegRun__SizeOf(plop);
            fields.forEach((field, index) => { field.value = String(measured[index]); });
        };

        const scale = Na__VegShell__PlantScaleSlider({
            label   : 'Scale',
            value   : plop.Vegetation__Plop__Scale,
            title   : 'The whole plant: 0.50 is half the size in every way, and the same bush',
            onInput : (value) => {
                Na__VegShell__BeforeChange('plant-scale');
                Na__VegCards__WriteScale(plop, value);
                Na__VegShell__MarkChanged();
                showSize();
                Na__VegTools__Repaint();
                Na__VegRun__SyncPlants();
            },
            onChange : () => { Na__VegCards__DrawList(); }
        });
        scale.row.style.marginTop = '8px';
        holder.appendChild(scale.row);

        const sizes = Na__VegShell__El('div', 'na-veg-row');
        ['Width', 'Depth', 'Height'].forEach((label, index) => {
            const wrap  = Na__VegShell__El('label', 'na-veg-size-field');
            wrap.appendChild(Na__VegShell__El('span', '', label + ' mm'));
            const input = Na__VegShell__El('input', 'na-veg-field na-veg-field--number');
            input.type = 'number';
            input.min  = String(Na__VegCards__SIZE_MIN_MM);
            input.max  = String(Na__VegCards__SIZE_MAX_MM);
            input.step = '10';
            input.addEventListener('change', async () => {
                const value = Number(input.value);
                if (!(value > 0)) {
                    showSize();
                    return;
                }
                const zoom  = plop.Vegetation__Plop__Scale > 0 ? plop.Vegetation__Plop__Scale : 1;
                const saved = (plop.Vegetation__Plop__SizeMm || own || Na__VegRun__SizeOf(plop)).slice();
                saved[index] = Math.round(Math.min(Na__VegCards__SIZE_MAX_MM, Math.max(Na__VegCards__SIZE_MIN_MM, value)) / zoom);
                Na__VegShell__BeforeChange('');
                plop.Vegetation__Plop__SizeMm = saved;
                Na__VegShell__MarkChanged();
                await Na__VegRun__SyncPlants();
                Na__VegCards__DrawList();
            });
            wrap.appendChild(input);
            fields.push(input);
            sizes.appendChild(wrap);
        });
        if (own) {
            const reset = Na__VegShell__Button('Reset Size', '', async () => {
                Na__VegShell__BeforeChange('');
                plop.Vegetation__Plop__SizeMm = own.slice();
                delete plop.Vegetation__Plop__Scale;
                Na__VegShell__MarkChanged();
                await Na__VegRun__SyncPlants();
                Na__VegCards__DrawList();
            }, 'Back to its asset\'s own size, at a scale of 1');
            reset.style.alignSelf = 'flex-end';
            sizes.appendChild(reset);
        }
        holder.appendChild(sizes);
        showSize();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Scale for All of a Stroke's Plants
    // ------------------------------------------------------------
    // By the ratio from where they stand, so a plant that differed still differs. The slider
    // shows the first plant's scale, so a stroke set to 0.50 says so when it is opened again.
    // ------------------------------------------------------------
    function Na__VegCards__AppendStrokeScale(holder) {
        const plants = Na__VegCards__SelectedPlants();
        if (plants.length === 0) return;
        let current = plants[0].Vegetation__Plop__Scale > 0 ? plants[0].Vegetation__Plop__Scale : 1;
        const scale = Na__VegShell__PlantScaleSlider({
            label   : 'Scale of all its plants',
            value   : current,
            onInput : (value) => {
                const ratio = value / current;
                current = value;
                Na__VegShell__BeforeChange('stroke-scale');
                plants.forEach((plop) => {
                    const was = plop.Vegetation__Plop__Scale > 0 ? plop.Vegetation__Plop__Scale : 1;
                    Na__VegCards__WriteScale(plop, Math.round(was * ratio * 1000) / 1000);
                });
                Na__VegShell__MarkChanged();
                Na__VegTools__Repaint();
                Na__VegRun__SyncPlants();
            },
            onChange : () => { Na__VegCards__DrawList(); }
        });
        scale.row.style.marginTop = '8px';
        holder.appendChild(scale.row);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Path's Plant Scale, as in the Linear Tool
    // ------------------------------------------------------------
    function Na__VegCards__AppendPathScale(holder, path) {
        const scale = Na__VegShell__PlantScaleSlider({
            value   : path.Vegetation__Path__PlantScale,
            title   : 'The whole plant: 0.50 is half the size in every way. Its spacing follows, so the bed stays as full.',
            onInput : (value) => {
                Na__VegShell__BeforeChange('plant-scale');
                Na__VegPath__SetPlantScale(path, value);
                Na__VegShell__MarkChanged();
                Na__VegTools__Repaint();
                Na__VegRun__SyncPlants();
            },
            onChange : () => { Na__VegCards__DrawList(); }
        });
        scale.row.style.marginTop = '8px';
        holder.appendChild(scale.row);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Name and Actions of What Is Selected
    // ------------------------------------------------------------
    // Headed by its name, as a figure is in Entourage's panel. The saved record is no longer
    // shown (Adam, 11-Nov-2026: "remove the section showing the code thats no longer needed").
    // ------------------------------------------------------------
    function Na__VegCards__AppendDetail(holder) {
        const state = Na__VegCards__State;
        const selected = state.selected;
        if (!selected) return;
        const sceneData = Na__VegRun__GetSceneData();
        const heading = (title) => holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', title));
        const actions = Na__VegShell__El('div', 'na-veg-row');
        actions.style.marginTop = '8px';
        actions.appendChild(Na__VegShell__Button('Focus', '', Na__VegCards__FocusSelected, 'Bring it to the middle of the view'));

        if (selected.kind === 'plop') {
            const plop = Na__VegCards__SelectedPlop();
            if (!plop) return;
            heading(Na__VegCards__AssetName(plop.Vegetation__Plop__AssetId));
            actions.appendChild(Na__VegShell__Button('New Seed', '', async () => {
                Na__VegShell__BeforeChange('');
                plop.Vegetation__Plop__Seed = Math.floor(Math.random() * Na__VegCards__SEED_RANGE);
                Na__VegShell__MarkChanged();
                await Na__VegRun__SyncPlants();
                Na__VegCards__DrawList();
            }, 'The same rules, a different bush'));
            actions.appendChild(Na__VegShell__Button('Move', '', () => {
                state.armedId = null;
                state.moving  = true;
                Na__VegCards__TakeClicks();
                Na__VegCards__SetCursor();
                Na__VegCards__WriteHint();
            }, 'Then click the model where it should go'));
            actions.appendChild(Na__VegShell__Button('Remove', 'na-veg-btn--danger', Na__VegCards__RemoveSelected));
            holder.appendChild(actions);

            const turn = Na__VegShell__Slider({
                label   : 'Turn',
                min     : -180,
                max     : 180,
                step    : 1,
                value   : plop.Vegetation__Plop__YawDeg || 0,
                format  : (value) => Math.round(value) + ' deg',
                onInput : () => { Na__VegTools__Repaint(); },
                onChange: async (value) => {
                    Na__VegShell__BeforeChange('');
                    plop.Vegetation__Plop__YawDeg = value;
                    Na__VegShell__MarkChanged();
                    await Na__VegRun__SyncPlants();
                    Na__VegCards__DrawList();
                }
            });
            turn.row.style.marginTop = '8px';
            holder.appendChild(turn.row);
            Na__VegCards__AppendPlantSize(holder, plop);
        } else if (selected.kind === 'stroke') {
            heading(selected.uid === Na__VegCards__TEST_ROW ? 'Test row' : 'Stroke ' + selected.uid);
            actions.appendChild(Na__VegShell__Button('Remove', 'na-veg-btn--danger', Na__VegCards__RemoveSelected));
            holder.appendChild(actions);
            Na__VegCards__AppendStrokeScale(holder);
        } else {
            const path = Na__VegData__FindPath(sceneData, selected.uid);
            if (!path) return;
            heading(path.Vegetation__Path__Name || 'Path ' + selected.uid);
            actions.appendChild(Na__VegShell__Button('Edit', '', async () => {
                const tool = await import('../20__System__Tools/Na__Vegetation__LinearTool__.js');
                await tool.Na__VegLinear__OpenOn(state.context, selected.uid);
            }, 'In the Line Tool'));
            actions.appendChild(Na__VegShell__Button('Remove', 'na-veg-btn--danger', Na__VegCards__RemoveSelected));
            holder.appendChild(actions);
            Na__VegCards__AppendPathScale(holder, path);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Update to Latest, for an Asset the Library Has Since Improved
    // ------------------------------------------------------------
    function Na__VegCards__AppendPinned(holder) {
        const state = Na__VegCards__State;
        const sceneData = Na__VegRun__GetSceneData();
        const pinned = sceneData.Vegetation__SceneData__Assets;
        const ids = Object.keys(pinned);
        if (ids.length === 0) return;
        holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'This project\'s copies of its assets'));
        ids.forEach((assetId) => {
            const row = Na__VegShell__El('div', 'na-veg-row na-veg-row--between');
            const mine = pinned[assetId].Asset__Meta ? pinned[assetId].Asset__Meta.Meta__Version : '?';
            const catalogueRow = state.catalogue.find((candidate) => candidate.Asset__Id === assetId);
            row.appendChild(Na__VegShell__El('span', '', Na__VegCards__AssetName(assetId) + ' ' + mine));
            if (Na__VegData__Work().isAdmin && catalogueRow && catalogueRow.Asset__Version !== mine) {
                row.appendChild(Na__VegShell__Button('Update to ' + catalogueRow.Asset__Version, '', async () => {
                    Na__VegShell__BeforeChange('');
                    delete pinned[assetId];
                    await Na__VegLib__PinAsset(sceneData, assetId);
                    Na__VegShell__MarkChanged();
                    await Na__VegRun__RefreshAsset(assetId);
                    Na__VegCards__DrawList();
                }, 'Its plants draw again from the library\'s newer rules'));
            }
            holder.appendChild(row);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw What the Current Tab Shows
    // ------------------------------------------------------------
    function Na__VegCards__DrawList() {
        const state = Na__VegCards__State;
        if (state.tab === 'project') Na__VegCards__DrawProject();
        if (state.tab === 'changes') Na__VegCards__DrawChanges();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | In This Project
    // ------------------------------------------------------------
    function Na__VegCards__DrawProject() {
        const state = Na__VegCards__State;
        const holder = state.listEl;
        if (!holder) return;
        const sceneData = Na__VegRun__GetSceneData();
        holder.textContent = '';

        const paths = sceneData.Vegetation__SceneData__Paths;
        const plops = sceneData.Vegetation__SceneData__Plops;
        const work  = Na__VegData__Work();
        const myCode = work.me ? work.me.code : '';
        const whoDid = (key) => Na__SceneChanges__WhoDid(work.summary, key, myCode);
        if (paths.length === 0 && plops.length === 0) {
            holder.appendChild(Na__VegShell__El('p', 'na-veg-panel__hint', 'Nothing planted yet. Place a card, draw a line with the Line Tool, or brush with the Brush Tool.'));
        } else {
            const mine = Na__VegShell__El('label', 'na-scene-mine');
            const tick = Na__VegShell__El('input', 'na-veg-tick__input');
            tick.type = 'checkbox';
            tick.id = 'naVegetationOnlyMine';
            tick.checked = state.onlyMine;
            tick.addEventListener('change', () => {
                state.onlyMine = tick.checked;
                Na__VegCards__DrawProject();
            });
            mine.appendChild(tick);
            mine.appendChild(Na__VegShell__El('span', '', 'Only mine'));
            holder.appendChild(mine);
        }

        const pathRows = paths.filter((path) => !state.onlyMine || whoDid('path:' + path.Vegetation__Path__Uid).mine);
        if (pathRows.length > 0) {
            holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Paths'));
            pathRows.forEach((path) => {
                const count = Na__VegRun__PathPlants(path).length;
                holder.appendChild(Na__VegCards__Row('path', path.Vegetation__Path__Uid, path.Vegetation__Path__Name || path.Vegetation__Path__Uid, count + (count === 1 ? ' plant' : ' plants'), whoDid('path:' + path.Vegetation__Path__Uid)));
            });
        }

        const strokes = new Map();
        const singles = [];
        plops.forEach((plop) => {
            const who = whoDid('plop:' + plop.Vegetation__Plop__Uid);
            if (state.onlyMine && !who.mine) return;
            const uid = plop.Vegetation__Plop__StrokeUid;
            if (uid) {
                const stroke = strokes.get(uid) || { count : 0, who };                 // <-- Brushed together: the first plant's name stands for the stroke
                stroke.count++;
                stroke.who = { name : stroke.who.name, mine : stroke.who.mine, waiting : stroke.who.waiting || who.waiting };
                strokes.set(uid, stroke);
            } else {
                singles.push({ plop, who });
            }
        });
        if (strokes.size > 0) {
            holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Brush strokes'));
            strokes.forEach((stroke, uid) => {
                const label = uid === Na__VegCards__TEST_ROW ? 'Test row' : 'Stroke ' + uid;
                holder.appendChild(Na__VegCards__Row('stroke', uid, label, stroke.count + (stroke.count === 1 ? ' plant' : ' plants'), stroke.who));
            });
        }
        if (singles.length > 0) {
            holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Single plants'));
            singles.forEach(({ plop, who }) => {
                holder.appendChild(Na__VegCards__Row('plop', plop.Vegetation__Plop__Uid, Na__VegCards__AssetName(plop.Vegetation__Plop__AssetId), plop.Vegetation__Plop__Uid, who));
            });
        }

        if (state.selected) Na__VegCards__AppendDetail(holder);
        Na__VegCards__AppendPinned(holder);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The Cards
    // ------------------------------------------------------------
    function Na__VegCards__DrawCards() {
        const state = Na__VegCards__State;
        const holder = state.listEl;
        if (!holder) return;
        holder.textContent = '';
        state.cardEls.clear();

        // THE FINDING ROW | A search, a funnel, and the two picture switches
        const finding = Na__VegShell__El('div', 'na-veg-row');
        const search = Na__VegShell__El('input', 'na-veg-field');
        search.type = 'search';
        search.placeholder = 'Search assets';
        search.value = state.search;
        search.style.flex = '1 1 auto';
        search.style.width = 'auto';
        search.addEventListener('input', () => {
            state.search = search.value;
            Na__VegCards__DrawMatches(matches);
        });
        finding.appendChild(search);
        const funnel = Na__VegShell__Button('Filter', state.chipsOpen || state.chips.size > 0 ? 'na-veg-btn--strong' : '', () => {
            state.chipsOpen = !state.chipsOpen;
            Na__VegCards__DrawCards();
        }, 'Filter by keyword');
        finding.appendChild(funnel);
        holder.appendChild(finding);

        if (state.chipsOpen) {
            const chips = Na__VegShell__El('div', 'na-veg-chips');
            const words = new Set();
            state.catalogue.forEach((row) => (row.Asset__Keywords || []).forEach((word) => words.add(word)));
            Array.from(words).sort().forEach((word) => {
                const chip = Na__VegShell__El('button', 'na-veg-chip' + (state.chips.has(word) ? ' na-veg-chip--on' : ''), word);
                chip.type = 'button';
                chip.addEventListener('click', () => {
                    if (state.chips.has(word)) state.chips.delete(word); else state.chips.add(word);
                    Na__VegCards__DrawCards();
                });
                chips.appendChild(chip);
            });
            holder.appendChild(chips);
        }

        const switches = Na__VegShell__El('div', 'na-veg-row na-veg-row--between');
        switches.appendChild(Na__VegShell__El('span', 'na-veg-panel__hint', 'Cards'));
        switches.lastChild.style.margin = '0';
        switches.appendChild(Na__VegShell__Choice([['rendered', 'Rendered'], ['proxy', 'Proxy']], state.pictures, (value) => {
            state.pictures = value;
            state.cardEls.forEach((entry, id) => Na__VegCards__DrawPicture(entry.canvas, state.recipes.get(id)));
        }).row);
        holder.appendChild(switches);

        const model = Na__VegShell__El('div', 'na-veg-row na-veg-row--between');
        model.appendChild(Na__VegShell__El('span', 'na-veg-panel__hint', 'Model'));
        model.lastChild.style.margin = '0';
        model.appendChild(Na__VegShell__Choice([['rendered', 'Rendered'], ['proxy', 'Proxy'], ['both', 'Both']], Na__VegRun__GetMode(), (value) => {
            Na__VegRun__SetMode(value);
        }).row);
        holder.appendChild(model);

        holder.appendChild(Na__VegShell__PlantScaleSlider({
            value   : Na__VegCards__PlaceBlock().Vegetation__Place__PlantScale,
            title   : 'The next plant dropped from a card: 0.50 is half the size in every way. Its proxy shows under the pointer.',
            onInput : (value) => {
                Na__VegShell__BeforeChange('place-plant-scale');
                Na__VegCards__PlaceBlock().Vegetation__Place__PlantScale = value;
                Na__VegShell__MarkChanged();
                Na__VegTools__Repaint();
            }
        }).row);

        state.hintEl = Na__VegShell__El('p', 'na-veg-panel__hint');
        holder.appendChild(state.hintEl);
        Na__VegCards__WriteHint();

        const matches = Na__VegShell__El('div', '');
        holder.appendChild(matches);
        Na__VegCards__DrawMatches(matches);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | The Cards the Search and Chips Leave, by Collection then Type
    // ------------------------------------------------------------
    function Na__VegCards__DrawMatches(holder) {
        const state = Na__VegCards__State;
        holder.textContent = '';
        state.cardEls.clear();
        const needle = state.search.trim().toLowerCase();
        const rows = state.catalogue.filter((row) => {
            if (row.Asset__Status === 'Retired') return false;
            const words = (row.Asset__Keywords || []);
            for (const chip of state.chips) {
                if (!words.includes(chip)) return false;
            }
            if (!needle) return true;
            return (row.Asset__Name + ' ' + row.Asset__Id + ' ' + row.Asset__TypeLabel + ' ' + words.join(' ')).toLowerCase().includes(needle);
        });
        if (rows.length === 0) {
            holder.appendChild(Na__VegShell__El('p', 'na-veg-panel__hint', 'No assets match.'));
            return;
        }

        let lastHeading = '';
        rows.forEach((row) => {
            const heading = row.Asset__CollectionLabel + ': ' + row.Asset__TypeLabel;
            if (heading !== lastHeading) {
                holder.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', heading));
                lastHeading = heading;
            }
            const card = Na__VegShell__El('div', 'na-veg-card' + (state.armedId === row.Asset__Id ? ' na-veg-card--armed' : ''));
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            const recipe = state.recipes.get(row.Asset__Id);
            if (recipe) card.title = recipe.Asset__Description;
            const canvas = Na__VegShell__El('canvas', 'na-veg-card__picture');
            card.appendChild(canvas);
            card.appendChild(Na__VegShell__El('div', 'na-veg-card__name', row.Asset__Name));
            card.appendChild(Na__VegShell__El('div', 'na-veg-card__meta', row.Asset__Id + '  |  ' + row.Asset__WidthMm + ' x ' + row.Asset__HeightMm + ' mm'));
            card.addEventListener('click', () => Na__VegCards__ArmCard(row.Asset__Id));

            const add = Na__VegShell__El('button', 'na-veg-card__add', '+');
            add.type = 'button';
            add.title = `Add to the palette the tools draw from`;              // <-- Backticks: in quotes, the module-graph verifier reads "from '" as an import (TrueVision)
            add.addEventListener('click', (event) => {
                event.stopPropagation();
                Na__VegPalUi__AddAsset(row.Asset__Id, row.Asset__Name);
            });
            card.appendChild(add);

            const draw = Na__VegShell__El('button', 'na-veg-card__draw', 'Draw Path');
            draw.type = 'button';
            draw.title = 'Draw a path of only this plant with the Line Tool: how a hedge is made';
            draw.addEventListener('click', async (event) => {
                event.stopPropagation();
                const paletteUid = await Na__VegPalUi__OnlyThis(row.Asset__Id, row.Asset__Name);
                const tool = await import('../20__System__Tools/Na__Vegetation__LinearTool__.js');
                await tool.Na__VegLinear__DrawWith(state.context, paletteUid);
            });
            card.appendChild(draw);

            state.cardEls.set(row.Asset__Id, { card, canvas });
            holder.appendChild(card);
            if (recipe) Na__VegCards__DrawPicture(canvas, recipe);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // SUB FUNCTION | The Changes Tab
    // ------------------------------------------------------------
    function Na__VegCards__DrawChanges() {
        const state = Na__VegCards__State;
        if (!state.listEl) return;
        const work = Na__VegData__Work();
        Na__SceneChanges__Draw(state.listEl, {
            system    : Na__VegData__SYSTEM,
            summary   : work.summary,
            isAdmin   : work.isAdmin,
            nameOf    : (what) => (what ? Na__VegCards__AssetName(what) : ''),
            saveFirst : async () => (Na__VegData__IsDirty() ? Na__VegShell__Save() : true),
            onAnswer  : async (answer) => {
                state.selected = null;
                await Na__VegData__TakeAnswer(answer);
                await Na__VegShell__AfterReplaced();
            },
            onItem    : (item) => {
                state.selected = { kind : item.Kind === 'path' ? 'path' : 'plop', uid : item.Uid };
                Na__VegTools__Repaint();
            },
            toast     : Na__VegShell__Toast,
            redraw    : Na__VegCards__DrawChanges
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Changes Row Says How Many Are Waiting
    // ------------------------------------------------------------
    // An admin's count is everyone's. Anyone else's is their own.
    // ------------------------------------------------------------
    function Na__VegCards__PaintCount() {
        const hub = Na__VegCards__State.hub;
        if (!hub) return;
        const work = Na__VegData__Work();
        hub.setCount('changes', Na__SceneChanges__CountWaiting(work.summary, work.isAdmin ? '' : (work.me && work.me.code)));
    }
    // ------------------------------------------------------------


    // HANDLER | Who Did What Has Changed
    // ------------------------------------------------------------
    function Na__VegCards__OnWorkChanged() {
        Na__VegCards__PaintCount();
        if (Na__VegCards__State.listEl) Na__VegCards__DrawList();
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Section, Folding the One That Was Open
    // ------------------------------------------------------------
    // 'assets', 'line', 'brush', 'project' or 'changes'. Resolves once it is drawn.
    // ------------------------------------------------------------
    function Na__VegCards__ShowTab(tab) {
        const hub = Na__VegCards__State.hub;
        return hub ? hub.open(tab) : Promise.resolve();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Section That Is a List: It Draws into Its Body While Open
    // ------------------------------------------------------------
    function Na__VegCards__ListSection(key, draw) {
        return (body) => {
            const state = Na__VegCards__State;
            state.tab    = key;
            state.listEl = body;
            draw();
            Na__VegTools__Repaint();
            return () => {
                if (state.listEl !== body) return;                             // <-- A section opened since owns the list now
                state.listEl = null;
                state.hintEl = null;
            };
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Section That Is a Tool: Armed on the Model While Open
    // ------------------------------------------------------------
    // The tool draws its own rows into the body, and hands back how to stop.
    // ------------------------------------------------------------
    function Na__VegCards__ToolSection(key, load) {
        return async (body, controls) => {
            const state = Na__VegCards__State;
            state.tab = key;
            const mount = await load();
            return mount(state.context, body, controls);
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Panel's Sections, in Order
    // ------------------------------------------------------------
    function Na__VegCards__Sections() {
        const state = Na__VegCards__State;
        return [                                                               // <-- Adam's order, 11-Nov-2026: the tools first, then the library
            {
                key   : 'line',
                label : 'Line Tool',
                icon  : 'VegetationLine',
                title : 'Draw a line on the model and plants are set out along it: how a hedge or a bed is made',
                mount : Na__VegCards__ToolSection('line', async () => (await import('../20__System__Tools/Na__Vegetation__LinearTool__.js')).Na__VegLinear__Mount)
            },
            {
                key   : 'brush',
                label : 'Brush Tool',
                icon  : 'VegetationBrush',
                title : 'Brush plants on from a palette. Alt takes them away',
                mount : Na__VegCards__ToolSection('brush', async () => (await import('../20__System__Tools/Na__Vegetation__BushTool__.js')).Na__VegBushTool__Mount)
            },
            {
                key   : 'assets',
                label : 'Assets',
                icon  : 'Vegetation',
                title : 'The library as cards: click a card, then click the model to drop one',
                mount : (body) => {
                    const stop = Na__VegCards__ListSection('assets', Na__VegCards__DrawCards)(body);
                    return () => {
                        if (state.armedId) Na__VegCards__StopPlacing();        // <-- A card left armed would still drop plants
                        state.cardEls.clear();
                        stop();
                    };
                }
            },
            {
                key   : 'project',
                label : 'In This Project',
                icon  : 'InThisProject',
                title : 'Every path, stroke and plant here: select, focus, size, move or take out',
                mount : Na__VegCards__ListSection('project', Na__VegCards__DrawProject)
            }
            // TRUEVISION | No Change Log section: there is no list of who did what (PORT NOTE)
        ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Panel Was Doing
    // ------------------------------------------------------------
    function Na__VegCards__OnClose() {
        const state = Na__VegCards__State;
        if (state.hub) {
            const hub = state.hub;
            state.hub = null;
            hub.destroy();                                                     // <-- The open section stops first: a tool lets go of the model
        }
        state.armedId = null;
        state.moving  = false;
        state.selected = null;
        state.resume  = null;
        state.listEl  = null;
        state.hintEl  = null;
        state.cardEls.clear();
        window.removeEventListener('na-vegetation-object-replaced', Na__VegCards__DrawList);
        window.removeEventListener(Na__VegData__WORK_EVENT, Na__VegCards__OnWorkChanged);
        if (state.context) Na__VegPlantMenu__Stop(state.context);
        Na__VegTools__SetFallback(null);
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Panel, Opening on a Section
    // ------------------------------------------------------------
    // A second ask while the first is still loading the library waits for it, so there is only
    // ever one panel and one set of sections.
    // ------------------------------------------------------------
    async function Na__VegCards__Build(context, tab) {
        const state = Na__VegCards__State;
        if (Na__VegShell__IsOpen(Na__VegCards__PANEL_ID)) return;
        if (!state.opening) {
            state.opening = Na__VegCards__BuildNow(context, tab).finally(() => { state.opening = null; });
        }
        await state.opening;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Build It Now
    // ------------------------------------------------------------
    async function Na__VegCards__BuildNow(context, tab) {
        await Na__VegShell__Prepare(context);
        await Na__VegTools__Prepare(context);
        const state = Na__VegCards__State;
        state.context = context;

        state.catalogue = await Na__VegLib__LoadCatalogue();
        for (const row of state.catalogue) {
            if (!state.recipes.has(row.Asset__Id)) state.recipes.set(row.Asset__Id, await Na__VegLib__LoadAsset(row.Asset__Id));
        }

        Na__SceneChanges__AddStyles();
        const panel = Na__VegShell__Open({
            id      : Na__VegCards__PANEL_ID,
            title   : 'Vegetation',
            side    : 'left',
            hub     : true,
            icon    : Na__SceneChanges__Icon('Vegetation', 'na-scene-hub__title-icon'),
            onClose : Na__VegCards__OnClose
        });
        state.hub = Na__SceneHub__Create(panel.body, {
            sections : Na__VegCards__Sections(),
            onOpened : (key) => {
                if (!key) state.tab = '';
                Na__VegTools__Repaint();
            }
        });

        state.listEl = null;
        window.addEventListener('na-vegetation-object-replaced', Na__VegCards__DrawList);
        window.addEventListener(Na__VegData__WORK_EVENT, Na__VegCards__OnWorkChanged);
        Na__VegCards__PaintCount();
        Na__VegTools__SetFallback(Na__VegCards__Tool);                         // <-- Whenever no tool has the clicks, a click selects a plant
        if (!Na__VegTools__Current()) Na__VegTools__Arm(Na__VegCards__Tool);
        Na__VegPalUi__SetPictureDrawer(Na__VegCards__DrawPicture);             // <-- The palette's plant pictures are the cards' own
        Na__VegPlantMenu__Start(context, {
            hasTheClicks : () => Na__VegTools__Current() === Na__VegCards__Tool && !state.armedId && !state.moving,
            onPicked     : (kind, uid) => {
                state.selected = kind ? { kind, uid } : null;
                if (kind && state.tab !== 'project') Na__VegCards__ShowTab('project');
                else Na__VegCards__DrawList();
            },
            onChanged    : Na__VegCards__DrawList,
            catalogue    : () => state.catalogue,
            recipeOf     : (assetId) => state.recipes.get(assetId) || null,
            drawPicture  : Na__VegCards__DrawPicture,
            startMove    : () => {
                state.armedId = null;
                state.moving  = true;
                Na__VegCards__TakeClicks();
                Na__VegCards__SetCursor();
                Na__VegCards__WriteHint();
            }
        });
        if (tab) await Na__VegCards__ShowTab(tab);
        else state.tab = '';                                                   // <-- Every section folded: the panel's rows are its menu
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel with Every Section Folded, If It Is Not Open
    // ------------------------------------------------------------
    // What unfolding Vegetation in Tools & Settings does. Adam, 11-Nov-2026: "When the menu first
    // opens close the vegtation assets as it makes it hard to navigate the menu".
    // ------------------------------------------------------------
    async function Na__VegCards__Open(context) {
        await Na__VegCards__Build(context, '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Panel, If It Is Open
    // ------------------------------------------------------------
    // What folding Vegetation in Tools & Settings does.
    // ------------------------------------------------------------
    function Na__VegCards__Close() {
        Na__VegShell__Close(Na__VegCards__PANEL_ID);
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel, or Close It If It Is Open
    // ------------------------------------------------------------
    async function Na__VegCards__Toggle(context) {
        if (Na__VegShell__IsOpen(Na__VegCards__PANEL_ID)) {
            Na__VegCards__Close();
            return;
        }
        await Na__VegCards__Build(context, '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel on a Section, or Go to That Section If It Is Open
    // ------------------------------------------------------------
    async function Na__VegCards__OpenOn(context, tab) {
        await Na__VegCards__Build(context, tab);
        await Na__VegCards__ShowTab(tab);                                     // <-- Already open, or opened by an ask before this one
    }
    // ------------------------------------------------------------


    // FUNCTION | Fold a Section, If It Is the Open One
    // ------------------------------------------------------------
    // The Brush Tool's Escape: stop brushing.
    // ------------------------------------------------------------
    function Na__VegCards__FoldSection(tab) {
        const hub = Na__VegCards__State.hub;
        if (hub && hub.current() === tab) hub.fold();
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Section Is Open: '' When the Panel Is Shut or All Are Folded
    // ------------------------------------------------------------
    function Na__VegCards__CurrentSection() {
        const hub = Na__VegCards__State.hub;
        return hub ? hub.current() : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Asset Browser API
    // ------------------------------------------------------------
    export {
        Na__VegCards__Open,
        Na__VegCards__Close,
        Na__VegCards__Toggle,
        Na__VegCards__OpenOn,
        Na__VegCards__FoldSection,
        Na__VegCards__CurrentSection
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
