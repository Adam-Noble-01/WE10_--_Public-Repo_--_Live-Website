// =============================================================================
// TRUEVISION3D - MODEL GROUP SELECTOR
// =============================================================================
//
// FILE       : Na__UiFeature__ModelGroupSelector.js
// NAMESPACE  : Na__UiFeature
// MODULE     : ModelGroupSelector
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Switch between model groups (design phases) at runtime
// CREATED    : 27-Feb-2026
//
// DESCRIPTION:
// - Receives the modelGroups array from TrueVision__ProjectData__.json.
// - Creates selector buttons (one per model group) in the Tools dropdown.
// - When a group is selected: clears current models, loads the new group.
// - Integrates with Na__ModelLoader__LoadAllModels() and the toggle controls.
// - Only visible when a project has more than one model group.
// - Reports every switch to the design phase library, which the Layout
//   Editor's per-viewport Model Source reads.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 13-Sep-2026 - Version 1.1.0
// - Tells Na__ModelGroup__PhaseLibrary__ when a switch starts and when it has
//   finished (after a failure too).
// - A switched-to phase gets the materials library pass the startup load
//   applies; it used to keep the loader's plain materials.
// - The active button is the phase the 3D view actually holds. It was always
//   the newest group, which is wrong whenever the newest is an existing one.
//
// =============================================================================


import {
    Na__ModelLoader__LoadAllModels,
    Na__ModelLoader__SeparateOrbitCubeUrl
} from '../15__ModelLoader/Na__ModelLoader__MultiModel.js';
// @delegate: ./Na__ModelGroup__PhaseLibrary__.js
import {
    Na__PhaseLib__IdOf,
    Na__PhaseLib__GetLiveId,
    Na__PhaseLib__SetLiveLoading,
    Na__PhaseLib__SetLive
} from './Na__ModelGroup__PhaseLibrary__.js';
import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
// @delegate: ./Na__UiFeature__ModelGroupTransitionOverlay__.js
import {
    Na__ModelGroupTransitionOverlay__Show,
    Na__ModelGroupTransitionOverlay__UpdateStatus,
    Na__ModelGroupTransitionOverlay__Hide
} from './Na__UiFeature__ModelGroupTransitionOverlay__.js';


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__GroupSelector__ItemId       = 'naModelGroupSelectorItem';
    const Na__GroupSelector__ButtonId     = 'naModelGroupSelectorButton';
    const Na__GroupSelector__PanelId      = 'naModelGroupSelectorPanel';
    const Na__GroupSelector__ListId       = 'naModelGroupSelectorList';
    const Na__GroupSelector__ButtonClass  = 'na-model-group-selector__button';
    const Na__GroupSelector__ActiveClass  = 'na-model-group-selector__button--active';
    const Na__GroupSelector__LoadingClass = 'na-model-group-selector__button--loading';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Internal State
    // ------------------------------------------------------------
    let Na__GroupSelector__ModelGroups       = [];
    let Na__GroupSelector__ActiveIndex       = 0;
    let Na__GroupSelector__IsLoading         = false;
    let Na__GroupSelector__ModelRoot         = null;
    let Na__GroupSelector__ModelsConfig      = null;
    let Na__GroupSelector__LineResolution    = null;
    let Na__GroupSelector__StatusCallback    = null;
    let Na__GroupSelector__ToggleReinitFn    = null;
    let Na__GroupSelector__AfterLoadFn       = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Cleanup
// -----------------------------------------------------------------------------

    // FUNCTION | Remove All Children from Model Root Group
    // ------------------------------------------------------------
    function Na__GroupSelector__ClearModelRoot() {
        if (!Na__GroupSelector__ModelRoot) return;

        while (Na__GroupSelector__ModelRoot.children.length > 0) {
            const child = Na__GroupSelector__ModelRoot.children[0];
            Na__GroupSelector__ModelRoot.remove(child);

            child.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Group Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Load a Model Group by Index
    // ------------------------------------------------------------
    async function Na__GroupSelector__LoadGroup(groupIndex) {
        if (Na__GroupSelector__IsLoading) return;
        if (groupIndex === Na__GroupSelector__ActiveIndex) return;
        if (groupIndex < 0 || groupIndex >= Na__GroupSelector__ModelGroups.length) return;

        Na__GroupSelector__IsLoading = true;
        Na__GroupSelector__UpdateButtonStates(groupIndex);

        const group = Na__GroupSelector__ModelGroups[groupIndex];
        if (!group || !Array.isArray(group.modelUrls) || group.modelUrls.length === 0) {
            Na__GroupSelector__IsLoading = false;
            return;
        }

        Na__ModelGroupTransitionOverlay__Show(group.label);                // <-- Reveal transition overlay during phase swap

        // HELPER | Mirror loader progress to both the global status and the overlay
        const Na__GroupSelector__ProgressCallback = (message, isError = false) => {
            if (Na__GroupSelector__StatusCallback) {
                Na__GroupSelector__StatusCallback(message, isError);
            }
            Na__ModelGroupTransitionOverlay__UpdateStatus(message);
        };

        Na__GroupSelector__ProgressCallback(`Loading ${group.label || 'model group'}...`);

        const groupId = Na__PhaseLib__IdOf(group);
        Na__PhaseLib__SetLiveLoading(groupId);                             // <-- Off-scene design phases wait while the 3D view reloads

        Na__GroupSelector__ClearModelRoot();

        let loadedGroups = null;
        try {
            const { filteredUrls } = Na__ModelLoader__SeparateOrbitCubeUrl(group.modelUrls);

            loadedGroups = await Na__ModelLoader__LoadAllModels(
                filteredUrls,
                Na__GroupSelector__ModelRoot,
                Na__GroupSelector__ModelsConfig,
                Na__GroupSelector__LineResolution,
                Na__GroupSelector__ProgressCallback
            );

            if (Na__GroupSelector__AfterLoadFn) {
                await Na__GroupSelector__AfterLoadFn(loadedGroups);        // <-- The same materials pass as the startup load
            }

            Na__GroupSelector__ActiveIndex = groupIndex;

            if (Na__GroupSelector__ToggleReinitFn) {
                Na__GroupSelector__ToggleReinitFn(loadedGroups);
            }

            Na__RenderLoop__RequestRender();                                // <-- Redraw after model group switch completes
            console.log(`[TrueVision3D] Model group switched to: ${group.label} (index ${groupIndex})`);
        } catch (error) {
            console.error('[TrueVision3D] Failed to load model group:', error);
            Na__GroupSelector__ProgressCallback('Model group load error', true);
        }

        Na__PhaseLib__SetLive(groupId, loadedGroups);                      // <-- After a failure too: nothing may wait forever

        Na__ModelGroupTransitionOverlay__Hide();                           // <-- Dismiss overlay once load resolves
        Na__GroupSelector__IsLoading = false;
        Na__GroupSelector__UpdateButtonStates(Na__GroupSelector__ActiveIndex);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI Button Generation
// -----------------------------------------------------------------------------

    // FUNCTION | Build Group Selector Buttons
    // ------------------------------------------------------------
    function Na__GroupSelector__BuildButtons() {
        const listContainer = document.getElementById(Na__GroupSelector__ListId);
        if (!listContainer) return;

        listContainer.innerHTML = '';

        Na__GroupSelector__ModelGroups.forEach((group, index) => {
            const button       = document.createElement('button');
            button.className   = Na__GroupSelector__ButtonClass;
            button.textContent = group.label || group.groupId || `Group ${index + 1}`;
            button.dataset.groupIndex = index;

            if (index === Na__GroupSelector__ActiveIndex) {
                button.classList.add(Na__GroupSelector__ActiveClass);
            }

            button.addEventListener('click', () => {
                Na__GroupSelector__LoadGroup(index);
            });

            listContainer.appendChild(button);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Button Active/Loading States
    // ------------------------------------------------------------
    function Na__GroupSelector__UpdateButtonStates(activeIndex) {
        const listContainer = document.getElementById(Na__GroupSelector__ListId);
        if (!listContainer) return;

        const buttons = listContainer.querySelectorAll(`.${Na__GroupSelector__ButtonClass}`);
        buttons.forEach((btn) => {
            const idx = parseInt(btn.dataset.groupIndex, 10);

            btn.classList.remove(Na__GroupSelector__ActiveClass, Na__GroupSelector__LoadingClass);

            if (idx === activeIndex) {
                btn.classList.add(Na__GroupSelector__ActiveClass);
            }

            if (Na__GroupSelector__IsLoading && idx !== Na__GroupSelector__ActiveIndex) {
                btn.classList.add(Na__GroupSelector__LoadingClass);
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Model Group Selector
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeModelGroupSelector(
        modelGroups,
        modelRoot,
        modelsConfig,
        lineResolution,
        statusCallback,
        toggleReinitFn,
        afterLoadFn
    ) {
        if (!modelGroups || modelGroups.length < 2) return;

        // Show newest concept first in the UI list.
        Na__GroupSelector__ModelGroups    = [...modelGroups].reverse();
        Na__GroupSelector__ModelRoot      = modelRoot;
        Na__GroupSelector__ModelsConfig   = modelsConfig;
        Na__GroupSelector__LineResolution = lineResolution;
        Na__GroupSelector__StatusCallback = statusCallback;
        Na__GroupSelector__ToggleReinitFn = toggleReinitFn;
        Na__GroupSelector__AfterLoadFn    = (typeof afterLoadFn === 'function') ? afterLoadFn : null;

        // THE ACTIVE BUTTON IS THE PHASE THE 3D VIEW HOLDS. This was index 0, the
        // newest group, which the startup load does not pick when the newest is
        // an existing-building group - and clicking the real one reloaded it.
        const liveIndex = Na__GroupSelector__ModelGroups.findIndex((group) => Na__PhaseLib__IdOf(group) === Na__PhaseLib__GetLiveId());
        Na__GroupSelector__ActiveIndex    = liveIndex >= 0 ? liveIndex : 0;

        Na__GroupSelector__BuildButtons();

        const selectorItem = document.getElementById(Na__GroupSelector__ItemId);
        if (selectorItem) {
            selectorItem.style.display = '';
        }

        const toggleButton = document.getElementById(Na__GroupSelector__ButtonId);
        const panel        = document.getElementById(Na__GroupSelector__PanelId);

        if (toggleButton && panel) {
            toggleButton.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
            });
        }

        console.log(`[TrueVision3D] Model group selector initialized with ${modelGroups.length} groups`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Model Group Selector API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeModelGroupSelector
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
