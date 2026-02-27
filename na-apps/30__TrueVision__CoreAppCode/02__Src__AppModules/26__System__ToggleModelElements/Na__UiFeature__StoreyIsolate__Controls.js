// =============================================================================
// TRUEVISION3D - STOREY ISOLATE CONTROLS
// =============================================================================
//
// FILE       : Na__UiFeature__StoreyIsolate__Controls.js
// NAMESPACE  : Na__UiFeature
// MODULE     : StoreyIsolate Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Dropdown menu UI for single-floor isolate view control
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Storey Isolate System
    // ------------------------------------------------------------
    import {
        Na__StoreyIsolate__Initialize,
        Na__StoreyIsolate__IsolateSingleStorey,
        Na__StoreyIsolate__ShowEntireBuilding,
        Na__StoreyIsolate__GetState,
        Na__StoreyIsolate__GetStoreyDisplayName
    } from './3dObject__IsolateBuildingStoreys__SystemLogic__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Element IDs
    // ------------------------------------------------------------
    const Na__StoreyIsolate__ItemId            = 'naStoreyIsolateItem';
    const Na__StoreyIsolate__ButtonId          = 'naStoreyIsolateButton';
    const Na__StoreyIsolate__PanelId           = 'naStoreyIsolatePanel';
    const Na__StoreyIsolate__ListId            = 'naStoreyIsolateList';
    const Na__StoreyIsolate__ButtonClass       = 'na-storey-isolate__button';
    const Na__StoreyIsolate__ActiveClass       = 'na-storey-isolate__button--active';
    const Na__StoreyIsolate__InactiveClass     = 'na-storey-isolate__button--inactive';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | UI State Sync
// -----------------------------------------------------------------------------

    // FUNCTION | Get Isolated Storey Key (if exactly one visible)
    // ------------------------------------------------------------
    function Na__StoreyIsolate__GetActiveStoreyKey() {
        const state = Na__StoreyIsolate__GetState();
        if (!state.hasStoreys) return null;

        let activeKey = null;
        let visibleCount = 0;

        for (const key of state.order) {
            if (state.visibleState[key]) {
                visibleCount += 1;
                activeKey = key;
            }
        }

        return visibleCount === 1 ? activeKey : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Isolate Button Visual States
    // ------------------------------------------------------------
    function Na__StoreyIsolate__UpdateButtonStates() {
        const listContainer = document.getElementById(Na__StoreyIsolate__ListId);
        if (!listContainer) return;

        const activeStoreyKey = Na__StoreyIsolate__GetActiveStoreyKey();
        const buttons = listContainer.querySelectorAll(`.${Na__StoreyIsolate__ButtonClass}`);

        buttons.forEach((btn) => {
            const key = btn.dataset.storeyKey;
            if (!key) return;

            const isActive = key === activeStoreyKey;
            btn.classList.remove(Na__StoreyIsolate__ActiveClass, Na__StoreyIsolate__InactiveClass);
            btn.classList.add(isActive ? Na__StoreyIsolate__ActiveClass : Na__StoreyIsolate__InactiveClass);

            const dotEl = btn.querySelector('.na-storey-isolate__dot');
            if (dotEl) {
                dotEl.classList.remove('na-storey-isolate__dot--on', 'na-storey-isolate__dot--off');
                dotEl.classList.add(isActive ? 'na-storey-isolate__dot--on' : 'na-storey-isolate__dot--off');
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dynamic UI Button Generation
// -----------------------------------------------------------------------------

    // FUNCTION | Build Isolate Buttons from Current Storey State
    // ------------------------------------------------------------
    function Na__StoreyIsolate__BuildButtons() {
        const listContainer = document.getElementById(Na__StoreyIsolate__ListId);
        if (!listContainer) return;

        listContainer.innerHTML = '';

        const state = Na__StoreyIsolate__GetState();
        if (!state.hasStoreys) return;

        // Show top storey first in UI for consistency with storey toggle panel.
        const reversedOrder = [...state.order].reverse();

        for (const storeyKey of reversedOrder) {
            const displayName = Na__StoreyIsolate__GetStoreyDisplayName(storeyKey);

            const btn = document.createElement('button');
            btn.className = `${Na__StoreyIsolate__ButtonClass} ${Na__StoreyIsolate__InactiveClass}`;
            btn.dataset.storeyKey = storeyKey;
            btn.title = `Isolate ${displayName} (single floor view, roofs + landscape off)`;

            const dot = document.createElement('span');
            dot.className = 'na-storey-isolate__dot na-storey-isolate__dot--off';
            btn.appendChild(dot);

            const label = document.createElement('span');
            label.className = 'na-storey-isolate__label';
            label.textContent = displayName;
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                Na__StoreyIsolate__IsolateSingleStorey(storeyKey);
                Na__StoreyIsolate__UpdateButtonStates();
            });

            listContainer.appendChild(btn);
        }

        const showAllBtn = document.createElement('button');
        showAllBtn.className = 'na-storey-isolate__show-all-btn';
        showAllBtn.textContent = 'Show Entire Building';
        showAllBtn.addEventListener('click', () => {
            Na__StoreyIsolate__ShowEntireBuilding();
            Na__StoreyIsolate__UpdateButtonStates();
        });

        listContainer.appendChild(showAllBtn);
        Na__StoreyIsolate__UpdateButtonStates();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Storey Isolate Controls
    // ------------------------------------------------------------
    function Na__UiFeature__InitializeStoreyIsolateControls() {
        const hasStoreys = Na__StoreyIsolate__Initialize();
        if (!hasStoreys) {
            console.log('[TrueVision3D] No storey models detected, storey isolate menu hidden');
            return false;
        }

        const isolateItem = document.getElementById(Na__StoreyIsolate__ItemId);
        if (isolateItem) {
            isolateItem.style.display = '';
        }

        Na__StoreyIsolate__BuildButtons();

        const toggleButton = document.getElementById(Na__StoreyIsolate__ButtonId);
        const panel = document.getElementById(Na__StoreyIsolate__PanelId);

        if (toggleButton && panel) {
            toggleButton.addEventListener('click', () => {
                const isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
            });
        }

        console.log('[TrueVision3D] Storey isolate controls initialized');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Storey Isolate Controls API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__InitializeStoreyIsolateControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
