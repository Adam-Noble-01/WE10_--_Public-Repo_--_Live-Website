// =============================================================================
// TRUEVISION3D - VEGETATION - THE TOOL HOST
// =============================================================================
//
// FILE       : Na__Vegetation__ToolHost__.js
// NAMESPACE  : Na__VegTools
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One tool on the model at a time: its pointer and keys, its drawing layer,
//              and everything put back as it was when it stands down
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - ONE AT A TIME. Picking a card, drawing a path and brushing all want the same clicks, so
//   arming one disarms the last. Each tool says what it wants; this does the rest.
// - PLAIN CLICKS LEAVE THE ORBIT ALONE. A left drag still orbits between clicks, as the
//   north pick's does, and a press that travelled was an orbit, not a click.
// - A TOOL MAY TAKE A PRESS. Its onPress answers true for a grip or a brush stroke; the orbit
//   controls then stand down until release, and the drag goes on the window, so it cannot
//   be lost off the edge of the canvas.
// - THE BUSH TOOL PAINTS WITH THE LEFT BUTTON, so while it is armed the middle button orbits
//   as in SketchUp, and the wheel still zooms (plan, section 2). Put back on disarm.
// - THE DOORS HOLD. A click meant for a tool would swing a door behind it (note 10, T19).
// - NOT OVER A DRAWING. A plan or elevation on screen, or another tab, and the tool sits
//   quiet until the 3D view is back: it reads what the keyboard scope reads.
//
// INTEGRATION:
// - Used by ../10__Ui__Panels/Na__Vegetation__AssetBrowser__.js, ./Na__Vegetation__LinearTool__.js,
//   ./Na__Vegetation__BushTool__.js and 28__System__Entourage's figure tool: only one tool may
//   have the clicks, whichever system it belongs to. Every tool is an object:
//   { name, cursor, paintsWithLeft, onPress(event), onDrag(event), onRelease(event),
//     onClick(event), onHover(event), onKey(event), paint(pen), onDisarm() }, all optional.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__ToolHost__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 5 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The App, and This System's Pick and Layer
    // ------------------------------------------------------------
    import { Na__DoorAnim__SetClickHold } from '../../25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js';
    import { Na__DrawView__GetCamera } from '../../40__System__DrawingViewCore/Na__DrawView__ActiveView__.js';
    import { Na__KeyScope__Is, Na__KeyScope__MODEL, Na__KeyScope__IsTypingTarget } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    import { Na__VegPick__Initialize, Na__VegPick__Prepare } from './Na__Vegetation__SurfacePick__.js';
    import { Na__VegOverlay__Mount, Na__VegOverlay__SetPainter, Na__VegOverlay__Invalidate } from './Na__Vegetation__ToolOverlay__.js';
    import { Na__VegData__LoadConfig } from '../02__Core__Data/Na__Vegetation__SceneData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Hold's Name
    // ------------------------------------------------------------
    const Na__VegTools__HOLD = 'vegetation-tool';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Tool on the Model, and the Press in Hand
    // ------------------------------------------------------------
    const Na__VegTools__State = {
        context         : null,
        clickPx         : 5,
        tool            : null,
        fallback        : null,                                                // <-- Has the clicks when no tool does: the asset browser, selecting plants
        arming          : false,
        pressing        : false,
        taken           : false,
        downX           : 0,
        downY           : 0,
        priorCursor     : '',
        priorButtons    : null,
        controlsWereOn  : true
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer and Keys
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the 3D View What Is on Screen?
    // ------------------------------------------------------------
    function Na__VegTools__ViewIsUp() {
        return !Na__DrawView__GetCamera() && Na__KeyScope__Is(Na__KeyScope__MODEL);
    }
    // ------------------------------------------------------------


    // HANDLER | A Press on the Model
    // ------------------------------------------------------------
    // In the capture phase, so a tool that takes it has stood the orbit down first.
    // ------------------------------------------------------------
    function Na__VegTools__OnPointerDown(event) {
        const state = Na__VegTools__State;
        const tool  = state.tool;
        if (!tool || !Na__VegTools__ViewIsUp()) return;
        if (event.button !== 0) return;
        state.pressing = true;
        state.downX    = event.clientX;
        state.downY    = event.clientY;
        state.taken    = false;

        if (tool.onPress && tool.onPress(event) === true) {
            state.taken = true;
            const controls = state.context.controls;
            if (controls) {
                state.controlsWereOn = controls.enabled;
                controls.enabled = false;
            }
            window.addEventListener('pointermove', Na__VegTools__OnDragMove);
            window.addEventListener('pointerup', Na__VegTools__OnDragUp);
        }
    }
    // ------------------------------------------------------------


    // HANDLER | The Pointer Moves with No Press Taken
    // ------------------------------------------------------------
    function Na__VegTools__OnPointerMove(event) {
        const state = Na__VegTools__State;
        if (!state.tool || state.taken || !Na__VegTools__ViewIsUp()) return;
        if (event.buttons !== 0) return;                                       // <-- An orbit: the view is moving under the pointer
        if (state.tool.onHover) state.tool.onHover(event);
    }
    // ------------------------------------------------------------


    // HANDLER | A Release on the Model: a Short Press Is a Click, a Long One Was an Orbit
    // ------------------------------------------------------------
    function Na__VegTools__OnPointerUp(event) {
        const state = Na__VegTools__State;
        if (!state.pressing || state.taken) return;
        state.pressing = false;
        if (event.button !== 0 || !state.tool || !Na__VegTools__ViewIsUp()) return;
        if (Math.abs(event.clientX - state.downX) > state.clickPx || Math.abs(event.clientY - state.downY) > state.clickPx) return;
        if (state.tool.onClick) state.tool.onClick(event);
    }
    // ------------------------------------------------------------


    // HANDLERS | A Taken Press: the Drag, and Its End
    // ------------------------------------------------------------
    function Na__VegTools__OnDragMove(event) {
        const tool = Na__VegTools__State.tool;
        if (tool && tool.onDrag) tool.onDrag(event);
    }
    function Na__VegTools__EndDrag() {
        const state = Na__VegTools__State;
        window.removeEventListener('pointermove', Na__VegTools__OnDragMove);
        window.removeEventListener('pointerup', Na__VegTools__OnDragUp);
        state.pressing = false;
        state.taken    = false;
        const controls = state.context && state.context.controls;
        if (controls) controls.enabled = state.controlsWereOn;
    }
    function Na__VegTools__OnDragUp(event) {
        const tool = Na__VegTools__State.tool;
        Na__VegTools__EndDrag();
        if (tool && tool.onRelease) tool.onRelease(event);
    }
    // ------------------------------------------------------------


    // HANDLER | A Key, While a Tool Is Armed
    // ------------------------------------------------------------
    // In the capture phase, so Escape and Delete reach the tool before the app's own keys.
    // ------------------------------------------------------------
    function Na__VegTools__OnKeyDown(event) {
        const tool = Na__VegTools__State.tool;
        if (!tool || !tool.onKey || !Na__VegTools__ViewIsUp()) return;
        if (Na__KeyScope__IsTypingTarget(event.target)) return;
        if (tool.onKey(event) === true) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Get Ready, Once per Context
    // ------------------------------------------------------------
    async function Na__VegTools__Prepare(context) {
        const state = Na__VegTools__State;
        if (state.context === context) return;
        state.context = context;
        const config = await Na__VegData__LoadConfig();
        state.clickPx = config.Vegetation__DevTools__Config.Vegetation__DevTools__ClickThresholdPx;
        Na__VegPick__Initialize(context);
        Na__VegOverlay__Mount(context);
        Na__VegPick__Prepare();                                                // <-- In slices, in its own time, so the first click is not the slow one
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Tool on the Model
    // ------------------------------------------------------------
    function Na__VegTools__Arm(tool) {
        const state = Na__VegTools__State;
        state.arming = true;
        Na__VegTools__Disarm();
        state.arming = false;
        state.tool = tool;

        const canvas = state.context.renderer.domElement;
        state.priorCursor = canvas.style.cursor;
        if (tool.cursor) canvas.style.cursor = tool.cursor;
        canvas.addEventListener('pointerdown', Na__VegTools__OnPointerDown, true);
        canvas.addEventListener('pointermove', Na__VegTools__OnPointerMove);
        canvas.addEventListener('pointerup', Na__VegTools__OnPointerUp);
        window.addEventListener('keydown', Na__VegTools__OnKeyDown, true);
        Na__DoorAnim__SetClickHold(Na__VegTools__HOLD, true);

        const controls = state.context.controls;
        if (tool.paintsWithLeft && controls && controls.mouseButtons) {
            state.priorButtons = Object.assign({}, controls.mouseButtons);
            controls.mouseButtons.LEFT   = null;
            controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
        }
        Na__VegOverlay__SetPainter(tool.paint ? (pen) => tool.paint(pen) : null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Tool Off the Model, and Put Everything Back
    // ------------------------------------------------------------
    function Na__VegTools__Disarm() {
        const state = Na__VegTools__State;
        const tool = state.tool;
        if (!tool) return;
        if (state.taken) Na__VegTools__EndDrag();
        state.tool = null;
        state.pressing = false;

        const canvas = state.context.renderer.domElement;
        canvas.style.cursor = state.priorCursor;
        canvas.removeEventListener('pointerdown', Na__VegTools__OnPointerDown, true);
        canvas.removeEventListener('pointermove', Na__VegTools__OnPointerMove);
        canvas.removeEventListener('pointerup', Na__VegTools__OnPointerUp);
        window.removeEventListener('keydown', Na__VegTools__OnKeyDown, true);
        Na__DoorAnim__SetClickHold(Na__VegTools__HOLD, false);

        const controls = state.context.controls;
        if (state.priorButtons && controls && controls.mouseButtons) {
            controls.mouseButtons.LEFT   = state.priorButtons.LEFT;
            controls.mouseButtons.MIDDLE = state.priorButtons.MIDDLE;
        }
        state.priorButtons = null;
        Na__VegOverlay__SetPainter(null);
        if (tool.onDisarm) tool.onDisarm();
        if (!state.arming && state.fallback && state.fallback !== tool) Na__VegTools__Arm(state.fallback);
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Who Has the Clicks When No Tool Does
    // ------------------------------------------------------------
    function Na__VegTools__SetFallback(tool) {
        const state = Na__VegTools__State;
        const old = state.fallback;
        state.fallback = tool;
        if (!tool && old && state.tool === old) Na__VegTools__Disarm();
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Tool Is on the Model?
    // ------------------------------------------------------------
    function Na__VegTools__Current() {
        return Na__VegTools__State.tool;
    }
    // ------------------------------------------------------------


    // FUNCTION | Something a Tool Draws Has Changed
    // ------------------------------------------------------------
    function Na__VegTools__Repaint() {
        Na__VegOverlay__Invalidate();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Tool Host API
    // ------------------------------------------------------------
    export {
        Na__VegTools__Prepare,
        Na__VegTools__Arm,
        Na__VegTools__Disarm,
        Na__VegTools__SetFallback,
        Na__VegTools__Current,
        Na__VegTools__Repaint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
