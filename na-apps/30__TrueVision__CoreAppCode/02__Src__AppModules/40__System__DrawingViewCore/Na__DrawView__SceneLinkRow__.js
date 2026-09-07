// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - SCENE LINK ROW
// =============================================================================
//
// FILE       : Na__DrawView__SceneLinkRow__.js
// NAMESPACE  : Na__DrawSceneRow
// MODULE     : Drawing View Core - Scene Link Row
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show whether a drawing has a carousel card, and let one be made
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - A floor plan or an elevation is only reachable by the viewer once it has a
//   SCENE - a card in the carousel, filed in its own group. That link is made
//   automatically when the drawing is created, and until now it was invisible:
//   nothing in either panel said whether a drawing had a card, and nothing
//   could make one if it did not.
//
// - THAT INVISIBILITY WAS THE BUG. A drawing authored before the link existed,
//   or one whose scene was deleted from the Presentation Scenes panel, was
//   simply absent from the carousel with no way back and no explanation. The
//   workaround people reach for - "+ Add Scene From Camera" while previewing
//   the drawing - captures the PERSPECTIVE camera and produces an ordinary 3D
//   scene sitting in the Floor Plans group, which is worse than nothing: it
//   looks like the drawing but flies you to a 3D view.
//
// - So the state is stated plainly on every row, and the fix is one button.
//   Shared by both panels because the wording, the states and the failure it
//   prevents are identical, and two copies would drift.
//
// INTEGRATION:
// - Na__FloorPlan__DevMenu__Editor__ and Na__Elevation__DevMenu__Editor__ build
//   one of these per drawing row and supply the create handler.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation, after a drawing's scene proved to be both invisible
//   and unrecoverable from the authoring panels.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names
    // ------------------------------------------------------------
    const Na__DrawSceneRow__ROW_CLASS     = 'na-draw-dev__scene-row';
    const Na__DrawSceneRow__STATUS_CLASS  = 'na-draw-dev__scene-status';
    const Na__DrawSceneRow__LINKED_CLASS  = 'na-draw-dev__scene-status--linked';
    const Na__DrawSceneRow__MISSING_CLASS = 'na-draw-dev__scene-status--missing';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Scene Link Status and Action for One Drawing
    // ------------------------------------------------------------
    // context: {
    //   scene       - the linked carousel scene record, or null
    //   groupName   - the group a new card would be filed into
    //   drawingWord - 'plan' or 'elevation', for the wording
    //   onCreate    - make the card now (only called when scene is null)
    // }
    // ------------------------------------------------------------
    function Na__DrawSceneRow__Build(context) {
        const row = document.createElement('div');
        row.className = Na__DrawSceneRow__ROW_CLASS;

        const scene       = context && context.scene;
        const groupName   = (context && context.groupName)   || 'its group';
        const drawingWord = (context && context.drawingWord) || 'drawing';

        const status = document.createElement('span');
        status.className = Na__DrawSceneRow__STATUS_CLASS + ' '
            + (scene ? Na__DrawSceneRow__LINKED_CLASS : Na__DrawSceneRow__MISSING_CLASS);

        if (scene) {
            // Named AND id'd, because the name is what the author recognises
            // and the id is what they will need if they ever read the JSON.
            status.textContent = 'Card: ' + (scene.PresentationMode__Scene__Name || 'unnamed')
                               + '  (' + scene.PresentationMode__Scene__Id + ')';
            status.title       = 'This ' + drawingWord + ' has a card in the ' + groupName + ' group.';
            row.appendChild(status);
            return row;
        }

        status.textContent = 'Not in the carousel';
        status.title       = 'Nobody can reach this ' + drawingWord + ' until it has a card.';
        row.appendChild(status);

        const createBtn = document.createElement('button');
        createBtn.type        = 'button';
        createBtn.className   = 'na-pm-dev__btn na-pm-dev__btn--primary';
        createBtn.textContent = 'Add to Scenes';
        createBtn.title       = 'Create this ' + drawingWord + "'s card in the " + groupName
                              + ' group, pointing at the ' + drawingWord + ' rather than at a 3D camera.';
        createBtn.addEventListener('click', () => {
            if (typeof context.onCreate === 'function') context.onCreate();
        });
        row.appendChild(createBtn);

        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Scene Link Row API
    // ------------------------------------------------------------
    export {
        Na__DrawSceneRow__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
