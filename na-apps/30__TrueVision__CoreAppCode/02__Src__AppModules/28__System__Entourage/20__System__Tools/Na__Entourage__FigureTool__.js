// =============================================================================
// TRUEVISION3D - ENTOURAGE - THE FIGURE TOOL
// =============================================================================
//
// FILE       : Na__Entourage__FigureTool__.js
// NAMESPACE  : Na__EntTool
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Drop figures on the model, move them about, show the ring under what is
//              being worked on, and open the right-click menu
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - Adam, 05-Nov-2026: "Add a felxible drag drop and move around system like used on my NPR
//   Renderer system and Project AURA, so show a ring under the asset when its being interacted
//   with and ensure right click allows for delete / replace". NPR's gesture, with more: its ring
//   shows only while carrying and a drag on a plop still orbits. Here the ring shows on hover,
//   on the selected figure and while carrying, and a press on a figure moves it.
// - ONLY WHILE THE ENTOURAGE ASSETS PANEL IS OPEN (Adam's answer, as NPR's drawer). With it closed
//   the model behaves as normal and nobody gets moved by accident.
// - THE GESTURES:
//     A card dragged onto the model  : a figure follows the pointer, and lands on release.
//     A card clicked                 : arms it, for a click on the model. Escape or the card stops.
//     A press on a figure, then a drag: moves it. A press and release selects it.
//     A press anywhere else          : orbits, as ever.
//     M, on the selected figure      : carried with no press, as NPR's. A click lands it.
//     Ctrl+D, Delete, Escape         : copy beside it, delete, let go.
//     A right-click on a figure      : ./Na__Entourage__FigureMenu__.js.
// - IT LANDS ON THE REAL SURFACE, by the plants' BVH pick, only on what faces up, so a drag over a
//   wall keeps it on the last good spot. Past the edge of the model it stays at its own height.
// - A CARRIED FIGURE IS DRAWN ON THE 2D CANVAS OVER THE MODEL, with its ring, and left out of the
//   scene until it lands. So a drag costs no render of the model, and it can never print.
// - THE PLANTS' TOOL HOST, OVERLAY AND PICK, not a second set: only one tool may have the clicks,
//   and a door behind a figure must not swing. Those three import nothing that needs plants to
//   be on, beyond reading the plants' config once.
//
// FRAMES:
// - Picks are world metres, Y up. Saved positions are integer mm in three.js axes: converted
//   once, here, on the way into the record. A figure has no turn to save.
//
// INTEGRATION:
// - Started by ../10__Ui__Panels/Na__Entourage__AssetBrowser__.js when its panel opens.
// - @delegate: ../../24__System__Vegetation/20__System__Tools/Na__Vegetation__ToolHost__.js
// - @delegate: ../../24__System__Vegetation/20__System__Tools/Na__Vegetation__SurfacePick__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/20__System__Tools/Na__Entourage__FigureTool__.js (ValeVision3D v2.98.6)
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
// 11-Nov-2026 - Version 1.3.0 (ValeVision3D v2.96.0)
// - The right-click menu says who added the figure and when, and who changed it last.
//
// 11-Nov-2026 - Version 1.2.0 (ValeVision3D v2.95.0)
// - WriteHeightStretch (Jamesification). A carry, its outline and a copy keep the stretch.
//
// 05-Nov-2026 - Version 1.1.0 (ValeVision3D v2.89.0)
// - Hands the right-click menu how to draw its pictures, as that menu now serves plants too.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Plants' Tool Host and Pick
    // ------------------------------------------------------------
    import {
        Na__VegTools__Prepare,
        Na__VegTools__Arm,
        Na__VegTools__Current,
        Na__VegTools__Repaint,
        Na__VegTools__SetFallback
    } from '../../24__System__Vegetation/20__System__Tools/Na__Vegetation__ToolHost__.js';
    import {
        Na__VegPick__AtPointer,
        Na__VegPick__RayAt,
        Na__VegPick__OnLevel
    } from '../../24__System__Vegetation/20__System__Tools/Na__Vegetation__SurfacePick__.js';
    import { Na__VegOverlay__ToScreen } from '../../24__System__Vegetation/20__System__Tools/Na__Vegetation__ToolOverlay__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The App, Entourage's Data and the Menu
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__DrawView__GetCamera } from '../../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__KeyScope__Is, Na__KeyScope__MODEL } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    import { Na__EntData__NextUid, Na__EntData__FindFigure, Na__EntData__Work, Na__EntData__IsOnServer } from '../02__Core__Data/Na__Entourage__SceneData__.js';
    import { Na__SceneChanges__OwnerLines } from '../../22__System__SceneAssets/Na__SceneAssets__ChangesPanel__.js';
    import {
        Na__EntRun__GetLayer,
        Na__EntRun__GetSceneData,
        Na__EntRun__EnsureRecipe,
        Na__EntRun__SyncFigures,
        Na__EntRun__PinInUse,
        Na__EntRun__SizeOf
    } from '../03__System__SceneLayer/Na__Entourage__Runtime__.js';
    import {
        Na__EntShell__BeforeChange,
        Na__EntShell__MarkChanged,
        Na__EntShell__Config,
        Na__EntShell__Toast
    } from '../10__Ui__Panels/Na__Entourage__PanelShell__.js';
    import { Na__EntPopup__Open, Na__EntPopup__Close, Na__EntPopup__IsOpen } from '../10__Ui__Panels/Na__Entourage__FigureMenu__.js';
    import { Na__EntPic__Draw } from '../10__Ui__Panels/Na__Entourage__FigurePicture__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Seed's Range, and How Far Off a Line Still Takes a Figure
    // ------------------------------------------------------------
    const Na__EntTool__SEED_RANGE      = 1000000000;
    const Na__EntTool__PICK_TOLERANCE_PX = 3;
    const Na__EntTool__MENU_GAP_PX     = 14;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Going On
    // ------------------------------------------------------------
    const Na__EntTool__State = {
        context    : null,
        running    : false,
        hooks      : {},                                                       // <-- { onChanged(), onPicked(), catalogue(), recipeOf(assetId) } from the asset browser
        hoverUid   : '',
        hoverPoint : null,                                                     // <-- Where an armed card would land, under the pointer
        selectedUid: '',
        armedId    : '',                                                       // <-- A card clicked: the next click on the model drops one
        carry      : null,                                                     // <-- { mode : 'drag'|'key'|'card', uid, assetId, scale, seed, point : [x,y,z] m, lastY }
        press      : null,                                                     // <-- A press on a figure not yet travelled far enough to be a move: { uid, x, y }
        hoverAt    : 0,
        hoverTimer : 0,
        rightAt    : null,
        previewId  : '',                                                       // <-- A picture rested on in the menu: drawn standing where the figure is
        ghost      : null
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTIONS | The Config's Blocks
    // ------------------------------------------------------------
    function Na__EntTool__Dev() {
        return Na__EntShell__Config().Entourage__DevTools__Config;
    }
    function Na__EntTool__Ring() {
        return Na__EntShell__Config().Entourage__Ring__Config;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Panel Something Changed, and Draw the Aids Again
    // ------------------------------------------------------------
    function Na__EntTool__Say() {
        if (Na__EntTool__State.hooks.onChanged) Na__EntTool__State.hooks.onChanged();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the 3D View What Is on Screen, and Is This Tool on the Model?
    // ------------------------------------------------------------
    function Na__EntTool__HasTheClicks() {
        return Na__EntTool__State.running
            && Na__VegTools__Current() === Na__EntTool__Tool
            && !Na__DrawView__GetCamera()
            && Na__KeyScope__Is(Na__KeyScope__MODEL);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cursor for What a Press Would Do
    // ------------------------------------------------------------
    function Na__EntTool__SetCursor() {
        const state = Na__EntTool__State;
        const canvas = state.context.renderer.domElement;
        if (state.carry && state.carry.mode !== 'card') canvas.style.cursor = 'grabbing';
        else if (state.armedId || (state.carry && state.carry.mode === 'card')) canvas.style.cursor = 'crosshair';
        else canvas.style.cursor = state.hoverUid ? 'grab' : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Figure Under the Pointer, or an Empty Uid
    // ------------------------------------------------------------
    // Nothing behind the model counts: a figure out of sight through a wall is not there to take.
    // ------------------------------------------------------------
    function Na__EntTool__FigureAt(event) {
        const ray = Na__VegPick__RayAt(event.clientX, event.clientY);
        const layer = Na__EntRun__GetLayer();
        if (!ray || !layer) return '';
        const { camera, renderer } = Na__EntTool__State.context;
        const heightPx = renderer.domElement.getBoundingClientRect().height || 1;
        const perM = camera.isOrthographicCamera ? 0 : (2 * Math.tan((camera.fov * Math.PI) / 360) * Na__EntTool__PICK_TOLERANCE_PX) / (heightPx * camera.zoom);
        const hit = layer.pick(ray.origin, ray.direction, perM);
        if (!hit) return '';
        const surface = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (surface && surface.point.distanceTo(ray.origin) < hit.distanceM - 0.02) return '';
        return hit.uid;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Figure Would Stand Under the Pointer, or Null
    // ------------------------------------------------------------
    // On what faces up, or at lastY past the edge of the model. A wall gives null, and the caller
    // keeps the last good spot.
    // ------------------------------------------------------------
    function Na__EntTool__SpotAt(event, lastY) {
        const hit = Na__VegPick__AtPointer(event.clientX, event.clientY);
        if (hit) {
            const needs = Math.cos((Na__EntTool__Dev().Entourage__DevTools__MaxPlaceSlopeDeg * Math.PI) / 180);
            return hit.normal.y >= needs ? [hit.point.x, hit.point.y, hit.point.z] : null;
        }
        if (!Number.isFinite(lastY)) return null;
        const onLevel = Na__VegPick__OnLevel(event.clientX, event.clientY, lastY);
        return onLevel ? [onLevel.x, onLevel.y, onLevel.z] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Spot as the Record Holds It: Integer Mm
    // ------------------------------------------------------------
    function Na__EntTool__ToMm(point) {
        return point.map((metres) => Math.round(metres * 1000));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Figure's Scale. Exactly 1 Is the Same as None
    // ------------------------------------------------------------
    function Na__EntTool__WriteScale(figure, value) {
        if (value === 1) delete figure.Entourage__Figure__Scale;
        else figure.Entourage__Figure__Scale = value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Figure's Height Stretch (Jamesification). Exactly 1 Is the Same as None
    // ------------------------------------------------------------
    function Na__EntTool__WriteHeightStretch(figure, value) {
        if (!(value > 1)) delete figure.Entourage__Figure__HeightStretch;
        else figure.Entourage__Figure__HeightStretch = value;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Changing What Is in the Project
// -----------------------------------------------------------------------------

    // FUNCTION | The Selected Figure's Saved Record, or Null
    // ------------------------------------------------------------
    function Na__EntTool__SelectedFigure() {
        const uid = Na__EntTool__State.selectedUid;
        return uid ? Na__EntData__FindFigure(Na__EntRun__GetSceneData(), uid) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Select a Figure, or Nothing
    // ------------------------------------------------------------
    function Na__EntTool__Select(uid) {
        Na__EntTool__State.selectedUid = uid || '';
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A New Figure in the Object: Selected, and Its Asset Pinned
    // ------------------------------------------------------------
    async function Na__EntTool__AddFigure(assetId, positionMm, scale) {
        const sceneData = Na__EntRun__GetSceneData();
        Na__EntShell__BeforeChange('');
        const figure = {
            Entourage__Figure__Uid        : Na__EntData__NextUid(sceneData.Entourage__SceneData__Figures),
            Entourage__Figure__AssetId    : assetId,
            Entourage__Figure__Seed       : Math.floor(Math.random() * Na__EntTool__SEED_RANGE),
            Entourage__Figure__PositionMm : positionMm
        };
        Na__EntTool__WriteScale(figure, scale);
        sceneData.Entourage__SceneData__Figures.push(figure);
        Na__EntShell__MarkChanged();
        await Na__EntRun__PinInUse();
        await Na__EntRun__SyncFigures();
        Na__EntTool__State.selectedUid = figure.Entourage__Figure__Uid;
        Na__EntTool__Say();
        return figure;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Scale the Next Card Drops At
    // ------------------------------------------------------------
    function Na__EntTool__PlaceScale() {
        const place = Na__EntRun__GetSceneData().Entourage__SceneData__Tools.Entourage__Tools__Place;
        return place.Entourage__Place__Scale > 0 ? place.Entourage__Place__Scale : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete the Selected Figure
    // ------------------------------------------------------------
    async function Na__EntTool__RemoveSelected() {
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;
        const sceneData = Na__EntRun__GetSceneData();
        Na__EntShell__BeforeChange('');
        sceneData.Entourage__SceneData__Figures = sceneData.Entourage__SceneData__Figures.filter((row) => row !== figure);
        Na__EntTool__State.selectedUid = '';
        Na__EntTool__State.hoverUid = '';
        Na__EntShell__MarkChanged();
        await Na__EntRun__SyncFigures();
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy the Selected Figure Beside Itself
    // ------------------------------------------------------------
    // To its right as seen from here, on whatever is really there. A new seed, so it is drawn its own way.
    // ------------------------------------------------------------
    async function Na__EntTool__CopySelected() {
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;
        const e = Na__EntTool__State.context.camera.matrixWorld.elements;
        const across = Na__EntTool__Dev().Entourage__DevTools__CopyOffsetMm;
        const position = figure.Entourage__Figure__PositionMm;
        await Na__EntTool__AddFigure(figure.Entourage__Figure__AssetId, [
            Math.round(position[0] + e[0] * across),
            position[1],
            Math.round(position[2] + e[2] * across)
        ], figure.Entourage__Figure__Scale > 0 ? figure.Entourage__Figure__Scale : 1);
        const copy = Na__EntTool__SelectedFigure();                            // <-- The copy is selected now: it keeps the original's stretch
        if (copy && copy !== figure && figure.Entourage__Figure__HeightStretch > 1) {
            Na__EntTool__WriteHeightStretch(copy, figure.Entourage__Figure__HeightStretch);
            await Na__EntRun__SyncFigures();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Make the Selected Figure Bigger or Smaller by a Factor
    // ------------------------------------------------------------
    async function Na__EntTool__ScaleSelected(factor) {
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;
        const dev = Na__EntTool__Dev();
        const was = figure.Entourage__Figure__Scale > 0 ? figure.Entourage__Figure__Scale : 1;
        const now = Math.max(dev.Entourage__DevTools__ScaleMin, Math.min(dev.Entourage__DevTools__ScaleMax, Math.round(was * factor * 100) / 100));
        if (now === was) return;
        Na__EntShell__BeforeChange('');
        Na__EntTool__WriteScale(figure, now);
        Na__EntShell__MarkChanged();
        await Na__EntRun__SyncFigures();
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Swap the Selected Figure for Another Character
    // ------------------------------------------------------------
    // It keeps its spot, its Uid, its seed and its scale. Only who it is changes.
    // ------------------------------------------------------------
    async function Na__EntTool__SwapSelected(assetId) {
        const figure = Na__EntTool__SelectedFigure();
        if (!figure || figure.Entourage__Figure__AssetId === assetId) return;
        Na__EntShell__BeforeChange('');
        figure.Entourage__Figure__AssetId = assetId;
        Na__EntShell__MarkChanged();
        await Na__EntRun__PinInUse();
        await Na__EntRun__SyncFigures();
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Carrying
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Stop Carrying, and Bring the Figure Back into the Scene
    // ------------------------------------------------------------
    function Na__EntTool__EndCarry() {
        const state = Na__EntTool__State;
        state.carry = null;
        const layer = Na__EntRun__GetLayer();
        if (layer) layer.setHiddenUid('');
        Na__EntTool__SetCursor();
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start Carrying a Figure Already Placed
    // ------------------------------------------------------------
    function Na__EntTool__CarryFigure(figure, mode) {
        const state = Na__EntTool__State;
        const position = figure.Entourage__Figure__PositionMm;
        state.carry = {
            mode,
            uid     : figure.Entourage__Figure__Uid,
            assetId : figure.Entourage__Figure__AssetId,
            seed    : figure.Entourage__Figure__Seed,
            scale   : figure.Entourage__Figure__Scale > 0 ? figure.Entourage__Figure__Scale : 1,
            stretch : figure.Entourage__Figure__HeightStretch > 0 ? figure.Entourage__Figure__HeightStretch : 1,
            point   : position.map((mm) => mm / 1000),
            lastY   : position[1] / 1000
        };
        Na__EntRun__GetLayer().setHiddenUid(figure.Entourage__Figure__Uid);
        Na__RenderLoop__RequestRender();                                       // <-- One render to take it out: the rest of the carry costs none
        Na__EntTool__SetCursor();
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Follow the Pointer with What Is Being Carried
    // ------------------------------------------------------------
    function Na__EntTool__FollowPointer(event) {
        const carry = Na__EntTool__State.carry;
        if (!carry) return;
        const spot = Na__EntTool__SpotAt(event, carry.lastY);
        if (spot) {
            carry.point = spot;
            carry.lastY = spot[1];
        }
        Na__VegTools__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land What Is Being Carried
    // ------------------------------------------------------------
    async function Na__EntTool__LandCarry() {
        const state = Na__EntTool__State;
        const carry = state.carry;
        if (!carry) return;
        const figure = carry.uid ? Na__EntData__FindFigure(Na__EntRun__GetSceneData(), carry.uid) : null;
        const point = carry.point;
        Na__EntTool__EndCarry();
        if (figure && point) {
            Na__EntShell__BeforeChange('');
            figure.Entourage__Figure__PositionMm = Na__EntTool__ToMm(point);
            Na__EntShell__MarkChanged();
        }
        await Na__EntRun__SyncFigures();
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Carry the Selected Figure, With No Press: NPR's M
    // ------------------------------------------------------------
    function Na__EntTool__CarrySelected() {
        const figure = Na__EntTool__SelectedFigure();
        if (figure) Na__EntTool__CarryFigure(figure, 'key');
    }
    // ------------------------------------------------------------


    // FUNCTION | Arm a Card, or Disarm It If It Is Armed
    // ------------------------------------------------------------
    function Na__EntTool__ArmCard(assetId) {
        const state = Na__EntTool__State;
        state.armedId = state.armedId === assetId ? '' : assetId;
        if (state.armedId) Na__EntRun__EnsureRecipe(assetId);
        Na__EntTool__SetCursor();
        Na__EntTool__Say();
    }
    function Na__EntTool__ArmedId() {
        return Na__EntTool__State.armedId;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Card Has Been Dragged Far Enough to Be a Drag
    // ------------------------------------------------------------
    // thumbnail: a canvas to follow the pointer until it is over the model.
    // ------------------------------------------------------------
    async function Na__EntTool__BeginCardDrag(assetId, event, thumbnail) {
        const state = Na__EntTool__State;
        state.armedId = '';
        Na__EntRun__EnsureRecipe(assetId);
        state.carry = {
            mode    : 'card',
            uid     : '',
            assetId,
            seed    : 1,
            scale   : Na__EntTool__PlaceScale(),
            point   : null,
            lastY   : null,
            over    : false
        };
        const ghost = document.createElement('div');
        ghost.className = 'na-ent-ghost';
        if (thumbnail) ghost.appendChild(thumbnail);
        document.body.appendChild(ghost);
        state.ghost = ghost;
        Na__EntTool__MoveCardDrag(event);
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | A Card Being Dragged Has Moved
    // ------------------------------------------------------------
    function Na__EntTool__MoveCardDrag(event) {
        const state = Na__EntTool__State;
        const carry = state.carry;
        if (!carry || carry.mode !== 'card') return;
        const canvas = state.context.renderer.domElement;
        const under = document.elementFromPoint(event.clientX, event.clientY);
        carry.over = under === canvas && !Na__DrawView__GetCamera();
        if (state.ghost) {
            state.ghost.style.display = carry.over ? 'none' : '';              // <-- Over the model the figure itself takes over
            state.ghost.style.left = event.clientX + 'px';
            state.ghost.style.top  = event.clientY + 'px';
        }
        if (!carry.over) {
            carry.point = null;
            Na__VegTools__Repaint();
            return;
        }
        const now = performance.now();
        if (now - state.hoverAt < Na__EntTool__Dev().Entourage__DevTools__HoverMs) return;
        state.hoverAt = now;
        Na__EntTool__FollowPointer(event);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Card Being Dragged Has Been Let Go
    // ------------------------------------------------------------
    async function Na__EntTool__EndCardDrag(event) {
        const state = Na__EntTool__State;
        const carry = state.carry;
        if (!carry || carry.mode !== 'card') return;
        if (carry.over) Na__EntTool__FollowPointer(event);
        const point = carry.over ? carry.point : null;
        const assetId = carry.assetId, scale = carry.scale, over = carry.over;
        if (state.ghost) { state.ghost.remove(); state.ghost = null; }
        Na__EntTool__EndCarry();
        if (point) await Na__EntTool__AddFigure(assetId, Na__EntTool__ToMm(point), scale);
        else if (over) Na__EntShell__Toast('That spot does not face up. Try the ground, a terrace or a step.', true);
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let Go of a Card Being Dragged, Dropping Nothing
    // ------------------------------------------------------------
    function Na__EntTool__CancelCarry() {
        const state = Na__EntTool__State;
        if (state.ghost) { state.ghost.remove(); state.ghost = null; }
        Na__EntTool__EndCarry();
        Na__EntTool__Say();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Right-Click Menu
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open the Menu on the Selected Figure
    // ------------------------------------------------------------
    function Na__EntTool__OpenMenu(x, y) {
        const state = Na__EntTool__State;
        const figure = Na__EntTool__SelectedFigure();
        if (!figure) return;
        const dev = Na__EntTool__Dev();
        const step = dev.Entourage__DevTools__MenuScaleStep;
        const percent = Math.round((step - 1) * 100);
        const catalogue = state.hooks.catalogue ? state.hooks.catalogue() : [];
        const here = catalogue.find((row) => row.Asset__Id === figure.Entourage__Figure__AssetId);

        // BESIDE THE FIGURE, NOT OVER IT | Resting on a picture shows that character standing
        // there, which is no use under the menu. To its right as seen from here.
        const e = state.context.camera.matrixWorld.elements;
        const size = Na__EntRun__SizeOf(figure);
        const position = figure.Entourage__Figure__PositionMm;
        const edge = Na__VegOverlay__ToScreen(
            (position[0] + (e[0] * size[0]) / 2) / 1000,
            (position[1] + size[1] / 2) / 1000,
            (position[2] + (e[2] * size[0]) / 2) / 1000
        );
        const canvasLeft = state.context.renderer.domElement.getBoundingClientRect().left;
        const besideX = edge ? Math.max(x, canvasLeft + edge.x + Na__EntTool__MENU_GAP_PX) : x;

        const work = Na__EntData__Work();                                      // <-- Who added it and when (Adam, 11-Nov-2026: "ownership / accountability")
        const uid  = figure.Entourage__Figure__Uid;

        Na__EntPopup__Open({
            title : here ? here.Asset__Name : figure.Entourage__Figure__AssetId,
            owner : Na__SceneChanges__OwnerLines(work.summary, 'figure:' + uid, work.me && work.me.code, Na__EntData__IsOnServer(uid)),
            x : besideX, y,
            rows : [
                { id : 'naEntourageMenuMove', label : 'Move', hint : 'M', action : Na__EntTool__CarrySelected },
                { id : 'naEntourageMenuBigger', label : 'Bigger', hint : '+' + percent + '%', action : () => Na__EntTool__ScaleSelected(step) },
                { id : 'naEntourageMenuSmaller', label : 'Smaller', hint : '-' + percent + '%', action : () => Na__EntTool__ScaleSelected(1 / step) },
                { id : 'naEntourageMenuCopy', label : 'Copy beside it', hint : 'Ctrl+D', action : Na__EntTool__CopySelected }
            ],
            swaps : catalogue
                .filter((row) => row.Asset__Id !== figure.Entourage__Figure__AssetId && row.Asset__Status !== 'Retired')
                .map((row) => ({ assetId : row.Asset__Id, name : row.Asset__Name, recipe : state.hooks.recipeOf(row.Asset__Id) })),
            drawSwap  : (canvas, swap, size) => Na__EntPic__Draw(canvas, swap.recipe, Na__EntRun__GetSceneData().Entourage__SceneData__LineRules, size),
            onSwap    : Na__EntTool__SwapSelected,
            onPreview : (assetId) => {
                state.previewId = assetId;
                Na__VegTools__Repaint();
            },
            lastRows : [
                { id : 'naEntourageMenuDelete', label : 'Delete', hint : 'Del', danger : true, action : Na__EntTool__RemoveSelected }
            ],
            onClose : () => {
                state.previewId = '';
                Na__VegTools__Repaint();
            }
        });
    }
    // ------------------------------------------------------------


    // HANDLERS | A Right Press, and What It Becomes
    // ------------------------------------------------------------
    // A right press that travelled was a pan, so it opens nothing. On nothing, nothing opens either.
    // ------------------------------------------------------------
    function Na__EntTool__OnRightDown(event) {
        if (event.button === 2) Na__EntTool__State.rightAt = { x : event.clientX, y : event.clientY };
    }
    function Na__EntTool__OnContextMenu(event) {
        const state = Na__EntTool__State;
        const from = state.rightAt;
        state.rightAt = null;
        if (!Na__EntTool__HasTheClicks() || state.carry) return;
        const slop = Na__EntTool__Dev().Entourage__DevTools__RightClickSlopPx;
        if (from && (Math.abs(event.clientX - from.x) > slop || Math.abs(event.clientY - from.y) > slop)) return;
        const uid = Na__EntTool__FigureAt(event);
        if (!uid) return;
        event.preventDefault();
        event.stopImmediatePropagation();                                      // <-- TrueVision: its model menu must not open over this one
        state.selectedUid = uid;
        if (state.hooks.onPicked) state.hooks.onPicked();
        Na__EntTool__Say();
        Na__EntTool__OpenMenu(event.clientX, event.clientY);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Tool Draws
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Figure's Ring, on the 2D Canvas
    // ------------------------------------------------------------
    // NPR's footprint: half the figure's width, or the least the config says. Level at its feet.
    // ------------------------------------------------------------
    function Na__EntTool__PaintRing(pen, point, widthMm, scale, look) {
        const ring = Na__EntTool__Ring();
        const radiusM = Math.max(ring.Entourage__Ring__MinRadiusMm, (widthMm * scale) / 2) / 1000;
        pen.disc(point[0], point[1], point[2], radiusM, look);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Figure's Outline at a Spot, Turned to the Camera
    // ------------------------------------------------------------
    function Na__EntTool__PaintOutline(pen, assetId, seed, scale, point, style, stretch) {
        const layer = Na__EntRun__GetLayer();
        const parts = layer ? layer.partsFor({ assetId, seed }) : null;
        if (!parts) return;
        const e = Na__EntTool__State.context.camera.matrixWorld.elements;
        const yaw = Math.atan2(e[12] - point[0], e[14] - point[2]);
        const c = Math.cos(yaw) * scale / 1000, s = Math.sin(yaw) * scale / 1000, up = (scale * (stretch || 1)) / 1000;
        parts.outlines.forEach((loop) => {
            const world = loop.map((p) => [point[0] + p[0] * c, point[1] + p[1] * up, point[2] - p[0] * s]);
            pen.polygon(world, style);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Aids
    // ------------------------------------------------------------
    function Na__EntTool__Paint(pen) {
        const state = Na__EntTool__State;
        const sceneData = Na__EntRun__GetSceneData();
        if (!sceneData) return;
        const ring = Na__EntTool__Ring();
        const strong = {
            colour : ring.Entourage__Ring__Stroke,
            fill   : ring.Entourage__Ring__Fill,
            width  : ring.Entourage__Ring__StrokePx
        };
        const soft = {
            colour : ring.Entourage__Ring__HoverStroke,
            fill   : ring.Entourage__Ring__HoverFill,
            width  : ring.Entourage__Ring__StrokePx
        };
        const dashed = Object.assign({}, strong, { dash : ring.Entourage__Ring__DashPx });
        const placed = (figure) => figure.Entourage__Figure__PositionMm.map((mm) => mm / 1000);
        const carrying = state.carry ? state.carry.uid : '';

        // THE HOVERED FIGURE
        if (state.hoverUid && state.hoverUid !== state.selectedUid && state.hoverUid !== carrying) {
            const figure = Na__EntData__FindFigure(sceneData, state.hoverUid);
            if (figure) Na__EntTool__PaintRing(pen, placed(figure), Na__EntRun__SizeOf(figure)[0], 1, soft);
        }

        // THE SELECTED FIGURE
        const selected = Na__EntTool__SelectedFigure();
        if (selected && selected.Entourage__Figure__Uid !== carrying) {
            const point = placed(selected);
            Na__EntTool__PaintRing(pen, point, Na__EntRun__SizeOf(selected)[0], 1, strong);
            if (state.previewId) {
                Na__EntTool__PaintOutline(pen, state.previewId, 7, selected.Entourage__Figure__Scale > 0 ? selected.Entourage__Figure__Scale : 1, point, { colour : ring.Entourage__Ring__Stroke, width : 1.5 }, selected.Entourage__Figure__HeightStretch);
            }
        }

        // WHAT IS BEING CARRIED | The figure itself, its ring, a line up to its height, its foot
        const carry = state.carry;
        if (carry && carry.point) {
            const layer = Na__EntRun__GetLayer();
            const parts = layer ? layer.partsFor({ assetId : carry.assetId, seed : carry.seed }) : null;
            if (parts) {
                const widest = parts.outlines.reduce((most, loop) => loop.reduce((m, p) => Math.max(m, Math.abs(p[0])), most), 0) * 2;
                const tallest = parts.outlines.reduce((most, loop) => loop.reduce((m, p) => Math.max(m, p[1]), most), 0);
                Na__EntTool__PaintRing(pen, carry.point, widest, carry.scale, dashed);
                Na__EntTool__PaintOutline(pen, carry.assetId, carry.seed, carry.scale, carry.point, { colour : ring.Entourage__Ring__Stroke, width : 1.25, fill : 'rgba(255, 255, 255, 0.55)' }, carry.stretch);
                pen.polyline([carry.point, [carry.point[0], carry.point[1] + (tallest * carry.scale * (carry.stretch || 1)) / 1000, carry.point[2]]], { colour : ring.Entourage__Ring__HoverStroke, width : 1 });
                pen.dot(carry.point, ring.Entourage__Ring__FootDotPx, ring.Entourage__Ring__Stroke);
            }
        }

        // A CARD ARMED, UNDER THE POINTER
        if (state.armedId && state.hoverPoint) {
            const recipe = state.hooks.recipeOf ? state.hooks.recipeOf(state.armedId) : null;
            if (recipe) {
                const scale = Na__EntTool__PlaceScale();
                Na__EntTool__PaintRing(pen, state.hoverPoint, recipe.Asset__Size.Size__WidthMm, scale, dashed);
                Na__EntTool__PaintOutline(pen, state.armedId, 1, scale, state.hoverPoint, { colour : ring.Entourage__Ring__Stroke, width : 1.25, fill : 'rgba(255, 255, 255, 0.55)' });
                pen.dot(state.hoverPoint, ring.Entourage__Ring__FootDotPx, ring.Entourage__Ring__Stroke);
            }
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tool on the Model
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | What the Tool Host Is Handed
    // ------------------------------------------------------------
    const Na__EntTool__Tool = {
        name : 'entourage',

        // A PRESS | On a figure it is ours, and the orbit stands down. Anywhere else it orbits.
        onPress(event) {
            const state = Na__EntTool__State;
            if (Na__EntPopup__IsOpen()) return false;
            if (state.armedId || state.carry) return false;
            const uid = Na__EntTool__FigureAt(event);
            if (!uid) return false;
            state.press = { uid, x : event.clientX, y : event.clientY };
            state.selectedUid = uid;
            if (state.hooks.onPicked) state.hooks.onPicked();
            Na__EntTool__Say();
            return true;
        },

        onDrag(event) {
            const state = Na__EntTool__State;
            if (state.press && !state.carry) {
                const away = Math.hypot(event.clientX - state.press.x, event.clientY - state.press.y);
                if (away < Na__EntTool__Dev().Entourage__DevTools__DragThresholdPx) return;
                const figure = Na__EntData__FindFigure(Na__EntRun__GetSceneData(), state.press.uid);
                if (figure) Na__EntTool__CarryFigure(figure, 'drag');
            }
            if (state.carry) Na__EntTool__FollowPointer(event);
        },

        onRelease() {
            const state = Na__EntTool__State;
            state.press = null;
            if (state.carry) Na__EntTool__LandCarry();
        },

        // A CLICK THAT TOOK NO FIGURE | It lands what is carried, drops what is armed, or lets go
        onClick(event) {
            const state = Na__EntTool__State;
            if (state.carry && state.carry.mode === 'key') {
                Na__EntTool__FollowPointer(event);
                Na__EntTool__LandCarry();
                return;
            }
            if (state.armedId) {
                const spot = Na__EntTool__SpotAt(event, null);
                if (!spot) {
                    Na__EntShell__Toast('That spot does not face up. Try the ground, a terrace or a step.', true);
                    return;
                }
                Na__EntTool__AddFigure(state.armedId, Na__EntTool__ToMm(spot), Na__EntTool__PlaceScale());
                return;
            }
            if (state.selectedUid) Na__EntTool__Select('');
        },

        // THE POINTER MOVING | At most once per HoverMs, and always for where it came to rest: a
        // move that lands within the wait is held for its end, or a ring could miss the last step.
        onHover(event) {
            const state = Na__EntTool__State;
            const wait = Na__EntTool__Dev().Entourage__DevTools__HoverMs - (performance.now() - state.hoverAt);
            window.clearTimeout(state.hoverTimer);
            if (wait > 0) {
                const held = { clientX : event.clientX, clientY : event.clientY };
                state.hoverTimer = window.setTimeout(() => {
                    if (state.running && Na__EntTool__HasTheClicks()) Na__EntTool__Tool.onHover(held);
                }, wait);
                return;
            }
            state.hoverAt = performance.now();

            if (state.carry && state.carry.mode === 'key') {
                Na__EntTool__FollowPointer(event);
                return;
            }
            if (state.armedId) {
                const spot = Na__EntTool__SpotAt(event, null);
                state.hoverPoint = spot;
                Na__VegTools__Repaint();
                return;
            }
            const uid = Na__EntTool__FigureAt(event);
            if (uid !== state.hoverUid) {
                state.hoverUid = uid;
                Na__EntTool__SetCursor();
                Na__VegTools__Repaint();
            }
        },

        onKey(event) {
            const state = Na__EntTool__State;
            if (event.key === 'Escape') {
                if (state.carry) { Na__EntTool__CancelCarry(); return true; }
                if (state.armedId) { Na__EntTool__ArmCard(state.armedId); return true; }
                if (state.selectedUid) { Na__EntTool__Select(''); return true; }
                return false;
            }
            if (!state.selectedUid) return false;
            if (event.key === 'Delete' || event.key === 'Backspace') {
                Na__EntTool__RemoveSelected();
                return true;
            }
            if ((event.key === 'm' || event.key === 'M') && !event.ctrlKey && !event.metaKey && !state.carry) {
                Na__EntTool__CarrySelected();
                return true;
            }
            if ((event.key === 'd' || event.key === 'D') && (event.ctrlKey || event.metaKey)) {
                Na__EntTool__CopySelected();
                return true;
            }
            return false;
        },

        paint(pen) {
            Na__EntTool__Paint(pen);
        },

        onDisarm() {
            const state = Na__EntTool__State;
            if (state.carry) Na__EntTool__CancelCarry();
            state.hoverUid = '';
            Na__EntTool__SetCursor();
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Starting and Stopping
// -----------------------------------------------------------------------------

    // FUNCTION | The Panel Has Opened: the Tool Goes on the Model
    // ------------------------------------------------------------
    // hooks: { onChanged(), onPicked(), catalogue(), recipeOf(assetId) }
    // ------------------------------------------------------------
    async function Na__EntTool__Start(context, hooks) {
        const state = Na__EntTool__State;
        await Na__VegTools__Prepare(context);
        state.context = context;
        state.hooks   = hooks;
        state.running = true;
        Na__VegTools__SetFallback(Na__EntTool__Tool);
        if (!Na__VegTools__Current()) Na__VegTools__Arm(Na__EntTool__Tool);
        const canvas = context.renderer.domElement;
        canvas.addEventListener('pointerdown', Na__EntTool__OnRightDown);
        canvas.addEventListener('contextmenu', Na__EntTool__OnContextMenu, true);   // <-- Capture: heard before TrueVision's model menu
    }
    // ------------------------------------------------------------


    // FUNCTION | The Panel Has Closed: the Model Behaves as Normal Again
    // ------------------------------------------------------------
    function Na__EntTool__Stop() {
        const state = Na__EntTool__State;
        if (!state.running) return;
        state.running = false;
        window.clearTimeout(state.hoverTimer);
        Na__EntPopup__Close();
        const canvas = state.context.renderer.domElement;
        canvas.removeEventListener('pointerdown', Na__EntTool__OnRightDown);
        canvas.removeEventListener('contextmenu', Na__EntTool__OnContextMenu, true);
        Na__VegTools__SetFallback(null);
        state.armedId = '';
        state.selectedUid = '';
        state.hoverUid = '';
        state.hoverPoint = null;
        state.hooks = {};
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Figure Tool API
    // ------------------------------------------------------------
    export {
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
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
