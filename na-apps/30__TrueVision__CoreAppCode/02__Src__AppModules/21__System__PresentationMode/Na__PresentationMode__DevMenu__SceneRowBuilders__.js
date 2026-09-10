// =============================================================================
// TRUEVISION3D - PRESENTATION MODE - DEV MENU SCENE ROW BUILDERS
// =============================================================================
//
// FILE       : Na__PresentationMode__DevMenu__SceneRowBuilders__.js
// NAMESPACE  : Na__PmRows
// MODULE     : PresentationMode - Dev Menu Scene Row Builders
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the per-scene editor row (header, name, group, FOV, move
//              speed, easing, position and action buttons) for the Dev menu
//              Presentation Scenes panel
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Purely presentational. Every state change is handed back to the scene
//   editor through the handlers object, so this module holds no working
//   array, never saves and never talks to R2. Splitting it out keeps the scene
//   editor inside the house line budget now that grouping, reordering and drag
//   and drop live there.
// - A row reads, top to bottom: a header strip (drag handle, "#N - Name" where
//   N is the position WITHIN the scene's group, move up and down arrows), the
//   Name field, the Group dropdown (enabled groups only, absent on an ungrouped
//   project), the FOV slider with live viewport preview, the Move Speed slider,
//   the Easing dropdown, the Position field (1-based within the group) and the
//   action buttons: Update Camera, Regen Thumb, Save Scene, Delete.
// - The drag handle is the ONLY thing that arms a drag on the row, so the
//   sliders stay usable and selecting text in the name field never starts a
//   drag.
//
// HANDLERS CONTRACT (all optional except onMutate):
// - handlers.camera                      : live perspective camera for the FOV preview
// - handlers.onMoveByOffset(sceneId, +-1): reorder arrows
// - handlers.onMoveToPosition(sceneId, n): Position field, 1-based within the group
// - handlers.onMutate(action, scene)     : 'regroup' | 'update' | 'thumb' | 'save-one' | 'delete'
//
// INTEGRATION:
// - Consumed only by Na__PresentationMode__DevMenu__SceneEditor.js.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneRowBuilders__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.1 (port Phase 2)
// - Update Camera is withheld on floor plan and elevation scenes.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation (port Phase 1).
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
        Na__PresentationMode__SceneGroups__GetEnabledGroups,
        Na__PresentationMode__SceneGroups__ResolveSceneGroupId
    } from './Na__PresentationMode__SceneGroups__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Data Accessors
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from './Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation (FOV slider live preview)
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Rename (a drawing card's name is not ours)
    // ------------------------------------------------------------
    // @delegate: ../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js
    // ------------------------------------------------------------
    import {
        Na__DrawRename__OwnsScene,
        Na__DrawRename__RenameSceneCard
    } from '../40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Slider Ranges and Defaults
    // ------------------------------------------------------------
    const Na__PmRows__FOV_MIN            = 5;     // <-- Minimum FOV degrees
    const Na__PmRows__FOV_MAX            = 90;    // <-- Maximum FOV degrees
    const Na__PmRows__FOV_DEFAULT        = 30;    // <-- Default FOV when not set
    const Na__PmRows__TRANSITION_MIN_MS  = 300;   // <-- Minimum transition duration
    const Na__PmRows__TRANSITION_MAX_MS  = 8000;  // <-- Maximum transition duration
    const Na__PmRows__TRANSITION_DEFAULT = 1800;  // <-- Default transition duration
    const Na__PmRows__SENSOR_HEIGHT_MM   = 24;    // <-- Full-frame sensor height (matches cameraLens AppConfig)
    const Na__PmRows__EASING_OPTIONS     = ['easeInOutCubic', 'easeInOutQuad', 'linear']; // <-- Available easing names
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lens Conversion Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert FOV Degrees to Focal Length MM
    // ------------------------------------------------------------
    function Na__PmRows__FovToFocalMm(fovDegrees) {
        const fovRad = (fovDegrees * Math.PI) / 180;
        return Na__PmRows__SENSOR_HEIGHT_MM / (2 * Math.tan(fovRad / 2)); // <-- Inverse tangent formula
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Focal Length MM to FOV Degrees
    // ------------------------------------------------------------
    function Na__PmRows__FocalMmToFov(focalMm) {
        return (2 * Math.atan(Na__PmRows__SENSOR_HEIGHT_MM / (2 * focalMm)) * 180) / Math.PI; // <-- Arctangent formula
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sub-Row Builders
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Labelled Row Shell
    // ------------------------------------------------------------
    function Na__PmRows__BuildLabelledRow(labelText, className) {
        const row = document.createElement('div');
        row.className = className || 'na-pm-dev__row';

        const label = document.createElement('label');
        label.className   = 'na-pm-dev__label';
        label.textContent = labelText;
        row.appendChild(label);

        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the FOV Slider Row for a Scene
    // ------------------------------------------------------------
    function Na__PmRows__BuildFovRow(scene, onChange) {
        const currentFov = (scene.PresentationMode__Scene__CameraPosition
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc
            && scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc.Camera__DefaultMisc__Fov)
            || Na__PmRows__FOV_DEFAULT;

        const currentMm = Math.round(Na__PmRows__FovToFocalMm(currentFov));

        const row = Na__PmRows__BuildLabelledRow('FOV', 'na-pm-dev__slider-row');

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min       = Na__PmRows__FOV_MIN;
        slider.max       = Na__PmRows__FOV_MAX;
        slider.step      = '0.1';
        slider.value     = currentFov.toFixed(1);

        const valueDisplay = document.createElement('span');
        valueDisplay.className   = 'na-pm-dev__value';
        valueDisplay.textContent = `${currentFov.toFixed(1)} deg / ${currentMm}mm`;

        slider.addEventListener('input', () => {
            const fov   = parseFloat(slider.value);
            const lenMm = Math.round(Na__PmRows__FovToFocalMm(fov));
            valueDisplay.textContent = `${fov.toFixed(1)} deg / ${lenMm}mm`;   // <-- Live readout
            onChange(fov);
        });

        row.appendChild(slider);
        row.appendChild(valueDisplay);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Transition Time Slider Row
    // ------------------------------------------------------------
    function Na__PmRows__BuildTransitionRow(scene, onChange) {
        const currentMs = Number.isFinite(scene.PresentationMode__Scene__TransitionTimeToNextSceneMs)
            ? scene.PresentationMode__Scene__TransitionTimeToNextSceneMs
            : Na__PmRows__TRANSITION_DEFAULT;

        const row = Na__PmRows__BuildLabelledRow('Move Speed', 'na-pm-dev__slider-row');

        const slider = document.createElement('input');
        slider.type      = 'range';
        slider.className = 'na-pm-dev__slider';
        slider.min       = Na__PmRows__TRANSITION_MIN_MS;
        slider.max       = Na__PmRows__TRANSITION_MAX_MS;
        slider.step      = '100';
        slider.value     = currentMs;

        const valueDisplay = document.createElement('span');
        valueDisplay.className   = 'na-pm-dev__value';
        valueDisplay.textContent = `${(currentMs / 1000).toFixed(1)}s`;

        slider.addEventListener('input', () => {
            const ms = parseInt(slider.value, 10);
            valueDisplay.textContent = `${(ms / 1000).toFixed(1)}s`;             // <-- Live seconds readout
            onChange(ms);
        });

        row.appendChild(slider);
        row.appendChild(valueDisplay);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Easing Dropdown Row
    // ------------------------------------------------------------
    function Na__PmRows__BuildEasingRow(scene, onChange) {
        const currentEasing = scene.PresentationMode__Scene__TransitionEasing || 'easeInOutCubic';

        const row = Na__PmRows__BuildLabelledRow('Easing');

        const select = document.createElement('select');
        select.className = 'na-pm-dev__select';

        Na__PmRows__EASING_OPTIONS.forEach((opt) => {
            const option    = document.createElement('option');
            option.value    = opt;
            option.text     = opt;
            option.selected = opt === currentEasing;
            select.appendChild(option);
        });

        select.addEventListener('change', () => onChange(select.value));

        row.appendChild(select);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Per-Scene Group Dropdown Row
    // ------------------------------------------------------------
    // Lists only ENABLED groups, which is what makes "a scene assigned to a
    // switched-off group" impossible to author rather than something the
    // viewer has to be protected from at runtime. A scene that has never been
    // assigned shows the group it currently falls back into, so the dropdown
    // always tells the truth about where the scene actually is.
    //
    // Returns null when the project has no groups, so an ungrouped project's
    // rows look exactly as they did before this feature existed.
    // ------------------------------------------------------------
    function Na__PmRows__BuildGroupRow(scene, onChange) {
        if (!Na__PresentationMode__SceneGroups__IsEnabled()) return null;

        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const groups = Na__PresentationMode__SceneGroups__GetEnabledGroups(config);
        if (groups.length === 0) return null;                                // <-- Ungrouped project

        const currentGroupId = Na__PresentationMode__SceneGroups__ResolveSceneGroupId(scene, config);

        const row = Na__PmRows__BuildLabelledRow('Group');

        const select = document.createElement('select');
        select.className = 'na-pm-dev__select';
        select.title     = 'Which group of the carousel this scene appears in';

        groups.forEach((group) => {
            const groupId   = group.PresentationMode__Group__Id;
            const option    = document.createElement('option');
            option.value    = groupId;
            option.text     = group.PresentationMode__Group__Name || groupId;
            option.selected = groupId === currentGroupId;
            select.appendChild(option);
        });

        select.addEventListener('change', () => onChange(select.value));

        row.appendChild(select);
        return row;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Position Field Row (1-based within the group)
    // ------------------------------------------------------------
    // Always shows the visible #N, never a stale sparse Order value, and asks
    // the editor to move the scene when a different position is typed.
    // ------------------------------------------------------------
    function Na__PmRows__BuildPositionRow(sceneId, indexInGroup, countInGroup, onMoveToPosition) {
        const row = Na__PmRows__BuildLabelledRow('Position');

        const input = document.createElement('input');
        input.type      = 'number';
        input.className = 'na-pm-dev__input na-pm-dev__input--short';
        input.min       = 1;
        input.max       = countInGroup;
        input.value     = indexInGroup + 1;
        input.title     = 'Type a position to move this scene there (within its group)';

        input.addEventListener('change', () => {
            const requested = parseInt(input.value, 10);
            if (!Number.isFinite(requested)) {
                input.value = indexInGroup + 1;                              // <-- Reject junk, restore displayed position
                return;
            }
            const clamped = Math.max(1, Math.min(requested, countInGroup));
            if (clamped === indexInGroup + 1) {
                input.value = clamped;                                       // <-- No move needed, just tidy the field
                return;
            }
            if (typeof onMoveToPosition === 'function') onMoveToPosition(sceneId, clamped); // <-- Reorder, renumber, save, rebuild
        });

        row.appendChild(input);
        return row;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Row Builder
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Header Strip (drag handle, title, reorder arrows)
    // ------------------------------------------------------------
    function Na__PmRows__BuildHeader(wrapper, scene, indexInGroup, countInGroup, handlers) {
        const sceneId = scene.PresentationMode__Scene__Id;

        const header = document.createElement('div');
        header.className = 'na-pm-dev__scene-header';

        // DRAG HANDLE | Only the handle arms dragging, so sliders stay usable
        const dragHandle = document.createElement('span');
        dragHandle.className   = 'na-pm-dev__drag-handle';
        dragHandle.textContent = '≡';                                   // <-- Grip glyph (identical-to sign)
        dragHandle.title       = 'Drag to reorder this scene within its group';
        dragHandle.setAttribute('aria-hidden', 'true');
        dragHandle.addEventListener('mousedown', () => { wrapper.draggable = true;  });
        dragHandle.addEventListener('mouseup',   () => { wrapper.draggable = false; });
        header.appendChild(dragHandle);

        const titleEl = document.createElement('strong');
        titleEl.className   = 'na-pm-dev__scene-title';
        titleEl.textContent = `#${indexInGroup + 1} - ${scene.PresentationMode__Scene__Name || sceneId}`;
        header.appendChild(titleEl);

        // MOVE UP / MOVE DOWN | Keyboard-reachable alternative to dragging
        const moveUpBtn = document.createElement('button');
        moveUpBtn.type        = 'button';
        moveUpBtn.className   = 'na-pm-dev__reorder-btn';
        moveUpBtn.textContent = '▲';
        moveUpBtn.title       = 'Move this scene one position earlier';
        moveUpBtn.disabled    = indexInGroup === 0;                          // <-- Already first in its group
        moveUpBtn.addEventListener('click', () => {
            if (typeof handlers.onMoveByOffset === 'function') handlers.onMoveByOffset(sceneId, -1);
        });
        header.appendChild(moveUpBtn);

        const moveDownBtn = document.createElement('button');
        moveDownBtn.type        = 'button';
        moveDownBtn.className   = 'na-pm-dev__reorder-btn';
        moveDownBtn.textContent = '▼';
        moveDownBtn.title       = 'Move this scene one position later';
        moveDownBtn.disabled    = indexInGroup === countInGroup - 1;         // <-- Already last in its group
        moveDownBtn.addEventListener('click', () => {
            if (typeof handlers.onMoveByOffset === 'function') handlers.onMoveByOffset(sceneId, 1);
        });
        header.appendChild(moveDownBtn);

        wrapper.appendChild(header);
        return titleEl;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Action Buttons Row
    // ------------------------------------------------------------
    function Na__PmRows__BuildActions(scene, onMutate) {
        const actionsRow = document.createElement('div');
        actionsRow.className = 'na-pm-dev__actions';

        const buttons = [
            { label : 'Update Camera', action : 'update',   modifier : '',                        title : 'Overwrite this scene with the current camera position, rotation and FOV' },
            { label : 'Regen Thumb',   action : 'thumb',    modifier : '',                        title : 'Render the current viewport as a WebP thumbnail for this scene' },
            { label : 'Save Scene',    action : 'save-one', modifier : ' na-pm-dev__btn--primary', title : 'Save this scene and the whole presentation block to R2' },
            { label : 'Delete',        action : 'delete',   modifier : ' na-pm-dev__btn--danger',  title : 'Delete this scene from the project' }
        ];

        // DRAWING SCENES have no camera to update: their pose is built by the
        // drawing that owns them, so Update Camera is withheld (plan 5.4).
        const isDrawingScene = Boolean(scene.PresentationMode__Scene__FloorPlanId || scene.PresentationMode__Scene__ElevationId);

        buttons.filter((spec) => !(isDrawingScene && spec.action === 'update')).forEach((spec) => {
            const btn = document.createElement('button');
            btn.type        = 'button';
            btn.className   = 'na-pm-dev__btn' + spec.modifier;
            btn.textContent = spec.label;
            btn.title       = spec.title;
            btn.addEventListener('click', () => onMutate(spec.action, scene));
            actionsRow.appendChild(btn);
        });

        return actionsRow;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build a Single Scene Editor Row
    // ------------------------------------------------------------
    function Na__PresentationMode__DevMenu__BuildSceneRow(scene, indexInGroup, countInGroup, handlers) {
        const sceneId  = scene.PresentationMode__Scene__Id;
        const onMutate = (handlers && typeof handlers.onMutate === 'function') ? handlers.onMutate : () => {};
        const safeHandlers = handlers || {};

        const wrapper = document.createElement('div');
        wrapper.className       = 'na-pm-dev__scene-row';
        wrapper.dataset.sceneId = sceneId;

        // HEADER STRIP
        const titleEl = Na__PmRows__BuildHeader(wrapper, scene, indexInGroup, countInGroup, safeHandlers);

        // NAME INPUT | A DRAWING CARD'S NAME IS NOT THIS EDITOR'S TO KEEP.
        // A floor plan or elevation card is a view of a drawing record that
        // holds the same name inside LayoutEditor__DrawingsData, a block this
        // editor's save never writes. Editing the card in place and saving
        // would persist the new name here and leave the record on the old one
        // for good. So a drawing card commits through the drawing rename
        // path, which writes both blocks and the section binding in one save;
        // an ordinary 3D card keeps the live in-place edit it always had.
        const ownedByDrawing = Na__DrawRename__OwnsScene(scene);

        const nameRow   = Na__PmRows__BuildLabelledRow('Name');
        const nameInput = document.createElement('input');
        nameInput.type      = 'text';
        nameInput.className = 'na-pm-dev__input';
        nameInput.value     = scene.PresentationMode__Scene__Name || '';
        if (ownedByDrawing) nameInput.title = 'This card belongs to a drawing. Renaming it renames the drawing and saves both.';

        const showTitle = () => { titleEl.textContent = `#${indexInGroup + 1} - ${nameInput.value || sceneId}`; };

        nameInput.addEventListener('input', () => {
            showTitle();
            if (ownedByDrawing) return;                                      // <-- Committed on change, not per keystroke
            scene.PresentationMode__Scene__Name = nameInput.value;           // <-- Update working copy directly
        });

        nameInput.addEventListener('change', () => {
            if (!ownedByDrawing) return;
            const next = nameInput.value.trim();
            const settle = () => {
                nameInput.value    = scene.PresentationMode__Scene__Name || '';
                nameInput.disabled = false;
                showTitle();
            };
            if (next.length === 0 || next === scene.PresentationMode__Scene__Name) { settle(); return; }

            nameInput.disabled = true;
            Promise.resolve(Na__DrawRename__RenameSceneCard(scene, next, safeHandlers.showToast)).then(settle);
        });

        nameRow.appendChild(nameInput);
        wrapper.appendChild(nameRow);

        // GROUP DROPDOWN | The only control that moves a scene between groups
        const groupRow = Na__PmRows__BuildGroupRow(scene, (newGroupId) => {
            scene.PresentationMode__Scene__GroupId = newGroupId;             // <-- Explicit assignment
            onMutate('regroup', scene);                                      // <-- Renumbers both groups, persists, rebuilds
        });
        if (groupRow) wrapper.appendChild(groupRow);

        // FOV SLIDER | Live viewport preview through the injected camera
        wrapper.appendChild(Na__PmRows__BuildFovRow(scene, (newFov) => {
            if (!scene.PresentationMode__Scene__CameraPosition) {
                scene.PresentationMode__Scene__CameraPosition = {};
            }
            if (!scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc) {
                scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc = {};
            }
            scene.PresentationMode__Scene__CameraPosition.Camera__DefaultMisc.Camera__DefaultMisc__Fov = newFov;
            scene.PresentationMode__Scene__LensMm = Math.round(Na__PmRows__FovToFocalMm(newFov)); // <-- Keep lens mm in sync
            if (safeHandlers.camera) {
                safeHandlers.camera.fov = newFov;
                safeHandlers.camera.updateProjectionMatrix();                // <-- Live preview in viewport
                Na__RenderLoop__RequestRender();                             // <-- Redraw frame so FOV change is visible
            }
        }));

        // TRANSITION TIME SLIDER
        wrapper.appendChild(Na__PmRows__BuildTransitionRow(scene, (newMs) => {
            scene.PresentationMode__Scene__TransitionTimeToNextSceneMs = newMs;
        }));

        // EASING DROPDOWN
        wrapper.appendChild(Na__PmRows__BuildEasingRow(scene, (newEasing) => {
            scene.PresentationMode__Scene__TransitionEasing = newEasing;
        }));

        // POSITION FIELD | 1-based within the group
        wrapper.appendChild(Na__PmRows__BuildPositionRow(sceneId, indexInGroup, countInGroup, safeHandlers.onMoveToPosition));

        // ACTION BUTTONS
        wrapper.appendChild(Na__PmRows__BuildActions(scene, onMutate));

        return wrapper;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Row Builder API
    // ------------------------------------------------------------
    export {
        Na__PresentationMode__DevMenu__BuildSceneRow,
        Na__PmRows__FovToFocalMm   as Na__PresentationMode__DevMenu__FovToFocalMm,
        Na__PmRows__FocalMmToFov   as Na__PresentationMode__DevMenu__FocalMmToFov,
        Na__PmRows__TRANSITION_DEFAULT as Na__PresentationMode__DevMenu__TRANSITION_DEFAULT_MS
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
