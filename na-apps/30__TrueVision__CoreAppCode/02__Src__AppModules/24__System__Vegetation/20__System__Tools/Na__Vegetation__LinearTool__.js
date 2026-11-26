// =============================================================================
// TRUEVISION3D - VEGETATION - THE LINEAR TOOL
// =============================================================================
//
// FILE       : Na__Vegetation__LinearTool__.js
// NAMESPACE  : Na__VegLinear
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw and edit paths that make vegetation, with their rules in a panel
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - Adam, 04-Nov-2026: "Linear placement tool (a quick array tool allowing for drawing and
//   editing paths thaty create vegetation like your demo, ensure each asset gets a sligtly
//   random rot and scale (but add advanced parameters dropdown for use rto be able to
//   configure ths feature too."
// - DRAW: Draw New Path, then click along the planter. Plants appear as you go. Enter or a
//   double click finishes, Backspace takes back the last point, Escape cancels the lot.
// - WHAT THE NEXT CLICK ADDS IS SHOWN FIRST (Adam, 11-Nov-2026: "show previews of the assets as
//   you draw the line otherwise its hard to understand what your doing"). Proxies at their real
//   size along the rubber band, worked out by the same sums and seed as the real plants, and the
//   path's first plant under the pointer before the first click. Nothing is built until the click.
// - EDIT: a click on a path selects it and gives its points grips. Drag a grip; click the
//   line to add a point; Delete takes out the grip under the pointer, and with none there
//   the whole path. Dragging shows proxies, and the real plants draw on release, keeping
//   every plant before the change exactly as it was (Na__Vegetation__PathModel__.js).
// - PLAIN CLICKS LEAVE A DRAG TO THE ORBIT. Only a press on a grip is taken.
// - A PATH SAVES ITS RULES, NOT ITS PLANTS (plan, D16). Bake to Plants turns one into single
//   plants for hand editing, one way, with undo.
// - THE PANEL WORKS ON THE SELECTED PATH, or with none selected on what the next path will
//   start from. Both are the same keys, so it is one set of rows, and all of it saves.
// - PLANT SCALE (Adam, 04-Nov-2026: "I would set a scale of 0.5"). The whole plant, with the
//   Spacing slider following by the same ratio, so half size is the same bed, smaller.
//
// FRAMES:
// - Points are picked in world metres and saved as integer mm in three.js axes, once, here.
// - A click that misses the model lands on the level of the path's last point, so a path can
//   cross open ground.
//
// - A SECTION OF THE VEGETATION PANEL (Adam, 06-Nov-2026: "we currently have multiple places for
//   creating things"). Its rows are drawn into the Line Tool section on the left, not a panel of
//   its own on the right, and it is armed on the model only while that section is open.
//
// INTEGRATION:
// - Mounted by the Vegetation panel's Line Tool section (../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js),
//   which a card's Draw Path and a path's Edit in In This Project open too.
// - @delegate: ./Na__Vegetation__ToolHost__.js
// - @delegate: ../01__Core__Engine/Na__Vegetation__PathModel__.js
// - @delegate: ../10__Ui__Panels/Na__Vegetation__PaletteEditor__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__LinearTool__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 26-Nov-2026 - Version 1.6.1 (ValeVision3D v2.99.3, TrueVision3D v2.189.8)
// - The instruction note is gone: the same words are the tooltip of an (i) (Adam, 26-Nov-2026:
//   "do the same with TrueVision same princple applies", after ValeVision 3D v2.99.3: "no
//   overwhelming notes in the UI"; ../../22__System__SceneAssets/Na__SceneAssets__InfoTip__.js).
//   The line on how to draw shows while a path is being drawn.
//
// 12-Nov-2026 - Version 1.6.0 (ValeVision3D v2.97.0)
// - A standard palette chosen in the Mix sets the path's plant scale and spacing to its own.
//
// 11-Nov-2026 - Version 1.5.0 (ValeVision3D v2.94.2)
// - Drawing shows the plants the next click adds as proxies, and the first plant before the first
//   click (its seed is picked when drawing starts). A curved path's rubber band follows its curve.
// - The hover throttle no longer drops the last move, so the band ends where the pointer stopped.
//
// 06-Nov-2026 - Version 1.4.0 (ValeVision3D v2.91.0)
// - A section of the Vegetation panel: Mount draws into it. Toggle, OpenOn and DrawWith open that
//   section, so every way in still works.
//
// 05-Nov-2026 - Version 1.3.0 (ValeVision3D v2.89.0)
// - Called the Line Tool on screen. New Seed clears a path's plants changed by hand, which were of plants no longer there.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - Plant scale and Height. Draw With, a card's way in to a path of one plant. Proxies at the
//   size a plant really is, and a baked plant keeps its scale.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 5 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Engine, Data and Runtime
    // ------------------------------------------------------------
    import {
        Na__VegPath__Line,
        Na__VegPath__InsertIndex,
        Na__VegPath__SetPlantScale
    } from '../01__Core__Engine/Na__Vegetation__PathModel__.js';
    import { Na__VegData__NextUid, Na__VegData__NextStrokeUid, Na__VegData__FindPath } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    import { Na__SceneInfo__Tip } from '../../22__System__SceneAssets/Na__SceneAssets__InfoTip__.js';
    import {
        Na__VegRun__GetSceneData,
        Na__VegRun__SyncPlants,
        Na__VegRun__PathPlants,
        Na__VegRun__PaintProxy,
        Na__VegRun__PaletteItems,
        Na__VegRun__EnsureRecipe,
        Na__VegRun__PinInUse
    } from '../03__System__SceneLayer/Na__Vegetation__Runtime__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Panels and Tools
    // ------------------------------------------------------------
    import {
        Na__VegShell__El,
        Na__VegShell__Button,
        Na__VegShell__Slider,
        Na__VegShell__PlantScaleSlider,
        Na__VegShell__Tick,
        Na__VegShell__Choice,
        Na__VegShell__MarkChanged,
        Na__VegShell__BeforeChange,
        Na__VegShell__Toast,
        Na__VegShell__Config,
        Na__VegShell__Prepare
    } from '../10__Ui__Panels/Na__Vegetation__PanelShell__.js';
    import {
        Na__VegPalUi__Ensure,
        Na__VegPalUi__Mount,
        Na__VegPalUi__SetCurrentUid
    } from '../10__Ui__Panels/Na__Vegetation__PaletteEditor__.js';
    import {
        Na__VegTools__Prepare,
        Na__VegTools__Arm,
        Na__VegTools__Disarm,
        Na__VegTools__Current,
        Na__VegTools__Repaint
    } from './Na__Vegetation__ToolHost__.js';
    import { Na__VegPick__AtPointer, Na__VegPick__OnLevel } from './Na__Vegetation__SurfacePick__.js';
    import { Na__VegOverlay__ToScreen } from './Na__Vegetation__ToolOverlay__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Rows
    // ------------------------------------------------------------
    const Na__VegLinear__SEED_RANGE = 1000000000;
    const Na__VegLinear__HOVER_MS   = 40;
    const Na__VegLinear__ADVANCED   = [
        { Key : 'Vegetation__PathAdvanced__RotationVariationDeg',    Label : 'Rotation variation',  Min : 0, Max : 45,   Step : 1,  Unit : ' deg', Title : 'Each long plant turns a little off the path. Round plants turn freely.' },
        { Key : 'Vegetation__PathAdvanced__ScaleVariationPercent',   Label : 'Scale variation',     Min : 0, Max : 40,   Step : 1,  Unit : '%',    Title : 'Changes a plant\'s size, never its scallops, so the line language holds.' },
        { Key : 'Vegetation__PathAdvanced__HeightVariationPercent',  Label : 'Height variation',    Min : 0, Max : 40,   Step : 1,  Unit : '%',    Title : 'Apart from scale, so a run undulates.' },
        { Key : 'Vegetation__PathAdvanced__SpacingVariationPercent', Label : 'Spacing variation',   Min : 0, Max : 45,   Step : 1,  Unit : '%',    Title : 'Or it reads as a colonnade.' },
        { Key : 'Vegetation__PathAdvanced__SideOffsetMm',            Label : 'Side offset',         Min : 0, Max : 400,  Step : 5,  Unit : ' mm',  Title : 'Off the line, so a row is not ruled.' },
        { Key : 'Vegetation__PathAdvanced__DepthAcrossMm',           Label : 'Depth across',        Min : 0, Max : 2000, Step : 10, Unit : ' mm',  Title : 'Fits every plant to a bed of this width. 0 keeps each asset\'s own.' },
        { Key : 'Vegetation__PathAdvanced__HeightFitMm',             Label : 'Height',              Min : 0, Max : 4000, Step : 10, Unit : ' mm',  Title : 'Fits every plant to this height, a clipped hedge to its exact line. 0 keeps each asset\'s own.' }
    ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Tool Is Doing
    // ------------------------------------------------------------
    const Na__VegLinear__State = {
        context     : null,
        selectedUid : '',
        drawingUid  : '',                                                      // <-- The path being drawn: it is in the object already, so plants appear as you go
        lastClickAt : 0,
        lastClickX  : 0,
        lastClickY  : 0,
        hoverPoint  : null,                                                    // <-- World metres under the pointer, for the rubber band
        nextSeed    : 0,                                                       // <-- Picked when drawing starts, so the plants shown before the first click are the ones it makes
        hoverGrip   : -1,
        hoverAt     : 0,
        hoverLate   : null,                                                    // <-- A move inside the throttle, handled when it ends
        hoverTimer  : 0,
        dragGrip    : -1,
        dragMoved   : false,
        dragProxies : null,
        body        : null,
        unmountPal  : null,
        refreshRows : null
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Selected Path, or Null
    // ------------------------------------------------------------
    function Na__VegLinear__Selected() {
        const uid = Na__VegLinear__State.selectedUid;
        return uid ? Na__VegData__FindPath(Na__VegRun__GetSceneData(), uid) : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Next Path Starts From
    // ------------------------------------------------------------
    function Na__VegLinear__Defaults() {
        return Na__VegRun__GetSceneData().Vegetation__SceneData__Tools.Vegetation__Tools__Linear;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Block the Panel's Rows Work On
    // ------------------------------------------------------------
    function Na__VegLinear__Rules() {
        return Na__VegLinear__Selected() || Na__VegLinear__Defaults();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A World Point in Metres as a Saved Point in Mm
    // ------------------------------------------------------------
    function Na__VegLinear__ToMm(point) {
        return [Math.round(point.x * 1000), Math.round(point.y * 1000), Math.round(point.z * 1000)];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Saved Line in Metres, for the Drawing Layer
    // ------------------------------------------------------------
    function Na__VegLinear__LineInMetres(path) {
        const line = Na__VegPath__Line(path.Vegetation__Path__PointsMm, path.Vegetation__Path__Curved === true);
        return line.points.map((p) => [p[0] / 1000, p[1] / 1000, p[2] / 1000]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Click Lands: the Model, or the Level of the Last Point
    // ------------------------------------------------------------
    function Na__VegLinear__PointAt(clientX, clientY, levelM) {
        const hit = Na__VegPick__AtPointer(clientX, clientY);
        if (hit) return hit.point;
        return Na__VegPick__OnLevel(clientX, clientY, levelM);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Canvas's Corner, to Bring a Pointer into the Layer's Pixels
    // ------------------------------------------------------------
    function Na__VegLinear__LocalPointer(event) {
        const rect = Na__VegLinear__State.context.renderer.domElement.getBoundingClientRect();
        return { x : event.clientX - rect.left, y : event.clientY - rect.top };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Grip of a Path Is Under a Pointer, or -1
    // ------------------------------------------------------------
    function Na__VegLinear__GripAt(path, event) {
        if (!path) return -1;
        const local = Na__VegLinear__LocalPointer(event);
        const reach = Na__VegShell__Config().Vegetation__DevTools__Config.Vegetation__DevTools__GripRadiusPx + 3;
        const points = path.Vegetation__Path__PointsMm;
        for (let i = points.length - 1; i >= 0; i--) {
            const screen = Na__VegOverlay__ToScreen(points[i][0] / 1000, points[i][1] / 1000, points[i][2] / 1000);
            if (screen && Math.abs(screen.x - local.x) <= reach && Math.abs(screen.y - local.y) <= reach) return i;
        }
        return -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Far a Pointer Is from a Path's Line, in Pixels
    // ------------------------------------------------------------
    function Na__VegLinear__PixelsFromLine(path, event) {
        const local  = Na__VegLinear__LocalPointer(event);
        const points = Na__VegLinear__LineInMetres(path);
        let best = Infinity;
        let previous = null;
        points.forEach((p) => {
            const screen = Na__VegOverlay__ToScreen(p[0], p[1], p[2]);
            if (screen && previous) {
                const ex = screen.x - previous.x, ey = screen.y - previous.y;
                const lengthSq = ex * ex + ey * ey;
                const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((local.x - previous.x) * ex + (local.y - previous.y) * ey) / lengthSq)) : 0;
                const distance = Math.hypot(previous.x + ex * t - local.x, previous.y + ey * t - local.y);
                if (distance < best) best = distance;
            }
            previous = screen;
        });
        return best;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing a Path
// -----------------------------------------------------------------------------

    // FUNCTION | Start Drawing a New Path
    // ------------------------------------------------------------
    function Na__VegLinear__StartDrawing() {
        const state = Na__VegLinear__State;
        state.selectedUid = '';
        state.drawingUid  = '__armed__';                                       // <-- The path is made at the first click
        state.hoverPoint  = null;
        state.nextSeed    = Math.floor(Math.random() * Na__VegLinear__SEED_RANGE);
        Na__VegLinear__ReadMix(Na__VegLinear__Defaults().Vegetation__Path__PaletteUid);
        Na__VegLinear__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Recipes of a Mix, So Its Plants Can Be Shown Before Any Is Built
    // ------------------------------------------------------------
    function Na__VegLinear__ReadMix(paletteUid) {
        const unread = Na__VegRun__PaletteItems(paletteUid).filter((item) => !item.recipe);
        if (unread.length === 0) return;
        Promise.all(unread.map((item) => Na__VegRun__EnsureRecipe(item.assetId))).then(() => Na__VegTools__Repaint());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Plants the Next Click Would Add, Worked Out but Not Built
    // ------------------------------------------------------------
    // Adam, 11-Nov-2026: "show previews of the assets as you draw the line otherwise its hard to
    // understand what your doing". The path as it would be with the pointer as its next point, by
    // the same sums and seed as the real plants, so what is shown is what the click makes. Only
    // the plants the path does not have yet: the ones already built are on the model. Before the
    // first click, the path's first plant under the pointer (a path 1 mm long holds exactly it).
    // Returns { plants, line }: the line in metres, for the rubber band to follow a curve.
    // ------------------------------------------------------------
    function Na__VegLinear__Ghosts() {
        const state = Na__VegLinear__State;
        const none = { plants : [], line : null };
        if (!state.drawingUid || !state.hoverPoint) return none;
        const hoverMm = Na__VegLinear__ToMm(state.hoverPoint);
        const drawing = Na__VegLinear__Drawing();

        if (!drawing) {
            const ghost = Object.assign({}, Na__VegLinear__Defaults(), {
                Vegetation__Path__Uid          : '__ghost__',
                Vegetation__Path__PointsMm     : [hoverMm, [hoverMm[0] + 1, hoverMm[1], hoverMm[2]]],
                Vegetation__Path__Seed         : state.nextSeed || 1,
                Vegetation__Path__Curved       : false,
                Vegetation__Path__PlantChanges : null
            });
            return { plants : Na__VegRun__PathPlants(ghost).slice(0, 1), line : null };
        }

        const points = drawing.Vegetation__Path__PointsMm;
        if (points.length === 0) return none;
        const last = points[points.length - 1];
        if (last[0] === hoverMm[0] && last[1] === hoverMm[1] && last[2] === hoverMm[2]) return none;   // <-- Just clicked here
        const ghost = Object.assign({}, drawing, { Vegetation__Path__PointsMm : points.concat([hoverMm]) });
        const have  = new Set(Na__VegRun__PathPlants(drawing).map((plant) => plant.Vegetation__Plop__Uid));
        return {
            plants : Na__VegRun__PathPlants(ghost).filter((plant) => !have.has(plant.Vegetation__Plop__Uid)),
            line   : drawing.Vegetation__Path__Curved === true ? Na__VegLinear__LineInMetres(ghost) : null
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Path Being Drawn, or Null
    // ------------------------------------------------------------
    function Na__VegLinear__Drawing() {
        const uid = Na__VegLinear__State.drawingUid;
        if (!uid || uid === '__armed__') return null;
        return Na__VegData__FindPath(Na__VegRun__GetSceneData(), uid);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a New Point on the Path Being Drawn
    // ------------------------------------------------------------
    async function Na__VegLinear__AddPoint(point) {
        const state = Na__VegLinear__State;
        const sceneData = Na__VegRun__GetSceneData();
        let path = Na__VegLinear__Drawing();
        if (!path) {
            Na__VegShell__BeforeChange('');
            const defaults = Na__VegLinear__Defaults();
            const uid = Na__VegData__NextUid('P', sceneData.Vegetation__SceneData__Paths, 'Vegetation__Path__Uid');
            path = JSON.parse(JSON.stringify(defaults));                       // <-- Every parameter written, as the plan says
            path.Vegetation__Path__Uid      = uid;
            path.Vegetation__Path__Name     = 'Path ' + uid.replace(/^P0*/, '');
            path.Vegetation__Path__PointsMm = [];
            path.Vegetation__Path__Seed     = state.nextSeed || Math.floor(Math.random() * Na__VegLinear__SEED_RANGE);
            delete path.Vegetation__Path__PlantChanges;                        // <-- A new path of its own: another's plants changed by hand are not its
            path.Vegetation__Path__PaletteUid = defaults.Vegetation__Path__PaletteUid || await Na__VegPalUi__Ensure();
            sceneData.Vegetation__SceneData__Paths.push(path);
            state.drawingUid = uid;
        }
        path.Vegetation__Path__PointsMm.push(Na__VegLinear__ToMm(point));
        Na__VegShell__MarkChanged();
        Na__VegTools__Repaint();
        await Na__VegRun__PinInUse();
        await Na__VegRun__SyncPlants();
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish the Path Being Drawn
    // ------------------------------------------------------------
    // A path of one point draws nothing, and is not kept.
    // ------------------------------------------------------------
    async function Na__VegLinear__FinishDrawing() {
        const state = Na__VegLinear__State;
        const path = Na__VegLinear__Drawing();
        state.drawingUid = '';
        state.hoverPoint = null;
        if (path) {
            if (path.Vegetation__Path__PointsMm.length < 2) {
                const sceneData = Na__VegRun__GetSceneData();
                sceneData.Vegetation__SceneData__Paths = sceneData.Vegetation__SceneData__Paths.filter((row) => row !== path);
                await Na__VegRun__SyncPlants();
            } else {
                state.selectedUid = path.Vegetation__Path__Uid;
            }
        }
        Na__VegLinear__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // FUNCTION | Throw Away the Path Being Drawn
    // ------------------------------------------------------------
    async function Na__VegLinear__CancelDrawing() {
        const state = Na__VegLinear__State;
        const path = Na__VegLinear__Drawing();
        state.drawingUid = '';
        state.hoverPoint = null;
        if (path) {
            const sceneData = Na__VegRun__GetSceneData();
            sceneData.Vegetation__SceneData__Paths = sceneData.Vegetation__SceneData__Paths.filter((row) => row !== path);
            await Na__VegRun__SyncPlants();
        }
        Na__VegLinear__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Editing a Path
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Bring the Picture into Line After an Edit, and Say So
    // ------------------------------------------------------------
    async function Na__VegLinear__Changed() {
        Na__VegShell__MarkChanged();
        Na__VegTools__Repaint();
        await Na__VegRun__SyncPlants();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take a Point Out of the Selected Path
    // ------------------------------------------------------------
    async function Na__VegLinear__RemovePoint(index) {
        const path = Na__VegLinear__Selected();
        if (!path) return;
        Na__VegShell__BeforeChange('');
        path.Vegetation__Path__PointsMm.splice(index, 1);
        Na__VegLinear__State.hoverGrip = -1;
        if (path.Vegetation__Path__PointsMm.length < 2) {
            await Na__VegLinear__DeleteSelected(true);
            return;
        }
        await Na__VegLinear__Changed();
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Selected Path
    // ------------------------------------------------------------
    async function Na__VegLinear__DeleteSelected(alreadyRemembered) {
        const state = Na__VegLinear__State;
        const path = Na__VegLinear__Selected();
        if (!path) return;
        if (alreadyRemembered !== true) Na__VegShell__BeforeChange('');
        const sceneData = Na__VegRun__GetSceneData();
        sceneData.Vegetation__SceneData__Paths = sceneData.Vegetation__SceneData__Paths.filter((row) => row !== path);
        state.selectedUid = '';
        await Na__VegLinear__Changed();
        Na__VegLinear__PaintPanel();
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn the Selected Path into Single Plants
    // ------------------------------------------------------------
    // One way, with undo. They keep the path's uid as their stroke, so they can still be
    // taken out together from In This Project.
    // ------------------------------------------------------------
    async function Na__VegLinear__BakeSelected() {
        const state = Na__VegLinear__State;
        const path = Na__VegLinear__Selected();
        if (!path) return;
        Na__VegShell__BeforeChange('');
        const sceneData = Na__VegRun__GetSceneData();
        const plops = sceneData.Vegetation__SceneData__Plops;
        const stroke = Na__VegData__NextStrokeUid(plops);
        Na__VegRun__PathPlants(path).forEach((plant) => {
            const plop = {
                Vegetation__Plop__Uid        : Na__VegData__NextUid('A', plops, 'Vegetation__Plop__Uid'),
                Vegetation__Plop__AssetId    : plant.Vegetation__Plop__AssetId,
                Vegetation__Plop__Seed       : plant.Vegetation__Plop__Seed,
                Vegetation__Plop__PositionMm : plant.Vegetation__Plop__PositionMm,
                Vegetation__Plop__YawDeg     : plant.Vegetation__Plop__YawDeg,
                Vegetation__Plop__SizeMm     : plant.Vegetation__Plop__SizeMm,
                Vegetation__Plop__StrokeUid  : stroke
            };
            if (plant.Vegetation__Plop__Scale) plop.Vegetation__Plop__Scale = plant.Vegetation__Plop__Scale;
            if (plant.Vegetation__Plop__Ends) plop.Vegetation__Plop__Ends = plant.Vegetation__Plop__Ends;
            plops.push(plop);
        });
        sceneData.Vegetation__SceneData__Paths = sceneData.Vegetation__SceneData__Paths.filter((row) => row !== path);
        state.selectedUid = '';
        await Na__VegLinear__Changed();
        Na__VegLinear__PaintPanel();
        Na__VegShell__Toast('Baked into single plants: In This Project in the asset browser lists them as stroke ' + stroke + '.', false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tool on the Model
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Tool Itself
    // ------------------------------------------------------------
    const Na__VegLinear__Tool = {
        name : 'linear',

        onPress(event) {
            const state = Na__VegLinear__State;
            if (state.drawingUid) return false;                                // <-- Drawing takes plain clicks, so a drag still orbits
            const grip = Na__VegLinear__GripAt(Na__VegLinear__Selected(), event);
            if (grip < 0) return false;
            state.dragGrip    = grip;
            state.dragMoved   = false;
            state.dragProxies = null;
            return true;                                                       // <-- Taken: the orbit stands down until release
        },

        onDrag(event) {
            const state = Na__VegLinear__State;
            const path = Na__VegLinear__Selected();
            if (!path || state.dragGrip < 0) return;
            const held = path.Vegetation__Path__PointsMm[state.dragGrip];
            const point = Na__VegLinear__PointAt(event.clientX, event.clientY, held[1] / 1000);
            if (!point) return;
            if (!state.dragMoved) Na__VegShell__BeforeChange('');
            state.dragMoved = true;
            path.Vegetation__Path__PointsMm[state.dragGrip] = Na__VegLinear__ToMm(point);
            state.dragProxies = Na__VegRun__PathPlants(path);                  // <-- Sums only: the real plants draw on release
            Na__VegTools__Repaint();
        },

        onRelease() {
            const state = Na__VegLinear__State;
            const moved = state.dragMoved;
            state.dragGrip    = -1;
            state.dragMoved   = false;
            state.dragProxies = null;
            if (moved) Na__VegLinear__Changed();
        },

        onClick(event) {
            const state = Na__VegLinear__State;

            // DRAWING | A second click at the same spot straight after the first finishes
            if (state.drawingUid) {
                const now = performance.now();
                const config = Na__VegShell__Config().Vegetation__DevTools__Config;
                const again = (now - state.lastClickAt) < config.Vegetation__DevTools__DoubleClickMs
                    && Math.abs(event.clientX - state.lastClickX) <= config.Vegetation__DevTools__ClickThresholdPx
                    && Math.abs(event.clientY - state.lastClickY) <= config.Vegetation__DevTools__ClickThresholdPx;
                state.lastClickAt = now;
                state.lastClickX  = event.clientX;
                state.lastClickY  = event.clientY;
                if (again) {
                    Na__VegLinear__FinishDrawing();
                    return;
                }
                const drawing = Na__VegLinear__Drawing();
                const last = drawing && drawing.Vegetation__Path__PointsMm.length > 0 ? drawing.Vegetation__Path__PointsMm[drawing.Vegetation__Path__PointsMm.length - 1] : null;
                const point = Na__VegLinear__PointAt(event.clientX, event.clientY, last ? last[1] / 1000 : 0);
                if (point) Na__VegLinear__AddPoint(point);
                return;
            }

            // EDITING | On the selected path's line, a new point
            const config = Na__VegShell__Config().Vegetation__DevTools__Config;
            const selected = Na__VegLinear__Selected();
            if (selected && Na__VegLinear__PixelsFromLine(selected, event) <= config.Vegetation__DevTools__SegmentHitPx) {
                const point = Na__VegLinear__PointAt(event.clientX, event.clientY, selected.Vegetation__Path__PointsMm[0][1] / 1000);
                if (point) {
                    Na__VegShell__BeforeChange('');
                    const mm = Na__VegLinear__ToMm(point);
                    selected.Vegetation__Path__PointsMm.splice(Na__VegPath__InsertIndex(selected.Vegetation__Path__PointsMm, mm), 0, mm);
                    Na__VegLinear__Changed();
                }
                return;
            }

            // ANOTHER PATH'S LINE | Selects it. Nothing there lets go of what is selected.
            const paths = Na__VegRun__GetSceneData().Vegetation__SceneData__Paths;
            let found = '';
            paths.forEach((path) => {
                if (!found && Na__VegLinear__PixelsFromLine(path, event) <= config.Vegetation__DevTools__SegmentHitPx) found = path.Vegetation__Path__Uid;
            });
            state.selectedUid = found;
            Na__VegLinear__PaintPanel();
            Na__VegTools__Repaint();
        },

        onHover(event) {
            const state = Na__VegLinear__State;
            const now = performance.now();
            if (now - state.hoverAt < Na__VegLinear__HOVER_MS) {
                // THE LAST MOVE IS NEVER DROPPED | Or the band and the plants stop short of
                // where the pointer came to rest
                state.hoverLate = { clientX : event.clientX, clientY : event.clientY };
                if (!state.hoverTimer) {
                    state.hoverTimer = window.setTimeout(() => {
                        state.hoverTimer = 0;
                        const late = state.hoverLate;
                        state.hoverLate = null;
                        if (late && Na__VegTools__Current() === Na__VegLinear__Tool) Na__VegLinear__Tool.onHover(late);
                    }, Na__VegLinear__HOVER_MS);
                }
                return;
            }
            state.hoverAt = now;
            state.hoverLate = null;

            if (state.drawingUid) {
                const drawing = Na__VegLinear__Drawing();
                const points  = drawing ? drawing.Vegetation__Path__PointsMm : [];
                const levelM  = points.length > 0 ? points[points.length - 1][1] / 1000 : 0;   // <-- As the click would land
                state.hoverPoint = Na__VegLinear__PointAt(event.clientX, event.clientY, levelM);
                Na__VegTools__Repaint();
                return;
            }

            const grip = Na__VegLinear__GripAt(Na__VegLinear__Selected(), event);
            if (grip !== state.hoverGrip) {
                state.hoverGrip = grip;
                state.context.renderer.domElement.style.cursor = grip >= 0 ? 'move' : '';
                Na__VegTools__Repaint();
            }
        },

        onKey(event) {
            const state = Na__VegLinear__State;
            if (state.drawingUid) {
                if (event.key === 'Enter') {
                    Na__VegLinear__FinishDrawing();
                    return true;
                }
                if (event.key === 'Escape') {
                    Na__VegLinear__CancelDrawing();
                    return true;
                }
                if (event.key === 'Backspace') {
                    const drawing = Na__VegLinear__Drawing();
                    if (drawing && drawing.Vegetation__Path__PointsMm.length > 0) {
                        drawing.Vegetation__Path__PointsMm.pop();
                        Na__VegLinear__Changed();
                    }
                    return true;
                }
                return false;
            }
            if (event.key === 'Escape' && state.selectedUid) {
                state.selectedUid = '';
                Na__VegLinear__PaintPanel();
                Na__VegTools__Repaint();
                return true;
            }
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (state.hoverGrip >= 0) {
                    Na__VegLinear__RemovePoint(state.hoverGrip);
                    return true;
                }
                if (state.selectedUid) {
                    Na__VegLinear__DeleteSelected();
                    return true;
                }
            }
            return false;
        },

        paint(pen) {
            const state = Na__VegLinear__State;
            const sceneData = Na__VegRun__GetSceneData();
            const gripRadius = Na__VegShell__Config().Vegetation__DevTools__Config.Vegetation__DevTools__GripRadiusPx;

            sceneData.Vegetation__SceneData__Paths.forEach((path) => {
                const isSelected = path.Vegetation__Path__Uid === state.selectedUid;
                const isDrawing  = path.Vegetation__Path__Uid === state.drawingUid;
                pen.polyline(Na__VegLinear__LineInMetres(path), { colour : (isSelected || isDrawing) ? pen.LINE : pen.LINE_SOFT, width : (isSelected || isDrawing) ? 2.5 : 1.5 });
                if (isSelected || isDrawing) {
                    path.Vegetation__Path__PointsMm.forEach((p, index) => {
                        pen.grip([p[0] / 1000, p[1] / 1000, p[2] / 1000], gripRadius, index === state.hoverGrip || index === state.dragGrip);
                    });
                }
            });

            // THE PLANTS THE NEXT CLICK ADDS | Proxies at their real size, as a drag shows them
            const ghosts = Na__VegLinear__Ghosts();
            ghosts.plants.forEach((plant) => Na__VegRun__PaintProxy(pen, plant));

            // THE RUBBER BAND | From the last point to the pointer. A curved path bends as the
            // next point will bend it, so the band follows the whole curve it would make.
            const drawing = Na__VegLinear__Drawing();
            if (drawing && state.hoverPoint && drawing.Vegetation__Path__PointsMm.length > 0) {
                const last = drawing.Vegetation__Path__PointsMm[drawing.Vegetation__Path__PointsMm.length - 1];
                const band = ghosts.line || [[last[0] / 1000, last[1] / 1000, last[2] / 1000], [state.hoverPoint.x, state.hoverPoint.y, state.hoverPoint.z]];
                pen.polyline(band, { colour : pen.LINE, width : 1.5, dash : [6, 5] });
            }

            // MID-DRAG | Proxies, so nothing has to be built until it is let go
            if (state.dragProxies) {
                state.dragProxies.forEach((plant) => Na__VegRun__PaintProxy(pen, plant));
            }
        },

        onDisarm() {
            const state = Na__VegLinear__State;
            if (state.drawingUid) Na__VegLinear__FinishDrawing();
            state.context.renderer.domElement.style.cursor = '';
            state.hoverGrip = -1;
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Panel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Keep Drawing's Cursor Honest
    // ------------------------------------------------------------
    function Na__VegLinear__SetCursor() {
        const state = Na__VegLinear__State;
        if (Na__VegTools__Current() !== Na__VegLinear__Tool) return;
        state.context.renderer.domElement.style.cursor = state.drawingUid ? 'crosshair' : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write One of the Panel's Rules, on a Path or for the Next One
    // ------------------------------------------------------------
    function Na__VegLinear__WriteRule(block, key, value, label) {
        const isPath = Na__VegLinear__Selected() !== null;
        Na__VegShell__BeforeChange(label || key);
        block[key] = value;
        Na__VegShell__MarkChanged();
        if (isPath) {
            Na__VegTools__Repaint();
            Na__VegRun__SyncPlants();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Panel's Rows for the Selected Path, or for the Next One
    // ------------------------------------------------------------
    function Na__VegLinear__PaintPanel() {
        const state = Na__VegLinear__State;
        const body = state.body;
        Na__VegLinear__SetCursor();
        if (!body) return;
        if (state.unmountPal) { state.unmountPal(); state.unmountPal = null; }
        body.textContent = '';

        const selected = Na__VegLinear__Selected();
        const rules    = Na__VegLinear__Rules();
        const advanced = rules.Vegetation__Path__Advanced;

        // THE ONE BIG BUTTON | Draw, or how to stop drawing
        const drawRow = Na__VegShell__El('div', 'na-veg-row');
        if (state.drawingUid) {
            drawRow.appendChild(Na__VegShell__Button('Finish Path', 'na-veg-btn--strong', Na__VegLinear__FinishDrawing, 'Enter, or a double click on the model'));
            drawRow.appendChild(Na__VegShell__Button('Cancel', '', Na__VegLinear__CancelDrawing, 'Escape'));
        } else {
            const draw = Na__VegShell__Button('Draw New Path', 'na-veg-btn--strong', Na__VegLinear__StartDrawing);
            draw.id = 'naVegetationLinearDraw';
            drawRow.appendChild(draw);
            drawRow.appendChild(Na__SceneInfo__Tip(selected
                ? 'Drag a grip to move a point, click the line to add one, Delete on a grip to take it out.'
                : 'Click a path on the model to edit it. These rows are what the next path starts from.', 'How to use the Line Tool'));
            drawRow.classList.add('na-scene-info-row');
        }
        body.appendChild(drawRow);

        if (state.drawingUid) {                                                // <-- While drawing, what the clicks do stays in view: the rest is the (i)'s
            body.appendChild(Na__VegShell__El('p', 'na-veg-panel__hint', 'Click along the planter. Outlines show the plants the next click adds, and they grow as you go. Enter or a double click finishes, Backspace takes back a point.'));
        }

        if (selected) {
            body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'This path'));
            const name = Na__VegShell__El('input', 'na-veg-field');
            name.type = 'text';
            name.value = selected.Vegetation__Path__Name || '';
            name.setAttribute('aria-label', 'Path name');
            name.addEventListener('change', () => {
                Na__VegShell__BeforeChange('');
                selected.Vegetation__Path__Name = name.value.trim() || selected.Vegetation__Path__Name;
                Na__VegShell__MarkChanged();
            });
            body.appendChild(name);
            const count = Na__VegRun__PathPlants(selected).length;
            const line = Na__VegPath__Line(selected.Vegetation__Path__PointsMm, selected.Vegetation__Path__Curved === true);
            const facts = Na__VegShell__El('p', 'na-veg-panel__hint', count + (count === 1 ? ' plant' : ' plants') + ' along ' + (line.total / 1000).toFixed(1) + ' m.');
            facts.style.marginTop = '4px';
            body.appendChild(facts);
        }

        // THE MAIN PARAMETERS
        body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Layout'));
        const spacing = Na__VegShell__Slider({
            label   : 'Spacing',
            min     : 300,
            max     : 4000,
            step    : 50,
            value   : rules.Vegetation__Path__SpacingMm,
            format  : (value) => Math.round(value) + ' mm',
            onInput : (value) => Na__VegLinear__WriteRule(rules, 'Vegetation__Path__SpacingMm', value)
        });
        const plantScale = Na__VegShell__PlantScaleSlider({
            value   : rules.Vegetation__Path__PlantScale,
            title   : 'The whole plant: 0.50 is half the size in every way. Spacing follows, so the bed stays as full.',
            onInput : (value) => {
                Na__VegShell__BeforeChange('plant-scale');
                Na__VegPath__SetPlantScale(rules, value);
                spacing.setValue(rules.Vegetation__Path__SpacingMm);
                Na__VegShell__MarkChanged();
                if (selected) {
                    Na__VegTools__Repaint();
                    Na__VegRun__SyncPlants();
                }
            }
        });
        body.appendChild(plantScale.row);
        body.appendChild(spacing.row);

        const shapeRow = Na__VegShell__El('div', 'na-veg-row na-veg-row--between');
        shapeRow.appendChild(Na__VegShell__Choice([['straight', 'Straight'], ['curved', 'Curved']], rules.Vegetation__Path__Curved ? 'curved' : 'straight', (value) => {
            Na__VegLinear__WriteRule(rules, 'Vegetation__Path__Curved', value === 'curved', 'curved');
        }).row);
        if (selected) {
            shapeRow.appendChild(Na__VegShell__Button('New Seed', '', () => {
                Na__VegShell__BeforeChange('');
                selected.Vegetation__Path__Seed = Math.floor(Math.random() * Na__VegLinear__SEED_RANGE);
                delete selected.Vegetation__Path__PlantChanges;                // <-- Different plants: a change by hand was to one that is no longer there
                Na__VegLinear__Changed();
            }, 'The same rules, different plants'));
        }
        body.appendChild(shapeRow);

        // THE MIX
        body.appendChild(Na__VegShell__El('div', 'na-veg-panel__section', 'Mix'));
        const mix = Na__VegShell__El('div', '');
        body.appendChild(mix);
        if (rules.Vegetation__Path__PaletteUid) Na__VegPalUi__SetCurrentUid(rules.Vegetation__Path__PaletteUid);
        Na__VegPalUi__Mount({
            holder : mix,
            onPick : (paletteUid, layout) => {
                if (!layout) {
                    Na__VegLinear__WriteRule(rules, 'Vegetation__Path__PaletteUid', paletteUid, 'palette');
                    return;
                }
                // A STANDARD PALETTE | Its mix comes with the plant scale and spacing it was proven at
                Na__VegShell__BeforeChange('palette');
                rules.Vegetation__Path__PaletteUid = paletteUid;
                rules.Vegetation__Path__PlantScale = layout.plantScale;
                rules.Vegetation__Path__SpacingMm  = layout.spacingMm;
                Na__VegShell__MarkChanged();
                Na__VegLinear__PaintPanel();                                   // <-- The Layout sliders show the new scale and spacing
                if (Na__VegLinear__Selected()) {
                    Na__VegTools__Repaint();
                    Na__VegRun__SyncPlants();
                }
            }
        }).then((unmount) => { state.unmountPal = unmount; });

        // THE ADVANCED DROPDOWN | Adam: "add advanced parameters dropdown"
        const details = Na__VegShell__El('details', 'na-veg-advanced');
        details.appendChild(Na__VegShell__El('summary', 'na-veg-advanced__title', 'Advanced'));
        Na__VegLinear__ADVANCED.forEach((spec) => {
            details.appendChild(Na__VegShell__Slider({
                label   : spec.Label,
                title   : spec.Title,
                min     : spec.Min,
                max     : spec.Max,
                step    : spec.Step,
                value   : advanced[spec.Key] || 0,                             // <-- A path saved before a rule existed has none of it
                format  : (value) => Math.round(value) + spec.Unit,
                onInput : (value) => Na__VegLinear__WriteRule(advanced, spec.Key, value)
            }).row);
        });
        details.appendChild(Na__VegShell__Tick('Align to path', advanced.Vegetation__PathAdvanced__AlignToPath !== false, (checked) => {
            Na__VegLinear__WriteRule(advanced, 'Vegetation__PathAdvanced__AlignToPath', checked, 'align');
        }, 'A long plant keeps its long side along the path. Round plants always turn freely.').row);
        details.appendChild(Na__VegShell__Tick('Fit last plant', advanced.Vegetation__PathAdvanced__FitLastPlant !== false, (checked) => {
            Na__VegLinear__WriteRule(advanced, 'Vegetation__PathAdvanced__FitLastPlant', checked, 'fit');
        }, 'Shares the length out so plants fill the path from end to end.').row);
        body.appendChild(details);

        if (selected) {
            const actions = Na__VegShell__El('div', 'na-veg-row');
            actions.appendChild(Na__VegShell__Button('Bake to Plants', '', Na__VegLinear__BakeSelected, 'Turns this path into single plants for hand editing. One way, with undo.'));
            actions.appendChild(Na__VegShell__Button('Delete Path', 'na-veg-btn--danger', () => Na__VegLinear__DeleteSelected()));
            body.appendChild(actions);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Undo Replaced the Object: Read It Again
    // ------------------------------------------------------------
    function Na__VegLinear__OnObjectReplaced() {
        const state = Na__VegLinear__State;
        if (state.selectedUid && !Na__VegLinear__Selected()) state.selectedUid = '';
        if (state.drawingUid && state.drawingUid !== '__armed__' && !Na__VegLinear__Drawing()) state.drawingUid = '';
        Na__VegLinear__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop What the Panel Was Doing
    // ------------------------------------------------------------
    function Na__VegLinear__OnClose() {
        const state = Na__VegLinear__State;
        if (state.unmountPal) { state.unmountPal(); state.unmountPal = null; }
        state.body = null;
        window.removeEventListener('na-vegetation-object-replaced', Na__VegLinear__OnObjectReplaced);
        if (Na__VegTools__Current() === Na__VegLinear__Tool) Na__VegTools__Disarm();
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Tool's Rows into Its Section, and Arm It on the Model
    // ------------------------------------------------------------
    // Called by the Vegetation panel when its Line Tool section opens. Returns what stops it.
    // ------------------------------------------------------------
    async function Na__VegLinear__Mount(context, holder) {
        await Na__VegShell__Prepare(context);
        await Na__VegTools__Prepare(context);
        const state = Na__VegLinear__State;
        state.context = context;

        await Na__VegPalUi__Ensure();
        const defaults = Na__VegLinear__Defaults();
        if (!defaults.Vegetation__Path__PaletteUid) defaults.Vegetation__Path__PaletteUid = await Na__VegPalUi__Ensure();

        state.body = holder;
        window.removeEventListener('na-vegetation-object-replaced', Na__VegLinear__OnObjectReplaced);
        window.addEventListener('na-vegetation-object-replaced', Na__VegLinear__OnObjectReplaced);
        if (Na__VegTools__Current() !== Na__VegLinear__Tool) Na__VegTools__Arm(Na__VegLinear__Tool);
        Na__VegLinear__PaintPanel();
        return () => {
            if (state.body === holder) Na__VegLinear__OnClose();
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Vegetation Panel on the Line Tool
    // ------------------------------------------------------------
    async function Na__VegLinear__Open(context) {
        const panel = await import('../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js');
        await panel.Na__VegCards__OpenOn(context, 'line');
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Line Tool, or Fold It If It Is Open
    // ------------------------------------------------------------
    async function Na__VegLinear__Toggle(context) {
        const panel = await import('../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js');
        if (panel.Na__VegCards__CurrentSection() === 'line') {
            panel.Na__VegCards__FoldSection('line');
            return;
        }
        await Na__VegLinear__Open(context);
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel Ready to Draw from a Palette
    // ------------------------------------------------------------
    // A card's Draw Path: the next click on the model starts a path of that palette.
    // ------------------------------------------------------------
    async function Na__VegLinear__DrawWith(context, paletteUid) {
        const state = Na__VegLinear__State;
        state.selectedUid = '';
        await Na__VegLinear__Open(context);
        Na__VegLinear__Defaults().Vegetation__Path__PaletteUid = paletteUid;
        Na__VegLinear__StartDrawing();
    }
    // ------------------------------------------------------------


    // FUNCTION | Open the Panel with a Path Selected
    // ------------------------------------------------------------
    async function Na__VegLinear__OpenOn(context, pathUid) {
        Na__VegLinear__State.selectedUid = pathUid;
        await Na__VegLinear__Open(context);
        Na__VegLinear__PaintPanel();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Linear Tool API
    // ------------------------------------------------------------
    export {
        Na__VegLinear__Mount,
        Na__VegLinear__Toggle,
        Na__VegLinear__OpenOn,
        Na__VegLinear__DrawWith
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
