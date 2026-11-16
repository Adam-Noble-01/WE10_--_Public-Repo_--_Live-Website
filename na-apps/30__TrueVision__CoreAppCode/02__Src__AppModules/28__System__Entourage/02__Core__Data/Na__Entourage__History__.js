// =============================================================================
// TRUEVISION3D - ENTOURAGE - UNDO AND REDO
// =============================================================================
//
// FILE       : Na__Entourage__History__.js
// NAMESPACE  : Na__EntHist
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Take back what was done to the project's figures, for this session
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - WHOLE PICTURES OF THE EDITABLE PARTS, as compact text, as the plants' history
//   (Na__Vegetation__History__.js). Far simpler than a command for each kind of edit, and it
//   cannot drift. A project's pinned assets stay out of the picture: they are large, and
//   an asset once pinned is harmless if an undo takes away the figure using it.
// - TAKEN BEFORE THE CHANGE. Push, then change. A slider's drag is one step: pushes with the
//   same label close together are one.
// - RESTORING ONLY CHANGES THE DATA. The caller then asks the runtime to bring the picture into line.
//
// INTEGRATION:
// - Used by ../10__Ui__Panels/Na__Entourage__PanelShell__.js and what it opens.
// - No static imports, so it runs in Node for checks.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/02__Core__Data/Na__Entourage__History__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Is Kept, and for How Long a Label Runs On
    // ------------------------------------------------------------
    const Na__EntHist__EVENT    = 'na-entourage-history-changed';
    const Na__EntHist__MERGE_MS = 900;
    const Na__EntHist__KEYS     = [
        'Entourage__SceneData__LineRules',
        'Entourage__SceneData__Figures',
        'Entourage__SceneData__Tools'
    ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Two Stacks
    // ------------------------------------------------------------
    const Na__EntHist__State = {
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
    function Na__EntHist__Picture(sceneData) {
        const parts = {};
        Na__EntHist__KEYS.forEach((key) => { parts[key] = sceneData[key]; });
        return JSON.stringify(parts);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Picture Back
    // ------------------------------------------------------------
    function Na__EntHist__PutBack(sceneData, picture) {
        const parts = JSON.parse(picture);
        Na__EntHist__KEYS.forEach((key) => {
            if (parts[key] !== undefined) sceneData[key] = parts[key];
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Panels
    // ------------------------------------------------------------
    function Na__EntHist__Say() {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(Na__EntHist__EVENT, {
            detail : { canUndo : Na__EntHist__State.undo.length > 0, canRedo : Na__EntHist__State.redo.length > 0 }
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Again on a Project's Object
    // ------------------------------------------------------------
    function Na__EntHist__Reset(sceneData, depth) {
        Na__EntHist__State.sceneData = sceneData;
        Na__EntHist__State.undo      = [];
        Na__EntHist__State.redo      = [];
        Na__EntHist__State.lastLabel = '';
        if (Number.isFinite(depth) && depth > 0) Na__EntHist__State.depth = depth;
        Na__EntHist__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember How Things Stand, Just Before Changing Them
    // ------------------------------------------------------------
    function Na__EntHist__Push(label, nowMs) {
        const state = Na__EntHist__State;
        if (!state.sceneData) return;
        const now = Number.isFinite(nowMs) ? nowMs : Date.now();
        const sameDrag = label && label === state.lastLabel && (now - state.lastAt) < Na__EntHist__MERGE_MS;
        state.lastLabel = label || '';
        state.lastAt    = now;
        if (sameDrag) return;
        state.undo.push(Na__EntHist__Picture(state.sceneData));
        if (state.undo.length > state.depth) state.undo.shift();
        state.redo = [];
        Na__EntHist__Say();
    }
    // ------------------------------------------------------------


    // FUNCTION | Take One Step Back. True If There Was One
    // ------------------------------------------------------------
    function Na__EntHist__Undo() {
        const state = Na__EntHist__State;
        if (!state.sceneData || state.undo.length === 0) return false;
        state.redo.push(Na__EntHist__Picture(state.sceneData));
        Na__EntHist__PutBack(state.sceneData, state.undo.pop());
        state.lastLabel = '';
        Na__EntHist__Say();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take One Step Forward Again. True If There Was One
    // ------------------------------------------------------------
    function Na__EntHist__Redo() {
        const state = Na__EntHist__State;
        if (!state.sceneData || state.redo.length === 0) return false;
        state.undo.push(Na__EntHist__Picture(state.sceneData));
        Na__EntHist__PutBack(state.sceneData, state.redo.pop());
        state.lastLabel = '';
        Na__EntHist__Say();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Take Back, or to Bring Forward?
    // ------------------------------------------------------------
    function Na__EntHist__CanUndo() {
        return Na__EntHist__State.undo.length > 0;
    }
    function Na__EntHist__CanRedo() {
        return Na__EntHist__State.redo.length > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | History API
    // ------------------------------------------------------------
    export {
        Na__EntHist__EVENT,
        Na__EntHist__Reset,
        Na__EntHist__Push,
        Na__EntHist__Undo,
        Na__EntHist__Redo,
        Na__EntHist__CanUndo,
        Na__EntHist__CanRedo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
