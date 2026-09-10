// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE REORDER HELPERS
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneReorder__.js
// NAMESPACE  : Na__PresentationMode
// MODULE     : PresentationMode - Dev Menu Scene Reorder Helpers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Per-group array reordering and drag-and-drop wiring for the
//              Presentation Scenes editor rows
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The scene editor holds its working scenes in playback order (Group Order,
//   then Scene Order), so every group's scenes sit in one unbroken run of the
//   array. The helpers here move a scene inside that run and refuse to let it
//   leave it: reordering and regrouping are deliberately separate controls,
//   and the Group dropdown on the row is the only way between groups.
// - Drag and drop is native HTML5. A row only becomes draggable while its grip
//   handle is held (the row builder arms `draggable` on mousedown), otherwise
//   dragging a slider or selecting text in the name field would start a drag.
// - Nothing here touches the live config, saves, or rebuilds the panel. Every
//   helper takes the scenes array and config it should work on, and the drag
//   wiring reports back through two callbacks, so the editor keeps the single
//   normalise -> commit -> save tail it already has.
//
// INTEGRATION:
// - Imported by Na__PresentationMode__DevMenu__SceneEditor.js only.
// - Reads group membership through Na__PresentationMode__SceneGroups__Data__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneReorder__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial split from the scene editor during port Phase 1.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Scene Group Data Layer
    // @delegate: ./Na__PresentationMode__SceneGroups__Data__.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__SceneGroups__IsEnabled,
        Na__PresentationMode__SceneGroups__GetFallbackGroupId,
        Na__PresentationMode__SceneGroups__ResolveSceneGroupId
    } from './Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Row Selector and Drop Indicator Classes
    // ------------------------------------------------------------
    const Na__PmReorder__ROW_SELECTOR      = '.na-pm-dev__scene-row';   // <-- Every scene row the editor builds
    const Na__PmReorder__CLASS_DRAGGING    = 'is-dragging';             // <-- Row being dragged
    const Na__PmReorder__CLASS_DROP_BEFORE = 'is-drop-before';          // <-- Indicator: insert above this row
    const Na__PmReorder__CLASS_DROP_AFTER  = 'is-drop-after';           // <-- Indicator: insert below this row
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Drag State (one drag at a time)
    // ------------------------------------------------------------
    let Na__PmReorder__DragSceneId = null;   // <-- Scene id being dragged, or null
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Membership Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is the Project Grouped At All?
    // ------------------------------------------------------------
    // Grouping disabled in the app config, or a project with no enabled group,
    // means every row is one flat list and any row is a valid reorder target.
    // ------------------------------------------------------------
    function Na__PmReorder__IsGrouped(config) {
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return false;
        return !!Na__PresentationMode__SceneGroups__GetFallbackGroupId(config);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Contiguous Array Slice One Group Occupies
    // ------------------------------------------------------------
    // The working array is held in playback order, so a group's scenes always
    // sit in one unbroken run. Returns { start, end } inclusive, or null when
    // the project is ungrouped or the scene is unknown.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__GetGroupSliceBounds(scenes, config, sceneId) {
        if (!Na__PmReorder__IsGrouped(config)) return null;                 // <-- Ungrouped project

        const scene = scenes.find(s => s.PresentationMode__Scene__Id === sceneId);
        if (!scene) return null;

        const groupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);
        const indices = scenes.reduce((acc, candidate, index) => {
            if (Na__PresentationMode__SceneGroups__ResolveSceneGroupId(candidate, config) === groupId) acc.push(index);
            return acc;
        }, []);

        if (indices.length === 0) return null;
        return { start : indices[0], end : indices[indices.length - 1] };
    }
    // ------------------------------------------------------------


    // FUNCTION | Do Two Scenes Resolve Into the Same Group?
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__AreScenesInSameGroup(scenes, config, sceneIdA, sceneIdB) {
        if (!Na__PmReorder__IsGrouped(config)) return true;                 // <-- Ungrouped: every row is a valid target

        const sceneA = scenes.find(s => s.PresentationMode__Scene__Id === sceneIdA);
        const sceneB = scenes.find(s => s.PresentationMode__Scene__Id === sceneIdB);
        if (!sceneA || !sceneB) return false;

        return Na__PresentationMode__SceneGroups__ResolveSceneGroupId(sceneA, config)
            === Na__PresentationMode__SceneGroups__ResolveSceneGroupId(sceneB, config);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Array Moves
// -----------------------------------------------------------------------------

    // FUNCTION | Move a Scene to a New Position in the Working Array (in place)
    // ------------------------------------------------------------
    // Movement is confined to the scene's own group. Letting a move land in a
    // neighbouring group's run would be ambiguous at every boundary, so the
    // target index is clamped inside the group's slice. Returns true when the
    // array actually changed.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__MoveSceneToIndex(scenes, config, sceneId, targetIndex) {
        const fromIndex = scenes.findIndex(s => s.PresentationMode__Scene__Id === sceneId);
        if (fromIndex === -1) return false;                                  // <-- Unknown scene

        const slice   = Na__PresentationMode__DevMenu__GetGroupSliceBounds(scenes, config, sceneId);
        const lowest  = slice ? slice.start : 0;
        const highest = slice ? slice.end   : scenes.length - 1;

        const bounded = Math.max(lowest, Math.min(targetIndex, highest));    // <-- Clamp inside the group's own run
        if (bounded === fromIndex) return false;                             // <-- Already in position, nothing to do

        const [moved] = scenes.splice(fromIndex, 1);                         // <-- Lift the row out
        scenes.splice(bounded, 0, moved);                                    // <-- Drop it back in at the target slot
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve the Final Array Index for a Drop Onto Another Row
    // ------------------------------------------------------------
    // placeAfter is true when the pointer released in the lower half of the
    // target row. Returns -1 when either scene is unknown or they are the same
    // row, so the caller can bail without touching the array.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__ResolveDropIndex(scenes, dragSceneId, targetSceneId, placeAfter) {
        if (!dragSceneId || dragSceneId === targetSceneId) return -1;        // <-- Dropped on itself

        const fromIndex   = scenes.findIndex(s => s.PresentationMode__Scene__Id === dragSceneId);
        const targetIndex = scenes.findIndex(s => s.PresentationMode__Scene__Id === targetSceneId);
        if (fromIndex === -1 || targetIndex === -1) return -1;

        const insertAt = placeAfter ? targetIndex + 1 : targetIndex;         // <-- Slot in the pre-move array
        return fromIndex < insertAt ? insertAt - 1 : insertAt;               // <-- Compensate for lifting the row out first
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drag and Drop Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clear Any Drop-Indicator Classes From a Row
    // ------------------------------------------------------------
    function Na__PmReorder__ClearDropIndicators(row) {
        row.classList.remove(Na__PmReorder__CLASS_DROP_BEFORE, Na__PmReorder__CLASS_DROP_AFTER);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Was the Pointer in the Lower Half of the Row?
    // ------------------------------------------------------------
    function Na__PmReorder__IsPointerBelowMidline(row, event) {
        const bounds = row.getBoundingClientRect();
        return (event.clientY - bounds.top) > (bounds.height / 2);          // <-- Lower half = insert below
    }
    // ------------------------------------------------------------


    // FUNCTION | Attach Drag-and-Drop Reorder Handlers to a Scene Row
    // ------------------------------------------------------------
    // callbacks.canDropOn(dragSceneId, targetSceneId) -> boolean
    //     Whether the dragged row may land on this one (the editor answers
    //     "same group only"). No indicator is drawn for a refused target.
    // callbacks.onDrop(dragSceneId, targetSceneId, placeAfter)
    //     Called once on a completed drop; the editor reorders, renumbers,
    //     saves and rebuilds.
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__AttachSceneRowDragHandlers(row, callbacks) {
        const sceneId   = row.dataset.sceneId;
        const canDropOn = (callbacks && typeof callbacks.canDropOn === 'function') ? callbacks.canDropOn : () => true;
        const onDrop    = (callbacks && typeof callbacks.onDrop === 'function')    ? callbacks.onDrop    : () => {};

        row.addEventListener('dragstart', (event) => {
            Na__PmReorder__DragSceneId = sceneId;
            row.classList.add(Na__PmReorder__CLASS_DRAGGING);
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', sceneId);          // <-- Firefox needs payload data to start a drag
            }
        });

        row.addEventListener('dragend', () => {
            Na__PmReorder__DragSceneId = null;
            row.classList.remove(Na__PmReorder__CLASS_DRAGGING);
            row.draggable = false;                                           // <-- Re-arm: handle must be grabbed again
            document.querySelectorAll(Na__PmReorder__ROW_SELECTOR)
                    .forEach(Na__PmReorder__ClearDropIndicators);            // <-- Clear any stale indicator
        });

        row.addEventListener('dragover', (event) => {
            if (!Na__PmReorder__DragSceneId || Na__PmReorder__DragSceneId === sceneId) return;
            if (!canDropOn(Na__PmReorder__DragSceneId, sceneId)) return;     // <-- No indicator for a refused target
            event.preventDefault();                                          // <-- Required to allow a drop
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            const placeAfter = Na__PmReorder__IsPointerBelowMidline(row, event);
            row.classList.toggle(Na__PmReorder__CLASS_DROP_BEFORE, !placeAfter);
            row.classList.toggle(Na__PmReorder__CLASS_DROP_AFTER,   placeAfter);
        });

        row.addEventListener('dragleave', () => Na__PmReorder__ClearDropIndicators(row));

        row.addEventListener('drop', (event) => {
            if (!Na__PmReorder__DragSceneId || Na__PmReorder__DragSceneId === sceneId) return;
            event.preventDefault();

            const placeAfter = Na__PmReorder__IsPointerBelowMidline(row, event);
            const draggedId  = Na__PmReorder__DragSceneId;

            Na__PmReorder__ClearDropIndicators(row);
            Na__PmReorder__DragSceneId = null;

            onDrop(draggedId, sceneId, placeAfter);                          // <-- Editor reorders, renumbers, saves, rebuilds
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Reorder Helpers
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__DevMenu__GetGroupSliceBounds,
        Na__PresentationMode__DevMenu__AreScenesInSameGroup,
        Na__PresentationMode__DevMenu__MoveSceneToIndex,
        Na__PresentationMode__DevMenu__ResolveDropIndex,
        Na__PresentationMode__DevMenu__AttachSceneRowDragHandlers
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
