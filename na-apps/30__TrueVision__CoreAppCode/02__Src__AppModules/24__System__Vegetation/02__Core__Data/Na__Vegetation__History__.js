// =============================================================================
// TRUEVISION3D - VEGETATION - UNDO AND REDO
// =============================================================================
//
// FILE       : Na__Vegetation__History__.js
// NAMESPACE  : Na__VegHist
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Take back what was done to the project's plants, for this session
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - WHOLE PICTURES OF THE EDITABLE PARTS, as compact text. A plop is 160 bytes that way,
//   so sixty steps of a thousand plants is about ten megabytes, on a computer, for an
//   app admin only. Far simpler than a command for each kind of edit, and it cannot
//   drift: restoring puts back exactly what was there.
// - TAKEN BEFORE THE CHANGE. Push, then change. A slider's drag is one step, not a hundred:
//   pushes with the same label close together are one.
// - RESTORING ONLY CHANGES THE DATA. The caller then asks the runtime to bring the picture
//   into line, which rebuilds only the plants that differ.
//
// INTEGRATION:
// - Used by the panels and tools in ../10__Ui__Panels and ../20__System__Tools.
// - No static imports, so it runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/02__Core__Data/Na__Vegetation__History__.js (ValeVision3D v2.98.6)
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
// - Initial build: Stage 4 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Is Kept, and for How Long a Label Runs On
    // ------------------------------------------------------------
    const Na__VegHist__EVENT      = 'na-vegetation-history-changed';
    const Na__VegHist__MERGE_MS   = 900;                                       // <-- Pushes with one label this close together are one step
    const Na__VegHist__KEYS       = [
        'Vegetation__SceneData__LineRules',
        'Vegetation__SceneData__Assets',
        'Vegetation__SceneData__Palettes',
        'Vegetation__SceneData__Paths',
        'Vegetation__SceneData__Plops',
        'Vegetation__SceneData__Tools'
    ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Two Stacks
    // ------------------------------------------------------------
    const Na__VegHist__State = {
        sceneData : null,
        undo      : [],
        redo      : [],
        depth     : 60,
        lastLabel : '',
        lastAt    : 0
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Editable Parts as Text
    // ------------------------------------------------------------
    function Na__VegHist__Picture(sceneData) {
        const parts = {};
        Na__VegHist__KEYS.forEach((key) => { parts[key] = sceneData[key]; });
        return JSON.stringify(parts);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Picture Back
    // ------------------------------------------------------------
    function Na__VegHist__PutBack(sceneData, picture) {
        const parts = JSON.parse(picture);
        Na__VegHist__KEYS.forEach((key) => {
            if (parts[key] !== undefined) sceneData[key] = parts[key];
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Panels
    // ------------------------------------------------------------
    function Na__VegHist__Say() {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(Na__VegHist__EVENT, {
            detail : { canUndo : Na__VegHist__State.undo.length > 0, canRedo : Na__VegHist__State.redo.length > 0 }
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Again on a Project's Object
    // ------------------------------------------------------------
    function Na__VegHist__Reset(sceneData, depth) {
        Na__VegHist__State.sceneData = sceneData;
        Na__VegHist__State.undo      = [];
        Na__VegHist__State.redo      = [];
        Na__VegHist__State.lastLabel = '';
        if (Number.isFinite(depth) && depth > 0) Na__VegHist__State.depth = depth;
        Na__VegHist__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember How Things Stand, Just Before Changing Them
    // ------------------------------------------------------------
    function Na__VegHist__Push(label, nowMs) {
        const state = Na__VegHist__State;
        if (!state.sceneData) return;
        const now = Number.isFinite(nowMs) ? nowMs : Date.now();
        const sameDrag = label && label === state.lastLabel && (now - state.lastAt) < Na__VegHist__MERGE_MS;
        state.lastLabel = label || '';
        state.lastAt    = now;
        if (sameDrag) return;
        state.undo.push(Na__VegHist__Picture(state.sceneData));
        if (state.undo.length > state.depth) state.undo.shift();
        state.redo = [];
        Na__VegHist__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop the Next Push Joining the Last
    // ------------------------------------------------------------
    function Na__VegHist__EndStep() {
        Na__VegHist__State.lastLabel = '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Take One Step Back. True If There Was One
    // ------------------------------------------------------------
    function Na__VegHist__Undo() {
        const state = Na__VegHist__State;
        if (!state.sceneData || state.undo.length === 0) return false;
        state.redo.push(Na__VegHist__Picture(state.sceneData));
        Na__VegHist__PutBack(state.sceneData, state.undo.pop());
        state.lastLabel = '';
        Na__VegHist__Say();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take One Step Forward Again. True If There Was One
    // ------------------------------------------------------------
    function Na__VegHist__Redo() {
        const state = Na__VegHist__State;
        if (!state.sceneData || state.redo.length === 0) return false;
        state.undo.push(Na__VegHist__Picture(state.sceneData));
        Na__VegHist__PutBack(state.sceneData, state.redo.pop());
        state.lastLabel = '';
        Na__VegHist__Say();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Take Back, or to Bring Forward?
    // ------------------------------------------------------------
    function Na__VegHist__CanUndo() {
        return Na__VegHist__State.undo.length > 0;
    }
    function Na__VegHist__CanRedo() {
        return Na__VegHist__State.redo.length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | History API
    // ------------------------------------------------------------
    export {
        Na__VegHist__EVENT,
        Na__VegHist__Reset,
        Na__VegHist__Push,
        Na__VegHist__EndStep,
        Na__VegHist__Undo,
        Na__VegHist__Redo,
        Na__VegHist__CanUndo,
        Na__VegHist__CanRedo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
